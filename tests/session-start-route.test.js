/**
 * POST /api/dm-session/start through the real route, model stubbed.
 *
 * Added in the local-model-only job after the first live run found that
 * session start failed on EVERY call: the dm_sessions INSERT listed 11
 * columns but bound 12 values ("SQLITE_ERROR: 12 values for 11 columns").
 * No test exercised /start through the route, so the suite never saw it.
 * This file is that test: a session starts, the row is written with the DM
 * role's model, the opening is the stubbed reply, and a missing local model
 * is refused before anything is written.
 */
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { installLlmStub, restoreLlm, startTurnServer } from './helpers/llmHarness.js';
import { modelFor } from '../server/services/localModels.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}

await initDatabase();

async function seed(prefix) {
  const camp = await dbRun('INSERT INTO campaigns (name, setting, status) VALUES (?, ?, ?)', [`${prefix} Campaign`, 'Forgotten Realms', 'active']);
  const campaignId = Number(camp.lastInsertRowid);
  const ch = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location,
       experience_to_next_level, campaign_id, game_day, game_year, ability_scores)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [`${prefix} Hero`, 'Fighter', 'Human', 3, 28, 28, `${prefix}_Town`, 900, campaignId, 120, 1492,
      JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 })]
  );
  return { campaignId, characterId: Number(ch.lastInsertRowid) };
}
async function cleanup({ campaignId, characterId }) {
  await dbRun('DELETE FROM ai_call_log WHERE character_id = ?', [characterId]).catch(() => {});
  await dbRun('DELETE FROM dm_sessions WHERE character_id = ?', [characterId]).catch(() => {});
  await dbRun('DELETE FROM characters WHERE id = ?', [characterId]);
  // Session start seeds the campaign's weather row.
  await dbRun('DELETE FROM campaign_weather WHERE campaign_id = ?', [campaignId]).catch(() => {});
  await dbRun('DELETE FROM campaigns WHERE id = ?', [campaignId]);
}

const llm = installLlmStub({ strict: false, fallback: 'You stand at the gates of TEST_START Town.' });
const server = await startTurnServer();
const fx = await seed('TEST_START');
const fx2 = await seed('TEST_START_DOWN');
try {
  console.log('\n=== A session starts through the real route ===\n');
  const res = await server.post('/api/dm-session/start', {
    characterId: fx.characterId,
    startingLocation: { name: 'TEST_START Town', description: 'A test town.', region: 'Sword Coast' },
    campaignLength: 'one-shot',
  });
  check(res.status === 200, `POST /start returns 200 (got ${res.status}: ${JSON.stringify(res.body).slice(0, 200)})`);
  check(Number.isInteger(res.body?.sessionId), 'a session id comes back');
  check(res.body?.openingNarrative === 'You stand at the gates of TEST_START Town.', 'the opening is the model\'s reply');
  const row = res.body?.sessionId ? await dbGet('SELECT * FROM dm_sessions WHERE id = ?', [res.body.sessionId]) : null;
  check(!!row, 'the dm_sessions row was written');
  check(row?.status === 'active', `the session is active (got ${row?.status})`);
  check(row?.model === modelFor('dm'), `the row records the DM role's model (got ${row?.model})`);
  const messages = JSON.parse(row?.messages || '[]');
  check(messages[0]?.role === 'system' && messages[0].content.length > 1000, 'messages[0] is the full DM system prompt');
  check(llm.calls.some((c) => c.model === modelFor('dm') && /Begin the adventure/.test(c.lastUserMessage)), 'the opening call ran on the DM role');

  console.log('\n=== A missing local model is refused before anything is written ===\n');
  restoreLlm();
  installLlmStub({ ollamaDown: true });
  const down = await server.post('/api/dm-session/start', {
    characterId: fx2.characterId,
    startingLocation: { name: 'TEST_START Town', description: 'A test town.', region: 'Sword Coast' },
  });
  check(down.status === 503, `Ollama down → 503 (got ${down.status})`);
  check(/Ollama/.test(down.body?.details || ''), `the details say what to do (got ${down.body?.details})`);
  const none = await dbGet('SELECT COUNT(*) AS n FROM dm_sessions WHERE character_id = ?', [fx2.characterId]);
  check(none.n === 0, 'no session row was written');
} finally {
  restoreLlm();
  await server.close();
  await cleanup(fx);
  await cleanup(fx2);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
