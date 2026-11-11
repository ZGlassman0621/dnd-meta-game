/*
 * tests/npc-banks.test.js — C&C Batch 1 NPC banks (Register adherents,
 * Engineering descriptor banks, Book of Names), data only.
 *
 * Pins:
 *   - NPC_PROFESSIONS has 50 professions, 1,000 NPCs total, exactly
 *     20 per profession.
 *   - Every NPC object has exactly name/sex/appearance/personality/
 *     hook — no stat fields (no level, HP, AC, damage, or spells).
 *   - Sample lookup: npcsFor('apothecary')[0] is Gwinear Pearce with
 *     his appearance, personality, and hook from the staging module.
 *   - DESCRIPTOR_BANKS has 21 banks; NAME_TABLES includes dwarf, elf,
 *     human, and orc cultures.
 *   - Importing the module changes nothing in combat: WEAPON_DATA is
 *     still 42 keys (41 weapons: 38 chapter + 3 setting, + Unarmed)
 *     and Longsword is still 1d8 / sap.
 *
 * Isolated throwaway DB (same pattern as arms-armor-variants.test.js).
 * The NPC module itself is pure data, but combatStatsService imports
 * the DB module, so init first.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-npc-banks-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
await dbModule.initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const stats = await import(svc('server/services/combatStatsService.js'));
const banks = await import(svc('server/data/npcBanks.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

group('Profession counts');
const professions = banks.NPC_PROFESSIONS;
const names = Object.keys(professions);
assert(names.length === 50, `50 professions, got ${names.length}`);
let total = 0;
let allTwenty = true;
for (const name of names) {
  total += professions[name].length;
  if (professions[name].length !== 20) { allTwenty = false; }
}
assert(total === 1000, `1,000 NPCs total, got ${total}`);
assert(allTwenty, 'every profession has exactly 20 NPCs');

group('NPC shape: no stat fields');
const expectedKeys = ['appearance', 'hook', 'name', 'personality', 'sex'];
let shapeOk = true;
let badExample = '';
for (const name of names) {
  for (const npc of professions[name]) {
    const keys = Object.keys(npc).sort();
    if (keys.length !== expectedKeys.length || keys.some((k, i) => k !== expectedKeys[i])) {
      shapeOk = false;
      badExample = `${name}: ${JSON.stringify(npc)}`;
    }
  }
}
assert(shapeOk, `every NPC has exactly name/sex/appearance/personality/hook${badExample ? ` — bad row ${badExample}` : ''}`);

group('Sample lookup');
const first = banks.npcsFor('apothecary')[0];
assert(first && first.name === 'Gwinear Pearce', `apothecary[0] is Gwinear Pearce, got ${first && first.name}`);
assert(first.appearance === 'Small, beady eyed, hairy', `Gwinear appearance matches, got ${first.appearance}`);
assert(first.personality === 'Friendly, hesitant, artificial', `Gwinear personality matches, got ${first.personality}`);
assert(first.hook === 'Friend with fey', `Gwinear hook matches, got ${first.hook}`);

group('Descriptor banks and name cultures');
assert(Object.keys(banks.DESCRIPTOR_BANKS).length === 21,
  `21 descriptor banks, got ${Object.keys(banks.DESCRIPTOR_BANKS).length}`);
for (const culture of ['dwarf', 'elf', 'human', 'orc']) {
  assert(banks.NAME_TABLES[culture] != null, `name cultures include ${culture}`);
}

group('Combat data untouched');
assert(Object.keys(stats.WEAPON_DATA).length === 42,
  `WEAPON_DATA has 42 keys (41 weapons + Unarmed), got ${Object.keys(stats.WEAPON_DATA).length}`);
assert(stats.WEAPON_DATA.Longsword.damage === '1d8' && stats.WEAPON_DATA.Longsword.mastery === 'sap',
  'Longsword still 1d8 / sap');
assert(stats.ARMOR_DATA != null, 'ARMOR_DATA still present');
assert(stats.lookupWeaponData('Longsword')?.name === 'Longsword',
  'canonical Longsword lookup unchanged');

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
