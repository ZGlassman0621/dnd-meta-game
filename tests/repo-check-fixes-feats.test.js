// tests/repo-check-fixes-feats.test.js — the feat catalog is the 2024 PHB
// (docs/pm/repo-check-fixes-feats/BRIEF.md). Pure catalog/registry checks,
// the picker helpers, the server catalog check, and the real level-up route
// over a throwaway DB. Test characters are invented (Hale Brindle, Ama Kest
// and friends).
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-feats2024-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const reg = await import(svc('server/data/featRegistry.js'));
const cat = await import(svc('server/data/featCatalog.js'));
const pick = await import(svc('client/src/components/featPickHelpers.js'));
const { getXPToNextLevel } = await import(svc('server/config/levelProgression.js'));
const feats = JSON.parse(fs.readFileSync(path.join(REPO, 'client/src/data/feats.json'), 'utf8'));
const registrySrc = fs.readFileSync(path.join(REPO, 'server/data/featRegistry.js'), 'utf8');

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; console.log('  ✓ ' + msg); }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}
const J = JSON.stringify;
const byName = Object.fromEntries(Object.entries(feats).map(([k, v]) => [v.name, { key: k, ...v }]));
const ALL = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const M = ['int', 'wis', 'cha'];

// The book's 75 feats, by category (PHB 2024 Ch. 5 Feat List).
const BOOK = {
  Origin: ['Alert', 'Crafter', 'Healer', 'Lucky', 'Magic Initiate', 'Musician', 'Savage Attacker', 'Skilled', 'Tavern Brawler', 'Tough'],
  General: ['Ability Score Improvement', 'Actor', 'Athlete', 'Charger', 'Chef', 'Crossbow Expert', 'Crusher', 'Defensive Duelist',
    'Dual Wielder', 'Durable', 'Elemental Adept', 'Fey-Touched', 'Grappler', 'Great Weapon Master', 'Heavily Armored',
    'Heavy Armor Master', 'Inspiring Leader', 'Keen Mind', 'Lightly Armored', 'Mage Slayer', 'Martial Weapon Training',
    'Medium Armor Master', 'Moderately Armored', 'Mounted Combatant', 'Observant', 'Piercer', 'Poisoner', 'Polearm Master',
    'Resilient', 'Ritual Caster', 'Sentinel', 'Shadow-Touched', 'Sharpshooter', 'Shield Master', 'Skill Expert', 'Skulker',
    'Slasher', 'Speedy', 'Spell Sniper', 'Telekinetic', 'Telepathic', 'War Caster', 'Weapon Master'],
  'Fighting Style': ['Archery', 'Blind Fighting', 'Defense', 'Dueling', 'Great Weapon Fighting', 'Interception', 'Protection',
    'Thrown Weapon Fighting', 'Two-Weapon Fighting', 'Unarmed Fighting'],
  'Epic Boon': ['Boon of Combat Prowess', 'Boon of Dimensional Travel', 'Boon of Energy Resistance', 'Boon of Fate',
    'Boon of Fortitude', 'Boon of Irresistible Offense', 'Boon of Recovery', 'Boon of Skill', 'Boon of Speed',
    'Boon of Spell Recall', 'Boon of the Night Spirit', 'Boon of Truesight'],
};
const BOOK_NAMES = Object.values(BOOK).flat();

// Book prerequisite per General feat (brief items 1-2, verbatim).
const GENERAL_PREREQ = {
  'Ability Score Improvement': 'Level 4+', Actor: 'Level 4+, Charisma 13+', Athlete: 'Level 4+, Strength or Dexterity 13+',
  Charger: 'Level 4+, Strength or Dexterity 13+', Chef: 'Level 4+', 'Crossbow Expert': 'Level 4+, Dexterity 13+', Crusher: 'Level 4+',
  'Defensive Duelist': 'Level 4+, Dexterity 13+', 'Dual Wielder': 'Level 4+, Strength or Dexterity 13+', Durable: 'Level 4+',
  'Elemental Adept': 'Level 4+, Spellcasting or Pact Magic Feature', 'Fey-Touched': 'Level 4+', Grappler: 'Level 4+, Strength or Dexterity 13+',
  'Great Weapon Master': 'Level 4+, Strength 13+', 'Heavily Armored': 'Level 4+, Medium Armor Training',
  'Heavy Armor Master': 'Level 4+, Heavy Armor Training', 'Inspiring Leader': 'Level 4+, Wisdom or Charisma 13+',
  'Keen Mind': 'Level 4+, Intelligence 13+', 'Lightly Armored': 'Level 4+', 'Mage Slayer': 'Level 4+', 'Martial Weapon Training': 'Level 4+',
  'Medium Armor Master': 'Level 4+, Medium Armor Training', 'Moderately Armored': 'Level 4+, Light Armor Training', 'Mounted Combatant': 'Level 4+',
  Observant: 'Level 4+, Intelligence or Wisdom 13+', Piercer: 'Level 4+', Poisoner: 'Level 4+', 'Polearm Master': 'Level 4+, Strength or Dexterity 13+',
  Resilient: 'Level 4+', 'Ritual Caster': 'Level 4+; Intelligence, Wisdom, or Charisma 13+', Sentinel: 'Level 4+, Strength or Dexterity 13+',
  'Shadow-Touched': 'Level 4+', Sharpshooter: 'Level 4+, Dexterity 13+', 'Shield Master': 'Level 4+, Shield Training', 'Skill Expert': 'Level 4+',
  Skulker: 'Level 4+, Dexterity 13+', Slasher: 'Level 4+', Speedy: 'Level 4+, Dexterity or Constitution 13+',
  'Spell Sniper': 'Level 4+, Spellcasting or Pact Magic Feature', Telekinetic: 'Level 4+', Telepathic: 'Level 4+',
  'War Caster': 'Level 4+, Spellcasting or Pact Magic Feature', 'Weapon Master': 'Level 4+',
};

// The book's +1 options per feat (null = no +1 on the feat itself).
const ASI = {
  Actor: ['cha'], Athlete: ['str', 'dex'], Charger: ['str', 'dex'], Chef: ['con', 'wis'], 'Crossbow Expert': ['dex'], Crusher: ['str', 'con'],
  'Defensive Duelist': ['dex'], 'Dual Wielder': ['str', 'dex'], Durable: ['con'], 'Elemental Adept': M, 'Fey-Touched': M, Grappler: ['str', 'dex'],
  'Great Weapon Master': ['str'], 'Heavily Armored': ['con', 'str'], 'Heavy Armor Master': ['con', 'str'], 'Inspiring Leader': ['wis', 'cha'],
  'Keen Mind': ['int'], 'Lightly Armored': ['str', 'dex'], 'Mage Slayer': ['str', 'dex'], 'Martial Weapon Training': ['str', 'dex'],
  'Medium Armor Master': ['str', 'dex'], 'Moderately Armored': ['str', 'dex'], 'Mounted Combatant': ['str', 'dex', 'wis'], Observant: ['int', 'wis'],
  Piercer: ['str', 'dex'], Poisoner: ['dex', 'int'], 'Polearm Master': ['dex', 'str'], Resilient: ALL, 'Ritual Caster': M, Sentinel: ['str', 'dex'],
  'Shadow-Touched': M, Sharpshooter: ['dex'], 'Shield Master': ['str'], 'Skill Expert': ALL, Skulker: ['dex'], Slasher: ['str', 'dex'],
  Speedy: ['dex', 'con'], 'Spell Sniper': M, Telekinetic: M, Telepathic: M, 'War Caster': M, 'Weapon Master': ['str', 'dex'],
  'Boon of Irresistible Offense': ['str', 'dex'], 'Boon of Spell Recall': M,
};
for (const n of BOOK['Epic Boon']) if (!ASI[n]) ASI[n] = ALL;

const HOMEBREW = ['tactician', 'sage_advice', 'hound', 'feather_foot', 'seismic_touch', 'trapper', 'friend_of_the_forest',
  'elusive', 'sling_expert', 'mountaineer', 'quick_draw', 'silver_tongue', 'elegant_maneuver'];
const STAY_2014 = ['dungeon_delver', 'linguist', 'martial_adept'];
const optsOf = (f) => pick.featAbilityOptions(f);
const allText = (f) => [f.description, ...(f.benefits || []), f.prerequisites || ''].join(' ');

// ===========================================================================
group('1. Catalog: all 75 book feats, 3 staying 2014 feats, 13 homebrew = 91');
{
  ok(Object.keys(feats).length === 91, `91 entries (got ${Object.keys(feats).length})`);
  const missing = BOOK_NAMES.filter((n) => !byName[n]);
  ok(BOOK_NAMES.length === 75 && missing.length === 0, `all 75 book feats present (missing: ${missing.join(', ') || 'none'})`);
  for (const [c, names] of Object.entries(BOOK)) {
    ok(names.every((n) => byName[n].category === c && !byName[n].source), `${names.length} ${c} feats carry category "${c}" and no source tag`);
  }
  ok(Object.values(feats).every((f) => ['Origin', 'General', 'Fighting Style', 'Epic Boon'].includes(f.category)), 'every entry carries a book category');
  ok(STAY_2014.every((k) => feats[k]?.source === '2014' && feats[k].category === 'General'), 'Dungeon Delver, Linguist, Martial Adept: source "2014", category General');
  ok(HOMEBREW.every((k) => /^Homebrew — /.test(feats[k]?.source || '') && feats[k].category === 'General'
    && reg.getFeatEffect(k)?.category === 'general'), 'the 13 homebrew feats keep their source tag and take the registry\'s category (general)');
  ok(Object.values(feats).filter((f) => f.name === 'Speedy').length === 1 && !feats.mobile && !Object.values(feats).some((f) => f.name === 'Mobile'), 'Speedy once; Mobile nowhere');
  ok(!!feats.martial_weapon_training && !!feats.martial_adept && feats.martial_weapon_training.name !== feats.martial_adept.name, 'Martial Weapon Training and Martial Adept are two distinct feats');
  const outOfBook = ['Fighting Initiate', 'Gunner', 'Aberrant Dragonmark'];
  ok(!outOfBook.some((n) => byName[n] || registrySrc.includes(`'${n}'`)), 'Fighting Initiate, Gunner, Aberrant Dragonmark are in neither file');
}

// ===========================================================================
group('2. Prerequisites, levels, repeatable — book wording');
{
  ok(BOOK.Origin.every((n) => byName[n].prerequisites === null && !byName[n].minLevel), 'Origin feats: no prerequisite, no level gate');
  const badGen = BOOK.General.filter((n) => byName[n].prerequisites !== GENERAL_PREREQ[n] || byName[n].minLevel !== 4);
  ok(badGen.length === 0, `all 43 General feats: book prerequisite wording + minLevel 4 (wrong: ${badGen.join(', ') || 'none'})`);
  ok(BOOK['Fighting Style'].every((n) => byName[n].prerequisites === 'Fighting Style Feature' && byName[n].prerequisiteFeature === 'fighting_style'), 'Fighting Style feats: "Fighting Style Feature"');
  ok(BOOK['Epic Boon'].every((n) => byName[n].minLevel === 19 && byName[n].prerequisites === (n === 'Boon of Spell Recall' ? 'Level 19+, Spellcasting Feature' : 'Level 19+')), 'Epic Boons: Level 19+ (Spell Recall + Spellcasting Feature)');
  const rep = Object.values(feats).filter((f) => f.repeatable === true).map((f) => f.name).sort();
  ok(J(rep) === J(['Ability Score Improvement', 'Elemental Adept', 'Magic Initiate', 'Skilled']), `repeatable exactly on ASI, Elemental Adept, Magic Initiate, Skilled (got ${rep.join(', ')})`);
  ok(Object.values(feats).every((f) => typeof f.repeatable === 'boolean'), 'every entry carries a boolean repeatable');
  ok(byName.Skilled.benefits.includes('Repeatable. You can take this feat more than once.'), 'Skilled gains the Repeatable note');
  ok(byName['Heavily Armored'].prerequisites === 'Level 4+, Medium Armor Training', 'Heavily Armored: the 2014 "Proficiency with medium armor" is replaced');
}

// ===========================================================================
group('3. +1 options match the book (incl. choices) and the caps');
{
  const wrong = [];
  for (const n of BOOK_NAMES) {
    const want = ASI[n] || [];
    if (J(optsOf(byName[n])) !== J(want)) wrong.push(`${n}: ${J(optsOf(byName[n]))} ≠ ${J(want)}`);
  }
  ok(wrong.length === 0, `every book feat's +1 options match the book (${wrong.join('; ') || 'all match'})`);
  ok(BOOK.Origin.every((n) => !byName[n].abilityIncrease), 'no Origin feat grants a +1 (Tavern Brawler\'s 2014 Str/Con +1 is gone)');
  ok(BOOK['Epic Boon'].every((n) => pick.featAbilityMax(byName[n]) === 30), 'Epic Boons cap the +1 at 30');
  ok(BOOK.General.filter((n) => ASI[n]).every((n) => pick.featAbilityMax(byName[n]) === 20), 'General feats cap the +1 at 20');
  ok(byName.Resilient.abilityIncrease.lackingSaveProficiency === true, 'Resilient carries the lack-save-proficiency restriction');
}

// ===========================================================================
group('4. Book text present; no 2014 text survives in a book feat');
{
  const has = (n, s) => allText(byName[n]).includes(s);
  ok(has('Alert', 'Initiative Swap. Immediately after you roll Initiative, you can swap your Initiative'), 'Alert: Initiative Swap');
  ok(has('Great Weapon Master', 'The extra damage equals your Proficiency Bonus.') && has('Great Weapon Master', 'Hew.'), 'Great Weapon Master: Heavy Weapon Mastery + Hew');
  ok(has('Protection', 'and all other attack rolls against the target until the start of your next turn if you remain within 5 feet of the target'), 'Protection: the extended Disadvantage (registry omitted it)');
  ok(has('Unarmed Fighting', 'At the start of each of your turns, you can deal 1d4 Bludgeoning damage to one creature Grappled by you.'), 'Unarmed Fighting: the 1d4 to a Grappled creature (registry omitted it)');
  ok(has('Boon of Irresistible Offense', 'equal to the ability score increased by this feat'), 'Overwhelming Strike: the ability SCORE, not the modifier');
  ok(has('Magic Initiate', 'Cleric, Druid, or Wizard spell list') && J(byName['Magic Initiate'].choices[0].options) === J(['cleric', 'druid', 'wizard']), 'Magic Initiate: Cleric/Druid/Wizard only (text + choice)');
  ok(has('Savage Attacker', 'when you hit a target with a weapon') && !/melee/i.test(allText(byName['Savage Attacker'])), 'Savage Attacker: any weapon, not melee only');
  ok(has('Lightly Armored', 'Light armor and Shields') && !/shields/i.test(allText(byName['Moderately Armored'])), 'Shields moved from Moderately to Lightly Armored');
  ok(has('Speedy', 'Opportunity Attacks have Disadvantage against you.'), 'Speedy: Agile Movement');
  ok(J(byName.Crafter.fastCraftingTable["Smith's Tools"]) === J(['Ball Bearings', 'Bucket', 'Caltrops', 'Grappling Hook', 'Iron Pot'])
    && Object.keys(byName.Crafter.fastCraftingTable).length === 8, 'Crafter carries the Fast Crafting table (8 tools)');
  const OLD = [/\+5 bonus to initiative/i, /-5 to attack/i, /\+10 damage/i, /3 luck points/i, /ritual book/i, /read lips/i,
    /passive Perception/i, /pin a creature/i, /nonmagical weapons/i, /reduced by 3/i, /twice your Constitution modifier/i,
    /which way is north/i, /double range/i, /\+1 bonus to AC while wielding/i, /bard, cleric, druid, sorcerer/i,
    /four weapons of your choice/i, /lightly obscured/i, /disadvantage on Stealth/i, /10-minute speech/i,
    /bonus action to attempt to grapple/i, /bonus action to shove/i, /hand crossbow you are holding/i, /The ability to cast at least one spell/i];
  const hits = [];
  for (const n of BOOK_NAMES) for (const re of OLD) if (re.test(allText(byName[n]))) hits.push(`${n} ~ ${re}`);
  ok(hits.length === 0, `no 2014 phrase in any book feat (${hits.join('; ') || 'clean'})`);
  ok(BOOK_NAMES.filter((n) => n !== 'Tough' && n !== 'Skilled').every((n) => byName[n].description.startsWith(`${byName[n].category === 'Epic Boon' ? 'Epic Boon' : byName[n].category} Feat`)), 'book feats open with the book\'s category line');
}

// ===========================================================================
group('5. Registry: fixed entries, Mobile → Speedy, agreement with the catalog');
{
  ok(!reg.getFeatEffect('Mobile') && !/key: 'mobile'/.test(registrySrc), 'Mobile is gone from the registry');
  ok(reg.getFeatEffect('Speedy')?.category === 'general' && (registrySrc.match(/key: 'speedy'/g) || []).length === 1, 'Speedy is in the registry once, as general');
  ok(!/Disengage to avoid/.test(reg.getFeatEffect('Sentinel').effect) && /Guardian/.test(reg.getFeatEffect('Sentinel').effect), 'Sentinel: the invented Disengage clause is gone; Guardian + Halt');
  ok(!/dim light/i.test(reg.getFeatEffect('Skulker').effect) && /Blindsight 10 ft/.test(reg.getFeatEffect('Skulker').effect), 'Skulker: the invented dim-light clause is gone; Blindsight/Fog of War/Sniper');
  ok(!/passive|lips/i.test(reg.getFeatEffect('Observant').effect) && /Quick Search/.test(reg.getFeatEffect('Observant').effect), 'Observant: Keen Observer + Quick Search, not 2014');
  ok(/lack saving throw proficiency/.test(reg.getFeatEffect('Resilient').effect), 'Resilient: the lack-save-proficiency restriction');
  ok(!/Reaction attack when an adjacent creature casts/.test(reg.getFeatEffect('Mage Slayer').effect) && /Guarded Mind/.test(reg.getFeatEffect('Mage Slayer').effect), 'Mage Slayer: 2024 text (found 2014 in the registry too)');
  ok(!/once per turn/.test(reg.getFeatEffect('Great Weapon Master').effect), 'Great Weapon Master: no invented "once per turn"');
  ok(/1d4 bludgeoning damage to one creature Grappled/.test(reg.getFeatEffect('Unarmed Fighting').effect), 'Unarmed Fighting (registry): the Grappled 1d4');
  ok(/all other attack rolls against the target/.test(reg.getFeatEffect('Protection').effect), 'Protection (registry): the extended Disadvantage');
  ok(/Two-Handed or Versatile/.test(reg.getFeatEffect('Great Weapon Fighting').effect), 'Great Weapon Fighting (registry): Two-Handed or Versatile');
  ok(/leaving your reach/.test(reg.getFeatEffect('War Caster').effect), 'War Caster (registry): "by leaving your reach"');

  // Agreement: every PHB feat in both files — same category, and the same
  // +1 abilities named (registry text) as the catalog offers.
  const CAT = { origin: 'Origin', general: 'General', fighting_style: 'Fighting Style' };
  const AB = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
  const shared = BOOK_NAMES.filter((n) => { const e = reg.getFeatEffect(n); return e && e.source === 'core'; });
  const disagree = [];
  for (const n of shared) {
    const e = reg.getFeatEffect(n); const c = byName[n];
    if (CAT[e.category] !== c.category) disagree.push(`${n}: category ${e.category} vs ${c.category}`);
    const opts = optsOf(c);
    if (opts.length && opts.length < 6) {
      const lead = e.effect.split(';')[0];
      const named = Object.keys(AB).filter((a) => lead.includes(AB[a]));
      if (J([...named].sort()) !== J([...opts].sort())) disagree.push(`${n}: +1 ${named} vs ${opts}`);
    }
    if (!opts.length && /^\+1 (Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|to one)/.test(e.effect)) disagree.push(`${n}: registry has a +1 the book lacks`);
  }
  ok(shared.length === 30, `30 PHB feats are in both files (got ${shared.length})`);
  ok(disagree.length === 0, `registry and catalog agree on every shared PHB feat (${disagree.join('; ') || 'all agree'})`);
}

// ===========================================================================
group('6. Picker helpers');
{
  const ctx = { level: 4, scores: { str: 10, dex: 13, con: 10, int: 10, wis: 10, cha: 10 }, heldFeats: [], hasFightingStyle: false, saveProficiencies: ['str', 'con'] };
  ok(pick.featPickBlockReason('speedy', feats.speedy, ctx) === null, 'Speedy at L4 with Dex 13: offered');
  ok(/requires/.test(pick.featPickBlockReason('speedy', feats.speedy, { ...ctx, scores: { dex: 12, con: 12 } })), 'Speedy with Dex 12 and Con 12: blocked (either-or prerequisite)');
  ok(pick.featPickBlockReason('speedy', feats.speedy, { ...ctx, scores: { dex: 8, con: 13 } }) === null, 'Speedy with Con 13 only: offered (either one suffices)');
  ok(/level 4/.test(pick.featPickBlockReason('chef', feats.chef, { ...ctx, level: 3 })), 'a General feat below level 4: blocked');
  ok(/level 19/.test(pick.featPickBlockReason('boon_of_fate', feats.boon_of_fate, { ...ctx, level: 16 })) && pick.featPickBlockReason('boon_of_fate', feats.boon_of_fate, { ...ctx, level: 19 }) === null, 'an Epic Boon: blocked at 16, offered at 19');
  ok(/Fighting Style/.test(pick.featPickBlockReason('archery', feats.archery, ctx)) && pick.featPickBlockReason('archery', feats.archery, { ...ctx, hasFightingStyle: true }) === null, 'Archery needs the Fighting Style feature');
  ok(/already taken/.test(pick.featPickBlockReason('alert', feats.alert, { ...ctx, heldFeats: [{ key: 'alert', name: 'Alert' }] })), 'a held non-repeatable feat: blocked');
  ok(pick.featPickBlockReason('skilled', feats.skilled, { ...ctx, heldFeats: [{ key: 'skilled', name: 'Skilled' }] }) === null, 'Skilled again: offered (Repeatable)');
  ok(J(pick.featAbilityOptions(feats.resilient, ctx)) === J(['dex', 'int', 'wis', 'cha']), 'Resilient for a Str/Con-save class: Dex, Int, Wis, Cha only');
  const sp = pick.characterSaveProficiencies(['str', 'con'], [{ key: 'resilient', abilityChoice: 'wis' }]);
  ok(J(sp) === J(['str', 'con', 'wis']), 'an earlier Resilient (Wis) counts as a save proficiency');
}

// ===========================================================================
group('7. Server catalog check');
{
  ok(J(cat.saveProficienciesFor('Fighter', [])) === J(['str', 'con']) && J(cat.saveProficienciesFor('Blood Hunter', [])) === J(['dex', 'int']), 'class saves read from classes.json');
  const e = (k) => cat.getCatalogFeat(k);
  ok(e('Great Weapon Master')?.key === 'great_weapon_master' && !e('mobile'), 'lookup by key or name; Mobile is not in the catalog');
  const base = { level: 4, scores: { str: 13, dex: 13, con: 13, int: 13, wis: 13, cha: 13 }, heldFeats: [], hasFightingStyle: false, saveProficiencies: ['str', 'con'] };
  ok(/lack saving throw/.test(cat.checkCatalogFeatPick(e('resilient'), { ...base, abilityChoice: 'con' }).error || ''), 'Resilient CON for a Fighter: refused');
  ok(cat.checkCatalogFeatPick(e('resilient'), { ...base, abilityChoice: 'wis' }).abilityChoice === 'wis', 'Resilient WIS for a Fighter: accepted');
  ok(cat.checkCatalogFeatPick(e('great_weapon_master'), { ...base, abilityChoice: null }).abilityChoice === 'str', 'a single-ability +1 (GWM: Str) is filled in');
  ok(/choose/.test(cat.checkCatalogFeatPick(e('heavily_armored'), { ...base, abilityChoice: null }).error || '') && cat.checkCatalogFeatPick(e('heavily_armored'), { ...base, abilityChoice: 'con' }).abilityChoice === 'con', 'Heavily Armored: Con or Str must be chosen; Con accepted');
  ok(/grants no ability/.test(cat.checkCatalogFeatPick(e('alert'), { ...base, abilityChoice: 'dex' }).error || ''), 'Alert with a +1: refused (no +1 in 2024)');
  ok(cat.checkCatalogFeatPick(e('boon_of_truesight'), { ...base, level: 19, abilityChoice: 'wis' }).abilityMax === 30, 'an Epic Boon\'s +1 caps at 30');
  ok(/as an ASI/.test(cat.checkCatalogFeatPick(e('ability_score_improvement'), base).error || ''), 'the ASI feat goes through the ASI path');
}

// ===========================================================================
group('8. Real level-up route');
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
async function fighterAt3(name, scores, extra = {}) {
  const created = await req('POST', '/api/character', { name, class: 'Fighter', race: 'human' });
  const id = created.json.id;
  await req('PUT', `/api/character/${id}`, {
    level: 3, experience: getXPToNextLevel(3), max_hp: 28, current_hp: 28,
    ability_scores: J(scores), class_levels: J([{ class: 'Fighter', level: 3, subclass: 'Champion' }]), ...extra,
  });
  return id;
}
const featUp = (id, featKey, ability, featName) => req('POST', `/api/character/level-up/${id}`, {
  selectedClass: 'Fighter', hpRoll: 'average',
  asiChoice: { type: 'feat', feat: featKey, featName: featName ?? feats[featKey]?.name ?? featKey, featAbilityChoice: ability ?? null },
});
const row = (id) => dbGet('SELECT level, ability_scores, feats FROM characters WHERE id = ?', [id]);
{
  const sc = { str: 15, dex: 12, con: 12, int: 10, wis: 12, cha: 10 };
  const a = await fighterAt3('Hale Brindle', sc);
  const con = await featUp(a, 'resilient', 'con');
  ok(con.status === 400 && /lack saving throw/.test(con.json?.error || ''), `Resilient CON on a Fighter is refused (got ${con.status})`);
  ok((await row(a)).level === 3, 'the refused level-up changes nothing');
  const wis = await featUp(a, 'resilient', 'wis');
  const ra = await row(a);
  ok(wis.status === 200 && ra.level === 4 && JSON.parse(ra.ability_scores).wis === 13, 'Resilient WIS lands: L4, Wis 12 → 13');

  const b = await fighterAt3('Ama Kest', sc);
  ok((await featUp(b, 'boon_of_fate', 'wis')).status === 400, 'an Epic Boon at level 4 is refused');
  ok((await featUp(b, 'speedy', 'dex')).status === 400, 'Speedy with Dex 12 / Con 12 is refused');
  ok((await featUp(b, 'archery', null)).status === 400, 'Archery with no Fighting Style feature is refused');
  ok((await featUp(b, 'mobile', null, 'Mobile')).status === 400, 'Mobile (removed) is refused');
  ok((await featUp(b, 'tavern_brawler', 'str')).status === 400, 'Tavern Brawler with a +1 is refused (no +1 in 2024)');
  const gwm = await featUp(b, 'great_weapon_master', null);
  const rb = await row(b);
  ok(gwm.status === 200 && JSON.parse(rb.ability_scores).str === 16 && JSON.parse(rb.feats).some((f) => f.key === 'great_weapon_master' && f.abilityChoice === 'str'), 'Great Weapon Master lands with its fixed Str +1');

  const c = await fighterAt3('Tobin Ree', sc, { fighting_style: 'Defense' });
  const arch = await featUp(c, 'archery', null);
  ok(arch.status === 200 && JSON.parse((await row(c)).feats).some((f) => f.key === 'archery'), 'Archery lands for a character with a fighting style');

  const d = await fighterAt3('Wila Fen', sc, { feats: J([{ key: 'alert', name: 'Alert', acquiredAtLevel: 1 }]) });
  ok((await featUp(d, 'alert', null)).status === 400, 'Alert a second time is refused (not Repeatable)');
}

server.close();
console.log(`\nrepo-check-fixes-feats: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
