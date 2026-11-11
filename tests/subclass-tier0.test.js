// tests/subclass-tier0.test.js — subclass wiring Tier 0 proof batch:
// registry + Champion (Fighter) + Life Domain (Cleric) only.
// Real services, real DB (same pattern as item-8 tests): the DB
// round-trip group creates real character/companion rows, reads
// them back, and feeds the rows to the registry + prompt builder.
// Pure-math groups use the real subclassService functions, never
// re-implemented numbers. No other subclass is asserted here —
// Tier 0 covers exactly these two, and an unknown subclass must
// return null, never invented features.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-subclass-tier0-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const ss = await import(svc('server/services/subclassService.js'));
const dp = await import(svc('server/services/dmPromptBuilder.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

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

async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Fighter', level: 10,
    current_hp: 80, max_hp: 80, armor_class: 18,
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    spell_slots_used: JSON.stringify({}),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 6,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 10, wis: 16, cha: 12 }),
    companion_current_hp: 40, companion_max_hp: 40, armor_class: 15,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

group('1. Registry lookup');
ok(ss.getSubclass('fighter', 'Champion')?.key === 'champion', 'Champion found by class + name');
ok(ss.getSubclass('FIGHTER', 'champion')?.name === 'Champion', 'lookup is case/normalization insensitive');
ok(ss.getSubclass('cleric', 'Life Domain')?.key === 'life_domain', 'Life Domain found');
ok(ss.getSubclass('fighter', 'Unknown Subclass') === null, 'unbuilt subclass returns null, never invented');
ok(ss.getSubclass('fighter', '') === null, 'blank subclass returns null');
ok(ss.listSubclasses('fighter').length === 11, 'fighter file exports Champion + Batch 1 three + S1 three + S3 one + S4 one + S5 one + Additional Islander (Tier 0 count was 1 before Batch 1)');
ok(ss.listSubclasses('cleric').length === 11, 'cleric file exports Life Domain + Batch 2 three + S1 two + S3 one + S4 one + S5 one + Additional Fate Domain, Sea Domain (Tier 0 count was 1 before Batch 2)');
ok(ss.getSubclass('fighter', 'Champion')?.selectionLevel === 3, 'Champion selection level is 3');
ok(ss.getSubclass('cleric', 'Life Domain')?.selectionLevel === 3, 'Life Domain selection level is 3');
ok(ss.getSubclass('fighter', 'Champion')?.origin_setting === 'Forgotten Realms', 'Champion origin is Forgotten Realms');
ok(ss.getSubclass('cleric', 'Life Domain')?.origin_setting === 'Forgotten Realms', 'Life Domain origin is Forgotten Realms');

group('2. Features at level + Champion crit thresholds');
ok(ss.featuresAtLevel('fighter', 'Champion', 3).map((f) => f.key).join(',') === 'improved_critical,remarkable_athlete', 'Champion L3 has exactly Improved Critical + Remarkable Athlete');
ok(ss.featuresAtLevel('fighter', 'Champion', 7).some((f) => f.key === 'additional_fighting_style'), 'Champion L7 adds Additional Fighting Style');
ok(ss.featuresAtLevel('fighter', 'Champion', 10).some((f) => f.key === 'heroic_warrior'), 'Champion L10 adds Heroic Warrior');
ok(ss.featuresAtLevel('fighter', 'Champion', 18).length === 6, 'Champion L18 has all 6 features');
ok(ss.critThresholdFor({ className: 'fighter', subclassName: 'Champion', level: 2 }) === 20, 'crit threshold 20 before level 3');
ok(ss.critThresholdFor({ className: 'fighter', subclassName: 'Champion', level: 3 }) === 19, 'crit threshold 19 at level 3');
ok(ss.critThresholdFor({ className: 'fighter', subclassName: 'Champion', level: 15 }) === 18, 'crit threshold 18 at level 15');
ok(ss.critThresholdFor({ className: 'cleric', subclassName: 'Life Domain', level: 20 }) === 20, 'non-Champion threshold stays 20');
ok(ss.critThresholdFor({ className: 'fighter', subclassName: 'Battle Master', level: 20 }) === 20, 'unknown subclass threshold stays 20');

group('3. Stored-choice validation (kind G)');
ok(ss.validateChoice('fighter', 'Champion', 'additional_fighting_style', 'Defense').valid, 'Defense is a valid Additional Fighting Style choice');
ok(ss.validateChoice('fighter', 'Champion', 'additional_fighting_style', 'defense').valid, 'choice validation is normalized');
ok(!ss.validateChoice('fighter', 'Champion', 'additional_fighting_style', 'Sharpshooter').valid, 'Sharpshooter is not a Fighting Style choice');
ok(!ss.validateChoice('fighter', 'Champion', 'draconic_ancestry', 'Red').valid, 'undeclared choice key is invalid, never defaulted');
ok(!ss.validateChoice('cleric', 'Life Domain', 'additional_fighting_style', 'Defense').valid, 'Life Domain has no stored choices');

group('4. Origin / selection completeness');
ok(ss.validateSelection({ className: 'fighter', subclassName: 'Champion', level: 3, originExplanation: '' }).complete, 'Forgotten Realms subclass needs no origin explanation');
ok(!ss.validateSelection({ className: 'fighter', subclassName: 'Champion', level: 2 }).complete, 'level below selection level is incomplete');
ok(!ss.validateSelection({ className: 'fighter', subclassName: 'Unknown Subclass', level: 3 }).complete, 'unknown subclass selection is incomplete');
ok(ss.isOutsideFr({ origin_setting: 'Exandria' }), 'isOutsideFr flags a non-FR setting');
ok(!ss.isOutsideFr(ss.getSubclass('fighter', 'Champion')), 'isOutsideFr does not flag Champion');

group('5. Life Domain math (kinds D/E/C)');
ok(ss.lifeDomainSpellsAtLevel(3).join(',') === 'Aid,Bless,Cure Wounds,Lesser Restoration', 'Life L3 always-prepared spells');
ok(ss.lifeDomainSpellsAtLevel(5).includes('Revivify'), 'Life L5 adds Revivify');
ok(ss.lifeDomainSpellsAtLevel(9).length === 10, 'Life L9 always-prepared list is all 10 spells');
ok(ss.lifeDiscipleBonus(1) === 3 && ss.lifeDiscipleBonus(3) === 5, 'Disciple of Life bonus is 2 + slot level');
ok(ss.lifeBlessedHealerBonus(3) === 5, 'Blessed Healer bonus is 2 + slot level');
ok(ss.lifePreserveLifePool(6) === 30, 'Preserve Life pool is 5 x cleric level');
ok(!ss.lifeHealingDiceMaxed({ className: 'cleric', subclassName: 'Life Domain', level: 16 }), 'no Supreme Healing at 16');
ok(ss.lifeHealingDiceMaxed({ className: 'cleric', subclassName: 'Life Domain', level: 17 }), 'Supreme Healing at 17');
ok(ss.featuresAtLevel('cleric', 'Life Domain', 3).some((f) => f.key === 'preserve_life'), 'Preserve Life is a level 3 Life feature');
ok(!ss.featuresAtLevel('cleric', 'Life Domain', 17).some((f) => f.key === 'relieve_suffering'), 'Relieve Suffering is NOT in Tier 0 data (PHB-verified absent from the 2024 PHB)');

group('6. Survivor turn-start heal (kind E)');
ok(ss.survivorHealAtTurnStart({ className: 'fighter', subclassName: 'Champion', level: 18, conMod: 3, currentHp: 20, maxHp: 50 }) === 8, 'Survivor heals 5 + Con mod when Bloodied');
ok(ss.survivorHealAtTurnStart({ className: 'fighter', subclassName: 'Champion', level: 18, conMod: 3, currentHp: 30, maxHp: 50 }) === 0, 'Survivor does not heal above half HP');
ok(ss.survivorHealAtTurnStart({ className: 'fighter', subclassName: 'Champion', level: 18, conMod: 3, currentHp: 0, maxHp: 50 }) === 0, 'Survivor does not heal at 0 HP');
ok(ss.survivorHealAtTurnStart({ className: 'fighter', subclassName: 'Champion', level: 17, conMod: 3, currentHp: 10, maxHp: 50 }) === 0, 'no Survivor before level 18');

group('7. DB round-trip + DM prompt section (PC vs companion split)');
const pc = await addPc({ subclass: 'Champion' });
const lifeComp = await addCompanion('Mira', pc.id, { companion_class: 'Cleric', companion_subclass: 'Life Domain' });
const npcStatsComp = await addCompanion('Brute', pc.id, { companion_class: 'Fighter', companion_subclass: 'Champion', progression_type: 'npc_stats' });
const pcRow = await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id]);
ok(pcRow.subclass === 'Champion', 'PC subclass persists on the character row');
const section = ss.buildSubclassPromptSection(pcRow, [lifeComp, npcStatsComp]);
ok(section.includes('Champion'), 'prompt section names the PC subclass');
ok(section.includes('Improved Critical'), 'prompt section lists Improved Critical');
ok(section.includes('Blessed Healer'), 'prompt section lists the companion Life feature');
ok(section.includes('ALWAYS PREPARED'), 'prompt section distinguishes always-prepared from added-to-list');
ok(!section.includes('Brute'), 'npc_stats companion is skipped in the subclass section');
ok(section.includes('Never silently add'), 'prompt section carries the PC reported-total rule');
ok(typeof dp.formatSubclassPromptSection === 'function', 'dmPromptBuilder exports formatSubclassPromptSection');
ok(dp.formatSubclassPromptSection(pcRow, [lifeComp, npcStatsComp]) === section, 'dmPromptBuilder section delegates to the registry section');
const soloUnknown = ss.buildSubclassPromptSection({ class: 'Fighter', subclass: 'Unknown Subclass', level: 5 }, []);
ok(soloUnknown.includes('not yet in the subclass registry') && !soloUnknown.includes('Improved Critical'), 'PC with no registry subclass renders a not-yet line, no invented features');
const unknownSection = ss.buildSubclassPromptSection({ class: 'Fighter', subclass: 'Unknown Subclass', level: 5 }, [{ companion_class: 'Fighter', companion_subclass: 'Champion', companion_level: 3, progression_type: 'class_based', name: 'Ally' }]);
ok(unknownSection.includes('not yet in the subclass registry'), 'unknown PC subclass renders a not-yet-registered line, not invented features');
ok(unknownSection.includes('Ally'), 'class-based companion still renders alongside an unknown PC subclass');

console.log(`\nsubclass-tier0: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
