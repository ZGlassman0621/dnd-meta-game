/**
 * Rest & Time Service — [REST] and [TIME_ADVANCE] (Phase 1, v1.0.188).
 *
 * Until now, time and rest were narrative: nothing advanced the world
 * clock during play (session end invented 1–3 days from XP-analysis
 * scores — calculateGameTimeAdvance, retired by this build), and rests
 * had no server mechanics at all (the client computed rest effects
 * itself; the server only wrote atmosphere prose around them).
 *
 * Now the DM emits markers and the system owns the facts:
 *
 *   [TIME_ADVANCE: Hours=6 Reason="the road north"]
 *     → world_clock advances via scheduleService; the session's own
 *       elapsedHours accumulates; the outcome surfaces next turn as a
 *       system fact (the ROLL RESULT pattern).
 *
 *   [REST: Type=long] / [REST: Type=short Dice=2 Actor="Lyra"]
 *     → per-actor recovery applied server-side (HP, spell slots, hit
 *       dice), then the clock advances by the rest's duration (8h / 1h).
 *       Short-rest hit dice (Zach's decision, 2026-10-21): Dice= when
 *       the fiction names a count; otherwise auto-spend until the actor
 *       reaches half max HP or runs out of dice.
 *
 * Flashback sessions (dated behind the world clock — the prologue
 * shape): markers accumulate elapsed time on the session but never move
 * the world clock. Detected once per session (the gap between the
 * session's start date and the clock at first marker) and recorded on
 * session_config.clockGapAtStart; the session-end route reads the same
 * facts via sessionEndDays().
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { advanceHours, getClock } from './scheduleService.js';
import { daysBetween } from '../config/harptos.js';
import { HIT_DICE } from '../config/levelProgression.js';
import { resetResourcesForRest } from './classFeatureService.js'; // Item 2: rest resets class resources
import { loadArtificerState, saveArtificerState, onLongRest, onShortRest, attunedCount } from './artificerService.js'; // Artificer base class: rest state
import { defaultSpellshotState, onLongRest as spellshotOnLongRest, onShortRest as spellshotOnShortRest } from './spellshotService.js';
import { defaultWardenState, onLongRest as wardenOnLongRest, onShortRest as wardenOnShortRest } from './wardenService.js';
import { defaultMagusState, onLongRest as magusOnLongRest, onShortRest as magusOnShortRest, societyKeyForName, spellcastingAbilityForSociety } from './magusService.js';
import { defaultPugilistState, onLongRest as pugilistOnLongRest, onShortRest as pugilistOnShortRest } from './pugilistService.js';
import { defaultScholarState, onLongRest as scholarOnLongRest, onShortRest as scholarOnShortRest } from './scholarService.js';
import { defaultDuelistState, onLongRest as duelistOnLongRest, onShortRest as duelistOnShortRest } from './duelistService.js';
import { defaultBlackguardState, onLongRest as blackguardOnLongRest, onShortRest as blackguardOnShortRest } from './blackguardService.js';
import { defaultBloodHunterState, onLongRest as bloodHunterOnLongRest, onShortRest as bloodHunterOnShortRest } from './bloodHunterService.js';
import { defaultWarlordState, onLongRest as warlordOnLongRest, onShortRest as warlordOnShortRest } from './warlordService.js';
import { roll } from '../utils/rng.js';
import { getConditions, reduceExhaustion, removeCondition } from './conditionService.js';
import { resetMythicPower } from './mythicService.js'; // Rest consolidation 2026-11-07: long-rest mythic reset (was the deleted sheet route's)
import {
  parseSpellbookState, serializeSpellbookState, pendingMemorizeSwap,
  setPendingMemorizeSwap, alwaysPreparedSpells, applyMemorizeSwap,
  wizardLevelFromClassLevels, arcaneRecoveryBudget, pendingArcaneRecovery,
  setPendingArcaneRecovery, setArcaneRecoveryUsed, arcaneRecoveryMaxSlots,
  applyArcaneRecovery, warlockLevelFromClassLevels, resetPactSlots,
} from './spellbookService.js'; // Rest consolidation 2026-11-07: banked Memorize Swap consume; Arcane Recovery 2026-11-08: banked slot recovery consume + used-flag reset; spellbook follow-ups 2026-11-08: scoped pact-slot reset (D2)
import { FEATURE_FLAGS } from '../config/featureFlags.js';
import { processExposureForSession, processExposure, getColdScene, recoverFrost, formatColdBlock } from './coldExposureService.js';
import { hasShelter } from './weatherService.js';

/** Cold hook guard: own switch, checked at call time (never cached). */
function coldOn() {
  try { return !!FEATURE_FLAGS.COLD_EXPOSURE; } catch { return false; }
}

export const LONG_REST_HOURS = 8;
export const SHORT_REST_HOURS = 1;

// ---------------------------------------------------------------------------
// session_config helpers (rollRequestService pattern)
// ---------------------------------------------------------------------------

async function readSessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {});
}

async function writeSessionConfig(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?',
    [JSON.stringify(cfg), sessionId]);
}

async function stashTimeEvent(sessionId, evt) {
  if (!sessionId) return;
  try {
    const cfg = await readSessionConfig(sessionId);
    const prior = Array.isArray(cfg.recentTimeEvents) ? cfg.recentTimeEvents : [];
    cfg.recentTimeEvents = [...prior, evt].slice(-5);
    await writeSessionConfig(sessionId, cfg);
  } catch { /* best-effort — the state changes already landed */ }
}

// ---------------------------------------------------------------------------
// Hit-dice pools — JSON breakdowns like {"d10": 4} (levelProgression shape)
// ---------------------------------------------------------------------------

export function parseDicePool(json) {
  const raw = safeParse(json, {});
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const n = Number(v) || 0;
    if (n > 0) out[k] = n;
  }
  return out;
}

export function totalDice(pool) {
  return Object.values(pool || {}).reduce((a, b) => a + b, 0);
}

function dieSides(dieKey) {
  return parseInt(String(dieKey).replace(/^d/i, ''), 10) || 8;
}

/** Expand a {die: count} map into a list of dice, largest first. */
function diceList(map) {
  const list = [];
  for (const [die, count] of Object.entries(map || {})) {
    for (let i = 0; i < count; i++) list.push(die);
  }
  return list.sort((a, b) => dieSides(b) - dieSides(a));
}

function availableDice(pool, used) {
  const out = {};
  for (const [die, count] of Object.entries(pool || {})) {
    const left = count - (used?.[die] || 0);
    if (left > 0) out[die] = left;
  }
  return out;
}

/**
 * Spend hit dice for one actor (rolls server-side). With diceCount, spend
 * exactly that many (bounded by availability and missing HP). Without,
 * auto-spend until the actor reaches half max HP or runs out of dice.
 * Each die heals roll + CON modifier, floored at 0 per die, capped at
 * max HP. Pure apart from the rng — exported for tests.
 */
export function spendHitDice({ pool, used, conMod, currentHp, maxHp, diceCount = null }) {
  const avail = diceList(availableDice(pool, used));
  const half = Math.ceil(maxHp / 2);
  const spent = {};
  const rolls = [];
  let hp = currentHp;
  let healed = 0;
  const limit = diceCount != null
    ? Math.min(Math.max(0, Math.trunc(diceCount) || 0), avail.length)
    : avail.length;
  for (let i = 0; i < limit; i++) {
    if (hp >= maxHp) break;
    if (diceCount == null && hp >= half) break;
    const die = avail[i];
    const r = roll(dieSides(die), 1, { reason: 'hit-die' }).total;
    const applied = Math.min(Math.max(0, r + conMod), maxHp - hp);
    hp += applied;
    healed += applied;
    spent[die] = (spent[die] || 0) + 1;
    rolls.push({ die, roll: r, healed: applied });
  }
  return { spent, rolls, healed, newHp: hp };
}

/**
 * Long-rest hit-dice regain (5e): recover half your total dice, minimum
 * 1. Returns the new USED map. Deterministic — largest spent dice are
 * recovered first.
 */
export function hitDiceRegain(pool, used) {
  const total = totalDice(pool);
  if (total === 0) return { ...(used || {}) };
  let regain = Math.max(1, Math.floor(total / 2));
  const newUsed = { ...(used || {}) };
  for (const die of diceList(newUsed)) {
    if (regain <= 0) break;
    newUsed[die] -= 1;
    regain -= 1;
    if (newUsed[die] <= 0) delete newUsed[die];
  }
  return newUsed;
}

function mergeUsed(used, spent) {
  const out = { ...(used || {}) };
  for (const [die, n] of Object.entries(spent || {})) out[die] = (out[die] || 0) + n;
  return out;
}

function conModOf(scoresJson) {
  const s = safeParse(scoresJson, {});
  const con = Number(s?.con) || 10;
  return Math.floor((con - 10) / 2);
}

function isWarlockPrimary(classStr) {
  return /^\s*warlock\b/i.test(classStr || '');
}

// Warlock level for a pact-slot reset (2026-11-08 follow-ups, D2):
// the warlock entry in class_levels when present, else the row total
// when the primary class is warlock (same fallback shape as the
// wizard-level readers). Null when the character has no warlock
// levels. The reset fires whenever the level is present —
// regardless of primary (a wizard-primary warlock's pact slots
// return on a short rest too; the book never gated them on primary).
function pactWarlockLevel(classLevelsRaw, primaryClass, totalLevel) {
  return warlockLevelFromClassLevels(safeParse(classLevelsRaw, null))
    ?? (isWarlockPrimary(primaryClass) ? Number(totalLevel) || 1 : null);
}

// ---------------------------------------------------------------------------
// Clock advancement for a session (flashback-aware, elapsed-accumulating)
// ---------------------------------------------------------------------------

/**
 * Advance the world clock for a session and accumulate the session's own
 * elapsed hours. In a flashback session (start date behind the world
 * clock) the world clock is NOT moved — only the elapsed total grows.
 * Returns { clock, flashback, elapsedHours }.
 */
export async function advanceClockForSession({ sessionId = null, characterId = null, hours, reason = 'time_advance' }) {
  const pc = characterId
    ? await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId])
    : null;
  const campaignId = pc?.campaign_id ?? null;
  const clockBefore = await getClock(campaignId);

  let cfg = {};
  let session = null;
  if (sessionId) {
    cfg = await readSessionConfig(sessionId);
    session = await dbGet('SELECT game_start_day, game_start_year FROM dm_sessions WHERE id = ?', [sessionId]);
    if (cfg.clockGapAtStart === undefined && session?.game_start_day != null) {
      cfg.clockGapAtStart = Math.max(0, daysBetween(
        session.game_start_day, session.game_start_year ?? clockBefore.year,
        clockBefore.dayOfYear, clockBefore.year
      ));
    }
  }
  const flashback = (cfg.clockGapAtStart ?? 0) > 0;

  let clock = clockBefore;
  if (!flashback && hours > 0) {
    clock = await advanceHours(hours, { campaignId, reason });
  }
  if (sessionId) {
    cfg.elapsedHours = (Number(cfg.elapsedHours) || 0) + hours;
    await writeSessionConfig(sessionId, cfg);
  }
  return { clock, flashback, elapsedHours: sessionId ? cfg.elapsedHours : null };
}

/** [TIME_ADVANCE]: move the clock, stash the outcome for next turn. */
export async function advanceTimeForSession({ sessionId = null, characterId, hours, reason = null }) {
  const r = await advanceClockForSession({ sessionId, characterId, hours, reason: 'time_advance' });
  // Cold exposure (FF_COLD_EXPOSURE): runs only when a cold scene is set
  // for the session; otherwise a no-op. Flashback hours still count as
  // scene hours (the scene's time passes even when the world clock does
  // not move). Best-effort — a cold failure must never break time.
  let cold = null;
  if (coldOn() && sessionId) {
    try {
      const res = await processExposureForSession({ sessionId, characterId, hours });
      if (res.processed) cold = res;
    } catch (e) { console.error('[restTimeService] cold exposure on TIME_ADVANCE failed:', e.message); }
  }
  const evt = {
    kind: 'time', hours, reason: reason || null, flashback: r.flashback,
    clock: { dayOfYear: r.clock.dayOfYear, year: r.clock.year, hour: r.clock.hour },
    ...(cold ? { cold } : {})
  };
  await stashTimeEvent(sessionId, evt);
  return evt;
}

/**
 * The session-end elapsed span (pure — the /end route's replacement for
 * calculateGameTimeAdvance). Normal sessions: whole days between the
 * session's start date and the clock as it stands. Flashbacks: the
 * session's own elapsed hours, minimum 1 (legacy floor).
 */
export function sessionEndDays({ startDay = 1, startYear = 1492, clockDayOfYear = 1, clockYear = 1492, elapsedHours = 0, flashback = false } = {}) {
  if (flashback) return Math.max(1, Math.ceil((Number(elapsedHours) || 0) / 24));
  return Math.max(0, daysBetween(startDay, startYear, clockDayOfYear, clockYear));
}

// ---------------------------------------------------------------------------
// Rest application
// ---------------------------------------------------------------------------

/** Artificer rest state (base-class build): Flash/Tinker uses,
 * drain/transmute flags, tinkered items. Never breaks the rest.
 * Runs after applyResourceRest, which now preserves .artificer. */
async function applyArtificerRest(kind, id, className, level, abilityScores, type) {
  try {
    if (String(className || '').toLowerCase().trim() !== 'artificer') return;
    const scores = typeof abilityScores === 'string' ? safeParse(abilityScores, {}) : (abilityScores || {});
    const intMod = Math.floor((Number(scores.int ?? scores.intelligence ?? 10) - 10) / 2);
    const state = await loadArtificerState(kind, id);
    const next = type === 'long'
      ? onLongRest(state, { level, intMod }).state
      : onShortRest(state, { level, intMod, attunedCount: attunedCount(state) }).state;
    await saveArtificerState(kind, id, next);
  } catch { /* artificer rest is best-effort, like resource reset */ }
}

// Overnight 7-class merge: one generic dispatcher for the new classes'
// rest state, mirroring applyArtificerRest (best-effort, never breaks
// the rest). Each service's onRest is pure (state, opts) -> { state };
// this dispatcher owns the blob IO so the per-service load/save shape
// differences (DB vs pure vs dbClient) do not leak into call sites.
// Runs AFTER applyResourceRest, like the artificer hook.
const NEW_CLASS_REST = {
  spellshot: { def: defaultSpellshotState, long: spellshotOnLongRest, short: spellshotOnShortRest },
  warden: { def: defaultWardenState, long: wardenOnLongRest, short: wardenOnShortRest },
  magus: { def: defaultMagusState, long: magusOnLongRest, short: magusOnShortRest },
  pugilist: { def: defaultPugilistState, long: pugilistOnLongRest, short: pugilistOnShortRest },
  scholar: { def: defaultScholarState, long: scholarOnLongRest, short: scholarOnShortRest },
  duelist: { def: defaultDuelistState, long: duelistOnLongRest, short: duelistOnShortRest },
  blackguard: { def: defaultBlackguardState, long: blackguardOnLongRest, short: blackguardOnShortRest },
  blood_hunter: { def: defaultBloodHunterState, long: bloodHunterOnLongRest, short: bloodHunterOnShortRest },
  warlord: { def: defaultWarlordState, long: warlordOnLongRest, short: warlordOnShortRest },
};
async function applyNewClassRest(table, id, className, subclass, level, abilityScores, type) {
  try {
    const cls = String(className || '').toLowerCase().trim();
    const entry = NEW_CLASS_REST[cls];
    if (!entry) return;
    const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
    const blob = safeParse(row?.class_resources_json, {}) || {};
    const state = blob[cls] ? { ...entry.def(), ...blob[cls] } : entry.def();
    const scores = typeof abilityScores === 'string' ? safeParse(abilityScores, {}) : (abilityScores || {});
    const full = { int: 'intelligence', wis: 'wisdom', cha: 'charisma' };
    const mod = (a) => Math.floor((Number(scores[a] ?? scores[full[a]] ?? 10) - 10) / 2);
    const opts = {
      level,
      subclass: subclass || null,
      alternateSet: state.alternateSet ?? null,
      intMod: mod('int'),
      chaMod: mod('cha'),
    };
    if (cls === 'magus') {
      const key = societyKeyForName(subclass) || societyKeyForName(state.society);
      const ability = key ? spellcastingAbilityForSociety(key) : null;
      opts.spellMod = ability ? mod(ability) : undefined; // unresolvable society -> 0-use math, never NaN
    }
    const fn = type === 'long' ? entry.long : entry.short;
    const out = fn(state, opts);
    blob[cls] = (out && out.state) || out || state;
    await dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(blob), id]);
  } catch { /* new-class rest is best-effort, like artificer rest */ }
}

/** Item 2: class-resource reset for a rest. Never breaks the rest.
 * Mechanics hooks, Families 2+7: opts carries the actor's subclass,
 * class_levels, ability scores, and species through to
 * resetResourcesForRest, so subclass pools (and the Human Heroic
 * Inspiration grant) reset on the same rest. No new rest path — the
 * DM rest is the only rest. */
async function applyResourceRest(table, id, raw, className, level, type, opts = {}) {
  try {
    const next = resetResourcesForRest(raw, { className, level, type, ...opts });
    await dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(next), id]);
  } catch { /* resource reset is best-effort */ }
}

async function restPc(pc, type, diceCount) {
  const name = pc.name || 'Player';
  if ((pc.current_hp ?? 0) <= 0) {
    return { kind: 'pc', name, rested: false, note: 'down — a rest grants no benefit at 0 HP' };
  }
  const pool = parseDicePool(pc.hit_dice);
  const used = parseDicePool(pc.hit_dice_used);
  const detail = { kind: 'pc', name, rested: true, hpFrom: pc.current_hp, hpTo: pc.current_hp };

  if (type === 'long') {
    const newUsed = hitDiceRegain(pool, used);
    detail.hpTo = pc.max_hp;
    detail.slotsRestored = true;
    detail.diceRegained = totalDice(used) - totalDice(newUsed);
    detail.tempHpCleared = (pc.temp_hp || 0) > 0;
    await dbRun(
      'UPDATE characters SET current_hp = ?, spell_slots_used = ?, hit_dice_used = ?, temp_hp = 0 WHERE id = ?',
      [pc.max_hp, '{}', JSON.stringify(newUsed), pc.id]
    );
    // Arcane Recovery (2026-11-08): a long rest clears the used-flag
    // — the recovery returns. It does NOT consume a banked recovery
    // (Arcane Recovery is a short-rest feature); the bank waits for
    // the next PC short rest. A second write, only when the flag is
    // actually set (the main UPDATE above is a fixed four-column
    // string, and rewriting spellbook_json on every long rest would
    // normalize the column for characters that never used the
    // feature). The bank is untouched by this write.
    try {
      const longBookState = parseSpellbookState(pc.spellbook_json);
      if (longBookState.arcaneRecoveryUsed === true) {
        await dbRun('UPDATE characters SET spellbook_json = ? WHERE id = ?',
          [serializeSpellbookState(setArcaneRecoveryUsed(longBookState, false)), pc.id]);
        detail.arcaneRecoveryReset = true;
      }
    } catch { /* flag clear is best-effort — the rest already landed */ }
    // Mythic power (rest consolidation 2026-11-07): the deleted sheet
    // route reset it on long rest; the DM path is the only rest now,
    // so the reset lives here. Best-effort, like the old route — no
    // mythic record is fine.
    try {
      await resetMythicPower(pc.id);
      detail.mythicPowerReset = true;
    } catch { /* no mythic record is fine */ }
    await applyResourceRest('characters', pc.id, pc.class_resources_json, pc.class, pc.level, 'long', {
      subclassName: pc.subclass ?? null, classLevels: pc.class_levels ?? null,
      abilityScores: pc.ability_scores, species: pc.race ?? null, subrace: pc.subrace ?? null,
    });
    await applyArtificerRest('character', pc.id, pc.class, pc.level, pc.ability_scores, 'long');
    await applyNewClassRest('characters', pc.id, pc.class, pc.subclass, pc.level, pc.ability_scores, 'long');
    try {
      const { breakConcentration } = await import('./concentrationService.js');
      await breakConcentration(pc.id, 'long_rest');
    } catch { /* concentration is best-effort */ }
    // Exhaustion (v1.0.190): a long rest steps it down one level.
    try {
      const ex = await reduceExhaustion('player', pc.id);
      if (ex.changed) detail.exhaustionAfter = ex.level;
    } catch { /* best-effort */ }
  } else {
    // Memorize Spell (rest consolidation 2026-11-07): the player
    // banks the swap on the sheet; the DM short rest consumes it.
    // Same validation as the old rest route, in the same order
    // (wizard L5+ → book not lost → applyMemorizeSwap), re-run here
    // because the book may have changed between banking and the
    // rest — and ALL of it before any HP write, so a refused swap
    // leaves the rest untouched. The bank is cleared whether the
    // swap applies or is refused; the prepared-list + bank writes
    // ride the same UPDATE as the HP / hit-dice write. A bank is
    // never consumed by a long rest (Memorize is short-rest only)
    // or by a companion-only rest — it waits for the next PC short
    // rest. A PC at 0 HP never reaches this branch (early return
    // above), so a banked swap survives a rest that never happened.
    const banked = pendingMemorizeSwap(pc.spellbook_json);
    let memorizeSwapDetail = null;
    let newPreparedJson = null;
    let newSpellbookJson = null;
    if (banked) {
      const wizLevel = wizardLevelFromClassLevels(safeParse(pc.class_levels, null))
        ?? (String(pc.class || '').toLowerCase() === 'wizard' ? Number(pc.level) || 1 : null);
      const bookState = parseSpellbookState(pc.spellbook_json);
      let refusal = null;
      let applied = null;
      if (!wizLevel || wizLevel < 5) {
        refusal = 'Memorize Spell requires wizard level 5';
      } else if (bookState.status === 'lost') {
        refusal = 'the spellbook is lost — prepared spells cannot be changed until the spellbook is recovered or replaced';
      } else {
        const preparedRaw = safeParse(pc.prepared_spells, []);
        const bookRaw = safeParse(pc.known_spells, []);
        const swap = applyMemorizeSwap({
          preparedList: Array.isArray(preparedRaw) ? preparedRaw : [],
          bookList: Array.isArray(bookRaw) ? bookRaw : [],
          oldSpell: banked.oldSpell,
          newSpell: banked.newSpell,
          alwaysPreparedList: alwaysPreparedSpells(bookState, wizLevel),
        });
        if (swap.ok) applied = swap.prepared;
        else refusal = swap.error;
      }
      // Consume the bank either way — never a stale bank on a later rest.
      newSpellbookJson = serializeSpellbookState(setPendingMemorizeSwap(bookState, null));
      if (applied) {
        newPreparedJson = JSON.stringify(applied);
        memorizeSwapDetail = { applied: true, oldSpell: banked.oldSpell, newSpell: banked.newSpell };
      } else {
        memorizeSwapDetail = { applied: false, reason: refusal };
      }
    }
    // Arcane Recovery (2026-11-08): the player banks the slot
    // levels on the sheet; the DM short rest consumes the bank.
    // Same validation as the bank route, in the same order (wizard
    // level → flag unused → budget → no 6th+ → spent/max via
    // applyArcaneRecovery), re-run here because slots may have been
    // spent or restored between banking and the rest — and ALL of it
    // before any HP write, so a refused recovery leaves the rest
    // untouched. The bank is cleared whether the recovery applies or
    // is refused. On apply, the new spell_slots_used map rides the
    // SAME UPDATE as the HP / hit-dice write, and the cleared bank +
    // set flag ride it too, merged into the same staged
    // spellbook_json the Memorize block above may have staged — one
    // refused bank never blocks the other. A bank is never consumed
    // by a long rest (short-rest only) or by a companion-only rest.
    // A PC at 0 HP never reaches this branch (early return above),
    // so a banked recovery survives a rest that never happened.
    // Warlock ordering (2026-11-08 follow-ups, D2): the pact reset
    // is SCOPED to the pact slots only — the reset map below zeroes
    // just the pact count at the pact slot level, and the recovery
    // validates + applies against THAT post-reset map, so a
    // warlock-primary wizard gets the pact slots back AND the banked
    // wizard slots back in the same UPDATE, neither clobbering the
    // other. The old warlock refusal is gone: it existed because
    // the reset wrote '{}' (every slot back) and the recovery would
    // have written a stale map over it. A wizard-primary multiclass
    // with warlock levels gets the same scoped reset (pact slots
    // return on a short rest regardless of primary).
    const pactLevel = pactWarlockLevel(pc.class_levels, pc.class, pc.level);
    const hasPact = pactLevel != null;
    const usedRawForReset = safeParse(pc.spell_slots_used, {});
    const usedAfterPactReset = hasPact
      ? resetPactSlots(usedRawForReset && typeof usedRawForReset === 'object' ? usedRawForReset : {}, pactLevel)
      : (usedRawForReset && typeof usedRawForReset === 'object' ? usedRawForReset : {});
    const arcBanked = pendingArcaneRecovery(pc.spellbook_json);
    let arcaneRecoveryDetail = null;
    let newSlotsJson = null;
    if (arcBanked) {
      const wizLevel = wizardLevelFromClassLevels(safeParse(pc.class_levels, null))
        ?? (String(pc.class || '').toLowerCase() === 'wizard' ? Number(pc.level) || 1 : null);
      const arcBookState = parseSpellbookState(pc.spellbook_json);
      let refusal = null;
      let applied = null;
      if (!wizLevel) {
        refusal = 'Arcane Recovery requires wizard level 1';
      } else if (arcBookState.arcaneRecoveryUsed === true) {
        refusal = 'Arcane Recovery has already been used — it returns after your next long rest';
      } else {
        const recovery = applyArcaneRecovery({
          usedSlots: usedAfterPactReset,
          maxSlots: arcaneRecoveryMaxSlots(safeParse(pc.class_levels, null), wizLevel, pc.subclass),
          bankedLevels: arcBanked.slots,
          budget: arcaneRecoveryBudget(wizLevel),
        });
        if (recovery.ok) applied = recovery.usedSlots;
        else refusal = recovery.error;
      }
      // Consume the bank either way; set the flag only on apply.
      // Merge into the Memorize-staged spellbook_json when there is
      // one (both banks ride the same column and the same UPDATE),
      // otherwise stage from the row value.
      const mergedBook = parseSpellbookState(newSpellbookJson ?? pc.spellbook_json);
      const clearedBook = setPendingArcaneRecovery(mergedBook, null);
      newSpellbookJson = serializeSpellbookState(
        applied ? setArcaneRecoveryUsed(clearedBook, true) : clearedBook);
      if (applied) {
        newSlotsJson = JSON.stringify(applied);
        arcaneRecoveryDetail = { applied: true, recovered: [...arcBanked.slots] };
      } else {
        arcaneRecoveryDetail = { applied: false, reason: refusal };
      }
    }
    const spend = spendHitDice({
      pool, used, conMod: conModOf(pc.ability_scores),
      currentHp: pc.current_hp, maxHp: pc.max_hp, diceCount
    });
    detail.hpTo = spend.newHp;
    detail.healed = spend.healed;
    detail.diceSpent = totalDice(spend.spent);
    detail.diceRolls = spend.rolls;
    detail.diceRemaining = totalDice(availableDice(pool, mergeUsed(used, spend.spent)));
    if (memorizeSwapDetail) detail.memorizeSwap = memorizeSwapDetail;
    if (arcaneRecoveryDetail) detail.arcaneRecovery = arcaneRecoveryDetail;
    detail.slotsRestored = hasPact;
    const sets = ['current_hp = ?', 'hit_dice_used = ?'];
    const params = [spend.newHp, JSON.stringify(mergeUsed(used, spend.spent))];
    // One spell_slots_used push, of the FINAL map: the pact-scoped
    // reset map when the recovery did not apply (or there was no
    // bank), the recovery's decremented map when it did — the two
    // can never both fire, because the recovery already applied
    // against the post-reset map. A character with no pact slots and
    // no applying recovery pushes nothing, as before.
    const finalSlotsJson = newSlotsJson ?? (hasPact ? JSON.stringify(usedAfterPactReset) : null);
    if (finalSlotsJson !== null) { sets.push('spell_slots_used = ?'); params.push(finalSlotsJson); }
    if (newPreparedJson !== null) { sets.push('prepared_spells = ?'); params.push(newPreparedJson); }
    if (newSpellbookJson !== null) { sets.push('spellbook_json = ?'); params.push(newSpellbookJson); }
    params.push(pc.id);
    await dbRun(`UPDATE characters SET ${sets.join(', ')} WHERE id = ?`, params);
    await applyResourceRest('characters', pc.id, pc.class_resources_json, pc.class, pc.level, 'short', {
      subclassName: pc.subclass ?? null, classLevels: pc.class_levels ?? null,
      abilityScores: pc.ability_scores, species: pc.race ?? null, subrace: pc.subrace ?? null,
    });
    await applyArtificerRest('character', pc.id, pc.class, pc.level, pc.ability_scores, 'short');
    await applyNewClassRest('characters', pc.id, pc.class, pc.subclass, pc.level, pc.ability_scores, 'short');
  }
  return detail;
}

function companionPool(comp) {
  const stored = parseDicePool(comp.companion_hit_dice);
  if (totalDice(stored) > 0) return stored;
  // companion_hit_dice was never populated by any writer (migration 029
  // added the column for this day) — compute the pool from class + level.
  const die = HIT_DICE[(comp.companion_class || '').toLowerCase()] || 8;
  return { [`d${die}`]: Math.max(1, comp.companion_level || 1) };
}

async function restCompanion(comp, type, diceCount) {
  const name = comp.name || 'Companion';
  const hp = comp.companion_current_hp ?? 0;
  if (hp <= 0) {
    return { kind: 'companion', name, rested: false, note: 'down — a rest grants no benefit at 0 HP' };
  }
  const pool = companionPool(comp);
  const used = parseDicePool(comp.companion_hit_dice_used);
  const detail = { kind: 'companion', name, rested: true, hpFrom: hp, hpTo: hp };

  if (type === 'long') {
    const newUsed = hitDiceRegain(pool, used);
    detail.hpTo = comp.companion_max_hp;
    detail.slotsRestored = true;
    detail.diceRegained = totalDice(used) - totalDice(newUsed);
    // Death saves reset (Job B, 2026-11-08): a long rest clears both
    // tallies — the port of the deleted companion rest route's C4.
    // Reported only when a tally was actually non-zero.
    if ((comp.death_save_successes || 0) > 0 || (comp.death_save_failures || 0) > 0) {
      detail.deathSavesReset = true;
    }
    await dbRun(
      'UPDATE companions SET companion_current_hp = ?, companion_spell_slots_used = ?, companion_hit_dice_used = ?, death_save_successes = 0, death_save_failures = 0 WHERE id = ?',
      [comp.companion_max_hp, '{}', JSON.stringify(newUsed), comp.id]
    );
    await applyResourceRest('companions', comp.id, comp.class_resources_json, comp.companion_class, comp.companion_level, 'long', {
      subclassName: comp.companion_subclass ?? null, classLevels: comp.companion_class_levels ?? null,
      abilityScores: comp.companion_ability_scores, species: comp.race ?? comp.npc_race ?? null, subrace: comp.companion_subrace ?? null,
    });
    await applyArtificerRest('companion', comp.id, comp.companion_class, comp.companion_level, comp.companion_ability_scores, 'long');
    await applyNewClassRest('companions', comp.id, comp.companion_class, comp.companion_subclass ?? null, comp.companion_level, comp.companion_ability_scores, 'long');
    // Exhaustion (v1.0.190): a long rest steps it down one level.
    try {
      const ex = await reduceExhaustion('companion', comp.id);
      if (ex.changed) detail.exhaustionAfter = ex.level;
    } catch { /* best-effort */ }
    // Conditions (Job B, 2026-11-08): a long rest clears a
    // companion's conditions except petrified — the port of the
    // deleted companion rest route's C3, via removeCondition so the
    // condition_meta rows go with the condition (the old route
    // rewrote active_conditions only and left stale meta behind).
    // Exhaustion is NOT cleared here: reduceExhaustion above already
    // stepped it down once, and it must step exactly once.
    try {
      const before = await getConditions('companion', comp.id);
      const toClear = before.filter(c => c !== 'petrified' && !c.startsWith('exhaustion_'));
      for (const key of toClear) {
        await removeCondition('companion', comp.id, key);
      }
      if (toClear.length > 0) detail.conditionsCleared = toClear;
    } catch { /* best-effort */ }
  } else {
    const spend = spendHitDice({
      pool, used, conMod: conModOf(comp.companion_ability_scores),
      currentHp: hp, maxHp: comp.companion_max_hp, diceCount
    });
    detail.hpTo = spend.newHp;
    detail.healed = spend.healed;
    detail.diceSpent = totalDice(spend.spent);
    detail.diceRolls = spend.rolls;
    detail.diceRemaining = totalDice(availableDice(pool, mergeUsed(used, spend.spent)));
    const pactLevel = pactWarlockLevel(comp.companion_class_levels, comp.companion_class, comp.companion_level);
    const hasPact = pactLevel != null;
    detail.slotsRestored = hasPact;
    // Scoped pact reset (2026-11-08 follow-ups, D2): only the pact
    // slots return, never the whole map — a multiclass companion's
    // spent wizard slots stay spent. Same helper as the PC path.
    const compUsedRaw = safeParse(comp.companion_spell_slots_used, {});
    const compFinalSlots = hasPact
      ? JSON.stringify(resetPactSlots(compUsedRaw && typeof compUsedRaw === 'object' ? compUsedRaw : {}, pactLevel))
      : null;
    await dbRun(
      'UPDATE companions SET companion_current_hp = ?, companion_hit_dice_used = ?' +
      (hasPact ? ', companion_spell_slots_used = ?' : '') + ' WHERE id = ?',
      hasPact
        ? [spend.newHp, JSON.stringify(mergeUsed(used, spend.spent)), compFinalSlots, comp.id]
        : [spend.newHp, JSON.stringify(mergeUsed(used, spend.spent)), comp.id]
    );
    await applyResourceRest('companions', comp.id, comp.class_resources_json, comp.companion_class, comp.companion_level, 'short', {
      subclassName: comp.companion_subclass ?? null, classLevels: comp.companion_class_levels ?? null,
      abilityScores: comp.companion_ability_scores, species: comp.race ?? comp.npc_race ?? null, subrace: comp.companion_subrace ?? null,
    });
    await applyArtificerRest('companion', comp.id, comp.companion_class, comp.companion_level, comp.companion_ability_scores, 'short');
    await applyNewClassRest('companions', comp.id, comp.companion_class, comp.companion_subclass ?? null, comp.companion_level, comp.companion_ability_scores, 'short');
  }
  return detail;
}

/**
 * Apply a rest. Scope: no Actor (or "party") → PC + active companions;
 * the PC's name / "Player" → PC only; a companion's name → that
 * companion only. The clock advances once, by the rest's duration.
 */
export async function applyRest({ sessionId = null, characterId, type, actor = null, dice = null }) {
  const pc = await dbGet(
    'SELECT id, name, class, level, class_levels, subclass, race, subrace, current_hp, max_hp, temp_hp, ability_scores, spell_slots_used, hit_dice, hit_dice_used, current_location, inventory, class_resources_json, prepared_spells, known_spells, spellbook_json FROM characters WHERE id = ?',
    [characterId]
  );
  if (!pc) return { success: false, reason: 'character not found' };
  const companions = await dbAll(
    `SELECT c.*, n.name AS name, n.race AS npc_race FROM companions c
     LEFT JOIN npcs n ON n.id = c.npc_id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
    [characterId]
  );

  const a = (actor || '').trim();
  let pcTarget = true;
  let compTargets = companions;
  if (a && !/^(party|all)$/i.test(a)) {
    if (/^(player|pc|character)$/i.test(a) || a.toLowerCase() === (pc.name || '').toLowerCase()) {
      compTargets = [];
    } else {
      const match = companions.find(c => (c.name || '').toLowerCase() === a.toLowerCase());
      if (!match) return { success: false, reason: `unknown rest actor: ${a}` };
      pcTarget = false;
      compTargets = [match];
    }
  }

  const results = [];
  if (pcTarget) results.push(await restPc(pc, type, dice));
  for (const comp of compTargets) results.push(await restCompanion(comp, type, dice));

  const hours = type === 'long' ? LONG_REST_HOURS : SHORT_REST_HOURS;
  const clk = await advanceClockForSession({
    sessionId, characterId, hours, reason: `rest_${type}`
  });

  // Cold (FF_COLD_EXPOSURE), best-effort — never breaks the rest.
  // Sheltered rest (building/cave) recovers frost 1/hour for the actors
  // who actually rested. An unsheltered rest with a cold scene runs
  // exposure for the rested actors only (resting +2, unless the scene's
  // insulated tent negates it); actors who did not rest are skipped.
  let cold = null;
  if (coldOn()) {
    try {
      const shelter = hasShelter(pc.current_location, pc.inventory);
      const suspended = shelter === 'building' || shelter === 'cave';
      const restedTargets = [];
      if (pcTarget) {
        const d = results.find(r => r.kind === 'pc');
        if (d?.rested) restedTargets.push({ kind: 'player', id: pc.id, name: pc.name || 'Player' });
      }
      for (const comp of compTargets) {
        const d = results.find(r => r.kind === 'companion' && r.name === comp.name);
        if (d?.rested) restedTargets.push({ kind: 'companion', id: comp.id, name: comp.name });
      }
      if (suspended) {
        const recovered = [];
        for (const t of restedTargets) {
          const rec = await recoverFrost(t.kind, t.id, hours, true);
          if (rec.changed) recovered.push({ ...t, ...rec });
        }
        if (recovered.length) cold = { recovered, suspended: true };
      } else if (sessionId && restedTargets.length) {
        const scene = await getColdScene(sessionId);
        if (scene) {
          const exposure = await processExposure({
            characterId, hours, scene, resting: true,
            actorFilter: new Set(restedTargets.map(t => `${t.kind}:${t.id}`))
          });
          if (exposure.processed) cold = { exposure, suspended: false };
        }
      }
    } catch (e) { console.error('[restTimeService] cold on REST failed:', e.message); }
  }

  const evt = {
    kind: 'rest', restType: type, hours, actor: a || 'party',
    results, flashback: clk.flashback,
    clock: { dayOfYear: clk.clock.dayOfYear, year: clk.clock.year, hour: clk.clock.hour },
    ...(cold ? { cold } : {})
  };
  await stashTimeEvent(sessionId, evt);
  return { success: true, event: evt };
}

/**
 * Downtime rest (Job B, 2026-11-08): the DM long/short-rest effect set
 * for a character resting OUTSIDE a DM session — invoked by
 * POST /api/downtime/complete/:id, which replaces the one-line
 * spell_slots_used = '{}' push applyBenefits used to do.
 *
 * Long: full slot reset + Arcane Recovery flag clear + hit-dice regain
 * + exhaustion -1 + temp-HP clear + concentration break + mythic reset
 * + resource/artificer/new-class hooks — the DM long-rest effect set,
 * MINUS HP (downtime keeps its own quality-scaled HP math in
 * calculateBenefits/applyBenefits) and MINUS clock/cold/stash (downtime
 * time already elapsed in real time; there is no session to stash into
 * and no DM prompt involvement).
 * Short: warlock pact-slot reset only, SCOPED to the pact slots
 * (2026-11-08 follow-ups, D2 — the same helper as the DM path, and
 * fired whenever the character has warlock levels, regardless of
 * primary). Downtime keeps its simulated average-dice heal; NO real
 * hit dice are spent here.
 * Never: no clock advance, no cold run, no stashed time event, and the
 * Memorize/Arcane BANKS are not consumed — only the Arcane *flag*
 * clears on a long rest (a downtime long rest is a long rest, so a
 * wizard's recovery must come back; the bank waits for the next DM
 * short rest, like a companion-only rest).
 * No 0-HP guard (deliberate, reversible): unlike a DM-session rest,
 * downtime completion also heals via applyBenefits' own HP math in the
 * same call, so refusing rest effects to a character at 0 HP would
 * leave HP back but slots gone with no fiction behind it. The old
 * downtime path likewise restored slots unconditionally.
 * Returns { success, slotsRestored, arcaneRecoveryReset, diceRegained?,
 *   exhaustionAfter?, mythicPowerReset? } (or { success: false, reason }).
 */
export async function applyDowntimeRest({ characterId, type }) {
  if (type !== 'short' && type !== 'long') {
    return { success: false, reason: 'type must be short or long' };
  }
  const pc = await dbGet(
    'SELECT id, class, level, class_levels, subclass, race, subrace, current_hp, max_hp, temp_hp, ability_scores, spell_slots_used, hit_dice, hit_dice_used, class_resources_json, spellbook_json FROM characters WHERE id = ?',
    [characterId]
  );
  if (!pc) return { success: false, reason: 'character not found' };

  if (type === 'long') {
    const pool = parseDicePool(pc.hit_dice);
    const used = parseDicePool(pc.hit_dice_used);
    const newUsed = hitDiceRegain(pool, used);
    await dbRun(
      'UPDATE characters SET spell_slots_used = ?, hit_dice_used = ?, temp_hp = 0 WHERE id = ?',
      ['{}', JSON.stringify(newUsed), pc.id]
    );
    // Arcane Recovery flag clear — the bug this fold fixes: a
    // downtime long rest used to restore slots while leaving
    // spellbook_json.arcaneRecoveryUsed set, so the next DM short
    // rest refused a banked recovery even though a long rest had
    // happened. The BANK is untouched (see header).
    let arcaneRecoveryReset = false;
    try {
      const bookState = parseSpellbookState(pc.spellbook_json);
      if (bookState.arcaneRecoveryUsed === true) {
        await dbRun('UPDATE characters SET spellbook_json = ? WHERE id = ?',
          [serializeSpellbookState(setArcaneRecoveryUsed(bookState, false)), pc.id]);
        arcaneRecoveryReset = true;
      }
    } catch { /* flag clear is best-effort — the rest already landed */ }
    let mythicPowerReset = false;
    try {
      await resetMythicPower(pc.id);
      mythicPowerReset = true;
    } catch { /* no mythic record is fine */ }
    await applyResourceRest('characters', pc.id, pc.class_resources_json, pc.class, pc.level, 'long', {
      subclassName: pc.subclass ?? null, classLevels: pc.class_levels ?? null,
      abilityScores: pc.ability_scores, species: pc.race ?? null, subrace: pc.subrace ?? null,
    });
    await applyArtificerRest('character', pc.id, pc.class, pc.level, pc.ability_scores, 'long');
    await applyNewClassRest('characters', pc.id, pc.class, pc.subclass, pc.level, pc.ability_scores, 'long');
    try {
      const { breakConcentration } = await import('./concentrationService.js');
      await breakConcentration(pc.id, 'long_rest');
    } catch { /* concentration is best-effort */ }
    let exhaustionAfter;
    try {
      const ex = await reduceExhaustion('player', pc.id);
      if (ex.changed) exhaustionAfter = ex.level;
    } catch { /* best-effort */ }
    return {
      success: true, slotsRestored: true, arcaneRecoveryReset,
      diceRegained: totalDice(used) - totalDice(newUsed), mythicPowerReset,
      ...(exhaustionAfter !== undefined ? { exhaustionAfter } : {}),
    };
  }

  // Short: warlock pact slots only, scoped to the pact count at
  // the pact slot level (D2 — same helper as the DM path).
  const pactLevel = pactWarlockLevel(pc.class_levels, pc.class, pc.level);
  const hasPact = pactLevel != null;
  if (hasPact) {
    const usedRaw = safeParse(pc.spell_slots_used, {});
    await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?',
      [JSON.stringify(resetPactSlots(usedRaw && typeof usedRaw === 'object' ? usedRaw : {}, pactLevel)), pc.id]);
  }
  return { success: true, slotsRestored: hasPact, arcaneRecoveryReset: false };
}

// ---------------------------------------------------------------------------
// Outcome text for the DM (injected as a system fact next turn)
// ---------------------------------------------------------------------------

function daypart(hour) {
  if (hour < 5) return 'the small hours';
  if (hour < 7) return 'dawn';
  if (hour < 12) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 20) return 'dusk';
  if (hour < 23) return 'evening';
  return 'late night';
}

function clockLine(evt) {
  if (evt.flashback) return 'Time passes within the scene; the wider world clock is elsewhere.';
  const c = evt.clock || {};
  return `It is now day ${c.dayOfYear} of ${c.year} DR, hour ${c.hour} (${daypart(c.hour ?? 8)}).`;
}

export function formatTimeEventBlock(evt) {
  if (!evt) return '';
  if (evt.kind === 'time') {
    return `\n\n══════════════ TIME PASSED (system — this is fact) ══════════════\n` +
      `${evt.hours} hour${evt.hours === 1 ? '' : 's'} pass${evt.reason ? ` — ${evt.reason}` : ''}. ${clockLine(evt)}\n` +
      (evt.cold ? formatColdBlock(evt.cold) + '\n' : '') +
      `══════════════════════════════════════════════════════════════════\n`;
  }
  if (evt.kind === 'rest') {
    const lines = (evt.results || []).map(r => {
      if (!r.rested) return `${r.name}: no benefit — ${r.note}.`;
      let s = `${r.name}: HP ${r.hpFrom} → ${r.hpTo}`;
      if (evt.restType === 'long') {
        s += ' (fully rested). Spell slots restored.';
        if (r.diceRegained > 0) s += ` Hit dice regained: ${r.diceRegained}.`;
        if (r.tempHpCleared) s += ' Temporary HP gone.';
        if (r.mythicPowerReset) s += ' Mythic power restored.';
        if (r.arcaneRecoveryReset) s += ' Arcane Recovery refreshed.';
        if (r.exhaustionAfter !== undefined) s += r.exhaustionAfter > 0
          ? ` Exhaustion reduced to level ${r.exhaustionAfter}.`
          : ' Exhaustion cleared.';
        if (r.conditionsCleared?.length) s += ` Conditions cleared: ${r.conditionsCleared.join(', ')}.`;
        if (r.deathSavesReset) s += ' Death saves reset.';
      } else {
        if (r.diceSpent > 0) {
          const rolls = (r.diceRolls || []).map(x => `${x.die.replace('d', '')}→${x.roll}`).join(', ');
          s += ` — spent ${r.diceSpent} hit dice (${rolls}), healed ${r.healed}. ${r.diceRemaining} dice left.`;
        } else {
          s += ' — no hit dice spent.';
        }
        if (r.slotsRestored) s += ' Pact slots restored.';
        if (r.memorizeSwap?.applied) s += ` Memorize Spell: swapped ${r.memorizeSwap.oldSpell} → ${r.memorizeSwap.newSpell}.`;
        else if (r.memorizeSwap) s += ` Memorize Spell: banked swap refused — ${r.memorizeSwap.reason}.`;
        if (r.arcaneRecovery?.applied) s += ` Arcane Recovery: restored slots of levels ${r.arcaneRecovery.recovered.join(', ')}.`;
        else if (r.arcaneRecovery) s += ` Arcane Recovery: banked recovery refused — ${r.arcaneRecovery.reason}.`;
      }
      return s;
    });
    let coldText = '';
    if (evt.cold?.recovered) {
      coldText = `\nFrost recovered (sheltered rest): ${evt.cold.recovered.map(r => `${r.name}: frost ${r.before} → ${r.level}`).join(', ')}.`;
    } else if (evt.cold?.exposure) {
      coldText = formatColdBlock(evt.cold.exposure);
    }
    return `\n\n══════════════ ${evt.restType === 'long' ? 'LONG' : 'SHORT'} REST (system — this is fact) ══════════════\n` +
      lines.join('\n') + coldText + `\n${evt.hours} hour${evt.hours === 1 ? '' : 's'} pass. ${clockLine(evt)}\n` +
      `══════════════════════════════════════════════════════════════════\n`;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Marker handlers
// ---------------------------------------------------------------------------

registerMarkerHandler('TIME_ADVANCE', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const hours = (Number(parsed?.Days) || 0) * 24 + (Number(parsed?.Hours) || 0);
    if (!Number.isFinite(hours) || hours <= 0) {
      return { type: 'time_advance', success: false, reason: 'TIME_ADVANCE needs Hours= and/or Days= greater than zero' };
    }
    const evt = await advanceTimeForSession({
      sessionId: context.sessionId ?? null, characterId: context.characterId,
      hours, reason: parsed?.Reason || null
    });
    return { type: 'time_advance', success: true, ...evt };
  } catch (e) {
    console.error('[restTimeService] TIME_ADVANCE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('REST', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const type = String(parsed?.Type || '').toLowerCase();
    if (type !== 'short' && type !== 'long') {
      return { type: 'rest', success: false, reason: 'REST needs Type=short or Type=long' };
    }
    const dice = parsed?.Dice != null ? Math.max(0, Math.trunc(Number(parsed.Dice)) || 0) : null;
    const r = await applyRest({
      sessionId: context.sessionId ?? null, characterId: context.characterId,
      type, actor: parsed?.Actor || null, dice
    });
    if (!r || r.success === false) {
      return { type: 'rest', success: false, reason: r?.reason || 'rest failed' };
    }
    return { type: 'rest', success: true, ...r.event };
  } catch (e) {
    console.error('[restTimeService] REST handler failed:', e.message);
    return null;
  }
});

export default {
  advanceClockForSession, advanceTimeForSession, applyRest, applyDowntimeRest,
  formatTimeEventBlock, sessionEndDays, spendHitDice, hitDiceRegain,
  parseDicePool, totalDice, LONG_REST_HOURS, SHORT_REST_HOURS
};
