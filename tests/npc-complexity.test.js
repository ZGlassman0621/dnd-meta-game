/**
 * NPC Complexity Service (DM System, Part 1) — anti-shelter layer.
 *
 * The SYSTEM rolls for NPC complexity (20% significant / 60% minor /
 * 20% surface); the AI never decides whether an NPC has a secret. These
 * tests exercise the real service against a real DB.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js';
import {
  rollComplexityTier,
  generateHiddenAgenda,
  parseAgendaJson,
  ensureComplexityTier,
  rollCompanionAgenda,
  getInsightTell,
  updateDisposition,
  getDisposition,
  checkSurfacingVerifier,
  onNpcDeath,
  buildAgendaPromptBlock,
  INSIGHT_DC
} from '../server/services/npcComplexityService.js';
import { clearRollLog } from '../server/utils/rng.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${message}`);
  } else {
    failed++;
    console.log(`  ✗ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`);
}

let CAMPAIGN_ID = null;
let CHARACTER_ID = null;

async function seed() {
  const campaign = await dbRun(
    'INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)',
    ['TEST_NPC Campaign', 'Forgotten Realms', 'active']
  );
  CAMPAIGN_ID = Number(campaign.lastInsertRowid);

  const character = await dbRun(
    `INSERT INTO characters
       (name, class, race, level, current_hp, max_hp, current_location,
        experience_to_next_level, campaign_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ['TEST_NPC Hero', 'Fighter', 'Human', 3, 30, 30, 'TEST_Keep', 900, CAMPAIGN_ID]
  );
  CHARACTER_ID = Number(character.lastInsertRowid);
}

async function makeNpc(name) {
  const r = await dbRun(
    'INSERT INTO npcs (name, race, occupation) VALUES (?, ?, ?)',
    [name, 'Human', 'Guard']
  );
  return Number(r.lastInsertRowid);
}

async function setNpcCols(id, cols) {
  const keys = Object.keys(cols);
  const setClause = keys.map(k => `${k} = ?`).join(', ');
  await dbRun(`UPDATE npcs SET ${setClause} WHERE id = ?`, [...keys.map(k => cols[k]), id]);
}

async function getNpc(id) {
  return dbGet('SELECT * FROM npcs WHERE id = ?', [id]);
}

const MOCK_AGENDA_JSON = JSON.stringify({
  type: 'debt',
  description: 'Owes money to the thieves guild and passes them gate schedules.',
  stakes: 'Exposure means prison; the guild silences loose ends.',
  who_else_knows: ['guild boss'],
  tells: ['avoids eye contact when night traffic is mentioned', 'thumb traces spear-haft when nervous']
});

async function mockLlm(prompt) {
  assert(typeof prompt === 'string' && prompt.length > 50, 'llmCall receives a substantive prompt');
  return MOCK_AGENDA_JSON;
}

async function cleanup() {
  await dbRun("DELETE FROM companions WHERE npc_id IN (SELECT id FROM npcs WHERE name LIKE 'TEST_NPC%')");
  await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_NPC%'");
  if (CAMPAIGN_ID !== null) {
    await dbRun('DELETE FROM characters WHERE campaign_id = ?', [CAMPAIGN_ID]);
    await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMPAIGN_ID]);
  }
}

async function run() {
  await initDatabase();
  await seed();
  clearRollLog();

  // ============================================================
  console.log('\n=== Test 1: tier distribution is roughly 20/60/20 ===\n');
  // ============================================================

  const counts = { significant: 0, minor: 0, surface: 0 };
  for (let i = 0; i < 300; i++) {
    counts[rollComplexityTier()]++;
  }
  console.log(`  distribution: ${JSON.stringify(counts)}`);
  assert(counts.significant >= 30 && counts.significant <= 90,
    `significant ~20% of 300 (got ${counts.significant})`);
  assert(counts.minor >= 120 && counts.minor <= 240,
    `minor ~60% of 300 (got ${counts.minor})`);
  assert(counts.surface >= 30 && counts.surface <= 90,
    `surface ~20% of 300 (got ${counts.surface})`);
  assert(counts.significant + counts.minor + counts.surface === 300, 'all rolls produce a valid tier');

  // ============================================================
  console.log('\n=== Test 2: backfill on appearance (NULL tier → rolled, permanent) ===\n');
  // ============================================================

  const npcId = await makeNpc('TEST_NPC Vane');
  let npc = await getNpc(npcId);
  assertEqual(npc.complexity_tier, null, 'pre-system NPC has NULL tier');

  const tier = await ensureComplexityTier(npcId);
  assert(['significant', 'minor', 'surface'].includes(tier), `rolled tier is valid (got ${tier})`);
  npc = await getNpc(npcId);
  assertEqual(npc.complexity_tier, tier, 'tier persisted to the row');
  assertEqual(npc.agenda_status, 'hidden', 'agenda_status starts hidden');

  const tier2 = await ensureComplexityTier(npcId);
  assertEqual(tier2, tier, 'second call returns the SAME tier (no re-roll)');
  assertEqual(await ensureComplexityTier(99999999), null, 'unknown NPC returns null');

  // ============================================================
  console.log('\n=== Test 3: companion agenda roll at recruitment ===\n');
  // ============================================================

  const compNpcId = await makeNpc('TEST_NPC Lyra');
  const comp = await dbRun(
    'INSERT INTO companions (npc_id, recruited_by_character_id, companion_class, status) VALUES (?, ?, ?, ?)',
    [compNpcId, CHARACTER_ID, 'Ranger', 'active']
  );
  const compId = Number(comp.lastInsertRowid);

  // Force a significant tier so agenda generation is deterministic
  await setNpcCols(compNpcId, { complexity_tier: 'significant', agenda_status: 'hidden', hidden_agenda: null });
  const result = await rollCompanionAgenda(compId, mockLlm);
  assertEqual(result.tier, 'significant', 'companion tier matches the NPC row');
  assert(result.agenda && result.agenda.description.includes('thieves guild'),
    'companion agenda content generated via llmCall');
  const compNpc = await getNpc(compNpcId);
  assert(compNpc.hidden_agenda && compNpc.hidden_agenda.includes('thieves guild'),
    'companion agenda persisted to npcs.hidden_agenda');
  assertEqual(await rollCompanionAgenda(99999999), null, 'unknown companion returns null');

  // ============================================================
  console.log('\n=== Test 4: surface tier needs no LLM ===\n');
  // ============================================================

  const surfaceAgenda = await generateHiddenAgenda('surface', { name: 'Dunna' }, null);
  assertEqual(surfaceAgenda.type, 'none', 'surface tier returns explicit none type');
  assertEqual(surfaceAgenda.description, 'none', 'surface tier writes "none", not blank');

  const minorAgenda = await generateHiddenAgenda('minor', { name: 'TEST_NPC', occupation: 'Guard' }, mockLlm);
  assertEqual(minorAgenda.type, 'debt', 'minor tier agenda parsed from LLM JSON');
  assert(Array.isArray(minorAgenda.tells) && minorAgenda.tells.length === 2, 'tells array carried through');
  assertEqual(minorAgenda.tells_shown, 0, 'tells_shown starts at 0');

  let threw = false;
  try { await generateHiddenAgenda('significant', {}, null); } catch { threw = true; }
  assert(threw, 'non-surface tier without llmCall throws (no silent fallback)');

  // ============================================================
  console.log('\n=== Test 5: parseAgendaJson is defensive ===\n');
  // ============================================================

  assert(parseAgendaJson('```json\n' + MOCK_AGENDA_JSON + '\n```').description.includes('thieves guild'),
    'code-fenced JSON parses');
  assertEqual(parseAgendaJson('not json at all'), null, 'garbage returns null');
  assertEqual(parseAgendaJson('{"type":"x"}'), null, 'JSON without description returns null');
  assertEqual(parseAgendaJson(null), null, 'null input returns null');

  // ============================================================
  console.log('\n=== Test 6: insight tell flow (tell, never the secret) ===\n');
  // ============================================================

  const eyeId = await makeNpc('TEST_NPC Eye');
  await setNpcCols(eyeId, {
    complexity_tier: 'significant',
    agenda_status: 'hidden',
    hidden_agenda: JSON.stringify({
      type: 'spy', description: 'SECRET-DESCRIPTION-MUST-NOT-LEAK', stakes: 'high',
      who_else_knows: [], tells: ['tell one', 'tell two'], tells_shown: 0
    })
  });

  let tell = await getInsightTell(eyeId, 5);
  assertEqual(tell.success, false, 'roll below DC 15 fails');
  assertEqual(tell.dc, INSIGHT_DC.significant, 'significant DC is 15');
  assertEqual((await getNpc(eyeId)).agenda_status, 'hidden', 'failed check leaves status hidden');

  tell = await getInsightTell(eyeId, 15);
  assertEqual(tell.success, true, 'roll meeting DC 15 succeeds');
  assertEqual(tell.tell, 'tell one', 'first success returns first tell');
  assert(!String(tell.tell).includes('SECRET-DESCRIPTION'), 'tell does not leak the secret');
  assertEqual((await getNpc(eyeId)).agenda_status, 'hinted', 'success moves hidden → hinted');

  tell = await getInsightTell(eyeId, 20);
  assertEqual(tell.tell, 'tell two', 'second success returns second tell');

  tell = await getInsightTell(eyeId, 20);
  assertEqual(tell.tell, null, 'exhausted tells return null');
  assertEqual(tell.note, 'no_new_tells', 'exhaustion is reported');

  const surfId = await makeNpc('TEST_NPC Plain');
  await setNpcCols(surfId, { complexity_tier: 'surface', agenda_status: 'hidden' });
  tell = await getInsightTell(surfId, 20);
  assertEqual(tell.note, 'nothing_to_find', 'surface NPC: honest nothing-to-find, no roll needed');

  const minorId = await makeNpc('TEST_NPC Minor');
  await setNpcCols(minorId, {
    complexity_tier: 'minor', agenda_status: 'hidden',
    hidden_agenda: JSON.stringify({ type: 'bias', description: 'd', stakes: null, who_else_knows: [], tells: ['t'], tells_shown: 0 })
  });
  tell = await getInsightTell(minorId, 12);
  assertEqual(tell.success, true, 'minor DC is 12');
  assertEqual(tell.dc, INSIGHT_DC.minor, 'minor DC constant matches');

  // ============================================================
  console.log('\n=== Test 7: disposition is per-character and clamped ===\n');
  // ============================================================

  const dispId = await makeNpc('TEST_NPC Disp');
  assertEqual(await getDisposition(dispId, CHARACTER_ID), 0, 'disposition starts at 0');
  assertEqual(await updateDisposition(dispId, CHARACTER_ID, 25), 25, 'positive shift applies');
  assertEqual(await updateDisposition(dispId, CHARACTER_ID, 200), 100, 'clamped at +100');
  assertEqual(await updateDisposition(dispId, CHARACTER_ID, -300), -100, 'clamped at -100');
  assertEqual(await getDisposition(dispId, CHARACTER_ID), -100, 'clamped value persists');
  assertEqual(await getDisposition(dispId, 99999999), 0, 'other characters unaffected');
  const dispRow = await getNpc(dispId);
  assert(dispRow.disposition_json.includes(String(CHARACTER_ID)), 'disposition stored as JSON keyed by character');

  // ============================================================
  console.log('\n=== Test 8: anti-shelter surfacing verifier ===\n');
  // ============================================================

  const verId = await makeNpc('TEST_NPC Ver');
  await setNpcCols(verId, { complexity_tier: 'significant', agenda_status: 'hidden', interaction_count: 4, verifier_nudge_count: 0 });
  let ver = await checkSurfacingVerifier(verId);
  assertEqual(ver.nudge, false, 'no nudge before 5 interactions');

  await setNpcCols(verId, { interaction_count: 6 });
  ver = await checkSurfacingVerifier(verId);
  assertEqual(ver.nudge, true, 'nudge fires at 6 interactions for hidden significant NPC');

  ver = await checkSurfacingVerifier(verId);
  assertEqual(ver.nudge, false, 'no repeat nudge within 3 interactions');

  await setNpcCols(verId, { interaction_count: 9 });
  ver = await checkSurfacingVerifier(verId);
  assertEqual(ver.nudge, true, 'nudge fires again after 3 more interactions');

  await setNpcCols(verId, { agenda_status: 'hinted', interaction_count: 20 });
  ver = await checkSurfacingVerifier(verId);
  assertEqual(ver.nudge, false, 'no nudge once agenda is hinted');

  const verMinor = await makeNpc('TEST_NPC VerMinor');
  await setNpcCols(verMinor, { complexity_tier: 'minor', agenda_status: 'hidden', interaction_count: 50 });
  ver = await checkSurfacingVerifier(verMinor);
  assertEqual(ver.nudge, false, 'minor tier never triggers the verifier');

  // ============================================================
  console.log('\n=== Test 9: killed NPC — secret surfaces through consequences ===\n');
  // ============================================================

  const deadId = await makeNpc('TEST_NPC Dead');
  await setNpcCols(deadId, {
    complexity_tier: 'significant', agenda_status: 'hinted',
    hidden_agenda: JSON.stringify({
      type: 'smuggler', description: 'd', stakes: 's',
      who_else_knows: ['east gate sergeant'], tells: [], tells_shown: 0
    })
  });
  const deathResult = await onNpcDeath(deadId);
  assert(deathResult && deathResult.who_else_knows.includes('east gate sergeant'),
    'death returns agenda incl. who_else_knows for consequence injection');
  assertEqual((await getNpc(deadId)).agenda_status, 'resolved', 'death marks agenda resolved');

  const deadPlain = await makeNpc('TEST_NPC DeadPlain');
  await setNpcCols(deadPlain, { complexity_tier: 'surface', agenda_status: 'hidden' });
  assertEqual(await onNpcDeath(deadPlain), null, 'surface NPC death returns null (nothing to surface)');
  assertEqual(await onNpcDeath(99999999), null, 'unknown NPC death returns null');

  // ============================================================
  console.log('\n=== Test 10: prompt block rendering ===\n');
  // ============================================================

  const block = buildAgendaPromptBlock({
    complexity_tier: 'significant',
    agenda_status: 'hidden',
    hidden_agenda: JSON.stringify({ type: 'spy', description: 'Secret agent for the Red Hand.', stakes: 'war', who_else_knows: [], tells: [] }),
    what_they_want_from_pc: 'To be left alone.',
    disposition_json: JSON.stringify({ [CHARACTER_ID]: -30 })
  }, CHARACTER_ID);
  assert(block.includes('DM-ONLY'), 'block is marked DM-ONLY');
  assert(block.includes('HIDDEN AGENDA'), 'block names the hidden agenda');
  assert(block.includes('Secret agent for the Red Hand.'), 'block carries the agenda description');
  assert(block.includes('NEVER reveal the hidden agenda directly'), 'block carries the non-reveal rule');
  assert(block.includes('Disposition toward this character: -30'), 'per-character disposition renders');
  assert(!block.includes('complexity_tier'), 'raw column name never leaks into prompt');

  assertEqual(buildAgendaPromptBlock({ complexity_tier: 'surface', hidden_agenda: 'x' }), null,
    'surface tier renders nothing');
  assertEqual(buildAgendaPromptBlock({ complexity_tier: null }), null, 'untiered NPC renders nothing');
  assertEqual(buildAgendaPromptBlock({
    complexity_tier: 'significant',
    hidden_agenda: JSON.stringify({ type: 'none', description: 'none', tells: [] })
  }), null, 'empty agenda renders nothing');

  const noDispBlock = buildAgendaPromptBlock({
    complexity_tier: 'minor',
    hidden_agenda: JSON.stringify({ type: 'bias', description: 'Dislikes elves.', tells: [] })
  });
  assert(noDispBlock && !noDispBlock.includes('Disposition'),
    'no disposition line when characterId not passed');

  await cleanup();

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

await run();
