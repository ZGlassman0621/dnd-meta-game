import { findSpeciesEntry, resolveOriginSetting } from './speciesAdapter.js'
import { concreteLanguages, languageChoiceCount } from '../../data/references.js'
import { mixedAncestrySaveRecord } from './mixedAncestry.js'

// Warlock pact: the Stage 2 picker holds the display name ('Pact of
// the Blade'); the server column (migration 113) stores the key.
const PACT_KEYS = ['blade', 'chain', 'tome']
export function pactKeyFromName(name) {
  if (!name || typeof name !== 'string') return null
  const key = name.trim().toLowerCase().replace(/^pact of the\s+/, '')
  return PACT_KEYS.includes(key) ? key : null
}
export function pactNameFromKey(key) {
  const k = typeof key === 'string' ? key.trim().toLowerCase() : ''
  return PACT_KEYS.includes(k) ? `Pact of the ${k.charAt(0).toUpperCase()}${k.slice(1)}` : null
}

/**
 * Stage 1 draft persistence — creator-next.
 *
 * Mirrors V2's saveProgress pattern (server row as source of truth:
 * first save POSTs a 'creating' row, later saves PUT it) but for
 * creator-next fields. Origin columns ride the PUT allowlist and the
 * POST origin block added with migration 105; name/gender/avatar/
 * race/subrace were already allowlisted. Stage 3 fields ride the
 * progress body (theme_id, origin_feat, origin_feat_choices,
 * theme_path_choice, theme_path_data); Stage 4 fields ride it too (generation_method,
 * base_scores, ability_choice_picks, ability_scores, skills,
 * tool_proficiencies, languages, known_spells, prepared_spells),
 * all truthy-gated so a blank stage sends nothing. Stage 5 fields
 * ride it too (gear_choice, package_id, package_picks — validation-
 * only picks, raw except package_picks which is stringified — plus
 * the plain story columns); see the Stage 5 block in
 * buildStage1ProgressBody for the PUT hazard on gear-only bodies.
 *
 * Feat id + subchoices are NOT row columns — they persist through the
 * existing character_ancestry_feats helper at draft save
 * (persistAncestryFeatSelection, called on POST + PUT when the body
 * carries ancestry_feat_id; the id + choices ride buildStage1ProgressBody
 * since 2026-11-06, item 22 follow-up). The preview shell still mirrors
 * the whole Stage 1 draft to localStorage so a refresh never loses a
 * pick; that mirror is preview-only and is superseded by submit wiring,
 * never a second source of truth for play.
 *
 * Opening rule (2026-11-05 bug fix — Create New Character opened with
 * the prior character's info): the local mirror is trusted ONLY for a
 * resume of the character it belongs to. A fresh create NEVER reads
 * it — see resolveOpeningDraft below.
 */
export function buildStage1ProgressBody(state, themes = null) {
  const body = {}
  if (state.first_name) body.first_name = state.first_name
  if (state.last_name) body.last_name = state.last_name
  if (state.nickname) body.nickname = state.nickname
  if (state.gender) body.gender = state.gender
  if (state.avatar) body.avatar = state.avatar
  const composed = [state.first_name, state.last_name].filter(Boolean).join(' ').trim()
  if (composed) body.name = composed
  if (state.race) body.race = state.race
  if (state.subrace) body.subrace = state.subrace
  // Human size choice (2024 PHB p. 194): top-level `size`, sent only
  // when picked. A mixed-ancestry record owns size (its own `size`
  // field, validated against the parents) — a body-level `size` on a
  // mixed PUT is ignored by the server, so it is not sent either.
  const mixedRecord = mixedAncestrySaveRecord(state.mixedAncestry)
  if (mixedRecord) {
    // `race` is a display placeholder in the body — the server stores
    // `Mixed Ancestry (Parent A / Parent B)`. Never send
    // mixed_ancestry_json directly: it is not in the PUT allowlist
    // and would be dropped.
    body.race = 'human'
    body.mixed_ancestry = mixedRecord
  } else if (state.size) {
    body.size = state.size
  }
  // Standalone Human Versatile pick (2024 human trait, Stage 1):
  // top-level versatile_feat (+ subchoices), offered only when the
  // species entry carries versatile2024. Never sent for a mixed
  // character — mixed humans get Versatile only via the trait pick
  // inside mixed_ancestry (cost 4). A PUT carrying only
  // versatile_feat persists it (judged against the stored theme feat).
  if (!mixedRecord && state.versatileFeat) {
    body.versatile_feat = state.versatileFeat
    if (state.versatileFeatChoices && Object.keys(state.versatileFeatChoices).length) {
      body.versatile_feat_choices = state.versatileFeatChoices
    }
  }
  // Ancestry feat (Stage 1): the feat id + its sub-choices ride the
  // progress body so POST persists them (persistAncestryFeatSelection)
  // and PUT re-persists them, and so validateCreatorNextStage4 can see
  // an ancestry skill pick on a first save instead of deriving it as a
  // class pick (item 22 false-refusal, 2026-11-06). Both ride raw, not
  // stringified: the id is a scalar and the choices are a
  // validation-only object, like origin_feat_choices below — neither
  // is a row column, so neither reaches SQL binding. Absent = not yet
  // chosen. The id is the seeded ancestry_feats row id the Stage 1
  // picker stores (same value the server validator/persist expect).
  if (state.ancestry_feat_id) body.ancestry_feat_id = state.ancestry_feat_id
  if (state.ancestry_feat_choices && Object.keys(state.ancestry_feat_choices).length) {
    body.ancestry_feat_choices = state.ancestry_feat_choices
  }
  // Stage 2 (Class & Calling) — fighting style, subclass choices,
  // cantrips. All three ride the save body now (2026-11-07 follow-up;
  // the PUT allowlist accepts them — fighting_style and
  // subclass_choices_json were added by the server worker, and
  // known_cantrips was already allowlisted — so a draft save carrying
  // them persists instead of dropping them). fighting_style is a plain
  // string column (058); subclass_choices rides RAW as an object, like
  // class_skill_picks (the server stringifies it into
  // subclass_choices_json, 103); known_cantrips is a JSON STRING like
  // the other JSON columns. Truthy-gated: an empty style / empty
  // choices / empty list sends nothing, so a blank Stage 2 still
  // builds an empty body for these fields. The commit body spreads
  // this builder, so the same three ride the commit automatically.
  if (state.fightingStyle) body.fighting_style = state.fightingStyle
  if (state.subclassChoices && Object.keys(state.subclassChoices).length) {
    body.subclass_choices = state.subclassChoices
  }
  if (Array.isArray(state.knownCantrips) && state.knownCantrips.length) {
    body.known_cantrips = JSON.stringify(state.knownCantrips)
  }
  // Warlock pact (creator test-notes #11, migration 113): the server
  // column is `pact` and stores the lowercase key ('blade' | 'chain' |
  // 'tome'). The picker holds the display name ('Pact of the Blade').
  // Creation-solidification (2026-11-12, fix-as-you-find): this used to
  // send `pact_boon` with the display name — a key the server never
  // reads — so the pick was never persisted and never resumed.
  {
    const pactKey = pactKeyFromName(state.pactBoon)
    if (pactKey) body.pact = pactKey
  }
  // Creation-solidification item 5 (migration 114): optional free text
  // about the subclass; no stage sets it since Zach's 2026-11-12
  // ruling. Truthy-gated like origin_explanation.
  if (state.subclassOriginExplanation && String(state.subclassOriginExplanation).trim()) {
    body.subclass_origin_explanation = String(state.subclassOriginExplanation).trim()
  }
  const originSetting = resolveOriginSetting(state.origin_setting, state.origin_setting_custom)
  if (originSetting) body.origin_setting = originSetting
  if (state.origin_region) body.origin_region = state.origin_region
  if (state.origin_explanation) body.origin_explanation = state.origin_explanation
  // Stage 3 (Past & Path) fields ride the progress body too — NOT kept
  // out the way class/subclass are in saveStage1Progress. The shell's
  // blank-save guard measures this body, and a theme-only draft must
  // count as non-empty: a resume with a blank Stage 1 can jump straight
  // to Stage 3 (the Stepper lets any step be picked), and if the guard
  // saw an empty body there it would skip the save entirely — server
  // AND local mirror — and silently drop the theme pick on Continue.
  // A blank state still builds an empty body (these only land when set).
  if (state.themeId) body.theme_id = state.themeId
  // Forgo trade (Mixed Ancestry): giving up the theme's origin feat
  // buys +4 power budget, and the server refuses an origin-feat
  // grant while the trade is on — so the feat (and its subchoices)
  // simply do not ride the body when the trade is on. The theme
  // itself still saves; the feat is forgone, not granted. Turning
  // the trade off again re-sends the feat on the next save.
  const forgoTradeOn = mixedRecord?.forgoOriginFeat === true
  if (state.originFeat && !forgoTradeOn) body.origin_feat = state.originFeat
  if (state.themePathChoice) body.theme_path_choice = state.themePathChoice
  // Soldier second field (R2-11e, SERVER shape): the active-duty pick
  // rides theme_path_data as a JSON STRING of { <key>: <value> } into
  // character_themes.path_data — a raw object 500s at bind time (same
  // stringify rule as the other Stage 4 JSON columns), and a bare
  // string fails Review §6 ("requires a Active Duty choice"). The key
  // comes from the theme's own creation_choice_second_field ('active_duty'
  // for Soldier); when the themes list was not passed to the builder the
  // key falls back to 'active_duty' — the only second-field key the
  // registry serves — rather than dropping the pick. Still truthy-gated
  // like the other Stage 3 fields.
  if (state.themePathData) {
    body.theme_path_data = JSON.stringify({ [secondFieldKeyFor(state.themeId, themes)]: state.themePathData })
  }
  if (state.originFeatChoices && Object.keys(state.originFeatChoices).length && !forgoTradeOn) {
    body.origin_feat_choices = state.originFeatChoices
  }
  // Stage 4 (Abilities, Skills, & Spells) fields ride the progress
  // body too, truthy-gated like Stage 3: a blank Stage 4 (no scores
  // placed, no picks made) sends nothing, so the shell's blank-save
  // guard keeps its exact meaning — a blank state still builds {}.
  // The route's JSON columns are JSON STRINGS on the wire (the POST
  // INSERT / PUT UPDATE pass body values straight through — a raw
  // array or object 500s at bind time), so every Stage 4 JSON field
  // is stringified here; the server validator accepts strings or
  // arrays. generation_method / base_scores / ability_choice_picks
  // ride ONLY once ability_scores is complete (all six placed): they
  // are validation-only fields with no character column, so a body
  // carrying only them would 400 "No valid fields to update" on PUT.
  // Partial scores stay in the local mirror only.
  const scoresComplete = state.ability_scores && Object.keys(state.ability_scores).length === 6
  if (scoresComplete) {
    body.generation_method = state.generation_method || 'point_buy'
    body.base_scores = JSON.stringify(state.base_scores)
    body.ability_scores = JSON.stringify(state.ability_scores)
  }
  if (scoresComplete && state.ability_choice_picks && Object.keys(state.ability_choice_picks).length) {
    body.ability_choice_picks = JSON.stringify(state.ability_choice_picks)
  }
  if (Array.isArray(state.skills) && state.skills.length) body.skills = JSON.stringify(state.skills)
  // Class skill picks (Stage 4): the class's own picks ride raw (a
  // plain array, not stringified) so validateCreatorNextStage4 can
  // treat them as authoritative instead of deriving the class picks
  // from the submitted list (item 22 false-refusal, 2026-11-06).
  // Validation-only, like origin_feat_choices — never a row column,
  // so it never reaches SQL binding. Sent as stored in state; a pick
  // that went stale (it now duplicates a granted skill after a
  // theme/feat change) still rides along and the server counts it —
  // Stage 4 flags stale picks in the UI and the player un-picks them.
  if (Array.isArray(state.classSkillPicks) && state.classSkillPicks.length) {
    body.class_skill_picks = state.classSkillPicks
  }
  if (Array.isArray(state.tool_proficiencies) && state.tool_proficiencies.length) {
    body.tool_proficiencies = JSON.stringify(state.tool_proficiencies)
  }
  // Stage 1 extra-language picks (R2-15) ride with the derived list:
  // the picks are source state, and the body carries the union so a
  // draft saved before Stage 4 still holds them. Stage 4's derived
  // list is the same union once it runs.
  const bodyLanguages = [...new Set([...(state.languages || []), ...(state.languageChoices || [])])]
  if (bodyLanguages.length) body.languages = JSON.stringify(bodyLanguages)
  if (Array.isArray(state.known_spells) && state.known_spells.length) body.known_spells = JSON.stringify(state.known_spells)
  if (Array.isArray(state.prepared_spells) && state.prepared_spells.length) {
    body.prepared_spells = JSON.stringify(state.prepared_spells)
  }
  // Stage 5 (Gear & Story) fields ride the progress body too,
  // truthy-gated like Stages 3–4. gear_choice / package_id /
  // package_picks are validation-only picks (the server resolves them
  // into inventory/equipment/gold at submit — the client never sends
  // resolved items): they ride raw, like class_skill_picks, never a
  // row column, so a PUT drops them silently and the local mirror is
  // their draft home until the server persists them. package_picks is
  // the one JSON field: a JSON STRING on the wire, per the Stage 4
  // stringify rule. package_id / package_picks ride only on the
  // packages fork — on the gold fork the choice is gear_choice alone.
  // Story fields are plain row columns already (POST destructure +
  // PUT allowlist), so they ride as plain strings, truthy-gated.
  // NOTE: a body carrying ONLY gear picks (no Stage 1–4 field, no
  // story field) still 400s on PUT ("No valid fields to update") —
  // the same validation-only hazard class_skill_picks has. In normal
  // flow the body always re-sends the earlier stages' fields, so it
  // cannot happen by walking the wizard; it needs a server-side home
  // for the picks to close fully (server worker).
  if (state.gear_choice) body.gear_choice = state.gear_choice
  if (state.gear_choice === 'packages' && state.package_id) body.package_id = state.package_id
  if (state.gear_choice === 'packages' && state.package_picks && Object.keys(state.package_picks).length) {
    body.package_picks = JSON.stringify(state.package_picks)
  }
  if (state.alignment) body.alignment = state.alignment
  if (state.faith) body.faith = state.faith
  if (state.lifestyle) body.lifestyle = state.lifestyle
  if (state.age) body.age = state.age
  if (state.height) body.height = state.height
  if (state.weight) body.weight = state.weight
  if (state.eye_color) body.eye_color = state.eye_color
  if (state.hair_color) body.hair_color = state.hair_color
  if (state.skin_color) body.skin_color = state.skin_color
  if (state.physical_build) body.physical_build = state.physical_build
  if (state.personality_traits) body.personality_traits = state.personality_traits
  if (state.ideals) body.ideals = state.ideals
  if (state.bonds) body.bonds = state.bonds
  if (state.flaws) body.flaws = state.flaws
  if (state.organizations) body.organizations = state.organizations
  if (state.allies) body.allies = state.allies
  if (state.enemies) body.enemies = state.enemies
  if (state.backstory) body.backstory = state.backstory
  if (state.other_notes) body.other_notes = state.other_notes
  return body
}

/**
 * Soldier second-field key (R2-11e, server shape): the theme's
 * creation_choice_second_field.key ('active_duty' for Soldier). The
 * themes list is the /api/themes payload (array or { themes: [...] }),
 * held by the shell and by Review; buildStage1ProgressBody takes it as
 * an optional second arg so the key is read from the theme entry, not
 * hardcoded. When it is not supplied — a bare builder call, e.g. a test
 * — the key falls back to 'active_duty', the only second-field key the
 * registry serves today, rather than dropping the pick.
 */
export function secondFieldKeyFor(themeId, themes) {
  const list = Array.isArray(themes) ? themes : (Array.isArray(themes?.themes) ? themes.themes : null)
  const entry = list?.find(t => t?.id === themeId) || null
  const key = entry?.creation_choice_second_field?.key
  return typeof key === 'string' && key.trim() ? key.trim() : 'active_duty'
}

/**
 * The blank opening state — every Stage 1–4 field empty.
 * Moved here from CreatorNextShell so the opening resolution (and its
 * tests) use the exact shape the shell renders. Nothing is ever
 * silently defaulted: a fresh character starts with no species, no
 * origin, no name, no class.
 */
export function blankStage1State() {
  return {
    first_name: '', last_name: '', nickname: '', gender: '',
    avatar: null, avatarPreview: null,
    race: '', subrace: '', ancestry_feat_id: null, ancestry_feat_choices: {},
    // Mixed Ancestry (Stage 1): null until the player turns it on;
    // then { parents: [id, id], traits: [{species, trait, cost, form?}],
    // size, speed, forgoOriginFeat, versatileFeat }. `race` stays ''
    // while mixed is on — the save body sends the 'human' display
    // placeholder + the record, and the server stores the label.
    mixedAncestry: null,
    // Human size choice (2024): '' = no choice recorded yet (draft).
    size: '',
    // Standalone Human Versatile pick: '' until picked; its
    // subchoices ride versatileFeatChoices (same shape as
    // originFeatChoices). Never set for a mixed character.
    versatileFeat: '', versatileFeatChoices: {},
    origin_setting: '', origin_setting_custom: '', origin_region: '', origin_explanation: '',
    // Stage 2 (Class & Calling) — starts empty, never silently defaulted.
    // knownCantrips is the FINAL cantrip list (class picks + granted +
    // species-choice picks, spell KEYS like known_spells) — Stage 2
    // keeps it in sync with the granted list, and the commit validator
    // requires the full final list. fightingStyle is '' until picked;
    // subclassChoices is {} until a subclass choice is made.
    classId: '', subclassName: '', fightingStyle: '', subclassChoices: {}, knownCantrips: [],
    // Warlock pact (creator test-notes #11) + god (Stage 2 picker,
    // same state.faith Stage 5 collects): both start empty, never
    // silently defaulted.
    pactBoon: '',
    // Subclass origin explanation (creation-solidification item 5,
    // migration 114). Optional and currently unset by any stage —
    // Zach's ruling 2026-11-12 dropped the requirement; kept for the
    // proposed "calling" field (see the creation-solidification REPORT).
    subclassOriginExplanation: '',
    // Stage 3 (Past & Path) — starts empty, never silently defaulted.
    // Picking a theme sets themeId + originFeat and resets the rest.
    // themePathData is the second path choice (Soldier active-duty,
    // R2-11e) — '' until picked, stored in character_themes.path_data.
    themeId: '', themePathChoice: '', themePathData: '', originFeat: '', originFeatChoices: {},
    // Stage 4 (Abilities, Skills, & Spells) — starts empty, never
    // silently defaulted. generation_method defaults to point_buy (the
    // plan default); base_scores stays {} until the player places a
    // score, so a blank Stage 4 still builds an empty progress body.
    // ability_scores is derived (base + species + choice + theme) and
    // syncs only once all six bases are placed. skills /
    // tool_proficiencies / languages are the final deduped lists;
    // known_spells / prepared_spells hold spell KEYS from /api/spells.
    // classSkillPicks rides the save body as class_skill_picks (the
    // server treats it as the authoritative class-pick list, item 22);
    // stage4PicksClass stays local-mirror-only — the class those picks
    // were made for, so a class change clears them.
    generation_method: 'point_buy',
    base_scores: {}, ability_choice_picks: {}, ability_scores: {},
    skills: [], tool_proficiencies: [], languages: [],
    // Extra-language picks (R2-15): the Stage 1 resolution of a
    // "one extra language of your choice" grant — canonical language
    // names, [] until picked. Stage 4 merges them into `languages`.
    languageChoices: [],
    known_spells: [], prepared_spells: [],
    classSkillPicks: [], stage4PicksClass: '',
    // Stage 5 (Gear & Story) — starts empty, never silently defaulted.
    // gear_choice: '' until the player picks the fork ('packages' |
    // 'gold'); package_id is the 'A' | 'B' | 'C' package letter on the
    // packages fork; package_picks holds the category picks keyed by
    // package entry ({ <entryKey>: [chosen values] }) — PICKS ONLY,
    // the server resolves them into inventory/equipment/gold at
    // submit. stage5PicksClass stays local-mirror-only — the class
    // those picks were made for, so a class change clears them (same
    // rule as Stage 4). Story fields are plain text, all optional at
    // this stage (alignment / faith / lifestyle / physical are
    // required at Review, Stage 6 — never a block here); every one is
    // a real row column already, so a pick here persists on save.
    // The distinguishing-features column exists (migration 060) and
    // the commit persists it when sent — but it is not collected here
    // (no Review field yet).
    gear_choice: '', package_id: '', package_picks: {}, stage5PicksClass: '',
    alignment: '', faith: '', lifestyle: '',
    age: '', height: '', weight: '', eye_color: '', hair_color: '', skin_color: '',
    physical_build: '',
    personality_traits: '', ideals: '', bonds: '', flaws: '',
    organizations: '', allies: '', enemies: '', backstory: '', other_notes: ''
  }
}

/**
 * Opening-draft resolution — the shell calls this once on mount.
 *
 * BUG FIX 2026-11-05 (Zach): Create New Character opened with the
 * prior character's info already populated. Cause: the shell loaded
 * the local draft whenever one existed, even for a fresh create —
 * and carried the prior characterId with it, so the first save would
 * have PUT onto the prior character's row instead of POSTing a new
 * one. The draft key is a single global ('creator-next-stage1-draft'),
 * so the only safe rule is: trust it ONLY for a resume of the
 * character it belongs to.
 *
 *   - fresh create (resumeCharacterId null) → blank, characterId
 *     null, hadMirror false. The stored draft is never read.
 *   - resume with a matching draft → blank merged with the draft,
 *     characterId the resume id, hadMirror true.
 *   - resume with no matching draft → blank ON THAT ROW (first save
 *     PUTs it), hadMirror false.
 *
 * The stale draft is NOT cleared here: the prior character's roster
 * card still resumes from it, and the new character's first save
 * overwrites the key with its own draft.
 */
export function resolveOpeningDraft({ resumeCharacterId = null, draft = null } = {}) {
  if (resumeCharacterId) {
    if (draft?.characterId === resumeCharacterId && draft?.state) {
      return { state: { ...blankStage1State(), ...draft.state }, characterId: resumeCharacterId, hadMirror: true }
    }
    return { state: blankStage1State(), characterId: resumeCharacterId, hadMirror: false }
  }
  return { state: blankStage1State(), characterId: null, hadMirror: false }
}

export async function saveStage1Progress({ state, characterId, themes = null }) {
  const body = buildStage1ProgressBody(state, themes)
  // Creator-next marker (2026-11-05, Stage 2 validation wiring): the
  // server only runs Stage 2 validation on bodies carrying it. Kept
  // out of buildStage1ProgressBody so the shell's blank-save guard
  // (Object.keys(body).length === 0) keeps its exact meaning.
  body.creator = 'creator-next'
  // Stage 2 picks ride the same save (the row has class/subclass
  // columns, and fightingStyle / subclassChoices / knownCantrips ride
  // buildStage1ProgressBody above — see the Stage 2 block there).
  if (state.classId) body.class = state.classId
  if (state.subclassName) body.subclass = state.subclassName
  // Stage 3 fields (theme_id, origin_feat, origin_feat_choices,
  // theme_path_choice) and Stage 4 fields (generation_method,
  // base_scores, ability_choice_picks, ability_scores, skills,
  // tool_proficiencies, languages, known_spells, prepared_spells) ride
  // buildStage1ProgressBody — see the guard note there — so
  // saveStage1Progress sends them with no extra lines.
  let url = '/api/character'
  let method = 'POST'
  if (characterId) {
    url = `/api/character/${characterId}`
    method = 'PUT'
  } else {
    body.creation_phase = 'creating'
  }
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
  const character = await res.json()
  return { character_id: character.id }
}

const LOCAL_KEY = 'creator-next-stage1-draft'

export function saveStage1LocalDraft(state, characterId) {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify({ state, characterId: characterId || null }))
  } catch {}
}

export function loadStage1LocalDraft() {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * Origin-feat key normalization (item 15): the stored feat_key is the
 * snake_case canonical key (see canonicalOriginFeatKey in
 * server/routes/character.js) — 'magic_initiate', never the display
 * name. Tolerates a display name anyway, so a hand-written row still
 * resolves.
 */
export function normalizeOriginFeatKey(raw) {
  if (raw == null) return ''
  return String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function isMagicInitiateOriginFeat(featKey) {
  return normalizeOriginFeatKey(featKey) === 'magic_initiate'
}

function parseStoredJson(value) {
  if (value == null) return null
  if (typeof value !== 'string') return value
  try { return JSON.parse(value) } catch { return null }
}

/**
 * Server-row rehydration (item 6) — the pure mapping from what the
 * server stores to creator state. Sources: the character row (GET
 * /api/character/:id) and the progression snapshot (GET
 * /api/character/:id/progression), which carries the side tables
 * (character_themes, character_origin_feats, character_ancestry_feats)
 * the row itself has no columns for.
 *
 * ONLY source picks rehydrate. Derived lists (ability_scores, skills,
 * tool_proficiencies, languages) are NOT copied: Stage 4 recomputes
 * them from the rehydrated picks on mount, and copying the row's
 * finals would be clobbered by that recompute (or worse, would
 * resurrect class picks Stage 4 cannot decompose). The Stage 2 picks
 * DO rehydrate now (2026-11-07 follow-up): fightingStyle,
 * subclassChoices, and knownCantrips are read from their columns
 * (fighting_style 058, subclass_choices_json 103, known_cantrips
 * 001) — the save body sends them, so there is stored state to read.
 * generation_method, base_scores, ability_choice_picks have no
 * columns and are never read here. known_spells / prepared_spells DO
 * rehydrate — they are row columns and direct state, not derived —
 * together with stage4PicksClass set to the same class, so Stage 4's
 * class-change guard does not clear them on mount as stale picks for
 * another class.
 *
 * A field absent from the stores means "not yet chosen" and is left
 * blank — never defaulted, never an empty list written over a pick.
 */
export function rehydrateStateFromServerRow(row, progression, speciesEntries = null) {
  const patch = {}
  if (row && typeof row === 'object') {
    if (row.first_name) patch.first_name = row.first_name
    if (row.last_name) patch.last_name = row.last_name
    if (row.nickname) patch.nickname = row.nickname
    if (row.gender) patch.gender = row.gender
    if (row.avatar) patch.avatar = row.avatar
    // Race/class are stored as ids by the new creator, but an older
    // row may hold a display name ('Elf', 'Half-Elf', 'Wizard') —
    // normalize to id form so the lookups downstream match. A mixed
    // character's row.race is the derived label ('Mixed Ancestry
    // (Human / Elf)') — never normalize that into state.race; the
    // mixed record below is the source of truth for it.
    const mixedRow = parseStoredJson(row.mixed_ancestry_json)
    if (row.race && !mixedRow) patch.race = String(row.race).trim().toLowerCase().replace(/[\s_]+/g, '-')
    if (row.subrace) patch.subrace = row.subrace
    // Human size choice: a stored size rehydrates; absent = no
    // choice recorded yet, never defaulted.
    if (row.size) patch.size = row.size
    // Mixed Ancestry: the stored JSON is the record (canonical ids /
    // names, effective costs, defaults applied). Rehydrated as the
    // Stage 1 record shape; `versatileFeat` '' when unset.
    if (mixedRow && typeof mixedRow === 'object') {
      patch.mixedAncestry = {
        parents: Array.isArray(mixedRow.parents) ? mixedRow.parents : [],
        traits: Array.isArray(mixedRow.traits) ? mixedRow.traits : [],
        size: mixedRow.size || '',
        speed: mixedRow.speed ?? 30,
        forgoOriginFeat: mixedRow.forgoOriginFeat === true,
        versatileFeat: mixedRow.versatileFeat || ''
      }
    }
    if (row.origin_setting) patch.origin_setting = row.origin_setting
    if (row.origin_region) patch.origin_region = row.origin_region
    if (row.origin_explanation) patch.origin_explanation = row.origin_explanation
    if (row.class) patch.classId = String(row.class).trim().toLowerCase().replace(/[\s_]+/g, '-')
    if (row.subclass) patch.subclassName = row.subclass
    // Stage 2 picks: the fighting style is a plain string column; the
    // subclass choices and the final cantrip list are JSON columns.
    // A stored-but-empty value means "not yet chosen" and is left
    // blank, like every other absent field here.
    if (row.fighting_style) patch.fightingStyle = row.fighting_style
    // Warlock pact (creator test-notes #11): the server column is
    // the server worker's part — read it when present, blank when
    // absent, never defaulted. Faith likewise: it is saved as a
    // plain string column but was never rehydrated, so a god picked
    // on Stage 2 vanished on a mirror-less resume.
    if (row.pact) {
      const pactName = pactNameFromKey(row.pact)
      if (pactName) patch.pactBoon = pactName
    }
    if (row.subclass_origin_explanation) patch.subclassOriginExplanation = row.subclass_origin_explanation
    if (row.faith) patch.faith = row.faith
    const storedChoices = parseStoredJson(row.subclass_choices_json)
    if (storedChoices && typeof storedChoices === 'object' && !Array.isArray(storedChoices)
      && Object.keys(storedChoices).length) {
      patch.subclassChoices = storedChoices
    }
    const storedCantrips = parseStoredJson(row.known_cantrips)
    if (Array.isArray(storedCantrips) && storedCantrips.length) patch.knownCantrips = storedCantrips
    const known = parseStoredJson(row.known_spells)
    if (Array.isArray(known) && known.length) patch.known_spells = known
    const prepared = parseStoredJson(row.prepared_spells)
    if (Array.isArray(prepared) && prepared.length) patch.prepared_spells = prepared
    if (patch.classId) patch.stage4PicksClass = patch.classId
  }
  if (progression && typeof progression === 'object') {
    const theme = progression.theme
    if (theme?.theme_id) patch.themeId = theme.theme_id
    if (theme?.path_choice) patch.themePathChoice = theme.path_choice
    // Soldier second field (R2-11e, SERVER shape): the active-duty pick,
    // read back from character_themes.path_data via the progression
    // snapshot. path_data is JSON { <key>: <value> } — a string or an
    // already-parsed object — so parse it and extract the second
    // field's value as a STRING into themePathData; never assign the
    // raw object to state (client state holds the value string).
    // Single-key object → its value; multi-key → the known
    // 'active_duty' key. A bare non-JSON string is not a value and is
    // left blank rather than guessed.
    const pathData = parseStoredJson(theme?.path_data)
    if (pathData && typeof pathData === 'object' && !Array.isArray(pathData)) {
      const keys = Object.keys(pathData)
      const value = keys.length === 1 ? pathData[keys[0]] : (pathData.active_duty ?? null)
      if (typeof value === 'string' && value.trim()) patch.themePathData = value.trim()
    }
    const originFeat = progression.origin_feat
    if (originFeat?.feat_key) patch.originFeat = normalizeOriginFeatKey(originFeat.feat_key)
    if (originFeat?.choices_data && typeof originFeat.choices_data === 'object') {
      patch.originFeatChoices = originFeat.choices_data
    }
    // Standalone Human Versatile slot: the progression snapshot
    // carries it beside the theme slot (origin_feat). Absent = no
    // pick yet, never defaulted.
    const versatileFeat = progression.versatile_feat
    if (versatileFeat?.feat_key) patch.versatileFeat = normalizeOriginFeatKey(versatileFeat.feat_key)
    if (versatileFeat?.choices_data && typeof versatileFeat.choices_data === 'object') {
      patch.versatileFeatChoices = versatileFeat.choices_data
    }
    // Ancestry feat: the snapshot carries the stored feat id when
    // the pick was persisted (creator test-notes #5 follow-up), plus
    // the feat NAME + list + the stored subchoices — the id is
    // resolved by rehydrateFromServerCharacter below, by id when
    // present, by name-match as fallback. The choices ride along
    // without the id (they re-attach when the id resolves; they are
    // harmless orphans until then, never invented picks).
    const ancestryRows = Array.isArray(progression.ancestry_feats) ? progression.ancestry_feats : []
    const tier1 = ancestryRows.find(f => f?.tier === 1) || ancestryRows[0]
    if (tier1?.choices_data && typeof tier1.choices_data === 'object') {
      patch.ancestry_feat_choices = tier1.choices_data
    }
  }
  // Extra-language picks (R2-15): the row's languages column holds
  // the FINAL list, not the source pick — the pick is recovered as
  // the stored languages that are neither the species' concrete
  // grants nor a language granted by a feat pick in the snapshot,
  // capped at the number of "one extra language of your choice"
  // slots the species grants. No slot (every species but
  // human/half-elf) → nothing recovered, so a feat language can
  // never be misread as the species choice. Needs the species list
  // (3rd arg); without it the pick stays unrecovered and Stage 1
  // shows the picker unpicked rather than a wrong language.
  if (row && typeof row === 'object' && Array.isArray(speciesEntries)) {
    const entry = findSpeciesEntry(speciesEntries, patch.race || row.race)
    const slots = entry ? languageChoiceCount(entry.languages || []) : 0
    if (slots > 0) {
      const stored = parseStoredJson(row.languages)
      if (Array.isArray(stored) && stored.length) {
        const featLangs = new Set()
        const collectFeatLangs = (choices) => {
          if (!choices || typeof choices !== 'object') return
          for (const v of Object.values(choices)) {
            for (const s of (Array.isArray(v) ? v : [v])) {
              if (typeof s === 'string' && s.trim()) featLangs.add(s.trim().toLowerCase())
            }
          }
        }
        const ancestryRows = Array.isArray(progression?.ancestry_feats) ? progression.ancestry_feats : []
        const tier1Row = ancestryRows.find(f => f?.tier === 1) || ancestryRows[0]
        collectFeatLangs(tier1Row?.choices_data)
        collectFeatLangs(progression?.origin_feat?.choices_data)
        collectFeatLangs(progression?.versatile_feat?.choices_data)
        const concrete = concreteLanguages(entry.languages || []).map(l => String(l).toLowerCase())
        const recovered = stored.filter(l => typeof l === 'string' && l.trim()
          && !concrete.includes(l.toLowerCase())
          && !featLangs.has(l.toLowerCase()))
        if (recovered.length) patch.languageChoices = recovered.slice(0, slots)
      }
    }
  }
  return patch
}

/**
 * Resume rehydration (item 6) — fetches the row + progression
 * snapshot for a resume with no local draft and returns the patch.
 * Best-effort per fetch: the row alone still rehydrates the Stage 1/2
 * picks, and the progression snapshot alone still rehydrates the
 * theme/feat picks. Never throws — an unreachable server is a blank
 * resume, not a crash. The ancestry feat id resolves from the stored
 * feat id the snapshot now carries (creator test-notes #5), with the
 * exact name-match through the list endpoint as fallback; when both
 * fail the id stays unresolved and the feat picker shows no pick
 * rather than a wrong one.
 */
export async function rehydrateFromServerCharacter(characterId) {
  if (!characterId) return { patch: {}, restored: false }
  let row = null
  let progression = null
  try {
    const res = await fetch(`/api/character/${characterId}`)
    if (res.ok) row = await res.json()
  } catch { /* server unreachable: blank resume */ }
  try {
    const res = await fetch(`/api/character/${characterId}/progression`)
    if (res.ok) progression = await res.json()
  } catch { /* pre-migration table or unreachable: row alone still counts */ }
  if (!row && !progression) return { patch: {}, restored: false }
  // Species list for the language-pick recovery — best-effort like
  // the other fetches: unreachable means no recovery, never a throw
  // and never a wrong pick.
  let speciesEntries = null
  try {
    const res = await fetch('/api/species')
    if (res.ok) {
      const data = await res.json()
      speciesEntries = Array.isArray(data) ? data : (Array.isArray(data?.species) ? data.species : null)
    }
  } catch { /* no species list: language picks stay unrecovered */ }
  const patch = rehydrateStateFromServerRow(row, progression, speciesEntries)
  const ancestryRows = Array.isArray(progression?.ancestry_feats) ? progression.ancestry_feats : []
  const tier1 = ancestryRows.find(f => f?.tier === 1) || ancestryRows[0]
  if (tier1?.feat_id) {
    // Snapshot carries the stored id: trust it directly — no name
    // lookup, no extra fetch. (Creator test-notes #5 follow-up:
    // getCharacterProgression now selects caf.feat_id.)
    patch.ancestry_feat_id = tier1.feat_id
  } else if (tier1?.list_id && tier1?.feat_name) {
    try {
      const res = await fetch(`/api/progression/ancestry-feats/${encodeURIComponent(tier1.list_id)}?tier=${tier1.tier || 1}`)
      if (res.ok) {
        const feats = await res.json()
        const match = (Array.isArray(feats) ? feats : []).find(f => f?.feat_name === tier1.feat_name)
        if (match?.id) patch.ancestry_feat_id = match.id
      }
    } catch { /* feat id stays unresolved; the picker shows no pick */ }
  }
  return { patch, restored: Object.keys(patch).length > 0 }
}

/**
 * Merge a rehydrated patch into live state without clobbering the
 * player: a rehydrated value lands only where the live field is
 * still empty. The rehydration runs async on mount, and the player
 * may already have picked something in the meantime — their pick
 * always wins over the stored one.
 */
export function mergeRehydratedPatch(prev, patch) {
  const out = { ...(prev || {}) }
  const isEmpty = (v) => v == null || v === ''
    || (Array.isArray(v) && v.length === 0)
    || (typeof v === 'object' && Object.keys(v).length === 0)
  for (const [key, value] of Object.entries(patch || {})) {
    if (isEmpty(out[key])) out[key] = value
  }
  return out
}
