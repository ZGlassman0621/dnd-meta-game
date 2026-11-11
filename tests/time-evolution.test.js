// tests/time-evolution.test.js — time-evolution engine (2026-11-03).
// Places change with world time; they never freeze and never respawn
// cleared occupants. Real services, real DB. Elapsed time is always
// set explicitly (anchor + current day inputs) — never a live random
// roll, never real elapsed wall time.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-evolution-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const te = await import(svc('server/services/timeEvolutionService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/timeEvolutionService.js')); // registers EVOLVE_PLACE

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

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

async function makeScene(over = {}) {
  const id = await insertRow('scenes', {
    campaign_id: 0, name: 'Vampire Den', kind: 'dungeon',
    seed_json: JSON.stringify({ siteDice: { occupant: 'goblins', hazardFamily: 'darkness' }, region: 'Sword Coast' }),
    generated_world_day: 1000, generated_world_year: 1400,
    ...over,
  });
  return dbGet('SELECT * FROM scenes WHERE id = ?', [id]);
}

async function count(table, where, params) {
  const row = await dbGet(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params);
  return Number(row?.n || 0);
}
async function markerResult(text, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId: 1, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}
const Y = 365;

group('1. Band suggestion by elapsed time; return suggests, does not apply');
{
  const cases = [
    [1, 'stable'], [4, 'stable'], [6, 'minor'], [19, 'minor'], [30, 'major'], [99, 'major'], [150, 'settlement'],
  ];
  for (const [years, band] of cases) {
    const s = await makeScene({ name: `Den-${years}` });
    const r = await te.evaluateReturn(s.id, { currentWorldDay: 1000 + years * Y, currentYear: 1400 + years });
    ok(r.success === true && r.band === band, `${years} years suggests ${band} (got ${r.band})`);
    ok(r.elapsedYears === years, `${years} years elapsed computed exactly`);
  }
  const s = await makeScene({ name: 'Den-visit' });
  await te.evaluateReturn(s.id, { currentWorldDay: 1000 + 30 * Y, currentYear: 1430 });
  ok((await count('scene_evolution_history', 'scene_id = ?', [s.id])) === 0, 'return evaluation creates no history chapter');
  ok((await count('scene_evolution_news', 'scene_id = ?', [s.id])) === 0, 'return evaluation creates no news');
  const row = await dbGet('SELECT last_visited_world_day FROM scenes WHERE id = ?', [s.id]);
  ok(row.last_visited_world_day === 1000 + 30 * Y, 'return stamps the last-visited anchor');
}

group('2. Events override bands; protection holds a place stable');
{
  const s1 = await makeScene({ name: 'Den-war' });
  const war = await te.evaluateEvolution(s1.id, { currentWorldDay: 1000 + 1 * Y, event: 'war' });
  ok(war.band === 'minor' && war.escalated === true, 'war escalates 1 year from stable to minor');
  const s2 = await makeScene({ name: 'Den-protected' });
  const held = await te.evaluateEvolution(s2.id, { currentWorldDay: 1000 + 150 * Y, protected: true });
  ok(held.band === 'stable' && held.held === true, 'protection holds a 150-year place at stable');
  const broken = await te.evaluateEvolution(s2.id, { currentWorldDay: 1000 + 150 * Y, protected: true, event: 'disaster' });
  ok(broken.band === 'settlement' && broken.held === false, 'disaster breaks protection (settlement)');
  const s3 = await makeScene({ name: 'Den-collapse' });
  const col = await te.evaluateEvolution(s3.id, { currentWorldDay: 1000 + 6 * Y, event: 'faction_collapse' });
  ok(col.band === 'major', 'faction collapse escalates minor to major');
}

group('3. DM-proposed evolution applies; seed preserved; news created');
{
  const s = await makeScene();
  const r = await te.applyEvolution(s.id, {
    occupants: 'bandits', use: 'bandit camp', lootState: 'picked clean',
    currentWorldDay: 1000 + 30 * Y, currentYear: 1430, partyDeed: true,
  });
  ok(r.success === true && r.stored === true && r.band === 'major', '30-year DM-proposed evolution applies as major');
  ok(r.previousOccupants === 'goblins' && r.newOccupants === 'bandits', 'previous vs new occupants recorded');
  ok(r.newsChannel === 'news', 'default channel is background news');
  const row = await dbGet('SELECT * FROM scenes WHERE id = ?', [s.id]);
  ok(row.current_occupants === 'bandits' && row.current_use === 'bandit camp', 'current occupants/use updated on the scene');
  ok(row.last_evolved_world_day === 1000 + 30 * Y, 'last-evolved anchor updated');
  const seed = JSON.parse(row.seed_json);
  ok(seed.siteDice.occupant === 'goblins', 'seed packet birth record untouched (original occupant preserved in history, not rewritten)');
  ok((await count('scene_evolution_history', 'scene_id = ?', [s.id])) === 1, 'one history chapter recorded');
  const news = await dbGet('SELECT * FROM scene_evolution_news WHERE scene_id = ? ORDER BY id DESC LIMIT 1', [s.id]);
  ok(news && news.channel === 'news' && /large and meaningful/.test(news.body), 'news record carries the party-deed emphasis');
  // Marker path: EVOLVE_PLACE dispatches through the live pipeline.
  const pcId = await insertRow('characters', { name: 'Tester' });
  const sess = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
  const m = await markerResult(`[EVOLVE_PLACE: Scene=${s.id} Occupants="orcs" Use="orc warren"]`, sess, 'EVOLVE_PLACE');
  ok(m && m.success === true && m.newOccupants === 'orcs', 'EVOLVE_PLACE marker applies through the pipeline');
}

group('4. Anomalies need justification; respawn is refused even with justification');
{
  const s = await makeScene({
    name: 'Desert Den',
    seed_json: JSON.stringify({ siteDice: { occupant: 'goblins', hazardFamily: 'darkness' }, region: 'desert' }),
  });
  const blocked = await te.applyEvolution(s.id, {
    occupants: 'bandits', hazardFamily: 'water',
    currentWorldDay: 1000 + 30 * Y, currentYear: 1430,
  });
  ok(blocked.success === false && blocked.needsJustification === true && blocked.stored === false, 'desert + water hazard flagged, refused without justification');
  ok((await count('scene_evolution_history', 'scene_id = ?', [s.id])) === 0, 'blocked evolution stores nothing');
  const justified = await te.applyEvolution(s.id, {
    occupants: 'bandits', hazardFamily: 'water',
    justification: 'an ancient irrigation curse keeps the wellspring flowing in the desert',
    currentWorldDay: 1000 + 30 * Y, currentYear: 1430,
  });
  ok(justified.success === true && justified.coherence.flags.length === 1, 'justified anomaly stores with its flag preserved');
  const ch = await dbGet('SELECT flags_json, justification FROM scene_evolution_history WHERE scene_id = ? ORDER BY id DESC LIMIT 1', [s.id]);
  ok(JSON.parse(ch.flags_json).length === 1 && /irrigation curse/.test(ch.justification), 'flag + justification recorded in the chapter');
  const respawn = await te.applyEvolution(s.id, {
    occupants: 'goblins', justification: 'they came back, honest',
    currentWorldDay: 1000 + 40 * Y, currentYear: 1440,
  });
  ok(respawn.success === false && respawn.stored === false, 'cleared occupants never return, even with justification');
  ok((await count('scene_evolution_history', 'scene_id = ?', [s.id])) === 1, 'respawn refusal stores no chapter');
  const noChange = await te.applyEvolution(s.id, {
    occupants: 'bandits', use: null, currentWorldDay: 1000 + 40 * Y, currentYear: 1440,
  });
  ok(noChange.success === false, 'a proposal that changes nothing is refused');
}

group('5. News channels; tick candidates never spoil an evolution');
{
  const songScene = await makeScene({ name: 'Song Town' });
  const song = await te.applyEvolution(songScene.id, {
    occupants: 'dwarves', use: 'dwarven city', historicNote: true,
    currentWorldDay: 1000 + 150 * Y, currentYear: 1550,
  });
  ok(song.newsChannel === 'song', 'settlement change is a song');
  const storyScene = await makeScene({ name: 'Story Den' });
  const story = await te.applyEvolution(storyScene.id, {
    occupants: 'bandits', historicNote: true,
    currentWorldDay: 1000 + 30 * Y, currentYear: 1430,
  });
  ok(story.newsChannel === 'story', 'historic-note major change is a travelling story');
  const rumorScene = await makeScene({ name: 'Rumor Den' });
  const rumor = await te.applyEvolution(rumorScene.id, {
    occupants: 'kobolds', viaNetwork: true,
    currentWorldDay: 1000 + 6 * Y, currentYear: 1406,
  });
  ok(rumor.newsChannel === 'rumor', 'network-spread minor change is a rumor');
  // Tick: a 30-year scene with no history is a candidate, and the tick
  // itself writes nothing and creates no news.
  const tickScene = await makeScene({ name: 'Tick Den', campaign_id: 7 });
  const beforeH = await count('scene_evolution_history', 'scene_id = ?', [tickScene.id]);
  const beforeN = await count('scene_evolution_news', 'scene_id = ?', [tickScene.id]);
  const tick = await te.tickEvolution(7, { currentWorldDay: 1000 + 30 * Y, currentYear: 1430 });
  ok(tick.success === true && tick.candidates.some((c) => c.sceneId === tickScene.id && c.band === 'major'), 'tick flags the 30-year scene as a major candidate');
  ok((await count('scene_evolution_history', 'scene_id = ?', [tickScene.id])) === beforeH, 'tick writes no history');
  ok((await count('scene_evolution_news', 'scene_id = ?', [tickScene.id])) === beforeN, 'tick creates no news (a candidate is not an evolution)');
  // Return + tick evaluate the same scene consistently.
  const ret = await te.evaluateReturn(tickScene.id, { currentWorldDay: 1000 + 30 * Y, currentYear: 1430 });
  ok(ret.band === 'major', 'return trigger agrees with the tick trigger on the same scene');
}

console.log(`\ntime-evolution: ${passed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
