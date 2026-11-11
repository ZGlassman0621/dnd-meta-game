/**
 * timeEvolutionService — places change with world time (time-evolution
 * engine, 2026-11-03, Zach-approved locked design).
 *
 * A scene is a place in history, not a frozen snapshot and not a level
 * that resets. Its identity, layout, and history persist; its
 * occupants, use, contents/loot state, and condition evolve with
 * elapsed world time and world events. A cleared dungeon NEVER
 * respawns its original occupants — a new occupant is a new chapter
 * in the same place's history.
 *
 * Triggers (both, per the locked design):
 *   - return: evaluateReturn() on re-entry (suggests; also stamps the
 *     last-visited anchor). Application is always DM-proposed.
 *   - tick: tickEvolution() evaluates every scene in a campaign on
 *     world-clock advance and returns candidates whose bands have
 *     been crossed. It writes NOTHING and creates NO news: news
 *     reports an evolution that already happened, never a spoiler.
 *
 * Decision: DM-PROPOSED, system-checked. applyEvolution() validates
 * coherence (reusing dungeonGenerationService.checkCoherence, which
 * is itself heuristic — climate keywords + era validity, NOT a canon
 * oracle, because there is no machine-readable FR-history table).
 * Anomalies without justification are refused, never stored silently.
 * One hard rule overrides justification: a previously removed
 * occupant can never return, justified or not.
 *
 * Bands are guidelines, event-modulated (elapsed years from the
 * time anchor: last-evolved, else generated, else seed timeAnchor):
 *   <5 years: stable (mostly same; loot depletion begins)
 *   5–20: minor (partial reoccupation)
 *   20–100: major (major reoccupation / change of use)
 *   100+: settlement (settlement-level evolution)
 * War / faction collapse escalate one band; disaster escalates and
 * breaks protection; protection otherwise holds a place at stable
 * past its band.
 *
 * News channels (only on an applied evolution, never for one that
 * did not happen): settlement → song; historic note → story;
 * via a network → rumor; otherwise background news. Visiting is
 * not a news channel — visiting shows the change directly.
 *
 * Storage: migration 102 adds scenes last-evolved / last-visited /
 * current_occupants / current_use plus scene_evolution_history
 * (chapters, the audit trail) and scene_evolution_news (records
 * the DM prompt can read). The seed packet in seed_json is NEVER
 * rewritten — it is the place's birth record.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { checkCoherence } from './dungeonGenerationService.js';
import { SITE_ERAS } from './dungeonContentService.js';
import { getClock } from './scheduleService.js';

export const BANDS = ['stable', 'minor', 'major', 'settlement'];
export const BAND_ORDER = { stable: 0, minor: 1, major: 2, settlement: 3 };
export const FORCING_EVENTS = ['war', 'disaster', 'faction_collapse'];
export const NEWS_CHANNELS = ['news', 'story', 'song', 'rumor'];

export function bandForElapsedYears(years) {
  if (years == null || Number.isNaN(years)) return 'stable';
  if (years < 5) return 'stable';
  if (years < 20) return 'minor';
  if (years < 100) return 'major';
  return 'settlement';
}

export function suggestBand(elapsedYears, { event = null, protected: isProtected = false } = {}) {
  const base = bandForElapsedYears(elapsedYears);
  const ev = event ? String(event).toLowerCase() : null;
  const forcing = ev && FORCING_EVENTS.includes(ev);
  if (isProtected && !(ev === 'disaster')) {
    return { band: 'stable', base, held: true, escalated: false };
  }
  if (forcing) {
    const idx = Math.min(BAND_ORDER[base] + 1, 3);
    return { band: BANDS[idx], base, held: false, escalated: idx > BAND_ORDER[base] };
  }
  return { band: base, base, held: false, escalated: false };
}

function seedOf(scene) {
  return safeParse(scene?.seed_json, {}) || {};
}

function anchorOf(scene) {
  if (scene?.last_evolved_world_day != null) {
    return { worldDay: Number(scene.last_evolved_world_day), year: scene.last_evolved_world_year ?? null };
  }
  if (scene?.generated_world_day != null) {
    return { worldDay: Number(scene.generated_world_day), year: scene.generated_world_year ?? null };
  }
  const ta = seedOf(scene)?.timeAnchor;
  if (ta?.worldDay != null) return { worldDay: Number(ta.worldDay), year: ta.year ?? null };
  return null;
}

export function elapsedYearsFor(scene, currentWorldDay) {
  const anchor = anchorOf(scene);
  if (!anchor || currentWorldDay == null) return null;
  return Math.max(0, (Number(currentWorldDay) - anchor.worldDay) / 365);
}

export async function getScene(sceneId) {
  return dbGet('SELECT * FROM scenes WHERE id = ?', [sceneId]).catch(() => null);
}

export async function latestChapter(sceneId) {
  return dbGet(
    'SELECT * FROM scene_evolution_history WHERE scene_id = ? ORDER BY id DESC LIMIT 1',
    [sceneId]
  ).catch(() => null);
}

export async function currentOccupants(scene) {
  if (scene?.current_occupants) return scene.current_occupants;
  const ch = await latestChapter(scene.id);
  if (ch?.new_occupants) return ch.new_occupants;
  return seedOf(scene)?.siteDice?.occupant ?? null;
}

export async function currentUse(scene) {
  if (scene?.current_use) return scene.current_use;
  const ch = await latestChapter(scene.id);
  return ch?.new_use ?? null;
}

export async function removedOccupants(sceneId) {
  const rows = await dbAll(
    'SELECT previous_occupants FROM scene_evolution_history WHERE scene_id = ?',
    [sceneId]
  ).catch(() => []);
  const out = new Set();
  for (const r of rows || []) {
    if (r?.previous_occupants) out.add(String(r.previous_occupants).toLowerCase());
  }
  return out;
}

function newsChannelFor({ band, historicNote, viaNetwork }) {
  if (band === 'settlement') return 'song';
  if (historicNote) return 'story';
  if (viaNetwork) return 'rumor';
  return 'news';
}

/**
 * Evaluate (suggest only) — used by both triggers. Never applies,
 * never writes history or news. Return trigger callers may stamp
 * last_visited separately via markVisited().
 */
export async function evaluateEvolution(sceneId, { currentWorldDay = null, currentYear = null, event = null, protected: isProtected = false } = {}) {
  const scene = await getScene(sceneId);
  if (!scene) return { success: false, reason: `unknown scene: ${sceneId}` };
  const elapsedYears = elapsedYearsFor(scene, currentWorldDay);
  const suggestion = suggestBand(elapsedYears, { event, protected: isProtected });
  return {
    success: true, sceneId: scene.id, name: scene.name,
    elapsedYears, band: suggestion.band, baseBand: suggestion.base,
    held: suggestion.held, escalated: suggestion.escalated,
    currentOccupants: await currentOccupants(scene), currentUse: await currentUse(scene),
    anchorKnown: elapsedYears != null,
  };
}

export async function markVisited(sceneId, { currentWorldDay = null, currentYear = null } = {}) {
  if (currentWorldDay == null) return false;
  await dbRun(
    'UPDATE scenes SET last_visited_world_day = ?, last_visited_world_year = ? WHERE id = ?',
    [currentWorldDay, currentYear, sceneId]
  ).catch(() => null);
  return true;
}

/** Return trigger: suggestion + last-visited stamp. No chapter, no news. */
export async function evaluateReturn(sceneId, opts = {}) {
  const res = await evaluateEvolution(sceneId, opts);
  if (res.success) await markVisited(sceneId, opts);
  return res;
}

/**
 * Tick trigger: candidates whose suggested band exceeds their last
 * applied band (or is non-stable with no history yet). Writes
 * nothing, creates no news — a candidate is not an evolution.
 * Deliberately does NOT read FF_LIVING_WORLD_TICK: this is a
 * callable hook for tick callers, and it must not change the
 * living-world tick's own gating behaviour.
 */
export async function tickEvolution(campaignId, { currentWorldDay = null, currentYear = null } = {}) {
  const scenes = await dbAll(
    'SELECT * FROM scenes WHERE campaign_id = ? ORDER BY id ASC', [campaignId]
  ).catch(() => []);
  const candidates = [];
  for (const scene of scenes || []) {
    const ev = await evaluateEvolution(scene.id, { currentWorldDay, currentYear });
    if (!ev.success || ev.elapsedYears == null) continue;
    const ch = await latestChapter(scene.id);
    const lastBand = ch?.band ?? null;
    const lastOrder = lastBand ? BAND_ORDER[lastBand] : -1;
    if (BAND_ORDER[ev.band] > lastOrder && ev.band !== 'stable') {
      candidates.push({ ...ev, lastBand });
    }
  }
  return { success: true, campaignId, candidates };
}

/**
 * Apply a DM-proposed evolution. Anomalies without justification are
 * refused (nothing stored); a respawn of a previously removed
 * occupant is refused even WITH justification — cleared occupants
 * never return. A proposal that changes nothing is refused.
 */
export async function applyEvolution(sceneId, {
  occupants = null, use = null, lootState = null, condition = null,
  hazardFamily = null, siteEra = null, event = null, protected: isProtected = false,
  justification = null, historicNote = false, viaNetwork = false,
  partyDeed = false, partySignificant = false,
  currentWorldDay = null, currentYear = null,
} = {}) {
  const scene = await getScene(sceneId);
  if (!scene) return { success: false, reason: `unknown scene: ${sceneId}`, stored: false };
  const ev = await evaluateEvolution(sceneId, { currentWorldDay, currentYear, event, protected: isProtected });
  const prevOccupants = await currentOccupants(scene);
  const prevUse = await currentUse(scene);
  const newOccupants = occupants != null ? String(occupants).trim() : null;
  const newUse = use != null ? String(use).trim() : null;
  const changed = (newOccupants && newOccupants !== prevOccupants)
    || (newUse && newUse !== prevUse) || lootState != null || condition != null;
  if (!changed) {
    return { success: false, reason: 'evolution proposes no change to occupants, use, loot, or condition', stored: false };
  }
  // Hard rule: cleared occupants never return, justified or not.
  if (newOccupants) {
    const removed = await removedOccupants(sceneId);
    if (removed.has(newOccupants.toLowerCase())) {
      return { success: false, reason: `cleared occupants never return: '${newOccupants}' was previously removed from this place`, stored: false };
    }
  }
  // Coherence: reuse the generation guardrail (heuristic, not a canon
  // oracle). Era validity + climate clash against the scene region.
  const seed = seedOf(scene);
  const flags = [];
  if (siteEra != null && !SITE_ERAS.includes(siteEra)) {
    flags.push({ code: 'unknown_site_era', reason: `unknown site era: ${siteEra} (known: ${SITE_ERAS.join(', ')})` });
  }
  if (hazardFamily) {
    const chk = checkCoherence({ region: seed.region, siteDice: { hazardFamily } }, { siteEra: siteEra ?? seed.siteEra ?? 'sealed' });
    flags.push(...chk.flags);
  }
  const cleanJustification = justification != null ? String(justification).trim() : '';
  if (flags.length && !cleanJustification) {
    return { success: false, stored: false, needsJustification: true, coherence: flags,
      reason: 'coherence flags need a Justification= (the story that makes this change make sense) before this evolution is stored — nothing was stored' };
  }
  const band = ev.band;
  const chapter = await dbRun(
    `INSERT INTO scene_evolution_history
       (scene_id, world_day, world_year, band, previous_occupants, new_occupants, new_use, loot_state, condition, justification, flags_json, event_override, protected)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [scene.id, currentWorldDay, currentYear, band, prevOccupants, newOccupants, newUse,
     lootState, condition, cleanJustification || null, JSON.stringify(flags),
     event, isProtected ? 1 : 0]
  );
  await dbRun(
    `UPDATE scenes SET last_evolved_world_day = ?, last_evolved_world_year = ?,
       current_occupants = COALESCE(?, current_occupants), current_use = COALESCE(?, current_use) WHERE id = ?`,
    [currentWorldDay, currentYear, newOccupants, newUse, scene.id]
  ).catch(() => null);
  const channel = newsChannelFor({ band, historicNote, viaNetwork });
  const body = `${scene.name}: ${prevOccupants ?? 'unknown occupants'} → ${newOccupants ?? prevOccupants} (${band} change${prevUse || newUse ? `, use ${prevUse ?? '—'} → ${newUse ?? prevUse}` : ''})${partyDeed || partySignificant ? ' — a place where the party did something large and meaningful' : ''}`;
  await dbRun(
    'INSERT INTO scene_evolution_news (scene_id, channel, body, world_day, world_year, party_significant) VALUES (?, ?, ?, ?, ?, ?)',
    [scene.id, channel, body, currentWorldDay, currentYear, (partyDeed || partySignificant) ? 1 : 0]
  ).catch(() => null);
  return { success: true, stored: true, sceneId: scene.id, chapterId: Number(chapter.lastInsertRowid),
    band, baseBand: ev.baseBand, held: ev.held, escalated: ev.escalated,
    previousOccupants: prevOccupants, newOccupants, newUse,
    coherence: { flags, justification: cleanJustification || null }, newsChannel: channel };
}

function systemNoteFor(text) {
  return `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${text}`;
}

/**
 * EVOLVE_PLACE marker (DM only, by design — the DM proposes, the
 * system checks). Example:
 *   [EVOLVE_PLACE: Scene=12 Occupants="bandits" Use="bandit camp" Event="faction_move"]
 * With a coherence flag blocked, re-emit with Justification= carrying
 * the story that makes the change make sense. Never respawns a
 * cleared occupant, justified or not. Never auto-enters: the party
 * must still choose to visit.
 */
registerMarkerHandler('EVOLVE_PLACE', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const sceneRaw = parsed?.Scene;
    const sceneId = sceneRaw != null && String(sceneRaw).trim() !== '' ? Number(sceneRaw) : NaN;
    if (Number.isNaN(sceneId)) {
      return { type: 'evolve_place', success: false, reason: 'EVOLVE_PLACE needs Scene= (a scene id)',
        systemNote: systemNoteFor('No evolution was applied: EVOLVE_PLACE needs Scene=.') };
    }
    const scene = await getScene(sceneId);
    if (!scene) {
      return { type: 'evolve_place', success: false, reason: `unknown scene: ${sceneId}`,
        systemNote: systemNoteFor(`No evolution was applied: unknown scene ${sceneId}.`) };
    }
    let clock = null;
    try { clock = await getClock(scene.campaign_id); } catch { clock = null; }
    const truthy = (v) => v === true || String(v || '').toLowerCase() === 'true';
    const result = await applyEvolution(sceneId, {
      occupants: parsed?.Occupants ?? null, use: parsed?.Use ?? null,
      lootState: parsed?.LootState ?? null, condition: parsed?.Condition ?? null,
      hazardFamily: parsed?.HazardFamily ?? null, siteEra: parsed?.SiteEra ?? null,
      event: parsed?.Event ?? null, protected: truthy(parsed?.Protected),
      justification: parsed?.Justification ?? null, historicNote: truthy(parsed?.HistoricNote),
      viaNetwork: truthy(parsed?.ViaNetwork), partyDeed: truthy(parsed?.PartyDeed),
      currentWorldDay: clock?.day ?? null, currentYear: clock?.year ?? null,
    });
    if (!result.success) {
      return { type: 'evolve_place', success: false, reason: result.reason,
        needsJustification: result.needsJustification || false, coherence: result.coherence || null,
        systemNote: systemNoteFor(`No evolution was applied: ${result.reason}`) };
    }
    return { type: 'evolve_place', success: true, sceneId: result.sceneId, band: result.band,
      newOccupants: result.newOccupants, newUse: result.newUse, newsChannel: result.newsChannel,
      coherence: result.coherence || null };
  } catch (e) {
    console.error('[timeEvolutionService] EVOLVE_PLACE handler failed:', e.message);
    return null;
  }
});

export default { bandForElapsedYears, suggestBand, elapsedYearsFor, getScene, evaluateEvolution, evaluateReturn, markVisited, tickEvolution, applyEvolution, BANDS, BAND_ORDER, FORCING_EVENTS, NEWS_CHANNELS };
