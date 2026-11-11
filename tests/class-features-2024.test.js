// CLASS_FEATURES 2024 rebuild — gate suite (staged with class-features-2024.patch.md).
//
// What this pins: every 2024 PHB class-feature row (name + level + order) for
// all 12 PHB classes, asserted against the researched 2024 tables
// (see ~/workspace/dnd-app-review/blood-hunter-mixed-ancestry/class-features/notes.md
// for the per-class sources). Real import of CLASS_FEATURES / getClassFeatures
// from server/config/levelProgression.js — no re-implemented logic, no DB.
//
// The 6 already-fixed rows from gaps-batch item 28 are pinned again here by
// name (their 2024 values, not the 2014 names the old test pinned).
//
// Contested row, SETTLED by this research (do not re-open without the book):
// cleric L8 'Domain Feature' does NOT exist in 2024 — the SRD 5.2 Cleric
// Features table lists subclass features at 6th and 17th only, and the
// Roll20 2024 Cleric compendium lists no 8th-level feature heading at all.
// The L8 assert below pins ['Ability Score Improvement'] only.
//
// Naming convention (2024 PHB tables verbatim, and the in-file artificer
// precedent): subclass-selection rows read '<Class> Subclass'; later subclass
// rows read 'Subclass Feature'. Rows that are only table-column values in
// 2024 (Bardic Inspiration die steps, Channel Divinity use counts, Destroy
// Undead CR steps, Wild Shape improvements, Favored Enemy / Natural Explorer
// improvements) are absent, not renamed.
//
// Flagged, NOT asserted here (out of scope — coordinator call): ASI_LEVELS
// in the same file still lists 19 as an ASI level for every class, while
// every 2024 table grants an Epic Boon at 19. See notes.md.
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const fromRepo = (rel) => pathToFileURL(path.join(repoRoot, rel)).href;

const { CLASS_FEATURES, getClassFeatures, SNEAK_ATTACK_DICE } = await import(fromRepo('server/config/levelProgression.js'));

// The researched 2024 PHB tables (feature name + level, table order kept).
// Source per class: SRD 5.2 class page (dnd-wiki.org, 5e24) corroborated by
// the D&D Beyond 2024 "what's new" article and/or the Roll20 2024 compendium.
// Two dnd-wiki table slips were caught and corrected against the other
// sources (fighter L5, bard L7, rogue L1) — see notes.md.
// PHB-PHOTO VERIFICATION 2026-11-06 (source: '2024 PHB photos,
// Zach-provided 2026-11-06'): the barbarian, bard, cleric, druid,
// fighter, rogue, warlock, monk, ranger, paladin, and sorcerer rows in EXPECTED_2024 below were verified
// level-by-level against Zach's 2024 PHB photos and MATCHED the
// researched tables exactly — zero row changes. The web sources above
// are now corroboration; the photos are the primary source for those
// twelve classes. Groups (h)–(s) pin the discriminating rows +
// per-class totals for those twelve classes against the photos.
// Wizard rows photo-verified 2026-11-06 (11 photos, pp. 165-175) — matched
// exactly, zero row changes. Group (n) pins the discriminating rows + total.
// Warlock rows photo-verified 2026-11-06 (11 photos, pp. 153-163) — matched
// exactly, zero row changes. Group (o) pins the discriminating rows + total.
// Monk rows photo-verified 2026-11-06 (7 photos, pp. 101-107) — matched
// exactly, zero row changes. Group (p) pins the discriminating rows + total.
// Ranger rows photo-verified 2026-11-06 (9 photos, pp. 119-124) — matched
// exactly, zero row changes. Group (q) pins the discriminating rows + total.
// Paladin rows photo-verified 2026-11-06 (9 photos, pp. 109–117) — matched
// exactly, zero row changes. Group (r) pins the discriminating rows + total.
// Sorcerer rows photo-verified 2026-11-06 (13 photos, pp. 139–150) — matched
// exactly, zero row changes. Group (s) pins the discriminating rows + total.
const EXPECTED_2024 = {
  barbarian: {
    1: ['Rage', 'Unarmored Defense', 'Weapon Mastery'],
    2: ['Danger Sense', 'Reckless Attack'],
    3: ['Barbarian Subclass', 'Primal Knowledge'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Fast Movement'],
    6: ['Subclass Feature'],
    7: ['Feral Instinct', 'Instinctive Pounce'],
    8: ['Ability Score Improvement'],
    9: ['Brutal Strike'],
    10: ['Subclass Feature'],
    11: ['Relentless Rage'],
    12: ['Ability Score Improvement'],
    13: ['Improved Brutal Strike'],
    14: ['Subclass Feature'],
    15: ['Persistent Rage'],
    16: ['Ability Score Improvement'],
    17: ['Improved Brutal Strike'],
    18: ['Indomitable Might'],
    19: ['Epic Boon'],
    20: ['Primal Champion'],
  },
  bard: {
    1: ['Bardic Inspiration', 'Spellcasting'],
    2: ['Expertise', 'Jack of All Trades'],
    3: ['Bard Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Font of Inspiration'],
    6: ['Subclass Feature'],
    7: ['Countercharm'],
    8: ['Ability Score Improvement'],
    9: ['Expertise'],
    10: ['Magical Secrets'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Superior Inspiration'],
    19: ['Epic Boon'],
    20: ['Words of Creation'],
  },
  cleric: {
    1: ['Divine Order', 'Spellcasting'],
    2: ['Channel Divinity'],
    3: ['Cleric Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Sear Undead'],
    6: ['Subclass Feature'],
    7: ['Blessed Strikes'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Divine Intervention'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Improved Blessed Strikes'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: [],
    19: ['Epic Boon'],
    20: ['Greater Divine Intervention'],
  },
  druid: {
    1: ['Druidic', 'Primal Order', 'Spellcasting'],
    2: ['Wild Shape', 'Wild Companion'],
    3: ['Druid Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Wild Resurgence'],
    6: ['Subclass Feature'],
    7: ['Elemental Fury'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: ['Improved Elemental Fury'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Beast Spells'],
    19: ['Epic Boon'],
    20: ['Archdruid'],
  },
  fighter: {
    1: ['Fighting Style', 'Second Wind', 'Weapon Mastery'],
    2: ['Action Surge (one use)', 'Tactical Mind'],
    3: ['Fighter Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Tactical Shift'],
    6: ['Ability Score Improvement'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Indomitable (one use)', 'Tactical Master'],
    10: ['Subclass Feature'],
    11: ['Two Extra Attacks'],
    12: ['Ability Score Improvement'],
    13: ['Indomitable (two uses)', 'Studied Attacks'],
    14: ['Ability Score Improvement'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: ['Action Surge (two uses)', 'Indomitable (three uses)'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Three Extra Attacks'],
  },
  monk: {
    1: ['Martial Arts', 'Unarmored Defense'],
    2: ["Monk's Focus", 'Unarmored Movement', 'Uncanny Metabolism'],
    3: ['Deflect Attacks', 'Monk Subclass'],
    4: ['Ability Score Improvement', 'Slow Fall'],
    5: ['Extra Attack', 'Stunning Strike'],
    6: ['Empowered Strikes', 'Subclass Feature'],
    7: ['Evasion'],
    8: ['Ability Score Improvement'],
    9: ['Acrobatic Movement'],
    10: ['Heightened Focus', 'Self-Restoration'],
    11: ['Subclass Feature'],
    12: ['Ability Score Improvement'],
    13: ['Deflect Energy'],
    14: ['Disciplined Survivor'],
    15: ['Perfect Focus'],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: ['Superior Defense'],
    19: ['Epic Boon'],
    20: ['Body and Mind'],
  },
  paladin: {
    1: ['Lay on Hands', 'Spellcasting', 'Weapon Mastery'],
    2: ['Fighting Style', "Paladin's Smite"],
    3: ['Channel Divinity', 'Paladin Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack', 'Faithful Steed'],
    6: ['Aura of Protection'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Abjure Foes'],
    10: ['Aura of Courage'],
    11: ['Radiant Strikes'],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Restoring Touch'],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Aura Expansion'],
    19: ['Epic Boon'],
    20: ['Subclass Feature'],
  },
  ranger: {
    1: ['Spellcasting', 'Favored Enemy', 'Weapon Mastery'],
    2: ['Deft Explorer', 'Fighting Style'],
    3: ['Ranger Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Extra Attack'],
    6: ['Roving'],
    7: ['Subclass Feature'],
    8: ['Ability Score Improvement'],
    9: ['Expertise'],
    10: ['Tireless'],
    11: ['Subclass Feature'],
    12: ['Ability Score Improvement'],
    13: ['Relentless Hunter'],
    14: ["Nature's Veil"],
    15: ['Subclass Feature'],
    16: ['Ability Score Improvement'],
    17: ['Precise Hunter'],
    18: ['Feral Senses'],
    19: ['Epic Boon'],
    20: ['Foe Slayer'],
  },
  rogue: {
    1: ['Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery'],
    2: ['Cunning Action'],
    3: ['Rogue Subclass', 'Steady Aim'],
    4: ['Ability Score Improvement'],
    5: ['Cunning Strike', 'Uncanny Dodge'],
    6: ['Expertise'],
    7: ['Evasion', 'Reliable Talent'],
    8: ['Ability Score Improvement'],
    9: ['Subclass Feature'],
    10: ['Ability Score Improvement'],
    11: ['Improved Cunning Strike'],
    12: ['Ability Score Improvement'],
    13: ['Subclass Feature'],
    14: ['Devious Strikes'],
    15: ['Slippery Mind'],
    16: ['Ability Score Improvement'],
    17: ['Subclass Feature'],
    18: ['Elusive'],
    19: ['Epic Boon'],
    20: ['Stroke of Luck'],
  },
  sorcerer: {
    1: ['Spellcasting', 'Innate Sorcery'],
    2: ['Font of Magic', 'Metamagic'],
    3: ['Sorcerer Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Sorcerous Restoration'],
    6: ['Subclass Feature'],
    7: ['Sorcery Incarnate'],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Metamagic'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: ['Metamagic'],
    18: ['Subclass Feature'],
    19: ['Epic Boon'],
    20: ['Arcane Apotheosis'],
  },
  warlock: {
    1: ['Eldritch Invocations', 'Pact Magic'],
    2: ['Magical Cunning'],
    3: ['Warlock Subclass'],
    4: ['Ability Score Improvement'],
    5: [],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: ['Contact Patron'],
    10: ['Subclass Feature'],
    11: ['Mystic Arcanum (level 6 spell)'],
    12: ['Ability Score Improvement'],
    13: ['Mystic Arcanum (level 7 spell)'],
    14: ['Subclass Feature'],
    15: ['Mystic Arcanum (level 8 spell)'],
    16: ['Ability Score Improvement'],
    17: ['Mystic Arcanum (level 9 spell)'],
    18: [],
    19: ['Epic Boon'],
    20: ['Eldritch Master'],
  },
  wizard: {
    1: ['Spellcasting', 'Ritual Adept', 'Arcane Recovery'],
    2: ['Scholar'],
    3: ['Wizard Subclass'],
    4: ['Ability Score Improvement'],
    5: ['Memorize Spell'],
    6: ['Subclass Feature'],
    7: [],
    8: ['Ability Score Improvement'],
    9: [],
    10: ['Subclass Feature'],
    11: [],
    12: ['Ability Score Improvement'],
    13: [],
    14: ['Subclass Feature'],
    15: [],
    16: ['Ability Score Improvement'],
    17: [],
    18: ['Spell Mastery'],
    19: ['Epic Boon'],
    20: ['Signature Spells'],
  },
};

const PHB = Object.keys(EXPECTED_2024);

// (a) Every 2024 row, name + level + order, via the real getClassFeatures.
group('(a) 2024 PHB class-feature rows (12 classes x 20 levels)');
for (const cls of PHB) {
  for (let level = 1; level <= 20; level++) {
    const want = EXPECTED_2024[cls][level];
    const got = getClassFeatures(cls, level);
    check(JSON.stringify(got) === JSON.stringify(want),
      `${cls} L${level} is ${JSON.stringify(want)} (got ${JSON.stringify(got)})`);
  }
}

// (b) Shape guard: all 20 level keys present per PHB class.
group('(b) all 20 level keys present per PHB class');
for (const cls of PHB) {
  const keys = Object.keys(CLASS_FEATURES[cls] || {}).map(Number).sort((a, b) => a - b);
  check(JSON.stringify(keys) === JSON.stringify([...Array(20)].map((_, i) => i + 1)),
    `${cls} carries levels 1-20 (got ${JSON.stringify(keys)})`);
}

// (c) The 6 item-28 rows, pinned at their 2024 values (2024 names, not 2014).
group('(c) item-28 rows pinned at 2024 values');
{
  check(JSON.stringify(getClassFeatures('cleric', 3)) === JSON.stringify(['Cleric Subclass']),
    "cleric L3 is ['Cleric Subclass'] (no 'Divine Domain', no separate 'Domain Feature' row)");
  check(JSON.stringify(getClassFeatures('druid', 3)) === JSON.stringify(['Druid Subclass']),
    "druid L3 is ['Druid Subclass'] (not 'Druid Circle')");
  check(JSON.stringify(getClassFeatures('sorcerer', 3)) === JSON.stringify(['Sorcerer Subclass']),
    "sorcerer L3 is ['Sorcerer Subclass'] (Metamagic moved to L2, not 'Sorcerous Origin')");
  check(JSON.stringify(getClassFeatures('warlock', 3)) === JSON.stringify(['Warlock Subclass']),
    "warlock L3 is ['Warlock Subclass'] (no 'Pact Boon' — it is an invocation in 2024)");
  check(JSON.stringify(getClassFeatures('wizard', 3)) === JSON.stringify(['Wizard Subclass']),
    "wizard L3 is ['Wizard Subclass'] (not 'Arcane Tradition')");
  check(JSON.stringify(getClassFeatures('wizard', 2)) === JSON.stringify(['Scholar']),
    "wizard L2 is ['Scholar'] (new 2024 feature; was empty)");
}

// (d) Contested row, SETTLED: no cleric domain feature at L8 in 2024.
// SRD 5.2 Cleric Features table: subclass features at 6th and 17th only.
// Roll20 2024 Cleric: no 8th-level feature heading; D&D Beyond 2024 cleric
// article: Sear Undead 5, Blessed Strikes 7, Divine Intervention 10,
// Improved Blessed Strikes 14 — nothing at 8.
group('(d) contested cleric L8 row — settled, no Domain Feature at 8');
{
  check(JSON.stringify(getClassFeatures('cleric', 8)) === JSON.stringify(['Ability Score Improvement']),
    "cleric L8 is ['Ability Score Improvement'] only (no 'Domain Feature', no 'Destroy Undead (CR 1)')");
  check(JSON.stringify(getClassFeatures('cleric', 6)) === JSON.stringify(['Subclass Feature']),
    "cleric L6 is ['Subclass Feature'] (the 8th-level domain feature re-points here, per registry cadence 3/6/17)");
  check(JSON.stringify(getClassFeatures('cleric', 17)) === JSON.stringify(['Subclass Feature']),
    "cleric L17 is ['Subclass Feature'] (cadence 3/6/17 confirmed by the 2024 table)");
}

// (e) No 2014-only row name survives in any PHB class table.
group('(e) no 2014-only row name survives in the 12 PHB tables');
{
  const DENYLIST = [
    'Song of Rest', 'Brutal Critical', 'Destroy Undead', 'Divine Domain',
    'Druid Circle', 'Sorcerous Origin', 'Otherworldly Patron', 'Arcane Tradition',
    'Primal Path', 'Bard College', 'Martial Archetype', 'Monastic Tradition',
    'Sacred Oath', 'Ranger Archetype', 'Roguish Archetype', 'Pact Boon',
    'Deflect Missiles', 'Ki-Empowered Strikes', 'Stillness of Mind',
    'Tongue of the Sun and Moon', 'Diamond Soul', 'Timeless Body', 'Empty Body',
    'Perfect Self', 'Divine Sense', 'Divine Health', 'Cleansing Touch',
    'Aura Improvements', 'Improved Divine Smite', 'Divine Smite',
    'Natural Explorer', 'Primeval Awareness', "Land's Stride", 'Hide in Plain Sight',
    'Vanish', 'Blindsense', 'Favored Enemy Improvement',
    'Natural Explorer Improvement', 'Wild Shape Improvement',
    'Channel Divinity (1/rest)', 'Channel Divinity (2/rest)', 'Channel Divinity (3/rest)',
    'Divine Intervention Improvement', 'Bardic Inspiration (d6)', 'Bardic Inspiration (d8)',
    'Bardic Inspiration (d10)', 'Bardic Inspiration (d12)',
    'Domain Feature', 'College Feature', 'Circle Feature', 'Path Feature',
    'Archetype Feature', 'Tradition Feature', 'Oath Feature', 'Origin Feature',
    'Patron Feature',
  ];
  const survivors = [];
  for (const cls of PHB) {
    for (let level = 1; level <= 20; level++) {
      for (const row of getClassFeatures(cls, level)) {
        if (DENYLIST.some((d) => row.includes(d))) survivors.push(`${cls} L${level}: ${row}`);
      }
    }
  }
  check(survivors.length === 0, `no 2014-only row names survive (found: ${survivors.join('; ') || 'none'})`);
}

// (f) L19 is an Epic Boon for every PHB class in 2024 (not an ASI row).
group('(f) L19 is Epic Boon for every PHB class');
for (const cls of PHB) {
  check(JSON.stringify(getClassFeatures(cls, 19)) === JSON.stringify(['Epic Boon']),
    `${cls} L19 is ['Epic Boon']`);
}

// (g) Scope guard: the 9 non-PHB classes are untouched by this rebuild.
group('(g) non-PHB classes untouched (row counts)');
{
  const NON_PHB_ROWS = {
    artificer: 21, keeper: 27, spellshot: 28, warden: 24, magus: 23,
    pugilist: 27, scholar: 27, duelist: 25, blackguard: 21,
  };
  for (const [cls, rows] of Object.entries(NON_PHB_ROWS)) {
    const got = Object.values(CLASS_FEATURES[cls] || {}).flat().length;
    check(got === rows, `${cls} still has ${rows} rows (got ${got}) — out of scope, untouched`);
  }
}

// (h) Barbarian PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
// Discriminating rows + total. The staged rows matched the photos exactly
// (verified mechanically: all 20 levels, names + levels + order).
group('(h) barbarian PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('barbarian', 1)) === JSON.stringify(['Rage', 'Unarmored Defense', 'Weapon Mastery']),
    "barbarian L1 is ['Rage', 'Unarmored Defense', 'Weapon Mastery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('barbarian', 3)) === JSON.stringify(['Barbarian Subclass', 'Primal Knowledge']),
    "barbarian L3 is ['Barbarian Subclass', 'Primal Knowledge'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('barbarian', 7)) === JSON.stringify(['Feral Instinct', 'Instinctive Pounce']),
    "barbarian L7 is ['Feral Instinct', 'Instinctive Pounce'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('barbarian', 9)) === JSON.stringify(['Brutal Strike']),
    "barbarian L9 is ['Brutal Strike'] (PHB photo — not 'Brutal Critical')");
  check(JSON.stringify(getClassFeatures('barbarian', 13)) === JSON.stringify(['Improved Brutal Strike']),
    "barbarian L13 is ['Improved Brutal Strike'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('barbarian', 17)) === JSON.stringify(['Improved Brutal Strike']),
    "barbarian L17 is ['Improved Brutal Strike'] (PHB photo — second grant, not a third Brutal Critical die)");
  check(JSON.stringify(getClassFeatures('barbarian', 19)) === JSON.stringify(['Epic Boon']),
    "barbarian L19 is ['Epic Boon'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.barbarian).flat().length === 26,
    `barbarian has 26 rows total (got ${Object.values(CLASS_FEATURES.barbarian).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('barbarian', level)) {
      if (row.includes('Brutal Critical') || row.includes('Primal Path') || row.includes('Path Feature')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 2014 barbarian row names survive (found: ${survivors.join('; ') || 'none'})`);
}

// (i) Bard PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
group('(i) bard PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('bard', 1)) === JSON.stringify(['Bardic Inspiration', 'Spellcasting']),
    "bard L1 is ['Bardic Inspiration', 'Spellcasting'] (PHB photo — no Weapon Mastery for bards)");
  check(JSON.stringify(getClassFeatures('bard', 7)) === JSON.stringify(['Countercharm']),
    "bard L7 is ['Countercharm'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('bard', 9)) === JSON.stringify(['Expertise']),
    "bard L9 is ['Expertise'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('bard', 10)) === JSON.stringify(['Magical Secrets']),
    "bard L10 is ['Magical Secrets'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('bard', 11)) === JSON.stringify([]),
    "bard L11 is [] (PHB photo — no feature at 11th)");
  check(JSON.stringify(getClassFeatures('bard', 18)) === JSON.stringify(['Superior Inspiration']),
    "bard L18 is ['Superior Inspiration'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('bard', 19)) === JSON.stringify(['Epic Boon']),
    "bard L19 is ['Epic Boon'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('bard', 20)) === JSON.stringify(['Words of Creation']),
    "bard L20 is ['Words of Creation'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.bard).flat().length === 18,
    `bard has 18 rows total (got ${Object.values(CLASS_FEATURES.bard).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('bard', level)) {
      if (row.includes('Song of Rest')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 'Song of Rest' survives in the bard table (found: ${survivors.join('; ') || 'none'})`);
}

// (j) Cleric PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
// L8 is pinned in group (d) (ASI only, no Domain Feature).
group('(j) cleric PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('cleric', 2)) === JSON.stringify(['Channel Divinity']),
    "cleric L2 is ['Channel Divinity'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('cleric', 5)) === JSON.stringify(['Sear Undead']),
    "cleric L5 is ['Sear Undead'] (PHB photo — not 'Destroy Undead')");
  check(JSON.stringify(getClassFeatures('cleric', 7)) === JSON.stringify(['Blessed Strikes']),
    "cleric L7 is ['Blessed Strikes'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('cleric', 14)) === JSON.stringify(['Improved Blessed Strikes']),
    "cleric L14 is ['Improved Blessed Strikes'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('cleric', 17)) === JSON.stringify(['Subclass Feature']),
    "cleric L17 is ['Subclass Feature'] (PHB photo — subclass cadence 3/6/17)");
  check(JSON.stringify(getClassFeatures('cleric', 20)) === JSON.stringify(['Greater Divine Intervention']),
    "cleric L20 is ['Greater Divine Intervention'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.cleric).flat().length === 16,
    `cleric has 16 rows total (got ${Object.values(CLASS_FEATURES.cleric).flat().length})`);
}

// (k) Druid PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
group('(k) druid PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('druid', 1)) === JSON.stringify(['Druidic', 'Primal Order', 'Spellcasting']),
    "druid L1 is ['Druidic', 'Primal Order', 'Spellcasting'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('druid', 2)) === JSON.stringify(['Wild Shape', 'Wild Companion']),
    "druid L2 is ['Wild Shape', 'Wild Companion'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('druid', 5)) === JSON.stringify(['Wild Resurgence']),
    "druid L5 is ['Wild Resurgence'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('druid', 7)) === JSON.stringify(['Elemental Fury']),
    "druid L7 is ['Elemental Fury'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('druid', 15)) === JSON.stringify(['Improved Elemental Fury']),
    "druid L15 is ['Improved Elemental Fury'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('druid', 18)) === JSON.stringify(['Beast Spells']),
    "druid L18 is ['Beast Spells'] (PHB photo — Timeless Body is gone)");
  check(JSON.stringify(getClassFeatures('druid', 20)) === JSON.stringify(['Archdruid']),
    "druid L20 is ['Archdruid'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.druid).flat().length === 19,
    `druid has 19 rows total (got ${Object.values(CLASS_FEATURES.druid).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('druid', level)) {
      if (row.includes('Timeless Body') || row.includes('Wild Shape Improvement')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 'Timeless Body' / 'Wild Shape Improvement' survives in the druid table (found: ${survivors.join('; ') || 'none'})`);
}

// (l) Fighter PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
group('(l) fighter PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('fighter', 1)) === JSON.stringify(['Fighting Style', 'Second Wind', 'Weapon Mastery']),
    "fighter L1 is ['Fighting Style', 'Second Wind', 'Weapon Mastery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 2)) === JSON.stringify(['Action Surge (one use)', 'Tactical Mind']),
    "fighter L2 is ['Action Surge (one use)', 'Tactical Mind'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 5)) === JSON.stringify(['Extra Attack', 'Tactical Shift']),
    "fighter L5 is ['Extra Attack', 'Tactical Shift'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 9)) === JSON.stringify(['Indomitable (one use)', 'Tactical Master']),
    "fighter L9 is ['Indomitable (one use)', 'Tactical Master'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 11)) === JSON.stringify(['Two Extra Attacks']),
    "fighter L11 is ['Two Extra Attacks'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 13)) === JSON.stringify(['Indomitable (two uses)', 'Studied Attacks']),
    "fighter L13 is ['Indomitable (two uses)', 'Studied Attacks'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 17)) === JSON.stringify(['Action Surge (two uses)', 'Indomitable (three uses)']),
    "fighter L17 is ['Action Surge (two uses)', 'Indomitable (three uses)'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('fighter', 20)) === JSON.stringify(['Three Extra Attacks']),
    "fighter L20 is ['Three Extra Attacks'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.fighter).flat().length === 27,
    `fighter has 27 rows total (got ${Object.values(CLASS_FEATURES.fighter).flat().length})`);
}

// (m) Rogue PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
group('(m) rogue PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('rogue', 1)) === JSON.stringify(['Expertise', 'Sneak Attack', "Thieves' Cant", 'Weapon Mastery']),
    "rogue L1 is ['Expertise', 'Sneak Attack', \"Thieves' Cant\", 'Weapon Mastery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 2)) === JSON.stringify(['Cunning Action']),
    "rogue L2 is ['Cunning Action'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 3)) === JSON.stringify(['Rogue Subclass', 'Steady Aim']),
    "rogue L3 is ['Rogue Subclass', 'Steady Aim'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 5)) === JSON.stringify(['Cunning Strike', 'Uncanny Dodge']),
    "rogue L5 is ['Cunning Strike', 'Uncanny Dodge'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 7)) === JSON.stringify(['Evasion', 'Reliable Talent']),
    "rogue L7 is ['Evasion', 'Reliable Talent'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 11)) === JSON.stringify(['Improved Cunning Strike']),
    "rogue L11 is ['Improved Cunning Strike'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 14)) === JSON.stringify(['Devious Strikes']),
    "rogue L14 is ['Devious Strikes'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 19)) === JSON.stringify(['Epic Boon']),
    "rogue L19 is ['Epic Boon'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('rogue', 20)) === JSON.stringify(['Stroke of Luck']),
    "rogue L20 is ['Stroke of Luck'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.rogue).flat().length === 26,
    `rogue has 26 rows total (got ${Object.values(CLASS_FEATURES.rogue).flat().length})`);
  check(JSON.stringify(SNEAK_ATTACK_DICE) === JSON.stringify({ 1: 1, 2: 1, 3: 2, 4: 2, 5: 3, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 6, 12: 6, 13: 7, 14: 7, 15: 8, 16: 8, 17: 9, 18: 9, 19: 10, 20: 10 }),
    'Sneak Attack dice are 1d6 at L1-2, +1d6 every two levels to 10d6 at L19-20 (PHB photo)');
}

// (s) Wizard PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
// The staged rows matched the photos exactly — zero row changes.
group('(n) wizard PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('wizard', 1)) === JSON.stringify(['Spellcasting', 'Ritual Adept', 'Arcane Recovery']),
    "wizard L1 is ['Spellcasting', 'Ritual Adept', 'Arcane Recovery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('wizard', 2)) === JSON.stringify(['Scholar']),
    "wizard L2 is ['Scholar'] (PHB photo — new 2024 feature)");
  check(JSON.stringify(getClassFeatures('wizard', 3)) === JSON.stringify(['Wizard Subclass']),
    "wizard L3 is ['Wizard Subclass'] (PHB photo — subclass at 3rd, not 2nd)");
  check(JSON.stringify(getClassFeatures('wizard', 5)) === JSON.stringify(['Memorize Spell']),
    "wizard L5 is ['Memorize Spell'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('wizard', 6)) === JSON.stringify(['Subclass Feature']),
    "wizard L6 is ['Subclass Feature'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('wizard', 18)) === JSON.stringify(['Spell Mastery']),
    "wizard L18 is ['Spell Mastery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('wizard', 19)) === JSON.stringify(['Epic Boon']),
    "wizard L19 is ['Epic Boon'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('wizard', 20)) === JSON.stringify(['Signature Spells']),
    "wizard L20 is ['Signature Spells'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.wizard).flat().length === 16,
    `wizard has 16 rows total (got ${Object.values(CLASS_FEATURES.wizard).flat().length})`);
}

// (o) Warlock PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06 (11 photos, pp. 153-163).
group('(o) warlock PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('warlock', 1)) === JSON.stringify(['Eldritch Invocations', 'Pact Magic']),
    "warlock L1 is ['Eldritch Invocations', 'Pact Magic'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('warlock', 3)) === JSON.stringify(['Warlock Subclass']),
    "warlock L3 is ['Warlock Subclass'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('warlock', 9)) === JSON.stringify(['Contact Patron']),
    "warlock L9 is ['Contact Patron'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('warlock', 11)) === JSON.stringify(['Mystic Arcanum (level 6 spell)']),
    "warlock L11 is ['Mystic Arcanum (level 6 spell)'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('warlock', 19)) === JSON.stringify(['Epic Boon']),
    "warlock L19 is ['Epic Boon'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('warlock', 20)) === JSON.stringify(['Eldritch Master']),
    "warlock L20 is ['Eldritch Master'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.warlock).flat().length === 18,
    `warlock has 18 rows total (got ${Object.values(CLASS_FEATURES.warlock).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('warlock', level)) {
      if (row.includes('Fey Presence') || row.includes('Dark Delirium') || row.includes('Pact Boon') || row.includes('Otherworldly Patron') || row.includes('Patron Feature')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 2014 warlock row names survive (found: ${survivors.join('; ') || 'none'})`);
}

// (p) Monk PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06.
group('(p) monk PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('monk', 1)) === JSON.stringify(['Martial Arts', 'Unarmored Defense']),
    "monk L1 is ['Martial Arts', 'Unarmored Defense'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 2)) === JSON.stringify(["Monk's Focus", 'Unarmored Movement', 'Uncanny Metabolism']),
    "monk L2 is [\"Monk's Focus\", 'Unarmored Movement', 'Uncanny Metabolism'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 3)) === JSON.stringify(['Deflect Attacks', 'Monk Subclass']),
    "monk L3 is ['Deflect Attacks', 'Monk Subclass'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 5)) === JSON.stringify(['Extra Attack', 'Stunning Strike']),
    "monk L5 is ['Extra Attack', 'Stunning Strike'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 6)) === JSON.stringify(['Empowered Strikes', 'Subclass Feature']),
    "monk L6 is ['Empowered Strikes', 'Subclass Feature'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 9)) === JSON.stringify(['Acrobatic Movement']),
    "monk L9 is ['Acrobatic Movement'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 10)) === JSON.stringify(['Heightened Focus', 'Self-Restoration']),
    "monk L10 is ['Heightened Focus', 'Self-Restoration'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 13)) === JSON.stringify(['Deflect Energy']),
    "monk L13 is ['Deflect Energy'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 14)) === JSON.stringify(['Disciplined Survivor']),
    "monk L14 is ['Disciplined Survivor'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 15)) === JSON.stringify(['Perfect Focus']),
    "monk L15 is ['Perfect Focus'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 18)) === JSON.stringify(['Superior Defense']),
    "monk L18 is ['Superior Defense'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('monk', 20)) === JSON.stringify(['Body and Mind']),
    "monk L20 is ['Body and Mind'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.monk).flat().length === 28,
    `monk has 28 rows total (got ${Object.values(CLASS_FEATURES.monk).flat().length})`);
  const survivors = [];
  const DENY = ['Ki', 'Monastic Tradition', 'Deflect Missiles', 'Stillness of Mind', 'Purity of Body', 'Tongue of the Sun and Moon', 'Diamond Soul', 'Timeless Body', 'Empty Body', 'Perfect Self', 'Ki-Empowered Strikes'];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('monk', level)) {
      for (const bad of DENY) {
        if (row.includes(bad)) survivors.push(`L${level}: ${row} (matches '${bad}')`);
      }
    }
  }
  check(survivors.length === 0, `no 2014 monk row names survive (found: ${survivors.join('; ') || 'none'})`);
}

// (q) Ranger PHB-photo pins — 2024 PHB photos pp. 119-127,
// Zach-provided 2026-11-06. Discriminating rows + total. The
// staged rows matched the photos exactly (verified mechanically:
// all 20 levels, names + levels + order) — zero row changes.
group('(q) ranger PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('ranger', 1)) === JSON.stringify(['Spellcasting', 'Favored Enemy', 'Weapon Mastery']),
    "ranger L1 is ['Spellcasting', 'Favored Enemy', 'Weapon Mastery'] (PHB photo — Natural Explorer is gone)");
  check(JSON.stringify(getClassFeatures('ranger', 2)) === JSON.stringify(['Deft Explorer', 'Fighting Style']),
    "ranger L2 is ['Deft Explorer', 'Fighting Style'] (PHB photo — Deft Explorer replaces Natural Explorer)");
  check(JSON.stringify(getClassFeatures('ranger', 3)) === JSON.stringify(['Ranger Subclass']),
    "ranger L3 is ['Ranger Subclass'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 6)) === JSON.stringify(['Roving']),
    "ranger L6 is ['Roving'] (PHB photo — not 'Land's Stride')");
  check(JSON.stringify(getClassFeatures('ranger', 9)) === JSON.stringify(['Expertise']),
    "ranger L9 is ['Expertise'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 10)) === JSON.stringify(['Tireless']),
    "ranger L10 is ['Tireless'] (PHB photo — not 'Hide in Plain Sight')");
  check(JSON.stringify(getClassFeatures('ranger', 13)) === JSON.stringify(['Relentless Hunter']),
    "ranger L13 is ['Relentless Hunter'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 14)) === JSON.stringify(["Nature's Veil"]),
    "ranger L14 is [\"Nature's Veil\"] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 17)) === JSON.stringify(['Precise Hunter']),
    "ranger L17 is ['Precise Hunter'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 18)) === JSON.stringify(['Feral Senses']),
    "ranger L18 is ['Feral Senses'] (PHB photo — not 'Blindsense')");
  check(JSON.stringify(getClassFeatures('ranger', 19)) === JSON.stringify(['Epic Boon']),
    "ranger L19 is ['Epic Boon'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('ranger', 20)) === JSON.stringify(['Foe Slayer']),
    "ranger L20 is ['Foe Slayer'] (PHB photo — not 'Favored Enemy Improvement')");
  check(Object.values(CLASS_FEATURES.ranger).flat().length === 23,
    `ranger has 23 rows total (got ${Object.values(CLASS_FEATURES.ranger).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('ranger', level)) {
      if (row.includes('Natural Explorer') || row.includes('Primeval Awareness') || row.includes("Land's Stride") || row.includes('Hide in Plain Sight') || row.includes('Vanish') || row.includes('Blindsense') || row.includes('Favored Enemy Improvement') || row.includes('Natural Explorer Improvement') || row.includes('Ranger Archetype')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 2014 ranger row names survive (found: ${survivors.join('; ') || 'none'})`);
}

// (r) Paladin PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06
// (pp. 109–117, 9 photos). Discriminating rows + total. The staged
// rows matched the photos exactly (verified mechanically: all 20
// levels, names + levels + order).
group('(r) paladin PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('paladin', 1)) === JSON.stringify(['Lay on Hands', 'Spellcasting', 'Weapon Mastery']),
    "paladin L1 is ['Lay on Hands', 'Spellcasting', 'Weapon Mastery'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 2)) === JSON.stringify(['Fighting Style', "Paladin's Smite"]),
    "paladin L2 is ['Fighting Style', \"Paladin's Smite\"] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 3)) === JSON.stringify(['Channel Divinity', 'Paladin Subclass']),
    "paladin L3 is ['Channel Divinity', 'Paladin Subclass'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 5)) === JSON.stringify(['Extra Attack', 'Faithful Steed']),
    "paladin L5 is ['Extra Attack', 'Faithful Steed'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 6)) === JSON.stringify(['Aura of Protection']),
    "paladin L6 is ['Aura of Protection'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 11)) === JSON.stringify(['Radiant Strikes']),
    "paladin L11 is ['Radiant Strikes'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('paladin', 13)) === JSON.stringify([]),
    "paladin L13 is [] (PHB photo — no feature at 13th)");
  check(JSON.stringify(getClassFeatures('paladin', 17)) === JSON.stringify([]),
    "paladin L17 is [] (PHB photo — no feature at 17th)");
  check(JSON.stringify(getClassFeatures('paladin', 19)) === JSON.stringify(['Epic Boon']),
    "paladin L19 is ['Epic Boon'] (PHB photo)");
  check(Object.values(CLASS_FEATURES.paladin).flat().length === 23,
    `paladin has 23 rows total (got ${Object.values(CLASS_FEATURES.paladin).flat().length})`);
}

// (s) Sorcerer PHB-photo pins — 2024 PHB photos, Zach-provided 2026-11-06
// (pp. 139–150, 13 photos). Discriminating rows + total. The staged
// rows matched the photos exactly (verified mechanically: all 20
// levels, names + levels + order) — zero row changes.
group('(s) sorcerer PHB-photo pins');
{
  check(JSON.stringify(getClassFeatures('sorcerer', 1)) === JSON.stringify(['Spellcasting', 'Innate Sorcery']),
    "sorcerer L1 is ['Spellcasting', 'Innate Sorcery'] (PHB photo — not 'Sorcerous Origin')");
  check(JSON.stringify(getClassFeatures('sorcerer', 2)) === JSON.stringify(['Font of Magic', 'Metamagic']),
    "sorcerer L2 is ['Font of Magic', 'Metamagic'] (PHB photo — Metamagic at 2nd, not 3rd)");
  check(JSON.stringify(getClassFeatures('sorcerer', 3)) === JSON.stringify(['Sorcerer Subclass']),
    "sorcerer L3 is ['Sorcerer Subclass'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('sorcerer', 5)) === JSON.stringify(['Sorcerous Restoration']),
    "sorcerer L5 is ['Sorcerous Restoration'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('sorcerer', 7)) === JSON.stringify(['Sorcery Incarnate']),
    "sorcerer L7 is ['Sorcery Incarnate'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('sorcerer', 9)) === JSON.stringify([]),
    "sorcerer L9 is [] (PHB photo — no feature at 9th)");
  check(JSON.stringify(getClassFeatures('sorcerer', 10)) === JSON.stringify(['Metamagic']),
    "sorcerer L10 is ['Metamagic'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('sorcerer', 17)) === JSON.stringify(['Metamagic']),
    "sorcerer L17 is ['Metamagic'] (PHB photo)");
  check(JSON.stringify(getClassFeatures('sorcerer', 20)) === JSON.stringify(['Arcane Apotheosis']),
    "sorcerer L20 is ['Arcane Apotheosis'] (PHB photo — not 'Sorcerous Restoration')");
  check(Object.values(CLASS_FEATURES.sorcerer).flat().length === 18,
    `sorcerer has 18 rows total (got ${Object.values(CLASS_FEATURES.sorcerer).flat().length})`);
  const survivors = [];
  for (let level = 1; level <= 20; level++) {
    for (const row of getClassFeatures('sorcerer', level)) {
      if (row.includes('Sorcerous Origin') || row.includes('Flexible Casting')) survivors.push(`L${level}: ${row}`);
    }
  }
  check(survivors.length === 0, `no 2014 sorcerer row names survive (found: ${survivors.join('; ') || 'none'})`);
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
