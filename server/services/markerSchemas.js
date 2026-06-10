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

  // ── Mechanical-spine markers (Phase B, 2026-06-05) ────────────────────────
  // Handlers live in gameStateMarkerService.js. These turn narrated mechanics
  // into real persisted state (HP, effects/concentration, combat turns, dice).

  // Damage/healing applied to the player. Negative Delta = damage.
  HP_CHANGE: {
    position: 'inline',
    fields: {
      Target: { type: 'string', required: false }, // defaults to the player
      Delta: { type: 'int', required: true },
      Reason: { type: 'string', required: false }
    }
  },

  // A spell/ability effect begins (e.g. Bless, Hunter's Mark, Rage).
  EFFECT_START: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true },
      Concentration: { type: 'bool', required: false },
      Duration: { type: 'string', required: false },
      Source: { type: 'string', required: false }
    }
  },

  // A previously-started effect ends (expired, dismissed, concentration broken).
  EFFECT_END: {
    position: 'inline',
    fields: {
      Name: { type: 'string', required: true }
    }
  },

  // Combat turn advancement — keeps the rolled initiative order truthful.
  TURN: {
    position: 'inline',
    fields: {
      Combatant: { type: 'string', required: true },
      Round: { type: 'int', required: false, min: 1 }
    }
  },

  // The DM wants the player to roll. The handler preloads the player's modifier
  // so the UI can offer a one-click roll and feed the result back.
  ROLL_REQUEST: {
    position: 'inline',
    fields: {
      Kind: { type: 'enum', enum: ['attack', 'save', 'check'], required: false },
      Ability: { type: 'string', required: false },
      DC: { type: 'int', required: false },
      Advantage: { type: 'enum', enum: ['advantage', 'disadvantage', 'normal'], required: false },
      Label: { type: 'string', required: false }
    }
  },

  // Scene snapshot for the cockpit "This scene" panel. Values are unquoted and
  // semicolon-separated in practice, so the route parses them directly; this
  // schema entry exists for marker-awareness + correction-loop coverage (all
  // fields optional → never a false failure).
  SCENE: {
    position: 'last',
    fields: {
      place: { type: 'string', required: false },
      light: { type: 'string', required: false },
      weather: { type: 'string', required: false },
      mood: { type: 'string', required: false }
    }
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

// ---------------------------------------------------------------------------
// Player-facing narrative scrubbing
// ---------------------------------------------------------------------------

// The EXACT set of markers the per-turn route removes from narrative before it
// reaches the player. This is intentionally a SUPERSET of the live
// MARKER_SCHEMAS keys: it also defensively strips prelude (SKILL_CHECK) and
// archived markers (MERCHANT_*, survival/crafting/mythic/piety/promise) in case
// the DM ever emits a stray one. COMBAT_END is the only bodyless marker; every
// other marker carries a `: body`. This list reproduces the prior 31-call
// inline .replace() chain verbatim — keep it in sync when a new
// player-invisible marker is introduced.
const STRIP_BODYLESS_MARKERS = ['COMBAT_END'];
const STRIP_BODIED_MARKERS = [
  'SCENE', 'MERCHANT_SHOP', 'MERCHANT_REFER', 'ADD_ITEM', 'LOOT_DROP', 'COMBAT_START',
  'HP_CHANGE', 'EFFECT_START', 'EFFECT_END', 'TURN', 'ROLL_REQUEST', 'SKILL_CHECK',
  'CONDITION_ADD', 'CONDITION_REMOVE', 'WEATHER_CHANGE', 'SHELTER_FOUND', 'SWIM',
  'EAT', 'DRINK', 'FORAGE', 'RECIPE_FOUND', 'MATERIAL_FOUND', 'CRAFT_PROGRESS',
  'RECIPE_GIFT', 'MYTHIC_TRIAL', 'PIETY_CHANGE', 'ITEM_AWAKEN', 'MYTHIC_SURGE',
  'PROMISE_MADE', 'PROMISE_FULFILLED'
];

/** Every marker key stripped from player-facing narrative (for tests/awareness). */
export const STRIP_MARKER_KEYS = [...STRIP_BODIED_MARKERS, ...STRIP_BODYLESS_MARKERS];

// One compiled regex: `[KEY: body]` for bodied markers, `[KEY]` for the bodyless
// COMBAT_END, each plus trailing whitespace — semantically identical to the old
// per-marker `\[KEY:[^\]]+\]\s*` / `\[COMBAT_END\]\s*` chain. The colon-body
// requirement on bodied markers is preserved so a bodyless `[TURN]` is left
// untouched exactly as before.
const STRIP_MARKER_RE = new RegExp(
  `\\[(?:(?:${STRIP_BODIED_MARKERS.join('|')}):[^\\]]+|${STRIP_BODYLESS_MARKERS.join('|')})\\]\\s*`,
  'gi'
);

/**
 * Remove every known DM marker from a narrative string before display.
 * Behavior-preserving replacement for the per-turn route's 31-call strip chain.
 * @param {string} narrative
 * @returns {string}
 */
export function stripKnownMarkers(narrative) {
  if (!narrative || typeof narrative !== 'string') return narrative;
  return narrative.replace(STRIP_MARKER_RE, '').trim();
}
