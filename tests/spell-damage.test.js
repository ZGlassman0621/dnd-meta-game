/**
 * tests/spell-damage.test.js — spell damage & healing (spell-damage
 * build; design: spell-damage-design.md).
 *
 * Pins:
 *   - the catalog owns spell dice now: spellEffectSpec math (base,
 *     upcast scaling, cantrip tiers, healing specs, flat modifiers);
 *   - PC casts leave a PENDING effect (the DM states what to roll; the
 *     player reports one total) and the resolver applies full / half /
 *     none per the saves the system rolled at cast time, multi-target;
 *   - PC healing pends the same way and lands through the HP pipeline,
 *     capped at max;
 *   - Magic Missile (no save, no attack roll) pends with a null save
 *     and takes the full total;
 *   - companion casts resolve immediately — system-rolled damage and
 *     healing, no pending ever created;
 *   - ATTACK spell profiles read the catalog by default (Damage= is now
 *     only an override for spells the catalog doesn't know).
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-spelldmg-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const catalog = await import(svc('server/data/spellCatalog.js'));
const scs = await import(svc('server/services/spellCastService.js'));
const pas = await import(svc('server/services/partyAttackService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers combat markers

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
// Garrick: the wounded friend everyone heals. HP 10/30.
const pcId = await insertRow('characters', {
  name: 'Garrick', class: 'Fighter', level: 3,
  current_hp: 10, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
  skills: JSON.stringify([])
});
// Sera: L5 cleric, WIS 16 → modifier +3, PB 3, spell save DC 14.
const seraId = await insertRow('characters', {
  name: 'Sera', class: 'Cleric', level: 5,
  current_hp: 30, max_hp: 30, armor_class: 16,
  ability_scores: JSON.stringify({ str: 12, dex: 10, con: 14, int: 10, wis: 16, cha: 12 }),
  spell_slots: JSON.stringify({ 1: 4, 2: 3, 3: 2 }), spell_slots_used: JSON.stringify({}),
  skills: JSON.stringify([])
});
async function addCompanion(name, over) {
  const npcId = await insertRow('npcs', { name });
  return insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: JSON.stringify({}),
    ...over
  });
}
// Wren: class_based cleric L3 (WIS 16 → DC 13). The companion caster.
const wrenId = await addCompanion('Wren', {
  progression_type: 'class_based', companion_class: 'Cleric', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 10, dex: 12, con: 13, int: 11, wis: 16, cha: 14 }),
  companion_current_hp: 18, companion_max_hp: 18, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([])
});
// Lyra: ranger L3, badly wounded — the companion heal target.
const lyraId = await addCompanion('Lyra', {
  progression_type: 'class_based', companion_class: 'Ranger', companion_level: 3,
  companion_ability_scores: JSON.stringify({ str: 12, dex: 16, con: 13, int: 10, wis: 14, cha: 10 }),
  companion_current_hp: 5, companion_max_hp: 24, armor_class: 14,
  equipment: JSON.stringify({}), skills: JSON.stringify([])
});

const sessionS = await insertRow('dm_sessions', { character_id: seraId, status: 'active' });
const CTXS = { characterId: seraId, sessionId: sessionS };
const sessionA = await insertRow('dm_sessions', { character_id: pcId, status: 'active' });
const CTXA = { characterId: pcId, sessionId: sessionA };

await es.createEncounterEnemies(sessionS, 1, [
  { name: 'Goblin', maxHp: 60, armorClass: 12, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 },
  { name: 'Orc', maxHp: 60, armorClass: 13, attackBonus: 5, damageDice: '1d12+3', dexMod: 1 }
]);
await es.createEncounterEnemies(sessionA, 1, [
  { name: 'Goblin', maxHp: 60, armorClass: 12, attackBonus: 4, damageDice: '1d6+2', dexMod: 2 }
]);
const hpS = async (name) => (await dbGet('SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionS, name])).current_hp;
const hpA = async (name) => (await dbGet('SELECT current_hp FROM combat_enemies WHERE session_id = ? AND name = ?', [sessionA, name])).current_hp;

// ---------------------------------------------------------------------------
group('1. spellEffectSpec — the catalog owns the dice');
{
  const fb = catalog.spellEffectSpec('Fireball', { slotLevel: 3 });
  assert(fb && fb.spec === '8d6' && fb.kind === 'damage' && fb.damageOnSave === 'half', 'Fireball at base level is 8d6, half on a save');
  assert(catalog.spellEffectSpec('Fireball', { slotLevel: 4 }).spec === '9d6', 'Fireball upcast to 4th is 9d6 (+1d6 per slot)');
  assert(catalog.spellEffectSpec('Fire Bolt', { casterLevel: 1 }).spec === '1d10', 'Fire Bolt is 1d10 at levels 1-4');
  assert(catalog.spellEffectSpec('Fire Bolt', { casterLevel: 5 }).spec === '2d10', 'Fire Bolt doubles at caster level 5');
  assert(catalog.spellEffectSpec('Fire Bolt', { casterLevel: 11 }).spec === '3d10', 'and triples at 11');
  const cw = catalog.spellEffectSpec('Cure Wounds', { slotLevel: 1 });
  assert(cw && cw.kind === 'healing' && cw.count === 2 && cw.sides === 8 && cw.addCastingMod === true, 'Cure Wounds is 2d8 healing plus the casting modifier');
  assert(catalog.spellEffectSpec('Cure Wounds', { slotLevel: 2 }).spec === '4d8', 'Cure Wounds upcast adds 2d8 per slot (2024 PHB, verified at catalog completion)');
  assert(catalog.spellEffectSpec('Magic Missile', { slotLevel: 1 }).spec === '3d4+3', 'Magic Missile is 3 darts of 1d4+1');
  assert(catalog.spellEffectSpec('Magic Missile', { slotLevel: 2 }).spec === '4d4+4', 'an upcast adds a whole dart (dice and +1)');
  assert(catalog.spellEffectSpec('Sacred Flame', { casterLevel: 3 }).damageOnSave === 'none', 'Sacred Flame does nothing on a made save');
  assert(catalog.spellEffectSpec('Mage Armor') === null, 'a spell with no damage or healing has no spec');
  assert(catalog.spellEffectSpec('Nonexistent Spell') === null, 'an unknown spell has no spec');
}

// ---------------------------------------------------------------------------
group('2. PC Fireball — pending, multi-target, resolved from the reported total');
{
  const c1 = await marker('[SPELL_CAST: Spell="Fireball" Level=3 Target="Goblin"]', CTXS);
  assert(c1 && c1.success === true && c1.slotConsumed === true && c1.spellSave, 'the cast consumes the slot and rolls the Goblin save');
  assert(c1.pendingEffect && c1.pendingEffect.spec === '8d6' && c1.pendingEffect.targets.length === 1, 'a pending effect is recorded: roll 8d6');
  const c2 = await marker('[SPELL_CAST: Spell="Fireball" Level=3 Target="Orc"]', CTXS);
  assert(c2 && c2.pendingEffect && c2.pendingEffect.targets.length === 2, 'a second target of the same cast joins the same pending (one cast, one roll)');
  const goblinSave = c1.pendingEffect.targets[0].saveSuccess;
  const orcSave = c2.pendingEffect.targets[1].saveSuccess;
  const res = await scs.resolveReportedSpellEffect(sessionS, seraId, 31);
  assert(res && res.outcomes.length === 2, 'the reported total resolves both targets');
  const g = res.outcomes.find(o => o.target === 'Goblin');
  const o = res.outcomes.find(o => o.target === 'Orc');
  assert(g.applied === (goblinSave ? 15 : 31), 'the Goblin takes full on a failed save, half (floored) on a made one');
  assert(o.applied === (orcSave ? 15 : 31), 'the Orc likewise');
  assert((await hpS('Goblin')) === 60 - g.applied && (await hpS('Orc')) === 60 - o.applied, 'enemy HP reconciles with the applied damage');
  assert((await scs.getPendingSpellEffect(sessionS)) === null, 'the pending is consumed by the report');
}

// ---------------------------------------------------------------------------
group('3. Resolver arithmetic — save-or-nothing and the shared roll');
{
  // Hand-built pending: the honest unit test of the resolver's math
  // (a made Sacred Flame save cannot be forced through the cast path
  // without dice luck).
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionS]);
  const cfg = JSON.parse(s.session_config || '{}');
  cfg.pendingSpellEffect = {
    spell: 'Sacred Flame', kind: 'damage', spec: '1d8', damageType: 'radiant', damageOnSave: 'none',
    targets: [{ kind: 'enemy', name: 'Goblin', saveSuccess: true }], encounterSeq: 1
  };
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionS]);
  const before = await hpS('Goblin');
  const res = await scs.resolveReportedSpellEffect(sessionS, seraId, 7);
  assert(res.outcomes[0].applied === 0 && (await hpS('Goblin')) === before, 'a made save vs a save-or-nothing spell applies 0');
}

// ---------------------------------------------------------------------------
group('4. PC Cure Wounds — healing pends, lands through the HP pipeline, caps');
{
  const self = await marker('[SPELL_CAST: Spell="Cure Wounds" Level=1]', CTXS);
  assert(self && self.pendingEffect && self.pendingEffect.kind === 'healing' && self.pendingEffect.spec === '2d8+3',
    'a self-heal pends with the true spec: 2d8 + WIS 3');
  await dbRun('UPDATE characters SET current_hp = 10 WHERE id = ?', [seraId]);
  const res = await scs.resolveReportedSpellEffect(sessionS, seraId, 12);
  const sera = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [seraId]);
  assert(res.outcomes[0].applied === 12 && sera.current_hp === 22, 'the reported 12 heals exactly 12');
  const self2 = await marker('[SPELL_CAST: Spell="Cure Wounds" Level=1]', CTXS);
  assert(!!self2.pendingEffect, 'a second cast pends again');
  const res2 = await scs.resolveReportedSpellEffect(sessionS, seraId, 99);
  const sera2 = await dbGet('SELECT current_hp FROM characters WHERE id = ?', [seraId]);
  assert(sera2.current_hp === 30 && res2.outcomes[0].applied === 8, 'overheal caps at max HP and reports the capped amount');
}

// ---------------------------------------------------------------------------
group('5. Magic Missile — no save to roll, full total lands');
{
  const before = await hpS('Goblin');
  const c = await marker('[SPELL_CAST: Spell="Magic Missile" Level=1 Target="Goblin"]', CTXS);
  assert(c && c.success === true && !c.spellSave, 'Magic Missile rolls no save');
  assert(c.pendingEffect && c.pendingEffect.targets[0].saveSuccess === null, 'its pending target carries a null save (automatic hit)');
  const res = await scs.resolveReportedSpellEffect(sessionS, seraId, 11);
  assert(res.outcomes[0].applied === 11 && (await hpS('Goblin')) === before - 11, 'the full reported total lands');
}

// ---------------------------------------------------------------------------
group('6. Companion casts resolve immediately — damage');
{
  const before = await hpA('Goblin');
  const c = await marker('[SPELL_CAST: Spell="Sacred Flame" Level=0 Caster="Wren" Target="Goblin"]', CTXA);
  assert(c && c.success === true && c.effect && c.effect.kind === 'damage', "Wren's Sacred Flame resolves its damage in the same pass");
  assert(c.effect.applied === (c.effect.saveSuccess ? 0 : c.effect.total), 'applied matches the save: made = none, failed = the rolled total');
  assert(c.effect.total >= 1 && c.effect.total <= 8, 'the damage total is one real d8');
  assert((await hpA('Goblin')) === before - c.effect.applied, 'the Goblin HP moved by exactly the applied damage');
  assert((await scs.getPendingSpellEffect(sessionA)) === null, 'no pending is ever created for a companion cast');
}

// ---------------------------------------------------------------------------
group('7. Companion casts resolve immediately — healing');
{
  const c = await marker('[SPELL_CAST: Spell="Cure Wounds" Level=1 Caster="Wren" Target="Lyra"]', CTXA);
  assert(c && c.success === true && c.slotConsumed === true && c.effect && c.effect.kind === 'healing', "Wren's Cure Wounds on Lyra resolves at cast");
  const lyra = await dbGet('SELECT companion_current_hp, companion_spell_slots_used FROM companions WHERE id = ?', [lyraId]);
  assert(lyra.companion_current_hp === 5 + c.effect.applied && c.effect.applied === c.effect.total, 'Lyra rises by the rolled amount (2d8 + WIS 3)');
  assert(c.effect.total >= 5 && c.effect.total <= 19, 'the heal total is inside the spec range');
  assert((await scs.getPendingSpellEffect(sessionA)) === null, 'still no pending on the companion side');
}

// ---------------------------------------------------------------------------
group('8. ATTACK spell profiles come from the catalog now');
{
  const wrenRow = await dbGet('SELECT * FROM companions WHERE id = ?', [wrenId]);
  const gb = pas.buildAttackProfile('companion', wrenRow, { spellName: 'Guiding Bolt' });
  assert(gb.profile && gb.profile.damageDice === '4d6' && gb.profile.attackBonus === 5, 'Guiding Bolt needs no Damage= anymore: 4d6 from the catalog, +5 to hit');
  const sw = pas.buildAttackProfile('companion', wrenRow, { spellName: 'Spiritual Weapon' });
  assert(sw.profile && sw.profile.damageDice === '1d8' && sw.profile.damageModifier === 3, 'Spiritual Weapon carries the casting modifier (1d8+3)');
  const ov = pas.buildAttackProfile('companion', wrenRow, { spellName: 'Guiding Bolt', damageOverride: '2d6' });
  assert(ov.profile && ov.profile.damageDice === '2d6', 'Damage= still overrides for homebrew');
  const unk = pas.buildAttackProfile('companion', wrenRow, { spellName: 'True Strike' });
  assert(!!unk.error, 'a spell with no catalog damage still asks for Damage=');
}

// ---------------------------------------------------------------------------
group('9. formatSpellEffectBlock — the facts the DM narrates');
{
  const pending = scs.formatSpellEffectBlock([{ pending: true, spell: 'Fireball', kind: 'damage', spec: '8d6', damageType: 'fire' }]);
  assert(/PENDING/.test(pending) && /8d6/.test(pending), 'a pending block tells the DM the player rolls 8d6');
  const dmg = scs.formatSpellEffectBlock([{ spell: 'Fireball', kind: 'damage', target: 'Goblin', total: 31, applied: 15, saveSuccess: true, killed: false }]);
  assert(/takes 15/.test(dmg) && /save made/.test(dmg), 'a resolved block states the applied damage and the save');
  const heal = scs.formatSpellEffectBlock([{ spell: 'Cure Wounds', kind: 'healing', target: 'Lyra', total: 12, applied: 12 }]);
  assert(/healed 12/.test(heal), 'a healing block states the amount');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
