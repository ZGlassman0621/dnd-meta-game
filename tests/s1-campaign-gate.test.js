/**
 * S1 — campaign gate for play (brief docs/pm/s1-campaign-at-creation/BRIEF.md).
 *
 * The audit's repro as tests, through the real DM routes (model stubbed):
 *  - a character with no campaign cannot start a session, and every session
 *    route that plays, shops, moves time or records memory refuses it (409
 *    CAMPAIGN_REQUIRED), with no session row, no model call and no clock move;
 *  - campaign characters still start, play, open the shop and move the clock;
 *  - the clock invariant: no character's play moves another character's clock
 *    (the campaign-less fallback row is never mirrored onto characters; a
 *    campaign-less out-of-session time cost moves only that character);
 *  - the meta-game time advance refuses a campaign-less character;
 *  - the Prelude is exempt by construction and bounded;
 *  - the client shows Play closed with the reason, linking to Campaign.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { once } from 'node:events';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js';
import { advanceDays, setClockDate, getClock } from '../server/services/scheduleService.js';
import { advanceClockForSession } from '../server/services/restTimeService.js';
import { CAMPAIGN_REQUIRED_CODE, CAMPAIGN_REQUIRED_MESSAGE } from '../server/utils/campaignGate.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; console.log(`  ✓ ${msg}`); } else { failed++; console.log(`  ✗ ${msg}`); }
}

await initDatabase();
const llm = installLlmStub({ strict: false, fallback: 'The road is quiet.' });
const server = await startTurnServer();

async function insertCharacter(prefix, campaignId) {
  const r = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location,
       experience_to_next_level, campaign_id, game_day, game_year, game_hour, ability_scores)
     VALUES (?, 'Fighter', 'Human', 3, 28, 28, ?, 900, ?, 100, 1492, 8, ?)`,
    [`${prefix} Hero`, `${prefix}_Town`, campaignId, JSON.stringify({ str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 10 })]
  );
  return Number(r.lastInsertRowid);
}

// Every character's date and every world_clock row, for "nothing moved" checks.
async function snapshot() {
  const chars = await dbAll('SELECT id, game_day, game_year, game_hour FROM characters ORDER BY id');
  const clocks = await dbAll('SELECT id, campaign_id, current_day, current_day_of_year, current_year, current_hour FROM world_clock ORDER BY id');
  return JSON.stringify({ chars, clocks });
}
const charDate = async (id) => dbGet('SELECT game_day, game_year, game_hour FROM characters WHERE id = ?', [id]);

// Fixtures. A and C: campaign characters (different campaigns), each with an
// active session. B: a campaign character whose campaign is removed after its
// session started (a legacy campaign-less session). D: campaign-less, no session.
const A = await seedTurnFixture(dbRun, { prefix: 'TEST_S1_A' });
const C = await seedTurnFixture(dbRun, { prefix: 'TEST_S1_C' });
const B = await seedTurnFixture(dbRun, { prefix: 'TEST_S1_B' });
await dbRun('UPDATE characters SET campaign_id = NULL WHERE id = ?', [B.characterId]);
const D = await insertCharacter('TEST_S1_D', null);
const F = await insertCharacter('TEST_S1_F', A.campaignId); // a campaign character with no session yet
const preludeChar = await insertCharacter('TEST_S1_P', null);
const preludeSession = await dbRun(
  `INSERT INTO dm_sessions (character_id, title, setting, tone, model, status, messages, start_time, session_config, session_type, game_start_day, game_start_year)
   VALUES (?, 'TEST_S1 prelude', '', '', 'x', 'active', ?, datetime('now'), '{}', 'prelude_arc', 1, 1492)`,
  [preludeChar, JSON.stringify([{ role: 'system', content: 'Prelude.' }])]
);
const preludeSessionId = Number(preludeSession.lastInsertRowid);

try {
  console.log('\n=== 1. A character with no campaign cannot start a session ===\n');
  {
    const before = await snapshot();
    const callsBefore = llm.calls.length;
    const res = await server.post('/api/dm-session/start', {
      characterId: D,
      startingLocation: { name: 'TEST_S1 Town', description: 'A town.', region: 'Sword Coast' },
    });
    check(res.status === 409, `POST /start for a campaign-less character is refused with 409 (got ${res.status})`);
    check(res.body?.code === CAMPAIGN_REQUIRED_CODE, `the refusal carries code ${CAMPAIGN_REQUIRED_CODE}`);
    check(res.body?.error === CAMPAIGN_REQUIRED_MESSAGE && /campaign/i.test(res.body?.error || ''), `the error names the missing campaign in plain words ("${res.body?.error}")`);
    const rows = await dbGet('SELECT COUNT(*) AS n FROM dm_sessions WHERE character_id = ?', [D]);
    check(rows.n === 0, 'no session row is written');
    check(llm.calls.length === callsBefore, 'no model call is made (no world context assembled, no opening generated)');
    check((await snapshot()) === before, 'no character date and no clock row changed');
  }

  console.log('\n=== 2. Every play / shop / clock / memory route refuses a campaign-less session ===\n');
  {
    const before = await snapshot();
    const callsBefore = llm.calls.length;
    const msgBefore = (await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [B.sessionId])).messages;
    const id = B.sessionId;
    const gated = [
      ['POST', `/api/dm-session/${id}/message`, { action: 'I look around.' }],
      ['POST', `/api/dm-session/${id}/end`, {}],
      ['GET', `/api/dm-session/${id}/merchants`],
      ['POST', `/api/dm-session/${id}/merchant-transaction`, { merchantName: 'x', bought: [], sold: [] }],
      ['POST', `/api/dm-session/${id}/generate-merchant-inventory`, { merchantName: 'x', merchantType: 'general' }],
      ['POST', `/api/dm-session/${id}/restock-merchant`, { merchantName: 'x' }],
      ['POST', `/api/dm-session/${id}/adjust-date`, { days: 1 }],
      ['POST', `/api/dm-session/${id}/inject-context`, { context: 'x' }],
      ['POST', `/api/dm-session/${id}/rest-narrative`, { restType: 'long' }],
      ['POST', `/api/dm-session/${id}/advance-turn`, {}],
      ['POST', `/api/dm-session/${id}/apply-inventory`, {}],
      ['POST', `/api/dm-session/${id}/resume`, {}],
      ['POST', `/api/dm-session/${id}/claim`, {}],
      ['POST', `/api/dm-session/${id}/extract-npcs`, {}],
    ];
    for (const [method, url, body] of gated) {
      const res = method === 'GET' ? await server.get(url) : await server.post(url, body);
      check(res.status === 409 && res.body?.code === CAMPAIGN_REQUIRED_CODE, `${method} ${url.replace(String(id), ':id')} → 409 CAMPAIGN_REQUIRED (got ${res.status})`);
    }
    check(llm.calls.length === callsBefore, 'no model call was made by any refused route');
    check((await snapshot()) === before, 'no character date and no clock row changed');
    const after = await dbGet('SELECT status, messages FROM dm_sessions WHERE id = ?', [B.sessionId]);
    check(after.status === 'active' && after.messages === msgBefore, 'the stranded session is untouched (no turn recorded, not ended)');
    const chronicles = await dbGet('SELECT COUNT(*) AS n FROM story_chronicles WHERE session_id = ?', [B.sessionId]).catch(() => ({ n: 0 }));
    check(chronicles.n === 0, 'no chronicle attempt');
    // Housekeeping stays open so a stranded legacy session can be closed.
    const view = await server.get(`/api/dm-session/${id}`);
    check(view.status === 200, `GET /:id (read-only) still answers (got ${view.status})`);
    const abort = await server.post(`/api/dm-session/${id}/abort`, {});
    check(abort.status !== 409, `abort is not gated, so the stranded session can be closed (got ${abort.status})`);
  }

  console.log('\n=== 3. Campaign characters play exactly as before ===\n');
  {
    const res = await server.post(`/api/dm-session/${A.sessionId}/message`, { action: 'I walk to the market.' });
    check(res.status === 200, `a campaign character's turn still runs (got ${res.status})`);
    const shop = await server.get(`/api/dm-session/${A.sessionId}/merchants`);
    check(shop.status === 200, `the campaign character's shop answers (got ${shop.status})`);
    const start = await server.post('/api/dm-session/start', {
      characterId: F,
      startingLocation: { name: 'TEST_S1 Town', description: 'A town.', region: 'Sword Coast' },
    });
    check(start.status === 200 && Number.isInteger(start.body?.sessionId), `a campaign character with no session starts one (got ${start.status})`);
    if (start.body?.sessionId) await dbRun('DELETE FROM dm_sessions WHERE id = ?', [start.body.sessionId]);
  }

  console.log('\n=== 4. Clock invariant: no character\'s play moves another character\'s clock ===\n');
  {
    // A campaign advance moves A's campaign (A and F) and nobody else. A real
    // session's /start first syncs the campaign clock to the session date (the
    // mirror is forward-only); replicate that, as session-end-world-tick does.
    const aBefore = await charDate(A.characterId);
    await setClockDate(A.campaignId, { dayOfYear: aBefore.game_day, year: aBefore.game_year });
    const cBefore = await charDate(C.characterId);
    const dBefore = await charDate(D);
    const bBefore = await charDate(B.characterId);
    const r = await advanceClockForSession({ characterId: A.characterId, hours: 48, reason: 'TEST_S1 campaign advance' });
    const aAfter = await charDate(A.characterId);
    check(r.clock.campaignId === A.campaignId, 'the campaign character advances its own campaign clock');
    check(aAfter.game_day > aBefore.game_day || aAfter.game_year > aBefore.game_year, `A's date moved forward (${aBefore.game_day} → ${aAfter.game_day})`);
    check(JSON.stringify(await charDate(C.characterId)) === JSON.stringify(cBefore), 'a character in another campaign did not move');
    check(JSON.stringify(await charDate(D)) === JSON.stringify(dBefore), 'a campaign-less character did not move');
    check(JSON.stringify(await charDate(B.characterId)) === JSON.stringify(bBefore), 'the other campaign-less character did not move');

    // A campaign-less out-of-session time cost moves only that character.
    const fallbackBefore = await dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    const others = JSON.stringify(await dbAll('SELECT id, game_day, game_year, game_hour FROM characters WHERE id != ? ORDER BY id', [D]));
    const dr = await advanceClockForSession({ characterId: D, hours: 30, reason: 'TEST_S1 spellbook copy' });
    const dAfter = await charDate(D);
    check(dr.clock.campaignId === null && dr.clock.day === null, 'a campaign-less character gets a per-character clock (no shared counter)');
    check(dAfter.game_day === dBefore.game_day + 1 && dAfter.game_hour === (dBefore.game_hour + 30) % 24,
      `only D's own date moved: day ${dBefore.game_day} → ${dAfter.game_day}, hour ${dBefore.game_hour} → ${dAfter.game_hour}`);
    check(JSON.stringify(await dbAll('SELECT id, game_day, game_year, game_hour FROM characters WHERE id != ? ORDER BY id', [D])) === others, 'every other character is unchanged');
    const fallbackAfter = await dbGet('SELECT * FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
    check(JSON.stringify(fallbackAfter) === JSON.stringify(fallbackBefore), 'the shared fallback clock row is unchanged');

    // The fallback row itself may move (campaign-less schedules use it), but it is never copied onto characters.
    const allBefore = JSON.stringify(await dbAll('SELECT id, game_day, game_year, game_hour FROM characters ORDER BY id'));
    const fb0 = await getClock();
    await advanceDays(3);
    const fb1 = await getClock();
    check(fb1.day === fb0.day + 3, `the campaign-less fallback clock still advances for schedules (${fb0.day} → ${fb1.day})`);
    await setClockDate(null, { dayOfYear: 360, year: 1499 });
    check(JSON.stringify(await dbAll('SELECT id, game_day, game_year, game_hour FROM characters ORDER BY id')) === allBefore,
      'advancing or re-dating the fallback clock moves no character at all (it used to be copied onto every character)');
    await setClockDate(null, { dayOfYear: fb0.dayOfYear, year: fb0.year });
  }

  console.log('\n=== 5. The meta-game time advance refuses a campaign-less character ===\n');
  {
    const { default: metaGameRoutes } = await import('../server/routes/metaGame.js');
    const app = express();
    app.use(express.json());
    app.use('/api/meta-game', metaGameRoutes);
    const srv = app.listen(0, '127.0.0.1');
    await once(srv, 'listening');
    const before = await snapshot();
    const r = await globalThis.fetch.call(null, `http://127.0.0.1:${srv.address().port}/api/meta-game/advance-time/${D}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ days: 2 }),
    }).catch((e) => ({ status: 0, json: async () => ({ error: e.message }) }));
    const body = await r.json().catch(() => null);
    check(r.status === 409 && body?.code === CAMPAIGN_REQUIRED_CODE, `POST /api/meta-game/advance-time for a campaign-less character → 409 (got ${r.status})`);
    check((await snapshot()) === before, 'nothing moved');
    await new Promise((resolve) => srv.close(resolve));
  }

  console.log('\n=== 6. The Prelude is exempt by construction, and bounded ===\n');
  {
    const preludeFiles = ['server/routes/prelude.js', ...fs.readdirSync(path.join(REPO, 'server/services')).filter((f) => /^prelude.*\.js$/.test(f)).map((f) => `server/services/${f}`)];
    const forbidden = /scheduleService|advanceDays|advanceHours|setClockDate|generateSessionChronicle|storyChronicleService|merchantService|merchant_inventories/;
    const offenders = preludeFiles.filter((f) => forbidden.test(read(f)));
    check(preludeFiles.length > 5, `the Prelude path was scanned (${preludeFiles.length} files)`);
    check(offenders.length === 0, `the Prelude path never touches the clock, the chronicle or the shop (offenders: ${offenders.join(', ') || 'none'})`);
    check(/creation_phase !== 'prelude'/.test(read('server/services/preludeSessionService.js')), 'Prelude sessions start only for a Prelude-phase character (its own guard)');
    const viaDm = await server.post(`/api/dm-session/${preludeSessionId}/message`, { action: 'I sneak out.' });
    check(viaDm.status === 409, `a Prelude session sent to the DM turn route is refused like any campaign-less session (got ${viaDm.status})`);
  }

  console.log('\n=== 7. The client shows Play closed, with the reason, linking to Campaign ===\n');
  {
    const nav = read('client/src/components/NavigationMenu.jsx');
    const app = read('client/src/App.jsx');
    check(nav.includes("export const PLAY_LOCKED_REASON = 'Create or join a campaign to play'"), 'the reason is plain words: "Create or join a campaign to play"');
    check(/const lockedPlay = item\.key === 'showDMSession' && hasCharacter && playLocked/.test(nav) && /disabled=\{disabled\}/.test(nav),
      'the nav Play entry is disabled for a campaign-less character, not hidden');
    check(/onClick=\{\(\) => onNavigate\('showCampaigns'\)\}/.test(nav) && nav.includes('{PLAY_LOCKED_REASON}'), 'the visible reason opens the Campaign page');
    check(/const playLocked = !!selectedCharacter && !selectedCharacter\.campaign_id/.test(app) && /playLocked=\{playLocked\}/.test(app), 'App locks Play from the selected character\'s campaign');
    check(/activeView === 'showDMSession' && selectedCharacter && playLocked \?/.test(app) && app.includes('data-testid="play-gate"'), 'the Play view itself shows the campaign gate instead of a session');
    check(/target: 'showCampaigns', locked: true/.test(app), 'the home-screen AI Dungeon Master card points to Campaign while locked');
    check(/await loadCharacters\(\)\s*\n\s*navigateTo\('showDMSession'\)/.test(app), 'after joining a campaign, Play waits for the refreshed character');
  }
} finally {
  restoreLlm();
  await server.close();
  for (const f of [A, C, B]) await cleanupTurnFixture(dbRun, f).catch(() => {});
  await dbRun('DELETE FROM dm_sessions WHERE id = ?', [preludeSessionId]).catch(() => {});
  for (const id of [D, F, preludeChar]) await dbRun('DELETE FROM characters WHERE id = ?', [id]).catch(() => {});
  await dbRun("DELETE FROM world_clock WHERE campaign_id IN (?, ?)", [A.campaignId, C.campaignId]).catch(() => {});
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
