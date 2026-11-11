// ---------------------------------------------------------------------------
// Lair durability (2026-11-02, Zach-approved design).
//
// A hazard room's structure is a HIGH HP pool, not a 0-100 score that
// incidental hits can collapse by accident. Durability % is derived:
//   percent = floor(100 * env_hp / env_max_hp)
// Bands (percent -> hazard chance per round, system-rolled):
//   100 sound, 90-99 worn (5%), 75-89 unstable (15%), 50-74 dangerous
//   (30%), 25-49 collapsing (50%), 1-24 ruin (70%), 0 collapse pending.
// Any damage source counts: boss shakes, missed spells, AoE, explosives,
// melee strikes on walls/floor. The engine tracks it; damage is never
// DM-declared into the score except through the LAIR_DAMAGE marker's
// Amount, which the DM reports as the effect that hit the environment.
// Recovery is intentional only, never time: magical stabilization HALTS
// decay but restores no HP; mechanical / construction work RESTORES HP.
// Under 10% the score decays on its own each round unless magically
// stabilized. At 0 HP the room enters collapse-pending (warning), and
// only resolveCollapseEscape seals it — escaped or buried. Buried is a
// recorded flag only: this service never damages party HP, so a party
// can never die buried alive by default after beating the boss.
// Hazards are drawn ONLY from features the room actually holds (kinds
// in HAZARD_FEATURE_KINDS); 'secret' features are never hazard targets
// (same rule as display casting), and a room with no hazard features
// produces no hazard, never an invented one. DM-declared LAIR_ACTION
// stays on top of this background layer, unchanged.
// Persistence: the lair_durability row is keyed by lair_key, never by
// an enemy row, so deleting the boss changes nothing about the score.
// ---------------------------------------------------------------------------

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll, rollD20 } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';

export const DEFAULT_MAX_HP = 1000;
export const DECAY_HP_PER_ROUND = 20;
export const MECHANICAL_RESTORE_HP = 100;

// Feature kinds that can actually hazard. Cover kinds collapse; flammable
// burns; water floods; elevation drops things; hazard_zone is the generic
// unstable ground. difficult_terrain and darkness cannot hazard, and
// 'secret' is unrevealed by definition and is never a target.
export const HAZARD_FEATURE_KINDS = [
  'hazard_zone', 'flammable', 'water', 'elevation',
  'cover_half', 'cover_three_quarters', 'cover_full',
];

export const BANDS = [
  { band: 'sound', min: 100, hazardChance: 0 },
  { band: 'worn', min: 90, hazardChance: 0.05 },
  { band: 'unstable', min: 75, hazardChance: 0.15 },
  { band: 'dangerous', min: 50, hazardChance: 0.30 },
  { band: 'collapsing', min: 25, hazardChance: 0.50 },
  { band: 'ruin', min: 0, hazardChance: 0.70 },
];

export function durabilityPercent(hp, maxHp) {
  if (!maxHp || maxHp <= 0) return 0;
  return Math.max(0, Math.min(100, Math.floor((100 * hp) / maxHp)));
}

export function bandForPercent(percent) {
  for (const b of BANDS) {
    if (percent >= b.min) return b;
  }
  return BANDS[BANDS.length - 1];
}

// --- Hazard auto-wiring (2026-11-04, Zach-locked design) -----------------
// Severity is a property of the stability band, not of the roll: a
// near-full lair can only throw benign or minor hazards, and
// life-threatening hazards only become possible at low stability
// (ruin band). This is the severity ceiling that keeps one hazard per
// round from compounding into a death spiral. DCs are a fixed table
// per severity — a hazard entry's avoidance terms, never invented at
// roll time. Save ability is Dexterity by default; water (a flood
// sweeping combatants off their feet) is Strength.
// Benign hazards deal no damage: they are precursors, a warning that
// a major event from the same feature family may follow. A precursor
// escalates the next hazard drawn from the same feature kind by one
// severity tier, then is consumed.
export const SEVERITY_ORDER = ['benign', 'minor', 'major', 'life-threatening'];

export const HAZARD_SAVE_DC = {
  benign: null,
  minor: 12,
  major: 14,
  'life-threatening': 16,
};

export const HAZARD_SAVE_ABILITY = {
  water: 'str',
  flammable: 'dex',
  hazard_zone: 'dex',
  elevation: 'dex',
  cover_half: 'dex',
  cover_three_quarters: 'dex',
  cover_full: 'dex',
};

export function severityForBand(band) {
  if (band === 'worn') return 'benign';
  if (band === 'unstable') return 'minor';
  if (band === 'dangerous' || band === 'collapsing') return 'major';
  return 'life-threatening';
}

export function escalateSeverity(severity) {
  const i = SEVERITY_ORDER.indexOf(severity);
  if (i < 0) return severity;
  return SEVERITY_ORDER[Math.min(SEVERITY_ORDER.length - 1, i + 1)];
}

function abilityModifier(score) {
  const s = Number(score);
  if (!Number.isFinite(s)) return 0;
  return Math.floor((s - 10) / 2);
}

function parseAbilityScores(raw) {
  const obj = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  return (obj && typeof obj === 'object') ? obj : {};
}

async function getHazardState(lairKey) {
  const row = await dbGet('SELECT hazard_state_json FROM lair_durability WHERE lair_key = ?', [String(lairKey)]).catch(() => null);
  const state = row ? safeParse(row.hazard_state_json, {}) : {};
  return (state && typeof state === 'object') ? state : {};
}

async function setHazardState(lairKey, state) {
  await dbRun('UPDATE lair_durability SET hazard_state_json = ? WHERE lair_key = ?', [JSON.stringify(state || {}), String(lairKey)]);
}

function hazardDiceForBand(band) {
  if (band === 'worn') return '1d6';
  if (band === 'unstable') return '2d6';
  if (band === 'dangerous') return '3d6';
  if (band === 'collapsing') return '4d6';
  return '6d6';
}

function rollDiceString(dice) {
  const m = /^(\d+)d(\d+)$/.exec(String(dice || ''));
  if (!m) return 0;
  return roll(Number(m[2]), Number(m[1]), { reason: 'lair hazard' }).total;
}

function parseFeatures(json) {
  const arr = safeParse(json, []);
  if (!Array.isArray(arr)) return [];
  return arr.map((f) => {
    if (typeof f === 'string') return { name: f, kind: null };
    if (f && typeof f === 'object') return { name: String(f.name || 'Feature'), kind: f.kind || null };
    return { name: 'Feature', kind: null };
  });
}

function parseStrings(json) {
  const arr = safeParse(json, []);
  return Array.isArray(arr) ? arr.map(String) : [];
}

export function stabilityDisplay(row) {
  const percent = durabilityPercent(row.env_hp, row.env_max_hp);
  const band = bandForPercent(percent).band;
  const filled = Math.round(percent / 10);
  return {
    percent,
    band,
    bar: '█'.repeat(filled) + '░'.repeat(10 - filled),
    hp: row.env_hp,
    maxHp: row.env_max_hp,
    collapsed: row.collapsed === 1,
    escapePending: row.escape_pending === 1,
    buried: row.buried === 1,
    magicallyStabilized: row.magically_stabilized === 1,
    warning: row.collapsed === 1 ? 'collapsed'
      : row.escape_pending === 1 ? 'collapse imminent — escape now'
      : percent < 10 ? 'failing — decay unless magically stabilized'
      : percent < 25 ? 'critical' : null,
  };
}

function shapeRow(row, features) {
  if (!row) return null;
  const display = stabilityDisplay(row);
  return {
    lairKey: row.lair_key,
    name: row.name,
    campaignId: row.campaign_id,
    sceneId: row.scene_id,
    sceneRoomId: row.scene_room_id,
    features,
    exits: parseStrings(row.exits_json),
    hp: row.env_hp,
    maxHp: row.env_max_hp,
    percent: display.percent,
    band: display.band,
    hazardChance: bandForPercent(display.percent).hazardChance,
    collapsed: display.collapsed,
    escapePending: display.escapePending,
    buried: display.buried,
    magicallyStabilized: display.magicallyStabilized,
    display,
  };
}

export async function getLair(lairKey) {
  if (!lairKey) return null;
  const row = await dbGet('SELECT * FROM lair_durability WHERE lair_key = ?', [String(lairKey)]);
  if (!row) return null;
  let features = parseFeatures(row.features_json);
  if (row.scene_room_id) {
    try {
      const room = await dbGet('SELECT features_json FROM scene_rooms WHERE id = ?', [row.scene_room_id]);
      if (room && room.features_json) features = parseFeatures(room.features_json);
    } catch { /* scene table absent in a minimal DB: stored features stand */ }
  }
  return shapeRow(row, features);
}

export async function createLair({
  lairKey, name = '', campaignId = null, sceneId = null, sceneRoomId = null,
  features = [], exits = [], maxHp = DEFAULT_MAX_HP,
} = {}) {
  const key = String(lairKey || '').trim();
  if (!key) return { success: false, reason: 'LAIR_CREATE needs a Lair key' };
  const max = Math.trunc(Number(maxHp));
  if (!Number.isFinite(max) || max <= 0) return { success: false, reason: 'MaxHp must be a positive number' };
  const existing = await dbGet('SELECT id FROM lair_durability WHERE lair_key = ?', [key]);
  if (existing) return { success: false, reason: `lair already exists: ${key}`, remedy: 'Use LAIR_DAMAGE / LAIR_STABILIZE on the existing lair, or a different Lair key.' };
  await dbRun(
    `INSERT INTO lair_durability
     (lair_key, campaign_id, scene_id, scene_room_id, name, features_json, exits_json, env_hp, env_max_hp)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [key, campaignId, sceneId, sceneRoomId, String(name || ''),
     JSON.stringify(features), JSON.stringify(exits), max, max]
  );
  const lair = await getLair(key);
  return { success: true, ...lair };
}

async function updateRow(lairKey, patch) {
  const sets = Object.keys(patch).map((k) => `${k} = ?`).join(', ');
  await dbRun(`UPDATE lair_durability SET ${sets} WHERE lair_key = ?`, [...Object.values(patch), String(lairKey)]);
}

export async function applyEnvironmentalDamage(lairKey, amount, { source = null } = {}) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}`, remedy: 'Create the lair first with LAIR_CREATE (or check the Lair key).' };
  if (lair.collapsed) return { success: false, reason: `${lairKey} is already collapsed`, remedy: 'Mechanically stabilize / excavate it back before it can take more damage.' };
  if (lair.escapePending) return { success: false, reason: `${lairKey} is already at collapse — resolve the escape first`, remedy: 'Resolve the collapse escape before further damage.' };
  const dmg = Math.trunc(Number(amount));
  if (!Number.isFinite(dmg) || dmg <= 0) return { success: false, reason: 'Amount must be a positive number' };
  const hp = Math.max(0, lair.hp - dmg);
  const patch = { env_hp: hp };
  if (hp === 0) patch.escape_pending = 1;
  await updateRow(lairKey, patch);
  const after = await getLair(lairKey);
  return { success: true, damage: dmg, source: source || null, ...after };
}

export function hazardFeatureFor(lair) {
  if (!lair || !Array.isArray(lair.features)) return null;
  return lair.features.find((f) => HAZARD_FEATURE_KINDS.includes(f.kind)) || null;
}

// Shared decay step: under 10% and not magically stabilized, the
// score loses DECAY_HP_PER_ROUND per round. Used by both the marker
// tick (reported-only hazards) and the auto tick (applied hazards)
// so the two paths can never drift apart on decay.
async function applyDecay(lair) {
  if (lair.percent >= 10 || lair.magicallyStabilized) return 0;
  const decayed = Math.min(DECAY_HP_PER_ROUND, lair.hp);
  if (decayed <= 0) return 0;
  const hp = lair.hp - decayed;
  const patch = { env_hp: hp };
  if (hp === 0) patch.escape_pending = 1;
  await updateRow(lair.lairKey, patch);
  return decayed;
}

export async function tickRound(lairKey, { hazardRoll = null } = {}) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  if (lair.collapsed) return { success: true, decayed: 0, hazard: null, reason: 'collapsed — no further decay or hazards', ...lair };
  if (lair.escapePending) return { success: true, decayed: 0, hazard: null, reason: 'collapse pending — escape first', ...lair };
  const decayed = await applyDecay(lair);
  const after = await getLair(lairKey);
  if (after.escapePending) return { success: true, decayed, hazard: null, reason: 'decay reached 0 — collapse pending', ...after };
  const chance = bandForPercent(after.percent).hazardChance;
  if (chance <= 0) return { success: true, decayed, hazard: null, ...after };
  const rollTotal = hazardRoll != null ? Number(hazardRoll) : roll(100, 1, { reason: 'lair hazard' }).total;
  if (rollTotal > chance * 100) return { success: true, decayed, hazard: null, roll: rollTotal, ...after };
  const feature = hazardFeatureFor(after);
  if (!feature) return { success: true, decayed, hazard: null, roll: rollTotal, reason: 'hazard rolled but the room holds no hazard features — nothing invented', ...after };
  const dice = hazardDiceForBand(after.band);
  const hazard = {
    feature: feature.name,
    kind: feature.kind,
    type: feature.kind === 'flammable' ? 'fire' : 'bludgeoning',
    dice,
    damage: rollDiceString(dice),
    note: 'Hazard reported, not applied to party HP by this service — apply via HP_CHANGE / damage tables.',
  };
  return { success: true, decayed, hazard, roll: rollTotal, ...after };
}

// --- Hazard auto-roll (tick hook) -----------------------------------------
// tickRound above stays reported-only: it is the DM-called
// LAIR_HAZARD_ROLL path, kept deliberately consequence-free so the DM
// can test or foreshadow. tickRoundAuto is the separate auto path:
// hazards drawn on the durability tick during turn advance APPLY
// damage, symmetrically to party and enemies, with an avoidance roll
// for every combatant in the linked room.

async function resolveCombatants({ sessionId, encounterSeq, combatants }) {
  let entries = Array.isArray(combatants) ? combatants : null;
  if (!entries && sessionId && encounterSeq) {
    const row = await dbGet(
      'SELECT turn_order_json FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?',
      [sessionId, encounterSeq]
    ).catch(() => null);
    entries = safeParse(row?.turn_order_json, []);
    if (!Array.isArray(entries)) entries = [];
  }
  return Array.isArray(entries) ? entries : [];
}

async function resolveCombatant(entry, { sessionId, encounterSeq }) {
  const type = String(entry?.type || '').toLowerCase();
  const name = entry?.name || 'Combatant';
  const key = String(entry?.key || '');
  if (type === 'player') {
    const id = Number(key.split(':')[1]);
    if (!Number.isFinite(id)) return { name, type, skipped: true, reason: 'player turn-order entry has no character id' };
    const row = await dbGet('SELECT id, name, current_hp, max_hp, ability_scores, is_unconscious, is_dead FROM characters WHERE id = ?', [id]).catch(() => null);
    if (!row) return { name, type, skipped: true, reason: `no character row for ${name}` };
    const scores = parseAbilityScores(row.ability_scores);
    return { name: row.name || name, type, id: row.id, hp: row.current_hp, maxHp: row.max_hp, scores, isDown: row.is_dead === 1 || row.current_hp <= 0 };
  }
  if (type === 'companion') {
    let row = null;
    if (key.startsWith('companion:')) {
      const id = Number(key.split(':')[1]);
      if (Number.isFinite(id)) row = await dbGet('SELECT id, companion_current_hp, companion_max_hp, companion_ability_scores, status FROM companions WHERE id = ?', [id]).catch(() => null);
    } else if (key) {
      row = await dbGet(
        `SELECT c.id, c.companion_current_hp, c.companion_max_hp, c.companion_ability_scores, c.status
         FROM companions c JOIN npcs n ON c.npc_id = n.id WHERE n.world_id = ?`,
        [key]
      ).catch(() => null);
    }
    if (!row) return { name, type, skipped: true, reason: `no companion row for ${name}` };
    const scores = parseAbilityScores(row.companion_ability_scores);
    return { name, type, id: row.id, hp: row.companion_current_hp, maxHp: row.companion_max_hp, scores, isDown: row.status === 'dead' || (row.companion_current_hp ?? 0) <= 0 };
  }
  if (type === 'enemy') {
    if (!sessionId || !encounterSeq) return { name, type, skipped: true, reason: 'enemy damage needs an encounter context' };
    const row = await dbGet(
      'SELECT * FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND name = ? AND status = ?',
      [sessionId, encounterSeq, name, 'active']
    ).catch(() => null);
    if (!row) return { name, type, skipped: true, reason: `no active enemy row for ${name}` };
    return { name, type, id: row.id, hp: row.current_hp, maxHp: row.max_hp, enemyRow: row, isDown: false };
  }
  return { name, type, skipped: true, reason: `unknown turn-order type: ${type || '(none)'}` };
}

async function enemySaveMod(enemyRow, ability) {
  try {
    const { enemySaveModifier } = await import('./spellCastService.js');
    const mod = await enemySaveModifier(enemyRow, ability);
    if (Number.isFinite(mod)) return mod;
  } catch { /* fall through to the row's dex_mod */ }
  return Number(enemyRow?.dex_mod) || 0;
}

// Strike one hazard: every resolved combatant rolls to avoid; the
// caught take the hazard's damage through the existing HP paths
// (characters via applyHpChange, companions via their HP column,
// enemies via applyDamageToEnemy so typed resistances still apply).
// HP floors at 0 everywhere. Combatants already down are skipped —
// a hazard never double-dips death saves. `saveRolls` maps a
// combatant name to a forced natural d20 (tests); otherwise the
// central RNG rolls. `hazard.damage`, when set, is the damage
// (tests and pre-rolled entries); otherwise the dice are rolled once
// for the whole hazard, shared by every combatant caught.
export async function strikeHazard(lairKey, hazard, { sessionId = null, encounterSeq = null, combatants = null, saveRolls = null } = {}) {
  const dc = hazard?.dc ?? HAZARD_SAVE_DC[hazard?.severity] ?? null;
  const ability = hazard?.saveAbility || HAZARD_SAVE_ABILITY[hazard?.kind] || 'dex';
  const damage = hazard?.damage != null ? Math.max(0, Math.trunc(Number(hazard.damage))) : rollDiceString(hazard?.dice);
  const entries = await resolveCombatants({ sessionId, encounterSeq, combatants });
  const results = [];
  for (const entry of entries) {
    const c = await resolveCombatant(entry, { sessionId, encounterSeq });
    if (c.skipped) { results.push({ name: c.name, type: c.type, skipped: true, reason: c.reason }); continue; }
    if (c.isDown) { results.push({ name: c.name, type: c.type, skipped: true, reason: 'already down — hazard does not double-dip', hpBefore: c.hp, hpAfter: c.hp }); continue; }
    if (dc == null || damage === 0) {
      results.push({ name: c.name, type: c.type, avoided: true, saveRoll: null, saveTotal: null, dc, damageTaken: 0, hpBefore: c.hp, hpAfter: c.hp, note: 'benign — no damage' });
      continue;
    }
    const mod = c.enemyRow ? await enemySaveMod(c.enemyRow, ability) : abilityModifier(c.scores[ability] ?? c.scores[ability === 'str' ? 'strength' : ability === 'dex' ? 'dexterity' : ability]);
    const forced = saveRolls && Object.prototype.hasOwnProperty.call(saveRolls, c.name) ? Number(saveRolls[c.name]) : null;
    const saveRoll = forced != null && Number.isFinite(forced) ? forced : rollD20('lair hazard save');
    const saveTotal = saveRoll + mod;
    const avoided = saveTotal >= dc;
    let hpAfter = c.hp;
    let damageTaken = 0;
    if (!avoided) {
      damageTaken = damage;
      if (c.type === 'player') {
        try {
          const { applyHpChange } = await import('./characterHpService.js');
          await applyHpChange(c.id, -damage, 'lair hazard');
        } catch { /* best-effort: the recorded result still stands */ }
        const after = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [c.id]).catch(() => null);
        hpAfter = after ? after.current_hp : Math.max(0, c.hp - damage);
      } else if (c.type === 'companion') {
        await dbRun('UPDATE companions SET companion_current_hp = MAX(0, companion_current_hp - ?) WHERE id = ?', [damage, c.id]).catch(() => null);
        const after = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [c.id]).catch(() => null);
        hpAfter = after ? after.companion_current_hp : Math.max(0, c.hp - damage);
      } else if (c.type === 'enemy') {
        try {
          const { applyDamageToEnemy } = await import('./enemyCombatService.js');
          const r = await applyDamageToEnemy(sessionId, encounterSeq, c.name, damage, { damageType: hazard?.type || null, magical: false });
          hpAfter = r ? r.currentHp : Math.max(0, c.hp - damage);
          damageTaken = r ? r.damageDealt : damage;
        } catch {
          hpAfter = Math.max(0, c.hp - damage);
        }
      }
    }
    results.push({ name: c.name, type: c.type, avoided, saveRoll, saveTotal, saveModifier: mod, dc, damageTaken, hpBefore: c.hp, hpAfter });
  }
  return {
    hazard: { ...hazard, dc, saveAbility: ability, damage },
    damage,
    results,
    caught: results.filter((r) => !r.avoided && !r.skipped).length,
    avoidedCount: results.filter((r) => r.avoided && !r.skipped).length,
  };
}

// Lapse a pending telegraph without striking it. Used when the
// encounter ends (see lapseTelegraph) and internally when the lair
// collapses, is restored to full, or a different encounter ticks.
export async function lapseTelegraph(lairKey) {
  const state = await getHazardState(lairKey);
  if (!state.telegraph) return { success: true, lapsed: false };
  const telegraph = state.telegraph;
  await setHazardState(lairKey, { ...state, telegraph: null });
  return { success: true, lapsed: true, telegraph };
}

// The auto tick: decay (shared with the marker tick) plus, when the
// lair is damaged and not collapsed, exactly one hazard event.
//   - A pending telegraph for this same encounter strikes first and
//     is the round's hazard — no new hazard is drawn that tick, and
//     striking clears it, so it can never double-fire.
//   - A telegraph for a different encounter lapses; the tick then
//     draws fresh for this encounter.
//   - A fresh draw: benign becomes a precursor (no damage, warning
//     recorded); major/life-threatening becomes a telegraph for the
//     next tick; minor strikes immediately.
//   - A precursor escalates the next hazard from the same feature
//     kind by one severity tier, then is consumed.
//   - At full durability there is no hazard and any pending
//     telegraph/precursor lapses (the room was repaired).
// `hazardRoll` forces the hazard-chance roll (tests); `saveRolls`
// forces avoidance rolls by combatant name (tests).
export async function tickRoundAuto(lairKey, { sessionId = null, encounterSeq = null, combatants = null, hazardRoll = null, saveRolls = null } = {}) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  if (lair.collapsed) {
    await setHazardState(lairKey, {});
    return { success: true, decayed: 0, hazard: null, reason: 'collapsed — no further decay or hazards; pending telegraph lapsed', ...lair };
  }
  if (lair.escapePending) {
    await setHazardState(lairKey, {});
    return { success: true, decayed: 0, hazard: null, reason: 'collapse pending — escape first; pending telegraph lapsed', ...lair };
  }
  const decayed = await applyDecay(lair);
  const after = await getLair(lairKey);
  if (after.escapePending) {
    await setHazardState(lairKey, {});
    return { success: true, decayed, hazard: null, reason: 'decay reached 0 — collapse pending; pending telegraph lapsed', ...after };
  }
  if (after.percent >= 100) {
    const state = await getHazardState(lairKey);
    if (state.telegraph || state.precursor) {
      await setHazardState(lairKey, {});
      return { success: true, decayed, hazard: null, telegraphLapsed: state.telegraph || null, reason: 'lair at full durability — pending telegraph/precursor lapsed, no hazard', ...after };
    }
    return { success: true, decayed, hazard: null, ...after };
  }
  let state = await getHazardState(lairKey);
  if (state.telegraph) {
    const tele = state.telegraph;
    if (tele.sessionId === sessionId && tele.encounterSeq === encounterSeq) {
      await setHazardState(lairKey, { ...state, telegraph: null });
      const struck = await strikeHazard(lairKey, tele, { sessionId, encounterSeq, combatants, saveRolls });
      return { success: true, decayed, hazard: struck.hazard, struck, telegraphed: tele, ...after };
    }
    await setHazardState(lairKey, { ...state, telegraph: null });
    state = await getHazardState(lairKey);
  }
  const chance = bandForPercent(after.percent).hazardChance;
  if (chance <= 0) return { success: true, decayed, hazard: null, ...after };
  const rollTotal = hazardRoll != null ? Number(hazardRoll) : roll(100, 1, { reason: 'lair hazard' }).total;
  if (rollTotal > chance * 100) return { success: true, decayed, hazard: null, roll: rollTotal, ...after };
  const feature = hazardFeatureFor(after);
  if (!feature) return { success: true, decayed, hazard: null, roll: rollTotal, reason: 'hazard rolled but the room holds no hazard features — nothing invented', ...after };
  let severity = severityForBand(after.band);
  let precursorConsumed = false;
  if (state.precursor && state.precursor.kind === feature.kind) {
    severity = escalateSeverity(severity);
    precursorConsumed = true;
  }
  const dice = hazardDiceForBand(after.band);
  const hazard = {
    feature: feature.name,
    kind: feature.kind,
    type: feature.kind === 'flammable' ? 'fire' : 'bludgeoning',
    severity,
    dice,
    saveAbility: HAZARD_SAVE_ABILITY[feature.kind] || 'dex',
    dc: HAZARD_SAVE_DC[severity],
  };
  if (severity === 'benign') {
    await setHazardState(lairKey, { ...state, telegraph: null, precursor: { kind: feature.kind, feature: feature.name } });
    return { success: true, decayed, hazard: { ...hazard, damage: 0, precursor: true, note: 'Benign precursor — pebbles fall; a major event from this feature family may follow.' }, roll: rollTotal, ...after };
  }
  if (severity === 'major' || severity === 'life-threatening') {
    const telegraph = { ...hazard, sessionId, encounterSeq };
    await setHazardState(lairKey, { ...state, telegraph, precursor: precursorConsumed ? null : state.precursor });
    return { success: true, decayed, hazard: null, telegraphed: telegraph, roll: rollTotal, note: 'Major hazard telegraphed — strikes on the next tick for this encounter.', ...after };
  }
  const struck = await strikeHazard(lairKey, hazard, { sessionId, encounterSeq, combatants, saveRolls });
  if (precursorConsumed) await setHazardState(lairKey, { ...state, telegraph: null, precursor: null });
  return { success: true, decayed, hazard: struck.hazard, struck, roll: rollTotal, ...after };
}

// Encounter hook for turn advance: resolve the encounter's linked
// room, find the lair durability record for that room, and run the
// auto tick. Every failure mode surfaces as a skipped result and
// rolls nothing — a missing link is never papered over with an
// invented room, feature, or lair. A marker-created lair with no
// scene linkage does not match (its scene_id is null); link it at
// creation with LAIR_CREATE Scene=/Room=, or create it with
// sceneId/sceneRoomId, for the auto tick to find it.
export async function runEncounterLairTick(sessionId, encounterSeq, opts = {}) {
  if (!sessionId || !encounterSeq) return { success: false, skipped: 'no-encounter', reason: 'runEncounterLairTick needs sessionId and encounterSeq' };
  let linked = null;
  try {
    const { getEncounterRoom } = await import('./dungeonSceneStorageService.js');
    linked = await getEncounterRoom(sessionId, encounterSeq);
  } catch { linked = null; }
  if (!linked) return { success: false, skipped: 'no-linked-room', reason: 'No room is linked to this encounter — no hazard rolled, nothing invented.' };
  const roomRow = await dbGet('SELECT id FROM scene_rooms WHERE scene_id = ? AND room_key = ?', [linked.sceneId, linked.roomKey]).catch(() => null);
  const lairs = await dbAll('SELECT * FROM lair_durability WHERE scene_id = ?', [linked.sceneId]).catch(() => []);
  const lair = (lairs || []).find((r) => (roomRow ? (r.scene_room_id == null || r.scene_room_id === roomRow.id) : r.scene_room_id == null)) || null;
  if (!lair) return { success: false, skipped: 'no-lair-for-room', reason: `No lair durability record is linked to scene ${linked.sceneId} room ${linked.roomKey} — no hazard rolled.`, sceneId: linked.sceneId, roomKey: linked.roomKey };
  const tick = await tickRoundAuto(lair.lair_key, { sessionId, encounterSeq, ...opts });
  return { success: true, lairKey: lair.lair_key, sceneId: linked.sceneId, roomKey: linked.roomKey, ...tick };
}

export async function stabilizeMagic(lairKey) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  if (lair.collapsed) return { success: false, reason: `${lairKey} is collapsed — magic alone cannot reopen it`, remedy: 'Mechanically stabilize / excavate it back first.' };
  await updateRow(lairKey, { magically_stabilized: 1 });
  const after = await getLair(lairKey);
  return { success: true, method: 'magic', note: 'Decay halted. No HP restored.', ...after };
}

export async function clearMagicalHold(lairKey) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  await updateRow(lairKey, { magically_stabilized: 0 });
  return { success: true, ...(await getLair(lairKey)) };
}

export async function stabilizeMechanical(lairKey, { amount = MECHANICAL_RESTORE_HP } = {}) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  const amt = Math.trunc(Number(amount));
  if (!Number.isFinite(amt) || amt <= 0) return { success: false, reason: 'Amount must be a positive number' };
  const hp = Math.min(lair.maxHp, lair.hp + amt);
  const patch = { env_hp: hp };
  if (hp > 0) { patch.collapsed = 0; patch.escape_pending = 0; patch.buried = 0; }
  await updateRow(lairKey, patch);
  const after = await getLair(lairKey);
  return { success: true, method: 'mechanical', restored: amt, ...after };
}

export async function resolveCollapseEscape(lairKey, { escaped } = {}) {
  const lair = await getLair(lairKey);
  if (!lair) return { success: false, reason: `unknown lair: ${lairKey}` };
  if (!lair.escapePending) return { success: false, reason: `${lairKey} has no collapse pending`, remedy: 'Only a room at 0 HP can have its collapse escape resolved.' };
  if (typeof escaped !== 'boolean') return { success: false, reason: 'resolveCollapseEscape needs escaped true/false (the reported escape outcome)' };
  await updateRow(lairKey, { collapsed: 1, escape_pending: 0, buried: escaped ? 0 : 1 });
  const after = await getLair(lairKey);
  return { success: true, escaped, buried: !escaped, note: escaped ? 'Party escaped; the room seals behind them.' : 'Escape failed; buried recorded — consequences are DM-side, no party HP was changed by this service.', ...after };
}

// --- Marker handlers -------------------------------------------------------
function parseNameKindList(raw) {
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const [name, kind] = pair.split(':').map((x) => x.trim());
    return { name: name || 'Feature', kind: kind || null };
  });
}

registerMarkerHandler('LAIR_CREATE', async (parsed) => {
  try {
    // Optional scene linkage (2026-11-04): Scene= is a scene id and
    // Room= a room key, same convention as SET_ROOM. Linked lairs
    // are found by the turn-advance auto tick; an unlinked lair
    // still works for the DM-called marker paths. A Scene that
    // names no such room fails creation rather than silently
    // creating an unlinked lair the DM expected to auto-roll.
    let sceneId = null;
    let sceneRoomId = null;
    if (parsed?.Scene != null && String(parsed.Scene).trim() !== '') {
      sceneId = Number(parsed.Scene);
      if (!Number.isFinite(sceneId)) {
        return { type: 'lair_create', success: false, reason: 'LAIR_CREATE Scene= must be a scene id number' };
      }
      const roomRaw = parsed?.Room ? String(parsed.Room).trim() : '';
      if (roomRaw) {
        const room = await dbGet('SELECT id FROM scene_rooms WHERE scene_id = ? AND room_key = ?', [sceneId, roomRaw]).catch(() => null);
        if (!room) {
          return { type: 'lair_create', success: false, reason: `no room ${roomRaw} in scene ${sceneId}`, remedy: 'Link the room first with SET_ROOM, or omit Scene=/Room= for an unlinked lair.' };
        }
        sceneRoomId = room.id;
      }
    } else if (parsed?.Room != null && String(parsed.Room).trim() !== '') {
      return { type: 'lair_create', success: false, reason: 'LAIR_CREATE Room= also needs Scene=' };
    }
    const r = await createLair({
      lairKey: parsed?.Lair,
      name: parsed?.Name || parsed?.Lair || '',
      sceneId,
      sceneRoomId,
      maxHp: parsed?.MaxHp != null ? Number(parsed.MaxHp) : DEFAULT_MAX_HP,
      features: parseNameKindList(parsed?.Features),
      exits: parsed?.Exits ? String(parsed.Exits).split(',').map((s) => s.trim()).filter(Boolean) : [],
    });
    return r.success ? { type: 'lair_create', success: true, lairKey: r.lairKey, hp: r.hp, maxHp: r.maxHp, percent: r.percent, band: r.band }
      : { type: 'lair_create', success: false, reason: r.reason, remedy: r.remedy };
  } catch (e) { console.error('[lairDurabilityService] LAIR_CREATE failed:', e.message); return null; }
});

registerMarkerHandler('LAIR_DAMAGE', async (parsed) => {
  try {
    const r = await applyEnvironmentalDamage(parsed?.Lair, parsed?.Amount, { source: parsed?.Source || null });
    return r.success ? { type: 'lair_damage', success: true, lairKey: r.lairKey, damage: r.damage, source: r.source, hp: r.hp, maxHp: r.maxHp, percent: r.percent, band: r.band, escapePending: r.escapePending }
      : { type: 'lair_damage', success: false, reason: r.reason, remedy: r.remedy };
  } catch (e) { console.error('[lairDurabilityService] LAIR_DAMAGE failed:', e.message); return null; }
});

registerMarkerHandler('LAIR_STABILIZE', async (parsed) => {
  try {
    const method = String(parsed?.Method || '').toLowerCase();
    if (method === 'magic') {
      const r = await stabilizeMagic(parsed?.Lair);
      return r.success ? { type: 'lair_stabilize', success: true, method: 'magic', hp: r.hp, percent: r.percent, band: r.band }
        : { type: 'lair_stabilize', success: false, reason: r.reason, remedy: r.remedy };
    }
    if (method === 'mechanical') {
      const r = await stabilizeMechanical(parsed?.Lair, { amount: parsed?.Amount != null ? Number(parsed.Amount) : MECHANICAL_RESTORE_HP });
      return r.success ? { type: 'lair_stabilize', success: true, method: 'mechanical', restored: r.restored, hp: r.hp, percent: r.percent, band: r.band, collapsed: r.collapsed }
        : { type: 'lair_stabilize', success: false, reason: r.reason, remedy: r.remedy };
    }
    return { type: 'lair_stabilize', success: false, reason: 'LAIR_STABILIZE needs Method="magic" or Method="mechanical"' };
  } catch (e) { console.error('[lairDurabilityService] LAIR_STABILIZE failed:', e.message); return null; }
});

registerMarkerHandler('LAIR_HAZARD_ROLL', async (parsed) => {
  try {
    const r = await tickRound(parsed?.Lair);
    return r.success ? { type: 'lair_hazard_roll', success: true, decayed: r.decayed, hazard: r.hazard, hp: r.hp, percent: r.percent, band: r.band }
      : { type: 'lair_hazard_roll', success: false, reason: r.reason };
  } catch (e) { console.error('[lairDurabilityService] LAIR_HAZARD_ROLL failed:', e.message); return null; }
});

export default {
  createLair, getLair, applyEnvironmentalDamage, tickRound,
  tickRoundAuto, strikeHazard, lapseTelegraph, runEncounterLairTick,
  stabilizeMagic, clearMagicalHold, stabilizeMechanical, resolveCollapseEscape,
  durabilityPercent, bandForPercent, severityForBand, escalateSeverity, stabilityDisplay, hazardFeatureFor,
  DEFAULT_MAX_HP, DECAY_HP_PER_ROUND, MECHANICAL_RESTORE_HP, HAZARD_FEATURE_KINDS, BANDS,
  SEVERITY_ORDER, HAZARD_SAVE_DC, HAZARD_SAVE_ABILITY,
};
