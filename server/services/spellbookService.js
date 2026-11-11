// spellbookService.js — Wizard spellbook system (2026-11-07).
//
// 2024 PHB rules (photo-verified, see the wizard reconciliation note
// §3/§5 and current-build-state.md:557 — do not re-derive):
//   - The book starts with 6 L1 spells; +2 spells per wizard level
//     after 1st (6 at L1, 8 at L2, …, 44 at L20).
//   - A wizard prepares FROM the book: Int mod + wizard level, min 1.
//   - Savant (L3, PHB schools): two school spells of 2nd level or
//     lower free at 3rd; +1 free school spell per new slot level.
//   - Memorize Spell (L5): Short Rest single-swap, prepared spell
//     for another spell IN THE BOOK.
//   - Spell Mastery (L18): 2 spells always prepared. Signature
//     Spells (L20): 2 more always prepared.
//   - Copying: 2 hours + 50 gp per spell level.
//   - Copying the Book (backup) / replacing a lost book: 1 hour +
//     10 gp per spell level (2024 PHB pp. 165–166 sidebar, received
//     2026-11-07 — replacement is no longer blocked-needs-docs).
//
// Storage shape (migration 111): the book itself lives in the
// existing `known_spells` column — the sheet already treats it as
// the book ("Spellbook contains N spells", prepare picker restricted
// to book contents), so no new book column. This service owns the
// one new column, `spellbook_json` (TEXT, '{}' default):
//   { status: 'intact' | 'lost', mastery: [names], signature: [names] }
// `status` is authoritative for the physical book: package wizards
// flip it via the discard-item hook, gold-fork wizards (no
// Spellbook inventory row) via the spellbook-status route. Losing
// the book refuses prepared CHANGES; the existing prepared list
// stays castable. Replacement transcription after losing the book
// lives in the spellbook-replace route (1h + 10 gp per spell level
// per prepared spell); the status flip alone is a DM override, not
// the rules flow. Two optional keys ride the same column, present
// only while set (like the banked swap below, so the blank state
// keeps its exact old shape): `backup: [names]` — the contents of a
// second book, filled by the spellbook-backup route — and `replaced:
// 'prepared' | 'backup'` — set by the replace route so the DM prompt
// can say the book is a replacement, not the original.
//
// Rest consolidation (2026-11-07): the same column also carries the
// banked Memorize Swap, `pendingMemorizeSwap: { oldSpell, newSpell }`
// — the player's pick, banked by the sheet and consumed by the next
// DM short rest. No new column, no migration. The key is present
// ONLY while a swap is banked, so the blank state keeps its exact
// old shape; every parse/serialize round-trip preserves a bank, so
// the status / always-prepared / discard routes can never silently
// wipe one.
//
// Arcane Recovery (2026-11-08): the same column carries two more
// present-only-when-set keys, in the same shape and for the same
// reason — `pendingArcaneRecovery: { slots: [2, 1] }` (the player's
// pick of which spent slot levels to recover, banked by the sheet
// and consumed by the next DM short rest) and `arcaneRecoveryUsed:
// true` (set when a recovery applies, cleared by the next DM long
// rest; absent = available). A lost spellbook does NOT block
// recovery — it restores spent slots, it does not change the
// prepared list — so neither key is gated on book status anywhere.
//
// Veto fixes V5–V6 (2026-11-08): the same column carries
// `bookCost` (the gp actually charged for this book's blank pages —
// the standard 50 gp by default, or the DM's price in play) and
// `bookMaterials` (free text describing what the book is made of),
// present only while set, same shape as the keys above. The
// replace route charges the book cost exactly once per book; a
// subset (spell-by-spell) replacement accumulates into
// known_spells while status stays `lost` until the prepared list
// is fully transcribed.
//
// This module is pure logic + tiny parsers: it never touches the
// database. Routes own the reads/writes and call these helpers, so
// the helpers are unit-testable without a DB and the routes stay
// thin. Every spell-name comparison canonicalizes through
// spellSelectionService.canonicalizeSpellName (lowercase + alias
// map); stored names keep the spelling they arrived with.
import { SPELL_DATA_ENTRIES } from '../data/spellCatalogData.js';
import { getSpellSlots, getMulticlassSpellSlots, WARLOCK_SPELL_SLOTS } from '../config/levelProgression.js';
import { canLearnSpell, canonicalizeSpellName } from './spellSelectionService.js';

// Book size: 6 at L1, +2 per wizard level after 1st.
export const SPELLBOOK_START_SIZE = 6;
export const SPELLBOOK_SPELLS_PER_LEVEL = 2;

export function spellbookSizeForLevel(level) {
  const l = Number(level);
  if (!Number.isFinite(l)) return SPELLBOOK_START_SIZE;
  const clamped = Math.min(20, Math.max(1, Math.trunc(l)));
  return SPELLBOOK_START_SIZE + SPELLBOOK_SPELLS_PER_LEVEL * (clamped - 1);
}

// Copying: 2 hours + 50 gp per spell level.
export const COPY_GOLD_PER_SPELL_LEVEL = 50;
export const COPY_HOURS_PER_SPELL_LEVEL = 2;

export function copyCostForSpellLevel(spellLevel) {
  const l = Number(spellLevel);
  if (!Number.isFinite(l) || l < 1) return null;
  return { gold: COPY_GOLD_PER_SPELL_LEVEL * l, hours: COPY_HOURS_PER_SPELL_LEVEL * l };
}

// Scroll copying (2026-11-08, D1): a scroll's spell rides its
// inventory row NAME, canonical form `Spell Scroll of <Spell>`.
// parseScrollName returns the spell name in the row's spelling, or
// null when the name carries no spell — a level-named scroll
// (`Spell Scroll (1st Level)`) holds no spell, and neither does a
// bare `Spell Scroll`. The caller canonicalizes the result before
// comparing it to the requested spell.
export function parseScrollName(name) {
  if (typeof name !== 'string') return null;
  const match = /^spell scroll of\s+(.+)$/i.exec(name.trim());
  if (!match) return null;
  const spell = match[1].trim();
  return spell === '' ? null : spell;
}

// The wizard's subclass, for the Hedge Mage "Nothing to Waste"
// check (D3): the wizard entry's `subclass` when class_levels
// carries one; otherwise the row's `subclass` column — but only
// when wizard is the PRIMARY class (the column is the primary
// class's subclass, so a fighter-primary wizard's row subclass is
// the fighter's, never the wizard's). Returns null when no wizard
// subclass is recorded anywhere. class_levels may be a JSON string
// or a parsed array. Same shape as the subclass map in
// arcaneRecoveryMaxSlots.
export function wizardSubclassFromClassLevels(classLevels, primaryClass, rowSubclass) {
  const list = typeof classLevels === 'string'
    ? (() => { try { return JSON.parse(classLevels || '[]'); } catch { return null; } })()
    : classLevels;
  if (Array.isArray(list)) {
    const entry = list.find((e) => String(e?.class ?? '').toLowerCase() === 'wizard');
    if (entry && typeof entry.subclass === 'string' && entry.subclass.trim()) return entry.subclass.trim();
  }
  if (String(primaryClass || '').toLowerCase() === 'wizard'
    && typeof rowSubclass === 'string' && rowSubclass.trim()) return rowSubclass.trim();
  return null;
}

// Replacing / backing up: 1 hour + 10 gp per spell level (2024 PHB
// pp. 165–166, "EXPANDING AND REPLACING A SPELLBOOK" sidebar —
// "Copying the Book": copy a spell from your book into another book,
// and transcribe the PREPARED spells into a new book when yours is
// lost). This is a DIFFERENT rate from copying a new spell in (2h +
// 50 gp above); the two rates must never be conflated — replacement
// and backup copy use REPLACE_*, new-spell copy uses COPY_*.
export const REPLACE_GOLD_PER_SPELL_LEVEL = 10;
export const REPLACE_HOURS_PER_SPELL_LEVEL = 1;

// The blank book itself (V5, 2026-11-08; table, 2026-11-08 follow-ups):
// a standard spellbook costs 50 gp — the price the DM charges for the
// blank pages of a replacement or backup book, on top of the 1h + 10 gp
// per spell level transcription. The price is FIXED by this table: the
// client sends only a materials KEY, the server looks the key up and
// charges the table price. There is no free-form price and no waived
// tier — a 0 gp book does not exist in the table. Do NOT parse the
// "50 gp" display string in `server/data/gearItems.js` — that is a
// third-party display record, not a chargeable number.
export const STANDARD_SPELLBOOK_COST_GP = 50;

// Spellbook materials (2026-11-08 follow-ups, Zach's five tiers —
// build exactly these, no more, no fewer). The client sends the KEY;
// the server charges `cost` and stores the KEY as `bookMaterials`
// with the charged gp as `bookCost`. Mirrored in
// spellbookHelpers.js beside its constant; the table above IS the
// contract — same keys, labels, prices on both sides.
export const SPELLBOOK_MATERIALS = {
  vellum: { label: 'Vellum bound with twine', cost: 25 },
  standard: { label: 'Standard spellbook', cost: 50 },
  'fine-leather': { label: 'Fine leather-bound', cost: 100 },
  'gilt-edged': { label: 'Gilt-edged tome', cost: 250 },
  dragonhide: { label: 'Dragonhide-bound', cost: 500 },
};

// Validate a route's `bookMaterials` body param against the table:
// absent/blank means the standard book; anything else must be one of
// the table's keys. Returns the key to store and the price to charge.
// A stale client sending a free-form `bookCost` gets it ignored like
// any other unknown body field — the price comes from the table now,
// never from the request. (The old `parseBookCostParam` is deleted
// with the free-form price; the stored `bookCost` key in
// spellbook_json stays — it is now the DERIVED price.)
export function parseBookMaterialsParam(value) {
  if (value === undefined || value === null || value === '') {
    return { ok: true, materials: 'standard', cost: STANDARD_SPELLBOOK_COST_GP, provided: false };
  }
  if (typeof value !== 'string') {
    return { ok: false, error: `bookMaterials: must be one of ${Object.keys(SPELLBOOK_MATERIALS).join(', ')}, got '${value}'` };
  }
  const key = value.trim();
  if (key === '') {
    return { ok: true, materials: 'standard', cost: STANDARD_SPELLBOOK_COST_GP, provided: false };
  }
  const entry = SPELLBOOK_MATERIALS[key];
  if (!entry) {
    return { ok: false, error: `bookMaterials: unknown spellbook material '${key}' — expected one of ${Object.keys(SPELLBOOK_MATERIALS).join(', ')}` };
  }
  return { ok: true, materials: key, cost: entry.cost, provided: true };
}

export function replaceCostForSpellLevel(spellLevel) {
  const l = Number(spellLevel);
  if (!Number.isFinite(l) || l < 1) return null;
  return { gold: REPLACE_GOLD_PER_SPELL_LEVEL * l, hours: REPLACE_HOURS_PER_SPELL_LEVEL * l };
}

// Batch replace cost: sum the replace rate over a list of spell
// levels (the whole prepared list on a replacement, one spell on a
// backup copy). Returns null when the list is not an array of
// valid (≥1) levels.
export function replaceCostForSpells(levels) {
  if (!Array.isArray(levels)) return null;
  let gold = 0;
  let hours = 0;
  for (const level of levels) {
    const cost = replaceCostForSpellLevel(level);
    if (!cost) return null;
    gold += cost.gold;
    hours += cost.hours;
  }
  return { gold, hours };
}

// Savant schools: subclass registry key (server/data/subclasses/
// wizard.js) -> catalog school. Only the four PHB schools have a
// Savant feature; the other six wizard subclasses map to nothing.
export const SAVANT_SCHOOL_BY_SUBCLASS = {
  abjurer: 'Abjuration',
  diviner: 'Divination',
  evoker: 'Evocation',
  illusionist: 'Illusion',
};

export function savantSchoolForSubclass(subclass) {
  if (subclass == null) return null;
  const key = String(subclass).trim().toLowerCase().replace(/\s+/g, '');
  // Canonical registry keys (abjurer/evoker/…) first. The aliases
  // cover the display forms a row may hold instead — 'School of
  // Evocation' (the pre-2024-audit fixtures stored that string) and
  // the bare school name — so a wizard whose subclass was stored as
  // a display name still gets its Savant frees.
  const aliases = {
    abjurer: 'Abjuration', abjuration: 'Abjuration', schoolofabjuration: 'Abjuration',
    diviner: 'Divination', divination: 'Divination', schoolofdivination: 'Divination',
    evoker: 'Evocation', evocation: 'Evocation', schoolofevocation: 'Evocation',
    illusionist: 'Illusion', illusion: 'Illusion', schoolofillusion: 'Illusion',
  };
  return aliases[key] || null;
}

// Wizard levels that open a NEW spell-slot level, from the full-
// caster table (levelProgression.FULL_CASTER_SPELL_SLOTS): 3rd
// opens 2nd-level slots, 5th opens 3rd, 7th 4th, 9th 5th, 11th 6th,
// 13th 7th, 15th 8th, 17th 9th. The test derives this list from the
// real table; if the table ever changes, the test — not the code —
// is the tripwire.
export const NEW_SLOT_LEVELS = [3, 5, 7, 9, 11, 13, 15, 17];

// Highest spell-slot level a wizard of this level can cast.
export function maxSpellSlotLevel(wizardLevel) {
  const slots = getSpellSlots('wizard', wizardLevel) || {};
  const levels = Object.keys(slots).map(Number).filter((n) => Number.isFinite(n) && (slots[n] || 0) > 0);
  return levels.length > 0 ? Math.max(...levels) : 0;
}

// Savant free-adds due on THIS level-up (single-level step):
//   - reaching 3rd: 2 school spells of 2nd level or lower;
//   - reaching any later new-slot level: 1 school spell of a level
//     for which the wizard has slots.
// The 3rd-level grant IS the new-slot-level grant for 2nd-level
// slots — it is 2 spells, not 2 + 1. A wizard who gains a subclass
// without Savant (non-PHB school) gets 0; the caller checks the
// school first, so this function is level-only.
export function savantFreeCountAtLevelUp(newClassLevel) {
  const l = Number(newClassLevel);
  if (!Number.isFinite(l)) return 0;
  if (l === 3) return 2;
  return NEW_SLOT_LEVELS.includes(l) ? 1 : 0;
}

// Highest spell level a Savant free-add may be at this level-up:
// 2nd at 3rd, otherwise the new slot level just gained.
export function savantFreeMaxSpellLevel(newClassLevel) {
  const l = Number(newClassLevel);
  if (!Number.isFinite(l)) return 0;
  if (l === 3) return 2;
  return maxSpellSlotLevel(l);
}

// ---- spellbook_json state -------------------------------------------

export function parseSpellbookState(value) {
  const blank = { status: 'intact', mastery: [], signature: [] };
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw || '{}');
    } catch {
      return blank;
    }
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return blank;
  const cleanList = (v) => (Array.isArray(v)
    ? v.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
    : []);
  const out = {
    status: raw.status === 'lost' ? 'lost' : 'intact',
    mastery: cleanList(raw.mastery),
    signature: cleanList(raw.signature),
  };
  // Banked Memorize Swap (rest consolidation, 2026-11-07): carried
  // only while a swap is banked, so the blank state keeps its exact
  // old shape and every serialize round-trip preserves a live bank.
  const bank = parsePendingMemorizeSwap(raw.pendingMemorizeSwap);
  if (bank) out.pendingMemorizeSwap = bank;
  // Backup spellbook + replacement marker (2026-11-07): same
  // present-only-when-set shape as the bank, so the blank state
  // keeps its exact old shape. `backup` is the contents of a second
  // book (cleaned like mastery/signature); `replaced` is 'prepared'
  // (re-transcribed from the prepared list) or 'backup' (restored
  // from the backup book) — anything else is dropped, never thrown.
  const backup = cleanList(raw.backup);
  if (backup.length > 0) out.backup = backup;
  if (raw.replaced === 'prepared' || raw.replaced === 'backup') out.replaced = raw.replaced;
  // Arcane Recovery (2026-11-08): the used-flag is present ONLY
  // while used (absent = available), and the bank rides here in the
  // same present-only-when-set shape as the Memorize bank, so the
  // blank state keeps its exact old shape and the status /
  // always-prepared / discard / replace routes can never silently
  // wipe either one.
  if (raw.arcaneRecoveryUsed === true) out.arcaneRecoveryUsed = true;
  const arcBank = parsePendingArcaneRecovery(raw.pendingArcaneRecovery);
  if (arcBank) out.pendingArcaneRecovery = arcBank;
  // Blank spellbook (V5, 2026-11-08): `bookCost` is the gp actually
  // charged for THIS book's blank pages (the standard 50 gp by
  // default, or the DM's price in play), `bookMaterials` the
  // free-text description of what it is made of. Present only while
  // set, so the blank state keeps its exact old shape. A stored 0
  // is a real charge (the DM waived the price), not an absence;
  // anything non-numeric, negative, or blank is dropped, never
  // thrown.
  if (typeof raw.bookCost === 'number' && Number.isFinite(raw.bookCost) && raw.bookCost >= 0) out.bookCost = raw.bookCost;
  if (typeof raw.bookMaterials === 'string' && raw.bookMaterials.trim()) out.bookMaterials = raw.bookMaterials.trim();
  return out;
}

// ---- banked Memorize Swap (rest consolidation, 2026-11-07) --------
// The DM owns rests now, but the swap choice is the player's: the
// sheet banks the pick here (inside spellbook_json — no new column,
// no migration) and the DM short-rest path consumes it. The bank is
// validated at bank time AND at apply time (the book may have
// changed between banking and the rest), and the consume step clears
// it whether the swap applies or is refused — never a stale bank
// firing on a later rest. Only a valid { oldSpell, newSpell } pair
// survives parse; anything else is dropped, never thrown.
export function parsePendingMemorizeSwap(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const oldSpell = typeof value.oldSpell === 'string' ? value.oldSpell.trim() : '';
  const newSpell = typeof value.newSpell === 'string' ? value.newSpell.trim() : '';
  if (!oldSpell || !newSpell) return null;
  return { oldSpell, newSpell };
}

/** The banked swap for a spellbook state value, or null when none. */
export function pendingMemorizeSwap(state) {
  return parseSpellbookState(state).pendingMemorizeSwap ?? null;
}

/** A copy of the parsed state with the bank set (swap) or cleared (null). */
export function setPendingMemorizeSwap(state, swap) {
  const parsed = parseSpellbookState(state);
  const bank = parsePendingMemorizeSwap(swap);
  if (bank) parsed.pendingMemorizeSwap = bank;
  else delete parsed.pendingMemorizeSwap;
  return parsed;
}

export function serializeSpellbookState(state) {
  const parsed = parseSpellbookState(state);
  return JSON.stringify(parsed);
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

/** Combined slot levels recoverable at this wizard level: ceil(level / 2). */
export function arcaneRecoveryBudget(wizardLevel) {
  const l = Number(wizardLevel);
  if (!Number.isFinite(l) || l < 1) return 0;
  return Math.ceil(l / 2);
}

// The bank is `{ slots: [2, 1] }` — a list of slot levels, duplicates
// allowed for two same-level slots; the sum is the combined levels
// recovered. A `levels` key is accepted as an alias on parse (a row
// written by hand), but the routes always store `slots`. Only a
// non-empty list of integer levels 1–9 survives parse; anything else
// is dropped, never thrown. Levels 6+ parse fine — they are refused
// by validation (with a clear error), not silently dropped.
export function parsePendingArcaneRecovery(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = Array.isArray(value.slots) ? value.slots : value.levels;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const slots = [];
  for (const entry of raw) {
    const level = Number(entry);
    if (!Number.isInteger(level) || level < 1 || level > 9) return null;
    slots.push(level);
  }
  return { slots };
}

/** The banked recovery for a spellbook state value, or null when none. */
export function pendingArcaneRecovery(state) {
  return parseSpellbookState(state).pendingArcaneRecovery ?? null;
}

/** A copy of the parsed state with the bank set (bank) or cleared (null). */
export function setPendingArcaneRecovery(state, bank) {
  const parsed = parseSpellbookState(state);
  const next = parsePendingArcaneRecovery(bank);
  if (next) parsed.pendingArcaneRecovery = next;
  else delete parsed.pendingArcaneRecovery;
  return parsed;
}

/** Whether the once-per-long-rest recovery has been used (absent = available). */
export function arcaneRecoveryUsed(state) {
  return parseSpellbookState(state).arcaneRecoveryUsed === true;
}

/** A copy of the parsed state with the used-flag set (true) or cleared (false). */
export function setArcaneRecoveryUsed(state, used) {
  const parsed = parseSpellbookState(state);
  if (used) parsed.arcaneRecoveryUsed = true;
  else delete parsed.arcaneRecoveryUsed;
  return parsed;
}

// Spell-slot maxima for the recovery's validation. Multiclass: the
// shared multiclass caster table (getMulticlassSpellSlots) when
// class_levels has more than one entry — the single-class table by
// TOTAL level overstates a multiclass wizard's slots. Single-class
// (or no class_levels): the wizard table at the wizard level. The
// subclasses map is built from the class_levels entries; the row's
// subclass fills in for the primary class when its entry has none
// (it is the primary class's subclass). Pact slots are NOT in this
// map — getMulticlassSpellSlots returns them separately, and Arcane
// Recovery recovers spell slots, not pact slots.
export function arcaneRecoveryMaxSlots(classLevels, wizardLevel, subclass = null) {
  let list = classLevels;
  if (typeof list === 'string') {
    try { list = JSON.parse(list || '[]'); } catch { list = null; }
  }
  const entries = (Array.isArray(list) ? list : [])
    .filter((e) => e && typeof e.class === 'string' && Number(e.level) >= 1);
  if (entries.length > 1) {
    const subclasses = {};
    for (const e of entries) {
      if (typeof e.subclass === 'string' && e.subclass.trim()) {
        subclasses[String(e.class).toLowerCase()] = e.subclass;
      }
    }
    const primary = String(entries[0].class).toLowerCase();
    if (typeof subclass === 'string' && subclass.trim() && !subclasses[primary]) {
      subclasses[primary] = subclass;
    }
    const multi = getMulticlassSpellSlots(entries, subclasses);
    return { ...(multi?.spellSlots || {}) };
  }
  const wiz = Number(wizardLevel);
  return { ...(getSpellSlots('wizard', Number.isFinite(wiz) && wiz >= 1 ? wiz : 1) || {}) };
}

// Validate + apply a banked recovery against live slot state. Pure:
// returns the new used-slots map, or a refusal. Checks, in order:
// non-empty bank → total ≤ budget → no level ≥ 6 → every level
// actually spent → never restore above max. A refusal never trims
// the bank — the whole recovery is refused, the bank is cleared by
// the caller, and the player re-banks. Keys that hit 0 are dropped
// (absent = 0 used, the existing shape); untouched keys pass through
// as stored, including any pre-existing 0-valued keys.
export function applyArcaneRecovery({ usedSlots, maxSlots, bankedLevels, budget }) {
  const levels = Array.isArray(bankedLevels) ? bankedLevels : [];
  if (levels.length === 0) {
    return { ok: false, error: 'arcaneRecovery: no slots banked' };
  }
  const total = levels.reduce((a, b) => a + b, 0);
  const budgetNum = Number(budget);
  if (!Number.isFinite(budgetNum) || total > budgetNum) {
    return { ok: false, error: `arcaneRecovery: banked slot levels total ${total}, over the budget of ${budgetNum}` };
  }
  for (const level of levels) {
    if (!Number.isInteger(level) || level < 1 || level > 9) {
      return { ok: false, error: `arcaneRecovery: invalid slot level ${level}` };
    }
    if (level >= 6) {
      return { ok: false, error: `arcaneRecovery: level ${level} slots cannot be recovered (6th level or higher)` };
    }
  }
  const counts = {};
  for (const level of levels) counts[level] = (counts[level] || 0) + 1;
  const used = {};
  for (const [k, v] of Object.entries(usedSlots || {})) used[Number(k)] = Number(v) || 0;
  const max = {};
  for (const [k, v] of Object.entries(maxSlots || {})) max[Number(k)] = Number(v) || 0;
  for (const [levelStr, count] of Object.entries(counts)) {
    const level = Number(levelStr);
    if ((used[level] || 0) < count) {
      return { ok: false, error: `arcaneRecovery: no level ${level} spell slot is spent to recover` };
    }
    if ((max[level] || 0) < count) {
      return { ok: false, error: `arcaneRecovery: the character has at most ${max[level] || 0} level ${level} slot(s), cannot recover ${count}` };
    }
  }
  const next = { ...(usedSlots || {}) };
  for (const level of levels) {
    next[level] = (Number(next[level]) || 0) - 1;
    if (next[level] <= 0) delete next[level];
  }
  return { ok: true, usedSlots: next };
}

// Always-prepared picks in force at this wizard level: Spell
// Mastery (L18) contributes up to 2, Signature Spells (L20) up to
// 2 more. Below the gates the stored picks are inert, never
// counted — a pick stored early (e.g. seeded by a test) does not
// leak into the cap.
export const SPELL_MASTERY_LEVEL = 18;
export const SIGNATURE_SPELLS_LEVEL = 20;
export const SPELL_MASTERY_MAX = 2;
export const SIGNATURE_SPELLS_MAX = 2;

export function alwaysPreparedSpells(state, wizardLevel) {
  const parsed = parseSpellbookState(state);
  const level = Number(wizardLevel) || 0;
  const out = [];
  if (level >= SPELL_MASTERY_LEVEL) out.push(...parsed.mastery.slice(0, SPELL_MASTERY_MAX));
  if (level >= SIGNATURE_SPELLS_LEVEL) out.push(...parsed.signature.slice(0, SIGNATURE_SPELLS_MAX));
  return out;
}

// ---- membership ------------------------------------------------------

// Every prepared spell (minus the always-prepared exclusions) must
// be IN the book. Returns the missing spells in the caller's
// spelling, first-seen order, deduped by canonical name.
export function validateBookMembership(preparedList, bookList, alwaysPreparedList) {
  const book = new Set((bookList || []).map((s) => canonicalizeSpellName(s)));
  const always = new Set((alwaysPreparedList || []).map((s) => canonicalizeSpellName(s)));
  const missing = [];
  const seenMissing = new Set();
  for (const entry of preparedList || []) {
    if (typeof entry !== 'string' || !entry.trim()) continue;
    const canon = canonicalizeSpellName(entry);
    if (always.has(canon) || book.has(canon)) continue;
    if (seenMissing.has(canon)) continue;
    seenMissing.add(canon);
    missing.push(entry.trim());
  }
  return { ok: missing.length === 0, missing };
}

// Level-up book adds: at most maxCount spells (2 for a wizard
// leveling in-class; 6 for the multiclass-into-wizard seed — a
// 1st-level wizard's book is 6 spells, settled 2026-11-07; null =
// no cap, kept for callers that pass it explicitly), each a
// wizard-list spell of a castable level, not already in the book,
// no duplicates. minCount is the multiclass-seed floor (V4,
// 2026-11-08): when minCount === maxCount the seed is exactly that
// many spells — a short seed refuses naming the count. In-class
// adds pass no minCount (max-only, as before — see the sibling
// note in the level-up route).
export function validateBookAdds({ spells, bookList, wizardLevel, maxCount = 2, minCount = null }) {
  const errors = [];
  const list = Array.isArray(spells) ? spells : [];
  if (maxCount != null && list.length > maxCount) {
    errors.push(`newSpells: a wizard adds at most ${maxCount} spells to the spellbook per level, got ${list.length}`);
  }
  if (minCount != null && list.length < minCount) {
    if (maxCount != null && minCount === maxCount) {
      errors.push(`newSpells: a wizard multiclass seed is exactly ${minCount} spells, got ${list.length}`);
    } else {
      errors.push(`newSpells: a wizard adds at least ${minCount} spells to the spellbook, got ${list.length}`);
    }
  }
  const seen = new Set();
  const book = new Set((bookList || []).map((s) => canonicalizeSpellName(s)));
  for (const name of list) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push('newSpells: entries must be non-empty spell names');
      continue;
    }
    const canon = canonicalizeSpellName(name);
    if (seen.has(canon)) {
      errors.push(`newSpells: '${name.trim()}' was picked twice`);
      continue;
    }
    seen.add(canon);
    if (book.has(canon)) {
      errors.push(`newSpells: '${name.trim()}' is already in the spellbook`);
      continue;
    }
    const result = canLearnSpell({ classId: 'wizard', level: wizardLevel, spellName: name.trim() });
    if (!result.ok) errors.push(`newSpells: ${result.reason}`);
    // Cantrips are not book spells: canLearnSpell passes them (L0
    // is below every max), so the level floor is checked here —
    // the book holds leveled spells only.
    const entry = SPELL_DATA_ENTRIES[canon];
    if (entry && Number(entry.level) < 1) {
      errors.push(`newSpells: '${name.trim()}' is a cantrip — the spellbook holds leveled spells only`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// Savant free-adds on a level-up: the subclass must be a PHB
// school, the level must be one that grants frees, the count must
// not exceed the frees due, and every spell must be of the school,
// of a level the Savant grant allows, learnable by a wizard of
// this level, and not already in the book.
export function validateSavantSpells({ spells, subclass, newClassLevel, bookList }) {
  const errors = [];
  const school = savantSchoolForSubclass(subclass);
  if (!school) {
    return {
      ok: false,
      errors: [`savantSpells: '${subclass || ''}' has no Savant feature — only Abjurer, Diviner, Evoker, and Illusionist add free spells to the spellbook`],
      school: null,
      freeCount: 0,
      maxSpellLevel: 0,
    };
  }
  const freeCount = savantFreeCountAtLevelUp(newClassLevel);
  const maxSpellLevel = savantFreeMaxSpellLevel(newClassLevel);
  if (freeCount === 0) {
    return {
      ok: false,
      errors: [`savantSpells: no Savant spells are due at wizard level ${newClassLevel} — free spells come at 3rd (two) and at each new spell-slot level (one)`],
      school,
      freeCount,
      maxSpellLevel,
    };
  }
  const list = Array.isArray(spells) ? spells : [];
  if (list.length > freeCount) {
    errors.push(`savantSpells: ${freeCount} free ${school} spell${freeCount === 1 ? '' : 's'} ${freeCount === 1 ? 'is' : 'are'} due at wizard level ${newClassLevel}, got ${list.length}`);
  }
  const seen = new Set();
  const book = new Set((bookList || []).map((s) => canonicalizeSpellName(s)));
  for (const name of list) {
    if (typeof name !== 'string' || !name.trim()) {
      errors.push('savantSpells: entries must be non-empty spell names');
      continue;
    }
    const canon = canonicalizeSpellName(name);
    if (seen.has(canon)) {
      errors.push(`savantSpells: '${name.trim()}' was picked twice`);
      continue;
    }
    seen.add(canon);
    if (book.has(canon)) {
      errors.push(`savantSpells: '${name.trim()}' is already in the spellbook`);
      continue;
    }
    const entry = SPELL_DATA_ENTRIES[canon];
    if (!entry) {
      errors.push(`savantSpells: '${name.trim()}' is not in the spell catalog`);
      continue;
    }
    // Cantrips are not Savant adds (canLearnSpell passes L0, so
    // the floor is checked here, as in validateBookAdds).
    if (Number(entry.level) < 1) {
      errors.push(`savantSpells: '${name.trim()}' is a cantrip — Savant free-adds are leveled spells`);
      continue;
    }
    if (entry.school !== school) {
      errors.push(`savantSpells: '${name.trim()}' is ${entry.school}, not ${school}`);
      continue;
    }
    if (Number(entry.level) > maxSpellLevel) {
      errors.push(`savantSpells: '${name.trim()}' is level ${entry.level}, but the Savant grant at wizard level ${newClassLevel} covers spells of level ${maxSpellLevel} or lower`);
      continue;
    }
    const result = canLearnSpell({ classId: 'wizard', level: newClassLevel, spellName: name.trim() });
    if (!result.ok) errors.push(`savantSpells: ${result.reason}`);
  }
  return { ok: errors.length === 0, errors, school, freeCount, maxSpellLevel };
}

// Memorize Spell (L5, Short Rest): swap one prepared spell for
// another spell IN THE BOOK. Pure: returns the new prepared list
// or a refusal. An always-prepared pick (Mastery/Signature) can
// never be swapped OUT — it is prepared by the feature, not by the
// list. Swapping IN an always-prepared pick is a no-op in practice
// (it is already prepared by the feature) and is refused as
// already prepared when it sits in the list.
export function applyMemorizeSwap({ preparedList, bookList, oldSpell, newSpell, alwaysPreparedList = [] }) {
  const prepared = Array.isArray(preparedList) ? [...preparedList] : [];
  const book = new Set((bookList || []).map((s) => canonicalizeSpellName(s)));
  const always = new Set((alwaysPreparedList || []).map((s) => canonicalizeSpellName(s)));
  const oldName = typeof oldSpell === 'string' ? oldSpell.trim() : '';
  const newName = typeof newSpell === 'string' ? newSpell.trim() : '';
  if (!oldName) return { ok: false, error: 'memorizeSwap: oldSpell is required' };
  if (!newName) return { ok: false, error: 'memorizeSwap: newSpell is required' };
  const oldCanon = canonicalizeSpellName(oldName);
  const newCanon = canonicalizeSpellName(newName);
  if (oldCanon === newCanon) {
    return { ok: false, error: 'memorizeSwap: oldSpell and newSpell are the same spell' };
  }
  const oldIdx = prepared.findIndex((s) => canonicalizeSpellName(s) === oldCanon);
  if (oldIdx === -1) {
    return { ok: false, error: `memorizeSwap: '${oldName}' is not prepared` };
  }
  if (always.has(oldCanon)) {
    return { ok: false, error: `memorizeSwap: '${oldName}' is always prepared (Spell Mastery / Signature Spells) and cannot be swapped out` };
  }
  if (!book.has(newCanon)) {
    return { ok: false, error: `memorizeSwap: '${newName}' is not in the spellbook` };
  }
  // Cantrips are never prepared from the book (a cantrip that
  // reached the book through a legacy row still cannot be swapped
  // in as a prepared spell).
  const newEntry = SPELL_DATA_ENTRIES[newCanon];
  if (newEntry && Number(newEntry.level) < 1) {
    return { ok: false, error: `memorizeSwap: '${newName}' is a cantrip — prepared spells come from the book's leveled spells` };
  }
  if (prepared.some((s) => canonicalizeSpellName(s) === newCanon)) {
    return { ok: false, error: `memorizeSwap: '${newName}' is already prepared` };
  }
  prepared[oldIdx] = newName;
  return { ok: true, prepared };
}

// Wizard level from a class_levels value (JSON string or array).
// Returns null when the character has no wizard levels — the
// caller decides what "no wizard" means for its route.
export function wizardLevelFromClassLevels(classLevels) {
  const list = typeof classLevels === 'string'
    ? (() => { try { return JSON.parse(classLevels || '[]'); } catch { return null; } })()
    : classLevels;
  if (!Array.isArray(list)) return null;
  const entry = list.find((e) => String(e?.class ?? '').toLowerCase() === 'wizard');
  if (!entry) return null;
  const level = Number(entry.level);
  return Number.isFinite(level) && level >= 1 ? level : null;
}

// Warlock level from a class_levels value (JSON string or array) —
// the mirror of wizardLevelFromClassLevels. Returns null when the
// character has no warlock levels. class_levels entries carry bare
// registry keys ('warlock'), never a parenthetical form.
export function warlockLevelFromClassLevels(classLevels) {
  const list = typeof classLevels === 'string'
    ? (() => { try { return JSON.parse(classLevels || '[]'); } catch { return null; } })()
    : classLevels;
  if (!Array.isArray(list)) return null;
  const entry = list.find((e) => String(e?.class ?? '').toLowerCase() === 'warlock');
  if (!entry) return null;
  const level = Number(entry.level);
  return Number.isFinite(level) && level >= 1 ? level : null;
}

// Pact slots for a warlock level, from the same WARLOCK_SPELL_SLOTS
// table getMulticlassSpellSlots consults: { slots, level } — the
// count of pact slots and the spell-slot level they are. Null for
// an invalid level (no warlock levels, not a pact caster).
export function pactSlotsForWarlockLevel(warlockLevel) {
  const level = Number(warlockLevel);
  if (!Number.isFinite(level) || level < 1) return null;
  const entry = WARLOCK_SPELL_SLOTS[level];
  if (!entry) return null;
  return { slots: entry.slots, level: entry.level };
}

// Scope a short-rest slot reset to the pact slots ONLY (2026-11-08
// follow-ups, D2). Pure: returns a NEW used-slots map with the pact
// count zeroed at the pact slot level — the shared map cannot tell a
// spent pact slot from a spent spellcasting slot at the same level,
// so where the levels collide the reset zeroes the pact COUNT at
// that level (bounded, only on collision; the split-map runner-up
// D3 is the only complete fix for that). Keys that hit 0 are
// dropped (absent = 0 used); untouched keys pass through as stored,
// including pre-existing 0-valued keys. An invalid warlock level
// returns the map unchanged.
export function resetPactSlots(usedSlots, warlockLevel) {
  const next = { ...(usedSlots || {}) };
  const pact = pactSlotsForWarlockLevel(warlockLevel);
  if (!pact) return next;
  const left = (Number(next[pact.level]) || 0) - pact.slots;
  if (left <= 0) delete next[pact.level];
  else next[pact.level] = left;
  return next;
}

export default {
  SPELLBOOK_START_SIZE,
  SPELLBOOK_SPELLS_PER_LEVEL,
  COPY_GOLD_PER_SPELL_LEVEL,
  COPY_HOURS_PER_SPELL_LEVEL,
  REPLACE_GOLD_PER_SPELL_LEVEL,
  REPLACE_HOURS_PER_SPELL_LEVEL,
  STANDARD_SPELLBOOK_COST_GP,
  SPELLBOOK_MATERIALS,
  SAVANT_SCHOOL_BY_SUBCLASS,
  NEW_SLOT_LEVELS,
  SPELL_MASTERY_LEVEL,
  SIGNATURE_SPELLS_LEVEL,
  SPELL_MASTERY_MAX,
  SIGNATURE_SPELLS_MAX,
  spellbookSizeForLevel,
  copyCostForSpellLevel,
  replaceCostForSpellLevel,
  replaceCostForSpells,
  parseBookMaterialsParam,
  savantSchoolForSubclass,
  maxSpellSlotLevel,
  savantFreeCountAtLevelUp,
  savantFreeMaxSpellLevel,
  parseSpellbookState,
  serializeSpellbookState,
  parsePendingMemorizeSwap,
  pendingMemorizeSwap,
  setPendingMemorizeSwap,
  arcaneRecoveryBudget,
  parsePendingArcaneRecovery,
  pendingArcaneRecovery,
  setPendingArcaneRecovery,
  arcaneRecoveryUsed,
  setArcaneRecoveryUsed,
  arcaneRecoveryMaxSlots,
  applyArcaneRecovery,
  alwaysPreparedSpells,
  validateBookMembership,
  validateBookAdds,
  validateSavantSpells,
  applyMemorizeSwap,
  wizardLevelFromClassLevels,
  wizardSubclassFromClassLevels,
  parseScrollName,
  warlockLevelFromClassLevels,
  pactSlotsForWarlockLevel,
  resetPactSlots,
};
