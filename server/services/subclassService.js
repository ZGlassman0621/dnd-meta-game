/**
 * Subclass Service — Tier 0 (subclass wiring proof batch).
 *
 * Pure lookups over the subclass data in server/data/subclasses/,
 * in the same registry pattern as server/data/featRegistry.js:
 * normalized-name lookup, a single source of truth for the DM
 * prompt, no database access, no session state. Anything that
 * needs a session (spending a resource, adding a feat to a row)
 * lives in the caller, not here — so this module is testable
 * without a database and cannot silently change game state.
 *
 * Tier 0 covered exactly two subclasses: Champion (Fighter) and
 * Life Domain (Cleric). Batch 1 adds Barbarian (4), Fighter (3
 * remaining), Monk (4), and Rogue (4). Batch 2 adds Cleric (3
 * remaining), Wizard (4), and Warlock (4). Batch 3 adds Bard (4),
 * Sorcerer (4), and Paladin (4). Batch 4 adds Druid (4) and
 * Ranger (4) — the LAST PHB batch, completing all 48 PHB 2024
 * subclasses. Batch 4 was NOT authored from the "PHB 2024
 * Classes Pt1/Pt2" scans: those files are the 2014 PHB, Chapter
 * 3 (see druid.js/ranger.js headers), so Batch 4 numbers are
 * gateCheck, cross-checked against secondary 2024 summaries.
 * Scanned Batch S1 adds Xanathar part 1 (Barbarian 2, Bard 2,
 * Cleric 2, Druid 2, Fighter 3 — 11 new, registry 48 -> 59).
 * These are 2014-era entries converted onto the built 2024
 * class cadences (see each entry's conversionCheck); no 2024
 * reprint exists for any of them, so every S1 number is
 * conversionCheck + gateCheck. No new class file is indexed
 * (all five classes were already in the index).
 * Scanned Batch S2 adds Xanathar part 2, completing Xanathar
 * (Monk 3, Paladin 2, Ranger 2, Rogue 4, Sorcerer 3, Warlock 1,
 * Wizard 1 — 16 new, registry 59 -> 75). Same conversion rule as
 * S1: 2014 grant points are re-pointed onto the built 2024 class
 * cadences (see each entry's conversionCheck); no 2024 reprint
 * exists for any of them, so every S2 number is conversionCheck
 * + gateCheck. No new class file is indexed (all seven classes
 * were already in the index).
 * Scanned Batch S3 adds outside-FR scanned subclasses (Wildemount
 * 3, Ravnica 2, Theros Eloquence 1 — 6 new, registry 75 -> 81).
 * Outside-FR entries carry origin_setting/origin_region and require
 * an origin explanation (validateSelection already enforces this);
 * concepts are kept as themselves, not reskinned (plan section 12).
 * No new class file is indexed (all five classes were already in
 * the index).
 * Scanned Batch S4 adds Hoard of Heroes (third-party/homebrew,
 * Zach: ABSOLUTELY NECESSARY — 13 new, registry 81 -> 94):
 * Barbarian Path of the Mountain, Bard College of Mirrors, Cleric
 * Revelry Domain, Druid Circle of Sand, Fighter Monster Hunter,
 * Monk Warrior of Waves (source: Way of Waves), Paladin Oath of
 * Resolve, Ranger Stone Singer, Rogue Slider, Sorcerer Planar
 * Magic, Warlock The Ancient Dragon + The Beholder, Wizard Hedge
 * Mage. 2014-pattern grants are converted onto the built 2024
 * cadences (see each entry's conversionCheck); no 2024 reprint
 * exists for any of them, so every S4 number is conversionCheck +
 * gateCheck. Origins are Forgotten Realms except Warrior of
 * Waves, whose source places it with the sea elves of
 * Deva'lamirusandia (a Hoard-invented coast, flagged for Zach).
 * No new class file is indexed (all twelve classes were already
 * in the index). Hoard Eldritch Invocations tied to the two new
 * patrons are a separate feature system and are NOT wired here.
 * Scanned Batch S5 adds Heroes of Faerûn (2024-era, Forgotten
 * Realms — 8 new, registry 94 -> 102, completing the authorized
 * set): Bard College of the Moon, Cleric Knowledge Domain,
 * Fighter Banneret, Paladin Oath of the Noble Genies, Ranger
 * Winter Walker, Rogue Scion of the Three, Sorcerer Spellfire
 * Sorcery, Wizard Bladesinger. Heroes grants coincide exactly
 * with the built 2024 class cadences (see each entry's
 * conversionCheck); no feature was re-pointed. Mechanics are
 * paraphrased from the Heroes of Faerûn text extract on the Mac
 * (660,813 bytes); every S5 number is gateCheck for Zach.
 * Warlord batch (2026-11-06, gaps-batch item 8b) adds the 8
 * KibblesTasty Warlord v1.5 Presences (registry 169 -> 177):
 * Commander, Chieftain, Noble, Packleader, Paragon, Tactician,
 * plus the PDF's two Expanded Options, Dancer and Dreadlord
 * [Beta] (expanded: true; Dreadlord also beta: true). Transcribed
 * from the Mac PDF ("5e - Warlord (KibblesTasty) _ GM Binder.pdf",
 * 16 pp), paraphrased, every feature gateCheck. The Presence is
 * chosen at 1st level (SUBCLASS_LEVELS warlord: 1, staged patch —
 * see warlord notes); the registry file itself carries no
 * selectionLevel field (item-29 derivation). The class's own
 * Leadership Dice math is subclassService.leadershipDice.
 * CORRECTION: the S5 brief listed Scion of the Three under
 * Sorcerer; the Heroes intake and text extract both place it
 * under Rogue, so it is wired as a Rogue subclass. Heroes feats
 * (34) and spells (19, incl. Circle magic) are separate systems
 * and are NOT wired here. No new class file is indexed (all
 * eight classes were already in the index).
 * A subclass name that is
 * not in the data returns null from getSubclass — callers must
 * surface that as "not yet in the registry", never invent
 * features for it.
 *
 * PC vs companion split (combat item 2, binding): the functions
 * here return numbers and prompt text. They never add anything
 * to a PC's reported total. Companion math callers apply the
 * numbers directly; PC callers surface them as instructions
 * (featureNotes / the DM prompt section) and let the player
 * apply them to their own reported total.
 */

import { FIGHTER_SUBCLASSES } from '../data/subclasses/fighter.js';
import { CLERIC_SUBCLASSES } from '../data/subclasses/cleric.js';
import { BARBARIAN_SUBCLASSES } from '../data/subclasses/barbarian.js';
import { MONK_SUBCLASSES } from '../data/subclasses/monk.js';
import { ROGUE_SUBCLASSES } from '../data/subclasses/rogue.js';
import { WIZARD_SUBCLASSES } from '../data/subclasses/wizard.js';
import { WARLOCK_SUBCLASSES } from '../data/subclasses/warlock.js';
import { BARD_SUBCLASSES } from '../data/subclasses/bard.js';
import { SORCERER_SUBCLASSES } from '../data/subclasses/sorcerer.js';
import { PALADIN_SUBCLASSES } from '../data/subclasses/paladin.js';
import { DRUID_SUBCLASSES } from '../data/subclasses/druid.js';
import { RANGER_SUBCLASSES } from '../data/subclasses/ranger.js';
import { ARTIFICER_SUBCLASSES } from '../data/subclasses/artificer.js';
import { SPELLSHOT_SUBCLASSES } from '../data/subclasses/spellshot.js';
import { WARDEN_SUBCLASSES } from '../data/subclasses/warden.js';
import { MAGUS_SUBCLASSES } from '../data/subclasses/magus.js';
import { PUGILIST_SUBCLASSES } from '../data/subclasses/pugilist.js';
import { SCHOLAR_SUBCLASSES } from '../data/subclasses/scholar.js';
import { DUELIST_SUBCLASSES } from '../data/subclasses/duelist.js';
import { BLACKGUARD_SUBCLASSES } from '../data/subclasses/blackguard.js';
import { WARLORD_SUBCLASSES } from '../data/subclasses/warlord.js';
import { BLOOD_HUNTER_SUBCLASSES } from '../data/subclasses/blood_hunter.js';
import { SUBCLASS_LEVELS } from '../config/levelProgression.js';

// selectionLevel is DERIVED, not stored (2026-11-06, item 29):
// the class record SUBCLASS_LEVELS is the single source of truth
// for the level at which a class chooses its subclass, and the
// per-entry `selectionLevel` field in the data files drifted — 7
// entries still held the stale 2014 levels (cleric fate/sea 1,
// druid unborn 2, sorcerer dreamer 1, warlock many_faces /
// spiritual_guardian 1, wizard runecrafter 2) while the class
// record said 3. Every read below (listSubclasses / getSubclass)
// overrides the entry's field with the class record, so entries
// can't drift again — including entries whose field was removed
// entirely (the data worker is deleting it): they resolve via the
// class record and never read undefined as a level. The one cost:
// a future genuine per-entry exception (a subclass that picks at a
// different level than its class) needs the field re-introduced at
// this single derivation point. Classes with no SUBCLASS_LEVELS
// entry keep the entry's own field (possibly undefined —
// validateSelection treats that as 0, i.e. no level gate).
function withDerivedSelectionLevel(className, entry) {
  if (!entry) return entry;
  const derived = SUBCLASS_LEVELS[normalizeClassName(className)];
  if (derived == null) return entry;
  if (entry.selectionLevel === derived) return entry;
  return { ...entry, selectionLevel: derived };
}

// Registry index: one entry per class file. Later batches add
// their class file here and nowhere else — the lookup below
// does not change when a batch lands.
const SUBCLASSES_BY_CLASS = {
  fighter: FIGHTER_SUBCLASSES,
  cleric: CLERIC_SUBCLASSES,
  barbarian: BARBARIAN_SUBCLASSES,
  monk: MONK_SUBCLASSES,
  rogue: ROGUE_SUBCLASSES,
  wizard: WIZARD_SUBCLASSES,
  warlock: WARLOCK_SUBCLASSES,
  bard: BARD_SUBCLASSES,
  sorcerer: SORCERER_SUBCLASSES,
  paladin: PALADIN_SUBCLASSES,
  druid: DRUID_SUBCLASSES,
  ranger: RANGER_SUBCLASSES,
  artificer: ARTIFICER_SUBCLASSES,
  spellshot: SPELLSHOT_SUBCLASSES,
  warden: WARDEN_SUBCLASSES,
  magus: MAGUS_SUBCLASSES,
  pugilist: PUGILIST_SUBCLASSES,
  scholar: SCHOLAR_SUBCLASSES,
  duelist: DUELIST_SUBCLASSES,
  blackguard: BLACKGUARD_SUBCLASSES,
  warlord: WARLORD_SUBCLASSES,
  // Blood Hunter (2026-11-06): the 4 Orders (Ghostslayer, Lycan, Mutant,
  // Profane Soul) from the GM Binder 2024 conversion — registry total
  // 177 -> 181 (169 + 8 warlord Presences, then + 4 Orders).
  blood_hunter: BLOOD_HUNTER_SUBCLASSES,
};

export function normalizeSubclassName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeClassName(name) {
  return String(name || '').toLowerCase().trim();
}

// MVP player-subclass scope (Zach, 2026-11-08; Monster Hunter
// unwound 2026-11-08 — it is a subclass, subclasses stay): Monk
// Warrior of Waves is GRAYED OUT, not removed.
// They stay in the registry (NPCs/companions can still take them)
// and are only disabled for player characters. Reversible by
// design: putting a subclass back is deleting one line here. The
// flag is game policy, so it lives in this service layer, never in
// the book data files — mirroring MVP_DEFERRED_SPECIES in
// speciesService.js. Keys are `class:key` because subclass names
// alone are not unique enough to gate on.
export const MVP_DEFERRED_SUBCLASSES = new Set([
  'monk:warrior_of_waves',
]);

export const MVP_DEFERRED_SUBCLASS_NOTE = 'Coming after the MVP — NPCs can still be this subclass.';

/**
 * Is this subclass pick creatable as a player character in the MVP?
 * Resolves through getSubclass, so display names ('Monster Hunter')
 * and keys ('monster_hunter') judge by their entry. Unknown
 * subclasses resolve to null and stay creatable — the v1
 * no-rejection rule; only known deferred subclasses refuse.
 */
export function isSubclassPcCreatable(classId, subclassName) {
  // Q10 alias (coordinator decision, 2026-11-08 — reversible, vetoable
  // at the gate): the 2014 spelling 'Way of Waves' resolves to the
  // Warrior of Waves entry for the availability check only. getSubclass
  // is untouched (it still returns null for the old name, pinned by
  // subclass-scanned4.test.js:157) — the alias lives in the guard.
  const entry = getSubclass(classId, subclassName)
    ?? (normalizeSubclassName(subclassName) === 'way of waves' ? getSubclass(classId, 'Warrior of Waves') : null);
  if (!entry) return true;
  return !MVP_DEFERRED_SUBCLASSES.has(`${normalizeClassName(classId)}:${entry.key}`);
}

export function listSubclasses(className) {
  return [...(SUBCLASSES_BY_CLASS[normalizeClassName(className)] || [])]
    .map((entry) => withDerivedSelectionLevel(className, entry))
    .map((entry) => {
      const pcCreatable = !MVP_DEFERRED_SUBCLASSES.has(`${normalizeClassName(className)}:${entry.key}`);
      return { ...entry, pcCreatable, pcCreatableNote: pcCreatable ? null : MVP_DEFERRED_SUBCLASS_NOTE };
    });
}

export function getSubclass(className, subclassName) {
  const want = normalizeSubclassName(subclassName);
  if (!want) return null;
  const found = listSubclasses(className).find(
    (s) => normalizeSubclassName(s.name) === want || s.key === want.replace(/\s+/g, '_')
  ) || null;
  return found;
}

export function featuresAtLevel(className, subclassName, level) {
  const entry = getSubclass(className, subclassName);
  if (!entry) return [];
  const l = Number(level) || 0;
  return (entry.features || [])
    .filter((f) => Number(f.level) <= l)
    .sort((a, b) => Number(a.level) - Number(b.level));
}

export function isOutsideFr(entry) {
  if (!entry) return false;
  return entry.origin_setting !== 'Forgotten Realms';
}

// Render an entry's origin for reason/prompt messages. Null/unspecified
// origins (Warden, Scholar, and other outside-FR entries with no setting
// printed) render as 'unspecified setting' — never 'null (null)'. The
// null itself stays in the data: an unspecified origin still requires an
// explanation at selection, per the outside-FR ruling.
export function formatSubclassOrigin(entry) {
  if (!entry) return 'unspecified setting';
  if (entry.origin_setting === 'Forgotten Realms') return 'Forgotten Realms';
  const setting = entry.origin_setting || 'unspecified setting';
  // Never repeat the region when it is the setting itself (Warlord:
  // origin_setting and origin_region are both 'KibblesTasty
  // (setting-neutral)' — the old code rendered the setting twice).
  // FR entries never reach here (early return above), so their
  // redundant origin_region: 'Forgotten Realms' is harmless.
  const region = entry.origin_region && entry.origin_region !== entry.origin_setting
    ? ` (${entry.origin_region})`
    : '';
  return `${setting}${region}`;
}

/**
 * Selection completeness, per plan section 12 (outside-FR ruling):
 * - subclass must exist in the registry
 * - level must be at or above the selection level
 * - an outside-FR subclass with a blank origin explanation is
 *   INCOMPLETE, the same as a choice feature with no stored choice
 * - a Forgotten Realms subclass never needs an explanation, so a
 *   blank explanation does not block it
 * Returns { found, complete, reasons } — reasons is empty when complete.
 */
export function validateSelection({ className, subclassName, level, originExplanation } = {}) {
  const reasons = [];
  const entry = getSubclass(className, subclassName);
  if (!entry) {
    return { found: false, complete: false, reasons: [`subclass "${subclassName}" is not in the registry`] };
  }
  const l = Number(level) || 0;
  if (l < Number(entry.selectionLevel || 0)) {
    reasons.push(`${entry.name} is selected at ${entry.selectionLevel}th level (actor is level ${l})`);
  }
  if (isOutsideFr(entry) && !String(originExplanation || '').trim()) {
    reasons.push(
      `${entry.name} comes from ${formatSubclassOrigin(entry)} and needs an origin explanation for how its holder came to be in the Forgotten Realms`
    );
  }
  return { found: true, complete: reasons.length === 0, reasons };
}

/**
 * Stored-choice validation (kind G). A choice is valid only if
 * the subclass declares that choice key and the value is one of
 * its declared options (normalized comparison). No silent defaults:
 * an undeclared key, an undeclared option, or a subclass with no
 * choices all return valid: false with a reason.
 */
export function validateChoice(className, subclassName, choiceKey, value) {
  const entry = getSubclass(className, subclassName);
  if (!entry) return { valid: false, reason: `subclass "${subclassName}" is not in the registry` };
  const choice = (entry.choices || []).find((c) => c.key === choiceKey);
  if (!choice) {
    return { valid: false, reason: `${entry.name} has no stored choice named "${choiceKey}"` };
  }
  const want = normalizeSubclassName(value);
  const match = (choice.options || []).find((o) => normalizeSubclassName(o) === want);
  if (!match) {
    return {
      valid: false,
      reason: `"${value}" is not an option for ${entry.name} ${choiceKey} (options: ${(choice.options || []).join(', ')})`,
    };
  }
  return { valid: true, value: match };
}

// ---------------------------------------------------------------------------
// Champion pure math (kind A). The default critical threshold in
// this app is a natural 20 (Zach's crit law, partyAttackService
// judgeAttack). Champion lowers it; every other subclass returns
// 20 from this function today, so a caller can apply it uniformly
// without special-casing Champion at the call site.
// ---------------------------------------------------------------------------

export function critThresholdFor({ className, subclassName, level } = {}) {
  // MERGE (2026-11-09): generic — any feature at or below the level whose
  // mechanics carry a critThreshold number applies (Duelist Pinpoint
  // Strikes 19 at 3rd, Perfect Strikes 18 at 17th, per the registry).
  // Champion keeps its historical path (19 at 3–14, 18 at 15+).
  const l = Number(level) || 0;
  const feats = featuresAtLevel(className, subclassName, l);
  let lowest = 20;
  for (const f of feats) {
    const t = Number(f?.mechanics?.critThreshold);
    if (Number.isFinite(t) && t >= 2 && t < lowest) lowest = t;
  }
  if (lowest < 20) return lowest;
  const entry = getSubclass(className, subclassName);
  if (!entry || normalizeClassName(className) !== 'fighter' || entry.key !== 'champion') return 20;
  if (l >= 15) return 18;
  if (l >= 3) return 19;
  return 20;
}

export function survivorHealAtTurnStart({ className, subclassName, level, conMod, currentHp, maxHp } = {}) {
  // Survivor is a feature, not a subclass: check features at level.
  const feats = featuresAtLevel(className, subclassName, level);
  if (!feats.some((f) => f.key === 'survivor')) return 0;
  const hp = Number(currentHp) || 0;
  const max = Number(maxHp) || 0;
  if (hp < 1 || max < 1 || hp > max / 2) return 0;
  return 5 + (Number(conMod) || 0);
}

// ---------------------------------------------------------------------------
// Life Domain pure math (kinds D/E/C).
// ---------------------------------------------------------------------------

export function lifeDomainSpellsAtLevel(level) {
  const entry = getSubclass('cleric', 'Life Domain');
  const spellFeature = (entry?.features || []).find((f) => f.key === 'life_domain_spells');
  const byLevel = spellFeature?.mechanics?.alwaysPreparedByLevel || {};
  const l = Number(level) || 0;
  const out = [];
  for (const [at, spells] of Object.entries(byLevel)) {
    if (Number(at) <= l) out.push(...spells);
  }
  return out;
}

export function lifeDiscipleBonus(slotLevel) {
  const s = Number(slotLevel) || 0;
  return s >= 1 ? 2 + s : 0;
}

export function lifeBlessedHealerBonus(slotLevel) {
  const s = Number(slotLevel) || 0;
  return s >= 1 ? 2 + s : 0;
}

export function lifePreserveLifePool(clericLevel) {
  return 5 * (Number(clericLevel) || 0);
}

export function lifeHealingDiceMaxed({ className, subclassName, level } = {}) {
  return featuresAtLevel(className, subclassName, level).some((f) => f.key === 'supreme_healing');
}

// ---------------------------------------------------------------------------
// Batch 1 pure math (kinds A/B). All formulas are gateCheck in
// the data files: they are encoded here for testability, not
// presented as PHB-verified. classFeatureService maxima
// integration (superiority / psionic pools in class_resources_json)
// is a named follow-up, not wired in Batch 1 — these helpers are
// the pure-math layer that integration will call.
// ---------------------------------------------------------------------------

export function proficiencyBonusForLevel(level) {
  return Math.ceil((Number(level) || 1) / 4) + 1;
}

export function superiorityDice(level) {
  const l = Number(level) || 0;
  if (l < 3) return { count: 0, die: 8 };
  return {
    count: l >= 15 ? 6 : l >= 7 ? 5 : 4,
    die: l >= 18 ? 12 : l >= 10 ? 10 : 8,
  };
}

export function psiWarriorDice(level) {
  const l = Number(level) || 0;
  if (l < 3) return { count: 0, die: 6 };
  return {
    count: 2 * proficiencyBonusForLevel(l),
    die: l >= 17 ? 12 : l >= 11 ? 10 : l >= 5 ? 8 : 6,
  };
}

export function soulknifeDice(level) {
  const l = Number(level) || 0;
  if (l < 3) return { count: 0, die: 6 };
  // PHB 2024, Soulknife Psionic Energy dice table (p. 135), verified
  // against Zach's photos 2026-11-06: L3 d6 x4, L5 d8 x6, L9 d8 x8,
  // L11 d10 x8, L13 d10 x10, L17 d12 x12. (2 x Proficiency Bonus
  // reproduces these counts exactly at every level, but the explicit
  // table is pinned here so a future PB change cannot silently
  // rewrite the book's table.)
  const count = l >= 17 ? 12 : l >= 13 ? 10 : l >= 9 ? 8 : l >= 5 ? 6 : 4;
  return {
    count,
    die: l >= 17 ? 12 : l >= 11 ? 10 : l >= 5 ? 8 : 6,
  };
}

export function zealotDivineFuryBonus(barbarianLevel) {
  const l = Number(barbarianLevel) || 0;
  return { dice: '1d6', flat: Math.floor(l / 2) };
}

export function psiWarriorStrikeBonus(intMod) {
  return Number(intMod) || 0;
}

/**
 * Multi-value choice validation (kind G, e.g. Battle Master
 * maneuvers). Each value must be a declared option, values must
 * not repeat, and the list must not exceed the choice's maxCount
 * when one is declared. A single value is not auto-wrapped: the
 * caller passes the stored list as stored.
 */
export function validateChoiceList(className, subclassName, choiceKey, values) {
  const entry = getSubclass(className, subclassName);
  if (!entry) return { valid: false, reason: `subclass "${subclassName}" is not in the registry` };
  const choice = (entry.choices || []).find((c) => c.key === choiceKey);
  if (!choice) {
    return { valid: false, reason: `${entry.name} has no stored choice named "${choiceKey}"` };
  }
  const list = Array.isArray(values) ? values : [];
  const seen = new Set();
  for (const v of list) {
    const r = validateChoice(className, subclassName, choiceKey, v);
    if (!r.valid) return r;
    const norm = normalizeSubclassName(v);
    if (seen.has(norm)) return { valid: false, reason: `duplicate choice "${v}"` };
    seen.add(norm);
  }
  if (choice.maxCount != null && list.length > choice.maxCount) {
    return { valid: false, reason: `${entry.name} ${choiceKey} allows at most ${choice.maxCount} choices` };
  }
  return { valid: true, values: list.map((v) => validateChoice(className, subclassName, choiceKey, v).value) };
}

/**
 * Parse a subclass_choices_json column value (migration 103).
 * Stored shape: { choiceKey: value | [values], ... }. Returns {}
 * for blank, malformed, or non-object input — never throws.
 */
export function parseSubclassChoices(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Batch 2 pure math (kinds A/B/D). All formulas are gateCheck in
// the data files: they are encoded here for testability, not
// presented as PHB-verified. classFeatureService maxima
// integration (ward, healing-light, and other Batch 2 pools in
// class_resources_json) is a named follow-up, not wired in
// Batch 2 — these helpers are the pure-math layer that
// integration will call. Cleric domain spells are ALWAYS
// PREPARED; Warlock patron spells are ADDED TO THE LIST — the
// two helpers below keep that distinction, and callers must not
// conflate them.
// ---------------------------------------------------------------------------

export function arcaneWardHp(wizardLevel, intMod) {
  return 2 * (Number(wizardLevel) || 0) + (Number(intMod) || 0);
}

export function portentDice(wizardLevel) {
  const l = Number(wizardLevel) || 0;
  return l >= 14 ? 3 : 2;
}

export function wardingFlareUses(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function radianceOfTheDawnDamage(clericLevel) {
  return { dice: '2d10', flat: Number(clericLevel) || 0 };
}

export function healingLightDice(warlockLevel) {
  return 1 + (Number(warlockLevel) || 0);
}

export function darkOnesBlessingTempHp(warlockLevel, chaMod) {
  // PHB 2024 (photo-verified 2026-11-06): Cha mod + Warlock level,
  // minimum of 1 — a negative Cha mod at low level must not yield 0.
  return Math.max(1, (Number(warlockLevel) || 0) + (Number(chaMod) || 0));
}

export function celestialResilienceTempHp(warlockLevel, chaMod) {
  return (Number(warlockLevel) || 0) + (Number(chaMod) || 0);
}

// Celestial Resilience, allies' share (PHB 2024, photo-verified
// 2026-11-06): up to five creatures within 30 feet gain temp HP
// equal to HALF the Warlock level + Cha mod. NO minimum — the book
// states none, so do not invent one (a low-level warlock with a
// negative Cha mod can grant 0 to allies; the self amount above is
// the full level + Cha mod and is a separate number).
export function celestialResilienceAllyTempHp(warlockLevel, chaMod) {
  return Math.floor((Number(warlockLevel) || 0) / 2) + (Number(chaMod) || 0);
}

function spellsByLevelCumulative(entry, level, field) {
  const feature = (entry?.features || []).find((f) => f.kind === 'D');
  const byLevel = feature?.mechanics?.[field] || {};
  const l = Number(level) || 0;
  const out = [];
  for (const [at, spells] of Object.entries(byLevel)) {
    if (Number(at) <= l) out.push(...spells);
  }
  return out;
}

export function clericDomainSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

export function warlockPatronSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'spellsByLevel');
}

// ---------------------------------------------------------------------------
// Batch 3 pure math (kinds A/B/C/E/T/D). All formulas are gateCheck in
// the data files. Channel Divinity, Bardic Inspiration, and Sorcery
// Points remain base-class pools — no parallel pool is created.
// ---------------------------------------------------------------------------

export function danceUnarmoredAc(dexMod, chaMod) {
  return 10 + (Number(dexMod) || 0) + (Number(chaMod) || 0);
}

export function mantleOfInspirationTempHp(bardicDieRoll) {
  return 2 * (Number(bardicDieRoll) || 0);
}

export function wildMagicSurgeOnRoll(d20Roll) {
  return Number(d20Roll) === 20;
}

export function bendLuckDie() {
  return { dice: '1d4', costSorceryPoints: 1 };
}

export function bastionOfLawWardDice(sorceryPointsSpent) {
  return { count: Math.max(0, Number(sorceryPointsSpent) || 0), die: 8 };
}

export function draconicResilienceHpBonus(sorcererLevel) {
  const l = Number(sorcererLevel) || 0;
  return l >= 3 ? l : 0;
}

export function gloriousDefenseBonus(chaMod) {
  return Math.max(1, Number(chaMod) || 0);
}

export function paladinOathSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

export function sorcererSubclassSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

export function artificerSubclassSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

// Blackguard Vice spells (2026-11-06): same one-line shape as
// paladinOathSpellsAtLevel / artificerSubclassSpellsAtLevel. Despair, Pride
// and Treachery carry kind-'D' alwaysPreparedByLevel lists; Domination and
// Fury carry kind-'D' vice-spell lists too (coordinator ruling 2026-11-06,
// item 25: Domination = Oath of Conquest spells, Fury = Oath of Vengeance
// spells, at oath tiers 3/5/9/13/17).
// Warlord Leadership Dice (KibblesTasty Warlord v1.5, class table p. 2):
// the die count equals the warlord level; the die size is d6 at 2nd–8th,
// d8 at 9th–12th, d10 at 13th–16th, d12 at 17th–20th; the per-turn spend
// limit is 1 at 2nd–5th, 2 at 6th–10th, 3 at 11th–16th, 4 at 17th–20th.
// A Noble gains one additional die at 3rd, 9th, and 15th level
// (Destined Leader) — cumulative, so +3 by 15th. Before 2nd level the
// class has no Leadership Dice at all. Pure math, same shape as
// superiorityDice above.
export function leadershipDice(level, subclassName = null) {
  const l = Number(level) || 0;
  if (l < 2) return { count: 0, die: 6, perTurnLimit: 0 };
  const die = l >= 17 ? 12 : l >= 13 ? 10 : l >= 9 ? 8 : 6;
  const perTurnLimit = l >= 17 ? 4 : l >= 11 ? 3 : l >= 6 ? 2 : 1;
  let count = l;
  const sub = normalizeSubclassName(subclassName);
  if (sub === 'noble' || sub === "noble's presence") {
    count += l >= 15 ? 3 : l >= 9 ? 2 : l >= 3 ? 1 : 0;
  }
  return { count, die, perTurnLimit };
}

export function blackguardViceSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

// Profane Soul Arcana spells (2026-11-07): the always-prepared spells
// from Revealed Arcana (7th) and Unsealed Arcana (15th) — one per
// feature, keyed by the stored Otherworldly Patron choice ('The
// Archfey' / 'The Celestial' / 'The Fiend' / 'The Great Old One').
// Unlike the one-line helpers above, this CANNOT use
// spellsByLevelCumulative: that helper reads `alwaysPreparedByLevel`
// off the FIRST kind-'D' feature only, and Profane Soul carries TWO
// kind-'D' features whose lists are `alwaysPreparedByPatron`
// (patron-keyed, not level-keyed). So this iterates every kind-'D'
// feature at or below the level and collects the patron's spell from
// each. Unknown or absent patron -> [] (fail-open on the exclusion;
// the cap itself still applies). Patron matched case-insensitively
// and with surrounding whitespace ignored — the stored choice is
// validated against the four PDF patrons, but a hand-seeded row may
// differ in case.
export function profaneSoulArcanaSpellsAtLevel(className, subclassName, level, patron) {
  const entry = getSubclass(className, subclassName);
  if (!entry) return [];
  const want = String(patron || '').trim().toLowerCase();
  if (!want) return [];
  const l = Number(level) || 0;
  const out = [];
  for (const feature of entry.features || []) {
    if (feature.kind !== 'D' || Number(feature.level) > l) continue;
    const byPatron = feature.mechanics?.alwaysPreparedByPatron || {};
    const key = Object.keys(byPatron).find((k) => String(k).trim().toLowerCase() === want);
    if (key) out.push(...(byPatron[key] || []));
  }
  return out;
}

// Bard subclass spells (2026-11-06): same one-line shape as
// paladinOathSpellsAtLevel / blackguardViceSpellsAtLevel. The only
// always-prepared bard spell in the registry is College of the Moon's
// Blessing of Moonlight (L6: Moonbeam, "you always have Moonbeam
// prepared"); Dance / Glamour / Lore / Valor / Swords / Whispers /
// Eloquence / Mirrors / Departed / Weaver carry no
// alwaysPreparedByLevel lists. Magical Secrets (L10) and Lore's
// Magical Discoveries are added-to-list picks, NOT always prepared,
// so they never appear here — they count against the cap.
export function bardSubclassSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

// ---------------------------------------------------------------------------
// Batch 4 pure math (kinds A/B/C/E/H/D). All formulas are gateCheck in
// the data files: Batch 4 was NOT authored from the Pt1/Pt2 scans
// (2014 PHB — see druid.js/ranger.js headers). Wild Shape forms
// and the Primal Companion have no entity row in the app — these
// helpers are the pure-math layer only, never an entity.
// ---------------------------------------------------------------------------

export function moonWildShapeTempHp(druidLevel) {
  return 3 * (Number(druidLevel) || 0);
}

export function moonWildShapeMaxCr(druidLevel) {
  return Math.floor((Number(druidLevel) || 0) / 3);
}

export function moonWildShapeAc(wisMod, beastAc) {
  return Math.max(13 + (Number(wisMod) || 0), Number(beastAc) || 0);
}

export function landAidDice(druidLevel) {
  const l = Number(druidLevel) || 0;
  return { count: l >= 14 ? 4 : l >= 10 ? 3 : 2, die: 6 };
}

export function wrathOfTheSeaDice(wisMod) {
  return { count: Math.max(1, Number(wisMod) || 0), die: 6 };
}

export function starryFormDice(druidLevel) {
  return { count: (Number(druidLevel) || 0) >= 10 ? 2 : 1, die: 8 };
}

export function primalCompanionAc(wisMod) {
  return 13 + (Number(wisMod) || 0);
}

export function primalCompanionHp(statblock, rangerLevel) {
  const l = Number(rangerLevel) || 0;
  const key = String(statblock || '').toLowerCase();
  if (key.includes('sky')) return 4 + 4 * l;
  if (key.includes('land') || key.includes('sea')) return 5 + 5 * l;
  return null;
}

export function dreadfulStrikesDie(rangerLevel) {
  return { die: (Number(rangerLevel) || 0) >= 11 ? 6 : 4 };
}

export function dreadAmbusherDice(rangerLevel) {
  return { count: 2, die: (Number(rangerLevel) || 0) >= 11 ? 8 : 6 };
}

export function colossusSlayerDamage() {
  return '1d8';
}

export function druidCircleSpellsAtLevel(className, subclassName, level, landType) {
  const entry = getSubclass(className, subclassName);
  const feature = (entry?.features || []).find((f) => f.kind === 'D');
  const byLand = feature?.mechanics?.alwaysPreparedByLand;
  if (byLand) {
    // Land: no silent default land — without a stored land_type
    // choice, no Land spells are returned.
    const tiers = byLand[String(landType || '').toLowerCase()] || {};
    const l = Number(level) || 0;
    const out = [];
    for (const [at, spells] of Object.entries(tiers)) {
      if (Number(at) <= l) out.push(...spells);
    }
    return out;
  }
  const held = feature?.mechanics?.preparedWhileHolding;
  if (Array.isArray(held)) return [...held];
  return spellsByLevelCumulative(entry, level, 'alwaysPreparedByLevel');
}

export function rangerSubclassSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

// Eldritch Knight / Arcane Trickster always-prepared spells
// (2026-11-07): symmetry one-liners on spellsByLevelCumulative, same
// shape as paladinOathSpellsAtLevel / sorcererSubclassSpellsAtLevel.
// Both return [] at every level today — NEITHER subclass carries an
// alwaysPreparedByLevel list on its kind-'D' Spellcasting feature
// (no always-prepared levelled spells exist for EK/AT), so the
// validator's exclusion list is empty and the cap is the whole job.
// Mage Hand (Arcane Trickster) is a cantrip, not a prepared spell;
// Spell Thief's stolen spell is transient (8 hours), never listed.
export function eldritchKnightSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

export function arcaneTricksterSpellsAtLevel(className, subclassName, level) {
  return spellsByLevelCumulative(getSubclass(className, subclassName), level, 'alwaysPreparedByLevel');
}

// ---------------------------------------------------------------------------
// Scanned Batch S1 pure math (Xanathar part 1, 2014 -> 2024
// conversion). All formulas are conversionCheck + gateCheck in
// the data files: no 2024 reprint exists for these subclasses,
// so the numbers below encode the 2014 extract mapped onto
// the built 2024 cadences, not PHB-verified 2024 values.
// ---------------------------------------------------------------------------

export function spiritShieldDice(barbarianLevel) {
  const l = Number(barbarianLevel) || 0;
  if (l < 6) return '0d6';
  if (l >= 14) return '4d6';
  if (l >= 10) return '3d6';
  return '2d6';
}

export function stormAuraDamage(environment, barbarianLevel) {
  const l = Number(barbarianLevel) || 0;
  const env = String(environment || '').toLowerCase();
  if (env === 'desert') {
    if (l >= 20) return 6;
    if (l >= 15) return 5;
    if (l >= 10) return 4;
    if (l >= 5) return 3;
    return 2;
  }
  if (env === 'sea') {
    if (l >= 20) return '4d6';
    if (l >= 15) return '3d6';
    if (l >= 10) return '2d6';
    return '1d6';
  }
  return null;
}

export function stormAuraTempHp(barbarianLevel) {
  const l = Number(barbarianLevel) || 0;
  if (l >= 20) return 6;
  if (l >= 15) return 5;
  if (l >= 10) return 4;
  if (l >= 5) return 3;
  return 2;
}

export function stormAuraDc(proficiencyBonus, conMod) {
  return 8 + (Number(proficiencyBonus) || 0) + (Number(conMod) || 0);
}

export function psychicBladesDice(bardLevel) {
  const l = Number(bardLevel) || 0;
  if (l >= 15) return '8d6';
  if (l >= 10) return '5d6';
  if (l >= 5) return '3d6';
  return '2d6';
}

export function mastersFlourishDie() {
  return 'd6';
}

export function forgeDivineStrikeDice(clericLevel) {
  return (Number(clericLevel) || 0) >= 17 ? '2d8' : '1d8';
}

export function graveFeatureUses(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function balmPool(druidLevel) {
  const l = Number(druidLevel) || 0;
  return { pool: l, maxSpend: Math.floor(l / 2) };
}

export function spiritTotemTempHp(druidLevel) {
  return 5 + (Number(druidLevel) || 0);
}

export function guardianSpiritHeal(druidLevel) {
  return Math.floor((Number(druidLevel) || 0) / 2);
}

export function consultTheSpiritsSpells() {
  return ['Augury', 'Clairvoyance'];
}

export function walkerInDreamsSpells() {
  return ['Dream', 'Scrying', 'Teleportation Circle'];
}

export function arcaneShotOptionsAtLevel(fighterLevel) {
  const l = Number(fighterLevel) || 0;
  if (l >= 18) return 6;
  if (l >= 15) return 5;
  if (l >= 10) return 4;
  if (l >= 7) return 3;
  return 2;
}

export function arcaneShotSaveDc(proficiencyBonus, intMod) {
  return 8 + (Number(proficiencyBonus) || 0) + (Number(intMod) || 0);
}

export function arcaneShotExtraDamage(option, fighterLevel) {
  const l = Number(fighterLevel) || 0;
  const at18 = l >= 18;
  switch (String(option || '').toLowerCase()) {
    case 'banishing arrow': return at18 ? '2d6 force' : null;
    case 'beguiling arrow': return at18 ? '4d6 psychic' : '2d6 psychic';
    case 'bursting arrow': return at18 ? '4d6 force' : '2d6 force';
    case 'enfeebling arrow': return at18 ? '4d6 necrotic' : '2d6 necrotic';
    case 'grasping arrow': return at18 ? '4d6 poison + 4d6 slashing' : '2d6 poison + 2d6 slashing';
    case 'piercing arrow': return at18 ? '2d6 piercing' : '1d6 piercing';
    case 'seeking arrow': return at18 ? '2d6 force' : '1d6 force';
    case 'shadow arrow': return at18 ? '4d6 psychic' : '2d6 psychic';
    default: return null;
  }
}

export function cavalierMarkExtraDamage(fighterLevel) {
  return Math.floor((Number(fighterLevel) || 0) / 2);
}

export function wardingManeuverDie() {
  return 'd8';
}

export function ferociousChargerDc(proficiencyBonus, strMod) {
  return 8 + (Number(proficiencyBonus) || 0) + (Number(strMod) || 0);
}

export function fightingSpiritTempHp(fighterLevel) {
  const l = Number(fighterLevel) || 0;
  if (l >= 15) return 15;
  if (l >= 10) return 10;
  return 5;
}

export function fightingSpiritUses() {
  return 3;
}

// ---------------------------------------------------------------------------
// Scanned Batch S3 pure math (outside-FR, 2014/2020 -> 2024
// conversion). All formulas are conversionCheck + gateCheck in
// the data files. No new pools: Unleash/Reclaim use Con, Stasis/
// Violent Attraction use Int, Fungal Infestation uses Wis — all
// DM-adjudicated counts, not classFeatureService maxima.
// ---------------------------------------------------------------------------

export function echoKnightAc(proficiencyBonus) {
  return 14 + (Number(proficiencyBonus) || 0);
}

export function echoUses(abilityMod) {
  return Math.max(1, Number(abilityMod) || 0);
}

export function chronalShiftUses() {
  return 2;
}

export function momentaryStasisUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function violentAttractionUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function haloOfSporesDie(level) {
  const l = Number(level) || 0;
  if (l >= 14) return 10;
  if (l >= 10) return 8;
  if (l >= 6) return 6;
  return 4;
}

export function symbioticEntityTempHp(level) {
  return 4 * (Number(level) || 0);
}

export function orderDivineStrikeDice(level) {
  return { count: (Number(level) || 0) >= 17 ? 2 : 1, die: 8 };
}

export function eloquenceFloor(roll) {
  const r = Number(roll) || 0;
  return r <= 9 ? 10 : r;
}

// ---------------------------------------------------------------------------
// Scanned Batch S4 pure math (Hoard of Heroes, 2014-pattern ->
// 2024 conversion). All formulas are conversionCheck + gateCheck
// in the data files: no 2024 reprint exists for these subclasses.
// ---------------------------------------------------------------------------

export function mountainDizzyingHeightsDc(proficiencyBonus, conMod) {
  return 8 + (Number(proficiencyBonus) || 0) + (Number(conMod) || 0);
}

export function mirrorLucentCharges(spellLevel) {
  return 1 + (Number(spellLevel) || 0);
}

export function mirrorLucentMaxCharges(bardLevel) {
  return Number(bardLevel) || 0;
}

export function revelryFeatureUses(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function sandSpiritCarryCapacity(wisScore) {
  return 30 * (Number(wisScore) || 0);
}

export function dustDevilTempHp(druidLevel) {
  return Number(druidLevel) || 0;
}

export function hunterQuarryBonus(fighterLevel) {
  return Math.floor((Number(fighterLevel) || 0) / 2);
}

export function hunterQuarryUsesPerCreature(fighterLevel) {
  return (Number(fighterLevel) || 0) >= 18 ? 2 : 1;
}

export function wavesMaelstromIncrements(kiSpent) {
  const k = Math.min(8, Math.max(0, Number(kiSpent) || 0));
  return { radiusIncreaseFeet: 10 * k, damageDice: k };
}

export function stoneDiamondDefenseTempHp(rangerLevel, conMod) {
  return Math.floor((Number(rangerLevel) || 0) / 2) + (Number(conMod) || 0);
}

export function sliderMarkDc(proficiencyBonus, dexMod) {
  return 8 + (Number(proficiencyBonus) || 0) + (Number(dexMod) || 0);
}

export function planarDisplacementTargetCount(chaMod) {
  return Math.max(0, 2 * (Number(chaMod) || 0));
}

// ---------------------------------------------------------------------------
// Scanned Batch S5 pure math (Heroes of Faerûn, 2024-era).
// All formulas are gateCheck in the data files.
// ---------------------------------------------------------------------------

export function unfetteredMindContacts(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function groupRecoveryAllies(chaMod) {
  return Math.max(1, Number(chaMod) || 0);
}

export function elementalRebukeUses(chaMod) {
  return Math.max(1, Number(chaMod) || 0);
}

export function polarStrikesDie(rangerLevel) {
  return (Number(rangerLevel) || 0) >= 11 ? 6 : 4;
}

export function fortifyingSoulTargets(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function chillingRetributionUses(wisMod) {
  return Math.max(1, Number(wisMod) || 0);
}

export function bloodthirstUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function scionAuraDamage(intMod) {
  return Number(intMod) || 0;
}

export function crownLifeForceMaxDice(chaMod) {
  return Math.max(1, Number(chaMod) || 0);
}

export function bladesongUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function bladesongAcBonus(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function songOfDefenseReduction(slotLevel) {
  return 5 * (Number(slotLevel) || 0);
}

// ---------------------------------------------------------------------------
// Mechanics hooks, Families 2 + 7 — shared subclass-resolution helpers
// (2026-11-09, staged from cached mirror copies; NOT verified live).
//
// D6: hooks read class_levels, not just the primary class. Every helper
// here takes an ACTOR — { className, subclassName, level, classLevels }
// (aliases class/subclass and class_levels are also accepted) — so all
// families share one resolution shape instead of each re-deriving it.
// An actor class with no subclass yet is skipped: a subclass may be
// null until chosen, and no feature may be read for it.
//
// subclassPoolMaxima is the Families 2+7 pool table: one entry per
// wired pool, keyed by the registry FEATURE key (plus class where two
// classes share a key — psionic_power is Psi Warrior on fighter and
// Soulknife on rogue). A pool is wired here only when BOTH hold:
// (a) a pure-math helper already exists in this file, and (b) the
// rest rule is recorded in the registry or book-verified in this pass
// (D8 — no invented rest rules). The full wired-vs-deferred census
// lives in the f2-f7 NOTES.md; the deferred list is not silently
// shrunk — a pool with no helper or no verified rest rule is NOT in
// this table. Two helper→feature mappings are INFERRED, not cited by
// any registry engine field, and are flagged as such below:
// echoUses → unleash_incarnation AND reclaim_potential (both Echo
// Knight features record "Constitution modifier (minimum 1)" + rest
// 'long'; the S3 comment groups them as "Unleash/Reclaim use Con") and
// revelryFeatureUses → more_the_merrier (the only Revelry feature
// recording a Wisdom-modifier use count + rest 'long'). Both formulas
// match exactly; the coordinator confirms at the gate.
// Rest-rule vocabulary: 'long' (long rest only), 'short or long'
// (either rest restores fully), 'short+1' (short rest restores 1,
// long rest restores fully), 'long+1-if-empty' (long rest restores
// fully; a short rest restores 1 only when none remain).
// ---------------------------------------------------------------------------

function actorInput(actor = {}) {
  return {
    className: actor.className ?? actor.class ?? actor.primaryClass ?? null,
    subclassName: actor.subclassName ?? actor.subclass ?? null,
    level: actor.level ?? actor.totalLevel ?? null,
    classLevels: actor.classLevels ?? actor.class_levels ?? null,
  };
}

export function parseClassLevels(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((e) => e && typeof e === 'object')
    .map((e) => ({
      className: e.class ?? e.className ?? null,
      subclassName: e.subclass ?? e.subclassName ?? null,
      level: Number(e.level) || 0,
    }))
    .filter((e) => e.className);
}

// Primary class first, then each class_levels entry whose class
// differs from the primary. When a class_levels entry names the
// primary class, its subclass/level fill a primary that lacks them —
// the class is never listed twice.
function actorClassList({ className, subclassName, level, classLevels } = {}) {
  const primary = String(className ?? '').trim();
  const entries = parseClassLevels(classLevels);
  const out = [];
  if (primary) {
    const primaryEntry = entries.find(
      (e) => normalizeClassName(e.className) === normalizeClassName(primary)
    );
    out.push({
      className: primary,
      subclassName: subclassName ?? primaryEntry?.subclassName ?? null,
      level: Number(level) || primaryEntry?.level || 0,
    });
  }
  for (const e of entries) {
    if (normalizeClassName(e.className) === normalizeClassName(primary)) continue;
    out.push({ className: e.className, subclassName: e.subclassName ?? null, level: e.level });
  }
  return out;
}

export function featuresForActor(actor = {}) {
  // MERGE (2026-11-09): FLAT shape — each entry is the registry feature
  // object itself, spread with its owning class/subclass/level
  // ({...feature, className, subclassName, classLevel}), so callers read
  // f.key / f.kind / f.mechanics directly. The F2 draft returned a nested
  // flat {...feature, className, subclassName, classLevel} shape; the F1 attack path
  // and the F6 resistance/save consumers all read f.key, so flat is the
  // one shape. hasSubclassFeature / featureByKey below match it.
  const input = actorInput(actor);
  const out = [];
  for (const entry of actorClassList(input)) {
    if (!entry.subclassName) continue;
    for (const feature of featuresAtLevel(entry.className, entry.subclassName, entry.level)) {
      out.push({ ...feature, className: entry.className, subclassName: entry.subclassName, classLevel: entry.level });
    }
  }
  return out;
}

export function critThresholdForActor(actor = {}) {
  const input = actorInput(actor);
  let lowest = 20;
  for (const entry of actorClassList(input)) {
    const t = critThresholdFor({ className: entry.className, subclassName: entry.subclassName, level: entry.level });
    if (t < lowest) lowest = t;
  }
  return lowest;
}

export function hasSubclassFeature(actor, key) {
  if (!key) return false;
  return featuresForActor(actor).some((f) => f.key === key);
}

export function featureByKey(actor, key) {
  if (!key) return null;
  return featuresForActor(actor).find((f) => f.key === key) || null;
}

function poolAbilityMods(abilityScores) {
  let scores = abilityScores;
  if (typeof scores === 'string') {
    try { scores = JSON.parse(scores); } catch { scores = {}; }
  }
  scores = scores && typeof scores === 'object' ? scores : {};
  const mod = (short, full) => Math.floor((Number(scores[short] ?? scores[full] ?? 10) - 10) / 2);
  return {
    str: mod('str', 'strength'),
    dex: mod('dex', 'dexterity'),
    con: mod('con', 'constitution'),
    int: mod('int', 'intelligence'),
    wis: mod('wis', 'wisdom'),
    cha: mod('cha', 'charisma'),
  };
}

// Wired subclass pools (Families 2+7, first slice — see the header
// above and f2-f7 NOTES.md for the census). `compute` receives
// { level, mods, feature, subclassName }. `value: true` marks a pool
// that is a current-HP value, not a spent-use count (Arcane Ward
// only): it rides class_resources_json as the sibling key wardHp,
// never as used.<key>.
export const SUBCLASS_POOL_DEFS = Object.freeze([
  { key: 'combat_superiority', className: 'fighter', pool: 'superiority', rest: 'short or long', compute: ({ level }) => superiorityDice(level).count },
  { key: 'psionic_power', className: 'fighter', pool: 'psionic', rest: 'long+1-if-empty', compute: ({ level }) => psiWarriorDice(level).count },
  { key: 'psionic_power', className: 'rogue', pool: 'soulknife', rest: 'short+1', compute: ({ level }) => soulknifeDice(level).count },
  { key: 'arcane_ward', className: 'wizard', pool: 'ward', rest: 'long', value: true, compute: ({ level, mods }) => arcaneWardHp(level, mods.int) },
  { key: 'healing_light', className: 'warlock', pool: 'healingLight', rest: 'long', compute: ({ level }) => healingLightDice(level) },
  { key: 'portent', className: 'wizard', pool: 'portent', rest: 'long', compute: ({ level }) => portentDice(level) },
  { key: 'warding_flare', className: 'cleric', pool: 'wardingFlare', rest: 'long', compute: ({ mods }) => wardingFlareUses(mods.wis) },
  { key: 'sentinel_at_deaths_door', className: 'cleric', pool: 'grave', rest: 'long', compute: ({ mods }) => graveFeatureUses(mods.wis) },
  { key: 'balm_of_the_summer_court', className: 'druid', pool: 'balm', rest: 'long', compute: ({ level }) => balmPool(level).pool },
  { key: 'fighting_spirit', className: 'fighter', pool: 'fightingSpirit', rest: 'long', compute: () => fightingSpiritUses() },
  { key: 'bladesong', className: 'wizard', pool: 'bladesong', rest: 'long', compute: ({ mods }) => bladesongUses(mods.int) },
  { key: 'arcane_jolt', className: 'artificer', pool: 'arcaneJolt', rest: 'long', compute: ({ mods }) => arcaneJoltUses(mods.int) },
  { key: 'restorative_reagents', className: 'artificer', pool: 'restorativeReagents', rest: 'long', compute: ({ mods }) => restorativeReagentsUses(mods.int) },
  { key: 'mapping_magic', className: 'artificer', pool: 'illuminatedCartography', rest: 'long', compute: ({ mods }) => illuminatedCartographyUses(mods.int) },
  { key: 'giant_jack', className: 'artificer', pool: 'giantStature', rest: 'long', compute: ({ mods }) => giantStatureUses(mods.int) },
  { key: 'chronal_shift', className: 'wizard', pool: 'chronalShift', rest: 'long', compute: () => chronalShiftUses() },
  { key: 'momentary_stasis', className: 'wizard', pool: 'momentaryStasis', rest: 'long', compute: ({ mods }) => momentaryStasisUses(mods.int) },
  { key: 'violent_attraction', className: 'wizard', pool: 'violentAttraction', rest: 'long', compute: ({ mods }) => violentAttractionUses(mods.int) },
  { key: 'chilling_retribution', className: 'ranger', pool: 'chillingRetribution', rest: 'long', compute: ({ mods }) => chillingRetributionUses(mods.wis) },
  { key: 'bloodthirst', className: 'rogue', pool: 'bloodthirst', rest: 'long', compute: ({ mods }) => bloodthirstUses(mods.int) },
  { key: 'elemental_rebuke', className: 'paladin', pool: 'elementalRebuke', rest: 'long', compute: ({ mods }) => elementalRebukeUses(mods.cha) },
  // INFERRED helper→feature mappings (see header): no registry engine
  // field cites these helpers; the formulas match exactly. echoUses
  // serves TWO same-formula Echo Knight features (Unleash Incarnation
  // and Reclaim Potential — both "Constitution modifier (minimum 1)",
  // rest 'long'), so both are wired on it under their own pool keys;
  // revelryFeatureUses serves More the Merrier alone.
  { key: 'unleash_incarnation', className: 'fighter', pool: 'unleashIncarnation', rest: 'long', compute: ({ mods }) => echoUses(mods.con) },
  { key: 'reclaim_potential', className: 'fighter', pool: 'reclaimPotential', rest: 'long', compute: ({ mods }) => echoUses(mods.con) },
  { key: 'more_the_merrier', className: 'cleric', pool: 'moreTheMerrier', rest: 'long', compute: ({ mods }) => revelryFeatureUses(mods.wis) },
]);

export const SUBCLASS_POOL_REST_RULES = Object.freeze(
  Object.fromEntries(SUBCLASS_POOL_DEFS.map((d) => [d.pool, d.rest]))
);

export function subclassPoolRestRule(poolKey) {
  return SUBCLASS_POOL_REST_RULES[poolKey] ?? null;
}

export function isSubclassValuePool(poolKey) {
  return SUBCLASS_POOL_DEFS.some((d) => d.pool === poolKey && d.value === true);
}

export function subclassPoolMaxima(actor = {}, abilityScores) {
  const mods = poolAbilityMods(abilityScores);
  const out = {};
  // MERGE (2026-11-09): featuresForActor returns the FLAT shape, so
  // the feature itself carries className/subclassName/classLevel.
  // (The staged draft destructured a nested { ..., feature } shape.)
  for (const feature of featuresForActor(actor)) {
    const { className, subclassName } = feature;
    const level = feature.classLevel;
    for (const def of SUBCLASS_POOL_DEFS) {
      if (def.key !== feature.key) continue;
      if (def.className && normalizeClassName(def.className) !== normalizeClassName(className)) continue;
      const max = def.compute({ level, mods, feature, subclassName });
      if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) continue;
      // Two classes granting the same pool key share one pool: the
      // larger maximum wins (a single pool cannot hold two maxima).
      out[def.pool] = Math.max(out[def.pool] ?? 0, Math.trunc(max));
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// DM prompt section. Registry-driven, never hardcoded lists: the
// section is built from whatever the registry returns for the
// actor's (class, subclass, level). Unknown subclasses render as
// a "not yet in the registry" line, never as invented features.
// npc_stats companions are skipped by design — subclass math
// applies to class-progression companions only.
// ---------------------------------------------------------------------------

function actorFromRow(row, { isCompanion = false } = {}) {
  if (!row) return null;
  if (isCompanion) {
    return {
      name: row.name || row.display_name || 'Companion',
      className: row.companion_class,
      subclassName: row.companion_subclass,
      level: row.companion_level,
      progressionType: row.progression_type,
      isCompanion: true,
    };
  }
  return {
    name: row.name || 'Player',
    className: row.class,
    subclassName: row.subclass,
    level: row.level,
    isCompanion: false,
  };
}

function sectionForActor(actor) {
  if (!actor || !actor.subclassName) return null;
  const entry = getSubclass(actor.className, actor.subclassName);
  if (!entry) {
    return `${actor.isCompanion ? 'Companion' : 'Player'} ${actor.name}: subclass "${actor.subclassName}" is not yet in the subclass registry — do not invent its features.`;
  }
  const feats = featuresAtLevel(actor.className, actor.subclassName, actor.level);
  const lines = feats.map((f) => `  L${f.level} ${f.prompt}`);
  const origin = entry.origin_setting === 'Forgotten Realms'
    ? 'Forgotten Realms'
    : `${formatSubclassOrigin(entry)} — origin explanation required`;
  return [
    `${actor.isCompanion ? 'Companion' : 'Player'} ${actor.name}: ${entry.name} (${actor.className}, level ${actor.level}, origin: ${origin})`,
    ...lines,
  ].join('\n');
}

export function buildSubclassPromptSection(character, companions = []) {
  const parts = [];
  const pc = sectionForActor(actorFromRow(character));
  if (pc) parts.push(pc);
  for (const row of companions || []) {
    const actor = actorFromRow(row, { isCompanion: true });
    if (!actor || !actor.subclassName) continue;
    if (actor.progressionType === 'npc_stats') continue;
    const line = sectionForActor(actor);
    if (line) parts.push(line);
  }
  if (parts.length === 0) return '';
  return [
    'SUBCLASS FEATURES (from the subclass registry — apply exactly these; do not invent others):',
    ...parts,
    'PC RULE: the player rolls their own dice and reports totals. Never silently add subclass numbers to a reported total — state them as instructions and let the player apply them. Companion numbers above are system-applied.',
  ].join('\n');
}

export function conquestAuraDamage(paladinLevel) {
  return Math.floor((Number(paladinLevel) || 0) / 2);
}

export function protectiveSpiritHeal(paladinLevel) {
  const half = Math.floor((Number(paladinLevel) || 0) / 2);
  return `1d6 + ${half}`;
}

export function planarWarriorDamage(rangerLevel) {
  return (Number(rangerLevel) || 0) >= 11 ? '2d8' : '1d8';
}

export function stormHeartDamage(sorcererLevel) {
  return Math.floor((Number(sorcererLevel) || 0) / 2);
}

export function stormsFuryDamage(sorcererLevel) {
  return Number(sorcererLevel) || 0;
}

export function hexbladeCurseHeal(warlockLevel, chaMod) {
  return Math.max(1, (Number(warlockLevel) || 0) + (Number(chaMod) || 0));
}

export function strengthOfGraveDc(damageTaken) {
  return 5 + (Number(damageTaken) || 0);
}

export function houndTempHp(sorcererLevel) {
  return Math.floor((Number(sorcererLevel) || 0) / 2);
}

export function powerSurgeDamage(wizardLevel) {
  return Math.floor((Number(wizardLevel) || 0) / 2);
}

export function deflectingShroudDamage(wizardLevel) {
  return Math.floor((Number(wizardLevel) || 0) / 2);
}

export function divineAffinitySpell(affinity) {
  switch (String(affinity || '').toLowerCase()) {
    case 'good': return 'Cure Wounds';
    case 'evil': return 'Inflict Wounds';
    case 'law': return 'Bless';
    case 'chaos': return 'Bane';
    case 'neutrality': return 'Protection from Evil and Good';
    default: return null;
  }
}


// ---------------------------------------------------------------------------
// Artificer Job 1 pure math (Forge 2024). All formulas are gateCheck
// in server/data/subclasses/artificer.js. The B-kind pools below
// (Restorative Reagents, Illuminated Cartography, Giant Stature,
// Guardian pull, Infiltrator flight, Arcane Jolt) print their maxima
// AND their reset in Forge — uses equal to Intelligence modifier
// (minimum 1), all expended uses regained on a Long Rest — so the
// maxima/reset decision is recorded in the feature mechanics, not
// invented here. No classFeatureService pool is wired in this job
// (named follow-up, same as prior batches); these helpers are the
// pure-math layer that integration will call. Elixir / cannon /
// defender numbers are the Forge printings (cannon AC 18, HP 5x
// level; defender AC 12 + Int, HP 5 + 5x level).
// ---------------------------------------------------------------------------

export function experimentalElixirCount(artificerLevel) {
  const l = Number(artificerLevel) || 0;
  if (l < 3) return 0;
  if (l < 5) return 2;
  if (l < 9) return 3;
  if (l < 15) return 4;
  return 5;
}

export function experimentalElixirHealingDice(artificerLevel) {
  const l = Number(artificerLevel) || 0;
  if (l < 9) return 2;
  if (l < 15) return 3;
  return 4;
}

export function eldritchCannonHp(artificerLevel) {
  return 5 * (Number(artificerLevel) || 0);
}

export function eldritchCannonAc() {
  return 18;
}

export function cannonProtectorTempHp(d8Roll, intMod) {
  return (Number(d8Roll) || 0) + Math.max(1, Number(intMod) || 0);
}

export function cannonDetonateDice() {
  return '3d10';
}

export function cannonFirepowerDice() {
  return '1d8';
}

export function steelDefenderHp(artificerLevel) {
  return 5 + 5 * (Number(artificerLevel) || 0);
}

export function steelDefenderAc(intMod) {
  return 12 + (Number(intMod) || 0);
}

export function steelDefenderRendBonus(intMod) {
  return 2 + (Number(intMod) || 0);
}

export function arcaneJoltDice(artificerLevel) {
  return (Number(artificerLevel) || 0) >= 15 ? '4d6' : '2d6';
}

export function arcaneJoltUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function restorativeReagentsUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function illuminatedCartographyUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function atlasMaxHolders(intMod) {
  return Math.max(2, 1 + (Number(intMod) || 0));
}

export function giantStatureUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function guardianPullUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export function infiltratorFlightUses(intMod) {
  return Math.max(1, Number(intMod) || 0);
}

export default {
  normalizeSubclassName,
  listSubclasses,
  getSubclass,
  featuresAtLevel,
  isOutsideFr,
  validateSelection,
  validateChoice,
  critThresholdFor,
  survivorHealAtTurnStart,
  lifeDomainSpellsAtLevel,
  lifeDiscipleBonus,
  lifeBlessedHealerBonus,
  lifePreserveLifePool,
  lifeHealingDiceMaxed,
  buildSubclassPromptSection,
  proficiencyBonusForLevel,
  superiorityDice,
  psiWarriorDice,
  soulknifeDice,
  zealotDivineFuryBonus,
  psiWarriorStrikeBonus,
  validateChoiceList,
  parseSubclassChoices,
  arcaneWardHp,
  portentDice,
  wardingFlareUses,
  radianceOfTheDawnDamage,
  healingLightDice,
  darkOnesBlessingTempHp,
  celestialResilienceTempHp,
  celestialResilienceAllyTempHp,
  clericDomainSpellsAtLevel,
  warlockPatronSpellsAtLevel,
  danceUnarmoredAc,
  mantleOfInspirationTempHp,
  wildMagicSurgeOnRoll,
  bendLuckDie,
  bastionOfLawWardDice,
  draconicResilienceHpBonus,
  gloriousDefenseBonus,
  paladinOathSpellsAtLevel,
  sorcererSubclassSpellsAtLevel,
  artificerSubclassSpellsAtLevel,
  blackguardViceSpellsAtLevel,
  profaneSoulArcanaSpellsAtLevel,
  bardSubclassSpellsAtLevel,
  leadershipDice,
  moonWildShapeTempHp,
  moonWildShapeMaxCr,
  moonWildShapeAc,
  landAidDice,
  wrathOfTheSeaDice,
  starryFormDice,
  primalCompanionAc,
  primalCompanionHp,
  dreadfulStrikesDie,
  dreadAmbusherDice,
  colossusSlayerDamage,
  druidCircleSpellsAtLevel,
  rangerSubclassSpellsAtLevel,
  eldritchKnightSpellsAtLevel,
  arcaneTricksterSpellsAtLevel,
  spiritShieldDice,
  stormAuraDamage,
  stormAuraTempHp,
  stormAuraDc,
  psychicBladesDice,
  mastersFlourishDie,
  forgeDivineStrikeDice,
  graveFeatureUses,
  balmPool,
  spiritTotemTempHp,
  guardianSpiritHeal,
  consultTheSpiritsSpells,
  walkerInDreamsSpells,
  arcaneShotOptionsAtLevel,
  arcaneShotSaveDc,
  arcaneShotExtraDamage,
  cavalierMarkExtraDamage,
  wardingManeuverDie,
  ferociousChargerDc,
  fightingSpiritTempHp,
  fightingSpiritUses,
  conquestAuraDamage,
  protectiveSpiritHeal,
  planarWarriorDamage,
  stormHeartDamage,
  stormsFuryDamage,
  hexbladeCurseHeal,
  strengthOfGraveDc,
  houndTempHp,
  powerSurgeDamage,
  deflectingShroudDamage,
  divineAffinitySpell,
  echoKnightAc,
  echoUses,
  chronalShiftUses,
  momentaryStasisUses,
  violentAttractionUses,
  haloOfSporesDie,
  symbioticEntityTempHp,
  orderDivineStrikeDice,
  eloquenceFloor,
  mountainDizzyingHeightsDc,
  mirrorLucentCharges,
  mirrorLucentMaxCharges,
  revelryFeatureUses,
  sandSpiritCarryCapacity,
  dustDevilTempHp,
  hunterQuarryBonus,
  hunterQuarryUsesPerCreature,
  wavesMaelstromIncrements,
  stoneDiamondDefenseTempHp,
  sliderMarkDc,
  planarDisplacementTargetCount,
  unfetteredMindContacts,
  groupRecoveryAllies,
  elementalRebukeUses,
  polarStrikesDie,
  fortifyingSoulTargets,
  chillingRetributionUses,
  bloodthirstUses,
  scionAuraDamage,
  crownLifeForceMaxDice,
  bladesongUses,
  bladesongAcBonus,
  songOfDefenseReduction,
  experimentalElixirCount,
  experimentalElixirHealingDice,
  eldritchCannonHp,
  eldritchCannonAc,
  cannonProtectorTempHp,
  cannonDetonateDice,
  cannonFirepowerDice,
  steelDefenderHp,
  steelDefenderAc,
  steelDefenderRendBonus,
  arcaneJoltDice,
  arcaneJoltUses,
  restorativeReagentsUses,
  illuminatedCartographyUses,
  atlasMaxHolders,
  giantStatureUses,
  guardianPullUses,
  infiltratorFlightUses,
  // Mechanics hooks, Families 2+7 — shared subclass-resolution helpers.
  parseClassLevels,
  featuresForActor,
  critThresholdForActor,
  hasSubclassFeature,
  featureByKey,
  SUBCLASS_POOL_DEFS,
  SUBCLASS_POOL_REST_RULES,
  subclassPoolRestRule,
  isSubclassValuePool,
  subclassPoolMaxima,
};
