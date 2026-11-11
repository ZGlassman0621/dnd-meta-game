// Blood Hunter class service — base class + Order progression (state + rest).
//
// Source: Blood Hunter 2024 (GM Binder fan conversion, 16 pp — the PDF wins on
// any disagreement with the registry or the client). NO conversion applied.
// Registry: server/data/subclasses/blood_hunter.js (4 Orders, 25 features).
//
// Shape: modeled exactly on the eight existing new-class services
// (artificer / magus / spellshot / warden / blackguard / pugilist / scholar /
// duelist): pure-math tables + defaultBloodHunterState() + load/save +
// spend/use functions returning { state, success, reason } + pure
// onLongRest/onShortRest + bloodHunterPromptSection. No marker handlers in
// v1 (a later marker job wires the pure functions without rewriting math).
//
// v1 SCOPE (design, Job 6): this service holds the tables, the state, and the
// rest resets. All 26 subclass features, all curse effects, and rite combat
// damage stay registry + DM-prompt text — no attack-path hook, no entity row,
// no curse registry (the base curse list lives only in the PDF; cursesKnown
// stores chosen names as free text, NOT through validateChoice). Profane Soul
// spellcasting stays in profaneSoulService.js — this file does not touch it.
// (26, not the design's 25 — node-imported count, 2026-11-09.)
//
// DESIGN CORRECTIONS applied while building (PDF-verified, not guesses):
// - Curse Specialist (Ghostslayer) is 3rd level, not 7th — PDF "Level 3:
//   Curse Specialist" + registry bh-subclasses.js:65 (level 3). The design
//   file §3.1 said "(7th)"; the +1 Maledict use applies from 3rd.
// - Rite Focus is 5th (base class): the rite self-damage is reduced by Int
//   mod, minimum 1 damage — PDF "Level 5: Rite Focus". activateRite returns
//   the die + reduction; the caller rolls the die (this service never rolls).
// - Mutagen concoction (Muse call, recorded in the design §7.1, reversible):
//   the Mutagencraft table is the number concoctable PER REST (1/2/2/3/3);
//   an unconsumed mutagen goes inert at the next rest, so the rest hook
//   clears mutagensConcocted. If Zach reads the table as max-held instead,
//   the fix is a one-line change in concoctMutagen.
// - Maledict refill at rest uses the POST-rest Vermillion status (the
//   mutagen's effects end at the rest, so its +1 use does not survive it).
//   Muse call, reversible.
// - Max fields stored alongside uses-left (maledictUsesMax, aetherWalkUsesMax,
//   hybridUsesMax, exaltedMutationUsesMax): the blackguard precedent
//   (useVileTouch lazy-inits vileTouchUsesMax/Left). Without them a fresh
//   character who has never rested could never spend, and a spent-to-zero
//   pool would be indistinguishable from never-initialized and refill for
//   free on the next spend call. hybridUsesMax is null when unlimited (18th:
//   JSON has no Infinity, so null = unlimited in stored state).
// - No MULTICLASS_GRANT export: BLOOD_HUNTER_MULTICLASS_GRANT already lives
//   in levelProgression.js (single source of truth); this service does not
//   duplicate it.

const clampLevel = (level) => Math.min(20, Math.max(1, Math.trunc(level) || 1));
const clampMod = (mod) => Math.trunc(mod) || 0;
const clone = (state) => JSON.parse(JSON.stringify(state || defaultBloodHunterState()));

function normalizeSubclass(subclass) {
  return String(subclass || '').toLowerCase().replace(/'/g, '').replace(/order of the /g, '').replace(/[^a-z]/g, '');
}

// --- Rites ----------------------------------------------------------------------
// Primal rites (2nd, +1 at 7th); Esoteric rites (14th). Damage types are the
// PDF's own: Flame = Fire, Frozen = Cold, Storm = Lightning; Dead = Necrotic,
// Oracle = Psychic, Roar = Thunder (registry bh-subclasses.js).
export const PRIMAL_RITES = ['Flame', 'Frozen', 'Storm'];
export const ESOTERIC_RITES = ['Dead', 'Oracle', 'Roar'];
export const RITE_DAMAGE_TYPE = {
  Flame: 'Fire', Frozen: 'Cold', Storm: 'Lightning',
  Dead: 'Necrotic', Oracle: 'Psychic', Roar: 'Thunder',
};
export const ALL_RITES = [...PRIMAL_RITES, ...ESOTERIC_RITES];

// --- Mutagen formulas ------------------------------------------------------------
// The 20 Mutant formulas, with the PDF's level prerequisites (Aether, Cruelty,
// Precision: 11th; Reconstruction: 7th; the rest: none). Names + prerequisites
// match the registry's Mutagen Formulas feature (bh-subclasses.js:234-256);
// exactly — tests/newclass-blood-hunter.test.js asserts the match so the two
// lists cannot drift silently.
export const MUTAGEN_FORMULAS = [
  { name: 'Aether', prerequisiteLevel: 11 },
  { name: 'Alluring', prerequisiteLevel: 0 },
  { name: 'Celerity', prerequisiteLevel: 0 },
  { name: 'Conversant', prerequisiteLevel: 0 },
  { name: 'Cruelty', prerequisiteLevel: 11 },
  { name: 'Deftness', prerequisiteLevel: 0 },
  { name: 'Embers', prerequisiteLevel: 0 },
  { name: 'Gelid', prerequisiteLevel: 0 },
  { name: 'Impermeable', prerequisiteLevel: 0 },
  { name: 'Mobility', prerequisiteLevel: 0 },
  { name: 'Nighteye', prerequisiteLevel: 0 },
  { name: 'Percipient', prerequisiteLevel: 0 },
  { name: 'Potency', prerequisiteLevel: 0 },
  { name: 'Precision', prerequisiteLevel: 11 },
  { name: 'Rapidity', prerequisiteLevel: 0 },
  { name: 'Reconstruction', prerequisiteLevel: 7 },
  { name: 'Sagacity', prerequisiteLevel: 0 },
  { name: 'Shielded', prerequisiteLevel: 0 },
  { name: 'Unbreakable', prerequisiteLevel: 0 },
  { name: 'Vermillion', prerequisiteLevel: 0 },
];
const formulaByName = (name) => {
  const want = String(name || '').trim().toLowerCase();
  return MUTAGEN_FORMULAS.find((f) => f.name.toLowerCase() === want) || null;
};

// --- Pure math ------------------------------------------------------------------

// Hemocraft Die table (PDF): 1d4 (1–4), 1d6 (5–9), 1d8 (10–14), 1d10 (15–20).
export function hemocraftDieForLevel(level) {
  const l = clampLevel(level);
  return l >= 15 ? '1d10' : l >= 10 ? '1d8' : l >= 5 ? '1d6' : '1d4';
}

// Blood Maledict uses (PDF): 1 (1st), 2 (6th), 3 (13th), 4 (17th);
// +1 Ghostslayer Curse Specialist (3rd, PDF + registry); +1 while a
// Vermillion mutagen is active (Mutant formula).
export function bloodMaledictUsesMax(level, opts = {}) {
  const l = clampLevel(level);
  let max = l >= 17 ? 4 : l >= 13 ? 3 : l >= 6 ? 2 : 1;
  if (normalizeSubclass(opts.subclass) === 'ghostslayer' && l >= 3) max += 1;
  if (opts.vermillionActive) max += 1;
  return max;
}

// Blood Curses known (PDF): 1 (1st), 2 (6th), 3 (10th), 4 (14th), 5 (18th).
// Order-granted curses (Exorcist 15th, Howl 11th, Corrosion 15th, Soul Eater
// 18th) do NOT count against this number.
export function bloodCursesKnownForLevel(level) {
  const l = clampLevel(level);
  return l >= 18 ? 5 : l >= 14 ? 4 : l >= 10 ? 3 : l >= 6 ? 2 : 1;
}

// Rites known (PDF): Primal 1 at 2nd, +1 at 7th; Esoteric 1 at 14th.
export function ritesKnownForLevel(level) {
  const l = clampLevel(level);
  const primal = l >= 7 ? 2 : l >= 2 ? 1 : 0;
  const esoteric = l >= 14 ? 1 : 0;
  return { primal, esoteric, total: primal + esoteric };
}

// Mutagencraft table (PDF): formulas known 4/5/6/7/8 at 3/7/11/15/18;
// mutagens concoctable per rest 1/2/2/3/3 at the same levels.
export function mutagenFormulasKnownForLevel(level) {
  const l = clampLevel(level);
  return l >= 18 ? 8 : l >= 15 ? 7 : l >= 11 ? 6 : l >= 7 ? 5 : l >= 3 ? 4 : 0;
}
export function mutagensCreatedForLevel(level) {
  const l = clampLevel(level);
  return l >= 18 ? 3 : l >= 15 ? 3 : l >= 11 ? 2 : l >= 7 ? 2 : l >= 3 ? 1 : 0;
}

// Hybrid Transformation uses (PDF, Lycan): 1 (3rd), 2 (11th), unlimited (18th).
// Infinity is the math value; stored state uses null for unlimited (see header).
export function hybridTransformationUsesMax(level) {
  const l = clampLevel(level);
  return l >= 18 ? Infinity : l >= 11 ? 2 : l >= 3 ? 1 : 0;
}

// Aether Walk uses (PDF + registry aether_walk, Ghostslayer 7th):
// 1 per rest (7th), 2 between rests (15th).
export function aetherWalkUsesMax(level) {
  const l = clampLevel(level);
  return l >= 15 ? 2 : l >= 7 ? 1 : 0;
}

// Exalted Mutation uses (PDF, Mutant 18th): Int mod (min 1), Long Rest only.
export function exaltedMutationUsesMax(intMod) {
  return Math.max(1, clampMod(intMod));
}

// --- State ----------------------------------------------------------------------

export function defaultBloodHunterState() {
  return {
    activeRites: [],            // [{ weapon, rite, damageType }] — one rite per weapon
    maledictUsesLeft: 0,
    maledictUsesMax: 0,
    cursesKnown: [],            // chosen curse names, free text (no curse registry in v1)
    ritesKnown: [],             // e.g. ['Flame', 'Storm']
    mutagensConcocted: [],      // [formula name] — cap = mutagensCreatedForLevel; inert at next rest
    mutagensActive: [],         // [formula name] — consumed; effects last until Short/Long Rest
    hybridUsesLeft: 0,
    hybridUsesMax: 0,           // null = unlimited (18th)
    aetherWalkUsesLeft: 0,
    aetherWalkUsesMax: 0,
    riteRevivalUsed: false,     // once per Long Rest (18th)
    strangeMetabolismUsed: false, // once per Long Rest (7th, Mutant)
    exaltedMutationUsesLeft: 0, // Int mod (min 1), Long Rest only (18th, Mutant)
    exaltedMutationUsesMax: 0,
    soulEaterAmplifyUsed: false, // once amplified, must finish a Long Rest (18th, Profane Soul)
  };
}

function isVermillionActive(state) {
  return (state.mutagensActive || []).some((m) => String(m).toLowerCase() === 'vermillion');
}

// --- Spend / use (pure; { state, success, reason }) ------------------------------

// Crimson Rite (2nd): Bonus Action, activate a known rite on a held weapon.
// Self-damage: one Hemocraft-die roll of Necrotic, unreducible — EXCEPT Rite
// Focus (5th) reduces it by Int mod (minimum 1 damage). This function never
// rolls: it returns selfDamageDie + selfDamageReduction and the caller rolls.
export function activateRite(state, { weapon, rite, level, intMod }) {
  const s = clone(state);
  const l = clampLevel(level);
  const weaponName = String(weapon || '').trim();
  if (!weaponName) return { state: s, success: false, reason: 'no_weapon' };
  if (l < 2) return { state: s, success: false, reason: 'level_too_low' };
  const riteName = ALL_RITES.find((r) => r.toLowerCase() === String(rite || '').trim().toLowerCase());
  if (!riteName) return { state: s, success: false, reason: 'unknown_rite' };
  if (ESOTERIC_RITES.includes(riteName) && l < 14) {
    return { state: s, success: false, reason: 'esoteric_rite_locked' };
  }
  if ((s.activeRites || []).some((r) => String(r.weapon).toLowerCase() === weaponName.toLowerCase())) {
    return { state: s, success: false, reason: 'weapon_already_has_rite' };
  }
  s.activeRites = [...(s.activeRites || []), { weapon: weaponName, rite: riteName, damageType: RITE_DAMAGE_TYPE[riteName] }];
  if (!(s.ritesKnown || []).some((r) => String(r).toLowerCase() === riteName.toLowerCase())) {
    s.ritesKnown = [...(s.ritesKnown || []), riteName];
  }
  const selfDamageDie = hemocraftDieForLevel(l);
  const selfDamageReduction = l >= 5 ? Math.max(0, clampMod(intMod)) : 0;
  return { state: s, success: true, selfDamageDie, selfDamageReduction, selfDamageMinimum: 1 };
}

export function endRite(state, { weapon }) {
  const s = clone(state);
  const weaponName = String(weapon || '').trim();
  const before = (s.activeRites || []).length;
  s.activeRites = (s.activeRites || []).filter((r) => String(r.weapon).toLowerCase() !== weaponName.toLowerCase());
  if (s.activeRites.length === before) return { state: s, success: false, reason: 'no_active_rite' };
  return { state: s, success: true };
}

// Blood Maledict (1st): spend one use. The curse itself is DM-adjudicated
// (no curse registry in v1); opts.curse is recorded nowhere — it names the
// curse for the caller, nothing more.
export function useBloodMaledict(state, opts = {}) {
  const s = clone(state);
  const max = bloodMaledictUsesMax(opts.level || 1, opts);
  if (!s.maledictUsesMax) { s.maledictUsesMax = max; s.maledictUsesLeft = max; }
  if (s.maledictUsesLeft > s.maledictUsesMax) s.maledictUsesLeft = s.maledictUsesMax;
  if (s.maledictUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.maledictUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.maledictUsesLeft };
}

// Mutagencraft (3rd): concoct one mutagen when you finish a Short or Long
// Rest — in v1 the concoction itself is recorded here (the DM confirms the
// rest happened); the per-rest cap is the Mutagencraft table.
export function concoctMutagen(state, { formula, level }) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 3) return { state: s, success: false, reason: 'level_too_low' };
  const found = formulaByName(formula);
  if (!found) return { state: s, success: false, reason: 'unknown_formula' };
  if (l < found.prerequisiteLevel) return { state: s, success: false, reason: 'formula_prerequisite_not_met' };
  const cap = mutagensCreatedForLevel(l);
  if ((s.mutagensConcocted || []).length >= cap) {
    return { state: s, success: false, reason: 'mutagen_cap_reached' };
  }
  s.mutagensConcocted = [...(s.mutagensConcocted || []), found.name];
  return { state: s, success: true, concocted: s.mutagensConcocted.length, cap };
}

// Consume a concocted mutagen (Bonus Action): effects + side effects last
// until a Short or Long Rest.
export function consumeMutagen(state, { formula }) {
  const s = clone(state);
  const want = String(formula || '').trim().toLowerCase();
  const idx = (s.mutagensConcocted || []).findIndex((m) => String(m).toLowerCase() === want);
  if (idx < 0) return { state: s, success: false, reason: 'mutagen_not_concocted' };
  const [taken] = s.mutagensConcocted.splice(idx, 1);
  s.mutagensActive = [...(s.mutagensActive || []), taken];
  return { state: s, success: true, active: s.mutagensActive };
}

// Magic action: flush all active mutagens, ending their effects + side effects.
export function flushMutagens(state) {
  const s = clone(state);
  const flushed = (s.mutagensActive || []).length;
  s.mutagensActive = [];
  return { state: s, success: true, flushed };
}

// Hybrid Transformation (Lycan 3rd): Bonus Action, transform up to 1 hour.
export function useHybridTransformation(state, { level }) {
  const s = clone(state);
  const l = clampLevel(level);
  const max = hybridTransformationUsesMax(l);
  if (max === 0) return { state: s, success: false, reason: 'level_too_low' };
  if (!Number.isFinite(max)) {
    // 18th: unlimited — usesLeft stays null (stored) / untouched.
    s.hybridUsesMax = null; s.hybridUsesLeft = null;
    return { state: s, success: true, usesLeft: null };
  }
  if (!s.hybridUsesMax) { s.hybridUsesMax = max; s.hybridUsesLeft = max; }
  if (s.hybridUsesLeft > s.hybridUsesMax) s.hybridUsesLeft = s.hybridUsesMax;
  if (s.hybridUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.hybridUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.hybridUsesLeft };
}

// Aether Walk (Ghostslayer 7th): 1/rest, twice between rests at 15th.
export function useAetherWalk(state, { level }) {
  const s = clone(state);
  const l = clampLevel(level);
  const max = aetherWalkUsesMax(l);
  if (max === 0) return { state: s, success: false, reason: 'level_too_low' };
  if (!s.aetherWalkUsesMax) { s.aetherWalkUsesMax = max; s.aetherWalkUsesLeft = max; }
  if (s.aetherWalkUsesLeft > s.aetherWalkUsesMax) s.aetherWalkUsesLeft = s.aetherWalkUsesMax;
  if (s.aetherWalkUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.aetherWalkUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.aetherWalkUsesLeft };
}

// Rite Revival (18th): at 0 HP (not dead outright), end all active rites and
// drop to 1 HP instead. Once per Long Rest. Requires at least one active rite.
export function useRiteRevival(state, { level }) {
  const s = clone(state);
  if (clampLevel(level) < 18) return { state: s, success: false, reason: 'level_too_low' };
  if (s.riteRevivalUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  if (!(s.activeRites || []).length) return { state: s, success: false, reason: 'no_active_rite' };
  const ritesEnded = s.activeRites.length;
  s.activeRites = [];
  s.riteRevivalUsed = true;
  return { state: s, success: true, ritesEnded };
}

// Strange Metabolism (Mutant 7th): Bonus Action, ignore one active mutagen's
// side effect for 1 minute. Once per Long Rest.
export function useStrangeMetabolism(state, { level }) {
  const s = clone(state);
  if (clampLevel(level) < 7) return { state: s, success: false, reason: 'level_too_low' };
  if (s.strangeMetabolismUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.strangeMetabolismUsed = true;
  return { state: s, success: true };
}

// Exalted Mutation (Mutant 18th): Bonus Action, end one active mutagen and
// immediately gain a different known mutagen in its place. Int mod uses
// (min 1), Long Rest only.
export function useExaltedMutation(state, { level, intMod, fromFormula, toFormula }) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 18) return { state: s, success: false, reason: 'level_too_low' };
  const max = exaltedMutationUsesMax(intMod);
  if (!s.exaltedMutationUsesMax) { s.exaltedMutationUsesMax = max; s.exaltedMutationUsesLeft = max; }
  if (s.exaltedMutationUsesLeft > s.exaltedMutationUsesMax) s.exaltedMutationUsesLeft = s.exaltedMutationUsesMax;
  if (s.exaltedMutationUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  const fromIdx = (s.mutagensActive || []).findIndex((m) => String(m).toLowerCase() === String(fromFormula || '').trim().toLowerCase());
  if (fromIdx < 0) return { state: s, success: false, reason: 'mutagen_not_active' };
  const to = formulaByName(toFormula);
  if (!to) return { state: s, success: false, reason: 'unknown_formula' };
  if (l < to.prerequisiteLevel) return { state: s, success: false, reason: 'formula_prerequisite_not_met' };
  if (String(fromFormula).trim().toLowerCase() === to.name.toLowerCase()) {
    return { state: s, success: false, reason: 'same_mutagen' };
  }
  s.mutagensActive.splice(fromIdx, 1);
  s.mutagensActive = [...s.mutagensActive, to.name];
  s.exaltedMutationUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.exaltedMutationUsesLeft };
}

// Amplify Blood Curse of the Soul Eater (Profane Soul 18th): regain an
// expended Pact Magic slot. Once amplified, must finish a Long Rest before
// amplifying again. (The slot itself is restored by the caller — this
// function owns only the once-per-long-rest flag.)
export function amplifySoulEater(state, { level }) {
  const s = clone(state);
  if (clampLevel(level) < 18) return { state: s, success: false, reason: 'level_too_low' };
  if (s.soulEaterAmplifyUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.soulEaterAmplifyUsed = true;
  return { state: s, success: true };
}

// --- Rests (pure; { state, success }) -------------------------------------------
// Both rests: rites end, Maledict refills, unconsumed mutagens go inert,
// active mutagen effects end, Hybrid + Aether Walk refill.
// Long rest only: Rite Revival / Strange Metabolism / Soul Eater flags clear,
// Exalted Mutation refills. (PDF-verified per the design §3.4 table.)
function applyRest(state, opts, isLong) {
  const s = clone(state);
  const level = clampLevel(opts.level);
  const subclass = opts.subclass || null;
  // Maledict refill uses the POST-rest Vermillion status: the mutagen's
  // effects end at this rest, so its +1 use does not survive it (Muse call).
  const vermillionActive = false;
  const maledictMax = bloodMaledictUsesMax(level, { subclass, vermillionActive });
  s.activeRites = [];
  s.maledictUsesMax = maledictMax;
  s.maledictUsesLeft = maledictMax;
  s.mutagensConcocted = [];
  s.mutagensActive = [];
  const hybridMax = hybridTransformationUsesMax(level);
  s.hybridUsesMax = Number.isFinite(hybridMax) ? hybridMax : null;
  s.hybridUsesLeft = Number.isFinite(hybridMax) ? hybridMax : null;
  const aetherMax = aetherWalkUsesMax(level);
  s.aetherWalkUsesMax = aetherMax;
  s.aetherWalkUsesLeft = aetherMax;
  if (isLong) {
    s.riteRevivalUsed = false;
    s.strangeMetabolismUsed = false;
    const exaltedMax = exaltedMutationUsesMax(opts.intMod);
    s.exaltedMutationUsesMax = exaltedMax;
    s.exaltedMutationUsesLeft = exaltedMax;
    s.soulEaterAmplifyUsed = false;
  }
  return { state: s, success: true };
}
export function onLongRest(state, opts = {}) {
  return applyRest(state, opts, true);
}
export function onShortRest(state, opts = {}) {
  return applyRest(state, opts, false);
}

// --- DM prompt section ----------------------------------------------------------
// Same shape as spellshotPromptSection: one header line, then one line per
// live number. Never crashes on an empty/null state.
export function bloodHunterPromptSection(state, { level, intMod, name, subclass } = {}) {
  const s = state || defaultBloodHunterState();
  const l = clampLevel(level);
  const die = hemocraftDieForLevel(l);
  const maledictMax = bloodMaledictUsesMax(l, { subclass, vermillionActive: isVermillionActive(s) });
  const maledictLeft = s.maledictUsesMax ? s.maledictUsesLeft : maledictMax;
  const hybridMax = hybridTransformationUsesMax(l);
  const hybridLeft = s.hybridUsesMax === null ? 'unlimited' : (s.hybridUsesMax ? s.hybridUsesLeft : hybridMax);
  const aetherMax = aetherWalkUsesMax(l);
  const aetherLeft = s.aetherWalkUsesMax ? s.aetherWalkUsesLeft : aetherMax;
  const exaltedMax = exaltedMutationUsesMax(intMod);
  const exaltedLeft = s.exaltedMutationUsesMax ? s.exaltedMutationUsesLeft : exaltedMax;
  const header = name
    ? `Blood Hunter ${name} (level ${l}, Int mod ${intMod}, Hemocraft die ${die}):`
    : `Blood Hunter (level ${l}, Int mod ${intMod}, Hemocraft die ${die}):`;
  const lines = [header];
  const rites = (s.activeRites || []).map((r) => `${r.weapon}: ${r.rite} (${r.damageType})`).join('; ') || 'none';
  lines.push(`- Crimson Rite: active rites: ${rites} (extra ${die} damage on hits with the rite weapon; activating a rite costs ${die} Necrotic to self${l >= 5 ? `, reduced by Int mod (${clampMod(intMod)}, min 1 damage, Rite Focus)` : ', unreducible'})`);
  lines.push(`- Blood Maledict uses left: ${maledictLeft}/${maledictMax} (refill on a Short or Long Rest; Ghostslayer Curse Specialist +1, Vermillion mutagen +1)`);
  lines.push(`- Blood Curses known: ${(s.cursesKnown || []).length}/${bloodCursesKnownForLevel(l)}${(s.cursesKnown || []).length ? ` (${(s.cursesKnown || []).join(', ')})` : ''} (order-granted curses do not count)`);
  lines.push(`- Mutagens concocted: ${(s.mutagensConcocted || []).join(', ') || 'none'} (${(s.mutagensConcocted || []).length}/${mutagensCreatedForLevel(l)} per rest); active: ${(s.mutagensActive || []).join(', ') || 'none'} (effects last until a Short or Long Rest)`);
  if (l >= 3) lines.push(`- Hybrid Transformation uses left: ${hybridLeft}${Number.isFinite(hybridMax) ? `/${hybridMax}` : ' (unlimited at 18th)'} (refill on a Short or Long Rest)`);
  if (l >= 7) lines.push(`- Aether Walk uses left: ${aetherLeft}/${aetherMax} (1/rest, twice at 15th)`);
  if (l >= 7) lines.push(`- Strange Metabolism: ${s.strangeMetabolismUsed ? 'used' : 'available'} (ignore one mutagen side effect for 1 minute, once per Long Rest)`);
  if (l >= 18) {
    lines.push(`- Rite Revival: ${s.riteRevivalUsed ? 'used' : 'available'} (at 0 HP, end all active rites and drop to 1 HP instead, once per Long Rest)`);
    lines.push(`- Exalted Mutation uses left: ${exaltedLeft}/${exaltedMax} (swap one active mutagen for another, Long Rest only)`);
    lines.push(`- Soul Eater amplify: ${s.soulEaterAmplifyUsed ? 'used' : 'available'} (amplify regains a Pact Magic slot, once per Long Rest)`);
  }
  return lines.join('\n');
}

// --- DB helpers (own full parse; never parseClassResources) ----------------------
// Blackguard pattern: load/save take an optional injected db client or
// dynamic-import '../database.js' and degrade gracefully when unavailable.
function tableFor(kind) {
  return kind === 'companion' ? 'companions' : 'characters';
}
function parseAllResources(raw) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
async function resolveDb(dbClient) {
  if (dbClient && dbClient.dbGet && dbClient.dbRun) return dbClient;
  try {
    const db = await import('../database.js');
    return { dbGet: db.dbGet, dbRun: db.dbRun };
  } catch {
    return null;
  }
}
export async function loadBloodHunterState(kind, id, dbClient) {
  try {
    const db = await resolveDb(dbClient);
    if (!db) return defaultBloodHunterState();
    const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultBloodHunterState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.blood_hunter ? { ...defaultBloodHunterState(), ...resources.blood_hunter } : defaultBloodHunterState();
  } catch {
    return defaultBloodHunterState();
  }
}
export async function saveBloodHunterState(kind, id, bloodHunterState, dbClient) {
  const db = await resolveDb(dbClient);
  if (!db) return false;
  const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.blood_hunter = bloodHunterState;
  await db.dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

export default {
  PRIMAL_RITES, ESOTERIC_RITES, RITE_DAMAGE_TYPE, ALL_RITES, MUTAGEN_FORMULAS,
  hemocraftDieForLevel, bloodMaledictUsesMax, bloodCursesKnownForLevel,
  ritesKnownForLevel, mutagenFormulasKnownForLevel, mutagensCreatedForLevel,
  hybridTransformationUsesMax, aetherWalkUsesMax, exaltedMutationUsesMax,
  defaultBloodHunterState, activateRite, endRite, useBloodMaledict,
  concoctMutagen, consumeMutagen, flushMutagens, useHybridTransformation,
  useAetherWalk, useRiteRevival, useStrangeMetabolism, useExaltedMutation,
  amplifySoulEater, onLongRest, onShortRest, bloodHunterPromptSection,
  loadBloodHunterState, saveBloodHunterState,
};
