// Warlord class service — base class + Presence progression (state + rest).
//
// Source: KibblesTasty Warlord v1.5 (16 pp — the PDF wins on any disagreement
// with the registry or the client). NO conversion applied.
// Registry: server/data/subclasses/warlord.js (8 Presences, 64 features).
//
// Shape: modeled exactly on the eight existing new-class services
// (artificer / magus / spellshot / warden / blackguard / pugilist / scholar /
// duelist): pure-math tables + defaultWarlordState() + load/save +
// spend/use functions returning { state, success, reason } + pure
// onLongRest/onShortRest + warlordPromptSection. No marker handlers in v1
// (a later marker job wires the pure functions without rewriting math).
//
// Leadership Dice math is NOT reimplemented here: leadershipDice() already
// exists in subclassService.js (count = level; die d6/d8/d10/d12 at
// 2nd/9th/13th/17th; per-turn limit 1/2/3/4 at 2nd/6th/11th/17th; Noble +1/+2/+3
// dice at 3rd/9th/15th) and is imported. This service is its first production
// caller. Dice-as-slot casting, Battlefield Presence, and all 69 subclass
// features stay registry + DM-prompt in v1 — the pool lives here, each spend
// is DM-adjudicated from the prompt section.
//
// v1 SCOPE (design, Job 6): the pool, the once-per-rest flags, the rest
// resets, the Packleader Wilds spell list (preserved, never wiped), and the
// base maneuver text (Rallying Mark / Urgent Orders / Helpful Word have no
// registry entry, so the prompt section carries them, paraphrased in the
// app's own wording — never verbatim book prose).
//
// DESIGN CORRECTIONS applied while building (PDF-verified, not guesses):
// - Booming Shout (Chieftain) is 15th level, not 7th — PDF "Starting at 15th
//   level" + registry warlord-subclasses.js:180 (level 15). The design file
//   §4.4 said "(Chieftain 7th)"; useBoomingShout refuses below 15th.
// - Demoralization Dice gain: whenever you SPEND a Leadership Die you gain
//   a Demoralization Die of equal size (PDF + registry
//   warlord-subclasses.js:602). The design file §4.1 said "on a crit or a
//   kill" — wrong; spendLeadershipDie gains the die, and
//   gainDemoralizationDie exists for DM-driven bookkeeping.
// - Grand Decree (Noble) is 18th level (registry:269); Supernatural Dread's
//   fear option rides the 7th-level feature (PDF: "Starting at 7th level").
// - Max fields stored alongside uses-left (leadershipDiceMax,
//   bloodyVictoryUsesMax): the blackguard precedent (useVileTouch
//   lazy-inits vileTouchUsesMax/Left). Without them a fresh character who
//   has never rested could never spend, and a spent-to-zero pool would be
//   indistinguishable from never-initialized and refill for free.
// - Subclass gates on use-functions: when opts.subclass is supplied and does
//   not match the feature's Presence, the call refuses ('wrong_subclass').
//   When it is absent (unknown), the call is allowed and the DM adjudicates
//   — the rest dispatcher always passes the subclass, so the real path is
//   enforced; direct calls without one are DM-adjudicated, not silently
//   widened. Recorded here, not hidden.
// - No MULTICLASS_GRANT export: WARLORD_MULTICLASS_GRANT lives in
//   levelProgression.js (added by the multiclass-removal job #9, single
//   source of truth); this service does not duplicate it. The PDF prints
//   Light + Medium armor as the multiclass proficiencies — #9's grant
//   matches ({ hitDie: 8, armor: ['light', 'medium'] }).

import { leadershipDice } from './subclassService.js';

const clampLevel = (level) => Math.min(20, Math.max(1, Math.trunc(level) || 1));
const clampMod = (mod) => Math.trunc(mod) || 0;
const clone = (state) => JSON.parse(JSON.stringify(state || defaultWarlordState()));

function normalizeSubclass(subclass) {
  // Order matters: strip "'s presence" BEFORE stripping apostrophes —
  // "Dreadlord's Presence" must normalize to "dreadlord", not "dreadlords"
  // (fixed 2026-11-09 during test verification; the old order broke every
  // registry-form presence name with an apostrophe).
  return String(subclass || '').toLowerCase().replace(/'s presence/g, '').replace(/ presence/g, '').replace(/'/g, '').replace(/[^a-z]/g, '');
}
// Subclass gate: null/empty subclass = unknown, allowed (DM adjudicates);
// a supplied non-matching subclass refuses. See header.
function subclassMatches(subclass, ...names) {
  const norm = normalizeSubclass(subclass);
  if (!norm) return true;
  return names.some((n) => normalizeSubclass(n) === norm);
}

// --- Base maneuvers (PDF, Leadership Dice feature, paraphrased) ----------------
// No registry entry exists for these three L2 features, so the prompt section
// carries them. Wording is the app's own; the mechanics are the PDF's.
export const BASE_MANEUVERS = {
  rallyingMark: 'Rallying Mark (bonus action): spend Leadership Dice (up to your per-turn limit) to rally allies against a hostile creature within 60 ft; the next time an ally damages that target before the start of your next turn, they add the dice to the damage roll and regain HP equal to the amount rolled.',
  urgentOrders: 'Urgent Orders (bonus action): spend Leadership Dice (up to your per-turn limit) to guide an ally within 60 ft that can see or hear you; it immediately uses its reaction to move up to its speed (max 30 ft) without provoking opportunity attacks, and gains temp HP equal to the dice rolled.',
  helpfulWord: 'Helpful Word (bonus action): spend 1 Leadership Die to take the Help action; when aiding an ally\'s attack, the target can be within 30 ft of you (not 5 ft) if your ally can see or hear you.',
};

// --- Pure math ------------------------------------------------------------------

// Leadership Dice maxima come from subclassService.leadershipDice — never
// reimplemented here. Thin wrappers so callers read one module.
export function leadershipDiceMax(level, subclassName) {
  return leadershipDice(level, subclassName);
}

// Bloody Victory uses (Chieftain 18th, registry:188): Cha mod, long rest only.
export function bloodyVictoryUsesMax(chaMod, level) {
  if (clampLevel(level) < 18) return 0;
  return Math.max(0, clampMod(chaMod));
}

// --- State ----------------------------------------------------------------------

export function defaultWarlordState() {
  return {
    leadershipDiceLeft: 0,
    leadershipDiceMax: 0,
    demoralizationDice: 0,      // Dreadlord only; 1-minute expiry — DM-tracked in v1
    boomingShoutUsed: false,    // once until short or long rest (Chieftain 15th)
    standDefiantUsed: false,    // once until short or long rest (Paragon 7th)
    dauntlessResolveUsed: false,// once until long rest (Paragon 15th)
    grandDecreeUsed: false,     // once per long rest (Noble 18th)
    bloodyVictoryUsesLeft: 0,   // Cha mod, long rest only (Chieftain 18th)
    bloodyVictoryUsesMax: 0,
    dreadFearUsed: false,       // Supernatural Dread fear option, once until long rest (Dreadlord 7th)
    warlordOfTheWildsSpells: [],// Packleader 18th — five Druid spells (≤4th); changeable on a long rest; hook never wipes
    packleaderCantrip: null,    // open pick, free text (validating vs the Druid list is a follow-up)
    packleaderSpell: null,      // open pick, free text (same)
  };
}

// --- Spend / use (pure; { state, success, reason }) ------------------------------

// Spend Leadership Dice (2nd). Validates against the pool AND the per-turn
// limit: spentThisTurn is the dice already spent this turn (turn-ledger
// concern — the caller/DM tracks it; v1 takes it as an argument).
// Dreadlord: spending a Leadership Die gains a Demoralization Die of equal
// size (PDF) — applied here, so the gain can never be forgotten.
export function spendLeadershipDie(state, { count = 1, level, subclassName, spentThisTurn = 0 } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  const pool = leadershipDice(l, subclassName);
  const n = Math.trunc(count) || 0;
  if (n < 1) return { state: s, success: false, reason: 'invalid_count' };
  if (pool.count === 0) return { state: s, success: false, reason: 'level_too_low' };
  if (!s.leadershipDiceMax) { s.leadershipDiceMax = pool.count; s.leadershipDiceLeft = pool.count; }
  if (s.leadershipDiceLeft > s.leadershipDiceMax) s.leadershipDiceLeft = s.leadershipDiceMax;
  if (n > s.leadershipDiceLeft) return { state: s, success: false, reason: 'no_dice_left' };
  if ((Math.trunc(spentThisTurn) || 0) + n > pool.perTurnLimit) {
    return { state: s, success: false, reason: 'per_turn_limit' };
  }
  s.leadershipDiceLeft -= n;
  let demoralizationGained = 0;
  if (normalizeSubclass(subclassName) === 'dreadlord' && l >= 3) {
    s.demoralizationDice = (s.demoralizationDice || 0) + n;
    demoralizationGained = n;
  }
  return { state: s, success: true, diceLeft: s.leadershipDiceLeft, demoralizationGained };
}

// Battlefield Grace (Dancer 7th): whenever a creature misses you with an
// attack, regain 1 spent Leadership Die and move 5 ft. Cannot regain again
// until the start of your next turn — that window is DM-tracked in v1.
// (Registry + PDF: Dancer's Presence, 7th — NOT Paragon; corrected
// 2026-11-09 during test verification. The design file §4 said Paragon.)
export function regainLeadershipDie(state, { level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 7) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'dancer')) return { state: s, success: false, reason: 'wrong_subclass' };
  const pool = leadershipDice(l, subclassName);
  if (!s.leadershipDiceMax) { s.leadershipDiceMax = pool.count; s.leadershipDiceLeft = pool.count; }
  if (s.leadershipDiceLeft >= s.leadershipDiceMax) return { state: s, success: false, reason: 'no_spent_dice' };
  s.leadershipDiceLeft += 1;
  return { state: s, success: true, diceLeft: s.leadershipDiceLeft };
}

// Demoralization Dice (Dreadlord 3rd): gain one whenever you spend a
// Leadership Die (applied automatically by spendLeadershipDie); this
// function is the explicit bookkeeping entry for DM-driven gains.
export function gainDemoralizationDie(state, { count = 1, level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 3) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'dreadlord')) return { state: s, success: false, reason: 'wrong_subclass' };
  const n = Math.trunc(count) || 0;
  if (n < 1) return { state: s, success: false, reason: 'invalid_count' };
  s.demoralizationDice = (s.demoralizationDice || 0) + n;
  return { state: s, success: true, demoralizationDice: s.demoralizationDice };
}

// Spend Demoralization Dice as a reaction (Dreadlord): Make it Excruciating /
// Don't Touch That / Are You Sure? — the effect is DM-adjudicated; this
// function owns the count and the per-turn limit only.
export function spendDemoralizationDie(state, { count = 1, level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 3) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'dreadlord')) return { state: s, success: false, reason: 'wrong_subclass' };
  const pool = leadershipDice(l, subclassName);
  const n = Math.trunc(count) || 0;
  if (n < 1) return { state: s, success: false, reason: 'invalid_count' };
  if (n > (s.demoralizationDice || 0)) return { state: s, success: false, reason: 'no_dice_left' };
  if (n > pool.perTurnLimit) return { state: s, success: false, reason: 'per_turn_limit' };
  s.demoralizationDice -= n;
  return { state: s, success: true, demoralizationDice: s.demoralizationDice };
}

function useOnceFlag(state, { level, subclassName, requiredLevel, subclasses, flag }) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < requiredLevel) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, ...subclasses)) return { state: s, success: false, reason: 'wrong_subclass' };
  if (s[flag]) return { state: s, success: false, reason: 'already_used_this_rest' };
  s[flag] = true;
  return { state: s, success: true };
}

// Booming Shout (Chieftain 15th): when you unleash your Warcry, creatures of
// your choice in range save (Wis, DC 8 + Cha + PB) or are Frightened until the
// end of their turn. Once until a short or long rest. Also doubles the range
// of Rallying Mark, Urgent Orders, Helpful Word, and Warcry.
export function useBoomingShout(state, opts = {}) {
  return useOnceFlag(state, { ...opts, requiredLevel: 15, subclasses: ['chieftain'], flag: 'boomingShoutUsed' });
}

// Stand Defiant (Paragon 7th): at 0 HP, instantly regain Cha mod (min 1) HP,
// plus Leadership Dice equal to friendly creatures within 60 ft (rolled for
// extra HP — the dice spend is DM-adjudicated from the prompt). Once until a
// short or long rest.
export function useStandDefiant(state, opts = {}) {
  return useOnceFlag(state, { ...opts, requiredLevel: 7, subclasses: ['paragon'], flag: 'standDefiantUsed' });
}

// Dauntless Resolve (Paragon 15th): when you fail a saving throw, choose to
// succeed instead. Once until a long rest.
export function useDauntlessResolve(state, opts = {}) {
  return useOnceFlag(state, { ...opts, requiredLevel: 15, subclasses: ['paragon'], flag: 'dauntlessResolveUsed' });
}

// Grand Decree (Noble 18th): cast command without a slot or Leadership Dice,
// affecting all creatures of your choice in range. Once per long rest.
export function useGrandDecree(state, opts = {}) {
  return useOnceFlag(state, { ...opts, requiredLevel: 18, subclasses: ['noble'], flag: 'grandDecreeUsed' });
}

// Bloody Victory (Chieftain 18th): reaction Warcry when you or an ally drops
// a hostile creature that dealt damage to you to 0 HP. No Leadership Dice
// spent; d12 in place of the Leadership Die. Cha mod uses, long rest only.
export function useBloodyVictory(state, { chaMod, level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 18) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'chieftain')) return { state: s, success: false, reason: 'wrong_subclass' };
  const max = bloodyVictoryUsesMax(chaMod, l);
  if (!s.bloodyVictoryUsesMax) { s.bloodyVictoryUsesMax = max; s.bloodyVictoryUsesLeft = max; }
  if (s.bloodyVictoryUsesLeft > s.bloodyVictoryUsesMax) s.bloodyVictoryUsesLeft = s.bloodyVictoryUsesMax;
  if (s.bloodyVictoryUsesLeft <= 0) return { state: s, success: false, reason: 'no_uses_left' };
  s.bloodyVictoryUsesLeft -= 1;
  return { state: s, success: true, usesLeft: s.bloodyVictoryUsesLeft };
}

// Supernatural Dread fear option (Dreadlord 7th): spend 3 Leadership Dice
// (even if it exceeds the per-turn limit) to cast fear without a slot or
// material component, once until a long rest. The dice themselves are spent
// by the caller via spendLeadershipDie; this function owns only the
// once-per-long-rest flag. (The frighten casting at 7th has no flag — it
// spends dice like any other maneuver.)
export function useSupernaturalDreadFear(state, { level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 7) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'dreadlord')) return { state: s, success: false, reason: 'wrong_subclass' };
  if (s.dreadFearUsed) return { state: s, success: false, reason: 'already_used_this_rest' };
  s.dreadFearUsed = true;
  return { state: s, success: true };
}

// Warlord of the Wilds (Packleader 18th): pick five Druid spells (4th level
// or lower); cast them with Leadership Dice equal to the spell's level. The
// list may change on a long rest — the hook preserves it; this function is
// how the list is set. Validating the picks against the Druid list is a
// follow-up, not v1 (free-text names, max five).
export function setWarlordOfTheWildsSpells(state, { spells, level, subclassName } = {}) {
  const s = clone(state);
  const l = clampLevel(level);
  if (l < 18) return { state: s, success: false, reason: 'level_too_low' };
  if (!subclassMatches(subclassName, 'packleader')) return { state: s, success: false, reason: 'wrong_subclass' };
  const list = (spells || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (list.length > 5) return { state: s, success: false, reason: 'too_many_spells' };
  s.warlordOfTheWildsSpells = list;
  return { state: s, success: true, spells: list };
}

// Packleader open picks (Nature's Gift, 3rd): one extra Druid cantrip + one
// extra 1st-level Druid spell, player-chosen. Free text in v1.
export function setPackleaderPicks(state, { cantrip, spell } = {}) {
  const s = clone(state);
  if (cantrip !== undefined) s.packleaderCantrip = String(cantrip || '').trim() || null;
  if (spell !== undefined) s.packleaderSpell = String(spell || '').trim() || null;
  return { state: s, success: true };
}

// --- Rests (pure; { state, success }) -------------------------------------------
// Both rests: Leadership Dice refill to max; Booming Shout + Stand Defiant
// clear. Long rest only: Bloody Victory refills (Cha mod); Dauntless Resolve
// + Grand Decree + Dread fear clear. Warlord of the Wilds list + Packleader
// picks are NEVER wiped; Demoralization Dice are untouched (1-minute expiry,
// not rest). (PDF + registry-verified per the design §4.4 table.)
function applyRest(state, opts, isLong) {
  const s = clone(state);
  const level = clampLevel(opts.level);
  const pool = leadershipDice(level, opts.subclass);
  s.leadershipDiceMax = pool.count;
  s.leadershipDiceLeft = pool.count;
  s.boomingShoutUsed = false;
  s.standDefiantUsed = false;
  if (isLong) {
    const bvMax = bloodyVictoryUsesMax(opts.chaMod, level);
    s.bloodyVictoryUsesMax = bvMax;
    s.bloodyVictoryUsesLeft = bvMax;
    s.dauntlessResolveUsed = false;
    s.grandDecreeUsed = false;
    s.dreadFearUsed = false;
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
// live number, then the base maneuver text (no registry entry exists for it).
// Never crashes on an empty/null state.
export function warlordPromptSection(state, { level, chaMod, name, subclass } = {}) {
  const s = state || defaultWarlordState();
  const l = clampLevel(level);
  const pool = leadershipDice(l, subclass);
  const diceLeft = s.leadershipDiceMax ? s.leadershipDiceLeft : pool.count;
  const header = name
    ? `Warlord ${name} (level ${l}, Cha mod ${chaMod}${subclass ? `, ${subclass}` : ''}):`
    : `Warlord (level ${l}, Cha mod ${chaMod}${subclass ? `, ${subclass}` : ''}):`;
  const lines = [header];
  lines.push(`- Leadership Dice: ${diceLeft}/${pool.count} (d${pool.die}, up to ${pool.perTurnLimit} per turn; regain all on a Short or Long Rest)`);
  lines.push(`- ${BASE_MANEUVERS.rallyingMark}`);
  lines.push(`- ${BASE_MANEUVERS.urgentOrders}`);
  lines.push(`- ${BASE_MANEUVERS.helpfulWord}`);
  if (normalizeSubclass(subclass) === 'dreadlord' && l >= 3) {
    lines.push(`- Demoralization Dice: ${s.demoralizationDice || 0} (d${pool.die}; gain one whenever you spend a Leadership Die; last until 1 minute without earning or spending one; spend as a reaction — Make it Excruciating / Don't Touch That / Are You Sure?, up to ${pool.perTurnLimit} dice)`);
  }
  if (l >= 7) lines.push(`- Stand Defiant: ${s.standDefiantUsed ? 'used' : 'available'} (at 0 HP, regain Cha mod HP + Leadership Dice for allies within 60 ft, once until a short or long rest)`);
  if (l >= 7) lines.push(`- Battlefield Grace: regain 1 spent Leadership Die when a creature misses you (once until the start of your next turn)`);
  if (l >= 7) lines.push(`- Supernatural Dread: cast frighten with Leadership Dice (spell level = dice spent); fear option (spend 3 dice): ${s.dreadFearUsed ? 'used' : 'available'} (once per Long Rest; frighten is not in the spell catalog — DM adjudicates)`);
  if (l >= 15) {
    lines.push(`- Booming Shout: ${s.boomingShoutUsed ? 'used' : 'available'} (Warcry frightens chosen creatures in range until the end of their turn, Wis save; once until a short or long rest; doubles Rallying Mark / Urgent Orders / Helpful Word / Warcry range)`);
    lines.push(`- Dauntless Resolve: ${s.dauntlessResolveUsed ? 'used' : 'available'} (fail a save → choose to succeed instead, once per Long Rest)`);
  }
  if (l >= 18) {
    const bvMax = bloodyVictoryUsesMax(chaMod, l);
    const bvLeft = s.bloodyVictoryUsesMax ? s.bloodyVictoryUsesLeft : bvMax;
    lines.push(`- Bloody Victory uses left: ${bvLeft}/${bvMax} (reaction Warcry when you or an ally drops a hostile creature that damaged you to 0 HP; no dice spent, d12 in place of the Leadership Die; Long Rest only)`);
    lines.push(`- Grand Decree: ${s.grandDecreeUsed ? 'used' : 'available'} (cast command without a slot or dice, affecting all creatures of your choice in range, once per Long Rest)`);
    if ((s.warlordOfTheWildsSpells || []).length) {
      lines.push(`- Warlord of the Wilds spells: ${(s.warlordOfTheWildsSpells || []).join(', ')} (cast with Leadership Dice equal to the spell's level; change the list on a Long Rest)`);
    }
  }
  if (s.packleaderCantrip || s.packleaderSpell) {
    lines.push(`- Packleader picks: cantrip ${s.packleaderCantrip || '—'}, spell ${s.packleaderSpell || '—'}`);
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
export async function loadWarlordState(kind, id, dbClient) {
  try {
    const db = await resolveDb(dbClient);
    if (!db) return defaultWarlordState();
    const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
    if (!row) return defaultWarlordState();
    const resources = parseAllResources(row.class_resources_json);
    return resources.warlord ? { ...defaultWarlordState(), ...resources.warlord } : defaultWarlordState();
  } catch {
    return defaultWarlordState();
  }
}
export async function saveWarlordState(kind, id, warlordState, dbClient) {
  const db = await resolveDb(dbClient);
  if (!db) return false;
  const row = await db.dbGet(`SELECT class_resources_json FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const resources = parseAllResources(row ? row.class_resources_json : null);
  resources.warlord = warlordState;
  await db.dbRun(`UPDATE ${tableFor(kind)} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
  return true;
}

export default {
  BASE_MANEUVERS, leadershipDiceMax, bloodyVictoryUsesMax,
  defaultWarlordState, spendLeadershipDie, regainLeadershipDie,
  gainDemoralizationDie, spendDemoralizationDie, useBoomingShout,
  useStandDefiant, useDauntlessResolve, useGrandDecree, useBloodyVictory,
  useSupernaturalDreadFear, setWarlordOfTheWildsSpells, setPackleaderPicks,
  onLongRest, onShortRest, warlordPromptSection, loadWarlordState,
  saveWarlordState,
};
