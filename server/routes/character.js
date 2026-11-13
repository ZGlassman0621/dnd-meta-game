import express from 'express';
import db, { dbAll, dbGet, dbRun } from '../database.js';
import { assignWorldId } from '../services/worldIdService.js';
import * as questService from '../services/questService.js';
import * as backstoryParserService from '../services/backstoryParserService.js';
import { getCharacterRelationshipsWithNpcs } from '../services/npcRelationshipService.js';
import * as campaignService from '../services/campaignService.js';
import { getCharacterProgression } from '../services/progressionService.js';
import { getCampaignLocations } from '../services/locationService.js';
import { getCharacterStandings, getGoalsVisibleToCharacter } from '../services/factionService.js';
import { getEventsVisibleToCharacter } from '../services/worldEventService.js';
import { transferCanonToCampaign } from '../services/campaignCanonTransferService.js';
import { handleServerError, notFound, validationError } from '../utils/errorHandler.js';
import { safeParse } from '../utils/safeParse.js';
import {
  PROFICIENCY_BONUS,
  HIT_DICE,
  canLevelUp,
  getXPToNextLevel,
  getClassFeatures,
  needsSubclassSelection,
  hasASI,
  getCantripsKnown,
  getSpellsKnown,
  getSpellsPrepared,
  spellcastingAbilityFor,
  getSpellSlots,
  SUBCLASS_LEVELS,
  getAvailableMulticlassOptions,
  getMulticlassSpellSlots,
  getTotalLevel,
  getHitDiceBreakdown,
  BLOOD_HUNTER_MULTICLASS_GRANT,
  WARLORD_MULTICLASS_GRANT,
  isCastingSubclass
} from '../config/levelProgression.js';
import { validateClassSubclass, KNOWN_CLASSES, isClassPcCreatable, MVP_DEFERRED_CLASS_NOTE } from '../services/classValidationService.js';
import { isPcCreatable, resolveSpecies, resolvedASIFor, innateSpellsFor, allowedSizesFor, walkSpeedFor, MVP_DEFERRED_NOTE, isOutsideFRSetting } from '../services/speciesService.js';
import { canLearnSpell, canonicalizeSpellName } from '../services/spellSelectionService.js';
import { validatePreparedSpells } from '../services/artificerService.js';
import { validatePreparedSpells as validateBlackguardPreparedSpells } from '../services/blackguardService.js';
import { validatePreparedSpells as validatePaladinPreparedSpells } from '../services/paladinService.js';
import { validatePreparedSpells as validateSorcererPreparedSpells } from '../services/sorcererService.js';
import { validatePreparedSpells as validateRangerPreparedSpells, rangerAlwaysPreparedSpells } from '../services/rangerService.js';
import { validatePreparedSpells as validateProfaneSoulPreparedSpells } from '../services/profaneSoulService.js';
import { validatePreparedSpells as validateThirdCasterPreparedSpells } from '../services/thirdCasterService.js';
import { validatePreparedSpells as validateBardPreparedSpells } from '../services/bardService.js';
import { validatePreparedSpells as validateWarlockPreparedSpells, warlockAlwaysPreparedSpells } from '../services/warlockService.js';
import { validatePreparedSpells as validateWizardPreparedSpells } from '../services/wizardService.js';
import { validatePreparedSpells as validateClericPreparedSpells } from '../services/clericService.js';
import { validatePreparedSpells as validateDruidPreparedSpells } from '../services/druidService.js';
import {
  SPELLBOOK_START_SIZE,
  parseSpellbookState,
  serializeSpellbookState,
  pendingMemorizeSwap,
  setPendingMemorizeSwap,
  arcaneRecoveryBudget,
  parsePendingArcaneRecovery,
  pendingArcaneRecovery,
  setPendingArcaneRecovery,
  arcaneRecoveryMaxSlots,
  applyArcaneRecovery,
  alwaysPreparedSpells,
  validateBookMembership,
  validateBookAdds,
  validateSavantSpells,
  applyMemorizeSwap,
  wizardLevelFromClassLevels,
  wizardSubclassFromClassLevels,
  parseScrollName,
  copyCostForSpellLevel,
  replaceCostForSpellLevel,
  replaceCostForSpells,
  parseBookMaterialsParam,
} from '../services/spellbookService.js';
import { advanceTimeForSession } from '../services/restTimeService.js';
import { MULTICLASS_GRANT, MAGUS_SOCIETIES, SOCIETY_NAMES } from '../services/magusService.js';
import { MULTICLASS_GRANT as SCHOLAR_MULTICLASS_GRANT } from '../services/scholarService.js';
import { MULTICLASS_GRANT as PUGILIST_MULTICLASS_GRANT } from '../services/pugilistService.js';
import { getSubclass, isSubclassPcCreatable, MVP_DEFERRED_SUBCLASS_NOTE, validateSelection, artificerSubclassSpellsAtLevel, blackguardViceSpellsAtLevel, paladinOathSpellsAtLevel, sorcererSubclassSpellsAtLevel, bardSubclassSpellsAtLevel, eldritchKnightSpellsAtLevel, arcaneTricksterSpellsAtLevel, profaneSoulArcanaSpellsAtLevel, clericDomainSpellsAtLevel, druidCircleSpellsAtLevel, parseSubclassChoices, validateChoice, validateChoiceList } from '../services/subclassService.js';
import { resolveCantrips, isCatalogCantrip } from '../services/cantripResolutionService.js';
import { CLASS_CHASSIS } from '../data/classChassis.js';
import { ANCESTRY_FEATS } from '../data/ancestryFeats.js';
import { resolveTheme } from '../services/themeService.js';
import { THEME_GOLD_MODIFIERS } from '../data/themeGoldModifiers.js';
import { ARMOR_DATA } from '../services/combatStatsService.js';
import { shieldBonusForOffHand } from '../data/armsArmorVariants.js';
import { STARTING_PACKAGES } from '../data/startingPackages.js';
import { resolvePackage, validatePackageChoice, listPackageOptions, computeGoldFork } from '../services/packageResolutionService.js';
import { getFeatEffect, listFightingStyleFeats, normalizeFeatName } from '../data/featRegistry.js';
import {
  validateMixedAncestry,
  mixedAncestrySpeciesLabel,
  ancestryFeatListsFor,
  forgoOriginFeatFrom,
  parseMixedAncestry,
  MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_MESSAGE,
} from '../services/mixedAncestryService.js';
import { SPELL_DATA_ENTRIES } from '../data/spellCatalogData.js';

// Creator-next Stage 2 validation (2026-11-05, Stage 2 validation
// wiring) — called by POST / and PUT /:id below, ONLY when the body
// carries the creator-next marker (body.creator === 'creator-next',
// sent by stage1Persistence.js). Bodies without the marker — Prelude
// handoffs, seeds, tests, the character sheet — are never subjected
// to it, so old-path behavior is unchanged. The old creators are
// gone (unhook 2026-11-05), but the marker still matters: it is what
// keeps this validation off every other POST/PUT caller.
//
// Draft-tolerant by design: an absent pick is not an invalid pick.
// Stage 2 saves are draft autosaves on advance; the hard gate is
// Review (Stage 6). What the wrapper refuses, naming the field:
//   - a class the server does not know (classId),
//   - a subclass that is not a subclass of that class, or is not in
//     the server registry at all (subclassId),
//   - a subclass sent for a class that does not choose one at level 1
//     (subclassId) — after the 6-note polish, Stage 2 only collects
//     a subclass for level-1 classes (magus, scholar, warlord);
//     everyone else picks at level 3 (level 6 for keeper).
// No species/class consistency rule exists in this game (any species
// can be any class), so none is checked here. Cantrips are not
// validated here either — the spell-gating hook is a separate
// follow-up; Stage 2 saves do not send cantrips yet.
const CREATOR_NEXT_KNOWN_CLASSES = [
  ...KNOWN_CLASSES,
  // Client-offered classes whose subclasses are not server-registered
  // (keeper: subclassLevel 6). Stage 2 never collects a subclass for
  // them, so only the class check can fire — refusing them here would
  // break drafts the client legitimately offers. Their subclasses
  // stay unverifiable until the registry covers them (a separate data
  // build). Warlord's 8 Presences ARE registered (2026-11-06,
  // gaps-batch item 8b — it is in KNOWN_CLASSES via NEW_BASE_CLASSES
  // and the client picks at level 1); its entry below is now
  // redundant belt-and-braces, kept so the extension list still
  // names every class the spread does not already cover in an
  // obvious way. Blood_hunter was on this list until 2026-11-06,
  // when its 4 Orders were registered and it joined KNOWN_CLASSES
  // (classValidationService.js).
  'keeper', 'warlord',
];

// Creator-next subclass levels (2026-11-05, 2024-accuracy audit of all
// 23 classes; override REMOVED 2026-11-05 by the level-up follow-up).
// SUBCLASS_LEVELS used to carry the 2014-era values for five classes
// (cleric/sorcerer/warlock 1, druid/wizard 2); the level-up fix
// corrected the table itself to the 2024 PHB levels (every PHB class
// at 3rd), so the creator-local override became {...SUBCLASS_LEVELS}
// with no overrides and was deleted. The wrapper reads SUBCLASS_LEVELS
// directly now. The picker reads the same levels from classes.json
// subclassLevel, so the two agree on every class.
// Warlock pact (creator test-notes item 11, migration 113) — the 2024
// Pact choice (Blade / Chain / Tome) is an L1 invocation; the Stage 2
// picker sends the lowercase key and characters.pact stores it.
// Talisman is 2014-only and is never a valid value.
export const WARLOCK_PACTS = ['blade', 'chain', 'tome'];
export function normWarlockPact(value) {
  const key = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return WARLOCK_PACTS.includes(key) ? key : null;
}
// Does this character hold warlock levels — primary class, or a
// class_levels entry (multiclass). levelsRaw is the stored JSON string
// or the parsed array, same shape as the level-up route reads.
function hasWarlockLevels(cls, levelsRaw) {
  if (String(cls || '').trim().toLowerCase() === 'warlock') return true;
  const levels = typeof levelsRaw === 'string' ? safeParse(levelsRaw, null) : levelsRaw;
  return Array.isArray(levels)
    && levels.some((e) => String(e?.class ?? '').toLowerCase() === 'warlock');
}

export function validateCreatorNextStage2(body = {}, ctx = {}) {
  const rawClass = body.classId ?? body.class ?? null;
  const rawSubclass = body.subclassName ?? body.subclass ?? null;
  const cls = typeof rawClass === 'string' ? rawClass.trim().toLowerCase() : '';
  const sub = typeof rawSubclass === 'string' ? rawSubclass.trim() : '';
  // Warlock pact (item 11): a pick is validated the moment it is
  // sent, not only at Review. The class resolves body-then-stored-row
  // (a PUT re-sending only the pact omits class; ctx.row is the PUT's
  // stored row — POST and Stage 6 pass complete/merged bodies, so
  // they need no ctx). A pact with no warlock levels is refused
  // outright: the picker only shows for warlocks, so anything else is
  // a stale or tampered pick. An absent pact is a draft, not an error.
  const rawPact = body.pact ?? null;
  if (rawPact != null && String(rawPact).trim() !== '') {
    const pactKey = normWarlockPact(rawPact);
    if (!pactKey) {
      return { ok: false, errors: [`pact: '${rawPact}' is not a warlock pact — choose Blade, Chain, or Tome`] };
    }
    const effectiveCls = cls || String(ctx?.row?.class ?? '').trim().toLowerCase();
    const levelsRaw = body.class_levels ?? body.classLevels ?? ctx?.row?.class_levels ?? null;
    if (!hasWarlockLevels(effectiveCls, levelsRaw)) {
      return { ok: false, errors: [`pact: '${pactKey}' requires warlock levels — ${effectiveCls || 'no class'} has none`] };
    }
  }
  // Nothing picked yet (or a placeholder class the server itself
  // defaults to) is a draft, not an invalid pick.
  if (!cls || cls === 'creating' || cls === 'prelude') return { ok: true, errors: [] };
  if (!CREATOR_NEXT_KNOWN_CLASSES.includes(cls)) {
    return { ok: false, errors: [`classId: '${rawClass}' is not a known class`] };
  }
  const subclassLevel = SUBCLASS_LEVELS[cls];
  if (subclassLevel === 1) {
    // A level-1 class with no subclass yet is still a draft — the
    // subclass is required at Review, not at Stage 2 advance.
    if (!sub) return { ok: true, errors: [] };
    return validateClassSubclass({ classId: cls, subclassId: sub });
  }
  // Any other class chooses its subclass later (level 3/6, or not
  // recorded in SUBCLASS_LEVELS for warlord) — a
  // subclass sent now can only be a stale or tampered pick.
  if (sub) {
    return {
      ok: false,
      errors: [`subclassId: '${rawSubclass}' was sent but ${cls} does not choose a subclass at level 1${subclassLevel ? ` (subclass level ${subclassLevel})` : ''}`],
    };
  }
  return { ok: true, errors: [] };
}

// Creator-next Stage 3 validation (2026-11-06) — called by POST /
// and PUT /:id below, ONLY when the body carries the creator-next
// marker, next to the Stage 2 guard. Same draft-tolerance as Stage 2:
// an absent pick is not an invalid pick; the hard gate is Review
// (Stage 6). What the wrapper refuses, naming the field:
//   - a theme id the server does not know (themeId),
//   - an origin feat sent without a theme (originFeat),
//   - a feat that is not a category-'origin' registry entry, or is
//     not in the registry at all (originFeat),
//   - a feat that is not the theme's FIXED origin_feat (originFeat,
//     naming the expected feat),
//   - the theme origin feat forgone for the mixed-ancestry trade
//     (originFeat),
//   - Magic Initiate choices (when present): the spell list must
//     equal the theme's fixed origin_feat_spell_list, the
//     spellcasting ability must be Intelligence/Wisdom/Charisma,
//     and exactly 2 distinct cantrips + 1 level-1 spell, each valid
//     for that list in the server spell catalog (originFeatChoices),
//   - other subchoice feats — Skilled, Musician, Crafter — (when
//     present): shape-only, at most 3 distinct non-empty picks
//     (originFeatChoices). The ancestry pattern does not
//     server-validate subchoice contents, and neither does this.
//   - Human Versatile (item 19, 2026-11-06): a pick that is not a
//     2024 origin feat, a pick on a non-human, or a pick equal to
//     the theme's origin feat (versatileFeat); its subchoices follow
//     the same rules under versatileFeatChoices, except a Versatile
//     Magic Initiate list is the player's choice of Cleric, Druid,
//     or Wizard (the theme slot's list is fixed).
//   - Mixed-ancestry Versatile (R2-5, 2026-11-09): the mixed
//     record's versatileFeat pick equal to the theme's origin feat
//     (mixedAncestry.versatileFeat) — the same different-feats
//     rule, read from the body record or ctx.mixedAncestry;
//     skipped when the theme feat was forgone for +4 budget.
// Choices sent without their feat, and feats that need no picks
// (Alert, Healer, Lucky, Savage Attacker, Tavern Brawler, Tough)
// carrying stray choices, are ignored — the feat pick is the unit
// of validation, and a draft may legitimately hold half a pick.
// Body fields are snake_case (theme_id, origin_feat,
// origin_feat_choices, versatile_feat, versatile_feat_choices)
// with camelCase aliases accepted.
const ORIGIN_FEAT_SPELL_ABILITIES = new Set(['intelligence', 'wisdom', 'charisma']);
const ORIGIN_FEAT_SPELL_LISTS = new Set(['cleric', 'druid', 'wizard']);
const ORIGIN_SUBCHOICE_FEATS = new Set(['skilled', 'musician', 'crafter']);

function normFeatKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

// Direct catalog check for a Magic Initiate pick. canLearnSpell does
// NOT fit here: it requires a classId and enforces that class's slot
// table, but Magic Initiate is list-based and class-agnostic — a
// fighter acolyte learns Cleric cantrips. The rule is the list: the
// spell must exist in the catalog, be of the required level, and
// carry the list's class name in its `classes` array.
function checkMagicInitiateSpell(name, listName, level) {
  const display = typeof name === 'string' ? name.trim() : '';
  if (!display) return 'empty spell name';
  const entry = SPELL_DATA_ENTRIES[canonicalizeSpellName(display)];
  if (!entry) return `'${display}' is not in the spell catalog`;
  if (Number(entry.level) !== level) {
    return `'${display}' is a level ${entry.level} spell, not a ${level === 0 ? 'cantrip' : 'level 1 spell'}`;
  }
  const onList = (entry.classes || []).some(c => String(c).toLowerCase() === listName.toLowerCase());
  if (!onList) return `'${display}' is not on the ${listName} spell list`;
  return null;
}

function originSubchoicePicks(choices) {
  // Accept an array of picks, or an object whose values are picks
  // (or arrays of picks). Anything else is a malformed pick, not an
  // absent one. Returns null for a wrong shape, [] for no picks yet.
  if (Array.isArray(choices)) return choices;
  if (choices && typeof choices === 'object') {
    const out = [];
    for (const v of Object.values(choices)) {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) out.push(...v.filter(x => typeof x === 'string'));
      else if (v != null) return null;
    }
    return out;
  }
  return null;
}

// Shared origin-feat subchoice validation for ONE slot (theme or
// versatile). entry: the featRegistry entry; choices: the slot's
// choices object (null = no picks yet, a draft); field: the error
// field name for this slot ('originFeatChoices' /
// 'versatileFeatChoices'); fixedList: the Magic Initiate spell list
// for the slot — the theme's fixed origin_feat_spell_list for the
// theme slot, null for the versatile slot (the player chooses the
// list); themeName: the theme name for the fixed-list message, null
// for the versatile slot. Returns an array of errors (empty =
// valid). The messages are the ones validateCreatorNextStage3 used
// inline before this extraction — the theme slot's text is unchanged.
function validateOriginFeatChoices(entry, choices, field, fixedList, themeName) {
  const errs = [];
  if (choices == null) return errs;
  if (entry.key === 'magic_initiate') {
    if (typeof choices !== 'object' || Array.isArray(choices)) {
      errs.push(`${field}: Magic Initiate choices must be an object { spell_list, spellcasting_ability, cantrips, level1_spell }`);
      return errs;
    }
    const spellList = choices.spell_list ?? choices.spellList ?? null;
    let list = fixedList;
    if (fixedList != null) {
      if (spellList != null && String(spellList).trim().toLowerCase() !== String(fixedList).toLowerCase()) {
        errs.push(`${field}: spell list must be '${fixedList}'${themeName ? ` for theme '${themeName}'` : ''}`);
      }
    } else if (spellList != null && !ORIGIN_FEAT_SPELL_LISTS.has(String(spellList).trim().toLowerCase())) {
      errs.push(`${field}: spell list must be Cleric, Druid, or Wizard`);
    } else if (spellList != null) {
      list = spellList;
    }
    const ability = choices.spellcasting_ability ?? choices.spellcastingAbility ?? null;
    if (ability != null && !ORIGIN_FEAT_SPELL_ABILITIES.has(String(ability).trim().toLowerCase())) {
      errs.push(`${field}: spellcasting ability must be Intelligence, Wisdom, or Charisma`);
    }
    const cantrips = choices.cantrips ?? null;
    if (cantrips != null && !(Array.isArray(cantrips) && cantrips.length === 0)) {
      if (!Array.isArray(cantrips) || cantrips.length !== 2) {
        errs.push(`${field}: Magic Initiate needs exactly 2 cantrips`);
      } else if (list != null) {
        const seen = new Set();
        for (const c of cantrips) {
          if (typeof c !== 'string' || !c.trim()) {
            errs.push(`${field}: cantrips must be non-empty spell names`);
            break;
          }
          const k = c.trim().toLowerCase();
          if (seen.has(k)) {
            errs.push(`${field}: cantrip '${c.trim()}' was picked twice`);
            break;
          }
          seen.add(k);
          const reason = checkMagicInitiateSpell(c, list, 0);
          if (reason) errs.push(`${field}: cantrip ${reason}`);
        }
      }
    }
    const level1 = choices.level1_spell ?? choices.level1Spell ?? choices.spell ?? null;
    if (level1 != null) {
      if (typeof level1 !== 'string' || !level1.trim()) {
        errs.push(`${field}: level 1 spell must be a non-empty spell name`);
      } else if (list != null) {
        const reason = checkMagicInitiateSpell(level1, list, 1);
        if (reason) errs.push(`${field}: level 1 spell ${reason}`);
      }
    }
  } else if (ORIGIN_SUBCHOICE_FEATS.has(entry.key)) {
    const picks = originSubchoicePicks(choices);
    if (picks === null) {
      errs.push(`${field}: ${entry.name} picks must be a list of up to 3 choices`);
    } else if (picks.length > 0) {
      if (picks.length > 3) {
        errs.push(`${field}: ${entry.name} takes at most 3 picks, got ${picks.length}`);
      }
      const seen = new Set();
      for (const p of picks) {
        if (typeof p !== 'string' || !p.trim()) {
          errs.push(`${field}: ${entry.name} picks must be non-empty strings`);
          break;
        }
        const k = stage4NormListName(p);
        if (seen.has(k)) {
          errs.push(`${field}: '${p.trim()}' was picked twice for ${entry.name}`);
          break;
        }
        seen.add(k);
      }
      // Membership (item 17, 2026-11-06): shape-only was the gap —
      // any three strings passed. Skilled takes any combination of
      // three skills or tools (2024 feat text, featRegistry effect:
      // "Proficiency in any combination of three skills or tools of
      // your choice" — skills-only would wrongly refuse a Skilled
      // tool pick); Musician takes musical instruments; Crafter
      // takes artisan's tools. The lists are the frozen server
      // subsets above (STAGE4_SKILLS / STAGE4_TOOLS), never a client
      // import — the same frozen-list pattern as STAGE4_*.
      const allowed = entry.key === 'skilled'
        ? new Set([...STAGE4_SKILLS, ...STAGE4_TOOLS].map((s) => s.toLowerCase()))
        : entry.key === 'musician'
          ? new Set(STAGE4_INSTRUMENTS.map((s) => s.toLowerCase()))
          : new Set(STAGE4_ARTISAN_TOOLS.map((s) => s.toLowerCase()));
      const kindLabel = entry.key === 'skilled'
        ? 'a skill or tool'
        : entry.key === 'musician' ? 'a musical instrument' : "an artisan's tool";
      for (const p of picks) {
        if (typeof p !== 'string' || !p.trim()) continue; // already reported above
        if (!allowed.has(stage4NormListName(p))) {
          errs.push(`${field}: '${p.trim()}' is not ${kindLabel} for ${entry.name}`);
        }
      }
    }
  }
  // Feats that need no picks ignore stray choices (see header note).
  return errs;
}

// The theme slot, on its own: the theme's FIXED origin feat + its
// subchoices. Returns { errors, entry } — entry is the resolved
// registry entry when the slot validates, else null. The early
// returns are the pre-refactor behavior: when the theme slot is
// active and fails, its error is the whole story.
function validateThemeOriginFeatSlot(body, theme, themePresent, ctx) {
  const errors = [];
  const rawFeat = body.origin_feat ?? body.originFeat ?? null;
  const featKey = typeof rawFeat === 'string' ? rawFeat.trim() : '';
  if (!themePresent) {
    errors.push(`originFeat: '${rawFeat}' was sent without a theme`);
    return { errors, entry: null };
  }
  // Theme id was present but unknown — the themeId error above is
  // the whole story; there is no known theme to check the feat against.
  if (!theme) return { errors, entry: null };
  // Mixed Ancestry forgo trade (2026-11-06): giving up the theme's
  // origin feat buys +4 power budget. A body carrying the trade —
  // its own mixed_ancestry, or the stored record via ctx on PUT —
  // may not also carry an origin-feat grant. The ctx fallback is
  // what catches a resumed creator whose stored trade is on but
  // whose PUT body only re-sends the theme feat.
  const forgo = forgoOriginFeatFrom(body.mixed_ancestry ?? body.mixedAncestry ?? null)
    || forgoOriginFeatFrom(ctx.mixedAncestry ?? null);
  if (forgo) {
    errors.push(MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_MESSAGE);
    return { errors, entry: null };
  }
  const entry = getFeatEffect(featKey);
  if (!entry || entry.category !== 'origin') {
    errors.push(`originFeat: '${rawFeat}' is not a 2024 origin feat`);
    return { errors, entry: null };
  }
  if (normFeatKey(entry.key) !== normFeatKey(theme.origin_feat)) {
    const expected = getFeatEffect(theme.origin_feat);
    errors.push(`originFeat: '${rawFeat}' does not match the fixed origin feat for theme '${theme.name}' (${expected?.name || theme.origin_feat})`);
    return { errors, entry: null };
  }
  const choices = body.origin_feat_choices ?? body.originFeatChoices ?? null;
  errors.push(...validateOriginFeatChoices(entry, choices, 'originFeatChoices', theme.origin_feat_spell_list, theme.name));
  return { errors, entry };
}

export function validateCreatorNextStage3(body = {}, ctx = {}) {
  const errors = [];
  const rawTheme = body.theme_id ?? body.themeId ?? null;
  const themePresent = rawTheme != null && String(rawTheme).trim() !== '';
  const theme = themePresent ? resolveTheme(rawTheme) : null;
  if (themePresent && !theme) {
    errors.push(`themeId: '${rawTheme}' is not a known theme`);
  }
  // Theme slot: validates only when a feat pick is sent; an absent
  // pick is a draft, not an invalid pick. The versatile slot below
  // validates independently.
  const rawFeat = body.origin_feat ?? body.originFeat ?? null;
  const featKey = typeof rawFeat === 'string' ? rawFeat.trim() : '';
  if (featKey) {
    const slot = validateThemeOriginFeatSlot(body, theme, themePresent, ctx);
    errors.push(...slot.errors);
    if (slot.errors.length > 0) return { ok: false, errors };
  }

  // Human Versatile (item 19, 2026-11-06): the standalone 2024
  // human trait — any ONE origin feat, chosen at Stage 1. Stacks
  // with the theme's fixed origin feat, but the two feats must be
  // different (coordinator ruling: same feat twice is refused).
  // Species gate reads the registry flag (human.versatile2024), not
  // a hardcoded id — the flag is the source of truth. Mixed-ancestry
  // characters do NOT get this slot: their race is the
  // "Mixed Ancestry (A / B)" label, which resolves to no registry
  // entry, so they are refused here; they get Versatile only via the
  // mixed-ancestry trait pick (cost 4, stored in the mixed JSON).
  // Race absent = draft, not a refusal.
  const rawVersatile = body.versatile_feat ?? body.versatileFeat ?? null;
  const versatileKey = typeof rawVersatile === 'string' ? rawVersatile.trim() : '';
  if (versatileKey) {
    const rawRace = body.race ?? ctx.row?.race ?? null;
    const rawSubrace = body.subrace ?? ctx.row?.subrace ?? null;
    if (typeof rawRace === 'string' && rawRace.trim()) {
      const resolved = resolveSpecies(rawRace, rawSubrace);
      if (!resolved || resolved.entry.id !== 'human' || resolved.entry.versatile2024 !== true) {
        errors.push(`versatileFeat: '${rawVersatile}' is only available to human characters (2024 Versatile)`);
        return { ok: false, errors };
      }
    }
    const vEntry = getFeatEffect(versatileKey);
    if (!vEntry || vEntry.category !== 'origin') {
      errors.push(`versatileFeat: '${rawVersatile}' is not a 2024 origin feat`);
      return { ok: false, errors };
    }
    if (theme && normFeatKey(vEntry.key) === normFeatKey(theme.origin_feat)) {
      const expected = getFeatEffect(theme.origin_feat);
      errors.push(`versatileFeat: '${rawVersatile}' is already the theme's origin feat (${expected?.name || theme.origin_feat}) — the Versatile feat must be a different origin feat`);
      return { ok: false, errors };
    }
    // No theme in this body (a resumed PUT re-sending only the
    // versatile pick): judge against the stored theme feat via ctx.
    if (!theme && ctx.themeOriginFeatKey && normFeatKey(vEntry.key) === normFeatKey(ctx.themeOriginFeatKey)) {
      const expected = getFeatEffect(ctx.themeOriginFeatKey);
      errors.push(`versatileFeat: '${rawVersatile}' is already the theme's origin feat (${expected?.name || ctx.themeOriginFeatKey}) — the Versatile feat must be a different origin feat`);
      return { ok: false, errors };
    }
    const vChoices = body.versatile_feat_choices ?? body.versatileFeatChoices ?? null;
    errors.push(...validateOriginFeatChoices(vEntry, vChoices, 'versatileFeatChoices', null, null));
  }

  // Mixed-ancestry Versatile (R2-5, 2026-11-09 — coordinator
  // decision, aligning with the single-human rule): the mixed
  // Human Versatile trait pick (stored as versatileFeat in the
  // mixed record, validated for trait + 2024-origin-feat
  // membership by validateMixedAncestry) must ALSO differ from
  // the theme's origin feat. The single-human slot above cannot
  // see it — mixed characters are refused that slot, so the pick
  // only exists in the mixed record (body, or ctx.mixedAncestry
  // on a resumed PUT / commit). Eligibility itself is NOT
  // filtered by parents or other powers: any origin feat is
  // valid, the trait's own 4 budget is the only cost.
  // Forgone theme feat: no theme feat is granted, so there is
  // nothing to duplicate — the check is skipped.
  const mixedForCheck = parseMixedAncestry(body.mixed_ancestry ?? body.mixedAncestry ?? ctx.mixedAncestry ?? null);
  const mixedVersRaw = mixedForCheck?.versatileFeat ?? mixedForCheck?.versatile_feat ?? null;
  const mixedVersKey = typeof mixedVersRaw === 'string' ? mixedVersRaw.trim() : '';
  if (mixedVersKey) {
    const forgoMixed = forgoOriginFeatFrom(body.mixed_ancestry ?? body.mixedAncestry ?? null)
      || forgoOriginFeatFrom(ctx.mixedAncestry ?? null);
    if (!forgoMixed) {
      const themeFeatKey = theme?.origin_feat ?? ctx.themeOriginFeatKey ?? null;
      if (themeFeatKey) {
        const mEntry = getFeatEffect(mixedVersKey);
        if (mEntry && normFeatKey(mEntry.key) === normFeatKey(themeFeatKey)) {
          const expected = getFeatEffect(themeFeatKey);
          errors.push(`mixedAncestry.versatileFeat: '${mixedVersRaw.trim()}' is already the theme's origin feat (${expected?.name || themeFeatKey}) — the Versatile feat must be a different origin feat`);
          return { ok: false, errors };
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// Creator-next Stage 4 validation (2026-11-06) — called by POST /
// and PUT /:id below, ONLY when the body carries the creator-next
// marker, after the Stage 3 guard. Same draft-tolerance as Stages
// 2/3: an absent pick is not an invalid pick; the hard gate is
// Review (Stage 6). What the wrapper refuses, naming the field:
//   - base_scores with an unknown generation_method, or bases
//     outside that method's ranges (point-buy 8-15 and cost <= 27,
//     standard array exactly {15,14,13,12,10,8}, manual 3-18)
//     (baseScores: / generationMethod:),
//   - ability_choice_picks whose count is not the species' resolved
//     `choice` N, or that repeat an ability (abilityChoicePicks:),
//   - final ability_scores that do not equal base + species fixed
//     ASI + choice picks + theme ASI, per ability (abilityScores:).
//     No clamping, and no refusal for a final over 18 — the level-1
//     cap of 18 clamps at submit/Review, and the client warns.
//   - skills / languages / tool_proficiencies entries that are not
//     non-empty strings, are not in the known lists, or repeat
//     (skills: / languages: / toolProficiencies:); skills that omit
//     the theme's 2 signature skills; languages that omit the
//     species languages (skills: / languages:),
//   - class skill picks beyond the class's chassis count, or a class
//     pick outside the class's allowed list (skills:), enforced
//     against the server-side class-chassis registry (item 22);
//     explicit class_skill_picks in the body are authoritative,
//     otherwise class picks are derived as submitted minus theme
//     minus feat-granted skills (see the item-22 block),
//   - known_spells / prepared_spells entries that fail canLearnSpell
//     at level 1 for the character's class, that duplicate a pick,
//     that are already granted (species innate, dragonmark, Magic
//     Initiate), or whose count is not the level-1 count for the
//     class (knownSpells: / preparedSpells:).
// known_cantrips is NOT validated here — Stage 2 territory; the
// creator sends no cantrips yet.
// Body fields are snake_case with camelCase aliases accepted.
// Lists accept a JSON array or a JSON string holding one (the row
// stores JSON strings; the route passes body values through as
// today). `ctx` carries PUT context the body may omit: { row (the
// stored character row), themeId, originFeatKey, originFeatChoices }
// — the route reads those before validating, so a PUT that sends
// spells without re-sending its class still gates against the
// row's class. Only fields the BODY sends are validated; ctx only
// supplies resolution inputs (class, race, theme, final scores,
// granted Magic Initiate spell), never re-validates stored lists.
const STAGE4_POINT_BUY_COST = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
const STAGE4_STANDARD_ARRAY = [8, 10, 12, 13, 14, 15];
// Frozen pick lists (Stage 4). No server-side skill/language/tool
// list exists in server/data/ — the live sources are client-side,
// so these are transcribed verbatim from them (nothing invented):
//   - skills (18): client/src/data/references.js SKILLS, cross-
//     checked against server/services/rollRequestService.js
//     SKILL_ABILITY_MAP (same 18 display names) and
//     dmPromptBuilder.js (same map). Stored format is display names,
//     compared case-insensitively (rollRequestService does
//     String(s).toLowerCase() === skill.toLowerCase()).
//   - languages (18 + 7): references.js LANGUAGES (18, incl.
//     Druidic + Thieves' Cant) plus the 7 concrete species
//     languages that appear in server/data/species/*.js but not in
//     references.js (Aarakocra, Aquan, Auran, Loxodon, Minotaur,
//     Quori, Vedalken) — included so the species-language inclusion
//     rule can never demand a language membership refuses.
//     'One language of your choice' / 'Two extra languages of your
//     choice' are choice placeholders, not languages: excluded.
//   - tools (37): references.js TOOLS keys, identical to
//     client/src/data/equipment.json tools (17 artisan + 4 gaming
//     + 6 kits + 10 instruments).
const STAGE4_SKILLS = [
  'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception',
  'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine',
  'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion',
  'Sleight of Hand', 'Stealth', 'Survival',
];
const STAGE4_LANGUAGES = [
  'Common', 'Dwarvish', 'Elvish', 'Giant', 'Gnomish', 'Goblin',
  'Halfling', 'Orc', 'Abyssal', 'Celestial', 'Deep Speech', 'Draconic',
  'Infernal', 'Primordial', 'Sylvan', 'Undercommon', 'Druidic',
  "Thieves' Cant",
  'Aarakocra', 'Aquan', 'Auran', 'Loxodon', 'Minotaur', 'Quori', 'Vedalken',
];
const STAGE4_TOOLS = [
  "Alchemist's Supplies", "Brewer's Supplies", "Calligrapher's Supplies",
  "Carpenter's Tools", "Cartographer's Tools", "Cobbler's Tools",
  "Cook's Utensils", "Glassblower's Tools", "Jeweler's Tools",
  "Leatherworker's Tools", "Mason's Tools", "Painter's Supplies",
  "Potter's Tools", "Smith's Tools", "Tinker's Tools", "Weaver's Tools",
  "Woodcarver's Tools",
  'Dice Set', 'Dragonchess Set', 'Playing Card Set', 'Three-Dragon Ante Set',
  'Disguise Kit', 'Forgery Kit', 'Herbalism Kit', "Navigator's Tools",
  "Poisoner's Kit", "Thieves' Tools",
  'Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn',
  'Pan Flute', 'Shawm', 'Viol',
];

// Frozen subsets of STAGE4_TOOLS (Stage 3 origin-feat validation,
// item 17): the first 17 are the artisan's tools (identical to
// client/src/data/equipment.json tools.artisansTools), the last 10
// are the musical instruments (equipment.json musicalInstruments).
const STAGE4_ARTISAN_TOOLS = STAGE4_TOOLS.slice(0, 17);
const STAGE4_INSTRUMENTS = STAGE4_TOOLS.slice(-10);

const STAGE4_ABILITY_ALIASES = {
  str: 'str', strength: 'str', dex: 'dex', dexterity: 'dex',
  con: 'con', constitution: 'con', int: 'int', intelligence: 'int',
  wis: 'wis', wisdom: 'wis', cha: 'cha', charisma: 'cha',
};
const STAGE4_ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function stage4NormAbilityKey(value) {
  if (typeof value !== 'string') return null;
  return STAGE4_ABILITY_ALIASES[value.trim().toLowerCase()] || null;
}

function stage4AbilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

// Parse a six-score object: accepts a plain object or a JSON string
// holding one; keys may be 3-letter ('str') or full ('strength').
// Returns normalized {str,dex,con,int,wis,cha} numbers, or null when
// the shape is wrong or any score is missing / non-numeric.
function stage4ParseScores(value) {
  let obj = value;
  if (typeof value === 'string') {
    try { obj = JSON.parse(value); } catch { return null; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return null;
  const out = {};
  for (const key of STAGE4_ABILITY_KEYS) {
    const raw = obj[key] ?? obj[{ str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }[key]];
    if (raw == null || !Number.isFinite(Number(raw))) return null;
    out[key] = Number(raw);
  }
  return out;
}

// Parse a string list: accepts a JSON array or a JSON string holding
// one. Returns the array, or null when the shape is wrong.
function stage4ParseStringList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : null;
    } catch { return null; }
  }
  return null;
}

// Canonical form for name lists (skills / languages / tools /
// expertise / feat-granted picks) — creator test-notes item 20
// (2026-11-09). The client sends snake_case keys ('animal_handling',
// 'sleight_of_hand') while the server lists hold display names
// ('Animal Handling', 'Sleight of Hand'); both spellings must match
// the same entry, so every name-list comparison lowercases, trims,
// and folds underscores to spaces. The canonical comparison form is
// the lowercased display name ('animal handling'); the canonical
// STORED form is the display spelling ('Animal Handling') — see
// stage4CanonicalListJson below.
// Deliberately NOT folded into stage4ParseStringList: that parser
// also reads spell lists and inventory, where underscore-folding
// would change stored values.
function stage4NormListName(value) {
  return String(value || '').trim().toLowerCase().replace(/_/g, ' ');
}

// Canonical STORED form for a name list: the display spelling from
// knownList ('Animal Handling'), as a JSON string. Returns null when
// the input is absent, unparsable, or holds an entry the list does
// not know — the caller then stores exactly what was sent. Used on
// the POST/PUT store path so a snake_case save persists the display
// form: roll-time proficiency checks (rollRequestService) compare
// stored entries against display names, so a stored 'animal_handling'
// would silently lose its proficiency even though validation passed.
function stage4CanonicalListJson(raw, knownList) {
  if (raw == null) return null;
  const list = stage4ParseStringList(raw);
  if (list === null) return null;
  const out = [];
  for (const entry of list) {
    if (typeof entry !== 'string' || !entry.trim()) return null;
    const display = knownList.find((x) => x.toLowerCase() === stage4NormListName(entry));
    if (!display) return null;
    out.push(display);
  }
  return JSON.stringify(out);
}

// Spells this character already has without picking them (Stage 4
// granted-spell exclusion). Derivable from body/row with no new
// tables: species innate spells at character level 1 (innate
// entries with atLevel > 1 are not granted yet), the dragonmark's
// level-1 mark spells, and the Magic Initiate level-1 spell.
// Returns a Map of canonical lowercase name -> source label.
// Subclass-granted spells need no row here: no subclass grants a
// leveled spell at level 1 (cleric domains / blackguard Vice spells
// start at 3rd). Ancestry-feat granted spells arrive via
// ctx.ancestryFeatSpells (item 21: pre-loaded by
// readCreatorNextStage4Context from the persisted feat row, so this
// validator stays sync). Names are canonicalized on both sides of
// the match (item 13), so a print spelling can never break it.
// Ranger (2026-11-06, PHB p. 120): Favored Enemy — Hunter's Mark
// is always prepared from L1, so it is granted here too: a ranger
// who lists it among prepared_spells is told it is already granted
// and it does not consume one of the 2 L1 prepared picks.
function stage4GrantedSpells(body, ctx, race, subrace, cls = null) {
  const granted = new Map();
  if (typeof cls === 'string' && cls.trim().toLowerCase() === 'ranger') {
    granted.set(canonicalizeSpellName("Hunter's Mark"), 'Favored Enemy spell');
  }
  if (race) {
    for (const entry of innateSpellsFor(race, subrace) || []) {
      if (!entry || typeof entry.name !== 'string') continue; // {choose} entries have no name
      if (Number(entry.level) >= 1 && (entry.atLevel == null || Number(entry.atLevel) <= 1)) {
        granted.set(canonicalizeSpellName(entry.name.trim()), 'species innate spell');
      }
    }
    const variant = resolveSpecies(race, subrace)?.variant;
    for (const row of variant?.markSpells || []) {
      if (Number(row?.level) !== 1) continue;
      for (const name of row?.spells || []) {
        if (typeof name === 'string' && name.trim()) {
          granted.set(canonicalizeSpellName(name.trim()), 'dragonmark spell');
        }
      }
    }
  }
  const featKey = body.origin_feat ?? body.originFeat ?? ctx.originFeatKey ?? null;
  const choices = body.origin_feat_choices ?? body.originFeatChoices ?? ctx.originFeatChoices ?? null;
  if (typeof featKey === 'string' && normFeatKey(featKey) === 'magic initiate'
    && choices && typeof choices === 'object' && !Array.isArray(choices)) {
    const level1 = choices.level1_spell ?? choices.level1Spell ?? choices.spell ?? null;
    if (typeof level1 === 'string' && level1.trim()) {
      granted.set(canonicalizeSpellName(level1.trim()), 'Magic Initiate spell');
    }
  }
  // Versatile slot (human L1 feat — Stage 6 fix 2026-11-07): its
  // Magic Initiate level-1 spell is likewise granted, never counted.
  // The theme block above handled only the theme slot, so a versatile
  // MI spell wrongly consumed one of the character's prepared picks
  // (and, at commit, would have forced one fewer prepared spell).
  // Same shape as the theme block; the versatile list is the
  // player's choice, not a theme-fixed list.
  const versFeatKey = body.versatile_feat ?? body.versatileFeat ?? ctx.versatileFeatKey ?? null;
  const versChoices = body.versatile_feat_choices ?? body.versatileFeatChoices ?? ctx.versatileFeatChoices ?? null;
  if (typeof versFeatKey === 'string' && normFeatKey(versFeatKey) === 'magic initiate'
    && versChoices && typeof versChoices === 'object' && !Array.isArray(versChoices)) {
    const level1 = versChoices.level1_spell ?? versChoices.level1Spell ?? versChoices.spell ?? null;
    if (typeof level1 === 'string' && level1.trim()) {
      granted.set(canonicalizeSpellName(level1.trim()), 'Magic Initiate spell');
    }
  }
  for (const name of ctx.ancestryFeatSpells || []) {
    if (typeof name === 'string' && name.trim()) {
      granted.set(canonicalizeSpellName(name.trim()), 'ancestry feat spell');
    }
  }
  return granted;
}

// Feat-granted skill picks visible to the Stage 4 validator, for
// subtracting from the submitted skill list when deriving class
// picks (item 22): the origin feat's Skilled picks (skills only —
// Skilled tools land in tool_proficiencies, not skills) and the
// ancestry feat's skill choices, from the body when sent or from
// the PUT context when stored. Returns a Set of lowercase skill
// names. Anything the server cannot see is not subtracted — see
// the item-22 note in validateCreatorNextStage4.
// The versatile slot (human L1 feat — Stage 6 fix 2026-11-07) is
// subtracted too: a versatile Skilled pick is a feat grant, not a
// class pick, and without this a human with Versatile Skilled was
// refused for "too many class picks".
function stage4FeatSkillPicks(originFeatKey, originChoices, ancestryChoices, versatileFeatKey = null, versatileChoices = null) {
  const out = new Set();
  const skillSet = new Set(STAGE4_SKILLS.map((s) => s.toLowerCase()));
  if (typeof originFeatKey === 'string' && normFeatKey(originFeatKey) === 'skilled') {
    for (const p of originSubchoicePicks(originChoices) || []) {
      if (typeof p === 'string' && skillSet.has(stage4NormListName(p))) {
        out.add(stage4NormListName(p));
      }
    }
  }
  if (typeof versatileFeatKey === 'string' && normFeatKey(versatileFeatKey) === 'skilled') {
    for (const p of originSubchoicePicks(versatileChoices) || []) {
      if (typeof p === 'string' && skillSet.has(stage4NormListName(p))) {
        out.add(stage4NormListName(p));
      }
    }
  }
  if (ancestryChoices && typeof ancestryChoices === 'object' && !Array.isArray(ancestryChoices)) {
    for (const v of Object.values(ancestryChoices)) {
      const vals = Array.isArray(v) ? v : [v];
      for (const s of vals) {
        if (typeof s === 'string' && skillSet.has(stage4NormListName(s))) {
          out.add(stage4NormListName(s));
        }
      }
    }
  }
  return out;
}

export function validateCreatorNextStage4(body = {}, ctx = {}) {
  const errors = [];
  const row = ctx.row || null;

  // --- Resolution inputs: body wins, PUT row/ctx fills gaps. ---
  const rawClass = body.classId ?? body.class ?? row?.class ?? null;
  const cls = typeof rawClass === 'string' ? rawClass.trim().toLowerCase() : '';
  const rawSubclass = body.subclassName ?? body.subclass ?? row?.subclass ?? null;
  const subclass = typeof rawSubclass === 'string' ? rawSubclass.trim() : '';
  const rawRace = body.race ?? row?.race ?? null;
  const race = typeof rawRace === 'string' ? rawRace.trim() : '';
  const rawSubrace = body.subrace ?? row?.subrace ?? null;
  const subrace = typeof rawSubrace === 'string' ? rawSubrace.trim() : '';
  const rawThemeId = body.theme_id ?? body.themeId ?? ctx.themeId ?? null;
  const themePresent = rawThemeId != null && String(rawThemeId).trim() !== '';
  const theme = themePresent ? resolveTheme(rawThemeId) : null;
  // An unknown theme id is Stage 3's refusal; Stage 4 skips every
  // theme-dependent check rather than piling on.
  const species = race ? resolvedASIFor(race, subrace || null) : null;
  const speciesResolved = race ? species !== null : false;

  // --- Scores: generation method + base ranges. ---
  const baseRaw = body.base_scores ?? body.baseScores ?? null;
  const base = baseRaw != null ? stage4ParseScores(baseRaw) : null;
  if (baseRaw != null && !base) {
    errors.push('baseScores: must give all six ability scores (str, dex, con, int, wis, cha)');
  }
  const genMethodRaw = body.generation_method ?? body.generationMethod ?? null;
  const genMethod = typeof genMethodRaw === 'string' ? genMethodRaw.trim().toLowerCase() : null;
  if (base && genMethod != null && !['point_buy', 'standard_array', 'manual'].includes(genMethod)) {
    errors.push(`generationMethod: '${genMethodRaw}' must be point_buy, standard_array, or manual`);
  }
  if (base && genMethod === 'point_buy') {
    let cost = 0;
    for (const key of STAGE4_ABILITY_KEYS) {
      const v = base[key];
      if (!Number.isInteger(v) || v < 8 || v > 15) {
        errors.push(`baseScores: point-buy ${key} must be 8-15, got ${v}`);
      } else {
        cost += STAGE4_POINT_BUY_COST[v];
      }
    }
    if (cost > 27) errors.push(`baseScores: point-buy total cost is ${cost}, over the 27-point budget`);
  } else if (base && genMethod === 'standard_array') {
    const have = STAGE4_ABILITY_KEYS.map((k) => base[k]).sort((a, b) => a - b);
    const want = [...STAGE4_STANDARD_ARRAY].sort((a, b) => a - b);
    if (have.some((v, i) => v !== want[i])) {
      errors.push('baseScores: standard array must be exactly {15, 14, 13, 12, 10, 8}');
    }
  } else if (base && genMethod === 'manual') {
    for (const key of STAGE4_ABILITY_KEYS) {
      const v = base[key];
      if (!Number.isInteger(v) || v < 3 || v > 18) {
        errors.push(`baseScores: manual ${key} must be 3-18, got ${v}`);
      }
    }
  }
  // Without a generation method the bases cannot be judged (draft
  // — the client sends method + bases together); skip range checks.

  // --- Ability choice picks (species `choice: N`). ---
  const picksRaw = body.ability_choice_picks ?? body.abilityChoicePicks ?? null;
  const choiceN = species && Number.isInteger(species.choice) ? species.choice : 0;
  const picks = {};
  let picksCountOk = true;
  let picksParsed = false;
  if (picksRaw != null) {
    let pickKeys = null;
    // The client stringifies this field on the wire (same as every
    // other Stage 4 JSON field — the route's JSON columns are JSON
    // strings), so a JSON string holding the list/object is accepted
    // exactly like the list/object itself. An unparseable string, or
    // a parsed value that is neither, keeps the error below.
    let picksInput = picksRaw;
    if (typeof picksInput === 'string') {
      try { picksInput = JSON.parse(picksInput); } catch { picksInput = null; }
    }
    if (Array.isArray(picksInput)) {
      pickKeys = picksInput;
    } else if (picksInput && typeof picksInput === 'object') {
      const bad = Object.entries(picksInput).some(([, v]) => v !== 1);
      pickKeys = bad ? null : Object.keys(picksInput);
    }
    if (pickKeys === null) {
      errors.push('abilityChoicePicks: must be a list of ability keys, or an object mapping ability keys to +1');
      picksCountOk = false;
    } else {
      const seen = new Set();
      for (const raw of pickKeys) {
        const key = stage4NormAbilityKey(raw);
        if (!key) {
          errors.push(`abilityChoicePicks: '${raw}' is not an ability`);
          picksCountOk = false;
          break;
        }
        if (seen.has(key)) {
          errors.push(`abilityChoicePicks: '${raw}' was picked twice — choice picks must go to distinct abilities`);
          picksCountOk = false;
          break;
        }
        seen.add(key);
        picks[key] = 1;
      }
      if (picksCountOk) {
        picksParsed = true;
        // Count is checkable only when the species resolved; an
        // unknown species leaves the count unverifiable (draft).
        if (speciesResolved && seen.size !== choiceN) {
          errors.push(`abilityChoicePicks: species grants ${choiceN} choice pick${choiceN === 1 ? '' : 's'}, got ${seen.size}`);
          picksCountOk = false;
        }
      }
    }
  }

  // --- Arithmetic: final = base + species fixed + picks + theme. ---
  const finalRaw = body.ability_scores ?? row?.ability_scores ?? null;
  const final = finalRaw != null ? stage4ParseScores(finalRaw) : null;
  if (finalRaw != null && !final) {
    errors.push('abilityScores: must give all six ability scores (str, dex, con, int, wis, cha)');
  }
  // The arithmetic runs only when every input is resolvable: bases
  // + final present, race resolved, theme absent or resolved, and
  // the choice picks settled (none to make, or sent and count-OK).
  // Anything else is a draft, not a mismatch.
  const themeOk = !themePresent || !!theme;
  const picksSettled = choiceN === 0 || (picksRaw != null && picksParsed && picksCountOk);
  if (base && final && speciesResolved && themeOk && picksSettled) {
    const fixed = {};
    for (const [k, v] of Object.entries(species)) {
      if (k !== 'choice') fixed[k] = Number(v) || 0;
    }
    const themeASI = theme?.ability_score_increase || {};
    const mismatches = [];
    for (const key of STAGE4_ABILITY_KEYS) {
      const expected = base[key]
        + (fixed[key] || 0)
        + (picks[key] || 0)
        + (Number(themeASI[key]) || 0);
      if (final[key] !== expected) {
        mismatches.push(`${key}: expected ${expected} (base ${base[key]} + species ${fixed[key] || 0} + choice ${picks[key] || 0} + theme ${Number(themeASI[key]) || 0}), got ${final[key]}`);
      }
    }
    if (mismatches.length > 0) {
      errors.push(`abilityScores: final scores do not match base + species + choice + theme (${mismatches.join('; ')})`);
    }
  }

  // --- Skills / languages / tools. ---
  function checkStringList(field, raw, knownList) {
    // Returns normalized (lowercased, trimmed) entries, or null
    // after pushing a field-named error. Only validates what the
    // body sent; absent lists are drafts.
    if (raw == null) return null;
    const list = stage4ParseStringList(raw);
    if (list === null) {
      errors.push(`${field}: must be a list of names`);
      return null;
    }
    const known = new Set(knownList.map((s) => s.toLowerCase()));
    const out = [];
    const seen = new Set();
    for (const entry of list) {
      if (typeof entry !== 'string' || !entry.trim()) {
        errors.push(`${field}: entries must be non-empty strings`);
        return null;
      }
      const norm = stage4NormListName(entry);
      if (!known.has(norm)) {
        errors.push(`${field}: '${entry.trim()}' is not a known ${field === 'skills' ? 'skill' : field === 'languages' ? 'language' : 'tool'}`);
        return null;
      }
      if (seen.has(norm)) {
        errors.push(`${field}: '${entry.trim()}' was picked twice`);
        return null;
      }
      seen.add(norm);
      out.push(norm);
    }
    return out;
  }

  const skillsRaw = body.skills ?? null;
  const skills = checkStringList('skills', skillsRaw, STAGE4_SKILLS);
  if (skills && skills.length > 0 && theme) {
    const sig = [theme.signature_skill_1, theme.signature_skill_2]
      .filter((s) => typeof s === 'string' && s.trim())
      .map((s) => s.trim().toLowerCase());
    const missing = sig.filter((s) => !skills.includes(s));
    if (missing.length > 0) {
      const display = missing.map((s) => {
        const found = STAGE4_SKILLS.find((x) => x.toLowerCase() === s);
        return found || s;
      });
      errors.push(`skills: must include the theme's signature skill${missing.length === 1 ? '' : 's'} (${display.join(', ')})`);
    }
  }
  // --- Class skill picks (server-side chassis, item 22). ---
  // The submitted list is theme skills + feat picks + class picks;
  // the chassis governs the CLASS picks only. Explicit
  // class_skill_picks in the body are authoritative when present;
  // otherwise the class picks are derived by subtracting the theme
  // signatures and the feat-granted skills the server can see
  // (origin Skilled picks from body/ctx, ancestry skill picks from
  // body/ctx). A class sending more picks than its count, or a pick
  // outside its allowed list, is refused with a field-named 400 —
  // never silently trimmed. Allowed set: the class's options, or
  // the FULL skill list when the client's full-list fallback
  // applies (options still available after held theme + feat skills
  // are removed are fewer than the count — mirrors Stage 4's
  // needsFullListFallback). Known limitation, flagged for the
  // coordinator: the creator-next client does not currently send
  // ancestry_feat_choices (or class_skill_picks) in the save body,
  // so an ancestry skill pick on a first (POST) save is invisible
  // here and can inflate the derived count / look outside the
  // class list. The client follow-up is to send class_skill_picks
  // (accepted above as authoritative) or ancestry_feat_choices
  // with the save; on PUT the stored ancestry choices (ctx) close
  // the gap. Species skill grants need no subtraction: they live
  // in trait prose only and never enter the submitted list.
  if (skills && cls && cls !== 'creating' && cls !== 'prelude') {
    const chassis = CLASS_CHASSIS[cls];
    if (chassis) {
      const themeSig = theme
        ? [theme.signature_skill_1, theme.signature_skill_2]
          .filter((s) => typeof s === 'string' && s.trim())
          .map((s) => s.trim().toLowerCase())
        : [];
      const featKey = body.origin_feat ?? body.originFeat ?? ctx.originFeatKey ?? null;
      const featChoices = body.origin_feat_choices ?? body.originFeatChoices ?? ctx.originFeatChoices ?? null;
      const ancestryChoices = body.ancestry_feat_choices ?? body.ancestryFeatChoices ?? ctx.ancestryFeatChoices ?? null;
      const versKey = body.versatile_feat ?? body.versatileFeat ?? ctx.versatileFeatKey ?? null;
      const versChoices = body.versatile_feat_choices ?? body.versatileFeatChoices ?? ctx.versatileFeatChoices ?? null;
      const featSkills = stage4FeatSkillPicks(featKey, featChoices, ancestryChoices, versKey, versChoices);
      const held = new Set([...themeSig, ...featSkills]);
      const explicitRaw = body.class_skill_picks ?? body.classSkillPicks ?? null;
      let classPicks = null;
      if (explicitRaw != null) {
        const explicit = stage4ParseStringList(explicitRaw);
        if (explicit === null) {
          errors.push('classSkillPicks: must be a list of skill names');
        } else {
          classPicks = [...new Set(explicit
            .filter((s) => typeof s === 'string' && s.trim())
            .map((s) => stage4NormListName(s)))];
        }
      }
      if (classPicks === null) {
        classPicks = skills.filter((s) => !themeSig.includes(s) && !featSkills.has(s));
      }
      const optionSet = new Set(chassis.skillOptions.map((s) => s.toLowerCase()));
      const available = [...optionSet].filter((s) => !held.has(s));
      const allowed = available.length < chassis.skillChoices
        ? new Set(STAGE4_SKILLS.map((s) => s.toLowerCase()))
        : optionSet;
      if (classPicks.length > chassis.skillChoices) {
        errors.push(`skills: ${cls} picks at most ${chassis.skillChoices} class skill${chassis.skillChoices === 1 ? '' : 's'}, got ${classPicks.length}`);
      }
      for (const pick of classPicks) {
        if (!allowed.has(pick)) {
          const display = STAGE4_SKILLS.find((x) => x.toLowerCase() === pick) || pick;
          errors.push(`skills: '${display}' is not a ${cls} class skill`);
        }
      }
    }
  }
  const languagesRaw = body.languages ?? null;
  const languages = checkStringList('languages', languagesRaw, STAGE4_LANGUAGES);
  if (languages && languages.length > 0 && speciesResolved) {
    const entry = resolveSpecies(race, subrace || null)?.entry;
    const required = (entry?.languages || [])
      .filter((l) => typeof l === 'string' && !/of your choice/i.test(l))
      .map((l) => l.trim().toLowerCase())
      // Only require languages the membership list knows — a
      // species language outside it could never satisfy both rules.
      .filter((l) => STAGE4_LANGUAGES.some((x) => x.toLowerCase() === l));
    const missing = required.filter((l) => !languages.includes(l));
    if (missing.length > 0) {
      const display = missing.map((l) => {
        const found = STAGE4_LANGUAGES.find((x) => x.toLowerCase() === l);
        return found || l;
      });
      errors.push(`languages: must include the species language${missing.length === 1 ? '' : 's'} (${display.join(', ')})`);
    }
  }
  // Tools: membership + dedup only — no L1 inclusion rule exists
  // (class tool lists live in client classes.json, which no server
  // module imports; see stage4 notes.md).
  checkStringList('tool_proficiencies', body.tool_proficiencies ?? body.toolProficiencies ?? null, STAGE4_TOOLS);

  // --- Spells (level 1 only — Stage 4 is level-1 creation). ---
  // known_cantrips is deliberately NOT validated here (Stage 2).
  if (cls && cls !== 'creating' && cls !== 'prelude') {
    const knownCount = getSpellsKnown(cls, 1, subclass || null);
    const ability = spellcastingAbilityFor(cls, subclass || null);
    let prepCount = null;
    let modKnown = false;
    if (final && ability) {
      prepCount = getSpellsPrepared(cls, 1, stage4AbilityMod(final[ability]), subclass || null);
      modKnown = true;
    } else {
      prepCount = getSpellsPrepared(cls, 1, 0, subclass || null);
    }
    const isKnownCaster = knownCount !== null;
    const isPreparedCaster = prepCount !== null;
    const granted = stage4GrantedSpells(body, ctx, race, subrace || null, cls);

    function checkSpellList(field, raw, expectedCount, countCheck) {
      if (raw == null) return;
      const list = stage4ParseStringList(raw);
      if (list === null) {
        errors.push(`${field}: must be a list of spell names`);
        return;
      }
      if (list.length === 0) return; // no picks yet: draft, not a refusal
      const seen = new Set();
      for (const entry of list) {
        if (typeof entry !== 'string' || !entry.trim()) {
          errors.push(`${field}: entries must be non-empty spell names`);
          return;
        }
        const norm = entry.trim().toLowerCase();
        if (seen.has(norm)) {
          errors.push(`${field}: '${entry.trim()}' was picked twice`);
          return;
        }
        seen.add(norm);
        if (granted.has(canonicalizeSpellName(entry.trim()))) {
          errors.push(`${field}: '${entry.trim()}' is already granted as a ${granted.get(canonicalizeSpellName(entry.trim()))} — it does not count against spells ${isKnownCaster ? 'known' : 'prepared'}`);
          continue;
        }
        const result = canLearnSpell({ classId: cls, level: 1, spellName: entry.trim(), subclass: subclass || null });
        if (!result.ok) errors.push(`${field}: ${result.reason}`);
      }
      if (countCheck && expectedCount != null && list.length !== expectedCount) {
        errors.push(`${field}: ${cls} picks ${expectedCount} spell${expectedCount === 1 ? '' : 's'} at level 1, got ${list.length}`);
      }
    }

    const knownRaw = body.known_spells ?? body.knownSpells ?? null;
    const prepRaw = body.prepared_spells ?? body.preparedSpells ?? null;
    if (!isKnownCaster && !isPreparedCaster) {
      // Non-caster at level 1 (incl. keeper, blood_hunter, warlord,
      // warden/scholar before their casting subclass casts at 3rd):
      // any spell pick is a refusal, without calling canLearnSpell
      // (which fails closed / unknown-class for these anyway).
      if (knownRaw != null) {
        const list = stage4ParseStringList(knownRaw);
        if (list === null) errors.push('knownSpells: must be a list of spell names');
        else if (list.length > 0) errors.push(`knownSpells: ${cls} has no spells to pick at level 1`);
      }
      if (prepRaw != null) {
        const list = stage4ParseStringList(prepRaw);
        if (list === null) errors.push('preparedSpells: must be a list of spell names');
        else if (list.length > 0) errors.push(`preparedSpells: ${cls} has no spells to pick at level 1`);
      }
    } else if (isKnownCaster) {
      if (prepRaw != null) {
        const list = stage4ParseStringList(prepRaw);
        if (list === null) errors.push('preparedSpells: must be a list of spell names');
        else if (list.length > 0) errors.push(`preparedSpells: ${cls} knows spells instead of preparing them — send known_spells`);
      }
      checkSpellList('knownSpells', knownRaw, knownCount, true);
    } else if (cls === 'wizard') {
      // Wizard spellbook (2026-11-07): the book lives in
      // known_spells — exactly 6 L1 wizard spells at creation — and
      // the prepared list must be a subset of it. The book is never
      // auto-seeded: a draft with prepared spells but no book stays
      // draft-tolerant here (the commit refuses it — see
      // validateCreatorNextStage6) and the player picks the missing
      // spells on Stage 4.
      if (knownRaw != null) {
        const knownList = stage4ParseStringList(knownRaw);
        if (knownList === null) errors.push('knownSpells: must be a list of spell names');
        else if (knownList.length > 0) checkSpellList('knownSpells', knownRaw, SPELLBOOK_START_SIZE, true);
      }
      // The prepared count needs the final scores' casting-ability
      // modifier; without final scores the count is skipped
      // (draft-tolerant) while each spell is still gated.
      checkSpellList('preparedSpells', prepRaw, prepCount, modKnown);
      // Cantrips are not book spells (2026-11-07): canLearnSpell
      // passes L0, so the floor is checked here, in the wizard
      // branch only — other casters keep the shared checkSpellList
      // behaviour. A cantrip in either list is a refusal.
      for (const [cantripField, cantripRaw] of [['knownSpells', knownRaw], ['preparedSpells', prepRaw]]) {
        const cantripList = stage4ParseStringList(cantripRaw);
        if (!cantripList) continue;
        for (const cantripName of cantripList) {
          const cantripEntry = SPELL_DATA_ENTRIES[canonicalizeSpellName(String(cantripName).trim())];
          if (cantripEntry && Number(cantripEntry.level) === 0) {
            errors.push(`${cantripField}: '${String(cantripName).trim()}' is a cantrip — the spellbook holds leveled spells only`);
          }
        }
      }
      const knownList = stage4ParseStringList(knownRaw);
      const prepList = stage4ParseStringList(prepRaw);
      if (knownList && knownList.length > 0 && prepList && prepList.length > 0) {
        const membership = validateBookMembership(prepList, knownList, []);
        if (!membership.ok) {
          errors.push(`preparedSpells: ${membership.missing.map((s) => `'${s}'`).join(', ')} ${membership.missing.length === 1 ? 'is' : 'are'} not in the spellbook — prepared spells must come from the book (known_spells)`);
        }
      }
    } else {
      if (knownRaw != null) {
        const list = stage4ParseStringList(knownRaw);
        if (list === null) errors.push('knownSpells: must be a list of spell names');
        else if (list.length > 0) errors.push(`knownSpells: ${cls} prepares spells instead of knowing them — send prepared_spells`);
      }
      // The prepared count needs the final scores' casting-ability
      // modifier; without final scores the count is skipped
      // (draft-tolerant) while each spell is still gated.
      checkSpellList('preparedSpells', prepRaw, prepCount, modKnown);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Creator-next Stage 5 validation + save-time derivation (2026-11-07,
// Gear & Story) — called by POST / and PUT /:id below, ONLY when the
// body carries the creator-next marker, next to the Stage 2/3/4
// guards. Same draft-tolerance as Stages 2–4: an absent pick is not
// an invalid pick; the hard gate is Review (Stage 6). What the
// validator refuses, naming the field:
//   - a gear_choice that is neither 'packages' nor 'gold' (gearChoice),
//   - a package_id that is not an option for the class (packageId),
//   - package picks that fail validatePackageChoice — out-of-category
//     picks, an unknown pick key, a pick for a branch not taken, or
//     a malformed pick (picks.<key>; the resolver owns the rule —
//     duplicates are grant-once, not an error: a picked item that is
//     also granted is given once, at the greater quantity),
//   - gear_choice 'gold' for a class whose goldOption is null — the
//     six source-silent classes (blackguard, magus, pugilist,
//     scholar, spellshot, warden), whose sources print no gold
//     alternative (gearChoice, naming the class),
//   - a gear_choice / package_id mismatch: a gold fork sent with a
//     package id (packageId).
// The client sends PICKS only (gear_choice, package_id,
// package_picks as a JSON string). The server resolves picks to
// items/gold and derives HP/AC/speed — never trust client-resolved
// items. Body fields are snake_case (gear_choice, package_id,
// package_picks) with camelCase aliases accepted.
function stage5ParsePicks(raw) {
  // Returns { ok, picks }: picks is the object keyed by choice
  // ({} = no picks yet, a draft); ok is false only when the raw
  // value is present but malformed (unparseable string, or a
  // non-object shape) — a draft never fails this parse.
  if (raw == null) return { ok: true, picks: {} };
  let parsed = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return { ok: true, picks: {} };
    try { parsed = JSON.parse(raw); } catch { return { ok: false, picks: null }; }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, picks: null };
  }
  return { ok: true, picks: parsed };
}

// Unwrap the client's per-option nesting. The client keeps picks
// nested under the option id — package_picks = { [optionId]: {
// <choiceKey>: <pick> } } — and sends that whole object as a JSON
// string (Stage5GearStory.jsx setSentinelPick/setAlternativePick,
// stage1Persistence.js). The resolver's contract is flat, keyed by
// choice key. The validator/deriver know package_id, so they unwrap
// here: exactly one key, equal to the package id, whose value is a
// plain object. Anything else passes through untouched and is judged
// by the existing rules — an unknown key is still refused, a missing
// choice is still a draft until the set is complete. (2026-11-07,
// Stage 5 integration fix: the client suite's group (h) marker POST
// 400d with `picks.holy: Choose one option` + `picks.A: Unknown
// pick "A"` because the nested shape reached the resolver raw.)
function stage5NormalizePicks(picks, packageId) {
  if (!picks || typeof picks !== 'object' || Array.isArray(picks)) return picks;
  if (!packageId) return picks;
  const keys = Object.keys(picks);
  if (keys.length !== 1 || keys[0] !== packageId) return picks;
  const inner = picks[packageId];
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return picks;
  return inner;
}

// An alternative normalises to a list of entries: a bare array is
// itself, { items } unwraps, a fixed item or a choice entry stands
// alone. (Same normalisation as the resolver.)
function stage5AlternativeEntries(alternative) {
  if (Array.isArray(alternative)) return alternative;
  if (alternative && Array.isArray(alternative.items)) return alternative.items;
  return [alternative];
}

// Every choice key an option declares, all branches (used to catch
// unknown picks). Mirrors the resolver's collectChoiceKeys walk:
// choice entries add their key and recurse into array `from`
// alternatives; bundles ({items}) and bare arrays recurse.
function stage5CollectChoiceKeys(entries, into = new Set()) {
  for (const entry of entries || []) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.key === 'string') {
      into.add(entry.key);
      if (Array.isArray(entry.from)) {
        for (const alt of entry.from) {
          stage5CollectChoiceKeys(stage5AlternativeEntries(alt), into);
        }
      }
    } else if (Array.isArray(entry.items)) {
      stage5CollectChoiceKeys(entry.items, into);
    } else if (Array.isArray(entry)) {
      stage5CollectChoiceKeys(entry, into);
    }
  }
  return into;
}

// Choice keys the picks actually reach: only the taken alternative
// of each array-`from` choice is followed, so a nested key counts
// as required only when its branch is taken. A pick set is complete
// when every reached key is answered; an incomplete set is a draft
// and is never refused for the missing choice — the resolver would
// fail on it, but the hard gate is Review (Stage 6).
function stage5ReachedChoiceKeys(entries, picks, into = new Set()) {
  for (const entry of entries || []) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.key === 'string') {
      into.add(entry.key);
      if (Array.isArray(entry.from)) {
        const pick = picks?.[entry.key];
        const index = pick && typeof pick === 'object' && !Array.isArray(pick) ? pick.alternative : null;
        if (Number.isInteger(index) && index >= 0 && index < entry.from.length) {
          stage5ReachedChoiceKeys(stage5AlternativeEntries(entry.from[index]), picks, into);
        }
      }
    } else if (Array.isArray(entry.items)) {
      stage5ReachedChoiceKeys(entry.items, picks, into);
    } else if (Array.isArray(entry)) {
      stage5ReachedChoiceKeys(entry, picks, into);
    }
  }
  return into;
}

export function validateCreatorNextStage5(body = {}, ctx = {}) {
  const errors = [];
  const row = ctx.row || null;
  const rawClass = body.classId ?? body.class ?? row?.class ?? null;
  const cls = typeof rawClass === 'string' ? rawClass.trim().toLowerCase() : '';
  const rawGear = body.gear_choice ?? body.gearChoice ?? null;
  const gearChoice = typeof rawGear === 'string' ? rawGear.trim().toLowerCase() : null;
  const rawPackage = body.package_id ?? body.packageId ?? null;
  const packageId = typeof rawPackage === 'string' ? rawPackage.trim().toUpperCase() : null;
  const picksParsed = stage5ParsePicks(body.package_picks ?? body.packagePicks ?? null);
  if (!picksParsed.ok) {
    errors.push('packagePicks: must be an object keyed by choice, or a JSON string of one');
  }
  // Client shape is nested per option card; unwrap before judging.
  const picks = stage5NormalizePicks(picksParsed.picks || {}, packageId);
  const picksPresent = Object.keys(picks).length > 0;
  // Nothing sent yet is a draft, not an invalid pick.
  if (!gearChoice && !packageId && !picksPresent) return { ok: true, errors: [] };
  if (gearChoice && gearChoice !== 'packages' && gearChoice !== 'gold') {
    errors.push(`gearChoice: '${rawGear}' must be 'packages' or 'gold'`);
  }
  if (gearChoice === 'gold' && packageId) {
    errors.push(`packageId: '${rawPackage}' was sent with gear_choice 'gold' — a gold fork takes no package`);
  }
  // Gold fork needs a class baseline. An unknown / absent class is
  // Stage 2's refusal; this check only fires for a known class
  // whose source prints no gold alternative.
  if (gearChoice === 'gold' && cls) {
    const entry = STARTING_PACKAGES[cls];
    if (!entry || entry.goldOption == null) {
      errors.push(`gearChoice: '${cls}' has no starting-gold option — its source prints no gold alternative, so take a starting package instead`);
    }
  }
  let packageKnown = false;
  let listedOption = null;
  if (packageId) {
    if (cls) {
      // listPackageOptions returns { ok, options, goldOption, errors }
      // — not an array (real resolver, 2026-11-07).
      const listed = listPackageOptions(cls);
      const options = listed.ok ? listed.options : [];
      const ids = options.map((o) => String(o?.id ?? '').trim().toUpperCase());
      if (!ids.includes(packageId)) {
        errors.push(`packageId: '${rawPackage}' is not a package option for ${cls}`);
      } else {
        packageKnown = true;
        listedOption = options.find((o) => String(o?.id ?? '').trim().toUpperCase() === packageId) || null;
      }
    }
    // No class yet: the id is unjudgeable (Stage 2 owns the class);
    // a draft with a package id but no class passes here.
  }
  // Picks are judged only against a known option: picks without an
  // option id, or for an unknown class, are a draft, not a refusal.
  // And only a COMPLETE pick set is judged: the resolver fails a
  // missing choice, but an unchosen pick is a draft, not an invalid
  // pick — so validation runs when every reached choice key is
  // answered, or when a pick names a key the option never declares
  // (an unknown pick is invalid even in a draft). The resolver owns
  // the pick rules; this wrapper only surfaces its field-named
  // errors as `picks.<key>: <message>` (its errors are objects,
  // {field, message} — never pushed raw, or the route would render
  // "[object Object]").
  if (picksPresent && packageKnown && listedOption) {
    const allKeys = stage5CollectChoiceKeys(listedOption.items);
    const reachedKeys = stage5ReachedChoiceKeys(listedOption.items, picks);
    const hasUnknown = Object.keys(picks).some((k) => !allKeys.has(k));
    const complete = [...reachedKeys].every((k) => Object.prototype.hasOwnProperty.call(picks, k));
    if (complete || hasUnknown) {
      const check = validatePackageChoice(cls, packageId, picks);
      if (!check.ok) {
        for (const e of (check.errors || [])) {
          errors.push(typeof e === 'string' ? e : `${e.field || 'picks'}: ${e.message || String(e)}`);
        }
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// 2024 PHB p. 219 (transcription correction 5): armor with a
// Strength requirement reduces the wearer's speed by 10 feet unless
// the wearer's Strength is equal to or higher than the listed score.
// Only three armors carry one. ARMOR_DATA (combatStatsService) holds
// base AC + type but no Str column, so the three values live here.
const STAGE5_ARMOR_STR_REQ = { 'Chain Mail': 13, 'Splint': 15, 'Plate': 15 };

// Canonical 2024 armor name for a package item name: ARMOR_DATA keys
// plus the 'X Armor' spellings packages use ('Leather Armor',
// 'Studded Leather Armor'). Returns null when the item is not armor.
function stage5CanonicalArmorName(raw) {
  if (typeof raw !== 'string') return null;
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  const alias = {
    'leather armor': 'Leather',
    'studded leather armor': 'Studded Leather',
    'padded armor': 'Padded',
    'hide armor': 'Hide',
    'chain shirt armor': 'Chain Shirt',
    'scale mail armor': 'Scale Mail',
    'breastplate armor': 'Breastplate',
    'half plate armor': 'Half Plate',
    'half-plate armor': 'Half Plate',
    'ring mail armor': 'Ring Mail',
    'chain mail armor': 'Chain Mail',
    'splint armor': 'Splint',
    'plate armor': 'Plate',
  };
  if (alias[n]) return alias[n];
  return Object.keys(ARMOR_DATA).find((k) => k.toLowerCase() === n) || null;
}

// Merge resolved package items into the stored inventory: items the
// last Stage 5 save wrote (source 'stage5-package') are replaced,
// everything else (sheet-added, bought, found) is kept, and the new
// resolved items are appended with the source tag. A kept item whose
// NAME duplicates a resolved item is also dropped: the sheet keys
// inventory by name (addItemToInventory merges by name and rebuilds
// the item as {name, quantity, equipped}, dropping the source tag),
// so name-duplicates would otherwise double up on a re-save.
// Returns the JSON string, or null when the existing inventory is
// unparseable (the caller then leaves the stored value alone —
// fail closed).
function stage5MergeInventory(existingRaw, resolvedItems) {
  let existing = [];
  if (existingRaw != null) {
    const parsed = typeof existingRaw === 'string' ? safeParse(existingRaw, null) : existingRaw;
    if (!Array.isArray(parsed)) return null;
    existing = parsed;
  }
  const resolvedNames = new Set(resolvedItems.map((it) => String(it.name || '').trim().toLowerCase()));
  const kept = existing.filter((it) => {
    if (it && typeof it === 'object' && it.source === 'stage5-package') return false;
    const name = typeof it === 'string' ? it : it?.name;
    if (typeof name === 'string' && resolvedNames.has(name.trim().toLowerCase())) return false;
    return true;
  });
  return JSON.stringify([...kept, ...resolvedItems]);
}

// Merge the package's armor/shield into the equipment slots. A slot
// the package fills is written as { name, source: 'stage5-package' };
// a slot the package does NOT fill is cleared only when the slot it
// replaces was itself package-written (a sheet-equipped item is
// never clobbered by a package that grants no armor). Other slots
// (mainHand) are kept as-is. Weapons live in inventory, never in
// mainHand. Returns the JSON string, or null when the existing
// equipment is unparseable.
function stage5MergeEquipment(existingRaw, armorName, shieldName) {
  let existing = {};
  if (existingRaw != null) {
    const parsed = typeof existingRaw === 'string' ? safeParse(existingRaw, null) : existingRaw;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) existing = parsed;
    else if (Array.isArray(parsed)) existing = {};
    else return null;
  }
  const out = { ...existing };
  if (armorName) {
    out.armor = { name: armorName, source: 'stage5-package' };
  } else if (out.armor && typeof out.armor === 'object' && out.armor.source === 'stage5-package') {
    delete out.armor;
  }
  if (shieldName) {
    out.offHand = { name: shieldName, source: 'stage5-package' };
  } else if (out.offHand && typeof out.offHand === 'object' && out.offHand.source === 'stage5-package') {
    delete out.offHand;
  }
  return JSON.stringify(out);
}

// Server-side Stage 5 derivation for a creator-marker save. Pure
// except for the (sync, pure) package resolver. Returns an object
// whose keys are the derived values, null for anything that could
// not be derived — the caller leaves stored values alone for nulls.
// Derives ONLY when the data is complete: class + final scores +
// species + a valid gear choice present; anything else is a draft
// and derives nothing.
//   - HP: hitDie max + Con mod (min 1) -> max_hp AND current_hp,
//     but ONLY when the stored max_hp is 0 (unset). Never clobbers
//     a non-zero max_hp on PUT.
//   - AC: from the resolved package — armor base + Dex (light full,
//     medium max +2, heavy flat) + shield +2; no armor in the
//     package -> 10 + Dex. A gold fork clears package-written
//     armor/shield and derives 10 + Dex when no armor or shield
//     remains; a non-package armor/shield leaves armor_class alone.
//   - Gold fork inventory (creation-solidification item 4): earlier
//     package items are dropped; a wizard gets a Spellbook row.
//   - Speed: walkSpeedFor(species, variant) (registry-first) when
//     it resolves; the armor Str rule applies on top (speed −10
//     when the package armor's Str req is unmet).
//   - Gold: 'gold' -> computeGoldFork(class, theme, server-side
//     theme modifier); 'packages' -> the resolved package's gold.
//   - Inventory/equipment: resolved items carry source
//     'stage5-package'; armor -> equipment.armor, shield ->
//     equipment.offHand; weapons and everything else -> inventory.
// ctx is the Stage 4 PUT context (row + themeId); POST passes {}.
// opts.isPost distinguishes a fresh row (gold-fork AC derives)
// from a PUT (gold-fork AC stays). Exported for tests: the min-1 HP
// floor is unreachable through any valid route body (the lowest
// legal L1 Con still yields HP >= 2), so only a direct call pins it.
export function deriveCreatorNextStage5(body = {}, ctx = {}, opts = {}) {
  const out = { maxHp: null, currentHp: null, armorClass: null, speed: null, goldGp: null, inventory: null, equipment: null };
  const row = ctx.row || null;
  const rawClass = body.classId ?? body.class ?? row?.class ?? null;
  const cls = typeof rawClass === 'string' ? rawClass.trim().toLowerCase() : '';
  if (!cls) return out;
  // Final scores: the body sends them as ability_scores (finals, a
  // JSON string or an object); final_ability_scores is accepted too.
  // A PUT falls back to the stored row.
  const scoresRaw = body.final_ability_scores ?? body.finalAbilityScores
    ?? body.ability_scores ?? body.abilityScores
    ?? row?.final_ability_scores ?? row?.ability_scores ?? null;
  const final = stage4ParseScores(scoresRaw);
  if (!final) return out;
  const rawRace = body.race ?? row?.race ?? null;
  const race = typeof rawRace === 'string' ? rawRace.trim() : '';
  if (!race) return out;
  const subrace = body.subrace ?? row?.subrace ?? null;
  const rawGear = body.gear_choice ?? body.gearChoice ?? null;
  const gearChoice = typeof rawGear === 'string' ? rawGear.trim().toLowerCase() : null;
  if (gearChoice !== 'packages' && gearChoice !== 'gold') return out;
  const dexMod = Math.floor((final.dex - 10) / 2);
  const conMod = Math.floor((final.con - 10) / 2);
  // HP: hitDie max + Con mod, min 1 — only when the stored max_hp is
  // 0. The stored value is the row's on PUT, or the body's own
  // max_hp on POST (a preset survives); anything else derives.
  const storedMaxHp = Number(row?.max_hp ?? body.max_hp ?? body.maxHp ?? 0) || 0;
  if (storedMaxHp === 0) {
    const hp = Math.max(1, (HIT_DICE[cls] || 8) + conMod);
    out.maxHp = hp;
    out.currentHp = hp;
  }
  // Speed: registry-first walk speed. The armor Str rule applies
  // below, once a package resolves (a gold fork never penalises).
  const walk = walkSpeedFor(race, subrace || null);
  if (walk != null) out.speed = walk;
  const themeId = body.theme_id ?? body.themeId ?? ctx.themeId ?? null;
  if (gearChoice === 'gold') {
    const themeMod = (typeof themeId === 'string' && themeId) ? (THEME_GOLD_MODIFIERS[themeId] ?? 0) : 0;
    const fork = computeGoldFork(cls, themeId, themeMod);
    // computeGoldFork returns { ok, gold, baseline, ... } — never a
    // bare number (real resolver, 2026-11-07); a failed fork (a
    // null-baseline class) leaves gold alone, it never writes 0.
    if (fork && typeof fork === 'object') {
      if (fork.ok) out.goldGp = fork.gold;
    } else if (typeof fork === 'number') {
      out.goldGp = fork;
    }
    // A gold fork on a fresh POST row (no equipment yet) derives
    // 10 + Dex; on PUT, AC follows the equipment merge below.
    if (opts.isPost) out.armorClass = 10 + dexMod;
    // Creation-solidification item 4 (2026-11-12): the gold fork used
    // to write no inventory at all, so (a) a wizard who took gold
    // instead of a package had no physical Spellbook — the package
    // path grants one (startingPackages.js) and the spellbook system
    // (loss / replace / backup) keys off that inventory row — and
    // (b) package gear saved earlier in the draft stayed in the
    // inventory after switching to gold (gear AND gold). The gold
    // fork now runs the same merge as the package path: earlier
    // creator-package items are dropped, and a wizard gets the
    // Spellbook row (same shape as the package / replacement rows).
    const goldItems = cls === 'wizard'
      ? [{ name: 'Spellbook', quantity: 1, equipped: false, source: 'stage5-package' }]
      : [];
    const goldInv = stage5MergeInventory(body.inventory ?? row?.inventory ?? null, goldItems);
    if (goldInv != null) out.inventory = goldInv;
    // Same for the equipment slots: package-written armor / shield
    // are cleared (a non-package item is never touched). With no
    // armor or shield left, AC is 10 + Dex — the same derive the
    // fresh-POST gold fork always used; otherwise AC is left alone.
    const goldEq = stage5MergeEquipment(body.equipment ?? row?.equipment ?? null, null, null);
    if (goldEq != null) {
      out.equipment = goldEq;
      const eqObj = safeParse(goldEq, {});
      if (!eqObj?.armor && !eqObj?.offHand) out.armorClass = 10 + dexMod;
    }
    return out;
  }
  // 'packages': resolve the picks. A missing package id, malformed
  // picks, or an unresolvable (incomplete) pick set fails closed —
  // HP/speed above still stand, gear fields stay null.
  const rawPackage = body.package_id ?? body.packageId ?? null;
  const packageId = typeof rawPackage === 'string' ? rawPackage.trim().toUpperCase() : null;
  if (!packageId) return out;
  const picksParsed = stage5ParsePicks(body.package_picks ?? body.packagePicks ?? null);
  // Client shape is nested per option card; unwrap before resolving.
  const picks = stage5NormalizePicks(picksParsed.ok ? picksParsed.picks : {}, packageId);
  const resolved = resolvePackage(cls, packageId, picks);
  if (!resolved || !resolved.ok) return out;
  out.goldGp = resolved.gold ?? 0;
  // Armor / shield out of the resolved items: the canonical armor
  // name (if any) and a shield (bonus > 0) fill the equipment slots;
  // everything else lands in inventory with the source tag.
  let armorName = null;
  let shieldName = null;
  for (const item of resolved.items || []) {
    const canonical = stage5CanonicalArmorName(item.name);
    if (canonical && !armorName) { armorName = canonical; continue; }
    if (!shieldName && shieldBonusForOffHand(item.name) > 0) { shieldName = String(item.name).trim(); continue; }
  }
  // AC from the package armor (or 10 + Dex with no armor): light
  // full Dex, medium capped at +2, heavy flat; shield +2.
  let ac = 10 + dexMod;
  if (armorName) {
    const entry = ARMOR_DATA[armorName];
    if (entry) {
      if (entry.type === 'light') ac = entry.baseAC + dexMod;
      else if (entry.type === 'medium') ac = entry.baseAC + Math.min(dexMod, entry.maxDex ?? 2);
      else ac = entry.baseAC;
    }
  }
  if (shieldName) ac += 2;
  // Defense fighting style (creation-solidification item 6): +1 AC
  // while wearing armor — the same rule combatStatsService applies
  // in play (defenseAcBonus). The stored armor_class is what the
  // sheet shows, so the creator's derive must include it too.
  {
    const styleRaw = body.fighting_style ?? body.fightingStyle ?? row?.fighting_style ?? null;
    if (armorName && typeof styleRaw === 'string' && normalizeFeatName(styleRaw) === normalizeFeatName('Defense')) ac += 1;
  }
  out.armorClass = ac;
  // Armor Str rule: an unmet requirement costs 10 speed.
  if (armorName && out.speed != null) {
    const req = STAGE5_ARMOR_STR_REQ[armorName];
    if (req != null && final.str < req) out.speed = out.speed - 10;
  }
  const invItems = (resolved.items || [])
    .filter((it) => {
      if (armorName && stage5CanonicalArmorName(it.name) === armorName) return false;
      if (shieldName && String(it.name || '').trim() === shieldName) return false;
      return true;
    })
    .map((it) => ({ name: it.name, quantity: it.quantity, equipped: false, source: 'stage5-package' }));
  const mergedInv = stage5MergeInventory(body.inventory ?? row?.inventory ?? null, invItems);
  if (mergedInv != null) out.inventory = mergedInv;
  const mergedEq = stage5MergeEquipment(body.equipment ?? row?.equipment ?? null, armorName, shieldName);
  if (mergedEq != null) out.equipment = mergedEq;
  return out;
}

// Ancestry-feat sub-choice validation (2026-11-06, item 2).
// The POST/PUT path that stores these choices
// (persistAncestryFeatSelection) previously validated NOTHING —
// any JSON sailed into character_ancestry_feats.choices_data, and
// the Stage 1 renderer stored ONE string per choice, so the human
// T1 feat Traveler's Tongue (count 2 languages) ended up granting
// 1 of its 2 languages. The schema is the feat's own `choices`
// array, resolved from the seeded ancestry_feats row (choices JSON,
// migration 038) by the feat id the client sends — no new table,
// no in-memory lookup by name (the id is the DB seed id).
//
// Rules, per declared choice:
//   - absent / empty value: not yet chosen — a draft, never a refusal.
//   - count > 1: the value MUST be an array of exactly `count`
//     distinct picks (Traveler's Tongue: ['elvish', 'dwarvish']).
//     A single string for a count-2 choice is refused — that shape
//     is the bug being fixed. Other count > 1 choices get the same
//     shape rule (half-elf T13 Inherited Spellwork, count 2 spells;
//     human T13 The Road Taught Me, count 3 skills).
//   - count 1: a single string (a 1-element array is accepted).
//   - domain: where the choice's `options` names a closed list it
//     is checked (any_language -> STAGE4_LANGUAGES, any_skill ->
//     STAGE4_SKILLS, any_artisan_tool / any_tool -> the tool lists,
//     explicit option arrays -> membership). Freeform picks
//     (cantrips, freeform spells, martial weapons) are shape-only:
//     the client renders them as text input and a half-typed draft
//     must not be refused for a name the catalog would reject.
//   - choice ids the feat does not declare are ignored
//     (forward-compat, like Stage 3 stray choices).
// Fail-open: an unknown feat id, an unseeded DB, or a DB error
// returns ok — a save is never blocked on unresolvable reference
// data. (A feat that declares no choices + a non-empty choices
// object is refused: there is nothing to pick.)
export async function validateAncestryFeatChoices(featId, choicesData) {
  const errors = [];
  if (featId == null || choicesData == null) return { ok: true, errors };
  if (typeof choicesData !== 'object' || Array.isArray(choicesData)) {
    return { ok: false, errors: ['ancestryFeatChoices: must be an object mapping choice ids to picks'] };
  }
  const entries = Object.entries(choicesData)
    .filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (entries.length === 0) return { ok: true, errors };
  let row = null;
  try {
    row = await dbGet('SELECT choices FROM ancestry_feats WHERE id = ?', [featId]);
  } catch {
    return { ok: true, errors }; // reference data unresolvable: fail open
  }
  if (!row) return { ok: true, errors }; // unknown feat id: fail open
  const schema = typeof row.choices === 'string' ? safeParse(row.choices, null) : null;
  if (!Array.isArray(schema) || schema.length === 0) {
    return { ok: false, errors: ['ancestryFeatChoices: this feat takes no sub-choices'] };
  }
  const schemaById = new Map(
    schema.filter((c) => c && typeof c.id === 'string').map((c) => [c.id, c])
  );
  for (const [choiceId, rawValue] of entries) {
    const choice = schemaById.get(choiceId);
    if (!choice) continue; // undeclared choice id: ignored
    const count = Number.isInteger(choice.count) && choice.count > 0 ? choice.count : 1;
    let values = null;
    if (Array.isArray(rawValue)) {
      values = rawValue;
    } else if (typeof rawValue === 'string') {
      const trimmed = rawValue.trim();
      if (!trimmed) continue; // empty = not yet chosen
      try {
        const parsed = JSON.parse(trimmed);
        values = Array.isArray(parsed) ? parsed : [rawValue];
      } catch { values = [rawValue]; }
    } else {
      errors.push(`ancestryFeatChoices: '${choiceId}' must be a pick or a list of picks`);
      continue;
    }
    values = values.filter((v) => typeof v === 'string' && v.trim());
    if (values.length === 0) continue; // nothing actually picked yet
    if (values.length !== count) {
      errors.push(`ancestryFeatChoices: '${choiceId}' needs exactly ${count} pick${count === 1 ? '' : 's'}, got ${values.length}`);
      continue;
    }
    const seen = new Set();
    for (const v of values) {
      const norm = stage4NormListName(v);
      if (seen.has(norm)) {
        errors.push(`ancestryFeatChoices: '${v.trim()}' was picked twice for '${choiceId}'`);
        break;
      }
      seen.add(norm);
      const domainError = checkAncestryChoiceValue(choice, v.trim());
      if (domainError) {
        errors.push(`ancestryFeatChoices: ${domainError}`);
        break;
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

// Human Versatile species gate (item 19): true when the race is
// the registry human carrying the 2024 Versatile flag, false when
// it is a known non-human (including the "Mixed Ancestry (A / B)"
// label, which resolves to no registry entry), null when no race is
// given (draft — unjudgeable).
function versatileHumanStatus(race, subrace) {
  if (typeof race !== 'string' || !race.trim()) return null;
  const resolved = resolveSpecies(race, subrace);
  if (!resolved) return false;
  return resolved.entry.id === 'human' && resolved.entry.versatile2024 === true;
}

// Size choice (2024 PHB p. 194, migration 110): a species with a
// `sizes` choice list (today only human: Medium or Small) takes
// exactly one of those sizes; a single-size species takes its size.
// Returns { ok, errors, size } where size is the canonical stored
// value, or null when no size was sent (draft — no choice claimed
// yet). An unknown species is unjudgeable: the sent value is
// accepted as written (free-text races exist in v1).
function validateSizeChoice(race, subrace, sizeRaw) {
  if (sizeRaw == null || (typeof sizeRaw === 'string' && !sizeRaw.trim())) {
    return { ok: true, errors: [], size: null };
  }
  if (typeof sizeRaw !== 'string') {
    return { ok: false, errors: [`size: '${sizeRaw}' must be a size string, e.g. Medium or Small`], size: null };
  }
  const sent = sizeRaw.trim();
  const allowed = allowedSizesFor(race, subrace);
  if (!allowed) return { ok: true, errors: [], size: sent };
  const match = allowed.find((s) => s.toLowerCase() === sent.toLowerCase());
  if (!match) {
    const name = resolveSpecies(race, subrace)?.entry?.name || race;
    return { ok: false, errors: [`size: '${sent}' is not a size for ${name} (${allowed.join(' or ')})`], size: null };
  }
  return { ok: true, errors: [], size: match };
}

// Mixed Ancestry ancestry-feat list check (2026-11-06): a mixed
// character may pick an ancestry feat from EITHER parent's list
// (doc prerequisite note). The feat id is the seeded ancestry_feats
// row id; its list_id must be in ancestryFeatListsFor(parents).
// Returns an error string, or null when allowed. Fail-open on an
// unknown feat id or a DB error — a save is never blocked on
// unresolvable reference data (same rule as
// validateAncestryFeatChoices above).
async function checkMixedAncestryFeatList(parents, featId) {
  const allowed = ancestryFeatListsFor(parents);
  let row = null;
  try {
    row = await dbGet('SELECT list_id FROM ancestry_feats WHERE id = ?', [featId]);
  } catch {
    return null;
  }
  if (!row) return null;
  if (allowed.includes(row.list_id)) return null;
  return `ancestryFeatId: '${featId}' is from the '${row.list_id}' ancestry-feat list, which is not one of the mixed-ancestry parents' lists (${allowed.join(', ') || 'none'})`;
}

// Closed-list domain for one ancestry-feat choice, from its
// `options` field. Returns { list } (membership-checked) or
// { list: null } (freeform — shape-only). Sentinel names are the
// same ones choiceOptions.js expands client-side.
function ancestryChoiceDomain(choice) {
  const options = choice.options;
  if (Array.isArray(options)) return { list: options };
  if (typeof options !== 'string') return { list: null };
  switch (options) {
    case 'any_language': return { list: STAGE4_LANGUAGES };
    case 'any_skill': return { list: STAGE4_SKILLS };
    case 'any_artisan_tool': return { list: STAGE4_ARTISAN_TOOLS };
    case 'any_tool': return { list: STAGE4_TOOLS };
    default: return { list: null }; // any_cantrip_*, any_spell_*, any_martial_weapon
  }
}

function checkAncestryChoiceValue(choice, value) {
  const { list } = ancestryChoiceDomain(choice);
  if (!list) return null;
  const ok = list.some((x) => stage4NormListName(x) === stage4NormListName(value));
  if (!ok) return `'${value}' is not a valid pick for '${choice.id}'`;
  return null;
}

// Ancestry-feat granted spells, pre-loaded for the Stage 4
// validator (2026-11-06, item 21). Resolves the feat entry from
// the seeded ancestry_feats row (list_id + tier + choice_index),
// then collects: (a) fixed grants from the entry's structured
// fields (entry.grantedSpells, or entry.grants.spells) —
// structured since 2026-11-06 (item 21): objects { name, level,
// uses, ability? }, plus { choose, from } cast-time choices
// (Celestial Healing: either spell may be the cast-time pick, so
// ALL names in `from` join the granted set — the validator counts
// prepared spells, not casts, and the 1/LR use limit is enforced
// at cast time). Prose is never parsed for mechanics; a grant
// with no structured field stays ungranted;
// (b) resolved choices of type spell / spell_freeform / cantrip
// (Arcane Inheritance, Words of Power, Voice of the Weave,
// Inherited Spellwork, Infernal Pact Magic, Weave-Touched).
// Defensive throughout: an unresolvable feat, missing choices, or
// a DB error yields [] — never a crash, never an invented spell.
// At level-1 creation the only ancestry spell grant is a cantrip
// (elf Weave-Touched), which Stage 4 does not validate — so the
// set is behaviorally empty at L1 today and the plumbing exists
// for the leveled grants at level-up.
export async function resolveAncestryFeatGrantedSpells(featId, choicesData) {
  try {
    if (featId == null) return [];
    const seedRow = await dbGet(
      'SELECT list_id, tier, choice_index FROM ancestry_feats WHERE id = ?',
      [featId]
    );
    if (!seedRow) return [];
    const entry = ANCESTRY_FEATS.find(
      (f) => f.list_id === seedRow.list_id && f.tier === seedRow.tier && f.choice_index === seedRow.choice_index
    );
    if (!entry) return [];
    const out = [];
    // One grant entry may be a plain string (legacy shape) or a
    // structured object { name, level, uses, ability? } (item 21).
    // A { choose, from } object is a cast-time choice, not a
    // feat-time pick: every name in `from` joins the granted set
    // (see the header comment above).
    const pushGrant = (s) => {
      if (typeof s === 'string' && s.trim()) out.push(s.trim());
      else if (s && typeof s === 'object') {
        if (typeof s.name === 'string' && s.name.trim()) out.push(s.name.trim());
        else if (Array.isArray(s.from)) {
          for (const f of s.from) pushGrant(f);
        }
      }
    };
    if (Array.isArray(entry.grantedSpells)) {
      for (const s of entry.grantedSpells) pushGrant(s);
    }
    if (entry.grants && Array.isArray(entry.grants.spells)) {
      for (const s of entry.grants.spells) pushGrant(s);
    }
    const choices = choicesData && typeof choicesData === 'object' && !Array.isArray(choicesData)
      ? choicesData
      : {};
    for (const ch of entry.choices || []) {
      if (!['spell', 'spell_freeform', 'cantrip'].includes(ch.type)) continue;
      const v = choices[ch.id];
      if (typeof v === 'string' && v.trim()) out.push(v.trim());
      else if (Array.isArray(v)) {
        for (const s of v) {
          if (typeof s === 'string' && s.trim()) out.push(s.trim());
        }
      }
    }
    return [...new Set(out)];
  } catch {
    return [];
  }
}

// Read the PUT context validateCreatorNextStage4 needs: the stored
// row plus the theme / origin-feat / ancestry rows the body may
// omit. Best effort — a missing row or a pre-migration table yields
// an empty context and validation proceeds on the body alone.
// Extended 2026-11-06 (items 6/15/21): the side-table rows a
// resumed creator rehydrates from — theme path choice/data,
// ancestry feat id + tier + choices, the Magic Initiate cantrip
// picks (origin_feat.choices_data.cantrips), and the ancestry-feat
// granted spells pre-loaded for the sync Stage 4 validator. The
// context supplies RESOLUTION INPUTS only (class, race, theme,
// final scores, granted spells); it never re-validates stored
// lists, and an absent field still means "not yet chosen".
async function readCreatorNextStage4Context(characterId) {
  try {
    const row = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!row) return {};
    let themeId = null;
    let themePathChoice = null;
    let themePathData = null;
    let originFeatKey = null;
    let originFeatChoices = null;
    let originFeatCantrips = [];
    let versatileFeatKey = null;
    let versatileFeatChoices = null;
    let ancestryFeatId = null;
    let ancestryFeatTier = null;
    let ancestryFeatChoices = null;
    let ancestryFeatSpells = [];
    try {
      const themeRow = await dbGet('SELECT theme_id, path_choice, path_data FROM character_themes WHERE character_id = ?', [characterId]);
      themeId = themeRow?.theme_id ?? null;
      themePathChoice = themeRow?.path_choice ?? null;
      themePathData = typeof themeRow?.path_data === 'string' ? safeParse(themeRow.path_data, null) : null;
    } catch { /* pre-migration table: no stored theme */ }
    try {
      const featRow = await dbGet('SELECT feat_key, choices_json FROM character_origin_feats WHERE character_id = ? AND slot = \'theme\'', [characterId]);
      originFeatKey = featRow?.feat_key ?? null;
      originFeatChoices = typeof featRow?.choices_json === 'string' ? safeParse(featRow.choices_json, null) : null;
      // Magic Initiate cantrips (item 15): the stored MI cantrip
      // picks, so a resumed creator can feed them to Stage 2's
      // featCantrips instead of the hardcoded []. The DM prompt /
      // progression snapshot already print the MI choices (the
      // choices_data JSON); this only surfaces the cantrip names
      // for the creator read path. resolveCantrips takes them via
      // its existing featCantrips input — no signature change.
      if (originFeatChoices && Array.isArray(originFeatChoices.cantrips)) {
        originFeatCantrips = originFeatChoices.cantrips
          .filter((c) => typeof c === 'string' && c.trim())
          .map((c) => c.trim());
      }
    } catch { /* pre-migration table: no stored origin feat */ }
    // Versatile slot (human L1 feat — Stage 6 fix 2026-11-07): the
    // stored versatile pick, so Stage 4's granted-spell exclusion
    // and feat-skill subtraction see it on a resumed PUT, exactly
    // like the theme slot above.
    try {
      const versRow = await dbGet('SELECT feat_key, choices_json FROM character_origin_feats WHERE character_id = ? AND slot = \'versatile\'', [characterId]);
      versatileFeatKey = versRow?.feat_key ?? null;
      versatileFeatChoices = typeof versRow?.choices_json === 'string' ? safeParse(versRow.choices_json, null) : null;
    } catch { /* pre-migration table: no stored versatile feat */ }
    try {
      const ancRow = await dbGet('SELECT feat_id, tier, choices_data FROM character_ancestry_feats WHERE character_id = ?', [characterId]);
      ancestryFeatId = ancRow?.feat_id ?? null;
      ancestryFeatTier = ancRow?.tier ?? null;
      ancestryFeatChoices = typeof ancRow?.choices_data === 'string' ? safeParse(ancRow.choices_data, null) : null;
      // Ancestry-feat granted spells, pre-loaded (item 21): fixed
      // grants + resolved choices, derived here from the persisted
      // feat row so the sync Stage 4 validator reads a plain
      // array. No new column: the derivation runs at context-read
      // time from data persistAncestryFeatSelection already stores.
      if (ancestryFeatId != null) {
        ancestryFeatSpells = await resolveAncestryFeatGrantedSpells(ancestryFeatId, ancestryFeatChoices);
      }
    } catch { /* pre-migration table: no stored ancestry feat */ }
    return {
      row, themeId, themePathChoice, themePathData,
      originFeatKey, originFeatChoices, originFeatCantrips,
      versatileFeatKey, versatileFeatChoices,
      ancestryFeatId, ancestryFeatTier, ancestryFeatChoices, ancestryFeatSpells,
    };
  } catch {
    return {};
  }
}

// Canonical registry key for a raw origin-feat pick (name or key) —
// what persistOriginFeatSelection stores. Falls back to a
// snake_cased form of the raw string when the registry has no entry
// (validation refuses that case for creator-next bodies; the
// fallback only keeps non-creator callers from storing garbage).
function canonicalOriginFeatKey(raw) {
  const entry = typeof raw === 'string' ? getFeatEffect(raw) : null;
  if (entry?.key) return entry.key;
  return typeof raw === 'string'
    ? raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
    : null;
}

// --- Creator-next Stage 6: Review & Commit (2026-11-07) -------------------
// The hard gate. Stages 2–5 are draft-tolerant; Stage 6 composes
// them on the MERGED body (stored row + side tables + request body,
// body wins — built by the commit route) and adds the commit-only
// completeness checks. Every refusal names the field, never silently
// fixes, never trims. The validator writes nothing; the commit route
// applies state only after it passes, so a commit never partially
// applies.
//
// What Stage 6 adds over the composed stage validators:
//   - identity: name / first_name / gender present (and not the
//     '(unnamed)' placeholder),
//   - species: known (unknown species refused at commit, where the
//     draft POST/PUT tolerate free-text races), MVP-deferred species
//     refused for PCs, variant must belong to the species, size
//     required where the species chooses one,
//   - origin: setting + region present (no '__other__' sentinels),
//     outside-FR explanation required (isOutsideFRSetting); the
//     per-species origin restriction was REMOVED by Zach 2026-11-05
//     — any species from any setting — and is NOT re-imposed here,
//   - class: present (not the 'creating' placeholder); subclass
//     required when the class chooses one at level 1,
//   - theme: present; the theme's creation choice required + a
//     member of its options when the theme has one,
//   - origin feat (theme slot): present unless the mixed-ancestry
//     forgo trade is on; its subchoices COMPLETE (Magic Initiate:
//     full object; Skilled/Musician/Crafter: exactly 3 picks). The
//     versatile slot is optional but complete when present.
//   - ancestry feat: required where the species has a tier-1 list
//     (DB check, not a hardcoded list); tier must be 1; list
//     membership re-checked (mixed: either parent's list); every
//     declared subchoice present + shape-valid; an id the DB does
//     not know is refused at commit (fail-open is a draft rule),
//   - scores: all six finals present; the arithmetic verified
//     whenever the inputs are present (non-mixed via Stage 4;
//     mixed via the base + 0 + 0 + theme branch below, since Stage 4
//     skips mixed). When bases are absent and finals are unchanged
//     from the stored row, the draft-time validation stands; when
//     finals changed without bases, the change is unverifiable and
//     is refused,
//   - final lists: skills / languages non-empty; feat-granted picks
//     (ancestry language/skill/tool choices, origin Skilled /
//     Musician / Crafter picks) must appear in the final lists —
//     the Traveler's Tongue rule: the final languages list must
//     include the feat's language picks,
//   - spells: known / prepared lists present with the exact level-1
//     count for casters (Stage 4 checks the count when the list is
//     non-empty; Stage 6 requires the list),
//   - cantrips: the full final list (class picks + granted +
//     species/subclass choice picks), validated structurally —
//     every granted cantrip present, every species choice consumed
//     by a pick on its list, the remainder exactly the class count
//     and learnable by the class. The count is skipped only where
//     the server cannot compute it exactly (mixed-ancestry trait
//     cantrips, subclass choice phrases),
//   - gear: a package fork must resolve, a gold fork must compute;
//     with no gear in the body, stored gear evidence (inventory /
//     equipment / gold) must exist,
//   - fighting style: required for fighter at L1 and for paladin /
//     ranger at L2+ (level-gated, 2026-11-07 follow-up — a level-1
//     paladin/ranger cannot have one yet), registry-membership
//     checked when sent, shape-validated otherwise; subclass choices
//     registry-checked; expertise shape-validated (a subset of the
//     final skills when sent); distinguishing features accepted,
//     never required,
//   - story: alignment / faith / lifestyle + the physical
//     description (age, height, weight, eyes, hair, skin, build)
//     present,
//   - mixed ancestry: the record re-validated, size + at least one
//     trait required when the parents are complete.
//
// ctx carries the commit context: { row, themeId, themePathChoice,
// originFeatKey, originFeatChoices, versatileFeatKey,
// versatileFeatChoices, ancestryFeatId, ancestryFeatTier,
// ancestryFeatChoices, ancestryFeatSpells, mixedAncestry,
// themeOriginFeatKey } — readCreatorNextStage4Context plus the
// mixed record and the stored theme feat key.

// Ancestry-feat list ids for a species + subrace, mirroring the
// client rule (Stage1OriginIdentity.jsx computeAncestryListId):
// elf + a drow subrace -> 'drow'; aasimar -> the subrace's list, or
// no list when no subrace matches (the client offers no feat picker
// then); otherwise the species id with '-' -> '_'. Returns
// { lists, noList } — noList means no feat list resolves, so no
// ancestry feat is required at commit.
function creatorNextAncestryListInfo(race, subrace) {
  const r = String(race || '').trim().toLowerCase();
  const s = String(subrace || '').trim().toLowerCase();
  if (r === 'elf' && (s.includes('drow') || s.includes('dark elf'))) return { lists: ['drow'], noList: false };
  if (r === 'drow') return { lists: ['drow'], noList: false };
  if (r === 'aasimar') {
    if (s.includes('protector')) return { lists: ['aasimar_protector'], noList: false };
    if (s.includes('scourge')) return { lists: ['aasimar_scourge'], noList: false };
    if (s.includes('fallen')) return { lists: ['aasimar_fallen'], noList: false };
    return { lists: ['aasimar_protector', 'aasimar_scourge', 'aasimar_fallen'], noList: true };
  }
  return { lists: [r.replace(/-/g, '_')], noList: false };
}

// Completeness for ONE origin-feat slot's subchoices at commit — the
// presence half Stage 3 does not enforce (it only judges picks that
// are sent). entry: the featRegistry entry; choices: the slot's
// choices value (null = none sent); field: the error field name;
// fixedList: the Magic Initiate spell list for the slot (the theme's
// fixed list for the theme slot, null for the versatile slot — the
// player chooses the list); themeName: for the fixed-list message.
// Returns an array of errors (empty = complete).
function stage6OriginFeatChoicesComplete(entry, choices, field, fixedList, themeName) {
  const errs = [];
  if (!entry) return errs;
  if (entry.key === 'magic_initiate') {
    if (choices == null || typeof choices !== 'object' || Array.isArray(choices)) {
      errs.push(`${field}: Magic Initiate needs its full choices at Review — spell list, spellcasting ability, 2 cantrips, and a level 1 spell`);
      return errs;
    }
    const spellList = choices.spell_list ?? choices.spellList ?? null;
    if (fixedList != null) {
      if (spellList == null || String(spellList).trim().toLowerCase() !== String(fixedList).toLowerCase()) {
        errs.push(`${field}: spell list must be '${fixedList}'${themeName ? ` for theme '${themeName}'` : ''}`);
      }
    } else if (spellList == null || !ORIGIN_FEAT_SPELL_LISTS.has(String(spellList).trim().toLowerCase())) {
      errs.push(`${field}: spell list must be Cleric, Druid, or Wizard`);
    }
    const ability = choices.spellcasting_ability ?? choices.spellcastingAbility ?? null;
    if (ability == null || !ORIGIN_FEAT_SPELL_ABILITIES.has(String(ability).trim().toLowerCase())) {
      errs.push(`${field}: spellcasting ability must be Intelligence, Wisdom, or Charisma`);
    }
    const cantrips = choices.cantrips ?? null;
    if (!Array.isArray(cantrips) || cantrips.length !== 2) {
      errs.push(`${field}: Magic Initiate needs exactly 2 cantrips`);
    }
    const level1 = choices.level1_spell ?? choices.level1Spell ?? choices.spell ?? null;
    if (typeof level1 !== 'string' || !level1.trim()) {
      errs.push(`${field}: Magic Initiate needs a level 1 spell`);
    }
    return errs;
  }
  if (ORIGIN_SUBCHOICE_FEATS.has(entry.key)) {
    const picks = originSubchoicePicks(choices);
    if (picks === null || picks.length !== 3) {
      errs.push(`${field}: ${entry.name} needs exactly 3 picks at Review`);
    }
    return errs;
  }
  return errs;
}

// Full cantrip validation at commit (see the Stage 6 header): the
// known_cantrips list is the FINAL list — class picks + granted +
// species/subclass choice picks. Returns errors (empty = valid).
// Async because ancestry-feat granted cantrips resolve from the DB.
async function stage6CheckCantrips(merged, cls, subclass, race, subrace, mixedComplete) {
  const errors = [];
  const knownRaw = merged.known_cantrips ?? merged.knownCantrips ?? null;
  const known = knownRaw != null ? stage4ParseStringList(knownRaw) : null;
  if (knownRaw != null && known === null) {
    errors.push('knownCantrips: must be a list of cantrip names');
    return errors;
  }
  const knownList = known || [];
  // Feat cantrips: Magic Initiate cantrips (theme + versatile slots)
  // + ancestry-feat granted cantrips.
  const featCantrips = [];
  for (const choicesRaw of [merged.origin_feat_choices ?? merged.originFeatChoices ?? null, merged.versatile_feat_choices ?? merged.versatileFeatChoices ?? null]) {
    if (choicesRaw && typeof choicesRaw === 'object' && !Array.isArray(choicesRaw) && Array.isArray(choicesRaw.cantrips)) {
      for (const c of choicesRaw.cantrips) {
        if (typeof c === 'string' && c.trim()) featCantrips.push(c.trim());
      }
    }
  }
  const ancFeatId = merged.ancestry_feat_id ?? merged.ancestryFeatId ?? null;
  if (ancFeatId != null) {
    const ancChoices = merged.ancestry_feat_choices ?? merged.ancestryFeatChoices ?? null;
    const grantedSpells = await resolveAncestryFeatGrantedSpells(ancFeatId, ancChoices);
    for (const name of grantedSpells) {
      if (typeof name === 'string' && isCatalogCantrip(name)) featCantrips.push(name);
    }
  }
  // Subclass choices (body or stored row, parsed — never throws).
  const subclassChoices = parseSubclassChoices(merged.subclass_choices ?? merged.subclassChoices ?? null);
  const resolution = resolveCantrips({
    species: race || null,
    variant: subrace || null,
    classId: cls,
    subclass: subclass || null,
    subclassChoices,
    featCantrips,
  });
  const granted = resolution.cantrips || [];
  // Species innate choice picks, structurally: { choose: N, class }.
  const pending = [];
  for (const entry of innateSpellsFor(race, subrace || null) || []) {
    if (entry && typeof entry === 'object' && Number(entry.choose) > 0) {
      pending.push({ count: Number(entry.choose), class: typeof entry.class === 'string' ? entry.class.trim() : null });
    }
  }
  const pendingTotal = pending.reduce((a, p) => a + p.count, 0);
  const classCount = getCantripsKnown(cls, 1, subclass || null);
  const hasSubclassPending = (resolution.choicesPending || []).some((p) => p.source === 'subclass');
  // Presence: a cantrip source means the list is required.
  if ((classCount > 0 || granted.length > 0 || pendingTotal > 0) && knownList.length === 0) {
    errors.push(`knownCantrips: ${cls} has cantrips to record at Review — send the full final list (class picks + granted + species choices)`);
    return errors;
  }
  if (knownList.length === 0) return errors; // no cantrip source, no picks: fine
  // Shape: non-empty strings, catalog cantrips, distinct.
  const seen = new Set();
  for (const entry of knownList) {
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push('knownCantrips: entries must be non-empty spell names');
      return errors;
    }
    const k = canonicalizeSpellName(entry.trim());
    if (seen.has(k)) {
      errors.push(`knownCantrips: '${entry.trim()}' was picked twice`);
      return errors;
    }
    seen.add(k);
    if (!isCatalogCantrip(entry.trim())) {
      errors.push(`knownCantrips: '${entry.trim()}' is not a cantrip in the spell catalog`);
      return errors;
    }
  }
  const knownCanon = knownList.map((c) => canonicalizeSpellName(String(c).trim()));
  const grantedCanon = new Set(granted.map((g) => canonicalizeSpellName(String(g.spell || '').trim())));
  // Every granted cantrip must appear in the final list.
  for (const g of granted) {
    const k = canonicalizeSpellName(String(g.spell || '').trim());
    if (!knownCanon.includes(k)) {
      errors.push(`knownCantrips: must include the granted cantrip '${g.spell}' (${g.source || 'granted'})`);
    }
  }
  // Consume the species choice picks: each needs a distinct known
  // cantrip on its spell list (any catalog cantrip when no list).
  const used = new Set();
  knownCanon.forEach((c, i) => { if (grantedCanon.has(c)) used.add(i); });
  for (const p of pending) {
    let need = p.count;
    for (let i = 0; i < knownCanon.length && need > 0; i++) {
      if (used.has(i)) continue;
      const entry = SPELL_DATA_ENTRIES[knownCanon[i]];
      const classes = (entry?.classes || []).map((c) => String(c).toLowerCase());
      if (!p.class || classes.includes(p.class.toLowerCase())) {
        used.add(i);
        need--;
      }
    }
    if (need > 0) {
      errors.push(`knownCantrips: must include ${p.count} cantrip${p.count === 1 ? '' : 's'} from the ${p.class || 'any'} spell list (species innate choice)`);
    }
  }
  // The remainder is the class picks. The exact count is enforced
  // only where the server can compute it exactly: mixed-ancestry
  // trait cantrips (Elven Lineage, Fiendish Legacy, Light Bearer)
  // have no structured grant, and subclass choice phrases carry no
  // count — so those cases get shape + granted + pending checks
  // only, never a count refusal.
  const remainder = knownList.filter((_, i) => !used.has(i));
  const skipCount = mixedComplete || hasSubclassPending;
  if (!skipCount) {
    if (classCount > 0) {
      if (remainder.length !== classCount) {
        errors.push(`knownCantrips: ${cls} knows ${classCount} cantrip${classCount === 1 ? '' : 's'} at level 1, plus ${granted.length} granted and ${pendingTotal} species-choice cantrip${pendingTotal === 1 ? '' : 's'} — got ${knownList.length} total`);
      }
      for (const name of remainder) {
        const r = canLearnSpell({ classId: cls, level: 1, spellName: name, subclass: subclass || null });
        if (!r.ok) errors.push(`knownCantrips: ${r.reason}`);
      }
    } else if (remainder.length > 0) {
      errors.push(`knownCantrips: ${cls} has no cantrips to pick at level 1 — remove ${remainder.length} pick${remainder.length === 1 ? '' : 's'}`);
    }
  }
  return errors;
}

export async function validateCreatorNextStage6(merged = {}, ctx = {}) {
  const errors = [];
  const row = ctx.row || null;

  const rawRace = merged.race ?? null;
  const race = typeof rawRace === 'string' ? rawRace.trim() : '';
  const rawSubrace = merged.subrace ?? null;
  const subrace = typeof rawSubrace === 'string' ? rawSubrace.trim() : '';
  const rawClass = merged.classId ?? merged.class ?? null;
  const cls = typeof rawClass === 'string' ? rawClass.trim().toLowerCase() : '';
  const rawSubclass = merged.subclassName ?? merged.subclass ?? null;
  const subclass = typeof rawSubclass === 'string' ? rawSubclass.trim() : '';

  const mixed = ctx.mixedAncestry ?? null;
  const mixedComplete = !!(mixed && Array.isArray(mixed.parents) && mixed.parents.length === 2);
  const mixedStarted = !!(mixed && Array.isArray(mixed.parents) && mixed.parents.length > 0);
  const forgoOn = forgoOriginFeatFrom(mixed);

  // --- 1. Compose the Stage 2–5 validators on the merged body. ---
  errors.push(...validateCreatorNextStage2(merged).errors);
  errors.push(...validateCreatorNextStage3(merged, ctx).errors);
  errors.push(...validateCreatorNextStage4(merged, ctx).errors);
  errors.push(...validateCreatorNextStage5(merged, ctx).errors);

  // Wizard spellbook completeness at commit (2026-11-07): a wizard
  // committing prepared spells with no book is refused — the book
  // is never auto-seeded from the prepared list. The player picks
  // the missing spells on Stage 4. (Stage 4 already enforces the
  // exact-6 book and the prepared ⊆ book subset whenever a book is
  // present; this is the prepared-without-any-book case, which
  // Stage 4 stays draft-tolerant on so a half-done Stage 4 can
  // still save.)
  if (cls === 'wizard') {
    const commitKnown = stage4ParseStringList(merged.known_spells ?? merged.knownSpells ?? null);
    const commitPrep = stage4ParseStringList(merged.prepared_spells ?? merged.preparedSpells ?? null);
    if (commitPrep && commitPrep.length > 0 && (!commitKnown || commitKnown.length === 0)) {
      errors.push('knownSpells: wizard\'s spellbook is empty — pick 6 spells for the spellbook on Stage 4 (prepared spells must come from the book); the book is never auto-filled');
    }
  }

  const nonEmpty = (v) => v != null && String(v).trim() !== '';

  // --- 2. Identity. ---
  if (!nonEmpty(merged.name) || String(merged.name).trim().toLowerCase() === '(unnamed)') {
    errors.push('name: a character name is required at Review');
  }
  if (!nonEmpty(merged.first_name ?? merged.firstName)) {
    errors.push('firstName: a first name is required at Review');
  }
  if (!nonEmpty(merged.gender)) {
    errors.push('gender: a gender is required at Review');
  }

  // --- 3. Species. ---
  // When a mixed record is in progress, the species is governed by
  // the record, not the race string — the record refusal below is
  // the whole story.
  let speciesResolved = null;
  if (!mixedStarted) {
    if (!race) {
      errors.push('race: a species is required at Review');
    } else {
      speciesResolved = resolveSpecies(race, subrace || null);
      if (!speciesResolved) {
        errors.push(`race: '${race}' is not a known species — pick a species from the list`);
      } else {
        if (subrace && !speciesResolved.variant) {
          errors.push(`subrace: '${subrace}' is not a variant of ${speciesResolved.entry?.name || race}`);
        }
        if (!isPcCreatable(race, subrace || null)) {
          const displayName = speciesResolved.entry?.name || race;
          errors.push(`race: Species ${displayName} is not available for player characters yet — ${MVP_DEFERRED_NOTE}`);
        }
        const sizeCheck = validateSizeChoice(race, subrace || null, merged.size ?? null);
        errors.push(...sizeCheck.errors);
        const allowedSizes = allowedSizesFor(race, subrace || null);
        if (Array.isArray(allowedSizes) && allowedSizes.length > 1 && (merged.size == null || !String(merged.size).trim())) {
          errors.push(`size: ${speciesResolved.entry?.name || race} chooses a size (${allowedSizes.join(' or ')})`);
        }
      }
    }
  }

  // --- 4. Origin. ---
  const originSetting = merged.origin_setting ?? merged.originSetting ?? null;
  const originRegion = merged.origin_region ?? merged.originRegion ?? null;
  const originExplanation = merged.origin_explanation ?? merged.originExplanation ?? null;
  if (!nonEmpty(originSetting) || String(originSetting).trim() === '__other__') {
    errors.push('originSetting: an origin setting is required at Review');
  }
  if (!nonEmpty(originRegion) || String(originRegion).trim() === '__other__') {
    errors.push('originRegion: an origin region is required at Review');
  }
  if (nonEmpty(originSetting) && String(originSetting).trim() !== '__other__'
    && isOutsideFRSetting(String(originSetting).trim()) && !nonEmpty(originExplanation)) {
    errors.push('originExplanation: an explanation is required when the character comes from outside the Forgotten Realms');
  }
  // No origin-inside-species-origins[] rule: removed by Zach
  // 2026-11-05 — any species from any setting. Not re-imposed.

  // --- 5. Class / subclass. ---
  if (!cls || cls === 'creating' || cls === 'prelude') {
    errors.push('classId: a class is required at Review');
  } else {
    // MVP player-class scope (Zach, 2026-11-08): belt-and-braces
    // for edit-mode commits — a deferred class or subclass is
    // refused at Review even if the draft predates the gray-out.
    if (!isClassPcCreatable(cls)) {
      errors.push(`classId: Class ${displayClassName(cls)} is not available for player characters yet — ${MVP_DEFERRED_CLASS_NOTE}`);
    } else if (SUBCLASS_LEVELS[cls] === 1 && !subclass) {
      errors.push(`subclassId: ${cls} chooses its subclass at level 1 — pick one at Review`);
    }
    if (subclass && !isSubclassPcCreatable(cls, subclass)) {
      const entry = getSubclass(cls, subclass);
      errors.push(`subclassId: Subclass ${entry?.name || subclass} is not available for player characters yet — ${MVP_DEFERRED_SUBCLASS_NOTE}`);
    }
    // Creation-solidification item 5 (2026-11-12): the registry's own
    // selection rules, enforced at commit (validateSelection had no
    // callers — displayed, never enforced). The level is the stored
    // row's (1 for a fresh draft; an edit-mode commit keeps its real
    // level, so a level-5 character's level-3 subclass passes). Only
    // the found + level halves are enforced: Zach's ruling 2026-11-12,
    // "a class is a class" — no subclass, from any setting, needs an
    // origin explanation, so validateSelection's origin reason is
    // ignored here.
    if (subclass && isClassPcCreatable(cls) && isSubclassPcCreatable(cls, subclass)) {
      const selLevel = Number(row?.level) || 1;
      const sel = validateSelection({ className: cls, subclassName: subclass, level: selLevel });
      if (!sel.found) {
        errors.push(`subclassId: '${subclass}' is not a ${displayClassName(cls)} subclass — pick one from the list`);
      } else {
        const entry = getSubclass(cls, subclass);
        // The Stage 2 check above already refuses a subclass sent at
        // level 1 for a class that chooses later — no duplicate line.
        const stage2Covers = selLevel === 1 && SUBCLASS_LEVELS[cls] !== 1;
        if (!stage2Covers && selLevel < Number(entry?.selectionLevel || 0)) {
          errors.push(`subclassId: ${entry.name} is chosen at ${displayClassName(cls)} level ${entry.selectionLevel} (this character is level ${selLevel}) — leave the subclass empty until then`);
        }
      }
    }
  }

  // --- 6. Theme. ---
  const rawThemeId = merged.theme_id ?? merged.themeId ?? null;
  const themePresent = rawThemeId != null && String(rawThemeId).trim() !== '';
  const theme = themePresent ? resolveTheme(rawThemeId) : null;
  if (!themePresent) {
    errors.push('themeId: a theme is required at Review');
  } else if (theme) {
    const pathChoice = merged.theme_path_choice ?? merged.themePathChoice ?? null;
    if (theme.creation_choice_source === 'origin_regions') {
      // R2-11(g): the location follows the character's origin —
      // the client resolves regions (non-FR) or the FR default
      // list (FR) from origin data the server does not hold, so
      // Review requires a non-empty pick but cannot
      // membership-check it; the picker enforces membership.
      if (pathChoice == null || !String(pathChoice).trim()) {
        errors.push(`themePathChoice: theme '${theme.name}' requires a ${theme.creation_choice_label || 'choice'} at Review`);
      }
    } else if (Array.isArray(theme.creation_choice_options) && theme.creation_choice_options.length > 0) {
      const options = theme.creation_choice_options.map((o) => String(o?.value ?? '').trim()).filter(Boolean);
      if (pathChoice == null || !String(pathChoice).trim()) {
        errors.push(`themePathChoice: theme '${theme.name}' requires a ${theme.creation_choice_label || 'choice'} at Review`);
      } else if (!options.some((o) => o.toLowerCase() === String(pathChoice).trim().toLowerCase())) {
        errors.push(`themePathChoice: '${pathChoice}' is not a ${theme.creation_choice_label || 'choice'} for theme '${theme.name}'`);
      }
    }
    // R2-11(e): a second field (soldier's Active Duty) rides
    // path_data as JSON { <key>: <value> } — required at Review
    // with membership against the theme's own option list. The
    // value may ride the merged body (theme_path_data) or the
    // stored row via ctx.themePathData.
    const second = theme.creation_choice_second_field;
    if (second && Array.isArray(second.options) && second.options.length > 0) {
      const secondKey = typeof second.key === 'string' && second.key.trim() ? second.key.trim() : 'value';
      const secondLabel = second.label || 'choice';
      const rawData = merged.theme_path_data ?? merged.themePathData ?? ctx.themePathData ?? null;
      const data = typeof rawData === 'string' ? safeParse(rawData, null) : rawData;
      const secondValue = data && typeof data === 'object' && !Array.isArray(data)
        ? (data[secondKey] ?? data[secondKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] ?? null)
        : null;
      const secondOptions = second.options.map((o) => String(o?.value ?? '').trim()).filter(Boolean);
      if (secondValue == null || !String(secondValue).trim()) {
        errors.push(`themePathData: theme '${theme.name}' requires a ${secondLabel} choice at Review`);
      } else if (!secondOptions.some((o) => o.toLowerCase() === String(secondValue).trim().toLowerCase())) {
        errors.push(`themePathData: '${secondValue}' is not a ${secondLabel} choice for theme '${theme.name}'`);
      }
    }
  }

  // --- 7. Origin feat (theme slot) + versatile slot. ---
  if (!forgoOn) {
    const rawFeat = merged.origin_feat ?? merged.originFeat ?? null;
    const featKey = typeof rawFeat === 'string' ? rawFeat.trim() : '';
    if (!featKey) {
      errors.push('originFeat: the theme origin feat is required at Review');
    } else if (theme) {
      const entry = getFeatEffect(featKey);
      if (entry) {
        const choices = merged.origin_feat_choices ?? merged.originFeatChoices ?? null;
        errors.push(...stage6OriginFeatChoicesComplete(entry, choices, 'originFeatChoices', theme.origin_feat_spell_list ?? null, theme.name));
      }
    }
  }
  const rawVers = merged.versatile_feat ?? merged.versatileFeat ?? null;
  const versKey = typeof rawVers === 'string' ? rawVers.trim() : '';
  if (versKey) {
    const entry = getFeatEffect(versKey);
    if (entry) {
      const choices = merged.versatile_feat_choices ?? merged.versatileFeatChoices ?? null;
      errors.push(...stage6OriginFeatChoicesComplete(entry, choices, 'versatileFeatChoices', null, null));
    }
  }

  // --- 8. Ancestry feat. ---
  const ancestryFeatId = merged.ancestry_feat_id ?? merged.ancestryFeatId ?? null;
  let ancestrySchema = null; // parsed `choices` array from the seed row, or null
  let ancestryFeatRow = null;
  let ancestryLookupFailed = false;
  if (ancestryFeatId != null) {
    try {
      ancestryFeatRow = await dbGet('SELECT list_id, tier, choices FROM ancestry_feats WHERE id = ?', [ancestryFeatId]);
    } catch {
      ancestryFeatRow = null;
      ancestryLookupFailed = true;
    }
    if (ancestryFeatRow?.choices) {
      ancestrySchema = safeParse(ancestryFeatRow.choices, null);
      if (!Array.isArray(ancestrySchema)) ancestrySchema = null;
    }
  }
  if (ancestryFeatId != null && !ancestryFeatRow && !ancestryLookupFailed) {
    errors.push(`ancestryFeatId: '${ancestryFeatId}' is not a known ancestry feat`);
  }
  // Which lists may this character pick from, and is a feat required?
  // An incomplete mixed record is governed by its own refusal below.
  let eligibleLists = [];
  let ancestryFeatRequired = false;
  if (mixedComplete) {
    eligibleLists = ancestryFeatListsFor(mixed.parents);
    if (eligibleLists.length > 0) {
      try {
        const r = await dbGet(
          `SELECT COUNT(*) AS n FROM ancestry_feats WHERE list_id IN (${eligibleLists.map(() => '?').join(',')}) AND tier = 1`,
          eligibleLists
        );
        ancestryFeatRequired = Number(r?.n || 0) > 0;
      } catch { ancestryFeatRequired = false; }
    }
  } else if (!mixedStarted && speciesResolved) {
    const info = creatorNextAncestryListInfo(race, subrace || null);
    eligibleLists = info.lists;
    if (!info.noList) {
      try {
        const r = await dbGet(
          `SELECT COUNT(*) AS n FROM ancestry_feats WHERE list_id IN (${eligibleLists.map(() => '?').join(',')}) AND tier = 1`,
          eligibleLists
        );
        ancestryFeatRequired = Number(r?.n || 0) > 0;
      } catch { ancestryFeatRequired = false; }
    }
  }
  if (ancestryFeatRequired && ancestryFeatId == null) {
    errors.push('ancestryFeatId: an ancestry feat is required at Review — pick one from the species list');
  }
  if (ancestryFeatId != null && ancestryFeatRow && (mixedComplete || !mixedStarted)) {
    if (Number(ancestryFeatRow.tier) !== 1) {
      errors.push(`ancestryFeatId: only tier-1 ancestry feats are picked at character creation (got tier ${ancestryFeatRow.tier})`);
    }
    if (eligibleLists.length > 0 && !eligibleLists.includes(ancestryFeatRow.list_id)) {
      if (mixedComplete) {
        const listErr = await checkMixedAncestryFeatList(mixed.parents, ancestryFeatId);
        if (listErr) errors.push(listErr);
      } else {
        errors.push(`ancestryFeatId: '${ancestryFeatId}' is from the '${ancestryFeatRow.list_id}' ancestry-feat list, which is not the list for ${speciesResolved?.entry?.name || race}`);
      }
    }
    // Subchoices: every declared choice present, then shape/domain.
    const ancChoices = merged.ancestry_feat_choices ?? merged.ancestryFeatChoices ?? null;
    if (Array.isArray(ancestrySchema) && ancestrySchema.length > 0) {
      for (const ch of ancestrySchema) {
        const v = ancChoices && typeof ancChoices === 'object' && !Array.isArray(ancChoices) ? ancChoices[ch.id] : undefined;
        const empty = v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
        if (empty) {
          errors.push(`ancestryFeatChoices: '${ch.id}' is required at Review for this ancestry feat`);
        }
      }
    }
    const choiceCheck = await validateAncestryFeatChoices(ancestryFeatId, ancChoices);
    errors.push(...choiceCheck.errors);
  }

  // --- 9. Scores. ---
  const baseRaw = merged.base_scores ?? merged.baseScores ?? null;
  const base = baseRaw != null ? stage4ParseScores(baseRaw) : null;
  const finalRaw = merged.ability_scores ?? merged.abilityScores ?? null;
  const final = finalRaw != null ? stage4ParseScores(finalRaw) : null;
  if (finalRaw == null || !final) {
    errors.push('abilityScores: all six final ability scores are required at Review');
  }
  const genMethodRaw = merged.generation_method ?? merged.generationMethod ?? null;
  const genMethod = typeof genMethodRaw === 'string' ? genMethodRaw.trim().toLowerCase() : null;
  if (base && !genMethod) {
    errors.push('generationMethod: a generation method is required with base scores at Review');
  }
  // Bases absent: the finals are verifiable only against the stored
  // row. Unchanged finals trust the draft-time validation; changed
  // finals (or no stored baseline) cannot be verified and are refused.
  if (baseRaw == null && final) {
    const storedFinal = row?.ability_scores != null ? stage4ParseScores(row.ability_scores) : null;
    const changed = !storedFinal || STAGE4_ABILITY_KEYS.some((k) => final[k] !== storedFinal[k]);
    if (changed) {
      errors.push('abilityScores: final scores changed without base scores — send base_scores and generation_method so the change can be verified');
    }
  }
  // Mixed branch: base + 0 species ASI + 0 choice picks + theme ASI.
  // Stage 4's arithmetic runs only when the species resolves, so it
  // never runs for mixed characters — this branch is the commit's.
  const themeASI = theme?.ability_score_increase || {};
  const themeOk = !themePresent || !!theme;
  if (mixedComplete && base && final && themeOk) {
    const mismatches = [];
    for (const key of STAGE4_ABILITY_KEYS) {
      const expected = base[key] + (Number(themeASI[key]) || 0);
      if (final[key] !== expected) {
        mismatches.push(`${key}: expected ${expected} (base ${base[key]} + theme ${Number(themeASI[key]) || 0}), got ${final[key]}`);
      }
    }
    if (mismatches.length > 0) {
      errors.push(`abilityScores: final scores do not match base + theme for a mixed-ancestry character (${mismatches.join('; ')})`);
    }
  }
  // Mixed characters have no species ability-choice picks.
  const picksRaw = merged.ability_choice_picks ?? merged.abilityChoicePicks ?? null;
  if (mixedComplete && picksRaw != null) {
    let mixedPicksCount = 0;
    let input = picksRaw;
    if (typeof input === 'string') {
      try { input = JSON.parse(input); } catch { input = null; }
    }
    if (Array.isArray(input)) mixedPicksCount = input.length;
    else if (input && typeof input === 'object') mixedPicksCount = Object.values(input).filter((v) => v === 1).length;
    if (mixedPicksCount > 0) {
      errors.push('abilityChoicePicks: mixed-ancestry characters have no species ability-choice picks — their species ASI is 0');
    }
  }
  // Non-mixed choice species: picks are required when the bases are
  // present (Stage 4 refuses a wrong count; an absent pick set is a
  // draft there, a refusal here).
  if (!mixedStarted && speciesResolved) {
    const speciesASI = resolvedASIFor(race, subrace || null);
    const choiceN = speciesASI && Number.isInteger(speciesASI.choice) ? speciesASI.choice : 0;
    if (choiceN > 0 && baseRaw != null && picksRaw == null) {
      errors.push(`abilityChoicePicks: ${speciesResolved.entry?.name || race} grants ${choiceN} ability-choice pick${choiceN === 1 ? '' : 's'} — send them at Review`);
    }
  }

  // --- 10. Final lists: skills / languages / tools. ---
  const skills = merged.skills != null ? stage4ParseStringList(merged.skills) : null;
  if (skills === null || skills.length === 0) {
    errors.push('skills: a final skill list is required at Review');
  }
  const languages = merged.languages != null ? stage4ParseStringList(merged.languages) : null;
  if (languages === null || languages.length === 0) {
    errors.push('languages: a final language list is required at Review');
  }
  const toolsRaw = merged.tool_proficiencies ?? merged.toolProficiencies ?? null;
  const toolsList = toolsRaw != null ? stage4ParseStringList(toolsRaw) : null;
  if (toolsRaw != null && toolsList === null) {
    errors.push('toolProficiencies: must be a list of tool names');
  }
  // Feat-granted picks must appear in the final lists (Stage 4
  // subtracts them when deriving class picks, so a list missing one
  // is an inconsistent final state). This is the Traveler's Tongue
  // rule: the final languages list must include the feat's language
  // picks — and the same for skill / tool picks.
  const lowerSet = (arr) => new Set((arr || []).filter((s) => typeof s === 'string').map((s) => stage4NormListName(s)));
  const skillsLower = lowerSet(skills);
  const languagesLower = lowerSet(languages);
  const toolsLower = lowerSet(toolsList);
  const needSkill = new Set();
  const needTool = new Set();
  const needLanguage = new Set();
  const collectOriginPicks = (featKeyRaw, choicesRaw) => {
    const entry = typeof featKeyRaw === 'string' ? getFeatEffect(featKeyRaw) : null;
    if (!entry) return;
    const picks = originSubchoicePicks(choicesRaw) || [];
    if (entry.key === 'skilled') {
      const skillSet = new Set(STAGE4_SKILLS.map((s) => s.toLowerCase()));
      const toolSet = new Set(STAGE4_TOOLS.map((s) => s.toLowerCase()));
      for (const p of picks) {
        if (typeof p !== 'string') continue;
        const k = stage4NormListName(p);
        if (skillSet.has(k)) needSkill.add(k);
        else if (toolSet.has(k)) needTool.add(k);
      }
    } else if (entry.key === 'musician' || entry.key === 'crafter') {
      for (const p of picks) {
        if (typeof p === 'string' && p.trim()) needTool.add(stage4NormListName(p));
      }
    }
  };
  if (!forgoOn) collectOriginPicks(merged.origin_feat ?? merged.originFeat ?? null, merged.origin_feat_choices ?? merged.originFeatChoices ?? null);
  collectOriginPicks(merged.versatile_feat ?? merged.versatileFeat ?? null, merged.versatile_feat_choices ?? merged.versatileFeatChoices ?? null);
  if (Array.isArray(ancestrySchema) && ancestrySchema.length > 0) {
    const ancChoices = merged.ancestry_feat_choices ?? merged.ancestryFeatChoices ?? null;
    for (const ch of ancestrySchema) {
      const v = ancChoices && typeof ancChoices === 'object' && !Array.isArray(ancChoices) ? ancChoices[ch.id] : undefined;
      const vals = Array.isArray(v) ? v : (typeof v === 'string' ? [v] : []);
      for (const s of vals) {
        if (typeof s !== 'string' || !s.trim()) continue;
        const k = stage4NormListName(s);
        if (ch.type === 'skill') needSkill.add(k);
        else if (ch.type === 'language') needLanguage.add(k);
        else if (ch.type === 'tool') needTool.add(k);
      }
    }
  }
  if (skills !== null) {
    for (const s of needSkill) {
      if (!skillsLower.has(s.toLowerCase())) errors.push(`skills: must include the feat-granted skill '${s}'`);
    }
  }
  if (languages !== null) {
    for (const s of needLanguage) {
      if (!languagesLower.has(s.toLowerCase())) errors.push(`languages: must include the feat-granted language '${s}'`);
    }
  }
  // R2-15 count rule (creation-solidification item 3, Zach 2026-11-10):
  // a species whose languages promise "one extra language of your
  // choice" (Human, Half-Elf, ...) must carry that many languages
  // BEYOND its concrete grants and any feat-granted languages. Same
  // placeholder count the client picker uses (one slot per "of your
  // choice" entry). Mixed ancestry offers no species slots — skipped.
  if (languages !== null && speciesResolved?.entry && !mixedStarted) {
    const speciesLangs = Array.isArray(speciesResolved.entry.languages) ? speciesResolved.entry.languages : [];
    const isChoice = (l) => /of your choice/i.test(String(l || ''));
    const slots = speciesLangs.filter(isChoice).length;
    if (slots > 0) {
      const concrete = new Set(speciesLangs.filter((l) => !isChoice(l)).map((l) => stage4NormListName(l)));
      const extras = [...languagesLower].filter((l) => !concrete.has(l) && !needLanguage.has(l));
      if (extras.length < slots) {
        const speciesName = speciesResolved.entry.name || race;
        const missing = slots - extras.length;
        errors.push(`languages: ${speciesName} grants ${slots === 1 ? 'one extra language' : `${slots} extra languages`} of your choice — ${missing === 1 ? 'pick it' : `pick ${missing} more`} on Stage 1 (Extra language) before committing`);
      }
    }
  }
  if (toolsList !== null) {
    for (const s of needTool) {
      if (!toolsLower.has(s.toLowerCase())) errors.push(`toolProficiencies: must include the feat-granted tool '${s}'`);
    }
  } else if (needTool.size > 0) {
    errors.push('toolProficiencies: must include the feat-granted tool picks — send the tool list at Review');
  }

  // --- 11. Spells: known / prepared lists present with the exact count. ---
  if (cls && KNOWN_CLASSES.includes(cls) && final) {
    const knownCount = getSpellsKnown(cls, 1, subclass || null);
    const ability = spellcastingAbilityFor(cls, subclass || null);
    let prepCount = null;
    if (ability) {
      prepCount = getSpellsPrepared(cls, 1, stage4AbilityMod(final[ability]), subclass || null);
    } else {
      prepCount = getSpellsPrepared(cls, 1, 0, subclass || null);
    }
    const knownRaw = merged.known_spells ?? merged.knownSpells ?? null;
    const prepRaw = merged.prepared_spells ?? merged.preparedSpells ?? null;
    // A count of 0 (magus L1, blackguard L1) means nothing to pick:
    // an empty / absent list is correct, and Stage 4 already refuses
    // a non-empty one. Only a positive count requires the list.
    if (knownCount !== null && knownCount > 0) {
      const list = knownRaw != null ? stage4ParseStringList(knownRaw) : null;
      if (list === null || list.length === 0) {
        errors.push(`knownSpells: ${cls} knows ${knownCount} spell${knownCount === 1 ? '' : 's'} at level 1 — send them at Review`);
      }
    } else if (prepCount !== null && prepCount > 0) {
      const list = prepRaw != null ? stage4ParseStringList(prepRaw) : null;
      if (list === null || list.length === 0) {
        errors.push(`preparedSpells: ${cls} prepares ${prepCount} spell${prepCount === 1 ? '' : 's'} at level 1 — send them at Review`);
      }
    }
    // (Non-casters: Stage 4 refuses any spell pick; an absent list is correct.)
  }

  // --- 12. Gear. ---
  const gearChoiceRaw = merged.gear_choice ?? merged.gearChoice ?? null;
  const gearChoice = typeof gearChoiceRaw === 'string' ? gearChoiceRaw.trim().toLowerCase() : null;
  const packageIdRaw = merged.package_id ?? merged.packageId ?? null;
  const packageId = typeof packageIdRaw === 'string' ? packageIdRaw.trim().toUpperCase() : null;
  const gearPicksParsed = stage5ParsePicks(merged.package_picks ?? merged.packagePicks ?? null);
  const gearPicks = stage5NormalizePicks(gearPicksParsed.ok ? gearPicksParsed.picks : {}, packageId);
  const gearSent = !!(gearChoice || packageId || Object.keys(gearPicks).length > 0);
  if (gearSent) {
    if (!gearChoice) {
      errors.push('gearChoice: pick a gear fork at Review — packages or starting gold');
    } else if (gearChoice === 'packages') {
      if (!packageId) {
        errors.push('packageId: a package is required when gear_choice is \'packages\'');
      } else if (cls && KNOWN_CLASSES.includes(cls)) {
        const resolved = resolvePackage(cls, packageId, gearPicks);
        if (!resolved || !resolved.ok) {
          const detail = resolved?.errors
            ? ` — ${resolved.errors.map((e) => (typeof e === 'string' ? e : e.message || String(e))).join('; ')}`
            : '';
          errors.push(`packageId: package '${packageId}' does not resolve for ${cls} with these picks${detail}`);
        }
      }
    } else if (gearChoice === 'gold') {
      if (cls && KNOWN_CLASSES.includes(cls)) {
        const themeMod = (typeof rawThemeId === 'string' && rawThemeId) ? (THEME_GOLD_MODIFIERS[rawThemeId] ?? 0) : 0;
        const fork = computeGoldFork(cls, rawThemeId, themeMod);
        if (!fork || (typeof fork === 'object' && !fork.ok)) {
          errors.push(`gearChoice: '${cls}' has no starting-gold option — its source prints no gold alternative, so take a starting package instead`);
        }
      }
    }
  } else {
    // No gear in the body: the stored gear must already exist.
    const inv = row?.inventory != null ? stage4ParseStringList(row.inventory) : null;
    const invCount = Array.isArray(inv) ? inv.length : 0;
    let equipCount = 0;
    if (row?.equipment != null) {
      const eq = typeof row.equipment === 'string' ? safeParse(row.equipment, null) : row.equipment;
      if (Array.isArray(eq)) equipCount = eq.length;
      else if (eq && typeof eq === 'object') equipCount = Object.keys(eq).length;
    }
    const goldGp = Number(row?.gold_gp ?? 0) || 0;
    if (invCount === 0 && equipCount === 0 && goldGp <= 0) {
      errors.push('gearChoice: no starting gear — pick a package or take starting gold at Review');
    }
  }

  // --- 13. Fighting style, subclass choices, expertise. ---
  // Fighting style, level-gated (2024 PHB via CLASS_FEATURES):
  // fighter gains it at L1, paladin and ranger at L2 — a level-1
  // paladin/ranger cannot have one yet, so the creator (all L1)
  // requires it for fighter only. Duelist also gains one at L1
  // (CLASS_FEATURES) but has no creator picker yet, so it stays
  // unrequired until a picker exists (coordinator decision
  // 2026-11-07, reversible — flag for Zach's veto). The level is
  // the CLASS level, not the total: a multiclass paladin 1 / rogue 1
  // (total 2) has not reached paladin 2 yet, so no style is due.
  // Read from the stored row's class_levels (same shape as the
  // paladin PUT block below: JSON array of { class, level, ... });
  // rows with no class_levels, or no entry for this class, fall back
  // to the stored total level, as before. A body-carried level wins
  // over the row total, as everywhere in the merged body.
  const fightingStyle = merged.fighting_style ?? merged.fightingStyle ?? null;
  const classLevelsRaw = row?.class_levels ?? null;
  const classLevels = typeof classLevelsRaw === 'string' ? safeParse(classLevelsRaw, null) : classLevelsRaw;
  const classEntry = Array.isArray(classLevels)
    ? classLevels.find((e) => String(e?.class ?? '').toLowerCase() === cls)
    : null;
  const charLevel = Number(classEntry?.level) || Number(merged.level ?? row?.level ?? 1) || 1;
  const styleLevel = cls === 'fighter' ? 1 : (cls === 'paladin' || cls === 'ranger') ? 2 : null;
  if (styleLevel != null && charLevel >= styleLevel) {
    if (typeof fightingStyle !== 'string' || !fightingStyle.trim()) {
      errors.push(`fightingStyle: ${cls} picks a fighting style at level ${styleLevel} — send one at Review`);
    }
  } else if (fightingStyle != null && (typeof fightingStyle !== 'string' || !fightingStyle.trim())) {
    errors.push('fightingStyle: must be a non-empty fighting style name');
  }
  // Membership: a sent style must be one of the 10 registry styles
  // (listFightingStyleFeats, featRegistry.js), matched by key or
  // display name, case-insensitive ('Defense' / 'defense'). No
  // per-class subsets — the full registry list is the list
  // (coordinator decision 2026-11-07, reversible).
  if (typeof fightingStyle === 'string' && fightingStyle.trim()) {
    const knownStyles = listFightingStyleFeats();
    const sentName = normalizeFeatName(fightingStyle);
    const matched = knownStyles.some((s) => normalizeFeatName(s.key) === sentName || normalizeFeatName(s.name) === sentName);
    if (!matched) {
      errors.push(`fightingStyle: '${fightingStyle.trim()}' is not a fighting style — pick one from the fighting style list`);
    }
  }
  // Subclass choices: shape + registry membership per key.
  const subclassChoicesRaw = merged.subclass_choices ?? merged.subclassChoices ?? null;
  let subclassChoices = {};
  if (subclassChoicesRaw != null) {
    if (typeof subclassChoicesRaw === 'string') {
      try {
        const parsed = JSON.parse(subclassChoicesRaw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) subclassChoices = parsed;
        else errors.push('subclassChoices: must be an object keyed by choice');
      } catch {
        errors.push('subclassChoices: must be an object keyed by choice');
      }
    } else if (typeof subclassChoicesRaw === 'object' && !Array.isArray(subclassChoicesRaw)) {
      subclassChoices = subclassChoicesRaw;
    } else {
      errors.push('subclassChoices: must be an object keyed by choice');
    }
  }
  const subclassChoiceKeys = Object.keys(subclassChoices);
  if (subclassChoiceKeys.length > 0 && !subclass) {
    errors.push('subclassChoices: subclass choices were sent without a subclass');
  } else if (subclassChoiceKeys.length > 0 && subclass) {
    for (const key of subclassChoiceKeys) {
      const value = subclassChoices[key];
      const result = Array.isArray(value)
        ? validateChoiceList(cls, subclass, key, value)
        : validateChoice(cls, subclass, key, value);
      if (!result.valid) {
        errors.push(`subclassChoices.${key}: ${result.reason || 'invalid choice'}`);
      }
    }
  }
  // Expertise: shape-validated, a subset of the final skills when sent.
  const expertiseRaw = merged.expertise ?? null;
  if (expertiseRaw != null) {
    const expList = stage4ParseStringList(expertiseRaw);
    if (expList === null) {
      errors.push('expertise: must be a list of skill names');
    } else {
      const seen = new Set();
      for (const e of expList) {
        if (typeof e !== 'string' || !e.trim()) {
          errors.push('expertise: entries must be non-empty skill names');
          break;
        }
        const k = stage4NormListName(e);
        if (seen.has(k)) {
          errors.push(`expertise: '${e.trim()}' was picked twice`);
          break;
        }
        seen.add(k);
        if (!STAGE4_SKILLS.some((s) => s.toLowerCase() === k)) {
          errors.push(`expertise: '${e.trim()}' is not a known skill`);
          break;
        }
        if (skills && !skillsLower.has(k)) {
          errors.push(`expertise: '${e.trim()}' is not one of the character's skills`);
          break;
        }
      }
    }
  }

  // --- 14. Story. ---
  for (const [field, value] of [
    ['alignment', merged.alignment],
    ['faith', merged.faith],
    ['lifestyle', merged.lifestyle],
    ['age', merged.age],
    ['height', merged.height],
    ['weight', merged.weight],
    ['eye_color', merged.eye_color ?? merged.eyeColor],
    ['hair_color', merged.hair_color ?? merged.hairColor],
    ['skin_color', merged.skin_color ?? merged.skinColor],
    ['physical_build', merged.physical_build ?? merged.physicalBuild],
  ]) {
    if (!nonEmpty(value)) {
      errors.push(`${field}: ${field.replace(/_/g, ' ')} is required at Review`);
    }
  }

  // --- 15. Mixed Ancestry recompute branch. ---
  if (mixed != null) {
    const mixedCheck = validateMixedAncestry(mixed);
    errors.push(...mixedCheck.errors);
  }
  if (mixedComplete) {
    if (!mixed.size || !String(mixed.size).trim()) {
      errors.push('mixedAncestry.size: a size is required at Review for a mixed-ancestry character');
    }
    if (!Array.isArray(mixed.traits) || mixed.traits.length === 0) {
      errors.push('mixedAncestry.traits: at least one trait is required at Review for a mixed-ancestry character');
    }
  }

  // --- 16. Cantrips (async: ancestry-feat grants resolve from the DB). ---
  if (cls && KNOWN_CLASSES.includes(cls)) {
    errors.push(...await stage6CheckCantrips(merged, cls, subclass, race, subrace, mixedComplete));
  }

  return { ok: errors.length === 0, errors };
}

const router = express.Router();

// Get all characters
router.get('/', async (req, res) => {
  try {
    const characters = await dbAll('SELECT * FROM characters ORDER BY updated_at DESC', []);
    res.json(characters);
  } catch (error) {
    handleServerError(res, error, 'fetch characters');
  }
});

// Get single character
router.get('/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return notFound(res, 'Character');
    }
    res.json(character);
  } catch (error) {
    handleServerError(res, error, 'fetch character');
  }
});

// Get character progression — theme, unlocked + upcoming abilities, ancestry feats,
// Knight moral path, and any resonant Subclass × Theme / Mythic × Theme combos.
// Delegates to progressionService so the same snapshot shape is used by both
// the Character Sheet UI and the DM session prompt builder.
router.get('/:id/progression', async (req, res) => {
  try {
    const snapshot = await getCharacterProgression(req.params.id);
    if (!snapshot) return notFound(res, 'Character');
    res.json(snapshot);
  } catch (error) {
    handleServerError(res, error, 'fetch character progression');
  }
});

// MVP player-class/subclass scope (Zach, 2026-11-08): Magus,
// Blackguard, Scholar (classes) and Fighter Monster Hunter +
// Monk Warrior of Waves (subclasses) are grayed out for player
// characters, not removed — NPCs/companions keep them (their
// routes live in npc.js / companion.js and are untouched). Each
// helper returns the refusal message, or null when the pick is
// allowed. Draft placeholders ('creating' / 'prelude') pass
// through, same as the Stage 2 validator. Unknown classes /
// subclasses pass through (v1 no-rejection rule); only known
// deferred picks refuse.
function displayClassName(raw) {
  const norm = String(raw || '').trim().toLowerCase();
  return norm.charAt(0).toUpperCase() + norm.slice(1);
}
function classScopeRefusal(cls) {
  const norm = String(cls || '').trim().toLowerCase();
  if (!norm || norm === 'creating' || norm === 'prelude') return null;
  if (!isClassPcCreatable(norm)) {
    return `Class ${displayClassName(norm)} is not available for player characters yet — ${MVP_DEFERRED_CLASS_NOTE}`;
  }
  return null;
}
function subclassScopeRefusal(cls, sub) {
  if (sub == null || !String(sub).trim()) return null;
  if (!isSubclassPcCreatable(cls, sub)) {
    const entry = getSubclass(cls, sub);
    const display = entry?.name || String(sub).trim();
    return `Subclass ${display} is not available for player characters yet — ${MVP_DEFERRED_SUBCLASS_NOTE}`;
  }
  return null;
}
// A class_levels array (JSON string or parsed) carrying a deferred
// class or a deferred subclass is refused too — a direct PUT of
// class_levels must not bypass the level-up route.
function classLevelsScopeRefusal(rawLevels) {
  const levels = typeof rawLevels === 'string' ? safeParse(rawLevels, null) : rawLevels;
  if (!Array.isArray(levels)) return null;
  for (const entry of levels) {
    const cls = entry?.class != null ? String(entry.class) : null;
    const refusal = cls != null ? classScopeRefusal(cls) : null;
    if (refusal) return refusal;
    const subRefusal = subclassScopeRefusal(cls, entry?.subclass ?? null);
    if (subRefusal) return subRefusal;
  }
  return null;
}

// Create new character
router.post('/', async (req, res) => {
  try {
    // `let`, not `const`: the Stage 5 derivation below reassigns the
    // derived fields (max_hp, current_hp, armor_class, gold_gp,
    // inventory, equipment) before the INSERT.
    let {
      creator = null,
      name = '(unnamed)',
      first_name = null,
      last_name = null,
      nickname = null,
      gender = null,
      class: charClass = 'creating',
      subclass = null,
      race = '',
      subrace = null,
      // 2024 size choice (PHB p. 194, migration 110): Medium or
      // Small for human, chosen at selection. Persisted via the
      // post-insert UPDATE below (like the origin columns).
      size = null,
      background = null,
      // Phase 2 chunk 5 batch 3 sub-checkpoint 2 fix (refined v1.0.116) —
      // partial-save POSTs need defaults that satisfy schema NOT NULL
      // constraints, not just non-undefined values. The five fields below
      // (class, current_hp, max_hp, current_location, experience_to_next_level)
      // are NOT NULL with no schema-level default; legacy creation always
      // populated them but Step-1 partial saves don't have them yet.
      // Placeholder values mirror the existing prelude pattern (preludeService
      // uses `class='prelude'`, `level=0`, computed HP, computed location).
      // Consumers that key off creation_phase (e.g., level-up checker) skip
      // these in-progress rows, so the placeholders never reach gameplay code.
      level = 1,
      current_hp = 0,
      max_hp = 0,
      current_location = '',
      current_quest = null,
      gold_cp = 0,
      gold_sp = 0,
      gold_gp = 0,
      experience = 0,
      experience_to_next_level = 0,
      armor_class = 10,
      speed = 30,
      ability_scores = '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
      skills = '[]',
      advantages = '[]',
      inventory = '[]',
      faction_standings = '{}',
      injuries = '[]',
      debuffs = '[]',
      equipment = '[]',
      avatar = null,
      alignment = null,
      faith = null,
      lifestyle = null,
      hair_color = null,
      skin_color = null,
      eye_color = null,
      height = null,
      weight = null,
      age = null,
      personality_traits = null,
      ideals = null,
      bonds = null,
      flaws = null,
      organizations = null,
      allies = null,
      enemies = null,
      backstory = null,
      other_notes = null,
      physical_build = null,
      known_cantrips = '[]',
      known_spells = '[]',
      prepared_spells = '[]',
      feats = '[]',
      languages = '[]',
      tool_proficiencies = '[]',
      keeper_texts = '[]',
      keeper_recitations = '[]',
      keeper_genre_domain = null,
      // Progression system — Phase 2 additions
      theme_id = null,
      theme_path_choice = null,
      ancestry_feat_id = null,
      ancestry_list_id = null,
      ancestry_feat_choices = null, // object of player-resolved sub-choices, e.g. { skill: 'perception', language: 'dwarvish' }
      // Warlock pact (creator test-notes item 11, migration 113) —
      // the 2024 Pact choice, one of 'blade' | 'chain' | 'tome'.
      // Persisted via the post-insert UPDATE below (the INSERT column
      // list is parallel to its values list, so new columns ride the
      // UPDATE rather than a placeholder-count-sensitive INSERT edit).
      pact = null,
      // Creator-next Stage 3 (migration 107) — the theme's fixed
      // origin feat + its sub-choices (e.g. Magic Initiate spells).
      origin_feat = null,
      origin_feat_choices = null,
      // Human Versatile (item 19, 2026-11-06, migration 109) — the
      // standalone 2024 human pick: any one origin feat, stored in
      // character_origin_feats with slot 'versatile'.
      versatile_feat = null,
      versatile_feat_choices = null,
      // Mixed Ancestry (2026-11-06, migration 108) — the structured
      // record { parents, size, speed, traits, forgoOriginFeat,
      // versatileFeat }; undefined when absent (a null is an explicit
      // clear on PUT). Persisted via the post-insert UPDATE below
      // (like the origin columns), never through the INSERT
      // placeholder list.
      mixed_ancestry = undefined,
      // Creator-next Stage 1 (migration 105) — origin facts. Persisted
      // via the UPDATE block below (the INSERT column list is parallel
      // to its values list, so new columns ride the post-insert UPDATE
      // rather than a placeholder-count-sensitive INSERT edit).
      origin_setting = null,
      origin_region = null,
      origin_explanation = null,
      // Creation-solidification item 5 (migration 114).
      subclass_origin_explanation = null,
      // Phase 2 chunk 5 batch 3 checkpoint 2 — manual-mode creator.
      // 'creating' is set at Step 1 advance for partial-creation rows
      // that the player can resume later; 'active' is set at Step 8
      // submit. Defaults to 'active' for backwards compatibility with
      // existing callers (server seed scripts, tests, internal imports)
      // that send no creator marker. A creator-next draft that omits
      // creation_phase is born 'creating' (Stage 6: the commit flips
      // it to 'active'); consumers that key off creation_phase (e.g.
      // the level-up checker) must not treat an in-progress draft as
      // a playable character.
      creation_phase = creator === 'creator-next' ? 'creating' : 'active'
    } = req.body;

    // Mixed Ancestry (2026-11-06): validated whenever present, any
    // caller — it derives the stored race string and speed, so an
    // unvalidated record could corrupt both. Absent = not mixed.
    // Runs before the MVP guard: a complete mixed record's parents
    // are PC-creatable-checked inside the validator, so the guard
    // below judges the BODY race only when there is no mixed record.
    const mixedRaw = mixed_ancestry ?? req.body.mixedAncestry ?? undefined;
    const mixed = validateMixedAncestry(mixedRaw);
    if (!mixed.ok) return validationError(res, mixed.errors.join('; '));
    const mixedComplete = mixedRaw != null && mixed.normalized && mixed.normalized.parents.length === 2;
    // A complete mixed record derives the stored species string and
    // speed from the parents/traits; the body's race/subrace/speed
    // are ignored for storage.
    const storedRace = mixedComplete ? mixedAncestrySpeciesLabel(mixed.normalized.parents) : race;
    const storedSubrace = mixedComplete ? null : subrace;
    // `let`: the Stage 5 derivation below may override the stored
    // speed with the registry speed for the species.
    let storedSpeed = mixedComplete ? mixed.normalized.speed : speed;
    // Size choice (2024 PHB p. 194, migration 110): a complete
    // mixed record owns size (its validator already judged it);
    // otherwise the body's size is validated against the stored
    // species. Absent = no choice claimed yet (draft, NULL).
    let storedSize = null;
    if (mixedComplete) {
      storedSize = mixed.normalized.size ?? null;
    } else {
      const sizeCheck = validateSizeChoice(storedRace, storedSubrace, size ?? req.body.size ?? null);
      if (!sizeCheck.ok) return validationError(res, sizeCheck.errors.join('; '));
      storedSize = sizeCheck.size;
    }
    // Forgo trade, any caller: the trade and a theme origin-feat
    // grant cannot coexist. Marker bodies hit the same refusal
    // inside validateCreatorNextStage3 below; this is the backstop
    // for non-marker callers, same message.
    if (mixedComplete && mixed.normalized.forgoOriginFeat && (origin_feat ?? req.body.originFeat)) {
      return validationError(res, MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_MESSAGE);
    }

    // MVP player-species scope (Zach, 2026-11-05): player characters are
    // limited to the 11 pre-expansion species. The 18 outside-FR species
    // stay in the registry for NPCs, but a PC POST naming one is refused
    // with the species named. Unknown species stay allowed (v1 rule —
    // seeds/Prelude carry free-text races); only known deferred species
    // refuse. NPC creation is a separate route (npc.js) and is untouched.
    if (!mixedComplete && race && !isPcCreatable(race, subrace)) {
      const displayName = resolveSpecies(race, subrace)?.entry?.name || race;
      return res.status(400).json({ error: `Species ${displayName} is not available for player characters yet — ${MVP_DEFERRED_NOTE}` });
    }

    // MVP player-class scope (Zach, 2026-11-08): mirror of the
    // species guard above — a PC POST naming a deferred class or a
    // deferred subclass is refused with the class/subclass named.
    // Unconditional (not marker-gated): every POST caller is
    // covered, same as the species guard. Draft placeholders pass
    // through; unknown classes/subclasses pass through (v1 rule).
    const classRefusal = classScopeRefusal(charClass);
    if (classRefusal) {
      return res.status(400).json({ error: classRefusal });
    }
    const subclassRefusal = subclassScopeRefusal(charClass, subclass);
    if (subclassRefusal) {
      return res.status(400).json({ error: subclassRefusal });
    }

    // Creator-next Stage 2 validation (2026-11-05): only for bodies
    // carrying the creator-next marker (stage1Persistence.js sends it).
    // Every other POST caller skips this block, so old-path behavior is
    // unchanged. Fail-fast: before campaign linkage and the INSERT.
    if (req.body.creator === 'creator-next') {
      const stage2 = validateCreatorNextStage2(req.body);
      if (!stage2.ok) return validationError(res, stage2.errors.join('; '));
      const stage3 = validateCreatorNextStage3(req.body);
      if (!stage3.ok) return validationError(res, stage3.errors.join('; '));
      const stage4 = validateCreatorNextStage4(req.body);
      if (!stage4.ok) return validationError(res, stage4.errors.join('; '));
      const stage5 = validateCreatorNextStage5(req.body);
      if (!stage5.ok) return validationError(res, stage5.errors.join('; '));
      // Stage 5 derivation (2026-11-07): the server resolves the
      // gear fork and derives HP/AC/speed — never trust client-sent
      // values for these. Derived values overwrite the destructured
      // bindings above (hence `let`); anything underivable is left
      // exactly as sent (draft-tolerant). gold_gp is mirrored into
      // starting_gold_gp by the INSERT below, as before.
      const stage5Derived = deriveCreatorNextStage5(req.body, {}, { isPost: true });
      if (stage5Derived.maxHp != null) { max_hp = stage5Derived.maxHp; current_hp = stage5Derived.currentHp; }
      if (stage5Derived.armorClass != null) armor_class = stage5Derived.armorClass;
      if (stage5Derived.speed != null) storedSpeed = stage5Derived.speed;
      if (stage5Derived.goldGp != null) gold_gp = stage5Derived.goldGp;
      if (stage5Derived.inventory != null) inventory = stage5Derived.inventory;
      if (stage5Derived.equipment != null) equipment = stage5Derived.equipment;
      // Item 20 (store): validation accepts snake_case, but the row
      // must hold the display form — see stage4CanonicalListJson.
      // Only creator-next bodies are rewritten; every other caller
      // stores exactly what it sent.
      const canonSkills = stage4CanonicalListJson(skills, STAGE4_SKILLS);
      if (canonSkills != null) skills = canonSkills;
      const canonLanguages = stage4CanonicalListJson(languages, STAGE4_LANGUAGES);
      if (canonLanguages != null) languages = canonLanguages;
      const canonTools = stage4CanonicalListJson(tool_proficiencies, STAGE4_TOOLS);
      if (canonTools != null) tool_proficiencies = canonTools;
    }

    // Ancestry-feat sub-choices (2026-11-06, item 2): the feat's
    // choices are validated against the feat's own schema (arrays
    // of exactly `count` distinct picks for count > 1) whenever a
    // POST carries them — the persist below stored them
    // unvalidated before this. Runs for any caller, not just
    // creator-next.
    if (ancestry_feat_id != null && ancestry_feat_choices != null) {
      const ancestryCheck = await validateAncestryFeatChoices(ancestry_feat_id, ancestry_feat_choices);
      if (!ancestryCheck.ok) return validationError(res, ancestryCheck.errors.join('; '));
    }

    // Mixed Ancestry ancestry-feat list (2026-11-06): a mixed
    // character's ancestry feat must come from either parent's list.
    if (mixedComplete && ancestry_feat_id != null) {
      const listError = await checkMixedAncestryFeatList(mixed.normalized.parents, ancestry_feat_id);
      if (listError) return validationError(res, listError);
    }

    // Human Versatile (item 19, 2026-11-06): route-level gates for
    // non-marker callers — marker bodies already passed Stage 3
    // above (same rules, same messages). Human only; a 2024 origin
    // feat; different from the theme feat.
    const versatileFeatRawPost = versatile_feat ?? req.body.versatileFeat ?? null;
    if (typeof versatileFeatRawPost === 'string' && versatileFeatRawPost.trim()) {
      if (versatileHumanStatus(storedRace, storedSubrace) === false) {
        return validationError(res, `versatileFeat: '${versatileFeatRawPost.trim()}' is only available to human characters (2024 Versatile)`);
      }
      const vEntryPost = getFeatEffect(versatileFeatRawPost.trim());
      if (!vEntryPost || vEntryPost.category !== 'origin') {
        return validationError(res, `versatileFeat: '${versatileFeatRawPost.trim()}' is not a 2024 origin feat`);
      }
      const themeFeatPost = origin_feat ?? req.body.originFeat ?? null;
      if (themeFeatPost && normFeatKey(vEntryPost.key) === normFeatKey(canonicalOriginFeatKey(themeFeatPost))) {
        return validationError(res, `versatileFeat: '${versatileFeatRawPost.trim()}' is already the theme's origin feat (${vEntryPost.name}) — the Versatile feat must be a different origin feat`);
      }
    }

    // Campaign linkage: an explicit campaign_id in the body wins (validated
    // below); otherwise default to the user's most recently updated active
    // campaign. NULL campaign_id silently disables chronicles, the rollup,
    // weather, and the world tick downstream — reassignment stays available
    // via PUT /:id/campaign.
    let campaign_id = req.body.campaign_id ?? null;
    if (campaign_id) {
      const campaign = await dbGet('SELECT id FROM campaigns WHERE id = ?', [campaign_id]);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
    } else {
      const activeCampaigns = await campaignService.getActiveCampaigns(req.user?.id);
      if (activeCampaigns.length > 0) {
        campaign_id = activeCampaigns[0].id;
      }
    }

    const sql = `
      INSERT INTO characters (
        name, first_name, last_name, nickname, gender,
        class, subclass, race, subrace, background,
        level, current_hp, max_hp, current_location, current_quest,
        gold_cp, gold_sp, gold_gp, starting_gold_cp, starting_gold_sp, starting_gold_gp,
        experience, experience_to_next_level,
        armor_class, speed, ability_scores, skills, advantages, inventory,
        faction_standings, injuries, debuffs, equipment,
        avatar, alignment, faith, lifestyle,
        hair_color, skin_color, eye_color, height, weight, age,
        personality_traits, ideals, bonds, flaws,
        organizations, allies, enemies, backstory, other_notes, physical_build,
        known_cantrips, known_spells, prepared_spells, feats, languages, tool_proficiencies,
        keeper_texts, keeper_recitations, keeper_genre_domain,
        creation_phase, campaign_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await dbRun(sql, [
      name, first_name, last_name, nickname, gender,
      charClass, subclass, storedRace, storedSubrace, background,
      level, current_hp, max_hp, current_location, current_quest,
      gold_cp, gold_sp, gold_gp, gold_cp, gold_sp, gold_gp, // Store starting gold same as initial gold
      experience, experience_to_next_level,
      armor_class, storedSpeed, ability_scores, skills, advantages, inventory,
      faction_standings, injuries, debuffs, equipment,
      avatar, alignment, faith, lifestyle,
      hair_color, skin_color, eye_color, height, weight, age,
      personality_traits, ideals, bonds, flaws,
      organizations, allies, enemies, backstory, other_notes, physical_build,
      known_cantrips, known_spells, prepared_spells, feats, languages, tool_proficiencies,
      keeper_texts, keeper_recitations, keeper_genre_domain,
      creation_phase, campaign_id
    ]);

    const characterId = result.lastInsertRowid;

    // World ID (item 3, Tier 0): best-effort at creation; ensureWorldId
    // at combat load repairs any row this misses.
    try { await assignWorldId('characters', characterId); } catch (e) { console.error('[character] world ID assignment failed:', e.message); }

    // Persist progression selections. Guards are defensive against non-wizard
    // code paths that may create characters without these fields (e.g., tests,
    // imports, or internal seed utilities).
    if (theme_id) {
      await persistThemeSelection(characterId, theme_id, theme_path_choice, level, req.body.theme_path_data ?? req.body.themePathData);
    }
    if (ancestry_feat_id) {
      await persistAncestryFeatSelection(characterId, ancestry_feat_id, 1, level, ancestry_feat_choices);
    }
    // Creator-next Stage 3 — grant the theme's fixed origin feat.
    // The feat key is canonicalized through the registry (name or
    // key in, key out); choices ride along as choices_json.
    const originFeatRaw = origin_feat ?? req.body.originFeat ?? null;
    if (originFeatRaw) {
      const originFeatChoices = origin_feat_choices ?? req.body.originFeatChoices ?? null;
      await persistOriginFeatSelection(characterId, canonicalOriginFeatKey(originFeatRaw), originFeatChoices, level);
    }
    // Human Versatile (item 19): the standalone pick persists in
    // the same table under slot 'versatile' (migration 109) — it
    // coexists with the theme row, it never replaces it.
    if (typeof versatileFeatRawPost === 'string' && versatileFeatRawPost.trim()) {
      const versatileChoices = versatile_feat_choices ?? req.body.versatileFeatChoices ?? null;
      await persistOriginFeatSelection(characterId, canonicalOriginFeatKey(versatileFeatRawPost), versatileChoices, level, 'versatile');
    }

    // Creator-next Stage 1 (migration 105) — persist origin facts when
    // supplied. Only provided fields are written, so partial-save POSTs
    // that have not reached Stage 1 leave existing values alone.
    const originUpdates = [];
    const originValues = [];
    if (origin_setting != null) { originUpdates.push('origin_setting = ?'); originValues.push(origin_setting); }
    if (origin_region != null) { originUpdates.push('origin_region = ?'); originValues.push(origin_region); }
    if (origin_explanation != null) { originUpdates.push('origin_explanation = ?'); originValues.push(origin_explanation); }
    if (subclass_origin_explanation != null) { originUpdates.push('subclass_origin_explanation = ?'); originValues.push(subclass_origin_explanation); }
    if (originUpdates.length > 0) {
      await dbRun(`UPDATE characters SET ${originUpdates.join(', ')} WHERE id = ?`, [...originValues, characterId]);
    }

    // Mixed Ancestry (2026-11-06, migration 108): persist the
    // validated record (normalized: canonical ids/names, effective
    // costs, defaults applied). A partial draft persists as sent —
    // the validator already refused anything malformed.
    if (mixedRaw != null && mixed.normalized) {
      await dbRun('UPDATE characters SET mixed_ancestry_json = ? WHERE id = ?', [JSON.stringify(mixed.normalized), characterId]);
    }

    // Size choice (2024 PHB p. 194, migration 110): rides the
    // post-insert UPDATE (like the origin fields). NULL when no
    // choice was sent (draft) or the mixed record carries none.
    if (storedSize != null) {
      await dbRun('UPDATE characters SET size = ? WHERE id = ?', [storedSize, characterId]);
    }

    // Fighting style + subclass choices (Stage 6 follow-up, joint
    // run 2026-11-07): the client sends both in the draft body, but
    // POST never persisted them — a draft POST carrying a style came
    // back null and only the first PUT stored it (pinned by
    // creator-next-stage6 (h4)). They ride the post-insert UPDATE
    // like the origin/size fields: the INSERT column list is
    // parallel to its values list, so new columns ride the UPDATE
    // rather than a placeholder-count-sensitive INSERT edit.
    // Draft-tolerant like the PUT: the style stores trimmed as sent
    // (no membership check here — the commit validator refuses
    // unknown names); subclass choices normalize through
    // parseSubclassChoices exactly like the PUT/commit write paths.
    // Absent / empty sends nothing, so the columns stay NULL.
    const fightingStyleRaw = req.body.fighting_style ?? req.body.fightingStyle ?? null;
    if (typeof fightingStyleRaw === 'string' && fightingStyleRaw.trim()) {
      await dbRun('UPDATE characters SET fighting_style = ? WHERE id = ?', [fightingStyleRaw.trim(), characterId]);
    }
    const subclassChoicesRaw = req.body.subclass_choices ?? req.body.subclassChoices ?? req.body.subclass_choices_json ?? null;
    if (subclassChoicesRaw != null) {
      const parsedPostChoices = parseSubclassChoices(subclassChoicesRaw);
      if (parsedPostChoices && Object.keys(parsedPostChoices).length > 0) {
        await dbRun('UPDATE characters SET subclass_choices_json = ? WHERE id = ?', [JSON.stringify(parsedPostChoices), characterId]);
      }
    }

    // Warlock pact (item 11, migration 113): rides the post-insert
    // UPDATE like the fields above. Marker bodies already passed the
    // Stage 2 pact check (membership + warlock levels); non-marker
    // callers get the same check here, so an invalid value is never
    // stored — it is skipped, never written raw (the CHECK constraint
    // would 500 on a bad value). Absent sends nothing, so the column
    // stays NULL.
    const pactKey = typeof pact === 'string' ? normWarlockPact(pact) : null;
    if (pactKey && hasWarlockLevels(charClass, req.body.class_levels ?? req.body.classLevels ?? null)) {
      await dbRun('UPDATE characters SET pact = ? WHERE id = ?', [pactKey, characterId]);
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    res.status(201).json(character);
  } catch (error) {
    handleServerError(res, error, 'create character');
  }
});

/**
 * Persist a theme selection for a newly-created character.
 * Inserts into character_themes + character_theme_unlocks (L1 ability).
 * Also initializes knight_moral_paths if theme is knight_of_the_order.
 */
async function persistThemeSelection(characterId, themeId, pathChoice, level, pathData) {
  // path_data (R2-11(e)): the soldier's second field (active-duty
  // status) as JSON, e.g. { active_duty: 'active' }. The parameter
  // is tri-state: undefined = the caller carries no second field —
  // preserve whatever is stored when the theme is unchanged, clear
  // it when the theme changed (the old theme's second field does
  // not carry over); null = explicitly clear; an object or JSON
  // string = store it. INSERT OR REPLACE rewrites the whole row,
  // so without the pre-read a same-theme re-save would wipe a
  // stored second field the caller did not re-send.
  let effectivePathData = pathData;
  if (pathData === undefined) {
    try {
      const existing = await dbGet('SELECT theme_id, path_data FROM character_themes WHERE character_id = ?', [characterId]);
      effectivePathData = existing && existing.theme_id === themeId ? existing.path_data ?? null : null;
    } catch { effectivePathData = null; }
  }
  const pathDataJson = effectivePathData == null
    ? null
    : (typeof effectivePathData === 'string' ? effectivePathData : JSON.stringify(effectivePathData));
  // Upsert character_themes
  await dbRun(
    `INSERT OR REPLACE INTO character_themes (character_id, theme_id, path_choice, path_data)
     VALUES (?, ?, ?, ?)`,
    [characterId, themeId, pathChoice, pathDataJson]
  );

  // Grant the L1 theme ability automatically (no choice for L1 — it IS the
  // existing Background feature; higher tiers have choices but L1 does not)
  const l1Ability = await dbGet(
    `SELECT id FROM theme_abilities WHERE theme_id = ? AND tier = 1 LIMIT 1`,
    [themeId]
  );
  if (l1Ability) {
    await dbRun(
      `INSERT OR REPLACE INTO character_theme_unlocks
       (character_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
       VALUES (?, ?, 1, ?, ?, ?)`,
      [characterId, themeId, l1Ability.id, level || 1, 'Granted at character creation.']
    );
  }

  // Initialize Knight moral path tracker if applicable
  if (themeId === 'knight_of_the_order') {
    await dbRun(
      `INSERT OR REPLACE INTO knight_moral_paths (character_id, current_path)
       VALUES (?, 'true')`,
      [characterId]
    );
  }
}

/**
 * Persist an L1 ancestry feat selection for a newly-created character.
 * `choicesData` is an optional object of player-resolved sub-choices
 * (e.g. { skill: 'perception', language: 'dwarvish' }) matching the
 * feat's `choices` schema.
 */
async function persistAncestryFeatSelection(characterId, featId, tier, selectedAtLevel, choicesData) {
  const choicesJson = choicesData && typeof choicesData === 'object'
    ? JSON.stringify(choicesData)
    : null;
  await dbRun(
    `INSERT OR REPLACE INTO character_ancestry_feats
     (character_id, feat_id, tier, selected_at_level, narrative_delivery, choices_data)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [characterId, featId, tier, selectedAtLevel || 1, 'Chosen at character creation.', choicesJson]
  );
}

/**
 * Persist a Stage 3 origin feat grant for a character. Mirrors
 * persistAncestryFeatSelection: one row per character
 * (UNIQUE(character_id)), INSERT OR REPLACE so a re-pick overwrites
 * the earlier grant. `choicesData` is the player's sub-choices for
 * feats that need picks (Magic Initiate spell list/ability/spells,
 * Musician instruments, Skilled skills/tools, Crafter tools).
 * The theme's ASI is deliberately NOT written here — it resolves
 * from themes.js via the stored theme at Stage 4.
 * `slot` is the origin-feat slot (migration 109): 'theme' for the
 * theme's fixed feat, 'versatile' for the human Versatile pick.
 * Defaults to 'theme'; the two slots coexist (UNIQUE is on
 * (character_id, slot)), and re-picking a slot replaces that slot's
 * row only.
 */
async function persistOriginFeatSelection(characterId, featKey, choicesData, selectedAtLevel, slot = 'theme') {
  const choicesJson = choicesData && typeof choicesData === 'object'
    ? JSON.stringify(choicesData)
    : null;
  await dbRun(
    `INSERT OR REPLACE INTO character_origin_feats
     (character_id, feat_key, choices_json, selected_at_level, slot)
     VALUES (?, ?, ?, ?, ?)`,
    [characterId, featKey, choicesJson, selectedAtLevel || 1, slot]
  );
}

// Update character
router.put('/:id', async (req, res) => {
  try {
    // Mixed Ancestry (2026-11-06): validated whenever the body
    // carries it, any caller (same rule as POST — it derives the
    // stored race string and speed). The stored record is read
    // best-effort so a PUT that omits mixed_ancestry still judges
    // the trade + ancestry-list checks against the record on file
    // (a resumed creator re-sending only its theme feat). A body
    // value, when present, wins over the stored record; an explicit
    // null clears it.
    let storedMixed = null;
    let storedRow = null;
    let storedThemeFeatKey = null;
    try {
      storedRow = await dbGet('SELECT race, subrace, mixed_ancestry_json, size, class, subclass, class_levels FROM characters WHERE id = ?', [req.params.id]);
      storedMixed = parseMixedAncestry(storedRow?.mixed_ancestry_json ?? null);
    } catch { /* pre-migration column: no stored record */ }
    // Stored theme feat (item 19): a resumed PUT re-sending only
    // the versatile pick still gets the different-feats check
    // against the theme feat on file (Stage 3 ctx below).
    try {
      const storedThemeRow = await dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [req.params.id]);
      storedThemeFeatKey = storedThemeRow?.feat_key ?? null;
    } catch { /* pre-migration table: no stored theme feat */ }
    const mixedBodyPresent = req.body.mixed_ancestry !== undefined || req.body.mixedAncestry !== undefined;
    const mixedRawPut = mixedBodyPresent ? (req.body.mixed_ancestry ?? req.body.mixedAncestry ?? null) : undefined;
    const mixedPut = validateMixedAncestry(mixedRawPut);
    if (!mixedPut.ok) return validationError(res, mixedPut.errors.join('; '));
    const effectiveMixed = mixedBodyPresent ? mixedPut.normalized : storedMixed;
    const mixedCompletePut = mixedBodyPresent && !!(mixedPut.normalized && mixedPut.normalized.parents.length === 2);

    // Creator-next Stage 2 validation (2026-11-05): only for bodies
    // carrying the creator-next marker. Fail-fast, before the
    // phase-transition reads and the generic UPDATE below. The stored
    // row rides along as ctx so a PUT re-sending only the pact (no
    // class in the body) still judges the warlock check against the
    // class on file.
    if (req.body.creator === 'creator-next') {
      const stage2 = validateCreatorNextStage2(req.body, { row: storedRow });
      if (!stage2.ok) return validationError(res, stage2.errors.join('; '));
      const stage3 = validateCreatorNextStage3(req.body, { mixedAncestry: effectiveMixed, row: storedRow, themeOriginFeatKey: storedThemeFeatKey });
      if (!stage3.ok) return validationError(res, stage3.errors.join('; '));
      // Stage 4 needs the stored row for anything the PUT body
      // omits (class, race, theme, final scores, granted Magic
      // Initiate spell); the read is best-effort and never blocks
      // validation on a missing row or table.
      const stage4Ctx = await readCreatorNextStage4Context(req.params.id);
      const stage4 = validateCreatorNextStage4(req.body, stage4Ctx);
      if (!stage4.ok) return validationError(res, stage4.errors.join('; '));
      const stage5 = validateCreatorNextStage5(req.body, stage4Ctx);
      if (!stage5.ok) return validationError(res, stage5.errors.join('; '));
      // Stage 5 derivation (2026-11-07): same rules as POST, applied
      // by writing the derived values back into req.body so the
      // generic UPDATE below persists them. HP only when the stored
      // max_hp is 0 (deriveCreatorNextStage5 reads it from ctx.row);
      // AC only from a resolved package (a gold fork leaves a stored
      // package's AC alone); speed never overrides a complete
      // mixed-ancestry record (that record owns speed).
      const stage5DerivedPut = deriveCreatorNextStage5(req.body, stage4Ctx, { isPost: false });
      if (stage5DerivedPut.maxHp != null) { req.body.max_hp = stage5DerivedPut.maxHp; req.body.current_hp = stage5DerivedPut.currentHp; }
      if (stage5DerivedPut.armorClass != null) req.body.armor_class = stage5DerivedPut.armorClass;
      if (stage5DerivedPut.speed != null && !mixedCompletePut) req.body.speed = stage5DerivedPut.speed;
      if (stage5DerivedPut.goldGp != null) { req.body.gold_gp = stage5DerivedPut.goldGp; req.body.starting_gold_gp = stage5DerivedPut.goldGp; }
      if (stage5DerivedPut.inventory != null) req.body.inventory = stage5DerivedPut.inventory;
      if (stage5DerivedPut.equipment != null) req.body.equipment = stage5DerivedPut.equipment;
      // Item 20 (store): validation accepts snake_case, but the row
      // must hold the display form — see stage4CanonicalListJson.
      // Rewriting req.body here means the generic UPDATE below
      // persists the canonical form. (Expertise is not in the PUT
      // allowlist — it persists via the commit apply, canonicalized
      // there — so it is not rewritten here.)
      for (const [field, known] of [['skills', STAGE4_SKILLS], ['languages', STAGE4_LANGUAGES], ['tool_proficiencies', STAGE4_TOOLS]]) {
        if (req.body[field] !== undefined && req.body[field] !== null) {
          const canon = stage4CanonicalListJson(req.body[field], known);
          if (canon != null) req.body[field] = canon;
        }
      }
    }

    // MVP player-species scope (Zach, 2026-11-05; PUT guard
    // 2026-11-06, item 5): mirror of the POST guard — a race
    // change to one of the 18 deferred species is refused with the
    // species named, before the generic UPDATE below. Unknown
    // species stay allowed (v1 rule); only known deferred species
    // refuse. Runs on every PUT that sends a race, marker or not.
    // Skipped when the PUT carries a complete mixed-ancestry record
    // (2026-11-06): the parents were PC-creatable-checked by the
    // validator above, and the stored race derives from them.
    if (!mixedCompletePut && req.body.race && !isPcCreatable(req.body.race, req.body.subrace ?? null)) {
      const displayName = resolveSpecies(req.body.race, req.body.subrace ?? null)?.entry?.name || req.body.race;
      return res.status(400).json({ error: `Species ${displayName} is not available for player characters yet — ${MVP_DEFERRED_NOTE}` });
    }

    // MVP player-class scope (Zach, 2026-11-08): mirror of the POST
    // guard — a class change to a deferred class, a subclass change
    // to a deferred subclass, or a class_levels entry carrying
    // either is refused with the class/subclass named, before the
    // generic UPDATE below. Runs on every PUT that sends a class,
    // subclass, or class_levels, marker or not. The subclass check
    // judges the RESULTING pair (body value ?? stored row), so a
    // class change onto a row that already holds a deferred
    // subclass is caught too. Unknown classes/subclasses pass
    // through (v1 rule); only known deferred picks refuse.
    if (req.body.class !== undefined || req.body.subclass !== undefined || req.body.class_levels !== undefined) {
      const putClassRefusal = req.body.class !== undefined ? classScopeRefusal(req.body.class) : null;
      if (putClassRefusal) {
        return res.status(400).json({ error: putClassRefusal });
      }
      const resultingClass = req.body.class ?? storedRow?.class ?? null;
      const resultingSubclass = req.body.subclass ?? storedRow?.subclass ?? null;
      const putSubclassRefusal = subclassScopeRefusal(resultingClass, resultingSubclass);
      if (putSubclassRefusal) {
        return res.status(400).json({ error: putSubclassRefusal });
      }
      const putLevelsRefusal = classLevelsScopeRefusal(req.body.class_levels);
      if (putLevelsRefusal) {
        return res.status(400).json({ error: putLevelsRefusal });
      }
    }

    // Ancestry-feat sub-choices (2026-11-06, item 2): same
    // validation as POST, for PUTs that carry a feat pick + choices.
    if ((req.body.ancestry_feat_id ?? req.body.ancestryFeatId) != null
      && (req.body.ancestry_feat_choices ?? req.body.ancestryFeatChoices) != null) {
      const ancestryCheck = await validateAncestryFeatChoices(
        req.body.ancestry_feat_id ?? req.body.ancestryFeatId,
        req.body.ancestry_feat_choices ?? req.body.ancestryFeatChoices
      );
      if (!ancestryCheck.ok) return validationError(res, ancestryCheck.errors.join('; '));
    }

    // Mixed Ancestry ancestry-feat list (2026-11-06): a mixed
    // character's ancestry feat must come from either parent's list.
    // Judged against the effective record (body, else stored).
    if (effectiveMixed && effectiveMixed.parents && effectiveMixed.parents.length === 2
      && (req.body.ancestry_feat_id ?? req.body.ancestryFeatId) != null) {
      const listError = await checkMixedAncestryFeatList(
        effectiveMixed.parents, req.body.ancestry_feat_id ?? req.body.ancestryFeatId
      );
      if (listError) return validationError(res, listError);
    }

    // Forgo trade, any caller (2026-11-06): the trade and a theme
    // origin-feat grant cannot coexist. Marker bodies hit the same
    // refusal inside validateCreatorNextStage3 above; this is the
    // backstop for non-marker callers, same message.
    if (effectiveMixed?.forgoOriginFeat && (req.body.origin_feat ?? req.body.originFeat)) {
      return validationError(res, MIXED_ANCESTRY_FORGO_ORIGIN_FEAT_MESSAGE);
    }

    // Human Versatile (item 19, 2026-11-06): route-level gates for
    // non-marker callers — marker bodies already passed Stage 3
    // above (same rules, same messages). Human only (body race, else
    // the stored race); a 2024 origin feat; different from the theme
    // feat (body, else the stored theme feat).
    const versatileFeatRawPut = req.body.versatile_feat ?? req.body.versatileFeat ?? null;
    if (typeof versatileFeatRawPut === 'string' && versatileFeatRawPut.trim()) {
      const putRace = req.body.race ?? storedRow?.race ?? null;
      const putSubrace = req.body.subrace ?? storedRow?.subrace ?? null;
      if (versatileHumanStatus(putRace, putSubrace) === false) {
        return validationError(res, `versatileFeat: '${versatileFeatRawPut.trim()}' is only available to human characters (2024 Versatile)`);
      }
      const vEntryPut = getFeatEffect(versatileFeatRawPut.trim());
      if (!vEntryPut || vEntryPut.category !== 'origin') {
        return validationError(res, `versatileFeat: '${versatileFeatRawPut.trim()}' is not a 2024 origin feat`);
      }
      const themeFeatPut = req.body.origin_feat ?? req.body.originFeat ?? storedThemeFeatKey ?? null;
      if (themeFeatPut && normFeatKey(vEntryPut.key) === normFeatKey(canonicalOriginFeatKey(themeFeatPut))) {
        return validationError(res, `versatileFeat: '${versatileFeatRawPut.trim()}' is already the theme's origin feat (${vEntryPut.name}) — the Versatile feat must be a different origin feat`);
      }
    }

    // Size choice (2024 PHB p. 194, migration 110): a PUT that sends
    // a size validates it against the resulting species (body race /
    // subrace, else stored). A complete mixed record owns size (the
    // derivation below writes it), so a body size there is ignored.
    // A PUT that changes species without sending a size clears a
    // stored size the new species cannot have (putSizeReset, applied
    // after the generic UPDATE below) instead of leaving a stale
    // claim on the row.
    const putRaceForSize = mixedCompletePut ? null : (req.body.race ?? storedRow?.race ?? null);
    const putSubraceForSize = mixedCompletePut ? null : (req.body.subrace ?? storedRow?.subrace ?? null);
    let putSizeCanonical = null;
    let putSizeSent = false;
    let putSizeReset = false;
    if (!mixedCompletePut && req.body.size !== undefined && req.body.size !== null && String(req.body.size).trim() !== '') {
      putSizeSent = true;
      const sizeCheck = validateSizeChoice(putRaceForSize, putSubraceForSize, req.body.size);
      if (!sizeCheck.ok) return validationError(res, sizeCheck.errors.join('; '));
      putSizeCanonical = sizeCheck.size;
    }
    if (!mixedCompletePut && !putSizeSent && (req.body.race !== undefined || req.body.subrace !== undefined)) {
      const storedSize = storedRow?.size ?? null;
      if (typeof storedSize === 'string' && storedSize.trim()) {
        const newAllowed = allowedSizesFor(putRaceForSize, putSubraceForSize);
        if (newAllowed && !newAllowed.some((s) => s.toLowerCase() === storedSize.trim().toLowerCase())) {
          putSizeReset = true;
        }
      }
    }

    // Warlock pact (item 11, migration 113): a PUT that changes the
    // class (or class_levels) away from warlock clears a stored pact
    // (putPactReset, applied after the generic UPDATE below) instead
    // of leaving a stale claim on the row — same pattern as the size
    // reset above. Only a class change can do this: a PUT that
    // carries only a pact re-picks it (see the allowlist block), and
    // a PUT that touches neither leaves the stored pact standing.
    let putPactReset = false;
    if (req.body.class !== undefined || req.body.class_levels !== undefined || req.body.classLevels !== undefined) {
      const resultingCls = req.body.class ?? storedRow?.class ?? null;
      const resultingLevels = req.body.class_levels ?? req.body.classLevels ?? storedRow?.class_levels ?? null;
      if (!hasWarlockLevels(resultingCls, resultingLevels)) {
        putPactReset = true;
      }
    }

    // Artificer prepared-spell cap (2026-11-06): validatePreparedSpells
    // (2024: Int mod + half artificer level, min 1) was enforced only at
    // creation (Stage 4) — the character sheet's savePreparedSpells PUTs
    // a bare { prepared_spells } with no creator marker, so an over-cap
    // list sailed through the generic UPDATE below. Enforce it here for
    // primary-artificer characters only. Marker bodies already went
    // through the Stage 4 validator above (no double validation);
    // non-artificers skip entirely, and artificer-as-secondary
    // multiclass skips — the shared prepared_spells column is governed
    // by the primary class's editor. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const artRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const resultingClass = String(req.body.class ?? artRow?.class ?? '').toLowerCase();
      if (artRow && resultingClass === 'artificer') {
        const artLevels = safeParse(artRow.class_levels, null);
        const artEntry = Array.isArray(artLevels)
          ? artLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'artificer')
          : null;
        const artLevel = Number(artEntry?.level) || Number(artRow.level) || 1;
        const artSubclass = artEntry?.subclass ?? artRow.subclass ?? null;
        const rawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : artRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const scores = typeof rawScores === 'string' ? safeParse(rawScores, {}) : (rawScores || {});
        const intScore = Number(scores?.int ?? scores?.intelligence ?? 10);
        const intMod = Math.floor(((Number.isFinite(intScore) ? intScore : 10) - 10) / 2);
        const alwaysPrepared = artificerSubclassSpellsAtLevel('artificer', artSubclass, artLevel);
        const incoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!incoming || incoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const check = validatePreparedSpells(artLevel, incoming, alwaysPrepared, intMod);
        if (!check.ok) {
          return validationError(res, `preparedSpells: artificer may prepare at most ${check.max} spells at artificer level ${artLevel} (Int mod ${intMod}), got ${check.counted}`);
        }
      }
    }

    // Blackguard prepared-spell cap (2026-11-06): mirrors the artificer block
    // above exactly. blackguardService.validatePreparedSpells had NO live
    // callers, only tests. Same gates: no creator marker (marker bodies went
    // through the Stage 4 validator), prepared_spells present, primary
    // blackguard only; blackguard-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's editor.
    // NOTE the arg order differs from the artificer validator: blackguard is
    // (chaMod, level, preparedList, alwaysPreparedList), chaMod FIRST.
    // L1 prepares 0 (no 1st-level slots — preparedSpellsMax is slot-gated,
    // agreeing with getSpellsPrepared). Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const bgRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const bgResultingClass = String(req.body.class ?? bgRow?.class ?? '').toLowerCase();
      if (bgRow && bgResultingClass === 'blackguard') {
        const bgLevels = safeParse(bgRow.class_levels, null);
        const bgEntry = Array.isArray(bgLevels)
          ? bgLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'blackguard')
          : null;
        const bgLevel = Number(bgEntry?.level) || Number(bgRow.level) || 1;
        const bgSubclass = bgEntry?.subclass ?? bgRow.subclass ?? null;
        const bgRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : bgRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const bgScores = typeof bgRawScores === 'string' ? safeParse(bgRawScores, {}) : (bgRawScores || {});
        const chaScore = Number(bgScores?.cha ?? bgScores?.charisma ?? 10);
        const chaMod = Math.floor(((Number.isFinite(chaScore) ? chaScore : 10) - 10) / 2);
        const vicePrepared = blackguardViceSpellsAtLevel('blackguard', bgSubclass, bgLevel);
        const bgIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!bgIncoming || bgIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const bgCheck = validateBlackguardPreparedSpells(chaMod, bgLevel, bgIncoming, vicePrepared);
        if (!bgCheck.ok) {
          return validationError(res, `preparedSpells: blackguard may prepare at most ${bgCheck.max} spells at blackguard level ${bgLevel} (Cha mod ${chaMod}), got ${bgCheck.counted}`);
        }
      }
    }

    // Paladin prepared-spell cap (2026-11-06, item 26; PHB
    // correction 2026-11-07): mirrors the artificer/blackguard
    // blocks above exactly. Same gates: no creator marker (marker
    // bodies went through the Stage 4 validator), prepared_spells
    // present, primary paladin only; paladin-as-secondary
    // multiclass skips — the shared prepared_spells column is
    // governed by the primary class's editor. The cap is the 2024
    // PHB Prepared Spells column (PALADIN_SPELLS_PREPARED: 2 at
    // L1, 6 at L5) — the book states no formula, and a 2024 L1
    // paladin HAS two 1st-level slots, so there is no L1 -> 0
    // slot gate. Oath spells are always prepared and excluded via
    // paladinOathSpellsAtLevel. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const palRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const palResultingClass = String(req.body.class ?? palRow?.class ?? '').toLowerCase();
      if (palRow && palResultingClass === 'paladin') {
        const palLevels = safeParse(palRow.class_levels, null);
        const palEntry = Array.isArray(palLevels)
          ? palLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'paladin')
          : null;
        const palLevel = Number(palEntry?.level) || Number(palRow.level) || 1;
        const palSubclass = palEntry?.subclass ?? palRow.subclass ?? null;
        const palRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : palRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const palScores = typeof palRawScores === 'string' ? safeParse(palRawScores, {}) : (palRawScores || {});
        const palChaScore = Number(palScores?.cha ?? palScores?.charisma ?? 10);
        const palChaMod = Math.floor(((Number.isFinite(palChaScore) ? palChaScore : 10) - 10) / 2);
        const oathPrepared = paladinOathSpellsAtLevel('paladin', palSubclass, palLevel);
        const palIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!palIncoming || palIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const palCheck = validatePaladinPreparedSpells(palChaMod, palLevel, palIncoming, oathPrepared);
        if (!palCheck.ok) {
          return validationError(res, `preparedSpells: paladin may prepare at most ${palCheck.max} spells at paladin level ${palLevel} (Cha mod ${palChaMod}), got ${palCheck.counted}`);
        }
      }
    }

    // Sorcerer prepared-spell cap (2026-11-06): mirrors the
    // artificer/blackguard/paladin blocks above exactly. Same gates: no
    // creator marker (marker bodies went through the Stage 4
    // validator), prepared_spells present, primary sorcerer only;
    // sorcerer-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's
    // editor. The cap is the 2024 PHB fixed Prepared Spells column
    // (2 at 1st -> 22 at 20th) — the book states no formula, so NO
    // Cha mod is read here and sorcererService takes no mod.
    // Subclass spells are always prepared and excluded via
    // sorcererSubclassSpellsAtLevel. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const sorcRow = await dbGet(
        'SELECT class, subclass, level, class_levels FROM characters WHERE id = ?',
        [req.params.id]
      );
      const sorcResultingClass = String(req.body.class ?? sorcRow?.class ?? '').toLowerCase();
      if (sorcRow && sorcResultingClass === 'sorcerer') {
        const sorcLevels = safeParse(sorcRow.class_levels, null);
        const sorcEntry = Array.isArray(sorcLevels)
          ? sorcLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'sorcerer')
          : null;
        const sorcLevel = Number(sorcEntry?.level) || Number(sorcRow.level) || 1;
        const sorcSubclass = sorcEntry?.subclass ?? sorcRow.subclass ?? null;
        const sorcAlwaysPrepared = sorcererSubclassSpellsAtLevel('sorcerer', sorcSubclass, sorcLevel);
        const sorcIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!sorcIncoming || sorcIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const sorcCheck = validateSorcererPreparedSpells(sorcLevel, sorcIncoming, sorcAlwaysPrepared);
        if (!sorcCheck.ok) {
          return validationError(res, `preparedSpells: sorcerer may prepare at most ${sorcCheck.max} spells at sorcerer level ${sorcLevel}, got ${sorcCheck.counted}`);
        }
      }
    }

    // Ranger prepared-spell cap (2026-11-06, PHB photos pp. 119-120):
    // mirrors the paladin block above exactly. Same gates: no
    // creator marker (marker bodies went through the Stage 4
    // validator), prepared_spells present, primary ranger only;
    // ranger-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's
    // editor. Table-driven cap (2 at L1 — ranger HAS 1st-level
    // slots, unlike paladin), Wis mod does not change it.
    // Hunter's Mark + subclass spells are always prepared and
    // excluded via rangerAlwaysPreparedSpells. Never trims, never
    // silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const rngRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const rngResultingClass = String(req.body.class ?? rngRow?.class ?? '').toLowerCase();
      if (rngRow && rngResultingClass === 'ranger') {
        const rngLevels = safeParse(rngRow.class_levels, null);
        const rngEntry = Array.isArray(rngLevels)
          ? rngLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'ranger')
          : null;
        const rngLevel = Number(rngEntry?.level) || Number(rngRow.level) || 1;
        const rngSubclass = rngEntry?.subclass ?? rngRow.subclass ?? null;
        const rngRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : rngRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const rngScores = typeof rngRawScores === 'string' ? safeParse(rngRawScores, {}) : (rngRawScores || {});
        const rngWisScore = Number(rngScores?.wis ?? rngScores?.wisdom ?? 10);
        const rngWisMod = Math.floor(((Number.isFinite(rngWisScore) ? rngWisScore : 10) - 10) / 2);
        const rngAlways = rangerAlwaysPreparedSpells(rngSubclass, rngLevel);
        const rngIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!rngIncoming || rngIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const rngCheck = validateRangerPreparedSpells(rngWisMod, rngLevel, rngIncoming, rngAlways);
        if (!rngCheck.ok) {
          return validationError(res, `preparedSpells: ranger may prepare at most ${rngCheck.max} spells at ranger level ${rngLevel} (Wis mod ${rngWisMod}), got ${rngCheck.counted}`);
        }
      }
    }

    // Bard prepared-spell cap (2026-11-06): mirrors the
    // artificer/blackguard/paladin/sorcerer/ranger blocks above exactly.
    // Same gates: no creator marker (marker bodies went through the
    // Stage 4 validator), prepared_spells present, primary bard only;
    // bard-as-secondary multiclass skips — the shared prepared_spells
    // column is governed by the primary class's editor. The cap is the
    // 2024 PHB formula — Cha mod + bard level, min 1 (L1 = 4 at Cha +3).
    // College of the Moon's Moonbeam (Blessing of Moonlight, L6) is
    // always prepared and excluded via bardSubclassSpellsAtLevel;
    // Magical Secrets picks are prepared spells and DO count. Never
    // trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const bardRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const bardResultingClass = String(req.body.class ?? bardRow?.class ?? '').toLowerCase();
      if (bardRow && bardResultingClass === 'bard') {
        const bardLevels = safeParse(bardRow.class_levels, null);
        const bardEntry = Array.isArray(bardLevels)
          ? bardLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'bard')
          : null;
        const bardLevel = Number(bardEntry?.level) || Number(bardRow.level) || 1;
        const bardSubclass = bardEntry?.subclass ?? bardRow.subclass ?? null;
        const bardRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : bardRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const bardScores = typeof bardRawScores === 'string' ? safeParse(bardRawScores, {}) : (bardRawScores || {});
        const bardChaScore = Number(bardScores?.cha ?? bardScores?.charisma ?? 10);
        const bardChaMod = Math.floor(((Number.isFinite(bardChaScore) ? bardChaScore : 10) - 10) / 2);
        const bardAlways = bardSubclassSpellsAtLevel('bard', bardSubclass, bardLevel);
        const bardIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!bardIncoming || bardIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const bardCheck = validateBardPreparedSpells(bardChaMod, bardLevel, bardIncoming, bardAlways);
        if (!bardCheck.ok) {
          return validationError(res, `preparedSpells: bard may prepare at most ${bardCheck.max} spells at bard level ${bardLevel} (Cha mod ${bardChaMod}), got ${bardCheck.counted}`);
        }
      }
    }

    // Eldritch Knight prepared-spell cap (2026-11-07): mirrors the
    // sorcerer block above exactly (table-driven, no ability scores
    // needed — the 2024 PHB fixed Prepared Spells column governs, 3
    // at 3rd -> 13 at 20th). Same gates: no creator marker (marker
    // bodies went through the Stage 4 validator), prepared_spells
    // present, primary fighter only AND Eldritch Knight subclass —
    // a non-EK fighter never casts, so it skips entirely (no cap
    // applies); fighter-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's
    // editor. EK has no always-prepared levelled spells
    // (eldritchKnightSpellsAtLevel returns []); the exclusion list
    // is empty and the cap is the whole job. Never trims, never
    // silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const ekRow = await dbGet(
        'SELECT class, subclass, level, class_levels FROM characters WHERE id = ?',
        [req.params.id]
      );
      const ekResultingClass = String(req.body.class ?? ekRow?.class ?? '').toLowerCase();
      if (ekRow && ekResultingClass === 'fighter') {
        const ekLevels = safeParse(ekRow.class_levels, null);
        const ekEntry = Array.isArray(ekLevels)
          ? ekLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'fighter')
          : null;
        const ekLevel = Number(ekEntry?.level) || Number(ekRow.level) || 1;
        const ekSubclass = ekEntry?.subclass ?? ekRow.subclass ?? null;
        if (String(ekSubclass ?? '').trim().toLowerCase() === 'eldritch knight') {
          const ekAlwaysPrepared = eldritchKnightSpellsAtLevel('fighter', ekSubclass, ekLevel);
          const ekIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
          if (!ekIncoming || ekIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
            return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
          }
          const ekCheck = validateThirdCasterPreparedSpells(ekLevel, ekIncoming, ekAlwaysPrepared);
          if (!ekCheck.ok) {
            return validationError(res, `preparedSpells: Eldritch Knight may prepare at most ${ekCheck.max} spells at fighter level ${ekLevel}, got ${ekCheck.counted}`);
          }
        }
      }
    }

    // Arcane Trickster prepared-spell cap (2026-11-07): mirrors the
    // Eldritch Knight block above exactly (table-driven, no ability
    // scores needed — the 2024 PHB fixed Prepared Spells column
    // governs, 3 at 3rd -> 13 at 20th). Same gates: no creator
    // marker, prepared_spells present, primary rogue only AND
    // Arcane Trickster subclass — a non-AT rogue never casts, so it
    // skips entirely; rogue-as-secondary multiclass skips. AT has no
    // always-prepared levelled spells (arcaneTricksterSpellsAtLevel
    // returns []); Mage Hand is a cantrip, not a prepared spell.
    // Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const atRow = await dbGet(
        'SELECT class, subclass, level, class_levels FROM characters WHERE id = ?',
        [req.params.id]
      );
      const atResultingClass = String(req.body.class ?? atRow?.class ?? '').toLowerCase();
      if (atRow && atResultingClass === 'rogue') {
        const atLevels = safeParse(atRow.class_levels, null);
        const atEntry = Array.isArray(atLevels)
          ? atLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'rogue')
          : null;
        const atLevel = Number(atEntry?.level) || Number(atRow.level) || 1;
        const atSubclass = atEntry?.subclass ?? atRow.subclass ?? null;
        if (String(atSubclass ?? '').trim().toLowerCase() === 'arcane trickster') {
          const atAlwaysPrepared = arcaneTricksterSpellsAtLevel('rogue', atSubclass, atLevel);
          const atIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
          if (!atIncoming || atIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
            return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
          }
          const atCheck = validateThirdCasterPreparedSpells(atLevel, atIncoming, atAlwaysPrepared);
          if (!atCheck.ok) {
            return validationError(res, `preparedSpells: Arcane Trickster may prepare at most ${atCheck.max} spells at rogue level ${atLevel}, got ${atCheck.counted}`);
          }
        }
      }
    }

    // Warlock prepared-spell cap (2026-11-07): mirrors the
    // artificer/blackguard/paladin/sorcerer/ranger/bard blocks above
    // exactly. Same gates: no creator marker (marker bodies went
    // through the Stage 4 validator), prepared_spells present,
    // primary warlock only; warlock-as-secondary multiclass skips —
    // the shared prepared_spells column is governed by the primary
    // class's editor. The cap is the 2024 PHB fixed Prepared Spells
    // column (WARLOCK_SPELLS_PREPARED: 2 at L1, 6 at L5, 15 at L20)
    // — the book states no formula, and the Cha mod is passed but
    // ignored by warlockService.preparedSpellsMax. Patron spells are
    // ADDED TO THE WARLOCK SPELL LIST, not always prepared, so there
    // is NO patron-spell exclusion here: a patron spell the player
    // prepares counts. Contact Other Plane (Contact Patron, L9+) is
    // always prepared and excluded via warlockAlwaysPreparedSpells;
    // Mystic Arcanum spells are excluded by catalog spell level
    // inside the validator (one per unlocked tier). Never trims,
    // never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const wlkRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const wlkResultingClass = String(req.body.class ?? wlkRow?.class ?? '').toLowerCase();
      if (wlkRow && wlkResultingClass === 'warlock') {
        const wlkLevels = safeParse(wlkRow.class_levels, null);
        const wlkEntry = Array.isArray(wlkLevels)
          ? wlkLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'warlock')
          : null;
        const wlkLevel = Number(wlkEntry?.level) || Number(wlkRow.level) || 1;
        const wlkRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : wlkRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const wlkScores = typeof wlkRawScores === 'string' ? safeParse(wlkRawScores, {}) : (wlkRawScores || {});
        const wlkChaScore = Number(wlkScores?.cha ?? wlkScores?.charisma ?? 10);
        const wlkChaMod = Math.floor(((Number.isFinite(wlkChaScore) ? wlkChaScore : 10) - 10) / 2);
        const wlkAlways = warlockAlwaysPreparedSpells(wlkLevel);
        const wlkIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!wlkIncoming || wlkIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const wlkCheck = validateWarlockPreparedSpells(wlkChaMod, wlkLevel, wlkIncoming, wlkAlways);
        if (!wlkCheck.ok) {
          return validationError(res, `preparedSpells: warlock may prepare at most ${wlkCheck.max} spells at warlock level ${wlkLevel} (Cha mod ${wlkChaMod}), got ${wlkCheck.counted}`);
        }
      }
    }

    // Profane Soul prepared-spell cap (2026-11-07): mirrors the
    // ranger block above exactly — except there is NO ability mod:
    // the cap is the fixed Profane Soul table (2 at 3rd -> 11 at
    // 20th, PROFANE_SOUL_SPELLS_PREPARED), and the validator takes
    // the level FIRST with no mod (like artificer/sorcerer — NOT
    // blackguard's chaMod-first order). Same gates: no creator
    // marker (marker bodies went through the Stage 4 validator),
    // prepared_spells present, primary blood_hunter AND the Order
    // of the Profane Soul only (other Orders never cast — checked
    // via levelProgression.isCastingSubclass); blood_hunter-as-
    // secondary multiclass skips — the shared prepared_spells
    // column is governed by the primary class's editor. Revealed
    // Arcana (7th) and Unsealed Arcana (15th) spells are always
    // prepared and excluded via profaneSoulArcanaSpellsAtLevel,
    // keyed by the stored patron choice (subclass_choices_json —
    // the PUT's allowedFields do not include it, so it is read
    // from the row, never the body). No stored patron -> no
    // exclusion. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const psRow = await dbGet(
        'SELECT class, subclass, level, class_levels, subclass_choices_json FROM characters WHERE id = ?',
        [req.params.id]
      );
      const psResultingClass = String(req.body.class ?? psRow?.class ?? '').toLowerCase();
      if (psRow && psResultingClass === 'blood_hunter') {
        const psLevels = safeParse(psRow.class_levels, null);
        const psEntry = Array.isArray(psLevels)
          ? psLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'blood_hunter')
          : null;
        const psLevel = Number(psEntry?.level) || Number(psRow.level) || 1;
        const psSubclass = psEntry?.subclass ?? psRow.subclass ?? null;
        if (isCastingSubclass('blood_hunter', psSubclass)) {
          const psChoices = parseSubclassChoices(psRow.subclass_choices_json);
          const psPatronRaw = psChoices?.patron ?? null;
          const psPatron = Array.isArray(psPatronRaw) ? psPatronRaw[0] ?? null : psPatronRaw;
          const psAlways = profaneSoulArcanaSpellsAtLevel('blood_hunter', psSubclass, psLevel, psPatron);
          const psIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
          if (!psIncoming || psIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
            return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
          }
          const psCheck = validateProfaneSoulPreparedSpells(psLevel, psIncoming, psAlways);
          if (!psCheck.ok) {
            return validationError(res, `preparedSpells: profane soul may prepare at most ${psCheck.max} spells at blood hunter level ${psLevel}, got ${psCheck.counted}`);
          }
        }
      }
    }

    // Wizard prepared-spell cap + spellbook membership (2026-11-07,
    // upgraded by the spellbook system): mirrors the bard block
    // above. Same gates: no creator marker (marker bodies went
    // through the Stage 4 validator), a spell list present, primary
    // wizard only; wizard-as-secondary multiclass skips — the
    // shared prepared_spells column is governed by the primary
    // class's editor. The cap is the 2024 PHB formula — Int mod +
    // wizard level, min 1 (L1 = 4 at Int +3, L5 = 9 at Int +4,
    // L20 = 25 at Int +5) — no fixed table is stored. The
    // always-prepared exclusion is now LIVE: Spell Mastery (L18) /
    // Signature Spells (L20) picks are read from spellbook_json and
    // do not count against the cap. Savant spells go INTO the
    // spellbook rather than being always prepared. Membership: every
    // prepared spell (minus the exclusions) must be in the book
    // (known_spells); a lost book refuses prepared changes outright
    // (the existing list stays castable). A bare PUT writing
    // known_spells is list/level-checked so a typo or a non-wizard
    // spell cannot enter the book outside the copy flow. Never
    // trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined
        || req.body.known_spells !== undefined || req.body.knownSpells !== undefined)
    ) {
      const wizRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores, known_spells, spellbook_json FROM characters WHERE id = ?',
        [req.params.id]
      );
      const wizResultingClass = String(req.body.class ?? wizRow?.class ?? '').toLowerCase();
      if (wizRow && wizResultingClass === 'wizard') {
        const wizLevels = safeParse(wizRow.class_levels, null);
        const wizEntry = Array.isArray(wizLevels)
          ? wizLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'wizard')
          : null;
        const wizLevel = Number(wizEntry?.level) || Number(wizRow.level) || 1;
        const wizRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : wizRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const wizScores = typeof wizRawScores === 'string' ? safeParse(wizRawScores, {}) : (wizRawScores || {});
        const wizIntScore = Number(wizScores?.int ?? wizScores?.intelligence ?? 10);
        const wizIntMod = Math.floor(((Number.isFinite(wizIntScore) ? wizIntScore : 10) - 10) / 2);
        const wizState = parseSpellbookState(wizRow.spellbook_json);
        const wizAlways = alwaysPreparedSpells(wizState, wizLevel);
        // Book-content guard: a bare PUT writing the book must only
        // carry wizard-list spells of a castable level, no dupes —
        // otherwise the free-text "+ Add to Spellbook" hole (a typo
        // or a non-wizard spell narrowing the prepare picker with no
        // error anywhere) stays open. Cost/time enforcement lives on
        // the copy route; this is list/level only.
        const wizKnownPresent = req.body.known_spells !== undefined || req.body.knownSpells !== undefined;
        const wizKnownIncoming = wizKnownPresent
          ? stage4ParseStringList(req.body.known_spells ?? req.body.knownSpells)
          : undefined;
        if (wizKnownPresent) {
          // Lost-book refusal (replacement build, 2026-11-07): the
          // prepared refusal below never fired for a bare PUT writing
          // only the book, so the book was rewritable while prepared
          // changes were refused. A lost book cannot be changed
          // until it is recovered or replaced — same field-named 400
          // pattern. No routine sheet save sends known_spells for a
          // wizard (saveKnownSpells is Bard/Warlock UI only), so this
          // blocks rewrites, never a legitimate save.
          if (wizState.status === 'lost') {
            return validationError(res, 'knownSpells: the spellbook is lost — the spellbook cannot be changed until it is recovered or replaced');
          }
          if (!Array.isArray(wizKnownIncoming) || wizKnownIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
            return validationError(res, 'knownSpells: known_spells must be a JSON array of spell names');
          }
          const wizBookSeen = new Set();
          for (const wizBookSpell of wizKnownIncoming) {
            const wizBookCanon = canonicalizeSpellName(wizBookSpell);
            if (wizBookSeen.has(wizBookCanon)) {
              return validationError(res, `knownSpells: '${wizBookSpell.trim()}' is in the spellbook twice`);
            }
            wizBookSeen.add(wizBookCanon);
            const wizBookLearnable = canLearnSpell({ classId: 'wizard', level: wizLevel, spellName: wizBookSpell.trim() });
            if (!wizBookLearnable.ok) {
              return validationError(res, `knownSpells: ${wizBookLearnable.reason}`);
            }
            // Cantrips are not book spells: canLearnSpell passes L0,
            // so the floor is checked here, as in validateBookAdds.
            const wizBookEntry = SPELL_DATA_ENTRIES[wizBookCanon];
            if (wizBookEntry && Number(wizBookEntry.level) < 1) {
              return validationError(res, `knownSpells: '${wizBookSpell.trim()}' is a cantrip — the spellbook holds leveled spells only`);
            }
          }
        }
        if (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined) {
          if (wizState.status === 'lost') {
            return validationError(res, 'preparedSpells: the spellbook is lost — prepared spells cannot be changed until the spellbook is recovered or replaced');
          }
          const wizIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
          if (!wizIncoming || wizIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
            return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
          }
          const wizCheck = validateWizardPreparedSpells(wizIntMod, wizLevel, wizIncoming, wizAlways);
          if (!wizCheck.ok) {
            return validationError(res, `preparedSpells: wizard may prepare at most ${wizCheck.max} spells at wizard level ${wizLevel} (Int mod ${wizIntMod}), got ${wizCheck.counted}`);
          }
          const wizStoredBook = safeParse(wizRow.known_spells, []);
          const wizBook = wizKnownPresent
            ? wizKnownIncoming
            : (Array.isArray(wizStoredBook) ? wizStoredBook : []);
          const wizMembership = validateBookMembership(wizIncoming, wizBook, wizAlways);
          if (!wizMembership.ok) {
            return validationError(res, `preparedSpells: ${wizMembership.missing.map((s) => `'${s}'`).join(', ')} ${wizMembership.missing.length === 1 ? 'is' : 'are'} not in the spellbook — prepared spells must come from the book (known_spells)`);
          }
        }
      }
    }

    // Cleric prepared-spell cap (2026-11-09, mechanics hooks Family
    // 3): mirrors the bard block above exactly. Same gates: no
    // creator marker (marker bodies went through the Stage 4
    // validator), prepared_spells present, primary cleric only;
    // cleric-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's
    // editor. The cap is the 2024 PHB formula — Wis mod + cleric
    // level, min 1 (L1 = 4 at Wis +3, L5 = 8 at Wis +3, L20 = 25
    // at Wis +5) — verified at build against
    // levelProgression.getSpellsPrepared, which falls through to
    // max(1, mod + lvl) for clerics; no fixed table is stored.
    // Domain spells are always prepared and excluded via
    // clericDomainSpellsAtLevel. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const cleRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores FROM characters WHERE id = ?',
        [req.params.id]
      );
      const cleResultingClass = String(req.body.class ?? cleRow?.class ?? '').toLowerCase();
      if (cleRow && cleResultingClass === 'cleric') {
        const cleLevels = safeParse(cleRow.class_levels, null);
        const cleEntry = Array.isArray(cleLevels)
          ? cleLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'cleric')
          : null;
        const cleLevel = Number(cleEntry?.level) || Number(cleRow.level) || 1;
        const cleSubclass = cleEntry?.subclass ?? cleRow.subclass ?? null;
        const cleRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : cleRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const cleScores = typeof cleRawScores === 'string' ? safeParse(cleRawScores, {}) : (cleRawScores || {});
        const cleWisScore = Number(cleScores?.wis ?? cleScores?.wisdom ?? 10);
        const cleWisMod = Math.floor(((Number.isFinite(cleWisScore) ? cleWisScore : 10) - 10) / 2);
        const cleAlways = clericDomainSpellsAtLevel('cleric', cleSubclass, cleLevel);
        const cleIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!cleIncoming || cleIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const cleCheck = validateClericPreparedSpells(cleWisMod, cleLevel, cleIncoming, cleAlways);
        if (!cleCheck.ok) {
          return validationError(res, `preparedSpells: cleric may prepare at most ${cleCheck.max} spells at cleric level ${cleLevel} (Wis mod ${cleWisMod}), got ${cleCheck.counted}`);
        }
      }
    }

    // Druid prepared-spell cap (2026-11-09, mechanics hooks Family
    // 3): mirrors the cleric block above exactly. Same gates: no
    // creator marker (marker bodies went through the Stage 4
    // validator), prepared_spells present, primary druid only;
    // druid-as-secondary multiclass skips — the shared
    // prepared_spells column is governed by the primary class's
    // editor. The cap is the 2024 PHB formula — Wis mod + druid
    // level, min 1 (L1 = 4 at Wis +3, L5 = 8 at Wis +3, L20 = 25
    // at Wis +5) — verified at build against
    // levelProgression.getSpellsPrepared, which falls through to
    // max(1, mod + lvl) for druids; no fixed table is stored.
    // Circle spells are always prepared and excluded via
    // druidCircleSpellsAtLevel. Circle of the Land reads its stored
    // land type from subclass_choices_json (migration 103, key
    // land_type — the PUT's allowedFields do not include it, so it
    // is read from the row, never the body), the same way the
    // Profane Soul block reads its stored patron. No stored land
    // type -> no exclusion (the helper returns []): a Land druid
    // with no stored land type fails closed and its land spells
    // count. Never trims, never silently fixes.
    if (
      req.body.creator !== 'creator-next' &&
      (req.body.prepared_spells !== undefined || req.body.preparedSpells !== undefined)
    ) {
      const druRow = await dbGet(
        'SELECT class, subclass, level, class_levels, ability_scores, subclass_choices_json FROM characters WHERE id = ?',
        [req.params.id]
      );
      const druResultingClass = String(req.body.class ?? druRow?.class ?? '').toLowerCase();
      if (druRow && druResultingClass === 'druid') {
        const druLevels = safeParse(druRow.class_levels, null);
        const druEntry = Array.isArray(druLevels)
          ? druLevels.find((e) => String(e?.class ?? '').toLowerCase() === 'druid')
          : null;
        const druLevel = Number(druEntry?.level) || Number(druRow.level) || 1;
        const druSubclass = druEntry?.subclass ?? druRow.subclass ?? null;
        const druRawScores = req.body.ability_scores !== undefined
          ? req.body.ability_scores
          : druRow.ability_scores;
        // safeParse only takes strings — a body object passes through as-is.
        const druScores = typeof druRawScores === 'string' ? safeParse(druRawScores, {}) : (druRawScores || {});
        const druWisScore = Number(druScores?.wis ?? druScores?.wisdom ?? 10);
        const druWisMod = Math.floor(((Number.isFinite(druWisScore) ? druWisScore : 10) - 10) / 2);
        const druChoices = parseSubclassChoices(druRow.subclass_choices_json);
        const druLandRaw = druChoices?.land_type ?? null;
        const druLand = Array.isArray(druLandRaw) ? druLandRaw[0] ?? null : druLandRaw;
        const druAlways = druidCircleSpellsAtLevel('druid', druSubclass, druLevel, druLand);
        const druIncoming = stage4ParseStringList(req.body.prepared_spells ?? req.body.preparedSpells);
        if (!druIncoming || druIncoming.some((s) => typeof s !== 'string' || !s.trim())) {
          return validationError(res, 'preparedSpells: prepared_spells must be a JSON array of spell names');
        }
        const druCheck = validateDruidPreparedSpells(druWisMod, druLevel, druIncoming, druAlways);
        if (!druCheck.ok) {
          return validationError(res, `preparedSpells: druid may prepare at most ${druCheck.max} spells at druid level ${druLevel} (Wis mod ${druWisMod}), got ${druCheck.counted}`);
        }
      }
    }

    // --- Phase 2 chunk 5 batch 3 checkpoint 2 — phase-transition side
    // effects (heirloom flip on handoff submit). Detected before the
    // generic UPDATE so we can read the prior phase to gate the work.
    let priorPhase = null
    if (
      req.body.creation_phase === 'active' &&
      (req.body.chosen_heirloom_candidate_id !== undefined ||
       /* defensive: any field-update to 'active' on a handoff row */ true)
    ) {
      const row = await dbGet('SELECT creation_phase FROM characters WHERE id = ?', [req.params.id])
      priorPhase = row?.creation_phase || null
    }

    // Phase 3.2 — the stored max_hp is the ceiling for clamping an incoming
    // current_hp when the request does not also set max_hp. Read only when
    // needed, so the common no-HP update keeps its single round trip.
    let existing = null;
    if (req.body.current_hp !== undefined && req.body.max_hp === undefined) {
      existing = await dbGet('SELECT max_hp FROM characters WHERE id = ?', [req.params.id]);
    }

    const updates = [];
    const values = [];

    const allowedFields = [
      'name', 'first_name', 'last_name', 'nickname', 'gender',
      'class', 'subclass', 'race', 'subrace', 'background',
      'level', 'current_hp', 'max_hp', 'current_location', 'current_quest',
      'gold_cp', 'gold_sp', 'gold_gp', 'starting_gold_gp',
      'experience', 'experience_to_next_level',
      'armor_class', 'speed', 'ability_scores', 'skills', 'advantages',
      'inventory', 'faction_standings', 'injuries', 'debuffs', 'equipment',
      'avatar', 'alignment', 'faith', 'lifestyle',
      'hair_color', 'skin_color', 'eye_color', 'height', 'weight', 'age',
      'personality_traits', 'ideals', 'bonds', 'flaws',
      'organizations', 'allies', 'enemies', 'backstory', 'other_notes',
      'known_cantrips', 'known_spells', 'prepared_spells', 'feats',
      'class_levels', 'hit_dice',
      'campaign_config', 'languages', 'tool_proficiencies',
      'keeper_texts', 'keeper_recitations', 'keeper_genre_domain',
      'keeper_genre_domain_2', 'keeper_genre_mastery', 'keeper_specialization',
      // 2024 size choice (PHB p. 194, migration 110) — validated
      // against the resulting species above; the loop writes the
      // canonical value, never the raw body string.
      'size',
      // Phase 2 chunk 2 — handoff transition. The (iv) preludePayload flow
      // in CharacterCreationWizard sends `creation_phase = 'active'` on
      // submit when finishing a 'ready_for_primary' character. Phase 2
      // chunk 5 batch 3 also uses this for the rebuilt creator's
      // 'creating' → 'active' (manual) and 'ready_for_primary' → 'active'
      // (handoff) submit transitions.
      'creation_phase',
      // Phase 2 chunk 5 batch 3 sub-checkpoint 2 — Step 7's "build" field
      // (slim / heavy / wiry / etc., per spec §5.7.4). Column added by
      // migration 050.
      'physical_build',
      // Creator-next Stage 1 (migration 105) — origin facts, so Stage 1
      // draft PUTs persist instead of being silently dropped.
      'origin_setting', 'origin_region', 'origin_explanation',
      // Creation-solidification item 5 (migration 114) — the SUBCLASS's
      // origin explanation (outside-FR subclasses, validateSelection).
      'subclass_origin_explanation',
      // Phase 3.3 SC-7.6.5 (v1.0.162) — player-tunable survival intensity
      // per spec §3.3.10. Validated against the four-value enum below;
      // invalid values silently fall back (skip the update) so client
      // bugs never corrupt the row.
      'survival_intensity'
    ];

    const VALID_SURVIVAL_INTENSITIES = new Set(['off', 'lenient', 'standard', 'strict']);

    for (const [key, value] of Object.entries(req.body)) {
      // Fighting style (Stage 6 follow-up, 2026-11-07): the creator
      // draft PUT now persists it, so a refresh keeps the pick — the
      // column exists (migration 058) but the allowlist never
      // carried it, so draft saves silently dropped it (the commit
      // wrote it directly). Both spellings accepted; a non-empty
      // string stores trimmed, null / empty clears, anything else
      // is skipped, never corrupting the row. No membership check
      // here — the PUT is draft-tolerant by design; the commit
      // validator refuses unknown style names. Counts as an update,
      // so a PUT carrying only this field does not 400.
      if (key === 'fighting_style' || key === 'fightingStyle') {
        if (value == null || (typeof value === 'string' && !value.trim())) {
          updates.push('fighting_style = ?');
          values.push(null);
        } else if (typeof value === 'string') {
          updates.push('fighting_style = ?');
          values.push(value.trim());
        }
        continue;
      }
      // Subclass choices (same job): the client sends the raw object
      // under subclass_choices / subclassChoices; the column is
      // subclass_choices_json (migration 103). parseSubclassChoices
      // normalizes string / object / invalid to a plain object,
      // exactly like the commit write path. Null sends nothing (the
      // stored choices stand); a PUT carrying only this field counts
      // as an update.
      if (key === 'subclass_choices' || key === 'subclassChoices' || key === 'subclass_choices_json') {
        if (value != null) {
          updates.push('subclass_choices_json = ?');
          values.push(JSON.stringify(parseSubclassChoices(value)));
        }
        continue;
      }
      // Warlock pact (item 11, migration 113): the column is `pact`.
      // A non-empty string stores the normalized key ('blade' /
      // 'chain' / 'tome'); null / empty clears the pick (changing the
      // pact back to "none" is a legitimate draft edit). Marker bodies
      // already passed the Stage 2 pact check; non-marker callers get
      // the same membership + warlock check here, so a bad value 400s
      // instead of hitting the CHECK constraint or storing nonsense.
      // The class resolves body-then-stored-row, same as the size
      // block above. Counts as an update, so a PUT carrying only the
      // pact does not 400.
      if (key === 'pact') {
        if (value == null || (typeof value === 'string' && !value.trim())) {
          updates.push('pact = ?');
          values.push(null);
        } else if (typeof value === 'string') {
          const pactKey = normWarlockPact(value);
          if (!pactKey) {
            return validationError(res, `pact: '${value}' is not a warlock pact — choose Blade, Chain, or Tome`);
          }
          const putCls = req.body.class ?? storedRow?.class ?? null;
          const putLevels = req.body.class_levels ?? req.body.classLevels ?? storedRow?.class_levels ?? null;
          if (!hasWarlockLevels(putCls, putLevels)) {
            return validationError(res, `pact: '${pactKey}' requires warlock levels — ${String(putCls || '').trim().toLowerCase() || 'no class'} has none`);
          }
          updates.push('pact = ?');
          values.push(pactKey);
        }
        continue;
      }
      if (allowedFields.includes(key)) {
        // 2024 size choice (migration 110): the canonical value
        // from the validation above — never the raw body string. A
        // complete mixed record owns size (derived below), so a body
        // size there is ignored. Null / empty clears the choice.
        if (key === 'size') {
          if (mixedCompletePut) continue;
          updates.push('size = ?');
          values.push(putSizeSent ? putSizeCanonical : null);
          continue;
        }
        // Phase 3.3 SC-7.6.5: enforce the survival_intensity enum at the
        // PUT boundary (spec §3.3.10 — the migration's CHECK constraint
        // shape isn't expressible inline on SQLite ALTER, so the
        // application layer guards the column).
        if (key === 'survival_intensity' && !VALID_SURVIVAL_INTENSITIES.has(value)) {
          continue;
        }

        // Phase 3.2 — HP is authoritative server-side now (per-turn
        // [HP_CHANGE] markers plus death saves). This endpoint still needs to
        // accept current_hp for the character sheet's manual editor, but it
        // must not be a hole straight through the invariants: clamp to
        // [0, max_hp] and reject non-numeric input rather than writing it raw.
        if (key === 'current_hp') {
          const requested = Number(value);
          if (!Number.isFinite(requested)) continue;
          const ceiling = Number(req.body.max_hp ?? existing?.max_hp);
          const clamped = Number.isFinite(ceiling)
            ? Math.max(0, Math.min(ceiling, Math.trunc(requested)))
            : Math.max(0, Math.trunc(requested));
          updates.push(`${key} = ?`);
          values.push(clamped);
          continue;
        }

        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    // Artificer base class: the creator's origin explanation is not a
    // column, so it bypasses the allowlist and merges into
    // class_resources_json.artificer.origin (Eberron/Khorvaire, per the
    // outside-FR ruling). Only when the resulting class is artificer;
    // other classes silently ignore the field. Counts as an update so
    // a progress PUT carrying only this field is not a validation error.
    let originMerged = false;
    if (typeof req.body.artificer_origin_explanation === 'string' && req.body.artificer_origin_explanation.trim()) {
      const originRow = await dbGet('SELECT class, class_resources_json FROM characters WHERE id = ?', [req.params.id]);
      const resultingClass = req.body.class ?? originRow?.class;
      if (String(resultingClass || '').toLowerCase() === 'artificer') {
        const resources = safeParse(originRow?.class_resources_json, {}) || {};
        resources.artificer = {
          ...(resources.artificer || {}),
          origin: { setting: 'Eberron', region: 'Khorvaire', explanation: req.body.artificer_origin_explanation.trim() },
        };
        await dbRun('UPDATE characters SET class_resources_json = ? WHERE id = ?', [JSON.stringify(resources), req.params.id]);
        originMerged = true;
      }
    }

    // Creator-next Stage 3 (2026-11-06): a PUT carrying only a
    // theme/origin-feat pick is still a real update — theme_id is
    // not a characters column (the generic UPDATE ignores it), so
    // the persist calls below are the update. Without this, a
    // theme-only draft PUT would 400 here before persisting.
    const hasThemePersist = !!req.body.theme_id;
    const hasOriginFeatPersist = !!(req.body.origin_feat ?? req.body.originFeat);
    // Creator-next Stage 1 (2026-11-06, item 6): a resumed creator
    // PUT carrying an ancestry feat pick is a real update too — the
    // persist call below is the update, same pattern as theme /
    // origin feat. Without this, a resumed draft's ancestry pick
    // would be silently dropped (PUT never persisted it before).
    const hasAncestryPersist = !!(req.body.ancestry_feat_id ?? req.body.ancestryFeatId);
    // Mixed Ancestry (2026-11-06): a PUT carrying a mixed record is
    // a real update too — the persist below is the update, same
    // pattern as theme / origin feat. Without this, a mixed-only
    // draft PUT would 400 here before persisting.
    const hasMixedPersist = mixedBodyPresent;
    // Human Versatile (item 19, 2026-11-06): a PUT carrying only a
    // versatile pick is a real update too — the persist below is the
    // update, same pattern as theme / origin feat.
    const hasVersatilePersist = !!(req.body.versatile_feat ?? req.body.versatileFeat);
    // Creator-next Stage 5 (2026-11-07): a PUT carrying only a gear
    // fork is a real update too — the derivation above writes
    // max_hp / gold / inventory / equipment into req.body, but a
    // draft with no package chosen yet derives nothing, so the gear
    // choice itself counts as an update (same pattern as theme).
    const hasStage5Persist = !!(req.body.gear_choice ?? req.body.gearChoice);
    if (updates.length === 0 && !originMerged && !hasThemePersist && !hasOriginFeatPersist && !hasAncestryPersist && !hasMixedPersist && !hasVersatilePersist && !hasStage5Persist) {
      return validationError(res, 'No valid fields to update');
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.id);

    await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, values);

    // Size choice (migration 110): a species change that left a
    // stored size the new species cannot have clears it (computed
    // above as putSizeReset) instead of leaving a stale claim.
    if (putSizeReset) {
      await dbRun('UPDATE characters SET size = NULL WHERE id = ?', [req.params.id]);
    }

    // Warlock pact (item 11, migration 113): a class change away
    // from warlock clears a stored pact (computed above as
    // putPactReset) instead of leaving a stale claim on the row.
    if (putPactReset) {
      await dbRun('UPDATE characters SET pact = NULL WHERE id = ?', [req.params.id]);
    }

    // Creator-next Stage 3 (2026-11-06): PUT never persisted theme
    // selections before — a draft PUT carrying theme_id now persists
    // the theme (and its L1 ability) and the origin feat, same
    // unconditional-on-field-presence pattern as POST, NOT
    // marker-gated. Runs on every PUT that carries the fields,
    // including non-creator callers, exactly like POST.
    if (hasThemePersist) {
      await persistThemeSelection(req.params.id, req.body.theme_id, req.body.theme_path_choice ?? null, req.body.level ?? 1, req.body.theme_path_data ?? req.body.themePathData);
    }
    if (hasOriginFeatPersist) {
      await persistOriginFeatSelection(
        req.params.id,
        canonicalOriginFeatKey(req.body.origin_feat ?? req.body.originFeat),
        req.body.origin_feat_choices ?? req.body.originFeatChoices ?? null,
        req.body.level ?? 1
      );
    }
    // Human Versatile (item 19): same unconditional-on-field-
    // presence pattern as POST, under slot 'versatile' — it coexists
    // with the theme row, it never replaces it.
    if (hasVersatilePersist) {
      await persistOriginFeatSelection(
        req.params.id,
        canonicalOriginFeatKey(req.body.versatile_feat ?? req.body.versatileFeat),
        req.body.versatile_feat_choices ?? req.body.versatileFeatChoices ?? null,
        req.body.level ?? 1,
        'versatile'
      );
    }
    if (hasAncestryPersist) {
      await persistAncestryFeatSelection(
        req.params.id,
        req.body.ancestry_feat_id ?? req.body.ancestryFeatId,
        1,
        req.body.level ?? 1,
        req.body.ancestry_feat_choices ?? req.body.ancestryFeatChoices ?? null
      );
    }

    // Mixed Ancestry (2026-11-06, migration 108): persist the
    // validated record (an explicit null clears it), and when the
    // record is complete derive the stored race/subrace/speed/size
    // from it (same derivation as POST — a separate UPDATE, so it
    // never collides with a body race the generic UPDATE above
    // wrote). A mixed draft with no size recorded clears the stored
    // size: the record owns size for mixed characters.
    if (mixedBodyPresent) {
      await dbRun('UPDATE characters SET mixed_ancestry_json = ? WHERE id = ?', [
        mixedPut.normalized ? JSON.stringify(mixedPut.normalized) : null,
        req.params.id,
      ]);
      if (mixedCompletePut) {
        await dbRun('UPDATE characters SET race = ?, subrace = ?, speed = ?, size = ? WHERE id = ?', [
          mixedAncestrySpeciesLabel(mixedPut.normalized.parents), null, mixedPut.normalized.speed, mixedPut.normalized.size ?? null, req.params.id,
        ]);
      }
    }

    // --- Phase 2 chunk 5 batch 3 sub-checkpoint 2 — handoff submit ---
    // When the PUT flips creation_phase to 'active' and the prior phase
    // was 'ready_for_primary', this is the handoff submit. Run side
    // effects: heirloom candidate flip + canon transfer to campaign tables.
    if (priorPhase === 'ready_for_primary' && req.body.creation_phase === 'active') {
      const chosenId = req.body.chosen_heirloom_candidate_id ?? null
      await applyHeirloomChoiceOnSubmit(req.params.id, chosenId)
      try {
        const transferResult = await transferCanonToCampaign(req.params.id)
        console.log(`[handoff submit] character ${req.params.id} canon transfer:`, transferResult)
      } catch (transferErr) {
        // Canon transfer failure is non-blocking — character still
        // flips to 'active' and player can play; the prelude_canon_*
        // data persists and a follow-up retry can re-run the transfer
        // (it's idempotent). Surface the error in logs but don't fail
        // the submit (the character is in a valid state either way).
        console.error(`[handoff submit] canon transfer failed for character ${req.params.id}:`, transferErr)
      }
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(character);
  } catch (error) {
    handleServerError(res, error, 'update character');
  }
});

// Merged body for the commit validator: the stored row + side tables
// + request body, body wins. Row JSON-string columns pass through
// as-is (the stage validators accept strings or objects). Fields
// the body omits keep their stored values; fields the row has no
// column for (base_scores, generation_method, ability_choice_picks,
// class_skill_picks, gear) come from the body only.
// Two omissions are deliberate:
//   - forgo trade on: the stored theme origin feat is NOT merged
//     (the trade means it was forgone; merging it would make Stage 3
//     refuse a commit that should clear it instead),
//   - mixed complete: the stored standalone versatile feat is NOT
//     merged (a mixed character has no Versatile slot; the row is
//     stale from a pre-mixed human state and the commit deletes it).
function buildCommitMergedBody(row, stage4Ctx, effectiveMixed, body, forgoOn, mixedComplete) {
  const merged = { creator: 'creator-next' };
  const rowFields = [
    'name', 'first_name', 'last_name', 'nickname', 'gender',
    'race', 'subrace', 'class', 'subclass', 'size',
    'alignment', 'faith', 'lifestyle', 'age', 'height', 'weight',
    'eye_color', 'hair_color', 'skin_color', 'physical_build',
    'personality_traits', 'ideals', 'bonds', 'flaws',
    'organizations', 'allies', 'enemies', 'backstory', 'other_notes',
    'avatar', 'skills', 'languages', 'tool_proficiencies',
    'known_spells', 'prepared_spells', 'known_cantrips',
    'ability_scores', 'expertise', 'fighting_style',
    'distinguishing_features',
    'origin_setting', 'origin_region', 'origin_explanation',
    'subclass_origin_explanation',
  ];
  for (const f of rowFields) {
    if (row[f] != null) merged[f] = row[f];
  }
  if (row.subclass_choices_json != null) merged.subclass_choices = row.subclass_choices_json;
  if (body.theme_id == null && body.themeId == null && stage4Ctx.themeId != null) merged.theme_id = stage4Ctx.themeId;
  if (body.theme_path_choice == null && body.themePathChoice == null && stage4Ctx.themePathChoice != null) merged.theme_path_choice = stage4Ctx.themePathChoice;
  // R2-11(e): the soldier second field rides the same fallback —
  // the stored path_data (already parsed by the context read)
  // stands in when the body does not re-send it, so a commit
  // without the field does not drop a stored Active Duty value.
  if (body.theme_path_data == null && body.themePathData == null && stage4Ctx.themePathData != null) merged.theme_path_data = stage4Ctx.themePathData;
  if (!forgoOn) {
    if (body.origin_feat == null && body.originFeat == null && stage4Ctx.originFeatKey != null) merged.origin_feat = stage4Ctx.originFeatKey;
    if (body.origin_feat_choices == null && body.originFeatChoices == null && stage4Ctx.originFeatChoices != null) merged.origin_feat_choices = stage4Ctx.originFeatChoices;
  }
  if (!mixedComplete) {
    if (body.versatile_feat == null && body.versatileFeat == null && stage4Ctx.versatileFeatKey != null) merged.versatile_feat = stage4Ctx.versatileFeatKey;
    if (body.versatile_feat_choices == null && body.versatileFeatChoices == null && stage4Ctx.versatileFeatChoices != null) merged.versatile_feat_choices = stage4Ctx.versatileFeatChoices;
  }
  if (body.ancestry_feat_id == null && body.ancestryFeatId == null && stage4Ctx.ancestryFeatId != null) merged.ancestry_feat_id = stage4Ctx.ancestryFeatId;
  if (body.ancestry_feat_choices == null && body.ancestryFeatChoices == null && stage4Ctx.ancestryFeatChoices != null) merged.ancestry_feat_choices = stage4Ctx.ancestryFeatChoices;
  // Body wins (every field it carries, including explicit nulls —
  // the validator refuses a null where a value is required).
  for (const [key, value] of Object.entries(body || {})) {
    if (value !== undefined) merged[key] = value;
  }
  // The mixed record is the validated normalized record, never the
  // raw body shape — and a complete record owns race/subrace/size.
  if (effectiveMixed != null) {
    merged.mixed_ancestry = effectiveMixed;
    if (mixedComplete) {
      merged.race = mixedAncestrySpeciesLabel(effectiveMixed.parents);
      merged.subrace = null;
      merged.size = effectiveMixed.size ?? null;
    }
  }
  return merged;
}

// Speed for a mixed-ancestry character committing with gear: the
// record's speed, minus 10 when the resolved package's armor has an
// unmet Strength requirement (the derive returns null for mixed —
// the label resolves to no registry entry — so the commit computes
// it explicitly). Gold fork: the record speed, no penalty.
function commitMixedSpeed(cls, packageId, picks, finalScores, recordSpeed) {
  let speed = Number(recordSpeed) || 30;
  if (!packageId) return speed;
  const resolved = resolvePackage(cls, packageId, picks);
  if (!resolved || !resolved.ok) return speed;
  let armorName = null;
  for (const item of resolved.items || []) {
    const canonical = stage5CanonicalArmorName(item.name);
    if (canonical) { armorName = canonical; break; }
  }
  if (armorName) {
    const req = STAGE5_ARMOR_STR_REQ[armorName];
    const str = finalScores ? Number(finalScores.str) || 0 : 0;
    if (req != null && str < req) speed = speed - 10;
  }
  return speed;
}

// Creator-next Stage 6 — Review & Commit (2026-11-07).
// POST /api/character/:id/commit — the creator's submit. Runs
// validateCreatorNextStage6 against the stored row + side tables
// merged with the request body (the body may carry the final draft
// state, or be empty and commit the stored draft as-is), then
// applies the commit. Nothing is written before validation passes,
// so a commit never partially applies.
//
// What the commit does (in order):
//   - refuses rows in a Prelude phase ('ready_for_primary' /
//     'prelude' / 'prelude_setup') — those commit through the
//     Prelude handoff, not the creator (mirrors HomeFlow's honest
//     error). Only 'creating' (draft commit) and 'active' (edit-mode
//     commit) are accepted.
//   - re-runs the idempotent persists from the MERGED state (theme +
//     L1 ability, origin feat theme + versatile slots, ancestry
//     feat) with level 1 — these are L1 creation grants, never
//     re-leveled — so a commit is self-sufficient even if a draft
//     field was persisted by an older path. INSERT OR REPLACE means
//     no double rows; committing twice changes nothing.
//   - forgo clearing: when the mixed record has forgoOriginFeat,
//     the theme-slot origin-feat row is DELETEd (the trade means the
//     feat was forgone for +4 budget; keeping it is a double-dip).
//     Commit-only clearing — PUT-time clearing would change
//     existing draft behavior. Reversal cost: one DELETE + tests.
//   - a mixed character's stale standalone versatile row is deleted
//     (a mixed character has no Versatile slot; the row is stale
//     from a pre-mixed human state).
//   - applies ONLY definition fields from the body. Progression is
//     preserved in edit mode: level, XP, gold, inventory,
//     equipment, HP, AC and speed are never taken from the body —
//     gear re-picks re-derive (HP only when stored max_hp is 0,
//     the existing derive rule; no new HP rule is invented).
//   - flips creation_phase to 'active' and returns the row.
// Refusals are 400s naming the field. 404 when the character does
// not exist.
router.post('/:id/commit', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const characterId = req.params.id;
    const row = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    if (!row) return notFound(res, 'Character');
    const priorPhase = row.creation_phase ?? null;
    if (priorPhase === 'ready_for_primary' || priorPhase === 'prelude' || priorPhase === 'prelude_setup') {
      return validationError(res, `creationPhase: a '${priorPhase}' character commits through the Prelude handoff, not the creator`);
    }
    const isEditMode = priorPhase === 'active';
    // --- Stored context: side tables + mixed record. ---
    const stage4Ctx = await readCreatorNextStage4Context(characterId);
    let storedMixed = null;
    try { storedMixed = parseMixedAncestry(row.mixed_ancestry_json ?? null); } catch { storedMixed = null; }
    let storedThemeFeatKey = null;
    try {
      const t = await dbGet("SELECT feat_key FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [characterId]);
      storedThemeFeatKey = t?.feat_key ?? null;
    } catch { /* pre-migration table: no stored theme feat */ }
    // Mixed record the body carries wins; an explicit null clears it.
    const mixedBodyPresent = body.mixed_ancestry !== undefined || body.mixedAncestry !== undefined;
    const mixedRaw = mixedBodyPresent ? (body.mixed_ancestry ?? body.mixedAncestry ?? null) : undefined;
    let effectiveMixed = storedMixed;
    if (mixedBodyPresent) {
      if (mixedRaw == null) {
        effectiveMixed = null;
      } else {
        const mixedCheck = validateMixedAncestry(mixedRaw);
        if (!mixedCheck.ok) return validationError(res, mixedCheck.errors.join('; '));
        effectiveMixed = mixedCheck.normalized;
      }
    }
    const mixedComplete = !!(effectiveMixed && Array.isArray(effectiveMixed.parents) && effectiveMixed.parents.length === 2);
    const forgoOn = forgoOriginFeatFrom(effectiveMixed);
    // --- Merged body + validation (nothing written before this passes). ---
    const merged = buildCommitMergedBody(row, stage4Ctx, effectiveMixed, body, forgoOn, mixedComplete);
    const commitCtx = {
      ...stage4Ctx,
      mixedAncestry: effectiveMixed,
      themeOriginFeatKey: stage4Ctx.originFeatKey ?? storedThemeFeatKey ?? null,
    };
    const check = await validateCreatorNextStage6(merged, commitCtx);
    if (!check.ok) return validationError(res, check.errors.join('; '));
    // --- Apply: mixed record (body-carried) + derived race/size/speed. ---
    if (mixedBodyPresent) {
      await dbRun('UPDATE characters SET mixed_ancestry_json = ? WHERE id = ?', [
        effectiveMixed ? JSON.stringify(effectiveMixed) : null,
        characterId,
      ]);
      if (mixedComplete) {
        await dbRun('UPDATE characters SET race = ?, subrace = ?, speed = ?, size = ? WHERE id = ?', [
          mixedAncestrySpeciesLabel(effectiveMixed.parents), null, effectiveMixed.speed, effectiveMixed.size ?? null, characterId,
        ]);
      }
    }
    // --- Apply: definition fields from the body only. ---
    // Progression fields are never taken from the body (edit-mode
    // preservation): level, experience, experience_to_next_level,
    // gold, inventory, equipment, HP, AC, speed. Gear re-picks
    // re-derive below; theme / origin feat / ancestry feat live in
    // side tables and persist in the next step.
    const toJsonColumn = (v) => (typeof v === 'string' ? v : JSON.stringify(v));
    const updates = [];
    const values = [];
    const scalarFields = [
      'name', 'first_name', 'last_name', 'nickname', 'gender',
      'alignment', 'faith', 'lifestyle', 'age', 'height', 'weight',
      'eye_color', 'hair_color', 'skin_color', 'physical_build',
      'personality_traits', 'ideals', 'bonds', 'flaws',
      'organizations', 'allies', 'enemies', 'backstory', 'other_notes',
      'avatar', 'origin_setting', 'origin_region', 'origin_explanation',
      'subclass_origin_explanation',
      'distinguishing_features',
    ];
    for (const column of scalarFields) {
      if (body[column] !== undefined && body[column] !== null) {
        updates.push(`${column} = ?`);
        values.push(body[column]);
      }
    }
    // Race / subrace / size: definition fields, but a complete mixed
    // record owns them (derived above) — a body race placeholder
    // must never overwrite them.
    if (!mixedComplete) {
      if (body.race !== undefined && body.race !== null) {
        updates.push('race = ?');
        values.push(body.race);
      }
      if (body.subrace !== undefined) {
        updates.push('subrace = ?');
        values.push(body.subrace ?? null);
      }
      if (body.size !== undefined && body.size !== null) {
        const sizeCheck = validateSizeChoice(merged.race ?? null, merged.subrace ?? null, body.size);
        updates.push('size = ?');
        values.push(sizeCheck.size ?? body.size);
      }
    }
    const classBody = body.class ?? body.classId ?? null;
    if (classBody != null) {
      updates.push('class = ?');
      values.push(classBody);
    }
    if (body.subclass !== undefined || body.subclassName !== undefined) {
      updates.push('subclass = ?');
      values.push(body.subclass ?? body.subclassName ?? null);
    }
    // Lists: the row stores JSON strings; an array body is stringified.
    // Item 20 (store): a commit body may re-send the full draft state
    // in snake_case — canonicalize before writing, same as POST/PUT,
    // so the row keeps the display form roll-time checks compare
    // against. Runs after validation (merged was checked above).
    for (const [field, known] of [['skills', STAGE4_SKILLS], ['languages', STAGE4_LANGUAGES], ['tool_proficiencies', STAGE4_TOOLS], ['expertise', STAGE4_SKILLS]]) {
      if (body[field] !== undefined && body[field] !== null) {
        const canon = stage4CanonicalListJson(body[field], known);
        if (canon != null) body[field] = canon;
      }
    }
    for (const column of ['skills', 'languages', 'tool_proficiencies', 'known_spells', 'prepared_spells', 'known_cantrips']) {
      if (body[column] !== undefined && body[column] !== null) {
        updates.push(`${column} = ?`);
        values.push(toJsonColumn(body[column]));
      }
    }
    if (body.ability_scores !== undefined && body.ability_scores !== null) {
      updates.push('ability_scores = ?');
      values.push(toJsonColumn(body.ability_scores));
    }
    // Local-only fields: fighting style and subclass choices are
    // also written by the general PUT (Stage 6 follow-up,
    // 2026-11-07); expertise stays commit-only. The columns exist,
    // the creator routes write them — see the PUT special cases.
    const fightingStyleBody = body.fighting_style ?? body.fightingStyle ?? null;
    if (fightingStyleBody != null) {
      updates.push('fighting_style = ?');
      values.push(String(fightingStyleBody).trim());
    }
    if (body.expertise !== undefined && body.expertise !== null) {
      updates.push('expertise = ?');
      values.push(toJsonColumn(body.expertise));
    }
    const subclassChoicesBody = body.subclass_choices ?? body.subclassChoices ?? null;
    if (subclassChoicesBody != null) {
      updates.push('subclass_choices_json = ?');
      values.push(JSON.stringify(parseSubclassChoices(subclassChoicesBody)));
    }
    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      values.push(characterId);
      await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, values);
    }
    // --- Side-table persists (idempotent re-run from merged state). ---
    // Level 1: these are L1 creation grants, never re-leveled — an
    // edit-mode commit on a higher-level character keeps the L1
    // unlock / selection level.
    if (merged.theme_id) {
      await persistThemeSelection(characterId, merged.theme_id, merged.theme_path_choice ?? null, 1, merged.theme_path_data ?? merged.themePathData);
    }
    if (merged.origin_feat && !forgoOn) {
      await persistOriginFeatSelection(
        characterId,
        canonicalOriginFeatKey(merged.origin_feat),
        merged.origin_feat_choices ?? null,
        1,
        'theme'
      );
    }
    if (merged.versatile_feat) {
      await persistOriginFeatSelection(
        characterId,
        canonicalOriginFeatKey(merged.versatile_feat),
        merged.versatile_feat_choices ?? null,
        1,
        'versatile'
      );
    }
    if (merged.ancestry_feat_id) {
      await persistAncestryFeatSelection(
        characterId,
        merged.ancestry_feat_id,
        1,
        1,
        merged.ancestry_feat_choices ?? null
      );
    }
    // --- Fighting style -> feats (creation-solidification item 6). ---
    // The creator stores the pick in characters.fighting_style, but
    // every consumer — attack bonuses (partyAttackService via
    // classFeatureService.fightingStyleAdjustments), Defense AC
    // (combatStatsService.defenseAcBonus), the DM prompt's feat block
    // (renderFeatEffectsForPrompt) — reads the `feats` list. One
    // mechanism: the commit writes the style into `feats` as the
    // registry entry, tagged source 'creator-fighting-style' so an
    // edit-mode re-commit REPLACES the creator's style instead of
    // stacking a second one. Styles from any other source (level-up
    // feats, manual entries) are never touched. The commit validator
    // above already refused an unknown style name.
    {
      const styleRaw = merged.fighting_style ?? merged.fightingStyle ?? null;
      const styleName = typeof styleRaw === 'string' ? styleRaw.trim() : '';
      const featRow = await dbGet('SELECT feats FROM characters WHERE id = ?', [characterId]);
      const existingFeats = safeParse(featRow?.feats, []);
      const baseFeats = (Array.isArray(existingFeats) ? existingFeats : [])
        .filter((f) => !(f && typeof f === 'object' && f.source === 'creator-fighting-style'));
      let nextFeats = baseFeats;
      if (styleName) {
        const want = normalizeFeatName(styleName);
        const entry = listFightingStyleFeats().find((s) => normalizeFeatName(s.key) === want || normalizeFeatName(s.name) === want);
        if (entry) {
          nextFeats = [...baseFeats, { key: entry.key, name: entry.name, category: 'fighting_style', source: 'creator-fighting-style', acquiredAtLevel: 1 }];
        }
      }
      const changed = JSON.stringify(nextFeats) !== JSON.stringify(Array.isArray(existingFeats) ? existingFeats : []);
      if (changed) {
        await dbRun('UPDATE characters SET feats = ? WHERE id = ?', [JSON.stringify(nextFeats), characterId]);
      }
    }
    // --- Forgo clearing + stale versatile clearing. ---
    if (forgoOn) {
      await dbRun("DELETE FROM character_origin_feats WHERE character_id = ? AND slot = 'theme'", [characterId]);
    }
    if (mixedComplete) {
      await dbRun("DELETE FROM character_origin_feats WHERE character_id = ? AND slot = 'versatile'", [characterId]);
    }
    // --- Gear derive (only when the body carries gear fields). ---
    const gearInBody = (body.gear_choice ?? body.gearChoice ?? null) != null
      || (body.package_id ?? body.packageId ?? null) != null
      || (body.package_picks ?? body.packagePicks ?? null) != null;
    if (gearInBody) {
      const derived = deriveCreatorNextStage5(merged, commitCtx, { isPost: !isEditMode });
      const derivedUpdates = [];
      const derivedValues = [];
      if (derived.maxHp != null) {
        derivedUpdates.push('max_hp = ?', 'current_hp = ?');
        derivedValues.push(derived.maxHp, derived.currentHp);
      }
      if (derived.armorClass != null) {
        derivedUpdates.push('armor_class = ?');
        derivedValues.push(derived.armorClass);
      }
      if (derived.speed != null) {
        derivedUpdates.push('speed = ?');
        derivedValues.push(derived.speed);
      }
      if (derived.goldGp != null) {
        derivedUpdates.push('gold_gp = ?');
        derivedValues.push(derived.goldGp);
      }
      if (derived.inventory != null) {
        derivedUpdates.push('inventory = ?');
        derivedValues.push(derived.inventory);
      }
      if (derived.equipment != null) {
        derivedUpdates.push('equipment = ?');
        derivedValues.push(derived.equipment);
      }
      // Mixed characters: the derive returns no speed (the label
      // resolves to no registry entry) — compute it explicitly.
      if (mixedComplete && derived.speed == null) {
        const finalScores = stage4ParseScores(merged.ability_scores ?? null);
        const gearPicks = stage5NormalizePicks(
          stage5ParsePicks(merged.package_picks ?? merged.packagePicks ?? null).picks || {},
          typeof merged.package_id === 'string' ? merged.package_id.trim().toUpperCase() : null
        );
        const mixedSpeed = commitMixedSpeed(
          typeof merged.class === 'string' ? merged.class.trim().toLowerCase() : '',
          typeof merged.package_id === 'string' ? merged.package_id.trim().toUpperCase() : null,
          gearPicks,
          finalScores,
          effectiveMixed.speed
        );
        derivedUpdates.push('speed = ?');
        derivedValues.push(mixedSpeed);
      }
      if (derivedUpdates.length > 0) {
        derivedValues.push(characterId);
        await dbRun(`UPDATE characters SET ${derivedUpdates.join(', ')} WHERE id = ?`, derivedValues);
      }
    }
    // --- Flip + return. ---
    await dbRun("UPDATE characters SET creation_phase = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [characterId]);
    const committed = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    return res.json(committed);
  } catch (error) {
    handleServerError(res, error, 'commit character');
  }
});

/**
 * Phase 2 chunk 5 batch 3 checkpoint 2 — apply the player's heirloom
 * candidate choice at handoff submit. The chosen candidate flips to
 * 'carried_forward'; all other candidates for this character flip to
 * 'left_behind'. The chosen candidate's content is also reflected on
 * the character's inventory blob (already shaped client-side at
 * submit time per creatorPersistence.js).
 *
 * Per spec §8.1.2 status semantics: unpicked candidates are kept in the
 * table for narrative reference; the AI may surface "remember the
 * [object] you didn't take" in late-campaign play. No MVP mechanism
 * wires this surfacing today.
 *
 * Currently a no-op for every existing handoff character because the
 * heirloom producer is deferred per Option A — `prelude_canon_heirlooms`
 * has no rows. The function exists wired so it lights up automatically
 * when producer-side work lands.
 */
async function applyHeirloomChoiceOnSubmit(characterId, chosenCandidateId) {
  // Get all candidates for this character
  const candidates = await dbAll(
    `SELECT id FROM prelude_canon_heirlooms
     WHERE character_id = ? AND status = 'candidate'`,
    [characterId]
  )
  if (candidates.length === 0) return // No-op, no candidates to apply

  for (const c of candidates) {
    const newStatus = (chosenCandidateId != null && Number(c.id) === Number(chosenCandidateId))
      ? 'carried_forward'
      : 'left_behind'
    await dbRun(
      `UPDATE prelude_canon_heirlooms SET status = ? WHERE id = ?`,
      [newStatus, c.id]
    )
  }
}

// Delete character and all related data.
//
// Uses dynamic foreign-key discovery instead of a hand-written deletion
// list. Every table in the database is scanned via PRAGMA foreign_key_list;
// any table with a declared FK to `characters` has its matching rows
// deleted before the character row itself. This is robust against future
// schema additions — new tables with an FK to characters are picked up
// automatically, no endpoint edits required.
//
// One indirect cascade is still handled explicitly: session_message_summaries
// FKs dm_sessions (not characters directly), and has no ON DELETE CASCADE
// declared, so we have to clear it before dm_sessions gets deleted.
//
// Replaces the prior hand-written 13-step list, which missed any table
// added after it was last maintained — the reason the v1.0.50 play-test
// couldn't delete TEST_LWChar (companions.recruited_by_character_id was in
// the list but some parallel dependency wasn't, and the error surfaced
// before the companion delete reached it).
router.delete('/:id', async (req, res) => {
  try {
    const id = req.params.id;

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    // --- INDIRECT CASCADES (FK to intermediate table, not characters) ---
    // session_message_summaries → dm_sessions(id). No ON DELETE CASCADE.
    await dbRun(
      'DELETE FROM session_message_summaries WHERE session_id IN (SELECT id FROM dm_sessions WHERE character_id = ?)',
      [id]
    );

    // --- DIRECT FK HOLDERS (discovered from schema at request time) ---
    const tables = await dbAll(
      `SELECT name FROM sqlite_master
       WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'characters'`
    );
    const directRefs = [];
    for (const t of tables) {
      // Inline the table name — PRAGMA args can't be bound as parameters in
      // SQLite. Table names come from sqlite_master so they're trusted.
      const fks = await dbAll(`PRAGMA foreign_key_list(${t.name})`);
      for (const fk of fks) {
        if (fk.table === 'characters') directRefs.push({ table: t.name, column: fk.from });
      }
    }

    // Delete from every direct FK holder. Order among direct refs doesn't
    // matter — they're all at the same depth in the FK graph.
    const cleaned = [];
    for (const { table, column } of directRefs) {
      await dbRun(`DELETE FROM ${table} WHERE ${column} = ?`, [id]);
      cleaned.push(`${table}.${column}`);
    }

    // --- FINAL: the character row itself ---
    await dbRun('DELETE FROM characters WHERE id = ?', [id]);

    res.json({
      message: 'Character deleted successfully',
      cleaned_tables: cleaned.length,
      tables_scanned: tables.length
    });
  } catch (error) {
    // Foreign-key constraint errors after the dynamic sweep usually mean a
    // deeper FK chain than one hop (table B → table A → characters, where A
    // and B don't have ON DELETE CASCADE). Surface a specific message so
    // the operator can see which table is blocking.
    const msg = String(error?.message || '');
    if (msg.includes('FOREIGN KEY constraint')) {
      console.error('Character delete blocked by FK constraint. Stack:', error);
      return res.status(409).json({
        error: 'A foreign-key dependency prevented the delete. Check server logs for the specific table.',
        details: msg
      });
    }
    handleServerError(res, error, 'delete character');
  }
});

// Discard an item from inventory
router.post('/:id/discard-item', async (req, res) => {
  try {
    const { itemName } = req.body;
    if (!itemName) return res.status(400).json({ error: 'itemName is required' });

    const character = await dbGet('SELECT id, class, level, class_levels, inventory, spellbook_json FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });

    let inventory = safeParse(character.inventory, []);
    const idx = inventory.findIndex(i => (i.name || i).toLowerCase() === itemName.toLowerCase());

    if (idx === -1) return res.status(404).json({ error: 'Item not found in inventory' });

    const discardedName = String((inventory[idx] && inventory[idx].name) || inventory[idx] || '').toLowerCase();
    if (inventory[idx].quantity > 1) {
      inventory[idx].quantity -= 1;
    } else {
      inventory.splice(idx, 1);
    }

    // Spellbook loss (2026-11-07): discarding the last Spellbook
    // row flips a wizard's spellbook status to 'lost' — prepared
    // changes are refused from then on (the existing prepared list
    // stays castable). The status field is authoritative: a
    // gold-fork wizard has no row to discard, so their status only
    // changes via the spellbook-status route. Discarding one of
    // several Spellbooks leaves the status alone — a book remains.
    let spellbookJsonUpdate = null;
    if (discardedName === 'spellbook'
      && !inventory.some((i) => String((i && i.name) || i || '').toLowerCase() === 'spellbook')) {
      const discardWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
        ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
      if (discardWizLevel) {
        const discardState = parseSpellbookState(character.spellbook_json);
        if (discardState.status === 'intact') {
          spellbookJsonUpdate = serializeSpellbookState({ ...discardState, status: 'lost' });
        }
      }
    }

    if (spellbookJsonUpdate !== null) {
      await dbRun('UPDATE characters SET inventory = ?, spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(inventory), spellbookJsonUpdate, req.params.id]);
    } else {
      await dbRun('UPDATE characters SET inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [JSON.stringify(inventory), req.params.id]);
    }

    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (error) {
    handleServerError(res, error, 'discard item');
  }
});

// Copy a spell into the wizard's spellbook (2026-11-07).
// POST /api/character/:id/copy-spell
//   { spellName, source, scrollName?, sessionId? }
// The spell must be on the wizard list and of a level the wizard
// can cast, and not already in the book. Cost is 2 hours + 50 gp
// per spell level, both enforced server-side: the gold is checked
// and deducted in the same transaction as the book write (never a
// client-supplied balance), and the clock advances through the
// session-aware primitive (flashback sessions accumulate elapsed
// time without moving the world clock). `source` names the found
// spellbook the spell is copied from — or the literal 'scroll', in
// which case `scrollName` names the exact inventory row and the
// spell rides the row name, canonical form `Spell Scroll of
// <Spell>` (2026-11-08, D1/D4). The scroll is consumed in the same
// transaction as the book write, except for a Hedge Mage wizard of
// 3rd level or higher, whose "Nothing to Waste" keeps it (D3). A
// lost book cannot be copied into. The response reports the copy,
// the remaining gold, and whether the clock advanced (a clock
// failure never rolls the copy back — it is reported instead).
router.post('/:id/copy-spell', async (req, res) => {
  try {
    const { spellName, spell, source, scrollName, sessionId } = req.body || {};
    const copyName = typeof (spellName ?? spell) === 'string' ? String(spellName ?? spell).trim() : '';
    if (!copyName) return res.status(400).json({ error: 'spellName is required' });
    if (typeof source !== 'string' || !source.trim()) {
      return res.status(400).json({ error: 'source is required — name the found spellbook the spell is copied from, or "scroll" to copy from a spell scroll' });
    }
    const isScrollCopy = source.trim().toLowerCase() === 'scroll';
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const copyWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!copyWizLevel) {
      return res.status(400).json({ error: 'copying into a spellbook requires wizard levels' });
    }
    const copyState = parseSpellbookState(character.spellbook_json);
    if (copyState.status === 'lost') {
      return res.status(400).json({ error: 'the spellbook is lost — it cannot be copied into until it is recovered or replaced' });
    }
    const copyBookRaw = safeParse(character.known_spells, []);
    const copyBook = Array.isArray(copyBookRaw) ? copyBookRaw : [];
    const copyCanon = canonicalizeSpellName(copyName);
    const copyEntry = SPELL_DATA_ENTRIES[copyCanon];
    if (!copyEntry) {
      return res.status(400).json({ error: `spellName: "${copyName}" is not in the spell catalog` });
    }
    const copySpellLevel = Number(copyEntry.level);
    if (!Number.isFinite(copySpellLevel) || copySpellLevel < 1) {
      return res.status(400).json({ error: 'cantrips are not copied into the spellbook' });
    }
    const copyLearnable = canLearnSpell({ classId: 'wizard', level: copyWizLevel, spellName: copyName });
    if (!copyLearnable.ok) {
      return res.status(400).json({ error: `spellName: ${copyLearnable.reason}` });
    }
    if (copyBook.some((s) => canonicalizeSpellName(s) === copyCanon)) {
      return res.status(400).json({ error: `spellName: "${copyName}" is already in the spellbook` });
    }
    const copyCost = copyCostForSpellLevel(copySpellLevel);
    const copyGold = Number(character.gold_gp) || 0;
    if (copyGold < copyCost.gold) {
      return res.status(400).json({ error: `gold_gp: copying ${copyName} (level ${copySpellLevel}) costs ${copyCost.gold} gp (50 gp per spell level), the character has ${copyGold} gp` });
    }
    // Scroll copies (2026-11-08, D1/D4): the spell rides the row
    // name, canonical form `Spell Scroll of <Spell>`. The row is
    // re-read here — an exact case-insensitive match on the name the
    // client sent, never a partial lookup — the spell is parsed from
    // the ROW's name, and it must equal the requested spell
    // (canonicalized). All of it pre-tx, after every other refusal:
    // a failed copy consumes nothing.
    let copyScrollInventory = null;
    let copyScrollIndex = -1;
    let copyScrollRowName = '';
    let copyScrollConsumed = false;
    let copyScrollKeptReason = null;
    if (isScrollCopy) {
      if (typeof scrollName !== 'string' || !scrollName.trim()) {
        return res.status(400).json({ error: 'scrollName is required — name the scroll in inventory to copy from (e.g. "Spell Scroll of Fireball")' });
      }
      const copyInventoryRaw = safeParse(character.inventory, []);
      copyScrollInventory = Array.isArray(copyInventoryRaw) ? copyInventoryRaw : [];
      copyScrollIndex = copyScrollInventory.findIndex((row) => String((row && row.name) || row || '').trim().toLowerCase() === scrollName.trim().toLowerCase());
      if (copyScrollIndex === -1) {
        return res.status(400).json({ error: `scrollName: "${scrollName.trim()}" is not in the character's inventory` });
      }
      const copyScrollRow = copyScrollInventory[copyScrollIndex];
      copyScrollRowName = String((copyScrollRow && copyScrollRow.name) || copyScrollRow || '').trim();
      const copyScrollSpell = parseScrollName(copyScrollRowName);
      if (!copyScrollSpell) {
        return res.status(400).json({ error: `scroll "${copyScrollRowName}" names no spell — copy from a scroll named "Spell Scroll of <Spell>" (a level-named scroll such as "Spell Scroll (1st Level)" holds no spell to copy)` });
      }
      if (canonicalizeSpellName(copyScrollSpell) !== copyCanon) {
        return res.status(400).json({ error: `scroll "${copyScrollRowName}" holds ${copyScrollSpell}, not ${copyName}` });
      }
      // Hedge Mage L3 "Nothing to Waste" (D3): the scroll survives
      // a successful copy. Everyone else destroys it (below, in
      // the tx). The subclass read follows the arcaneRecoveryMaxSlots
      // shape: the wizard entry's subclass, else the row subclass
      // only when wizard is primary.
      const copyWizSubclass = wizardSubclassFromClassLevels(safeParse(character.class_levels, null), character.class, character.subclass);
      const copyIsHedgeMage = copyWizLevel >= 3 && getSubclass('wizard', copyWizSubclass)?.key === 'hedge_mage';
      if (copyIsHedgeMage) {
        copyScrollKeptReason = 'hedge-mage';
      } else {
        copyScrollConsumed = true;
      }
    }
    const copyNewBook = [...copyBook, copyName];
    const copyNewGold = copyGold - copyCost.gold;
    // Sibling fix (veto fixes, 2026-11-08): a copy into a replaced
    // book retires the `replaced` marker — the book now holds
    // spells beyond the replacement, so the DM prompt should stop
    // calling it a replacement. Only the marker clears; status,
    // backup, and the Arcane keys ride the parsed state untouched.
    const copyClearsReplaced = copyState.replaced != null;
    const copyTx = await db.transaction('write');
    try {
      // The SET list is built, not branched: the replaced-marker
      // clear and the scroll consumption are independent writes in
      // the same tx as the book + gold. The scroll write uses the
      // discard-item shape (quantity > 1 decrements, else the row
      // goes) — and because the write is inside this tx, a failed
      // copy never consumes a scroll.
      const copySets = ['known_spells = ?', 'gold_gp = ?'];
      const copyArgs = [JSON.stringify(copyNewBook), copyNewGold];
      if (copyClearsReplaced) {
        const copyNextState = { ...copyState };
        delete copyNextState.replaced;
        copySets.push('spellbook_json = ?');
        copyArgs.push(serializeSpellbookState(copyNextState));
      }
      if (copyScrollConsumed) {
        if (copyScrollInventory[copyScrollIndex].quantity > 1) {
          copyScrollInventory[copyScrollIndex].quantity -= 1;
        } else {
          copyScrollInventory.splice(copyScrollIndex, 1);
        }
        copySets.push('inventory = ?');
        copyArgs.push(JSON.stringify(copyScrollInventory));
      }
      await copyTx.execute({
        sql: `UPDATE characters SET ${copySets.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        args: [...copyArgs, req.params.id]
      });
      await copyTx.commit();
    } catch (txErr) {
      await copyTx.rollback();
      throw txErr;
    }
    let copyClock = null;
    let copyClockError = null;
    try {
      copyClock = await advanceTimeForSession({
        sessionId: sessionId ?? null,
        characterId: Number(req.params.id),
        hours: copyCost.hours,
        reason: 'spellbook_copy'
      });
    } catch (e) {
      copyClockError = e.message;
    }
    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      character: updated,
      copy: {
        spell: copyName,
        spellLevel: copySpellLevel,
        goldSpent: copyCost.gold,
        goldRemaining: copyNewGold,
        hoursAdvanced: copyCost.hours,
        source: source.trim(),
        replacedCleared: copyClearsReplaced,
        ...(isScrollCopy ? {
          scrollConsumed: copyScrollConsumed,
          scrollName: copyScrollRowName,
          ...(copyScrollKeptReason ? { scrollKeptReason: copyScrollKeptReason } : {}),
        } : {}),
        clockAdvanced: copyClock !== null,
        clock: copyClock?.clock ?? null,
        flashback: copyClock?.flashback ?? null,
        ...(copyClockError ? { clockError: copyClockError } : {})
      }
    });
  } catch (error) {
    handleServerError(res, error, 'copy spell into spellbook');
  }
});

// Replace a lost wizard spellbook (2026-11-07): the 2024 PHB
// pp. 165–166 "EXPANDING AND REPLACING A SPELLBOOK" sidebar.
// POST /api/character/:id/spellbook-replace
//   { source?: 'memory' | 'backup', spells?: [names], bookMaterials?: key, sessionId? }
// The book must be LOST (this route is the rules flow — the status
// route's 'intact' flip is a DM override, not this). The new book is
// derived server-side, never client-sent:
//   - source 'memory' (default): the stored PREPARED spells, plus the
//     gated Spell Mastery / Signature picks, deduped — the sidebar's
//     "transcribe the spells you have PREPARED". Unprepared old-book
//     spells are gone. Cost 1h + 10 gp per spell level per spell.
//     A `spells` list transcribes ONE SUBSET instead (V6, spell by
//     spell): each call accumulates into the new book while status
//     stays `lost`, and only flips to `intact` (with the `replaced`
//     marker) when the transcribed set covers the stored prepared
//     list. The prepared list is untouched throughout — the book is
//     being rebuilt, never pruned.
//   - source 'backup': the FULL backup contents
//     (spellbook_json.backup) — the backup IS a book, so using it
//     costs nothing (the 1h+10gp per spell was already paid when the
//     spells were copied INTO the backup). Prepared spells not in the
//     backup are dropped from the prepared list (named in the
//     response); the book is the authority. A `spells` list refuses
//     here — a subset of a backup is meaningless.
// V5 (2026-11-08; table, 2026-11-08 follow-ups): the blank book
// itself costs — the table price for the `bookMaterials` KEY sent
// ('standard', 50 gp, by default; no free-form price, no waived
// tier). Charged exactly once per book: on the first replace call
// for a book (no `replaced` marker yet, and no subset episode
// already in progress). A backup restore never charges it again,
// and neither does a later memory-path call after one (the marker
// is set — the book exists). The charged cost + materials KEY are
// stored in spellbook_json and returned in the response.
// Both paths: gold (when any) is deducted in the same transaction as
// the book write, the clock advances through the session-aware
// primitive (a clock failure never rolls the replacement back —
// reported instead, copy-route pattern), a stale banked Memorize
// Swap is cleared in the same transaction on the FIRST call of the
// episode (every live bank names an unprepared book spell — exactly
// what the sidebar says is lost; no bank can be created while the
// book is lost, so later subset calls find none), and a physical
// Spellbook inventory row is added when the character has none.
// Status returns to 'intact' and the replacement is marked in
// spellbook_json (replaced: 'prepared' | 'backup') for the DM prompt
// — on a subset call, only when the book is complete.
router.post('/:id/spellbook-replace', async (req, res) => {
  try {
    const { source, spells, bookMaterials, sessionId } = req.body || {};
    const replaceSource = source === undefined || source === null ? 'memory' : String(source).trim().toLowerCase();
    if (replaceSource !== 'memory' && replaceSource !== 'backup') {
      return res.status(400).json({ error: `source must be 'memory' or 'backup', got '${source}'` });
    }
    // V5 (table, 2026-11-08 follow-ups): the blank book's price
    // comes from the fixed SPELLBOOK_MATERIALS table — the client
    // sends only a materials KEY (absent = 'standard', 50 gp) and
    // the server derives the price. A stale `bookCost` in the body
    // is ignored like any other unknown field. Both stored keys
    // ride the charging call: `bookCost` = the gp actually charged,
    // `bookMaterials` = the KEY. Validated before any read or write.
    const replaceBookMaterialsParam = parseBookMaterialsParam(bookMaterials);
    if (!replaceBookMaterialsParam.ok) {
      return res.status(400).json({ error: replaceBookMaterialsParam.error });
    }
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const replaceWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!replaceWizLevel) {
      return res.status(400).json({ error: 'replacing the spellbook requires wizard levels' });
    }
    const replaceState = parseSpellbookState(character.spellbook_json);
    if (replaceState.status !== 'lost') {
      return res.status(400).json({ error: 'the spellbook is not lost — replacement is only for a lost book' });
    }
    const replacePreparedRaw = safeParse(character.prepared_spells, []);
    const replacePrepared = Array.isArray(replacePreparedRaw)
      ? replacePreparedRaw.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
      : [];
    const replaceAlways = alwaysPreparedSpells(replaceState, replaceWizLevel);
    const replaceBackup = replaceState.backup || [];

    // Derive the new book. Memory (full): prepared + gated
    // always-prepared picks, deduped by canonical name, prepared
    // order first. Memory (subset, V6): the named spells MERGED
    // into the book transcribed so far — empty on the first subset
    // call, because the old lost book's contents are gone, not a
    // base to merge into. Backup: the full backup contents.
    //
    // A subset episode is already in progress when the stored book
    // IS a partial transcription: no `replaced` marker yet, a book
    // cost already stored for this book, and every stored book
    // spell already prepared-or-always-prepared. Anything else
    // (fresh loss, or a new loss after a completed replacement —
    // the marker is set then) starts a fresh episode with an empty
    // base. The check is what keeps a re-loss after a completed
    // replacement from resurrecting the old book as "transcribed".
    let replaceNewBook = [];
    let replaceDroppedPrepared = [];
    let replaceDroppedAlways = [];
    let replaceIsSubset = false;
    let replaceSubset = [];
    let replaceInProgress = false;
    let replaceComplete = true;
    if (replaceSource === 'backup') {
      if (spells !== undefined && spells !== null) {
        return res.status(400).json({ error: 'spells: a backup restore transcribes the whole backup spellbook — no spell list' });
      }
      if (replaceBackup.length === 0) {
        return res.status(400).json({ error: 'no backup spellbook to restore from — copy spells into a backup first' });
      }
      const backupSeen = new Set();
      for (const name of replaceBackup) {
        const canon = canonicalizeSpellName(name);
        if (backupSeen.has(canon)) continue;
        backupSeen.add(canon);
        replaceNewBook.push(name.trim());
      }
    } else {
      if (replacePrepared.length === 0) {
        return res.status(400).json({ error: 'no prepared spells to transcribe — the replacement transcribes the spells you have prepared' });
      }
      if (spells !== undefined && spells !== null) {
        if (!Array.isArray(spells)) {
          return res.status(400).json({ error: 'spells: must be a list of spell names' });
        }
        if (spells.some((s) => typeof s !== 'string' || !s.trim())) {
          return res.status(400).json({ error: 'spells: entries must be non-empty spell names' });
        }
        replaceSubset = spells.map((s) => s.trim());
        if (replaceSubset.length === 0) {
          return res.status(400).json({ error: 'spells: nothing to transcribe — name at least one prepared spell' });
        }
        replaceIsSubset = true;
        // The subset must be a subset of what can be transcribed:
        // the stored prepared list, plus gated always-prepared
        // picks (they are prepared by the feature, not the list).
        // No duplicates, and nothing already transcribed in an
        // earlier subset call. Refuse naming the spell, pre-write.
        const replaceTranscribable = new Set(
          [...replacePrepared, ...replaceAlways].map((s) => canonicalizeSpellName(s)));
        const replaceCurrentBookRaw = safeParse(character.known_spells, []);
        const replaceCurrentBook = Array.isArray(replaceCurrentBookRaw)
          ? replaceCurrentBookRaw.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim())
          : [];
        replaceInProgress = replaceState.replaced == null
          && replaceState.bookCost != null
          && replaceCurrentBook.every((s) => replaceTranscribable.has(canonicalizeSpellName(s)));
        const replaceBase = replaceInProgress ? replaceCurrentBook : [];
        const replaceBaseSet = new Set(replaceBase.map((s) => canonicalizeSpellName(s)));
        const replaceSeen = new Set();
        for (const name of replaceSubset) {
          const canon = canonicalizeSpellName(name);
          if (!replaceTranscribable.has(canon)) {
            return res.status(400).json({ error: `spellName: "${name}" is not prepared — only prepared spells (and always-prepared picks) can be transcribed into a replacement book` });
          }
          if (replaceSeen.has(canon)) {
            return res.status(400).json({ error: `spellName: "${name}" was named twice in the replacement` });
          }
          replaceSeen.add(canon);
          if (replaceBaseSet.has(canon)) {
            return res.status(400).json({ error: `spellName: "${name}" is already transcribed into the new book` });
          }
        }
        // Merge: transcribed so far ∪ this subset, in prepared
        // order first — the same order the full path derives, so
        // the book reads the same whether it was built in one call
        // or five.
        const replaceMergedSet = new Set(
          [...replaceBase, ...replaceSubset].map((s) => canonicalizeSpellName(s)));
        for (const name of [...replacePrepared, ...replaceAlways]) {
          if (replaceMergedSet.has(canonicalizeSpellName(name))) replaceNewBook.push(name.trim());
        }
        replaceComplete = replacePrepared.every((s) => replaceMergedSet.has(canonicalizeSpellName(s)));
      } else {
        const seen = new Set();
        for (const name of [...replacePrepared, ...replaceAlways]) {
          const canon = canonicalizeSpellName(name);
          if (seen.has(canon)) continue;
          seen.add(canon);
          replaceNewBook.push(name.trim());
        }
      }
    }
    // Validate every spell transcribed THIS call: catalog, leveled,
    // wizard-list, castable level. All-or-nothing, pre-write — a
    // corrupt stored row refuses naming the spell, never partially
    // transcribes. A subset call validates the subset only (the
    // already-transcribed part was validated when it was
    // transcribed); the full/backup paths validate the whole book,
    // as before.
    const replaceCallSpells = replaceIsSubset ? replaceSubset : replaceNewBook;
    const replaceLevels = [];
    for (const name of replaceCallSpells) {
      const canon = canonicalizeSpellName(name);
      const entry = SPELL_DATA_ENTRIES[canon];
      if (!entry) {
        return res.status(400).json({ error: `spellName: "${name}" is not in the spell catalog` });
      }
      const level = Number(entry.level);
      if (!Number.isFinite(level) || level < 1) {
        return res.status(400).json({ error: `spellName: "${name}" is a cantrip — the spellbook holds leveled spells only` });
      }
      const learnable = canLearnSpell({ classId: 'wizard', level: replaceWizLevel, spellName: name });
      if (!learnable.ok) {
        return res.status(400).json({ error: `spellName: ${learnable.reason}` });
      }
      replaceLevels.push(level);
    }
    // Cost: 1h + 10 gp per spell level for the spells transcribed
    // THIS call — 0 on the backup path (paid when the spells were
    // copied into the backup) — plus the blank book's price (V5),
    // charged exactly once per book: on the first replace call for
    // a book (no `replaced` marker yet, and no subset episode
    // already in progress — a later subset call charges
    // transcription only). A backup restore never charges it again
    // (the book already exists); neither does a later memory-path
    // call after one (the marker is set).
    const replaceChargeBookCost = replaceSource === 'memory'
      && replaceState.replaced == null && !replaceInProgress;
    const replaceBookCostCharged = replaceChargeBookCost ? replaceBookMaterialsParam.cost : 0;
    const replaceTranscriptionCost = replaceSource === 'backup'
      ? { gold: 0, hours: 0 }
      : replaceCostForSpells(replaceLevels);
    const replaceCost = {
      gold: replaceTranscriptionCost.gold + replaceBookCostCharged,
      hours: replaceTranscriptionCost.hours,
    };
    const replaceGold = Number(character.gold_gp) || 0;
    if (replaceGold < replaceCost.gold) {
      return res.status(400).json({ error: replaceChargeBookCost
        ? `gold_gp: replacing the spellbook costs ${replaceCost.gold} gp (${replaceTranscriptionCost.gold} gp transcription + ${replaceBookCostCharged} gp for the blank book), the character has ${replaceGold} gp`
        : `gold_gp: replacing the spellbook costs ${replaceCost.gold} gp (10 gp per spell level), the character has ${replaceGold} gp` });
    }
    // Prepared re-derivation (backup path only): the new book is the
    // authority — prepared spells not in it are dropped, named.
    // Gated always-prepared picks not in the new book are dropped the
    // same way (they cannot be prepared from a book that does not
    // hold them); below-gate picks stay stored, inert, as before.
    let replaceNewPrepared = replacePrepared;
    // Under (A) the `replaced` marker is set only when the book is
    // complete: a partial subset call leaves status `lost` and sets
    // no marker (any stale marker from an earlier book is dropped
    // — it described the old book, not the one being rebuilt).
    // The full path and the backup path complete in one call, as
    // before.
    let replaceNextState;
    if (replaceIsSubset && !replaceComplete) {
      replaceNextState = { ...replaceState, status: 'lost' };
      delete replaceNextState.replaced;
    } else {
      replaceNextState = { ...replaceState, status: 'intact', replaced: replaceSource === 'backup' ? 'backup' : 'prepared' };
    }
    // V5: the blank-book price + materials are stored with the book
    // on the call that charges them (the first call for the book);
    // later calls leave the stored values alone. The price is the
    // table price for the key, the materials are the KEY itself —
    // both are stored on every charging call, including the
    // 'standard' default. The spread above already carries the
    // Arcane bank/flag (and any stored cost) along — only the
    // Memorize bank below is cleared, never rebuilt by hand.
    if (replaceChargeBookCost) {
      replaceNextState.bookCost = replaceBookMaterialsParam.cost;
      replaceNextState.bookMaterials = replaceBookMaterialsParam.materials;
    }
    if (replaceSource === 'backup') {
      const newBookSet = new Set(replaceNewBook.map((s) => canonicalizeSpellName(s)));
      replaceDroppedPrepared = replacePrepared.filter((s) => !newBookSet.has(canonicalizeSpellName(s)));
      replaceNewPrepared = replacePrepared.filter((s) => newBookSet.has(canonicalizeSpellName(s)));
      replaceDroppedAlways = replaceAlways.filter((s) => !newBookSet.has(canonicalizeSpellName(s)));
      if (replaceDroppedAlways.length > 0) {
        const dropSet = new Set(replaceDroppedAlways.map((s) => canonicalizeSpellName(s)));
        replaceNextState.mastery = (replaceNextState.mastery || []).filter((s) => !dropSet.has(canonicalizeSpellName(s)));
        replaceNextState.signature = (replaceNextState.signature || []).filter((s) => !dropSet.has(canonicalizeSpellName(s)));
      }
    }
    // A live bank is stale: its newSpell is by construction an
    // unprepared book spell — exactly what the sidebar says is lost.
    // Clear it in the same transaction, never applied later — on
    // the FIRST call of the episode only. A later subset call finds
    // no bank: none can be banked while the book is lost (the bank
    // route refuses it), so there is nothing left to clear or
    // report a second time.
    const replaceHadBank = pendingMemorizeSwap(character.spellbook_json) !== null;
    const replaceClearBank = replaceHadBank && !replaceInProgress;
    if (replaceClearBank) {
      replaceNextState = setPendingMemorizeSwap(replaceNextState, null);
    }
    // The new book is a physical thing: add a Spellbook row when the
    // character has none left.
    let replaceInventory = safeParse(character.inventory, []);
    if (!Array.isArray(replaceInventory)) replaceInventory = [];
    const replaceHasBookRow = replaceInventory.some((i) => String((i && i.name) || i || '').toLowerCase() === 'spellbook');
    if (!replaceHasBookRow) {
      replaceInventory = [...replaceInventory, { name: 'Spellbook', quantity: 1, source: 'spellbook-replacement' }];
    }
    const replaceNewGold = replaceGold - replaceCost.gold;
    const replaceTx = await db.transaction('write');
    try {
      await replaceTx.execute({
        sql: 'UPDATE characters SET known_spells = ?, prepared_spells = ?, gold_gp = ?, spellbook_json = ?, inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [JSON.stringify(replaceNewBook), JSON.stringify(replaceNewPrepared), replaceNewGold, serializeSpellbookState(replaceNextState), JSON.stringify(replaceInventory), req.params.id]
      });
      await replaceTx.commit();
    } catch (txErr) {
      await replaceTx.rollback();
      throw txErr;
    }
    // Clock: the backup path costs 0 hours, so there is nothing to
    // advance; the memory path advances like the copy route.
    let replaceClock = null;
    let replaceClockError = null;
    if (replaceCost.hours > 0) {
      try {
        replaceClock = await advanceTimeForSession({
          sessionId: sessionId ?? null,
          characterId: Number(req.params.id),
          hours: replaceCost.hours,
          reason: 'spellbook_replace'
        });
      } catch (e) {
        replaceClockError = e.message;
      }
    }
    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    // V6 response: `spells` is what THIS call transcribed, `bookSpells`
    // the book so far, `remainingSpells` what is still to transcribe,
    // `complete` whether the prepared list is now fully covered. The
    // full path transcribes everything at once, so spells, bookSpells,
    // and the prepared list coincide and remaining is empty. V5: the
    // blank-book charge on this call + the materials stored with the
    // book (when any).
    const replaceNewBookSet = new Set(replaceNewBook.map((s) => canonicalizeSpellName(s)));
    return res.json({
      success: true,
      character: updated,
      replacement: {
        source: replaceSource,
        spells: replaceCallSpells,
        spellLevels: replaceLevels,
        bookSpells: replaceNewBook,
        remainingSpells: replaceSource === 'memory'
          ? replacePrepared.filter((s) => !replaceNewBookSet.has(canonicalizeSpellName(s)))
          : [],
        complete: replaceSource === 'backup' ? true : replaceComplete,
        goldSpent: replaceCost.gold,
        goldRemaining: replaceNewGold,
        hoursAdvanced: replaceCost.hours,
        bookCostCharged: replaceBookCostCharged,
        ...(replaceNextState.bookMaterials ? { bookMaterials: replaceNextState.bookMaterials } : {}),
        clockAdvanced: replaceClock !== null,
        clock: replaceClock?.clock ?? null,
        flashback: replaceClock?.flashback ?? null,
        bankCleared: replaceClearBank,
        ...(replaceClearBank ? { bankClearReason: 'the banked swap named a spell from the lost book — unprepared book spells are lost with it' } : {}),
        ...(replaceDroppedPrepared.length > 0 ? { droppedPrepared: replaceDroppedPrepared } : {}),
        ...(replaceDroppedAlways.length > 0 ? { droppedAlwaysPrepared: replaceDroppedAlways } : {}),
        ...(replaceClockError ? { clockError: replaceClockError } : {})
      }
    });
  } catch (error) {
    handleServerError(res, error, 'replace spellbook');
  }
});

// Copy a spell from your own book into the backup spellbook
// (2026-11-07): the 2024 PHB pp. 165–166 "Copying the Book"
// procedure — 1h + 10 gp per spell level. POST /api/character/:id/spellbook-backup
//   { spellName | spell, bookMaterials?: key, sessionId? }
// Source is always your own book: there is no `source` field to
// name, and a found book or scroll can never fill a backup. The
// book must be intact (you cannot copy from a book you do not
// have); the spell must be in the main book and not already in the
// backup. The first copy adds a second physical Spellbook row
// (source 'spellbook-backup') — the backup is a real book, and it
// is charged its own blank-book cost (V5, 2026-11-08; table,
// 2026-11-08 follow-ups): the table price for the `bookMaterials`
// KEY sent ('standard', 50 gp, by default), on the first copy
// only — later copies charge transcription only. The backup book's
// cost is reported in the response, not stored: the stored
// `bookCost` describes the main book. Gold + clock enforced exactly
// like the copy route.
router.post('/:id/spellbook-backup', async (req, res) => {
  try {
    const { spellName, spell, bookMaterials, sessionId } = req.body || {};
    const backupName = typeof (spellName ?? spell) === 'string' ? String(spellName ?? spell).trim() : '';
    if (!backupName) return res.status(400).json({ error: 'spellName is required' });
    // V5 (table, 2026-11-08 follow-ups): the backup book's blank
    // price, same validation as the replace route — the table key
    // decides the price; a stale `bookCost` in the body is ignored.
    // Validated before any read or write.
    const backupBookMaterialsParam = parseBookMaterialsParam(bookMaterials);
    if (!backupBookMaterialsParam.ok) {
      return res.status(400).json({ error: backupBookMaterialsParam.error });
    }
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const backupWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!backupWizLevel) {
      return res.status(400).json({ error: 'copying into a backup spellbook requires wizard levels' });
    }
    const backupState = parseSpellbookState(character.spellbook_json);
    if (backupState.status === 'lost') {
      return res.status(400).json({ error: 'the spellbook is lost — spells cannot be copied from a book you do not have' });
    }
    const backupBookRaw = safeParse(character.known_spells, []);
    const backupBook = Array.isArray(backupBookRaw) ? backupBookRaw : [];
    const backupCanon = canonicalizeSpellName(backupName);
    const backupEntry = SPELL_DATA_ENTRIES[backupCanon];
    if (!backupEntry) {
      return res.status(400).json({ error: `spellName: "${backupName}" is not in the spell catalog` });
    }
    const backupSpellLevel = Number(backupEntry.level);
    if (!Number.isFinite(backupSpellLevel) || backupSpellLevel < 1) {
      return res.status(400).json({ error: 'cantrips are not copied into the backup spellbook' });
    }
    const backupLearnable = canLearnSpell({ classId: 'wizard', level: backupWizLevel, spellName: backupName });
    if (!backupLearnable.ok) {
      return res.status(400).json({ error: `spellName: ${backupLearnable.reason}` });
    }
    if (!backupBook.some((s) => canonicalizeSpellName(s) === backupCanon)) {
      return res.status(400).json({ error: `spellName: "${backupName}" is not in the spellbook — only spells in your own book can be copied into the backup` });
    }
    const backupList = backupState.backup || [];
    if (backupList.some((s) => canonicalizeSpellName(s) === backupCanon)) {
      return res.status(400).json({ error: `spellName: "${backupName}" is already in the backup spellbook` });
    }
    const backupCost = replaceCostForSpellLevel(backupSpellLevel);
    const backupGold = Number(character.gold_gp) || 0;
    // V5: the first copy creates the backup book, so it charges the
    // blank book's price on top of the transcription; later copies
    // charge transcription only. The backup book is a separate book
    // from the main one, so its cost is its own — detected here by
    // the backup being empty, not by the main book's stored cost.
    const backupChargeBookCost = backupList.length === 0;
    const backupBookCostCharged = backupChargeBookCost ? backupBookMaterialsParam.cost : 0;
    const backupTotalGold = backupCost.gold + backupBookCostCharged;
    if (backupGold < backupTotalGold) {
      return res.status(400).json({ error: backupChargeBookCost
        ? `gold_gp: copying ${backupName} into the backup (level ${backupSpellLevel}) costs ${backupTotalGold} gp (${backupCost.gold} gp transcription + ${backupBookCostCharged} gp for the blank backup book), the character has ${backupGold} gp`
        : `gold_gp: copying ${backupName} into the backup (level ${backupSpellLevel}) costs ${backupTotalGold} gp (10 gp per spell level), the character has ${backupGold} gp` });
    }
    const backupNewList = [...backupList, backupName];
    const backupNewGold = backupGold - backupTotalGold;
    let backupInventory = safeParse(character.inventory, []);
    if (!Array.isArray(backupInventory)) backupInventory = [];
    const backupHasRow = backupInventory.some((i) => String((i && i.source) || '') === 'spellbook-backup');
    if (!backupHasRow) {
      backupInventory = [...backupInventory, { name: 'Spellbook', quantity: 1, source: 'spellbook-backup' }];
    }
    const backupNext = { ...backupState, backup: backupNewList };
    const backupTx = await db.transaction('write');
    try {
      await backupTx.execute({
        sql: 'UPDATE characters SET gold_gp = ?, spellbook_json = ?, inventory = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        args: [backupNewGold, serializeSpellbookState(backupNext), JSON.stringify(backupInventory), req.params.id]
      });
      await backupTx.commit();
    } catch (txErr) {
      await backupTx.rollback();
      throw txErr;
    }
    let backupClock = null;
    let backupClockError = null;
    try {
      backupClock = await advanceTimeForSession({
        sessionId: sessionId ?? null,
        characterId: Number(req.params.id),
        hours: backupCost.hours,
        reason: 'spellbook_backup_copy'
      });
    } catch (e) {
      backupClockError = e.message;
    }
    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    return res.json({
      success: true,
      character: updated,
      backup: {
        spell: backupName,
        spellLevel: backupSpellLevel,
        backupSpells: backupNewList,
        goldSpent: backupTotalGold,
        goldRemaining: backupNewGold,
        hoursAdvanced: backupCost.hours,
        bookCostCharged: backupBookCostCharged,
        ...(backupChargeBookCost ? { bookMaterials: backupBookMaterialsParam.materials } : {}),
        clockAdvanced: backupClock !== null,
        clock: backupClock?.clock ?? null,
        flashback: backupClock?.flashback ?? null,
        ...(backupClockError ? { clockError: backupClockError } : {})
      }
    });
  } catch (error) {
    handleServerError(res, error, 'copy spell into backup spellbook');
  }
});

// Set a wizard's spellbook status (2026-11-07): the manual/DM
// lever for loss outside the discard surface (stolen, destroyed,
// or a gold-fork wizard whose book was taken). 'lost' refuses
// prepared changes; 'intact' restores them. This is a status flip
// only — the rules-based replacement flow (transcribing prepared
// spells into a new book) is the spellbook-replace route, NOT this
// route: setting 'intact' without a replacement is a DM override,
// not a rules flow.
router.post('/:id/spellbook-status', async (req, res) => {
  try {
    const { status } = req.body || {};
    if (status !== 'lost' && status !== 'intact') {
      return res.status(400).json({ error: `status must be 'lost' or 'intact', got '${status}'` });
    }
    const character = await dbGet('SELECT id, class, level, class_levels, spellbook_json FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const statusWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!statusWizLevel) {
      return res.status(400).json({ error: 'spellbook status applies to wizards only' });
    }
    const statusState = parseSpellbookState(character.spellbook_json);
    const statusNext = { ...statusState, status };
    await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [serializeSpellbookState(statusNext), req.params.id]);
    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    return res.json({ success: true, character: updated, spellbook: statusNext });
  } catch (error) {
    handleServerError(res, error, 'set spellbook status');
  }
});

// Set a wizard's always-prepared picks (2026-11-07): Spell Mastery
// (L18, up to 2) and Signature Spells (L20, up to 2). Each pick
// must already be in the book, and the level gates are enforced —
// picks stored below their gate are inert (the validator ignores
// them). Only the keys sent change; omitting a key keeps the
// stored picks. Picks are NOT added to prepared_spells by this
// route — they are prepared by the feature, and the validator
// excludes them from the cap wherever they appear.
router.post('/:id/spellbook-always-prepared', async (req, res) => {
  try {
    const { mastery, signature } = req.body || {};
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) return res.status(404).json({ error: 'Character not found' });
    const apWizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!apWizLevel) {
      return res.status(400).json({ error: 'always-prepared picks apply to wizards only' });
    }
    const apState = parseSpellbookState(character.spellbook_json);
    const apBookRaw = safeParse(character.known_spells, []);
    const apBook = Array.isArray(apBookRaw) ? apBookRaw : [];
    const apBookSet = new Set(apBook.map((s) => canonicalizeSpellName(s)));
    const checkPicks = (list, field, minLevel, maxCount) => {
      if (list === undefined) return null;
      if (!Array.isArray(list)) return `${field}: must be a list of spell names`;
      if (list.length > maxCount) return `${field}: at most ${maxCount} spells`;
      if (apWizLevel < minLevel) return `${field}: requires wizard level ${minLevel}`;
      const seen = new Set();
      for (const pick of list) {
        if (typeof pick !== 'string' || !pick.trim()) return `${field}: entries must be non-empty spell names`;
        const canon = canonicalizeSpellName(pick);
        if (seen.has(canon)) return `${field}: '${pick.trim()}' was picked twice`;
        seen.add(canon);
        if (!apBookSet.has(canon)) return `${field}: '${pick.trim()}' is not in the spellbook`;
        // Cantrips are not always-prepared picks (a cantrip that
        // reached the book through a legacy row still cannot be one).
        const pickEntry = SPELL_DATA_ENTRIES[canon];
        if (pickEntry && Number(pickEntry.level) < 1) return `${field}: '${pick.trim()}' is a cantrip — Spell Mastery / Signature Spells picks are leveled spells`;
      }
      return null;
    };
    const masteryError = checkPicks(mastery, 'mastery', 18, 2);
    if (masteryError) return res.status(400).json({ error: masteryError });
    const signatureError = checkPicks(signature, 'signature', 20, 2);
    if (signatureError) return res.status(400).json({ error: signatureError });
    if (mastery !== undefined && signature !== undefined) {
      const overlap = mastery.find((m) => signature.some((s) => canonicalizeSpellName(s) === canonicalizeSpellName(m)));
      if (overlap) return res.status(400).json({ error: `signature: '${String(overlap).trim()}' is already a Spell Mastery pick` });
    }
    const apNext = { ...apState };
    if (mastery !== undefined) apNext.mastery = mastery.map((s) => String(s).trim());
    if (signature !== undefined) apNext.signature = signature.map((s) => String(s).trim());
    await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [serializeSpellbookState(apNext), req.params.id]);
    const updated = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    return res.json({ success: true, character: updated, spellbook: apNext });
  } catch (error) {
    handleServerError(res, error, 'set always-prepared spells');
  }
});

// Memorize Spell bank (rest consolidation, 2026-11-07): the DM owns
// rests now, so the sheet banks the player's swap pick here and the
// next DM short rest validates + applies it, then clears it. Bank
// time runs the SAME validation as the deleted rest route, in the
// same order (wizard L5+ → book not lost → applyMemorizeSwap); the
// DM path re-validates at apply time, because the book may have
// changed between banking and the rest. A second bank replaces the
// first (one pending swap max — `replaced: true` says so). Banking
// never touches HP, slots, or the prepared list — it only stores
// the pick, inside spellbook_json (no new column, no migration).
// POST /api/character/:id/memorize-bank
//   { oldSpell, newSpell } | { old, new } | { memorizeSwap: { oldSpell, newSpell } } | { memorize_swap: { old, new } }
router.post('/:id/memorize-bank', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const pick = req.body?.memorizeSwap ?? req.body?.memorize_swap ?? req.body ?? {};
    const oldSpell = pick?.oldSpell ?? pick?.old ?? null;
    const newSpell = pick?.newSpell ?? pick?.new ?? null;
    const wizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!wizLevel || wizLevel < 5) {
      return res.status(400).json({ error: 'Memorize Spell requires wizard level 5' });
    }
    const state = parseSpellbookState(character.spellbook_json);
    if (state.status === 'lost') {
      return res.status(400).json({ error: 'the spellbook is lost — prepared spells cannot be changed until the spellbook is recovered or replaced' });
    }
    const always = alwaysPreparedSpells(state, wizLevel);
    const preparedRaw = safeParse(character.prepared_spells, []);
    const bookRaw = safeParse(character.known_spells, []);
    const check = applyMemorizeSwap({
      preparedList: Array.isArray(preparedRaw) ? preparedRaw : [],
      bookList: Array.isArray(bookRaw) ? bookRaw : [],
      oldSpell,
      newSpell,
      alwaysPreparedList: always,
    });
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    const hadBank = pendingMemorizeSwap(character.spellbook_json) !== null;
    const banked = {
      oldSpell: typeof oldSpell === 'string' ? oldSpell.trim() : oldSpell,
      newSpell: typeof newSpell === 'string' ? newSpell.trim() : newSpell,
    };
    const next = serializeSpellbookState(setPendingMemorizeSwap(state, banked));
    await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, req.params.id]);
    res.json({ success: true, banked, replaced: hadBank });
  } catch (error) {
    handleServerError(res, error, 'bank memorize swap');
  }
});

// Clear a banked Memorize Swap without resting (the player changed
// their mind). DELETE /api/character/:id/memorize-bank
router.delete('/:id/memorize-bank', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const hadBank = pendingMemorizeSwap(character.spellbook_json) !== null;
    if (hadBank) {
      const next = serializeSpellbookState(
        setPendingMemorizeSwap(parseSpellbookState(character.spellbook_json), null));
      await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, req.params.id]);
    }
    res.json({ success: true, cleared: hadBank });
  } catch (error) {
    handleServerError(res, error, 'clear memorize bank');
  }
});

// Arcane Recovery (wizard L1, 2026-11-08): once per Long Rest, on
// finishing a Short Rest, recover combined spell-slot levels equal
// to half the wizard level (rounded up), none 6th level or higher.
// The pick is the player's, so the sheet banks it here (inside
// spellbook_json — no new column, no migration) and the next DM
// short rest validates + applies it, then clears it and sets the
// used-flag. Bank time runs the SAME validation the DM path re-runs
// at apply time (wizard level → flag unused → total ≤ budget → no
// 6th+ → each level spent and within max); a second bank replaces
// the first (one pending recovery max — `replaced: true` says so).
// There is NO L5 gate (Arcane Recovery is a L1 feature, unlike
// Memorize Spell) and NO lost-book gate — recovery restores spent
// slots, it does not change the prepared list, so losing the book
// does not stop it. Banking never touches HP, slots, or the
// prepared list — it only stores the pick. This does NOT use the
// unguarded single-slot restore route below: that route has no
// budget, no 6th+ exclusion, and no once-per-long-rest tracking.
// POST /api/character/:id/arcane-recovery-bank
//   { slots: [2, 1] } | { levels: [2, 1] } | { arcaneRecovery: { slots: [...] } } | { arcane_recovery: { slots: [...] } }
router.post('/:id/arcane-recovery-bank', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const pick = req.body?.arcaneRecovery ?? req.body?.arcane_recovery ?? req.body ?? {};
    const banked = parsePendingArcaneRecovery(pick);
    if (!banked) {
      return res.status(400).json({ error: 'arcaneRecovery: bank a non-empty list of slot levels to recover, e.g. { slots: [2, 1] }' });
    }
    const wizLevel = wizardLevelFromClassLevels(safeParse(character.class_levels, null))
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    if (!wizLevel) {
      return res.status(400).json({ error: 'Arcane Recovery requires wizard level 1' });
    }
    const state = parseSpellbookState(character.spellbook_json);
    if (state.arcaneRecoveryUsed === true) {
      return res.status(400).json({ error: 'Arcane Recovery has already been used — it returns after your next long rest' });
    }
    const budget = arcaneRecoveryBudget(wizLevel);
    const maxSlots = arcaneRecoveryMaxSlots(safeParse(character.class_levels, null), wizLevel, character.subclass);
    const usedSlots = safeParse(character.spell_slots_used, {});
    const check = applyArcaneRecovery({
      usedSlots: usedSlots && typeof usedSlots === 'object' ? usedSlots : {},
      maxSlots,
      bankedLevels: banked.slots,
      budget,
    });
    if (!check.ok) {
      return res.status(400).json({ error: check.error });
    }
    const hadBank = pendingArcaneRecovery(character.spellbook_json) !== null;
    const next = serializeSpellbookState(setPendingArcaneRecovery(state, banked));
    await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, req.params.id]);
    res.json({ success: true, banked, replaced: hadBank });
  } catch (error) {
    handleServerError(res, error, 'bank arcane recovery');
  }
});

// Clear a banked Arcane Recovery without resting (the player changed
// their mind). DELETE /api/character/:id/arcane-recovery-bank
router.delete('/:id/arcane-recovery-bank', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    const hadBank = pendingArcaneRecovery(character.spellbook_json) !== null;
    if (hadBank) {
      const next = serializeSpellbookState(
        setPendingArcaneRecovery(parseSpellbookState(character.spellbook_json), null));
      await dbRun('UPDATE characters SET spellbook_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [next, req.params.id]);
    }
    res.json({ success: true, cleared: hadBank });
  } catch (error) {
    handleServerError(res, error, 'clear arcane recovery bank');
  }
});

// Get character's spell slots (max and used)
router.get('/spell-slots/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get max spell slots based on class and level (subclass-aware:
    // warden/scholar slots need the casting subclass).
    const spellSlots = getSpellSlots(character.class, character.level, character.subclass);
    const spellSlotsUsed = safeParse(character.spell_slots_used, {});

    res.json({
      max: spellSlots,
      used: spellSlotsUsed,
      class: character.class,
      level: character.level
    });
  } catch (error) {
    handleServerError(res, error, 'fetch spell slots');
  }
});

// Use a spell slot
router.post('/spell-slots/:id/use', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const maxSlots = getSpellSlots(character.class, character.level, character.subclass);
    const usedSlots = safeParse(character.spell_slots_used, {});

    const maxForLevel = maxSlots[level] || 0;
    const usedForLevel = usedSlots[level] || 0;

    if (maxForLevel === 0) {
      return res.status(400).json({ error: `You don't have level ${level} spell slots` });
    }

    if (usedForLevel >= maxForLevel) {
      return res.status(400).json({ error: `No level ${level} spell slots remaining` });
    }

    usedSlots[level] = usedForLevel + 1;

    await dbRun('UPDATE characters SET spell_slots_used = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(usedSlots), req.params.id]);

    res.json({
      success: true,
      level,
      remaining: maxForLevel - usedSlots[level],
      max: maxForLevel
    });
  } catch (error) {
    handleServerError(res, error, 'use spell slot');
  }
});

// Restore a spell slot (for abilities like Arcane Recovery)
router.post('/spell-slots/:id/restore', async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || level < 1 || level > 9) {
      return res.status(400).json({ error: 'Invalid spell level (1-9)' });
    }

    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const maxSlots = getSpellSlots(character.class, character.level, character.subclass);
    const usedSlots = safeParse(character.spell_slots_used, {});

    const maxForLevel = maxSlots[level] || 0;
    const usedForLevel = usedSlots[level] || 0;

    if (usedForLevel <= 0) {
      return res.status(400).json({ error: `No used level ${level} slots to restore` });
    }

    usedSlots[level] = usedForLevel - 1;

    await dbRun('UPDATE characters SET spell_slots_used = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [JSON.stringify(usedSlots), req.params.id]);

    res.json({
      success: true,
      level,
      remaining: maxForLevel - usedSlots[level],
      max: maxForLevel
    });
  } catch (error) {
    handleServerError(res, error, 'restore spell slot');
  }
});

// Reset character XP to 0
router.post('/reset-xp/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun('UPDATE characters SET experience = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json({
      message: 'XP reset to 0',
      character: updatedCharacter
    });
  } catch (error) {
    handleServerError(res, error, 'reset XP');
  }
});

// Grant XP to a character
router.post('/grant-xp/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return notFound(res, 'Character');
    }

    const { amount } = req.body;
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return validationError(res, 'Amount must be a positive number');
    }

    const newExperience = character.experience + amount;
    await dbRun('UPDATE characters SET experience = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newExperience, req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    const canLevel = canLevelUp(updatedCharacter.level, newExperience);

    res.json({
      character: updatedCharacter,
      xpGranted: amount,
      newTotal: newExperience,
      canLevelUp: canLevel
    });
  } catch (error) {
    handleServerError(res, error, 'grant XP');
  }
});

// Full character reset (XP, HP, inventory, clear adventures)
router.post('/full-reset/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Reset character stats to starting values
    await dbRun(`
      UPDATE characters
      SET experience = 0,
          current_hp = max_hp,
          gold_cp = starting_gold_cp,
          gold_sp = starting_gold_sp,
          gold_gp = starting_gold_gp,
          inventory = '[]',
          debuffs = '[]',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    // Clear all adventures for this character
    await dbRun('DELETE FROM adventures WHERE character_id = ?', [req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json({
      message: 'Character fully reset',
      character: updatedCharacter
    });
  } catch (error) {
    handleServerError(res, error, 'full reset character');
  }
});

// Check if character can level up
router.get('/can-level-up/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const currentLevel = character.level;
    const currentXP = character.experience;
    const canLevel = canLevelUp(currentLevel, currentXP);
    const xpNeeded = getXPToNextLevel(currentLevel);

    res.json({
      canLevelUp: canLevel,
      currentLevel,
      currentXP,
      xpNeeded,
      xpRemaining: xpNeeded ? xpNeeded - currentXP : 0
    });
  } catch (error) {
    handleServerError(res, error, 'check level up');
  }
});

// Get level-up information (what choices need to be made)
router.get('/level-up-info/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Parse class_levels for multiclass support
    let classLevels = character.class_levels ? safeParse(character.class_levels, null) : null;

    // If no class_levels, create from legacy single-class data
    if (!classLevels) {
      classLevels = [{
        class: character.class,
        level: character.level,
        subclass: character.subclass
      }];
    }

    const totalLevel = getTotalLevel(classLevels);
    const newTotalLevel = totalLevel + 1;

    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Character is already at maximum level' });
    }

    if (!canLevelUp(totalLevel, character.experience)) {
      return res.status(400).json({
        error: 'Character does not have enough XP to level up',
        currentXP: character.experience,
        xpNeeded: getXPToNextLevel(totalLevel)
      });
    }

    const abilityScores = safeParse(character.ability_scores, {});

    // Build class options for level up
    const classOptions = [];

    // Option 1: Continue with existing classes
    for (const classInfo of classLevels) {
      const className = classInfo.class.toLowerCase();
      const currentClassLevel = classInfo.level;
      const newClassLevel = currentClassLevel + 1;

      if (newClassLevel <= 20) {
        const newFeatures = getClassFeatures(className, newClassLevel);
        const hitDie = HIT_DICE[className] || 8;
        const conMod = Math.floor((abilityScores.con - 10) / 2);

        classOptions.push({
          type: 'existing',
          class: classInfo.class.charAt(0).toUpperCase() + classInfo.class.slice(1),
          currentLevel: currentClassLevel,
          newLevel: newClassLevel,
          subclass: classInfo.subclass,
          newFeatures,
          choices: {
            needsSubclass: needsSubclassSelection(className, newClassLevel) && !classInfo.subclass,
            needsASI: hasASI(className, newClassLevel),
            newCantrips: Math.max(0, getCantripsKnown(className, newClassLevel, classInfo.subclass) - getCantripsKnown(className, currentClassLevel, classInfo.subclass)),
            newSpellsKnown: (() => {
              const current = getSpellsKnown(className, currentClassLevel, classInfo.subclass);
              const next = getSpellsKnown(className, newClassLevel, classInfo.subclass);
              // Null-tolerant: a class that starts casting at this
              // level (warden/scholar casting subclass at 3rd)
              // reads null before and a count after — the new
              // spells are the whole count, not 0.
              return Math.max(0, (next ?? 0) - (current ?? 0));
            })()
          },
          hpGain: {
            hitDie,
            conMod,
            average: Math.floor(hitDie / 2) + 1 + conMod,
            minimum: 1 + conMod,
            maximum: hitDie + conMod
          },
          subclassLevel: SUBCLASS_LEVELS[className]
        });
      }
    }

    // Option 2: Multiclass into new classes (all available —
    // prerequisites removed 2026-11-08, all classes multiclass freely)
    const availableMulticlasses = getAvailableMulticlassOptions(classLevels);

    // Always show multiclass options — every class is offered (minus
    // held ones); deferred classes stay listed but flagged
    // pcCreatable false, and the POST /level-up guard enforces it.
    for (const newClass of availableMulticlasses) {
      const newFeatures = getClassFeatures(newClass, 1);
      const hitDie = HIT_DICE[newClass] || 8;
      const conMod = Math.floor((abilityScores.con - 10) / 2);

      classOptions.push({
        type: 'multiclass',
        class: newClass.charAt(0).toUpperCase() + newClass.slice(1),
        currentLevel: 0,
        newLevel: 1,
        subclass: null,
        // MVP player-class scope (Zach, 2026-11-08): a deferred
        // class stays offered but flagged — never removed — so a
        // future client can gray it instead of hiding it. The
        // POST /level-up guard below is the enforcement; this flag
        // is display only.
        pcCreatable: isClassPcCreatable(newClass),
        pcCreatableNote: isClassPcCreatable(newClass) ? null : MVP_DEFERRED_CLASS_NOTE,
        newFeatures,
        // Magus (2026-11-06, item 10; prerequisites removed
        // 2026-11-08): the per-society requirement fields are gone
        // — all classes multiclass freely. What stays: the
        // proficiencies gained on multiclassing (MULTICLASS_GRANT),
        // and the 0 multiclass spell slot contribution (the source
        // states no slot rule — see getMulticlassSpellSlots). The
        // subclass picker still requires a society at class level 1
        // (needsSubclassSelection above).
        ...(newClass === 'magus' ? {
          multiclassGrant: MULTICLASS_GRANT,
        } : {}),
        // Blood Hunter (2024 Rules, 2026-11-06; prerequisites
        // removed 2026-11-08): proficiencies gained on
        // multiclassing, per the PDF. The requirement fields are
        // gone — all classes multiclass freely.
        ...(newClass === 'blood_hunter' ? {
          multiclassGrant: BLOOD_HUNTER_MULTICLASS_GRANT,
        } : {}),
        // Scholar / Pugilist / Warlord grants (2026-11-08,
        // multiclass removal): the grants existed but were never
        // surfaced on this route — they ride the same arm shape as
        // magus / blood_hunter. Grants are display-only (the POST
        // never consumes multiclassGrant). Warden / spellshot
        // (grant null) and duelist / blackguard (no grant printed)
        // stay absent — not invented.
        ...(newClass === 'scholar' ? {
          multiclassGrant: SCHOLAR_MULTICLASS_GRANT,
        } : {}),
        ...(newClass === 'pugilist' ? {
          multiclassGrant: PUGILIST_MULTICLASS_GRANT,
        } : {}),
        ...(newClass === 'warlord' ? {
          multiclassGrant: WARLORD_MULTICLASS_GRANT,
        } : {}),
        choices: {
          needsSubclass: needsSubclassSelection(newClass, 1),
          needsASI: hasASI(newClass, 1),
          newCantrips: getCantripsKnown(newClass, 1),
          // V8 (2026-11-07, spellbook replacement): a multiclass into
          // wizard starts a spellbook of SPELLBOOK_START_SIZE (6) —
          // getSpellsKnown returns null for prepared casters by design,
          // so the seed rides here, not in getSpellsKnown (its null is
          // load-bearing in Stage 4/6, which route known vs prepared
          // off it). Every other class keeps the known-count-or-0.
          newSpellsKnown: newClass === 'wizard' ? SPELLBOOK_START_SIZE : (getSpellsKnown(newClass, 1) || 0)
        },
        hpGain: {
          hitDie,
          conMod,
          average: Math.floor(hitDie / 2) + 1 + conMod,
          minimum: 1 + conMod,
          maximum: hitDie + conMod
        },
        subclassLevel: SUBCLASS_LEVELS[newClass]
      });
    }

    // Get proficiency bonus change (based on total level)
    const currentProficiency = PROFICIENCY_BONUS[totalLevel];
    const newProficiency = PROFICIENCY_BONUS[newTotalLevel];
    const proficiencyIncreased = newProficiency > currentProficiency;

    // Calculate multiclass spell slots if applicable
    const multiclassSpellSlots = getMulticlassSpellSlots(classLevels);

    // Progression decisions (Phase 5): theme tier auto-unlocks + ancestry feat choices
    // gated on TOTAL character level (not per-class level).
    const progressionDecisions = await computeProgressionDecisions(req.params.id, newTotalLevel);

    res.json({
      currentLevel: totalLevel,
      newLevel: newTotalLevel,
      classLevels,
      classOptions,
      canMulticlass: true, // Always allow multiclass selection — prerequisites removed 2026-11-08, all classes multiclass freely
      multiclassSpellSlots,
      proficiencyBonus: {
        current: currentProficiency,
        new: newProficiency,
        increased: proficiencyIncreased
      },
      progression: progressionDecisions,
      // Legacy fields for backward compatibility
      className: character.class,
      subclass: character.subclass,
      newFeatures: classOptions.length > 0 ? classOptions[0].newFeatures : [],
      choices: classOptions.length > 0 ? classOptions[0].choices : {},
      hpGain: classOptions.length > 0 ? classOptions[0].hpGain : {},
      subclassLevel: SUBCLASS_LEVELS[character.class.toLowerCase()]
    });
  } catch (error) {
    handleServerError(res, error, 'get level-up info');
  }
});

/**
 * Helper for /level-up-info — returns the progression decisions that need to
 * happen (or auto-apply) when the character crosses to `newTotalLevel`.
 *
 * Theme tier thresholds: L5, L11, L17 — auto-unlock (1 ability per tier per
 * theme, no player choice). Returned as { tier, ability } for UI display.
 *
 * Ancestry feat thresholds: L3, L7, L13, L18 — require a player pick from
 * 3 options. Returned as { tier, options[] } so the UI can render a picker.
 *
 * Returns null-valued fields if the character has no theme/ancestry set,
 * or if the threshold isn't crossed / an unlock already exists at that tier.
 */
async function computeProgressionDecisions(characterId, newTotalLevel) {
  const themeTierThresholds = { 5: 5, 11: 11, 17: 17 };
  const ancestryFeatThresholds = { 3: 3, 7: 7, 13: 13, 18: 18 };

  const result = {
    theme_tier_unlock: null,
    ancestry_feat_tier: null
  };

  // Theme tier (auto-unlock): only fires at exactly L5, L11, or L17.
  if (themeTierThresholds[newTotalLevel]) {
    const tier = newTotalLevel;
    const charTheme = await dbGet(
      'SELECT theme_id FROM character_themes WHERE character_id = ?',
      [characterId]
    );
    if (charTheme) {
      // Already unlocked at this tier? Skip.
      const existing = await dbGet(
        'SELECT id FROM character_theme_unlocks WHERE character_id = ? AND tier = ?',
        [characterId, tier]
      );
      if (!existing) {
        const ability = await dbGet(
          `SELECT ta.id, ta.ability_name, ta.ability_description, ta.mechanics, ta.flavor_text, t.name as theme_name
           FROM theme_abilities ta JOIN themes t ON ta.theme_id = t.id
           WHERE ta.theme_id = ? AND ta.tier = ? AND ta.path_variant IS NULL
           LIMIT 1`,
          [charTheme.theme_id, tier]
        );
        if (ability) {
          result.theme_tier_unlock = {
            tier,
            theme_id: charTheme.theme_id,
            theme_name: ability.theme_name,
            tier_ability_id: ability.id,
            ability_name: ability.ability_name,
            ability_description: ability.ability_description,
            mechanics: ability.mechanics,
            flavor_text: ability.flavor_text
          };
        }
      }
    }
  }

  // Ancestry feat (player choice of 3): fires at L3, L7, L13, L18.
  if (ancestryFeatThresholds[newTotalLevel]) {
    const tier = newTotalLevel;
    // Find the character's ancestry list from their existing L1 feat (set at creation)
    const existingAnyFeat = await dbGet(
      `SELECT af.list_id FROM character_ancestry_feats caf
       JOIN ancestry_feats af ON caf.feat_id = af.id
       WHERE caf.character_id = ? LIMIT 1`,
      [characterId]
    );
    if (existingAnyFeat) {
      const listId = existingAnyFeat.list_id;
      const tierExisting = await dbGet(
        'SELECT id FROM character_ancestry_feats WHERE character_id = ? AND tier = ?',
        [characterId, tier]
      );
      if (!tierExisting) {
        const options = await dbAll(
          `SELECT id, choice_index, feat_name, description, mechanics, flavor_text
           FROM ancestry_feats
           WHERE list_id = ? AND tier = ?
           ORDER BY choice_index`,
          [listId, tier]
        );
        if (options.length > 0) {
          result.ancestry_feat_tier = {
            tier,
            list_id: listId,
            options
          };
        }
      }
    }
  }

  return result;
}

// Execute level up with choices
router.post('/level-up/:id', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Parse existing class_levels or create from legacy data
    let classLevels = character.class_levels ? safeParse(character.class_levels, null) : null;
    if (!classLevels) {
      classLevels = [{
        class: character.class,
        level: character.level,
        subclass: character.subclass
      }];
    }

    const totalLevel = getTotalLevel(classLevels);
    const newTotalLevel = totalLevel + 1;

    // Validate level up is possible
    if (newTotalLevel > 20) {
      return res.status(400).json({ error: 'Character is already at maximum level' });
    }

    if (!canLevelUp(totalLevel, character.experience)) {
      return res.status(400).json({
        error: 'Character does not have enough XP to level up',
        currentXP: character.experience,
        xpNeeded: getXPToNextLevel(totalLevel)
      });
    }

    // Get choices from request body
    const {
      selectedClass, // Which class to level up in (for multiclassing)
      hpRoll, // 'average' or 'roll' with rollValue
      rollValue,
      subclass,
      asiChoice, // { type: 'asi', increases: { str: 1, dex: 1 } } or { type: 'feat', feat: 'Alert' }
      newCantrips, // array of cantrip names to learn
      newSpells, // array of spell names to learn
      swapSpell, // { old: string, new: string } - swap one spell at level-up: a known spell for known casters, a prepared spell for prepared casters (PHB: one prepared spell per Long Rest)
      // Phase 5: progression choices at level-up
      ancestryFeatId // L3/L7/L13/L18 — the feat.id chosen from the 3 options
    } = req.body;

    // Determine which class we're leveling up
    const targetClass = selectedClass || character.class;
    const targetClassName = targetClass.toLowerCase();

    // Check if this is a multiclass (new class) or existing class
    const existingClassIndex = classLevels.findIndex(c => c.class.toLowerCase() === targetClassName);
    const isMulticlass = existingClassIndex === -1;

    // Parse ability scores for HP calculations
    const abilityScores = safeParse(character.ability_scores, {});

    // Note: multiclass prerequisites were REMOVED 2026-11-08 (Zach:
    // all classes multiclass freely) — there is nothing to enforce here.

    // Determine the new class level (used for subclass-required validation below
    // — mutations to classLevels happen only AFTER validation passes)
    const newClassLevel = isMulticlass ? 1 : classLevels[existingClassIndex].level + 1;

    // MVP player-class scope (Zach, 2026-11-08): multiclassing INTO a
    // deferred class is refused with 400 — before the subclass-required
    // 422 below, so the refusal names the class, not the missing
    // subclass. Leveling up IN an already-held class is not refused
    // (no such PC exists — fresh build — and the prepared-spell
    // re-checks below govern it). A deferred subclass pick is refused
    // the same way (Q12): the newly-sent subclass is judged against
    // the target class, so a fighter 2->3 picking Monster Hunter and
    // a monk 2->3 picking Warrior of Waves both 400 here.
    if (isMulticlass) {
      const levelUpClassRefusal = classScopeRefusal(targetClassName);
      if (levelUpClassRefusal) {
        return res.status(400).json({ error: levelUpClassRefusal });
      }
    }
    if (subclass) {
      const levelUpSubclassRefusal = subclassScopeRefusal(targetClassName, subclass);
      if (levelUpSubclassRefusal) {
        return res.status(400).json({ error: levelUpSubclassRefusal });
      }
    }

    // Validate subclass is provided when the target class requires one at this
    // level AND the character doesn't already have one for this class. This
    // fires when a class reaches its subclass level without one — e.g. a
    // Fighter at L2 leveling to L3 must pick now (2024: subclass at 3rd, not
    // at creation) — and for multiclassing into a level-1-subclass class
    // (magus/scholar) at class level 1. Multiclassing into a 3rd-level
    // class (e.g. Cleric) at class level 1 does NOT require one yet.
    const existingSubclass = isMulticlass ? null : classLevels[existingClassIndex].subclass;
    if (needsSubclassSelection(targetClassName, newClassLevel) && !subclass && !existingSubclass) {
      return res.status(422).json({
        error: `Subclass selection required: ${targetClass} must choose a subclass at level ${newClassLevel}`,
        targetClass,
        newClassLevel
      });
    }

    // Progression decisions at this level-up (Phase 5):
    //   - Theme tier auto-unlock at L5/L11/L17 (no choice, just inserts a row)
    //   - Ancestry feat pick at L3/L7/L13/L18 (requires ancestryFeatId from payload)
    // If the character has no theme (shouldn't happen for post-v1.0.4 characters)
    // or no prior ancestry feat, these decisions silently skip.
    const progressionDecisions = await computeProgressionDecisions(req.params.id, newTotalLevel);

    // Validate that ancestryFeatId was provided when a tier crossing demands one,
    // AND that the provided feat ID is actually one of the offered options.
    if (progressionDecisions.ancestry_feat_tier) {
      if (!ancestryFeatId) {
        return res.status(422).json({
          error: `Ancestry feat selection required at level ${newTotalLevel}`,
          ancestryFeatTier: progressionDecisions.ancestry_feat_tier
        });
      }
      const validIds = new Set(progressionDecisions.ancestry_feat_tier.options.map(o => o.id));
      if (!validIds.has(ancestryFeatId)) {
        return res.status(400).json({
          error: 'Provided ancestryFeatId is not a valid option for this tier',
          validOptions: progressionDecisions.ancestry_feat_tier.options.map(o => o.id)
        });
      }
    }

    // Apply class level / subclass mutations now that validation has passed
    if (isMulticlass) {
      classLevels.push({
        class: targetClass,
        level: 1,
        subclass: subclass || null
      });
    } else {
      classLevels[existingClassIndex].level = newClassLevel;
      if (subclass && !classLevels[existingClassIndex].subclass) {
        classLevels[existingClassIndex].subclass = subclass;
      }
    }

    // Calculate HP gain based on the class being leveled
    const hitDie = HIT_DICE[targetClassName] || 8;
    let conMod = Math.floor((abilityScores.con - 10) / 2);

    let hpGain;
    if (hpRoll === 'roll' && rollValue !== undefined) {
      // Validate roll value
      if (rollValue < 1 || rollValue > hitDie) {
        return res.status(400).json({ error: `Invalid HP roll. Must be between 1 and ${hitDie}` });
      }
      hpGain = Math.max(1, rollValue + conMod); // Minimum 1 HP
    } else {
      // Use average (rounded up)
      hpGain = Math.floor(hitDie / 2) + 1 + conMod;
    }

    // Handle ASI if applicable (based on the class being leveled)
    let newAbilityScores = { ...abilityScores };
    let pendingFeatsJson = null; // Set when feat-instead-of-ASI path is taken
    if (hasASI(targetClassName, newClassLevel) && asiChoice) {
      if (asiChoice.type === 'asi' && asiChoice.increases) {
        // Apply ability score increases (max 20 per ability)
        let totalIncrease = 0;
        for (const [ability, increase] of Object.entries(asiChoice.increases)) {
          if (increase > 0 && newAbilityScores[ability] !== undefined) {
            const newValue = Math.min(20, newAbilityScores[ability] + increase);
            const actualIncrease = newValue - newAbilityScores[ability];
            newAbilityScores[ability] = newValue;
            totalIncrease += actualIncrease;
          }
        }
        // Validate total increase is 2 or less
        if (totalIncrease > 2) {
          return res.status(400).json({ error: 'ASI increases cannot exceed 2 total points' });
        }

        // When CON increases via ASI, apply its HP impact across all levels:
        //   • THIS level's hpGain was computed above with the OLD conMod, so it
        //     needs +modDiff to reflect the new mod at this level.
        //   • All PRIOR levels (newTotalLevel - 1 of them) each need +modDiff
        //     retroactively — per 5e PHB rules, CON increases boost HP for
        //     every level already taken, not just future ones.
        // Combined: +(modDiff × newTotalLevel) HP added to hpGain, which is
        // added to max_hp below.
        if (asiChoice.increases.con) {
          const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
          if (newConMod > conMod) {
            hpGain += (newConMod - conMod) * newTotalLevel;
          }
        }
      } else if (asiChoice.type === 'feat' && asiChoice.feat) {
        // Feat-instead-of-ASI: append the chosen feat to the character's feats
        // JSON array using the same shape as the character creation wizard
        // (so downstream consumers — character sheet, DM prompt — see a unified list).
        const existingFeats = safeParse(character.feats, []);
        existingFeats.push({
          key: asiChoice.feat,
          name: asiChoice.featName || asiChoice.feat,
          abilityChoice: asiChoice.featAbilityChoice || null,
          choices: asiChoice.featChoices || null,
          acquiredAtLevel: newTotalLevel
        });

        // Some feats grant +1 to a chosen ability score (half-ASI feats like
        // Resilient/Actor/Observant). If the feat provides one, apply it now.
        if (asiChoice.featAbilityChoice && newAbilityScores[asiChoice.featAbilityChoice] !== undefined) {
          const ab = asiChoice.featAbilityChoice;
          newAbilityScores[ab] = Math.min(20, newAbilityScores[ab] + 1);
          // Same CON retroactivity rule as the ASI path
          if (ab === 'con') {
            const newConMod = Math.floor((newAbilityScores.con - 10) / 2);
            if (newConMod > conMod) {
              hpGain += (newConMod - conMod) * newTotalLevel;
            }
          }
        }

        // Stash for the transactional write phase below
        pendingFeatsJson = JSON.stringify(existingFeats);
      }
    }

    // Handle subclass selection for the target class
    let newSubclass = character.subclass;
    if (needsSubclassSelection(targetClassName, newClassLevel) && subclass) {
      // classLevels was already updated with the subclass above; just set the
      // legacy top-level subclass field if this is the primary class
      if (targetClassName === character.class.toLowerCase()) {
        newSubclass = subclass;
      }
    }

    // Pre-compute cantrip / spell updates (no DB writes yet — transactional phase below)
    let pendingCantripsJson = null;
    let pendingSpellsJson = null;
    let pendingPreparedSpellsJson = null;

    if (newCantrips && Array.isArray(newCantrips) && newCantrips.length > 0) {
      const existingCantrips = safeParse(character.known_cantrips, []);
      pendingCantripsJson = JSON.stringify([...new Set([...existingCantrips, ...newCantrips])]);
    }

    // swapSpell routing (2026-11-06, ranger PHB reconciliation):
    // the PHB lets a ranger swap one PREPARED spell per Long Rest,
    // not a known spell — and the same holds for every prepared
    // caster (bard, cleric, druid, paladin, wizard, artificer,
    // blackguard). The old code always edited known_spells, so a
    // swap on a prepared caster silently edited the wrong column:
    // the old spell stayed prepared and the new one landed in
    // known_spells, which nothing reads for a prepared caster.
    // Route by the leveling class: prepared casters swap in
    // prepared_spells, known casters in known_spells. Multiclassing
    // INTO a class keeps the old known-spells path — the shared
    // prepared_spells column is governed by the primary class's
    // editor (same rule as the PUT cap blocks). No validation is
    // added here, matching the known-spell swap path (a 1-for-1
    // replacement; the level-up cap re-checks below still bound
    // the stored list).
    const swapTargetIsPrepared = !isMulticlass
      && getSpellsPrepared(targetClassName, newClassLevel, 0, subclass || existingSubclass) !== null;

    // Wizard spellbook growth (2026-11-07): leveling IN wizard adds
    // at most 2 spells to the book, each a wizard-list spell of a
    // castable level, not already in the book. Multiclassing INTO
    // wizard seeds the book from the same list/level checks, exactly
    // 6 — a 1st-level wizard's book is 6 spells (settled 2026-11-07:
    // a multiclass wizard is wizard level 1, so the book is a
    // 1st-level wizard's book; V4, 2026-11-08, made the 6 exact, not
    // a max). An empty/absent seed is allowed (V3, 2026-11-08) — the
    // wizard starts with an empty book and copies spells in from
    // found books; the write path below leaves known_spells untouched
    // when there is nothing to write. Other classes are untouched:
    // their newSpells still land in known_spells exactly as before
    // (flagged sibling defect — see the spellbook notes), so no other
    // caster's behavior changes. All refusals here are pre-write, so
    // the level is unchanged.
    const levelUpIsWizard = targetClassName === 'wizard';
    const levelUpBookRaw = safeParse(character.known_spells, []);
    const levelUpBookList = Array.isArray(levelUpBookRaw) ? levelUpBookRaw : [];
    if (levelUpIsWizard && newSpells && Array.isArray(newSpells) && newSpells.length > 0) {
      const levelUpAdds = validateBookAdds({
        spells: newSpells,
        bookList: levelUpBookList,
        wizardLevel: newClassLevel,
        maxCount: isMulticlass ? 6 : 2,
        // V4: the multiclass seed is exactly 6. In-class adds pass
        // no floor (max-only, as before): the client sends no
        // newSpells at all for an in-class wizard level-up (the
        // envelope says newSpellsKnown 0 for a prepared caster, so
        // the +2 picker never renders), so an exact-2 floor here
        // would only constrain hand-built requests while the real
        // client path sends 0 — the in-class +2 picker is a client
        // gap to fix, not a server validation change. Recorded,
        // not fixed.
        minCount: isMulticlass ? 6 : null,
      });
      if (!levelUpAdds.ok) {
        return res.status(400).json({ error: levelUpAdds.errors.join('; ') });
      }
    }
    // Savant free-adds (2026-11-07): a separate level-up field,
    // `savantSpells`. Due only at 3rd (two school spells ≤ L2) and
    // at each new spell-slot level (one school spell); the school
    // comes from the (possibly newly chosen) subclass, and the
    // spells are checked against the catalog school, not invented.
    // Absent when nothing is due — the frees are optional ("you can
    // add"), so an unclaimed free is skipped, never refused.
    let levelUpSavantSpells = [];
    if (levelUpIsWizard && req.body.savantSpells !== undefined) {
      const savantRaw = req.body.savantSpells;
      if (!Array.isArray(savantRaw)) {
        return res.status(400).json({ error: 'savantSpells: must be a list of spell names' });
      }
      const effectiveSubclass = subclass || existingSubclass || null;
      const savantCheck = validateSavantSpells({
        spells: savantRaw,
        subclass: effectiveSubclass,
        newClassLevel,
        bookList: levelUpBookList,
      });
      if (!savantCheck.ok) {
        return res.status(400).json({ error: savantCheck.errors.join('; ') });
      }
      levelUpSavantSpells = savantRaw;
      if (newSpells && Array.isArray(newSpells) && newSpells.length > 0) {
        const savantOverlap = levelUpSavantSpells.find((s) => newSpells.some((n) => canonicalizeSpellName(n) === canonicalizeSpellName(s)));
        if (savantOverlap) {
          return res.status(400).json({ error: `savantSpells: '${savantOverlap}' is already being added as a level-up spell — a spell cannot be both a +2 add and a Savant free-add` });
        }
      }
    }

    if (newSpells && Array.isArray(newSpells) && newSpells.length > 0) {
      const existingSpells = safeParse(character.known_spells, []);
      let updatedSpells = [...existingSpells];
      if (swapSpell && swapSpell.old && swapSpell.new && !levelUpIsWizard) {
        updatedSpells = updatedSpells.filter(s => s !== swapSpell.old);
      }
      updatedSpells = [...new Set([...updatedSpells, ...newSpells])];
      pendingSpellsJson = JSON.stringify(updatedSpells);
    } else if (swapSpell && swapSpell.old && swapSpell.new) {
      if (swapTargetIsPrepared) {
        const existingPrepared = safeParse(character.prepared_spells, []);
        const updatedPrepared = (Array.isArray(existingPrepared) ? existingPrepared : []).filter(s => s !== swapSpell.old);
        updatedPrepared.push(swapSpell.new);
        pendingPreparedSpellsJson = JSON.stringify(updatedPrepared);
      } else {
        const existingSpells = safeParse(character.known_spells, []);
        const updatedSpells = existingSpells.filter(s => s !== swapSpell.old);
        updatedSpells.push(swapSpell.new);
        pendingSpellsJson = JSON.stringify(updatedSpells);
      }
    }

    // Wizard level-up swap + Savant merge (2026-11-07). The old
    // combined path removed the swapped spell from known_spells —
    // for a wizard that tears a page out of the book. A wizard's
    // level-up swap is a prepared-spell swap (same routing as the
    // swap-only branch), so the combined case sets it here instead.
    // Savant frees merge into the pending book. Then the swap's new
    // spell is validated against the book as it stands after this
    // level-up's adds — a wizard can only prepare spells from the
    // book. Other classes keep the old paths untouched.
    if (levelUpSavantSpells.length > 0) {
      const savantBase = pendingSpellsJson !== null ? safeParse(pendingSpellsJson, []) : levelUpBookList;
      pendingSpellsJson = JSON.stringify([...new Set([...(Array.isArray(savantBase) ? savantBase : []), ...levelUpSavantSpells])]);
    }
    if (levelUpIsWizard && swapSpell && swapSpell.old && swapSpell.new
      && newSpells && Array.isArray(newSpells) && newSpells.length > 0) {
      const wizSwapPrepared = safeParse(character.prepared_spells, []);
      const wizSwapList = (Array.isArray(wizSwapPrepared) ? wizSwapPrepared : []).filter((s) => s !== swapSpell.old);
      wizSwapList.push(swapSpell.new);
      pendingPreparedSpellsJson = JSON.stringify(wizSwapList);
    }
    if (levelUpIsWizard && swapSpell && swapSpell.old && swapSpell.new && pendingPreparedSpellsJson !== null) {
      const swapBookBase = pendingSpellsJson !== null ? safeParse(pendingSpellsJson, []) : levelUpBookList;
      const swapBook = Array.isArray(swapBookBase) ? swapBookBase : [];
      if (!swapBook.some((s) => canonicalizeSpellName(s) === canonicalizeSpellName(swapSpell.new))) {
        return res.status(400).json({ error: `swapSpell: '${swapSpell.new}' is not in the spellbook — a wizard can only prepare spells from the book` });
      }
    }

    // Artificer prepared-spell cap re-check (2026-11-06): the stored
    // prepared list was writable without enforcement before the PUT
    // wiring, so a legacy over-cap list can still sit on the row.
    // Leveling up IN artificer (not multiclassing into it — the stored
    // list belongs to the other class there) re-checks the stored list
    // against the NEW artificer level and the post-ASI Int mod, with
    // always-prepared from the (possibly newly chosen) subclass.
    // No DB writes have happened yet — mutations above are in-memory
    // only and the transactional phase is below — so a refusal leaves
    // the level unchanged. Fix the list on the character sheet, then
    // level up.
    if (!isMulticlass && targetClassName === 'artificer') {
      const storedPrepared = safeParse(character.prepared_spells, []);
      const storedList = Array.isArray(storedPrepared) ? storedPrepared : [];
      const postAsiInt = Number(newAbilityScores.int ?? newAbilityScores.intelligence ?? 10);
      const postAsiIntMod = Math.floor(((Number.isFinite(postAsiInt) ? postAsiInt : 10) - 10) / 2);
      const levelUpAlways = artificerSubclassSpellsAtLevel(
        'artificer',
        subclass || existingSubclass,
        newClassLevel
      );
      const levelUpCheck = validatePreparedSpells(newClassLevel, storedList, levelUpAlways, postAsiIntMod);
      if (!levelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: artificer may prepare at most ${levelUpCheck.max} spells at artificer level ${newClassLevel} (Int mod ${postAsiIntMod}), got ${levelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Blackguard prepared-spell cap re-check (2026-11-06): mirrors the
    // artificer block above. Leveling up IN blackguard (not multiclassing
    // into it — the stored list belongs to the other class there) re-checks
    // the stored list against the NEW blackguard level and the post-ASI Cha
    // mod, with Vice spells from the (possibly newly chosen) subclass.
    // No DB writes have happened yet — mutations above are in-memory only
    // and the transactional phase is below — so a refusal leaves the level
    // unchanged. Fix the list on the character sheet, then level up.
    if (!isMulticlass && targetClassName === 'blackguard') {
      const bgStoredPrepared = safeParse(character.prepared_spells, []);
      const bgStoredList = Array.isArray(bgStoredPrepared) ? bgStoredPrepared : [];
      const postAsiCha = Number(newAbilityScores.cha ?? newAbilityScores.charisma ?? 10);
      const postAsiChaMod = Math.floor(((Number.isFinite(postAsiCha) ? postAsiCha : 10) - 10) / 2);
      const bgLevelUpVice = blackguardViceSpellsAtLevel(
        'blackguard',
        subclass || existingSubclass,
        newClassLevel
      );
      const bgLevelUpCheck = validateBlackguardPreparedSpells(postAsiChaMod, newClassLevel, bgStoredList, bgLevelUpVice);
      if (!bgLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: blackguard may prepare at most ${bgLevelUpCheck.max} spells at blackguard level ${newClassLevel} (Cha mod ${postAsiChaMod}), got ${bgLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Paladin prepared-spell cap re-check (2026-11-06, item 26;
    // PHB correction 2026-11-07): mirrors the artificer/blackguard
    // blocks above. Leveling up IN paladin (not multiclassing into
    // it — the stored list belongs to the other class there)
    // re-checks the stored list against the NEW paladin level's
    // PHB table value (PALADIN_SPELLS_PREPARED: 2 at L1, 6 at L5;
    // the post-ASI Cha mod is passed but ignored — the book states
    // no formula), with oath spells from the (possibly newly
    // chosen) subclass.
    // No DB writes have happened yet — mutations above are
    // in-memory only and the transactional phase is below — so a
    // refusal leaves the level unchanged. Fix the list on the
    // character sheet, then level up.
    if (!isMulticlass && targetClassName === 'paladin') {
      const palStoredPrepared = safeParse(character.prepared_spells, []);
      const palStoredList = Array.isArray(palStoredPrepared) ? palStoredPrepared : [];
      const palPostAsiCha = Number(newAbilityScores.cha ?? newAbilityScores.charisma ?? 10);
      const palPostAsiChaMod = Math.floor(((Number.isFinite(palPostAsiCha) ? palPostAsiCha : 10) - 10) / 2);
      const palLevelUpOath = paladinOathSpellsAtLevel(
        'paladin',
        subclass || existingSubclass,
        newClassLevel
      );
      const palLevelUpCheck = validatePaladinPreparedSpells(palPostAsiChaMod, newClassLevel, palStoredList, palLevelUpOath);
      if (!palLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: paladin may prepare at most ${palLevelUpCheck.max} spells at paladin level ${newClassLevel} (Cha mod ${palPostAsiChaMod}), got ${palLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Sorcerer prepared-spell cap re-check (2026-11-06): mirrors the
    // artificer/blackguard/paladin blocks above. Leveling up IN
    // sorcerer (not multiclassing into it — the stored list belongs
    // to the other class there) re-checks the stored list against
    // the NEW sorcerer level and the fixed Prepared Spells column
    // (no Cha mod — the book states no formula), with subclass
    // spells from the (possibly newly chosen) subclass.
    // No DB writes have happened yet — mutations above are
    // in-memory only and the transactional phase is below — so a
    // refusal leaves the level unchanged. Fix the list on the
    // character sheet, then level up.
    if (!isMulticlass && targetClassName === 'sorcerer') {
      const sorcStoredPrepared = safeParse(character.prepared_spells, []);
      const sorcStoredList = Array.isArray(sorcStoredPrepared) ? sorcStoredPrepared : [];
      const sorcLevelUpAlways = sorcererSubclassSpellsAtLevel(
        'sorcerer',
        subclass || existingSubclass,
        newClassLevel
      );
      const sorcLevelUpCheck = validateSorcererPreparedSpells(newClassLevel, sorcStoredList, sorcLevelUpAlways);
      if (!sorcLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: sorcerer may prepare at most ${sorcLevelUpCheck.max} spells at sorcerer level ${newClassLevel}, got ${sorcLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Ranger prepared-spell cap re-check (2026-11-06, PHB photos
    // pp. 119-120): mirrors the paladin block above. Leveling up
    // IN ranger (not multiclassing into it — the stored list
    // belongs to the other class there) re-checks the stored list
    // against the NEW ranger level and the post-ASI Wis mod, with
    // Hunter's Mark + subclass spells from the (possibly newly
    // chosen) subclass. Table-driven cap (2 at L1). No DB writes
    // have happened yet — mutations above are in-memory only and
    // the transactional phase is below — so a refusal leaves the
    // level unchanged. Fix the list on the character sheet, then
    // level up.
    if (!isMulticlass && targetClassName === 'ranger') {
      const rngStoredPrepared = safeParse(character.prepared_spells, []);
      const rngStoredList = Array.isArray(rngStoredPrepared) ? rngStoredPrepared : [];
      const rngPostAsiWis = Number(newAbilityScores.wis ?? newAbilityScores.wisdom ?? 10);
      const rngPostAsiWisMod = Math.floor(((Number.isFinite(rngPostAsiWis) ? rngPostAsiWis : 10) - 10) / 2);
      const rngLevelUpAlways = rangerAlwaysPreparedSpells(
        subclass || existingSubclass,
        newClassLevel
      );
      const rngLevelUpCheck = validateRangerPreparedSpells(rngPostAsiWisMod, newClassLevel, rngStoredList, rngLevelUpAlways);
      if (!rngLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: ranger may prepare at most ${rngLevelUpCheck.max} spells at ranger level ${newClassLevel} (Wis mod ${rngPostAsiWisMod}), got ${rngLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Bard prepared-spell cap re-check (2026-11-06): mirrors the
    // artificer/blackguard/paladin/sorcerer/ranger blocks above.
    // Leveling up IN bard (not multiclassing into it — the stored list
    // belongs to the other class there) re-checks the stored list
    // against the NEW bard level and the post-ASI Cha mod (Cha mod +
    // bard level, min 1), with Moonbeam from the (possibly newly
    // chosen) College of the Moon subclass excluded. No DB writes
    // have happened yet — mutations above are in-memory only and the
    // transactional phase is below — so a refusal leaves the level
    // unchanged. Fix the list on the character sheet, then level up.
    if (!isMulticlass && targetClassName === 'bard') {
      const bardStoredPrepared = safeParse(character.prepared_spells, []);
      const bardStoredList = Array.isArray(bardStoredPrepared) ? bardStoredPrepared : [];
      const bardPostAsiCha = Number(newAbilityScores.cha ?? newAbilityScores.charisma ?? 10);
      const bardPostAsiChaMod = Math.floor(((Number.isFinite(bardPostAsiCha) ? bardPostAsiCha : 10) - 10) / 2);
      const bardLevelUpAlways = bardSubclassSpellsAtLevel(
        'bard',
        subclass || existingSubclass,
        newClassLevel
      );
      const bardLevelUpCheck = validateBardPreparedSpells(bardPostAsiChaMod, newClassLevel, bardStoredList, bardLevelUpAlways);
      if (!bardLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: bard may prepare at most ${bardLevelUpCheck.max} spells at bard level ${newClassLevel} (Cha mod ${bardPostAsiChaMod}), got ${bardLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Eldritch Knight prepared-spell cap re-check (2026-11-07):
    // mirrors the sorcerer block above. Leveling up IN fighter
    // with the Eldritch Knight subclass (not multiclassing into it
    // — the stored list belongs to the other class there) re-checks
    // the stored list against the NEW fighter level's fixed PHB
    // table value (3 at 3rd -> 13 at 20th; no Int mod — the book
    // states no formula), with always-prepared from the (possibly
    // newly chosen) subclass (none today — the list is empty).
    // No DB writes have happened yet — mutations above are in-memory
    // only and the transactional phase is below — so a refusal leaves
    // the level unchanged. Fix the list on the character sheet, then
    // level up.
    if (!isMulticlass && targetClassName === 'fighter'
      && String(subclass || existingSubclass || '').trim().toLowerCase() === 'eldritch knight') {
      const ekStoredPrepared = safeParse(character.prepared_spells, []);
      const ekStoredList = Array.isArray(ekStoredPrepared) ? ekStoredPrepared : [];
      const ekLevelUpAlways = eldritchKnightSpellsAtLevel(
        'fighter',
        subclass || existingSubclass,
        newClassLevel
      );
      const ekLevelUpCheck = validateThirdCasterPreparedSpells(newClassLevel, ekStoredList, ekLevelUpAlways);
      if (!ekLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: Eldritch Knight may prepare at most ${ekLevelUpCheck.max} spells at fighter level ${newClassLevel}, got ${ekLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Arcane Trickster prepared-spell cap re-check (2026-11-07):
    // mirrors the Eldritch Knight block above. Leveling up IN rogue
    // with the Arcane Trickster subclass (not multiclassing into it)
    // re-checks the stored list against the NEW rogue level's fixed
    // PHB table value (3 at 3rd -> 13 at 20th; no Int mod).
    // No DB writes have happened yet — mutations above are in-memory
    // only and the transactional phase is below — so a refusal leaves
    // the level unchanged. Fix the list on the character sheet, then
    // level up.
    if (!isMulticlass && targetClassName === 'rogue'
      && String(subclass || existingSubclass || '').trim().toLowerCase() === 'arcane trickster') {
      const atStoredPrepared = safeParse(character.prepared_spells, []);
      const atStoredList = Array.isArray(atStoredPrepared) ? atStoredPrepared : [];
      const atLevelUpAlways = arcaneTricksterSpellsAtLevel(
        'rogue',
        subclass || existingSubclass,
        newClassLevel
      );
      const atLevelUpCheck = validateThirdCasterPreparedSpells(newClassLevel, atStoredList, atLevelUpAlways);
      if (!atLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: Arcane Trickster may prepare at most ${atLevelUpCheck.max} spells at rogue level ${newClassLevel}, got ${atLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Warlock prepared-spell cap re-check (2026-11-07): mirrors the
    // artificer/blackguard/paladin/sorcerer/ranger/bard blocks above.
    // Leveling up IN warlock (not multiclassing into it — the stored
    // list belongs to the other class there) re-checks the stored
    // list against the NEW warlock level's PHB table value
    // (WARLOCK_SPELLS_PREPARED: 2 at L1, 6 at L5, 15 at L20; the
    // post-ASI Cha mod is passed but ignored — the book states no
    // formula), with Contact Other Plane excluded at L9+ and Mystic
    // Arcanum spells excluded by catalog spell level inside the
    // validator (one per unlocked tier). Patron spells are
    // added-to-list, not always prepared, so they count if stored.
    // No DB writes have happened yet — mutations above are in-memory
    // only and the transactional phase is below — so a refusal leaves
    // the level unchanged. Fix the list on the character sheet, then
    // level up.
    if (!isMulticlass && targetClassName === 'warlock') {
      const wlkStoredPrepared = safeParse(character.prepared_spells, []);
      const wlkStoredList = Array.isArray(wlkStoredPrepared) ? wlkStoredPrepared : [];
      const wlkPostAsiCha = Number(newAbilityScores.cha ?? newAbilityScores.charisma ?? 10);
      const wlkPostAsiChaMod = Math.floor(((Number.isFinite(wlkPostAsiCha) ? wlkPostAsiCha : 10) - 10) / 2);
      const wlkLevelUpAlways = warlockAlwaysPreparedSpells(newClassLevel);
      const wlkLevelUpCheck = validateWarlockPreparedSpells(wlkPostAsiChaMod, newClassLevel, wlkStoredList, wlkLevelUpAlways);
      if (!wlkLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: warlock may prepare at most ${wlkLevelUpCheck.max} spells at warlock level ${newClassLevel} (Cha mod ${wlkPostAsiChaMod}), got ${wlkLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Profane Soul prepared-spell cap re-check (2026-11-07): mirrors
    // the ranger block above, with the table cap and no mod (see the
    // PUT block note — the validator takes the level first, no mod).
    // Leveling up IN blood_hunter while ALREADY Profane Soul
    // re-checks the stored list against the NEW blood hunter level,
    // with Revealed/Unsealed Arcana spells from the STORED patron
    // choice (subclass_choices_json — the level-up body carries no
    // patron). Leveling INTO Profane Soul for the first time is
    // NEVER blocked: the stored list had no prepared cap before the
    // subclass existed, so the gate requires the character to have
    // been Profane Soul already (existingSubclass), not merely to be
    // choosing it now (subclass). Multiclassing into blood_hunter
    // never blocks either — the stored list belongs to the other
    // class there. No DB writes have happened yet — mutations above
    // are in-memory only and the transactional phase is below — so
    // a refusal leaves the level unchanged. Fix the list on the
    // character sheet, then level up.
    if (!isMulticlass && targetClassName === 'blood_hunter' && isCastingSubclass('blood_hunter', existingSubclass)) {
      const psStoredPrepared = safeParse(character.prepared_spells, []);
      const psStoredList = Array.isArray(psStoredPrepared) ? psStoredPrepared : [];
      const psLevelUpChoices = parseSubclassChoices(character.subclass_choices_json);
      const psLevelUpPatronRaw = psLevelUpChoices?.patron ?? null;
      const psLevelUpPatron = Array.isArray(psLevelUpPatronRaw) ? psLevelUpPatronRaw[0] ?? null : psLevelUpPatronRaw;
      const psLevelUpAlways = profaneSoulArcanaSpellsAtLevel(
        'blood_hunter',
        existingSubclass,
        newClassLevel,
        psLevelUpPatron
      );
      const psLevelUpCheck = validateProfaneSoulPreparedSpells(newClassLevel, psStoredList, psLevelUpAlways);
      if (!psLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: profane soul may prepare at most ${psLevelUpCheck.max} spells at blood hunter level ${newClassLevel}, got ${psLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Wizard prepared-spell cap re-check (2026-11-07): mirrors the
    // bard block above. Leveling up IN wizard (not multiclassing into
    // it — the stored list belongs to the other class there) re-checks
    // the prepared list against the NEW wizard level and the post-ASI
    // Int mod (Int mod + wizard level, min 1), with the Spell
    // Mastery (L18) / Signature Spells (L20) picks from
    // spellbook_json excluded from the cap — and every remaining
    // prepared spell must be in the book. The check runs on the
    // PENDING lists (this level-up's adds, Savant frees, and swaps
    // included), not the stored ones, so a swap to a just-added book
    // spell passes and a swap to a spell outside the book refuses.
    // No DB writes have happened yet — mutations above are in-memory
    // only and the transactional phase is below — so a refusal leaves
    // the level unchanged. Fix the list on the character sheet, then
    // level up. A lost book does NOT block leveling up: losing the
    // book refuses prepared CHANGES, and leveling up does not change
    // the prepared list.
    if (!isMulticlass && targetClassName === 'wizard') {
      const wizPendingPreparedRaw = pendingPreparedSpellsJson !== null
        ? safeParse(pendingPreparedSpellsJson, [])
        : safeParse(character.prepared_spells, []);
      const wizStoredList = Array.isArray(wizPendingPreparedRaw) ? wizPendingPreparedRaw : [];
      const wizPostAsiInt = Number(newAbilityScores.int ?? newAbilityScores.intelligence ?? 10);
      const wizPostAsiIntMod = Math.floor(((Number.isFinite(wizPostAsiInt) ? wizPostAsiInt : 10) - 10) / 2);
      const wizState = parseSpellbookState(character.spellbook_json);
      const wizAlways = alwaysPreparedSpells(wizState, newClassLevel);
      const wizLevelUpCheck = validateWizardPreparedSpells(wizPostAsiIntMod, newClassLevel, wizStoredList, wizAlways);
      if (!wizLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: wizard may prepare at most ${wizLevelUpCheck.max} spells at wizard level ${newClassLevel} (Int mod ${wizPostAsiIntMod}), got ${wizLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
      const wizPendingBookRaw = pendingSpellsJson !== null
        ? safeParse(pendingSpellsJson, [])
        : safeParse(character.known_spells, []);
      const wizPendingBook = Array.isArray(wizPendingBookRaw) ? wizPendingBookRaw : [];
      const wizMembership = validateBookMembership(wizStoredList, wizPendingBook, wizAlways);
      if (!wizMembership.ok) {
        return res.status(400).json({
          error: `preparedSpells: ${wizMembership.missing.map((s) => `'${s}'`).join(', ')} ${wizMembership.missing.length === 1 ? 'is' : 'are'} not in the spellbook — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Cleric prepared-spell cap re-check (2026-11-09, mechanics
    // hooks Family 3): mirrors the bard block above. Leveling up
    // IN cleric (not multiclassing into it — the stored list
    // belongs to the other class there) re-checks the stored list
    // against the NEW cleric level and the post-ASI Wis mod (Wis
    // mod + cleric level, min 1), with domain spells from the
    // (possibly newly chosen) subclass excluded. No DB writes have
    // happened yet — mutations above are in-memory only and the
    // transactional phase is below — so a refusal leaves the level
    // unchanged. Fix the list on the character sheet, then level up.
    if (!isMulticlass && targetClassName === 'cleric') {
      const cleStoredPrepared = safeParse(character.prepared_spells, []);
      const cleStoredList = Array.isArray(cleStoredPrepared) ? cleStoredPrepared : [];
      const clePostAsiWis = Number(newAbilityScores.wis ?? newAbilityScores.wisdom ?? 10);
      const clePostAsiWisMod = Math.floor(((Number.isFinite(clePostAsiWis) ? clePostAsiWis : 10) - 10) / 2);
      const cleLevelUpAlways = clericDomainSpellsAtLevel(
        'cleric',
        subclass || existingSubclass,
        newClassLevel
      );
      const cleLevelUpCheck = validateClericPreparedSpells(clePostAsiWisMod, newClassLevel, cleStoredList, cleLevelUpAlways);
      if (!cleLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: cleric may prepare at most ${cleLevelUpCheck.max} spells at cleric level ${newClassLevel} (Wis mod ${clePostAsiWisMod}), got ${cleLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Druid prepared-spell cap re-check (2026-11-09, mechanics
    // hooks Family 3): mirrors the cleric block above. Leveling
    // up IN druid (not multiclassing into it — the stored list
    // belongs to the other class there) re-checks the stored list
    // against the NEW druid level and the post-ASI Wis mod (Wis
    // mod + druid level, min 1), with circle spells from the
    // (possibly newly chosen) subclass excluded. Circle of the
    // Land reads its land type from the STORED subclass_choices_json
    // (the level-up body carries no land type) — no stored land
    // type means no exclusion, same fail-closed rule as the PUT
    // block. No DB writes have happened yet — mutations above are
    // in-memory only and the transactional phase is below — so a
    // refusal leaves the level unchanged. Fix the list on the
    // character sheet, then level up.
    if (!isMulticlass && targetClassName === 'druid') {
      const druStoredPrepared = safeParse(character.prepared_spells, []);
      const druStoredList = Array.isArray(druStoredPrepared) ? druStoredPrepared : [];
      const druPostAsiWis = Number(newAbilityScores.wis ?? newAbilityScores.wisdom ?? 10);
      const druPostAsiWisMod = Math.floor(((Number.isFinite(druPostAsiWis) ? druPostAsiWis : 10) - 10) / 2);
      const druLevelUpChoices = parseSubclassChoices(character.subclass_choices_json);
      const druLevelUpLandRaw = druLevelUpChoices?.land_type ?? null;
      const druLevelUpLand = Array.isArray(druLevelUpLandRaw) ? druLevelUpLandRaw[0] ?? null : druLevelUpLandRaw;
      const druLevelUpAlways = druidCircleSpellsAtLevel(
        'druid',
        subclass || existingSubclass,
        newClassLevel,
        druLevelUpLand
      );
      const druLevelUpCheck = validateDruidPreparedSpells(druPostAsiWisMod, newClassLevel, druStoredList, druLevelUpAlways);
      if (!druLevelUpCheck.ok) {
        return res.status(400).json({
          error: `preparedSpells: druid may prepare at most ${druLevelUpCheck.max} spells at druid level ${newClassLevel} (Wis mod ${druPostAsiWisMod}), got ${druLevelUpCheck.counted} — fix the prepared list on the character sheet before leveling up`
        });
      }
    }

    // Keeper-specific pending writes
    const keeperWrites = {};
    if (targetClassName === 'keeper') {
      const { keeperGenreDomain, keeperNewTexts, keeperNewRecitations, keeperSpecialization,
              keeperSecondGenre, keeperGenreMastery, keeperSubclassText } = req.body;

      if (keeperGenreDomain) keeperWrites.genre_domain = keeperGenreDomain;
      if (keeperSecondGenre) keeperWrites.genre_domain_2 = keeperSecondGenre;
      if (keeperGenreMastery) keeperWrites.genre_mastery = 1;

      const allNewTexts = [...(keeperNewTexts || [])];
      if (keeperSubclassText) allNewTexts.push(keeperSubclassText);
      if (allNewTexts.length > 0) {
        const existingTexts = safeParse(character.keeper_texts, []);
        keeperWrites.texts = JSON.stringify([...new Set([...existingTexts, ...allNewTexts])]);
      }

      if (keeperNewRecitations && Array.isArray(keeperNewRecitations) && keeperNewRecitations.length > 0) {
        const existingRec = safeParse(character.keeper_recitations, []);
        keeperWrites.recitations = JSON.stringify([...new Set([...existingRec, ...keeperNewRecitations])]);
      }

      if (keeperSpecialization) keeperWrites.specialization = keeperSpecialization;
    }

    // Compute final character fields
    const newXPToNextLevel = getXPToNextLevel(newTotalLevel);
    const hitDiceBreakdown = getHitDiceBreakdown(classLevels);
    const newMaxHp = character.max_hp + hpGain;
    const newCurrentHp = character.current_hp + hpGain;
    const primaryClass = classLevels.reduce((a, b) => a.level >= b.level ? a : b);

    // ==== Transactional write phase ====
    // All writes happen inside a single transaction. If any write fails, all are
    // rolled back — no more orphaned state where cantrips got added but the level
    // didn't, or Keeper specialization changed but the HP didn't update.
    const tx = await db.transaction('write');
    try {
      if (pendingFeatsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET feats = ? WHERE id = ?',
          args: [pendingFeatsJson, req.params.id]
        });
      }
      if (pendingCantripsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET known_cantrips = ? WHERE id = ?',
          args: [pendingCantripsJson, req.params.id]
        });
      }
      if (pendingSpellsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET known_spells = ? WHERE id = ?',
          args: [pendingSpellsJson, req.params.id]
        });
      }
      if (pendingPreparedSpellsJson !== null) {
        await tx.execute({
          sql: 'UPDATE characters SET prepared_spells = ? WHERE id = ?',
          args: [pendingPreparedSpellsJson, req.params.id]
        });
      }
      if (keeperWrites.genre_domain) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_domain = ? WHERE id = ?',
          args: [keeperWrites.genre_domain, req.params.id]
        });
      }
      if (keeperWrites.genre_domain_2) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_domain_2 = ? WHERE id = ?',
          args: [keeperWrites.genre_domain_2, req.params.id]
        });
      }
      if (keeperWrites.genre_mastery) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_genre_mastery = 1 WHERE id = ?',
          args: [req.params.id]
        });
      }
      if (keeperWrites.texts) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_texts = ? WHERE id = ?',
          args: [keeperWrites.texts, req.params.id]
        });
      }
      if (keeperWrites.recitations) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_recitations = ? WHERE id = ?',
          args: [keeperWrites.recitations, req.params.id]
        });
      }
      if (keeperWrites.specialization) {
        await tx.execute({
          sql: 'UPDATE characters SET keeper_specialization = ? WHERE id = ?',
          args: [keeperWrites.specialization, req.params.id]
        });
      }

      // Main character update (level, HP, class_levels, etc.)
      await tx.execute({
        sql: `UPDATE characters
              SET level = ?, class = ?, max_hp = ?, current_hp = ?,
                  ability_scores = ?, subclass = ?, class_levels = ?,
                  hit_dice = ?, experience_to_next_level = ?,
                  updated_at = CURRENT_TIMESTAMP
              WHERE id = ?`,
        args: [
          newTotalLevel,
          primaryClass.class,
          newMaxHp,
          newCurrentHp,
          JSON.stringify(newAbilityScores),
          primaryClass.subclass || newSubclass,
          JSON.stringify(classLevels),
          JSON.stringify(hitDiceBreakdown),
          newXPToNextLevel,
          req.params.id
        ]
      });

      // Phase 5: progression unlocks (theme tier + ancestry feat)
      if (progressionDecisions.theme_tier_unlock) {
        const unlock = progressionDecisions.theme_tier_unlock;
        await tx.execute({
          sql: `INSERT OR REPLACE INTO character_theme_unlocks
                (character_id, theme_id, tier, tier_ability_id, unlocked_at_level, narrative_delivery)
                VALUES (?, ?, ?, ?, ?, ?)`,
          args: [
            req.params.id,
            unlock.theme_id,
            unlock.tier,
            unlock.tier_ability_id,
            newTotalLevel,
            `Unlocked at level ${newTotalLevel} during level-up.`
          ]
        });
      }
      if (progressionDecisions.ancestry_feat_tier && ancestryFeatId) {
        await tx.execute({
          sql: `INSERT OR REPLACE INTO character_ancestry_feats
                (character_id, feat_id, tier, selected_at_level, narrative_delivery)
                VALUES (?, ?, ?, ?, ?)`,
          args: [
            req.params.id,
            ancestryFeatId,
            progressionDecisions.ancestry_feat_tier.tier,
            newTotalLevel,
            `Selected during level-up at level ${newTotalLevel}.`
          ]
        });
      }

      await tx.commit();
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);

    // Get features gained
    const newFeatures = getClassFeatures(targetClassName, newClassLevel);

    // Build class display string (e.g., "Fighter 5 / Rogue 2")
    const classDisplay = classLevels.map(c => `${c.class} ${c.level}`).join(' / ');

    res.json({
      message: `Congratulations! ${character.name} is now ${classDisplay}!`,
      character: updatedCharacter,
      levelUpSummary: {
        previousLevel: totalLevel,
        newLevel: newTotalLevel,
        leveledClass: targetClass,
        newClassLevel,
        isMulticlass,
        classLevels,
        classDisplay,
        hpGained: hpGain,
        newMaxHp,
        hitDice: hitDiceBreakdown,
        newFeatures,
        proficiencyBonus: PROFICIENCY_BONUS[newTotalLevel],
        abilityScoreChanges: asiChoice?.type === 'asi' ? asiChoice.increases : null,
        newSubclass: subclass || null,
        themeTierUnlocked: progressionDecisions.theme_tier_unlock || null,
        ancestryFeatSelected: (progressionDecisions.ancestry_feat_tier && ancestryFeatId)
          ? progressionDecisions.ancestry_feat_tier.options.find(o => o.id === ancestryFeatId) || null
          : null
      }
    });
  } catch (error) {
    handleServerError(res, error, 'level up character');
  }
});

// Get the character's current campaign
router.get('/:id/campaign', async (req, res) => {
  try {
    const character = await dbGet('SELECT id, name, campaign_id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (!character.campaign_id) {
      return res.json({ campaign: null });
    }

    const campaign = await dbGet('SELECT * FROM campaigns WHERE id = ?', [character.campaign_id]);
    res.json({ campaign });
  } catch (error) {
    handleServerError(res, error, 'fetch character campaign');
  }
});

// Assign character to a campaign
router.put('/:id/campaign', async (req, res) => {
  try {
    const { campaign_id } = req.body;

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    if (campaign_id) {
      const campaign = await dbGet('SELECT id FROM campaigns WHERE id = ?', [campaign_id]);
      if (!campaign) {
        return res.status(404).json({ error: 'Campaign not found' });
      }
    }

    await dbRun(`
      UPDATE characters
      SET campaign_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [campaign_id || null, req.params.id]);

    const updatedCharacter = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    res.json(updatedCharacter);
  } catch (error) {
    handleServerError(res, error, 'assign character to campaign');
  }
});

// Remove character from campaign
router.delete('/:id/campaign', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun(`
      UPDATE characters
      SET campaign_id = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [req.params.id]);

    res.json({ success: true, message: 'Character removed from campaign' });
  } catch (error) {
    handleServerError(res, error, 'remove character from campaign');
  }
});

// ============================================================
// CHARACTER QUEST TRACKING
// ============================================================

// Get all quests for a character
router.get('/:id/quests', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const { type, status } = req.query;
    let quests;

    if (type) {
      quests = await questService.getQuestsByType(req.params.id, type);
    } else if (status === 'active') {
      quests = await questService.getActiveQuests(req.params.id);
    } else {
      quests = await questService.getCharacterQuests(req.params.id);
    }

    res.json(quests);
  } catch (error) {
    handleServerError(res, error, 'fetch quests');
  }
});

// Get only active quests for a character
router.get('/:id/quests/active', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const quests = await questService.getActiveQuests(req.params.id);
    res.json(quests);
  } catch (error) {
    handleServerError(res, error, 'fetch active quests');
  }
});

// Get the character's main quest
router.get('/:id/quests/main', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const quest = await questService.getMainQuest(req.params.id);
    res.json(quest);
  } catch (error) {
    handleServerError(res, error, 'fetch main quest');
  }
});

// Get quest summary for a character (counts by type and status)
router.get('/:id/quests/summary', async (req, res) => {
  try {
    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const allQuests = await questService.getCharacterQuests(req.params.id);

    const summary = {
      total: allQuests.length,
      byStatus: {
        active: allQuests.filter(q => q.status === 'active').length,
        completed: allQuests.filter(q => q.status === 'completed').length,
        failed: allQuests.filter(q => q.status === 'failed').length,
        abandoned: allQuests.filter(q => q.status === 'abandoned').length
      },
      byType: {
        main: allQuests.filter(q => q.quest_type === 'main').length,
        side: allQuests.filter(q => q.quest_type === 'side').length,
        companion: allQuests.filter(q => q.quest_type === 'companion').length,
        one_time: allQuests.filter(q => q.quest_type === 'one_time').length
      },
      hasMainQuest: allQuests.some(q => q.quest_type === 'main' && q.status === 'active')
    };

    res.json(summary);
  } catch (error) {
    handleServerError(res, error, 'fetch quest summary');
  }
});

// Get campaign notes for a character
router.get('/:id/campaign-notes', async (req, res) => {
  try {
    const character = await dbGet('SELECT id, name, campaign_notes, character_memories FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }
    res.json({
      characterId: character.id,
      characterName: character.name,
      notes: character.campaign_notes || '',
      characterMemories: character.character_memories || ''
    });
  } catch (error) {
    handleServerError(res, error, 'fetch campaign notes');
  }
});

// Update campaign notes for a character
router.put('/:id/campaign-notes', async (req, res) => {
  try {
    const { notes } = req.body;
    if (typeof notes !== 'string') {
      return res.status(400).json({ error: 'Notes must be a string' });
    }

    const character = await dbGet('SELECT id FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    await dbRun(`
      UPDATE characters
      SET campaign_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [notes, req.params.id]);

    res.json({
      success: true,
      message: 'Campaign notes updated'
    });
  } catch (error) {
    handleServerError(res, error, 'update campaign notes');
  }
});

// Generate campaign notes from session history (for retroactive population)
router.post('/:id/generate-campaign-notes', async (req, res) => {
  try {
    const character = await dbGet('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    // Get all completed sessions with their messages
    const sessions = await dbAll(`
      SELECT id, title, summary, messages, setting, start_time, end_time,
             game_start_day, game_start_year, game_end_day, game_end_year
      FROM dm_sessions
      WHERE character_id = ? AND status = 'completed' AND rewards_claimed = 1
      ORDER BY created_at ASC
      LIMIT 10
    `, [req.params.id]);

    if (sessions.length === 0) {
      return res.json({
        success: true,
        notes: '',
        message: 'No completed sessions found to generate notes from'
      });
    }

    // Import LLM services dynamically to avoid circular dependencies
    const claude = (await import('../services/claude.js')).default;
    const ollama = (await import('../services/ollama.js')).default;
    const { loggedChat } = await import('../services/aiCallLogger.js');

    // Determine which LLM provider to use
    let provider = null;
    if (claude.isClaudeAvailable()) {
      const status = await claude.checkClaudeStatus();
      if (status.available) provider = 'claude';
    }
    if (!provider) {
      const ollamaStatus = await ollama.checkOllamaStatus();
      if (ollamaStatus.available) provider = 'ollama';
    }

    if (!provider) {
      return res.status(503).json({ error: 'No LLM provider available' });
    }

    // Build context from session summaries and key messages
    let sessionContext = '';
    for (const session of sessions) {
      sessionContext += `\n=== Session: ${session.title} ===\n`;
      if (session.summary) {
        sessionContext += `Summary: ${session.summary}\n`;
      }

      // Parse messages to extract key narrative moments
      try {
        const messages = JSON.parse(session.messages || '[]');
        // Get the last few assistant messages (narrative) for context
        const narrativeMessages = messages
          .filter(m => m.role === 'assistant')
          .slice(-3)
          .map(m => m.content)
          .join('\n---\n');
        if (narrativeMessages) {
          sessionContext += `Key moments:\n${narrativeMessages.substring(0, 2000)}\n`;
        }
      } catch (e) {
        // Skip if messages can't be parsed
      }
    }

    const extractionPrompt = `Based on these adventure sessions for the character "${character.nickname || character.name}", extract and organize the important campaign details that should be remembered.

${sessionContext}

Format your response as organized notes under these categories (skip empty categories):

## NPCs Met
- [Name]: [Brief description, relationship, any deals or promises]

## Items Given or Received
- [What was exchanged, with whom, why it matters]

## Promises & Obligations
- [What was promised, to whom, current status]

## Key Relationships
- [Person/Faction]: [Nature of relationship - ally, enemy, employer, etc.]

## Important Locations
- [Place]: [Why it matters to this character]

## Ongoing Quests & Threads
- [Plot hooks, mysteries, or tasks in progress]

## Key Events
- [Major things that happened that shape the story]

Be concise but specific. Use names and details from the sessions. Only include things that actually happened.`;

    let generatedNotes = '';
    if (provider === 'claude') {
      generatedNotes = await loggedChat(
        { call_purpose: 'character_notes_gen', prompt_builder: 'character_route',
          character_id: parseInt(req.params.id) },
        'You are a helpful assistant organizing campaign notes for a D&D character.',
        [{ role: 'user', content: extractionPrompt }]
      );
    } else {
      generatedNotes = await ollama.chat([
        { role: 'system', content: 'You are a helpful assistant organizing campaign notes for a D&D character.' },
        { role: 'user', content: extractionPrompt }
      ]);
    }

    // Prepend with a header indicating this was auto-generated
    const existingNotes = character.campaign_notes || '';
    const header = `# Campaign Memory for ${character.nickname || character.name}\n*Auto-generated from ${sessions.length} session(s)*\n\n`;

    // Extract any "My Notes" section from existing notes to preserve player edits
    // Look for ## My Notes, ## Player Notes, or ---\n## My Notes patterns
    let playerNotes = '';
    const playerNotesPatterns = [
      /\n---\n## My Notes\n([\s\S]*)$/i,
      /\n## My Notes\n([\s\S]*)$/i,
      /\n---\n## Player Notes\n([\s\S]*)$/i,
      /\n## Player Notes\n([\s\S]*)$/i
    ];

    for (const pattern of playerNotesPatterns) {
      const match = existingNotes.match(pattern);
      if (match) {
        playerNotes = match[1].trim();
        break;
      }
    }

    // Build final notes: auto-generated + player notes section
    let finalNotes = header + generatedNotes.trim();

    // Always include a player notes section (empty or with existing content)
    finalNotes += '\n\n---\n## My Notes\n*Your personal additions - this section is preserved when regenerating*\n\n';
    if (playerNotes) {
      // Remove the italicized instruction if it was already there
      const cleanedPlayerNotes = playerNotes.replace(/^\*Your personal additions.*\*\n*/i, '').trim();
      if (cleanedPlayerNotes) {
        finalNotes += cleanedPlayerNotes;
      }
    }

    // Save the generated notes
    await dbRun(`
      UPDATE characters
      SET campaign_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [finalNotes, req.params.id]);

    res.json({
      success: true,
      notes: finalNotes,
      sessionsProcessed: sessions.length,
      message: `Generated campaign notes from ${sessions.length} session(s)`
    });
  } catch (error) {
    handleServerError(res, error, 'generate campaign notes');
  }
});

// ============================================================
// PARSED BACKSTORY ROUTES
// ============================================================

// GET /api/character/:id/parsed-backstory - Get the parsed backstory
router.get('/:id/parsed-backstory', async (req, res) => {
  try {
    const parsed = await backstoryParserService.getParsedBackstory(req.params.id);
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'fetch parsed backstory');
  }
});

// POST /api/character/:id/parsed-backstory/parse - Parse or re-parse the backstory
router.post('/:id/parsed-backstory/parse', async (req, res) => {
  try {
    const { preserveManualEdits = false } = req.body;

    let parsed;
    if (preserveManualEdits) {
      parsed = await backstoryParserService.reparseBackstory(req.params.id, true);
    } else {
      parsed = await backstoryParserService.parseBackstory(req.params.id);
    }

    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'parse backstory');
  }
});

// PUT /api/character/:id/parsed-backstory/:elementType/:elementId - Update a specific element
router.put('/:id/parsed-backstory/:elementType/:elementId', async (req, res) => {
  try {
    const { elementType, elementId } = req.params;
    const updates = req.body;

    const parsed = await backstoryParserService.updateElement(
      req.params.id,
      elementType,
      elementId,
      updates
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'update backstory element');
  }
});

// POST /api/character/:id/parsed-backstory/:elementType - Add a new element
router.post('/:id/parsed-backstory/:elementType', async (req, res) => {
  try {
    const { elementType } = req.params;
    const element = req.body;

    const parsed = await backstoryParserService.addElement(
      req.params.id,
      elementType,
      element
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'add backstory element');
  }
});

// DELETE /api/character/:id/parsed-backstory/:elementType/:elementId - Remove an element
router.delete('/:id/parsed-backstory/:elementType/:elementId', async (req, res) => {
  try {
    const { elementType, elementId } = req.params;

    const parsed = await backstoryParserService.removeElement(
      req.params.id,
      elementType,
      elementId
    );
    res.json(parsed);
  } catch (error) {
    handleServerError(res, error, 'remove backstory element');
  }
});

// Get player journal - aggregates discovered world knowledge
router.get('/:id/journal', async (req, res) => {
  try {
    const character = await dbGet(
      'SELECT id, name, campaign_id, campaign_notes FROM characters WHERE id = ?',
      [req.params.id]
    );
    if (!character) {
      return res.status(404).json({ error: 'Character not found' });
    }

    const campaignId = character.campaign_id;

    // Fetch all data sources in parallel
    const [relationships, allLocations, standings, visibleGoals, quests, visibleEvents] = await Promise.all([
      getCharacterRelationshipsWithNpcs(character.id).catch(() => []),
      campaignId ? getCampaignLocations(campaignId).catch(() => []) : [],
      getCharacterStandings(character.id).catch(() => []),
      getGoalsVisibleToCharacter(character.id).catch(() => []),
      questService.getCharacterQuests(character.id).catch(() => []),
      getEventsVisibleToCharacter(character.id).catch(() => [])
    ]);

    // Get campaign plan for unknown counts
    let campaignPlan = null;
    if (campaignId) {
      const campaign = await dbGet('SELECT campaign_plan FROM campaigns WHERE id = ?', [campaignId]);
      if (campaign?.campaign_plan) {
        try {
          campaignPlan = typeof campaign.campaign_plan === 'string'
            ? JSON.parse(campaign.campaign_plan)
            : campaign.campaign_plan;
        } catch (e) { /* ignore parse errors */ }
      }
    }

    // NPCs: met (have relationships) vs total in campaign plan
    const metNpcs = relationships.map(r => ({
      name: r.npc_name,
      race: r.npc_race,
      occupation: r.npc_occupation,
      location: r.npc_location,
      avatar: r.npc_avatar,
      disposition: r.disposition_label,
      lifecycleStatus: r.npc_lifecycle_status || 'alive',
      timesMet: r.times_met,
      knownFacts: r.player_known_facts || [],
      discoveredSecrets: r.discovered_secrets || [],
      promises: r.promises_made || [],
      debts: r.debts_owed || []
    }));
    const totalPlanNpcs = campaignPlan?.npcs?.length || 0;

    // Locations: group by discovery status
    const discoveredLocations = allLocations.filter(l => l.discovery_status !== 'unknown');
    const locations = {
      visited: allLocations.filter(l => ['visited', 'familiar', 'home_base'].includes(l.discovery_status)).map(l => ({
        name: l.name,
        type: l.location_type,
        region: l.region,
        description: l.description,
        status: l.discovery_status,
        timesVisited: l.times_visited,
        services: l.services || [],
        tags: l.tags || []
      })),
      rumored: allLocations.filter(l => l.discovery_status === 'rumored').map(l => ({
        name: l.name,
        type: l.location_type,
        region: l.region
      })),
      unknownCount: allLocations.filter(l => l.discovery_status === 'unknown').length
    };

    // Factions
    const factions = standings.map(s => ({
      name: s.faction_name,
      symbol: s.symbol,
      standing: s.standing,
      standingLabel: s.standing_label,
      isMember: s.is_member,
      rank: s.rank,
      knownMembers: s.known_members || [],
      knownGoals: s.known_goals || [],
      knownSecrets: s.known_secrets || [],
      goals: visibleGoals.filter(g => g.faction_id === s.faction_id).map(g => ({
        title: g.title,
        description: g.description,
        progress: g.progress,
        progressMax: g.progress_max,
        status: g.status,
        visibility: g.visibility
      }))
    }));

    // Quests
    const activeQuests = quests.filter(q => q.status === 'active').map(q => ({
      title: q.title,
      premise: q.premise,
      type: q.quest_type,
      priority: q.priority,
      currentStage: q.current_stage,
      stages: q.stages || [],
      timeSensitive: q.time_sensitive,
      rewards: q.rewards
    }));
    const completedQuests = quests.filter(q => q.status === 'completed').map(q => ({
      title: q.title,
      premise: q.premise,
      type: q.quest_type,
      completedAt: q.completed_at
    }));

    // World Events
    const events = visibleEvents.map(e => ({
      title: e.title,
      description: e.description,
      type: e.event_type,
      scope: e.scope,
      status: e.status,
      visibility: e.visibility,
      affectedLocations: e.affected_locations || [],
      affectedFactions: e.affected_factions || []
    }));

    // Parse campaign_notes into sections
    const notes = character.campaign_notes || '';

    res.json({
      npcs: { met: metNpcs, unknownCount: Math.max(0, totalPlanNpcs - metNpcs.length) },
      locations,
      factions,
      quests: { active: activeQuests, completed: completedQuests },
      events,
      notes
    });
  } catch (error) {
    handleServerError(res, error, 'get player journal');
  }
});

export default router;
