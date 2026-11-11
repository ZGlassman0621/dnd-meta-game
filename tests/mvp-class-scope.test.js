// tests/mvp-class-scope.test.js — MVP player-class scope (Zach, 2026-11-08).
//
// Magus, Blackguard and Scholar (classes) plus Monk Warrior of
// Waves (subclass) are GRAYED OUT, not removed: they stay in the
// registries (NPCs/companions can still be them) and are only
// disabled for player characters. Reversible by design — putting
// one back is deleting one line from MVP_DEFERRED_CLASSES
// (classValidationService.js) or MVP_DEFERRED_SUBCLASSES
// (subclassService.js). UNWIND 2026-11-08 (Zach ~19:34 EST):
// Fighter Monster Hunter is OUT of the gray-out — it is a subclass
// and subclasses stay, so it is PC-creatable again everywhere.
//
// Covers, against the real code on a real throwaway DB:
//   (a) service flags: the deferred sets + isClassPcCreatable /
//       isSubclassPcCreatable (display names and keys both resolve;
//       unknown classes/subclasses stay creatable — v1 rule);
//   (a2) GET /api/subclasses still lists every subclass, with the
//       one deferred one flagged pcCreatable: false + note;
//   (c) POST guard: the real character router refuses a deferred
//       class or subclass with a clear error naming it, creates no
//       row, and accepts PC classes, draft placeholders, and unknown
//       classes; PUT guard incl. class_levels; commit refusal (§5);
//   (d) level-up refusal: multiclassing into a deferred class, or
//       picking a deferred subclass at level-up, 400s before the
//       subclass-required 422; level-up-info keeps the deferred
//       options but flags them (never removes them);
//   (e) NPC/companions unaffected: a magus companion and a
//       Warrior-of-Waves companion still create; POST /api/npc
//       is untouched;
//   (f) subclass scope: Warrior of Waves refused at POST/PUT/
//       level-up with 400 naming the subclass, still listed by
//       GET /api/subclasses, companion subclass selection
//       unaffected; Monster Hunter is PC-creatable again (unwound
//       2026-11-08) — POST/PUT/level-up accept it, registry lists
//       it pcCreatable: true.
//   Q10 alias (coordinator decision, 2026-11-08 — reversible,
//       vetoable at the gate): the 2014 spelling 'Way of Waves' is
//       refused exactly like 'Warrior of Waves' (service flag +
//       monk 2->3 level-up); getSubclass still returns null for it
//       (pinned in subclass-scanned4.test.js:157).
//
// Isolated throwaway DB (perception-pre-roll / mvp pattern): temp dir becomes
// CWD before database.js loads, and the runner's shared TURSO env is
// deleted so database.js uses the local file.
import assert from 'node:assert';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mvp-class-scope-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const J = (v) => JSON.stringify(v);

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const classValidation = await import(fromRepo('server/services/classValidationService.js'));
const subclassService = await import(fromRepo('server/services/subclassService.js'));

// The ruling, named literally.
const DEFERRED_CLASSES = ['magus', 'blackguard', 'scholar'];
const PC_CLASSES = ['fighter', 'wizard', 'cleric', 'rogue'];
const DEFERRED_SUBCLASSES = [
  ['monk', 'warrior_of_waves', 'Warrior of Waves'],
];

// --- HTTP harness: the real routers on a real express app -----------------
const app = express();
app.use(express.json());
const subclassesRouter = (await import(fromRepo('server/routes/subclasses.js'))).default;
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const companionRouter = (await import(fromRepo('server/routes/companion.js'))).default;
const npcRouter = (await import(fromRepo('server/routes/npc.js'))).default;
app.use('/api/subclasses', subclassesRouter);
app.use('/api/character', characterRouter);
app.use('/api/companion', companionRouter);
app.use('/api/npc', npcRouter);
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
async function postCharacter(body) { return req('POST', '/api/character', body); }
async function getJson(url) { return req('GET', url); }
async function characterCountByName(name) {
  const row = await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name]);
  return row?.n ?? 0;
}
async function characterClassByName(name) {
  return db.dbGet('SELECT class, subclass, level, class_levels FROM characters WHERE name = ?', [name]);
}
async function makeLeveled({ name, cls, level, xp, subclass = null }) {
  const created = await postCharacter({ name, class: cls, race: 'human' });
  assert(created.status === 201, `fixture POST creates ${name} (${cls}) — got ${created.status}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level,
    experience: xp,
    max_hp: 20,
    current_hp: 20,
    subclass,
    class_levels: J([{ class: cls, level, subclass }]),
  });
  assert(put.status === 200, `fixture PUT sets ${name} to level ${level} (${xp} XP) — got ${put.status}`);
  return id;
}

// ===========================================================================
// (a) Service flags
// ===========================================================================
group('(a) service flags — MVP_DEFERRED_CLASSES + isClassPcCreatable');
{
  check(classValidation.MVP_DEFERRED_CLASSES.size === 3,
    `deferred class set has 3 ids (got ${classValidation.MVP_DEFERRED_CLASSES.size})`);
  for (const id of DEFERRED_CLASSES) {
    check(classValidation.MVP_DEFERRED_CLASSES.has(id), `deferred class set contains ${id}`);
  }
  for (const id of PC_CLASSES) {
    check(!classValidation.MVP_DEFERRED_CLASSES.has(id), `deferred class set does not contain PC class ${id}`);
  }
  check(classValidation.MVP_DEFERRED_CLASS_NOTE === 'Coming after the MVP — NPCs can still be this class.',
    `class note text (got ${JSON.stringify(classValidation.MVP_DEFERRED_CLASS_NOTE)})`);
  for (const id of PC_CLASSES) {
    check(classValidation.isClassPcCreatable(id) === true, `${id} is PC-creatable`);
  }
  for (const id of DEFERRED_CLASSES) {
    check(classValidation.isClassPcCreatable(id) === false, `${id} is NOT PC-creatable`);
  }
  // Normalisation: display case and surrounding whitespace judge by the key.
  check(classValidation.isClassPcCreatable('Magus') === false, "'Magus' (display case) is deferred");
  check(classValidation.isClassPcCreatable('  Scholar ') === false, "'  Scholar  ' (padded) is deferred");
  check(classValidation.isClassPcCreatable('BLACKGUARD') === false, "'BLACKGUARD' is deferred");
  check(classValidation.isClassPcCreatable('something-made-up') === true, 'unknown class stays creatable (v1 no-rejection rule)');
  check(classValidation.isClassPcCreatable('') === true, 'empty class stays creatable');
  check(classValidation.isClassPcCreatable(null) === true, 'null class stays creatable');
}

group('(a2) service flags — MVP_DEFERRED_SUBCLASSES + isSubclassPcCreatable');
{
  check(subclassService.MVP_DEFERRED_SUBCLASSES.size === 1,
    `deferred subclass set has 1 pair (got ${subclassService.MVP_DEFERRED_SUBCLASSES.size})`);
  for (const [cls, key] of DEFERRED_SUBCLASSES.map(([c, k]) => [c, k])) {
    check(subclassService.MVP_DEFERRED_SUBCLASSES.has(`${cls}:${key}`),
      `deferred subclass set contains ${cls}:${key}`);
  }
  check(subclassService.MVP_DEFERRED_SUBCLASS_NOTE === 'Coming after the MVP — NPCs can still be this subclass.',
    `subclass note text (got ${JSON.stringify(subclassService.MVP_DEFERRED_SUBCLASS_NOTE)})`);
  for (const [cls, key, name] of DEFERRED_SUBCLASSES) {
    check(subclassService.isSubclassPcCreatable(cls, name) === false,
      `${cls} '${name}' (display name) is NOT PC-creatable`);
    check(subclassService.isSubclassPcCreatable(cls, key) === false,
      `${cls} '${key}' (key) is NOT PC-creatable`);
  }
  check(subclassService.isSubclassPcCreatable('fighter', 'Champion') === true,
    "fighter 'Champion' stays creatable");
  check(subclassService.isSubclassPcCreatable('monk', 'Way of the Open Hand') === true,
    "monk 'Way of the Open Hand' stays creatable");
  // Q10 alias: the 2014 spelling resolves to the Warrior of Waves
  // entry for the availability check only (the client rename alone
  // does not guard a direct API call — E2E, gray-out joint run).
  check(subclassService.isSubclassPcCreatable('monk', 'Way of Waves') === false,
    "monk 'Way of Waves' (2014 spelling) is NOT PC-creatable — Q10 alias to Warrior of Waves");
  // Same name under the wrong class resolves to null and stays creatable
  // (the guard keys on class + subclass, never on the name alone).
  check(subclassService.isSubclassPcCreatable('ranger', 'Monster Hunter') === true,
    "ranger 'Monster Hunter' is not a registry entry — stays creatable (no silent match)");
  // UNWIND 2026-11-08 (Zach ~19:34 EST): Monster Hunter is a
  // subclass, subclasses stay — it is PC-creatable again.
  check(subclassService.isSubclassPcCreatable('fighter', 'Monster Hunter') === true,
    "fighter 'Monster Hunter' (display name) is PC-creatable again");
  check(subclassService.isSubclassPcCreatable('fighter', 'monster_hunter') === true,
    "fighter 'monster_hunter' (key) is PC-creatable again");
  check(subclassService.isSubclassPcCreatable('fighter', 'Nope') === true,
    'unknown subclass stays creatable (v1 no-rejection rule)');
  check(subclassService.isSubclassPcCreatable('fighter', '') === true, 'empty subclass stays creatable');
  // The served entries carry the flag (mirror of toClientShape).
  // UNWIND 2026-11-08: Monster Hunter lists pcCreatable: true now.
  const mh = subclassService.listSubclasses('fighter').find((e) => e.key === 'monster_hunter');
  check(mh?.pcCreatable === true, 'listSubclasses(fighter) leaves Monster Hunter pcCreatable true');
  check(mh?.pcCreatableNote === null,
    'listSubclasses(fighter) leaves Monster Hunter note null');
  const champ = subclassService.listSubclasses('fighter').find((e) => e.key === 'champion');
  check(champ?.pcCreatable === true, 'listSubclasses(fighter) leaves Champion pcCreatable true');
  check(champ?.pcCreatableNote === null, 'listSubclasses(fighter) leaves Champion note null');
  const wow = subclassService.listSubclasses('monk').find((e) => e.key === 'warrior_of_waves');
  check(wow?.pcCreatable === false, 'listSubclasses(monk) flags Warrior of Waves pcCreatable false');
}

// ===========================================================================
// (a3) GET /api/subclasses — the flag reaches the client, nothing removed
// ===========================================================================
group('(a3) GET /api/subclasses — deferred entries listed + flagged');
{
  const all = await getJson('/api/subclasses');
  check(all.status === 200, `GET /api/subclasses returns 200 (got ${all.status})`);
  const fighterList = all.json?.subclassesByClass?.fighter || [];
  const mh = fighterList.find((e) => e.key === 'monster_hunter');
  check(mh !== undefined, 'GET /api/subclasses still lists Fighter Monster Hunter (not removed)');
  check(mh?.pcCreatable === true, 'GET /api/subclasses leaves Monster Hunter pcCreatable true');
  check(mh?.pcCreatableNote === null,
    'GET /api/subclasses leaves Monster Hunter note null');
  const monkList = all.json?.subclassesByClass?.monk || [];
  const wow = monkList.find((e) => e.key === 'warrior_of_waves');
  check(wow !== undefined, 'GET /api/subclasses still lists Monk Warrior of Waves (not removed)');
  check(wow?.pcCreatable === false, 'GET /api/subclasses flags Warrior of Waves pcCreatable false');
  const champ = fighterList.find((e) => e.key === 'champion');
  check(champ?.pcCreatable === true, 'GET /api/subclasses leaves Champion pcCreatable true');
  const byClass = await getJson('/api/subclasses/fighter');
  check(byClass.status === 200 && byClass.json?.subclasses?.find((e) => e.key === 'monster_hunter')?.pcCreatable === true,
    'GET /api/subclasses/fighter leaves Monster Hunter pcCreatable true');
}

// ===========================================================================
// (c) Character POST / PUT guards — the real router over HTTP
// ===========================================================================
group('(c) POST /api/character class guard');
{
  for (const cls of DEFERRED_CLASSES) {
    const refused = await postCharacter({ name: `Gray ${cls}`, race: 'human', class: cls });
    check(refused.status === 400, `POST ${cls} refused with 400 (got ${refused.status})`);
    check(typeof refused.json?.error === 'string'
      && refused.json.error.includes(`Class ${cls.charAt(0).toUpperCase() + cls.slice(1)} is not available for player characters yet`),
      `${cls} refusal names the class (got ${JSON.stringify(refused.json)})`);
    check(typeof refused.json?.error === 'string' && refused.json.error.includes('Coming after the MVP'),
      `${cls} refusal carries the MVP note`);
    check(!('code' in (refused.json || {})), `${cls} refusal has no code field (species-guard shape)`);
    check(await characterCountByName(`Gray ${cls}`) === 0, `refused ${cls} created no row`);
  }
  // Display case + whitespace normalise to the same refusal.
  const disp = await postCharacter({ name: 'Gray Disp', race: 'human', class: 'Magus' });
  check(disp.status === 400 && String(disp.json?.error || '').includes('Class Magus is not available'),
    `POST 'Magus' (display case) refused naming Magus (got ${disp.status}/${JSON.stringify(disp.json)})`);
  check(await characterCountByName('Gray Disp') === 0, "refused 'Magus' created no row");

  // A deferred subclass on a deferred class reports the class first.
  const both = await postCharacter({ name: 'Gray Both', race: 'human', class: 'magus', subclass: 'The Arcane Order' });
  check(both.status === 400 && String(both.json?.error || '').includes('Class Magus is not available'),
    `POST magus + society refused on the class (got ${both.status}/${JSON.stringify(both.json)})`);

  // PC classes pass; placeholders pass; unknown classes pass (v1 rule).
  const okFighter = await postCharacter({ name: 'Good Fighter', race: 'human', class: 'fighter' });
  check(okFighter.status === 201, `POST fighter accepted with 201 (got ${okFighter.status})`);
  const okWizard = await postCharacter({ name: 'Good Wizard', race: 'human', class: 'wizard' });
  check(okWizard.status === 201, `POST wizard accepted with 201 (got ${okWizard.status})`);
  const okDraft = await postCharacter({ name: 'Good Draft', race: 'human', class: 'creating' });
  check(okDraft.status === 201, `POST class 'creating' (draft placeholder) accepted with 201 (got ${okDraft.status})`);
  const okPrelude = await postCharacter({ name: 'Good Prelude', race: 'human', class: 'prelude' });
  check(okPrelude.status === 201, `POST class 'prelude' accepted with 201 (got ${okPrelude.status})`);
  const okUnknown = await postCharacter({ name: 'Good Unknown', race: 'human', class: 'not-a-class' });
  check(okUnknown.status === 201, `POST unknown class accepted with 201 (got ${okUnknown.status})`);
}

group('(c2) POST /api/character subclass guard');
{
  // UNWIND 2026-11-08: Monster Hunter is PC-creatable again.
  const accepted = await postCharacter({ name: 'Gray MH', race: 'human', class: 'fighter', subclass: 'Monster Hunter' });
  check(accepted.status === 201, `POST fighter/Monster Hunter accepted with 201 (got ${accepted.status})`);
  check(await characterCountByName('Gray MH') === 1, 'accepted Monster Hunter created the row');
  check((await characterClassByName('Gray MH'))?.subclass === 'Monster Hunter', 'accepted Monster Hunter stored the subclass');

  const acceptedKey = await postCharacter({ name: 'Gray MH Key', race: 'human', class: 'fighter', subclass: 'monster_hunter' });
  check(acceptedKey.status === 201 && (await characterClassByName('Gray MH Key'))?.subclass === 'monster_hunter',
    `POST fighter/monster_hunter (key) accepted with 201 and stored verbatim (got ${acceptedKey.status})`);

  const refusedWow = await postCharacter({ name: 'Gray WoW', race: 'human', class: 'monk', subclass: 'Warrior of Waves' });
  check(refusedWow.status === 400, `POST monk/Warrior of Waves refused with 400 (got ${refusedWow.status})`);
  check(typeof refusedWow.json?.error === 'string' && refusedWow.json.error.includes('Subclass Warrior of Waves is not available for player characters yet'),
    `Warrior of Waves refusal names the subclass (got ${JSON.stringify(refusedWow.json)})`);
  check(await characterCountByName('Gray WoW') === 0, 'refused Warrior of Waves created no row');

  // Non-deferred subclasses pass on the same classes.
  const okChamp = await postCharacter({ name: 'Good Champ', race: 'human', class: 'fighter', subclass: 'Champion' });
  check(okChamp.status === 201, `POST fighter/Champion accepted with 201 (got ${okChamp.status})`);
  const okHand = await postCharacter({ name: 'Good Hand', race: 'human', class: 'monk', subclass: 'Way of the Open Hand' });
  check(okHand.status === 201, `POST monk/Way of the Open Hand accepted with 201 (got ${okHand.status})`);
}

group('(c3) PUT /api/character/:id guards — class, subclass, class_levels');
{
  const created = await postCharacter({ name: 'Put Row', race: 'human', class: 'fighter' });
  check(created.status === 201, `PUT fixture row created (got ${created.status})`);
  const id = created.json?.id;
  check(typeof id === 'number', `PUT fixture row has an id (got ${JSON.stringify(created.json?.id)})`);

  const badClass = await req('PUT', `/api/character/${id}`, { class: 'blackguard' });
  check(badClass.status === 400, `PUT class blackguard refused with 400 (got ${badClass.status})`);
  check(typeof badClass.json?.error === 'string' && badClass.json.error.includes('Class Blackguard is not available'),
    `PUT class refusal names Blackguard (got ${JSON.stringify(badClass.json)})`);
  check((await characterClassByName('Put Row'))?.class === 'fighter', 'refused class PUT left the row unchanged');

  // UNWIND 2026-11-08: PUTting Monster Hunter onto a stored fighter passes.
  const okSub = await req('PUT', `/api/character/${id}`, { subclass: 'Monster Hunter' });
  check(okSub.status === 200, `PUT subclass Monster Hunter (stored fighter) accepted with 200 (got ${okSub.status})`);
  check((await characterClassByName('Put Row'))?.subclass === 'Monster Hunter', 'accepted subclass PUT stored Monster Hunter');
  check((await characterClassByName('Put Row'))?.class === 'fighter', 'accepted subclass PUT left the class fighter');

  const badLevels = await req('PUT', `/api/character/${id}`, {
    class_levels: J([{ class: 'fighter', level: 2, subclass: null }, { class: 'scholar', level: 1, subclass: 'Ritualist' }]),
  });
  check(badLevels.status === 400, `PUT class_levels with a scholar secondary refused with 400 (got ${badLevels.status})`);
  check(typeof badLevels.json?.error === 'string' && badLevels.json.error.includes('Class Scholar is not available'),
    `PUT class_levels refusal names Scholar (got ${JSON.stringify(badLevels.json)})`);

  const badLevelsSub = await req('PUT', `/api/character/${id}`, {
    class_levels: J([{ class: 'monk', level: 3, subclass: 'Warrior of Waves' }]),
  });
  check(badLevelsSub.status === 400, `PUT class_levels with a Warrior of Waves entry refused with 400 (got ${badLevelsSub.status})`);
  check(typeof badLevelsSub.json?.error === 'string' && badLevelsSub.json.error.includes('Subclass Warrior of Waves is not available'),
    `PUT class_levels refusal names Warrior of Waves (got ${JSON.stringify(badLevelsSub.json)})`);

  // A plain field PUT is unaffected, and a non-deferred class change passes.
  const plain = await req('PUT', `/api/character/${id}`, { name: 'Put Row Renamed' });
  check(plain.status === 200, `PUT with no class fields is unaffected, 200 (got ${plain.status})`);
  const okClass = await req('PUT', `/api/character/${id}`, { class: 'rogue' });
  check(okClass.status === 200, `PUT class rogue accepted with 200 (got ${okClass.status})`);
  check((await characterClassByName('Put Row Renamed'))?.class === 'rogue', 'accepted class PUT persisted');
}

group('(c4) commit refusal — Stage 6 §5 names the deferred class');
{
  // A bare fighter row cannot commit (missing theme, gear, ...), so the
  // differential is the proof: the same row committed with class
  // 'magus' fails WITH the class refusal, and with class 'fighter'
  // fails WITHOUT it. The §5 check runs either way.
  const created = await postCharacter({ name: 'Commit Row', race: 'human', class: 'fighter' });
  check(created.status === 201, `commit fixture row created (got ${created.status})`);
  const id = created.json?.id;
  const magusCommit = await req('POST', `/api/character/${id}/commit`, { class: 'magus' });
  check(magusCommit.status === 400, `commit with class magus refused with 400 (got ${magusCommit.status})`);
  check(typeof magusCommit.json?.error === 'string' && magusCommit.json.error.includes('Class Magus is not available for player characters yet'),
    `commit refusal names Magus (got ${JSON.stringify(magusCommit.json)})`);
  const fighterCommit = await req('POST', `/api/character/${id}/commit`, { class: 'fighter' });
  check(fighterCommit.status === 400, `commit with class fighter still refuses (other fields), 400 (got ${fighterCommit.status})`);
  check(typeof fighterCommit.json?.error === 'string' && !fighterCommit.json.error.includes('is not available for player characters yet'),
    `fighter commit refusal is NOT a class-scope refusal (got ${JSON.stringify(fighterCommit.json)})`);
  // UNWIND 2026-11-08: commit with Monster Hunter is NOT a
  // subclass-scope refusal (the bare row still 400s on other fields).
  const subCommit = await req('POST', `/api/character/${id}/commit`, { class: 'fighter', subclass: 'Monster Hunter' });
  check(subCommit.status === 400 && !String(subCommit.json?.error || '').includes('Subclass Monster Hunter is not available for player characters yet'),
    `commit with subclass Monster Hunter is NOT a subclass-scope refusal (got ${subCommit.status}/${JSON.stringify(subCommit.json)})`);
}

// ===========================================================================
// (d) Level-up — refusal over real HTTP, options flagged not removed
// ===========================================================================
group('(d) POST /level-up refuses multiclass into a deferred class');
{
  for (const [display, key] of [['Magus', 'magus'], ['Blackguard', 'blackguard'], ['Scholar', 'scholar']]) {
    const fighter = await makeLeveled({ name: `Level ${key}`, cls: 'fighter', level: 1, xp: 300 });
    const attempt = await req('POST', `/api/character/level-up/${fighter}`, { selectedClass: display });
    check(attempt.status === 400, `level-up into ${display} refused with 400 (got ${attempt.status})`);
    check(typeof attempt.json?.error === 'string' && attempt.json.error.includes(`Class ${display} is not available for player characters yet`),
      `level-up into ${display} names the class (got ${JSON.stringify(attempt.json)})`);
    const row = await db.dbGet('SELECT level, class_levels FROM characters WHERE id = ?', [fighter]);
    check(row?.level === 1, `refused level-up into ${display} left the level at 1`);
    check(!String(row?.class_levels || '').toLowerCase().includes(`"${key}"`),
      `refused level-up into ${display} added no ${key} entry`);
  }
  // Even WITH a subclass, the class refusal fires first (not the 422).
  const fighterSub = await makeLeveled({ name: 'Level Scholar Sub', cls: 'fighter', level: 1, xp: 300 });
  const withSub = await req('POST', `/api/character/level-up/${fighterSub}`, { selectedClass: 'Scholar', subclass: 'Ritualist' });
  check(withSub.status === 400 && String(withSub.json?.error || '').includes('Class Scholar is not available'),
    `level-up into Scholar WITH a subclass still 400s on the class (got ${withSub.status})`);
  // Multiclass into a PC class still works.
  const fighterOk = await makeLeveled({ name: 'Level Cleric', cls: 'fighter', level: 1, xp: 300 });
  const ok = await req('POST', `/api/character/level-up/${fighterOk}`, { selectedClass: 'Cleric' });
  check(ok.status === 200, `level-up into Cleric still succeeds with 200 (got ${ok.status})`);
}

group('(d2) POST /level-up refuses a deferred subclass pick');
{
  // UNWIND 2026-11-08: fighter 2->3 picking Monster Hunter passes.
  const fighter = await makeLeveled({ name: 'Level MH', cls: 'fighter', level: 2, xp: 900 });
  const mh = await req('POST', `/api/character/level-up/${fighter}`, { subclass: 'Monster Hunter' });
  check(mh.status === 200, `fighter 2->3 with Monster Hunter succeeds with 200 (got ${mh.status})`);
  const mhRow = await db.dbGet('SELECT level, subclass FROM characters WHERE id = ?', [fighter]);
  check(mhRow?.level === 3, 'accepted Monster Hunter level-up left the level at 3');
  check(mhRow?.subclass === 'Monster Hunter', 'accepted Monster Hunter level-up stored the subclass');

  const monk = await makeLeveled({ name: 'Level WoW', cls: 'monk', level: 2, xp: 900 });
  const wow = await req('POST', `/api/character/level-up/${monk}`, { subclass: 'Warrior of Waves' });
  check(wow.status === 400, `monk 2->3 with Warrior of Waves refused with 400 (got ${wow.status})`);
  check(typeof wow.json?.error === 'string' && wow.json.error.includes('Subclass Warrior of Waves is not available for player characters yet'),
    `Warrior of Waves level-up refusal names the subclass (got ${JSON.stringify(wow.json)})`);

  // Q10 alias over HTTP: the old spelling refuses exactly like the
  // 2024 name — a direct API call must not level a monk into it.
  const monkOld = await makeLeveled({ name: 'Level Old Name', cls: 'monk', level: 2, xp: 900 });
  const old = await req('POST', `/api/character/level-up/${monkOld}`, { subclass: 'Way of Waves' });
  check(old.status === 400, `monk 2->3 with 'Way of Waves' (2014 spelling) refused with 400 (got ${old.status})`);
  check(typeof old.json?.error === 'string' && old.json.error.includes('Subclass Way of Waves is not available for player characters yet'),
    `'Way of Waves' level-up refusal names the subclass (got ${JSON.stringify(old.json)})`);
  const oldRow = await db.dbGet('SELECT level FROM characters WHERE id = ?', [monkOld]);
  check(oldRow?.level === 2, "refused 'Way of Waves' level-up left the level at 2");

  // A non-deferred subclass at the same level still succeeds.
  const fighterOk = await makeLeveled({ name: 'Level Champ', cls: 'fighter', level: 2, xp: 900 });
  const ok = await req('POST', `/api/character/level-up/${fighterOk}`, { subclass: 'Champion' });
  check(ok.status === 200, `fighter 2->3 with Champion still succeeds with 200 (got ${ok.status})`);
}

group('(d3) GET level-up-info — deferred options flagged, not removed');
{
  const fighter = await makeLeveled({ name: 'Info Fighter', cls: 'fighter', level: 1, xp: 300 });
  const info = await getJson(`/api/character/level-up-info/${fighter}`);
  check(info.status === 200, `level-up-info loads (got ${info.status})`);
  const opts = info.json?.classOptions || [];
  const findMulti = (cls) => opts.find((o) => o.type === 'multiclass' && String(o.class).toLowerCase() === cls);
  for (const cls of ['magus', 'scholar']) {
    const opt = findMulti(cls);
    check(opt !== undefined, `level-up-info still offers ${cls} (flagged, not removed)`);
    check(opt?.pcCreatable === false, `level-up-info flags ${cls} pcCreatable false`);
    check(opt?.pcCreatableNote === classValidation.MVP_DEFERRED_CLASS_NOTE,
      `level-up-info flags ${cls} with the MVP note`);
    check(opt?.choices?.needsSubclass === true, `level-up-info ${cls} option still prompts for a subclass`);
  }
  // Blackguard IS offered now (2026-11-08: prerequisites removed, so
  // the missing requirements key no longer hides it) — flagged
  // pcCreatable false like magus/scholar, and the POST guard is its
  // refusal.
  check(findMulti('blackguard') !== undefined, 'level-up-info offers blackguard (flagged, not removed)');
  check(findMulti('blackguard')?.pcCreatable === false, 'level-up-info flags blackguard pcCreatable false');
  const wizardOpt = findMulti('wizard');
  check(wizardOpt?.pcCreatable === true, 'level-up-info leaves wizard pcCreatable true');
  check(wizardOpt?.pcCreatableNote === null, 'level-up-info leaves wizard note null');
}

// ===========================================================================
// (e) NPC / companions unaffected
// ===========================================================================
group('(e) NPCs and companions keep the deferred classes/subclasses');
{
  const recruiter = await postCharacter({ name: 'Recruiter', race: 'human', class: 'fighter' });
  check(recruiter.status === 201, `recruiter PC created (got ${recruiter.status})`);
  const recruiterId = recruiter.json?.id;

  const magusComp = await req('POST', '/api/companion/create-party-member', {
    recruited_by_character_id: recruiterId, name: 'Magus Ally', race: 'human', companion_class: 'magus',
  });
  check(magusComp.status === 201, `companion with companion_class 'magus' still creates with 201 (got ${magusComp.status}: ${JSON.stringify(magusComp.json)})`);

  const wowComp = await req('POST', '/api/companion/create-party-member', {
    recruited_by_character_id: recruiterId, name: 'Waves Ally', race: 'elf',
    companion_class: 'monk', companion_subclass: 'Warrior of Waves',
  });
  check(wowComp.status === 201, `companion with subclass 'Warrior of Waves' still creates with 201 (got ${wowComp.status}: ${JSON.stringify(wowComp.json)})`);

  const mhComp = await req('POST', '/api/companion/create-party-member', {
    recruited_by_character_id: recruiterId, name: 'Hunter Ally', race: 'human',
    companion_class: 'fighter', companion_subclass: 'Monster Hunter',
  });
  check(mhComp.status === 201, `companion with subclass 'Monster Hunter' still creates with 201 (got ${mhComp.status}: ${JSON.stringify(mhComp.json)})`);

  const npc = await req('POST', '/api/npc', { name: 'Gray NPC', race: 'human' });
  check(npc.status === 201, `POST /api/npc unaffected with 201 (got ${npc.status})`);
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n mvp-class-scope: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
