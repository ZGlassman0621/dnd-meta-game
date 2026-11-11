// tests/item-2b-resources-feats.test.js — combat item 2, Tier 2 +
// feats refresh: resource maxima/reset/spend, RAGE / INSPIRATION /
// SECOND_WIND / LAY_ON_HANDS markers, migration 091 columns, and
// the 2024 feat texts (14 core + 10 fighting styles, homebrew
// untouched). Throwaway-DB pattern, real services, real DB.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item2b-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const cf = await import(svc('server/services/classFeatureService.js'));
const fr = await import(svc('server/data/featRegistry.js'));
const mp = await import(svc('server/services/markerPipeline.js'));
const pas = await import(svc('server/services/partyAttackService.js')); // registers ATTACK; cf registers RAGE etc.
const ms = await import(svc('server/services/markerSchemas.js'));

let passed = 0, failed = 0;
function group(name) { console.log(`\n== ${name} ==`); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

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
async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Test PC', class: 'Fighter', level: 3, current_hp: 30, max_hp: 30,
    armor_class: 16, ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]), ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}
async function addCompanion(name, over = {}) {
  const npcId = await insertRow('npcs', { name });
  const id = await insertRow('companions', {
    npc_id: npcId, recruited_by_character_id: pc.id, status: 'active',
    progression_type: 'class_based', companion_class: 'Fighter', companion_level: 3,
    companion_ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    companion_current_hp: 20, companion_max_hp: 20, armor_class: 15,
    companion_spell_slots_used: JSON.stringify({}), ...over
  });
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [id]);
  return { ...row, display_name: name };
}
async function addSession() { return insertRow('dm_sessions', { character_id: pc.id, status: 'active' }); }
async function markerResult(text, sessionId) {
  const res = await mp.processResponseMarkers(text, { characterId: pc.id, sessionId });
  const key = (text.match(/\[(\w+):/) || [])[1];
  return (res.handlerResults || []).find(r => r.schemaKey === key) || res.handlerResults[0];
}

const pc = await addPc();

// ---------------------------------------------------------------------------
group('1. Migration 091 columns exist');
{
  const charCols = (await dbAll('PRAGMA table_info(characters)')).map(c => c.name);
  const compCols = (await dbAll('PRAGMA table_info(companions)')).map(c => c.name);
  ok(charCols.includes('class_resources_json'), 'characters.class_resources_json exists');
  ok(compCols.includes('class_resources_json'), 'companions.class_resources_json exists');
  ok(compCols.includes('companion_feats'), 'companions.companion_feats exists');
}

// ---------------------------------------------------------------------------
group('2. Resource maxima (computed, never stored)');
{
  const cha16 = JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 });
  ok(cf.resourceMaxima({ className: 'Barbarian', level: 5 }).rage === 3, 'barbarian L5: 3 rages');
  ok(cf.resourceMaxima({ className: 'Monk', level: 5 }).focus === 5, 'monk L5: 5 focus points');
  ok(cf.resourceMaxima({ className: 'Bard', level: 5, abilityScores: cha16 }).bardic === 3, 'bard CHA 16: 3 inspiration uses');
  ok(cf.resourceMaxima({ className: 'Fighter', level: 1 }).secondWind === 2, 'fighter L1: 2 second winds (2024 PHB)');
  ok(cf.resourceMaxima({ className: 'Fighter', level: 5 }).secondWind === 3, 'fighter L5: 3 second winds (2024 PHB: 3 at L4)');
  ok(cf.resourceMaxima({ className: 'Fighter', level: 10 }).secondWind === 4, 'fighter L10: 4 second winds (2024 PHB: 4 at L10)');
  ok(cf.resourceMaxima({ className: 'Fighter', level: 5 }).actionSurge === 1 && cf.resourceMaxima({ className: 'Fighter', level: 17 }).actionSurge === 2, 'action surge 1, 2 at L17');
  ok(cf.resourceMaxima({ className: 'Paladin', level: 5 }).layOnHands === 25, 'paladin L5: 25 lay on hands points');
  ok(cf.resourceMaxima({ className: 'Cleric', level: 2 }).channelDivinity === 2, 'cleric L2: 2 channel divinity (2024 PHB)');
  ok(cf.resourceMaxima({ className: 'Cleric', level: 6 }).channelDivinity === 3, 'cleric L6: 3 channel divinity (2024 PHB)');
  ok(cf.resourceMaxima({ className: 'Cleric', level: 18 }).channelDivinity === 4, 'cleric L18: 4 channel divinity (2024 PHB)');
  ok(cf.resourceMaxima({ className: 'Sorcerer', level: 5 }).sorcery === 5, 'sorcerer L5: 5 sorcery points');
  ok(cf.resourceMaxima({ className: 'Paladin', level: 5 }).channelDivinity == null, 'paladin channel divinity: not modeled, not invented');
}

// ---------------------------------------------------------------------------
group('3. Rest reset (pure): long rest all, short rest selective');
{
  const used = { used: { rage: 2, focus: 2, bardic: 2, secondWind: 2, actionSurge: 1, channelDivinity: 1, sorcery: 3, layOnHandsSpent: 10 }, raging: true, bardicHeld: { die: 'd8', from: 'Bard' } };
  const long = cf.resetResourcesForRest(used, { className: 'Barbarian', level: 5, type: 'long' });
  ok(Object.values(long.used).every(v => v === 0) && long.raging === false && long.bardicHeld === null, 'long rest: everything reset, rage and held inspiration cleared');
  const short = cf.resetResourcesForRest(used, { className: 'Fighter', level: 5, type: 'short' });
  ok(short.used.rage === 1 && short.used.secondWind === 1 && short.used.actionSurge === 0 && short.used.sorcery === 3 && short.used.layOnHandsSpent === 10, 'short rest: +1 rage, +1 second wind, action surge back, sorcery and lay on hands untouched');
  ok(short.raging === true, 'short rest does not end a rage');
  const bardShort4 = cf.resetResourcesForRest(used, { className: 'Bard', level: 4, type: 'short' });
  const bardShort5 = cf.resetResourcesForRest(used, { className: 'Bard', level: 5, type: 'short' });
  ok(bardShort4.used.bardic === 2 && bardShort5.used.bardic === 0, 'font of inspiration: bardic uses return on a short rest only at L5+');
}

// ---------------------------------------------------------------------------
group('4. Companion feats round-trip + spend guard');
{
  const comp = await addCompanion('FeatComp');
  const set = await cf.setCompanionFeats(comp.id, ['Archery', 'Dueling']);
  ok(set.success === true, 'companion feats set');
  ok(JSON.stringify(await cf.getCompanionFeats(comp.id)) === '["Archery","Dueling"]', 'companion feats persist and read back');
  const spend = await cf.spendResource('companion', comp.id, 'rage');
  ok(spend.success === false && spend.reason.includes('not modeled'), 'a fighter cannot spend rage — class guard, not a silent success');
}

// ---------------------------------------------------------------------------
group('5. RAGE marker: uses, already-raging, end, class guard');
{
  const sessionId = await addSession();
  const barb = await addCompanion('RageBarb', { companion_class: 'Barbarian', companion_level: 3 });
  const h1 = await markerResult('[RAGE: Target="RageBarb"]', sessionId);
  ok(h1 && h1.ok && h1.result && h1.result.success === true && h1.result.usesUsed === 1 && h1.result.usesMax === 3, 'rage entered: 1/3 uses');
  const h2 = await markerResult('[RAGE: Target="RageBarb"]', sessionId);
  ok(h2.result && h2.result.success === true && h2.result.note === 'already raging', 'second rage while raging does not burn another use');
  const mid = await cf.getClassResources('companion', barb.id);
  ok(mid.resources.used.rage === 1 && mid.resources.raging === true, 'rage state persisted (1 used, raging)');
  const h3 = await markerResult('[RAGE: Target="RageBarb" End="true"]', sessionId);
  ok(h3.result && h3.result.success === true && h3.result.raging === false, 'rage ended');
  const notBarb = await addCompanion('NotBarb');
  const h4 = await markerResult('[RAGE: Target="NotBarb"]', sessionId);
  ok(h4.result && h4.result.success === false, 'a fighter cannot rage');
  const h5 = await markerResult('[RAGE: Target="Nobody Here"]', sessionId);
  ok(h5.result && h5.result.success === false, 'unknown rage target fails, it does not invent one');
}

// ---------------------------------------------------------------------------
group('6. INSPIRATION marker: grant, spend, spend-again refusal');
{
  const sessionId = await addSession();
  const bardPc = await addPc({
    name: 'Bard PC', class: 'Bard', level: 5,
    ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 }),
  });
  const target = await addCompanion('Inspired');
  // Marker context is the main PC (pc.id), not the bard PC — so grant
  // through the bard companion instead: use a bard companion as Bard=.
  const bardComp = await addCompanion('BardComp', {
    companion_class: 'Bard', companion_level: 5,
    companion_ability_scores: JSON.stringify({ str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 16 }),
  });
  const g = await markerResult('[INSPIRATION: Target="Inspired" Bard="BardComp"]', sessionId);
  ok(g.result && g.result.success === true && g.result.die === 'd8' && g.result.usesUsed === 1 && g.result.usesMax === 3, 'bard grants d8 inspiration (1/3 uses)');
  const held = await cf.getClassResources('companion', target.id);
  ok(held.resources.bardicHeld && held.resources.bardicHeld.die === 'd8', 'held die persisted on the recipient');
  const s = await markerResult('[INSPIRATION: Target="Inspired" Bard="BardComp" Spend="true"]', sessionId);
  ok(s.result && s.result.success === true && s.result.die === 'd8', 'spending returns the held die');
  const s2 = await markerResult('[INSPIRATION: Target="Inspired" Bard="BardComp" Spend="true"]', sessionId);
  ok(s2.result && s2.result.success === false, 'spending again with nothing held fails');
  ok(bardPc.name === 'Bard PC', 'bard PC row exists (unused by this marker path, kept for coverage)');
}

// ---------------------------------------------------------------------------
group('7. SECOND_WIND + LAY_ON_HANDS markers heal real HP');
{
  const sessionId = await addSession();
  const wind = await addCompanion('WindFighter', {
    companion_class: 'Fighter', companion_level: 5,
    companion_current_hp: 5, companion_max_hp: 20,
  });
  const w1 = await markerResult('[SECOND_WIND: Target="WindFighter"]', sessionId);
  ok(w1.result && w1.result.success === true && w1.result.heal >= 6 && w1.result.heal <= 15, 'second wind heals 1d10 + level (6–15 at L5)');
  const afterWind = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [wind.id]);
  ok(afterWind.companion_current_hp === 5 + w1.result.heal, 'second wind HP applied (not capped here)');
  await markerResult('[SECOND_WIND: Target="WindFighter"]', sessionId);
  const w3 = await markerResult('[SECOND_WIND: Target="WindFighter"]', sessionId);
  ok(w3.result && w3.result.success === true, 'third second wind succeeds — 3 uses at L5 (2024 PHB: 3 at L4)');
  const w4 = await markerResult('[SECOND_WIND: Target="WindFighter"]', sessionId);
  ok(w4.result && w4.result.success === false, 'fourth second wind refused — only 3 uses at L5');

  const healer = await addCompanion('PaladinComp', {
    companion_class: 'Paladin', companion_level: 5,
  });
  const wounded = await addCompanion('Wounded', { companion_current_hp: 5, companion_max_hp: 20 });
  const l1 = await markerResult('[LAY_ON_HANDS: Target="Wounded" Healer="PaladinComp" Amount="5"]', sessionId);
  ok(l1.result && l1.result.success === true && l1.result.poolLeft === 20, 'lay on hands 5 from a 25 pool leaves 20');
  const afterLay = await dbGet('SELECT companion_current_hp FROM companions WHERE id = ?', [wounded.id]);
  ok(afterLay.companion_current_hp === 10, 'lay on hands HP applied');
  const l2 = await markerResult('[LAY_ON_HANDS: Target="Wounded" Healer="PaladinComp" Amount="99"]', sessionId);
  ok(l2.result && l2.result.success === false, 'lay on hands beyond the pool is refused');
  ok(healer.display_name === 'PaladinComp', 'healer row exists'); // companions rows carry display_name, not .name
}

// ---------------------------------------------------------------------------
group('8. Feats refresh: 2024 texts, fighting styles, homebrew untouched');
{
  const alert = fr.getFeatEffect('Alert');
  ok(alert && alert.source === 'core' && alert.effect.includes('proficiency bonus') && !alert.effect.includes('+5 initiative'), 'Alert 2024: +PB initiative, no +5, no surprise immunity');
  const gwm = fr.getFeatEffect('Great Weapon Master');
  ok(gwm && !gwm.effect.includes('-5') && gwm.effect.includes('proficiency bonus'), 'GWM 2024: no -5/+10, +PB damage');
  const sharp = fr.getFeatEffect('Sharpshooter');
  ok(sharp && !sharp.effect.includes('-5') && sharp.effect.includes('Dexterity'), 'Sharpshooter 2024: no -5/+10');
  const lucky = fr.getFeatEffect('Lucky');
  ok(lucky && lucky.effect.includes('proficiency bonus') && !lucky.effect.includes('3 luck points'), 'Lucky 2024: PB luck points, not 3 rerolls');
  const styles = fr.listFightingStyleFeats();
  ok(styles.length === 10, '10 fighting style feats listed');
  for (const name of ['Archery', 'Blind Fighting', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Interception', 'Protection', 'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Unarmed Fighting']) {
    const e = fr.getFeatEffect(name);
    ok(e && e.source === 'core' && e.category === 'fighting_style', `${name} resolves as a core fighting style feat`);
  }
  const battleaxe = fr.getFeatEffect('Battleaxe Mastery');
  ok(battleaxe && battleaxe.source === 'homebrew', 'homebrew weapon feats still resolve as homebrew');
  const manualStyle = fr.getFeatEffect('Trident and Net Style');
  ok(manualStyle && manualStyle.source === 'homebrew' && manualStyle.category === 'fighting_style', 'manual fighting styles stay homebrew (no collision with core styles)');
  const rendered = fr.renderFeatEffectsForPrompt(['Alert', 'Archery']);
  ok(rendered.includes('Alert') && rendered.includes('Archery'), 'prompt rendering includes refreshed + style feats');
}

// ---------------------------------------------------------------------------
group('9. Marker schemas: new markers can actually dispatch');
{
  for (const key of ['ATTACK', 'MASTERY_SET', 'RAGE', 'INSPIRATION', 'SECOND_WIND', 'LAY_ON_HANDS']) {
    ok(ms.MARKER_SCHEMAS[key] != null, `schema exists for ${key} (handlers without schemas never dispatch)`);
  }
  const v = ms.validateDmMarkers('[RAGE: Target="RageBarb"] [LAY_ON_HANDS: Target="Wounded" Amount="5"]');
  ok(v.validByKey.RAGE && v.validByKey.RAGE[0].Target === 'RageBarb', 'RAGE validates through the pipeline');
  ok(v.validByKey.LAY_ON_HANDS && v.validByKey.LAY_ON_HANDS[0].Amount === 5, 'LAY_ON_HANDS validates with an int amount');
  ok(v.failures.length === 0, 'no validation failures for well-formed item-2 markers');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
