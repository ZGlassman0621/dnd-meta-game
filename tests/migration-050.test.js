/**
 * Migration 050 — physical_build column on characters.
 *
 * Sub-checkpoint 5.L.5. Pure-DDL test against an in-memory libsql
 * client. Verifies clean apply, idempotent re-apply, column accepts
 * NULL on existing rows.
 */

import { createClient } from '@libsql/client'
import { up, down } from '../server/migrations/050_physical_build_column.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

async function withFreshDb(fn) {
  const db = createClient({ url: ':memory:' })
  await db.execute(`
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT
    )
  `)
  try {
    await fn(db)
  } finally {
    db.close()
  }
}

console.log('\n=== Migration 050: clean apply adds physical_build column ===\n')
await withFreshDb(async (db) => {
  await up(db)
  const cols = await db.execute(`PRAGMA table_info(characters)`)
  const hasColumn = cols.rows.some(c => c.name === 'physical_build')
  assert(hasColumn, 'physical_build column added')
})

console.log('\n=== Migration 050: idempotent re-apply ===\n')
await withFreshDb(async (db) => {
  await up(db)
  let threw = false
  try { await up(db) } catch (e) { threw = true }
  assert(!threw, 'second up() does not throw (PRAGMA check guard)')
})

console.log('\n=== Migration 050: existing rows get NULL ===\n')
await withFreshDb(async (db) => {
  await db.execute({
    sql: `INSERT INTO characters (name) VALUES (?)`,
    args: ['Pre-existing character']
  })
  await up(db)
  const row = await db.execute(`SELECT name, physical_build FROM characters LIMIT 1`)
  assert(row.rows[0].name === 'Pre-existing character', 'existing row preserved')
  assert(row.rows[0].physical_build === null, 'physical_build is NULL on pre-existing row')
})

console.log('\n=== Migration 050: column accepts strings (slim, heavy, wiry, etc.) ===\n')
await withFreshDb(async (db) => {
  await up(db)
  await db.execute({
    sql: `INSERT INTO characters (name, physical_build) VALUES (?, ?)`,
    args: ['Wiry character', 'wiry']
  })
  const row = await db.execute(`SELECT physical_build FROM characters WHERE name = 'Wiry character'`)
  assert(row.rows[0].physical_build === 'wiry', 'physical_build accepts and persists string')
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
