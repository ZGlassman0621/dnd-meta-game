/**
 * Round-trip test for the creator's level-1 picks persistence.
 * Run: node tests/creator-l1-picks.test.js
 *
 * Exercises the REAL character router (mounted on an ephemeral port, no auth —
 * the POST handler takes no req.user) against the real DB, proving:
 *   - migration 058 added the fighting_style + expertise columns
 *   - POST /api/character persists known_cantrips / known_spells / feats /
 *     fighting_style / expertise (i.e. the INSERT column/placeholder/value
 *     counts line up after adding the two new columns)
 *   - PUT /api/character/:id accepts the same fields via the allowlist
 *
 * TEST_-prefixed, self-cleaning.
 */

import http from 'node:http'
import express from 'express'
import characterRouter from '../server/routes/character.js'
import { initDatabase, dbGet, dbRun, dbAll } from '../server/database.js'

let passed = 0
let failed = 0
function assert(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++ }
  else { console.error(`  ✗ ${msg}`); failed++ }
}
function eq(a, b, msg) { assert(JSON.stringify(a) === JSON.stringify(b), `${msg} (got ${JSON.stringify(a)})`) }
const parse = (v) => { try { return JSON.parse(v) } catch { return v } }

let server, baseUrl
const createdIds = []

async function req(method, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined
  })
  let json = null
  try { json = await res.json() } catch { /* empty */ }
  return { status: res.status, body: json }
}

async function run() {
  await initDatabase()

  // Confirm migration 058 columns exist.
  const cols = await dbAll('PRAGMA table_info(characters)')
  const names = new Set(cols.map(c => c.name))
  assert(names.has('fighting_style'), 'characters.fighting_style column exists (migration 058)')
  assert(names.has('expertise'), 'characters.expertise column exists (migration 058)')

  const app = express()
  app.use(express.json({ limit: '4mb' }))
  app.use('/api/character', characterRouter)
  server = await new Promise(r => { const s = http.createServer(app).listen(0, '127.0.0.1', () => r(s)) })
  baseUrl = `http://127.0.0.1:${server.address().port}`

  // --- POST a wizard-ish caster + fighting style + expertise + feat ---
  console.log('\n=== POST persists level-1 picks ===\n')
  const postBody = {
    name: 'TEST_L1Picks_Hero',
    class: 'wizard',
    level: 1,
    creation_phase: 'active',
    ability_scores: JSON.stringify({ str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }),
    known_cantrips: JSON.stringify(['Fire Bolt', 'Mage Hand', 'Light']),
    known_spells: JSON.stringify(['Magic Missile', 'Shield', 'Mage Armor', 'Detect Magic', 'Sleep', 'Burning Hands']),
    feats: JSON.stringify([{ key: 'alert', name: 'Alert', abilityChoice: null, source: 'variant_human', acquiredAtLevel: 1 }]),
    fighting_style: 'archery',
    expertise: JSON.stringify(['stealth', 'perception'])
  }
  const post = await req('POST', '/api/character', postBody)
  assert(post.status === 201 || post.status === 200, `POST returns success (got ${post.status})`)
  const newId = post.body?.id || post.body?.character?.id
  assert(!!newId, 'POST returns a character id')
  if (newId) createdIds.push(newId)

  const row = await dbGet('SELECT * FROM characters WHERE id = ?', [newId])
  assert(!!row, 'character row was created')
  eq(parse(row.known_cantrips), ['Fire Bolt', 'Mage Hand', 'Light'], 'known_cantrips persisted')
  eq(parse(row.known_spells).length, 6, 'known_spells persisted (6)')
  eq(parse(row.feats)[0]?.name, 'Alert', 'feats persisted')
  eq(row.fighting_style, 'archery', 'fighting_style persisted')
  eq(parse(row.expertise), ['stealth', 'perception'], 'expertise persisted')

  // --- PUT updates the same fields (allowlist) ---
  console.log('\n=== PUT updates level-1 picks (allowlist) ===\n')
  const put = await req('PUT', `/api/character/${newId}`, {
    fighting_style: 'defense',
    expertise: JSON.stringify(['arcana', 'history']),
    known_cantrips: JSON.stringify(['Prestidigitation'])
  })
  assert(put.status === 200, `PUT returns 200 (got ${put.status})`)
  const row2 = await dbGet('SELECT * FROM characters WHERE id = ?', [newId])
  eq(row2.fighting_style, 'defense', 'PUT updated fighting_style')
  eq(parse(row2.expertise), ['arcana', 'history'], 'PUT updated expertise')
  eq(parse(row2.known_cantrips), ['Prestidigitation'], 'PUT updated known_cantrips')
}

async function cleanup() {
  for (const id of createdIds) {
    await dbRun('DELETE FROM character_ancestry_feats WHERE character_id = ?', [id]).catch(() => {})
    await dbRun('DELETE FROM character_themes WHERE character_id = ?', [id]).catch(() => {})
    await dbRun('DELETE FROM characters WHERE id = ?', [id]).catch(() => {})
  }
  if (server) await new Promise(r => server.close(r))
}

try {
  await run()
} catch (e) {
  console.error('FATAL:', e)
  failed++
} finally {
  await cleanup()
  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}
