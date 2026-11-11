/**
 * Roll Request tests — non-combat check mechanics for every actor.
 *
 * Covers the rules decided 2026-10-20 (design: roll-request-design.md):
 * the player reports real dice; the system applies the true sheet modifier
 * and judges against a hidden DC; nat 1 NEVER succeeds, nat 20 always
 * does, crits judging the TAKEN die under advantage/disadvantage;
 * companions/NPCs/enemies roll server-side; passives are a silent floor;
 * every resolution lands in roll_log.
 *
 * Pure rule functions are asserted exactly; server rolls assert
 * invariants (dice ranges, total accounting, outcome consistency with
 * resolveDice on the logged dice) — never exact random values.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'rollreq-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const rolls = await import(fromRepo('server/services/rollRequestService.js'));
const { processResponseMarkers } = await import(fromRepo('server/services/markerPipeline.js'));

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
group('1. Migration 080 — roll_log exists');
const rlCols = await db.dbAll('PRAGMA table_info(roll_log)');
assert(rlCols.length > 0, 'roll_log table exists after migrations');
for (const c of ['actor_type', 'check_kind', 'check_name', 'dc', 'modifier', 'dice_json', 'taken_die', 'total', 'outcome', 'source']) {
  assert(rlCols.some(r => r.name === c), `roll_log has column ${c}`);
}

// ---------------------------------------------------------------------------
group('2. Pure resolution — totals, crits, taken die');
const R = rolls.resolveDice;
let r = R({ dice: [12], modifier: 5, dc: 15 });
assert(r.total === 17 && r.outcome === 'success' && r.takenDie === 12, 'plain success: 12+5=17 ≥ 15');
r = R({ dice: [8], modifier: 5, dc: 15 });
assert(r.total === 13 && r.outcome === 'failure', 'plain failure: 8+5=13 < 15');
r = R({ dice: [1], modifier: 12, dc: 5 });
assert(r.outcome === 'critical_failure' && r.total === 13, 'nat 1 NEVER succeeds — +12 vs DC 5 still critical_failure');
r = R({ dice: [20], modifier: 0, dc: 30 });
assert(r.outcome === 'critical_success' && r.total === 20, 'nat 20 always succeeds — +0 vs DC 30 still critical_success');
r = R({ dice: [3, 17], modifier: 0, dc: 15, advantage: 'advantage' });
assert(r.takenDie === 17 && r.outcome === 'success', 'advantage takes the higher die');
r = R({ dice: [3, 17], modifier: 0, dc: 15, advantage: 'disadvantage' });
assert(r.takenDie === 3 && r.outcome === 'failure', 'disadvantage takes the lower die');
r = R({ dice: [1, 14], modifier: 5, dc: 15, advantage: 'advantage' });
assert(r.takenDie === 14 && r.outcome === 'success', 'advantage [1,14]: taken die is 14 — NOT a critical failure');
r = R({ dice: [1, 14], modifier: 5, dc: 15, advantage: 'disadvantage' });
assert(r.takenDie === 1 && r.outcome === 'critical_failure', 'disadvantage [1,14]: taken die is 1 — critical failure');
r = R({ dice: [20, 2], modifier: 0, dc: 25, advantage: 'advantage' });
assert(r.takenDie === 20 && r.outcome === 'critical_success', 'advantage [20,2]: taken 20 — critical success');

// ---------------------------------------------------------------------------
group('3. Sheet math — modifiers from the real character');
assert(rolls.proficiencyBonus(1) === 2 && rolls.proficiencyBonus(5) === 3 &&
       rolls.proficiencyBonus(9) === 4 && rolls.proficiencyBonus(20) === 6,
       'proficiency bonus by level: 1→2, 5→3, 9→4, 20→6');
const sheet = {
  ability_scores: JSON.stringify({ str: 10, dex: 18, con: 12, int: 14, wis: 13, cha: 8 }),
  skills: JSON.stringify(['Sleight of Hand', 'Stealth', 'Perception']),
  level: 5, class: 'Rogue'
};
let m = rolls.computePcModifier(sheet, 'skill', 'Sleight of Hand');
assert(m && m.modifier === 7 && m.proficient === true, 'Sleight of Hand: DEX +4 + prof 3 = +7');
m = rolls.computePcModifier(sheet, 'skill', 'athletics');
assert(m && m.modifier === 0 && m.proficient === false, 'Athletics (untrained, case-insensitive): STR +0');
m = rolls.computePcModifier(sheet, 'save', 'Dexterity');
assert(m && m.modifier === 7 && m.proficient === true, 'DEX save (rogue class save): +4 + 3 = +7');
m = rolls.computePcModifier(sheet, 'save', 'Wisdom');
assert(m && m.modifier === 1 && m.proficient === false, 'WIS save (not a rogue save): +1 only');
m = rolls.computePcModifier(sheet, 'ability', 'Intelligence');
assert(m && m.modifier === 2 && m.proficient === false, 'raw INT check: +2, no proficiency');
assert(rolls.computePcModifier(sheet, 'skill', 'Basketweaving') === null, 'unknown skill → null');
assert(rolls.crScaledModifier('1/4') === 2 && rolls.crScaledModifier(2) === 3 &&
       rolls.crScaledModifier('6') === 4 && rolls.crScaledModifier(15) === 6 &&
       rolls.crScaledModifier(null) === 2, 'CR-scaled NPC modifiers: 1/4→2, 2→3, 6→4, 15→6, none→2');

// ---------------------------------------------------------------------------
group('4. Fixtures');
const campaignId = await insertRow('campaigns', { name: 'Roll Test Campaign' });
const charId = await insertRow('characters', {
  name: 'Roll Tester', class: 'Rogue', level: 5, campaign_id: campaignId,
  ability_scores: sheet.ability_scores, skills: sheet.skills,
  current_hit_points: 30, max_hit_points: 30, hit_points: 30
});
const sessionId = await insertRow('dm_sessions', { character_id: charId, status: 'active', session_config: '{}' });
assert(charId > 0 && sessionId > 0, 'character + session fixtures inserted');

// ---------------------------------------------------------------------------
group('5. PC pending lifecycle — request, report, resolve, log');
const req = await rolls.requestPcRoll({
  sessionId, characterId: charId, kind: 'skill', name: 'Sleight of Hand',
  dc: 15, looks: 'a masterfully crafted lock'
});
assert(req.success === true, 'requestPcRoll succeeds');
assert(req.pending.modifier === 7, 'pending carries the true sheet modifier (+7)');
const pending = await rolls.getPendingRoll(sessionId);
assert(pending && pending.dc === 15 && pending.name === 'Sleight of Hand', 'pending roll persisted on session_config');

const out = await rolls.resolveReportedRoll(sessionId, [12]);
assert(out && out.total === 19 && out.outcome === 'success' && out.takenDie === 12, 'reported 12 → 12+7=19 vs DC 15 — success');
assert((await rolls.getPendingRoll(sessionId)) === null, 'pending cleared after resolution');
const logRows = await db.dbAll('SELECT * FROM roll_log WHERE session_id = ? AND source = ?', [sessionId, 'reported']);
assert(logRows.length === 1 && logRows[0].actor_type === 'pc' && logRows[0].outcome === 'success' &&
       logRows[0].taken_die === 12 && logRows[0].total === 19, 'roll_log recorded the reported roll');

assert((await rolls.resolveReportedRoll(sessionId, [10])) === null, 'resolving with nothing pending → null');

await rolls.requestPcRoll({ sessionId, characterId: charId, kind: 'skill', name: 'Stealth', dc: 30, looks: 'x' });
const crit = await rolls.resolveReportedRoll(sessionId, [20]);
assert(crit.outcome === 'critical_success', 'reported nat 20 vs DC 30 → critical_success');
await rolls.requestPcRoll({ sessionId, characterId: charId, kind: 'skill', name: 'Stealth', dc: 5, looks: 'x' });
const fumble = await rolls.resolveReportedRoll(sessionId, [1]);
assert(fumble.outcome === 'critical_failure', 'reported nat 1 vs DC 5 → critical_failure');

await rolls.requestPcRoll({
  sessionId, characterId: charId, kind: 'skill', name: 'Stealth', dc: 15,
  looks: 'x', advantage: 'advantage', advantageReason: 'Lyra is helping'
});
const adv = await rolls.resolveReportedRoll(sessionId, [3, 17]);
assert(adv.takenDie === 17 && adv.outcome === 'success', 'advantage pending: reported [3,17] — system took 17');

const bad = await rolls.requestPcRoll({ sessionId, characterId: charId, kind: 'skill', name: 'Basketweaving', dc: 10 });
assert(bad.success === false, 'request for an unknown skill fails cleanly');

// ---------------------------------------------------------------------------
group('6. Server rolls — enemies and strangers (invariants)');
const gobMod = await rolls.getNpcCheckModifier('Goblin', 'skill', 'Sleight of Hand', charId);
assert(gobMod.actorType === 'enemy', 'bestiary actor resolves as enemy');
assert(gobMod.modifier === 2, 'goblin DEX checks use the bestiary dex_mod (+2)');
const stranger = await rolls.getNpcCheckModifier('Mysterious Stranger', 'skill', 'Stealth', charId);
assert(stranger.actorType === 'npc' && stranger.modifier === 2, 'unknown NPC: generic +2, actorType npc');

for (let i = 0; i < 5; i++) {
  const nr = await rolls.rollForNpc({
    sessionId, characterId: charId, actorName: 'Goblin',
    kind: 'skill', name: 'Sleight of Hand', dc: 14
  });
  assert(nr.dice.length === 1 && nr.dice[0] >= 1 && nr.dice[0] <= 20, 'server roll: one d20 in range');
  assert(nr.total === nr.takenDie + nr.modifier, 'server roll: total = taken die + modifier');
  const expect = rolls.resolveDice({ dice: nr.dice, modifier: nr.modifier, dc: 14, advantage: null });
  assert(nr.outcome === expect.outcome, 'server roll: outcome consistent with resolveDice on the same dice');
}
const npcLogs = await db.dbAll('SELECT * FROM roll_log WHERE session_id = ? AND source = ?', [sessionId, 'server']);
assert(npcLogs.length === 5 && npcLogs.every(x => x.actor_type === 'enemy'), 'all server rolls logged as enemy rolls');

// ---------------------------------------------------------------------------
group('7. Passives — the silent floor');
const p1 = await rolls.checkPassive({ sessionId, characterId: charId, skillName: 'Perception', dc: 12 });
assert(p1 && p1.passive === 14 && p1.outcome === 'passive_success', 'passive Perception 14 (WIS +1 + prof 3) meets DC 12');
const p2 = await rolls.checkPassive({ sessionId, characterId: charId, skillName: 'Perception', dc: 20 });
assert(p2 && p2.outcome === 'passive_failure', 'passive Perception 14 fails DC 20');
const passLogs = await db.dbAll('SELECT * FROM roll_log WHERE session_id = ? AND source = ?', [sessionId, 'passive']);
assert(passLogs.length === 2 && passLogs.every(x => x.check_kind === 'passive'), 'passive checks logged');

// ---------------------------------------------------------------------------
group('8. Marker handler — pipeline integration');
await rolls.requestPcRoll({ sessionId, characterId: charId, kind: 'skill', name: 'Stealth', dc: 10, looks: 'x' }).then(() => rolls.resolveReportedRoll(sessionId, [10]));
const pres = await processResponseMarkers(
  'You work the pick with care. [ROLL_REQUEST: Skill="Stealth" DC=14 Looks="a well-made lock, tight and oiled"]',
  { characterId: charId, sessionId, narrative: '' }
);
const pcHit = pres.handlerResults.find(h => h.schemaKey === 'ROLL_REQUEST');
assert(pcHit && pcHit.ok && pcHit.result?.pending === true, 'PC marker → pending roll created');
assert((await rolls.getPendingRoll(sessionId))?.name === 'Stealth', 'pipeline pending is the Stealth request');

const nres = await processResponseMarkers(
  'The goblin creeps toward the barricaded door. [ROLL_REQUEST: Actor="Goblin" Skill="Stealth" DC=13 Looks="a dark corridor"]',
  { characterId: charId, sessionId, narrative: '' }
);
const npcHit = nres.handlerResults.find(h => h.schemaKey === 'ROLL_REQUEST');
assert(npcHit && npcHit.ok && npcHit.result?.pending === false && typeof npcHit.result?.outcome === 'string',
       'NPC marker → resolved immediately with an outcome');
const cfg = JSON.parse((await db.dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config || '{}');
assert(Array.isArray(cfg.recentRolls) && cfg.recentRolls.length === 1 && cfg.recentRolls[0].actor === 'Goblin',
       'NPC outcome stashed on session_config.recentRolls for next-turn injection');

const bres = await processResponseMarkers(
  '[ROLL_REQUEST: DC=15 Looks="a hard thing"]',
  { characterId: charId, sessionId, narrative: '' }
);
const badHit = bres.handlerResults.find(h => h.schemaKey === 'ROLL_REQUEST');
assert(badHit && badHit.result?.success === false, 'malformed marker (no Skill/Ability/Save) → clean failure result');

// ---------------------------------------------------------------------------
group('9. Outcome block — the DM-facing fact text');
const block = rolls.formatRollOutcomeBlock({
  check: 'Sleight of Hand', modifier: 7, dice: [1], takenDie: 1, total: 8, dc: 15, outcome: 'critical_failure'
});
assert(block.includes('CRITICAL FAILURE') && block.includes('natural 1'), 'critical failure block demands a consequence');
const block2 = rolls.formatRollOutcomeBlock({
  actor: 'Goblin', check: 'Stealth', modifier: 2, dice: [20], takenDie: 20, total: 22, dc: 13, outcome: 'critical_success'
});
assert(block2.includes('Goblin — Stealth') && block2.includes('CRITICAL SUCCESS'), 'NPC block names the actor and the crit');

// ---------------------------------------------------------------------------
console.log(`\n roll-request: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);


