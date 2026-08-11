/**
 * Current-player resolver — the replacement for the deleted account system.
 *
 * The account system (register / bcrypt / JWT / Bearer token) came out in
 * v1.0.173. What did NOT come out is campaign ownership scoping, and that is
 * the whole reason this test exists.
 *
 * `campaignService.getAllCampaigns` and `getActiveCampaigns` both open with
 * `if (!userId) return []` — written so a caller with no user context leaks
 * nothing. That contract is fine, but it turns a missing `req.user` into an
 * EMPTY CAMPAIGN LIST rather than an error: every request still returns 200,
 * and the player's campaigns simply stop existing in the UI. Deleting auth
 * without noticing this would have shipped exactly that.
 *
 * So the assertions below are less about the middleware than about the
 * round trip it protects: create a campaign the way the route does
 * (`req.user?.id`), then list it back the way the route does. If `req.user`
 * ever stops being populated, the round trip returns [] and this fails.
 */

import express from 'express'
import { once } from 'node:events'
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import currentPlayer from '../server/middleware/currentPlayer.js'
import * as campaignService from '../server/services/campaignService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.log(`  ✗ ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`)
}

/**
 * Minimal app exposing whatever the middleware attached, plus the two campaign
 * calls the real route makes. Deliberately not `server/index.js` — that calls
 * app.listen(3000) at import time.
 */
async function startProbeServer() {
  const app = express()
  app.use(express.json())
  app.use('/api', currentPlayer)

  app.get('/api/whoami', (req, res) => res.json({ user: req.user ?? null }))

  // Mirrors routes/campaign.js exactly, including the `?.` — if req.user is
  // undefined these silently succeed with nothing, which is the bug.
  app.post('/api/campaign', async (req, res) => {
    const created = await campaignService.createCampaign({ ...req.body, user_id: req.user?.id })
    res.json(created)
  })
  app.get('/api/campaign', async (req, res) => {
    res.json(await campaignService.getAllCampaigns(req.user?.id))
  })
  app.get('/api/campaign/active', async (req, res) => {
    res.json(await campaignService.getActiveCampaigns(req.user?.id))
  })

  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  const base = `http://127.0.0.1:${port}`

  async function request(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b) => request('POST', p, b),
    close: () => new Promise(r => server.close(r))
  }
}

async function run() {
  await initDatabase()

  const createdCampaignIds = []
  const server = await startProbeServer()

  try {
    // ============================================================
    console.log('\n=== Test 1: a request with no credentials still gets a player ===\n')
    // ============================================================

    // The point of the change: no Authorization header, no token, no login —
    // and the request is served rather than 401'd.
    const who = await server.get('/api/whoami')
    assertEqual(who.status, 200, 'an unauthenticated request is served, not rejected')
    assert(who.body?.user != null, 'req.user is populated')
    assert(Number.isInteger(who.body.user.id), 'the resolved player has an integer id')
    assert(typeof who.body.user.username === 'string' && who.body.user.username.length > 0,
      'the resolved player has a username')

    // On a freshly built test database the users table starts empty, so this
    // exercises the create-a-default path rather than the read path.
    const users = await dbAll('SELECT id FROM users ORDER BY id ASC')
    assert(users.length >= 1, 'a player row exists after the first request')

    // ============================================================
    console.log('\n=== Test 2: resolution is stable across requests ===\n')
    // ============================================================

    const second = await server.get('/api/whoami')
    assertEqual(second.body.user.id, who.body.user.id,
      'the same player id is resolved on a later request')

    // Repeated requests must not keep inserting players — this middleware runs
    // on every single /api call.
    const usersAfter = await dbAll('SELECT id FROM users ORDER BY id ASC')
    assertEqual(usersAfter.length, users.length, 'no duplicate player rows are created')

    // Lowest id wins, so an old multi-user database resolves deterministically
    // rather than picking a different owner between restarts.
    assertEqual(who.body.user.id, Number(usersAfter[0].id),
      'the lowest-id player is the one resolved')

    // ============================================================
    console.log('\n=== Test 3: the campaign round trip — the regression that matters ===\n')
    // ============================================================

    const created = await server.post('/api/campaign', {
      name: 'TEST_CURPLAYER Campaign',
      setting: 'Forgotten Realms'
    })
    assertEqual(created.status, 200, 'a campaign can be created')
    createdCampaignIds.push(created.body.id)

    // Without a resolved player this would be NULL, and the list below would
    // come back empty while still returning 200.
    assertEqual(Number(created.body.user_id), who.body.user.id,
      'the new campaign is owned by the resolved player')

    const listed = await server.get('/api/campaign')
    assert(Array.isArray(listed.body), 'the campaign list is an array')
    assert(listed.body.some(c => c.id === created.body.id),
      'the created campaign comes back in the list — not silently scoped away')

    const active = await server.get('/api/campaign/active')
    assert(active.body.some(c => c.id === created.body.id),
      'and in the active list')

    // The negative control: this is precisely what a missing req.user produces.
    // If this ever stops returning [], the contract the middleware protects has
    // changed and the reasoning in currentPlayer.js needs revisiting.
    const unscoped = await campaignService.getAllCampaigns(undefined)
    assertEqual(unscoped.length, 0,
      'getAllCampaigns(undefined) still returns [] — the trap is real, not hypothetical')
  } finally {
    await server.close()
  }

  console.log('\n=== Cleanup ===\n')
  for (const id of createdCampaignIds) {
    await dbRun('DELETE FROM campaigns WHERE id = ?', [id])
  }
  const leftover = await dbGet(
    "SELECT COUNT(*) AS n FROM campaigns WHERE name LIKE 'TEST_CURPLAYER%'"
  )
  assertEqual(Number(leftover.n), 0, 'test campaigns removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
