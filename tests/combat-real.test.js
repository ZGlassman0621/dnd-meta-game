/**
 * tests/combat-real.test.js — combat, made real (v1.0.191; design:
 * combat-real-design.md, builds B1–B6).
 *
 * Pins:
 *   - migration 084: enemy conditions, companion concentration, party
 *     cover state;
 *   - B1: ONE combat-stats truth — the prompt's equipment math is now
 *     the combat math; ENEMY_ATTACK believes computed AC over the
 *     armor_class column; initiative uses real DEX modifiers;
 *   - B2: party attacks resolve — PC pending attacks judged from the
 *     player's reported dice, companion attacks server-rolled from
 *     true sheets, conditions compute adv/dis on both sides, cover
 *     counts, the rally buff lands, kills flow through the same
 *     death/loot path as ENEMY_DAMAGE;
 *   - B3: enemies carry conditions that bend attacks both directions;
 *   - B4: companion SPELL_CAST consumes companion slots and tracks
 *     companion concentration; npc_stats companions are not casters;
 *   - B5: SPELL_CAST Target= rolls the enemy's save against the
 *     caster's true DC; a paralyzed enemy auto-fails a DEX save;
 *   - B6: opportunity attacks resolve real attacks and still spend
 *     the reaction exactly once.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-combat-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const stats = await import(svc('server/services/combatStatsService.js'));
const pas = await import(svc('server/services/partyAttackService.js'));
const cs = await import(svc('server/services/conditionService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const conc = await import(svc('server/services/concentrationService.js'));
const scs = await import(svc('server/services/spellCastService.js'));
const turnSvc = await import(svc('server/services/combatTurnService.js'));
const moraleSvc = await import(svc('server/services/moraleService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers
const { getSpellSlots } = await import(svc('server/config/levelProgression.js'));

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

const marker = async (text, ctx) => {
  const res = await pipeline.processResponseMarkers(text, ctx);
  return res.handlerResults[0]?.result;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
// Garrick: L3 fighter, longsword + chain mail. His armor_class COLUMN
// is deliberately stale (10) — B1 says combat believes the equipment.
const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 30, max_hp: 30, armor_class: 10,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  equipment: JSON.stringify({
    mainHand: { name: 'Longsword', damage: '1d8', damageType: 'slashing' },
    armor: { name: 'Chain Mail' }
  }),
  skills: JSON.stringify([])
});
// Sera: L3 cleric, WIS 16 → spell save DC 13, attack +5.
const seraId = await insertRow('characters', {
  name: 'Sera', class: 'Cleric', level: 3,
  current_hp: 24, max_hp: 24, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([])
});
async function addCompanion(name, over) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    ...over
  });
  return id;
}
// Lyra: class_based ranger L3, name-only shortsword (WEAPON_DATA finesse).
const lyraId = await addCompanion('Lyra', {
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 8 }),
  equipment: JSON.stringify({ mainHand: { name: 'Shortsword' } }),
  companion_current_hp: 20, companion_max_hp: 20, armor_class: 15
});
// Wren: class_based cleric L3, WIS 16 → save DC 13.
const wrenId = await addCompanion('Wren', {
  progression_type: 'class_based', companion_class: 'Cleric', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 12 }),
  equipment: JSON.stringify({}),
  companion_current_hp: 18, companion_max_hp: 18, armor_class: 14
});
// Grub: npc_stats — not a caster, CR-fallback attacker.
const grubId = await addCompanion('Grub', {
  progression_type: 'npc_stats', original_stats_snapshot: JSON.stringify({ cr: 1 }),
  companion_ability_scores: JSON.stringify({ str: 14 }),
  companion_current_hp: 10, companion_max_hp: 10, armor_class: 12
});

const sessionA = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const sessionB = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const sessionC = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const CTX = { characterId: pcId, sessionId: sessionA };
// Combat item 3: one swing per turn per combatant, so each
// illustrative attack in this file gets its own turn — a full round
// of advances returns to the same combatant in a fresh slot.
const advanceRound = async () => { for (let i = 0; i < 3; i++) await turnSvc.advanceTurn(sessionA, 1); };

await es.createEncounterEnemies(sessionA, 1, [
  { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
  { name: 'Orc', maxHp: 60, armorClass: 13, attackBonus: 5, damageDice: '1d12+3', dexMod: 1 },
  // A third body keeps the group-7 kill at 33% casualties — under the
  // morale threshold. At 50% the Orc rolled a break save and fled in
  // ~45% of runs, and a fled enemy is unfindable for group 8's cover
  // asserts (the system working as designed; the test must not depend
  // on a morale coin flip).
  { name: 'Wolf', maxHp: 10, armorClass: 12, attackBonus: 4, damageDice: '1d6+1', dexMod: 2 }
]);
await turnSvc.initializeTurnOrder(sessionA, 1, [
  { name: 'Garrick', type: 'player' }, { name: 'Lyra', type: 'companion' }, { name: 'Goblin', type: 'enemy' }
]);

// ---------------------------------------------------------------------------
group('1. Migration 084 — combat-real state columns');
{
  const enemyCols = (await dbAll('PRAGMA table_info(combat_enemies)')).map(r => r.name);
  assert(enemyCols.includes('active_conditions'), 'combat_enemies has active_conditions');
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(r => r.name);
  assert(compCols.includes('concentrating_on'), 'companions has concentrating_on');
  const turnCols = (await dbAll('PRAGMA table_info(combat_turn_state)')).map(r => r.name);
  assert(turnCols.includes('party_cover_json'), 'combat_turn_state has party_cover_json');
}

// ---------------------------------------------------------------------------
group('2. B1 — one combat-stats truth');
{
  const pc = await dbGet('SELECT * FROM characters WHERE id = ?', [pcId]);
  const s = stats.calculateCombatStats(pc);
  assert(s.ac === 16, 'chain mail AC computes to 16 (heavy, no DEX)');
  assert(s.weapon.attackBonus === 5, 'longsword attack +5 (STR 3 + PB 2)');
  assert(s.weapon.damageDice === '1d8' && s.weapon.damageModifier === 3, 'longsword damage 1d8+3');
  const ac = await stats.getPlayerCombatAc(pcId);
  assert(ac.ac === 16 && ac.source === 'equipment', 'combat AC comes from equipment, not the stale column (10)');
  const lyra = await dbGet('SELECT * FROM companions WHERE id = ?', [lyraId]);
  const ls = stats.calculateCombatStats({ ability_scores: lyra.companion_ability_scores, equipment: lyra.equipment, level: lyra.companion_level });
  assert(ls.weapon.attackBonus === 5 && ls.weapon.damageDice === '1d6' && ls.weapon.damageModifier === 3,
    'name-only shortsword resolves through WEAPON_DATA (finesse DEX 3 + PB 2, 1d6+3)');
  const bare = await insertRow('characters', { name: 'Bare', level: 1, armor_class: 12, ability_scores: JSON.stringify({ dex: 10 }) });
  const bac = await stats.getPlayerCombatAc(bare);
  assert(bac.ac === 12 && bac.source === 'column', 'no equipment → the column is the fallback');
}

// ---------------------------------------------------------------------------
group('3. B1 — initiative uses real DEX modifiers');
{
  const r = await marker('[COMBAT_START: Enemies="Goblin (HP 7, AC 15, ATK +4, DMG 1d6+2)"]', { characterId: pcId, sessionId: sessionB });
  const order = r?.combatStart?.turnOrder || [];
  const garrick = order.find(c => c.name === 'Garrick');
  assert(garrick && garrick.modifier === 3, 'Garrick initiative modifier is +3 (DEX 16), not the old silent +0');
  const lyra = order.find(c => c.name === 'Lyra');
  assert(lyra && lyra.modifier === 3, 'Lyra initiative modifier is +3 (DEX 16)');
}

// ---------------------------------------------------------------------------
group('4. B2 — the pure judge');
{
  assert(pas.judgeAttack({ takenDie: 1, attackBonus: 10, targetAc: 5 }).hit === false, 'nat 1 always misses');
  const crit = pas.judgeAttack({ takenDie: 20, attackBonus: 0, targetAc: 30 });
  assert(crit.hit === true && crit.critical === 'hit', 'nat 20 always hits and crits');
  assert(pas.judgeAttack({ takenDie: 12, attackBonus: 5, targetAc: 15 }).hit === true, '12 + 5 meets AC 15');
  assert(pas.takenDieFor([17, 4], 'disadvantage') === 4, 'disadvantage takes the lower die');
  assert(pas.takenDieFor([17, 4], 'advantage') === 17, 'advantage takes the higher die');
  assert(pas.parseDamageSpec('2d6+3').count === 2 && pas.parseDamageSpec('1d8').sides === 8, 'damage specs parse');
}

// ---------------------------------------------------------------------------
group('5. B2 — the PC pending attack (player dice, system judgment)');
{
  const goblinHp = async () => (await dbGet("SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = 'Goblin'", [sessionA])).current_hp;
  assert(await goblinHp() === 30, 'goblin starts at 30');
  const r = await marker('[ATTACK: Attacker="Player" Target="Goblin"]', CTX);
  assert(r && r.success === true && r.pending === true, 'ATTACK creates a pending attack');
  assert(r.attackBonus === 5 && r.targetAc === 15, 'pending carries the true bonus (+5) and AC (15)');
  const out = await pas.resolveReportedAttack(sessionA, pcId, [17], 8);
  assert(out.hit === true && out.total === 22 && out.damage === 8, 'reported 17 + 5 = 22 hits; reported damage 8 lands');
  assert(await goblinHp() === 22, 'goblin HP 30 → 22');
  await advanceRound(); // Item 3: Garrick (L3) has one swing per turn — the whiff is a new turn.
  await marker('[ATTACK: Attacker="Player" Target="Goblin"]', CTX);
  const whiff = await pas.resolveReportedAttack(sessionA, pcId, [1], 8);
  assert(whiff.hit === false && whiff.critical === 'miss', 'nat 1 misses despite the +5');
  assert(await goblinHp() === 22, 'a miss deals nothing');
  await advanceRound(); // Item 3: the poisoned attack is a third turn.
  // Poisoned: the pending attack itself is created at disadvantage.
  await cs.addCondition('player', pcId, 'poisoned');
  const pr = await marker('[ATTACK: Attacker="Player" Target="Goblin"]', CTX);
  assert(pr.mode === 'disadvantage', 'poisoned attacker: pending attack is at disadvantage');
  const pout = await pas.resolveReportedAttack(sessionA, pcId, [17, 4], null);
  assert(pout.takenDie === 4 && pout.total === 9 && pout.hit === false, 'dice 17 and 4 → the 4 counts: 4 + 5 = 9 vs AC 15 → miss');
  await cs.removeCondition('player', pcId, 'poisoned');
}

// ---------------------------------------------------------------------------
group('6. B3 — enemy conditions bend attacks both directions');
{
  const add = await marker('[CONDITION_ADD: Target="Goblin" Condition="Blinded"]', CTX);
  assert(add && add.success === true && add.target === 'Goblin', 'CONDITION_ADD resolves an enemy target');
  const row = await dbGet("SELECT active_conditions FROM combat_enemies WHERE session_id = ? AND name = 'Goblin'", [sessionA]);
  assert((JSON.parse(row.active_conditions || '[]')).includes('blinded'), 'the condition is stored on the enemy row');
  const atk = await marker('[ENEMY_ATTACK: Enemy="Goblin" Target="Player"]', CTX);
  assert(atk.attackMode === 'disadvantage' && Array.isArray(atk.attackRolls) && atk.attackRolls.length === 2,
    'a blinded enemy attacks with disadvantage (two dice, lower counts)');
  await marker('[CONDITION_REMOVE: Target="Goblin" Condition="Blinded"]', CTX);
  const clean = await dbGet("SELECT active_conditions FROM combat_enemies WHERE session_id = ? AND name = 'Goblin'", [sessionA]);
  assert((JSON.parse(clean.active_conditions || '[]')).length === 0, 'CONDITION_REMOVE clears the enemy');
  await marker('[CONDITION_ADD: Target="Goblin" Condition="Prone"]', CTX);
}

// ---------------------------------------------------------------------------
group('7. B2 — companion attacks resolve server-side; kills flow through');
{
  const before = (await dbGet("SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = 'Goblin'", [sessionA])).current_hp;
  await turnSvc.advanceTurn(sessionA, 1); // Item 3: Lyra's turn (Garrick → Lyra).
  const r = await marker('[ATTACK: Attacker="Lyra" Target="Goblin"]', CTX);
  assert(r && r.success === true && r.attackerKind === 'companion', 'companion ATTACK resolves immediately');
  assert(r.mode === 'advantage' && r.dice.length === 2 && r.takenDie === Math.max(...r.dice),
    'the prone goblin is attacked with advantage (group 6 left it prone)');
  assert(r.attackBonus === 5 && r.total === r.takenDie + 5, 'Lyra total = die + 5 (sheet truth)');
  const after = (await dbGet("SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = 'Goblin'", [sessionA])).current_hp;
  assert(after === before - (r.hit ? r.damage : 0), 'enemy HP reconciles exactly with the outcome');
  if (r.hit && r.critical === 'hit') assert(r.damage >= 5 && r.damage <= 15, 'crit shortsword damage in 2d6+3 range (crits double dice)');
  if (r.hit && r.critical !== 'hit') assert(r.damage >= 4 && r.damage <= 9, 'shortsword damage in 1d6+3 range');
  await marker('[CONDITION_REMOVE: Target="Goblin" Condition="Prone"]', CTX);

  await dbRun("UPDATE combat_enemies SET current_hp = 2 WHERE session_id = ? AND name = 'Goblin'", [sessionA]);
  const kill = await es.applyPartyDamageToEnemy(sessionA, 1, 'Goblin', 5, pcId);
  assert(kill.killed === true && kill.deathEvent, 'a party-damage kill records the death event');
  const events = await dbAll('SELECT * FROM combat_death_events WHERE session_id = ?', [sessionA]);
  assert(events.length === 1, 'exactly one death event');
  const again = await es.applyPartyDamageToEnemy(sessionA, 1, 'Goblin', 5, pcId);
  assert(!again || again.killed !== true, 'a corpse cannot be killed twice');
  const events2 = await dbAll('SELECT * FROM combat_death_events WHERE session_id = ?', [sessionA]);
  assert(events2.length === 1, 'still exactly one death event');
}

// ---------------------------------------------------------------------------
group('7b. B2 — spell attacks, invisible attackers, canceling states (audit gaps)');
{
  // Spell attack: Wren's Guiding Bolt uses her spell attack bonus
  // (PB 2 + WIS 3 = +5), resolved server-side like any companion swing.
  const sp = await marker('[ATTACK: Attacker="Wren" Target="Orc" Spell="Guiding Bolt" Damage="4d6"]', CTX);
  assert(sp && sp.success === true && sp.attackBonus === 5, 'a companion spell attack uses the spell attack bonus from her sheet (+5)');
  // Invisible attacker: advantage computed from Lyra's own condition.
  await cs.addCondition('companion', lyraId, 'invisible');
  await advanceRound(); // Item 3: Lyra's next turn — her group-7 swing is spent.
  const inv = await marker('[ATTACK: Attacker="Lyra" Target="Orc"]', CTX);
  assert(inv.mode === 'advantage' && inv.dice.length === 2 && inv.takenDie === Math.max(...inv.dice),
    'an invisible companion attacks with advantage (higher die counts)');
  await cs.removeCondition('companion', lyraId, 'invisible');
  // Opposing states cancel: poisoned attacker (disadvantage) vs a prone
  // target (attacker advantage) → a straight roll, one die.
  await cs.addCondition('companion', lyraId, 'poisoned');
  await marker('[CONDITION_ADD: Target="Orc" Condition="Prone"]', CTX);
  await advanceRound(); // Item 3: Lyra's next turn again.
  const cx = await marker('[ATTACK: Attacker="Lyra" Target="Orc"]', CTX);
  assert(cx.mode === null && cx.dice.length === 1, 'poisoned attacker + prone target: the states cancel to a straight roll');
  await cs.removeCondition('companion', lyraId, 'poisoned');
  await marker('[CONDITION_REMOVE: Target="Orc" Condition="Prone"]', CTX);
}

// ---------------------------------------------------------------------------
group('8. B2 — cover counts, for enemies and for the party');
{
  const sc = await marker('[SET_COVER: Target="Orc" Cover="half"]', CTX);
  assert(sc && sc.targetKind === 'enemy' && sc.acBonus === 2, 'SET_COVER on an enemy (half = +2)');
  await turnSvc.advanceTurn(sessionA, 1); await turnSvc.advanceTurn(sessionA, 1); // Item 3: back to Garrick's turn (Lyra → Goblin → Garrick).
  const pend = await marker('[ATTACK: Attacker="Player" Target="Orc"]', CTX);
  assert(pend.targetAc === 15, 'the pending attack must beat AC 13 + 2 cover = 15');
  await pas.resolveReportedAttack(sessionA, pcId, [1], null); // spend the pending attack on a whiff
  const sp = await marker('[SET_COVER: Target="Player" Cover="half"]', CTX);
  assert(sp && sp.targetKind === 'player', 'SET_COVER accepts a party target');
  const ea = await marker('[ENEMY_ATTACK: Enemy="Orc" Target="Player"]', CTX);
  assert(ea.targetAc === 18, 'enemy attack vs the PC faces computed AC 16 + 2 cover = 18');
  await marker('[SET_COVER: Target="Player" Cover="none"]', CTX);
  await marker('[SET_COVER: Target="Orc" Cover="none"]', CTX);
}

// ---------------------------------------------------------------------------
group('9. B2 — the rally buff finally lands on a party attack');
{
  await moraleSvc.setMoraleBuff(sessionA, 1, 'friendlies', 1);
  await turnSvc.advanceTurn(sessionA, 1); // Item 3: Lyra's turn again (Garrick → Lyra).
  const r = await marker('[ATTACK: Attacker="Lyra" Target="Orc"]', CTX);
  assert(r.attackBonus === 6, 'Lyra attacks at +6 while the party is rallied (+5 sheet, +1 morale)');
  const block = await pas.formatAttackOutcomeBlock(sessionA);
  assert(block.includes('ATTACK RESULT') && block.includes('Lyra'), 'the outcome block carries the fact for the DM');
}

// ---------------------------------------------------------------------------
group('10. B4 — companion spellcasting: slots, refusal, concentration');
{
  const maxFirst = (getSpellSlots('Ranger', 3) || {})['1'] || (getSpellSlots('Ranger', 3) || {})[1] || 0;
  assert(maxFirst > 0, 'a L3 ranger has first-level slots');
  let successes = 0;
  for (let i = 0; i < maxFirst + 2; i++) {
    // Item 6 charges the action: Lyra attacked this turn (group 9), so
    // each cast needs its own turn — a full round returns to Lyra in
    // a fresh slot, the file's own idiom for one action per turn.
    await advanceRound();
    const r = await marker('[SPELL_CAST: Spell="Cure Wounds" Level=1 Caster="Lyra"]', CTX);
    if (r && r.success === true && r.slotConsumed === true) successes++;
    else { assert(r && r.success === false && r.reason === 'no_slots_available', 'casting past the last slot is refused'); break; }
  }
  assert(successes === maxFirst, `Lyra cast exactly her ${maxFirst} first-level slots`);
  const used = JSON.parse((await dbGet('SELECT companion_spell_slots_used FROM companions WHERE id = ?', [lyraId])).companion_spell_slots_used || '{}');
  assert(used['1'] === maxFirst, 'the used map is persisted on the companion');
  const grub = await marker('[SPELL_CAST: Spell="Cure Wounds" Level=1 Caster="Grub"]', CTX);
  assert(grub && grub.success === false && grub.reason === 'not_a_caster', 'an npc_stats companion cannot cast');
  const bless = await marker('[SPELL_CAST: Spell="Bless" Level=1 Caster="Wren"]', CTX);
  assert(bless && bless.success === true && bless.concentration === true, 'Wren casts Bless');
  assert((await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [wrenId])).concentrating_on === 'Bless',
    'companion concentration is tracked');
  const check = await conc.checkCompanionConcentration(wrenId, 100);
  assert(check && check.broken === true && check.success === false, 'a 100-damage hit breaks concentration (DC 50)');
  assert((await dbGet('SELECT concentrating_on FROM companions WHERE id = ?', [wrenId])).concentrating_on === null,
    'the broken spell is cleared');
}

// ---------------------------------------------------------------------------
group('11. B5 — enemy saves against the caster’s true DC');
{
  // Item 6: Wren's Bless in B4 spent her action in that turn's slot,
  // so this cast needs a fresh slot (Wren is off-order, so any advance
  // gives her a new budget; the turn itself does not matter here).
  await turnSvc.advanceTurn(sessionA, 1);
  const r = await marker('[SPELL_CAST: Spell="Sacred Flame" Level=0 Caster="Wren" Target="Orc"]', CTX);
  assert(r && r.success === true && r.spellSave, 'Sacred Flame on the Orc rolls its save');
  assert(r.spellSave.dc === 13 && r.spellSave.ability === 'dex', 'DC 13 from Wren’s sheet (8 + PB 2 + WIS 3), DEX save');
  assert(r.spellSave.success === (r.spellSave.total >= 13), 'the outcome is consistent with roll + modifier vs DC');
  const cfg = JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionA])).session_config || '{}');
  assert((cfg.recentRolls || []).some(o => o.label === 'Sacred Flame save'), 'the save outcome is stashed as a fact for the DM');
  await marker('[CONDITION_ADD: Target="Orc" Condition="Paralyzed"]', CTX);
  // Item 6 again: the first Sacred Flame spent Wren's action in its
  // slot, so the paralyzed-target cast needs a fresh slot too.
  await turnSvc.advanceTurn(sessionA, 1);
  const r2 = await marker('[SPELL_CAST: Spell="Sacred Flame" Level=0 Caster="Wren" Target="Orc"]', CTX);
  assert(r2.spellSave.autoFail === true && r2.spellSave.success === false, 'a paralyzed enemy auto-fails the DEX save');
  await marker('[CONDITION_REMOVE: Target="Orc" Condition="Paralyzed"]', CTX);
  const seraCast = await scs.castSpell(seraId, 'Burning Hands', 1, { target: 'Orc', sessionId: sessionA });
  assert(seraCast.slotConsumed === true && seraCast.spellSave && seraCast.spellSave.dc === 13,
    'the PC path also rolls the save (Sera, DC 13) and consumes her slot');
  const seraUsed = JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [seraId])).spell_slots_used || '{}');
  assert(seraUsed['1'] === 1, 'Sera’s slot is persisted');
}

// ---------------------------------------------------------------------------
group('12. B6 — opportunity attacks resolve for real');
{
  await es.createEncounterEnemies(sessionC, 1, [
    // 30 HP: Lyra's OA (max 9 damage) must not be able to kill the
    // goblin before its own OA later in this group.
    { name: 'Goblin', maxHp: 30, armorClass: 15, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
  ]);
  await turnSvc.initializeTurnOrder(sessionC, 1, [
    { name: 'Garrick', type: 'player' }, { name: 'Lyra', type: 'companion' }, { name: 'Goblin', type: 'enemy' }
  ]);
  const CTXC = { characterId: pcId, sessionId: sessionC };
  const oa = await marker('[OPPORTUNITY_ATTACK: Attacker="Lyra" Target="Goblin"]', CTXC);
  assert(oa && oa.success === true && oa.reactionConsumed === true, 'companion OA consumes the reaction');
  assert(oa.attack && typeof oa.attack.hit === 'boolean' && oa.attack.attackBonus === 5,
    '…and resolves a real attack (Lyra, +5) instead of the old auto-success stub');
  const oa2 = await marker('[OPPORTUNITY_ATTACK: Attacker="Lyra" Target="Goblin"]', CTXC);
  assert(oa2 && oa2.success === false && oa2.reason === 'reaction_already_used', 'a second OA in the round is refused');
  const oa3 = await marker('[OPPORTUNITY_ATTACK: Attacker="Goblin" Target="Player"]', CTXC);
  assert(oa3 && oa3.success === true && oa3.attack && oa3.attack.type === 'enemy_attack',
    'an enemy OA resolves through the enemy attack path');
  const oa4 = await marker('[OPPORTUNITY_ATTACK: Attacker="Player" Target="Goblin"]', CTXC);
  assert(oa4 && oa4.success === true && oa4.pending === true && oa4.reactionConsumed === true,
    'a PC OA creates a pending attack — the player rolls for their own reaction');
}

// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(60)}`);
console.log(`combat-real: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);


