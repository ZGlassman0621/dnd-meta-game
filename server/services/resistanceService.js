/**
 * Resistance Service — Family 6 (mechanics hooks, D9 generic resistance table).
 *
 * STAGED ONLY — built from cached mirror copies of the Mac repo (see
 * NOTES.md in this staging directory). NOT pushed, NOT gated. The push
 * step re-verifies live bytes first.
 *
 * The D9 table: one generic read at damage time. A subclass feature that
 * grants resistance / immunity / vulnerability to a damage type is a row
 * here, keyed by the registry feature key, with a `condition` column
 * (Amendment 2 §4 — stranger conditions go IN the table, not into a
 * DM-prompt deferral). `resistanceFor(actor, damageType, context)` is
 * the contract the attack family (partyAttackService.rollDamageFor) and
 * the spell-cast family (spellCastService damage application) call; this
 * family wires it directly into enemySpellService damage application.
 *
 * Shape of the contract:
 *   resistanceFor(actor, damageType, context)
 *     -> { result: 'resistance' | 'immunity' | 'vulnerability', source, featureKey, featureName }
 *     |  { result: null, cancelled: true, sources }   // resistance + vulnerability on the same type cancel
 *     |  null                                          // no row applies
 *   applyResistanceToAmount(amount, damageType, features, actor)
 *     -> { amount, result, source, featureKey, featureName, cancelled, originalAmount }
 *   Halving rounds DOWN (2024 PHB: divide by 2, round down); vulnerability doubles.
 *
 * Actor descriptor (what callers pass / loadActorDescriptor builds):
 *   { className, subclassName, level, classLevels,
 *     subclassChoices,        // parsed subclass_choices_json (migration 103)
 *     conditions,             // active condition keys, lowercased
 *     raging,                 // class_resources_json.raging
 *     hasTakenTurn,           // null when unknown (fail closed: the row does not fire)
 *     timedEffects,           // Set/array of active timed-effect keys, or a (key) => bool fn
 *     magical,                // damage is magical (context, not actor)
 *     sourceKind }            // 'spell' | 'attack' | 'trap' | ... (context, not actor)
 * Feature resolution is NOT reimplemented here: the pure functions take
 * an already-resolved feature list (featuresForActor output); the async
 * wrappers resolve it through subclassService.featuresForActor, imported
 * dynamically so this module still loads (and the pure table still tests)
 * before the other worker's class-resolution helpers land. If that
 * import is absent at merge time the wrappers return no subclass rows
 * (fail closed, never invent a resistance) — see NOTES.md.
 *
 * Timed effects (durationTrackerService.hasTimedEffect / applyTimedEffect)
 * are the spell-cast family's piece and do not exist in the mirror yet:
 * they are read dynamically, best-effort, and a missing tracker means
 * the timed row does not fire. The effect keys this table expects are
 * listed on each timed row; if the spell-cast family names one
 * differently at merge, adapt the key here (one line per row).
 */

import { dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';

// ---------------------------------------------------------------------------
// Damage types (2024 PHB). Normalised lower-case; 'all' is a table wildcard.
// ---------------------------------------------------------------------------

export const DAMAGE_TYPES = [
  'acid', 'bludgeoning', 'cold', 'fire', 'force', 'lightning',
  'necrotic', 'piercing', 'poison', 'psychic', 'radiant', 'slashing', 'thunder',
];

export function normalizeDamageType(raw) {
  const t = String(raw || '').trim().toLowerCase();
  return DAMAGE_TYPES.includes(t) ? t : null;
}

// ---------------------------------------------------------------------------
// The table. One row per feature. `condition` is evaluated against the
// actor descriptor + damage context; a row whose condition cannot be
// evaluated from available state is NOT in this table — it is recorded
// in STILL_DM_PROMPT below, with the reason, never silently dropped.
// ---------------------------------------------------------------------------

export const RESISTANCE_TABLE = [
  // -- Always-on resistances / immunities (no condition beyond the feature).
  { featureKey: 'psychic_defenses', name: 'Psychic Defenses', kind: 'resistance', types: ['psychic'], condition: { type: 'always' } },
  { featureKey: 'guarded_mind', name: 'Guarded Mind', kind: 'resistance', types: ['psychic'], condition: { type: 'always' } },
  { featureKey: 'thought_shield', name: 'Thought Shield', kind: 'resistance', types: ['psychic'], condition: { type: 'always' } },
  { featureKey: 'radiant_soul', name: 'Radiant Soul', kind: 'resistance', types: ['radiant'], condition: { type: 'always' } },
  { featureKey: 'soul_of_the_forge', name: 'Soul of the Forge', kind: 'resistance', types: ['fire'], condition: { type: 'always' } },
  { featureKey: 'saint_of_forge_and_fire', name: 'Saint of Forge and Fire', kind: 'immunity', types: ['fire'], condition: { type: 'always' } },
  { featureKey: 'wind_soul', name: 'Wind Soul', kind: 'immunity', types: ['lightning', 'thunder'], condition: { type: 'always' } },
  { featureKey: 'frigid_explorer', name: 'Frigid Explorer', kind: 'resistance', types: ['cold'], condition: { type: 'always' } },
  { featureKey: 'walk_in_radiance', name: 'Walk in Radiance', kind: 'resistance', types: ['radiant'], condition: { type: 'always' } },
  { featureKey: 'unliving_fortitude', name: 'Unliving Fortitude', kind: 'resistance', types: ['necrotic', 'poison'], condition: { type: 'always' } },
  { featureKey: 'strange_metabolism', name: 'Strange Metabolism', kind: 'immunity', types: ['poison'], condition: { type: 'always' } },
  { featureKey: 'chemical_mastery', name: 'Chemical Mastery', kind: 'resistance', types: ['acid', 'poison'], condition: { type: 'always' } },
  { featureKey: 'inner_madness', name: 'Inner Madness', kind: 'immunity', types: ['psychic'], condition: { type: 'always' } },
  // -- Self in own aura: the actor holding the feature is always inside
  // their own Aura of Protection, so the self limb is unconditional.
  // The ALLY limb needs aura presence, which is not engine state —
  // see STILL_DM_PROMPT (aura_of_warding_allies).
  { featureKey: 'aura_of_warding', name: 'Aura of Warding', kind: 'resistance', types: ['necrotic', 'psychic', 'radiant'], condition: { type: 'self-aura' } },
  // -- Stored-choice resistances (migration 103 subclass_choices_json).
  // fiendish_resilience_type and dread_allegiance ARE stored choices
  // (verified in the registry); the other choice rows below are DORMANT
  // — their choice key names no stored choice yet (see the note on each
  // row). They fire the moment the choice is stored; until then the
  // feature stays DM-prompt, recorded in STILL_DM_PROMPT.
  { featureKey: 'fiendish_resilience', name: 'Fiendish Resilience', kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'fiendish_resilience_type', exclude: ['force'] } },
  { featureKey: 'dread_allegiance', name: 'Dread Allegiance', kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'dread_allegiance', map: { bane: 'psychic', bhaal: 'poison', myrkul: 'necrotic' } } },
  { featureKey: 'natures_ward', name: "Nature's Ward", kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'land_type', map: { arid: 'fire', polar: 'cold', temperate: 'lightning', tropical: 'poison' } } },
  // DORMANT — no stored choice exists in the registry today.
  { featureKey: 'elemental_affinity', name: 'Elemental Affinity', kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'draconic_affinity', options: ['acid', 'cold', 'fire', 'lightning', 'poison'] } },
  { featureKey: 'storm_soul', name: 'Storm Soul', kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'storm_soul_environment', map: { desert: 'fire', sea: 'lightning', tundra: 'cold' } } },
  { featureKey: 'aura_of_elemental_shielding', name: 'Aura of Elemental Shielding', kind: 'resistance', types: 'choice', condition: { type: 'choice', choiceKey: 'aura_of_elemental_shielding_type', options: ['acid', 'cold', 'fire', 'lightning', 'thunder'] } },
  // -- Condition-gated rows whose condition IS engine state.
  { featureKey: 'confirmed_suspicions', name: 'Confirmed Suspicions', kind: 'resistance', types: ['all'], condition: { type: 'not-taken-turn' } },
  { featureKey: 'avatar_of_battle', name: 'Avatar of Battle', kind: 'resistance', types: ['bludgeoning', 'piercing', 'slashing'], condition: { type: 'nonmagical-only' } },
  // -- Spell-sourced damage only (Abjurer Spell Resistance).
  { featureKey: 'spell_resistance', name: 'Spell Resistance', kind: 'resistance', types: ['all'], condition: { type: 'from-spell' } },
  // -- Timed-effect rows (durationTrackerService; effect keys named here
  // are the contract — adapt at merge if the spell-cast family names
  // them differently). Self only; the Wild Magic 93–96 aura limb (all
  // creatures within 30 ft) stays DM-prompt (radius state, see below).
  { featureKey: 'full_of_stars', name: 'Full of Stars', kind: 'resistance', types: ['bludgeoning', 'piercing', 'slashing'], condition: { type: 'timed', effectKey: 'starry_form' } },
  { featureKey: 'stormborn', name: 'Stormborn', kind: 'resistance', types: ['cold', 'lightning', 'thunder'], condition: { type: 'timed', effectKey: 'wrath_of_the_sea' } },
  { featureKey: 'umbral_form', name: 'Umbral Form', kind: 'resistance', types: ['all'], except: ['force', 'radiant'], condition: { type: 'timed', effectKey: 'umbral_form' } },
  { featureKey: 'invincible_conqueror', name: 'Invincible Conqueror', kind: 'resistance', types: ['all'], condition: { type: 'timed', effectKey: 'invincible_conqueror' } },
  { featureKey: 'wild_magic_damage_resistance', name: 'Wild Magic Surge (Damage Resistance)', kind: 'resistance', types: ['all'], condition: { type: 'timed', effectKey: 'wild_magic_damage_resistance' } },
  { featureKey: 'wild_magic_piercing_vulnerability', name: 'Wild Magic Surge (Piercing Vulnerability)', kind: 'vulnerability', types: ['piercing'], condition: { type: 'timed', effectKey: 'wild_magic_piercing_vulnerability' } },
  { featureKey: 'potted_plant', name: 'Wild Magic Surge (Potted Plant)', kind: 'vulnerability', types: ['all'], condition: { type: 'timed', effectKey: 'potted_plant' } },
];

// Feature keys wired in the table above (for coverage accounting).
export const RESISTANCE_FEATURE_KEYS = RESISTANCE_TABLE.map((r) => r.featureKey);

/**
 * Features with a resistance/immunity/vulnerability limb that this family
 * does NOT wire, with the reason. Nothing mechanical is silently left
 * out: each entry names the missing state. "Dormant" rows in the table
 * above (choice not stored yet) are listed here too, so the coverage
 * count is honest.
 */
export const STILL_DM_PROMPT = [
  { featureKey: 'aura_of_warding_allies', name: 'Aura of Warding (allies)', reason: 'Ally limb needs aura presence (is the ally inside the paladin\'s Aura of Protection, 10 ft / 30 ft at 18th). No aura-presence state exists; same combat zone is not a 10-ft aura. Self limb is wired.' },
  { featureKey: 'shielding_storm', name: 'Shielding Storm', reason: 'Shares Storm Soul resistance with chosen allies while in the Storm Aura. Needs aura presence + the Storm Soul choice (see storm_soul).' },
  { featureKey: 'storm_soul', name: 'Storm Soul', reason: 'DORMANT row: resistance type comes from the chosen environment (Desert/Sea/Tundra) and no stored choice exists in the registry (no choices entry). Fires once a storm_soul_environment choice is stored.' },
  { featureKey: 'elemental_affinity', name: 'Elemental Affinity', reason: 'DORMANT row: the registry engine note claims a stored choice (draconic_affinity) but no choices entry defines it, so nothing is stored to read. Fires once the choice is stored.' },
  { featureKey: 'aura_of_elemental_shielding', name: 'Aura of Elemental Shielding', reason: 'DORMANT row: chosen damage type, changeable at the start of each turn; no stored choice exists in the registry. Fires once an aura_of_elemental_shielding_type choice is stored.' },
  { featureKey: 'ancestral_protectors', name: 'Ancestral Protectors', reason: 'The resistance sits on the TARGET the barbarian hit, not on the barbarian: a creature the marked target hits gains resistance to that attack damage. Needs a mark on the enemy (attack family owns the mark); the read would then be a timed-effect row on the victim.' },
  { featureKey: 'purposeful_inaction', name: 'Purposeful Inaction', reason: 'Resistance to all damage until the start of the next turn, gained by spending 1 Focus at the end of the turn with no attack roll. No activation state is recorded when the Focus is spent.' },
  { featureKey: 'spectral_defense', name: 'Spectral Defense', reason: 'Reaction: resistance to all of that attack\'s damage on this turn. A one-off reaction grant, not a standing row; no reaction-spend record reaches the damage path.' },
  { featureKey: 'granite_guard', name: 'Granite Guard', reason: 'Resistance window (until the beginning of the next turn, or until damage is taken) opened by using Earthen Armament. No window state is recorded.' },
  { featureKey: 'out_of_phase', name: 'Out of Phase', reason: 'Reaction: resistance against the damage of the triggering attack. Same one-off reaction-grant gap as Spectral Defense; the save-case advantage is likewise reaction-gated.' },
  { featureKey: 'beguiling_defenses', name: 'Beguiling Defenses (reaction limb)', reason: 'Reaction: halve the damage taken from the triggering attack. One-off reaction grant; the immunity-to-Charmed limb IS wired (condition immunities below).' },
  { featureKey: 'emissary_of_redemption', name: 'Emissary of Redemption', reason: 'Resistance to all damage dealt by other creatures, void against any creature the paladin has attacked / cast on / damaged since the last Long Rest. Per-target "attacked" state is not tracked.' },
  { featureKey: 'superior_hunters_defense', name: "Superior Hunter's Defense", reason: 'Reaction: resistance to the triggering damage type until the end of the current turn. Needs a stored "chosen type this turn" record; none exists.' },
  { featureKey: 'warding_maneuver', name: 'Warding Maneuver', reason: 'The TARGET of the maneuver gains resistance against the attack\'s damage. The grant is made by the Cavalier\'s marker (Family 8); this family has no grant to read.' },
  { featureKey: 'path_to_the_grave', name: 'Path to the Grave', reason: 'Curse: the next hit on the cursed creature has vulnerability to all of that attack\'s damage. Needs a curse record on the target (Family 8 marker owns it).' },
  { featureKey: 'giant_wrath', name: 'Giant Wrath', reason: 'Per-giant-type upgraded benefits are gate-check in the registry (only the Fire example is printed: immunity to cold, allies gain cold resistance). No stored giant-type choice exists to key the Fire limb on.' },
  { featureKey: 'tallest_peak', name: 'Tallest Peak', reason: 'Resistance to all damage while Huge (size chosen on Rage entry). Size is not a tracked actor property.' },
  { featureKey: 'dust_devil', name: 'Dust Devil', reason: 'Cold/fire resistance while in Dust Devil form. Form state is the entity job\'s (b)-shape record (Amendment 2 §3 #6), not built yet.' },
  { featureKey: 'frozen_haunt', name: 'Frozen Haunt', reason: 'Cold immunity while in the form. Same form-state gap as Dust Devil.' },
  { featureKey: 'elemental_epitome', name: 'Elemental Epitome', reason: 'Resistance to a chosen element while Elemental Attunement is active, changeable at the start of each turn. Neither the attunement-active state nor the per-turn choice is stored.' },
  { featureKey: 'tourmaline_mark', name: 'Tourmaline Mark', reason: 'Primordial Aegis: reaction grants resistance to a chosen element for 1 minute. Needs the enspell/aegis record (a (b)-shape state, not built).' },
  { featureKey: 'saint_of_forge_and_fire_bps', name: 'Saint of Forge and Fire (heavy-armor limb)', reason: 'Resistance to nonmagical bludgeoning/piercing/slashing while wearing heavy armor. Worn-armor state is not read by the damage path. The fire-immunity limb IS wired.' },
  { featureKey: 'spirit_boundary', name: 'Spirit Boundary', reason: 'Resistance to bludgeoning/piercing/slashing for you and your spirit + immunity to frightened, 1/Long Rest, while the spirit is summoned. Needs the spirit-summoned state (entity job) and the 1/Long Rest activation; the frightened-immunity limb is not wired either, because it rides the same activation.' },
  { featureKey: 'dichotomic_aura', name: 'Dichotomic Aura', reason: 'Aura effects while the spirit is summoned (damage + save advantage limbs). Needs the spirit-summoned state (entity job).' },
  { featureKey: 'mighty_summoner', name: 'Mighty Summoner', reason: 'Applies to summoned beasts/fey (extra HP per Hit Die, magical natural weapons). Rides the §(a) summoned-actor row (entity job) — there is no summoned actor to attach it to.' },
  { featureKey: 'advanced_ingredients', name: 'Advanced Ingredients / Full Bellies, Full Hearts', reason: 'Meal benefits (immunity to a damage type/condition the source was immune to). Rides the meal system, which does not exist as engine state.' },
  { featureKey: 'no_one_left_behind', name: 'No One Left Behind', reason: 'Resistance to all damage during the rescue movement only. A movement-window state, not modeled.' },
  { featureKey: 'preventative_medicine', name: 'Preventative Medicine', reason: 'Resistance to nonmagical bludgeoning/piercing/poison/slashing while holding the temp HP this feature grants. Temp-HP amount is tracked but its SOURCE is not, so the row cannot tell this temp HP from any other.' },
  { featureKey: 'wild_magic_piercing_vulnerability_allies', name: 'Wild Magic Surge (Piercing Vulnerability, allies)', reason: 'All creatures within 30 ft share the vulnerability. Self limb is wired via the timed row; the 30-ft radius needs proximity state at damage time.' },
  { featureKey: 'sacrificial_offering', name: 'Sacrificial Offering / Patron Possession', reason: 'Boon-table resistances (e.g. poison/disease immunity) granted by a 10-minute ritual offering. The boon granted is a DM-declared ritual outcome with no stored record.' },
  { featureKey: 'hellbent', name: 'Hellbent', reason: 'Devil-form effects incl. fire damage ignoring resistance/immunity (an offensive bypass, not a resistance row) and a failed-save reroll. The bypass needs a damage-source flag the attack/spell paths do not carry.' },
  { featureKey: 'rite_of_the_dawn', name: 'Rite of the Dawn', reason: 'Necrotic resistance while the rite is active. No Crimson Rite active-state is tracked.' },
  { featureKey: 'frost_resistance_bypass', name: 'Frigid Explorer (bypass limb)', reason: 'Damage from the ranger\'s weapons/spells/features ignores Resistance to Cold damage. An offensive bypass on the attacker\'s side, not a row on the defender; the cold-resistance limb IS wired.' },
];

// ---------------------------------------------------------------------------
// Condition immunities granted by subclass features (consumed by
// conditionService.addCondition). Same feature-keyed, condition-gated
// shape as the damage table. Ally/aura limbs are excluded here too:
// only the actor's own immunity wires (an ally inside an aura is the
// same missing aura-presence state as the damage rows).
// ---------------------------------------------------------------------------

export const CONDITION_IMMUNITY_TABLE = [
  { featureKey: 'mindless_rage', name: 'Mindless Rage', conditions: ['charmed', 'frightened'], condition: { type: 'raging' } },
  { featureKey: 'beautiful_veil', name: 'Beautiful Veil', conditions: ['charmed'], condition: { type: 'raging' } },
  { featureKey: 'aura_of_devotion', name: 'Aura of Devotion', conditions: ['charmed'], condition: { type: 'self-aura' } },
  { featureKey: 'fungal_body', name: 'Fungal Body', conditions: ['blinded', 'deafened', 'frightened', 'poisoned'], condition: { type: 'always' } },
  { featureKey: 'inspiring_commander', name: 'Inspiring Commander', conditions: ['charmed', 'frightened'], condition: { type: 'always' } },
  { featureKey: 'diplomatic_immunity', name: 'Diplomatic Immunity', conditions: ['charmed', 'frightened'], condition: { type: 'always' } },
  { featureKey: 'tempered_by_terror', name: 'Tempered by Terror', conditions: ['frightened'], condition: { type: 'always' } },
  { featureKey: 'beguiling_defenses', name: 'Beguiling Defenses', conditions: ['charmed'], condition: { type: 'always' } },
  { featureKey: 'inner_madness', name: 'Inner Madness', conditions: ['charmed', 'frightened'], condition: { type: 'always' } },
  { featureKey: 'strange_metabolism', name: 'Strange Metabolism', conditions: ['poisoned'], condition: { type: 'always' } },
  { featureKey: 'natures_ward', name: "Nature's Ward", conditions: ['poisoned'], condition: { type: 'always' } },
];

// ---------------------------------------------------------------------------
// Condition evaluation (pure).
// ---------------------------------------------------------------------------

function timedEffectIsActive(actor, effectKey) {
  const te = actor?.timedEffects;
  if (!te) return false;
  if (typeof te === 'function') { try { return !!te(effectKey); } catch { return false; } }
  if (te instanceof Set) return te.has(effectKey);
  if (Array.isArray(te)) return te.includes(effectKey);
  if (typeof te === 'object') return !!te[effectKey];
  return false;
}

function choiceValue(actor, choiceKey) {
  const choices = actor?.subclassChoices || {};
  const raw = choices[choiceKey];
  if (raw == null) return null;
  return String(Array.isArray(raw) ? raw[0] : raw).trim();
}

/** Does this row's condition hold for this actor + damage context? */
export function conditionHolds(row, actor, context = {}) {
  const c = row.condition || { type: 'always' };
  switch (c.type) {
    case 'always': return true;
    case 'self-aura': return true; // the holder is always in their own aura
    case 'raging': return !!actor?.raging;
    case 'not-taken-turn': return actor?.hasTakenTurn === false; // null = unknown -> fail closed
    case 'from-spell': return String(context?.sourceKind || '').toLowerCase() === 'spell';
    case 'nonmagical-only': return context?.magical === false;
    case 'timed': return timedEffectIsActive(actor, c.effectKey);
    case 'choice': {
      const v = choiceValue(actor, c.choiceKey);
      if (!v) return false;
      const norm = v.toLowerCase().replace(/[\s_-]+/g, '');
      if (c.map) {
        const hit = Object.entries(c.map).find(([k]) => k.toLowerCase().replace(/[\s_-]+/g, '') === norm);
        return !!hit;
      }
      if (c.options) return c.options.some((o) => o.toLowerCase() === norm);
      if (c.exclude) return !c.exclude.some((e) => e.toLowerCase() === norm);
      return true;
    }
    default: return false;
  }
}

/** Damage types this row covers for this actor (resolves 'choice' rows). */
function rowTypesFor(row, actor) {
  if (row.types !== 'choice') return row.types;
  const c = row.condition || {};
  const v = choiceValue(actor, c.choiceKey);
  if (!v) return [];
  const norm = v.toLowerCase().replace(/[\s_-]+/g, '');
  if (c.map) {
    const hit = Object.entries(c.map).find(([k]) => k.toLowerCase().replace(/[\s_-]+/g, '') === norm);
    return hit ? [hit[1]] : [];
  }
  const t = normalizeDamageType(v);
  if (!t) return [];
  if (c.exclude && c.exclude.some((e) => e.toLowerCase() === t)) return [];
  if (c.options && !c.options.some((o) => o.toLowerCase() === t)) return [];
  return [t];
}

function featureKeysOf(features) {
  const list = Array.isArray(features) ? features : [];
  const keys = new Set();
  for (const f of list) {
    const k = f?.key || f?.featureKey;
    if (k) keys.add(String(k).toLowerCase());
  }
  return keys;
}

/**
 * All table rows that apply to this actor for this damage type.
 * Pure: `features` is the featuresForActor output for the actor.
 */
export function resistanceEntriesForFeatures(features, damageType, actor, context = {}) {
  const type = normalizeDamageType(damageType);
  if (!type) return [];
  const held = featureKeysOf(features);
  const out = [];
  for (const row of RESISTANCE_TABLE) {
    if (!held.has(row.featureKey.toLowerCase())) continue;
    if (!conditionHolds(row, actor, context)) continue;
    const types = rowTypesFor(row, actor);
    const covers = types.includes('all') || types.includes(type);
    if (!covers) continue;
    if (row.except && row.except.some((e) => e.toLowerCase() === type)) continue;
    out.push({ featureKey: row.featureKey, name: row.name, kind: row.kind, types, condition: row.condition?.type || 'always' });
  }
  return out;
}

/**
 * The D9 read: resistance / immunity / vulnerability for one damage type.
 * Precedence: any immunity wins; resistance + vulnerability on the same
 * type cancel (both still apply in sequence per the book, net ×1 — the
 * amount is unchanged and the cancellation is reported, not hidden).
 */
export function resistanceForFeatures(features, damageType, actor, context = {}) {
  const matched = resistanceEntriesForFeatures(features, damageType, actor, context);
  if (matched.length === 0) return null;
  const imm = matched.find((m) => m.kind === 'immunity');
  if (imm) return { result: 'immunity', source: imm.name, featureKey: imm.featureKey, featureName: imm.name, matched };
  const res = matched.find((m) => m.kind === 'resistance');
  const vul = matched.find((m) => m.kind === 'vulnerability');
  if (res && vul) {
    return { result: null, cancelled: true, sources: [res.name, vul.name], featureKey: res.featureKey, featureName: res.name, matched };
  }
  if (res) return { result: 'resistance', source: res.name, featureKey: res.featureKey, featureName: res.name, matched };
  if (vul) return { result: 'vulnerability', source: vul.name, featureKey: vul.featureKey, featureName: vul.name, matched };
  return null;
}

/** Apply the table to a damage amount. Halving rounds down; doubling is exact. */
export function applyResistanceToAmount(amount, damageType, features, actor, context = {}) {
  const originalAmount = Number(amount) || 0;
  const found = resistanceForFeatures(features, damageType, actor, context);
  if (!found || !found.result) {
    return { amount: originalAmount, result: null, source: null, featureKey: null, featureName: null, cancelled: !!found?.cancelled, originalAmount };
  }
  if (found.result === 'immunity') {
    return { amount: 0, result: 'immunity', source: found.source, featureKey: found.featureKey, featureName: found.featureName, cancelled: false, originalAmount };
  }
  if (found.result === 'resistance') {
    return { amount: Math.floor(originalAmount / 2), result: 'resistance', source: found.source, featureKey: found.featureKey, featureName: found.featureName, cancelled: false, originalAmount };
  }
  return { amount: originalAmount * 2, result: 'vulnerability', source: found.source, featureKey: found.featureKey, featureName: found.featureName, cancelled: false, originalAmount };
}

/**
 * Condition immunities this actor holds (pure). `actor` carries the same
 * descriptor shape as the damage rows (raging gates Mindless Rage /
 * Beautiful Veil; everything else is always-on for the holder).
 */
export function conditionImmunitiesForFeatures(features, actor) {
  const held = featureKeysOf(features);
  const out = [];
  for (const row of CONDITION_IMMUNITY_TABLE) {
    if (!held.has(row.featureKey.toLowerCase())) continue;
    if (!conditionHolds(row, actor, {})) continue;
    for (const cond of row.conditions) {
      out.push({ condition: cond, source: row.name, featureKey: row.featureKey, featureName: row.name });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Actor descriptors (DB-backed). Best-effort throughout: a lookup failure
// returns a descriptor with the unknown fields absent, which fails closed
// (conditional rows do not fire) rather than failing the damage call.
// ---------------------------------------------------------------------------

const TABLE = { player: 'characters', companion: 'companions' };
const CLASS_COL = { player: 'class', companion: 'companion_class' };
const SUBCLASS_COL = { player: 'subclass', companion: 'companion_subclass' };
const LEVEL_COL = { player: 'level', companion: 'companion_level' };
const CLASS_LEVELS_COL = { player: 'class_levels', companion: 'companion_class_levels' };
const CHOICES_COL = { player: 'subclass_choices_json', companion: 'subclass_choices_json' };
const CONDITIONS_COL = { player: 'active_conditions', companion: 'active_conditions' };

/** Build a descriptor from an already-loaded characters/companions row. */
export function actorDescriptorFromRow(row, kind) {
  if (!row) return null;
  const resources = safeParse(row.class_resources_json, {}) || {};
  const choices = safeParse(row[CHOICES_COL[kind]], {}) || {};
  const conditions = safeParse(row[CONDITIONS_COL[kind]], []) || [];
  return {
    kind,
    id: row.id,
    name: row.name || null,
    className: row[CLASS_COL[kind]] || null,
    subclassName: row[SUBCLASS_COL[kind]] || null,
    level: Number(row[LEVEL_COL[kind]] || 1),
    classLevels: safeParse(row[CLASS_LEVELS_COL[kind]], null),
    subclassChoices: (choices && typeof choices === 'object' && !Array.isArray(choices)) ? choices : {},
    conditions: Array.isArray(conditions) ? conditions.map((c) => String(c).toLowerCase()) : [],
    raging: !!resources.raging,
    hasTakenTurn: null, // resolved by loadActorDescriptor when combat state is passed
    timedEffects: new Set(),
  };
}

/** Has this actor taken (started) a turn in the current encounter? */
export async function hasActorTakenTurn(sessionId, encounterSeq, ledgerKey) {
  if (!sessionId || !encounterSeq || !ledgerKey) return null;
  try {
    const { getTurnState } = await import('./combatTurnService.js');
    const state = await getTurnState(sessionId, encounterSeq);
    if (!state || !Array.isArray(state.turnOrder)) return null;
    const idx = state.turnOrder.findIndex((t) => t?.key === ledgerKey || t?.ledgerKey === ledgerKey);
    if (idx < 0) return null;
    if (Number(state.round || 1) > 1) return true;
    // Their turn has started (they are the current turn or it passed).
    return idx <= Number(state.currentIndex || 0);
  } catch { return null; }
}

/** Is a timed effect active on this actor? False when the tracker is absent. */
export async function timedEffectActive(actorRef, effectKey) {
  // MERGE FIX (2026-11-09): the staged version called
  // hasTimedEffect(actorRef, effectKey) — two args against a three-arg
  // pure function (sessionConfig, actorKey, effectKey) — so it always
  // returned false, which silently disabled every timed-condition read
  // (save marks, Eyes Wide Open, timed resistance rows). This version
  // loads the session config from the DB and reads the actor bucket
  // under the `kind:id` convention (player:<id>, companion:<id>,
  // enemy:<id> — see conditionService.targetSaveMarksActive).
  try {
    if (!actorRef?.sessionId || !actorRef?.id || !effectKey) return false;
    const { hasTimedEffect } = await import('./durationTrackerService.js');
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [actorRef.sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    const actorKey = `${actorRef.kind || 'player'}:${actorRef.id}`;
    return !!hasTimedEffect(cfg, actorKey, effectKey);
  } catch { return false; }
}

/**
 * Load a full descriptor for a party actor, resolving turn state and
 * timed effects best-effort. `opts`: { sessionId, encounterSeq,
 * ledgerKey, timedEffectKeys } — timedEffectKeys lists the timed rows
 * to check (defaults to every timed key in the table).
 */
export async function loadActorDescriptor(kind, id, opts = {}) {
  const table = TABLE[kind];
  if (!table || !id) return null;
  let row = null;
  try {
    row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  } catch { return null; }
  if (!row) return null;
  const desc = actorDescriptorFromRow(row, kind);
  if (opts.sessionId && opts.encounterSeq && opts.ledgerKey) {
    desc.hasTakenTurn = await hasActorTakenTurn(opts.sessionId, opts.encounterSeq, opts.ledgerKey);
  }
  const timedKeys = opts.timedEffectKeys || [...new Set(RESISTANCE_TABLE.filter((r) => r.condition?.type === 'timed').map((r) => r.condition.effectKey))];
  const active = new Set();
  for (const key of timedKeys) {
    if (await timedEffectActive({ kind, id, sessionId: opts.sessionId, encounterSeq: opts.encounterSeq }, key)) active.add(key);
  }
  desc.timedEffects = active;
  return desc;
}

/**
 * Resolve an actor's subclass features through the shared contract.
 * Dynamic import: subclassService.featuresForActor is another worker's
 * piece and is absent from the mirror — a missing import resolves to
 * no features (fail closed), never to an invented row.
 */
export async function featuresForActorSafe(descriptor) {
  if (!descriptor?.className) return [];
  try {
    const svc = await import('./subclassService.js');
    if (typeof svc.featuresForActor !== 'function') return [];
    const out = await svc.featuresForActor({
      className: descriptor.className,
      subclassName: descriptor.subclassName,
      level: descriptor.level,
      classLevels: descriptor.classLevels,
    });
    return Array.isArray(out) ? out : [];
  } catch { return []; }
}

/**
 * The D9 contract. `actor` is either a descriptor object (className /
 * subclassName / level / ...) or a { kind, id } reference (optionally
 * with sessionId / encounterSeq / ledgerKey for turn-state resolution).
 * `context`: { sourceKind, magical }.
 */
export async function resistanceFor(actor, damageType, context = {}) {
  let descriptor = null;
  if (actor && actor.className) {
    descriptor = actor;
  } else if (actor && actor.kind && actor.id) {
    descriptor = await loadActorDescriptor(actor.kind, actor.id, actor);
  }
  if (!descriptor) return null;
  const features = await featuresForActorSafe(descriptor);
  return resistanceForFeatures(features, damageType, descriptor, context);
}

/** resistanceFor + amount math, for a { kind, id } actor or a descriptor. */
export async function applyResistanceForActor(actor, amount, damageType, context = {}) {
  const originalAmount = Number(amount) || 0;
  let descriptor = null;
  if (actor && actor.className) {
    descriptor = actor;
  } else if (actor && actor.kind && actor.id) {
    descriptor = await loadActorDescriptor(actor.kind, actor.id, actor);
  }
  if (!descriptor) return { amount: originalAmount, result: null, source: null, featureKey: null, featureName: null, cancelled: false, originalAmount };
  const features = await featuresForActorSafe(descriptor);
  return applyResistanceToAmount(originalAmount, damageType, features, descriptor, context);
}

export default {
  DAMAGE_TYPES, normalizeDamageType,
  RESISTANCE_TABLE, RESISTANCE_FEATURE_KEYS, STILL_DM_PROMPT,
  CONDITION_IMMUNITY_TABLE,
  conditionHolds, resistanceEntriesForFeatures, resistanceForFeatures,
  applyResistanceToAmount, conditionImmunitiesForFeatures,
  actorDescriptorFromRow, hasActorTakenTurn, timedEffectActive,
  loadActorDescriptor, featuresForActorSafe, resistanceFor, applyResistanceForActor,
};
