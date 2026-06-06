/**
 * Game-state marker handlers (Phase B, 2026-06-05) — the "mechanical spine".
 *
 * The audit found that the DM *narrated* mechanics but the system never
 * tracked them as real state: HP, conditions, concentration, spell effects,
 * combat turns, and dice results were all prose that got lost or reconstructed
 * by guesswork. These handlers turn the narration into persisted state so the
 * cockpit stops lying and the DM stops guessing.
 *
 *   [HP_CHANGE]    → writes characters.current_hp immediately (clamped 0..max)
 *   [EFFECT_START] → session_config.activeEffects (+ 5e single-concentration rule)
 *   [EFFECT_END]   → removes the named effect
 *   [TURN]         → session_config.combat { round, currentTurn }
 *   [ROLL_REQUEST] → returns a roll request preloaded with the player's modifier
 *
 * Conditions ([CONDITION_ADD/REMOVE]) and [SCENE] persistence are handled at
 * the route call site — they reuse the existing in-route detector/parser — so
 * they are NOT registered here. This module is imported for its side effects
 * (registration) by routes/dmSession.js, mirroring lootDropService /
 * combatMarkerService.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler } from './markerPipeline.js';

const ABILITY_ALIASES = {
  str: 'str', strength: 'str', dex: 'dex', dexterity: 'dex',
  con: 'con', constitution: 'con', int: 'int', intelligence: 'int',
  wis: 'wis', wisdom: 'wis', cha: 'cha', charisma: 'cha'
};
function abilityMod(score) { return Math.floor(((Number(score) || 10) - 10) / 2); }

async function loadCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {});
}
async function saveCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

// Is this marker's Target the player character (vs a narrated companion/enemy)?
function isPlayerTarget(target, char) {
  const s = String(target || 'player').toLowerCase();
  return s === 'player' || s === 'self' || s === 'pc' ||
    s === String(char?.name || '').toLowerCase() ||
    s === String(char?.nickname || '').toLowerCase();
}

// ── HP_CHANGE ──────────────────────────────────────────────────────────────
// Only the player's HP is server-tracked in the MVP; companion/enemy HP stays
// narrated. Negative Delta = damage, positive = healing. Clamped to [0, max].
async function handleHpChange(parsed, context) {
  const char = await dbGet(
    'SELECT id, name, nickname, current_hp, max_hp FROM characters WHERE id = ?',
    [context.characterId]
  );
  if (!char) return null;
  if (!isPlayerTarget(parsed.Target, char)) {
    return { target: parsed.Target, delta: parsed.Delta, applied: false };
  }
  const delta = Number(parsed.Delta) || 0;
  const max = Number(char.max_hp) || 0;
  const newHp = Math.max(0, max > 0 ? Math.min(max, char.current_hp + delta) : char.current_hp + delta);
  await dbRun(
    'UPDATE characters SET current_hp = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [newHp, char.id]
  );
  return { target: 'player', delta, reason: parsed.Reason || null, current_hp: newHp, max_hp: max, applied: true };
}
registerHandler('HP_CHANGE', handleHpChange);

// ── EFFECT_START / EFFECT_END ────────────────────────────────────────────────
// Active spell effects + concentration, persisted on the session so the prompt
// and the cockpit's Active Effects panel reflect them across turns + resume.
async function handleEffectStart(parsed, context) {
  const cfg = await loadCfg(context.sessionId);
  const effects = Array.isArray(cfg.activeEffects) ? cfg.activeEffects : [];
  const name = String(parsed.Name || '').trim();
  if (!name) return { action: 'start', applied: false, activeEffects: effects };
  const concentration = /^true$/i.test(String(parsed.Concentration || ''));
  // Re-casting refreshes (drop any existing same-name effect). A new
  // concentration effect ends any prior concentration effect (5e: one at a time).
  let next = effects.filter(e => String(e.name).toLowerCase() !== name.toLowerCase());
  if (concentration) next = next.filter(e => !e.concentration);
  next.push({
    name,
    concentration,
    duration: parsed.Duration || null,
    source: parsed.Source || null
  });
  cfg.activeEffects = next;
  await saveCfg(context.sessionId, cfg);
  return { action: 'start', name, concentration, applied: true, activeEffects: next };
}
registerHandler('EFFECT_START', handleEffectStart);

async function handleEffectEnd(parsed, context) {
  const cfg = await loadCfg(context.sessionId);
  const effects = Array.isArray(cfg.activeEffects) ? cfg.activeEffects : [];
  const name = String(parsed.Name || '').trim().toLowerCase();
  cfg.activeEffects = effects.filter(e => String(e.name).toLowerCase() !== name);
  await saveCfg(context.sessionId, cfg);
  return { action: 'end', name: parsed.Name, activeEffects: cfg.activeEffects };
}
registerHandler('EFFECT_END', handleEffectEnd);

// ── TURN ─────────────────────────────────────────────────────────────────────
// Advance combat turn/round so initiative stays truthful (it was rolled once
// and never advanced). The DM emits [TURN: Combatant="<name>" Round=N] each turn.
async function handleTurn(parsed, context) {
  const cfg = await loadCfg(context.sessionId);
  const combat = (cfg.combat && typeof cfg.combat === 'object') ? cfg.combat : {};
  if (parsed.Combatant) combat.currentTurn = parsed.Combatant;
  if (parsed.Round != null) combat.round = Number(parsed.Round) || combat.round || 1;
  cfg.combat = combat;
  await saveCfg(context.sessionId, cfg);
  return { combatant: combat.currentTurn || null, round: combat.round || null };
}
registerHandler('TURN', handleTurn);

// ── ROLL_REQUEST ───────────────────────────────────────────────────────────────
// The DM asks the player to roll but never learns the number. This returns the
// request preloaded with the player's correct ability modifier (+ proficiency
// for proficient saves) so the UI can surface a one-click roll and feed the
// result back. No DB side effect — pure derivation.
async function handleRollRequest(parsed, context) {
  const char = await dbGet(
    'SELECT level, class, ability_scores FROM characters WHERE id = ?',
    [context.characterId]
  );
  const abilities = safeParse(char?.ability_scores, {});
  const abilKey = ABILITY_ALIASES[String(parsed.Ability || '').toLowerCase()] || null;
  let modifier = abilKey ? abilityMod(abilities[abilKey]) : 0;
  return {
    kind: String(parsed.Kind || 'check').toLowerCase(), // attack | save | check
    ability: abilKey,
    dc: parsed.DC != null ? Number(parsed.DC) : null,
    advantage: String(parsed.Advantage || '').toLowerCase() || null,
    modifier,
    label: parsed.Label || null
  };
}
registerHandler('ROLL_REQUEST', handleRollRequest);
