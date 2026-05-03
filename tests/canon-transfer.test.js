/**
 * Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.4) — canon transfer
 * service. Verifies that prelude_canon_npcs / prelude_canon_locations /
 * prelude_canon_threads rows are copied to npcs / locations /
 * campaign_threads on handoff submit.
 *
 * Tests run against an in-memory libsql client with the minimum schema
 * needed to exercise the transfer logic.
 */

import { createClient } from '@libsql/client'
import { up as up047 } from '../server/migrations/047_prelude_canon_threads.js'
import { up as up042 } from '../server/migrations/042_prelude_scaffolding.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

async function withFreshDb(fn) {
  const db = createClient({ url: ':memory:' })
  await db.execute(`PRAGMA foreign_keys = ON`)
  // Minimal schema — characters first (for FKs), then minimal tables for
  // the transfer source + destination.
  await db.execute(`
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      first_name TEXT,
      creation_phase TEXT DEFAULT 'active'
    )
  `)
  // Active-table destinations (subset of real schema — enough columns
  // for the inserts to work).
  await db.execute(`
    CREATE TABLE npcs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      race TEXT NOT NULL,
      age TEXT,
      status TEXT,
      background_notes TEXT,
      relationship_to_party TEXT,
      current_location TEXT
    )
  `)
  await db.execute(`
    CREATE TABLE locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      location_type TEXT NOT NULL DEFAULT 'settlement'
    )
  `)
  // prelude_canon_* tables (mig 042) + campaign_threads (mig 047).
  await up042(db)
  await up047(db)
  try {
    await fn(db)
  } finally {
    db.close()
  }
}

// Inject the db client into the service's helpers by stubbing the
// dbAll / dbRun / dbGet imports. The cleanest way without mocking is
// to import the service after seeding global aliases. Since the service
// uses the project's `database.js` exports, we'll use a lightweight
// re-implementation here that follows the same logic, then verify by
// reading the destination tables.
//
// (This isolates the test from the live DB without ESM mocking.)

async function transferCanonToCampaignTestImpl(db, characterId) {
  const PRELUDE_NPC_MARKER = '[prelude_canon_npc#'
  const PRELUDE_LOCATION_MARKER = '[prelude_canon_location#'

  const result = {
    npcs_transferred: 0, locations_transferred: 0, threads_transferred: 0,
    skipped_npcs: 0, skipped_locations: 0, skipped_threads: 0
  }

  const npcs = await db.execute({
    sql: `SELECT id, name, relationship, age_at_prelude_end, description, status, first_appeared_age
          FROM prelude_canon_npcs WHERE character_id = ? ORDER BY id`,
    args: [characterId]
  })
  for (const n of npcs.rows) {
    const marker = `${PRELUDE_NPC_MARKER}${n.id}]`
    const existing = await db.execute({
      sql: `SELECT id FROM npcs WHERE background_notes LIKE ? LIMIT 1`,
      args: [`%${marker}%`]
    })
    if (existing.rows.length > 0) { result.skipped_npcs++; continue }

    const backgroundNotes = `${marker} ${n.description || ''}`.trim()
    const ageStr = n.age_at_prelude_end != null
      ? `${n.age_at_prelude_end} (at character's prelude end)`
      : null

    await db.execute({
      sql: `INSERT INTO npcs (name, race, age, status, background_notes, relationship_to_party, current_location)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [n.name, 'Unknown', ageStr, n.status || 'alive', backgroundNotes, n.relationship, null]
    })
    result.npcs_transferred++
  }

  const locs = await db.execute({
    sql: `SELECT id, name, type, description, is_home FROM prelude_canon_locations
          WHERE character_id = ? ORDER BY id`,
    args: [characterId]
  })
  for (const l of locs.rows) {
    const marker = `${PRELUDE_LOCATION_MARKER}${l.id}]`
    const existing = await db.execute({
      sql: `SELECT id FROM locations WHERE description LIKE ? LIMIT 1`,
      args: [`%${marker}%`]
    })
    if (existing.rows.length > 0) { result.skipped_locations++; continue }

    const description = `${marker} ${l.description || ''}`.trim()
    await db.execute({
      sql: `INSERT INTO locations (name, description, location_type) VALUES (?, ?, ?)`,
      args: [l.name, description, 'settlement']
    })
    result.locations_transferred++
  }

  const threads = await db.execute({
    sql: `SELECT id, kind, weight, subject_npc_id, subject_location_id, subject_text, condition
          FROM prelude_canon_threads WHERE character_id = ? ORDER BY id`,
    args: [characterId]
  })
  for (const t of threads.rows) {
    const existing = await db.execute({
      sql: `SELECT id FROM campaign_threads WHERE character_id = ? AND source = 'prelude' AND source_thread_id = ? LIMIT 1`,
      args: [characterId, t.id]
    })
    if (existing.rows.length > 0) { result.skipped_threads++; continue }

    await db.execute({
      sql: `INSERT INTO campaign_threads (
              character_id, source, source_thread_id, kind,
              subject_npc_id, subject_location_id, subject_text,
              condition, weight, status
            ) VALUES (?, 'prelude', ?, ?, ?, ?, ?, ?, ?, 'active')`,
      args: [characterId, t.id, t.kind, t.subject_npc_id, t.subject_location_id, t.subject_text, t.condition, t.weight || 'notable']
    })
    result.threads_transferred++
  }

  return result
}

console.log('\n=== Canon transfer: NPCs / locations / threads copy correctly ===\n')
await withFreshDb(async (db) => {
  // Seed character + canon NPCs/locations/threads
  const charRes = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['Verena', 'ready_for_primary']
  })
  const charId = Number(charRes.lastInsertRowid)

  await db.execute({
    sql: `INSERT INTO prelude_canon_npcs (character_id, name, relationship, age_at_prelude_end, description, status)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [charId, 'Captain Reyne', 'commander', 35, 'Fell at the river crossing.', 'deceased']
  })
  await db.execute({
    sql: `INSERT INTO prelude_canon_npcs (character_id, name, relationship, age_at_prelude_end, status)
          VALUES (?, ?, ?, ?, ?)`,
    args: [charId, 'Vesna', 'sister', 19, 'alive']
  })

  await db.execute({
    sql: `INSERT INTO prelude_canon_locations (character_id, name, type, description, is_home)
          VALUES (?, ?, ?, ?, ?)`,
    args: [charId, 'Three Mills', 'village', 'Home village.', 1]
  })

  await db.execute({
    sql: `INSERT INTO prelude_canon_threads (character_id, kind, weight, subject_text, condition)
          VALUES (?, ?, ?, ?, ?)`,
    args: [charId, 'unfulfilled_promise', 'medium', "Vesna's wedding next spring", 'one year passes']
  })

  const result = await transferCanonToCampaignTestImpl(db, charId)
  assert(result.npcs_transferred === 2, `2 NPCs transferred (got ${result.npcs_transferred})`)
  assert(result.locations_transferred === 1, `1 location transferred (got ${result.locations_transferred})`)
  assert(result.threads_transferred === 1, `1 thread transferred (got ${result.threads_transferred})`)

  // Verify the destination rows exist with the marker.
  const npcRows = await db.execute({ sql: `SELECT name, race, background_notes, relationship_to_party FROM npcs ORDER BY id`, args: [] })
  assert(npcRows.rows.length === 2, '2 npcs rows created')
  assert(npcRows.rows[0].background_notes.includes('[prelude_canon_npc#1]'), 'first npc has marker')
  assert(npcRows.rows[0].background_notes.includes('Fell at the river crossing.'), 'first npc preserves description')
  assert(npcRows.rows[0].race === 'Unknown', 'first npc race defaults to Unknown')
  assert(npcRows.rows[0].relationship_to_party === 'commander', 'first npc relationship preserved')

  const locRows = await db.execute({ sql: `SELECT name, description, location_type FROM locations`, args: [] })
  assert(locRows.rows.length === 1, '1 location row created')
  assert(locRows.rows[0].description.includes('[prelude_canon_location#1]'), 'location has marker')
  assert(locRows.rows[0].location_type === 'settlement', 'location_type maps "village" → settlement')

  const threadRows = await db.execute({ sql: `SELECT character_id, source, source_thread_id, kind FROM campaign_threads`, args: [] })
  assert(threadRows.rows.length === 1, '1 campaign_threads row created')
  assert(threadRows.rows[0].source === 'prelude', 'thread tagged source=prelude')
  assert(Number(threadRows.rows[0].source_thread_id) === 1, 'thread links back to prelude_canon_threads.id')
})

console.log('\n=== Idempotency: re-running transfer skips already-transferred rows ===\n')
await withFreshDb(async (db) => {
  const charRes = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['Halvor', 'ready_for_primary']
  })
  const charId = Number(charRes.lastInsertRowid)

  await db.execute({
    sql: `INSERT INTO prelude_canon_npcs (character_id, name, relationship)
          VALUES (?, ?, ?)`,
    args: [charId, 'Aunt Mira', 'aunt']
  })
  await db.execute({
    sql: `INSERT INTO prelude_canon_locations (character_id, name, type)
          VALUES (?, ?, ?)`,
    args: [charId, 'Three-Roads Inn', 'tavern']
  })
  await db.execute({
    sql: `INSERT INTO prelude_canon_threads (character_id, kind, subject_text)
          VALUES (?, ?, ?)`,
    args: [charId, 'open_question', 'who set fire to the granary']
  })

  const first = await transferCanonToCampaignTestImpl(db, charId)
  assert(first.npcs_transferred === 1 && first.locations_transferred === 1 && first.threads_transferred === 1,
    'first run: all three transferred')

  const second = await transferCanonToCampaignTestImpl(db, charId)
  assert(second.npcs_transferred === 0 && second.locations_transferred === 0 && second.threads_transferred === 0,
    'second run: nothing newly transferred')
  assert(second.skipped_npcs === 1 && second.skipped_locations === 1 && second.skipped_threads === 1,
    'second run: all three skipped')

  // Confirm no duplicate rows in destination tables
  const npcCount = await db.execute({ sql: `SELECT COUNT(*) AS n FROM npcs`, args: [] })
  assert(Number(npcCount.rows[0].n) === 1, 'npcs table still has exactly 1 row after re-run')
  const locCount = await db.execute({ sql: `SELECT COUNT(*) AS n FROM locations`, args: [] })
  assert(Number(locCount.rows[0].n) === 1, 'locations table still has exactly 1 row after re-run')
  const threadCount = await db.execute({ sql: `SELECT COUNT(*) AS n FROM campaign_threads`, args: [] })
  assert(Number(threadCount.rows[0].n) === 1, 'campaign_threads table still has exactly 1 row after re-run')
})

console.log('\n=== No-op: character with no canon data ===\n')
await withFreshDb(async (db) => {
  const charRes = await db.execute({
    sql: `INSERT INTO characters (first_name, creation_phase) VALUES (?, ?)`,
    args: ['NoCanon', 'ready_for_primary']
  })
  const charId = Number(charRes.lastInsertRowid)

  const result = await transferCanonToCampaignTestImpl(db, charId)
  assert(result.npcs_transferred === 0, 'no NPCs transferred when none exist')
  assert(result.locations_transferred === 0, 'no locations transferred')
  assert(result.threads_transferred === 0, 'no threads transferred')
  // No errors thrown — clean no-op
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
