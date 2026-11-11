/**
 * Magus class service — base class ONLY (Sterling Vermin, 2016-2019,
 * 2014-era material, transcribed from the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/magus.md).
 *
 * NO conversion toward 2024 is applied here: see
 * ~/workspace/dnd-app-review/new-classes-staging/conversions-magus.md
 * for the conversion log (which is: none — as written, with reasons).
 *
 * Sources (digest only, never memory):
 * - Hit die 1d8; saves Constitution, Intelligence; light/medium
 *   armor, shields, simple/martial weapons; one skill from
 *   Acrobatics, Arcana, Athletics, History, Insight, Investigation,
 *   Perception.
 * - Eldritch Society chosen at 1st; society features at 1st, 3rd,
 *   7th, 14th. Society determines spellcasting ability and spell list.
 * - Spell slots (NOT pact magic), long-rest recovery, to 5th level
 *   only; 6th-level casting comes only via Greater Spell Surge.
 * - Cantrips known 2 (1st-3rd), 3 (4th-9th), 4 (10th-20th); these
 *   ARE the society Initiate grants (2 at 1st, +1 at 4th, +1 at
 *   10th) — recorded as printed, not double-counted.
 * - Spells known (1st level+): 2nd 3, 3rd 3, 4th 4, 5th 5, 6th 5,
 *   7th 6, 8th 7, 9th 8, 10th 8, 11th 9, 12th 10, 13th 11, 14th 11,
 *   15th 12, 16th 13, 17th 14, 18th 14, 19th 15, 20th 16.
 * - Esoteric Eye (1st): uses = 1 + spellcasting modifier / long rest.
 * - Mystic Mark (2nd): uses = spellcasting modifier / long rest
 *   (as printed — no minimum is stated, so none is applied here);
 *   Aegis (+1 AC, +2 at 9th, +3 at 13th) and Enspell (+1, +2 at
 *   9th, +3 at 13th) share the one pool.
 * - Mystic Meditation (6th): on a short rest, recover ALL expended
 *   Mystic Mark uses; must complete a long rest before using it
 *   again (tracked as mysticMeditationUsed).
 * - Spell Surge (10th): cast any known magus spell without a slot,
 *   as if using the highest available slot; 1/long rest.
 * - Greater Spell Surge (18th): choose one 6th-level spell from the
 *   society list; cast it once without a slot; 1/long rest.
 * - 20th: each Surge usable twice between long rests.
 * - Table rows for 5th and 17th list NO feature, as printed —
 *   carried as empty arrays in the fragment, never filled here.
 *
 * Society spell lists (451 entries across the 6 lists) are ANOTHER
 * agent's data file (planned server/data/newClassSpellLists.js).
 * This service references society KEYS only and never duplicates
 * a spell list. Spell names stored here (e.g. the Greater Spell
 * Surge pick) are therefore NOT validated against a list in v1;
 * list validation is a named follow-up for the coordinator once
 * that data file lands.
 *
 * State lives in class_resources_json.magus (migration 091 added
 * that column to characters AND companions), so no new migration.
 * Pure functions take state and return { state, ...result }; the
 * load/save helpers below parse/serialize the namespaced key
 * themselves — they NEVER go through
 * classFeatureService.parseClassResources, which strips every
 * top-level key except used/raging/bardicHeld and would silently
 * drop .magus on every load.
 *
 * Mirror limitation (honest scope): this mirror has no
 * server/database.js, server/utils/safeParse.js, or
 * server/services/markerPipeline.js, so this file is intentionally
 * dependency-free: loadMagusState/saveMagusState operate on the
 * parsed/string JSON blob, and NO marker handlers are registered
 * here. On merge to the live Mac the coordinator wires (a) DB
 * load/save around these two helpers and (b) marker registration
 * (MAGUS_* markers + schemas) following the artificerService.js
 * pattern, in restTimeService.js (applyMagusRest twin) and
 * dmPromptBuilder.js (magusPromptSection, class-gated, try/catch).
 * Claiming marker/rest wiring exists in this file would be false.
 */

export const MAGUS_SOCIETIES = [
  'arcane_order',
  'knights_stygian',
  'primordial_seal',
  'shadow_court',
  'sidereal_cabal',
  'sylvan_circle',
];

export const SOCIETY_NAMES = {
  arcane_order: 'The Arcane Order',
  knights_stygian: 'The Knights Stygian',
  primordial_seal: 'The Primordial Seal',
  shadow_court: 'The Shadow Court',
  sidereal_cabal: 'The Sidereal Cabal',
  sylvan_circle: 'The Sylvan Circle',
};

// Spellcasting ability by society (digest, Quick Build + Initiate).
export const SOCIETY_SPELLCASTING_ABILITY = {
  arcane_order: 'int',
  knights_stygian: 'cha',
  primordial_seal: 'cha',
  shadow_court: 'int',
  sidereal_cabal: 'int',
  sylvan_circle: 'wis',
};

// Spellcasting focus by society Initiate. Primordial Seal: NOT STATED
// in the digest — null here is UNRESOLVED, not "no focus".
export const SOCIETY_FOCUS = {
  arcane_order: 'arcane focus',
  knights_stygian: 'arcane focus',
  primordial_seal: null, // UNRESOLVED (digest §UNRESOLVED 2)
  shadow_court: 'arcane focus',
  sidereal_cabal: 'astrolabe or arcane focus',
  sylvan_circle: 'druidic focus',
};

export function spellcastingAbilityForSociety(societyKey) {
  return SOCIETY_SPELLCASTING_ABILITY[societyKey] || null;
}

// Normalize a society display name ('The Arcane Order') or key
// ('arcane_order') to its society key, or null when it matches none.
// Added at merge so prompt/rest/DC call sites can resolve the society
// from the stored subclass name without duplicating this logic.
export function societyKeyForName(name) {
  if (!name || typeof name !== 'string') return null;
  const norm = name.toLowerCase().trim().replace(/^the\s+/, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return SOCIETY_SPELLCASTING_ABILITY[norm] ? norm : null;
}

// Spell slots by magus level. Keys are spell levels, values counts —
// the levelProgression.js row shape. Level 1 has no slots: the
// Spellcasting feature is gained at 2nd. No 6th-level slot exists
// in the table at any level (see Greater Spell Surge).
export const MAGUS_SPELL_SLOTS = {
  1: {},
  2: { 1: 2 },
  3: { 1: 3 },
  4: { 1: 3 },
  5: { 1: 4, 2: 2 },
  6: { 1: 4, 2: 2 },
  7: { 1: 4, 2: 3 },
  8: { 1: 4, 2: 3 },
  9: { 1: 4, 2: 3, 3: 2 },
  10: { 1: 4, 2: 3, 3: 2 },
  11: { 1: 4, 2: 3, 3: 3 },
  12: { 1: 4, 2: 3, 3: 3 },
  13: { 1: 4, 2: 3, 3: 3, 4: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 2 },
  16: { 1: 4, 2: 3, 3: 3, 4: 2 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
};

export function spellSlotsForLevel(level) {
  const l = Math.min(20, Math.max(1, Math.trunc(level) || 1));
  return { ...(MAGUS_SPELL_SLOTS[l] || {}) };
}

export function highestSlotLevelForLevel(level) {
  const slots = spellSlotsForLevel(level);
  const levels = Object.keys(slots).map(Number).filter((n) => slots[n] > 0);
  return levels.length ? Math.max(...levels) : 0;
}

export const MAGUS_CANTRIPS_KNOWN =
  [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
export function cantripsKnownForLevel(level) {
  const l = Math.min(20, Math.max(1, Math.trunc(level) || 1));
  return MAGUS_CANTRIPS_KNOWN[l - 1];
}

// Spells known, 1st level+ only. Index 0 (1st level) is 0 because
// Spellcasting is gained at 2nd — not a printed "0 known" row, but
// the necessary consequence of the 2nd-level feature grant.
export const MAGUS_SPELLS_KNOWN =
  [0, 3, 3, 4, 5, 5, 6, 7, 8, 8, 9, 10, 11, 11, 12, 13, 14, 14, 15, 16];
export function spellsKnownForLevel(level) {
  const l = Math.min(20, Math.max(1, Math.trunc(level) || 1));
  return MAGUS_SPELLS_KNOWN[l - 1];
}

// --- Resource maxima (pure math) -----------------------------------------
export function mysticMarkUsesMax(spellMod) {
  // As printed: uses = spellcasting modifier / long rest. No
  // minimum is stated, so none is clamped in.
  return Math.trunc(spellMod) || 0;
}
export function esotericEyeUsesMax(spellMod) {
  return 1 + (Math.trunc(spellMod) || 0);
}
export function aegisEnspellBonus(level) {
  const l = Math.trunc(level) || 1;
  if (l >= 13) return 3;
  if (l >= 9) return 2;
  return 1;
}
export function spellSurgeUsesMax(level) {
  return (Math.trunc(level) || 1) >= 20 ? 2 : 1;
}
export function greaterSpellSurgeUsesMax(level) {
  return (Math.trunc(level) || 1) >= 20 ? 2 : 1;
}

// Eldritch Armament (choose one at 3rd). Stored as a choice, not a
// subclass feature — see the fragment's merge note. Dice caps are
// as printed: Archer 6d4, Marauder 6d6, Spell Sword 5d4.
export const ELDRITCH_ARMAMENTS = [
  'eldritch_archer',
  'mystic_marauder',
  'sorcerous_sentinel',
  'spell_sword',
];
export const ELDRITCH_ARMAMENT_NAMES = {
  eldritch_archer: 'Eldritch Archer',
  mystic_marauder: 'Mystic Marauder',
  sorcerous_sentinel: 'Sorcerous Sentinel',
  spell_sword: 'Spell Sword',
};

// --- State -----------------------------------------------------------------
export function defaultMagusState() {
  return {
    society: null,
    eldritchArmament: null,
    mysticMarkUsesLeft: 0,
    mysticMarkUsesMax: 0,
    esotericEyeUsesLeft: 0,
    esotericEyeUsesMax: 0,
    mysticMeditationUsed: false,
    spellSurgeUsesLeft: 0,
    greaterSpellSurgeUsesLeft: 0,
    greaterSpellSurgeSpell: null,
    aegisTargets: [],
    enspelledWeapons: [],
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultMagusState()));
}
function parseAllResources(raw) {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? raw : {};
}
// Own full parse on purpose (see header): never parseClassResources.
export function loadMagusState(rawClassResources) {
  const resources = parseAllResources(rawClassResources);
  return resources.magus
    ? { ...defaultMagusState(), ...resources.magus }
    : defaultMagusState();
}
// Returns the full resources object with .magus replaced; the
// caller JSON-stringifies it and UPDATEs class_resources_json.
export function saveMagusState(rawClassResources, magusState) {
  const resources = parseAllResources(rawClassResources);
  resources.magus = magusState;
  return resources;
}

function initUses(s, spellMod, level) {
  // Fresh state (max never initialized) starts full; an exhausted
  // state (max set, left 0) stays empty until a rest refills it.
  const mMax = mysticMarkUsesMax(spellMod);
  const eMax = esotericEyeUsesMax(spellMod);
  if (!s.mysticMarkUsesMax && mMax > 0) {
    s.mysticMarkUsesMax = mMax; s.mysticMarkUsesLeft = mMax;
  } else if (s.mysticMarkUsesLeft > mMax) {
    s.mysticMarkUsesLeft = mMax;
  }
  if (!s.esotericEyeUsesMax && eMax > 0) {
    s.esotericEyeUsesMax = eMax; s.esotericEyeUsesLeft = eMax;
  } else if (s.esotericEyeUsesLeft > eMax) {
    s.esotericEyeUsesLeft = eMax;
  }
  if (!s.spellSurgeUsesLeft && level >= 10) {
    s.spellSurgeUsesLeft = spellSurgeUsesMax(level);
  }
  if (!s.greaterSpellSurgeUsesLeft && level >= 18) {
    s.greaterSpellSurgeUsesLeft = greaterSpellSurgeUsesMax(level);
  }
  return s;
}

export function spendMysticMark(state, spellMod, level) {
  const s = initUses(clone(state), spellMod, level);
  if (s.mysticMarkUsesLeft <= 0) {
    return { state: s, success: false, reason: 'no_mystic_mark_uses_left' };
  }
  s.mysticMarkUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.mysticMarkUsesLeft };
}
export function useEsotericEye(state, spellMod, level) {
  const s = initUses(clone(state), spellMod, level);
  if (s.esotericEyeUsesLeft <= 0) {
    return { state: s, success: false, reason: 'no_esoteric_eye_uses_left' };
  }
  s.esotericEyeUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.esotericEyeUsesLeft };
}
export function useSpellSurge(state, level) {
  const s = initUses(clone(state), 0, level);
  if ((Math.trunc(level) || 1) < 10) {
    return { state: s, success: false, reason: 'level_too_low' };
  }
  if (s.spellSurgeUsesLeft <= 0) {
    return { state: s, success: false, reason: 'no_spell_surge_uses_left' };
  }
  s.spellSurgeUsesLeft -= 1;
  return {
    state: s, success: true, usesLeft: s.spellSurgeUsesLeft,
    castAsSlotLevel: highestSlotLevelForLevel(level),
  };
}
export function setGreaterSpellSurgeSpell(state, spellName) {
  const s = clone(state);
  if (!spellName || !String(spellName).trim()) {
    return { state: s, success: false, reason: 'spell_name_required' };
  }
  // NOT validated against the society list in v1: the list file is
  // another agent's deliverable (see header). The stored name is
  // the record; list validation is a named follow-up.
  s.greaterSpellSurgeSpell = String(spellName).trim();
  return { state: s, success: true, spell: s.greaterSpellSurgeSpell };
}
export function useGreaterSpellSurge(state, level) {
  const s = initUses(clone(state), 0, level);
  if ((Math.trunc(level) || 1) < 18) {
    return { state: s, success: false, reason: 'level_too_low' };
  }
  if (!s.greaterSpellSurgeSpell) {
    return { state: s, success: false, reason: 'greater_spell_surge_spell_not_chosen' };
  }
  if (s.greaterSpellSurgeUsesLeft <= 0) {
    return { state: s, success: false, reason: 'no_greater_spell_surge_uses_left' };
  }
  s.greaterSpellSurgeUsesLeft -= 1;
  return {
    state: s, success: true, usesLeft: s.greaterSpellSurgeUsesLeft,
    spell: s.greaterSpellSurgeSpell,
  };
}

// --- Rests -----------------------------------------------------------------
export function onLongRest(state, { level, spellMod }) {
  const s = clone(state);
  const mMax = mysticMarkUsesMax(spellMod);
  const eMax = esotericEyeUsesMax(spellMod);
  s.mysticMarkUsesMax = mMax; s.mysticMarkUsesLeft = mMax;
  s.esotericEyeUsesMax = eMax; s.esotericEyeUsesLeft = eMax;
  s.mysticMeditationUsed = false;
  if ((Math.trunc(level) || 1) >= 10) {
    s.spellSurgeUsesLeft = spellSurgeUsesMax(level);
  }
  if ((Math.trunc(level) || 1) >= 18) {
    s.greaterSpellSurgeUsesLeft = greaterSpellSurgeUsesMax(level);
  }
  return { state: s, success: true };
}
export function onShortRest(state, { level, spellMod }) {
  const s = clone(state);
  // Mystic Meditation (6th): recover ALL Mystic Mark uses, but only
  // once between long rests.
  if ((Math.trunc(level) || 1) >= 6 && !s.mysticMeditationUsed) {
    const mMax = mysticMarkUsesMax(spellMod);
    s.mysticMarkUsesMax = mMax; s.mysticMarkUsesLeft = mMax;
    s.mysticMeditationUsed = true;
    return { state: s, success: true, mysticMarksRecovered: true };
  }
  return { state: s, success: true, mysticMarksRecovered: false };
}

// --- DM prompt section (seam for dmPromptBuilder) ---------------------------
export function magusPromptSection(state, { level, spellMod, society, name }) {
  const s = state || defaultMagusState();
  const soc = society || s.society;
  const ability = spellcastingAbilityForSociety(soc);
  const lines = [`Magus (level ${level}${soc ? `, ${SOCIETY_NAMES[soc] || soc}` : ''}${ability ? `, spellcasting ${ability.toUpperCase()}` : ''}):`];
  const mMax = s.mysticMarkUsesMax || mysticMarkUsesMax(spellMod);
  const mLeft = s.mysticMarkUsesMax ? s.mysticMarkUsesLeft : mMax;
  const eMax = s.esotericEyeUsesMax || esotericEyeUsesMax(spellMod);
  const eLeft = s.esotericEyeUsesMax ? s.esotericEyeUsesLeft : eMax;
  lines.push(`- Mystic Mark uses left: ${mLeft}/${mMax} (Aegis/Enspell bonus +${aegisEnspellBonus(level)}; recoverable on a short rest via Mystic Meditation, once between long rests)`);
  lines.push(`- Esoteric Eye uses left: ${eLeft}/${eMax}`);
  if ((Math.trunc(level) || 1) >= 10) {
    lines.push(`- Spell Surge uses left: ${s.spellSurgeUsesLeft}/${spellSurgeUsesMax(level)} (cast a known magus spell without a slot, as a ${highestSlotLevelForLevel(level)}th-level slot)`);
  }
  if ((Math.trunc(level) || 1) >= 18) {
    lines.push(`- Greater Spell Surge uses left: ${s.greaterSpellSurgeUsesLeft}/${greaterSpellSurgeUsesMax(level)} (spell: ${s.greaterSpellSurgeSpell || 'NOT YET CHOSEN — a 6th-level society spell must be chosen'})`);
  }
  if (soc) {
    lines.push(`- Society spell list key: ${soc} (full list in the companion newClassSpellLists data file, not duplicated here)`);
    if (SOCIETY_FOCUS[soc] === null) {
      lines.push(`- Spellcasting focus: UNRESOLVED for the Primordial Seal (not stated in the source)`);
    }
  }
  if (s.eldritchArmament) {
    lines.push(`- Eldritch Armament: ${ELDRITCH_ARMAMENT_NAMES[s.eldritchArmament] || s.eldritchArmament}`);
  }
  return lines.join('\n');
}

// --- Multiclass grant (digest: proficiencies gained) ------------------------
// No skill or tool grant is stated for the magus, so none is listed.
// (2026-11-08: multiclass prerequisites removed — Zach: all classes
// multiclass freely. The per-society ability map and the check
// function are deleted with the table; SOCIETY_SPELLCASTING_ABILITY
// below is the casting ability per society, a different thing, and
// it stays.)
export const MULTICLASS_GRANT = {
  hitDie: 8,
  armor: ['light', 'medium', 'shields'],
  weapons: ['simple', 'martial'],
};

export default {
  MAGUS_SOCIETIES, SOCIETY_NAMES, SOCIETY_SPELLCASTING_ABILITY, SOCIETY_FOCUS,
  spellcastingAbilityForSociety, societyKeyForName, MAGUS_SPELL_SLOTS, spellSlotsForLevel,
  highestSlotLevelForLevel, MAGUS_CANTRIPS_KNOWN, cantripsKnownForLevel,
  MAGUS_SPELLS_KNOWN, spellsKnownForLevel, mysticMarkUsesMax,
  esotericEyeUsesMax, aegisEnspellBonus, spellSurgeUsesMax,
  greaterSpellSurgeUsesMax, ELDRITCH_ARMAMENTS, ELDRITCH_ARMAMENT_NAMES,
  defaultMagusState, loadMagusState, saveMagusState, spendMysticMark,
  useEsotericEye, useSpellSurge, setGreaterSpellSurgeSpell,
  useGreaterSpellSurge, onLongRest, onShortRest, magusPromptSection,
  MULTICLASS_GRANT,
};
