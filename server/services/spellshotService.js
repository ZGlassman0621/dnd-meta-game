/**
 * Spellshot class service — base class ONLY (Spellshot v0.5 homebrew,
 * signed "~ LucaWhiteWing"; no publisher or edition claim is printed).
 *
 * Sources: ONLY the verified digest at
 * ~/workspace/dnd-app-review/new-classes-staging/digests/spellshot.md
 * (transcribed from the extract, no conversion). Every number below
 * comes from that digest. Nothing is filled from memory.
 *
 * Deliberate non-inventions (see also conversions-spellshot.md):
 * - NO cantrips: the digest prints no cantrip progression and no
 *   feature grants cantrips. cantripsKnownForLevel() returns 0 at
 *   every level, flagged — it is NOT a claim that the author
 *   intended zero cantrips (digest UNRESOLVED item 2).
 * - NO "Arcane Tinkerer" Drive: the v0.5 changelog mentions one but
 *   the body text has no such Drive. Only the 4 body Drives are
 *   wired (see server/data/subclasses/spellshot.js).
 * - NO multiclass grant: no multiclass section is printed, so
 *   MULTICLASS_GRANT is null (UNRESOLVED, do not invent numbers).
 * - NO marker handlers: the digest defines no marker names, so
 *   none are registered here. Inventing marker names would be an
 *   invented mechanic. The pure spend/gain functions below are the
 *   DM call sites; the coordinator may register markers later
 *   once names are agreed.
 * - Improved / Mastered firearm tables: the digest confirms those
 *   tiers exist (11th / 17th) and that they raise damage/magazine/
 *   range/cost, but does NOT transcribe their rows. Only the Normal
 *   table is wired (NORMAL_FIREARMS). Improved/Mastered rows are
 *   NOT guessed here.
 *
 * State lives in class_resources_json.spellshot (migration 091
 * column, both tables), parsed with its OWN full parse — never
 * through classFeatureService.parseClassResources, which strips
 * every top-level key except used/raging/bardicHeld (see SURVEY
 * §2, the Artificer trap). The raw-parse fix in
 * resetResourcesForRest already preserves unknown top-level keys
 * through rests, so no classFeatureService edit is needed.
 *
 * Pure functions take state and return { state, ...result }; they
 * never mutate the caller's state. DB helpers are async and load
 * ../database.js by dynamic import: the repo mirror used for this
 * build does not contain database.js, so a static import would
 * break every test that imports this module; on the live Mac the
 * dynamic import resolves to the real module. The pure
 * loadSpellshotState / serializeSpellshotState helpers (which take
 * a raw blob and need no DB) are the testable seam.
 */

// --- Progression tables (digest-verbatim) ---------------------------------
// Dynamo limit by level (20th = Unlimited, represented as Infinity).
export const DYNAMO_LIMIT = [
  3, 4, 5, 6, 8, 9, 10, 11, 13, 14,
  15, 16, 18, 19, 20, 21, 23, 24, 25, Infinity,
];
// Spells known by level. No spells known at 1st (Spell Battery
// begins at 2nd). Digest: 2nd 2, 3rd 3, 4th 4, 5th 4, 6th 4, 7th 5,
// 8th 6, 9th 6, 10th 7, 11th 8, 12th 8, 13th 9, 14th 10, 15th 10,
// 16th 11, 17th 11, 18th 11, 19th 12, 20th 13.
export const SPELLS_KNOWN_SPELLSHOT = [
  0, 2, 3, 4, 4, 4, 5, 6, 6, 7,
  8, 8, 9, 10, 10, 11, 11, 11, 12, 13,
];
// Spell Level Limit by level. 0 at 1st = no spells yet; 1st-level
// spells from 2nd, 2nd from 5th, 3rd from 9th, 4th from 13th,
// 5th from 17th.
export const SPELL_LEVEL_LIMIT = [
  0, 1, 1, 1, 2, 2, 2, 2, 3, 3,
  3, 3, 4, 4, 4, 4, 5, 5, 5, 5,
];
// Cantrips known: NO progression printed. Zeros, flagged (see header).
export const CANTRIPS_KNOWN_SPELLSHOT = new Array(20).fill(0);
// Skill Shots known: 3 at 1st, +1 at 5th, 9th, 13th, 17th (7 total).
export const SKILL_SHOTS_KNOWN = [
  3, 3, 3, 3, 4, 4, 4, 4, 5, 5,
  5, 5, 6, 6, 6, 6, 7, 7, 7, 7,
];
// Dynamo cost by spell level (Spell Battery).
export const DYNAMO_COST = { 1: 4, 2: 6, 3: 10, 4: 12, 5: 14 };
// Worthy-creature CR by proficiency bonus (Dynamo gain).
export const WORTHY_CR_BY_PB = { 2: '1/8', 3: '1/4', 4: '1/2', 5: '1', 6: '2' };
// Special bullets (Arcane Ammunitions): max 5 per long rest.
export const SPECIAL_BULLETS_PER_LONG_REST = 5;

function clampLevel(level) {
  return Math.min(20, Math.max(1, Math.trunc(level) || 1));
}
export function proficiencyBonusForLevel(level) {
  const l = clampLevel(level);
  return 2 + Math.floor((l - 1) / 4);
}
export function dynamoLimitForLevel(level) {
  return DYNAMO_LIMIT[clampLevel(level) - 1];
}
export function isDynamoUnlimited(level) {
  return dynamoLimitForLevel(level) === Infinity;
}
export function spellsKnownForLevel(level) {
  return SPELLS_KNOWN_SPELLSHOT[clampLevel(level) - 1];
}
export function spellLevelLimitForLevel(level) {
  return SPELL_LEVEL_LIMIT[clampLevel(level) - 1];
}
export function cantripsKnownForLevel(level) {
  void level;
  return 0; // FLAGGED: no cantrip progression printed (digest UNRESOLVED 2).
}
export function skillShotsKnownForLevel(level) {
  return SKILL_SHOTS_KNOWN[clampLevel(level) - 1];
}
export function dynamoCostForSpellLevel(spellLevel) {
  return DYNAMO_COST[spellLevel] ?? null;
}
export function worthyCrForLevel(level) {
  return WORTHY_CR_BY_PB[proficiencyBonusForLevel(level)] ?? null;
}
// Arsenal size = proficiency bonus in number (Explosive Arsenal).
export function arsenalSizeForLevel(level) {
  return proficiencyBonusForLevel(level);
}
// Spellcasting ability: Intelligence. DC / attack as printed.
export function dynamoSaveDc(proficiencyBonus, intMod) {
  return 8 + (proficiencyBonus || 0) + (intMod || 0);
}
export function dynamoAttackMod(proficiencyBonus, intMod) {
  return (proficiencyBonus || 0) + (intMod || 0);
}

// --- Firearms (Normal tier only — Improved/Mastered rows NOT transcribed) --
export const NORMAL_FIREARMS = [
  { name: 'Pistol', costGp: 50, damage: '1d8 piercing', weightLb: 1, magazine: 4, range: '30/90', properties: [] },
  { name: 'Revolver', costGp: 150, damage: '1d10', weightLb: 2, magazine: 6, range: '30/90', properties: [] },
  { name: 'Musket', costGp: 200, damage: '2d6', weightLb: 5, magazine: 1, range: '100/300', properties: ['two-handed'] },
  { name: 'Shotgun', costGp: 200, damage: '1d8', weightLb: 5, magazine: 1, range: '15', properties: ['two-handed', 'special'] },
  { name: 'Arm Cannon', costGp: 350, damage: '2d6 bludgeoning', weightLb: 10, magazine: 1, range: '30', properties: ['two-handed', 'special'] },
];
// All 16 Skill Shots named in the digest (mechanics are DM-prompt
// text in the subclass/base prompt; only Spell and Shot carries a
// printed Dynamo cost and level prerequisite, modeled below).
export const SKILL_SHOTS = [
  'Burst of Speed', 'Cauterize', 'Countershot', 'Debilitating Shot',
  'Decisive Words', 'Disarming Shot', 'Driven Physique', 'Fan the Hammer',
  'Focused Eye', 'Keen Intuition', 'Kneecapping Shot', 'Penetrating Shot',
  'Precision Shot', 'Repelling Shot', 'Ricocheting Shot', 'Spell and Shot',
];
export const SPELL_AND_SHOT_COST = 3; // Dynamo, bonus-action firearm attack after a Spell Battery spell.
export const QUICKDRAW_COST = 3; // Dynamo, on initiative (9th).

// --- State ------------------------------------------------------------------
export function defaultSpellshotState() {
  return {
    dynamo: 0,
    skillShots: [],
    arsenal: [],
    specialBulletsLeft: SPECIAL_BULLETS_PER_LONG_REST,
    specialBulletsUsedThisRest: 0,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultSpellshotState()));
}

// --- Dynamo gain / spend -----------------------------------------------------
// One gain EVENT (a hit, a crit, a kill, a Dex-save success, a
// Spell Dynamo trigger). At 20th (Determined Desperado) every gain
// event yields one extra point. Caps at the level limit, except
// Unlimited (20th), where the pool is unbounded.
export function gainDynamo(state, level, amount) {
  const s = clone(state);
  let gain = Math.max(0, Math.trunc(amount) || 0);
  if (clampLevel(level) >= 20) gain += 1; // Determined Desperado.
  if (isDynamoUnlimited(level)) {
    s.dynamo = (s.dynamo || 0) + gain;
  } else {
    s.dynamo = Math.min(dynamoLimitForLevel(level), (s.dynamo || 0) + gain);
  }
  return { state: s, success: true, gained: gain, dynamo: s.dynamo };
}
export function spendDynamo(state, level, amount) {
  const s = clone(state);
  const cost = Math.max(0, Math.trunc(amount) || 0);
  if (isDynamoUnlimited(level)) {
    return { state: s, success: true, spent: cost, dynamo: s.dynamo };
  }
  if ((s.dynamo || 0) < cost) {
    return { state: s, success: false, reason: 'insufficient_dynamo', dynamo: s.dynamo, cost };
  }
  s.dynamo -= cost;
  return { state: s, success: true, spent: cost, dynamo: s.dynamo };
}
// Cast a Spell Battery spell at a given spell level. A spell may
// only be cast at a level equal to or lower than the Spell Level
// Limit column.
export function castSpellBatterySpell(state, level, spellLevel) {
  const s = clone(state);
  const limit = spellLevelLimitForLevel(level);
  if (clampLevel(level) < 2) return { state: s, success: false, reason: 'spell_battery_not_yet_gained' };
  if (!spellLevel || spellLevel < 1 || spellLevel > limit) {
    return { state: s, success: false, reason: 'spell_level_above_limit', limit };
  }
  return spendDynamo(s, level, dynamoCostForSpellLevel(spellLevel));
}
export function validateSpellsKnown(level, knownList) {
  const max = spellsKnownForLevel(level);
  const count = (knownList || []).length;
  return { max, counted: count, ok: count <= max, over: Math.max(0, count - max) };
}

// --- Skill Shots / arsenal / special bullets ----------------------------------
export function learnSkillShot(state, level, shotName) {
  const s = clone(state);
  if (!SKILL_SHOTS.includes(shotName)) return { state: s, success: false, reason: 'unknown_skill_shot' };
  if (s.skillShots.includes(shotName)) return { state: s, success: false, reason: 'skill_shot_already_known' };
  if (shotName === 'Spell and Shot' && clampLevel(level) < 5) {
    return { state: s, success: false, reason: 'spell_and_shot_requires_level_5' };
  }
  if (s.skillShots.length >= skillShotsKnownForLevel(level)) {
    return { state: s, success: false, reason: 'skill_shots_known_cap' };
  }
  s.skillShots.push(shotName);
  return { state: s, success: true, shot: shotName };
}
// Only one Skill Shot per attack, except 20th-level Determined
// Desperado (any number). Returns the max shots usable on one attack.
export function skillShotsPerAttack(level) {
  return clampLevel(level) >= 20 ? Infinity : 1;
}
export function setArsenal(state, level, firearmNames) {
  const s = clone(state);
  const names = Array.isArray(firearmNames) ? firearmNames : [];
  if (names.length > arsenalSizeForLevel(level)) {
    return { state: s, success: false, reason: 'arsenal_exceeds_proficiency_bonus', cap: arsenalSizeForLevel(level) };
  }
  if (new Set(names).size !== names.length) return { state: s, success: false, reason: 'duplicate_firearm_in_arsenal' };
  s.arsenal = [...names];
  return { state: s, success: true, arsenal: s.arsenal };
}
export function craftSpecialBullet(state) {
  const s = clone(state);
  if ((s.specialBulletsLeft ?? SPECIAL_BULLETS_PER_LONG_REST) <= 0) {
    return { state: s, success: false, reason: 'special_bullets_exhausted' };
  }
  s.specialBulletsLeft -= 1;
  s.specialBulletsUsedThisRest = (s.specialBulletsUsedThisRest || 0) + 1;
  return { state: s, success: true, specialBulletsLeft: s.specialBulletsLeft };
}
// Elemental Arsenal (11th): extra dice by Dynamo spent on the
// triggering Skill Shot / Spell Battery spell.
export function elementalArsenalDice(dynamoSpent) {
  const spent = Math.trunc(dynamoSpent) || 0;
  if (spent <= 0) return '0';
  if (spent <= 4) return '1d6';
  if (spent <= 10) return '2d6';
  return '3d6';
}

// --- Rests ---------------------------------------------------------------------
// Dynamo is LOST at the end of a short or long rest, except:
// 9th Unshakeable Grit: keep up to proficiency bonus.
// 18th Unrelenting Grit: keep up to twice proficiency bonus; on a
// LONG rest, if below proficiency bonus afterwards, set to it.
function gritKept(state, level, type) {
  const l = clampLevel(level);
  const pb = proficiencyBonusForLevel(l);
  const cur = state.dynamo || 0;
  if (l < 9) return 0;
  if (l < 18) return Math.min(cur, pb);
  const kept = Math.min(cur, pb * 2);
  if (type === 'long' && kept < pb) return pb;
  return kept;
}
export function onShortRest(state, { level }) {
  const s = clone(state);
  s.dynamo = gritKept(s, level, 'short');
  return { state: s, success: true, dynamo: s.dynamo };
}
export function onLongRest(state, { level }) {
  const s = clone(state);
  s.dynamo = gritKept(s, level, 'long');
  s.specialBulletsLeft = SPECIAL_BULLETS_PER_LONG_REST;
  s.specialBulletsUsedThisRest = 0;
  return { state: s, success: true, dynamo: s.dynamo };
}
// Unrelenting Grit initiative floor (18th): if below half
// proficiency bonus at initiative, set to half proficiency bonus.
// "Half" of an odd bonus is floored (PB 3 -> 1, PB 5 -> 2); flagged
// as an interpretation in conversions-spellshot.md.
export function initiativeDynamoFloor(level) {
  if (clampLevel(level) < 18) return 0;
  return Math.floor(proficiencyBonusForLevel(level) / 2);
}
export function applyInitiativeFloor(state, level) {
  const s = clone(state);
  const floor = initiativeDynamoFloor(level);
  if ((s.dynamo || 0) < floor) s.dynamo = floor;
  return { state: s, success: true, dynamo: s.dynamo, floor };
}

// --- DM prompt section (seam for dmPromptBuilder) ------------------------------
export function spellshotPromptSection(state, { level, intMod, name }) {
  const s = state || defaultSpellshotState();
  const pb = proficiencyBonusForLevel(level);
  const limit = dynamoLimitForLevel(level);
  const lines = [`Spellshot (level ${level}, Int mod ${intMod}, proficiency +${pb}):`];
  lines.push(`- Dynamo: ${s.dynamo}${limit === Infinity ? ' (Unlimited at 20th)' : `/${limit}`} (save DC ${dynamoSaveDc(pb, intMod)}, attack +${dynamoAttackMod(pb, intMod)}; lost on rest except Grit — see below)`);
  lines.push(`- Spells known (${spellsKnownForLevel(level)} max, spell level limit ${spellLevelLimitForLevel(level) === 0 ? 'none yet' : spellLevelLimitForLevel(level) + 'th'}): Dynamo costs 1st=4, 2nd=6, 3rd=10, 4th=12, 5th=14`);
  lines.push(`- Cantrips known: 0 — NO cantrip progression is printed for this class (flagged gap; do not invent cantrips)`);
  lines.push(`- Skill Shots known (${(s.skillShots || []).length}/${skillShotsKnownForLevel(level)}): ${(s.skillShots || []).join(', ') || 'none'} (one per attack, except 20th Determined Desperado: any number)`);
  lines.push(`- Arsenal (${(s.arsenal || []).length}/${arsenalSizeForLevel(level)}, proficiency bonus): ${(s.arsenal || []).join(', ') || 'none'} (non-arsenal firearms cannot be attacked with)`);
  lines.push(`- Special bullets left: ${s.specialBulletsLeft ?? SPECIAL_BULLETS_PER_LONG_REST}/${SPECIAL_BULLETS_PER_LONG_REST} (max 5/long rest)`);
  if (clampLevel(level) >= 9 && clampLevel(level) < 18) lines.push(`- Unshakeable Grit: after a rest, keep Dynamo up to proficiency bonus (+${pb}) instead of losing all`);
  if (clampLevel(level) >= 18) lines.push(`- Unrelenting Grit: after a rest keep up to twice proficiency bonus (+${pb * 2}); after a long rest, if below +${pb}, set to +${pb}; at initiative, if below +${initiativeDynamoFloor(level)}, set to +${initiativeDynamoFloor(level)}`);
  if (name) lines[0] = `Spellshot ${name} (level ${level}, Int mod ${intMod}, proficiency +${pb}):`;
  return lines.join('\n');
}

// --- Multiclass grant: NONE PRINTED (UNRESOLVED) --------------------------------
export const MULTICLASS_GRANT = null;

// --- State load/save (own full parse; never parseClassResources) -----------------
function parseAllResources(raw) {
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
  }
  return parsed && typeof parsed === 'object' ? parsed : {};
}
export function loadSpellshotState(rawClassResourcesJson) {
  const resources = parseAllResources(rawClassResourcesJson);
  return resources.spellshot
    ? { ...defaultSpellshotState(), ...resources.spellshot }
    : defaultSpellshotState();
}
export function serializeSpellshotState(rawClassResourcesJson, spellshotState) {
  const resources = parseAllResources(rawClassResourcesJson);
  resources.spellshot = spellshotState;
  return JSON.stringify(resources);
}
export async function loadSpellshotStateFromDb(kind, id) {
  const { dbGet } = await import('../database.js');
  const table = kind === 'companion' ? 'companions' : 'characters';
  const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  if (!row) return defaultSpellshotState();
  return loadSpellshotState(row.class_resources_json);
}
export async function saveSpellshotStateToDb(kind, id, spellshotState) {
  const { dbGet, dbRun } = await import('../database.js');
  const table = kind === 'companion' ? 'companions' : 'characters';
  const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  const json = serializeSpellshotState(row ? row.class_resources_json : null, spellshotState);
  await dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [json, id]);
  return true;
}

export default {
  DYNAMO_LIMIT, SPELLS_KNOWN_SPELLSHOT, SPELL_LEVEL_LIMIT,
  CANTRIPS_KNOWN_SPELLSHOT, SKILL_SHOTS_KNOWN, DYNAMO_COST,
  WORTHY_CR_BY_PB, SPECIAL_BULLETS_PER_LONG_REST,
  proficiencyBonusForLevel, dynamoLimitForLevel, isDynamoUnlimited,
  spellsKnownForLevel, spellLevelLimitForLevel, cantripsKnownForLevel,
  skillShotsKnownForLevel, dynamoCostForSpellLevel, worthyCrForLevel,
  arsenalSizeForLevel, dynamoSaveDc, dynamoAttackMod,
  NORMAL_FIREARMS, SKILL_SHOTS, SPELL_AND_SHOT_COST, QUICKDRAW_COST,
  defaultSpellshotState, gainDynamo, spendDynamo, castSpellBatterySpell,
  validateSpellsKnown, learnSkillShot, skillShotsPerAttack, setArsenal,
  craftSpecialBullet, elementalArsenalDice, onShortRest, onLongRest,
  initiativeDynamoFloor, applyInitiativeFloor, spellshotPromptSection,
  MULTICLASS_GRANT, loadSpellshotState, serializeSpellshotState,
  loadSpellshotStateFromDb, saveSpellshotStateToDb,
};
