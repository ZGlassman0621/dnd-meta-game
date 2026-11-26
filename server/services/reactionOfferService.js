/**
 * Reaction offers — mechanical-reactions, PM decision 2026-11-25 (Muse):
 * "Pause and ask — when a reaction trigger fires for the player character,
 * pause the enemy turn and ask the player to use it or pass, only when the
 * reaction is actually available (reaction unused, spell known and slot
 * available). The DM no longer spends the player's reaction unasked."
 *
 * One pending offer at a time, on session_config.pendingReactionOffer:
 *   shield         — an enemy attack HIT the player; damage waits.
 *   counterspell   — an enemy is casting; the spell waits (its slot and
 *                    action are already spent, as the cast is under way).
 *   replay         — the DM wrote a player reaction during an NPC turn
 *                    (opportunity attack, readied action firing, a damage-
 *                    answer spell, Bend Luck, Flash of Genius): the marker
 *                    is held and runs only if the player says yes.
 * The player answers with their next message ("Shield" / "counter" /
 * "yes" / "pass"); the route resolves the offer, then the enemy turn
 * resumes where it paused (the paused combatant does not act twice).
 * Markers the same NPC wrote after the paused one (a second multiattack
 * swing, a second cast) queue on the offer and replay after it resolves.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { isPlayerRef } from '../utils/playerName.js';

async function readCfg(sessionId) {
  const row = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(row?.session_config, {}) || {};
}
async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

export async function getOffer(sessionId) {
  try { return (await readCfg(sessionId)).pendingReactionOffer || null; } catch { return null; }
}
export async function clearOffer(sessionId) {
  const cfg = await readCfg(sessionId);
  delete cfg.pendingReactionOffer;
  await writeCfg(sessionId, cfg);
}
async function setOffer(sessionId, offer) {
  const cfg = await readCfg(sessionId);
  if (cfg.pendingReactionOffer) return false; // one question at a time
  cfg.pendingReactionOffer = offer;
  await writeCfg(sessionId, cfg);
  return true;
}

/** A marker the paused NPC wrote after the held one: replays later. */
export async function queueBehindOffer(sessionId, marker) {
  const cfg = await readCfg(sessionId);
  if (!cfg.pendingReactionOffer) return false;
  cfg.pendingReactionOffer.queue = [...(cfg.pendingReactionOffer.queue || []), marker];
  await writeCfg(sessionId, cfg);
  return true;
}

/** Combatants whose turn already ran before a pause (the loop skips them on resume). */
export async function takeResumeActed(sessionId) {
  const cfg = await readCfg(sessionId);
  const names = Array.isArray(cfg.reactionResumeActed) ? cfg.reactionResumeActed : [];
  if (names.length) { delete cfg.reactionResumeActed; await writeCfg(sessionId, cfg); }
  return names;
}
async function addResumeActed(sessionId, name) {
  if (!name) return;
  const cfg = await readCfg(sessionId);
  const names = Array.isArray(cfg.reactionResumeActed) ? cfg.reactionResumeActed : [];
  if (!names.includes(name)) names.push(name);
  cfg.reactionResumeActed = names;
  await writeCfg(sessionId, cfg);
}

/** Rebuild a marker string from a handler's parsed fields (for the queue). */
export function rebuildMarker(key, parsed) {
  const fields = Object.entries(parsed || {}).filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}="${String(v).replace(/"/g, "'")}"`);
  return `[${key}${fields.length ? `: ${fields.join(' ')}` : ''}]`;
}

// ---------------------------------------------------------------------------
// Availability: reaction unused, conscious, able to act, spell known, slot left
// ---------------------------------------------------------------------------

function listHas(json, spell) {
  const arr = safeParse(json, []);
  const want = String(spell).toLowerCase();
  return (Array.isArray(arr) ? arr : []).some((e) => String(typeof e === 'string' ? e : (e?.name || '')).toLowerCase() === want);
}

/** The player's turn-order name and whether their reaction is free. */
export async function playerReactionState(sessionId, encounterSeq, characterId) {
  const { getTurnState } = await import('./combatTurnService.js');
  const st = await getTurnState(sessionId, encounterSeq).catch(() => null);
  if (!st) return { ok: false, reason: 'no turn order' };
  const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
  const key = await ledgerKeyForPlayer(characterId);
  const entry = (st.turnOrder || []).find((e) => e && e.key === key);
  const row = await dbGet('SELECT name, current_hp FROM characters WHERE id = ?', [characterId]);
  const name = entry?.name || row?.name || 'Player';
  if (!(Number(row?.current_hp) > 0)) return { ok: false, reason: 'the player is down' };
  const { hasIncapacitatingCondition } = await import('./conditionService.js');
  if (await hasIncapacitatingCondition('player', characterId)) return { ok: false, reason: 'the player is incapacitated' };
  const { hasReactionAvailable } = await import('./reactionService.js');
  if (!(await hasReactionAvailable(sessionId, encounterSeq, name))) return { ok: false, reason: 'reaction already used' };
  return { ok: true, name, key, currentTurn: st.currentTurn?.name || null };
}

/** The spell is known/prepared and a slot of at least minLevel is left. */
export async function playerSpellReady(characterId, spell, minLevel = 1) {
  const row = await dbGet('SELECT known_spells, prepared_spells FROM characters WHERE id = ?', [characterId]);
  if (!row || !(listHas(row.known_spells, spell) || listHas(row.prepared_spells, spell))) return { ok: false, reason: `${spell} is not known` };
  const { peekSpellSlot } = await import('./spellCastService.js');
  for (let lvl = Math.max(1, minLevel); lvl <= 9; lvl++) {
    const p = await peekSpellSlot(characterId, null, true, null, lvl).catch(() => null);
    if (p?.ok && p.slotsMax > 0) return { ok: true, level: lvl };
  }
  return { ok: false, reason: `no spell slot of level ${minLevel}+ left` };
}

// ---------------------------------------------------------------------------
// Offers
// ---------------------------------------------------------------------------

export function offerPrompt(o) {
  if (o.kind === 'shield') {
    const j = o.held.judged;
    const turns = !j.isCrit && j.totalToHit < j.targetAc + 5;
    return `⚡ Reaction: ${o.held.enemyName}'s attack hits you (${j.totalToHit} vs AC ${j.targetAc}${j.isCrit ? ', a critical hit' : ''}). Cast Shield with a level-${o.level} slot? ${turns ? 'With +5 AC the attack misses.' : 'It still hits even with +5 AC, but Shield lasts until your next turn.'} Reply "Shield" or "pass".`;
  }
  if (o.kind === 'counterspell') {
    return `⚡ Reaction: ${o.enemyName} is casting ${o.spell}. Cast Counterspell with a level-${o.level} slot? Reply "counter" or "pass".`;
  }
  return `⚡ Reaction: ${o.label}. Use your reaction? Reply "yes" or "pass".`;
}

/** 'accept' | 'pass' | null (not an answer — the offer stays open). */
export function parseOfferAnswer(text, offer) {
  const t = String(text || '').toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || !offer) return null;
  // Only a short reply is an answer; a longer message (a question, a plan)
  // leaves the offer open and is asked again.
  if (t.split(' ').length > 8) return null;
  if (/\b(pass|no|nope|skip|decline|don't|dont|hold off|let it)\b/.test(t)) return 'pass';
  if (/\b(yes|yeah|yep|y|use it|do it|cast|take it|shield|counter|counterspell|attack|fire|go)\b/.test(t)) return 'accept';
  return null;
}

/** An enemy attack hit the player: hold it for Shield when available. */
export async function maybeOfferShield(sessionId, encounterSeq, held) {
  const sess = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  const characterId = held.target?.id;
  if (!sess || Number(sess.character_id) !== Number(characterId)) return null;
  if (await getOffer(sessionId)) return null;
  const { shieldBonusFor } = await import('./enemySpellService.js');
  const rx = await playerReactionState(sessionId, encounterSeq, characterId);
  if (!rx.ok) return null;
  if ((await shieldBonusFor(sessionId, encounterSeq, rx.key)) > 0) return null; // already shielded
  const sp = await playerSpellReady(characterId, 'Shield', 1);
  if (!sp.ok) return null;
  const offer = { kind: 'shield', encounterSeq, characterId, level: sp.level, held, turnOf: rx.currentTurn, queue: [] };
  if (!(await setOffer(sessionId, offer))) return null;
  return { ...offer, prompt: offerPrompt(offer) };
}

/** An enemy is casting: hold the spell for Counterspell when available. */
export async function maybeOfferCounterspell(sessionId, encounterSeq, characterId, data) {
  if (await getOffer(sessionId)) return null;
  const rx = await playerReactionState(sessionId, encounterSeq, characterId);
  if (!rx.ok) return null;
  const sp = await playerSpellReady(characterId, 'Counterspell', 3);
  if (!sp.ok) return null;
  const offer = { kind: 'counterspell', encounterSeq, characterId, level: sp.level, turnOf: rx.currentTurn, queue: [], ...data };
  if (!(await setOffer(sessionId, offer))) return null;
  return { ...offer, prompt: offerPrompt(offer) };
}

// ---------------------------------------------------------------------------
// The DM wrote a player reaction during an NPC turn: hold it as a question
// ---------------------------------------------------------------------------

const MARKER_RE = /\[(SPELL_CAST|OPPORTUNITY_ATTACK|ATTACK|DODGE|DISENGAGE|HIDE|HELP|BEND_LUCK|ARTIFICER_FLASH)\s*:([^\]]*)\]/gi;
function fieldsOf(body) {
  const out = {};
  const re = /(\w+)\s*=\s*(?:"([^"]*)"|([^\s\]]+))/g;
  let m;
  while ((m = re.exec(body))) out[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return out;
}
const truthy = (v) => /^(true|yes|1)$/i.test(String(v || '').trim());

/** Classify one marker: null (not a player reaction) or { drop|offer }. */
async function classify(key, f, pcName) {
  const isPc = (v) => v === undefined || v === '' || isPlayerRef(String(v), pcName);
  const { isReactionOnlySpell } = await import('./enemySpellService.js');
  const K = key.toUpperCase();
  if (K === 'SPELL_CAST') {
    if (!isPc(f.Caster)) return null;
    const ready = truthy(f.Ready);
    const reaction = truthy(f.Reaction) || isReactionOnlySpell(f.Spell);
    if (!ready && !reaction) return null;
    const spell = String(f.Spell || '').trim();
    if (!ready && /^(shield|counterspell)$/i.test(spell)) return { drop: `the engine itself asks the player about ${spell} when its trigger happens` };
    return { offer: { label: ready ? `your readied ${spell} can be released now` : `cast ${spell} now`, spell: ready ? null : spell } };
  }
  if (K === 'OPPORTUNITY_ATTACK') {
    if (!isPc(f.Attacker)) return null;
    return { offer: { label: `${f.Target || 'an enemy'} is leaving your reach: take an opportunity attack` } };
  }
  if (K === 'ATTACK') {
    if (!truthy(f.Ready) || !isPc(f.Attacker)) return null;
    return { offer: { label: `your readied attack on ${f.Target || 'the target'} triggers` } };
  }
  if (['DODGE', 'DISENGAGE', 'HIDE'].includes(K)) {
    if (!truthy(f.Ready) || !isPc(f.Target)) return null;
    return { offer: { label: `your readied ${K.toLowerCase()} triggers` } };
  }
  if (K === 'HELP') {
    if (!truthy(f.Ready) || !isPc(f.Helper)) return null;
    return { offer: { label: 'your readied Help triggers' } };
  }
  if (K === 'BEND_LUCK') {
    if (!isPc(f.Target)) return null;
    return { offer: { label: `use Bend Luck (a ${f.Direction || ''} on the ${f.Roll || 'roll'})`.replace(/\s+/g, ' ') } };
  }
  if (K === 'ARTIFICER_FLASH') {
    if (!isPc(f.Target)) return null;
    return { offer: { label: 'use Flash of Genius on that failed roll' } };
  }
  return null;
}

/**
 * NPC-turn dispatch filter: remove every player reaction the DM wrote in
 * an NPC's reply. The first available one becomes the pending offer (its
 * exact marker replays on "yes"); the rest are dropped with a DM note.
 * Returns { text, notes: [], offered: offer|null }.
 */
export async function extractPlayerReactions(sessionId, encounterSeq, characterId, text, pcName) {
  const notes = [];
  let offered = null;
  const src = String(text || '');
  const found = [];
  let m;
  MARKER_RE.lastIndex = 0;
  while ((m = MARKER_RE.exec(src))) found.push({ raw: m[0], key: m[1], fields: fieldsOf(m[2]) });
  let out = src;
  for (const fm of found) {
    const c = await classify(fm.key, fm.fields, pcName);
    if (!c) continue;
    out = out.replace(fm.raw, '');
    if (c.drop) { notes.push(`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${fm.raw} was not run: ${c.drop}. Never spend the player's reaction for them.`); continue; }
    if (offered || (await getOffer(sessionId))) { notes.push(`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${fm.raw} was not run: the player is already being asked about a reaction. Never spend the player's reaction for them.`); continue; }
    const rx = await playerReactionState(sessionId, encounterSeq, characterId);
    if (!rx.ok) { notes.push(`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${fm.raw} was not run: ${rx.reason}.`); continue; }
    if (c.offer.spell) {
      const { lookupSpell } = await import('../data/spellCatalog.js');
      const sp = await playerSpellReady(characterId, c.offer.spell, lookupSpell(c.offer.spell)?.level || 1);
      if (!sp.ok) { notes.push(`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${fm.raw} was not run: ${sp.reason}.`); continue; }
    }
    const offer = { kind: 'replay', encounterSeq, characterId, marker: fm.raw, label: c.offer.label, turnOf: rx.currentTurn, queue: [] };
    if (await setOffer(sessionId, offer)) {
      offered = { ...offer, prompt: offerPrompt(offer) };
      notes.push(`[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The player is being asked whether to use their reaction (${c.offer.label}). Do not narrate it as happening; the engine runs it only if the player says yes.`);
    }
  }
  return { text: out, notes, offered };
}

// ---------------------------------------------------------------------------
// Resolution (the player's answer)
// ---------------------------------------------------------------------------

/**
 * Resolve the pending offer. Returns
 *   { lines: [⚙ lines for the player], facts: [binding DM facts],
 *     results: [{schemaKey, ok, result}] (engine results, for the route's
 *     own result-line formatting), replay: marker text to dispatch next
 *     (the accepted marker for a replay offer, then the queue) }.
 */
export async function resolveOffer(sessionId, answer) {
  const offer = await getOffer(sessionId);
  if (!offer) return null;
  await clearOffer(sessionId);
  await addResumeActed(sessionId, offer.turnOf);
  const lines = [];
  const facts = [];
  const results = [];
  const replay = [];
  const accept = answer === 'accept';
  const seq = offer.encounterSeq;
  const characterId = offer.characterId;

  if (offer.kind === 'shield') {
    const ecs = await import('./enemyCombatService.js');
    let extra = 0;
    if (accept) {
      const rx = await playerReactionState(sessionId, seq, characterId);
      const { spendSpellSlot } = await import('./spellCastService.js');
      const spent = rx.ok ? await spendSpellSlot(characterId, null, true, null, offer.level) : { ok: false };
      if (rx.ok && spent.ok) {
        const { useReaction } = await import('./reactionService.js');
        const ess = await import('./enemySpellService.js');
        await useReaction(sessionId, seq, rx.name);
        await ess.setShield(sessionId, seq, rx.key);
        extra = 5;
        lines.push(`⚙ Shield: +5 AC until the start of your next turn (level-${offer.level} slot and your reaction spent).`);
        facts.push(`[SHIELD — system fact: the player cast Shield as a reaction: +5 AC until the start of their next turn. The attack is judged against the raised AC.]`);
      } else {
        lines.push(`⚙ Shield could not be cast (${rx.ok ? 'no slot left' : rx.reason}); the attack lands as rolled.`);
      }
    } else {
      lines.push('⚙ You let the blow come.');
    }
    const landed = await ecs.resumeHeldEnemyAttack(sessionId, seq, offer.held, extra);
    results.push({ schemaKey: 'ENEMY_ATTACK', ok: true, parsed: { Enemy: offer.held.enemyName }, result: landed });
  } else if (offer.kind === 'counterspell') {
    const ess = await import('./enemySpellService.js');
    const { findActiveEnemy } = await import('./enemyCombatService.js');
    const enemy = await findActiveEnemy(sessionId, seq, offer.enemyName);
    let countered = false;
    if (accept && enemy) {
      const rx = await playerReactionState(sessionId, seq, characterId);
      const { spendSpellSlot } = await import('./spellCastService.js');
      const spent = rx.ok ? await spendSpellSlot(characterId, null, true, null, offer.level) : { ok: false };
      if (rx.ok && spent.ok) {
        const { useReaction } = await import('./reactionService.js');
        await useReaction(sessionId, seq, rx.name);
        const row = await dbGet('SELECT ability_scores, level, class FROM characters WHERE id = ?', [characterId]);
        const dc = ess.partySpellProfile('player', row)?.saveDc ?? null;
        const save = dc == null ? { success: true } : await ess.rollEnemySave(sessionId, seq, enemy, 'con', dc, offer.spell);
        if (!save.success) {
          countered = true;
          const { restoreEnemySlot } = await import('./enemyEconomyService.js');
          await restoreEnemySlot(enemy.id, offer.castLevel ?? 0);
          lines.push(`⚙ Counterspell (level-${offer.level} slot and your reaction spent): ${offer.enemyName}'s ${offer.spell} is countered and has no effect.`);
          facts.push(`[COUNTERSPELL — system fact: the player countered ${offer.enemyName}'s ${offer.spell}. It has NO effect at all; ${offer.enemyName}'s action is wasted and its slot is not expended. Narrate the spell unravelling.]`);
        } else {
          lines.push(`⚙ Counterspell (level-${offer.level} slot and your reaction spent): ${offer.enemyName} pushes through — ${offer.spell} goes off.`);
          facts.push(`[COUNTERSPELL — system fact: the player's Counterspell failed: ${offer.enemyName} made the Constitution save and ${offer.spell} takes effect as the engine resolved it.]`);
        }
      } else {
        lines.push(`⚙ Counterspell could not be cast (${rx.ok ? 'no slot left' : rx.reason}).`);
      }
    }
    if (!countered && enemy) {
      const resolved = await ess.resolveEnemyCast(sessionId, seq, enemy, offer.enemyKey, offer.spell, offer.castLevel, offer.resolveOpts || {});
      results.push({ schemaKey: 'ENEMY_CAST', ok: true, parsed: { Enemy: offer.enemyName }, result: { ...resolved, enemy: offer.enemyName, spell: offer.spell } });
      if (!accept) lines.push(`⚙ You let ${offer.enemyName}'s ${offer.spell} go.`);
    }
  } else if (offer.kind === 'replay') {
    if (accept) replay.push(offer.marker);
    else lines.push(`⚙ You hold your reaction (${offer.label} — passed).`);
  }
  replay.push(...(offer.queue || []));
  return { offer, lines, facts, results, replay: replay.join(' ') };
}

export default {
  getOffer, clearOffer, queueBehindOffer, takeResumeActed, rebuildMarker,
  playerReactionState, playerSpellReady, offerPrompt, parseOfferAnswer,
  maybeOfferShield, maybeOfferCounterspell, extractPlayerReactions, resolveOffer,
};
