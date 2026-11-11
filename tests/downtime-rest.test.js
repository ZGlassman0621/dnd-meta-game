/**
 * tests/downtime-rest.test.js — Job B (2026-11-08): downtime rests route
 * through the DM path (applyDowntimeRest) instead of the one-line
 * spell_slots_used = '{}' push in applyBenefits.
 *
 * Drives POST /api/downtime/complete/:id over real HTTP against a
 * throwaway DB (same pattern as rest-time.test.js), and asserts on
 * persisted state + the response: slots restored, the Arcane Recovery
 * used-flag cleared, banks untouched, warlock short rests, and the
 * interrupted case (no slots).
 *
 * Run: node tests/downtime-rest.test.js (via the run-*.mjs driver —
 * NEVER bare `node`, for the same TURSO redirect reason as
 * integration.test.js).
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-downtime-rest-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const downtimeRoutes = (await import(pathToFileURL(path.join(REPO, 'server', 'routes', 'downtime.js')).href)).default;

const app = express();
app.use(express.json());
app.use('/api/downtime', downtimeRoutes);
const server = await new Promise((resolve) => {
  const s = app.listen(0, () => resolve(s));
});
const BASE = `http://localhost:${server.address().port}`;

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

async function api(method, path, body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  let json;
  try { json = await res.json(); } catch { json = null; }
  return { status: res.status, body: json };
}

async function seedCharacter({ name, cls = 'Wizard', level = 5, classLevels = null, usedSlots = { '1': 2 }, bookJson = null, hp = 10, location = 'The Sleeping Dragon tavern', diceUsed = { d6: 3 } }) {
  return insertRow('characters', {
    name, class: cls, level,
    class_levels: JSON.stringify(classLevels || [{ class: cls.toLowerCase(), level }]),
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }),
    current_hp: hp, max_hp: 20, temp_hp: 4,
    current_location: location, inventory: '[]',
    hit_dice: JSON.stringify({ d6: 5 }), hit_dice_used: JSON.stringify(diceUsed),
    spell_slots_used: JSON.stringify(usedSlots),
    spellbook_json: bookJson ?? JSON.stringify({ status: 'intact', arcaneRecoveryUsed: true }),
  });
}

async function seedDowntime(characterId, { restType = 'long', endTime = new Date(Date.now() - 1000).toISOString() } = {}) {
  return insertRow('downtime', {
    character_id: characterId, activity_type: 'rest', rest_type: restType,
    duration_hours: restType === 'long' ? 8 : 1,
    start_time: new Date(Date.now() - 3600 * 1000).toISOString(), end_time: endTime,
  });
}

const readChar = async (id) => dbGet('SELECT current_hp, temp_hp, spell_slots_used, hit_dice_used, spellbook_json FROM characters WHERE id = ?', [id]);
const flagOf = async (id) => JSON.parse((await readChar(id)).spellbook_json || '{}').arcaneRecoveryUsed === true;

// ---------------------------------------------------------------------------
group('1. Long rest over HTTP — slots back, Arcane flag cleared, HP quality-scaled');
{
  const wizId = await seedCharacter({
    name: 'HttpWiz',
    bookJson: JSON.stringify({
      status: 'intact', arcaneRecoveryUsed: true,
      pendingArcaneRecovery: { slots: [1] },
      pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' },
    }),
  });
  const downId = await seedDowntime(wizId, { restType: 'long' });
  const res = await api('POST', `/api/downtime/complete/${downId}`);
  assert(res.status === 200, `complete returns 200 (got ${res.status})`);
  assert(res.body.benefits?.longRest === true, 'benefits report a long rest');
  assert(res.body.benefits?.spellSlotsRestored === true, 'benefits report spellSlotsRestored');
  assert(res.body.character?.spell_slots_used === '{}', 'response character has all slots restored');
  const after = await readChar(wizId);
  assert(after.spell_slots_used === '{}', 'slots restored in the DB');
  assert(after.current_hp === 20, 'tavern (adequate) long rest heals to full HP');
  assert(after.temp_hp === 0, 'temp HP cleared by the downtime long rest');
  assert(JSON.parse(after.hit_dice_used).d6 === 1, 'hit dice regained in the DB (3 spent -> 1)');
  assert(await flagOf(wizId) === false, 'the Arcane used-flag is cleared — the lockout bug is fixed');
  const book = JSON.parse(after.spellbook_json || '{}');
  assert(JSON.stringify(book.pendingArcaneRecovery) === JSON.stringify({ slots: [1] }),
    'the Arcane BANK survives completion (waits for the next DM short rest)');
  assert(JSON.stringify(book.pendingMemorizeSwap) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'the Memorize BANK survives completion too');
  assert((await dbGet('SELECT status FROM downtime WHERE id = ?', [downId])).status === 'completed',
    'the downtime row is marked completed');
}

// ---------------------------------------------------------------------------
group('2. Warlock short rest over HTTP — pact slots back, no real dice spent');
{
  const lockId = await seedCharacter({
    name: 'HttpLock', cls: 'Warlock', level: 3,
    classLevels: [{ class: 'warlock', level: 3 }],
    usedSlots: { '2': 1 }, bookJson: '{}', hp: 20, diceUsed: { d8: 1 },
  });
  const downId = await seedDowntime(lockId, { restType: 'short' });
  const res = await api('POST', `/api/downtime/complete/${downId}`);
  assert(res.status === 200, `complete returns 200 (got ${res.status})`);
  assert(res.body.benefits?.shortRest === true, 'benefits report a short rest');
  assert(res.body.benefits?.spellSlotsRestored === true, 'benefits report spellSlotsRestored for a warlock short rest');
  const after = await readChar(lockId);
  assert(after.spell_slots_used === '{}', 'warlock pact slots restored in the DB');
  assert(JSON.stringify(JSON.parse(after.hit_dice_used)) === JSON.stringify({ d8: 1 }),
    'no real hit dice spent by a downtime short rest');
  assert(after.current_hp === 20, 'HP untouched (already full; the simulated heal adds nothing)');
}

// ---------------------------------------------------------------------------
group('3. Non-warlock short rest over HTTP — no slots');
{
  const fightId = await seedCharacter({
    name: 'HttpFight', cls: 'Fighter', level: 5,
    classLevels: [{ class: 'fighter', level: 5 }],
    usedSlots: { '1': 1 }, bookJson: '{}', hp: 20,
  });
  const downId = await seedDowntime(fightId, { restType: 'short' });
  const res = await api('POST', `/api/downtime/complete/${downId}`);
  assert(res.status === 200, `complete returns 200 (got ${res.status})`);
  assert(res.body.benefits?.spellSlotsRestored !== true, 'no spellSlotsRestored for a non-warlock short rest');
  assert(JSON.stringify(JSON.parse((await readChar(fightId)).spell_slots_used)) === JSON.stringify({ '1': 1 }),
    'non-warlock slots stay spent in the DB');
}

// ---------------------------------------------------------------------------
group('4. Interrupted rest (terrible quality) — no slots, flag stays set');
{
  // Terrible quality interrupts 40% of the time; pin the dice so the
  // branch is deterministic (Math.random -> 0.05 < 0.4, damage 1).
  const wizId = await seedCharacter({ name: 'HttpInterrupted', location: 'a dark dungeon' });
  const downId = await seedDowntime(wizId, { restType: 'long' });
  const realRandom = Math.random;
  Math.random = () => 0.05;
  let res;
  try {
    res = await api('POST', `/api/downtime/complete/${downId}`);
  } finally {
    Math.random = realRandom;
  }
  assert(res.status === 200, `complete returns 200 (got ${res.status})`);
  assert(res.body.benefits?.restInterrupted === true, 'benefits report the rest interrupted');
  assert(res.body.benefits?.spellSlotsRestored !== true, 'an interrupted rest restores no slots');
  const after = await readChar(wizId);
  assert(JSON.stringify(JSON.parse(after.spell_slots_used)) === JSON.stringify({ '1': 2 }),
    'interrupted rest leaves slots spent in the DB');
  assert(after.current_hp === 9, 'interrupted rest deals 1 damage (10 -> 9)');
  assert(await flagOf(wizId) === true, 'the Arcane flag stays set after an interrupted rest');
}

// ---------------------------------------------------------------------------
group('5. Completion gates — unknown id 404, not-yet-complete 400');
{
  const gone = await api('POST', '/api/downtime/complete/999999');
  assert(gone.status === 404, `unknown downtime returns 404 (got ${gone.status})`);
  const wizId = await seedCharacter({ name: 'HttpEarly' });
  const futureId = await seedDowntime(wizId, {
    restType: 'long', endTime: new Date(Date.now() + 3600 * 1000).toISOString(),
  });
  const early = await api('POST', `/api/downtime/complete/${futureId}`);
  assert(early.status === 400, `not-yet-complete returns 400 (got ${early.status})`);
  const earlyChar = await readChar(wizId);
  assert(earlyChar.spell_slots_used === JSON.stringify({ '1': 2 }),
    'a refused completion touches no slots');
  assert((await dbGet('SELECT status FROM downtime WHERE id = ?', [futureId])).status === 'active',
    'the refused downtime row stays active');
}

await new Promise((resolve) => server.close(resolve));
console.log(`\n downtime-rest: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
