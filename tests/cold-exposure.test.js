/**
 * tests/cold-exposure.test.js — Cold Level / Frost Exhaustion (v1, 2026-10-28).
 *
 * Pins the approved Oct 26 numbers and the adopted design:
 *   - Frost Exhaustion is separate from standard exhaustion (no
 *     active_conditions key, its own frost_exhaustion column).
 *   - Hourly CON save DC 10 + Cold Level; failure +1 frost.
 *   - Frost -1 to ALL ability SCORES per level; any score 0 = death.
 *   - Wet +0 CL with disadvantage and no clothing bonus; Soaked +2 CL.
 *   - Recovery 1/hour resting while NOT exposed (sheltered rest).
 *   - Erosion flows through combatStats / rollRequest / partyAttack.
 *   - TIME_ADVANCE runs exposure only when a cold scene is set — the
 *     system never invents a Cold Level from temperature or region.
 *
 * Isolated throwaway DB (clock-unification pattern). Real services,
 * real DB, persisted state asserted by re-reading rows. Dice are
 * injected (diceForHour) wherever an outcome must be deterministic;
 * the live TIME_ADVANCE path is asserted structurally (processed,
 * coldLevel, dc, persisted frost), never on a random die.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-cold-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const cold = await import(svc('server/services/coldExposureService.js'));
const rt = await import(svc('server/services/restTimeService.js'));
const sched = await import(svc('server/services/scheduleService.js'));
const cc = await import(svc('server/services/combatStatsService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const pa = await import(svc('server/services/partyAttackService.js'));

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

async function makePc(overrides = {}) {
  return insertRow('characters', {
    name: 'Frost', class: 'Fighter', level: 3,
    current_hp: 30, max_hp: 30,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    hit_dice: JSON.stringify({ d10: 3 }), hit_dice_used: JSON.stringify({}),
    current_location: 'the open road', inventory: JSON.stringify([]), equipment: JSON.stringify({}),
    ...overrides
  });
}

async function makeSession(pcId, overrides = {}) {
  return insertRow('dm_sessions', {
    character_id: pcId, status: 'active', session_config: JSON.stringify({}),
    game_start_day: 1, game_start_year: 1492, ...overrides
  });
}

// The fallback (campaign-less) clock, like rest-time.test.js.
const fbRow = await dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
if (!fbRow) {
  await dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
}
await sched.getClock(null);

// ---------------------------------------------------------------------------
group('1. Migration 087 — frost + wet columns');
{
  const charCols = (await dbAll('PRAGMA table_info(characters)')).map(r => r.name);
  assert(charCols.includes('frost_exhaustion'), 'characters has frost_exhaustion');
  assert(charCols.includes('cold_wet_status'), 'characters has cold_wet_status');
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(r => r.name);
  assert(compCols.includes('frost_exhaustion'), 'companions has frost_exhaustion');
  assert(compCols.includes('cold_wet_status'), 'companions has cold_wet_status');
}

// ---------------------------------------------------------------------------
group('2. Pure Cold Level math — the approved scenario and its modifiers');
{
  const dry = cold.computeEffectiveColdLevel({ base: 2 });
  assert(dry === 2 && cold.exposureDc(dry) === 12, 'dry base 2 -> CL 2, DC 12');
  const clothed = cold.computeEffectiveColdLevel({ base: 2, hasClothing: true });
  assert(clothed === 0 && cold.exposureDc(clothed) === 10, 'dry + clothing -2 -> CL 0, DC 10');
  const wet = cold.computeEffectiveColdLevel({ base: 2, hasClothing: true, wetStatus: 'wet' });
  assert(wet === 2, 'wet strips clothing entirely (not a partial -1)');
  assert(cold.exposureAdvantage({ wetStatus: 'wet' }) === 'disadvantage', 'wet -> disadvantage');
  const soaked = cold.computeEffectiveColdLevel({ base: 2, hasClothing: true, wetStatus: 'soaked' });
  assert(soaked === 4 && cold.exposureDc(soaked) === 14, 'soaked +2, clothing stripped -> CL 4, DC 14');
  assert(cold.exposureAdvantage({ wetStatus: 'soaked' }) === 'disadvantage', 'soaked -> disadvantage');
  assert(cold.computeEffectiveColdLevel({ base: 2, campfire: true }) === 0, 'campfire -2');
  assert(cold.computeEffectiveColdLevel({ base: 2, insulatedTent: true }) === 0, 'insulated tent -2');
  assert(cold.computeEffectiveColdLevel({ base: 2, resting: true }) === 4, 'resting while exposed +2');
  assert(cold.computeEffectiveColdLevel({ base: 2, resting: true, properShelter: true }) === 2, 'proper shelter negates resting +2');
  assert(cold.computeEffectiveColdLevel({ base: 2, blizzard: true }) === 4, 'blizzard +2');
  assert(cold.computeEffectiveColdLevel({ base: 2, magicalBlizzard: true }) === 6, 'magical blizzard +4');
  assert(cold.computeEffectiveColdLevel({ base: 2, blizzard: true, magicalBlizzard: true }) === 6, 'magical blizzard supersedes plain blizzard, not +6');
  assert(cold.computeEffectiveColdLevel({ base: 2, elevation: 2 }) === 4, "Kelvin's Cairn peak +2");
  assert(cold.computeEffectiveColdLevel({ base: 0, elevation: 10 }) === 10, 'highest Spine peaks +10');
  assert(cold.computeEffectiveColdLevel({ base: 0, hasClothing: true }) === -2, 'below 0 means not exposed');
  assert(cold.exposureAdvantage({ coldResistant: true }) === 'advantage', 'cold resistance -> advantage');
  assert(cold.exposureAdvantage({ wetStatus: 'wet', coldResistant: true }) === null, 'wet + resistance cancel to null');
}

// ---------------------------------------------------------------------------
group('3. Dice judging + score erosion (the spiral)');
{
  const nat1 = cold.resolveExposureDice({ dice: [1], modifier: 10, dc: 5 });
  assert(nat1.outcome === 'critical_failure', 'nat 1 never succeeds, even at DC 5 with +10');
  const nat20 = cold.resolveExposureDice({ dice: [20], modifier: -5, dc: 30 });
  assert(nat20.outcome === 'critical_success', 'nat 20 always succeeds, even at DC 30 with -5');
  const adv = cold.resolveExposureDice({ dice: [4, 17], modifier: 3, dc: 12, advantage: 'advantage' });
  assert(adv.takenDie === 17 && adv.total === 20 && adv.outcome === 'success', 'advantage takes the higher die');
  const dis = cold.resolveExposureDice({ dice: [4, 17], modifier: 3, dc: 12, advantage: 'disadvantage' });
  assert(dis.takenDie === 4 && dis.total === 7 && dis.outcome === 'failure', 'disadvantage takes the lower die');
  const eroded = cold.erodeScores({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }, 2);
  assert(eroded.str === 14 && eroded.con === 14 && eroded.cha === 6, 'frost 2 erodes every score by 2');
  const missing = cold.erodeScores({}, 3);
  assert(missing.con === 7, 'unknown scores default to 10 before erosion');
  assert(cold.erodedConModifier({ con: 16 }, 0) === 3, 'CON 16 -> +3 unfrosted');
  assert(cold.erodedConModifier({ con: 16 }, 2) === 2, 'CON 16 frost 2 -> CON 14 -> +2 (the spiral)');
  assert(!cold.isFrostDead(cold.erodeScores({ con: 10 }, 9)), 'CON 10 frost 9 -> 1, alive');
  assert(cold.isFrostDead(cold.erodeScores({ con: 10 }, 10)), 'CON 10 frost 10 -> 0, dead');
}

// ---------------------------------------------------------------------------
group('4. Frost + wet state persists; recovery only while not exposed');
{
  const pcId = await makePc();
  let st = await cold.getFrostState('player', pcId);
  assert(st.frost === 0 && st.wetStatus === 'dry', 'fresh PC starts frost 0, dry');
  const bad = await cold.setWetStatus('player', pcId, 'damp');
  assert(!bad.success, 'unknown wet status is refused, not stored');
  await cold.setWetStatus('player', pcId, 'wet');
  st = await cold.getFrostState('player', pcId);
  assert(st.wetStatus === 'wet', 'wet status persists');
  await cold.setWetStatus('player', pcId, 'dry');
  const added = await cold.addFrostLevel('player', pcId, 2);
  assert(added.level === 2, 'addFrostLevel 0 -> 2');
  const row = await dbGet('SELECT frost_exhaustion FROM characters WHERE id = ?', [pcId]);
  assert(Number(row.frost_exhaustion) === 2, 'frost persists in the row, not just the return value');
  const noRec = await cold.recoverFrost('player', pcId, 8, false);
  assert(!noRec.changed && noRec.level === 2, 'resting while exposed recovers nothing');
  const rec = await cold.recoverFrost('player', pcId, 8, true);
  assert(rec.changed && rec.level === 0, 'resting while not exposed recovers 1/hour, floored at 0');
  const floor = await cold.recoverFrost('player', pcId, 8, true);
  assert(!floor.changed && floor.level === 0, 'recovery never goes below 0');
}

// ---------------------------------------------------------------------------
group('5. Frost death mirrors the exhaustion_6 death writes');
{
  const pcId = await makePc({
    ability_scores: JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  });
  const r = await cold.addFrostLevel('player', pcId, 10, cold.erodeScores({ con: 10 }, 10));
  assert(r.died && r.level === 10, 'frost 10 on CON 10 reports death');
  const row = await dbGet('SELECT current_hp, is_unconscious, is_dead FROM characters WHERE id = ?', [pcId]);
  assert(Number(row.current_hp) === 0 && Number(row.is_unconscious) === 1 && Number(row.is_dead) === 1,
    'frost death writes hp 0, unconscious, dead — same shape as exhaustion_6');
  const npcId = await insertRow('npcs', { name: 'Ash' });
  const compId = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'npc_stats', original_stats_snapshot: JSON.stringify({ cr: 1 }),
    companion_current_hp: 20, companion_max_hp: 20
  });
  const cr = await cold.addFrostLevel('companion', compId, 10, cold.erodeScores({}, 10));
  assert(cr.died, 'companion with default-10 scores dies at frost 10');
  const crow = await dbGet('SELECT companion_current_hp, status FROM companions WHERE id = ?', [compId]);
  assert(Number(crow.companion_current_hp) === 0 && crow.status === 'dead', 'companion frost death writes hp 0, status dead');
  // Frost is not a standard condition: the standard track is untouched.
  const conds = await dbGet('SELECT active_conditions FROM characters WHERE id = ?', [pcId]);
  assert(!String(conds?.active_conditions || '[]').includes('frost'), 'no frost key leaks into active_conditions');
}

// ---------------------------------------------------------------------------
group('6. Erosion flows through combatStats, rollRequest, partyAttack');
{
  const pcId = await makePc();
  const plain = rr.computePcModifier(
    { ability_scores: JSON.stringify({ str: 10, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }), level: 3, class: 'Fighter' },
    'save', 'Constitution');
  assert(plain.modifier === 5, 'unfrosted Fighter CON save: +3 CON + 2 proficiency = +5');
  const frosted = rr.computePcModifier(
    { ability_scores: JSON.stringify({ str: 10, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }), level: 3, class: 'Fighter', frost_exhaustion: 2 },
    'save', 'Constitution');
  assert(frosted.modifier === 4, 'frost 2 erodes the same save to +4');
  await dbRun('UPDATE characters SET frost_exhaustion = 2 WHERE id = ?', [pcId]);
  const dbMod = await rr.getPcCheckModifier(pcId, 'save', 'Constitution');
  assert(dbMod.modifier === 4, 'DB-backed check modifier reads frost_exhaustion from the row');
  const statsPlain = cc.calculateCombatStats({
    ability_scores: { str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 },
    equipment: { mainHand: { name: 'Longsword' } }, level: 3
  });
  assert(statsPlain.weapon.attackBonus === 5, 'unfrosted STR 16 longsword attack +5');
  const statsFrost = cc.calculateCombatStats({
    ability_scores: { str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 },
    equipment: { mainHand: { name: 'Longsword' } }, level: 3, frost_exhaustion: 2
  });
  assert(statsFrost.weapon.attackBonus === 4 && statsFrost.weapon.damageModifier === 2,
    'frost 2 erodes the same attack to +4, damage mod to +2');
  const prof = pa.buildAttackProfile('player', {
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 16, int: 10, wis: 12, cha: 8 }),
    equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    level: 3, class: 'Fighter', frost_exhaustion: 2
  });
  assert(prof.profile.attackBonus === 4, 'party attack profile erodes through combatStats, not a second copy');
  const spell = cc.spellProfileFor({
    ability_scores: { str: 10, dex: 14, con: 16, int: 16, wis: 12, cha: 8 }, level: 3, frost_exhaustion: 2
  }, 'Wizard');
  assert(spell.modifier === 2 && spell.saveDc === 12, 'frost 2 erodes spellcasting INT 16 -> 14 (+2, DC 12)');
}

// ---------------------------------------------------------------------------
group('7. Session exposure: spiral, companion, goliath, town, scene gate');
{
  const pcId = await makePc();
  const sessionId = await makeSession(pcId);
  await cold.setColdScene(sessionId, { baseColdLevel: 2 });
  // Die 5 every hour: CON 16 (+3) fails DC 12, then the spiral lowers it.
  const res = await cold.processExposureForSession({
    sessionId, characterId: pcId, hours: 3, diceForHour: () => [5]
  });
  assert(res.processed, 'exposure processes with a scene set');
  const actor = res.actors.find(a => a.kind === 'player');
  assert(actor.coldLevel === 2 && actor.dc === 12, 'scene base 2 -> CL 2, DC 12');
  assert(actor.hours.map(h => h.conMod).join(',') === '3,2,2', 'spiral: CON mod 3 -> 2 -> 2 across failed hours');
  assert(actor.frostAfter === 3, 'three failed hours -> frost 3');
  const row = await dbGet('SELECT frost_exhaustion FROM characters WHERE id = ?', [pcId]);
  assert(Number(row.frost_exhaustion) === 3, 'session exposure persists frost');
  const fmt = cold.formatColdBlock(res);
  assert(fmt.includes('Cold Level 2') && fmt.includes('frost 0 → 3'), 'DM block reports level and frost movement');

  // Companion on the same party: npc_stats, default-10 CON, die 5 fails.
  const npcId = await insertRow('npcs', { name: 'Bram' });
  await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    progression_type: 'npc_stats', original_stats_snapshot: JSON.stringify({ cr: 1 }),
    companion_current_hp: 20, companion_max_hp: 20
  });
  const res2 = await cold.processExposure({
    characterId: pcId, hours: 1, scene: { baseColdLevel: 2 }, diceForHour: () => [5]
  });
  const comp = res2.actors.find(a => a.kind === 'companion');
  assert(comp && comp.frostAfter === 1, 'npc_stats companion exposed on the same rules (default-10 CON fails DC 12)');

  // Goliath immunity and town suspension, each on a fresh PC.
  const golId = await makePc({ name: 'Gol', race: 'Goliath' });
  const gol = await cold.processExposure({
    characterId: golId, hours: 2, scene: { baseColdLevel: 2 }, diceForHour: () => [1]
  });
  assert(gol.actors[0].skipped === 'mountain_born_immune' && gol.actors[0].frostAfter === 0,
    'goliath Mountain Born is immune even on a nat 1');
  const townId = await makePc({ name: 'Town', current_location: 'the inn at Thornhollow' });
  const town = await cold.processExposure({
    characterId: townId, hours: 2, scene: { baseColdLevel: 2 }, diceForHour: () => [1]
  });
  assert(town.actors[0].skipped === 'suspended', 'town / warm structure suspends the system entirely');

  // No scene, no exposure: the system never invents a Cold Level.
  const barePc = await makePc({ name: 'Bare' });
  const bareSession = await makeSession(barePc);
  const bare = await cold.processExposureForSession({ sessionId: bareSession, characterId: barePc, hours: 2 });
  assert(!bare.processed && bare.reason === 'no cold scene set', 'TIME_ADVANCE without a scene does nothing cold');
}

// ---------------------------------------------------------------------------
group('8. TIME_ADVANCE hook + markers + sheltered-rest recovery');
{
  const pcId = await makePc();
  const sessionId = await makeSession(pcId);
  await cold.setColdScene(sessionId, { baseColdLevel: 2 });
  const evt = await rt.advanceTimeForSession({ sessionId, characterId: pcId, hours: 2 });
  assert(evt.cold && evt.cold.processed, 'TIME_ADVANCE carries a cold result when a scene is set');
  assert(evt.cold.actors[0].coldLevel === 2 && evt.cold.actors[0].hours.length === 2,
    'TIME_ADVANCE cold result covers every hour at the scene level');
  const row = await dbGet('SELECT frost_exhaustion FROM characters WHERE id = ?', [pcId]);
  assert(Number(row.frost_exhaustion) === evt.cold.actors[0].frostAfter,
    'TIME_ADVANCE frost in the DB matches the event it reports');
  const block = rt.formatTimeEventBlock(evt);
  assert(block.includes('COLD EXPOSURE'), 'time event text surfaces cold for the DM next turn');
  const noSceneSession = await makeSession(pcId);
  const evt2 = await rt.advanceTimeForSession({ sessionId: noSceneSession, characterId: pcId, hours: 1 });
  assert(!evt2.cold, 'TIME_ADVANCE without a scene carries no cold block');

  // Markers (direct handler calls — the real registered functions).
  const mSession = await makeSession(pcId);
  const sceneRes = await cold.handleColdSceneMarker(
    { BaseLevel: 3, Campfire: true }, { sessionId: mSession, characterId: pcId });
  assert(sceneRes.success && sceneRes.scene.baseColdLevel === 3 && sceneRes.scene.campfire === true,
    'COLD_SCENE marker stores base level + campfire on the session');
  const wetRes = await cold.handleColdWetMarker({ Target: 'Player', Status: 'wet' }, { sessionId: mSession, characterId: pcId });
  assert(wetRes.success && wetRes.wetStatus === 'wet', 'COLD_WET marker sets the PC wet');
  const badTarget = await cold.handleColdWetMarker({ Target: 'Nobody', Status: 'wet' }, { sessionId: mSession, characterId: pcId });
  assert(!badTarget.success, 'COLD_WET with an unknown target fails honestly');
  await cold.setWetStatus('player', pcId, 'dry');

  // Sheltered long rest recovers frost 1/hour.
  await dbRun('UPDATE characters SET frost_exhaustion = 3, current_location = ?, current_hp = 20 WHERE id = ?',
    ['the inn at Thornhollow', pcId]);
  const rest = await rt.applyRest({ sessionId: null, characterId: pcId, type: 'long' });
  assert(rest.success, 'sheltered long rest applies');
  const after = await dbGet('SELECT frost_exhaustion FROM characters WHERE id = ?', [pcId]);
  assert(Number(after.frost_exhaustion) === 0, 'sheltered 8h rest recovers frost 3 -> 0');
  assert(rest.event.cold && rest.event.cold.recovered, 'rest event reports the frost recovery');
  const restBlock = rt.formatTimeEventBlock(rest.event);
  assert(restBlock.includes('Frost recovered'), 'rest event text surfaces the recovery');

  // Resting while exposed in a scene: resting +2 applies, tent negates it.
  const coldPc = await makePc({ name: 'RestCold' });
  const restExp = await cold.processExposure({
    characterId: coldPc, hours: 1, scene: { baseColdLevel: 2 }, resting: true, diceForHour: () => [5]
  });
  assert(restExp.actors[0].coldLevel === 4, 'resting exposed: base 2 + resting 2 = CL 4');
  const tentExp = await cold.processExposure({
    characterId: coldPc, hours: 1, scene: { baseColdLevel: 2, insulatedTent: true }, resting: true, diceForHour: () => [8]
  });
  assert(tentExp.actors[0].coldLevel === 0, 'insulated tent: -2 and resting +2 negated -> CL 0');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed > 0) process.exit(1);
