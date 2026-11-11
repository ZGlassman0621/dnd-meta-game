/**
 * Companion Sheet Service — REAL character sheets for class-based companions.
 *
 * The schema was never the problem: companions have carried
 * companion_ability_scores / skill_proficiencies / companion_class /
 * companion_level since the initial migration. The gaps were population
 * and use:
 *   - recruiting a class-based companion whose NPC had no ability scores
 *     produced a mannequin sheet — flat 10s in every ability — and never
 *     set skill_proficiencies at all;
 *   - nothing downstream (rolls, the DM prompt's skill lines) read the
 *     sheet as mechanics.
 *
 * This service generates a real sheet when one is missing: the standard
 * array (15/14/13/12/10/8) assigned by ability priorities, plus skill
 * proficiencies. Since 2026-10-21 generation runs through the companion's
 * build ARCHETYPE (server/data/companionArchetypes.js): recruitment may
 * supply one from the NPC they were; otherwise the system rolls one at
 * generation time (template ~50%) and persists the key, so a given
 * companion's build is stable forever even though the class's builds vary.
 *
 * ensureCompanionSheet() backfills EXISTING companions: it only generates
 * when the sheet is absent or a flat-10 placeholder with no skills chosen
 * (the recruit-route fallback signature). A sheet with any real score, or
 * with skills a player picked, is never overwritten. It does NOT touch HP
 * — max HP was computed from CON at creation; recomputing it under a
 * living companion would rewrite their damage state.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { getArchetype, rollArchetypeKey } from '../data/companionArchetypes.js';

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// Class ability priorities (highest first) for standard-array assignment.
const CLASS_ABILITY_PRIORITIES = {
  barbarian: ['str', 'con', 'dex', 'wis', 'cha', 'int'],
  bard: ['cha', 'dex', 'con', 'wis', 'int', 'str'],
  cleric: ['wis', 'str', 'con', 'cha', 'dex', 'int'],
  druid: ['wis', 'con', 'dex', 'int', 'cha', 'str'],
  fighter: ['str', 'con', 'dex', 'wis', 'int', 'cha'],
  monk: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  paladin: ['str', 'cha', 'con', 'wis', 'dex', 'int'],
  ranger: ['dex', 'wis', 'con', 'str', 'int', 'cha'],
  rogue: ['dex', 'int', 'con', 'cha', 'wis', 'str'],
  sorcerer: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  warlock: ['cha', 'con', 'dex', 'wis', 'int', 'str'],
  wizard: ['int', 'con', 'dex', 'wis', 'cha', 'str'],
  artificer: ['int', 'con', 'dex', 'wis', 'cha', 'str']
};
const DEFAULT_PRIORITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

// Class skill proficiencies: an ordered preference list and how many the
// class trains at 1st level (5e counts). The first N are taken.
const CLASS_SKILL_CHOICES = {
  barbarian: { count: 2, skills: ['Athletics', 'Perception', 'Survival', 'Intimidation', 'Nature', 'Animal Handling'] },
  bard: { count: 3, skills: ['Performance', 'Persuasion', 'Deception', 'Insight', 'Acrobatics', 'Perception'] },
  cleric: { count: 2, skills: ['Religion', 'Insight', 'Medicine', 'Persuasion', 'History'] },
  druid: { count: 2, skills: ['Perception', 'Survival', 'Nature', 'Animal Handling', 'Medicine', 'Religion'] },
  fighter: { count: 2, skills: ['Athletics', 'Perception', 'Intimidation', 'Survival', 'Acrobatics', 'History'] },
  monk: { count: 2, skills: ['Acrobatics', 'Stealth', 'Athletics', 'Insight', 'Religion', 'History'] },
  paladin: { count: 2, skills: ['Athletics', 'Persuasion', 'Insight', 'Religion', 'Intimidation', 'Medicine'] },
  ranger: { count: 3, skills: ['Stealth', 'Perception', 'Survival', 'Nature', 'Athletics', 'Investigation', 'Animal Handling', 'Insight'] },
  rogue: { count: 4, skills: ['Stealth', 'Sleight of Hand', 'Perception', 'Investigation', 'Acrobatics', 'Deception', 'Insight', 'Athletics'] },
  sorcerer: { count: 2, skills: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  warlock: { count: 2, skills: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  wizard: { count: 2, skills: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Religion'] },
  artificer: { count: 2, skills: ['Arcana', 'Investigation', 'History', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'] }
};
const DEFAULT_SKILL_CHOICE = { count: 2, skills: ['Perception', 'Athletics'] };

export function generateAbilityScores(className, archetype = null) {
  const priorities = archetype?.priorities
    || CLASS_ABILITY_PRIORITIES[(className || '').toLowerCase()] || DEFAULT_PRIORITIES;
  const scores = {};
  priorities.forEach((ability, i) => { scores[ability] = STANDARD_ARRAY[i]; });
  return scores;
}

export function defaultSkillProficiencies(className, archetype = null) {
  if (archetype?.skills?.length) return [...archetype.skills];
  const choice = CLASS_SKILL_CHOICES[(className || '').toLowerCase()] || DEFAULT_SKILL_CHOICE;
  return choice.skills.slice(0, choice.count);
}

/** The recruit-route placeholder signature: every score exactly 10. */
export function isFlatSheet(scores) {
  if (!scores || typeof scores !== 'object') return true;
  return ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(k => (scores[k] ?? 10) === 10);
}

function parseSheet(companion) {
  return {
    abilityScores: safeParse(companion.companion_ability_scores, null),
    skills: safeParse(companion.skill_proficiencies, []) || [],
    level: companion.companion_level || 1,
    className: companion.companion_class || null,
    progressionType: companion.progression_type || 'npc_stats',
    archetypeKey: companion.archetype_key || null
  };
}

export async function getCompanionSheet(companionId) {
  const companion = await dbGet(
    `SELECT companion_ability_scores, skill_proficiencies, companion_level,
            companion_class, progression_type, archetype_key
     FROM companions WHERE id = ?`,
    [companionId]
  );
  if (!companion) return null;
  return parseSheet(companion);
}

/**
 * Backfill a real sheet for a class-based companion whose sheet is absent
 * or a flat-10 placeholder. Returns the (possibly generated) sheet, or
 * null for non-class-based companions (they keep their NPC stat block).
 * Idempotent; never overwrites a real sheet; never touches HP.
 */
export async function ensureCompanionSheet(companionId) {
  const companion = await dbGet(
    `SELECT companion_ability_scores, skill_proficiencies, companion_level,
            companion_class, progression_type, archetype_key
     FROM companions WHERE id = ?`,
    [companionId]
  );
  if (!companion) return null;
  const sheet = parseSheet(companion);
  if (sheet.progressionType !== 'class_based') return null;

  const skillsEmpty = !Array.isArray(sheet.skills) || sheet.skills.length === 0;
  let { abilityScores, skills, archetypeKey } = sheet;
  let changed = false;

  if (!abilityScores || (isFlatSheet(abilityScores) && skillsEmpty)) {
    // Build identity first (2026-10-21): a companion generating a sheet
    // rolls their archetype now — unless recruitment already gave them
    // one from the NPC they were — and the sheet generates FROM it.
    // Template ~50%, off-builds the rest (companionArchetypes.js).
    if (!archetypeKey) archetypeKey = rollArchetypeKey(sheet.className);
    const archetype = getArchetype(sheet.className, archetypeKey);
    abilityScores = generateAbilityScores(sheet.className, archetype);
    if (skillsEmpty) skills = defaultSkillProficiencies(sheet.className, archetype);
    changed = true;
  } else if (skillsEmpty) {
    skills = defaultSkillProficiencies(sheet.className, getArchetype(sheet.className, archetypeKey));
    changed = true;
  }

  if (changed) {
    await dbRun(
      'UPDATE companions SET companion_ability_scores = ?, skill_proficiencies = ?, archetype_key = ? WHERE id = ?',
      [JSON.stringify(abilityScores), JSON.stringify(skills), archetypeKey, companionId]
    );
  }
  return { ...sheet, abilityScores, skills, archetypeKey, generated: changed };
}

