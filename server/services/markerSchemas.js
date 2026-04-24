/**
 * Marker schemas — single source of truth for every marker the DM AI emits.
 *
 * Problem this solves: markers used to be documented in prose inside the DM
 * system prompt, parsed ad-hoc by regex at each call site, and silently
 * dropped on malformed emission. When Sonnet typo'd a field or omitted a
 * required key, the side effect never fired. Over long campaigns these
 * silent drops accumulated: promises untracked, notoriety lost, canon
 * facts missing. The player never knew; the AI never knew either.
 *
 * New architecture:
 *   1. Every marker has a schema here — required/optional fields, types,
 *      enums. One source of truth.
 *   2. `parseMarker(rawText, schemaKey)` tries to parse, returns either
 *      { ok: true, data } or { ok: false, errors }.
 *   3. Call sites use this instead of bespoke regex. Failures are
 *      RECORDED, not swallowed — stored on session_config so the next
 *      turn's prompt can inject a [SYSTEM NOTE] asking Sonnet to
 *      re-emit correctly. That note is INVISIBLE to the player (stripped
 *      from display) but gives the AI a concrete correction target.
 *
 * This is the intermediate step toward full tool-use migration. When that
 * lands, these schemas become the tool definitions directly — no rewrite.
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

  MERCHANT_COMMISSION: {
    position: 'inline',
    fields: {
      Merchant: { type: 'string', required: true },
      Item: { type: 'string', required: true },
      Price_GP: { type: 'int', required: true, min: 1 },
      Deposit_GP: { type: 'int', required: true, min: 0 },
      Lead_Time_Days: { type: 'int', required: true, min: 1 },
      Quality: { type: 'enum', enum: ['standard', 'fine', 'superior', 'masterwork'], required: false },
      Hook: { type: 'string', required: false }
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
