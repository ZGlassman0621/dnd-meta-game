/**
 * Prelude wizard persistence — save-on-step-advance + final submit.
 *
 * Mirrors `creatorPersistence.js`'s shape for the primary creator. The
 * prelude wizard's two persistence calls:
 *
 *   - `savePreludeProgress({ state, characterId })` — partial save called
 *     on every step advance. POST creates a 'prelude_setup' phase
 *     character row on Step 1 advance; PUT updates on subsequent steps.
 *     Returns `{ character_id }`.
 *
 *   - `submitPrelude({ state, characterId })` — final submit on Step 6.
 *     POST /api/prelude/setup with the full payload + `draft_character_id`
 *     so the server recycles the existing draft row instead of creating
 *     a new one. Returns the created character.
 *
 * Both honor the wizard's existing payload-build conventions (override
 * fields win over curated; parents filter; appearance object passed through).
 */

const APPEARANCE_FIELDS = ['eye_color', 'hair_color', 'skin_color', 'build']

/**
 * Build a draft-state body for save-on-advance. Sends the full wizard
 * state JSON; server stores it on prelude_setup_data and updates a few
 * displayable fields (name, race) on the character row so HomeScreenV2's
 * "Continue setup" card surfaces current progress.
 */
function buildDraftBody(state) {
  return {
    first_name: state.first_name || '',
    last_name: state.last_name || '',
    nickname: state.nickname || '',
    gender: state.gender || '',
    race: state.race || '',
    subrace: state.subrace || '',
    // Full wizard state goes into prelude_setup_data via JSON.stringify
    // server-side. We pass these top-level for displayable refresh, but
    // the entire `state` object is the payload (server calls
    // JSON.stringify(state)).
    birth_circumstance: state.birth_circumstance || '',
    birth_circumstance_other: state.birth_circumstance_other || '',
    home_setting: state.home_setting || '',
    home_setting_other: state.home_setting_other || '',
    region: state.region || '',
    region_other: state.region_other || '',
    parents: state.parents || [],
    siblings: state.siblings || '',
    authority_figure: state.authority_figure || '',
    origin_freeform: state.origin_freeform || '',
    appearance: pickAppearance(state.appearance),
    show_arc_preview: state.show_arc_preview ?? true
  }
}

function pickAppearance(appearance) {
  if (!appearance) return {}
  const out = {}
  for (const k of APPEARANCE_FIELDS) {
    if (appearance[k]) out[k] = appearance[k]
  }
  return out
}

/**
 * Save partial wizard progress to the server. Step 1 advance creates a
 * draft row; subsequent advances update it.
 */
export async function savePreludeProgress({ state, characterId }) {
  const body = buildDraftBody(state)
  const url = characterId
    ? `/api/prelude/setup/draft/${characterId}`
    : '/api/prelude/setup/draft'
  const method = characterId ? 'PUT' : 'POST'
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).error || '' } catch {}
    throw new Error(detail || `Save failed (HTTP ${res.status})`)
  }
  const data = await res.json()
  return { character_id: data.id }
}

/**
 * Build the final submit payload. Same shape the legacy
 * PreludeSetupWizard's buildPayload produced (the contract the existing
 * /api/prelude/setup endpoint expects), plus the new appearance object
 * + draft_character_id so the server recycles the draft row.
 */
function buildSubmitBody(state, characterId) {
  const resolved = (curated, overrideValue) => {
    const trimmed = (overrideValue || '').trim()
    if (trimmed) return trimmed
    return curated
  }
  const parents = (state.parents || [])
    .filter(p => p?.status && ((p.name || '').trim() || p.status !== 'present'))
    .map(p => ({
      role: p.role || 'guardian',
      name: (p.name || '').trim() || null,
      race: p.race || state.race,
      status: p.status
    }))
  const parentsFinal = parents.length > 0
    ? parents
    : [{ role: 'guardian', name: null, race: state.race, status: 'unknown' }]
  return {
    first_name: (state.first_name || '').trim(),
    last_name: (state.last_name || '').trim(),
    nickname: (state.nickname || '').trim() || null,
    gender: state.gender,
    race: state.race,
    subrace: state.subrace || null,
    birth_circumstance: resolved(state.birth_circumstance, state.birth_circumstance_other),
    home_setting: resolved(state.home_setting, state.home_setting_other),
    region: resolved(state.region, state.region_other),
    parents: parentsFinal,
    siblings: state.siblings,
    authority_figure: state.authority_figure,
    origin_freeform: (state.origin_freeform || '').trim() || null,
    appearance: pickAppearance(state.appearance),
    // Recycle the draft row at submit time. Keeps the same character id
    // through the prelude_setup → prelude phase flip.
    draft_character_id: characterId || undefined
  }
}

/**
 * Final submit. POST /api/prelude/setup with the recycle hint.
 * Returns the created/finalized character.
 */
export async function submitPrelude({ state, characterId }) {
  const body = buildSubmitBody(state, characterId)
  const res = await fetch('/api/prelude/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).error || '' } catch {}
    throw new Error(detail || `Server error (${res.status})`)
  }
  return res.json()
}

/**
 * Read a draft character's stored wizard state for resume. Called when
 * the player clicks the "Continue setup" home card.
 *
 * Returns { id, state } or throws on error.
 */
export async function loadPreludeDraft(characterId) {
  const res = await fetch(`/api/prelude/setup/draft/${characterId}`)
  if (!res.ok) {
    throw new Error(`Could not load draft (HTTP ${res.status})`)
  }
  return res.json()
}
