# Warlock Eldritch Invocations — 2024 Player's Handbook data for the picker

Built for the class-audit fixes job (warlock Invocations picker). The builder
asked for: every invocation's name, its prerequisite, a one-line effect, and
the number of invocations known at each warlock level.

## Sources (and what was checked)

- **Invocation names, prerequisites, effects:** SRD 5.2.1, the free 2024
  rules text — the same wording as the PHB for this section. Read in full
  from the SRD mirror (rules.omnisgm.com, Eldritch Invocations page) and
  cross-checked against the SRD 5.2.1 raw text (GitHub), Roll20's D&D 2024
  compendium, and the glyphforged SRD mirror. All agree on all 28.
- **Invocations known per level:** read from Zach's photo of the PHB
  Warlock Features table (`phb-2024-class-tables/11-warlock.jpg`). The
  photo is authoritative — the 2014-derived tables on the web give
  DIFFERENT numbers (see the note below) and must not be used.
- **Two disagreements resolved:**
  - *Lessons of the First Ones* — one wiki table says level 3. The SRD
    5.2.1 raw text, Roll20, World Anvil, Tavern Bag, glyphforged, and the
    SRD mirror all say **Level 2+**. Level 2 it is.
  - *Whispers of the Grave* — the SRD mirror page dropped its body text
    in the fetch. The SRD raw text, Roll20, Tavern Bag, and glyphforged
    all agree: **cast Speak with Dead without expending a spell slot.**

## Invocations known at each warlock level (PHB Warlock Features table)

| Level | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Known | 1 | 3 | 3 | 3 | 5 | 5 | 6 | 6 | 7 | 7 |

| Level | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Known | 7 | 8 | 8 | 8 | 9 | 9 | 9 | 10 | 10 | 10 |

New invocations at levels 1, 2, 5, 7, 9, 12, 15, 18.

## The 28 options (25 invocations + 3 Pact boons)

"Repeatable" means the invocation can be taken more than once, each time
for a different choice (different cantrip / different Origin feat).

| Name | Prerequisite | One-line effect | Repeatable |
|---|---|---|---|
| Agonizing Blast | Level 2+, a Warlock cantrip that deals damage | Add your Charisma modifier to that cantrip's damage rolls. | Yes |
| Armor of Shadows | — | Cast Mage Armor on yourself without a spell slot. | No |
| Ascendant Step | Level 5+ | Cast Levitate on yourself without a spell slot. | No |
| Devil's Sight | Level 2+ | See normally in magical and nonmagical Darkness within 120 ft. | No |
| Devouring Blade | Level 12+, Thirsting Blade | Thirsting Blade's Extra Attack gives two extra attacks instead of one. | No |
| Eldritch Mind | — | Advantage on Constitution saves to maintain Concentration. | No |
| Eldritch Smite | Level 5+, Pact of the Blade | Once per turn, spend a Pact slot on a pact-weapon hit: +1d8 Force per slot level, and Prone if Huge or smaller. | No |
| Eldritch Spear | Level 2+, a Warlock cantrip that deals damage and has 10+ ft range | That cantrip's range increases by 30 ft per Warlock level. | Yes |
| Fiendish Vigor | Level 2+ | Cast False Life on yourself without a spell slot (max Temp HP). | No |
| Gaze of Two Minds | Level 5+ | Bonus Action: touch a willing creature and perceive through its senses until the end of your next turn. | No |
| Gift of the Depths | Level 5+ | Breathe underwater, Swim Speed equal to Speed, cast Water Breathing once per Long Rest without a slot. | No |
| Gift of the Protectors | Level 9+, Pact of the Tome | A page in your Book of Shadows holds names (up to Cha mod); a named creature reduced to 0 HP drops to 1 HP instead, once per Long Rest. | No |
| Investment of the Chain Master | Level 5+, Pact of the Chain | Your familiar gains a Fly or Swim Speed of 40 ft, a Bonus Action attack, Necrotic/Radiant damage option, your save DC, and Reaction-granted Resistance. | No |
| Lessons of the First Ones | Level 2+ | Gain one Origin feat of your choice. | Yes |
| Lifedrinker | Level 9+, Pact of the Blade | Once per turn, a pact-weapon hit deals +1d6 Necrotic/Psychic/Radiant, and you can spend a Hit Die to heal. | No |
| Mask of Many Faces | Level 2+ | Cast Disguise Self without a spell slot. | No |
| Master of Myriad Forms | Level 5+ | Cast Alter Self without a spell slot. | No |
| Misty Visions | Level 2+ | Cast Silent Image without a spell slot. | No |
| One with Shadows | Level 5+ | In Dim Light or Darkness, cast Invisibility on yourself without a spell slot. | No |
| Otherworldly Leap | Level 2+ | Cast Jump on yourself without a spell slot. | No |
| Pact of the Blade | — | Conjure or bond a pact weapon; use Charisma for attack/damage, deal Necrotic/Psychic/Radiant or normal damage. | No |
| Pact of the Chain | — | Learn Find Familiar, cast without a slot; special forms (Imp, Pseudodragon, Quasit, Skeleton, Sphinx of Wonder, Sprite, Venomous Snake); forgo an attack to let the familiar attack. | No |
| Pact of the Tome | — | Conjure a Book of Shadows: 3 cantrips + 2 level-1 Ritual spells prepared; use as a Spellcasting Focus. | No |
| Repelling Blast | Level 2+, a Warlock cantrip that deals damage via an attack roll | On a hit vs a Large or smaller creature, push it 10 ft straight away from you. | Yes |
| Thirsting Blade | Level 5+, Pact of the Blade | Extra Attack with your pact weapon only. | No |
| Visions of Distant Realms | Level 9+ | Cast Arcane Eye without a spell slot. | No |
| Whispers of the Grave | Level 7+ | Cast Speak with Dead without a spell slot. | No |
| Witch Sight | Level 15+ | Truesight with a range of 30 ft. | No |

## Builder notes — 2024 changes that shape the picker

- **Invocations start at level 1** (1 known), not level 2. The 2014 table
  (—, 2, 2, 2, 3, 3, 4, 4, 5, 5, 5, 6, 6, 6, 7, 7, 7, 8, 8, 8) is WRONG
  for 2024 — use the table above, read from the PHB photo.
- **The Pact boons ARE invocation options.** There is no separate level-3
  Pact Boon feature in 2024 (level 3 is Warlock Subclass). A Pact is one
  of the invocation picks, available from level 1 (no prerequisite), and
  taking one unlocks its dependent invocations (Eldritch Smite /
  Thirsting Blade / Lifedrinker need Blade; Investment of the Chain
  Master needs Chain; Gift of the Protectors needs Tome). Devouring
  Blade needs Thirsting Blade, not just the Pact.
- **Prerequisite rule (SRD):** if an invocation has a prerequisite, you
  must meet it to learn it; you can learn it at the same time you meet
  the prerequisite. A level prerequisite refers to Warlock level.
- **Replacement rule (SRD):** you can't replace an invocation if it's a
  prerequisite for another invocation you have. The picker must enforce
  that (e.g. Thirsting Blade can't be swapped out while Devouring Blade
  is held).
- **2014 names that are NOT in the 2024 list** (do not offer them):
  Beguiling Influence, Beast Speech, Bewitching Whispers, Book of
  Ancient Secrets, Chains of Carceri, Dreadful Word, Eldritch Sight,
  Eyes of the Rune Keeper, among others. The table above IS the complete
  2024 list (28 options, verified against the SRD) — offer only those.
