/**
 * Companion Sheet tests — real character sheets for class-based companions.
 *
 * The schema always had the columns (companion_ability_scores,
 * skill_proficiencies, companion_class, companion_level); what was missing
 * was population and use. These tests pin:
 *   - deterministic generation (standard array by class priority, class
 *     skill proficiencies at 5e counts) — since v1.0.187 a keyless sheet
 *     generates FROM a rolled build archetype (weighted; template ~50%),
 *     and these tests pin that the generated sheet matches its archetype;
 *   - ensureCompanionSheet backfill semantics: generates only for absent
 *     or flat-10-placeholder sheets, never overwrites a real sheet or a
 *     player's chosen skills, ignores npc_stats companions, idempotent;
 *   - the roll resolver reading the companion's REAL sheet with the same
 *     math as the PC (computePcModifier parity), including lazy
 *     generation on first roll.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compsheet-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const sheets = await import(fromRepo('server/services/companionSheetService.js'));
const rolls = await import(fromRepo('server/services/rollRequestService.js'));
const archData = await import(fromRepo('server/data/companionArchetypes.js'));

async function insertRow(table, overrides = {}) {
  const cols = await db.dbAll(`PRAGMA table_info(${table})`);
  const names = [];
  const values = [];
  for (const col of cols) {
    if (col.pk && col.type.toUpperCase().includes('INT')) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, col.name)) {
      names.push(col.name); values.push(overrides[col.name]);
    } else if (col.notnull) {
      names.push(col.name);
      const t = col.type.toUpperCase();
      values.push(t.includes('INT') || t.includes('REAL') || t.includes('NUM') ? 0 : 'x');
    }
  }
  const placeholders = names.map(() => '?').join(',');
  const r = await db.dbRun(`INSERT INTO ${table} (${names.join(',')}) VALUES (${placeholders})`, values);
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------
group('1. Generation — deterministic class builds');
const ranger = sheets.generateAbilityScores('Ranger');
assert(ranger.dex === 15 && ranger.wis === 14 && ranger.con === 13 && ranger.str === 12 && ranger.int === 10 && ranger.cha === 8,
       'ranger: DEX 15, WIS 14, CON 13, STR 12, INT 10, CHA 8');
const wizard = sheets.generateAbilityScores('wizard');
assert(wizard.int === 15 && wizard.con === 14 && wizard.dex === 13, 'wizard (case-insensitive): INT 15, CON 14, DEX 13');
const unknown = sheets.generateAbilityScores('Nonsense');
assert(unknown.str === 15 && unknown.dex === 14 && unknown.con === 13, 'unknown class: default priority order');
assert(JSON.stringify(sheets.defaultSkillProficiencies('Rogue')) ===
       JSON.stringify(['Stealth', 'Sleight of Hand', 'Perception', 'Investigation']),
       'rogue: 4 skills — Stealth, Sleight of Hand, Perception, Investigation');
assert(JSON.stringify(sheets.defaultSkillProficiencies('Ranger')) ===
       JSON.stringify(['Stealth', 'Perception', 'Survival']), 'ranger: 3 skills');
assert(sheets.defaultSkillProficiencies('Fighter').length === 2, 'fighter: 2 skills');
assert(sheets.isFlatSheet({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }) === true, 'all-10s is flat');
assert(sheets.isFlatSheet({ str: 10, dex: 11, con: 10, int: 10, wis: 10, cha: 10 }) === false, 'one real score is not flat');
assert(sheets.isFlatSheet(null) === true, 'null sheet counts as flat/absent');

// ---------------------------------------------------------------------------
group('2. Fixtures');
const campaignId = await insertRow('campaigns', { name: 'Sheet Test Campaign' });
const pcId = await insertRow('characters', { name: 'Sheet Tester', class: 'Fighter', level: 5, campaign_id: campaignId });
async function makeCompanion(npcName, overrides = {}) {
  const npcId = await insertRow('npcs', { name: npcName });
  return await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'class_based', companion_class: 'Ranger', companion_level: 5,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    skill_proficiencies: '[]',
    ...overrides
  });
}
const flatId = await makeCompanion('Flat Fiona');
const realId = await makeCompanion('Real Roland', {
  companion_class: 'Fighter',
  companion_ability_scores: JSON.stringify({ str: 17, dex: 12, con: 14, int: 9, wis: 11, cha: 10 }),
  skill_proficiencies: JSON.stringify(['Athletics', 'Perception'])
});
const chosenId = await makeCompanion('Chosen Cora', {
  companion_class: 'Bard',
  skill_proficiencies: JSON.stringify(['Deception'])
});
const npcStatsId = await makeCompanion('Statty', {
  progression_type: 'npc_stats', companion_class: null,
  original_stats_snapshot: JSON.stringify({ cr: '2', ac: 13, hp: 22 })
});
assert(flatId > 0 && realId > 0 && chosenId > 0 && npcStatsId > 0, 'companion fixtures inserted');

// ---------------------------------------------------------------------------
group('3. ensureCompanionSheet — backfill semantics');
const gen = await sheets.ensureCompanionSheet(flatId);
assert(gen && gen.generated === true, 'flat-10 class_based companion gets a generated sheet');
// v1.0.187: a keyless sheet rolls a build archetype at generation; the
// sheet must be exactly that archetype's build (template ~50% of rolls).
assert(gen.archetypeKey != null && archData.getArchetype('ranger', gen.archetypeKey) != null,
       'generation rolled and returned an archetype key');
const genArch = archData.getArchetype('ranger', gen.archetypeKey);
assert(JSON.stringify(gen.abilityScores) === JSON.stringify(sheets.generateAbilityScores('Ranger', genArch)),
       'generated sheet is the rolled archetype build');
assert(JSON.stringify(gen.skills) === JSON.stringify(sheets.defaultSkillProficiencies('Ranger', genArch)),
       'generated skills are the rolled archetype skills');
const persistedRow = await db.dbGet('SELECT companion_ability_scores, archetype_key FROM companions WHERE id = ?', [flatId]);
assert(JSON.stringify(JSON.parse(persistedRow.companion_ability_scores)) === JSON.stringify(gen.abilityScores) &&
       persistedRow.archetype_key === gen.archetypeKey, 'generated sheet + archetype persisted to the DB');
const again = await sheets.ensureCompanionSheet(flatId);
assert(again.generated === false, 'second ensure is a no-op (idempotent)');

const real = await sheets.ensureCompanionSheet(realId);
assert(real.generated === false && real.abilityScores.str === 17, 'a real sheet is never overwritten');

const chosen = await sheets.ensureCompanionSheet(chosenId);
assert(chosen.generated === false && chosen.skills.length === 1 && chosen.skills[0] === 'Deception',
       'flat scores + player-chosen skills: sheet untouched, skills respected');
// By design, a sheet with skills a player picked counts as a deliberate
// build — ability generation only fires when NO skills were chosen.
assert(chosen.abilityScores.dex === 10, 'chosen-skills sheet keeps its (flat) abilities by design');

assert((await sheets.ensureCompanionSheet(npcStatsId)) === null, 'npc_stats companion: ensure returns null, stat block rules');
assert((await sheets.ensureCompanionSheet(999999)) === null, 'missing companion → null');

// ---------------------------------------------------------------------------
group('4. Resolver parity — companions roll from their real sheet');
const lyraNpcId = await insertRow('npcs', { name: 'Lyra' });
await insertRow('companions', {
  npc_id: lyraNpcId, recruited_by_character_id: pcId, status: 'active',
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 5,
  companion_ability_scores: JSON.stringify({ str: 12, dex: 17, con: 13, int: 10, wis: 15, cha: 8 }),
  skill_proficiencies: JSON.stringify(['Stealth', 'Perception', 'Survival'])
});
let mod = await rolls.getNpcCheckModifier('Lyra', 'skill', 'Stealth', pcId);
assert(mod.actorType === 'companion' && mod.modifier === 6, 'Lyra Stealth: DEX +3 + prof 3 = +6');
mod = await rolls.getNpcCheckModifier('Lyra', 'skill', 'Survival', pcId);
assert(mod.modifier === 5, 'Lyra Survival: WIS +2 + prof 3 = +5');
mod = await rolls.getNpcCheckModifier('Lyra', 'skill', 'Athletics', pcId);
assert(mod.modifier === 1, 'Lyra Athletics (untrained): STR +1');
mod = await rolls.getNpcCheckModifier('Lyra', 'save', 'Dexterity', pcId);
assert(mod.modifier === 6, 'Lyra DEX save (ranger class save): +3 + 3 = +6');

// Lazy generation on first roll for a flat companion: the roll generates
// the sheet from a rolled archetype (v1.0.187), so the expected modifier
// is computed from whatever sheet actually materialized (level 3 → prof
// +2 when the rolled build trains Stealth).
const lazyNpcId = await insertRow('npcs', { name: 'Lazy Liam' });
const lazyId = await insertRow('companions', {
  npc_id: lazyNpcId, recruited_by_character_id: pcId, status: 'active',
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
  skill_proficiencies: '[]'
});
mod = await rolls.getNpcCheckModifier('Lazy Liam', 'skill', 'Stealth', pcId);
const lazyRowFull = await db.dbGet('SELECT companion_ability_scores, skill_proficiencies, archetype_key FROM companions WHERE id = ?', [lazyId]);
const lazyScores = JSON.parse(lazyRowFull.companion_ability_scores);
const lazySkills = JSON.parse(lazyRowFull.skill_proficiencies || '[]');
const lazyExpected = Math.floor((lazyScores.dex - 10) / 2) + (lazySkills.includes('Stealth') ? 2 : 0);
assert(mod.actorType === 'companion' && mod.modifier === lazyExpected,
       'flat companion: first roll generates the sheet and rolls from it');
assert(lazyRowFull.archetype_key != null && !sheets.isFlatSheet(lazyScores), 'lazy generation persisted (sheet + archetype)');

mod = await rolls.getNpcCheckModifier('Statty', 'skill', 'Stealth', pcId);
assert(mod.actorType === 'companion' && mod.modifier === 3, 'npc_stats companion: CR 2 → +3, typed companion');

// ---------------------------------------------------------------------------
console.log(`\n companion-sheet: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);


