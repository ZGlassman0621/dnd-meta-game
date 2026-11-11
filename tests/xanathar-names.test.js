// tests/xanathar-names.test.js — Xanathar Appendix B name bank wiring (2026-11-03).
// The DM draws new-NPC names from the bank instead of inventing them.
// Real data module, real dealing service, real temp DB (same pattern as
// time-evolution.test.js). No LLM calls, no npcs rows written by dealing.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-xanathar-names-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const data = await import(svc('server/data/xanatharNames.js'));
const ns = await import(svc('server/services/xanatharNameService.js'));
const pb = await import(svc('server/services/dmPromptBuilder.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

// insertRow from time-evolution.test.js: fills every NOT NULL column with
// no default, so hand-written SQL never trips SQLITE_CONSTRAINT_NOTNULL.
async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
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

function countNames(node) {
  let total = 0; let tables = 0;
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) { total += v.length; tables++; }
    else { const sub = countNames(v); total += sub.total; tables += sub.tables; }
  }
  return { total, tables };
}
function allNames(node, out = []) {
  for (const v of Object.values(node)) {
    if (Array.isArray(v)) out.push(...v);
    else allNames(v, out);
  }
  return out;
}

const T = data.XANATHAR_NAME_TABLES;

group('1. Data integrity: 55 tables, 2,749 names, book grouping intact');
{
  const { total, tables } = countNames(T);
  ok(tables === 55, `55 tables (got ${tables})`);
  ok(total === 2749, `2,749 names (got ${total})`);
  // Count nonhuman by summing every group except human explicitly.
  let nh = 0; let nhTables = 0;
  for (const [k, v] of Object.entries(T)) {
    if (k === 'human') continue;
    const c = countNames(v); nh += c.total; nhTables += c.tables;
  }
  ok(nh === 1050 && nhTables === 21, `nonhuman 1,050 names / 21 tables (got ${nh} / ${nhTables})`);
  const h = countNames(T.human);
  ok(h.total === 1699 && h.tables === 34, `human 1,699 names / 34 tables (got ${h.total} / ${h.tables})`);
  ok(Object.keys(T.human).length === 17, `17 human cultures (got ${Object.keys(T.human).length})`);
  ok(T.human.mesoamerican.female.length === 48, 'Mesoamerican female 48 (one name unrecovered, gap left)');
  ok(T.human.mesoamerican.male.length === 51, 'Mesoamerican male 51');
  let allFifty = true;
  for (const [k, v] of Object.entries(T)) {
    for (const [sk, arr] of Object.entries(v)) {
      if (k === 'human') {
        for (const [ck, lists] of Object.entries(v)) {
          for (const [gk, list] of Object.entries(lists)) {
            if (!((ck === 'mesoamerican' && gk === 'female' && list.length === 48) || (ck === 'mesoamerican' && gk === 'male' && list.length === 51) || list.length === 50)) allFifty = false;
          }
        }
        break;
      }
      if (!((k === 'human') || arr.length === 50)) allFifty = false;
    }
  }
  ok(allFifty, 'every table is 50 names except Mesoamerican 48/51');
  const names = allNames(T);
  ok(!names.some((n) => n.includes('[?]')), 'no "[?]" marker in any spoken name');
  ok(!names.some((n) => n.includes('  ') || n !== n.trim()), 'no padded or double-spaced names');
  // No duplicates within any single table (cross-table repeats are real:
  // e.g. Ren appears in more than one table, so this is per-table only).
  let perTableClean = true;
  const checkNode = (node) => {
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) { if (new Set(v).size !== v.length) perTableClean = false; }
      else checkNode(v);
    }
  };
  checkNode(T);
  ok(perTableClean, 'no duplicate name inside any single table');
  ok(data.XANATHAR_FLAGGED_NAMES.length === 10, `10 flagged readings recorded (got ${data.XANATHAR_FLAGGED_NAMES.length})`);
  const flaggedNames = data.XANATHAR_FLAGGED_NAMES.map((f) => f.name).sort();
  ok(JSON.stringify(flaggedNames) === JSON.stringify(['Ara', 'Bearach', 'Camila', 'Catlina', 'Coszcatl', 'Franciso', 'Ka', 'Kunsgnos', 'Tialli', 'Vonana'].sort()), 'flagged list is exactly the 10 bank-file readings');
  ok(data.XANATHAR_FLAGGED_NAMES.every((f) => names.includes(f.name)), 'every flagged name is present as a spoken name');
}

group('2. Single deal: suffix rules, labels, unknown inputs return null');
{
  const dwarf = ns.dealXanatharName({ species: 'dwarf', gender: 'female' });
  ok(dwarf && dwarf.fullName === `${dwarf.personal} ${dwarf.suffix}`, 'dwarf female gets personal + clan');
  ok(dwarf && T.dwarf.clan.includes(dwarf.suffix), 'dwarf suffix comes from the clan table');
  ok(dwarf && dwarf.label === 'Dwarf, female', 'dwarf label is "Dwarf, female"');
  const child = ns.dealXanatharName({ species: 'elf', gender: 'child' });
  ok(child && child.fullName === child.personal && child.suffix === null, 'elf child has no suffix');
  ok(child && child.label === 'Elf (child)', 'elf child label is "Elf (child)"');
  const virtue = ns.dealXanatharName({ species: 'tiefling', virtue: true });
  ok(virtue && T.tiefling.virtue.includes(virtue.fullName), 'virtue deal comes from the virtue table');
  ok(virtue && virtue.label === 'Tiefling (virtue name)', 'virtue label is "Tiefling (virtue name)"');
  const orc = ns.dealXanatharName({ species: 'halfOrc', gender: 'male' });
  ok(orc && orc.suffix === null, 'half-orc has no suffix table in the book');
  ok(ns.dealXanatharName({ species: 'aarakocra', gender: 'female' }) === null, 'unknown species returns null, never an invented name');
  ok(ns.dealXanatharName({ species: 'human', gender: 'female', humanCulture: 'atlantis' }) === null, 'unknown human culture returns null');
  ok(ns.dealXanatharName({ species: 'dwarf', gender: 'child' }) === null, 'unknown gender for a species returns null');
  const exhausted = ns.dealXanatharName({
    species: 'tiefling', virtue: true,
    usedFirst: new Set(T.tiefling.virtue.map((n) => n.toLowerCase())),
  });
  ok(exhausted === null, 'an exhausted table returns null, never a padded name');
}

group('3. Hand: 20 unused names, real DB filter, dealing writes nothing');
{
  await insertRow('npcs', { name: 'Dagnal Balderk', race: 'Dwarf' });
  await insertRow('npcs', { name: 'Farideh', race: 'Dragonborn' });
  const before = await dbGet('SELECT COUNT(*) AS n FROM npcs');
  const hand = await ns.dealAvailableNames({ usedNames: ['Gimli'], dbAll });
  ok(hand.length === 20, `hand deals 20 names (got ${hand.length})`);
  const fulls = hand.map((e) => e.fullName.toLowerCase());
  const personals = hand.map((e) => e.personal.toLowerCase());
  ok(new Set(fulls).size === fulls.length, 'no duplicate full name inside the hand');
  ok(new Set(personals).size === personals.length, 'no duplicate personal name inside the hand');
  ok(!personals.includes('dagnal') && !personals.includes('farideh') && !personals.includes('gimli'), 'hand excludes npcs rows (Dagnal, Farideh) and usedNames (Gimli) by first name');
  ok(!fulls.includes('dagnal balderk'), 'hand never re-deals an existing NPC full name');
  const bankNames = new Set(allNames(T));
  ok(hand.every((e) => bankNames.has(e.personal) && (e.suffix === null || bankNames.has(e.suffix))), 'every dealt personal and suffix comes from the bank');
  ok(hand.every((e) => !e.fullName.includes('[?]')), 'no "[?]" in any dealt name');
  ok(hand.some((e) => e.label === 'Tiefling (virtue name)'), 'hand includes a tiefling virtue name');
  ok(hand.filter((e) => e.species === 'human').length === 4, 'hand includes 4 human names');
  const humanCultures = new Set(hand.filter((e) => e.species === 'human').map((e) => e.table.split(',')[0]));
  ok(humanCultures.size === 4, 'the 4 human names come from 4 distinct cultures');
  const after = await dbGet('SELECT COUNT(*) AS n FROM npcs');
  ok(Number(after.n) === Number(before.n), 'dealing inserts no npcs rows');
  // usedNames empty: the npcs-table filter alone must still block Dagnal.
  const hand2 = await ns.dealAvailableNames({ usedNames: [], dbAll });
  ok(!hand2.map((e) => e.personal.toLowerCase()).includes('dagnal'), 'npcs-table filter blocks Dagnal even with no usedNames');
  // A failing npcs lookup degrades gracefully instead of throwing.
  const hand3 = await ns.dealAvailableNames({ usedNames: [], dbAll: async () => { throw new Error('db down'); } });
  ok(Array.isArray(hand3) && hand3.length === 20, 'a failed npcs lookup still deals a full hand from usedNames only');
}

group('4. Prompt wiring: available-names block appears only when a hand exists');
{
  const character = {
    name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter',
    level: 5, hp: 45, max_hp: 45, ac: 16, gender: 'male', game_day: 100, game_hour: 10,
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [],
    prepared_spells: [], equipment: {},
  };
  const ctx = {
    companions: [], awayCompanions: [],
    worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
    campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
    previousSessionSummaries: [], characterMemories: '', campaignNotes: '',
    continueCampaign: false, pendingDowntimeNarratives: [],
    availableNames: [
      { fullName: 'Dagnal Balderk', label: 'Dwarf, female' },
      { fullName: 'Creed', label: 'Tiefling (virtue name)' },
    ],
  };
  const prompt = pb.createDMSystemPrompt(character, ctx);
  ok(prompt.includes('NAMES AVAILABLE FOR NEW NPCS (pick from this list'), 'prompt renders the available-names block with its header');
  ok(prompt.includes('Dagnal Balderk (Dwarf, female)'), 'prompt lists the dealt dwarf name with its label');
  ok(prompt.includes('Creed (Tiefling (virtue name))'), 'prompt lists the dealt virtue name with its label');
  ok(prompt.includes('pick a name from NAMES AVAILABLE FOR NEW NPCS'), 'naming block points the DM at the available list');
  const emptyPrompt = pb.createDMSystemPrompt(character, { ...ctx, availableNames: [] });
  ok(!emptyPrompt.includes('NAMES AVAILABLE FOR NEW NPCS (pick from this list'), 'no available-names block when the hand is empty');
  ok(emptyPrompt.includes('pick a name from NAMES AVAILABLE FOR NEW NPCS'), 'empty-hand prompt still carries the naming pointer sentence (that phrase alone is not the block)');
  ok(pb.formatAvailableNames([]) === '', 'formatAvailableNames([]) is empty string');
  ok(pb.formatAvailableNames([{ fullName: 'Mira Thorn', label: 'Human (Norse), female' }]).includes('Mira Thorn (Human (Norse), female)'), 'formatAvailableNames renders a single entry');
}

console.log(`\nxanathar-names: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
