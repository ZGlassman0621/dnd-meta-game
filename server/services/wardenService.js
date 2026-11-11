/**
 * Warden class service — base class ONLY (Complete Warden, Mage Hand
 * Press 2019, 2014-era). No conversion is applied here; see
 * conversions-warden.md for the conversion audit (none applied, with
 * reasons and candidates held for ruling).
 *
 * Sources: ONLY the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/warden.md
 * (transcribed from the extract, no conversion). Every number below
 * comes from that digest. Nothing is filled from memory.
 *
 * Deliberate non-inventions:
 * - BASE CLASS HAS NO SPELLCASTING. Only Loreseeker (Int, wizard
 *   list) and Soulblood Shaman (Wis, druid list) cast. The base
 *   cantrips/spells functions return 0 / null for the base class.
 * - CASTING-SUBCLASS INTERMEDIATE ROWS ARE NOT PRINTED in the
 *   digest: only the endpoints are (3rd: 3 known, 2 first-level
 *   slots; 20th: 13 known, slots 4/3/3/1, max 4th level; cantrips
 *   2 at 3rd, 3 from 10th). spellsKnownForCastingSubclass() and
 *   spellSlotsForCastingSubclass() return null for levels whose
 *   rows the extract omits, rather than interpolating numbers.
 *   The list data file for chosen spells is another agent's job;
 *   it is referenced as planned server/data/newClassSpellLists.js
 *   and NOT duplicated here.
 * - NO multiclass grant: no multiclass section is printed, so
 *   MULTICLASS_GRANT is null (UNRESOLVED, do not invent numbers).
 * - NO marker handlers: the digest defines no marker names, so
 *   none are registered here. The pure useFontOfLife / useUndying /
 *   battle-die functions below are the DM call sites.
 * - Alternate core-feature sets (Champion, Hunt, Maneater, Paragon,
 *   Penumbral) REPLACE Grasp/Mark/Resolve plus their improvements;
 *   they are modeled as data (ALTERNATE_SETS) plus prompt text, not
 *   as extra pools — the digest gives them no pools except Hunt
 *   resistance points and Paragon healing pool, which ARE modeled
 *   (see below).
 *
 * State lives in class_resources_json.warden (migration 091 column,
 * both tables), parsed with its OWN full parse — never through
 * classFeatureService.parseClassResources, which strips every
 * top-level key except used/raging/bardicHeld (see SURVEY §2, the
 * Artificer trap). The raw-parse fix in resetResourcesForRest
 * already preserves unknown top-level keys through rests.
 *
 * Pure functions take state and return { state, ...result }; they
 * never mutate the caller's state. DB helpers load ../database.js
 * by dynamic import (the repo mirror used for this build does not
 * contain database.js; on the live Mac it resolves to the real
 * module). loadWardenState / serializeWardenState (raw blob, no
 * DB) are the testable seam.
 */

function clampLevel(level) {
  return Math.min(20, Math.max(1, Math.trunc(level) || 1));
}

// --- Base-class option lists (digest-verbatim names) ---------------------------
export const FIGHTING_STYLES = ['Crippling', 'Great Weapon Fighting', 'Protection', 'Titan Fighting'];
export const SENTINELS_STAND_OPTIONS = ['Armor Proficiency', 'Primal Toughness', 'Stalwart Spirit'];
export const SENTINELS_STEP_OPTIONS = ['Earthstrength', 'Thundering Charge', 'Wildblood'];
export const SENTINELS_SOUL_OPTIONS = ['Ageless Guardian', 'Eyes of the Mountain', 'Impenetrable Mind'];
// Alternate core-feature sets, chosen at 1st level. Each replaces
// Warden's Grasp, Warden's Mark, and Warden's Resolve plus their
// improvements (11th Mark improvement applies as normal for
// Champion; see digest).
export const ALTERNATE_SETS = [
  { key: 'champion', name: 'Warden Champion', replaces: ['Warden\'s Grasp', 'Warden\'s Mark', 'Warden\'s Resolve'],
    features: { 1: 'Champion\'s Challenge', 2: 'Champion\'s Mark', 3: 'Champion\'s Fortitude' } },
  { key: 'hunt', name: 'Warden of the Hunt', replaces: ['Warden\'s Grasp', 'Warden\'s Mark', 'Warden\'s Resolve'],
    features: { 1: 'Hunter\'s Snare', 2: 'Hunter\'s Mark', 3: 'Hunter\'s Resistance' } },
  { key: 'maneater', name: 'Maneater Warden', replaces: ['Warden\'s Grasp', 'Warden\'s Mark', 'Warden\'s Resolve'],
    features: { 1: 'Maneater\'s Howl', 2: 'Maneater\'s Mark', 3: 'Maneater\'s Bloodlust' } },
  { key: 'paragon', name: 'Warden Paragon', replaces: ['Warden\'s Grasp', 'Warden\'s Mark', 'Warden\'s Resolve'],
    features: { 1: 'Paragon\'s Rescue', 2: 'Paragon\'s Twin Marks', 3: 'Paragon\'s Font' } },
  { key: 'penumbral', name: 'Warden Penumbral', replaces: ['Warden\'s Grasp', 'Warden\'s Mark', 'Warden\'s Resolve'],
    features: { 1: 'Grasping Shadows', 2: 'Mark of Shadows', 3: 'Form of Shadows' } },
];
export function alternateSetForKey(key) {
  return ALTERNATE_SETS.find((s) => s.key === String(key || '').toLowerCase()) || null;
}
// Base class: no spellcasting, no cantrips.
export function baseCastsSpells() { return false; }
export function baseCantripsKnownForLevel(level) { void level; return 0; }
// Warden's Grasp range: 5 feet, 10 feet from 14th (base set only;
// alternate sets carry their own ranges in the digest).
export function graspRangeForLevel(level, alternateSetKey) {
  if (alternateSetKey) return null; // Alternate sets define their own ranges; see digest.
  return clampLevel(level) >= 14 ? 10 : 5;
}
// Hunter's Resistance points (Hunt alternate set): 2 x proficiency bonus.
export function hunterResistancePoints(level) {
  const l = clampLevel(level);
  return 2 * (2 + Math.floor((l - 1) / 4));
}
// Paragon's Font healing pool (Paragon alternate set): level x 5, replenishes on long rest.
export function paragonFontPoolForLevel(level) {
  return clampLevel(level) * 5;
}

// --- Casting subclasses (Loreseeker / Soulblood Shaman only) --------------------
// Spellcasting subclasses for the levelProgression fragment's
// SPELLCASTING_SUBCLASSES entry (merge note there explains the
// 'third'-only consultation gap in getMulticlassSpellSlots).
export const SPELLCASTING_SUBCLASSES_WARDEN = ['Loreseeker', 'Soulblood Shaman'];
export const CASTING_SUBCLASS_ABILITY = { loreseeker: 'int', soulblood_shaman: 'wis' };
export const CASTING_SUBCLASS_LIST = { loreseeker: 'wizard', soulblood_shaman: 'druid' };
export const CASTING_SUBCLASS_SCHOOLS = {
  loreseeker: ['Abjuration', 'Evocation'],
  soulblood_shaman: ['Evocation', 'Transmutation'],
};
// Cantrips: 2 at 3rd, +1 at 10th (3 total). 0 before 3rd (no subclass yet).
export function cantripsKnownForCastingSubclass(level) {
  const l = clampLevel(level);
  if (l < 3) return 0;
  return l >= 10 ? 3 : 2;
}
// Spells known / slots: ONLY the printed endpoints. Intermediate
// rows are omitted in the extract layout (digest UNRESOLVED 3), so
// this function returns null for unprinted levels instead of
// interpolating. Callers must treat null as "not printed — do not
// use a guessed number."
export const CASTING_SUBCLASS_ENDPOINTS = {
  spellsKnown: { 3: 3, 20: 13 },
  spellSlots: { 3: { 1: 2 }, 20: { 1: 4, 2: 3, 3: 3, 4: 1 } },
  maxSpellLevel: 4,
};
export function spellsKnownForCastingSubclass(level) {
  const l = clampLevel(level);
  if (l < 3) return 0;
  return CASTING_SUBCLASS_ENDPOINTS.spellsKnown[l] ?? null;
}
export function spellSlotsForCastingSubclass(level) {
  const l = clampLevel(level);
  if (l < 3) return {};
  return CASTING_SUBCLASS_ENDPOINTS.spellSlots[l] ?? null;
}
export function castingSubclassSaveDc(proficiencyBonus, abilityMod) {
  return 8 + (proficiencyBonus || 0) + (abilityMod || 0);
}

// --- Grey Watchman battle dice (only Grey Watchman has this pool) ----------------
// 4 d8 -> 5 at 6th -> 6 at 13th; d10 at 13th, d12 at 20th; regain on short/long rest.
export function battleDiceMaxForLevel(level) {
  const l = clampLevel(level);
  if (l < 6) return 4;
  if (l < 13) return 5;
  return 6;
}
export function battleDieForLevel(level) {
  const l = clampLevel(level);
  if (l >= 20) return 'd12';
  if (l >= 13) return 'd10';
  return 'd8';
}
export function battleManeuversKnownForLevel(level) {
  const l = clampLevel(level);
  if (l < 3) return 0;
  if (l < 6) return 3;
  if (l < 13) return 5;
  return 7;
}
export const GREY_WATCHMAN_MANEUVERS = [
  'Avenging Strike', 'Bull\'s Charge', 'Bulwark', 'Cleave', 'Disarming Strike',
  'Heelcutter', 'Reckless Assault', 'Skull Bash', 'Staggering Blow',
];

// --- State ------------------------------------------------------------------------
export function defaultWardenState() {
  return {
    fontOfLifeUsed: false,
    fontDailyHealUsed: false,
    undyingUsed: false,
    battleDiceLeft: 0,
    battleDiceMax: 0,
    battleDie: 'd8',
    maneuversKnown: [],
    alternateSet: null,
    fightingStyle: null,
    sentinelsStand: null,
    sentinelsStep: null,
    sentinelsSoul: null,
    paragonFontLeft: 0,
    hunterResistanceLeft: 0,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultWardenState()));
}

// --- Font of Life (4th; 1/short-or-long rest; 15th daily improvement) ---------------
export function useFontOfLife(state, level, { dailyHeal = false } = {}) {
  const s = clone(state);
  if (clampLevel(level) < 4) return { state: s, success: false, reason: 'font_of_life_not_yet_gained' };
  if (s.fontOfLifeUsed) return { state: s, success: false, reason: 'font_of_life_already_used_this_rest' };
  // 15th improvement: once per DAY, using Font of Life also restores
  // hp to half maximum if lower. The daily flag is separate from the
  // per-rest flag, so a second use after a short rest the same day
  // does not re-grant the heal.
  let healsToHalfMax = false;
  if (dailyHeal) {
    if (clampLevel(level) < 15) return { state: s, success: false, reason: 'font_daily_heal_requires_level_15' };
    if (s.fontDailyHealUsed) return { state: s, success: false, reason: 'font_daily_heal_already_used_today' };
    s.fontDailyHealUsed = true;
    healsToHalfMax = true;
  }
  s.fontOfLifeUsed = true;
  return { state: s, success: true, healsToHalfMax };
}
// --- Undying (9th; 1/long rest; not when killed outright) ---------------------------
export function useUndying(state, level, { killedOutright = false } = {}) {
  const s = clone(state);
  if (clampLevel(level) < 9) return { state: s, success: false, reason: 'undying_not_yet_gained' };
  if (killedOutright) return { state: s, success: false, reason: 'killed_outright' };
  if (s.undyingUsed) return { state: s, success: false, reason: 'undying_already_used' };
  s.undyingUsed = true;
  return { state: s, success: true, hp: 1 };
}
// --- Battle dice ----------------------------------------------------------------------
export function spendBattleDie(state, level) {
  const s = clone(state);
  if (!s.battleDiceMax) { s.battleDiceMax = battleDiceMaxForLevel(level); s.battleDiceLeft = s.battleDiceMax; s.battleDie = battleDieForLevel(level); }
  if ((s.battleDiceLeft || 0) <= 0) return { state: s, success: false, reason: 'no_battle_dice_left' };
  s.battleDiceLeft -= 1;
  return { state: s, success: true, battleDiceLeft: s.battleDiceLeft, die: battleDieForLevel(level) };
}
export function learnManeuver(state, level, maneuverName) {
  const s = clone(state);
  if (!GREY_WATCHMAN_MANEUVERS.includes(maneuverName)) return { state: s, success: false, reason: 'unknown_maneuver' };
  if (s.maneuversKnown.includes(maneuverName)) return { state: s, success: false, reason: 'maneuver_already_known' };
  if (s.maneuversKnown.length >= battleManeuversKnownForLevel(level)) {
    return { state: s, success: false, reason: 'maneuvers_known_cap' };
  }
  s.maneuversKnown.push(maneuverName);
  return { state: s, success: true, maneuver: maneuverName };
}

// --- Rests -------------------------------------------------------------------------------
// Font of Life: 1/short-or-long rest. Undying: 1/long rest.
// Battle dice (Grey Watchman): regain on short/long rest.
// Paragon Font pool: replenishes on long rest only.
export function onShortRest(state, { level, subclass }) {
  const s = clone(state);
  s.fontOfLifeUsed = false;
  if (String(subclass || '').toLowerCase() === 'grey watchman') {
    s.battleDiceMax = battleDiceMaxForLevel(level);
    s.battleDiceLeft = s.battleDiceMax;
    s.battleDie = battleDieForLevel(level);
  }
  return { state: s, success: true };
}
export function onLongRest(state, { level, subclass, alternateSet }) {
  const s = clone(state);
  s.fontOfLifeUsed = false;
  s.fontDailyHealUsed = false;
  s.undyingUsed = false;
  if (String(subclass || '').toLowerCase() === 'grey watchman') {
    s.battleDiceMax = battleDiceMaxForLevel(level);
    s.battleDiceLeft = s.battleDiceMax;
    s.battleDie = battleDieForLevel(level);
  }
  if (String(alternateSet || '').toLowerCase() === 'paragon') {
    s.paragonFontLeft = paragonFontPoolForLevel(level);
  }
  return { state: s, success: true };
}

// --- DM prompt section (seam for dmPromptBuilder) -----------------------------------------
export function wardenPromptSection(state, { level, subclass, alternateSet, name }) {
  const s = state || defaultWardenState();
  const lines = [`Warden (level ${level}${subclass ? `, ${subclass}` : ''}${alternateSet ? `, alternate set: ${alternateSet}` : ''}):`];
  lines.push(`- Spellcasting (base class): NONE — only Loreseeker and Soulblood Shaman cast; do not grant the base Warden spells or cantrips`);
  lines.push(`- Font of Life: ${s.fontOfLifeUsed ? 'USED this rest' : 'available'} (1/short-or-long rest; action, ends one disease or one listed condition even if it would prevent use)`);
  lines.push(`- Undying: ${s.undyingUsed ? 'USED' : 'available'} (1/long rest; at 0 hp and not killed outright, drop to 1 hp instead)`);
  if (String(subclass || '').toLowerCase() === 'grey watchman') {
    const max = s.battleDiceMax || battleDiceMaxForLevel(level);
    const left = s.battleDiceMax ? s.battleDiceLeft : max;
    lines.push(`- Battle dice: ${left}/${max} ${battleDieForLevel(level)} (regain on short/long rest; one maneuver per attack; maneuvers: ${(s.maneuversKnown || []).join(', ') || 'none recorded'})`);
  }
  if (String(alternateSet || '').toLowerCase() === 'paragon') {
    lines.push(`- Paragon's Font pool: ${s.paragonFontLeft ?? paragonFontPoolForLevel(level)} hp left (pool ${paragonFontPoolForLevel(level)}, replenishes on long rest)`);
  }
  if (name) lines[0] = `Warden ${name} (level ${level}${subclass ? `, ${subclass}` : ''}${alternateSet ? `, alternate set: ${alternateSet}` : ''}):`;
  return lines.join('\n');
}

// --- Multiclass grant: NONE PRINTED (UNRESOLVED) ------------------------------------------
export const MULTICLASS_GRANT = null;

// --- State load/save (own full parse; never parseClassResources) ---------------------------
function parseAllResources(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}
export function loadWardenState(rawClassResourcesJson) {
  const resources = parseAllResources(rawClassResourcesJson);
  return resources.warden ? { ...defaultWardenState(), ...resources.warden } : defaultWardenState();
}
export function serializeWardenState(rawClassResourcesJson, wardenState) {
  const resources = parseAllResources(rawClassResourcesJson);
  resources.warden = wardenState;
  return JSON.stringify(resources);
}
export async function loadWardenStateFromDb(kind, id) {
  const { dbGet } = await import('../database.js');
  const table = kind === 'companion' ? 'companions' : 'characters';
  const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  if (!row) return defaultWardenState();
  return loadWardenState(row.class_resources_json);
}
export async function saveWardenStateToDb(kind, id, wardenState) {
  const { dbGet, dbRun } = await import('../database.js');
  const table = kind === 'companion' ? 'companions' : 'characters';
  const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  const json = serializeWardenState(row ? row.class_resources_json : null, wardenState);
  await dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [json, id]);
  return true;
}

export default {
  FIGHTING_STYLES, SENTINELS_STAND_OPTIONS, SENTINELS_STEP_OPTIONS,
  SENTINELS_SOUL_OPTIONS, ALTERNATE_SETS, alternateSetForKey,
  baseCastsSpells, baseCantripsKnownForLevel, graspRangeForLevel,
  hunterResistancePoints, paragonFontPoolForLevel,
  SPELLCASTING_SUBCLASSES_WARDEN, CASTING_SUBCLASS_ABILITY,
  CASTING_SUBCLASS_LIST, CASTING_SUBCLASS_SCHOOLS,
  cantripsKnownForCastingSubclass, CASTING_SUBCLASS_ENDPOINTS,
  spellsKnownForCastingSubclass, spellSlotsForCastingSubclass,
  castingSubclassSaveDc, battleDiceMaxForLevel, battleDieForLevel,
  battleManeuversKnownForLevel, GREY_WATCHMAN_MANEUVERS,
  defaultWardenState, useFontOfLife, useUndying, spendBattleDie,
  learnManeuver, onShortRest, onLongRest, wardenPromptSection,
  MULTICLASS_GRANT, loadWardenState, serializeWardenState,
  loadWardenStateFromDb, saveWardenStateToDb,
};
