/**
 * Class-chassis registry — server-owned skill data (item 22, 2026-11-06).
 *
 * Transcribed from client/src/data/classes.json `skillChoices` +
 * `skillOptions` per class (generated 2026-11-06, then frozen as
 * server-owned data). The server validator (validateCreatorNextStage4)
 * enforces these — a class sending more skill picks than its count,
 * or a skill outside its allowed list, is refused. The validator
 * NEVER imports client classes.json (see classValidationService.js
 * header — the standing decision this registry respects); a diff
 * test pins this file against classes.json so drift in either
 * direction is caught.
 *
 * Normalization: classes.json spells most options snake_case
 * ('animal_handling') while scholar/duelist use display names with
 * spaces ('animal handling'); both are stored here as the STAGE4
 * display names ('Animal Handling'), the same strings
 * validateCreatorNextStage4 compares against.
 *
 * Full-list fallback (mirrors the Stage 4 client): when a class's
 * options still available after held (theme + feat) skills are
 * removed are fewer than its count, the allowed set expands to
 * the full 18-skill list — the validator applies that rule, this
 * file only carries the per-class counts and options.
 */
export const CLASS_CHASSIS = {
  artificer: { skillChoices: 2, skillOptions: ['Arcana', 'History', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Sleight of Hand'] },
  barbarian: { skillChoices: 2, skillOptions: ['Animal Handling', 'Athletics', 'Intimidation', 'Nature', 'Perception', 'Survival'] },
  bard: { skillChoices: 3, skillOptions: ['Acrobatics', 'Animal Handling', 'Arcana', 'Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Sleight of Hand', 'Stealth', 'Survival'] },
  blackguard: { skillChoices: 2, skillOptions: ['Athletics', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  blood_hunter: { skillChoices: 3, skillOptions: ['Acrobatics', 'Arcana', 'Athletics', 'History', 'Insight', 'Investigation', 'Religion', 'Survival'] },
  cleric: { skillChoices: 2, skillOptions: ['History', 'Insight', 'Medicine', 'Persuasion', 'Religion'] },
  druid: { skillChoices: 2, skillOptions: ['Arcana', 'Animal Handling', 'Insight', 'Medicine', 'Nature', 'Perception', 'Religion', 'Survival'] },
  duelist: { skillChoices: 3, skillOptions: ['Acrobatics', 'Animal Handling', 'Athletics', 'Persuasion', 'Insight', 'Perception', 'Deception', 'Sleight of Hand'] },
  fighter: { skillChoices: 2, skillOptions: ['Acrobatics', 'Animal Handling', 'Athletics', 'History', 'Insight', 'Intimidation', 'Perception', 'Persuasion', 'Survival'] },
  keeper: { skillChoices: 3, skillOptions: ['Arcana', 'Deception', 'History', 'Insight', 'Investigation', 'Perception', 'Performance', 'Persuasion'] },
  magus: { skillChoices: 1, skillOptions: ['Acrobatics', 'Arcana', 'Athletics', 'History', 'Insight', 'Investigation', 'Perception'] },
  monk: { skillChoices: 2, skillOptions: ['Acrobatics', 'Athletics', 'History', 'Insight', 'Religion', 'Stealth'] },
  paladin: { skillChoices: 2, skillOptions: ['Athletics', 'Insight', 'Intimidation', 'Medicine', 'Persuasion', 'Religion'] },
  pugilist: { skillChoices: 2, skillOptions: ['Acrobatics', 'Athletics', 'Deception', 'Intimidation', 'Perception', 'Sleight of Hand', 'Stealth'] },
  ranger: { skillChoices: 3, skillOptions: ['Animal Handling', 'Athletics', 'Insight', 'Investigation', 'Nature', 'Perception', 'Stealth', 'Survival'] },
  rogue: { skillChoices: 4, skillOptions: ['Acrobatics', 'Athletics', 'Deception', 'Insight', 'Intimidation', 'Investigation', 'Perception', 'Persuasion', 'Sleight of Hand', 'Stealth'] },
  scholar: { skillChoices: 3, skillOptions: ['Animal Handling', 'Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Perception', 'Performance', 'Persuasion', 'Religion', 'Survival'] },
  sorcerer: { skillChoices: 2, skillOptions: ['Arcana', 'Deception', 'Insight', 'Intimidation', 'Persuasion', 'Religion'] },
  spellshot: { skillChoices: 2, skillOptions: ['Arcana', 'Acrobatics', 'Intimidation', 'Investigation', 'Sleight of Hand', 'Stealth', 'Survival'] },
  warden: { skillChoices: 2, skillOptions: ['Animal Handling', 'Athletics', 'Nature', 'Perception', 'Survival'] },
  warlock: { skillChoices: 2, skillOptions: ['Arcana', 'Deception', 'History', 'Intimidation', 'Investigation', 'Nature', 'Religion'] },
  warlord: { skillChoices: 3, skillOptions: ['Athletics', 'Deception', 'History', 'Insight', 'Intimidation', 'Investigation', 'Medicine', 'Performance', 'Persuasion'] },
  wizard: { skillChoices: 2, skillOptions: ['Arcana', 'History', 'Insight', 'Investigation', 'Medicine', 'Nature', 'Religion'] },
};

export default CLASS_CHASSIS;
