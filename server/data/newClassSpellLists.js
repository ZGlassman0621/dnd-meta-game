// ============================================================
// newClassSpellLists.js — subclass-restricted spell lists as DATA
// (not mechanics). Source for every array/descriptor is the Magus,
// Warden, and Scholar digests in
// ~/workspace/dnd-app-review/new-classes-staging/digests/,
// reconstructed from the "Magus Spell Lists" pages of the Magus
// extract (column-split and count-checked — see notes below).
// Overlap across societies is expected and preserved: each society
// array is kept exactly as printed, NOT deduplicated across societies.
// Name spellings follow the live spell catalog where they differ
// from the printed list (Witch Bolt, not "Witchbolt"; Skywrite, not
// "Skywriting"; Thorn Whip, not "Thornwhip"); the printed variant is
// noted in a comment on the affected society.
// COUNT NOTE: reconstructed totals are Arcane Order 76, Knights
// Stygian 69, Primordial Seal 75, Shadow Court 72, Sidereal Cabal
// 83, Sylvan Circle 77 = 452 list entries. The Magus digest counts
// Shadow Court at 71 (3rd level 11); the extract's Shadow Court
// 3rd-level column holds 12 entries (Water Breathing included
// before the 4th-level header), so this file records 72 and flags
// the one-entry digest discrepancy rather than dropping a spell.
// All other society totals match the digest exactly.
// ============================================================

export const MAGUS_SOCIETY_SPELL_LISTS = {
  // Source: Magus digest, Arcane Order list (cantrips 12, 1st 13,
  // 2nd 14, 3rd 13, 4th 9, 5th 7, 6th 8 = 76).
  'Arcane Order': [
    'Arcing Arrow', 'Blade Ward', 'Dancing Lights', 'Green-Flame Blade',
    'Mage Hand', 'Message', 'Minor Illusion', 'Prestidigitation',
    'Spell-Shattering Strike', 'Sword Burst', 'True Strike', 'Vortex Dart',
    'Alarm', 'Color Spray', 'Comprehend Languages', 'Detect Magic',
    'False Life', 'Feather Fall', 'Find Familiar', 'Grease', 'Identify',
    'Magic Missile', "Shield", 'Sleep', "Tenser's Floating Disk",
    'Blur', 'Cloud of Daggers', 'Crown of Madness', 'Darkness',
    'Darkvision', 'Enlarge/Reduce', 'Hold Person', 'Invisibility',
    'Levitate', 'Misty Step', "Nystul's Magic Aura", 'Phantasmal Force',
    'Rope Trick', 'See Invisibility',
    'Blink', 'Clairvoyance', 'Counterspell', 'Dispel Magic', 'Fireball',
    'Fly', 'Haste', 'Hypnotic Pattern', "Leomund's Tiny Hut",
    'Magic Circle', 'Slow', 'Tiny Servant', 'Tongues',
    'Arcane Eye', 'Banishment', 'Confusion', 'Dimension Door',
    "Evard's Black Tentacles", 'Fabricate', 'Hallucinatory Terrain',
    "Leomund's Secret Chest", 'Locate Creature',
    'Animate Objects', "Bigby's Hand", 'Contact Other Plane', 'Creation',
    'Far Step', 'Hold Monster', 'Passwall',
    'Arcane Gate', 'Contingency', 'Create Homunculus', 'Disintegrate',
    "Drawmij's Instant Summons", 'Magic Jar', 'Scatter', 'True Seeing',
  ],
  // Source: Magus digest, Knights Stygian list (cantrips 9, 1st 14,
  // 2nd 12, 3rd 12, 4th 6, 5th 9, 6th 7 = 69).
  'Knights Stygian': [
    'Blade Ward', 'Bloodletting Bite', 'Chill Touch', 'Death Shroud',
    'Mending', 'Resistance', 'Spare the Dying', 'Thaumaturgy', 'True Strike',
    'Arms of Hadar', 'Aspir', 'Bane', 'Cause Fear', 'Corpse Mask',
    'Detect Poison and Disease', 'Dissonant Whispers', 'Drain', 'False Life',
    'Hex', 'Inflict Wounds', 'Ray of Sickness', 'Sleep',
    "Tasha's Hideous Laughter",
    'Blindness/Deafness', 'Darkness', 'Darkvision', 'Crown of Madness',
    'Gentle Repose', 'Phantasmal Force', 'Ray of Enfeeblement',
    'See Invisibility', 'Shatter', 'Silence', 'Spider Climb', 'Web',
    'Animate Dead', 'Bestow Curse', 'Dispel Magic', 'Fear', 'Feign Death',
    'Gaseous Form', 'Hunger of Hadar', 'Phantom Steed', 'Revivify', 'Slow',
    'Speak with Dead', 'Vampiric Touch',
    'Banishment', 'Blight', 'Death Ward', 'Dominate Beast',
    "Evard's Black Tentacles", 'Phantasmal Killer',
    'Cloudkill', 'Contagion', 'Danse Macabre', 'Enervation', 'Hallow',
    'Insect Plague', 'Negative Energy Flood', 'Passwall', 'Raise Dead',
    'Circle of Death', 'Create Undead', 'Disintegrate', 'Eyebite', 'Harm',
    'Magic Jar', 'Soul Cage',
  ],
  // Source: Magus digest, Primordial Seal list (cantrips 10, 1st 12,
  // 2nd 14, 3rd 13, 4th 9, 5th 6, 6th 11 = 75). Printed "Witchbolt"
  // is recorded here as the catalog spelling "Witch Bolt".
  'Primordial Seal': [
    'Acid Splash', 'Arcing Arrow', 'Booming Blade', 'Create Bonfire',
    'Control Flames', 'Green-Flame Blade', 'Gust', 'Mold Earth',
    'Rime Strike', 'Shape Water',
    'Absorb Elements', 'Alarm', 'Burning Hands', 'Catapult',
    'Chromatic Orb', 'Detect Magic', 'Earth Tremor', 'Feather Fall',
    'Ice Knife', 'Storm Step', 'Thunderwave', 'Witch Bolt',
    "Aganazzar's Scorcher", 'Arcane Lock', 'Dust Devil', 'Earthbind',
    'Flaming Sphere', 'Gust of Wind', 'Knock', "Maximilian's Earthen Grasp",
    "Melf's Acid Arrow", 'Pyrotechnics', 'Scorching Ray', 'Shatter',
    "Snilloc's Snowball Swarm", 'Warding Wind',
    'Call Lightning', 'Erupting Earth', 'Fireball', 'Flame Arrows',
    'Gaseous Form', 'Lightning Bolt', 'Meld into Stone', 'Sleet Storm',
    'Tidal Wave', 'Wall of Sand', 'Wall of Water', 'Water Walk', 'Wind Wall',
    'Conjure Minor Elementals', 'Control Water', 'Elemental Bane',
    'Fire Shield', 'Ice Storm', 'Stone Shape', 'Storm Sphere',
    'Watery Sphere', 'Wall of Fire',
    'Cone of Cold', 'Conjure Elemental', 'Control Winds', 'Immolation',
    'Transmute Rock', 'Wall of Stone',
    'Chain Lightning', 'Flesh to Stone', 'Investiture of Flame',
    'Investiture of Ice', 'Investiture of Stone', 'Investiture of Wind',
    'Move Earth', "Otiluke's Freezing Sphere", 'Primordial Ward',
    'Wall of Ice', 'Wind Walk',
  ],
  // Source: Magus digest, Shadow Court list (cantrips 8, 1st 13,
  // 2nd 15, 3rd 12 as printed in the extract, 4th 9, 5th 9, 6th 6
  // = 72; digest says 71 — see header note).
  'Shadow Court': [
    'Corrupted Ki Kata', 'Dancing Lights', 'Death Shroud', 'Mage Hand',
    'Message', 'Minor Illusion', 'Nerve Pinching Kata', 'Ten Thousand Masks',
    'Alarm', 'Disguise Self', 'Expeditious Retreat', 'Feather Fall',
    'Fog Cloud', 'Grease', 'Illusory Script', 'Jump', 'Longstrider',
    'Silent Image', 'Sleep', 'Snare', 'Unseen Servant',
    'Blur', 'Darkness', 'Darkvision', 'Find Traps', 'Hold Person',
    'Invisibility', 'Knock', 'Locate Object', 'Mirror Image', 'Misty Step',
    'Pass Without Trace', 'Protection from Poison', 'Rope Trick',
    'See Invisibility', 'Silence',
    'Blink', 'Clairvoyance', 'Dispel Magic', 'Enemies Abound', 'Fear',
    'Feign Death', 'Gaseous Form', 'Major Image', 'Nondetection', 'Sending',
    'Vampiric Touch', 'Water Breathing',
    'Confusion', 'Dimension Door', 'Freedom of Movement',
    'Greater Invisibility', 'Hallucinatory Terrain', "Leomund's Secret Chest",
    'Locate Creature', 'Phantasmal Killer', 'Polymorph',
    'Dominate Person', 'Dream', 'Hold Monster', 'Mental Prison', 'Mislead',
    'Modify Memory', 'Passwall', 'Scrying', 'Seeming',
    'Eyebite', 'Find the Path', 'Guards and Wards', 'Programmed Illusion',
    'True Seeing', 'Wind Walk',
  ],
  // Source: Magus digest, Sidereal Cabal list (cantrips 10, 1st 19,
  // 2nd 15, 3rd 14, 4th 6, 5th 13, 6th 6 = 83).
  'Sidereal Cabal': [
    'Blade Ward', 'Dancing Lights', 'Guidance', 'Mage Hand', 'Message',
    'Minor Illusion', "Misfortune's Mark", 'Shillelagh', 'True Strike',
    'Vortex Dart',
    'Bane', 'Bless', 'Charm Person', 'Command', 'Comprehend Languages',
    'Detect Evil and Good', 'Detect Magic', 'Faerie Fire', 'Feather Fall',
    'Guiding Bolt', 'Identify', 'Illusory Script', 'Jump', 'Longstrider',
    'Magic Missile', 'Protection from Evil and Good', 'Sanctuary',
    'Silent Image', 'Sleep',
    'Augury', 'Blur', 'Calm Emotions', 'Darkness', 'Darkvision',
    'Detect Thoughts', 'Find Traps', 'Hold Person', 'Levitate',
    'Lesser Restoration', 'Locate Object', 'Mind Spike', 'Misty Step',
    'Moonbeam', 'See Invisibility',
    'Bestow Curse', 'Blinding Smite', 'Catnap', 'Clairvoyance',
    'Counterspell', 'Daylight', 'Enemies Abound', 'Find Vessel', 'Fly',
    'Haste', "Melf's Minute Meteors", 'Nondetection', 'Remove Curse', 'Slow',
    'Arcane Eye', 'Banishment', 'Dimension Door', 'Divination',
    'Locate Creature', "Otiluke's Resilient Sphere",
    'Dawn', 'Dispel Evil and Good', 'Dream', 'Far Step', 'Geas',
    'Greater Restoration', 'Hold Monster', 'Legend Lore', 'Scrying',
    'Skill Empowerment', 'Synaptic Static', 'Telekinesis', 'Wall of Light',
    'Arcane Gate', 'Find the Path', 'Forbiddance', 'Scatter', 'Sunbeam',
    'True Seeing',
  ],
  // Source: Magus digest, Sylvan Circle list (cantrips 11, 1st 15,
  // 2nd 15, 3rd 11, 4th 10, 5th 8, 6th 7 = 77). Printed "Skywriting"
  // is recorded here as the catalog spelling "Skywrite"; printed
  // "Thornwhip" as "Thorn Whip".
  'Sylvan Circle': [
    'Booming Blade', 'Druidcraft', 'Fungal Bloom', 'Give Life', 'Light',
    'Magic Stone', 'Resistance', 'Rime Strike', 'Spare the Dying',
    'Thorn Whip', "Warden's Rebuke",
    'Animal Friendship', 'Beast Bond', 'Create or Destroy Water',
    'Cure Wounds', 'Detect Poison and Disease', 'Ensnaring Strike',
    'Entangle', 'Fog Cloud', 'Goodberry', 'Hail of Thorns', 'Jump',
    'Longstrider', 'Purify Food and Drink', 'Speak with Animals',
    'Spore Cloud',
    'Alter Self', 'Animal Messenger', 'Barkskin', 'Beast Sense',
    'Darkvision', 'Enhance Ability', 'Gust of Wind', 'Lesser Restoration',
    'Locate Animals or Plants', 'Moonbeam', 'Pass Without Trace',
    'Protection from Poison', 'Skywrite', 'Spike Growth', 'Warding Wind',
    'Conjure Animals', 'Daylight', 'Dispel Magic', 'Meld into Stone',
    'Plant Growth', 'Protection from Energy', 'Revivify', 'Speak with Plants',
    'Stinking Cloud', 'Water Breathing', 'Water Walk',
    'Blight', 'Conjure Woodland Beings', 'Death Ward', 'Dominate Beast',
    'Giant Insect', 'Grasping Vine', 'Guardian of Nature', 'Locate Creature',
    'Polymorph', 'Stone Shape',
    'Awaken', 'Commune with Nature', 'Contagion', 'Greater Restoration',
    'Insect Plague', 'Reincarnate', 'Tree Stride', 'Wrath of Nature',
    'Druid Grove', 'Find the Path', 'Heal', "Heroes' Feast", 'Sunbeam',
    'Transport via Plants', 'Wall of Thorns',
  ],
};

// Source: Warden digest, "Subclass spellcasting" section. NEITHER
// subclass has a fixed list — spells are player-chosen from the
// base-class list under the school restrictions below. Do NOT expand
// these descriptors into full arrays. The any-school exception picks
// (spells learned at warden levels 8, 14, 20) are NOT modeled by the
// gating service: they require learning-history input the service
// does not take, so the service enforces the school restriction
// strictly and names the exception in its rejection reason.
export const WARDEN_CASTING_SUBCLASSES = {
  // Loreseeker: Intelligence, wizard spell list, casting from 3rd.
  // Initial 3 known: 1st-level wizard spells, two of which must be
  // abjuration or evocation; later known spells must be
  // abjuration/evocation of a level you have slots for.
  Loreseeker: {
    baseClass: 'Wizard',
    schools: ['Abjuration', 'Evocation'],
    castingFromLevel: 3,
    anySchoolAtLevels: [8, 14, 20],
    schoolAppliesTo: 'leveled spells only (cantrips: any wizard cantrip)',
  },
  // Soulblood Shaman: Wisdom, druid spell list, casting from 3rd.
  // Initial 3 known: 1st-level druid spells, two of which must be
  // evocation or transmutation; later known spells must be
  // evocation/transmutation of a level you have slots for.
  'Soulblood Shaman': {
    baseClass: 'Druid',
    schools: ['Evocation', 'Transmutation'],
    castingFromLevel: 3,
    anySchoolAtLevels: [8, 14, 20],
    schoolAppliesTo: 'leveled spells only (cantrips: any druid cantrip)',
  },
};

// Source: Scholar digest, Ritualist and Theologian field sections.
// NEITHER has a fixed list. Ritualist learns from ANY spell list but
// (with exceptions) only ritual-tagged spells; Theologian prepares
// from the cleric list, plus Daily Devotion domain spells (domain
// spells are subclass data owned by the subclass-entries agent,
// not this descriptor).
export const SCHOLAR_CASTING_SUBCLASSES = {
  // Ritualist: Intelligence, casting from 3rd (field feature).
  // Cantrips 2 at 3rd, 3 at 9th+ (any spell list). Spells known 3 at
  // 3rd to 13 at 20th (any spell list); two of the initial three
  // must have the ritual tag; every learned spell must have the
  // ritual tag and be of a level you have slots for, EXCEPT spells
  // learned at 7th, 10th, 16th, 20th (no ritual tag required).
  Ritualist: {
    baseClass: null,
    anyList: true,
    ritualOnly: true,
    castingFromLevel: 3,
    nonRitualAtLevels: [7, 10, 16, 20],
  },
  // Theologian: Intelligence, cleric spell list, prepared (not
  // known), casting from 3rd. Cantrips 2 at 3rd, 3 at 9th+. Spells
  // prepared 3 at 3rd to 13 at 20th (table headed "Spells Known" in
  // the extract; preparation mechanic is unambiguous).
  Theologian: {
    baseClass: 'Cleric',
    prepared: true,
    castingFromLevel: 3,
  },
};
