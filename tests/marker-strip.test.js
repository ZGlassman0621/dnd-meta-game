// tests/marker-strip.test.js — no raw DM marker reaches the player
// (marker-strip fix, brief docs/pm/marker-strip-fix/BRIEF.md).
//
// Pins:
//   (a) the strip is generated from MARKER_SCHEMAS — every key, nothing
//       hand-listed;
//   (b) EVERY schema marker is removed from sample narrative, with a
//       payload, without one, in lower case, and mid-sentence;
//   (c) regression: the 27 schema markers the old hand list removed are
//       still removed (the 28th, SKILL_CHECK, was never a schema);
//   (d) fences: bracketed prose that is not a schema marker survives —
//       [OOC: …] recruitment questions, near-miss names, plain brackets;
//   (e) the turn route: the hand list is gone, the strip runs after the
//       engine reads the markers and before reconcileTurn, and a real turn
//       returns clean narration while the markers' effects still apply;
//   (f) the other player-facing paths: the reloaded history (display
//       copy), the session-start opening, and the resume recap.
//
// Run: node server/scripts/run-tests.js marker-strip
import fs from 'node:fs';
import { initDatabase, dbRun, dbGet } from '../server/database.js';
import { MARKER_SCHEMAS } from '../server/services/markerSchemas.js';
import { stripMarkers, STRIPPED_MARKER_NAMES, markerPattern } from '../server/services/markerStrip.js';
import { installLlmStub, restoreLlm, startTurnServer, seedTurnFixture, cleanupTurnFixture } from './helpers/llmHarness.js';

let passed = 0;
let failed = 0;
function check(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

await initDatabase();
const KEYS = Object.keys(MARKER_SCHEMAS);
const hasMarker = (text) => KEYS.some((k) => new RegExp(`\\[${k}(\\s*:|\\])`, 'i').test(text));

// ===========================================================================
group('(a) the strip is generated from MARKER_SCHEMAS');
{
  // 130 since combat resolution (2026-11-23): ENEMY_FLEE, ENEMY_SURRENDER, COMBAT_SETTLE, COMBAT_ESCAPE.
  // 132 since feat-addition-14 (2026-11-24): FEAT_USE, WINNING_WORDS.
  check(KEYS.length === 132, `MARKER_SCHEMAS has 132 schemas (got ${KEYS.length})`);
  check(JSON.stringify(STRIPPED_MARKER_NAMES) === JSON.stringify(KEYS), 'the stripped names ARE the schema keys, in order, nothing added or missing');
  const src = fs.readFileSync(new URL('../server/services/markerStrip.js', import.meta.url), 'utf8');
  check(src.includes('Object.keys(MARKER_SCHEMAS)'), 'markerStrip derives its names from MARKER_SCHEMAS');
  check(markerPattern().flags.includes('i') && markerPattern().flags.includes('g'), 'the pattern is global and case-insensitive');
  check(markerPattern() !== markerPattern(), 'each call returns a fresh regex (no shared lastIndex state)');
}

// ===========================================================================
group('(b) every schema marker is stripped — payload, bare, lower case, mid-sentence');
{
  let survivors = [];
  for (const k of KEYS) {
    const forms = [
      `[${k}: Target="Lyra" Amount=3 Reason="a test"]`,
      `[${k}]`,
      `[${k.toLowerCase()}: x=1]`,
      `[${k} : spaced="yes"]`,
    ];
    for (const f of forms) {
      const out = stripMarkers(`The torch gutters. ${f} You hear footsteps.`);
      if (hasMarker(out) || !out.includes('The torch gutters.') || !out.includes('You hear footsteps.')) survivors.push(`${k} :: ${f} -> ${out}`);
    }
    const end = stripMarkers(`The fight begins.\n\n[${k}: Enemies="x"]`);
    if (end !== 'The fight begins.') survivors.push(`${k} (at end) -> ${JSON.stringify(end)}`);
  }
  check(survivors.length === 0, `all ${KEYS.length} markers x 5 placements stripped (${survivors.length} survived)${survivors.length ? ': ' + survivors.slice(0, 5).join(' | ') : ''}`);
  const many = stripMarkers('Steel flashes. [COMBAT_START: Enemies="Thug (HP 12, AC 13)"] [SET_ROOM: Name="Tavern" Features="Bar:cover_half:half"] [SET_COVER: Target="Player" Cover="half" Feature="Bar"] [ENEMY_ATTACK: Enemy="Thug" Target="Player" Multiattack="true"] The thug lunges.');
  check(many === 'Steel flashes. The thug lunges.', `Zach's tavern markers all vanish from one turn (got ${JSON.stringify(many)})`);
  const cold = stripMarkers('The wind bites. [COLD_SCENE: BaseLevel=3] [COLD_WET: Target="Player" Status="soaked"] [TIME_ADVANCE: Hours=4 Reason="the pass"]');
  check(cold === 'The wind bites.', `Zach's cold markers vanish (got ${JSON.stringify(cold)})`);
  check(stripMarkers(undefined) === undefined && stripMarkers('') === '' && stripMarkers(null) === null, 'non-strings and empty text pass through untouched');
}

// ===========================================================================
group('(c) regression: the old hand list\'s markers are still removed');
{
  const OLD = ['MERCHANT_SHOP', 'MERCHANT_REFER', 'ADD_ITEM', 'LOOT_DROP', 'COMBAT_START', 'COMBAT_END', 'REST', 'TIME_ADVANCE', 'HP_CHANGE',
    'CONDITION_ADD', 'CONDITION_REMOVE', 'WEATHER_CHANGE', 'SHELTER_FOUND', 'SWIM', 'EAT', 'DRINK', 'FORAGE', 'RECIPE_FOUND',
    'MATERIAL_FOUND', 'CRAFT_PROGRESS', 'RECIPE_GIFT', 'MYTHIC_TRIAL', 'PIETY_CHANGE', 'ITEM_AWAKEN', 'MYTHIC_SURGE', 'PROMISE_MADE', 'PROMISE_FULFILLED'];
  check(OLD.length === 27 && OLD.every((k) => KEYS.includes(k)), 'the 27 schema markers of the old 28-line list are all schemas');
  for (const k of OLD) check(stripMarkers(`a [${k}: x=1] b`) === 'a b', `${k} still stripped`);
  check(stripMarkers('Old. [COMBAT_END] New.') === 'Old. New.' && stripMarkers('[REST] Morning.') === 'Morning.', 'bare COMBAT_END and REST still stripped');
  // SKILL_CHECK was the 28th line: not a schema, never taught, never
  // handled anywhere — a dead legacy name. Registry-only means it stays.
  check(!KEYS.includes('SKILL_CHECK'), 'SKILL_CHECK is not a schema');
  check(stripMarkers('x [SKILL_CHECK: Skill="Athletics"] y').includes('[SKILL_CHECK'), 'SKILL_CHECK is no longer stripped (decision recorded in the report)');
}

// ===========================================================================
group('(d) fences: bracketed prose that is not a schema marker survives');
{
  const ooc = 'She looks at the road ahead. [OOC: Would you like to formally recruit Mira as a companion?]';
  check(stripMarkers(ooc) === ooc, 'the taught [OOC: …] recruitment question survives');
  for (const keep of ['[COMBAT_STARTED: x]', '[SET_ROOMS: x]', '[HP: 5]', '[a scrawled note]', '[Thorne nods]', '[REDACTED]', '[ATTACKS: 2]']) {
    check(stripMarkers(`a ${keep} b`) === `a ${keep} b`, `non-marker bracket survives: ${keep}`);
  }
}

// ===========================================================================
group('(e) the turn route: one generated strip, at the same point, effects still apply');
{
  const src = fs.readFileSync(new URL('../server/routes/dmSession.js', import.meta.url), 'utf8');
  check(!/cleanNarrative = cleanNarrative\.replace\(\/\\\[/.test(src), 'the hand-kept strip lines are gone from dmSession.js');
  const iDispatch = src.indexOf('pipelineResult = await processResponseMarkers(');
  const iStrip = src.indexOf('let cleanNarrative = stripMarkers(result.narrative);');
  const iReconcile = src.indexOf('await reconcileTurn(cleanNarrative');
  check(iDispatch > 0 && iStrip > iDispatch && iReconcile > iStrip, 'order: the engine reads the markers, then the strip, then reconcileTurn');

  const llm = installLlmStub({ strict: false, fallback: 'The scene continues.' });
  const server = await startTurnServer();
  let fx = null;
  try {
    fx = await seedTurnFixture(dbRun, { prefix: 'TEST_STRIP' });
    llm.reply('The wind rises off the ice. [COLD_SCENE: BaseLevel=3] You trudge on. [TIME_ADVANCE: Hours=2 Reason="the frozen pass"] [COLD_WET: Target="Player" Status="soaked"] Your boots are full of meltwater.');
    const res = await server.post(`/api/dm-session/${fx.sessionId}/message`, { action: 'I march north into the frozen pass.' });
    check(res.status === 200, `the turn runs (got ${res.status})`);
    const narrative = res.body?.narrative || '';
    check(!hasMarker(narrative), `the narrative the player receives has no marker (got ${JSON.stringify(narrative)})`);
    check(narrative.includes('The wind rises off the ice.') && narrative.includes('Your boots are full of meltwater.'), 'the prose itself is intact');
    const cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [fx.sessionId])).session_config || '{}');
    check(cfg.coldScene?.baseColdLevel === 3, 'COLD_SCENE still fired: the cold scene is stored');
    const ch = await dbGet('SELECT cold_wet_status FROM characters WHERE id = ?', [fx.characterId]);
    check(ch?.cold_wet_status === 'soaked', 'COLD_WET still fired: the player is soaked');
    const msgs = JSON.parse((await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [fx.sessionId])).messages);
    check(msgs.some((m) => m.role === 'assistant' && String(m.content).includes('[COLD_SCENE: BaseLevel=3]')), 'the stored history keeps the markers (unchanged)');

    // (f) reload: the display copy is clean, the raw history untouched.
    const got = await server.get(`/api/dm-session/${fx.sessionId}`);
    const display = got.body?.session?.display_messages || [];
    check(got.status === 200 && display.length > 0, 'GET session returns a display copy');
    check(display.every((m) => m.role !== 'system'), 'the display copy carries no system prompt');
    check(display.filter((m) => m.role === 'assistant').every((m) => !hasMarker(String(m.content))), 'reloaded DM turns show no markers');
    check((got.body?.session?.messages || []).some((m) => String(m.content).includes('[COLD_SCENE:')), 'session.messages (raw history) is unchanged');
  } finally {
    restoreLlm();
    await server.close();
    if (fx) await cleanupTurnFixture(dbRun, fx).catch(() => {});
  }
}

// ===========================================================================
group('(f) the session-start opening and the resume recap are stripped');
{
  const src = fs.readFileSync(new URL('../server/routes/dmSession.js', import.meta.url), 'utf8');
  check(src.includes('openingNarrative: stripMarkers(result.openingNarrative),'), 'the /start response strips the opening narrative');
  check(src.includes('recap: stripMarkers(recap),'), 'the /resume response strips the recap (also covers recaps saved earlier)');
  check(src.includes('recap = stripMarkers(recap);'), 'a newly generated recap is stripped before it is saved');
  const client = fs.readFileSync(new URL('../client/src/components/DMSession.jsx', import.meta.url), 'utf8');
  check(client.includes('(data.session.display_messages || data.session.messages)'), 'the client shows the stripped display copy on reload');
}

console.log(`\nmarker-strip: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
