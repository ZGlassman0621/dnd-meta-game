#!/usr/bin/env node
/**
 * sync-legacy-spell-files.js — repo-check-fixes-spells item 11.
 *
 * The legacy client spell files still feed live surfaces:
 *   client/src/data/spells.json      — early creator spell rows
 *                                      (Stage 1 / Stage 3, spellBlurb)
 *   client/src/data/spells/*.json    — quick reference, party builder,
 *                                      level-up, character sheet
 * They carried 2014 text that disagreed with the live catalog. This
 * script rewrites every spell object in them FROM the live catalog
 * (server/data/spellCatalogData.js) — the live catalog is the only
 * source of truth; never hand-edit these files. Each file keeps its own
 * shape, its own spell set, and its own fields; only values change:
 *   school, castingTime (live castTime), range, duration, description,
 *   components ("V, S, M"), ritual, classes (lowercase), damage/healing
 *   (from the engine's EFFECTS table; dropped when the live catalog has
 *   no dice for the spell). A spell the live catalog no longer has (a
 *   2014-only name) is removed. Apostrophe-only name drift (Tensers →
 *   Tenser's) takes the live name.
 *
 * Run from the repo root after the catalog changes:
 *   node scripts/sync-legacy-spell-files.js
 * Deterministic: re-running on synced files changes nothing.
 * tests/spell-catalog-2024-fixes.test.js pins the files against the
 * live catalog with the same derivation (exported below).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA = path.join(ROOT, 'client', 'src', 'data')

export function legacyFiles() {
  const dir = path.join(DATA, 'spells')
  return [
    path.join(DATA, 'spells.json'),
    ...fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => path.join(dir, f))
  ]
}

const squash = (s) => String(s || '').toLowerCase().replace(/[’']/g, '').trim()

export function liveIndex(entries) {
  const exact = new Map()
  const loose = new Map()
  for (const [key, entry] of Object.entries(entries)) {
    exact.set(key, key)
    loose.set(squash(key), key)
  }
  return { exact, loose }
}

function titleCase(key) {
  return key.split(' ').map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ')
}

export function damageText(fx) {
  if (!fx || fx.condition || !fx.damage) return null
  if (Array.isArray(fx.damageParts) && fx.damageParts.length) {
    return fx.damageParts.map(p => `${p.damage} ${p.damageType}`).join(' + ')
  }
  const type = fx.damageType ? ` ${fx.damageType}` : ''
  return `${fx.damage}${fx.addCastingMod ? ' + spellcasting modifier' : ''}${type}`
}

export function healingText(fx) {
  if (!fx || fx.condition || !fx.healing) return null
  if (fx.healing === 'full') return 'all hit points'
  return `${fx.healing}${fx.addCastingMod ? ' + spellcasting modifier' : ''}`
}

/** The synced object for one legacy spell object, or null (remove). */
export function syncedSpell(legacy, entries, effects, index) {
  const lower = String(legacy.name || '').toLowerCase().trim()
  const key = index.exact.get(lower) || index.loose.get(squash(lower))
  if (!key) return null
  const e = entries[key]
  const fx = effects[key]
  const out = {}
  for (const field of Object.keys(legacy)) {
    switch (field) {
      case 'name': out.name = index.exact.has(lower) ? legacy.name : titleCase(key); break
      case 'school': out.school = e.school; break
      case 'castingTime': out.castingTime = e.castTime; break
      case 'range': out.range = e.range; break
      case 'duration': out.duration = e.duration; break
      case 'components': out.components = e.components.join(', '); break
      case 'ritual': out.ritual = !!e.ritual; break
      case 'classes': out.classes = e.classes.map(c => c.toLowerCase()); break
      case 'description': out.description = e.description; break
      case 'damage': { const t = damageText(fx); if (t) out.damage = t; break }
      case 'healing': { const t = healingText(fx); if (t) out.healing = t; break }
      default: out[field] = legacy[field]
    }
  }
  // A ritual spell whose legacy row lacked the flag gains it.
  if (!('ritual' in legacy) && e.ritual && ('components' in legacy || 'classes' in legacy)) {
    const desc = out.description
    delete out.description
    out.ritual = true
    out.description = desc
  }
  return out
}

// The files' own one-object-per-line style: `{ "k": v, "k2": [ "a", "b" ] }`.
export function formatSpellLine(obj) {
  const val = (v) => Array.isArray(v) ? `[${v.map(x => JSON.stringify(x)).join(', ')}]` : JSON.stringify(v)
  return `{ ${Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${val(v)}`).join(', ')} }`
}

const LINE_RE = /^(\s*)(\{ "name".*\})(,?)\s*$/

/** Rewrite one file's text. Returns { text, removed, renamed, changed }. */
export function syncFileText(text, entries, effects) {
  const index = liveIndex(entries)
  const lines = text.split('\n')
  const out = []
  const removed = []
  const renamed = []
  let changed = 0
  for (const line of lines) {
    const m = LINE_RE.exec(line)
    if (!m) { out.push(line); continue }
    const legacy = JSON.parse(m[2])
    const synced = syncedSpell(legacy, entries, effects, index)
    if (!synced) { removed.push(legacy.name); continue }
    if (synced.name !== legacy.name) renamed.push(`${legacy.name} → ${synced.name}`)
    const next = `${m[1]}${formatSpellLine(synced)}${m[3]}`
    if (next !== line) changed++
    out.push(next)
  }
  // A removed last element leaves a dangling comma before `]`.
  let joined = out.join('\n').replace(/,(\s*\n\s*\])/g, '$1')
  return { text: joined, removed, renamed, changed }
}

async function main() {
  const { SPELL_DATA_ENTRIES, SPELL_DATA_EFFECTS } = await import(
    pathToFileURL(path.join(ROOT, 'server', 'data', 'spellCatalogData.js')).href)
  for (const file of legacyFiles()) {
    const before = fs.readFileSync(file, 'utf8')
    const res = syncFileText(before, SPELL_DATA_ENTRIES, SPELL_DATA_EFFECTS)
    JSON.parse(res.text) // must stay valid JSON
    if (res.text !== before) fs.writeFileSync(file, res.text)
    console.log(`${path.relative(ROOT, file)}: ${res.changed} rewritten` +
      (res.removed.length ? `, removed ${res.removed.join('; ')}` : '') +
      (res.renamed.length ? `, renamed ${res.renamed.join('; ')}` : ''))
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
