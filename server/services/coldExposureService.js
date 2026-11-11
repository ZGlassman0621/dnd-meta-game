/**
 * Cold Exposure Service — Frost Exhaustion / Cold Level (v1, 2026-10-28).
 *
 * Approved numbers (Zach, Oct 28 tap — "build cold tonight with the
 * Oct 26 numbers"): Frost Exhaustion is a SEPARATE track from standard
 * 2024 exhaustion, which runs in parallel untouched. Wet: +0 Cold Level,
 * disadvantage on the exposure save, and it strips the -2 Cold-Weather
 * Clothing modifier entirely. Soaked: +2 Cold Level. Regional base Cold
 * Level is set per scene by the system/DM, default 0 outside cold regions.
 *
 * Adopted system (cold-survival-design.md, Oct 22):
 *   - Every exposed creature has an effective Cold Level; below 0 means
 *     not exposed and all cold effects are negated.
 *   - Exposure check each hour exposed: CON save at DC 10 + Cold Level.
 *     Failure: +1 Frost Exhaustion.
 *   - Frost Exhaustion: -1 to ALL ability SCORES per level (not just
 *     modifiers). If any ability score reaches 0, the creature dies.
 *     The erosion flows through the same sheet math combat uses:
 *     erodeScores() is called by combatStatsService.calculateCombatStats
 *     / spellProfileFor, rollRequestService.computePcModifier, and
 *     partyAttackService.buildAttackProfile — there is no second truth.
 *     Unknown scores default to 10 (the abilityScore fallback everywhere
 *     else in the codebase), so a score-less npc_stats companion dies
 *     when frost reaches 10.
 *   - Recovery: resting while NOT exposed removes 1 level per hour.
 *     "Not exposed" here means suspended in a town / warm structure
 *     (building/cave shelter) — a tent reduces Cold Level but does not
 *     suspend, so tent-resting does not recover frost.
 *   - Modifiers per creature: Cold-Weather Clothing -2; campfire -2;
 *     insulated tent -2; resting while exposed +2 (proper shelter —
 *     building/cave, or an insulated tent — negates this); blizzard +2
 *     (magical blizzard +4, superseding the plain +2, not stacking);
 *     elevation adds (passed in by the scene); cold resistance grants
 *     advantage on exposure saves; goliath Mountain Born = immune
 *     (a scene may instead impose Cold Level 0, DM's call); towns and
 *     warm structures suspend the system entirely.
 *   - Wet/Soaked application is depth-aware in the fiction (ankle-deep
 *     wading is Wet, Soaked requires immersion or full drenching) — the
 *     DM decides which status to set; this service only applies the
 *     numbers. Wet strips clothing (approved). Soaked also strips it:
 *     a drenched garment gives no protection, and the approved Soaked
 *     scenario (base 2 -> DC 14, needs 11+) holds only if clothing does
 *     not apply when soaked. That extension is flagged in the handover.
 *   - NPCs/companions are exposed on the same rules. Enemies are NOT
 *     in scope for v1: combat_enemies are encounter-scoped, not party
 *     members, and have no persistent frost column.
 *
 * Who rolls: exposure saves during TIME_ADVANCE / REST are system-rolled
 * for the whole party (like companion rolls in rollRequestService) and
 * surfaced in the time/rest event for the DM to narrate. The PC does
 * not hand-roll per-hour exposure saves while time passes. This is a
 * build call, not an approved number — flagged for veto in the handover.
 *
 * Scene context: the DM/system sets the scene with [COLD_SCENE] (or
 * setColdScene()), stored on dm_sessions.session_config. Until a scene
 * is set, TIME_ADVANCE does nothing cold-related — the system never
 * invents a Cold Level from temperature or region alone, because no
 * approved temperature/region -> Cold Level mapping exists.
 *
 * Flag: FF_COLD_EXPOSURE (own switch, default ON per the Oct 28 build
 * approval; FF_COLD_EXPOSURE=false disables). Checked by callers
 * (restTimeService) at call time, not here, so direct service calls in
 * tests are unaffected.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { rollD20 } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { mergeAdvantageState, findCompanionIdByName } from './conditionService.js';
import { hasShelter } from './weatherService.js';

// ---------------------------------------------------------------------------
// Pure math — no database, fully testable without a DB
// ---------------------------------------------------------------------------

const SHORT_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const FULL_KEYS = {
  str: 'strength', dex: 'dexterity', con: 'constitution',
  int: 'intelligence', wis: 'wisdom', cha: 'charisma'
};

function scoreOf(scores, key) {
  const v = Number(scores?.[key] ?? scores?.[FULL_KEYS[key]]);
  return Number.isFinite(v) ? v : 10;
}

/**
 * Erode every ability score by the frost level. Missing scores default
 * to 10 (the codebase-wide abilityScore fallback). Returns short keys
 * only, which is what combatStatsService and rollRequestService read.
 * Values are NOT floored at 0 — the death check needs to see <= 0.
 */
export function erodeScores(scores, frostLevel) {
  const f = Math.max(0, Math.trunc(Number(frostLevel) || 0));
  const out = {};
  for (const k of SHORT_KEYS) out[k] = scoreOf(scores || {}, k) - f;
  return out;
}

/** True when any eroded score has reached 0 (death, per the design). */
export function isFrostDead(erodedScores) {
  return SHORT_KEYS.some(k => (Number(erodedScores?.[k]) || 0) <= 0);
}

/** CON modifier from eroded scores (the spiral: frost lowers the next save). */
export function erodedConModifier(scores, frostLevel) {
  const eroded = erodeScores(scores, frostLevel);
  return Math.floor((eroded.con - 10) / 2);
}

/**
 * Effective Cold Level for one creature in one scene.
 * Input: { base, hasClothing, wetStatus ('dry'|'wet'|'soaked'),
 *   campfire, insulatedTent, resting, properShelter, blizzard,
 *   magicalBlizzard, elevation }.
 * Below 0 means not exposed (caller treats it as a skip).
 */
export function computeEffectiveColdLevel(input = {}) {
  const wet = String(input.wetStatus || 'dry').toLowerCase();
  let level = Math.trunc(Number(input.base) || 0);
  if (wet === 'soaked') level += 2;
  // Clothing -2 applies only while dry: Wet strips it (approved), and
  // Soaked — a full drenching — strips it too (see header note).
  if (input.hasClothing && wet === 'dry') level -= 2;
  if (input.campfire) level -= 2;
  if (input.insulatedTent) level -= 2;
  if (input.resting && !input.properShelter) level += 2;
  if (input.magicalBlizzard) level += 4;
  else if (input.blizzard) level += 2;
  level += Math.trunc(Number(input.elevation) || 0);
  return level;
}

/** Exposure save DC for a Cold Level. */
export function exposureDc(coldLevel) {
  return 10 + (Math.trunc(Number(coldLevel) || 0));
}

/**
 * Advantage state for an exposure save: Wet imposes disadvantage,
 * cold resistance grants advantage; opposite states cancel (the same
 * algebra as conditionService.mergeAdvantageState).
 */
export function exposureAdvantage({ wetStatus = 'dry', coldResistant = false } = {}) {
  let state = null;
  if (String(wetStatus).toLowerCase() === 'wet' || String(wetStatus).toLowerCase() === 'soaked') {
    state = mergeAdvantageState(state, 'disadvantage');
  }
  if (coldResistant) state = mergeAdvantageState(state, 'advantage');
  return state;
}

/**
 * Judge exposure dice. Crits judge the TAKEN die, mirroring
 * rollRequestService.resolveDice: nat 1 never succeeds, nat 20 always
 * succeeds, regardless of modifier or DC.
 */
export function resolveExposureDice({ dice, modifier, dc, advantage = null }) {
  const list = Array.isArray(dice) ? dice : [dice];
  const taken = advantage === 'advantage'
    ? Math.max(...list)
    : advantage === 'disadvantage'
      ? Math.min(...list)
      : list[0];
  const total = taken + (Number(modifier) || 0);
  let outcome;
  if (taken === 1) outcome = 'critical_failure';
  else if (taken === 20) outcome = 'critical_success';
  else outcome = total >= dc ? 'success' : 'failure';
  return { takenDie: taken, total, outcome };
}

// ---------------------------------------------------------------------------
// Persistent state — characters.frost_exhaustion / cold_wet_status and
// the companions mirror (migration 087). Frost is NOT a condition key:
// standard exhaustion lives in active_conditions and is untouched.
// ---------------------------------------------------------------------------

const TABLE_BY_KIND = { player: 'characters', companion: 'companions' };
const WET_STATUSES = new Set(['dry', 'wet', 'soaked']);

function tableFor(kind) {
  const t = TABLE_BY_KIND[kind];
  if (!t) throw new Error(`coldExposureService: unknown actor kind "${kind}"`);
  return t;
}

export async function getFrostState(kind, id) {
  if (!id) return { frost: 0, wetStatus: 'dry' };
  const row = await dbGet(
    `SELECT frost_exhaustion, cold_wet_status FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  if (!row) return { frost: 0, wetStatus: 'dry' };
  const wet = String(row.cold_wet_status || 'dry').toLowerCase();
  return {
    frost: Math.max(0, Math.trunc(Number(row.frost_exhaustion) || 0)),
    wetStatus: WET_STATUSES.has(wet) ? wet : 'dry'
  };
}

export async function getFrostLevel(kind, id) {
  return (await getFrostState(kind, id)).frost;
}

export async function setWetStatus(kind, id, status) {
  const wet = String(status || '').toLowerCase();
  if (!WET_STATUSES.has(wet)) return { success: false, reason: `unknown wet status: ${status}` };
  await dbRun(`UPDATE ${tableFor(kind)} SET cold_wet_status = ? WHERE id = ?`, [wet, id]);
  return { success: true, wetStatus: wet };
}

async function applyFrostDeath(kind, id) {
  if (kind === 'player') {
    await dbRun('UPDATE characters SET current_hp = 0, is_unconscious = 1, is_dead = 1 WHERE id = ?', [id]);
  } else if (kind === 'companion') {
    await dbRun('UPDATE companions SET companion_current_hp = 0, status = ? WHERE id = ?', ['dead', id]);
  }
}

/**
 * Add frost levels. Pass erodedScores AFTER the increment when the
 * caller knows the actor's scores, and death is applied when any score
 * reaches 0 (mirroring conditionService's exhaustion_6 death writes).
 */
export async function addFrostLevel(kind, id, delta, erodedScores = null) {
  const before = await getFrostLevel(kind, id);
  const level = Math.max(0, before + (Math.trunc(Number(delta) || 0)));
  await dbRun(`UPDATE ${tableFor(kind)} SET frost_exhaustion = ? WHERE id = ?`, [level, id]);
  let died = false;
  if (erodedScores && isFrostDead(erodedScores)) {
    await applyFrostDeath(kind, id);
    died = true;
  }
  return { level, before, died };
}

/**
 * Recover frost by resting while NOT exposed: 1 level per hour, floored
 * at 0. When notExposed is false the level does not move at all — a
 * cold rest neither recovers nor (here) adds frost; exposure during a
 * cold rest runs through processExposure, not this function.
 */
export async function recoverFrost(kind, id, hours, notExposed) {
  const before = await getFrostLevel(kind, id);
  if (!notExposed || !hours || hours <= 0) return { changed: false, level: before };
  const level = Math.max(0, before - Math.trunc(hours));
  if (level === before) return { changed: false, level };
  await dbRun(`UPDATE ${tableFor(kind)} SET frost_exhaustion = ? WHERE id = ?`, [level, id]);
  return { changed: true, level, before };
}

// ---------------------------------------------------------------------------
// Actor loading for exposure (PC + active companions, the party)
// ---------------------------------------------------------------------------

const COLD_CLOTHING_PATTERNS = [
  'cold weather gear', 'cold-weather gear', 'winter cloak',
  'fur cloak', 'boots of winterlands', 'fur-lined armor'
];

function collectItemNames(...jsons) {
  const names = [];
  for (const j of jsons) {
    if (!j) continue;
    const parsed = typeof j === 'string' ? safeParse(j, null) : j;
    if (typeof parsed === 'string') { names.push(parsed); continue; }
    if (Array.isArray(parsed)) {
      for (const it of parsed) {
        if (typeof it === 'string') names.push(it);
        else if (it?.name) names.push(String(it.name));
      }
      continue;
    }
    if (parsed && typeof parsed === 'object') {
      for (const v of Object.values(parsed)) {
        if (typeof v === 'string') names.push(v);
        else if (v?.name) names.push(String(v.name));
      }
    }
  }
  return names;
}

function hasColdWeatherClothing(...jsons) {
  return collectItemNames(...jsons).some(n =>
    COLD_CLOTHING_PATTERNS.some(p => String(n).toLowerCase().includes(p)));
}

/** Best-effort cold-resistance read from an advantages field of unknown
 *  shape (array, JSON string, or plain string). Never throws. */
export function hasColdResistance(advantages) {
  try {
    let text = '';
    if (Array.isArray(advantages)) text = advantages.join(' ');
    else if (typeof advantages === 'string') {
      const parsed = safeParse(advantages, null);
      text = Array.isArray(parsed) ? parsed.join(' ') : advantages;
    } else if (advantages && typeof advantages === 'object') {
      text = Object.values(advantages).join(' ');
    }
    const lower = String(text).toLowerCase();
    return lower.includes('cold') && lower.includes('resist');
  } catch { return false; }
}

function mergeScoreObjects(...objs) {
  const out = {};
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue;
    for (const k of SHORT_KEYS) {
      if (o[k] != null) out[k] = o[k];
      else if (o[FULL_KEYS[k]] != null) out[k] = o[FULL_KEYS[k]];
    }
  }
  return out;
}

function companionScores(comp) {
  if (comp.progression_type === 'class_based') {
    return safeParse(comp.companion_ability_scores, {}) || {};
  }
  const snap = safeParse(comp.original_stats_snapshot, {}) || {};
  const snapScores = snap.ability_scores || snap.stats || null;
  return mergeScoreObjects(
    safeParse(comp.npc_ability_scores, {}) || {},
    snapScores,
    snap
  );
}

async function loadPartyActors(characterId) {
  const pc = await dbGet(
    `SELECT id, name, race, class, level, current_hp, current_location,
            ability_scores, inventory, equipment, advantages,
            frost_exhaustion, cold_wet_status
     FROM characters WHERE id = ?`, [characterId]);
  if (!pc) return null;
  const companions = await dbAll(
    `SELECT c.*, n.name AS name, n.race AS npc_race,
            n.ability_scores AS npc_ability_scores
     FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
    [characterId]);
  const pcActor = {
    kind: 'player', id: pc.id, name: pc.name || 'Player', race: pc.race,
    scores: safeParse(pc.ability_scores, {}) || {},
    inventory: pc.inventory, equipment: pc.equipment,
    advantages: pc.advantages, currentHp: pc.current_hp ?? 0,
    frost: Math.max(0, Math.trunc(Number(pc.frost_exhaustion) || 0)),
    wetStatus: String(pc.cold_wet_status || 'dry').toLowerCase(),
    location: pc.current_location
  };
  const compActors = (companions || []).map(c => ({
    kind: 'companion', id: c.id, name: c.name || 'Companion',
    race: c.npc_race, scores: companionScores(c),
    inventory: c.inventory ?? null, equipment: c.equipment ?? null,
    advantages: c.advantages ?? null,
    currentHp: c.companion_current_hp ?? 0,
    frost: Math.max(0, Math.trunc(Number(c.frost_exhaustion) || 0)),
    wetStatus: String(c.cold_wet_status || 'dry').toLowerCase(),
    location: pc.current_location
  }));
  return { pc: pcActor, actors: [pcActor, ...compActors], pcShelter: hasShelter(pc.current_location, pc.inventory) };
}

// ---------------------------------------------------------------------------
// Exposure processing — the TIME_ADVANCE / REST hook
// ---------------------------------------------------------------------------

export function normalizeColdScene(input = {}) {
  return {
    baseColdLevel: Math.trunc(Number(input.baseColdLevel ?? input.BaseLevel ?? 0) || 0),
    campfire: !!input.campfire,
    insulatedTent: !!(input.insulatedTent ?? input.tent),
    blizzard: !!input.blizzard,
    magicalBlizzard: !!input.magicalBlizzard,
    elevation: Math.trunc(Number(input.elevation) || 0),
    forceGoliathColdLevel0: !!input.forceGoliathColdLevel0
  };
}

/**
 * Run exposure for a party over a number of hours. Scene is explicit —
 * callers never get a Cold Level invented from temperature or region.
 * diceForHour (tests only): ({ kind, id, name, hour }) => [d20, ...].
 * Returns per-actor results; failures persist frost immediately, so the
 * next hour's CON modifier already reflects the spiral.
 */
export async function processExposure({ characterId, hours, scene, resting = false, diceForHour = null, actorFilter = null }) {
  const h = Math.trunc(Number(hours) || 0);
  if (!characterId || h <= 0 || !scene) {
    return { processed: false, reason: !scene ? 'no cold scene set' : 'no hours or character' };
  }
  const party = await loadPartyActors(characterId);
  if (!party) return { processed: false, reason: 'character not found' };
  const sceneNorm = normalizeColdScene(scene);
  const suspended = party.pcShelter === 'building' || party.pcShelter === 'cave';
  const results = [];
  for (const actor of party.actors) {
    const base = { name: actor.name, kind: actor.kind, frostBefore: actor.frost };
    if ((actor.currentHp ?? 0) <= 0) {
      results.push({ ...base, skipped: 'down', frostAfter: actor.frost });
      continue;
    }
    // Scoped rests: only the rested actors are exposed while resting.
    if (actorFilter && !actorFilter.has(`${actor.kind}:${actor.id}`)) {
      results.push({ ...base, skipped: 'not_resting', frostAfter: actor.frost });
      continue;
    }
    if (suspended) {
      results.push({ ...base, skipped: 'suspended', frostAfter: actor.frost });
      continue;
    }
    const mountainBorn = String(actor.race || '').toLowerCase() === 'goliath';
    if (mountainBorn && !sceneNorm.forceGoliathColdLevel0) {
      results.push({ ...base, skipped: 'mountain_born_immune', frostAfter: actor.frost });
      continue;
    }
    const baseLevel = mountainBorn ? 0 : sceneNorm.baseColdLevel;
    const coldLevel = computeEffectiveColdLevel({
      base: baseLevel,
      hasClothing: hasColdWeatherClothing(actor.inventory, actor.equipment),
      wetStatus: actor.wetStatus,
      campfire: sceneNorm.campfire,
      insulatedTent: sceneNorm.insulatedTent,
      resting,
      properShelter: sceneNorm.insulatedTent,
      blizzard: sceneNorm.blizzard,
      magicalBlizzard: sceneNorm.magicalBlizzard,
      elevation: sceneNorm.elevation
    });
    if (coldLevel < 0) {
      results.push({ ...base, skipped: 'not_exposed', coldLevel, frostAfter: actor.frost });
      continue;
    }
    const dc = exposureDc(coldLevel);
    const advantage = exposureAdvantage({
      wetStatus: actor.wetStatus,
      coldResistant: hasColdResistance(actor.advantages)
    });
    let frost = actor.frost;
    let died = false;
    const hourResults = [];
    for (let hour = 0; hour < h; hour++) {
      const conMod = erodedConModifier(actor.scores, frost);
      let dice;
      if (diceForHour) {
        const d = diceForHour({ kind: actor.kind, id: actor.id, name: actor.name, hour });
        dice = Array.isArray(d) ? d : [d];
      } else {
        dice = advantage ? [rollD20('cold-exposure'), rollD20('cold-exposure')] : [rollD20('cold-exposure')];
      }
      const res = resolveExposureDice({ dice, modifier: conMod, dc, advantage });
      let frostAfter = frost;
      if (res.outcome === 'failure' || res.outcome === 'critical_failure') {
        const after = await addFrostLevel(actor.kind, actor.id, 1, erodeScores(actor.scores, frost + 1));
        frost = after.level;
        frostAfter = frost;
        died = after.died;
      }
      hourResults.push({ hour: hour + 1, dice, conMod, ...res, frostAfter });
      if (died) break;
    }
    results.push({ ...base, coldLevel, dc, advantage, hours: hourResults, frostAfter: frost, died });
  }
  return { processed: true, resting, actors: results };
}

// ---------------------------------------------------------------------------
// Scene storage on dm_sessions.session_config (the pendingRoll pattern)
// ---------------------------------------------------------------------------

async function readSessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {});
}

async function writeSessionConfig(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?',
    [JSON.stringify(cfg), sessionId]);
}

export async function setColdScene(sessionId, sceneInput) {
  if (!sessionId) return null;
  const scene = normalizeColdScene(sceneInput);
  const cfg = await readSessionConfig(sessionId);
  cfg.coldScene = scene;
  await writeSessionConfig(sessionId, cfg);
  return scene;
}

export async function clearColdScene(sessionId) {
  if (!sessionId) return false;
  const cfg = await readSessionConfig(sessionId);
  delete cfg.coldScene;
  await writeSessionConfig(sessionId, cfg);
  return true;
}

export async function getColdScene(sessionId) {
  if (!sessionId) return null;
  const cfg = await readSessionConfig(sessionId);
  return cfg.coldScene || null;
}

export async function processExposureForSession({ sessionId, characterId, hours, resting = false, diceForHour = null }) {
  if (!sessionId) return { processed: false, reason: 'no session' };
  const scene = await getColdScene(sessionId);
  if (!scene) return { processed: false, reason: 'no cold scene set' };
  return processExposure({ characterId, hours, scene, resting, diceForHour });
}

/** One-line-per-actor summary for time/rest events (DM narration fuel). */
export function formatColdBlock(cold) {
  if (!cold?.processed || !Array.isArray(cold.actors)) return '';
  const lines = [];
  for (const a of cold.actors) {
    if (a.skipped === 'suspended') { lines.push(`${a.name}: sheltered — no cold exposure.`); continue; }
    if (a.skipped === 'mountain_born_immune') { lines.push(`${a.name}: Mountain Born — immune to the cold.`); continue; }
    if (a.skipped === 'not_exposed') { lines.push(`${a.name}: Cold Level ${a.coldLevel} — not exposed.`); continue; }
    if (a.skipped === 'down') { lines.push(`${a.name}: down — no cold exposure.`); continue; }
    if (a.skipped === 'not_resting') { lines.push(`${a.name}: not resting — no cold exposure.`); continue; }
    const fails = (a.hours || []).filter(x => x.outcome === 'failure' || x.outcome === 'critical_failure').length;
    let s = `${a.name}: Cold Level ${a.coldLevel}, DC ${a.dc} — ${fails} failed hour(s), frost ${a.frostBefore} → ${a.frostAfter}.`;
    if (a.died) s += ' DIED of frost (an ability score reached 0).';
    lines.push(s);
  }
  return lines.length ? `\nCOLD EXPOSURE:\n${lines.map(l => `  ${l}`).join('\n')}` : '';
}

// ---------------------------------------------------------------------------
// Marker handlers (schema entries live in markerSchemas.js)
// ---------------------------------------------------------------------------

export async function handleColdSceneMarker(parsed, context) {
  if (!context?.sessionId) return null;
  const scene = await setColdScene(context.sessionId, {
    baseColdLevel: parsed?.BaseLevel,
    campfire: parsed?.Campfire,
    insulatedTent: parsed?.InsulatedTent,
    blizzard: parsed?.Blizzard,
    magicalBlizzard: parsed?.MagicalBlizzard,
    elevation: parsed?.Elevation,
    forceGoliathColdLevel0: parsed?.ForceGoliath
  });
  return { type: 'cold_scene', success: true, scene };
}

export async function handleColdWetMarker(parsed, context) {
  if (!context?.characterId) return null;
  const targetRaw = String(parsed?.Target || '').trim();
  if (!targetRaw) return { type: 'cold_wet', success: false, reason: 'COLD_WET needs a Target' };
  const character = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
  const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
    (character && targetRaw.toLowerCase() === character.name.toLowerCase());
  let kind = null;
  let id = null;
  if (isPc) { kind = 'player'; id = context.characterId; }
  else {
    const compId = await findCompanionIdByName(context.characterId, targetRaw);
    if (compId) { kind = 'companion'; id = compId; }
  }
  if (!kind) return { type: 'cold_wet', success: false, reason: `unknown target: ${targetRaw}` };
  const r = await setWetStatus(kind, id, parsed?.Status);
  if (!r.success) return { type: 'cold_wet', success: false, reason: r.reason };
  return { type: 'cold_wet', success: true, target: targetRaw, wetStatus: r.wetStatus };
}

registerMarkerHandler('COLD_SCENE', async (parsed, context) => {
  try { return await handleColdSceneMarker(parsed, context); }
  catch (e) { console.error('[coldExposureService] COLD_SCENE handler failed:', e.message); return null; }
});

registerMarkerHandler('COLD_WET', async (parsed, context) => {
  try { return await handleColdWetMarker(parsed, context); }
  catch (e) { console.error('[coldExposureService] COLD_WET handler failed:', e.message); return null; }
});

export default {
  erodeScores, isFrostDead, erodedConModifier, computeEffectiveColdLevel,
  exposureDc, exposureAdvantage, resolveExposureDice, hasColdResistance,
  getFrostState, getFrostLevel, setWetStatus, addFrostLevel, recoverFrost,
  normalizeColdScene, processExposure, processExposureForSession,
  setColdScene, clearColdScene, getColdScene, formatColdBlock,
  handleColdSceneMarker, handleColdWetMarker
};
