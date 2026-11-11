/**
 * Party Attack Service (combat-real B2, v1.0.191).
 *
 * Until now, party attacks were the DM's say-so: the PC's client sent
 * dice that were formatted into a polite directive, companion attacks
 * had no dice at all, and damage landed through [ENEMY_DAMAGE:
 * Amount=N] where N was a number in the DM's text. Enemy attacks, by
 * contrast, have always been server-resolved. This service is the
 * mirror of resolveEnemyAttack for the party side:
 *
 *   [ATTACK: Attacker="Player" Target="Goblin"]
 *   [ATTACK: Attacker="Lyra" Target="Goblin" Spell="Fire Bolt" Damage="1d10"]
 *
 * - The PC's attack creates a PENDING attack (the 185 pending-roll
 *   shape): the player reports real dice (attackRoll/damage fields,
 *   or a bare-number message for two dice), the system judges hit,
 *   crit, and damage against the enemy's real AC + cover.
 * - A companion's attack resolves immediately, server-rolled, from
 *   their true sheet (186) and equipment (B1 combat stats).
 * - Advantage/disadvantage is COMPUTED from condition state on both
 *   sides (conditionService profiles), never declared — though the
 *   marker's Advantage=/Disadvantage= circumstance merges in, exactly
 *   as ROLL_REQUEST allows.
 * - Damage on a hit flows through applyPartyDamageToEnemy, so death
 *   events, kill loot and morale fire identically to ENEMY_DAMAGE.
 * - The party's rally buff (+1, moraleService) is consumed here — it
 *   had no attack roll to attach to before this service existed.
 *
 * Outcomes stash to session_config.recentAttacks and surface next turn
 * through formatAttackOutcomeBlock — the DM narrates facts.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll, rollD20 } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { findActiveEnemy, getCurrentEncounterSeq, getCoverAcBonus, applyPartyDamageToEnemy, getActiveEnemies } from './enemyCombatService.js';
import { calculateCombatStats, spellProfileFor, abilityModifier, proficiencyBonusForLevel, classHasMastery, lookupWeaponData, weaponIsMastered, parseMasteredWeapons } from './combatStatsService.js';
import { parseFeatList, hasFeat, parseClassResources, rageDamage, improvedDivineSmite, fightingStyleAdjustments, greatWeaponMasterBonus, smiteDice, sneakAttackDice, sneakAttackEligible, spendSpellSlot, extraAttackCount } from './classFeatureService.js'; // Combat item 2
import { getTurnState } from './combatTurnService.js';
import { currentSlotKey, readLedger, getBudget, updateBudgetForSlot, ledgerKeyForPlayer, ledgerKeyForCompanion, checkTurnIdentity, attackBudgetDecision, recordAttack, checkBonus, spendBonus } from './turnLedgerService.js'; // Combat item 3, Tier 1 + Tier 2 (bonus action)
import { getEntry, clearField } from './actionStateService.js'; // Combat item 3, Tier 3 (Dodge / Help / Hide / Ready)
import { combatFallbackId } from './worldIdService.js';
import { hasReactionAvailable, useReaction } from './reactionService.js';
import { lookupBestiaryFull } from './bestiaryLookupService.js';
import { erodeScores } from './coldExposureService.js'; // Frost Exhaustion erodes unarmed/heavy scores at this one math site
import { getConditions, conditionAttackEffects, conditionDefenseEffects, findCompanionIdByName, addCondition, attackBlockedByConditions } from './conditionService.js';
import { getMoraleBuff } from './moraleService.js';
import { crScaledModifier } from './rollRequestService.js';
import { spellEffectSpec } from '../data/spellCatalog.js';
import { critThresholdFor, featuresAtLevel, survivorHealAtTurnStart, zealotDivineFuryBonus, forgeDivineStrikeDice, orderDivineStrikeDice, featuresForActor, critThresholdForActor, hasSubclassFeature, featureByKey } from './subclassService.js';
// Re-exported so callers that resolved these through this module (the
// F1 attack/crit tests, and any live caller doing the same) keep
// working now that the implementations live in subclassService.js.
export { featuresForActor, critThresholdForActor, hasSubclassFeature, featureByKey } from './subclassService.js';

const ATTACK_MODE_LABEL = { advantage: 'with advantage', disadvantage: 'with disadvantage' };

// ---------------------------------------------------------------------------
// Mechanics hooks, Families 1 + 4 (2026-11-09, staged from cached mirror
// copies — NOT verified against live Mac bytes; the push step
// re-verifies live bytes first).
//
// MERGE (2026-11-09): the shared contract (featuresForActor /
// critThresholdForActor / hasSubclassFeature / featureByKey) now lives
// in subclassService.js (flat shape — see its note). The local adapter
// functions for those four are deleted and imported above; call sites
// are unchanged. actorClassEntries stays here — it is the local
// multiclass (D6) fan-out over class_levels, not part of the contract.

/** Actor shape: { className, subclassName, level, classLevels }.
 *  classLevels entries are { class, level, subclass } (the stored
 *  row shape — see routes/character.js). Entries may also use
 *  className/subclassName keys; both are accepted. */
export function actorClassEntries(actor) {
  if (!actor) return [];
  const raw = actor.classLevels ?? actor.class_levels ?? null;
  const list = typeof raw === 'string' ? safeParse(raw, null) : raw;
  if (Array.isArray(list) && list.length) {
    return list
      .filter((e) => e && (e.class || e.className))
      .map((e) => ({
        className: e.class ?? e.className ?? null,
        subclassName: e.subclass ?? e.subclassName ?? null,
        level: Number(e.level) || 0,
      }));
  }
  if (!actor.className) return [];
  return [{ className: actor.className, subclassName: actor.subclassName ?? null, level: Number(actor.level) || 0 }];
}

/** Build an actor from a characters/companions row. kind is
 *  'player' | 'companion'. */
export function actorFromRow(kind, row) {
  if (!row) return { className: null, subclassName: null, level: 0, classLevels: null };
  const isPlayer = kind === 'player';
  return {
    className: isPlayer ? (row.class ?? null) : (row.companion_class ?? null),
    subclassName: isPlayer ? (row.subclass ?? null) : (row.companion_subclass ?? null),
    level: Number(isPlayer ? row.level : row.companion_level) || 0,
    classLevels: isPlayer ? (row.class_levels ?? null) : (row.companion_class_levels ?? row.class_levels ?? null),
  };
}

/** A DM-declared crit threshold on an enemy row (D5: enemies default
 *  to nat-20 only because they have no threshold source — not
 *  because the hook excludes them). Accepted homes, in order: a
 *  top-level crit_threshold / critThreshold on the row, then
 *  stats_json. Returns 20 when nothing is declared. NOTE: no
 *  declaration surface writes this field yet — the DM declares it
 *  by editing the enemy row / encounter setup; wiring a marker
 *  field for it is a follow-up (see HANDOFF.md). The enemy attack
 *  path that consumes this (enemyCombatService.resolveEnemyAttack,
 *  `isCrit = attackRoll === 20`) is NOT this file — see HANDOFF.md
 *  for the exact patch. */
export function enemyCritThreshold(enemy) {
  if (!enemy) return 20;
  const direct = Number(enemy.crit_threshold ?? enemy.critThreshold ?? NaN);
  if (Number.isFinite(direct) && direct >= 2 && direct <= 20) return Math.trunc(direct);
  const snap = safeParse(enemy.stats_json, null);
  const fromSnap = Number(snap?.crit_threshold ?? snap?.critThreshold ?? NaN);
  if (Number.isFinite(fromSnap) && fromSnap >= 2 && fromSnap <= 20) return Math.trunc(fromSnap);
  return 20;
}

/** Form-state record gate (Amendment 2 §4 / §3): the form-state
 *  record is owned by the entity family. This only READS it if
 *  present on the row (transformed_form / transformedForm, the
 *  Amendment 2 §1.2 shape `{ kind, until, ... }`); it never builds
 *  form state. Returns the record object, or null when the actor is
 *  not in a form. */
export function readFormState(row) {
  if (!row) return null;
  const raw = row.transformed_form ?? row.transformedForm ?? row.form_state ?? null;
  const state = typeof raw === 'string' ? safeParse(raw, null) : raw;
  if (!state || typeof state !== 'object') return null;
  if (!state.kind && !state.form && !state.active) return null;
  return state;
}

// ---------------------------------------------------------------------------
// Pure judging (exported for tests)
// ---------------------------------------------------------------------------

/** Parse '2d6+3' / '1d8' / '1d6-1' / '5' into { count, sides, modifier, flat }. */
export function parseDamageSpec(spec) {
  if (!spec || typeof spec !== 'string') return null;
  const s = spec.trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+$/.test(s)) return { count: 0, sides: 0, modifier: 0, flat: Number(s), terms: [] };
  // Dice expressions, including multi-term pools (Chaos Bolt 2d8+1d6,
  // Ice Storm 2d8+4d6): terms[] carries every pool; count/sides mirror
  // the first term for single-term consumers.
  const terms = [];
  let modifier = 0;
  for (const tok of s.split('+')) {
    const dm = /^(\d+)d(\d+)([+-]\d+)?$/.exec(tok);
    if (dm) { terms.push({ count: Number(dm[1]), sides: Number(dm[2]) }); if (dm[3]) modifier += Number(dm[3]); continue; }
    if (/^-?\d+$/.test(tok)) { modifier += parseInt(tok, 10); continue; }
    return null;
  }
  if (!terms.length) return null;
  return { count: terms[0].count, sides: terms[0].sides, modifier, flat: 0, terms };
}

/** The die that counts, given the mode. Extra dice are ignored; a
 *  missing second die degrades gracefully to the one reported. */
export function takenDieFor(dice, mode) {
  if (!Array.isArray(dice) || dice.length === 0) return null;
  if (mode === 'advantage') return Math.max(...dice);
  if (mode === 'disadvantage') return Math.min(...dice);
  return dice[0];
}

/** Zach's crit law, attack form: nat 20 always hits (and crits);
 *  nat 1 always misses. Otherwise taken die + bonus vs AC.
 *  Family 1: critThreshold (default 20) — a die at or above the
 *  threshold crits (and therefore hits, as a nat 20 does). */
export function judgeAttack({ takenDie, attackBonus, targetAc, critThreshold = 20 }) {
  const total = takenDie + attackBonus;
  if (takenDie === 20) return { total, hit: true, critical: 'hit' };
  if (takenDie === 1) return { total, hit: false, critical: 'miss' };
  const threshold = Number(critThreshold) || 20;
  if (takenDie >= threshold) return { total, hit: true, critical: 'hit' };
  return { total, hit: total >= targetAc, critical: null };
}

function crDamageDice(cr) {
  if (!cr || cr < 1) return '1d4';
  if (cr < 5) return '1d6';
  if (cr < 11) return '1d8';
  return '1d10';
}

// ---------------------------------------------------------------------------
// Profiles
// ---------------------------------------------------------------------------

function unarmedProfile(abilities, level, feats) {
  const strMod = abilityModifier(abilities?.str ?? abilities?.strength ?? 10);
  // Item 2: Unarmed Fighting style lifts unarmed strikes to 1d6.
  const dice = hasFeat(feats, 'Unarmed Fighting') ? '1d6' : '1';
  return { label: 'Unarmed Strike', attackBonus: strMod + proficiencyBonusForLevel(level), damageDice: dice, damageModifier: strMod, damageType: 'bludgeoning', properties: [] };
}

function weaponProfileFromStats(stats, abilities, level, feats) {
  if (stats?.weapon) {
    const w = stats.weapon;
    return { label: w.name, attackBonus: w.attackBonus, damageDice: w.damageDice, damageModifier: w.damageModifier, damageType: w.damageType,
      properties: w.properties || [], mastery: w.mastery || null, rangeType: w.rangeType || 'melee', range: w.range || null,
      offHandName: w.offHandName || null, offHandWeapon: stats.offHandWeapon || null, twoHanded: !!w.twoHanded };
  }
  const unarmed = unarmedProfile(abilities, level, feats);
  unarmed.offHandWeapon = stats?.offHandWeapon || null;
  return unarmed;
}

/**
 * Build the attack profile for an attacker. Returns
 * { profile } or { error }.
 * kind: 'player' | 'companion'; row: the characters/companions row.
 */
export function buildAttackProfile(kind, row, { spellName = null, damageOverride = null, hand = null, thrown = false, cleave = false, allyAdjacent = false, smiteSlot = null, smiteFiend = false } = {}) {
  const rawAbilities = safeParse(kind === 'player' ? row.ability_scores : row.companion_ability_scores, {});
  // Frost Exhaustion: erode once here for unarmed/heavy checks. Weapon
  // and spell paths erode inside calculateCombatStats/spellProfileFor
  // via actorShape's frost_exhaustion (spell actorShape below carries
  // these already-eroded abilities and no frost, so it is not eroded twice).
  const abilities = erodeScores(rawAbilities, row.frost_exhaustion ?? 0);
  const level = kind === 'player' ? row.level : row.companion_level;
  const className = kind === 'player' ? row.class : row.companion_class;
  // Item 2: feat list + ally-adjacent flag ride the profile build so
  // fighting styles, Rage, Smite, and Sneak eligibility can be read
  // in one place. allyAdjacent is a declaration until item 4 gives
  // the engine real adjacency; Sneak itself is gated in the resolve
  // paths, which know the roll mode.
  const feats = kind === 'player' ? parseFeatList(row.feats) : parseFeatList(row.companion_feats);
  const allyAdjacentFlag = !!allyAdjacent;

  if (spellName && (hand === 'off' || thrown || cleave)) return { error: 'a spell attack cannot be an off-hand, thrown, or Cleave attack' };
  if (spellName) {
    const actorShape = { ability_scores: abilities, level };
    const sp = spellProfileFor(actorShape, className);
    if (!sp) return { error: `${className || 'that class'} has no spell attack` };
    if (damageOverride) {
      const spec = parseDamageSpec(damageOverride);
      if (!spec) return { error: `spell attack "${spellName}": Damage="${damageOverride}" is not a dice spec like "1d10"` };
      return { profile: { label: spellName, attackBonus: sp.attackBonus, damageDice: damageOverride.trim(), damageModifier: 0, damageType: 'spell', spellAttack: true } };
    }
    // No Damage= in the marker: the catalog owns the spell's dice now
    // (spell-damage build). Homebrew spells without catalog data still
    // need Damage= as an override.
    const fx = spellEffectSpec(spellName, { casterLevel: level || 1 });
    if (!fx || fx.kind !== 'damage') return { error: `spell attack "${spellName}" needs Damage="1d10" in the marker (no catalog damage for this spell)` };
    return { profile: { label: spellName, attackBonus: sp.attackBonus, damageDice: fx.terms ? fx.terms.map(t => `${t.count}d${t.sides}`).join('+') : `${fx.count}d${fx.sides}`, damageModifier: fx.modifier + (fx.addCastingMod ? sp.modifier : 0), damageType: fx.damageType || 'spell', spellAttack: true } };
  }

  if (kind === 'companion' && row.progression_type === 'npc_stats' && (hand === 'off' || thrown || cleave)) {
    return { error: 'a statblock companion has no weapons to throw, dual-wield, or Cleave with' };
  }
  if (kind === 'companion' && row.progression_type === 'npc_stats') {
    const snap = safeParse(row.original_stats_snapshot, {}) || {};
    const cr = Number(snap.cr) || 0;
    return { profile: { label: 'Attack', attackBonus: crScaledModifier(cr), damageDice: crDamageDice(cr), damageModifier: 2, damageType: 'physical' } };
  }

  const actorShape = kind === 'player'
    ? { ability_scores: row.ability_scores, equipment: row.equipment, level: row.level, frost_exhaustion: row.frost_exhaustion, feats: row.feats }
    : { ability_scores: row.companion_ability_scores, equipment: row.equipment, level: row.companion_level, frost_exhaustion: row.frost_exhaustion, feats: row.companion_feats };
  const stats = calculateCombatStats(actorShape);
  let profile = weaponProfileFromStats(stats, abilities, level, feats);
  // Off-hand attack (combat item 1): replace the main-hand profile
  // with the off-hand weapon's. Two-weapon fighting needs a Light
  // weapon in EACH hand; the slots themselves are what make the two
  // weapons different, so two daggers (same name, different slots)
  // qualify. Damage carries no ability modifier (2024); the attack
  // roll still adds it (it is in offHandWeapon.attackBonus). Mastery
  // never rides an off-hand attack — Nick's folding of the extra
  // attack into the Attack action is narrated on the main-hand hit,
  // and the bonus-action cost itself is item 3's, not this one's.
  if (hand === 'off') {
    const off = profile.offHandWeapon;
    if (!off) return { error: 'no off-hand weapon to attack with' };
    if (!(off.properties || []).includes('light')) return { error: `${off.name} is not a Light weapon — it cannot make an off-hand attack` };
    if (!(profile.properties || []).includes('light')) return { error: `the main-hand ${profile.label} is not Light — two-weapon fighting needs a Light weapon in each hand` };
    // Item 2: Two-Weapon Fighting restores the ability modifier to
    // off-hand damage; without the style it stays 0 (item 1).
    // Item 3, Tier 2 (Nick ruling): keep the OFF-hand weapon's raw
    // mastery on the off-hand profile so the Nick gate below can
    // read it — the off-hand profile itself carries no mastery
    // (item 1), and the free extra attack belongs to the weapon
    // that MAKES the extra attack, not the main-hand weapon.
    const offWeaponMastery = off.mastery;
    profile = { label: off.name, attackBonus: off.attackBonus, damageDice: off.damageDice, damageModifier: hasFeat(feats, 'Two-Weapon Fighting') ? (off.damageModifier ?? 0) : 0, damageType: off.damageType,
      properties: off.properties || [], mastery: null, rangeType: off.rangeType || 'melee', range: off.range || null,
      offHandName: null, offHandWeapon: null, offHandAttack: true,
      offWeaponMastery };
  }
  // Weapon Mastery (Step 2, v1.0.195; picks added in combat item 1,
  // Zach 2026-10-29): the weapon's mastery property is live only for
  // classes with the 2024 Weapon Mastery feature AND only for a weapon
  // on that character's mastered list (migration 090). No list means
  // no mastery — the Step 2 any-weapon approximation is retired.
  const picks = parseMasteredWeapons(row.mastered_weapons);
  profile.masteredWeapons = picks;
  profile.mastery = profile.mastery && classHasMastery(className) && weaponIsMastered(picks, profile.label) ? profile.mastery : null;
  // Item 3, Tier 2 (Nick RULING, 2026-11-01, Muse's call on Zach's
  // delegation — supersedes the shipped item-1 main-hand model):
  // the Light extra attack is free of its bonus-action cost when
  // the OFF-hand weapon's live mastery is Nick. Reasons: mastery
  // properties belong to the weapon making the attack (Sap, Vex,
  // Topple all work that way), and the extra attack IS the off-hand
  // weapon's attack — so its mastery is the one that can fold it
  // into the Attack action. The main hand still needs Light (the
  // Light property is what grants the extra attack at all).
  if (profile.offWeaponMastery) {
    profile.nickFree = profile.offWeaponMastery === 'nick' && classHasMastery(className) && weaponIsMastered(picks, profile.label);
  }
  // Nick narration, same ruling: a main-hand profile records whether
  // its off-hand weapon is a mastered Nick weapon, so settleMastery
  // can narrate it without knowing the class or the picks list.
  const offW = profile.offHandWeapon;
  profile.nickAvailable = !!offW && offW.mastery === 'nick' && classHasMastery(className) && weaponIsMastered(picks, offW.name) && (profile.properties || []).includes('light');
  // Thrown (combat item 1): a declaration, not new math — a thrown
  // melee weapon already resolves on its melee ability modifier (see
  // calculateCombatStats), so this validates the property and records
  // the attack as thrown with the weapon's range. No distance is
  // checked; that is item 4.
  if (thrown) {
    if (!(profile.properties || []).includes('thrown')) return { error: `${profile.label} is not a thrown weapon` };
    profile.thrown = true;
    profile.thrownRange = profile.range || null;
  }
  // Cleave follow-up (combat item 1): a main-hand melee attack whose
  // damage carries no ability modifier. The flag itself (cleaveReady,
  // set by settleMastery and consumed by the attack entry points) is
  // what proves a Cleave hit granted this swing; a thrown Cleave is
  // not a melee attack and is refused here.
  if (cleave) {
    if (hand === 'off') return { error: 'Cleave is a main-hand melee attack' };
    if (thrown) return { error: 'a Cleave follow-up cannot be thrown — Cleave needs a melee attack' };
    if (profile.rangeType === 'ranged') return { error: 'Cleave needs a melee attack' };
    profile.cleave = true;
    profile.damageModifier = 0;
  }
  // Class features, combat item 2. Flat bonuses go in
  // featureDamageBonus, NOT damageModifier: damageModifier is the
  // ability modifier (Topple DC and the Cleave zero both read it),
  // and the resolve paths add featureDamageBonus at damage time for
  // companions, while PCs get it as an instruction in featureNotes
  // (their damage total is player-reported and must never be
  // silently added to). Archery is the exception: attack bonus IS
  // system-judged for PCs, so it lands directly.
  {
    const featureNotes = [];
    let featureDamageBonus = 0;
    const style = fightingStyleAdjustments({ feats, profile });
    if (style.attackBonusDelta) profile.attackBonus += style.attackBonusDelta;
    if (style.damageBonusDelta) featureDamageBonus += style.damageBonusDelta;
    if (style.gwfFloor) profile.gwfFloor = true;
    featureNotes.push(...style.notes);
    if (improvedDivineSmite(className, level) && profile.rangeType === 'melee' && !profile.spellAttack) {
      profile.improvedSmiteDice = '1d8';
      featureNotes.push('Improved Divine Smite: +1d8 radiant on this melee hit.');
    }
    const resources = parseClassResources(row.class_resources_json);
    if (String(className || '').toLowerCase().trim() === 'barbarian' && resources.raging && profile.rangeType === 'melee' && !profile.spellAttack) {
      const rd = rageDamage(level);
      featureDamageBonus += rd;
      featureNotes.push(`Rage: +${rd} damage (Strength attack while raging).`);
    }
    if (hasFeat(feats, 'Great Weapon Master') && (profile.properties || []).includes('heavy') && !profile.spellAttack) {
      profile.gwmBonus = greatWeaponMasterBonus(level);
      featureNotes.push(`Great Weapon Master: +${profile.gwmBonus} damage on this Heavy weapon hit (once per turn).`);
    }
    // Smite declaration (2024 spell, cast after a hit): the slot is
    // spent in the resolve paths, after the hit is confirmed — never
    // here, so a miss never burns a slot.
    if (smiteSlot && String(className || '').toLowerCase().trim() === 'paladin' && profile.rangeType === 'melee' && !profile.spellAttack) {
      const sd = smiteDice(smiteSlot, { fiendOrUndead: !!smiteFiend });
      profile.smite = { slot: Number(smiteSlot), dice: sd.dice, fiendOrUndead: !!smiteFiend };
      featureNotes.push(`Divine Smite: +${sd.dice} radiant if this hits (slot spent on a hit only).`);
    }
    // Sneak eligibility is recorded here; the once-per-turn gate and
    // the advantage/ally condition live in the resolve paths, which
    // know the roll mode.
    profile.sneakEligible = sneakAttackEligible({ className, level, profile });
    profile.sneakDice = profile.sneakEligible ? `${sneakAttackDice(level)}d6` : null;
    profile.allyAdjacent = allyAdjacentFlag;
    profile.featureDamageBonus = featureDamageBonus;
    profile.featureNotes = featureNotes;
  }
  // Mechanics hooks, Family 4: subclass A/E features, read from the
  // registry via featuresForActor (D6: every class_levels entry, not
  // just the primary class) — never by hardcoded subclass names.
  // The PC-vs-companion split is ABSOLUTE: companions get real math
  // in the total; PCs get an instruction in featureNotes, never a
  // silently added total. Once-per-turn first-hit bonuses (Divine
  // Fury, Divine Strike, Lunar Radiance, Assassinate's surprising
  // strikes) are NOT flat profile bonuses — they are recorded on the
  // profile and applied at settle time, after the hit is confirmed
  // (see settleSubclassHitEffects). A test asserting a PC total
  // includes a subclass bonus is asserting a bug.
  {
    const actor = actorFromRow(kind, row);
    const allSubclassFeats = featuresForActor(actor);
    const subclassFeats = allSubclassFeats.filter((f) => f.kind === 'A' || f.kind === 'E');
    const subclassNotes = [];
    const subResources = parseClassResources(row.class_resources_json);
    const raging = String(className || '').toLowerCase().trim() === 'barbarian' && !!subResources.raging;
    const barbarianLevel = (() => {
      const e = actorClassEntries(actor).find((x) => String(x.className || '').toLowerCase().trim() === 'barbarian');
      return e ? e.level : level;
    })();
    const clericLevel = (() => {
      const e = actorClassEntries(actor).find((x) => String(x.className || '').toLowerCase().trim() === 'cleric');
      return e ? e.level : level;
    })();
    const rogueLevel = (() => {
      const e = actorClassEntries(actor).find((x) => String(x.className || '').toLowerCase().trim() === 'rogue');
      return e ? e.level : level;
    })();
    // Divine Fury (Zealot, kind A): 1d6 + half barbarian level on the
    // first hit each turn, while Raging. Settle-time only.
    if (subclassFeats.some((f) => f.key === 'divine_fury') && raging && !profile.spellAttack) {
      const bonus = zealotDivineFuryBonus(barbarianLevel);
      profile.divineFury = { dice: bonus.dice, flat: bonus.flat, damageType: 'radiant', damageTypeChoice: 'necrotic or radiant' };
      subclassNotes.push(`Divine Fury: on your first hit this turn while Raging, add ${bonus.dice}+${bonus.flat} Necrotic or Radiant damage (once per turn).`);
    }
    // Divine Strike (Forge / Order cleric, kind A): once per turn on
    // a weapon hit. Same settle-time shape as Divine Fury; the two
    // cannot coexist on one actor (one cleric subclass), so the
    // first found wins.
    const forgeStrike = subclassFeats.find((f) => f.key === 'forge_divine_strike');
    const orderStrike = !forgeStrike ? subclassFeats.find((f) => f.key === 'order_divine_strike') : null;
    if ((forgeStrike || orderStrike) && !profile.spellAttack) {
      const dice = forgeStrike ? forgeDivineStrikeDice(clericLevel) : `${orderDivineStrikeDice(clericLevel).count}d${orderDivineStrikeDice(clericLevel).die}`;
      const damageType = forgeStrike ? 'fire' : 'psychic';
      profile.divineStrike = { dice, damageType };
      subclassNotes.push(`Divine Strike: on your first weapon hit this turn, add ${dice} ${damageType} damage (once per turn).`);
    }
    // Assassinate (kind E): if a Sneak Attack hits in the first
    // round, the target takes extra damage of the weapon's type
    // equal to Rogue level. Settle-time flat addition, gated on the
    // Sneak hit + round 1 in settleSubclassHitEffects.
    if (subclassFeats.some((f) => f.key === 'assassinate') && !profile.spellAttack) {
      profile.surprisingStrikes = { bonus: rogueLevel };
      subclassNotes.push(`Assassinate: if your Sneak Attack hits in the first round, add your Rogue level (${rogueLevel}) to the damage.`);
    }
    // Improved Circle Forms (Moon druid, kind E): conditional
    // modifiers on the druid's OWN rolls, gated on the druid being
    // in a form the DM tracks — the form-state record is owned by
    // the entity family and only READ here (see readFormState).
    // - Radiant choice: the attack MAY deal Radiant instead of its
    //   normal type, chosen each hit. There is no marker field to
    //   declare the choice yet, so the engine keeps the weapon's
    //   type and records the choice as available (see HANDOFF.md);
    //   it never silently retypes the damage.
    // - Magical attacks: form attacks count as magical — real math,
    //   carried into applyOutcomeDamage via formMagicalAttacks.
    // - Wis-to-Con saves while in form: a SAVE hook, not an attack
    //   hook — Family 6's file (rollRequestService), see HANDOFF.md.
    const inForm = readFormState(row);
    if (subclassFeats.some((f) => f.key === 'improved_circle_forms') && inForm) {
      profile.formMagicalAttacks = true;
      profile.lunarRadiance = true;
      subclassNotes.push('Improved Circle Forms: while in Wild Shape, this attack may deal Radiant damage instead of its normal damage type, and it counts as magical.');
      // Lunar Form (Moon 14, kind E): once per turn, +2d10 Radiant
      // on a Wild Shape form hit. Dice parsed from the registry
      // feature's own mechanics text, not hardcoded.
      const lunar = subclassFeats.find((f) => f.key === 'lunar_form');
      const lunarDice = lunar ? String(lunar.mechanics?.improvedLunarRadiance || '').match(/(\d+d\d+)/)?.[1] : null;
      if (lunar && lunarDice) {
        profile.lunarRadianceBonus = { dice: lunarDice, damageType: 'radiant' };
        subclassNotes.push(`Lunar Form: once per turn, add ${lunarDice} Radiant damage to a target you hit with a Wild Shape form attack.`);
      }
    }
    // Kind-F reclassifications that land in this file (Amendment 2
    // §2): Martial Training, Student of War, Assassin's Tools are
    // kind A — proficiency grants into the consolidated lists.
    // Keyed on the feature KEY, not the kind: all three are still
    // kind 'F' in the mirror registry (the F→A reclassification in
    // the data files is the F worker's — see HANDOFF.md), so a
    // kind-filtered lookup would miss them until that lands.
    // The ATTACK profile does not own proficiency consolidation
    // (that is the Stage-4 / level-up proficiency application, owned
    // by the F worker — see HANDOFF.md), so the grants are recorded
    // on the profile as data for that point to read, NOT applied
    // here and NOT narrated as attack math. Tool proficiencies
    // (Student of War, Assassin's Tools) are not attack-profile
    // proficiencies at all; they are recorded the same way so the
    // grant is not lost.
    const subclassProfs = [];
    if (allSubclassFeats.some((f) => f.key === 'martial_training')) {
      subclassProfs.push({ feature: 'martial_training', grants: ['medium armor', 'shields', 'simple weapons', 'martial weapons'], focus: 'a simple or martial weapon as a Bard spellcasting focus' });
    }
    if (allSubclassFeats.some((f) => f.key === 'student_of_war')) {
      subclassProfs.push({ feature: 'student_of_war', grants: ['one type of artisan tools, as given'] });
    }
    if (allSubclassFeats.some((f) => f.key === 'assassins_tools')) {
      subclassProfs.push({ feature: 'assassins_tools', grants: ['Disguise Kit', "Poisoner's Kit"], note: 'the kits themselves are inventory, not proficiency' });
    }
    if (subclassProfs.length) profile.subclassProficiencies = subclassProfs;
    // Exceptional Training / Bestial Fury / Share Spells (Beast
    // Master, Amendment 2 §4): the conditional-modifier side
    // attaches to the PRIMAL COMPANION entity once it exists — the
    // beast is not a companions-table row and there is no actor for
    // the hook here. Nothing in this file applies them to the
    // ranger's own rolls (that would be the wrong actor). See
    // HANDOFF.md for the entity-family patch.
    profile.featureNotes = [...(profile.featureNotes || []), ...subclassNotes];
  }
  // Heavy (2024): disadvantage when the relevant score is below 13 —
  // Strength for melee, Dexterity for ranged.
  if ((profile.properties || []).includes('heavy')) {
    const score = profile.rangeType === 'ranged'
      ? (abilities.dex ?? abilities.dexterity ?? 10)
      : (abilities.str ?? abilities.strength ?? 10);
    profile.heavyDisadvantage = Number(score) < 13;
  }
  return { profile };
}

// ---------------------------------------------------------------------------
// Session state: pending PC attack + recent outcomes
// ---------------------------------------------------------------------------

async function readSessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeSessionConfig(sessionId, config) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(config), sessionId]);
}

export async function getPendingAttack(sessionId) {
  const config = await readSessionConfig(sessionId);
  return config.pendingAttack || null;
}

async function stashOutcome(sessionId, outcome) {
  const config = await readSessionConfig(sessionId);
  const recent = Array.isArray(config.recentAttacks) ? config.recentAttacks : [];
  recent.push(outcome);
  config.recentAttacks = recent.slice(-5);
  await writeSessionConfig(sessionId, config);
}

async function logAttackRoll(characterId, sessionId, outcome) {
  try {
    await dbRun(
      `INSERT INTO roll_log (character_id, session_id, actor_kind, actor_name, kind, label, dc,
                             dice, taken_die, modifier, total, outcome, source)
       VALUES (?, ?, ?, ?, 'attack', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [characterId ?? null, sessionId ?? null, outcome.attackerKind, outcome.attacker,
       outcome.weapon, outcome.targetAc, JSON.stringify(outcome.dice || []), outcome.takenDie ?? null,
       outcome.attackBonus, outcome.total ?? null,
       outcome.critical === 'hit' ? 'critical_success' : outcome.critical === 'miss' ? 'critical_failure' : outcome.hit ? 'success' : 'failure',
       outcome.source || 'system']
    );
  } catch { /* roll_log is an audit trail, never a blocker */ }
}

// ---------------------------------------------------------------------------
// Mode + resolution core
// ---------------------------------------------------------------------------

/** Advantage state from BOTH sides' conditions + marker circumstance. */
export async function computeAttackMode(attackerKind, attackerId, enemy, marker = {}, sessionId = null, profile = null) {
  // 5e/2024 advantage algebra is presence-based, not pairwise: if ANY
  // source grants advantage and ANY source imposes disadvantage, the
  // roll is straight — no matter how many sources each side has.
  // Sequential pairwise merging breaks with 3+ sources (e.g. poisoned
  // attacker + prone target + Vex: pairwise cancels, then Vex flips
  // the roll back to advantage). Collect flags, resolve once at end.
  let hasAdvantage = false;
  let hasDisadvantage = false;
  const reasons = [];
  let penalty = 0;
  try {
    const aConds = await getConditions(attackerKind, attackerId);
    const atk = conditionAttackEffects(aConds);
    if (atk.advantage) { hasAdvantage = true; reasons.push(...atk.reasons); }
    if (atk.disadvantage) { hasDisadvantage = true; reasons.push(...atk.reasons); }
    penalty = atk.penalty || 0;
  } catch { /* best-effort */ }
  const eConds = safeParse(enemy?.active_conditions, []);
  const def = conditionDefenseEffects(Array.isArray(eConds) ? eConds : []);
  if (def.attackerAdvantage) { hasAdvantage = true; reasons.push(...def.reasons.map(r => `target ${r}`)); }
  if (def.attackerDisadvantage) { hasDisadvantage = true; reasons.push(...def.reasons.map(r => `target ${r}`)); }
  if (marker.advantage) hasAdvantage = true;
  if (marker.disadvantage) hasDisadvantage = true;
  // Mechanics hooks, Family 4: subclass advantage/disadvantage
  // source, same presence algebra as every source above. Only
  // triggers the mode function can evaluate from live state are
  // applied — dispatch is by registry feature KEY, never by
  // subclass name:
  // - Assassinate / Ever Vigilant (kind E): first round of combat,
  //   target has not taken a turn yet. Read from the live turn
  //   order; no turn order means the trigger cannot be evaluated
  //   and no advantage is granted (fail closed).
  // - Moonlight Step (kind C): advantage on the next attack roll
  //   after the step. The step marker (Family 8) records
  //   session_config.moonlightStepAdvantage['<kind>:<id>'] = true
  //   (or an enemy id to scope it); this consumes the flag on the
  //   roll, the Vex pattern. A missing flag is simply no advantage.
  // Anything else that grants attack advantage stays DM-side until
  // its trigger is modeled; see HANDOFF.md.
  try {
    if (sessionId && attackerId != null) {
      const attackerRow = attackerKind === 'player'
        ? await dbGet('SELECT class, subclass, level, class_levels FROM characters WHERE id = ?', [attackerId])
        : await dbGet('SELECT companion_class, companion_subclass, companion_level, companion_class_levels FROM companions WHERE id = ?', [attackerId]);
      if (attackerRow) {
        const modeActor = actorFromRow(attackerKind, attackerRow);
        const modeFeats = featuresForActor(modeActor);
        const firstRoundFeat = modeFeats.find((f) => f.key === 'assassinate' || f.key === 'ever_vigilant');
        if (firstRoundFeat && enemy?.id) {
          const encounterSeq = await getCurrentEncounterSeq(sessionId);
          if (encounterSeq) {
            const st = await getTurnState(sessionId, encounterSeq);
            if (st && st.round === 1 && Array.isArray(st.turnOrder)) {
              const targetKey = combatFallbackId(sessionId, encounterSeq, enemy.id);
              const targetIdx = st.turnOrder.findIndex((e) =>
                (e.key && e.key === targetKey) ||
                (e.type === 'enemy' && String(e.name || '').toLowerCase() === String(enemy.name || '').toLowerCase()));
              if (targetIdx > st.currentIndex) {
                hasAdvantage = true;
                reasons.push(`${firstRoundFeat.name}: first round, target has not acted yet`);
              }
            }
          }
        }
        if (modeFeats.some((f) => f.key === 'moonlight_step')) {
          const config = await readSessionConfig(sessionId);
          const stepKey = `${attackerKind}:${attackerId}`;
          const step = config.moonlightStepAdvantage && config.moonlightStepAdvantage[stepKey];
          if (step) {
            const scoped = step === true || step === enemy?.id || String(step) === String(enemy?.name || '');
            if (scoped) {
              delete config.moonlightStepAdvantage[stepKey];
              await writeSessionConfig(sessionId, config);
              hasAdvantage = true;
              reasons.push('Moonlight Step');
            }
          }
        }
      }
    }
  } catch { /* a subclass mode source never blocks an attack */ }
  // Heavy weapon below the 2024 ability threshold (Step 2).
  if (profile?.heavyDisadvantage) {
    hasDisadvantage = true;
    reasons.push('Heavy weapon (ability below 13)');
  }
  // Vex (Step 2): an earlier Vex hit leaves this attacker's next
  // attack against the same enemy advantaged. Consumed on use.
  if (sessionId && enemy?.id) {
    try {
      const config = await readSessionConfig(sessionId);
      const key = `${attackerKind}:${attackerId}`;
      if (config.masteryVex && config.masteryVex[key] === enemy.id) {
        delete config.masteryVex[key];
        await writeSessionConfig(sessionId, config);
        hasAdvantage = true;
        reasons.push('Vex');
      }
    } catch { /* best-effort */ }
  }
  // Item 3, Tier 3: Hidden, Help, and a dodging target — same
  // presence algebra, same consume-on-the-roll pattern as Vex.
  // Hidden and Help are consumed whether the final mode cancels to
  // straight or not (the roll itself carried the advantage).
  if (sessionId && enemy?.id) {
    try {
      const encounterSeq = await getCurrentEncounterSeq(sessionId);
      if (encounterSeq) {
        let attackerKey = null;
        if (attackerKind === 'player') attackerKey = await ledgerKeyForPlayer(attackerId);
        else {
          const row = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [attackerId]);
          if (row) attackerKey = await ledgerKeyForCompanion({ id: attackerId, npc_id: row.npc_id });
        }
        let attackerWasHidden = false;
        if (attackerKey) {
          const entry = await getEntry(sessionId, encounterSeq, attackerKey);
          if (entry.hidden) {
            attackerWasHidden = true;
            await clearField(sessionId, encounterSeq, attackerKey, 'hidden');
            hasAdvantage = true;
            reasons.push('Hidden');
          }
          if (entry.help && String(entry.help.targetName || '').toLowerCase() === String(enemy.name || '').toLowerCase()) {
            await clearField(sessionId, encounterSeq, attackerKey, 'help');
            hasAdvantage = true;
            reasons.push('Help');
          }
        }
        const targetEntry = await getEntry(sessionId, encounterSeq, combatFallbackId(sessionId, encounterSeq, enemy.id));
        if (targetEntry.dodge) {
          hasDisadvantage = true;
          reasons.push('Dodging target');
        }
        // Hide v2 (audit item 4): attacks against a hidden creature
        // are disadvantaged — the Invisible condition's other half.
        // Attacking a hidden creature does not unhide them.
        if (targetEntry.hidden) {
          hasDisadvantage = true;
          reasons.push('Hidden target');
        }
        // Combat item 4: a ranged attack in close combat — a
        // hostile creature in the attacker's area who can see them
        // — is disadvantaged. A hidden attacker cannot be seen, so
        // the penalty does not apply; spell attacks skip (their
        // ranges are catalog data, item 6). Melee attacks never
        // trigger it. No zones declared = one area, so any enemy in
        // the turn order counts as crowding the attacker.
        if (!profile?.spellAttack && (profile?.rangeType === 'ranged' || profile?.thrown === true) && attackerKey && !attackerWasHidden) {
          try {
            const { positionOf, readZones, turnOrderEntries, sideOf } = await import('./movementService.js');
            const zdata = await readZones(sessionId, encounterSeq);
            const myZone = positionOf(zdata, attackerKey);
            const attackerSide = attackerKind === 'enemy' ? 'enemy' : 'party';
            const entries = await turnOrderEntries(sessionId, encounterSeq);
            const crowded = entries.some((en) => en?.key && en.key !== attackerKey && sideOf(en) !== attackerSide && positionOf(zdata, en.key) === myZone);
            if (crowded) {
              hasDisadvantage = true;
              reasons.push('Ranged attack in melee');
            }
          } catch { /* best-effort */ }
        }
      }
    } catch { /* best-effort; action state never blocks an attack */ }
  }
  const mode = hasAdvantage && hasDisadvantage ? null : hasAdvantage ? 'advantage' : hasDisadvantage ? 'disadvantage' : null;
  return { mode, reasons: [...new Set(reasons)], penalty };
}

export function rollDamageFor(profile, critical) {
  const spec = parseDamageSpec(profile.damageDice) || { count: 1, sides: 4, modifier: 0, flat: 0, terms: [{ count: 1, sides: 4 }] };
  if (spec.flat) return { damage: Math.max(0, spec.flat + (profile.damageModifier || 0)), rolls: [] };
  const terms = spec.terms && spec.terms.length ? spec.terms : [{ count: spec.count, sides: spec.sides }];
  let total = 0;
  const rolls = [];
  for (const t of terms) {
    const c = critical === 'hit' ? t.count * 2 : t.count; // crits double every dice pool
    const r = roll(t.sides, c, { reason: `party damage: ${profile.label}` });
    // Item 2: Great Weapon Fighting floors every damage die at 3.
    const termRolls = profile.gwfFloor ? r.rolls.map(v => Math.max(3, v)) : r.rolls;
    total += termRolls.reduce((a, b) => a + b, 0);
    rolls.push(...termRolls);
  }
  return { damage: Math.max(0, total + spec.modifier + (profile.damageModifier || 0)), rolls };
}

// ---------------------------------------------------------------------------
// Weapon Mastery effects (Step 2, v1.0.195)
// ---------------------------------------------------------------------------

/** Set a mastery flag in the session scratchpad (Sap / Vex state). */
async function setMasteryFlag(sessionId, bucket, key, value) {
  try {
    const config = await readSessionConfig(sessionId);
    config[bucket] = config[bucket] && typeof config[bucket] === 'object' ? config[bucket] : {};
    config[bucket][key] = value;
    await writeSessionConfig(sessionId, config);
  } catch { /* mastery state is an enhancement, never a blocker */ }
}

// ---------------------------------------------------------------------------
// Combat item 1 helpers: ammunition, mastery picks, once-per-turn
// buckets, Cleave flags, and Slow state. All session scratchpad
// state lives in session_config beside the Step 2 Sap/Vex flags.
// ---------------------------------------------------------------------------

/** Weapon name → ammo type, for weapons with the ammunition property.
 *  Crossbows are checked before bows (a crossbow name contains 'bow').
 *  Returns null for a non-ammunition weapon or an ammunition weapon
 *  with no known ammo (a homebrew weapon defines its own ammo; the
 *  engine refuses to guess a name and does not gate it). */
export function ammoTypeForWeapon(weaponName, properties) {
  if (!(properties || []).includes('ammunition')) return null;
  const table = lookupWeaponData(weaponName);
  // Unknown/homebrew weapon: never guess an ammo name from the raw
  // name — the engine does not gate it (test group 3 locks this in).
  if (!table) return null;
  const name = String(table?.canonical || table?.name || '').toLowerCase().trim();
  if (name.includes('crossbow')) return 'bolts';
  if (name.includes('bow')) return 'arrows';
  if (name === 'sling') return 'bullets';
  if (name === 'blowgun') return 'needles';
  if (name === 'musket' || name === 'pistol') return 'bullets';
  if (name === 'hoopak') return 'bullets'; // setting weapon: ranged mode uses sling bullets
  return null;
}

const AMMO_ALIASES = {
  arrows: ['arrow', 'arrows'],
  bolts: ['bolt', 'bolts', 'crossbow bolt', 'crossbow bolts'],
  bullets: ['bullet', 'bullets', 'sling bullet', 'sling bullets'],
  needles: ['needle', 'needles', 'blowgun needle', 'blowgun needles']
};

function findAmmoItem(inventory, type) {
  const aliases = AMMO_ALIASES[type] || [];
  return (Array.isArray(inventory) ? inventory : []).find(i =>
    aliases.includes(String(i?.name || '').trim().toLowerCase().replace(/\s+/g, ' ')));
}

/**
 * Spend one round of ammunition for an attack, or refuse it.
 * Reads inventory fresh from the DB (never the caller's row object,
 * which goes stale across markers in one response). A zero-quantity
 * entry stays in the inventory at 0 — the looting scene can see what
 * ran out — and any later spend refuses on quantity <= 0. Returns
 * { ok, ammo } or { ok: false, reason }; { ok, skipped: true } when
 * the profile carries no ammunition gate (spell, unarmed, npc_stats,
 * or an ammunition weapon with no known ammo type).
 */
export async function spendAmmo(kind, attackerId, profile) {
  if (profile?.spellAttack) return { ok: true, skipped: true };
  const type = ammoTypeForWeapon(profile?.label, profile?.properties);
  if (!type) return { ok: true, skipped: true };
  const table = kind === 'player' ? 'characters' : kind === 'companion' ? 'companions' : null;
  if (!table || !attackerId) return { ok: true, skipped: true };
  const row = await dbGet(`SELECT inventory FROM ${table} WHERE id = ?`, [attackerId]);
  const inventory = safeParse(row?.inventory, []);
  const item = findAmmoItem(Array.isArray(inventory) ? inventory : [], type);
  const qty = item ? (Number(item.quantity) || 0) : 0;
  if (!item || qty <= 0) {
    return { ok: false, reason: `out of ${type} — ${profile.label} cannot be fired until more are carried` };
  }
  item.quantity = qty - 1;
  await dbRun(`UPDATE ${table} SET inventory = ? WHERE id = ?`, [JSON.stringify(inventory), attackerId]);
  return { ok: true, ammo: { type, remaining: qty - 1 } };
}

/** Record spent ammo per encounter, for the looting scene (Zach,
 *  2026-10-29: recovery is scavenging in the looting scene, never an
 *  automatic half-back — so item 1 tracks, it does not restore). */
async function recordAmmoSpent(sessionId, encounterSeq, type) {
  try {
    const config = await readSessionConfig(sessionId);
    config.ammoSpentByEncounter = config.ammoSpentByEncounter && typeof config.ammoSpentByEncounter === 'object' ? config.ammoSpentByEncounter : {};
    const bucket = config.ammoSpentByEncounter[encounterSeq] || {};
    bucket[type] = (bucket[type] || 0) + 1;
    config.ammoSpentByEncounter[encounterSeq] = bucket;
    await writeSessionConfig(sessionId, config);
  } catch { /* spent tracking never blocks the attack */ }
}

export async function getAmmoSpent(sessionId, encounterSeq) {
  const config = await readSessionConfig(sessionId);
  return (config.ammoSpentByEncounter && config.ammoSpentByEncounter[encounterSeq]) || {};
}

/** Item 3, Tier 1: once-per-turn flags live in the turn ledger
 *  (slot + world ID) when a turn order exists. Before any
 *  COMBAT_START there is no slot, so the legacy session_config maps
 *  under the old encounter-scoped key carry the flags, exactly as
 *  before — ordered combat never consults them. The ledger field
 *  names deliberately match the legacy map names.
 *  slotOverride pins a slot (a PC pending attack resolves against
 *  its declaration slot, not whatever slot is current at report).
 */
async function readFlag(sessionId, encounterSeq, ledgerKey, legacyKey, flag, slotOverride = null) {
  const slot = slotOverride || await currentSlotKey(sessionId, encounterSeq);
  if (slot) {
    const ledger = await readLedger(sessionId, encounterSeq);
    const slotBudgets = ledger?.[slot];
    const budget = slotBudgets && typeof slotBudgets === 'object' ? slotBudgets[ledgerKey] : null;
    return !!(budget && budget[flag]);
  }
  const config = await readSessionConfig(sessionId);
  const map = config[flag];
  return !!(map && map[legacyKey] === `${encounterSeq}:noturn`);
}

async function writeFlag(sessionId, encounterSeq, ledgerKey, legacyKey, flag, slotOverride = null) {
  const slot = slotOverride || await currentSlotKey(sessionId, encounterSeq);
  if (slot) {
    await updateBudgetForSlot(sessionId, encounterSeq, slot, ledgerKey, { [flag]: true });
    return;
  }
  const config = await readSessionConfig(sessionId);
  config[flag] = config[flag] && typeof config[flag] === 'object' ? config[flag] : {};
  config[flag][legacyKey] = `${encounterSeq}:noturn`;
  await writeSessionConfig(sessionId, config);
}

/** 2024 Loading weapons. Weapon data does not tag Loading yet, so
 *  the name set covers the 2024 Loading weapons until the table
 *  does (crossbows, all three). */
const LOADING_WEAPON_NAMES = new Set(['Light Crossbow', 'Hand Crossbow', 'Heavy Crossbow']);
function isLoadingWeapon(profile) {
  return (profile?.properties || []).includes('loading') || LOADING_WEAPON_NAMES.has(profile?.label);
}

async function peekCleaveFlag(sessionId, attackerKey) {
  const config = await readSessionConfig(sessionId);
  return (config.cleaveReady && config.cleaveReady[attackerKey]) || null;
}

/** Consume a Cleave flag (and mark the turn used). Returns the flag,
 *  null when there is none, or { stale: true } when it belongs to an
 *  earlier encounter (purged, never honored across encounters). */
async function consumeCleaveFlag(sessionId, encounterSeq, attackerKey, ledgerKey) {
  const config = await readSessionConfig(sessionId);
  const flag = config.cleaveReady && config.cleaveReady[attackerKey];
  if (!flag) return null;
  delete config.cleaveReady[attackerKey];
  if (flag.encounterSeq !== encounterSeq) {
    await writeSessionConfig(sessionId, config);
    return { stale: true };
  }
  // The used flag moves to the ledger (or the legacy map pre-combat);
  // the pending cleaveReady flag itself stays in session_config.
  // Config first: writeFlag re-reads it in the legacy branch, so a
  // stale-object write after it would clobber the flag.
  await writeSessionConfig(sessionId, config);
  await writeFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'cleaveUsed');
  return flag;
}

async function offHandUsedThisTurn(sessionId, encounterSeq, attackerKey, ledgerKey) {
  return readFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'offHandUsed');
}

/** Enemy size for the Push gate: the COMBAT_START snapshot first,
 *  then the bestiary entry, else null (unknown — the DM decides). */
async function enemySizeFor(enemy) {
  const snap = safeParse(enemy?.stats_json, null);
  if (snap?.size) return String(snap.size);
  try {
    const full = await lookupBestiaryFull(enemy?.name);
    if (full?.size) return String(full.size);
  } catch { /* no entry — unknown */ }
  return null;
}

const PUSHABLE_SIZES = new Set(['tiny', 'small', 'medium', 'large']);

/** Slow state: non-stacking −10 ft on one enemy, owned by the attacker
 *  who applied it, expiring at the start of that attacker's next turn.
 *  Expiry is stored as a (round, turn-order index) pair when turn order
 *  exists; when it does not, the attacker's next attack clears it (the
 *  proxy in the attack entry points). Speed itself is still not
 *  enforced anywhere — that is item 4. */
async function setSlowed(sessionId, encounterSeq, enemyId, ownerKey, ownerName) {
  try {
    const config = await readSessionConfig(sessionId);
    config.slowedEnemies = config.slowedEnemies && typeof config.slowedEnemies === 'object' ? config.slowedEnemies : {};
    let expiresRound = null;
    let expiresIndex = null;
    try {
      const st = await getTurnState(sessionId, encounterSeq);
      if (st && Array.isArray(st.turnOrder)) {
        const idx = ownerKey.startsWith('player:')
          ? st.turnOrder.findIndex(e => e.type === 'player')
          : st.turnOrder.findIndex(e => e.type === 'companion' && String(e.name || '').toLowerCase() === String(ownerName || '').toLowerCase());
        if (idx >= 0) {
          expiresIndex = idx;
          expiresRound = idx > st.currentIndex ? st.round : st.round + 1;
        }
      }
    } catch { /* no turn order — proxy clearing covers it */ }
    config.slowedEnemies[enemyId] = { amount: 10, ownerKey, ownerName, expiresRound, expiresIndex };
    await writeSessionConfig(sessionId, config);
  } catch { /* slow state never blocks the attack */ }
}

export async function getSlowedEnemies(sessionId) {
  const config = await readSessionConfig(sessionId);
  return (config.slowedEnemies && typeof config.slowedEnemies === 'object' ? config.slowedEnemies : {});
}

/** Called by combatTurnService.advanceTurn when the order lands on a
 *  combatant: any Slow owned by nobody else expires only when ITS
 *  owner's turn starts, so this clears exactly the entries expiring
 *  at (round, index). */
export async function expireSlowedOnTurn(sessionId, round, index) {
  try {
    const config = await readSessionConfig(sessionId);
    const slowed = config.slowedEnemies;
    if (!slowed || typeof slowed !== 'object') return;
    let changed = false;
    for (const [id, entry] of Object.entries(slowed)) {
      if (entry && entry.expiresRound === round && entry.expiresIndex === index) { delete slowed[id]; changed = true; }
    }
    if (changed) await writeSessionConfig(sessionId, config);
  } catch { /* expiry never breaks turn advancement */ }
}

export async function clearSlowedForOwner(sessionId, ownerKey) {
  try {
    const config = await readSessionConfig(sessionId);
    const slowed = config.slowedEnemies;
    if (!slowed || typeof slowed !== 'object') return;
    let changed = false;
    for (const [id, entry] of Object.entries(slowed)) {
      if (entry && entry.ownerKey === ownerKey) { delete slowed[id]; changed = true; }
    }
    if (changed) await writeSessionConfig(sessionId, config);
  } catch { /* best-effort */ }
}

/** Proxy expiry: when no turn order exists, the attacker's next attack
 *  stands in for the start of their next turn. With turn order, the
 *  advanceTurn hook is authoritative and this does nothing. */
async function proxyClearSlowed(sessionId, encounterSeq, ownerKey) {
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    if (!st) await clearSlowedForOwner(sessionId, ownerKey);
  } catch { /* best-effort */ }
}

/**
 * Record a character's mastered weapons. Every name must resolve to a
 * known weapon (a typo that stored silently would make a mastery
 * never fire, with no error to explain it). An empty list is a valid
 * record: nothing mastered. Count limits per class/level are NOT
 * enforced (not verified in this pass).
 */
export async function setMasteredWeapons(kind, id, weapons) {
  const table = kind === 'player' ? 'characters' : kind === 'companion' ? 'companions' : null;
  if (!table || !id) return { success: false, reason: 'unknown actor kind' };
  if (!Array.isArray(weapons)) return { success: false, reason: 'weapons must be a list' };
  const cleaned = weapons.map(w => String(w).trim()).filter(Boolean);
  for (const w of cleaned) {
    if (!lookupWeaponData(w)) return { success: false, reason: `unknown weapon: ${w}` };
  }
  await dbRun(`UPDATE ${table} SET mastered_weapons = ? WHERE id = ?`, [JSON.stringify(cleaned), id]);
  return { success: true, weapons: cleaned };
}

export async function getMasteredWeapons(kind, id) {
  const table = kind === 'player' ? 'characters' : kind === 'companion' ? 'companions' : null;
  if (!table || !id) return null;
  const row = await dbGet(`SELECT mastered_weapons FROM ${table} WHERE id = ?`, [id]);
  return parseMasteredWeapons(row?.mastered_weapons);
}

/** CON save modifier for a combat enemy: Step-1 snapshot first. */
function enemyConSaveModifier(enemy) {
  const snap = safeParse(enemy?.stats_json, null);
  if (snap) {
    if (snap.saves && snap.saves.con != null) return Number(snap.saves.con) || 0;
    if (snap.abilities && snap.abilities.con != null) return abilityModifier(snap.abilities.con);
  }
  const cr = Number(enemy?.challenge_rating) || 0;
  return cr > 0 ? Math.max(0, crScaledModifier(cr) - 2) : 0;
}

/** Topple: system-rolled CON save for the enemy; Prone on a failure. */
async function resolveTopple(enemy, dc, outcome) {
  const conds = safeParse(enemy?.active_conditions, []);
  if (Array.isArray(conds) && conds.includes('prone')) {
    outcome.topple = { dc, saved: null, applied: false, reason: 'already prone' };
    return;
  }
  const modifier = enemyConSaveModifier(enemy);
  const die = rollD20(`topple save: ${enemy.name}`);
  const total = die + modifier;
  const saved = total >= dc;
  let applied = false;
  let reason = null;
  if (!saved) {
    const res = await addCondition('enemy', enemy.id, 'prone');
    applied = !!res?.success;
    if (!applied) reason = res?.reason || 'condition refused';
  }
  outcome.topple = { dc, roll: die, modifier, total, saved, applied, ...(reason ? { reason } : {}) };
}

/**
 * Post-damage mastery settlement: Sap / Vex flags, Topple, and the
 * combat-item-1 masteries. Cleave grants a real follow-up (the flag
 * in session_config, spent by an ATTACK with Cleave="true"); Push
 * enforces its size gate and records the push; Slow records real
 * state with turn-based expiry. Nick stays a note on the main-hand
 * hit — the bonus-action cost it removes is item 3's, not this
 * one's — and Loading/Reach stay parked behind items 3 and 4.
 */
/** Mechanics hooks, Family 4: settle-time subclass hit effects.
 *  Post-hit E/A bonuses that need the hit confirmed AND the turn's
 *  first-hit state (Divine Fury, Divine Strike, Lunar Radiance,
 *  Assassinate's surprising strikes) land here, the settleMastery
 *  pattern — never in the profile as flat bonuses, which would pay
 *  them on every hit. Each effect is once per turn, enforced by the
 *  same turn-ledger flags as Sneak/GWM (readFlag/writeFlag).
 *  - Companions (and PC attacks the SYSTEM rolled, i.e. the
 *    reported-damage fallback in resolveReportedAttack): real math
 *    — the extra packet is rolled and applied through the typed
 *    damage path, so resistance/vulnerability apply, and the
 *    outcome totals include it.
 *  - PCs with a player-reported total: NO math is added. The
 *    pending block already instructed the player; the outcome only
 *    records that the instruction was given (applied: false with
 *    the reason), so the DM can see it was not double-counted.
 *  Divine Fury's damage type is Necrotic or Radiant, chosen each
 *  hit. There is no marker field to declare the choice yet, so a
 *  server-rolled companion defaults to Radiant and the outcome
 *  records the default + the available choice (operational decision,
 *  vetoable at the gate — see NOTES.md); the player chooses for a PC.
 *  Surprising strikes take the weapon's damage type and are NOT
 *  magical; the other three packets are feature damage and ARE
 *  magical for resistance purposes. */
async function settleSubclassHitEffects(sessionId, encounterSeq, attackerKey, profile, enemy, outcome, ledgerKey, characterId = null) {
  if (!outcome?.hit || outcome.spellAttack || !enemy?.id) return;
  const key = String(attackerKey || '');
  const isCompanion = key.startsWith('companion:');
  const isPlayerSystemRoll = key.startsWith('player:') && profile?.pcSystemRoll === true;
  const applyMath = isCompanion || isPlayerSystemRoll;
  const flagKey = ledgerKey || attackerKey;
  const attackerIdNum = Number(key.split(':')[1]) || null;
  const attacker = { kind: isCompanion ? 'companion' : 'player', id: attackerIdNum, name: outcome.attacker };

  async function applySettleBonus({ flag, dice, flat = 0, damageType, magical, label }) {
    if (!dice && !flat) return null;
    if (await readFlag(sessionId, encounterSeq, flagKey, attackerKey, flag)) {
      return { applied: false, reason: `${label} already used this turn` };
    }
    await writeFlag(sessionId, encounterSeq, flagKey, attackerKey, flag);
    if (!applyMath) {
      return { applied: false, reason: 'player-reported total — the pending block told the player to add it' };
    }
    let rolled = 0;
    let rolls = [];
    if (dice) {
      const spec = parseDamageSpec(dice);
      if (spec && spec.count > 0) {
        const r = roll(spec.sides, spec.count, { reason: label });
        rolled = r.total;
        rolls = r.rolls;
      }
    }
    const amount = Math.max(0, rolled + (Number(flat) || 0));
    let dealt = 0;
    if (amount > 0) {
      const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemy.name, amount, characterId,
        { damageType, magical: !!magical, attacker });
      dealt = res?.damageDealt ?? 0;
      if (res?.killed) outcome.killed = true;
      outcome.targetHpAfter = res?.remainingHp ?? outcome.targetHpAfter ?? null;
      outcome.damage = (outcome.damage || 0) + amount;
      outcome.damageDealt = (outcome.damageDealt ?? 0) + dealt;
    }
    return { applied: true, dice: dice || null, flat: Number(flat) || 0, damage: amount, dealt, damageType, rolls };
  }

  if (profile?.divineFury) {
    const f = profile.divineFury;
    outcome.divineFury = await applySettleBonus({
      flag: 'divineFuryUsed', dice: f.dice, flat: f.flat,
      damageType: f.damageType || 'radiant', magical: true,
      label: `Divine Fury (${f.damageTypeChoice || 'necrotic or radiant'}; radiant by default for a server roll)`,
    });
    if (outcome.divineFury) outcome.divineFury.damageTypeChoice = f.damageTypeChoice || 'necrotic or radiant';
  }
  if (profile?.divineStrike) {
    const s = profile.divineStrike;
    outcome.divineStrike = await applySettleBonus({
      flag: 'divineStrikeUsed', dice: s.dice, flat: 0,
      damageType: s.damageType, magical: true, label: 'Divine Strike',
    });
  }
  if (profile?.lunarRadianceBonus) {
    const l = profile.lunarRadianceBonus;
    outcome.lunarRadianceBonus = await applySettleBonus({
      flag: 'lunarRadianceUsed', dice: l.dice, flat: 0,
      damageType: l.damageType || 'radiant', magical: true, label: 'Lunar Form',
    });
  }
  if (profile?.surprisingStrikes) {
    // Gated on the Sneak hit that enables it, and on round 1 — both
    // read from live state, never assumed. A failed round read fails
    // closed (no bonus) rather than paying it on the wrong round.
    let roundOne = false;
    try {
      const st = await getTurnState(sessionId, encounterSeq);
      roundOne = !!st && st.round === 1;
    } catch { roundOne = false; }
    if (outcome.sneakAttack?.applied !== false && roundOne) {
      outcome.surprisingStrikes = await applySettleBonus({
        flag: 'surprisingStrikesUsed', dice: null, flat: profile.surprisingStrikes.bonus,
        damageType: outcome.damageType, magical: false, label: 'Assassinate (surprising strikes)',
      });
    }
  }
}

async function settleMastery(sessionId, encounterSeq, attackerKey, profile, enemy, outcome, toppleDc, ledgerKey = null, characterId = null) {
  // Family 4 settle-time subclass effects run first, before the
  // mastery guard below — they apply on hits with no live mastery
  // just as surely as on hits with one. A failure inside never
  // breaks mastery settlement (or the attack).
  try {
    await settleSubclassHitEffects(sessionId, encounterSeq, attackerKey, profile, enemy, outcome, ledgerKey, characterId);
  } catch { /* settle-time subclass math never breaks the attack */ }
  const m = profile?.mastery;
  // Nick (ruling above) is not the main weapon's mastery, so a main
  // attack with no live mastery still settles when Nick is available.
  if ((!m && !profile?.nickAvailable) || outcome.spellAttack || !outcome.hit) return;
  const dealt = outcome.damageDealt != null ? outcome.damageDealt : outcome.damage;
  if (m === 'sap') {
    if (enemy?.id && !outcome.killed) {
      await setMasteryFlag(sessionId, 'masterySap', enemy.id, true);
      outcome.sappedTarget = true;
    }
  } else if (m === 'vex') {
    if (enemy?.id && dealt > 0) {
      await setMasteryFlag(sessionId, 'masteryVex', attackerKey, enemy.id);
      outcome.vexGained = true;
    }
  } else if (m === 'topple') {
    if (enemy?.id && !outcome.killed) await resolveTopple(enemy, toppleDc, outcome);
  } else if (m === 'cleave') {
    // A Cleave follow-up never re-offers, and a hit that killed its
    // target can still cleave — the trigger is the hit, not the kill.
    if (profile.rangeType !== 'ranged' && !profile.cleave) {
      const key = ledgerKey || attackerKey;
      if (await readFlag(sessionId, encounterSeq, key, attackerKey, 'cleaveUsed')) {
        outcome.masteryNote = `Cleave already used this turn.`;
      } else {
        try {
          const actives = await getActiveEnemies(sessionId, encounterSeq);
          if ((actives || []).some(e => e.id !== enemy?.id)) {
            await setMasteryFlag(sessionId, 'cleaveReady', attackerKey, { firstTarget: enemy?.name || null, weapon: profile.label, encounterSeq });
            outcome.cleaveReady = true;
            outcome.masteryNote = `Cleave: ${outcome.attacker} may make one melee attack roll with the ${profile.label} against a second creature within 5 feet of ${outcome.target} and within reach (no ability modifier added to that damage). The second target must be positioned correctly — it is not a free pick.`;
          }
        } catch { /* best-effort */ }
      }
    }
  } else if (m === 'push') {
    if (!outcome.killed) {
      const size = await enemySizeFor(enemy);
      if (size && !PUSHABLE_SIZES.has(size.toLowerCase())) {
        outcome.pushDenied = { size };
        outcome.masteryNote = `Push: ${outcome.target} is ${size} — too large to push.`;
      } else if (!size) {
        outcome.pushUnverified = true;
        outcome.masteryNote = `Push: ${outcome.target} was hit, but its size is not on record — the DM decides whether it can be pushed up to 10 feet straight away (Large or smaller only).`;
      } else {
        outcome.pushed = { distanceFt: 10, direction: 'straight away' };
        outcome.masteryNote = `Push: ${outcome.target} is pushed up to 10 feet straight away.`;
      }
    }
  } else if (m === 'slow') {
    if (dealt > 0 && !outcome.killed && enemy?.id) {
      await setSlowed(sessionId, encounterSeq, enemy.id, attackerKey, outcome.attacker);
      outcome.slowed = { amount: 10, until: `the start of ${outcome.attacker}'s next turn` };
      outcome.masteryNote = `Slow: ${outcome.target}'s Speed is reduced by 10 feet until the start of ${outcome.attacker}'s next turn.`;
    }
  }
  // Nick narration, appended AFTER the main mastery so a Vex/Sap
  // main weapon does not swallow it (ruling above: Nick belongs to
  // the off-hand weapon, so it cannot live in the main-mastery chain).
  if (profile.nickAvailable) {
    const off = profile.offHandName ? lookupWeaponData(profile.offHandName) : null;
    // Slots differ by construction, so two daggers (same name, two
    // slots) qualify — the old name-inequality check rejected them.
    if (off && (off.properties || []).includes('light')) {
      outcome.masteryNote = `${outcome.masteryNote ? outcome.masteryNote + ' ' : ''}Nick: the Light-property extra attack with the ${off.name} is part of this Attack action, not a Bonus Action.`;
    }
  }
}

/** Item 6: a live Shield entry adds +5 AC (until start of next turn). */
async function enemyShieldBonus(sessionId, encounterSeq, enemy) {
  try {
    const { shieldBonusFor } = await import('./enemySpellService.js');
    return await shieldBonusFor(sessionId, encounterSeq, combatFallbackId(sessionId, encounterSeq, enemy.id));
  } catch { return 0; }
}

async function applyOutcomeDamage(sessionId, encounterSeq, characterId, enemy, outcome, opts = {}) {
  if (outcome.hit && outcome.damage > 0) {
    // Step 1 (v1.0.194): typed damage — the enemy's snapshot applies
    // resistance / vulnerability / immunity. Weapon hits count as
    // nonmagical; spell attacks as magical. Family 4: a Moon druid
    // in Wild Shape form (Improved Circle Forms) also counts as
    // magical — outcome.formMagicalAttacks carries it from the
    // profile, for both companions and PCs.
    const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemy.name, outcome.damage, characterId,
      { damageType: outcome.damageType, magical: !!outcome.spellAttack || !!outcome.formMagicalAttacks, attacker: opts.attacker || null });
    outcome.damageResult = res;
    if (res) {
      outcome.damageDealt = res.damageDealt;
      outcome.damageAdjustment = res.damageAdjustment || null;
    }
    outcome.targetHpAfter = res?.remainingHp ?? null;
    outcome.killed = !!res?.killed;
  }
  // Graze (Step 2): a missed attack with a Graze weapon still deals
  // the ability modifier as damage of the weapon's type, through the
  // same typed path (resistance / immunity apply; it can kill).
  if (!outcome.hit && outcome.grazeDamage > 0) {
    const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemy.name, outcome.grazeDamage, characterId,
      { damageType: outcome.damageType, magical: false, attacker: opts.attacker || null });
    outcome.grazeResult = res;
    if (res) {
      outcome.grazeDealt = res.damageDealt;
      outcome.grazeAdjustment = res.damageAdjustment || null;
    }
    outcome.targetHpAfter = res?.remainingHp ?? outcome.targetHpAfter ?? null;
    outcome.killed = !!res?.killed;
  }
  // Item 6, Tier F2: a banked Absorb rider adds 1d6 of its type to
  // the next same-zone melee hit and is consumed. Ranged, thrown,
  // and spell attacks never consume it, and neither do misses
  // (Graze is not a hit). Best-effort: a rider never breaks an attack.
  if (outcome.hit && !opts.ranged && opts.attackerKey) {
    try {
      const ess = await import('./enemySpellService.js');
      const rider = await ess.absorbRiderFor(sessionId, encounterSeq, opts.attackerKey);
      if (rider) {
        const targetKey = combatFallbackId(sessionId, encounterSeq, enemy.id);
        if (await ess.sameZone(sessionId, encounterSeq, opts.attackerKey, targetKey)) {
          const riderDamage = roll(6, 1, { reason: 'absorb rider' }).total;
          const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemy.name, riderDamage, characterId,
            { damageType: rider.type, magical: true, attacker: opts.attacker || null });
          outcome.riderDamage = riderDamage;
          outcome.riderType = rider.type;
          outcome.riderDealt = res?.damageDealt ?? 0;
          if (res?.killed) outcome.killed = true;
          outcome.targetHpAfter = res?.remainingHp ?? outcome.targetHpAfter ?? null;
          await ess.consumeAbsorb(sessionId, encounterSeq, opts.attackerKey);
        }
      }
    } catch { /* rider never breaks an attack */ }
  }
  return outcome;
}

/** Companion attack: fully server-resolved, immediately. */
export async function resolveCompanionAttack(sessionId, characterId, companionRow, enemy, { spellName = null, damageOverride = null, marker = {}, hand = null, thrown = false, cleave = false, allyAdjacent = false, smiteSlot = null, smiteFiend = false, reaction = false, bonusAttack = false, readyFired = false } = {}) {
  const encounterSeq = await getCurrentEncounterSeq(sessionId);
  const attackerKey = `companion:${companionRow.id}`;
  const ledgerKey = await ledgerKeyForCompanion(companionRow);
  const built = buildAttackProfile('companion', companionRow, { spellName, damageOverride, hand, thrown, cleave, allyAdjacent, smiteSlot, smiteFiend });
  if (built.error) return { type: 'party_attack', success: false, reason: built.error };
  const profile = built.profile;
  // Combat item 4: reach, thrown, and ranged bands — before any
  // gate spends anything, so a refused attack consumes nothing.
  // Spell attacks skip (their ranges are catalog data, item 6).
  // Opportunity attacks skip: an OA is valid because a MOVE
  // provoked it, and the book resolves it just before the target
  // leaves reach — current positions would refuse every
  // legitimate cross-zone OA.
  let longRangeReason = null;
  // Cleave follow-ups skip this gate: the Cleave block below checks
  // BOTH distances (first-to-second and attacker-to-second) with
  // the specific Cleave reasons, so it subsumes the generic check.
  if (!reaction && !cleave) {
    const { checkAttackDistance } = await import('./movementService.js');
    const dist = await checkAttackDistance(sessionId, encounterSeq, ledgerKey, 'companion', companionRow.id, enemy, profile);
    // NOTE: a disadvantage result also carries a reason label —
    // only a reason WITHOUT disadvantage is a refusal.
    if (dist?.reason && !dist?.disadvantage) return { type: 'party_attack', success: false, reason: dist.reason };
    if (dist?.disadvantage) { marker.disadvantage = dist.reason; longRangeReason = dist.reason; }
  }
  // Item 3, Tier 3: a readied attack firing — the stored READY and
  // an available reaction are required, and the reaction is spent
  // here, before any other gate. A readied attack is not an
  // Attack-action swing: no swing cap, no bonus charge, no budget
  // record. Without a turn order there are no reactions to track
  // (legacy: the stored ready alone is enough).
  if (readyFired) {
    const readyEntry = await getEntry(sessionId, encounterSeq, ledgerKey);
    if (!readyEntry.ready) return { type: 'party_attack', success: false, reason: `no readied action stored for ${companionRow.display_name || 'this companion'}` };
    const st = await getTurnState(sessionId, encounterSeq);
    if (st) {
      let attackerName = companionRow.display_name;
      if (!attackerName) {
        const npc = await dbGet('SELECT name FROM npcs WHERE id = ?', [companionRow.npc_id]);
        attackerName = npc?.name || 'Companion';
      }
      if (!(await hasReactionAvailable(sessionId, encounterSeq, attackerName))) return { type: 'party_attack', success: false, reason: 'reaction already used' };
      await useReaction(sessionId, encounterSeq, attackerName);
    }
    await clearField(sessionId, encounterSeq, ledgerKey, 'ready');
  }
  // Item 3, Tier 1 gates, FIRST: turn identity (reactions exempt —
  // they legitimately fire on others' turns), then the attack budget
  // (Extra Attack cap, Loading, off-hand needs a main-hand Attack
  // action). Both refuse before anything is consumed. With no turn
  // order there is no budget to check (legacy behavior: no caps).
  // A readied firing is reaction-like: it legitimately fires on
  // another combatant's turn, so it is exempt from identity too.
  if (!reaction && !readyFired) {
    const identity = await checkTurnIdentity(sessionId, encounterSeq, ledgerKey);
    if (!identity.allowed) return { type: 'party_attack', success: false, reason: `${identity.reason} ${identity.remedy}` };
  }
  const slot = await currentSlotKey(sessionId, encounterSeq);
  const attackOpts = { extraAttacks: extraAttackCount(companionRow.companion_class, companionRow.companion_level), isLoading: isLoadingWeapon(profile), hand, cleave };
  // Item 3, Tier 2: a bonus-action attack (Bonus="true", e.g. GWM /
  // Polearm Master) charges the bonus instead of an Attack-action
  // swing — it skips the swing cap and never sets attackActionTaken.
  // An off-hand attack passes BOTH gates: the Tier 1 swing gate
  // (Attack action first, once per turn) AND the bonus gate (unless
  // Nick). Checking only the bonus let an off-hand attack fire
  // before any main-hand Attack action — the 3b regression.
  const chargesBonus = !readyFired && (bonusAttack || (hand === 'off' && !profile.nickFree));
  if (slot) {
    if (!bonusAttack && !readyFired) {
      const budget = await getBudget(sessionId, encounterSeq, ledgerKey);
      const decision = attackBudgetDecision(budget || {}, attackOpts);
      if (!decision.allowed) return { type: 'party_attack', success: false, reason: `${decision.reason} ${decision.remedy}` };
    }
    if (chargesBonus) {
      const bc = await checkBonus(sessionId, encounterSeq, ledgerKey);
      if (!bc.allowed) return { type: 'party_attack', success: false, reason: `${bc.reason} ${bc.remedy}` };
    }
  }
  // Gate order matters: nothing is consumed before the attack is real.
  // A refused attack (no Cleave, off-hand spent, out of ammo) leaves
  // every flag exactly as it was — Vex especially must not be eaten
  // by an attack that never happened.
  if (cleave) {
    if (profile.mastery !== 'cleave') return { type: 'party_attack', success: false, reason: `${profile.label} is not a Cleave weapon` };
    const flag = await peekCleaveFlag(sessionId, attackerKey);
    if (!flag) return { type: 'party_attack', success: false, reason: 'no Cleave follow-up is available for this attacker' };
    if (flag.firstTarget && flag.firstTarget.toLowerCase() === String(enemy?.name || '').toLowerCase()) return { type: 'party_attack', success: false, reason: 'a Cleave follow-up must target a second creature, not the first target' };
    if (flag.weapon && String(flag.weapon).toLowerCase() !== String(profile.label).toLowerCase()) return { type: 'party_attack', success: false, reason: `the Cleave follow-up must use the ${flag.weapon}` };
    // Combat item 4: the follow-up needs the second target within
    // 5 ft of the first AND within reach — checked before the flag
    // is consumed, so a refused follow-up stays available.
    const cleaveReach = (profile.properties || []).includes('reach') ? 10 : 5;
    const { checkCleaveDistance } = await import('./movementService.js');
    const cd = await checkCleaveDistance(sessionId, encounterSeq, ledgerKey, flag.firstTarget, enemy, cleaveReach);
    if (cd?.reason) return { type: 'party_attack', success: false, reason: cd.reason };
  }
  if (hand === 'off' && await offHandUsedThisTurn(sessionId, encounterSeq, attackerKey, ledgerKey)) {
    return { type: 'party_attack', success: false, reason: 'the off-hand attack has already been used this turn' };
  }
  const spent = await spendAmmo('companion', companionRow.id, profile);
  if (!spent.ok) return { type: 'party_attack', success: false, reason: spent.reason };
  if (spent.ammo) await recordAmmoSpent(sessionId, encounterSeq, spent.ammo.type);
  if (cleave) {
    const consumed = await consumeCleaveFlag(sessionId, encounterSeq, attackerKey, ledgerKey);
    if (!consumed || consumed.stale) return { type: 'party_attack', success: false, reason: 'the Cleave follow-up is no longer available (it belonged to an earlier encounter)' };
  }
  // Commit the budget only now that the attack is real. Pre-combat
  // (no slot) only the off-hand flag has legacy meaning.
  if (slot) {
    if (chargesBonus) await spendBonus(sessionId, encounterSeq, ledgerKey, bonusAttack ? 'bonus-action attack' : 'off-hand attack');
    if (!bonusAttack && !readyFired) await recordAttack(sessionId, encounterSeq, ledgerKey, attackOpts);
  } else if (hand === 'off') await writeFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'offHandUsed');
  await proxyClearSlowed(sessionId, encounterSeq, attackerKey);
  const { mode, reasons, penalty } = await computeAttackMode('companion', companionRow.id, enemy, marker, sessionId, profile);
  if (longRangeReason) reasons.push(longRangeReason);
  const moraleBuff = await getMoraleBuff(sessionId, encounterSeq, 'friendlies').catch(() => 0);
  const attackBonus = profile.attackBonus + (moraleBuff || 0) + (penalty || 0);
  const shield = await enemyShieldBonus(sessionId, encounterSeq, enemy).catch(() => 0);
  const targetAc = (enemy.armor_class || 10) + getCoverAcBonus(enemy.cover) + shield;
  const dice = mode ? [rollD20(`companion attack: ${profile.label}`), rollD20(`companion attack: ${profile.label}`)] : [rollD20(`companion attack: ${profile.label}`)];
  const takenDie = takenDieFor(dice, mode);
  // Family 1: crit threshold from the attacker's class/subclass/level
  // (D6: class_levels). Enemies are not judged here; an enemy row's
  // DM-declared threshold is read by enemyCritThreshold for the
  // enemy attack path (enemyCombatService — see HANDOFF.md).
  const critThreshold = critThresholdForActor(actorFromRow('companion', companionRow));
  const judged = judgeAttack({ takenDie, attackBonus, targetAc, critThreshold });
  let sneakApplied = null;
  let smiteApplied = null;
  let gwmApplied = null;
  if (judged.hit) {
    if (profile.featureDamageBonus) profile.damageModifier = (profile.damageModifier || 0) + profile.featureDamageBonus;
    if (profile.improvedSmiteDice) profile.damageDice = `${profile.damageDice}+${profile.improvedSmiteDice}`;
    if (profile.sneakEligible && (mode === 'advantage' || allyAdjacent)) {
      if (!(await readFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'sneakUsed'))) {
        profile.damageDice = `${profile.damageDice}+${profile.sneakDice}`;
        sneakApplied = { dice: profile.sneakDice };
        await writeFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'sneakUsed');
      }
    }
    if (profile.gwmBonus) {
      if (!(await readFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'gwmUsed'))) {
        profile.damageModifier = (profile.damageModifier || 0) + profile.gwmBonus;
        gwmApplied = { bonus: profile.gwmBonus };
        await writeFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'gwmUsed');
      }
    }
    if (profile.smite) {
      // Item 3, Tier 2: Divine Smite is cast as a bonus action after
      // a hit — a spent bonus refuses the smite (and spends no slot),
      // a free bonus is charged when the slot is spent.
      const bc = await checkBonus(sessionId, encounterSeq, ledgerKey);
      if (!bc.allowed) {
        smiteApplied = { slot: profile.smite.slot, dice: profile.smite.dice, spent: false, reason: bc.reason };
      } else {
        const spentSlot = await spendSpellSlot('companion', companionRow.id, profile.smite.slot);
        if (spentSlot.success) {
          await spendBonus(sessionId, encounterSeq, ledgerKey, 'Divine Smite');
          profile.damageDice = `${profile.damageDice}+${profile.smite.dice}`;
          smiteApplied = { slot: profile.smite.slot, dice: profile.smite.dice, spent: true };
        } else {
          smiteApplied = { slot: profile.smite.slot, dice: profile.smite.dice, spent: false, reason: spentSlot.reason };
        }
      }
    }
  }
  const dmg = judged.hit ? rollDamageFor(profile, judged.critical) : { damage: 0, rolls: [] };
  const attackerName = companionRow.display_name || companionRow.name || 'Companion';
  const outcome = {
    type: 'party_attack', success: true, attackerKind: 'companion', attacker: attackerName,
    target: enemy.name, weapon: profile.label, dice, takenDie, attackBonus, total: judged.total,
    targetAc, hit: judged.hit, critical: judged.critical, critThreshold, formMagicalAttacks: !!profile.formMagicalAttacks, mode, modeReasons: reasons, penalty: penalty || 0,
    damage: dmg.damage, damageRolls: dmg.rolls, damageType: profile.damageType, spellAttack: !!profile.spellAttack, source: 'system',
    mastery: profile.mastery || null,
    ammo: spent.ammo || null, thrown: !!profile.thrown, thrownRange: profile.thrownRange || null,
    offHandAttack: !!profile.offHandAttack, cleave: !!profile.cleave, bonusAttack: !!bonusAttack, readyFired: !!readyFired,
    featureNotes: profile.featureNotes || [], sneakAttack: sneakApplied, smite: smiteApplied, gwm: gwmApplied
  };
  if (!judged.hit && profile.mastery === 'graze') outcome.grazeDamage = Math.max(0, profile.damageModifier || 0);
  await applyOutcomeDamage(sessionId, encounterSeq, characterId, enemy, outcome, { attackerKey: ledgerKey, ranged: !!profile.spellAttack || profile.rangeType === 'ranged' || !!profile.thrown, attacker: { kind: 'companion', id: companionRow.id, name: attackerName } });
  const toppleDc = 8 + (profile.damageModifier || 0) + proficiencyBonusForLevel(companionRow.companion_level || 1);
  await settleMastery(sessionId, encounterSeq, `companion:${companionRow.id}`, profile, enemy, outcome, toppleDc, ledgerKey, characterId);
  await stashOutcome(sessionId, outcome);
  await logAttackRoll(characterId, sessionId, outcome);
  return outcome;
}

// ---------------------------------------------------------------------------
// PC pending attack (the player rolls real dice — the 185 model)
// ---------------------------------------------------------------------------

export async function createPcPendingAttack(sessionId, characterId, characterRow, enemy, { spellName = null, damageOverride = null, marker = {}, hand = null, thrown = false, cleave = false, allyAdjacent = false, smiteSlot = null, smiteFiend = false, reaction = false, bonusAttack = false, readyFired = false } = {}) {
  const built = buildAttackProfile('player', characterRow, { spellName, damageOverride, hand, thrown, cleave, allyAdjacent, smiteSlot, smiteFiend });
  if (built.error) return { error: built.error };
  const profile = built.profile;
  const encounterSeq = await getCurrentEncounterSeq(sessionId);
  const attackerKey = `player:${characterId}`;
  const ledgerKey = await ledgerKeyForPlayer(characterId);
  // Combat item 4: reach, thrown, and ranged bands — same rule as
  // the companion path (see above): before any gate spends
  // anything, spell attacks skip, opportunity attacks skip.
  // NOTE: a disadvantage result also carries a reason label —
  // only a reason WITHOUT disadvantage is a refusal.
  let longRangeReason = null;
  // Cleave follow-ups skip this gate: the Cleave block below checks
  // BOTH distances (first-to-second and attacker-to-second) with
  // the specific Cleave reasons, so it subsumes the generic check.
  if (!reaction && !cleave) {
    const { checkAttackDistance } = await import('./movementService.js');
    const dist = await checkAttackDistance(sessionId, encounterSeq, ledgerKey, 'player', characterId, enemy, profile);
    if (dist?.reason && !dist?.disadvantage) return { error: dist.reason };
    if (dist?.disadvantage) { marker.disadvantage = dist.reason; longRangeReason = dist.reason; }
  }
  // Item 3, Tier 3: a readied attack firing (same rule as the
  // companion path — stored READY + available reaction, reaction
  // spent here, no swing cap, no bonus charge, no budget record).
  if (readyFired) {
    const readyEntry = await getEntry(sessionId, encounterSeq, ledgerKey);
    if (!readyEntry.ready) return { error: `no readied action stored for ${characterRow.name || 'the player'}` };
    const st = await getTurnState(sessionId, encounterSeq);
    if (st) {
      const attackerName = characterRow.name || 'Player';
      if (!(await hasReactionAvailable(sessionId, encounterSeq, attackerName))) return { error: 'reaction already used' };
      await useReaction(sessionId, encounterSeq, attackerName);
    }
    await clearField(sessionId, encounterSeq, ledgerKey, 'ready');
  }
  // Item 3, Tier 1 gates, same as the companion path: identity
  // (reactions exempt), then the attack budget. The action is spent
  // at declaration — the player's roll comes later. A readied firing
  // is reaction-like, so it is exempt from identity too.
  if (!reaction && !readyFired) {
    const identity = await checkTurnIdentity(sessionId, encounterSeq, ledgerKey);
    if (!identity.allowed) return { error: `${identity.reason} ${identity.remedy}` };
  }
  const slot = await currentSlotKey(sessionId, encounterSeq);
  const attackOpts = { extraAttacks: extraAttackCount(characterRow.class, characterRow.level), isLoading: isLoadingWeapon(profile), hand, cleave };
  // Item 3, Tier 2: same bonus rule as the companion path — a
  // bonus-action attack skips the swing cap, and an off-hand attack
  // passes BOTH the swing gate and the bonus gate at declaration
  // (the action is spent at declaration for PCs, per Tier 1).
  const chargesBonus = !readyFired && (bonusAttack || (hand === 'off' && !profile.nickFree));
  if (slot) {
    if (!bonusAttack && !readyFired) {
      const budget = await getBudget(sessionId, encounterSeq, ledgerKey);
      const decision = attackBudgetDecision(budget || {}, attackOpts);
      if (!decision.allowed) return { error: `${decision.reason} ${decision.remedy}` };
    }
    if (chargesBonus) {
      const bc = await checkBonus(sessionId, encounterSeq, ledgerKey);
      if (!bc.allowed) return { error: `${bc.reason} ${bc.remedy}` };
    }
  }
  // Same gate order as the companion path: nothing is consumed before
  // the attack is real, so a refusal leaves Vex, Cleave, and the
  // off-hand turn untouched.
  if (cleave) {
    if (profile.mastery !== 'cleave') return { error: `${profile.label} is not a Cleave weapon` };
    const flag = await peekCleaveFlag(sessionId, attackerKey);
    if (!flag) return { error: 'no Cleave follow-up is available for this attacker' };
    if (flag.firstTarget && flag.firstTarget.toLowerCase() === String(enemy?.name || '').toLowerCase()) return { error: 'a Cleave follow-up must target a second creature, not the first target' };
    if (flag.weapon && String(flag.weapon).toLowerCase() !== String(profile.label).toLowerCase()) return { error: `the Cleave follow-up must use the ${flag.weapon}` };
    // Combat item 4: same follow-up gate as the companion path
    // (see above) — before the flag is consumed.
    const cleaveReach = (profile.properties || []).includes('reach') ? 10 : 5;
    const { checkCleaveDistance } = await import('./movementService.js');
    const cd = await checkCleaveDistance(sessionId, encounterSeq, ledgerKey, flag.firstTarget, enemy, cleaveReach);
    if (cd?.reason) return { error: cd.reason };
  }
  if (hand === 'off' && await offHandUsedThisTurn(sessionId, encounterSeq, attackerKey, ledgerKey)) {
    return { error: 'the off-hand attack has already been used this turn' };
  }
  const spent = await spendAmmo('player', characterId, profile);
  if (!spent.ok) return { error: spent.reason };
  if (spent.ammo) await recordAmmoSpent(sessionId, encounterSeq, spent.ammo.type);
  if (cleave) {
    const consumed = await consumeCleaveFlag(sessionId, encounterSeq, attackerKey, ledgerKey);
    if (!consumed || consumed.stale) return { error: 'the Cleave follow-up is no longer available (it belonged to an earlier encounter)' };
  }
  // Commit the budget at declaration (the roll comes later).
  if (slot) {
    if (chargesBonus) await spendBonus(sessionId, encounterSeq, ledgerKey, bonusAttack ? 'bonus-action attack' : 'off-hand attack');
    if (!bonusAttack && !readyFired) await recordAttack(sessionId, encounterSeq, ledgerKey, attackOpts);
  } else if (hand === 'off') await writeFlag(sessionId, encounterSeq, ledgerKey, attackerKey, 'offHandUsed');
  await proxyClearSlowed(sessionId, encounterSeq, attackerKey);
  const { mode, reasons, penalty } = await computeAttackMode('player', characterId, enemy, marker, sessionId, profile);
  if (longRangeReason) reasons.push(longRangeReason);
  const moraleBuff = await getMoraleBuff(sessionId, encounterSeq, 'friendlies').catch(() => 0);
  // Item 2, PC track: Sneak is the one feature whose gate needs the
  // roll mode, known only here. It is recorded as an instruction for
  // the player's reported total — never added by the system — and
  // the once-per-turn flag is consumed in resolveReportedAttack,
  // on a hit, not here.
  const featureNotes = [...(profile.featureNotes || [])];
  // Family 1: the player must know their crit threshold BEFORE
  // rolling, so it is stated in the pending block (and carried on
  // the pending record for resolveReportedAttack). A Champion
  // reads "Champion: you crit on 19–20"; everyone else gets no
  // line at all (threshold 20 is the default the player knows).
  const pcActor = actorFromRow('player', characterRow);
  const critThreshold = critThresholdForActor(pcActor);
  if (critThreshold < 20) {
    const champEntry = actorClassEntries(pcActor).find((e) => critThresholdFor(e) < 20);
    const subName = champEntry?.subclassName || 'Champion';
    featureNotes.push(`${subName}: you crit on ${critThreshold}–20 — on a ${critThreshold}–20, roll double damage dice.`);
  }
  let pendingSneakDice = null;
  if (profile.sneakEligible && (mode === 'advantage' || allyAdjacent)) {
    pendingSneakDice = profile.sneakDice;
    featureNotes.push(`Sneak Attack: roll +${pendingSneakDice} on this hit (once per turn).`);
  }
  const pending = {
    attackerKind: 'player', attacker: characterRow.name || 'Player',
    target: enemy.name, targetEnemyId: enemy.id, encounterSeq,
    // Item 3: flag consumption at report resolves against the
    // declaration slot, not whatever slot is current when the dice
    // come back (null = no order, legacy rules at report).
    slotKey: slot || null,
    weapon: profile.label, attackBonus: profile.attackBonus + (moraleBuff || 0) + (penalty || 0),
    targetAc: (enemy.armor_class || 10) + getCoverAcBonus(enemy.cover),
    mode, modeReasons: reasons, penalty: penalty || 0,
    damageDice: profile.damageDice, damageModifier: profile.damageModifier, damageType: profile.damageType,
    spellAttack: !!profile.spellAttack,
    mastery: profile.mastery || null,
    rangeType: profile.rangeType || 'melee', offHandName: profile.offHandName || null,
    ammo: spent.ammo || null, thrown: !!profile.thrown, thrownRange: profile.thrownRange || null,
    offHandAttack: !!profile.offHandAttack, cleave: !!profile.cleave,
    bonusAttack: !!bonusAttack, readyFired: !!readyFired, nickAvailable: !!profile.nickAvailable,
    toppleDc: profile.mastery === 'topple' ? 8 + (profile.damageModifier || 0) + proficiencyBonusForLevel(characterRow.level || 1) : null,
    featureNotes, featureDamageBonus: profile.featureDamageBonus || 0,
    critThreshold, formMagicalAttacks: !!profile.formMagicalAttacks,
    // Family 4 settle-time effects (Divine Fury / Divine Strike /
    // Lunar Radiance / surprising strikes): carried so
    // resolveReportedAttack can settle them — as an instruction on a
    // player-reported total, as real math on a system fallback roll.
    divineFury: profile.divineFury || null, divineStrike: profile.divineStrike || null,
    lunarRadianceBonus: profile.lunarRadianceBonus || null, surprisingStrikes: profile.surprisingStrikes || null,
    improvedSmiteDice: profile.improvedSmiteDice || null, gwmBonus: profile.gwmBonus || null,
    smite: profile.smite || null, sneakDice: pendingSneakDice, allyAdjacent: !!allyAdjacent
  };
  const config = await readSessionConfig(sessionId);
  config.pendingAttack = pending;
  await writeSessionConfig(sessionId, config);
  return { pending };
}

export async function resolveReportedAttack(sessionId, characterId, reportedDice, reportedDamage) {
  const pending = await getPendingAttack(sessionId);
  if (!pending) return null;
  const takenDie = takenDieFor(reportedDice, pending.mode);
  if (takenDie == null) return null;
  const config = await readSessionConfig(sessionId);
  config.pendingAttack = null;
  await writeSessionConfig(sessionId, config);

  // Item 6: a Shield cast after declaration still counts — recompute
  // the target AC (fresh armor + cover + live shield) when a shield
  // entry exists; otherwise the declaration snapshot stands.
  let targetAc = pending.targetAc;
  try {
    const judgedEnemy = await findActiveEnemy(sessionId, pending.encounterSeq, pending.target);
    if (judgedEnemy) {
      const { shieldBonusFor } = await import('./enemySpellService.js');
      const shield = await shieldBonusFor(sessionId, pending.encounterSeq, combatFallbackId(sessionId, pending.encounterSeq, judgedEnemy.id));
      if (shield > 0) {
        const { getPartyCover } = await import('./combatTurnService.js');
        const cover = await getPartyCover(sessionId, pending.encounterSeq, pending.target).catch(() => null);
        const coverBonus = cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0;
        targetAc = (judgedEnemy.armor_class || 10) + coverBonus + shield;
      }
    }
  } catch { /* keep the snapshot on any failure */ }
  const judged = judgeAttack({ takenDie, attackBonus: pending.attackBonus, targetAc, critThreshold: pending.critThreshold ?? 20 });
  let damage = 0;
  let damageRolls = [];
  if (judged.hit) {
    if (reportedDamage != null) {
      // The player's own damage dice, reported as a total — on a crit
      // the player doubles their dice before reporting (the prompt
      // teaches it; the system trusts the report, as with all dice).
      damage = Math.max(0, reportedDamage);
    } else {
      // Fallback system roll (no reported damage): features ARE math
      // here, because the system is rolling — unlike a reported total.
      let diceSpec = pending.damageDice;
      if (pending.improvedSmiteDice) diceSpec = `${diceSpec}+${pending.improvedSmiteDice}`;
      if (pending.sneakDice) diceSpec = `${diceSpec}+${pending.sneakDice}`;
      if (pending.smite) diceSpec = `${diceSpec}+${pending.smite.dice}`;
      const mod = (pending.damageModifier || 0) + (pending.featureDamageBonus || 0) + (pending.gwmBonus || 0);
      const rolled = rollDamageFor({ label: pending.weapon, damageDice: diceSpec, damageModifier: mod }, judged.critical);
      damage = rolled.damage;
      damageRolls = rolled.rolls;
    }
  }
  // Item 2, PC track: on a hit, consume the once-per-turn Sneak flag
  // and spend a declared Smite slot. A reported total is never
  // adjusted — these records state what the player was told to
  // include, and whether the slot spend succeeded.
  let sneakAttack = null;
  let gwmOutcome = null;
  let smiteOutcome = null;
  // Flags resolve against the declaration slot pinned on the pending
  // attack, not whatever slot is current when the dice come back.
  const attackerKey = `player:${characterId}`;
  const ledgerKey = await ledgerKeyForPlayer(characterId);
  const reportSlot = pending.slotKey || await currentSlotKey(sessionId, pending.encounterSeq);
  if (judged.hit) {
    if (pending.sneakDice) {
      if (await readFlag(sessionId, pending.encounterSeq, ledgerKey, attackerKey, 'sneakUsed', reportSlot)) {
        sneakAttack = { dice: pending.sneakDice, applied: false, reason: 'Sneak Attack already used this turn' };
      } else {
        await writeFlag(sessionId, pending.encounterSeq, ledgerKey, attackerKey, 'sneakUsed', reportSlot);
        sneakAttack = { dice: pending.sneakDice, applied: true };
      }
    }
    // Item 3 fix: PC Great Weapon Master had no once-per-turn gate at
    // all (companions did) — the reported bonus was narrated on every
    // hit. It now consumes the same ledger flag as Sneak.
    if (pending.gwmBonus) {
      if (await readFlag(sessionId, pending.encounterSeq, ledgerKey, attackerKey, 'gwmUsed', reportSlot)) {
        gwmOutcome = { bonus: pending.gwmBonus, applied: false, reason: 'Great Weapon Master already used this turn' };
      } else {
        await writeFlag(sessionId, pending.encounterSeq, ledgerKey, attackerKey, 'gwmUsed', reportSlot);
        gwmOutcome = { bonus: pending.gwmBonus, applied: true };
      }
    }
    if (pending.smite) {
      // Item 3, Tier 2: Smite is cast at report (after the hit), so
      // the bonus is charged against the declaration slot, pinned
      // above — a spent bonus refuses the smite and spends no slot.
      const bc = await checkBonus(sessionId, pending.encounterSeq, ledgerKey, reportSlot);
      if (!bc.allowed) {
        smiteOutcome = { slot: pending.smite.slot, dice: pending.smite.dice, spent: false, reason: bc.reason };
      } else {
        const spentSlot = await spendSpellSlot('player', characterId, pending.smite.slot);
        if (spentSlot.success) await spendBonus(sessionId, pending.encounterSeq, ledgerKey, 'Divine Smite', reportSlot);
        smiteOutcome = spentSlot.success
          ? { slot: pending.smite.slot, dice: pending.smite.dice, spent: true }
          : { slot: pending.smite.slot, dice: pending.smite.dice, spent: false, reason: spentSlot.reason };
      }
    }
  }
  const outcome = {
    type: 'party_attack', success: true, attackerKind: 'player', attacker: pending.attacker,
    target: pending.target, weapon: pending.weapon, dice: reportedDice, takenDie,
    attackBonus: pending.attackBonus, total: judged.total, targetAc,
    hit: judged.hit, critical: judged.critical, critThreshold: pending.critThreshold ?? 20,
    formMagicalAttacks: !!pending.formMagicalAttacks, mode: pending.mode, modeReasons: pending.modeReasons,
    damage, damageRolls, damageType: pending.damageType, spellAttack: !!pending.spellAttack, source: 'reported',
    mastery: pending.mastery || null,
    ammo: pending.ammo || null, thrown: !!pending.thrown, thrownRange: pending.thrownRange || null,
    offHandAttack: !!pending.offHandAttack, cleave: !!pending.cleave, bonusAttack: !!pending.bonusAttack, readyFired: !!pending.readyFired,
    featureNotes: pending.featureNotes || [], sneakAttack, smite: smiteOutcome,
    gwm: gwmOutcome
  };
  if (!judged.hit && pending.mastery === 'graze') outcome.grazeDamage = Math.max(0, pending.damageModifier || 0);
  if (judged.hit || outcome.grazeDamage > 0) {
    const enemy = await findActiveEnemy(sessionId, pending.encounterSeq, pending.target);
    if (enemy) {
      await applyOutcomeDamage(sessionId, pending.encounterSeq, characterId, enemy, outcome, { attackerKey: ledgerKey, ranged: !!pending.spellAttack || pending.rangeType === 'ranged' || !!pending.thrown, attacker: { kind: 'player', id: characterId, name: pending.attacker } });
      await settleMastery(sessionId, pending.encounterSeq, `player:${characterId}`,
        { mastery: pending.mastery, label: pending.weapon, rangeType: pending.rangeType, offHandName: pending.offHandName, cleave: pending.cleave, nickAvailable: !!pending.nickAvailable,
          // Family 4: the pending block carries the settle-time
          // effects; pcSystemRoll marks the system-rolled fallback
          // (no reported damage), where features ARE math — on a
          // player-reported total they are instructions only.
          divineFury: pending.divineFury || null, divineStrike: pending.divineStrike || null,
          lunarRadianceBonus: pending.lunarRadianceBonus || null, surprisingStrikes: pending.surprisingStrikes || null,
          pcSystemRoll: reportedDamage == null },
        enemy, outcome, pending.toppleDc, ledgerKey, characterId);
    }
  }
  await stashOutcome(sessionId, outcome);
  await logAttackRoll(characterId, sessionId, outcome);
  return outcome;
}

// ---------------------------------------------------------------------------
// The DM-facing fact block (next-turn injection, mirrors ROLL RESULT)
// ---------------------------------------------------------------------------

/** One settle-time subclass effect's narration line, or ''. Applied
 *  effects state the damage; a spent once-per-turn flag states the
 *  refusal; a player-reported total states nothing (the pending
 *  block already instructed the player, and the player included it
 *  in the reported total — narrating "NOT applied" would be wrong). */
function subclassHitEffectText(effect, label) {
  if (!effect) return '';
  if (effect.applied) {
    const dealt = effect.dealt != null && effect.dealt !== effect.damage ? ` (${effect.dealt} got through)` : '';
    return ` ${label}: +${effect.damage} ${effect.damageType || ''} damage${dealt}.`;
  }
  if (effect.reason && effect.reason.includes('already used')) return ` ${label} was NOT applied (${effect.reason}).`;
  return '';
}

export async function formatAttackOutcomeBlock(sessionIdOrOutcomes) {
  const recent = Array.isArray(sessionIdOrOutcomes)
    ? sessionIdOrOutcomes
    : (Array.isArray((await readSessionConfig(sessionIdOrOutcomes)).recentAttacks)
      ? (await readSessionConfig(sessionIdOrOutcomes)).recentAttacks : []);
  if (recent.length === 0) return '';
  const lines = recent.map(o => {
    const diceText = (o.dice || []).length > 1 ? `dice ${o.dice.join(' and ')}, taking the ${o.takenDie}` : `a ${o.takenDie}`;
    const modeText = o.mode ? ` (${ATTACK_MODE_LABEL[o.mode]}${o.modeReasons?.length ? `: ${o.modeReasons.join(', ')}` : ''})` : '';
    if (!o.hit) {
      // Graze (Step 2): the miss still dealt its flat damage.
      const grazeText = o.grazeDamage > 0
        ? (o.grazeAdjustment === 'immune'
          ? ` Graze: ${o.target} is IMMUNE to ${o.damageType} — no damage got through.`
          : ` Graze: ${o.target} still takes ${o.grazeDealt != null ? o.grazeDealt : o.grazeDamage} ${o.damageType || ''} damage${o.grazeAdjustment ? ` (${o.grazeAdjustment})` : ''}.${o.killed ? ` ${o.target} is DEAD.` : (o.targetHpAfter != null ? ` ${o.target} has ${o.targetHpAfter} HP left.` : '')}`)
        : '';
      return `${o.attacker} attacked ${o.target} with ${o.weapon}${modeText}: rolled ${diceText} + ${o.attackBonus} = ${o.total} vs AC ${o.targetAc} — MISS${o.critical === 'miss' ? ' (natural 1)' : ''}.${grazeText}`;
    }
    const hpText = o.targetHpAfter != null ? ` ${o.target} has ${o.targetHpAfter} HP left${o.killed ? ' and is DEAD' : ''}.` : '';
    // Step 1: resistance / vulnerability / immunity adjusted the
    // packet — the dealt number is the fact the DM narrates.
    const adjText = o.damageAdjustment === 'immune' ? ` ${o.target} is IMMUNE to ${o.damageType} — no damage got through.`
      : o.damageAdjustment === 'resistant' ? ` Resisted — ${o.damageDealt} damage got through.`
      : o.damageAdjustment === 'vulnerable' ? ` Vulnerable — ${o.damageDealt} damage dealt.`
      : o.damageAdjustment ? ` Adjusted (${o.damageAdjustment}) — ${o.damageDealt} damage dealt.` : '';
    // Item 2: class-feature facts the DM narrates. For PCs the
    // featureNotes are instructions already folded into the reported
    // total; for companions they are the math already applied.
    // GWM / Smite notes also exist in featureNotes; the canonical
    // outcome lines below replace them so they are not narrated twice.
    const featureText = [
      ...(Array.isArray(o.featureNotes) ? o.featureNotes.filter(n => !n.startsWith('Great Weapon Master') && !n.startsWith('Divine Smite')).map(n => ` ${n}`) : []),
      o.sneakAttack ? (o.sneakAttack.applied === false ? ` Sneak Attack ${o.sneakAttack.dice} was NOT applied (${o.sneakAttack.reason}).` : ` Sneak Attack: +${o.sneakAttack.dice}.`) : '',
      o.smite ? (o.smite.spent ? ` Divine Smite: +${o.smite.dice} radiant (slot ${o.smite.slot} spent).` : ` Divine Smite was NOT applied (${o.smite.reason}).`) : '',
      o.gwm ? (o.gwm.applied === false ? ` Great Weapon Master +${o.gwm.bonus} was NOT applied (${o.gwm.reason}).` : ` Great Weapon Master: +${o.gwm.bonus} damage.`) : '',
      // Family 4 settle-time subclass effects (Divine Fury, Divine
      // Strike, Lunar Form, surprising strikes). Applied effects
      // state the damage; a spent once-per-turn flag states the
      // refusal; a player-reported total states nothing — the
      // pending block already instructed the player, and the player
      // included it (see subclassHitEffectText).
      subclassHitEffectText(o.divineFury, 'Divine Fury'),
      subclassHitEffectText(o.divineStrike, 'Divine Strike'),
      subclassHitEffectText(o.lunarRadianceBonus, 'Lunar Form'),
      subclassHitEffectText(o.surprisingStrikes, 'Assassinate (surprising strikes)'),
    ].join('');
    // Step 2: mastery facts the DM narrates (flags already applied).
    const masteryText = [
      o.sappedTarget ? ` Sap: ${o.target}'s next attack roll has disadvantage.` : '',
      o.vexGained ? ` Vex: ${o.attacker} has advantage on their next attack roll against ${o.target}.` : '',
      o.topple ? (o.topple.saved === null
        ? ` Topple: ${o.target} is already prone.`
        : o.topple.saved
          ? ` Topple: ${o.target} made its CON save (${o.topple.total} vs DC ${o.topple.dc}) and stays standing.`
          : o.topple.applied
            ? ` Topple: ${o.target} failed its CON save (${o.topple.total} vs DC ${o.topple.dc}) and is PRONE.`
            : ` Topple: ${o.target} failed its CON save (${o.topple.total} vs DC ${o.topple.dc}) but did not fall${o.topple.reason ? ` (${o.topple.reason})` : ''}.`) : '',
      o.ammo ? ` Ammo: ${o.ammo.type} spent (1 used, ${o.ammo.remaining} left).` : '',
      o.thrown ? ` Thrown attack.` : '',
      o.offHandAttack ? ` Off-hand attack (no ability modifier to damage).` : '',
      o.cleave ? ` Cleave follow-up (no ability modifier to damage).` : '',
      o.masteryNote ? ` ${o.masteryNote}` : ''
    ].join('');
    return `${o.attacker} attacked ${o.target} with ${o.weapon}${modeText}: rolled ${diceText} + ${o.attackBonus} = ${o.total} vs AC ${o.targetAc} — HIT${o.critical === 'hit' ? ' (CRITICAL HIT)' : ''} for ${o.damage} ${o.damageType || ''} damage.${adjText}${hpText}${masteryText}${featureText}`;
  });
  const moraleNotes = recent.map(o => o.damageResult?.systemNote).filter(Boolean).map(s => s.replace(/\[SYSTEM NOTE[^\]]*\]:?/, '').trim());
  return ['[ATTACK RESULT — system facts from the combat engine. Narrate exactly these outcomes; do not re-judge hits, misses, damage, or deaths.]',
    ...lines, ...moraleNotes].join('\n');
}

/** Mechanics hooks, Family 4: Survivor turn-start heal (Champion
 *  18 — `survivorHealAtTurnStart`, already written and tested in
 *  subclassService). Called by combatTurnService.advanceTurn for the
 *  INCOMING combatant, in the same best-effort dynamic-import chain
 *  as Slow expiry: a hook failure never breaks the turn.
 *  - Resolves the combatant to a characters/companions row by turn
 *    order entry ({ type: 'player' | 'companion', name }) — the
 *    session's character for a player, the session PC's companion
 *    matched by NPC name for a companion. Enemies never heal here.
 *  - D6: the heal is evaluated per class_levels entry (a multiclass
 *    Champion's FIGHTER level is what matters) and the largest heal
 *    wins — survivorHealAtTurnStart itself reads one class at a time.
 *  - The heal is SYSTEM-APPLIED hit points (like rest healing and
 *    enemy damage to a PC — the engine already moves PC HP), not a
 *    silently added reported total: it is clamped at max HP, and the
 *    result rides back for the TURN_ADVANCE handler to narrate (see
 *    HANDOFF.md — combatTurnService attaches it as
 *    newState.turnStartHeal). Returns null when nothing heals.
 *  - Bloodied gate (HP <= half max) and the 5 + Con mod amount both
 *    live in survivorHealAtTurnStart; this function adds no numbers. */
export async function applySurvivorHealAtTurnStart(sessionId, encounterSeq, combatant) {
  try {
    if (!combatant || !combatant.name) return null;
    const type = combatant.type;
    if (type !== 'player' && type !== 'companion') return null;
    const sess = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
    if (!sess?.character_id) return null;
    let row = null;
    if (type === 'player') {
      row = await dbGet('SELECT * FROM characters WHERE id = ?', [sess.character_id]);
    } else {
      // Companions link to the session PC via
      // recruited_by_character_id (there is no companions.character_id
      // — cf. conditionService findCompanionIdByName).
      row = await dbGet(
        'SELECT c.* FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.recruited_by_character_id = ? AND LOWER(n.name) = LOWER(?)',
        [sess.character_id, combatant.name]
      );
      if (!row) {
        row = await dbGet(
          'SELECT c.* FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE LOWER(n.name) = LOWER(?)',
          [combatant.name]
        );
      }
    }
    if (!row) return null;
    const kind = type;
    const actor = actorFromRow(kind, row);
    const abilities = safeParse(kind === 'player' ? row.ability_scores : row.companion_ability_scores, {});
    const conMod = abilityModifier(abilities?.con ?? abilities?.constitution ?? 10);
    const currentHp = Number(kind === 'player' ? row.current_hp : row.companion_current_hp) || 0;
    const maxHp = Number(kind === 'player' ? row.max_hp : row.companion_max_hp) || 0;
    let amount = 0;
    for (const entry of actorClassEntries(actor)) {
      amount = Math.max(amount, survivorHealAtTurnStart({
        className: entry.className, subclassName: entry.subclassName, level: entry.level,
        conMod, currentHp, maxHp,
      }));
    }
    if (!amount || amount <= 0) return null;
    if (kind === 'player') {
      const { applyHpChange } = await import('./characterHpService.js');
      const res = await applyHpChange(row.id, amount, 'Survivor (Champion): turn-start heal');
      if (!res || res.applied === false) return null;
      return { applied: true, kind: 'player', actor: combatant.name, amount, currentHp, maxHp, newHp: res.currentHp ?? Math.min(maxHp, currentHp + amount), feature: 'Survivor' };
    }
    await dbRun('UPDATE companions SET companion_current_hp = MIN(companion_max_hp, companion_current_hp + ?) WHERE id = ?', [amount, row.id]);
    const after = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [row.id]);
    return { applied: true, kind: 'companion', actor: combatant.name, amount, currentHp, maxHp, newHp: after?.companion_current_hp ?? Math.min(maxHp, currentHp + amount), feature: 'Survivor' };
  } catch { /* a turn-start heal never breaks the turn */ return null; }
}

// ---------------------------------------------------------------------------
// Marker handler
// ---------------------------------------------------------------------------

registerMarkerHandler('ATTACK', async (parsed, context) => {
  if (!context?.characterId || !context?.sessionId) return null;
  try {
    const attackerRaw = String(parsed?.Attacker || '').trim();
    const targetRaw = String(parsed?.Target || '').trim();
    if (!attackerRaw || !targetRaw) {
      return { type: 'party_attack', success: false, reason: 'ATTACK needs Attacker= and Target=' };
    }
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'party_attack', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, targetRaw);
    if (!enemy) return { type: 'party_attack', success: false, reason: `no active enemy named "${targetRaw}"` };
    const marker = { advantage: parsed?.Advantage, disadvantage: parsed?.Disadvantage };
    const handRaw = String(parsed?.Hand || '').toLowerCase().trim();
    const truthyFlag = (v) => ['true', 'yes', '1'].includes(String(v || '').toLowerCase().trim());
    const opts = { spellName: parsed?.Spell || null, damageOverride: parsed?.Damage || null, marker,
      hand: handRaw === 'off' || handRaw === 'offhand' || handRaw === 'off-hand' ? 'off' : null,
      thrown: truthyFlag(parsed?.Thrown), cleave: truthyFlag(parsed?.Cleave),
      // Item 3, Tier 2: Bonus="true" declares a bonus-action attack
      // (GWM crit/kill, Polearm Master) — it charges the bonus
      // action, not an Attack-action swing.
      bonusAttack: truthyFlag(parsed?.Bonus),
      // Item 3, Tier 3: Ready="true" declares a readied attack firing
      // (stored READY + available reaction; the reaction is spent
      // in the resolver, before any other gate).
      readyFired: truthyFlag(parsed?.Ready),
      // Item 2: Ally= declares an ally within 5 ft of the target
      // (Sneak gate, until item 4 gives the engine real adjacency);
      // Smite= declares the Divine Smite slot level for this hit.
      allyAdjacent: truthyFlag(parsed?.Ally) || truthyFlag(parsed?.AllyAdjacent),
      smiteSlot: parsed?.Smite ? Number(parsed.Smite) : null, smiteFiend: truthyFlag(parsed?.SmiteFiend) };

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
    const isPc = /^(player|pc|character)$/i.test(attackerRaw) ||
      (character && attackerRaw.toLowerCase() === String(character.name).toLowerCase());
    if (isPc) {
      // Combat item 8: incapacitated attackers cannot act; charmed
      // attackers cannot attack the charmer. Checked before any
      // pending attack or budget spend.
      const blocked = await attackBlockedByConditions('player', context.characterId, 'enemy', enemy.id);
      if (blocked) return { type: 'party_attack', success: false, reason: blocked };
      const { pending, error } = await createPcPendingAttack(context.sessionId, context.characterId, character, enemy, opts);
      if (error) return { type: 'party_attack', success: false, reason: error };
      return { type: 'party_attack', success: true, pending: true, ...pending };
    }
    const compId = await findCompanionIdByName(context.characterId, attackerRaw);
    if (!compId) return { type: 'party_attack', success: false, reason: `unknown attacker: ${attackerRaw}` };
    const companionRow = await dbGet(
      `SELECT c.*, n.name AS display_name FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?`,
      [compId]
    );
    // Combat item 8: same gate for companion attackers.
    const blocked = await attackBlockedByConditions('companion', compId, 'enemy', enemy.id);
    if (blocked) return { type: 'party_attack', success: false, reason: blocked };
    return await resolveCompanionAttack(context.sessionId, context.characterId, companionRow, enemy, opts);
  } catch (e) {
    console.error('[partyAttackService] ATTACK handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('MASTERY_SET', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const weaponsRaw = String(parsed?.Weapons || '').trim();
    if (!targetRaw || !weaponsRaw) {
      return { type: 'mastery_set', success: false, reason: 'MASTERY_SET needs Target= and Weapons=' };
    }
    const weapons = weaponsRaw.split(',').map(s => s.trim()).filter(Boolean);
    if (!weapons.length) {
      return { type: 'mastery_set', success: false, reason: 'MASTERY_SET needs at least one weapon in Weapons=' };
    }
    const character = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
    const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
      (character && targetRaw.toLowerCase() === String(character.name).toLowerCase());
    let kind = null;
    let id = null;
    let displayName = targetRaw;
    if (isPc) {
      kind = 'player';
      id = context.characterId;
      displayName = character?.name || 'Player';
    } else {
      const compId = await findCompanionIdByName(context.characterId, targetRaw);
      if (!compId) return { type: 'mastery_set', success: false, reason: `unknown target: ${targetRaw}` };
      kind = 'companion';
      id = compId;
    }
    const r = await setMasteredWeapons(kind, id, weapons);
    if (!r.success) return { type: 'mastery_set', success: false, reason: r.reason };
    return { type: 'mastery_set', success: true, target: displayName, weapons: r.weapons };
  } catch (e) {
    console.error('[partyAttackService] MASTERY_SET handler failed:', e.message);
    return null;
  }
});

export default { parseDamageSpec, takenDieFor, judgeAttack, buildAttackProfile, computeAttackMode, rollDamageFor, resolveCompanionAttack, createPcPendingAttack, getPendingAttack, resolveReportedAttack, formatAttackOutcomeBlock, ammoTypeForWeapon, spendAmmo, getAmmoSpent, setMasteredWeapons, getMasteredWeapons, getSlowedEnemies, clearSlowedForOwner, expireSlowedOnTurn, actorClassEntries, featuresForActor, critThresholdForActor, hasSubclassFeature, featureByKey, actorFromRow, enemyCritThreshold, readFormState, applySurvivorHealAtTurnStart };


