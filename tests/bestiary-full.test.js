/**
 * tests/bestiary-full.test.js — full 2024 statblocks (Step 1:
 * Bestiary expansion, v1.0.194; design: bestiary-expansion-design.md).
 *
 * Pins:
 *   - the canonical data module: 350+ full entries, required-field
 *     completeness, standard CR/XP pairing, book spot values, the 23
 *     provisional (reconstructed) NPC bodies marked in-entry;
 *   - lookupBestiaryFull resolution order: DB statblock_json overlay
 *     > canonical data (incl. 2024-rename aliases: "goblin" resolves
 *     the Goblin Warrior) > legacy-shaped DB row;
 *   - migration 085 + COMBAT_START: default-shaped enemy specs are
 *     filled from the block, AI-specified numbers stand, the block
 *     snapshots into combat_enemies.stats_json either way, the row
 *     keeps the DM's name, and a per-enemy digest joins the system
 *     note;
 *   - resolveSpellSave reads REAL save modifiers from the snapshot
 *     (printed save > ability modifier), not the CR estimate;
 *   - typed party damage applies resistance (half) / vulnerability
 *     (double) / immunity (zero) from the snapshot, with the
 *     nonmagical-qualifier honoring the magical flag; untyped and
 *     block-less damage is unchanged;
 *   - condition immunities refuse CONDITION_ADD on enemies, at both
 *     the service and the marker layer.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-bestiary-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { BESTIARY_ENTRIES } = await import(svc('server/data/bestiaryData.js'));
const bls = await import(svc('server/services/bestiaryLookupService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const cs = await import(svc('server/services/conditionService.js'));
const scs = await import(svc('server/services/spellCastService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers

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
// Fixtures
// ---------------------------------------------------------------------------
const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 30, max_hp: 30, armor_class: 10,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  skills: JSON.stringify([])
});
// Sera: L3 cleric, WIS 16 → spell save DC 13.
const seraId = await insertRow('characters', {
  name: 'Sera', class: 'Cleric', level: 3,
  current_hp: 24, max_hp: 24, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([])
});
const seraRow = await dbGet('SELECT * FROM characters WHERE id = ?', [seraId]);

// ---------------------------------------------------------------------------
group('1. Canonical data integrity');
{
  const keys = Object.keys(BESTIARY_ENTRIES);
  assert(keys.length >= 350, `entry count >= 350 (got ${keys.length})`);
  const XP_BY_CR = { '0': 10, '1/8': 25, '1/4': 50, '1/2': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900 };
  let malformed = 0;
  let badXp = 0;
  for (const e of Object.values(BESTIARY_ENTRIES)) {
    const ab = e.abilities || {};
    const okEntry = e.name && e.cr && typeof e.xp === 'number' && e.size && e.type
      && typeof e.ac === 'number' && typeof e.hp === 'number' && e.hitDice
      && ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(s => typeof ab[s] === 'number')
      && Array.isArray(e.resistances) && Array.isArray(e.vulnerabilities)
      && Array.isArray(e.immunities) && Array.isArray(e.conditionImmunities)
      && Array.isArray(e.actions);
    if (!okEntry) malformed++;
    if (XP_BY_CR[e.cr] !== undefined && e.xp !== XP_BY_CR[e.cr] && !(e.cr === '0' && e.xp === 0)) badXp++;
  }
  assert(malformed === 0, `all entries complete (${malformed} malformed)`);
  assert(badXp === 0, `CR/XP pairing standard (${badXp} off)`);
  assert(Object.values(BESTIARY_ENTRIES).filter(e => e.provisional).length === 23,
    'exactly the 23 reconstructed NPC bodies are marked provisional');
  assert(Object.values(BESTIARY_ENTRIES).filter(e => e.spellcasting).length >= 40,
    'spellcaster blocks present for Step 8');

  const gw = BESTIARY_ENTRIES['goblin warrior'];
  assert(gw.hp === 7 && gw.ac === 15 && gw.abilities.dex === 14, 'goblin warrior book values');
  const ogre = BESTIARY_ENTRIES['ogre'];
  assert(ogre.hp === 59 && ogre.ac === 11, 'ogre matches the legacy seed numbers');
  const sk = BESTIARY_ENTRIES['skeleton'];
  assert(sk.hp === 13 && sk.ac === 13 && sk.vulnerabilities.includes('bludgeoning')
    && sk.immunities.includes('poison') && sk.conditionImmunities.includes('poisoned'),
    'skeleton vuln/immunity/condition-immunity values');
  const mf = BESTIARY_ENTRIES['mind flayer'];
  assert(mf.hp === 99 && mf.saves.int === 7 && mf.saves.wis === 6 && mf.saves.dex === 4
    && mf.spellcasting && mf.spellcasting.dc === 15, 'mind flayer real saves + spellcasting');
  assert(BESTIARY_ENTRIES['assassin'].hp === 78 && BESTIARY_ENTRIES['assassin'].ac === 15,
    'assassin = the verifiable public-record values');
  assert(BESTIARY_ENTRIES['piercer'].hitDice === '3d8+9', 'piercer hitDice book correction');

  // Pure helpers against real + synthetic vocab.
  assert(bls.resolveBestiaryKey('Goblin') === 'goblin warrior', 'alias: goblin → goblin warrior');
  assert(bls.resolveBestiaryKey('skeleton') === 'skeleton', 'skeleton is its own key');
  assert(bls.damageAdjustmentFor(sk, 'bludgeoning')?.label === 'vulnerable', 'unit: skeleton vulnerable');
  assert(bls.damageAdjustmentFor(sk, 'poison')?.label === 'immune', 'unit: skeleton immune');
  assert(bls.damageAdjustmentFor(BESTIARY_ENTRIES['wraith'], 'bludgeoning', { magical: true }) === null,
    'unit: nonmagical-only resistance does not stop spell damage');
  assert(bls.conditionImmunityMatch(sk.conditionImmunities, 'exhaustion_2'),
    'unit: exhaustion family immunity matches a level key');
}

// ---------------------------------------------------------------------------
group('2. Lookup resolution order (DB overlay > canonical > legacy-shaped)');
{
  const canon = await bls.lookupBestiaryFull('goblin');
  assert(canon && canon.name === 'Goblin Warrior' && canon.abilities.str === 8,
    'canonical entry resolves through the rename alias');
  const thug = await bls.lookupBestiaryFull('thug');
  assert(thug && thug.name === 'Tough', 'legacy alias key (thug) resolves its 2024 entry');
  assert((await bls.lookupBestiaryFull('definitely not a creature')) === null, 'unknown name → null');

  const cols = new Set((await dbAll('PRAGMA table_info(bestiary)')).map(c => c.name));
  assert(cols.has('statblock_json'), 'migration 085: bestiary.statblock_json exists');
  const nameCol = cols.has('name') ? 'name' : 'display_name';
  const hpCol = cols.has('max_hp') ? 'max_hp' : 'hp';
  const acCol = cols.has('armor_class') ? 'armor_class' : 'ac';
  const crCol = cols.has('challenge_rating') ? 'challenge_rating' : 'cr';
  const xpCol = cols.has('xp_value') ? 'xp_value' : 'xp';

  // Tier 1: a statblock_json row under the asked name wins outright.
  const custom = {
    name: 'Goblin King', cr: '2', xp: 450, size: 'Small', type: 'humanoid', alignment: 'neutral evil',
    ac: 17, hp: 44, hitDice: '8d6+16', speed: '30 ft.',
    abilities: { str: 12, dex: 16, con: 14, int: 10, wis: 10, cha: 14 },
    saves: {}, skills: {}, resistances: [], vulnerabilities: [], immunities: [], conditionImmunities: [],
    senses: '', languages: '', traits: [], actions: [], bonusActions: [], reactions: [], legendaryActions: [],
    spellcasting: null, sourceBook: 'custom'
  };
  const existing = await dbGet(`SELECT id FROM bestiary WHERE LOWER(${nameCol}) = LOWER(?)`, ['Goblin']);
  let overlayId = null;
  if (existing) {
    await dbRun('UPDATE bestiary SET statblock_json = ? WHERE id = ?', [JSON.stringify(custom), existing.id]);
    overlayId = existing.id;
  } else {
    overlayId = await insertRow('bestiary', { [nameCol]: 'Goblin', statblock_json: JSON.stringify(custom) });
  }
  const over = await bls.lookupBestiaryFull('goblin');
  assert(over && over.name === 'Goblin King' && over.hp === 44, 'statblock_json overlay wins over canonical');
  if (existing) await dbRun('UPDATE bestiary SET statblock_json = NULL WHERE id = ?', [overlayId]);
  else await dbRun('DELETE FROM bestiary WHERE id = ?', [overlayId]);
  const restored = await bls.lookupBestiaryFull('goblin');
  assert(restored && restored.name === 'Goblin Warrior', 'canonical again once the overlay is removed');

  // Tier 3: a numbers-only custom row shapes into the entry shape —
  // but never shadows a canonical entry (the tier-2 check above).
  const mudId = await insertRow('bestiary', {
    [nameCol]: 'Mud Golem', [hpCol]: 30, [acCol]: 14, attack_bonus: 5,
    damage_dice: '2d6+3', dex_mod: 1, [crCol]: 3, [xpCol]: 700
  });
  const mud = await bls.lookupBestiaryFull('mud golem');
  assert(mud && mud.legacy === true && mud.hp === 30 && mud.abilities === null,
    'legacy-shaped custom row resolves with abilities null');
  await dbRun('DELETE FROM bestiary WHERE id = ?', [mudId]);
}

// ---------------------------------------------------------------------------
const sessionB = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
group('3. COMBAT_START fills from the block + snapshots + digests');
{
  const r = await marker('[COMBAT_START: Enemies="Goblin, Skeleton, Wraith"]',
    { characterId: pcId, sessionId: sessionB });
  assert(r && r.type === 'combat_start', 'combat started');
  assert(typeof r.systemNote === 'string' && r.systemNote.includes('Enemy intel')
    && r.systemNote.includes('Nimble Escape'), 'digest line joins the system note');
  const gob = await dbGet('SELECT * FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionB, 'Goblin']);
  assert(gob && gob.max_hp === 7 && gob.armor_class === 15 && gob.attack_bonus === 4
    && gob.damage_dice === '1d6+2' && gob.dex_mod === 2, 'goblin row filled from the block');
  assert(gob.name === 'Goblin', "row keeps the DM's name (markers target it)");
  const snap = JSON.parse(gob.stats_json || 'null');
  assert(snap && snap.name === 'Goblin Warrior' && snap.abilities.dex === 14, 'stats_json snapshot stored');
  const skRow = await dbGet('SELECT * FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionB, 'Skeleton']);
  const skSnap = JSON.parse(skRow.stats_json || 'null');
  assert(skSnap && skSnap.vulnerabilities.includes('bludgeoning'), 'skeleton snapshot carries vulnerabilities');
}

// ---------------------------------------------------------------------------
group('4. Condition immunities refuse enemy conditions');
{
  const skRow = await dbGet('SELECT * FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionB, 'Skeleton']);
  const refused = await cs.addCondition('enemy', skRow.id, 'poisoned');
  assert(refused.success === false && refused.immune === true, 'service refuses poisoned on a skeleton');
  const refusedEx = await cs.addCondition('enemy', skRow.id, 'exhaustion_2');
  assert(refusedEx.success === false && refusedEx.immune === true, 'exhaustion family refused too');
  const viaMarker = await marker('[CONDITION_ADD: Target="Skeleton" Condition="poisoned"]',
    { characterId: pcId, sessionId: sessionB });
  assert(viaMarker && viaMarker.success === false, 'marker layer surfaces the refusal');
  const allowed = await cs.addCondition('enemy', skRow.id, 'prone');
  assert(allowed.success === true, 'non-immune condition applies');
  const conds = await cs.getConditions('enemy', skRow.id);
  assert(conds.includes('prone') && !conds.includes('poisoned'), 'stored conditions reflect both outcomes');
}

// ---------------------------------------------------------------------------
group('5. Typed damage: resistance / vulnerability / immunity / magical flag');
{
  const untyped = await es.applyDamageToEnemy(sessionB, 1, 'Skeleton', 5);
  assert(untyped.damageDealt === 5 && untyped.currentHp === 8 && untyped.damageAdjustment === null,
    'untyped damage unchanged (13 → 8)');
  const immune = await es.applyPartyDamageToEnemy(sessionB, 1, 'Skeleton', 10, pcId, { damageType: 'poison' });
  assert(immune.damageDealt === 0 && immune.damageAdjustment === 'immune' && immune.currentHp === 8,
    'poison immunity zeroes the packet');
  const vuln = await es.applyPartyDamageToEnemy(sessionB, 1, 'Skeleton', 10, pcId, { damageType: 'bludgeoning' });
  assert(vuln.damageDealt === 20 && vuln.damageAdjustment === 'vulnerable' && vuln.killed === true,
    'bludgeoning vulnerability doubles and kills');
  const resisted = await es.applyPartyDamageToEnemy(sessionB, 1, 'Wraith', 10, pcId, { damageType: 'fire', magical: true });
  assert(resisted.damageDealt === 5 && resisted.damageAdjustment === 'resistant' && resisted.currentHp === 62,
    'fire resistance halves (67 → 62)');
  const mundane = await es.applyPartyDamageToEnemy(sessionB, 1, 'Wraith', 10, pcId, { damageType: 'bludgeoning' });
  assert(mundane.damageDealt === 5 && mundane.currentHp === 57,
    'nonmagical-weapon resistance applies to a mundane hit');
  const magical = await es.applyPartyDamageToEnemy(sessionB, 1, 'Wraith', 10, pcId, { damageType: 'bludgeoning', magical: true });
  assert(magical.damageDealt === 10 && magical.damageAdjustment === null && magical.currentHp === 47,
    'the same bludgeoning as spell damage bypasses the nonmagical qualifier');
}

// ---------------------------------------------------------------------------
group('6. resolveSpellSave reads real modifiers from the snapshot');
{
  const gobSave = await scs.resolveSpellSave({
    sessionId: sessionB, casterCharacterId: seraId, casterKind: 'player',
    casterRow: seraRow, spellName: 'Fireball', targetName: 'Goblin'
  });
  assert(gobSave && gobSave.modifier === 2 && gobSave.dc === 13,
    `goblin DEX save = ability modifier +2, not an estimate (got ${gobSave?.modifier})`);

  const sessionC = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  await marker('[COMBAT_START: Enemies="Mind Flayer"]', { characterId: pcId, sessionId: sessionC });
  const wisSave = await scs.resolveSpellSave({
    sessionId: sessionC, casterCharacterId: seraId, casterKind: 'player',
    casterRow: seraRow, spellName: 'Hold Person', targetName: 'Mind Flayer'
  });
  assert(wisSave && wisSave.modifier === 6, `mind flayer WIS save = printed +6 (got ${wisSave?.modifier})`);
  const dexSave = await scs.resolveSpellSave({
    sessionId: sessionC, casterCharacterId: seraId, casterKind: 'player',
    casterRow: seraRow, spellName: 'Fireball', targetName: 'Mind Flayer'
  });
  assert(dexSave && dexSave.modifier === 4, `mind flayer DEX save = printed +4, beating its +2 ability modifier (got ${dexSave?.modifier})`);
}

// ---------------------------------------------------------------------------
group('7. AI-specified stats stand; the snapshot still attaches');
{
  const sessionD = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  const r = await marker('[COMBAT_START: Enemies="Ogre (HP 99, AC 18, ATK +9, DMG 2d6+4, DEX +1)"]',
    { characterId: pcId, sessionId: sessionD });
  const ogre = await dbGet('SELECT * FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionD, 'Ogre']);
  assert(ogre && ogre.max_hp === 99 && ogre.armor_class === 18 && ogre.attack_bonus === 9,
    'explicit DM numbers are not overridden by the book');
  const snap = JSON.parse(ogre.stats_json || 'null');
  assert(snap && snap.name === 'Ogre' && snap.hp === 59, 'book block still snapshots for saves/resistances');
  assert(r.systemNote.includes('Greatclub'), 'digest covers the specified enemy too');
}

// ---------------------------------------------------------------------------
group('8. Legacy regression: a block-less enemy takes typed damage unadjusted');
{
  const sessionE = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  await es.createEncounterEnemies(sessionE, 1, [{
    name: 'Training Golem', maxHp: 30, armorClass: 12, attackBonus: 3, damageDice: '1d6', dexMod: 0
  }]);
  const row = await dbGet('SELECT * FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionE, 'Training Golem']);
  assert(row && row.stats_json === null, 'no snapshot without a resolved block');
  const res = await es.applyPartyDamageToEnemy(sessionE, 1, 'Training Golem', 10, pcId, { damageType: 'fire', magical: true });
  assert(res.damageDealt === 10 && res.damageAdjustment === null && res.currentHp === 20,
    'typed damage on a block-less enemy applies in full');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
