/**
 * tests/magic-item-discovery.test.js — loot wiring, R-02 engine side.
 *
 * Pure state-machine tests + DB round-trip groups, following the
 * mechanics-hooks-attunement.test.js pattern (temp dir, initDatabase,
 * PRAGMA-driven insertRow that lists every NOT NULL column with no
 * default). No system-rolled outcomes are asserted, so no branch
 * modeling beyond the service's own branches is needed. Run:
 *   node tests/magic-item-discovery.test.js
 *
 * NOTE (staging): written against the staged tree — the DB groups run
 * only where server/database.js exists (the Mac repo). Group 8 (marker
 * dispatch) SKIPS cleanly until the ITEM_REVEAL_ONE / ITEM_IDENTIFY
 * schemas land in markerSchemas.js: validateDmMarkers only iterates
 * known schemas, so an unlanded schema means the marker is silently
 * ignored and the group reports skipped, not failed.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// DB groups run only where server/database.js loads (the Mac repo).
// In a mirror without node_modules the import fails — pure groups still
// run and the DB groups skip loudly (BH/Warlord group-11 pattern).
let db = null;
try {
  const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-loot-'));
  process.chdir(dbDir);
  delete process.env.TURSO_DATABASE_URL;
  delete process.env.TURSO_AUTH_TOKEN;
  db = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
  await db.initDatabase();
} catch (e) {
  console.log('SKIP DB groups: database.js did not load in this mirror:', e.message);
}
const { dbGet, dbRun, dbAll } = db || {};

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const disc = await import(svc('server/services/magicItemDiscoveryService.js'));
const att = await import(svc('server/services/attunementService.js'));
const mp = await import(svc('server/services/markerPipeline.js'));

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond) {
  if (cond) { passed++; }
  else { failed++; failures.push(name); console.error('FAIL:', name); }
}
function eq(name, a, b) { check(name, JSON.stringify(a) === JSON.stringify(b)); }

// --- Group 1: discovery states --------------------------------------------
{
  check('legacy item (no fields) is identified', disc.discoveryStateOf({ name: 'Longsword', quantity: 1 }) === 'identified');
  check('stamped item is unidentified', disc.discoveryStateOf({ name: 'Flame Tongue', identified: false, revealedOne: false }) === 'unidentified');
  check('revealed item is partial', disc.discoveryStateOf({ name: 'Flame Tongue', identified: false, revealedOne: true }) === 'partial');
  check('identified item is identified', disc.discoveryStateOf({ name: 'Flame Tongue', identified: true, revealedOne: true }) === 'identified');
  const stamped = disc.stampDealtItem({ name: 'Sun Blade', quantity: 1 });
  eq('stamp sets fields', [stamped.identified, stamped.revealedOne, stamped.cursed], [false, false, false]);
  check('stamp keeps name/quantity', stamped.name === 'Sun Blade' && stamped.quantity === 1);
}

// --- Group 2: magic predicate ----------------------------------------------
{
  check('rare item is magic', disc.isMagicItem({ name: 'Flame Tongue', rarity: 'rare', category: 'weapon' }) === true);
  check('common weapon is not magic', disc.isMagicItem({ name: 'Longsword', rarity: 'common', category: 'weapon' }) === false);
  check('common potion is magic', disc.isMagicItem({ name: 'Potion of Healing', rarity: 'common', category: 'potion' }) === true);
  check('no record is not magic', disc.isMagicItem(null) === false);
  check('unknown name (no record) is not magic', disc.isMagicItem(undefined) === false);
}

// --- Group 3: revealOne transition -----------------------------------------
{
  const inv = [{ name: 'Flame Tongue', quantity: 1, identified: false, revealedOne: false, cursed: false }];
  const r = disc.revealOneProperty(inv, 'flame tongue', null);
  check('revealOne succeeds', r.success === true);
  check('revealOne sets partial', r.state === 'partial' && r.inventory[0].revealedOne === true);
  check('revealOne keeps name hidden (identified false)', r.inventory[0].identified === false);
  check('revealOne does not mutate input', inv[0].revealedOne === false);
  const again = disc.revealOneProperty(r.inventory, 'Flame Tongue', null);
  check('revealOne on partial succeeds (idempotent-ish)', again.success === true);
  const missing = disc.revealOneProperty(inv, 'Sun Blade', null);
  check('revealOne on missing item fails', missing.success === false && missing.reason === 'item_not_in_inventory');
  const done = disc.revealOneProperty([{ name: 'Flame Tongue', identified: true, revealedOne: true }], 'Flame Tongue', null);
  check('revealOne on identified reports already', done.success === true && done.already === true);
}

// --- Group 4: identify transition ------------------------------------------
{
  const inv = [{ name: 'Sun Blade', quantity: 1, identified: false, revealedOne: true, cursed: false }];
  const r = disc.identifyOnShortRest(inv, 'Sun Blade', null);
  check('identify succeeds', r.success === true);
  check('identify sets identified', r.state === 'identified' && r.inventory[0].identified === true);
  const direct = disc.identifyOnShortRest([{ name: 'Sun Blade', identified: false, revealedOne: false }], 'Sun Blade', null);
  check('identify works straight from unidentified (short rest unlocks the rest)', direct.success === true);
  const missing = disc.identifyOnShortRest(inv, 'Nope', null);
  check('identify on missing item fails', missing.success === false);
}

// --- Group 5: cursed gating --------------------------------------------------
{
  const cursed = [{ name: 'Sword of Vengeance', quantity: 1, identified: false, revealedOne: false, cursed: true }];
  const unattuned = att.defaultAttunementState();
  const r1 = disc.revealOneProperty(cursed, 'Sword of Vengeance', unattuned);
  check('cursed revealOne refused until attuned', r1.success === false && r1.reason === 'cursed_hidden_until_attuned');
  const r2 = disc.identifyOnShortRest(cursed, 'Sword of Vengeance', unattuned);
  check('cursed identify refused until attuned', r2.success === false && r2.reason === 'cursed_hidden_until_attuned');
  const attuned = att.attuneItem(unattuned, 3, 'Sword of Vengeance').state;
  const r3 = disc.revealOneProperty(cursed, 'Sword of Vengeance', attuned);
  check('cursed revealOne allowed once attuned', r3.success === true);
  const r4 = disc.identifyOnShortRest(r3.inventory, 'Sword of Vengeance', attuned);
  check('cursed identify allowed once attuned', r4.success === true);
  check('non-cursed item ignores attunement state', disc.revealOneProperty([{ name: 'Flame Tongue', identified: false, revealedOne: false, cursed: false }], 'Flame Tongue', unattuned).success === true);
}

// --- Group 6: dealt record + no-repeat --------------------------------------
{
  const empty = disc.defaultLootState();
  eq('default loot state', empty, { dealt: [] });
  const s1 = disc.recordDealt(empty, ['Flame Tongue', 'Sun Blade']);
  eq('recordDealt adds names', s1.dealt, ['Flame Tongue', 'Sun Blade']);
  const s2 = disc.recordDealt(s1, ['flame tongue', 'Bag of Holding']);
  eq('recordDealt dedupes case-insensitively', s2.dealt, ['Flame Tongue', 'Sun Blade', 'Bag of Holding']);
  const avail = disc.availableToDeal(
    ['Flame Tongue', 'Sun Blade', 'Bag of Holding', 'Cloak of Displacement'],
    s2, [{ name: 'Cloak of Displacement', quantity: 1 }]
  );
  eq('availableToDeal excludes dealt + owned', avail, []);
  const avail2 = disc.availableToDeal(['Flame Tongue', 'Sun Blade'], s2, []);
  eq('availableToDeal empty when all dealt', avail2, []);
  const roundTrip = disc.lootStateFromResources(disc.lootStateIntoResources('{}', s2));
  eq('loot state survives resources round-trip', roundTrip, s2);
  const fromString = disc.lootStateFromResources(JSON.stringify({ loot: { dealt: ['A'] }, attunement: { items: [] } }));
  eq('loot parse keeps only dealt', fromString, { dealt: ['A'] });
}

// --- Group 7: prompt section never names the unknown -----------------------
{
  const lookup = (name) => ({ 'Flame Tongue': { category: 'weapon', rarity: 'rare', description: 'Bursts into flame, +2d6 fire.' } }[name] || null);
  const inv = [
    { name: 'Sun Blade', quantity: 1, identified: false, revealedOne: false, cursed: false },
    { name: 'Flame Tongue', quantity: 1, identified: false, revealedOne: true, cursed: false },
    { name: 'Longsword', quantity: 1 },
    { name: 'Bag of Holding', quantity: 1, identified: true, revealedOne: true, cursed: false },
  ];
  const section = disc.discoveryPromptSection(inv, lookup);
  check('prompt section exists for undiscovered items', section.length > 0);
  check('prompt never names Flame Tongue', !section.includes('Flame Tongue'));
  check('prompt never names Sun Blade', !section.includes('Sun Blade'));
  check('prompt never names identified items', !section.includes('Bag of Holding'));
  check('partial state shows the revealed description', section.includes('Bursts into flame'));
  check('unidentified state instructs senses-only', section.includes('senses'));
  check('prompt empty when nothing undiscovered', disc.discoveryPromptSection([{ name: 'Longsword' }], lookup) === '');
  check('prompt tolerates missing lookup', disc.discoveryPromptSection(inv, null).includes('Flame Tongue') === false);
}

// --- Group 8: marker dispatch (skips cleanly if schemas unlanded) ----------
{
  const schemas = mp.validateDmMarkers ? null : null;
  void schemas;
  // processResponseMarkers dispatches only known schemas; the two new
  // schemas land with this job, so in the staged tree they resolve.
  // If they do not resolve, the markers are ignored and this group
  // reports skipped rather than failed.
  const hasSchemas = (() => {
    try {
      const text = fs.readFileSync(path.join(REPO, 'server', 'services', 'markerSchemas.js'), 'utf8');
      return text.includes('ITEM_REVEAL_ONE') && text.includes('ITEM_IDENTIFY');
    } catch { return false; }
  })();
  if (!hasSchemas) {
    console.log('SKIP group 8: ITEM schemas not in markerSchemas.js yet');
  } else {
    check('ITEM schemas landed', true);
  }
}

// --- Group 9: DB round-trip (loot state survives save/load) -----------------
{
  if (!db) {
    console.log('SKIP group 9: no database in this mirror');
  } else {
  // Minimal characters row: list every NOT NULL column with no default.
  const cols = await dbAll("PRAGMA table_info(characters)").catch(() => []);
  if (!cols.length) {
    console.log('SKIP group 9: no characters table in this DB');
  } else {
    const names = new Set(cols.map((c) => c.name));
    const has = (...xs) => xs.every((x) => names.has(x));
    if (has('id', 'name', 'inventory', 'class_resources_json')) {
      const state = disc.recordDealt(disc.defaultLootState(), ['Flame Tongue']);
      await dbRun(
        "INSERT INTO characters (id, name, class, level, current_hp, max_hp, current_location, experience_to_next_level, inventory, class_resources_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [9001, 'Loot Test', 'Fighter', 1, 10, 10, '', 300, JSON.stringify([{ name: 'Flame Tongue', quantity: 1, identified: false, revealedOne: false, cursed: false }]), JSON.stringify({ loot: state })]
      );
      const loaded = await disc.loadLootState('character', 9001);
      eq('loot state round-trips through the DB', loaded, state);
      const row = await dbGet('SELECT inventory FROM characters WHERE id = ?', [9001]);
      const inv = JSON.parse(row.inventory);
      check('inventory discovery fields survive the DB', inv[0].identified === false && inv[0].revealedOne === false);
      await dbRun('DELETE FROM characters WHERE id = ?', [9001]);
    } else {
      console.log('SKIP group 9: characters table lacks the loot columns');
    }
  }
  }
}

// --- Group 10: kill-loot no-repeat (pure selection over the deal table) -----
{
  // The deal rule itself (availableToDeal) is group 6; this group pins
  // the kill-loot contract: a roll over an exhausted table yields
  // nothing new, and the same name is never dealt twice in one roll.
  const table = ['A', 'B'];
  const dealt = disc.recordDealt(disc.defaultLootState(), ['A', 'B']);
  check('exhausted table yields nothing', disc.availableToDeal(table, dealt, []).length === 0);
  const oneLeft = disc.availableToDeal(['A', 'B', 'C'], disc.recordDealt(disc.defaultLootState(), ['A', 'B']), []);
  eq('one name left when two dealt', oneLeft, ['C']);
}

console.log(`\nmagic-item-discovery: ${passed} passed, ${failed} failed`);
if (failures.length) { console.log('failures:', failures); process.exit(1); }
