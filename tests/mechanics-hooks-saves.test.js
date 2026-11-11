/**
 * Mechanics hooks — Family 6 (save / condition hooks, D9 resistance
 * table, D4 Heroic Inspiration reroll spend).
 *
 * STAGED ONLY — built from cached mirror copies of the Mac repo (see
 * NOTES.md in this staging directory). NOT pushed, NOT gated.
 *
 * Pure rule functions are asserted exactly; server rolls assert
 * invariants (dice ranges, total accounting, outcome consistency with
 * resolveDice on the logged dice) — never exact random values.
 *
 * DEPENDENCY (merge order): the DB-backed groups below resolve subclass
 * features through subclassService.featuresForActor, which is another
 * worker's piece and is absent from the mirror. If that export is not
 * present when this file runs, the subclass groups fail (features
 * resolve to []) — that is a merge-order failure, not a product
 * failure; see NOTES.md. The pure groups do not need it.
 *
 * Isolated throwaway DB (clock-unification pattern): temp dir becomes
 * CWD before database.js loads, and the runner's shared TURSO env is
 * deleted so database.js uses the local file.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mech-hooks-f6-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const rolls = await import(fromRepo('server/services/rollRequestService.js'));
const conds = await import(fromRepo('server/services/conditionService.js'));
const resist = await import(fromRepo('server/services/resistanceService.js'));
const enemySpells = await import(fromRepo('server/services/enemySpellService.js'));

async function insertRow(table, overrides = {}) {
  const cols = await db.dbAll(`PRAGMA table_info(${table})`);
  const names = [];
  const values = [];
  for (const col of cols) {
    if (col.pk && col.type.toUpperCase().includes('INT')) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, col.name)) {
      names.push(col.name); values.push(overrides[col.name]);
    } else if (col.notnull) {
      names.push(col.name);
      const t = col.type.toUpperCase();
      values.push(t.includes('INT') || t.includes('REAL') || t.includes('NUM') ? 0 : 'x');
    }
  }
  const placeholders = names.map(() => '?').join(',');
  const r = await db.dbRun(`INSERT INTO ${table} (${names.join(',')}) VALUES (${placeholders})`, values);
  return Number(r.lastInsertRowid);
}

const SCORES = { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 10 };
const feat = (key) => ({ key, name: key, level: 1, kind: 'E', mechanics: {}, prompt: '' });

// ---------------------------------------------------------------------------
group('1. Pure — subclass save effects (conditionService.subclassSaveEffects)');

let e = conds.subclassSaveEffects([feat('durable_magic')], { kind: 'save', name: 'Intelligence', level: 10 });
assert(e.bonus === 2 && !e.advantage, 'Durable Magic: +2 to all saves');
e = conds.subclassSaveEffects([feat('durable_magic')], { kind: 'skill', name: 'Arcana', level: 10 });
assert(e.bonus === 0 && !e.advantage, 'Durable Magic: does not touch skill checks');
e = conds.subclassSaveEffects([feat('spell_resistance')], { kind: 'save', name: 'Wisdom', isSpellSave: true, level: 14 });
assert(e.advantage === true, 'Spell Resistance: advantage on saves vs spells');
e = conds.subclassSaveEffects([feat('spell_resistance')], { kind: 'save', name: 'Wisdom', isSpellSave: false, level: 14 });
assert(e.advantage === false, 'Spell Resistance: no advantage when the save is not vs a spell');
e = conds.subclassSaveEffects([feat('guarded_mind')], { kind: 'save', name: 'Wisdom', saveVsCondition: 'charmed', level: 10 });
assert(e.advantage === true, 'Guarded Mind: advantage vs being Charmed');
e = conds.subclassSaveEffects([feat('guarded_mind')], { kind: 'save', name: 'Wisdom', saveVsCondition: 'poisoned', level: 10 });
assert(e.advantage === false, 'Guarded Mind: no advantage vs being Poisoned');
e = conds.subclassSaveEffects([feat('psychic_defenses')], { kind: 'save', name: 'Charisma', saveVsCondition: 'frightened', level: 6 });
assert(e.advantage === true, 'Psychic Defenses: advantage vs being Frightened');
e = conds.subclassSaveEffects([feat('iron_mind')], { kind: 'save', name: 'Wisdom', saveProficient: false, level: 7 });
assert(e.bonus === 3, 'Iron Mind: +PB (+3 at L7) to Wisdom saves when not already proficient');
e = conds.subclassSaveEffects([feat('iron_mind')], { kind: 'save', name: 'Wisdom', saveProficient: true, level: 7 });
assert(e.bonus === 0, 'Iron Mind: no bonus when already proficient in Wisdom saves');
e = conds.subclassSaveEffects([feat('iron_mind')], { kind: 'save', name: 'Dexterity', saveProficient: false, level: 7 });
assert(e.bonus === 0, 'Iron Mind: no bonus to non-Wisdom saves');
e = conds.subclassSaveEffects([feat('supernatural_defense')], { kind: 'save', name: 'Constitution', level: 7 });
assert(e.bonusDice === null, 'Supernatural Defense: dormant without preyForced (save not forced by Slayer\'s Prey target)');
e = conds.subclassSaveEffects([feat('supernatural_defense')], { kind: 'save', name: 'Constitution', preyForced: true, level: 7 });
assert(e.bonusDice && e.bonusDice.count === 1 && e.bonusDice.sides === 6, 'Supernatural Defense: +1d6 when the save is forced by the Prey target');
e = conds.subclassSaveEffects([feat('eyes_wide_open')], { kind: 'save', name: 'Constitution', saveVsCondition: 'blinded', timedEffects: new Set(['eyes_wide_open']), level: 17 });
assert(e.advantage === true, 'Eyes Wide Open: advantage vs Blinded while the effect is active');
e = conds.subclassSaveEffects([feat('eyes_wide_open')], { kind: 'save', name: 'Constitution', saveVsCondition: 'blinded', timedEffects: new Set(), level: 17 });
assert(e.advantage === false, 'Eyes Wide Open: no advantage when the effect is not active');
e = conds.subclassSaveEffects([feat('durable_magic'), feat('spell_resistance')], { kind: 'save', name: 'Wisdom', isSpellSave: true, level: 14 });
assert(e.bonus === 2 && e.advantage === true, 'Durable Magic + Spell Resistance stack (bonus + advantage, different sources)');

// ---------------------------------------------------------------------------
group('2. Pure — caster-imposed save disadvantage marks');

let m = conds.saveDisadvantageFromMarks(['eldritch_strike'], { isSpellSave: true });
assert(m.disadvantage === true, 'Eldritch Strike mark: disadvantage on the save vs your spell');
m = conds.saveDisadvantageFromMarks(['eldritch_strike'], { isSpellSave: false });
assert(m.disadvantage === false, 'Marks never fire on a non-spell save');
m = conds.saveDisadvantageFromMarks(['corona_of_light'], { isSpellSave: true, spellDamageType: 'fire' });
assert(m.disadvantage === true, 'Corona of Light: disadvantage vs Fire spells');
m = conds.saveDisadvantageFromMarks(['corona_of_light'], { isSpellSave: true, spellDamageType: 'cold' });
assert(m.disadvantage === false, 'Corona of Light: no disadvantage vs Cold spells');
m = conds.saveDisadvantageFromMarks(['corona_of_light'], { isSpellSave: true });
assert(m.disadvantage === false, 'Corona of Light: unknown damage type fails closed');
m = conds.saveDisadvantageFromMarks(['brand_of_the_sapping_scar'], { isSpellSave: true, casterClass: 'warlock' });
assert(m.disadvantage === true, 'Brand of the Sapping Scar: disadvantage vs the warlock\'s spells');
m = conds.saveDisadvantageFromMarks(['brand_of_the_sapping_scar'], { isSpellSave: true, casterClass: 'fighter' });
assert(m.disadvantage === false, 'Brand of the Sapping Scar: no disadvantage vs a non-warlock\'s spells');
m = conds.saveDisadvantageFromMarks(['brand_of_the_sapping_scar'], { isSpellSave: true });
assert(m.disadvantage === false, 'Brand of the Sapping Scar: unknown caster class fails closed');
m = conds.saveDisadvantageFromMarks(['not_a_mark'], { isSpellSave: true });
assert(m.disadvantage === false, 'Unknown mark keys are ignored');

// ---------------------------------------------------------------------------
group('3. Pure — D9 resistance table (resistanceService)');

const actor = { raging: false, hasTakenTurn: null, subclassChoices: {}, timedEffects: new Set() };
let r = resist.applyResistanceToAmount(20, 'necrotic', [feat('aura_of_warding')], actor);
assert(r.amount === 10 && r.result === 'resistance' && r.source === 'Aura of Warding', 'Aura of Warding halves necrotic 20 -> 10, source named');
r = resist.applyResistanceToAmount(20, 'fire', [feat('aura_of_warding')], actor);
assert(r.amount === 20 && r.result === null, 'Aura of Warding: fire is untouched');
r = resist.applyResistanceToAmount(21, 'necrotic', [feat('aura_of_warding')], actor);
assert(r.amount === 10, 'Halving rounds down (21 -> 10)');
r = resist.applyResistanceToAmount(20, 'lightning', [feat('wind_soul')], actor);
assert(r.amount === 0 && r.result === 'immunity', 'Wind Soul: lightning immunity -> 0');
r = resist.applyResistanceToAmount(20, 'fire', [feat('potted_plant')], { ...actor, timedEffects: new Set(['potted_plant']) });
assert(r.amount === 40 && r.result === 'vulnerability', 'Potted Plant (Wild Magic): vulnerability doubles 20 -> 40');
r = resist.applyResistanceToAmount(20, 'fire', [feat('potted_plant')], { ...actor, timedEffects: new Set() });
assert(r.amount === 20 && r.result === null, 'Potted Plant: no vulnerability when the timed effect is not active');
r = resist.applyResistanceToAmount(20, 'fire', [feat('umbral_form'), feat('potted_plant')], { ...actor, timedEffects: new Set(['umbral_form', 'potted_plant']) });
assert(r.amount === 20 && r.result === null && r.cancelled === true, 'Resistance + vulnerability on the same type cancel (net x1, reported not hidden)');
r = resist.applyResistanceToAmount(20, 'fire', [feat('fiendish_resilience')], { ...actor, subclassChoices: { fiendish_resilience_type: 'fire' } });
assert(r.amount === 10 && r.source === 'Fiendish Resilience', 'Fiendish Resilience: stored choice (fire) halves fire');
r = resist.applyResistanceToAmount(20, 'fire', [feat('fiendish_resilience')], { ...actor, subclassChoices: {} });
assert(r.amount === 20 && r.result === null, 'Fiendish Resilience: no stored choice, no resistance (dormant, not invented)');
r = resist.applyResistanceToAmount(20, 'force', [feat('fiendish_resilience')], { ...actor, subclassChoices: { fiendish_resilience_type: 'force' } });
assert(r.amount === 20 && r.result === null, 'Fiendish Resilience: Force is excluded by the feature text');
r = resist.applyResistanceToAmount(20, 'fire', [feat('storm_soul')], { ...actor, subclassChoices: {} });
assert(r.amount === 20 && r.result === null, 'Storm Soul: dormant without a stored environment choice');
r = resist.applyResistanceToAmount(20, 'fire', [feat('storm_soul')], { ...actor, subclassChoices: { storm_soul_environment: 'Desert' } });
assert(r.amount === 10, 'Storm Soul: fires once the environment choice is stored (Desert -> fire)');
r = resist.applyResistanceToAmount(20, 'cold', [feat('confirmed_suspicions')], { ...actor, hasTakenTurn: false });
assert(r.amount === 10 && r.source === 'Confirmed Suspicions', 'Confirmed Suspicions: resistance to all damage before the first turn');
r = resist.applyResistanceToAmount(20, 'cold', [feat('confirmed_suspicions')], { ...actor, hasTakenTurn: true });
assert(r.amount === 20 && r.result === null, 'Confirmed Suspicions: no resistance once a turn has been taken');
r = resist.applyResistanceToAmount(20, 'cold', [feat('confirmed_suspicions')], { ...actor, hasTakenTurn: null });
assert(r.amount === 20 && r.result === null, 'Confirmed Suspicions: unknown turn state fails closed');
r = resist.applyResistanceToAmount(20, 'fire', [feat('spell_resistance')], actor, { sourceKind: 'spell' });
assert(r.amount === 10 && r.source === 'Spell Resistance', 'Abjurer Spell Resistance: resistance to damage from spells');
r = resist.applyResistanceToAmount(20, 'fire', [feat('spell_resistance')], actor, { sourceKind: 'attack' });
assert(r.amount === 20 && r.result === null, 'Abjurer Spell Resistance: no resistance to non-spell damage');
r = resist.applyResistanceToAmount(20, 'slashing', [feat('avatar_of_battle')], actor, { magical: false });
assert(r.amount === 10, 'Avatar of Battle: resistance to nonmagical bludgeoning/piercing/slashing');
r = resist.applyResistanceToAmount(20, 'slashing', [feat('avatar_of_battle')], actor, { magical: true });
assert(r.amount === 20 && r.result === null, 'Avatar of Battle: magical slashing is not resisted');
r = resist.applyResistanceToAmount(20, 'psychic', [feat('dread_allegiance')], { ...actor, subclassChoices: { dread_allegiance: 'Bane' } });
assert(r.amount === 10 && r.source === 'Dread Allegiance', 'Dread Allegiance: Bane -> psychic resistance');
r = resist.applyResistanceToAmount(7, 'bogus-type', [feat('aura_of_warding')], actor);
assert(r.amount === 7 && r.result === null, 'Unknown damage type: no row applies, amount untouched');

// ---------------------------------------------------------------------------
group('4. Pure — subclass condition immunities');

let im = resist.conditionImmunitiesForFeatures([feat('fungal_body')], actor);
assert(im.some((i) => i.condition === 'poisoned') && im.some((i) => i.condition === 'blinded'), 'Fungal Body: immune to blinded/deafened/frightened/poisoned');
im = resist.conditionImmunitiesForFeatures([feat('mindless_rage')], { ...actor, raging: true });
assert(im.some((i) => i.condition === 'charmed'), 'Mindless Rage: immune to Charmed/Frightened while Raging');
im = resist.conditionImmunitiesForFeatures([feat('mindless_rage')], { ...actor, raging: false });
assert(im.length === 0, 'Mindless Rage: no immunity when not Raging');
im = resist.conditionImmunitiesForFeatures([feat('aura_of_devotion')], actor);
assert(im.some((i) => i.condition === 'charmed'), 'Aura of Devotion: self immune to Charmed');
im = resist.conditionImmunitiesForFeatures([feat('aura_of_warding')], actor);
assert(im.length === 0, 'Aura of Warding grants no condition immunity');

// ---------------------------------------------------------------------------
// DB-backed groups. Characters/companions below use real registry
// subclasses; features resolve through subclassService.featuresForActor.
// ---------------------------------------------------------------------------
group('5. DB — PC save path: Durable Magic bonus in requestPcRoll / resolveReportedRoll');

const sessionId = await insertRow('dm_sessions', { session_config: '{}' });
const wizId = await insertRow('characters', {
  name: 'TestWizard', class: 'wizard', subclass: 'war magic', level: 10,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {} }),
});
const plainWizId = await insertRow('characters', {
  name: 'PlainWizard', class: 'wizard', subclass: 'evoker', level: 10,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {} }),
});
let req = await rolls.requestPcRoll({ sessionId, characterId: wizId, kind: 'save', name: 'Intelligence', dc: 15 });
assert(req.success === true, 'War Magic wizard: pending save created');
assert(req.pending.subclassBonus === 2, 'War Magic wizard: Durable Magic +2 stored on the pending');
assert(req.pending.modifier === 7, 'War Magic wizard: sheet modifier is +7 (Int 16 +3, PB +4, proficient)');
// Reported die 10: total = 10 + 7 + 2 = 19 vs DC 15 -> success.
let out = await rolls.resolveReportedRoll(sessionId, [10]);
assert(out && out.total === 19 && out.outcome === 'success' && out.subclassBonus === 2, 'War Magic wizard: reported 10 resolves to 19 (10 + 7 sheet + 2 Durable Magic)');
req = await rolls.requestPcRoll({ sessionId, characterId: plainWizId, kind: 'save', name: 'Intelligence', dc: 15 });
assert(req.success === true && req.pending.subclassBonus === 0, 'Evoker control: no subclass bonus on the pending');
out = await rolls.resolveReportedRoll(sessionId, [10]);
assert(out && out.total === 17 && out.subclassBonus === 0, 'Evoker control: reported 10 resolves to 17 (no bonus)');

// Restrained (DEX disadvantage) + Durable Magic combine: disadvantage
// stands, the +2 still applies.
await conds.addCondition('player', wizId, 'restrained');
req = await rolls.requestPcRoll({ sessionId, characterId: wizId, kind: 'save', name: 'Dexterity', dc: 15 });
assert(req.pending.advantage === 'disadvantage' && req.pending.subclassBonus === 2, 'Restrained War Magic wizard: DEX save disadvantaged, Durable Magic +2 still stored');
await conds.removeCondition('player', wizId, 'restrained');
out = await rolls.resolveReportedRoll(sessionId, [12, 4]);
assert(out && out.takenDie === 4, 'Disadvantaged roll takes the lower die (12, 4 -> 4)');

// ---------------------------------------------------------------------------
group('6. DB — condition immunity guard in addCondition');

const palId = await insertRow('characters', {
  name: 'TestPaladin', class: 'paladin', subclass: 'oath of devotion', level: 7,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {} }),
});
let add = await conds.addCondition('player', palId, 'charmed');
assert(add.success === false && add.immune === true, 'Aura of Devotion: Charmed is refused for the paladin');
add = await conds.addCondition('player', palId, 'frightened');
assert(add.success === true, 'Aura of Devotion: Frightened is not immune, applies normally');
await conds.removeCondition('player', palId, 'frightened');
add = await conds.addCondition('player', plainWizId, 'charmed');
assert(add.success === true, 'Evoker control: Charmed applies normally');
await conds.removeCondition('player', plainWizId, 'charmed');
// Mindless Rage: immunity only while Raging.
const barbId = await insertRow('characters', {
  name: 'TestBarbarian', class: 'barbarian', subclass: 'path of the berserker', level: 6,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {}, raging: false }),
});
add = await conds.addCondition('player', barbId, 'frightened');
assert(add.success === true, 'Mindless Rage: Frightened applies while not Raging');
await conds.removeCondition('player', barbId, 'frightened');
await db.dbRun('UPDATE characters SET class_resources_json = ? WHERE id = ?', [JSON.stringify({ used: {}, raging: true }), barbId]);
add = await conds.addCondition('player', barbId, 'frightened');
assert(add.success === false && add.immune === true, 'Mindless Rage: Frightened refused while Raging');

// ---------------------------------------------------------------------------
group('7. DB — Heroic Inspiration: grant, spend, reroll (D4)');

const heroId = await insertRow('characters', {
  name: 'TestHuman', class: 'fighter', subclass: 'champion', level: 5,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {} }),
});
let held = await rolls.hasHeroicInspiration('player', heroId);
assert(held.held === true, 'Heroic Inspiration: held at start (no used count recorded yet == pool full)');
let grant = await rolls.grantHeroicInspiration('player', heroId);
assert(grant.success === true && grant.alreadyHeld === true, 'Grant while held is a no-op success (max 1, never a second instance)');
let spend = await rolls.spendHeroicInspiration('player', heroId);
assert(spend.success === true && spend.used === 1, 'Spend succeeds while held');
spend = await rolls.spendHeroicInspiration('player', heroId);
assert(spend.success === false, 'Spend fails when none is held (fail-closed)');
grant = await rolls.grantHeroicInspiration('player', heroId);
assert(grant.success === true && !grant.alreadyHeld, 'Grant restores the pool after a spend');
held = await rolls.hasHeroicInspiration('player', heroId);
assert(held.held === true, 'Pool is held again after the grant');

// Reroll flow: pending roll -> reroll request spends the pool and
// re-issues the pending; the new reported roll stands.
const heroSessionId = await insertRow('dm_sessions', { session_config: '{}' });
await db.dbRun('UPDATE dm_sessions SET character_id = ? WHERE id = ?', [heroId, heroSessionId]);
req = await rolls.requestPcRoll({ sessionId: heroSessionId, characterId: heroId, kind: 'save', name: 'Strength', dc: 15 });
assert(req.success === true, 'Heroic reroll setup: pending save created');
let rr = await rolls.requestHeroicReroll(heroSessionId, { takenDie: 8, total: 13, outcome: 'failure' });
assert(rr.success === true && rr.pending.reroll === 'heroicInspiration', 'requestHeroicReroll: pool spent, pending re-issued as a reroll');
held = await rolls.hasHeroicInspiration('player', heroId);
assert(held.held === false, 'Reroll spent the pool');
rr = await rolls.requestHeroicReroll(heroSessionId);
assert(rr.success === false, 'One reroll per roll: a second reroll of the same pending is refused');
out = await rolls.resolveReportedRoll(heroSessionId, [16]);
assert(out && out.reroll === 'heroicInspiration' && out.rerolledFrom && out.rerolledFrom.takenDie === 8, 'Rerolled roll resolves with the reroll marker and the first roll on record');
assert(out.total === 16 + out.modifier + (out.subclassBonus || 0) + (out.penalty || 0), 'Rerolled total accounts like any reported roll (new roll stands)');
// No pool left: a fresh pending cannot be rerolled, and the pending survives.
req = await rolls.requestPcRoll({ sessionId: heroSessionId, characterId: heroId, kind: 'save', name: 'Strength', dc: 15 });
assert(req.success === true, 'Fresh pending created with an empty pool');
rr = await rolls.requestHeroicReroll(heroSessionId);
assert(rr.success === false, 'Reroll refused with an empty pool');
out = await rolls.resolveReportedRoll(heroSessionId, [10]);
assert(out && out.total === 10 + out.modifier, 'Pending survives the refused reroll and resolves normally');
// No pending at all: reroll refuses cleanly.
rr = await rolls.requestHeroicReroll(heroSessionId);
assert(rr.success === false, 'Reroll with no pending roll is refused');

// ---------------------------------------------------------------------------
group('8. DB — companion save path: subclass bonus is real math (rollForNpc)');

const npcId = await insertRow('npcs', { name: 'TestCompanion', campaign_id: 0 });
const compId = await insertRow('companions', {
  npc_id: npcId, recruited_by_character_id: wizId, status: 'active',
  progression_type: 'class_based', companion_class: 'wizard', companion_subclass: 'war magic',
  companion_level: 10, companion_ability_scores: JSON.stringify(SCORES),
  skill_proficiencies: JSON.stringify([]), companion_current_hp: 30, companion_max_hp: 30,
  class_resources_json: JSON.stringify({ used: {} }),
});
const compRoll = await rolls.rollForNpc({ sessionId, characterId: wizId, actorName: 'TestCompanion', kind: 'save', name: 'Intelligence', dc: 15 });
assert(compRoll && compRoll.subclassBonus === 2, 'War Magic companion: Durable Magic +2 in the server roll');
assert(compRoll && compRoll.total === compRoll.takenDie + 7 + 2, 'War Magic companion: total = taken die + 7 sheet + 2 Durable Magic');
assert(compRoll && rolls.resolveDice({ dice: compRoll.dice, modifier: compRoll.modifier + (compRoll.penalty || 0) + 2, dc: 15, advantage: compRoll.advantage || null }).outcome === compRoll.outcome, 'War Magic companion: outcome consistent with resolveDice on the logged dice');

// ---------------------------------------------------------------------------
group('9. DB — D9 resistance at damage time (enemySpellService)');

// MERGE FIX (2026-11-09): palId is an Oath of DEVOTION paladin
// (group 7's Aura of Devotion subject) — Devotion has no Aura of
// Warding. Aura of Warding is the ANCIENTS 7th feature, so group 9
// needs its own Ancients paladin row. Product code unchanged.
const ancientsId = await insertRow('characters', {
  name: 'TestAncients', class: 'paladin', subclass: 'Oath of the Ancients', level: 7,
  ability_scores: JSON.stringify(SCORES), skills: JSON.stringify([]),
  current_hp: 40, max_hp: 40, class_resources_json: JSON.stringify({ used: {} }),
});
const palSessionId = await insertRow('dm_sessions', { session_config: '{}' });
await db.dbRun('UPDATE dm_sessions SET character_id = ? WHERE id = ?', [ancientsId, palSessionId]);
await db.dbRun('UPDATE characters SET current_hp = 40 WHERE id = ?', [ancientsId]);
let dmg = await enemySpells.damageToPc(palSessionId, 1, ancientsId, 20, { type: 'necrotic', spell: 'test spell' });
assert(dmg.applied === 10 && dmg.resistance && dmg.resistance.result === 'resistance' && dmg.resistance.source === 'Aura of Warding', 'Aura of Warding: 20 necrotic -> 10 applied, source named');
const hpAfterNecrotic = (await db.dbGet('SELECT current_hp FROM characters WHERE id = ?', [ancientsId])).current_hp;
assert(hpAfterNecrotic === 30, 'HP moved by the resisted amount only (40 -> 30)');
dmg = await enemySpells.damageToPc(palSessionId, 1, ancientsId, 20, { type: 'fire', spell: 'test spell' });
assert(dmg.applied === 20 && dmg.resistance && dmg.resistance.result === null, 'Aura of Warding: 20 fire applies in full');
const hpAfterFire = (await db.dbGet('SELECT current_hp FROM characters WHERE id = ?', [ancientsId])).current_hp;
assert(hpAfterFire === 10, 'HP moved by the full fire amount (30 -> 10)');

// Fiendish Resilience companion: stored choice (fire) halves fire.
const warlockNpcId = await insertRow('npcs', { name: 'TestWarlock', campaign_id: 0 });
const warlockCompId = await insertRow('companions', {
  npc_id: warlockNpcId, recruited_by_character_id: wizId, status: 'active',
  progression_type: 'class_based', companion_class: 'warlock', companion_subclass: 'fiend patron',
  companion_level: 10, companion_ability_scores: JSON.stringify(SCORES),
  skill_proficiencies: JSON.stringify([]), companion_current_hp: 30, companion_max_hp: 30,
  class_resources_json: JSON.stringify({ used: {} }),
  subclass_choices_json: JSON.stringify({ fiendish_resilience_type: 'fire' }),
});
dmg = await enemySpells.damageToCompanion(palSessionId, 1, warlockCompId, 20, { type: 'fire', spell: 'test spell' });
assert(dmg.applied === 10 && dmg.resistance && dmg.resistance.source === 'Fiendish Resilience', 'Fiendish Resilience: 20 fire -> 10 applied for the companion with the stored choice');
dmg = await enemySpells.damageToCompanion(palSessionId, 1, warlockCompId, 20, { type: 'cold', spell: 'test spell' });
assert(dmg.applied === 20 && dmg.resistance && dmg.resistance.result === null, 'Fiendish Resilience: cold is not the chosen type, applies in full');

// ---------------------------------------------------------------------------
console.log(`\n mechanics-hooks-saves: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
