// spellbookHelpers.js — client-side wizard spellbook helpers (2026-11-07).
//
// The numbers here mirror server/services/spellbookService.js exactly:
// the book starts with 6 spells and grows by 2 per wizard level;
// copying costs 50 gp + 2 hours per spell level; replacing the book
// (or copying into a backup) costs 10 gp + 1 hour per spell level,
// plus the blank book itself — the price of the materials picked
// from the fixed table (SPELLBOOK_MATERIALS), charged once per book;
// Spell Mastery opens at wizard level 18 and Signature Spells at
// 20, up to 2 picks each.
// The client never invents its own copy of these rules —
// tests/spellbook-client-sheet.test.js pins every constant and
// formula below against the real server module, so a drift fails
// loudly instead of silently mispricing a copy or mis-sizing a book.
//
// Everything here is pure (no fetch, no React): the sheet and the
// creator import these, and the tests call them directly.

/** Book size: 6 at L1, +2 per wizard level after 1st. */
export const SPELLBOOK_START_SIZE = 6
export const SPELLBOOK_SPELLS_PER_LEVEL = 2

/** Copying: 2 hours + 50 gp per spell level. */
export const COPY_GOLD_PER_SPELL_LEVEL = 50
export const COPY_HOURS_PER_SPELL_LEVEL = 2

/** Spell Mastery (L18) / Signature Spells (L20): up to 2 picks each. */
export const SPELL_MASTERY_LEVEL = 18
export const SIGNATURE_SPELLS_LEVEL = 20
export const SPELL_MASTERY_MAX = 2
export const SIGNATURE_SPELLS_MAX = 2

/** Wizard levels that open a NEW spell-slot level (full-caster table). */
export const NEW_SLOT_LEVELS = [3, 5, 7, 9, 11, 13, 15, 17]

/** Expected book size for a wizard of this level (6 + 2 × (level − 1)). */
export function spellbookSizeForLevel(level) {
  const l = Number(level)
  if (!Number.isFinite(l)) return SPELLBOOK_START_SIZE
  const clamped = Math.min(20, Math.max(1, Math.trunc(l)))
  return SPELLBOOK_START_SIZE + SPELLBOOK_SPELLS_PER_LEVEL * (clamped - 1)
}

/** Copy cost for a spell of this level, or null for a cantrip / bad level. */
export function copyCostForSpellLevel(spellLevel) {
  const l = Number(spellLevel)
  if (!Number.isFinite(l) || l < 1) return null
  return { gold: COPY_GOLD_PER_SPELL_LEVEL * l, hours: COPY_HOURS_PER_SPELL_LEVEL * l }
}

/**
 * Replacing / backing up: 1 hour + 10 gp per spell level (2024 PHB
 * pp. 165–166, "EXPANDING AND REPLACING A SPELLBOOK" — "Copying the
 * Book": copy a spell from your book into another book, and
 * transcribe the PREPARED spells into a new book when yours is
 * lost). A DIFFERENT rate from copying a new spell in (2h + 50 gp
 * above); the two rates must never be conflated — replacement and
 * backup copy use REPLACE_*, new-spell copy uses COPY_*.
 */
export const REPLACE_GOLD_PER_SPELL_LEVEL = 10
export const REPLACE_HOURS_PER_SPELL_LEVEL = 1

/** A blank spellbook's price (V5, 2026-11-08): the standard 50 gp,
 * charged once per book, on the first transcription into a new
 * book (or the first copy into a new backup book). The client
 * mirrors the server's STANDARD_SPELLBOOK_COST_GP name exactly, so
 * a drift fails in the tests, not in a player's purse. Do NOT parse
 * the "50 gp" display string in server/data/gearItems.js. */
export const STANDARD_SPELLBOOK_COST_GP = 50

/** Blank-book materials (2026-11-08): a FIXED table — five tiers,
 * decided by Zach. The client sends only the KEY; the server
 * derives the price, so a book can never be mispriced by a typed
 * number. Mirrors server/services/spellbookService.js exactly
 * (same keys, labels, prices) — the tests cross-pin the whole
 * table. There is NO waived tier: the cheapest book is vellum at
 * 25 gp. `standard` (50 gp) stays the default when no key is
 * picked. */
export const SPELLBOOK_MATERIALS = {
  vellum:         { label: 'Vellum bound with twine', cost: 25 },
  standard:       { label: 'Standard spellbook',       cost: 50 },
  'fine-leather': { label: 'Fine leather-bound',       cost: 100 },
  'gilt-edged':   { label: 'Gilt-edged tome',          cost: 250 },
  dragonhide:     { label: 'Dragonhide-bound',         cost: 500 },
}

/** Price of a blank book from its materials key — the standard
 * 50 gp when no key (or an unknown key) is given, so a panel total
 * never goes NaN. */
export function spellbookMaterialCost(key) {
  const row = typeof key === 'string' ? SPELLBOOK_MATERIALS[key] : undefined
  return row ? row.cost : STANDARD_SPELLBOOK_COST_GP
}

/** Display label for stored materials: the table label for a known
 * key, the stored string verbatim otherwise (legacy free-text rows
 * already in the wild print exactly as stored). */
export function spellbookMaterialLabel(value) {
  if (typeof value !== 'string') return value
  const row = SPELLBOOK_MATERIALS[value]
  return row ? row.label : value
}

/** Replace/backup cost for a spell of this level, or null for a cantrip / bad level. */
export function replaceCostForSpellLevel(spellLevel) {
  const l = Number(spellLevel)
  if (!Number.isFinite(l) || l < 1) return null
  return { gold: REPLACE_GOLD_PER_SPELL_LEVEL * l, hours: REPLACE_HOURS_PER_SPELL_LEVEL * l }
}

/**
 * Batch replace cost: sum the replace rate over a list of spell
 * levels (the whole prepared list on a replacement, one spell on a
 * backup copy). Returns null when the list is not an array of
 * valid (≥1) levels.
 */
export function replaceCostForSpells(levels) {
  if (!Array.isArray(levels)) return null
  let gold = 0
  let hours = 0
  for (const level of levels) {
    const cost = replaceCostForSpellLevel(level)
    if (!cost) return null
    gold += cost.gold
    hours += cost.hours
  }
  return { gold, hours }
}

/**
 * Parse a spellbook_json value (string, object, null, garbage) into
 * { status: 'intact' | 'lost', mastery: [names], signature: [names] }
 * — plus `backup: [names]` only when a backup book exists,
 * `replaced: 'prepared' | 'backup'` only after a replacement, a
 * banked Arcane Recovery (`pendingArcaneRecovery: { slots: [...] }`)
 * only while one is banked, and `arcaneRecoveryUsed: true` only
 * while the once-per-long-rest recovery is used, and the blank
 * book's price + materials (`bookCost` gp, `bookMaterials` text)
 * only while a price has been charged for this book.
 * Anything unparseable is an intact empty book — the server is the
 * authority, and a corrupt client-side read must never invent a loss.
 */
export function parseSpellbookState(value) {
  const blank = { status: 'intact', mastery: [], signature: [] }
  let raw = value
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw || '{}')
    } catch {
      return blank
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank
  const cleanList = (v) => (Array.isArray(v)
    ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
    : [])
  const out = {
    status: raw.status === 'lost' ? 'lost' : 'intact',
    mastery: cleanList(raw.mastery),
    signature: cleanList(raw.signature),
  }
  // Banked Memorize Swap (rest consolidation, 2026-11-07): carried
  // only while a swap is banked, so the blank state keeps its exact
  // old shape and every serialize round-trip preserves a live bank.
  // Mirrors server/services/spellbookService.js exactly.
  const bank = parsePendingMemorizeSwap(raw.pendingMemorizeSwap)
  if (bank) out.pendingMemorizeSwap = bank
  // Backup spellbook + replacement marker (2026-11-07): same
  // present-only-when-set shape as the bank, so the blank state
  // keeps its exact old shape. `backup` is the contents of a second
  // book (cleaned like mastery/signature); `replaced` is 'prepared'
  // (re-transcribed from the prepared list) or 'backup' (restored
  // from the backup book) — anything else is dropped, never thrown.
  const backup = cleanList(raw.backup)
  if (backup.length > 0) out.backup = backup
  if (raw.replaced === 'prepared' || raw.replaced === 'backup') out.replaced = raw.replaced
  // Blank-book price + materials (V5, 2026-11-08; fixed table,
  // 2026-11-08): `bookCost` is the gp actually charged for this
  // book's blank pages — a stored 0 is a real charge, not absence —
  // and `bookMaterials` the materials KEY (a legacy free-text
  // description from before the table is carried verbatim).
  // Present only when set, so the blank state keeps its exact old
  // shape; bad stored values are dropped, never thrown. Mirrors
  // server/services/spellbookService.js exactly.
  if (typeof raw.bookCost === 'number' && Number.isFinite(raw.bookCost) && raw.bookCost >= 0) out.bookCost = raw.bookCost
  if (typeof raw.bookMaterials === 'string' && raw.bookMaterials.trim()) out.bookMaterials = raw.bookMaterials.trim()
  // Arcane Recovery (2026-11-08): the used-flag is present ONLY
  // while used (absent = available), and the bank rides here in the
  // same present-only-when-set shape as the Memorize bank, so the
  // blank state keeps its exact old shape and the status /
  // always-prepared / discard / replace routes can never silently
  // wipe either one. Mirrors server/services/spellbookService.js
  // exactly.
  if (raw.arcaneRecoveryUsed === true) out.arcaneRecoveryUsed = true
  const arcBank = parsePendingArcaneRecovery(raw.pendingArcaneRecovery)
  if (arcBank) out.pendingArcaneRecovery = arcBank
  return out
}

// ---- banked Memorize Swap (rest consolidation, 2026-11-07) --------
// The DM owns rests now, but the swap choice is the player's: the
// sheet banks the pick (inside spellbook_json — no new column, no
// migration) and the next DM short rest validates + applies it, then
// clears it. Only a valid { oldSpell, newSpell } pair survives
// parse; anything else is dropped, never thrown. Mirrors
// server/services/spellbookService.js exactly.
export function parsePendingMemorizeSwap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const oldSpell = typeof value.oldSpell === 'string' ? value.oldSpell.trim() : ''
  const newSpell = typeof value.newSpell === 'string' ? value.newSpell.trim() : ''
  if (!oldSpell || !newSpell) return null
  return { oldSpell, newSpell }
}

/** The banked swap for a spellbook state value, or null when none. */
export function pendingMemorizeSwap(state) {
  return parseSpellbookState(state).pendingMemorizeSwap ?? null
}

/** A copy of the parsed state with the bank set (swap) or cleared (null). */
export function setPendingMemorizeSwap(state, swap) {
  const parsed = parseSpellbookState(state)
  const bank = parsePendingMemorizeSwap(swap)
  if (bank) parsed.pendingMemorizeSwap = bank
  else delete parsed.pendingMemorizeSwap
  return parsed
}

/** '1st' / '2nd' / '3rd' / '4th' … → 1 / 2 / 3 / 4 …, 'cantrip' → 0, else null. */
export function spellLevelNumber(levelLabel) {
  if (levelLabel == null) return null
  if (typeof levelLabel === 'number') return Number.isFinite(levelLabel) ? Math.trunc(levelLabel) : null
  const s = String(levelLabel).trim().toLowerCase()
  if (s === 'cantrip' || s === '0') return 0
  const m = s.match(/^(\d+)(st|nd|rd|th)?$/)
  return m ? Number(m[1]) : null
}

/** '1st' / '2nd' / '3rd' / '4th' … label for a numeric spell level. */
export function spellLevelLabel(level) {
  const n = Number(level)
  if (!Number.isFinite(n) || n < 1) return ''
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${Math.trunc(n)}th`
}

const canon = (s) => String(s || '').toLowerCase().trim()

/**
 * Spells a wizard may copy into the book right now, from the client
 * spell catalog: on the Wizard list, of a level the wizard has slots
 * for, not already in the book. Returns
 * [{ name, level, school, gold, hours }] sorted by level then name.
 *
 * - spellsByLevel: the client catalog shape { '1st': [{ name, school,
 *   classes }], … } (client/src/data/spells/index.js).
 * - slotLevels: numeric levels the wizard has slots for (from the
 *   spell-slots endpoint's `max` keys); when the slots have not
 *   loaded, pass [1] — a wizard always has 1st-level slots — and the
 *   panel says higher levels appear once slots load.
 * - bookNames: the stored book contents (keys or names — compared
 *   case-insensitively).
 * - search: optional substring filter on the spell name.
 */
export function copyableSpellCandidates({ spellsByLevel, slotLevels, bookNames, search = '' } = {}) {
  const book = new Set((Array.isArray(bookNames) ? bookNames : []).map(canon))
  const levels = (Array.isArray(slotLevels) ? slotLevels : [])
    .map(Number).filter((n) => Number.isFinite(n) && n >= 1)
  const q = String(search || '').toLowerCase().trim()
  const out = []
  for (const level of levels) {
    const entries = (spellsByLevel || {})[spellLevelLabel(level)] || []
    for (const s of entries) {
      if (!s?.name) continue
      if (!Array.isArray(s.classes) || !s.classes.some((c) => String(c).toLowerCase() === 'wizard')) continue
      if (book.has(canon(s.name))) continue
      if (q && !String(s.name).toLowerCase().includes(q)) continue
      const cost = copyCostForSpellLevel(level)
      out.push({ name: s.name, level, school: s.school || '', gold: cost.gold, hours: cost.hours })
    }
  }
  out.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name))
  return out
}

// ---- spell scrolls (2026-11-08) ------------------------------------
// A scroll's spell rides its inventory row NAME, canonical form
// `Spell Scroll of <Spell>` (D1 — every grant path is name-based, so
// the name IS the naming: no schema change, no grant-path change, no
// merge-key change). The parse is case-insensitive on the fixed
// prefix; the spell itself is returned as written (trimmed) and any
// comparison against a requested spell is canonicalized by the
// caller / server — the server re-reads the row and re-derives the
// spell, never trusting the client's claim. A level-named row
// (`Spell Scroll (1st Level)`) holds no spell and parses to null —
// it stays in inventory, usable for nothing yet, exactly as today.

/** The spell a scroll row holds, or null when the name is not a spell scroll. */
export function scrollSpellFromName(name) {
  if (typeof name !== 'string') return null
  const m = name.trim().match(/^spell\s+scroll\s+of\s+(.+)$/i)
  if (!m) return null
  const spell = m[1].trim()
  return spell || null
}

/**
 * Spell-scroll rows in an inventory: rows whose name parses to a
 * spell, in stored order. Each entry is
 * { name, spell, quantity } — `name` is the exact stored row name
 * (the `scrollName` the copy body sends), `spell` the parsed spell,
 * `quantity` the row quantity (1 when the row carries none). Rows
 * may be `{ name, quantity }` objects or bare strings, like the
 * sheet's inventory parsing; level-named rows and non-scroll rows
 * are left out. No catalog, book, or slot filtering here — the sheet
 * applies the same copyable gates as the found-book list beside
 * `copyCandidates`.
 */
export function spellScrollRows(inventory) {
  if (!Array.isArray(inventory)) return []
  const out = []
  for (const row of inventory) {
    const name = typeof row === 'string' ? row : row?.name
    const spell = scrollSpellFromName(name)
    if (!spell) continue
    const q = Number(typeof row === 'string' ? 1 : row?.quantity)
    out.push({ name: String(name).trim(), spell, quantity: Number.isFinite(q) && q >= 1 ? Math.trunc(q) : 1 })
  }
  return out
}

/**
 * Memorize Spell (wizard L5, Short Rest) options: the swap-out list
 * is the prepared list minus always-prepared picks (Mastery /
 * Signature can never be swapped out), and the swap-in list is the
 * book minus what is already prepared. Returns
 * { oldOptions: [names], newOptions: [names] } in stored-name form.
 */
export function memorizeSwapOptions({ prepared, book, alwaysPrepared } = {}) {
  const always = new Set((Array.isArray(alwaysPrepared) ? alwaysPrepared : []).map(canon))
  const prep = (Array.isArray(prepared) ? prepared : []).filter((s) => typeof s === 'string' && s.trim())
  const bookList = (Array.isArray(book) ? book : []).filter((s) => typeof s === 'string' && s.trim())
  const prepSet = new Set(prep.map(canon))
  return {
    oldOptions: prep.filter((s) => !always.has(canon(s))),
    newOptions: bookList.filter((s) => !prepSet.has(canon(s))),
  }
}

// ---- Arcane Recovery (wizard L1, 2024 PHB) ----------------------
// Once per Long Rest, on finishing a Short Rest, recover combined
// spell-slot levels equal to half the wizard level (rounded up),
// none 6th level or higher. Wizard levels ONLY for multiclass.
// The pick is the player's: the sheet banks it here (inside
// spellbook_json — no new column, no migration) and the DM short-
// rest path consumes it. The bank is validated at bank time AND at
// apply time (slots may have been spent or restored between banking
// and the rest), and the consume step clears it whether the recovery
// applies or is refused — never a stale bank firing on a later rest.
// The used-flag is set when a recovery applies and cleared by the
// next DM long rest; a long rest never consumes the bank itself.
// A lost spellbook does NOT block recovery — it restores spent
// slots, it does not change the prepared list — so neither key is
// gated on book status anywhere. Mirrors
// server/services/spellbookService.js exactly.

/** Combined slot levels recoverable at this wizard level: ceil(level / 2). */
export function arcaneRecoveryBudget(wizardLevel) {
  const l = Number(wizardLevel)
  if (!Number.isFinite(l) || l < 1) return 0
  return Math.ceil(l / 2)
}

// The bank is `{ slots: [2, 1] }` — a list of slot levels, duplicates
// allowed for two same-level slots; the sum is the combined levels
// recovered. A `levels` key is accepted as an alias on parse (a row
// written by hand), but the routes always store `slots`. Only a
// non-empty list of integer levels 1–9 survives parse; anything else
// is dropped, never thrown. Levels 6+ parse fine — they are refused
// by validation (with a clear error), not silently dropped.
export function parsePendingArcaneRecovery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const raw = Array.isArray(value.slots) ? value.slots : value.levels
  if (!Array.isArray(raw) || raw.length === 0) return null
  const slots = []
  for (const entry of raw) {
    const level = Number(entry)
    if (!Number.isInteger(level) || level < 1 || level > 9) return null
    slots.push(level)
  }
  return { slots }
}

/** The banked recovery for a spellbook state value, or null when none. */
export function pendingArcaneRecovery(state) {
  return parseSpellbookState(state).pendingArcaneRecovery ?? null
}

/** A copy of the parsed state with the bank set (bank) or cleared (null). */
export function setPendingArcaneRecovery(state, bank) {
  const parsed = parseSpellbookState(state)
  const next = parsePendingArcaneRecovery(bank)
  if (next) parsed.pendingArcaneRecovery = next
  else delete parsed.pendingArcaneRecovery
  return parsed
}

/** Whether the once-per-long-rest recovery has been used (absent = available). */
export function arcaneRecoveryUsed(state) {
  return parseSpellbookState(state).arcaneRecoveryUsed === true
}

/** A copy of the parsed state with the used-flag set (true) or cleared (false). */
export function setArcaneRecoveryUsed(state, used) {
  const parsed = parseSpellbookState(state)
  if (used) parsed.arcaneRecoveryUsed = true
  else delete parsed.arcaneRecoveryUsed
  return parsed
}

/**
 * Wizard level for the sheet's Arcane Recovery display: the wizard
 * entry in class_levels when present (a fighter 5 / wizard 1 has
 * wizard level 1, not 6 — the budget is ceil(wizard level / 2), so
 * that character recovers 1 slot level, not 3), else the row total
 * when the primary class IS wizard, else 0 — no wizard levels at
 * all. Same shape + fallback as the server's
 * wizardLevelFromClassLevels plus the single-class fallback the
 * rest path and the memorize-bank route use (the wizLevel
 * expression in restTimeService.js) — the client gate must agree
 * with the server, or a multiclass character would see a budget it
 * cannot bank. Returns 0 (not null) so the sheet gates the section
 * on `wizardLevel >= 1` directly. This is the picker job's
 * classLevelFor pattern (Stage2ClassCalling.jsx), as a pure helper
 * in this module rather than an import of the whole creator stage —
 * classLevelFor falls back to the row total when no wizard entry
 * exists, which would hand a non-wizard a bogus wizard level, so
 * the no-entry case returns 0 here instead.
 */
export function wizardLevelFor({ classLevels, characterClass, characterLevel } = {}) {
  const list = typeof classLevels === 'string'
    ? (() => { try { return JSON.parse(classLevels || '[]'); } catch { return null; } })()
    : classLevels
  if (Array.isArray(list)) {
    const entry = list.find((e) => String(e?.class ?? e?.classId ?? '').toLowerCase() === 'wizard')
    if (entry) {
      const n = Number(entry?.level)
      return Number.isFinite(n) && n >= 1 ? n : 0
    }
    return 0
  }
  if (String(characterClass || '').toLowerCase() === 'wizard') {
    const total = Number(characterLevel)
    return Number.isFinite(total) && total >= 1 ? total : 1
  }
  return 0
}

/**
 * Arcane Recovery picker options: the slot levels the wizard may
 * bank right now, from the sheet's loaded slot state. Only levels
 * 1–5 with at least one slot spent are offered — a level with 0
 * used has nothing to recover, and 6th+ slots never recover (the
 * server refuses them). Each option carries how many copies of that
 * level are still pickable: min(spent, max) minus copies already
 * picked — a spent slot beyond the character's max is not a real
 * slot, and the server refuses it too. Returns
 * { options: [{ level, label, spent, max, picked, remaining }],
 *   pickedTotal, budgetLeft } — pickedTotal is the combined levels
 * picked so far, budgetLeft is null when no budget was passed. The
 * server is the authority at bank time; this helper only keeps the
 * picker honest about what can be recovered.
 */
export function arcaneRecoveryOptions({ used, max, picked = [], budget = null } = {}) {
  const usedMap = {}
  for (const [k, v] of Object.entries(used || {})) usedMap[Number(k)] = Number(v) || 0
  const maxMap = {}
  for (const [k, v] of Object.entries(max || {})) maxMap[Number(k)] = Number(v) || 0
  const pickedCounts = {}
  const picks = Array.isArray(picked) ? picked : []
  for (const p of picks) {
    const level = Number(p)
    if (Number.isInteger(level) && level >= 1) pickedCounts[level] = (pickedCounts[level] || 0) + 1
  }
  const pickedTotal = picks.reduce((a, p) => a + (Number(p) || 0), 0)
  const options = []
  for (let level = 1; level <= 5; level++) {
    const spent = usedMap[level] || 0
    if (spent <= 0) continue
    const cap = Math.min(spent, maxMap[level] || 0)
    const already = pickedCounts[level] || 0
    options.push({
      level,
      label: spellLevelLabel(level),
      spent,
      max: maxMap[level] || 0,
      picked: already,
      remaining: Math.max(0, cap - already),
    })
  }
  const budgetNum = budget == null ? NaN : Number(budget)
  return {
    options,
    pickedTotal,
    budgetLeft: Number.isFinite(budgetNum) ? budgetNum - pickedTotal : null,
  }
}

// ---- spellbook replacement + backup (2026-11-07) ------------------
// Pure cost previews for the sheet's Spellbook section. The server
// derives the new book and enforces gold + clock; these helpers only
// price what the player is about to confirm, at the 1h + 10 gp
// replace rate — never the 2h + 50 gp copy rate. `levelOf` maps a
// spell name to its numeric level (or null when the client catalog
// has no entry for it); spells with an unknown level are listed in
// `unknownLevels` and priced by the server, never guessed here.

/**
 * What re-transcribing from memory costs: the prepared spells, plus
 * the stored always-prepared picks (Spell Mastery / Signature —
 * gated to L18/L20 by the server route when it saves them, so a
 * stored pick rides the transcription), deduped by canonical name,
 * prepared order first. `transcribed` (V6, spell by spell): spells
 * already transcribed into the new book in an earlier subset call —
 * they are left out, so the preview prices only what is still to
 * transcribe. Returns
 * { entries: [{ name, level, gold, hours }], totalGold, totalHours,
 *   unknownLevels: [names] }.
 */
export function replacementPreview({ prepared, alwaysPrepared, levelOf, transcribed } = {}) {
  const level = typeof levelOf === 'function' ? levelOf : () => null
  const seen = new Set()
  const already = new Set((Array.isArray(transcribed) ? transcribed : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().toLowerCase()))
  const entries = []
  const unknownLevels = []
  const clean = (v) => (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  for (const name of [...clean(prepared), ...clean(alwaysPrepared)]) {
    if (seen.has(canon(name)) || already.has(canon(name))) continue
    seen.add(canon(name))
    const lv = level(name)
    const n = Number(lv)
    if (!Number.isFinite(n) || n < 1) {
      unknownLevels.push(name)
      continue
    }
    const cost = replaceCostForSpellLevel(n)
    entries.push({ name, level: n, gold: cost.gold, hours: cost.hours })
  }
  return {
    entries,
    totalGold: entries.reduce((a, e) => a + e.gold, 0),
    totalHours: entries.reduce((a, e) => a + e.hours, 0),
    unknownLevels,
  }
}

/**
 * What restoring from the backup book does: the new book IS the full
 * backup contents, at 0 gp / 0 h (already paid when the spells were
 * copied INTO the backup). Prepared spells — and stored
 * always-prepared picks — not in the backup are dropped, named here
 * so the panel shows them before confirm instead of silently
 * losing them. Returns
 * { spells: [backup names], droppedPrepared: [names],
 *   droppedAlwaysPrepared: [names] }.
 */
export function backupRestorePreview({ prepared, backup, alwaysPrepared } = {}) {
  const clean = (v) => (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  const spells = clean(backup)
  const inBackup = new Set(spells.map(canon))
  return {
    spells,
    droppedPrepared: clean(prepared).filter((s) => !inBackup.has(canon(s))),
    droppedAlwaysPrepared: clean(alwaysPrepared).filter((s) => !inBackup.has(canon(s))),
  }
}

/**
 * Spells that can be copied into the backup book right now: book
 * spells not already in the backup, each priced at the replace rate
 * (1h + 10 gp per level), sorted by level then name. Spells whose
 * level the client catalog cannot price land in `unknownLevels`
 * (the server prices them — the sheet says so instead of guessing).
 * Returns { candidates: [{ name, level, gold, hours }], unknownLevels: [names] }.
 */
export function backupCopyCandidates({ book, backup, levelOf } = {}) {
  const level = typeof levelOf === 'function' ? levelOf : () => null
  const clean = (v) => (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  const inBackup = new Set(clean(backup).map(canon))
  const candidates = []
  const unknownLevels = []
  for (const name of clean(book)) {
    if (inBackup.has(canon(name))) continue
    const lv = level(name)
    const n = Number(lv)
    if (!Number.isFinite(n) || n < 1) {
      unknownLevels.push(name)
      continue
    }
    const cost = replaceCostForSpellLevel(n)
    candidates.push({ name, level: n, gold: cost.gold, hours: cost.hours })
  }
  candidates.sort((a, b) => (a.level - b.level) || a.name.localeCompare(b.name))
  return { candidates, unknownLevels }
}

/**
 * A lost book's replacement episode (V6, spell by spell, 2026-11-08):
 * how far the rebuild has got, and whether the blank book still has
 * to be paid for. `state` is the PARSED spellbook state
 * (parseSpellbookState), `book` the stored book contents
 * (known_spells), `prepared` / `alwaysPrepared` the stored prepared
 * list and always-prepared picks. Mirrors the server replace
 * route's in-progress detector exactly:
 * - inProgress: a subset episode is already under way — no
 *   `replaced` marker yet, a book cost already stored for this
 *   book, and every spell in the stored book is a prepared (or
 *   always-prepared) spell. Then the stored book IS the
 *   transcribed-so-far set. Otherwise the stored book is the OLD
 *   lost book's contents — gone, not a base — and transcribed is [].
 * - bookCostDue: the blank book's price is charged on the next
 *   memory-path call — no `replaced` marker and no episode in
 *   progress. A backup restore never charges it (the caller checks
 *   the source); a re-loss after a completed replacement carries
 *   the marker, so it is not due either.
 * Returns { inProgress, transcribed: [names], bookCostDue }.
 */
export function replaceEpisodeProgress({ state, book, prepared, alwaysPrepared } = {}) {
  const clean = (v) => (Array.isArray(v) ? v : []).filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
  const transcribable = new Set([...clean(prepared), ...clean(alwaysPrepared)].map(canon))
  const bookList = clean(book)
  const inProgress = state?.replaced == null
    && typeof state?.bookCost === 'number'
    && bookList.every((s) => transcribable.has(canon(s)))
  return {
    inProgress,
    transcribed: inProgress ? bookList : [],
    bookCostDue: state?.replaced == null && !inProgress,
  }
}
