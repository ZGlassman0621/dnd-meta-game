/**
 * Pugilist class service — base class ONLY (Sterling Vermin,
 * 2016-2018, 2014-era material, transcribed from the verified
 * digest at ~/workspace/dnd-app-review/new-classes-staging/digests/pugilist.md).
 *
 * NO conversion toward 2024 is applied here: see
 * ~/workspace/dnd-app-review/new-classes-staging/conversions-pugilist.md
 * for the conversion log (which is: none — as written, with reasons).
 *
 * Sources (digest only, never memory):
 * - Hit die 1d8; saves Strength, Constitution (+ Dexterity from
 *   Fancy Footwork at 7th); light armor; simple weapons,
 *   improvised weapons, whip, hand crossbow; two skills from
 *   Acrobatics, Athletics, Deception, Intimidation, Perception,
 *   Sleight of Hand, Stealth. NO spellcasting.
 * - Fight Club chosen at 3rd; club features at 3rd, 6th, 11th, 17th.
 * - Fisticuffs die: 1d6 (1st-4th), 1d8 (5th-10th), 1d10 (11th-16th),
 *   1d12 (17th-20th). Pugilist weapons: simple melee weapons
 *   without the two-handed property, whips, improvised weapons;
 *   the finesse property may NOT be used while a weapon is used
 *   as a pugilist weapon.
 * - Moxie: 3 starter features (Brace Up, The Old One-Two,
 *   Stick and Move); regain ALL moxie on a short or long rest.
 * - Bloodied But Unbowed (3rd): reaction when damage reduces you
 *   to half max hp or less — temp HP = pugilist level + Con mod,
 *   regain all expended moxie; 1/short-or-long rest.
 * - Down But Not Out (9th): when you use Bloodied But Unbowed,
 *   may also add proficiency bonus to damage with unarmed
 *   attacks/pugilist weapons for the next minute; reusable after
 *   a long rest (tracked as its own long-rest flag in v1 — the
 *   digest wording ties reuse to a long rest, not to Bloodied's
 *   short-rest cycle; see UNRESOLVED note in the conversions file).
 * - Fighting Spirit (18th): with 4 or fewer exhaustion levels,
 *   when reduced to 0 hp — regain half max hp, half max moxie,
 *   gain a level of exhaustion; 1/long rest.
 * - Peak Physical Condition (20th): Str/Con +2 (max 22); on a long
 *   rest recover 2 exhaustion levels instead of 1 and regain ALL
 *   expended hit dice instead of half. Prompt-only in v1 (no
 *   exhaustion/hit-die engine is consumed here).
 *
 * Moxie maxima — printed values ONLY (digest Resources):
 * 2nd 2, 4th 3, 6th 4, 8th 5, 10th 6, 12th 7, 14th 8, 16th 9,
 * 18th 10, 20th 12. The digest states the table prints a value per
 * level but lists only these; moxieMaxForLevel returns null for
 * every unlisted level (1st, 3rd, 5th, 7th, 9th, 11th, 13th, 15th,
 * 17th, 19th) rather than interpolating. 1st has no moxie at all
 * (Moxie is gained at 2nd); 3rd is flagged in the brief as
 * printing no value; 19th is ambiguous because of the 18th->20th
 * jump (10 -> 12). The coordinator must resolve the odd-level
 * column against the source PDF before this max is consumed by
 * any rest/level-up path — rests in this file refill to the max
 * only when it is known, and never invent one.
 *
 * General moxie-feature progression beyond the 3 starters is NOT
 * enumerated in the digest (only the Squared Circle's 3 club
 * additions appear) — this file wires the starters + club
 * additions only; the rest is UNRESOLVED, never invented.
 *
 * New weapons (brass knuckles, katar, knuckle knives — 1d4, Light,
 * unarmed property) are a DATA NOTE only: no weapon system is
 * built here. See the fragment comments.
 *
 * State lives in class_resources_json.pugilist (migration 091),
 * so no new migration. Pure functions take state and return
 * { state, ...result }; load/save helpers parse/serialize the
 * namespaced key themselves — NEVER through
 * classFeatureService.parseClassResources (strips unknown keys).
 *
 * Mirror limitation (honest scope): this mirror has no
 * server/database.js or server/services/markerPipeline.js, so
 * this file is intentionally dependency-free and registers NO
 * marker handlers. On merge to the live Mac the coordinator wires
 * DB load/save around loadPugilistState/savePugilistState and
 * marker registration following the artificerService.js pattern,
 * plus an applyPugilistRest twin in restTimeService.js and a
 * class-gated pugilistPromptSection call in dmPromptBuilder.js.
 * Extra Attack at 5th also needs an extraAttackCount branch in
 * classFeatureService.js (coordinator merge item, not this file).
 */

export const PUGILIST_CLUBS = [
  'arena_royale',
  'bloodhound_bruisers',
  'dog_and_hound',
  'piss_and_vinegar',
  'squared_circle',
  'sweet_science',
];

export const CLUB_NAMES = {
  arena_royale: 'Arena Royale',
  bloodhound_bruisers: 'Bloodhound Bruisers',
  dog_and_hound: 'Dog & Hound',
  piss_and_vinegar: 'Piss & Vinegar',
  squared_circle: 'The Squared Circle',
  sweet_science: 'The Sweet Science',
};

// Fisticuffs die by pugilist level (digest, verbatim bands).
export function fisticuffsDie(level) {
  const l = Math.trunc(level) || 1;
  if (l >= 17) return '1d12';
  if (l >= 11) return '1d10';
  if (l >= 5) return '1d8';
  return '1d6';
}

// Moxie maxima: PRINTED values only. Null = not printed in the
// digest (see header) — callers must not treat null as 0.
export const MOXIE_MAX_PRINTED = {
  2: 2, 4: 3, 6: 4, 8: 5, 10: 6, 12: 7, 14: 8, 16: 9, 18: 10, 20: 12,
};
export function moxieMaxForLevel(level) {
  const l = Math.trunc(level) || 1;
  if (l < 2) return 0; // Moxie is gained at 2nd; no pool exists at 1st.
  return MOXIE_MAX_PRINTED[l] ?? null;
}

// Starter moxie features (2nd) + Squared Circle club additions (3rd).
export const STARTER_MOXIE_FEATURES = ['brace_up', 'the_old_one_two', 'stick_and_move'];
export const SQUARED_CIRCLE_MOXIE_FEATURES = ['compression_lock', 'quick_pin', 'to_the_mat'];
export function moxieFeaturesFor({ level, club } = {}) {
  const out = (Math.trunc(level) || 1) >= 2 ? [...STARTER_MOXIE_FEATURES] : [];
  if (club === 'squared_circle' && (Math.trunc(level) || 1) >= 3) {
    out.push(...SQUARED_CIRCLE_MOXIE_FEATURES);
  }
  return out;
}

// Arena Royale persona points: 3 + Cha modifier, minimum 1, per
// long rest. Spendable in place of moxie points, and before a
// Charisma check to add the Strength modifier — only while the
// persona is adopted.
export function personaPointsMax(chaMod) {
  return Math.max(1, 3 + (Math.trunc(chaMod) || 0));
}

// --- State -----------------------------------------------------------------
export function defaultPugilistState() {
  return {
    club: null,
    moxieLeft: 0,
    moxieMax: null,
    bloodiedButUnbowedUsed: false,
    downButNotOutUsed: false,
    fightingSpiritUsed: false,
    personaAdopted: false,
    personaPointsLeft: 0,
    personaPointsMax: 0,
  };
}
function clone(state) {
  return JSON.parse(JSON.stringify(state || defaultPugilistState()));
}
function parseAllResources(raw) {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return raw && typeof raw === 'object' ? raw : {};
}
// Own full parse on purpose (see header): never parseClassResources.
export function loadPugilistState(rawClassResources) {
  const resources = parseAllResources(rawClassResources);
  return resources.pugilist
    ? { ...defaultPugilistState(), ...resources.pugilist }
    : defaultPugilistState();
}
// Returns the full resources object with .pugilist replaced; the
// caller JSON-stringifies it and UPDATEs class_resources_json.
export function savePugilistState(rawClassResources, pugilistState) {
  const resources = parseAllResources(rawClassResources);
  resources.pugilist = pugilistState;
  return resources;
}

function initMoxie(s, level) {
  const max = moxieMaxForLevel(level);
  if (max === null) return s; // Never invent a max for an unprinted level.
  if (s.moxieMax === null || s.moxieMax === undefined) {
    s.moxieMax = max; s.moxieLeft = max;
  } else if (s.moxieLeft > max) {
    s.moxieMax = max; s.moxieLeft = max;
  } else {
    s.moxieMax = max;
  }
  return s;
}

export function spendMoxie(state, level, amount = 1) {
  const s = initMoxie(clone(state), level);
  const cost = Math.max(1, Math.trunc(amount) || 1);
  if (s.moxieMax === null) {
    return { state: s, success: false, reason: 'moxie_max_unresolved_for_level' };
  }
  if (s.moxieLeft < cost) {
    return { state: s, success: false, reason: 'not_enough_moxie', moxieLeft: s.moxieLeft };
  }
  s.moxieLeft -= cost;
  return { state: s, success: true, moxieLeft: s.moxieLeft };
}
export function gainMoxie(state, level, amount = 1) {
  const s = initMoxie(clone(state), level);
  if (s.moxieMax === null) {
    return { state: s, success: false, reason: 'moxie_max_unresolved_for_level' };
  }
  s.moxieLeft = Math.min(s.moxieMax, s.moxieLeft + Math.max(0, Math.trunc(amount) || 0));
  return { state: s, success: true, moxieLeft: s.moxieLeft };
}
// Arena Royale: spend a persona point in place of a moxie point.
// Only while the persona is adopted; persona points are NOT moxie
// and never refill moxie directly.
export function spendPersonaPoint(state) {
  const s = clone(state);
  if (!s.personaAdopted) {
    return { state: s, success: false, reason: 'persona_not_adopted' };
  }
  if (s.personaPointsLeft <= 0) {
    return { state: s, success: false, reason: 'no_persona_points_left' };
  }
  s.personaPointsLeft -= 1;
  return { state: s, success: true, personaPointsLeft: s.personaPointsLeft };
}

// Bloodied But Unbowed (3rd): reaction when damage reduces you to
// half max hp or less. Temp HP = pugilist level + Con mod, regain
// ALL expended moxie. 1/short-or-long rest.
export function bloodiedButUnbowed(state, { level, conMod, addProficiencyDamage = false }) {
  const s = initMoxie(clone(state), level);
  if ((Math.trunc(level) || 1) < 3) {
    return { state: s, success: false, reason: 'level_too_low' };
  }
  if (s.bloodiedButUnbowedUsed) {
    return { state: s, success: false, reason: 'bloodied_but_unbowed_already_used_this_rest' };
  }
  s.bloodiedButUnbowedUsed = true;
  if (s.moxieMax !== null) s.moxieLeft = s.moxieMax;
  // Down But Not Out (9th) rides this use: proficiency bonus to
  // damage with unarmed attacks/pugilist weapons for the next
  // minute, reusable after a long rest.
  let downButNotOut = false;
  if (addProficiencyDamage) {
    if ((Math.trunc(level) || 1) < 9) {
      return { state: s, success: false, reason: 'down_but_not_out_level_too_low' };
    }
    if (s.downButNotOutUsed) {
      return { state: s, success: false, reason: 'down_but_not_out_already_used_this_long_rest' };
    }
    s.downButNotOutUsed = true;
    downButNotOut = true;
  }
  return {
    state: s, success: true,
    tempHp: (Math.trunc(level) || 1) + (Math.trunc(conMod) || 0),
    moxieLeft: s.moxieLeft, downButNotOut,
  };
}

// Fighting Spirit (18th): with 4 or fewer exhaustion levels, when
// reduced to 0 hp — regain half max hp, half max moxie, gain a
// level of exhaustion. 1/long rest. Half values use Math.floor,
// matching "half" as printed with no rounding rule stated — the
// rounding choice is flagged in the conversions file.
export function fightingSpirit(state, { level, maxHp, exhaustionLevels }) {
  const s = initMoxie(clone(state), level);
  if ((Math.trunc(level) || 1) < 18) {
    return { state: s, success: false, reason: 'level_too_low' };
  }
  if (s.fightingSpiritUsed) {
    return { state: s, success: false, reason: 'fighting_spirit_already_used_this_long_rest' };
  }
  if ((Math.trunc(exhaustionLevels) || 0) > 4) {
    return { state: s, success: false, reason: 'too_exhausted_for_fighting_spirit' };
  }
  const maxMoxie = moxieMaxForLevel(level);
  if (maxMoxie === null) {
    return { state: s, success: false, reason: 'moxie_max_unresolved_for_level' };
  }
  s.fightingSpiritUsed = true;
  s.moxieLeft = Math.floor(maxMoxie / 2);
  s.moxieMax = maxMoxie;
  return {
    state: s, success: true,
    hpRegained: Math.floor((Math.trunc(maxHp) || 0) / 2),
    moxieRegained: s.moxieLeft,
    exhaustionGained: 1,
  };
}

// --- Rests -----------------------------------------------------------------
// Moxie regains ALL on a short or long rest. Bloodied But Unbowed
// resets on either rest; Down But Not Out and Fighting Spirit
// reset on a long rest only.
export function onShortRest(state, { level }) {
  const s = initMoxie(clone(state), level);
  if (s.moxieMax !== null) s.moxieLeft = s.moxieMax;
  s.bloodiedButUnbowedUsed = false;
  return { state: s, success: true };
}
export function onLongRest(state, { level, chaMod }) {
  const s = initMoxie(clone(state), level);
  if (s.moxieMax !== null) s.moxieLeft = s.moxieMax;
  s.bloodiedButUnbowedUsed = false;
  s.downButNotOutUsed = false;
  s.fightingSpiritUsed = false;
  if (s.club === 'arena_royale') {
    const pMax = personaPointsMax(chaMod);
    s.personaPointsMax = pMax; s.personaPointsLeft = pMax;
  }
  return { state: s, success: true };
}

// --- DM prompt section (seam for dmPromptBuilder) ---------------------------
export function pugilistPromptSection(state, { level, club, chaMod }) {
  const s = state || defaultPugilistState();
  const cl = club || s.club;
  const lines = [`Pugilist (level ${level}${cl ? `, ${CLUB_NAMES[cl] || cl}` : ''}):`];
  lines.push(`- Fisticuffs die: ${fisticuffsDie(level)} (unarmed strikes and pugilist weapons; finesse may NOT be used on a pugilist weapon)`);
  const max = moxieMaxForLevel(level);
  if (max === null) {
    lines.push(`- Moxie: MAX UNRESOLVED for level ${level} (printed column not in the digest — do not guess; see conversions-pugilist.md)`);
  } else {
    const left = s.moxieMax !== null ? s.moxieLeft : max;
    lines.push(`- Moxie left: ${left}/${max} (regain all on a short or long rest; known features: ${moxieFeaturesFor({ level, club: cl }).join(', ') || 'none yet'})`);
  }
  if (cl === 'arena_royale') {
    const pMax = s.personaPointsMax || personaPointsMax(chaMod);
    const pLeft = s.personaPointsMax ? s.personaPointsLeft : pMax;
    lines.push(`- Persona ${s.personaAdopted ? 'ADOPTED' : 'not adopted'}: persona points ${pLeft}/${pMax} (spendable in place of moxie, only while adopted; regain on a long rest)`);
  }
  if ((Math.trunc(level) || 1) >= 3) {
    lines.push(`- Bloodied But Unbowed: ${s.bloodiedButUnbowedUsed ? 'USED this rest' : 'available'} (reaction at half max hp or less: temp HP = level + Con mod, regain all moxie)`);
  }
  if ((Math.trunc(level) || 1) >= 18) {
    lines.push(`- Fighting Spirit: ${s.fightingSpiritUsed ? 'USED this long rest' : 'available'} (at 0 hp with 4 or fewer exhaustion levels: half max hp, half max moxie, +1 exhaustion)`);
  }
  if ((Math.trunc(level) || 1) >= 20) {
    lines.push(`- Peak Physical Condition: Strength and Constitution +2 (max 22); long rest recovers 2 exhaustion levels and all expended hit dice`);
  }
  return lines.join('\n');
}

// --- Multiclass grant (digest: proficiencies gained) ------------------------
export const MULTICLASS_GRANT = {
  hitDie: 8,
  armor: ['light'],
  weapons: ['improvised'],
};
// (2026-11-08: the orphan duplicate MULTICLASS_REQUIREMENTS deleted
// with the table — multiclass prerequisites removed, Zach: all
// classes multiclass freely. MULTICLASS_GRANT above stays.)

export default {
  PUGILIST_CLUBS, CLUB_NAMES, fisticuffsDie, MOXIE_MAX_PRINTED,
  moxieMaxForLevel, STARTER_MOXIE_FEATURES, SQUARED_CIRCLE_MOXIE_FEATURES,
  moxieFeaturesFor, personaPointsMax, defaultPugilistState,
  loadPugilistState, savePugilistState, spendMoxie, gainMoxie,
  spendPersonaPoint, bloodiedButUnbowed, fightingSpirit, onShortRest,
  onLongRest, pugilistPromptSection, MULTICLASS_GRANT,
};
