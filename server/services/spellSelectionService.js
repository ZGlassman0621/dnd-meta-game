// ============================================================
// spellSelectionService.js — SELECTION-TIME spell gating.
//
// THE GATING RULE (user-confirmed): catalog presence alone NEVER
// makes a spell choosable. A spell is choosable only when the
// character has the prerequisite class at the level that grants it.
//
// This is the enforcement layer for spell picks. It does NOT wire
// into character.js POST/PUT (that hook belongs to the coordinator:
// POST/PUT currently accept known_spells / prepared_spells as opaque
// JSON), and it does NOT filter any UI picker (no spell pickers
// exist yet in creator-next beyond the cantrips subsection).
//
// Pure functions, no DB imports. The only imports are data:
// the live catalog, the new-class subclass lists, and the existing
// slot tables (read-only; this file never edits levelProgression.js).
//
// MERGE DEPENDENCY — READ BEFORE USE: for the NEW classes, most
// pre-existing list spells do not yet carry the new class name in
// their catalog `classes` array (e.g. Fireball has no "Spellshot"
// tag, Cloudkill has no "Blackguard" tag, and society-list spells
// have no "Magus" tag). Until the coordinator adds those tags at
// merge time, this service handles the new classes as follows:
//   - Magus: society-list membership IS the membership proof (the
//     catalog tag check is skipped for Magus; see canLearnSpell).
//   - Spellshot / Blackguard: the catalog tag check applies, so
//     pre-existing list spells will correctly reject until their
//     tags are added — that rejection is the gate working, not a
//     bug. Fragment spells (new-spells-catalog.js) already carry
//     the right tags and pass once the caller merges the fragment
//     into `catalogEntries`.
// Callers that already hold the merged catalog should pass it as
// `catalogEntries`; otherwise the live catalog is used as-is.
// ============================================================

import { SPELL_DATA_ENTRIES } from '../data/spellCatalogData.js';
import {
  MAGUS_SOCIETY_SPELL_LISTS,
  WARDEN_CASTING_SUBCLASSES,
  SCHOLAR_CASTING_SUBCLASSES,
} from '../data/newClassSpellLists.js';
import { getSpellSlots } from '../config/levelProgression.js';

// ---- Canonical spell-name spellings (item 13, 2026-11-06) --------
// The catalog holds exactly one entry per spell under its canonical
// spelling; a few subclass/ROSTER printings spell the same spell
// differently ('Colour Spray', 'Create Food or Water', 'Witchbolt',
// 'Skywriting', 'Thornwhip'). Those alternates are the SAME spell,
// not different spells — but an exact-name lookup fails on them.
// canonicalizeSpellName maps a print spelling to the catalog
// spelling at the lookup boundary ONLY (data stays canonical; the
// two live mismatches are renamed in the subclass data itself).
// Applied in canLearnSpell below; callers doing exact Set matches
// (stage4GrantedSpells, prepared-spell validators) apply it to
// both sides. Keys and values are lowercase catalog keys.
export const SPELL_NAME_ALIASES = {
  'colour spray': 'color spray',
  'create food or water': 'create food and water',
  'witchbolt': 'witch bolt',
  'skywriting': 'skywrite',
  'thornwhip': 'thorn whip',
  // SRD 5.2 short names (2026-11-07): the catalog holds the 2024 PHB
  // names; these SRD spellings resolve to them at the lookup boundary.
  'irresistible dance': "otto's irresistible dance",
  'magnificent mansion': "mordenkainen's magnificent mansion",
  'arcane sword': "mordenkainen's sword",
};

export function canonicalizeSpellName(name) {
  const key = String(name == null ? '' : name).trim().toLowerCase();
  if (!key) return key;
  return SPELL_NAME_ALIASES[key] || key;
}

// ---- Printed max-spell-level tables for the new casters ----
// Every table below is transcribed from its class digest / extract,
// not derived from another class's table:
//   Spellshot: Spell Level Limit 1st (levels 2-4), 2nd (5-8),
//     3rd (9-12), 4th (13-16), 5th (17-20); no spells known at 1st
//     (Spell Battery begins at 2nd), so level 1 max = 0.
//   Magus: slot table 2nd 2/-, 5th 4/2, 9th 4/3/2, 13th 4/3/3/1,
//     17th 4/3/3/3/1 (max 5th); level 1 has cantrips only, so 0.
//     6th-level society spells are NOT selectable: Magus has no
//     6th-level slot; 6th-level casting comes only via Greater
//     Spell Surge (18th, one chosen spell, no slot), which is a
//     single grant, not a selection — the service still rejects
//     6th-level picks and says so.
//   Blackguard: half-caster table identical in shape to the
//     paladin table (2nd 2/-, 5th 4/2, 9th 4/3/2, 13th 4/3/3/1,
//     17th 4/3/3/3/1); level 1 max = 0.
//   Scholar casting subclasses (Ritualist, Theologian): slots
//     from 3rd — 3rd-6th max 1st, 7th-12th max 2nd, 13th-18th max
//     3rd, 19th-20th max 4th.
//   Warden casting subclasses (Loreseeker, Soulblood Shaman):
//     printed table — 3rd-6th max 1st, 7th-12th max 2nd,
//     13th-18th max 3rd, 19th-20th max 4th.
function maxSpellLevelFromBands(level, bands) {
  for (const [maxLevel, minClassLevel, maxClassLevel] of bands) {
    if (level >= minClassLevel && level <= maxClassLevel) return maxLevel;
  }
  return 0;
}

const NEW_CLASS_MAX_SPELL_LEVEL = {
  spellshot: (level) => maxSpellLevelFromBands(level, [
    [1, 2, 4], [2, 5, 8], [3, 9, 12], [4, 13, 16], [5, 17, 20],
  ]),
  magus: (level) => maxSpellLevelFromBands(level, [
    [1, 2, 4], [2, 5, 8], [3, 9, 12], [4, 13, 16], [5, 17, 20],
  ]),
  blackguard: (level) => maxSpellLevelFromBands(level, [
    [1, 2, 4], [2, 5, 8], [3, 9, 12], [4, 13, 16], [5, 17, 20],
  ]),
  scholar: (level) => maxSpellLevelFromBands(level, [
    [1, 3, 6], [2, 7, 12], [3, 13, 18], [4, 19, 20],
  ]),
  warden: (level) => maxSpellLevelFromBands(level, [
    [1, 3, 6], [2, 7, 12], [3, 13, 18], [4, 19, 20],
  ]),
};

// Classes the engine knows that cast via getSpellSlots today.
const EXISTING_SLOT_CLASSES = new Set([
  'bard', 'cleric', 'druid', 'sorcerer', 'wizard',
  'paladin', 'ranger', 'warlock', 'artificer',
]);

// Known non-casters: every leveled spell is rejected; cantrips are
// grant-only (handled by the cantrip service, not this one).
const KNOWN_NONCASTERS = new Set([
  'barbarian', 'fighter', 'monk', 'rogue', 'pugilist',
]);

const KNOWN_CLASSES = new Set([
  ...EXISTING_SLOT_CLASSES, ...KNOWN_NONCASTERS,
  'spellshot', 'magus', 'blackguard', 'scholar', 'warden', 'keeper',
  'blood_hunter',
]);

function normalizeClassId(classId) {
  return String(classId || '').trim().toLowerCase();
}

function displayClassName(classId) {
  const key = normalizeClassId(classId);
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : '';
}

// Subclass names arrive in two spellings: the registry key
// ('arcane_order', 'eldritch_knight', 'profane_soul') that the
// creator stores, and the display name ('The Arcane Order',
// 'Eldritch Knight', 'Order of the Profane Soul'). Both must match
// the same entry, so normalize the way levelProgression's
// isCastingSubclass does: lowercase, strip a leading 'the ',
// collapse every non-alphanumeric run to one underscore. (Before
// this, underscores were kept, so every key-form multiword
// subclass silently failed to match — a magus with society
// 'arcane_order' got "no society given" and an Eldritch Knight got
// "no spell slots". Found by the Stage 6 follow-up endpoint test,
// 2026-11-07; fix-as-you-find-it.)
function normalizeSubclass(subclass) {
  return String(subclass || '').trim().toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function findMagusSociety(subclass) {
  const want = normalizeSubclass(subclass);
  if (!want) return null;
  return Object.keys(MAGUS_SOCIETY_SPELL_LISTS).find(
    (name) => normalizeSubclass(name) === want,
  ) || null;
}

function findWardenCasting(subclass) {
  const want = normalizeSubclass(subclass);
  if (!want) return null;
  return Object.keys(WARDEN_CASTING_SUBCLASSES).find(
    (name) => normalizeSubclass(name) === want,
  ) || null;
}

function findScholarCasting(subclass) {
  const want = normalizeSubclass(subclass);
  if (!want) return null;
  return Object.keys(SCHOLAR_CASTING_SUBCLASSES).find(
    (name) => normalizeSubclass(name) === want,
  ) || null;
}

// Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07): the two
// third-caster subclasses. Any-school exception picks for EK are at
// fighter levels 8, 14, 20 — the same levels as the warden arm's
// anySchoolAtLevels.
const ELDRITCH_KNIGHT_ANY_SCHOOL_LEVELS = [8, 14, 20];

function isEldritchKnight(subclass) {
  return normalizeSubclass(subclass) === 'eldritch_knight';
}

function isArcaneTrickster(subclass) {
  return normalizeSubclass(subclass) === 'arcane_trickster';
}

function maxFromSlotTable(slots) {
  if (!slots || typeof slots !== 'object') return 0;
  if (typeof slots.level === 'number') return slots.level; // warlock shape
  let max = 0;
  for (const [spellLevel, count] of Object.entries(slots)) {
    if (Number(count) > 0) max = Math.max(max, Number(spellLevel));
  }
  return max;
}

function fail(spellName, reason) {
  return { ok: false, reason, spell: spellName };
}

export function canLearnSpell({
  classId, level, spellName, subclass = null, catalogEntries = null,
} = {}) {
  const key = normalizeClassId(classId);
  const display = spellName == null ? '' : String(spellName).trim();
  const catalog = catalogEntries || SPELL_DATA_ENTRIES;

  if (!Number.isInteger(level) || level < 1 || level > 20) {
    return fail(display, `level ${level} is not a valid character level (1-20)`);
  }
  if (!key || !KNOWN_CLASSES.has(key)) {
    return fail(display, `unknown class "${classId}"`);
  }
  if (!display) return fail(display, 'no spell name given');
  const entry = catalog[canonicalizeSpellName(display)];
  if (!entry) {
    return fail(display, `"${display}" is not in the spell catalog`);
  }
  const spellLevel = Number(entry.level);

  // ---- Non-casters (including Scholar/Warden without a casting
  // subclass): no slots, no selections. Granted cantrips bypass
  // this service via the cantrip service; they do not pass here.
  // Fighter/rogue WITH a casting subclass (Eldritch Knight /
  // Arcane Trickster) are not non-casters — they fall through to
  // the third-caster arm below.
  if ((KNOWN_NONCASTERS.has(key)
    && !((key === 'fighter' && isEldritchKnight(subclass))
      || (key === 'rogue' && isArcaneTrickster(subclass))))
    || (key === 'scholar' && !findScholarCasting(subclass))
    || (key === 'warden' && !findWardenCasting(subclass))) {
    if (key === 'scholar' || key === 'warden') {
      return fail(display,
        `${displayClassName(key)} casts spells only through a casting subclass`
        + ` (${key === 'scholar' ? 'Ritualist or Theologian' : 'Loreseeker or Soulblood Shaman'})`
        + `; no casting subclass was given`);
    }
    if (spellLevel === 0) {
      return fail(display,
        `${displayClassName(key)} has no spell slots; cantrips for this class come only from grants, not selection`);
    }
    return fail(display, `${displayClassName(key)} has no spell slots`);
  }

  // ---- Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07) ----
  // Third-caster subclasses: Wizard list, Intelligence, casting from
  // 3rd level; max spell level from the third-caster slot table
  // (1st at 3rd-6th, 2nd at 7th-12th, 3rd at 13th-18th, 4th at 19th-20th).
  // EK levelled spells must be Abjuration or Evocation, EXCEPT the
  // any-school picks at fighter levels 8, 14, 20 — mirrored exactly
  // from the warden arm: those picks require learning history this
  // service does not take, so the service enforces the school
  // restriction strictly and names the exception in its rejection
  // reason. Consequence: a legitimate 8th/14th/20th-level any-school
  // pick is REFUSED by this automated check — it must be granted
  // through a path that knows the learning history (or by the DM);
  // the check fails closed rather than guessing. Cantrips: any
  // Wizard cantrip for both (Mage Hand is mandatory-in-count for AT,
  // enforced by the cantrip-count cap, not by a separate gate here).
  // AT has NO school restriction in 2024 (any Wizard spell).
  if ((key === 'fighter' && isEldritchKnight(subclass))
    || (key === 'rogue' && isArcaneTrickster(subclass))) {
    const subclassName = key === 'fighter' ? 'Eldritch Knight' : 'Arcane Trickster';
    if (level < 3) {
      return fail(display,
        `${subclassName} spellcasting begins at ${key} level 3; level ${level} has no spell slots`);
    }
    if (!entry.classes || !entry.classes.includes('Wizard')) {
      return fail(display,
        `"${display}" is not on the Wizard spell list (${subclassName} casts from the Wizard list)`);
    }
    const max = maxFromSlotTable(getSpellSlots(key, level, subclass));
    if (spellLevel > max) {
      return fail(display,
        `"${display}" is a ${spellLevel}-level spell, above the ${subclassName} max of ${max} at level ${level}`);
    }
    if (key === 'fighter' && spellLevel > 0
      && entry.school !== 'Abjuration' && entry.school !== 'Evocation') {
      return fail(display,
        `"${display}" is ${entry.school}, but Eldritch Knight leveled spells must be Abjuration or Evocation`
        + ` (spells learned at fighter levels ${ELDRITCH_KNIGHT_ANY_SCHOOL_LEVELS.join(', ')} may be any school, but those picks require learning history this service does not take)`);
    }
    return { ok: true, reason: null, spell: display };
  }

  // ---- Keeper: known to the engine but has no slot table in
  // getSpellSlots (its progression is KEEPER_PROGRESSION, not
  // slots). Fail closed rather than inventing a table.
  if (key === 'keeper') {
    return fail(display, 'Keeper has no slot table available to this service; max spell level cannot be verified');
  }

  // ---- Magus: society list is the membership proof (see header).
  if (key === 'magus') {
    const society = findMagusSociety(subclass);
    if (!society) {
      return fail(display,
        `Magus spells require an eldritch society (Arcane Order, Knights Stygian, Primordial Seal, Shadow Court, Sidereal Cabal, or Sylvan Circle); none was given`);
    }
    const list = MAGUS_SOCIETY_SPELL_LISTS[society];
    if (!list.some((name) => name.toLowerCase() === display.toLowerCase())) {
      return fail(display,
        `"${display}" is not on the ${society} spell list`);
    }
    const max = NEW_CLASS_MAX_SPELL_LEVEL.magus(level);
    if (spellLevel > max) {
      const extra = spellLevel === 6 && level >= 18
        ? ' (6th-level casting for a Magus comes only via Greater Spell Surge, a single granted spell — not a selection)'
        : '';
      return fail(display,
        `"${display}" is a ${spellLevel}${spellLevel === 0 ? '' : spellLevel === 1 ? 'st' : spellLevel === 2 ? 'nd' : spellLevel === 3 ? 'rd' : 'th'}-level spell, above the Magus max of ${max} at level ${level}${extra}`);
    }
    return { ok: true, reason: null, spell: display };
  }

  // ---- Warden / Scholar casting subclasses ----
  if (key === 'warden' || key === 'scholar') {
    const descriptor = key === 'warden'
      ? WARDEN_CASTING_SUBCLASSES[findWardenCasting(subclass)]
      : SCHOLAR_CASTING_SUBCLASSES[findScholarCasting(subclass)];
    const subclassName = key === 'warden'
      ? findWardenCasting(subclass) : findScholarCasting(subclass);
    const castingFrom = descriptor.castingFromLevel || 3;
    if (level < castingFrom) {
      return fail(display,
        `${subclassName} spellcasting begins at ${key} level ${castingFrom}; level ${level} has no spell slots`);
    }
    const max = NEW_CLASS_MAX_SPELL_LEVEL[key](level);
    if (spellLevel > max) {
      return fail(display,
        `"${display}" is a ${spellLevel}-level spell, above the ${subclassName} max of ${max} at ${key} level ${level}`);
    }
    if (key === 'warden') {
      // Cantrips: any base-list cantrip. Leveled: school restriction.
      if (!entry.classes || !entry.classes.includes(descriptor.baseClass)) {
        return fail(display,
          `"${display}" is not on the ${descriptor.baseClass} spell list (${subclassName} casts from the ${descriptor.baseClass} list)`);
      }
      if (spellLevel > 0 && !descriptor.schools.includes(entry.school)) {
        return fail(display,
          `"${display}" is ${entry.school}, but ${subclassName} leveled spells must be ${descriptor.schools.join(' or ')}`
          + ` (spells learned at ${key} levels ${descriptor.anySchoolAtLevels.join(', ')} may be any school, but those picks require learning history this service does not take)`);
      }
      return { ok: true, reason: null, spell: display };
    }
    // Scholar
    if (subclassName === 'Ritualist') {
      if (spellLevel === 0) return { ok: true, reason: null, spell: display };
      if (!entry.ritual) {
        return fail(display,
          `"${display}" has no ritual tag, but Ritualist leveled spells must have the ritual tag`
          + ` (spells learned at scholar levels ${descriptor.nonRitualAtLevels.join(', ')} need no ritual tag, but those picks require learning history this service does not take)`);
      }
      return { ok: true, reason: null, spell: display };
    }
    // Theologian: cleric list.
    if (!entry.classes || !entry.classes.includes('Cleric')) {
      return fail(display,
        `"${display}" is not on the Cleric spell list (Theologian casts from the Cleric list; Daily Devotion domain spells are subclass data, not checked here)`);
    }
    return { ok: true, reason: null, spell: display };
  }

  // ---- Blood Hunter, Order of the Profane Soul ----
  // Pact Magic (Blood Hunter 2024 Rules, 2026-11-06): Warlock list
  // only, from 3rd level; max spell level = the Pact Magic slot level
  // (1st at 3rd–6th, 2nd at 7th–12th, 3rd at 13th–18th, 4th at 19th–20th).
  // Other Orders never cast — fail closed with the reason, like
  // scholar/warden without a casting subclass above.
  // NOTE on the patron spells: Revealed/Unsealed Arcana grant their
  // patron spell as always-prepared (registry alwaysPreparedByPatron),
  // and grants bypass this service — several of those spells carry no
  // Warlock tag in the catalog (Scorching Ray, Fireball, Blur, Lesser
  // Restoration, Detect Thoughts, Slow, Revivify, Haste), exactly like
  // a Fiend warlock's patron spells. They are NOT pickable here; they
  // are granted. Only base-list Warlock spells are pickable.
  if (key === 'blood_hunter') {
    // The registry key is 'profane_soul'; the display name is
    // 'Order of the Profane Soul' — accept both spellings.
    const profaneNorm = normalizeSubclass(subclass);
    const profane = profaneNorm === 'order_of_the_profane_soul' || profaneNorm === 'profane_soul';
    if (!profane) {
      return fail(display,
        `Blood Hunter casts spells only through the Order of the Profane Soul; no casting subclass was given`);
    }
    if (level < 3) {
      return fail(display,
        `Order of the Profane Soul spellcasting begins at blood hunter level 3; level ${level} has no spell slots`);
    }
    if (!entry.classes || !entry.classes.includes('Warlock')) {
      return fail(display,
        `"${display}" is not on the Warlock spell list (Order of the Profane Soul casts from the Warlock list)`);
    }
    const max = maxFromSlotTable(getSpellSlots(key, level, subclass));
    if (spellLevel > max) {
      return fail(display,
        `"${display}" is a ${spellLevel}-level spell, above the Order of the Profane Soul max of ${max} at level ${level}`);
    }
    return { ok: true, reason: null, spell: display };
  }

  // ---- Spellshot / Blackguard / existing slot classes ----
  const className = displayClassName(key);
  if (!entry.classes || !entry.classes.includes(className)) {
    return fail(display,
      `"${display}" is not on the ${className} spell list`);
  }
  const max = key in NEW_CLASS_MAX_SPELL_LEVEL
    ? NEW_CLASS_MAX_SPELL_LEVEL[key](level)
    : maxFromSlotTable(getSpellSlots(key, level));
  if (spellLevel > max) {
    return fail(display,
      `"${display}" is a ${spellLevel}-level spell, above the ${className} max of ${max} at level ${level}`);
  }
  return { ok: true, reason: null, spell: display };
}

export function validateSpellSelection({
  classId, level, spells = [], subclass = null, catalogEntries = null,
} = {}) {
  const errors = [];
  for (const spellName of spells) {
    const result = canLearnSpell({
      classId, level, spellName, subclass, catalogEntries,
    });
    if (!result.ok) errors.push({ spell: spellName, reason: result.reason });
  }
  return { ok: errors.length === 0, errors };
}
