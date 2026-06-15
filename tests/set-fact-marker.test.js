/**
 * Phase 2 — SET_FACT marker tests.
 * Run: node tests/set-fact-marker.test.js
 *
 * The DM emits [SET_FACT Subject="..." Field="..." Value="..."] to record
 * durable world/character state. It validates against the schema, is stripped
 * from player-facing prose, and (via factFlagService) writes a canon fact
 * through Phase 1's field-aware supersede: re-emitting the same
 * (Subject, Category, Field) UPDATES the value rather than appending.
 *
 * Coverage:
 *  (a) parse a valid SET_FACT and assert fields; missing Field or Value fails.
 *  (b) SET_FACT is stripped from player prose by stripKnownMarkers.
 *  (c) integration over the real /message handler (dmTestApp + mockAnthropic):
 *      a narrative with [SET_FACT ... Value="true"] creates a canon_facts row;
 *      a second turn with Value="false" OVERWRITES it (one active row, 'false').
 *
 * Uses TEST_-prefixed data against the real DB; cleaned up per run.
 */

import assert from 'node:assert/strict';
import {
  parseMarkerBody,
  stripKnownMarkers,
  MARKER_SCHEMAS
} from '../server/services/markerSchemas.js';
import { installMockAnthropic } from './helpers/mockAnthropic.js';
import { startTestApp, seedSession, cleanup } from './helpers/dmTestApp.js';
import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import { isClaudeAvailable } from '../server/services/claude.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}
function check(cond, msg) {
  if (cond) { console.log(`  ✓ ${msg}`); passed++; }
  else { console.log(`  ✗ FAIL: ${msg}`); failed++; }
}

// ---------------------------------------------------------------------------
// (a) Schema parsing
// ---------------------------------------------------------------------------

console.log('\n=== (a) SET_FACT schema parsing ===\n');

test('SET_FACT is registered in MARKER_SCHEMAS as an inline marker', () => {
  assert.ok(MARKER_SCHEMAS.SET_FACT, 'SET_FACT schema present');
  assert.equal(MARKER_SCHEMAS.SET_FACT.position, 'inline');
});

test('parses a valid SET_FACT and exposes all fields', () => {
  const body = 'Subject="player" Field="hates_boats" Value="true" Category="world_flag" Importance="major"';
  const r = parseMarkerBody(body, 'SET_FACT');
  assert.ok(r.ok, 'parse ok');
  assert.equal(r.data.Subject, 'player');
  assert.equal(r.data.Field, 'hates_boats');
  assert.equal(r.data.Value, 'true');
  assert.equal(r.data.Category, 'world_flag');
  assert.equal(r.data.Importance, 'major');
});

test('a minimal SET_FACT (no optional Category/Importance) parses ok', () => {
  const r = parseMarkerBody('Subject="gareth" Field="location" Value="Waterdeep"', 'SET_FACT');
  assert.ok(r.ok, 'parse ok');
  assert.equal(r.data.Subject, 'gareth');
  assert.equal(r.data.Field, 'location');
  assert.equal(r.data.Value, 'Waterdeep');
  assert.equal(r.data.Category, undefined);
});

test('SET_FACT missing required Field fails validation', () => {
  const r = parseMarkerBody('Subject="player" Value="true"', 'SET_FACT');
  assert.ok(!r.ok, 'parse fails');
  assert.ok(r.errors.some(e => e.field === 'Field'), 'Field flagged as missing');
});

test('SET_FACT missing required Value fails validation', () => {
  const r = parseMarkerBody('Subject="player" Field="hates_boats"', 'SET_FACT');
  assert.ok(!r.ok, 'parse fails');
  assert.ok(r.errors.some(e => e.field === 'Value'), 'Value flagged as missing');
});

test('SET_FACT with an out-of-enum Category fails validation', () => {
  const r = parseMarkerBody('Subject="x" Field="y" Value="z" Category="banana"', 'SET_FACT');
  assert.ok(!r.ok, 'parse fails');
  assert.ok(r.errors.some(e => e.field === 'Category'), 'Category enum violation flagged');
});

// ---------------------------------------------------------------------------
// (b) Stripped from player-facing prose
// ---------------------------------------------------------------------------

console.log('\n=== (b) SET_FACT stripped from player prose ===\n');

test('stripKnownMarkers removes a SET_FACT marker from narrative', () => {
  const narrative = 'You shudder at the gangplank. [SET_FACT Subject="player" Field="hates_boats" Value="true"] The dock creaks.';
  const cleaned = stripKnownMarkers(narrative);
  assert.ok(!cleaned.includes('SET_FACT'), 'marker text removed');
  assert.ok(cleaned.includes('You shudder at the gangplank.'), 'surrounding prose preserved');
  assert.ok(cleaned.includes('The dock creaks.'), 'trailing prose preserved');
});

test('stripKnownMarkers removes a colon-form SET_FACT too', () => {
  const cleaned = stripKnownMarkers('Pre [SET_FACT: Subject="x" Field="y" Value="z"] post');
  assert.ok(!cleaned.includes('SET_FACT'), 'colon-form marker removed');
  assert.ok(cleaned.includes('Pre') && cleaned.includes('post'), 'prose preserved');
});

// ---------------------------------------------------------------------------
// (c) Integration: real /message handler writes + overwrites a canon fact
// ---------------------------------------------------------------------------

async function integration() {
  console.log('\n=== (c) SET_FACT integration (turn → canon_facts → overwrite) ===\n');

  await initDatabase();

  const mock = installMockAnthropic({
    reply: (body, i) => {
      // Turn 0 sets Value="true"; turn 1 overwrites with Value="false".
      const value = i === 0 ? 'true' : 'false';
      return `The water churns and you grip the rail, knuckles white. ` +
        `[SET_FACT Subject="TEST_player" Field="hates_boats" Value="${value}"] ` +
        `The deck pitches beneath your boots and the gulls wheel overhead.`;
    }
  });

  // The /message handler gates on a real Claude provider (ANTHROPIC_API_KEY).
  // Without it the handler 503s before the marker pipeline runs — skip loudly.
  if (!isClaudeAvailable()) {
    mock.uninstall();
    console.log('\n' + '!'.repeat(64));
    console.log('!! INTEGRATION SKIPPED — ANTHROPIC_API_KEY not set (this is NOT a pass).');
    console.log('!! /message would 503 before the SET_FACT handler runs.');
    console.log('!'.repeat(64) + '\n');
    return;
  }

  let app;
  const characterIds = [];
  const sessionIds = [];
  let campaignId;
  try {
    app = await startTestApp();

    // Seed a real campaign so the character carries a non-null campaign_id —
    // recordCanonFact's field-aware supersede keys on (campaign_id, character_id,
    // subject, category, field), so a real campaign_id is needed for the
    // overwrite path to match the prior row.
    await dbRun(
      `INSERT INTO campaigns (name, description, setting, status)
       VALUES ('TEST_SetFact_Campaign', 'set-fact marker', 'Forgotten Realms', 'active')`
    );
    campaignId = (await dbGet("SELECT id FROM campaigns WHERE name = 'TEST_SetFact_Campaign'")).id;

    const charRes = await dbRun(
      `INSERT INTO characters
         (name, class, level, current_hp, max_hp, current_location,
          experience_to_next_level, experience, gold_cp, gold_sp, gold_gp, inventory,
          campaign_id, game_day)
       VALUES ('TEST_SetFact_Hero', 'Fighter', 5, 40, 40, 'TEST_Docks',
               14000, 0, 0, 0, 0, '[]', ?, 12)`,
      [campaignId]
    );
    const characterId = Number(charRes.lastInsertRowid);
    characterIds.push(characterId);

    const sessionId = await seedSession(characterId);
    sessionIds.push(sessionId);

    // --- Turn 1: Value="true" → one active canon fact ---
    const t1 = await app.request('POST', `/api/dm-session/${sessionId}/message`, { action: 'I step toward the gangplank.' });
    check(t1.status === 200, 'turn 1 handler returns 200');

    let active = await dbAll(
      `SELECT id, fact, field, value, is_active FROM (
         SELECT id, fact, field,
                (CASE WHEN instr(fact, ': ') > 0 THEN substr(fact, instr(fact, ': ') + 2) ELSE fact END) AS value,
                is_active
         FROM canon_facts
         WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_player'
           AND field = 'hates_boats' AND is_active = 1
       )`,
      [campaignId, characterId]
    );
    check(active.length === 1, `turn 1 created exactly one active canon fact (got ${active.length})`);
    check(active[0]?.value === 'true', `the active fact value is 'true' (got '${active[0]?.value}')`);

    // The handler also surfaces setFacts on the response payload.
    check(Array.isArray(t1.body?.setFacts) && t1.body.setFacts.length === 1,
      'turn 1 response surfaces a setFacts entry');
    check(t1.body?.setFacts?.[0]?.value === 'true', 'surfaced setFacts value is true');
    // The marker is stripped from the player-facing narrative.
    check(typeof t1.body?.narrative === 'string' && !t1.body.narrative.includes('SET_FACT'),
      'turn 1 narrative has the SET_FACT marker stripped');

    // --- Turn 2: Value="false" → OVERWRITES (still one active row, value 'false') ---
    const t2 = await app.request('POST', `/api/dm-session/${sessionId}/message`, { action: 'The boat lurches.' });
    check(t2.status === 200, 'turn 2 handler returns 200');

    active = await dbAll(
      `SELECT id,
              (CASE WHEN instr(fact, ': ') > 0 THEN substr(fact, instr(fact, ': ') + 2) ELSE fact END) AS value
       FROM canon_facts
       WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_player'
         AND field = 'hates_boats' AND is_active = 1`,
      [campaignId, characterId]
    );
    check(active.length === 1, `after turn 2 still exactly ONE active fact (overwritten, got ${active.length})`);
    check(active[0]?.value === 'false', `the surviving active fact holds the NEWEST value 'false' (got '${active[0]?.value}')`);

    // The prior row is retired (not deleted) — newest-wins supersede.
    const allRows = await dbAll(
      `SELECT id, is_active FROM canon_facts
       WHERE campaign_id = ? AND character_id = ? AND subject = 'TEST_player' AND field = 'hates_boats'`,
      [campaignId, characterId]
    );
    check(allRows.length === 2, `both writes exist as rows; the older is retired (got ${allRows.length} rows)`);
    check(allRows.filter(r => Number(r.is_active) === 1).length === 1, 'exactly one row remains active');

  } catch (err) {
    console.error('  ✗ FAIL: unexpected integration error');
    console.error('   ', err && err.stack ? err.stack : err);
    failed++;
  } finally {
    mock.uninstall();
    // Clean up canon facts first (cleanup() doesn't know about them).
    try {
      for (const id of characterIds) {
        await dbRun('DELETE FROM canon_facts WHERE character_id = ?', [id]);
      }
    } catch { /* best-effort */ }
    try { await cleanup({ characterIds, sessionIds }); } catch { /* best-effort */ }
    try {
      if (campaignId) await dbRun('DELETE FROM campaigns WHERE id = ?', [campaignId]);
    } catch { /* best-effort */ }
    if (app) { try { await app.close(); } catch { /* ignore */ } }
  }
}

await integration();

console.log(`\n${'='.repeat(50)}`);
console.log(`set-fact-marker: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed === 0 ? 0 : 1);
