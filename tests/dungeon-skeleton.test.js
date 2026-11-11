/**
 * Dungeon skeleton tests (Phase A): generator + validator.
 * Pure service-level test — no DB, no provider, no dressing.
 * Run: node tests/dungeon-skeleton.test.js (or via run-tests.js).
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const skeleton = await import(pathToFileURL(path.join(REPO, 'server/services/dungeonSkeletonService.js')).href);
const seedSvc = await import(pathToFileURL(path.join(REPO, 'server/services/sceneSeedService.js')).href);
const { generateSkeleton, generateBestSkeleton, validateSkeleton, scoreSkeleton, budgetForRole } = skeleton;
const { buildSeedPacket, SITE_DICE } = seedSvc;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.log(`FAIL: ${msg}`); }
}

// Deterministic picker: always the first element. Pins every roll.
const first = (arr) => arr[0];

const packet = buildSeedPacket({ partyLevel: 3, partySize: 4, purpose: 'rescue', region: 'Sword Coast', pickFn: first });

// 1. Seed packet shape: six dice, each from its own table.
for (const [die, table] of Object.entries(SITE_DICE)) {
  assert(table.includes(packet.siteDice[die]), `site die ${die} value comes from its table`);
}
assert(packet.party.level === 3 && packet.party.size === 4, 'packet carries party profile');

// 2. Determinism: same packet + same picker => identical skeleton.
const s1 = generateSkeleton(packet, { pickFn: first });
const s2 = generateSkeleton(packet, { pickFn: first });
assert(JSON.stringify(s1) === JSON.stringify(s2), 'deterministic picker reproduces the skeleton exactly');
assert(validateSkeleton(s1, packet).valid, 'deterministic skeleton validates');

// 3. Budgets by role (level 3: medium 150, deadly 400; party of 4).
assert(budgetForRole('entrance', 3, 4) === 0, 'entrance budget 0');
assert(budgetForRole('treasure', 3, 4) === 0, 'treasure budget 0');
assert(budgetForRole('chamber', 3, 4) === 600, 'chamber budget = size x medium');
assert(budgetForRole('boss', 3, 4) === 1600, 'boss budget = size x deadly');
assert(budgetForRole('chamber', 99, 4) === null, 'unknown level has no budget');

// 4. Fifty real-rolled dungeons: every one validates, boss rules hold.
let allValid = true;
let bossOk = true;
let countOk = true;
for (let i = 0; i < 50; i++) {
  const p = buildSeedPacket({ partyLevel: 1 + (i % 10), partySize: 3 + (i % 3) });
  const sk = generateBestSkeleton(p);
  const v = validateSkeleton(sk, p);
  if (!v.valid) { allValid = false; console.log(`  dungeon ${i} invalid: ${v.errors.join('; ')}`); }
  if (sk.rooms.filter(r => r.role === 'boss').length !== 1) bossOk = false;
  if (sk.rooms.length < 4 || sk.rooms.length > 24) countOk = false;
}
assert(allValid, 'all 50 real-rolled dungeons validate');
assert(bossOk, 'every dungeon has exactly one boss');
assert(countOk, 'every dungeon room count within 4..24');

// 5. Best-of-3 is self-consistent and valid.
const best = generateBestSkeleton(packet);
assert(best.score === scoreSkeleton(best), 'best skeleton score matches its own score');
assert(validateSkeleton(best, packet).valid, 'best-of-3 skeleton validates');

// 6. Validator rejects corruption (each corruption caught, not silently passed).
const corrupt = (mutate) => {
  const sk = JSON.parse(JSON.stringify(generateSkeleton(packet, { pickFn: first })));
  mutate(sk);
  return validateSkeleton(sk, packet).valid;
};
assert(!corrupt(sk => { sk.rooms.push({ key: 'rX', role: 'chamber', label: 'Lost', features: [], encounterBudgetXp: 600, state: 'undiscovered' }); }), 'unreachable room rejected');
assert(!corrupt(sk => { sk.rooms.find(r => r.role === 'chamber').role = 'boss'; }), 'second boss rejected');
assert(!corrupt(sk => { sk.connections.push({ fromKey: 'r1', toKey: 'rNOPE', kind: 'passage', locked: false, trapped: false, distanceFt: 30, elevationFt: 0, direction: 'N' }); }), 'dangling connection rejected');
assert(!corrupt(sk => { sk.rooms.find(r => r.role === 'boss').encounterBudgetXp = 1; }), 'wrong boss budget rejected');
assert(!corrupt(sk => { sk.connections.push({ fromKey: 'r1', toKey: 'r1', kind: 'passage', locked: false, trapped: false, distanceFt: 30, elevationFt: 0, direction: 'N' }); }), 'self-loop rejected');

console.log(`dungeon-skeleton: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
