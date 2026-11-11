/**
 * tests/artificer-class.test.js — Artificer base class (Forge chassis).
 *
 * Pure service math + one DB round-trip group. No system-rolled
 * outcomes are asserted on exact values except deterministic service
 * math (dice specs are strings, never rolled here), so no branch
 * modeling beyond the service's own branches is needed. Run:
 *   node tests/artificer-class.test.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-artificer-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDatabase, dbGet, dbRun, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const art = await import(svc('server/services/artificerService.js'));
const cfs = await import(svc('server/services/classFeatureService.js'));

let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n${name}`); }

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

// Group 1 — Forge tables (plans/items, PDF-verified) + the 2024
// prepared formula (Zach, 2026-11-06: the 2024 book always wins).
group('1. Forge tables (PDF-verified) + 2024 prepared formula');
assert(art.FORGE_PREPARED_SPELLS === undefined, 'Forge prepared table is gone — 2024 book formula (Int mod + half level, min 1)');
assert(art.preparedSpellsForLevel(1, 3) === 3 && art.preparedSpellsForLevel(1, 0) === 1 && art.preparedSpellsForLevel(1, -1) === 1, 'prepared L1: 3 at Int +3, 1 at Int +0, 1 at Int -1 (minimum 1)');
assert(art.preparedSpellsForLevel(5, 3) === 5 && art.preparedSpellsForLevel(5, 0) === 2 && art.preparedSpellsForLevel(20, 3) === 13 && art.preparedSpellsForLevel(20, 5) === 15 && art.preparedSpellsForLevel(20, 0) === 10, 'prepared formula: Int mod + half level, min 1');
assert(art.preparedSpellsForLevel(1) === 1, 'prepared defaults to mod 0 (L1 = 1)');
assert(JSON.stringify(art.FORGE_PLANS_KNOWN) === JSON.stringify([0, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 7, 7, 7, 7, 8, 8, 8]), 'plans known table');
assert(JSON.stringify(art.FORGE_MAGIC_ITEMS) === JSON.stringify([0, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6]), 'magic items table');
assert(art.attunementCapForLevel(9) === 3 && art.attunementCapForLevel(10) === 4 && art.attunementCapForLevel(14) === 5 && art.attunementCapForLevel(18) === 6, 'attunement ladder 3/4/5/6');
assert(art.planEntryForLevel('Flame Tongue', 13) === null, '14+ plan unavailable at 13');
assert(art.planEntryForLevel('Flame Tongue', 14).attunement === true, '14+ plan available at 14, attunement Yes');
assert(art.planEntryForLevel('Bag of Holding', 2).attunement === false, '2+ plan attunement No');
assert(art.planEntryForLevel('Common magic item', 2).attunement === null, 'generic plan attunement Varies');

// Group 2 — Plans: learn, caps, duplicates, generic detail, replace.
group('2. Plans learn/replace');
{
  let s = art.defaultArtificerState();
  const r1 = art.learnPlan(s, 2, 'Bag of Holding'); s = r1.state;
  assert(r1.success, 'learn 2+ plan at 2');
  const rDup = art.learnPlan(s, 2, 'Bag of Holding');
  assert(!rDup.success && rDup.reason === 'plan_already_known', 'duplicate plan refused');
  const rGen = art.learnPlan(s, 2, 'Common magic item');
  assert(!rGen.success && rGen.reason === 'generic_plan_needs_item', 'generic plan needs a named item');
  const rGen2 = art.learnPlan(s, 2, 'Common magic item', 'Clockwork Amulet'); s = rGen2.state;
  assert(rGen2.success && s.plansKnown.includes('Common magic item: Clockwork Amulet'), 'generic plan stored with detail');
  const rHigh = art.learnPlan(s, 2, 'Armor, +1');
  assert(!rHigh.success && rHigh.reason === 'plan_not_available_at_level', '6+ plan refused at 2');
  s = art.learnPlan(s, 2, 'Weapon, +1').state;
  s = art.learnPlan(s, 2, 'Shield, +1').state;
  const rCap = art.learnPlan(s, 2, 'Rope of Climbing');
  assert(!rCap.success && rCap.reason === 'plans_known_cap', 'plans cap 4 at level 2');
  // Replace: created items from the replaced plan vanish.
  let s2 = art.defaultArtificerState();
  s2 = art.learnPlan(s2, 2, 'Bag of Holding').state;
  s2 = art.createReplicatedItems(s2, 2, ['Bag of Holding'], { tinkersToolsInHand: true }).state;
  assert(s2.createdItems.length === 1, 'created item present before replace');
  const rep = art.replacePlan(s2, 3, 'Bag of Holding', 'Weapon, +1'); s2 = rep.state;
  assert(rep.success && rep.vanished.length === 1 && s2.createdItems.length === 0, 'replaced plan vanishes its created item');
  const repMiss = art.replacePlan(s2, 3, 'Bag of Holding', 'Rope of Climbing');
  assert(!repMiss.success && repMiss.reason === 'plan_not_known', 'replace unknown plan refused');
}

// Group 3 — Creation: tools gate, cap, oldest-evicts, attune-on-create path.
group('3. Replicate creation');
{
  let s = art.defaultArtificerState();
  s = art.learnPlan(s, 2, 'Bag of Holding').state;
  s = art.learnPlan(s, 2, 'Weapon, +1').state;
  const noTools = art.createReplicatedItems(s, 2, ['Bag of Holding'], { tinkersToolsInHand: false });
  assert(!noTools.success && noTools.reason === 'tinkers_tools_required', 'creation needs Tinkers Tools in hand');
  const dup = art.createReplicatedItems(s, 2, ['Bag of Holding', 'Bag of Holding'], { tinkersToolsInHand: true });
  assert(!dup.success && dup.reason === 'duplicate_plan_in_creation', 'same plan twice in one rest refused');
  const unknown = art.createReplicatedItems(s, 2, ['Flame Tongue'], { tinkersToolsInHand: true });
  assert(!unknown.success && unknown.reason === 'plan_not_known', 'unknown plan refused');
  const ok = art.createReplicatedItems(s, 2, ['Bag of Holding', 'Weapon, +1'], { tinkersToolsInHand: true }); s = ok.state;
  assert(ok.success && s.createdItems.length === 2, 'two items created at level 2');
  assert(s.createdItems[1].bonus === 1, '+1 parsed from plan name onto the record');
  // At cap (2): creating a third evicts the oldest, not a refusal.
  s = art.learnPlan(s, 3, 'Rope of Climbing').state;
  const ev = art.createReplicatedItems(s, 3, ['Rope of Climbing'], { tinkersToolsInHand: true }); s = ev.state;
  assert(ev.success && ev.evicted.length === 1 && ev.evicted[0].plan === 'Bag of Holding', 'oldest evicted at cap');
  assert(s.createdItems.length === 2, 'held count stays at cap after eviction');
  const over = art.createReplicatedItems(s, 3, ['Bag of Holding', 'Weapon, +1', 'Rope of Climbing'], { tinkersToolsInHand: true });
  assert(!over.success && over.reason === 'create_count_exceeds_table', 'per-rest count cannot exceed the table');
}

// Group 4 — Attunement: hard cap, unattune frees, external items count.
group('4. Attunement');
{
  let s = art.defaultArtificerState();
  s = art.learnPlan(s, 2, 'Weapon, +1').state;
  s = art.learnPlan(s, 2, 'Shield, +1').state;
  s = art.createReplicatedItems(s, 2, ['Weapon, +1', 'Shield, +1'], { tinkersToolsInHand: true }).state;
  const [a, b] = s.createdItems;
  s = art.attuneCreatedItem(s, 2, a.id).state;
  s = art.attuneCreatedItem(s, 2, b.id).state;
  s = art.attuneExternalItem(s, 2, 'Cloak of Elvenkind').state;
  assert(art.attunedCount(s) === 3, 'created + external both count toward the cap');
  const over = art.attuneExternalItem(s, 2, 'Ring of Protection');
  assert(!over.success && over.reason === 'attunement_cap', 'over-cap attunement hard-refused');
  s = art.unattune(s, b.id).state;
  const after = art.attuneExternalItem(s, 2, 'Ring of Protection');
  assert(after.success, 'unattune frees a slot');
  const again = art.attuneCreatedItem(s, 2, a.id);
  assert(again.success && again.already, 're-attuning an attuned item is a no-op success');
  const miss = art.attuneCreatedItem(s, 2, 'art-999');
  assert(!miss.success && miss.reason === 'item_not_found', 'unknown item refused');
  let s4 = art.defaultArtificerState();
  s4 = art.learnPlan(s4, 2, 'Shield, +1').state;
  s4 = art.createReplicatedItems(s4, 2, ['Shield, +1'], { tinkersToolsInHand: true }).state;
  s4 = art.attuneCreatedItem(s4, 2, s4.createdItems[0].id).state;
  const byName = art.unattune(s4, 'Shield, +1');
  assert(byName.success && art.attunedCount(byName.state) === 0, 'unattune by created item name works');
}

// Group 5 — Tinker's Magic: list gate, uses, exhaustion, long-rest refill + vanish.
group('5. Tinker\'s Magic');
{
  let s = art.defaultArtificerState();
  const bad = art.useTinkersMagic(s, 3, 'Laser Pistol', { tinkersToolsInHand: true });
  assert(!bad.success && bad.reason === 'item_not_on_tinker_list', 'off-list item refused');
  const noTools = art.useTinkersMagic(s, 3, 'Rope', { tinkersToolsInHand: false });
  assert(!noTools.success && noTools.reason === 'tinkers_tools_required', 'tinker needs tools in hand');
  s = art.useTinkersMagic(s, 3, 'Rope', { tinkersToolsInHand: true }).state;
  s = art.useTinkersMagic(s, 3, 'Crowbar', { tinkersToolsInHand: true }).state;
  s = art.useTinkersMagic(s, 3, 'Torch', { tinkersToolsInHand: true }).state;
  const spent = art.useTinkersMagic(s, 3, 'Vial', { tinkersToolsInHand: true });
  assert(!spent.success && spent.reason === 'no_uses_left', 'Int-mod uses exhausted (3 uses at Int +3)');
  assert(s.tinkeredItems.length === 3, 'three tinkered items recorded');
  s = art.onLongRest(s, { level: 1, intMod: 3 }).state;
  assert(s.tinkersUsesLeft === 3 && s.tinkeredItems.length === 0, 'long rest refills uses and tinkered items vanish');
  const minOne = art.useTinkersMagic(art.defaultArtificerState(), -2, 'Rope', { tinkersToolsInHand: true });
  assert(minOne.success && minOne.usesLeft === 0, 'minimum one use at negative Int mod');
}

// Group 6 — Flash of Genius: flip / insufficient / already-succeeded / no-uses branches.
group('6. Flash of Genius');
{
  let s = art.defaultArtificerState();
  const flip = art.applyFlashOfGenius(s, { total: 13, dc: 15, intMod: 3 }); s = flip.state;
  assert(flip.success && flip.flips && flip.newTotal === 16, 'flash flips a failure within Int mod');
  assert(s.flashUsesLeft === 2, 'one use spent (3 max at Int +3)');
  const short = art.applyFlashOfGenius(s, { total: 10, dc: 15, intMod: 3 });
  assert(!short.success && short.reason === 'flash_insufficient' && short.newTotal === 13, 'flash that still fails does not spend a use');
  const won = art.applyFlashOfGenius(s, { total: 15, dc: 15, intMod: 3 });
  assert(!won.success && won.reason === 'already_succeeded', 'flash on a success refused');
  s = art.applyFlashOfGenius(s, { total: 12, dc: 15, intMod: 3 }).state;
  s = art.applyFlashOfGenius(s, { total: 12, dc: 15, intMod: 3 }).state;
  const empty = art.applyFlashOfGenius(s, { total: 12, dc: 15, intMod: 3 });
  assert(!empty.success && empty.reason === 'no_uses_left', 'flash with no uses refused');
  // Short rest: +1 at 14+, all at 20 when attuned.
  s = art.onShortRest(s, { level: 14, intMod: 3, attunedCount: 0 }).state;
  assert(s.flashUsesLeft === 1, 'Refreshed Genius +1 on short rest at 14');
  s = art.onShortRest(s, { level: 20, intMod: 3, attunedCount: 1 }).state;
  assert(s.flashUsesLeft === 3, 'Magical Guidance refills all on short rest at 20 when attuned');
  const unattuned20 = art.onShortRest({ ...art.defaultArtificerState(), flashUsesLeft: 0, flashUsesMax: 3 }, { level: 20, intMod: 3, attunedCount: 0 });
  assert(unattuned20.state.flashUsesLeft === 1, 'at 20 without attunement, only the L14 +1 applies');
}

// Group 7 — Tool Expertise gate, Right Tool gate.
group('7. Tool Expertise + Right Tool');
{
  assert(art.toolCheckBonus({ level: 5, proficient: true, proficiencyBonus: 3 }) === 3, 'no doubling before 6');
  assert(art.toolCheckBonus({ level: 6, proficient: true, proficiencyBonus: 3 }) === 6, 'doubled at 6 when proficient');
  assert(art.toolCheckBonus({ level: 6, proficient: false, proficiencyBonus: 3 }) === 3, 'no doubling when not proficient');
  const low = art.createRightTool(art.defaultArtificerState(), 2, "Smith's Tools");
  assert(!low.success && low.reason === 'level_too_low', 'Right Tool needs level 3');
  const ok = art.createRightTool(art.defaultArtificerState(), 3, "Smith's Tools");
  assert(ok.success && ok.tool === "Smith's Tools", 'Right Tool recorded at 3');
}

// Group 8 — Magic Item Tinker: charge / drain / transmute branches.
group('8. Magic Item Tinker');
{
  let s = art.defaultArtificerState();
  const lowCharge = art.chargeCreatedItem(s, 5, 'art-1', 1);
  assert(!lowCharge.success && lowCharge.reason === 'level_too_low', 'charge needs Magic Item Tinker (6)');
  const lowDrain = art.drainCreatedItem(s, 5, 'art-1');
  assert(!lowDrain.success && lowDrain.reason === 'level_too_low', 'drain needs Magic Item Tinker (6)');
  const lowTrans = art.transmuteCreatedItem(s, 5, 'art-1', 'Wand of Web');
  assert(!lowTrans.success && lowTrans.reason === 'level_too_low', 'transmute needs Magic Item Tinker (6)');
  s = art.learnPlan(s, 6, 'Wand of Magic Missiles').state;
  s = art.createReplicatedItems(s, 6, ['Wand of Magic Missiles'], { tinkersToolsInHand: true }).state;
  const wand = s.createdItems[0];
  const noCharges = art.chargeCreatedItem(s, 6, wand.id, 2);
  assert(!noCharges.success && noCharges.reason === 'item_uses_no_charges', 'charge needs a charges-using item');
  s.createdItems[0].charges = 1;
  const charged = art.chargeCreatedItem(s, 6, wand.id, 3); s = charged.state;
  assert(charged.success && charged.charges === 4, 'charge regains = slot level');
  const drainUnknown = art.drainCreatedItem(s, 6, wand.id);
  assert(!drainUnknown.success && drainUnknown.reason === 'rarity_unattested', 'drain refuses unattested rarity instead of guessing');
  s.createdItems[0].rarity = 'uncommon';
  const drained = art.drainCreatedItem(s, 6, wand.id); s = drained.state;
  assert(drained.success && drained.slotLevel === 2 && s.createdItems.length === 0, 'drain: uncommon -> level 2 slot, item vanishes');
  const drainedAgain = art.drainCreatedItem(s, 6, wand.id);
  assert(!drainedAgain.success, 'drain is once per long rest (and item is gone)');
  s = art.onLongRest(s, { level: 6, intMod: 3 }).state;
  assert(s.drainUsed === false && s.transmuteUsed === false, 'long rest resets drain/transmute flags');
  s = art.learnPlan(s, 6, 'Wand of Web').state;
  s = art.createReplicatedItems(s, 6, ['Wand of Magic Missiles'], { tinkersToolsInHand: true }).state;
  const itemId = s.createdItems[0].id;
  const trans = art.transmuteCreatedItem(s, 6, itemId, 'Wand of Web'); s = trans.state;
  assert(trans.success && s.createdItems[0].name === 'Wand of Web', 'transmute swaps to another known plan');
  const transAgain = art.transmuteCreatedItem(s, 6, itemId, 'Wand of Magic Missiles');
  assert(!transAgain.success && transAgain.reason === 'transmute_already_used_this_rest', 'transmute once per long rest');
  const transUnknown = art.transmuteCreatedItem({ ...art.defaultArtificerState(), plansKnown: ['Wand of Web'] }, 6, 'art-1', 'Wand of Web');
  assert(!transUnknown.success, 'transmute of a missing item refused');
}

// Group 9 — Spell-Storing Item: validation branches, uses, per-turn gate.
group('9. Spell-Storing Item');
{
  let s = art.defaultArtificerState();
  const lowStore = art.storeSpell(s, 10, 4, { name: 'Cure Wounds', level: 1, castTime: '1 action', materialConsumed: false });
  assert(!lowStore.success && lowStore.reason === 'level_too_low', 'spell-storing needs level 11');
  const high = art.storeSpell(s, 11, 4, { name: 'Healing Word', level: 1, castTime: '1 bonus action', materialConsumed: false });
  assert(!high.success && high.reason === 'spell_cast_time_not_action', 'bonus-action spell refused');
  const lvl4 = art.storeSpell(s, 11, 4, { name: 'Polymorph', level: 4, castTime: '1 action', materialConsumed: false });
  assert(!lvl4.success && lvl4.reason === 'spell_level_out_of_range', 'level 4 spell refused');
  const mat = art.storeSpell(s, 11, 4, { name: 'Revivify', level: 3, castTime: '1 action', materialConsumed: true });
  assert(!mat.success && mat.reason === 'spell_consumes_material', 'consumed-material spell refused');
  const unconfirmed = art.storeSpell(s, 11, 4, { name: 'Cure Wounds', level: 1, castTime: '1 action' });
  assert(!unconfirmed.success && unconfirmed.reason === 'material_unconfirmed', 'unconfirmed material refused');
  const ok = art.storeSpell(s, 11, 4, { name: 'Cure Wounds', level: 1, castTime: '1 action', materialConsumed: false }); s = ok.state;
  assert(ok.success && s.storedSpell.usesLeft === 8, 'stored uses = 2x Int mod (8 at +4)');
  const rel1 = art.releaseStoredSpell(s, 'turn-A'); s = rel1.state;
  assert(rel1.success && rel1.usesLeft === 7, 'release spends one use');
  const relSame = art.releaseStoredSpell(s, 'turn-A');
  assert(!relSame.success && relSame.reason === 'stored_spell_reused_this_turn', 'no reuse until the holder next turn');
  const relNext = art.releaseStoredSpell(s, 'turn-B');
  assert(relNext.success, 'release allowed on the next turn');
  let s2 = ok.state;
  for (let i = 0; i < 8; i++) s2 = art.releaseStoredSpell(s2, `turn-${i}`).state;
  const exhausted = art.releaseStoredSpell(s2, 'turn-99');
  assert(!exhausted.success && exhausted.reason === 'stored_spell_exhausted', 'exhausted stored spell refused');
}

// Group 10 — Soul of Artifice: save bonus cap, cheat death branches.
group('10. Soul of Artifice');
{
  assert(art.soulSaveBonus(19, 6) === 0, 'no save bonus before 20');
  assert(art.soulSaveBonus(20, 2) === 2 && art.soulSaveBonus(20, 9) === 6, 'save bonus = attuned count, capped at 6');
  let s = art.defaultArtificerState();
  s.createdItems = [
    { id: 'art-1', name: 'Weapon, +1', rarity: 'uncommon', attuned: false },
    { id: 'art-2', name: 'Bag of Holding', rarity: 'uncommon', attuned: false },
    { id: 'art-3', name: 'Mystery Item', rarity: null, attuned: false },
  ];
  const dead = art.cheatDeath(s, { killedOutright: true });
  assert(!dead.success && dead.reason === 'killed_outright', 'killed outright cannot cheat death');
  const lived = art.cheatDeath(s, { killedOutright: false }); s = lived.state;
  assert(lived.success && lived.hp === 40 && lived.consumed.length === 2, 'two uncommon/rare items -> 40 HP');
  assert(s.createdItems.length === 1 && s.createdItems[0].rarity === null, 'unattested-rarity item is not sacrificed');
  const none = art.cheatDeath(s, { killedOutright: false });
  assert(!none.success && none.reason === 'no_sacrificeable_items', 'no sacrificeable items refused');
}

// Group 11 — Homunculus Servant (Forge spell version): scaling + block.
group('11. Homunculus Servant');
{
  const h2 = art.homunculusStats(2, 5);
  assert(h2.ac === 13 && h2.hp === 15 && h2.hitDice === '2d4', 'L2 slot: HP 15, 2d4');
  assert(h2.speed.fly === 30 && h2.abilities.dex === 15 && h2.senses.includes('Darkvision 60'), 'stat block fields');
  assert(h2.actions[0].damage === '1d6+2 force' && h2.actions[0].bonus === 5, 'Force Strike 1d6+slot level, spell attack bonus');
  assert(h2.traits.some(t => t.includes('Magic Bond (+2')), 'Magic Bond scales with slot level');
  const h5 = art.homunculusStats(5, 7);
  assert(h5.hp === 30 && h5.actions[0].damage === '1d6+5 force', 'L5 slot: HP 30, 1d6+5');
  assert(h2.commandCost.startsWith('none'), 'Forge: obeys with no action required');
  let s = art.defaultArtificerState();
  const sum = art.summonHomunculus(s, 2, 5); s = sum.state;
  assert(sum.success && s.homunculus.hp === 15, 'summon records the servant');
}

// Group 12 — Prepared spells with always-prepared subclass spells excluded.
group('12. Prepared count + subclass seam');
{
  const v = art.validatePreparedSpells(5, ['Cure Wounds', 'Faerie Fire', 'Healing Word', 'Flaming Sphere', 'Aid', 'Web'], ['Healing Word', 'Flaming Sphere'], 3);
  assert(v.max === 5 && v.counted === 4 && v.ok, 'always-prepared subclass spells do not count (L5 Int +3: max 5)');
  const over = art.validatePreparedSpells(1, ['Alarm', 'Cure Wounds', 'Grease'], [], 2);
  assert(!over.ok && over.over === 1 && over.max === 2, 'over-prepared flagged at level 1 (max 2 at Int +2)');
  const def = art.validatePreparedSpells(1, ['Alarm', 'Cure Wounds'], []);
  assert(!def.ok && def.max === 1 && def.over === 1, 'validate defaults to mod 0 (L1 max 1)');
  assert(art.MULTICLASS_GRANT.hitDie === 8 && art.MULTICLASS_GRANT.tools[0] === "Tinker's Tools", 'Forge multiclass grant');
}

// Group 13 — DB round-trip through class_resources_json.artificer.
group('13. DB state round-trip');
{
  const charId = await insertRow('characters', {
    name: 'TEST_Artificer', level: 2, current_hp: 16, max_hp: 16,
    class_resources_json: JSON.stringify({ used: {} }),
  });
  let st = await art.loadArtificerState('character', charId);
  assert(Array.isArray(st.plansKnown) && st.plansKnown.length === 0, 'fresh load gives default state');
  st = art.learnPlan(st, 2, 'Bag of Holding').state;
  await art.saveArtificerState('character', charId, st);
  const reloaded = await art.loadArtificerState('character', charId);
  assert(reloaded.plansKnown.includes('Bag of Holding'), 'saved plans survive reload');
  const row = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [charId]);
  const parsed = JSON.parse(row.class_resources_json);
  assert(parsed.used && parsed.artificer, 'artificer state nests under class_resources_json without disturbing used');
}

// Group 14 — DM prompt section lines.
group('14. DM prompt section');
{
  const fresh = art.artificerPromptSection(art.defaultArtificerState(), { level: 2, intMod: 3 });
  assert(fresh.includes("Tinker's Magic uses left: 3/3"), 'fresh state displays full tinker uses');
  assert(fresh.includes('origin explanation REQUIRED'), 'missing origin flagged in prompt');
  const withOrigin = art.artificerPromptSection(
    { ...art.defaultArtificerState(), origin: { setting: 'Eberron', region: 'Khorvaire', explanation: 'Fell through a faulty portal' } },
    { level: 6, intMod: 3 }
  );
  assert(withOrigin.includes('Fell through a faulty portal'), 'recorded origin shown in prompt');
  assert(withOrigin.includes('Tool Expertise') && withOrigin.includes('doubled +6'), 'Tool Expertise line at 6 (PB 3, doubled 6)');
  const low = art.artificerPromptSection(art.defaultArtificerState(), { level: 2, intMod: 3 });
  assert(!low.includes('Tool Expertise'), 'no Tool Expertise line before 6');
}

// Group 15 — Rest reset preserves artificer state (the live-file fix).
group('15. Rest reset preserves artificer state');
{
  const kept = cfs.resetResourcesForRest(
    JSON.stringify({ used: { rage: 2 }, raging: true, bardicHeld: null, artificer: { plansKnown: ['Bag of Holding'] } }),
    { className: 'barbarian', level: 5, type: 'long' }
  );
  assert(kept.artificer && kept.artificer.plansKnown[0] === 'Bag of Holding', 'long rest preserves artificer state');
  assert(kept.used.rage === 0 && kept.raging === false, 'long rest still zeroes used + raging');
  const keptShort = cfs.resetResourcesForRest(
    JSON.stringify({ used: { rage: 2 }, artificer: { plansKnown: [] } }),
    { className: 'barbarian', level: 5, type: 'short' }
  );
  assert(keptShort.artificer, 'short rest preserves artificer state');
  assert(keptShort.used.rage === 1, 'short rest still restores +1 rage');
}

console.log(`\nartificer-class: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.log('failures:', failures); process.exit(1); }
