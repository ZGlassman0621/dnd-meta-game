/**
 * Perception pre-roll service — banked Perception at the dungeon door.
 *
 * Design: perception-pre-roll-design.md (decided with Zach, 2026-11-05).
 * Approved shape: one Perception roll per character at the dungeon door,
 * banked; the DM reads the stored numbers in secret at a trap, a secret
 * door, or a stealthed enemy; a used number is replaced (the PC's by their
 * own next door spare, a companion's by a fresh engine roll);
 * higher of the roll or passive Perception counts.
 *
 * How it fits the existing machinery:
 *   - The PC's door roll rides the normal pending-roll channel: a pending
 *     with bank:'perception' and NO dc. The route branches to
 *     resolveBankRoll() instead of resolveReportedRoll() for it.
 *   - Companion door rolls are server-rolled with rollD20, like every
 *     other companion roll (rollForNpc) — but NOT through rollForNpc
 *     itself, which would stash the die as a ROLL RESULT fact and tell
 *     the DM the number.
 *   - A USE is judged with resolveDice on the STORED die (nat 1 never
 *     succeeds, nat 20 always succeeds — the same crit rules as a live
 *     roll), then the passive floor applies: otherwise the effective
 *     total is max(banked total, passive). Crits judge the die first, so
 *     a stored nat 1 fails even when passive would have passed.
 *   - Outcomes ride the existing recentRolls channel (consumed next turn
 *     as a system fact), formatted by formatPerceptionUseBlock, not
 *     formatRollOutcomeBlock (which would print a DC-less roll wrongly).
 *   - The bank itself is visible to the DM every turn as a suffix block
 *     (formatActiveBankBlock) listing covered actors — WITHOUT the
 *     numbers. The DM never needs the numbers and cannot leak what it
 *     cannot see; a USE fact reveals the spent number only.
 *   - Bank creation and replacement are logged to roll_log with outcome
 *     'banked' (new value; nothing switches on outcome — only inserts
 *     and test asserts read it). A USE logs outcome success/failure/
 *     critical_* with source 'banked'.
 *
 * Coordinator decisions (flagged for Zach's veto at the gate):
 *   - The PC's replacements are the player's own spares, rolled at the
 *     door with the banked number (PERCEPTION_BANK_DICE; Muse,
 *     2026-11-23) — never server-rolled, never asked mid-dungeon (that
 *     request IS the tell being removed). Spares gone → passive until the
 *     next dungeon door. Companion replacements stay server-rolled.
 *   - The banked modifier is the EFFECTIVE modifier at the door (sheet +
 *     exhaustion/condition penalty, mirroring requestPcRoll); a
 *     replacement reuses the stored modifier — the bank is a snapshot.
 *   - Secret-door DC is 15 in v1 (no DC is stored on hidden exits).
 *   - Active search (player declares "I search") still uses SEARCH /
 *     ROLL_REQUEST. The pre-roll covers only the hidden layer.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { rollD20 } from '../utils/rng.js';
import {
  resolveDice, getPcCheckModifier, getNpcCheckModifier,
  getPendingRoll, logRoll, resolveCheckParty
} from './rollRequestService.js';
import { getConditions, conditionRollEffects, findCompanionIdByName } from './conditionService.js';

export const PERCEPTION_USE_TRIGGERS = ['trap', 'secret_door', 'stealthed_enemy'];

/** The DC for a secret door in v1 — hidden exits carry no stored DC. */
export const SECRET_DOOR_DC = 15;

/**
 * The player rolls their door numbers up front (player-rolls-out-of-
 * combat, item 4; PM decision, Muse 2026-11-23): 3 numbers at the door —
 * the banked number plus 2 spares. A used number is replaced by the next
 * spare, never by an engine roll and never by a mid-dungeon ask. When the
 * spares run out, passive Perception judges until the next dungeon door
 * refills the bank. The spares live on session_config.perceptionSpares
 * keyed by dungeon: { dice: [...], modifier, exhausted }.
 */
export const PERCEPTION_BANK_DICE = 3;

async function getSpares(sessionId, dungeon) {
  const cfg = await readSessionConfig(sessionId);
  return cfg.perceptionSpares?.[dungeon] || null;
}

async function setSpares(sessionId, dungeon, state) {
  const cfg = await readSessionConfig(sessionId);
  const all = { ...(cfg.perceptionSpares || {}) };
  if (state) all[dungeon] = state; else delete all[dungeon];
  cfg.perceptionSpares = all;
  await writeSessionConfig(sessionId, cfg);
}

// ---------------------------------------------------------------------------
// Session config (active dungeon key) + banked rows
// ---------------------------------------------------------------------------

async function readSessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {});
}

async function writeSessionConfig(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?',
    [JSON.stringify(cfg), sessionId]);
}

export async function getActiveDungeon(sessionId) {
  const cfg = await readSessionConfig(sessionId);
  return typeof cfg.activePerceptionDungeon === 'string' && cfg.activePerceptionDungeon.trim()
    ? cfg.activePerceptionDungeon
    : null;
}

async function setActiveDungeon(sessionId, dungeon) {
  const cfg = await readSessionConfig(sessionId);
  cfg.activePerceptionDungeon = dungeon;
  await writeSessionConfig(sessionId, cfg);
}

export async function listBanked(sessionId, dungeon) {
  return dbAll(
    `SELECT * FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? ORDER BY id`,
    [sessionId, dungeon]
  );
}

async function getBankedRow(sessionId, dungeon, actorType, actorName) {
  return dbGet(
    `SELECT * FROM perception_pre_rolls
     WHERE session_id = ? AND dungeon_key = ? AND actor_type = ? AND LOWER(actor_name) = LOWER(?)`,
    [sessionId, dungeon, actorType, actorName]
  );
}

/** Store (or replace) one banked number. Deletes-then-inserts so the
 *  unique (session, dungeon, actor) index never fires in normal use. */
async function bankRow({ sessionId, dungeon, actorType, actorName, die, modifier }) {
  await dbRun(
    `DELETE FROM perception_pre_rolls
     WHERE session_id = ? AND dungeon_key = ? AND actor_type = ? AND LOWER(actor_name) = LOWER(?)`,
    [sessionId, dungeon, actorType, actorName]
  );
  await dbRun(
    `INSERT INTO perception_pre_rolls
       (session_id, dungeon_key, actor_type, actor_name, banked_die, modifier)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, dungeon, actorType, actorName, die, modifier]
  );
}

async function deleteBankRow(sessionId, dungeon, actorType, actorName) {
  await dbRun(
    `DELETE FROM perception_pre_rolls
     WHERE session_id = ? AND dungeon_key = ? AND actor_type = ? AND LOWER(actor_name) = LOWER(?)`,
    [sessionId, dungeon, actorType, actorName]
  );
}

// ---------------------------------------------------------------------------
// Door — bank the party
// ---------------------------------------------------------------------------

/** Effective Perception modifier for the PC: sheet modifier plus the
 *  exhaustion/condition penalty, exactly as requestPcRoll folds it.
 *  Best-effort: conditions never block the bank. */
async function pcBankModifier(characterId) {
  const mod = await getPcCheckModifier(characterId, 'skill', 'Perception');
  if (!mod) return null;
  let penalty = 0;
  try {
    const fx = conditionRollEffects(await getConditions('player', characterId), 'skill', 'Perception');
    penalty = fx.penalty || 0;
  } catch { /* conditions are best-effort */ }
  return { modifier: mod.modifier, penalty };
}

/** Create the PC's pending door roll: a pending with bank:'perception'
 *  and NO dc. One pending at a time — this supersedes an unresolved
 *  one, the same as a re-asked ROLL_REQUEST (and clears the pending
 *  single-slot spell-effect keys for the same reason requestPcRoll
 *  does: the superseded effect's slot must not linger). */
export async function requestBankRoll({ sessionId, characterId, dungeon }) {
  const bank = await pcBankModifier(characterId);
  if (!bank) return { success: false, reason: 'unknown skill: Perception' };
  const pending = {
    bank: 'perception', dungeon, count: PERCEPTION_BANK_DICE,
    kind: 'skill', name: 'Perception',
    modifier: bank.modifier, penalty: bank.penalty,
    requestedAt: new Date().toISOString()
  };
  const cfg = await readSessionConfig(sessionId);
  cfg.pendingRoll = pending;
  delete cfg.pendingEnemySpellEffect;
  delete cfg.pendingRetaliation;
  delete cfg.pendingCounteredCast;
  delete cfg.pendingBacklashReduction;
  delete cfg.pendingTrapSave;
  delete cfg.pendingEscape;
  delete cfg.pendingDisplay;
  await writeSessionConfig(sessionId, cfg);
  return { success: true, pending };
}

/**
 * Resolve the PC's reported door die into a banked number. Called by the
 * route INSTEAD of resolveReportedRoll when the pending roll is a bank
 * roll. Returns null when no bank roll is pending (or the die is out of
 * range — the pending stays, so the player can re-report).
 */
export async function resolveBankRoll(sessionId, dice) {
  const pending = await getPendingRoll(sessionId);
  if (!pending || pending.bank !== 'perception') return null;
  // The door takes all PERCEPTION_BANK_DICE numbers at once: the first is
  // banked, the rest wait as spares. A short or bad report leaves the
  // pending in place for a re-report.
  const list = Array.isArray(dice) ? dice : [dice];
  if (list.length !== PERCEPTION_BANK_DICE || list.some((d) => !Number.isInteger(d) || d < 1 || d > 20)) return null;
  const [die, ...spares] = list;
  const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  const character = session?.character_id
    ? await dbGet('SELECT name, campaign_id FROM characters WHERE id = ?', [session.character_id])
    : null;
  const actorName = character?.name ?? 'Player';
  const modifier = pending.modifier + (pending.penalty || 0);
  const total = die + modifier;
  const dungeon = pending.dungeon;
  await bankRow({ sessionId, dungeon, actorType: 'pc', actorName, die, modifier });
  const rollId = await logRoll({
    sessionId, campaignId: character?.campaign_id ?? null,
    characterId: session?.character_id ?? null,
    actorType: 'pc', actorName,
    checkKind: 'skill', checkName: 'Perception', dc: null,
    modifier, dice: [die], takenDie: die, total,
    outcome: 'banked', source: 'reported',
    context: `banked at the door of ${dungeon}`
  });
  for (let i = 0; i < spares.length; i++) {
    await logRoll({
      sessionId, campaignId: character?.campaign_id ?? null,
      characterId: session?.character_id ?? null,
      actorType: 'pc', actorName,
      checkKind: 'skill', checkName: 'Perception', dc: null,
      modifier, dice: [spares[i]], takenDie: spares[i], total: spares[i] + modifier,
      outcome: 'banked', source: 'reported',
      context: `spare ${i + 1} of ${spares.length} held at the door of ${dungeon}`
    });
  }
  const cfg = await readSessionConfig(sessionId);
  delete cfg.pendingRoll;
  cfg.perceptionSpares = { ...(cfg.perceptionSpares || {}), [dungeon]: { dice: spares, modifier, exhausted: false } };
  await writeSessionConfig(sessionId, cfg);
  return {
    perceptionBank: true, rollId, actor: actorName, dungeon,
    check: 'Perception', kind: 'skill',
    die, modifier, total, passive: 10 + modifier, spares: spares.length
  };
}

/** Server-roll one active companion's door number (effective modifier,
 *  same penalty fold as rollForNpc's companion branch). The die is
 *  logged to roll_log (outcome 'banked') but NEVER stashed as a ROLL
 *  RESULT fact — the DM must not see the number. */
async function bankCompanion({ sessionId, characterId, dungeon, name }) {
  const modInfo = await getNpcCheckModifier(name, 'skill', 'Perception', characterId);
  let penalty = 0;
  try {
    const compId = await findCompanionIdByName(characterId, name);
    if (compId) {
      const fx = conditionRollEffects(await getConditions('companion', compId), 'skill', 'Perception');
      penalty = fx.penalty || 0;
    }
  } catch { /* conditions are best-effort */ }
  const modifier = modInfo.modifier + penalty;
  const die = rollD20(`perception-preroll:${name}`);
  await bankRow({ sessionId, dungeon, actorType: 'companion', actorName: name, die, modifier });
  const charRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
  await logRoll({
    sessionId, campaignId: charRow?.campaign_id ?? null, characterId,
    actorType: 'companion', actorName: name,
    checkKind: 'skill', checkName: 'Perception', dc: null,
    modifier, dice: [die], takenDie: die, total: die + modifier,
    outcome: 'banked', source: 'server',
    context: `banked at the door of ${dungeon}`
  });
  return { name, modifier };
}

async function listActiveCompanions(characterId) {
  return dbAll(
    `SELECT n.name FROM companions c JOIN npcs n ON c.npc_id = n.id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active' ORDER BY n.name`,
    [characterId]
  );
}

/**
 * Bank the party at the dungeon door. Idempotent per dungeon: actors
 * who already have a number keep it; only the missing ones are banked
 * (so re-entering a dungeon, or a companion joining mid-dungeon, tops
 * the bank up instead of re-rolling everyone). The active dungeon is
 * always (re)set, so returning to an earlier dungeon re-activates it.
 */
export async function bankAtDoor({ sessionId, characterId, dungeon }) {
  if (!dungeon || !String(dungeon).trim()) {
    return { success: false, reason: 'PERCEPTION_PREROLL needs Dungeon="..."' };
  }
  const key = String(dungeon).trim();
  const priorActive = await getActiveDungeon(sessionId);
  await setActiveDungeon(sessionId, key);
  const newlyBanked = [];

  // The PC banks by rolling real dice: a pending roll, unless they
  // already hold a number for this dungeon or one is already pending.
  const pending = await getPendingRoll(sessionId);
  const pcPending = pending && pending.bank === 'perception' && pending.dungeon === key;
  if (!pcPending) {
    const character = await dbGet('SELECT name FROM characters WHERE id = ?', [characterId]);
    const pcName = character?.name ?? 'Player';
    const existingPc = await dbGet(
      `SELECT * FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? AND actor_type = 'pc' LIMIT 1`,
      [sessionId, key]
    );
    // Never ask mid-dungeon (Muse, 2026-11-23): a PC whose numbers ran
    // out in the dungeon the party is already in stays on passive until
    // a dungeon door — entering this dungeon afresh from elsewhere, or
    // another dungeon — refills the bank.
    const spares = await getSpares(sessionId, key);
    const stillInside = spares?.exhausted && priorActive === key;
    if (!existingPc && !stillInside) {
      if (spares) await setSpares(sessionId, key, null);
      const r = await requestBankRoll({ sessionId, characterId, dungeon: key });
      if (r.success) newlyBanked.push(pcName);
    }
  }

  for (const comp of await listActiveCompanions(characterId)) {
    const existing = await getBankedRow(sessionId, key, 'companion', comp.name);
    if (!existing) {
      await bankCompanion({ sessionId, characterId, dungeon: key, name: comp.name });
      newlyBanked.push(comp.name);
    }
  }
  return {
    success: true, dungeon: key,
    banked: newlyBanked,
    alreadyBanked: newlyBanked.length === 0
  };
}

/** Is the player covered by a bank in the active dungeon — a banked
 *  number, or a spent bank (passive)? Then an open Perception roll for
 *  something hidden is the tell, and the DM reads the bank instead. */
export async function pcCoveredByBank(sessionId) {
  const dungeon = await getActiveDungeon(sessionId);
  if (!dungeon) return false;
  const row = await dbGet(
    `SELECT 1 FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? AND actor_type = 'pc' LIMIT 1`,
    [sessionId, dungeon]
  );
  if (row) return true;
  return !!(await getSpares(sessionId, dungeon))?.exhausted;
}

// ---------------------------------------------------------------------------
// Use — read a stored number in secret
// ---------------------------------------------------------------------------

/**
 * Judge a banked number against a hidden-layer DC. Crits judge the
 * stored die first (nat 1 fails, nat 20 succeeds); otherwise the
 * effective total is max(banked total, passive). Consumes the number
 * and banks a silent server-rolled replacement. Returns the outcome
 * object (also stashed on session_config.recentRolls for next-turn
 * injection as a system fact).
 */
export async function useBankedPerception({ sessionId, characterId, target, trigger, dc }) {
  if (!PERCEPTION_USE_TRIGGERS.includes(trigger)) {
    return { success: false, reason: `PERCEPTION_USE trigger must be one of: ${PERCEPTION_USE_TRIGGERS.join(', ')}` };
  }
  if (!Number.isFinite(dc)) {
    return { success: false, reason: 'PERCEPTION_USE needs a numeric DC' };
  }
  const party = await resolveCheckParty({ sessionId, characterId }, target);
  if (!party) {
    return { success: false, reason: 'PERCEPTION_USE target must be a party member' };
  }
  const dungeon = await getActiveDungeon(sessionId);
  if (!dungeon) {
    return { success: false, reason: 'no dungeon banked — the party has not entered a dungeon yet' };
  }
  const actorType = party.kind === 'player' ? 'pc' : 'companion';
  const row = await getBankedRow(sessionId, dungeon, actorType, party.name);
  // The PC's numbers ran out in this dungeon: passive Perception judges,
  // with no die and no ask (Muse, 2026-11-23).
  const pcSpares = actorType === 'pc' ? await getSpares(sessionId, dungeon) : null;
  if (!row && pcSpares?.exhausted) {
    const passiveOnly = 10 + (Number(pcSpares.modifier) || 0);
    const pOutcome = passiveOnly >= dc ? 'success' : 'failure';
    const pRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
    const pRollId = await logRoll({
      sessionId, campaignId: pRow?.campaign_id ?? null, characterId,
      actorType, actorName: party.name,
      checkKind: 'skill', checkName: 'Perception', dc,
      modifier: pcSpares.modifier, dice: [], takenDie: null,
      total: passiveOnly, outcome: pOutcome, source: 'passive',
      context: `passive Perception (${trigger}) — no banked number left in ${dungeon}`
    });
    const pObj = {
      perceptionUse: true, passiveOnly: true, rollId: pRollId, actor: party.name, actorType,
      trigger, dungeon, check: 'Perception', kind: 'skill', dc,
      modifier: pcSpares.modifier, die: null, bankedTotal: null,
      passive: passiveOnly, effective: passiveOnly, viaPassive: true, outcome: pOutcome
    };
    try {
      const cfg = await readSessionConfig(sessionId);
      cfg.recentRolls = [...(Array.isArray(cfg.recentRolls) ? cfg.recentRolls : []), pObj].slice(-5);
      await writeSessionConfig(sessionId, cfg);
    } catch { /* best-effort — the use is still in roll_log */ }
    return { success: true, ...pObj };
  }
  if (!row) {
    // The player's numbers are asked for but not in yet: wait, never ask.
    const waiting = actorType === 'pc' ? await getPendingRoll(sessionId) : null;
    if (waiting?.bank === 'perception') {
      return { success: false, reason: `${party.name} is still rolling their banked Perception numbers — read the bank once they are in; do not ask for a roll` };
    }
    return {
      success: false,
      reason: `no banked Perception for ${party.name} in ${dungeon} — use a normal ROLL_REQUEST`
    };
  }
  const res = resolveDice({ dice: [row.banked_die], modifier: row.modifier, dc });
  const passive = 10 + row.modifier;
  let outcome = res.outcome;
  let effective = res.total;
  let viaPassive = false;
  if (outcome === 'failure' && passive >= dc) {
    outcome = 'success';
    effective = passive;
    viaPassive = true;
  }
  const session = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
  const rollId = await logRoll({
    sessionId, campaignId: session?.campaign_id ?? null, characterId,
    actorType, actorName: party.name,
    checkKind: 'skill', checkName: 'Perception', dc,
    modifier: row.modifier, dice: [row.banked_die], takenDie: row.banked_die,
    total: effective, outcome, source: 'banked',
    context: `banked Perception (${trigger}); banked ${res.total} vs passive ${passive}${viaPassive ? ' — passive carried it' : ''}`
  });

  // Consume the used number. The PC's replacement is their own next
  // spare from the door — never an engine roll, never a mid-dungeon ask
  // (Zach 2026-11-23: the DM never rolls for the player; spares per Muse
  // 2026-11-23). No spare left → passive from now on in this dungeon.
  // A companion's replacement stays server-rolled (companion rolls are
  // the engine's), logged (outcome 'banked') but never shown to the DM.
  await deleteBankRow(sessionId, dungeon, actorType, party.name);
  if (actorType === 'pc') {
    const spares = pcSpares || { dice: [], modifier: row.modifier, exhausted: false };
    const next = spares.dice.length ? spares.dice[0] : null;
    if (next != null) {
      await bankRow({ sessionId, dungeon, actorType, actorName: party.name, die: next, modifier: row.modifier });
      await setSpares(sessionId, dungeon, { ...spares, dice: spares.dice.slice(1), exhausted: false });
    } else {
      await setSpares(sessionId, dungeon, { dice: [], modifier: row.modifier, exhausted: true });
    }
  } else {
    const replacementDie = rollD20(`perception-preroll:${party.name}`);
    await bankRow({
      sessionId, dungeon, actorType, actorName: party.name,
      die: replacementDie, modifier: row.modifier
    });
    await logRoll({
      sessionId, campaignId: session?.campaign_id ?? null, characterId,
      actorType, actorName: party.name,
      checkKind: 'skill', checkName: 'Perception', dc: null,
      modifier: row.modifier, dice: [replacementDie], takenDie: replacementDie,
      total: replacementDie + row.modifier,
      outcome: 'banked', source: 'server',
      context: `replacement banked after use (${trigger})`
    });
  }

  const outcomeObj = {
    perceptionUse: true, rollId, actor: party.name, actorType,
    trigger, dungeon, check: 'Perception', kind: 'skill', dc,
    modifier: row.modifier, die: row.banked_die,
    bankedTotal: res.total, passive, effective, viaPassive, outcome
  };
  try {
    const cfg = await readSessionConfig(sessionId);
    const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
    cfg.recentRolls = [...prior, outcomeObj].slice(-5);
    await writeSessionConfig(sessionId, cfg);
  } catch { /* best-effort — the use is still in roll_log */ }
  return { success: true, ...outcomeObj };
}

// ---------------------------------------------------------------------------
// DM-facing text (injected as system facts — the player never sees these)
// ---------------------------------------------------------------------------

export function formatPerceptionBankBlock(o) {
  if (!o) return '';
  const modStr = o.modifier >= 0 ? `+${o.modifier}` : `${o.modifier}`;
  return `\n\n══════════════ PERCEPTION BANKED (system — this is fact) ══════════════\n` +
    `${o.actor} banked Perception ${o.total} at the door of ${o.dungeon} (die ${o.die} ${modStr})` +
    `${o.spares ? `, with ${o.spares} more of their own numbers held in reserve` : ''}. ` +
    `Tell the player their banked number — they rolled it and they know it. ` +
    `When a number is used, the player's next reserve number takes its place in secret; when none are left, passive Perception applies. ` +
    `NEVER ask the player for a Perception roll inside this dungeon, never mention when a banked number is read, ` +
    `and never state any banked number except the player's own at the door.\n` +
    `═══════════════════════════════════════════════════════════════════════\n`;
}

export function formatPerceptionUseBlock(o) {
  if (!o) return '';
  const modStr = o.modifier >= 0 ? `+${o.modifier}` : `${o.modifier}`;
  let verdict;
  switch (o.outcome) {
    case 'critical_success':
      verdict = 'CRITICAL SUCCESS (natural 20) — they notice it, and something beyond the ask goes right: narrate a miraculous bonus.';
      break;
    case 'critical_failure':
      verdict = 'CRITICAL FAILURE (natural 1) — they miss it completely: attach a real consequence and narrate it.';
      break;
    case 'success':
      verdict = o.viaPassive
        ? 'SUCCESS — their passive Perception carried it (the banked roll fell short): narrate them noticing it.'
        : 'SUCCESS — narrate them noticing it.';
      break;
    default:
      verdict = 'FAILURE — narrate them missing it; the fiction moves on with that fact.';
  }
  const triggerWord = o.trigger === 'trap' ? 'a trap'
    : o.trigger === 'secret_door' ? 'a secret door' : 'a stealthed enemy';
  const line = o.passiveOnly
    ? `${o.actor} — passive Perception ${o.passive} vs ${triggerWord}, DC ${o.dc} (no banked number left).`
    : `${o.actor} — Perception (banked) vs ${triggerWord}: die ${o.die} ${modStr} = ${o.bankedTotal}; passive ${o.passive}; effective ${o.effective} vs DC ${o.dc}.`;
  return `\n\n══════════════ PERCEPTION (BANKED) — system, this outcome is fact ══════════════\n` +
    `${line}\n${verdict}\n` +
    `Do NOT mention any banked number, never say a banked number was read, and never ask for a Perception roll. Narrate only what ${o.actor} notices (or misses).\n` +
    `═══════════════════════════════════════════════════════════════════════\n`;
}

/**
 * Per-turn bank block, re-appended fresh each turn like CURRENT VITALS:
 * which dungeon is active and who holds a banked number — WITHOUT the
 * numbers. Returns '' when no dungeon is banked or nobody holds one.
 */
export async function formatActiveBankBlock(sessionId) {
  try {
    const dungeon = await getActiveDungeon(sessionId);
    if (!dungeon) return '';
    const rows = await listBanked(sessionId, dungeon);
    const pc = rows.filter((r) => r.actor_type === 'pc').map((r) => r.actor_name);
    // A PC whose numbers ran out is still covered — by passive Perception,
    // read with the same marker — so the DM never asks them to roll.
    if (pc.length === 0 && (await getSpares(sessionId, dungeon))?.exhausted) {
      const s = await dbGet('SELECT c.name FROM dm_sessions d JOIN characters c ON c.id = d.character_id WHERE d.id = ?', [sessionId]);
      if (s?.name) pc.push(s.name);
    }
    if (rows.length === 0 && pc.length === 0) return '';
    const comps = rows.filter((r) => r.actor_type !== 'pc').map((r) => r.actor_name);
    const names = [...pc, ...comps].join(', ');
    return `\n\n══════════════════════════════════════════════════════════════\n` +
      `PERCEPTION PRE-ROLL (banked numbers)\n` +
      `══════════════════════════════════════════════════════════════\n` +
      `Banked Perception numbers exist for ${dungeon}: ${names}. When the party reaches something hidden — ` +
      `a trap, a secret door, or a stealthed enemy — read the stored number with ` +
      `[PERCEPTION_USE: Target="Name" Trigger="trap|secret_door|stealthed_enemy" DC=N], never by asking for a roll. ` +
      `The numbers are NOT listed here and you must never state or hint at one, or say when one is read.\n`;
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Marker handlers (registered at module load — the route must import this
// module for side effect, like rollRequestService)
// ---------------------------------------------------------------------------

registerMarkerHandler('PERCEPTION_PREROLL', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const dungeon = String(parsed?.Dungeon || '').trim();
    if (!dungeon) {
      return { type: 'perception_preroll', success: false, reason: 'PERCEPTION_PREROLL needs Dungeon="..."' };
    }
    const r = await bankAtDoor({ sessionId: context.sessionId, characterId: context.characterId, dungeon });
    return { type: 'perception_preroll', ...r };
  } catch (e) {
    console.error('[perceptionPreRollService] PERCEPTION_PREROLL handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('PERCEPTION_USE', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const target = String(parsed?.Target || '').trim();
    const trigger = String(parsed?.Trigger || '').trim();
    const dc = Number(parsed?.DC);
    if (!target || !trigger || !Number.isFinite(dc)) {
      return { type: 'perception_use', success: false, reason: 'PERCEPTION_USE needs Target=, Trigger=, and a numeric DC' };
    }
    const r = await useBankedPerception({
      sessionId: context.sessionId, characterId: context.characterId, target, trigger, dc
    });
    return { type: 'perception_use', ...r };
  } catch (e) {
    console.error('[perceptionPreRollService] PERCEPTION_USE handler failed:', e.message);
    return null;
  }
});
