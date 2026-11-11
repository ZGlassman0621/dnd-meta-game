/**
 * Migration 081: NPC professions, mastery tiers, build archetypes (DM System)
 *
 * Designed with Zach 2026-10-21 from tabletop NPC-design sources (MageGate,
 * the DM Lair, Modular Realms, GUP, the NPC-follower literature): an NPC's
 * TRADE is their identity and their mechanical competence — not a character
 * class. Class archetypes exist only for adventuring stock and companions.
 *
 * npcs.profession_key — key into the profession catalog
 *   (server/data/professions.js), resolved from the NPC's occupation text
 *   at first appearance by npcProfessionService.ensureNpcProfession.
 *   NULL = no resolvable trade (yet); the roll resolver falls through to
 *   its CR path for such NPCs, exactly as before.
 *
 * npcs.mastery_tier — 'apprentice' | 'journeyman' | 'master' | 'legend',
 *   rolled by the SYSTEM at first appearance (25/50/20/5). The world has
 *   apprentices and masters; the tier is also personification — a master
 *   is known, sought out, pointed to. Permanent once rolled.
 *
 * npcs.archetype_key — for adventuring-stock professions only (sellsword,
 *   hedge wizard, tomb robber...): the build archetype rolled at first
 *   appearance from the profession's primary class table
 *   (server/data/companionArchetypes.js). If the NPC is later recruited,
 *   the sheet generates FROM this key — the person you met is the person
 *   who joins.
 *
 * npcs.gup_specific / npcs.gup_unique — the GUP packet (Get Specific,
 *   Unique Aspect, Purpose): one concrete sensory detail and one
 *   distinguishing aspect, rolled from system pools at first appearance.
 *   Purpose is already carried by the agenda system (migration 077).
 *
 * companions.archetype_key — the companion's build archetype. Copied from
 *   the NPC at recruitment when one exists; otherwise rolled by
 *   companionSheetService the first time a sheet is generated. Stored
 *   (not derived from scores) so ASIs never flip a companion's build
 *   identity or personification.
 *
 * Player visibility: NONE. Profession and mastery may surface in fiction
 * (people in town know the master smith), but the keys, tiers, and pools
 * are DM-system data, never UI data.
 */

export async function up(db) {
  const npcInfo = await db.execute(`PRAGMA table_info(npcs)`);
  const npcCols = new Set(npcInfo.rows.map(r => r.name));

  if (!npcCols.has('profession_key')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN profession_key TEXT`);
  }
  if (!npcCols.has('mastery_tier')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN mastery_tier TEXT`);
  }
  if (!npcCols.has('archetype_key')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN archetype_key TEXT`);
  }
  if (!npcCols.has('gup_specific')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN gup_specific TEXT`);
  }
  if (!npcCols.has('gup_unique')) {
    await db.execute(`ALTER TABLE npcs ADD COLUMN gup_unique TEXT`);
  }

  const compInfo = await db.execute(`PRAGMA table_info(companions)`);
  const compCols = new Set(compInfo.rows.map(r => r.name));
  if (!compCols.has('archetype_key')) {
    await db.execute(`ALTER TABLE companions ADD COLUMN archetype_key TEXT`);
  }
}

export async function down(db) {
  // SQLite DROP COLUMN requires 3.35+. Leave columns in place on rollback —
  // they're nullable and harmless.
}
