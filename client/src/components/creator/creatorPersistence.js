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
import equipmentData from '../../data/equipment.json'
import { applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { THEME_BACKSTORY_MOMENTS } from '../../data/themeBackstoryMoments.js'
import { resolveOptionLabel, ALL_ARMOR } from './equipmentResolver.js'

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']

const abilityMod = (score) => Math.floor(((Number(score) ?? 10) - 10) / 2)

/**
 * Resolve the equipment-package picks into worn slots { armor, mainHand,
 * offHand } — the shape the character sheet reads for AC, attacks, and the
 * Equipment tab. Shields land in offHand; the first body armor in armor; the
 * first weapon in mainHand (second weapon → offHand for dual-wield).
 */
function deriveWornEquipment(equipmentPicks, equipmentSubpicks) {
  const worn = {}
  const shieldNames = new Set((equipmentData.armor?.shields || []).map(s => String(s.name).toLowerCase()))
  Object.entries(equipmentPicks || {}).forEach(([idxKey, label]) => {
    if (!label) return
    const finalLabel = (equipmentSubpicks || {})[idxKey] || label
    const { items } = resolveOptionLabel(finalLabel)
    for (const it of (items || [])) {
      const nm = it.name
      if (!nm) continue
      if (shieldNames.has(String(nm).toLowerCase())) {
        if (!worn.offHand) worn.offHand = { name: nm }
      } else if (it.kind === 'armor') {
        if (!worn.armor) worn.armor = { name: nm }
      } else if (it.kind === 'weapon') {
        if (!worn.mainHand) worn.mainHand = { name: nm }
        else if (!worn.offHand) worn.offHand = { name: nm }
      }
    }
  })
  return worn
}

/**
 * Starting AC from worn armor/shield + dexterity, with monk/barbarian
 * Unarmored Defense. Mirrors CharacterSheet.calcEquipmentAC so the stored
 * value matches what the sheet would compute.
 */
function computeStartingAC(worn, abilityScores, classId) {
  const cls = String(classId || '').toLowerCase()
  const dexMod = abilityMod(abilityScores.dex)
  let ac = 10 + dexMod
  if (worn.armor) {
    const ad = ALL_ARMOR.find(a => a.name === worn.armor.name)
    if (ad?.baseAC != null) {
      if (ad.armorType === 'heavy') ac = ad.baseAC
      else if (ad.armorType === 'medium') ac = ad.baseAC + Math.min(dexMod, ad.maxDexBonus ?? 2)
      else ac = ad.baseAC + dexMod
    }
  } else if (cls === 'monk') {
    ac = 10 + dexMod + abilityMod(abilityScores.wis)
  } else if (cls === 'barbarian') {
    ac = 10 + dexMod + abilityMod(abilityScores.con)
  }
  if (worn.offHand) {
    const sd = (equipmentData.armor?.shields || []).find(s => s.name === worn.offHand.name)
    if (sd?.acBonus) ac += sd.acBonus
  }
  return ac
}

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
export async function submitCreator({ state, mode, preludePayload, characterId = null }) {
  const body = buildSubmitBody(state, mode, preludePayload)

  // The draft row's id. Manual mode threads it from CharacterCreatorV2's
  // `characterId` state (set when Step 1 advance created the 'creating' row).
  // Falling back to state.character_id keeps the preview/test shape working.
  const draftId = characterId || state.character_id

  let url, method
  if (mode === 'handoff') {
    if (!preludePayload?.character_id) {
      throw new Error('Handoff submit requires preludePayload.character_id')
    }
    url = `/api/character/${preludePayload.character_id}`
    method = 'PUT'
  } else if (draftId) {
    // Flip the existing 'creating' draft in place → no duplicate orphan row.
    url = `/api/character/${draftId}`
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
  const equipmentSubpicks = state.equipment_subpicks || {}
  const PACKS = equipmentData.packs || {}
  Object.entries(equipmentPicks).forEach(([idxKey, label]) => {
    if (!label) return
    const i = Number(idxKey)
    // "Any Simple Weapon" / "Any Martial Weapon" picks resolve through
    // the per-row subpick. Fall back to the generic label if no subpick
    // — Step 6's UI already nudges the player to choose, so this is only
    // a defensive default.
    const subpick = equipmentSubpicks[idxKey]
    const finalLabel = subpick || label
    const pack = PACKS[finalLabel]
    if (pack && Array.isArray(pack.contents) && pack.contents.length) {
      // Expand a pack into its individual items so the player (and the DM,
      // who reads the inventory) can see and use the contents — bedroll,
      // rations, rope, torches — not an opaque "Explorer's Pack" line.
      // `pack_source` keeps the provenance for a future grouped display.
      pack.contents.forEach(itemName => {
        inventory.push({
          name: itemName,
          label: itemName,
          original_pick: label,
          source: 'class_package',
          pack_source: finalLabel,
          pick_index: i
        })
      })
    } else {
      inventory.push({
        // `name` mirrors `label` so server-side inventory/reward code (which
        // keys off `name`) never crashes on package items (Phase A fix).
        name: finalLabel,
        label: finalLabel,
        original_pick: label,
        source: 'class_package',
        pick_index: i
      })
    }
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

  // Worn equipment + derived L1 vitals (Phase A fix). The server recomputes
  // HP/unarmored-AC as a safety net, but sending real values here makes
  // armored AC correct and populates the sheet immediately.
  const worn = deriveWornEquipment(equipmentPicks, equipmentSubpicks)
  const hitDie = cls?.hitDie || 8
  const maxHp = Math.max(1, hitDie + abilityMod(abilityScores.con))
  const armorClass = computeStartingAC(worn, abilityScores, state.class_id)

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
    equipment: JSON.stringify(worn),
    max_hp: maxHp,
    current_hp: maxHp,
    armor_class: armorClass,
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
    // physical_build (Step 7's "build" field per spec §5.7.4) — column
    // added by migration 050; PUT allowlist accepts it (sub-checkpoint 2).
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

/**
 * Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.3) — partial save on
 * step advance. Per spec §6.2 + PM ruling 2026-05-02 (Option 1: single
 * source of truth — character row).
 *
 * Manual mode:
 *   - On Step 1 advance, no `characterId` yet → POST creates a
 *     character at `creation_phase='creating'` with whatever fields are
 *     filled. Returns the new character_id.
 *   - On every subsequent step advance, PUT updates the existing row
 *     with the fields that have been touched since the last save.
 *
 * Handoff mode:
 *   - The character already exists at `creation_phase='ready_for_primary'`
 *     (created by the Prelude transition service). character_id arrives
 *     via `preludePayload.character_id`. Every step advance PUTs.
 *
 * Returns: { character_id } — the canonical id after the save.
 */
export async function saveProgress({ state, mode, preludePayload, characterId }) {
  const body = buildProgressBody(state)

  let url, method
  if (mode === 'handoff') {
    const id = characterId || preludePayload?.character_id
    if (!id) throw new Error('Handoff save requires character_id from preludePayload')
    url = `/api/character/${id}`
    method = 'PUT'
  } else if (characterId) {
    url = `/api/character/${characterId}`
    method = 'PUT'
  } else {
    // Manual mode, first save (Step 1 → Step 2). Create the row at
    // creation_phase='creating' and return the new id.
    url = '/api/character'
    method = 'POST'
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

/**
 * Compose the progress payload — partial body that updates only the
 * fields the player has touched. Distinguished from `buildSubmitBody`:
 *
 *   - No `creation_phase` field (caller adds it for POST-create only;
 *     PUT calls leave the existing phase alone)
 *   - No final-clamp ability scores (player may still be assigning)
 *   - Skips fields that aren't set yet (won't NULL out columns the
 *     player hasn't reached)
 *   - Inventory and starting gold are NOT computed yet (those finalize
 *     at submit; partial saves don't touch them so the player can
 *     change theme/class without re-deriving gold)
 *
 * The shape mirrors `buildSubmitBody` for the fields it does send so
 * the server can reuse the same allowlist.
 */
export function buildProgressBody(state) {
  const body = {}

  // --- Step 1 fields (only include when set) ---
  if (state.first_name) body.first_name = state.first_name
  if (state.last_name) body.last_name = state.last_name
  if (state.nickname) body.nickname = state.nickname
  if (state.gender) body.gender = state.gender
  // Compose `name` from first+last for legacy character-sheet read paths
  const composed = [state.first_name, state.last_name].filter(Boolean).join(' ').trim()
  if (composed) body.name = composed

  // --- Step 2 ---
  if (state.race) body.race = state.race
  if (state.subrace) body.subrace = state.subrace
  if (state.ancestry_feat_id) body.ancestry_feat_id = state.ancestry_feat_id
  if (state.ancestry_feat_choices && Object.keys(state.ancestry_feat_choices).length > 0) {
    body.ancestry_feat_choices = state.ancestry_feat_choices
  }

  // --- Step 3 ---
  if (state.theme_id) body.theme_id = state.theme_id

  // --- Step 4 ---
  if (state.class_id) body.class = state.class_id
  if (state.subclass_id) body.subclass = state.subclass_id

  // --- Step 5 (only the values player has explicitly set; ability
  //     score clamping happens at submit) ---
  const baseScores = state.base_scores || {}
  const anyAbilityAssigned = ABILITY_KEYS.some(k => baseScores[k] != null)
  if (anyAbilityAssigned) {
    body.ability_scores = JSON.stringify(baseScores)
  }
  if (Array.isArray(state.selected_skills) && state.selected_skills.length > 0) {
    body.skills = JSON.stringify(state.selected_skills)
  }

  // --- Step 7 (Identity Details) ---
  const id = state.identity || {}
  if (id.alignment) body.alignment = id.alignment
  if (id.faith) body.faith = id.faith
  if (id.lifestyle) body.lifestyle = id.lifestyle
  if (id.age) body.age = id.age
  if (id.height) body.height = id.height
  if (id.weight) body.weight = id.weight
  if (id.eye_color) body.eye_color = id.eye_color
  if (id.hair_color) body.hair_color = id.hair_color
  if (id.skin_color) body.skin_color = id.skin_color
  if (id.build) body.physical_build = id.build

  const ex = state.expansions || {}
  if (ex.personality?.value) body.personality_traits = ex.personality.value
  if (ex.ideals?.value) body.ideals = ex.ideals.value
  if (ex.bonds?.value) body.bonds = ex.bonds.value
  if (ex.flaws?.value) body.flaws = ex.flaws.value

  return body
}

/**
 * Rehydrate creator state from a `'creating'` character row (manual mode
 * resume from the home page). Reads only the partial-save fields; never
 * touches the prelude_handoff_payload (which doesn't exist for manual
 * characters).
 *
 * Per PM note 2026-05-02: keep this path separate from the handoff
 * rehydration. Two clean paths beat one path that branches internally
 * around a synthetic empty payload.
 */
export function rehydrateManualCreatorState(character) {
  const baseScores = parseAbilityScores(character.ability_scores)
  const skills = parseSkills(character.skills)
  return {
    first_name: character.first_name || '',
    last_name: character.last_name || '',
    nickname: character.nickname || '',
    gender: character.gender || '',
    race: character.race || '',
    subrace: character.subrace || '',
    ancestry_feat_id: character.ancestry_feat_id || null,
    ancestry_feat_choices: character.ancestry_feat_choices || {},
    theme_id: character.theme_id || '',
    class_id: character.class || '',
    subclass_id: character.subclass || '',
    fighting_style: '',
    generation_method: 'standard_array',
    base_scores: baseScores,
    racial_choice_picks: [],
    bump_assignments: [],
    selected_skills: skills,
    equipment_picks: {},
    heirloom: null,
    heirloom_candidate_id: null,
    identity: {
      alignment: character.alignment || '',
      faith: character.faith || '',
      lifestyle: character.lifestyle || '',
      age: character.age || '',
      height: character.height || '',
      weight: character.weight || '',
      eye_color: character.eye_color || '',
      hair_color: character.hair_color || '',
      skin_color: character.skin_color || '',
      build: '',
      distinguishing_features: ''
    },
    expansions: {
      personality: { value: character.personality_traits || '' },
      ideals: { value: character.ideals || '' },
      bonds: { value: character.bonds || '' },
      flaws: { value: character.flaws || '' },
      backstory: { picked_keys: [], custom_moments: [] }
    }
  }
}

/**
 * Rehydrate creator state from a `'ready_for_primary'` character row +
 * its prelude_handoff_payload (handoff mode resume from the home page).
 * Payload provides locked Prelude-derived fields; character row provides
 * any fields the player has updated since opening the creator
 * mid-session and saving progress. Character-row values take precedence
 * where they exist.
 */
export function rehydrateHandoffCreatorState(character, payload) {
  const np = payload?.name_parts || {}
  const baseScores = parseAbilityScores(character.ability_scores)
  const skills = parseSkills(character.skills)
  return {
    first_name: character.first_name || np.first_name || '',
    last_name: character.last_name || np.last_name || '',
    nickname: character.nickname || np.nickname || '',
    gender: character.gender || payload?.gender || '',
    race: character.race || payload?.race || '',
    subrace: character.subrace || payload?.subrace || '',
    ancestry_feat_id: character.ancestry_feat_id || payload?.ancestry_feat_id || null,
    ancestry_feat_choices: character.ancestry_feat_choices || {},
    theme_id: character.theme_id || payload?.committed_theme || '',
    class_id: character.class || payload?.class_suggestion || '',
    subclass_id: character.subclass || '',
    fighting_style: '',
    generation_method: 'standard_array',
    base_scores: baseScores,
    racial_choice_picks: [],
    bump_assignments: [],
    selected_skills: skills,
    equipment_picks: {},
    heirloom: null,
    heirloom_candidate_id: null,
    identity: {
      alignment: character.alignment || '',
      faith: character.faith || '',
      lifestyle: character.lifestyle || '',
      age: character.age || '',
      height: character.height || '',
      weight: character.weight || '',
      eye_color: character.eye_color || '',
      hair_color: character.hair_color || '',
      skin_color: character.skin_color || '',
      build: '',
      distinguishing_features: ''
    },
    expansions: {
      personality: { value: character.personality_traits || '' },
      ideals: { value: character.ideals || '' },
      bonds: { value: character.bonds || '' },
      flaws: { value: character.flaws || '' },
      backstory: { picked_keys: [], custom_moments: [] }
    }
  }
}

function parseAbilityScores(raw) {
  const blank = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  if (!raw) return blank
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return blank }
}

function parseSkills(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] }
}
