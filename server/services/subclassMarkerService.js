/**
 * Subclass Marker Service — Family 8, C-kind marker pattern + first slice.
 *
 * The proven pattern (design §3.8, from RAGE / INSPIRATION /
 * SECOND_WIND / LAY_ON_HANDS in classFeatureService.js): schema in
 * markerSchemas.js → handler registered at module load via
 * markerPipeline.registerHandler → this module imported for side effect
 * in routes/dmSession.js → handler checks turn identity
 * (turnLedgerService.checkTurnIdentity), charges the ledger
 * (spendBonus where applicable), spends the pool (spendResource),
 * records the effect. A C feature with no handler stays a validated
 * schema (correction-loop feedback only) — the legitimate interim state.
 *
 * First slice (D1 — dependency order, not alphabet; design §3.8):
 *   1. Bend Luck — spends the existing Sorcery Points pool.
 *   2. Tides of Chaos — forced Wild Magic trigger; calls the spell-cast
 *      family's hook (Family 5 consumes the armed state via
 *      isTidesOfChaosSpent / restoreTidesOfChaos below).
 *   3. Preserve Life — spends Channel Divinity; pool = 5 × cleric level
 *      (lifePreserveLifePool), split as the DM directs.
 *   4. Tamed Surge — spends the surge, chooses a row except the final
 *      row (Amendment 1 §1: "except the final row (97–00, Boon)").
 *   5. Telepathic Speech / Awakened Mind — C reclassification per
 *      Amendment 2 §2 #20/#22 (bonus-action marker + link record).
 *      No attunement-family HANDOFF.md existed when this was staged,
 *      so these are implemented from Amendment 2 directly; see NOTES.md.
 *   6. Kind-C creature shells (Amendment 2 §4 #14): Hound of Ill Omen,
 *      Accursed Specter, Faithful Summons — the C shell spends the
 *      resource (and the once-per-Long-Rest gate); the creature itself
 *      is a combat_allies row from entityService.js.
 *
 * The rest of the 229-feature C queue is a follow-up, not smuggled in
 * here. Nothing below wires a C feature before the pool or hook it
 * spends exists.
 *
 * Gate order in every handler (classFeatureService precedent): identity
 * / bonus gates FIRST, then the pool spend, then the effect — a refused
 * action consumes nothing. Reactions (Bend Luck) skip the identity
 * gate: they fire on another creature's roll. Preserve Life costs a
 * Magic action; the turn ledger has no generic action-spend API, so it
 * takes the identity gate only (no action-budget charge exists to call
 * — recorded in NOTES.md as a ledger follow-up, not invented here).
 *
 * PC vs companion split (binding): companion numbers land in real
 * totals (healing applied, points spent). A PC's reported totals are
 * never touched — Bend Luck's d4 and Tides' advantage are recorded
 * facts the DM applies to the pending roll; the roll-application hook
 * into rollRequestService is a named follow-up (see HANDOFF.md).
 *
 * Staged from cached mirror copies, not verified live (see NOTES.md).
 * The push step re-verifies live bytes first.
 */

import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { findCompanionIdByName, hasIncapacitatingCondition } from './conditionService.js';
import { spendResource, getClassResources, resourceMaxima } from './classFeatureService.js';
import { requestHeroicReroll } from './rollRequestService.js';
import { lifePreserveLifePool, featuresAtLevel, bendLuckDie } from './subclassService.js';
import { SORCERER_SUBCLASSES } from '../data/subclasses/sorcerer.js';
import {
  createHoundOfIllOmen, createAccursedSpecter, createFaithfulBeast,
  validateFaithfulBeast, resolveOwnerZone,
} from './entityService.js';

// ---------------------------------------------------------------------------
// Shared helpers (classFeatureService pattern; its copies are not exported)
// ---------------------------------------------------------------------------

const TABLE = { player: 'characters', companion: 'companions' };
const CLASS_COL = { player: 'class', companion: 'companion_class' };
const SUBCLASS_COL = { player: 'subclass', companion: 'companion_subclass' };
const LEVEL_COL = { player: 'level', companion: 'companion_level' };
const ABILITY_COL = { player: 'ability_scores', companion: 'companion_ability_scores' };
const HP_COL = { player: 'current_hp', companion: 'companion_current_hp' };
const MAX_HP_COL = { player: 'max_hp', companion: 'companion_max_hp' };

async function resolveTarget(context, targetRaw) {
  const character = await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId]);
  const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
    (character && targetRaw.toLowerCase() === String(character.name).toLowerCase());
  if (isPc) return { kind: 'player', id: context.characterId, name: character?.name || 'Player' };
  const compId = await findCompanionIdByName(context.characterId, targetRaw);
  if (!compId) return null;
  return { kind: 'companion', id: compId, name: targetRaw };
}

async function readActorRow(kind, id) {
  if (kind === 'player') return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
  const row = await dbGet(
    'SELECT c.*, n.name AS npc_name FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?',
    [id],
  );
  return row || null;
}

function actorName(kind, row) {
  if (!row) return 'Unknown';
  return kind === 'player' ? (row.name || 'Player') : (row.npc_name || row.name || 'Companion');
}

/** True when the actor's subclass grants the named feature at their level. */
function hasSubclassFeature(kind, row, key) {
  if (!row) return false;
  return featuresAtLevel(
    row[CLASS_COL[kind]], row[SUBCLASS_COL[kind]], row[LEVEL_COL[kind]],
  ).some((f) => f.key === key);
}

export function abilityModForRow(row, kind, abilityKey) {
  const scores = typeof row[ABILITY_COL[kind]] === 'string'
    ? safeParse(row[ABILITY_COL[kind]], {}) : (row[ABILITY_COL[kind]] || {});
  return Math.floor((Number(scores[abilityKey] ?? 10) - 10) / 2);
}

/** Identity + bonus gate, before any spend (classFeatureService.bonusGate pattern). */
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

/** Identity-only gate (Magic-action features: no generic action-spend API exists in the ledger). */
async function identityGate(context, target) {
  if (!context?.sessionId) return null;
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const { ledgerKeyForTarget, checkTurnIdentity } = await import('./turnLedgerService.js');
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (!encounterSeq) return null;
    const identity = await checkTurnIdentity(
      context.sessionId, encounterSeq, await ledgerKeyForTarget(target.kind, target.id));
    if (!identity.allowed) return `${identity.reason} ${identity.remedy}`;
    return null;
  } catch { return null; }
}

// Raw class_resources_json read/write (own-parse: parseClassResources
// strips unknown top-level keys — the Artificer precedent). Tides /
// Tamed Surge / telepathic links / once-per-Long-Rest flags live here.
async function readResourcesRaw(kind, id) {
  const row = await dbGet(`SELECT class_resources_json FROM ${TABLE[kind]} WHERE id = ?`, [id]);
  if (!row) return null;
  const parsed = typeof row.class_resources_json === 'string'
    ? safeParse(row.class_resources_json, {}) : (row.class_resources_json || {});
  return { row, raw: parsed && typeof parsed === 'object' ? parsed : {} };
}

async function writeResourcesRaw(kind, id, raw) {
  await dbRun(`UPDATE ${TABLE[kind]} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(raw), id]);
}

/** Spend n of a base pool, pre-checked so a mid-loop failure cannot happen on a live row. */
async function spendPoolUnits(kind, id, key, n) {
  const got = await getClassResources(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  const maxima = resourceMaxima({
    className: got.row[CLASS_COL[kind]],
    level: got.row[LEVEL_COL[kind]],
    abilityScores: got.row[ABILITY_COL[kind]],
  });
  const max = maxima[key];
  if (max == null) return { success: false, reason: `${key} is not modeled for this class` };
  const used = Number(got.resources.used[key] || 0);
  if (used + n > max) {
    return { success: false, reason: `not enough ${key} left (${used}/${max}, needs ${n})`, used, max };
  }
  let last = null;
  for (let i = 0; i < n; i++) {
    last = await spendResource(kind, id, key);
    if (!last.success) return last;
  }
  return { success: true, used: last.used, max };
}

// ---------------------------------------------------------------------------
// Wild Magic surge table (registry data — the Tamed Surge choice surface)
// ---------------------------------------------------------------------------

function surgeEntries() {
  // Subclass key is 'wild_magic_sorcery' (not 'wild_magic'); find the
  // feature by its own key so a subclass rename cannot silently empty
  // the table.
  for (const sub of SORCERER_SUBCLASSES || []) {
    const feat = (sub?.features || []).find((f) => f.key === 'wild_magic_surge');
    if (feat?.mechanics?.surgeTable?.entries) return feat.mechanics.surgeTable.entries;
  }
  return [];
}

/** Normalize "05–08" / "05-08" / "5-8" → "05-08" for comparison. */
export function normalizeSurgeRange(raw) {
  const m = String(raw || '').trim().replace(/[–—]/g, '-').match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
  if (!m) return null;
  return `${String(Number(m[1])).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
}

export function surgeEntryForRange(raw) {
  const want = normalizeSurgeRange(raw);
  if (!want) return null;
  return surgeEntries().find((e) => normalizeSurgeRange(e.range) === want) || null;
}

/** Amendment 1 §1: Tamed Surge chooses any effect EXCEPT the final row (97–00, Boon). */
export function isFinalSurgeRow(raw) {
  return normalizeSurgeRange(raw) === '97-00';
}

// ---------------------------------------------------------------------------
// Tides of Chaos state (Family 5 consumes; Family 7 restores)
// ---------------------------------------------------------------------------

export async function getTidesOfChaosState(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return null;
  return got.raw.tidesOfChaos || { used: false, advantagePending: false };
}

export async function isTidesOfChaosSpent(kind, id) {
  const state = await getTidesOfChaosState(kind, id);
  return !!state?.used;
}

/** Family 5: a slotted Sorcerer spell cast while Tides is spent auto-rolls the surge and restores it. */
export async function restoreTidesOfChaos(kind, id, reason = 'long rest') {
  const got = await readResourcesRaw(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  got.raw.tidesOfChaos = { used: false, advantagePending: false, restoredBy: reason };
  await writeResourcesRaw(kind, id, got.raw);
  return { success: true };
}

/** Roll-path follow-up: consume the granted advantage on the sorcerer's next d20 Test. */
export async function consumeTidesAdvantage(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got || !got.raw.tidesOfChaos?.advantagePending) return false;
  got.raw.tidesOfChaos.advantagePending = false;
  await writeResourcesRaw(kind, id, got.raw);
  return true;
}

// ---------------------------------------------------------------------------
// Tamed Surge / once-per-Long-Rest state (Family 5 consumes; Family 7 restores)
// ---------------------------------------------------------------------------

export async function pendingTamedSurgeChoice(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return null;
  return got.raw.tamedSurge?.pendingChoice || null;
}

export async function consumePendingTamedSurge(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got || !got.raw.tamedSurge?.pendingChoice) return null;
  const choice = got.raw.tamedSurge.pendingChoice;
  got.raw.tamedSurge.pendingChoice = null;
  await writeResourcesRaw(kind, id, got.raw);
  return choice;
}

export async function restoreTamedSurgeOnLongRest(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  got.raw.tamedSurge = { used: false, pendingChoice: null };
  await writeResourcesRaw(kind, id, got.raw);
  return { success: true };
}

async function oncePerLongRestUsed(kind, id, key) {
  const got = await readResourcesRaw(kind, id);
  return !!got?.raw?.[key]?.used;
}

async function markOncePerLongRestUsed(kind, id, key) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return;
  got.raw[key] = { used: true, usedAt: new Date().toISOString() };
  await writeResourcesRaw(kind, id, got.raw);
}

export async function restoreOncePerLongRest(kind, id, key) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  got.raw[key] = { used: false };
  await writeResourcesRaw(kind, id, got.raw);
  return { success: true };
}

// ---------------------------------------------------------------------------
// Telepathic links (Amendment 2 §2 #20/#22)
// ---------------------------------------------------------------------------

export function telepathicLinkExpired(link, nowMs = Date.now()) {
  if (!link || link.durationMinutes == null || !link.startedAt) return false;
  return Date.parse(link.startedAt) + Number(link.durationMinutes) * 60000 <= nowMs;
}

async function readTelepathicLinks(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return null;
  return { got, links: Array.isArray(got.raw.telepathicLinks) ? got.raw.telepathicLinks : [] };
}

// ---------------------------------------------------------------------------
// Preserve Life allocation validation (pure + live-HP, before any spend)
// ---------------------------------------------------------------------------

export function parsePreserveLifeAllocations(raw) {
  if (!raw || typeof raw !== 'string') return { error: 'PRESERVE_LIFE needs Allocations= (e.g. Allocations="Mira=10, Bram=8")' };
  const out = [];
  for (const part of raw.split(',')) {
    const [nameRaw, amountRaw] = part.split('=');
    const name = String(nameRaw || '').trim();
    const amount = Number(String(amountRaw || '').trim());
    if (!name) return { error: `bad allocation segment: "${part}" (expected Name=hp)` };
    if (!Number.isInteger(amount) || amount < 1) {
      return { error: `bad allocation amount for ${name}: "${amountRaw}" (expected a whole number of 1 or more)` };
    }
    out.push({ name, amount });
  }
  if (out.length === 0) return { error: 'PRESERVE_LIFE needs at least one allocation' };
  return { allocations: out };
}

async function applyHealToTarget(kind, id, amount) {
  if (kind === 'player') {
    const { applyHpChange } = await import('./characterHpService.js');
    const res = await applyHpChange(id, amount, 'preserve life');
    return res ? { applied: amount } : { applied: 0 };
  }
  await dbRun(
    'UPDATE companions SET companion_current_hp = MIN(companion_max_hp, companion_current_hp + ?) WHERE id = ?',
    [amount, id],
  );
  return { applied: amount };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// D4 Heroic Inspiration reroll (Family 6, merge-applied): spends the
// held pool and re-issues the SAME pending d20 roll; the new roll
// stands even if lower. One reroll per roll, enforced inside
// requestHeroicReroll. Companion branch is DM-triggered via the
// Target= name (re-runs the companion roll with rerollWithHeroic).
registerMarkerHandler('HEROIC_REROLL', async (parsed, context) => {
  const target = String(parsed.fields?.Target || '').trim();
  try {
    const result = await requestHeroicReroll(context.sessionId, null, target || undefined);
    if (!result?.success) {
      return { ok: false, reason: result?.reason || 'no_heroic_inspiration', systemNote: `Heroic Inspiration reroll refused: ${result?.reason || 'no Heroic Inspiration held'}.` };
    }
    return { ok: true, systemNote: 'Heroic Inspiration spent — roll again; the new roll stands.' };
  } catch (e) {
    return { ok: false, reason: 'handler_error', systemNote: `Heroic Inspiration reroll failed: ${e?.message || e}.` };
  }
});

registerMarkerHandler('BEND_LUCK', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const rollLabel = String(parsed?.Roll || '').trim();
    const direction = String(parsed?.Direction || '').trim().toLowerCase();
    if (!targetRaw) return { type: 'bend_luck', success: false, reason: 'BEND_LUCK needs Target=' };
    if (!rollLabel) return { type: 'bend_luck', success: false, reason: 'BEND_LUCK needs Roll= (the d20 Test being modified)' };
    if (direction !== 'bonus' && direction !== 'penalty') {
      return { type: 'bend_luck', success: false, reason: 'BEND_LUCK needs Direction=bonus or Direction=penalty' };
    }
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'bend_luck', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'sorcerer') {
      return { type: 'bend_luck', success: false, reason: `${target.name} is not a sorcerer` };
    }
    if (!hasSubclassFeature(target.kind, row, 'bend_luck')) {
      return { type: 'bend_luck', success: false, reason: `${target.name} does not have Bend Luck (Wild Magic Sorcerer 6)` };
    }
    // Reaction: fires on another creature's roll, so no turn-identity
    // gate and no bonus charge. Incapacitation still bars a reaction.
    if (await hasIncapacitatingCondition(target.kind, target.id)) {
      return { type: 'bend_luck', success: false, reason: `${target.name} is incapacitated and cannot take reactions` };
    }
    const spent = await spendPoolUnits(target.kind, target.id, 'sorcery', 1);
    if (!spent.success) return { type: 'bend_luck', success: false, reason: spent.reason };
    const die = bendLuckDie();
    const rolled = roll(4, 1, { reason: 'bend luck' });
    return {
      type: 'bend_luck', success: true, target: target.name, roll: rollLabel,
      direction, die: rolled.rolls[0], amount: rolled.total, dice: die.dice,
      sorceryUsed: spent.used, sorceryMax: spent.max,
      note: `Apply ${direction === 'bonus' ? '+' : '−'}${rolled.total} to the ${rollLabel} d20 Test total. The DM applies it to the pending roll — the system never rewrites a reported total.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] BEND_LUCK handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('TIDES_OF_CHAOS', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'tides_of_chaos', success: false, reason: 'TIDES_OF_CHAOS needs Target=' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'tides_of_chaos', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'sorcerer') {
      return { type: 'tides_of_chaos', success: false, reason: `${target.name} is not a sorcerer` };
    }
    if (!hasSubclassFeature(target.kind, row, 'tides_of_chaos')) {
      return { type: 'tides_of_chaos', success: false, reason: `${target.name} does not have Tides of Chaos (Wild Magic Sorcerer 3)` };
    }
    // Declared before a d20 Test, on any turn — no identity gate.
    const state = await getTidesOfChaosState(target.kind, target.id);
    if (state?.used) {
      return { type: 'tides_of_chaos', success: false, reason: 'Tides of Chaos is spent — cast a Sorcerer spell with a spell slot (the automatic surge restores it) or finish a Long Rest' };
    }
    const got = await readResourcesRaw(target.kind, target.id);
    got.raw.tidesOfChaos = { used: true, advantagePending: true, grantedAt: new Date().toISOString() };
    await writeResourcesRaw(target.kind, target.id, got.raw);
    return {
      type: 'tides_of_chaos', success: true, target: target.name, advantage: true,
      note: `${target.name} has advantage on one d20 Test (their next roll). Tides of Chaos is spent until a slotted Sorcerer spell is cast (automatic Wild Magic Surge, then restored) or a Long Rest is finished.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] TIDES_OF_CHAOS handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('PRESERVE_LIFE', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'preserve_life', success: false, reason: 'PRESERVE_LIFE needs Target= (the Life Cleric)' };
    const cleric = await resolveTarget(context, targetRaw);
    if (!cleric) return { type: 'preserve_life', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(cleric.kind, cleric.id);
    if (String(row?.[CLASS_COL[cleric.kind]] || '').toLowerCase().trim() !== 'cleric') {
      return { type: 'preserve_life', success: false, reason: `${cleric.name} is not a cleric` };
    }
    if (!hasSubclassFeature(cleric.kind, row, 'preserve_life')) {
      return { type: 'preserve_life', success: false, reason: `${cleric.name} does not have Preserve Life (Life Cleric 3)` };
    }
    if (await hasIncapacitatingCondition(cleric.kind, cleric.id)) {
      return { type: 'preserve_life', success: false, reason: `${cleric.name} is incapacitated and cannot take actions` };
    }
    // Magic action: identity gate only — the ledger has no generic
    // action-spend API to charge (recorded follow-up, not invented).
    const blocked = await identityGate(context, cleric);
    if (blocked) return { type: 'preserve_life', success: false, reason: blocked };
    const parsedAlloc = parsePreserveLifeAllocations(parsed?.Allocations);
    if (parsedAlloc.error) return { type: 'preserve_life', success: false, reason: parsedAlloc.error };
    const level = Number(row[LEVEL_COL[cleric.kind]] || 1);
    const pool = lifePreserveLifePool(level);
    const total = parsedAlloc.allocations.reduce((s, a) => s + a.amount, 0);
    if (total > pool) {
      return { type: 'preserve_life', success: false, reason: `allocations total ${total} but Preserve Life heals ${pool} (5 × Cleric level ${level})` };
    }
    // Validate every recipient BEFORE spending: bloodied-only, and no
    // creature restored above half its Hit Point maximum.
    const recipients = [];
    for (const a of parsedAlloc.allocations) {
      const t = await resolveTarget(context, a.name);
      if (!t) return { type: 'preserve_life', success: false, reason: `unknown recipient: ${a.name}` };
      const tRow = await readActorRow(t.kind, t.id);
      if (!tRow) return { type: 'preserve_life', success: false, reason: `unknown recipient: ${a.name}` };
      const cur = Number(tRow[HP_COL[t.kind]] || 0);
      const max = Number(tRow[MAX_HP_COL[t.kind]] || 0);
      if (!max) return { type: 'preserve_life', success: false, reason: `${actorName(t.kind, tRow)} has no Hit Point maximum recorded` };
      const half = Math.floor(max / 2);
      if (cur > half) {
        return { type: 'preserve_life', success: false, reason: `${actorName(t.kind, tRow)} is not Bloodied (${cur}/${max}) — Preserve Life heals Bloodied creatures only` };
      }
      if (cur + a.amount > half) {
        return { type: 'preserve_life', success: false, reason: `${a.amount} to ${actorName(t.kind, tRow)} would restore above half maximum (${cur} + ${a.amount} > ${half})` };
      }
      recipients.push({ ...t, row: tRow, amount: a.amount });
    }
    const spent = await spendPoolUnits(cleric.kind, cleric.id, 'channelDivinity', 1);
    if (!spent.success) return { type: 'preserve_life', success: false, reason: spent.reason };
    const healed = [];
    for (const r of recipients) {
      await applyHealToTarget(r.kind, r.id, r.amount);
      healed.push({ name: actorName(r.kind, r.row), healed: r.amount });
    }
    return {
      type: 'preserve_life', success: true, target: cleric.name,
      pool, spent: total, healed, channelDivinityUsed: spent.used, channelDivinityMax: spent.max,
    };
  } catch (e) {
    console.error('[subclassMarkerService] PRESERVE_LIFE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('TAMED_SURGE', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const rowRaw = String(parsed?.Row || '').trim();
    if (!targetRaw) return { type: 'tamed_surge', success: false, reason: 'TAMED_SURGE needs Target=' };
    if (!rowRaw) return { type: 'tamed_surge', success: false, reason: 'TAMED_SURGE needs Row= (a d100 range, e.g. Row="05-08")' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'tamed_surge', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'sorcerer') {
      return { type: 'tamed_surge', success: false, reason: `${target.name} is not a sorcerer` };
    }
    if (!hasSubclassFeature(target.kind, row, 'tamed_surge')) {
      return { type: 'tamed_surge', success: false, reason: `${target.name} does not have Tamed Surge (Wild Magic Sorcerer 18)` };
    }
    // Declared when a surge would be rolled — not turn-bound, no gate.
    const got = await readResourcesRaw(target.kind, target.id);
    if (got.raw.tamedSurge?.used) {
      return { type: 'tamed_surge', success: false, reason: 'Tamed Surge is spent — once per Long Rest' };
    }
    if (isFinalSurgeRow(rowRaw)) {
      return { type: 'tamed_surge', success: false, reason: 'Tamed Surge cannot choose the final row (97–00, Boon) — the book excludes it' };
    }
    const entry = surgeEntryForRange(rowRaw);
    if (!entry) {
      return { type: 'tamed_surge', success: false, reason: `no Wild Magic Surge row ${rowRaw} — ranges are 01–04 … 97–00` };
    }
    got.raw.tamedSurge = {
      used: true, usedAt: new Date().toISOString(),
      pendingChoice: { range: normalizeSurgeRange(rowRaw), name: entry.name },
    };
    await writeResourcesRaw(target.kind, target.id, got.raw);
    return {
      type: 'tamed_surge', success: true, target: target.name,
      chosenRange: normalizeSurgeRange(rowRaw), chosenRow: entry.name,
      note: `The surge resolves as ${entry.name} (${entry.range}) instead of rolling. Family 5's surge dispatcher consumes this choice; if the row involves a roll, it is still rolled.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] TAMED_SURGE handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('TELEPATHIC_SPEECH', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const creature = String(parsed?.Creature || '').trim();
    if (!targetRaw) return { type: 'telepathic_speech', success: false, reason: 'TELEPATHIC_SPEECH needs Target= (the Aberrant Sorcerer)' };
    if (!creature) return { type: 'telepathic_speech', success: false, reason: 'TELEPATHIC_SPEECH needs Creature= (one creature you can see within 30 feet)' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'telepathic_speech', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'sorcerer') {
      return { type: 'telepathic_speech', success: false, reason: `${target.name} is not a sorcerer` };
    }
    if (!hasSubclassFeature(target.kind, row, 'telepathic_speech')) {
      return { type: 'telepathic_speech', success: false, reason: `${target.name} does not have Telepathic Speech (Aberrant Sorcerer 3)` };
    }
    if (await hasIncapacitatingCondition(target.kind, target.id)) {
      return { type: 'telepathic_speech', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    }
    const blocked = await bonusGate(context, target);
    if (blocked) return { type: 'telepathic_speech', success: false, reason: blocked };
    const rangeMiles = Math.max(1, abilityModForRow(row, target.kind, 'cha'));
    const { got, links } = await readTelepathicLinks(target.kind, target.id);
    const existing = links.find((l) => l.kind === 'telepathic_speech' && l.target.toLowerCase() === creature.toLowerCase());
    if (!existing) {
      links.push({ kind: 'telepathic_speech', target: creature, rangeMiles, startedAt: new Date().toISOString(), durationMinutes: null });
      got.raw.telepathicLinks = links;
      await writeResourcesRaw(target.kind, target.id, got.raw);
    }
    await spendBonusFor(context, target, 'Telepathic Speech');
    return {
      type: 'telepathic_speech', success: true, target: target.name, creature,
      rangeMiles, note: `${target.name} and ${creature} can communicate telepathically while within ${rangeMiles} mile(s) of each other. The communication itself stays free-form.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] TELEPATHIC_SPEECH handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('AWAKENED_MIND', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const creature = String(parsed?.Creature || '').trim();
    if (!targetRaw) return { type: 'awakened_mind', success: false, reason: 'AWAKENED_MIND needs Target= (the Great Old One Warlock)' };
    if (!creature) return { type: 'awakened_mind', success: false, reason: 'AWAKENED_MIND needs Creature= (one creature you can see)' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'awakened_mind', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'warlock') {
      return { type: 'awakened_mind', success: false, reason: `${target.name} is not a warlock` };
    }
    if (!hasSubclassFeature(target.kind, row, 'awakened_mind')) {
      return { type: 'awakened_mind', success: false, reason: `${target.name} does not have Awakened Mind (Great Old One Warlock 3)` };
    }
    if (await hasIncapacitatingCondition(target.kind, target.id)) {
      return { type: 'awakened_mind', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    }
    const blocked = await bonusGate(context, target);
    if (blocked) return { type: 'awakened_mind', success: false, reason: blocked };
    const level = Number(row[LEVEL_COL[target.kind]] || 1);
    const rangeMiles = Math.max(1, abilityModForRow(row, target.kind, 'cha'));
    const durationMinutes = level;
    const { got, links } = await readTelepathicLinks(target.kind, target.id);
    // One connection at a time: a new connection ends the old one.
    const kept = links.filter((l) => l.kind !== 'awakened_mind');
    kept.push({
      kind: 'awakened_mind', target: creature, rangeMiles,
      durationMinutes, startedAt: new Date().toISOString(),
      languageNote: 'you must mentally use a language the other creature knows (DM-attested)',
    });
    got.raw.telepathicLinks = kept;
    await writeResourcesRaw(target.kind, target.id, got.raw);
    await spendBonusFor(context, target, 'Awakened Mind');
    return {
      type: 'awakened_mind', success: true, target: target.name, creature,
      rangeMiles, durationMinutes,
      note: `${target.name} and ${creature} can communicate telepathically for ${durationMinutes} minute(s) while within ${rangeMiles} mile(s). Connecting to a different creature ends this connection.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] AWAKENED_MIND handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('HOUND_OF_ILL_OMEN', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const creature = String(parsed?.Creature || '').trim();
    if (!targetRaw) return { type: 'hound_of_ill_omen', success: false, reason: 'HOUND_OF_ILL_OMEN needs Target= (the Shadow Sorcerer)' };
    if (!creature) return { type: 'hound_of_ill_omen', success: false, reason: 'HOUND_OF_ILL_OMEN needs Creature= (one creature you can see within 120 feet)' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'hound_of_ill_omen', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'sorcerer') {
      return { type: 'hound_of_ill_omen', success: false, reason: `${target.name} is not a sorcerer` };
    }
    if (!hasSubclassFeature(target.kind, row, 'hound_of_ill_omen')) {
      return { type: 'hound_of_ill_omen', success: false, reason: `${target.name} does not have Hound of Ill Omen (Shadow Sorcerer 6)` };
    }
    if (await hasIncapacitatingCondition(target.kind, target.id)) {
      return { type: 'hound_of_ill_omen', success: false, reason: `${target.name} is incapacitated and cannot take actions` };
    }
    const blocked = await bonusGate(context, target);
    if (blocked) return { type: 'hound_of_ill_omen', success: false, reason: blocked };
    const level = Number(row[LEVEL_COL[target.kind]] || 1);
    const spent = await spendPoolUnits(target.kind, target.id, 'sorcery', 3);
    if (!spent.success) return { type: 'hound_of_ill_omen', success: false, reason: spent.reason };
    let encounterSeq = null;
    if (context.sessionId) {
      try {
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        encounterSeq = await getCurrentEncounterSeq(context.sessionId);
      } catch { encounterSeq = null; }
    }
    if (!encounterSeq) {
      return { type: 'hound_of_ill_omen', success: false, reason: 'Hound of Ill Omen needs an active combat (no encounter in this session)' };
    }
    const zone = await resolveOwnerZone(context.sessionId, encounterSeq, target.kind, target.id);
    const created = await createHoundOfIllOmen(
      context.sessionId, encounterSeq,
      { kind: target.kind, id: target.id, name: target.name },
      { targetName: creature, sorcererLevel: level, zone },
    );
    if (!created.success) return { type: 'hound_of_ill_omen', success: false, reason: created.reason };
    await spendBonusFor(context, target, 'Hound of Ill Omen');
    return {
      type: 'hound_of_ill_omen', success: true, target: target.name, creature,
      allyId: created.ally.id, allyName: created.ally.name,
      tempHp: created.ally.tempHp, sorceryUsed: spent.used, sorceryMax: spent.max,
      note: `The hound appears within 30 feet of ${creature} and hunts it for 5 minutes. While within 5 feet of ${creature}, ${creature} has disadvantage on saving throws against spells ${target.name} casts. The hound rolls its own initiative (turn-order insertion is a follow-up — see NOTES.md).`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] HOUND_OF_ILL_OMEN handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('ACCURSED_SPECTER', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const slain = String(parsed?.Slain || '').trim() || null;
    if (!targetRaw) return { type: 'accursed_specter', success: false, reason: 'ACCURSED_SPECTER needs Target= (the Hexblade Warlock)' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'accursed_specter', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'warlock') {
      return { type: 'accursed_specter', success: false, reason: `${target.name} is not a warlock` };
    }
    if (!hasSubclassFeature(target.kind, row, 'accursed_specter')) {
      return { type: 'accursed_specter', success: false, reason: `${target.name} does not have Accursed Specter (Hexblade Warlock 6)` };
    }
    // Triggered by slaying a humanoid — no action, no identity gate.
    if (await oncePerLongRestUsed(target.kind, target.id, 'accursedSpecterUsed')) {
      return { type: 'accursed_specter', success: false, reason: 'Accursed Specter is spent — once per Long Rest' };
    }
    const level = Number(row[LEVEL_COL[target.kind]] || 1);
    const chaMod = abilityModForRow(row, target.kind, 'cha');
    let encounterSeq = null;
    if (context.sessionId) {
      try {
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        encounterSeq = await getCurrentEncounterSeq(context.sessionId);
      } catch { encounterSeq = null; }
    }
    if (!encounterSeq) {
      return { type: 'accursed_specter', success: false, reason: 'Accursed Specter needs an active combat (no encounter in this session)' };
    }
    const created = await createAccursedSpecter(
      context.sessionId, encounterSeq,
      { kind: target.kind, id: target.id, name: target.name },
      { warlockLevel: level, chaMod, slainName: slain },
    );
    if (!created.success) return { type: 'accursed_specter', success: false, reason: created.reason };
    await markOncePerLongRestUsed(target.kind, target.id, 'accursedSpecterUsed');
    return {
      type: 'accursed_specter', success: true, target: target.name,
      allyId: created.ally.id, allyName: created.ally.name, tempHp: created.ally.tempHp,
      note: `The specter serves until the end of ${target.name}'s next Long Rest and rolls its own initiative.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] ACCURSED_SPECTER handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('FAITHFUL_SUMMONS', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const beastsRaw = String(parsed?.Beasts || '').trim();
    if (!targetRaw) return { type: 'faithful_summons', success: false, reason: 'FAITHFUL_SUMMONS needs Target= (the Shepherd Druid)' };
    if (!beastsRaw) return { type: 'faithful_summons', success: false, reason: 'FAITHFUL_SUMMONS needs Beasts= (up to four beasts, CR 2 or lower, comma-separated)' };
    const target = await resolveTarget(context, targetRaw);
    if (!target) return { type: 'faithful_summons', success: false, reason: `unknown target: ${targetRaw}` };
    const row = await readActorRow(target.kind, target.id);
    if (String(row?.[CLASS_COL[target.kind]] || '').toLowerCase().trim() !== 'druid') {
      return { type: 'faithful_summons', success: false, reason: `${target.name} is not a druid` };
    }
    if (!hasSubclassFeature(target.kind, row, 'faithful_summons')) {
      return { type: 'faithful_summons', success: false, reason: `${target.name} does not have Faithful Summons (Shepherd Druid 14)` };
    }
    // Triggered at 0 HP / involuntary incapacitation — no action, no identity gate.
    if (await oncePerLongRestUsed(target.kind, target.id, 'faithfulSummonsUsed')) {
      return { type: 'faithful_summons', success: false, reason: 'Faithful Summons is spent — once per Long Rest' };
    }
    const names = beastsRaw.split(',').map((s) => s.trim()).filter(Boolean);
    if (names.length < 1 || names.length > 4) {
      return { type: 'faithful_summons', success: false, reason: `Faithful Summons summons one to four beasts — got ${names.length}` };
    }
    // Validate every beast BEFORE creating any row.
    for (const n of names) {
      const v = await validateFaithfulBeast(n);
      if (!v.success) return { type: 'faithful_summons', success: false, reason: v.reason };
    }
    let encounterSeq = null;
    if (context.sessionId) {
      try {
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        encounterSeq = await getCurrentEncounterSeq(context.sessionId);
      } catch { encounterSeq = null; }
    }
    if (!encounterSeq) {
      return { type: 'faithful_summons', success: false, reason: 'Faithful Summons needs an active combat (no encounter in this session)' };
    }
    const created = [];
    for (const n of names) {
      const res = await createFaithfulBeast(
        context.sessionId, encounterSeq,
        { kind: target.kind, id: target.id, name: target.name },
        { beastName: n },
      );
      if (!res.success) return { type: 'faithful_summons', success: false, reason: res.reason, created: created.map((c) => c.ally.id) };
      created.push(res);
    }
    await markOncePerLongRestUsed(target.kind, target.id, 'faithfulSummonsUsed');
    return {
      type: 'faithful_summons', success: true, target: target.name,
      allies: created.map((c) => ({ id: c.ally.id, name: c.ally.name })),
      note: `Four beasts (as Conjure Animals from a 9th-level slot) protect ${target.name} for 1 hour, no concentration. Dismiss with no action.`,
    };
  } catch (e) {
    console.error('[subclassMarkerService] FAITHFUL_SUMMONS handler failed:', e.message);
    return null;
  }
});

export default {
  normalizeSurgeRange, surgeEntryForRange, isFinalSurgeRow,
  abilityModForRow, parsePreserveLifeAllocations,
  getTidesOfChaosState, isTidesOfChaosSpent, restoreTidesOfChaos, consumeTidesAdvantage,
  pendingTamedSurgeChoice, consumePendingTamedSurge, restoreTamedSurgeOnLongRest,
  restoreOncePerLongRest, telepathicLinkExpired,
};
