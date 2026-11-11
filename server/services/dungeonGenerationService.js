/**
 * dungeonGenerationService — Dungeon generation wiring (2026-11-02).
 *
 * The generation pipeline already existed, tested, with no production
 * caller: seed packet (sceneSeedService) -> skeleton
 * (dungeonSkeletonService) -> content (dungeonContentService) ->
 * storage (dungeonSceneStorageService.storeScene). This module is ONLY
 * the caller + the coherence guardrail + the time anchor. It invents
 * no generation logic of its own.
 *
 * Locked design (Zach, 2026-11-02):
 *  - Trigger: DM MARKER ONLY. The DM's world decides where dungeons
 *    are. No auto-generation on location entry, no player-triggered
 *    generation by wandering. "DM" here is the AI DM system, not the
 *    player: party level/size come AUTO from the session party sheet,
 *    purpose/region/era come from the DM system's world knowledge
 *    (supplied in the marker), never from a form the player fills in.
 *  - Persistence is historical, NOT frozen and NOT regenerate-on-
 *    visit: a place's identity/layout/history persist, but occupants,
 *    use, and contents EVOLVE with world time. THIS build records the
 *    scene with its seed packet and a world-day time anchor so a later
 *    evolution layer can act on elapsed time. It does NOT build the
 *    evolution engine, does NOT freeze the scene as unchangeable, and
 *    does NOT regenerate it on return (see deduplication below).
 *  - Coherence guardrails: generation validates against region/era
 *    and flags anomalous combinations. A flagged scene is NOT stored
 *    silently: the DM must supply a Justification (the story that
 *    makes it make sense) before it is stored. The DM's final choice
 *    stands, but never as a silent nonsense result. Fantasy allows
 *    anything — a frozen wasteland in a desert, a desert in a cave in
 *    a frozen wasteland — with a great story to go along with it.
 *  - Scope: generation + storage ONLY. Nothing here places the party
 *    inside a dungeon. Entry is the party's choice, via movement and
 *    exploration; a fight in a generated dungeon links via the
 *    already-built scene wiring (COMBAT_START Scene=/Room=, SET_ROOM).
 *
 * Honest limit of the coherence check (read before extending it):
 * there is NO machine-readable FR-history table in the services this
 * module can check against — the seeded history is prose, not a
 * canon database. So checkCoherence implements what the code CAN
 * check: a small, explicit climate-clash table (region keywords vs
 * hazard family) plus site-era validity (already enforced by content
 * assignment). Unknown regions pass with no flag — an unknown region
 * is not evidence of nonsense, and false-positive flags would teach
 * the DM to ignore the guardrail. A future canon table can extend
 * this function without changing its contract: flags + required
 * justification, or no flags.
 */

import { dbGet, dbRun } from '../database.js';
import { buildSeedPacket } from './sceneSeedService.js';
import { generateBestSkeleton, validateSkeleton } from './dungeonSkeletonService.js';
import { SITE_ERAS } from './dungeonContentService.js';
import { storeScene, loadScene } from './dungeonSceneStorageService.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { getClock } from './scheduleService.js';

/**
 * Climate-clash table: region keyword -> hazard families that clash
 * with that climate. Keyword match is substring, case-insensitive.
 * A desert with a water or cold hazard family is the canonical
 * example: possible in fantasy, but only with a story (an ancient
 * irrigation curse, a bound water elemental, a magical disaster).
 */
export const CLIMATE_CLASHES = {
  desert: ['water', 'cold'],
  frozen: ['fire'],
  tundra: ['fire'],
  glacier: ['fire'],
  ice: ['fire'],
};

/**
 * Pure coherence check. Returns { flags: [{code, reason}], needsJustification }.
 * Never throws for an unknown region — unknown regions pass.
 */
export function checkCoherence(seedPacket, { siteEra = 'sealed' } = {}) {
  const flags = [];
  if (!SITE_ERAS.includes(siteEra)) {
    flags.push({ code: 'unknown_site_era', reason: `unknown site era: ${siteEra} (known: ${SITE_ERAS.join(', ')})` });
  }
  const region = String(seedPacket?.region || '').toLowerCase();
  const hazard = String(seedPacket?.siteDice?.hazardFamily || '').toLowerCase();
  if (region && hazard) {
    for (const [keyword, clashes] of Object.entries(CLIMATE_CLASHES)) {
      if (region.includes(keyword) && clashes.includes(hazard)) {
        flags.push({
          code: 'climate_hazard_clash',
          reason: `hazard family '${hazard}' clashes with region '${seedPacket.region}' (${keyword} climate) — possible in fantasy, but needs a justifying story`,
        });
      }
    }
  }
  return { flags, needsJustification: flags.length > 0 };
}

/**
 * Resolve the session party: PC level + 1 + active companions.
 * characterId wins; otherwise the session's character_id is used.
 * Returns null when no character can be resolved (caller refuses).
 */
export async function resolveParty({ sessionId = null, characterId = null } = {}) {
  let id = characterId;
  if (!id && sessionId) {
    const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]).catch(() => null);
    id = session?.character_id ?? null;
  }
  if (!id) return null;
  const pc = await dbGet('SELECT id, level, campaign_id FROM characters WHERE id = ?', [id]).catch(() => null);
  if (!pc) return null;
  let companionCount = 0;
  try {
    const row = await dbGet(
      `SELECT COUNT(*) AS n FROM companions WHERE recruited_by_character_id = ? AND status = 'active'`, [id]
    );
    companionCount = Number(row?.n || 0);
  } catch { companionCount = 0; }
  return {
    characterId: pc.id,
    campaignId: pc.campaign_id ?? 0,
    level: Number(pc.level) || 1,
    size: 1 + companionCount,
  };
}

/**
 * Find an already-stored dungeon for this location/name. By location
 * when one is given, otherwise by (campaign, name). Returns the scene
 * row or null. Deduplication key is deliberately narrow: a different
 * name in the same campaign is a different dungeon.
 */
export async function findExistingScene({ campaignId, locationId = null, name } = {}) {
  if (locationId != null) {
    return dbGet(
      `SELECT id FROM scenes WHERE campaign_id = ? AND location_id = ? AND kind = 'dungeon' ORDER BY id ASC LIMIT 1`,
      [campaignId, locationId]
    ).catch(() => null);
  }
  return dbGet(
    `SELECT id FROM scenes WHERE campaign_id = ? AND name = ? AND kind = 'dungeon' ORDER BY id ASC LIMIT 1`,
    [campaignId, name]
  ).catch(() => null);
}

/**
 * Generate + store one dungeon. Never auto-enters, never links an
 * encounter, never overwrites an existing scene. On any refusal the
 * result is { success: false, reason, stored: false } and NOTHING is
 * stored by this call (a blocked coherence result stores nothing;
 * a storeScene throw is surfaced, not swallowed).
 */
export async function generateDungeon({
  sessionId = null, characterId = null, name, purpose = null, region = null,
  siteEra = 'sealed', locationId = null, justification = null,
  roomCount = null, pickFn,
} = {}) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return { success: false, reason: 'GENERATE_DUNGEON needs Name=', stored: false };
  const party = await resolveParty({ sessionId, characterId });
  if (!party) return { success: false, reason: 'GENERATE_DUNGEON needs a session character (party level/size come from the party sheet)', stored: false };

  const existing = await findExistingScene({ campaignId: party.campaignId, locationId, name: cleanName });
  if (existing) {
    const loaded = await loadScene(existing.id).catch(() => null);
    return {
      success: true, existing: true, stored: false, sceneId: existing.id,
      roomKeys: loaded ? loaded.rooms.map((r) => r.roomKey || r.key) : [],
      reason: `a dungeon already exists here (scene ${existing.id}) — returned, not overwritten`,
    };
  }

  const seedPacket = buildSeedPacket({
    partyLevel: party.level, partySize: party.size, purpose, region, pickFn,
  });
  const coherence = checkCoherence(seedPacket, { siteEra });
  const cleanJustification = justification != null ? String(justification).trim() : '';
  if (coherence.needsJustification && !cleanJustification) {
    return {
      success: false, stored: false, needsJustification: true, coherence: coherence.flags,
      reason: 'coherence flags need a Justification= (the story that makes this combination make sense) before this dungeon is stored — nothing was stored',
    };
  }
  if (coherence.flags.length) seedPacket.coherence = { flags: coherence.flags, justification: cleanJustification };

  const skeleton = generateBestSkeleton(seedPacket, { roomCount, pickFn });
  const sk = validateSkeleton(skeleton, seedPacket);
  if (!sk.valid) {
    return { success: false, stored: false, reason: `generated skeleton failed validation: ${sk.errors.join('; ')}` };
  }

  // World-day time anchor for the later evolution layer. The seed
  // packet's generatedAt is real-world time; the world day is what
  // evolution measures elapsed time in. Best-effort: if the clock
  // cannot be read, the anchor is null and the seed packet still
  // carries generatedAt — generation must not fail over the clock.
  let timeAnchor = null;
  try {
    const clock = await getClock(party.campaignId);
    timeAnchor = { worldDay: clock.day, dayOfYear: clock.dayOfYear, year: clock.year };
  } catch { timeAnchor = null; }
  seedPacket.timeAnchor = timeAnchor;

  let stored;
  try {
    stored = await storeScene({
      campaignId: party.campaignId, locationId, name: cleanName, kind: 'dungeon',
      seedPacket, skeleton, siteEra,
    });
  } catch (e) {
    return { success: false, stored: false, reason: `scene storage failed: ${e.message}` };
  }

  // Migration 101 columns, best-effort mirror of the seed-packet
  // anchor (queryable without parsing seed_json). Failure here does
  // not fail generation: the seed packet is the authoritative anchor.
  if (timeAnchor) {
    await dbRun(
      `UPDATE scenes SET generated_world_day = ?, generated_world_year = ? WHERE id = ?`,
      [timeAnchor.worldDay, timeAnchor.year, stored.sceneId]
    ).catch(() => null);
  }

  return {
    success: true, stored: true, existing: false, sceneId: stored.sceneId,
    roomKeys: Object.keys(stored.roomIdByKey || {}),
    roomCount: stored.roomCount, connectionCount: stored.connectionCount,
    sceneEra: stored.sceneEra, seedDice: seedPacket.siteDice,
    coherence: seedPacket.coherence || { flags: [], justification: null },
    timeAnchor, party: { level: party.level, size: party.size },
  };
}

function systemNoteFor(text) {
  return `[SYSTEM NOTE - DO NOT RESPOND TO THIS]: ${text}`;
}

/**
 * GENERATE_DUNGEON marker (DM only, by design — the DM's world decides
 * where dungeons are). Example:
 *   [GENERATE_DUNGEON: Name="Sunken Temple" Purpose="rescue" Region="Sword Coast" SiteEra="sealed"]
 * With a coherence flag blocked, re-emit with Justification= carrying
 * the story that makes the flagged combination make sense.
 * Never auto-enters: the party must choose to enter the dungeon.
 */
registerMarkerHandler('GENERATE_DUNGEON', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const name = parsed?.Name ? String(parsed.Name).trim() : '';
    if (!name) {
      return { type: 'generate_dungeon', success: false, reason: 'GENERATE_DUNGEON needs Name=',
        systemNote: systemNoteFor('No dungeon was generated: GENERATE_DUNGEON needs Name=.') };
    }
    const locationRaw = parsed?.Location;
    const locationId = locationRaw != null && String(locationRaw).trim() !== '' ? Number(locationRaw) : null;
    const roomRaw = parsed?.RoomCount;
    const roomCount = roomRaw != null && String(roomRaw).trim() !== '' ? Number(roomRaw) : null;
    const result = await generateDungeon({
      sessionId: context.sessionId, characterId: context.characterId,
      name, purpose: parsed?.Purpose ?? null, region: parsed?.Region ?? null,
      siteEra: parsed?.SiteEra ?? 'sealed', locationId: Number.isNaN(locationId) ? null : locationId,
      justification: parsed?.Justification ?? null,
      roomCount: roomCount != null && !Number.isNaN(roomCount) ? roomCount : null,
    });
    if (!result.success) {
      return { type: 'generate_dungeon', success: false, reason: result.reason,
        needsJustification: result.needsJustification || false, coherence: result.coherence || null,
        systemNote: systemNoteFor(`No dungeon was generated: ${result.reason}`) };
    }
    return { type: 'generate_dungeon', success: true, sceneId: result.sceneId,
      roomKeys: result.roomKeys, roomCount: result.roomCount, sceneEra: result.sceneEra,
      seedDice: result.seedDice, coherence: result.coherence || null,
      existing: result.existing || false, stored: result.stored || false };
  } catch (e) {
    console.error('[dungeonGenerationService] GENERATE_DUNGEON handler failed:', e.message);
    return null;
  }
});

export default { checkCoherence, resolveParty, findExistingScene, generateDungeon, CLIMATE_CLASHES };
