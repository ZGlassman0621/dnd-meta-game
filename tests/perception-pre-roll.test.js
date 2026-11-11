/**
 * Perception pre-roll tests — banked Perception at the dungeon door.
 *
 * Covers the rules decided 2026-11-05 (design: perception-pre-roll-design.md):
 * the party banks one Perception number each at the dungeon door (PC rolls
 * real dice, companions server-rolled); the DM reads the stored number in
 * secret at a trap, a secret door, or a stealthed enemy; a used number is
 * replaced with a fresh silent roll; higher of the banked roll or passive
 * Perception counts; crits judge the stored die first (nat 1 fails even
 * when passive would pass, nat 20 succeeds even when the total would not).
 *
 * Random rolls assert invariants (die ranges, total accounting, outcome
 * consistency) — never exact random values. Judgement branches are
 * deterministic: the banked rows are seeded with chosen dice and the
 * exact outcome is asserted.
 *
 * Isolated throwaway DB (clock-unification pattern): temp dir becomes
 * CWD before database.js loads, and the runner's shared TURSO env is
 * deleted so database.js uses the local file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'perception-preroll-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const rolls = await import(fromRepo('server/services/rollRequestService.js'));
const pre = await import(fromRepo('server/services/perceptionPreRollService.js'));
const { processResponseMarkers } = await import(fromRepo('server/services/markerPipeline.js'));
const { validateDmMarkers } = await import(fromRepo('server/services/markerSchemas.js'));
const promptBuilder = await import(fromRepo('server/services/dmPromptBuilder.js'));

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

async function sessionConfig(sessionId) {
  return JSON.parse((await db.dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config || '{}');
}

async function bankRows(sessionId, dungeon) {
  return db.dbAll('SELECT * FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? ORDER BY id', [sessionId, dungeon]);
}

// ---------------------------------------------------------------------------
group('1. Migration 106 — perception_pre_rolls exists');
const cols = await db.dbAll('PRAGMA table_info(perception_pre_rolls)');
assert(cols.length > 0, 'perception_pre_rolls table exists after migrations');
for (const c of ['session_id', 'dungeon_key', 'actor_type', 'actor_name', 'banked_die', 'modifier']) {
  assert(cols.some(r => r.name === c), `perception_pre_rolls has column ${c}`);
}
const idx = await db.dbAll("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'perception_pre_rolls'");
assert(idx.some(r => r.name === 'idx_pre_rolls_session_dungeon_actor'), 'unique (session, dungeon, actor) index exists');

// ---------------------------------------------------------------------------
group('2. Fixtures — PC (Perception +4, passive 14), two companions');
const sheet = {
  ability_scores: JSON.stringify({ str: 10, dex: 18, con: 12, int: 14, wis: 13, cha: 8 }),
  skills: JSON.stringify(['Sleight of Hand', 'Stealth', 'Perception']),
  level: 5, class: 'Rogue'
};
const campaignId = await insertRow('campaigns', { name: 'Pre-roll Test Campaign' });
const charId = await insertRow('characters', {
  name: 'Roll Tester', class: 'Rogue', level: 5, campaign_id: campaignId,
  ability_scores: sheet.ability_scores, skills: sheet.skills,
  current_hit_points: 30, max_hit_points: 30, hit_points: 30
});
assert((await rolls.getPcCheckModifier(charId, 'skill', 'Perception'))?.modifier === 4,
  'PC Perception modifier is +4 (WIS +1 + prof +3)');
assert((await rolls.getPcPassive(charId, 'Perception')) === 14, 'PC passive Perception is 14');

const lyraNpc = await insertRow('npcs', { name: 'Lyra' });
await insertRow('companions', {
  recruited_by_character_id: charId, npc_id: lyraNpc, status: 'active',
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 10 }),
  skill_proficiencies: JSON.stringify(['Perception'])
});
const brakNpc = await insertRow('npcs', { name: 'Brak' });
await insertRow('companions', {
  recruited_by_character_id: charId, npc_id: brakNpc, status: 'active',
  progression_type: 'npc_stats',
  original_stats_snapshot: JSON.stringify({ cr: 2 })
});
assert((await rolls.getNpcCheckModifier('Lyra', 'skill', 'Perception', charId)).modifier === 5,
  'Lyra (class-based, WIS +3 + prof +2) Perception is +5');
assert((await rolls.getNpcCheckModifier('Brak', 'skill', 'Perception', charId)).modifier === 3,
  'Brak (npc_stats, CR 2) Perception is CR-scaled +3');

const sessionId = await insertRow('dm_sessions', { character_id: charId, status: 'active', session_config: '{}' });

// ---------------------------------------------------------------------------
group('3. Door — marker banks the party, PC pending, companions server-rolled');
const door = await processResponseMarkers(
  'You push open the heavy door. [PERCEPTION_PREROLL: Dungeon="Sunless Citadel"]',
  { characterId: charId, sessionId, narrative: '' }
);
const doorHit = door.handlerResults.find(h => h.schemaKey === 'PERCEPTION_PREROLL');
assert(doorHit && doorHit.ok && doorHit.result?.success === true, 'PREROLL marker → handler success');
assert(doorHit.result?.banked?.includes('Roll Tester') && doorHit.result?.banked?.includes('Lyra') && doorHit.result?.banked?.includes('Brak'),
  'door banks the PC (pending) + both companions');
const pending = await rolls.getPendingRoll(sessionId);
assert(pending && pending.bank === 'perception' && pending.dungeon === 'Sunless Citadel' &&
  pending.name === 'Perception' && pending.dc === undefined && pending.modifier === 4,
  'PC pending is a bank roll: no DC, modifier +4');
const compRows = await bankRows(sessionId, 'Sunless Citadel');
assert(compRows.length === 2, 'two companion bank rows stored');
const lyraRow = compRows.find(r => r.actor_name === 'Lyra');
const brakRow = compRows.find(r => r.actor_name === 'Brak');
assert(lyraRow && lyraRow.banked_die >= 1 && lyraRow.banked_die <= 20 && lyraRow.modifier === 5,
  'Lyra banked: one d20 in range, modifier +5');
assert(brakRow && brakRow.banked_die >= 1 && brakRow.banked_die <= 20 && brakRow.modifier === 3,
  'Brak banked: one d20 in range, modifier +3');
assert((await pre.getActiveDungeon(sessionId)) === 'Sunless Citadel', 'active dungeon recorded on session_config');
const cfgAfterDoor = await sessionConfig(sessionId);
assert(!cfgAfterDoor.recentRolls || cfgAfterDoor.recentRolls.length === 0,
  'companion bank dice are NOT stashed as ROLL RESULT facts (no leak)');
const doorLogs = await db.dbAll("SELECT * FROM roll_log WHERE session_id = ? AND outcome = 'banked'", [sessionId]);
assert(doorLogs.length === 2 && doorLogs.every(x => x.source === 'server'),
  'door banks logged to roll_log (server, outcome banked)');

// ---------------------------------------------------------------------------
group('4. PC door resolution — reported die becomes the banked number');
const banked = await pre.resolveBankRoll(sessionId, [14]);
assert(banked && banked.total === 18 && banked.passive === 14 && banked.perceptionBank === true,
  'reported 14 → banked total 18 (14+4), passive 14');
assert((await rolls.getPendingRoll(sessionId)) === null, 'pending cleared after banking');
const pcRow = (await bankRows(sessionId, 'Sunless Citadel')).find(r => r.actor_type === 'pc');
assert(pcRow && pcRow.banked_die === 14 && pcRow.modifier === 4 && pcRow.actor_name === 'Roll Tester',
  'PC bank row stored: die 14, modifier +4');
const pcLog = await db.dbAll("SELECT * FROM roll_log WHERE session_id = ? AND source = 'reported' AND outcome = 'banked'", [sessionId]);
assert(pcLog.length === 1 && pcLog[0].taken_die === 14 && pcLog[0].total === 18,
  'PC door roll logged (reported, banked, 14 → 18)');
assert((await pre.resolveBankRoll(sessionId, [10])) === null, 'resolving with nothing pending → null');
const bankBlock = pre.formatPerceptionBankBlock(banked);
assert(bankBlock.includes('Roll Tester') && bankBlock.includes('18') &&
  bankBlock.includes('Tell the player their banked number') &&
  bankBlock.includes('never mention when a banked number is read'),
  'bank fact tells the DM the number and the secrecy rule');

// Out-of-range door die: pending stays so the player can re-report.
await pre.requestBankRoll({ sessionId, characterId: charId, dungeon: 'Second Vault' });
assert((await pre.resolveBankRoll(sessionId, [25])) === null, 'door die 25 → null');
assert((await rolls.getPendingRoll(sessionId))?.bank === 'perception', 'pending survives a bad die');
const banked2 = await pre.resolveBankRoll(sessionId, [10]);
assert(banked2 && banked2.total === 14 && banked2.dungeon === 'Second Vault', 're-reported 10 banks (10+4=14)');

// ---------------------------------------------------------------------------
group('5. Use — seeded rows, every judgement branch');
// Point the active dungeon at the seeded vault (direct session_config
// write — test setup, not the service: the service only switches the
// active dungeon through bankAtDoor).
await db.dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?',
  [JSON.stringify({ activePerceptionDungeon: 'Test Vault' }), sessionId]);
async function seedBank(dungeon, actorType, actorName, die, modifier) {
  // Delete-then-insert: a previous case's replacement row may exist.
  await db.dbRun(
    `DELETE FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? AND actor_type = ? AND actor_name = ?`,
    [sessionId, dungeon, actorType, actorName]
  );
  await db.dbRun(
    `INSERT INTO perception_pre_rolls (session_id, dungeon_key, actor_type, actor_name, banked_die, modifier)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, dungeon, actorType, actorName, die, modifier]
  );
}
async function useViaMarker(target, trigger, dc) {
  const res = await processResponseMarkers(
    `[PERCEPTION_USE: Target="${target}" Trigger="${trigger}" DC=${dc}]`,
    { characterId: charId, sessionId, narrative: '' }
  );
  const hit = res.handlerResults.find(h => h.schemaKey === 'PERCEPTION_USE');
  assert(hit && hit.ok, `USE marker dispatches (${target}/${trigger}/DC${dc})`);
  return hit?.result;
}
// A: banked wins (16 ≥ DC 16; passive 14 would fail).
await seedBank('Test Vault', 'pc', 'Roll Tester', 12, 4);
let u = await useViaMarker('Roll Tester', 'trap', 16);
assert(u?.success === true && u.outcome === 'success' && u.viaPassive === false && u.effective === 16,
  'banked 12+4=16 vs DC 16: success on the banked roll (passive 14 would fail)');
// B: passive wins (banked 12 < DC 14; passive 14 meets it).
await seedBank('Test Vault', 'pc', 'Roll Tester', 8, 4);
u = await useViaMarker('Roll Tester', 'secret_door', 14);
assert(u?.success === true && u.outcome === 'success' && u.viaPassive === true && u.effective === 14,
  'banked 8+4=12 vs DC 14: success via passive 14');
// C: both fail.
await seedBank('Test Vault', 'pc', 'Roll Tester', 8, 4);
u = await useViaMarker('Roll Tester', 'trap', 18);
assert(u?.success === true && u.outcome === 'failure' && u.effective === 12,
  'banked 12 vs DC 18, passive 14: failure, effective 12');
// D: nat 20 always succeeds, even vs DC 30.
await seedBank('Test Vault', 'pc', 'Roll Tester', 20, 0);
u = await useViaMarker('Roll Tester', 'stealthed_enemy', 30);
assert(u?.success === true && u.outcome === 'critical_success',
  'stored nat 20 vs DC 30: critical_success');
// E: nat 1 fails even when passive would pass (crit judges the die first).
await seedBank('Test Vault', 'pc', 'Roll Tester', 1, 4);
u = await useViaMarker('Roll Tester', 'trap', 13);
assert(u?.success === true && u.outcome === 'critical_failure',
  'stored nat 1 vs DC 13 with passive 14: critical_failure, passive does not save it');

// Replacement: after each use the old number is gone and a fresh one is banked.
const afterRows = (await bankRows(sessionId, 'Test Vault')).filter(r => r.actor_type === 'pc');
assert(afterRows.length === 1, 'one PC row remains for the dungeon after the uses');
assert(afterRows[0].banked_die >= 1 && afterRows[0].banked_die <= 20 && afterRows[0].modifier === 4,
  'replacement banked: fresh d20 in range, same modifier +4');
const useLogs = await db.dbAll("SELECT * FROM roll_log WHERE session_id = ? AND source = 'banked' AND check_name = 'Perception' AND dc IS NOT NULL ORDER BY id", [sessionId]);
assert(useLogs.length === 5 && useLogs.map(x => x.outcome).join(',') === 'success,success,failure,critical_success,critical_failure',
  'all five uses logged with the judged outcomes');
const useFact = ((await sessionConfig(sessionId)).recentRolls || []).filter(r => r.perceptionUse).pop();
assert(useFact && useFact.outcome === 'critical_failure', 'latest USE stashed on recentRolls for next-turn injection');
const useBlock = pre.formatPerceptionUseBlock(useFact);
assert(useBlock.includes('CRITICAL FAILURE') && useBlock.includes('do NOT mention the new number') &&
  useBlock.includes('never say a banked number was read'),
  'use fact demands a consequence and forbids mentioning the replacement');

// Companion use (secret door, banked wins) + replacement keeps the modifier.
await seedBank('Test Vault', 'companion', 'Lyra', 10, 5);
u = await useViaMarker('Lyra', 'secret_door', 15);
assert(u?.success === true && u.outcome === 'success' && u.bankedTotal === 15 && u.actorType === 'companion',
  'Lyra banked 10+5=15 vs DC 15: success');
const lyraAfter = (await bankRows(sessionId, 'Test Vault')).find(r => r.actor_name === 'Lyra');
assert(lyraAfter && lyraAfter.banked_die >= 1 && lyraAfter.banked_die <= 20 && lyraAfter.modifier === 5,
  'Lyra replacement banked with the same modifier +5');

// ---------------------------------------------------------------------------
group('6. Use failures — clean, no consumption');
const noTarget = await useViaMarker('Nobody Here', 'trap', 13);
assert(noTarget?.success === false, 'USE for a non-party target fails cleanly');
const badTrigger = await pre.useBankedPerception({ sessionId, characterId: charId, target: 'Lyra', trigger: 'pit', dc: 13 });
assert(badTrigger?.success === false, 'USE with a trigger outside the enum fails cleanly');
const noBankSession = await insertRow('dm_sessions', { character_id: charId, status: 'active', session_config: '{}' });
const noDungeon = await pre.useBankedPerception({ sessionId: noBankSession, characterId: charId, target: 'Roll Tester', trigger: 'trap', dc: 13 });
assert(noDungeon?.success === false, 'USE with no dungeon banked fails cleanly');
const noRow = await pre.useBankedPerception({ sessionId, characterId: charId, target: 'Brak', trigger: 'trap', dc: 13 });
assert(noRow?.success === false && noRow.reason.includes('ROLL_REQUEST'),
  'USE for an actor with no banked number fails and points at a normal roll');
const rowsBefore = (await bankRows(sessionId, 'Test Vault')).length;
await pre.useBankedPerception({ sessionId, characterId: charId, target: 'Brak', trigger: 'trap', dc: 13 });
assert((await bankRows(sessionId, 'Test Vault')).length === rowsBefore, 'failed USE consumes nothing');

// ---------------------------------------------------------------------------
group('7. Bank block — lists who is covered, never the numbers');
// Sunless Citadel still holds PC 14, Lyra ?, Brak ? — re-bank to known dice.
await pre.bankAtDoor({ sessionId, characterId: charId, dungeon: 'Known Vault' });
// Force known dice via direct re-bank rows for the secrecy assert.
for (const [name, type, die] of [['Roll Tester', 'pc', 17], ['Lyra', 'companion', 12], ['Brak', 'companion', 19]]) {
  await db.dbRun('DELETE FROM perception_pre_rolls WHERE session_id = ? AND dungeon_key = ? AND actor_name = ?',
    [sessionId, 'Known Vault', name]);
  await db.dbRun(`INSERT INTO perception_pre_rolls (session_id, dungeon_key, actor_type, actor_name, banked_die, modifier)
     VALUES (?, ?, ?, ?, ?, ?)`, [sessionId, 'Known Vault', type, name, die, 4]);
}
const activeBlock = await pre.formatActiveBankBlock(sessionId);
assert(activeBlock.includes('Known Vault') && activeBlock.includes('Roll Tester') &&
  activeBlock.includes('Lyra') && activeBlock.includes('Brak'),
  'bank block names the dungeon and every covered actor');
assert(!activeBlock.includes('17') && !activeBlock.includes('12') && !activeBlock.includes('19'),
  'bank block contains NONE of the banked dice (17/12/19 absent)');
assert(activeBlock.includes('never state or hint at one'), 'bank block states the secrecy rule');
assert((await pre.formatActiveBankBlock(noBankSession)) === '', 'no active dungeon → empty block');

// ---------------------------------------------------------------------------
group('8. Re-bank idempotence — same dungeon keeps its numbers');
const beforeDice = Object.fromEntries((await bankRows(sessionId, 'Sunless Citadel')).map(r => [r.actor_name, r.banked_die]));
const rebank = await processResponseMarkers(
  '[PERCEPTION_PREROLL: Dungeon="Sunless Citadel"]',
  { characterId: charId, sessionId, narrative: '' }
);
const reHit = rebank.handlerResults.find(h => h.schemaKey === 'PERCEPTION_PREROLL');
assert(reHit?.result?.alreadyBanked === true, 're-banking the same dungeon reports alreadyBanked');
const afterDice = Object.fromEntries((await bankRows(sessionId, 'Sunless Citadel')).map(r => [r.actor_name, r.banked_die]));
assert(JSON.stringify(beforeDice) === JSON.stringify(afterDice), 're-bank changes no stored die');
assert((await pre.getActiveDungeon(sessionId)) === 'Sunless Citadel', 're-bank re-activates its dungeon');

// ---------------------------------------------------------------------------
group('9. Schemas — validation + correction-loop feedback');
const goodPreroll = validateDmMarkers('[PERCEPTION_PREROLL: Dungeon="Sunless Citadel"]');
assert(goodPreroll.failures.length === 0 && goodPreroll.validByKey.PERCEPTION_PREROLL?.length === 1,
  'well-formed PREROLL validates');
const goodUse = validateDmMarkers('[PERCEPTION_USE: Target="Lyra" Trigger="trap" DC=13]');
assert(goodUse.failures.length === 0 && goodUse.validByKey.PERCEPTION_USE?.length === 1,
  'well-formed USE validates');
const badTriggerMark = validateDmMarkers('[PERCEPTION_USE: Target="Lyra" Trigger="pit" DC=13]');
assert(badTriggerMark.failures.length === 1 && badTriggerMark.failures[0].schemaKey === 'PERCEPTION_USE',
  'Trigger outside the enum fails validation (correction loop catches it)');
const noDungeonMark = validateDmMarkers('[PERCEPTION_PREROLL]');
assert(noDungeonMark.failures.length === 1 && noDungeonMark.failures[0].schemaKey === 'PERCEPTION_PREROLL',
  'PREROLL without Dungeon fails validation');
const noDcMark = validateDmMarkers('[PERCEPTION_USE: Target="Lyra" Trigger="trap"]');
assert(noDcMark.failures.length === 1 && noDcMark.failures[0].schemaKey === 'PERCEPTION_USE',
  'USE without DC fails validation');

// ---------------------------------------------------------------------------
group('10. DM prompt — the pre-roll rule is in the system prompt');
const characterRow = await db.dbGet('SELECT * FROM characters WHERE id = ?', [charId]);
const prompt = promptBuilder.createDMSystemPrompt(characterRow, {
  startingLocation: { name: 'Test Town', description: 'A test town.' },
  era: null, arrivalHook: null, customConcepts: null, campaignLength: null,
  customNpcs: null, nicknameResolutions: null, companions: [], awayCompanions: [],
  previousSessionSummaries: [], campaignNotes: null, characterMemories: '',
  usedNames: [], availableNames: [], storyThreadsContext: null,
  narrativeQueueContext: null, narrativeQueueItemIds: [], worldState: null,
  campaignPlanSummary: null, chronicleContext: null, chronicleSummaries: [],
  campaignRollup: null, weatherContext: null, survivalContext: null,
  craftingContext: null, mythicContext: null, pietyContext: null,
  partyBaseContext: null, notorietyContext: null, projectsContext: null,
  progression: null
});
assert(typeof prompt === 'string' && prompt.length > 1000, 'system prompt builds');
assert(prompt.includes('PERCEPTION PRE-ROLL'), 'prompt carries the pre-roll rule block');
assert(prompt.includes('[PERCEPTION_PREROLL:') && prompt.includes('[PERCEPTION_USE:'),
  'prompt shows both markers with syntax');
assert(prompt.includes('secret door') && prompt.includes('stealthed enemy'),
  'prompt names the secret-door and stealthed-enemy triggers');
assert(prompt.includes('never state or hint at one') || prompt.includes('NEVER state or hint at any banked number'),
  'prompt states the secrecy rule');
assert(prompt.includes('DC 15') && prompt.includes('secret door is DC 15'),
  'prompt states the secret-door DC 15 rule');

// ---------------------------------------------------------------------------
console.log(`\n perception-pre-roll: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
