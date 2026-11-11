/**
 * NPC Profession Service (DM System, designed with Zach 2026-10-21).
 *
 * The tabletop sources agree: an NPC's trade is their identity and their
 * mechanical competence — nobody builds commoners as character classes.
 * This service gives every NPC a profession packet at first appearance,
 * rolled by the SYSTEM (never decided by the AI), the same doctrine as
 * complexity tiers:
 *
 *   profession_key — resolved from the NPC's occupation text against the
 *     catalog (server/data/professions.js); category fallback; else none.
 *   mastery_tier — apprentice / journeyman / master / legend (25/50/20/5).
 *     A master is also personification: they are KNOWN for their work.
 *   GUP packet — one concrete sensory detail (Specific) + one
 *     distinguishing aspect (Unique), rolled from system pools. Purpose
 *     is the agenda system's job (migration 077).
 *   archetype_key — adventuring-stock professions only: a build rolled
 *     from the profession's primary class table. If this NPC is ever
 *     recruited, their sheet generates from this key.
 *
 * Backfill-on-appearance, like complexity: called from the session-start
 * backfill loop in routes/dmSession.js. Idempotent — once profession_key
 * is set, nothing here ever re-rolls. Player visibility: none of the keys
 * or tiers render to the player; the DM narrates the person, not the data.
 */
import { dbGet, dbRun } from '../database.js';
import { roll } from '../utils/rng.js';
import {
  professionForOccupation, findProfessionByKey, rollMasteryTier,
  TIER_LABEL, GUP_SPECIFIC_POOL, GUP_UNIQUE_POOL
} from '../data/professions.js';
import { getArchetype, rollArchetypeKey } from '../data/companionArchetypes.js';

function pickFrom(pool) {
  return pool[roll(pool.length, 1, { reason: 'npc gup packet' }).total - 1];
}

function packetFromRow(npc) {
  if (!npc?.profession_key) return null;
  return {
    professionKey: npc.profession_key,
    masteryTier: npc.mastery_tier || null,
    archetypeKey: npc.archetype_key || null,
    gupSpecific: npc.gup_specific || null,
    gupUnique: npc.gup_unique || null
  };
}

/**
 * Roll and persist the profession packet for an NPC that doesn't have one
 * yet. Returns the packet, the existing packet, or null when the NPC has
 * no resolvable trade (occupation text matches nothing and no category
 * fallback applies) — such NPCs keep the resolver's CR path.
 */
export async function ensureNpcProfession(npcId) {
  const npc = await dbGet(
    'SELECT id, occupation, occupation_category, profession_key, mastery_tier, archetype_key, gup_specific, gup_unique FROM npcs WHERE id = ?',
    [npcId]
  );
  if (!npc) return null;
  if (npc.profession_key) return packetFromRow(npc);

  const entry = professionForOccupation(npc.occupation, npc.occupation_category);
  if (!entry) return null;

  const masteryTier = rollMasteryTier();
  const gupSpecific = pickFrom(GUP_SPECIFIC_POOL);
  const gupUnique = pickFrom(GUP_UNIQUE_POOL);
  const archetypeKey = entry.adventuring && entry.affinities?.length
    ? rollArchetypeKey(entry.affinities[0])
    : null;

  await dbRun(
    'UPDATE npcs SET profession_key = ?, mastery_tier = ?, archetype_key = ?, gup_specific = ?, gup_unique = ? WHERE id = ?',
    [entry.key, masteryTier, archetypeKey, gupSpecific, gupUnique, npcId]
  );
  return { professionKey: entry.key, masteryTier, archetypeKey, gupSpecific, gupUnique };
}

const TIER_FLAVOR = {
  apprentice: 'still learning the trade, and it shows in their work',
  journeyman: 'established and reliable at it',
  master: 'the kind of practitioner people seek out by name',
  legend: 'spoken of beyond this town — their work is a destination'
};

/**
 * The DM-facing prompt line for an NPC's profession packet (pure — reads
 * fields off the npc row). Null when the NPC has no packet. The tier and
 * GUP fields are DM guidance for portrayal; the archetype line (when the
 * trade is adventuring stock) tells the DM what build this person has, so
 * their behavior is consistent with the sheet they'd get if recruited.
 */
export function buildProfessionPromptLine(npc) {
  if (!npc?.profession_key) return null;
  const entry = findProfessionByKey(npc.profession_key);
  if (!entry) return null;
  const tier = npc.mastery_tier || 'journeyman';
  let line = `  Trade: ${TIER_LABEL[tier] || 'a practitioner'} ${entry.name} — ${TIER_FLAVOR[tier] || TIER_FLAVOR.journeyman}. ` +
    `Their trade is real competence (covered checks: ${entry.skills.join(', ')}).`;
  if (npc.gup_unique) line += ` Defining aspect: ${npc.gup_unique}`;
  if (npc.gup_specific) line += ` Detail: ${npc.gup_specific}`;
  if (npc.archetype_key && entry.affinities?.length) {
    const arch = getArchetype(entry.affinities[0], npc.archetype_key);
    if (arch && arch.key !== 'template') {
      line += ` Build (${entry.affinities[0]} archetype — private): ${arch.label} — ${arch.guidance}`;
    }
  }
  return line;
}

export default { ensureNpcProfession, buildProfessionPromptLine };
