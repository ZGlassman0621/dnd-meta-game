/**
 * tests/companion-engine.test.js — Companion Engine (DM System Part 2)
 *
 * Real-DB integration tests. Run from the repo root:
 *   node tests/companion-engine.test.js
 *
 * Spins up a throwaway database (never touches the live game DB), runs all
 * migrations, exercises the companion initiative service against real rows.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// Isolated throwaway DB: chdir BEFORE importing database.js, which opens
// file:local.db relative to the working directory.
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-companion-eng-'));
process.chdir(dbDir);

// The suite runner (server/scripts/run-tests.js) exports TURSO_DATABASE_URL
// pointing at the SHARED .test-tmp/test.db for every test, and database.js
// prefers it over the CWD-local file — which silently defeats the chdir
// isolation above and leaks this test's rows into other tests' cleanups
// (found 2026-10-20, the same leak as capstone-combat). Clearing it makes
// the throwaway DB real, under npm test and standalone alike.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDatabase, dbGet, dbRun, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

const svcPath = (p) => pathToFileURL(path.join(REPO, p)).href;
const eng = await import(svcPath('server/services/companionInitiativeService.js'));
const cprompt = await import(svcPath('server/services/companionPrompt.js'));

// ---------------------------------------------------------------------------
// assert / group — repo's custom pattern (not vitest)
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  ✗ ${msg}`);
  }
}
function group(name) {
  console.log(`\n${name}`);
}

// ---------------------------------------------------------------------------
// Fixtures — TEST_ prefixed, unique per run
// ---------------------------------------------------------------------------
const RUN = 'T' + Date.now().toString(36).toUpperCase();
let seq = 0;
const tn = (b) => `TEST_${b}_${RUN}_${++seq}`;

/**
 * Insert a row, discovering NOT NULL columns via PRAGMA and filling dummies
 * for the ones the caller doesn't override. Robust against unknown schema.
 */
async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue; // autoincrement
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name);
      vals.push(overrides[c.name]);
      continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name);
      vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    vals
  );
  return Number(r.lastInsertRowid);
}

const compCols = await dbAll(`PRAGMA table_info(companions)`);
const HAS_NPC_ID = compCols.some((c) => c.name === 'npc_id');
console.log(`[test] companions.npc_id present: ${HAS_NPC_ID}`);

// Shared FK parents: companions.npc_id and companions.recruited_by_character_id
// are enforced FKs — a bare companion insert gets dummy parent id 1 from
// insertRow, which dangles on an empty DB (SQLITE_CONSTRAINT_FOREIGNKEY,
// first full-suite run 2026-10-20). All companion fixtures go through
// newCompanionRow so the parents are real.
const ownerId = await insertRow('characters', { name: tn('Owner') });
const ownerNpcId = await insertRow('npcs', { name: tn('OwnerNPC') });
const newCompanionRow = (extra = {}) =>
  insertRow('companions', { npc_id: ownerNpcId, recruited_by_character_id: ownerId, ...extra });

// ---------------------------------------------------------------------------
// 1. Task holding (R14)
// ---------------------------------------------------------------------------
group('1. task holding persists until changed');
{
  const cid = await newCompanionRow({ name: tn('Lyra') });
  const t0 = await eng.getCompanionTask(cid);
  assert(t0 === null, 'new companion has no task');

  const set = await eng.setCompanionTask(cid, {
    description: 'perimeter watch',
    assignedBy: 'pc',
    assignedDay: 12,
  });
  assert(set.status === 'active', 'set task is active');
  assert(set.description === 'perimeter watch', 'task description stored');

  const got = await eng.getCompanionTask(cid);
  assert(got && got.description === 'perimeter watch', 'task persists across reads');
  assert(got.assigned_day === 12, 'assigned day persisted');

  const cleared = await eng.clearCompanionTask(cid, 'done');
  assert(cleared.status === 'done', 'clear marks done');

  const withTasks = await eng.getCompanionsWithTasks();
  assert(!withTasks.some((w) => w.id === cid), 'done task no longer listed as active');

  const cid2 = await newCompanionRow({ name: tn('Ali') });
  await eng.setCompanionTask(cid2, { description: 'guard the camp' });
  const withTasks2 = await eng.getCompanionsWithTasks();
  assert(withTasks2.some((w) => w.id === cid2), 'active task listed');
  assert(withTasks2.find((w) => w.id === cid2).task.description === 'guard the camp', 'task payload intact');
}

// ---------------------------------------------------------------------------
// 2-6. Readiness assessment (pure logic — no DB needed)
// ---------------------------------------------------------------------------
group('2. readiness: directly addressed companion acts');
{
  const r = eng.assessReadiness({ id: 7, name: 'Lyra' }, { addressedTo: 7 });
  assert(r.shouldAct && r.priority === 'high' && r.focus === 'respond', 'addressed -> high/respond');
  const r2 = eng.assessReadiness({ id: 7, name: 'Lyra' }, { addressedTo: 8 });
  assert(!r2.shouldAct, 'addressed to someone else -> no trigger from this rule');
}

group('3. readiness: task-relevant stimulus (R14)');
{
  const comp = {
    id: 1,
    name: 'Lyra',
    current_task: JSON.stringify({ description: 'perimeter watch', status: 'active' }),
  };
  const hit = eng.assessReadiness(comp, {
    newStimulus: 'movement on the treeline',
    stimulusDomain: 'perimeter',
  });
  assert(hit.shouldAct && hit.priority === 'high' && hit.focus === 'task', 'task-domain stimulus -> high/task');

  const miss = eng.assessReadiness(comp, {
    newStimulus: 'the stew is ready',
    stimulusDomain: 'cooking',
  });
  assert(!miss.shouldAct, 'unrelated stimulus -> no trigger');
}

group('4. readiness: passive expertise (R1)');
{
  const comp = { id: 2, name: 'Lyra', passive_perception: 15 };
  const notice = eng.assessReadiness(comp, {
    sceneDc: { skill: 'perception', value: 13 },
    pcPassive: 9,
  });
  assert(notice.shouldAct && notice.priority === 'medium' && notice.focus === 'notice', 'expert notices first -> medium/notice');

  const pcSees = eng.assessReadiness(comp, {
    sceneDc: { skill: 'perception', value: 13 },
    pcPassive: 16,
  });
  assert(!pcSees.shouldAct, 'PC beats the DC too -> no expert beat needed');
}

group('5. readiness: personal goal intersects scene');
{
  const comp = {
    id: 3,
    name: 'Lyra',
    personal_goals: JSON.stringify([
      { goal: 'Find who hired the Red Hand', priority: 'high', keywords: ['red hand'] },
    ]),
  };
  const r = eng.assessReadiness(comp, { description: 'A red hand banner flies over the camp' });
  assert(r.shouldAct && r.priority === 'medium' && r.focus === 'goal', 'goal keyword match -> medium/goal');
}

group('6. readiness: private knowledge relevance (R22)');
{
  const comp = {
    id: 4,
    name: 'Lyra',
    what_they_know: JSON.stringify([
      { id: 'k1', fact: 'Served with the Red Hand once', known_to_pc: false, keywords: ['red hand'] },
    ]),
  };
  const r = eng.assessReadiness(comp, { description: 'The red hand mercenaries approach' });
  assert(r.shouldAct && r.focus === 'withhold-or-reveal', 'relevant private knowledge flagged (reveal left to character)');

  const comp2 = {
    id: 5,
    name: 'Lyra',
    what_they_know: JSON.stringify([
      { id: 'k1', fact: 'Served with the Red Hand once', known_to_pc: true, keywords: ['red hand'] },
    ]),
  };
  const r2 = eng.assessReadiness(comp2, { description: 'The red hand mercenaries approach' });
  assert(!r2.shouldAct, 'already-known fact -> no trigger');
}

group('7. buildCompanionBeats assesses the whole party');
{
  const beats = eng.buildCompanionBeats(
    [
      { id: 11, name: 'Lyra' },
      { id: 12, name: 'Ali' },
    ],
    { addressedTo: 12 }
  );
  assert(beats.length === 2, 'one beat per companion');
  assert(beats[1].readiness.priority === 'high', 'addressed companion is high');
  assert(beats[0].readiness.priority === 'none', 'untriggered companion is none');
}

// ---------------------------------------------------------------------------
// 8. Knowledge opacity (R22)
// ---------------------------------------------------------------------------
group('8. knowledge opacity: private stays private until revealed');
{
  const cid = await newCompanionRow({ name: tn('Mira') });
  const e1 = await eng.addCompanionKnowledge(cid, 'Owes a debt to the Red Hand', {
    keywords: ['red hand'],
  });
  assert(e1 && e1.known_to_pc === false, 'new fact defaults to private');
  assert(typeof e1.id === 'string' && e1.id.length > 0, 'fact gets an id');

  const priv = await eng.getCompanionKnowledge(cid, { privateOnly: true });
  assert(priv.length === 1 && priv[0].fact.includes('debt'), 'privateOnly returns the hidden fact');

  const revealed = await eng.revealKnowledgeToPc(cid, e1.id);
  assert(revealed && revealed.known_to_pc === true, 'reveal flips known_to_pc');

  const privAfter = await eng.getCompanionKnowledge(cid, { privateOnly: true });
  assert(privAfter.length === 0, 'revealed fact no longer private');

  const missing = await eng.revealKnowledgeToPc(cid, 'nope-not-an-id');
  assert(missing === null, 'reveal of unknown id returns null');
}

// ---------------------------------------------------------------------------
// 9. Relationship trackers clamp and isolate
// ---------------------------------------------------------------------------
group('9. relationship: clamped 0-100, per-companion');
{
  const a = await newCompanionRow({ name: tn('RelA') });
  const b = await newCompanionRow({ name: tn('RelB') });

  const d0 = await eng.getRelationship(a);
  assert(d0.trust === 50 && d0.respect === 50 && d0.friction === 0, 'defaults 50/50/0');

  const up = await eng.updateRelationship(a, { trust: 30 });
  assert(up.trust === 80, 'trust 50+30=80');

  const over = await eng.updateRelationship(a, { trust: 200 });
  assert(over.trust === 100, 'trust clamps at 100');

  const under = await eng.updateRelationship(a, { friction: -50, respect: -200 });
  assert(under.friction === 0 && under.respect === 0, 'friction/respect clamp at 0');

  const bRel = await eng.getRelationship(b);
  assert(bRel.trust === 50, 'second companion unaffected (isolation)');
}

// ---------------------------------------------------------------------------
// 10. Personal goals normalize
// ---------------------------------------------------------------------------
group('10. personal goals');
{
  const cid = await newCompanionRow({ name: tn('Goalie') });
  const set = await eng.setPersonalGoals(cid, ['Find her brother', { goal: 'Leave the Red Hand', priority: 'high', keywords: ['red hand'] }]);
  assert(set.length === 2, 'two goals stored');
  assert(set[0].goal === 'Find her brother' && set[0].priority === 'medium', 'string goal normalized');

  const got = await eng.getPersonalGoals(cid);
  assert(got.length === 2 && got[1].priority === 'high', 'goals persist');
}

// ---------------------------------------------------------------------------
// 11. Recruitment enrichment (hidden-agenda roll is mechanical)
// ---------------------------------------------------------------------------
group('11. recruitment: enrichNewCompanion seeds agenda, relationship, goals, private fact');
{
  const npcId = await insertRow('npcs', { name: tn('RecruitNPC') });
  const overrides = { name: tn('Recruit'), recruited_by_character_id: ownerId };
  if (HAS_NPC_ID) overrides.npc_id = npcId;
  const cid = await insertRow('companions', overrides);

  // Mock LLM: goals shape for the goals call, fact shape for the secret call.
  const mockLlm = async (prompt) => {
    if (prompt.includes('personal goals')) {
      return JSON.stringify({
        goals: [{ goal: 'Earn the party trust', priority: 'high', keywords: ['trust'] }],
      });
    }
    return JSON.stringify({ fact: 'Once stole from a temple', keywords: ['temple'] });
  };

  const res = await eng.enrichNewCompanion(cid, { llmCall: mockLlm, background: 'ex-scout' });
  assert(res && res.companionId === cid, 'enrichment returns the companion id');
  assert(res.agenda && typeof res.agenda === 'object', 'agenda result present (rolled, deferred, or generated)');
  assert(res.relationship && res.relationship.trust === 50, 'relationship seeded at neutral');
  assert(Array.isArray(res.goals) && res.goals.length >= 1, 'at least one personal goal');
  assert(res.seedKnowledge && res.seedKnowledge.known_to_pc === false, 'seed fact is private to the companion');

  const storedGoals = await eng.getPersonalGoals(cid);
  assert(storedGoals.length >= 1, 'goals persisted');

  const priv = await eng.getCompanionKnowledge(cid, { privateOnly: true });
  assert(priv.length >= 1, 'private knowledge persisted');

  if (HAS_NPC_ID) {
    const npc = await dbGet(`SELECT complexity_tier FROM npcs WHERE id = ?`, [npcId]);
    assert(npc && npc.complexity_tier != null, `npcs row got a complexity tier (got: ${npc && npc.complexity_tier})`);
  }
}

// ---------------------------------------------------------------------------
// 12. Prompt blocks: DM-only, three-role separation
// ---------------------------------------------------------------------------
group('12. prompt blocks render DM-only companion context');
{
  const block = cprompt.buildCompanionPromptBlock({
    name: 'Lyra',
    class: 'Ranger',
    alignment: 'Chaotic Good',
    personality: 'Watchful, terse, loyal once earned',
    personal_goals: JSON.stringify([{ goal: 'Find her brother', priority: 'high' }]),
    current_task: JSON.stringify({ description: 'perimeter watch', status: 'active' }),
    what_they_know: JSON.stringify([
      { id: 'k1', fact: 'Recognizes the Red Hand banner', known_to_pc: false, keywords: [] },
    ]),
    relationship_to_pc: JSON.stringify({ trust: 62, respect: 70, friction: 5 }),
  });
  assert(block.includes('DM-ONLY'), 'block marked DM-only');
  assert(block.includes('Lyra'), 'companion name present');
  assert(block.includes('perimeter watch'), 'current task surfaced to DM');
  assert(block.includes('Recognizes the Red Hand banner'), 'private knowledge visible to DM');
  assert(block.includes('trust 62'), 'relationship trackers present');
  assert(block.includes('Chaotic Good (PRIVATE)'), 'alignment marked private');

  const beats = cprompt.buildCompanionBeatSection([
    { name: 'Lyra', readiness: { shouldAct: true, priority: 'high', focus: 'task', reason: 'perimeter triggered' } },
    { name: 'Ali', readiness: { shouldAct: false, priority: 'none', focus: null, reason: 'quiet' } },
  ]);
  assert(beats.includes('Lyra') && beats.includes('HIGH'), 'high-priority beat listed');
  assert(!beats.includes('Ali'), 'idle companion gets no beat');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed`);
if (failures.length) {
  console.log('Failures:');
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

// Best-effort cleanup of the throwaway dir (the DB itself is disposable).
try {
  process.chdir(os.tmpdir());
  fs.rmSync(dbDir, { recursive: true, force: true });
} catch { /* ignore */ }
