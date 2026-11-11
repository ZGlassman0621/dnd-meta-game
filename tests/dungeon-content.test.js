/**
 * tests/dungeon-content.test.js — Dungeon generation + scene layer, Phase B.
 *
 * Content assignment (geometry, features, encounters, traps, treasure),
 * storage round-trip (keys -> DB ids), and the DM digest (N1) — all
 * against the real services and a real throwaway DB (cold-test pattern).
 *
 * Locked rules pinned here:
 *   - Encounter XP is SIZING ONLY, never an award (awardsXp false,
 *     xpAward null, no award function). Session-end LLM scoring is
 *     the only XP path; nothing here may award XP.
 *   - Treasure is site/era-filtered: a sealed room never yields a
 *     current-tagged valuable or gear item.
 *   - Magic-item slots are typed placeholders (item null) until
 *     book-order Step 6 / item 13.
 *   - SET_COVER Feature= validation is DEFERRED (Zach's answer
 *     pending) and is NOT tested here: features are stored so a
 *     future validator has a list to check against.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-phaseb-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const content = await import(svc('server/services/dungeonContentService.js'));
const storage = await import(svc('server/services/dungeonSceneStorageService.js'));
const skel = await import(svc('server/services/dungeonSkeletonService.js'));
const seedSvc = await import(svc('server/services/sceneSeedService.js'));
const bestiary = await import(svc('server/data/bestiaryData.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }
function throws(fn, msg) {
  try { fn(); } catch { passed++; return; }
  failed++; console.log(`  ✗ ${msg}`);
}

const first = (arr) => arr[0];
const last = (arr) => arr[arr.length - 1];
const CATALOG = [
  { key: 'ogre', name: 'Ogre', cr: '2', xp: 450 },
  { key: 'goblin warrior', name: 'Goblin Warrior', cr: '1/4', xp: 50 },
  { key: 'bandit', name: 'Bandit', cr: '1/8', xp: 25 },
];

// Deterministic skeleton, level 3 party of 4, first picker throughout:
// 9 rooms — r1 entrance, r2 boss (1600), r3 treasure, r4–r9 chamber (600).
// All tree edges hang off r1; boss door locked, treasure door unlocked.
const packet = seedSvc.buildSeedPacket({ partyLevel: 3, partySize: 4, purpose: 'rescue', region: 'Sword Coast', pickFn: first });
const skeleton = skel.generateSkeleton(packet, { pickFn: first });
assert(skel.validateSkeleton(skeleton, packet).valid, 'deterministic skeleton validates');
const assigned = content.assignDungeonContent(skeleton, { pickFn: first, siteEra: 'sealed', catalog: CATALOG, partyLevel: 3, hazardFamily: 'water' });
const byKey = Object.fromEntries(assigned.rooms.map(r => [r.key, r]));

// ---------------------------------------------------------------------------
group('1. Migration 088 — geometry / trap / treasure / era columns');
{
  const roomCols = (await dbAll('PRAGMA table_info(scene_rooms)')).map(r => r.name);
  for (const c of ['width_ft', 'length_ft', 'ceiling_ft', 'light_level', 'traps_json', 'treasure_json']) {
    assert(roomCols.includes(c), `scene_rooms has ${c}`);
  }
  const connCols = (await dbAll('PRAGMA table_info(scene_connections)')).map(r => r.name);
  assert(connCols.includes('trap_json'), 'scene_connections has trap_json');
  const sceneCols = (await dbAll('PRAGMA table_info(scenes)')).map(r => r.name);
  assert(sceneCols.includes('era'), 'scenes has era');
}

// ---------------------------------------------------------------------------
group('2. Geometry + light (N2/N3) — added in Phase B, not Phase A');
{
  assert(byKey.r1.lightLevel === 'bright', 'entrance is bright');
  assert(byKey.r4.widthFt === 20 && byKey.r4.lengthFt === 20 && byKey.r4.ceilingFt === 10, 'chamber dimensions 20x20, ceiling 10 (first picker)');
  assert(byKey.r2.widthFt === 40 && byKey.r2.ceilingFt === 20, 'boss dimensions larger, ceiling 20');
  assert(byKey.r3.widthFt === 15 && byKey.r3.ceilingFt === 10, 'treasure dimensions smaller');
  for (const r of assigned.rooms) {
    assert(r.widthFt > 0 && r.lengthFt > 0 && r.ceilingFt > 0, `room ${r.key} dimensions positive`);
    assert(content.LIGHT_LEVELS.includes(r.lightLevel), `room ${r.key} light level valid`);
  }
  const v = content.validateContent(assigned);
  assert(v.valid, `assigned content validates (${v.errors.join('; ')})`);
}

// ---------------------------------------------------------------------------
group('3. Features — cover kinds carry tier + AC bonus for future SET_COVER validation');
{
  assert(byKey.r4.features.length === 1, 'chamber has one feature (first picker)');
  const f = byKey.r4.features[0];
  assert(f.kind === 'cover_half' && f.coverTier === 'half' && f.acBonus === 2, 'cover_half feature: tier half, +2 AC');
  assert(byKey.r1.features.length === 0, 'entrance has no feature (first picker)');
  for (const r of assigned.rooms) {
    for (const feat of r.features) {
      assert(content.FEATURE_KINDS.includes(feat.kind), `room ${r.key} feature kind valid`);
      if (feat.coverTier === 'full') assert(feat.untargetable === true, 'full cover is untargetable, not a bonus');
    }
  }
  const full = { key: 'rx', role: 'chamber', label: 'X', features: [], encounterBudgetXp: 0, state: 'undiscovered' };
  const coverFullPicker = (arr) => {
    if (arr.includes('cover_full')) return 'cover_full';
    if (arr.every(x => typeof x === 'number')) return 1;
    return arr[0];
  };
  const fullFeatures = content.assignFeatures(full, coverFullPicker);
  assert(fullFeatures.length >= 1 && fullFeatures[0].kind === 'cover_full' && fullFeatures[0].acBonus === null, 'cover_full acBonus is null (untargetable)');
}

// ---------------------------------------------------------------------------
group('4. Encounters — bestiary keys only, raw XP sizing, NEVER an award');
{
  assert(byKey.r1.encounter === null, 'entrance encounter null (budget 0)');
  assert(byKey.r3.encounter === null, 'treasure encounter null (budget 0)');
  const chamber = byKey.r4.encounter;
  assert(chamber && chamber.sizingXp === 600 && chamber.budgetXp === 600, 'chamber sizing fills its 600 budget exactly (first picker)');
  assert(chamber.monsters.some(m => m.key === 'ogre' && m.count === 1), 'chamber encounter includes the ogre');
  assert(chamber.totalCount === 4, 'chamber encounter total count 4');
  const boss = byKey.r2.encounter;
  assert(boss && boss.sizingXp === 1600 && boss.budgetXp === 1600, 'boss sizing fills its 1600 budget exactly (first picker)');
  assert(boss.totalCount === 8, 'boss encounter hits the 8-monster cap exactly at budget');
  for (const r of assigned.rooms) {
    if (!r.encounter) continue;
    assert(r.encounter.sizingXp <= r.encounterBudgetXp, `room ${r.key} sizing never exceeds budget`);
    assert(r.encounter.awardsXp === false && r.encounter.xpAward === null, `room ${r.key} encounter awards nothing`);
    assert(!('awardXp' in r.encounter) && typeof content.assignEncounter === 'function', `room ${r.key} encounter has no award field`);
  }
  assert(assigned.awardsXp === false, 'whole-dungeon content awards nothing');
  assert(assigned.totalSizingXp <= assigned.totalBudgetXp, 'total sizing never exceeds total budget');
  assert(assigned.totalBudgetXp === 1600 + 6 * 600, 'total budget = boss + six chambers');
  const unaffordable = content.assignEncounter({ key: 'rx', encounterBudgetXp: 600 }, { catalog: [{ key: 'dragon', name: 'Dragon', cr: '10', xp: 5900 }], pickFn: first });
  assert(unaffordable && unaffordable.monsters.length === 0 && unaffordable.sizingXp === 0, 'no affordable entry -> empty encounter, not an invented monster');
}

// ---------------------------------------------------------------------------
group('5. Traps — tier by party level, hazard-family names');
{
  assert(content.trapTierForLevel(3) === 'setback', 'level 3 -> setback');
  assert(content.trapTierForLevel(7) === 'dangerous', 'level 7 -> dangerous');
  assert(content.trapTierForLevel(15) === 'deadly', 'level 15 -> deadly');
  const trap = byKey.r4.traps[0];
  assert(trap && trap.tier === 'setback' && trap.detectDc === 11 && trap.disarmDc === 11 && trap.damageDice === '1d10', 'level 3 trap is setback, DC 11, 1d10');
  assert(trap.name === 'Flood grate trap', 'water hazard family names the trap');
  assert(trap.hidden === true && trap.placement === 'room', 'room trap is hidden-layer');
  assert(byKey.r1.traps.length === 0, 'entrance has no trap');
  const doorConn = assigned.connections.find(c => c.kind === 'door');
  assert(doorConn && doorConn.trapped === false && doorConn.trap === null, 'door connection untrapped under first picker');
  const forced = content.assignConnectionTrap({ kind: 'door' }, { partyLevel: 3, hazardFamily: 'fire', pickFn: last });
  assert(forced && forced.name === 'Fireburst rune' && forced.damageType === 'fire', 'forced connection trap: fire family, last picker');
  const clear = content.assignConnectionTrap({ kind: 'passage' }, { partyLevel: 3, pickFn: last });
  assert(clear === null, 'passage connections never get traps');
}

// ---------------------------------------------------------------------------
group('6. Treasure — sealed era, ancient price index, magic placeholders');
{
  assert(content.priceAncientItem(100, 'pristine').valueGp === 100, 'pristine: full value');
  assert(content.priceAncientItem(100, 'worn').valueGp === 60, 'worn: 0.6x');
  assert(content.priceAncientItem(100, 'damaged').valueGp === 30 && content.priceAncientItem(100, 'damaged').usable === false, 'damaged: 0.3x, unusable (repair not built)');
  assert(content.priceAncientItem(100, 'ruined').valueGp === 5, 'ruined: 0.05x salvage');
  assert(content.priceAncientItem(100, 'mint') === null, 'unknown condition returns null, not a price');
  const treasure = byKey.r3.treasure;
  assert(treasure && treasure.siteEra === 'sealed', 'treasure room treasure is sealed-era');
  assert(treasure.coins.gp === 50, 'treasure room coins (first bundle)');
  assert(treasure.valuables.length >= 1 && treasure.valuables.every(v => v.eraTag !== 'current'), 'sealed valuables never current-tagged');
  assert(treasure.gear.length === 1 && treasure.gear[0].eraTag === 'ancient' && treasure.gear[0].valueGp === 15, 'sealed gear is ancient, pristine bronze shortsword at full value');
  assert(treasure.magicSlots.length === 1 && treasure.magicSlots[0].item === null && treasure.magicSlots[0].type === 'weapon', 'magic slot is a typed placeholder, item null');
  assert(byKey.r1.treasure === null, 'entrance has no treasure');
  assert(byKey.r4.treasure && byKey.r4.treasure.valuables.length === 0 && byKey.r4.treasure.magicSlots.length === 0, 'chamber cache is coins only');
  const active = content.assignTreasure({ key: 'rx', role: 'treasure' }, { partyLevel: 3, siteEra: 'active', pickFn: first });
  assert(active.gear[0].eraTag === 'current', 'active lair gear may be current market gear');
  throws(() => content.assignTreasure({ key: 'rx', role: 'treasure' }, { siteEra: 'modern' }), 'unknown siteEra throws instead of silently picking an era');
}

// ---------------------------------------------------------------------------
group('7. Storage round-trip — skeleton keys become DB ids, content persists');
{
  const stored = await storage.storeScene({
    campaignId: 1, name: 'Test Dungeon', seedPacket: packet, skeleton, content: assigned,
  });
  assert(stored.sceneId > 0 && stored.roomCount === 9 && stored.connectionCount === 8, 'scene stored: 9 rooms, 8 connections');
  const loaded = await storage.loadScene(stored.sceneId);
  assert(loaded.scene.era === 'sealed' && loaded.scene.status === 'content', 'stored scene era sealed, status content');
  assert(loaded.rooms.length === 9, 'loaded room count matches skeleton');
  const loadedByKey = Object.fromEntries(loaded.rooms.map(r => [r.roomKey, r]));
  assert(loadedByKey.r4.widthFt === 20 && loadedByKey.r4.lightLevel === 'dark', 'loaded chamber geometry + light round-trip');
  assert(loadedByKey.r4.encounter.sizingXp === 600, 'loaded chamber encounter round-trips');
  assert(loadedByKey.r3.treasure.magicSlots[0].item === null, 'loaded treasure magic slot still a placeholder');
  assert(loadedByKey.r4.traps[0].name === 'Flood grate trap', 'loaded room trap round-trips');
  for (const c of loaded.connections) {
    assert(loadedByKey[c.fromKey] && loadedByKey[c.toKey], `connection ${c.fromKey}->${c.toKey} references stored rooms`);
  }
  const bossDoor = loaded.connections.find(c => c.toKey === 'r2');
  assert(bossDoor && bossDoor.locked === true && bossDoor.kind === 'door', 'boss door stays locked through storage');
  // Invalid content must not persist: corrupt the encounter sizing and expect a throw.
  const bad = JSON.parse(JSON.stringify(assigned));
  bad.rooms.find(r => r.key === 'r4').encounter.sizingXp = 99999;
  let threw = false;
  try {
    await storage.storeScene({ campaignId: 1, name: 'Bad', seedPacket: packet, skeleton, content: bad });
  } catch { threw = true; }
  assert(threw, 'oversized encounter content is refused, not stored');
}

// ---------------------------------------------------------------------------
group('8. DM digest (N1) — current full, adjacent exits only, rest invisible');
{
  const stored = await storage.storeScene({
    campaignId: 1, name: 'Digest Dungeon', seedPacket: packet, skeleton, content: assigned,
  });
  const digest = await storage.getDmDigest(stored.sceneId, 'r4');
  assert(digest.currentRoom.roomKey === 'r4', 'digest current room is r4');
  assert(digest.currentRoom.designerLabel === 'Chamber 3' && digest.currentRoom.designerLabelDmOnly === true, 'designer label present but flagged DM-only (N10)');
  assert(digest.currentRoom.dimensions.widthFt === 20 && digest.currentRoom.lightLevel === 'dark', 'current room dimensions + light in full');
  assert(digest.currentRoom.features.length === 1 && digest.currentRoom.encounter.sizingXp === 600, 'current room features + encounter in full');
  assert(digest.currentRoom.traps.length === 1 && digest.currentRoom.treasure !== null, 'current room hidden traps + treasure visible to the DM');
  assert(digest.adjacentRooms.length === 1 && digest.adjacentRooms[0].roomKey === 'r1', 'one adjacent room: the entrance');
  assert(digest.adjacentRooms[0].direction === 'S', 'exit direction inverted for the return journey (N -> S)');
  const adj = digest.adjacentRooms[0];
  assert(!('features' in adj) && !('encounter' in adj) && !('treasure' in adj) && !('role' in adj) && !('label' in adj), 'adjacent room carries exits only — no features, encounter, treasure, role or label');
  assert(digest.otherRooms.count === 7, 'seven non-adjacent rooms counted, none listed');
  const digestText = JSON.stringify(digest);
  assert(!digestText.includes('Boss Lair') && !digestText.includes('Treasure Vault'), 'non-adjacent room labels never appear in the digest');
  let threw = false;
  try { await storage.getDmDigest(stored.sceneId, 'rNOPE'); } catch { threw = true; }
  assert(threw, 'digest for an unknown room throws');

  // Hand-built digest: secret exits are hidden, not exits; far rooms invisible.
  const hand = {
    scene: { id: 99, era: 'sealed' },
    rooms: [
      { roomKey: 'r1', role: 'entrance', label: 'Entrance', features: [], encounter: null, traps: [], treasure: null, widthFt: 20, lengthFt: 20, ceilingFt: 15, lightLevel: 'bright', state: 'undiscovered' },
      { roomKey: 'r2', role: 'chamber', label: 'Secret Chamber', features: [], encounter: null, traps: [], treasure: null, widthFt: 20, lengthFt: 20, ceilingFt: 10, lightLevel: 'dark', state: 'undiscovered' },
      { roomKey: 'r3', role: 'chamber', label: 'Hall', features: [], encounter: null, traps: [], treasure: null, widthFt: 20, lengthFt: 20, ceilingFt: 10, lightLevel: 'dark', state: 'undiscovered' },
      { roomKey: 'r4', role: 'boss', label: 'Boss Lair', features: [], encounter: null, traps: [], treasure: null, widthFt: 40, lengthFt: 40, ceilingFt: 20, lightLevel: 'dark', state: 'undiscovered' },
    ],
    connections: [
      { fromKey: 'r1', toKey: 'r2', kind: 'secret', locked: false, trapped: false, distanceFt: 30, elevationFt: 0, direction: 'E' },
      { fromKey: 'r1', toKey: 'r3', kind: 'passage', locked: false, trapped: false, distanceFt: 30, elevationFt: 0, direction: 'N' },
      { fromKey: 'r3', toKey: 'r4', kind: 'passage', locked: false, trapped: false, distanceFt: 30, elevationFt: 0, direction: 'N' },
    ],
  };
  const hd = storage.buildDmDigest(hand, 'r1');
  assert(hd.currentRoom.exits.length === 1 && hd.currentRoom.exits[0].roomKey === 'r3', 'secret connection is not an exit');
  assert(hd.currentRoom.hiddenExits.length === 1 && hd.currentRoom.hiddenExits[0].roomKey === 'r2' && hd.currentRoom.hiddenExits[0].dmOnly === true, 'secret connection appears only in DM-only hiddenExits');
  assert(hd.otherRooms.count === 1, 'far room counted once, not listed');
  assert(!JSON.stringify(hd).includes('Boss Lair'), 'far room label never appears in the hand-built digest');
}

// ---------------------------------------------------------------------------
group('9. Real-rolled dungeon validates end to end');
{
  const realPacket = seedSvc.buildSeedPacket({ partyLevel: 5, partySize: 3, purpose: 'explore' });
  const realSkeleton = skel.generateBestSkeleton(realPacket);
  assert(skel.validateSkeleton(realSkeleton, realPacket).valid, 'real-rolled skeleton validates');
  const realContent = content.assignDungeonContent(realSkeleton, {
    siteEra: 'active', catalog: content.catalogFromEntries(bestiary.BESTIARY_ENTRIES),
  });
  const v = content.validateContent(realContent);
  assert(v.valid, `real-rolled content validates (${v.errors.join('; ')})`);
  assert(realContent.totalSizingXp > 0 && realContent.totalSizingXp <= realContent.totalBudgetXp, 'real-rolled sizing inside total budget, above zero');
  for (const r of realContent.rooms) {
    if (!r.treasure) continue;
    assert(r.treasure.magicSlots.every(s => s.item === null), `room ${r.key} magic slots are placeholders`);
  }
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
