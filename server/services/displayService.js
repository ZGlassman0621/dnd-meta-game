/**
 * Display casting (combined build with combat item 8).
 *
 * A caster aims a spell at an object or spot to deliberately miss as
 * a display of power. Same rules for players and enemies. A display
 * is a real cast: it costs the slot and the action and can be
 * counterspelled. A placement roll follows: a bare d20 for a plain
 * display (only nat 1 / nat 20 matter), or the Intimidation check
 * itself when Intimidate="true" (one roll, not two — the show of
 * power is the method). Nat 1 mishandles and nat 20 surges, both
 * rolled system-side among what the room actually holds, invisible
 * in play (the player sees only the world outcome):
 *   mishap: splash onto the Beside creature, strike a room feature
 *     (effect follows the spell type), or a harmless fizzle;
 *   surge: a stored secret clicks open (revealed on the room, so it
 *     cannot reveal twice), or a resounding display.
 * Rooms-must-house-contents: candidates come from the linked room's
 * stored features when the encounter is linked; otherwise the DM
 * declares them with Features="name:kind, ...". Secret features are
 * excluded from mishap strikes (a hidden thing cannot be hit blind)
 * and are the only surge-reveal candidates. Splash damage uses the
 * spell's catalog dice with no save in v1 (the mishap is already the
 * punishment; a save step, including chained PC pendings, is future
 * work) and is attributed to the displayer, so the damage trio can
 * answer it. Burning/electrified/frozen states are recorded in the
 * result and the DM notice, not persisted as ongoing room state, in
 * v1. Non-catalog spells display like SPELL_CAST tracks them: slot
 * and action spent, placement rolls, splash cosmetic (no dice).
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { lookupSpell, spellEffectSpec } from '../data/spellCatalog.js';
import { getCurrentEncounterSeq, findActiveEnemy, applyPartyDamageToEnemy } from './enemyCombatService.js';
import { hasIncapacitatingCondition, findCompanionIdByName } from './conditionService.js';

function truthyFlag(v) {
  return ['true', 'yes', '1'].includes(String(v ?? '').toLowerCase().trim());
}

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested directly)
// ---------------------------------------------------------------------------

/** "haybale:flammable, trough:water, stone wall" -> [{name, kind|null}]. */
export function parseDeclaredFeatures(str) {
  if (!str) return [];
  return String(str).split(',').map((part) => {
    const p = part.trim();
    if (!p) return null;
    const colon = p.indexOf(':');
    if (colon === -1) return { name: p, kind: null };
    return { name: p.slice(0, colon).trim(), kind: p.slice(colon + 1).trim().toLowerCase() || null };
  }).filter(Boolean);
}

/** Mishap categories available for these candidates. Secret features
 *  are never mishap targets; splash needs a Beside creature. */
export function mishapOptions({ besideName, features }) {
  const opts = [];
  if (besideName) opts.push('splash');
  if ((features || []).some((f) => f.kind !== 'secret')) opts.push('feature');
  opts.push('fizzle');
  return opts;
}

/** Surge categories available. Reveal needs an unrevealed secret. */
export function surgeOptions({ features }) {
  const opts = [];
  if ((features || []).some((f) => f.kind === 'secret' && !f.revealed)) opts.push('reveal');
  opts.push('resounding');
  return opts;
}

/** What a feature strike does, by spell damage type and feature kind.
 *  v1: recorded in the result and the DM notice, not persisted as
 *  ongoing room state (burning, electrified, frozen). */
export function featureStrikeEffect(spellType, kind) {
  const t = String(spellType || '').toLowerCase();
  const k = String(kind || '').toLowerCase();
  if (t === 'fire' && k === 'flammable') return 'ignites';
  if (t === 'lightning' && k === 'water') return 'electrifies';
  if (t === 'cold' && k === 'water') return 'freezes';
  if (t === 'fire' && k === 'water') return 'steam (cosmetic)';
  return 'cosmetic strike (scorch/chip/crack, no mechanical effect)';
}

function pickUniform(options) {
  return options[roll(options.length, 1, { reason: 'display mishap/surge' }).total - 1];
}

// ---------------------------------------------------------------------------
// Room candidates
// ---------------------------------------------------------------------------

/** Linked room features win when the encounter is linked (even when
 *  the room holds zero features — the DM cannot invent contents that
 *  contradict linked data). Otherwise the DM-declared list stands in.
 *  Legacy rooms without a features array also fall to declared. */
export async function getDisplayCandidates(sessionId, encounterSeq, declaredStr) {
  if (sessionId && encounterSeq) {
    try {
      const { getEncounterRoom } = await import('./dungeonSceneStorageService.js');
      const room = await getEncounterRoom(sessionId, encounterSeq).catch(() => null);
      if (room && Array.isArray(room.features)) {
        return {
          features: room.features.map((f) => ({ name: f.name, kind: f.kind || null, revealed: !!f.revealed })),
          source: 'room', sceneId: room.sceneId, roomKey: room.roomKey,
        };
      }
    } catch { /* fall through to declared */ }
  }
  const declared = parseDeclaredFeatures(declaredStr);
  return { features: declared, source: declared.length ? 'declared' : 'none' };
}

/** Persist a secret's revealed flag on its room (best-effort: a
 *  failed write leaves the notice as the only record). */
export async function markSecretRevealed(candidates, featureName) {
  if (!candidates || candidates.source !== 'room' || !candidates.sceneId || !candidates.roomKey) return false;
  try {
    const row = await dbGet('SELECT features_json FROM scene_rooms WHERE scene_id = ? AND room_key = ?', [candidates.sceneId, candidates.roomKey]);
    const features = safeParse(row?.features_json, []);
    if (!Array.isArray(features)) return false;
    let changed = false;
    for (const f of features) {
      if (f.name === featureName && f.kind === 'secret' && !f.revealed) { f.revealed = true; changed = true; }
    }
    if (!changed) return false;
    await dbRun('UPDATE scene_rooms SET features_json = ? WHERE scene_id = ? AND room_key = ?', [JSON.stringify(features), candidates.sceneId, candidates.roomKey]);
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Mishap / surge application
// ---------------------------------------------------------------------------

function splashDamageSpec(spell, level) {
  const fx = spellEffectSpec(spell, { slotLevel: level });
  // spellEffectSpec returns kind 'damage' | 'healing' — there is no
  // damage field on the spec, so kind is the damage test.
  if (!fx || fx.kind !== 'damage') return null;
  return fx;
}

function rollSplashDamage(fx) {
  if (fx.flat) {
    const amount = fx.flatAmount === 'full' ? 0 : Number(fx.flatAmount) || 0;
    return { amount, type: fx.damageType || null, spec: String(fx.flatAmount) };
  }
  const r = roll(fx.sides, fx.count, { reason: 'display splash' });
  const mod = fx.modifier || 0;
  return { amount: r.total + mod, type: fx.damageType || null, spec: `${fx.count}d${fx.sides}${mod > 0 ? `+${mod}` : mod < 0 ? `${mod}` : ''}` };
}

/** Apply a splash onto the Beside creature: the spell's catalog
 *  dice, no save in v1, attributed to the displayer (so the damage
 *  trio can answer it). Exported so tests can cover the damage path
 *  without depending on the mishap pick. */
export async function applySplash(ctx, spell, level) {
  const fx = splashDamageSpec(spell, level);
  if (!fx) return { category: 'splash', target: ctx.besideName, damage: 0, detail: 'spell energy washes over them harmlessly (no damage dice)' };
  const dmg = rollSplashDamage(fx);
  try {
    if (ctx.casterSide === 'party') {
      await applyPartyDamageToEnemy(ctx.sessionId, ctx.encounterSeq, ctx.besideName, dmg.amount, ctx.characterId,
        { damageType: dmg.type, attacker: { kind: ctx.casterKind, id: ctx.casterId, name: ctx.casterName } });
    } else {
      const ess = await import('./enemySpellService.js');
      const charRow = await dbGet('SELECT name FROM characters WHERE id = ?', [ctx.characterId]);
      const isPcTarget = /^(player|pc|character)$/i.test(ctx.besideName) ||
        (charRow && ctx.besideName.toLowerCase() === String(charRow.name).toLowerCase());
      if (isPcTarget) {
        await ess.damageToPc(ctx.sessionId, ctx.encounterSeq, ctx.characterId, dmg.amount,
          { type: dmg.type, attacker: { kind: 'enemy', id: ctx.casterId, name: ctx.casterName }, spell });
      } else {
        const compId = await findCompanionIdByName(ctx.characterId, ctx.besideName);
        if (compId) {
          await ess.damageToCompanion(ctx.sessionId, ctx.encounterSeq, compId, dmg.amount,
            { type: dmg.type, attacker: { kind: 'enemy', id: ctx.casterId, name: ctx.casterName }, spell });
        }
      }
    }
  } catch { /* splash application is best-effort; the result still reports it */ }
  return { category: 'splash', target: ctx.besideName, damage: dmg.amount, damageType: dmg.type, spec: dmg.spec };
}

async function applyMishap(ctx, candidates, spell, level) {
  const opts = mishapOptions({ besideName: ctx.besideName, features: candidates.features });
  const category = pickUniform(opts);
  if (category === 'fizzle') return { category: 'fizzle', detail: 'a loud harmless fizzle' };
  if (category === 'splash') return applySplash(ctx, spell, level);
  const hittable = candidates.features.filter((f) => f.kind !== 'secret');
  const feature = pickUniform(hittable);
  const fx = splashDamageSpec(spell, level);
  const spellType = fx?.damageType ? String(fx.damageType).toLowerCase() : null;
  return { category: 'feature', feature: feature.name, kind: feature.kind || null, effect: featureStrikeEffect(spellType, feature.kind) };
}

async function applySurge(ctx, candidates) {
  const opts = surgeOptions({ features: candidates.features });
  const category = pickUniform(opts);
  if (category === 'resounding') return { category: 'resounding', detail: 'the display is spectacular, beyond its intent' };
  const secrets = candidates.features.filter((f) => f.kind === 'secret' && !f.revealed);
  const feature = pickUniform(secrets);
  await markSecretRevealed(candidates, feature.name);
  return { category: 'reveal', feature: feature.name, detail: 'a stored secret clicks open and becomes a known, usable exit' };
}

function formatDisplayNotice(effect, result) {
  const who = effect.casterName;
  const what = effect.spell;
  if (result.mishap) {
    const m = result.mishap;
    let detail;
    if (m.category === 'splash') detail = `splashes ${m.target}${m.damage ? ` for ${m.damage}${m.damageType ? ` ${m.damageType}` : ''} damage` : ' harmlessly'}`;
    else if (m.category === 'feature') detail = `strikes ${m.feature} (${m.effect})`;
    else detail = m.detail;
    const intim = result.intimidation === 'critical_failure' ? ' The Intimidation critically fails.' : '';
    return `${who}'s ${what} display mishandles! It ${detail}.${intim}`;
  }
  if (result.surge) {
    const s = result.surge;
    const detail = s.category === 'reveal' ? `${s.feature} clicks open and becomes a known, usable exit` : s.detail;
    const intim = result.intimidation === 'critical_success' ? ' The Intimidation critically succeeds — you determine the outcome by the target\'s nature.' : '';
    return `${who}'s ${what} display surges! ${detail}.${intim}`;
  }
  const intim = result.intimidation === 'success' ? ' The Intimidation succeeds.' : result.intimidation === 'failure' ? ' The Intimidation fails.' : '';
  return `${who}'s ${what} display lands where meant — no damage, it was a deliberate miss.${intim}`;
}

/** Shared placement resolution for PC pendings and immediate
 *  companion/enemy rolls. Pushes the DM notice; returns the result. */
export async function resolvePlacement(sessionId, effect, takenDie, outcome) {
  const candidates = await getDisplayCandidates(sessionId, effect.encounterSeq, effect.features);
  const ctx = {
    sessionId, encounterSeq: effect.encounterSeq,
    casterSide: effect.casterKind === 'enemy' ? 'enemy' : 'party',
    casterKind: effect.casterKind, casterId: effect.casterId, casterName: effect.casterName,
    characterId: effect.characterId, besideName: effect.besideName || null,
  };
  let result;
  if (takenDie === 1) {
    const mishap = await applyMishap(ctx, candidates, effect.spell, effect.level);
    result = { success: true, placed: false, mishap, spell: effect.spell };
    if (effect.intimidate) result.intimidation = 'critical_failure';
  } else if (takenDie === 20) {
    const surge = await applySurge(ctx, candidates);
    result = { success: true, placed: true, surge, spell: effect.spell };
    if (effect.intimidate) result.intimidation = 'critical_success';
  } else {
    result = { success: true, placed: true, spell: effect.spell };
    if (effect.intimidate) result.intimidation = outcome === 'success' ? 'success' : 'failure';
  }
  const ess = await import('./enemySpellService.js');
  await ess.pushDmNotice(sessionId, formatDisplayNotice(effect, result));
  return result;
}

// ---------------------------------------------------------------------------
// Pending resolution (PC path)
// ---------------------------------------------------------------------------

/** Resolve a pending display on the PC's reported roll. Returns false
 *  for foreign keys (the route falls through to the next branch). */
export async function applyPendingDisplay(sessionId, effectKey, rollOutcome) {
  if (!sessionId || !effectKey) return false;
  const cfg = await readCfg(sessionId);
  const effect = cfg.pendingDisplay || null;
  if (!effect || effect.key !== effectKey) return false;
  delete cfg.pendingDisplay;
  await writeCfg(sessionId, cfg);
  const ess = await import('./enemySpellService.js');
  if (effect.stage === 'counter') {
    const success = rollOutcome?.outcome === 'success' || rollOutcome?.outcome === 'critical_success' || rollOutcome?.takenDie === 20;
    if (!success) {
      await ess.pushDmNotice(sessionId, `${effect.casterName}'s ${effect.spell} display was countered — no effect, slot stays spent.`);
      return { success: true, countered: true, spell: effect.spell };
    }
    const placed = await ess.postPendingSave(sessionId, effect.characterId, effect.placementName, effect.placementDc, 'pendingDisplay',
      { ...effect, stage: 'placement' }, effect.placementKind);
    if (!placed) {
      await ess.pushDmNotice(sessionId, `${effect.casterName}'s display could not post its placement roll — adjudicate it.`);
      return { success: true, countered: false, spell: effect.spell, placementFailed: true };
    }
    await ess.pushDmNotice(sessionId, `The counterspell failed — ask ${effect.casterName} for ${effect.placementName}${effect.placementDc != null ? ` vs DC ${effect.placementDc}` : ''} to place the ${effect.spell} display.`);
    return { success: true, countered: false, spell: effect.spell, placementPending: true };
  }
  return resolvePlacement(sessionId, effect, rollOutcome?.takenDie, rollOutcome?.outcome);
}

// ---------------------------------------------------------------------------
// Spellcasting ability for placement checks
// ---------------------------------------------------------------------------

const ABILITY_FULL = { int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

async function placementAbilityFor(isPc, charRow, compRow) {
  try {
    const { partySpellProfile } = await import('./enemySpellService.js');
    const prof = isPc ? partySpellProfile('player', charRow) : partySpellProfile('companion', compRow);
    if (prof?.ability && ABILITY_FULL[prof.ability]) return ABILITY_FULL[prof.ability];
  } catch { /* fall through to the default */ }
  // No spellcasting profile (a non-caster displaying a cantrip):
  // showmanship carries the placement.
  return 'Charisma';
}

// ---------------------------------------------------------------------------
// DISPLAY handler (party)
// ---------------------------------------------------------------------------

registerMarkerHandler('DISPLAY', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const spell = String(parsed?.Spell || '').trim();
    const spot = String(parsed?.Target || '').trim();
    if (!spell || !spot) return { type: 'display', success: false, reason: 'DISPLAY needs Spell= and Target=' };
    const intimidate = truthyFlag(parsed?.Intimidate);
    const dc = parsed?.Dc != null ? Number(parsed.Dc) : null;
    if (intimidate && !Number.isFinite(dc)) {
      return { type: 'display', success: false, reason: 'an intimidating display needs Dc=', remedy: 'Re-emit DISPLAY with Dc=<the Intimidation DC for this target>.' };
    }
    const besideName = String(parsed?.Beside || '').trim() || null;
    const features = parsed?.Features || null;
    // Caster resolution (mirrors castPartySpell).
    const casterRaw = parsed?.Caster || null;
    const isPc = !casterRaw || /^(player|pc|character)$/i.test(String(casterRaw));
    let casterKind = 'player';
    let casterKey = null;
    let casterName = 'Player';
    let compId = null;
    let charRow = null;
    let compRow = null;
    if (isPc) {
      const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
      casterKey = await ledgerKeyForPlayer(context.characterId);
      charRow = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
      casterName = charRow?.name || 'Player';
    } else {
      compId = await findCompanionIdByName(context.characterId, casterRaw);
      if (!compId) return { type: 'display', success: false, reason: `unknown caster: ${casterRaw}` };
      compRow = await dbGet('SELECT * FROM companions WHERE id = ?', [compId]);
      if (!compRow || compRow.progression_type !== 'class_based' || !compRow.companion_class) {
        return { type: 'display', success: false, reason: 'not_a_caster', caster: casterRaw, spell };
      }
      const { ledgerKeyForCompanion } = await import('./turnLedgerService.js');
      casterKey = await ledgerKeyForCompanion({ id: compId, npc_id: compRow.npc_id });
      casterKind = 'companion';
      casterName = casterRaw;
    }
    if (await hasIncapacitatingCondition(isPc ? 'player' : 'companion', isPc ? context.characterId : compId)) {
      return { type: 'display', success: false, reason: `${casterName} is incapacitated and cannot take actions` };
    }
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    const level = parsed?.Level != null ? Number(parsed.Level) : (lookupSpell(spell)?.level ?? 0);
    const tls = await import('./turnLedgerService.js');
    const gate = await tls.checkSpellIdentity(context.sessionId, encounterSeq, casterKey);
    if (!gate.allowed) return { type: 'display', success: false, reason: gate.reason, remedy: gate.remedy };
    // A display always costs an action + the slot, whatever the
    // spell's own cast time (the display is a performance, not the
    // spell's normal casting).
    const econ = await tls.checkSpellEconomy(context.sessionId, encounterSeq, casterKey, { castTime: 'action', level });
    if (!econ.allowed) return { type: 'display', success: false, reason: econ.reason, remedy: econ.remedy };
    const ess = await import('./enemySpellService.js');
    const { peekSpellSlot, spendSpellSlot } = await import('./spellCastService.js');
    const placementName = intimidate ? 'Intimidation' : await placementAbilityFor(isPc, charRow, compRow);
    const placementDc = intimidate ? dc : null;
    const placementKind = intimidate ? 'skill' : 'ability';
    const baseEffect = {
      stage: 'placement', spell, level,
      casterKind, casterId: isPc ? context.characterId : compId, casterName,
      characterId: context.characterId, encounterSeq, besideName, features, intimidate,
      placementName, placementDc, placementKind,
    };
    // Armed enemy counter (mirrors castPartySpell step 7).
    if (context.sessionId && encounterSeq) {
      const counter = await ess.takeEnemyCounter(context.sessionId, encounterSeq, casterName);
      if (counter) {
        const rearm = async () => ess.armEnemyCounter(context.sessionId, encounterSeq, { enemyName: counter.enemyName, dc: counter.dc, targetName: counter.targetName });
        if (counter.dc == null) {
          await rearm();
        } else if (isPc) {
          const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
          if (!peek.ok) { await rearm(); return { type: 'display', success: false, reason: peek.reason }; }
          const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
          await tls.spendSpellEconomy(context.sessionId, encounterSeq, casterKey, { castTime: 'action', level, spellName: spell });
          await ess.postPendingSave(context.sessionId, context.characterId, 'Constitution', counter.dc, 'pendingDisplay',
            { ...baseEffect, stage: 'counter' });
          await ess.pushDmNotice(context.sessionId, `Ask ${casterName} for a Constitution save vs counterspell DC ${counter.dc} — the ${spell} display completes on a success, fizzles on a failure.`);
          return { type: 'display', spell, level, slotConsumed: spent.consumed, success: true, countered: 'pending', counterspeller: counter.enemyName };
        } else {
          const save = await ess.rollCompanionSave(context.sessionId, context.characterId, casterName, 'con', counter.dc, spell);
          if (!save.success) {
            const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
            if (!peek.ok) { await rearm(); return { type: 'display', success: false, reason: peek.reason }; }
            const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
            await tls.spendSpellEconomy(context.sessionId, encounterSeq, casterKey, { castTime: 'action', level, spellName: spell });
            return { type: 'display', spell, level, slotConsumed: spent.consumed, success: true, countered: true, counterspeller: counter.enemyName };
          }
          // Save made: counter consumed, display proceeds below.
        }
      }
    }
    const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
    if (!peek.ok) return { type: 'display', success: false, reason: peek.reason };
    const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
    await tls.spendSpellEconomy(context.sessionId, encounterSeq, casterKey, { castTime: 'action', level, spellName: spell });
    if (isPc) {
      const posted = await ess.postPendingSave(context.sessionId, context.characterId, placementName, placementDc, 'pendingDisplay', baseEffect, placementKind);
      if (!posted) return { type: 'display', success: false, reason: 'could not post the placement roll' };
      await ess.pushDmNotice(context.sessionId, `Ask ${casterName} for ${placementName}${placementDc != null ? ` vs DC ${placementDc}` : ''} to place the ${spell} display.`);
      return { type: 'display', spell, level, slotConsumed: spent.consumed, success: true, pending: true, placement: placementName };
    }
    // Companion: system placement roll now.
    let takenDie;
    let outcome = null;
    if (intimidate) {
      const { rollForNpc } = await import('./rollRequestService.js');
      const r = await rollForNpc({ sessionId: context.sessionId, characterId: context.characterId, actorName: casterName, kind: 'skill', name: 'Intimidation', dc });
      takenDie = r.takenDie;
      outcome = r.outcome;
    } else {
      takenDie = roll(20, 1, { reason: 'display placement' }).total;
    }
    const result = await resolvePlacement(context.sessionId, baseEffect, takenDie, outcome);
    return { type: 'display', spell, level, slotConsumed: spent.consumed, success: true, ...result };
  } catch (e) {
    console.error('[displayService] DISPLAY handler failed:', e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// ENEMY_DISPLAY handler
// ---------------------------------------------------------------------------

registerMarkerHandler('ENEMY_DISPLAY', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const enemyName = parsed?.Enemy;
    const spell = parsed?.Spell;
    if (!enemyName || !spell) return { type: 'enemy_display', success: false, reason: 'ENEMY_DISPLAY needs Enemy= and Spell=' };
    const spot = String(parsed?.Target || '').trim();
    if (!spot) return { type: 'enemy_display', success: false, reason: 'ENEMY_DISPLAY needs Target=' };
    const intimidate = truthyFlag(parsed?.Intimidate);
    const dc = parsed?.Dc != null ? Number(parsed.Dc) : null;
    if (intimidate && !Number.isFinite(dc)) {
      return { type: 'enemy_display', success: false, reason: 'an intimidating display needs Dc=', remedy: 'Re-emit ENEMY_DISPLAY with Dc=<the Intimidation DC for this target>.' };
    }
    const besideName = String(parsed?.Beside || '').trim() || null;
    const features = parsed?.Features || null;
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return { type: 'enemy_display', success: false, reason: 'no active encounter' };
    const enemy = await findActiveEnemy(context.sessionId, encounterSeq, enemyName);
    if (!enemy) return { type: 'enemy_display', success: false, reason: `unknown enemy: ${enemyName}` };
    if (await hasIncapacitatingCondition('enemy', enemy.id)) {
      return { type: 'enemy_display', success: false, reason: `${enemy.name} is incapacitated and cannot take actions` };
    }
    const key = (await import('./worldIdService.js')).combatFallbackId(context.sessionId, encounterSeq, enemy.id);
    const level = parsed?.Level != null ? Number(parsed.Level) : (lookupSpell(spell)?.level ?? 0);
    const ess = await import('./enemySpellService.js');
    // Leveled-spell-per-turn rule (mirrors ENEMY_CAST step (c)):
    // a display is a real cast, so a bonus-action leveled spell
    // earlier this turn blocks a leveled display.
    const leveled = await ess.checkEnemyLeveledRule(context.sessionId, encounterSeq, key, { castTime: 'action', level });
    if (!leveled.allowed) return { type: 'enemy_display', success: false, reason: leveled.reason, remedy: leveled.remedy };
    // Economy + slot (mirrors ENEMY_CAST step (d)).
    const { castEnemySpell } = await import('./enemyEconomyService.js');
    const cast = await castEnemySpell(context.sessionId, encounterSeq, key, enemy.id, enemy.name, spell, level, { dc, reaction: false });
    if (cast.error) return { type: 'enemy_display', success: false, reason: cast.error };
    await ess.markEnemyLeveledCast(context.sessionId, encounterSeq, key, { castTime: 'action', level });
    // Party counter (mirrors ENEMY_CAST step (e)).
    const counter = ess.takePartyCounter(context, enemy.name);
    if (counter) {
      const save = await ess.rollEnemySave(context.sessionId, encounterSeq, enemy, 'con', counter.dc, spell);
      if (!save.success) {
        return { type: 'enemy_display', success: true, countered: true, counterspeller: counter.counterspeller, enemy: enemy.name, spell, level, slotsRemaining: cast.slotsRemaining };
      }
    }
    // System placement roll now.
    let takenDie;
    let outcome = null;
    if (intimidate) {
      const snap = safeParse(enemy.stats_json, null);
      const skillVal = snap?.skills?.intimidation ?? snap?.skills?.Intimidation ?? null;
      const chaMod = Math.floor(((snap?.abilities?.cha ?? snap?.abilities?.charisma ?? 10) - 10) / 2);
      const mod = Number.isFinite(Number(skillVal)) ? Number(skillVal) : chaMod;
      takenDie = roll(20, 1, { reason: 'display intimidation' }).total;
      outcome = takenDie === 1 ? 'critical_failure' : takenDie === 20 ? 'critical_success' : (takenDie + mod >= dc ? 'success' : 'failure');
    } else {
      takenDie = roll(20, 1, { reason: 'display placement' }).total;
    }
    const effect = {
      stage: 'placement', spell, level,
      casterKind: 'enemy', casterId: enemy.id, casterName: enemy.name,
      characterId: context.characterId, encounterSeq, besideName, features, intimidate,
    };
    const result = await resolvePlacement(context.sessionId, effect, takenDie, outcome);
    return { type: 'enemy_display', success: true, enemy: enemy.name, spell, level, slotsRemaining: cast.slotsRemaining, ...result };
  } catch (e) {
    console.error('[displayService] ENEMY_DISPLAY handler failed:', e.message);
    return null;
  }
});

export default {
  parseDeclaredFeatures, mishapOptions, surgeOptions, featureStrikeEffect,
  getDisplayCandidates, resolvePlacement, applyPendingDisplay,
  applySplash, markSecretRevealed,
};
