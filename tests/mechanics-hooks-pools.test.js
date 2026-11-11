/**
 * tests/mechanics-hooks-pools.test.js — Mechanics hooks, Families 2+7
 * (resource pools + rest resets) + D4 Heroic Inspiration grant.
 *
 * Staged 2026-11-09 from cached mirror copies; NOT verified live, NOT
 * pushed. Runs on the Mac gate (Zach's full npm test). The pure groups
 * (1–6, 9) need only the services; the DB groups (7–8) need the real
 * database + migrations (initDatabase, throwaway-DB pattern from
 * rest-time.test.js). No full repo/DB exists on the staging VM, so the
 * DB groups are verified on the VM by node --check + a pure-logic
 * smoke import only — see f2-f7 NOTES.md.
 *
 * Pins:
 *   - shared subclass-resolution helpers (subclassService): D6
 *     multiclass reads (class_levels), null-subclass skip, lowest
 *     crit threshold across classes;
 *   - subclassPoolMaxima per wired pool (24 subclass pools — see
 *     NOTES.md for the 147 census and the deferred list);
 *   - resourceMaxima merges base + subclass pools; Heroic
 *     Inspiration only for humans (max 1);
 *   - resetResourcesForRest per recorded rest rule (long / short or
 *     long / short+1 / long+1-if-empty), Arcane Ward HP value
 *     behavior (wardHp sibling key, full on long rest, untouched on
 *     short rest), unknown/stale keys pass through on a short rest;
 *   - spendResource spends subclass pools to the cap and refuses
 *     past it; unknown keys still refuse; 'ward' spend refused (it
 *     is a value, not a count);
 *   - applyRest (DM rest, the only rest): long rest restores
 *     subclass pools + grants Heroic Inspiration; short rest
 *     restores only the pools whose rule allows it.
 *
 * Isolated throwaway DB (clock-unification pattern).
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-pools-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
const { initDatabase, dbGet, dbRun, dbAll } = dbModule;
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const sub = await import(svc('server/services/subclassService.js'));
const cf = await import(svc('server/services/classFeatureService.js'));
const rt = await import(svc('server/services/restTimeService.js'));
const sched = await import(svc('server/services/scheduleService.js'));

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; } else { failed++; console.log(`  ✗ ${msg}`); }
}
function group(name) { console.log(`\n== ${name}`); }

// Established pattern (rest-time.test.js): list every NOT NULL column
// with no default, so a raw INSERT never fails SQLITE_CONSTRAINT_NOTNULL.
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

const scores = (o) => JSON.stringify({ str: 10, dex: 14, con: 14, int: 10, wis: 12, cha: 8, ...o });

// The fallback (campaign-less) clock is this suite's clock (rest-time
// pattern): make sure its row exists so applyRest can advance it.
const fbRow = await dbGet('SELECT id FROM world_clock WHERE campaign_id IS NULL ORDER BY id LIMIT 1');
if (!fbRow) {
  await dbRun('INSERT INTO world_clock (campaign_id, current_day, current_day_of_year, current_year, current_hour) VALUES (NULL, 1, 1, 1492, 8)');
}
await sched.getClock(null);

// ---------------------------------------------------------------------------
group('1. featuresForActor — D6 multiclass reads, null-subclass skip');
{
  const bm7 = sub.featuresForActor({ className: 'fighter', subclassName: 'Battle Master', level: 7 });
  assert(bm7.some((f) => f.key === 'combat_superiority'), 'BM 7 lists Combat Superiority');
  assert(bm7.every((f) => f.className === 'fighter' && f.subclassName === 'Battle Master' && f.classLevel === 7), 'entries carry class/subclass/level');
  assert(bm7.every((f) => Number(f.level) <= 7), 'only features at or below level');

  const multi = sub.featuresForActor({
    className: 'fighter', subclassName: 'Battle Master', level: 3,
    classLevels: [{ class: 'fighter', level: 3, subclass: 'Battle Master' }, { class: 'wizard', level: 3, subclass: 'Abjurer' }],
  });
  assert(multi.some((f) => f.key === 'combat_superiority'), 'multiclass reads the primary subclass');
  const ward = multi.find((f) => f.key === 'arcane_ward');
  assert(ward && ward.className === 'wizard' && ward.classLevel === 3, 'multiclass reads the second class subclass at its own level');

  const noSub = sub.featuresForActor({ className: 'fighter', subclassName: null, level: 7 });
  assert(noSub.length === 0, 'null subclass yields no features');
  const partial = sub.featuresForActor({
    className: 'fighter', subclassName: null, level: 7,
    classLevels: [{ class: 'wizard', level: 3, subclass: 'Abjurer' }],
  });
  assert(partial.some((f) => f.key === 'arcane_ward') && !partial.some((f) => f.key === 'combat_superiority'), 'a class_levels entry without a primary subclass still resolves');
  const unknown = sub.featuresForActor({ className: 'fighter', subclassName: 'Nope', level: 7 });
  assert(unknown.length === 0, 'unknown subclass yields no features');
}

// ---------------------------------------------------------------------------
group('2. critThresholdForActor — lowest threshold across classes');
{
  assert(sub.critThresholdForActor({ className: 'fighter', subclassName: 'Champion', level: 10 }) === 19, 'Champion 10 crits on 19');
  assert(sub.critThresholdForActor({ className: 'fighter', subclassName: 'Champion', level: 15 }) === 18, 'Champion 15 crits on 18');
  assert(sub.critThresholdForActor({ className: 'fighter', subclassName: 'Champion', level: 2 }) === 20, 'Champion below 3rd stays 20');
  assert(sub.critThresholdForActor({ className: 'fighter', subclassName: 'Battle Master', level: 10 }) === 20, 'non-Champion stays 20');
  assert(sub.critThresholdForActor({
    className: 'fighter', subclassName: 'Champion', level: 3,
    classLevels: [{ class: 'fighter', level: 3, subclass: 'Champion' }, { class: 'rogue', level: 5, subclass: 'Soulknife' }],
  }) === 19, 'multiclass takes the lowest threshold (Champion 19 over rogue 20)');
  assert(sub.critThresholdForActor({ className: 'fighter', subclassName: null, level: 7 }) === 20, 'no subclass stays 20');
}

// ---------------------------------------------------------------------------
group('3. hasSubclassFeature / featureByKey');
{
  const actor = { className: 'fighter', subclassName: 'Battle Master', level: 7 };
  assert(sub.hasSubclassFeature(actor, 'combat_superiority') === true, 'has Combat Superiority');
  assert(sub.hasSubclassFeature(actor, 'portent') === false, 'no Portent on a Battle Master');
  assert(sub.hasSubclassFeature(actor, null) === false, 'null key is false, never throws');
  const feat = sub.featureByKey(actor, 'combat_superiority');
  assert(feat && feat.name === 'Combat Superiority', 'featureByKey returns the feature');
  assert(sub.featureByKey(actor, 'portent') === null, 'missing key returns null');
}

// ---------------------------------------------------------------------------
group('4. subclassPoolMaxima — one assert per wired pool');
{
  const ab = (o) => scores(o);
  const at = (className, subclassName, level, extra = {}) => ({ className, subclassName, level, ...extra });
  assert(sub.subclassPoolMaxima(at('fighter', 'Battle Master', 7), ab({}))?.superiority === 5, 'superiority 5 at BM 7');
  assert(sub.subclassPoolMaxima(at('fighter', 'Battle Master', 15), ab({}))?.superiority === 6, 'superiority 6 at BM 15');
  assert(sub.subclassPoolMaxima(at('fighter', 'Battle Master', 2), ab({}))?.superiority === undefined, 'no superiority below 3rd');
  assert(sub.subclassPoolMaxima(at('fighter', 'Psi Warrior', 5), ab({}))?.psionic === 6, 'psionic 6 at Psi Warrior 5 (2x PB 3)');
  assert(sub.subclassPoolMaxima(at('rogue', 'Soulknife', 5), ab({}))?.soulknife === 6, 'soulknife 6 at Soulknife 5');
  assert(sub.subclassPoolMaxima(at('wizard', 'Abjurer', 5), ab({ int: 16 }))?.ward === 13, 'ward 13 at Abjurer 5, Int +3 (2x level + Int)');
  assert(sub.subclassPoolMaxima(at('warlock', 'Celestial Patron', 5), ab({}))?.healingLight === 6, 'healing light 6 at Celestial 5');
  assert(sub.subclassPoolMaxima(at('wizard', 'Diviner', 5), ab({}))?.portent === 2, 'portent 2 at Diviner 5');
  assert(sub.subclassPoolMaxima(at('wizard', 'Diviner', 14), ab({}))?.portent === 3, 'portent 3 at Diviner 14 (Greater Portent)');
  assert(sub.subclassPoolMaxima(at('cleric', 'Light Domain', 5), ab({ wis: 16 }))?.wardingFlare === 3, 'warding flare 3 at Light 5, Wis +3');
  assert(sub.subclassPoolMaxima(at('cleric', 'Grave Domain', 6), ab({ wis: 16 }))?.grave === 3, 'grave 3 at Grave 6, Wis +3 (Sentinel at Death\'s Door)');
  assert(sub.subclassPoolMaxima(at('druid', 'Circle of Dreams', 5), ab({}))?.balm === 5, 'balm 5 at Dreams 5 (druid level)');
  assert(sub.subclassPoolMaxima(at('fighter', 'Samurai', 3), ab({}))?.fightingSpirit === 3, 'fighting spirit 3 at Samurai 3');
  assert(sub.subclassPoolMaxima(at('wizard', 'Bladesinger', 3), ab({ int: 16 }))?.bladesong === 3, 'bladesong 3 at Bladesinger 3, Int +3');
  assert(sub.subclassPoolMaxima(at('artificer', 'Battle Smith', 9), ab({ int: 16 }))?.arcaneJolt === 3, 'arcane jolt 3 at Battle Smith 9, Int +3');
  assert(sub.subclassPoolMaxima(at('artificer', 'Alchemist', 9), ab({ int: 16 }))?.restorativeReagents === 3, 'restorative reagents 3 at Alchemist 9, Int +3');
  assert(sub.subclassPoolMaxima(at('artificer', 'Cartographer', 3), ab({ int: 16 }))?.illuminatedCartography === 3, 'illuminated cartography 3 at Cartographer 3, Int +3');
  assert(sub.subclassPoolMaxima(at('artificer', 'Lumberjack', 15), ab({ int: 16 }))?.giantStature === 3, 'giant stature 3 at Lumberjack 15, Int +3');
  assert(sub.subclassPoolMaxima(at('wizard', 'Chronurgy Magic', 3), ab({}))?.chronalShift === 2, 'chronal shift 2 at Chronurgy 3');
  assert(sub.subclassPoolMaxima(at('wizard', 'Chronurgy Magic', 6), ab({ int: 16 }))?.momentaryStasis === 3, 'momentary stasis 3 at Chronurgy 6, Int +3');
  assert(sub.subclassPoolMaxima(at('wizard', 'Graviturgy Magic', 10), ab({ int: 16 }))?.violentAttraction === 3, 'violent attraction 3 at Graviturgy 10, Int +3');
  assert(sub.subclassPoolMaxima(at('ranger', 'Winter Walker', 11), ab({ wis: 16 }))?.chillingRetribution === 3, 'chilling retribution 3 at Winter Walker 11, Wis +3');
  assert(sub.subclassPoolMaxima(at('rogue', 'Scion of the Three', 3), ab({ int: 16 }))?.bloodthirst === 3, 'bloodthirst 3 at Scion 3, Int +3');
  assert(sub.subclassPoolMaxima(at('paladin', 'Oath of the Noble Genies', 15), ab({ cha: 16 }))?.elementalRebuke === 3, 'elemental rebuke 3 at Noble Genies 15, Cha +3');
  assert(sub.subclassPoolMaxima(at('fighter', 'Echo Knight', 3), ab({ con: 16 }))?.unleashIncarnation === 3, 'unleash incarnation 3 at Echo Knight 3, Con +3');
  assert(sub.subclassPoolMaxima(at('fighter', 'Echo Knight', 15), ab({ con: 16 }))?.reclaimPotential === 3, 'reclaim potential 3 at Echo Knight 15, Con +3 (same formula as Unleash)');
  assert(sub.subclassPoolMaxima(at('cleric', 'Revelry Domain', 3), ab({ wis: 16 }))?.moreTheMerrier === 3, 'more the merrier 3 at Revelry 3, Wis +3');

  // Multiclass: both classes' pools, each at its own class level.
  const multi = sub.subclassPoolMaxima({
    className: 'fighter', subclassName: 'Battle Master', level: 3,
    classLevels: [{ class: 'fighter', level: 3, subclass: 'Battle Master' }, { class: 'wizard', level: 3, subclass: 'Abjurer' }],
  }, ab({ int: 16 }));
  assert(multi.superiority === 4 && multi.ward === 9, 'Fighter 3 / Wizard 3 reads superiority 4 + ward 9');
  // The task brief's literal Fighter 3 / Wizard 2 example: a 2nd-level
  // Abjurer has no 3rd-level feature yet, so only superiority reads.
  const w2 = sub.subclassPoolMaxima({
    className: 'fighter', subclassName: 'Battle Master', level: 3,
    classLevels: [{ class: 'fighter', level: 3, subclass: 'Battle Master' }, { class: 'wizard', level: 2, subclass: 'Abjurer' }],
  }, ab({ int: 16 }));
  assert(w2.superiority === 4 && w2.ward === undefined, 'Fighter 3 / Wizard 2 reads superiority only (Arcane Ward is 3rd level)');

  // No subclass, no pools. Warlord Leadership Dice is NOT wired in
  // this slice (rest rule unverified from the registry on hand) — a
  // future slice that wires it must update this assert.
  assert(Object.keys(sub.subclassPoolMaxima(at('fighter', null, 7), ab({}))).length === 0, 'no subclass, no pools');
  assert(Object.keys(sub.subclassPoolMaxima(at('warlord', "Commander's Presence", 5), ab({ cha: 16 }))).length === 0, 'warlord leadership dice deferred (no verified rest rule)');
}

// ---------------------------------------------------------------------------
group('5. resourceMaxima — base + subclass merge, Heroic Inspiration');
{
  const bm = cf.resourceMaxima({ className: 'fighter', level: 7, abilityScores: scores({}), subclassName: 'Battle Master' });
  assert(bm.superiority === 5 && bm.secondWind === 3 && bm.actionSurge === 1, 'BM 7: subclass + base maxima merge');
  const wiz = cf.resourceMaxima({ className: 'wizard', level: 5, abilityScores: scores({ int: 16 }), subclassName: 'Abjurer' });
  assert(wiz.ward === 13, 'Abjurer ward in maxima');
  const human = cf.resourceMaxima({ className: 'fighter', level: 1, abilityScores: scores({}), species: 'Human' });
  assert(human.heroicInspiration === 1, 'human gains Heroic Inspiration (max 1)');
  const variant = cf.resourceMaxima({ className: 'fighter', level: 1, abilityScores: scores({}), species: 'Variant Human' });
  assert(variant.heroicInspiration === 1, 'Variant Human gains Heroic Inspiration');
  const elf = cf.resourceMaxima({ className: 'fighter', level: 1, abilityScores: scores({}), species: 'Elf' });
  assert(elf.heroicInspiration === undefined, 'elf gains no Heroic Inspiration');
  const noSpecies = cf.resourceMaxima({ className: 'fighter', level: 1, abilityScores: scores({}) });
  assert(noSpecies.heroicInspiration === undefined, 'unknown species gains no Heroic Inspiration (fail-closed)');
  // Maxima stay computed, never stored: the same actor at a higher
  // level computes a higher maximum.
  const bm15 = cf.resourceMaxima({ className: 'fighter', level: 15, abilityScores: scores({}), subclassName: 'Battle Master' });
  assert(bm15.superiority === 6, 'level-up moves the maximum (5 → 6)');
}

// ---------------------------------------------------------------------------
group('6. resetResourcesForRest — per-pool rest rules (pure)');
{
  const bm = { className: 'fighter', subclassName: 'Battle Master', level: 7 };
  const longBm = cf.resetResourcesForRest({ used: { superiority: 5, secondWind: 3 } }, { ...bm, type: 'long' });
  assert(longBm.used.superiority === 0 && longBm.used.secondWind === 0, 'long rest restores superiority');
  const shortBm = cf.resetResourcesForRest({ used: { superiority: 4 } }, { ...bm, type: 'short' });
  assert(shortBm.used.superiority === 0, 'short rest restores superiority (short or long)');

  const psi = { className: 'fighter', subclassName: 'Psi Warrior', level: 5 };
  const psiEmpty = cf.resetResourcesForRest({ used: { psionic: 6 } }, { ...psi, type: 'short', abilityScores: scores({}) });
  assert(psiEmpty.used.psionic === 5, 'psi warrior short rest regains 1 when none remain');
  const psiSome = cf.resetResourcesForRest({ used: { psionic: 3 } }, { ...psi, type: 'short', abilityScores: scores({}) });
  assert(psiSome.used.psionic === 3, 'psi warrior short rest regains nothing while dice remain');
  const psiLong = cf.resetResourcesForRest({ used: { psionic: 6 } }, { ...psi, type: 'long', abilityScores: scores({}) });
  assert(psiLong.used.psionic === 0, 'psi warrior long rest restores all');

  const soul = { className: 'rogue', subclassName: 'Soulknife', level: 5 };
  const soulShort = cf.resetResourcesForRest({ used: { soulknife: 5 } }, { ...soul, type: 'short', abilityScores: scores({}) });
  assert(soulShort.used.soulknife === 4, 'soulknife short rest restores 1');
  const soulLong = cf.resetResourcesForRest({ used: { soulknife: 6 } }, { ...soul, type: 'long', abilityScores: scores({}) });
  assert(soulLong.used.soulknife === 0, 'soulknife long rest restores all');

  const cel = { className: 'warlock', subclassName: 'Celestial Patron', level: 5 };
  const celShort = cf.resetResourcesForRest({ used: { healingLight: 6 } }, { ...cel, type: 'short', abilityScores: scores({}) });
  assert(celShort.used.healingLight === 6, 'healing light untouched by a short rest (long only)');
  const div = { className: 'wizard', subclassName: 'Diviner', level: 5 };
  const divShort = cf.resetResourcesForRest({ used: { portent: 2 } }, { ...div, type: 'short', abilityScores: scores({}) });
  assert(divShort.used.portent === 2, 'portent untouched by a short rest (long only)');

  // Arcane Ward: current-HP value, sibling key wardHp.
  const abj = { className: 'wizard', subclassName: 'Abjurer', level: 5, abilityScores: scores({ int: 16 }) };
  const wardLong = cf.resetResourcesForRest({ used: { portent: 0 }, wardHp: 2 }, { ...abj, type: 'long' });
  assert(wardLong.wardHp === 13, 'long rest restores the ward to full (13)');
  const wardShort = cf.resetResourcesForRest({ used: {}, wardHp: 2 }, { ...abj, type: 'short' });
  assert(wardShort.wardHp === 2, 'short rest leaves the ward value alone');
  const wardStale = cf.resetResourcesForRest({ used: {}, wardHp: 9 }, { className: 'wizard', subclassName: 'Diviner', level: 5, type: 'long', abilityScores: scores({ int: 16 }) });
  assert(wardStale.wardHp === 9, 'a non-Abjurer keeps a stale wardHp untouched');

  // Heroic Inspiration: granted on a long rest, untouched on short.
  const hum = { className: 'fighter', subclassName: null, level: 1, species: 'Human' };
  const hiLong = cf.resetResourcesForRest({ used: { heroicInspiration: 1 } }, { ...hum, type: 'long' });
  assert(hiLong.used.heroicInspiration === 0, 'long rest grants Heroic Inspiration');
  const hiShort = cf.resetResourcesForRest({ used: { heroicInspiration: 1 } }, { ...hum, type: 'short' });
  assert(hiShort.used.heroicInspiration === 1, 'short rest does not grant Heroic Inspiration');

  // Unknown keys pass through untouched on a short rest.
  const unk = cf.resetResourcesForRest({ used: { mystery: 7, superiority: 2 } }, { ...bm, type: 'short' });
  assert(unk.used.mystery === 7 && unk.used.superiority === 0, 'unknown key untouched; known pool still resets');
  // A stale pool key (actor no longer has the subclass) is untouched.
  const stale = cf.resetResourcesForRest({ used: { superiority: 3 } }, { className: 'fighter', subclassName: null, level: 7, type: 'short' });
  assert(stale.used.superiority === 3, 'stale pool key untouched on a short rest');
}

// ---------------------------------------------------------------------------
group('7. spendResource (DB) — spend to the cap, refuse past it');
{
  const bmId = await insertRow('characters', {
    name: 'SpendBM', class: 'fighter', level: 7, subclass: 'Battle Master',
    race: 'Human', ability_scores: scores({}), current_hp: 40, max_hp: 40,
    class_resources_json: JSON.stringify({ used: { superiority: 4 } }),
  });
  const s1 = await cf.spendResource('player', bmId, 'superiority');
  assert(s1.success === true && s1.used === 5 && s1.max === 5, 'spend 5th superiority die');
  const s2 = await cf.spendResource('player', bmId, 'superiority');
  assert(s2.success === false && /no superiority uses left \(5\/5\)/.test(s2.reason || ''), '6th superiority die refused at the cap');
  const s3 = await cf.spendResource('player', bmId, 'nope');
  assert(s3.success === false && /not modeled/.test(s3.reason || ''), 'unknown key still refuses');
  const after = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [bmId]);
  assert(JSON.parse(after.class_resources_json).used.superiority === 5, 'spent count persisted');

  // Arcane Ward is a value, not a count — spend refuses.
  const abjId = await insertRow('characters', {
    name: 'SpendAbj', class: 'wizard', level: 5, subclass: 'Abjurer',
    race: 'Elf', ability_scores: scores({ int: 16 }), current_hp: 30, max_hp: 30,
    class_resources_json: JSON.stringify({ used: {}, wardHp: 13 }),
  });
  const w1 = await cf.spendResource('player', abjId, 'ward');
  assert(w1.success === false && /hit-point value/.test(w1.reason || ''), 'ward spend refused (value pool)');
  const abjAfter = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [abjId]);
  assert(JSON.parse(abjAfter.class_resources_json).wardHp === 13, 'refused ward spend leaves wardHp intact');

  // Heroic Inspiration: spend once, refuse twice.
  const humId = await insertRow('characters', {
    name: 'SpendHum', class: 'fighter', level: 1, subclass: null,
    race: 'Human', ability_scores: scores({}), current_hp: 12, max_hp: 12,
    class_resources_json: JSON.stringify({ used: { heroicInspiration: 0 } }),
  });
  const h1 = await cf.spendResource('player', humId, 'heroicInspiration');
  assert(h1.success === true && h1.used === 1 && h1.max === 1, 'spend Heroic Inspiration');
  const h2 = await cf.spendResource('player', humId, 'heroicInspiration');
  assert(h2.success === false, 'second Heroic Inspiration spend refused (max 1)');
  const elfId = await insertRow('characters', {
    name: 'SpendElf', class: 'fighter', level: 1, subclass: null,
    race: 'Elf', ability_scores: scores({}), current_hp: 12, max_hp: 12,
    class_resources_json: JSON.stringify({ used: {} }),
  });
  const e1 = await cf.spendResource('player', elfId, 'heroicInspiration');
  assert(e1.success === false && /not modeled/.test(e1.reason || ''), 'elf cannot spend Heroic Inspiration (not granted)');
}

// ---------------------------------------------------------------------------
group('8. applyRest (DB) — DM rest restores subclass pools');
{
  // Long rest: superiority restored + Heroic Inspiration granted.
  const pcId = await insertRow('characters', {
    name: 'RestBM', class: 'fighter', level: 7, subclass: 'Battle Master',
    race: 'Human', ability_scores: scores({}), current_hp: 20, max_hp: 40,
    hit_dice: JSON.stringify({ d10: 7 }), hit_dice_used: JSON.stringify({}),
    spell_slots_used: JSON.stringify({}),
    class_resources_json: JSON.stringify({ used: { superiority: 5, heroicInspiration: 1 } }),
  });
  const longR = await rt.applyRest({ sessionId: null, characterId: pcId, type: 'long' });
  assert(longR.success === true, 'long rest succeeds');
  const longRow = JSON.parse((await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [pcId])).class_resources_json);
  assert(longRow.used.superiority === 0 && longRow.used.heroicInspiration === 0, 'long rest restores superiority + grants Heroic Inspiration');

  // Short rest: superiority restored (short or long), healing light not.
  const celId = await insertRow('characters', {
    name: 'RestCel', class: 'warlock', level: 5, subclass: 'Celestial Patron',
    race: 'Elf', ability_scores: scores({}), current_hp: 30, max_hp: 30,
    hit_dice: JSON.stringify({ d8: 5 }), hit_dice_used: JSON.stringify({}),
    spell_slots_used: JSON.stringify({}),
    class_resources_json: JSON.stringify({ used: { healingLight: 6 } }),
  });
  const shortCel = await rt.applyRest({ sessionId: null, characterId: celId, type: 'short' });
  assert(shortCel.success === true, 'short rest succeeds');
  const celRow = JSON.parse((await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [celId])).class_resources_json);
  assert(celRow.used.healingLight === 6, 'short rest leaves healing light spent (long only)');

  // Arcane Ward value restored to full on a long rest via the DM rest.
  const abjId = await insertRow('characters', {
    name: 'RestAbj', class: 'wizard', level: 5, subclass: 'Abjurer',
    race: 'Elf', ability_scores: scores({ int: 16 }), current_hp: 30, max_hp: 30,
    hit_dice: JSON.stringify({ d6: 5 }), hit_dice_used: JSON.stringify({}),
    spell_slots_used: JSON.stringify({}),
    class_resources_json: JSON.stringify({ used: {}, wardHp: 2 }),
  });
  await rt.applyRest({ sessionId: null, characterId: abjId, type: 'long' });
  const abjRow = JSON.parse((await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [abjId])).class_resources_json);
  assert(abjRow.wardHp === 13, 'long rest restores wardHp to full (13)');

  // Multiclass companion: Fighter 3 Battle Master / Wizard 3 Abjurer.
  const pc2Id = await insertRow('characters', {
    name: 'RestPC2', class: 'fighter', level: 5, subclass: null,
    race: 'Elf', ability_scores: scores({}), current_hp: 40, max_hp: 40,
    hit_dice: JSON.stringify({ d10: 5 }), hit_dice_used: JSON.stringify({}),
    spell_slots_used: JSON.stringify({}),
    class_resources_json: JSON.stringify({ used: {} }),
  });
  // MERGE FIX (2026-11-09): companions.npc_id is NOT NULL + FK to
  // npcs(id) — the staged insert omitted it, so the helper filled 1
  // and the FK failed (no npcs row 1 exists). The established pattern
  // (markers/entities/rest-time tests) creates the npc row first.
  const compNpcId = await insertRow('npcs', { name: 'RestCompanion' });
  const compId = await insertRow('companions', {
    recruited_by_character_id: pc2Id, npc_id: compNpcId, status: 'active',
    companion_class: 'fighter', companion_level: 6, companion_subclass: 'Battle Master',
    companion_class_levels: JSON.stringify([
      { class: 'fighter', level: 3, subclass: 'Battle Master' },
      { class: 'wizard', level: 3, subclass: 'Abjurer' },
    ]),
    companion_ability_scores: scores({ int: 16 }),
    companion_current_hp: 30, companion_max_hp: 30,
    companion_hit_dice: JSON.stringify({ d10: 5 }), companion_hit_dice_used: JSON.stringify({}),
    companion_spell_slots_used: JSON.stringify({}),
    class_resources_json: JSON.stringify({ used: { superiority: 4 }, wardHp: 1 }),
  });
  // (The npc row above backs this companion; rest the party and
  // assert the companion row.)
  await rt.applyRest({ sessionId: null, characterId: pc2Id, type: 'long' });
  const compRow = JSON.parse((await dbGet('SELECT class_resources_json FROM companions WHERE id = ?', [compId])).class_resources_json);
  assert(compRow.used.superiority === 0 && compRow.wardHp === 9, 'multiclass companion long rest restores superiority + ward (9)');
}

// ---------------------------------------------------------------------------
group('9. isHumanSpecies — D4 gate');
{
  assert(cf.isHumanSpecies('Human', null) === true, 'Human');
  assert(cf.isHumanSpecies('Variant Human', null) === true, 'Variant Human as race');
  assert(cf.isHumanSpecies('Human', 'Variant Human') === true, 'Variant Human as subrace');
  assert(cf.isHumanSpecies('Elf', null) === false, 'Elf is not human');
  assert(cf.isHumanSpecies(null, null) === false, 'null species is not human');
  assert(cf.isHumanSpecies('Half-Elf', null) === false, 'Half-Elf is not human');
}

// ---------------------------------------------------------------------------
console.log(`\n mechanics-hooks-pools: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
