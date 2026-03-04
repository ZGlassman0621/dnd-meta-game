# Future Features & Enhancements

Feature ideas for future implementation.

---

## Themes System (Leveling Backgrounds)

**Priority:** Medium
**Status:** Design in progress — not ready to implement

Inspired by Starfinder's Themes. The concept is to take D&D's existing backgrounds and expand them into a progression system that grants new abilities at milestone levels (1, 5, 11, 17), giving characters a "concept layer" that evolves alongside class and subclass rather than being a static L1 choice.

**Core design:**
- Each standard D&D background becomes a Theme with 4 tiers of abilities
- L1: Skill/tool proficiencies + a passive flavor trait (same as current backgrounds)
- L5: A small active or always-on ability tied to the theme's identity
- L11: Expertise Die (d6 → d8 → d10 scaling by tier) on the theme's key skills — unlocked here so it feels earned
- L17: A capstone that makes the concept feel legendary

**Expertise Die** is the signature mechanic of this system — an extra die added to certain skill checks, tied to theme identity rather than class. A Knowledge Cleric + Acolyte Theme gets it on Religion/Insight; a Criminal rogue gets it on Deception/Stealth; a Sage wizard gets it on two Intelligence skills. Any class can access any theme's Expertise Die by choosing that theme, which creates interesting cross-class flavor (a Fighter + Sage Theme is a military historian).

**Ancestry Feats (companion concept, design in progress):**
Inspired by Pathfinder 2e, where racial/ancestry traits aren't just a L1 dump but a progression — feats unlocked at levels 1, 5, 9, 13, 17 from a race-specific list. A dwarf might unlock tremorsense at L9, magic stonecunning at L13, and stone giant resilience at L17. An elf might unlock fey step, trance mastery, or elven weapon training at different milestones.

The Themes System and Ancestry Feats should be designed together since they occupy the same conceptual space — both are "progression layers that aren't class or subclass." The goal is that a character's identity emerges from the intersection of all three: class, theme, and ancestry, each evolving in parallel.

**Open design questions:**
- Does Theme replace Background entirely, or sit alongside it?
- Should the Expertise Die scale with proficiency bonus or with tier (5/11/17)?
- How do the 2024 PHB Origin Feats interact — does Theme replace the Origin Feat, or grant an additional one?
- Custom Themes: should the character creator allow players to define a custom Theme with DM approval?
- How does this interact with the existing Mythic Paths system? (A Hierophant + Acolyte Theme combo should feel very different from a Hierophant + Soldier Theme)
- For Ancestry Feats: do all races get the same number of feats, or do more complex races (half-elf, tiefling) get more options at the cost of weaker individual feats?
- Should Ancestry Feats and Theme abilities ever interact/combo? (e.g. a dwarf with the Soldier theme at L11 might unlock something neither grants alone)

---

## Treat Wounds (Medicine Skill Action)

**Priority:** Medium
**Status:** Ready to design — relatively self-contained

Inspired by Pathfinder 2e. Gives the Medicine skill a meaningful out-of-combat healing role, reducing the game's dependence on spell slots and short rests for recovery. Fits naturally alongside the existing survival system (food/water/foraging).

**Core design:**
- 10-minute action, requires healer's kit (or herbalism kit)
- Medicine check vs DC determines how much HP is restored:
  - DC 15 (trained): 2d8 HP
  - DC 20 (expert, proficiency bonus ≥ +4): 2d8+10 HP
  - DC 25 (master, proficiency bonus ≥ +5): 2d8+20 HP
  - DC 30 (legendary, proficiency bonus ≥ +6): 2d8+30 HP
- Critical success (beat DC by 10+): double the flat bonus
- Critical failure (miss DC by 10+): deal 1d8 damage to the patient instead
- Can only be used on a given creature once per hour (prevents spam)
- Cannot restore HP beyond the creature's maximum

**Integration notes:**
- Pairs well with the Degrees of Success system (also in FUTURE_FEATURES) — if that system is implemented, Treat Wounds is a natural first showcase for 4-outcome rolls
- The existing survival system already tracks foraging/food; herbalism kit proficiency (already in the game) could optionally lower the DC by 2 or expand the usable materials
- Could tie into the Themes system: a Healer or Hermit Theme at L5 might grant advantage on Treat Wounds checks or remove the once-per-hour restriction on allies

**Open design questions:**
- Does this replace or supplement short rest hit dice recovery?
- Should NPCs/companions also benefit, and does the AI DM know to prompt for it during rests?
- Should there be a "battlefield medicine" variant usable in 1 action at a higher DC and lower healing?

---

## Procedural Dungeon Generation

**Priority:** Medium

- Generate dungeon layouts with rooms, corridors, doors, traps, and treasures
- Room-by-room exploration with state tracking (visited, cleared, locked)
- Dungeon map display showing explored areas
- Encounters tied to specific rooms
- Keys, puzzles, and locked doors creating exploration objectives

---

## Character Image Generation

**Priority:** Low

- "Generate Portrait" button on character sheet
- Uses character description (race, class, appearance, gender) as prompt input
- Generates a D&D-style fantasy portrait via image generation API (DALL-E, Stable Diffusion, etc.)
- Player can regenerate if they don't like the result
- Stretch: companion portraits, location art, scene illustrations during DM sessions

---

## Visual World Map

**Priority:** Low

- Location markers on a stylized map
- Fog of war for unexplored areas
- Travel routes between discovered locations
- Click-to-travel for known destinations
- Notable event markers on the map

---

## Tavern Mini-games

**Priority:** Low

- Dice games (Liar's Dice, Three Dragon Ante)
- Card games with NPC opponents
- Drinking contests with Constitution checks
- Gambling with gold stakes
- Win/loss affects NPC relationships

---

## Legacy System

**Priority:** Low

- Retired characters become NPCs in the world
- Dead characters' graves/monuments can be discovered
- Previous characters' actions reflected in world state
- Items left behind can be found by new characters
- Legends and stories about previous characters circulate among NPCs
