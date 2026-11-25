// tests/keeper-removal.test.js — the Keeper class is REMOVED from the
// game (Zach, 2026-11-25; class-audit-severe-seven amendment to item
// 9). Its design documents are lost and its 8 genre-bonus texts exist
// nowhere, so the class is taken out instead of finished.
//
// What this pins:
//   (a) the registries: classes.json no longer lists keeper; the
//       server's REMOVED_CLASSES holds it; it is not PC-creatable;
//       no validator, chassis, package or SUBCLASS_LEVELS row knows it.
//   (b) the server refuses it (400) on every PC path: POST create
//       (with and without the creator marker), PUT class change, PUT
//       class_levels, level-up of a held keeper row, multiclass into
//       keeper, and the spells route. Level-up-info offers no keeper
//       multiclass option.
//   (c) nothing client- or prompt-side is wired to it: LevelUpPage
//       has no keeper branch and imports neither keeper data file;
//       the DM prompt has no keeper section.
//   (d) the data is KEPT, unwired, so the class can come back:
//       keeperTexts.js, keeperClass.json (genre domains, subclasses),
//       migration 020 and the keeper_* DB columns.

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'keeper-removal-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;
const readRepo = (rel) => fs.readFileSync(path.join(origCwd, rel), 'utf8');

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const classValidation = await import(fromRepo('server/services/classValidationService.js'));
const { SUBCLASS_LEVELS } = await import(fromRepo('server/config/levelProgression.js'));
const { CLASS_CHASSIS } = await import(fromRepo('server/data/classChassis.js'));
const { STARTING_PACKAGES } = await import(fromRepo('server/data/startingPackages.js'));
const { validateCreatorNextStage2 } = await import(fromRepo('server/routes/character.js'));
const classes = JSON.parse(readRepo('client/src/data/classes.json'));

const app = express();
app.use(express.json());
app.use('/api/character', (await import(fromRepo('server/routes/character.js'))).default);
app.use('/api/spells', (await import(fromRepo('server/routes/spells.js'))).default);
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
const countByName = async (name) => (await db.dbGet('SELECT COUNT(*) AS n FROM characters WHERE name = ?', [name])).n;
const removedMsg = (r) => typeof r.json?.error === 'string' && r.json.error.includes('removed from the game');

group('(a) registries');
{
  check(!('keeper' in classes), 'classes.json does not list keeper');
  check(Object.keys(classes).length === 22, `classes.json holds 22 classes (got ${Object.keys(classes).length})`);
  check(classValidation.REMOVED_CLASSES.has('keeper') && classValidation.REMOVED_CLASSES.size === 1,
    'REMOVED_CLASSES is exactly {keeper}');
  check(classValidation.isClassRemoved('Keeper') && classValidation.isClassRemoved('  keeper '), 'isClassRemoved normalises case/padding');
  check(!classValidation.isClassRemoved('fighter'), 'fighter is not removed');
  check(classValidation.isClassPcCreatable('keeper') === false, 'keeper is not PC-creatable');
  check(classValidation.classUnavailableNote('keeper') === classValidation.REMOVED_CLASS_NOTE, 'keeper gets the removed note');
  check(classValidation.classUnavailableNote('magus') === classValidation.MVP_DEFERRED_CLASS_NOTE, 'magus keeps the MVP note');
  check(!classValidation.MVP_DEFERRED_CLASSES.has('keeper'), 'keeper is not in the MVP-deferred set (removed, not deferred)');
  check(!classValidation.KNOWN_CLASSES.includes('keeper'), 'keeper is not a KNOWN_CLASS');
  check(validateCreatorNextStage2({ classId: 'keeper' }).ok === false, 'Stage 2 validator refuses keeper');
  check(!('keeper' in CLASS_CHASSIS), 'class chassis has no keeper row');
  check(!('keeper' in STARTING_PACKAGES), 'no keeper starting package');
  check(!('keeper' in SUBCLASS_LEVELS), 'SUBCLASS_LEVELS has no keeper row');
  const generated = JSON.parse(readRepo('client/src/data/spellCatalog.generated.json'));
  check(!('keeper' in generated.level1ByClass), 'generated spell catalog has no keeper row');
}

group('(b) server refuses keeper for player characters (400)');
{
  const plain = await req('POST', '/api/character', { name: 'KR Plain', class: 'keeper', race: 'human' });
  check(plain.status === 400 && removedMsg(plain), `POST class keeper: 400 naming the removal (got ${plain.status} ${JSON.stringify(plain.json)})`);
  check(await countByName('KR Plain') === 0, 'refused POST created no row');

  const display = await req('POST', '/api/character', { name: 'KR Display', class: 'Keeper', race: 'human' });
  check(display.status === 400, `POST class 'Keeper' (display case): 400 (got ${display.status})`);

  const marker = await req('POST', '/api/character', { name: 'KR Marker', class: 'keeper', race: 'human', creator: 'creator-next' });
  check(marker.status === 400, `POST creator-next + keeper: 400 (got ${marker.status})`);
  check(await countByName('KR Marker') === 0, 'refused creator-next POST created no row');

  const fighter = await req('POST', '/api/character', { name: 'KR Fighter', class: 'fighter', race: 'human' });
  check(fighter.status === 201, `fighter POST still 201 (got ${fighter.status})`);
  const fid = fighter.json.id;

  const putClass = await req('PUT', `/api/character/${fid}`, { class: 'keeper' });
  check(putClass.status === 400 && removedMsg(putClass), `PUT class keeper: 400 (got ${putClass.status})`);
  const putLevels = await req('PUT', `/api/character/${fid}`, { class_levels: JSON.stringify([{ class: 'fighter', level: 1 }, { class: 'keeper', level: 1 }]) });
  check(putLevels.status === 400, `PUT class_levels with keeper: 400 (got ${putLevels.status})`);
  const row = await db.dbGet('SELECT class FROM characters WHERE id = ?', [fid]);
  check(row.class === 'fighter', `refused PUTs left the class as fighter (got ${row.class})`);

  // Level-up info: no keeper multiclass option.
  await req('PUT', `/api/character/${fid}`, { experience: 300 });
  const info = await req('GET', `/api/character/level-up-info/${fid}`);
  check(info.status === 200, `level-up-info 200 (got ${info.status})`);
  const opts = info.json?.classOptions || [];
  check(opts.length > 0, 'level-up-info lists class options');
  check(!opts.some((o) => String(o.class).toLowerCase() === 'keeper'), 'no keeper option in level-up-info');

  // Multiclass into keeper is refused.
  const multi = await req('POST', `/api/character/level-up/${fid}`, { selectedClass: 'Keeper' });
  check(multi.status === 400 && removedMsg(multi), `multiclass into keeper: 400 (got ${multi.status} ${JSON.stringify(multi.json)})`);
  const afterMulti = await db.dbGet('SELECT level FROM characters WHERE id = ?', [fid]);
  check(afterMulti.level === 1, 'refused multiclass left the level at 1');

  // A keeper row that predates the removal (written straight to the
  // DB — no route can make one now) cannot level up either.
  const legacy = await req('POST', '/api/character', { name: 'KR Legacy', class: 'fighter', race: 'human' });
  const lid = legacy.json.id;
  await db.dbRun("UPDATE characters SET class = 'keeper', class_levels = ?, experience = 300 WHERE id = ?",
    [JSON.stringify([{ class: 'keeper', level: 1, subclass: null }]), lid]);
  const legacyUp = await req('POST', `/api/character/level-up/${lid}`, {});
  check(legacyUp.status === 400 && removedMsg(legacyUp), `level-up of a held keeper: 400 (got ${legacyUp.status} ${JSON.stringify(legacyUp.json)})`);

  const spells = await req('GET', '/api/spells?class=keeper&level=1');
  check(spells.status === 400, `GET /api/spells keeper: 400 unknown class (got ${spells.status})`);
}

group('(c) nothing is wired to the keeper');
{
  const levelUp = readRepo('client/src/components/LevelUpPage.jsx');
  check(!/keeper/i.test(levelUp), 'LevelUpPage has no keeper reference (UI, state, body fields, imports)');
  const clientSrc = (dir) => fs.readdirSync(path.join(origCwd, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return clientSrc(rel);
    return /\.(jsx?|mjs)$/.test(e.name) ? [rel] : [];
  });
  const importers = clientSrc('client/src').filter((f) => /keeperTexts|keeperClass/.test(readRepo(f)));
  check(importers.length === 0, `no client source imports keeperTexts.js / keeperClass.json (got ${importers.join(', ')})`);
  const dmPrompt = readRepo('server/services/dmPromptBuilder.js');
  check(!dmPrompt.includes('keeper_texts') && !dmPrompt.includes('KEEPER RULES'), 'DM prompt has no keeper section');
  const route = readRepo('server/routes/character.js');
  check(!route.includes('keeperWrites') && !route.includes('keeperNewTexts'), 'level-up route has no keeper write branch');
  for (const f of ['client/src/components/PartyBuilder.jsx', 'client/src/components/CompanionSheet.jsx']) {
    check(!readRepo(f).includes("'Keeper'"), `${f} class list has no Keeper`);
  }
}

group('(d) keeper data is kept, unwired');
{
  const texts = await import(fromRepo('client/src/data/keeperTexts.js'));
  check(Array.isArray(texts.RECITATIONS) && texts.RECITATIONS.length > 0, 'keeperTexts.js still exports RECITATIONS');
  check(Array.isArray(texts.STANDARD_TEXTS) && Array.isArray(texts.RARE_TEXTS), 'keeperTexts.js still exports the texts');
  const kc = JSON.parse(readRepo('client/src/data/keeperClass.json'));
  check(kc.name === 'Keeper', 'keeperClass.json holds the former classes.json entry');
  check(kc.genreDomains?.length === 8, `keeperClass.json keeps the 8 genre domains (got ${kc.genreDomains?.length})`);
  check(kc.subclasses?.length === 4, `keeperClass.json keeps the 4 subclasses (got ${kc.subclasses?.length})`);
  check(kc.subclassLevel === 6 && kc.keeperAbilities && kc.polymathTrack, 'keeperClass.json keeps subclassLevel, keeperAbilities, polymathTrack');
  check(fs.existsSync(path.join(origCwd, 'server/migrations/020_keeper_class.js')), 'migration 020_keeper_class.js is kept');
  const cols = (await db.dbAll('PRAGMA table_info(characters)')).map((c) => c.name);
  for (const c of ['keeper_texts', 'keeper_recitations', 'keeper_genre_domain', 'keeper_genre_domain_2', 'keeper_genre_mastery', 'keeper_specialization']) {
    check(cols.includes(c), `DB column ${c} is kept`);
  }
}

server.close();
console.log(`\n keeper-removal: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
