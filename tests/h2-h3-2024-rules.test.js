// tests/h2-h3-2024-rules.test.js — H2 + H3, the 2024 rules corrections
// (brief docs/pm/h2-h3-2024-rules-corrections/BRIEF.md; Zach's rulings
// 2026-11-12).
//
// H2: a long rest regains ALL spent Hit Dice (was: half the pool, min 1).
//   - hitDiceRegain is the one place, and the PC rest, the companion
//     rest and the downtime rest all reach it: 0 spent -> 0 regained;
//     some spent -> all regained; never above the maximum; a short rest
//     still spends dice to heal.
// H3: the Bard / Cleric / Druid / Wizard prepared caps are the printed
//   2024 class-table Prepared Spells column, mod-independent:
//     Bard/Cleric/Druid 4,5,6,7,9,10,11,12,14,15,16,16,17,17,18,18,19,20,21,22
//     Wizard            4,5,6,7,9,10,11,12,14,15,16,16,17,18,19,21,22,23,24,25
//   (values from the brief, checked against Zach's PHB photos; literals
//   here on purpose, so the test does not grade the code against itself).
//   Checked on every surface: getSpellsPrepared (server, GET /api/spells,
//   the Stage 4 validator), the four class services' validators, the
//   character sheet's getMaxPrepared (extracted from the live JSX and
//   executed), the creator's no-endpoint fallback (the generated dataset
//   + preparedCountFor), and the companion PartyBuilder table. The other
//   prepared casters are pinned to their values from before this job.
//
// Run from the repo root: node tests/h2-h3-2024-rules.test.js
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; } else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const origCwd = process.cwd();
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'h2-h3-test-'));
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const lp = await import(fromRepo('server/config/levelProgression.js'));
const { getSpellsPrepared, getXPToNextLevel } = lp;
const rt = await import(fromRepo('server/services/restTimeService.js'));
const bard = await import(fromRepo('server/services/bardService.js'));
const cleric = await import(fromRepo('server/services/clericService.js'));
const druid = await import(fromRepo('server/services/druidService.js'));
const wizard = await import(fromRepo('server/services/wizardService.js'));

const BCD = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const WIZ = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25];
const TABLE = { bard: BCD, cleric: BCD, druid: BCD, wizard: WIZ };
const MODS = [-1, 0, 3, 5];
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const J = (v) => JSON.stringify(v);

// ===========================================================================
group('H3 (a) getSpellsPrepared = the printed column, every level 1-20 x mods [-1, 0, +3, +5]');
{
  for (const cls of Object.keys(TABLE)) {
    let bad = 0;
    for (const lvl of LEVELS) for (const mod of MODS) {
      if (getSpellsPrepared(cls, lvl, mod) !== TABLE[cls][lvl - 1]) bad++;
    }
    check(bad === 0, `${cls}: server cap is the table at all 80 level/mod points (${bad} off)`);
    check(MODS.every((m) => getSpellsPrepared(cls, 1, m) === 4), `${cls}: L1 = 4 at every modifier`);
  }
  check(getSpellsPrepared('bard', 1, 2) === 4 && getSpellsPrepared('cleric', 1, 5) === 4,
    'the brief\'s own example: a +2 caster goes 3 -> 4, a +5 caster 6 -> 4');
  check(J(lp.BARD_CLERIC_DRUID_SPELLS_PREPARED) === J(BCD) && J(lp.WIZARD_SPELLS_PREPARED) === J(WIZ),
    'the exported table constants are the printed columns');
  // The wizard column happens to equal Int mod + level at the standard
  // ASI progression; that agreement is preserved.
  check(getSpellsPrepared('wizard', 1, 3) === 1 + 3 && getSpellsPrepared('wizard', 5, 4) === 5 + 4
    && getSpellsPrepared('wizard', 20, 5) === 20 + 5,
    'wizard agrees with the old formula at the standard ASI mods (L1 +3 = 4, L5 +4 = 9, L20 +5 = 25)');
  const src = readRepo('server/config/levelProgression.js');
  const fn = src.slice(src.indexOf('function getSpellsPrepared'), src.indexOf('\n}\n', src.indexOf('function getSpellsPrepared')));
  check(!/mod \+ lvl\)/.test(fn), 'no "mod + lvl" formula arm remains in getSpellsPrepared');
}

// ===========================================================================
group('H3 (b) the four class validators read the same table (mod accepted, ignored)');
{
  const svc = { bard, cleric, druid, wizard };
  for (const [cls, s] of Object.entries(svc)) {
    let bad = 0;
    for (const lvl of LEVELS) for (const mod of MODS) {
      if (s.preparedSpellsMax(mod, lvl) !== TABLE[cls][lvl - 1]) bad++;
    }
    check(bad === 0, `${cls}Service.preparedSpellsMax = table at all 80 points (${bad} off)`);
    const spells = (n) => Array.from({ length: n }, (_, i) => `Spell ${i}`);
    const at = s.validatePreparedSpells(0, 1, spells(4), []);
    const over = s.validatePreparedSpells(5, 1, spells(5), []);
    check(at.ok && at.max === 4, `${cls}: 4 spells at L1 with mod +0 passes (old formula refused at 1)`);
    check(!over.ok && over.max === 4 && over.over === 1, `${cls}: 5 spells at L1 with mod +5 refuses (old formula allowed 6)`);
    const always = s.validatePreparedSpells(0, 5, [...spells(9), 'Moonbeam'], ['Moonbeam']);
    check(always.ok && always.counted === 9, `${cls}: an always-prepared spell still does not count`);
  }
}

// ===========================================================================
group('H3 (c) other prepared casters pinned to their values from before this job');
{
  // Literal values captured from the pre-change getSpellsPrepared
  // (commit c070405) at mods [-1, 0, +3, +5].
  const PAL = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15];
  const SOR = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
  const WLK = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15];
  const BY_MOD = {
    artificer: [[1,1,1,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9],[1,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10],[3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13],[5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15]],
    blackguard: [[0,1,1,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9],[0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10],[0,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13],[0,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,14,14,15]],
    paladin: [PAL, PAL, PAL, PAL],
    ranger: [PAL, PAL, PAL, PAL],
    sorcerer: [SOR, SOR, SOR, SOR],
    warlock: [WLK, WLK, WLK, WLK],
  };
  for (const [cls, rows] of Object.entries(BY_MOD)) {
    let bad = 0;
    MODS.forEach((mod, mi) => LEVELS.forEach((lvl) => { if (getSpellsPrepared(cls, lvl, mod) !== rows[mi][lvl - 1]) bad++; }));
    check(bad === 0, `${cls}: unchanged at all 80 level/mod points (${bad} moved)`);
  }
}

// ===========================================================================
group('H3 (d) the character sheet getMaxPrepared (extracted from the live JSX and executed)');
{
  const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
  const classesJson = JSON.parse(readRepo('client/src/data/classes.json'));
  const start = sheetSrc.indexOf('const getMaxPrepared = () => {');
  const end = sheetSrc.indexOf('// Check if class is a prepared caster', start);
  assert(start !== -1 && end !== -1, 'sheet defines getMaxPrepared');
  const fnSrc = sheetSrc.slice(start, end);
  const body = fnSrc.slice(fnSrc.indexOf('{') + 1, fnSrc.lastIndexOf('}'));
  const third = sheetSrc.match(/const THIRD_CASTER_PREPARED_SPELLS = \[[^\]]*\]/)[0];
  const pal = sheetSrc.match(/const PALADIN_PREPARED_SPELLS = \[[^\]]*\]/)[0];
  const getMax = new Function('isThirdCaster', 'isProfaneSoul', 'classData', 'abilities', 'character', `${third};\n${pal};\n${body}`);
  const scoreFor = (mod) => 10 + 2 * mod;
  for (const cls of Object.keys(TABLE)) {
    const ability = classesJson[cls]?.spellcasting?.ability?.toLowerCase().slice(0, 3);
    let bad = 0;
    for (const lvl of LEVELS) for (const mod of MODS) {
      const abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, [ability]: scoreFor(mod) };
      const cap = getMax(false, false, classesJson[cls], abilities, { class: cls, level: lvl });
      if (cap !== TABLE[cls][lvl - 1] || cap !== getSpellsPrepared(cls, lvl, mod)) bad++;
    }
    check(bad === 0, `sheet ${cls}: matches the table AND the server at all 80 points (${bad} off)`);
  }
  check(!/mod \+ character\.level\)/.test(fnSrc), 'no "mod + character.level" branch remains on the sheet');
}

// ===========================================================================
group('H3 (e) the creator: Stage 4 server count and the no-endpoint fallback');
{
  // Stage 4 (server/routes/character.js) calls getSpellsPrepared(cls, 1,
  // mod) — covered by (a). The fallback reads the generated dataset.
  const catalog = JSON.parse(readRepo('client/src/data/spellCatalog.generated.json'));
  for (const cls of Object.keys(TABLE)) {
    const rule = catalog.level1ByClass?.[cls]?.spellsPrepared;
    check(rule?.kind === 'table' && Object.values(rule.byMod).every((v) => v === 4),
      `dataset ${cls}: kind table, 4 at every probed mod (got ${J(rule)})`);
  }
  // Execute the real preparedCountFor: the module's two JSON imports are
  // swapped for the parsed files (Node cannot import JSON bare).
  let src = readRepo('client/src/components/creator-next/spellCatalogFallback.js');
  src = src.replace("import catalog from '../../data/spellCatalog.generated.json'", `const catalog = ${readRepo('client/src/data/spellCatalog.generated.json')}`)
           .replace("import classesData from '../../data/classes.json'", `const classesData = ${readRepo('client/src/data/classes.json')}`);
  const tmp = path.join(tmpDir, 'fallback.mjs');
  fs.writeFileSync(tmp, src);
  const fb = await import(pathToFileURL(tmp).href);
  for (const cls of Object.keys(TABLE)) {
    check([-2, -1, 0, 2, 3, 5, 6].every((m) => fb.preparedCountFor(cls, m) === 4),
      `fallback ${cls}: 4 at L1 for mods -2..+6, including mods outside the probed range`);
    check(fb.preparedCountRuleText(cls) === 'a fixed number from your class table', `fallback ${cls}: rule text says table`);
  }
  check(fb.preparedCountFor('paladin', 3) === 2 && fb.preparedCountFor('artificer', 3) === 3 && fb.preparedCountFor('blackguard', 3) === 0,
    'fallback for the pinned classes is unchanged (paladin 2, artificer +3 -> 3, blackguard 0)');
}

// ===========================================================================
group('H3 (f) the companion PartyBuilder: bard/cleric/druid use the table');
{
  const pb = readRepo('client/src/components/PartyBuilder.jsx');
  const decl = pb.match(/const BARD_CLERIC_DRUID_PREPARED = \[[^\]]*\]/);
  check(decl && decl[0].replace(/\s+/g, '').endsWith(J(BCD)), 'PartyBuilder table literal is the printed column');
  for (const cls of ['bard', 'cleric', 'druid']) {
    const block = pb.slice(pb.indexOf(`  ${cls}: {`), pb.indexOf('spellcastingAbility', pb.indexOf(`  ${cls}: {`)));
    check(block.includes('preparedTable: BARD_CLERIC_DRUID_PREPARED'), `PartyBuilder ${cls} reads the table`);
  }
  check(!pb.includes('return Math.max(1, abilityMod + level)'), 'PartyBuilder has no mod + level prepared arm');
}

// ===========================================================================
// Routes: the real character router (PUT + level-up) and GET /api/spells.
const app = express();
app.use(express.json());
app.use('/api/character', (await import(fromRepo('server/routes/character.js'))).default);
app.use('/api/spells', (await import(fromRepo('server/routes/spells.js'))).default);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function makeCharacter({ name, cls, level, scores }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST ${name}: ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level, experience: getXPToNextLevel(level - 1) || 0, max_hp: 20, current_hp: 20,
    ability_scores: J(scores), class_levels: J([{ class: cls, level, subclass: null }]),
  });
  assert(put.status === 200, `fixture PUT ${name}: ${put.status} ${J(put.json?.error || '')}`);
  return id;
}
const FLAT = { str: 10, dex: 10, con: 14, int: 10, wis: 10, cha: 10 }; // every mod +0

group('H3 (g) GET /api/spells serves the table count');
{
  for (const cls of Object.keys(TABLE)) {
    const r1 = await req('GET', `/api/spells?class=${cls}&level=1&abilityMod=0`);
    const r5 = await req('GET', `/api/spells?class=${cls}&level=14&abilityMod=5`);
    check(r1.status === 200 && r1.json?.spellsPrepared === 4, `${cls} L1 mod +0: spellsPrepared 4 (got ${r1.json?.spellsPrepared})`);
    check(r5.status === 200 && r5.json?.spellsPrepared === TABLE[cls][13], `${cls} L14 mod +5: ${TABLE[cls][13]} (got ${r5.json?.spellsPrepared})`);
  }
}

group('H3 (h) the bard validator on the real routes: PUT and level-up');
{
  const spells = ['Healing Word', 'Dissonant Whispers', 'Charm Person', 'Faerie Fire', 'Thunderwave',
    'Sleep', 'Bane', 'Cure Wounds', 'Heroism', 'Invisibility'];
  // PUT at L1, Cha +0: the old formula capped this bard at 1.
  const b1 = await makeCharacter({ name: 'TEST_H3 Bard One', cls: 'bard', level: 1, scores: FLAT });
  const at = await req('PUT', `/api/character/${b1}`, { prepared_spells: J(spells.slice(0, 4)) });
  check(at.status === 200, `PUT 4 prepared at L1 (Cha +0) persists 200 (got ${at.status}: ${J(at.json?.error || '')})`);
  const over = await req('PUT', `/api/character/${b1}`, { prepared_spells: J(spells.slice(0, 5)) });
  check(over.status === 400 && String(over.json?.error).includes('at most 4'), `PUT 5 at L1 refuses 400 "at most 4" (got ${over.status}: ${J(over.json?.error)})`);
  // Level-up L4 -> L5 at Cha +0: new cap 9 (old formula 5).
  const okId = await makeCharacter({ name: 'TEST_H3 Bard Up Ok', cls: 'bard', level: 4, scores: FLAT });
  await db.dbRun('UPDATE characters SET experience = ?, prepared_spells = ? WHERE id = ?', [getXPToNextLevel(4), J(spells.slice(0, 9)), okId]);
  const up = await req('POST', `/api/character/level-up/${okId}`, {});
  check(up.status === 200 && (await db.dbGet('SELECT level FROM characters WHERE id = ?', [okId])).level === 5,
    `level-up to 5 with 9 stored (cap 9) succeeds (got ${up.status}: ${J(up.json?.error || '')})`);
  const badId = await makeCharacter({ name: 'TEST_H3 Bard Up Over', cls: 'bard', level: 4, scores: FLAT });
  await db.dbRun('UPDATE characters SET experience = ?, prepared_spells = ? WHERE id = ?', [getXPToNextLevel(4), J(spells.slice(0, 10)), badId]);
  const blocked = await req('POST', `/api/character/level-up/${badId}`, {});
  check(blocked.status === 400 && String(blocked.json?.error).includes('at most 9'),
    `level-up to 5 with 10 stored refuses 400 "at most 9" (got ${blocked.status}: ${J(blocked.json?.error)})`);
  check((await db.dbGet('SELECT level FROM characters WHERE id = ?', [badId])).level === 4, 'refused level-up leaves the level at 4');
}

group('H3 (i) the cleric and druid validators on the real PUT');
{
  for (const cls of ['cleric', 'druid']) {
    const list = cls === 'cleric'
      ? ['Bless', 'Guiding Bolt', 'Healing Word', 'Shield of Faith', 'Command']
      : ['Entangle', 'Faerie Fire', 'Goodberry', 'Thunderwave', 'Speak with Animals'];
    const id = await makeCharacter({ name: `TEST_H3 ${cls} One`, cls, level: 1, scores: FLAT });
    const at = await req('PUT', `/api/character/${id}`, { prepared_spells: J(list.slice(0, 4)) });
    check(at.status === 200, `${cls}: PUT 4 at L1 (Wis +0) persists 200 (got ${at.status}: ${J(at.json?.error || '')})`);
    const over = await req('PUT', `/api/character/${id}`, { prepared_spells: J(list) });
    check(over.status === 400 && String(over.json?.error).includes('at most 4'), `${cls}: PUT 5 at L1 refuses 400 (got ${over.status})`);
  }
}
server.close();

// ===========================================================================
async function insertRow(table, overrides = {}) {
  const info = await db.dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) { cols.push(c.name); vals.push(overrides[c.name]); continue; }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await db.dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}
const used = (row, col) => rt.totalDice(JSON.parse(row[col] || '{}'));

group('H2 (a) hitDiceRegain: all spent dice back, none invented');
{
  check(rt.totalDice(rt.hitDiceRegain({ d8: 5 }, { d8: 4 })) === 0, 'pool 5, spent 4 -> nothing still spent');
  check(rt.totalDice(rt.hitDiceRegain({ d8: 5 }, {})) === 0, 'nothing spent -> nothing to regain');
  check(rt.totalDice(rt.hitDiceRegain({ d10: 3, d6: 2 }, { d10: 3, d6: 2 })) === 0, 'multiclass pool fully spent -> all back');
  const src = readRepo('server/services/restTimeService.js');
  check(!src.includes('Math.floor(total / 2)'), 'the half-of-total rule is gone from the rest service');
  check(readRepo('server/services/dmPromptBuilder.js').includes('ALL spent hit dice regained')
    && !readRepo('server/services/dmPromptBuilder.js').includes('half of spent hit dice regained'),
    'the DM prompt states the 2024 rule');
}

// A campaign-less character's rest uses the per-character clock (S1).
const fb = await db.dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL LIMIT 1');
if (!fb) await db.dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
const pcId = await insertRow('characters', {
  name: 'TEST_H2 Rester', class: 'Fighter', level: 5, current_hp: 10, max_hp: 44,
  ability_scores: J({ str: 16, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }),
  hit_dice: J({ d10: 5 }), hit_dice_used: J({ d10: 3 }), spell_slots_used: '{}', game_day: 1, game_year: 1492, game_hour: 8,
});
const sessionId = await insertRow('dm_sessions', { character_id: pcId, game_start_day: 1, game_start_year: 1492 });
const npcId = await insertRow('npcs', { name: 'TEST_H2 Lyra', race: 'Elf' });
const compId = await insertRow('companions', {
  npc_id: npcId, recruited_by_character_id: pcId, status: 'active', companion_class: 'Ranger', companion_level: 4,
  companion_current_hp: 6, companion_max_hp: 30,
  companion_ability_scores: J({ str: 12, dex: 16, con: 12, int: 10, wis: 14, cha: 8 }),
  companion_spell_slots_used: '{}', companion_hit_dice: J({ d10: 4 }), companion_hit_dice_used: J({ d10: 4 }),
});

group('H2 (b) PC + companion long rest: every spent die comes back');
{
  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
  check(r.success === true, `party long rest succeeds (${J(r.reason || '')})`);
  const pcRes = r.event?.results?.find((x) => x.kind === 'pc');
  const compRes = r.event?.results?.find((x) => x.kind === 'companion');
  const pc = await db.dbGet('SELECT hit_dice_used FROM characters WHERE id = ?', [pcId]);
  const comp = await db.dbGet('SELECT companion_hit_dice_used FROM companions WHERE id = ?', [compId]);
  check(used(pc, 'hit_dice_used') === 0 && pcRes?.diceRegained === 3, `PC: 3 of 5 spent -> all 3 regained (got ${pcRes?.diceRegained}, still spent ${used(pc, 'hit_dice_used')})`);
  check(used(comp, 'companion_hit_dice_used') === 0 && compRes?.diceRegained === 4, `companion: all 4 spent -> all 4 regained (got ${compRes?.diceRegained})`);
  // Again with nothing spent: nothing to regain, never above the maximum.
  const again = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
  const pcAgain = again.event?.results?.find((x) => x.kind === 'pc');
  const compAgain = again.event?.results?.find((x) => x.kind === 'companion');
  check(pcAgain?.diceRegained === 0 && compAgain?.diceRegained === 0, 'second long rest with 0 spent regains 0 (PC and companion)');
  const pool = rt.parseDicePool((await db.dbGet('SELECT hit_dice FROM characters WHERE id = ?', [pcId])).hit_dice);
  check(rt.totalDice(pool) === 5, 'the pool itself is untouched (maximum stays 5)');
}

group('H2 (c) short rest still spends dice to heal (PC and companion)');
{
  await db.dbRun('UPDATE characters SET current_hp = 10 WHERE id = ?', [pcId]);
  await db.dbRun('UPDATE companions SET companion_current_hp = 6 WHERE id = ?', [compId]);
  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', dice: 2 });
  check(r.success === true, 'party short rest succeeds');
  const pc = await db.dbGet('SELECT current_hp, hit_dice_used FROM characters WHERE id = ?', [pcId]);
  const comp = await db.dbGet('SELECT companion_current_hp, companion_hit_dice_used FROM companions WHERE id = ?', [compId]);
  check(used(pc, 'hit_dice_used') === 2 && pc.current_hp > 10, `PC: Dice=2 spends 2 and heals (hp ${pc.current_hp}, spent ${used(pc, 'hit_dice_used')})`);
  check(used(comp, 'companion_hit_dice_used') === 2 && comp.companion_current_hp > 6, `companion: spends 2 and heals (hp ${comp.companion_current_hp})`);
  const long = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
  check(long.event?.results?.find((x) => x.kind === 'pc')?.diceRegained === 2
    && long.event?.results?.find((x) => x.kind === 'companion')?.diceRegained === 2,
    'the next long rest brings both of those dice back');
}

group('H2 (d) the downtime long rest reaches the same rule');
{
  await db.dbRun('UPDATE characters SET hit_dice_used = ? WHERE id = ?', [J({ d10: 4 }), pcId]);
  const r = await rt.applyDowntimeRest({ characterId: pcId, type: 'long' });
  const pc = await db.dbGet('SELECT hit_dice_used FROM characters WHERE id = ?', [pcId]);
  check(r.success === true && r.diceRegained === 4 && used(pc, 'hit_dice_used') === 0, `downtime long rest: 4 spent -> all 4 back (got ${r.diceRegained})`);
}

console.log(`\nh2-h3-2024-rules: ${passed} passed, ${failed} failed`);
process.chdir(origCwd);
process.exit(failed > 0 ? 1 : 0);
