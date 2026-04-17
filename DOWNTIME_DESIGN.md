# Downtime System Overhaul (v3)

Status: Design — overhaul of the existing Downtime v2 system.

## Design Principles

Built from locked-in decisions from this design phase:

1. **Between-sessions, not in-session.** Downtime is a separate mode entered between sessions. It doesn't compete with the AI DM's narrative authority during active play; it's a structured interlude.
2. **Authoritative time advancement.** The downtime system computes total elapsed days and advances the game clock before the next session begins. The AI DM is *informed* of time passed, not consulted.
3. **Parallel Limited.** Each character gets 1 Main Activity + up to 2 Background Activities.
4. **Time + Gold + Moderate Risk.** Daily lifestyle cost always applies. Some activities have material/skill costs. Risk is capped — no off-screen deaths, no major limb losses, no off-screen character moments.
5. **Vignette narration.** After downtime, the next session begins with 2-3 short vignettes covering the most notable events. System state updates are stated explicitly before vignettes.
6. **Companion personality matters.** Companions either auto-manage with personality-driven requests (default) or follow player direction.

## Why "between sessions" solves the time-tracking problem

The current system has the AI DM arbitrarily declaring time passage ("three days pass..." or "the next morning..."), which doesn't reliably sync with the `current_game_day` tracker. By moving downtime entirely out of AI DM narrative authority:

- Downtime mode calculates exact time from chosen activities
- System updates `current_game_day` atomically when downtime ends
- The next session's AI DM system prompt includes a **hard time statement**:
  > `DOWNTIME JUST COMPLETED: 12 in-game days passed between sessions. Current date: 15 Mirtul, 1492 DR. Time of day: mid-morning. Location: Waterdeep (High Hall district). Do not describe additional time passing; the party has just arrived at this moment.`

The AI DM still handles in-session time passage normally, but downtime is off-limits to AI interpretation. This makes time reliable *across session boundaries*.

## When downtime happens

**Triggers:**
1. **Player-initiated** (primary mode): Between sessions, the player opens the Downtime Planning screen and allocates activities.
2. **Suggested by AI DM** (secondary, optional): At natural narrative moments (chapter end, after major quest, party arrives at a safe location), the AI DM emits a `[DOWNTIME_WINDOW_OPEN]` marker that the system detects. The marker is structured, not keyword-matched. The system then surfaces a "downtime is available" notification when the player returns to the menu.

**Cooldown**: A downtime period requires at least 1 session since the last one. This prevents downtime-grinding.

**Duration cap**: A single downtime period cannot exceed 90 in-game days. Longer hiatuses require splitting into multiple periods.

## Time structure

**Unit:** In-game days. Each activity consumes a specific number of days.

**Allocation model:**
- Player selects a total number of downtime days for the period (e.g., "we're taking 14 days off in Waterdeep")
- Each character in the party allocates those days across activities
- Main activity + background activities all run in parallel during the allocated window
- Unallocated days count as "Rest" (small benefits: 1 hit die recovered per unallocated day beyond normal long rest)

**Example:**
> Party takes 14 days in Waterdeep.
> - **Torn (player)**: Main = Train Coordinated Strike with Sera (5 days) → free 9 days → Main = Craft masterwork longsword (7 days) → 2 days Rest. Background = Rumor Gathering (runs the whole 14 days), Correspondence.
> - **Sera (companion)**: Main = Train Coordinated Strike with Torn (5 days, shared) → free 9 days → Main = Research ancient Elven histories (6 days) → 3 days Rest. Background = Correspondence.
> - **Greta (companion)**: Main = Base Upgrade for guild hall (10 days) → 4 days Rest. Background = Faction work with Smith's Guild.

At the end: clock advances 14 days. AI DM is told everything that happened. Next session begins at the correct date.

## Parallel limited: Main + Backgrounds

Each character during a downtime period has:

**1 Main Activity slot** — Full-time focus. Uses the full daily time commitment. Delivers full benefit.

**Up to 2 Background Activity slots** — Runs alongside the Main activity throughout the downtime window. Because it's not the focus, Background activities:
- Deliver reduced benefit (typically 50-75% of full)
- May have lower skill check DCs (since you're doing this casually)
- Cannot include activities that require full focus (training a Team Tactic, major crafting projects, Mentor's Imprint deepening)

**What counts as Background-compatible:**
- Correspondence (maintaining NPC relationships)
- Rumor gathering
- Light reading / casual research
- Short business dealings (brief commerce, not running a shop)
- Network maintenance (urban, criminal, guild connections)
- Reflection / journaling

**What requires Main slot:**
- Training (Team Tactics, skills, weapons, languages)
- Crafting projects
- Mentor's Imprint deepening
- Faction missions
- Base upgrades
- Extended investigations
- Extended rest / exhaustion treatment

## Cost model

**Lifestyle cost** applies to every downtime day per character:
- **Squalid/Poor:** 1sp/day — survival living. Negative reputation effects in settlements.
- **Modest:** 1gp/day — default.
- **Comfortable:** 2gp/day — no ill effects; some social advantages.
- **Wealthy:** 4gp/day — advantage on Charisma checks with nobility, minor gifts received.
- **Aristocratic:** 10gp/day — aristocratic-level access, noble recognition.

**Material costs** vary by activity (crafting needs ingredients, base upgrades cost building materials).

**Risk profile:** Moderate at most. On a failed check:
- Activity delivers reduced benefit (not nothing)
- May lose some gold or materials
- May suffer a temporary social penalty (minor reputation hit)
- May cause a narrative complication (a rival notices you, a rumor spreads unintendedly)

**Never off-screen:**
- Character death
- Major limb loss or permanent disability
- Major character arc moments (those happen in session)
- Campaign-scale political collapses (saved for session play)

## Activity catalog

Organized by category. Each activity lists: **time cost**, **requirements**, and **outcome/benefit**.

### Character Training

**Team Tactic Training**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** A specific training partner (both characters must participate)
- **Benefit:** Both characters learn one Team Tactic. Pair-specific (you train Coordinated Strike with Sera, not with anyone else).
- **Risk:** None — training either succeeds or you try again.

**Language Learning**
- **Time:** 15 days (conversational) or 30 days (fluent). Reduced to 7/15 with Far Traveler L17.
- **Slot:** Main (for the first 7 days) or Background (extended practice)
- **Requires:** Access to a speaker of the language or a textual resource
- **Benefit:** Add a new language to your character sheet.
- **Risk:** None.

**Skill Practice**
- **Time:** 10 days
- **Slot:** Main
- **Requires:** Access to a trainer, text, or self-study opportunity
- **Benefit:** Gain temporary proficiency in the chosen skill for 30 days (not permanent — for that, use ASI/feat slots).
- **Risk:** Low — wasted time if you don't continue practicing beyond 30 days.

**Weapon Practice**
- **Time:** 7 days
- **Slot:** Main
- **Requires:** Access to a weapon trainer or similarly skilled ally
- **Benefit:** Gain familiarity with a new weapon type — advantage on attack rolls on your first 1d4 uses in combat with that weapon (practice benefits fade once real experience sets in).
- **Risk:** None.

### Relationships

**Mentor's Imprint Deepening**
- **Time:** 3+ days with the chosen mentor, over multiple downtime periods
- **Slot:** Main
- **Requires:** Previously declared Mentor (from the Mentor's Imprint system)
- **Benefit:** Accumulate progress toward the once-per-career mentor gift. AI DM tracks the cumulative bond and surfaces when the Imprint is ready.
- **Risk:** None.

**NPC Relationship Deepening**
- **Time:** 2 days per relationship tick
- **Slot:** Main or Background (Background tickrate is slower — 4 days per tick)
- **Requires:** Access to the NPC during downtime
- **Benefit:** Increases the NPC's disposition/trust. May unlock narrative hooks, shop discounts, access to restricted information.
- **Risk:** Low — a bad roll may cause a minor awkward moment or misunderstanding.

**Correspondence**
- **Time:** Background only (runs throughout downtime)
- **Slot:** Background
- **Requires:** Nothing beyond writing implements
- **Benefit:** Maintain relationships with distant NPCs/factions. Prevents absence-based disposition decay (from the NPC aging service). Essential for long campaigns where you can't personally visit everyone.
- **Risk:** None.

### Craft & Trade

**Crafting Project**
- **Time:** Variable per recipe (uses existing crafting system)
- **Slot:** Main
- **Requires:** Recipe, materials, appropriate tools
- **Benefit:** Produces the crafted item. Quality tier depends on skill check margin.
- **Risk:** Moderate — failed project may waste materials. Critical failure may damage tools.

**Recipe Research**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** Access to a library, workshop, or knowledgeable NPC
- **Benefit:** Discover a new recipe (from the discoverable recipes pool). DC 15 Int check modified by relevant proficiencies.
- **Risk:** Low — a failed check just wastes the time.

**Material Gathering**
- **Time:** 3 days
- **Slot:** Main
- **Requires:** Appropriate terrain (wilderness, specific biome, or urban market)
- **Benefit:** Collect a quantity of raw materials suited to the terrain.
- **Risk:** Low — wilderness gathering has minor exposure risk in harsh weather.

**Commerce**
- **Time:** Variable (3-7 days)
- **Slot:** Main
- **Requires:** Goods to sell or a merchant contact
- **Benefit:** Generate passive gold. Requires a Persuasion check; outcome scales with result.
- **Risk:** Low — a bad negotiation loses some gold or reputation.

### Faction Work

**Faction Mission**
- **Time:** 7 days
- **Slot:** Main
- **Requires:** Good standing with the relevant faction
- **Benefit:** Advance faction standing; complete a short mission the AI DM generates (extract the narrative summary into a vignette).
- **Risk:** Moderate — failure reduces standing, may result in faction-driven complication next session.

**Political Maneuvering**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** Appropriate lifestyle (Comfortable or higher), access to the political sphere
- **Benefit:** Shift faction politics, make key connections. May reveal information, open doors, or create a future obligation.
- **Risk:** Low — a bad roll may alienate one small faction or cost you a minor ally.

**Standing Building**
- **Time:** 3 days
- **Slot:** Background
- **Requires:** Presence in a settlement with faction activity
- **Benefit:** Small standing increase via visibility and minor actions.
- **Risk:** None.

### Party Base

**Base Upgrade Work**
- **Time:** Varies per upgrade (uses existing Party Base system)
- **Slot:** Main
- **Requires:** Party Base, materials, gold
- **Benefit:** Progress toward or complete a base upgrade.
- **Risk:** None — just time and gold.

**Staff Management**
- **Time:** 2 days
- **Slot:** Main or Background
- **Requires:** Party Base with staff
- **Benefit:** Hire, fire, or redirect base staff. Affects morale and specializations.
- **Risk:** None.

**Treasury Work**
- **Time:** 1 day
- **Slot:** Main or Background
- **Requires:** Party Base
- **Benefit:** Review income, adjust allocations, audit reserves. Minor gold optimization.
- **Risk:** None.

### Investigation

**Research**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** Access to relevant source material
- **Benefit:** Dig into a specific topic. Returns information appropriate to the skill check (DC 10 for basic, 15 for detailed, 20 for obscure).
- **Risk:** Low — a bad roll returns wrong or incomplete info.

**Rumor Gathering**
- **Time:** 3 days
- **Slot:** Main or Background
- **Requires:** Urban setting
- **Benefit:** Collect local rumors, tavern gossip, street intelligence. Returns 1-3 rumors depending on roll quality.
- **Risk:** Low — attracting attention of wrong people is possible.

**Intelligence Gathering**
- **Time:** 7 days
- **Slot:** Main
- **Requires:** A specific target (person, faction, location)
- **Benefit:** Investigate a specific subject; returns detailed, actionable information.
- **Risk:** Moderate — the target may learn they're being watched, creating complications next session.

**Map Making**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** Cartographer's Tools, firsthand knowledge of the area
- **Benefit:** Create a usable map. Grants the party advantage on navigation checks in that area.
- **Risk:** None.

### Personal

**Extended Rest**
- **Time:** 3+ days
- **Slot:** Main
- **Requires:** Comfortable lifestyle or better, safe location
- **Benefit:** Remove one level of exhaustion beyond normal recovery. Each additional 3 days removes another level.
- **Risk:** None.

**Meditation**
- **Time:** Varies (1-7 days)
- **Slot:** Main
- **Requires:** Solitude and appropriate practitioner (Hermit Theme, Mythic Path character, certain classes)
- **Benefit:** Advance Mythic arc progress (Redemption atonement acts may count), Hermit Revelation charge, or similar. Specific benefits depend on character background.
- **Risk:** None.

**Injury Recovery**
- **Time:** Per injury (typically 1-7 days)
- **Slot:** Main
- **Requires:** Safe location
- **Benefit:** Heal serious wounds that HP restoration alone doesn't address (scar tissue, broken bones, lingering effects of traumatic damage).
- **Risk:** Low — poor rest conditions may extend recovery.

**Reflection**
- **Time:** Background only
- **Slot:** Background
- **Requires:** Nothing
- **Benefit:** Process recent events mentally. Occasionally triggers character growth moments — AI DM may surface a personality development, realization, or bond moment during session recap.
- **Risk:** None.

### Community

**Folk Hero Deed-Telling**
- **Time:** 3 days in a settlement
- **Slot:** Main
- **Requires:** Folk Hero Theme, deeds worth telling
- **Benefit:** Build legend in the area. Progresses Folk Hero legend territory.
- **Risk:** Low — overly dramatic storytelling may create skeptics or rivals.

**Acolyte Temple Service**
- **Time:** 5 days
- **Slot:** Main
- **Requires:** Acolyte Theme, presence of a temple of your faith
- **Benefit:** Regain piety points (from Piety system). Contribute to temple's standing.
- **Risk:** None.

**Noble Court Appearance**
- **Time:** Variable (3-10 days)
- **Slot:** Main
- **Requires:** Noble Theme, appropriate lifestyle (Wealthy minimum)
- **Benefit:** Maintain political presence. May unlock political intelligence or opportunities.
- **Risk:** Moderate — political faux pas can have consequences.

**Volunteer Work**
- **Time:** 3 days
- **Slot:** Main
- **Requires:** Nothing
- **Benefit:** Do community good. Counts toward Redemption Arc atonement acts for characters on the Redemption Path (Mythic) or Knight Redemption Path (Theme).
- **Risk:** None.

### Underworld

**Criminal Network Maintenance**
- **Time:** 3 days
- **Slot:** Main or Background
- **Requires:** Criminal Theme
- **Benefit:** Keep your network of contacts warm. Maintains access to rumors, black market goods, safe houses.
- **Risk:** Low — a bad contact interaction may lead to future complications.

**Urchin Street-Child Check-ins**
- **Time:** 2 days
- **Slot:** Main or Background
- **Requires:** Urchin Theme, the L11+ street-child network
- **Benefit:** Maintain the network. Hear rumors that come to the children. Refresh relationships.
- **Risk:** None — unless you've treated children poorly, in which case the network may cool on you.

**Intel Trading**
- **Time:** 2 days
- **Slot:** Main or Background
- **Requires:** Have intel to trade
- **Benefit:** Exchange information for information. Useful when you know something but need something else.
- **Risk:** Low — traded intel may reach unintended ears.

### Exploratory

**Scouting**
- **Time:** Variable (per destination, typically 2-7 days)
- **Slot:** Main
- **Requires:** Knowledge of the destination or a rough map
- **Benefit:** Scout a location before the full party arrives. Provides terrain details, enemy positions, hazards.
- **Risk:** Low — scouting party may be spotted, causing enemy preparation.

**Travel Prep**
- **Time:** 2 days
- **Slot:** Main or Background
- **Requires:** Gold
- **Benefit:** Prepare for extended journey (supplies, permits, animals, guides).
- **Risk:** None.

**Hunting**
- **Time:** 3 days
- **Slot:** Main
- **Requires:** Wilderness
- **Benefit:** Generate food and materials. Survival roll determines quantity.
- **Risk:** Low — bad weather or aggressive wildlife may cut short the hunt.

**Job Board**
- **Time:** 1 day
- **Slot:** Background
- **Requires:** Urban setting with an adventurer's hall, tavern, or similar
- **Benefit:** Look for potential adventure leads for next session. AI DM may seed 2-3 hook options.
- **Risk:** None.

## Companion downtime

**Default mode: Auto-managed with personality-driven requests.**

Each companion has their downtime activities selected by an AI subroutine that considers:
- Their voice, mannerism, motivation, ideals, bonds, flaws (personality data)
- Their class and theme
- Their recent experiences in the campaign
- Any specific requests they would want to make of the player

**Companion requests surfaced to player:**
- "I'd like to spend this week visiting my family in Neverwinter." (narrative request)
- "Could we train a Team Tactic together? I'd like to learn Coordinated Strike with you." (collaborative request)
- "I want to take some time to pray. I need to reconnect with my faith after... everything." (personal request)

The player can approve, modify, or override. If approved, the request becomes the companion's Main Activity.

**Player-directed mode** (optional): Player manually assigns every companion's activities, ignoring requests.

## AI DM narration

When the next session begins after downtime, the AI DM's system prompt includes:

**1. Hard time statement** (always):
> `DOWNTIME JUST COMPLETED: [X] days have passed. Current in-game date: [Y]. Time of day: [Z]. Location: [settlement/area]. Weather: [brief]. Do not describe additional time passing; the party has just arrived at this moment.`

**2. Activity summary** (structured, machine-readable for the AI):
> ```
> DOWNTIME ACTIVITY RESULTS:
> - Torn (player): Trained Coordinated Strike with Sera (success). Crafted masterwork longsword (success, quality: superior). Gathered rumors (success, 2 rumors).
> - Sera (companion): Trained Coordinated Strike with Torn. Researched ancient Elven histories (success, found reference to Lost Tower of Myth Drannor). Spent Monday through Thursday visiting family — she'd like to share something with Torn privately.
> - Greta (companion): Completed Base Upgrade: Fortifications (complete). Faction work with Smith's Guild (success, +5 standing).
> ```

**3. Vignette instructions** (guidance for narration):
> ```
> NARRATE 2-3 VIGNETTES covering the most notable downtime events. Prioritize:
>   - Character-defining moments (Sera's family visit, Torn's crafting triumph)
>   - Relationship developments (Team Tactic training bonds)
>   - Story setup (the Lost Tower reference is a hook — make it feel important)
> DO NOT spend more than 2 paragraphs per vignette. DO NOT describe additional events beyond what's listed.
> ```

The AI DM then writes those 2-3 vignettes at the start of the new session, before presenting the current scene.

## Integration with existing systems

**Party Base**: Existing Blades-style base progression (levels 1-5 via renown, upgrades via hours invested) integrates cleanly. Base Upgrade Work is a main activity slot; the existing system tracks progress.

**Crafting System**: Existing crafting recipes, quality tiers, and tool proficiencies feed into the Crafting Project activity. No structural change needed — just a new UI flow for allocating crafting to a downtime period.

**Piety System** (Theros): Temple Service activity grants piety points per the existing table. Integrates directly.

**Mythic Path**: Atonement acts and corruption acts can be performed during downtime (Volunteer Work, Meditation for Mythic, etc.) or in session. Both count toward Mythic arc thresholds.

**Mentor's Imprint**: Requires AI gate (relationship + session count) + now also requires deliberate downtime time with the mentor (3+ days of Mentor's Imprint Deepening activity).

**NPC Aging/Absence**: The absence-based disposition decay system is offset by Correspondence (Background activity). This makes maintaining long-distance relationships feasible without requiring in-session visits.

## Implementation plan (high-level)

**Database changes:**
- `downtime_periods` table: `id, campaign_id, start_day, end_day, created_at, completed_at, character_ids (json), outcomes (json)`
- `downtime_activities` table: `id, downtime_period_id, character_id, slot (main/bg1/bg2), activity_type, parameters (json), outcome (json)`
- Extension to existing `characters.game_day` — downtime updates this atomically.

**Server-side services:**
- `downtimeService.js` — activity resolution, cost calculation, outcome generation
- `downtimePromptBuilder.js` — system prompt integration with the AI DM
- Companion AI activity selector (extends existing companion personality system)

**Client-side:**
- New Downtime Planning screen — appears between sessions, shows all active party members with activity slots
- Activity catalog UI — browse and select activities by category
- Companion request surfaces — modal dialogs asking for approval of companion requests
- Downtime results screen — recap of outcomes before starting next session

**AI DM prompt integration:**
- New section: `DOWNTIME RESULTS` injected into system prompt at session start
- Hard time statement included
- Vignette instructions included

## Future feature: Mobile notifications

Noted for posterity — the "phone notifications during downtime asking for decisions" idea is worth revisiting in the future:
- Would require web push or a mobile companion app
- Most useful for genuinely interactive downtime (companion requests, critical choices)
- Out of scope for initial implementation; log to FUTURE_FEATURES.md

## Summary

The downtime v3 system:
- Runs between sessions to avoid AI DM time-drift
- Authoritatively advances the game clock
- Uses Parallel Limited (1 Main + 2 Background) for activity structure
- Costs Time + Gold + Moderate Risk (never off-screen catastrophe)
- Supports 30+ activities across 10 categories
- Integrates cleanly with every other progression system (Themes, Ancestry, Mythic, Party Base, Crafting, Piety, etc.)
- Ends with the next session beginning with clear time statement + 2-3 vignettes by the AI DM

**Not designed here** (left for implementation phase):
- Exact UI wireframes
- Exact database schema details
- Specific Opus prompt text for vignette generation
- Specific numeric balance for all 30+ activities
