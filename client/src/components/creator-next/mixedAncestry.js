/**
 * Mixed Ancestry + Human Versatile + human size choice — creator-next
 * Stage 1 client helpers (2026-11-06, item 19 client UI).
 *
 * Pure functions only (no JSX, no fetch side effects except the three
 * small fetch wrappers at the bottom, which call the real endpoints).
 * The server is the authority — every rule here mirrors the server
 * validator (server/services/mixedAncestryService.js +
 * validateCreatorNextStage3 in server/routes/character.js) so the
 * player sees a refusal in the UI before the save ever 400s. A
 * client-side pass is never proof: the save can still 400, and the
 * shell surfaces that error verbatim.
 *
 * Server field names for validation errors (400 VALIDATION_ERROR,
 * messages joined with '; '): mixedAncestry, mixedAncestry.parents,
 * mixedAncestry.traits, mixedAncestry.size, mixedAncestry.speed,
 * mixedAncestry.budget, mixedAncestry.versatileFeat, originFeat,
 * ancestryFeatId, versatileFeat, versatileFeatChoices, size.
 *
 * The 10 origin feats (key / name / effect) are the 2024 list from
 * the feat registry (server/data/featRegistry.js CORE_FEATS) —
 * transcribed, not invented. No origin feat grants an ASI in 2024.
 */

export const MIXED_ANCESTRY_BASE_BUDGET = 7
export const MIXED_ANCESTRY_FORGO_BONUS = 4
export const MIXED_ANCESTRY_DEFAULT_SPEED = 30
export const MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM = 'darkvision60'
export const MIXED_ANCESTRY_DARKVISION_DOWNGRADE_COST = 1

export const ORIGIN_FEATS = [
  { key: 'alert', name: 'Alert', effect: 'Add your proficiency bonus to Initiative; immediately after rolling Initiative, you may swap your Initiative with a willing ally in the same combat (neither can have the Incapacitated condition)' },
  { key: 'crafter', name: 'Crafter', effect: 'Proficiency with three Artisan\'s Tools of your choice from the Fast Crafting table; 20% discount on nonmagical items; at the end of a Long Rest, craft one piece of gear from the Fast Crafting table (requires the associated tools and proficiency with them); the crafted item lasts until you finish another Long Rest, then falls apart' },
  { key: 'healer', name: 'Healer', effect: 'With a Healer\'s Kit, expend one use as a Utilize action to tend a creature within 5 ft; that creature expends one of its Hit Point Dice and regains HP equal to the roll + your proficiency bonus; when you roll dice to restore HP with a spell or this feat\'s Battle Medic benefit, reroll any 1s (must use the new roll)' },
  { key: 'lucky', name: 'Lucky', effect: 'After a long rest, Luck Points equal to your proficiency bonus; spend one to gain advantage on a d20 test, or to impose disadvantage on an attack roll against you' },
  { key: 'magic_initiate', name: 'Magic Initiate', effect: 'Choose one spell list — Cleric, Druid, or Wizard; learn two cantrips and one level 1 spell from it (Intelligence, Wisdom, or Charisma is your spellcasting ability, chosen when you take the feat); the level 1 spell is always prepared, castable once per Long Rest without a slot and with spell slots thereafter' },
  { key: 'musician', name: 'Musician', effect: 'Proficiency with three musical instruments of your choice; as you finish a Short or Long Rest, play a song on an instrument you are proficient with to give Heroic Inspiration to allies who hear it, up to your proficiency bonus in allies' },
  { key: 'savage_attacker', name: 'Savage Attacker', effect: 'Once per turn, when you hit a target with a weapon, roll the weapon\'s damage dice twice and use either roll against the target' },
  { key: 'skilled', name: 'Skilled', effect: 'Proficiency in any combination of three skills or tools of your choice; repeatable' },
  { key: 'tavern_brawler', name: 'Tavern Brawler', effect: 'When you hit with an Unarmed Strike and deal damage, deal 1d4 + Strength bludgeoning instead of the normal damage; reroll any 1 on an Unarmed Strike damage die (must use the new roll); proficiency with improvised weapons; once per turn, when you hit a creature with an Unarmed Strike as part of the Attack action, push it 5 ft away in addition to dealing damage' },
  { key: 'tough', name: 'Tough', effect: 'Your Hit Point maximum increases by twice your character level when you gain this feat; thereafter it increases by 2 each time you level up' }
]

export const ORIGIN_FEAT_KEYS = ORIGIN_FEATS.map(f => f.key)

export function normalizeOriginFeatKey(raw) {
  if (raw == null) return ''
  return String(raw).trim().toLowerCase().replace(/[\s-]+/g, '_')
}

export function originFeatByKey(key) {
  const norm = normalizeOriginFeatKey(key)
  return ORIGIN_FEATS.find(f => f.key === norm) || null
}

export function isOriginFeatKey(key) {
  return !!originFeatByKey(key)
}

/** Same normalization as the server's normKey (speciesService.js). */
export function normalizeMixedSpeciesId(value) {
  return String(value || '').trim().toLowerCase().replace(/[_]+/g, '-').replace(/\s+/g, '-')
}

function normTraitName(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, ' ')
}

/**
 * Blank Mixed Ancestry record — the shape the Stage 1 toggle creates.
 * `traits` entries are { species, trait, cost, form? }; `form` is
 * only ever 'darkvision60'. `versatileFeat` is '' until picked.
 */
export function blankMixedAncestry() {
  return { parents: [], traits: [], size: '', speed: MIXED_ANCESTRY_DEFAULT_SPEED, forgoOriginFeat: false, versatileFeat: '' }
}

export function isMixedAncestry(state) {
  return !!(state && state.mixedAncestry)
}

/** Table lookup in a GET /api/mixed-ancestry payload (or null). */
export function traitTableFor(tables, speciesId) {
  const list = Array.isArray(tables) ? tables : (tables?.tables || [])
  const key = normalizeMixedSpeciesId(speciesId)
  return (list || []).find(t => normalizeMixedSpeciesId(t.speciesId) === key) || null
}

export function findTraitInTables(tables, speciesId, traitName) {
  const table = traitTableFor(tables, speciesId)
  if (!table) return null
  const want = normTraitName(traitName)
  return (table.traits || []).find(t => normTraitName(t.name) === want) || null
}

/** Effective cost of a table trait in a picked form (downgrade = 1). */
export function effectiveTraitCost(tableTrait, form) {
  if (!tableTrait) return null
  if (form === MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM && tableTrait.darkvisionFt === 120) {
    return MIXED_ANCESTRY_DARKVISION_DOWNGRADE_COST
  }
  return tableTrait.cost
}

/** Is this picked trait a 120 ft Darkvision that may be taken as 60 ft? */
export function isDowngradableDarkvision(tableTrait) {
  return !!tableTrait && tableTrait.darkvisionFt === 120
    && normTraitName(tableTrait.name) === 'darkvision'
}

/** Power budget for a trait list: { used, cap, remaining, over }. */
export function mixedBudget(traits, forgoOriginFeat) {
  const cap = MIXED_ANCESTRY_BASE_BUDGET + (forgoOriginFeat === true ? MIXED_ANCESTRY_FORGO_BONUS : 0)
  const used = (Array.isArray(traits) ? traits : [])
    .reduce((sum, t) => sum + (Number(t?.cost) || 0), 0)
  return { used, cap, remaining: cap - used, over: used > cap }
}

/** Has the Human Versatile trait (cost 4) been taken in this record? */
export function hasMixedVersatileTrait(record) {
  return (Array.isArray(record?.traits) ? record.traits : []).some(t =>
    normalizeMixedSpeciesId(t?.species) === 'human' && normTraitName(t?.trait) === 'versatile')
}

/** Derived speed: 35 only with the Goliath Speed trait, else 30. */
export function mixedSpeed(record, tables) {
  const traits = Array.isArray(record?.traits) ? record.traits : []
  for (const t of traits) {
    const tableTrait = tables ? findTraitInTables(tables, t.species, t.trait) : null
    // Without tables, trust the sent cost shape only for the named
    // Speed trait — the server re-derives this and refuses a wrong
    // speed, so the UI never invents a speed from a bare name.
    if (tableTrait?.speedFt) return tableTrait.speedFt
    if (!tables && normTraitName(t?.trait) === 'speed' && normalizeMixedSpeciesId(t?.species) === 'goliath') return 35
  }
  return MIXED_ANCESTRY_DEFAULT_SPEED
}

/**
 * Sizes a mixed character may be: the union of the parents' registry
 * sizes — a parent's `sizes` choice list when it has one (2024 human:
 * Medium or Small), else its single `size`. `speciesEntries` are
 * /api/species entries (registry client shape).
 */
export function allowedSizesForParents(parents, speciesEntries) {
  const out = []
  for (const p of parents || []) {
    const key = normalizeMixedSpeciesId(p)
    const entry = (Array.isArray(speciesEntries) ? speciesEntries : [])
      .find(e => normalizeMixedSpeciesId(e?.id) === key || normalizeMixedSpeciesId(e?.name) === key)
    if (!entry) continue
    const sizes = Array.isArray(entry.sizes) && entry.sizes.length
      ? entry.sizes
      : (entry.size ? [entry.size] : [])
    for (const s of sizes) {
      if (s && !out.some(x => String(x).toLowerCase() === String(s).toLowerCase())) out.push(s)
    }
  }
  return out
}

/**
 * Full client-side mirror of the server's validateMixedAncestry, for
 * immediate UI feedback. Returns an array of `field: message` strings
 * with the server's field names; [] = valid. An empty record (no
 * parents, no traits) is a draft, not an error — the picker has
 * simply not started. A record with parents started but incomplete
 * (fewer than two) IS an error, so advancing never silently drops a
 * half-built mixed ancestry.
 *
 * `tables` is the GET /api/mixed-ancestry payload (or its `tables`
 * array); `speciesEntries` is the /api/species list. Either may be
 * null (server unreachable) — then only structural checks run and
 * the server remains the authority on the save.
 */
export function validateMixedAncestryClient(record, tables, speciesEntries) {
  const errors = []
  if (record == null) return errors
  const list = Array.isArray(tables) ? tables : (tables?.tables || null)
  const parentsRaw = Array.isArray(record.parents) ? record.parents : []
  const parents = parentsRaw.map(p => normalizeMixedSpeciesId(p)).filter(Boolean)
  const forgo = record.forgoOriginFeat === true
  const budgetCap = MIXED_ANCESTRY_BASE_BUDGET + (forgo ? MIXED_ANCESTRY_FORGO_BONUS : 0)

  const traits = Array.isArray(record.traits) ? record.traits : []
  const hasStarted = parents.length > 0 || traits.length > 0
    || !!record.size || record.forgoOriginFeat === true || !!record.versatileFeat
  if (!hasStarted) return errors

  // --- Parents ---
  if (parents.length !== 2) {
    errors.push(`mixedAncestry.parents: choose exactly two parent species, got ${parents.length}`)
  }
  const seenParents = new Set()
  for (const p of parents) {
    if (seenParents.has(p)) {
      errors.push(`mixedAncestry.parents: '${p}' was picked twice — the two parents must be different species`)
      continue
    }
    seenParents.add(p)
    if (list) {
      const table = traitTableFor(list, p)
      if (!table) {
        errors.push(`mixedAncestry.parents: '${p}' is not in the species registry yet`)
      } else if (table.available === false) {
        errors.push(`mixedAncestry.parents: ${table.name || p} is not available as a mixed-ancestry parent — ${table.unavailableReason || 'Coming after the MVP — NPCs can still be this species.'}`)
      }
    } else if (Array.isArray(speciesEntries)) {
      const entry = speciesEntries.find(e => normalizeMixedSpeciesId(e?.id) === p)
      if (!entry) errors.push(`mixedAncestry.parents: '${p}' is not in the species registry yet`)
      else if (entry.pcCreatable === false) errors.push(`mixedAncestry.parents: ${entry.name || p} is not available as a mixed-ancestry parent — ${entry.pcCreatableNote || 'Coming after the MVP — NPCs can still be this species.'}`)
    }
  }
  const parentSet = new Set(parents)
  const parentsComplete = parents.length === 2 && new Set(parents).size === 2

  // --- Traits ---
  let budgetUsed = 0
  let hasVersatile = false
  let speedFromTrait = null
  const seenTraits = new Set()
  for (const entry of traits) {
    const speciesKey = normalizeMixedSpeciesId(entry?.species)
    const traitName = typeof entry?.trait === 'string' ? entry.trait.trim() : ''
    if (!speciesKey || !traitName) {
      errors.push('mixedAncestry.traits: each trait needs a species and a trait name')
      continue
    }
    if (parentsComplete && !parentSet.has(speciesKey)) {
      errors.push(`mixedAncestry.traits: '${traitName}' belongs to ${speciesKey}, which is not one of the parents (${parents.join(', ')})`)
      continue
    }
    if (list) {
      const tableTrait = findTraitInTables(list, speciesKey, traitName)
      if (!tableTrait) {
        const table = traitTableFor(list, speciesKey)
        if (!table) errors.push(`mixedAncestry.traits: '${traitName}' names species '${entry.species}', which has no mixed-ancestry trait table`)
        else errors.push(`mixedAncestry.traits: '${traitName}' is not a ${speciesKey} mixed-ancestry trait`)
        continue
      }
      const traitKey = normTraitName(tableTrait.name)
      if (seenTraits.has(traitKey)) {
        errors.push(`mixedAncestry.traits: '${tableTrait.name}' was picked twice`)
        continue
      }
      seenTraits.add(traitKey)
      let effectiveCost = tableTrait.cost
      const form = typeof entry.form === 'string' ? entry.form.trim() : null
      if (form) {
        if (form === MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM && tableTrait.darkvisionFt === 120) effectiveCost = MIXED_ANCESTRY_DARKVISION_DOWNGRADE_COST
        else if (form === MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM) errors.push(`mixedAncestry.traits: '${tableTrait.name}' is already 60 ft darkvision — the 120 ft downgrade does not apply`)
        else errors.push(`mixedAncestry.traits: unknown trait form '${form}' for '${tableTrait.name}'`)
      }
      if (entry.cost != null && Number(entry.cost) !== effectiveCost) {
        errors.push(`mixedAncestry.traits: '${tableTrait.name}' costs ${effectiveCost} power budget, got ${entry.cost}`)
      }
      budgetUsed += effectiveCost
      if (tableTrait.speedFt) speedFromTrait = tableTrait.speedFt
      if (speciesKey === 'human' && traitKey === 'versatile') hasVersatile = true
    } else {
      // No tables (server unreachable): trust the sent shape, check
      // only duplicates and the running budget.
      const traitKey = normTraitName(traitName)
      if (seenTraits.has(traitKey)) {
        errors.push(`mixedAncestry.traits: '${traitName}' was picked twice`)
        continue
      }
      seenTraits.add(traitKey)
      budgetUsed += Number(entry.cost) || 0
      if (speciesKey === 'human' && traitKey === 'versatile') hasVersatile = true
    }
  }
  if (budgetUsed > budgetCap) {
    errors.push(`mixedAncestry.budget: traits cost ${budgetUsed} power budget, over the ${budgetCap} limit${forgo ? ' (7 + 4 for forgoing the origin feat)' : ''}`)
  }

  // --- Size ---
  if (typeof record.size === 'string' && record.size.trim()) {
    if (parentsComplete && Array.isArray(speciesEntries)) {
      const allowed = allowedSizesForParents(parents, speciesEntries)
      if (allowed.length && !allowed.some(s => String(s).toLowerCase() === record.size.trim().toLowerCase())) {
        errors.push(`mixedAncestry.size: '${record.size.trim()}' is not a size of either parent (${allowed.join(' or ')})`)
      }
    }
  } else if (record.size != null && record.size !== '' && typeof record.size !== 'string') {
    errors.push('mixedAncestry.size: must be a size string, e.g. Medium or Small')
  }

  // --- Speed ---
  if (record.speed != null && record.speed !== '') {
    const sent = Number(record.speed)
    if (!Number.isFinite(sent)) {
      errors.push(`mixedAncestry.speed: '${record.speed}' is not a speed in feet`)
    } else if (sent === MIXED_ANCESTRY_DEFAULT_SPEED && speedFromTrait != null) {
      errors.push(`mixedAncestry.speed: the Speed trait sets speed to ${speedFromTrait} ft, got 30`)
    } else if (sent !== MIXED_ANCESTRY_DEFAULT_SPEED && sent !== speedFromTrait) {
      errors.push(`mixedAncestry.speed: speed is ${MIXED_ANCESTRY_DEFAULT_SPEED} ft unless an increased-speed trait is taken${speedFromTrait ? ` (the Speed trait sets ${speedFromTrait} ft)` : ''}, got ${sent}`)
    }
  }

  // --- Mixed Versatile pick ---
  const versatileRaw = record.versatileFeat ?? record.versatile_feat ?? null
  if (typeof versatileRaw === 'string' && versatileRaw.trim()) {
    if (!hasVersatile) {
      errors.push(`mixedAncestry.versatileFeat: '${versatileRaw.trim()}' was sent without the Human Versatile trait`)
    } else if (!isOriginFeatKey(versatileRaw.trim())) {
      errors.push(`mixedAncestry.versatileFeat: '${versatileRaw.trim()}' is not a 2024 origin feat`)
    }
  } else if (versatileRaw != null && versatileRaw !== '' && typeof versatileRaw !== 'string') {
    errors.push('mixedAncestry.versatileFeat: must be a 2024 origin feat key or name')
  }

  return errors
}

/**
 * Structural save shape for a mixed record — the table-free half of
 * validation, used by the persistence layer (which has no tables).
 * Returns the normalized save body, or null when the record is not
 * complete enough to send: an incomplete record stays local-mirror
 * only, never sent half-built (the server validates whenever
 * mixed_ancestry is present, so a half-built send would 400 the
 * draft save). The UI's full validation (validateMixedAncestryClient)
 * is what tells the player what is still missing.
 */
export function mixedAncestrySaveRecord(record) {
  if (record == null) return null
  const parents = (Array.isArray(record.parents) ? record.parents : [])
    .map(p => normalizeMixedSpeciesId(p)).filter(Boolean)
  if (parents.length !== 2 || new Set(parents).size !== 2) return null
  const traits = Array.isArray(record.traits) ? record.traits : []
  const seenTraits = new Set()
  for (const t of traits) {
    const key = normTraitName(t?.trait)
    if (!t?.species || !key || seenTraits.has(key)) return null
    if (!parents.includes(normalizeMixedSpeciesId(t.species))) return null
    seenTraits.add(key)
  }
  const forgo = record.forgoOriginFeat === true
  const cap = MIXED_ANCESTRY_BASE_BUDGET + (forgo ? MIXED_ANCESTRY_FORGO_BONUS : 0)
  const used = traits.reduce((sum, t) => sum + (Number(t?.cost) || 0), 0)
  if (used > cap) return null
  const versatileRaw = record.versatileFeat ?? record.versatile_feat ?? null
  const versatileFeat = typeof versatileRaw === 'string' && versatileRaw.trim()
    ? normalizeOriginFeatKey(versatileRaw.trim())
    : null
  if (versatileFeat && !hasMixedVersatileTrait(record)) return null
  if (versatileFeat && !isOriginFeatKey(versatileFeat)) return null
  const out = {
    parents,
    size: (typeof record.size === 'string' && record.size.trim()) ? record.size.trim() : null,
    speed: mixedSpeed(record, null),
    traits: traits.map(t => {
      const entry = { species: normalizeMixedSpeciesId(t.species), trait: String(t.trait).trim(), cost: Number(t.cost) || 0 }
      if (t.form === MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM) entry.form = MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM
      return entry
    }),
    forgoOriginFeat: forgo,
    versatileFeat
  }
  // A size the UI never set stays null (draft) — the server stores
  // the default; only a picked size is sent.
  if (out.size == null) delete out.size
  return out
}

/**
 * The standalone Versatile pick must differ from the theme's fixed
 * origin feat (coordinator ruling, reversible). Returns the warning /
 * blocking message, or null when there is no conflict. Both keys are
 * normalized, so 'Lucky' and 'lucky' are the same pick.
 */
export function versatileThemeConflict(versatileFeatKey, themeFeatKey) {
  const v = normalizeOriginFeatKey(versatileFeatKey)
  const t = normalizeOriginFeatKey(themeFeatKey)
  if (!v || !t) return null
  if (v === t) {
    const name = originFeatByKey(v)?.name || v
    return `versatileFeat: your Versatile feat (${name}) is already your theme's origin feat — the Versatile feat must be a different origin feat. Pick a different one at Stage 1.`
  }
  return null
}

/**
 * Split a server 400 error string ("field: message; field: message")
 * into { field, message } pairs for per-field display. A string with
 * no field prefix lands under field ''.
 */
export function parseServerValidationErrors(errorString) {
  const raw = String(errorString || '')
  if (!raw.trim()) return []
  return raw.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const at = part.indexOf(':')
    if (at <= 0) return { field: '', message: part }
    return { field: part.slice(0, at).trim(), message: part.slice(at + 1).trim() }
  })
}

// --- Fetch wrappers (real endpoints, no mocks in production) --------

export async function fetchMixedAncestryTables() {
  const res = await fetch('/api/mixed-ancestry')
  if (!res.ok) throw new Error(`Mixed Ancestry tables unavailable (HTTP ${res.status})`)
  return res.json()
}

export async function fetchMixedAncestryLists(parents) {
  const query = (parents || []).map(p => encodeURIComponent(p)).join(',')
  const res = await fetch(`/api/mixed-ancestry/ancestry-lists?parents=${query}`)
  if (!res.ok) throw new Error(`Mixed Ancestry lists unavailable (HTTP ${res.status})`)
  return res.json()
}

/**
 * The ancestry-feat union for a mixed character: fetch EACH list id
 * from the lists endpoint at tier 1 and union the feats by id (a
 * feat on two parents' lists appears once). Returns [] when the
 * parents are not yet two.
 */
export async function fetchMixedAncestryFeatUnion(parents) {
  const listIds = (await fetchMixedAncestryLists(parents))?.lists || []
  if (!listIds.length) return []
  const settled = await Promise.all(listIds.map(async (listId) => {
    try {
      const res = await fetch(`/api/progression/ancestry-feats/${encodeURIComponent(listId)}?tier=1`)
      if (!res.ok) return []
      const data = await res.json()
      return Array.isArray(data) ? data : []
    } catch { return [] }
  }))
  const seen = new Set()
  const out = []
  for (const feat of settled.flat()) {
    if (!feat?.id || seen.has(feat.id)) continue
    seen.add(feat.id)
    out.push(feat)
  }
  return out
}
