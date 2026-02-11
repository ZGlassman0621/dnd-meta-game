/**
 * Tests for companion skill modifier calculation and prompt injection.
 * Run: node tests/companion-skill-checks.test.js
 */

import { SKILL_ABILITY_MAP, computeSkillModifiers, computePassivePerception } from '../server/services/dmPromptBuilder.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message} — expected ${expected}, got ${actual}`);
    failed++;
  }
}

// ===== SKILL_ABILITY_MAP =====
console.log('\nSKILL_ABILITY_MAP:');

{
  const allSkills = [
    'Acrobatics', 'Animal Handling', 'Arcana', 'Athletics',
    'Deception', 'History', 'Insight', 'Intimidation',
    'Investigation', 'Medicine', 'Nature', 'Perception',
    'Performance', 'Persuasion', 'Religion', 'Sleight of Hand',
    'Stealth', 'Survival'
  ];
  assertEqual(Object.keys(SKILL_ABILITY_MAP).length, 18, 'Has all 18 D&D 5e skills');
  for (const skill of allSkills) {
    assert(SKILL_ABILITY_MAP[skill] !== undefined, `Maps ${skill}`);
  }
}

{
  // Verify correct ability mappings
  assertEqual(SKILL_ABILITY_MAP['Acrobatics'], 'dex', 'Acrobatics maps to dex');
  assertEqual(SKILL_ABILITY_MAP['Athletics'], 'str', 'Athletics maps to str');
  assertEqual(SKILL_ABILITY_MAP['Arcana'], 'int', 'Arcana maps to int');
  assertEqual(SKILL_ABILITY_MAP['Perception'], 'wis', 'Perception maps to wis');
  assertEqual(SKILL_ABILITY_MAP['Persuasion'], 'cha', 'Persuasion maps to cha');
  assertEqual(SKILL_ABILITY_MAP['Stealth'], 'dex', 'Stealth maps to dex');
  assertEqual(SKILL_ABILITY_MAP['Medicine'], 'wis', 'Medicine maps to wis');
  assertEqual(SKILL_ABILITY_MAP['Intimidation'], 'cha', 'Intimidation maps to cha');
}

// ===== computeSkillModifiers =====
console.log('\ncomputeSkillModifiers:');

{
  // Level 1, 14 DEX, proficiency in Stealth
  const scores = { str: 10, dex: 14, con: 12, int: 10, wis: 12, cha: 8 };
  const result = computeSkillModifiers(scores, ['Stealth'], 1);
  // DEX mod = +2, prof bonus at level 1 = +2, total = +4
  assertEqual(result.length, 1, 'Returns 1 skill modifier');
  assertEqual(result[0], 'Stealth +4', 'Level 1: Stealth with 14 DEX = +4');
}

{
  // Level 5, 16 WIS, proficiency in Perception and Insight
  const scores = { str: 10, dex: 12, con: 14, int: 10, wis: 16, cha: 10 };
  const result = computeSkillModifiers(scores, ['Perception', 'Insight'], 5);
  // WIS mod = +3, prof bonus at level 5 = +3, total = +6
  assertEqual(result.length, 2, 'Returns 2 skill modifiers');
  assertEqual(result[0], 'Perception +6', 'Level 5: Perception with 16 WIS = +6');
  assertEqual(result[1], 'Insight +6', 'Level 5: Insight with 16 WIS = +6');
}

{
  // Level 9, 20 DEX, proficiency in Stealth and Acrobatics
  const scores = { str: 8, dex: 20, con: 12, int: 10, wis: 10, cha: 14 };
  const result = computeSkillModifiers(scores, ['Stealth', 'Acrobatics'], 9);
  // DEX mod = +5, prof bonus at level 9 = +4, total = +9
  assertEqual(result[0], 'Stealth +9', 'Level 9: Stealth with 20 DEX = +9');
  assertEqual(result[1], 'Acrobatics +9', 'Level 9: Acrobatics with 20 DEX = +9');
}

{
  // Level 1, 8 CHA, proficiency in Persuasion (negative ability mod)
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 8 };
  const result = computeSkillModifiers(scores, ['Persuasion'], 1);
  // CHA mod = -1, prof bonus = +2, total = +1
  assertEqual(result[0], 'Persuasion +1', 'Negative ability mod still adds proficiency: CHA 8 = +1');
}

{
  // Empty skills list
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  const result = computeSkillModifiers(scores, [], 5);
  assertEqual(result.length, 0, 'Returns empty array for no skills');
}

{
  // Unknown skill is skipped
  const scores = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
  const result = computeSkillModifiers(scores, ['FakeSkill', 'Stealth'], 1);
  assertEqual(result.length, 1, 'Skips unknown skills');
  assertEqual(result[0], 'Stealth +4', 'Still computes known skills correctly');
}

{
  // Null/undefined level defaults to 1
  const scores = { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 };
  const result = computeSkillModifiers(scores, ['Stealth'], null);
  // prof bonus = Math.floor((1 - 1) / 4) + 2 = 2, DEX +2, total = +4
  assertEqual(result[0], 'Stealth +4', 'Null level defaults to 1');
}

{
  // Multiple skills across different abilities
  const scores = { str: 16, dex: 14, con: 12, int: 18, wis: 10, cha: 8 };
  const result = computeSkillModifiers(scores, ['Athletics', 'Stealth', 'Arcana', 'Perception'], 5);
  // Athletics: STR +3 + prof +3 = +6
  // Stealth: DEX +2 + prof +3 = +5
  // Arcana: INT +4 + prof +3 = +7
  // Perception: WIS +0 + prof +3 = +3
  assertEqual(result.length, 4, 'Handles multiple skills across abilities');
  assertEqual(result[0], 'Athletics +6', 'Athletics: STR 16, level 5 = +6');
  assertEqual(result[1], 'Stealth +5', 'Stealth: DEX 14, level 5 = +5');
  assertEqual(result[2], 'Arcana +7', 'Arcana: INT 18, level 5 = +7');
  assertEqual(result[3], 'Perception +3', 'Perception: WIS 10, level 5 = +3');
}

// ===== Proficiency bonus scaling =====
console.log('\nProficiency bonus scaling:');

{
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  // All ability mods are 0, so result = proficiency bonus only
  const getBonus = (level) => {
    const r = computeSkillModifiers(scores, ['Athletics'], level);
    return parseInt(r[0].replace('Athletics ', ''));
  };
  assertEqual(getBonus(1), 2, 'Prof bonus at level 1 = +2');
  assertEqual(getBonus(4), 2, 'Prof bonus at level 4 = +2');
  assertEqual(getBonus(5), 3, 'Prof bonus at level 5 = +3');
  assertEqual(getBonus(8), 3, 'Prof bonus at level 8 = +3');
  assertEqual(getBonus(9), 4, 'Prof bonus at level 9 = +4');
  assertEqual(getBonus(12), 4, 'Prof bonus at level 12 = +4');
  assertEqual(getBonus(13), 5, 'Prof bonus at level 13 = +5');
  assertEqual(getBonus(16), 5, 'Prof bonus at level 16 = +5');
  assertEqual(getBonus(17), 6, 'Prof bonus at level 17 = +6');
  assertEqual(getBonus(20), 6, 'Prof bonus at level 20 = +6');
}

// ===== computePassivePerception =====
console.log('\ncomputePassivePerception:');

{
  // 14 WIS, proficient in Perception, level 1
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 };
  const result = computePassivePerception(scores, ['Perception'], 1);
  // 10 + WIS mod(+2) + prof(+2) = 14
  assertEqual(result, 14, 'With Perception proficiency: 10 + 2 + 2 = 14');
}

{
  // 14 WIS, NOT proficient in Perception, level 1
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 };
  const result = computePassivePerception(scores, ['Stealth'], 1);
  // 10 + WIS mod(+2) + 0 = 12
  assertEqual(result, 12, 'Without Perception proficiency: 10 + 2 + 0 = 12');
}

{
  // 20 WIS, proficient, level 9
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 20, cha: 10 };
  const result = computePassivePerception(scores, ['Perception', 'Insight'], 9);
  // 10 + WIS mod(+5) + prof(+4) = 19
  assertEqual(result, 19, 'High WIS + high level: 10 + 5 + 4 = 19');
}

{
  // 8 WIS, no proficiency
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 };
  const result = computePassivePerception(scores, [], 1);
  // 10 + WIS mod(-1) = 9
  assertEqual(result, 9, 'Low WIS, no proficiency: 10 + (-1) = 9');
}

{
  // Case insensitive Perception check
  const scores = { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 10 };
  const result = computePassivePerception(scores, ['perception'], 1);
  // 10 + WIS mod(+1) + prof(+2) = 13
  assertEqual(result, 13, 'Case-insensitive perception detection: 10 + 1 + 2 = 13');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`Companion Skill Checks: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) process.exit(1);
