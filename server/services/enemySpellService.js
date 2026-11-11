/**
 * Combat item 6: enemy spellcasting resolution + reaction spells.
 *
 * ENEMY_CAST stops being tracking-only once it names targets: save
 * spells, attack-roll spells, Magic Missile, healing, and conditions
 * on failed saves all resolve through the engine, reusing the party
 * spell machinery where it exists (catalog specs, condition service,
 * concentration service) and the enemy save path (statblock snapshot
 * → ability score → CR fallback) where it does not. Non-catalog
 * spells stay tracking-only — the engine never invents dice.
 *
 * This module also owns the reaction spells that resolve against
 * damage or casts (Shield, Counterspell, and the damage trio), the
 * spell_effects rows (conditions with repeat saves and durations),
 * and the turn-boundary processing (repeat saves at end of turn,
 * minute-scale expiry) that combatTurnService.advanceTurn calls.
 *
 * Import discipline: static imports are leaves or proven-safe
 * services only. spellCastService and concentrationService are
 * imported dynamically (they dynamically import this module's
 * callers in turn); actionStateService, movementService,
 * characterHpService, and reactionService likewise, following the
 * enemyCombatService pattern.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll, rollD20 } from '../utils/rng.js';
import { lookupSpell, isConcentrationSpell, spellSaveAbility, spellEffectSpec, REPEAT_SAVE_SPELLS, COUNTING_SAVE_SPELLS } from '../data/spellCatalog.js';
import { getConditions, addCondition, removeCondition, conditionRollEffects, findCompanionIdByName, normalizeConditionKey, resolveActorId, saveDisadvantageFromMarks, targetSaveMarksActive } from './conditionService.js';
import { applyResistanceForActor } from './resistanceService.js';
import { combatFallbackId } from './worldIdService.js';
import { findActiveEnemy, applyPartyDamageToEnemy } from './enemyCombatService.js';
import { lookupBestiaryFull } from './bestiaryLookupService.js';
import { rollForNpc, requestPcRoll, crScaledModifier } from './rollRequestService.js';
import { spellProfileFor } from './combatStatsService.js';
import { getTurnState } from './combatTurnService.js';
import { ledgerKeyForPlayer, ledgerKeyForCompanion, getBudget, updateBudget } from './turnLedgerService.js';

const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
const ABILITY_SHORT = { strength: 'str', dexterity: 'dex', constitution: 'con', intelligence: 'int', wisdom: 'wis', charisma: 'cha' };
const ELEMENTAL_TYPES = ['acid', 'cold', 'fire', 'lightning', 'thunder'];
const REACTION_ONLY_SPELLS = ['shield', 'counterspell', 'absorb elements', 'hellish rebuke', 'backlash', 'silvery barbs', 'temporal shunt', 'feather fall', 'gift of gab', 'soul cage'];

// ---------------------------------------------------------------------------
// Session-config helpers (pending effects, notices, recent rolls)
// ---------------------------------------------------------------------------

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/** DM-visible notice, consumed once by the route's prompt injection. */
export async function pushDmNotice(sessionId, text) {
  try {
    const cfg = await readCfg(sessionId);
    const notes = Array.isArray(cfg.pendingDmNotices) ? cfg.pendingDmNotices : [];
    notes.push(text);
    cfg.pendingDmNotices = notes.slice(-10);
    await writeCfg(sessionId, cfg);
  } catch { /* notices are best-effort */ }
}

async function stashRoll(sessionId, outcome) {
  try {
    const cfg = await readCfg(sessionId);
    const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
    cfg.recentRolls = [...prior, outcome].slice(-5);
    await writeCfg(sessionId, cfg);
  } catch { /* best-effort — the outcome is still in the result */ }
}

async function stashSpellOutcome(sessionId, outcome) {
  try {
    const { stashSpellEffectOutcome } = await import('./spellCastService.js');
    await stashSpellEffectOutcome(sessionId, outcome);
  } catch { /* best-effort */ }
}

async function getSessionCharacter(sessionId) {
  const s = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  return s?.character_id ?? null;
}

function newEffectKey() {
  return `pe_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// ---------------------------------------------------------------------------
// Small pure helpers: spec rolling, CR proxy, durations, DCs
// ---------------------------------------------------------------------------

/** Roll a spec string like "8d6+3" or "2d8+4d6" (server dice). */
export function rollSpecString(specStr) {
  const s = String(specStr || '');
  let total = 0;
  for (const m of s.matchAll(/(\d+)d(\d+)/g)) {
    total += roll(parseInt(m[2], 10), parseInt(m[1], 10), { reason: 'spell effect' }).total;
  }
  const rest = s.replace(/(\d+)d(\d+)/g, '').replace(/\s+/g, '');
  if (rest) total += parseInt(rest, 10) || 0;
  return Math.max(0, total);
}

/** Cantrip scaling proxy by challenge rating (Q3): CR 5+/11+/17+ tiers. */
export function crToCasterLevel(cr) {
  const n = Number(cr) || 0;
  if (n >= 17) return 17;
  if (n >= 11) return 11;
  if (n >= 5) return 5;
  return 1;
}

/**
 * Remaining rounds for a non-concentration duration, or null when the
 * effect is concentration-bound or longer than combat scale. Only
 * 1-minute durations count in v1 (10 rounds); hour+ durations are
 * DM-side, and Instantaneous conditions persist until saved.
 */
export function durationRoundsFor(spellName) {
  const info = lookupSpell(spellName);
  if (!info || info.concentration) return null;
  if (/1 minute/.test(info.duration || '')) return 10;
  return null;
}

async function bestiarySpellcasting(enemyName) {
  try {
    // Full lookup: the flat bestiary-table lookup has no spellcasting
    // columns, so it can never supply a DC or attack bonus.
    const entry = await lookupBestiaryFull(enemyName);
    return entry?.spellcasting || null;
  } catch { return null; }
}

export async function enemySpellDc(enemyRow, declaredDc = null) {
  if (declaredDc != null && Number.isFinite(Number(declaredDc))) return Number(declaredDc);
  const sc = await bestiarySpellcasting(enemyRow?.name);
  return sc?.dc ?? null;
}

export async function enemySpellAttack(enemyRow, declaredAtk = null) {
  if (declaredAtk != null && Number.isFinite(Number(declaredAtk))) return Number(declaredAtk);
  const sc = await bestiarySpellcasting(enemyRow?.name);
  return sc?.attackBonus ?? null;
}

async function enemyCr(enemyRow) {
  try {
    const entry = await lookupBestiaryFull(enemyRow?.name);
    // Canonical + legacy entries carry `cr`; only flat DB rows use
    // `challenge_rating`.
    return entry?.cr ?? entry?.challenge_rating ?? null;
  } catch { return null; }
}

/** Party spell save DC / casting modifier from the true sheet. */
export function partySpellProfile(kind, row) {
  if (!row) return null;
  if (kind === 'player') {
    return spellProfileFor({ ability_scores: row.ability_scores, level: row.level }, row.class);
  }
  return spellProfileFor({ ability_scores: row.companion_ability_scores, level: row.companion_level }, row.companion_class);
}

// ---------------------------------------------------------------------------
// Reactions, Shield, Absorb rider, zones
// ---------------------------------------------------------------------------

/**
 * Reaction budget for spells. No turn-state row (no turn order) means
 * untracked — the legacy out-of-combat behavior, not a refusal. The
 * name must match the turn-order entry name (reactionService is
 * name-keyed and resets by that name at turn start).
 */
export async function checkReaction(sessionId, encounterSeq, combatantName) {
  const st = await getTurnState(sessionId, encounterSeq);
  if (!st) return { allowed: true, noSlot: true };
  const { hasReactionAvailable } = await import('./reactionService.js');
  const available = await hasReactionAvailable(sessionId, encounterSeq, combatantName);
  if (!available) {
    return { allowed: false, reason: 'reaction already used', remedy: 'Wait for the start of your next turn.' };
  }
  return { allowed: true };
}

export async function spendReaction(sessionId, encounterSeq, combatantName) {
  const st = await getTurnState(sessionId, encounterSeq);
  if (!st) return null;
  const { useReaction } = await import('./reactionService.js');
  return useReaction(sessionId, encounterSeq, combatantName);
}

/** Turn-order entry name for a ledger key, else the fallback name. */
export async function reactionNameFor(sessionId, encounterSeq, casterKey, fallbackName) {
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    const entry = (st?.turnOrder || []).find((e) => e && e.key === casterKey);
    if (entry?.name) return entry.name;
  } catch { /* fall through */ }
  return fallbackName;
}

/** +5 while a Shield entry is live (until start of next turn). */
export async function shieldBonusFor(sessionId, encounterSeq, key) {
  try {
    const { getEntry } = await import('./actionStateService.js');
    const entry = await getEntry(sessionId, encounterSeq, key);
    return entry?.shield ? 5 : 0;
  } catch { return 0; }
}

export async function setShield(sessionId, encounterSeq, key) {
  const { untilFor, setField } = await import('./actionStateService.js');
  const until = await untilFor(sessionId, encounterSeq, key);
  await setField(sessionId, encounterSeq, key, 'shield', { until, acBonus: 5 });
}

export async function absorbRiderFor(sessionId, encounterSeq, key) {
  try {
    const { getEntry } = await import('./actionStateService.js');
    const entry = await getEntry(sessionId, encounterSeq, key);
    return entry?.absorb || null;
  } catch { return null; }
}

export async function setAbsorb(sessionId, encounterSeq, key, type) {
  const { currentPos, untilFor, setField } = await import('./actionStateService.js');
  const pos = await currentPos(sessionId, encounterSeq);
  const next = await untilFor(sessionId, encounterSeq, key);
  let until = null;
  if (pos && next) {
    until = next.index + 1 < pos.total
      ? { round: next.round, index: next.index + 1 }
      : { round: next.round + 1, index: 0 };
  }
  await setField(sessionId, encounterSeq, key, 'absorb', { type, until });
}

export async function consumeAbsorb(sessionId, encounterSeq, key) {
  const { clearField } = await import('./actionStateService.js');
  await clearField(sessionId, encounterSeq, key, 'absorb');
}

/** Zone a combatant stands in ('the fight' when no zones exist). */
export async function zoneFor(sessionId, encounterSeq, key) {
  try {
    const { readZones, positionOf } = await import('./movementService.js');
    const data = await readZones(sessionId, encounterSeq);
    return positionOf(data, key);
  } catch { return 'the fight'; }
}

export async function sameZone(sessionId, encounterSeq, keyA, keyB) {
  return (await zoneFor(sessionId, encounterSeq, keyA)) === (await zoneFor(sessionId, encounterSeq, keyB));
}

// ---------------------------------------------------------------------------
// Target resolution + save rollers
// ---------------------------------------------------------------------------

/**
 * Resolve a spell target name to {kind, id, name, row?}. PC by name or
 * Player/PC/self; companion by name; enemy by active row. Null when
 * nothing matches — the caller refuses with remedy, never invents.
 */
export async function resolveTarget(sessionId, encounterSeq, targetName, sessionCharacterId) {
  if (!targetName) return null;
  const wanted = String(targetName).trim().toLowerCase();
  const character = sessionCharacterId
    ? await dbGet('SELECT name FROM characters WHERE id = ?', [sessionCharacterId])
    : null;
  if (/^(player|pc|character|self)$/.test(wanted) ||
      (character && wanted === String(character.name).toLowerCase())) {
    return { kind: 'player', id: sessionCharacterId, name: character?.name || 'Player' };
  }
  if (sessionCharacterId) {
    const compId = await findCompanionIdByName(sessionCharacterId, targetName).catch(() => null);
    if (compId) {
      const row = await dbGet('SELECT id FROM companions WHERE id = ?', [compId]);
      if (row) return { kind: 'companion', id: compId, name: targetName };
    }
  }
  const enemy = await findActiveEnemy(sessionId, encounterSeq, targetName).catch(() => null);
  if (enemy) return { kind: 'enemy', id: enemy.id, name: enemy.name, row: enemy };
  return null;
}

/**
 * Server save for an enemy target: statblock snapshot → ability score
 * → CR fallback, condition auto-fail/disadvantage, dodging-enemy DEX
 * advantage (item-3 Tier 3), 2024 exhaustion penalty. Mirrors
 * spellCastService.resolveSpellSave's save algebra.
 *
 * Family 6: caster-imposed save disadvantage (Eldritch Strike,
 * Magical Ambush, Corona of Light, Diminish Defiance, Enfeeble the
 * Unholy, Brand of the Sapping Scar) joins as a third disadvantage
 * source, read as timed-effect marks on the TARGET. `opts.casterKind`
 * gates it: the marks are all "against a spell YOU cast" from a party
 * subclass feature, so they apply only when the spell forcing the
 * save was cast by a party member ('player' / 'companion'). An enemy
 * caster ('enemy') or an unknown caster never applies them (fail
 * closed). The marks are dormant until the marking side exists (the
 * attack family for Eldritch Strike, the spell-cast family for
 * Magical Ambush, etc.) — see NOTES.md.
 */
export async function rollEnemySave(sessionId, encounterSeq, enemyRow, ability, dc, spellName, opts = {}) {
  const { enemySaveModifier } = await import('./spellCastService.js');
  const conds = safeParse(enemyRow?.active_conditions, []);
  const fx = conditionRollEffects(Array.isArray(conds) ? conds : [], 'save', ABILITY_FULL[ability]);
  const modifier = await enemySaveModifier(enemyRow, ability);
  let dodgeAdv = false;
  if (ability === 'dex') {
    try {
      const { getEntry } = await import('./actionStateService.js');
      const entry = await getEntry(sessionId, encounterSeq, combatFallbackId(sessionId, encounterSeq, enemyRow.id));
      dodgeAdv = !!entry.dodge;
    } catch { /* best-effort */ }
  }
  // Family 6: disadvantage marks on the target (party-caster spells only).
  let markDisadvantage = false;
  let markReasons = [];
  if (opts.casterKind === 'player' || opts.casterKind === 'companion') {
    try {
      const marks = await targetSaveMarksActive({ kind: 'enemy', id: enemyRow.id, sessionId, encounterSeq });
      const imposed = saveDisadvantageFromMarks(marks, {
        isSpellSave: true,
        spellDamageType: opts.spellDamageType || null,
        casterClass: opts.casterClass || null,
      });
      markDisadvantage = imposed.disadvantage;
      markReasons = imposed.reasons;
    } catch { /* marks are best-effort; the save proceeds without them */ }
  }
  const disadv = fx.disadvantage || markDisadvantage;
  let dice = null;
  let takenDie = null;
  let autoFail = false;
  if (fx.autoFail) {
    autoFail = true;
  } else if (disadv && !dodgeAdv) {
    dice = [rollD20(`spell save: ${enemyRow.name}`), rollD20(`spell save: ${enemyRow.name}`)];
    takenDie = Math.min(...dice);
  } else if (dodgeAdv && !disadv) {
    dice = [rollD20(`spell save: ${enemyRow.name}`), rollD20(`spell save: ${enemyRow.name}`)];
    takenDie = Math.max(...dice);
  } else {
    takenDie = rollD20(`spell save: ${enemyRow.name}`);
    dice = [takenDie];
  }
  const total = autoFail ? null : takenDie + modifier + (fx.penalty || 0);
  const success = !autoFail && total >= dc;
  await stashRoll(sessionId, {
    spell: spellName, actor: enemyRow.name, check: ABILITY_FULL[ability], kind: 'save',
    dc, modifier, dice, takenDie, total, outcome: success ? 'success' : 'failure', autoFail,
    subclassMarks: markReasons,
  });
  return { success, autoFail, dice, takenDie, total, modifier, dc, subclassDisadvantage: markDisadvantage, subclassMarks: markReasons };
}

/** Server save for a companion target (rollForNpc handles conditions).
 *  Family 6: the companion's subclass save modifiers apply inside
 *  rollForNpc; `opts.rerollWithHeroic` spends the companion's Heroic
 *  Inspiration for a reroll (D4, rollRequestService). */
export async function rollCompanionSave(sessionId, characterId, compName, ability, dc, spellName, opts = {}) {
  const res = await rollForNpc({ sessionId, characterId, actorName: compName, kind: 'save', name: ABILITY_FULL[ability], dc, rerollWithHeroic: opts.rerollWithHeroic || false });
  const success = res.autoFail ? false : (typeof res.total === 'number' ? res.total >= dc : res.outcome === 'success');
  await stashRoll(sessionId, {
    spell: spellName, actor: compName, check: ABILITY_FULL[ability], kind: 'save',
    dc, modifier: res.modifier, dice: res.dice, takenDie: res.takenDie, total: res.total,
    outcome: success ? 'success' : 'failure', autoFail: !!res.autoFail,
    subclassBonus: res.subclassBonus ?? 0, subclassReasons: res.subclassReasons || [],
    ...(res.rerolled ? { rerolled: true, firstRoll: res.firstRoll } : {}),
  });
  return { success, autoFail: !!res.autoFail, dice: res.dice, takenDie: res.takenDie, total: res.total, modifier: res.modifier, dc, subclassBonus: res.subclassBonus ?? 0, subclassReasons: res.subclassReasons || [], ...(res.rerolled ? { rerolled: true, firstRoll: res.firstRoll } : {}) };
}

/**
 * Post a pending PC save and bind an effect slot to it. A new request
 * replaces an unresolved one (the single-slot rule): if an earlier
 * effect was waiting, the DM is told it was superseded rather than
 * silently dropped.
 */
export async function postPendingSave(sessionId, characterId, abilityFull, dc, effectSlot, effect, kind = 'save') {
  const cfg = await readCfg(sessionId);
  for (const slot of ['pendingEnemySpellEffect', 'pendingRetaliation', 'pendingCounteredCast', 'pendingBacklashReduction']) {
    const old = cfg[slot];
    if (old?.spell) {
      await pushDmNotice(sessionId, `The awaited save for ${old.spell} was superseded by a newer request — its effect was not applied; adjudicate it if the fiction needs it.`);
    }
  }
  // Combat item 7: a superseded trap save gets the same notice.
  if (cfg.pendingTrapSave) {
    await pushDmNotice(sessionId, `The awaited save for the ${cfg.pendingTrapSave.trapLabel || 'trap'} was superseded by a newer request — its effect was not applied; adjudicate it if the fiction needs it.`);
  }
  // Combat item 8 / display casting: superseded escape and display
  // pendings get the same notice. The slots are written by their own
  // handlers; listing them here costs nothing when absent.
  if (cfg.pendingEscape) {
    await pushDmNotice(sessionId, `The awaited escape check was superseded by a newer request — its effect was not applied; adjudicate it if the fiction needs it.`);
  }
  if (cfg.pendingDisplay) {
    await pushDmNotice(sessionId, `The awaited display placement was superseded by a newer request — its effect was not applied; adjudicate it if the fiction needs it.`);
  }
  const res = await requestPcRoll({ sessionId, characterId, kind, name: abilityFull, dc });
  if (!res?.success) return null;
  const fresh = await readCfg(sessionId);
  const key = newEffectKey();
  fresh.pendingRoll = { ...(fresh.pendingRoll || {}), effectKey: key };
  effect.key = key;
  fresh[effectSlot] = effect;
  await writeCfg(sessionId, fresh);
  return effect;
}

// ---------------------------------------------------------------------------
// Damage / healing application (enemy spells and retaliations)
// ---------------------------------------------------------------------------

/** Damage to the PC: temp HP absorbs first, concentration checked.
 *  Family 6 (D9): the D9 resistance table applies BEFORE the HP move —
 *  resistanceFor reads the PC's subclass features (Aura of Warding,
 *  Fiendish Resilience, ...) with the damage type and the spell
 *  context. Best-effort: a lookup failure leaves the amount untouched,
 *  never fails the damage call. The returned `resistance` names the
 *  source when one applied, so the damage line can say what halved it.
 */
export async function damageToPc(sessionId, encounterSeq, pcId, amount, { type = null, attacker = null, spell = '' } = {}) {
  const { applyHpChange } = await import('./characterHpService.js');
  let adjusted = Number(amount) || 0;
  let resistance = { amount: adjusted, result: null, source: null, featureKey: null, featureName: null, cancelled: false, originalAmount: adjusted };
  try {
    const ledgerKey = await ledgerKeyForPlayer(pcId).catch(() => null);
    const r = await applyResistanceForActor(
      { kind: 'player', id: pcId, sessionId, encounterSeq, ledgerKey },
      adjusted, type, { sourceKind: spell ? 'spell' : null, magical: true });
    adjusted = r.amount;
    resistance = r;
  } catch { /* resistance is best-effort; the damage proceeds unadjusted */ }
  const res = await applyHpChange(pcId, -adjusted, `enemy spell: ${spell}`);
  const hpDamage = Math.max(0, (res?.previousHp ?? 0) - (res?.currentHp ?? 0));
  if (hpDamage > 0) {
    const { recordDamage } = await import('./lastDamageService.js');
    await recordDamage(sessionId, 'player', pcId, {
      amount: hpDamage, type, attackerKind: attacker?.kind || null, attackerId: attacker?.id ?? null,
      attackerName: attacker?.name || null, encounterSeq,
    });
  }
  return { applied: hpDamage, currentHp: res?.currentHp ?? null, concentrationCheck: res?.concentrationCheck || null, resistance };
}

/** Damage to a companion: direct HP update + companion concentration.
 *  Family 6 (D9): same resistance read as damageToPc, companion side.
 */
export async function damageToCompanion(sessionId, encounterSeq, compId, amount, { type = null, attacker = null, spell = '' } = {}) {
  const row = await dbGet('SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?', [compId]);
  if (!row) return { applied: 0 };
  let adjusted = Number(amount) || 0;
  let resistance = { amount: adjusted, result: null, source: null, featureKey: null, featureName: null, cancelled: false, originalAmount: adjusted };
  try {
    const npcRow = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [compId]).catch(() => null);
    const ledgerKey = npcRow ? await ledgerKeyForCompanion({ id: compId, npc_id: npcRow.npc_id }).catch(() => null) : null;
    const r = await applyResistanceForActor(
      { kind: 'companion', id: compId, sessionId, encounterSeq, ledgerKey },
      adjusted, type, { sourceKind: spell ? 'spell' : null, magical: true });
    adjusted = r.amount;
    resistance = r;
  } catch { /* resistance is best-effort; the damage proceeds unadjusted */ }
  const next = Math.max(0, row.companion_current_hp - adjusted);
  await dbRun('UPDATE companions SET companion_current_hp = ? WHERE id = ?', [next, compId]);
  const applied = row.companion_current_hp - next;
  let concentrationCheck = null;
  if (applied > 0) {
    try {
      const { checkCompanionConcentration } = await import('./concentrationService.js');
      concentrationCheck = await checkCompanionConcentration(compId, applied);
    } catch { /* best-effort */ }
    const { recordDamage } = await import('./lastDamageService.js');
    await recordDamage(sessionId, 'companion', compId, {
      amount: applied, type, attackerKind: attacker?.kind || null, attackerId: attacker?.id ?? null,
      attackerName: attacker?.name || null, encounterSeq,
    });
  }
  return { applied, currentHp: next, concentrationCheck, resistance };
}

/** Healing to an enemy ally: clamped at max; the dead stay dead. */
export async function healEnemy(sessionId, encounterSeq, enemyName, amount) {
  const row = await dbGet('SELECT current_hp, max_hp, status FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND name = ? AND status = ? LIMIT 1', [sessionId, encounterSeq, enemyName, 'active']);
  if (!row) return { applied: 0 };
  const next = Math.min(row.max_hp, row.current_hp + amount);
  await dbRun('UPDATE combat_enemies SET current_hp = ? WHERE session_id = ? AND encounter_seq = ? AND name = ? AND status = ?', [next, sessionId, encounterSeq, enemyName, 'active']);
  return { applied: next - row.current_hp, currentHp: next };
}

/** Damage to any target kind, through the right application path. */
export async function damageToTarget(sessionId, encounterSeq, target, amount, { type = null, attacker = null, spell = '', sessionCharacterId = null } = {}) {
  if (!target || !(amount > 0)) return { applied: 0 };
  if (target.kind === 'player') {
    return damageToPc(sessionId, encounterSeq, target.id, amount, { type, attacker, spell });
  }
  if (target.kind === 'companion') {
    return damageToCompanion(sessionId, encounterSeq, target.id, amount, { type, attacker, spell });
  }
  const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, target.name, amount, sessionCharacterId, {
    damageType: type, magical: true,
    attacker: attacker || null,
  });
  return { applied: res?.damageDealt ?? 0, killed: !!res?.killed, damageAdjustment: res?.damageAdjustment || null, concentrationCheck: res?.concentrationCheck || null };
}

// ---------------------------------------------------------------------------
// spell_effects rows
// ---------------------------------------------------------------------------

/**
 * Create (or refresh) a spell_effects row. Re-casting the same spell
 * from the same caster on the same target refreshes the row instead
 * of stacking a duplicate — one row per (encounter, target, spell,
 * caster).
 */
export async function createSpellEffect(sessionId, encounterSeq, target, spell, caster, { condition = null, saveAbility = null, saveDc = null, repeat = 'none', rounds = null, concentration = false } = {}) {
  // Direct callers may pass a caster without a ledger key ({kind, id,
  // name}); derive it rather than sending undefined to SQL, which the
  // driver rejects. Falls back to null (never undefined) if no id.
  let casterKey = caster?.key ?? null;
  if (casterKey == null && caster?.id != null) {
    if (caster.kind === 'player') casterKey = await ledgerKeyForPlayer(caster.id);
    else if (caster.kind === 'companion') {
      const row = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [caster.id]).catch(() => null);
      casterKey = await ledgerKeyForCompanion({ id: caster.id, npc_id: row?.npc_id });
    } else if (caster.kind === 'enemy') casterKey = combatFallbackId(sessionId, encounterSeq, caster.id);
  }
  await dbRun(
    'DELETE FROM spell_effects WHERE session_id = ? AND encounter_seq = ? AND target_kind = ? AND target_id = ? AND spell = ? AND caster_key = ?',
    [sessionId, encounterSeq, target.kind, target.id, String(spell).toLowerCase(), casterKey]
  );
  const r = await dbRun(
    `INSERT INTO spell_effects (session_id, encounter_seq, target_kind, target_id, target_name, spell, caster_kind, caster_key, caster_name, condition_name, save_ability, save_dc, repeat_save, rounds_remaining, concentration)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, encounterSeq, target.kind, target.id, target.name, String(spell).toLowerCase(), caster.kind, casterKey, caster.name,
     condition, saveAbility, saveDc, repeat, rounds, concentration ? 1 : 0]
  );
  return Number(r.lastInsertRowid);
}

/** Apply a catalog condition + its spell_effects row (upsert by spell). */
export async function applySpellCondition(sessionId, encounterSeq, target, spell, caster, { condition, saveAbility, saveDc, choice = null } = {}) {
  const cond = choice || condition;
  if (!cond) return null;
  // Combat item 8: spell-applied charmed/grappled inherit the spell
  // caster as source (marker-applied ones carry Charmer=/Grappler=).
  // The caster reference carries the row id when resolvable so escape
  // DCs and charmer matching work without re-resolving the key.
  let meta = null;
  if (cond === 'charmed' || cond === 'grappled') {
    const casterId = caster?.key ? await resolveActorId(caster.kind, caster.key).catch(() => null) : null;
    const ref = { kind: caster?.kind || null, id: casterId, key: caster?.key || null, name: caster?.name || null };
    meta = cond === 'charmed' ? { charmer: ref } : { grappler: ref };
  }
  const applied = await addCondition(target.kind, target.id, cond, meta).catch(() => null);
  // Combat item 8 (extends item 6 Tier D): incapacitation breaks
  // concentration for every kind, not just enemies — a paralyzed,
  // stunned, unconscious, petrified, or incapacitated creature drops
  // whatever it was concentrating on. This runs before the new
  // effect row is created, so it can never clear the row being
  // applied; it fires only when the condition actually landed.
  if (applied?.success && ['paralyzed', 'stunned', 'unconscious', 'petrified', 'incapacitated'].includes(String(cond).toLowerCase())) {
    try {
      const { breakConcentration, breakCompanionConcentration, breakEnemyConcentration } = await import('./concentrationService.js');
      if (target.kind === 'player') await breakConcentration(target.id, 'incapacitated');
      else if (target.kind === 'companion') await breakCompanionConcentration(target.id, 'incapacitated');
      else if (target.kind === 'enemy') await breakEnemyConcentration(sessionId, encounterSeq, target.id);
    } catch { /* best-effort */ }
  }
  const key = String(spell).toLowerCase();
  const repeat = REPEAT_SAVE_SPELLS.has(key) || COUNTING_SAVE_SPELLS.has(key) ? 'end_of_turn' : 'none';
  const rounds = durationRoundsFor(spell);
  const concentration = isConcentrationSpell(spell);
  const id = await createSpellEffect(sessionId, encounterSeq, target, spell, caster, {
    condition: cond, saveAbility, saveDc, repeat, rounds, concentration,
  });
  return { effectId: id, condition: cond, repeat, rounds, concentration, addCondition: applied };
}

// ---------------------------------------------------------------------------
// Enemy leveled-spell rule (Tier E, enemy side) — mirrors the party
// rule, over the enemy's own slot budget. Called by the ENEMY_CAST
// handler BEFORE castEnemySpell (which charges action/bonus/legendary),
// so a refused cast consumes nothing. The flag commits happen after
// the slot spend, via markEnemyLeveledCast.
// ---------------------------------------------------------------------------

export async function checkEnemyLeveledRule(sessionId, encounterSeq, enemyKey, { castTime = 'action', level = 0 } = {}) {
  const ct = String(castTime || 'action').toLowerCase();
  if (ct.includes('reaction')) return { allowed: true };
  const budget = await getBudget(sessionId, encounterSeq, enemyKey);
  if (budget == null) return { allowed: true, noSlot: true };
  if (ct.includes('bonus')) {
    if (budget.bonusSpent) {
      return { allowed: false, reason: `bonus action already spent this turn${budget.bonusSpentBy ? ` (${budget.bonusSpentBy})` : ''}`, remedy: 'Wait for your next turn.' };
    }
    if (budget.actionLeveledCast) {
      return { allowed: false, reason: 'a leveled action spell was already cast this turn, so no bonus-action spell can follow it', remedy: 'Cast a cantrip with your bonus action instead, or wait for your next turn.' };
    }
    return { allowed: true };
  }
  if (ct.includes('action')) {
    if (Number(level) > 0 && budget.bonusSpellCast) {
      return { allowed: false, reason: 'a bonus-action spell was already cast this turn, so only a cantrip can follow it', remedy: 'Cast a cantrip with your action instead, or wait for your next turn.' };
    }
    return { allowed: true };
  }
  return { allowed: false, reason: `a ${castTime} casting time cannot complete in a single combat turn`, remedy: 'Cast it out of combat, or pick a spell with a 1 action or 1 bonus action casting time.' };
}

export async function markEnemyLeveledCast(sessionId, encounterSeq, enemyKey, { castTime = 'action', level = 0 } = {}) {
  const ct = String(castTime || 'action').toLowerCase();
  const patch = {};
  if (ct.includes('bonus')) patch.bonusSpellCast = true;
  else if (ct.includes('action') && Number(level) > 0) patch.actionLeveledCast = true;
  else return null;
  return updateBudget(sessionId, encounterSeq, enemyKey, patch);
}

// ---------------------------------------------------------------------------
// Reaction usage validation + enemy cast prerequisites (handler gates)
// ---------------------------------------------------------------------------

/** Both directions: reaction spells need Reaction, others forbid it. */
export function validateReactionUsage(spellName, reactionFlag) {
  const key = String(spellName || '').toLowerCase().trim();
  const info = lookupSpell(spellName);
  if (!info) return { allowed: true, tracking: true };
  if (reactionFlag) {
    if (!REACTION_ONLY_SPELLS.includes(key)) {
      return { allowed: false, reason: `${spellName} is not a reaction spell`, remedy: 'Drop Reaction="true" or pick a reaction spell.' };
    }
    return { allowed: true };
  }
  if (REACTION_ONLY_SPELLS.includes(key)) {
    return { allowed: false, reason: `${spellName} can only be cast as a reaction`, remedy: 'Add Reaction="true" to the cast.' };
  }
  return { allowed: true };
}

/**
 * Handler-side gate, BEFORE any slot or economy spend: reaction
 * validity, save DC availability, attack-bonus availability. Never
 * invents a DC or bonus — a missing one refuses with remedy.
 */
export async function enemyCastPrereqs(sessionId, encounterSeq, enemyRow, spellName, opts = {}) {
  const v = validateReactionUsage(spellName, !!opts.reaction);
  if (!v.allowed) return v;
  if (v.tracking) return { allowed: true, tracking: true };
  if (opts.reaction) return { allowed: true };
  const key = String(spellName).toLowerCase().trim();
  if (key === 'magic missile') return { allowed: true };
  const saveAbility = spellSaveAbility(spellName);
  if (saveAbility) {
    const dc = await enemySpellDc(enemyRow, opts.dc ?? null);
    if (dc == null) {
      return { allowed: false, reason: `no save DC available for ${spellName}`, remedy: 'Declare Dc= on the cast or use a bestiary caster with a spellcasting DC.' };
    }
    return { allowed: true };
  }
  const spec = spellEffectSpec(spellName, { slotLevel: opts.level ?? 1, casterLevel: 1 });
  if (spec?.kind === 'damage') {
    const atk = await enemySpellAttack(enemyRow, opts.atkBonus ?? null);
    if (atk == null) {
      return { allowed: false, reason: `no spell attack bonus available for ${spellName}`, remedy: 'Declare AtkBonus= on the cast or use a bestiary caster with a spellcasting attack bonus.' };
    }
  }
  return { allowed: true };
}

/** Enemy casting modifier, derived (attackBonus − prof, or DC − 8 − prof). */
async function enemyCastingMod(enemyRow, dc = null, atk = null) {
  const cr = await enemyCr(enemyRow);
  const prof = crScaledModifier(Number(cr) || 1);
  if (atk != null) return atk - prof;
  if (dc != null) return dc - 8 - prof;
  const sc = await bestiarySpellcasting(enemyRow?.name);
  if (sc?.attackBonus != null) return sc.attackBonus - prof;
  if (sc?.dc != null) return sc.dc - 8 - prof;
  return 0;
}

// ---------------------------------------------------------------------------
// Counterspell arming
// ---------------------------------------------------------------------------

/** Party counterspell: arm on the message context (same batch only). */
export function armPartyCounter(context, { counterspeller, dc, targetName = null }) {
  if (!context || typeof context !== 'object') return false;
  if (!Array.isArray(context.armedCounterspells)) context.armedCounterspells = [];
  context.armedCounterspells.push({ counterspeller, dc, targetName: targetName ? String(targetName).toLowerCase() : null });
  return true;
}

/** Consume the first context counter matching the enemy caster. */
export function takePartyCounter(context, enemyName) {
  const list = context?.armedCounterspells;
  if (!Array.isArray(list) || list.length === 0) return null;
  const wanted = String(enemyName || '').toLowerCase();
  const idx = list.findIndex((c) => !c.targetName || c.targetName === wanted);
  if (idx === -1) return null;
  return list.splice(idx, 1)[0];
}

/** Enemy counterspell: arm persistently until the end of the round. */
export async function armEnemyCounter(sessionId, encounterSeq, { enemyName, dc, targetName = null }) {
  const cfg = await readCfg(sessionId);
  const list = Array.isArray(cfg.armedEnemyCounters) ? cfg.armedEnemyCounters : [];
  let round = null;
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    round = st?.round ?? null;
  } catch { /* no order → no round expiry */ }
  list.push({ enemyName, dc, targetName: targetName ? String(targetName).toLowerCase() : null, round });
  cfg.armedEnemyCounters = list;
  await writeCfg(sessionId, cfg);
  return true;
}

/** Consume the first live persistent counter matching the caster. */
export async function takeEnemyCounter(sessionId, encounterSeq, casterName) {
  const cfg = await readCfg(sessionId);
  const list = Array.isArray(cfg.armedEnemyCounters) ? cfg.armedEnemyCounters : [];
  if (list.length === 0) return null;
  let round = null;
  try {
    const st = await getTurnState(sessionId, encounterSeq);
    round = st?.round ?? null;
  } catch { /* no order */ }
  const wanted = String(casterName || '').toLowerCase();
  const kept = [];
  let found = null;
  for (const c of list) {
    if (found) { kept.push(c); continue; }
    if (round != null && c.round != null && c.round < round) {
      await pushDmNotice(sessionId, `A held counterspell from ${c.enemyName} expired unused at the end of round ${c.round}.`);
      continue;
    }
    if (!c.targetName || c.targetName === wanted) { found = c; continue; }
    kept.push(c);
  }
  cfg.armedEnemyCounters = kept;
  await writeCfg(sessionId, cfg);
  return found;
}

// ---------------------------------------------------------------------------
// Damage-hook reactions (Tier F2) + retaliation
// ---------------------------------------------------------------------------

async function reactorAlive(reactor) {
  try {
    let hp = 0;
    if (reactor.kind === 'player') {
      const row = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [reactor.id]);
      hp = row?.current_hp ?? 0;
    } else if (reactor.kind === 'companion') {
      const row = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [reactor.id]);
      hp = row?.companion_current_hp ?? 0;
    } else {
      const row = await dbGet('SELECT current_hp, status FROM combat_enemies WHERE id = ?', [reactor.id]);
      if (!row || row.status !== 'active') return false;
      hp = row.current_hp ?? 0;
    }
    if (!(hp > 0)) return false;
    const conds = await getConditions(reactor.kind, reactor.id).catch(() => []);
    const blocked = (Array.isArray(conds) ? conds : []).some((c) =>
      ['incapacitated', 'paralyzed', 'stunned', 'unconscious', 'petrified'].includes(normalizeConditionKey(c)));
    return !blocked;
  } catch { return false; }
}

/** HP refund (Absorb / Backlash): healing semantics, never a record. */
async function refundDamage(reactor, amount) {
  if (!(amount > 0)) return 0;
  if (reactor.kind === 'player') {
    const { applyHpChange } = await import('./characterHpService.js');
    const res = await applyHpChange(reactor.id, amount, 'reaction refund');
    return Math.max(0, (res?.currentHp ?? 0) - (res?.previousHp ?? 0));
  }
  if (reactor.kind === 'companion') {
    const row = await dbGet('SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?', [reactor.id]);
    if (!row) return 0;
    const next = Math.min(row.companion_max_hp, row.companion_current_hp + amount);
    await dbRun('UPDATE companions SET companion_current_hp = ? WHERE id = ?', [next, reactor.id]);
    return next - row.companion_current_hp;
  }
  const row = await dbGet('SELECT current_hp, max_hp FROM combat_enemies WHERE id = ?', [reactor.id]);
  if (!row) return 0;
  const next = Math.min(row.max_hp, row.current_hp + amount);
  await dbRun('UPDATE combat_enemies SET current_hp = ? WHERE id = ?', [next, reactor.id]);
  return next - row.current_hp;
}

/**
 * Retaliation damage (Rebuke / Backlash): the attacker saves (pending
 * when the attacker is the PC, server-rolled otherwise), half damage
 * on success. Retaliation damage is real damage — it writes a
 * last-damage record, so it can itself be answered (chains terminate
 * on the 1-reaction-per-round budget).
 */
async function retaliate(sessionId, encounterSeq, reactor, attacker, { spell, saveAbility, dc, diceCount, diceSides, damageType, sessionCharacterId }) {
  if (attacker.kind === 'player') {
    const effect = { spell, saveAbility, dc, diceCount, diceSides, damageType, target: attacker, reactor, encounterSeq, sessionCharacterId };
    const posted = await postPendingSave(sessionId, attacker.id, ABILITY_FULL[saveAbility], dc, 'pendingRetaliation', effect);
    if (!posted) return { pending: false, success: false, reason: 'could not post the retaliation save' };
    await pushDmNotice(sessionId, `Ask ${attacker.name} for a ${ABILITY_FULL[saveAbility]} save vs ${spell} DC ${dc} — the retaliation damage applies from it.`);
    return { pending: true, saveAbility, dc };
  }
  let save;
  if (attacker.kind === 'companion') {
    save = await rollCompanionSave(sessionId, sessionCharacterId, attacker.name, saveAbility, dc, spell);
  } else {
    const row = await dbGet('SELECT * FROM combat_enemies WHERE id = ?', [attacker.id]);
    if (!row) return { success: false, reason: 'attacker not found' };
    // Family 6: the retaliation spell was cast by the reactor — its
    // kind gates the caster-imposed disadvantage marks (party reactor
    // only). The reactor's class gates the Brand of the Sapping Scar
    // limb; best-effort, unknown fails closed inside the mark reader.
    let casterClass = null;
    try {
      if (reactor.kind === 'player') {
        casterClass = (await dbGet('SELECT class FROM characters WHERE id = ?', [reactor.id]))?.class || null;
      } else if (reactor.kind === 'companion') {
        casterClass = (await dbGet('SELECT companion_class FROM companions WHERE id = ?', [reactor.id]))?.companion_class || null;
      }
    } catch { /* unknown caster class — Brand limb fails closed */ }
    save = await rollEnemySave(sessionId, encounterSeq, row, saveAbility, dc, spell, { casterKind: reactor.kind, casterClass });
  }
  const total = roll(diceSides, diceCount, { reason: `retaliation: ${spell}` }).total;
  const applied = save.success ? Math.floor(total / 2) : total;
  const dmg = await damageToTarget(sessionId, encounterSeq, attacker, applied, { type: damageType, attacker: reactor, spell, sessionCharacterId });
  await stashSpellOutcome(sessionId, { spell, kind: 'damage', caster: reactor.name, target: attacker.name, total, applied: dmg.applied, saveSuccess: save.success, killed: dmg.killed || false });
  return { save, total, applied: dmg.applied, killed: dmg.killed || false };
}

/**
 * Resolve a damage-hook reaction for any reactor kind. The caller
 * (SPELL_CAST / ENEMY_CAST handler) checks the reaction budget and
 * spends the slot BEFORE calling; this function only resolves. Slot
 * and reaction spends happen for refused reactions only when the
 * caller already spent them — callers check first, spend after
 * success, per the gate-order rule.
 */
export async function resolveTrioReaction(sessionId, encounterSeq, reactor, spellName, level = 1, opts = {}) {
  const key = String(spellName).toLowerCase();
  const { peekDamage, takeDamage } = await import('./lastDamageService.js');
  const peeked = await peekDamage(sessionId, reactor.kind, reactor.id);
  if (!peeked) {
    return { type: 'reaction_spell', success: false, reason: 'no recent damage to answer — the triggering hit must land first, and only the latest hit can be answered', remedy: 'Declare the reaction after the damage result, before any newer damage lands.' };
  }
  if (!(await reactorAlive(reactor))) {
    return { type: 'reaction_spell', success: false, reason: 'the reactor is dead, dying, or incapacitated and cannot react' };
  }
  const record = await takeDamage(sessionId, reactor.kind, reactor.id);
  if (!record) {
    return { type: 'reaction_spell', success: false, reason: 'no recent damage to answer — the triggering hit must land first, and only the latest hit can be answered' };
  }
  let dc = null;
  let mod = 0;
  if (reactor.kind === 'player') {
    const row = await dbGet('SELECT ability_scores, level, class FROM characters WHERE id = ?', [reactor.id]);
    const prof = partySpellProfile('player', row);
    dc = prof?.saveDc ?? null;
    mod = prof?.modifier ?? 0;
  } else if (reactor.kind === 'companion') {
    const row = await dbGet('SELECT companion_ability_scores, companion_level, companion_class FROM companions WHERE id = ?', [reactor.id]);
    const prof = partySpellProfile('companion', row);
    dc = prof?.saveDc ?? null;
    mod = prof?.modifier ?? 0;
  } else {
    dc = await enemySpellDc(reactor.row || { name: reactor.name }, opts.dc ?? null);
    mod = await enemyCastingMod(reactor.row || { name: reactor.name }, dc, null);
  }
  if (key === 'absorb elements') {
    if (!ELEMENTAL_TYPES.includes(String(record.type || '').toLowerCase())) {
      return { type: 'reaction_spell', success: false, reason: 'Absorb Elements needs acid, cold, fire, lightning, or thunder damage — the triggering damage had no elemental type', remedy: 'Only elemental damage can be absorbed.' };
    }
    const refund = record.amount - Math.floor(record.amount / 2);
    const refunded = await refundDamage(reactor, refund);
    await setAbsorb(sessionId, encounterSeq, reactor.key, record.type);
    return { type: 'reaction_spell', success: true, spell: spellName, refunded, rider: { type: record.type, until: 'end of next turn' }, record };
  }
  if (key === 'hellish rebuke') {
    if (!record.attackerKind || record.attackerId == null) {
      return { type: 'reaction_spell', success: false, reason: 'nothing to rebuke — the triggering damage had no attacker (trap, fall, or environment)' };
    }
    if (dc == null) {
      return { type: 'reaction_spell', success: false, reason: 'no save DC available for the rebuke', remedy: 'Declare Dc= on the cast or use a caster with a spell save DC.' };
    }
    const diceCount = 2 + Math.max(0, Number(level || 1) - 1);
    const attacker = { kind: record.attackerKind, id: record.attackerId, name: record.attackerName };
    const ret = await retaliate(sessionId, encounterSeq, reactor, attacker, { spell: spellName, saveAbility: 'dex', dc, diceCount, diceSides: 10, damageType: 'fire', sessionCharacterId: opts.sessionCharacterId });
    return { type: 'reaction_spell', success: true, spell: spellName, retaliation: ret, record };
  }
  if (key === 'backlash') {
    if (reactor.kind === 'player') {
      // The reduction dice are the player's to roll: pend for the
      // reported total (the reported-total channel, not the save
      // channel — the retaliation save follows after the report).
      const effect = { key: newEffectKey(), spell: spellName, reactor, record, mod, encounterSeq, sessionCharacterId: opts.sessionCharacterId, postedAt: Date.now() };
      const fresh = await readCfg(sessionId);
      fresh.pendingBacklashReduction = effect;
      await writeCfg(sessionId, fresh);
      await pushDmNotice(sessionId, `Ask ${reactor.name} to roll 4d6+${mod} for Backlash and report the total — the damage reduction applies from it, then the attacker saves.`);
      return { type: 'reaction_spell', success: true, spell: spellName, pendingReduction: true, record };
    }
    const reductionRoll = roll(6, 4, { reason: 'backlash reduction' }).total + mod;
    const refund = Math.min(reductionRoll, record.amount);
    const refunded = await refundDamage(reactor, refund);
    if (!record.attackerKind || record.attackerId == null) {
      return { type: 'reaction_spell', success: true, spell: spellName, refunded, reductionRoll, note: 'no attacker to retaliate against' };
    }
    if (dc == null) {
      return { type: 'reaction_spell', success: true, spell: spellName, refunded, reductionRoll, note: 'no save DC available — retaliation skipped' };
    }
    const attacker = { kind: record.attackerKind, id: record.attackerId, name: record.attackerName };
    const ret = await retaliate(sessionId, encounterSeq, reactor, attacker, { spell: spellName, saveAbility: 'con', dc, diceCount: 4, diceSides: 6, damageType: 'force', sessionCharacterId: opts.sessionCharacterId });
    return { type: 'reaction_spell', success: true, spell: spellName, refunded, reductionRoll, retaliation: ret };
  }
  return { type: 'reaction_spell', success: false, reason: `unknown damage-hook reaction: ${spellName}` };
}

// ---------------------------------------------------------------------------
// Enemy cast resolution (Tiers A–D)
// ---------------------------------------------------------------------------

function critSpec(specStr) {
  return String(specStr || '').replace(/(\d+)d(\d+)/g, (_, c, s) => `${Number(c) * 2}d${s}`);
}

async function targetAcFor(sessionId, encounterSeq, target) {
  const { getPartyCover } = await import('./combatTurnService.js');
  if (target.kind === 'player') {
    const row = await dbGet('SELECT armor_class FROM characters WHERE id = ?', [target.id]);
    const cover = await getPartyCover(sessionId, encounterSeq, target.name).catch(() => null);
    const coverBonus = cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0;
    return (row?.armor_class || 10) + coverBonus;
  }
  if (target.kind === 'companion') {
    const row = await dbGet('SELECT armor_class FROM companions WHERE id = ?', [target.id]);
    const cover = await getPartyCover(sessionId, encounterSeq, target.name).catch(() => null);
    const coverBonus = cover === 'half' ? 2 : cover === 'three-quarters' ? 5 : 0;
    return (row?.armor_class || 10) + coverBonus;
  }
  const row = await dbGet('SELECT armor_class FROM combat_enemies WHERE id = ?', [target.id]);
  return row?.armor_class || 10;
}

/**
 * Resolve an enemy cast AFTER the handler's economy (slot, action,
 * bonus, legendary) and prereq gates. Returns the resolution result;
 * refused casts never reach here (the handler refuses first).
 */
export async function resolveEnemyCast(sessionId, encounterSeq, enemyRow, enemyKey, spellName, level, opts = {}) {
  const key = String(spellName).toLowerCase().trim();
  const info = lookupSpell(spellName);
  const caster = { kind: 'enemy', key: enemyKey, name: enemyRow.name, id: enemyRow.id };
  const sessionCharacterId = opts.sessionCharacterId ?? (await getSessionCharacter(sessionId));
  // Reaction branch (slot + reaction spent by the handler).
  if (opts.reaction) {
    if (key === 'counterspell') {
      const dc = await enemySpellDc(enemyRow, opts.dc ?? null);
      await armEnemyCounter(sessionId, encounterSeq, { enemyName: enemyRow.name, dc, targetName: (opts.targets || [])[0] || null });
      return { type: 'enemy_cast', success: true, spell: spellName, reaction: 'counterspell', counterArmed: true, dc };
    }
    if (key === 'shield') {
      await setShield(sessionId, encounterSeq, enemyKey);
      return { type: 'enemy_cast', success: true, spell: spellName, reaction: 'shield', shieldSet: true };
    }
    if (['absorb elements', 'hellish rebuke', 'backlash'].includes(key)) {
      const reactor = { kind: 'enemy', id: enemyRow.id, key: enemyKey, name: enemyRow.name, row: enemyRow };
      const trio = await resolveTrioReaction(sessionId, encounterSeq, reactor, spellName, level, { dc: opts.dc ?? null, sessionCharacterId });
      return { type: 'enemy_cast', success: trio.success !== false, spell: spellName, reaction: 'trio', trio };
    }
    return { type: 'enemy_cast', success: true, spell: spellName, reaction: 'tracking', note: 'reaction spell effects are DM-narrated (not wired)' };
  }
  // Non-catalog spells stay tracking-only (item-5 behavior).
  if (!info) {
    return { type: 'enemy_cast', success: true, spell: spellName, trackingOnly: true, note: 'spell not in the catalog — effects DM-narrated' };
  }
  // Concentration starts even when no targets are listed (the spell
  // is active, DM-side effects); prereqs already passed above.
  if (isConcentrationSpell(spellName)) {
    try {
      const { startEnemyConcentration } = await import('./concentrationService.js');
      await startEnemyConcentration(sessionId, encounterSeq, enemyRow.id, spellName);
    } catch { /* best-effort */ }
  }
  const targetNames = Array.isArray(opts.targets) ? opts.targets.filter(Boolean) : [];
  if (targetNames.length === 0) {
    return { type: 'enemy_cast', success: true, spell: spellName, trackingOnly: true, note: 'no targets listed — effects DM-narrated' };
  }
  const dc = await enemySpellDc(enemyRow, opts.dc ?? null);
  const atk = await enemySpellAttack(enemyRow, opts.atkBonus ?? null);
  const cr = await enemyCr(enemyRow);
  const casterLevel = opts.casterLevel ?? crToCasterLevel(cr) ?? 1;
  const mod = await enemyCastingMod(enemyRow, dc, atk);
  const spec = spellEffectSpec(spellName, { slotLevel: level, casterLevel });
  const results = [];
  // Magic Missile: one dart per listed name (repeat a name for extra
  // darts), grouped per target — simultaneous, so one application,
  // one concentration check, one record per target. Shield blocks it.
  if (key === 'magic missile') {
    const groups = new Map();
    for (const name of targetNames) groups.set(name, (groups.get(name) || 0) + 1);
    for (const [name, darts] of groups) {
      const target = await resolveTarget(sessionId, encounterSeq, name, sessionCharacterId);
      if (!target) { results.push({ target: name, skipped: 'target not found' }); continue; }
      const tKey = target.kind === 'player' ? await ledgerKeyForPlayer(target.id)
        : target.kind === 'companion' ? await ledgerKeyForCompanion({ id: target.id, npc_id: (await dbGet('SELECT npc_id FROM companions WHERE id = ?', [target.id]))?.npc_id })
        : combatFallbackId(sessionId, encounterSeq, target.id);
      const shielded = (await shieldBonusFor(sessionId, encounterSeq, tKey)) > 0;
      let total = 0;
      for (let i = 0; i < darts; i++) total += roll(4, 1, { reason: 'magic missile dart' }).total + 1;
      const applied = shielded ? 0 : total;
      const dmg = shielded ? { applied: 0 } : await damageToTarget(sessionId, encounterSeq, target, applied, { type: 'force', attacker: caster, spell: spellName, sessionCharacterId });
      await stashSpellOutcome(sessionId, { spell: spellName, kind: 'damage', caster: enemyRow.name, target: target.name, total, applied: dmg.applied, saveSuccess: null, shielded, killed: dmg.killed || false });
      results.push({ target: target.name, kind: target.kind, darts, total, applied: dmg.applied, shielded, killed: dmg.killed || false });
    }
    return { type: 'enemy_cast', success: true, spell: spellName, level, targets: results };
  }
  // Healing (enemy → enemy ally only in v1).
  if (spec?.kind === 'healing') {
    for (const name of targetNames) {
      const target = await resolveTarget(sessionId, encounterSeq, name, sessionCharacterId);
      if (!target) { results.push({ target: name, skipped: 'target not found' }); continue; }
      if (target.kind !== 'enemy') { results.push({ target: target.name, skipped: 'enemy healing targets enemy allies only in v1' }); continue; }
      let amount;
      if (spec.flat) {
        amount = spec.flatAmount === 'full' ? 99999 : spec.flatAmount + (spec.addCastingMod ? mod : 0);
      } else {
        amount = rollSpecString(spec.spec) + (spec.addCastingMod ? mod : 0);
      }
      const healed = await healEnemy(sessionId, encounterSeq, target.name, amount);
      await stashSpellOutcome(sessionId, { spell: spellName, kind: 'healing', caster: enemyRow.name, target: target.name, total: amount, applied: healed.applied });
      results.push({ target: target.name, kind: target.kind, total: amount, applied: healed.applied });
    }
    return { type: 'enemy_cast', success: true, spell: spellName, level, targets: results };
  }
  const saveAbility = spellSaveAbility(spellName);
  // Save spells: each target saves independently.
  if (saveAbility) {
    if (dc == null) {
      return { type: 'enemy_cast', success: false, reason: `no save DC available for ${spellName}`, remedy: 'Declare Dc= on the cast or use a bestiary caster with a spellcasting DC.' };
    }
    // Power Word Stun: no initial save — HP-gated (150 or fewer),
    // stunned outright, Constitution saves at end of turn to shake it
    // off. The catalog's save=con IS the repeat save, not an initial
    // one, so this branch never rolls one.
    if (key === 'power word stun') {
      for (const name of targetNames) {
        const target = await resolveTarget(sessionId, encounterSeq, name, sessionCharacterId);
        if (!target) { results.push({ target: name, skipped: 'target not found' }); continue; }
        let hp = 0;
        if (target.kind === 'player') hp = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [target.id]))?.current_hp ?? 0;
        else if (target.kind === 'companion') hp = (await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [target.id]))?.companion_current_hp ?? 0;
        else hp = target.row?.current_hp ?? (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [target.id]))?.current_hp ?? 0;
        if (hp > 150) { results.push({ target: target.name, kind: target.kind, skipped: 'more than 150 HP — unaffected' }); continue; }
        const condition = await applySpellCondition(sessionId, encounterSeq, target, spellName, caster, { condition: 'stunned', saveAbility: 'con', saveDc: dc });
        await stashSpellOutcome(sessionId, { spell: spellName, kind: 'condition', caster: enemyRow.name, target: target.name, condition: 'stunned', saveSuccess: null });
        results.push({ target: target.name, kind: target.kind, stunned: true, condition });
      }
      return { type: 'enemy_cast', success: true, spell: spellName, level, targets: results };
    }
    for (const name of targetNames) {
      const target = await resolveTarget(sessionId, encounterSeq, name, sessionCharacterId);
      if (!target) { results.push({ target: name, skipped: 'target not found' }); continue; }
      let save = null;
      if (target.kind === 'player') {
        const effect = { spell: spellName, spec: spec?.spec || null, addCastingMod: spec?.addCastingMod || false, mod, damageOnSave: spec?.damageOnSave || null, damageType: spec?.damageType || null, choice: opts.choice || null, target, caster, encounterSeq, sessionCharacterId };
        const posted = await postPendingSave(sessionId, target.id, ABILITY_FULL[saveAbility], dc, 'pendingEnemySpellEffect', effect);
        if (!posted) { results.push({ target: target.name, skipped: 'could not post the save request' }); continue; }
        await pushDmNotice(sessionId, `Ask ${target.name} for a ${ABILITY_FULL[saveAbility]} save vs ${spellName} DC ${dc} — the damage applies from it.`);
        results.push({ target: target.name, kind: target.kind, pending: true, saveAbility, dc });
        continue;
      }
      if (target.kind === 'companion') {
        save = await rollCompanionSave(sessionId, sessionCharacterId, target.name, saveAbility, dc, spellName);
      } else {
        // Family 6: the forcing spell here is the ENEMY's own cast, so
        // party caster-imposed disadvantage marks never apply.
        save = await rollEnemySave(sessionId, encounterSeq, target.row, saveAbility, dc, spellName, { casterKind: 'enemy' });
      }
      let total = 0;
      let applied = 0;
      let killed = false;
      if (spec?.kind === 'damage') {
        total = spec.flat
          ? (spec.flatAmount === 'full' ? 0 : spec.flatAmount + (spec.addCastingMod ? mod : 0))
          : rollSpecString(spec.spec) + (spec.addCastingMod ? mod : 0);
        const onSave = spec.damageOnSave || 'half';
        applied = save.success ? (onSave === 'none' ? 0 : Math.floor(total / 2)) : total;
        if (applied > 0) {
          const dmg = await damageToTarget(sessionId, encounterSeq, target, applied, { type: spec.damageType, attacker: caster, spell: spellName, sessionCharacterId });
          applied = dmg.applied;
          killed = dmg.killed || false;
        } else {
          applied = 0;
        }
      }
      let condition = null;
      const catalogCondition = info.appliesCondition || null;
      if (catalogCondition && !save.success && key !== 'sleep') {
        const choice = opts.choice || null;
        condition = await applySpellCondition(sessionId, encounterSeq, target, spellName, caster, { condition: catalogCondition, saveAbility, saveDc: dc, choice });
      } else if (key === 'sleep' && !save.success) {
        condition = { note: 'two-stage rule — condition DM-applied (incapacitated, then unconscious on a second failed save)' };
      } else if (key === 'slow' && !save.success) {
        condition = { note: 'multi-part effects DM-narrated (no catalog condition)' };
      }
      await stashSpellOutcome(sessionId, { spell: spellName, kind: spec?.kind === 'damage' ? 'damage' : 'effect', caster: enemyRow.name, target: target.name, total, applied, saveSuccess: save.success, killed, condition: condition?.condition || null });
      results.push({ target: target.name, kind: target.kind, save, total, applied, killed, condition });
    }
    return { type: 'enemy_cast', success: true, spell: spellName, level, targets: results };
  }
  // Attack-roll spells: spell attack vs AC (cover + Shield apply).
  if (spec?.kind === 'damage') {
    if (atk == null) {
      return { type: 'enemy_cast', success: false, reason: `no spell attack bonus available for ${spellName}`, remedy: 'Declare AtkBonus= on the cast or use a bestiary caster with a spellcasting attack bonus.' };
    }
    for (const name of targetNames) {
      const target = await resolveTarget(sessionId, encounterSeq, name, sessionCharacterId);
      if (!target) { results.push({ target: name, skipped: 'target not found' }); continue; }
      const tKey = target.kind === 'player' ? await ledgerKeyForPlayer(target.id)
        : target.kind === 'companion' ? await ledgerKeyForCompanion({ id: target.id, npc_id: (await dbGet('SELECT npc_id FROM companions WHERE id = ?', [target.id]))?.npc_id })
        : combatFallbackId(sessionId, encounterSeq, target.id);
      const shield = await shieldBonusFor(sessionId, encounterSeq, tKey);
      const baseAc = await targetAcFor(sessionId, encounterSeq, target);
      const targetAc = baseAc + shield;
      const die = rollD20(`spell attack: ${spellName}`);
      const totalToHit = die + atk;
      const isCrit = die === 20;
      const isFumble = die === 1;
      const hit = isCrit || (!isFumble && totalToHit >= targetAc);
      let total = 0;
      let applied = 0;
      let killed = false;
      if (hit) {
        const specStr = isCrit ? critSpec(spec.spec) : spec.spec;
        total = spec.flat
          ? (spec.flatAmount === 'full' ? 0 : spec.flatAmount + (spec.addCastingMod ? mod : 0))
          : rollSpecString(specStr) + (spec.addCastingMod ? mod : 0);
        const dmg = await damageToTarget(sessionId, encounterSeq, target, total, { type: spec.damageType, attacker: caster, spell: spellName, sessionCharacterId });
        applied = dmg.applied;
        killed = dmg.killed || false;
      }
      await stashSpellOutcome(sessionId, { spell: spellName, kind: 'damage', caster: enemyRow.name, target: target.name, total, applied, saveSuccess: null, hit, isCrit, targetAc, killed });
      results.push({ target: target.name, kind: target.kind, attackRoll: die, attackBonus: atk, totalToHit, targetAc, hit, isCrit, total, applied, killed });
    }
    return { type: 'enemy_cast', success: true, spell: spellName, level, targets: results };
  }
  // No save, no attack roll, no damage: buffs and utility — DM narrates.
  return { type: 'enemy_cast', success: true, spell: spellName, trackingOnly: true, note: 'no engine effect — DM narrates' };
}

// ---------------------------------------------------------------------------
// Chunk 3: pending-save application, repeat saves, turn boundary
// ---------------------------------------------------------------------------

/**
 * Map a turn-order entry to its spell_effects target identity.
 * Player/companion via world_id (legacy player:/companion: fallbacks);
 * enemy by parsing the combat fallback key, else by active name.
 */
async function keyToTarget(entry, sessionId, encounterSeq) {
  if (!entry) return null;
  const key = entry.key || '';
  if (entry.type === 'player') {
    if (key.startsWith('ID')) {
      const row = await dbGet('SELECT id FROM characters WHERE world_id = ?', [key]);
      if (row) return { kind: 'player', id: row.id, name: entry.name };
    }
    const m = /^player:(\d+)$/.exec(key);
    if (m) return { kind: 'player', id: Number(m[1]), name: entry.name };
    return null;
  }
  if (entry.type === 'companion') {
    if (key.startsWith('ID')) {
      const row = await dbGet('SELECT c.id FROM companions c JOIN npcs n ON n.id = c.npc_id WHERE n.world_id = ?', [key]);
      if (row) return { kind: 'companion', id: row.id, name: entry.name };
    }
    const m = /^companion:(\d+)$/.exec(key);
    if (m) return { kind: 'companion', id: Number(m[1]), name: entry.name };
    return null;
  }
  if (entry.type === 'enemy') {
    const parts = String(key).split(':');
    if (parts[0] === 'combat' && parts.length === 4 && /^\d+$/.test(parts[3])) {
      return { kind: 'enemy', id: Number(parts[3]), name: entry.name };
    }
    const row = await findActiveEnemy(sessionId, encounterSeq, entry.name);
    if (row) return { kind: 'enemy', id: row.id, name: entry.name };
    return null;
  }
  return null;
}

/**
 * Apply one repeat-save outcome to a spell_effects row. Counting
 * spells (flesh to stone): three successes end it, three failures
 * petrify (condition swapped, saves stop — stone until freed).
 * Single-save spells: success clears, failure keeps.
 */
export async function applyRepeatSaveResult(sessionId, encounterSeq, row, success) {
  const key = String(row.spell).toLowerCase();
  const target = row.target_name;
  if (COUNTING_SAVE_SPELLS.has(key)) {
    if (success) {
      const n = (row.repeat_successes || 0) + 1;
      if (n >= 3) {
        await removeCondition(row.target_kind, row.target_id, row.condition_name).catch(() => null);
        await dbRun('DELETE FROM spell_effects WHERE id = ?', [row.id]);
        await pushDmNotice(sessionId, `${target} saved against ${row.spell} three times — ${row.condition_name} ends.`);
        await stashSpellOutcome(sessionId, { spell: row.spell, kind: 'condition', caster: row.caster_name, target, condition: row.condition_name, cleared: true, saveSuccess: true });
        return { cleared: true, successes: n };
      }
      await dbRun('UPDATE spell_effects SET repeat_successes = ? WHERE id = ?', [n, row.id]);
      await pushDmNotice(sessionId, `${target} saved against ${row.spell} (${n} of 3) — ${row.condition_name} continues.`);
      return { cleared: false, successes: n };
    }
    const n = (row.repeat_failures || 0) + 1;
    if (n >= 3) {
      await removeCondition(row.target_kind, row.target_id, row.condition_name).catch(() => null);
      await addCondition(row.target_kind, row.target_id, 'petrified').catch(() => null);
      await dbRun("UPDATE spell_effects SET condition_name = 'petrified', repeat_save = 'none' WHERE id = ?", [row.id]);
      await pushDmNotice(sessionId, `${target} failed a third save against ${row.spell} — turned to stone.`);
      await stashSpellOutcome(sessionId, { spell: row.spell, kind: 'condition', caster: row.caster_name, target, condition: 'petrified', saveSuccess: false });
      return { petrified: true, failures: n };
    }
    await dbRun('UPDATE spell_effects SET repeat_failures = ? WHERE id = ?', [n, row.id]);
    await pushDmNotice(sessionId, `${target} failed the ${row.spell} repeat save (${n} of 3) — ${row.condition_name} continues.`);
    return { cleared: false, failures: n };
  }
  if (success) {
    await removeCondition(row.target_kind, row.target_id, row.condition_name).catch(() => null);
    await dbRun('DELETE FROM spell_effects WHERE id = ?', [row.id]);
    await pushDmNotice(sessionId, `${target} saved against ${row.spell} — ${row.condition_name} ends.`);
    await stashSpellOutcome(sessionId, { spell: row.spell, kind: 'condition', caster: row.caster_name, target, condition: row.condition_name, cleared: true, saveSuccess: true });
    return { cleared: true };
  }
  await pushDmNotice(sessionId, `${target} failed the ${row.spell} repeat save — ${row.condition_name} continues.`);
  return { cleared: false };
}

/**
 * Turn-boundary work, called from advanceTurn after the legendary
 * reset: end-of-turn repeat saves for the OUTGOING combatant (PC
 * pends a DM notice — the player rolls on request; companions and
 * enemies roll server-side), then duration ticks for the same
 * creature. Repeats run before ticks so a cleared row is not ticked.
 */
export async function processTurnBoundary(sessionId, encounterSeq, outgoing, incoming) {
  const out = { repeats: [], expired: [] };
  if (!outgoing) return out;
  const target = await keyToTarget(outgoing, sessionId, encounterSeq);
  if (!target) return { ...out, targetUnknown: outgoing.name };
  const rows = await dbAll('SELECT * FROM spell_effects WHERE session_id = ? AND encounter_seq = ? AND target_kind = ? AND target_id = ? ORDER BY id ASC', [sessionId, encounterSeq, target.kind, target.id]);
  const pcId = await getSessionCharacter(sessionId);
  for (const row of rows) {
    if (row.repeat_save !== 'end_of_turn') continue;
    if (target.kind === 'player') {
      const abilityFull = ABILITY_FULL[row.save_ability] || row.save_ability;
      await pushDmNotice(sessionId, `At the end of ${target.name}'s turn, ${target.name} repeats the ${row.spell} save (${abilityFull} DC ${row.save_dc}) — ask for the roll (ROLL_REQUEST Save=${abilityFull} DC=${row.save_dc}).`);
      out.repeats.push({ target: target.name, spell: row.spell, pending: true });
      continue;
    }
    let save = null;
    if (target.kind === 'companion') {
      save = await rollCompanionSave(sessionId, pcId, target.name, row.save_ability, row.save_dc, row.spell);
    } else {
      const enemyRow = await dbGet('SELECT * FROM combat_enemies WHERE id = ?', [target.id]);
      if (!enemyRow) continue;
      // Family 6: repeat saves are against the original caster's spell
      // (spell_effects.caster_kind); party casters' marks may apply.
      save = await rollEnemySave(sessionId, encounterSeq, enemyRow, row.save_ability, row.save_dc, row.spell, { casterKind: row.caster_kind });
    }
    const success = save ? (typeof save.success === 'boolean' ? save.success : (typeof save.total === 'number' ? save.total >= row.save_dc : false)) : false;
    const res = await applyRepeatSaveResult(sessionId, encounterSeq, row, success);
    out.repeats.push({ target: target.name, spell: row.spell, success, ...res });
  }
  const live = await dbAll('SELECT * FROM spell_effects WHERE session_id = ? AND encounter_seq = ? AND target_kind = ? AND target_id = ? AND rounds_remaining IS NOT NULL ORDER BY id ASC', [sessionId, encounterSeq, target.kind, target.id]);
  for (const row of live) {
    const left = (row.rounds_remaining || 0) - 1;
    if (left <= 0) {
      await removeCondition(row.target_kind, row.target_id, row.condition_name).catch(() => null);
      await dbRun('DELETE FROM spell_effects WHERE id = ?', [row.id]);
      await pushDmNotice(sessionId, `${row.spell} on ${row.target_name} expired (duration ended).`);
      out.expired.push({ target: row.target_name, spell: row.spell });
    } else {
      await dbRun('UPDATE spell_effects SET rounds_remaining = ? WHERE id = ?', [left, row.id]);
    }
  }
  return out;
}

/**
 * Route helper: a reported PC save that was NOT bound to a pending
 * effect (no effectKey consumed) may be a repeat save. Match the
 * oldest end-of-turn row for this PC with the rolled ability.
 * Returns null when nothing matches — the route then leaves the
 * roll alone (it may be an ordinary check or save).
 */
export async function resolvePcRepeatSave(sessionId, rollOutcome) {
  const pcId = await getSessionCharacter(sessionId);
  if (!pcId) return null;
  const raw = String(rollOutcome?.check || '').toLowerCase();
  const short = ABILITY_SHORT[raw] || (raw.length === 3 ? raw : null);
  if (!short) return null;
  const row = await dbGet("SELECT * FROM spell_effects WHERE session_id = ? AND target_kind = 'player' AND target_id = ? AND repeat_save = 'end_of_turn' AND save_ability = ? ORDER BY id ASC LIMIT 1", [sessionId, pcId, short]);
  if (!row) return null;
  const success = (typeof rollOutcome.total === 'number' && typeof rollOutcome.dc === 'number')
    ? rollOutcome.total >= rollOutcome.dc
    : rollOutcome.outcome === 'success';
  return applyRepeatSaveResult(sessionId, row.encounter_seq, row, success);
}

/**
 * Apply a reported PC save to the pending effect bound to it by
 * effectKey. Three slots: enemy spell damage, retaliation damage,
 * and a countered cast (failure fizzles, success completes the
 * stored cast with the slot already spent). Returns null when the
 * key matches no pending effect.
 */
export async function applyPendingSaveEffect(sessionId, effectKey, rollOutcome) {
  const cfg = await readCfg(sessionId);
  let slot = null;
  let effect = null;
  for (const s of ['pendingEnemySpellEffect', 'pendingRetaliation', 'pendingCounteredCast']) {
    if (cfg[s]?.key === effectKey) { slot = s; effect = cfg[s]; break; }
  }
  if (!effect) return null;
  const success = (typeof rollOutcome?.total === 'number' && typeof rollOutcome?.dc === 'number')
    ? rollOutcome.total >= rollOutcome.dc
    : rollOutcome?.outcome === 'success';
  const clear = async () => {
    const fresh = await readCfg(sessionId);
    delete fresh[slot];
    await writeCfg(sessionId, fresh);
  };
  if (slot === 'pendingEnemySpellEffect') {
    let total = 0;
    if (effect.spec) total = rollSpecString(effect.spec) + (effect.addCastingMod ? (effect.mod || 0) : 0);
    const damage = success ? (effect.damageOnSave === 'none' ? 0 : Math.floor(total / 2)) : total;
    const dmg = await damageToPc(sessionId, effect.encounterSeq, effect.target.id, damage, { type: effect.damageType, attacker: effect.caster, spell: effect.spell });
    await stashSpellOutcome(sessionId, { spell: effect.spell, kind: 'damage', caster: effect.caster?.name, target: effect.target.name, total, applied: dmg.applied, saveSuccess: success });
    // Failed saves also land the spell's condition (except Sleep,
    // whose two-stage text contradicts its catalog condition — the
    // DM applies that one by hand).
    let condition = null;
    if (!success && String(effect.spell).toLowerCase() !== 'sleep') {
      const info = lookupSpell(effect.spell);
      condition = await applySpellCondition(sessionId, effect.encounterSeq, effect.target, effect.spell, effect.caster, { condition: info?.appliesCondition || null, saveAbility: spellSaveAbility(effect.spell), saveDc: rollOutcome?.dc ?? null, choice: effect.choice || null });
      if (condition) {
        await stashSpellOutcome(sessionId, { spell: effect.spell, kind: 'condition', caster: effect.caster?.name, target: effect.target.name, condition: condition.condition, saveSuccess: false });
      }
    }
    await clear();
    return { slot, applied: dmg.applied, total, saveSuccess: success, condition };
  }
  if (slot === 'pendingRetaliation') {
    const total = roll(effect.diceSides, effect.diceCount, { reason: `retaliation: ${effect.spell}` }).total;
    const damage = success ? Math.floor(total / 2) : total;
    const dmg = await damageToTarget(sessionId, effect.encounterSeq, effect.target, damage, { type: effect.damageType, attacker: effect.reactor, spell: effect.spell, sessionCharacterId: effect.sessionCharacterId });
    await stashSpellOutcome(sessionId, { spell: effect.spell, kind: 'damage', caster: effect.reactor?.name, target: effect.target.name, total, applied: dmg.applied, saveSuccess: success });
    await clear();
    return { slot, applied: dmg.applied, total, saveSuccess: success };
  }
  // pendingCounteredCast
  if (!success) {
    await pushDmNotice(sessionId, `${effect.casterName}'s ${effect.spell} was countered — no effect, slot stays spent.`);
    await clear();
    return { slot, countered: true };
  }
  const { castSpell, castCompanionSpell } = await import('./spellCastService.js');
  let completed = null;
  if (effect.casterKind === 'companion') {
    completed = await castCompanionSpell(effect.casterId, effect.casterName, effect.spell, effect.level, { sessionId, target: effect.targets?.[0] || null, targets: effect.targets, skipSlotSpend: true });
  } else {
    completed = await castSpell(effect.casterId, effect.spell, effect.level, { sessionId, target: effect.targets?.[0] || null, targets: effect.targets, skipSlotSpend: true });
  }
  await clear();
  // The slot was spent at declaration; the completion must not
  // report a second spend (same correction as readied releases).
  if (completed && completed.slotsUsed != null) { completed.slotsUsed -= 1; completed.slotsRemaining += 1; }
  if (completed) completed.slotConsumed = false;
  return { slot, countered: false, completed };
}

/**
 * Apply a reported Backlash reduction total: refund min(total,
 * damage taken), then retaliate (Con save vs 4d6 force) against the
 * attacker on the triggering record. Only PC reactors reach this
 * slot (companions/enemies roll the reduction server-side).
 */
export async function resolveBacklashReduction(sessionId, reportedTotal) {
  const cfg = await readCfg(sessionId);
  const effect = cfg.pendingBacklashReduction;
  if (!effect) return null;
  const total = Math.max(0, Math.trunc(Number(reportedTotal) || 0));
  const refund = Math.min(total, effect.record.amount);
  const refunded = await refundDamage(effect.reactor, refund);
  const fresh = await readCfg(sessionId);
  delete fresh.pendingBacklashReduction;
  await writeCfg(sessionId, fresh);
  const attacker = effect.record;
  if (!attacker?.attackerKind || !attacker?.attackerId) {
    return { refunded, note: 'no attacker on the triggering damage — no retaliation' };
  }
  const pcId = await getSessionCharacter(sessionId);
  const pcRow = pcId ? await dbGet('SELECT * FROM characters WHERE id = ?', [pcId]) : null;
  const profile = pcRow ? partySpellProfile('player', pcRow) : null;
  const dc = profile?.saveDc ?? null;
  if (dc == null) return { refunded, note: 'no save DC — retaliation skipped' };
  const ret = await retaliate(sessionId, effect.encounterSeq, effect.reactor, { kind: attacker.attackerKind, id: attacker.attackerId, name: attacker.attackerName }, { spell: 'backlash', saveAbility: 'con', dc, diceCount: 4, diceSides: 6, damageType: 'force', sessionCharacterId: effect.sessionCharacterId });
  return { refunded, reductionTotal: total, retaliation: ret };
}

export default {
  pushDmNotice, rollSpecString, crToCasterLevel, durationRoundsFor,
  enemySpellDc, enemySpellAttack, partySpellProfile,
  checkReaction, spendReaction, reactionNameFor,
  shieldBonusFor, setShield, absorbRiderFor, setAbsorb, consumeAbsorb,
  zoneFor, sameZone, resolveTarget, rollEnemySave, rollCompanionSave,
  postPendingSave, damageToPc, damageToCompanion, healEnemy,
  damageToTarget, createSpellEffect, applySpellCondition,
  checkEnemyLeveledRule, markEnemyLeveledCast, validateReactionUsage,
  enemyCastPrereqs, armPartyCounter, takePartyCounter,
  armEnemyCounter, takeEnemyCounter, resolveTrioReaction, resolveEnemyCast,
  applyRepeatSaveResult, processTurnBoundary, resolvePcRepeatSave,
  applyPendingSaveEffect, resolveBacklashReduction,
};
