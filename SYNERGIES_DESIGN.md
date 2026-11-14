# Party & Subclass×Theme Synergies — Design (post-MVP shelf doc)

> **Consolidates** (merge-and-archive job, 2026-11-14): `PARTY_SYNERGIES.md`, `SUBCLASS_THEME_SYNERGIES.md` and `Claude PM Review Docs/PARTY_SYNERGIES_REVIEW.md`. The originals are preserved byte-identical in `archive/`.
> **Status:** POST-MVP (Zach, 2026-11-11).

> **Model references.** The sources named Claude Opus / Sonnet as the production models. Those names were replaced mechanically with `gemma4:12b` (none were needed in these sources). The game runs one model, gemma4:12b, through Ollama on the PC (Zach, 2026-11-10 and 2026-11-13); roles are in `server/services/localModels.js`. Any cost, caching or quality reasoning that compared Opus with Sonnet no longer means anything and **needs re-verification at build time**. Nothing else in the source text was changed or fixed.

## What is built and what is not (verified 2026-11-14)

**The data is seeded in code; the party-level DM-prompt integration is what is unbuilt.**
- Seeded: the 20 Team Tactics in `server/data/teamTactics.js` (sourced from `PARTY_SYNERGIES.md`) and the subclass×theme pairings in `server/data/subclassThemeSynergies.js` (sourced from `SUBCLASS_THEME_SYNERGIES.md`), loaded by `server/services/progressionSeedService.js`.
- **Built, one narrow piece:** a character's own resonant subclass×theme pairing reaches the DM prompt. `server/services/progressionService.js:209` attaches `subclass_theme_synergy` and `server/services/dmPromptBuilder.js:1346` prints "RESONANT SUBCLASS×THEME SYNERGY" with its description and mechanics. (Verified 2026-11-14; this corrects the first draft of this section, which said nothing reached the prompt.)
- **Not built:** the three-tier **party** design. Team Tactics appear nowhere in the DM prompt (`grep -i tactic` in `dmPromptBuilder.js` finds only unrelated prose), and there is no per-turn detection of Tier 1 (gear/positioning) or Tier 2 (theme-pair) eligibility, no narration of a triggered synergy, and no companion engagement logic. `COMPANIONS.md` records the same fact ("Party Synergies' AI integration doesn't exist"). A synergy the AI cannot detect or narrate is invisible in play.
- **Do not confuse with** `server/config/partySynergy.js`: that is an older, unrelated class-role coverage bonus used by the adventure route (`server/routes/adventure.js`) for auto-resolved adventure success. It is not this design.
- Not built, per the review: the active-synergy UI and the "Train Team Tactic" downtime activity (which also waits on Downtime).

## Open issues (from the review)

**AI integration is the load-bearing gap**, in this order of leverage: (1) the DM-prompt detection and narration layer, (2) the companion engagement layer (without it a companion that always engages is a companion with no personality), (3) a balance pass on advantage-granting synergies and the **Killing Floor** outlier (Mercenary Veteran × Mercenary Veteran: +2 attack and damage for the rest of the encounter, no cap), (4) Tier 3 depends on Downtime activation, (5) a player-visible "active synergies" UI, (6) a polish pass on the 35 Signature Synergy flavor texts.

**Coupling.** This is the second-most coupled system in the project (after Mythic): it depends on Themes, Companions, Downtime, the DM prompt builder and the UI. If the 21-theme list or the theme progression model changes, every Theme Synergy needs revisiting. **Open theme question (not decided here):** the theme tiers auto-unlock one ability in code while the design says the player picks at tier crossings; see `THEME_DESIGNS.md`.

**Memory load** (tracked in `AI_NARRATIVE_PERSISTENCE.md`): per-turn synergy detection, companion engagement likelihood, field-observed Team Tactic mastery, per-pair partner memory, and exposing eligibility to the UI.

**Design gaps flagged:** "Status: In review" in the design is ambiguous (built vs validated); some natural theme pairs have no Signature Synergy (Hermit + Sage, Folk Hero + Acolyte, Sailor + Outlander) — deliberate gaps for the Generative system or oversights; `PARTY_SYNERGIES.md`'s own "Next Phase" list is still the work list. **Guardrails (do not break):** three-tier framework, "trigger, not activate", Tier 1 universals so no party is shut out, compatibility tags enabling Generative Synergies with explicit guardrails, proficiency-bonus-scaled Tier 3 capacity.

The full finding list is in Appendix A, verbatim.

## Part 1 — Party Synergies (three tiers), carried verbatim

*Source: `PARTY_SYNERGIES.md`.*

Status: In review — three-tier synergy system covering gear, identity, and trained tactics.

### Overview

Party Synergies are mechanical bonuses that activate when two or more characters coordinate effectively. The system has **three distinct tiers**, each representing a different source of coordination:

1. **Gear & Positioning Synergies** — What you're carrying and where you're standing
2. **Theme Synergies** — Who you are (lived experience, shared identity)
3. **Team Tactics** — What you've practiced together (explicit shared training)

Inspired by Pathfinder 1e's **Teamwork Feats** (Outflank, Coordinated Maneuvers, Lookout, Shake It Off), but expanded into a layered model so that any party — not just those with compatible Themes — can build meaningful tactical coordination.

### The three tiers compared

| Tier | Source | Activation | Duration/Availability |
|------|--------|------------|----------------------|
| **Tier 1: Gear & Positioning** | Equipment + tactical position | Automatic when conditions met | Always available if you have the gear |
| **Tier 2: Theme** | Shared identity/background | Automatic when trigger conditions met | Always available if Theme pair is in party |
| **Tier 3: Team Tactics** | Explicit shared training during downtime | Automatic when trigger conditions met | Must be learned; both characters must know it |

#### A practical example

A Knight Fighter (Soldier Theme) and a Cleric (Acolyte Theme) both carrying shields could use:
- **Tier 1 Shield Wall** (both have shields, adjacent)
- **Tier 2 Faith in Steel** (Acolyte heals → Fighter's next attack has advantage)
- **Tier 3 Coordinated Guard** (if they trained it) — reaction to impose disadvantage when ally is attacked

### Activation model

**Synergies are triggered, not activated.** They fire automatically when narrative conditions are met:
- Both characters take a qualifying action in the same round (or during the same encounter, for out-of-combat synergies)
- The condition is met organically — not by spending resources, actions, or reactions

**AI companions choose whether to engage.** Even though a synergy exists between two Themes, the AI companion character *chooses* whether to take the qualifying action based on their personality, current goals, and combat priorities:
- A loyal cleric companion with Acolyte Theme will reliably coordinate with the party's Sage on research
- A reckless barbarian companion with Soldier Theme might *not* set up flanking synergies because they prefer to charge alone
- This makes companion personality **mechanically meaningful** — the player learns which companions reliably play into synergies, and absences matter because losing a Synergy partner removes options the party had come to rely on

**Range:** Unless otherwise specified, synergies require both characters to be within 60 feet of each other and aware of each other's actions.

### The hybrid model

**Signature Synergies** (this document) — 30-40 authored, named synergies for the most compelling Theme pairs. These have distinct mechanical effects, names, and flavor text.

**Generative Synergies** (tag-based, handled by AI DM) — any Theme pair not covered by a Signature Synergy can still generate synergy moments based on shared compatibility tags. The AI DM identifies the shared tag and narrates a small bonus (advantage on a check, a bonus die, extra information, etc.).

---

### Compatibility Tags per Theme

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

## TIER 1: Gear & Positioning Synergies

Universal synergies that activate based on shared equipment or tactical positioning. **No Theme required, no training required.** If two characters meet the conditions, they activate automatically. These are the synergies available to *any* party, regardless of composition.

#### G1. Shield Wall
- **Participants:** Any two characters with shields
- **Trigger:** Both end their turn adjacent (within 5 feet) to each other
- **Effect:** Both gain +2 AC until the start of their next turn. When one takes damage from a melee or ranged attack, the other can use their reaction to impose disadvantage on the attack roll.
- **Flavor:** Two warriors fall into a formation as old as war itself. Shields raised, shoulders nearly touching.

#### G2. Volley
- **Participants:** Any two characters making ranged attacks
- **Trigger:** Both attack the same target in the same round, with ranged weapons
- **Effect:** The second attack gains +1 to hit. If both attacks hit, the target has disadvantage on its next saving throw.
- **Flavor:** One arrow in flight. Another following. Targets learn too late that the first was not alone.

#### G3. Spell Convergence
- **Participants:** Any two spellcasters
- **Trigger:** Both cast a spell of the same school at the same target in the same round
- **Effect:** The second spell's save DC is increased by +1. If both spells force saving throws, the target has disadvantage on the second save.
- **Flavor:** Magic does not mind sharing. Two conjurations, two evocations, two enchantments — the weave answers both voices.

#### G4. Back to Back
- **Participants:** Any two characters
- **Trigger:** Both are adjacent to each other and surrounded by 3 or more enemies within 10 feet
- **Effect:** Both gain advantage on Perception checks while surrounded, and neither can be flanked. Enemies do not gain advantage from flanking these two while they remain adjacent.
- **Flavor:** When the crowd closes in, the instinct is older than civilization: find someone you trust, turn your back to theirs, and fight.

#### G5. Mounted Charge
- **Participants:** Any two mounted characters
- **Trigger:** Both charge the same target (moving at least 20 feet in a straight line before attacking)
- **Effect:** The first attack to hit deals an extra die of the weapon's damage. The target, if size Medium or smaller, must succeed on a Strength save (DC 13) or be knocked prone.
- **Flavor:** The ground shakes. Then they arrive.

#### G6. Silent March
- **Participants:** Any two or more characters, none wearing heavy armor, all proficient in Stealth
- **Trigger:** The group attempts to move together stealthily
- **Effect:** Roll a single group Stealth check using the *highest* modifier among the group (not the lowest, as is standard). The group moves as one silent unit.
- **Flavor:** One learns to move. Two learn to move *together*. The forest doesn't hear them. Neither do the guards.

#### G7. Healer's Ward
- **Participants:** Any healer (character casting a healing spell) + any wounded ally
- **Trigger:** Healer casts a healing spell on an ally below half HP
- **Effect:** The healing restores an additional amount equal to the healer's spellcasting ability modifier (minimum +1). This stacks with existing class features that buff healing.
- **Flavor:** When the need is greatest, the prayer carries further.

#### G8. Two-Weapon Formation
- **Participants:** Any two characters dual-wielding melee weapons
- **Trigger:** Both are adjacent to each other and attack in the same round
- **Effect:** Both gain +1 to damage on their off-hand attacks for the round.
- **Flavor:** Four blades in motion. It's hard to watch all of them.

#### G9. Cover Fire
- **Participants:** Any ranged attacker + any melee ally
- **Trigger:** The ranged attacker attacks an enemy within 30 feet of their melee ally in the same round
- **Effect:** The melee ally gains +2 AC against ranged attacks from *other* enemies until the start of their next turn. The ranged attacker's target is "suppressed" — distracted by the incoming fire.
- **Flavor:** Keep their heads down. Give the fighter their opening.

#### G10. Brace and Strike
- **Participants:** Any two characters with reach weapons (or one with a polearm and one without)
- **Trigger:** One character readies an attack; an enemy moves within the range of both
- **Effect:** Both characters can attack — the readied attack resolves first, and the second character can use their reaction for an opportunity attack as the enemy is struck.
- **Flavor:** The first spear sets. The second waits. The enemy finds neither exit is free.

---

## TIER 2: Theme Synergies

Synergies that activate based on **shared identity or compatible backgrounds**. These represent the lived experience of characters whose histories complement each other — two soldiers who instinctively coordinate, a sage who knows exactly what information their acolyte friend needs, a criminal and an urchin who move through a crowd without speaking.

Format for each synergy:
- **Name** — Thematic name
- **Participants** — The two Themes involved
- **Trigger** — What causes it to fire
- **Effect** — Mechanical benefit
- **Flavor** — Short narrative frame

#### Combat & Battlefield (9 synergies)

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

#### Knowledge & Investigation (5 synergies)

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

#### Social & Court (6 synergies)

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

#### Stealth & Infiltration (4 synergies)

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

#### Craft & Survival (5 synergies)

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

#### Authority & Pursuit (5 synergies)

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

## TIER 3: Team Tactics (Learned via Downtime)

Inspired by **Pathfinder 1e's Teamwork Feats**. Team Tactics represent explicit shared training between two characters — techniques they've practiced together enough to execute without thought. Unlike Theme Synergies (which emerge from who you *are*) or Gear Synergies (which emerge from what you *carry*), Team Tactics must be **deliberately learned**.

### Learning Team Tactics

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

### Team Tactics List

#### Combat Tactics (10)

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

#### Utility & Skill Tactics (5)

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

#### Defensive & Survival Tactics (5)

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

### Generative Synergy Guidelines (for AI DM)

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

### Next Phases

1. **Design remaining Signature Synergies** — currently 35; aim for 40-50 total if more compelling pairs emerge
2. **Playtest balance** — some synergies may be too strong when combined with specific class features (Battle Master + Shield Wall, for example)
3. **AI DM integration** — add synergy detection logic to the prompt builder so the AI knows when to trigger and narrate them
4. **UI representation** — show active synergies in the party view so players know what's available
5. **Companion personality hooks** — tag companions with "Synergy engagement likelihood" so the AI can roleplay choosing (or not choosing) to engage


## Part 2 — Subclass × Theme synergies, carried verbatim

*Source: `SUBCLASS_THEME_SYNERGIES.md`.*

Status: In review — resonant pairings with mechanical bonuses.

### Overview

Subclass × Theme Synergies apply when a character's class subclass and chosen Theme share significant thematic resonance. Unlike Party Synergies (which activate between two party members) or Theme-Tier unlocks (which scale with character level), Subclass × Theme Synergies are **passive, always-on bonuses** that reward thematic character-building choices.

These synergies represent "the character concept clicks together" — a Battle Master Fighter who took the Soldier Theme isn't just mechanically doubled up on tactics, they ARE a professional tactician in a way that no one else in the party can match. The mechanical bonus is small but thematic; the roleplay value is substantial.

### Design principles (from locked-in decisions)

- **Accept some imbalance.** Major characters should be roughly balanced, but the player character can occasionally feel like a god among mortals. Subclass × Theme Synergies lean into this — they reward intentional character concepts.
- **Small but thematic bonuses.** Not game-breaking. +1 to a specific check type, advantage in a specific context, or a once-per-rest flavor ability. The synergy is the *concept*, not the numbers.
- **Not universal.** Not every subclass × theme combination has a synergy. Only **resonant** pairings — combinations that feel like they belong together narratively.
- **Triggered thematically, not mechanically.** The bonus applies in situations where the subclass and theme would both naturally shine. A Battle Master + Soldier synergy activates during tactical combat planning, not random encounters.

### Tag-based resonance

Each subclass carries implicit tags derived from its identity. When a subclass's tags significantly overlap with a Theme's tags (from [PARTY_SYNERGIES.md](PARTY_SYNERGIES.md)), resonance exists. This document lists the specific resonant pairs and their synergies.

For subclass × theme combinations not listed here, the AI DM can still invoke **generative synergy moments** based on shared tags — similar to the generative Party Synergy system. These are narrative, not mechanical.

---

### Martial & Combat Synergies

#### Battle Master Fighter × Soldier — "Tactician's Eye"
- **Shared tags:** tactics, discipline, combat
- **Synergy:** You can use your Battle Master superiority dice to fuel **tactical insight**. Once per short rest, you can expend a superiority die to make a **Tactical Assessment** — you learn the HP status (roughly: healthy/wounded/bloodied/near death), the relative threat level, and one maneuver or ability the creature is likely to use next. Additionally, when using a maneuver that grants an ally a bonus (Commander's Strike, Rally, Maneuvering Attack), the ally also gains the Soldier Theme's Field Discipline AC bonus (+1 AC for the encounter) as if they had prepared their gear.

#### Champion Fighter × Soldier — "Line-Holder"
- **Shared tags:** discipline, combat, duty
- **Synergy:** Your Champion Improved Critical range expands when you're **defending a specific ally or objective** that has been in the fight for at least 1 round — you also crit on 18-20 while adjacent to that ally or objective. Additionally, your Soldier Theme abilities trigger an extra +1 to attack when you're holding a fixed position (not moving more than 5 feet per round).

#### Cavalier Fighter × Knight of the Order — "Sworn Steel"
- **Shared tags:** oath, combat, honor, cause
- **Synergy:** While you have an ally marked by your Cavalier Unwavering Mark, your Knight's Oath Unbroken bonuses apply to that ally as well (advantage on saves against charm/fear while the mark holds). Additionally, your ceremonial orders recognize you as "Paired Guardian" — a nobility title that grants advantage on social checks in courts sympathetic to your order.

#### Samurai Fighter × Knight of the Order — "Code of Iron"
- **Shared tags:** honor, combat, oath
- **Synergy:** Your Fighting Spirit's advantage applies even to ability checks and saving throws (not just attack rolls) once per short rest, while you are actively upholding your order's code. Additionally, your critical hit damage is increased by 1d6 while fighting to protect an innocent or uphold your oath.

#### Path of the Berserker Barbarian × Mercenary Veteran — "Blood Wages"
- **Shared tags:** combat, pragmatism, survival
- **Synergy:** Your Frenzy exhaustion penalty is reduced — you gain 1 level of exhaustion at the end of frenzying **only if the fight was lost or unresolved**. If you end the frenzy with victory (all targeted enemies down or fled), you do not gain exhaustion. The Mercenary's pragmatism teaches you: exhaustion is the price of losing, and you don't pay it when you win.

#### Path of the Totem Warrior Barbarian × Outlander — "Spirit of the Land"
- **Shared tags:** wilderness, nature, survival
- **Synergy:** The Outlander's chosen biome affects your Totem Spirit — it is specifically tied to creatures of that biome. While in your chosen biome, your Totem Spirit ability (Bear, Eagle, Wolf, etc.) gains an additional benefit relevant to the biome (DM determines — e.g., Wolf in forest grants pack tactics to allies, Bear in arctic grants cold resistance to adjacent allies).

#### Oath of Devotion Paladin × Knight of the Order — "The Paired Oath"
- **Shared tags:** oath, honor, cause
- **Synergy:** Your Sacred Weapon duration doubles (2 minutes instead of 1) while you are acting in your Knight's order's name. Additionally, your Oath Spells and your Knight abilities reinforce each other: when you use Sacred Weapon, allies within 30 feet also gain the Knight's Oath Unbroken charm/fear save advantage for the duration.

#### Oath of Vengeance Paladin × Haunted One — "The Hunter's Resolve"
- **Shared tags:** trauma, resilience, cause
- **Synergy:** Your Vow of Enmity and the Haunted One's creature-type knowledge stack — when you mark a creature with Vow of Enmity that is also a creature type you have knowledge of (undead, fiend, aberration from Haunted One's identification ability), you deal additional damage equal to your proficiency bonus on every attack against them.

#### Oath of the Ancients Paladin × Outlander — "Warden of the Old Ways"
- **Shared tags:** nature, wilderness, faith (broadly)
- **Synergy:** Your Nature's Wrath spell (or similar Ancients oath spells) functions with enhanced range while in your Outlander biome. Additionally, you can spend a Lay on Hands pool to heal plants or natural features (restoring a dying tree, purifying a cursed spring) that are significant to your biome — this counts as 1 Lay on Hands point per 10 HP restored to the natural feature.

---

### Stealth & Rogue Synergies

#### Assassin Rogue × Criminal — "Contract Killer"
- **Shared tags:** stealth, underworld, deception, infiltration
- **Synergy:** Your Assassinate feature's advantage applies to attacks against marks that your Criminal contacts have identified. Additionally, your Assassin's Infiltration Expertise (creating a false identity) benefits from the Criminal's existing network — you can establish your false identity in any city where you have a contact within **1 hour** instead of the normal 7 days.

#### Assassin Rogue × Urban Bounty Hunter — "The Predator's Patience"
- **Shared tags:** pursuit, patience, tracking
- **Synergy:** When you mark a quarry with the Bounty Hunter's Mark feature, that quarry becomes an **Assassin's Target** — your Assassinate damage bonus applies to your first attack against them each combat (not just when they haven't acted). Additionally, you gain advantage on Insight and Perception checks specifically related to locating your marked quarry.

#### Thief Rogue × Urchin — "Forgotten in Plain Sight"
- **Shared tags:** stealth, urban, overlooked
- **Synergy:** Your Thief's Fast Hands feature and the Urchin's urban knowledge stack — in any settlement where your Urchin network exists, your Fast Hands actions (picking pockets, disarming traps, using tools) can be performed as bonus actions even from 30 feet away (a child is doing the actual work, funneling the result to you). Additionally, Second-Story Work gains +10 feet of climbing speed in urban environments.

#### Thief Rogue × Criminal — "Hands of the Brotherhood"
- **Shared tags:** stealth, infiltration, deception
- **Synergy:** Your Thief's Use Magic Device feature allows you to invoke **Criminal contacts' magical supplies** — once per long rest, you can attempt to use a magic scroll, potion, or wand that you don't own by drawing on your network's reserves. You do not permanently gain the item; it's consumed in a single use. The cost is 20% of the item's market value, paid out of your gold or deducted from your reputation with the contact.

#### Arcane Trickster Rogue × Charlatan — "The Magician's Sleight"
- **Shared tags:** deception, manipulation, identity
- **Synergy:** Your Mage Hand Legerdemain becomes *invisible to specific target minds* — when interacting with a creature you've successfully Deceived in the last 10 minutes, they cannot detect your Mage Hand's actions even if it fails a Stealth check. Additionally, Minor Illusion cantrips you create are believed automatically by creatures whose Wisdom (Insight) you have beaten in the last 1 hour.

---

### Arcane & Magic Synergies

#### Lore Bard × Sage — "The Eternal Scholar"
- **Shared tags:** knowledge, research, analysis
- **Synergy:** Your Magical Secrets feature has expanded options — when you take Magical Secrets, you can choose from the wizard or druid spell lists in addition to your normal options, representing your Sage's accumulated knowledge of obscure traditions. Additionally, your Cutting Words feature applies to any Intelligence-based check a creature makes, not just attack rolls, ability checks, or damage rolls (you can reduce a creature's Arcana roll to identify your spell, for example).

#### Valor Bard × Soldier — "The War Poet"
- **Shared tags:** combat, leadership, performance
- **Synergy:** Your Bardic Inspiration die can be used by allies on saving throws against fear (not just attacks, ability checks, and saving throws) — your presence rallies them. Additionally, Combat Inspiration doubles when the recipient is a fellow Soldier Theme character — the Soldier recognizes the pattern and responds more effectively.

#### Valor Bard × Entertainer — "Heart and Voice"
- **Shared tags:** performance, emotion, spectacle
- **Synergy:** Your Bardic Inspiration die size increases by one step (d6 → d8 at L1, etc.) while you are actively performing (not in combat). This applies to inspirational speeches, pre-battle rallies, and public performances. The inspiration dice granted during these moments retain their enhanced size until used.

#### Divination Wizard × Sage — "The Pattern Seer"
- **Shared tags:** knowledge, analysis, patience
- **Synergy:** Your Portent dice become more flexible — you can now replace a d20 roll with your Portent die **after seeing the result** (instead of before the roll). Additionally, once per long rest, you can spend 1 hour in meditation to re-roll one of your unused Portent dice for the day.

#### Necromancy Wizard × Haunted One — "The Darkness Student"
- **Shared tags:** darkness, supernatural, trauma
- **Synergy:** Your Grim Harvest ability triggers additional healing when the slain creature is of a type you've identified with the Haunted One's Inured to Horror feature — you regain double the normal Grim Harvest amount. Additionally, your necromancy spells deal +1 necrotic damage per die when targeting creatures of those identified types.

#### Illusion Wizard × Charlatan — "The Master of Masks"
- **Shared tags:** deception, identity, manipulation
- **Synergy:** Your Illusory Self feature (saving yourself once per rest) now works in tandem with your Charlatan false identities. While operating under a false identity, you can invoke an Illusory Self once additional time per rest, with the illusion replicating the false identity rather than your true appearance (preserving the deception).

#### Transmutation Wizard × Clan Crafter — "The Material Master"
- **Shared tags:** materials, craft
- **Synergy:** Your Minor Alchemy feature (transmuting material in 10 minutes) combines with Clan Crafter's Material Mastery — you can now transmute up to **1 cubic yard** of material in 1 hour (instead of 1 cubic foot in 10 minutes). Additionally, your Transmuter's Stone can provide benefits to allies: while holding it, an ally also gains the chosen effect (60 ft darkvision, +10 ft speed, etc.).

#### Conjuration Wizard × Far Traveler — "The Planar Walker"
- **Shared tags:** travel, outsider, observation
- **Synergy:** Your Benign Transposition feature has expanded range — you can now teleport to any location you've physically visited within the past 7 days (not just 30 feet, not just once per long rest — this is a separate limited-use ability). Once per long rest, you can transpose yourself and up to one willing ally to a location you've visited.

#### Draconic Bloodline Sorcerer × Noble — "The Dragon-Blooded Heir"
- **Shared tags:** authority, hierarchy, lineage (broadly)
- **Synergy:** Your Draconic Presence fear/charm aura is more effective against creatures who recognize your noble bearing — they have disadvantage on the save if they know your family name and you identify yourself during the aura's invocation. Additionally, your Draconic Resilience (unarmored AC) expands to include your CHA modifier (instead of just DEX), representing the noble's bearing as a form of armor.

#### Wild Magic Sorcerer × Folk Hero — "The Accidental Legend"
- **Shared tags:** legend, community, chaos (by association)
- **Synergy:** When your Wild Magic Surge triggers a notably dramatic effect in front of common folk (DM's call), that effect becomes part of your Folk Hero legend. The next time you visit the area, commoners tell exaggerated versions of the story, and you automatically get the best Folk Hero recognition result in that region. The AI DM should lean into this — your wild magic becomes narrative fuel.

---

### Divine & Cleric Synergies

#### Life Domain Cleric × Acolyte — "The Pure Vessel"
- **Shared tags:** healing, faith, community
- **Synergy:** Your Disciple of Life (adds +2 + spell level to healing) bonus doubles for allies who have received your Acolyte Pastoral Counsel within the last 24 hours. The ally's spirit is more receptive to your healing. Additionally, your Preserve Life Channel Divinity now also removes one of: poisoned, frightened, or charmed from each target.

#### Knowledge Domain Cleric × Sage — "The Divine Scholar"
- **Shared tags:** knowledge, research, faith
- **Synergy:** Your Blessings of Knowledge feature grants you proficiency in additional skills equal to your Sage Theme tier (1 at L1, 2 at L5, 3 at L11, 4 at L17). Additionally, your Channel Divinity: Knowledge of the Ages can now also reveal a creature's true name or identity (if magically disguised), in addition to granting proficiency in a skill or tool.

#### Knowledge Domain Cleric × Hermit — "The Revealed Truth"
- **Shared tags:** truth, wisdom, meditation
- **Synergy:** Your Potent Spellcasting feature's damage bonus applies to any damage roll made by you, including weapon attacks (not just cantrips). Additionally, your Hermit's Revelation (L11 Theme ability) can be invoked once per short rest (instead of long rest) when you are actively praying to your deity.

#### Light Domain Cleric × Acolyte — "The Radiant Faith"
- **Shared tags:** faith, guidance, ritual
- **Synergy:** Your Warding Flare triggers additional effects on creatures you've formally blessed with your Acolyte's Faithkeeper ability — they are also briefly blinded for 1 round if the Warding Flare causes disadvantage. Additionally, your Channel Divinity: Radiance of the Dawn damages creatures who have violated a sacred space of your faith with +2d6 damage (DM judgement).

#### War Domain Cleric × Soldier — "The Battlefield Priest"
- **Shared tags:** combat, duty, faith
- **Synergy:** Your War Priest bonus attacks can be given to adjacent Soldier Theme allies (not just yourself) — they can use their reaction to make a weapon attack, consuming one of your War Priest uses. Additionally, your Guided Strike Channel Divinity grants +10 to a failed attack roll (instead of +10 to the attack roll period), usable retroactively if the attack missed by 10 or less.

#### Trickery Domain Cleric × Charlatan — "The Sacred Mask"
- **Shared tags:** deception, identity, manipulation
- **Synergy:** Your Invoke Duplicity can assume the form of *specific people* you have encountered (not just a shifting illusory version of yourself). This makes it function as a combined Disguise Self + Mirror Image. Additionally, your Charlatan Second Skin disguises cannot be detected as magical by non-divine means (Detect Magic won't reveal them).

#### Nature Domain Cleric × Outlander — "The Wild Shepherd"
- **Shared tags:** nature, wilderness, faith
- **Synergy:** Your Charm Animals and Plants Channel Divinity range doubles in your Outlander's chosen biome. Additionally, you can spend 10 minutes to commune with the land of your biome, learning the recent activities of non-magical beasts and plants within a 1-mile radius — merging the Nature Domain's connection with the Outlander's Voice of the Wild.

#### Tempest Domain Cleric × Sailor — "The Storm-Marked"
- **Shared tags:** storms, weather, sea
- **Synergy:** Your Wrath of the Storm reaction damage is doubled when you're on or near water. Additionally, your Destructive Wrath Channel Divinity can now be invoked once per short rest (instead of long rest) during an active storm — the storm empowers you.

---

### Warlock Synergies

#### Archfey Patron Warlock × Outlander — "Pact of the Woodland"
- **Shared tags:** nature, wilderness, fey
- **Synergy:** Your Fey Presence charm/fear aura affects creatures more strongly in your Outlander biome — they have disadvantage on the save. Additionally, your Misty Escape ability's invisibility lasts 1 minute (instead of until end of your next turn) when triggered in your chosen biome, and you can teleport up to 60 feet instead of 60 feet within the biome.

#### Archfey Patron Warlock × Entertainer — "The Fey Performer"
- **Shared tags:** performance, crowd, emotion
- **Synergy:** Your Beguiling Defenses (charm immunity + redirect) can now redirect *any* charm effect, not just attempts against you personally — you can extend it to allies within 30 feet as a reaction. Additionally, your Entertainer crowd-shifting abilities can invoke fey magic: creatures who fail the Performance check are also charmed (DC 8 + prof + CHA) as the fey magic leaks through.

#### Great Old One Warlock × Hermit — "The Secret Keeper"
- **Shared tags:** solitude, truth, supernatural
- **Synergy:** Your Awakened Mind telepathy extends to unlimited range with a creature you have shared 1 hour of meditation with during your Hermit Revelation. Additionally, your Entropic Ward reaction now also applies to saving throws (not just attacks) — your patron's whisper tells you when a save is coming.

#### Great Old One Warlock × Haunted One — "The Blooded Initiate"
- **Shared tags:** darkness, supernatural, trauma
- **Synergy:** Your Thought Shield's psychic resistance becomes **immunity** when dealing with creatures of fiend, aberration, or undead type (types the Haunted One has identified). Additionally, your Create Thrall's charm duration is permanent when used on a creature type the Haunted One recognizes.

#### Fiend Patron Warlock × Haunted One — "The Trauma Pact"
- **Shared tags:** trauma, supernatural, darkness
- **Synergy:** Your Dark One's Blessing temporary HP are doubled when you slay a creature of a type you've identified through the Haunted One's Inured to Horror. Additionally, your Dark One's Own Luck can be used once per short rest (instead of long rest) when you're in the presence of the creature type your Haunted One trauma is rooted in.

---

### Primal & Wild Synergies

#### Circle of the Land Druid × Hermit — "The Still Grove"
- **Shared tags:** solitude, meditation, nature
- **Synergy:** Your Natural Recovery from Circle of the Land now occurs during a short rest as well as the normal limitations (once per long rest) — the Hermit's meditation is sufficient to recover spell slots. Additionally, your Land's Stride trait expands: you take no damage from natural traps (spiked pits, punji sticks, etc.) as well as plant-based difficult terrain.

#### Circle of the Moon Druid × Outlander — "The Pack Bond"
- **Shared tags:** wilderness, nature, tracking
- **Synergy:** Your Combat Wild Shape (bonus action) recovery happens after a short rest (not just a long rest) when you're in your Outlander's chosen biome. Additionally, your Wild Shape forms gain an additional trait from the biome — forest druids might gain camouflage advantage, arctic druids gain cold resistance, etc. (DM determines specifics).

#### Hunter Ranger × Mercenary Veteran — "The Tracker-for-Hire"
- **Shared tags:** tracking, combat, pursuit
- **Synergy:** Your Hunter's Prey feature (Colossus Slayer, Giant Killer, or Horde Breaker) gains an additional +1 damage die against creatures of types your Mercenary Veteran's Contract Read identified as your target. Additionally, your Favored Enemy lore bonus doubles for creatures you've been paid to hunt (the contract information you absorbed is remembered).

#### Hunter Ranger × Urban Bounty Hunter — "The City Tracker"
- **Shared tags:** pursuit, tracking, urban
- **Synergy:** Your Natural Explorer's benefits apply in urban environments (not just wilderness terrain) when you're pursuing a marked quarry. Additionally, your Colossus Slayer/Giant Killer/Horde Breaker selection applies to your Bounty Hunter's marked quarry regardless of size (they count as your favored tactical target).

#### Beast Master Ranger × Outlander — "The Pack Brother"
- **Shared tags:** nature, wilderness, kin
- **Synergy:** Your companion beast gains the Outlander's biome specialization — it can be a creature native to that biome (not limited to the normal Beast Master list). In your chosen biome, your companion beast has advantage on attack rolls and +2 AC. Additionally, your companion understands the biome's ecosystem and can help with Survival checks related to that terrain.

---

### Monk Synergies

#### Way of Shadow Monk × Criminal — "The Ghost's Hand"
- **Shared tags:** stealth, urban, underworld
- **Synergy:** Your Shadow Arts ki cost is reduced by 1 (minimum 1) when cast in an urban environment. Additionally, your Shadow Step's invisibility duration extends to 1 full round (instead of end-of-next-turn) when used during a Criminal network operation.

#### Way of Shadow Monk × Urchin — "The Street Ghost"
- **Shared tags:** stealth, urban, overlooked
- **Synergy:** Your Shadow Step can be used in dim light *or* behind any cover larger than a creature (not just dim light or darkness). In urban environments, you effectively have shadow-step-anywhere capability. Additionally, your Opportunist feature (ally misses allow you to reaction-attack) applies to both allies AND enemies — the chaos of urban combat becomes your advantage.

#### Way of the Open Hand Monk × Hermit — "The Patient Strike"
- **Shared tags:** meditation, self-sufficiency, truth
- **Synergy:** Your Wholeness of Body's self-healing equals 3 × monk level (instead of 3 × level) when used after a 10-minute meditation. Additionally, your Quivering Palm's DC is increased by +2 against creatures whose physical weaknesses you've analyzed through Hermit practice (extended observation and meditation).

#### Way of the Four Elements Monk × Hermit — "The Elemental Sage"
- **Shared tags:** meditation, truth, self-sufficiency
- **Synergy:** Your elemental discipline ki costs are reduced by 1 after a 1-hour meditation (not during combat). Additionally, your Elemental Attunement cantrip effects become more pronounced — they can be perceived as magical effects with DC 15 Arcana (instead of being obvious flavor effects), allowing you to use them subtly for utility.

---

### Keeper (Custom Class) Synergies

#### Lorewarden Keeper × Sage — "The Library Made Flesh"
- **Shared tags:** knowledge, research, analysis
- **Synergy:** Your Lorewarden's text-based abilities (drawn from your Library Texts) can be shared with allies who have the Sage Theme — once per long rest, you can "lend" a single text's ability to a Sage for 24 hours, allowing them to invoke it once. Additionally, your text-recollection abilities trigger the Sage's Studied Mind as if you'd spent a short rest studying, even if you hadn't.

#### Mythslinger Keeper × Folk Hero — "The Legend-Weaver"
- **Shared tags:** legend, community, spectacle
- **Synergy:** Your Mythslinger's fabled weapons (manifested from mythic texts) are recognized by common folk as heroic artifacts. You gain advantage on all Folk Hero legend-building moments when wielding your manifested weapon in a context a commoner would witness. Additionally, your Voice of the People (L5 Folk Hero) extends — commoners who witness you use your manifested weapon tell *specific versions* of the story (passed through their local storytelling traditions) that weave into your legend.

#### Rhetorician Keeper × Noble — "The Silver-Tongued Heir"
- **Shared tags:** politics, authority, persuasion
- **Synergy:** Your Rhetorician's debate-based abilities work automatically in noble courts — you do not need to establish the rhetorical context before using them; the noble atmosphere IS the context. Additionally, your Noble's Audience guarantee can be redeemed to grant you an immediate Rhetorician's challenge-and-response session with the official (instead of just an audience).

#### Versebinder Keeper × Hermit — "The Prayer-Weaver"
- **Shared tags:** truth, meditation, solitude
- **Synergy:** Your Versebinder's binding abilities (based on recited truth) gain +2 DC when used after a Hermit's Revelation (L11 Theme ability) during the same session. Additionally, your binding texts can be shared with a willing ally — once per long rest, you can "gift" a bound verse to an ally, who can invoke its effect once within the next 24 hours.

---

### Summary & Next Steps

**Total synergies designed:** ~40 resonant subclass × theme pairings across all 12 classes.

**What's NOT covered:** The vast majority of subclass × theme combinations do not have hardcoded synergies. This is intentional — a Life Cleric + Mercenary Veteran is a perfectly valid character but doesn't have a unique named synergy (though the AI DM can still invoke generative tag-based moments when appropriate). Hardcoded synergies exist only for the most thematically resonant pairings.

**Design integration:**
- When a player creates a character, the system checks for resonant subclass × theme pairings and notes them on the character sheet
- The AI DM is informed of active subclass × theme synergies during session context building
- Synergy bonuses are passive — they apply automatically without activation
- Some synergies have narrative hooks the AI DM can leverage (e.g., Wild Magic Sorcerer + Folk Hero's "Accidental Legend" becomes story fuel)

**Next phases:**
1. Review for balance outliers — some synergies may be stronger than others; acceptable per design decisions
2. Mythic × Theme amplification combos (still pending from earlier decisions)
3. Implementation planning — database schema for tracking synergies, AI DM prompt integration, UI representation


## Appendix A — Review findings, carried verbatim

*Source: `Claude PM Review Docs/PARTY_SYNERGIES_REVIEW.md`.*

Working doc between user and PM Claude after a full read of `PARTY_SYNERGIES.md`. Captures issues to address; assumes things not flagged here are working as intended.

**Scope:** Issues only. Format: to-do. Each finding has a severity tag and a one-line recommended next step. Findings are deferred per user pending Themes review (which will likely create ripple effects here).

**Severity tags:**
- 🔴 **Bug/error** — clear mistake, no design judgment required to fix
- 🟡 **Open question** — design judgment needed; user decides
- 🟢 **Heads-up** — works as designed but has implications worth knowing

**Status:** Findings captured, deferred for later action. **Themes review may create ripple effects** — the synergy-Theme integration is tightly coupled, and any Themes design changes likely require revisiting this doc.

---

### Important framing context

Party Synergies is the most polished Pathfinder import in the project. Inspired by PF1E Teamwork Feats but reshaped to fit 5e — bounded numbers, simple triggers, no resource pools or extra action economy. The "trigger, not activate" decision avoids Pathfinder's notorious "did you take the right feat?" friction.

**The three-tier framework is genuinely clever:**
- Tier 1 (Gear & Positioning) — universally available, no Theme/training required
- Tier 2 (Theme Synergies) — automatic when compatible Themes are in party
- Tier 3 (Team Tactics) — explicitly trained, partner-locked

This means **any party can have synergies** (Tier 1 floor), and parties with compatible compositions get more (Tiers 2-3). No party is shut out from the system.

**This is a "meta-system."** Its job is to add depth on top of Themes, Companions, and Downtime — not introduce new content. Powerful pattern; also fragile, because every system below it can break it.

---

### What the design has right (preserved as guardrails)

- Three-tier framework (Gear / Theme / Tactics) with clear separation of concerns
- "Trigger, not activate" — no action economy or resource cost to fire synergies
- Tier 1 universals ensure every party has access to coordination
- Compatibility tags on every Theme enable Generative Synergies (AI fills the gaps)
- Generative system has explicit guardrails (mechanically modest, narratively flavored, called out in narration)
- "AI companions choose whether to engage" makes companion personality mechanically consequential
- Tier 3 capacity scales with proficiency bonus — no separate progression decisions
- Field-observation learning path for Team Tactics (learn-by-witnessing)
- Strong narrative flavor text on most Signature Synergies

These are load-bearing patterns. Don't break them when fixing other things.

---

### Category 1: Implementation reality

- 🟡 **"Status: In review" is ambiguous in the project's vocabulary.** Designed but not implemented? Implemented but not validated? Designed and partially implemented? Same shape of ambiguity as ANCESTRY_FEATS.md's status header. *Worth clarifying when this becomes active work — what's actually built in code?*

- 🟡 **AI DM integration is unbuilt (Next Phase #3).** Per the doc: "add synergy detection logic to the prompt builder so the AI knows when to trigger and narrate them." **A synergy system the AI doesn't know how to detect or narrate is invisible in play.** The doc has 35 Signature Synergies + 20 Team Tactics + 10 Gear synergies + a Generative system, but if the AI prompt doesn't surface these at the right moments, none of it lands. *This is the highest-leverage piece of work for this system.*

- 🟡 **Companion engagement layer is unbuilt (Next Phase #5).** "Tag companions with 'Synergy engagement likelihood' so the AI can roleplay choosing (or not choosing) to engage." This is the integration with Companions that makes the system mechanically meaningful. *A companion that automatically engages every synergy is identical to a companion with no personality. The "choose to engage" piece is what makes this system part of the BioWare benchmark, not just a rules layer.*

- 🟡 **"Train Team Tactic" downtime activity is unbuilt and depends on Downtime activation.** Per the doc: "The existing Downtime v2 system needs to be extended with a 'Train Team Tactic' activity." Per the Downtime review, Downtime has fallen into disrepair and pairs with starting an actual long-running character. **Tier 3 (Team Tactics) cannot exist until Downtime is functional.** Explicit dependency.

- 🟡 **Active synergy UI display is unbuilt (Next Phase #4).** Players need to know what synergies are available to them. The AI's per-turn eligibility check is currently a private decision; making it player-visible is a meaningful UX layer. *Important for player agency — without UI, players don't know to set up the conditions.*

---

### Category 2: Balance specifics

- 🟡 **Killing Floor (Mercenary Veteran × Mercenary Veteran) is a strong outlier.** Both below half HP → +2 attack and damage *for the rest of the encounter*. No save, no duration limit beyond "encounter," no per-rest cap. Two Mercenary Veterans who get bloodied early are doing +2/+2 for the rest of every fight. Compare to Bardic Inspiration (limited uses) or Battle Master maneuvers (limited Superiority Dice). *Probably needs scaling — duration-limited, escalating bonus, or per-rest cap.*

- 🟡 **Several Theme Synergies grant "advantage" with no resource cost.** Sworn Brothers, Faith in Steel, Hunter and Hunted, Master and Tradition, others. 5e treats advantage as a meaningful resource (Help action costs an action; Hide is gated). **Synergies that grant advantage automatically when triggered may compound with other advantage sources in ways the doc hasn't pressure-tested.** The doc itself flags this in Next Phases #2 (Battle Master + Shield Wall as example) but the issue is broader. *Soldier-Knight pair with Formation Advance + Faith in Steel + Sworn Brothers can stack a lot of bonuses in a single round.*

- 🟢 **The "below half HP" trigger pattern (used by 4 synergies) creates a meta-dynamic worth knowing.** Killing Floor, Last Stand, Back Together, Survivors' Creed all use it. **Rewards parties that take damage but stay engaged** — thematically rich, but means heal-tank parties that never drop below half can't access these synergies. *Probably intentional. Worth knowing as a design choice.*

- 🟢 **Generative Synergies guidance is appropriately bounded.** "Mechanically modest (advantage, +1 bonus, small temporary buffs)." *This is the right ceiling for AI-improvised effects. The risk of escalation is explicitly addressed.*

---

### Category 3: AI memory dependencies (move to AI_NARRATIVE_PERSISTENCE.md)

This system's memory dependencies are unusual — heavier on real-time pattern matching than long-term state.

- 🟡 **Per-turn synergy detection.** AI must check every combat turn against all eligible synergies for the party — Tier 1 (gear/positioning), Tier 2 (Theme pairs), Tier 3 (learned Team Tactics), plus Generative (shared tags). For a party of 4 with 6 Themes between them, that's a lot of patterns to check per round. *Pattern: "ambient pattern matching against multiple eligibility lists at high per-turn frequency" — same family as Companions thread-activation but more frequent.*

- 🟡 **Companion synergy engagement likelihood.** AI must consult companion personality data when *deciding* whether to take qualifying actions, not just when narrating. *Different flavor of AI behavior than most other systems — the AI is making strategic decisions on behalf of a character with personality, not narrating outcomes.*

- 🟡 **Field-observed Team Tactic mastery tracking.** "Some Team Tactics can be learned by repeatedly witnessing them in combat... The AI DM tracks these over the course of a campaign and notifies the player when a tactic has been implicitly mastered." *New pattern: "implicit mastery tracking through observed repetition." Requires AI to know which tactics are eligible for implicit learning, count repetitions, surface acquisition at the right narrative moment.*

- 🟡 **Synergy partner pairing memory.** "Team Tactics are tied to specific partners... the partner you've trained with for many sessions is mechanically irreplaceable." Requires per-pair state — character A knows tactic X with character B but not with character C. *Pattern: "relationship-state with mechanical consequences" — extends Companions' loyalty model into shared-skill territory.*

- 🟡 **Active synergy eligibility exposed to UI.** Per Next Phase #4. The AI's per-turn eligibility analysis is currently internal; making it player-visible is a UX layer. *Probably solvable but a real interface to design.*

---

### Category 4: Integration risks

- 🟡 **This is the second-most coupled system in the project (after Mythic).** Depends on:
  - Themes (the 21-Theme list and their tags)
  - Companions (personality engagement, synergy partnerships)
  - Downtime (Train Team Tactic activity)
  - AI DM prompt builder (synergy detection, narration)
  - UI (active synergy display)

  *Several of those have unresolved review findings that may ripple here. Themes review especially — if Themes review concludes the 21-Theme list needs revision, every Theme Synergy needs revisiting. If Themes shifts from 4-tier ability shells to a different progression model, the synergy-Theme integration may need rework.*

- 🟢 **The Companions integration is well-anticipated.** Next Phase #5 explicitly addresses it. *The implementation order will matter — synergies without companion engagement are mechanical-only; synergies with companion engagement are part of the BioWare benchmark.*

---

### Category 5: Design specifics worth flagging

- 🟢 **Tier 3 capacity scaling (PB-based) is elegant.** Proficiency bonus = max Team Tactics known. Scales naturally without per-level decisions. *Smart constraint that solves the "infinite tactics list" problem without explicit gating.*

- 🟢 **Trainer/guidebook acquisition is good narrative texture.** NPC trainers, rare martial manuals. *Creates quest hooks (find the lost manual of the Order's Sword-Brothers) and gives Theme-specific NPCs mechanical relevance beyond flavor.*

- 🟢 **Field observation learning is the most narratively interesting acquisition path.** Tactics learned through repeated witnessing. *The kind of feature that makes campaigns feel alive — your party slowly develops mastery just from playing together. Implementation is non-trivial but the design is right.*

- 🟡 **35 Signature Synergies is a lot to author with consistent voice.** Quality is generally high but variable — Sworn Brothers, Killing Floor, Survivors' Creed are strong. Some others are functional but less evocative. *Worth a polish pass on the flavor text when this becomes active work. Mechanical text is fine; narrative text is what makes the system feel alive vs. mechanical.*

- 🟡 **Some Theme pairs that seem natural don't appear in the Signature list.** No Hermit + Sage synergy (both knowledge-focused), no Folk Hero + Acolyte (both community-focused), no Sailor + Outlander beyond Land and Sea. *Either deliberate gaps for the Generative system to fill, or oversight worth filling. Worth checking against the tag table when this work activates.*

---

### Category 6: Cross-system observations

- 🟢 **The "trigger, not activate" framing is a project-wide pattern worth naming.** Several systems use ambient pattern matching to fire effects: Companions thread activation, Prelude emergences, Party Synergies. *Worth naming this as a pattern in AI_NARRATIVE_PERSISTENCE.md or a cross-cutting design doc — the project keeps returning to it, and it's likely to recur.*

- 🟢 **The system's flavor text is a model for what the project's narrative-first principles can produce.** "Sworn Brothers — The old oath-forms come back without thought." "Killing Floor — They've seen each other bleed before. It focuses them rather than frightening them." "Survivors' Creed — One has faced worse. The other has survived worse. Neither thinks this is the end." *These are the kind of small character moments the project's narrative-first principles aspire to — the opposite of the AI shelter-behavior issue. Earned, weighted, assume real stakes.*

- 🟢 **Inter-companion synergies are exactly the BioWare-benchmark territory.** Companion A and companion B working together while the player watches — this is "Alistair and Morrigan bouncing off each other" expressed mechanically. *One of the cleanest integration points between two reviewed systems (Companions × Party Synergies).*

---

### Suggested next moves (when this comes off the deferred shelf)

When Party Synergies activates (likely after Themes review at minimum, possibly after Companions focus area):

1. **Verify implementation reality.** What's actually built in code? Match against the doc.

2. **Re-audit after Themes review.** If Themes design changes, re-validate the synergy list. Theme tags, Theme pair compatibility, and Theme Synergy mechanics all depend on Themes being settled.

3. **Build AI DM detection and narration layer.** Highest-leverage single piece of work. Without this, the system is invisible.

4. **Build companion engagement layer.** Tag companions with engagement likelihood; integrate with personality data. Connects to Companions focus area.

5. **Balance pass on advantage-stackers and Killing Floor.** Specific fixes plus a broader pressure-test of multi-synergy combat rounds.

6. **Coordinate with Downtime activation for Tier 3 (Team Tactics).** Tier 3 is gated behind Downtime functionality.

7. **UI pass: active synergy display + acquired Team Tactics view.** Player-visible eligibility.

8. **Polish pass on Signature Synergy flavor text.** Some entries are excellent, some are functional. Lift the functional ones.

---

### What this review confirmed about the project

- The most polished Pathfinder import in the project. The 5e translation is mostly right — bounded math, simple triggers, no resource pools.
- The system is a "meta-system" — depends on Themes, Companions, Downtime, AI DM, UI all being right. Powerful but fragile.
- The flavor writing models what the project's narrative-first principles can produce.
- AI integration is the load-bearing missing piece. Until the AI knows how to detect and narrate synergies, the system is invisible.
- Companion engagement is the integration that makes the system meaningful for the BioWare benchmark.
- Themes review is likely to ripple into this system. Re-validate after Themes.

