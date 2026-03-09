# Custom Classes — Design Document

## Keeper

*A scholar who draws power from literature, language, and myth. Not arcane magic — the Keeper's power comes from the force of personality, deep knowledge of the written word, and the ability to manifest the stories they've studied into reality.*

### Identity

- **Primary Ability:** CHA (force of personality, rhetorical power)
- **Secondary Ability:** INT (must have read the books)
- **Hit Die:** d8
- **Saving Throws:** CHA, INT
- **Armor Proficiencies:** Light armor
- **Weapon Proficiencies:** Simple weapons + manifested weapons
- **Tool Proficiencies:** Calligrapher's Supplies
- **Skills:** Choose 3 from Arcana, Deception, History, Insight, Investigation, Perception, Performance, Persuasion

### Class Structure

The Keeper has three layers of identity:

1. **Base Class** — Every Keeper gets the full core feature set. The class is complete on its own.
2. **Genre Domain (L3)** — Literary genre specialization that shapes your scholarly identity and passive benefits. All Keepers choose one. A second Genre (or Genre Mastery) is gained at L15.
3. **Subclass (L6, optional)** — Combat role specialization. Keepers who don't take a subclass gain the Polymath track instead, rewarding breadth over depth.

### Level Progression

| Level | Feature | Texts Known | Recitations |
|-------|---------|:-----------:|:-----------:|
| 1 | Recitation, Manifest Weapon, Keeper's Library, Keeper's Insight | 3 | 2 |
| 2 | Literary Recall (CHA mod/long rest), **Keeper's Study** (PB/long rest) | 4 | 2 |
| 3 | **Genre Domain** (1st), Genre bonus text | 5+1 | 2 |
| 4 | ASI | 5+1 | 3 |
| 5 | Extra Attack, Eidetic Memory | 6+1 | 3 |
| 6 | **Subclass** (optional) OR Polymath | 6+1 | 3 |
| 7 | Annotated Texts (INT mod to damage 1/turn) | 7+1 | 3 |
| 8 | ASI | 7+1 | 3 |
| 9 | Expanded Library (Rare texts) | 8+1 | 4 |
| 10 | Compelling Rhetoric | 8+1 | 4 |
| 11 | **Subclass feature** OR Polymath: Broad Study, Manifest Weapon +1d6 | 9+1 | 4 |
| 12 | ASI | 9+1 | 4 |
| 13 | Living Text | 10+1 | 4 |
| 14 | Unwritten Knowledge | 10+1 | 5 |
| 15 | **Subclass feature** OR Polymath: Renaissance Scholar, **2nd Genre OR Genre Mastery** | 11+2 | 5 |
| 16 | ASI | 11+2 | 5 |
| 17 | Masterwork Manifest (2 simultaneous weapons) | 12+2 | 5 |
| 18 | Keeper's Authority | 12+2 | 6 |
| 19 | ASI | 13+2 | 6 |
| 20 | Living Library | 14+2 | 6 |

### Core Features

**Recitation (L1)** — Cantrip equivalent. Short verbal invocations, always available, no components needed. 1d8 damage (psychic/force/radiant), temp HP, or forced saves. Scales: 2d8 at L5, 3d8 at L11, 4d8 at L17. 60 ft range (attacks), 30 ft range (buffs).

**Manifest Weapon (L1)** — Bonus action: summon a weapon from a text. Uses CHA for attack/damage. Magical, lasts 1 minute or until dismissed. One weapon at a time (two at L17). At L11, +1d6 force/radiant/psychic per hit.

**Keeper's Library (L1)** — Know 3 texts at L1, scaling to 14 at L20. Each text = a weapon type + a Passage (once per short rest special effect). Keeper save DC = 8 + proficiency + CHA modifier.

**Keeper's Insight (L1)** — History proficiency (expertise if already proficient).

**Literary Recall (L2)** — CHA mod times per long rest, re-use an expended Passage.

**Keeper's Study (L2)** — Bonus action: mark a creature within 60 ft as "Studied" (PB times per long rest, 1 minute). Recitations and manifested weapon attacks deal extra damage to Studied creatures: 1d4 (L2), 1d6 (L9), 1d8 (L15). Also learn one fact about it (creature type, resistance/vulnerability/immunity, or highest ability score).

**Eidetic Memory (L5)** — No physical books needed. Can't lose Library. Advantage on INT checks to recall any text ever read.

**Annotated Texts (L7)** — Add INT mod to manifested weapon damage 1/turn.

**Expanded Library (L9)** — Unlock Rare texts (more powerful Passages and exotic weapons).

**Compelling Rhetoric (L10)** — 1/short rest: action to charm or frighten a creature within 60 ft (WIS save, 1 minute, save at end of each turn).

**Manifest Weapon Improvement (L11)** — +1d6 damage per hit (force/radiant/psychic).

**Living Text (L13)** — 1/short rest: weapon makes an opportunity attack on its own, OR hovers for +1 AC until next turn.

**Unwritten Knowledge (L14)** — Learn texts from defeated notable enemies or discovered lore sites. Max = INT mod bonus texts.

**Masterwork Manifest (L17)** — Two simultaneous weapons from different texts, both Passages accessible.

**Keeper's Authority (L18)** — Advantage on CHA checks related to knowledge/lore/intellectual authority.

**Living Library (L20)** — 1/long rest, 1 minute: free weapon switching, all Passages restored, Recitations deal double damage, resistance to psychic and force.

### Genre Domains

Chosen at L3. Second Genre or Genre Mastery at L15. Each gives a passive benefit + a bonus text.

| Genre | Passive | Mastery Capstone |
|-------|---------|-----------------|
| **History** | Advantage on recall checks; learn one enemy fact when targeting with Passage | Lesson of the Past: advantage on attacks vs one creature for 1 min |
| **Tactics** | +INT to initiative; +1d6 damage on first round | Battle Plan: 4 allies gain INT to initiative + advantage on first attack/turn |
| **Romance** | +CHA to Persuasion/Deception; reaction temp HP when ally drops to 0 | Lover's Vow: damage-sharing bond with one ally for 1 min |
| **Poetry** | Doubled Recitation range; consecutive same-Recitation +1d8 | Magnum Opus: max Recitation damage + DC +2 for 1 min |
| **Mythology** | Resistance to chosen type; Passages can deal that type | Mythic Invocation: +2d6 chosen type on weapons, immunity for 1 min |
| **Political Science** | Insight expertise; Compelling Rhetoric target has disadvantage on save | Edict of Authority: mass Command for up to 6 creatures |
| **Natural Philosophy** | Elemental weapon types; advantage on Nature/Survival | Theorem of Elements: elemental afflictions on hit for 1 min |
| **Forbidden Texts** | Necrotic/psychic options; self-damage 1d6 to add 2d6 to Passage | Forbidden Chapter: Passages as free actions for 1 min (at a cost) |

### Subclasses (Optional, L6)

Features at L6/L11/L15. Keepers who skip subclass gain Polymath instead.

**Lorewarden** — Tank/melee
- L6: Guardian's Manifest (+2 AC shield when manifesting, PB/LR reaction to impose disadvantage on attacks vs allies)
- L11: Bastion of Lore (aura: +INT mod to saves for allies within 10 ft, replace one attack with Passage)
- L15: Saga of the Unbreakable (prevent death: ally drops to 1 HP + temp HP + resistance for 1 round)
- Subclass Texts: The Fall of Myth Drannor (L6), The Purple Dragon Field Manual (L11), The Shieldmeet Concordance (L15)
- Best Genre: Tactics (A+) | Worst Genre: Forbidden Texts (C)

**Mythslinger** — Ranged striker
- L6: Legendary Aim (150/600 range, +1d8/2d8/3d8 per hit scaling)
- L11: Volley of Legends (attack all creatures in 30 ft radius, 1/short rest)
- L15: The Shot That Echoes (crit on 17-20, +6d8 force, AoE thunder, 1/long rest)
- Subclass Texts: Volo's Guide to the Sword Coast (L6), The Ballad of the Windwalkers (L11), Elminster's Annotations on the Dracorage (L15)
- Best Genres: Tactics/Mythology/Natural Philosophy (A+) | Worst Genres: Romance/Political Science (C)

**Rhetorician** — Controller/debuffer
- L6: Words as Weapons (Recitations as bonus action CHA mod/LR, failed saves = disadvantage on next attack)
- L11: Subjugating Rhetoric (impose speed halved, no reactions, or forced Dash on hit, 1/short rest)
- L15: Forbidden Oration (up to 3 creatures: paralyze or silence, 1/long rest)
- Subclass Texts: Alaundo's Prophecies (L6), The Cyrinishad (L11), The Leaves of One Night (L15)
- Best Genres: Poetry/Political Science (A+/A) | Worst Genres: Romance/Natural Philosophy (C)

**Versebinder** — Healer/support
- L6: Mending Verse (free healing on Passage use, 1d8/2d8/3d8 + CHA scaling)
- L11: Covenant of Restoration (mass heal + condition removal + fear/charm immunity for 6 allies, 1/long rest)
- L15: The Verse That Cannot Be Unwritten (resurrect ally within 1 round of death, 1/long rest)
- Subclass Texts: The Canticle of Selune (L6), Deneir's Illuminated Codex (L11), The Leaves of Learning (L15)
- Best Genre: Romance (A+) | Worst Genre: Forbidden Texts (C)

### Polymath Track (Pure Keeper)

**L6 — Polymath:** +2 skill proficiencies, +2 Literary Recall uses, manifest as free action.

**L11 — Polymath: Broad Study:** +2 bonus texts from any Genre, free weapon swap 1/short rest.

**L15 — Polymath: Renaissance Scholar:** Use any Genre's passive for 1 min (1/long rest), +CHA mod to all Passage damage/healing/DCs.

### Data Files

- `client/src/data/classes.json` — Full class entry with features, Genre Domains, subclasses, Polymath track, keeperAbilities scaling arrays
- `client/src/data/keeperTexts.js` — 8 Recitations, 18 Standard Texts, 8 Rare Texts, 12 Subclass Texts (3 per subclass, FR lore), Genre Domain reference data

### Text Catalog Summary

**Recitations (8):** Cutting Words, Whispered Ward, Spoken Command, Narrative Spark, Echo of Resolve, Verdant Rebuke, Illuminating Passage, Binding Syllable

**Standard Texts (18):**
- Melee: Siege of Aranthor (greataxe), Hymn of the Silver River (shortsword), Titan's Lament (maul), Duelist's Confession (rapier), Wrath of the Storm King (longsword), Wanderer's Road (quarterstaff), Iron Vow (warhammer), Song of the Serpent (scimitar), Chronicle of the First Flame (mace), Diplomat's Dilemma (dagger), Librarian's Last Stand (club), Fables of the Trickster Fox (whip)
- Ranged: Hawk's Pursuit (longbow), Bandit Queen's Gambit (hand crossbow), Saga of the Stone Thrower (sling), Wind Dancer's Diary (thrown dagger), Cartographer's Last Map (light crossbow)

**Rare Texts (8):** Dragon's Epitaph (greatsword), Memoirs of the Archmage's Shadow (shortsword), Siege Engine's Blueprint (heavy crossbow), Revenant's Confession (morningstar), Celestial Concordance (halberd), War Poet's Final Stanza (glaive), Prophecy Unspoken (longbow), Testament of the Peacemaker (shield/ward)

---

## Design Status

### Keeper — Implemented
- [x] Base class in classes.json with full feature progression
- [x] Genre Domains with passives, mastery upgrades, and capstones
- [x] All 4 subclasses with L6/L11/L15 features
- [x] Polymath track as subclass alternative
- [x] keeperAbilities scaling arrays (textsKnown, recitations, damage)
- [x] 8 Recitations catalog
- [x] 18 Standard Texts + 8 Rare Texts with weapons and Passages
- [x] Genre Domain reference data
- [x] Added to ALL_CLASSES arrays and HIT_DICE maps

### Keeper — Integrated
- [x] DB migration (020) for keeper_texts, keeper_recitations, keeper_genre_domain, keeper_specialization columns
- [x] Server character routes (POST/PUT/level-up) handle Keeper fields
- [x] Character creation wizard: text + recitation selection in Step 2, subclass note in Step 1
- [x] Level-up flow: Genre Domain at L3, Subclass/Polymath at L6, text/recitation selection at each level
- [x] AI DM prompt (dmPromptBuilder.js): Keeper abilities section with rules summary
- [x] AI DM Mode prompt (dmModePromptBuilder.js): Keeper abilities block in character sheets
- [x] levelProgression.js: CLASS_FEATURES, SUBCLASS_LEVELS (6), HIT_DICE (8), MULTICLASS_REQUIREMENTS (CHA 13 + INT 13), CASTER_TYPE (none), KEEPER_PROGRESSION

### Keeper — Balance & Subclass Enhancement (Done)
- [x] Keeper's Study (L2): PB/LR bonus action to mark creature, extra 1d4/1d6/1d8 damage + learn one fact
- [x] Balance pass: Rhetorician Words as Weapons limited to CHA mod/LR, Forbidden Oration limited to 3 targets
- [x] Balance pass: Mythslinger Shot That Echoes crit range 17-20 (was 15-20)
- [x] Balance pass: Lorewarden Guardian's Manifest reaction uses PB/LR (was CHA/LR)
- [x] Subclass-specific texts (12 total, 3 per subclass) grounded in Forgotten Realms lore
- [x] Genre+Subclass interaction matrix with synergy descriptions and ratings in classes.json
- [x] keeperStudyDie progression in KEEPER_PROGRESSION
- [x] DM prompt builders updated for Keeper's Study

### Keeper — UI Integration (Done)
- [x] LevelUpPage: Genre interaction ratings shown in L6 subclass picker with synergy descriptions
- [x] LevelUpPage: Subclass texts auto-granted at L6/L11/L15 with notification cards
- [x] LevelUpPage: L15 Second Genre Domain vs Genre Mastery choice UI (gold/purple themed)
- [x] LevelUpPage: Keeper review section showing all choices (genre, specialization, mastery, texts, recitations)
- [x] Server: character.js level-up route handles keeperSecondGenre, keeperGenreMastery, keeperSubclassText
- [x] Server: Subclass texts merged with player-chosen texts in DB update

### Keeper — Subclass Flavor (Done)
- [x] All 4 subclasses have flavor, quote, and archetypeFeels fields
- [x] Flavor text uses generic fantasy archetypes (knights, scouts, monks, spymasters) — no deep FR proper nouns
