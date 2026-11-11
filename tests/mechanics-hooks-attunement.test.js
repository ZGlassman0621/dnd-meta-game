/**
 * tests/mechanics-hooks-attunement.test.js — D10 attunement (F10) + kind-F
 * reclassifications (Amendment 2 audit table, F10 subset).
 *
 * Pure service math + DB round-trip groups, following the
 * artificer-class.test.js pattern (temp dir, initDatabase, PRAGMA-driven
 * insertRow that lists every NOT NULL column with no default). No
 * system-rolled outcomes are asserted, so no branch modeling beyond
 * the service's own branches is needed. Run:
 *   node tests/mechanics-hooks-attunement.test.js
 *
 * NOTE (staging, F10): this file was written against the cached mirror
 * (see NOTES.md) — the DB groups run only where server/database.js
 * exists (the Mac repo). Group 7 (marker dispatch) SKIPS cleanly until
 * the markers family lands the ATTUNE/UNATTUNE schemas in
 * markerSchemas.js: validateDmMarkers only iterates known schemas, so
 * an unlanded schema means the marker is silently ignored and the
 * group reports skipped, not failed.
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-attune-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDatabase, dbGet, dbRun, dbAll } = await import(
  pathToFileURL(path.join(REPO, 'server', 'database.js')).href
);
await initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const att = await import(svc('server/services/attunementService.js'));
const mp = await import(svc('server/services/markerPipeline.js'));
const fighter = await import(svc('server/data/subclasses/fighter.js'));
const bard = await import(svc('server/data/subclasses/bard.js'));
const rogue = await import(svc('server/data/subclasses/rogue.js'));
const sorcerer = await import(svc('server/data/subclasses/sorcerer.js'));
const warlock = await import(svc('server/data/subclasses/warlock.js'));
const ranger = await import(svc('server/data/subclasses/ranger.js'));
const barbarian = await import(svc('server/data/subclasses/barbarian.js'));

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];
function assert(cond, msg) {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.log(`  ✗ ${msg}`); }
}
function skip(msg) { skipped++; console.log(`  ○ SKIP: ${msg}`); }
function group(name) { console.log(`\n${name}`); }

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

function featureOf(mod, subclassKey, featureKey) {
  const data = mod.default ?? mod[Object.keys(mod)[0]];
  const list = Array.isArray(data) ? data : (data.subclasses || Object.values(data));
  for (const sub of list) {
    if (sub.key !== subclassKey) continue;
    return (sub.features || []).find((f) => f.key === featureKey) || null;
  }
  return null;
}

// Group 1 — Cap: base 3, Thief 4 at Rogue 13+, Artificer ladder, max-not-sum.
group('1. Attunement cap (computed, never stored)');
{
  assert(att.attunementCapFor({ className: 'fighter', level: 10 }) === 3, 'base cap 3 (no grant)');
  assert(att.attunementCapFor({ className: 'rogue', subclassName: 'Thief', level: 12 }) === 3, 'Thief below 13 is still 3');
  assert(att.attunementCapFor({ className: 'rogue', subclassName: 'Thief', level: 13 }) === 4, 'Thief 4 at Rogue 13');
  assert(att.attunementCapFor({ className: 'rogue', subclassName: 'Thief', level: 20 }) === 4, 'Thief stays 4 at 20');
  assert(att.attunementCapFor({ className: 'rogue', subclassName: 'Assassin', level: 13 }) === 3, 'non-Thief rogue 13 is still 3');
  assert(att.attunementCapFor({ className: 'artificer', level: 9 }) === 3, 'Artificer ladder: 3 below 10');
  assert(att.attunementCapFor({ className: 'artificer', level: 10 }) === 4, 'Artificer ladder: 4 at 10');
  assert(att.attunementCapFor({ className: 'artificer', level: 14 }) === 5, 'Artificer ladder: 5 at 14');
  assert(att.attunementCapFor({ className: 'artificer', level: 18 }) === 6, 'Artificer ladder: 6 at 18');
  // Multiclass (class_levels entries): MAX of grants, never the sum.
  const mc = (art, rog, sub) => ({
    className: 'artificer', subclassName: null, level: art + rog,
    classLevels: [
      { class: 'artificer', level: art, subclass: null },
      { class: 'rogue', level: rog, subclass: sub },
    ],
  });
  assert(att.attunementCapFor(mc(10, 13, 'Thief')) === 4, 'Art 10 + Thief 13 caps at 4 (max, not 8)');
  assert(att.attunementCapFor(mc(14, 13, 'Thief')) === 5, 'Art 14 + Thief 13 caps at 5 (ladder passes Thief)');
  assert(att.attunementCapFor(mc(18, 13, 'Thief')) === 6, 'Art 18 + Thief 13 caps at 6');
  assert(att.attunementCapFor(mc(3, 13, 'Thief')) === 4, 'Art 3 + Thief 13 caps at 4 (Thief passes ladder)');
  assert(att.attunementCapFor(mc(10, 13, 'Assassin')) === 4, 'Art 10 + Assassin 13 caps at 4 (ladder only)');
  assert(att.levelFromClassLevels([{ class: 'rogue', level: 13 }], 'rogue', 'fighter', 20) === 13, 'per-class level read from class_levels');
  assert(att.levelFromClassLevels(null, 'rogue', 'rogue', 7) === 7, 'no class_levels falls back to primary total');
  assert(att.levelFromClassLevels(null, 'rogue', 'fighter', 7) === null, 'no entry and not primary is null');
}

// Group 2 — Attune / unattune + over-cap refusal (same shape as Artificer).
group('2. Attune / unattune + over-cap refusal');
{
  let s = att.defaultAttunementState();
  assert(att.attunedCount(s) === 0, 'fresh state counts 0');
  let r = att.attuneItem(s, 3, 'Ring of Protection'); s = r.state;
  assert(r.success && att.attunedCount(s) === 1, 'first attune succeeds');
  r = att.attuneItem(s, 3, 'ring of protection'); s = r.state;
  assert(r.success && r.already === true && att.attunedCount(s) === 1, 'same item, different case, is already attuned (no double count)');
  r = att.attuneItem(s, 3, 'Cloak of Elvenkind'); s = r.state;
  r = att.attuneItem(s, 3, 'Boots of Speed'); s = r.state;
  assert(att.attunedCount(s) === 3, 'three items attuned at cap 3');
  const over = att.attuneItem(s, 3, 'Amulet of Health');
  assert(!over.success && over.reason === 'attunement_cap' && over.cap === 3, 'fourth attune refused with attunement_cap + cap');
  assert(att.attunedCount(over.state) === 3, 'refused attune stores nothing');
  const free = att.unattuneItem(s, 'Cloak of Elvenkind'); s = free.state;
  assert(free.success && free.removed === 'Cloak of Elvenkind' && att.attunedCount(s) === 2, 'unattune removes by name');
  const again = att.attuneItem(s, 3, 'Amulet of Health'); s = again.state;
  assert(again.success && att.attunedCount(s) === 3, 'freed slot takes a new item');
  const missing = att.unattuneItem(s, 'No Such Item');
  assert(!missing.success && missing.reason === 'not_attuned', 'unattuning a non-attuned item refuses');
  const noName = att.attuneItem(s, 3, '   ');
  assert(!noName.success && noName.reason === 'item_name_required', 'blank item name refused');
  assert(att.isAttuned(s, 'AMULET OF HEALTH'), 'isAttuned is case-insensitive');
  assert(!att.isAttuned(s, 'Cloak of Elvenkind'), 'unattuned item is not attuned');
  assert(att.attunedCountFor({ attunement: s }) === 3, 'attunedCountFor counts the general record');
  assert(att.attunedCountFor({ attunement: s, artificer: { attunedExternal: ['A', 'B'] } }) === 3, 'attunedCountFor does NOT count the Artificer record (unification seam, not subsumed)');
  assert(att.attunedCountFor(null) === 0, 'attunedCountFor(null) is 0');
}

// Group 3 — Record survives load/save (pure parse helpers; DB group is 5).
group('3. Record survives load/save (pure parse)');
{
  const state = { items: ['Ring of Protection', 'Cloak of Elvenkind'] };
  const raw = JSON.stringify({ used: { rage: 1 }, artificer: { attunedExternal: ['Wand of Secrets'] } });
  const into = att.attunementStateIntoResources(raw, state);
  assert(into.artificer && into.artificer.attunedExternal[0] === 'Wand of Secrets', 'saving attunement preserves the Artificer record');
  assert(into.used && into.used.rage === 1, 'saving attunement preserves used pools');
  assert(into.attunement && into.attunement.items.length === 2, 'attunement nests under class_resources_json');
  const back = att.attunementStateFromResources(JSON.stringify(into));
  assert(back.items.length === 2 && back.items[0] === 'Ring of Protection', 'parse round-trip restores the names');
  const fresh = att.attunementStateFromResources(JSON.stringify({ used: {} }));
  assert(Array.isArray(fresh.items) && fresh.items.length === 0, 'no attunement key loads as the empty default');
  const junk = att.attunementStateFromResources('not json{{{');
  assert(Array.isArray(junk.items) && junk.items.length === 0, 'unparsable resources load as the empty default');
  const section = att.attunementPromptSection(state, { name: 'Toma', cap: 4 });
  assert(section.includes('Attuned 2/4') && section.includes('Ring of Protection'), 'prompt section names count, cap, and items');
}

// Group 4 — Registry reclassifications (kind + mechanics updated, old kind gone).
group('4. Kind-F reclassifications (Amendment 2, F10 subset)');
{
  const hw = featureOf(fighter, 'champion', 'heroic_warrior');
  assert(hw && hw.kind === 'B', 'Heroic Warrior reclassified B');
  assert(hw && hw.engine.includes('heroicInspiration'), 'Heroic Warrior engine names the heroicInspiration pool');
  const sw = featureOf(fighter, 'battle_master', 'student_of_war');
  assert(sw && sw.kind === 'A', 'Student of War reclassified A');
  const mt = featureOf(bard, 'college_of_valor', 'martial_training');
  assert(mt && mt.kind === 'A', 'Martial Training reclassified A');
  assert(mt && mt.mechanics.effect.includes('medium armor'), 'Martial Training mechanics unchanged (evidence quoted)');
  const at = featureOf(rogue, 'assassin', 'assassins_tools');
  assert(at && at.kind === 'A', "Assassin's Tools reclassified A");
  assert(at && JSON.stringify(at.mechanics.tools).includes('Disguise Kit'), "Assassin's Tools mechanics unchanged (evidence quoted)");
  const ts = featureOf(sorcerer, 'aberrant_sorcery', 'telepathic_speech');
  assert(ts && ts.kind === 'C', 'Telepathic Speech reclassified C');
  assert(ts && ts.engine.includes('TELEPATHIC_SPEECH'), 'Telepathic Speech engine names the marker');
  const am = featureOf(warlock, 'great_old_one_patron', 'awakened_mind');
  assert(am && am.kind === 'C', 'Awakened Mind reclassified C');
  assert(am && am.engine.includes('AWAKENED_MIND'), 'Awakened Mind engine names the marker');
  const hl = featureOf(ranger, 'hunter', 'hunters_lore');
  assert(hl && hl.kind === 'F', "Hunter's Lore stays F — no kind fits a computed-knowledge surfacing (taxonomy gap)");
  assert(hl && hl.engine.includes('TAXONOMY GAP'), "Hunter's Lore engine records the Family-3 surfacing + taxonomy gap");
  const wg = featureOf(barbarian, 'path_of_the_zealot', 'warrior_of_the_gods');
  assert(wg && wg.kind === 'F', 'Warrior of the Gods stays F — no kind fits a cost waiver (E-adjacent)');
  assert(wg && wg.engine.includes('resurrectionComponentWaived'), 'Warrior of the Gods engine names the waiver flag');
  assert(wg && wg.mechanics.resurrectionCostsGp && wg.mechanics.resurrectionCostsGp.revivify === 300, 'Warrior of the Gods carries PHB gp costs as gateCheck data');
  const umd = featureOf(rogue, 'thief', 'use_magic_device');
  assert(umd && umd.kind === 'F', 'Use Magic Device stays F until a limb is wired (Amendment 1 §3.3.6)');
  assert(umd && umd.engine.includes('attunementService.js'), 'Use Magic Device engine records the wired attunement limb');
  assert(umd && umd.engine.includes('roll 1d6; on a 6, no charge spent'), 'Use Magic Device engine records the charge limb as a pending instruction');
  const ie = featureOf(rogue, 'assassin', 'infiltration_expertise');
  assert(ie && ie.kind === 'F', 'Infiltration Expertise stays F (Roving Aim blocked, Mimicry ribbon)');
  assert(ie && ie.engine.includes('BLOCKED WITH REASON'), 'Infiltration Expertise engine records the Steady Aim blocker');
  const stays = [
    [barbarian, 'path_of_the_wild_heart', 'animal_speaker'],
    [barbarian, 'path_of_the_wild_heart', 'nature_speaker'],
    [fighter, 'battle_master', 'know_your_enemy'],
    [fighter, 'monster_hunter', 'perceive_peril'],
    [rogue, 'mastermind', 'insightful_manipulator'],
    [rogue, 'mastermind', 'soul_of_deceit'],
  ];
  for (const [mod, sub, key] of stays) {
    const f = featureOf(mod, sub, key);
    assert(f && f.kind === 'F', `${key} stays kind F (ribbon)`);
  }
}

// Group 5 — DB round-trip through class_resources_json.attunement.
group('5. DB state round-trip (characters + companions)');
{
  const charId = await insertRow('characters', {
    name: 'TEST_Thief', level: 13, current_hp: 20, max_hp: 20,
    class: 'rogue', subclass: 'Thief',
    class_resources_json: JSON.stringify({ used: {} }),
  });
  let st = await att.loadAttunementState('player', charId);
  assert(Array.isArray(st.items) && st.items.length === 0, 'fresh PC load gives default state');
  st = att.attuneItem(st, 4, 'Ring of Protection').state;
  st = att.attuneItem(st, 4, 'Cloak of Elvenkind').state;
  await att.saveAttunementState('player', charId, st);
  const reloaded = await att.loadAttunementState('player', charId);
  assert(reloaded.items.length === 2 && reloaded.items.includes('Ring of Protection'), 'saved items survive reload (PC)');
  const rawRow = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [charId]);
  const parsed = JSON.parse(rawRow.class_resources_json);
  assert(parsed.attunement && parsed.used, 'attunement nests under class_resources_json without disturbing used');

  // Saving attunement over an existing Artificer record leaves it intact.
  const artId = await insertRow('characters', {
    name: 'TEST_Artificer', level: 10, current_hp: 30, max_hp: 30,
    class: 'artificer', subclass: null,
    class_resources_json: JSON.stringify({ used: {}, artificer: { attunedExternal: ['Wand of Secrets'] } }),
  });
  await att.saveAttunementState('player', artId, { items: ['Ring of Protection'] });
  const artRow = await dbGet('SELECT class_resources_json FROM characters WHERE id = ?', [artId]);
  const artParsed = JSON.parse(artRow.class_resources_json);
  assert(artParsed.artificer && artParsed.artificer.attunedExternal[0] === 'Wand of Secrets', 'Artificer record untouched by an attunement save');
  assert(artParsed.attunement && artParsed.attunement.items[0] === 'Ring of Protection', 'attunement saved alongside the Artificer record');

  // MERGE FIX (2026-11-09): companions.npc_id is NOT NULL + FK to
  // npcs(id) and recruited_by_character_id is NOT NULL + FK to
  // characters(id) — the staged insert set neither, so the helper
  // filled 1s and the FK failed. Same pattern as the pools fix.
  const compNpcId = await insertRow('npcs', { name: 'TEST_CompThief' });
  const compId = await insertRow('companions', {
    name: 'TEST_CompThief', npc_id: compNpcId, recruited_by_character_id: artId, companion_class: 'rogue', companion_subclass: 'Thief',
    companion_level: 13, companion_current_hp: 15, companion_max_hp: 15,
    class_resources_json: JSON.stringify({ used: {} }),
  });
  let cst = await att.loadAttunementState('companion', compId);
  cst = att.attuneItem(cst, 4, 'Boots of Speed').state;
  await att.saveAttunementState('companion', compId, cst);
  const creloaded = await att.loadAttunementState('companion', compId);
  assert(creloaded.items.length === 1 && creloaded.items[0] === 'Boots of Speed', 'saved items survive reload (companion)');
}

// Group 6 — Handler registration (schemas land with the markers family).
group('6. Marker handler registration');
{
  assert(mp._hasHandler('ATTUNE'), 'ATTUNE handler registered at import');
  assert(mp._hasHandler('UNATTUNE'), 'UNATTUNE handler registered at import');
}

// Group 7 — Marker dispatch end-to-end (skips until schemas land).
group('7. Marker dispatch (ATTUNE / UNATTUNE via the pipeline)');
{
  const charId = await insertRow('characters', {
    name: 'TEST_DispatchThief', level: 13, current_hp: 20, max_hp: 20,
    class: 'rogue', subclass: 'Thief',
    class_resources_json: JSON.stringify({ used: {} }),
  });
  const ctx = { characterId: charId };
  const run = await mp.processResponseMarkers('[ATTUNE: Item="Ring of Protection"]', ctx);
  const hit = (run.handlerResults || []).find((h) => h.schemaKey === 'ATTUNE');
  if (!hit) {
    skip('ATTUNE schema not yet in markerSchemas.js (markers family) — dispatch untestable until it lands; pure + DB groups above cover the logic');
  } else {
    assert(hit.ok && hit.result && hit.result.success, 'ATTUNE marker attunes via the pipeline');
    let st = await att.loadAttunementState('player', charId);
    assert(st.items.includes('Ring of Protection'), 'ATTUNE marker persisted the item');
    const run2 = await mp.processResponseMarkers(
      '[ATTUNE: Item="Cloak of Elvenkind"] [ATTUNE: Item="Boots of Speed"] [ATTUNE: Item="Amulet of Health"] [ATTUNE: Item="Bag of Holding"]',
      ctx
    );
    const hits2 = (run2.handlerResults || []).filter((h) => h.schemaKey === 'ATTUNE');
    assert(hits2.length === 4, 'four ATTUNE markers dispatched');
    assert(hits2[3].result && hits2[3].result.success === false && hits2[3].result.reason === 'attunement_cap', 'fifth item over the Thief cap of 4 is refused with attunement_cap');
    st = await att.loadAttunementState('player', charId);
    assert(st.items.length === 4 && !st.items.includes('Bag of Holding'), 'over-cap item was not recorded');
    const run3 = await mp.processResponseMarkers('[UNATTUNE: Item="Cloak of Elvenkind"]', ctx);
    const hit3 = (run3.handlerResults || []).find((h) => h.schemaKey === 'UNATTUNE');
    assert(hit3 && hit3.ok && hit3.result && hit3.result.success, 'UNATTUNE marker removes via the pipeline');
    st = await att.loadAttunementState('player', charId);
    assert(st.items.length === 3 && !st.items.includes('Cloak of Elvenkind'), 'UNATTUNE persisted the removal');
    const run4 = await mp.processResponseMarkers('[UNATTUNE: Item="No Such Item"]', ctx);
    const hit4 = (run4.handlerResults || []).find((h) => h.schemaKey === 'UNATTUNE');
    assert(hit4 && hit4.result && hit4.result.success === false && hit4.result.reason === 'not_attuned', 'unattuning a non-attuned item refuses with not_attuned');
  }
}

console.log(`\nmechanics-hooks-attunement: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) { console.log('failures:', failures); process.exit(1); }
