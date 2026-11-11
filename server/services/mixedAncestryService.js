// server/services/mixedAncestryService.js — Mixed Ancestry system
// (2026-11-06, GM Binder homebrew "Mixed Ancestry for D&D 5r (2024)",
// EmberBoar Creations — data in server/data/mixedAncestry.js).
//
// Design decisions (coordinator rulings, reversible — reversal cost
// noted per decision in the build notes):
//   1. Parents must both be PC-creatable species (the 11 MVP species).
//      Orc is MVP-deferred, so it is refused as a parent; goliath is
//      not in the registry at all, so it is refused as unknown. The
//      trait tables for both are still transcribed (they are in the
//      doc) — the refusal lives here, not in the data.
//   2. A mixed-ancestry character is eligible for EITHER parent's
//      ancestry-feat list (doc prerequisite note). ancestryFeatListsFor
//      is the server source for that; the character route enforces it
//      on ancestry_feat_id, the Stage 1 picker reads it via the
//      /api/mixed-ancestry endpoints.
//   3. Forgoing the origin feat (+4 budget): the app's origin feat
//      comes from the theme (Stage 3). The trade sets budgetCap 11
//      and stores forgoOriginFeat: true; Stage 3 validation refuses
//      an origin-feat grant while the trade is on.
//   4. Stored shape: mixed_ancestry JSON on the character row
//      (migration 108, mixed_ancestry_json TEXT):
//      { parents: [idA, idB], size, speed, traits:
//        [{ species, trait, cost, form? }], budgetUsed, budgetCap,
//        forgoOriginFeat, versatileFeat }
//      Display species string: "Mixed Ancestry (Parent A / Parent B)".
//   5. Human Versatile inside mixed ancestry is the DOC's trait
//      (cost 4, grants an Origin Feat) — NOT the standalone Human
//      Versatile (item 19, built alongside this job in migration
//      109: the standalone slot lives in character_origin_feats with
//      slot 'versatile'). A mixed character taking the trait gets an
//      origin-feat pick stored as versatileFeat (a featRegistry key,
//      category 'origin') inside the mixed JSON. The theme's origin
//      feat is untouched by it. Mixed-ancestry characters do NOT get
//      the standalone slot — they get Versatile only via this trait
//      pick (coordinator ruling, 2026-11-06).
//
// Pure validation (no DB): validateMixedAncestry. Draft-tolerant
// like the other creator validators — an absent record is not an
// invalid record, and a record with parents but no traits/size yet
// is a draft, not a refusal. What it refuses, naming the field:
//   - a parent that is not in the registry, or not PC-creatable
//     (mixedAncestry.parents),
//   - a trait from a species that is not one of the parents, or a
//     trait name that is not in that parent's table
//     (mixedAncestry.traits),
//   - the same trait taken twice (mixedAncestry.traits),
//   - a sent cost that is not the table cost, or a darkvision60
//     downgrade on a trait that is not a 120 ft Darkvision
//     (mixedAncestry.traits),
//   - a size that is neither parent's size (mixedAncestry.size),
//   - a speed other than 30, or 35 without the Speed trait
//     (mixedAncestry.speed),
//   - traits over the budget (7, or 11 with the trade)
//     (mixedAncestry.budget),
//   - a Versatile feat pick that is not a 2024 origin feat, or a
//     pick sent without the Versatile trait
//     (mixedAncestry.versatileFeat).
// budgetUsed/budgetCap are returned on every path (even refusal) so
// callers can show the math; traits whose table entry cannot be
// found cost 0 in that sum (their error is the story, not the sum).
import {
  MIXED_ANCESTRY_BASE_BUDGET,
  MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_BONUS,
  MIXED_ANCESTRY_DEFAULT_SPEED,
  MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM,
  MIXED_ANCESTRY_TRAIT_TABLES,
} from '../data/mixedAncestry.js';
import { ANCESTRY_FEATS } from '../data/ancestryFeats.js';
import { getFeatEffect } from '../data/featRegistry.js';
import {
  resolveSpecies,
  isPcCreatable,
  allowedSizesFor,
  normKey,
  MVP_DEFERRED_NOTE,
} from './speciesService.js';
import { safeParse } from '../utils/safeParse.js';

export const MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_MESSAGE =
  'originFeat: the theme origin feat was forgone for +4 mixed-ancestry power budget — remove the origin feat or clear the trade';

const DOWNGRADE_FORM = MIXED_ANCESTRY_DARKVISION_DOWNGRADE_FORM;
const DOWNGRADE_COST = 1;

function normTraitName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function prettyId(id) {
  return String(id || '').split(/[-_]/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function tableFor(speciesId) {
  return MIXED_ANCESTRY_TRAIT_TABLES[normKey(speciesId)] || null;
}

function traitEntryFor(speciesId, traitName) {
  const table = tableFor(speciesId);
  if (!table) return null;
  const wanted = normTraitName(traitName);
  return table.traits.find((t) => normTraitName(t.name) === wanted) || null;
}

/**
 * One parent's trait table, as the client picker reads it.
 * Returns null for a species with no table in the doc. `available`
 * is false for goliath (not in the registry yet) and for the
 * MVP-deferred parents (orc); the table is still returned so the
 * client can show it grayed out with the reason.
 */
export function traitTableFor(speciesId) {
  const table = tableFor(speciesId);
  if (!table) return null;
  const key = normKey(speciesId);
  const resolved = resolveSpecies(key, null);
  const name = resolved?.entry?.name || prettyId(key);
  let available = true;
  let unavailableReason = null;
  if (!resolved) {
    available = false;
    unavailableReason = 'Not in the species list yet';
  } else if (!isPcCreatable(key, null)) {
    available = false;
    unavailableReason = MVP_DEFERRED_NOTE;
  }
  return {
    speciesId: key,
    name,
    available,
    unavailableReason,
    traits: table.traits.map((t) => ({ ...t })),
  };
}

/** Every parent the creator can offer, with its table + availability. */
export function traitTablesForAllParents() {
  return Object.keys(MIXED_ANCESTRY_TRAIT_TABLES).map((id) => traitTableFor(id));
}

/**
 * Display species string for a mixed-ancestry character:
 * "Mixed Ancestry (Human / Elf)". Parents print in the order given.
 */
export function mixedAncestrySpeciesLabel(parents) {
  const names = (parents || []).map((p) => {
    const resolved = resolveSpecies(p, null);
    return resolved?.entry?.name || prettyId(p);
  });
  return `Mixed Ancestry (${names.join(' / ')})`;
}

// Ancestry-feat list_ids that exist in the seeded catalog, derived
// from the data (not a hardcoded count) so a future list lands here
// without an edit.
const KNOWN_ANCESTRY_LIST_IDS = new Set(ANCESTRY_FEATS.map((f) => f.list_id));

/**
 * Ancestry-feat lists a mixed-ancestry character may pick from:
 * EITHER parent's list (doc prerequisite note). Aasimar splits by
 * subrace in the catalog, and a mixed parent carries no subrace, so
 * all three aasimar lists are eligible. Parents with no list in the
 * catalog (goliath, orc) contribute none. Drow is NOT included for
 * an elf parent — it is a subrace list, not the elf parent's list.
 */
export function ancestryFeatListsFor(parents) {
  const lists = [];
  for (const parent of parents || []) {
    const key = normKey(parent);
    if (key === 'aasimar') {
      for (const listId of ['aasimar_protector', 'aasimar_scourge', 'aasimar_fallen']) {
        if (KNOWN_ANCESTRY_LIST_IDS.has(listId) && !lists.includes(listId)) lists.push(listId);
      }
      continue;
    }
    const listId = key.replace(/-/g, '_');
    if (KNOWN_ANCESTRY_LIST_IDS.has(listId) && !lists.includes(listId)) lists.push(listId);
  }
  return lists;
}

/** Parse a stored mixed-ancestry value (object, JSON string, or null). */
export function parseMixedAncestry(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const parsed = safeParse(value, null);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  return null;
}

/** True when the value (record, JSON string, or body field) carries the trade. */
export function forgoOriginFeatFrom(value) {
  const parsed = parseMixedAncestry(value);
  return parsed?.forgoOriginFeat === true;
}

/**
 * Validate a mixed-ancestry record. Input may be an object, a JSON
 * string, null/undefined (absent = not mixed — ok, normalized null),
 * or anything else (refused). Returns
 * { ok, errors, budgetUsed, budgetCap, normalized } where normalized
 * is the stored shape (null when absent) with canonical parent ids,
 * canonical trait names, effective costs, and defaults applied
 * (speed 30, or the Speed trait's speed when taken).
 */
export function validateMixedAncestry(input) {
  if (input == null) {
    return { ok: true, errors: [], budgetUsed: 0, budgetCap: MIXED_ANCESTRY_BASE_BUDGET, normalized: null };
  }
  let raw = input;
  if (typeof raw === 'string') {
    raw = safeParse(raw, null);
    if (!raw) {
      return { ok: false, errors: ['mixedAncestry: must be an object { parents, size, speed, traits, forgoOriginFeat }'], budgetUsed: 0, budgetCap: MIXED_ANCESTRY_BASE_BUDGET, normalized: null };
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, errors: ['mixedAncestry: must be an object { parents, size, speed, traits, forgoOriginFeat }'], budgetUsed: 0, budgetCap: MIXED_ANCESTRY_BASE_BUDGET, normalized: null };
  }

  const errors = [];
  const forgo = raw.forgoOriginFeat === true;
  const budgetCap = MIXED_ANCESTRY_BASE_BUDGET + (forgo ? MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_BONUS : 0);

  // --- Parents ------------------------------------------------------
  const parentsRaw = raw.parents ?? raw.parentSpecies ?? null;
  let parents = [];
  let parentsComplete = false;
  if (parentsRaw == null || (Array.isArray(parentsRaw) && parentsRaw.length === 0)) {
    // No parents yet: a draft, not a refusal. Traits/size/speed
    // below still judge against an empty parent set only when sent.
    parents = [];
  } else if (!Array.isArray(parentsRaw)) {
    errors.push('mixedAncestry.parents: must be a list of two parent species');
  } else {
    if (parentsRaw.length !== 2) {
      errors.push(`mixedAncestry.parents: choose exactly two parent species, got ${parentsRaw.length}`);
    }
    const seen = new Set();
    for (const p of parentsRaw) {
      if (typeof p !== 'string' || !p.trim()) {
        errors.push('mixedAncestry.parents: each parent must be a species id');
        continue;
      }
      const key = normKey(p);
      if (seen.has(key)) {
        errors.push(`mixedAncestry.parents: '${p.trim()}' was picked twice — the two parents must be different species`);
        continue;
      }
      seen.add(key);
      parents.push(key);
      const resolved = resolveSpecies(key, null);
      if (!resolved) {
        errors.push(`mixedAncestry.parents: '${p.trim()}' is not a known species yet`);
      } else if (!isPcCreatable(key, null)) {
        errors.push(`mixedAncestry.parents: ${resolved.entry.name} is not available as a mixed-ancestry parent — ${MVP_DEFERRED_NOTE}`);
      }
    }
    parentsComplete = parents.length === 2;
  }
  const parentSet = new Set(parents);

  // --- Traits -------------------------------------------------------
  const traitsRaw = raw.traits ?? null;
  const traits = [];
  let budgetUsed = 0;
  let speedFromTrait = null;
  let hasVersatile = false;
  if (traitsRaw != null && !Array.isArray(traitsRaw)) {
    errors.push('mixedAncestry.traits: must be a list of { species, trait, cost }');
  } else {
    const seenTraits = new Set();
    for (const entry of traitsRaw || []) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
        errors.push('mixedAncestry.traits: each trait must be an object { species, trait, cost }');
        continue;
      }
      const speciesKey = typeof entry.species === 'string' ? normKey(entry.species) : '';
      const traitName = typeof entry.trait === 'string' ? entry.trait.trim() : '';
      if (!speciesKey || !traitName) {
        errors.push('mixedAncestry.traits: each trait needs a species and a trait name');
        continue;
      }
      const tableEntry = traitEntryFor(speciesKey, traitName);
      if (!tableEntry) {
        const knownTable = tableFor(speciesKey);
        if (!knownTable) {
          errors.push(`mixedAncestry.traits: '${traitName}' names species '${entry.species}', which has no mixed-ancestry trait table`);
        } else {
          errors.push(`mixedAncestry.traits: '${traitName}' is not a ${prettyId(speciesKey)} mixed-ancestry trait`);
        }
        continue;
      }
      if (parentsComplete && !parentSet.has(speciesKey)) {
        errors.push(`mixedAncestry.traits: '${tableEntry.name}' belongs to ${prettyId(speciesKey)}, which is not one of the parents (${parents.map(prettyId).join(', ')})`);
        continue;
      }
      const traitKey = normTraitName(tableEntry.name);
      if (seenTraits.has(traitKey)) {
        errors.push(`mixedAncestry.traits: '${tableEntry.name}' was picked twice`);
        continue;
      }
      seenTraits.add(traitKey);
      // Effective cost: a 120 ft Darkvision taken as 60 ft costs 1
      // (doc note); any other sent cost must equal the table cost.
      let effectiveCost = tableEntry.cost;
      const form = typeof entry.form === 'string' ? entry.form.trim() : null;
      if (form != null && form !== '') {
        if (form === DOWNGRADE_FORM && tableEntry.darkvisionFt === 120) {
          effectiveCost = DOWNGRADE_COST;
        } else if (form === DOWNGRADE_FORM) {
          errors.push(`mixedAncestry.traits: '${tableEntry.name}' is already 60 ft darkvision — the 120 ft downgrade does not apply`);
        } else {
          errors.push(`mixedAncestry.traits: unknown trait form '${form}' for '${tableEntry.name}'`);
        }
      }
      if (entry.cost != null && Number(entry.cost) !== effectiveCost) {
        errors.push(`mixedAncestry.traits: '${tableEntry.name}' costs ${effectiveCost} power budget, got ${entry.cost}`);
      }
      budgetUsed += effectiveCost;
      if (tableEntry.speedFt) speedFromTrait = tableEntry.speedFt;
      if (speciesKey === 'human' && traitKey === 'versatile') hasVersatile = true;
      const stored = { species: speciesKey, trait: tableEntry.name, cost: effectiveCost };
      if (form === DOWNGRADE_FORM && tableEntry.darkvisionFt === 120) stored.form = DOWNGRADE_FORM;
      traits.push(stored);
    }
  }
  if (budgetUsed > budgetCap) {
    errors.push(`mixedAncestry.budget: traits cost ${budgetUsed} power budget, over the ${budgetCap} limit${forgo ? ' (7 + 4 for forgoing the origin feat)' : ''}`);
  }

  // --- Size ---------------------------------------------------------
  const sizeRaw = raw.size ?? null;
  let size = null;
  if (typeof sizeRaw === 'string' && sizeRaw.trim()) {
    size = sizeRaw.trim();
    if (parentsComplete) {
      // A parent's sizes: its choice list when it has one (2024
      // human: Medium or Small, PHB p. 194), else its single size.
      const allowedSizes = [...new Set(parents.flatMap((p) => allowedSizesFor(p, null) || []))];
      const match = allowedSizes.find((s) => s.toLowerCase() === size.toLowerCase());
      if (!match) {
        errors.push(`mixedAncestry.size: '${size}' is not a size of either parent (${allowedSizes.join(' or ')})`);
      } else {
        size = match;
      }
    }
  } else if (sizeRaw != null && typeof sizeRaw !== 'string') {
    errors.push('mixedAncestry.size: must be a size string, e.g. Medium or Small');
  }

  // --- Speed --------------------------------------------------------
  const speedRaw = raw.speed ?? null;
  let speed = speedFromTrait ?? MIXED_ANCESTRY_DEFAULT_SPEED;
  if (speedRaw != null) {
    if (!Number.isFinite(Number(speedRaw))) {
      errors.push(`mixedAncestry.speed: '${speedRaw}' is not a speed in feet`);
    } else {
      const sent = Number(speedRaw);
      if (sent === MIXED_ANCESTRY_DEFAULT_SPEED && speedFromTrait != null) {
        errors.push(`mixedAncestry.speed: the Speed trait sets speed to ${speedFromTrait} ft, got 30`);
      } else if (sent !== MIXED_ANCESTRY_DEFAULT_SPEED && sent !== speedFromTrait) {
        errors.push(`mixedAncestry.speed: speed is ${MIXED_ANCESTRY_DEFAULT_SPEED} ft unless an increased-speed trait is taken${speedFromTrait ? ` (the Speed trait sets ${speedFromTrait} ft)` : ''}, got ${sent}`);
      } else {
        speed = sent;
      }
    }
  }

  // --- Versatile origin-feat pick -----------------------------------
  const versatileRaw = raw.versatileFeat ?? raw.versatile_feat ?? null;
  let versatileFeat = null;
  if (typeof versatileRaw === 'string' && versatileRaw.trim()) {
    if (!hasVersatile) {
      errors.push(`mixedAncestry.versatileFeat: '${versatileRaw.trim()}' was sent without the Human Versatile trait`);
    } else {
      const entry = getFeatEffect(versatileRaw.trim());
      if (!entry || entry.category !== 'origin') {
        errors.push(`mixedAncestry.versatileFeat: '${versatileRaw.trim()}' is not a 2024 origin feat`);
      } else {
        versatileFeat = entry.key;
      }
    }
  } else if (versatileRaw != null && typeof versatileRaw !== 'string') {
    errors.push('mixedAncestry.versatileFeat: must be a 2024 origin feat key or name');
  }

  const normalized = {
    parents,
    size,
    speed,
    traits,
    budgetUsed,
    budgetCap,
    forgoOriginFeat: forgo,
    versatileFeat,
  };
  return { ok: errors.length === 0, errors, budgetUsed, budgetCap, normalized };
}

/**
 * One-line DM-prompt readout for a stored mixed-ancestry record
 * (object or JSON string). '' when absent or unparseable — the
 * caller omits the line. Format:
 *   Mixed Ancestry: Human / Elf — Size Medium, Speed 30 ft —
 *   Traits: Elven Lineage (5), Resourceful (2) — Power budget 7/7
 *   [ — Origin feat forgone (+4 budget)]
 *   [ — Versatile origin feat: Lucky]
 */
export function formatMixedAncestryLine(value) {
  const parsed = parseMixedAncestry(value);
  if (!parsed || !Array.isArray(parsed.parents) || parsed.parents.length !== 2) return '';
  const result = validateMixedAncestry(parsed);
  const norm = result.normalized || parsed;
  const parentNames = (norm.parents || []).map((p) => resolveSpecies(p, null)?.entry?.name || prettyId(p));
  const parts = [`Mixed Ancestry: ${parentNames.join(' / ')}`];
  const sizeSpeed = [];
  if (norm.size) sizeSpeed.push(`Size ${norm.size}`);
  if (Number.isFinite(Number(norm.speed))) sizeSpeed.push(`Speed ${norm.speed} ft`);
  if (sizeSpeed.length) parts.push(sizeSpeed.join(', '));
  const traits = norm.traits || [];
  if (traits.length) {
    parts.push(`Traits: ${traits.map((t) => `${t.trait} (${t.cost})`).join(', ')}`);
  }
  parts.push(`Power budget ${result.budgetUsed}/${result.budgetCap}`);
  if (norm.forgoOriginFeat) parts.push('Origin feat forgone (+4 budget)');
  if (norm.versatileFeat) {
    const entry = getFeatEffect(norm.versatileFeat);
    parts.push(`Versatile origin feat: ${entry?.name || norm.versatileFeat}`);
  }
  return parts.join(' — ');
}
