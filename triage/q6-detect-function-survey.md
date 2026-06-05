# Q6 — SC-6.4 Detect-function survey

**Audience:** Code implementing SC-6.4 (Phase 3.2 detect-function sprawl survey + selective migration)
**Author:** PM, 2026-05-04
**Source:** `server/services/dmSessionService.js` as of v1.0.149
**Total functions surveyed:** 28 detect-functions + 1 detect-shaped parser (`parseNpcJoinMarker`)

---

## Methodology

Each detect-function categorized against the three-category framework established by the SC-6.3 Prelude marker port:

- **MIGRATE** — Single-marker dispatch, no ordering invariants, no aggregated return shape, no cross-marker shared state. Schema added to `markerSchemas.js` if not already; handler registered via `registerMarkerHandler`; detect-function call site deleted; legacy `detectXxx()` stays exported per "deprecate by hiding."
- **SCHEMA-WITHOUT-HANDLER** — Marker has structural value for schema validation + correction-loop feedback, but handler can't migrate cleanly (ordering invariants, cross-marker shared state, aggregated returns the route handler depends on, side-effect orchestration that crosses multiple services). Schema added; handler not registered; detect-function call site stays.
- **PARK ENTIRELY** — Function isn't a true marker detector. Either pattern-matches free-text (player action verbs, AI prose phrases) without any `[BRACKET]` marker, or is a utility helper rather than a detector. No schema benefit; stays as-is, undocumented as an exception.

Categorization is grounded in actual function shape (return type, side-effect target, input source), not abstract design judgment. Where Code's review surfaces shape facts I missed, the categorization should be revised.

---

## Summary

- **MIGRATE:** 22 functions
- **SCHEMA-WITHOUT-HANDLER:** 1 function (`parseNpcJoinMarker`)
- **PARK ENTIRELY:** 5 functions (4 detect-shaped/utility + `detectDowntime` after PM ruling)

**PM ruling 2026-05-05:** `detectDowntime` recategorized from SCHEMA-WITHOUT-HANDLER to PARK ENTIRELY. Function operates on `playerAction` input (not AI narrative); regex-matches player-intent verbs ("we camp", "I sleep 8 hours"); returns `{trigger: 'player_action'}`. Different shape from every other detect-function. Adding a `[DOWNTIME]` marker would be NEW marker semantics, which spec §3.5 explicitly excludes from Phase 3.2. Deferred as a clean Phase 5+ candidate when new marker content is in scope.

`detectPietyChange` is in the MIGRATE column but already migrated as part of SC-4 (v1.0.147); listed for completeness.

The bulk of SC-6.4 work is the 22 MIGRATE rows. Each is structurally similar to the `[PIETY_CHANGE]` migration from SC-4: schema validation pulls the marker through `markerPipeline`, handler does the side effect, route handler call to `detectXxx()` deletes.

---

## Category 1 — MIGRATE (22 functions)

These detect-functions are clean schema-handler candidates. Pattern: parse a single `[MARKER_NAME: key=value ...]` shape, return either a structured object (single marker) or array of structured objects (multi-marker), no cross-marker dependencies.

### Tier 1A — Structured single-marker (returns object or null)

| Function | Line | Marker | Side effect target | Notes |
|---|---|---|---|---|
| `detectMerchantShop` | 75 | `[MERCHANT_SHOP]` | merchant route / shop service | Already has schema in markerSchemas.js per audit |
| `detectMerchantRefer` | 98 | `[MERCHANT_REFER]` | merchant referral logic | |
| `detectBaseDefenseResult` | 160 | `[BASE_DEFENSE_RESULT]` | base threat service (flips status) | Returns array; handler treats batched |
| `detectCombatStart` | 237 | `[COMBAT_START]` | combat initialization | Returns `{detected, enemies}` shape; handler can normalize |
| `detectCombatEnd` | 255 | `[COMBAT_END]` | combat resolution | Presence-only marker (no fields); handler fires on detect |
| `detectWeatherChange` | 478 | `[WEATHER_CHANGE]` | weather service | |
| `detectShelterFound` | 493 | `[SHELTER_FOUND]` | shelter / survival flag | Worth flagging: this marker is implicated in the AI shelter-fixation behavior issue from Phase 4 scope; migration enables Phase 4's diagnostic instrumentation cleanly |
| `detectSwim` | 508 | `[SWIM]` | exhaustion / clothing-wet status | |
| `detectForage` | 549 | `[FORAGE]` | food/water inventory + foraging tracker | |
| `detectCraftProgress` | 601 | `[CRAFT_PROGRESS]` | crafting timer advancement | |
| `detectMythicTrial` | 656 | `[MYTHIC_TRIAL]` | mythic trial outcome (recordTrial → optional advanceTier) | **Code finding 2026-05-05:** `recordTrial` does NOT touch piety. The "composes with piety threshold-handler" note in earlier survey draft was incorrect — trial path is independent of piety. Migration is structurally clean: handler calls `recordTrial`, route handler reads result for `canAdvance` → optional `advanceTier`. No abstraction-bypass risk. |
| `detectItemAwaken` | 701 | `[ITEM_AWAKEN]` | item state transition (awakened/exalted/mythic) | |
| `detectMythicSurge` | 722 | `[MYTHIC_SURGE]` | mythic point spend tracking | |

### Tier 1B — Multi-instance markers (returns array)

| Function | Line | Marker | Side effect target | Notes |
|---|---|---|---|---|
| `detectAddItem` | 120 | `[ADD_ITEM]` | merchant inventory | Multi-instance: AI emits one per item added to shop |
| `detectMerchantCommission` | 180 | `[MERCHANT_COMMISSION]` | merchant_orders insert | Multi-instance |
| `detectLootDrop` | 214 | `[LOOT_DROP]` | inventory + loot tracking | Multi-instance |
| `detectEat` | 519 | `[EAT]` | food consumption + survival timer reset | Multi-instance |
| `detectDrink` | 534 | `[DRINK]` | water consumption + survival timer reset | Multi-instance |
| `detectRecipeFound` | 565 | `[RECIPE_FOUND]` | recipe library | Multi-instance |
| `detectMaterialFound` | 580 | `[MATERIAL_FOUND]` | material inventory | Multi-instance |
| `detectRecipeGift` | 615 | `[RECIPE_GIFT]` | recipe library (new recipe variant) | |
| `detectPietyChange` | 677 | `[PIETY_CHANGE]` | piety service via standing-scalar abstraction | **ALREADY MIGRATED** in SC-4 (v1.0.147) — listed for completeness; detect-function still exported under "deprecate by hiding" |
| `detectPromiseMade` | 742 | `[PROMISE_MADE]` | promise tracking → consequence service | Multi-instance |
| `detectPromiseFulfilled` | 770 | `[PROMISE_FULFILLED]` | promise tracking + faction standing | Multi-instance; composes with §3.1 |
| `detectNotorietyGain` | 793 | `[NOTORIETY_GAIN]` | notoriety service | Multi-instance; uses `parseMarkerKeyValue` not `parseMarkerPairs` (alternative parser shape) |
| `detectNotorietyLoss` | 815 | `[NOTORIETY_LOSS]` | notoriety service | Multi-instance; same alternative parser |

**Note on `parseMarkerKeyValue`:** `detectNotorietyGain` and `detectNotorietyLoss` use a different parsing helper (`parseMarkerKeyValue` at line 836) instead of the canonical `parseMarkerPairs`. The two parsers handle slightly different formats — `parseMarkerKeyValue` expects comma-separated, possibly-unquoted values; `parseMarkerPairs` expects space-separated quoted values. During SC-6.4, Code should consider whether this alternative parser is meaningfully different or whether notoriety markers can be normalized to the canonical format. If alternative parser stays, schemas.js needs the alternative format support; if it goes, notoriety AI prompts need to emit canonical-format markers.

---

## Category 2 — SCHEMA-WITHOUT-HANDLER (2 functions)

These have structural complexity that doesn't fit handlers cleanly, but they emit `[BRACKET]` markers and benefit from schema validation + correction-loop feedback.

| Function | Line | Marker | Why parked from handler | Schema benefit |
|---|---|---|---|---|
| `parseNpcJoinMarker` | 46 | `[NPC_WANTS_TO_JOIN]` | Aggregated return shape consumed by route handler for NPC recruitment dialogue flow; cross-marker coordination with `detectRecruitment` (which uses parseNpcJoinMarker as its first attempt before falling back to free-text patterns); aggregated NPC data flows through multi-step recruitment process | Schema validation catches malformed NPC data fields (missing Name, etc.) and surfaces correction-loop feedback to AI |
| ~~`detectDowntime`~~ | ~~286~~ | ~~n/a~~ | **Recategorized to PARK ENTIRELY per PM ruling 2026-05-05** — operates on `playerAction` input, not AI narrative; not a marker detector at all. See Category 3 below. | n/a |

**`detectDowntime` is the borderline case.** It currently doesn't parse markers — it pattern-matches player action verbs. If kept as-is, it's "PARK ENTIRELY" not "SCHEMA-WITHOUT-HANDLER." But the underlying function it serves — declaring downtime activity — is *exactly* the kind of thing the AI should emit a structured marker for, not the player action regex-match. **Recommendation: surface to PM during SC-6.4 implementation** whether to (a) add a `[DOWNTIME: Type="rest" Duration=8]` marker shape that the AI emits, migrate to MIGRATE; or (b) leave as player-action regex, recategorize as PARK ENTIRELY. Default-to-(a) reasoning: standardizing AI declaration of downtime is consistent with the project's marker-emission discipline.

---

## Category 3 — PARK ENTIRELY (4 functions)

These don't emit `[BRACKET]` markers. They're either free-text pattern matchers on player input or AI prose, or utility helpers. Schema validation has no purchase here.

| Function | Line | Why park entirely |
|---|---|---|
| `detectRecruitment` | 376 | Free-text pattern matching on AI prose (joinPhrases, organicJoinPhrases, agreementPhrases regex sets) plus name extraction via `namePatterns`. The structured-marker path (`parseNpcJoinMarker`) is already a fallback handled separately; this function is the regex-fallback for when the AI doesn't emit the marker. No schema can validate "the AI's prose contained a recruitment-shaped phrase." Stays as-is. |
| `detectDowntime` | 286 | **PM ruling 2026-05-05** (originally proposed as SCHEMA-WITHOUT-HANDLER borderline case). Operates on `playerAction` input, not AI narrative — pattern-matches player intent verbs ("we camp", "I sleep"). Returns `{trigger: 'player_action'}`. Not a marker detector. Adding a `[DOWNTIME]` marker would be NEW marker semantics (spec §3.5 excludes from Phase 3.2). Deferred as Phase 5+ candidate. |
| `estimateEnemyDexMod` | 264 | Utility helper for combat initiative; pattern-matches enemy name to estimate DEX modifier. Not a marker detector. Listed in survey for completeness. |
| `parseMarkerPairs` | 30 | Shared utility helper used by all marker detectors. Not a detector itself. |
| `parseMarkerKeyValue` | 836 | Alternative shared parser used by notoriety detectors. Not a detector itself. **Becomes dead code after SC-6.4 notoriety migration** — schema's `extractField` handles both quoted-space-sep and unquoted-comma-sep formats natively. See KNOWN_BUGS.md "Notoriety silent-drop on canonical-format markers" (resolved by SC-6.4). |

The two utility helpers (`parseMarkerPairs`, `parseMarkerKeyValue`) are listed for completeness — they're not detectors so they can't be migrated, but Code's audit referenced "detect-function sprawl" so it's worth confirming they're not in scope. They stay as shared helpers.

---

## Special considerations for SC-6.4 implementation

**1. SC-4 already migrated `[PIETY_CHANGE]`.** That detect-function row in Tier 1B is reference-only; no work to do there beyond confirming the deletion landed cleanly.

**2. `detectShelterFound` migration enables Phase 4's diagnostic instrumentation.** Phase 4 (AI behavior diagnostic) will need to instrument the shelter-fixation behavior. With `[SHELTER_FOUND]` migrated through `markerPipeline`, the diagnostic layer can hook into the pipeline rather than scattering instrumentation across detect-functions. Consider this when sequencing SC-6.4 sub-work — `detectShelterFound` is a useful early migration in the batch.

**3. Notoriety markers use alternative parser.** Surface to PM whether to normalize to canonical format. Either way works; just needs a call.

**4. `detectDowntime` borderline case.** Surface to PM whether to add a `[DOWNTIME]` marker. Default recommendation: yes, but PM hasn't ruled.

**5. `detectCombatEnd` is presence-only.** No fields to validate; schema needs the presence-only shape (matches what SC-6.3's prelude markers established with PRELUDE_END / NEXT_SCENE_WEIGHT / THEME_COMMITMENT_OFFERED).

**6. Backward-compat aliases.** The Prelude marker schemas in SC-6.3 explicitly excluded backward-compat aliases (`class_id=`, `theme_id=`, `feat=`, `contains=`) — schemas tighten the AI-facing contract. SC-6.4 should follow the same discipline: schemas don't accommodate legacy alias fields. If a detect-function currently tolerates aliases for backward compatibility, the schema strips that tolerance; the detect-function (post-migration) is what handled aliases.

---

## Implementation sequencing suggestions

Within SC-6.4's batch, sub-sequencing for confidence-building order:

1. **First batch — survival cluster (`detectEat`, `detectDrink`, `detectForage`, `detectShelterFound`, `detectSwim`, `detectWeatherChange`, `detectCraftProgress`).** Highest count, simplest shape, all multi-instance or single-marker structured. Validates the migration pattern at scale.

2. **Second batch — merchant cluster (`detectMerchantShop`, `detectMerchantRefer`, `detectAddItem`, `detectMerchantCommission`, `detectLootDrop`).** Coherent service-area, similar shape to survival.

3. **Third batch — recipe/material cluster (`detectRecipeFound`, `detectMaterialFound`, `detectRecipeGift`).** Same shape, same service area.

4. **Fourth batch — promise/notoriety cluster (`detectPromiseMade`, `detectPromiseFulfilled`, `detectNotorietyGain`, `detectNotorietyLoss`).** Composes with §3.1 standing-scalar work for notoriety; promise migration is straightforward.

5. **Fifth batch — combat + mythic + special (`detectCombatStart`, `detectCombatEnd`, `detectMythicTrial`, `detectItemAwaken`, `detectMythicSurge`, `detectBaseDefenseResult`).** Mixed; includes presence-only and a handler-orchestrated case (`detectMythicTrial` composes with piety standing-scalar via threshold-handler).

6. **Decisions needed before final batches:** PM call on `detectDowntime` migration vs. parking; PM call on notoriety alternative parser normalization.

7. **Schema-without-handler additions** (`parseNpcJoinMarker` schema, possibly `[DOWNTIME]` if added). Ship near end of SC-6.4 alongside detect-function deletions.

Whether these sub-batches each ship separately or batch into one SC-6.4 sub-checkpoint is Code's call — they're operationally similar enough that batching is reasonable. Per user's "batching is always the right call" principle (2026-05-04), default to batching unless review surfaces friction.

---

## What this survey does NOT do

- Doesn't pre-author schemas. Code adds schemas to `markerSchemas.js` during migration; this survey identifies which markers need schemas, not what fields they require.
- Doesn't pre-author handlers. Code writes handlers to call existing service functions; this survey identifies which side-effect targets each handler invokes.
- Doesn't pre-author tests. SC-6.4 follows the same test-pass-then-snapshot-where-applicable pattern from SC-2 through SC-5. Per migration: existing tests stay green; new tests confirm schema validation; snapshot tests where AI-facing prompt output should be byte-identical.
- Doesn't sequence per-function ship cadence. Code's call on whether SC-6.4 ships as one big batch or sub-batches; PM defaults to one batch per "batching is always the right call."

---

## DECISION_LOG entry shape

After SC-6.4 ships, DECISION_LOG entry should cover:

- Total functions migrated, schema-without-handler, parked entirely (final tallies after Code's review may differ from this survey's projections)
- The notoriety alternative-parser decision (normalize or accommodate)
- The `detectDowntime` decision (migrate with new `[DOWNTIME]` marker, or park as free-text matcher)
- Any other shape decisions discovered during implementation

The entry closes Phase 3.2's migration story alongside SC-6.5's documentation work.

---

## Reading order for Code

If this survey is being read as input to SC-6.4 implementation:

1. Read the **Summary** for the count (22 / 2 / 4) and rough scope.
2. Read **Tier 1A and 1B** for the migrate-list — that's the bulk of work.
3. Skim **Category 2** to understand the two parking decisions (parseNpcJoinMarker is real; detectDowntime is borderline).
4. Skip **Category 3** unless you want confirmation on the utility helpers.
5. Read **Special considerations** before starting implementation. Three calls there will need PM input (notoriety parser, downtime decision, possibly shelter-found Phase 4 sequencing).
6. Read **Implementation sequencing** for suggested sub-batch order; treat as suggestion, override per Code's read of the work.