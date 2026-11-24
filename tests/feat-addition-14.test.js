// tests/feat-addition-14.test.js — the fourteen added feats
// (docs/pm/feat-addition-14/BRIEF.md). Real services, real DB, the real
// character router for level-up and the real turn route for initiative.
// Every player die is a reported number; NPC dice are forced through the
// DM-settable modifier where an outcome is asserted, so no assertion
// rests on a random roll. Test characters are invented (Wren Ashdown,
// Pell Marrow, Juno Vale and friends).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-feat14-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const reg = await import(svc('server/data/featRegistry.js'));
const fm = await import(svc('server/services/featMechanicsService.js'));
const rr = await import(svc('server/services/rollRequestService.js'));
const cl = await import(svc('server/services/combatLoopService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const tl = await import(svc('server/services/turnLedgerService.js'));
const wid = await import(svc('server/services/worldIdService.js'));
const mv = await import(svc('server/services/movementService.js'));
const pas = await import(svc('server/services/partyAttackService.js'));
const spells = await import(svc('server/services/spellCastService.js'));
const resist = await import(svc('server/services/resistanceService.js'));
const rest = await import(svc('server/services/restTimeService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
const { MARKER_SCHEMAS } = await import(svc('server/services/markerSchemas.js'));
await import(svc('server/services/combatMarkerService.js'));
const { validateCreatorNextStage3 } = await import(svc('server/routes/character.js'));
const { getXPToNextLevel } = await import(svc('server/config/levelProgression.js'));
const clientFeats = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/feats.json'), 'utf8'));
const clientMixed = await import(svc('client/src/components/creator-next/mixedAncestry.js'));
const pick = await import(svc('client/src/components/featPickHelpers.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; console.log('  ✓ ' + msg); }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
const J = JSON.stringify;

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = []; const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) { cols.push(c.name); vals.push(overrides[c.name]); continue; }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals);
  return Number(r.lastInsertRowid);
}
const feat = (key, extra = {}) => ({ key, name: reg.getFeatEffect(key).name, acquiredAtLevel: 4, ...extra });
async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Wren Ashdown', class: 'Fighter', level: 5, current_hp: 40, max_hp: 40, armor_class: 15,
    ability_scores: J({ str: 12, dex: 16, con: 14, int: 10, wis: 14, cha: 14 }),
    skills: J(['Persuasion', 'Survival', 'Athletics']), feats: J([]), languages: J(['Common']),
    spell_slots: J({ 1: 2 }), spell_slots_used: J({}),
    ...over,
  });
  await wid.assignWorldId('characters', id).catch(() => {});
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function addCompanion(name, pcId, over = {}) {
  const npcId = await insertRow('npcs', { name });
  await wid.assignWorldId('npcs', npcId);
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pcId, status: 'active',
    companion_spell_slots_used: J({}), progression_type: 'class_based', companion_level: 3, companion_class: 'Fighter',
    companion_ability_scores: J({ str: 14, dex: 12, con: 12, int: 10, wis: 10, cha: 10 }),
    skill_proficiencies: J(['Athletics']), companion_current_hp: 24, companion_max_hp: 24, armor_class: 14, ...over,
  });
  return dbGet('SELECT * FROM companions WHERE id = ?', [id]);
}
const addSession = (pcId) => insertRow('dm_sessions', { character_id: pcId, status: 'active', session_config: '{}' });
const cfgOf = async (sid) => JSON.parse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid])).session_config || '{}');
async function marker(text, characterId, sessionId, key, extra = {}) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId, ...extra });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}
const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });
const ADDED = ['tactician', 'sage_advice', 'hound', 'feather_foot', 'seismic_touch', 'trapper', 'friend_of_the_forest',
  'elusive', 'sling_expert', 'mountaineer', 'energy_affinity', 'quick_draw', 'silver_tongue', 'elegant_maneuver'];

// ===========================================================================
group('1. Catalog: fourteen feats, right slots, homebrew-tagged');
{
  const list = reg.listAddedFeats();
  ok(list.length === 14 && ADDED.every((k) => list.some((f) => f.key === k)), 'all fourteen are in the registry');
  ok(ADDED.every((k) => reg.getFeatEffect(k)?.source === 'homebrew' && reg.getFeatEffect(k)?.rulesetId), 'each is tagged homebrew with a ruleset id (never core)');
  ok(reg.getFeatEffect('energy_affinity').category === 'origin', 'Energy Affinity is an origin feat');
  ok(ADDED.filter((k) => k !== 'energy_affinity').every((k) => reg.getFeatEffect(k).category === 'general'), 'the other thirteen are general feats');
  const half = { hound: 'wis', feather_foot: 'dex', trapper: 'wis', elusive: 'dex', silver_tongue: 'cha' };
  ok(Object.entries(half).every(([k, a]) => reg.getFeatEffect(k).abilityIncrease?.ability === a && reg.getFeatEffect(k).abilityIncrease?.max === 20), 'the five half-feats carry +1 to the right ability, max 20');
  ok(ADDED.filter((k) => !half[k]).every((k) => !reg.getFeatEffect(k).abilityIncrease), 'the other nine carry no ability increase');
  ok(!reg.getFeatEffect('mountaineer').abilityIncrease && !/\+5|strength or constitution/i.test(reg.getFeatEffect('mountaineer').effect)
    && !/\+5|Strength or Constitution/.test(J(clientFeats.mountaineer)), 'Mountaineer: no ASI, and the "+5" typo is nowhere');
  ok(reg.getFeatEffect('mountaineer').sourcePdf === 'DNDBlue Feat Collection v2.4', 'Mountaineer names its source copy (DNDBlue)');
  ok(reg.getFeatEffect('silver_tongue').rulesetId === 'homebrew_xge_adaptations' && reg.getFeatEffect('elegant_maneuver').rulesetId === 'homebrew_xge_adaptations', 'the two WoW feats are tagged as Xanathar adaptations');
  ok(reg.getFeatEffect('feather_foot').prerequisite?.min === 13 && reg.getFeatEffect('elusive').prerequisite?.ability === 'dex' && reg.getFeatEffect('silver_tongue').prerequisite?.ability === 'cha', 'prerequisites: Feather Foot/Elusive Dex 13, Silver Tongue Cha 13');
  const gen = ADDED.filter((k) => k !== 'energy_affinity');
  ok(gen.every((k) => clientFeats[k]?.name === reg.getFeatEffect(k).name), 'the level-up catalog offers the thirteen general feats');
  ok(!clientFeats.energy_affinity, 'Energy Affinity is not offered in the general (level-up) slot');
  ok(clientMixed.isOriginFeatKey('energy_affinity') && clientMixed.ORIGIN_FEATS.length === 11, 'the origin picker (Human Versatile) offers Energy Affinity');
  ok(!J(reg.listAddedFeats()).match(/inspiration point|feat tier|morale di/i), 'no Book of Revised Feats house system rides in');
  const core = reg.getFeatEffect('Alert');
  ok(core.source === 'core' && reg.getFeatEffect('Lucky').source === 'core', 'the 2024 core feats are untouched (still core)');
}

group('2. Level-up picker helpers: the half-feat dropdown fix + prerequisites');
{
  ok(J(pick.featAbilityOptions(clientFeats.actor)) === J(['cha']), 'a fixed +1 (Actor) lists CHA, not "ABILITY"/"AMOUNT" (the old bug)');
  ok(J(pick.featAbilityOptions(clientFeats.athlete)) === J(['str', 'dex']), 'a choice +1 (Athlete) lists STR/DEX, not "CHOICE"');
  ok(J(pick.featAbilityOptions(clientFeats.silver_tongue)) === J(['cha']) && pick.featAbilityOptions(clientFeats.mountaineer).length === 0, 'Silver Tongue offers CHA; Mountaineer offers nothing');
  ok(!pick.featPrerequisiteMet(clientFeats.elusive, { dex: 12 }) && pick.featPrerequisiteMet(clientFeats.elusive, { dex: 13 }), 'Elusive: Dex 12 blocked, Dex 13 allowed');
  ok(!pick.featPrerequisiteMet(clientFeats.silver_tongue, { cha: 12 }) && pick.featPrerequisiteMet(clientFeats.tactician, {}), 'Silver Tongue Cha 12 blocked; Tactician has no prerequisite');
}

// ===========================================================================
// The real character router: level-up with a feat.
const app = express();
app.use(express.json());
app.use('/api/character', (await import(svc('server/routes/character.js'))).default);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : J(body) });
  let json = null; try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function levelThreeFighter(name, scores) {
  const created = await req('POST', '/api/character', { name, class: 'Fighter', race: 'human' });
  const id = created.json.id;
  await req('PUT', `/api/character/${id}`, {
    level: 3, experience: getXPToNextLevel(3), max_hp: 28, current_hp: 28,
    ability_scores: J(scores), class_levels: J([{ class: 'Fighter', level: 3, subclass: 'Champion' }]),
  });
  return id;
}
const featUp = (id, featKey, ability) => req('POST', `/api/character/level-up/${id}`, {
  selectedClass: 'Fighter', hpRoll: 'average', asiChoice: { type: 'feat', feat: featKey, featName: clientFeats[featKey].name, featAbilityChoice: ability ?? null },
});

group('3. Level-up: half-feat +1 once, prerequisites, no +1 where none');
{
  const sc = { str: 14, dex: 14, con: 14, int: 10, wis: 12, cha: 13 };
  const a = await levelThreeFighter('Pell Marrow', sc);
  const up = await featUp(a, 'silver_tongue', 'cha');
  const rowA = await dbGet('SELECT ability_scores, feats, level FROM characters WHERE id = ?', [a]);
  ok(up.status === 200 && rowA.level === 4, `Silver Tongue at level 4 succeeds (got ${up.status} ${J(up.json?.error || '')})`);
  ok(JSON.parse(rowA.ability_scores).cha === 14, 'Silver Tongue: Cha 13 → 14, applied once');
  ok(JSON.parse(rowA.feats).some((f) => f.key === 'silver_tongue'), 'the feat is on the character record');

  const b = await levelThreeFighter('Juno Vale', { ...sc, cha: 12 });
  const refused = await featUp(b, 'silver_tongue', 'cha');
  ok(refused.status === 400 && /Charisma 13/.test(refused.json?.error || ''), 'Silver Tongue with Cha 12 is refused (prerequisite)');
  ok((await dbGet('SELECT level FROM characters WHERE id = ?', [b])).level === 3, 'the refused level-up changes nothing');

  const c = await levelThreeFighter('Orrin Tal', sc);
  const wrong = await featUp(c, 'hound', 'cha');
  ok(wrong.status === 400 && /WIS only/.test(wrong.json?.error || ''), 'Hound with +1 Cha is refused (Wisdom only)');
  const mtn = await featUp(c, 'mountaineer', 'str');
  ok(mtn.status === 400 && /no ability score increase/.test(mtn.json?.error || ''), 'Mountaineer with a +1 is refused (no ASI)');
  const mtn2 = await featUp(c, 'mountaineer', null);
  const rowC = await dbGet('SELECT ability_scores FROM characters WHERE id = ?', [c]);
  ok(mtn2.status === 200 && J(JSON.parse(rowC.ability_scores)) === J(sc), 'Mountaineer with no +1 lands and leaves every score unchanged');

  const d = await levelThreeFighter('Sefa Quill', { ...sc, wis: 20 });
  const cap = await featUp(d, 'trapper', null);
  const rowD = await dbGet('SELECT ability_scores, feats FROM characters WHERE id = ?', [d]);
  ok(cap.status === 200 && JSON.parse(rowD.ability_scores).wis === 20, 'Trapper at Wis 20: the fixed +1 is filled in and capped at 20');
  ok(JSON.parse(rowD.feats).find((f) => f.key === 'trapper')?.uses?.used === 0, 'Trapper starts with a fresh use counter');
}

// ===========================================================================
group('4. Per-long-rest uses: Trapper 2, Sage Advice = PB');
{
  const pc = await addPc({ level: 5, feats: J([feat('trapper', { uses: { used: 0, reset: 'long' } }), feat('sage_advice', { uses: { used: 0, reset: 'long' } })]) });
  ok((await fm.featUsesLeft(pc.id, 'trapper')).max === 2, 'Trapper: 2 uses');
  ok((await fm.featUsesLeft(pc.id, 'sage_advice')).max === 3, 'Sage Advice at level 5: PB 3 uses');
  const s1 = await fm.spendFeatUse(pc.id, 'trapper');
  const s2 = await fm.spendFeatUse(pc.id, 'trapper');
  const s3 = await fm.spendFeatUse(pc.id, 'trapper');
  ok(s1.success && s1.left === 1 && s2.success && s2.left === 0 && !s3.success, 'two spends succeed, the third is refused');
  ok((await fm.resetFeatUses(pc.id, 'short')).length === 0 && (await fm.featUsesLeft(pc.id, 'trapper')).left === 0, 'a short rest restores nothing');
  const r = await rest.applyRest({ characterId: pc.id, type: 'long' });
  ok(r && (await fm.featUsesLeft(pc.id, 'trapper')).left === 2, 'a long rest refills the Trapper uses');
}

// ===========================================================================
group('5. Initiative: Alert +PB (fix), Tactician d4 (the player\'s die) + swap');
{
  const alertPc = await addPc({ feats: J([feat('alert')]) });
  const af = await fm.initiativeFeatsFor(alertPc.id);
  ok(af.flat === 3 && af.canSwap && !af.extraDie, 'Alert at level 5: +3 (PB) and the swap — the engine used to add Dex only');
  const tacPc = await addPc({ name: 'Brannoc Hale', feats: J([feat('tactician')]) });
  const tf = await fm.initiativeFeatsFor(tacPc.id);
  ok(tf.flat === 0 && tf.extraDie === 'd4' && tf.canSwap, 'Tactician: a d4 to roll, no flat bonus, the swap');
  const both = await addPc({ feats: J([feat('alert'), feat('tactician')]) });
  const bf = await fm.initiativeFeatsFor(both.id);
  ok(bf.flat === 3 && bf.extraDie === 'd4' && J(bf.swapSources) === J(['Alert', 'Tactician']), 'Alert and Tactician stack');

  const order = [{ name: 'Brannoc Hale', type: 'player', key: 'P', initiative: 9 }, { name: 'Lyra', type: 'companion', initiative: 17 }, { name: 'Orc 1', type: 'enemy', initiative: 14 }];
  const sw = fm.applyInitiativeSwap(order, 'P', 'Lyra');
  ok(sw.swapped && sw.order[0].initiative === 17 && sw.order[1].initiative === 9, 'swap with a willing ally exchanges the two initiatives');
  ok(/not a willing ally/.test(fm.applyInitiativeSwap(order, 'P', 'Orc 1').error || ''), 'an enemy is never willing');
  ok(fm.parseInitiativeSwap('14 3, swap with Lyra') === 'Lyra' && fm.parseInitiativeSwap('14 3') === null, 'the swap is read from the player\'s reply');

  // resolvePlayerInitiative against a live turn order.
  const sid = await addSession(tacPc.id);
  const [o1] = await es.createEncounterEnemies(sid, 1, [gob('Orc 1')]);
  const comp = await addCompanion('Lyra', tacPc.id);
  const ck = await tl.ledgerKeyForCompanion(comp);
  const pk = await tl.ledgerKeyForPlayer(tacPc.id);
  await ct.initializeTurnOrder(sid, 1, [{ name: 'Lyra', type: 'companion', key: ck, initiative: 18 }, { name: 'Orc 1', type: 'enemy', key: `combat:${sid}:1:${o1.id}`, initiative: 12 }]);
  await cl.setPendingInitiative(sid, { name: 'Brannoc Hale', type: 'player', key: pk, modifier: 3, dexModifier: 3, featBonus: 0, featReasons: [], extraDie: 'd4', canSwap: true, swapSources: ['Tactician'], encounterSeq: 1 });
  const noD4 = await cl.resolvePlayerInitiative(sid, 10, {});
  ok(noD4?.needsExtraDie === 'd4' && (await cl.getPendingInitiative(sid)), 'without the d4 the initiative stays pending (never rolled for the player)');
  const badD4 = await cl.resolvePlayerInitiative(sid, 10, { extraRoll: 7 });
  ok(badD4?.needsExtraDie === 'd4', 'a 7 is not a d4 face — still pending');
  const res = await cl.resolvePlayerInitiative(sid, 10, { extraRoll: 2, swapWith: 'Lyra' });
  ok(res && /d4 2 \(Tactician\)/.test(res.math) && /= 15/.test(res.math), `the math shows d20 10 + d4 2 + 3 = 15 (${res?.math})`);
  const st = await ct.getTurnState(sid, 1);
  const me = st.turnOrder.find((c) => c.type === 'player');
  const lyra = st.turnOrder.find((c) => c.name === 'Lyra');
  ok(res.swap?.with === 'Lyra' && me.initiative === 18 && lyra.initiative === 15 && st.turnOrder[0].type === 'player', 'swapped with Lyra: the player now goes first at 18');
  ok(!(await cl.getPendingInitiative(sid)) && (await cl.resolvePlayerInitiative(sid, 12, { extraRoll: 1, swapWith: 'Lyra' })) === null, 'the swap is once per combat: there is no second initiative to swap');
  ok(/Tactician d4/.test(cl.formatInitiativeFact(res)) && /swapped initiative with Lyra/.test(cl.formatInitiativeFact(res)), 'the DM fact states the d4 and the swap');
}

// ===========================================================================
group('6. ROLL_REQUEST feat riders: Hound, Trapper, Mountaineer, Elusive');
{
  const pc = await addPc({ feats: J([feat('hound'), feat('mountaineer'), feat('trapper')]) });
  const sid = await addSession(pc.id);
  const smell = await marker('[ROLL_REQUEST: Skill="Perception" DC=13 Looks="sniffing the cellar" Feat="Hound smell"]', pc.id, sid, 'ROLL_REQUEST');
  ok(smell?.pending && (await cfgOf(sid)).pendingRoll.advantage === 'advantage', 'Hound smell: Perception rolls with advantage (and rolls openly — a declared sense)');
  const track = await marker('[ROLL_REQUEST: Skill="Survival" DC=15 Looks="the scent trail" Feat="Hound track"]', pc.id, sid, 'ROLL_REQUEST');
  const pend = (await cfgOf(sid)).pendingRoll;
  ok(track?.pending && pend.featBonus === 5 && !pend.advantage, 'Hound track: +5, no advantage');
  const out = await rr.resolveReportedRoll(sid, [10]);
  ok(out.total === 10 + 2 + 3 + 5, `the +5 lands in the total (10 + Wis 2 + prof 3 + 5 = ${out.total})`);
  await marker('[ROLL_REQUEST: Skill="Athletics" DC=12 Looks="the cliff" Feat="Mountaineer climb"]', pc.id, sid, 'ROLL_REQUEST');
  ok((await cfgOf(sid)).pendingRoll.advantage === 'advantage', 'Mountaineer climb: Athletics with advantage');
  const wrongSkill = await marker('[ROLL_REQUEST: Skill="Stealth" DC=12 Looks="sneaking" Feat="Mountaineer climb"]', pc.id, sid, 'ROLL_REQUEST');
  ok(wrongSkill?.pending && !(await cfgOf(sid)).pendingRoll.advantage && /Athletics only/.test(wrongSkill.systemNote || ''), 'a rider on the wrong skill does not apply, and the DM is told');
  await marker('[ROLL_REQUEST: Skill="Medicine" DC=14 Looks="the owlbear pelt" Feat="Trapper harvest"]', pc.id, sid, 'ROLL_REQUEST');
  ok((await cfgOf(sid)).pendingRoll.advantage === 'advantage', 'Trapper harvest: any ability check to harvest has advantage');
  const save = await marker('[ROLL_REQUEST: Save="Dexterity" DC=14 Looks="the trap" Feat="Trapper track"]', pc.id, sid, 'ROLL_REQUEST');
  ok(save?.pending && !(await cfgOf(sid)).pendingRoll.advantage, 'a rider never applies to a save');
  const nofeat = await addPc({ name: 'Nobody Special', feats: J([]) });
  const s2 = await addSession(nofeat.id);
  const r2 = await marker('[ROLL_REQUEST: Skill="Survival" DC=15 Looks="tracks" Feat="Trapper track"]', nofeat.id, s2, 'ROLL_REQUEST');
  ok(r2?.pending && !(await cfgOf(s2)).pendingRoll.advantage && /does not have the Trapper/.test(r2.systemNote || ''), 'without the feat the rider is refused');

  // Live probe 2026-11-24: the DM tagged a scent-trail Survival check
  // "Hound smell" — the only Hound rider that covers Survival is the +5.
  await marker('[ROLL_REQUEST: Skill="Survival" DC=15 Looks="the scarf\'s trail" Feat="Hound smell"]', pc.id, sid, 'ROLL_REQUEST');
  const corrected = (await cfgOf(sid)).pendingRoll;
  ok(corrected.featBonus === 5 && !corrected.advantage, '"Hound smell" on Survival resolves to the one Hound rider that covers it (+5 tracking)');

  const elusive = await addPc({ name: 'Ghostly Kell', feats: J([feat('elusive')]) });
  const s3 = await addSession(elusive.id);
  await insertRow('npcs', { name: 'Bounty Hunter Rusk' });
  const npcRoll = await marker('[ROLL_REQUEST: Actor="Bounty Hunter Rusk" Skill="Survival" DC=14 Looks="tracking Kell" Feat="Elusive"]', elusive.id, s3, 'ROLL_REQUEST');
  ok(npcRoll && npcRoll.dice?.length === 2 && npcRoll.takenDie === Math.min(...npcRoll.dice), 'Elusive: the tracker rolls two d20s and takes the lower');
  const pcOwn = await marker('[ROLL_REQUEST: Skill="Survival" DC=14 Looks="x" Feat="Elusive"]', elusive.id, s3, 'ROLL_REQUEST');
  ok(/not to the player/.test(pcOwn?.systemNote || ''), 'Elusive is never applied to the player\'s own roll');
}

// ===========================================================================
group('7. Elegant Maneuver: advantage on the next Acrobatics/Athletics this turn');
{
  const pc = await addPc({ feats: J([feat('elegant_maneuver')]) });
  const sid = await addSession(pc.id);
  // Out of combat: the FEAT_USE then the ROLL_REQUEST in the same reply.
  const res = await pipeline.processResponseMarkers('[FEAT_USE: Feat="Elegant Maneuver"] You coil to leap. [ROLL_REQUEST: Skill="Acrobatics" DC=13 Looks="the gap"]', { characterId: pc.id, sessionId: sid });
  ok(res.handlerResults.find((h) => h.schemaKey === 'FEAT_USE')?.result?.success, 'FEAT_USE Elegant Maneuver is accepted');
  ok((await cfgOf(sid)).pendingRoll.advantage === 'advantage', 'the Acrobatics check in the same reply has advantage');
  await marker('[ROLL_REQUEST: Skill="Athletics" DC=13 Looks="again"]', pc.id, sid, 'ROLL_REQUEST');
  ok(!(await cfgOf(sid)).pendingRoll.advantage, 'it is spent: the next Athletics check has none');
  await marker('[FEAT_USE: Feat="Elegant Maneuver"]', pc.id, sid, 'FEAT_USE');
  await marker('[ROLL_REQUEST: Skill="Stealth" DC=13 Looks="quiet"]', pc.id, sid, 'ROLL_REQUEST');
  ok(!(await cfgOf(sid)).pendingRoll.advantage && (await fm.readPlayerFeatField(sid, pc.id, 'elegant')), 'a Stealth check neither uses nor spends it');
  await fm.notePlayerAction(sid); await fm.notePlayerAction(sid);
  await marker('[ROLL_REQUEST: Skill="Athletics" DC=13 Looks="late"]', pc.id, sid, 'ROLL_REQUEST');
  ok(!(await cfgOf(sid)).pendingRoll.advantage, 'out of combat it lapses after the player\'s next action');
  const none = await addPc({ name: 'Plain Dorn', feats: J([]) });
  const s2 = await addSession(none.id);
  const refused = await marker('[FEAT_USE: Feat="Elegant Maneuver"]', none.id, s2, 'FEAT_USE');
  ok(refused && !refused.success && /does not have/.test(refused.systemNote || ''), 'a player without the feat is refused');

  // In combat: bonus action spent, ends with the turn.
  const s3 = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(s3, 1, [gob('Goblin')]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  await ct.initializeTurnOrder(s3, 1, [{ name: pc.name, type: 'player', key: pk }, { name: 'Goblin', type: 'enemy', key: `combat:${s3}:1:${g.id}` }]);
  const em = await marker('[FEAT_USE: Feat="Elegant Maneuver"]', pc.id, s3, 'FEAT_USE');
  ok(em?.success && (await tl.checkBonus(s3, 1, pk)).allowed === false, 'in combat it spends the bonus action');
  const again = await marker('[FEAT_USE: Feat="Elegant Maneuver"]', pc.id, s3, 'FEAT_USE');
  ok(again && !again.success && /bonus action/.test(again.reason), 'a second use the same turn is refused (no bonus action left)');
  await ct.advanceTurn(s3, 1);
  ok(!(await fm.readPlayerFeatField(s3, pc.id, 'elegant')), 'unused, it ends when the turn passes');
}

// ===========================================================================
group('8. Seismic Touch: tremorsense 60 ft until the start of the next turn');
{
  const pc = await addPc({ feats: J([feat('seismic_touch')]) });
  const sid = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sid, 1, [gob('Goblin')]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  await ct.initializeTurnOrder(sid, 1, [{ name: pc.name, type: 'player', key: pk }, { name: 'Goblin', type: 'enemy', key: `combat:${sid}:1:${g.id}` }]);
  const r = await marker('[FEAT_USE: Feat="Seismic Touch"]', pc.id, sid, 'FEAT_USE');
  ok(r?.success && /tremorsense 60 ft/.test(r.systemNote), 'Seismic Touch is used; the DM is told 60 ft until the start of the next turn');
  ok((await fm.readPlayerFeatField(sid, pc.id, 'tremorsense'))?.range === 60, 'active on the player\'s own turn');
  await ct.advanceTurn(sid, 1);
  ok(!!(await fm.readPlayerFeatField(sid, pc.id, 'tremorsense')), 'still active through the goblin\'s turn');
  await ct.advanceTurn(sid, 1);
  ok(!(await fm.readPlayerFeatField(sid, pc.id, 'tremorsense')), 'gone at the start of the player\'s next turn');
}

// ===========================================================================
group('9. Sage Advice: allies add PB once to a check with the advised skill');
{
  const pc = await addPc({ name: 'Maestra Ilse', level: 5, feats: J([feat('sage_advice', { uses: { used: 0, reset: 'long' } })]) });
  const sid = await addSession(pc.id);
  await addCompanion('Tobin', pc.id, { skill_proficiencies: J(['Athletics']) });
  await addCompanion('Dara', pc.id, { skill_proficiencies: J(['Persuasion']) });
  const notProf = await marker('[FEAT_USE: Feat="Sage Advice" Skill="Arcana" Allies="Tobin"]', pc.id, sid, 'FEAT_USE');
  ok(notProf && !notProf.success && /not proficient/.test(notProf.reason), 'advice needs a skill the advisor is proficient in');
  const used = await marker('[FEAT_USE: Feat="Sage Advice" Skill="Persuasion" Allies="Tobin, Dara"]', pc.id, sid, 'FEAT_USE');
  ok(used?.success && used.usesLeft === 2 && used.usesMax === 3, 'used: 2 of 3 uses left');
  const t1 = await marker('[ROLL_REQUEST: Actor="Tobin" Skill="Persuasion" DC=12 Looks="haggling"]', pc.id, sid, 'ROLL_REQUEST');
  ok(t1 && t1.subclassBonus === 3 && t1.total === t1.takenDie + t1.modifier + 3, 'Tobin (not proficient) adds +3 to his Persuasion');
  const t2 = await marker('[ROLL_REQUEST: Actor="Tobin" Skill="Persuasion" DC=12 Looks="again"]', pc.id, sid, 'ROLL_REQUEST');
  ok(t2 && !t2.subclassBonus, 'once only: his next Persuasion has no bonus');
  const d1 = await marker('[ROLL_REQUEST: Actor="Dara" Skill="Persuasion" DC=12 Looks="charm"]', pc.id, sid, 'ROLL_REQUEST');
  ok(d1 && !d1.subclassBonus, 'Dara is already proficient: no bonus');
  const cfg = await cfgOf(sid);
  cfg.elapsedHours = (cfg.sageAdvice?.expiresAtHours || 2) + 0.1;
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [J(cfg), sid]);
  await marker('[FEAT_USE: Feat="Sage Advice" Skill="Persuasion" Allies="Tobin"]', pc.id, sid, 'FEAT_USE');
  const c2 = await cfgOf(sid); c2.elapsedHours = c2.sageAdvice.expiresAtHours + 0.01;
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [J(c2), sid]);
  const late = await marker('[ROLL_REQUEST: Actor="Tobin" Skill="Persuasion" DC=12 Looks="late"]', pc.id, sid, 'ROLL_REQUEST');
  ok(late && !late.subclassBonus, 'after the hour the advice is gone');
}

// ===========================================================================
group('10. Silver Tongue: Winning Words — contest, charm, harm, hostility');
{
  const pc = await addPc({ name: 'Cassia Dune', feats: J([feat('silver_tongue')]) });
  const sid = await addSession(pc.id);
  await insertRow('npcs', { name: 'Innkeeper Bolla', languages: 'Common, Dwarvish' });
  const w = await marker('[WINNING_WORDS: Target="Innkeeper Bolla" Insight=-40]', pc.id, sid, 'WINNING_WORDS');
  const pend = (await cfgOf(sid)).pendingRoll;
  ok(w?.pending && pend?.name === 'Persuasion' && pend.contest?.target === 'Innkeeper Bolla', 'Winning Words asks the player for Persuasion; Insight is rolled in secret');
  ok(/REPLACES the Influence DC/.test(w.systemNote), 'the DM is told it replaces the Influence DC (R-29)');
  const won = await rr.resolveReportedRoll(sid, [12]);
  ok(won.contest?.won === true && won.contest.charmed, 'the player beats the Insight total: charmed');
  const charm = (await cfgOf(sid)).featCharms?.[0];
  ok(charm?.name === 'Innkeeper Bolla' && Math.abs((charm.untilHours - charm.sinceHours) - 1 / 60) < 1e-9, 'the charm lasts 1 minute on the clock');
  ok(fm.charmActive(charm, { elapsedHours: charm.sinceHours }) && !fm.charmActive(charm, { elapsedHours: charm.untilHours }), 'active now, over after the minute');
  ok(/CHARMED for 1 minute/.test(fm.formatContestFact(won.contest)), 'the DM fact states the charm');
  const ended = await fm.endCharmOnHarm(sid, 'Innkeeper Bolla', 'struck');
  ok(ended?.ended === 'Innkeeper Bolla' && !((await cfgOf(sid)).featCharms || []).length, 'harm ends the charm at once');

  await marker('[WINNING_WORDS: Target="Innkeeper Bolla" Insight=40]', pc.id, sid, 'WINNING_WORDS');
  const lost = await rr.resolveReportedRoll(sid, [20]);
  ok(lost.contest?.won === false && !((await cfgOf(sid)).featCharms || []).length, 'a failed contest charms nobody');
  const hostile = await marker('[WINNING_WORDS: Target="Innkeeper Bolla" Attitude="hostile"]', pc.id, sid, 'WINNING_WORDS');
  ok(hostile && !hostile.success && /hostile/.test(hostile.reason) && !(await cfgOf(sid)).pendingRoll, 'a hostile creature is refused, no roll asked');
  const [orc] = await es.createEncounterEnemies(sid, 1, [gob('Orc Raider')]);
  const enemy = await marker('[WINNING_WORDS: Target="Orc Raider"]', pc.id, sid, 'WINNING_WORDS');
  ok(enemy && !enemy.success && /enemy in this fight/.test(enemy.reason) && orc, 'an enemy in the fight is hostile by definition');
  await insertRow('npcs', { name: 'Sahuagin Envoy', languages: 'Sahuagin' });
  const tongue = await marker('[WINNING_WORDS: Target="Sahuagin Envoy"]', pc.id, sid, 'WINNING_WORDS');
  ok(tongue && !tongue.success && /share no language/.test(tongue.reason), 'no shared language: refused');
  const nofeat = await addPc({ name: 'Mute Ferro', feats: J([]) });
  const s2 = await addSession(nofeat.id);
  const nf = await marker('[WINNING_WORDS: Target="Innkeeper Bolla"]', nofeat.id, s2, 'WINNING_WORDS');
  ok(nf && !nf.success && /Silver Tongue/.test(nf.reason), 'without the feat: refused');
  ok(!MARKER_SCHEMAS.WINNING_WORDS.fields.Uses, 'no usage limit: the marker has no counter');
  // Live probe 2026-11-24: the player names the feat → a directive rides the action.
  const dir = fm.featActionDirective(J([feat('silver_tongue')]), 'I use Winning Words on Hulda.');
  ok(/WINNING_WORDS: Target=/.test(dir) && /do NOT narrate/.test(dir), 'naming Winning Words adds the marker directive to the action');
  ok(fm.featActionDirective(J([]), 'I use Winning Words on Hulda.') === '', 'no directive for a player without the feat');
  ok(fm.featActionDirective(J([feat('silver_tongue')]), 'I chat with Hulda.') === '', 'no directive when the player does not name the feat');
  ok(/Free="true"/.test(fm.featActionDirective(J([feat('trapper')]), "I cast Hunter's Mark with a free Trapper cast")), 'Trapper free cast named: the SPELL_CAST directive');
}

// ===========================================================================
group('11. Trapper: Hunter\'s Mark 2 free casts per long rest, slots beyond');
{
  const pc = await addPc({ feats: J([feat('trapper', { uses: { used: 0, reset: 'long' } })]), spell_slots: J({ 1: 1 }), spell_slots_used: J({}) });
  const f1 = await spells.castSpell(pc.id, "Hunter's Mark", 1, { free: true });
  ok(f1?.success && f1.freeCast?.left === 1 && f1.slotConsumed === false, 'free cast 1: no slot spent');
  ok(J(JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [pc.id])).spell_slots_used)) === J({}), 'the slot is untouched');
  const s1 = await spells.castSpell(pc.id, "Hunter's Mark", 1, {});
  ok(s1?.success && s1.slotConsumed === true && !s1.freeCast, 'without Free= a slot pays, the free cast is saved');
  const f2 = await spells.castSpell(pc.id, "Hunter's Mark", 1, {});
  ok(f2?.success && f2.freeCast?.left === 0, 'no slot left: the second free cast is used automatically');
  const f3 = await spells.castSpell(pc.id, "Hunter's Mark", 1, { free: true });
  ok(f3 && !f3.success && /no uses left/.test(f3.reason), 'a third free cast is refused');
  await fm.resetFeatUses(pc.id, 'long');
  ok((await fm.featUsesLeft(pc.id, 'trapper')).left === 2, 'a long rest brings both back');
  const up = await spells.castSpell(pc.id, "Hunter's Mark", 2, { free: true });
  ok(up && !up.success && /1st-level/.test(up.reason), 'the free cast is a 1st-level spell only');
  const other = await addPc({ feats: J([]), spell_slots: J({ 1: 1 }) });
  const o = await spells.castSpell(other.id, "Hunter's Mark", 1, { free: true });
  ok(o?.success && o.slotConsumed === true && !o.freeCast, 'without Trapper, Free= changes nothing (a slot pays)');
  ok(/Hunter's Mark free casts 2\/2/.test(fm.formatFeatStateLines(await dbGet('SELECT * FROM characters WHERE id = ?', [pc.id])).join(' ')), 'the DM prompt shows the free casts left');
}

// ===========================================================================
group('12. Energy Affinity: the chosen resistance + granted cantrip only');
{
  ok(J(fm.energyAffinityGrant({ affinity: 'mind' })) === J({ affinity: 'mind', resistance: 'psychic', cantrip: 'Mind Sliver' }), 'Mind → psychic + Mind Sliver');
  ok(fm.energyAffinityGrant({ affinity: 'soul' }).cantrip === 'Sacred Flame' && fm.energyAffinityGrant({ affinity: 'death' }).resistance === 'necrotic', 'Soul → Sacred Flame; Death → necrotic');
  ok(fm.energyAffinityGrant({ affinity: 'fire' }) === null, 'any other affinity is no grant');
  const pc = await addPc({ name: 'Ivo Mirelle' });
  await dbRun('INSERT INTO character_origin_feats (character_id, feat_key, choices_json, selected_at_level, slot) VALUES (?, ?, ?, ?, ?)', [pc.id, 'energy_affinity', J({ affinity: 'mind' }), 1, 'versatile']);
  const psy = await resist.applyResistanceForActor({ kind: 'player', id: pc.id }, 11, 'psychic');
  const rad = await resist.applyResistanceForActor({ kind: 'player', id: pc.id }, 11, 'radiant');
  const nec = await resist.applyResistanceForActor({ kind: 'player', id: pc.id }, 11, 'necrotic');
  ok(psy.amount === 5 && psy.result === 'resistance', 'psychic damage 11 → 5 (halved, rounded down)');
  ok(rad.amount === 11 && nec.amount === 11, 'picking Mind does not grant radiant or necrotic resistance');
  const stage3 = validateCreatorNextStage3({ creator_next: true, race: 'human', versatile_feat: 'energy_affinity', versatile_feat_choices: { affinity: 'fire' } });
  ok((stage3.errors || []).some((e) => /Mind, Soul, or Death/.test(e)), 'the creator refuses an affinity outside Mind/Soul/Death');
  const fine = validateCreatorNextStage3({ creator_next: true, race: 'human', versatile_feat: 'energy_affinity', versatile_feat_choices: { affinity: 'soul' } });
  ok(!(fine.errors || []).some((e) => /Energy Affinity|versatileFeat/.test(e)), `Human Versatile may take Energy Affinity (Soul) — ${J(fine.errors || [])}`);
  ok(clientMixed.energyAffinityCantrip({ affinity: 'death' }) === 'Toll the Dead', 'the client grants the same cantrip');
  const cr = await import(svc('server/services/cantripResolutionService.js'));
  const res = cr.resolveCantrips({ classId: 'fighter', featCantrips: ['Mind Sliver'] });
  ok(res.cantrips.some((c) => (c.spell || c.name || c) === 'Mind Sliver') && res.grantedNeverCount === true, 'the cantrip resolves as a granted cantrip that never counts');
}

// ===========================================================================
group('13. Sling Expert: the two +1d4 clauses, separately');
{
  const d = (o) => fm.slingExpertDice({ isSling: true, normalRange: 30, ...o }).dice.length;
  ok(d({ distanceFt: 20, attackerSize: 'Medium', targetSize: 'Medium' }) === 1, 'within 30 ft, same size: +1d4');
  ok(d({ distanceFt: 60, attackerSize: 'Medium', targetSize: 'Medium' }) === 0, 'beyond 30 ft, same size: nothing');
  ok(d({ distanceFt: 60, attackerSize: 'Small', targetSize: 'Medium' }) === 1, 'beyond 30 ft, one size larger: +1d4');
  ok(d({ distanceFt: 30, attackerSize: 'Small', targetSize: 'Medium' }) === 2, 'at 30 ft, one size larger: both +1d4');
  ok(d({ distanceFt: 10, attackerSize: 'Medium', targetSize: 'Huge' }) === 1, 'two sizes larger is not "one size larger" (as written)');
  ok(fm.slingExpertDice({ isSling: false, distanceFt: 5, attackerSize: 'Small', targetSize: 'Medium' }).dice.length === 0, 'not a sling: nothing');
  ok(fm.slingExpertDice({ isSling: true, distanceFt: null, attackerSize: null, targetSize: 'Medium' }).notes.length === 2, 'unknown distance or size: no die, and it says so');

  // Through the real attack path: a Small slinger, a Medium goblin 20 ft off.
  const pc = await addPc({ name: 'Pip Burrow', size: 'Small', feats: J([feat('sling_expert')]), equipment: J({ mainHand: { name: 'Sling' } }), inventory: J([{ name: 'Sling Bullets', quantity: 20 }]) });
  const sid = await addSession(pc.id);
  const [g] = await es.createEncounterEnemies(sid, 1, [gob('GobSling')]);
  await dbRun('UPDATE combat_enemies SET stats_json = ? WHERE id = ?', [J({ size: 'Medium' }), g.id]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  await ct.initializeTurnOrder(sid, 1, [{ name: 'Pip Burrow', type: 'player', key: pk }, { name: 'GobSling', type: 'enemy', key: `combat:${sid}:1:${g.id}` }]);
  await marker('[ZONES: Zones="hill,road" Edges="hill-road:20" Places="Pip Burrow:hill,GobSling:road"]', pc.id, sid, 'ZONES');
  const decl = await marker('[ATTACK: Attacker="Pip Burrow" Target="GobSling"]', pc.id, sid, 'ATTACK');
  ok(decl?.pending, `the sling attack is declared (${J(decl)})`);
  const hit = await pas.resolveReportedAttack(sid, pc.id, [15]);
  ok(hit?.awaitingDamage && hit.damageDiceText === '1d4 + 1d4 + 1d4', `the player is asked for 1d4 + 1d4 + 1d4 (got ${hit?.damageDiceText})`);
}

// ===========================================================================
group('14. Quick Draw: a creature moving within 5 ft provokes (ranged in hand)');
{
  const mk = async (feats, weapon) => {
    const pc = await addPc({ name: 'Rook Danner', feats: J(feats), equipment: J({ mainHand: { name: weapon } }) });
    const sid = await addSession(pc.id);
    const [g] = await es.createEncounterEnemies(sid, 1, [gob('Charger')]);
    const pk = await tl.ledgerKeyForPlayer(pc.id);
    const gk = `combat:${sid}:1:${g.id}`;
    await ct.initializeTurnOrder(sid, 1, [{ name: 'Charger', type: 'enemy', key: gk }, { name: 'Rook Danner', type: 'player', key: pk }]);
    await marker('[ZONES: Zones="near,far" Edges="near-far:30" Places="Rook Danner:near,Charger:far"]', pc.id, sid, 'ZONES');
    return mv.provokedByMove(sid, 1, gk, 'enemy', ['far', 'near'], false, false);
  };
  const withFeat = await mk([feat('quick_draw')], 'Shortbow');
  ok(withFeat.length === 1 && withFeat[0].quickDraw, 'with Quick Draw and a bow, the charger closing to 5 ft provokes');
  const noFeat = await mk([], 'Shortbow');
  ok(noFeat.length === 0, 'without the feat, closing in provokes nobody (the book rule)');
  const melee = await mk([feat('quick_draw')], 'Longsword');
  ok(melee.length === 0, 'with a melee weapon in hand Quick Draw does not trigger');
  const thrown = await mk([feat('quick_draw')], 'Dagger');
  ok(thrown.length === 1, 'a thrown weapon (dagger) counts');
}

// ===========================================================================
group('15. Markers, schema order and the DM prompt');
{
  const keys = Object.keys(MARKER_SCHEMAS);
  ok(keys.indexOf('FEAT_USE') < keys.indexOf('ROLL_REQUEST') && keys.indexOf('WINNING_WORDS') < keys.indexOf('ROLL_REQUEST'), 'FEAT_USE and WINNING_WORDS dispatch before ROLL_REQUEST');
  ok(MARKER_SCHEMAS.ROLL_REQUEST.fields.Feat && MARKER_SCHEMAS.SPELL_CAST.fields.Free, 'ROLL_REQUEST takes Feat=, SPELL_CAST takes Free=');
  const { createDMSystemPrompt } = await import(svc('server/services/dmPromptBuilder.js'));
  const pc = await addPc({ name: 'Talia Brook', feats: J([feat('elegant_maneuver'), feat('hound'), feat('sage_advice', { uses: { used: 1, reset: 'long' } })]) });
  let prompt = '';
  try { prompt = createDMSystemPrompt(pc, {}); } catch (e) { prompt = String(e.message); }
  ok(/FEAT STATE AND USE/.test(prompt) && /FEAT_USE: Feat="Elegant Maneuver"/.test(prompt) && /"Hound smell"/.test(prompt), 'the DM is taught the held feats\' markers');
  ok(/Sage Advice: 2\/3 uses left/.test(prompt), 'the prompt shows Sage Advice uses left');
  const plain = await addPc({ name: 'Plain Jory', feats: J([]) });
  let p2 = ''; try { p2 = createDMSystemPrompt(plain, {}); } catch (e) { p2 = String(e.message); }
  ok(!/FEAT STATE AND USE/.test(p2), 'a character without these feats gets no feat-use teaching');
}

server.close();
console.log(`\nfeat-addition-14: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
