/**
 * tests/profession-archetype.test.js — Professions, mastery tiers, and build
 * archetypes (DM System, designed with Zach 2026-10-21).
 *
 * Pins:
 *   - migration 081 columns on npcs + companions;
 *   - catalog integrity: every profession skill is a canonical 5e skill,
 *     abilities/affinities valid, category fallbacks resolve;
 *   - archetype data integrity: every sheet-service class has builds,
 *     weights sum to 100, each template build EQUALS the sheet service's
 *     own generation (the two sources can never drift apart);
 *   - mastery + archetype rolls return valid values;
 *   - ensureNpcProfession: occupation → profession + mastery + GUP;
 *     adventuring stock also rolls an archetype; unresolvable occupations
 *     stay packet-less; idempotent (never re-rolls);
 *   - the resolver's profession branch: trade-covered checks use tier
 *     proficiency + dominant-ability bonus; uncovered checks and saves
 *     fall through to the old paths;
 *   - sheet generation FROM a stored archetype: an INT rogue is an INT
 *     rogue, at ensure time and in the resolver's numbers.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-prof-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const profData = await import(svc('server/data/professions.js'));
const archData = await import(svc('server/data/companionArchetypes.js'));
const profSvc = await import(svc('server/services/npcProfessionService.js'));
const sheets = await import(svc('server/services/companionSheetService.js'));
const rolls = await import(svc('server/services/rollRequestService.js'));
const companionPrompt = await import(svc('server/services/companionPrompt.js'));

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

// ---------------------------------------------------------------------------
group('1. Migration 081 — columns exist');
{
  const npcCols = (await dbAll('PRAGMA table_info(npcs)')).map(r => r.name);
  for (const c of ['profession_key', 'mastery_tier', 'archetype_key', 'gup_specific', 'gup_unique']) {
    assert(npcCols.includes(c), `npcs has ${c}`);
  }
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(r => r.name);
  assert(compCols.includes('archetype_key'), 'companions has archetype_key');
}

// ---------------------------------------------------------------------------
group('2. Catalog integrity');
{
  const skillNames = Object.keys(rolls.SKILL_ABILITY_MAP);
  const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
  assert(profData.PROFESSIONS.length >= 50, `catalog has ≥50 professions (got ${profData.PROFESSIONS.length})`);
  const keys = new Set();
  for (const p of profData.PROFESSIONS) {
    assert(!keys.has(p.key), `profession key unique: ${p.key}`);
    keys.add(p.key);
    assert(p.skills.length >= 1 && p.skills.length <= 4, `${p.key}: 1-4 skills`);
    for (const s of p.skills) assert(skillNames.includes(s), `${p.key}: skill '${s}' is canonical`);
    for (const a of p.abilities) assert(abilityKeys.includes(a), `${p.key}: ability '${a}' valid`);
    for (const cls of p.affinities) assert(archData.ARCHETYPES[cls], `${p.key}: affinity '${cls}' is a known class`);
    if (p.adventuring) assert(p.affinities.length > 0, `${p.key}: adventuring stock has an affinity`);
  }
  // Occupation resolution: exact, substring, category fallback, nothing.
  assert(profData.professionForOccupation('Blacksmith')?.key === 'blacksmith', 'exact occupation resolves');
  assert(profData.professionForOccupation('Master Blacksmith of the Guild')?.key === 'blacksmith', 'substring occupation resolves');
  assert(profData.professionForOccupation('hedge wizard')?.key === 'hedge wizard', 'multi-word occupation resolves');
  assert(profData.professionForOccupation('Zqxj Weaver', 'craftsman')?.key === 'category:craft', 'category fallback resolves');
  assert(profData.professionForOccupation('Zqxj Weaver', null) === null, 'unresolvable occupation → null');
  assert(profData.findProfessionByKey('category:craft')?.skills.includes('Athletics'), 'category key round-trips');
  assert(profData.findProfessionByKey('nope') === null, 'unknown key → null');
}

// ---------------------------------------------------------------------------
group('3. Competence math — pure');
{
  const map = rolls.SKILL_ABILITY_MAP;
  const smith = profData.findProfessionByKey('blacksmith');
  // master (prof 4), Athletics governed by str, a dominant ability → 4+2.
  assert(profData.professionCompetence(smith, 'master', 'skill', 'Athletics', map) === 6, 'master smith Athletics +6');
  // Perception is covered but governed by wis (not dominant) → 4+1.
  assert(profData.professionCompetence(smith, 'master', 'skill', 'Perception', map) === 5, 'master smith Perception +5');
  // Arcana not covered → null. Saves never covered → null.
  assert(profData.professionCompetence(smith, 'master', 'skill', 'Arcana', map) === null, 'uncovered skill → null');
  assert(profData.professionCompetence(smith, 'master', 'save', 'str', map) === null, 'saves never covered');
  // Raw ability check on a dominant ability → tier + 2.
  assert(profData.professionCompetence(smith, 'apprentice', 'ability', 'str', map) === 4, 'apprentice smith STR check +4');
  assert(profData.professionCompetence(smith, 'legend', 'ability', 'cha', map) === null, 'non-dominant ability → null');
  const tailor = profData.findProfessionByKey('tailor');
  assert(profData.professionCompetence(tailor, 'journeyman', 'skill', 'Sleight of Hand', map) === 5, 'journeyman tailor Sleight of Hand +5');
}

// ---------------------------------------------------------------------------
group('4. Archetype data integrity — templates can never drift from the sheet service');
{
  for (const [cls, builds] of Object.entries(archData.ARCHETYPES)) {
    const total = builds.reduce((s, b) => s + b.weight, 0);
    assert(total === 100, `${cls}: weights sum to 100 (got ${total})`);
    assert(builds[0].key === 'template' && builds[0].weight === 50, `${cls}: template first at weight 50`);
    const abilityKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const b of builds) {
      assert([...b.priorities].sort().join() === [...abilityKeys].sort().join(), `${cls}/${b.key}: priorities are a permutation of the six abilities`);
      assert(typeof b.guidance === 'string' && b.guidance.length > 20, `${cls}/${b.key}: personification guidance present`);
      for (const s of b.skills) assert(Object.keys(rolls.SKILL_ABILITY_MAP).includes(s), `${cls}/${b.key}: skill '${s}' canonical`);
    }
    // The drift pin: generating via the template archetype must equal
    // generating via the sheet service's own class tables.
    const viaArch = sheets.generateAbilityScores(cls, archData.templateArchetype(cls));
    const viaTables = sheets.generateAbilityScores(cls);
    assert(JSON.stringify(viaArch) === JSON.stringify(viaTables), `${cls}: template archetype == sheet-service generation`);
    const skillsArch = sheets.defaultSkillProficiencies(cls, archData.templateArchetype(cls));
    const skillsTables = sheets.defaultSkillProficiencies(cls);
    assert(JSON.stringify(skillsArch) === JSON.stringify(skillsTables), `${cls}: template skills == sheet-service defaults`);
  }
  // Zach's named builds exist.
  assert(archData.getArchetype('rogue', 'int')?.label === 'The Locksmith Scholar', 'INT rogue exists');
  assert(archData.getArchetype('wizard', 'str')?.label === 'The Laborer-Scholar', 'STR wizard exists');
  assert(archData.getArchetype('warlock', 'dex')?.label === 'The Shadowblade', 'DEX warlock exists');
  assert(archData.getArchetype('rogue', 'int').priorities[0] === 'int', 'INT rogue is INT-first');
  // Sheet generation through an off-build archetype.
  const intRogue = sheets.generateAbilityScores('Rogue', archData.getArchetype('rogue', 'int'));
  assert(intRogue.int === 15 && intRogue.dex === 14, 'INT rogue generation: INT 15, DEX 14');
  const strWizard = sheets.generateAbilityScores('Wizard', archData.getArchetype('wizard', 'str'));
  assert(strWizard.str === 15 && strWizard.int === 14, 'STR wizard generation: STR 15, INT 14');
}

// ---------------------------------------------------------------------------
group('5. Rolls return valid values');
{
  for (let i = 0; i < 40; i++) {
    assert(profData.MASTERY_TIERS.includes(profData.rollMasteryTier()), 'mastery roll in tier set');
    const k = archData.rollArchetypeKey('rogue');
    assert(archData.getArchetype('rogue', k) != null, 'archetype roll is a real rogue build');
  }
  assert(archData.rollArchetypeKey('Nonsense') === null, 'unknown class → null archetype');
}

// ---------------------------------------------------------------------------
group('6. ensureNpcProfession — the appearance packet');
let smithId, swordId, mysteryId;
{
  smithId = await insertRow('npcs', { name: 'Bram', occupation: 'Blacksmith' });
  const pkt = await profSvc.ensureNpcProfession(smithId);
  assert(pkt && pkt.professionKey === 'blacksmith', 'blacksmith occupation → blacksmith profession');
  assert(profData.MASTERY_TIERS.includes(pkt.masteryTier), 'mastery tier rolled');
  assert(typeof pkt.gupSpecific === 'string' && pkt.gupSpecific.length > 0, 'GUP specific rolled');
  assert(typeof pkt.gupUnique === 'string' && pkt.gupUnique.length > 0, 'GUP unique rolled');
  assert(pkt.archetypeKey === null, 'non-adventuring trade rolls NO archetype');

  const row = await dbGet('SELECT profession_key, mastery_tier FROM npcs WHERE id = ?', [smithId]);
  assert(row.profession_key === 'blacksmith' && row.mastery_tier === pkt.masteryTier, 'packet persisted');

  const again = await profSvc.ensureNpcProfession(smithId);
  assert(again.masteryTier === pkt.masteryTier && again.gupSpecific === pkt.gupSpecific, 'idempotent — never re-rolls');

  swordId = await insertRow('npcs', { name: 'Sera', occupation: 'Sellsword' });
  const sp = await profSvc.ensureNpcProfession(swordId);
  assert(sp && sp.professionKey === 'sellsword', 'sellsword occupation resolves');
  assert(sp.archetypeKey != null && archData.getArchetype('fighter', sp.archetypeKey) != null,
    'adventuring stock rolls a fighter archetype at first appearance');

  mysteryId = await insertRow('npcs', { name: 'Nameless', occupation: 'Zqxj Weaver' });
  const none = await profSvc.ensureNpcProfession(mysteryId);
  assert(none === null, 'unresolvable occupation → no packet');
  const mrow = await dbGet('SELECT profession_key FROM npcs WHERE id = ?', [mysteryId]);
  assert(mrow.profession_key === null, 'unresolvable NPC stays packet-less (CR path preserved)');
  assert((await profSvc.ensureNpcProfession(999999)) === null, 'missing NPC → null');
}

// ---------------------------------------------------------------------------
group('7. Prompt lines — profession and archetype personification');
{
  const line = profSvc.buildProfessionPromptLine({
    profession_key: 'blacksmith', mastery_tier: 'master',
    gup_unique: 'Never sits with their back to a door.', gup_specific: 'Hands stained dark at the fingertips, permanently.',
    archetype_key: null
  });
  assert(line && line.includes('master blacksmith'), 'profession line names tier + trade');
  assert(line.includes('Athletics'), 'profession line lists covered checks');
  assert(line.includes('Never sits with their back to a door.'), 'profession line carries the GUP aspect');
  assert(profSvc.buildProfessionPromptLine({ profession_key: null }) === null, 'no packet → no line');
  assert(profSvc.buildProfessionPromptLine({ profession_key: 'bogus' }) === null, 'unknown key → no line');

  const block = companionPrompt.buildCompanionPromptBlock({
    name: 'Lyra', class: 'Rogue', archetype_key: 'int', personal_goals: '[]',
    current_task: null, what_they_know: '[]', relationship_to_pc: null
  });
  assert(block.includes('The Locksmith Scholar'), 'companion block names the archetype build');
  assert(block.includes('research and mechanisms'), 'companion block carries the build personification');
  const templ = companionPrompt.buildCompanionPromptBlock({
    name: 'Pell', class: 'Fighter', personal_goals: '[]',
    current_task: null, what_they_know: '[]', relationship_to_pc: null
  });
  assert(templ.includes('Template Fighter'), 'keyless class-based companion plays the template build');
}

// ---------------------------------------------------------------------------
group('8. Resolver — profession competence in the real pipeline');
{
  const pcId = await insertRow('characters', {
    name: 'Profession Tester', class: 'Fighter', level: 5,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 11, cha: 8 }),
    skills: JSON.stringify(['Athletics'])
  });
  await insertRow('npcs', {
    name: 'Bram the Smith', profession_key: 'blacksmith', mastery_tier: 'master'
  });
  let mod = await rolls.getNpcCheckModifier('Bram the Smith', 'skill', 'Athletics', pcId);
  assert(mod.actorType === 'npc' && mod.modifier === 6, 'master smith Athletics: profession +6 (not CR +2)');
  mod = await rolls.getNpcCheckModifier('Bram the Smith', 'skill', 'Perception', pcId);
  assert(mod.modifier === 5, 'master smith Perception: covered, off-ability +5');
  mod = await rolls.getNpcCheckModifier('Bram the Smith', 'skill', 'Arcana', pcId);
  assert(mod.modifier === 2, 'uncovered check falls through to the CR path (+2)');
  mod = await rolls.getNpcCheckModifier('Bram the Smith', 'save', 'Strength', pcId);
  assert(mod.modifier === 2, 'saving throw falls through — trades grant no saves');

  await insertRow('npcs', {
    name: 'Tilda the Tailor', profession_key: 'tailor', mastery_tier: 'journeyman'
  });
  mod = await rolls.getNpcCheckModifier('Tilda the Tailor', 'skill', 'Sleight of Hand', pcId);
  assert(mod.modifier === 5, 'journeyman tailor Sleight of Hand +5');

  // Category-fallback NPCs roll from their category signature.
  await insertRow('npcs', {
    name: 'Odd Job', profession_key: 'category:craft', mastery_tier: 'apprentice'
  });
  mod = await rolls.getNpcCheckModifier('Odd Job', 'skill', 'Athletics', pcId);
  assert(mod.modifier === 4, 'category:craft apprentice Athletics: 2 + 2 = +4');
}

// ---------------------------------------------------------------------------
group('9. Sheets from archetypes — the person you met is the person who joins');
{
  const pcId = await insertRow('characters', {
    name: 'Recruiter', class: 'Fighter', level: 5,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 11, cha: 8 }),
    skills: JSON.stringify([])
  });
  const lyraNpcId = await insertRow('npcs', { name: 'Lyra' });
  const lyraId = await insertRow('companions', {
    npc_id: lyraNpcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'class_based', companion_class: 'Rogue', companion_level: 5,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    skill_proficiencies: '[]', archetype_key: 'int'
  });
  const gen = await sheets.ensureCompanionSheet(lyraId);
  assert(gen && gen.generated === true, 'flat companion with a stored archetype generates');
  assert(gen.archetypeKey === 'int', 'stored archetype is NOT re-rolled');
  assert(gen.abilityScores.int === 15 && gen.abilityScores.dex === 14, 'sheet generated FROM the INT-rogue archetype');
  assert(gen.skills.includes('Investigation') && gen.skills.includes('Arcana'), 'archetype skills on the sheet');
  const persisted = await dbGet('SELECT archetype_key FROM companions WHERE id = ?', [lyraId]);
  assert(persisted.archetype_key === 'int', 'archetype key persisted on the companion');

  // The resolver reads the generated sheet with the archetype's math:
  // INT rogue L5 — Investigation is her signature (INT +2 + prof 3 = +5),
  // while Stealth is deliberately untrained in this build (DEX +2 only).
  // The archetype's trade-offs are real mechanics, not flavor.
  const mod = await rolls.getNpcCheckModifier('Lyra', 'skill', 'Investigation', pcId);
  assert(mod.actorType === 'companion' && mod.modifier === 5, 'resolver: INT-rogue Lyra Investigation +5 from her real sheet');
  const untrained = await rolls.getNpcCheckModifier('Lyra', 'skill', 'Stealth', pcId);
  assert(untrained.actorType === 'companion' && untrained.modifier === 2, 'resolver: INT-rogue Lyra Stealth +2 — untrained in her build');

  // No stored archetype: generation rolls one and persists it, and the
  // sheet matches the rolled build exactly.
  const pellNpcId = await insertRow('npcs', { name: 'Pell' });
  const pellId = await insertRow('companions', {
    npc_id: pellNpcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'class_based', companion_class: 'Wizard', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
    skill_proficiencies: '[]'
  });
  const rolled = await sheets.ensureCompanionSheet(pellId);
  assert(rolled.generated === true && rolled.archetypeKey != null, 'keyless generation rolls an archetype');
  const expectScores = sheets.generateAbilityScores('Wizard', archData.getArchetype('wizard', rolled.archetypeKey));
  assert(JSON.stringify(rolled.abilityScores) === JSON.stringify(expectScores), 'generated sheet matches the rolled archetype');
  const again = await sheets.ensureCompanionSheet(pellId);
  assert(again.generated === false && again.archetypeKey === rolled.archetypeKey, 'second ensure: no re-roll, no regeneration');
}

// ---------------------------------------------------------------------------
console.log(`\n profession-archetype: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);

