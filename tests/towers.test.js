/*
 * tests/towers.test.js — Towers of Adventure data module.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/towers.test.js on the Mac. Its import is the Mac path
 * (../server/data/towers.js), so in staging it is syntax-checked
 * only (node --check) and is NOT runnable here — the Mac path does not
 * exist on the VM. The Mac gate (npm test -- towers) is the
 * real run. This module is pure data, so no database is needed.
 *
 * Pins (same assert/group style as tests/kalas.test.js):
 *   - 15 towers in book order, first Lonely Wizard's Tower, last Hag
 *     Tower; every tower has non-empty name/theme and rooms > 0
 *   - 4 services, 20 hooks in book order, 117 NPCs, 80 monsters,
 *     84 treasures, 77 traps
 *   - every object has exactly its required keys, and no key name is
 *     or contains a stat/price key (hp/ac/dc/gp/xp/reward/level/save/
 *     stat exact-matched, and damage/reward substring-matched —
 *     short fragments 'ac'/'dc'/'stat' are exact-matched only, since
 *     the legitimate required key 'status' contains 'stat')
 *   - monster statuses: playable + blocked = 80 with no overlap;
 *     blocked includes nixie at minimum
 *   - towerById('lonely-wizards-tower') returns the first tower;
 *     towerById('nope') returns null; hookById('images-appear-
 *     smaller-than-you-think') returns the Gror-org body-swap hook
 *   - TOWERS_META.reskinStatus contains 'pending'
 *   - towers(), hooks(), npcsByBand('low') return copies/new arrays,
 *     not the live arrays (mutating the return must not change a
 *     second call's result)
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const {
  TOWERS_META,
  TOWERS,
  TOWER_SERVICES,
  TOWER_HOOKS,
  TOWER_NPCS,
  TOWER_MONSTERS,
  TOWER_TREASURES,
  TOWER_TRAPS,
  towers,
  towerById,
  hooks,
  hookById,
  services,
  npcsByBand,
  monstersByBand,
  playableMonsters,
  blockedMonsters,
  treasuresByTheme,
  trapsByCategory,
} = await import(svc('server/data/towers.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}
function group(name) {
  console.log(`\n== ${name}`);
}

const TOWER_KEYS = ['id', 'name', 'note', 'rooms', 'theme'];
const SERVICE_KEYS = ['description', 'payment', 'type'];
const HOOK_KEYS = ['hook', 'id', 'npcs', 'places', 'premise', 'title'];
const NPC_KEYS = ['band', 'description', 'name', 'role'];
const MONSTER_KEYS = ['band', 'behavior', 'name', 'status'];
const TREASURE_KEYS = ['description', 'theme', 'tier'];
const TRAP_KEYS = ['category', 'description', 'name'];
const FORBIDDEN_KEY_EXACT = ['hp', 'ac', 'damage', 'dc', 'gp', 'xp', 'reward', 'level', 'save', 'stat'];
const FORBIDDEN_KEY_SUBSTRINGS = ['damage', 'reward'];
function keysOk(obj, expected) {
  const keys = Object.keys(obj).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) return false;
  return !keys.some(
    (k) => FORBIDDEN_KEY_EXACT.includes(k) || FORBIDDEN_KEY_SUBSTRINGS.some((s) => k.includes(s)),
  );
}
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;

group('Count and book order');
assert(TOWERS.length === 15, `expected 15 towers, got ${TOWERS.length}`);
assert(TOWERS[0].name === "Lonely Wizard's Tower", `first tower should be Lonely Wizard's Tower, got ${TOWERS[0].name}`);
assert(TOWERS[14].name === 'Hag Tower', `last tower should be Hag Tower, got ${TOWERS[14].name}`);
assert(TOWER_SERVICES.length === 4, `expected 4 services, got ${TOWER_SERVICES.length}`);
assert(TOWER_HOOKS.length === 20, `expected 20 hooks, got ${TOWER_HOOKS.length}`);
assert(TOWER_HOOKS[0].title === 'Your Wizard Uncle', `first hook should be Your Wizard Uncle, got ${TOWER_HOOKS[0].title}`);
assert(TOWER_HOOKS[19].title === 'Mirror Mirror on the Wall, What the Heck Are You?', `last hook mismatch, got ${TOWER_HOOKS[19].title}`);
assert(TOWER_NPCS.length === 117, `expected 117 NPCs, got ${TOWER_NPCS.length}`);
assert(TOWER_MONSTERS.length === 80, `expected 80 monsters, got ${TOWER_MONSTERS.length}`);
assert(TOWER_TREASURES.length === 84, `expected 84 treasures, got ${TOWER_TREASURES.length}`);
assert(TOWER_TRAPS.length === 77, `expected 77 traps, got ${TOWER_TRAPS.length}`);

group('Exact key shape, no stat/reward keys');
assert(TOWERS.every((t) => keysOk(t, TOWER_KEYS)), 'every tower must have exactly the required keys');
assert(TOWER_SERVICES.every((s) => keysOk(s, SERVICE_KEYS)), 'every service must have exactly the required keys');
assert(TOWER_HOOKS.every((h) => keysOk(h, HOOK_KEYS)), 'every hook must have exactly the required keys');
assert(TOWER_NPCS.every((n) => keysOk(n, NPC_KEYS)), 'every NPC must have exactly the required keys');
assert(TOWER_MONSTERS.every((m) => keysOk(m, MONSTER_KEYS)), 'every monster must have exactly the required keys');
assert(TOWER_TREASURES.every((t) => keysOk(t, TREASURE_KEYS)), 'every treasure must have exactly the required keys');
assert(TOWER_TRAPS.every((t) => keysOk(t, TRAP_KEYS)), 'every trap must have exactly the required keys');

group('Non-empty core fields');
assert(TOWERS.every((t) => nonEmpty(t.name) && nonEmpty(t.theme) && typeof t.rooms === 'number' && t.rooms > 0), 'every tower needs a name, a theme, and rooms > 0');
assert(TOWER_HOOKS.every((h) => nonEmpty(h.title) && nonEmpty(h.premise) && nonEmpty(h.hook) && Array.isArray(h.npcs) && Array.isArray(h.places)), 'every hook needs title, premise, hook, and npc/place arrays');
assert(TOWER_NPCS.every((n) => nonEmpty(n.name) && nonEmpty(n.role) && ['low', 'mid', 'high', 'demi-human'].includes(n.band)), 'every NPC needs a name, a role, and a valid band');
assert(TOWER_MONSTERS.every((m) => nonEmpty(m.name) && ['low', 'mid', 'high'].includes(m.band) && ['2024', 'reskin', 'blocked'].includes(m.status)), 'every monster needs a name, a valid band, and a valid status');
assert(TOWER_TREASURES.every((t) => nonEmpty(t.theme) && nonEmpty(t.tier) && nonEmpty(t.description)), 'every treasure needs theme, tier, and description');
assert(TOWER_TRAPS.every((t) => nonEmpty(t.name) && ['mechanical', 'creature', 'magical', 'poisoned', 'noise'].includes(t.category) && nonEmpty(t.description)), 'every trap needs a name, a valid category, and a description');

group('Band, theme, and category breakdowns');
assert(npcsByBand('low').length === 27, `expected 27 low NPCs, got ${npcsByBand('low').length}`);
assert(npcsByBand('mid').length === 35, `expected 35 mid NPCs, got ${npcsByBand('mid').length}`);
assert(npcsByBand('high').length === 31, `expected 31 high NPCs, got ${npcsByBand('high').length}`);
assert(npcsByBand('demi-human').length === 24, `expected 24 demi-human NPCs, got ${npcsByBand('demi-human').length}`);
assert(monstersByBand('low').length === 36, `expected 36 low monsters, got ${monstersByBand('low').length}`);
assert(monstersByBand('mid').length === 31, `expected 31 mid monsters, got ${monstersByBand('mid').length}`);
assert(monstersByBand('high').length === 13, `expected 13 high monsters, got ${monstersByBand('high').length}`);
assert(treasuresByTheme('fighter').length === 4, 'fighter theme should have 4 tiers');
assert(treasuresByTheme('dragon').length === 4, 'dragon theme should have 4 tiers');
assert(trapsByCategory('mechanical').length === 17, `expected 17 mechanical traps, got ${trapsByCategory('mechanical').length}`);
assert(trapsByCategory('creature').length === 15, `expected 15 creature traps, got ${trapsByCategory('creature').length}`);
assert(trapsByCategory('magical').length === 14, `expected 14 magical traps, got ${trapsByCategory('magical').length}`);
assert(trapsByCategory('poisoned').length === 16, `expected 16 poisoned traps, got ${trapsByCategory('poisoned').length}`);
assert(trapsByCategory('noise').length === 15, `expected 15 noise traps, got ${trapsByCategory('noise').length}`);

group('Monster statuses: playable + blocked = 80, no overlap');
const playable = playableMonsters();
const blocked = blockedMonsters();
assert(playable.length + blocked.length === 80, `playable (${playable.length}) + blocked (${blocked.length}) should equal 80`);
assert(!playable.some((p) => blocked.some((b) => b.name === p.name && b.band === p.band)), 'no monster may be both playable and blocked');
assert(blocked.some((m) => m.name === 'Nixie'), 'blocked monsters must include Nixie');
assert(blocked.some((m) => m.name === 'Wolverine'), 'blocked monsters must include Wolverine');
assert(playable.some((m) => m.name === 'Vampire'), 'playable monsters must include Vampire');
assert(TOWER_MONSTERS.filter((m) => m.status === '2024').length === 67, `expected 67 monsters at 2024, got ${TOWER_MONSTERS.filter((m) => m.status === '2024').length}`);
assert(TOWER_MONSTERS.filter((m) => m.status === 'reskin').length === 7, `expected 7 reskin monsters, got ${TOWER_MONSTERS.filter((m) => m.status === 'reskin').length}`);
assert(blocked.length === 6, `expected 6 blocked monsters, got ${blocked.length}`);

group('Lookups');
assert(towerById('lonely-wizards-tower')?.name === "Lonely Wizard's Tower", "towerById('lonely-wizards-tower') should return the first tower");
assert(towerById('nope') === null, "towerById('nope') should return null");
assert(hookById('images-appear-smaller-than-you-think')?.npcs.includes('Gror-org'), 'the body-swap hook should name Gror-org');
assert(hookById('nope') === null, "hookById('nope') should return null");
assert(services().length === 4, 'services() should return 4 services');

group('Meta reskin status is pending, not done or dropped');
assert(TOWERS_META.reskinStatus.includes('pending'), 'TOWERS_META.reskinStatus must contain pending');
assert(TOWERS_META.note.includes('no invented layouts'), 'TOWERS_META.note must record that no layouts were invented');

group('Helpers return copies, not the live arrays');
const firstTowers = towers();
firstTowers[0].name = 'MUTATED';
assert(towers()[0].name === "Lonely Wizard's Tower", 'mutating towers() result must not change a second call');
const firstHooks = hooks();
firstHooks[0].title = 'MUTATED';
assert(hooks()[0].title === 'Your Wizard Uncle', 'mutating hooks() result must not change a second call');
const firstLow = npcsByBand('low');
firstLow[0].name = 'MUTATED';
assert(npcsByBand('low')[0].name === 'Tanin Delenta', 'mutating npcsByBand() result must not change a second call');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
