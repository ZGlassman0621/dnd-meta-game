# AI Narrative Persistence — Known Requirements

Standalone tracking doc for narrative-state requirements surfaced during system reviews. Each entry describes a piece of game state that the AI DM must track over time *and act on consistently* in future moments.

This is the throughline the brief names as the central engineering problem: "a single character should be playable for years without the AI losing the lore, the relationships, or the canon."

**Format:** Each entry has the source system, what state must persist, what the AI must do with it, and any open questions about implementation.

**Status:** Living doc. After nine system reviews, the picture is substantially built. The doc's original framing — "it will scope an engineering thread when enough entries land" — is now satisfied. The next phase for this doc is graduation from "running list" to "scoped engineering investigation," which happens in the consolidation-phase new chat alongside full project to-do construction.

**Last updated:** 2026-04-26 (post all nine reviews: Ancestry Feats, Keeper, Downtime, Prelude, Companions, Mythic, Party Synergies, Themes, DM Mode)

---

## Why this doc exists

During the Ancestry Feats review, we surfaced six items that all share a structural shape: features whose mechanical or narrative function depends on the AI tracking something across sessions and acting on it consistently. Each one in isolation is solvable. But the pattern — same shape repeating across many features — points at a project-wide concern.

The brief frames AI memory as load-bearing for the entire vision (years-long single-character play, faithful campaign module support, lineages of characters). This doc collects the concrete things the AI memory architecture has to support, so when we eventually build that thread, the requirements are already enumerated rather than rediscovered.

Subsequent reviews confirmed the original expectation: every gameplay system review added entries here. After nine reviews, the requirements list is substantial enough to scope real engineering work.

---

## Requirements (by source system)

### From Ancestry Feats review (2026-04-26)

#### Drow Lolth standing tracker
- **State:** A scalar or status value representing the Drow character's current standing with Lolth. Spectrum from devout-and-favored to apostate-and-cursed.
- **AI behavior required:** When the player triggers Lolth's Favor (or Defiance) at L13, the summoned spider's reliability and behavior depend on current standing. Devout Drow get loyal spiders; apostates may get refusal or unreliability.
- **Update events:** Player actions that align with or defy Lolth (assisting drow, killing drow, defending Lolth's interests, opposing them, encountering Lolth-aligned NPCs and how those interactions resolve).
- **Open questions:** What is the scale (numeric, categorical)? Where does it live in the schema? How is it surfaced to the player? Does the AI explicitly narrate standing shifts, or are they invisible until they trigger consequences?

#### Drow House Heritage NPC recognition
- **State:** Which Drow House the character originally belonged to + the circumstances of their departure.
- **AI behavior required:** When NPCs of the former House (or vassals) appear in scenes, they recognize the character on sight. Their disposition reflects departure circumstances — sympathetic, hostile, indifferent, vengeful.
- **Open questions:** How densely populated should Drow House NPCs be? In a campaign with no Drow content, this feat does nothing — is that acceptable? Should there be a fallback effect for non-Drow campaigns?

#### Aasimar Fallen Path's Choice
- **State:** Which path the character committed to at L13 (Redeemer's Path or Embraced Shadow). Permanent commitment.
- **AI behavior required:** "The world responds." Celestials may offer guidance to Redeemers; fallen creatures may find their presence unsettling. Embraced Shadow may earn fiend respect; celestials may turn from them. NPCs sense and react to the path on first meeting.
- **Open questions:** What's the operational meaning of "celestials may offer guidance"? Does this trigger specific encounter types, modify existing encounters, or change NPC dialogue patterns? How is "the world responds" actually implemented in the chronicle/world-state pipeline?

#### Aasimar Scourge "campaign arc" definition
- **State:** What constitutes an "arc" for the purpose of Final Judgment's once-per-arc gating.
- **AI behavior required:** Track when an arc starts and ends, allow the player one Final Judgment use per arc.
- **Open questions:** Is an arc declared by the player, by the AI DM, by reaching specific story beats, or by long-rest count? Should arc boundaries be visible in UI?

#### Companion auto-pick canon-coherence
- **State:** Companion personality traits, history, established choices, and ancestry feat picks.
- **AI behavior required:** When companions cross Ancestry tier thresholds, the AI selects feats consistent with the companion's established personality and history. Choices then become canonical.
- **Open questions:** What if the AI picks something that contradicts established canon? Is there a remediation path (player override, regenerate request)? How does the AI access the companion's full history when making the pick?

#### Tiefling Devil's Bargain narrative beat
- **State:** None to persist; this is a per-turn prompt-design question.
- **AI behavior required:** When the player invokes Devil's Bargain (1d6 psychic for advantage on Charisma check), the AI should occasionally narrate the cost as a story beat — a small piece of memory or hope traded — rather than just applying damage.
- **Open questions:** Should this be probability-based (X% chance of narrative narration vs. mechanical-only)? Triggered by specific contexts (high-stakes scenes)? Or always narrated?

#### Human Quick Study temporary proficiency tracking
- **State:** Which skill the player gained temporary proficiency in via Quick Study, and when the 24-hour duration started.
- **AI behavior required:** Honor the temporary proficiency for 24 hours of game time. Notify when it expires. Replace it correctly when the player uses Quick Study again.
- **Open questions:** Does existing turn/time tracking handle 24-hour-of-game-time durations? Or is this new state requiring schema work?

### From Keeper class review (2026-04-26)

#### Eidetic Memory (Keeper L5)
- **State:** A complete log of every text the character has ever read or encountered — not just the ones in their selected library, but texts seen in NPC libraries, mentioned by NPCs, witnessed in the world, glimpsed through magical effects, etc.
- **AI behavior required:** When the player uses Eidetic Memory ("Advantage on INT checks to recall any text ever read"), the AI must consult this log and grant the advantage based on actual encountered content. The class identity hinges on the AI honoring "you have read this" as a real fact, not a generic boost.
- **Memory cost:** Small per-text (title + author + sentence-or-two description, per user clarification). The persistence question is which texts, not how much per text.
- **Open questions:** Where does the encountered-text log live in the schema? How is it surfaced to the AI in prompts (full list every turn? Filtered by relevance?)? Does the player ever see the log, or is it AI-only?

#### Unwritten Knowledge (Keeper L14)
- **State:** Which "notable enemies" the character has defeated and which "lore sites" they've discovered, throughout the entire campaign history.
- **AI behavior required:** At L14, the feature unlocks. The AI must surface text-acquisition opportunities tied to past defeats and discoveries — "from your study of the lich-queen you defeated three years ago, you can now articulate her last memoirs as a manifested text." Up to INT mod bonus texts can come from this source.
- **Note:** This is "the cobbler in the third town" pattern from the brief, made into a class feature. A Keeper at L14 retroactively benefits from sessions hundreds of game-hours in the past.
- **Open questions:** What qualifies as "notable enemy" vs. just "an enemy"? What qualifies as a "lore site"? Are these flagged at the time of encounter, or determined retroactively at L14? How does the AI suggest which past events should yield a text?

#### Genre Domain flavor consistency
- **State:** Which Genre Domain(s) the character has chosen, and the flavor framing associated with each.
- **AI behavior required:** When the character invokes Genre features (Mastery Capstone, passive benefits, Polymath: Renaissance Scholar), the narrative tone should match the Genre. A History Keeper's "Lesson of the Past" should feel scholarly-archival; a Mythology Keeper's "Mythic Invocation" should feel mythic-elevated; a Forbidden Texts Keeper's "Forbidden Chapter" should feel transgressive. The AI must honor these flavor differences across all uses, not just at selection time.
- **Open questions:** Is this a prompt-engineering question (Genre flavor injected into prompts when relevant), a per-character static prompt addition, or something else? How granular should the flavor consistency be?

#### Keeper's libraries as in-world places
- **State:** Which libraries the character has visited or studied at, what was there, when they were last there.
- **AI behavior required:** When the Keeper returns to a previously-visited library, the AI should remember the prior visit, possibly reference what texts were available there before, and possibly grant Genre-related boons for being in a thematically-aligned library (e.g., a History Keeper at a historical archive).
- **Note:** This isn't strictly Keeper-specific — it's the general NPC/place persistence pattern from the brief ("the cobbler in the third town"). But the Keeper's class identity makes places mechanically relevant in a way they aren't for other classes.
- **Open questions:** Already covered by the project's general place/NPC persistence (which is part of the world-state tick pipeline)? Or does Keeper need additional place-tracking?

### From Downtime review (2026-04-26)

#### Activity outcome generation per character personality
- **State:** Each companion's personality, voice, motivation, current mood, and history of past activity outcomes.
- **AI behavior required:** When a companion is sent on an off-screen activity, Opus generates an outcome (success level, mood change, loyalty change, story development) shaped by the companion's personality. A cautious scout fumbles socializing differently from how a brave one fumbles training.
- **Open questions:** How is personality "fed in" to the generator — full personality block as prompt context, or extracted attributes? Does outcome generation reference past activity outcomes (avoid repetition / build continuity) or generate independently each time?

#### Faction standing tracking at scale
- **State:** Per-faction standing for the player and possibly companions. Updates from quest outcomes, downtime activities, off-screen events.
- **AI behavior required:** AI consults faction standing when generating NPC reactions, quest availability, world events. Standing changes have visible consequences in play.
- **Open questions:** How many factions exist in a typical campaign? How granular is the standing scale? How does it interact with notoriety?

#### Reunion narrative queue
- **State:** Pending reunion narratives for companions returning from activities. Queued at activity completion; delivered at next session start.
- **AI behavior required:** Generate a meaningful reunion vignette — not just "Mira returns" but the story of what happened. Surface at session start. Persist if session ends before delivery.
- **Open questions:** Order of delivery if multiple pending reunions? How does this interact with main session opening prose density?

### From Prelude review (2026-04-26)

#### Arc plan as living reference
- **State:** Opus-generated multi-chapter arc plan for the prelude — chapter beats, recurring threads, departure seed, character trajectory, seeded emergences. Persists across all 5 prelude sessions.
- **AI behavior required:** Sonnet consults the arc plan at session start, injects relevant chapter beats, and "riffs within bounds." Player choices that diverge are allowed; the plan flexes.
- **Open questions:** How is the arc plan stored and consulted? When does Sonnet "decide" to deviate vs. honor the plan? Does the plan get mutated by play, or stay reference-only?

#### Emergence tracking with chapter-weighted tallies
- **State:** Per-prelude-character tally of stat / skill / class / theme / ancestry / value emergences fired during play. Late-chapter hints count more (1x / 1.5x / 2x by chapter).
- **AI behavior required:** Detect emergences in play, cap and tally appropriately, give AI feedback when caps are violated. At prelude end, weighted tallies determine winning class/theme/ancestry.
- **Open questions:** How is the running tally exposed to the AI mid-prelude vs. at prelude end? What happens when the player declines an emergence offer — is the tally affected or just the offer?

#### Canon NPC and location persistence (Prelude → Main Campaign)
- **State:** NPCs marked `[NPC_CANON]` and locations marked `[LOCATION_CANON]` during prelude become canonical world content for the main campaign that follows.
- **AI behavior required:** Detection during prelude, dedup against existing canon, persistence into prelude_canon_* tables, transfer logic to primary campaign generation.
- **Open questions:** What if a prelude canon NPC contradicts a primary-campaign-generated NPC? How is the prelude canon "available" to the main campaign — full injection, on-demand reference, or surfacing as the AI chooses?

#### Mentor imprint seeding (Prelude → Main Campaign)
- **State:** Mentor figures from prelude with relationship state at prelude end (warmth, trust, history, formative beats).
- **AI behavior required:** Seed primary campaign's mentor_imprints with prelude state. The mentor relationship arrives at primary campaign with prior history intact, not as a new relationship.
- **Open questions:** Same shape as the canon-NPC question — how is mentor history surfaced in main campaign prompts?

#### Remembered-voice backstory generation
- **State:** Full prelude session history accessible to Opus.
- **AI behavior required:** Post-prelude, Opus writes a 3-5 paragraph backstory in the voice of the adult character looking back, with allowed gentle distortion. ("you remember her as taller than she was.")
- **Open questions:** What gets included from session history vs. excluded? How is "voice shift" engineered in the prompt? How explicit is the distortion guidance?

#### Transient canon flag for Ch4 (Round 3 reframe)
- **State:** Each canon NPC/location flagged `transient` boolean, defaulting TRUE for Ch4 introductions.
- **AI behavior required:** AI can promote transient → permanent via `[CANON_FACT_PROMOTE]` marker. At handoff, transient items filter out unless promoted.
- **Open questions:** This is per the Round 3 reframe which is "design logged, implementation deferred." When implemented: when does the AI promote vs. let things fade?

### From Companions review (2026-04-26)

#### Personality enrichment over hundreds of sessions
- **State:** Per-companion voice / personality / mannerism / motivation / appearance / age description fields. "Filled-not-overwrite" — once set, never replaced; only filled if blank.
- **AI behavior required:** Per-session enrichment extraction surfaces new traits when behavior reveals them. Blank-detection logic prevents overwrite. Full profile injects into prompts.
- **Open questions:** What is the right granularity for fields? When does a "voice trait" become canonical vs. tentative? How does the AI decide what to write into a blank field vs. leave blank?

#### Loyalty score persistence and labeling
- **State:** Per-companion 0-100 scalar with text labels (devoted/loyal/trusted/uncertain/distrustful/hostile).
- **AI behavior required:** AI consults the label, acts on its meaning, updates based on player choices, fulfilled or broken promises, dramatic events. Same shape as Pattern A (Drow Lolth standing) but companion-specific.
- **Open questions:** Generally well-understood pattern. Open mostly for: how aggressive should loyalty changes be? What's the velocity for damage vs. recovery?

#### Secrets gated by loyalty thresholds
- **State:** Per-companion list of secrets with `loyalty_threshold` per secret.
- **AI behavior required:** AI knows which secrets exist, what their thresholds are, and surfaces them dramatically when crossed — not casually.
- **New pattern:** "Conditional revelations gated by relationship state."

#### Thread activation by narration matching
- **State:** Per-companion `unresolved_threads` array — tagged narrative hooks (enemy, lost_person, secret, debt, prophecy, inheritance) with activation triggers and intensity.
- **AI behavior required:** AI checks incoming narration against thread triggers. Threads activate, get queued as narrative events for upcoming sessions. Resolved threads close.
- **New pattern:** "Ambient pattern matching against character history." First explicit naming of what later becomes a project-wide pattern (see Cross-cutting observations).

#### Mood as short-term layer with decay
- **State:** Per-companion mood (10 valid states) with intensity (1-5) and cause string.
- **AI behavior required:** Set mood from events. Decay 1 per 2 game days. Reset to content at zero. AI plays current mood — not original tension.
- **Open questions:** Are 10 states enough granularity? Should some moods (grief-shaped) resist standard decay?

#### Auto-progression with personality-aware picks
- **State:** Companion's full personality + history + established canon at level-up time.
- **AI behavior required:** AI selects theme abilities, ancestry feats, class features in line with established canon. Choices become canonical.
- **Open questions:** What if AI picks something that contradicts canon? Player override path exists; ideal would be the AI not contradicting in the first place.

#### Lifecycle propagation on companion death
- **State:** Active companions with `status: deceased` trigger cascade.
- **AI behavior required:** NPC record updates to deceased. Active promises reconcile. Narrative queue receives high-priority entry. AI is told the companion is gone.
- **New pattern:** "Death as cascading state update across multiple subsystems."

#### Inter-companion relationship state (when implemented)
- **State:** Per-pair warmth/trust between companions, directional (A→B independent of B→A).
- **AI behavior required:** AI plays current pair-state in dialogue and reactions, updates via shifts during meaningful moments.
- **Open questions:** Currently deferred in Companions design but reclassified as "required for BioWare benchmark" per Companions review. DM Mode has the working implementation pattern (`party_relationships`).

#### Dismissed companion return triggers
- **State:** Dismissed companions list, dismissal_reason, time elapsed since dismissal.
- **AI behavior required:** When player visits the companion's home region, AI surfaces NPC mail / chronicle reference / returning-character beat depending on dismissal terms.
- **Open questions:** What determines whether a returning beat happens — pure time, player actions in the meantime, loyalty at dismissal? The "may surface" language gives latitude with no guidance.

### From Mythic review (2026-04-26)

#### Trial tracking
- **State:** Per-character active trials (which trials, conditions, progress).
- **AI behavior required:** Track which trials are in-progress for each character, what success/failure conditions are. Trials may not be visible to the player — the AI must impose stakes the player can't see coming.
- **New pattern:** "AI-tracked narrative arcs the player isn't told about." Same shape as the AI shelter-behavior risk from Prelude — the AI must impose stakes consistently. Risky if not handled deliberately.

#### Piety tracking per deity per character
- **State:** Per-character per-deity Piety scalar across 53 deities.
- **AI behavior required:** Increase / decrease piety from actions. Surface threshold abilities at 3, 10, 25, 50. Same shape as Pattern A (standing) but multiplied by 53 and across the whole party.
- **Open questions:** Storage scale (53 × N companions × N campaigns). UI surfacing. Default piety for non-aligned characters.

#### Path commitment as permanent narrative state
- **State:** Per-character chosen Mythic Path, current Tier, trial history.
- **AI behavior required:** Once chosen, the world responds — gods take notice, planar entities respond, factions react. Sustained AI response over potentially years of play.
- **Pattern:** Pattern B (permanent narrative commitments).

#### Mythic monster combat narrative state
- **State:** Per-encounter mythic boss state — primary HP, mythic-trait HP (second bar), mythic actions available.
- **AI behavior required:** When mythic-trait fires (boss reduced to 0 HP), AI narrates phase transition, restores HP, unlocks Mythic Actions. Player must register "they're not dead, the fight enters phase 2."
- **Open questions:** Combat state machinery is largely solved; this extends it.

#### Legendary items with three states
- **State:** Per-item state (Dormant / Awakened / Exalted) + narrative milestones reached.
- **AI behavior required:** Items grow in power through milestones. State persists across campaigns.
- **Pattern:** Pattern F (long-term campaign history as mechanical resource) — extends the Keeper "Unwritten Knowledge" pattern.

#### Cross-campaign character continuity
- **State:** Campaign-level state separate from session state. Character migration between campaigns. World-state continuation.
- **AI behavior required:** Multi-Campaign Timeline assumes a single character (or party) progresses across multiple campaigns. Campaign II builds on I; III on II.
- **Open questions:** This is north-star "lineages of characters" territory expressed differently. May share infrastructure when both are built.

#### Hidden mythic NPC progression
- **State:** Per-major-NPC mythic tier, trial progress (hidden from player).
- **AI behavior required:** AI runs a mythic NPC the player isn't fully aware of, advancing through trials and tiers as the campaign progresses, eventually surfacing as a mythic-tier antagonist.
- **New pattern:** "AI runs hidden parallel character progression for opposition." Likely applies to other major NPCs too.

#### Shadow Points as gating
- **State:** Per-character Shadow Points scalar (existing system).
- **AI behavior required:** Light paths require Shadow 0-2 for full power. Dark paths gained through accumulation. Cross-system dependency on existing Shadow Points infrastructure.
- **Open questions:** Verify Shadow Points infrastructure is functional when Mythic activates.

### From Party Synergies review (2026-04-26)

#### Per-turn synergy detection (high-frequency pattern matching)
- **State:** Active synergies for the party — Tier 1 (gear/positioning), Tier 2 (Theme pairs), Tier 3 (learned Team Tactics), Generative (shared tags).
- **AI behavior required:** Check every combat turn against all eligible synergies. For a party of 4 with 6 Themes, that's a lot of patterns per round.
- **New pattern:** "Ambient pattern matching against multiple eligibility lists at high per-turn frequency." Same family as Companions thread activation but more frequent.

#### Companion synergy engagement likelihood
- **State:** Per-companion personality data + engagement-likelihood tag per synergy type.
- **AI behavior required:** AI decides whether to take qualifying actions based on personality. A reckless barbarian might never set up flanking synergies. Strategic decisions on behalf of a character with personality, not just narrating outcomes.
- **Open questions:** How is "engagement likelihood" represented? Per-synergy-type tag, or computed from personality at runtime?

#### Field-observed Team Tactic mastery tracking
- **State:** Per-character per-tactic observation count.
- **AI behavior required:** Some Team Tactics can be learned by repeatedly witnessing them. AI tracks observations over the course of a campaign and notifies the player when a tactic has been implicitly mastered.
- **New pattern:** "Implicit mastery tracking through observed repetition."

#### Synergy partner pairing memory
- **State:** Per-pair learned tactics — character A knows tactic X with character B but not with character C.
- **AI behavior required:** Honor partner-locked tactics; surface them when the right pair is in proximity.
- **Pattern:** "Relationship-state with mechanical consequences" — extends the loyalty model into shared-skill territory.

### From Themes review (2026-04-26)

#### Geographic fame tracking (Folk Hero)
- **State:** Per-Folk-Hero "home region" + adjacent regions + distant regions + foreign cultures.
- **AI behavior required:** AI tracks current fame radius, expands as deeds accumulate, rolls recognition appropriately when entering new settlements (d20 table), surfaces fame in NPC reactions.
- **New requirement type:** Per-character per-location persistent state at scale.

#### Street children network state (Urchin)
- **State:** Per-city network state, per-city loyalty/cost balance, accumulated obligations, named children who didn't survive.
- **AI behavior required:** Surface network availability when entering visited cities. Track ethical cost — children who trusted the Urchin had real lives. Network loyalty is earned and maintained.
- **Significant new state category:** Includes ethical cost as a tracked dimension, not just a flavor note.

#### Acolyte pastoral memory
- **State:** Per-NPC emotional state, hidden information, disposition (when an Acolyte has spent 10+ minutes with them).
- **AI behavior required:** Surface emotional reads, hidden tensions, dispositional shifts when an Acolyte engages an NPC. Same shape as Companion personality enrichment but for every NPC the Acolyte spends time with.
- **Open questions:** How does this scale? An Acolyte in a high-NPC-density city could accumulate state on dozens of NPCs.

#### Sage lore consistency
- **State:** World canon — facts about creatures, objects, locations, events that the AI has previously asserted as true.
- **AI behavior required:** Sage L5 "ask the DM one question." AI must answer based on consistent world canon, not improvise different answers across sessions. "The cobbler in the third town" expressed as a class feature.
- **Pattern:** Pattern F. Every Sage question creates canon that future Sages will reference.

#### Theme tier tracking per character
- **State:** Per-character active Theme + tier (L1/L5/L11/L17 unlocked status).
- **AI behavior required:** AI knows everyone's Theme and tier. Applies effects accordingly. Surfaces tier-specific abilities at the right moments.
- **Standard infrastructure but multiplied across every party member, including companions.**

#### Mythic × Theme arc tracking
- **State:** Per-character active dissonance arc, beat count toward resolution (e.g., 7 Community Anchors for Demon+Folk Hero, 9 Moments of Acceptance for Lich+Acolyte, 7 Acts of Secret Service for Trickster+Knight).
- **AI behavior required:** Recognize specific narrative beats in play. Count toward arc resolution. Deliver story beats. Reveal unique mechanical abilities when arc resolves.
- **Complex narrative state machine territory.**

#### Subclass × Theme synergy state
- **State:** Per-character active resonant subclass × theme pairing (if any).
- **AI behavior required:** AI knows which synergies are active. Pattern-matches on character state plus situational conditions. Surfaces synergy bonuses in narration.
- **Always-on but contextual** — different shape from the per-turn pattern matching of Party Synergies.

### From DM Mode review (2026-04-26)

#### Per-pair directional warmth/trust scores across N characters
- **State:** 4 party members = 12 directional pairs (4 × 3). Scores update via `[BOND_SHIFT]` markers.
- **AI behavior required:** Play current relationship state — not original tensions. After 20 sessions, the alliance map is unrecognizable. Update via marker emission when moments meaningfully change relationships.
- **New pattern:** "Directional inter-NPC relationship state." Distinct from Companion loyalty (companion-to-player) and from Theme tags (static). Likely the implementation pattern that should also serve inter-companion relationships in Player Mode.

#### Voice consistency across sessions for AI-controlled party characters
- **State:** Per-character voice traits (filled-not-overwrite) + mutual-distinctness constraint across the four characters.
- **AI behavior required:** Maintain four distinct voices not just within a session but across many. If voice enrichment for one character drifts toward generic, the "covered names" test fails.
- **New pattern:** "Multi-character voice consistency with mutual-distinctness constraint."

#### Secret protection across sessions, multi-revealable per character
- **State:** Per-character list of secrets, conditions for reveal, reveal status.
- **AI behavior required:** AI must remember which character has which secret, what conditions warrant revealing it, and not surface it prematurely.
- **New pattern:** "Long-running revelation gating with multiple revealable items per character."

#### NPC Codex auto-synced from chronicles
- **State:** Cross-session NPC tracking. Stable traits (race, class, age, personality, connections) fill-not-overwrite. Volatile traits (location, status, disposition) always-update.
- **AI behavior required:** Aggregator merges chronicles with manual edits. Recurring NPCs sort to the top. Codex panel surfaces accumulated data.
- **Same pattern family as Player Mode but with explicit fill-vs-update distinction worth recognizing.**

#### Plot threads with state from latest mention
- **State:** Per-thread state (active, resolved). Tags. Source (auto vs manual). First-seen / resolved-session.
- **AI behavior required:** Threads accumulate. Resolution determined by latest chronicle mention. Active threads inject into prompts as ongoing storylines.
- **Pattern:** "Narrative state machine where current state is determined by latest update, not aggregated history."

#### The bond-shift mechanism (project-wide pattern instance)
- **AI behavior required:** AI emits a marker when a moment "meaningfully changes" how characters feel. The judgment of "meaningfully changes" is AI initiative.
- **Pattern:** Fifth occurrence of the project-wide ambient-pattern-matching pattern (Companions threads, Prelude emergences, Party Synergies eligibility, Themes proactive surfacing, DM Mode bond shifts). **This pattern is now confirmed as project-wide and worth naming explicitly.**

---

## Cross-cutting observations

After nine system reviews, six patterns are visible. The original five from the earlier draft hold; one new pattern (F) was named in the Keeper review and reinforced repeatedly since. Two AI behavior patterns also emerged that are inseparable from the persistence work.

### State-tracking patterns

**Pattern A — Standing/relationship tracking.** Lolth standing is the cleanest example. Mythic piety (53 deities) is the same shape × 53 × party. Faction relationships, NPC bonds, companion loyalty, DM Mode bond-shifts all fit. **Likely a single underlying mechanic, applied many times.**

**Pattern B — Permanent narrative commitments that the AI must honor.** Path's Choice. Theme commitment in prelude Ch3. Mythic path commitment. Genre Domain choice. Subclass choice at L6. **Requires both storage and active prompting — the data has to persist *and* the AI has to be reminded to consult it at relevant moments.**

**Pattern C — NPC recognition / re-meeting.** House Heritage. The "the cobbler in the third town" example from the brief. Companion off-screen relationships. Folk Hero geographic fame. Urchin street children network. Dismissed companion return triggers. Keeper libraries-as-places. **Requires NPC and place identity persistence and trigger logic for "this entity has been encountered before."**

**Pattern D — Time-bounded state.** Quick Study (24 hours of game time). 1-week debts from Tiefling Silver Tongue. Per-arc abilities. Mood decay. Status-effect timers. **Requires reliable game-time tracking and expiration logic.**

**Pattern E — Player-DM negotiation moments.** Aasimar Scourge "DM adjudicates good-aligned" gating. The redesigned ancestry's L18 player-designed feat (deferred). Keeper's Unwritten Knowledge (player and AI negotiate which past defeat yields which text). Mythic trial completion. **Requires the AI to make consistent judgment calls and the system to record those judgments.**

**Pattern F — Long-term campaign history as mechanical resource.** Surfaced first in Keeper review. The Keeper is the first class where character progression actively *consumes* prior narrative events. Defeated enemies, discovered sites, encountered texts — these aren't just lore, they're class features. **The AI must treat campaign history as a resource the player will draw on later, not just a record of what happened.** Reinforced by:
- Mythic legendary items (states change through narrative milestones)
- Mythic cross-campaign continuity (Campaign II builds on Campaign I)
- Sage lore consistency (every question creates canon)
- Mythic × Theme arc tracking (specific narrative beats accumulate toward resolution)
- Likely all "lineage of characters" infrastructure when built

### AI behavior patterns

These are behavior patterns rather than state-tracking patterns, but they're inseparable from the persistence work — the AI's *use* of persistent state is as load-bearing as the state itself.

**AI ambient pattern matching ("trigger, not activate").** Five reviewed systems use this design pattern: Companions thread activation, Prelude emergences, Party Synergies eligibility, Themes proactive surfacing, DM Mode bond shifts. This is the AI watching for narrative conditions and acting on them, rather than the player invoking abilities. **Project-wide pattern. The reliability of this pattern matching is the load-bearing question for all five systems.**

**AI proactive-action vs. shelter-behavior.** Three systems share a concern: the AI defaults to safer / smoother / more sheltering content than the design wants — Prelude shelters child PCs from stakes, Companions smooths character edges, Themes underplays Theme effects. DM Mode has the most explicit counter-mechanism for this and is probably the model when the diagnostic investigation runs.

---

## What this doc does NOT do

- It does not propose solutions. Each requirement is a *specification* of what the AI must do; the *how* is a future engineering investigation.
- It is not exhaustive. It only contains items surfaced by reviews so far. Further reviews or playtest experience may surface more.
- It is not a design spec for an "AI Memory" system. That spec, if and when it gets built, will reference this doc but be a separate thing.

---

## When does this become an active workstream?

**Now.** After nine reviews, the picture is substantially built. The doc's original framing — "it will scope an engineering thread when enough entries land" — is satisfied. The next phase is graduation from "running list" to "scoped engineering investigation," which happens in the consolidation-phase new chat alongside the full project to-do construction.

Until that scoping work begins, this doc serves as the requirements input. New requirements that surface during the consolidation phase or during initial engineering work should still be added here.
