// server/data/startingPackages.js — starting-equipment packages for the
// new character creator, Stage 5 (Gear & Story), 2026-11-07.
//
// CONTRACT (server + client workers build against this shape):
//   { [classId]: { options: [{ id: 'A'|'B'|'C', items: [...], gold }],
//                  goldOption: <gp|null> } }
// Item entries:
//   - fixed:   { name, quantity } — name is the EXACT 2024 PHB Equipment
//     Chapter 6 name (see equipment2024.js), so resolution matches by name.
//   - choice:  { key, choose, count, from, label? } where `from` is either
//     (a) a sentinel category key (see CATEGORY_SENTINELS below), in which
//     case picks[key] is an array of `count` item names from that category;
//     or (b) an array of ALTERNATIVES, in which case picks[key] is
//     { alternative: <index> }. Each alternative is one of:
//       { name, quantity }                        — a fixed-item alternative
//       { key, choose, count, from, label? }      — a nested choice
//         (its own picks entry, required only when its alternative is taken)
//       { items: [...], condition?: string }      — a bundle alternative;
//         `condition` is display-only ("(if proficient)" in the source
//         book); the resolver does NOT enforce proficiency — it has no
//         proficiency data — and says so in the staging note.
//   `key` is a stable per-option identifier; picks are an object keyed by
//   it. `label` is the picker title for the UI. `gold` on an option is gold
//   baked INTO that package (Ranger 7 GP, Spellshot 5 gp, Blood Hunter
//   8 gp); `goldOption` is the take-gold-instead amount. Packages OR gold —
//   they never stack.
//
// SOURCES (book wins; no invention):
//   - PHB 12: the Core Traits photos, transcribed verbatim in
//     ~/workspace/dnd-app-review/stage5-build/per-class-packages.md.
//     (A)/(B) fixed bundles + package gold; goldOption is the photo's
//     fixed-gold option ((B), or (C) for Fighter = 155). Note the Monk
//     goldOption is 50 (photo (B)), NOT the 5d4x1 = 12 dice value in
//     classes.json — the photo table wins.
//   - blackguard/magus/pugilist/scholar/spellshot/warden: verbatim source
//     lines in gold-baselines.md (their books are SILENT on starting gold,
//     verified with a Duelist positive control) — goldOption null, and
//     classes.json startingGold stays absent/null. Their live classes.json
//     startingEquipment was verified 2026-11-07 to ALREADY match those
//     verbatim lines (fragments merged earlier), so no classes.json edit
//     was needed for the six.
//   - blood_hunter: Blood Hunter 2024 PDF (GM Binder fan conversion):
//     "(A) Studded Leather Armor, 2 Martial weapons, Light Crossbow,
//     20 Bolts, Alchemist's Supplies, Explorer's Pack, and 8 GP;
//     or (B) 100 GP". The 8 GP is package gold; goldOption 100.
//   - duelist: new-classes-staging fragment (matches live classes.json);
//     gold 5d4x10 = 125 (positive control in gold-baselines.md).
//   - warlord: KibblesTasty's Warlord v1.5 PDF choices (matches live
//     classes.json); gold 5d4x10 = 125.
//   - artificer, keeper: NO staging fragment and no source re-verified
//     this job — live classes.json used as-is and FLAGGED in the staging
//     note (packages.md). Do not treat these two as source-verified.
//
// NAME NORMALISATION (chapter wins): "Leather Armor" -> "Leather",
// "Studded Leather Armor" -> "Studded Leather", "20 Arrows" ->
// "Arrows (20)" x1, "20 Bolts" -> "Crossbow Bolts (20)" x1, "Bag of 1000
// Ball Bearings" -> "Ball Bearings" x1, "5 gp"/"7 GP" inside equipment ->
// the option's `gold` field, never an item. "Holy Symbol" -> a choice
// among Amulet/Emblem/Reliquary. "Arcane Focus (orb)" -> Orb,
// "(crystal)" -> Crystal, "(Quarterstaff)" -> Staff;
// "Druidic Focus (Quarterstaff)" -> Wooden Staff,
// "(sprig of mistletoe)" -> Sprig of Mistletoe; "Book (occult lore)" ->
// the Book gear item. "Musical Instrument of your choice" -> a pick from
// the 10 instruments. "Artisan's Tools or Musical Instrument chosen for
// the tool proficiency above" -> a pick from artisan tools + instruments.
// Chapter-external but package-legit items (see the resolver's
// PACKAGE_ONLY_ITEMS): Spellbook (wizard class item), Sabre (duelist
// own-book weapon), A Worn Leather-Bound Journal (keeper flavour given).

// Sentinel category keys. The resolver expands these against
// server/data/equipment2024.js (WEAPONS / TOOLS / FOCUSES).
export const CATEGORY_SENTINELS = [
  'any_simple_weapon',
  'any_simple_melee_weapon',
  'any_martial_weapon',
  'any_martial_melee_weapon',
  'any_artisan_tool',
  'any_tool',
  'any_tool_kit',
  'any_musical_instrument',
  'any_gaming_set',
];

// Source label per class, used by the resolver's gold-fork error
// ("no starting-gold value for <class> in <source>"). Labels only.
export const GOLD_SOURCES = {
  barbarian: '2024 PHB',
  bard: '2024 PHB',
  cleric: '2024 PHB',
  druid: '2024 PHB',
  fighter: '2024 PHB',
  monk: '2024 PHB',
  paladin: '2024 PHB',
  ranger: '2024 PHB',
  rogue: '2024 PHB',
  sorcerer: '2024 PHB',
  warlock: '2024 PHB',
  wizard: '2024 PHB',
  artificer: 'classes.json (no fragment; source not re-verified this job)',
  blackguard: 'Libris Mortis 5e Conversion',
  blood_hunter: 'Blood Hunter 2024 (GM Binder fan conversion)',
  duelist: 'Duelist Class Overview',
  keeper: 'classes.json (no fragment; source not re-verified this job)',
  magus: 'Magus Class',
  pugilist: 'Pugilist Class',
  scholar: 'Scholar Class',
  spellshot: 'Spellshot Class',
  warden: 'Warden Class',
  warlord: "KibblesTasty's Warlord v1.5 (GM Binder)",
};

const HOLY_SYMBOL_CHOICE = {
  key: 'holy',
  choose: 1,
  count: 1,
  label: 'Holy Symbol',
  from: [
    { name: 'Amulet', quantity: 1 },
    { name: 'Emblem', quantity: 1 },
    { name: 'Reliquary', quantity: 1 },
  ],
};

const ARCANE_FOCUS_CHOICE = {
  key: 'arcaneFocus',
  choose: 1,
  count: 1,
  label: 'Arcane Focus',
  from: [
    { name: 'Crystal', quantity: 1 },
    { name: 'Orb', quantity: 1 },
    { name: 'Rod', quantity: 1 },
    { name: 'Staff', quantity: 1 },
    { name: 'Wand', quantity: 1 },
  ],
};

const DRUIDIC_FOCUS_CHOICE = {
  key: 'druidicFocus',
  choose: 1,
  count: 1,
  label: 'Druidic Focus',
  from: [
    { name: 'Sprig of Mistletoe', quantity: 1 },
    { name: 'Wooden Staff', quantity: 1 },
    { name: 'Yew Wand', quantity: 1 },
  ],
};

export const STARTING_PACKAGES = {
  // ---------------------------------------------------------- PHB (12)
  barbarian: {
    options: [
      {
        id: 'A',
        gold: 15,
        items: [
          { name: 'Greataxe', quantity: 1 },
          { name: 'Handaxe', quantity: 4 },
          { name: "Explorer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 75,
  },
  bard: {
    options: [
      {
        id: 'A',
        gold: 19,
        items: [
          { name: 'Leather', quantity: 1 },
          { name: 'Dagger', quantity: 2 },
          { key: 'instrument', choose: 1, count: 1, label: 'Musical Instrument', from: 'any_musical_instrument' },
          { name: "Entertainer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 90,
  },
  cleric: {
    options: [
      {
        id: 'A',
        gold: 7,
        items: [
          { name: 'Chain Shirt', quantity: 1 },
          { name: 'Shield', quantity: 1 },
          { name: 'Mace', quantity: 1 },
          { ...HOLY_SYMBOL_CHOICE, key: 'holy' },
          { name: "Priest's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 110,
  },
  druid: {
    options: [
      {
        id: 'A',
        gold: 9,
        items: [
          { name: 'Leather', quantity: 1 },
          { name: 'Shield', quantity: 1 },
          { name: 'Sickle', quantity: 1 },
          { name: 'Wooden Staff', quantity: 1 },
          { name: "Explorer's Pack", quantity: 1 },
          { name: 'Herbalism Kit', quantity: 1 },
        ],
      },
    ],
    goldOption: 50,
  },
  fighter: {
    options: [
      {
        id: 'A',
        gold: 4,
        items: [
          { name: 'Chain Mail', quantity: 1 },
          { name: 'Greatsword', quantity: 1 },
          { name: 'Flail', quantity: 1 },
          { name: 'Javelin', quantity: 8 },
          { name: "Dungeoneer's Pack", quantity: 1 },
        ],
      },
      {
        id: 'B',
        gold: 11,
        items: [
          { name: 'Studded Leather', quantity: 1 },
          { name: 'Scimitar', quantity: 1 },
          { name: 'Shortsword', quantity: 1 },
          { name: 'Longbow', quantity: 1 },
          { name: 'Arrows (20)', quantity: 1 },
          { name: 'Quiver', quantity: 1 },
          { name: "Dungeoneer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 155,
  },
  monk: {
    options: [
      {
        id: 'A',
        gold: 11,
        items: [
          { name: 'Spear', quantity: 1 },
          { name: 'Dagger', quantity: 5 },
          {
            key: 'toolOrInstrument',
            choose: 1,
            count: 1,
            label: "Artisan's Tools or Musical Instrument",
            from: [
              [{ key: 'tool', choose: 1, count: 1, label: "Artisan's Tools", from: 'any_artisan_tool' }],
              [{ key: 'instrument', choose: 1, count: 1, label: 'Musical Instrument', from: 'any_musical_instrument' }],
            ],
          },
          { name: "Explorer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 50,
  },
  paladin: {
    options: [
      {
        id: 'A',
        gold: 9,
        items: [
          { name: 'Chain Mail', quantity: 1 },
          { name: 'Shield', quantity: 1 },
          { name: 'Longsword', quantity: 1 },
          { name: 'Javelin', quantity: 6 },
          { ...HOLY_SYMBOL_CHOICE, key: 'holy' },
          { name: "Priest's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 150,
  },
  ranger: {
    options: [
      {
        id: 'A',
        gold: 7,
        items: [
          { name: 'Studded Leather', quantity: 1 },
          { name: 'Scimitar', quantity: 1 },
          { name: 'Shortsword', quantity: 1 },
          { name: 'Longbow', quantity: 1 },
          { name: 'Arrows (20)', quantity: 1 },
          { name: 'Quiver', quantity: 1 },
          { name: 'Sprig of Mistletoe', quantity: 1 },
          { name: "Explorer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 150,
  },
  rogue: {
    options: [
      {
        id: 'A',
        gold: 8,
        items: [
          { name: 'Leather', quantity: 1 },
          { name: 'Dagger', quantity: 2 },
          { name: 'Shortsword', quantity: 1 },
          { name: 'Shortbow', quantity: 1 },
          { name: 'Arrows (20)', quantity: 1 },
          { name: 'Quiver', quantity: 1 },
          { name: "Thieves' Tools", quantity: 1 },
          { name: "Burglar's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 100,
  },
  sorcerer: {
    options: [
      {
        id: 'A',
        gold: 28,
        items: [
          { name: 'Spear', quantity: 1 },
          { name: 'Dagger', quantity: 2 },
          { name: 'Crystal', quantity: 1 },
          { name: "Dungeoneer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 50,
  },
  warlock: {
    options: [
      {
        id: 'A',
        gold: 15,
        items: [
          { name: 'Leather', quantity: 1 },
          { name: 'Sickle', quantity: 1 },
          { name: 'Dagger', quantity: 2 },
          { name: 'Orb', quantity: 1 },
          { name: 'Book', quantity: 1 },
          { name: "Scholar's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 100,
  },
  wizard: {
    options: [
      {
        id: 'A',
        gold: 5,
        items: [
          { name: 'Dagger', quantity: 2 },
          { name: 'Staff', quantity: 1 },
          { name: 'Robe', quantity: 1 },
          { name: 'Spellbook', quantity: 1 },
          { name: "Scholar's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 55,
  },

  // ------------------------------------------------------ non-PHB (11)
  // One option ('A') per class: the own-book equipment is a set of
  // independent (a)/(b) forks, not whole-package alternatives, so the
  // forks live inside the single option as choice entries.
  artificer: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapon',
            from: [
              { items: [{ name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }] },
              [{ key: 'c1b', choose: 1, count: 1, label: 'Simple Weapon', from: 'any_simple_weapon' }],
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Armor',
            from: [{ name: 'Studded Leather', quantity: 1 }, { name: 'Scale Mail', quantity: 1 }],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Dungeoneer's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          { name: "Thieves' Tools", quantity: 1 },
          { name: "Tinker's Tools", quantity: 1 },
        ],
      },
    ],
    goldOption: 125,
  },
  blackguard: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapons',
            from: [
              { items: [{ key: 'c1a', choose: 1, count: 1, label: 'Martial Weapon', from: 'any_martial_weapon' }, { name: 'Shield', quantity: 1 }] },
              { items: [{ key: 'c1b', choose: 1, count: 2, label: 'Martial Weapons', from: 'any_martial_weapon' }] },
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Sidearm',
            from: [
              { items: [{ name: 'Javelin', quantity: 5 }] },
              [{ key: 'c2b', choose: 1, count: 1, label: 'Simple Melee Weapon', from: 'any_simple_melee_weapon' }],
            ],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Priest's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          { name: 'Chain Mail', quantity: 1 },
          { ...HOLY_SYMBOL_CHOICE, key: 'holy' },
        ],
      },
    ],
    goldOption: null,
  },
  blood_hunter: {
    options: [
      {
        id: 'A',
        gold: 8,
        items: [
          { name: 'Studded Leather', quantity: 1 },
          { key: 'weapons', choose: 1, count: 2, label: 'Martial Weapons', from: 'any_martial_weapon' },
          { name: 'Light Crossbow', quantity: 1 },
          { name: 'Crossbow Bolts (20)', quantity: 1 },
          { name: "Alchemist's Supplies", quantity: 1 },
          { name: "Explorer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: 100,
  },
  duelist: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapon',
            from: [{ name: 'Longsword', quantity: 1 }, { name: 'Rapier', quantity: 1 }, { name: 'Sabre', quantity: 1 }],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Armor',
            from: [{ name: 'Chain Shirt', quantity: 1 }, { name: 'Studded Leather', quantity: 1 }],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Explorer's Pack", quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }],
          },
          { name: 'Dagger', quantity: 5 },
          { key: 'gamingSet', choose: 1, count: 1, label: 'Gaming Set', from: 'any_gaming_set' },
        ],
      },
    ],
    goldOption: 125,
  },
  keeper: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapon',
            from: [
              [{ name: 'Shortsword', quantity: 1 }],
              [{ key: 'c1b', choose: 1, count: 1, label: 'Simple Weapon', from: 'any_simple_weapon' }],
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Scholar's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          { name: 'Leather', quantity: 1 },
          { name: "Calligrapher's Supplies", quantity: 1 },
          { name: 'A Worn Leather-Bound Journal', quantity: 1 },
          { name: 'Dagger', quantity: 2 },
        ],
      },
    ],
    goldOption: 100,
  },
  magus: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapon',
            from: [
              { items: [{ key: 'c1a', choose: 1, count: 1, label: 'Simple Weapon', from: 'any_simple_weapon' }, { name: 'Shield', quantity: 1 }] },
              { items: [{ key: 'c1b', choose: 1, count: 1, label: 'Martial Weapon', from: 'any_martial_weapon' }] },
              { items: [{ name: 'Longbow', quantity: 1 }, { name: 'Arrows (20)', quantity: 1 }] },
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Armor',
            from: [{ name: 'Leather', quantity: 1 }, { name: 'Scale Mail', quantity: 1 }],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Focus',
            from: [
              [{ ...ARCANE_FOCUS_CHOICE, key: 'c3a' }],
              [{ ...DRUIDIC_FOCUS_CHOICE, key: 'c3b' }],
              [{ name: 'Component Pouch', quantity: 1 }],
            ],
          },
          { name: "Explorer's Pack", quantity: 1 },
        ],
      },
    ],
    goldOption: null,
  },
  pugilist: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Armor or Weapon',
            from: [
              [{ name: 'Leather', quantity: 1 }],
              [{ key: 'c1b', choose: 1, count: 1, label: 'Simple Weapon', from: 'any_simple_weapon' }],
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Dungeoneer's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          {
            key: 'c3', choose: 1, count: 1, label: "Artisan's Tools, Gaming Set, or Thieves' Tools",
            from: [
              [{ key: 'c3a', choose: 1, count: 1, label: "Artisan's Tools", from: 'any_artisan_tool' }],
              [{ key: 'c3b', choose: 1, count: 1, label: 'Gaming Set', from: 'any_gaming_set' }],
              [{ name: "Thieves' Tools", quantity: 1 }],
            ],
          },
        ],
      },
    ],
    goldOption: null,
  },
  scholar: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Armor and Weapon',
            from: [
              { items: [{ name: 'Leather', quantity: 1 }, { key: 'c1a', choose: 1, count: 1, label: 'Simple Weapon', from: 'any_simple_weapon' }] },
              { items: [{ name: 'Leather', quantity: 1 }, { name: 'Hand Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }] },
              { items: [{ name: 'Heavy Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }] },
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Diplomat's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          { name: 'Book', quantity: 1 },
          { name: "Scholar's Pack", quantity: 1 },
          { key: 'tools', choose: 1, count: 2, label: 'Tools or Tool Kits', from: 'any_tool' },
        ],
      },
    ],
    goldOption: null,
  },
  spellshot: {
    options: [
      {
        id: 'A',
        gold: 5,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Sidearm',
            from: [
              [{ name: 'Dagger', quantity: 1 }],
              [{ key: 'c1b', choose: 1, count: 1, label: 'Simple Melee Weapon', from: 'any_simple_melee_weapon' }],
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Explorer's Pack", quantity: 1 }, { name: "Dungeoneer's Pack", quantity: 1 }],
          },
          { name: 'Pistol', quantity: 1 },
          { name: 'Leather', quantity: 1 },
          { name: "Alchemist's Supplies", quantity: 1 },
          { name: "Tinker's Tools", quantity: 1 },
          { name: 'Ball Bearings', quantity: 1 },
        ],
      },
    ],
    goldOption: null,
  },
  warden: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Armor',
            from: [
              [{ name: 'Chain Shirt', quantity: 1 }],
              { items: [{ name: 'Leather', quantity: 1 }, { name: 'Spear', quantity: 1 }] },
              { items: [{ name: 'Chain Mail', quantity: 1 }], condition: 'Proficient with heavy armor' },
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Sidearm',
            from: [
              { items: [{ name: 'Light Hammer', quantity: 2 }] },
              [{ key: 'c2b', choose: 1, count: 1, label: 'Simple Melee Weapon', from: 'any_simple_melee_weapon' }],
            ],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Dungeoneer's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
          { name: 'Shield', quantity: 1 },
          { key: 'weapon', choose: 1, count: 1, label: 'Martial Weapon', from: 'any_martial_weapon' },
        ],
      },
    ],
    goldOption: null,
  },
  warlord: {
    options: [
      {
        id: 'A',
        gold: 0,
        items: [
          {
            key: 'c1', choose: 1, count: 1, label: 'Weapon',
            from: [
              [{ key: 'c1a', choose: 1, count: 1, label: 'Simple Melee Weapon', from: 'any_simple_melee_weapon' }],
              { items: [{ key: 'c1b', choose: 1, count: 1, label: 'Martial Weapon', from: 'any_martial_weapon' }], condition: 'Proficient with martial weapons' },
            ],
          },
          {
            key: 'c2', choose: 1, count: 1, label: 'Ranged Weapon or Shield',
            from: [
              { items: [{ name: 'Light Crossbow', quantity: 1 }, { name: 'Crossbow Bolts (20)', quantity: 1 }] },
              { items: [{ name: 'Shield', quantity: 1 }], condition: 'Proficient with shields' },
            ],
          },
          {
            key: 'c3', choose: 1, count: 1, label: 'Armor',
            from: [
              [{ name: 'Leather', quantity: 1 }],
              [{ name: 'Scale Mail', quantity: 1 }],
              { items: [{ name: 'Chain Mail', quantity: 1 }], condition: 'Proficient with heavy armor' },
            ],
          },
          {
            key: 'c4', choose: 1, count: 1, label: 'Pack',
            from: [{ name: "Scholar's Pack", quantity: 1 }, { name: "Explorer's Pack", quantity: 1 }],
          },
        ],
      },
    ],
    goldOption: 125,
  },
};

export default STARTING_PACKAGES;
