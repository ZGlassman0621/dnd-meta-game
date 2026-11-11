/**
 * tests/rest-time.test.js — [REST] + [TIME_ADVANCE] (Phase 1, v1.0.188).
 *
 * Pins:
 *   - migration 082 spent-hit-dice columns;
 *   - hit-dice math: Dice= honored exactly, auto-spend stops at half HP,
 *     availability respected, long-rest regain = half total (min 1);
 *   - TIME_ADVANCE through the service: world clock moves, session
 *     elapsed accumulates, outcomes stash for next-turn injection;
 *   - rests through the service: long rest restores HP/slots/temp HP and
 *     regains dice for PC + companions; short rest heals only via dice,
 *     warlocks regain pact slots, wizards do not; named-actor scope;
 *     0-HP actors gain no benefit;
 *   - sessionEndDays: the measured replacement for the retired
 *     calculateGameTimeAdvance (whose absence is also pinned in source).
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-rest-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const rt = await import(svc('server/services/restTimeService.js'));
const sched = await import(svc('server/services/scheduleService.js'));
const harptos = await import(svc('server/config/harptos.js'));
const cond = await import(svc('server/services/conditionService.js'));

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

const absHours = (clock) => clock.day * 24 + clock.hour;

// The fallback (campaign-less) clock is this suite's clock. Make sure its
// row exists in the fresh DB, then anchor the session's start date to it.
const fbRow = await dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
if (!fbRow) {
  await dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
}
const startClock = await sched.getClock(null);

// ---------------------------------------------------------------------------
group('1. Migration 082 — spent-dice columns');
{
  const charCols = (await dbAll('PRAGMA table_info(characters)')).map(r => r.name);
  assert(charCols.includes('hit_dice_used'), 'characters has hit_dice_used');
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(r => r.name);
  assert(compCols.includes('companion_hit_dice_used'), 'companions has companion_hit_dice_used');
}

// ---------------------------------------------------------------------------
group('2. spendHitDice — the dice policy (Zach: Dice= or auto-to-half)');
{
  // Explicit count: exactly 2 dice, each roll in range, healing = Σ(roll+CON) capped.
  const s = rt.spendHitDice({ pool: { d10: 3 }, used: {}, conMod: 2, currentHp: 8, maxHp: 30, diceCount: 2 });
  assert(rt.totalDice(s.spent) === 2 && s.rolls.length === 2, 'Dice=2 spends exactly 2 dice');
  assert(s.rolls.every(r => r.roll >= 1 && r.roll <= 10), 'hit-die rolls are real d10s');
  assert(s.healed >= 6 && s.newHp === 8 + s.healed && s.newHp <= 30, 'healing is roll+CON, capped at max HP');

  // Auto: from 8/30 (half = 15) with d10+2 (min +3/die), HP must reach ≥15
  // within the 3 available dice, and spending stops there.
  const a = rt.spendHitDice({ pool: { d10: 3 }, used: {}, conMod: 2, currentHp: 8, maxHp: 30, diceCount: null });
  assert(a.newHp >= 15, 'auto-spend reaches half HP');
  assert(rt.totalDice(a.spent) >= 1 && rt.totalDice(a.spent) <= 3, 'auto-spend uses only what it needs');

  // Already at half: auto spends nothing. At full: explicit spends nothing.
  const half = rt.spendHitDice({ pool: { d8: 2 }, used: {}, conMod: 1, currentHp: 10, maxHp: 20, diceCount: null });
  assert(rt.totalDice(half.spent) === 0 && half.healed === 0, 'auto spends nothing at half HP');
  const full = rt.spendHitDice({ pool: { d8: 2 }, used: {}, conMod: 1, currentHp: 20, maxHp: 20, diceCount: 2 });
  assert(rt.totalDice(full.spent) === 0, 'no dice spent at full HP');

  // Spent dice are gone: pool 2, used 2 → nothing to spend.
  const none = rt.spendHitDice({ pool: { d8: 2 }, used: { d8: 2 }, conMod: 1, currentHp: 5, maxHp: 20, diceCount: 2 });
  assert(rt.totalDice(none.spent) === 0 && none.healed === 0, 'exhausted pool spends nothing');

  // Dice=0 is a real instruction: rest without healing.
  const zero = rt.spendHitDice({ pool: { d8: 2 }, used: {}, conMod: 1, currentHp: 5, maxHp: 20, diceCount: 0 });
  assert(rt.totalDice(zero.spent) === 0, 'Dice=0 spends nothing');
}

// ---------------------------------------------------------------------------
group('3. hitDiceRegain — long rest returns half the pool (min 1)');
{
  const r1 = rt.hitDiceRegain({ d8: 5 }, { d8: 4 });
  assert(r1.d8 === 2, 'pool 5, spent 4 → regain 2, 2 still spent');
  const r2 = rt.hitDiceRegain({ d6: 1 }, { d6: 1 });
  assert(Object.keys(r2).length === 0, 'pool 1 → regain the minimum 1');
  const r3 = rt.hitDiceRegain({}, { d8: 2 });
  assert(r3.d8 === 2, 'no pool → nothing regained, nothing invented');
  const r4 = rt.hitDiceRegain({ d10: 4, d8: 2 }, { d10: 3, d8: 1 });
  assert(rt.totalDice(r4) === 1, 'pool 6 → regain 3 of 4 spent (largest dice first)');
}

// ---------------------------------------------------------------------------
group('4. sessionEndDays — measured time, the heuristic replacement');
{
  assert(rt.sessionEndDays({ startDay: 100, startYear: 1492, clockDayOfYear: 103, clockYear: 1492 }) === 3, 'clock delta of 3 days');
  assert(rt.sessionEndDays({ startDay: 100, startYear: 1492, clockDayOfYear: 100, clockYear: 1492 }) === 0, 'no time marked → 0 days');
  assert(rt.sessionEndDays({ flashback: true, elapsedHours: 30 }) === 2, 'flashback: 30h → 2 days');
  assert(rt.sessionEndDays({ flashback: true, elapsedHours: 0 }) === 1, 'flashback floor is 1 (legacy minimum)');
  assert(rt.sessionEndDays({ startDay: 360, startYear: 1492, clockDayOfYear: 5, clockYear: 1493 }) === (harptos.getDaysInYear(1492) - 360) + 5, 'year rollover delta (leap-aware: 1492 has 366 days)');
}

// ---------------------------------------------------------------------------
group('5. TIME_ADVANCE — clock moves, elapsed accumulates, outcome stashes');
let pcId, sessionId;
{
  pcId = await insertRow('characters', {
    name: 'Garrick', class: 'Fighter', level: 5,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 11, cha: 8 }),
    current_hp: 30, max_hp: 30
  });
  sessionId = await insertRow('dm_sessions', {
    character_id: pcId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year
  });

  const before = await sched.getClock(null);
  const evt = await rt.advanceTimeForSession({ sessionId, characterId: pcId, hours: 6, reason: 'the road north' });
  const after = await sched.getClock(null);
  assert(absHours(after) - absHours(before) === 6, 'world clock advanced exactly 6 hours');
  assert(evt.kind === 'time' && evt.clock.hour === after.hour, 'event carries the new clock');

  const cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config || '{}');
  assert(cfg.elapsedHours === 6, 'session elapsed accumulated 6h');
  assert(Array.isArray(cfg.recentTimeEvents) && cfg.recentTimeEvents.length === 1, 'outcome stashed for next-turn injection');
  assert(cfg.clockGapAtStart === 0, 'session recorded as present-day (not flashback)');

  await rt.advanceTimeForSession({ sessionId, characterId: pcId, hours: 20 });
  const cfg2 = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])).session_config || '{}');
  assert(cfg2.elapsedHours === 26, 'elapsed accumulates across advances (26h)');
  const block = rt.formatTimeEventBlock(evt);
  assert(block.includes('TIME PASSED') && block.includes('the road north'), 'outcome block narrates the fact');
}

// ---------------------------------------------------------------------------
group('6. Long rest — the whole party, fully restored, clock +8h');
{
  await dbRun('UPDATE characters SET current_hp = 10, temp_hp = 5, spell_slots_used = ?, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [JSON.stringify({ '1': 2 }), JSON.stringify({ d10: 4 }), JSON.stringify({ d10: 3 }), pcId]);
  const lyraNpcId = await insertRow('npcs', { name: 'Lyra' });
  const lyraId = await insertRow('companions', {
    npc_id: lyraNpcId, recruited_by_character_id: pcId, status: 'active',
    companion_class: 'Ranger', companion_level: 3,
    companion_current_hp: 5, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 12, dex: 17, con: 13, int: 10, wis: 15, cha: 8 }),
    companion_spell_slots_used: JSON.stringify({ '1': 1 }),
    companion_hit_dice: JSON.stringify({ d8: 3 }), companion_hit_dice_used: JSON.stringify({ d8: 2 })
  });

  const before = await sched.getClock(null);
  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'long' });
  const after = await sched.getClock(null);
  assert(r.success === true && r.event.results.length === 2, 'party long rest: PC + companion results');
  assert(absHours(after) - absHours(before) === 8, 'long rest advanced the clock 8 hours');

  const pc = await dbGet('SELECT current_hp, temp_hp, spell_slots_used, hit_dice_used FROM characters WHERE id = ?', [pcId]);
  assert(pc.current_hp === 30 && pc.temp_hp === 0, 'PC: HP full, temp HP cleared');
  assert(pc.spell_slots_used === '{}', 'PC: spell slots restored');
  assert(JSON.parse(pc.hit_dice_used).d10 === 1, 'PC: regained 2 of 3 spent dice (half of pool 4)');

  const comp = await dbGet('SELECT companion_current_hp, companion_spell_slots_used, companion_hit_dice_used FROM companions WHERE id = ?', [lyraId]);
  assert(comp.companion_current_hp === 20 && comp.companion_spell_slots_used === '{}', 'companion: HP full, slots restored');
  assert(JSON.parse(comp.companion_hit_dice_used).d8 === 1, 'companion: regained 1 spent die (half of pool 3, min 1)');
  assert(rt.formatTimeEventBlock(r.event).includes('LONG REST'), 'outcome block is a LONG REST fact');
}

// ---------------------------------------------------------------------------
group('7. Short rest — dice healing, pact magic, actor scope');
{
  // Fighter with Dice=2: spends exactly 2, heals at least 2×(1+CON 3).
  await dbRun('UPDATE characters SET current_hp = 8, spell_slots_used = ?, hit_dice_used = ? WHERE id = ?',
    [JSON.stringify({ '1': 1 }), '{}', pcId]);
  const before = await sched.getClock(null);
  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', dice: 2 });
  const after = await sched.getClock(null);
  const pc = await dbGet('SELECT current_hp, spell_slots_used, hit_dice_used FROM characters WHERE id = ?', [pcId]);
  assert(rt.totalDice(JSON.parse(pc.hit_dice_used)) === 2, 'Dice=2 → exactly 2 dice spent');
  assert(pc.current_hp >= 16 && pc.current_hp <= 30, 'healed by the rolled dice + CON');
  assert(pc.spell_slots_used !== '{}', 'fighter slots do NOT return on a short rest');
  assert(absHours(after) - absHours(before) === 1, 'short rest advanced the clock 1 hour');

  // Warlock companion resting alone: pact slots return; the PC is untouched.
  const vexNpcId = await insertRow('npcs', { name: 'Vex' });
  const vexId = await insertRow('companions', {
    npc_id: vexNpcId, recruited_by_character_id: pcId, status: 'active',
    companion_class: 'Warlock', companion_level: 3,
    companion_current_hp: 18, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 17 }),
    companion_spell_slots_used: JSON.stringify({ '2': 1 }),
    companion_hit_dice: JSON.stringify({ d8: 3 }), companion_hit_dice_used: '{}'
  });
  const pcHpBefore = (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId])).current_hp;
  const solo = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'Vex' });
  assert(solo.success === true && solo.event.results.length === 1, 'named actor rests alone');
  const vex = await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [vexId]);
  assert(vex.companion_spell_slots_used === '{}', 'warlock pact slots restored on a short rest');
  assert((await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId])).current_hp === pcHpBefore, 'PC untouched by a companion-only rest');

  // Scoped pact reset (2026-11-08 follow-ups, D2): a warlock
  // companion's pact slots return, but a spent slot at another
  // level — the shared map's stand-in for a non-pact slot — stays
  // spent. Warlock 3 / wizard 3 (companion_class_levels), pact 2x
  // L2, spent {1: 1, 2: 2}.
  const multiNpcId = await insertRow('npcs', { name: 'Multi' });
  const multiId = await insertRow('companions', {
    npc_id: multiNpcId, recruited_by_character_id: pcId, status: 'active',
    companion_class: 'Warlock', companion_level: 6,
    companion_class_levels: JSON.stringify([{ class: 'warlock', level: 3 }, { class: 'wizard', level: 3 }]),
    companion_current_hp: 18, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 8, dex: 14, con: 12, int: 10, wis: 10, cha: 17 }),
    companion_spell_slots_used: JSON.stringify({ '1': 1, '2': 2 }),
    companion_hit_dice: JSON.stringify({ d8: 3 }), companion_hit_dice_used: '{}'
  });
  const multiSolo = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'Multi' });
  const multiDetail = multiSolo.event.results.find((x) => x.kind === 'companion');
  assert(multiDetail?.slotsRestored === true, 'a multiclass warlock companion still restores pact slots');
  assert(JSON.stringify(JSON.parse((await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [multiId])).companion_spell_slots_used)) === JSON.stringify({ '1': 1 }),
    'the scoped reset returns the 2nd-level pact slots and leaves the 1st-level slot spent');

  const bogus = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'Nobody' });
  assert(bogus.success === false, 'unknown rest actor fails cleanly');

  // A companion at 0 HP gains no benefit from a long rest.
  await dbRun('UPDATE companions SET companion_current_hp = 0 WHERE id = ?', [vexId]);
  const down = await rt.applyRest({ sessionId, characterId: pcId, type: 'long', actor: 'Vex' });
  const vexAfter = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [vexId]);
  assert(down.event.results[0].rested === false && vexAfter.companion_current_hp === 0, '0-HP actor: no rest benefit');
}

// ---------------------------------------------------------------------------
group('9. Long rest — mythic power + exhaustion (rest consolidation, 2026-11-07)');
{
  // The deleted sheet route reset mythic power on long rest and the DM
  // path did not; the DM long rest must now restore everything the
  // button used to restore (full HP, slots, mythic) PLUS what only
  // the DM path does (hit-dice regain, exhaustion -1).
  const mythId = await insertRow('characters', {
    name: 'Mythic', class: 'Fighter', level: 5,
    ability_scores: JSON.stringify({ str: 16, dex: 12, con: 16, int: 10, wis: 11, cha: 8 }),
    current_hp: 10, max_hp: 30
  });
  await dbRun('UPDATE characters SET temp_hp = 5, spell_slots_used = ?, hit_dice = ?, hit_dice_used = ? WHERE id = ?',
    [JSON.stringify({ '1': 2 }), JSON.stringify({ d10: 4 }), JSON.stringify({ d10: 3 }), mythId]);
  await dbRun('INSERT INTO mythic_characters (character_id, mythic_power_max, mythic_power_used) VALUES (?, 3, 2)', [mythId]);
  const added = await cond.addCondition('player', mythId, 'exhaustion_2');
  assert(added.success === true, 'exhaustion_2 seeds via the real condition service');
  const mythSession = await insertRow('dm_sessions', {
    character_id: mythId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year
  });

  const r = await rt.applyRest({ sessionId: mythSession, characterId: mythId, type: 'long' });
  assert(r.success === true, 'DM long rest succeeds');
  const pc = await dbGet('SELECT current_hp, temp_hp, spell_slots_used, hit_dice_used, active_conditions FROM characters WHERE id = ?', [mythId]);
  assert(pc.current_hp === 30 && pc.temp_hp === 0, 'PC: HP full, temp HP cleared');
  assert(pc.spell_slots_used === '{}', 'PC: spell slots restored');
  assert(JSON.parse(pc.hit_dice_used).d10 === 1, 'PC: regained 2 of 3 spent dice (half of pool 4)');
  const myth = await dbGet('SELECT mythic_power_used FROM mythic_characters WHERE character_id = ?', [mythId]);
  assert(myth.mythic_power_used === 0, 'PC: mythic power reset to 0 (was 2)');
  assert(JSON.stringify(JSON.parse(pc.active_conditions || '[]')) === JSON.stringify(['exhaustion_1']),
    'PC: exhaustion stepped down 2 -> 1');
  const detail = r.event.results.find((x) => x.kind === 'pc');
  assert(detail?.mythicPowerReset === true, 'event detail flags the mythic reset');
  assert(detail?.exhaustionAfter === 1, 'event detail records exhaustion after');
  const block = rt.formatTimeEventBlock(r.event);
  assert(block.includes('Mythic power restored.'), 'outcome block narrates the mythic reset');
  assert(block.includes('Exhaustion reduced to level 1.'), 'outcome block narrates the exhaustion step-down');
}

// ---------------------------------------------------------------------------
group('10. Memorize Swap — banked consume at the service level');
{
  const BOOK10 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball'];
  const PREP8 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall'];
  async function wizRow(name, { hp = 10, bookJson = null } = {}) {
    const id = await insertRow('characters', {
      name, class: 'Wizard', level: 5,
      class_levels: JSON.stringify([{ class: 'wizard', level: 5 }]),
      ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }),
      current_hp: hp, max_hp: 20,
      hit_dice: JSON.stringify({ d6: 5 }), hit_dice_used: '{}',
      spell_slots_used: '{}',
      known_spells: JSON.stringify(BOOK10),
      prepared_spells: JSON.stringify(PREP8),
      spellbook_json: bookJson ?? JSON.stringify({ status: 'intact', pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' } }),
    });
    return id;
  }
  async function wizSession(charId) {
    return insertRow('dm_sessions', {
      character_id: charId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year
    });
  }
  const readWiz = async (id) => dbGet('SELECT current_hp, prepared_spells, spellbook_json, hit_dice_used FROM characters WHERE id = ?', [id]);
  const bankOf = async (id) => {
    const row = await readWiz(id);
    return JSON.parse(row.spellbook_json || '{}').pendingMemorizeSwap ?? null;
  };

  // Happy path: banked swap applies with the HP write, bank clears.
  const wizId = await wizRow('WizBank');
  const wizSessionId = await wizSession(wizId);
  const r = await rt.applyRest({ sessionId: wizSessionId, characterId: wizId, type: 'short', dice: 2 });
  const wizDetail = r.event.results.find((x) => x.kind === 'pc');
  assert(wizDetail?.memorizeSwap?.applied === true, 'banked swap applies on the DM short rest');
  const wizAfter = await readWiz(wizId);
  const wizPrep = JSON.parse(wizAfter.prepared_spells);
  assert(wizPrep.includes('Misty Step') && !wizPrep.includes('Sleep'), 'prepared list swapped Sleep -> Misty Step');
  assert(await bankOf(wizId) === null, 'bank cleared after the applying rest');
  assert(wizAfter.current_hp > 10, 'the rest still healed via hit dice');
  assert(JSON.parse(wizAfter.spellbook_json).status === 'intact', 'consume keeps the book intact');

  // Lost book at rest time: refused, bank cleared, rest still heals.
  const lostId = await wizRow('WizBankLost', { bookJson: JSON.stringify({ status: 'lost', pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' } }) });
  const lostSession = await wizSession(lostId);
  const lostRest = await rt.applyRest({ sessionId: lostSession, characterId: lostId, type: 'short', dice: 2 });
  const lostDetail = lostRest.event.results.find((x) => x.kind === 'pc')?.memorizeSwap;
  assert(lostDetail?.applied === false && String(lostDetail?.reason).includes('lost'), 'lost book refuses the banked swap at rest time');
  assert(await bankOf(lostId) === null, 'lost-book refusal still clears the bank');
  assert((await readWiz(lostId)).current_hp > 10, 'lost-book refusal leaves the rest healing');
  assert(JSON.stringify(JSON.parse((await readWiz(lostId)).prepared_spells)) === JSON.stringify(PREP8), 'lost-book refusal leaves the prepared list');

  // 0 HP: no benefit at all, and the bank survives (the rest never happened).
  const downId = await wizRow('WizBankDown', { hp: 0 });
  const downSession = await wizSession(downId);
  const downRest = await rt.applyRest({ sessionId: downSession, characterId: downId, type: 'short', dice: 2 });
  assert(downRest.event.results.find((x) => x.kind === 'pc')?.rested === false, '0-HP wizard gains no rest benefit');
  assert(JSON.stringify(await bankOf(downId)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'a rest that never happened leaves the bank for later');
  assert((await readWiz(downId)).current_hp === 0, '0-HP wizard stays at 0');

  // Companion-only rest: the PC is not rested, the bank is untouched.
  const soloId = await wizRow('WizBankSolo');
  const soloNpc = await insertRow('npcs', { name: 'SoloComp' });
  await insertRow('companions', {
    npc_id: soloNpc, recruited_by_character_id: soloId, status: 'active',
    companion_class: 'Ranger', companion_level: 3,
    companion_current_hp: 5, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 12, dex: 17, con: 13, int: 10, wis: 15, cha: 8 }),
    companion_spell_slots_used: '{}',
    companion_hit_dice: JSON.stringify({ d8: 3 }), companion_hit_dice_used: '{}'
  });
  const soloSession = await wizSession(soloId);
  const soloRest = await rt.applyRest({ sessionId: soloSession, characterId: soloId, type: 'short', actor: 'SoloComp' });
  assert(soloRest.event.results.length === 1 && soloRest.event.results[0].kind === 'companion', 'companion-only rest rests only the companion');
  assert(JSON.stringify(await bankOf(soloId)) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'a companion-only rest leaves the PC bank for the next PC short rest');
  assert((await readWiz(soloId)).current_hp === 10, 'the PC is untouched by a companion-only rest');
}

// ---------------------------------------------------------------------------
group('11. Slot-restore inventory — the DM path is the only full restore for PCs');
{
  // (iv) The deleted sheet route was the only full slot reset in
  // character.js; the single-slot restore route stays (out of scope
  // — it restores ONE slot, and Arcane Recovery decided its fate in
  // 2026-11-08: the route STAYS, unused by Arcane Recovery, which
  // has its own validated bank + consume step in the DM short rest
  // instead — the route has no budget, no 6th+ exclusion, and no
  // once-per-long-rest tracking). Job B (2026-11-08) folded the last
  // two full resets into the DM path: the companion rest route is
  // DELETED (its condition clearing + death-save reset now live in
  // restCompanion's long branch — group 14 pins the behaviour) and
  // downtime slot restore is an entry point on the DM path
  // (applyDowntimeRest — group 15 pins it). If any count below
  // moves, the inventory changed: update this group AND the notes.
  const charSrc = fs.readFileSync(path.join(REPO, 'server', 'routes', 'character.js'), 'utf8');
  assert(!charSrc.includes("router.post('/rest/"), 'character.js: no /rest route remains');
  assert(!charSrc.includes("spell_slots_used = '{}'"), 'character.js: no full slot reset remains');
  assert((charSrc.match(/router\.post\('\/spell-slots\/:id\/restore'/g) || []).length === 1,
    'character.js: exactly one single-slot restore route (known, out of scope)');
  const compSrc = fs.readFileSync(path.join(REPO, 'server', 'routes', 'companion.js'), 'utf8');
  assert(!compSrc.includes("router.post('/:id/rest'"), 'companion.js: no /rest route remains (Job B deleted it)');
  assert((compSrc.match(/companion_spell_slots_used = '\{\}'/g) || []).length === 0,
    'companion.js: no full slot reset remains — the DM path owns companion rests now');
  const downSrc = fs.readFileSync(path.join(REPO, 'server', 'routes', 'downtime.js'), 'utf8');
  assert((downSrc.match(/spell_slots_used = '\{\}'/g) || []).length === 0,
    'downtime.js: no full slot reset remains — applyDowntimeRest owns it now');
  assert(downSrc.includes('applyDowntimeRest'), 'downtime.js: applyBenefits calls the DM-path entry point');
  const rtSrc = fs.readFileSync(path.join(REPO, 'server', 'services', 'restTimeService.js'), 'utf8');
  assert(rtSrc.includes('spell_slots_used = ?') && rtSrc.includes('resetMythicPower(pc.id)')
    && rtSrc.includes('pendingMemorizeSwap(pc.spellbook_json)'),
    'restTimeService.js: the DM path still owns the full slot reset + mythic reset + banked-swap consume');
  // Arcane Recovery (2026-11-08) landed: the consume step + the
  // used-flag are in the DM path now — group 13 pins the behaviour,
  // this group keeps the inventory counts above honest.
  assert(rtSrc.includes('pendingArcaneRecovery(pc.spellbook_json)') && rtSrc.includes('arcaneRecoveryUsed'),
    'restTimeService.js: the DM path owns the Arcane Recovery consume + used-flag');
}

// ---------------------------------------------------------------------------
group('12. Retirement — the heuristic is gone from source');
{
  const svcSrc = fs.readFileSync(path.join(REPO, 'server', 'services', 'dmSessionService.js'), 'utf8');
  assert(!/export function calculateGameTimeAdvance/.test(svcSrc), 'calculateGameTimeAdvance no longer exists');
  const schemaSrc = fs.readFileSync(path.join(REPO, 'server', 'services', 'markerSchemas.js'), 'utf8');
  assert(schemaSrc.includes('TIME_ADVANCE: {') && schemaSrc.includes('REST: {'), 'both markers have schemas (correction-loop coverage)');
}

// ---------------------------------------------------------------------------
group('13. Arcane Recovery — banked consume at the service level');
{
  const BOOK10 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall', 'Misty Step', 'Fireball'];
  const PREP8 = ['Magic Missile', 'Shield', 'Mage Armor', 'Sleep', 'Burning Hands', 'Thunderwave', 'Detect Magic', 'Feather Fall'];
  async function arcRow(name, { hp = 10, level = 5, cls = 'Wizard', classLevels = null, usedSlots = { '1': 2, '2': 1 }, bookJson = null } = {}) {
    const id = await insertRow('characters', {
      name, class: cls, level,
      class_levels: JSON.stringify(classLevels || [{ class: 'wizard', level }]),
      ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }),
      current_hp: hp, max_hp: 20,
      hit_dice: JSON.stringify({ d6: 5 }), hit_dice_used: '{}',
      spell_slots_used: JSON.stringify(usedSlots),
      known_spells: JSON.stringify(BOOK10),
      prepared_spells: JSON.stringify(PREP8),
      spellbook_json: bookJson ?? JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [2, 1] } }),
    });
    return id;
  }
  async function arcSession(charId) {
    return insertRow('dm_sessions', {
      character_id: charId, game_start_day: startClock.dayOfYear, game_start_year: startClock.year
    });
  }
  const readArc = async (id) => dbGet('SELECT current_hp, spell_slots_used, spellbook_json, hit_dice_used, prepared_spells FROM characters WHERE id = ?', [id]);
  const bankOf = async (id) => JSON.parse((await readArc(id)).spellbook_json || '{}').pendingArcaneRecovery ?? null;
  const flagOf = async (id) => JSON.parse((await readArc(id)).spellbook_json || '{}').arcaneRecoveryUsed === true;
  const usedOf = async (id) => JSON.parse((await readArc(id)).spell_slots_used || '{}');
  async function bankArc(id, slots) {
    const row = await readArc(id);
    const state = JSON.parse(row.spellbook_json || '{}');
    state.pendingArcaneRecovery = { slots };
    await dbRun('UPDATE characters SET spellbook_json = ? WHERE id = ?', [JSON.stringify(state), id]);
  }

  // Happy path: banked [2, 1] applies with the HP write, bank clears, flag sets.
  const wizId = await arcRow('ArcHappy');
  const wizSessionId = await arcSession(wizId);
  const r = await rt.applyRest({ sessionId: wizSessionId, characterId: wizId, type: 'short', dice: 2 });
  const wizDetail = r.event.results.find((x) => x.kind === 'pc');
  assert(wizDetail?.arcaneRecovery?.applied === true && JSON.stringify(wizDetail.arcaneRecovery.recovered) === JSON.stringify([2, 1]),
    'banked recovery applies on the DM short rest, reporting the recovered levels');
  assert(JSON.stringify(await usedOf(wizId)) === JSON.stringify({ '1': 1 }),
    'used slots drop from {1: 2, 2: 1} to {1: 1}');
  assert(await bankOf(wizId) === null, 'bank cleared after the applying rest');
  assert(await flagOf(wizId) === true, 'the used-flag is set after the recovery');
  assert((await readArc(wizId)).current_hp > 10, 'the rest still healed via hit dice');
  assert(rt.formatTimeEventBlock(r.event).includes('Arcane Recovery: restored slots of levels 2, 1'),
    'the outcome block narrates the recovery for the DM');

  // No bank: a wizard regains nothing on a short rest.
  const noBankId = await arcRow('ArcNoBank', { usedSlots: { '1': 1 }, bookJson: '{}' });
  const noBankSession = await arcSession(noBankId);
  const noBankRest = await rt.applyRest({ sessionId: noBankSession, characterId: noBankId, type: 'short', dice: 2 });
  assert(noBankRest.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery === undefined,
    'a short rest with no bank reports no recovery');
  assert(JSON.stringify(await usedOf(noBankId)) === JSON.stringify({ '1': 1 }),
    'a wizard without a bank regains no slots on a short rest');

  // Second short rest before a long rest: the flag refuses, the bank clears.
  await bankArc(wizId, [1]);
  const second = await rt.applyRest({ sessionId: wizSessionId, characterId: wizId, type: 'short', dice: 2 });
  const secondDetail = second.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery;
  assert(secondDetail?.applied === false && String(secondDetail?.reason).includes('already been used'),
    'a second short rest before a long rest refuses on the used-flag');
  assert(JSON.stringify(await usedOf(wizId)) === JSON.stringify({ '1': 1 }),
    'the refused second recovery leaves the used slots alone');
  assert(await bankOf(wizId) === null, 'the refused second bank is still cleared');
  assert(await flagOf(wizId) === true, 'the flag stays set after the refusal');

  // Long rest: clears the flag, does NOT consume the bank; the
  // recovery works again on the next short rest (slots re-spent
  // after the long rest, since it restored them all).
  await bankArc(wizId, [1]);
  const longRest = await rt.applyRest({ sessionId: wizSessionId, characterId: wizId, type: 'long' });
  const longDetail = longRest.event.results.find((x) => x.kind === 'pc');
  assert(longDetail?.arcaneRecoveryReset === true, 'a long rest reports the flag cleared');
  assert(await flagOf(wizId) === false, 'the used-flag is gone after the long rest');
  assert(JSON.stringify(await bankOf(wizId)) === JSON.stringify({ slots: [1] }),
    'a long rest does NOT consume the bank — it waits for the next short rest');
  assert(JSON.stringify(await usedOf(wizId)) === JSON.stringify({}),
    'the long rest restored every slot');
  assert(rt.formatTimeEventBlock(longRest.event).includes('Arcane Recovery refreshed.'),
    'the outcome block narrates the refresh for the DM');
  await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify({ '1': 1 }), wizId]);
  const again = await rt.applyRest({ sessionId: wizSessionId, characterId: wizId, type: 'short', dice: 2 });
  assert(again.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery?.applied === true,
    'after the long rest the recovery works again');
  assert(JSON.stringify(await usedOf(wizId)) === JSON.stringify({}), 'the re-applied recovery restored the slot');
  assert(await flagOf(wizId) === true, 'the flag is set again after the second recovery');

  // A long rest with no flag set reports no reset.
  const noFlagId = await arcRow('ArcLongNoFlag', { usedSlots: {}, bookJson: '{}' });
  const noFlagSession = await arcSession(noFlagId);
  const noFlagLong = await rt.applyRest({ sessionId: noFlagSession, characterId: noFlagId, type: 'long' });
  assert(noFlagLong.event.results.find((x) => x.kind === 'pc')?.arcaneRecoveryReset === undefined,
    'a long rest with no flag set reports no reset');

  // Multiclass: wizard levels ONLY — wizard 3 / fighter 5 has
  // budget 2 (ceil(3/2)), not 4 (ceil(8/2)).
  const multiId = await arcRow('ArcMulti', {
    level: 8, classLevels: [{ class: 'wizard', level: 3 }, { class: 'fighter', level: 5 }],
  });
  const multiSession = await arcSession(multiId);
  const multiRest = await rt.applyRest({ sessionId: multiSession, characterId: multiId, type: 'short', dice: 2 });
  const multiDetail = multiRest.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery;
  assert(multiDetail?.applied === false && String(multiDetail?.reason).includes('over the budget'),
    'wizard 3 / fighter 5 banking [2, 1] (total 3) refuses on the wizard-only budget of 2');
  assert(JSON.stringify(await usedOf(multiId)) === JSON.stringify({ '1': 2, '2': 1 }),
    'the over-budget refusal leaves the used slots alone');
  assert(await bankOf(multiId) === null, 'the over-budget bank is still cleared');
  await bankArc(multiId, [1, 1]);
  const multiAgain = await rt.applyRest({ sessionId: multiSession, characterId: multiId, type: 'short', dice: 2 });
  assert(multiAgain.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery?.applied === true,
    'the same wizard banking [1, 1] (total 2, within budget) applies');
  assert(JSON.stringify(await usedOf(multiId)) === JSON.stringify({ '2': 1 }),
    'two 1st-level slots came back, the 2nd-level slot stayed spent');

  // 6th+ refused at apply time (bank seeded directly — the route
  // would refuse it too, but the DM path must not trust the bank).
  const sixthId = await arcRow('ArcSixth', {
    level: 11, classLevels: [{ class: 'wizard', level: 11 }],
    usedSlots: { '6': 1 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [6] } }),
  });
  const sixthSession = await arcSession(sixthId);
  const sixthRest = await rt.applyRest({ sessionId: sixthSession, characterId: sixthId, type: 'short', dice: 2 });
  const sixthDetail = sixthRest.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery;
  assert(sixthDetail?.applied === false && String(sixthDetail?.reason).includes('6th level or higher'),
    'a banked 6th-level slot refuses at rest time');
  assert(JSON.stringify(await usedOf(sixthId)) === JSON.stringify({ '6': 1 }), 'the refused 6th-level slot stays spent');
  assert(await bankOf(sixthId) === null, 'the 6th-level bank is still cleared');

  // Over-budget refused at apply time.
  const overId = await arcRow('ArcOver', {
    usedSlots: { '3': 2 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [3, 3] } }),
  });
  const overSession = await arcSession(overId);
  const overRest = await rt.applyRest({ sessionId: overSession, characterId: overId, type: 'short', dice: 2 });
  const overDetail = overRest.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery;
  assert(overDetail?.applied === false && String(overDetail?.reason).includes('over the budget'),
    'banking [3, 3] (total 6) against a L5 budget of 3 refuses at rest time');
  assert(await bankOf(overId) === null, 'the over-budget bank is still cleared');

  // Unspent level refused at apply time.
  const unspentId = await arcRow('ArcUnspent', {
    usedSlots: { '1': 1 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [2] } }),
  });
  const unspentSession = await arcSession(unspentId);
  const unspentRest = await rt.applyRest({ sessionId: unspentSession, characterId: unspentId, type: 'short', dice: 2 });
  const unspentDetail = unspentRest.event.results.find((x) => x.kind === 'pc')?.arcaneRecovery;
  assert(unspentDetail?.applied === false && String(unspentDetail?.reason).includes('is spent'),
    'banking a level with nothing spent refuses at rest time');
  assert(JSON.stringify(await usedOf(unspentId)) === JSON.stringify({ '1': 1 }), 'the refused recovery leaves slots alone');

  // Warlock-primary wizard multiclass (2026-11-08 follow-ups,
  // D2 — the refusal is GONE): the pact reset is scoped to the pact
  // slots only, then the banked recovery applies to whatever wizard
  // slots remain spent — BOTH in the same UPDATE. Warlock 3 /
  // wizard 3, spent {1: 1, 2: 2}, banked [1]: the 2x L2 pact slots
  // return first, then the recovery restores the L1 wizard slot.
  const lockId = await arcRow('ArcWarlock', {
    level: 6, cls: 'Warlock',
    classLevels: [{ class: 'warlock', level: 3 }, { class: 'wizard', level: 3 }],
    usedSlots: { '1': 1, '2': 2 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [1] } }),
  });
  const lockSession = await arcSession(lockId);
  const lockRest = await rt.applyRest({ sessionId: lockSession, characterId: lockId, type: 'short', dice: 2 });
  const lockDetail = lockRest.event.results.find((x) => x.kind === 'pc');
  assert(lockDetail?.slotsRestored === true, 'the warlock pact reset still fires');
  assert(lockDetail?.arcaneRecovery?.applied === true && JSON.stringify(lockDetail.arcaneRecovery.recovered) === JSON.stringify([1]),
    'the banked recovery applies on the same short rest as the pact reset — no more warlock refusal');
  assert(JSON.stringify(await usedOf(lockId)) === JSON.stringify({}), 'pact slots back AND the banked wizard slot back — nothing left spent');
  assert(await bankOf(lockId) === null, 'the stacking bank is cleared');
  assert(await flagOf(lockId) === true, 'the flag sets for the stacking recovery');
  assert(rt.formatTimeEventBlock(lockRest.event).includes('Arcane Recovery: restored slots of levels 1'),
    'the outcome block narrates the stacking recovery');

  // Wizard-primary warlock (S2 — the pact reset fires regardless
  // of primary now): wizard 5 / warlock 3, spent {1: 1, 2: 2},
  // banked [1]. The 2x L2 pact slots return (they used to wait for
  // a long rest), then the recovery restores the L1 wizard slot.
  const wizLockId = await arcRow('ArcWizLock', {
    level: 8, cls: 'Wizard',
    classLevels: [{ class: 'wizard', level: 5 }, { class: 'warlock', level: 3 }],
    usedSlots: { '1': 1, '2': 2 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [1] } }),
  });
  const wizLockSession = await arcSession(wizLockId);
  const wizLockRest = await rt.applyRest({ sessionId: wizLockSession, characterId: wizLockId, type: 'short', dice: 2 });
  const wizLockDetail = wizLockRest.event.results.find((x) => x.kind === 'pc');
  assert(wizLockDetail?.slotsRestored === true, 'a wizard-primary warlock regains pact slots on a short rest too');
  assert(wizLockDetail?.arcaneRecovery?.applied === true,
    'the wizard-primary recovery applies alongside the pact reset');
  assert(JSON.stringify(await usedOf(wizLockId)) === JSON.stringify({}), 'both pools restored, neither clobbered');
  assert(await flagOf(wizLockId) === true, 'the flag sets for the wizard-primary stacking recovery');

  // S1 — the over-restore is fixed: a warlock 1 / wizard 19 no
  // longer gets every wizard spell slot back on a short rest. Pact
  // is 1x L1; the L2 + L5 wizard slots stay spent, only one L1
  // slot returns (it is the pact slot, by count).
  const s1Id = await arcRow('ArcS1', {
    level: 20, cls: 'Warlock',
    classLevels: [{ class: 'warlock', level: 1 }, { class: 'wizard', level: 19 }],
    usedSlots: { '1': 2, '2': 1, '5': 1 }, bookJson: '{}',
  });
  const s1Session = await arcSession(s1Id);
  const s1Rest = await rt.applyRest({ sessionId: s1Session, characterId: s1Id, type: 'short', dice: 2 });
  const s1Detail = s1Rest.event.results.find((x) => x.kind === 'pc');
  assert(s1Detail?.slotsRestored === true, 'the S1 short rest still reports pact slots restored');
  assert(JSON.stringify(await usedOf(s1Id)) === JSON.stringify({ '1': 1, '2': 1, '5': 1 }),
    'only the 1x L1 pact slot returns — the wizard slots stay spent (S1 fixed)');

  // Residual ambiguity, pinned not hidden (D2): where the pact slot
  // level coincides with a spent wizard slot level, the reset zeroes
  // the pact COUNT at that level and cannot tell them apart. Warlock
  // 3 / wizard 3, spent {2: 2} only, banked [2]: the pact reset
  // consumes both L2 slots, so the recovery finds nothing spent at
  // L2 and refuses — the bank clears, no flag sets. The split-map
  // runner-up (D3) is the only complete fix for this.
  const collideId = await arcRow('ArcCollide', {
    level: 6, cls: 'Warlock',
    classLevels: [{ class: 'warlock', level: 3 }, { class: 'wizard', level: 3 }],
    usedSlots: { '2': 2 }, bookJson: JSON.stringify({ status: 'intact', pendingArcaneRecovery: { slots: [2] } }),
  });
  const collideSession = await arcSession(collideId);
  const collideRest = await rt.applyRest({ sessionId: collideSession, characterId: collideId, type: 'short', dice: 2 });
  const collideDetail = collideRest.event.results.find((x) => x.kind === 'pc');
  assert(collideDetail?.slotsRestored === true, 'the collision short rest still reports pact slots restored');
  assert(JSON.stringify(await usedOf(collideId)) === JSON.stringify({}), 'the pact reset returned both L2 slots');
  assert(collideDetail?.arcaneRecovery?.applied === false && String(collideDetail?.arcaneRecovery?.reason).includes('is spent'),
    'the recovery refuses when the pact reset already consumed the level it banked (collision ambiguity, pinned)');
  assert(await bankOf(collideId) === null, 'the collision bank is still cleared');
  assert(await flagOf(collideId) === false, 'no flag is set for the collision refusal');

  // Memorize Swap + Arcane Recovery on the same short rest: BOTH apply.
  const bothId = await arcRow('ArcBoth', {
    usedSlots: { '1': 1 },
    bookJson: JSON.stringify({ status: 'intact', pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' }, pendingArcaneRecovery: { slots: [1] } }),
  });
  const bothSession = await arcSession(bothId);
  const bothRest = await rt.applyRest({ sessionId: bothSession, characterId: bothId, type: 'short', dice: 2 });
  const bothDetail = bothRest.event.results.find((x) => x.kind === 'pc');
  assert(bothDetail?.memorizeSwap?.applied === true && bothDetail?.arcaneRecovery?.applied === true,
    'both banks apply on the same short rest');
  const bothPrep = JSON.parse((await readArc(bothId)).prepared_spells);
  assert(bothPrep.includes('Misty Step') && !bothPrep.includes('Sleep'), 'the swap applied alongside the recovery');
  assert(JSON.stringify(await usedOf(bothId)) === JSON.stringify({}), 'the recovery applied alongside the swap');
  assert(await bankOf(bothId) === null, 'the Arcane bank cleared with the swap');
  assert(JSON.parse((await readArc(bothId)).spellbook_json || '{}').pendingMemorizeSwap === undefined,
    'the Memorize bank cleared with the recovery');
  assert(await flagOf(bothId) === true, 'the flag set with the swap');

  // One refused must not block the other: lost book refuses the
  // swap, the recovery still applies (recovery is slot math, not a
  // prepared change).
  const lostBothId = await arcRow('ArcLostBoth', {
    usedSlots: { '1': 1 },
    bookJson: JSON.stringify({ status: 'lost', pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' }, pendingArcaneRecovery: { slots: [1] } }),
  });
  const lostBothSession = await arcSession(lostBothId);
  const lostBothRest = await rt.applyRest({ sessionId: lostBothSession, characterId: lostBothId, type: 'short', dice: 2 });
  const lostBothDetail = lostBothRest.event.results.find((x) => x.kind === 'pc');
  assert(lostBothDetail?.memorizeSwap?.applied === false && String(lostBothDetail?.memorizeSwap?.reason).includes('lost'),
    'the lost book refuses the swap');
  assert(lostBothDetail?.arcaneRecovery?.applied === true,
    'the refused swap does not block the recovery');
  assert(JSON.stringify(await usedOf(lostBothId)) === JSON.stringify({}), 'the recovery restored the slot despite the lost book');
  assert(JSON.stringify(JSON.parse((await readArc(lostBothId)).prepared_spells)) === JSON.stringify(PREP8),
    'the refused swap left the prepared list untouched');

  // Companion-only rest: the PC is not rested, the bank is untouched.
  const soloId = await arcRow('ArcSolo');
  const soloNpc = await insertRow('npcs', { name: 'ArcSoloComp' });
  await insertRow('companions', {
    npc_id: soloNpc, recruited_by_character_id: soloId, status: 'active',
    companion_class: 'Ranger', companion_level: 3,
    companion_current_hp: 5, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 12, dex: 17, con: 13, int: 10, wis: 15, cha: 8 }),
    companion_spell_slots_used: '{}',
    companion_hit_dice: JSON.stringify({ d8: 3 }), companion_hit_dice_used: '{}'
  });
  const soloSession = await arcSession(soloId);
  const soloRest = await rt.applyRest({ sessionId: soloSession, characterId: soloId, type: 'short', actor: 'ArcSoloComp' });
  assert(soloRest.event.results.length === 1 && soloRest.event.results[0].kind === 'companion', 'companion-only rest rests only the companion');
  assert(JSON.stringify(await bankOf(soloId)) === JSON.stringify({ slots: [2, 1] }),
    'a companion-only rest leaves the PC bank for the next PC short rest');
  assert((await readArc(soloId)).current_hp === 10, 'the PC is untouched by a companion-only rest');

  // 0 HP: no benefit at all, and the bank survives (the rest never happened).
  const downId = await arcRow('ArcDown', { hp: 0 });
  const downSession = await arcSession(downId);
  const downRest = await rt.applyRest({ sessionId: downSession, characterId: downId, type: 'short', dice: 2 });
  assert(downRest.event.results.find((x) => x.kind === 'pc')?.rested === false, '0-HP wizard gains no rest benefit');
  assert(JSON.stringify(await bankOf(downId)) === JSON.stringify({ slots: [2, 1] }),
    'a rest that never happened leaves the bank for later');
  assert((await readArc(downId)).current_hp === 0, '0-HP wizard stays at 0');
  assert(await flagOf(downId) === false, 'no flag is set by a rest that never happened');
}

// ---------------------------------------------------------------------------
group('14. Companion long rest — condition clearing + death-save reset (Job B, 2026-11-08)');
{
  // The deleted companion rest route's C3/C4, ported into
  // restCompanion's long branch: conditions clear except petrified
  // (with their condition_meta rows — the old route rewrote
  // active_conditions only and left stale charmed/grappled meta
  // behind), exhaustion still steps down exactly once, and both
  // death-save tallies reset. The PC gains NEITHER effect.
  const portNpcId = await insertRow('npcs', { name: 'PortComp' });
  const portId = await insertRow('companions', {
    npc_id: portNpcId, recruited_by_character_id: pcId, status: 'active',
    companion_class: 'Fighter', companion_level: 3,
    companion_current_hp: 10, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }),
    companion_spell_slots_used: JSON.stringify({ '1': 1 }),
    companion_hit_dice: JSON.stringify({ d10: 3 }), companion_hit_dice_used: JSON.stringify({ d10: 1 }),
    death_save_successes: 2, death_save_failures: 1
  });
  await cond.addCondition('companion', portId, 'poisoned');
  await cond.addCondition('companion', portId, 'exhaustion_3');
  await cond.addCondition('companion', portId, 'petrified');
  await cond.addCondition('companion', portId, 'charmed', { charmer: 'TestCharmer' });
  assert((await cond.charmerFor('companion', portId)) === 'TestCharmer', 'charmed meta seeds via the real condition service');

  const r = await rt.applyRest({ sessionId, characterId: pcId, type: 'long', actor: 'PortComp' });
  assert(r.success === true, 'companion-only long rest succeeds');
  const detail = r.event.results.find((x) => x.kind === 'companion');
  assert(detail?.rested === true, 'the companion rested');
  const comp = await dbGet('SELECT companion_current_hp, companion_spell_slots_used, companion_hit_dice_used, active_conditions, death_save_successes, death_save_failures FROM companions WHERE id = ?', [portId]);
  assert(comp.companion_current_hp === 20 && comp.companion_spell_slots_used === '{}', 'companion: HP full, slots restored');
  const conds = JSON.parse(comp.active_conditions || '[]');
  assert(!conds.includes('poisoned') && !conds.includes('charmed'), 'poisoned + charmed cleared by the long rest');
  assert(conds.includes('petrified'), 'petrified persists through the long rest');
  assert(conds.includes('exhaustion_2') && !conds.includes('exhaustion_3'), 'exhaustion stepped down exactly once, 3 -> 2');
  assert(comp.death_save_successes === 0 && comp.death_save_failures === 0, 'both death-save tallies reset to 0');
  assert(JSON.stringify(detail?.conditionsCleared) === JSON.stringify(['poisoned', 'charmed']),
    'event detail lists exactly the cleared conditions');
  assert(detail?.deathSavesReset === true, 'event detail flags the death-save reset');
  assert(detail?.exhaustionAfter === 2, 'event detail records exhaustion after');
  assert((await cond.charmerFor('companion', portId)) === null, 'the charmed meta row is gone with the condition (no stale meta)');
  assert((await dbGet('SELECT COUNT(*) AS n FROM condition_meta WHERE kind = ? AND owner_id = ?', ['companion', portId])).n === 0,
    'no condition_meta rows remain for the companion');
  const block = rt.formatTimeEventBlock(r.event);
  assert(block.includes('Conditions cleared: poisoned, charmed.'), 'outcome block narrates the cleared conditions');
  assert(block.includes('Death saves reset.'), 'outcome block narrates the death-save reset');
  assert(block.includes('Exhaustion reduced to level 2.'), 'outcome block narrates the exhaustion step-down');

  // The PC does NOT gain either effect on a long rest (still
  // undecided, out of scope — the port is companion-only).
  await cond.addCondition('player', pcId, 'poisoned');
  await dbRun('UPDATE characters SET death_save_successes = 1, death_save_failures = 2 WHERE id = ?', [pcId]);
  const pcRest = await rt.applyRest({ sessionId, characterId: pcId, type: 'long', actor: 'Garrick' });
  const pcDetail = pcRest.event.results.find((x) => x.kind === 'pc');
  const pcAfter = await dbGet('SELECT active_conditions, death_save_successes, death_save_failures FROM characters WHERE id = ?', [pcId]);
  assert(JSON.parse(pcAfter.active_conditions || '[]').includes('poisoned'), 'PC: poisoned survives a long rest (no PC condition clearing)');
  assert(pcAfter.death_save_successes === 1 && pcAfter.death_save_failures === 2, 'PC: death-save tallies survive a long rest');
  assert(pcDetail?.conditionsCleared === undefined && pcDetail?.deathSavesReset === undefined,
    'PC rest detail carries neither companion flag');
  assert(!rt.formatTimeEventBlock(pcRest.event).includes('Conditions cleared'), 'PC outcome block narrates no condition clearing');

  // Short rest at 0 HP: nothing, tallies kept (C7 dropped
  // deliberately — a down companion stays down through a DM rest;
  // the stabilize route is the remedy). Vex (group 7's warlock) is
  // already at 0 HP; look the id up by name — group 7's const is
  // block-scoped.
  const vexRow = await dbGet(`SELECT c.id AS id FROM companions c JOIN npcs n ON n.id = c.npc_id WHERE n.name = ?`, ['Vex']);
  const vexId = vexRow.id;
  await dbRun('UPDATE companions SET companion_current_hp = 0, companion_spell_slots_used = ?, death_save_successes = 2, death_save_failures = 1 WHERE id = ?',
    [JSON.stringify({ '2': 1 }), vexId]);
  const down = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'Vex' });
  const vexAfter2 = await dbGet('SELECT companion_current_hp, companion_spell_slots_used, death_save_successes, death_save_failures FROM companions WHERE id = ?', [vexId]);
  assert(down.event.results[0].rested === false, '0-HP companion gains no benefit from a short rest');
  assert(vexAfter2.companion_current_hp === 0, '0-HP companion stays at 0 HP');
  assert(vexAfter2.death_save_successes === 2 && vexAfter2.death_save_failures === 1, '0-HP companion keeps its death-save tallies');
  assert(vexAfter2.companion_spell_slots_used === JSON.stringify({ '2': 1 }), '0-HP warlock keeps its spent pact slots too');

  // Short rest with no dice left: heals 0 (hit dice are the only
  // short-rest healing; the old route's flat 50% is gone).
  const noDiceNpcId = await insertRow('npcs', { name: 'NoDiceComp' });
  const noDiceId = await insertRow('companions', {
    npc_id: noDiceNpcId, recruited_by_character_id: pcId, status: 'active',
    companion_class: 'Fighter', companion_level: 2,
    companion_current_hp: 5, companion_max_hp: 20,
    companion_ability_scores: JSON.stringify({ str: 14, dex: 12, con: 14, int: 10, wis: 10, cha: 10 }),
    companion_spell_slots_used: '{}',
    companion_hit_dice: JSON.stringify({ d8: 2 }), companion_hit_dice_used: JSON.stringify({ d8: 2 })
  });
  const noDice = await rt.applyRest({ sessionId, characterId: pcId, type: 'short', actor: 'NoDiceComp' });
  const noDiceDetail = noDice.event.results.find((x) => x.kind === 'companion');
  assert(noDiceDetail?.diceSpent === 0 && noDiceDetail?.healed === 0, 'no dice left: nothing spent, nothing healed');
  assert((await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [noDiceId])).companion_current_hp === 5,
    'no dice left: HP stays 5');
}

// ---------------------------------------------------------------------------
group('15. applyDowntimeRest — the DM rest effect set, minus HP/clock (Job B, 2026-11-08)');
{
  async function downRow(name, { hp = 10, cls = 'Wizard', level = 5, classLevels = null, usedSlots = { '1': 2 }, bookJson = null, tempHp = 4, diceUsed = { d6: 3 } } = {}) {
    const id = await insertRow('characters', {
      name, class: cls, level,
      class_levels: JSON.stringify(classLevels || [{ class: 'wizard', level }]),
      ability_scores: JSON.stringify({ str: 10, dex: 10, con: 14, int: 16, wis: 10, cha: 10 }),
      current_hp: hp, max_hp: 20, temp_hp: tempHp,
      hit_dice: JSON.stringify({ d6: 5 }), hit_dice_used: JSON.stringify(diceUsed),
      spell_slots_used: JSON.stringify(usedSlots),
      spellbook_json: bookJson ?? JSON.stringify({ status: 'intact', arcaneRecoveryUsed: true }),
    });
    return id;
  }
  const readDown = async (id) => dbGet('SELECT current_hp, temp_hp, spell_slots_used, hit_dice_used, spellbook_json, active_conditions FROM characters WHERE id = ?', [id]);
  const flagOf = async (id) => JSON.parse((await readDown(id)).spellbook_json || '{}').arcaneRecoveryUsed === true;
  const bookOf = async (id) => JSON.parse((await readDown(id)).spellbook_json || '{}');

  // Long: slots + flag clear + dice regain + exhaustion -1 + temp HP
  // clear — but HP untouched and the clock unmoved, and the banks
  // are NOT consumed (only the flag clears).
  const wizId = await downRow('DownWiz', {
    bookJson: JSON.stringify({
      status: 'intact', arcaneRecoveryUsed: true,
      pendingArcaneRecovery: { slots: [1] },
      pendingMemorizeSwap: { oldSpell: 'Sleep', newSpell: 'Misty Step' },
    }),
  });
  await cond.addCondition('player', wizId, 'exhaustion_2');
  const clockBefore = await sched.getClock(null);
  const r = await rt.applyDowntimeRest({ characterId: wizId, type: 'long' });
  const clockAfter = await sched.getClock(null);
  assert(r.success === true && r.slotsRestored === true, 'downtime long rest succeeds and restores slots');
  assert(r.arcaneRecoveryReset === true, 'downtime long rest reports the Arcane flag cleared');
  assert(r.diceRegained === 2, 'downtime long rest regains 2 of 3 spent dice (half of pool 5)');
  assert(r.exhaustionAfter === 1, 'downtime long rest steps exhaustion 2 -> 1');
  const wizAfter = await readDown(wizId);
  assert(wizAfter.spell_slots_used === '{}', 'downtime long rest restores every slot');
  assert(JSON.parse(wizAfter.hit_dice_used).d6 === 1, 'downtime long rest regains the dice in the DB');
  assert(wizAfter.temp_hp === 0, 'downtime long rest clears temp HP');
  assert(wizAfter.current_hp === 10, 'downtime long rest does NOT touch HP (applyBenefits owns HP)');
  assert(await flagOf(wizId) === false, 'the Arcane used-flag is gone after a downtime long rest');
  assert(JSON.stringify((await bookOf(wizId)).pendingArcaneRecovery) === JSON.stringify({ slots: [1] }),
    'the Arcane BANK survives a downtime long rest — it waits for the next DM short rest');
  assert(JSON.stringify((await bookOf(wizId)).pendingMemorizeSwap) === JSON.stringify({ oldSpell: 'Sleep', newSpell: 'Misty Step' }),
    'the Memorize BANK survives a downtime long rest too');
  assert(JSON.stringify(JSON.parse(wizAfter.active_conditions || '[]')) === JSON.stringify(['exhaustion_1']),
    'exhaustion stepped down in the DB');
  assert(absHours(clockAfter) - absHours(clockBefore) === 0, 'a downtime rest moves no clock');

  // Short, warlock: pact slots return, nothing else moves (no real
  // hit dice spent — downtime keeps its simulated heal). Warlock 5
  // has 2x L3 pact slots, so the spent slot is L3 — the scoped
  // reset (D2) only returns pact-level slots.
  const lockId = await downRow('DownLock', { cls: 'Warlock', classLevels: [{ class: 'warlock', level: 5 }], usedSlots: { '3': 1 }, bookJson: '{}', diceUsed: { d8: 1 } });
  const lockRest = await rt.applyDowntimeRest({ characterId: lockId, type: 'short' });
  assert(lockRest.success === true && lockRest.slotsRestored === true, 'downtime short rest restores a warlock\'s pact slots');
  const lockAfter = await readDown(lockId);
  assert(lockAfter.spell_slots_used === '{}', 'warlock slots restored in the DB');
  assert(JSON.stringify(JSON.parse(lockAfter.hit_dice_used)) === JSON.stringify({ d8: 1 }),
    'downtime short rest spends NO real hit dice');
  assert(lockAfter.current_hp === 10, 'downtime short rest does not touch HP');

  // Short, warlock by display name: the DM path's broader regex
  // match (the old exact-'warlock' check missed "Warlock (Fiend)").
  // The default class_levels here is wizard-only, so the warlock
  // level comes from the primary-class fallback — pinning that path
  // too. Warlock 5 → 2x L3 pact slots.
  const fiendId = await downRow('DownFiend', { cls: 'Warlock (Fiend)', usedSlots: { '3': 2 }, bookJson: '{}' });
  const fiendRest = await rt.applyDowntimeRest({ characterId: fiendId, type: 'short' });
  assert(fiendRest.slotsRestored === true, '"Warlock (Fiend)" counts as a warlock for a downtime short rest');
  assert((await readDown(fiendId)).spell_slots_used === '{}', '"Warlock (Fiend)" pact slots restored in the DB');

  // Short, wizard-primary warlock (wizard levels + pact slots):
  // the pact slots return SCOPED (the 2x L2 pact slots), the spent
  // 1st-level wizard slot stays spent — the downtime path fires the
  // reset whenever warlock levels are present, regardless of primary
  // (S2, same as the DM path).
  const wizLockId = await downRow('DownWizLock', {
    cls: 'Wizard', level: 8,
    classLevels: [{ class: 'wizard', level: 5 }, { class: 'warlock', level: 3 }],
    usedSlots: { '1': 1, '2': 2 }, bookJson: '{}',
  });
  const wizLockRest = await rt.applyDowntimeRest({ characterId: wizLockId, type: 'short' });
  assert(wizLockRest.success === true && wizLockRest.slotsRestored === true,
    'a wizard-primary warlock regains pact slots on a downtime short rest');
  assert(JSON.stringify(JSON.parse((await readDown(wizLockId)).spell_slots_used)) === JSON.stringify({ '1': 1 }),
    'the scoped reset returns the 2nd-level pact slots and leaves the 1st-level wizard slot spent');

  // Short, non-warlock: slots stay spent, temp HP stays.
  const fightId = await downRow('DownFight', { cls: 'Fighter', usedSlots: { '1': 1 }, bookJson: '{}', diceUsed: { d10: 1 } });
  const fightRest = await rt.applyDowntimeRest({ characterId: fightId, type: 'short' });
  assert(fightRest.success === true && fightRest.slotsRestored === false, 'a non-warlock gains no slots from a downtime short rest');
  const fightAfter = await readDown(fightId);
  assert(JSON.stringify(JSON.parse(fightAfter.spell_slots_used)) === JSON.stringify({ '1': 1 }), 'non-warlock slots stay spent');
  assert(fightAfter.temp_hp === 4, 'non-warlock temp HP untouched by a short rest');
  assert(JSON.stringify(JSON.parse(fightAfter.hit_dice_used)) === JSON.stringify({ d10: 1 }), 'non-warlock dice untouched by a short rest');

  // No 0-HP guard (deliberate, reversible — see applyDowntimeRest):
  // downtime completion heals via applyBenefits in the same call, so
  // a character at 0 HP still gets the rest effects.
  const zeroId = await downRow('DownZero', { hp: 0 });
  const zeroRest = await rt.applyDowntimeRest({ characterId: zeroId, type: 'long' });
  assert(zeroRest.success === true && zeroRest.slotsRestored === true, 'a 0-HP character still gets a downtime long rest');
  assert((await readDown(zeroId)).spell_slots_used === '{}', '0-HP downtime long rest restores slots in the DB');
  assert(await flagOf(zeroId) === false, '0-HP downtime long rest clears the flag too');

  // Bad inputs fail cleanly.
  const badType = await rt.applyDowntimeRest({ characterId: wizId, type: 'nap' });
  assert(badType.success === false, 'an unknown rest type fails cleanly');
  const missing = await rt.applyDowntimeRest({ characterId: 999999, type: 'long' });
  assert(missing.success === false, 'an unknown character fails cleanly');
}

// ---------------------------------------------------------------------------
console.log(`\n rest-time: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
