# Future Features & Enhancements

Feature ideas for future implementation.

---

## Themes System (Leveling Backgrounds)

**Priority:** Medium
**Status:** Design in progress — not ready to implement

Inspired by Starfinder's Themes. The concept is to take D&D's existing backgrounds and expand them into a progression system that grants new abilities at milestone levels (1, 5, 11, 17), giving characters a "concept layer" that evolves alongside class and subclass rather than being a static L1 choice.

**Core design (locked-in decisions in 2026):**
- Each standard D&D background becomes a Theme with 4 tiers of abilities
- L1: Skill/tool proficiencies + a passive flavor trait (same as current backgrounds)
- L5: A small active or always-on ability tied to the theme's identity
- L11: Expertise Die (**d4** at L11, scaling to **d6** by L17) on the theme's key skills — unlocked here so it feels earned
- L17: A capstone that makes the concept feel legendary, plus the Expertise Die scaling step

**Progression model — automatic, narratively delivered.** Themes unlock automatically at the milestone levels — no choice menus. The unlock is delivered through narrative, picked by the AI DM based on current scene context:
- **Story-driven** (preferred when context fits): An in-fiction NPC initiates the unlock — a mentor recognizes the character is ready, a temple elder bestows new training, a guild master entrusts a deeper secret.
- **Passive narrative** (when no story-appropriate moment exists): Delivered post-long-rest, Oblivion-style — a short reflective beat where the character realizes something has shifted, followed by a clean "You've gained: [ability]" card.
This keeps progression as part of the story rather than a menu, while still being predictable and clearly communicated.

**Expertise Die** is the signature mechanic — an extra die added to certain skill checks, tied to theme identity rather than class. A Knowledge Cleric + Acolyte Theme gets it on Religion/Insight; a Criminal rogue gets it on Deception/Stealth; a Sage wizard gets it on two Intelligence skills. Any class can access any theme's Expertise Die by choosing that theme, which creates interesting cross-class flavor (a Fighter + Sage Theme is a military historian).

**Why d4 → d6 instead of d6 → d10:** Themes grant an *edge*, not dominance. A small die avoids stacking absurdly with Bardic Inspiration, Bless, Guidance, and the Help action — and leaves room for Mythic-tier abilities to be the actual "god-like" mechanics. A consequence of the smaller die: it can apply more often without breaking the math.

**Ancestry Feats (companion concept, design in progress):**
Inspired by Pathfinder 2e, where racial/ancestry traits aren't just a L1 dump but a progression — feats unlocked at levels 1, 5, 9, 13, 17 from a race-specific list. A dwarf might unlock tremorsense at L9, magic stonecunning at L13, and stone giant resilience at L17. An elf might unlock fey step, trance mastery, or elven weapon training at different milestones.

The Themes System and Ancestry Feats should be designed together since they occupy the same conceptual space — both are "progression layers that aren't class or subclass." The goal is that a character's identity emerges from the intersection of all three: class, theme, and ancestry, each evolving in parallel.

**Theme Interactions (party-level synergies — confirmed in scope):**
D&D 5e doesn't have party feats the way Pathfinder 1e did with Teamwork Feats (Outflank, Coordinated Maneuvers, etc.) — the closest things in 5e are the Help action, Bardic Inspiration, and a few class features like Battle Master's Commander's Strike. Themes is a chance to introduce genuine party-level mechanics where character identities reinforce each other, rather than each character existing as a self-contained build.

**Synergies apply across the full party — including all-AI parties.** Even though companions and DM Mode characters are AI-driven, each has their own personality, voice, and decision-making. AI characters *choose* whether to invoke a synergy based on their personality and current goals — a loyal cleric companion might reliably set up a Soldier-Cleric coordinated attack, while a reckless barbarian companion might never play into flanking synergies because they prefer to charge alone. This makes companion personality mechanically meaningful: the player learns over time which companions reliably play into synergies, and absences hurt more because losing a Synergy partner removes options the party had become accustomed to.

Four directions worth exploring:

1. **Party Synergies** — Specific Theme pairings unlock collaborative bonuses when both characters participate in an activity together. Examples:
   - Sage + Acolyte researching a relic: combined check uses higher modifier + d4 bonus from shared expertise
   - Soldier + Criminal planning a heist or ambush: both get advantage on the next attack roll after a successful prep scene
   - Folk Hero + Outlander rallying a community: combined Persuasion check counts as one degree of success higher
   - Noble + Charlatan working a social gathering: can swap Insight and Deception modifiers for one round
   These could be unlocked at L5 (when each character's first Theme ability comes online) and grow more potent at L11 and L17.

2. **Theme Resonance** — Themes have implicit compatibility tiers that the AI DM can surface during play:
   - **Kindred** (Sage + Hermit, Soldier + Soldier): natural understanding, conversations flow easily, NPCs perceive them as a unit
   - **Complementary** (Soldier + Acolyte, Noble + Sage): different strengths that fit together
   - **Friction** (Noble + Criminal, Acolyte + Charlatan): built-in dramatic tension that the DM can lean into for roleplay scenes
   This isn't mechanical — it's a flag the AI uses to generate character moments, party tensions, and downtime conversations.

3. **Cross-Theme Training** — At higher tiers, characters who travel together long enough can pick up a single L1 ability from a party member's Theme via extended downtime. The Fighter who spends a year alongside a Sage gains the Sage's L1 trait. This rewards long campaigns and deepening interconnection — and pairs naturally with the Downtime v2 system already in place.

4. **Group Activations** — At L11+, a party member can spend their reaction (or a downtime hour) to **share** their Theme's Expertise Die with an adjacent ally for one check. The Sage lends their d6 to the Fighter making a critical Religion check; the Soldier lends their d6 to the Bard's Intimidation roll. This creates active party-level decisions instead of passive "everyone has their own die" play.

**Locked-in decisions (2026):**
- **Theme replaces Background entirely.** "Background" becomes "Theme" everywhere in the UI. Existing characters auto-convert at their current tier. The L1 Theme tier preserves the existing Background's skills, equipment, and feature.
- **21 distinct Themes, one per Background.** Acolyte, Charlatan, City Watch, Clan Crafter, Criminal, Entertainer, Far Traveler, Folk Hero, Guild Artisan, Haunted One, Hermit, Investigator, Knight of the Order, Mercenary Veteran, Noble, Outlander, Sage, Sailor, Soldier, Urban Bounty Hunter, Urchin. Each gets a unique L5/L11/L17 progression — no clustering. Similar Themes (Soldier vs Mercenary Veteran vs Knight of the Order) must be designed with meaningful mechanical differences so the choice matters.
- **2014 rules baseline.** The game uses 2014 PHB rules, not 2024. There is no Origin Feat to replace — Theme L1 is the existing Background structure, and Theme adds the new L5/L11/L17 progression on top.
- **Mythic interaction is amplifying with dissonance arcs.** Resonant Theme+Path combos (Acolyte+Hierophant, Soldier+Angel) gain bonuses. Dissonant combos (Criminal+Angel) unlock a special "Redemption Arc" or "Fall From Grace" narrative path with unique abilities for playing against type. AI DM leans into dissonance for roleplay opportunities.
- **Mentor's Imprint replaces Cross-Theme Training.** Each character can, **once per career**, declare one specific NPC or companion as their most influential bond. After significant downtime with that person, they gain **one L1-tier trait** from that mentor's Theme. Only once. Only with one chosen mentor.
- **Custom Themes ship as a separate post-launch module.** Standard 21 at launch. Custom Themes (Opus-generated four-tier progressions from player concept) come later once the system is proven.
- **Ancestry Feats ship at launch alongside Themes.** Full identity-progression overhaul in one release.
- **Companions auto-pick Ancestry Feats and Theme unlocks based on personality.** No level-up menus for companions. The AI uses voice, mannerism, motivation, ideals, bonds, flaws, and alignment to pick feats that match the character. Selection delivered as a small narrative beat ("Tormund grins. 'Time I learned the old stone-runner trick.'") rather than a menu prompt.

**More locked-in decisions:**
- **Subclass × Theme combos use tagged synergies.** Specific resonant combinations (Battle Master + Soldier, Lore Bard + Sage, Arcane Trickster + Charlatan) get tagged bonuses or shared abilities. Accept some imbalance in service of flavor — major characters should be roughly balanced, but the player character can occasionally feel like a god among mortals.
- **Multiclassing uses total character level.** A Fighter 5 / Wizard 6 unlocks Theme L11 abilities. Consistent with how D&D handles proficiency bonus.
- **All NPCs have Themes for personality flavor.** Most NPCs don't need full mechanical leveling — the Theme is used by the AI DM to give them functional, realistic personalities and consistent voices. Only NPCs the player parties with as companions/hirelings get the full mechanical progression.
- **L1 feature treatment is tabled until Prelude integration.** How the existing Background's L1 feature (Shelter of the Faithful, Position of Privilege, etc.) maps to the four-tier progression depends on whether the prelude is where you *earn* your L1 Theme tier through play. Decision deferred to Prelude+Themes integration design.

**Ancestry Feats progression — locked in:**
- **5 tiers, staggered at L1 / L3 / L7 / L13 / L18.** Avoids overlap with Theme tiers (1/5/11/17), ASIs (4/8/12/16/19), and Mythic tiers (5/10/15/20). Spreads "you got something new" moments across the campaign.
- **10 races in the game** (Genasi, Firbolg, Tabaxi, Goliath removed from character creator): Aasimar, Dragonborn, Dwarf, Elf, Half-Elf, Half-Orc, Halfling, Human, Tiefling, Warforged.
- **Each major race gets its own Ancestry Feat list**, plus subrace variations for **Drow** (mechanically distinct from other Elves) and **Aasimar** (3 paths with different destinies). All other subraces share their parent race's list. **Half-races get their own dedicated lists** (not hybrid picks from parent races) — Half-Elf identity is its own thing, not "elf with human bonuses." Total: ~12 effective lists × 5 tiers = ~60 ancestry feats.

**Party Synergies — three-tier model (see PARTY_SYNERGIES.md for full design):**
- **Tier 1 (Gear & Positioning):** Universal synergies for any two characters based on equipment and tactical position. 10 synergies (Shield Wall, Volley, Spell Convergence, Back to Back, etc.). No Theme required.
- **Tier 2 (Theme):** 34 hardcoded signature synergies for compelling Theme pairs, plus generative tag-based synergies handled by the AI DM.
- **Tier 3 (Team Tactics):** 20 Pathfinder-style shared techniques that both characters must learn together through downtime training (5 days) or field observation. Pair-specific: learning Coordinated Strike with Tormund doesn't mean you can execute it with Sera. Capacity = proficiency bonus.

**Downtime overhaul required:**
- Current Downtime v2 system needs extension to support Team Tactics training as an activity (5 days per tactic, both characters must participate).
- Broader downtime overhaul is due — this should be bundled with Themes/Ancestry rollout.

**Synergy invocation — triggered, not activated:**
- Synergies fire automatically when narrative conditions are met (both characters attack the same target, both succeed on the same skill check, both engage in the same conversation). No action economy cost, no fiddly invocation. The *right circumstances* activate it, which means companion personality matters — companions choose whether to engage in the qualifying action based on who they are.

**Mentor's Imprint — session count + AI gate:**
- Player declares a mentor at any time. After **5+ sessions** where the mentor is present, the AI evaluates behind-the-scenes affinity/relationship data. When the threshold is met, the AI delivers the imprint as a narrative beat. Session count denotes real time passage; the AI gate ensures the relationship has actually deepened, not just co-existed.

**No retroactive unlocks needed** — no existing high-level characters in the system.

**Prelude mechanical payoff — locked in:**
- **Characters who complete a prelude unlock their Expertise Die (d4) at L5 instead of L11.** They've already lived in this background for 3-5 hours of gameplay — they've earned that edge earlier. At L11, it scales to d6 like everyone else's d4, so the gap closes naturally. Non-prelude characters get their standard Theme L1 tier at creation with no penalty — the d4 just arrives at L11 as normal.
- **Prelude + Theme Synergy variants: cut.** Synergies are based on what Themes characters have, not narrative details from session history. Preludes are narrative; synergies are mechanical. They don't need to talk to each other.

**Background L1 feature — locked in:**
- **Keep as-is for launch.** Existing Background features (Shelter of the Faithful, Criminal Contact, Position of Privilege, etc.) become Theme L1 features unchanged. They already work. Enhancement pass can come after the whole system is running.

**Progression map — confirmed clean.** No dead levels, no overloaded levels. L1 is dense (Theme L1 + Ancestry L1 + class) but that's character creation, not a level-up. All open design questions are resolved.

**All architectural decisions are finalized. Next phase: content design** — the actual abilities for 21 Theme progressions, 12 Ancestry Feat lists, ~30-40 hardcoded Party Synergies, Subclass×Theme synergy tags, and Mythic amplification combos.

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

---

## Mobile Companion App (PWA)

**Priority:** Medium
**Status:** Scoped — ready to implement after core progression systems ship

Turn the existing React client into an installable Progressive Web App so key notifications and decisions can reach the player on their phone — especially useful for **downtime decision moments** (companion requests, critical choices, crafting completions) that the AI DM wants to surface between sessions.

### Why PWA over native

- Uses existing React codebase (no Xcode, no Android Studio, no native rewrites)
- No App Store or Play Store submission required
- No Apple Developer Program ($99/year) or Play Console ($25) fees
- Installs to home screen, runs in its own window, receives push notifications
- iOS 16.4+ and all modern Android support the Web Push API

### Phase 1 — Install to home screen (~2 hours)
- Add `manifest.json` to the client
- Add a service worker for offline shell
- Home screen install prompt appears on supported browsers

### Phase 2 — Basic push notifications (~4 hours)
- Generate VAPID keys for Web Push
- Add `web-push` npm package to server
- Store device push subscriptions in a new `push_subscriptions` table
- Fire test notification: "Downtime complete — Tormund has a question for you"

### Phase 3 — Interactive decision flow (~1-2 days)
- Notifications include deep links to a decision page
- Decision page: "Tormund wants to visit his family. Approve / Redirect / Discuss"
- Response syncs to server and is consumed by AI DM at next session
- Primary use case: companion requests during downtime

### Phase 4 — Broader notification surface
- Crafting project completions
- Companion relationship milestones ("Sera has grown close enough that the Mentor's Imprint is available")
- Narrative queue alerts (faction events, political shifts)
- Mentor's Imprint thresholds
- Any AI DM `[NOTIFY]` marker can fire a push

### iOS gotchas (manageable)
- Push requires iOS 16.4+ and the PWA must be installed first
- Install UX on iOS hides behind Safari's share menu — needs an onboarding screen explaining the install steps
- Android is significantly easier — install prompt works on first visit

### Open questions (for when we implement)
- Should notifications be per-campaign or global per-user?
- Do we want a mobile-first alternate layout for the Downtime Planning screen, or reuse the desktop layout?
- Should this work for DM Mode too (e.g., "Your party of AI characters has made a decision that needs review"), or is it Player Mode only?

---

## Character creator — deferred polish from v1.0.40

**Priority:** Low
**Status:** Deferred during the v1.0.40 descriptions pass. Both items are polish, not player-blocking.

### 1. Class features data-schema rewrite
Currently `client/src/data/classes.json` stores each class's `features[]` as an array of `"Name - Description"` strings. The wizard parses these at render time via `splitFeature()` in `CharacterCreationWizard.jsx` and styles them as bold name + description.

**What we'd change:** Convert every entry from a string to `{ name, description }` so the data is self-describing instead of relying on a ` - ` separator convention.

**Why it was deferred:** All ~150 entries across 17 classes already have usable descriptions embedded, and the split helper produces identical rendered output. Pure refactor with no player-visible change. Worth doing the next time class data needs editing for another reason (e.g., when adding a new class or revising a feature).

**Scope:** ~150 feature strings to convert; also update `featuresByLevel` subclass maps where the pattern is inconsistent; verify wizard rendering still works.

### 2. Weapon-property tooltips (finesse, versatile, two-handed, etc.)
`client/src/data/references.js` already exports a `WEAPON_PROPERTIES` reference map with 1-sentence descriptions of all 11 weapon properties. They're referenced today only via the existing inline stat line (e.g., "Longsword — 1d8 slashing · versatile · 15 gp · 3 lb").

**What we'd add:** Hover/click tooltips on each property in that stat line, showing its description. Also applies wherever weapons appear in ancestry feat sub-choices and class starting-equipment dropdowns.

**Why it was deferred:** The native `<select>` element doesn't render rich tooltips, so this requires either (a) migrating the relevant pickers to a custom dropdown component or (b) adding a dedicated "hovered property" helper line under the selected item. Both are bigger surface-area changes than fit inside the v1.0.40 diff.

**Scope decision needed:** Custom dropdown vs. inline glossary line. Inline is simpler; custom dropdown is more discoverable. Worth picking one when we revisit picker UX.

### Open questions
- Are there other equipment stats worth similar treatment? Armor `stealthDisadvantage` and `strReq` could use 1-line "what this actually means in play" tooltips.
- Damage-type glossary has the same problem: damage types appear inline (e.g., "1d8 slashing") but hovering them reveals nothing.

---

## Deeper work — surfaced during Prelude play-testing (v1.0.47-48)

Three areas that need real design work, not just prompt rule tweaks.

### 1. Character voice / tone system (NPC dialogue)

**Priority:** High. **Status:** Deferred.

The existing voice-palette system (v1.0.33, generated by Opus per-NPC)
produces a rough personality sketch — age_descriptor, register,
speech_patterns, mannerisms, vocabulary, forbid. It helps with age-register
differentiation but doesn't deeply capture *how* a character talks — the
rhythm, the hesitations, the class and education markers, the emotional
compression of tired/rushed/guarded speech.

Play-test observations:
- Prompt rules alone ("compressed fragmented dialogue") produce stilted
  approximations — NPCs end up talking like "writerly fragmented
  dialogue," not *like the person they are.*
- Even with ABSOLUTE RULE 17 (authentic speech) and a WRONG/RIGHT pair,
  Sonnet drifts toward a generic "tired mother" voice rather than
  *this* tired mother.
- The problem isn't lexical (shopping list vs. fragments) — it's tonal.
  How does Moira actually sound? Not "tired working-class mother" in
  the abstract; specifically what words does she over-use, what pauses
  does she leave, what does her voice do when she's angry vs. worried
  vs. half-asleep?

**What we'd build:**
- Extend voice palettes with *signature tics* (a phrase they over-use,
  a pause pattern, a specific filler word, a tell when lying).
- Track per-NPC emotional state (tired / tense / open / guarded) and
  modulate dialogue against it.
- Inject 1-2 example lines in the character's voice into the system
  prompt (not rules about their voice — actual sample utterances).
- Consider a "dialogue audit" pass — a small Sonnet check on the
  generated response that flags stilted/generic dialogue and suggests
  a rewrite before delivery. Costs tokens but would catch drift.

### 2. Expanded naming conventions

**Priority:** Medium. **Status:** Deferred.

The AI repeatedly reaches for the same fantasy-stock names — Voss, Lyra,
Aldric, Jarrick, Jakob, Garda, Aldrin. This has surfaced both in main-
campaign NPCs and now in prelude-arc NPCs. The player wants access to
the full richness of fantasy literature as a naming pool, not a generic
"fantasy RPG name" set.

**What we'd build:**
- A server-side name-bank organized by culture/region/class — drawing from
  Tolkien (Middle-earth names have distinct branches), Sapkowski (Slavic
  cadence), Le Guin, Pratchett, Herbert, Moorcock, Howard, Martin, Rothfuss,
  Abercrombie, etc.
- Region-tuned sampling: a Calimshan NPC shouldn't have a Nordic name, a
  Rashemen shaman shouldn't sound Tolkien-Elvish, etc.
- Inject 20-30 suggested names per region/role into the system prompt at
  NPC introduction time, with rotation so Sonnet isn't shown the same
  names every session.
- Consider pulling existing forgotten-realms canon names where known —
  the game already has location/regional data, so there are anchor points.

**Open question:** How to handle the "but I want my OWN names" case — some
players want full creative control. Probably a preference toggle:
"AI name generation: cautious (suggest canonical FR names only) / broad
(draw from the wider literary tradition) / off (I'll name everyone)."

### 3. Cross-session repetition detection

**Priority:** Low. **Status:** Deferred.

The existing repetition ledger (v1.0.34, 30-entry FIFO on the session's
config) catches distinctive phrases reused *within a single session*.
But phrases like "He says the name like he's tasting it" drift across
sessions — Sonnet defaults to certain narrative tics when it doesn't
have a signal to avoid them. One use per session isn't flagged; many
uses across many sessions accumulates without detection.

**What we'd build:**
- Optional character-level (or user-level) repetition ledger that
  persists across sessions.
- Detect over the full DM-output corpus, not just the current session.
- Feed detected repeats back into the prompt as a "don't reach for these"
  list.
- Probably lives on `characters.dm_output_phrase_history` as a TEXT
  JSON column, capped at N most-recent distinctive phrases.

**Design tension:** too aggressive = robs the AI of natural turns of
phrase; too loose = lets the same phrasing creep across sessions. The
existing per-session ledger is intentionally short (30 entries, FIFO)
to avoid this trap. Cross-session version would need a much tighter
definition of "distinctive" to stay useful.

---

## Main-campaign tone preset integration

**Priority:** Medium. **Status:** Deferred until prelude work is complete.

**Context:** The prelude has a proper 4-preset tone system
(`brutal_gritty`, `epic_fantasy`, `rustic_spiritual`, `tender_hopeful`)
with full "tone bibles" in `server/data/tonePresets.js` — register
rules, vocabulary anchors, scene-type guidance, age-scaling, exemplar
paragraphs. `buildTonePresetBlock(presetValue)` formats them for
injection.

The MAIN DM prompt (post-prelude, ongoing campaign) currently has none
of this. Tone reaches the main DM prompt only through scattered
free-text fields (campaign.tone, campaignPlan.dm_notes.tone, module
themes) and gets buried mid-prompt where it can't actually shape
register. A Brutal & Gritty prelude graduates into a tonally
agnostic main campaign, which is incoherent.

**What we'd build:**

1. Add `tone_preset` TEXT column to `campaigns` (one of the 4 canonical
   values, or NULL).
2. Capture the preset at campaign creation:
   - If the campaign was seeded from a prelude character, inherit the
     preset from `prelude_setup_data.tone_tags` automatically.
   - Otherwise surface the 4-option picker in the campaign creation UI
     (same label/description pattern as `PreludeSetupWizard.jsx`).
3. In `createDMSystemPrompt`, when `sessionContext.tonePreset` is set,
   inject `buildTonePresetBlock(preset)` at the TOP of the prompt
   (before Cardinal Rules). Tone shapes BOTH register and scope, so
   lead with it — every example and rule that follows reads through
   that register.
4. When `tonePreset` is unset (legacy campaigns, or user declined to
   pick one), fall back to the current behavior — no tone preset
   block, scattered inline tone guidance only.

**Why deferred:** we're still iterating on the prelude experience
itself (session loop, emergences, canon ledger, theme commitment at
Ch3 wrap). Wiring tone presets into the main campaign before the
prelude-to-campaign handoff is even finished (Phase 5 of
PRELUDE_IMPLEMENTATION_PLAN) would mean reworking it. Do it once, after
the handoff design is locked.

**Note for the future reviewer:** v1.0.90 included a short-lived attempt
at a 7-category tone system (gritty/epic/gothic/political/mystery/
whimsical/default) inferred from free-text campaign tone. That was
reverted as incoherent with the prelude's 4-preset system. Don't
re-invent new categories — use the canonical 4.
