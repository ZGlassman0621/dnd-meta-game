#!/usr/bin/env node
/**
 * generate-spell-catalog.js — build-time spell dataset for the creator
 * (item 23). Generates client/src/data/spellCatalog.generated.json from
 * the server catalog (server/data/spellCatalogData.js) plus the level-1
 * counts/rules computed by the server's own progression functions
 * (server/config/levelProgression.js) — the generated file carries the
 * SAME numbers the endpoint serves, so the offline fallback and the
 * server can never disagree by transcription.
 *
 * Run from the repo root whenever the catalog or the progression rules
 * change:
 *   node scripts/generate-spell-catalog.js
 *
 * Deterministic by construction: spell keys sort in code-unit order,
 * each entry's fields follow FIELD_ORDER, level1ByClass keys sort
 * alphabetically, and the file carries no timestamp — regenerating an
 * unchanged catalog produces byte-identical output, so the test that
 * pins the generated file against the catalog never flakes on dates.
 *
 * The dataset is the PRIMARY offline source for Stage 4's spell
 * picker when GET /api/spells is unreachable. It is NOT a hand-
 * authored list: every spell comes from SPELL_DATA_ENTRIES, and every
 * count/rule comes from getSpellsKnown / getSpellsPrepared /
 * getCantripsKnown / getSpellSlots / spellcastingAbilityFor at level 1.
 * EFFECTS (the spell engine's damage dice) are deliberately NOT
 * included — the picker never resolves effects.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPELL_DATA_ENTRIES } from '../server/data/spellCatalogData.js'
import {
  getCantripsKnown,
  getSpellSlots,
  getSpellsKnown,
  getSpellsPrepared,
  spellcastingAbilityFor
} from '../server/config/levelProgression.js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = path.join(ROOT, 'client', 'src', 'data', 'spellCatalog.generated.json')
const CLASSES_PATH = path.join(ROOT, 'client', 'src', 'data', 'classes.json')

// Field order inside each spell entry — fixed, so regeneration is stable.
const FIELD_ORDER = [
  'level', 'school', 'castTime', 'range', 'components', 'duration',
  'concentration', 'ritual', 'save', 'appliesCondition', 'classes',
  'source', 'description'
]

// Same title-casing as the endpoint (server/routes/spells.js).
function titleCaseSpellKey(key) {
  return String(key || '')
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ')
}

// Prepared-count rule for one class at level 1, detected by evaluating
// the server's own getSpellsPrepared across ability mods -1..5:
//   none            — not a prepared caster (server returns null)
//   zero            — prepared caster with no 1st-level slots (blackguard:
//                     0 at level 1). Paladin used to be here too — the 2024
//                     PHB gives it two 1st-level slots and a prepared
//                     count of 2 at L1, so it now evaluates to 'table'.
//   modPlusLevel    — max(1, mod + level) at level 1 (cleric, druid, wizard)
//   modPlusHalfLevel— max(1, mod + half level) at level 1 (artificer)
//   table           — fallback: the evaluated numbers, if no formula fits
// byMod carries the exact evaluated numbers either way, so the client
// never re-derives a formula it could get wrong.
const PROBE_MODS = [-1, 0, 1, 2, 3, 4, 5]
function preparedRuleFor(classId) {
  const byMod = {}
  let anyNumber = false
  for (const mod of PROBE_MODS) {
    const value = getSpellsPrepared(classId, 1, mod)
    byMod[String(mod)] = value
    if (typeof value === 'number') anyNumber = true
  }
  if (!anyNumber) return { kind: 'none', byMod }
  if (Object.values(byMod).every(v => v === 0)) return { kind: 'zero', byMod }
  const fits = (fn) => PROBE_MODS.every(mod => byMod[String(mod)] === fn(mod))
  if (fits(mod => Math.max(1, mod + 1))) return { kind: 'modPlusLevel', byMod }
  if (fits(mod => Math.max(1, mod + Math.floor(1 / 2)))) return { kind: 'modPlusHalfLevel', byMod }
  return { kind: 'table', byMod }
}

function main() {
  const classesRaw = JSON.parse(fs.readFileSync(CLASSES_PATH, 'utf8'))
  const classIds = (Array.isArray(classesRaw)
    ? classesRaw.map(c => c.id)
    : Object.keys(classesRaw)).filter(Boolean).sort()

  const spells = Object.keys(SPELL_DATA_ENTRIES).sort().map(key => {
    const entry = SPELL_DATA_ENTRIES[key]
    const out = { key, name: titleCaseSpellKey(key) }
    for (const field of FIELD_ORDER) {
      if (entry[field] !== undefined) out[field] = entry[field]
    }
    return out
  })

  const level1ByClass = {}
  for (const classId of classIds) {
    level1ByClass[classId] = {
      spellsKnown: getSpellsKnown(classId, 1),
      spellsPrepared: preparedRuleFor(classId),
      cantripsKnown: getCantripsKnown(classId, 1),
      spellcastingAbility: spellcastingAbilityFor(classId, null),
      spellSlots: getSpellSlots(classId, 1)
    }
  }

  const dataset = {
    generator: 'scripts/generate-spell-catalog.js',
    source: 'server/data/spellCatalogData.js + server/config/levelProgression.js (level 1)',
    spellCount: spells.length,
    spells,
    level1ByClass
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(dataset, null, 2) + '\n')
  console.log(`wrote ${path.relative(ROOT, OUT_PATH)} (${spells.length} spells, ${classIds.length} classes)`)
  for (const classId of classIds) {
    const info = level1ByClass[classId]
    console.log(`  ${classId}: known=${info.spellsKnown} prepared=${info.spellsPrepared.kind} cantrips=${info.cantripsKnown} ability=${info.spellcastingAbility}`)
  }
}

main()
