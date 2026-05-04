/**
 * Phase 2 close-out: prelude draft endpoints + finalize behavior.
 *
 * Covers v1.0.138 (draft create/update/read + finalize-recycles-row +
 * appearance field persistence) and v1.0.139 (BigInt → Number coercion).
 *
 * Tests run against in-memory libsql with the service's SQL replicated
 * inline (canon-transfer.test.js pattern). Verifies behavior contracts:
 *   - Draft create returns Number id (not BigInt) — v1.0.139 regression
 *   - Draft update preserves the row + refreshes displayable fields
 *   - getDraftPreludeState returns parsed state for prelude_setup rows
 *     and null for any other phase
 *   - createPreludeCharacter with `draft_character_id` recycles the row
 *     (same id, phase flips prelude_setup → prelude)
 *   - createPreludeCharacter without `draft_character_id` creates new
 *     (back-compat with the legacy one-page wizard's submit path)
 *   - Appearance fields (eye/hair/skin/build) land on character row at
 *     finalize from payload.appearance
 */

import { createClient } from '@libsql/client'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

async function withFreshDb(fn) {
  const db = createClient({ url: ':memory:' })
  await db.execute(`PRAGMA foreign_keys = ON`)
  // Minimal characters schema — enough columns to exercise prelude-setup
  // draft persistence + finalize. Cumulative real schema is migrations
  // 001-050; for these tests we need creation_phase + name fields +
  // race + the four appearance columns + prelude_setup_data.
  await db.execute(`
    CREATE TABLE characters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      first_name TEXT,
      last_name TEXT,
      nickname TEXT,
      gender TEXT,
      class TEXT,
      race TEXT,
      subrace TEXT,
      level INTEGER DEFAULT 0,
      current_hp INTEGER DEFAULT 0,
      max_hp INTEGER DEFAULT 0,
      current_location TEXT,
      current_quest TEXT,
      experience_to_next_level INTEGER DEFAULT 0,
      armor_class INTEGER DEFAULT 10,
      speed INTEGER DEFAULT 30,
      ability_scores TEXT,
      age TEXT,
      eye_color TEXT,
      hair_color TEXT,
      skin_color TEXT,
      physical_build TEXT,
      creation_phase TEXT DEFAULT 'active',
      prelude_age INTEGER,
      prelude_chapter INTEGER,
      prelude_setup_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
  try {
    await fn(db)
  } finally {
    db.close()
  }
}

// ---------------------------------------------------------------------------
// Service-logic re-implementations (mirror preludeService.js so the in-memory
// db client is wired in directly, matching the canon-transfer.test.js pattern).
// ---------------------------------------------------------------------------

async function createDraftImpl(db, state) {
  const composedName = [(state.first_name || '').trim(), (state.last_name || '').trim()]
    .filter(Boolean).join(' ') || '(unnamed)'
  const result = await db.execute({
    sql: `INSERT INTO characters (
            name, first_name, last_name, nickname, gender,
            class, race, subrace,
            level, current_hp, max_hp, current_location, current_quest,
            experience_to_next_level,
            armor_class, speed, ability_scores,
            creation_phase, prelude_setup_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      composedName,
      (state.first_name || '').trim() || null,
      (state.last_name || '').trim() || null,
      (state.nickname || '').trim() || null,
      state.gender || null,
      'prelude_setup',
      state.race || '',
      (state.subrace || '').trim() || null,
      0, 0, 0, '(setting up)', null,
      0, 10, 30,
      JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
      'prelude_setup',
      JSON.stringify(state)
    ]
  })
  // v1.0.139 contract: id is Number, not BigInt
  return { id: Number(result.lastInsertRowid) }
}

async function updateDraftImpl(db, characterId, state) {
  const row = (await db.execute({
    sql: 'SELECT id, creation_phase FROM characters WHERE id = ?',
    args: [characterId]
  })).rows[0]
  if (!row) throw new Error(`Draft character ${characterId} not found`)
  if (row.creation_phase !== 'prelude_setup') {
    throw new Error(`Character ${characterId} is not a prelude_setup draft (got ${row.creation_phase})`)
  }
  const composedName = [(state.first_name || '').trim(), (state.last_name || '').trim()]
    .filter(Boolean).join(' ') || '(unnamed)'
  await db.execute({
    sql: `UPDATE characters SET
            name = ?, first_name = ?, last_name = ?, nickname = ?, gender = ?,
            race = ?, subrace = ?, prelude_setup_data = ?
          WHERE id = ?`,
    args: [
      composedName,
      (state.first_name || '').trim() || null,
      (state.last_name || '').trim() || null,
      (state.nickname || '').trim() || null,
      state.gender || null,
      state.race || '',
      (state.subrace || '').trim() || null,
      JSON.stringify(state),
      characterId
    ]
  })
  return { id: Number(characterId) }
}

async function getDraftStateImpl(db, characterId) {
  const row = (await db.execute({
    sql: 'SELECT id, creation_phase, prelude_setup_data FROM characters WHERE id = ?',
    args: [characterId]
  })).rows[0]
  if (!row) return null
  if (row.creation_phase !== 'prelude_setup') return null
  let state = null
  try {
    state = row.prelude_setup_data ? JSON.parse(row.prelude_setup_data) : null
  } catch { state = null }
  return { id: row.id, state }
}

async function finalizeImpl(db, payload) {
  const fullName = [payload.first_name, payload.last_name].filter(Boolean).map(s => s.trim()).join(' ')
  const appearance = payload.appearance || {}
  const eyeColor = (appearance.eye_color || '').trim() || null
  const hairColor = (appearance.hair_color || '').trim() || null
  const skinColor = (appearance.skin_color || '').trim() || null
  const physicalBuild = (appearance.build || '').trim() || null
  const draftId = payload.draft_character_id ? Number(payload.draft_character_id) : null

  if (draftId) {
    const draftRow = (await db.execute({
      sql: 'SELECT id, creation_phase FROM characters WHERE id = ?',
      args: [draftId]
    })).rows[0]
    if (!draftRow) throw new Error(`Draft character ${draftId} not found`)
    if (draftRow.creation_phase !== 'prelude_setup') {
      throw new Error(`Draft character ${draftId} is not in prelude_setup phase (got ${draftRow.creation_phase})`)
    }
    await db.execute({
      sql: `UPDATE characters SET
              name = ?, first_name = ?, last_name = ?, nickname = ?, gender = ?,
              class = ?, race = ?, subrace = ?,
              level = ?, current_hp = ?, max_hp = ?, current_location = ?,
              eye_color = ?, hair_color = ?, skin_color = ?, physical_build = ?,
              creation_phase = ?, prelude_age = ?, prelude_chapter = ?, prelude_setup_data = ?
            WHERE id = ?`,
      args: [
        fullName,
        (payload.first_name || '').trim() || null,
        (payload.last_name || '').trim() || null,
        (payload.nickname || '').trim() || null,
        payload.gender,
        'prelude', payload.race, (payload.subrace || '').trim() || null,
        0, 4, 4, 'home',
        eyeColor, hairColor, skinColor, physicalBuild,
        'prelude', 6, 1, JSON.stringify(payload),
        draftId
      ]
    })
    return draftId
  }

  // No draft — fresh insert
  const result = await db.execute({
    sql: `INSERT INTO characters (
            name, first_name, last_name, gender, class, race, subrace,
            level, current_hp, max_hp, current_location,
            eye_color, hair_color, skin_color, physical_build,
            creation_phase, prelude_age, prelude_chapter, prelude_setup_data
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      fullName,
      (payload.first_name || '').trim() || null,
      (payload.last_name || '').trim() || null,
      payload.gender,
      'prelude', payload.race, (payload.subrace || '').trim() || null,
      0, 4, 4, 'home',
      eyeColor, hairColor, skinColor, physicalBuild,
      'prelude', 6, 1, JSON.stringify(payload)
    ]
  })
  return Number(result.lastInsertRowid)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

console.log('\n=== Draft create: returns Number id (v1.0.139 BigInt regression) ===\n')
await withFreshDb(async (db) => {
  const result = await createDraftImpl(db, { first_name: 'Aelar', gender: 'Female' })
  assert(typeof result.id === 'number', `id is Number type (got ${typeof result.id})`)
  assert(Number.isFinite(result.id), 'id is a finite number')
  assert(result.id > 0, 'id is positive')
})

console.log('\n=== Draft create: persists row at creation_phase=prelude_setup ===\n')
await withFreshDb(async (db) => {
  const { id } = await createDraftImpl(db, { first_name: 'Aelar', last_name: 'Stoneheart', gender: 'Male', race: 'dwarf' })
  const row = (await db.execute({
    sql: 'SELECT name, creation_phase, race, prelude_setup_data FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.creation_phase === 'prelude_setup', 'creation_phase=prelude_setup')
  assert(row.name === 'Aelar Stoneheart', 'composed name persisted')
  assert(row.race === 'dwarf', 'race persisted')
  const stored = JSON.parse(row.prelude_setup_data)
  assert(stored.first_name === 'Aelar', 'state.first_name in prelude_setup_data')
  assert(stored.gender === 'Male', 'state.gender in prelude_setup_data')
})

console.log('\n=== Draft create: composed name falls back to (unnamed) when both name fields blank ===\n')
await withFreshDb(async (db) => {
  const { id } = await createDraftImpl(db, { gender: 'Female' })
  const row = (await db.execute({
    sql: 'SELECT name FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.name === '(unnamed)', 'name falls back to (unnamed)')
})

console.log('\n=== Draft update: preserves id, refreshes name + race + state ===\n')
await withFreshDb(async (db) => {
  const { id } = await createDraftImpl(db, { first_name: 'Old', gender: 'Female' })
  const updateResult = await updateDraftImpl(db, id, {
    first_name: 'New', last_name: 'Name', gender: 'Female', race: 'human', subrace: ''
  })
  assert(updateResult.id === id, 'update returns same id')
  assert(typeof updateResult.id === 'number', 'update id is Number')
  const row = (await db.execute({
    sql: 'SELECT name, race, prelude_setup_data FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.name === 'New Name', 'composed name refreshed')
  assert(row.race === 'human', 'race refreshed')
  const stored = JSON.parse(row.prelude_setup_data)
  assert(stored.first_name === 'New', 'state refreshed in prelude_setup_data')
})

console.log('\n=== Draft update: refuses non-prelude_setup rows ===\n')
await withFreshDb(async (db) => {
  // Create an active character (not a draft)
  await db.execute({
    sql: `INSERT INTO characters (name, class, level, current_hp, max_hp, current_location, experience_to_next_level, creation_phase)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['Active Char', 'fighter', 3, 25, 25, 'town', 900, 'active']
  })
  const id = (await db.execute(`SELECT id FROM characters WHERE name='Active Char'`)).rows[0].id
  let threw = false
  try {
    await updateDraftImpl(db, id, { first_name: 'X' })
  } catch (e) {
    threw = e.message.includes('not a prelude_setup')
  }
  assert(threw, 'throws when called against an active row')
})

console.log('\n=== getDraftState: returns null for non-existent / wrong phase ===\n')
await withFreshDb(async (db) => {
  const missing = await getDraftStateImpl(db, 9999)
  assert(missing === null, 'returns null for non-existent id')
  // Active character — wrong phase
  await db.execute({
    sql: `INSERT INTO characters (name, class, level, current_hp, max_hp, current_location, experience_to_next_level, creation_phase)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['Active', 'fighter', 1, 10, 10, 'town', 0, 'active']
  })
  const id = (await db.execute(`SELECT id FROM characters WHERE name='Active'`)).rows[0].id
  const wrongPhase = await getDraftStateImpl(db, id)
  assert(wrongPhase === null, 'returns null for non-prelude_setup phase')
})

console.log('\n=== getDraftState: returns parsed state for prelude_setup rows ===\n')
await withFreshDb(async (db) => {
  const inputState = {
    first_name: 'Lyra', last_name: 'Brightwind', gender: 'Female',
    race: 'half-elf', subrace: '', appearance: { eye_color: 'Hazel' }
  }
  const { id } = await createDraftImpl(db, inputState)
  const result = await getDraftStateImpl(db, id)
  assert(result !== null, 'returns non-null for prelude_setup row')
  assert(result.id === id, 'echoes the id')
  assert(result.state.first_name === 'Lyra', 'state.first_name round-trips')
  assert(result.state.appearance?.eye_color === 'Hazel', 'nested appearance round-trips')
})

console.log('\n=== Finalize WITH draft_character_id: recycles row, flips phase prelude_setup → prelude ===\n')
await withFreshDb(async (db) => {
  // Create draft
  const draftState = { first_name: 'Riv', gender: 'Female', race: 'human' }
  const { id: draftId } = await createDraftImpl(db, draftState)
  // Finalize with that id
  const finalId = await finalizeImpl(db, {
    first_name: 'Riv', last_name: 'Freeborn', gender: 'Female',
    race: 'human', subrace: null,
    parents: [], siblings: 'only_child', authority_figure: 'mentor',
    appearance: {},
    draft_character_id: draftId
  })
  assert(finalId === draftId, 'finalize returns the same id (row recycled, not new insert)')
  const row = (await db.execute({
    sql: 'SELECT id, creation_phase, name, race FROM characters WHERE id = ?',
    args: [draftId]
  })).rows[0]
  assert(row.creation_phase === 'prelude', 'phase flipped prelude_setup → prelude')
  assert(row.name === 'Riv Freeborn', 'name updated to final composed value')
  assert(row.race === 'human', 'race preserved')
  // Verify no second row was created
  const allRows = await db.execute(`SELECT COUNT(*) as n FROM characters`)
  assert(Number(allRows.rows[0].n) === 1, 'only one character row exists (no orphan)')
})

console.log('\n=== Finalize WITH draft_character_id: refuses non-draft rows ===\n')
await withFreshDb(async (db) => {
  // Create an active character
  await db.execute({
    sql: `INSERT INTO characters (name, class, level, current_hp, max_hp, current_location, experience_to_next_level, creation_phase)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: ['Existing', 'fighter', 5, 40, 40, 'castle', 6500, 'active']
  })
  const id = (await db.execute(`SELECT id FROM characters WHERE name='Existing'`)).rows[0].id
  let threw = false
  try {
    await finalizeImpl(db, {
      first_name: 'X', gender: 'Male', race: 'human',
      parents: [], siblings: 'only_child', authority_figure: 'mentor',
      appearance: {},
      draft_character_id: id
    })
  } catch (e) {
    threw = e.message.includes('not in prelude_setup phase')
  }
  assert(threw, 'finalize throws when draft_character_id points at a non-draft row')
})

console.log('\n=== Finalize WITHOUT draft_character_id: creates fresh row (legacy wizard back-compat) ===\n')
await withFreshDb(async (db) => {
  const id = await finalizeImpl(db, {
    first_name: 'Vass', last_name: 'Hollowtree', gender: 'Female',
    race: 'human', subrace: null,
    parents: [], siblings: 'only_child', authority_figure: 'mentor',
    appearance: {}
    // no draft_character_id — legacy path
  })
  assert(typeof id === 'number', 'fresh insert returns Number id')
  const row = (await db.execute({
    sql: 'SELECT id, creation_phase, name FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.creation_phase === 'prelude', 'fresh row at creation_phase=prelude')
  assert(row.name === 'Vass Hollowtree', 'name composed correctly')
})

console.log('\n=== Finalize: appearance fields persist (eye / hair / skin / build) ===\n')
await withFreshDb(async (db) => {
  const id = await finalizeImpl(db, {
    first_name: 'Halrik', gender: 'Male', race: 'dwarf', subrace: null,
    parents: [], siblings: 'only_child', authority_figure: 'mentor',
    appearance: {
      eye_color: 'Amber', hair_color: 'Iron Gray',
      skin_color: 'Ruddy Tan', build: 'Compact'
    }
  })
  const row = (await db.execute({
    sql: 'SELECT eye_color, hair_color, skin_color, physical_build FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.eye_color === 'Amber', 'eye_color persisted')
  assert(row.hair_color === 'Iron Gray', 'hair_color persisted')
  assert(row.skin_color === 'Ruddy Tan', 'skin_color persisted')
  // appearance.build maps to physical_build column (migration 050 col name)
  assert(row.physical_build === 'Compact', 'appearance.build → physical_build column')
})

console.log('\n=== Finalize: appearance fields default to NULL when not provided ===\n')
await withFreshDb(async (db) => {
  const id = await finalizeImpl(db, {
    first_name: 'NoLooks', gender: 'Female', race: 'human', subrace: null,
    parents: [], siblings: 'only_child', authority_figure: 'mentor',
    appearance: {}  // empty
  })
  const row = (await db.execute({
    sql: 'SELECT eye_color, hair_color, skin_color, physical_build FROM characters WHERE id = ?',
    args: [id]
  })).rows[0]
  assert(row.eye_color === null, 'eye_color null when not set')
  assert(row.hair_color === null, 'hair_color null when not set')
  assert(row.skin_color === null, 'skin_color null when not set')
  assert(row.physical_build === null, 'physical_build null when not set')
})

console.log('\n=== Finalize: full save→resume→submit cycle preserves character id ===\n')
await withFreshDb(async (db) => {
  // Step 1 advance — create draft
  const { id: draftId } = await createDraftImpl(db, {
    first_name: 'Wizard', gender: 'Female'
  })
  // Step 2 advance — update draft
  await updateDraftImpl(db, draftId, {
    first_name: 'Wizard', gender: 'Female', race: 'elf', subrace: 'High Elf'
  })
  // Resume from home — load draft
  const resumed = await getDraftStateImpl(db, draftId)
  assert(resumed.id === draftId, 'resumed id matches draft id')
  assert(resumed.state.race === 'elf', 'resumed state has updated race')
  // Step 6 submit — finalize via recycle
  const finalId = await finalizeImpl(db, {
    first_name: 'Wizard', last_name: 'Lily', gender: 'Female',
    race: 'elf', subrace: 'High Elf',
    parents: [], siblings: 'only_child', authority_figure: 'mentor',
    appearance: { eye_color: 'Violet' },
    draft_character_id: draftId
  })
  assert(finalId === draftId, 'final id matches draft id (recycled, not new)')
  // Verify only one row total
  const allRows = await db.execute(`SELECT COUNT(*) as n, MAX(id) as max_id FROM characters`)
  assert(Number(allRows.rows[0].n) === 1, 'still only one row')
  assert(Number(allRows.rows[0].max_id) === draftId, 'max id is the original draft id')
})

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
