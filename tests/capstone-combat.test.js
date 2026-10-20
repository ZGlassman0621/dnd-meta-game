/**
 * tests/capstone-combat.test.js — CAPSTONE: full combat pipeline, end to end.
 *
 * Scenario: "Goblin Ambush" (design: capstone-combat-test-design.md,
 * approved by Zach 2026-10-20 — built BEFORE Phase 0 clock unification as
 * its regression guard).
 *
 * Real-DB integration test, service layer (NOT the dmSession turn loop —
 * the loop is flaky under test; services are deterministic). No seeded RNG
 * exists by design, so assertions are invariants, ranges, and exact HP/AC
 * accounting — never exact roll values. Where a system is roll-driven
 * (concentration, morale), the test asserts internal consistency of every
 * outcome and loops bounded times for the probabilistic branch.
 *
 *   node tests/capstone-combat.test.js
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

// Isolated throwaway DB: chdir BEFORE importing database.js.
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-capstone-'));
process.chdir(dbDir);

// The suite runner (server/scripts/run-tests.js) exports TURSO_DATABASE_URL
// pointing at the SHARED .test-tmp/test.db for every test, and database.js
// prefers it over the CWD-local file — which silently defeats the chdir
// isolation above and leaks this test's rows into other tests' cleanups
// (found 2026-10-20: this test's dm_sessions row blocked the character
// delete in companion-activities' cleanup). Clearing it makes the
// throwaway DB real, under npm test and standalone alike.
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDatabase, dbGet, dbRun, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers COMBAT_START / ENEMY_DAMAGE / ENEMY_ATTACK / OPPORTUNITY_ATTACK / SET_COVER / TURN_ADVANCE
const spellSvc = await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
const hpSvc = await import(svc('server/services/characterHpService.js')); // registers HP_CHANGE
const enemySvc = await import(svc('server/services/enemyCombatService.js'));
const turnSvc = await import(svc('server/services/combatTurnService.js'));
const concSvc = await import(svc('server/services/concentrationService.js'));
const reactSvc = await import(svc('server/services/reactionService.js'));
const moraleSvc = await import(svc('server/services/moraleService.js'));
const bestiarySvc = await import(svc('server/services/bestiaryService.js'));
const reconSvc = await import(svc('server/services/fictionMarkerReconciliation.js'));
const rng = await import(svc('server/utils/rng.js'));

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

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
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

const heroName = tn('Hero');
const allyName = tn('Ally');

// PC: L3 spellcaster. temp_hp deliberately NOT set in the fixture —
// migration 065 defaults it to 0 (see group 5).
const pcId = await insertRow('characters', {
  name: heroName,
  level: 3,
  current_hp: 60,
  max_hp: 60,
  armor_class: 14,
  ability_scores: JSON.stringify({
    strength: 10, dexterity: 14, constitution: 8,
    intelligence: 16, wisdom: 12, charisma: 10,
  }),
  spell_slots: JSON.stringify({ 1: 2, 2: 1 }),
  spell_slots_used: JSON.stringify({}),
  inventory: JSON.stringify([]),
});

// Second character purely for the temp-HP / NULL-temp_hp group.
const pc2Id = await insertRow('characters', {
  name: tn('Squire'),
  level: 1,
  current_hp: 30,
  max_hp: 30,
  armor_class: 12,
  ability_scores: JSON.stringify({ constitution: 12, dexterity: 10 }),
  inventory: JSON.stringify([]),
});

// Companion ally (full party member; mechanical-combat assertions for
// companions land with the Q6 companion-combat surface — here the ally is
// exercised through initiative + the enemy-attack companion HP path, which
// already exist).
const allyNpcId = await insertRow('npcs', { name: allyName });
const allyId = await insertRow('companions', {
  npc_id: allyNpcId,
  recruited_by_character_id: pcId,
  status: 'active',
  armor_class: 13,
  current_hp: 12,
  companion_current_hp: 12,
  companion_max_hp: 12,
  companion_ability_scores: JSON.stringify({ dexterity: 12 }),
});

const compCols = await dbAll(`PRAGMA table_info(companions)`);
const HAS_COMP_CURRENT_HP = compCols.some((c) => c.name === 'current_hp');
console.log(`[test] companions.current_hp present: ${HAS_COMP_CURRENT_HP}`);

const sessionId = await insertRow('dm_sessions', {
  character_id: pcId,
  status: 'active',
});
const CTX = { characterId: pcId, sessionId };
const SEQ = 1;

async function pcPool() {
  const r = await dbGet(
    'SELECT current_hp, COALESCE(temp_hp, 0) AS temp_hp FROM characters WHERE id = ?',
    [pcId]
  );
  return { hp: r.current_hp, temp: r.temp_hp, pool: r.current_hp + r.temp_hp };
}

// ---------------------------------------------------------------------------
// 1. COMBAT_START + bestiary — canonical stats, not AI-invented
// ---------------------------------------------------------------------------
group('1. COMBAT_START creates bestiary-true goblins + turn order');
{
  const goblin = await bestiarySvc.lookupBestiary('goblin');
  assert(goblin && goblin.max_hp === 7 && goblin.armor_class === 15, 'bestiary goblin seeded (7 HP / AC 15)');

  const res = await pipeline.processResponseMarkers(
    'Three goblins burst from the treeline, blades out! [COMBAT_START: Enemies="Goblin, Goblin, Goblin"]',
    CTX
  );
  const start = res.handlerResults.find((h) => h.schemaKey === 'COMBAT_START');
  assert(start && start.ok, 'COMBAT_START handler ran');
  assert(start.result?.type === 'combat_start', 'combat_start result returned');
  const order = start.result.combatStart.turnOrder;
  assert(order.length === 5, `turn order has PC + companion + 3 goblins (got ${order.length})`);
  assert(order.some((t) => t.type === 'player'), 'player in turn order');
  assert(order.some((t) => t.type === 'companion' && t.name === allyName), 'companion ally in turn order');
  assert(order.filter((t) => t.type === 'enemy').length === 3, '3 enemies in turn order');

  const rows = await dbAll('SELECT * FROM combat_enemies WHERE session_id = ? ORDER BY id', [sessionId]);
  assert(rows.length === 3, '3 combat_enemies rows created');
  for (const r of rows) {
    assert(
      r.max_hp === goblin.max_hp && r.armor_class === goblin.armor_class &&
      r.attack_bonus === goblin.attack_bonus && r.damage_dice === goblin.damage_dice &&
      r.current_hp === goblin.max_hp && r.status === 'active',
      `enemy row matches bestiary (hp ${r.max_hp}, ac ${r.armor_class}, atk ${r.attack_bonus}, dmg ${r.damage_dice})`
    );
  }

  const state = await turnSvc.getTurnState(sessionId, SEQ);
  assert(state && state.totalCombatants === 5 && state.round === 1 && state.currentIndex === 0,
    'turn state stored: 5 combatants, round 1');
}

// ---------------------------------------------------------------------------
// 2. Turn order cycles; round increments at wrap
// ---------------------------------------------------------------------------
group('2. turn order cycles and wraps into round 2');
{
  const s0 = await turnSvc.getTurnState(sessionId, SEQ);
  const order = s0.turnOrder;
  let s = s0;
  for (let i = 1; i <= order.length; i++) {
    s = await turnSvc.advanceTurn(sessionId, SEQ);
    const expected = order[i % order.length];
    assert(
      s.currentTurn && s.currentTurn.name === expected.name && s.currentTurn.type === expected.type,
      `advance ${i}: current turn is ${expected.name} (${expected.type})`
    );
  }
  assert(s.round === 2 && s.currentIndex === 0, 'wrapped to round 2, index 0');
}

// ---------------------------------------------------------------------------
// 3. SPELL_CAST + slot accounting
// ---------------------------------------------------------------------------
group('3. spell slots decrement, exhaustion fails, cantrips are free');
{
  const res = await pipeline.processResponseMarkers(
    '[SPELL_CAST: Spell="Magic Missile" Level=1]', CTX);
  const cast = res.handlerResults.find((h) => h.schemaKey === 'SPELL_CAST');
  assert(cast && cast.result?.success === true, 'SPELL_CAST via pipeline succeeds');
  assert(cast.result.slotConsumed === true && cast.result.slotsUsed === 1 && cast.result.slotsRemaining === 1,
    'first L1 cast consumes 1 of 2 slots');

  const second = await spellSvc.castSpell(pcId, 'Magic Missile', 1);
  assert(second.success === true && second.slotsUsed === 2 && second.slotsRemaining === 0, 'second cast uses last L1 slot');

  const third = await spellSvc.castSpell(pcId, 'Magic Missile', 1);
  assert(third.success === false && third.reason === 'no_slots_available', 'third cast fails: no_slots_available');

  const cantrip = await spellSvc.castSpell(pcId, 'Fire Bolt', 0);
  assert(cantrip.success === true && cantrip.slotConsumed === false, 'cantrip consumes nothing');
  const row = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pcId]);
  assert(JSON.parse(row.spell_slots_used)['1'] === 2, 'DB spell_slots_used still exactly {1: 2}');
}

// ---------------------------------------------------------------------------
// 4. Concentration — auto-start on cast; failed save drops the spell
// ---------------------------------------------------------------------------
group('4. concentration starts on cast and breaks on a failed save');
{
  const bless = await spellSvc.castSpell(pcId, 'Bless', 2); // L2 slot, concentration spell
  assert(bless.success === true && bless.concentration === true, 'Bless cast auto-starts concentration');
  assert((await concSvc.getConcentration(pcId)) === 'Bless', 'concentrating_on = Bless');

  // CON 8 → conMod -1. Damage 22 → DC max(10, 11) = 11. Pass needs d20 >= 12
  // (55% fail per try); loop heals between tries, bounded at 12 — the chance
  // of never breaking is ~0.007%. Every check is asserted for consistency.
  let broke = false;
  for (let i = 0; i < 12 && !broke; i++) {
    const r = await hpSvc.applyHpChange(pcId, -22, 'capstone concentration test');
    const cc = r.concentrationCheck;
    assert(cc && cc.dc === 11, `check ${i}: DC is 11 for 22 damage`);
    assert(cc.conMod === -1 && cc.total === cc.roll + cc.conMod, `check ${i}: total = roll + conMod`);
    assert(cc.success === (cc.total >= cc.dc), `check ${i}: success flag matches total vs DC`);
    if (cc.broken) {
      broke = true;
      assert((await concSvc.getConcentration(pcId)) === null, 'failed save drops the spell');
    } else {
      await hpSvc.applyHpChange(pcId, 22, 'capstone heal between checks');
    }
  }
  assert(broke, 'concentration broke within 12 checks');
}

// ---------------------------------------------------------------------------
// 5. Temp HP — absorbed first; default-0 temp_hp path is clean (065)
// ---------------------------------------------------------------------------
group('5. temp HP absorbs first; default temp_hp does not break damage');
{
  const raw = await dbGet('SELECT temp_hp FROM characters WHERE id = ?', [pc2Id]);
  // Migration 065 defines temp_hp as NOT NULL DEFAULT 0 — a NULL temp_hp is
  // unreachable on the current schema (the COALESCE in characterHpService is
  // legacy defense for pre-065 databases). Assert the real invariant: a
  // fresh character starts at 0 and damage applies cleanly from there.
  assert(raw.temp_hp === 0, 'fixture character starts with temp_hp 0 (065 schema default)');

  const hit1 = await hpSvc.applyHpChange(pc2Id, -4, 'capstone default-temp hit');
  assert(hit1.applied === true && hit1.currentHp === 26 && hit1.tempHp === 0,
    'damage with default temp_hp applies cleanly (26 HP, temp 0)');

  const gain = await hpSvc.gainTempHp(pc2Id, 5);
  assert(gain.tempHp === 5, 'gainTempHp sets 5');

  const hit2 = await hpSvc.applyHpChange(pc2Id, -8, 'capstone temp absorption');
  assert(hit2.previousTempHp === 5 && hit2.tempHp === 0 && hit2.currentHp === 23,
    '8 damage: 5 absorbed by temp HP, 3 through to HP (23)');
}

// ---------------------------------------------------------------------------
// 6. ENEMY_ATTACK — server rolls, cover math, HP accounting, roll log
// ---------------------------------------------------------------------------
group('6. enemy attacks roll server-side; cover adds to AC; HP pools reconcile');
{
  assert(enemySvc.getCoverAcBonus('half') === 2, 'half cover = +2 AC');
  assert(enemySvc.getCoverAcBonus('three-quarters') === 5, 'three-quarters cover = +5 AC');
  assert(enemySvc.getCoverAcBonus('none') === 0, 'no cover = +0 AC');

  rng.clearRollLog();

  async function attackAndReconcile(target, expectedAc, label) {
    const before = target.type === 'player'
      ? await pcPool()
      : { pool: (await dbGet('SELECT current_hp FROM companions WHERE id = ?', [target.id])).current_hp };
    const r = await enemySvc.resolveEnemyAttack(sessionId, SEQ, 'Goblin', target);
    assert(r && r.type === 'enemy_attack', `${label}: attack resolved`);
    assert(r.attackRoll >= 1 && r.attackRoll <= 20, `${label}: attack roll in 1..20`);
    assert(r.totalToHit === r.attackRoll + r.attackBonus, `${label}: total = roll + bonus`);
    assert(r.targetAc === expectedAc, `${label}: target AC is ${expectedAc} (got ${r.targetAc})`);
    const expectHit = r.isCrit || (!r.isFumble && r.totalToHit >= expectedAc);
    assert(r.hit === expectHit, `${label}: hit flag consistent with roll vs AC`);
    if (r.hit) {
      assert(r.damage >= 3 && r.damage <= 8, `${label}: goblin damage in 1d6+2 range (got ${r.damage})`);
    } else {
      assert(r.damage === 0, `${label}: miss deals 0`);
    }
    const after = target.type === 'player'
      ? await pcPool()
      : { pool: (await dbGet('SELECT current_hp FROM companions WHERE id = ?', [target.id])).current_hp };
    assert(after.pool === before.pool - (r.hit ? r.damage : 0),
      `${label}: HP pool reconciles exactly (${before.pool} -> ${after.pool})`);
    return r;
  }

  await attackAndReconcile({ type: 'player', id: pcId, armorClass: 14, name: 'Player' }, 14, 'attack vs player');
  await attackAndReconcile({ type: 'player', id: pcId, armorClass: 14, cover: 'half', name: 'Player' }, 16, 'attack vs half cover');
  await attackAndReconcile({ type: 'player', id: pcId, armorClass: 14, cover: 'three-quarters', name: 'Player' }, 19, 'attack vs three-quarters cover');

  if (HAS_COMP_CURRENT_HP) {
    await attackAndReconcile({ type: 'companion', id: allyId, armorClass: 13, name: allyName }, 13, 'attack vs companion');
  } else {
    // PINNED SLOT (design, per Q6): resolveEnemyAttack's companion branch
    // writes companions.current_hp, a column that does not exist yet — the
    // mechanical companion-combat surface is not built. Today the call
    // throws on a hit (damage application) or silently no-ops on a miss.
    // When the Q6 surface lands, this branch flips: the throw assertion
    // below MUST be replaced with the full attackAndReconcile accounting
    // used for the player above. A red test here after that build is the
    // reminder to do it.
    let threw = null;
    let result = null;
    try {
      result = await enemySvc.resolveEnemyAttack(sessionId, SEQ, 'Goblin',
        { type: 'companion', id: allyId, armorClass: 13, name: allyName });
    } catch (e) {
      threw = e;
    }
    if (threw) {
      assert(/current_hp/.test(String(threw.message || threw)),
        'PINNED: companion attack throws on missing companions.current_hp (Q6 surface pending)');
    } else {
      assert(result && result.hit === false,
        'PINNED: companion attack missed, so the missing-column write never fired (Q6 surface pending)');
    }
  }

  const log = rng.getRollLog();
  const d20s = log.filter((e) => e.reason && e.reason.includes('enemy attack'));
  assert(d20s.length === 4 && d20s.every((e) => e.sides === 20), 'roll log: 4 enemy-attack d20 entries');
  const dmgRolls = log.filter((e) => e.reason && e.reason.includes('enemy damage'));
  assert(dmgRolls.every((e) => e.sides === 6), 'roll log: enemy damage entries are d6s');
}

// ---------------------------------------------------------------------------
// 7. Reactions — one per round; refreshes at the start of your turn
// ---------------------------------------------------------------------------
group('7. reactions spend once per round and refresh on your turn');
{
  const marker = `[OPPORTUNITY_ATTACK: Attacker="${allyName}" Target="Goblin"]`;
  const first = await pipeline.processResponseMarkers(marker, CTX);
  const r1 = first.handlerResults.find((h) => h.schemaKey === 'OPPORTUNITY_ATTACK');
  assert(r1 && r1.result?.success === true && r1.result.reactionConsumed === true, 'first opportunity attack consumes the reaction');

  const second = await pipeline.processResponseMarkers(marker, CTX);
  const r2 = second.handlerResults.find((h) => h.schemaKey === 'OPPORTUNITY_ATTACK');
  assert(r2 && r2.result?.success === false && r2.result?.reason === 'reaction_already_used',
    'second reaction in the same round is refused');
  assert((await reactSvc.hasReactionAvailable(sessionId, SEQ, allyName)) === false, 'reaction shows spent');

  // Advance until the ally's turn comes up — their reaction refreshes.
  let refreshed = false;
  for (let i = 0; i < 6 && !refreshed; i++) {
    const s = await turnSvc.advanceTurn(sessionId, SEQ);
    if (s.currentTurn && s.currentTurn.name === allyName) {
      refreshed = await reactSvc.hasReactionAvailable(sessionId, SEQ, allyName);
    }
  }
  assert(refreshed, 'reaction refreshed at the start of the ally\'s next turn');
}

// ---------------------------------------------------------------------------
// 8. ENEMY_DAMAGE — death is an event; loot immediate; kill XP is data only
// ---------------------------------------------------------------------------
group('8. enemy death records an event, loots immediately, awards NO xp mid-combat');
{
  const invBefore = JSON.parse((await dbGet('SELECT inventory FROM characters WHERE id = ?', [pcId])).inventory || '[]');

  const dmg1 = await pipeline.processResponseMarkers('[ENEMY_DAMAGE: Enemy="Goblin" Amount=4]', CTX);
  const d1 = dmg1.handlerResults.find((h) => h.schemaKey === 'ENEMY_DAMAGE');
  assert(d1 && d1.result?.damageDealt === 4 && d1.result.currentHp === 3 && d1.result.killed === false && d1.result.bloodied === true,
    '4 damage: goblin at 3/7, bloodied, alive');

  const dmg2 = await pipeline.processResponseMarkers('[ENEMY_DAMAGE: Enemy="Goblin" Amount=3]', CTX);
  const d2 = dmg2.handlerResults.find((h) => h.schemaKey === 'ENEMY_DAMAGE');
  assert(d2 && d2.result?.killed === true && d2.result.status === 'dead', '3 more damage: goblin dead');
  assert(d2.result.deathEvent && d2.result.deathEvent.xpValue === 50, 'death event carries bestiary XP value (50) as data');
  assert(d2.result.loot && Array.isArray(d2.result.loot.items) && d2.result.loot.items.length >= 1,
    'kill loot rolled immediately on death');

  const events = await dbAll('SELECT * FROM combat_death_events WHERE session_id = ?', [sessionId]);
  assert(events.length === 1, 'exactly one death event recorded');
  assert(events[0].xp_awarded === 0 || events[0].xp_awarded === null || events[0].xp_awarded === false,
    'death event NOT marked xp_awarded — session-end scoring owns XP (2026-10-16 decision)');
  assert(events[0].looted === 1, 'death event marked looted');
  const pcXp = await dbGet('SELECT experience FROM characters WHERE id = ?', [pcId]);
  assert((pcXp.experience ?? 0) === 0, 'character XP unchanged mid-combat — session-end scoring owns XP (kill XP removed)');

  const invAfter = JSON.parse((await dbGet('SELECT inventory FROM characters WHERE id = ?', [pcId])).inventory || '[]');
  assert(invAfter.length > invBefore.length, 'loot items landed in the character inventory');
  assert((await enemySvc.getActiveEnemies(sessionId, SEQ)).length === 2, '2 goblins remain active');
}

// ---------------------------------------------------------------------------
// 9. Morale — symmetric: losers check to break, winners check to rally
// ---------------------------------------------------------------------------
group('9. morale triggers at 50% casualties with consistent outcomes');
{
  const SEQ2 = 2;
  const gobA = tn('GobA');
  const gobB = tn('GobB');
  const stats = { maxHp: 7, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 };
  await enemySvc.createEncounterEnemies(sessionId, SEQ2, [
    { name: gobA, ...stats },
    { name: gobB, ...stats },
  ]);
  await turnSvc.initializeTurnOrder(sessionId, SEQ2, [
    { name: heroName, type: 'player' },
    { name: gobA, type: 'enemy' },
    { name: gobB, type: 'enemy' },
  ]);

  const kill = await enemySvc.applyDamageToEnemy(sessionId, SEQ2, gobA, 7);
  assert(kill && kill.killed === true, 'first of two goblins dies (50% casualties)');

  const m = await moraleSvc.checkMorale(sessionId, SEQ2, 'enemies');
  assert(m && m.triggered === true, 'morale check triggered at 50%');
  assert(m.breakChecks.length === 1, 'one break check for the one survivor');
  assert(m.rallyChecks.length === 1 && m.rallyChecks[0].side === 'friendlies', 'one friendly rally check');

  const survivor = await dbGet(
    'SELECT status FROM combat_enemies WHERE session_id = ? AND encounter_seq = ? AND name = ?',
    [sessionId, SEQ2, gobB]
  );
  const expectedStatus = m.breakChecks[0].outcome === 'fled' ? 'fled' : 'active';
  assert(survivor.status === expectedStatus, `survivor status matches break outcome (${m.breakChecks[0].outcome})`);

  const buff = await moraleSvc.getMoraleBuff(sessionId, SEQ2, 'friendlies');
  const expectedBuff = m.rallyChecks[0].outcome === 'rallied' ? 1 : 0;
  assert(buff === expectedBuff, `friendly morale buff matches rally outcome (${m.rallyChecks[0].outcome})`);
  assert((await moraleSvc.getMoraleBuff(sessionId, SEQ2, 'enemies')) === 0, 'losing side has no buff');
}

// ---------------------------------------------------------------------------
// 10. Fiction ↔ marker reconciliation — both directions
// ---------------------------------------------------------------------------
group('10. reconciliation: narrated damage applies; applied damage must be narrated');
{
  await hpSvc.applyHpChange(pcId, 1000, 'capstone: top up before reconciliation');
  const before = await pcPool();

  // Fiction claims damage no marker applied → auto-apply exactly that much.
  const rec1 = await reconSvc.reconcileTurn(
    'The goblin rakes its claws across your guard — you take 6 damage!',
    [],
    { characterId: pcId }
  );
  assert(rec1.autoApplied.length === 1 && rec1.autoApplied[0].amount === 6, 'narrated 6 damage auto-applied');
  const after1 = await pcPool();
  assert(after1.pool === before.pool - 6, 'HP pool dropped by exactly the narrated 6');

  // Fiction matches an applied marker → verified, NOT double-applied.
  const rec2 = await reconSvc.reconcileTurn(
    'Your blade deals 6 damage to the goblin.',
    [{ schemaKey: 'ENEMY_DAMAGE', parsed: { Enemy: 'Goblin', Amount: 6 }, result: { damageDealt: 6, enemyName: 'Goblin', killed: false } }],
    { characterId: pcId }
  );
  assert(rec2.verified.length === 1 && rec2.autoApplied.length === 0, 'matching claim verified, not re-applied');
  const after2 = await pcPool();
  assert(after2.pool === after1.pool, 'no double application');

  // Marker applied but fiction silent → surfaces as a SYSTEM note.
  const rec3 = await reconSvc.reconcileTurn(
    'The battle rages on around the wagon.',
    [{ schemaKey: 'ENEMY_DAMAGE', parsed: { Enemy: 'Goblin', Amount: 5 }, result: { damageDealt: 5, enemyName: 'Goblin', killed: true } }],
    { characterId: pcId }
  );
  assert(rec3.missingFiction.length === 1 && rec3.missingFiction[0].message.includes('Goblin was slain'),
    'unnarrated kill surfaces as a SYSTEM note');
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

try {
  process.chdir(os.tmpdir());
  fs.rmSync(dbDir, { recursive: true, force: true });
} catch { /* ignore */ }
