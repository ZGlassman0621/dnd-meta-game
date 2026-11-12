/**
 * tests/mechanics-hooks-spellcast.test.js — mechanics hooks, Family 5
 * (Life healing + Wild Magic, duration tracker, teleport action).
 *
 * Pins:
 *   - Life: Disciple of Life +2+slot at every slot level, Blessed
 *     Healer self-heal only when healing someone else, Supreme Healing
 *     maxed dice (companion real math; PC pending instruction, D3),
 *     Preserve Life pool 5 × cleric level surfaced (not spent here);
 *   - Wild Magic: d20 trigger (19 no surge, 20 surge), PC offered
 *     not forced, Tides of Chaos forced, table roll lands in a valid
 *     row, once-per-turn ledger gate, Controlled Chaos roll-twice,
 *     Tamed Surge except-final-row;
 *   - all 25 rows smoke-covered (row effect applied or recorded);
 *   - duration tracker (apply / tick / has / clear, world-clock
 *     effects never ticked) and teleportActor (success, out-of-range
 *     and occupied refusals, nearest-unoccupied landing);
 *   - registry corrections: Tamed Surge exclusion, Controlled Chaos
 *     stale gate note struck.
 *
 * Isolated throwaway DB (spell-damage pattern). Pure-logic groups use
 * the same file so the whole family gates in one run on the Mac.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-f5-spellcast-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const scs = await import(svc('server/services/spellCastService.js'));
const wms = await import(svc('server/services/wildMagicService.js'));
const dts = await import(svc('server/services/durationTrackerService.js'));
const mvs = await import(svc('server/services/movementService.js'));
const cts = await import(svc('server/services/combatTurnService.js'));
const sub = await import(svc('server/services/subclassService.js'));
const mp = await import(svc('server/services/markerPipeline.js'));
const sorcReg = await import(svc('server/data/subclasses/sorcerer.js'));

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

async function addCompanion(name, over) {
  const npcId = await insertRow('npcs', { name });
  return insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    ...over,
  });
}

function sessionConfigOf(sessionId) {
  return dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId])
    .then((r) => JSON.parse(r?.session_config || '{}'));
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 10, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  skills: JSON.stringify([]),
});
// Sera: Life cleric L5, WIS 16 (+3). Disciple + Preserve Life, no Blessed Healer yet.
const seraId = await insertRow('characters', {
  name: 'Sera', class: 'Cleric', subclass: 'Life Domain', level: 5,
  current_hp: 30, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([]),
});
// Bram: Life cleric L6, WIS 16, wounded (20/30) — Blessed Healer test.
const bramId = await insertRow('characters', {
  name: 'Bram', class: 'Cleric', subclass: 'Life Domain', level: 6,
  current_hp: 20, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([]),
});
// Mira: Life cleric L17, WIS 18 (+4) — Supreme Healing test.
const miraId = await insertRow('characters', {
  name: 'Mira', class: 'Cleric', subclass: 'Life Domain', level: 17,
  current_hp: 40, max_hp: 40, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 18, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }),
  spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([]),
});
// Odo: Light cleric L5 — not Life, so no Life bonuses.
const odoId = await insertRow('characters', {
  name: 'Odo', class: 'Cleric', subclass: 'Light Domain', level: 5,
  current_hp: 30, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([]),
});
// Rin: plain cleric L5 — slot-restore test (no Life features needed).
const rinId = await insertRow('characters', {
  name: 'Rin', class: 'Cleric', subclass: 'Life Domain', level: 5,
  current_hp: 30, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }),
  spell_slots_used: JSON.stringify({ 1: 2, 2: 1 }),
  skills: JSON.stringify([]),
});
// Zara: Wild Magic sorcerer L14, CHA 16 — d20/table/Controlled Chaos tests.
const zaraId = await insertRow('characters', {
  name: 'Zara', class: 'Sorcerer', subclass: 'Wild Magic Sorcery', level: 14,
  current_hp: 40, max_hp: 40, armor_class: 14,
  ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 16 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }),
  spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([]),
});
// Wren: Life cleric companion L3, WIS 16. Lyra: wounded ranger companion (5/24).
const wrenId = await addCompanion('Wren', {
  progression_type: 'class_based', companion_class: 'Cleric', companion_subclass: 'Life Domain', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 13, int: 11, wis: 16, cha: 14 }),
  companion_current_hp: 18, companion_max_hp: 18, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([]),
});
const lyraId = await addCompanion('Lyra', {
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 12, dex: 16, con: 13, int: 10, wis: 14, cha: 10 }),
  companion_current_hp: 5, companion_max_hp: 24, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([]),
});
// Auntie: Life cleric companion L17, WIS 16 — Supreme Healing (companion) test.
const auntieId = await addCompanion('Auntie', {
  progression_type: 'class_based', companion_class: 'Cleric', companion_subclass: 'Life Domain', companion_level: 17,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 13, int: 11, wis: 16, cha: 14 }),
  companion_current_hp: 40, companion_max_hp: 40, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([]),
});
// Pip: Wild Magic sorcerer companion L3, CHA 16.
const pipId = await addCompanion('Pip', {
  progression_type: 'class_based', companion_class: 'Sorcerer', companion_subclass: 'Wild Magic Sorcery', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 16 }),
  companion_current_hp: 20, companion_max_hp: 20, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([]),
});

async function newSession(characterId) {
  return insertRow('dm_sessions', { character_id: characterId, status: 'active' });
}

// ---------------------------------------------------------------------------
group('1. Life pure math — Disciple / Blessed Healer / Supreme / Preserve Life');
{
  for (let slot = 1; slot <= 9; slot++) {
    assert(sub.lifeDiscipleBonus(slot) === 2 + slot, `Disciple of Life: slot ${slot} adds ${2 + slot}`);
    assert(sub.lifeBlessedHealerBonus(slot) === 2 + slot, `Blessed Healer: slot ${slot} heals ${2 + slot}`);
  }
  assert(sub.lifeDiscipleBonus(0) === 0, 'Disciple: cantrips (slot 0) add nothing');
  assert(sub.lifePreserveLifePool(6) === 30, 'Preserve Life pool: 5 × cleric level 6 = 30');
  assert(sub.lifePreserveLifePool(1) === 5, 'Preserve Life pool: 5 × cleric level 1 = 5');
  assert(sub.lifeHealingDiceMaxed({ className: 'Cleric', subclassName: 'Life Domain', level: 17 }) === true, 'Supreme Healing maxes dice at Life 17');
  assert(sub.lifeHealingDiceMaxed({ className: 'Cleric', subclassName: 'Life Domain', level: 16 }) === false, 'Supreme Healing does not max dice at Life 16');
  assert(sub.lifeHealingDiceMaxed({ className: 'Cleric', subclassName: 'Light Domain', level: 17 }) === false, 'Supreme Healing is Life-only');

  const life5 = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 5, slotLevel: 2, targetName: 'Garrick', casterName: 'Sera' });
  assert(life5.isLife && life5.discipleBonus === 4 && life5.diceMaxed === false, 'Life L5 slot 2: Disciple +4, dice not maxed');
  assert(life5.blessedHealerBonus === 0, 'Life L5: no Blessed Healer yet (6th)');
  assert(/Disciple of Life: add 4/.test(life5.instruction), 'PC pending instruction states the Disciple bonus');
  const life6 = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 6, slotLevel: 2, targetName: 'Garrick', casterName: 'Bram' });
  assert(life6.blessedHealerBonus === 4, 'Life L6 slot 2 healing another: Blessed Healer +4');
  const selfHeal = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 6, slotLevel: 2, targetName: 'Bram', casterName: 'Bram' });
  assert(selfHeal.blessedHealerBonus === 0, 'Blessed Healer does NOT fire when healing yourself');
  const selfWord = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 6, slotLevel: 2, targetName: 'self', casterName: 'Bram' });
  assert(selfWord.blessedHealerBonus === 0, 'Blessed Healer does NOT fire on a self target word');
  const life17 = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 17, slotLevel: 1, targetName: 'Garrick', casterName: 'Mira' });
  assert(life17.diceMaxed === true && /maxed/.test(life17.instruction), 'Life L17: Supreme Healing maxes the dice, instruction says so');
  const light = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Light Domain', level: 5, slotLevel: 2, targetName: 'Garrick', casterName: 'Odo' });
  assert(light.isLife === false && light.discipleBonus === 0, 'Light cleric gets no Life bonuses');
  const cantrip = scs.lifeHealingForCast({ className: 'Cleric', subclassName: 'Life Domain', level: 5, slotLevel: 0, targetName: 'Garrick', casterName: 'Sera' });
  assert(cantrip.isLife === false, 'Cantrip healing gets no Life bonuses (Disciple needs a slot)');
  assert(scs.preserveLifePoolFor({ className: 'Cleric', subclassName: 'Life Domain', level: 5 }) === 25, 'Preserve Life pool surfaced: 5 × 5 = 25');
  assert(scs.preserveLifePoolFor({ className: 'Cleric', subclassName: 'Light Domain', level: 5 }) === 0, 'Preserve Life pool is 0 without the feature');
  assert(scs.maxedHealingTotal({ count: 2, sides: 8 }, 3) === 19, 'Supreme Healing math: 2d8 maxed +3 = 19');
  assert(scs.maxedHealingTotal({ terms: [{ count: 1, sides: 8 }, { count: 1, sides: 6 }] }, 2) === 16, 'Supreme Healing math over terms: 8+6+2 = 16');
}

// ---------------------------------------------------------------------------
group('2. Life — PC cast: pending instruction, reported total, Blessed Healer');
{
  const sessionA = await newSession(seraId);
  await dbRun('UPDATE characters SET current_hp = 10 WHERE id = ?', [pcId]);
  const cast = await scs.castSpell(seraId, 'Cure Wounds', 2, { sessionId: sessionA, target: 'Garrick' });
  assert(cast.success === true, 'Sera casts Cure Wounds L2');
  assert(cast.pendingEffect?.life?.discipleBonus === 4, 'PC pending carries Disciple +4 (slot 2)');
  assert(cast.pendingEffect?.life?.diceMaxed === false, 'PC pending: dice not maxed at L5');
  assert(/Disciple of Life: add 4/.test(cast.pendingEffect?.life?.instruction || ''), 'PC pending instruction states +4');
  assert(cast.life?.preserveLifePool === 25, 'PC cast surfaces the Preserve Life pool (25) without spending it');
  assert(cast.life?.blessedHealerApplied === 0, 'PC L5: no Blessed Healer self-heal');
  // The player reports the total WITH the bonus (D3): 4d8+3 rolled 11 + 4 = 15 (2024 Cure Wounds is 2d8 base, +2d8 at slot 2).
  const resolved = await scs.resolveReportedSpellEffect(sessionA, seraId, 15);
  assert(resolved?.outcomes?.[0]?.applied === 15, 'reported total 15 (11 rolled + 4 Disciple) heals 15');
  const garrick = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId]);
  assert(garrick.current_hp === 25, 'Garrick 10 → 25 HP');
  // Flat PC healing: Heal is system-applied, so Disciple rides the flat amount.
  const flat = scs.formatSpellEffectBlock([{ pending: true, spell: 'Cure Wounds', kind: 'healing', spec: '4d8+3', life: { discipleBonus: 4, diceMaxed: false, instruction: 'Disciple of Life: add 4 to the healing total (2 + slot level 2).' } }]);
  assert(/Disciple of Life: add 4/.test(flat), 'pending block renders the Life instruction for the DM');

  const sessionB = await newSession(bramId);
  await dbRun('UPDATE characters SET current_hp = 10 WHERE id = ?', [pcId]);
  const castB = await scs.castSpell(bramId, 'Cure Wounds', 2, { sessionId: sessionB, target: 'Garrick' });
  assert(castB.success === true, 'Bram casts Cure Wounds L2 on Garrick');
  assert(castB.life?.blessedHealerApplied === 4, 'Blessed Healer: Bram regains 4 HP (2 + slot 2)');
  const bram = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [bramId]);
  assert(bram.current_hp === 24, 'Bram 20 → 24 HP from Blessed Healer');
  await scs.resolveReportedSpellEffect(sessionB, bramId, 15);
  const garrick2 = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [pcId]);
  assert(garrick2.current_hp === 25, 'Garrick healed by the reported total, Blessed Healer did not double-apply');

  // Supreme Healing, PC face: the pending states the dice are maxed.
  const sessionC = await newSession(miraId);
  const castM = await scs.castSpell(miraId, 'Cure Wounds', 1, { sessionId: sessionC, target: 'Garrick' });
  assert(castM.pendingEffect?.life?.diceMaxed === true, 'PC L17 pending: dice maxed');
  assert(/maxed/.test(castM.pendingEffect?.life?.instruction || ''), 'PC L17 pending instruction says the dice are maxed');
}

// ---------------------------------------------------------------------------
group('3. Life — companion cast: real math (Disciple added, dice maxed)');
{
  const sessionD = await newSession(pcId);
  await dbRun('UPDATE companions SET companion_current_hp = 5 WHERE id = ?', [lyraId]);
  const cast = await scs.castCompanionSpell(pcId, 'Wren', 'Cure Wounds', 1, { sessionId: sessionD, target: 'Lyra' });
  assert(cast.success === true, 'Wren casts Cure Wounds L1 on Lyra');
  // 2024 Cure Wounds is 2d8 + mod: 2d8 + 3 (WIS) + 3 (Disciple, 2 + slot 1) = 8..22.
  assert(cast.effect?.total >= 8 && cast.effect?.total <= 22, `companion Cure Wounds total in 8..22 (got ${cast.effect?.total})`);
  assert(cast.effect?.life?.discipleBonus === 3, 'companion outcome records Disciple +3');
  // Lyra is at 5/24, so she has room for 19 — but the total runs to 22.
  // Both branches: a total of 19 or less applies in full; 20–22 (2d8
  // of 14–16, ~9% of casts) is clamped at max HP. (This assert used to
  // expect applied === total always, and failed on those high rolls.)
  assert(cast.effect?.applied === Math.min(cast.effect?.total, 24 - 5),
    `Lyra (5/24) is healed by min(total, 19) (total ${cast.effect?.total}, applied ${cast.effect?.applied})`);
  const lyra = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [lyraId]);
  assert(lyra.companion_current_hp === 5 + cast.effect.applied, 'Lyra HP moved by the applied amount');

  const sessionE = await newSession(pcId);
  await dbRun('UPDATE companions SET companion_current_hp = 5 WHERE id = ?', [lyraId]);
  const cast17 = await scs.castCompanionSpell(pcId, 'Auntie', 'Cure Wounds', 1, { sessionId: sessionE, target: 'Lyra' });
  assert(cast17.success === true, 'Auntie casts Cure Wounds L1 on Lyra');
  // Supreme Healing: 2d8 maxed (16) + 3 (WIS) + 3 (Disciple) = 22 exactly.
  assert(cast17.effect?.total === 22, `Supreme Healing companion total is exactly 22 (got ${cast17.effect?.total})`);
  assert(cast17.effect?.life?.diceMaxed === true, 'companion outcome records dice maxed');
  assert(cast17.effect?.applied === 19, 'Lyra heals 19 (5/24 + 19 = 24, capped at max)');
}

// ---------------------------------------------------------------------------
group('4. Slot restore (Wild Magic Boon sub-rows 3/4)');
{
  const r1 = await scs.restoreSpellSlot(rinId, null, true, null, 1);
  assert(r1.ok === true && r1.slotsUsed === 1, 'restore L1: used 2 → 1');
  const r2 = await scs.restoreSpellSlot(rinId, null, true, null, 2);
  assert(r2.ok === true && r2.slotsUsed === 0, 'restore L2: used 1 → 0');
  const r3 = await scs.restoreSpellSlot(rinId, null, true, null, 2);
  assert(r3.ok === false && r3.reason === 'no_expended_slot', 'restoring with nothing expended refuses');
  const r4 = await scs.restoreSpellSlot(rinId, null, true, null, 0);
  assert(r4.ok === true && r4.restored === false, 'cantrip restore is a no-op success');
  assert(wms.lowestExpendedSlot({ 1: 0, 2: 1, 3: 2 }, { 1: 4, 2: 3, 3: 3 }) === 2, 'lowest expended slot: L2 (L1 unspent)');
  assert(wms.lowestExpendedSlot({}, { 1: 4 }) === null, 'lowest expended slot: null when nothing spent');
}

// ---------------------------------------------------------------------------
group('5. Duration tracker — pure contract');
{
  const cfg = {};
  assert(dts.hasTimedEffect(cfg, 'player:1', 'x') === null, 'no effect yet → null');
  dts.applyTimedEffect(cfg, 'player:1', 'wild_magic_regeneration', { healPerTurn: 5 }, 10);
  assert(dts.hasTimedEffect(cfg, 'player:1', 'wild_magic_regeneration')?.healPerTurn === 5, 'effect data reads back');
  assert(dts.timedEffectKeys(cfg, 'player:1').length === 1, 'one effect key listed');
  assert(dts.tickTimedEffects(cfg, 'player:1').length === 0, 'tick 1 of 10: nothing expires');
  for (let i = 0; i < 8; i++) dts.tickTimedEffects(cfg, 'player:1');
  assert(dts.tickTimedEffects(cfg, 'player:1').length === 1, 'tick 10 of 10: the effect expires');
  assert(dts.hasTimedEffect(cfg, 'player:1', 'wild_magic_regeneration') === null, 'expired effect is gone');
  // World-clock effects (turnsLeft null) are never ticked away.
  dts.applyTimedEffect(cfg, 'player:1', 'wild_magic_death_ward', { hours: 1 }, null);
  assert(dts.tickTimedEffects(cfg, 'player:1').length === 0, 'world-clock effect survives turn ticks');
  assert(dts.hasTimedEffect(cfg, 'player:1', 'wild_magic_death_ward')?.hours === 1, 'world-clock data still there');
  assert(dts.clearTimedEffect(cfg, 'player:1', 'wild_magic_death_ward') === true, 'clear removes it');
  assert(dts.clearTimedEffect(cfg, 'player:1', 'wild_magic_death_ward') === false, 'clearing twice reports false');
  assert(dts.tickTimedEffects({}, 'nobody').length === 0, 'ticking a missing actor is a no-op');
  assert(dts.applyTimedEffect(null, 'player:1', 'x', {}, 1) === null, 'null config never throws');
}

// ---------------------------------------------------------------------------
group('6. Wild Magic — registry table (25 rows, ranges cover 1–100)');
{
  const table = wms.getSurgeTable();
  assert(table.length === 25, `surge table has 25 rows (got ${table.length})`);
  const covered = new Set();
  for (const row of table) {
    const [a, b] = row.range.replace(/[–—]/g, '-').split('-');
    const start = Number(a);
    const end = b === '00' ? 100 : Number(b);
    for (let n = start; n <= end; n++) covered.add(n);
  }
  assert(covered.size === 100, 'the 25 ranges cover d100 1–100 exactly');
  assert(Object.keys(wms.SURGE_ROW_EFFECTS).length === 25, 'SURGE_ROW_EFFECTS maps all 25 rows');
  assert(wms.findSurgeRow(1)?.name === 'Roll Again', 'd100 1 → Roll Again');
  assert(wms.findSurgeRow(4)?.name === 'Roll Again', 'd100 4 → Roll Again');
  assert(wms.findSurgeRow(5)?.name === 'Friendly Creature', 'd100 5 → Friendly Creature');
  assert(wms.findSurgeRow(100)?.name === 'Boon', 'd100 100 → Boon');
  assert(wms.findSurgeRow(0) === null && wms.findSurgeRow(101) === null, 'out-of-range d100 → null');
  assert(wms.friendlyCreatureFor(1)?.bestiaryKey === 'duodrone', 'Friendly Creature 1: Modron Duodrone → duodrone');
  assert(wms.friendlyCreatureFor(2)?.bestiaryKey === 'flumph', 'Friendly Creature 2: Flumph → flumph');
  assert(wms.friendlyCreatureFor(3)?.bestiaryKey === 'monodrone', 'Friendly Creature 3: Modron Monodrone → monodrone');
  assert(wms.friendlyCreatureFor(4)?.bestiaryKey === 'unicorn', 'Friendly Creature 4: Unicorn → unicorn');
  assert(wms.randomSpellFor(9)?.spell === 'Polymorph', 'Random Spell 9 → Polymorph');
  assert(wms.randomSpellFor(7)?.level === 5, 'Random Spell 7 → Magic Missile as a 5th-level spell');
  assert(wms.strangeEffectFor(6)?.label === 'eye on forehead', 'Strange Effect 6 → eye on forehead');
  assert(wms.strangeEffectFor(8)?.data?.hours === 24, 'Strange Effect 8 → blue skin, 24 hours');
  assert(wms.boonFor(5)?.label.includes('Sorcery Points'), 'Boon 5 → regain all Sorcery Points');
}

// ---------------------------------------------------------------------------
group('7. Wild Magic — d20 trigger (PC offered, companion rolls, Tides forced)');
{
  const sorc = { kind: 'player', id: zaraId, name: 'Zara', className: 'Sorcerer', subclassName: 'Wild Magic Sorcery', level: 14, isPc: true };
  const offered = wms.rollWildMagicSurge(sorc, {});
  assert(offered.triggered === false && offered.offered === true && offered.d20 === null, 'PC with no d20: OFFERED, nothing rolled');
  const nineteen = wms.rollWildMagicSurge(sorc, { d20Roll: 19 });
  assert(nineteen.triggered === false && nineteen.d20 === 19 && nineteen.reason === 'no_surge', 'd20 19: no surge');
  const twenty = wms.rollWildMagicSurge(sorc, { d20Roll: 20, d100Roll: 10 });
  assert(twenty.triggered === true && twenty.d20 === 20 && twenty.row?.name === 'Regeneration', 'd20 20 + d100 10: Regeneration surges');
  const notWild = wms.rollWildMagicSurge({ ...sorc, subclassName: 'Draconic Sorcery' }, { d20Roll: 20 });
  assert(notWild.triggered === false && notWild.reason === 'not_wild_magic', 'non-Wild Magic sorcerer never surges');
  const gated = wms.rollWildMagicSurge(sorc, { d20Roll: 20, alreadyRolledThisTurn: true });
  assert(gated.triggered === false && gated.reason === 'once_per_turn', 'once-per-turn gate refuses a second roll');
  const tides = wms.rollWildMagicSurge(sorc, { forced: true, d100Roll: 85 });
  assert(tides.triggered === true && tides.forced === true && tides.d20 === null && tides.row?.name === 'Life Drain', 'Tides of Chaos: forced, no d20, straight to the table');
  const tidesFlag = wms.rollWildMagicSurge(sorc, { tidesOfChaos: true, d100Roll: 90 });
  assert(tidesFlag.forced === true && tidesFlag.row?.name === 'Lightning Strike', 'tidesOfChaos flag also forces');

  // Controlled Chaos (L14): roll twice, use either.
  const chaos = wms.rollWildMagicSurge(sorc, { d20Roll: 20, rng: () => 0.5 });
  assert(chaos.rolls?.length === 2, 'Controlled Chaos rolls twice on the table');
  assert(chaos.via === 'controlled_chaos', 'Controlled Chaos path recorded');
  assert(chaos.row != null, 'Controlled Chaos picks one of the two rows');
  const chaosPick = wms.rollSurgeTable(sorc, { rng: () => 0.99, tableChoiceIndex: 1 });
  assert(chaosPick.rolls?.length === 2 && chaosPick.row?.name === 'Boon', 'tableChoiceIndex 1 picks the second roll (d100 99 → Boon)');
  const chaosReported = wms.rollSurgeTable(sorc, { d100Rolls: [10, 50], tableChoiceIndex: 1 });
  assert(chaosReported.rolls?.length === 2 && chaosReported.row?.name === 'Spectral Shield', 'Controlled Chaos reported pair [10, 50]: second roll chosen');

  // Tamed Surge: choose, except the final row.
  const tamedBad = wms.rollSurgeTable(sorc, { tamedSurgeRow: '97–00' });
  assert(tamedBad.row === null && /tamed_surge_final_row_excluded/.test(tamedBad.error || ''), 'Tamed Surge refuses the final row (97–00, Boon)');
  const tamedOk = wms.rollSurgeTable(sorc, { tamedSurgeRow: '09–12' });
  assert(tamedOk.row?.name === 'Regeneration' && tamedOk.via === 'tamed_surge', 'Tamed Surge chooses Regeneration instead of rolling');
  assert(wms.validateTamedSurgeChoice(wms.findSurgeRow(100)).ok === false, 'validateTamedSurgeChoice refuses Boon');
  assert(wms.validateTamedSurgeChoice(wms.findSurgeRow(50)).ok === true, 'validateTamedSurgeChoice allows Spectral Shield');

  // Companion face: the system rolls the d20 (seeded rng here).
  const comp = { kind: 'companion', id: pipId, name: 'Pip', className: 'Sorcerer', subclassName: 'Wild Magic Sorcery', level: 3, isPc: false };
  const compRoll = wms.rollWildMagicSurge(comp, { rng: () => 0.99 });
  assert(compRoll.d20 === 20 && compRoll.triggered === true, 'companion d20 is system-rolled (seeded 0.99 → 20)');
  const compNo = wms.rollWildMagicSurge(comp, { rng: () => 0.1 });
  assert(compNo.d20 === 3 && compNo.triggered === false, 'companion d20 3: no surge');
}

// ---------------------------------------------------------------------------
group('8. Wild Magic — PC cast path: offer, once-per-turn gate, reported rolls');
{
  const sessionF = await newSession(zaraId);
  await insertRow('combat_enemies', { session_id: sessionF, encounter_seq: 1, name: 'Goblin', current_hp: 7, max_hp: 7 });
  await cts.initializeTurnOrder(sessionF, 1, [{ key: `player:${zaraId}`, name: 'Zara', type: 'player' }]);
  // Cast 1 (L1): offered — the PC rolls the d20, the system rolls nothing.
  const first = await scs.castSpell(zaraId, 'Magic Missile', 1, { sessionId: sessionF });
  assert(first.success === true, 'Zara casts Magic Missile L1');
  assert(first.wildMagic?.offered === true && first.wildMagic?.d20 === null, 'first slotted cast this turn: surge roll OFFERED');
  // Cast 2 (L1, same turn): the once-per-turn gate refuses.
  const second = await scs.castSpell(zaraId, 'Magic Missile', 1, { sessionId: sessionF });
  assert(second.wildMagic?.reason === 'once_per_turn', 'second slotted cast this turn: once-per-turn gate');

  // Fresh session (no turn order): reported d20s resolve.
  const sessionG = await newSession(zaraId);
  const nineteen = await scs.castSpell(zaraId, 'Magic Missile', 2, { sessionId: sessionG, d20Roll: 19 });
  assert(nineteen.wildMagic?.triggered === false && nineteen.wildMagic?.d20 === 19, 'reported d20 19: no surge');
  const twenty = await scs.castSpell(zaraId, 'Magic Missile', 2, { sessionId: sessionG, d20Roll: 20, d100Roll: 10 });
  assert(twenty.wildMagic?.triggered === true && twenty.wildMagic?.row?.name === 'Regeneration', 'reported d20 20 + d100 10: Regeneration');
  assert(twenty.wildMagic?.surge?.applied?.some((a) => /regeneration/.test(a)), 'Regeneration row applied');
  const cfgG = await sessionConfigOf(sessionG);
  assert(dts.hasTimedEffect(cfgG, `player:${zaraId}`, 'wild_magic_regeneration')?.healPerTurn === 5, 'Regeneration tracker recorded in session_config (10 turns)');

  // Tides of Chaos, PC face: forced, but the PC still reports the d100.
  const sessionH = await newSession(zaraId);
  const tidesOffer = await scs.castSpell(zaraId, 'Magic Missile', 3, { sessionId: sessionH, tidesOfChaos: true });
  assert(tidesOffer.wildMagic?.forced === true && tidesOffer.wildMagic?.offered === true, 'Tides forced: PC is asked for the d100 (automatic table roll, player reports the die)');
  const tidesRoll = await scs.castSpell(zaraId, 'Magic Missile', 3, { sessionId: sessionH, tidesOfChaos: true, d100Roll: 50 });
  assert(tidesRoll.wildMagic?.triggered === true && tidesRoll.wildMagic?.row?.name === 'Spectral Shield', 'Tides + reported d100 50: Spectral Shield');
}

// ---------------------------------------------------------------------------
group('9. Wild Magic — companion cast path: system rolls, row lands in session state');
{
  const sessionI = await newSession(pcId);
  const no = await scs.castCompanionSpell(pcId, 'Pip', 'Magic Missile', 1, { sessionId: sessionI, d20Roll: 19 });
  assert(no.wildMagic?.triggered === false, 'companion d20 19: no surge');
  const yes = await scs.castCompanionSpell(pcId, 'Pip', 'Magic Missile', 1, { sessionId: sessionI, d20Roll: 20, d100Roll: 73 });
  assert(yes.wildMagic?.triggered === true && yes.wildMagic?.row?.name === 'Long Teleport', 'companion d20 20 + d100 73: Long Teleport');
  assert(yes.wildMagic?.surge?.pending?.some((p) => p.step === 'teleport'), 'Long Teleport without a named zone pends (DM names the destination)');
  const regen = await scs.castCompanionSpell(pcId, 'Pip', 'Magic Missile', 1, { sessionId: sessionI, d20Roll: 20, d100Roll: 10 });
  assert(regen.wildMagic?.row?.name === 'Regeneration', 'companion d20 20 + d100 10: Regeneration');
  const cfgI = await sessionConfigOf(sessionI);
  assert(dts.hasTimedEffect(cfgI, `companion:${pipId}`, 'wild_magic_regeneration') != null, 'companion Regeneration tracker recorded');
}

// ---------------------------------------------------------------------------
group('10. All 25 rows — smoke coverage (applied, recorded, or planned)');
{
  const actor = { kind: 'player', id: zaraId, name: 'Zara', className: 'Sorcerer', subclassName: 'Wild Magic Sorcery', level: 14, isPc: true };
  const rngHalf = () => 0.5;
  const table = wms.getSurgeTable();
  for (const row of table) {
    const cfg = {};
    const ctx = { sessionConfig: cfg, rng: rngHalf, targets: ['Goblin', 'Orc', 'Bugbear'] };
    if (row.range === '17–20') ctx.strangeRoll = 6;
    if (row.range === '97–00') ctx.boonRoll = 1;
    const res = await wms.applySurgeRow(actor, row, ctx);
    const covered = res.applied.length > 0 || res.pending.length > 0 || res.cast != null || res.creationCall != null;
    assert(res.row?.name === row.name && covered, `row ${row.range} ${row.name}: applied/recorded/planned (${[...res.applied, ...res.pending.map((p) => p.step)].join('; ') || 'cast plan'})`);
  }
  // Sub-table sweeps: every Strange Effect sub-row and every Boon sub-row.
  for (let d8 = 1; d8 <= 8; d8++) {
    const res = await wms.applySurgeRow(actor, wms.findSurgeRow(18), { sessionConfig: {}, rng: rngHalf, strangeRoll: d8 });
    assert(res.applied.length > 0, `Strange Effect sub-row ${d8} (${wms.strangeEffectFor(d8).label}) recorded`);
  }
  for (let d6 = 1; d6 <= 6; d6++) {
    const res = await wms.applySurgeRow(actor, wms.findSurgeRow(99), { sessionConfig: {}, rng: rngHalf, boonRoll: d6 });
    assert(res.applied.length > 0 || res.pending.length > 0, `Boon sub-row ${d6} (${wms.boonFor(d6).label}) applied or pending`);
  }
  // Spot checks on the recorded state.
  const cfgP = {};
  await wms.applySurgeRow(actor, wms.findSurgeRow(38), { sessionConfig: cfgP, rng: rngHalf });
  assert(wms.transformedFormFor(cfgP, `player:${zaraId}`)?.kind === 'potted_plant', 'Potted Plant: form-state record (kind potted_plant)');
  assert(wms.surgeVulnerabilityFor(cfgP, `player:${zaraId}`).includes('all'), 'Potted Plant: vulnerability to all damage via vulnerabilityFor()');
  const cfgA = {};
  await wms.applySurgeRow(actor, wms.findSurgeRow(26), { sessionConfig: cfgA, rng: rngHalf, returnPosition: 'the bridge' });
  assert(wms.isRemovedFromCombat(cfgA, `player:${zaraId}`)?.returnPosition === 'the bridge', 'Astral Jaunt: removed-from-combat state with the return position');
  const cfgR = {};
  await wms.applySurgeRow(actor, wms.findSurgeRow(34), { sessionConfig: cfgR, rng: rngHalf });
  assert(wms.surgeResistanceFor(cfgR, `player:${zaraId}`).resistance.includes('all'), 'Damage Resistance: resistance to all via resistanceFor()');
  const cfgV = {};
  await wms.applySurgeRow(actor, wms.findSurgeRow(94), { sessionConfig: cfgV, rng: rngHalf });
  assert(wms.surgeVulnerabilityFor(cfgV, `player:${zaraId}`).includes('piercing'), 'Piercing Vulnerability: vulnerability to piercing');
  const cfgF = {};
  const friendly = await wms.applySurgeRow(actor, wms.findSurgeRow(6), { sessionConfig: cfgF, rng: () => 0.5 });
  assert(friendly.creationCall?.function === 'createFriendlyActor' && friendly.creationCall?.args?.bestiaryKey === 'monodrone', 'Friendly Creature: creation call names the entity family + bestiary key (no invented enemy row)');
  const cfgS = {};
  const random = await wms.applySurgeRow(actor, wms.findSurgeRow(58), { sessionConfig: cfgS, rng: () => 0.45 });
  assert(random.cast?.spell === 'Grease' && random.cast?.noConcentration === true, 'Random Spell: cast plan returned (d10 5 → Grease, no concentration)');
  const blue = await wms.applySurgeRow(actor, wms.findSurgeRow(18), { sessionConfig: {}, rng: rngHalf, strangeRoll: 8 });
  assert(blue.applied.some((a) => /blue skin/.test(a)), 'Strange Effect 8: blue skin recorded');
}

// ---------------------------------------------------------------------------
group('11. Flammable Touch ignition (room-feature model)');
{
  const cfg = { timedEffects: { 'player:1': { wild_magic_flammable_touch: { turnsLeft: 10, data: { flammableTouch: true } } } } };
  const roomState = {};
  const features = [{ name: 'Haybale', kind: 'flammable' }, { name: 'Stone wall', kind: 'stone' }];
  const lit = wms.igniteFlammableObject(cfg, 'player:1', roomState, 'Haybale', { roomFeatures: features, rng: () => 0.5 });
  assert(lit.success === true && lit.damage === 3, 'flammable object ignites: 1d4 fire (seeded 3)');
  assert(roomState.burningObjects?.length === 1 && roomState.burningObjects[0].burning === true, 'burning record persisted on the room state');
  assert(roomState.consumedFeatures?.includes('Haybale'), 'burned object marked consumed');
  const stone = wms.igniteFlammableObject(cfg, 'player:1', {}, 'Stone wall', { roomFeatures: features, rng: () => 0.5 });
  assert(stone.success === false && stone.reason === 'feature_not_flammable', 'non-flammable feature refuses');
  const missing = wms.igniteFlammableObject(cfg, 'player:1', {}, 'Oil barrel', { roomFeatures: features, rng: () => 0.5 });
  assert(missing.success === false && missing.reason === 'feature_not_in_room', 'unnamed-in-room feature refuses (SET_COVER rule)');
  const inactive = wms.igniteFlammableObject({ timedEffects: {} }, 'player:1', {}, 'Haybale', { roomFeatures: features, rng: () => 0.5 });
  assert(inactive.success === false && inactive.reason === 'flammable_touch_not_active', 'ignition refuses when Flammable Touch is not active');
}

// ---------------------------------------------------------------------------
group('12. Teleport action (movementService.teleportActor)');
{
  const sessionJ = await newSession(zaraId);
  await insertRow('combat_enemies', { session_id: sessionJ, encounter_seq: 1, name: 'Goblin', current_hp: 7, max_hp: 7 });
  await cts.initializeTurnOrder(sessionJ, 1, [{ key: `player:${zaraId}`, name: 'Zara', type: 'player' }]);
  await dbRun(
    'UPDATE combat_turn_state SET zones_json = ? WHERE session_id = ? AND encounter_seq = ?',
    [JSON.stringify({ zones: ['the fight', 'the bridge', 'the treeline'], edges: { 'the bridge|the fight': { feet: 20 }, 'the fight|the treeline': { feet: 30 } }, positions: { [`player:${zaraId}`]: 'the fight' } }), sessionJ, 1]
  );
  const go = await mvs.teleportActor(sessionJ, `player:${zaraId}`, 'the bridge', { encounterSeq: 1, maxFeet: 60 });
  assert(go.success === true && go.zone === 'the bridge' && go.feet === 20, 'teleport 20 ft to the bridge succeeds');
  const zones = await mvs.readZones(sessionJ, 1);
  assert(zones.positions[`player:${zaraId}`] === 'the bridge', 'position recorded in the zones blob');
  const far = await mvs.teleportActor(sessionJ, `player:${zaraId}`, 'the treeline', { encounterSeq: 1, maxFeet: 10 });
  assert(far.success === false && /beyond the teleport range/.test(far.reason || ''), 'teleport beyond maxFeet refuses');
  const nowhere = await mvs.teleportActor(sessionJ, `player:${zaraId}`, 'the moon', { encounterSeq: 1 });
  assert(nowhere.success === false && /no such zone/.test(nowhere.reason || ''), 'teleport to an unknown zone refuses');
  // Occupied zone, strict: another combatant sits on the treeline.
  await dbRun(
    'UPDATE combat_turn_state SET zones_json = ? WHERE session_id = ? AND encounter_seq = ?',
    [JSON.stringify({ zones: ['the fight', 'the bridge', 'the treeline'], edges: { 'the bridge|the fight': { feet: 20 }, 'the fight|the treeline': { feet: 30 } }, positions: { [`player:${zaraId}`]: 'the bridge', 'combat:1:1': 'the treeline' } }), sessionJ, 1]
  );
  const occupied = await mvs.teleportActor(sessionJ, `player:${zaraId}`, 'the treeline', { encounterSeq: 1, maxFeet: 60, strictOccupancy: true });
  assert(occupied.success === false && /occupied/.test(occupied.reason || ''), 'strict teleport into an occupied zone refuses');
  const nearest = await mvs.teleportActor(sessionJ, `player:${zaraId}`, 'the treeline', { encounterSeq: 1, maxFeet: 60, strictOccupancy: true, nearestUnoccupied: true });
  assert(nearest.success === true && nearest.zone !== 'the treeline', 'nearest-unoccupied fallback lands in a free zone instead');
  assert(mvs.nearestUnoccupiedZone({ zones: ['a', 'b'], edges: { 'a|b': { feet: 10 } }, positions: { x: 'a' } }, 'a', 'me') === 'b', 'nearestUnoccupiedZone pure helper: occupied a → b');
}

// ---------------------------------------------------------------------------
group('13. Registry corrections (sorcerer.js — verified text, not decisions)');
{
  const wild = (sorcReg.SORCERER_SUBCLASSES || []).find((s) => s.key === 'wild_magic_sorcery');
  assert(!!wild, 'Wild Magic Sorcery entry present');
  const tamed = (wild.features || []).find((f) => f.key === 'tamed_surge');
  assert(/except the final row \(97–00, Boon\)/.test(tamed.mechanics.effect), 'Tamed Surge mechanics carries the final-row exclusion');
  assert(/except the final row \(97–00, Boon\)/.test(tamed.prompt), 'Tamed Surge prompt carries the final-row exclusion');
  assert(!/DM confirms at the gate/.test(tamed.mechanics.effect), 'Tamed Surge mechanics no longer carries a gate note');
  const chaos = (wild.features || []).find((f) => f.key === 'controlled_chaos');
  assert(/roll twice and choose either result/.test(chaos.mechanics.effect), 'Controlled Chaos mechanics: roll twice, use either');
  assert(!/DM confirms at the gate/.test(chaos.mechanics.effect), 'Controlled Chaos mechanics: stale gate note struck');
  assert(!/DM confirms at the gate/.test(chaos.prompt), 'Controlled Chaos prompt: stale gate note struck');
}

// ---------------------------------------------------------------------------
group('14. F5 surfacing — hook results reach the DM block + the report marker');
{
  // Formatter units: attribution appears only when the fact exists.
  const plain = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'healing', target: 'Garrick', total: 8, applied: 8 }]);
  assert(plain === '\n\n[SPELL EFFECT — system facts from the spell engine. Narrate exactly these outcomes; do not re-judge saves, damage, or healing.]\nCure Wounds — Garrick healed 8 HP.', 'healing line with no Life fact is byte-identical to before');
  const disc = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'healing', target: 'Lyra', total: 12, applied: 12, life: { discipleBonus: 3, diceMaxed: false } }]);
  assert(/includes Disciple of Life \+3/.test(disc), 'companion healing line attributes Disciple +3');
  const maxed = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'healing', target: 'Lyra', total: 22, applied: 19, life: { discipleBonus: 3, diceMaxed: true } }]);
  assert(/Supreme Healing: dice maxed/.test(maxed), 'companion healing line attributes Supreme Healing maxed dice');
  const blessed = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'healing', target: 'Bram', total: 4, applied: 4, blessedHealer: true }]);
  assert(/Blessed Healer self-heal/.test(blessed), 'self-heal line attributes Blessed Healer');
  const pool = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'life', preserveLifePool: 25 }]);
  assert(/Preserve Life pool 25/.test(pool), 'life line states the Preserve Life pool');
  const offeredFmt = scs.formatSpellEffectBlock([{ spell: 'Magic Missile', kind: 'wild_magic', offered: true, instruction: 'Wild Magic Surge: ask the player to roll a d20, then emit [WILD_MAGIC_REPORT: D20=<roll>].' }]);
  assert(/WILD_MAGIC_REPORT: D20/.test(offeredFmt), 'offered line carries the report marker for the DM');
  const trigFmt = scs.formatSpellEffectBlock([{ spell: 'Magic Missile', kind: 'wild_magic', offered: false, d20: 20, d100: 73, row: { range: '73–76', name: 'Long Teleport', effect: 'Teleport up to 60 feet.' }, applied: [], pendingSteps: ['teleport'], notes: [] }]);
  assert(/Long Teleport/.test(trigFmt) && /Pending: teleport/.test(trigFmt), 'triggered line names the row and its pending step');

  // PC Life cast end-to-end: return + stashed block, no repeat of the
  // pending instruction (the pool line is the only new Life line).
  const sera2Id = await insertRow('characters', {
    name: 'Sera2', class: 'Cleric', subclass: 'Life Domain', level: 5,
    current_hp: 30, max_hp: 30, armor_class: 16,
    ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}),
    skills: JSON.stringify([]),
  });
  const sessionK = await newSession(sera2Id);
  await dbRun('UPDATE characters SET current_hp = 10 WHERE id = ?', [pcId]);
  const castK = await scs.castSpell(sera2Id, 'Cure Wounds', 2, { sessionId: sessionK, target: 'Garrick' });
  assert(castK.life?.preserveLifePool === 25, 'PC Life cast return carries the Preserve Life pool (25)');
  const cfgK = await sessionConfigOf(sessionK);
  const blockK = scs.formatSpellEffectBlock(cfgK.recentSpellEffects || []);
  assert(/Disciple of Life: add 4/.test(blockK), 'PC Life stashed block carries the pending Disciple instruction');
  assert(/Preserve Life pool 25/.test(blockK), 'PC Life stashed block carries the Preserve Life pool line');
  assert((blockK.match(/Disciple of Life/g) || []).length === 1, 'Disciple is stated once, not repeated across lines');

  // Companion Life cast end-to-end: return + attributed effect line.
  const wren2Id = await addCompanion('Wren2', {
    progression_type: 'class_based', companion_class: 'Cleric', companion_subclass: 'Life Domain', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 13, int: 11, wis: 16, cha: 14 }),
    companion_current_hp: 18, companion_max_hp: 18, armor_class: 14,
    equipment: JSON.stringify({}), skills: JSON.stringify([]),
  });
  const lyra2Id = await addCompanion('Lyra2', {
    progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 12, dex: 16, con: 13, int: 10, wis: 14, cha: 10 }),
    companion_current_hp: 5, companion_max_hp: 24, armor_class: 14,
    equipment: JSON.stringify({}), skills: JSON.stringify([]),
  });
  const sessionL = await newSession(pcId);
  const castL = await scs.castCompanionSpell(pcId, 'Wren2', 'Cure Wounds', 1, { sessionId: sessionL, target: 'Lyra2' });
  assert(castL.life?.preserveLifePool === 15, 'companion Life cast return carries the pool (5 x 3 = 15)');
  assert(castL.effect?.life?.discipleBonus === 3, 'companion Life cast return carries Disciple +3');
  const cfgL = await sessionConfigOf(sessionL);
  const blockL = scs.formatSpellEffectBlock(cfgL.recentSpellEffects || []);
  assert(/includes Disciple of Life \+3/.test(blockL), 'companion Life stashed block attributes Disciple +3');
  assert(/Preserve Life pool 15/.test(blockL), 'companion Life stashed block carries the pool line');

  // PC Wild Magic offer end-to-end: return + offer record + stashed block.
  const zara2Id = await insertRow('characters', {
    name: 'Zara2', class: 'Sorcerer', subclass: 'Wild Magic Sorcery', level: 14,
    current_hp: 40, max_hp: 40, armor_class: 14,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 16 }),
    spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }),
    spell_slots_used: JSON.stringify({}),
    skills: JSON.stringify([]),
  });
  const sessionM = await newSession(zara2Id);
  const castM = await scs.castSpell(zara2Id, 'Magic Missile', 1, { sessionId: sessionM });
  assert(castM.wildMagic?.offered === true && /WILD_MAGIC_REPORT/.test(castM.wildMagic?.instruction || ''), 'PC offer instruction names the report marker');
  const cfgM = await sessionConfigOf(sessionM);
  assert(cfgM.pendingWildMagicOffer?.spellName === 'Magic Missile', 'offer record written (spell + slot survive the cast)');
  assert(cfgM.pendingWildMagicOffer?.slotLevel === 1, 'offer record carries the slot level');
  const blockM = scs.formatSpellEffectBlock(cfgM.recentSpellEffects || []);
  assert(/WILD_MAGIC_REPORT: D20/.test(blockM), 'stashed block carries the PC d20 offer for the DM');

  // The report marker answers the offer through the real pipeline:
  // no slot spent, row lands, offer consumed, stale ask dropped.
  const report = await mp.processResponseMarkers('[WILD_MAGIC_REPORT: D20=20 D100=10]', { characterId: zara2Id, sessionId: sessionM });
  const hr = (report.handlerResults || []).find((r) => r.schemaKey === 'WILD_MAGIC_REPORT');
  assert(hr?.ok === true && hr?.result?.success === true, 'report marker dispatches');
  assert(hr?.result?.wildMagic?.triggered === true && hr?.result?.wildMagic?.row?.name === 'Regeneration', 'reported d20 20 + d100 10 triggers Regeneration');
  const cfgM2 = await sessionConfigOf(sessionM);
  assert(cfgM2.pendingWildMagicOffer == null, 'offer record cleared by the report');
  const blockM2 = scs.formatSpellEffectBlock(cfgM2.recentSpellEffects || []);
  assert(/Regeneration/.test(blockM2), 'stashed block carries the triggered row');
  assert(!/WILD_MAGIC_REPORT/.test(blockM2), 'stale offer ask is dropped once the row lands');
  const zara2 = await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [zara2Id]);
  assert(JSON.parse(zara2.spell_slots_used || '{}')['1'] === 1, 'the report spent no slot (still 1 used L1)');

  // Report with no pending offer refuses fail-closed.
  const sessionN = await newSession(zara2Id);
  const noOffer = await mp.processResponseMarkers('[WILD_MAGIC_REPORT: D20=20]', { characterId: zara2Id, sessionId: sessionN });
  const hrN = (noOffer.handlerResults || []).find((r) => r.schemaKey === 'WILD_MAGIC_REPORT');
  assert(hrN?.ok === true && hrN?.result?.success === false && hrN?.result?.reason === 'no_pending_wild_magic_offer', 'report with no offer refuses');

  // A reported 19 is an answer too: no surge, offer consumed, nothing stashed.
  const sessionO = await newSession(zara2Id);
  await scs.castSpell(zara2Id, 'Magic Missile', 1, { sessionId: sessionO });
  const rep19 = await mp.processResponseMarkers('[WILD_MAGIC_REPORT: D20=19]', { characterId: zara2Id, sessionId: sessionO });
  const hr19 = (rep19.handlerResults || []).find((r) => r.schemaKey === 'WILD_MAGIC_REPORT');
  assert(hr19?.result?.success === true && hr19?.result?.wildMagic?.triggered === false, 'reported d20 19: no surge');
  const cfgO = await sessionConfigOf(sessionO);
  assert(cfgO.pendingWildMagicOffer == null, 'offer cleared by the 19 report');
  assert(!(cfgO.recentSpellEffects || []).some((o) => o.kind === 'wild_magic' && o.row), 'no triggered row stashed for a 19');

  // Tides of Chaos, PC face: forced offer asks for the d100, report resolves it.
  const sessionP = await newSession(zara2Id);
  const tides = await scs.castSpell(zara2Id, 'Magic Missile', 3, { sessionId: sessionP, tidesOfChaos: true });
  assert(tides.wildMagic?.forced === true && tides.wildMagic?.offered === true, 'Tides forced offer');
  assert(/WILD_MAGIC_REPORT: D100=/.test(tides.wildMagic?.instruction || ''), 'Tides instruction names the d100 report marker');
  const repT = await mp.processResponseMarkers('[WILD_MAGIC_REPORT: D100=50]', { characterId: zara2Id, sessionId: sessionP });
  const hrT = (repT.handlerResults || []).find((r) => r.schemaKey === 'WILD_MAGIC_REPORT');
  assert(hrT?.result?.wildMagic?.triggered === true && hrT?.result?.wildMagic?.row?.name === 'Spectral Shield', 'Tides report d100 50 triggers Spectral Shield');

  // Companion Wild Magic face: system roll lands in the return AND the block.
  const pip2Id = await addCompanion('Pip2', {
    progression_type: 'class_based', companion_class: 'Sorcerer', companion_subclass: 'Wild Magic Sorcery', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 16 }),
    companion_current_hp: 20, companion_max_hp: 20, armor_class: 14,
    equipment: JSON.stringify({}), skills: JSON.stringify([]),
  });
  const sessionQ = await newSession(pcId);
  const castQ = await scs.castCompanionSpell(pcId, 'Pip2', 'Magic Missile', 1, { sessionId: sessionQ, d20Roll: 20, d100Roll: 73 });
  assert(castQ.wildMagic?.triggered === true && castQ.wildMagic?.row?.name === 'Long Teleport', 'companion cast return carries the triggered row');
  assert(castQ.life == null, 'companion sorcerer cast carries no Life result');
  const cfgQ = await sessionConfigOf(sessionQ);
  const blockQ = scs.formatSpellEffectBlock(cfgQ.recentSpellEffects || []);
  assert(/Long Teleport/.test(blockQ), 'companion stashed block names the triggered row');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
