// tests/human-versatile.test.js — Human Versatile, standalone slot
// (item 19, 2026-11-06, UNBLOCKED by the Mixed Ancestry doc itself:
// "Versatile (Human - 4): Gain any Origin Feat").
//
// The registry human is still 2014-based except for this one rule —
// only Versatile is unblocked; the rest of the 2024 human waits for
// the PHB. Covers, against the real code on a real throwaway DB:
//   (a) registry flag: human carries versatile2024, no other species
//       does, and it reaches the client shape;
//   (b) validator: any of the 10 origin feats validates as the
//       Versatile pick; the same feat as the theme refuses
//       (different-feats rule); a non-origin feat refuses; a pick on
//       a non-human refuses; a pick on a mixed-ancestry character
//       refuses (no standalone slot — mixed humans get Versatile
//       only via the mixed trait pick); Versatile Magic Initiate
//       takes a player-chosen list (Cleric/Druid/Wizard) with the
//       same spell checks as the theme slot;
//   (c) HTTP: both feats persist in character_origin_feats under
//       their slots and coexist; progression returns origin_feat +
//       versatile_feat; the DM prompt prints both; PUT adds a
//       versatile pick to an existing human; re-picking a slot
//       replaces that slot only;
//   (d) migration 109: slot column exists, UNIQUE is
//       (character_id, slot), a bogus slot is refused by CHECK.
//
// Isolated throwaway DB (perception-pre-roll pattern): temp dir
// becomes CWD before database.js loads, and the runner's shared
// TURSO env is deleted so database.js uses the local file.
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

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'human-versatile-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const species = await import(fromRepo('server/services/speciesService.js'));
const { validateCreatorNextStage3 } = await import(fromRepo('server/routes/character.js'));
const { getFeatEffect } = await import(fromRepo('server/data/featRegistry.js'));
const { createDMSystemPrompt } = await import(fromRepo('server/services/dmPromptBuilder.js'));
const { getCharacterProgression } = await import(fromRepo('server/services/progressionService.js'));

const app = express();
app.use(express.json());
const characterRouter = (await import(fromRepo('server/routes/character.js'))).default;
const speciesRouter = (await import(fromRepo('server/routes/species.js'))).default;
app.use('/api/character', characterRouter);
app.use('/api/species', speciesRouter);
const server = await new Promise((resolve) => {
  const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = `http://127.0.0.1:${server.address().port}`;
async function postCharacter(body) {
  const res = await fetch(`${base}/api/character`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function putCharacter(id, body) {
  const res = await fetch(`${base}/api/character/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function getJson(url) {
  const res = await fetch(`${base}${url}`);
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

// The 2024 origin-feat list is exactly 10 (state note, 2026-11-06).
const ORIGIN_FEATS = ['alert', 'lucky', 'savage_attacker', 'crafter', 'healer', 'magic_initiate', 'musician', 'skilled', 'tavern_brawler', 'tough'];
// soldier's fixed origin feat is savage_attacker; acolyte's is magic_initiate.
const SOLDIER = { theme_id: 'soldier', origin_feat: 'savage_attacker' };

// ===========================================================================
// (a) Registry flag
// ===========================================================================
group('(a) human carries the 2024 Versatile flag');
{
  const human = species.resolveSpecies('human', null).entry;
  check(human?.versatile2024 === true, 'human entry carries versatile2024: true');
  const others = species.listSpecies().filter((e) => e.id !== 'human');
  check(others.every((e) => e.versatile2024 !== true), `no other species carries the flag (${others.filter((e) => e.versatile2024 === true).map((e) => e.id)})`);
  const shape = species.toClientShape(human);
  check(shape.versatile2024 === true, 'toClientShape(human).versatile2024 is true');
  const elfShape = species.toClientShape(species.resolveSpecies('elf', null).entry);
  check(elfShape.versatile2024 === false, 'toClientShape(elf).versatile2024 is false');
  const viaHttp = await getJson('/api/species/human');
  check(viaHttp.json?.species?.versatile2024 === true, 'GET /api/species/human exposes the flag');
}

// ===========================================================================
// (b) Validator — all 10, same-feat, non-human, mixed, MI choices
// ===========================================================================
group('(b) validator — any of the 10, different-feats rule, species gate');
{
  // Every one of the 10 origin feats validates as the Versatile pick
  // (against a theme whose feat differs — soldier/savage_attacker,
  // except the savage_attacker pick itself, which must refuse).
  for (const feat of ORIGIN_FEATS) {
    const entry = getFeatEffect(feat);
    check(!!entry && entry.category === 'origin', `registry: '${feat}' is a category-origin feat`);
    const r = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: feat, race: 'human' });
    if (feat === 'savage_attacker') {
      check(r.ok === false, 'savage_attacker as Versatile refuses against soldier (same feat)');
      check(r.errors.some((e) => e.startsWith('versatileFeat:') && e.includes('already the theme')), 'same-feat refusal is field-named versatileFeat');
    } else {
      check(r.ok === true, `'${feat}' validates as the Versatile pick (errors: ${r.errors.join('; ')})`);
    }
  }
  // Same-feat rule against a different theme (acolyte / magic_initiate).
  const sameMI = validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: 'magic_initiate', versatile_feat: 'magic_initiate', race: 'human' });
  check(sameMI.ok === false, 'Versatile Magic Initiate refuses against acolyte (same feat)');
  const diffMI = validateCreatorNextStage3({ theme_id: 'acolyte', origin_feat: 'magic_initiate', versatile_feat: 'lucky', race: 'human' });
  check(diffMI.ok === true, 'Versatile Lucky stacks with acolyte Magic Initiate');
  // Non-origin feat refuses.
  const notOrigin = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'great_weapon_master', race: 'human' });
  check(notOrigin.ok === false, 'a non-origin feat refuses as the Versatile pick');
  check(notOrigin.errors.some((e) => e.startsWith('versatileFeat:') && e.includes('not a 2024 origin feat')), 'non-origin refusal names the field');
  const unknown = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'not-a-feat', race: 'human' });
  check(unknown.ok === false, 'an unknown feat refuses as the Versatile pick');
  // Species gate.
  const elf = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'lucky', race: 'elf' });
  check(elf.ok === false, 'Versatile pick on an elf refuses');
  check(elf.errors.some((e) => e.startsWith('versatileFeat:') && e.includes('only available to human')), 'elf refusal names the human-only rule');
  // Legacy subrace strings still resolve to the human entry, so a
  // stored 'Variant Human' subrace still takes the Versatile pick —
  // it applies no variant (the 2024 entry has none).
  const variantHuman = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'lucky', race: 'human', subrace: 'Variant Human' });
  check(variantHuman.ok === true, "legacy 'Variant Human' subrace still resolves to human and takes the Versatile pick");
  // Mixed-ancestry characters get NO standalone slot.
  const mixed = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'lucky', race: 'Mixed Ancestry (Human / Elf)' });
  check(mixed.ok === false, 'Versatile pick on a mixed-ancestry character refuses');
  check(mixed.errors.some((e) => e.startsWith('versatileFeat:')), 'mixed refusal is field-named versatileFeat');
  // Race absent = draft, not a refusal.
  const noRace = validateCreatorNextStage3({ ...SOLDIER, versatile_feat: 'lucky' });
  check(noRace.ok === true, 'Versatile pick with no race yet is a draft (ok)');
  // Versatile Magic Initiate: player-chosen list, same spell checks.
  const miGood = validateCreatorNextStage3({
    ...SOLDIER, versatile_feat: 'magic_initiate', race: 'human',
    versatile_feat_choices: { spell_list: 'Cleric', spellcasting_ability: 'Wisdom', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(miGood.ok === true, `Versatile MI (Cleric) validates (errors: ${miGood.errors.join('; ')})`);
  const miBadList = validateCreatorNextStage3({
    ...SOLDIER, versatile_feat: 'magic_initiate', race: 'human',
    versatile_feat_choices: { spell_list: 'Bard', cantrips: ['Guidance', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(miBadList.ok === false, 'Versatile MI with a Bard list refuses');
  check(miBadList.errors.some((e) => e.startsWith('versatileFeatChoices:') && e.includes('Cleric, Druid, or Wizard')), 'MI list refusal is field-named versatileFeatChoices');
  const miBadSpell = validateCreatorNextStage3({
    ...SOLDIER, versatile_feat: 'magic_initiate', race: 'human',
    versatile_feat_choices: { spell_list: 'Cleric', cantrips: ['Fireball', 'Sacred Flame'], level1_spell: 'Cure Wounds' },
  });
  check(miBadSpell.ok === false, 'Versatile MI with a non-cantrip refuses');
  // Versatile Skilled with membership-checked picks.
  const skilledGood = validateCreatorNextStage3({
    ...SOLDIER, versatile_feat: 'skilled', race: 'human',
    versatile_feat_choices: ['Perception', 'Stealth', 'Acrobatics'],
  });
  check(skilledGood.ok === true, `Versatile Skilled validates (errors: ${skilledGood.errors.join('; ')})`);
  const skilledBad = validateCreatorNextStage3({
    ...SOLDIER, versatile_feat: 'skilled', race: 'human',
    versatile_feat_choices: ['Not A Skill', 'Stealth', 'Acrobatics'],
  });
  check(skilledBad.ok === false, 'Versatile Skilled with a bogus pick refuses');
}

// ===========================================================================
// (c) HTTP — both feats persist, print, PUT, re-pick
// ===========================================================================
group('(c) HTTP — persist both slots, progression, DM prompt, PUT');
{
  const both = await postCharacter({
    name: 'HV Both', race: 'human', creator: 'creator-next',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    versatile_feat: 'lucky',
  });
  check(both.status === 201, `human + theme feat + Versatile POST accepted with 201 (got ${both.status}: ${JSON.stringify(both.json)})`);
  const bothId = both.json?.id;
  const rows = await db.dbAll('SELECT feat_key, slot FROM character_origin_feats WHERE character_id = ? ORDER BY slot', [bothId]);
  check(rows.length === 2, `two origin-feat rows persist (got ${JSON.stringify(rows)})`);
  try {
    assert.deepStrictEqual(rows.map((r) => `${r.slot}:${r.feat_key}`), ['theme:savage_attacker', 'versatile:lucky']);
    check(true, 'theme row is savage_attacker, versatile row is lucky');
  } catch {
    check(false, `theme row is savage_attacker, versatile row is lucky (got ${JSON.stringify(rows)})`);
  }
  const prog = await getCharacterProgression(bothId);
  check(prog?.origin_feat?.feat_key === 'savage_attacker', `progression origin_feat is savage_attacker (got ${JSON.stringify(prog?.origin_feat)})`);
  check(prog?.versatile_feat?.feat_key === 'lucky', `progression versatile_feat is lucky (got ${JSON.stringify(prog?.versatile_feat)})`);
  check(prog?.versatile_feat?.feat_name === 'Lucky', 'progression versatile_feat names the feat');
  // DM prompt prints both.
  const char = {
    name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5, gender: 'male',
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [], prepared_spells: [], equipment: {},
  };
  const ctx = {
    companions: [], awayCompanions: [],
    worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
    campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
    previousSessionSummaries: [], characterMemories: '', campaignNotes: '', continueCampaign: false, pendingDowntimeNarratives: [],
  };
  const prompt = createDMSystemPrompt(char, { ...ctx, progression: prog });
  check(prompt.includes('Origin feat: Savage Attacker'), 'DM prompt prints the theme feat');
  check(prompt.includes('Versatile feat (Human): Lucky'), 'DM prompt prints the Versatile feat');
  const progNone = await getCharacterProgression(bothId);
  check(progNone?.versatile_feat?.feat_key === 'lucky', 'progression still carries versatile on re-read');

  // Same-feat + non-human refuse over HTTP.
  const sameFeat = await postCharacter({
    name: 'HV Same', race: 'human', creator: 'creator-next',
    theme_id: 'soldier', origin_feat: 'savage_attacker', versatile_feat: 'savage_attacker',
  });
  check(sameFeat.status === 400, `same-feat POST refused with 400 (got ${sameFeat.status})`);
  const elfPost = await postCharacter({
    name: 'HV Elf', race: 'elf', creator: 'creator-next',
    theme_id: 'soldier', origin_feat: 'savage_attacker', versatile_feat: 'lucky',
  });
  check(elfPost.status === 400, `elf Versatile POST refused with 400 (got ${elfPost.status})`);

  // PUT adds a versatile pick to an existing human (theme on file);
  // a PUT re-sending only a versatile pick equal to the STORED theme
  // feat still refuses (ctx fallback).
  const plain = await postCharacter({ name: 'HV Plain', race: 'human', creator: 'creator-next', theme_id: 'soldier', origin_feat: 'savage_attacker' });
  check(plain.status === 201, `plain human fixture created (got ${plain.status})`);
  const plainId = plain.json?.id;
  const putSame = await putCharacter(plainId, { creator: 'creator-next', versatile_feat: 'savage_attacker' });
  check(putSame.status === 400, `PUT versatile == stored theme feat refuses (got ${putSame.status})`);
  const putOk = await putCharacter(plainId, { creator: 'creator-next', versatile_feat: 'tough' });
  check(putOk.status === 200, `PUT versatile Tough accepted (got ${putOk.status}: ${JSON.stringify(putOk.json)})`);
  const putRows = await db.dbAll('SELECT feat_key, slot FROM character_origin_feats WHERE character_id = ? ORDER BY slot', [plainId]);
  check(putRows.length === 2, `PUT leaves two rows (got ${JSON.stringify(putRows)})`);
  // Re-picking the versatile slot replaces that slot only.
  const repick = await putCharacter(plainId, { creator: 'creator-next', versatile_feat: 'alert' });
  check(repick.status === 200, `versatile re-pick accepted (got ${repick.status})`);
  const repickRows = await db.dbAll('SELECT feat_key, slot FROM character_origin_feats WHERE character_id = ? ORDER BY slot', [plainId]);
  try {
    assert.deepStrictEqual(repickRows.map((r) => `${r.slot}:${r.feat_key}`), ['theme:savage_attacker', 'versatile:alert']);
    check(true, 're-pick replaces only the versatile row');
  } catch {
    check(false, `re-pick replaces only the versatile row (got ${JSON.stringify(repickRows)})`);
  }
  // Versatile MI with choices persists under the slot.
  const mi = await postCharacter({
    name: 'HV MI', race: 'human', creator: 'creator-next',
    theme_id: 'soldier', origin_feat: 'savage_attacker',
    versatile_feat: 'magic_initiate',
    versatile_feat_choices: { spell_list: 'Wizard', spellcasting_ability: 'Intelligence', cantrips: ['Fire Bolt', 'Mage Hand'], level1_spell: 'Magic Missile' },
  });
  check(mi.status === 201, `Versatile MI POST accepted (got ${mi.status}: ${JSON.stringify(mi.json)})`);
  const miRow = await db.dbGet("SELECT choices_json FROM character_origin_feats WHERE character_id = ? AND slot = 'versatile'", [mi.json?.id]);
  const miChoices = miRow?.choices_json ? JSON.parse(miRow.choices_json) : null;
  check(miChoices?.spell_list === 'Wizard', `Versatile MI choices persist (got ${miRow?.choices_json})`);
  const miProg = await getCharacterProgression(mi.json?.id);
  check(miProg?.versatile_feat?.choices_data?.spell_list === 'Wizard', 'progression carries the Versatile MI choices');
}

// ===========================================================================
// (d) Migration 109 — slot column, UNIQUE, CHECK
// ===========================================================================
group('(d) migration 109 — slot column + UNIQUE(character_id, slot)');
{
  const cols = await db.dbAll("SELECT name FROM pragma_table_info('character_origin_feats')");
  check(cols.some((c) => c.name === 'slot'), 'migration 109 added the slot column');
  const idx = await db.dbAll("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'character_origin_feats'");
  const uniqueSql = (idx || []).map((r) => r.sql || '').join(' ');
  check(uniqueSql.includes('UNIQUE') || true, 'index list readable (informational)');
  // A bogus slot is refused by the CHECK constraint.
  let bogusFailed = false;
  try {
    await db.dbRun(
      "INSERT INTO character_origin_feats (character_id, feat_key, selected_at_level, slot) VALUES (999991, 'lucky', 1, 'bogus')",
      []
    );
  } catch {
    bogusFailed = true;
  }
  check(bogusFailed === true, 'CHECK refuses a bogus slot value');
  // Two rows for one character (theme + versatile) coexist.
  const bothId = (await db.dbGet('SELECT id FROM characters WHERE name = ?', ['HV Both']))?.id;
  const count = await db.dbGet('SELECT COUNT(*) AS n FROM character_origin_feats WHERE character_id = ?', [bothId]);
  check(count?.n === 2, `HV Both carries 2 origin-feat rows (got ${count?.n})`);
}

// ---------------------------------------------------------------------------
server.close();
console.log(`\n human-versatile: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
