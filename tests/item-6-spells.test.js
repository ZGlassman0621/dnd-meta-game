// tests/item-6-spells.test.js — combat item 6, spell fine print:
// enemy save/attack/auto-hit resolution, conditions + repeat saves,
// enemy concentration, party spell economy, Shield, Counterspell,
// multi-target rules, and the damage-hook trio.
// Real services, real DB. Assertions never depend on a roll: damage
// ranges, half/full relationships, budgets, reasons, and flags are
// asserted — never a hit, a save outcome, or a rolled total, except
// where the test itself supplies the reported total.
// NOT covered here (noted, not forgotten): Action Surge allowing a
// second action leveled spell is exercised only via the ledger patch
// in group 7 — the ACTION_SURGE marker's exact text was not re-read
// for this draft; the gate run should confirm it end to end.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item6-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const tl = await import(svc('server/services/turnLedgerService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const ast = await import(svc('server/services/actionStateService.js'));
const ess = await import(svc('server/services/enemySpellService.js'));
const ld = await import(svc('server/services/lastDamageService.js'));
const conc = await import(svc('server/services/concentrationService.js'));
const condSvc = await import(svc('server/services/conditionService.js'));
const { spellEffectSpec } = await import(svc('server/data/spellCatalog.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
await import(svc('server/services/spellCastService.js')); // registers SPELL_CAST
await import(svc('server/services/rollRequestService.js')); // registers ROLL_REQUEST + HELP_CHECK

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

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

async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Fighter', level: 5,
    current_hp: 40, max_hp: 40, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addCasterPc(over = {}) {
  return addPc({
    class: 'Wizard', level: 5,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 16, wis: 12, cha: 8 }),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
    spell_slots_used: JSON.stringify({}),
    ...over
  });
}

async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  await wid.assignWorldId('npcs', npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    progression_type: 'class_based', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 24, companion_max_hp: 24, armor_class: 14,
    ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}

async function addSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, status: 'active' });
}

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

async function cfg(sessionId) {
  const row = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  try { return JSON.parse(row?.session_config || '{}'); } catch { return {}; }
}

async function enemySlots(sessionId, enemyRowId) {
  const row = await dbGet('SELECT enemy_spell_slots_json FROM combat_enemies WHERE id = ?', [enemyRowId]);
  try { return JSON.parse(row?.enemy_spell_slots_json || '{}'); } catch { return {}; }
}

async function pcSlots(pcId) {
  const row = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pcId]);
  try { return JSON.parse(row?.spell_slots_used || '{}'); } catch { return {}; }
}

async function compSlots(compId) {
  const row = await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [compId]);
  try { return JSON.parse(row?.companion_spell_slots_used || '{}'); } catch { return {}; }
}

async function pcHp(pcId) {
  return (await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId]))?.current_hp;
}

async function compHp(compId) {
  return (await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [compId]))?.companion_current_hp;
}

async function enemyHp(enemyRowId) {
  return (await dbGet('SELECT current_hp FROM combat_enemies WHERE id = ?', [enemyRowId]))?.current_hp;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });
const arch = (name = 'Archmage') => ({ name, maxHp: 60, armorClass: 15, attackBonus: 3, damageDice: '1d6', dexMod: 1 });

// Order helper: entries are {name, type, key}; first entry holds turn 0.
async function order(sessionId, entries) {
  await ct.initializeTurnOrder(sessionId, 1, entries);
}
async function pcKey(pc) { return tl.ledgerKeyForPlayer(pc.id); }
async function compKey(comp) { return tl.ledgerKeyForCompanion(comp); }
function enemyKey(sessionId, row) { return `combat:${sessionId}:1:${row.id}`; }

group('1. Enemy save spell vs companion: server save, damage, slot');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
  ]);
  const hpBefore = await compHp(lyra.id);
  const r = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Lyra"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(r && r.success === true && r.spell === 'Lightning Bolt', 'Archmage Lightning Bolt resolves');
  const t = r.targets && r.targets[0];
  ok(t && t.total > 0 && t.applied > 0, 'companion takes damage (full or half, never zero for 8d6)');
  ok((await compHp(lyra.id)) === hpBefore - t.applied, 'companion HP drops by exactly the applied damage');
  const slots = await enemySlots(sessionId, mage.id);
  ok(slots['3'] === 2, '3rd-level slot spent (bestiary 3 seeded, 1 used)');
  const c = await cfg(sessionId);
  ok(Array.isArray(c.recentRolls) && c.recentRolls.some((x) => x.spell === 'Lightning Bolt'), 'companion save stashed in recent rolls');
}

group('2. Enemy save spell vs PC: pending, reported save, full/half/none');
{
  // Success path: reported total beats DC 17 -> half damage.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    const r = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Player"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.targets && r.targets[0].pending === true, 'PC save pends instead of resolving server-side');
    const c = await cfg(sessionId);
    ok(c.pendingRoll && c.pendingRoll.dc === 17, 'pending roll carries the bestiary DC 17');
    ok(c.pendingEnemySpellEffect && c.pendingEnemySpellEffect.spell === 'Lightning Bolt', 'pending effect stashed');
    ok(c.pendingRoll.effectKey === c.pendingEnemySpellEffect.key, 'effect key bound to the pending roll');
    const hpBefore = await pcHp(pc.id);
    const applied = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 20, dc: 17 });
    ok(applied && applied.applied === Math.floor(applied.total / 2), 'successful save halves the rolled damage');
    ok((await pcHp(pc.id)) === hpBefore - applied.applied, 'PC HP drops by exactly the halved damage');
    ok(!(await cfg(sessionId)).pendingEnemySpellEffect, 'pending effect slot clears after the report');
  }
  // Failure path, small spell so clamping cannot hide the math.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    const r = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Burning Hands" Level=1 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.targets && r.targets[0].pending === true, 'declared-DC Burning Hands pends for the PC');
    const c = await cfg(sessionId);
    const hpBefore = await pcHp(pc.id);
    const applied = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 5, dc: 14 });
    ok(applied && applied.applied === applied.total, 'failed save takes the full rolled damage (3d6 cannot exceed 40 HP)');
    ok((await pcHp(pc.id)) === hpBefore - applied.applied, 'PC HP drops by exactly the full damage');
  }
  // Refusal: no DC anywhere, nothing spent.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    const r = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Lightning Bolt" Level=3 Target="Player"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.success === false && /no save DC/.test(r.reason), 'save spell without any DC is refused, never invented');
    ok(JSON.stringify(await enemySlots(sessionId, g.id)) === '{}', 'refused cast spends no slot');
  }
  // Non-catalog spell stays tracking-only.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    // Tracking-only still costs a slot (slot honesty); without one the
    // slot check refuses before resolution ever sees the cast.
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4"]', pc.id, sessionId, 'ENEMY_SLOTS');
    const r = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Zzq Blast" Level=1 Target="Player"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.trackingOnly === true, 'spell outside the catalog resolves as tracking-only, never invented dice');
  }
}

group('3. Enemy attack-roll spells: bonus source, refusal, cantrip tiers');
{
  ok(spellEffectSpec('Fire Bolt', { casterLevel: 1 }).spec === '1d10', 'Fire Bolt tier 1 at caster level 1');
  ok(spellEffectSpec('Fire Bolt', { casterLevel: 5 }).spec === '2d10', 'Fire Bolt tier 2 at caster level 5');
  ok(spellEffectSpec('Fire Bolt', { casterLevel: 11 }).spec === '3d10', 'Fire Bolt tier 3 at caster level 11');
  ok(spellEffectSpec('Fire Bolt', { casterLevel: 17 }).spec === '4d10', 'Fire Bolt tier 4 at caster level 17');
  // No bonus anywhere -> refuse.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    ]);
    const r = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fire Bolt" Level=0 Target="Lyra"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.success === false && /attack bonus/.test(r.reason), 'attack-roll spell without any bonus is refused');
    ok(JSON.stringify(await enemySlots(sessionId, g.id)) === '{}', 'refused attack spell spends nothing (cantrips still check the bonus)');
  }
  // Bestiary bonus, then declared override.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    ]);
    const r1 = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Fire Bolt" Level=0 Target="Lyra"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r1 && r1.targets && r1.targets[0].attackBonus === 9 && r1.targets[0].targetAc === 14, 'bestiary attack bonus 9 vs companion AC 14');
    await ct.advanceTurn(sessionId, 1); // Tester
    await ct.advanceTurn(sessionId, 1); // Lyra
    await ct.advanceTurn(sessionId, 1); // Archmage, fresh action
    const r2 = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Fire Bolt" Level=0 Target="Lyra" AtkBonus=12]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r2 && r2.targets && r2.targets[0].attackBonus === 12, 'declared AtkBonus overrides the bestiary bonus');
  }
}

group('4. Magic Missile: dart splitting, shield blocks');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
  const [mage, gobB] = await es.createEncounterEnemies(sessionId, 1, [arch(), gob('GobB')]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
    { name: 'GobB', type: 'enemy', key: enemyKey(sessionId, gobB) },
  ]);
  const lyraHp = await compHp(lyra.id);
  const gobHp = await enemyHp(gobB.id);
  const r = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Magic Missile" Level=1 Targets="Lyra,GobB,GobB"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(r && r.success === true, 'missile cast resolves');
  const byName = Object.fromEntries((r.targets || []).map((t) => [t.target, t]));
  ok(byName.Lyra && byName.Lyra.darts === 1 && byName.Lyra.total >= 2 && byName.Lyra.total <= 5, 'one dart on Lyra: 1d4+1');
  ok(byName.GobB && byName.GobB.darts === 2 && byName.GobB.total >= 4 && byName.GobB.total <= 10, 'two darts on GobB: 2 x (1d4+1)');
  ok(byName.Lyra.applied === byName.Lyra.total && byName.GobB.applied === byName.GobB.total, 'missiles need no save and no attack roll: applied equals rolled');
  ok((await compHp(lyra.id)) === lyraHp - byName.Lyra.applied, 'Lyra HP drops by her dart total');
  ok((await enemyHp(gobB.id)) === gobHp - byName.GobB.applied, 'GobB HP drops by his dart total');
  const slots = await enemySlots(sessionId, mage.id);
  ok(slots['1'] === 3, 'missile spends its 1st-level slot (bestiary 4 seeded, 1 used)');
  // Shield blocks the next volley outright. Set AFTER the advances:
  // a shield set now would expire at the start of Lyra's next turn,
  // which falls inside the advance cycle.
  await ct.advanceTurn(sessionId, 1); // Tester
  await ct.advanceTurn(sessionId, 1); // Lyra
  await ct.advanceTurn(sessionId, 1); // GobB
  await ct.advanceTurn(sessionId, 1); // Archmage, fresh action
  await ess.setShield(sessionId, 1, await compKey(lyra));
  const r2 = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Magic Missile" Level=1 Targets="Lyra"]', pc.id, sessionId, 'ENEMY_CAST');
  const s = r2 && r2.targets && r2.targets[0];
  ok(s && s.shielded === true && s.applied === 0, 'shielded target takes no missile damage');
}

group('5. Conditions, repeat saves, concentration break, durations');
{
  // Hold Person on the PC: fail the pending save -> row + condition.
  // Then the turn boundary notices the repeat, and a made repeat save clears it.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    const r = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Hold Person" Level=2 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.targets && r.targets[0].pending === true, 'Hold Person pends for the PC save');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    // The engine stores spell names lowercase; query the stored form.
    const rows = await dbAll("SELECT * FROM spell_effects WHERE session_id = ? AND spell = 'hold person'", [sessionId]);
    ok(rows.length === 1 && rows[0].condition_name === 'paralyzed' && rows[0].repeat_save === 'end_of_turn' && rows[0].save_dc === 14, 'failed save writes the paralyzed row with its repeat rule and DC');
    ok((await condSvc.getConditions('player', pc.id)).includes('paralyzed'), 'PC carries paralyzed');
    // End the PC turn: boundary notices (never auto-rolls for the PC).
    await ct.advanceTurn(sessionId, 1); // Tester turn (GobA ends)
    await ct.advanceTurn(sessionId, 1); // GobA turn (Tester ends -> notice)
    const c2 = await cfg(sessionId);
    // Notices carry the stored lowercase spell name.
    ok(Array.isArray(c2.pendingDmNotices) && c2.pendingDmNotices.some((n) => /hold person/i.test(n) && /repeat/.test(n)), 'turn boundary notices the PC repeat save is due');
    const cleared = await ess.resolvePcRepeatSave(sessionId, { check: 'Wisdom', total: 20, dc: 14 });
    ok(cleared && cleared.cleared === true, 'made repeat save clears');
    ok((await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId])).length === 0, 'row deleted after the made save');
    ok(!(await condSvc.getConditions('player', pc.id)).includes('paralyzed'), 'paralyzed lifts with the row');
  }
  // Failed repeat save keeps the row.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Hold Person" Level=2 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    const kept = await ess.resolvePcRepeatSave(sessionId, { check: 'Wisdom', total: 3, dc: 14 });
    ok(kept && kept.cleared === false, 'failed repeat save keeps the row');
    ok((await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId])).length === 1, 'row survives a failed repeat save');
  }
  // Flesh to stone counts: three failures petrify, three successes end it.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Flesh to Stone" Level=6 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 2, dc: 14 });
    await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 2, dc: 14 });
    const third = await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 2, dc: 14 });
    ok(third && third.petrified === true, 'third failed save petrifies');
    const row = (await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId]))[0];
    ok(row && row.condition_name === 'petrified' && row.repeat_save === 'none', 'petrified row keeps no further saves');
    ok((await condSvc.getConditions('player', pc.id)).includes('petrified'), 'PC carries petrified');
  }
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Flesh to Stone" Level=6 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 20, dc: 14 });
    await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 20, dc: 14 });
    const third = await ess.resolvePcRepeatSave(sessionId, { check: 'Constitution', total: 20, dc: 14 });
    ok(third && third.cleared === true, 'third successful save ends flesh to stone');
    ok((await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId])).length === 0, 'row deleted after three successes');
  }
  // Enemy concentration: start, replace, break clears effects; paralysis breaks it.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Stoneskin" Level=4]', pc.id, sessionId, 'ENEMY_CAST');
    ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) === 'Stoneskin', 'concentration spell starts enemy concentration');
    await ct.advanceTurn(sessionId, 1); // Tester
    await ct.advanceTurn(sessionId, 1); // Archmage, fresh action
    await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Wall of Force" Level=5]', pc.id, sessionId, 'ENEMY_CAST');
    ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) === 'Wall of Force', 'new concentration spell replaces the old one');
    const broken = await conc.breakEnemyConcentration(sessionId, 1, mage.id);
    ok(broken && (await conc.getEnemyConcentration(sessionId, 1, mage.id)) == null, 'break clears concentrating_on');
    // Paralysis breaks concentration via the condition hook.
    await ct.advanceTurn(sessionId, 1); // Tester
    await ct.advanceTurn(sessionId, 1); // Archmage, fresh action
    await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Stoneskin" Level=4]', pc.id, sessionId, 'ENEMY_CAST');
    ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) === 'Stoneskin', 'concentration restarts');
    await ess.applySpellCondition(sessionId, 1, { kind: 'enemy', id: mage.id, name: 'Archmage' }, 'Hold Person', { kind: 'player', id: pc.id, name: 'Tester' }, { condition: 'paralyzed', saveAbility: 'wis', saveDc: 14 });
    ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) == null, 'paralysis breaks enemy concentration');
  }
  // Non-concentration 1-minute condition records 10 rounds.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Blindness/Deafness" Level=2 Target="Player" Dc=14 Choice="blinded"]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    const row = (await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId]))[0];
    ok(row && row.condition_name === 'blinded' && row.rounds_remaining === 10, '1-minute non-concentration condition records 10 rounds');
  }
}

group('6. Enemy concentration: damage path reports the check, break clears rows');
{
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
  const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
  await order(sessionId, [
    { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    { name: 'Tester', type: 'player', key: await pcKey(pc) },
    { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
  ]);
  await conc.startEnemyConcentration(sessionId, 1, mage.id, 'Stoneskin');
  ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) === 'Stoneskin', 'direct start sets concentrating_on');
  // A concentration effect row tied to this caster, then break deletes it.
  await ess.createSpellEffect(sessionId, 1, { kind: 'companion', id: lyra.id, name: 'Lyra' }, 'Stoneskin', { kind: 'enemy', key: enemyKey(sessionId, mage), name: 'Archmage' }, { condition: 'blinded', saveAbility: null, saveDc: null, repeat: 'none', rounds: null, concentration: true });
  ok((await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId])).length === 1, 'concentration row recorded');
  const dmg = await es.applyPartyDamageToEnemy(sessionId, 1, 'Archmage', 10, pc.id, { damageType: 'slashing' });
  ok(dmg && 'concentrationCheck' in dmg, 'party damage to a concentrating enemy reports the concentration check');
  // The damage step's concentration save is a real d20: if it fails,
  // damage already broke concentration and deleted the row. Re-establish
  // both (idempotent: the row write deletes-then-inserts) so the break
  // below deterministically tests break, not the die.
  await conc.startEnemyConcentration(sessionId, 1, mage.id, 'Stoneskin');
  await ess.createSpellEffect(sessionId, 1, { kind: 'companion', id: lyra.id, name: 'Lyra' }, 'Stoneskin', { kind: 'enemy', key: enemyKey(sessionId, mage), name: 'Archmage' }, { condition: 'blinded', saveAbility: null, saveDc: null, repeat: 'none', rounds: null, concentration: true });
  const broken = await conc.breakEnemyConcentration(sessionId, 1, mage.id);
  ok(broken && (await dbAll("SELECT * FROM spell_effects WHERE session_id = ?", [sessionId])).length === 0, 'break deletes the caster concentration rows');
  ok((await conc.getEnemyConcentration(sessionId, 1, mage.id)) == null, 'break clears concentrating_on');
}

group('7. Party spell economy: bonus rule, action charging, gating');
{
  // Bonus leveled first, then action leveled: refused, slot untouched.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const b = await markerResult('[SPELL_CAST: Spell="Healing Word" Level=1 Bonus="true" Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(b && b.success === true, 'bonus Healing Word casts');
    const a = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === false, 'action leveled spell after a bonus spell is refused');
    ok((await pcSlots(pc.id))['1'] === 1, 'refused spell spends no slot (only Healing Word used one)');
    const b2 = await markerResult('[SPELL_CAST: Spell="Healing Word" Level=1 Bonus="true" Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(b2 && b2.success === false, 'second bonus spell same turn refused (bonus spent)');
  }
  // Reverse order: action leveled first, then bonus leveled: refused.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const a = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === true, 'action Magic Missile casts');
    const b = await markerResult('[SPELL_CAST: Spell="Healing Word" Level=1 Bonus="true" Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(b && b.success === false, 'bonus leveled spell after an action leveled spell is refused');
    ok((await pcSlots(pc.id))['1'] === 1, 'refused bonus spell spends no slot');
  }
  // Bonus cantrip still restricts: bonus Shillelagh, then action leveled refused.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const b = await markerResult('[SPELL_CAST: Spell="Shillelagh" Level=0 Bonus="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(b && b.success === true, 'bonus cantrip casts');
    const a = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === false, 'action leveled spell after ANY bonus spell is refused (symmetric rule)');
  }
  // Bonus leveled + action cantrip: allowed.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const b = await markerResult('[SPELL_CAST: Spell="Healing Word" Level=1 Bonus="true" Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(b && b.success === true, 'bonus Healing Word casts');
    const a = await markerResult('[SPELL_CAST: Spell="Sacred Flame" Level=0 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === true, 'action cantrip after a bonus leveled spell is allowed');
  }
  // Two action leveled spells, no surge: second refused. With a surge: both land.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const a1 = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a1 && a1.success === true, 'first action leveled spell casts');
    const a2 = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a2 && a2.success === false, 'second action leveled spell without a surge is refused');
  }
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const st = await ct.getTurnState(sessionId, 1);
    const slot = tl.slotKeyFor(1, st.round, st.currentIndex);
    await tl.updateBudgetForSlot(sessionId, 1, slot, await pcKey(pc), { surgesSpent: 1 });
    const a1 = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    const a2 = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a1 && a1.success === true && a2 && a2.success === true, 'Action Surge allows two action leveled spells');
    ok((await pcSlots(pc.id))['1'] === 2, 'both surged casts spend their slots');
  }
  // Attack first, then action spell: refused (the action is spent).
  {
    const pc = await addPc({
      class: 'Paladin', level: 5,
      spell_slots: JSON.stringify({ 1: 4, 2: 2 }), spell_slots_used: JSON.stringify({}),
      equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }),
    });
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const atk = await markerResult('[ATTACK: Attacker="Player" Target="GobA"]', pc.id, sessionId, 'ATTACK');
    ok(atk && atk.success !== false, 'melee attack declares (pending)');
    const a = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === false, 'action spell after an attack is refused');
    ok(((await pcSlots(pc.id))['1'] || 0) === 0, 'refused spell spends no slot');
  }
  // Off-turn member refused; non-member passes; no order is legacy.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const wren = await addCompanion('Wren', pc.id, { companion_class: 'Cleric' });
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    await ct.advanceTurn(sessionId, 1); // GobA turn
    const off = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(off && off.success === false && /turn/.test(off.reason || ''), 'off-turn member cast refused with a turn remedy');
    ok(((await pcSlots(pc.id))['1'] || 0) === 0, 'refused off-turn cast spends no slot');
    const nm = await markerResult('[SPELL_CAST: Caster="Wren" Spell="Cure Wounds" Level=1 Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(nm && nm.success === true, 'non-member companion cast passes gating');
    ok((await compSlots(wren.id))['1'] === 1, 'non-member cast still spends its slot');
  }
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    const r = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.success === true, 'no turn order: cast resolves legacy-unenforced');
  }
}

group('8. Shield: +5 AC on every attack path, expiry at next turn');
{
  // Party Shield vs enemy attack: targetAc carries the +5.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const s = await markerResult('[SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(s && s.success === true, 'party Shield casts as a reaction');
    const entry = await ast.getEntry(sessionId, 1, await pcKey(pc));
    ok(entry && entry.shield && entry.shield.acBonus === 5, 'shield entry holds +5 AC');
    ok((await pcSlots(pc.id))['1'] === 1, 'Shield spends its slot');
    await ct.advanceTurn(sessionId, 1); // GobA turn
    const atk = await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Player"]', pc.id, sessionId, 'ENEMY_ATTACK');
    ok(atk && atk.targetAc === 21, 'enemy attack judges against 16 + 5 shield');
  }
  // Companion Shield vs enemy attack.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Wizard' });
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    await ct.advanceTurn(sessionId, 1); // Lyra
    await ct.advanceTurn(sessionId, 1); // GobA
    // Shield cast on GobA's turn: it lasts until Lyra's next turn starts,
    // so it is still live for this attack (casting it earlier would have
    // expired it at the start of Lyra's own turn).
    const s = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(s && s.success === true, 'companion Shield casts as a reaction');
    const atk = await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Lyra"]', pc.id, sessionId, 'ENEMY_ATTACK');
    ok(atk && atk.targetAc === 19, 'enemy attack judges against companion 14 + 5 shield');
  }
  // Enemy Shield vs PC pending attack: judgment recomputes past the snapshot.
  {
    const pc = await addPc({ equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    ]);
    // Control: no shield, reported 10 + 6 beats AC 15.
    const atk1 = await markerResult('[ATTACK: Attacker="Player" Target="Archmage"]', pc.id, sessionId, 'ATTACK');
    ok(atk1 && atk1.success !== false, 'PC attack declares (pending)');
    const { resolveReportedAttack } = await import(svc('server/services/partyAttackService.js'));
    const j1 = await resolveReportedAttack(sessionId, pc.id, [10], 5);
    ok(j1 && j1.hit === true, 'reported 10 hits AC 15 without a shield');
    // Fresh turn for the second declaration (the first attack spent the action).
    await ct.advanceTurn(sessionId, 1); // Archmage
    await ct.advanceTurn(sessionId, 1); // Tester, fresh action
    // Shielded: same reported 10 misses AC 15 + 5.
    const atk2 = await markerResult('[ATTACK: Attacker="Player" Target="Archmage"]', pc.id, sessionId, 'ATTACK');
    ok(atk2 && atk2.success !== false, 'second PC attack declares (pending)');
    await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'ENEMY_CAST');
    const j2 = await resolveReportedAttack(sessionId, pc.id, [10], 5);
    ok(j2 && j2.hit === false, 'reported 10 misses once Shield raises the target to 20');
  }
  // Shield expires at the start of the caster next turn.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    await markerResult('[SPELL_CAST: Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok((await ast.getEntry(sessionId, 1, await pcKey(pc))).shield, 'shield live after casting');
    await ct.advanceTurn(sessionId, 1); // GobA: shield still live
    ok((await ast.getEntry(sessionId, 1, await pcKey(pc))).shield, 'shield survives intervening turns');
    await ct.advanceTurn(sessionId, 1); // Tester next turn starts
    ok(!(await ast.getEntry(sessionId, 1, await pcKey(pc))).shield, 'shield expires at the start of the caster next turn');
  }
}

group('9. Counterspell: same-message party, armed enemy, PC deferral');
{
  // Service-level party counter: arm, match, consume.
  {
    const ctx = {};
    ess.armPartyCounter(ctx, { counterspeller: 'Tester', dc: 13, targetName: 'Archmage' });
    const found = ess.takePartyCounter(ctx, 'Archmage');
    ok(found && found.counterspeller === 'Tester' && found.dc === 13, 'party counter arms and matches by target name');
    ok(ess.takePartyCounter(ctx, 'Archmage') === null, 'party counter consumes on use');
    ess.armPartyCounter(ctx, { counterspeller: 'Tester', dc: 13 });
    const any = ess.takePartyCounter(ctx, 'Whoever');
    ok(any && any.counterspeller === 'Tester', 'untargeted counter fires on the first cast');
  }
  // Same-message party counter vs enemy cast: slot spent, either fizzle or completion.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    const res = await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Counterspell" Level=3 Target="Archmage" Reaction="true"] [ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Player"]', { characterId: pc.id, sessionId });
    const ec = res.handlerResults.filter((hr) => hr.schemaKey === 'ENEMY_CAST')[0].result;
    ok((await pcSlots(pc.id))['3'] === 1, 'Counterspell spends its 3rd-level slot either way');
    const c = await cfg(sessionId);
    if (ec.countered === true) {
      ok(!c.pendingEnemySpellEffect, 'countered cast leaves no pending effect');
    } else {
      ok(ec.targets && ec.targets[0].pending === true, 'uncountered cast completes into the pending save');
    }
  }
  // Mismatched counter target: no interception, cast completes.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    const res = await pipeline.processResponseMarkers('[SPELL_CAST: Spell="Counterspell" Level=3 Target="GobB" Reaction="true"] [ENEMY_CAST: Enemy="Archmage" Spell="Lightning Bolt" Level=3 Target="Player"]', { characterId: pc.id, sessionId });
    const ec = res.handlerResults.filter((hr) => hr.schemaKey === 'ENEMY_CAST')[0].result;
    ok(ec.targets && ec.targets[0].pending === true, 'counter aimed elsewhere does not intercept');
  }
  // Enemy counter vs companion: slot spent either way, counter consumed.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const wren = await addCompanion('Wren', pc.id, { companion_class: 'Cleric' });
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await ess.armEnemyCounter(sessionId, 1, { enemyName: 'Archmage', dc: 17, targetName: null });
    const r = await markerResult('[SPELL_CAST: Caster="Wren" Spell="Cure Wounds" Level=1 Target="Tester"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && (r.countered === true || r.success === true), 'companion cast either fizzles or completes under the counter');
    ok((await compSlots(wren.id))['1'] === 1, 'companion slot spent on fizzle and on completion alike');
    ok((await ess.takeEnemyCounter(sessionId, 1, 'Wren')) === null, 'enemy counter consumed by the cast');
  }
  // Enemy counter vs PC: deferral, then fizzle or completion on the reported save.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    ]);
    await ess.armEnemyCounter(sessionId, 1, { enemyName: 'Archmage', dc: 17, targetName: 'Tester' });
    const r = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="Archmage"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.countered === 'pending', 'PC cast defers under an armed enemy counter');
    ok((await pcSlots(pc.id))['1'] === 1, 'deferred cast spends its slot at declaration');
    const c = await cfg(sessionId);
    ok(c.pendingCounteredCast && c.pendingCounteredCast.spell === 'Magic Missile', 'countered cast stashed for the reported save');
    const fizzle = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 17 });
    ok(fizzle && fizzle.countered === true, 'failed Con save fizzles the cast');
    ok((await pcSlots(pc.id))['1'] === 1, 'fizzled cast spends no second slot');
    ok(!(await cfg(sessionId)).pendingCounteredCast, 'countered slot clears after the fizzle');
  }
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [mage] = await es.createEncounterEnemies(sessionId, 1, [arch()]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
    ]);
    await ess.armEnemyCounter(sessionId, 1, { enemyName: 'Archmage', dc: 17, targetName: 'Tester' });
    await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="Archmage"]', pc.id, sessionId, 'SPELL_CAST');
    const c = await cfg(sessionId);
    const done = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 20, dc: 17 });
    ok(done && done.countered === false && done.completed && done.completed.success === true, 'made Con save completes the stored cast');
    ok(done.completed.slotConsumed === false, 'completion reports no second slot spend');
    ok((await pcSlots(pc.id))['1'] === 1, 'completed cast still holds exactly one spent slot');
  }
}

group('10. Multi-target: independent saves, upcast count, reaction-only gate');
{
  // Fireball at two targets: each saves independently, each takes damage.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Fighter' });
    const [mage, gobB] = await es.createEncounterEnemies(sessionId, 1, [arch(), gob('GobB')]);
    await order(sessionId, [
      { name: 'Archmage', type: 'enemy', key: enemyKey(sessionId, mage) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
      { name: 'GobB', type: 'enemy', key: enemyKey(sessionId, gobB) },
    ]);
    const r = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Fireball" Level=3 Targets="Lyra,GobB"]', pc.id, sessionId, 'ENEMY_CAST');
    ok(r && r.targets && r.targets.length === 2, 'two targets resolve');
    ok(r.targets.every((t) => t.applied > 0), 'each target takes damage (8d6, half at worst)');
    const c = await cfg(sessionId);
    ok(Array.isArray(c.recentRolls) && c.recentRolls.filter((x) => x.spell === 'Fireball').length === 2, 'two independent saves stashed');
  }
  // Hold Person upcast count: L2 allows one target, L3 allows two.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g1, g2] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA'), gob('GobB')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g1) },
      { name: 'GobB', type: 'enemy', key: enemyKey(sessionId, g2) },
    ]);
    const r = await markerResult('[SPELL_CAST: Spell="Hold Person" Level=2 Targets="GobA,GobB"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.success === false && /target/.test(r.reason || ''), 'two targets on a 2nd-level Hold Person refused');
    ok(((await pcSlots(pc.id))['2'] || 0) === 0, 'refused upcast check spends no slot');
    const r2 = await markerResult('[SPELL_CAST: Spell="Hold Person" Level=3 Targets="GobA,GobB"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r2 && r2.success !== false, 'two targets on a 3rd-level Hold Person allowed');
  }
  // Reaction-only spell without Reaction: refused, slot untouched.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const r = await markerResult('[SPELL_CAST: Spell="Shield" Level=1]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.success === false && /reaction/.test(r.reason || ''), 'reaction-only spell without Reaction refused');
    ok(((await pcSlots(pc.id))['1'] || 0) === 0, 'refused reaction-only cast spends no slot');
  }
  // Party multi-target Magic Missile cannot split through the single reported total.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g1, g2] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA'), gob('GobB')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g1) },
      { name: 'GobB', type: 'enemy', key: enemyKey(sessionId, g2) },
    ]);
    const r = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Targets="GobA,GobB"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r && r.success === false && /target/.test(r.reason || ''), 'party missile across distinct targets refused with a remedy');
    const r2 = await markerResult('[SPELL_CAST: Spell="Magic Missile" Level=1 Targets="GobA,GobA"]', pc.id, sessionId, 'SPELL_CAST');
    ok(r2 && r2.success === true, 'party missile with repeated names on one target allowed');
  }
}

group('11. Damage trio: Absorb, Rebuke, Backlash, and their guards');
{
  // Absorb: halves the burn, banks the rider, rider spends on the next same-zone melee hit.
  // The PC is the reactor here so the spending hit can be a reported nat 20 (always hits);
  // a companion attack could miss on a nat 1 and flake the rider-consumed assert.
  {
    const pc = await addCasterPc({ equipment: JSON.stringify({ mainHand: { name: 'Longsword' } }) });
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Burning Hands" Level=1 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    const fail = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    const rec = await ld.peekDamage(sessionId, 'player', pc.id);
    ok(rec && rec.amount === fail.applied && rec.type === 'fire', 'burning hands records fire damage on the PC');
    const hpBefore = await pcHp(pc.id);
    const a = await markerResult('[SPELL_CAST: Spell="Absorb Elements" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a && a.success === true, 'Absorb casts as a reaction');
    ok(a.refunded === rec.amount - Math.floor(rec.amount / 2), 'Absorb refunds the rounded-up half');
    ok((await pcHp(pc.id)) === hpBefore + a.refunded, 'PC HP rises by exactly the refund');
    const rider = await ess.absorbRiderFor(sessionId, 1, await pcKey(pc));
    ok(rider && rider.type === 'fire', 'rider banks the absorbed fire type');
    await ct.advanceTurn(sessionId, 1); // Tester turn (rider lasts through it by design)
    const atk = await markerResult('[ATTACK: Attacker="Player" Target="GobA"]', pc.id, sessionId, 'ATTACK');
    ok(atk && atk.success !== false, 'PC melee attack declares (pending)');
    const { resolveReportedAttack } = await import(svc('server/services/partyAttackService.js'));
    const j = await resolveReportedAttack(sessionId, pc.id, [20], 5);
    ok(j && j.hit === true, 'reported nat 20 hits');
    ok((await ess.absorbRiderFor(sessionId, 1, await pcKey(pc))) === null, 'rider consumed by the next melee hit');
    const a2 = await markerResult('[SPELL_CAST: Spell="Absorb Elements" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(a2 && a2.success === false, 'second Absorb refused: the record is consumed and the reaction is spent');
  }
  // Absorb refuses weapon damage (no element) and no record at all.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Wizard', armor_class: 5 });
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    const none = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Absorb Elements" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(none && none.success === false && /no recent damage/.test(none.reason || ''), 'Absorb with no damage record refused');
    await ct.advanceTurn(sessionId, 1); // Lyra
    await ct.advanceTurn(sessionId, 1); // GobA
    // GobA's attack is a real d20 and a miss records nothing. Retry
    // across fresh GobA turns until a hit records (low AC makes the
    // first attempt land all but a fumble, so the loop is insurance).
    let rec = null;
    for (let i = 0; i < 8 && !rec; i++) {
      await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Lyra"]', pc.id, sessionId, 'ENEMY_ATTACK');
      rec = await ld.peekDamage(sessionId, 'companion', lyra.id);
      if (!rec) {
        await ct.advanceTurn(sessionId, 1); // Tester
        await ct.advanceTurn(sessionId, 1); // Lyra
        await ct.advanceTurn(sessionId, 1); // GobA
      }
    }
    ok(rec && rec.type == null, 'weapon damage records with no element type');
    const w = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Absorb Elements" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(w && w.success === false, 'Absorb refused on unattributed weapon damage');
    ok((await compSlots(lyra.id))['1'] === 0 || (await compSlots(lyra.id))['1'] == null, 'refused Absorb spends no slot');
  }
  // Rebuke: attacker saves or takes 2d10 fire; retaliation machinery pends for a PC attacker.
  {
    const pc = await addPc();
    const sessionId = await addSession(pc.id);
    const lyra = await addCompanion('Lyra', pc.id, { companion_class: 'Wizard', armor_class: 5 });
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
      { name: 'Lyra', type: 'companion', key: await compKey(lyra) },
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
    ]);
    await ct.advanceTurn(sessionId, 1); // Lyra
    await ct.advanceTurn(sessionId, 1); // GobA
    const gobHpBefore = await enemyHp(g.id);
    // Same d20 dependence as the weapon-damage block: retry GobA's
    // attack across fresh turns until a hit records, so the Rebuke
    // below always has a triggering hit to answer.
    for (let i = 0; i < 8; i++) {
      await markerResult('[ENEMY_ATTACK: Enemy="GobA" Target="Lyra"]', pc.id, sessionId, 'ENEMY_ATTACK');
      if (await ld.peekDamage(sessionId, 'companion', lyra.id)) break;
      await ct.advanceTurn(sessionId, 1); // Tester
      await ct.advanceTurn(sessionId, 1); // Lyra
      await ct.advanceTurn(sessionId, 1); // GobA
    }
    const rb = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Hellish Rebuke" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(rb && rb.success === true, 'Rebuke casts as a reaction');
    ok((await enemyHp(g.id)) < gobHpBefore, 'attacker takes retaliation damage (full or half of 2d10, never zero)');
    ok((await compSlots(lyra.id))['1'] === 1, 'Rebuke spends its slot');
    const sh = await markerResult('[SPELL_CAST: Caster="Lyra" Spell="Shield" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(sh && sh.success === false, 'second reaction the same round refused (budget 1/round)');
  }
  // Backlash: PC reduction pends for the reported total, refunds capped, retaliates.
  // Burning Hands (3d6) so the triggering hit can never kill the reactor outright.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Burning Hands" Level=1 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    const fail = await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    const rec = await ld.peekDamage(sessionId, 'player', pc.id);
    ok(rec && rec.amount === fail.applied, 'burning hands records the applied damage on the PC');
    const hpBefore = await pcHp(pc.id);
    const gobHpBefore = await enemyHp(g.id);
    const bl = await markerResult('[SPELL_CAST: Spell="Backlash" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(bl && bl.pendingReduction === true, 'Backlash reduction pends for the player reported total');
    const done = await ess.resolveBacklashReduction(sessionId, 10);
    ok(done && done.refunded === Math.min(10, rec.amount), 'refund capped at the damage taken');
    ok((await pcHp(pc.id)) === hpBefore + done.refunded, 'PC HP rises by exactly the refund');
    ok((await enemyHp(g.id)) < gobHpBefore, 'attacker takes the Con retaliation (full or half of 4d6, never zero)');
    ok(!(await cfg(sessionId)).pendingBacklashReduction, 'backlash slot clears after resolution');
  }
  // Backlash refused when the reactor is down.
  {
    const pc = await addCasterPc();
    const sessionId = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sessionId, 1, [gob('GobA')]);
    await order(sessionId, [
      { name: 'GobA', type: 'enemy', key: enemyKey(sessionId, g) },
      { name: 'Tester', type: 'player', key: await pcKey(pc) },
    ]);
    await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:4,2:3,6:1"]', pc.id, sessionId, 'ENEMY_SLOTS');
    await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Burning Hands" Level=1 Target="Player" Dc=14]', pc.id, sessionId, 'ENEMY_CAST');
    const c = await cfg(sessionId);
    await ess.applyPendingSaveEffect(sessionId, c.pendingRoll.effectKey, { total: 2, dc: 14 });
    await dbRun('UPDATE characters SET current_hp = 0 WHERE id = ?', [pc.id]);
    const bl = await markerResult('[SPELL_CAST: Spell="Backlash" Level=1 Reaction="true"]', pc.id, sessionId, 'SPELL_CAST');
    ok(bl && bl.success === false, 'Backlash refused when the reactor is down');
  }
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
