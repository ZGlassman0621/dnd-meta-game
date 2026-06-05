# Companions — Design

Companions are NPCs who travel with the player character. Mechanically, they are full 5e D&D mirrors of the PC — every system that exists for the player exists for them too, with one exception: carried inventory and gold are pooled at the party level. Narratively, they are the characters who *should* outlive any single quest, accumulating opinions, mood, secrets, and a personal arc that intersects with the campaign rather than orbiting it.

This doc explains the design intent. For engineering detail (file paths, schema, marker syntax), see CLAUDE.md and the linked services.

---

## Design principles

**A companion is a fellow protagonist, not a tool.** They have their own goals, their own backstory, their own moods, and their own opinions about what the party is doing. The AI DM is told to play them as people — disagreeing, getting tired, asking for time off, refusing tasks that violate their values, sometimes leaving.

**Mechanical parity with PCs.** A companion has class levels (including multiclass), ability scores, AC, HP, hit dice, spell slots, conditions, death saves, themes, ancestry feats, and progression. The player should never feel like they brought a paper doll along. If a feature exists on the character sheet, it exists on the companion sheet.

**Narrative parity is the harder problem.** The mechanical mirror was built first. The harder ongoing work is making the AI DM *use* the companion's voice, mannerism, motivation, ideals, bonds, flaws, and current mood when generating dialogue and reactions. Companions accumulate enrichment over sessions (voice, personality, mannerism filled-not-overwrite), so the longer they travel with you, the more specific they get.

**Auto-progression for companions, opt-in for the player.** The player picks their own theme abilities, ancestry feats, and level-up choices. The AI deterministically picks them for companions based on personality data. No level-up menus for companions — choices arrive as small narrative beats ("Tormund grins. 'Time I learned the old stone-runner trick.'").

**The party is a shared inventory.** The recruiting character holds the gold and the carried items; companions hold only equipped gear (mainHand / offHand / armor). This avoids tedious bag-of-holding shuffling and matches how a real D&D party tracks loot. Companions can equip and unequip items from the party bucket via dedicated routes.

---

## Lifecycle

### Recruitment
A companion enters the party when the AI emits — or the player triggers — a recruit action against an existing NPC. The NPC's stats become the companion's `original_stats_snapshot`. From that point, the companion is its own row with its own progression, but the NPC record continues to exist and be referenced by relationships, conversations, and canon facts.

### Status states
Companions live in one of four states:

| Status | Meaning |
|---|---|
| `active` | Traveling with the party, present in sessions |
| `away` | Off on an independent activity (training, scouting, personal quest…) — see Activities below |
| `dismissed` | Voluntarily parted ways (player or companion-driven). `dismissed_reason` records why |
| `deceased` | Lifecycle propagation from the underlying NPC death — cascades through canon facts, promises, and the narrative queue |

Death matters. When a companion dies, the system propagates: their NPC record is marked `deceased`, any active promises they made or held get reconciled, the narrative queue gets a high-priority entry for the next session, and the AI DM is told the companion is gone. Resurrection is allowed; the lifecycle history table audits the transitions.

### Dismissal
Dismissal is a designed off-ramp, not just a delete. A dismissed companion's `dismissed_reason` is part of the world's memory — the next time the player visits that companion's home region, an NPC mail entry, a chronicle reference, or a returning-character beat may surface, depending on how they parted. Dismissal does not destroy progression or backstory; it preserves the relationship record.

---

## Companion identity layers

The companion's "self" is composed from several persistent layers, loaded into every DM prompt:

### Sheet (mechanical)
The base companion record (`companions` table) plus per-table extensions for theme, ancestry feat, multiclass, spell slots, hit dice, conditions, and death saves. This is the literal D&D character sheet. See migrations 028–031 for the progression schema.

### Backstory (narrative ground)
`companion_backstories` stores origin location, formative event, personal goal, secrets, and unresolved threads. This is the slow-changing layer — it's set at recruit time (often Opus-generated) and only grows by appending threads or revealing secrets.

### Loyalty (relationship score)
A 0–100 score per companion. Adjusted by player choices, fulfilled or broken promises, activity outcomes, and dramatic events. Loyalty is labeled in the prompt — `devoted` (90+), `loyal` (75+), `trusted` (50+), `uncertain` (25+), `distrustful` (10+), `hostile` (<10) — so the AI DM can register what the score *means* without needing to interpret a raw number.

Loyalty is the primary gate for **secrets**: each secret has a `loyalty_threshold`, and secrets only auto-reveal when loyalty crosses that threshold. A devoted companion shares things they would never tell a stranger.

### Mood (short-term emotional state)
A short-lived layer that shapes *how* a companion roleplays right now, not who they are. Ten valid moods (`content`, `anxious`, `angry`, `sad`, `fearful`, `excited`, `conflicted`, `grateful`, `resentful`, `exhausted`) each carry RP guidance ("anxious → nervous, second-guessing, seeking reassurance"). Mood has an intensity (1–5) and a cause string. Intensity decays by 1 per 2 game days and resets to `content` at zero. Activities, deaths, and dramatic events `setMood`; everyday play eventually melts it back.

### Threads (dormant story hooks)
A companion's `unresolved_threads` array holds tagged narrative hooks (`enemy`, `lost_person`, `secret`, `debt`, `prophecy`, `inheritance`) with activation triggers and intensity. These sit dormant. When the AI DM's narration matches a trigger phrase, location, or tag, the thread activates and gets queued as a narrative event for an upcoming session — a personal quest line spawned organically from the companion's history.

### Personality enrichment (filled-not-overwrite)
NPC voice / personality / mannerism / motivation / appearance / age description are accumulated over sessions via the same chronicle-extraction path that fills out static NPCs. The first time a companion travels with you, they may have only a handful of fields. Twenty sessions later, they have a fully realized voice. Once a field is set, it isn't overwritten — only filled if blank.

---

## Companion Activities (off-screen lives)

A companion does not have to be on-screen at all times. The Activities system lets the player send an active companion away on an independent task: `training`, `scouting`, `personal_quest`, `guarding`, `researching`, `shopping`, `socializing`, or `resting`. The companion's status flips to `away`, an `companion_activities` row tracks the assignment, and the world tick checks for completion based on game-day elapsed.

When the activity resolves, Opus generates a structured outcome — success level, story summary, reunion narrative, mood change, loyalty change, XP, items found, injuries, story development. Personality is fed in: a cautious companion may succeed at scouting but fumble at socializing; a brave one may take risks during training. A meaningful reunion narrative is queued for the next session, so the companion comes back with a story.

The player can `recall` an activity early (partial outcomes scaled by completion ratio) or `cancel` it (companion returns clean, no outcomes). Activities below 20% completion auto-cancel rather than partially resolve.

This is the foundational hook for **off-screen companion plotlines**: the personal-quest activity type is what allows a companion's unresolved thread to become a real episode that happens *away from* the party — and then to come home as a vignette delivered by the AI DM at the start of the next session.

---

## Companion choice in synergies and tactics

Synergies (Theme × Theme combos) and Team Tactics fire automatically when narrative conditions are met — both characters attacking the same target, both succeeding on the same skill check, both engaging in the same conversation. Crucially, a companion *chooses* whether to engage in the qualifying action based on their personality:

- A loyal cleric companion with the Acolyte theme will reliably set up Soldier-Cleric coordinated attacks
- A reckless barbarian companion with the Soldier theme might never play into flanking synergies because they prefer to charge alone
- A scholarly companion will reliably engage Sage-pair research synergies, while a pragmatist might find them tedious

**This is the design lever that makes companion personality mechanically consequential.** The player learns over time which companions reliably play into which synergies, and absences hurt more because losing a synergy partner removes options the party had become accustomed to. See PARTY_SYNERGIES.md for the synergy mechanics this rides on.

---

## Auto-progression at level-up

When a companion levels and crosses a tier threshold, the AI picks deterministically:

- **Theme tiers** (L1/L5/L11/L17): the AI uses the companion's voice, motivation, ideals, bonds, flaws, and alignment to pick from the eligible theme abilities. A pious cleric companion doesn't pick the same path a mercenary one would.
- **Ancestry feats** (L1/L3/L7/L13/L18): same selection model, scoped to the companion's race-list.
- **Class features and spells**: standard 5e progression with subclass-aware choices.

Selections are delivered as small narrative beats in the prompt, not menu modals. The companion's choices then become canonical — they show up in the progression view, they shape future synergies, they're referenced by the AI DM in subsequent sessions.

The open design question (flagged in AI_NARRATIVE_PERSISTENCE.md) is what happens when the AI picks something that contradicts established canon — whether the player gets a regenerate / override, and how the AI accesses the companion's full history when making the pick. Currently the player can override after the fact via the progression UI.

---

## Companions in combat and rest

**Initiative.** Companions roll initiative alongside the player and enemies. The combat tracker shows them as purple chips (player = blue, enemies = red). Their DEX modifier is taken from `companion_ability_scores`.

**HP, conditions, death saves.** Persistent across sessions. A companion who took poison damage and was knocked unconscious last session is still poisoned and still has those death-save successes / failures when the next session opens — until rest mechanics or HP recovery clear them per 5e rules.

**Rest.** Long rests restore HP, spell slots, and most conditions; reduce exhaustion by 1; clear death saves. Short rests allow hit-dice spending. Companions are part of the party's rest ledger, not a side calculation.

**Combat safety.** Migration 030 specifically added persistent condition + death-save tracking to companions because the previous session-only state was being lost between play sessions — a companion was effectively immune to lasting consequences. Now they aren't.

---

## Garrison & base roles

Once a party has a base (see CLAUDE.md "Party bases / fortresses"), companions can be assigned to officer roles in the `base_officers` table. A companion stationed at a base contributes to the base's `defense_rating` based on their level, class, and assigned role. They're not "with the party" while assigned, but they're not on an Activity either — they're stationed, available for raid defense, contributing income or upkeep relief, and visible on the base management screen.

This is the third lifecycle channel for a companion (active / away / stationed) and lets the player keep recruited NPCs alive in the world without dragging them through every adventure.

---

## Crafting recipe gifts

The `[RECIPE_GIFT]` marker fires when a companion (or NPC) gifts the player a recipe based on shared experience — an old soldier teaches a martial recipe after a campaign together, a druid companion teaches a salve after the party survived something nasty. The recipe is generated as `is_radiant=1` with the giver attributed. This is one of the strongest mechanical expressions of "the companion is teaching you something they know."

---

## What companions are NOT

- **Not a clone of the player.** They have lower autonomy in choices but stronger personality assertion. The player drives the trip; the companion makes the trip feel populated.
- **Not infinite.** A companion can die, leave, or be dismissed. Loss is part of the design — the world remembers, and the next companion isn't the same one with a different name.
- **Not an entitlement.** Loyalty can drop. Promises can break. A betrayed companion can leave permanently. The system is built to let the relationship deteriorate, not just deepen.

---

## Open / deferred design

- **Companion-driven downtime requests.** Designed in DOWNTIME_DESIGN.md (lines 382–399): the companion's downtime activity selection is AI-driven from personality data, with surfaced requests the player can approve, modify, or override. The full Downtime Planning screen is a multi-week build — currently parked.
- **Personal-quest companion arcs as session episodes.** The thread system spawns hooks; resolving them as full personal-quest sessions (companion-led, not party-led) is a design space that exists in seed but not in flow.
- **Companion mail / correspondence.** Away companions writing back, exchanged letters with absent companions (analog of the existing NPC mail system) — not yet built.
- **Inter-companion relationships.** Currently companion ↔ player and companion ↔ NPC are tracked. Companion ↔ companion warmth/trust (the DM-Mode-style party_relationships pattern) is not yet ported back to the player-mode side. This is the most natural next narrative-density upgrade for parties of 2+ companions.

---

## File pointers

Implementation lives across:

- `server/services/companionBackstoryService.js` — backstory CRUD, loyalty, secrets, threads, mood
- `server/services/companionBackstoryGenerator.js` — Opus generation at recruit time
- `server/services/companionActivityService.js` — Activities lifecycle + Opus outcome generation
- `server/services/companionTriggerChecker.js` — event-driven thread activation
- `server/services/progressionCompanionService.js` — auto theme + ancestry feat selection
- `server/migrations/001` (companions, companion_backstories), `004` (mood), `006` (activities), `028` (theme + ancestry feat), `029` (rest + spell slots), `030` (combat safety), `031` (multiclass), `032` (party inventory merge)
- `client/src/components/CompanionsPanel.jsx` — in-session companion overlay

For DM-prompt formatting of companion data, see `formatCompanions` and related helpers in `server/services/dmPromptBuilder.js`.
