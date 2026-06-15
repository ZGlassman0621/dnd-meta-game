# MYTHIC PROGRESSION SYSTEM — FUTURE FEATURE GUIDE
*Order of Dawn's Light Campaign | Reference Document for Future Implementation*

**STATUS:** Framework only. Not active in Campaign I. This document catalogs every system, source, and design decision for building a post-Level 20 mythic progression system when the campaign reaches that point. Characters should not be pre-assigned to paths — let gameplay determine who fits where.

**DESIGN PHILOSOPHY:** Rules serve story. Characters earn mythic status through narrative trials and player choice, not through predetermined arcs or XP thresholds. The DM tracks The Master's mythic evolution behind the scenes; players discover their own paths organically through play.

---

## TABLE OF CONTENTS

1. Source Systems & What We're Drawing From
2. The Tier Framework (Universal)
3. Base Mythic Abilities (Universal Chassis)
4. Mythic Paths (Player-Facing Options)
5. Dark/Villain Paths (DM-Only)
6. Mythic Items & Legendary Weapons
7. Mythic Monsters & Boss Design
8. Piety System (Can Implement Before Level 20)
9. Epic Boons (Bridge Between Level 19 and Mythic)
10. Integration With Existing Homebrew
11. Bounded Accuracy & Balance Principles
12. Multi-Campaign Timeline
13. Implementation Checklist
14. Open Design Questions

---

## 1. SOURCE SYSTEMS & WHAT WE'RE DRAWING FROM

### Primary Sources

**Pathfinder 1E: Mythic Adventures (2013, Paizo)**
The most complete mythic ruleset in tabletop RPGs. 10 tiers, 6 paths (Archmage, Champion, Guardian, Hierophant, Marshal, Trickster), Mythic Power resource pool, Surge mechanic, universal base abilities, mythic feats, mythic spells, mythic monsters, legendary items, and trial-based advancement. We condense the 10 tiers to 5 to fit 5E's design philosophy, but the mechanical chassis (Mythic Power, Surge, base abilities) is the foundation.

**Pathfinder: Wrath of the Righteous (2021, Owlcat Games)**
Video game adaptation that expanded Mythic Adventures with 10 paths: Angel, Demon, Aeon, Azata, Lich, Trickster, Gold Dragon, Devil, Legend, and Swarm-That-Walks. Each path has unique spellbooks, transformations, companion interactions, and narrative consequences. The alignment-gated path system and late-game path-switching mechanics are directly relevant to our design.

**D&D 5E: Epic Boons (DMG 2014 / PHB 2024)**
Official post-Level 20 system. In 2024 rules, Epic Boon feats are available from Level 19 with additional boons every 30,000 XP past 20. Modest power bumps (turn miss to hit, teleport 30 ft, +40 HP, manipulate d20 rolls). Useful as a stepping stone between mortal play and full mythic, but not a replacement for mythic progression.

**D&D 5E: Mythic Odysseys of Theros (2020, WotC)**
Official 5E supplement with two directly relevant systems: Supernatural Gifts (character enhancements from divine sources) and Piety (devotion score that unlocks deity-specific abilities at thresholds of 3, 10, 25, and 50). Piety is the closest thing 5E has to Pathfinder's mythic system and could be implemented immediately for Riv's relationship with Lathander.

**D&D 5E: Theros Mythic Monsters**
Official mechanic where boss creatures have a Mythic Trait — essentially a second health bar that triggers when reduced to 0 HP, restoring all HP and unlocking Mythic Actions (enhanced legendary actions). Directly applicable to The Master's final confrontation design.

**Critical Role: Vestiges of Divergence / Explorer's Guide to Wildemount**
Magic items with three states — Dormant, Awakened, Exalted — that grow in power through narrative milestones. This is Pathfinder's Legendary Items adapted for 5E. Directly applicable to campaign weapons.

### Secondary Sources

- **D&D 3.5 Epic Level Handbook:** Class levels past 20 (21, 22, etc.) with epic spells and feats. Wildly unbalanced (caster/martial divide worsens). Avoid this model.
- **Exalted RPG:** Divine ascension concepts, the idea of mortals becoming quasi-deities through deed rather than worship. Influences our Apotheosis tier and dark mirror paths.
- **2C Gaming: Epic Legacy:** Third-party 5E supplement extending to Level 30 with full class progressions. Comprehensive but crunch-heavy. Reference for specific ability ideas.
- **MCDM Strongholds & Followers / Kingdoms & Warfare:** Already in use. Organizational-scale mechanics that scale into mythic tier (armies, strongholds, domain management).

---

## 2. THE TIER FRAMEWORK (UNIVERSAL)

Condensed from Pathfinder's 10 tiers to 5 meaningful breakpoints that respect 5E's bounded accuracy philosophy.

### Tier 1 — Touched by Legend
- **Narrative:** First mythic awakening. The character does something that transcends mortal limits — a moment everyone present recognizes as supernatural.
- **Power Level:** Enhanced mortal. Noticeably beyond Level 20 peers but still grounded.
- **World Impact:** Regional. People in the area know your name.
- **Unlocked by:** A single extraordinary trial — a moment of ascension.

### Tier 2 — Hero of Renown
- **Narrative:** The character's legend spreads. Bards sing about them. Enemies plan around them specifically.
- **Power Level:** Significant supernatural ability. Can do things that normal magic cannot explain.
- **World Impact:** Multi-regional. Political powers seek alliance or fear confrontation.
- **Unlocked by:** Two trials demonstrating mastery of mythic power.

### Tier 3 — Champion
- **Narrative:** National or continental recognition. The character shapes events through presence alone. Their arrival changes the calculus of wars.
- **Power Level:** Demigod-adjacent. Mundane threats are irrelevant. Only mythic or legendary foes pose genuine danger.
- **World Impact:** Nations. Gods take notice. Celestial and fiendish entities treat you as a peer.
- **Unlocked by:** Three trials, at least one involving confrontation with another mythic being.

### Tier 4 — Legend
- **Narrative:** Continental influence. Stories about the character will be told for centuries. They challenge or rival demigods.
- **Power Level:** World-shaping. Individual actions can alter the course of history.
- **World Impact:** Planar. Entities across multiple planes are aware of and respond to the character's existence.
- **Unlocked by:** Four trials, including at least one planar-scale event.

### Tier 5 — Apotheosis
- **Narrative:** The character faces a choice about transcendence — godhood, eternal mortality, sacrificial transcendence, or something else entirely. This is the culmination of a mythic arc.
- **Power Level:** Quasi-divine. The character can grant power to followers, reshape local reality, and challenge gods.
- **World Impact:** Cosmic. The character's choice at this tier has permanent consequences for the world.
- **Unlocked by:** A single definitive trial — the character's ultimate test, unique to their path and story.

### Trial Design Principles
- Trials are narrative, not mechanical. The DM determines what qualifies.
- Players may not know they're in a trial until it's complete.
- Trials should test the character's core identity and mythic path's themes.
- Failed trials don't prevent advancement — they redirect it (a failed trial of mercy might push toward a darker path).
- The number of trials required increases per tier (1, 2, 3, 4, 1-definitive).

---

## 3. BASE MYTHIC ABILITIES (UNIVERSAL CHASSIS)

Every mythic character, regardless of path, gains these abilities as they tier up. Adapted from Pathfinder Mythic Adventures for 5E.

### Tier 1 (All Mythic Characters Gain):

**Mythic Power (Resource Pool)**
- Uses per day: 3 + (2 × tier). So 5/day at Tier 1, 7 at Tier 2, 9 at Tier 3, 11 at Tier 4, 13 at Tier 5.
- Refreshes on long rest. Some abilities allow partial recovery.
- Fuels Surge and most mythic abilities.

**Surge**
- Spend 1 Mythic Power after seeing the result of any d20 roll to add a bonus die.
- Tier 1-2: +1d6
- Tier 3: +1d8
- Tier 4: +1d10
- Tier 5: +1d12
- Can be used on attack rolls, saving throws, ability checks.

**Hard to Kill**
- Auto-stabilize when reduced to 0 HP (no death saves needed for stabilization).
- Don't die until negative HP equals 2× Constitution score.

**Mythic Presence**
- Creatures with CR lower than your character level sense something extraordinary about you. Not fear exactly — awe, unease, recognition that you're different.

### Tier 2 (Added):

**Amazing Initiative**
- Add mythic tier to initiative rolls.

**Recuperation**
- 8-hour long rest fully restores all HP.
- 1-hour short rest restores all abilities that normally require a long rest (spell slots, class features, etc.) — but only once between long rests.

### Tier 3 (Added):

**Mythic Saving Throws**
- Spend 1 Mythic Power to reroll a failed saving throw. Must take the new result.
- Can decide after seeing the failure but before consequences are narrated.

**Force of Will**
- Spend 1 Mythic Power when targeted by a mind-affecting effect to either: reroll the save (take better result) OR roll twice preemptively and take the better result.

**Mundane Immunity**
- Immune to non-magical disease, poison, and exhaustion from mundane sources (forced march, no sleep, extreme weather). Mythic exhaustion (from overusing Mythic Power or fighting Tier 3+ opponents) still applies.

### Tier 4 (Added):

**Unstoppable**
- Spend 1 Mythic Power as a free action to immediately end one condition: blinded, charmed, deafened, frightened, paralyzed, poisoned, stunned. Usable even if the condition would prevent action.

**Mythic Resistance**
- Gain resistance to all non-mythic damage. Attacks from non-mythic sources deal half damage. (Mythic sources = other mythic creatures, artifacts, divine intervention.)

### Tier 5 (Added):

**Immortal**
- If killed, return to life after 7 days regardless of condition of body or means of death.
- Does not apply if killed by: a mythic creature's critical hit, an artifact weapon, or divine decree.

**Legendary Hero**
- Regain 1 Mythic Power per hour (in addition to full refresh on long rest).
- Only artifact-level critical hits or mythic coup de grace can permanently kill you.

---

## 4. MYTHIC PATHS (PLAYER-FACING OPTIONS)

These are the paths available to player characters. Characters are NOT pre-assigned — they choose (or discover) their path through gameplay when mythic progression begins. Multiple characters can share a path. Some paths are more suited to certain classes, but none are restricted.

### Path Design Note
Only the Hierophant path has full tier-by-tier mechanical detail from previous design work. All other paths need equivalent development before implementation. Each path should have 3 abilities per tier (15 total), plus a defining feature that evolves.

---

### HIEROPHANT
*Divine champion. Channel of a deity's will and power.*

**Inspired by:** PF Hierophant + WotR Angel path
**Best suited for:** Clerics, Paladins, Druids, divine-focused characters
**Core theme:** Faith made manifest. The divine working through mortal hands.
**Defining feature:** Evolving divine aura that grows in radius and power per tier.

**Tier 1 — Awakened Faith:**
- Divine Surge: 3/day, add 1d6 radiant (or deity-appropriate damage type) to any attack, spell, check, or save.
- Radiant Presence: Allies within 30 ft gain advantage on saves vs. fear and charm effects.
- Dawn's Blessing: Long rest restores additional hit dice equal to WIS modifier.

**Tier 2 — Chosen:**
- Deity's Hand: 1/day, cast any spell on your class list without expending a slot, cast at maximum level you can access.
- Beacon of Hope: 60 ft aura. Dying allies auto-stabilize. All healing within aura increased by 50%.
- Smite Darkness: Your radiant damage ignores resistance and treats immunity as resistance.

**Tier 3 — Avatar:**
- Divine Transformation: 10 minutes, 1/long rest. Fly 60 ft, immunity to radiant and necrotic damage, all attacks deal additional 3d8 radiant, appearance transforms to reflect deity.
- Mass Restoration: Touch. Cast Greater Restoration on up to 6 targets simultaneously.
- Improved Divine Intervention: Automatically succeed on Divine Intervention. Usable 1/week instead of 1/long rest.

**Tier 4 — Exarch:**
- Sacred Ground: Create a permanent holy site (100 ft radius). Undead cannot enter. Evil creatures have disadvantage on all rolls. Good creatures heal 1d6 per round. Requires 24-hour consecration ritual.
- Resurrection Mastery: Cast True Resurrection at will. No material components required.
- Solar Judgment: 60 ft radius column of divine energy. 10d10 radiant damage. WIS save DC 20 for half. Undead and fiends: no save, full damage.

**Tier 5 — Herald (Apotheosis):**
- Deity's Herald: Quasi-deity status. Can grant limited divine power to sworn followers (create Paladins/Clerics sworn to you). Worshippers can pray to you for minor miracles.
- Eternal Sunrise: Immortality. Do not age. Auto-resurrect 7 days after death. Only preventable by destroying your holy symbol with an artifact weapon.
- Reshape Dawn: Once per year, rewrite a single event within the last 24 hours (limited time manipulation). The universe remembers both versions.

---

### ANGEL
*Celestial warrior. Embodiment of divine justice, mercy, and holy war.*

**Inspired by:** WotR Angel path (the game's most popular and mechanically strongest path)
**Best suited for:** Paladins, Clerics, martial divine characters
**Core theme:** Righteous warfare. Not just faith but active intervention against evil. The sword of heaven.
**Defining feature:** Evolving wings and merged divine spellcasting.
**Key distinction from Hierophant:** Hierophant channels divine power through prayer, ritual, and aura. Angel IS divine power — a mortal becoming celestial. More martial, more interventionist, less contemplative.

**Tier 1 — Sword of Heaven:**
- Angelic Weapon: Weapon permanently gains +1d6 radiant damage. Bypasses all resistance.
- Shield of Faith Aura: Allies within 15 ft gain +1 AC. Does not require concentration.
- Celestial Sight: See invisible creatures, see through magical darkness, detect evil by sight (as Detect Evil and Good, constant).

**Tier 2 — Seraph:**
- Wings of Light: Fly speed 60 ft (manifested radiant wings). Can be dismissed/summoned as bonus action.
- Merged Spellcasting: Gain access to a supplementary divine spellbook. Spells from this list can be cast using existing spell slots but at +5 caster level. (List to be developed — healing, protection, holy smite spells.)
- Angelic Immunity: Immune to disease, poison, and fear. Advantage on saves vs. charm and compulsion.

**Tier 3 — Solar:**
- Sunblade: 1/long rest, summon a blade of pure radiant energy (acts as Holy Avenger, 6d8 radiant damage, 30 ft anti-magic aura vs. evil).
- Mass Heal: Cast Heal targeting up to 10 creatures within 60 ft, 1/long rest.
- Angelic Transformation: Permanent physical changes — radiant eyes, faint glow, celestial beauty. Intimidation and Persuasion checks with evil and good creatures respectively gain advantage.

**Tier 4 — Archangel:**
- Storm of Justice: 1/day, call down a divine storm. 120 ft radius, 8d10 radiant + 8d10 thunder. Evil creatures make WIS save or are banished to their home plane for 1 minute.
- Angelic Army: Summon a unit of celestial warriors (use Mass Combat rules — effectively an elite angelic squad that fights for 1 hour). 1/week.
- Merged Soul: Your spellcasting reaches beyond mortal limits. Access to 10th-level divine spells (to be designed — world-shaping holy magic).

**Tier 5 — Ascendant (Apotheosis):**
- True Angel: Permanent transformation into a celestial being. Retain mortal memories, personality, and free will, but fundamentally change nature. All abilities enhanced to maximum. Can freely move between Material Plane and celestial realms.
- Judgment of the Heavens: 1/year, pronounce divine judgment on a single creature or location. If the target is evil, the judgment is absolute — no save, no resistance, no escape. The universe enforces it.
- Eternal Vigil: Cannot die by any means short of direct divine intervention from a greater deity. Stand at the threshold between mortal and divine realms permanently.

---

### AEON
*Cosmic arbiter. Judge of balance, enforcer of natural law.*

**Inspired by:** WotR Aeon path
**Best suited for:** Monks, Paladins (Devotion/Crown), Wizards (Divination), Clerics (Order/Knowledge)
**Core theme:** Balance above all. Not good or evil — cosmic order. The universe has laws, and you enforce them. Time, fate, and causality are your tools.
**Defining feature:** Gaze abilities — supernatural perception that can nullify, judge, and enforce.
**Alignment consideration:** Lawful strongly preferred. Any shift toward chaos weakens abilities.

**Tier 1 — Judge's Eye:**
- Aeon's Gaze: As an action, target one creature within 60 ft. You perceive their true nature: alignment, magical effects, curses, compulsions, and whether they are acting under their own free will. 3/day.
- Enforcing Presence: Creatures within 30 ft cannot benefit from illusion magic or shapechanging. Their true form is visible.
- Temporal Awareness: Cannot be surprised. Advantage on initiative. Sense disturbances in causality (DM alerts you to timeline anomalies or fate-manipulation).

**Tier 2 — Arbiter:**
- Nullifying Gaze: As an action, target one creature within 60 ft. Dispel one magical effect on them (as Dispel Magic at 9th level, no check required). 3/day.
- Law of Conservation: When you or an ally within 30 ft takes damage, you can redistribute that damage among willing creatures within range (including yourself). Reaction, uses Mythic Power.
- Rewind: 1/day, revert one creature (including yourself) to the state they were in 6 seconds ago. Undoes damage, conditions, and movement. Does not undo death.

**Tier 3 — Inquisitor:**
- Paralyzing Gaze: Creatures that meet your gaze and fail a WIS save are paralyzed for 1 round. Free action, at will against non-mythic creatures. Mythic creatures: 1/encounter per target.
- Temporal Manipulation: 1/long rest, stop time for yourself for 3 rounds (as Time Stop but improved — you can affect other creatures with non-damaging actions).
- Zone of Truth (Absolute): Create a 60 ft zone where lying is impossible. Not magical — cosmic. Cannot be resisted, dispelled, or circumvented. Lasts 10 minutes. 1/day.

**Tier 4 — Kosmocrator:**
- Edict: Pronounce a cosmic law that affects a 1-mile radius for 24 hours. Examples: "No teleportation," "No creature may change shape," "The dead stay dead," "No spell above 5th level functions." 1/day. Mythic creatures can resist with Mythic Power expenditure.
- Rewrite: 1/week, undo a single event from the past 7 days. The timeline adjusts. Witnesses have fragmented memories of both versions. Overuse attracts cosmic attention.
- Perfect Judge: Automatically know if any statement you hear is true, false, or partially true. Constant.

**Tier 5 — Living Law (Apotheosis):**
- Cosmic Arbiter: You become an embodiment of natural law. Can pronounce binding judgment on any being, including deities, regarding violations of cosmic order. Other Aeons recognize and defer to you.
- Temporal Sovereignty: Control the flow of time within your perception. Age, reverse, pause, or accelerate time for individual objects or creatures. Limited by: cannot create paradoxes, cannot affect other Tier 5 beings without consent, cannot undo your own Apotheosis.
- Immortal Balance: You exist outside normal mortality. Cannot age, cannot be permanently killed by anything less than the combined will of multiple deities.

---

### AZATA
*Champion of freedom, joy, and chaotic good. Intuition and inspiration over law and calculation.*

**Inspired by:** WotR Azata path (fan-favorite for story; features companion dragon Aivu)
**Best suited for:** Bards, Rangers, Sorcerers, Warlocks (Archfey), free-spirited characters
**Core theme:** Freedom, creativity, spontaneity, friendship. Power through joy rather than discipline. The opposite of Aeon — chaos in service of good.
**Defining feature:** Supernatural companion (fey spirit) + reality-bending inspiration effects.
**Companion mechanic:** At Tier 1, gain a fey companion spirit. Not a stat block — a narrative presence that grows with you. At Tier 3, it can manifest physically. At Tier 5, it becomes a permanent fey entity bonded to your soul.

**Tier 1 — Free Spirit:**
- Azata's Song: 3/day, perform a supernatural song/artistic expression. All allies within 60 ft gain temporary HP equal to your level + CHA modifier and advantage on their next ability check or save. Stacks with Bardic Inspiration.
- Fey Companion: Gain a fey spirit companion (personality, opinions, banter). It can scout ethereally, deliver messages, and provide advantage on Insight/Perception checks 3/day.
- Elysian Freedom: You and allies within 30 ft are immune to the Restrained condition and gain advantage on saves vs. paralysis, petrification, and any effect that restricts movement.

**Tier 2 — Muse:**
- Zippy Magic: When you cast a spell that targets a single creature, you can spend 1 Mythic Power to have it simultaneously target a second creature within 30 ft of the first.
- Incredible Inspiration: Your Azata's Song now also ends one condition on each affected ally (charmed, frightened, poisoned, or stunned).
- Fey Step: Teleport up to 60 ft as a bonus action. When you do, flowers bloom, butterflies appear, or some other manifestation of chaotic beauty occurs at your departure and arrival points.

**Tier 3 — Brijidine:**
- Manifest Companion: Your fey companion can now physically manifest. It uses the stat block of a Young Dragon (type: Fey) that scales with your mythic tier. It has its own personality and may disagree with you.
- Songs of Steel: 1/long rest, your supernatural song becomes a weapon. All enemies within 120 ft must make a CHA save or take 8d8 psychic damage and be charmed for 1 minute. Mythic creatures take half on success and aren't charmed.
- Believe in Yourself: 1/day, grant one creature the ability to automatically succeed on their next ability check, attack roll, or saving throw. You must genuinely believe in them (DM discretion on sincerity).

**Tier 4 — Star Speaker:**
- Favorable Magic: Whenever you cast a spell that requires an enemy to make a saving throw, treat any natural 1 rolled on the save as if the creature rolled a natural 20 on the save... wait, that's backwards. Whenever an enemy rolls a natural 1 on a save against your spells, the spell's effects are doubled in duration and the creature has disadvantage on subsequent saves against it.
- Azata Superpower: Gain one reality-bending ability unique to your character (to be determined through play — examples: flight at the speed of thought, creating matter from song, bringing stories to life as illusions with substance).
- Chaotic Cascade: When you score a critical hit or force a critical failure on a save, choose one additional effect: the target is polymorphed into a harmless creature for 1 round, teleported 100 ft in a random direction, or forgets the last 6 seconds.

**Tier 5 — Azata Lord (Apotheosis):**
- Eternal Freedom: You become an embodiment of freedom. No force in the multiverse can permanently restrain, imprison, compel, or control you. Any attempt automatically fails.
- Create Domain: Create a permanent demiplane reflecting your personality and values. This is your realm, answerable to no deity. Fey and free spirits are drawn to it.
- Companion Ascension: Your fey companion becomes a fully realized entity — a unique fey lord/lady in their own right. They are a permanent ally with independent power, capable of mythic-tier actions.

---

### GOLD DRAGON
*Benevolent power incarnate. Mercy, strength, and wisdom of the greatest creatures.*

**Inspired by:** WotR Gold Dragon path
**Best suited for:** Characters who've demonstrated consistent mercy, wisdom, and physical courage
**Core theme:** Becoming the most powerful benevolent creature in existence. Not divine — primal. Dragon power is older than gods.
**Defining feature:** Physical transformation into a dragon, culminating in full polymorphic dragon form.
**Late path:** In WotR, this was available from Tier 8 (late game). Here, it requires a specific narrative trigger — encounter with or legacy of a true dragon.

**Tier 1 — Dragon's Blood:**
- Draconic Resilience: +2 to all ability scores (these stack with normal maximums, raising cap to 22).
- Breath Weapon: Gain a breath weapon — 60 ft cone, 6d10 fire damage, DC = 8 + proficiency + CON modifier. Recharges on short rest.
- Dragon Sight: Blindsight 30 ft, Darkvision 120 ft. Immune to the Frightened condition.

**Tier 2 — Half-Dragon:**
- Scales: Natural AC of 18 + DEX modifier (if better than current). Resistance to fire damage.
- Wing Buffet: As a bonus action, beat wings. All creatures within 10 ft make STR save or are knocked prone and pushed 10 ft. Requires no flight.
- Dragon's Wisdom: Advantage on all WIS and INT saving throws. Proficiency in Insight if not already proficient.

**Tier 3 — Drake:**
- Dragon Form: 1/long rest, transform into an Adult Gold Dragon for 1 hour. Retain mental ability scores, class features, and personality. Gain all physical stats, fly speed, and dragon abilities.
- Merciful Flame: Your breath weapon can be set to non-lethal — targets reduced to 0 HP are stable, not dead. Or it can be set to terrifying — targets who take damage must make WIS save or be frightened for 1 minute.
- Draconic Authority: Dragons of any type recognize you as kin. Evil dragons won't attack without provocation. Good dragons treat you as an honored ally.

**Tier 4 — Ancient:**
- Permanent Wings: Fly speed 80 ft, always available. Wings can be hidden as a bonus action.
- Frightful Presence: Creatures of your choice within 120 ft must make WIS save or be frightened for 1 minute. At will against non-mythic creatures.
- Dragon Form (Improved): Transform into an Ancient Gold Dragon. Duration extended to 8 hours. Can be used 3/day.

**Tier 5 — Great Wyrm (Apotheosis):**
- True Dragon: Permanent transformation option. You can freely shift between humanoid and Great Wyrm Gold Dragon form at will. In dragon form, you are among the most powerful non-divine creatures in existence.
- Dragon Mercy: 1/day, breathe a cone of golden fire that heals allies and harms enemies simultaneously. Allies: fully restored. Enemies: 20d10 radiant damage, no save for evil creatures.
- Timeless: Dragons are ageless. You become functionally immortal. Can only be permanently killed by another Great Wyrm, a deity, or an artifact specifically designed to slay dragons.

---

### LICH
*Undying pursuit of knowledge and power through mastery over death itself.*

**Inspired by:** WotR Lich path
**Best suited for:** Wizards, Sorcerers, Warlocks, Clerics (Death/Grave), any intelligence-focused character willing to pay the price
**Core theme:** Transcendence through forbidden knowledge. Death is a limitation to be overcome, not a natural end. Power demands sacrifice.
**Defining feature:** Phylactery — your soul is stored in an external vessel. You can be destroyed but not permanently killed as long as it exists.
**CRITICAL ALIGNMENT RESTRICTION:** This path requires evil actions. Creating a phylactery requires a willing sacrifice and dark ritual. Even a well-intentioned character walking this path is committing acts of evil — that's the point. Shadow Points will accumulate.

**Tier 1 — Death Touched:**
- Negative Energy Affinity: Necrotic damage heals you. Healing spells damage you (or you can choose to be unaffected by them). Undead are not inherently hostile.
- Undead Fortitude: When reduced to 0 HP, make a CON save (DC 5 + damage taken). On success, drop to 1 HP instead. Works once between long rests.
- Forbidden Knowledge: Gain proficiency in Arcana if not already. Gain access to Necromancy spells from any class list.

**Tier 2 — Death Knight:**
- Phylactery: Create your soul vessel through dark ritual (DM determines cost — always steep). As long as it exists, you regenerate from any death in 1d10 days near the phylactery.
- Command Undead: At will, as an action, take control of up to your level in CR worth of undead creatures. No save for mindless undead. Intelligent undead get WIS save.
- Life Drain: Melee attack (bonus action) deals 4d8 necrotic damage and heals you for the amount dealt. 3/day.

**Tier 3 — Archlich:**
- Undead Army: Raise and permanently control a force of undead (up to 100 HD worth). They persist until destroyed. New undead can be added up to the cap.
- Death Gaze: Creatures that meet your gaze and fail a CON save drop to 0 HP. Non-mythic creatures only. 1/day.
- Mastery of Death: You no longer need to eat, drink, sleep, or breathe. Immune to poison, disease, exhaustion, and the Frightened condition.

**Tier 4 — Demilich:**
- Soul Trap: When a creature dies within 60 ft, you can capture its soul (WIS save for willing creatures, forced for unwilling). Trapped souls fuel your power — each soul stored grants +1 to spell save DC, up to your mythic tier.
- Incorporeal Form: 3/day, become incorporeal for 1 minute. Pass through solid objects, resistance to all non-force non-radiant damage, immune to grapple and restraint.
- Eldritch Mastery: Cast any Wizard spell of 5th level or lower at will, without spell slots or components.

**Tier 5 — Eternal (Apotheosis):**
- Perfect Undeath: Your transformation is complete. You are no longer a mortal who cheated death — you are Death's equal. Immune to all effects that would destroy undead (Turn Undead, Sunlight Sensitivity, etc.).
- Mastery of Souls: You can commune with, question, release, or permanently destroy any soul in your possession. You can offer others immortality through undeath (creating lesser liches under your authority).
- The Final Equation: You understand the fundamental nature of death itself. 1/year, you can either permanently resurrect someone (true reversal of death, not a copy) or permanently kill something (no resurrection possible by any means). This power terrifies even gods.

---

### DEMON
*Raw power through rage, transformation, and embracing primal chaos.*

**Inspired by:** WotR Demon path
**Best suited for:** Barbarians, Fighters, Warlocks (Fiend), any character with deep anger or trauma
**Core theme:** Channeling rage into power. Not mindless — directed fury. The Demon path isn't about being evil; it's about what happens when you stop holding back. Characters can walk this path with good intentions (redirecting demonic power against evil) but must resist corruption.
**Defining feature:** Demonic Rage (enhanced rage states) + physical transformation (horns, claws, wings).
**Shadow interaction:** This path generates Shadow Points faster than any other. Maintaining control requires constant vigilance.

**Tier 1 — Wrathful:**
- Demonic Rage: Enter an enhanced rage state (bonus action, 3/day). +2 to damage rolls (stacks with Barbarian rage), resistance to one additional damage type (fire or poison), and your attacks count as magical.
- Demonic Aspect: Choose one permanent minor transformation: horns (+1d6 damage on charge attacks), claws (unarmed strikes deal 1d8 slashing), or tail (bonus action tail swipe, STR save or prone within 10 ft).
- Abyssal Resilience: Advantage on saves vs. charm and fear. Resistant to fire damage.

**Tier 2 — Fiend:**
- Greater Rage: Demonic Rage improves. +4 damage, resistance to fire AND poison, and frightful presence (30 ft, WIS save or frightened).
- Demonic Form: 1/long rest, transform for 10 minutes. Gain fly speed 60 ft (bat wings), natural armor AC 18, and all unarmed attacks deal 2d8 + STR.
- Abyssal Knowledge: You instinctively understand demonic tactics, weaknesses, and hierarchy. Advantage on all checks related to fiends and the Abyss.

**Tier 3 — Balor-Blooded:**
- Aura of Destruction: While raging, all enemies within 15 ft take 2d6 fire damage at the start of your turn.
- Demonic Aspect (Greater): Your transformation becomes more dramatic. Choose two additional aspects. Horns, claws, tail, wings, extra arms (bonus action grapple), or armored hide (+2 AC natural armor).
- Resist the Abyss: You've learned to channel demonic power without losing yourself. Reduce Shadow Points gained from Demon path abilities by 1 (minimum 0). This doesn't apply to actual evil actions.

**Tier 4 — Demon Lord:**
- Ultimate Rage: Demonic Rage becomes at will (no daily limit). While raging: +6 damage, immunity to fire, and your attacks deal an additional 3d6 fire damage.
- Mass Terror: 1/day, unleash an aura of supernatural terror. 120 ft radius. All non-mythic enemies must make WIS save or flee for 1 minute, dropping whatever they're holding. Mythic creatures: disadvantage on attack rolls for 1 round on failed save.
- Abyssal Gate: 1/week, open a portal to the Abyss. You control what comes through (within reason — you can't summon demon lords without their consent, but lesser demons obey). Portal lasts 1 hour.

**Tier 5 — Demon God (Apotheosis):**
- Transcendent Rage: Your rage becomes cosmic. When you rage, reality distorts — the ground cracks, flames erupt, lesser creatures within 300 ft feel primal fear. All your physical ability scores become 30 while raging.
- Shape the Abyss: You gain dominion over a layer of the Abyss (or create one). Demons in your layer obey you absolutely. You can reshape it to your will.
- The Choice: At Tier 5, the Demon path forces a final decision: Embrace fully (become a true demon lord, lose mortal nature, gain absolute power in the Abyss) or Master the flame (retain mortality, keep all abilities, but permanently cap at Tier 5 with no further growth — you chose to be human with a demon's power, not a demon with human memories).

---

### DEVIL
*Power through contracts, hierarchy, and infernal authority.*

**Inspired by:** WotR Devil path (late-game path requiring prior path commitment)
**Best suited for:** Characters with high Charisma, diplomatic/manipulative playstyle, those comfortable with moral compromise
**Core theme:** Order in service of self-interest. Devils aren't chaotic — they're the ultimate bureaucrats. Power comes from binding agreements, hierarchical authority, and the letter of the law.
**Defining feature:** Hell's Decree — binding pronouncements that have supernatural force.
**Late path requirement:** Must have started on another path (Aeon or Azata in WotR). In our system, requires prior commitment to either a Lawful or Chaotic path, then switching — representing a deliberate choice to embrace infernal power.

**Tier 1 — Infernal Agent:**
- Silver Tongue: Advantage on all Deception and Persuasion checks. When you make a deal or agreement, both parties are magically bound to the letter of the agreement (not the spirit — loopholes are fair game).
- Hellfire: Your fire damage becomes hellfire — half fire, half necrotic. Ignores fire resistance.
- Infernal Resilience: Resistance to fire and poison. Immune to the Charmed condition.

**Tier 2 — Advocate:**
- Hell's Decree: Issue supernatural commands. 3/day, target one creature that can hear you. They must make a WIS save or follow a single-sentence command for 1 minute. Commands cannot directly cause self-harm but can be creatively binding ("You will not speak until I give you permission").
- Contract Magic: You can create magically binding contracts. Creatures that sign willing agree to terms — violation causes automatic damage (6d10 psychic, no save) and brands them as an oathbreaker visible to all fiends.
- Infernal Hierarchy: Devils of lower rank recognize your authority and will not attack without orders from a superior. You can negotiate with any devil as a peer.

**Tier 3 — Archdevil's Chosen:**
- Greater Decree: Your decrees become more powerful. Targets: up to 6 creatures. Duration: 1 hour. You can command complex behaviors ("Fight beside me until this battle ends" or "Guard this location and allow no one to pass").
- Infernal Transformation: Gain permanent changes — your eyes burn with hellfire, your shadow moves independently. Gain darkvision 120 ft, immunity to fire, and a fly speed of 60 ft (batwings, retractable).
- Soul Bargain: You can offer creatures power in exchange for service. Grant a willing creature the equivalent of one feat, one ability score increase, or one 3rd-level spell (1/day). In exchange, you gain absolute knowledge of their location and one command they cannot refuse per month.

**Tier 4 — Duke of Hell:**
- Absolute Authority: 1/day, issue a decree that affects an area (1-mile radius). All creatures within the area must obey a single rule for 24 hours. ("No creature may raise a weapon in violence." "All doors remain open." "The dead do not rise.") Mythic creatures can resist by spending Mythic Power.
- Infernal Court: Summon a court of devils to serve you (use Mass Combat rules — a company of barbed/chain devils) for 1 hour. 1/week.
- Unbreakable Contract: Any contract you create is enforced by the Laws of Hell themselves. Violation is not just punished — it is impossible. The universe prevents it. (Exception: a Tier 5 being or deity can breach by accepting proportional consequences.)

**Tier 5 — Archdevil (Apotheosis):**
- Lord of the Nine: You are offered (or seize) dominion over a portion of the Nine Hells. Your word is literal law within your domain.
- Ultimate Contract: 1/year, you can bind even a deity to a contract — if they consent. Gods are not required to accept, but the terms you offer can be supernaturally persuasive.
- Immortal Authority: You cannot be permanently killed within your domain. Outside it, you reform in your domain within 1d10 days. Only destruction of your domain itself (a feat requiring multiple deities acting in concert) can end you.

---

### TRICKSTER
*Master of deception, luck manipulation, and reality-bending mischief.*

**Inspired by:** PF Trickster + WotR Trickster path
**Best suited for:** Rogues, Bards, Rangers, any character who relies on skill, cunning, and lateral thinking
**Core theme:** The universe has rules, and you've found the cheat codes. Not divine power, not raw strength — just being really, really good at breaking what shouldn't be breakable.
**Defining feature:** Trickster Feats — unique upgrades to mundane skills that push them into supernatural territory.

**Tier 1 — Lucky:**
- Supernatural Luck: 3/day, after any creature within 60 ft (including you) makes a d20 roll, change the result by up to 3 in either direction. This happens after the roll but before the DM announces the result.
- Trickster's Reflexes: You can take two reactions per round instead of one.
- Impossible Skill: Choose one skill. You can now achieve results that are physically impossible with that skill. (Stealth: hide in plain sight from creatures looking directly at you. Athletics: catch arrows barehanded. Persuasion: convince someone of something they just watched not happen.)

**Tier 2 — Con Artist:**
- Greater Luck: Supernatural Luck uses increase to 5/day and adjustment increases to ±5.
- Trickster Feat: Choose a second skill to become Impossible.
- Perfect Disguise: Your disguises are supernatural. You can mimic any creature you've observed for at least 1 minute, including voice, mannerisms, and even magical aura. Only True Seeing from a mythic source can penetrate.

**Tier 3 — Master Thief:**
- Steal Anything: You can steal abstract concepts. 1/day, touch a creature and steal one of: a spell slot (you can use it within 1 hour), a class feature (you have it for 1 hour, they don't), a memory (they forget it, you know it), or a physical attribute (steal 4 points from one ability score, add them to yours, for 1 hour).
- Two Places at Once: 1/long rest, create a perfect duplicate of yourself that lasts 1 hour. It can act independently, has all your stats, and shares your Mythic Power pool. If either "you" is killed, the other is the real one. You choose which afterward.
- Trickster Feat: Choose a third Impossible Skill.

**Tier 4 — Legend-Thief:**
- Rewrite Fate: 3/day, after any d20 roll within 120 ft, change the result to any number you choose (1-20). This is not luck — you are literally editing what happened.
- Steal Mythic Power: When you successfully steal from a mythic creature (Steal Anything ability), you can instead steal 1d4 Mythic Power uses. They lose those uses; you gain them.
- Master of All Trades: All skills are Impossible Skills for you.

**Tier 5 — Cosmic Joker (Apotheosis):**
- Narrative Authority: 1/day, declare that something is true, and it becomes true. Limitations: it must be theoretically possible (no "the sun is now made of cheese"), it can be resisted by Tier 5 beings, and the universe will impose ironic consequences for excessive use.
- Immune to Fate: You cannot be scryed, predicted, fated, prophesied about, or included in any divine plan without your consent. You are a blind spot in reality.
- The Last Laugh: You cannot be permanently killed by any means. If killed, you reappear somewhere unexpected within 1d4 days. No force in the multiverse can prevent this. You just... show back up. Usually at the worst possible moment for your enemies.

---

### LEGEND
*Rejection of mythic power for perfected mortal excellence.*

**Inspired by:** WotR Legend path + PF Mythic Adventures "mortal excellence" concept
**Best suited for:** Any character who philosophically rejects supernatural ascension. Particularly compelling for divine casters who choose not to transcend.
**Core theme:** "I don't need to become something more than human. Human is enough." Power through sheer will, training, and refusal to take shortcuts.
**Defining feature:** Instead of mythic abilities, gain additional character levels (up to Level 40 in WotR). In our system, gain additional class levels, feats, and ability score increases beyond normal limits.
**CRITICAL DESIGN NOTE:** This path is fundamentally different. You give up mythic abilities in exchange for mortal power pushed to absolute limits. You're the Batman in a room full of Supermen.

**Mechanical Framework:**
- At Tier 1: Gain 4 additional class levels (to Level 24). Ability score maximums increase to 24.
- At Tier 2: Gain 4 more (to Level 28). Ability score maximums increase to 26.
- At Tier 3: Gain 4 more (to Level 32). Ability score maximums increase to 28.
- At Tier 4: Gain 4 more (to Level 36). Ability score maximums increase to 30.
- At Tier 5: Gain 4 more (to Level 40). No ability score maximum.

**What you keep:** Hard to Kill and Mythic Power (at reduced rate: 1 + tier per day). You can Surge.
**What you lose:** All path-specific abilities. No transformation. No divine power. No supernatural tricks.
**What you gain:** Unmatched versatility, more spell slots than any mythic caster, more attacks than any mythic warrior, and the satisfaction of knowing you did it all without help.

**Narrative weight:** In a world where your allies are becoming demigods, you choose to remain human. Every victory you achieve is proportionally more impressive. NPCs should react to this — a Legend who fights alongside an Angel and keeps up is more inspiring than the Angel.

---

### REDEMPTION
*Custom path — not from any source material. Mythic through atonement, institutional building, and breaking the chains of corruption.*

**Best suited for:** Characters who've committed terrible acts and choose the harder path of atonement. Silas, Thane, or any character with significant Shadow Points who earns their way back.
**Core theme:** The deepest power comes from understanding darkness and choosing light anyway. Not the absence of evil — the active rejection of it after intimate knowledge.
**Defining feature:** Evolving ability to sense, understand, and break compulsion, corruption, and dark influence.

**Tier 1 — Penitent:**
- Sense Corruption: Detect the presence and nature of compulsion, charm, corruption, or dark influence on any creature within 60 ft. Constant.
- Atonement's Shield: Your Shadow Point count is displayed to divine entities as proof of your journey. Good-aligned beings automatically recognize your sincere intent. You gain advantage on Persuasion checks with anyone who knows your history.
- Shared Burden: 3/day, touch a creature suffering from a curse, charm, or compulsion. You experience their suffering (take 2d8 psychic damage, no resistance) but gain complete understanding of the effect — its source, its nature, and how to break it.

**Tier 2 — Redeemer:**
- Break Compulsion: 1/day, touch a creature under magical compulsion, charm, or mind control. The effect ends (no check required, works on any spell level). If the compulsion is mythic in origin, requires a Mythic Power expenditure.
- Sanctuary of Second Chances: Create a 30 ft radius zone where: hostile emotions are suppressed (not eliminated), truth-telling is encouraged (advantage on Insight, disadvantage on Deception), and weapons cannot be drawn in anger (WIS save to override). Lasts 1 hour. 1/day.
- Understand the Fallen: When you use Sense Corruption, you also understand why the creature fell — their pain, their vulnerability, their moment of weakness. This grants advantage on any attempt to reach them, persuade them, or help them choose differently.

**Tier 3 — Absolver:**
- Mass Break Compulsion: As Break Compulsion, but affects all creatures within 30 ft simultaneously. 1/long rest.
- Living Proof: Your mere presence weakens dark influence. All charm, compulsion, and corruption effects within 60 ft have their save DCs reduced by your mythic tier. Creatures under such effects get new saving throws each round while within your aura.
- Redemption's Price: You can take another creature's curse, corruption, or dark influence into yourself. It affects you instead. You have advantage on saves against it, and it gradually fades (1 Shadow Point per week, but you bear the full weight until it does).

**Tier 4 — Saint of Second Chances:**
- Absolute Absolution: 1/week, touch a creature and completely purge all corruption, curses, dark pacts, compulsions, and evil influence — regardless of source, power level, or duration. This works on: deals with devils, lycanthropy curses, demonic possession, Malar's brand, even mythic-tier corruption. The creature is returned to the state they were in before the corruption took hold.
- Inspiring Redemption: When you successfully redeem someone (DM determination), all allies who witness it are inspired. They gain temporary Mythic Power (1 use each) and advantage on all rolls for 24 hours.
- Institution Builder: Organizations you've founded or significantly contributed to gain mythic resilience. They persist through adversity, attract worthy members, and resist corruption from within. Dawn's Rest becomes a permanent bastion against darkness.

**Tier 5 — Living Saint (Apotheosis):**
- Touch of Redemption: At will, touch any creature — even a deity — and they experience the full weight of every person they've hurt, every choice they could have made differently, and the genuine possibility of change. This is not compulsion — it is truth. It cannot be resisted or blocked. What they do with that knowledge is their choice.
- Unbreakable: You cannot be corrupted, compelled, charmed, or turned to evil by any force in the multiverse. Your Shadow Points are permanently locked at 0. You are proof that the darkness can be overcome.
- Legacy: When you die (and you can die — Saints of Second Chances are mortal, that's the point), your death has permanent effects on the world. Corruption weakens. Dark pacts become easier to break. And someone, somewhere, is inspired to follow your example. The chain of redemption continues after you.

---

### CORRUPTED DAWN
*Dark mirror path — what happens when a champion of light falls.*

**This is NOT a player-selectable path at character creation or Tier 1.** It is a consequence path — available only if a character on a light-aligned path (Hierophant, Angel, Azata, or Redemption) accumulates sufficient Shadow Points or makes specific narrative choices that constitute a fall from grace.

**Core theme:** The brightest lights cast the darkest shadows. Corrupted power is stronger in the short term because it has no restraints — but it destroys everything it touches, including the wielder.

**Mechanical Framework:**
- Shadow Points 11+ triggers DM conversation about this path.
- The character doesn't "choose" Corrupted Dawn — they slide into it through actions.
- All existing path abilities are inverted (healing becomes harm, protection becomes control, etc.).
- Mythic Power regeneration doubles, but each use costs 1 Shadow Point (accelerating corruption).
- At Tier 5 Corrupted Dawn, the character is essentially a new Big Bad — an NPC villain.

**This path exists as a threat, not an option.** It's the answer to "what if Riv becomes what he fights?"

---

## 5. DARK/VILLAIN PATHS (DM-ONLY)

### BEAST / DARK HUNT
*The Master's path. DM-only. Mortal becoming monster becoming god of the hunt.*

**Inspired by:** WotR Demon path + Exalted Abyssal + Lycanthropic apotheosis
**Designed for:** The Master (and potentially other Malar-aligned villains)

Tier-by-tier abilities documented in DM notes only. Conceptual outline:
- Tier 1: Master werewolf. Voice control of pack. No totems needed.
- Tier 2: Malar's favored. Cult leader with divine dark blessing.
- Tier 3: Apex Predator. Enhanced lycanthropy, regeneration, terror aura.
- Tier 4: Dark Champion. Mythic vs mythic equality with heroes.
- Tier 5: Beast-God. Lesser deity of hunt and slaughter if not stopped.

### SWARM
*Mentioned for completeness. Not planned for this campaign.*

**Inspired by:** WotR Swarm-That-Walks
**Core concept:** The individual dissolves into a collective. You become a swarm intelligence controlling thousands of creatures. Mechanically interesting (immune to single-target effects, can squeeze through any space, divide and reform) but narratively isolating — all companions leave or are consumed.

**Verdict:** Available as a DM villain tool. Not suitable for player paths in this campaign's tone.

---

## 6. MYTHIC ITEMS & LEGENDARY WEAPONS

### Vestige / Legendary Item System
**Adapted from:** Pathfinder Legendary Items + Critical Role Vestiges of Divergence

Magic items with three (or four) states that evolve through narrative milestones:

**Dormant:** The item's base form. Functional magic item with standard properties.
**Awakened:** The item recognizes its wielder's worthiness. Enhanced properties unlock. Requires a specific deed or bond.
**Exalted:** The item reaches its full potential. Powerful unique abilities. Requires a mythic-tier deed.
**(Mythic):** Optional fourth state for items bonded to Tier 3+ mythic characters. The item becomes an artifact in its own right.

### Campaign-Relevant Legendary Items

**Riv's Mace (Unnamed — name to be earned):**
- Dormant: +1 mace, 1d6 radiant damage on hit against undead/fiends.
- Awakened: +2, radiant damage on all hits, Daylight 1/day.
- Exalted: +3, 2d6 radiant on all hits, Sunburst 1/week, immune to darkness.
- Mythic: Deals damage as if the sun itself struck. Tier-dependent scaling.

**Garrick's Silvered Longsword (Family Heirloom — 3 generations):**
- Dormant: +1 silvered longsword. Advantage on attacks against lycanthropes.
- Awakened: +2, deals an additional 1d8 damage to shapechangers, cannot be disarmed.
- Exalted: +3, Moonbeam 3/day, any lycanthrope hit must make CON save or revert to true form.
- Mythic: True Slayer — if this weapon kills a lycanthrope, the curse is broken posthumously (their soul rests clean).

**Marcus Ironwood's Broken Blade (Memorial):**
- This is not a combat weapon — it's a symbol. But if Garrick reforges it at mythic tier...
- Mythic: The Blade That Would Not Die. Deals 3d8 radiant damage. Once per day, when the wielder would drop to 0 HP, the blade flares and the wielder drops to 1 HP instead. "He was still swinging."

### Artificer-Created Mythic Items

**Design space for a future Artificer character or NPC:**
- An Artificer who reaches mythic tier (through the Champion or Legend path) could create legendary items for others.
- Creation requires: mythic-tier materials, a trial-worthy forge, and a sacrifice (personal or material).
- The Artificer's mythic path would focus on imbuing objects with mythic power rather than wielding it personally.
- This creates a unique support role — the character who makes everyone else legendary.
- Potential path name: **Maker** or **Forgemaster** (custom path, not in source material).

---

## 7. MYTHIC MONSTERS & BOSS DESIGN

### Theros Mythic Monster Mechanics (Official 5E)

Adapted from Mythic Odysseys of Theros. For boss encounters against mythic-tier threats:

**Mythic Trait:** When the creature is reduced to 0 HP, the mythic trait triggers. The creature regains all HP and gains new abilities. This is effectively a second phase.

**Mythic Actions:** Enhanced legendary actions available only after the mythic trait triggers. More powerful, more dramatic, and specific to the creature's mythic nature.

### The Master — Boss Design Framework

**Phase 1: The Cult Leader**
- Human(oid) form. High-level spellcaster/martial hybrid.
- Tactical, intelligent, uses minions and terrain.
- When reduced to 0 HP...

**Phase 2: Mythic Trait — The Beast Unleashed**
- Transforms into mythic werewolf form. Full HP restored.
- Gains Mythic Actions: enhanced attacks, fear aura, summon wolves.
- Voice control of all werewolves in range — they fight for him.
- The fight fundamentally changes character.

**Phase 3 (If The Master reaches Tier 3+):**
- Apex Predator form. Massive, terrifying, beyond normal werewolf.
- Third health bar (if the campaign escalates that far).
- Environmental effects — the forest itself fights for him.

---

## 8. PIETY SYSTEM (CAN IMPLEMENT BEFORE LEVEL 20)

### Adapted from Mythic Odysseys of Theros

This system can be introduced NOW, not just at mythic tier. It represents the mechanical weight of a character's relationship with their deity.

**How it works:**
- Piety score starts at 1-3 with your deity.
- Increases by 1 when you act in accordance with your deity's values.
- Decreases by 1 when you act against them.
- At thresholds (3, 10, 25, 50), unlock deity-specific abilities.
- At Piety 50, gain +2 to one ability score past the normal cap.

### Lathander Piety (For Riv/Jakob)

**Piety Increases:**
- Protect the innocent from undead or supernatural evil
- Offer genuine mercy and second chances to enemies
- Build lasting institutions that serve the community
- Perform dawn prayer and ritual consistently
- Bring light (literal or metaphorical) to dark places

**Piety Decreases:**
- Kill when mercy was possible and appropriate
- Destroy rather than build
- Act from vengeance rather than justice
- Neglect prayer and connection to Lathander
- Allow despair to spread unchecked

**Thresholds:**
- **3:** Lathander's Comfort: 1/long rest, cast Lesser Restoration without a spell slot.
- **10:** Dawn's Resilience: Advantage on saves vs. necrotic damage and effects that reduce HP maximum. 1/long rest, cast Daylight without a spell slot.
- **25:** Morning's Champion: When you restore hit points to another creature, add your WIS modifier to the amount healed (on top of normal bonuses). 1/long rest, cast Sunbeam without a spell slot.
- **50:** Morninglord's Blessing: Increase WIS or CHA by 2 (maximum 22). You no longer need to sleep (you meditate at dawn for 4 hours instead). Lathander may communicate with you directly once per tenday.

### Malar Piety (For The Master — DM Use)

**Piety Increases:**
- Hunt and kill powerful prey
- Force transformation on unwilling victims
- Expand territory through fear
- Demonstrate dominance over lesser predators

**Piety Decreases:**
- Show mercy to defeated prey
- Allow prey to escape when it could have been taken
- Submit to another's authority willingly
- Build rather than destroy

**Thresholds:** DM secret. The Master's Piety with Malar is extremely high — his voice control of werewolves may be a Piety 50 ability.

---

## 9. EPIC BOONS (BRIDGE BETWEEN LEVEL 19 AND MYTHIC)

### From the 2024 PHB

At Level 19, characters can take Epic Boon feats. These serve as a natural bridge between mortal play and mythic progression:

**Available Epic Boons (each includes +1 to any ability score, max 30):**
- **Combat Prowess:** Turn one miss per round into a hit.
- **Dimensional Travel:** Teleport 30 ft after Attack or Magic action.
- **Energy Resistance:** Resistance to two damage types of your choice.
- **Fate:** When any creature succeeds or fails a d20 test, add or subtract 2d4. Resets on initiative or rest.
- **Fortitude:** +40 max HP. +CON modifier to all healing received.
- **Irresistible Offense:** Bludgeoning/piercing/slashing ignores resistance. Extra damage on nat 20.
- **Recovery:** 10d10 self-healing pool per long rest. If you drop to 0, automatically use 1d10 and regain that many HP.
- **Skill:** Proficiency in all skills. Expertise in one.
- **Speed:** +30 ft movement. No opportunity attacks against you after you attack.
- **Spell Recall:** Cast one prepared/known spell without a slot, 1/long rest.
- **Truesight:** Truesight 60 ft. +10 to Stealth. Immune to divination.
- **Night Spirit:** Invisible in dim light/darkness until you act. Immunity to lightning/thunder, Thunderwave at will.

### How Epic Boons Transition to Mythic

**Level 19-20:** Characters take their first Epic Boon. This is the "stepping stone."
**Level 20+:** Additional boons every 30,000 XP, OR begin mythic progression.
**The choice:** A character can continue accumulating Epic Boons (staying on the Legend path effectively) OR accept mythic ascension and gain a mythic path. The two systems can coexist — a Tier 1 mythic character might also have 1-2 Epic Boons from their pre-ascension career.

---

## 10. INTEGRATION WITH EXISTING HOMEBREW

### Glory Points
- Continue earning and spending normally at all mythic tiers.
- Mythic does not equal infinite luck. A Tier 5 character can still fail critically.
- New Glory option at Tier 3+: Spend 3 Glory to activate a mythic ability without spending Mythic Power.

### Shadow Points
- Direct interaction with mythic paths.
- **Light paths** (Hierophant, Angel, Azata, Gold Dragon, Redemption): Require Shadow 0-2 for full power. Shadow 3-5 weakens abilities. Shadow 6+ locks you out of path abilities until reduced.
- **Dark paths** (Demon, Lich, Devil, Corrupted Dawn): Gained through Shadow accumulation. Higher Shadow = more powerful.
- **Neutral paths** (Aeon, Trickster, Legend): Shadow Points tracked but don't directly affect path abilities.
- The Beast/Dark Hunt path: Shadow accelerates transformation. The Master's Shadow score is presumably astronomical.

### Relationship Levels
- Tier 1-2: Normal relationship mechanics continue.
- Tier 3+: Mortal relationships become harder to maintain. The power differential makes normal people uncomfortable, awed, or afraid. Characters must actively work to stay grounded.
- Level 5 (Legendary) relationships become more significant — the bond between a mythic character and their mortal anchor is narratively powerful and mechanically useful (a Level 5 mortal relationship might be the thing that prevents a fall to Corrupted Dawn).

### Exhaustion
- Tier 1-2: Normal exhaustion rules apply.
- Tier 3+: Immune to mundane exhaustion (forced march, no sleep, extreme conditions).
- **Mythic Exhaustion:** Overusing Mythic Power (spending more than your pool in a day through special abilities), fighting Tier 3+ opponents for extended periods, or channeling power beyond your tier's capacity can cause mythic exhaustion. Same mechanical effects as normal exhaustion but caused by different triggers.

### Heat Tracker
- Mythic characters generate heat on a cosmic scale.
- Tier 1-2: Normal heat from the campaign's existing faction system.
- Tier 3+: Gods, outsiders, and planar entities track you. New heat sources and consequences at this scale.

### Stronghold Economy
- Mythic characters can enhance strongholds beyond normal limits.
- A Hierophant's holy site blessing could make Dawn's Rest sacred ground.
- A Legend's organizational genius could make the Order a kingdom-spanning institution.
- Mythic-tier construction: Artifacts as defensive installations, divine wards, planar anchors.

---

## 11. BOUNDED ACCURACY & BALANCE PRINCIPLES

5E is designed around bounded accuracy — a +11 maximum modifier at Level 20. Mythic risks breaking this. Solutions:

1. **Damage/healing over accuracy.** Mythic bonuses apply to damage and healing more than attack rolls and save DCs. A Tier 3 character doesn't have +20 to hit — they deal devastating damage when they do hit, and they have new capabilities.

2. **Qualitative over quantitative.** Mythic abilities grant new things characters can do, not just bigger numbers on existing things. An Angel can fly and summon celestial warriors. A Trickster can steal abilities. An Aeon can stop time. These are qualitative differences, not "+5 to all checks."

3. **Opposed mythic checks.** When two mythic beings contest, they use their Mythic Power and Surge dice against each other. Normal bonuses become less relevant. This means a Tier 3 character fighting mundane soldiers is overwhelming (as they should be), but fighting a Tier 3 villain is tense and uncertain (as it should be).

4. **Legendary Resistance via Mythic Power.** Instead of arbitrary "3/day auto-succeed," mythic characters spend Mythic Power to auto-succeed saves. This creates resource tension — do you burn your Mythic Power on defense, or save it for offense?

5. **Proficiency bonus stays at +6.** Even at Tier 5, proficiency bonus doesn't increase. Power comes from mythic abilities, not numerical inflation.

6. **Save DCs cap at 22-23.** Path abilities have fixed DCs or use existing spell save DC formulas. Even mythic-tier effects can be resisted — they're just harder to resist and the consequences of failure are more dramatic.

---

## 12. MULTI-CAMPAIGN TIMELINE

This is possibility, not mandate. Campaign I could be the only campaign. The framework exists if wanted.

**Campaign I (Current): Mortal Foundation**
- No mythic progression.
- Characters reach Level 10-15 by campaign end.
- Foundation: heroic deeds, Order established, cult defeated (or not).
- The Master may be Tier 1 already (unrevealed) — his voice control of werewolves is evidence.
- Piety system could be introduced now as a non-mythic mechanic.
- Legendary items could begin in Dormant state.

**Campaign II (5-10 years later in-world): Awakening**
- Characters reach Level 15-20.
- Order expands into regional power.
- New threats emerge that require mythic response.
- Lathander (or other sources) offer ascension. Characters choose paths.
- Characters achieve Tier 1-2 by campaign end.
- The Master returns at Tier 2 (if escaped Campaign I).
- Epic Boons begin as stepping stones.
- Legendary items reach Awakened state.

**Campaign III (Decades later): Champions**
- Multiple party members are mythic.
- Planar threats, divine crises, world-shaking events.
- Characters reach Tier 3-4.
- Mythic heroes vs. mythic villains — battles that reshape the world.
- Legendary items reach Exalted state.

**Campaign IV (Final): Apotheosis**
- Tier 5 decisions.
- The character's ultimate choice: godhood, eternal mortality, sacrificial transcendence, or something else entirely.
- The Order's ultimate fate decided.
- Epilogue: centuries later, stories told of what these heroes chose.

---

## 13. IMPLEMENTATION CHECKLIST

### Before Mythic Begins:
- [ ] Complete mechanical detail for all planned paths (currently only Hierophant is fully detailed)
- [ ] Design base mythic ability progression for 5E (adapt Mythic Power, Surge, etc.)
- [ ] Create mythic feat list (5E versions of Pathfinder mythic feats)
- [ ] Design mythic spell upgrades for key spells
- [ ] Build The Master's stat block with mythic monster mechanics
- [ ] Define trial requirements for each tier
- [ ] Design Moment of Ascension narrative for each potential path
- [ ] Playtest Tier 1 abilities for balance
- [ ] Develop legendary item progression for campaign weapons

### Can Implement Now (Pre-Mythic):
- [ ] Piety system for Lathander (Riv, Jakob)
- [ ] Legendary item Dormant states for key weapons
- [ ] Theros-style Mythic Monster mechanics for The Master's boss fight
- [ ] Epic Boon availability at Level 19+

### Develop One Tier Ahead:
- When players approach Tier 1: detail Tier 1-2 abilities for all relevant paths
- When players reach Tier 2: detail Tier 3 abilities
- Never detail Tier 5 until players are approaching Tier 4
- Keep DM villain paths 1 tier ahead of players

---

## 14. OPEN DESIGN QUESTIONS

These questions don't need answers now but should be resolved before implementation:

1. **Guardian path?** Pathfinder's Guardian (tank/defender) was dropped from our system. Should we add it? Garrick or a future Paladin might want a "wall of protection" path rather than Champion's "perfect warrior."

2. **Archmage path?** Dropped because no arcane caster in current party. If one joins, we need it.

3. **Path switching?** WotR allows late-game path switches (e.g., Azata to Devil, any path to Legend or Gold Dragon). Do we allow this? What's the cost?

4. **Multipath?** Can a character have abilities from two paths? PF says no. But what about a character who walks the line between two themes?

5. **NPC mythic progression?** Do important NPCs (Jakob, Lyra, Garrick) get mythic tiers, or does this remain player-only? If NPCs get it, who manages their advancement?

6. **Artificer/Maker path:** Is this a full path or a variant of Legend? What does an Artificer's mythic progression look like mechanically? Creating legendary items for the party is compelling but needs structure.

7. **Piety vs. Mythic Power:** Are these separate resources or do they interact? Could high Piety grant bonus Mythic Power? Could mythic abilities cost Piety to use?

8. **What happens to the Order at Tier 3+?** When the Commander is a demigod, does the institution change? Can mortals still serve meaningfully alongside mythic leaders?

9. **Death and resurrection at mythic tier:** How do we maintain stakes when characters can self-resurrect? What threats are genuinely dangerous to Tier 4-5 characters?

10. **Player buy-in:** When does the conversation about mythic progression happen with the player? After Campaign I ends? During Campaign I if multi-campaign arc is planned?

---

## FINAL NOTE

This document is a reference, not a rulebook. Every system described here requires mechanical development, playtesting, and player input before implementation. The paths are options, not assignments. Characters will grow into whatever fits their story.

The most important rule: **mythic progression serves the narrative.** If a system doesn't make the story better, don't use it. If a path doesn't fit who the character has become, don't force it. Let the campaign decide.

**By dawn's first light.**

---

*Document version: 1.0*
*Last updated: 2026-02-20*
*Status: Future Feature — Framework & Reference*
