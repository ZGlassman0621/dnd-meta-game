/**
 * Class Feature Service — combat item 2 (2026-10-30, Zach's go-ahead).
 *
 * Pure feature math lives here, separate from the attack paths, so it
 * can be tested without a session: sneak dice, rage, martial arts,
 * bardic die, smite dice, fighting-style adjustments, and the
 * class-resource pool (used counts + raging flag + held inspiration).
 *
 * Two tracks, by design (Step 1, Q1): companion attacks are system-
 * rolled, so feature math lands directly in the profile; PC attacks
 * are player-rolled with a trusted reported total, so PC features ride
 * the pending attack as instructions (featureNotes) and are NEVER
 * silently added to a reported total.
 *
 * 2024 corrections baked in (verified 2026-10-30, not carried from
 * 2014): martial-arts die d6/d8/d10/d12; Rage uses 2/3/4/5/6 with
 * +1 on a short rest and all on a long rest (levelProgression's
 * RAGE_PROGRESSION L20 'Unlimited' is corrected to 6 in the same
 * pass); Divine Smite is a 2024 spell (bonus action after a hit,
 * 2d8 + 1d8 per slot level above 1st, +1d8 vs fiend/undead — the
 * spell catalog already encodes it uncapped, and this service
 * follows the catalog); Lay on Hands pool = paladin level x 5,
 * replenished on a long rest; Second Wind = 2 uses, +1 on a short
 * rest, all on a long rest (secondary-source values, flagged for
 * Zach's veto in the item-2 handover).
 *
 * Subclass features ARE modeled here (mechanics hooks, Families 2+7,
 * staged 2026-11-09 from cached mirror copies, NOT verified live):
 * the subclass registry (server/data/subclasses/, via
 * subclassService.js) drives resource pools — resourceMaxima gains a
 * subclass branch (subclassPoolMaxima), spendResource spends subclass
 * pools, and resetResourcesForRest restores them per each pool's
 * recorded rest rule (D8 — no invented rest rules). Maxima stay
 * computed, never stored. Arcane Ward is the one value pool (current
 * HP, sibling key wardHp — never a used-count). Heroic Inspiration
 * (D4, Human Resourceful) is a species pool here, max 1, granted on
 * a long rest; its reroll spend lives in rollRequestService (saves
 * family — see f2-f7 HANDOFF.md).
 *
 * Still NOT modeled here (Tier 3, deferred): Extra Attack grants
 * (item 3 counts them, see extraAttackCount) and bonus-action costs
 * (item 3). Paladin Channel Divinity uses ARE a base-class pool
 * (2024: 2/3/4 at 2nd/6th/18th) — see resourceMaxima; the old
 * "not confidently sourced" line is superseded by that table.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { findCompanionIdByName, hasIncapacitatingCondition } from './conditionService.js';
import { getSpellSlots, SNEAK_ATTACK_DICE, RAGE_PROGRESSION, KI_POINTS, SORCERY_POINTS, MARTIAL_ARTS_DIE } from '../config/levelProgression.js';
import { subclassPoolMaxima, subclassPoolRestRule, isSubclassValuePool } from './subclassService.js'; // Mechanics hooks F2+7: subclass pools

// Proficiency bonus, same formula as combatStatsService
// (Math.ceil(level / 4) + 1) — duplicated, not imported, so this
// module never pulls the combat-stats chain into a cycle.
export function proficiencyBonusForLevel(level) {
  return Math.ceil((Number(level) || 1) / 4) + 1;
}

export function normalizeFeatName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Feat lists are stored as JSON strings or arrays of strings/objects. */
export function parseFeatList(raw) {
  const list = typeof raw === 'string' ? safeParse(raw, []) : (raw || []);
  if (!Array.isArray(list)) return [];
  return list.map(f => typeof f === 'string' ? f : (f?.name || f?.key || '')).filter(Boolean);
}

export function hasFeat(feats, name) {
  const want = normalizeFeatName(name);
  return parseFeatList(feats).some(f => normalizeFeatName(f) === want);
}

// ---------------------------------------------------------------------------
// Pure feature numbers
// ---------------------------------------------------------------------------

export function sneakAttackDice(level) {
  return SNEAK_ATTACK_DICE[Math.min(20, Math.max(1, Number(level) || 1))] || 1;
}

/**
 * Sneak Attack eligibility (2024): rogue, finesse or ranged weapon,
 * not a spell attack. Advantage / ally-adjacent gating happens in the
 * attack paths, which know the roll mode — this only checks the
 * weapon/class side.
 */
export function sneakAttackEligible({ className, level, profile }) {
  if (String(className || '').toLowerCase().trim() !== 'rogue') return false;
  if (!level || level < 1) return false;
  if (!profile || profile.spellAttack) return false;
  const props = profile.properties || [];
  return props.includes('finesse') || profile.rangeType === 'ranged';
}

export function rageDamage(level) {
  const row = RAGE_PROGRESSION[Math.min(20, Math.max(1, Number(level) || 1))];
  return row?.damage ?? 2;
}

export function rageUses(level) {
  const row = RAGE_PROGRESSION[Math.min(20, Math.max(1, Number(level) || 1))];
  return typeof row?.uses === 'number' ? row.uses : 2;
}

export function martialArtsDie(level) {
  return MARTIAL_ARTS_DIE[Math.min(20, Math.max(1, Number(level) || 1))] || 'd6';
}

export function focusPoints(level) {
  const v = KI_POINTS[Math.min(20, Math.max(1, Number(level) || 1))];
  return v != null ? v : (Number(level) || 0);
}

export function sorceryPoints(level) {
  const v = SORCERY_POINTS[Math.min(20, Math.max(1, Number(level) || 1))];
  return v != null ? v : (Number(level) || 0);
}

export function bardicDie(level) {
  const l = Number(level) || 1;
  if (l >= 15) return 'd12';
  if (l >= 10) return 'd10';
  if (l >= 5) return 'd8';
  return 'd6';
}

/** Bardic Inspiration uses (2024): Charisma modifier, minimum 1. */
export function bardicUses(chaMod) {
  return Math.max(1, Number(chaMod) || 0);
}

/** Divine Smite dice (2024 spell): 2d8 at 1st, +1d8 per slot above 1st, +1d8 vs fiend/undead. */
export function smiteDice(slotLevel, { fiendOrUndead = false } = {}) {
  const slot = Math.min(9, Math.max(1, Number(slotLevel) || 1));
  return { dice: `${slot + 1 + (fiendOrUndead ? 1 : 0)}d8`, count: slot + 1 + (fiendOrUndead ? 1 : 0) };
}

export function improvedDivineSmite(className, level) {
  return String(className || '').toLowerCase().trim() === 'paladin' && (Number(level) || 0) >= 11;
}

/** Record only (Tier 3): the count item 3 will grant as extra swings. */
export function extraAttackCount(className, level) {
  const l = Number(level) || 0;
  const cls = String(className || '').toLowerCase().trim();
  if (cls === 'fighter') {
    if (l >= 20) return 3;
    if (l >= 11) return 2;
    if (l >= 5) return 1;
    return 0;
  }
  const extraAttackClasses = new Set(['barbarian', 'monk', 'paladin', 'ranger', 'spellshot', 'pugilist', 'duelist', 'blackguard']); // overnight 7-class merge: all four gain Extra Attack at 5th (1 extra)
  return extraAttackClasses.has(cls) && l >= 5 ? 1 : 0;
}

/** Great Weapon Master (2024): +PB damage on a Heavy weapon hit, once per turn. */
export function greatWeaponMasterBonus(level) {
  return proficiencyBonusForLevel(level);
}

// ---------------------------------------------------------------------------
// Fighting styles (2024 feats, read from the feat list)
// ---------------------------------------------------------------------------

/**
 * Engine-checkable fighting-style adjustments for one attack profile.
 * Returns deltas + notes; the caller applies deltas to companion math
 * and notes to the PC pending block. Defense is defensive, so it is
 * NOT here — see defenseAcBonus, applied in calculateCombatStats.
 * Blind Fighting / Interception / Protection are reaction- or
 * positioning-gated (items 3/4) and return notes only.
 */
export function fightingStyleAdjustments({ feats, profile }) {
  const out = { attackBonusDelta: 0, damageBonusDelta: 0, notes: [], gwfFloor: false };
  if (!profile || profile.spellAttack) return out;
  const isMelee = profile.rangeType !== 'ranged';
  // One-handed means no off-hand WEAPON (a shield is not a weapon:
  // offHandName carries the shield's name, offHandWeapon is null
  // for it) and not a two-handed wield.
  const oneHanded = isMelee && !profile.offHandWeapon && !profile.twoHanded;
  if (hasFeat(feats, 'Archery') && profile.rangeType === 'ranged') {
    out.attackBonusDelta += 2;
    out.notes.push('Archery: +2 to this ranged attack.');
  }
  if (hasFeat(feats, 'Dueling') && oneHanded && !profile.offHandAttack) {
    out.damageBonusDelta += 2;
    out.notes.push('Dueling: +2 damage (one-handed melee, no other weapon).');
  }
  if (hasFeat(feats, 'Thrown Weapon Fighting') && profile.thrown) {
    out.damageBonusDelta += 2;
    out.notes.push('Thrown Weapon Fighting: +2 damage.');
  }
  if (hasFeat(feats, 'Great Weapon Fighting') && profile.twoHanded && isMelee) {
    out.gwfFloor = true;
    out.notes.push('Great Weapon Fighting: damage dice cannot roll below 3.');
  }
  if (hasFeat(feats, 'Unarmed Fighting') && profile.label === 'Unarmed Strike') {
    out.notes.push('Unarmed Fighting: unarmed strikes deal 1d6 (1d8 with both hands free).');
  }
  return out;
}

/** Defense: +1 AC while wearing armor. Applied by calculateCombatStats. */
export function defenseAcBonus(feats, wearingArmor) {
  return hasFeat(feats, 'Defense') && wearingArmor ? 1 : 0;
}

// ---------------------------------------------------------------------------
// Class-resource state (migration 091: class_resources_json)
// Stored shape: { used: { rage: n, focus: n, bardic: n, secondWind: n,
//   actionSurge: n, channelDivinity: n, layOnHandsSpent: n, sorcery: n },
//   raging: bool, bardicHeld: { die, from } | null }
// Maxima are computed, never stored, so a level-up cannot strand a
// stale max on the row.
// ---------------------------------------------------------------------------

export function parseClassResources(raw) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  const res = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    used: (res.used && typeof res.used === 'object') ? res.used : {},
    raging: !!res.raging,
    bardicHeld: res.bardicHeld || null,
  };
}

function abilityModOf(abilities, key, full) {
  const scores = typeof abilities === 'string' ? safeParse(abilities, {}) : (abilities || {});
  const score = Number(scores[key] ?? scores[full] ?? 10);
  return Math.floor((score - 10) / 2);
}

export function resourceMaxima({ className, level, abilityScores, subclassName = null, subclassChoices = null, classLevels = null, species = null, subrace = null }) {
  const cls = String(className || '').toLowerCase().trim();
  const l = Number(level) || 1;
  const chaMod = abilityModOf(abilityScores, 'cha', 'charisma');
  const maxima = {};
  if (cls === 'barbarian') maxima.rage = rageUses(l);
  if (cls === 'monk') maxima.focus = focusPoints(l);
  if (cls === 'bard') maxima.bardic = bardicUses(chaMod);
  if (cls === 'fighter') {
    maxima.secondWind = l >= 10 ? 4 : l >= 4 ? 3 : 2; // 2024 PHB Fighter table, Second Wind column: 2 at L1, 3 at L4, 4 at L10 (was a flat 2).
    maxima.actionSurge = l >= 17 ? 2 : 1;
  }
  if (cls === 'paladin') maxima.layOnHands = l * 5;
  if (cls === 'cleric') maxima.channelDivinity = l >= 18 ? 4 : l >= 6 ? 3 : 2; // 2024 PHB Cleric table, Channel Divinity column: 2 at L2, 3 at L6, 4 at L18 (was the 2014 1/2/3).
  if (cls === 'sorcerer') maxima.sorcery = sorceryPoints(l);
  // Mechanics hooks, Families 2+7 — subclass pools (D6: class_levels
  // included, so a multiclass actor reads every class's pools). A
  // pool key already present as a base pool keeps the larger maximum.
  // subclassChoices is accepted for forward compatibility (pools
  // gated on a stored choice, e.g. Armorer model pools) but no wired
  // pool reads it yet — see f2-f7 NOTES.md.
  const sub = subclassPoolMaxima({ className, subclassName, level, classLevels }, abilityScores);
  for (const [k, v] of Object.entries(sub)) {
    maxima[k] = maxima[k] == null ? v : Math.max(maxima[k], v);
  }
  // D4 Heroic Inspiration: Human Resourceful grants it on a long
  // rest; max 1 (the 2024 rule: only one at a time). Species-gated,
  // not subclass-gated — see isHumanSpecies below.
  if (isHumanSpecies(species, subrace)) maxima.heroicInspiration = 1;
  return maxima;
}

// D4 species gate (Human Resourceful). Stored spellings in hand:
// race 'Human', or 'Variant Human' as race or subrace. Full
// species-variant resolution (speciesService.resolveSpecies) is the
// follow-up — this covers the spellings the creator stores today
// and fails closed (no grant) for anything else.
export function isHumanSpecies(species, subrace) {
  const norm = (v) => String(v || '').toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  const race = norm(species);
  const sub = norm(subrace);
  if (race === 'human' || race === 'variant human' || race.startsWith('variant human ')) return true;
  if (sub === 'variant human' || sub.startsWith('variant human ')) return true;
  return false;
}

/**
 * Rest reset, pure: long rest restores everything and clears Rage /
 * held inspiration; short rest restores +1 Rage, +1 Second Wind,
 * Action Surge, Channel Divinity, Focus, and (Bard L5+ Font of
 * Inspiration) Bardic uses. Sorcery Points and Lay on Hands are
 * long-rest only. Unknown keys pass through untouched.
 *
 * Mechanics hooks, Families 2+7 — subclass branch: maxima come from
 * subclassPoolMaxima (same actor shape as resourceMaxima). Long rest
 * restores every subclass pool (the loop below already zeroes every
 * used key) and resets the Arcane Ward value to full; short rest
 * applies each pool's own recorded rule — 'short or long' restores
 * fully, 'short+1' restores 1 (Soulknife), 'long+1-if-empty'
 * restores 1 only when none remain (Psi Warrior) — and leaves
 * long-rest-only pools (Healing Light, Portent, Grave, Balm, and the
 * rest) untouched. Heroic Inspiration (D4) is granted on a long rest
 * (used.heroicInspiration → 0) and untouched on a short rest.
 */
export function resetResourcesForRest(resources, { className, level, type, subclassName = null, subclassChoices = null, classLevels = null, abilityScores = null, species = null, subrace = null }) {
  // Artificer base class: parse the RAW resources here, not through
  // parseClassResources (which strips every top-level key except
  // used/raging/bardicHeld). Unknown top-level keys (e.g. .artificer)
  // pass through untouched on both rest types — the docstring's own
  // promise — or the first rest would wipe every Artificer record.
  const raw = typeof resources === 'string' ? safeParse(resources, {}) : (resources || {});
  const res = raw && typeof raw === 'object' ? raw : {};
  const used = { ...(res.used && typeof res.used === 'object' ? res.used : {}) };
  const cls = String(className || '').toLowerCase().trim();
  const l = Number(level) || 1;
  // Subclass maxima for this actor (D6: class_levels included).
  // subclassChoices is accepted but no wired pool reads it yet.
  const subMaxima = subclassPoolMaxima({ className, subclassName, level, classLevels }, abilityScores);
  const wardMax = subMaxima.ward;
  if (type === 'long') {
    for (const k of Object.keys(used)) used[k] = 0;
    // Arcane Ward is a value, not a used-count: a long rest restores
    // it to full (wardHp sibling key). A non-Abjurer keeps any stale
    // wardHp untouched — this function never cleans another pool's key.
    if (wardMax != null) return { ...res, used, wardHp: wardMax, raging: false, bardicHeld: null };
    return { ...res, used, raging: false, bardicHeld: null };
  }
  // Short rest.
  if (used.rage != null) used.rage = Math.max(0, used.rage - 1);
  if (used.secondWind != null) used.secondWind = Math.max(0, used.secondWind - 1);
  if (used.actionSurge != null) used.actionSurge = 0;
  if (used.channelDivinity != null) used.channelDivinity = 0;
  if (used.focus != null) used.focus = 0;
  if (cls === 'bard' && l >= 5 && used.bardic != null) used.bardic = 0;
  // Subclass short-rest rules: only pools this actor currently has,
  // only keys actually present in used. A stale key (pool the actor
  // no longer has) passes through untouched, like any unknown key.
  for (const [pool, max] of Object.entries(subMaxima)) {
    if (used[pool] == null) continue;
    const rule = subclassPoolRestRule(pool);
    if (rule === 'short or long') used[pool] = 0;
    else if (rule === 'short+1') used[pool] = Math.max(0, used[pool] - 1);
    else if (rule === 'long+1-if-empty' && used[pool] >= max) used[pool] = Math.max(0, used[pool] - 1);
    // 'long' pools (and the ward value / Heroic Inspiration) are
    // untouched by a short rest.
  }
  return { ...res, used, raging: res.raging, bardicHeld: res.bardicHeld };
}

// ---------------------------------------------------------------------------
// DB-backed resource operations (services only — never migrations)
// ---------------------------------------------------------------------------

const TABLE = { player: 'characters', companion: 'companions' };
const CLASS_COL = { player: 'class', companion: 'companion_class' };
const LEVEL_COL = { player: 'level', companion: 'companion_level' };
const ABILITY_COL = { player: 'ability_scores', companion: 'companion_ability_scores' };
const FEAT_COL = { player: 'feats', companion: 'companion_feats' };

export async function getClassResources(kind, id) {
  const table = TABLE[kind];
  if (!table || !id) return null;
  const row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return null;
  // Full raw parse here, NOT parseClassResources: the stripped shape
  // drops every unknown top-level key, so a spend would wipe the
  // Arcane Ward value (wardHp, Families 2+7) and the Artificer record
  // (.artificer) from the row on the next writeResources. Same
  // guarantees as before (.used is an object, .raging a bool,
  // .bardicHeld present), plus every other top-level key preserved.
  // parseClassResources itself is unchanged (read-only callers rely
  // on its stripped shape; artificerService already own-parses).
  const parsed = typeof row.class_resources_json === 'string'
    ? safeParse(row.class_resources_json, {}) : (row.class_resources_json || {});
  const res = parsed && typeof parsed === 'object' ? parsed : {};
  return {
    row,
    resources: {
      ...res,
      used: (res.used && typeof res.used === 'object') ? res.used : {},
      raging: !!res.raging,
      bardicHeld: res.bardicHeld || null,
    },
  };
}

async function writeResources(kind, id, resources) {
  await dbRun(`UPDATE ${TABLE[kind]} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
}

/** Spend one use of a resource; returns { success, reason?, used, max }.
 * Mechanics hooks, Families 2+7: the maxima read is subclass-aware
 * (subclass + class_levels + species from the row), so subclass pools
 * spend through this same function and refuse at the cap exactly like
 * the base pools. Arcane Ward is a value pool, not a spent count —
 * spending 'ward' is refused; the ward is reduced by damage
 * absorption in the damage path (Family 6), not here. */
export async function spendResource(kind, id, key) {
  const got = await getClassResources(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  const { row, resources } = got;
  // Mechanics hooks F2+7: subclass pools need the row's subclass,
  // class_levels, and species (Human → Heroic Inspiration). Column
  // names differ per table; a missing column is tolerated (null) and
  // the pool simply is not granted — fail-closed, never invented.
  const subCol = kind === 'player' ? 'subclass' : 'companion_subclass';
  const levelsCol = kind === 'player' ? 'class_levels' : 'companion_class_levels';
  const choicesCol = kind === 'player' ? 'subclass_choices_json' : 'companion_subclass_choices_json';
  const maxima = resourceMaxima({
    className: row[CLASS_COL[kind]], level: row[LEVEL_COL[kind]], abilityScores: row[ABILITY_COL[kind]],
    subclassName: row[subCol] ?? null, classLevels: row[levelsCol] ?? null,
    subclassChoices: row[choicesCol] ?? null,
    species: row.race ?? row.npc_race ?? null, subrace: row.subrace ?? row.companion_subrace ?? null,
  });
  if (isSubclassValuePool(key)) {
    return { success: false, reason: `${key} is a hit-point value, not a spent count — it is reduced by damage absorption, not spendResource`, used: Number(resources.used[key] || 0), max: maxima[key] ?? null };
  }
  const max = maxima[key];
  if (max == null) return { success: false, reason: `${key} is not modeled for this class` };
  const used = Number(resources.used[key] || 0);
  if (used >= max) return { success: false, reason: `no ${key} uses left (${used}/${max})`, used, max };
  resources.used[key] = used + 1;
  await writeResources(kind, id, resources);
  return { success: true, used: used + 1, max };
}

/** Spend a spell slot (Divine Smite fuel): stored maxima win, else the level table. */
export async function spendSpellSlot(kind, id, slotLevel) {
  const table = TABLE[kind];
  const usedCol = kind === 'player' ? 'spell_slots_used' : 'companion_spell_slots_used';
  const maxCol = kind === 'player' ? 'spell_slots' : null;
  const row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  if (!row) return { success: false, reason: 'unknown actor' };
  const used = safeParse(row[usedCol], {}) || {};
  let max = null;
  if (maxCol) {
    const stored = safeParse(row[maxCol], {}) || {};
    if (stored[String(slotLevel)] != null) max = Number(stored[String(slotLevel)]);
  }
  if (max == null) {
    const tableSlots = getSpellSlots(row[CLASS_COL[kind]], row[LEVEL_COL[kind]]);
    max = Number(tableSlots?.[slotLevel] ?? tableSlots?.[String(slotLevel)] ?? 0);
  }
  const cur = Number(used[String(slotLevel)] ?? used[slotLevel] ?? 0);
  if (cur >= max) return { success: false, reason: `no ${slotLevel}-level slots left (${cur}/${max})`, used: cur, max };
  used[String(slotLevel)] = cur + 1;
  await dbRun(`UPDATE ${table} SET ${usedCol} = ? WHERE id = ?`, [JSON.stringify(used), id]);
  return { success: true, used: cur + 1, max };
}

export async function setCompanionFeats(id, feats) {
  if (!id) return { success: false, reason: 'unknown companion' };
  const cleaned = (Array.isArray(feats) ? feats : []).map(f => String(f).trim()).filter(Boolean);
  await dbRun('UPDATE companions SET companion_feats = ? WHERE id = ?', [JSON.stringify(cleaned), id]);
  return { success: true, feats: cleaned };
}

export async function getCompanionFeats(id) {
  const row = await dbGet('SELECT companion_feats FROM companions WHERE id = ?', [id]);
  return parseFeatList(row?.companion_feats);
}

// ---------------------------------------------------------------------------
// Marker handlers: RAGE / INSPIRATION / SECOND_WIND / LAY_ON_HANDS
// ---------------------------------------------------------------------------

async function resolveTarget(context, targetRaw) {
  const character = await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId]);
  const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
    (character && targetRaw.toLowerCase() === String(character.name).toLowerCase());
  if (isPc) return { kind: 'player', id: context.characterId, name: character?.name || 'Player' };
  const compId = await findCompanionIdByName(context.characterId, targetRaw);
  if (!compId) return null;
  return { kind: 'companion', id: compId, name: targetRaw };
}

const truthy = (v) => ['true', 'yes', '1'].includes(String(v || '').toLowerCase().trim());

// Combat item 3, Tier 2: bonus-action gate shared by RAGE,
// INSPIRATION (grant) and SECOND_WIND. Returns a refusal reason, or
// null when the bonus is free — or when there is no turn order to
// charge against (bootstrap, same as ACTION_SURGE: the resource is
// spent, the bonus is not tracked until combat starts). A ledger
// failure never blocks the feature; it only skips the charge.
// Gate order: identity first, then bonus, both BEFORE the resource
// is spent, so a refused action consumes nothing.
async function bonusGate(context, target) {
  if (!context?.sessionId) return null;
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const { ledgerKeyForTarget, checkTurnIdentity, checkBonus } = await import('./turnLedgerService.js');
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const key = await ledgerKeyForTarget(target.kind, target.id);
    const identity = await checkTurnIdentity(context.sessionId, encounterSeq, key);
    if (!identity.allowed) return `${identity.reason} ${identity.remedy}`;
    const bc = await checkBonus(context.sessionId, encounterSeq, key);
    if (!bc.allowed) return `${bc.reason} ${bc.remedy}`;
    return null;
  } catch { return null; }
}

async function spendBonusFor(context, target, label) {
  if (!context?.sessionId) return;
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const { ledgerKeyForTarget, spendBonus } = await import('./turnLedgerService.js');
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (encounterSeq) await spendBonus(context.sessionId, encounterSeq, await ledgerKeyForTarget(target.kind, target.id), label);
  } catch { /* ledger failure never unspends the resource */ }
}

registerMarkerHandler('RAGE', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'rage', success: false, reason: 'RAGE needs Target=' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'rage', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: Rage (entry and ending) costs a bonus action;
    // an incapacitated barbarian cannot take it.
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'rage', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    const got = await getClassResources(target.kind, target.id);
    if (!got) return { type: 'rage', success: false, reason: 'unknown actor' };
    const { row, resources } = got;
    const cls = String(row[CLASS_COL[target.kind]] || '').toLowerCase().trim();
    if (cls !== 'barbarian') return { type: 'rage', success: false, reason: `${target.name} is not a barbarian` };
    if (truthy(parsed?.End)) {
      resources.raging = false;
      await writeResources(target.kind, target.id, resources);
      return { type: 'rage', success: true, target: target.name, raging: false };
    }
    if (resources.raging) return { type: 'rage', success: true, target: target.name, raging: true, note: 'already raging' };
    // Item 3, Tier 2: Rage entry costs a bonus action. Gate (identity
    // + bonus) runs before the rage use is spent; the charge lands
    // only once the rage is actually entered.
    const blocked = await bonusGate(context, target);
    if (blocked) return { type: 'rage', success: false, reason: blocked };
    const spent = await spendResource(target.kind, target.id, 'rage');
    if (!spent.success) return { type: 'rage', success: false, reason: spent.reason };
    const fresh = await getClassResources(target.kind, target.id);
    fresh.resources.raging = true;
    await writeResources(target.kind, target.id, fresh.resources);
    await spendBonusFor(context, target, 'Rage');
    return { type: 'rage', success: true, target: target.name, raging: true, usesUsed: spent.used, usesMax: spent.max };
  } catch (e) {
    console.error('[classFeatureService] RAGE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('INSPIRATION', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'inspiration', success: false, reason: 'INSPIRATION needs Target=' };
    // The bard is the context character (PC) or a named companion bard.
    const bardRaw = String(parsed?.Bard || 'player').trim();
    const bard = await resolveTarget(context, bardRaw);
    if (!bard) return { type: 'inspiration', success: false, reason: `unknown bard: ${bardRaw}` };
    const bardGot = await getClassResources(bard.kind, bard.id);
    const bardRow = bardGot?.row;
    if (String(bardRow?.[CLASS_COL[bard.kind]] || '').toLowerCase().trim() !== 'bard') {
      return { type: 'inspiration', success: false, reason: `${bard.name} is not a bard` };
    }
    // Item 3, Tier 2: granting Bardic Inspiration costs the BARD's
    // bonus action (spending a held die, Spend="true", costs none).
    // Gate before the bardic use is spent; charge after the grant.
    // Combat item 8: an incapacitated bard cannot grant (the Spend
    // branch spends a held die, not an action, so it is ungated).
    if (!truthy(parsed?.Spend) && await hasIncapacitatingCondition(bard.kind, bard.id)) return { type: 'inspiration', success: false, reason: `${bard.name} is incapacitated and cannot take actions` };
    if (!truthy(parsed?.Spend)) {
      const blocked = await bonusGate(context, bard);
      if (blocked) return { type: 'inspiration', success: false, reason: blocked };
    }
    if (truthy(parsed?.Spend)) {
      const target = await resolveTarget(context, targetRaw);
      if (!target) return { type: 'inspiration', success: false, reason: `unknown target: ${targetRaw}` };
      const got = await getClassResources(target.kind, target.id);
      const held = got?.resources?.bardicHeld;
      if (!held) return { type: 'inspiration', success: false, reason: `${target.name} holds no Bardic Inspiration die` };
      got.resources.bardicHeld = null;
      await writeResources(target.kind, target.id, got.resources);
      return { type: 'inspiration', success: true, target: target.name, spent: true, die: held.die };
    }
    const spent = await spendResource(bard.kind, bard.id, 'bardic');
    if (!spent.success) return { type: 'inspiration', success: false, reason: spent.reason };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'inspiration', success: false, reason: `unknown target: ${targetRaw}` };
    const die = bardicDie(bardRow[LEVEL_COL[bard.kind]]);
    const got = await getClassResources(target.kind, target.id);
    got.resources.bardicHeld = { die, from: bard.name };
    await writeResources(target.kind, target.id, got.resources);
    await spendBonusFor(context, bard, 'Bardic Inspiration');
    return { type: 'inspiration', success: true, target: target.name, bard: bard.name, die, usesUsed: spent.used, usesMax: spent.max };
  } catch (e) {
    console.error('[classFeatureService] INSPIRATION handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('SECOND_WIND', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'second_wind', success: false, reason: 'SECOND_WIND needs Target=' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'second_wind', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: Second Wind costs a bonus action.
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'second_wind', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    const got = await getClassResources(target.kind, target.id);
    const cls = String(got?.row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim();
    if (cls !== 'fighter') return { type: 'second_wind', success: false, reason: `${target.name} is not a fighter` };
    // Item 3, Tier 2: Second Wind costs a bonus action. Gate before
    // the use is spent; charge after the heal lands.
    const blocked = await bonusGate(context, target);
    if (blocked) return { type: 'second_wind', success: false, reason: blocked };
    const spent = await spendResource(target.kind, target.id, 'secondWind');
    if (!spent.success) return { type: 'second_wind', success: false, reason: spent.reason };
    const level = Number(got.row[LEVEL_COL[target.kind]] || 1);
    const rolled = roll(10, 1, { reason: 'second wind' });
    const heal = rolled.total + level;
    if (target.kind === 'player') {
      const { applyHpChange } = await import('./characterHpService.js');
      await applyHpChange(target.id, heal, 'second wind');
    } else {
      await dbRun('UPDATE companions SET companion_current_hp = MIN(companion_max_hp, companion_current_hp + ?) WHERE id = ?', [heal, target.id]);
    }
    await spendBonusFor(context, target, 'Second Wind');
    return { type: 'second_wind', success: true, target: target.name, heal, usesUsed: spent.used, usesMax: spent.max };
  } catch (e) {
    console.error('[classFeatureService] SECOND_WIND handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('ACTION_SURGE', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'action_surge', success: false, reason: 'ACTION_SURGE needs Target=' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'action_surge', success: false, reason: `unknown target: ${targetRaw}` };
    // Combat item 8: Action Surge grants an action; an incapacitated
    // fighter cannot take actions, so the surge is refused unspent.
    if (await hasIncapacitatingCondition(target.kind, target.id)) return { type: 'action_surge', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    const got = await getClassResources(target.kind, target.id);
    const cls = String(got?.row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim();
    if (cls !== 'fighter') return { type: 'action_surge', success: false, reason: `${target.name} is not a fighter` };
    const spent = await spendResource(target.kind, target.id, 'actionSurge');
    if (!spent.success) return { type: 'action_surge', success: false, reason: spent.reason };
    // Item 3, Tier 1: the surge buys one more action this turn, in
    // the turn ledger. A ledger failure never unspends the resource;
    // with no active turn order there is nothing to grant against,
    // so the use is spent and the note says so.
    let surgeNote = null;
    if (context?.sessionId) {
      try {
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        const { ledgerKeyForTarget, recordSurge } = await import('./turnLedgerService.js');
        const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
        if (encounterSeq) {
          const key = await ledgerKeyForTarget(target.kind, target.id);
          const surges = await recordSurge(context.sessionId, encounterSeq, key);
          if (surges == null) surgeNote = 'no active turn order — the use is spent, but no extra action is tracked until combat starts';
        }
      } catch { /* resource already spent */ }
    }
    return { type: 'action_surge', success: true, target: target.name, usesUsed: spent.used, usesMax: spent.max, ...(surgeNote ? { note: surgeNote } : {}) };
  } catch (e) {
    console.error('[classFeatureService] ACTION_SURGE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('LAY_ON_HANDS', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const amount = Number(parsed?.Amount) || 0;
    if (!targetRaw || amount <= 0) return { type: 'lay_on_hands', success: false, reason: 'LAY_ON_HANDS needs Target= and Amount=' };
    const healerRaw = String(parsed?.Healer || 'player').trim();
    const healer = await resolveTarget(context, healerRaw);
    if (!healer) return { type: 'lay_on_hands', success: false, reason: `unknown healer: ${healerRaw}` };
    // Combat item 8: Lay on Hands costs an action.
    if (await hasIncapacitatingCondition(healer.kind, healer.id)) return { type: 'lay_on_hands', success: false, reason: `${healer.name} is incapacitated and cannot take actions` };
    const got = await getClassResources(healer.kind, healer.id);
    const cls = String(got?.row?.[CLASS_COL[healer.kind]] || '').toLowerCase().trim();
    if (cls !== 'paladin') return { type: 'lay_on_hands', success: false, reason: `${healer.name} is not a paladin` };
    const level = Number(got.row[LEVEL_COL[healer.kind]] || 1);
    const pool = level * 5;
    const spentSoFar = Number(got.resources.used.layOnHandsSpent || 0);
    if (amount > pool - spentSoFar) {
      return { type: 'lay_on_hands', success: false, reason: `only ${pool - spentSoFar} Lay on Hands points left (pool ${pool})` };
    }
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'lay_on_hands', success: false, reason: `unknown target: ${targetRaw}` };
    if (target.kind === 'player') {
      const { applyHpChange } = await import('./characterHpService.js');
      await applyHpChange(target.id, amount, 'lay on hands');
    } else {
      await dbRun('UPDATE companions SET companion_current_hp = MIN(companion_max_hp, companion_current_hp + ?) WHERE id = ?', [amount, target.id]);
    }
    got.resources.used.layOnHandsSpent = spentSoFar + amount;
    await writeResources(healer.kind, healer.id, got.resources);
    return { type: 'lay_on_hands', success: true, target: target.name, healer: healer.name, healed: amount, poolLeft: pool - spentSoFar - amount };
  } catch (e) {
    console.error('[classFeatureService] LAY_ON_HANDS handler failed:', e.message);
    return null;
  }
});

export default {
  proficiencyBonusForLevel, normalizeFeatName, parseFeatList, hasFeat,
  sneakAttackDice, sneakAttackEligible, rageDamage, rageUses, martialArtsDie,
  focusPoints, sorceryPoints, bardicDie, bardicUses, smiteDice,
  improvedDivineSmite, extraAttackCount, greatWeaponMasterBonus,
  fightingStyleAdjustments, defenseAcBonus, parseClassResources,
  resourceMaxima, resetResourcesForRest, getClassResources, spendResource,
  spendSpellSlot, setCompanionFeats, getCompanionFeats, isHumanSpecies,
};
