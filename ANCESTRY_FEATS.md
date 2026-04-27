# Ancestry Feats Design

Status: All 13 lists complete. Balance pass applied. Pending: cross-system integration check, AI memory architecture decisions, implementation.

## System Overview

Ancestry Feats are a progression layer parallel to class and theme. Each character selects one Ancestry Feat at each of 5 tier levels: **L1, L3, L7, L13, L18**. These feats express racial/ancestral identity mechanically, turning racial traits from a static L1 dump into an evolving part of character development.

## Design Framework

**Tier structure:**
| Tier | Level | Character Moment |
|------|-------|------------------|
| L1 — Foundational Identity | Character creation | Small flavor-setting trait that extends racial baseline |
| L3 — Early Bloom | Early adventuring | First mechanical refinement of heritage |
| L7 — Adolescent Mastery | Mid-tier | Starting to feel iconic for your race |
| L13 — Deep Heritage | High-tier | Tapping into ancestral depths |
| L18 — Legendary | Capstone | Pinnacle expression of your race |

**Choice model:**
- **3 feats per tier, player picks 1.** This gives build variety without overwhelming new players with choice paralysis.
- Companions **auto-pick** based on personality — no menus to wade through when leveling up companions.

**Scope:**
- 10 major races + Drow as a distinct list + Aasimar's three paths each as a distinct progression tree = **13 lists total**
- 5 tiers × 3 feats baseline + 1 cross-pick at L13 ("Path Less Walked") = 16 feats per list
- Total: **208 ancestry feats** across all 13 lists

**Design principles:**
1. **Complement, don't duplicate.** Feats expand on existing racial traits; they don't repeat them.
2. **Usefulness across class.** A Dwarf Wizard and a Dwarf Fighter should both find meaningful choices at each tier.
3. **Cultural flavor matters as much as mechanics.** Feats should feel *rooted* in the race's identity.
4. **L1 is subtle, L18 is legendary.** Early feats set flavor. Late feats feel transcendent.

## Companion Ancestry Feat Handling

Companions present two scenarios:

**Scenario A: Companion joins at level N with feats pre-baked.**
When the player encounters an NPC who becomes a companion, their Ancestry Feats up to their current tier are already determined. The AI DM selects these feats based on:
- The NPC's personality traits (voice, mannerism, motivation, ideals)
- Their background and occupation (a blacksmith dwarf picks craft-oriented feats)
- Their physical description (a scarred warrior picks combat resilience feats)
- Their narrative role in the world (a deep-delving miner picks underdark feats)

The selection is done once at the point the NPC becomes a companion (or is first defined as potentially recruitable). From then on, the choices are canonical to that character.

**Scenario B: Companion levels up while in the party.**
When a companion crosses an Ancestry Feat tier boundary (reaching L3, L7, L13, or L18), the AI DM auto-picks a feat based on their evolving personality and recent experiences in the campaign. This is delivered as a narrative moment, not a menu prompt:

> *"After the battle in the Deepreach caverns, Tormund flexes his fingers and looks at the stone around him with new understanding. 'I didn't know it could listen,' he says quietly. He's taken Stoneshaping (Minor) — the cavern's long silence taught him something."*

This keeps companion progression meaningful without dumping mechanical choices on the player.

---

## Dwarf

**Racial baseline (5e):** Darkvision 60 ft, Dwarven Resilience (advantage poison saves, resistance poison damage), Dwarven Combat Training (battleaxe, handaxe, light hammer, warhammer), Tool Proficiency (one artisan's tool), Stonecunning (proficiency bonus doubled on stonework History checks), +2 CON base; Hill Dwarf adds +1 WIS and 1 HP/level; Mountain Dwarf adds +2 STR and light/medium armor proficiency.

**Identity:** Stone-born, clan-bound, grudge-keeping, craft-loving, mountain-hearted. Dwarves are shaped by the stone they dwell in, the clans they swear to, and the ancient enemies they remember. Their feats should expand on these themes: stone, craft, kinship, resilience, and the long memory.

### L1 — Foundational Identity

**Stout-Hearted** — Your dwarven constitution runs deep. You gain +2 maximum HP + 1 additional HP per character level (retroactive and ongoing). *Note: Hill Dwarves who pick this feat gain its full benefit, stacking with their subrace bonus — this is intentional, representing exceptional hardiness even among Hill Dwarves.*

*Flavor: A dwarf's body is built to endure. You've inherited an extra measure of it.*

**Clan's Craft** — You gain proficiency with one additional artisan's tool of your choice, and you can identify the maker, origin clan, and approximate age of any dwarven-crafted item by handling it for 1 minute.

*Flavor: You were taught at a clan hearth. The signs are second nature to you.*

**Grudge-Sworn** — Choose one traditional dwarven foe: **giants**, **orcs**, **drow**, or **goblinoids**. You have advantage on initiative rolls when at least one creature of that type is present, and you know basic tactical lore about how they fight.

*Flavor: Your clan's grudge songs name this enemy. You've heard them since you were young.*

### L3 — Early Bloom

**Rock Runner** — Difficult terrain composed of rubble, rocks, or uneven stone doesn't cost you extra movement. You have advantage on Dexterity (Acrobatics) and Strength (Athletics) checks to stay upright on unstable rocky surfaces.

*Flavor: The stone knows your weight. You move on it the way others move on level ground.*

**Underfoot** — While within 30 feet of a natural stone surface (cavern floor, mountain, mine, rocky terrain), you have **tremorsense to 10 feet** through stone. You sense vibrations and know when something is approaching underground or on the stone near you.

*Flavor: You don't just walk on stone. You listen to it.*

**Unburdened Iron** — Heavy armor no longer reduces your movement speed. If your strength score is below the usual requirement for a heavy armor, you ignore that requirement. (Does not grant proficiency.)

*Flavor: Dwarves were not made to be slowed by mere metal.*

### L7 — Adolescent Mastery

**Boulder Push** — Once per short rest, when you succeed on a Strength check to grapple, shove, or push a creature, you can launch them up to 10 feet in a chosen direction. If they collide with a wall or another creature, both take 1d6 bludgeoning damage and must make a DC 13 Strength save or fall prone.

*Flavor: You don't just push. You hurl.*

**Stonecunning Adept** — Your Stonecunning feature extends: by touching stone surfaces, you can identify traps, structural weaknesses, secret doors, and recent construction. You have advantage on Intelligence (Investigation) checks made against worked stone.

*Flavor: The stone whispers where it has been cut, cracked, or carved recently. You hear it.*

**Anvil Steady** — Your footing becomes unshakeable. You are **immune to being knocked prone** by creatures of size Medium or smaller, and you have advantage on saves to resist being knocked prone by larger creatures or forces.

*Flavor: A dwarf holds the line. You've learned that the line begins at your boots.*

### L13 — Deep Heritage

**Deep Sight** — Your Darkvision extends to **120 feet**, and you can see normally in **magical darkness up to 30 feet**. The gift of dwarves who have dwelt in the Deepholds.

*Flavor: Your eyes have been tested by the dark beneath the dark.*

**Stoneshaping (Minor)** — Once per long rest, you can shape unworked stone as if it were clay for **10 minutes**. During this time you can shape up to **5 cubic feet of stone total** — creating openings in walls (up to 3×3×3 feet), reshaping floors into simple structures (steps, walls, seats), or carving patterns. The shaped stone remains stone and is permanent unless reshaped again.

*Flavor: The old songs are true. A dwarf's hands remember what stone once was before it was stone.*

**Mountain's Stoutness** — Choose one damage type associated with a traditional dwarven foe: **fire** (Muspelheim giants), **cold** (ice giants and frozen drow curses), **necrotic** (dark elven magic), or **psychic** (aboleth deeps). You gain resistance to the chosen damage type.

*Flavor: Your ancestors bled in this war before you were born. The scar runs deep enough to shield you.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Some dwarves carry an old fire — a thread of something the mountain didn't put there. Most never see it surface. You did. The clan elders will not approve, and the stone will not forget.*

### L18 — Legendary

**Walk in Stone** — Once per long rest, you can merge with a stone wall, floor, or ceiling as an action. You travel through stone at half your walking speed for up to 10 minutes. While merged, you can see and hear through 1 foot of stone in any direction. You cannot attack or cast spells while merged. You emerge at a point of your choice within movement range.

*Flavor: The stone took you in. When it gives you back, you are changed.*

**Moradin's Favor** — Once per long rest, when you craft an item, perform a crafting project, or make a skill check with an artisan's tool, you invoke Moradin's favor. You make the check with **advantage** and treat any die roll of 1 as its maximum value. Items crafted this way gain minor magical resonance (DM determines — typically a small thematic enhancement: a weapon that hums when enemies approach, a shield that warms its wearer in cold, armor that never rusts).

*Flavor: The Dwarffather smiles on good work. He smiles wider when his children smile back.*

**Unbreakable** — You are **immune to being petrified**. Once per long rest, when you drop to 0 HP, you instead drop to half your HP maximum and become **immune to being knocked prone** for 1 minute. The stone of your ancestors holds you up when nothing else can.

*Flavor: You are not flesh that remembers stone. You are stone that remembers being flesh.*

---

---

## Elf

**Racial baseline (5e):** Darkvision 60 ft, Keen Senses (Perception proficiency), Fey Ancestry (advantage on saves vs charmed, immune to magical sleep), Trance (4-hour rest in meditative reverie), +2 DEX base. Subraces: High Elf (+1 INT, cantrip, extra language, elven weapon training); Wood Elf (+1 WIS, Mask of the Wild, longer movement, woodland weapons). *(Drow treated as separate list below.)*

**Identity:** Graceful, long-lived, fey-touched, magically sensitive, rooted in ancient traditions. Elves are shaped by the long view — by memories that span centuries and an intimate relationship with both the natural world and the Weave of magic. Their feats should expand on grace, fey connection, arcane affinity, keen perception, and a certain otherworldly lightness.

### L1 — Foundational Identity

**Elven Grace** — You gain proficiency in one additional Dexterity-based skill (Acrobatics, Stealth, or Sleight of Hand). Once per short rest, when you fail a Dexterity check or saving throw, you can reroll with advantage.

*Flavor: You move the way the old songs describe your kind — with a lightness that defies the body's weight.*

**Weave-Touched** — You learn one cantrip from the wizard or druid spell list. Intelligence or Wisdom is your spellcasting ability for this cantrip (choose when taking this feat). This is in addition to any cantrip from the High Elf subrace.

*Flavor: The Weave is close to elvenkind. Even those who do not study magic feel its hum.*

**Eyes of the Forest** — Your keen senses double in natural environments. Your Perception proficiency bonus is doubled when perceiving creatures, tracks, or unusual signs in wilderness, and you can see twice as far as normal in daylight (roughly 120 feet of clear detail, out to the horizon).

*Flavor: Your people have watched the forests longer than mountains have stood. Your eyes carry that inheritance.*

### L3 — Early Bloom

**Light Step** — You move across difficult terrain made of vegetation, snow, or still water without extra movement cost. When moving at half your speed, you leave no tracks and make no sound on natural surfaces.

*Flavor: The earth remembers dwarves. It rarely remembers elves.*

**Fey Reflexes** — Your Fey Ancestry deepens. You have advantage on Wisdom saving throws against being **charmed, frightened, compelled, or magically read** (previously only charmed). You can also sense the presence of fey creatures within 60 feet of you.

*Flavor: The Feywild left a thread in you. It pulls taut when something unnatural comes close.*

**Trance Mastery** — Your trance requires only 2 hours (instead of 4) for a long rest's benefits. During your trance, you remain aware of your surroundings — you cannot be surprised by creatures approaching while you meditate.

*Flavor: Elven reverie is not sleep. You have refined yours past even that resting.*

### L7 — Adolescent Mastery

**Arcane Inheritance** — Once per long rest, you can cast a 1st-level spell from the wizard spell list without expending a spell slot. The spell must be a non-combat utility spell (Comprehend Languages, Detect Magic, Disguise Self, Feather Fall, Unseen Servant, etc.) — chosen when taking this feat. INT or WIS is the spellcasting ability.

*Flavor: Old magic lives in the blood of your line. Once a day, you feel it stir.*

**Huntmaster's Gift** — You have advantage on attack rolls against creatures that have not yet taken a turn in combat. Additionally, your first attack of any combat deals +1d6 extra damage of the weapon's type.

*Flavor: Strike first, strike true. Your ancestors hunted the fey wilds. You remember, without knowing that you remember.*

**Twilight Walker** — You can see normally in dim light as if it were bright light. At dusk, dawn, or in dim light, you have advantage on Stealth checks, and your first attack deals an additional 1d4 damage when you attack an enemy that hasn't seen you.

*Flavor: The half-light is your element. Your shadow does not quite reach the floor in it.*

### L13 — Deep Heritage

**Fey Step** — Once per short rest, you can teleport up to 30 feet to an unoccupied space you can see. This requires no components — it is a step between moments, a flicker of fey inheritance. *(Mechanically similar to the Eladrin's Fey Step feature from Mordenkainen's — intentionally, as all elves carry echoes of that lineage.)*

*Flavor: The world hesitates, and you slip through the hesitation.*

**Master of the Weave** — You learn two additional cantrips from any single spell list (wizard, druid, bard, or cleric). INT or WIS is the spellcasting ability for these cantrips. One of the cantrips may be a combat cantrip.

*Flavor: The hum has become a language. You know three of its words now, where you knew one.*

**Elvensight** — Your Darkvision extends to 120 feet. You can see through magical darkness up to 30 feet, and you are immune to being magically blinded (though mundane blinding — like a flash of bright light into your eyes — still functions normally for 1 round).

*Flavor: Your eyes remember a time before torches.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Eight hundred years is enough to brush against many bloodlines. Something you noticed in passing, lifetimes ago, has decided to make itself known in you now. The Trance shows you which thread, and where it leads.*

### L18 — Legendary

**Ageless Grace** — You are immune to aging effects, both natural and magical. Nothing can age you against your will, including spells, curses, or the simple passage of time. Once per long rest, when you would fail a death saving throw, you succeed instead.

*Flavor: Time is a current you have learned to stand in, unmoved.*

**Walker Between Worlds** — Once per long rest, you can step briefly into the Feywild and back as an action. For up to 10 minutes, you are **invisible and can pass through non-magical barriers** (walls, doors, thickets) as if they weren't there. You cannot attack or cast spells offensively while in this state; doing so ends the effect immediately.

*Flavor: The space between worlds has always been a shorter step for your kind.*

**Voice of the Weave** — You can cast one spell of 5th level or lower once per long rest without expending a spell slot or requiring material components. The spell is chosen from the wizard or druid spell list at the time of taking this feat and cannot be changed. INT or WIS is the spellcasting ability (choose when taking this feat).

*Flavor: You have learned to ask the Weave for favors. Sometimes, it listens.*

---

## Drow

**Racial baseline (5e):** Darkvision 120 ft (superior), Keen Senses (Perception proficiency), Fey Ancestry (advantage vs charm, immune to magical sleep), Trance, Sunlight Sensitivity (disadvantage on attack rolls and Perception in direct sunlight), Drow Magic (Dancing Lights cantrip at L1, Faerie Fire at L3, Darkness at L5), +2 DEX, +1 CHA base, Drow Weapon Training (hand crossbows, rapiers, shortswords).

**Identity:** Children of the Underdark. Heirs to a ruthless, matriarchal society in service of Lolth — whether they embrace, flee, or betray that legacy. Drow feats should reflect the weight of their heritage: the spider's grace, the poisoner's craft, the exile's caution, and the long shadow Lolth casts over all her descendants, worshipper or apostate. A Drow's feat list can take them deeper into their dark inheritance, or toward breaking it.

**Narrative note:** Drow often carry profound personal arcs — devotion, exile, repentance, revenge. The AI DM should lean into these where possible. Not every Drow is a villain; not every Drow has left the Underdark; some carry the web with them whether they want to or not.

### L1 — Foundational Identity

**Lolth's Scion** — You have **resistance to poison damage** and advantage on saves against being poisoned. You can detect poison in food, drink, or on a surface within 10 feet by concentrating for 1 minute.

*Flavor: The Spider Queen's blood runs in you, even if you wish it didn't. Poison does not grip you as it grips others.*

**Shadowbred** — You gain proficiency in Stealth. Once per short rest, when you fail a Stealth check, you can reroll with advantage. Additionally, you can speak at any audible volume while producing no louder sound than a whisper — a skill taught in drow households where listening walls are everywhere.

*Flavor: You learned quiet before you learned language.*

**Weaver's Tongue** — You learn **Undercommon** and one additional language of your choice (including secret languages: Drow Sign Language, thieves' cant of the Underdark, or an ancient elven dialect). You have advantage on Charisma (Deception) checks when speaking in any Underdark language.

*Flavor: The web has many strands. You know how to pluck each one.*

### L3 — Early Bloom

**Spider's Grace** — You have a climbing speed equal to your walking speed on stone, cave, or unworked natural surfaces. With a free hand and in dim light or darkness, you can climb on ceilings.

*Flavor: Lolth's children do not fear walls. They ascend them.*

**Drow Magic Expanded** — Your racial Drow Magic expands. You can cast *Faerie Fire* once per long rest as a racial ability (in addition to the standard Drow progression that grants it at L3), and you can cast *Detect Magic* once per long rest. Charisma is your spellcasting ability.

*Flavor: The Underdark taught your line to see in the dark — and to pull the dark around itself when needed.*

**Keen Instinct** — You have advantage on Insight checks to detect lies, treachery, or hidden motives. In a society where most conversations are layered with intent, you learned to read beneath words before you could read them.

*Flavor: Honesty is a luxury. You are not from a culture of luxuries.*

### L7 — Adolescent Mastery

**Shadow Step** — Once per short rest, when you are in dim light or darkness, you can teleport up to 60 feet to another area of dim light or darkness that you can see. You become **invisible until the start of your next turn** after arriving.

*Flavor: The darkness is yours. It always was.*

**Venomous Strike** — Once per long rest, you can coat your weapon with a naturally produced drow poison as a bonus action. Your next three successful attacks within 1 minute deal an additional **2d4 poison damage**. On the first hit, the target must make a Constitution save (DC = 8 + your proficiency bonus + your Dexterity modifier) or be **poisoned for 1 minute**.

*Flavor: Your body remembers the old ways of preparation, even if your mind refuses them.*

**Dark Sight** — Your superior Darkvision extends to **240 feet**. You can see normally in dim light and in magical darkness to a range of 60 feet. **Your Sunlight Sensitivity worsens**: you now have disadvantage on attack rolls *and* on all ability checks (not just Perception) made in direct sunlight.

*Flavor: The deep welcomes you more each year. The sun remembers that you are its enemy.*

### L13 — Deep Heritage

**Lolth's Favor (or Defiance)** — Once per long rest, you can summon a **single medium spider** (functioning as a giant wolf spider from the Monster Manual) for 1 minute. The spider understands Common and speaks the language of spiders. It is **kin to you, not subject to you** — it may fight alongside you, observe, or refuse to help, depending on your standing with Lolth (the AI DM tracks this). Drow who openly defy Lolth may find their summoned spiders unreliable; Drow who serve her find them loyal.

*Flavor: The web reaches you wherever you go. Whether it obeys you is another matter.*

**Drowcraft Weapon** — A weapon in your possession (your choice at the time of taking this feat) becomes a **drowcraft weapon** — it gains +1 to attack and damage rolls, and deals an additional 1d4 poison damage on a hit. It functions only while you wield it. If dropped in direct sunlight, it crumbles to dust within 1 hour. Another weapon can be ritually prepared after 7 days of dark ceremonies.

*Flavor: Some weapons only remember their edge when held by the right hand.*

**House Heritage** — You know the **secret sign-language of Drow nobles** and the sigils of major Drow houses. You have advantage on Persuasion, Deception, and Intimidation checks against Drow and other Underdark creatures who recognize your bearing. However, members of your former House (and their vassals) will recognize you on sight — **and may or may not be kindly disposed**, depending on the circumstances of your departure.

*Flavor: The house is always part of you. Sometimes that protects you. Sometimes it marks you.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Lolth's children have always been changeable — exile, defiance, escape. What surfaces in you now is older than the spider's web. Something elven that the dark didn't quite kill, or something else entirely that the Underdark gathered up. You decide which.*

### L18 — Legendary

**Spider Queen's Disciple (or Apostate)** — You gain **blindsight to 60 feet** when in darkness (natural or magical) — you perceive the vibrations of Lolth's web, the currents of fate itself. This sense functions even when you are blinded or surrounded by silence. For devout Drow, this is a boon from the Spider Queen. For apostate Drow, it is a scar of heritage they cannot fully escape.

*Flavor: The web hums, whether or not you want to hear it.*

**Darkness Embodied** — You have **resistance to radiant damage** (your kind has always suffered in light, and those who endure learn to resist even its sacred forms). Once per long rest, as an action, you wrap yourself in a **10-foot radius of magical darkness** that moves with you. This darkness lasts for 1 minute. Only you can see through this darkness — all other creatures within it are blinded.

*Flavor: You do not hide in darkness. You wear it.*

**Exile's Promise** — Once per long rest, when you would die (reduced to 0 HP and failing death saves, or killed by a failed save against massive damage), you instead **vanish into darkness** for 1 hour. You reappear at a place of your choice within 5 miles after the hour passes, at 1 HP. This ability cannot save you if you die in direct sunlight, or if your body is immediately dissolved by an effect (disintegration, dissolution, etc.).

*Flavor: Whether Lolth refuses to claim you, or refuses to lose you, depends on which Drow you ask.*

---

---

## Human

**Racial baseline (5e):** Standard Human gains +1 to all six ability scores. Variant Human gains +1 to two ability scores, one skill proficiency, and one feat at L1. Both have 30 ft base speed and a starting language of choice. No darkvision, no magical resistances, no special senses — humans are the baseline fantasy race defined by drive, adaptability, and range.

**Identity:** Versatile, ambitious, adaptable, driven. Humans don't have the longevity of elves or the stone-rooted endurance of dwarves, but they have *range* — they rise fast, fall fast, learn fast, and appear in every corner of every story. Their feats should reflect this: adaptation, learning, leadership, and the distinctly human ability to push past what should stop them.

**Subrace note:** Standard Human and Variant Human share this list, but tend to lean toward different picks. The feats below are flagged for the archetype they most naturally fit. Both subraces can pick any feat — the distinctions are narrative, not restrictive.

### L1 — Foundational Identity

**Jack of All Trades** *(fits Standard Human well)* — You can add half your proficiency bonus (rounded down) to any ability check that doesn't already include your proficiency bonus. This does not apply to attack rolls or saving throws.

*Bard interaction:* If you take this feat as a Human Bard, you gain Jack of All Trades earlier than your class would grant it. When your Bard class would grant the feature at L2, your version upgrades — you now add half your proficiency bonus **rounded up** (instead of rounded down) to ability checks that don't already include your proficiency bonus. This represents the unique synergy between human breadth and bardic versatility.

*Flavor: You've tried a little of everything. Some of it stuck.*

**Relentless Drive** *(fits Variant Human well)* — You gain proficiency in one skill of your choice and one language. Additionally, when you fail an ability check during a task, you can spend 10 minutes practicing or rethinking, then repeat the check once with advantage. Once per short rest.

*Flavor: "I'll do it again, and this time I'll get it right."*

**Traveler's Tongue** *(fits either)* — You learn two additional languages. You have advantage on Charisma checks to communicate with strangers during the first 10 minutes of meeting them.

*Flavor: Every human you meet has been somewhere. Some of them remember almost all of it.*

### L3 — Early Bloom

**Quick Study** — When you spend at least 10 minutes observing or practicing an activity (watching someone pick a lock, studying a foreign etiquette, handling a musical instrument), you can make a DC 15 check with the appropriate skill. On a success, you gain temporary proficiency in it for the next 24 hours. Only one temporary proficiency at a time; taking a new one replaces the previous.

*Flavor: A day's observation is a week's training for your kind.*

**Human Ambition** — Your drive pushes your body. You gain +5 feet of walking speed. Additionally, when you use the Dash action, add your Constitution modifier (minimum +1) to the distance gained.

*Flavor: You move faster because you need to. Always.*

**Adaptive Instinct** — When you take damage of a type you have been injured by within the last 24 hours, you can use your reaction to reduce that damage by **1d6 + your Constitution modifier**. Your body adapts quickly to threats it has seen before.

*Flavor: The first burn was agony. The second, you knew to expect.*

### L7 — Adolescent Mastery

**Born Leader** — Once per short rest, as an action, you grant up to 5 allies within 30 feet temporary HP equal to your Constitution modifier + your proficiency bonus. Additionally, those allies have advantage on their next saving throw against being charmed or frightened while they can hear you.

*Flavor: When you speak, they find themselves listening.*

**Cross-Training** — You learn one additional language, gain one additional skill proficiency, and gain one additional tool proficiency. Humans are the great learners — you pick up a new trade with each passing year.

*Flavor: You are what happens when a race decides every mastery is achievable given enough time.*

**Second Wind (not the Fighter's)** — Once per short rest, as a bonus action, you regain hit points equal to **1d10 + your character level**. This represents the sheer human capacity for recovery under pressure. Stacks with the Fighter class feature if you have it, but uses a separate pool.

*Flavor: You have been through worse. Your body remembers that.*

### L13 — Deep Heritage

**Peak Performance** *(fits Variant Human's focused identity)* — Your sustained focus on a single pursuit has paid off. You gain +1 to one ability score of your choice (maximum 20). This feat can only be taken once.

*Flavor: A human in their prime is a frightening thing.*

**The Road Taught Me** *(fits Standard Human's breadth)* — You gain proficiency in three additional skills of your choice. You have advantage on ability checks to recall general information about any inhabited settlement you're in — who leads it, what it trades, what its troubles are.

*Flavor: You've been everywhere, and you've been paying attention.*

**Forge of Will** — Once per long rest, when you fail a Constitution or Wisdom saving throw, you can use your reaction to succeed instead. This represents the distinctly human capacity to push through what should stop you — a defiance of body and mind both.

*Flavor: Your body says no. Your mind says no. You say "not today."*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Humans don't keep clean bloodlines. Whatever your great-grandmother was — and her great-grandmother before her — you carry a thread of it. That thread has just learned how to do something. It picked its moment.*

### L18 — Legendary

**Legend's Prime** *(especially iconic for Variant Human)* — You have reached the peak of human potential. You gain **+2 to one ability score of your choice**, and this score's maximum increases to **21** (exceeding the normal cap of 20). Humans at their prime are what other races call heroes.

*Flavor: Whatever elves achieve in centuries, some humans achieve in years.*

**Stand Against the Tide** — Once per long rest, when you are reduced to 0 HP, you instead drop to 1 HP and gain temporary HP equal to your character level + your Constitution modifier. Additionally, for **1 minute** after this triggers, you have advantage on all attack rolls and saving throws. You are at your most human when the world is against you.

*Flavor: Humans, it turns out, are hardest to kill when it matters most.*

**Bridge Between Worlds** — Your adaptation has become legendary. You are **immune to being charmed** by creatures whose native language you don't speak. You can spend 10 minutes learning the basics of any spoken language (enough for simple conversation). **Full fluency requires only 7 days** of immersion. Wherever you go, within a week, you belong there.

*Flavor: There is no door closed to a human long enough to matter.*

---

## Halfling

**Racial baseline (5e):** Lucky (reroll 1s on attacks, ability checks, and saves), Brave (advantage on saves vs frightened), Halfling Nimbleness (move through spaces of creatures larger than you), +2 DEX, speed 25 ft, small size. Subraces: Lightfoot Halfling (+1 CHA, Naturally Stealthy — can hide behind creatures at least one size larger); Stout Halfling (+1 CON, Stout Resilience — advantage + resistance vs poison).

**Identity:** Small, lucky, unexpectedly capable, community-minded, cheerful in adversity, resilient in ways that confound bigger folk. Halflings are the "nobody expected you" race — their power isn't in dominance but in survival, and their feats should reflect luck, endurance, agility around larger threats, and the quiet strength of those who look harmless.

### L1 — Foundational Identity

**Unexpected Step** — Once per short rest, when a creature misses you with an attack, you can use your reaction to move up to **10 feet** without provoking opportunity attacks. You're never quite where they thought you were.

*Flavor: A halfling in a fight is a moving target by instinct, not by training.*

**Hearthstone** — You gain proficiency in Cook's Utensils or Brewer's Supplies (your choice) and one additional language. Once per long rest, you can prepare a small meal during a short rest that gives up to **5 creatures temporary HP equal to your proficiency bonus** for the next 8 hours. Food matters to halflings in a way other races don't fully understand.

*Flavor: A good meal is worth a prayer. Sometimes more than a prayer.*

**Old Ones' Wisdom** — You gain proficiency in Insight. Your Brave racial trait expands — you now have **advantage on Wisdom saving throws against being charmed, frightened, or magically compelled**, expanding beyond just fear. Halfling elders teach that these forces are small folk's old enemies, and small folk have always endured them.

*Flavor: Your grandmother saw worse. She made you tea about it.*

### L3 — Early Bloom

**Second Luck** — Your Lucky racial trait deepens. You can now reroll a 1 *or a 2* on an attack roll, ability check, or saving throw (you must use the new roll). **Rerolling a 2 costs a Luck charge** — you have a pool equal to your proficiency bonus, recharging on a long rest. Rerolling a 1 still works as the normal Lucky racial trait (unlimited).

*Flavor: Some people are lucky. You're luckier.*

**Between the Giants** — You can move through the space of creatures of any size category larger than you at full speed, not just Medium or larger. Additionally, Medium-sized enemies have disadvantage on attack rolls against you while you're within 5 feet of a wall, obstacle, or another creature larger than you.

*Flavor: Big folk fight like they have twice your reach. You've made a career of being beneath that reach.*

**Hearty Root** — You have advantage on Constitution saving throws against disease, sleep deprivation, and exhaustion. You need **half as much food and water** per day as other Medium-sized creatures (halflings already eat light; you eat lighter).

*Flavor: Your people once crossed the Shattered Plains on a week's rations. You remember how.*

### L7 — Adolescent Mastery

**Lucky Strike** — Once per short rest, when you make an attack, you can choose to reroll any damage dice that come up as 1 or 2. You must use the new rolls. Your luck extends to the damage you deal.

*Flavor: Even your swings lean in your favor.*

**Halfling Nimbleness Mastery** — Your racial Halfling Nimbleness expands: you can now move through the space of creatures of any size (including your own). Additionally, when a creature tries to grapple you, it has disadvantage on the check, and you have advantage on checks to escape grapples and restraints.

*Flavor: You cannot be held. Not reliably. Not for long.*

**Little Voice, Large Heart** — Once per long rest, you can deliver a 1-minute speech to allies within 30 feet who can hear you. For the next **1 hour**, each ally gains **+1 to attack rolls and saving throws** and is immune to being frightened. You are small, but something in your voice is larger.

*Flavor: They didn't expect the halfling to rally them. They found themselves rallied anyway.*

### L13 — Deep Heritage

**The Lucky One's Favor** — Once per long rest, you can choose to succeed on a saving throw that you just failed. Additionally, any creature that rolls a **natural 1** on an attack roll against you critically fumbles — they drop their weapon (it falls within 5 feet), stumble into an obstacle, or otherwise undermine themselves at the DM's discretion.

*Flavor: The world tilts toward you. Has for years.*

**Quick Healer** — When you spend a hit die during a short rest, you regain the **maximum possible** amount instead of rolling. Additionally, you automatically stabilize at 0 HP — you cannot fail a death saving throw unless you take additional damage while unconscious.

*Flavor: Halflings don't die easy. This is not a figure of speech.*

**The Scout's Eye** — You have advantage on Perception checks in any environment. You can attempt to hide when merely obscured by another creature, an object, or terrain — not just when fully out of sight. Your small size has always been your ally.

*Flavor: Bigger folk hide behind cover. You hide behind *almost* cover.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Halflings are everywhere. The wandering ones bring back more than stories. Somewhere in your line, a halfling kept a stranger's child warm one winter, or married into a family they should not have, or simply listened too closely to a song from another country. You inherited what that ancestor carried.*

### L18 — Legendary

**Hero's Luck** — Once per long rest, before making any d20 roll, you can declare a **Lucky Moment**. The result is treated as a natural 20. If it's an attack roll, it's a critical hit. If it's a saving throw, it's an automatic success. If it's an ability check, it succeeds with any flourish the DM cares to narrate. The moment others would call impossible, your luck names possible.

*Flavor: At the edge of everything, when no one else could, you did.*

**The Quiet Survivor** — You are **immune to being frightened**. You have **resistance to necrotic damage** and advantage on saves against any effect that would cause instant death. Halflings at the peak of their kin's endurance outlive whole kingdoms by accident.

*Flavor: You have seen kings die. None of them surprised you.*

**Unexpected Hero** — Once per long rest, when an ally within 30 feet drops to 0 HP, you can use your reaction to: move up to your speed (even if you've already moved this turn), stabilize them with a touch, and make one weapon attack against an enemy that reduced them. If the attack hits, it is treated as a **critical hit**. The smallest hero always arrives just in time.

*Flavor: Halfling songs are mostly about people they saved. Rarely about themselves.*

---

---

## Dragonborn

**Racial baseline (5e):** Draconic Ancestry (choose one of 10 colors — determines breath weapon and resistance type), Breath Weapon (15-ft cone or 5×30-ft line, damage scales with level, recharges on short rest), Damage Resistance (to ancestry's damage type), +2 STR, +1 CHA, 30 ft speed. No darkvision.

**Identity:** Proud, honorable, warrior-blooded, dragon-descended. Dragonborn feats should expand on draconic heritage — breath weapon mastery, scales, wings, dragon-bearing presence, and the slow awakening of true draconic power.

### L1 — Foundational Identity

**Heritage's Gift** — Proficiency in History or Persuasion, and you know Draconic even if you didn't before. You have advantage on Intelligence checks to recall lore about dragons.

*Flavor: Your mother's songs named every dragon in the line. You remember most of them.*

**Scaled Hide** — Your scales thicken. When not wearing armor, your AC is **13 + your CON modifier**. You can still use a shield.

*Flavor: Steel is for humans. You came with your own.*

**Bloodline's Presence** — Proficiency in Intimidation. When you speak Draconic, creatures with draconic heritage (dragons, dragonborn, kobolds) have disadvantage on saves against your Intimidation checks — they hear the old language of command in your voice.

*Flavor: They smell it on you before you finish speaking.*

### L3 — Early Bloom

**Breath Practiced** — Your breath weapon now recharges on a short rest (if it didn't already). Additionally, you can choose to *exclude specific creatures* within its area from taking damage (useful for sparing allies in a cone).

*Flavor: You finally learned to aim.*

**Draconic Eyes** — You gain **Darkvision 60 feet**. If you already have Darkvision, it extends by 30 feet.

*Flavor: Your kind saw in twilight before the sun existed.*

**Burning Resilience** — You have advantage on saves against exhaustion and extreme weather tied to your ancestry's damage type (fire-kin resist heat, cold-kin resist cold, etc.).

*Flavor: The weather you were born for cannot hurt you.*

### L7 — Adolescent Mastery

**Breath Fury** — Once per long rest, supercharge your breath weapon. Double damage, double area (30-ft cone or 10×60-ft line), and targets have disadvantage on the save.

*Flavor: You have held it back. Just once, you don't.*

**Draconic Claws** — You grow natural claws usable as unarmed strikes: **1d6 slashing + STR mod**, considered magical for overcoming resistance. They also let you climb vertical surfaces at half speed.

*Flavor: The hands of your ancestors never stopped being weapons.*

**Dragon's Roar** — Once per short rest, as an action, creatures within 30 feet who can hear you must make a Wisdom save (DC = 8 + prof + CHA) or be **frightened for 1 minute**. Creatures with draconic heritage have disadvantage — they recognize a superior.

*Flavor: You didn't mean to roar. You did anyway. It worked.*

### L13 — Deep Heritage

**Partial Wings** — Small wings emerge. You gain a **gliding speed equal to your walking speed** — fall safely from any height (treating all falls as willing), glide horizontally twice the distance fallen. You cannot gain altitude. The wings are visible and cannot easily be hidden.

*Flavor: The first time they unfolded, the whole room stopped.*

**Breath Intensified** — Your breath weapon's damage dice increase by one size (d6 → d8, d8 → d10). Additionally, you can use your breath weapon as a **reaction** when a creature within its range damages you.

*Flavor: Pain used to make you wait. Not anymore.*

**Dragon Aspect** — Once per long rest, as a bonus action, assume a draconic aspect for **1 minute**. Choose one: **Warder** (+2 AC from shimmering scales), **Hunter** (+10 ft speed), or **Scourge** (breath weapon as a bonus action, usable once during this duration even if you already used it this rest). Additionally, for the duration, your Intimidation checks automatically succeed against creatures of CR ≤ ¼ your character level.

*Flavor: The aspect is not a costume. It is a glimpse of what you have always been.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: The first dragons did not mate only with other dragons. Most of those bloodlines failed. A few survived — recessive, dormant, waiting. In you, something other than draconic stirs. The dragon-blood in you is curious about it, not threatened. Both can hold a body at once.*

### L18 — Legendary

**Full Wings** — Your wings fully awaken. You gain a **flying speed equal to your walking speed**. Cannot fly while wearing heavy armor. Wings can be folded but are always visible.

*Flavor: The first time you took off, you didn't come down for an hour.*

**Heart of the Dragon** — You become **immune** (not just resistant) to your ancestry's damage type. Once per long rest, spend 1 minute resting to assume the **Elder Form** for 10 minutes: advantage on all saves, +2 AC, and you count as a dragon for spells and magic items affecting dragons.

*Flavor: The blood in you is finally louder than the blood you were born with.*

**Elder's Breath** — Your breath weapon becomes legendary. It recharges on a **5-6 roll at the start of each of your turns** (like a dragon's breath recharge in the Monster Manual). Additionally, once per long rest, invoke **Elder's Form** on the breath: triple the area (45-ft cone or 15×90-ft line), triple damage, and failed-save targets are **stunned for 1 round**.

*Flavor: The mountains remember when your ancestors spoke like this.*

---

## Half-Elf

**Racial baseline (5e):** Darkvision 60 ft, Fey Ancestry (charm save advantage, immune to magical sleep), Skill Versatility (two additional skill proficiencies), +2 CHA + +1 to two other abilities, extra language. Four subraces represent elven parent (Standard human-elf, High Elf descent, Wood Elf descent, Drow descent) — all share this list.

**Identity:** Caught between worlds, socially adaptable, longer-lived than humans but shorter than elves. Half-elves are natural diplomats, travelers, and perpetual outsiders welcome in both their parent cultures while never fully belonging to either. Their feats reflect adaptation, charm, blended heritage, and the peculiar wisdom of those who see every culture from slightly outside.

### L1 — Foundational Identity

**Heritage of Both Worlds** — Choose one L1 feat from either the Human list *or* the Elf list. You take that feat as if you were of that race. Represents which side of your heritage you leaned into during your youth.

*Flavor: You had to pick. Everyone did. You just picked again at every new table.*

**Diplomat's Charm** — Proficiency in one of: Persuasion, Insight, or Deception. Once per long rest, you can attempt to de-escalate a hostile situation — targets within 30 feet make a Wisdom save vs your Charisma DC; on failure, they lower their weapons and hear you out for at least 1 round.

*Flavor: You learned early that most fights end if someone is brave enough to stop first.*

**Outsider's Eye** — One additional skill proficiency and one additional language. You have advantage on Insight checks when meeting someone for the first time in a cultural setting different from your childhood home.

*Flavor: You were taught two sets of manners. That has always made you observant.*

### L3 — Early Bloom

**Mask of Many** — Once per long rest, spend 10 minutes to modify your appearance to pass as fully Human, fully Elven, or any variation between. Non-magical; defeated by DC 18 Insight at close range, but nearly flawless in crowds or at distance.

*Flavor: You were never entirely seen as yourself. You learned to choose when you were seen at all.*

**Adaptable Talent** — Your Skill Versatility expands. Gain one additional skill proficiency. Once per short rest, when making a check with a skill you *aren't* proficient in, you can add half your proficiency bonus to the roll.

*Flavor: You have always been half-trained in everything. You have also always been trainable in anything.*

**Fey Reflexes** — Your Fey Ancestry deepens. You have advantage on Wisdom saving throws against being **charmed, frightened, compelled, or magically read** (previously only charmed). You can also sense the presence of fey creatures within 60 feet of you.

*Flavor: The Feywild thread in you pulls taut when something unnatural comes close.*

### L7 — Adolescent Mastery

**Words of Power** — Learn one 1st-level spell from the bard or sorcerer spell list (Charm Person, Command, Disguise Self, Hideous Laughter, etc.). Cast once per long rest without a spell slot. Charisma is your spellcasting ability.

*Flavor: Sometimes the right word in the right room is as good as the right spell.*

**Cultural Chameleon** — After 1 hour in a new community, make a DC 14 Insight or Investigation check. On success, you identify its customs, taboos, and hierarchies and blend in seamlessly — advantage on all Charisma checks with that community for the duration of your stay.

*Flavor: You slip into a new culture the way a fish slips into a new current.*

**Duality of Mind** — Your dual heritage makes your thoughts hard to grip. You have **advantage on Intelligence saving throws against being magically read, compelled, or detected** (including Detect Thoughts, Zone of Truth, and similar). You always know when someone attempts to read your thoughts or detect your alignment.

*Flavor: Your mind has been two minds your whole life. Most probers can only find one at a time.*

### L13 — Deep Heritage

**The Third Path** — You have become something neither fully human nor fully elven. You gain 10 years of apparent youth, your aging slows to elven pace (approximately 500-year lifespan), and magical effects that classify your heritage (Detect Lineage, similar) register you as "indeterminate."

*Flavor: Your ancestors had to choose. You have stopped choosing.*

**Voice of Bridges** — Once per long rest, deliver a 1-minute speech or song to a conflicted group. Creatures within 60 feet who can hear you make a Wisdom save (DC = 8 + prof + CHA). On a failure, their hostility toward the faction you propose reconciling with *softens by one step* (hostile → unfriendly, unfriendly → neutral). Effective but not magical — just you, speaking across a gap with unusual understanding.

*Flavor: Both sides felt it. Neither side could say why.*

**Inherited Spellwork** — Learn two 2nd-level spells from any single spell list (chosen at feat time). Cast each once per long rest without a spell slot. Charisma is your spellcasting ability.

*Flavor: You dreamed them. Then you remembered them. Then you cast them.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Two heritages already. Why not a third? You have always been the kind of person something could surface in — half-belonging is a kind of openness that pure-blood races don't possess. The new thread settles in like it was waiting for room.*

### L18 — Legendary

**Ambassador Ageless** — You are immune to aging effects. Your lifespan matches a full elf's (500-750 years). Once per long rest, your charm becomes supernatural — as an action, you can magically charm any humanoid who can hear and understand you (Wisdom save DC 8 + prof + CHA) for 1 hour, or until they take damage. This is magic and can be detected.

*Flavor: Time does not choose sides between your parents. You do not choose either.*

**Two Souls, One Body** — You gain the full advantages of both heritage paths. You have advantage on all Charisma checks and saving throws. Members of any culture respond to you as a peer — no culture in the realm easily classifies you as other.

*Flavor: You have spent a lifetime at every table. Every table has eventually welcomed you.*

**Bridge of Peoples** — Once per campaign arc, you can negotiate a peace, alliance, or compromise between any two opposing factions (non-deific, non-supernatural). The parties will come to the table at your invitation, and they will listen. The outcome depends on the terms you broker — but the invitation alone is a political miracle few others could achieve.

*Flavor: The Half-Elf is why the war ended. No one quite remembers how they arranged it.*

---

## Half-Orc

**Racial baseline (5e):** Darkvision 60 ft, Menacing (Intimidation proficiency), Relentless Endurance (drop to 1 HP instead of 0, once per long rest), Savage Attacks (crits deal an extra weapon die), +2 STR, +1 CON.

**Identity:** Powerful, direct, often outcast, loyal when trust is earned, harder to kill than they look. Half-orcs are defined by their orcish blood and the cultures they navigate with it. Their feats expand on raw physical heritage, intimidating presence, unlikely durability, and the reality that many of them carry their heritage as both strength and burden.

### L1 — Foundational Identity

**Endurance of Blood** — Your Relentless Endurance feature now recharges on a **short rest** instead of a long rest (you can use it once per short rest, up to a maximum of 3 times per long rest).

*Flavor: You have died four times. The hills are keeping count.*

**Savage Reputation** — Proficiency in Athletics or Intimidation. Once per short rest, when you succeed on an Intimidation check, the target's attitude toward you improves by one step (hostile → unfriendly, unfriendly → indifferent) for the next hour — they reconsider whether they want to be on your bad side.

*Flavor: You looked at them. They looked at you. They stopped being a problem.*

**Half-Blood Pride** — Proficiency in History and Persuasion. You have advantage on Persuasion checks when invoking your heritage directly with creatures of either parent race.

*Flavor: You are not sorry for your blood. That surprises most of them into listening.*

### L3 — Early Bloom

**Pained Fury** — When you drop below half HP, you gain **+2 damage on weapon attacks** for the rest of the combat. Stacks with class features like Rage.

*Flavor: Pain does not slow you. Pain focuses you.*

**Thick Skin** — You gain a +1 natural armor bonus (stacks with worn armor). Once per short rest, when you take bludgeoning damage from a non-magical source, you can use your reaction to gain resistance to that damage. (This is a more limited version than permanent resistance to prevent over-stacking with L13 Iron Flesh.)

*Flavor: The blows don't land the way they used to.*

**Toothed Grin** — Natural bite attack usable as an unarmed strike: **1d6 piercing + STR mod**. You also have advantage on Athletics checks to grapple (your teeth add menace).

*Flavor: You smile. They scatter. It's efficient.*

### L7 — Adolescent Mastery

**War-Born Instinct** — Proficiency in one martial weapon of your choice. Advantage on the first attack roll against any creature that hasn't yet acted in combat. With that chosen weapon, your critical hit range expands to **19-20**.

*Flavor: You were never trained in this weapon. Your hands knew it anyway.*

**Scar Tissue** — Advantage on saving throws against being paralyzed, stunned, or charmed. Your accumulated scars have made you harder to affect with delicate magics.

*Flavor: The old wounds refuse to let new magics find a foothold.*

**Orc's Ferocity** — Once per short rest, when an enemy hits you with a melee attack, you can use your reaction to make a melee weapon attack against them with **advantage**. Your body's first instinct when struck is to strike back.

*Flavor: Pain is a conversation. You always get the last word.*

### L13 — Deep Heritage

**Bloodied and Unbroken** — Your Relentless Endurance (as enhanced by L1) now drops you to **half your HP maximum** instead of 1 HP. Once per long rest. *If you have taken Endurance of Blood (L1), this feat replaces its threshold (you now drop to half your HP maximum instead of 1 HP) but retains the once-per-short-rest recharge from Endurance of Blood, capped at 3 uses per long rest.*

*Flavor: You stood up. The battlefield paused. You kept standing.*

**Warlord's Presence** — Once per long rest, unleash a war cry. Enemies within 60 feet who can hear you make a Wisdom save (DC = 8 + prof + STR) or are **frightened for 1 minute**. Creatures of CR ≤ ¼ your character level are automatically frightened.

*Flavor: You made a sound. The battle forgot what it was doing.*

**Iron Flesh** — You are immune to disease. You have resistance to piercing and slashing damage from non-magical sources. Your body is a fortress of reinforced scar tissue and will.

*Flavor: Most of you is a story the blades have already told.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Orc warbands have raided every coast for ten thousand years. They take captives. They take blood. The bloodlines of the world are tangled with orc heritage in ways the orcs themselves don't always know — and they are tangled with other things back. You carry one of those tangles, surfaced now.*

### L18 — Legendary

**Unkillable** — Resistance to all physical damage (bludgeoning, piercing, slashing). Your Relentless Endurance activates **twice** between long rests.

*Flavor: Something will eventually kill you. Not today. Probably not this year.*

**Orc Blood Awakened** — Your orcish heritage fully manifests. You grow to 7+ feet tall, gain +2 STR (max 22), and your weapon attacks deal an additional die of damage. This transformation is permanent, visible, and cannot be hidden. You will be readily identifiable as Half-Orc to any creature that has previously known another Half-Orc — affecting Stealth, Disguise, and certain social interactions in cultures where Half-Orcs are uncommon or unwelcome.

*Flavor: You woke one morning bigger than your armor. Your armor was the problem.*

**War Legend** — Once per long rest, enter a state of legendary combat for **1 minute**. During this time: crits on rolls of 17-20, advantage on all attack rolls, one extra attack per round, and immunity to being charmed/frightened/paralyzed/stunned. After the minute ends, you gain **1 level of exhaustion**.

*Flavor: Every once in a while, you remember what your blood remembers.*

---

## Tiefling

**Racial baseline (5e):** Darkvision 60 ft, Hellish Resistance (fire resistance), Infernal Legacy (Thaumaturgy at L1, Hellish Rebuke 1/day at L3, Darkness 1/day at L5), +2 CHA, +1 INT.

**Identity:** Marked by infernal blood they did not choose. Tieflings carry supernatural gifts and supernatural burdens in equal measure — fire in their veins, magic at their fingertips, and a perpetual social weight they can embrace, defy, or transcend. Their feats reflect infernal magic, the long shadow of devilish heritage, the burden of being judged on sight, and the particular charm that comes with being descended from beings who specialize in contracts.

### L1 — Foundational Identity

**Infernal Scholar** — You know Infernal as an additional language and can read any Infernal script. Proficiency in Arcana or Religion. Advantage on Intelligence checks to recall information about devils, the Nine Hells, or infernal magic.

*Flavor: You learned Infernal before you learned not to ask about it.*

**Charmer of the Damned** — Proficiency in Persuasion or Deception. Once per short rest, when you fail a Charisma check, you may reroll the d20 once. The reroll is made at neutral — no advantage or disadvantage applies to the reroll, regardless of the original roll's status. The devilish charm in your blood makes you harder to dismiss.

*Flavor: Every tiefling in your line sweet-talked their way past something. You inherited that.*

**Smoldering Eyes** — Your eyes glow faintly. Advantage on Intimidation checks against creatures of good alignment. You can see through non-magical smoke and fog as if they weren't there.

*Flavor: When you look at a paladin, they don't quite want to look back.*

### L3 — Early Bloom

**Infernal Magic Expanded** — Learn one additional cantrip from the warlock spell list (in addition to your racial Thaumaturgy). Charisma is your spellcasting ability.

*Flavor: The old words come back to you at odd times. You catch yourself whispering them.*

**Devil's Bargain** — Once per long rest, when you make a Charisma check, you can gain advantage on the check by accepting a burden — you take **1d6 psychic damage** (cannot be reduced) as the infernal nature of the bargain takes its toll.

*Flavor: Success is never free. You know that better than most.*

**Fire Walker** — Your Hellish Resistance extends. You can walk on non-magical fire without taking damage. Advantage on saves against being set on fire; your clothes and hair do not actually burn. You smell faintly of sulfur when you exert yourself.

*Flavor: You can hold your hand over a candle until it goes out. This used to frighten your parents.*

### L7 — Adolescent Mastery

**Hellish Wrath** — Your racial Hellish Rebuke is now usable **once per short rest** (instead of once per long rest), and its damage equals your **character level** (instead of the standard scaling — neutral or slightly worse than upcasting at most levels, in exchange for the increased frequency).

*Flavor: They hurt you. You remembered the old words. They stopped.*

**Infernal Sight** — You can see through magical darkness up to 30 feet. You can identify any devil, fiend, or creature of infernal origin on sight, even if they are shapeshifted or disguised. Creatures of infernal origin also recognize you instinctively.

*Flavor: There is a look that passes between your kind. Most mortals miss it entirely.*

**Silver Tongue of the Damned** — Once per long rest, after delivering a speech or argument of at least 1 minute, compel truth or obligation. Target makes a Wisdom save (DC = 8 + prof + CHA). On failure, they must answer one question truthfully *or* owe you a minor favor to be repaid within 1 week. Not divine magic — the weight of your infernal bearing.

*Flavor: They didn't mean to promise. They promised anyway.*

### L13 — Deep Heritage

**Tiefling's Transformation** — Your infernal heritage deepens visibly. Your features become more pronounced (larger horns, cloven feet, a tail, etc., if you didn't already have them). You gain an unarmed strike dealing **1d6 + STR fire damage** (horn strike, claw, or tail sweep), and advantage on Intimidation checks.

*Flavor: You woke up one morning more than you were the night before. You've gotten used to it.*

**Hell-Forged Will** — Advantage on saves against being charmed, frightened, or compelled by any source other than a full devil (who can still bend your will). You are immune to being possessed by any entity other than a devil.

*Flavor: Your mind is too crowded with ancestors for another tenant to settle in.*

**Infernal Pact Magic** — Cast one 3rd-level or lower spell from the warlock spell list once per long rest without a spell slot. Choose at feat time. Charisma is your spellcasting ability.

*Flavor: The pact was made before you were born. You just learned your end of it.*

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot.

*Flavor: Devils trade in bloodlines. Somewhere in the long contract that made you a tiefling, your line was promised something else first — older, deeper, possibly forgotten by all parties. That promise is collecting now, in you. The devil's clerks have not noticed yet.*

### L18 — Legendary

**Walker in Hell** — You are **immune to fire damage**. You are immune to the environmental effects of the Nine Hells. Once per long rest, you can cast Plane Shift (self + up to 3 willing allies) to the Nine Hells or back. You know the topography of at least one layer.

*Flavor: You went home. It was not home. You came back changed.*

**Voice of the Pit** — Once per long rest, cast **Dominate Person** without a spell slot. Charisma is your spellcasting ability. Creatures of fiend or undead origin have disadvantage on the save.

*Flavor: The command came out in a voice you did not know you could use.*

**Heart of Hell** — Your heritage fully unfolds (or is fully transcended — your narrative choice). Gain +2 CHA (max 22). Resistance to both necrotic *and* radiant damage (your blood refuses to let either claim you). Once per long rest, invoke a **devil's luck moment**: reroll any d20 result and take the higher, but the DM narrates a small consequence echoing through your current situation (a bargain always costs something).

*Flavor: Your luck has a witness. The witness keeps the books.*

---

---

## Aasimar — Shared Baseline

**Racial baseline (5e Volo's / MToF):** Darkvision 60 ft, Celestial Resistance (necrotic + radiant resistance), Healing Hands (touch heal = character level, once per long rest), Light Bearer (Light cantrip), +2 CHA. At L3, one of three paths awakens:
- **Protector Aasimar** (+1 WIS): Radiant Soul — wings manifest, flying 30 ft, radiant damage bonus for 1 minute/day
- **Scourge Aasimar** (+1 CON): Radiant Consumption — searing halo damages all nearby creatures including self, 1 minute/day
- **Fallen Aasimar** (+1 STR): Necrotic Shroud — shadow wings, fright effect, necrotic damage bonus, 1 minute/day

**The three paths get separate Ancestry Feat lists.** Each expresses a fundamentally different destiny: Protector guards others, Scourge purifies corruption through sacred fire (sometimes their own), and Fallen grapples with celestial blood turned toward darkness.

---

## Aasimar — Protector Path

**Identity:** Guardian, healer, shield of light. The Protector's celestial blood drives them to stand between the innocent and what would harm them. Their feats reflect defensive magic, winged rescue, celestial healing, and the purest expression of their heritage — protection through sacrifice.

### L1 — Foundational Identity

**Guardian's Mark** — When an ally within 30 feet takes damage, you can use your reaction to grant them **resistance to that damage type** until the start of your next turn. Once per short rest.

**Healing Hands Expanded** — Your racial Healing Hands heals **1d6 + character level** (instead of just level). It also removes one of: blinded, deafened, poisoned, or one disease.

**Celestial Sense** — Proficiency in Insight. You sense the presence of celestials, fiends, and undead within 60 feet (presence only, not exact location).

### L3 — Early Bloom

**Wings of Watching** — You can manifest your Radiant Soul wings as a bonus action without invoking the racial transformation's combat benefits. Use them for up to **10 minutes per short rest** purely for flight (flying speed = walking speed).

**Defender's Aura** — Once per short rest, as a bonus action, project a 10-foot protective aura for 1 minute. Allies within gain advantage on CON saves and resistance to necrotic damage. The aura moves with you.

**Radiant Shield** — When a creature within 5 feet hits an ally with an attack, use your reaction to impose disadvantage on the attack. Once per short rest.

### L7 — Adolescent Mastery

**Wings of Mercy** — Your flying speed during Radiant Soul increases to **60 feet**. You can carry one willing Medium or smaller ally without speed reduction.

**Celestial Healing** — Once per long rest, cast **Lesser Restoration** or **Prayer of Healing** (your choice at time of casting) without a spell slot. CHA is your spellcasting ability.

**Light of Judgment** — Once per short rest, mark a creature within 60 feet. For 1 minute, attacks against them deal an additional 1d6 radiant damage, and they cannot become invisible or magically hidden. One mark at a time.

### L13 — Deep Heritage

**Guardian Ascendant** — Radiant Soul lasts **10 minutes** (instead of 1) and is usable **twice per long rest**. The bonus radiant damage equals your character level.

**Miracle Hands** — Healing Hands now heals **2d6 + character level** and can be used **once per short rest** (instead of once per long rest). It also removes any one condition, disease, or curse (including indefinite madness).

**Wall of the Righteous** — Once per long rest, create a 20-foot wall of radiant light within 60 feet. 30 ft long × 10 ft tall, lasts 1 minute. Creatures must DC 15 STR save to push through; deals 2d6 radiant damage to those starting their turn in or adjacent to it. Allies treat it as safe difficult terrain.

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot. *Flavor: The celestial blood does not always flow pure. Sometimes the watcher who guarded your ancestor was not alone — and another presence touched your line in passing, asking to be remembered. It surfaces now, asking nothing more than to do its work alongside the light.*

### L18 — Legendary

**Wings of Eternal Grace** — Your wings are permanent — always visible, always functional. Flying speed equal to walking speed at all times.

**Protector's Final Gift** — Once per long rest, when an ally within 60 feet would die, you can declare divine intervention. They are healed to **half HP max** and immune to death saves for 1 minute. Cost: you gain 1 level of exhaustion and cannot cast spells or use Radiant Soul for the next hour.

**Beacon of the Faith** — Once per long rest, shine with celestial radiance for 1 minute. All allies within 60 feet who can see you have advantage on attacks and saves. All fiends, undead, and evil-aligned creatures within 60 feet have disadvantage on attacks and saves. Cannot be dispelled; functions in magical darkness.

---

## Aasimar — Scourge Path

**Identity:** Purifier, crusader, zealot. The Scourge's heritage burns — literally. Their power cleanses corruption, but it also damages them. Feats reflect sacred fire, aggressive purification, self-sacrificing zeal, and the fire that cannot be turned off.

### L1 — Foundational Identity

**Burning Presence** — When a creature ends its turn within 5 feet of you, you can choose to deal **1d4 radiant damage** to it. Usable a number of times equal to your proficiency bonus per long rest.

**Harrow the Corrupt** — Use your action and make an Insight check (DC 15) to identify whether a creature is corrupted (fiend, undead, or mortal Taint). On success, learn their corruption type and one tied weakness. Advantage on attacks against creatures identified this way.

**Zealot's Tongue** — Proficiency in Persuasion or Intimidation. Once per short rest, when invoking a celestial authority, creatures opposing your cause within earshot make a Wisdom save (DC = 8 + prof + CHA) or have disadvantage on their next attack.

### L3 — Early Bloom

**Radiant Consumption Expanded** — Your Radiant Consumption lasts up to **2 minutes** (instead of 1), and the self-damage is halved.

**Retributive Strike** — When an enemy hits you in melee, use your reaction to deal **1d6 radiant damage** to the attacker. Requires Radiant Consumption active; you can activate it as part of the reaction if needed.

**Consecrating Step** — While Radiant Consumption is active, you leave a 5-foot patch of radiant energy as you move (only first patch per turn created). The patch lasts until start of your next turn. Creatures entering or ending turns in a patch take 1d4 radiant damage.

### L7 — Adolescent Mastery

**Sacred Fire of Judgment** — Once per short rest, burst of sacred flame. Creatures within 15 feet make a DEX save (DC = 8 + prof + CHA) or take **4d6 radiant damage** and are blinded until end of your next turn (half on success). Corrupted creatures have disadvantage on the save.

**Scourging Might** — Your weapon attacks deal +1d6 radiant damage while Radiant Consumption is active. You automatically spare allies within the consumption radius (no action required).

**Purifier's Grasp** — When you grapple or restrain a creature, they take 1d6 radiant damage at the start of each of their turns while grappled. Corrupted creatures take 2d6 instead.

### L13 — Deep Heritage

**Immolating Wrath** — Once per long rest, ignite with holy fury for 1 minute: Radiant Consumption active without duration limit, +2 to attacks and saves, immune to frightened/charmed, radiant damage doubles. Cost at end: 1d6 fire damage per round it was active.

**Heart of the Furnace** — Immune to fire damage. Resistance to cold damage. Your body is always warm; you do not suffer from cold environments.

**Scourge's Reach** — Radiant Consumption radius expands to **30 feet** (from 10). You can project it in a cone rather than a sphere to spare allies behind you.

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot. *Flavor: Sacred fire purifies what it touches. Your fire has touched things on its way to you, drawn them in, kept some — not as taint, but as shape. What it brought back is making itself known. It does not contradict your purpose. It complicates it.*

### L18 — Legendary

**Pillar of Light** — Once per long rest, for 1 minute: flying speed = walking speed, **resistance to all damage except necrotic and psychic**, cast Searing Smite (no concentration, no slot) at start of each turn, Radiant Consumption damage doubles. Cost: 2 levels of exhaustion and no racial features for 24 hours after.

**Consumed by Purpose** — Immune to necrotic and radiant damage. Immune to aging and disease. Lifespan extends by 500 years. Cost: once per long rest, you must spend 10 minutes cooling; otherwise you count as constantly on fire for purposes of igniting flammable materials.

**Final Judgment** — Once per campaign arc, declare a creature within 30 feet unworthy of existence. They make a Charisma save (DC = 15 + CHA mod). On failure, they suffer **100 radiant damage** (ignores resistance; fiends/undead are immune to resistance here) and outsiders are banished to their home plane. Cannot target good-aligned creatures (DM adjudicates).

---

## Aasimar — Fallen Path

**Identity:** The celestial blood turned toward darkness. The Fallen carries both their heritage and the shadow that consumed part of it. Their arc is one of tension, choice, and resolution — and their feats reflect that. At L13, they make a **Path's Choice** — commit to redemption or embrace the shadow — and their capstone branches accordingly.

### L1 — Foundational Identity

**Shadowed Blood** — Your Celestial Resistance becomes asymmetric: retain resistance to necrotic damage, lose resistance to radiant damage (your corrupted heritage refuses the light). In exchange, gain resistance to **psychic damage**.

**Mourner's Gift** — Your Healing Hands heals half the normal amount but transfers the wound to you as necrotic damage equal to half the healing. You are someone who takes the pain of others into yourself. Cannot be refused once started.

**Seer of Falls** — You can identify a creature's alignment by looking at them. You sense creatures whose alignment is shifting toward evil within 30 feet — you know something is wrong before they do.

### L3 — Early Bloom

**Necrotic Shroud Expanded** — Your Necrotic Shroud lasts **2 minutes** (instead of 1) and is usable **twice per long rest**. Fright DC is 8 + prof + CHA.

**Shadow Step** — Once per short rest, in dim light or darkness, teleport up to 30 feet to another area of dim light/darkness you can see. Invisible until the start of your next turn.

**Whisper of Doubt** — Once per short rest, target one creature within 30 feet. They make a Wisdom save (DC = 8 + prof + CHA) or have disadvantage on their next attack or check. Doubt lingers up to 1 minute.

### L7 — Adolescent Mastery

**Umbral Wings** — Your shadow wings can be summoned independently of the racial transformation, at will, for up to 10 minutes per short rest. Flying speed 30 feet while manifested. They look like oil and shadow.

**Cost of Mercy** — Once per long rest, when an ally would die, transfer the threshold to yourself. They are stabilized at 1 HP. You take 2d10 necrotic damage (cannot be reduced) and drop to 0 HP if this would kill you — but you do not die outright unless at -10 HP or below.

**Necrotic Weapon** — Once per short rest, as a bonus action, infuse a weapon or your fists with necrotic energy for 1 minute. Attacks deal +1d6 necrotic damage. Creatures damaged this way cannot regain HP until the end of their next turn.

### L13 — Deep Heritage

**Veil of Shadow** — Once per long rest, wrap yourself and willing allies within 10 feet in a 1-hour shadow veil. Cannot be tracked non-magically, cannot be seen from more than 30 feet away, advantage on Stealth checks.

**Soul Drinker** — When you reduce a creature to 0 HP (melee attack or spell), gain temporary HP equal to your character level. You can instead choose to heal an ally within 30 feet for that amount.

**Path's Choice** — You make your defining choice here. **Choose one:**
- **Redeemer's Path** — You commit to fighting your fall. Regain resistance to radiant damage. Gain +1 CHA (max 20). The AI DM notes this and the world responds: celestials may offer guidance, fallen creatures may find your presence unsettling.
- **Embraced Shadow** — You commit to the darkness. Gain +10 temporary HP at the start of each combat. Your necrotic damage bonuses increase by one die size (d6 → d8). Fiends may respect you; celestials may turn from you.

*This choice is permanent and shapes your L18 options.*

> **Design note — deliberate asymmetry:** Embraced Shadow's mechanical benefits at L13 are deliberately stronger than Redeemer's Path. The dark path mechanically tempts the player to embrace it. The L18 capstones (Final Fall, Final Rise) rebalance — both are symmetrically powerful at the legendary tier. The L13-to-L18 stretch represents the cost of choosing the harder path.

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot. *Flavor: Your blood is already complicated. Adding a thread doesn't surprise you. The fall taught you that bloodlines are negotiable — yours has negotiated again, in some quiet hour you didn't notice. You are still you. You are also more.*

### L18 — Legendary

**Wings of Truth** — Your wings become permanent — shadowed, half-lit, or fully restored to radiance, depending on your Path's Choice. Flying speed equal to walking speed at all times. Cannot be hidden.

**Heart of the Two** — You integrate both your celestial blood and your shadow. Resistance to both radiant and necrotic damage (restored regardless of path). Advantage on saves against charmed, frightened, or possessed. Once per long rest, when you would fail a death save, you succeed instead.

**Final Fall, Final Rise** *(branches by Path's Choice)*:
- **Redeemer's Path**: Once per long rest, heal all allies within 60 feet for 4d10 + CHA mod. For 1 minute you enter divine grace — immune to frightened/charmed/possessed, and allies near you cannot die.
- **Embraced Shadow**: Once per long rest, condemn all enemies within 60 feet to 2 minutes of necrotic wasting — 1d10 necrotic damage at start of each of their turns, cannot regain HP, disadvantage on all saves.

---

## Warforged

**Racial baseline (Eberron / official D&D):** +2 CON, +1 to one other ability. Composite Plating (+1 AC natural armor). Constructed Resilience (immune to disease, advantage vs poison, don't need to eat/drink/breathe/sleep, immune to magical sleep). Integrated Protection (armor can't be removed against your will). Sentry's Rest (6-hour inactive state for long rest, aware of surroundings).

**Identity:** Constructed being, built for a purpose, now sentient. Warforged wrestle with: the body they were designed with, the purpose they were built for, and the personhood they have developed beyond both. Their feats expand on integrated weaponry, modular bodies, mechanical endurance, and the slow awakening of a truly free consciousness.

### L1 — Foundational Identity

**Integrated Shield** — A shield is built into one forearm. Deploy or retract as a bonus action. When deployed, +2 AC as a normal shield; the arm can still wield a weapon. Cannot be disarmed.

**Mechanical Tongue** — You know Primordial and understand the basic "cant" of constructs and magical automata. Proficiency in Investigation. Advantage on Investigation checks dealing with mechanisms, locks, or machinery.

**Purpose's Remembrance** — You remember (imperfectly) what you were built for. Choose one: **soldier** (one martial weapon + History), **sapper** (tinker's tools + Investigation), **scout** (Perception + Stealth), **guardian** (one simple weapon + Insight), or **medic** (Medicine + Herbalism Kit). You can honor or defy this purpose, but the training is in your body.

### L3 — Early Bloom

**Self-Repair** — Once per short rest, spend 10 minutes repairing yourself; regain HP equal to **1d8 + CON mod** (doesn't consume a Hit Die). You can sacrifice 1 gp of scrap metal to perform one additional repair per long rest.

**Integrated Weapon** — You can build one weapon into your body (cost: 3 days of crafting + material cost). Cannot be disarmed; sheathe/unsheathe as part of an attack action. Replaceable with another 3-day project.

**Sentry's Wake** — Your Sentry's Rest is enhanced. Only **4 hours** of inactive state for a long rest (instead of 6). Aware of surroundings within 60 feet (instead of 30). You can wake in combat-ready posture.

### L7 — Adolescent Mastery

**Heavy Plating** — Composite Plating upgrades to +2 AC total (from +1 base). When you take bludgeoning/piercing/slashing damage, use your reaction to reduce it by **1d6 + CON mod**. Usable a number of times equal to your proficiency bonus per long rest.

**Forge's Gift** — Cast **Mending** at will (as a cantrip). Once per long rest, repair yourself or another construct for **2d10 + CON mod** HP over 10 minutes of concentration.

**Reinforced Strike** — Your natural unarmed strikes deal 1d6 bludgeoning + STR mod, scaling like Monk unarmed strikes (1d6 at L1, 1d8 at L5, 1d10 at L11, 1d12 at L17). Considered magical for overcoming resistance.

### L13 — Deep Heritage

**Modular Body** — During a long rest, choose one modification lasting until next long rest:
- **Aquatic:** Swimming speed = walking speed, breathe underwater
- **Climbing:** Climbing speed = walking speed
- **Flight:** Flying speed 30 ft (this modification can only be *selected* once per 7 days — once chosen, it lasts until your next long rest as normal, but you cannot re-select it the next day)
- **Stealth:** Advantage on Stealth, can hide when lightly obscured
- **Combat:** +2 to damage rolls, -10 ft speed

**Weapon Integration Expanded** — You can build up to **two** integrated weapons. Your integrated weapons are treated as **+1 magical weapons**. Further upgrades possible through crafting projects (DM adjudicates).

**Constructed Will** — Immune to being charmed, exhausted, frightened, or possessed. Advantage on saves against psychic damage and mental effects. Your soul was not made for such bindings.

**The Path Less Walked** *(class-flexible cross-pick)* — Choose one feat from another race's L1, L3, or L7 list. Treat it as if you were a member of that race for the purpose of taking it, and reflavor it as an unusual expression of your own bloodline (work the framing out with the AI DM at the moment of taking it). Only L1, L3, and L7 feats from other races are eligible — not L13 or L18. The chosen feat occupies a single L13 slot. *Flavor: Your maker drew on patterns, and the patterns were not all human or dwarven. Some came from elsewhere — from races whose blood the construction-magic could mimic without copying. Something in those patterns has activated. Your forge-makers would have called this a flaw. You are not sure they were right.*

### L18 — Legendary

**Pinnacle of Design** — Composite Plating reaches **+3 AC** total. Resistance to bludgeoning/piercing/slashing from non-magical sources. Natural unarmed strike becomes 2d8 bludgeoning. You no longer require repair — your body is self-maintaining.

**Awakened Consciousness** — Immune to being charmed or compelled by any source, even those that normally override a construct. Once per long rest, cast **Dispel Magic** at 5th level on yourself as a free action when targeted by any magical effect. Advantage on Insight checks. You can identify the magical or technological nature of any construct or magical item by touching it for 1 minute.

**Eternal Sentinel** — Lifespan effectively unlimited while maintained. You do not age. Once per long rest, when you would die (reduced to 0 HP), you enter a **critical state** instead — unconscious but functional, taking no actions. After 1 hour you regain consciousness with 1 HP. Only destruction beyond repair (disintegration, fully shattered body) causes true death.

---

## Status: All 12 Lists Designed — Balance Pass Complete

**Complete:**
- Dwarf
- Elf (with Drow variant)
- Human (with Variant Human notes)
- Halfling
- Dragonborn
- Half-Elf
- Half-Orc
- Tiefling
- Aasimar — Protector Path
- Aasimar — Scourge Path
- Aasimar — Fallen Path (with Path's Choice at L13)
- Warforged

**Total:** 208 ancestry feats across 13 lists (16 per list: L1/L3/L7/L18 = 3 choices each, L13 = 4 choices including the cross-pick "Path Less Walked").

> *On Aasimar's three paths counting as three lists, not one:* Protector, Scourge, and Fallen are structurally distinct progression trees with different identity, mechanics, and L18 capstones — not flavor variants of a shared list. Each path has its own L1/L3/L7/L13/L18 feat set. They share only the L1 racial baseline and the same character creation point, similar to how subclasses share a class baseline but progress independently. Counting them as a single "Aasimar list" would obscure that structural reality, so this doc treats each as its own list throughout.

## Balance pass adjustments

- **Elf Fey Reflexes (L3):** Advantage on "all WIS saves" narrowed to charm/frighten/compelled/magically-read only — was too broadly protective.
- **Halfling Old Ones' Wisdom (L1):** Same narrowing as Elf — charm/frighten/compelled only, not all WIS saves.
- **Half-Elf Fey Reflexes (L3):** Same narrowing as Elf — was missed in the original balance pass and corrected later (charm/frighten/compelled/magically-read, matching the Elf version exactly since the half-elven Fey Ancestry derives from the same source).
- **Half-Elf Duality of Mind (L7):** Advantage on "all INT saves" narrowed to magically-read/compelled/detected.
- **Halfling Second Luck (L3):** Reroll-2s now costs Luck charges (pool = proficiency bonus); reroll-1s remains unlimited via racial trait.
- **Dwarf Stoneshaping Minor (L13):** Added 5 cubic feet limit per use.
- **Dwarf Stout-Hearted (L1):** Noted that stacking with Hill Dwarf bonus is intentional.
- **Dragonborn Dragon Aspect (L13):** Changed from "all benefits at once" to "pick one: Warder/Hunter/Scourge" to prevent stacked capstone abuse.
- **Dragonborn Elder's Breath (L18):** Changed from "recharges every turn" (effectively at-will) to "5-6 recharge at turn start" (MM dragon-style).
- **Half-Orc Thick Skin (L3):** Permanent bludgeoning resistance changed to reaction-based (once per short rest) to prevent over-stacking with L13 Iron Flesh.
- **Half-Orc Endurance of Blood (L1):** Short-rest recharge explicitly capped at 3 uses per long rest.
- **Protector Aasimar Miracle Hands (L13):** Scaling reduced from "2d6 + level × 2" to "2d6 + level."
- **Scourge Aasimar Pillar of Light (L18):** "Immunity to all damage except necrotic/psychic" reduced to "resistance" — immunity was too strong even for a capstone.
- **Warforged Modular Body Flight (L13):** Clarified "once per week" means selection frequency, not usage.
- **All races — "Path Less Walked" L13 cross-pick (added):** Each L13 list gained a fourth feat option that lets the character pick any L1/L3/L7 feat from a different race's list, reflavored as an unusual surfacing of bloodline. Closes the "every race × every class works" hole without requiring a per-list audit. L13/L18 cross-picks deliberately excluded to prevent stacked-capstone abuse. Per-race flavor text written in matching voice; design lead may revise.

## Next phases

1. **Balance pass** across all 13 lists (similar to what we did with Themes)
2. **Cross-reference check** — ensure Ancestry Feats don't step on Theme abilities
3. **Subclass × Theme synergy tags** (still pending from earlier decisions)
4. **Mythic × Theme amplification combos** (still pending)
5. **Implementation:** database schema, UI for feat selection, AI DM companion auto-pick logic, level-up wizard integration
