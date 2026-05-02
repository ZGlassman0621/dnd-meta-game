/**
 * Character Creator V2 — client-side persistence helpers.
 *
 * Per spec §8.2.2 (handoff) / §8.2.3 (manual):
 *
 *   Manual mode submit:
 *     1. Flip creation_phase from 'creating' → 'active'
 *     2. Persist final character state (name, class, subclass, L1 picks,
 *        ability scores with bumps applied + clamped at 18, skills,
 *        equipment, alignment, faith, lifestyle, physical, expansions)
 *     3. Apply manual-mode heirloom (if authored) → inventory with
 *        is_heirloom=true
 *     4. Generate primary campaign with no Prelude inputs (standard path)
 *     5. Link character to campaign
 *
 *   Handoff mode submit:
 *     1. Flip creation_phase from 'ready_for_primary' → 'active'
 *     2. Persist final character state (same fields as manual)
 *     3. Apply heirloom: chosen candidate → inventory with is_heirloom=true;
 *        other candidates flip to 'left_behind'
 *     4. Generate primary campaign with Prelude inputs (per v4 plan §6a)
 *     5. Persist canon_npcs / canon_locations / canon_threads into the
 *        campaign's tables
 *     6. Seed mentor_imprints if eligible
 *     7. Link character to campaign
 *
 *   Both modes are transactional — on any failure, the character stays
 *   at the prior phase ('creating' or 'ready_for_primary') and the
 *   client surfaces a step-specific error.
 *
 * The PUT vs POST shape:
 *   - Manual: if `state.character_id` is set (from a 'creating' row
 *     created at Step 1 advance), PUT to update + flip to 'active'.
 *     Otherwise POST to create-and-flip in one call (preview path
 *     and tests don't always go through the Step-1 row creation).
 *   - Handoff: always PUT — the row exists at 'ready_for_primary'.
 */

import classesData from '../../data/classes.json'
import racesData from '../../data/races.json'
import { applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { THEME_BACKSTORY_MOMENTS } from '../../data/themeBackstoryMoments.js'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * Submit the creator. Branches on `mode`:
 *   - 'handoff' → PUT /api/character/:id (preludePayload.character_id)
 *     with creation_phase='active' + heirloom application; server-side
 *     wiring handles canon transfer + campaign generation.
 *   - 'manual' → POST /api/character (or PUT if `state.character_id`
 *     was set by a Step-1 advance row creation) with
 *     creation_phase='active'.
 *
 * Returns: { character_id, campaign_id (when generated), mode }
 */
export async function submitCreator({ state, mode, preludePayload }) {
  const body = buildSubmitBody(state, mode, preludePayload)

  let url, method
  if (mode === 'handoff') {
    if (!preludePayload?.character_id) {
      throw new Error('Handoff submit requires preludePayload.character_id')
    }
    url = `/api/character/${preludePayload.character_id}`
    method = 'PUT'
  } else if (state.character_id) {
    url = `/api/character/${state.character_id}`
    method = 'PUT'
  } else {
    url = '/api/character'
    method = 'POST'
  }

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    let detail = ''
    try { detail = (await res.json()).error || '' } catch {}
    throw new Error(detail || `Submit failed (HTTP ${res.status})`)
  }

  const character = await res.json()
  return {
    character_id: character.id,
    campaign_id: character.campaign_id || null,
    mode
  }
}

/**
 * Compose the submit payload from creator state. Handles the L1 cap 18
 * clamp on ability scores (per Decision E) and heirloom inventory
 * shaping (manual-mode authored heirloom → inventory item with
 * is_heirloom flag).
 */
export function buildSubmitBody(state, mode, preludePayload) {
  const cls = classesData[state.class_id]
  const raceData = racesData[state.race]
  const subraceData = (raceData?.subraces || []).find(s => s.name === state.subrace)

  // Final ability scores (base + racial static + racial choice + bumps),
  // clamped at 18 per Decision E.
  const abilityScores = {}
  for (const k of ABILITY_KEYS) {
    const base = state.base_scores?.[k] || 0
    const racialStatic = (raceData?.abilityScoreIncrease?.[k] ?? 0) +
                         (subraceData?.abilityScoreIncrease?.[k] ?? 0)
    const racialChoice = (state.racial_choice_picks || []).filter(p => p === k).length
    const bumpTotal = (state.bump_assignments || []).reduce((sum, stat, i) => {
      if (stat !== k) return sum
      const b = (preludePayload?.accepted_stat_bumps || [])[i]
      return sum + (b?.magnitude || 1)
    }, 0)
    abilityScores[k] = Math.min(18, base + racialStatic + racialChoice + bumpTotal)
  }

  // Starting gold: class baseline × theme modifier (rounded half-up).
  const baselineGp = cls?.startingGold?.average || 0
  const goldGp = state.theme_id ? applyGoldModifier(baselineGp, state.theme_id) : baselineGp

  // Inventory: equipment package picks + (optional) authored heirloom.
  // Real equipment-item resolution (mapping picked package strings to
  // equipment.json items) is out of scope here — the server stores the
  // pick strings as inventory entries with `source: 'class_package'`
  // and the legacy character-sheet logic resolves them at render.
  const inventory = []
  const equipmentPicks = state.equipment_picks || {}
  Object.values(equipmentPicks).forEach((label, i) => {
    if (!label) return
    inventory.push({
      label,
      source: 'class_package',
      pick_index: i
    })
  })
  if (state.heirloom && state.heirloom.name) {
    inventory.push({
      name: state.heirloom.name,
      type: state.heirloom.type,
      specific_item: state.heirloom.specific_item,
      label: state.heirloom.specific_item || state.heirloom.name,
      description: state.heirloom.description,
      is_heirloom: true,
      heirloom_description: state.heirloom.description,
      awakening_hook: state.heirloom.awakening_hook || null,
      source: 'manual_heirloom'
    })
  }

  // Selected skills + emergence skills (handoff): single combined list.
  const skills = [
    ...(state.selected_skills || []),
    ...((preludePayload?.accepted_skill_bumps || []).map(s => s.skill).filter(Boolean))
  ]

  const id = state.identity || {}

  return {
    // Core identity
    name: [state.first_name, state.last_name].filter(Boolean).join(' ').trim() || state.first_name,
    first_name: state.first_name || null,
    last_name: state.last_name || null,
    nickname: state.nickname || null,
    gender: state.gender || null,

    // Race + theme + class
    race: state.race || null,
    subrace: state.subrace || null,
    theme_id: state.theme_id || null,
    ancestry_feat_id: state.ancestry_feat_id || null,
    ancestry_feat_choices: state.ancestry_feat_choices || null,
    class: state.class_id || null,
    subclass: state.subclass_id || null,

    // L1
    level: 1,
    ability_scores: JSON.stringify(abilityScores),
    skills: JSON.stringify(skills),
    inventory: JSON.stringify(inventory),
    gold_gp: goldGp,
    starting_gold_gp: goldGp,

    // Identity Details
    alignment: id.alignment || null,
    faith: id.faith || null,
    lifestyle: id.lifestyle || null,
    age: id.age || null,
    height: id.height || null,
    weight: id.weight || null,
    eye_color: id.eye_color || null,
    hair_color: id.hair_color || null,
    skin_color: id.skin_color || null,
    // `build` is a new field per spec §5.7.4 — server may not have a
    // dedicated column today; surfaced as physical_build on the body so
    // the server can decide where to store it (column or JSON blob in
    // distinguishing_features). Backwards-safe: server can ignore.
    physical_build: id.build || null,

    // Optional expansions (textareas + structured backstory)
    personality_traits: state.expansions?.personality?.value || null,
    ideals: state.expansions?.ideals?.value || null,
    bonds: state.expansions?.bonds?.value || null,
    flaws: state.expansions?.flaws?.value || null,
    backstory: composeBackstory(state, preludePayload),

    // Phase transition
    creation_phase: 'active',

    // Handoff-only: chosen heirloom candidate id (server-side flips
    // status to 'carried_forward', the rest to 'left_behind').
    ...(mode === 'handoff' ? {
      chosen_heirloom_candidate_id: state.heirloom_candidate_id || null
    } : {})
  }
}

/**
 * Compose the backstory textarea content from picked moments + custom
 * moments + biography seed (handoff). Order: biography seed entries
 * first (when present, prefixed with their age tag), then picked moments
 * in pick order. Each separated by a blank line.
 */
function composeBackstory(state, preludePayload) {
  const lines = []

  // Biography seed (handoff only) — render the structured entries as
  // human-readable lines so the textarea stores something coherent for
  // legacy character-sheet consumption.
  for (const entry of (preludePayload?.biography_seed || [])) {
    const tag = entry.age != null ? `Age ${entry.age}` : null
    lines.push(tag ? `${tag} — ${entry.text}` : entry.text)
  }

  // Picked moments + custom moments in pick order.
  const back = state.expansions?.backstory || {}
  const picks = back.picked_keys || []
  const customs = back.custom_moments || []
  const moments = state.theme_id ? (THEME_BACKSTORY_MOMENTS[state.theme_id] || []) : []

  for (const key of picks) {
    const [kind, idxStr] = String(key).split(':')
    const idx = parseInt(idxStr, 10)
    if (kind === 'curated' && moments[idx]) lines.push(moments[idx])
    else if (kind === 'custom' && customs[idx]) lines.push(customs[idx])
  }

  return lines.filter(Boolean).join('\n\n') || null
}
