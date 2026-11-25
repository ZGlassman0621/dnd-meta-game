// tests/warlock-invocations.test.js — class-audit-severe-seven item 2:
// Warlock Eldritch Invocations (2026-11-25). Data:
// docs/pm/class-audit-severe-seven/warlock-invocations-2024-phb.md.
//
//   (a) the catalog: all 28 rows of the supplied document (name,
//       prerequisite, effect, repeatable, level), the known-per-level
//       table, the client copy equal to the server, and the cantrip
//       traits naming real Warlock cantrips in the spell catalog.
//   (b) the rules (pure service): level prerequisites are Warlock
//       levels, Pact / invocation prerequisites, the "same time" rule,
//       repeatable choices, the known cap, replacement blocked while a
//       prerequisite, Lessons of the First Ones feats sync.
//   (c) the routes (real HTTP): the creator's level-one pick, the pact
//       path kept in step, GET options, level-up picks and refusals, the
//       swap, multiclass-in, the sheet's Learn catch-up, a class change
//       clearing them, and the DM prompt line.
//   (d) migration 117's backfill of a pre-117 pact.
//   (e) client wiring (source guards): Stage 2, persistence, level-up
//       picker, sheet section.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'warlock-invocations-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const data = await import(fromRepo('server/data/warlockInvocations.js'));
const clientData = await import(fromRepo('client/src/data/warlockInvocations.js'));
const S = await import(fromRepo('server/services/warlockInvocationService.js'));
const { SPELL_DATA_ENTRIES } = await import(fromRepo('server/data/spellCatalogData.js'));
const persistence = await import(fromRepo('client/src/components/creator-next/stage1Persistence.js'));

const app = express();
app.use(express.json());
app.use('/api/character', (await import(fromRepo('server/routes/character.js'))).default);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
const row = (id) => db.dbGet('SELECT * FROM characters WHERE id = ?', [id]);
const invOf = async (id) => S.parseInvocations((await row(id)).invocations);
const keysOf = (list) => list.map((i) => i.key).sort().join(',');
const XP = { 2: 300, 3: 900, 5: 6500, 6: 14000 };
async function makeWarlock(name, { level = 1, xp = 0, invocations = null, knownCantrips = ['Eldritch Blast', 'Mage Hand'], cls = 'warlock', classLevels = null } = {}) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  if (created.status !== 201) throw new Error(`fixture POST ${name}: ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level, experience: xp, max_hp: 20, current_hp: 20,
    class_levels: JSON.stringify(classLevels || [{ class: cls, level, subclass: null }]),
    known_cantrips: JSON.stringify(knownCantrips),
  });
  if (put.status !== 200) throw new Error(`fixture PUT ${name}: ${put.status} ${JSON.stringify(put.json)}`);
  if (invocations) await db.dbRun('UPDATE characters SET invocations = ? WHERE id = ?', [JSON.stringify(invocations), id]);
  return id;
}

// ------------------------------------------------------------------ (a)
group('(a) catalog matches the supplied 2024 data');
{
  const md = readRepo('docs/pm/class-audit-severe-seven/warlock-invocations-2024-phb.md');
  const rows = md.split('\n').filter((l) => /^\| [A-Z]/.test(l) && !/^\| (Name|Level|Known)/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((s) => s.trim()));
  check(rows.length === 28, `document lists 28 options (got ${rows.length})`);
  check(data.WARLOCK_INVOCATIONS.length === 28, `catalog holds 28 (got ${data.WARLOCK_INVOCATIONS.length})`);
  for (const [name, pre, eff, rep] of rows) {
    const e = data.WARLOCK_INVOCATIONS.find((x) => x.name === name);
    check(!!e, `${name} is in the catalog`);
    if (!e) continue;
    check(e.prereqText === pre, `${name} prerequisite text matches`);
    check(e.effect === eff, `${name} effect text matches`);
    check(e.repeatable === (rep === 'Yes'), `${name} repeatable matches`);
    const m = /Level (\d+)\+/.exec(pre);
    check(e.minLevel === (m ? Number(m[1]) : 1), `${name} level prerequisite is ${m ? m[1] : 1}`);
  }
  const known = md.split('\n').filter((l) => l.startsWith('| Known')).flatMap((l) => l.split('|').slice(2, -1).map((s) => Number(s.trim())));
  check(JSON.stringify(known) === JSON.stringify(data.INVOCATIONS_KNOWN_BY_LEVEL), 'invocations known per level matches the PHB table');
  check(JSON.stringify(data.INVOCATIONS_KNOWN_BY_LEVEL) !== JSON.stringify([0, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8]), 'not the 2014 table');
  check(JSON.stringify(clientData.WARLOCK_INVOCATIONS) === JSON.stringify(data.WARLOCK_INVOCATIONS), 'client catalog copy equals the server catalog');
  check(JSON.stringify(clientData.INVOCATIONS_KNOWN_BY_LEVEL) === JSON.stringify(data.INVOCATIONS_KNOWN_BY_LEVEL), 'client known table equals the server');
  for (const k of Object.keys(data.WARLOCK_CANTRIP_TRAITS)) {
    const s = SPELL_DATA_ENTRIES[k];
    check(s && s.level === 0 && s.classes.includes('Warlock'), `cantrip trait '${k}' is a Warlock cantrip in the spell catalog`);
    const t = data.WARLOCK_CANTRIP_TRAITS[k];
    check(t.range10 === /^\d+ feet/.test(s?.range || '') && (!/^\d+ feet/.test(s?.range || '') || Number(/^(\d+)/.exec(s.range)[1]) >= 10),
      `'${k}' range10 agrees with the catalog range (${s?.range})`);
  }
  for (const banned of ['Beguiling Influence', 'Book of Ancient Secrets', 'Eldritch Sight', 'Pact of the Talisman']) {
    check(!data.WARLOCK_INVOCATIONS.some((e) => e.name === banned), `2014-only ${banned} is not offered`);
  }
}

// ------------------------------------------------------------------ (b)
group('(b) the rules');
{
  check(S.invocationsKnownAt(1) === 1 && S.invocationsKnownAt(2) === 3 && S.invocationsKnownAt(20) === 10 && S.invocationsKnownAt(0) === 0, 'known count by level');
  check(S.warlockLevelOf({ class: 'fighter', level: 6, class_levels: JSON.stringify([{ class: 'fighter', level: 4 }, { class: 'warlock', level: 2 }]) }) === 2,
    'a multiclass character uses its warlock class level');
  const kc = ['Eldritch Blast', 'Toll the Dead', 'Mage Hand'];
  const v = (picks, ctx) => S.validateNewInvocations(picks, { held: [], knownCantrips: kc, due: 5, ...ctx });
  check(!v([{ key: 'devils_sight' }], { warlockLevel: 1 }).ok, "Devil's Sight refused at Warlock level 1");
  check(v([{ key: 'devils_sight' }], { warlockLevel: 2 }).ok, "Devil's Sight allowed at Warlock level 2");
  check(!v([{ key: 'thirsting_blade' }], { warlockLevel: 5 }).ok, 'Thirsting Blade refused without Pact of the Blade');
  check(v([{ key: 'thirsting_blade' }, { key: 'pact_of_the_blade' }], { warlockLevel: 5 }).ok, 'Thirsting Blade + Pact of the Blade learned at the same time (any order)');
  check(!v([{ key: 'devouring_blade' }, { key: 'pact_of_the_blade' }], { warlockLevel: 12 }).ok, 'Devouring Blade needs Thirsting Blade, not just the Pact');
  check(!v([{ key: 'pact_of_the_blade' }, { key: 'pact_of_the_blade' }], { warlockLevel: 5 }).ok, 'a non-repeatable invocation twice is refused');
  check(!v([{ key: 'agonizing_blast' }], { warlockLevel: 2 }).ok, 'Agonizing Blast without a cantrip choice is refused');
  check(v([{ key: 'agonizing_blast', choice: 'Eldritch Blast' }, { key: 'agonizing_blast', choice: 'Toll the Dead' }], { warlockLevel: 2 }).ok,
    'Agonizing Blast twice, for two different cantrips');
  check(!v([{ key: 'agonizing_blast', choice: 'Eldritch Blast' }, { key: 'agonizing_blast', choice: 'eldritch blast' }], { warlockLevel: 2 }).ok,
    'Agonizing Blast twice for the same cantrip is refused');
  check(!v([{ key: 'agonizing_blast', choice: 'Mage Hand' }], { warlockLevel: 2 }).ok, 'Agonizing Blast on a non-damaging cantrip is refused');
  check(!v([{ key: 'agonizing_blast', choice: 'Chill Touch' }], { warlockLevel: 2 }).ok, 'Agonizing Blast on a cantrip the character does not know is refused');
  check(!v([{ key: 'repelling_blast', choice: 'Toll the Dead' }], { warlockLevel: 2 }).ok, 'Repelling Blast on a saving-throw cantrip is refused');
  check(v([{ key: 'eldritch_spear', choice: 'Toll the Dead' }], { warlockLevel: 2 }).ok, 'Eldritch Spear on a 60-ft damage cantrip is allowed');
  check(v([{ key: 'lessons_of_the_first_ones', choice: 'Alert' }, { key: 'lessons_of_the_first_ones', choice: 'tough' }], { warlockLevel: 2 }).ok,
    'Lessons of the First Ones twice, for two Origin feats (name or key)');
  check(!v([{ key: 'lessons_of_the_first_ones', choice: 'Great Weapon Master' }], { warlockLevel: 2 }).ok, 'Lessons refuses a non-Origin feat');
  check(!S.validateNewInvocations([{ key: 'armor_of_shadows' }, { key: 'eldritch_mind' }], { warlockLevel: 1, held: [], due: 1 }).ok, 'over the due count is refused');
  check(!v([{ key: 'beguiling_influence' }], { warlockLevel: 2 }).ok, 'a 2014 invocation is refused');
  const held = [{ key: 'pact_of_the_blade', choice: null }, { key: 'thirsting_blade', choice: null }];
  const blocked = S.validateReplacement({ key: 'pact_of_the_blade' }, { key: 'pact_of_the_chain' }, { warlockLevel: 6, held });
  check(!blocked.ok && /prerequisite for Thirsting Blade/.test(blocked.errors[0]), 'the Pact cannot be replaced while Thirsting Blade is held');
  const swap = S.validateReplacement({ key: 'thirsting_blade' }, { key: 'eldritch_smite' }, { warlockLevel: 6, held });
  check(swap.ok && keysOf(swap.next) === 'eldritch_smite,pact_of_the_blade', 'Thirsting Blade can be swapped for Eldritch Smite');
  const selfDep = S.validateReplacement({ key: 'pact_of_the_blade' }, { key: 'thirsting_blade' }, { warlockLevel: 6, held: [{ key: 'pact_of_the_blade', choice: null }] });
  check(!selfDep.ok, 'the replacement must qualify without the invocation given up');
  check(!S.validateInvocationSet([{ key: 'armor_of_shadows' }, { key: 'eldritch_mind' }], { warlockLevel: 1 }).ok, 'a level-1 set of two is over the cap');
  const lessons = S.syncLessonsFeats(JSON.stringify([{ key: 'alert', name: 'Alert' }]), [], [{ key: 'lessons_of_the_first_ones', choice: 'tough' }], 2);
  check(lessons.changed && lessons.feats.length === 2 && lessons.feats[1].key === 'tough' && lessons.feats[1].source === 'Lessons of the First Ones',
    'Lessons adds the Origin feat to feats, leaving the others');
  const removed = S.syncLessonsFeats(lessons.feats, [{ key: 'lessons_of_the_first_ones', choice: 'tough' }], [], 3);
  check(removed.feats.length === 1 && removed.feats[0].key === 'alert', 'replacing Lessons away removes only its feat');
  const opts = S.invocationOptions({ warlockLevel: 1, held: [] });
  check(keysOf(opts.filter((o) => o.eligible)) === 'armor_of_shadows,eldritch_mind,pact_of_the_blade,pact_of_the_chain,pact_of_the_tome',
    'level 1 offers exactly the five invocations without prerequisites');
}

// ------------------------------------------------------------------ (c)
group('(c) routes');
{
  // Creator: the level-one pick (non-pact), then switched to a pact.
  const post = await req('POST', '/api/character', { creator: 'creator-next', name: 'Inv Creator', class: 'warlock', race: 'human', level_one_invocation: 'armor_of_shadows' });
  check(post.status === 201, `creator POST with level_one_invocation: 201 (got ${post.status} ${JSON.stringify(post.json)})`);
  const cid = post.json.id;
  check(keysOf(await invOf(cid)) === 'armor_of_shadows' && (await row(cid)).pact === null, 'stored: Armor of Shadows, no pact');
  const toPact = await req('PUT', `/api/character/${cid}`, { creator: 'creator-next', level_one_invocation: 'pact_of_the_tome', pact: 'tome' });
  check(toPact.status === 200, `PUT switch to Pact of the Tome: 200 (got ${toPact.status} ${JSON.stringify(toPact.json)})`);
  check(keysOf(await invOf(cid)) === 'pact_of_the_tome' && (await row(cid)).pact === 'tome', 'stored: Pact of the Tome, pact column tome');
  const bad = await req('PUT', `/api/character/${cid}`, { level_one_invocation: 'devils_sight' });
  check(bad.status === 400, `level 1 cannot take Devil's Sight: 400 (got ${bad.status})`);
  const cleared = await req('PUT', `/api/character/${cid}`, { level_one_invocation: '' });
  check(cleared.status === 200 && (await invOf(cid)).length === 0 && (await row(cid)).pact === null, 'an empty pick clears both columns');
  const fighterInv = await req('POST', '/api/character', { name: 'Inv Fighter', class: 'fighter', race: 'human', level_one_invocation: 'eldritch_mind' });
  check(fighterInv.status === 400, `a fighter cannot hold invocations: 400 (got ${fighterInv.status})`);

  // Legacy pact-only path keeps the list in step.
  const legacy = await req('POST', '/api/character', { name: 'Inv Legacy', class: 'warlock', race: 'human', pact: 'chain' });
  check(keysOf(await invOf(legacy.json.id)) === 'pact_of_the_chain', 'a POST with only pact stores it as the invocation');
  await req('PUT', `/api/character/${legacy.json.id}`, { pact: 'blade' });
  check(keysOf(await invOf(legacy.json.id)) === 'pact_of_the_blade', 'a PUT of only pact swaps the Pact in the list');

  // Level-up 1 -> 2: due = 3 - 1 held = 2.
  const w1 = await makeWarlock('Inv Lvl1', { level: 1, xp: XP[2], invocations: [{ key: 'pact_of_the_blade', choice: null }] });
  const info = await req('GET', `/api/character/level-up-info/${w1}`);
  const wopt = info.json?.classOptions?.find((o) => o.type === 'existing' && o.class.toLowerCase() === 'warlock');
  check(wopt?.choices?.newInvocations === 2, `level-up-info: warlock 1->2 owes 2 invocations (got ${wopt?.choices?.newInvocations})`);
  check(wopt?.choices?.canReplaceInvocation === true, 'level-up-info: a held invocation can be replaced');
  const g = await req('GET', `/api/character/invocations/${w1}?level=2`);
  check(g.status === 200 && g.json.known === 3 && g.json.held.length === 1, `GET invocations ?level=2: known 3, 1 held (got ${JSON.stringify({ k: g.json?.known, h: g.json?.held?.length })})`);
  const ab = g.json.options.find((o) => o.key === 'agonizing_blast');
  check(ab?.eligible === true && ab.choices.includes('eldritch blast') && !ab.choices.includes('mage hand'), 'Agonizing Blast offered for Eldritch Blast only');
  const tb = g.json.options.find((o) => o.key === 'thirsting_blade');
  check(tb?.eligible === false && /level 5/.test(tb.reason), 'Thirsting Blade shown ineligible with its level reason');
  const over = await req('POST', `/api/character/level-up/${w1}`, { hpRoll: 'average', newInvocations: [{ key: 'devils_sight' }, { key: 'misty_visions' }, { key: 'eldritch_mind' }] });
  check(over.status === 400 && /allows 2/.test(over.json?.error || ''), `three picks when 2 are due: 400 (got ${over.status} ${JSON.stringify(over.json)})`);
  const early = await req('POST', `/api/character/level-up/${w1}`, { hpRoll: 'average', newInvocations: [{ key: 'thirsting_blade' }] });
  check(early.status === 400 && /level 5/.test(early.json?.error || ''), `Thirsting Blade at 2: 400 (got ${early.status})`);
  check((await row(w1)).level === 1, 'refused level-ups left the level at 1');
  const up = await req('POST', `/api/character/level-up/${w1}`, { hpRoll: 'average', newInvocations: [{ key: 'agonizing_blast', choice: 'Eldritch Blast' }, { key: 'lessons_of_the_first_ones', choice: 'alert' }] });
  check(up.status === 200, `level-up with two picks: 200 (got ${up.status} ${JSON.stringify(up.json)})`);
  const after = await row(w1);
  check(after.level === 2 && keysOf(S.parseInvocations(after.invocations)) === 'agonizing_blast,lessons_of_the_first_ones,pact_of_the_blade', 'stored: the two picks + the Pact');
  check(after.pact === 'blade', 'pact column still blade');
  const feats = JSON.parse(after.feats || '[]');
  check(feats.some((f) => f.key === 'alert' && f.source === 'Lessons of the First Ones'), 'Lessons granted the Alert feat');

  // Level-up 4 -> 5 with a swap: due = 5 - 3 = 2; swap the Pact? blocked by nothing yet.
  const w4 = await makeWarlock('Inv Lvl4', { level: 4, xp: XP[5], invocations: [{ key: 'pact_of_the_blade', choice: null }, { key: 'devils_sight', choice: null }, { key: 'misty_visions', choice: null }] });
  const swapBad = await req('POST', `/api/character/level-up/${w4}`, { hpRoll: 'average',
    newInvocations: [{ key: 'thirsting_blade' }],
    replaceInvocation: { from: { key: 'pact_of_the_blade' }, to: { key: 'pact_of_the_chain' } } });
  check(swapBad.status === 400, `swapping the Pact away while also taking Thirsting Blade: 400 (got ${swapBad.status} ${JSON.stringify(swapBad.json)})`);
  const swapOk = await req('POST', `/api/character/level-up/${w4}`, { hpRoll: 'average',
    newInvocations: [{ key: 'thirsting_blade' }, { key: 'eldritch_smite' }],
    replaceInvocation: { from: { key: 'misty_visions' }, to: { key: 'one_with_shadows' } } });
  check(swapOk.status === 200, `level 5 with two picks and a swap: 200 (got ${swapOk.status} ${JSON.stringify(swapOk.json)})`);
  check(keysOf(await invOf(w4)) === 'devils_sight,eldritch_smite,one_with_shadows,pact_of_the_blade,thirsting_blade', 'stored after the swap');

  // Non-warlock level-up sending invocations is refused.
  const f1 = await makeWarlock('Inv FighterUp', { cls: 'fighter', level: 1, xp: XP[2] });
  const fUp = await req('POST', `/api/character/level-up/${f1}`, { hpRoll: 'average', selectedClass: 'Fighter', newInvocations: [{ key: 'eldritch_mind' }] });
  check(fUp.status === 400, `a fighter level sending invocations: 400 (got ${fUp.status})`);

  // Multiclass fighter -> warlock 1: one invocation due.
  const mInfo = await req('GET', `/api/character/level-up-info/${f1}`);
  check(mInfo.json?.classOptions?.find((o) => o.type === 'multiclass' && o.class.toLowerCase() === 'warlock')?.choices?.newInvocations === 1,
    'multiclass into warlock owes 1 invocation');
  const mUp = await req('POST', `/api/character/level-up/${f1}`, { hpRoll: 'average', selectedClass: 'Warlock', newInvocations: [{ key: 'eldritch_mind' }] });
  check(mUp.status === 200 && keysOf(await invOf(f1)) === 'eldritch_mind', `multiclass into warlock with Eldritch Mind: 200 (got ${mUp.status} ${JSON.stringify(mUp.json)})`);

  // Sheet catch-up: a level-5 warlock holding 1 learns up to 5.
  const w5 = await makeWarlock('Inv Behind', { level: 5, xp: XP[5], invocations: [{ key: 'pact_of_the_chain', choice: null }] });
  const learn = await req('POST', `/api/character/invocations/${w5}/learn`, { invocations: [{ key: 'investment_of_the_chain_master' }, { key: 'gift_of_the_depths' }] });
  check(learn.status === 200 && learn.json.held.length === 3, `Learn catch-up: 200 with 3 held (got ${learn.status} ${JSON.stringify(learn.json)})`);
  const learnOver = await req('POST', `/api/character/invocations/${w5}/learn`, { invocations: [{ key: 'devils_sight' }, { key: 'misty_visions' }, { key: 'mask_of_many_faces' }] });
  check(learnOver.status === 400, `Learn past the known count (5): 400 (got ${learnOver.status})`);
  const learnFighter = await req('POST', `/api/character/invocations/${(await req('POST', '/api/character', { name: 'Inv F2', class: 'fighter', race: 'human' })).json.id}/learn`, { invocations: [{ key: 'eldritch_mind' }] });
  check(learnFighter.status === 400, `Learn on a non-warlock: 400 (got ${learnFighter.status})`);

  // A class change away from warlock clears invocations and pact.
  await req('PUT', `/api/character/${w5}`, { class: 'fighter', class_levels: JSON.stringify([{ class: 'fighter', level: 5 }]) });
  const cleared5 = await row(w5);
  check(S.parseInvocations(cleared5.invocations).length === 0 && cleared5.pact === null, 'a class change away from warlock clears invocations and pact');

  // A creator resave cannot overwrite a longer list.
  const resave = await req('PUT', `/api/character/${w4}`, { level_one_invocation: 'armor_of_shadows' });
  check(resave.status === 400 && (await invOf(w4)).length === 5, `level_one_invocation on a 5-invocation warlock: 400, list kept (got ${resave.status})`);

  // DM prompt carries the invocations.
  const { createDMSystemPrompt } = await import(fromRepo('server/services/dmPromptBuilder.js'));
  let prompt = '';
  try { prompt = createDMSystemPrompt(await row(w1), {}); } catch (e) { prompt = `THREW ${e.message}`; }
  check(prompt.includes('Eldritch Invocations: ') && prompt.includes('Agonizing Blast (Eldritch Blast)') && prompt.includes('Lessons of the First Ones (Alert)'),
    `DM prompt lists the invocations with their choices${prompt.startsWith('THREW') ? ` (${prompt})` : ''}`);
}

// ------------------------------------------------------------------ (d)
group('(d) migration 117 backfill');
{
  const pre = await req('POST', '/api/character', { name: 'Inv Pre117', class: 'warlock', race: 'human' });
  await db.dbRun("UPDATE characters SET pact = 'tome', invocations = '[]' WHERE id = ?", [pre.json.id]);
  const mig = await import(fromRepo('server/migrations/117_warlock_invocations.js'));
  await mig.up(db.default);
  check(keysOf(await invOf(pre.json.id)) === 'pact_of_the_tome', 'a pre-117 pact becomes the warlock\'s one invocation');
  await mig.up(db.default);
  check((await invOf(pre.json.id)).length === 1, 're-running the migration is a no-op');
}

// ------------------------------------------------------------------ (e)
group('(e) client wiring');
{
  const body = persistence.buildStage1ProgressBody({ pactBoon: 'Eldritch Mind' });
  check(body.level_one_invocation === 'eldritch_mind' && body.pact === undefined, 'a non-Pact pick saves as level_one_invocation, no pact');
  const pactBody = persistence.buildStage1ProgressBody({ pactBoon: 'Pact of the Blade' });
  check(pactBody.level_one_invocation === 'pact_of_the_blade' && pactBody.pact === 'blade', 'a Pact pick saves both');
  const r1 = persistence.rehydrateStateFromServerRow({ invocations: JSON.stringify([{ key: 'armor_of_shadows', choice: null }]) }, null);
  check((r1?.patch ?? r1)?.pactBoon === 'Armor of Shadows', 'resume restores a one-invocation list');
  const r2 = persistence.rehydrateStateFromServerRow({ pact: 'blade', invocations: JSON.stringify([{ key: 'pact_of_the_blade' }, { key: 'devils_sight' }, { key: 'misty_visions' }]) }, null);
  check(!(r2?.patch ?? r2)?.pactBoon, 'resume leaves a longer list to the sheet');
  const stage2 = readRepo('client/src/components/creator-next/Stage2ClassCalling.jsx');
  check(stage2.includes('L1_INVOCATIONS') && stage2.includes('WARLOCK_INVOCATIONS') && stage2.includes('Choose an invocation…'), 'Stage 2 offers the level-1 invocations from the catalog');
  const levelUp = readRepo('client/src/components/LevelUpPage.jsx');
  check(levelUp.includes('<InvocationPicker') && levelUp.includes('body.newInvocations') && levelUp.includes('body.replaceInvocation'), 'LevelUpPage renders the picker and sends picks + swap');
  const sheet = readRepo('client/src/components/CharacterSheet.jsx');
  check(sheet.includes('Eldritch Invocations (') && sheet.includes('/invocations/${character.id}/learn'), 'CharacterSheet shows the invocations and the Learn action');
}

server.close();
console.log(`\n warlock-invocations: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
