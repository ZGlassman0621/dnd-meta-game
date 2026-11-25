// tests/spell-catalog-2024-fixes.test.js — repo-check-fixes-spells
// (2026-11-25). The 2026-11-24 repo check compared the live spell
// catalog against the 2024 PHB (Ch. 7, pp. 235–343, Zach's photos);
// this pins every correction the brief lists, with the brief's book
// values, so a regression to a 2014 or invented value trips here.
//
// Groups:
//   (a) presence + count + source tags (item 1, item 2 reconciliation)
//   (b) schools (item 3)               (c) class lists (item 4)
//   (d) cast time/range/components/duration/ritual (item 5)
//   (e) saves (item 6)                 (f) damage table (item 7)
//   (g) description numbers (item 8)   (h) material specifics (item 9)
//   (i) generated mirror (item 10)     (j) legacy client files (item 11)
//   (k) engine: dice shapes from spellEffectSpec
//   (l) engine: material enforcement at cast time (real DB)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { SPELL_DATA_ENTRIES: E, SPELL_DATA_EFFECTS: F } = await imp('server/data/spellCatalogData.js');
const logic = await imp('server/data/spellCatalog.js');
const legacy = await imp('scripts/sync-legacy-spell-files.js');

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) passed++;
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log(`\n== ${name}`); }
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------- (a)
group('(a) presence, count, source tags');
check(Object.keys(E).length === 584, `584 entries (got ${Object.keys(E).length})`);
const phb = Object.entries(E).filter(([, e]) => e.source === 'PHB 2024').map(([k]) => k);
check(phb.length === 391, `391 entries tagged PHB 2024 = the book's 391 spells (got ${phb.length})`);
const t = E['tsunami'];
check(t && t.level === 8 && t.school === 'Conjuration' && same(t.classes, ['Druid']) && t.castTime === '1 minute'
  && t.range === '1 mile' && same(t.components, ['V', 'S']) && t.duration === 'Concentration, up to 6 rounds'
  && t.concentration === true && t.ritual === false && t.save === 'str' && t.source === 'PHB 2024', 'Tsunami matches PHB p. 341');
for (const k of ['blinding smite', 'steel wind strike', 'summon celestial', 'summon fiend', 'vitriolic sphere']) {
  check(E[k]?.source === 'PHB 2024', `${k} tagged PHB 2024 (got ${E[k]?.source})`);
}
check(E['pyrotechnics']?.source === 'Xanathar', 'Pyrotechnics tagged Xanathar');
check(E['summon shadowspawn']?.source === 'Tasha', 'Summon Shadowspawn tagged Tasha');
// Reconciliation: 387 tagged before − 2 wrong = 385 correct; + 5
// retagged + Tsunami = 391 = the book.
check(385 + 5 + 1 === phb.length, 'reconciliation 385 + 5 + 1 = 391');
// concentration flag agrees with the duration on EVERY entry.
const concBad = Object.entries(E).filter(([, e]) => e.concentration !== /^Concentration/.test(e.duration)).map(([k]) => k);
check(concBad.length === 0, `concentration flag matches duration on every entry (${concBad.join(', ')})`);

// ---------------------------------------------------------------- (b)
group('(b) schools');
const SCHOOLS = {
  'banishing smite': 'Conjuration', 'conjure volley': 'Conjuration', 'earthquake': 'Transmutation',
  'etherealness': 'Conjuration', 'glibness': 'Enchantment', 'goodberry': 'Conjuration', 'hallow': 'Abjuration',
  'heal': 'Abjuration', "otiluke's resilient sphere": 'Abjuration', 'power word heal': 'Enchantment',
  'reincarnate': 'Necromancy', 'staggering smite': 'Enchantment', 'stoneskin': 'Transmutation',
};
for (const [k, s] of Object.entries(SCHOOLS)) check(E[k]?.school === s, `${k} school ${s} (got ${E[k]?.school})`);

// ---------------------------------------------------------------- (c)
group('(c) class lists');
const CLASSES = {
  'antipathy/sympathy': ['Bard', 'Druid', 'Wizard'], 'eyebite': ['Bard', 'Sorcerer', 'Warlock', 'Wizard'],
  'prismatic wall': ['Bard', 'Wizard'], 'slow': ['Bard', 'Sorcerer', 'Wizard'], 'blinding smite': ['Blackguard', 'Paladin'],
  'cloud of daggers': ['Bard', 'Sorcerer', 'Spellshot', 'Warlock', 'Wizard'], 'gate': ['Cleric', 'Sorcerer', 'Warlock', 'Wizard'],
  'teleportation circle': ['Bard', 'Sorcerer', 'Warlock', 'Wizard'], 'thunderclap': ['Bard', 'Druid', 'Sorcerer', 'Warlock', 'Wizard'],
  'cone of cold': ['Druid', 'Sorcerer', 'Spellshot', 'Wizard'], 'elemental weapon': ['Artificer', 'Blackguard', 'Druid', 'Paladin', 'Ranger'],
  'fire shield': ['Druid', 'Sorcerer', 'Wizard'], 'flesh to stone': ['Druid', 'Sorcerer', 'Wizard'],
  'incendiary cloud': ['Druid', 'Sorcerer', 'Wizard'], 'symbol': ['Bard', 'Cleric', 'Druid', 'Wizard'],
  'demiplane': ['Sorcerer', 'Warlock', 'Wizard'], 'flame blade': ['Druid', 'Sorcerer'], 'grease': ['Artificer', 'Sorcerer', 'Wizard'],
  'magic weapon': ['Artificer', 'Blackguard', 'Paladin', 'Ranger', 'Sorcerer', 'Wizard'],
  'message': ['Artificer', 'Bard', 'Druid', 'Sorcerer', 'Wizard'], 'sunbeam': ['Cleric', 'Druid', 'Sorcerer', 'Wizard'],
  'true seeing': ['Bard', 'Cleric', 'Sorcerer', 'Warlock', 'Wizard'], 'vampiric touch': ['Blackguard', 'Sorcerer', 'Warlock', 'Wizard'],
  "dragon's breath": ['Sorcerer', 'Wizard'], 'dream': ['Bard', 'Warlock', 'Wizard'], 'feign death': ['Bard', 'Cleric', 'Druid', 'Wizard'],
  'freedom of movement': ['Artificer', 'Bard', 'Cleric', 'Druid', 'Ranger'], 'globe of invulnerability': ['Sorcerer', 'Wizard'],
  'greater invisibility': ['Bard', 'Sorcerer', 'Wizard'], 'magic jar': ['Wizard'], 'mislead': ['Bard', 'Warlock', 'Wizard'],
  'prismatic spray': ['Bard', 'Sorcerer', 'Wizard'], 'remove curse': ['Blackguard', 'Cleric', 'Paladin', 'Warlock', 'Wizard'],
  'wall of ice': ['Wizard'],
};
for (const [k, c] of Object.entries(CLASSES)) check(same(E[k]?.classes, c), `${k} classes ${c.join('/')} (got ${E[k]?.classes?.join('/')})`);

// ---------------------------------------------------------------- (d)
group('(d) cast time, range, components, duration, ritual');
const FIELDS = {
  "drawmij's instant summons": { castTime: '1 minute', ritual: true }, 'fabricate': { castTime: '10 minutes' },
  'foresight': { castTime: '1 minute' }, 'regenerate': { castTime: '1 minute' }, 'plant growth': { castTime: '1 action or 8 hours' },
  'astral projection': { range: '10 feet' }, 'banishment': { range: '30 feet' }, 'confusion': { range: '90 feet' },
  'cordon of arrows': { range: 'Touch' }, 'dimension door': { range: '500 feet' }, 'mind spike': { range: '120 feet' },
  'storm of vengeance': { range: '1 mile' }, 'telepathy': { range: 'Unlimited' }, 'witch bolt': { range: '60 feet' },
  'aura of purity': { components: ['V'] }, 'commune with nature': { components: ['V', 'S'] },
  'conjure woodland beings': { components: ['V', 'S'] }, 'resistance': { components: ['V', 'S'] },
  'swift quiver': { components: ['V', 'S', 'M'] },
  'animal shapes': { duration: '24 hours', concentration: false }, 'banishing smite': { duration: 'Concentration, up to 1 minute', concentration: true },
  'blinding smite': { duration: '1 minute', concentration: false }, 'forcecage': { duration: 'Concentration, up to 1 hour', concentration: true },
  'goodberry': { duration: '24 hours', concentration: false }, 'hallow': { duration: 'Until dispelled' },
  'searing smite': { duration: '1 minute', concentration: false }, 'staggering smite': { duration: 'Instantaneous', concentration: false },
  'teleportation circle': { duration: '1 round' }, 'transport via plants': { duration: '1 minute' },
  'wrathful smite': { duration: '1 minute', concentration: false }, 'illusory script': { ritual: true },
};
for (const [k, want] of Object.entries(FIELDS)) {
  for (const [f, v] of Object.entries(want)) check(same(E[k]?.[f], v), `${k}.${f} = ${JSON.stringify(v)} (got ${JSON.stringify(E[k]?.[f])})`);
}
check(same(E['plant growth'].castModes, [{ name: 'Overgrowth', castTime: '1 action' }, { name: 'Enrichment', castTime: '8 hours' }]), 'Plant Growth carries both casting modes');

// ---------------------------------------------------------------- (e)
group('(e) saves');
const SAVE = { 'animal messenger': 'cha', 'control water': 'str', "mordenkainen's faithful hound": 'dex', 'wind wall': 'str', "evard's black tentacles": 'str' };
for (const [k, s] of Object.entries(SAVE)) check(E[k]?.save === s, `${k} save ${s} (got ${E[k]?.save})`);
for (const k of ['hallow', 'maze', 'plane shift', 'ray of sickness']) check(E[k] && !('save' in E[k]) && logic.spellSaveAbility(k) === null, `${k} has no save (invented save removed)`);
for (const k of ['forcecage', 'magic circle']) {
  const saves = logic.spellSaveList(k);
  check(!E[k].save && logic.spellSaveAbility(k) === null, `${k}: no unconditional save field`);
  check(saves.length === 1 && saves[0].ability === 'cha' && saves[0].conditional === true && /teleportation|interplanar/.test(saves[0].when), `${k}: conditional Charisma save recorded`);
}
const abil = (k) => logic.spellSaveList(k).map(s => s.ability);
check(same(abil("bigby's hand"), ['dex', 'str']), "Bigby's Hand carries Dex (Grasping) + Str (Forceful)");
check(same(abil('prismatic wall'), ['dex', 'con']), 'Prismatic Wall carries Dex (layers) + Con (Blinded)');
check(abil('symbol').includes('wis') && abil('symbol').filter(a => a === 'con').length === 2, 'Symbol carries Wis + Con (Death) + Con (Pain)');
check(/Strength save/.test(E["evard's black tentacles"].description) && !/Dexterity save/.test(E["evard's black tentacles"].description), "Evard's description says Strength");
check(!/Charisma save/.test(E['hallow'].description), 'Hallow description: no invented Charisma save');
check(!/offensively|unwilling/.test(E['plane shift'].description), 'Plane Shift: 2014 offensive banish removed');
check(/no save/.test(E['ray of sickness'].description) && /Poisoned/.test(E['ray of sickness'].description), 'Ray of Sickness: automatic Poisoned on hit');
check(/Dexterity save or take 4d8 force/.test(E["mordenkainen's faithful hound"].description), 'Faithful Hound: Dex save, 4d8 force');

// ---------------------------------------------------------------- (f)
group('(f) damage table');
check(F['cordon of arrows'].damage === '2d4', 'Cordon of Arrows 2d4');
check(F['ice storm'].damage === '2d10+4d6' && same(F['ice storm'].damageParts, [{ damage: '2d10', damageType: 'bludgeoning' }, { damage: '4d6', damageType: 'cold' }]), 'Ice Storm 2d10 bludgeoning + 4d6 cold');
check(F['inflict wounds'].damage === '2d10', 'Inflict Wounds 2d10');
check(F['prismatic spray'].damage === '12d6', 'Prismatic Spray 12d6');
check(F['vitriolic sphere'].damage === '10d4' && F['vitriolic sphere'].followUps?.[0]?.damage === '5d4' && F['vitriolic sphere'].followUps[0].damageType === 'acid', 'Vitriolic Sphere 10d4 + 5d4 acid tick');
check(same(F["jallarzi's storm of radiance"].damageParts, [{ damage: '2d10', damageType: 'radiant' }, { damage: '2d10', damageType: 'thunder' }]), "Jallarzi's split 2d10 radiant + 2d10 thunder");
check(same(F['meteor swarm'].damageParts, [{ damage: '20d6', damageType: 'fire' }, { damage: '20d6', damageType: 'bludgeoning' }]), 'Meteor Swarm split 20d6 fire + 20d6 bludgeoning');
check(F['control water']?.damage === '2d8' && F['control water'].damageType === 'bludgeoning', 'Control Water whirlpool 2d8 bludgeoning');
check(F['earthquake']?.damage === '12d6' && !!F['earthquake'].condition, 'Earthquake 12d6 bludgeoning (conditional)');
const sov = F['storm of vengeance'];
check(sov && sov.damage === '2d6' && sov.damageType === 'thunder' && same(sov.followUps.map(f => `${f.damage} ${f.damageType}`), ['4d6 acid', '10d6 lightning', '2d6 bludgeoning', '1d6 cold']), 'Storm of Vengeance all five rounds');
check(F['wind wall']?.damage === '4d8' && F['wind wall'].damageType === 'bludgeoning', 'Wind Wall 4d8 bludgeoning');
check(F['power word kill']?.damage === '12d12' && F['power word kill'].targetHpAbove === 100 && !!F['power word kill'].condition, 'Power Word Kill 12d12 psychic above 100 HP (conditional)');
check(!F['teleport'], 'Teleport: no EFFECTS entry (the engine does not resolve mishaps)');
check(F['meld into stone']?.damage === '6d6' && F['meld into stone'].damageType === 'force' && !!F['meld into stone'].condition, 'Meld into Stone 6d6 force (conditional)');
check(F['wish']?.damage === '1d10' && F['wish'].perSpellLevel === true && !!F['wish'].condition, 'Wish stress 1d10 necrotic per spell level (conditional)');
check(F['alter self']?.damage === '1d6' && !!F['alter self'].condition, 'Alter Self natural weapons 1d6 (conditional)');
check(F['hunger of hadar'].damage === '2d6' && F['hunger of hadar'].damageType === 'cold' && F['hunger of hadar'].followUps?.[0]?.damage === '2d6' && F['hunger of hadar'].followUps[0].damageType === 'acid', 'Hunger of Hadar 2d6 cold + 2d6 acid');
check(F['regenerate'].healing === '4d8+15' && F['regenerate'].followUps?.[0]?.healing === '1', 'Regenerate 4d8+15 + 1 HP per turn');
check(F['witch bolt'].damage === '2d12' && F['witch bolt'].followUps?.[0]?.damage === '1d12', 'Witch Bolt 2d12 initial, 1d12 later');
check(F["mordenkainen's faithful hound"].damageType === 'force', 'Faithful Hound force damage');
check(!F['blink'] && !F['ray of enfeeblement'], 'Blink / Ray of Enfeeblement: no EFFECTS entry');
// Verified-correct entries untouched.
check(F['disintegrate'].damage === '10d6+40' && F['finger of death'].damage === '7d8+30' && F['magic missile'].damage === '3d4+3'
  && F['dissonant whispers'].damage === '3d6' && F['spiritual weapon'].damage === '1d8' && F['spiritual weapon'].addCastingMod === true, 'verified-correct dice untouched');
// Every damageParts total equals its pool.
for (const [k, fx] of Object.entries(F)) {
  if (!fx.damageParts) continue;
  const sum = (s) => String(s).split('+').reduce((a, tok) => { const m = /^(\d+)d(\d+)$/.exec(tok); return a + (m ? Number(m[1]) * (Number(m[2]) + 1) / 2 : 0); }, 0);
  check(Math.abs(sum(fx.damage) - fx.damageParts.reduce((a, p) => a + sum(p.damage), 0)) < 1e-9, `${k}: parts add up to the pool`);
}

// ---------------------------------------------------------------- (g)
group('(g) description numbers');
const D = (k) => E[k].description;
check(/1d6/.test(D('blink')) && /4–6/.test(D('blink')) && !/d20/.test(D('blink')), 'Blink 1d6, 4–6');
check(/2d8 bludgeoning/.test(D('control water')), 'Control Water 2d8');
check(/12d6 bludgeoning/.test(D('earthquake')) && /1d6 fissures/.test(D('earthquake')) && /1d10 × 10 feet/.test(D('earthquake')), 'Earthquake 12d6 / 1d6 fissures / 1d10×10 ft');
check(/6d6 force/.test(D('meld into stone')), 'Meld into Stone 6d6');
check(/12d12 psychic/.test(D('power word kill')), 'Power Word Kill 12d12');
check(/subtracts 1d8 from all its damage rolls/.test(D('ray of enfeeblement')) && /Strength-based D20 Tests/.test(D('ray of enfeeblement')) && !/halved/.test(D('ray of enfeeblement')), 'Ray of Enfeeblement 1d8 + Strength D20 Tests');
for (const d of ['2d6 thunder', '4d6 acid', '10d6 lightning', '2d6 bludgeoning', '1d6 cold']) check(D('storm of vengeance').includes(d), `Storm of Vengeance description has ${d}`);
check(/3d10 force/.test(D('teleport')) && /2d12 miles/.test(D('teleport')) && /1d8/.test(D('teleport')), 'Teleport 3d10 / 2d12 miles / 1d8');
check(/4d8 bludgeoning/.test(D('wind wall')), 'Wind Wall 4d8');
check(/2d12 lightning/.test(D('witch bolt')) && /1d12 lightning/.test(D('witch bolt')), 'Witch Bolt 2d12 then 1d12');
check(/1d6 damage/.test(D('alter self')), 'Alter Self 1d6');
check(/1d10 necrotic damage per level/.test(D('wish')) && /Strength score becomes 3 for 2d4 days/.test(D('wish')), 'Wish stress numbers');
check(/2d4 fire/.test(D('web')), 'Web 2d4 fire');
check(/10d4 acid/.test(D('vitriolic sphere')) && /5d4 acid/.test(D('vitriolic sphere')) && !/4d10/.test(D('vitriolic sphere')), 'Vitriolic Sphere 10d4 + 5d4');
check(/2d4 piercing/.test(D('cordon of arrows')), 'Cordon of Arrows description 2d4');
check(/2d10 bludgeoning/.test(D('ice storm')), 'Ice Storm description 2d10');
check(/2d10 necrotic/.test(D('inflict wounds')), 'Inflict Wounds description 2d10');
check(/12d6/.test(D('prismatic spray')), 'Prismatic Spray description 12d6');

// ---------------------------------------------------------------- (h)
group('(h) material specifics');
const M = (k) => logic.spellMaterial(k);
check(same(M('revivify'), { text: 'diamonds worth 300 GP', costGp: 300, consumed: true, match: ['diamond'] }), 'Revivify: 300 GP diamonds, consumed');
check(M("heroes' feast")?.costGp === 1000 && M("heroes' feast").consumed === true && /gem-encrusted bowl/.test(M("heroes' feast").text), "Heroes' Feast: 1,000+ GP bowl, consumed");
check(M('astral projection')?.costGp === 1000 && /jacinthe/.test(M('astral projection').text), 'Astral Projection: 1,000+ GP jacinthe');
check(M('arcane lock')?.costGp === 25 && /gold dust/.test(M('arcane lock').text), 'Arcane Lock: 25+ GP gold dust');
check(M('swift quiver')?.costGp === 1 && M('swift quiver').consumed === false && /quiver/.test(M('swift quiver').text), 'Swift Quiver: a quiver worth 1+ GP');
for (const k of ['revivify', "heroes' feast", 'astral projection', 'arcane lock', 'swift quiver']) check(logic.materialIsEnforced(M(k)), `${k}: enforced at cast time`);
check(!logic.materialIsEnforced(null) && !logic.materialIsEnforced({ costGp: 0, consumed: false }), 'a plain component is not enforced');
for (const [k, e] of Object.entries(E)) if (e.material) check(e.components.includes('M'), `${k}: material data only on an M spell`);

// ---------------------------------------------------------------- (i)
group('(i) generated mirror');
const gen = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/data/spellCatalog.generated.json'), 'utf8'));
check(gen.spellCount === 584 && gen.spells.length === 584, `mirror holds 584 (got ${gen.spells.length})`);
let mirrorOk = 0;
const FIELDS_ALL = ['level', 'school', 'castTime', 'castModes', 'range', 'components', 'material', 'duration', 'concentration', 'ritual', 'save', 'saves', 'appliesCondition', 'classes', 'source', 'description'];
for (const s of gen.spells) {
  const e = E[s.key];
  if (e && FIELDS_ALL.every(f => same(s[f], e[f]))) mirrorOk++;
}
check(mirrorOk === 584, `mirror matches the server entry for entry: ${mirrorOk}/584`);

// ---------------------------------------------------------------- (j)
group('(j) legacy client files are synced from the live catalog');
for (const file of legacy.legacyFiles()) {
  const text = fs.readFileSync(file, 'utf8');
  const res = legacy.syncFileText(text, E, F);
  check(res.text === text, `${path.basename(file)} is in sync with the live catalog (re-sync changes nothing)`);
}
const cantrips = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/data/spells/cantrips.json'), 'utf8'));
const allCantrips = Object.values(cantrips).flat();
check(!allCantrips.some(s => /bludgeoning, piercing, and slashing/.test(s.description || '')), 'no 2014 Blade Ward text');
check(!allCantrips.some(s => /add the number rolled to one saving throw/.test(s.description || '')), 'no 2014 Resistance text');
const eighth = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/data/spells/spells-8th.json'), 'utf8'));
const ts = eighth.find(s => s.name === 'Tsunami');
check(ts && ts.range === '1 mile' && ts.duration === 'Concentration, up to 6 rounds', 'spells-8th Tsunami range 1 mile');
check(!eighth.some(s => s.name === 'Feeblemind'), 'spells-8th: 2014 Feeblemind removed');
const fifth = JSON.parse(fs.readFileSync(path.join(ROOT, 'client/src/data/spells/spells-5th.json'), 'utf8'));
check(fifth.find(s => s.name === 'Banishing Smite')?.duration === 'Concentration, up to 1 minute', 'spells-5th Banishing Smite keeps the correct duration');

// ---------------------------------------------------------------- (k)
group('(k) engine dice shapes');
const ms = logic.spellEffectSpec('meteor swarm');
check(ms && same(ms.parts, [{ dice: '20d6', damageType: 'fire' }, { dice: '20d6', damageType: 'bludgeoning' }]) && ms.spec === '20d6+20d6', 'Meteor Swarm spec carries two typed parts');
const jl = logic.spellEffectSpec("jallarzi's storm of radiance", { slotLevel: 7 });
check(jl && same(jl.parts.map(p => p.dice), ['4d10', '4d10']), "Jallarzi's at 7th: +1d10 per type per level (4d10 + 4d10)");
const is = logic.spellEffectSpec('ice storm', { slotLevel: 6 });
check(is && same(is.parts.map(p => p.dice), ['4d10', '4d6']), 'Ice Storm at 6th: bludgeoning 4d10, cold 4d6');
check(logic.spellEffectSpec('inflict wounds', { slotLevel: 1 }).spec === '2d10' && logic.spellEffectSpec('inflict wounds', { slotLevel: 2 }).spec === '3d10', 'Inflict Wounds 2d10 base, 3d10 at 2nd');
check(logic.spellEffectSpec('witch bolt', { slotLevel: 1 }).spec === '2d12' && logic.spellEffectSpec('witch bolt').followUps?.[0]?.damage === '1d12', 'Witch Bolt 2d12 + follow-up 1d12');
for (const k of ['earthquake', 'power word kill', 'meld into stone', 'wish', 'alter self']) {
  check(logic.spellEffectSpec(k) === null, `${k}: conditional damage never auto-applies on cast`);
  check(logic.spellEffectSpec(k, { includeConditional: true })?.condition, `${k}: conditional data readable on request`);
}
check(logic.spellEffectSpec('tsunami')?.spec === '6d10' && logic.spellEffectSpec('tsunami').damageOnSave === 'half', 'Tsunami 6d10, half on save');

// ---------------------------------------------------------------- (l)
group('(l) material enforcement at cast time (real DB)');
const { initDatabase, dbRun, dbGet } = await imp('server/database.js');
const { castSpell } = await imp('server/services/spellCastService.js');
await initDatabase();
const camp = await dbRun(`INSERT INTO campaigns (name, setting, status) VALUES ('TEST_MATERIAL', 'FR', 'active')`);
const CAMP = Number(camp.lastInsertRowid);
async function caster(cls, inv) {
  const r = await dbRun(
    `INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id, spell_slots, spell_slots_used, inventory)
     VALUES ('TEST_Mat', ?, 'Human', 17, 90, 90, 'TEST', 900, ?, ?, ?, ?)`,
    [cls, CAMP, JSON.stringify({ 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }), JSON.stringify({}), JSON.stringify(inv)]);
  return Number(r.lastInsertRowid);
}
const slots = async (id) => JSON.parse((await dbGet('SELECT spell_slots_used FROM characters WHERE id = ?', [id])).spell_slots_used || '{}');
const inv = async (id) => JSON.parse((await dbGet('SELECT inventory FROM characters WHERE id = ?', [id])).inventory || '[]');
const ids = [];
try {
  // Revivify without diamonds: refused, no slot spent.
  let id = await caster('Cleric', [{ name: 'Rope', quantity: 1 }]); ids.push(id);
  let r = await castSpell(id, 'Revivify', 3);
  check(r?.success === false && /diamonds worth 300 GP/.test(r.reason || ''), `Revivify refused without diamonds (${r?.reason})`);
  check(!(await slots(id))['3'], 'no 3rd-level slot spent on the refusal');
  // Not enough value: 200 GP of diamonds.
  id = await caster('Cleric', [{ name: 'Diamond', quantity: 2, price_gp: 100 }]); ids.push(id);
  r = await castSpell(id, 'Revivify', 3);
  check(r?.success === false && /200 GP/.test(r.reason || ''), 'Revivify refused with only 200 GP of diamonds');
  // Enough: three 100 GP diamonds + a 1,000 GP one — spends the cheapest that cover it.
  id = await caster('Cleric', [{ name: 'Diamond', quantity: 3, price_gp: 100 }, { name: 'Flawless Diamond', quantity: 1, price_gp: 5000 }]); ids.push(id);
  r = await castSpell(id, 'Revivify', 3);
  check(r?.success === true && r.slotConsumed === true, 'Revivify casts with 300 GP of diamonds');
  const after = await inv(id);
  check(!after.some(i => i.name === 'Diamond') && after.some(i => i.name === 'Flawless Diamond'), 'the 300 GP of diamonds is consumed; the 5,000 GP one is kept');
  check(r.materialSpent?.spent?.[0]?.quantity === 3, 'cast result reports the spent material');
  // Heroes' Feast consumed.
  id = await caster('Cleric', [{ name: 'Gem-encrusted Bowl', quantity: 1, price_gp: 1000 }]); ids.push(id);
  r = await castSpell(id, "Heroes' Feast", 6);
  check(r?.success === true && (await inv(id)).length === 0, "Heroes' Feast casts and consumes the bowl");
  id = await caster('Cleric', []); ids.push(id);
  r = await castSpell(id, "Heroes' Feast", 6);
  check(r?.success === false, "Heroes' Feast refused without the bowl");
  // Astral Projection: refused without; casts with (consumed not stated → kept).
  id = await caster('Wizard', []); ids.push(id);
  check((await castSpell(id, 'Astral Projection', 9))?.success === false, 'Astral Projection refused without the jacinthe');
  id = await caster('Wizard', [{ name: 'Jacinth (1,000 gp)', quantity: 1 }]); ids.push(id);
  r = await castSpell(id, 'Astral Projection', 9);
  check(r?.success === true && (await inv(id)).length === 1, 'Astral Projection casts with a 1,000 GP jacinth (value read from its name)');
  // Arcane Lock.
  id = await caster('Wizard', [{ name: 'Gold dust', quantity: 1, price_gp: 10 }]); ids.push(id);
  check((await castSpell(id, 'Arcane Lock', 2))?.success === false, 'Arcane Lock refused with only 10 GP of gold dust');
  id = await caster('Wizard', [{ name: 'Gold dust', quantity: 1, price_gp: 25 }]); ids.push(id);
  check((await castSpell(id, 'Arcane Lock', 2))?.success === true, 'Arcane Lock casts with 25 GP of gold dust');
  // Swift Quiver: a plain quiver (price from the equipment list) satisfies it and is not consumed.
  id = await caster('Ranger', [{ name: 'Quiver', quantity: 1 }]); ids.push(id);
  r = await castSpell(id, 'Swift Quiver', 5);
  check(r?.success === true && (await inv(id)).length === 1, 'Swift Quiver casts with a 1 GP quiver, which is kept');
  // A spell with no enforced material is untouched.
  id = await caster('Wizard', []); ids.push(id);
  check((await castSpell(id, 'Fireball', 3))?.success === true, 'Fireball (plain M) needs no carried component');
} finally {
  for (const id of ids) await dbRun('DELETE FROM characters WHERE id = ?', [id]);
  await dbRun('DELETE FROM campaigns WHERE id = ?', [CAMP]);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
