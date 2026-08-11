/**
 * The migration directory must be able to build the schema the code queries.
 *
 * This exists because it failed to, silently, for months. Seven migrations
 * (054-060) were applied directly to the live Turso database from a working
 * tree that was never committed — not to any branch, not to any dangling
 * commit, not anywhere on disk. The live database therefore had columns that
 * `server/migrations/` could not produce.
 *
 * Nothing caught it, because nothing ever asserted the two halves agree.
 * Production kept working (it had the columns); every freshly built database
 * was quietly broken. `dmSessionService` SELECTs `npcs.distinguishing_features`
 * on the NPC enrichment path, so a new dev environment or any test touching
 * that path died on `SQLITE_ERROR: no such column` — a failure that looks like
 * a code bug and is actually a schema-provenance bug.
 *
 * Two independent guards below:
 *
 *  1. FILE HYGIENE — numbering is strictly sequential with no duplicate
 *     prefixes. The same incident produced two different "054"s (one live,
 *     one local), which the by-NAME migration ledger tolerated but which makes
 *     the timeline unreadable to a human and makes "apply in order" ambiguous.
 *
 *  2. SCHEMA CONTRACT — a database built ONLY from server/migrations/ contains
 *     the tables, columns and indexes the services actually depend on. This is
 *     the check that would have caught the original divergence on day one.
 *
 * Deliberately builds its own throwaway database rather than reusing the
 * shared test DB: the whole point is to exercise the migration chain from
 * empty, which is exactly what the shared DB has already had done to it.
 */

import { createClient } from '@libsql/client'
import { runMigrations } from '../server/migrationRunner.js'
import { readdirSync, rmSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'migrations')

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

/**
 * Columns that live code SELECTs by name. Each entry is a real query site —
 * if you remove one, cite the code that stopped reading it.
 */
const REQUIRED_COLUMNS = [
  // dmSessionService.js NPC enrichment + npcRelationshipService.js context.
  ['npcs', 'distinguishing_features'],
  // Step 7 of the creator (Identity Details) writes this on characters.
  ['characters', 'distinguishing_features'],
  // Creator level-1 picks.
  ['characters', 'fighting_style'],
  ['characters', 'expertise'],
  ['characters', 'creator_draft'],
  // Variable-canon-fact support.
  ['canon_facts', 'field'],
  // Phase 3.1 — authoritative HP and player death saves.
  ['characters', 'death_save_successes'],
  ['characters', 'death_save_failures'],
  ['characters', 'is_unconscious'],
  ['characters', 'is_dead'],
  // Phase 4 — campaign acts. resolveCurrentAct reads this.
  ['campaigns', 'current_act_index'],
  // Phase 4 — the campaign_id that gates the whole world simulation.
  ['characters', 'campaign_id'],
]

const REQUIRED_TABLES = [
  'campaign_chronicle_rollups', // Phase 4 rollup target
  'ai_call_log',
  'campaigns',
  'characters',
  'npcs',
  'canon_facts',
]

async function runTests() {
  console.log('\n=== Migration file hygiene ===\n')

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{3}_.*\.js$/.test(f))
    .sort()

  assert(files.length > 0, `found ${files.length} migration files`)

  // No two migrations may share a numeric prefix.
  const byPrefix = new Map()
  for (const f of files) {
    const prefix = f.slice(0, 3)
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
    byPrefix.get(prefix).push(f)
  }
  const dupes = [...byPrefix.entries()].filter(([, v]) => v.length > 1)
  assert(
    dupes.length === 0,
    dupes.length
      ? `duplicate migration numbers: ${dupes.map(([k, v]) => `${k} -> ${v.join(' & ')}`).join('; ')}`
      : 'no duplicate migration numbers'
  )

  // Strictly sequential from 001, no gaps.
  const nums = files.map((f) => Number(f.slice(0, 3)))
  const gaps = []
  for (let i = 1; i <= Math.max(...nums); i++) {
    if (!nums.includes(i)) gaps.push(String(i).padStart(3, '0'))
  }
  assert(gaps.length === 0, gaps.length ? `sequence gaps at ${gaps.join(',')}` : 'migration numbering is gapless from 001')

  console.log('\n=== Fresh build from server/migrations/ only ===\n')

  const dir = mkdtempSync(join(tmpdir(), 'schema-contract-'))
  const dbPath = join(dir, 'contract.db')
  const db = createClient({ url: `file:${dbPath}` })

  let built = false
  try {
    await runMigrations(db)
    built = true
  } catch (err) {
    console.log(`  migration chain threw: ${err.message}`)
  }
  assert(built, 'migration chain builds an empty database without error')

  if (built) {
    const tables = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    )
    const tableSet = new Set(tables.rows.map((r) => r.name))

    for (const t of REQUIRED_TABLES) {
      assert(tableSet.has(t), `table exists: ${t}`)
    }

    for (const [table, column] of REQUIRED_COLUMNS) {
      let has = false
      if (tableSet.has(table)) {
        const info = await db.execute(`PRAGMA table_info(${table})`)
        has = info.rows.some((r) => r.name === column)
      }
      assert(has, `column exists: ${table}.${column}`)
    }

    // The partial unique index that enforces one active row per variable fact.
    const idx = await db.execute(
      "SELECT name FROM sqlite_master WHERE type='index' AND name='uq_canon_facts_variable'"
    )
    assert(idx.rows.length === 1, 'index exists: uq_canon_facts_variable')

    // The actual query that used to blow up, run for real.
    let npcQueryOk = false
    try {
      await db.execute(
        'SELECT id, voice, personality_trait_1, mannerism, motivation, distinguishing_features, enrichment_level FROM npcs WHERE name = ?',
        ['nobody']
      )
      npcQueryOk = true
    } catch (err) {
      console.log(`  npc enrichment query threw: ${err.message}`)
    }
    assert(npcQueryOk, "dmSessionService's NPC enrichment SELECT runs against a fresh schema")
  }

  db.close?.()
  rmSync(dir, { recursive: true, force: true })

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

runTests().catch((err) => {
  console.error('Test harness failure:', err)
  process.exit(1)
})
