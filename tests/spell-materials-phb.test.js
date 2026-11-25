// tests/spell-materials-phb.test.js — repo-check-fixes-spells-materials
// (2026-11-25). Every 2024 PHB spell with a Material component carries
// the book's material specifics, read from the Chapter 7 transcription
// in docs/pm/repo-check-fixes-spells/ (Zach's PHB photos, pp. 235–343).
// The test parses the transcription itself, so the catalog and the book
// are compared directly, not through a copy of the values.
//
//   (a) transcription present and complete
//   (b) every PHB M spell matches its Components line (text, cost, consumed)
//   (c) named spot checks, word for word
//   (d) non-PHB spells unchanged
//   (e) mutation: the checker catches a dropped or altered entry
//   (f) cast path on the filled data (real DB)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { SPELL_DATA_ENTRIES: E } = await imp('server/data/spellCatalogData.js');
const logic = await imp('server/data/spellCatalog.js');

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) passed++;
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log(`\n== ${name}`); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Spells whose Components line is deliberately not stored (reported):
// Gentle Repose's "2 Copper Pieces" are coins, which live in the gold
// columns rather than the inventory the cast check reads. The four
// weapon-material spells are held because a companion's wielded weapon
// sits in its own equipment slot, which the check does not read either.
const HELD = new Set(['gentle repose', 'true strike', 'conjure barrage', 'conjure volley', 'steel wind strike']);

// ---------------------------------------------------------------- (a)
group('(a) transcription');
const TX = path.join(ROOT, 'docs/pm/repo-check-fixes-spells/phb-2024-spells-pp235-343-transcription-2026-11-24.md');
const lines = fs.readFileSync(TX, 'utf8').split(/\r?\n/);
check(lines.length >= 7107, `transcription has ${lines.length} lines (7,107 expected)`);
const book = {};
for (let i = 0; i < lines.length; i++) {
  const h = /^### (.+?)\s*$/.exec(lines[i]);
  if (!h) continue;
  let comp = null;
  let isSpell = false;
  for (let j = i + 1; j < Math.min(i + 14, lines.length); j++) {
    if (/^### /.test(lines[j])) break;
    if (/\*\*Casting Time:\*\*/.test(lines[j])) isSpell = true;
    const c = /^\*\*Components?:\*\*\s*(.*)$/.exec(lines[j]);
    if (c) { comp = c[1]; break; }
  }
  if (isSpell && comp != null) book[h[1].toLowerCase().replace(/’/g, "'")] = comp;
}
check(Object.keys(book).length === 391, `391 spells in the transcription (${Object.keys(book).length})`);

/** The book's material specifics, parsed from one Components line. */
function bookMaterial(comp) {
  const m = /\bM\s*\((.*)\)\s*$/.exec(comp);
  if (!m) return null;
  const text = m[1];
  const re = /(?:worth (?:at least )?([\d,]+)\+?\s*(GP|SP|CP))|(?:([\d,]+)\+\s*(GP|SP|CP))/g;
  const costs = [...text.matchAll(re)].map((x) => {
    const n = Number((x[1] || x[3]).replace(/,/g, ''));
    const u = x[2] || x[4];
    return u === 'GP' ? n : u === 'SP' ? n / 10 : n / 100;
  });
  return { text, costGp: costs.length ? costs[0] : null, consumed: /consume/i.test(text) };
}
const bookM = Object.entries(book).filter(([, c]) => bookMaterial(c));
check(bookM.length === 214, `214 PHB spells with a Material component (${bookM.length})`);

/** Every disagreement between the catalog entries and the book. */
function materialProblems(entries) {
  const out = [];
  for (const [k, comp] of Object.entries(book)) {
    const e = entries[k];
    if (!e) { out.push(`${k}: missing from the catalog`); continue; }
    const b = bookMaterial(comp);
    if (!b) { if (e.material) out.push(`${k}: material data on a spell with no M`); continue; }
    if (HELD.has(k)) { if (e.material) out.push(`${k}: held spell carries material data`); continue; }
    const m = e.material;
    if (!m) { out.push(`${k}: no material specifics`); continue; }
    if (m.text !== b.text) out.push(`${k}: text differs from the book`);
    if (m.costGp !== b.costGp) out.push(`${k}: cost ${m.costGp} ≠ book ${b.costGp}`);
    if (m.consumed !== b.consumed) out.push(`${k}: consumed ${m.consumed} ≠ book ${b.consumed}`);
    const enforced = b.costGp != null || b.consumed;
    if (enforced && !(Array.isArray(m.match) && m.match.length)) out.push(`${k}: enforced but no match words`);
    if (!enforced && !(Array.isArray(m.match) && m.match.length === 0)) out.push(`${k}: unenforced but carries match words`);
  }
  return out;
}

// ---------------------------------------------------------------- (b)
group('(b) every PHB M spell matches the book');
const problems = materialProblems(E);
check(problems.length === 0, `catalog agrees with the transcription (${problems.length} problems: ${problems.slice(0, 5).join('; ')})`);
const filled = bookM.filter(([k]) => E[k]?.material).length;
check(filled === 209, `209 of 214 carry specifics; 5 held (${filled})`);
for (const k of HELD) check(!E[k].material, `${k} left as it was (no material data)`);
const enforced = bookM.filter(([k]) => logic.materialIsEnforced(logic.spellMaterial(k)));
check(enforced.length === 66, `66 spells enforced at cast time (${enforced.length})`);

// ---------------------------------------------------------------- (c)
group('(c) spot checks, word for word');
const M = (k) => logic.spellMaterial(k);
check(same(M('astral projection'), {
  text: "for each of the spell's targets, one jacinth worth 1,000+ GP and one silver bar worth 100+ GP, all of which the spell consumes",
  costGp: 1000, consumed: true, match: ['jacinth'],
}), 'Astral Projection: jacinth + silver bar, both consumed');
check(M('fireball').text === 'a ball of bat guano and sulfur' && M('fireball').costGp === null && M('fireball').consumed === false, 'Fireball: bat guano and sulfur, plain');
check(M('true resurrection').text === 'diamonds worth 25,000+ GP, which the spell consumes' && M('true resurrection').costGp === 25000, 'True Resurrection: 25,000+ GP diamonds');
check(M('clone').text === 'a diamond worth 1,000+ GP, which the spell consumes, and a sealable vessel worth 2,000+ GP that is large enough to hold the creature being cloned' && M('clone').costGp === 1000, 'Clone: the diamond carries the cost');
check(M('bless').text === 'a Holy Symbol worth 5+ GP' && M('bless').costGp === 5 && M('bless').consumed === false, 'Bless: a Holy Symbol worth 5+ GP');
check(M('create undead').costGp === 150 && M('warding bond').costGp === 50, 'Create Undead 150 GP onyx, Warding Bond 50 GP ring');
const CONSUMED = ['arcane lock', 'astral projection', 'awaken', 'clone', 'continual flame', 'divination', 'find familiar', 'forcecage', 'glyph of warding', 'greater restoration', 'hallow', "heroes' feast", 'illusory script', 'legend lore', 'magic circle', 'magic mouth', 'nondetection', 'planar binding', 'protection from evil and good', 'raise dead', 'reincarnate', 'resurrection', 'revivify', 'sequester', 'simulacrum', 'stoneskin', 'symbol', 'teleportation circle', 'true resurrection', 'true seeing'];
for (const k of CONSUMED) check(M(k)?.consumed === true, `${k}: consumed`);
for (const k of ['chromatic orb', 'gate', 'identify', 'forbiddance', 'scrying', 'swift quiver', 'warding bond', "leomund's secret chest"]) check(M(k)?.consumed === false, `${k}: not consumed`);

// Open values from the corrections report, settled from the transcription:
// Control Water's whirlpool "takes half as much damage", Wind Wall "or half
// as much damage on a successful one", Storm of Vengeance "must succeed on a
// Constitution saving throw or take 2d6 Thunder damage" (none on a success).
group('(c2) on-save values settled from the book');
const fx = (k) => logic.spellEffectSpec(k, {});
check(fx('Control Water')?.damageOnSave === 'half', 'Control Water whirlpool: half on a success');
check(fx('Wind Wall')?.damageOnSave === 'half', 'Wind Wall: half on a success');
check(fx('Storm of Vengeance')?.damageOnSave === 'none', 'Storm of Vengeance first round: no damage on a success');
// Wordings the corrections report flagged for a book check (p. 247, 343, 308, 296).
const D = (k) => logic.lookupSpell(k)?.description || '';
check(fx('Wrathful Smite')?.damageType === 'necrotic' && /1d6 necrotic/.test(D('Wrathful Smite')) && !/Wisdom check/.test(D('Wrathful Smite')), 'Wrathful Smite: 1d6 Necrotic, Wisdom save repeated each turn');
check(/has the Blinded condition until the spell ends/.test(D('Blinding Smite')) && !/next time you hit/.test(D('Blinding Smite')), 'Blinding Smite: blinded on the hit, Constitution save to end');
check(/blue cold/.test(D('Prismatic Wall')) && !/madness/.test(D('Prismatic Wall')), 'Prismatic Wall: the book\'s seven layers');
check(/50 force damage/.test(D('Meld into Stone')), 'Meld into Stone: total destruction deals 50 force damage');

// ---------------------------------------------------------------- (d)
group('(d) non-PHB spells unchanged');
const nonPhbM = Object.entries(E).filter(([, e]) => e.source !== 'PHB 2024' && (e.components || []).includes('M'));
check(nonPhbM.length === 96, `96 non-PHB M spells (${nonPhbM.length})`);
check(nonPhbM.every(([, e]) => !e.material), 'none of them carries material data');

// ---------------------------------------------------------------- (e)
group('(e) mutation');
const clone = () => JSON.parse(JSON.stringify(E));
let mut = clone(); delete mut['raise dead'].material;
check(materialProblems(mut).some((p) => p.startsWith('raise dead: no material')), 'dropping one spell\'s specifics fails the check');
mut = clone(); mut['revivify'].material.consumed = false;
check(materialProblems(mut).some((p) => p.startsWith('revivify: consumed')), 'flipping a consumed flag fails the check');
mut = clone(); mut['identify'].material.costGp = 10;
check(materialProblems(mut).some((p) => p.startsWith('identify: cost')), 'a wrong cost fails the check');
mut = clone(); mut['fireball'].material.text = 'a pinch of sulfur';
check(materialProblems(mut).some((p) => p.startsWith('fireball: text')), 'a changed wording fails the check');

// ---------------------------------------------------------------- (f)
group('(f) cast path on the filled data (real DB)');
const { initDatabase, dbRun, dbGet } = await imp('server/database.js');
const { castSpell } = await imp('server/services/spellCastService.js');
await initDatabase();
const camp = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_MATERIAL_PHB', 'FR', 'active')`);
const CAMP = Number(camp.lastInsertRowid);
async function caster(cls, inventory) {
  const r = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, spell_slots, spell_slots_used, inventory)
     VALUES ('TEST_MatPhb', ?, 'Human', 17, 90, 90, 'TEST', 900, ?, ?, ?, ?)`,
    [cls, CAMP, JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }), JSON.stringify({}), JSON.stringify(inventory)]);
  return Number(r.lastInsertRowid);
}
const inv = async (id) => JSON.parse((await dbGet('SELECT inventory FROM characters WHERE id = ?', [id])).inventory || '[]');
const slots = async (id) => JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [id])).spell_slots_used || '{}');
const ids = [];
try {
  // Bless: a cleric's starting holy symbol (an Amulet, 5 GP in the book's focus table) covers it and is kept.
  let id = await caster('Cleric', []); ids.push(id);
  let r = await castSpell(id, 'Bless', 1);
  check(r?.success === false && /Holy Symbol/.test(r.reason || '') && !(await slots(id))['1'], 'Bless refused without a holy symbol, no slot spent');
  id = await caster('Cleric', [{ name: 'Amulet', quantity: 1 }]); ids.push(id);
  r = await castSpell(id, 'Bless', 1);
  check(r?.success === true && (await inv(id)).length === 1, 'Bless casts with an Amulet holy symbol, which is kept');
  // Greater Restoration: diamond dust consumed.
  id = await caster('Cleric', [{ name: 'Diamond dust', quantity: 1, price_gp: 50 }]); ids.push(id);
  check((await castSpell(id, 'Greater Restoration', 5))?.success === false, 'Greater Restoration refused with only 50 GP of diamond dust');
  id = await caster('Cleric', [{ name: 'Diamond dust', quantity: 1, price_gp: 100 }]); ids.push(id);
  r = await castSpell(id, 'Greater Restoration', 5);
  check(r?.success === true && (await inv(id)).length === 0 && r.materialSpent?.spent?.[0]?.name === 'Diamond dust', 'Greater Restoration consumes 100 GP of diamond dust');
  // Chromatic Orb: costly, not consumed.
  id = await caster('Sorcerer', [{ name: 'Diamond', quantity: 1, price_gp: 50 }]); ids.push(id);
  r = await castSpell(id, 'Chromatic Orb', 1);
  check(r?.success === true && (await inv(id)).length === 1, 'Chromatic Orb casts with a 50 GP diamond, which is kept');
  // Clone: the diamond is consumed; the vessel is not matched or spent.
  id = await caster('Wizard', [{ name: 'Diamond', quantity: 1, price_gp: 1000 }, { name: 'Sealable vessel', quantity: 1, price_gp: 2000 }]); ids.push(id);
  r = await castSpell(id, 'Clone', 8);
  const left = await inv(id);
  check(r?.success === true && left.length === 1 && left[0].name === 'Sealable vessel', 'Clone consumes the diamond and keeps the vessel');
  // A held weapon-material spell keeps its old behaviour (not checked).
  id = await caster('Wizard', []); ids.push(id);
  check((await castSpell(id, 'True Strike', 0))?.success === true, 'True Strike (held) is not refused for a weapon the check cannot see');
  // A plain M spell is untouched by its new data.
  id = await caster('Wizard', []); ids.push(id);
  check((await castSpell(id, 'Fireball', 3))?.success === true, 'Fireball (plain M) still needs no carried component');
} finally {
  for (const id of ids) await dbRun('DELETE FROM characters WHERE id = ?', [id]);
  await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP]);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
