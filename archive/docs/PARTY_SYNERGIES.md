# Party Synergies Design

Status: In review — three-tier synergy system covering gear, identity, and trained tactics.

## Overview

Party Synergies are mechanical bonuses that activate when two or more characters coordinate effectively. The system has **three distinct tiers**, each representing a different source of coordination:

1. **Gear & Positioning Synergies** — What you're carrying and where you're standing
2. **Theme Synergies** — Who you are (lived experience, shared identity)
3. **Team Tactics** — What you've practiced together (explicit shared training)

Inspired by Pathfinder 1e's **Teamwork Feats** (Outflank, Coordinated Maneuvers, Lookout, Shake It Off), but expanded into a layered model so that any party — not just those with compatible Themes — can build meaningful tactical coordination.

## The three tiers compared

| Tier | Source | Activation | Duration/Availability |
|------|--------|------------|----------------------|
| **Tier 1: Gear & Positioning** | Equipment + tactical position | Automatic when conditions met | Always available if you have the gear |
| **Tier 2: Theme** | Shared identity/background | Automatic when trigger conditions met | Always available if Theme pair is in party |
| **Tier 3: Team Tactics** | Explicit shared training during downtime | Automatic when trigger conditions met | Must be learned; both characters must know it |

### A practical example

A Knight Fighter (Soldier Theme) and a Cleric (Acolyte Theme) both carrying shields could use:
- **Tier 1 Shield Wall** (both have shields, adjacent)
- **Tier 2 Faith in Steel** (Acolyte heals → Fighter's next attack has advantage)
- **Tier 3 Coordinated Guard** (if they trained it) — reaction to impose disadvantage when ally is attacked

## Activation model

**Synergies are triggered, not activated.** They fire automatically when narrative conditions are met:
- Both characters take a qualifying action in the same round (or during the same encounter, for out-of-combat synergies)
- The condition is met organically — not by spending resources, actions, or reactions

**AI companions choose whether to engage.** Even though a synergy exists between two Themes, the AI companion character *chooses* whether to take the qualifying action based on their personality, current goals, and combat priorities:
- A loyal cleric companion with Acolyte Theme will reliably coordinate with the party's Sage on research
- A reckless barbarian companion with Soldier Theme might *not* set up flanking synergies because they prefer to charge alone
- This makes companion personality **mechanically meaningful** — the player learns which companions reliably play into synergies, and absences matter because losing a Synergy partner removes options the party had come to rely on

**Range:** Unless otherwise specified, synergies require both characters to be within 60 feet of each other and aware of each other's actions.

## The hybrid model

**Signature Synergies** (this document) — 30-40 authored, named synergies for the most compelling Theme pairs. These have distinct mechanical effects, names, and flavor text.

**Generative Synergies** (tag-based, handled by AI DM) — any Theme pair not covered by a Signature Synergy can still generate synergy moments based on shared compatibility tags. The AI DM identifies the shared tag and narrates a small bonus (advantage on a check, a bonus die, extra information, etc.).

---

## Compatibility Tags per Theme

Each Theme has 3-5 tags. When two Themes share a tag, the AI DM can generate synergy moments based on that shared identity.

| Theme | Tags |
|-------|------|
| Soldier | discipline, tactics, combat, leadership, duty |
| Sage | knowledge, research, analysis, patience |
| Criminal | stealth, infiltration, urban, underworld, deception |
| Acolyte | faith, healing, community, ritual, guidance |
| Charlatan | deception, identity, manipulation, performance |
| Entertainer | performance, crowd, spectacle, emotion |
| Noble | authority, politics, hierarchy, diplomacy |
| Outlander | wilderness, survival, nature, tracking |
| Sailor | sea, weather, crew, navigation, storms |
| Far Traveler | culture, observation, adaptation, outsider |
| Haunted One | darkness, supernatural, trauma, fear, resilience |
| Guild Artisan | craft, commerce, materials, quality |
| Clan Crafter | craft, materials, tradition, heritage |
| Hermit | solitude, meditation, truth, self-sufficiency |
| Investigator | deduction, observation, evidence, mystery |
| City Watch | urban, authority, community, peacekeeping |
| Knight of the Order | oath, honor, authority, combat, cause |
| Mercenary Veteran | combat, pragmatism, survival, contract |
| Urban Bounty Hunter | pursuit, urban, tracking, patience |
| Folk Hero | community, commoners, courage, legend |
| Urchin | stealth, urban, survival, overlooked |

**Common shared tags** create the natural synergy spaces:
- `combat` (Soldier, Knight, Mercenary Veteran) — battlefield coordination
- `urban` (Criminal, City Watch, Urban Bounty Hunter, Urchin) — city work
- `craft` (Guild Artisan, Clan Crafter) — making things
- `community` (Acolyte, City Watch, Folk Hero) — protecting people
- `stealth` (Criminal, Urchin) — shared underworld
- `deception` (Criminal, Charlatan) — the art of the con
- `tracking` (Outlander, Urban Bounty Hunter) — finding things (or people)
- `performance` (Entertainer, Charlatan) — putting on a show
- `authority` (Noble, City Watch, Knight of the Order) — official presence
- `materials` (Guild Artisan, Clan Crafter) — understanding substance

---

# TIER 1: Gear & Positioning Synergies

Universal synergies that activate based on shared equipment or tactical positioning. **No Theme required, no training required.** If two characters meet the conditions, they activate automatically. These are the synergies available to *any* party, regardless of composition.

### G1. Shield Wall
- **Participants:** Any two characters with shields
- **Trigger:** Both end their turn adjacent (within 5 feet) to each other
- **Effect:** Both gain +2 AC until the start of their next turn. When one takes damage from a melee or ranged attack, the other can use their reaction to impose disadvantage on the attack roll.
- **Flavor:** Two warriors fall into a formation as old as war itself. Shields raised, shoulders nearly touching.

### G2. Volley
- **Participants:** Any two characters making ranged attacks
- **Trigger:** Both attack the same target in the same round, with ranged weapons
- **Effect:** The second attack gains +1 to hit. If both attacks hit, the target has disadvantage on its next saving throw.
- **Flavor:** One arrow in flight. Another following. Targets learn too late that the first was not alone.

### G3. Spell Convergence
- **Participants:** Any two spellcasters
- **Trigger:** Both cast a spell of the same school at the same target in the same round
- **Effect:** The second spell's save DC is increased by +1. If both spells force saving throws, the target has disadvantage on the second save.
- **Flavor:** Magic does not mind sharing. Two conjurations, two evocations, two enchantments — the weave answers both voices.

### G4. Back to Back
- **Participants:** Any two characters
- **Trigger:** Both are adjacent to each other and surrounded by 3 or more enemies within 10 feet
- **Effect:** Both gain advantage on Perception checks while surrounded, and neither can be flanked. Enemies do not gain advantage from flanking these two while they remain adjacent.
- **Flavor:** When the crowd closes in, the instinct is older than civilization: find someone you trust, turn your back to theirs, and fight.

### G5. Mounted Charge
- **Participants:** Any two mounted characters
- **Trigger:** Both charge the same target (moving at least 20 feet in a straight line before attacking)
- **Effect:** The first attack to hit deals an extra die of the weapon's damage. The target, if size Medium or smaller, must succeed on a Strength save (DC 13) or be knocked prone.
- **Flavor:** The ground shakes. Then they arrive.

### G6. Silent March
- **Participants:** Any two or more characters, none wearing heavy armor, all proficient in Stealth
- **Trigger:** The group attempts to move together stealthily
- **Effect:** Roll a single group Stealth check using the *highest* modifier among the group (not the lowest, as is standard). The group moves as one silent unit.
- **Flavor:** One learns to move. Two learn to move *together*. The forest doesn't hear them. Neither do the guards.

### G7. Healer's Ward
- **Participants:** Any healer (character casting a healing spell) + any wounded ally
- **Trigger:** Healer casts a healing spell on an ally below half HP
- **Effect:** The healing restores an additional amount equal to the healer's spellcasting ability modifier (minimum +1). This stacks with existing class features that buff healing.
- **Flavor:** When the need is greatest, the prayer carries further.

### G8. Two-Weapon Formation
- **Participants:** Any two characters dual-wielding melee weapons
- **Trigger:** Both are adjacent to each other and attack in the same round
- **Effect:** Both gain +1 to damage on their off-hand attacks for the round.
- **Flavor:** Four blades in motion. It's hard to watch all of them.

### G9. Cover Fire
- **Participants:** Any ranged attacker + any melee ally
- **Trigger:** The ranged attacker attacks an enemy within 30 feet of their melee ally in the same round
- **Effect:** The melee ally gains +2 AC against ranged attacks from *other* enemies until the start of their next turn. The ranged attacker's target is "suppressed" — distracted by the incoming fire.
- **Flavor:** Keep their heads down. Give the fighter their opening.

### G10. Brace and Strike
- **Participants:** Any two characters with reach weapons (or one with a polearm and one without)
- **Trigger:** One character readies an attack; an enemy moves within the range of both
- **Effect:** Both characters can attack — the readied attack resolves first, and the second character can use their reaction for an opportunity attack as the enemy is struck.
- **Flavor:** The first spear sets. The second waits. The enemy finds neither exit is free.

---

# TIER 2: Theme Synergies

Synergies that activate based on **shared identity or compatible backgrounds**. These represent the lived experience of characters whose histories complement each other — two soldiers who instinctively coordinate, a sage who knows exactly what information their acolyte friend needs, a criminal and an urchin who move through a crowd without speaking.

Format for each synergy:
- **Name** — Thematic name
- **Participants** — The two Themes involved
- **Trigger** — What causes it to fire
- **Effect** — Mechanical benefit
- **Flavor** — Short narrative frame

### Combat & Battlefield (9 synergies)

**1. Sworn Brothers**
- **Participants:** Knight of the Order + Knight of the Order (of the same or allied orders)
- **Trigger:** Both characters attack the same enemy in the same round
- **Effect:** The second attack of the round gains advantage. If both attacks hit, the enemy has disadvantage on its next saving throw.
- **Flavor:** The old oath-forms come back without thought. Where one goes, the other follows.

**2. Discipline and Daring**
- **Participants:** Soldier + Mercenary Veteran
- **Trigger:** One character takes the Dodge or Disengage action; the other attacks in the same round
- **Effect:** The attacker gains +1 to their attack roll, and the dodging/disengaging character gains +5 movement until the end of their turn (tactical repositioning).
- **Flavor:** The soldier holds the line. The mercenary exploits the opening. Neither loves the other, but the math works.

**3. Formation Advance**
- **Participants:** Soldier + Knight of the Order
- **Trigger:** Both characters move in the same direction (toward the same enemy or position) in the same round
- **Effect:** Both gain +10 movement for that move, and neither provokes opportunity attacks from the enemy they're advancing toward.
- **Flavor:** The professional and the oath-sworn march together. Lesser things scatter from their path.

**4. Killing Floor**
- **Participants:** Mercenary Veteran + Mercenary Veteran
- **Trigger:** Both characters are below half HP and in the same combat
- **Effect:** Both gain +2 to attack rolls and damage for the rest of the encounter. Each has survived worse; this is just Tuesday.
- **Flavor:** They've seen each other bleed before. It focuses them rather than frightening them.

**5. Battle Chorus**
- **Participants:** Bard/Entertainer + Soldier/Knight
- **Trigger:** The Entertainer uses their performance or similar class feature; the martial ally attacks the same round
- **Effect:** The martial ally's attack deals an extra 1d6 damage of any type their weapon can deliver. If the attack hits a creature already attacking the Entertainer, the damage becomes 2d6.
- **Flavor:** Words sharpen the blade. The Entertainer sees it. The warrior feels it.

**6. Faith in Steel**
- **Participants:** Acolyte + Soldier/Knight of the Order
- **Trigger:** Acolyte uses a ranged healing effect (spell, Faithkeeper, Intercessor) on the martial ally
- **Effect:** The healed ally's next attack gains advantage and deals extra damage equal to the Acolyte's Wisdom modifier.
- **Flavor:** The prayer is answered in motion. The blade that follows is surer than the one that preceded it.

**7. Covering Fire**
- **Participants:** Mercenary Veteran + Urchin/Criminal
- **Trigger:** The Mercenary attacks an enemy; the Urchin/Criminal is hidden or has cover
- **Effect:** The Urchin/Criminal can immediately take the Hide action as a free action, even in the middle of their own turn. They blend back into cover while the Mercenary draws attention.
- **Flavor:** The veteran shouts. The urchin vanishes. This is a dance they've both practiced, just with different partners.

**8. Tactical Withdrawal**
- **Participants:** Soldier + any Outlander/Sailor/Urchin (movement-focused Themes)
- **Trigger:** A combat has clearly turned against the party; the Soldier declares "fall back"
- **Effect:** The party moves up to 2x their speed in one direction without provoking opportunity attacks, for one round. If the movement-focused partner knows the terrain, the party also gains advantage on Stealth or Survival checks to evade pursuit for the next hour.
- **Flavor:** One calls the retreat. The other knows how to make it stick.

**9. Last Stand**
- **Participants:** Knight of the Order + Folk Hero
- **Trigger:** Both characters are present; either one drops to 0 HP
- **Effect:** The other immediately gains advantage on their next attack roll and deals maximum damage on a hit. Once per long rest per pair.
- **Flavor:** The Knight falls, and the Folk Hero answers. The Folk Hero falls, and the Knight answers. Both are fighting for something they love — and fury is a better weapon than skill.

### Knowledge & Investigation (5 synergies)

**10. Cross-Reference**
- **Participants:** Sage + Acolyte (or Sage + Hermit)
- **Trigger:** Either character makes a Religion, Arcana, or History check
- **Effect:** Both characters can contribute. Use the higher modifier and add the other's proficiency bonus. If one succeeds and the other fails, the successful character explains it to the party, treating the DC as 5 lower for purposes of understanding.
- **Flavor:** "Did you come across the Irithian fragments?" "Yes — but did you find the Cassian rebuttal?" The party waits. They'll figure it out.

**11. Scholar's Gambit**
- **Participants:** Sage + Investigator
- **Trigger:** The party has accumulated 3+ clues, facts, or lore about an ongoing mystery
- **Effect:** Both characters together can synthesize them into a breakthrough. The DM reveals one major truth about the mystery that neither character would have found alone. Once per story arc per pair.
- **Flavor:** The sage knows *what the clues mean*. The investigator knows *how to arrange them*. Together, they see the whole.

**12. Outsider's Clarity**
- **Participants:** Far Traveler + Investigator (or Far Traveler + Hermit)
- **Trigger:** The party is in an unfamiliar social situation (court, cult, foreign ritual)
- **Effect:** The Far Traveler shares their cultural knowledge; the Investigator/Hermit applies it. Both gain advantage on Insight and Persuasion checks in that situation.
- **Flavor:** "In the eastern courts, this would be a blessing. I don't think it's a blessing here." "Look at the way the host is standing. No. Not a blessing."

**13. Truth from Lies**
- **Participants:** Investigator + Charlatan
- **Trigger:** A creature is trying to deceive the party
- **Effect:** Both characters can make Insight checks. If either succeeds, both learn one fact the target is hiding. The Charlatan's Deception Expertise Die (if unlocked) applies to both checks.
- **Flavor:** The Charlatan knows how a lie feels from the inside. The Investigator knows how it looks from the outside. Caught between them, no lie holds.

**14. Pattern Recognition**
- **Participants:** Haunted One + Sage (or Haunted One + Hermit)
- **Trigger:** The party is investigating a supernatural phenomenon, curse, or dark ritual
- **Effect:** Combine the Haunted One's experiential knowledge with the scholar's research. The DM reveals *two* pieces of information (instead of the Haunted One's normal one) about the phenomenon's nature, anchor, or weakness.
- **Flavor:** "I've seen this before." "I've read this before." The match is not coincidence.

### Social & Court (6 synergies)

**15. Authority and Access**
- **Participants:** Noble + Knight of the Order
- **Trigger:** The party seeks an audience with a ruler, high official, or institutional leader
- **Effect:** Audience is granted within 1 hour (instead of 1 day or longer). Both characters gain advantage on the first Charisma check of the meeting.
- **Flavor:** The Knight's oath opens the armory. The Noble's name opens the throne room. Together, no door is locked.

**16. The People's Champion**
- **Participants:** Folk Hero + Entertainer
- **Trigger:** Both characters are in a settlement where at least one is recognized
- **Effect:** Both gain advantage on Charisma checks for the duration of the visit. If they choose to collaborate publicly (a speech, a song, a staged confrontation), they can shift the settlement's political mood — the DM adjudicates consequences, but public sentiment moves in their declared direction.
- **Flavor:** The Folk Hero speaks. The Entertainer amplifies. By nightfall, every tavern sings what they said.

**17. Patron and Artist**
- **Participants:** Noble + Entertainer
- **Trigger:** A social event where both are present
- **Effect:** Both gain advantage on Persuasion and Performance checks for the event. Afterward, both can secure introductions or favors in the noble circles of the region.
- **Flavor:** The art becomes the Noble's taste. The taste becomes the Entertainer's fame. Both benefit from the pretense that either of them is the patron.

**18. The Rich and the Ruthless**
- **Participants:** Noble + Charlatan
- **Trigger:** Any con, negotiation, or political maneuver targeting a single wealthy or powerful individual
- **Effect:** Both gain advantage on Deception and Persuasion checks targeting that individual. The Charlatan's L11 "read a mark" applies to both characters' knowledge.
- **Flavor:** The Noble provides legitimacy. The Charlatan provides the knife. The mark never knows which of them to fear more.

**19. Two Worlds Meet**
- **Participants:** Noble + Folk Hero
- **Trigger:** A conflict between nobility and commoners (a dispute, a tax revolt, a land seizure)
- **Effect:** Both characters can mediate. Combine their Expertise Dice (if unlocked); if both contribute, the party can broker a compromise that satisfies both sides on a DC 15 Persuasion check instead of the usual escalation.
- **Flavor:** They shouldn't work. Their whole lives have been spent on opposite sides. And yet — when they both speak truth, something rare becomes possible.

**20. Public and Private**
- **Participants:** Folk Hero + Urchin
- **Trigger:** The party needs to accomplish something in a settlement — extract information, rescue someone, foil an injustice
- **Effect:** The Folk Hero draws the settlement's attention (rallies, speeches, visible presence) while the Urchin moves unseen (infiltration, theft, silent work). Both gain advantage on their respective checks, and the party gains a +5 circumstance bonus to whatever operation they're coordinating.
- **Flavor:** Everyone watches the one they love. No one watches the one they forgot. Together, they see and do what neither could alone.

### Stealth & Infiltration (4 synergies)

**21. Thieves Without Honor**
- **Participants:** Criminal + Urchin
- **Trigger:** Both characters are infiltrating the same location
- **Effect:** Both gain +5 to Stealth checks while in the same building, crowd, or urban area. If one is detected, the other has advantage on Stealth to slip away — because the guards are focused on the first one.
- **Flavor:** They shouldn't trust each other. Neither does. They trust the job instead, and the job says: split the attention.

**22. The Mask and the Disguise**
- **Participants:** Charlatan + Criminal (or Charlatan + Urchin)
- **Trigger:** The party needs to infiltrate a location or social setting with layered security
- **Effect:** The Charlatan creates a convincing false identity and walks in the front door. The Criminal/Urchin enters separately through the back. Both approaches are easier because guards are looking for one threat, not two. Both gain +2 to their infiltration-related checks.
- **Flavor:** The Charlatan becomes the diversion. The Criminal becomes the completion. By the time the guards realize there's a problem, the problem is already leaving.

**23. Hunter and Hunted**
- **Participants:** Urban Bounty Hunter + Criminal (or Urban Bounty Hunter + Urchin)
- **Trigger:** The party is tracking a specific target in an urban environment
- **Effect:** Combine the Bounty Hunter's pursuit skills with the Criminal/Urchin's knowledge of where targets hide. Reduce the search time by half and grant advantage on all Investigation checks related to the pursuit. Once the target is cornered, both gain advantage on the first attack roll.
- **Flavor:** It should be comedy — a cop working with a thief. It's not. It's chilling, because the target knows both of them are coming, and neither of them stops.

**24. Silent Understanding**
- **Participants:** Urchin + Urchin (rare — two characters from similar backgrounds)
- **Trigger:** Both characters are in an urban environment and need to communicate silently
- **Effect:** They can pass complex information to each other through gestures, glances, and small movements at any distance they can see each other, even across a crowded room. They cannot be overheard or read by anyone else unless that person is also an Urchin.
- **Flavor:** The world taught them the same language. Only they remember how to speak it.

### Craft & Survival (5 synergies)

**25. Master and Tradition**
- **Participants:** Guild Artisan + Clan Crafter
- **Trigger:** Either character attempts a significant crafting project
- **Effect:** Crafting time is reduced by 25%, and the quality tier of the final item is increased by one step (up to masterwork). Both characters contribute unique knowledge — commercial techniques from the guild, ancestral methods from the clan.
- **Flavor:** The Guild Artisan knows *how things are sold*. The Clan Crafter knows *how things are made*. Between them, the work is finished before sundown.

**26. Land and Sea**
- **Participants:** Outlander + Sailor
- **Trigger:** The party is traveling across mixed terrain (coastal, riverine, island-hopping)
- **Effect:** Travel time is reduced by 25%. Both gain advantage on navigation and weather-related checks. The party cannot be ambushed by surprise while traveling in these environments.
- **Flavor:** One reads the land. One reads the water. Where they meet, nothing is hidden.

**27. Ancient and Modern Medicine**
- **Participants:** Acolyte + Hermit
- **Trigger:** Treating an ally during a long rest or an affliction that requires extended care
- **Effect:** Healing received is doubled (normal rest hit dice, Acolyte's Short-Rest bonus, and Hermit's ailment-curing all combine). The treated ally gains immunity to one disease or minor curse they're currently suffering.
- **Flavor:** The Acolyte prays. The Hermit listens. Both hands rest on the wounded, and the wound remembers what it used to be.

**28. Wilderness Hunt**
- **Participants:** Outlander + Urban Bounty Hunter (specifically if the Bounty Hunter has pursued their quarry out of a city)
- **Trigger:** The party is tracking a fleeing quarry across wilderness
- **Effect:** Combine the Outlander's biome knowledge with the Bounty Hunter's pursuit instincts. The party's tracking speed doubles, and the quarry cannot gain the benefit of environmental cover or misdirection.
- **Flavor:** The Bounty Hunter never lost a target in a city. The Outlander never lost a trail in their biome. Between them, the wilderness becomes just another street.

**29. Shared Fire**
- **Participants:** Haunted One + any (this is a universal synergy)
- **Trigger:** The party is resting somewhere dangerous or haunted
- **Effect:** The Haunted One takes the first watch. Any creature attempting to approach the camp during the night must make a Wisdom save (DC = 8 + Haunted One's proficiency + Wisdom mod) or retreat, unable to bring itself closer. The night is restful.
- **Flavor:** Whatever else it is, the darkness respects those who have already faced it.

### Authority & Pursuit (5 synergies)

**30. Badge and Banner**
- **Participants:** City Watch + Knight of the Order
- **Trigger:** The party confronts a public wrongdoing (crime, atrocity, injustice)
- **Effect:** Both characters' combined authority is hard to refuse. Neutral bystanders (guards, commoners, minor officials) will defer to them unless given a compelling reason not to. In social confrontations, the party gains advantage on all Charisma checks.
- **Flavor:** The Watch upholds the law. The Knight upholds the ideal. When both speak, most wrongdoers find themselves caught between.

**31. Watchmen's Call**
- **Participants:** City Watch + City Watch
- **Trigger:** Both characters are in the same settlement
- **Effect:** The settlement's guards treat them with reflexive respect. Summoning backup (L11 ability) now calls 3d4 guards instead of 2d4, and the "free lodging at guard stations" extends to 7 days instead of 3.
- **Flavor:** It's not hard to tell when someone walked a beat. Everyone in the barracks knew within an hour.

**32. Reformer's Cause**
- **Participants:** Knight of the Order (Reformer or Martyr path) + Folk Hero
- **Trigger:** The party challenges a corrupt institution, tyrant, or unjust regime
- **Effect:** Both characters' inspirational abilities affect the same allies. The Knight's order-tied rally combines with the Folk Hero's Voice of the People — allies within 60 feet gain advantage on saves against fear and compulsion, and commoners in the area are far more willing to take risks on the party's behalf.
- **Flavor:** The knight who refused. The hero who acted. Together, they are what every unjust ruler fears — proof that the story isn't over.

**33. Peacekeeper's Corner**
- **Participants:** City Watch + Acolyte
- **Trigger:** The party is in an urban environment and encounters someone in crisis (a beggar, a runaway, a grieving person)
- **Effect:** Both can intervene. The City Watch's authority opens the encounter; the Acolyte's counsel resolves it. Situations that would otherwise escalate (the beggar is arrested, the runaway flees) instead stabilize, and the party may gain useful information or a lasting ally.
- **Flavor:** The Watch makes sure the person is safe. The Acolyte makes sure they know they matter. It's a small mercy that often changes a life.

**34. Survivors' Creed**
- **Participants:** Haunted One + Mercenary Veteran
- **Trigger:** The party is facing overwhelming odds, despair, or a situation where defeat seems certain
- **Effect:** Neither character can be frightened for the rest of the encounter (combining their respective resistances). Each gains +1 to attack rolls and damage rolls for every round the combat continues past the fifth. They don't hope for victory; they simply refuse to be killed.
- **Flavor:** One has faced worse. The other has survived worse. Neither thinks this is the end.

---

# TIER 3: Team Tactics (Learned via Downtime)

Inspired by **Pathfinder 1e's Teamwork Feats**. Team Tactics represent explicit shared training between two characters — techniques they've practiced together enough to execute without thought. Unlike Theme Synergies (which emerge from who you *are*) or Gear Synergies (which emerge from what you *carry*), Team Tactics must be **deliberately learned**.

## Learning Team Tactics

**Both characters must learn the tactic together.** A character cannot know a Team Tactic if their training partner doesn't know it too.

**Acquisition methods:**
- **Downtime training:** 5 days of dedicated practice together (during a long rest period, not active adventuring). Requires both characters to be present and actively participating. Counts as a downtime activity.
- **Trainer or guidebook:** Finding an NPC trainer or a rare martial manual can reduce training time to 3 days, or teach specific tactics otherwise unavailable.
- **Field observation:** Some Team Tactics can be learned by repeatedly witnessing them in combat (e.g., a companion and the player character coordinating over enough encounters). The AI DM tracks these over the course of a campaign and notifies the player when a tactic has been implicitly mastered.

**Capacity limits:**
- Each character can know up to **proficiency bonus** Team Tactics (2 at L1, 3 at L5, 4 at L9, 5 at L13, 6 at L17+).
- Team Tactics are tied to **specific partners** — learning *Coordinated Strike* with Tormund doesn't mean you can execute it with Sera. You'd have to train it separately with Sera.
- This creates meaningful narrative weight: the partner you've trained with for many sessions is mechanically irreplaceable.

**Downtime integration note:** The existing Downtime v2 system needs to be extended with a **"Train Team Tactic"** activity. This should tie into the existing downtime activity framework and require both participating characters to be active in the same downtime period. *(See FUTURE_FEATURES.md — the downtime system is due for an overhaul to support this and other new mechanics.)*

## Team Tactics List

### Combat Tactics (10)

**T1. Coordinated Strike**
- **Trigger:** Both attack the same target in the same round; one scores a critical hit
- **Effect:** The other immediately gains a free weapon attack as a reaction against the same target, with advantage.

**T2. Mutual Defense**
- **Trigger:** An enemy attacks one of the pair while the other is within 5 feet
- **Effect:** The defender can use their reaction to impose disadvantage on the attack roll. Works both ways — whoever isn't attacked can defend the one who is.

**T3. Set Up the Shot**
- **Trigger:** One character successfully grapples, restrains, or knocks prone a creature
- **Effect:** The other gains advantage on all attack rolls against that creature until the condition ends.

**T4. Rolling Thunder**
- **Trigger:** One character scores a critical hit during combat
- **Effect:** Both gain +2 to attack rolls for the remainder of the combat encounter. The surge of confidence compounds.

**T5. Opportunist Duo**
- **Trigger:** An enemy provokes an opportunity attack from one of the pair
- **Effect:** If the other is within 10 feet of the target, they can also use their reaction to make an opportunity attack.

**T6. Final Push**
- **Trigger:** One character reduces an enemy to 0 HP
- **Effect:** The other can move up to 15 feet as a free action (in addition to their normal movement). Useful for closing distance to the next threat or repositioning.

**T7. Brace for Impact**
- **Trigger:** A readied action — one character declares they'll intercept an attack targeting the other
- **Effect:** When the triggering attack occurs, both characters take half the damage (the attack is "shared"). This allows distributing a burst of damage between two characters instead of dropping one.

**T8. Flanking Footwork**
- **Trigger:** Both are adjacent to the same target at the start of either's turn
- **Effect:** Both can move 5 feet as a free action without provoking opportunity attacks from the target, maintaining positional advantage.

**T9. Perfect Cover**
- **Trigger:** One character takes the Dodge action
- **Effect:** Any adjacent ally also gains +2 AC until the start of that character's next turn. The dodging character's movement telegraphs where the threats are.

**T10. Combined Arms**
- **Trigger:** One makes a melee attack and the other makes a ranged attack against the same target in the same round
- **Effect:** The target has disadvantage on its next attack roll before the start of its next turn, as it struggles to track both threats.

### Utility & Skill Tactics (5)

**T11. Relay Information**
- **Trigger:** One character uses an action to share information they've learned (a Sage recalling lore, an Investigator identifying a clue, a Far Traveler applying cultural knowledge)
- **Effect:** The receiving ally gains advantage on one ability check related to acting on that information, within the next 10 minutes.

**T12. Dual Intimidate**
- **Trigger:** Both characters attempt to intimidate the same target in the same round
- **Effect:** If either succeeds, the other automatically succeeds. The target cannot convince itself only one of them is the real threat.

**T13. Stabilize Together**
- **Trigger:** One character attempts to stabilize a dying ally; the other assists
- **Effect:** The stabilization check uses the *combined* total of both characters' Wisdom (Medicine) modifiers. Failure still fails, but success is nearly guaranteed.

**T14. Silent Signal**
- **Trigger:** Both characters know a common silent communication system (thieves' cant, military signals, agreed-upon gestures)
- **Effect:** They can pass complex information across any distance they can see each other, without being overheard or understood by others. This enables coordinated action without spoken planning.

**T15. Echoing Spell**
- **Trigger:** One character casts a spell of 1st level or higher
- **Effect:** The other's next spell of equal or lower level cast within the same round does not require concentration. Usable once per long rest per pair.

### Defensive & Survival Tactics (5)

**T16. Watchful Stance**
- **Trigger:** Both characters are within 30 feet of each other at the start of combat
- **Effect:** Neither can be surprised unless both are surprised. If either acts normally in surprise round, both do.

**T17. Back Together**
- **Trigger:** Both characters are below half HP; one is healed
- **Effect:** The other also heals 1d4 hit points. Shared resilience.

**T18. Divide Attention**
- **Trigger:** Both characters make ranged attacks against *different* targets in the same round
- **Effect:** Each target has disadvantage on its next attack roll against the ally who *didn't* target it. ("Which one is the real threat?")

**T19. Shoulder the Weight**
- **Trigger:** One character takes damage that would reduce them to 0 HP
- **Effect:** The other can use their reaction to transfer up to 10 damage to themselves, preventing the drop. They take the transferred damage. Usable once per long rest per pair.

**T20. Read the Room**
- **Trigger:** The party enters a tense social situation together
- **Effect:** Both make Insight checks; they share the highest result between them. Learned through shared experience navigating dangerous diplomacy.

---

## Generative Synergy Guidelines (for AI DM)

When two characters have Themes not covered by a Signature Synergy above, the AI DM should **identify shared compatibility tags** and generate small synergy moments organically. Examples:

- **Shared `urban` tag** (any urban Theme pair): In cities, when moving through crowds together, both gain advantage on Stealth or Perception checks.
- **Shared `combat` tag**: When attacking the same enemy in the same round, the second attacker gains a +1 bonus.
- **Shared `craft` tag**: When working on a shared project, both can use the higher of their two relevant modifiers.
- **Shared `community` tag**: In social situations involving ordinary people, both gain advantage on Insight checks.

**Generative synergies should be narratively-flavored, mechanically modest** (advantage, +1 bonus, small temporary buffs), and **called out in the DM's narration** so the player feels the synergy happen rather than just receiving a die modifier in silence.

Examples of good AI DM narration:
- *"As you both move through the market, Tormund and Sera fall into the same walking pattern — two people who've spent enough time in cities to move the way a native moves. You both have advantage on Stealth to slip through the crowd."*
- *"Sera's sage mind catches what Tormund's acolyte faith confirms. You both lean over the tome, eyes meeting for a moment of shared recognition. Use the higher of your two modifiers on this History check."*

---

## Next Phases

1. **Design remaining Signature Synergies** — currently 35; aim for 40-50 total if more compelling pairs emerge
2. **Playtest balance** — some synergies may be too strong when combined with specific class features (Battle Master + Shield Wall, for example)
3. **AI DM integration** — add synergy detection logic to the prompt builder so the AI knows when to trigger and narrate them
4. **UI representation** — show active synergies in the party view so players know what's available
5. **Companion personality hooks** — tag companions with "Synergy engagement likelihood" so the AI can roleplay choosing (or not choosing) to engage
