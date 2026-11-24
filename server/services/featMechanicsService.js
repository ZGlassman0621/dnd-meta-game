/**
 * HOMEBREW — feat-addition-14 (brief docs/pm/feat-addition-14/BRIEF.md;
 * Zach 2026-11-21 / 2026-11-22). The engine side of the fourteen added
 * feats, in one marked module so it can be listed and audited apart from
 * the 2024 book behavior it wraps. The catalog entries live in
 * server/data/featRegistry.js (ADDED_FEATS); this module reads them.
 *
 * What lives here (each piece names its feat):
 *   - feat ownership reads (characters.feats + character_origin_feats)
 *   - per-long-rest use counters (Sage Advice = PB, Trapper = 2), stored
 *     on the feat's own entry in characters.feats (no new column)
 *   - initiative: Alert's +PB and swap (a fix found here — the engine
 *     added only Dex), Tactician's d4 (the PLAYER's die) and swap
 *   - ROLL_REQUEST feat riders (Hound, Trapper, Mountaineer, Elusive):
 *     the DM names the situation, the engine checks the feat and applies
 *     the exact advantage / +5 / disadvantage
 *   - FEAT_USE marker: Elegant Maneuver (bonus action -> advantage on the
 *     next Acrobatics/Athletics check this turn), Seismic Touch (action ->
 *     tremorsense 60 ft until the start of the player's next turn), Sage
 *     Advice (10 minutes -> allies add PB to one check with the skill)
 *   - WINNING_WORDS marker: Silver Tongue's contested charm
 *   - Trapper's free Hunter's Mark casts, Energy Affinity's choice
 *   - Sling Expert's damage dice, Quick Draw's opportunity trigger
 *   - the DM prompt's feat-state lines
 *
 * The engine never rolls for the player (Zach 2026-11-23): every player
 * die here is asked for and reported. NPC dice (an NPC's Insight) are the
 * engine's, as for every NPC roll.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { rollD20 } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { getFeatEffect, normalizeFeatName } from '../data/featRegistry.js';

// ---------------------------------------------------------------------------
// Basics
// ---------------------------------------------------------------------------

export function pbForLevel(level) {
  return Math.floor((Math.max(1, Math.trunc(Number(level) || 1)) - 1) / 4) + 2;
}

function featEntries(featsRaw) {
  const list = typeof featsRaw === 'string' ? safeParse(featsRaw, []) : featsRaw;
  return Array.isArray(list) ? list : [];
}

function entryMatches(entry, featKey) {
  const reg = getFeatEffect(featKey);
  const want = normalizeFeatName(reg?.name || featKey);
  const names = typeof entry === 'string' ? [entry] : [entry?.key, entry?.name];
  return names.some((n) => n && normalizeFeatName(n) === want);
}

/** Does this feats list (characters.feats) hold the feat? */
export function hasFeatIn(featsRaw, featKey) {
  return featEntries(featsRaw).some((e) => entryMatches(e, featKey));
}

/** Origin-slot feats (theme + versatile) for a character. */
export async function originFeatRows(characterId) {
  if (!characterId) return [];
  try {
    const rows = await dbAll('SELECT feat_key, choices_json, slot FROM character_origin_feats WHERE character_id = ?', [characterId]);
    return (rows || []).map((r) => ({ key: r.feat_key, choices: safeParse(r.choices_json, null), slot: r.slot || 'theme' }));
  } catch { return []; }
}

/** Does the character hold the feat in any slot? */
export async function characterHasFeat(characterId, featKey) {
  if (!characterId) return false;
  const row = await dbGet('SELECT feats FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (row && hasFeatIn(row.feats, featKey)) return true;
  return (await originFeatRows(characterId)).some((o) => entryMatches(o.key, featKey));
}

// ---------------------------------------------------------------------------
// Per-long-rest uses (Sage Advice = PB, Trapper = 2 free Hunter's Mark)
// ---------------------------------------------------------------------------

export function featUseMax(entry, level) {
  const m = entry?.uses?.max;
  if (m === 'pb') return pbForLevel(level);
  return Math.max(0, Number(m) || 0);
}

/** The `uses` record a newly taken feat starts with, or null. */
export function initialFeatUses(entry) {
  if (!entry?.uses) return null;
  return { used: 0, reset: entry.uses.reset || 'long' };
}

/** { max, used, left } for a feat the character holds, or null. */
export async function featUsesLeft(characterId, featKey) {
  const row = await dbGet('SELECT feats, level FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (!row) return null;
  const entry = featEntries(row.feats).find((e) => entryMatches(e, featKey));
  const reg = getFeatEffect(featKey);
  if (!entry || !reg?.uses) return null;
  const max = featUseMax(reg, row.level);
  const used = Math.min(max, Math.max(0, Number(entry?.uses?.used) || 0));
  return { max, used, left: max - used };
}

/** Spend one use. { success, left, max } or { success:false, reason }. */
export async function spendFeatUse(characterId, featKey) {
  const row = await dbGet('SELECT feats, level FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (!row) return { success: false, reason: 'no character' };
  const list = featEntries(row.feats);
  const idx = list.findIndex((e) => entryMatches(e, featKey));
  const reg = getFeatEffect(featKey);
  if (idx < 0 || !reg?.uses) return { success: false, reason: `the character does not have ${reg?.name || featKey}` };
  const max = featUseMax(reg, row.level);
  const cur = typeof list[idx] === 'string' ? { key: reg.key, name: reg.name } : { ...list[idx] };
  const used = Math.max(0, Number(cur?.uses?.used) || 0);
  if (used >= max) return { success: false, reason: `${reg.name} has no uses left (${max}/${max} spent) — they return on a long rest`, left: 0, max };
  cur.uses = { ...(cur.uses || {}), used: used + 1, reset: reg.uses.reset || 'long' };
  list[idx] = cur;
  await dbRun('UPDATE characters SET feats = ? WHERE id = ?', [JSON.stringify(list), characterId]);
  return { success: true, left: max - used - 1, max };
}

/** Long rest: every long-rest feat counter returns to 0. Returns the names reset. */
export async function resetFeatUses(characterId, restType) {
  if (restType !== 'long') return [];
  const row = await dbGet('SELECT feats FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (!row) return [];
  const list = featEntries(row.feats);
  const reset = [];
  const next = list.map((e) => {
    if (!e || typeof e !== 'object' || !e.uses) return e;
    if ((e.uses.reset || 'long') !== 'long' || !(Number(e.uses.used) > 0)) return e;
    reset.push(e.name || e.key);
    return { ...e, uses: { ...e.uses, used: 0 } };
  });
  if (reset.length) await dbRun('UPDATE characters SET feats = ? WHERE id = ?', [JSON.stringify(next), characterId]);
  return reset;
}

// ---------------------------------------------------------------------------
// Initiative — Alert (+PB, swap) and Tactician (+d4, swap)
// ---------------------------------------------------------------------------

/**
 * Initiative extras from feats. Alert is the 2024 book feat (+PB, swap
 * with a willing ally); the engine used to add Dex only — fixed here
 * beside Tactician because both ride the same hook. Tactician's d4 is
 * the player's die: the engine asks for it, never rolls it.
 */
export async function initiativeFeatsFor(characterId) {
  const out = { flat: 0, flatReasons: [], extraDie: null, canSwap: false, swapSources: [] };
  const row = await dbGet('SELECT feats, level FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (!row) return out;
  const alert = hasFeatIn(row.feats, 'alert') || (await originFeatRows(characterId)).some((o) => entryMatches(o.key, 'alert'));
  if (alert) {
    const pb = pbForLevel(row.level);
    out.flat += pb;
    out.flatReasons.push(`Alert +${pb}`);
    out.canSwap = true;
    out.swapSources.push('Alert');
  }
  if (hasFeatIn(row.feats, 'tactician')) {
    out.extraDie = 'd4';
    out.canSwap = true;
    out.swapSources.push('Tactician');
  }
  return out;
}

/** "swap with Lyra" / "swap initiative with Lyra" in the player's text. */
export function parseInitiativeSwap(text) {
  const m = String(text || '').match(/\bswap(?:\s+(?:my\s+)?initiative)?\s+with\s+([A-Za-z][A-Za-z' -]{0,40})/i);
  if (!m) return null;
  return m[1].replace(/\s+(?:and|then|please)\b.*$/i, '').trim() || null;
}

/**
 * Swap the player's initiative with a willing party member's (a
 * companion in the order). Enemies are never willing. Pure: returns
 * { order, swapped } or { error }.
 */
export function applyInitiativeSwap(order, playerKey, targetName) {
  const list = Array.isArray(order) ? order.map((c) => ({ ...c })) : [];
  const pi = list.findIndex((c) => c.type === 'player' && (!playerKey || c.key === playerKey));
  const want = String(targetName || '').trim().toLowerCase();
  const ti = list.findIndex((c) => String(c.name || '').trim().toLowerCase() === want);
  if (pi < 0) return { error: 'the player is not in the turn order' };
  if (ti < 0) return { error: `no one named "${targetName}" is in the fight` };
  if (list[ti].type !== 'companion') return { error: `${list[ti].name} is not a willing ally — only a party member can swap` };
  const a = list[pi].initiative;
  list[pi].initiative = list[ti].initiative;
  list[ti].initiative = a;
  return { order: list, swapped: { with: list[ti].name, playerNow: list[pi].initiative, allyNow: list[ti].initiative } };
}

// ---------------------------------------------------------------------------
// ROLL_REQUEST feat riders — the DM names the situation (Feat="Hound smell"),
// the engine checks the feat and applies the exact mechanic.
// ---------------------------------------------------------------------------

export const FEAT_CHECK_RIDERS = {
  'hound smell': { feat: 'hound', skills: ['perception'], effect: 'advantage', label: 'Hound: Perception based on smell' },
  'hound track': { feat: 'hound', skills: ['perception', 'survival'], effect: 'bonus', bonus: 5, label: 'Hound: tracking a creature by its scent (+5)' },
  'trapper track': { feat: 'trapper', skills: ['survival'], effect: 'advantage', label: 'Trapper: tracking or hunting a beast or a creature of Int 8 or lower' },
  'trapper harvest': { feat: 'trapper', skills: null, effect: 'advantage', label: 'Trapper: skinning, extracting or preserving organs from a creature researched or hunted for a week of downtime' },
  'mountaineer climb': { feat: 'mountaineer', skills: ['athletics'], effect: 'advantage', label: 'Mountaineer: Athletics for climbing' },
  'elusive': { feat: 'elusive', skills: ['perception', 'survival'], effect: 'disadvantage', onOthers: true, label: 'Elusive: tracking the player' },
};

/** Normalize a Feat= value to a rider key, or { error }. */
export function parseFeatRider(raw) {
  const s = String(raw || '').toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return null;
  if (FEAT_CHECK_RIDERS[s]) return s;
  const words = s.split(' ');
  const feat = words[0];
  const rest = words.slice(1).join(' ');
  const byFeat = Object.keys(FEAT_CHECK_RIDERS).filter((k) => k.split(' ')[0] === feat);
  if (byFeat.length === 1 && (!rest || byFeat[0].includes(rest))) return byFeat[0];
  const hit = byFeat.find((k) => rest && (k.endsWith(rest) || rest.includes(k.split(' ')[1] || '#')));
  if (hit) return hit;
  if (byFeat.length > 1) return { error: `Feat="${raw}" is ambiguous — use one of ${byFeat.map((k) => `"${k.replace(/\b\w/g, (c) => c.toUpperCase())}"`).join(', ')}` };
  return { error: `Feat="${raw}" is not a check feat the engine knows (${Object.keys(FEAT_CHECK_RIDERS).map((k) => `"${k.replace(/\b\w/g, (c) => c.toUpperCase())}"`).join(', ')})` };
}

/**
 * Judge a rider for one check. `isPcRoll`: the roller is the player.
 * Returns { applies, effect, bonus, reason } or { applies:false, reason }.
 */
export async function judgeFeatRider(characterId, rawFeat, kind, name, isPcRoll) {
  const key = parseFeatRider(rawFeat);
  if (!key) return null;
  if (key.error) return { applies: false, reason: key.error };
  const r = FEAT_CHECK_RIDERS[key];
  if (kind === 'save') return { applies: false, reason: `${r.label} applies to ability checks, never saves` };
  if (r.onOthers ? isPcRoll : !isPcRoll) {
    return { applies: false, reason: r.onOthers ? `${r.label} applies to a creature tracking the player, not to the player's own roll` : `${r.label} applies to the player's own check` };
  }
  let rider = r;
  let corrected = null;
  if (r.skills && !(kind === 'skill' && r.skills.includes(String(name).trim().toLowerCase()))) {
    // Live probe 2026-11-24: the DM tagged a scent-trail Survival check
    // "Hound smell". When exactly one sibling rider of the SAME feat (with
    // an explicit skill list) covers this skill, it is the only one that
    // can apply — use it and say so. Otherwise refuse.
    const skill = String(name).trim().toLowerCase();
    const sib = Object.entries(FEAT_CHECK_RIDERS).filter(([k, v]) => k !== key && v.feat === r.feat && !v.onOthers === !r.onOthers
      && Array.isArray(v.skills) && kind === 'skill' && v.skills.includes(skill));
    if (sib.length !== 1) {
      return { applies: false, reason: `${r.label} applies to ${r.skills.map((s) => s[0].toUpperCase() + s.slice(1)).join('/')} only` };
    }
    rider = sib[0][1];
    corrected = sib[0][0];
  }
  if (!(await characterHasFeat(characterId, rider.feat))) {
    return { applies: false, reason: `the player does not have the ${getFeatEffect(rider.feat)?.name || rider.feat} feat` };
  }
  return { applies: true, effect: rider.effect, bonus: rider.bonus || 0, reason: rider.label, ...(corrected ? { correctedTo: corrected } : {}) };
}

// ---------------------------------------------------------------------------
// Out-of-combat "this turn" (Elegant Maneuver, Seismic Touch): outside a
// turn order there is no turn, so a stamp on the player's action count
// stands in — the effect lasts through the reply to the action that used
// it and the player's next action, then lapses.
// ---------------------------------------------------------------------------

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]).catch(() => null);
  return safeParse(s?.session_config, {}) || {};
}
async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/** Called once at the start of every player action (dmSession). */
export async function notePlayerAction(sessionId) {
  try {
    const cfg = await readCfg(sessionId);
    cfg.playerActionSeq = (Number(cfg.playerActionSeq) || 0) + 1;
    await writeCfg(sessionId, cfg);
    return cfg.playerActionSeq;
  } catch { return null; }
}

function oocLapsed(field, seq) {
  if (!field || field.oocSeq == null) return false;
  return Number(seq || 0) > Number(field.oocSeq) + 1;
}

async function encounterNow(sessionId) {
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const enc = (await getCurrentEncounterSeq(sessionId)) || 0;
    if (!enc) return { enc: 0, ordered: false };
    const row = await dbGet('SELECT 1 AS one FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, enc]);
    return { enc, ordered: !!row };
  } catch { return { enc: 0, ordered: false }; }
}

/** The player's current feat state field ('elegant' | 'tremorsense'), lapse-checked. */
export async function readPlayerFeatField(sessionId, characterId, field) {
  const { getEntry, clearField } = await import('./actionStateService.js');
  const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
  const { enc } = await encounterNow(sessionId);
  const key = await ledgerKeyForPlayer(characterId);
  const entry = await getEntry(sessionId, enc, key);
  const val = entry?.[field] || null;
  if (!val) return null;
  if (val.oocSeq != null) {
    const cfg = await readCfg(sessionId);
    if (oocLapsed(val, cfg.playerActionSeq)) {
      await clearField(sessionId, enc, key, field);
      return null;
    }
  }
  return val;
}

/** Elegant Maneuver consumption: called by the ROLL_REQUEST PC branch. */
export async function consumeElegantManeuver(sessionId, characterId, kind, name) {
  if (kind !== 'skill') return null;
  const skill = String(name || '').trim().toLowerCase();
  if (skill !== 'acrobatics' && skill !== 'athletics') return null;
  try {
    const val = await readPlayerFeatField(sessionId, characterId, 'elegant');
    if (!val) return null;
    const { clearField } = await import('./actionStateService.js');
    const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
    const { enc } = await encounterNow(sessionId);
    await clearField(sessionId, enc, await ledgerKeyForPlayer(characterId), 'elegant');
    return { reason: 'Elegant Maneuver (bonus action): advantage on this check' };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Sage Advice — allies add PB to one check with the advised skill, once,
// within the next hour, if not already proficient.
// ---------------------------------------------------------------------------

/** For a server-rolled ally check: the Sage Advice bonus, spent on use. */
export async function consumeSageAdvice(sessionId, actorName, kind, name, proficient) {
  if (kind !== 'skill' || !sessionId) return null;
  try {
    const cfg = await readCfg(sessionId);
    const sa = cfg.sageAdvice;
    if (!sa || !sa.skill) return null;
    const now = Number(cfg.elapsedHours) || 0;
    if (sa.expiresAtHours != null && now >= Number(sa.expiresAtHours)) {
      delete cfg.sageAdvice; await writeCfg(sessionId, cfg); return null;
    }
    if (String(name).trim().toLowerCase() !== sa.skill.toLowerCase()) return null;
    const who = String(actorName || '').trim().toLowerCase();
    if (!Array.isArray(sa.allies) || !sa.allies.includes(who)) return null;
    if (Array.isArray(sa.used) && sa.used.includes(who)) return null;
    // Only a KNOWN non-proficient ally gains it; an unknown proficiency
    // (a stat-block companion) is not guessed at.
    if (proficient !== false) return null;
    sa.used = [...(sa.used || []), who];
    cfg.sageAdvice = sa;
    await writeCfg(sessionId, cfg);
    return { bonus: Number(sa.pb) || 2, reason: `Sage Advice from ${sa.advisor || 'the player'}: +${Number(sa.pb) || 2} (proficiency bonus)` };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// FEAT_USE marker — Elegant Maneuver, Seismic Touch, Sage Advice
// ---------------------------------------------------------------------------

async function useElegantManeuver(context, character) {
  const { setField, currentPos } = await import('./actionStateService.js');
  const { ledgerKeyForPlayer, checkBonus, spendBonus } = await import('./turnLedgerService.js');
  const { enc, ordered } = await encounterNow(context.sessionId);
  const key = await ledgerKeyForPlayer(character.id);
  if (ordered) {
    const bc = await checkBonus(context.sessionId, enc, key);
    if (!bc.allowed) return { success: false, reason: `Elegant Maneuver needs a bonus action — ${bc.reason}` };
    await spendBonus(context.sessionId, enc, key, 'Elegant Maneuver');
    const pos = await currentPos(context.sessionId, enc);
    // Ends with this turn: active while the order sits on the player's slot.
    const until = pos ? { round: pos.round, index: pos.index + 1 } : null;
    await setField(context.sessionId, enc, key, 'elegant', { until });
  } else {
    const cfg = await readCfg(context.sessionId);
    await setField(context.sessionId, enc, key, 'elegant', { until: null, oocSeq: Number(cfg.playerActionSeq) || 0 });
  }
  return {
    success: true, feat: 'Elegant Maneuver',
    systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Elegant Maneuver — ${character.name} spent ${ordered ? 'their bonus action' : 'a moment'}: their NEXT Acrobatics or Athletics check ${ordered ? 'this turn' : 'right now'} has advantage (the engine applies it to that ROLL_REQUEST, then it ends).`,
  };
}

async function useSeismicTouch(context, character) {
  const { setField, untilFor } = await import('./actionStateService.js');
  const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
  const { enc, ordered } = await encounterNow(context.sessionId);
  const key = await ledgerKeyForPlayer(character.id);
  if (ordered) {
    const until = await untilFor(context.sessionId, enc, key);
    await setField(context.sessionId, enc, key, 'tremorsense', { range: 60, until });
  } else {
    const cfg = await readCfg(context.sessionId);
    await setField(context.sessionId, enc, key, 'tremorsense', { range: 60, until: null, oocSeq: Number(cfg.playerActionSeq) || 0 });
  }
  return {
    success: true, feat: 'Seismic Touch',
    systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Seismic Touch — ${character.name} used their action to touch the ground: tremorsense 60 ft until the start of their next turn. They know where every creature touching the ground within 60 ft is, hidden or invisible ones included; it does not reveal flyers or anything not in contact with the ground. Tell them what they feel.`,
  };
}

async function useSageAdvice(context, character, parsed) {
  const skillRaw = String(parsed?.Skill || '').trim();
  const toolRaw = String(parsed?.Tool || '').trim();
  if (!skillRaw && !toolRaw) return { success: false, reason: 'Sage Advice needs Skill= (or Tool=) — the skill the player advises on' };
  const allies = String(parsed?.Allies || '').split(/\s*(?:,|\band\b|&)\s*/i).map((a) => a.trim()).filter(Boolean);
  if (allies.length === 0) return { success: false, reason: 'Sage Advice needs Allies= — the friendly creatures who heard the advice' };
  if (allies.length > 6) return { success: false, reason: 'Sage Advice reaches at most 6 friendly creatures' };
  const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [character.id]);
  if (skillRaw) {
    const { computePcModifier } = await import('./rollRequestService.js');
    const mod = computePcModifier(pcRow, 'skill', skillRaw);
    if (!mod) return { success: false, reason: `"${skillRaw}" is not a skill` };
    if (!mod.proficient) return { success: false, reason: `${character.name} is not proficient in ${skillRaw} — Sage Advice needs a skill they are proficient with` };
  }
  const spent = await spendFeatUse(character.id, 'sage_advice');
  if (!spent.success) return { success: false, reason: spent.reason };
  const cfg = await readCfg(context.sessionId);
  const now = Number(cfg.elapsedHours) || 0;
  const pb = pbForLevel(pcRow.level);
  cfg.sageAdvice = {
    advisor: character.name, skill: skillRaw || null, tool: toolRaw || null, pb,
    allies: allies.map((a) => a.toLowerCase()), alliesShown: allies, used: [],
    grantedAtHours: now, expiresAtHours: now + 1 + 1 / 6, // the 10 minutes of advice, then the hour
  };
  await writeCfg(context.sessionId, cfg);
  const what = skillRaw || `${toolRaw} (tool)`;
  return {
    success: true, feat: 'Sage Advice', usesLeft: spent.left, usesMax: spent.max,
    systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Sage Advice — ${character.name} spent 10 minutes advising ${allies.join(', ')} on ${what} (${spent.left}/${spent.max} uses left until a long rest). For the next hour, each of them who is NOT proficient in ${what} adds +${pb} to ONE ${what} check — the engine applies it on their next ${skillRaw ? 'ROLL_REQUEST with that skill' : 'tool check (you apply the +' + pb + ': tool checks are not engine rolls)'}. The 10 minutes pass on the clock: write [TIME_ADVANCE: Hours=0.17] if time matters.`,
  };
}

registerMarkerHandler('FEAT_USE', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const featRaw = String(parsed?.Feat || '').trim();
    const reg = getFeatEffect(featRaw);
    if (!reg) return { type: 'feat_use', success: false, reason: `unknown feat "${featRaw}"` };
    const character = await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId]);
    if (!character) return null;
    if (!(await characterHasFeat(character.id, reg.key))) {
      return { type: 'feat_use', success: false, reason: `${character.name} does not have the ${reg.name} feat`,
        systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: FEAT_USE refused — ${character.name} does not have the ${reg.name} feat. Do not narrate its effect.` };
    }
    let res;
    if (reg.key === 'elegant_maneuver') res = await useElegantManeuver(context, character);
    else if (reg.key === 'seismic_touch') res = await useSeismicTouch(context, character);
    else if (reg.key === 'sage_advice') res = await useSageAdvice(context, character, parsed);
    else return { type: 'feat_use', success: false, reason: `${reg.name} is not used with FEAT_USE (its effect is automatic or rides another marker)` };
    if (!res.success && !res.systemNote) {
      res.systemNote = `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${reg.name} was NOT used — ${res.reason}. Do not narrate its effect.`;
    }
    return { type: 'feat_use', ...res };
  } catch (e) {
    console.error('[featMechanicsService] FEAT_USE failed:', e.message);
    return { type: 'feat_use', success: false, reason: e.message };
  }
});

// ---------------------------------------------------------------------------
// Silver Tongue — Winning Words (contested Persuasion vs Insight; charm)
// ---------------------------------------------------------------------------

function langList(raw) {
  if (raw == null) return null;
  const parsed = safeParse(raw, null);
  const arr = Array.isArray(parsed) ? parsed : String(raw).split(/\s*[,;/]\s*/);
  const out = arr.map((l) => String(typeof l === 'object' ? (l?.name || '') : l).trim().toLowerCase()).filter(Boolean);
  return out.length ? out : null;
}

export function charmActive(c, cfg, round = null) {
  if (!c) return false;
  const now = Number(cfg?.elapsedHours) || 0;
  if (c.untilHours != null && now >= Number(c.untilHours)) return false;
  if (c.untilRound != null && round != null && Number(round) > Number(c.untilRound)) return false;
  return true;
}

/** End a Winning Words charm when the party harms its target. */
export async function endCharmOnHarm(sessionId, targetName, reason) {
  if (!sessionId || !targetName) return null;
  try {
    const cfg = await readCfg(sessionId);
    const list = Array.isArray(cfg.featCharms) ? cfg.featCharms : [];
    const want = String(targetName).trim().toLowerCase();
    const hit = list.find((c) => c.name.toLowerCase() === want || want.startsWith(c.name.toLowerCase()));
    if (!hit) return null;
    cfg.featCharms = list.filter((c) => c !== hit);
    await writeCfg(sessionId, cfg);
    return { ended: hit.name, reason };
  } catch { return null; }
}

registerMarkerHandler('WINNING_WORDS', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
    if (!character) return null;
    const refuse = (reason) => ({ type: 'winning_words', success: false, reason,
      systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Winning Words was NOT used — ${reason}. Do not narrate a charm.` });
    if (!targetRaw) return refuse('WINNING_WORDS needs Target=');
    if (!(await characterHasFeat(character.id, 'silver_tongue'))) return refuse(`${character.name} does not have the Silver Tongue feat`);
    if (parsed?.End === true || /^(true|yes|1)$/i.test(String(parsed?.End || ''))) {
      const ended = await endCharmOnHarm(context.sessionId, targetRaw, 'ended by the DM (harm done)');
      return { type: 'winning_words', success: !!ended, ended: ended?.ended || null,
        systemNote: ended ? `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: The Winning Words charm on ${ended.ended} has ended.` : undefined };
    }
    // Hostile: an enemy standing in the current fight is hostile by definition.
    const { enc } = await encounterNow(context.sessionId);
    if (enc) {
      const enemy = await dbGet("SELECT name FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND status = 'active' AND LOWER(name) = LOWER(?)", [context.sessionId, enc, targetRaw]).catch(() => null);
      if (enemy) return refuse(`${enemy.name} is hostile (an enemy in this fight) — Winning Words works only on a creature that is not hostile`);
    }
    const npc = await dbGet('SELECT id, name, languages, disposition_json FROM npcs WHERE LOWER(name) = LOWER(?) ORDER BY id DESC LIMIT 1', [targetRaw]).catch(() => null);
    const disp = safeParse(npc?.disposition_json, null);
    const attitude = String(parsed?.Attitude || disp?.attitude || disp?.toward_pc || '').toLowerCase();
    if (/hostile/.test(attitude)) return refuse(`${npc?.name || targetRaw} is hostile — Winning Words works only on a creature that is not hostile`);
    // Shared language: both sides' languages, when both are recorded.
    const pcLangs = langList(character.languages);
    const npcLangs = langList(npc?.languages);
    if (pcLangs && npcLangs && !pcLangs.some((l) => npcLangs.includes(l))) {
      return refuse(`${character.name} and ${npc?.name || targetRaw} share no language (${character.name}: ${pcLangs.join(', ')}; ${npc?.name || targetRaw}: ${npcLangs.join(', ')})`);
    }
    // The player's own deafness does not stop them talking; the target's
    // hearing is not stored for NPCs (stated gap) — the DM judges it.
    const { getNpcCheckModifier, requestPcRoll } = await import('./rollRequestService.js');
    const insight = await getNpcCheckModifier(npc?.name || targetRaw, 'skill', 'Insight', character.id).catch(() => null);
    const insightMod = Number.isFinite(Number(parsed?.Insight)) && parsed?.Insight != null && parsed?.Insight !== ''
      ? Number(parsed.Insight) : Number(insight?.modifier || 0);
    const npcDie = rollD20(`winning-words insight: ${npc?.name || targetRaw}`);
    const npcTotal = npcDie + insightMod;
    // Contest: the player must BEAT the Insight total (a tie keeps things as
    // they were). The pending roll's hidden DC is npcTotal + 1.
    const r = await requestPcRoll({
      sessionId: context.sessionId, characterId: character.id, kind: 'skill', name: 'Persuasion',
      dc: npcTotal + 1, looks: `Winning Words on ${npc?.name || targetRaw}`,
    });
    if (!r.success) return refuse(r.reason);
    const cfg = await readCfg(context.sessionId);
    if (cfg.pendingRoll) {
      cfg.pendingRoll.contest = { kind: 'winning_words', target: npc?.name || targetRaw, npcId: npc?.id || null, npcDie, insightMod, npcTotal };
      await writeCfg(context.sessionId, cfg);
    }
    return {
      type: 'winning_words', success: true, pending: true, target: npc?.name || targetRaw,
      systemNote: `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: Winning Words — ${character.name} speaks to ${npc?.name || targetRaw}. The engine rolled ${npc?.name || targetRaw}'s Wisdom (Insight) in secret and is asking the player for their Charisma (Persuasion) d20. Do not narrate the outcome until the result arrives. This contest REPLACES the Influence DC for this charm — do not also call an Influence check.`,
    };
  } catch (e) {
    console.error('[featMechanicsService] WINNING_WORDS failed:', e.message);
    return { type: 'winning_words', success: false, reason: e.message };
  }
});

/** Settle a resolved contest roll (called from resolveReportedRoll). */
export async function settleContest(sessionId, contest, res) {
  if (!contest || contest.kind !== 'winning_words') return null;
  const won = Number(res?.total) > Number(contest.npcTotal);
  const out = { kind: 'winning_words', target: contest.target, playerTotal: res?.total, npcTotal: contest.npcTotal, won };
  if (!won) return out;
  const cfg = await readCfg(sessionId);
  const now = Number(cfg.elapsedHours) || 0;
  let untilRound = null;
  try {
    const { enc, ordered } = await encounterNow(sessionId);
    if (ordered) {
      const row = await dbGet('SELECT round_number FROM combat_turn_state WHERE session_id = ? AND encounter_seq = ?', [sessionId, enc]);
      if (row) untilRound = Number(row.round_number || 1) + 10; // 1 minute = 10 rounds
    }
  } catch { /* clock-only expiry */ }
  const list = (Array.isArray(cfg.featCharms) ? cfg.featCharms : []).filter((c) => c.name.toLowerCase() !== String(contest.target).toLowerCase());
  list.push({ name: contest.target, npcId: contest.npcId || null, source: 'Winning Words', sinceHours: now, untilHours: now + 1 / 60, untilRound });
  cfg.featCharms = list;
  await writeCfg(sessionId, cfg);
  return { ...out, charmed: true };
}

export function formatContestFact(c) {
  if (!c) return '';
  return c.won
    ? `[WINNING WORDS — system fact: the player's Persuasion ${c.playerTotal} beat ${c.target}'s Insight ${c.npcTotal}. ${c.target} is CHARMED for 1 minute and regards the player as a friendly acquaintance. It ends at once if the player or a companion does anything harmful to ${c.target}. Narrate it.]`
    : `[WINNING WORDS — system fact: the player's Persuasion ${c.playerTotal} did not beat ${c.target}'s Insight ${c.npcTotal}. No charm — ${c.target} is unmoved by the words. Narrate it.]`;
}

// ---------------------------------------------------------------------------
// Trapper — free Hunter's Mark casts (2 per long rest, as a 1st-level spell)
// ---------------------------------------------------------------------------

/**
 * Should this cast use a Trapper free cast? `free`: the marker asked for
 * it (Free="true"); a cast with no slot left also falls back to a free
 * cast when one remains. Returns { free:true, left, max } (use spent),
 * { free:false } (pay a slot as usual) or { refused, reason }.
 */
export async function trapperFreeCast(characterId, spellName, level, { free = false, slotsLeft = 0 } = {}) {
  if (normalizeFeatName(spellName) !== normalizeFeatName("Hunter's Mark")) return { free: false };
  const row = await dbGet('SELECT feats FROM characters WHERE id = ?', [characterId]).catch(() => null);
  if (!row || !hasFeatIn(row.feats, 'trapper')) return { free: false };
  if (!free && slotsLeft > 0) return { free: false };
  if (Number(level) > 1 && free) return { refused: true, reason: "Trapper's free Hunter's Mark is cast as a 1st-level spell — cast it with a slot to upcast" };
  if (Number(level) > 1) return { free: false };
  const spent = await spendFeatUse(characterId, 'trapper');
  if (!spent.success) return free ? { refused: true, reason: spent.reason } : { free: false };
  return { free: true, left: spent.left, max: spent.max };
}

// ---------------------------------------------------------------------------
// Energy Affinity — the chosen affinity's resistance + cantrip
// ---------------------------------------------------------------------------

export function energyAffinityGrant(choices) {
  const reg = getFeatEffect('energy_affinity');
  const raw = choices && typeof choices === 'object' ? (choices.affinity ?? choices.energy_affinity ?? null) : (typeof choices === 'string' ? choices : null);
  const key = String(raw || '').trim().toLowerCase();
  const g = reg?.choices?.affinity?.[key];
  return g ? { affinity: key, resistance: g.resistance, cantrip: g.cantrip } : null;
}

/** The character's Energy Affinity grant, if any (theme or versatile slot). */
export async function energyAffinityFor(characterId) {
  for (const o of await originFeatRows(characterId)) {
    if (entryMatches(o.key, 'energy_affinity')) return energyAffinityGrant(o.choices);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Sling Expert — damage dice
// ---------------------------------------------------------------------------

export const SIZE_ORDER = ['tiny', 'small', 'medium', 'large', 'huge', 'gargantuan'];
export function sizeIndex(size) {
  const s = String(size || '').trim().toLowerCase().split(/[\s/]+/)[0];
  const i = SIZE_ORDER.indexOf(s);
  return i < 0 ? null : i;
}

/**
 * Sling Expert dice for one sling hit. `distanceFt`: the attack distance
 * (null = unknown); `normalRange`: the sling's first range increment;
 * sizes are Tiny..Gargantuan strings (null = unknown). Each clause is
 * judged on its own; an unknown fact skips its die and says so.
 */
export function slingExpertDice({ isSling, distanceFt, normalRange = 30, attackerSize, targetSize }) {
  if (!isSling) return { dice: [], notes: [] };
  const dice = [];
  const notes = [];
  if (distanceFt == null) notes.push('Sling Expert: distance unknown — the first-range +1d4 is not added (the DM can add it if the target is within 30 ft)');
  else if (Number(distanceFt) <= Number(normalRange)) dice.push('1d4');
  const a = sizeIndex(attackerSize);
  const t = sizeIndex(targetSize);
  if (a == null || t == null) notes.push('Sling Expert: a size is unknown — the larger-target +1d4 is not added');
  else if (t - a === 1) dice.push('1d4');
  return { dice, notes };
}

// ---------------------------------------------------------------------------
// Quick Draw — creatures moving within 5 ft provoke (ranged/thrown in hand)
// ---------------------------------------------------------------------------

/** Is the player wielding a ranged or thrown weapon right now? Reads the
 *  same equipped-weapon resolution combat uses (calculateCombatStats). */
export async function wieldsRangedOrThrown(characterRow) {
  try {
    const { calculateCombatStats } = await import('./combatStatsService.js');
    const stats = calculateCombatStats(characterRow);
    return [stats?.weapon, stats?.offHandWeapon].filter(Boolean).some((w) => {
      const props = (Array.isArray(w.properties) ? w.properties : []).map((p) => String(p).toLowerCase());
      return w.rangeType === 'ranged' || props.some((p) => p.startsWith('thrown'));
    });
  } catch { return false; }
}

// ---------------------------------------------------------------------------
// Player-named feats — a directive appended to THIS action (live probe
// 2026-11-24: with the teaching only in the system prompt, gemma4:12b
// narrated "Winning Words" as an instant success with no marker and no
// roll). Like the dice directive, it rides the action text the model
// sees; the stored history keeps the clean action.
// ---------------------------------------------------------------------------

const FEAT_ACTION_DIRECTIVES = [
  { feat: 'silver_tongue', re: /\b(winning words|silver tongue)\b/i,
    text: 'The player is using Winning Words (Silver Tongue). Write [WINNING_WORDS: Target="<the creature\'s name>"] now and do NOT narrate whether it works — the engine runs the Persuasion vs Insight contest and tells you the result.' },
  { feat: 'elegant_maneuver', re: /\belegant maneuver\b/i,
    text: 'The player is using Elegant Maneuver. Write [FEAT_USE: Feat="Elegant Maneuver"] BEFORE the Acrobatics or Athletics [ROLL_REQUEST] for their move.' },
  { feat: 'seismic_touch', re: /\bseismic touch\b/i,
    text: 'The player is using Seismic Touch. Write [FEAT_USE: Feat="Seismic Touch"]; the engine records the tremorsense.' },
  { feat: 'sage_advice', re: /\bsage advice\b/i,
    text: 'The player is using Sage Advice. Write [FEAT_USE: Feat="Sage Advice" Skill="<the skill>" Allies="<the allies\' names>"].' },
  { feat: 'hound', re: /\b(hound|scent|smell|sniff)/i,
    text: 'The player is using their Hound nose. If this needs a check, add Feat="Hound smell" (Perception to notice by smell) or Feat="Hound track" (following a scent trail, Survival or Perception) to the [ROLL_REQUEST].' },
  { feat: 'mountaineer', re: /\bclimb/i,
    text: 'The player has Mountaineer. If the climb needs a check, add Feat="Mountaineer climb" to the Athletics [ROLL_REQUEST].' },
  { feat: 'trapper', re: /\b(track|tracking|trail|hunt|skin|harvest)/i,
    text: 'The player has Trapper. If this needs a check, add Feat="Trapper track" (Survival to track or hunt a beast or a creature of Int 8 or lower) or Feat="Trapper harvest" (skinning, extracting, preserving) to the [ROLL_REQUEST].' },
  { feat: 'trapper', re: /\b(?:free|trapper)\b[^.]*\bhunter'?s mark\b|\bhunter'?s mark\b[^.]*\b(?:free|trapper)\b/i,
    text: 'The player casts Hunter\'s Mark with a Trapper free cast: write [SPELL_CAST: Spell="Hunter\'s Mark" Level=1 Free="true" Target="<target>"].' },
];

/** The directive for feats the player names in this action (and holds). */
export function featActionDirective(featsRaw, action) {
  const lines = FEAT_ACTION_DIRECTIVES
    .filter((d) => d.re.test(String(action || '')) && hasFeatIn(featsRaw, d.feat))
    .map((d) => d.text);
  return lines.length ? `\n\n[FEAT — system note: ${lines.join(' ')}]` : '';
}

// ---------------------------------------------------------------------------
// DM prompt — the feat state lines
// ---------------------------------------------------------------------------

export function formatFeatStateLines(character, originFeats = []) {
  const lines = [];
  const feats = featEntries(character?.feats);
  const level = character?.level || 1;
  for (const key of ['trapper', 'sage_advice']) {
    const e = feats.find((x) => entryMatches(x, key));
    if (!e) continue;
    const reg = getFeatEffect(key);
    const max = featUseMax(reg, level);
    const used = Math.min(max, Math.max(0, Number(e?.uses?.used) || 0));
    if (key === 'trapper') lines.push(`Trapper: Hunter's Mark free casts ${max - used}/${max} left (SPELL_CAST Spell="Hunter's Mark" Level=1 Free="true"; Wisdom is the casting ability; with a slot beyond that)`);
    else lines.push(`Sage Advice: ${max - used}/${max} uses left until a long rest ([FEAT_USE: Feat="Sage Advice" Skill="<skill>" Allies="<names>"])`);
  }
  const ea = (originFeats || []).find((o) => entryMatches(o.key || o.feat_key, 'energy_affinity'));
  if (ea) {
    const g = energyAffinityGrant(ea.choices || ea.choices_data);
    if (g) lines.push(`Energy Affinity (${g.affinity}): resistance to ${g.resistance} damage (engine-applied to enemy spell damage); knows the ${g.cantrip} cantrip (granted)`);
  }
  return lines;
}

export default {
  pbForLevel, hasFeatIn, characterHasFeat, originFeatRows, featUseMax, initialFeatUses, featUsesLeft,
  spendFeatUse, resetFeatUses, initiativeFeatsFor, parseInitiativeSwap, applyInitiativeSwap,
  FEAT_CHECK_RIDERS, parseFeatRider, judgeFeatRider, notePlayerAction, readPlayerFeatField,
  consumeElegantManeuver, consumeSageAdvice, endCharmOnHarm, settleContest, formatContestFact,
  charmActive, trapperFreeCast, energyAffinityGrant, energyAffinityFor, slingExpertDice, sizeIndex,
  wieldsRangedOrThrown, formatFeatStateLines,
};
