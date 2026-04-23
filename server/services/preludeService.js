/**
 * Prelude service.
 *
 * Phase 1 scope: create a prelude-phase character from the 12-question setup
 * wizard and read it back. Nothing playable yet — later phases add arc-plan
 * generation (Phase 2), gameplay (Phase 2), emergence tracking (Phase 3),
 * transition (Phase 5).
 *
 * A prelude character is a `characters` row with `creation_phase='prelude'`
 * and placeholder values in the usual class/level/hp/stats columns. The
 * whole 12-answer setup blob lives on `prelude_setup_data`. When the prelude
 * ends (Phase 5), the main character creator wizard opens pre-filled from
 * the emerged state and flips `creation_phase` to `'active'`.
 */

import { dbAll, dbGet, dbRun } from '../database.js';

// Race-aware "early childhood" starting age. Prelude begins at Chapter 1 for
// the character's race — for humans that's 5-8, for elves 25-50, etc.
// Aligns with the chapter age ranges Opus receives in preludeArcService.
function computeStartingAge(race) {
  const key = String(race || '').toLowerCase();
  switch (key) {
    case 'human':
    case 'tiefling':
    case 'aasimar':
    case 'halfling':
      return 6;
    case 'half-elf':
      return 8;
    case 'half-orc':
      return 4; // half-orcs mature quickly
    case 'dragonborn':
      return 2; // dragonborn mature fast
    case 'dwarf':
      return 18;
    case 'elf':
      return 30;
    case 'gnome':
      return 14;
    case 'warforged':
      return 1; // first year post-activation
    default:
      return 6;
  }
}

// Provisional HP for the prelude period — uses developmental stage rather
// than raw earth-years, so an elven "child" of 30 isn't still on 4 HP.
// `chapter` is 1-4 (Early/Middle/Adolescence/Threshold).
function computeStartingHP(chapter = 1, conMod = 0) {
  if (chapter <= 1) return Math.max(1, 4 + conMod);
  if (chapter <= 2) return Math.max(1, 6 + 2 * conMod);
  if (chapter <= 3) return Math.max(1, 8 + 2 * conMod);
  return Math.max(1, 10 + 2 * conMod); // Ch4 = L1 equivalent
}

/**
 * Validate a setup payload from the wizard. Returns { ok: true } or
 * { ok: false, field, reason } on the first missing field. The client
 * validates too, but server-side validation is authoritative.
 */
export function validateSetupPayload(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, field: null, reason: 'Setup payload missing' };

  // Name: at least one of first_name / last_name must be non-empty. Many
  // D&D characters have only a single name (orphans, outcasts, "Pig", "Tom"),
  // so the client wizard allows either. Server validation has to match.
  const firstOk = typeof payload.first_name === 'string' && payload.first_name.trim() !== '';
  const lastOk = typeof payload.last_name === 'string' && payload.last_name.trim() !== '';
  if (!firstOk && !lastOk) {
    return { ok: false, field: 'first_name', reason: 'Character needs at least a first or last name' };
  }

  const requiredStrings = ['gender', 'race', 'birth_circumstance', 'home_setting', 'region'];
  for (const f of requiredStrings) {
    if (!payload[f] || typeof payload[f] !== 'string' || payload[f].trim() === '') {
      return { ok: false, field: f, reason: `Missing ${f}` };
    }
  }

  // Starting age is race-derived server-side (v1.0.43). The client no longer
  // collects it. Incoming payloads may or may not include it — we ignore
  // whatever value comes in and recompute from race.

  if (!Array.isArray(payload.parents) || payload.parents.length === 0 || payload.parents.length > 2) {
    return { ok: false, field: 'parents', reason: 'Must describe 1 or 2 parents (use unknown/deceased if you don\'t know them)' };
  }
  for (let i = 0; i < payload.parents.length; i++) {
    const p = payload.parents[i];
    if (!p || typeof p !== 'object') {
      return { ok: false, field: `parents[${i}]`, reason: 'Each parent must be an object' };
    }
    if (!p.status || typeof p.status !== 'string') {
      return { ok: false, field: `parents[${i}].status`, reason: 'Each parent must have a status' };
    }
    // Role is optional but if present must be a string (not locked to enum —
    // let players write in custom guardians).
    if (p.role != null && typeof p.role !== 'string') {
      return { ok: false, field: `parents[${i}].role`, reason: 'Parent role must be a string if provided' };
    }
  }

  if (!Array.isArray(payload.siblings)) {
    return { ok: false, field: 'siblings', reason: 'Siblings must be an array (empty is fine for only children)' };
  }
  for (let i = 0; i < payload.siblings.length; i++) {
    const s = payload.siblings[i];
    if (!s || typeof s !== 'object') {
      return { ok: false, field: `siblings[${i}]`, reason: 'Each sibling must be an object' };
    }
    if (s.relative_age && !['younger', 'older', 'twin'].includes(s.relative_age)) {
      return { ok: false, field: `siblings[${i}].relative_age`, reason: 'relative_age must be younger, older, or twin' };
    }
  }

  if (!Array.isArray(payload.talents) || payload.talents.length !== 3) {
    return { ok: false, field: 'talents', reason: 'Pick exactly 3 things they\'re good at' };
  }
  if (!Array.isArray(payload.cares) || payload.cares.length !== 3) {
    return { ok: false, field: 'cares', reason: 'Pick exactly 3 things they care about' };
  }

  // v1.0.73 — tone is a single curated preset (stored as a single-item
  // array to match the legacy column shape).
  if (!Array.isArray(payload.tone_tags) || payload.tone_tags.length !== 1) {
    return { ok: false, field: 'tone_tags', reason: 'Pick one tone preset' };
  }
  const validPresetValues = ['brutal_gritty', 'epic_fantasy', 'rustic_spiritual', 'tender_hopeful'];
  if (!validPresetValues.includes(payload.tone_tags[0])) {
    return { ok: false, field: 'tone_tags', reason: `Unknown tone preset: ${payload.tone_tags[0]}` };
  }

  return { ok: true };
}

/**
 * Compose the full legal name for the character row.
 * `name` on the characters table is the combined display name.
 */
function buildFullName(payload) {
  const parts = [payload.first_name, payload.last_name].filter(Boolean).map(s => s.trim());
  return parts.join(' ');
}

/**
 * Build the home location string from the setup answers. Stored in
 * `current_location` as a placeholder — at prelude end the main creator
 * will overwrite this with the primary campaign's starting location, but
 * during prelude play it's useful for status UIs that read current_location.
 */
function buildCurrentLocation(payload) {
  const setting = payload.home_setting || 'home';
  const region = payload.region || 'somewhere';
  return `${setting} (${region})`;
}

/**
 * Create a new prelude-phase character. Returns the created character row.
 *
 * The character is intentionally minimal — no class, no theme, no stats
 * beyond all-10s. The fully-specified character emerges at the end of the
 * prelude through the main creator wizard.
 */
export async function createPreludeCharacter(payload) {
  const v = validateSetupPayload(payload);
  if (!v.ok) throw new Error(`Invalid setup: ${v.reason}`);

  const fullName = buildFullName(payload);
  if (!fullName) throw new Error('Invalid setup: character needs at least a first or last name');

  // Age is race-derived in v1.0.43+. We ignore any client-provided
  // starting_age and compute from race instead. Write the computed age back
  // into the payload before persisting so Opus (and the arc preview) see
  // the same value.
  const age = computeStartingAge(payload.race);
  payload.starting_age = age;
  const startingHP = computeStartingHP(1, 0); // chapter 1 at creation
  const location = buildCurrentLocation(payload);

  // Provisional stats: all 10s. Racial bonuses will be applied by the main
  // creator when the player finalizes. Emergence bonuses accrue on the
  // `prelude_emergences` table until then.
  const abilityScores = JSON.stringify({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });

  const sql = `
    INSERT INTO characters (
      name, first_name, last_name, nickname, gender,
      class, race, subrace,
      level, current_hp, max_hp, current_location, current_quest,
      experience_to_next_level,
      armor_class, speed, ability_scores,
      age,
      creation_phase, prelude_age, prelude_chapter, prelude_setup_data
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const args = [
    fullName,
    (payload.first_name || '').trim() || null,
    (payload.last_name || '').trim() || null,
    (payload.nickname || '').trim() || null,
    payload.gender,
    'prelude',           // placeholder class — main creator sets the real class
    payload.race,
    (payload.subrace || '').trim() || null,
    0,                   // level 0 during prelude; flips to 1 at main-creator submit
    startingHP,
    startingHP,
    location,
    null,                // no quest
    0,                   // experience_to_next_level
    10,                  // AC 10 (no armor, DEX 0 mod)
    30,                  // speed — racial/age tweaks can come later
    abilityScores,
    String(age),         // `age` column is TEXT in the existing schema
    'prelude',
    age,
    1,                   // chapter 1
    JSON.stringify(payload)
  ];

  const result = await dbRun(sql, args);
  const id = result.lastID || result.lastInsertRowid;
  if (!id) throw new Error('Prelude character insert returned no id');

  return getPreludeCharacter(id);
}

/**
 * Read a prelude character with parsed setup data.
 * Returns null if not found or not in prelude phase.
 */
export async function getPreludeCharacter(characterId) {
  const row = await dbGet(
    `SELECT * FROM characters WHERE id = ?`,
    [characterId]
  );
  if (!row) return null;
  if (row.creation_phase !== 'prelude') return null;

  let setup = null;
  try {
    setup = row.prelude_setup_data ? JSON.parse(row.prelude_setup_data) : null;
  } catch {
    // Leave as raw text if parse fails — surface for debugging
    setup = { _raw: row.prelude_setup_data, _parse_error: true };
  }

  return { ...row, prelude_setup_data: setup };
}

/**
 * List all prelude characters (any user). Phase 1 wires this into the
 * character manager UI so the player can see in-progress preludes alongside
 * finished characters.
 */
export async function listPreludeCharacters() {
  const rows = await dbAll(
    `SELECT id, name, first_name, last_name, nickname, gender, race, subrace,
            prelude_age, prelude_chapter, created_at, updated_at
     FROM characters
     WHERE creation_phase = 'prelude'
     ORDER BY updated_at DESC`,
    []
  );
  return rows;
}
