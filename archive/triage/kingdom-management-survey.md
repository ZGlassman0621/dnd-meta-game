# Kingdom / fortress management surface survey

**Drafted:** 2026-05-05
**Updated:** 2026-05-06 (post-Phase-3.7).
**Purpose:** inventory existing mechanics that a player-facing "kingdom management level" dial (Off / Lenient / Standard / Strict) would modulate. Gated Phase 3.5 spec drafting (no fortress dial shipped in 3.5 per PM 2026-05-05). Phase 3.7 absorbed two of the survey's findings as fix-along-the-way ships.
**Reference pattern:** `survival_intensity` (SC-7.6.5, v1.0.162) — see [survivalService.js:154-234](server/services/survivalService.js#L154).
**Out of scope:** combat-internal mechanics, survival timers, hypothetical new features.

---

## Post-Phase-3.7 status update (2026-05-06, v1.0.164)

Two of this survey's findings were resolved in Phase 3.7. Two remain open as `KNOWN_BUGS.md` entries pending the future fortress system design phase (Phase 5 candidate).

### Resolved by Phase 3.7

- **§0 / §5.3 producer gap.** `RAID_CAPABLE_EVENTS` had no producer in production. **Resolved at v1.0.164 via SC-3.7.1.** Threat origination is now marker-driven — AI DM emits `[FORTRESS_THREAT: BaseId=N EventType=... Force=N WarningDays=N]`, handler in [baseThreatService.js](../server/services/baseThreatService.js) creates the `base_threats` row directly. The legacy world-event-tick path (`generateThreatsForCampaign`) is deprecated but kept in place per spec §1.2 (removing it would touch the living-world tick architecture). Because threats no longer originate from world events, the producer gap is no longer a gap — it's a vestigial code path. KNOWN_BUGS archive entry at [`KNOWN_BUGS.md`](../KNOWN_BUGS.md).
- **§1.6 mechanical-damage asymmetry.** Player-led `damaged` outcomes wrote the JSON blob but did NOT mutate buildings/treasury/garrison; only auto-resolve applied mechanical damage. **Resolved at v1.0.164 via SC-3.7.2.** `recordPlayerDefenseOutcome` now runs `computeDamageFromOutcome` for `damaged` and `captured`, applying mechanical damage the same way auto-resolve does. Player-led `damaged` defaults to mild sub-tier (margin treated as 0 per spec §3.4) — penalize engaged players less harshly than unengaged. KNOWN_BUGS archive entry at [`KNOWN_BUGS.md`](../KNOWN_BUGS.md).

### Still open (filed as active KNOWN_BUGS)

- **§1.5 recapture-window-without-recapture-mechanism.** The 14-day recapture grace exists in code (`RECAPTURE_WINDOW_DAYS`, `expireStaleCapturedBases`, `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER` from Phase 3.3 SC-7.5) but no player-side codepath uses it. Defers to fortress system design phase per user's 2026-05-05 vision (recapture is a multi-session quest arc with allies/coordination, not a marker handler). KNOWN_BUGS active entry at [`KNOWN_BUGS.md`](../KNOWN_BUGS.md).
- **§1.7 holdings-purpose-data is stub.** Holdings distinguished only by `subtype`; no data captures what each *does* or *produces*. Defers to fortress system design phase (framework needs to be designed alongside its first real consumer — the holdings management UX). KNOWN_BUGS active entry at [`KNOWN_BUGS.md`](../KNOWN_BUGS.md).

### Still parked

- **Fortress intensity dial.** Pulled from Phase 3.5 entirely per PM 2026-05-05 (the dial sits honestly only after the fortress system has been designed). Naming nudge from §6 (`fortress_intensity` / `base_intensity` over `kingdom_intensity` to match actual single-vertical surface) carries forward to whenever the dial does land.

The body of this survey below remains as drafted on 2026-05-05 — the §0 orientation note and §5/§6 recommendations all hold; what changed is which of the survey's findings have been absorbed by ship work versus which are formally deferred via KNOWN_BUGS. The future fortress system design phase inherits a clean threat-origination pipeline and the recapture/holdings-purpose work remaining.

---

## §0 — Orientation: kingdom-management system, or scattered pieces?

The honest read: **there is no "kingdom management system" in the codebase.** What exists is one cohesive subsystem — `baseThreatService` (raids and sieges against party bases) — wired into the living-world tick alongside `partyBaseService` (defense_rating, garrison, officers, treasury, upkeep). Together those two services form a complete F1/F2/F3 vertical: bases have defenses; threats are spawned against them; threats resolve into damage / capture; captured bases expire after a recapture window. That vertical *is* coherent — the player has a fortress, the world attacks it, the player defends or auto-resolves, the world reacts.

Everything adjacent to that vertical is *touching* the same nouns without participating in the system. Faction goals advance independently and trigger faction-quest spawning ([livingWorldService.js:725-799](server/services/livingWorldService.js#L725)) and rival-reaction conflict quests ([livingWorldService.js:557-626](server/services/livingWorldService.js#L557)) — but neither of those flows hands off to `baseThreatService`. Faction `territory` is a JSON column on `factions` ([factionService.js:40](server/services/factionService.js#L40)) that's stored but never read by any threat-spawning logic. World events have a `scope` (local/regional/continental/global) and an `affected_locations` JSON array — `baseThreatService` reads `scope`/`affected_locations` for future regional targeting per a comment at [baseThreatService.js:81-84](server/services/baseThreatService.js#L81) but doesn't actually use them yet. Notoriety drives `entanglements` against the base ([notorietyService.js:240-254](server/services/notorietyService.js#L240)) but those are narrative-queue items, not threats. Long-term projects have nothing to do with bases at all despite the BitD-clock framing — they're per-character downtime work.

**There is also a real system gap to flag.** `RAID_CAPABLE_EVENTS` ([raidConfig.js:18-60](server/config/raidConfig.js#L18)) defines five event types (`bandit_activity`, `war`, `undead_uprising`, `mercenary_incursion`, `cult_activity`) — but **no code path in the server creates `world_events` rows with any of those `event_type` values.** `livingWorldGenerator.js`'s AI prompt instructs Opus to use `political/economic/military/natural/magical/religious/social/conspiracy/threat` ([livingWorldGenerator.js:220-229](server/services/livingWorldGenerator.js#L220)). Faction-milestone events use a fixed `eventTypeMap` that emits `political/military/economic/conspiracy/religious/magical` ([livingWorldService.js:404-415](server/services/livingWorldService.js#L404)). Rival-reaction events are hardcoded to `'political'` ([livingWorldService.js:581](server/services/livingWorldService.js#L581)). The raid-capable keys exist nowhere in the active production codebase. **In practice no threats spawn unless something inserts a `bandit_activity`/`war`/etc. row by hand or via test fixture.** This is the dial's biggest unknown — see §5.3.

**Implication for the dial:** the cohesive surface to dial is `baseThreatService` + the raid-capable event spawn that *would* feed it if the gap above were closed. Faction/world-event surfaces affect the bases mostly indirectly (they exist as raid-capable event sources in *theory*); a dial that purports to scale "kingdom intensity" but only modulates threat spawn cadence is honest as long as the spec acknowledges the upstream gap. If the dial is supposed to also tune faction-quest pressure or notoriety-driven entanglements, those are separate clusters — see §5.4 / §6.

---

## §1 — `baseThreatService.js`

[Full file, 677 lines](server/services/baseThreatService.js).

### §1.1 Threat types

Two threat types only, hard-enum at the schema level ([migrations/037_base_threats.js:34](server/migrations/037_base_threats.js#L34)):

- **`raid`** — short warning, smaller force, default outcome shape (repelled/damaged/captured)
- **`siege`** — longer warning, larger force, harder to repel (auto-resolve margin shifted -2 against the defender)

The `raid` vs. `siege` split is determined at spawn time by attacker force vs. `SIEGE_FORCE_THRESHOLD = 15` ([raidConfig.js:68](server/config/raidConfig.js#L68), applied at [baseThreatService.js:133](server/services/baseThreatService.js#L133)). Force ≥15 → siege; otherwise raid. There is no third threat type. No sabotage, infiltration, blockade, espionage, or any other vector — just frontal force-on-force assault.

Attacker `category` is one of `criminal | political | arcane | religious | military` (preserves the notoriety category enum). Each raid-capable event ships a hardcoded `sourceLabel` (e.g. `"Bandit Raiders"`, `"Restless Dead"`) — these become the attacker's display name in the narrative queue and DM prompt.

### §1.2 Spawn cadence + triggers

Threats spawn during the living-world tick, step 3.95 ([livingWorldService.js:283-317](server/services/livingWorldService.js#L283)). The chain is:

1. `generateThreatsForCampaign(campaignId, currentGameDay)` ([baseThreatService.js:74-190](server/services/baseThreatService.js#L74))
2. SELECT `world_events WHERE event_type IN (RAID_CAPABLE_EVENTS keys) AND status='active'` ([baseThreatService.js:85-93](server/services/baseThreatService.js#L85))
3. SELECT `party_bases WHERE status='active'` for the campaign
4. Subtract bases that already have an `approaching/defending/resolving` threat (no double-stacking)
5. For each (event, eligible_base) pair, compute per-tick probability via `computeRaidProbability(cfg, base, {onlyBaseInRegion})` ([raidConfig.js:111-122](server/config/raidConfig.js#L111))
6. Coin flip — `Math.random() > p` skip, else spawn

**Per-event base probabilities** ([raidConfig.js:18-60](server/config/raidConfig.js#L18)):

| Event type | per-tick prob | force | warning days | preferred targets |
|---|---|---|---|---|
| `bandit_activity` | 0.06 | 4-10 | 3-7 | outpost / watchtower / tavern / hall |
| `war` | 0.08 | 10-20 | 5-10 | keep / fortress / manor / castle |
| `undead_uprising` | 0.07 | 8-16 | 2-5 | chapel / temple / sanctuary / watchtower / outpost |
| `mercenary_incursion` | 0.05 | 8-14 | 4-8 | keep / fortress / manor |
| `cult_activity` | 0.05 | 6-12 | 3-7 | chapel / temple / sanctuary / wizard_tower |

**Vulnerability multipliers** ([raidConfig.js:76-81](server/config/raidConfig.js#L76)) stack on top of the base probability:

- `defense_rating < 5` → ×1.5
- subtype is `watchtower` or `outpost` → ×2.0
- has damaged buildings from a previous attack → ×1.2 (NOTE: this multiplier is defined in `VULNERABILITY_MULTIPLIERS.abandonedBuildings` but is **never actually applied** in `computeRaidProbability` — verified [raidConfig.js:111-122](server/config/raidConfig.js#L111))
- `garrison_strength === 0` → ×1.3

**Target preference gate** — if the base's subtype isn't in the event's `targetPreferences`, probability is 0 *unless* this is the only base in the campaign (`onlyBaseInRegion = eligibleBases.length === 1`, [baseThreatService.js:123](server/services/baseThreatService.js#L123)). So a fortress in a `bandit_activity` region is normally safe (bandits don't raid fortresses), but if the player has only one base, it becomes the target by default.

**Hard cap:** `Math.min(p, 0.35)` — no individual roll exceeds 35% per tick ([raidConfig.js:121](server/config/raidConfig.js#L121)).

**Spawn invariants (worth knowing for the dial):**
- One active threat per base maximum (the existing-threats SET filter at [baseThreatService.js:107-112](server/services/baseThreatService.js#L107))
- Spawn rolls are independent per (event, base) — multiple raid-capable events can each spawn their own threat against different bases in the same tick
- The dependency on `RAID_CAPABLE_EVENTS` event types means **zero threats spawn under current production conditions** (see §0). The dial must contend with this.

### §1.3 State machine + transitions

Status enum (CHECK constraint at [migrations/037_base_threats.js:35-36](server/migrations/037_base_threats.js#L35)):

```
approaching → defending  (player engaged the defense flow via initiatePlayerDefense)
approaching → resolving  (deadline hit, markDueThreatsForResolution flipped it)
defending   → resolved   (recordPlayerDefenseOutcome wrote outcome — typically via [BASE_DEFENSE_RESULT] marker)
resolving   → resolved   (autoResolveThreat wrote outcome)
resolved    (terminal)
```

**Per-transition side effects:**

| Transition | What fires |
|---|---|
| spawn → `approaching` | INSERT `base_threats` row + narrative queue entry (`base_threat_approaching`, urgent/normal priority by type) at [baseThreatService.js:135-178](server/services/baseThreatService.js#L135) |
| `approaching` → `defending` | UPDATE status + set `player_defended=1`. No narrative queue entry (player just engaged in the UI) at [baseThreatService.js:200-213](server/services/baseThreatService.js#L200) |
| `approaching` → `resolving` | Pure status flip, no side effects (auto-resolver picks it up next) at [baseThreatService.js:258-273](server/services/baseThreatService.js#L258) |
| `resolving` → `resolved` | `autoResolveThreat` rolls, computes damage_report, calls `recordThreatOutcome`, queues narrative entry. See §1.4 [baseThreatService.js:428-480](server/services/baseThreatService.js#L428) |
| `defending` → `resolved` | `recordPlayerDefenseOutcome` writes outcome + damage_report; **does not auto-apply damage to the base** — relies on the DM session to have already narrated the damage. No narrative queue entry by default. [baseThreatService.js:522-543](server/services/baseThreatService.js#L522) |

**Transition order in tick** ([livingWorldService.js:294-300](server/services/livingWorldService.js#L294)):
1. `generateThreatsForCampaign` (spawn new approaching threats)
2. `markDueThreatsForResolution` (approaching → resolving for deadline-hit threats)
3. `autoResolveDueThreats` (resolving → resolved)
4. `expireStaleCapturedBases` (recapture window cleanup, see §1.5)

This ordering is critical for the dial: a threat that spawns and immediately becomes due-for-resolution in the same tick *would* auto-resolve on the same tick. In practice this can't happen because spawn always sets `deadline_game_day = currentGameDay + warningDays` with `warningDays >= 2`, but if a future intensity setting compresses warning windows below 1 day, the same-tick collapse becomes possible.

### §1.4 Outcome enum + side effects

Outcome enum (CHECK constraint, [migrations/037_base_threats.js:45](server/migrations/037_base_threats.js#L45)): `repelled | damaged | captured | abandoned`.

**Auto-resolver math** ([baseThreatService.js:300-325](server/services/baseThreatService.js#L300)):

```
attackerTotal = attacker_force + d20
defenderTotal = defense_rating + min(10, floor(garrison_strength / 4)) + d20
margin = defenderTotal - attackerTotal
if (threat_type === 'siege') margin -= 2

margin >= 5    → repelled
margin in -5..4 → damaged
margin <= -6   → captured
```

The garrison contribution is capped at +10 — even a 100-strength garrison adds at most +10. Officers are folded into `defense_rating` upstream via `recomputeDefenseAndGarrison` (see §4.1), so they're already counted by the time they arrive here.

**Per-outcome damage application** ([baseThreatService.js:333-421](server/services/baseThreatService.js#L333)):

| Outcome | Buildings damaged | Treasury loss | Garrison loss | Status change |
|---|---|---|---|---|
| `repelled` | 0 | 0 | 0 | none |
| `damaged` (margin ≥0) | 1-2 random | 25% | 20% | none |
| `damaged` (margin -1..-5) | 2-3 random | 50% | 40% | none |
| `captured` | all completed buildings | 90% | 100% | `party_bases.status = 'damaged'` (NOT `captured` — see surprise below); 14-day recapture deadline set |
| `abandoned` | (set only by recapture-window expiry) | n/a (already lost) | n/a | `party_bases.status = 'abandoned'`, `is_primary = 0` |

**Surprise:** the `captured` outcome flips `party_bases.status` to `'damaged'`, not `'captured'` ([baseThreatService.js:399](server/services/baseThreatService.js#L399)). The narrative talks about being captured but the base row reads "damaged" until the recapture window expires (then it flips to `'abandoned'`). There's no `'captured'` value on `party_bases.status` at all — that state is implicit in the *threat* row's `outcome='captured'` plus the active recapture deadline. This works but is confusing if you're reading the bases table directly.

**Building damage application** flips per-building `status` to `'damaged'` ([baseThreatService.js:381](server/services/baseThreatService.js#L381)) — the building is no longer counted in defense/garrison after that point. There is no auto-repair flow; the player must reinstall or repair manually (and there is no documented repair endpoint in `routes/partyBase.js`).

**Narrative queue entries** fire on every auto-resolve outcome ([baseThreatService.js:455-477](server/services/baseThreatService.js#L455)): `event_type='base_defended'|'base_damaged'|'base_captured'`, priority `urgent` for captured, else `high`.

### §1.5 Recapture window

CLAUDE.md says 14 days — verified at [raidConfig.js:87](server/config/raidConfig.js#L87): `RECAPTURE_WINDOW_DAYS = 14`. Set on outcome=captured at [baseThreatService.js:230-233](server/services/baseThreatService.js#L230).

**What fires when missed:** `expireStaleCapturedBases` runs in the living-world tick and routes through the `BASE_RECAPTURE_EXPIRE_THRESHOLD_CONSUMER` ([baseThreatService.js:559-602](server/services/baseThreatService.js#L559)):

1. UPDATE `party_bases SET status='abandoned', is_primary=0`
2. UPDATE `base_threats SET outcome='abandoned'`
3. Best-effort narrative queue entry: `base_permanently_lost`, priority `high`

There is **no narrative warning before the deadline closes** — the player just gets a queue entry at the moment of expiry. The original threat-approaching narrative did say "you have 14 days," but no escalating reminders fire as the window closes (see [baseThreatService.js:417](server/services/baseThreatService.js#L417), narrative is one-shot at capture time).

The recapture mechanic itself — *how* a player actually recaptures a base in the 14-day window — appears to **not exist as a code path.** There is no `recaptureBase` function, no marker handler that flips an `'abandoned'`/captured base back to active. Recapture is presumably narrative (the DM rolls a session, player wins back the base, DM emits some marker that... resets the row?). This is a real gap, not just survey scope. Worth flagging.

### §1.6 Auto-resolve vs. player-led

**How the system picks:** the player decides. After spawn, the threat sits in `approaching` until either:
- Player calls `POST /api/threats/:threatId/defend` ([routes/partyBase.js:240-250](server/routes/partyBase.js#L240)) → `initiatePlayerDefense` → status `defending`. Auto-resolver skips defending threats (SELECT at [baseThreatService.js:488](server/services/baseThreatService.js#L488) gates on `status='resolving'`).
- Deadline hits and player never engaged → `markDueThreatsForResolution` flips status to `resolving` → `autoResolveDueThreats` picks it up same tick.

**Differences:**

| | Auto-resolve | Player-led |
|---|---|---|
| Math | attacker_force + d20 vs defense + garrison_bonus + d20, margin → outcome | None — DM narrates, marker reports outcome |
| Outcome source | `computeAutoResolveOutcome` rolls deterministically from current stats | `[BASE_DEFENSE_RESULT]` marker carries Outcome string verbatim |
| Damage application | `computeDamageFromOutcome` mutates buildings/treasury/garrison | `recordPlayerDefenseOutcome` writes outcome + damage_report **but does NOT mutate base buildings/treasury/garrison** ([baseThreatService.js:530-535](server/services/baseThreatService.js#L530)) — comment says "Caller may supply a pre-computed damage report; persist as-is" |
| Narrative queue | `base_defended/damaged/captured` entries at `high`/`urgent` | None by default |
| Outcome values | Can be any of repelled/damaged/captured | Marker schema allows `repelled\|damaged\|captured` ([dmPromptBuilder.js:2037](server/services/dmPromptBuilder.js#L2037)) |

**Important asymmetry:** player-led defense **doesn't apply mechanical damage** — the DM is trusted to have narrated the damage, but the buildings/treasury/garrison columns aren't touched. This means a player who picks "defend" and gets a `damaged` outcome via marker walks away with the base mechanically intact (defense_rating, garrison, treasury all unchanged), only the `damage_report` JSON blob recording the narrative damage. Auto-resolved damage IS mechanical. This asymmetry probably wasn't intentional but is shipped behavior. Flagging because the dial may want to address it (Strict could enforce mechanical-damage on player-led too).

### §1.7 Tunable knobs already in code

These are existing config values that map cleanly to intensity multiplication. All are imports / consts, no DB-stored config:

| Constant | File:line | Default | Use |
|---|---|---|---|
| `RAID_CAPABLE_EVENTS[*].perTickProbability` | [raidConfig.js:26-58](server/config/raidConfig.js#L26) | 0.05–0.08 | Spawn cadence per (event, base) |
| `RAID_CAPABLE_EVENTS[*].forceRange` | [raidConfig.js:22-58](server/config/raidConfig.js#L22) | [4,10]–[10,20] | Attacker strength range |
| `RAID_CAPABLE_EVENTS[*].warningDays` | [raidConfig.js:23-58](server/config/raidConfig.js#L23) | [2,5]–[5,10] | Days before deadline |
| `SIEGE_FORCE_THRESHOLD` | [raidConfig.js:68](server/config/raidConfig.js#L68) | 15 | Force level that upgrades raid → siege |
| `VULNERABILITY_MULTIPLIERS.lowDefense` | [raidConfig.js:78](server/config/raidConfig.js#L78) | 1.5 | Multiplier when defense_rating < 5 |
| `VULNERABILITY_MULTIPLIERS.isolatedSubtype` | [raidConfig.js:79](server/config/raidConfig.js#L79) | 2.0 | watchtower/outpost multiplier |
| `VULNERABILITY_MULTIPLIERS.noGarrison` | [raidConfig.js:80](server/config/raidConfig.js#L80) | 1.3 | Empty garrison multiplier |
| `RECAPTURE_WINDOW_DAYS` | [raidConfig.js:87](server/config/raidConfig.js#L87) | 14 | Captured → abandoned grace |
| Per-tick probability cap | [raidConfig.js:121](server/config/raidConfig.js#L121) | 0.35 | Hard upper bound |
| Auto-resolve margin thresholds | [baseThreatService.js:312-315](server/services/baseThreatService.js#L312) | ≥5/0/-6 | Outcome bands |
| Siege margin penalty | [baseThreatService.js:310](server/services/baseThreatService.js#L310) | -2 | Sieges harder to repel |
| Damage percentages (damaged tier) | [baseThreatService.js:362-370](server/services/baseThreatService.js#L362) | 25%/50% treasury, 20%/40% garrison | Damaged outcome severity |
| Damage percentages (captured) | [baseThreatService.js:373-374](server/services/baseThreatService.js#L373) | 90% treasury, 100% garrison | Captured outcome severity |

The `perTickProbability`, `forceRange`, `warningDays`, `RECAPTURE_WINDOW_DAYS`, and damage percentages are the cleanest intensity targets — each is a numeric scalar that a multiplier dial can scale without touching consumer logic.

The vulnerability multipliers and target preferences are *modulators of selection*, not magnitude — harder to dial sensibly (Strict making outpost vulnerability ×4 changes which bases get hit, not how often overall).

### §1.8 Per-intensity sketches

Working name: `kingdom_intensity`. PM may rename — see CLAUDE.md naming nudge.

- **Off:** `generateThreatsForCampaign` short-circuits and returns `{ generated: [], checked: 0 }` immediately. Existing approaching/defending threats: PM call. Two reasonable shapes — (a) freeze in place (don't auto-resolve, don't escalate; player can still engage manually) or (b) auto-resolve all approaching threats as `repelled` to clear pressure cleanly. (a) is more honest; (b) is more humane. Neither is hard to implement. Recapture window expiry: also freeze. The dial is on the *threat pipeline*, not the *world*. Existing `RAID_CAPABLE_EVENTS` world events stay active (they're just narrative content at this point).

- **Lenient:** `perTickProbability` × 0.5; `warningDays` × 1.5 (more time to react); `forceRange` × 0.75 (gentler attackers); damage percentages × 0.6 (treasury 15%/30%, garrison 12%/24%; captured 60% treasury). `RECAPTURE_WINDOW_DAYS` × 2 (28 days). Auto-resolve margin bands shifted +2 toward defender (margin ≥3 → repelled, margin ≥-7 → damaged). Vulnerability multipliers unchanged.

- **Standard:** SC-7.6 baseline (current behavior — byte-identity).

- **Strict:** `perTickProbability` × 1.5 (capped at 0.35 still; possibly raise the cap to 0.50 for Strict); `warningDays` × 0.5 (rounded down, min 1); `forceRange` × 1.25; damage percentages × 1.4 (treasury 35%/70%, garrison 28%/56%; captured 100% treasury). `RECAPTURE_WINDOW_DAYS` × 0.5 (7 days). Auto-resolve margin bands shifted -2 toward attacker (margin ≥7 → repelled, margin ≥-3 → damaged). Vulnerability multipliers possibly +0.5 each. Player-led defense gets mechanical damage applied (close the §1.6 asymmetry on Strict only — PM call).

**Pattern adherence:** the survival reference dial reads intensity at evaluation time via `getSurvivalIntensity(character)`. The kingdom dial would read at evaluation time via a `getKingdomIntensity(campaign)` (note: campaign-level, not character-level — multiple characters in one campaign would conflict if it lived on characters, and bases belong to campaigns). The intensity column would land on `campaigns` table. All knob multipliers would be applied inside `computeRaidProbability`, `rollInRange` callers in `generateThreatsForCampaign`, `computeAutoResolveOutcome`, and `computeDamageFromOutcome`.

---

## §2 — `factionService.js` cross-cuts (territory/base only)

[Full file, 880 lines](server/services/factionService.js).

### §2.1 What touches bases / territory

**Almost nothing.** Per-faction `territory` is a JSON column ([factionService.js:40](server/services/factionService.js#L40)) that's stored on faction creation/update but **never read by any threat-spawning, base-targeting, or geographic-filter code path** in the codebase. It's an orphan column waiting for a reader.

`influence_areas` ([factionService.js:36](server/services/factionService.js#L36)) — same story; stored, never read for territory mechanics.

`military_strength` ([factionService.js:48](server/services/factionService.js#L48)) — stored, used by `processFactionTick` only as part of urgency-based progress math; **never feeds attacker_force in a base threat**. The `attacker_force` in `base_threats` comes entirely from `RAID_CAPABLE_EVENTS[event_type].forceRange`, not from the faction's `military_strength`.

### §2.2 Faction-aligned attacks against bases

There is **no code path that connects a hostile faction's standing or goals to base threats.** A faction could be at standing -100 (`enemy`) and have 0 chance of raiding the player's base, because base threats are driven by `world_events.event_type`, not by factions.

The closest thing is **rival-reaction conflict quests** ([livingWorldService.js:557-626](server/services/livingWorldService.js#L557)) — when a faction goal hits ≥50% milestone, hostile rival factions have a 40% chance to spawn a counter-event (always `event_type='political'`) and an associated `faction_conflict` quest. These quests CAN affect bases narratively but never spawn base threats mechanically (because event_type is political, not in `RAID_CAPABLE_EVENTS`).

### §2.3 Standing thresholds affecting base behavior

None. Faction standing operates on `character_standings` (per-character relationship to faction); base threats don't read standing at all. A character at `enemy` standing with the City Watch has no different base-threat exposure than a character at `revered` standing.

### §2.4 Faction quest spawning that involves territory or fortress contests

`spawnFactionQuestForMilestone` ([livingWorldService.js:725-799](server/services/livingWorldService.js#L725)) generates faction quests at 25/50/75/100% goal milestones, but these are `quests` rows, not `base_threats` rows. The quest text may reference fortresses or territory, but no mechanical fortress contest is triggered. Same story for `spawnConflictQuest` ([livingWorldService.js:632-719](server/services/livingWorldService.js#L632)).

`questService.js` and `questGenerator.js` have no path that spawns a base_threat row.

### §2.5 Per-intensity sketches

Faction standings and goals are out of scope for a kingdom-management dial **unless** the dial is also meant to scale faction-quest pressure. Today there are no faction-driven base mechanics to dial. The dial that affects baseThreats has no leverage in factionService.

Recommendation: faction-side modulation for the kingdom dial = **none, today.** If PM wants the dial to also scale faction-quest cadence, that's a separate dial cluster (see §6 — recommend internal cluster split rather than overload).

---

## §3 — `worldEventService.js` kingdom-adjacent events

[Full file, 601 lines](server/services/worldEventService.js).

### §3.1 Events that spawn base threats

Per §0 finding: **no production code path creates `world_events` rows with raid-capable `event_type` values.** The link between world events and base threats exists only at the *consumer* end (`baseThreatService` reads world_events), not at the producer end (nothing inserts the matching event types).

Producer paths:
1. `livingWorldGenerator.js` — Opus generates events, prompt restricts to `political/economic/military/natural/magical/religious/social/conspiracy/threat` ([livingWorldGenerator.js:220-229](server/services/livingWorldGenerator.js#L220)).
2. `livingWorldService.spawnEventForGoalMilestone` — uses fixed map → emits `political/military/economic/conspiracy/religious/magical` ([livingWorldService.js:404-415](server/services/livingWorldService.js#L404)).
3. `livingWorldService.spawnGoalCompletionEvent` — hardcoded `'political'` ([livingWorldService.js:500](server/services/livingWorldService.js#L500)).
4. `livingWorldService.checkRivalReactions` — hardcoded `'political'` ([livingWorldService.js:581](server/services/livingWorldService.js#L581)).

None of these emit `bandit_activity`, `war`, `undead_uprising`, `mercenary_incursion`, or `cult_activity`.

**Test fixtures and manual API calls** could create these rows, but the living-world tick won't.

The dial cannot meaningfully modulate "raid event spawn cadence" because there are no raid events spawning to begin with. Either:
- The spec assumes raid-capable events exist (e.g., from manual DM seeding or future Opus prompt expansion), and the dial scales their downstream effect, OR
- The spec includes a producer fix as a prerequisite — extend the Opus prompt enum to include the raid-capable types, or rewrite `livingWorldGenerator.js` to map `military` → `war`, `religious` → `undead_uprising` or `cult_activity`, etc.

### §3.2 Event lifecycle (deadline + stage advance)

Both run through `processEventTick` ([worldEventService.js:509-574](server/services/worldEventService.js#L509)) on the living-world tick:

- Deadline check: `WORLD_EVENT_DEADLINE_THRESHOLD_CONSUMER` fires when `currentGameDay >= event.deadline_game_day`, which calls `resolveEvent(id, 'deadline_passed', ...)` ([worldEventService.js:469-486](server/services/worldEventService.js#L469))
- Stage advance: derived from `daysSinceStart / daysPerStage` where `daysPerStage = expected_duration_days / stages.length` ([worldEventService.js:536-543](server/services/worldEventService.js#L536))

These are timer/clock concerns, not magnitude-of-effect concerns. A kingdom intensity dial doesn't have an obvious knob here.

### §3.3 Faction war events / territory-impacting events

Stored, but no mechanical handling. `event_type` enum values like `'military'` exist conceptually but produce no base-threat side effect.

### §3.4 Event effects on base economy / defense / garrison

`event_effects` table ([worldEventService.js:299-437](server/services/worldEventService.js#L299)) supports `target_type='location'|'faction'|...` but **no `target_type='base'` or `'party_base'`**. Effects can affect locations (e.g., price_modifier in `economyService`) but not base treasuries, garrisons, or defense ratings. This is a real gap for kingdom-flavored mechanics.

### §3.5 Per-intensity sketches

No clean lever in `worldEventService` for the dial. The world-event surface is the *upstream feed* for base threats; the dial intervenes at the threat layer (§1) where the modulation actually matters. If the producer gap (§3.1) gets closed — Opus or codepaths emit raid-capable types — then the dial could also cap how many concurrent raid-capable events are allowed (currently uncapped), but that's a stretch.

---

## §4 — Other surfaces

### §4.1 `partyBaseService.js` — defense rating + garrison + officers

[Full file, 751 lines](server/services/partyBaseService.js).

**Defense rating formula** ([partyBaseService.js:351-362](server/services/partyBaseService.js#L351), implemented at [partyBaseService.js:363-417](server/services/partyBaseService.js#L363)):

```
defense_rating = subtype_defense_bonus
               + Σ (defense_rating_plus_N from completed buildings)
               + Σ per officer: (ceil(companion_level / 3) + officer_bonus_perks)

garrison_strength = Σ (garrison_capacity_N from completed buildings)
```

Subtype defense bonuses ([partyBaseConfig.js:505-590](server/config/partyBaseConfig.js#L505)):

| Subtype | defenseBonus |
|---|---|
| watchtower | 2 |
| outpost | 3 |
| keep | 5 |
| fortress | 8 |
| castle | 12 |
| tavern | 0 |
| hall | 1 |
| manor | 2 |
| wizard_tower | 3 |
| academy | 4 |
| chapel | 1 |
| temple | 2 |
| sanctuary | 4 |

Building defense perks (parsed by `parseDefenseGarrisonPerk` at [partyBaseConfig.js:795-805](server/config/partyBaseConfig.js#L795)):
- `defense_rating_plus_N` patterns (gatehouse +3, palisade +2, stone_walls +5, watchtower-building +1)
- `garrison_capacity_N` patterns (barracks +20)
- `officer_bonus_plus_N` patterns (war_room +1)

**Officer contribution** is per-officer `ceil(companion_level / 3) + officer_bonus_perks`. So a level-5 companion adds 2 to defense; with a war_room (officer_bonus_plus_1), 3.

**Recompute triggers** ([partyBaseService.js:315, 342, 462, 470, 486](server/services/partyBaseService.js#L315)): on building completion, building removal, officer assignment, officer unassignment, and every read via `getGarrisonSnapshot` (which calls recompute on read). So defense_rating is always fresh as of the last write event.

**Income & upkeep** ([partyBaseService.js:500-559](server/services/partyBaseService.js#L500)):
- Daily income from `passive_income_N` perks + (level - 1) × 2 gp
- Daily staff cost from `staff` JSON array salaries
- Monthly upkeep deducted when `currentGameDay - last_upkeep >= 30`
- Treasury deficit logged to `base_events` table with severity `'moderate'`

**Tunable knobs:**
- Subtype defense bonuses ([partyBaseConfig.js:511-583](server/config/partyBaseConfig.js#L511))
- Per-perk defense increments (encoded in perk strings — would need pattern-string regeneration to dial)
- Officer contribution formula ([partyBaseService.js:397](server/services/partyBaseService.js#L397))
- Garrison cap on auto-resolve bonus (`min(10, floor(garrison/4))` at [baseThreatService.js:303](server/services/baseThreatService.js#L303))
- Monthly upkeep window (30 days, [partyBaseService.js:531](server/services/partyBaseService.js#L531))
- Income formula constants ([partyBaseService.js:505-511](server/services/partyBaseService.js#L505))

**Per-intensity sketches for partyBaseService:**
- Off / Lenient: extend monthly upkeep window (45 / 60 days), reduce upkeep magnitude
- Strict: compress upkeep window to 21 days, increase upkeep magnitude (×1.5)
- Strict could also clamp garrison auto-resolve bonus harder (cap at 7 not 10) to make garrison-only defense less effective

These are tunable but feel like "civilian-difficulty" knobs more than "kingdom" knobs. Likely belong in the same dial as base threats since they directly affect base survivability under attack.

### §4.2 `livingWorldService.js` — tick pipeline

[Full file, 999 lines](server/services/livingWorldService.js).

Tick pipeline order (per `processLivingWorldTick`, [livingWorldService.js:46-332](server/services/livingWorldService.js#L46)):

```
0.5  weather                               (weatherService.advanceWeather)
1    factions                              (factionService.processFactionTick)
2    spawned_events                        (checkAndSpawnFactionEvents → spawnEventForGoalMilestone +
                                            spawnFactionQuestForMilestone + checkRivalReactions)
3    world_events                          (worldEventService.processEventTick)
3.5  companion_activities                  (checkAndResolveActivities)
3.6  base_income                           (partyBaseService.processIncomeAndUpkeep)
3.75 npc_mail                              (generateNpcMail)
3.8  consequences                          (processConsequences — promises, expired quests)
3.85 notoriety                             (notorietyService.processNotorietyTick — decay + entanglements)
3.9  merchant_orders                       (processDueOrders + expireStaleReadyOrders)
3.95 base_threats                          (generateThreatsForCampaign + markDueThreatsForResolution +
                                            autoResolveDueThreats + expireStaleCapturedBases)
4    record campaign tick metadata
```

**Order matters for the dial:**
- Step 3.6 (base income/upkeep) runs BEFORE step 3.95 (base threats). So treasury is drained by upkeep before raids loot it. Strict-intensity treasury loss compounds with already-paid upkeep in the same tick.
- Step 1+2 (factions and event spawning) run BEFORE step 3.95. New raid-capable world events spawned this tick are immediately eligible to roll for threats this same tick. (In practice this never fires because no codepath spawns raid-capable types — but if the producer gap closes, this is the chain.)
- Step 3.85 (notoriety) runs BEFORE step 3.95. Entanglements logged as base_events ([notorietyService.js:248-254](server/services/notorietyService.js#L248)) are visible by the time threats roll, but threats don't read base_events.

**No knob in livingWorldService that directly belongs to the kingdom dial.** Tick orchestration is intensity-agnostic; intensity reads happen inside the called services.

### §4.3 `notorietyService.js` — entanglement → base-relevant?

[Full file, 380 lines](server/services/notorietyService.js).

Notoriety entanglements DO write to base_events when the character has a base ([notorietyService.js:240-254](server/services/notorietyService.js#L240)):

```javascript
if (base) {
  INSERT INTO base_events (base_id, event_type, title, description, game_day, severity)
  VALUES (?, 'entanglement', ?, ?, ?, ?)
}
```

The entanglement is delivered via `narrative_queue` regardless; the base_events row is supplementary (so the player can see "your base had an incident" in the base UI). **Entanglements do not spawn `base_threats` rows** — they're narrative complications, not military assaults.

Entanglement risk thresholds ([partyBaseConfig.js:394-400](server/config/partyBaseConfig.js#L394)):

| Score range | Risk per tick | Label |
|---|---|---|
| 0-20 | 0% | Safe |
| 21-40 | 10% | Watched |
| 41-60 | 20% | Wanted |
| 61-80 | 35% | Hunted |
| 81-100 | 50% | Critical |

Decay rates ([notorietyService.js:14-16](server/services/notorietyService.js#L14)): `DECAY_PER_DAY = 2`; above score 50, decay slows to 1/day.

**Per-intensity relevance:** entanglements are notoriety-driven, not kingdom-driven. They feel like a "criminal-life intensity" dial more than a kingdom dial. **Recommend separating** — see §6.

### §4.4 `longTermProjectService.js` — fortress construction

[Full file, 204 lines](server/services/longTermProjectService.js).

Long-term projects are character-driven downtime tasks (research, training, networking, etc.) **not fortress construction**. There is no construction project tied to a specific base. Building construction goes through `partyBaseService.advanceBuildingConstruction` ([partyBaseService.js:291-325](server/services/partyBaseService.js#L291)) which is hour-based, not project-segment-based.

The two systems share the BitD-clock framing in CLAUDE.md docs but are mechanically unrelated. `longTermProjectService` has nothing for a kingdom dial.

### §4.5 Marker handlers — BASE_DEFENSE_RESULT and any other kingdom-relevant

Marker handlers registered in baseThreatService:
- `BASE_DEFENSE_RESULT` ([baseThreatService.js:650-677](server/services/baseThreatService.js#L650)) — multi-instance; calls `recordPlayerDefenseOutcome` and returns systemNote for the route to push to messages.

No other kingdom-relevant markers. The marker pipeline ([markerSchemas.js:220](server/services/markerSchemas.js#L220) shows the schema) doesn't define any "kingdom"-specific markers. Faction shifts, base damage, etc., are not marker-driven.

The dial doesn't have leverage at the marker layer. Marker dispatch validates schema and dispatches; intensity reads would happen inside the handler if needed (e.g., Strict could reject `[BASE_DEFENSE_RESULT outcome=repelled]` if attacker force >> defense — but that's a different kind of dial, more like "AI realism enforcement").

### §4.6 Config files — `raidConfig.js`, `partyBaseConfig.js`

Already covered:
- `raidConfig.js` — see §1.7 for full knob inventory
- `partyBaseConfig.js` — see §4.1 for defense bonuses, building perks, entanglement tables

`partyBaseConfig.js` also contains `LEVEL_THRESHOLDS` ([partyBaseConfig.js:11-17](server/config/partyBaseConfig.js#L11)), `BASE_TYPES` (legacy, [partyBaseConfig.js:30-91](server/config/partyBaseConfig.js#L30)), `BUILDING_TYPES` ([partyBaseConfig.js:597-787](server/config/partyBaseConfig.js#L597)), and `RENOWN_SOURCES` ([partyBaseConfig.js:461-469](server/config/partyBaseConfig.js#L461)). None of these have direct intensity-knob potential — they're content not difficulty.

### §4.7 Anything else surfaced by grep

Grepping for `garrison|fortress|siege|raid_capable|recapture|territory|kingdom` across the server tree returned nothing material beyond what's covered above. No other services touch kingdom-flavored mechanics.

`adventureGenerator.js` has free-text mentions of "territory" in adventure flavor templates ([adventureGenerator.js:158, 164](server/services/adventureGenerator.js#L158)) — pure narrative, no mechanics.

`mythicProgression.js` references "territory" in mythic-tier flavor — pure narrative, no mechanics.

`preludeArcPromptBuilder.js` mentions "kingdoms" in the world-building canon-fact category list ([preludeArcPromptBuilder.js:638](server/services/preludeArcPromptBuilder.js#L638)) — pure narrative, no mechanics.

**There is no other mechanical surface to dial.** What you see in §1-§4 is the entire kingdom-management mechanical footprint.

---

## §5 — Cross-cutting findings

### §5.1 What knobs map cleanly to a 4-position intensity?

The cleanest, in priority order:

1. **Threat spawn cadence** — `RAID_CAPABLE_EVENTS[*].perTickProbability` (0.05–0.08 today). Multiplier × {0.0, 0.5, 1.0, 1.5} for Off/Lenient/Standard/Strict. Off short-circuits the function.
2. **Warning window** — `RAID_CAPABLE_EVENTS[*].warningDays` ranges. Multiplier × {n/a, 1.5, 1.0, 0.5}.
3. **Recapture grace** — `RECAPTURE_WINDOW_DAYS = 14`. Multiplier × {n/a, 2.0, 1.0, 0.5}.
4. **Damage magnitude** — building/treasury/garrison loss percentages in `computeDamageFromOutcome`. Multiplier × {n/a, 0.6, 1.0, 1.4}.
5. **Auto-resolve margin shift** — `+2 / 0 / -2` toward defender for Lenient/Standard/Strict, applied at [baseThreatService.js:312-315](server/services/baseThreatService.js#L312). Off → never auto-resolves.
6. **Attacker force range** — `RAID_CAPABLE_EVENTS[*].forceRange`. Multiplier × {n/a, 0.75, 1.0, 1.25}.
7. **Base upkeep window** — `currentGameDay - last_upkeep >= 30` constant in `processIncomeAndUpkeep`. Could shift to {n/a (off=skip upkeep), 60, 30, 21}.
8. **Player-led-defense mechanical-damage gate** — Strict-only flag that calls `computeDamageFromOutcome` after `recordPlayerDefenseOutcome` to close the §1.6 asymmetry.

All of these are point-of-evaluation reads — match the survival pattern exactly.

### §5.2 What doesn't fit the intensity model?

- **Vulnerability multipliers** ([raidConfig.js:76-81](server/config/raidConfig.js#L76)) — these select *which* base gets hit, not how often overall. Dialing them is meaningful but feels like "scaling a curve" not "moving a slider." A Strict-intensity ×2 on `lowDefense` makes already-vulnerable bases much more vulnerable; doesn't change the equilibrium for well-defended bases. This isn't bad, just less intuitive than spawn-cadence dialing.
- **Target preferences** ([raidConfig.js:24, 33, 41, 49, 57](server/config/raidConfig.js#L24)) — these are content arrays, not numeric scalars. No clean intensity multiplier; would have to be ignored entirely on Strict (any base is a target) or expanded with extra subtypes per-tier. Probably leave alone.
- **Defense rating formula composition** — the per-officer `ceil(level/3)` and per-perk increment math is structural. Dialing it would compromise the "your buildings and officers add to defense" feedback loop the player learns. Leave alone.
- **Recapture mechanic** — there isn't one. The window expiry exists; the "actually recapture" path doesn't (see §1.5). Can't dial what doesn't exist.
- **Faction-driven base mechanics** — also don't exist. Can't dial them.
- **Notoriety entanglements writing to base_events** — narrative side effect, not a base mechanic per se. Probably belongs to a separate "criminal-life" dial.

### §5.3 Risks / fragile mechanics

1. **The producer gap (§0, §3.1).** The largest risk by far. If no `bandit_activity`/`war`/`undead_uprising`/etc. world events spawn in production, then the kingdom dial does nothing to threats regardless of position. PM needs to either acknowledge this in the spec or fold a producer fix into Phase 3.5. Two ways to close:
   - Extend the Opus prompt enum in `livingWorldGenerator.js` to allow the raid-capable types directly
   - Map fixed event types in `livingWorldService.spawnEventForGoalMilestone` (`military` → `war`, etc.) so faction-goal milestones can spawn raid-capable events
   The dial is meaningless without one of these.

2. **Off semantics — freeze vs. clean.** PM call: when intensity flips to Off, what happens to in-flight `approaching` and `defending` threats? Survival pattern's Off short-circuits the consumer (no new exhaustion fires) but doesn't retroactively undo accumulated exhaustion. Mirroring that here means existing threats stay in their state; only NEW spawn rolls and auto-resolve are blocked. Player can still manually engage `defending` flow on existing threats. This is consistent but may feel weird ("I turned it off but my fortress is still under siege"). Alternative: Off auto-flips approaching threats to `resolved/repelled` cleanly. PM picks.

3. **Defending-threat starvation under Off.** Player engages `defending` flow → flips status to `defending`. Then sets intensity to Off. Threat now sits forever in `defending` status because:
   - Auto-resolver only picks up `resolving`, not `defending`
   - `markDueThreatsForResolution` only acts on `approaching`, not `defending`
   - The `[BASE_DEFENSE_RESULT]` marker is the only path out of `defending`
   So the threat is stuck until the player runs a DM session that emits the marker. Off doesn't help here. Likely fine but worth flagging.

4. **Player-led defense mechanical-damage asymmetry (§1.6).** Today `defending`-path doesn't apply mechanical damage. If Strict closes this gap (as suggested in §1.8), need to make sure the auto-resolver math (`computeDamageFromOutcome`) is callable from `recordPlayerDefenseOutcome`. It mostly is — the function takes (threat, base, outcomeCalc); for player-led you'd synthesize the outcomeCalc with `outcome=parsed.Outcome` and `margin` derived from the outcome label. Solvable but not free.

5. **Cap interaction.** The 0.35 per-tick probability cap ([raidConfig.js:121](server/config/raidConfig.js#L121)) interacts with Strict's ×1.5 multiplier. A bandit_activity event against a watchtower with no garrison: base 0.06 × 1.5 (low_defense) × 2.0 (isolated) × 1.3 (no_garrison) × 1.5 (Strict) = 0.351 → capped at 0.35. Strict barely moves the needle for already-vulnerable targets because they're already at the cap. May want to raise the cap on Strict (to 0.50) or remove the cap on Strict entirely. PM call.

6. **Multi-base interaction.** The "one threat per base" gate ([baseThreatService.js:107-118](server/services/baseThreatService.js#L107)) doesn't change with intensity. A player with one fortress and one outpost can have at most 2 active threats; Strict's higher spawn rate hits the gate faster but doesn't increase max-concurrent. This is probably correct behavior (dogpiling a single base would feel cheap) but means Strict's effect is dampened for single-base players.

7. **The recapture window mechanic itself is an iceberg.** Captured bases enter a 14-day recapture window during which the player is *supposed* to be able to win the base back via DM session. There is no `recaptureBase` codepath, no marker, no UI — see §1.5. Dialing the window from 14 → 7 (Strict) makes a non-existent mechanic shorter. PM should know this is mostly cosmetic until the recapture flow ships.

### §5.4 Cohesion question (revisit §0)

After surveying everything: **the dial is honestly modulating one thing — `baseThreatService` and its directly-attached helpers in `partyBaseService`**. That cluster is cohesive. Spawn cadence, warning windows, damage magnitude, auto-resolve math, recapture window, optional upkeep stringency — all live in or directly serve the threat pipeline.

Faction mechanics, world-event mechanics, and notoriety entanglements **don't belong to this dial.** They're separate clusters that touch some of the same nouns (factions and bases share territorial concepts; notoriety writes to `base_events`) but aren't part of the kingdom-management mechanical loop. Trying to fold them into a kingdom dial would silently overload it.

There's one ambiguous mechanic: **base treasury upkeep**. It's not a threat mechanic but it IS a fortress-management mechanic. It fits the kingdom dial *spiritually* but is structurally separate (lives in `partyBaseService.processIncomeAndUpkeep`, not `baseThreatService`). PM call whether to include it.

---

## §6 — Recommendation shape (for PM consideration)

**Code's read: ship as one dial — `kingdom_intensity` — that modulates a single, cohesive cluster (the baseThreat pipeline + optional base-upkeep stringency).** The mechanical surface is small enough and self-contained enough that one dial honestly captures it. Faction-quest cadence, world-event progression, and notoriety entanglements are *adjacent* but mechanically separate and should not be folded in. If PM later wants a "faction-pressure" dial or a "criminal-heat" dial, those are clean cuts; don't blur them with kingdom now.

The bigger spec issue isn't dial granularity — it's the **producer gap (§0, §3.1)**. The dial scales a pipeline that today has zero inputs in production. Spec drafting should pick one of three positions:

- **(A) Acknowledge and ship the dial anyway.** Document that kingdom_intensity has no effect until raid-capable events start being spawned (manually or via future producer fix). Honest but feels like shipping a thermostat for a heater that isn't plugged in.
- **(B) Fold the producer fix into Phase 3.5.** Extend `livingWorldGenerator.js`'s Opus prompt to allow raid-capable event_types directly, OR add a `goal_type → event_type` extension in `spawnEventForGoalMilestone` so faction-goal milestones in `military`/`religious`/etc. categories spawn raid-capable events at higher milestones. Either is small; both are spec-able. This is the recommendation if Phase 3.5 has bandwidth.
- **(C) Defer the dial.** Hold the kingdom dial until a producer ships separately. Survival and combat dials still go in Phase 3.5; kingdom slips to a follow-up. This is the most honest "ship it when it works" call.

Code's narrow recommendation: **(B)** if Phase 3.5 has the bandwidth (the producer fix is one Opus-prompt edit + maybe one map extension), else **(A)** with explicit spec callout that the dial is cosmetic until the producer fix lands. **(C)** is reasonable but feels like abandoning a 90%-finished system over the last 10%.

Working name `kingdom_intensity` reads slightly grand for what's actually being dialed (it's "fortress threat intensity" or "base-threat intensity" really). PM may want to consider `fortress_intensity` or `base_intensity` to avoid setting expectations the dial can't meet — players hearing "kingdom management level" will reasonably expect faction politics, territory control, vassal mechanics, none of which exist.
