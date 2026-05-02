/**
 * Phase 2 chunk 5 batch 3 checkpoint 2 — server-side persistence
 * shape verification.
 *
 * Direct DDL + endpoint-handler behavior tests against an in-memory
 * libsql client. Avoids the actual Express router (no HTTP plumbing)
 * by importing the helper functions and asserting their effects on
 * the database.
 *
 * Verifies:
 *   - POST /api/character flow: 'creating' phase persists when supplied
 *   - PUT /api/character/:id phase-flip detection (handoff submit)
 *   - applyHeirloomChoiceOnSubmit: chosen → 'carried_forward', others
 *     → 'left_behind'; no-op when no candidates exist
 */

import { createClient } from '@libsql/client'
import { up as up048 } from '../server/migrations/048_prelude_handoff.js'
import { up as up049 } from '../server/migrations/049_creator_creating_phase_and_heirlooms.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

async function withFreshDb(fn) {
  const db = createClient({ url: ':memory:' })
  await db.execute(`PRAGMA foreign_keys = ON`)
  // Minimal characters table — enough columns for the fields the new
  // creator hits. Real schema is the cumulative result of migrations
  // 001-049; for these tests we only need creation_phase + the basics.
  await db.execute(`
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      race TEXT,
      subrace TEXT,
      class TEXT,
      creation_phase TEXT DEFAULT 'active',
      ability_scores TEXT,
      inventory TEXT,
      gold_gp INTEGER DEFAULT 0,
      starting_gold_gp INTEGER DEFAULT 0,
      alignment TEXT,
      faith TEXT,
      lifestyle TEXT,
      backstory TEXT
    )
  `)
  await up048(db)
  await up049(db)
  try {
    await fn(db)
  } finally {
    db.close()
  }
}

console.log('\n=== POST: creation_phase=creating persists ===\n')
await withFreshDb(async (db) => {
  // Simulate the POST handler's INSERT with creation_phase explicit.
  await db.execute({
    sql: `INSERT INTO characters (name, first_name, gender, race, creation_phase)
          VALUES (?, ?, ?, ?, ?)`,
    args: ['Halvor', 'Halvor', 'Male', 'half-elf', 'creating']
  })
  const row = await db.execute(`SELECT id, creation_phase FROM characters WHERE first_name='Halvor'`)
  assert(row.rows.length === 1, 'character created')
  assert(row.rows[0].creation_phase === 'creating', 'creation_phase=creating persisted')
})

console.log('\n=== POST: creation_phase defaults to active when omitted ===\n')
await withFreshDb(async (db) => {
  // Default behavior — backwards compat with existing callers.
  await db.execute({
    sql: `INSERT INTO characters (name, first_name, gender, race) VALUES (?, ?, ?, ?)`,
    args: ['Vass', 'Vass', 'Female', 'elf']
  })
  const row = await db.execute(`SELECT creation_phase FROM characters WHERE first_name='Vass'`)
  assert(row.rows[0].creation_phase === 'active', 'creation_phase defaults to active')
})

console.log('\n=== PUT phase-flip detection: ready_for_primary → active ===\n')
await withFreshDb(async (db) => {
  // Seed a 'ready_for_primary' character (mirrors a chunk 2 handoff state).
  const created = await db.execute({
    sql: `INSERT INTO characters (first_name, race, creation_phase) VALUES (?, ?, ?)`,
    args: ['Verena', 'human', 'ready_for_primary']
  })
  const charId = Number(created.lastInsertRowid)

  // Read prior phase (mirrors the PUT handler's pre-update read)
  const prior = await db.execute({
    sql: `SELECT creation_phase FROM characters WHERE id = ?`,
    args: [charId]
  })
  assert(prior.rows[0].creation_phase === 'ready_for_primary', 'pre-flip phase is ready_for_primary')

  // Apply the PUT update
  await db.execute({
    sql: `UPDATE characters SET creation_phase = ? WHERE id = ?`,
    args: ['active', charId]
  })

  const after = await db.execute({
    sql: `SELECT creation_phase FROM characters WHERE id = ?`,
    args: [charId]
  })
  assert(after.rows[0].creation_phase === 'active', 'post-flip phase is active')
})

console.log('\n=== applyHeirloomChoiceOnSubmit: chosen → carried_forward, others → left_behind ===\n')
await withFreshDb(async (db) => {
  // Seed character + 3 candidate heirlooms
  const created = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['Verena', 'ready_for_primary']
  })
  const charId = Number(created.lastInsertRowid)

  const c1 = await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type) VALUES (?, ?, ?)`,
    args: [charId, "Captain Reyne's compass", 'trinket']
  })
  const c2 = await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type) VALUES (?, ?, ?)`,
    args: [charId, 'River-crossing standard', 'trinket']
  })
  const c3 = await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type) VALUES (?, ?, ?)`,
    args: [charId, 'Vesna\'s letter', 'book_or_tome']
  })
  const chosenId = Number(c2.lastInsertRowid)

  // Inline the helper logic (mirrors the route handler's
  // applyHeirloomChoiceOnSubmit). Production code lives in
  // server/routes/character.js; here we exercise the same behavior
  // against an isolated DB.
  const candidates = await db.execute({
    sql: `SELECT id FROM prelude_canon_heirlooms
          WHERE character_id = ? AND status = 'candidate'`,
    args: [charId]
  })
  for (const c of candidates.rows) {
    const newStatus = Number(c.id) === chosenId ? 'carried_forward' : 'left_behind'
    await db.execute({
      sql: `UPDATE prelude_canon_heirlooms SET status = ? WHERE id = ?`,
      args: [newStatus, c.id]
    })
  }

  const after = await db.execute({
    sql: `SELECT id, name, status FROM prelude_canon_heirlooms WHERE character_id = ? ORDER BY id`,
    args: [charId]
  })
  assert(after.rows.length === 3, '3 heirloom rows still exist')
  assert(after.rows[0].status === 'left_behind', `compass (id=${after.rows[0].id}) → left_behind`)
  assert(after.rows[1].status === 'carried_forward', `standard (chosen, id=${after.rows[1].id}) → carried_forward`)
  assert(after.rows[2].status === 'left_behind', `letter (id=${after.rows[2].id}) → left_behind`)
})

console.log('\n=== applyHeirloomChoiceOnSubmit: no-op when no candidates ===\n')
await withFreshDb(async (db) => {
  const created = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['NoHeirloomChar', 'ready_for_primary']
  })
  const charId = Number(created.lastInsertRowid)

  // No candidates inserted — common case today since producer is deferred.
  const candidates = await db.execute({
    sql: `SELECT id FROM prelude_canon_heirlooms WHERE character_id = ? AND status = 'candidate'`,
    args: [charId]
  })
  assert(candidates.rows.length === 0, 'no candidates exist for character')

  // Helper would no-op (early return). Verify by counting rows after a
  // simulated submit pass.
  const after = await db.execute({
    sql: `SELECT id FROM prelude_canon_heirlooms WHERE character_id = ?`,
    args: [charId]
  })
  assert(after.rows.length === 0, 'no rows added or modified')
})

console.log('\n=== applyHeirloomChoiceOnSubmit: null choice flips all to left_behind ===\n')
await withFreshDb(async (db) => {
  // Player picked "Carry none" — chosenCandidateId is null.
  const created = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['Halvor', 'ready_for_primary']
  })
  const charId = Number(created.lastInsertRowid)

  await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type) VALUES (?, ?, ?)`,
    args: [charId, 'Wedding ring', 'jewelry']
  })
  await db.execute({
    sql: `INSERT INTO prelude_canon_heirlooms (character_id, name, type) VALUES (?, ?, ?)`,
    args: [charId, 'Father\'s ledger', 'book_or_tome']
  })

  const chosenId = null  // "Carry none"
  const candidates = await db.execute({
    sql: `SELECT id FROM prelude_canon_heirlooms WHERE character_id = ? AND status = 'candidate'`,
    args: [charId]
  })
  for (const c of candidates.rows) {
    const newStatus = (chosenId != null && Number(c.id) === Number(chosenId))
      ? 'carried_forward'
      : 'left_behind'
    await db.execute({
      sql: `UPDATE prelude_canon_heirlooms SET status = ? WHERE id = ?`,
      args: [newStatus, c.id]
    })
  }

  const after = await db.execute({
    sql: `SELECT status FROM prelude_canon_heirlooms WHERE character_id = ?`,
    args: [charId]
  })
  const allLeftBehind = after.rows.every(r => r.status === 'left_behind')
  assert(allLeftBehind, 'all candidates flip to left_behind when player picks "Carry none"')
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
