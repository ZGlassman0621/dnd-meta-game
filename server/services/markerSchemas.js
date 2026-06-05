/**
 * Marker schemas — single source of truth for every marker the DM AI emits.
 *
 * **Canonical role (post-Phase-3.2 SC-6.5):** this module + `markerPipeline.js`
 * are the canonical path for marker validation + dispatch. Every marker
 * in `MARKER_SCHEMAS` flows through `validateDmMarkers` (validation +
 * correction-loop feedback) and `processResponseMarkers` (handler
 * dispatch). The legacy `detectXxx()` functions in `dmSessionService.js`
 * remain exported for back-compat but are no longer invoked from the
 * production route path.
 *
 * Problem the migration solved: markers used to be documented in prose
 * inside the DM system prompt, parsed ad-hoc by regex at each call site,
 * and silently dropped on malformed emission. When Sonnet typo'd a field
 * or omitted a required key, the side effect never fired. Over long
 * campaigns these silent drops accumulated: promises untracked, notoriety
 * lost, canon facts missing. The player never knew; the AI never knew either.
 *
 * Architecture:
 *   1. **Schemas**: every marker has a schema here — required/optional
 *      fields, types, enums. One source of truth.
 *   2. **Parsing**: `parseMarkerBody(body, schemaKey)` returns either
 *      `{ ok: true, data }` or `{ ok: false, errors }`. Field extraction
 *      via `extractField` handles both quoted and bareword formats.
 *   3. **Dispatch**: registered handlers in `markerPipeline.js` fire on
 *      successful parses. Handlers live in consumer services
 *      (pietyService, survivalService, merchantService, etc.) and call
 *      registerHandler() at module load.
 *   4. **Correction loop**: validation failures are RECORDED, not
 *      swallowed — stored on session_config.pendingMarkerCorrections so
 *      the next turn's prompt injects a [SYSTEM NOTE] asking Sonnet to
 *      re-emit correctly. That note is INVISIBLE to the player but gives
 *      the AI a concrete correction target.
 *
 * **Schemas-without-handlers** is a first-class end-state for some
 * markers — schema validation buys correction-loop feedback even when
 * the marker doesn't dispatch independently. Four legitimate rationales
 * (DECISION_LOG entry 2026-05-05 "Phase 3 SC-6.4 close-out"):
 *   1. **Ordering invariants** — sibling markers must run in a specific
 *      order that per-handler dispatch can't guarantee (e.g., 19 prelude
 *      markers — AGE_ADVANCE → HP_CHANGE, CANON_FACT_RETIRE → CANON_FACT)
 *   2. **Aggregated returns** — route handler combines per-marker results
 *      into one structured response payload (the prelude markers also)
 *   3. **No side-effect target** — schema buys correction-loop feedback;
 *      no consumer service to handle (e.g., SWIM)
 *   4. **Orchestrated-with-sibling-marker** — coupled markers fold into
 *      one handler internally rather than dispatching independently
 *      (e.g., ADD_ITEM consumed by MERCHANT_SHOP handler)
 *
 * This shape will become tool-use definitions directly when the
 * migration to Anthropic tool-use lands — no rewrite required.
 */

/**
 * Marker field type definitions.
 *
 * Each field spec has:
 *   - `type`: 'string' | 'int' | 'enum' | 'bool'
 *   - `required`: boolean (default true)
 *   - `enum`: array of allowed values (type=enum)
 *   - `min` / `max`: numeric bounds (type=int)
 */

export const MARKER_SCHEMAS = {
  MERCHANT_SHOP: {
    position: 'first',
    fields: {
      Merchant: { type: 'string', required: true },
      Type: { type: 'enum', enum: ['general', 'blacksmith', 'alchemist', 'magic', 'jeweler', 'tanner', 'tailor'], required: true },
      Location: { type: 'string', required: true }
    }
  },

  MERCHANT_REFER: {
    position: 'inline',
    fields: {
      From: { type: 'string', required: true },
      To: { type: 'string', required: true },
      Item: { type: 'string', required: true }
    }
  },

  ADD_ITEM: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Price_GP: { type: 'int', required: true, min: 0 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: true },
      Category: { type: 'string', required: true }
    }
  },

  // SC-6.4b extension: Price_GP min relaxed to 0 + Price_SP / Price_CP /
  // Deposit_SP / Deposit_CP / Description added as optional. The legacy
  // detect-function tolerated mixed-denomination prices and a free-text
  // description; preserving that tolerance avoids tightening the AI-facing
  // contract as a side effect of the marker-pipeline migration. Schema
  // still requires at least Merchant, Item, Deposit_GP, Lead_Time_Days.
  MERCHANT_COMMISSION: {
    position: 'inline',
    fields: {
      Merchant: { type: 'string', required: true },
      Item: { type: 'string', required: true },
      Price_GP: { type: 'int', required: true, min: 0 },
      Price_SP: { type: 'int', required: false, min: 0 },
      Price_CP: { type: 'int', required: false, min: 0 },
      Deposit_GP: { type: 'int', required: true, min: 0 },
      Deposit_SP: { type: 'int', required: false, min: 0 },
      Deposit_CP: { type: 'int', required: false, min: 0 },
      Lead_Time_Days: { type: 'int', required: true, min: 1 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: false },
      Hook: { type: 'string', required: false },
      Description: { type: 'string', required: false }
    }
  },

  COMBAT_START: {
    position: 'last',
    fields: {
      Enemies: { type: 'string', required: true }
    }
  },

  COMBAT_END: {
    position: 'last',
    fields: {}
  },

  LOOT_DROP: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true },
      Source: { type: 'string', required: false }
    }
  },

  CONDITION_ADD: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Condition: {
        type: 'enum',
        enum: [
          'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
          'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
          'prone', 'restrained', 'stunned', 'unconscious',
          'exhaustion_1', 'exhaustion_2', 'exhaustion_3',
          'exhaustion_4', 'exhaustion_5', 'exhaustion_6'
        ],
        required: true
      }
    }
  },

  CONDITION_REMOVE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: true },
      Condition: { type: 'string', required: true }
    }
  },

  PROMISE_MADE: {
    position: 'inline',
    fields: {
      NPC: { type: 'string', required: true },
      Promise: { type: 'string', required: true },
      Weight: {
        type: 'enum',
        enum: ['trivial', 'minor', 'moderate', 'major', 'critical'],
        required: true
      },
      Deadline: { type: 'int', required: false, min: 1 }
    }
  },

  PROMISE_FULFILLED: {
    position: 'inline',
    fields: {
      NPC: { type: 'string', required: true },
      Promise: { type: 'string', required: true }
    }
  },

  NOTORIETY_GAIN: {
    position: 'inline',
    // Note: source/amount/category are lowercase in the existing contract.
    // Kept lowercase here so the schema matches what the prompt instructs.
    fields: {
      source: { type: 'string', required: true },
      amount: { type: 'int', required: true, min: 1, max: 50 },
      category: {
        type: 'enum',
        enum: ['criminal', 'political', 'arcane', 'religious', 'military'],
        required: true
      }
    }
  },

  NOTORIETY_LOSS: {
    position: 'inline',
    fields: {
      source: { type: 'string', required: true },
      amount: { type: 'int', required: true, min: 1, max: 50 }
    }
  },

  NPC_WANTS_TO_JOIN: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Race: { type: 'string', required: true },
      Gender: { type: 'string', required: true },
      Occupation: { type: 'string', required: true },
      Personality: { type: 'string', required: true },
      Reason: { type: 'string', required: true }
    }
  },

  BASE_DEFENSE_RESULT: {
    position: 'last',
    fields: {
      Threat: { type: 'int', required: true, min: 1 },
      Outcome: {
        type: 'enum',
        enum: ['repelled', 'damaged', 'captured', 'abandoned'],
        required: true
      },
      Narrative: { type: 'string', required: true }
    }
  },

  // Phase 3.7 SC-3.7.1 — marker-driven fortress threat origination.
  // AI DM emits this when narrative context warrants a threat against a
  // player-owned base; the handler in baseThreatService.js creates the
  // base_threats row directly. Replaces the world-event-tick path
  // (`generateThreatsForCampaign`) as the canonical origination
  // mechanism; the legacy path stays in place but is deprecated.
  //
  // Field semantics (per spec §2.3):
  //   BaseId       — which of the player's bases (handler validates ownership)
  //   EventType    — picked from RAID_CAPABLE_EVENTS keys; drives default
  //                  Source/Category fallback if those fields omitted
  //   Force        — attacker strength; drives raid-vs-siege determination
  //                  via SIEGE_FORCE_THRESHOLD (15 today)
  //   WarningDays  — game-days until deadline
  //   Source       — display label (optional; falls back to RAID_CAPABLE_EVENTS
  //                  sourceLabel handler-side per Q3)
  //   Category     — notoriety category enum (optional; falls back to event
  //                  type's default category handler-side per Q3)
  //   Reason       — narrative justification, stored on the threat row for
  //                  later prompt injection during the lifecycle
  //
  // Multi-instance per Q1 — pipeline's default loop handles multiple
  // FORTRESS_THREAT emissions per turn without a schema flag.
  FORTRESS_THREAT: {
    position: 'inline',
    fields: {
      BaseId: { type: 'int', required: true, min: 1 },
      EventType: {
        type: 'enum',
        enum: ['bandit_activity', 'war', 'undead_uprising', 'mercenary_incursion', 'cult_activity'],
        required: true
      },
      Force: { type: 'int', required: true, min: 1, max: 30 },
      WarningDays: { type: 'int', required: true, min: 1, max: 30 },
      Source: { type: 'string', required: false },
      Category: {
        type: 'enum',
        enum: ['criminal', 'political', 'arcane', 'religious', 'military'],
        required: false
      },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.4d — Combat / mythic cluster (final SC-6.4 ship)
  // ============================================================
  //
  // Three new schemas for the mythic markers (MYTHIC_TRIAL, ITEM_AWAKEN,
  // MYTHIC_SURGE) — all single-instance, structured, no orchestration
  // coupling. Handlers in mythicService.js.
  //
  // COMBAT_START, COMBAT_END, BASE_DEFENSE_RESULT schemas already in
  // place (pre-Phase-3); SC-6.4d adds handlers in combatMarkerService.js
  // (new) and baseThreatService.js, removes the inline route dispatches.

  MYTHIC_TRIAL: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Description: { type: 'string', required: false },
      Outcome: { type: 'enum', enum: ['passed', 'failed', 'redirected'], required: false }
    }
  },

  ITEM_AWAKEN: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true },
      NewState: { type: 'enum', enum: ['awakened', 'exalted', 'mythic'], required: false },
      Deed: { type: 'string', required: false }
    }
  },

  MYTHIC_SURGE: {
    position: 'inline',
    fields: {
      Ability: { type: 'string', required: true },
      Cost: { type: 'int', required: false, min: 1 }
    }
  },

  // Phase 3 SC-4 — added to MARKER_SCHEMAS so the standing-scalar marker
  // pipeline (markerPipeline.js) can validate and dispatch piety changes.
  // Replaces dmSessionService::detectPietyChange's silent-drop behavior
  // with schema validation + correction-loop feedback when malformed.
  // Amount is signed (no min/max) — piety can decrease.
  PIETY_CHANGE: {
    position: 'inline',
    fields: {
      Deity: { type: 'string', required: true },
      Amount: { type: 'int', required: true },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.4 — Survival + crafting cluster
  // ============================================================
  //
  // Handlers registered in survivalService.js, weatherService.js,
  // craftingService.js. Inline dispatch in routes/dmSession.js replaced
  // with handlerResults extraction (preserves the existing client
  // contract — survivalEvents/craftingEvents arrays still populate
  // identically; client uses .length > 0 as a refresh trigger via
  // DMSession.jsx:869).
  //
  // SHELTER_FOUND migrated first per the Phase 4 prep flag in the Q6
  // survey: Phase 4's AI-behavior diagnostic work will hook the
  // shelter-fixation analysis through the marker pipeline.
  //
  // SWIM is schema-only (no handler) — the legacy detect function was
  // exported and imported but never invoked from any side-effect path.
  // Schema add buys validation + correction-loop feedback without a
  // handler since there's no service function to wire up. Same shape
  // as SC-6.3's parked prelude markers (schema without handler is a
  // legitimate end-state when the marker has no side-effect target).
  SHELTER_FOUND: {
    position: 'inline',
    fields: {
      Type: { type: 'enum', enum: ['cave', 'building', 'tent', 'bedroll', 'overhang'], required: true },
      Quality: { type: 'enum', enum: ['adequate', 'good', 'excellent'], required: false }
    }
  },
  WEATHER_CHANGE: {
    position: 'inline',
    fields: {
      Type: { type: 'string', required: true },
      Duration_Hours: { type: 'int', required: false, min: 1 }
    }
  },
  EAT: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true }
    }
  },
  DRINK: {
    position: 'inline',
    fields: {
      Item: { type: 'string', required: true }
    }
  },
  FORAGE: {
    position: 'inline',
    fields: {
      Terrain: { type: 'string', required: false },
      Result: { type: 'enum', enum: ['success', 'partial', 'failure'], required: false },
      Food: { type: 'int', required: false, min: 0 },
      Water: { type: 'int', required: false, min: 0 }
    }
  },
  SWIM: {
    position: 'inline',
    fields: {
      Duration: { type: 'string', required: false }
    }
  },
  CRAFT_PROGRESS: {
    position: 'inline',
    fields: {
      Hours: { type: 'int', required: true, min: 1 }
    }
  },
  RECIPE_FOUND: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Source: { type: 'string', required: false }
    }
  },
  MATERIAL_FOUND: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Quantity: { type: 'int', required: false, min: 1 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: false }
    }
  },
  RECIPE_GIFT: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Category: { type: 'enum', enum: ['food', 'potion', 'weapon', 'armor', 'adventuring_gear', 'poison', 'scroll', 'ammunition', 'shelter'], required: true },
      Description: { type: 'string', required: false },
      Materials: { type: 'string', required: false },
      Tools: { type: 'string', required: false },
      DC: { type: 'int', required: false, min: 5, max: 30 },
      Hours: { type: 'int', required: false, min: 1 },
      Ability: { type: 'string', required: false },
      OutputName: { type: 'string', required: false },
      OutputDesc: { type: 'string', required: false },
      GiftedBy: { type: 'string', required: false }
    }
  },

  // Phase 3 SC-5 — DM Mode bond-shift marker. Replaces
  // dmModeService::detectBondShifts's silent-skip-on-no-op pattern with
  // schema validation. Warmth and Trust are independently signed deltas
  // bounded to [-5, +5] (matches the per-turn delta range — the absolute
  // warmth/trust scores are clamped to [-5, +5] by the abstraction's
  // range config; per-shift deltas in [-5, +5] keep the marker schema
  // narrow enough to catch obvious AI emit errors).
  BOND_SHIFT: {
    position: 'last',
    fields: {
      From: { type: 'string', required: true },
      To: { type: 'string', required: true },
      Warmth: { type: 'int', required: false, min: -5, max: 5 },
      Trust: { type: 'int', required: false, min: -5, max: 5 },
      Reason: { type: 'string', required: false }
    }
  },

  // ============================================================
  // Phase 3 SC-6.3 — Prelude markers (validation-only, no handlers)
  // ============================================================
  //
  // 19 schemas added so the pipeline can validate prelude marker shapes
  // and surface correction-loop feedback when the AI emits malformed
  // markers. Per the SC-6.3 parking decision (DECISION_LOG entry
  // 2026-05-04): all 19 markers are PARKED from per-handler dispatch
  // because the existing `processMarkersForSession` orchestrator in
  // preludeSessionService.js enforces ordering invariants between
  // markers (AGE_ADVANCE → HP_CHANGE for max_hp; CANON_FACT_RETIRE →
  // CANON_FACT for retire-then-record; CHAPTER_PROMISE → AGE_ADVANCE
  // for chapter check) plus aggregates returns into a single response
  // payload (npcsCreated, capViolations, offeredEmergences). Per-marker
  // pipeline dispatch doesn't fit those shapes today.
  //
  // Side-effect dispatch stays consumer-side via processMarkersForSession
  // + the existing detect-functions in preludeMarkerDetection.js. The
  // pipeline contributes correction-loop feedback ONLY (which prelude
  // didn't have before SC-6.3).
  //
  // Field shapes mirror the canonical form documented in each detect
  // function. Backward-compat aliases (e.g. CLASS_HINT's `class_id=`
  // alongside `class=`) are NOT in the schema — they continue to work
  // through the detect function, but malformed canonical-form emissions
  // get correction feedback. This is an intentional asymmetry: schemas
  // tighten the contract for the AI; detect-functions keep the legacy
  // tolerance for old transcripts.
  //
  // Two markers use bareword/free-text bodies that the parseMarkerBody
  // field-parser can't extract (NEXT_SCENE_WEIGHT: heavy, presence-only
  // forms of THEME_COMMITMENT_OFFERED / PRELUDE_END). Their schemas use
  // `fields: {}` — present-when-emitted validation, no field extraction.

  AGE_ADVANCE: {
    position: 'inline',
    fields: {
      years: { type: 'int', required: true, min: 1 }
    }
  },

  CHAPTER_END: {
    position: 'inline',
    fields: {
      summary: { type: 'string', required: true }
    }
  },

  // SESSION_END_CLIFFHANGER's three legacy forms (bare quoted, text=, bare body)
  // collapse to one schema-validated canonical form: text="...". Forms A and C
  // continue to parse via the detect function but won't validate against the
  // schema. Per spec §3.2 the schema tightens the AI-facing contract; legacy
  // tolerance is fine for old transcripts and during transition.
  SESSION_END_CLIFFHANGER: {
    position: 'inline',
    fields: {
      text: { type: 'string', required: false }
    }
  },

  NPC_CANON: {
    position: 'inline',
    fields: {
      name: { type: 'string', required: true },
      relationship: { type: 'string', required: false },
      status: { type: 'string', required: false }
    }
  },

  LOCATION_CANON: {
    position: 'inline',
    fields: {
      name: { type: 'string', required: true },
      type: { type: 'string', required: false },
      is_home: { type: 'bool', required: false }
    }
  },

  // delta is signed; the detect function rejects 0 explicitly. Schema accepts
  // 0 (no min/max) — the detect function still drops 0-deltas before applying.
  HP_CHANGE: {
    position: 'inline',
    fields: {
      delta: { type: 'int', required: true },
      reason: { type: 'string', required: false }
    }
  },

  CHAPTER_PROMISE: {
    position: 'inline',
    fields: {
      theme: { type: 'string', required: false },
      question: { type: 'string', required: false }
    }
  },

  // Presence-only marker. Body may carry stray fields the AI improvises;
  // schema doesn't extract them (the server recomputes the offer
  // authoritatively via preludeThemeService.buildThemeOffer).
  THEME_COMMITMENT_OFFERED: {
    position: 'inline',
    fields: {}
  },

  // Bareword body (`heavy|standard|light`) doesn't fit the `field=value`
  // parser. Schema validates presence; the detect function extracts the
  // value separately via its own regex.
  NEXT_SCENE_WEIGHT: {
    position: 'inline',
    fields: {}
  },

  STAT_HINT: {
    position: 'inline',
    fields: {
      stat: { type: 'enum', enum: ['str', 'dex', 'con', 'int', 'wis', 'cha'], required: true },
      magnitude: { type: 'int', required: false, min: 1, max: 2 },
      reason: { type: 'string', required: false }
    }
  },

  SKILL_HINT: {
    position: 'inline',
    fields: {
      skill: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  CLASS_HINT: {
    position: 'inline',
    fields: {
      class: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  THEME_HINT: {
    position: 'inline',
    fields: {
      theme: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  ANCESTRY_HINT: {
    position: 'inline',
    fields: {
      feat_id: { type: 'string', required: true },
      reason: { type: 'string', required: false }
    }
  },

  CANON_THREAD: {
    position: 'inline',
    fields: {
      kind: {
        type: 'enum',
        enum: [
          'unresolved_loss', 'blood_debt', 'unfulfilled_oath', 'unpaid_crime',
          'unfinished_relationship', 'held_object', 'held_secret'
        ],
        required: true
      },
      subject: { type: 'string', required: true },
      condition: { type: 'string', required: true },
      weight: { type: 'enum', enum: ['minor', 'notable', 'major'], required: false }
    }
  },

  CANON_FACT: {
    position: 'inline',
    fields: {
      subject: { type: 'string', required: true },
      category: {
        type: 'enum',
        enum: ['npc', 'location', 'event', 'relationship', 'trait', 'item'],
        required: true
      },
      fact: { type: 'string', required: true }
    }
  },

  CANON_FACT_RETIRE: {
    position: 'inline',
    fields: {
      subject: { type: 'string', required: true },
      fact_contains: { type: 'string', required: true }
    }
  },

  DEPARTURE: {
    position: 'inline',
    fields: {
      reason: { type: 'string', required: false },
      tone: { type: 'string', required: false }
    }
  },

  // Presence-only marker. The detect function tolerates an optional body
  // (`[PRELUDE_END: ...]`), but the canonical form is bare brackets.
  PRELUDE_END: {
    position: 'inline',
    fields: {}
  }
};

// ---------------------------------------------------------------------------
// Parsing — tolerant but validated
// ---------------------------------------------------------------------------

/**
 * Match a single marker body in text. Returns the raw key=value blob or
 * null if the named marker isn't present.
 *
 *   extractMarkerBody("...[LOOT_DROP: Item="Gold" Source="chest"]...", "LOOT_DROP")
 *   → 'Item="Gold" Source="chest"'
 *
 * Returns all matches when `all=true`.
 */
export function extractMarkerBodies(text, markerName, { all = false } = {}) {
  if (!text || typeof text !== 'string') return all ? [] : null;
  const re = new RegExp(`\\[${markerName}(?:\\s*:\\s*([^\\]]*))?\\]`, all ? 'gi' : 'i');
  if (!all) {
    const m = re.exec(text);
    if (!m) return null;
    return (m[1] || '').trim();
  }
  const out = [];
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push((m[1] || '').trim());
  }
  return out;
}

/**
 * Pull a single `field=value` out of a body string. Tolerates three quote
 * styles (", ', bare token) and surrounding whitespace. Returns null if
 * the field is absent.
 */
function extractField(body, fieldName) {
  // Field names may be CamelCase or snake_case or lowercase — match
  // case-insensitively so schema misalignment from the AI doesn't drop data.
  const re = new RegExp(`\\b${fieldName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,\\]]+))`, 'i');
  const m = re.exec(body);
  if (!m) return null;
  return m[1] ?? m[2] ?? m[3] ?? null;
}

/**
 * Parse a marker body against its schema. Returns:
 *   { ok: true, data: { ...fields } }
 *   { ok: false, errors: [{ field, reason }] }
 */
export function parseMarkerBody(body, schemaKey) {
  const schema = MARKER_SCHEMAS[schemaKey];
  if (!schema) return { ok: false, errors: [{ field: '*', reason: `Unknown marker schema: ${schemaKey}` }] };

  const data = {};
  const errors = [];

  for (const [fieldName, spec] of Object.entries(schema.fields)) {
    const raw = extractField(body || '', fieldName);

    if (raw === null || raw === '') {
      if (spec.required) {
        errors.push({ field: fieldName, reason: 'required field missing' });
      }
      continue;
    }

    if (spec.type === 'int') {
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n)) {
        errors.push({ field: fieldName, reason: `expected integer, got "${raw}"` });
        continue;
      }
      if (spec.min != null && n < spec.min) {
        errors.push({ field: fieldName, reason: `must be ≥ ${spec.min}, got ${n}` });
        continue;
      }
      if (spec.max != null && n > spec.max) {
        errors.push({ field: fieldName, reason: `must be ≤ ${spec.max}, got ${n}` });
        continue;
      }
      data[fieldName] = n;
    } else if (spec.type === 'enum') {
      const lower = String(raw).toLowerCase();
      const match = spec.enum.find(v => v.toLowerCase() === lower);
      if (!match) {
        errors.push({
          field: fieldName,
          reason: `expected one of {${spec.enum.join('|')}}, got "${raw}"`
        });
        continue;
      }
      data[fieldName] = match;
    } else if (spec.type === 'bool') {
      data[fieldName] = /^true$/i.test(raw);
    } else {
      data[fieldName] = String(raw);
    }
  }

  return errors.length === 0
    ? { ok: true, data }
    : { ok: false, errors };
}

/**
 * Try to parse ALL instances of a marker in text. Returns an array of
 * results, one per marker instance:
 *   [{ ok: true, data }, { ok: false, errors, rawBody }, ...]
 */
export function parseAllMarkers(text, schemaKey) {
  const bodies = extractMarkerBodies(text, schemaKey, { all: true });
  return bodies.map(body => {
    const result = parseMarkerBody(body, schemaKey);
    if (!result.ok) result.rawBody = body;
    return result;
  });
}

// ---------------------------------------------------------------------------
// Correction feedback formatting
// ---------------------------------------------------------------------------

/**
 * Build a short correction note the next prompt can inject as a [SYSTEM]
 * line. Invisible to the player (stripped during rendering). Gives the
 * AI a concrete schema violation to fix rather than a vague "try again".
 *
 * Multiple failures in the same turn are consolidated into one note.
 *
 *   formatCorrectionNote('PROMISE_MADE', { field: 'Weight', reason: 'expected one of {trivial|minor|moderate|major|critical}, got "huge"' })
 *   → '[SYSTEM] Your last [PROMISE_MADE] marker didn\'t record: Weight expected one of {trivial|minor|moderate|major|critical}, got "huge". If this promise mattered, re-emit the marker correctly in this turn.'
 */
export function formatCorrectionNote(schemaKey, errors) {
  if (!Array.isArray(errors)) errors = [errors];
  const parts = errors.map(e => `${e.field} ${e.reason}`);
  return `[SYSTEM] Your last [${schemaKey}] marker didn't record: ${parts.join('; ')}. If this mattered, re-emit the marker correctly in this turn. The schema is in your system prompt; follow it exactly.`;
}

/**
 * Convenience — given a text response and a list of (schemaKey, parseResult)
 * pairs, produce a single combined correction message ready to inject at the
 * top of the next system turn. Returns null when no failures to report.
 */
export function buildCorrectionMessage(failures) {
  if (!failures || failures.length === 0) return null;
  const lines = failures.map(f => formatCorrectionNote(f.schemaKey, f.errors));
  return lines.join('\n');
}

/**
 * Run schema validation against every marker appearing in an AI response.
 * Returns:
 *   { validByKey: { SCHEMA_KEY: [ parsed, ... ] },
 *     failures:   [ { schemaKey, errors, rawBody }, ... ] }
 *
 * `validByKey` is purely informational — existing call sites (for
 * back-compat) continue to use their own regex detectors for the actual
 * business logic. The VALUE of this function is the `failures` array:
 * any marker the AI emitted that the schema rejects. These get stashed
 * on session_config.pendingMarkerCorrections and surfaced on the next
 * turn's prompt so the AI can re-emit.
 *
 * Player never sees any of this — the correction lives in the system
 * prompt, stripped from display by the existing marker-stripping layer.
 */
export function validateDmMarkers(text) {
  if (!text || typeof text !== 'string') {
    return { validByKey: {}, failures: [] };
  }
  const validByKey = {};
  const failures = [];
  for (const schemaKey of Object.keys(MARKER_SCHEMAS)) {
    const results = parseAllMarkers(text, schemaKey);
    if (results.length === 0) continue;
    const valid = [];
    for (const r of results) {
      if (r.ok) {
        valid.push(r.data);
      } else {
        failures.push({ schemaKey, errors: r.errors, rawBody: r.rawBody });
      }
    }
    if (valid.length > 0) validByKey[schemaKey] = valid;
  }
  return { validByKey, failures };
}
