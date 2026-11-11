/**
 * tests/set-cover-feature.test.js — Dungeon generation + scene layer, Phase B:
 * SET_COVER Feature= validation (ruled 2026-10-29).
 *
 * Rules pinned here:
 *   - Cover must actually exist in the room where the fight is happening:
 *     the named feature must be in the linked room's stored feature list
 *     with the matching cover tier, or cover is NOT granted.
 *   - A failed check SURFACES: the handler returns success:false with a
 *     systemNote (the route pushes it into the DM's context), and the
 *     stored cover is unchanged. Never a silent grant, never a silent drop.
 *   - Cover="none" clears cover and needs no feature (it grants nothing).
 *   - A tier mismatch does NOT auto-grant the feature's tier.
 *   - When NO room is linked to the encounter, there is no feature list
 *     to check against, so the pre-Phase-B grant stands (featureVerified
 *     false). That preserves the existing combat-real group 8 behavior
 *     for fights outside a scene room; scene entry still has to link
 *     the room (setEncounterRoom) for validation to bite in a dungeon.
 *
 * All against the real services and a real throwaway DB (cold-test /
 * dungeon-content pattern). The handler is driven through the real
 * marker pipeline, not called directly.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-setcover-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const storage = await import(svc('server/services/dungeonSceneStorageService.js'));
const content = await import(svc('server/services/dungeonContentService.js'));
const skel = await import(svc('server/services/dungeonSkeletonService.js'));
const seedSvc = await import(svc('server/services/sceneSeedService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
const es = await import(svc('server/services/enemyCombatService.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name); vals.push(overrides[c.name]); continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

const marker = async (text, ctx) => {
  const res = await pipeline.processResponseMarkers(text, ctx);
  return res.handlerResults[0]?.result;
};

// ---------------------------------------------------------------------------
// Fixtures: one stored dungeon, one linked encounter, one unlinked encounter
// ---------------------------------------------------------------------------
const first = (arr) => arr[0];
const packet = seedSvc.buildSeedPacket({ partyLevel: 3, partySize: 4, purpose: 'rescue', region: 'Sword Coast', pickFn: first });
const skeleton = skel.generateSkeleton(packet, { pickFn: first });
const CATALOG = [
  { key: 'ogre', name: 'Ogre', cr: '2', xp: 450 },
  { key: 'goblin warrior', name: 'Goblin Warrior', cr: '1/4', xp: 50 },
  { key: 'bandit', name: 'Bandit', cr: '1/8', xp: 25 },
];
const assigned = content.assignDungeonContent(skeleton, { pickFn: first, siteEra: 'sealed', catalog: CATALOG, partyLevel: 3, hazardFamily: 'water' });
const stored = await storage.storeScene({ campaignId: 1, name: 'Cover Dungeon', seedPacket: packet, skeleton, content: assigned });
const loaded = await storage.loadScene(stored.sceneId);
const coverRoom = loaded.rooms.find(r => (r.features || []).some(f => f.coverTier));
const coverFeature = coverRoom.features.find(f => f.coverTier);
const coverRoomKey = coverRoom.roomKey;

const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 30, max_hp: 30, armor_class: 10,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  equipment: JSON.stringify({}), skills: JSON.stringify([])
});
const sessionA = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const sessionB = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
await es.createEncounterEnemies(sessionA, 1, [
  { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
]);
await es.createEncounterEnemies(sessionB, 1, [
  { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
]);
await storage.setEncounterRoom({ sessionId: sessionA, encounterSeq: 1, sceneId: stored.sceneId, roomKey: coverRoomKey });
const CTX_A = { characterId: pcId, sessionId: sessionA };
const CTX_B = { characterId: pcId, sessionId: sessionB };
const goblinCover = async (s) => (await dbGet('SELECT cover FROM combat_enemies WHERE session_id = ? AND name = ?', [s, 'Goblin'])).cover;

// ---------------------------------------------------------------------------
group('1. Migration 089 — encounter -> scene room link table');
{
  const cols = (await dbAll('PRAGMA table_info(encounter_scene_rooms)')).map(r => r.name);
  for (const c of ['session_id', 'encounter_seq', 'scene_id', 'room_key']) {
    assert(cols.includes(c), `encounter_scene_rooms has ${c}`);
  }
}

// ---------------------------------------------------------------------------
group('2. Pure validator — validateCoverFeature');
{
  const feats = [
    { name: 'Toppled pillar', kind: 'cover_half', coverTier: 'half', acBonus: 2 },
    { name: 'Rubble field', kind: 'difficult_terrain' },
    { name: 'Stone altar', kind: 'cover_three_quarters', coverTier: 'three-quarters', acBonus: 5 },
  ];
  const ok = storage.validateCoverFeature(feats, { feature: 'toppled PILLAR', cover: 'half' });
  assert(ok.valid && ok.coverTier === 'half', 'match is case-insensitive, tier half');
  const spell = storage.validateCoverFeature(feats, { feature: 'Stone altar', cover: 'three_quarters' });
  assert(spell.valid, 'three_quarters spelling matches three-quarters tier');
  assert(storage.validateCoverFeature(feats, { feature: 'Invisible wall', cover: 'half' }).reason === 'feature_not_found', 'invented feature: not_found');
  assert(storage.validateCoverFeature(feats, { feature: 'Rubble field', cover: 'half' }).reason === 'feature_not_cover', 'existing non-cover feature: not_cover');
  assert(storage.validateCoverFeature(feats, { feature: 'Toppled pillar', cover: 'full' }).reason === 'feature_tier_mismatch', 'half feature asked as full: tier_mismatch');
  assert(storage.validateCoverFeature(feats, { feature: '', cover: 'half' }).reason === 'feature_required', 'no feature named: feature_required');
  assert(storage.coverFeatureNames(feats).join(',') === 'Toppled pillar,Stone altar', 'coverFeatureNames lists cover features only');
}

// ---------------------------------------------------------------------------
group('3. Link — setEncounterRoom / getEncounterRoom');
{
  const linked = await storage.getEncounterRoom(sessionA, 1);
  assert(linked && linked.sceneId === stored.sceneId && linked.roomKey === coverRoomKey, 'linked room reads back');
  assert((linked.features || []).some(f => f.name === coverFeature.name), 'linked room carries its stored features');
  assert(await storage.getEncounterRoom(sessionB, 1) === null, 'unlinked encounter reads null, not an error');
  const relinked = await storage.setEncounterRoom({ sessionId: sessionA, encounterSeq: 1, sceneId: stored.sceneId, roomKey: 'r1' });
  assert(relinked.roomKey === 'r1', 're-linking replaces the room');
  await storage.setEncounterRoom({ sessionId: sessionA, encounterSeq: 1, sceneId: stored.sceneId, roomKey: coverRoomKey });
  let threw = false;
  try { await storage.setEncounterRoom({ sessionId: sessionA, encounterSeq: 1, sceneId: stored.sceneId, roomKey: 'rNOPE' }); } catch { threw = true; }
  assert(threw, 'linking an unknown room throws (a link must not lie)');
  threw = false;
  try { await storage.setEncounterRoom({ sessionId: sessionA, encounterSeq: 1, sceneId: 999999, roomKey: coverRoomKey }); } catch { threw = true; }
  assert(threw, 'linking an unknown scene throws');
}

// ---------------------------------------------------------------------------
group('4. Handler in a linked room — valid grant, then failures write nothing');
{
  assert(coverFeature.coverTier === 'half', `deterministic room feature is half cover (${coverFeature.name})`);
  const good = await marker(`[SET_COVER: Target="Goblin" Cover="half" Feature="${coverFeature.name}"]`, CTX_A);
  assert(good && good.success === true && good.featureVerified === true && good.acBonus === 2, 'valid feature + matching tier grants, verified');
  assert(await goblinCover(sessionA) === 'half', 'valid grant writes cover=half');
  await marker('[SET_COVER: Target="Goblin" Cover="none"]', CTX_A);
  assert(await goblinCover(sessionA) === 'none', 'Cover=none clears without a feature');

  const wrongTier = await marker(`[SET_COVER: Target="Goblin" Cover="full" Feature="${coverFeature.name}"]`, CTX_A);
  assert(wrongTier && wrongTier.success === false && wrongTier.reason === 'feature_tier_mismatch', 'wrong tier: denied, tier_mismatch');
  assert(wrongTier.systemNote && wrongTier.systemNote.includes(coverFeature.name), 'wrong tier: failure carries a systemNote naming the feature');
  assert(await goblinCover(sessionA) === 'none', 'wrong tier writes nothing');

  const invented = await marker('[SET_COVER: Target="Goblin" Cover="half" Feature="Invisible wall"]', CTX_A);
  assert(invented && invented.success === false && invented.reason === 'feature_not_found', 'invented feature: denied, not_found');
  assert(invented.systemNote && invented.systemNote.includes('NOT granted'), 'invented feature: systemNote says cover was NOT granted');
  assert(await goblinCover(sessionA) === 'none', 'invented feature writes nothing');

  const noFeature = await marker('[SET_COVER: Target="Goblin" Cover="half"]', CTX_A);
  assert(noFeature && noFeature.success === false && noFeature.reason === 'feature_required_in_scene', 'no feature in a linked room: denied');
  assert(noFeature.systemNote && noFeature.systemNote.includes(coverFeature.name), 'no-feature note lists the room\'s real cover');
  assert(await goblinCover(sessionA) === 'none', 'no-feature denial writes nothing');
}

// ---------------------------------------------------------------------------
group('5. Handler with no linked room — legacy grant stands (combat-real group 8)');
{
  const legacy = await marker('[SET_COVER: Target="Goblin" Cover="half"]', CTX_B);
  assert(legacy && legacy.success === true && legacy.featureVerified === false, 'unlinked fight, no feature: legacy grant, unverified');
  assert(await goblinCover(sessionB) === 'half', 'legacy grant writes cover=half');
  const named = await marker('[SET_COVER: Target="Goblin" Cover="half" Feature="Cart"]', CTX_B);
  assert(named && named.success === true && named.featureVerified === false, 'unlinked fight, named feature: nothing to check against, legacy grant stands');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
