/**
 * Tests for DM Mode: marker detection, segment parsing, prompt building.
 * Run: node tests/dm-mode.test.js
 */

import {
  detectSkillChecks,
  detectAttacks,
  detectSpellCasts,
  parseCharacterSegments,
  cleanDMModeNarrative
} from '../server/services/dmModeService.js';

import { parsePartyResponse } from '../server/services/partyGeneratorService.js';

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
    console.error(`  ✗ ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== detectSkillChecks =====
console.log('\ndetectSkillChecks:');

{
  const result = detectSkillChecks('[SKILL_CHECK: Character="Thorn" Skill="Perception" Modifier="+5"]');
  assertEqual(result.length, 1, 'Detects single skill check');
  assertEqual(result[0].character, 'Thorn', 'Parses character name');
  assertEqual(result[0].skill, 'Perception', 'Parses skill name');
  assertEqual(result[0].modifier, '+5', 'Parses modifier');
}

{
  const text = 'The party moves forward. [SKILL_CHECK: Character="Elara" Skill="Stealth" Modifier="+7"] She creeps ahead while [SKILL_CHECK: Character="Dorn" Skill="Athletics" Modifier="+4"] he climbs the wall.';
  const result = detectSkillChecks(text);
  assertEqual(result.length, 2, 'Detects multiple skill checks in one text');
  assertEqual(result[0].character, 'Elara', 'First check character is Elara');
  assertEqual(result[0].skill, 'Stealth', 'First check skill is Stealth');
  assertEqual(result[1].character, 'Dorn', 'Second check character is Dorn');
  assertEqual(result[1].skill, 'Athletics', 'Second check skill is Athletics');
}

{
  const result = detectSkillChecks('Just a normal narrative with no markers.');
  assertEqual(result.length, 0, 'Returns empty array when no skill checks');
}

{
  const result = detectSkillChecks(null);
  assertEqual(result.length, 0, 'Handles null input');
}

{
  const result = detectSkillChecks('');
  assertEqual(result.length, 0, 'Handles empty string');
}

{
  const result = detectSkillChecks('[skill_check: Character="Thorn" Skill="Investigation" Modifier="+3"]');
  assertEqual(result.length, 1, 'Case-insensitive detection');
  assertEqual(result[0].skill, 'Investigation', 'Parses skill from lowercase marker');
}

// ===== detectAttacks =====
console.log('\ndetectAttacks:');

{
  const result = detectAttacks('[ATTACK: Character="Dorn" Target="Goblin" Weapon="Longbow" AttackBonus="+7"]');
  assertEqual(result.length, 1, 'Detects single attack');
  assertEqual(result[0].character, 'Dorn', 'Parses attacker name');
  assertEqual(result[0].target, 'Goblin', 'Parses target');
  assertEqual(result[0].weapon, 'Longbow', 'Parses weapon');
  assertEqual(result[0].attackBonus, '+7', 'Parses attack bonus');
}

{
  const text = '[ATTACK: Character="Thorn" Target="Skeleton 1" Weapon="Longsword" AttackBonus="+6"] Thorn swings at the first skeleton. [ATTACK: Character="Elara" Target="Skeleton 2" Weapon="Shortbow" AttackBonus="+5"] Elara fires from cover.';
  const result = detectAttacks(text);
  assertEqual(result.length, 2, 'Detects multiple attacks');
  assertEqual(result[0].character, 'Thorn', 'First attacker is Thorn');
  assertEqual(result[1].character, 'Elara', 'Second attacker is Elara');
}

{
  const result = detectAttacks('The group rests by the fire.');
  assertEqual(result.length, 0, 'Returns empty array when no attacks');
}

{
  const text = '[ATTACK: Character="Dorn" Target="Bandit" Weapon="Greataxe" AttackBonus="+6"] [SKILL_CHECK: Character="Elara" Skill="Stealth" Modifier="+7"] [CAST_SPELL: Character="Mira" Spell="Fire Bolt" Target="Bandit" Level="0"]';
  const attacks = detectAttacks(text);
  assertEqual(attacks.length, 1, 'Only detects ATTACK markers when mixed with other markers');
  assertEqual(attacks[0].weapon, 'Greataxe', 'Parses correct weapon from mixed markers');
}

{
  const result = detectAttacks(null);
  assertEqual(result.length, 0, 'Handles null input');
}

// ===== detectSpellCasts =====
console.log('\ndetectSpellCasts:');

{
  const result = detectSpellCasts('[CAST_SPELL: Character="Mira" Spell="Healing Word" Target="Dorn" Level="1"]');
  assertEqual(result.length, 1, 'Detects single spell cast');
  assertEqual(result[0].character, 'Mira', 'Parses caster name');
  assertEqual(result[0].spell, 'Healing Word', 'Parses spell name');
  assertEqual(result[0].target, 'Dorn', 'Parses target');
  assertEqual(result[0].level, 1, 'Parses level as integer');
}

{
  const result = detectSpellCasts('[CAST_SPELL: Character="Lyra" Spell="Fireball" Target="Goblin group" Level="3"]');
  assertEqual(result[0].level, 3, 'Parses higher spell level correctly');
  assertEqual(result[0].spell, 'Fireball', 'Parses Fireball spell name');
}

{
  const result = detectSpellCasts('No magic happening here.');
  assertEqual(result.length, 0, 'Returns empty array when no spell casts');
}

{
  const result = detectSpellCasts(null);
  assertEqual(result.length, 0, 'Handles null input');
}

{
  const result = detectSpellCasts('[cast_spell: Character="Mira" Spell="Shield" Target="Self" Level="1"]');
  assertEqual(result.length, 1, 'Case-insensitive detection');
}

// ===== parseCharacterSegments =====
console.log('\nparseCharacterSegments:');

{
  const text = '**Thorn:** I will scout ahead. The path looks dangerous.';
  const result = parseCharacterSegments(text);
  assertEqual(result.length, 1, 'Parses single character segment');
  assertEqual(result[0].character, 'Thorn', 'Character name is Thorn');
  assert(result[0].content.includes('I will scout ahead'), 'Content contains dialogue');
}

{
  const text = '**Thorn:** I will go first.\n**Elara:** Be careful.\n**Dorn:** I have your back.';
  const result = parseCharacterSegments(text);
  assertEqual(result.length, 3, 'Parses three character segments');
  assertEqual(result[0].character, 'Thorn', 'First character is Thorn');
  assertEqual(result[1].character, 'Elara', 'Second character is Elara');
  assertEqual(result[2].character, 'Dorn', 'Third character is Dorn');
}

{
  const text = 'The wind howls through the mountain pass. Dark clouds gather overhead.';
  const result = parseCharacterSegments(text);
  assertEqual(result.length, 1, 'Returns single segment for plain narration');
  assertEqual(result[0].character, null, 'Character is null for narration');
  assert(result[0].content.includes('wind howls'), 'Narration content preserved');
}

{
  const text = 'The tavern is crowded tonight.\n\n**Thorn:** I approach the bar.\n**Elara:** I watch the exits.';
  const result = parseCharacterSegments(text);
  assertEqual(result[0].character, null, 'First segment is narration');
  assertEqual(result[1].character, 'Thorn', 'Second segment is Thorn');
  assertEqual(result[2].character, 'Elara', 'Third segment is Elara');
}

{
  const result = parseCharacterSegments(null);
  assertEqual(result.length, 0, 'Returns empty array for null input');
}

{
  const result = parseCharacterSegments('');
  assertEqual(result.length, 0, 'Returns empty array for empty string');
}

{
  const text = '**Thorn:** I draw my sword.';
  const result = parseCharacterSegments(text);
  assertEqual(result[0].character, 'Thorn', 'Parses **Name:** pattern with colon inside bold');
}

{
  const text = '**Thorn** I draw my sword.';
  const result = parseCharacterSegments(text);
  assertEqual(result[0].character, 'Thorn', 'Parses **Name** pattern without colon');
}

{
  const text = '**Thorn:** I speak first.\nThis is still Thorn talking.\nAnother line of Thorn.\n**Elara:** My turn now.';
  const result = parseCharacterSegments(text);
  assertEqual(result.length, 2, 'Multi-line content grouped under one character');
  assert(result[0].content.includes('still Thorn talking'), 'Continuation lines belong to Thorn');
  assertEqual(result[1].character, 'Elara', 'Next character starts new segment');
}

// ===== cleanDMModeNarrative =====
console.log('\ncleanDMModeNarrative:');

{
  const text = 'Thorn looks around carefully. [SKILL_CHECK: Character="Thorn" Skill="Perception" Modifier="+5"] He notices movement.';
  const result = cleanDMModeNarrative(text);
  assert(!result.includes('[SKILL_CHECK'), 'Removes SKILL_CHECK markers');
  assert(result.includes('Thorn looks around carefully'), 'Preserves narrative before marker');
  assert(result.includes('He notices movement'), 'Preserves narrative after marker');
}

{
  const text = 'Dorn charges! [ATTACK: Character="Dorn" Target="Goblin" Weapon="Greataxe" AttackBonus="+6"] The goblin staggers.';
  const result = cleanDMModeNarrative(text);
  assert(!result.includes('[ATTACK'), 'Removes ATTACK markers');
}

{
  const text = 'Mira raises her hand. [CAST_SPELL: Character="Mira" Spell="Fire Bolt" Target="Skeleton" Level="0"] Flames streak forward.';
  const result = cleanDMModeNarrative(text);
  assert(!result.includes('[CAST_SPELL'), 'Removes CAST_SPELL markers');
}

{
  const text = 'The group argues. [PARTY_ARGUMENT: Characters="Thorn, Elara" Topic="Whether to enter the dungeon"] Tensions rise.';
  const result = cleanDMModeNarrative(text);
  assert(!result.includes('[PARTY_ARGUMENT'), 'Removes PARTY_ARGUMENT markers');
}

{
  const text = 'Just a normal sentence without any markers at all.';
  const result = cleanDMModeNarrative(text);
  assertEqual(result, text, 'Preserves text with no markers');
}

{
  const text = 'Before.\n\n\n\n\nAfter.';
  const result = cleanDMModeNarrative(text);
  assert(!result.includes('\n\n\n'), 'Collapses triple+ newlines to double');
}

{
  const result = cleanDMModeNarrative(null);
  assertEqual(result, null, 'Null input returns null');
}

{
  const result = cleanDMModeNarrative('');
  assertEqual(result, '', 'Empty string returns empty string');
}

// ===== parsePartyResponse =====
console.log('\nparsePartyResponse:');

{
  const makeChar = (name, overrides = {}) => ({
    name,
    race: 'Human',
    class: 'Fighter',
    level: 3,
    max_hp: 28,
    current_hp: 28,
    armor_class: 16,
    ability_scores: { str: 16, dex: 12, con: 14, int: 10, wis: 13, cha: 8 },
    alignment: 'Neutral Good',
    ...overrides
  });

  const validParty = JSON.stringify({
    party_name: 'The Iron Accord',
    party_concept: 'Bound by a shared debt to a merchant prince.',
    characters: [
      makeChar('Thorn'),
      makeChar('Elara', { class: 'Rogue' }),
      makeChar('Mira', { class: 'Wizard' }),
      makeChar('Dorn', { class: 'Cleric' })
    ],
    tensions: ['Thorn distrusts Elara', 'Mira hides a secret', 'Dorn resents the group']
  });

  const result = parsePartyResponse(validParty);
  assertEqual(result.party_name, 'The Iron Accord', 'Parses party name');
  assertEqual(result.characters.length, 4, 'Parses 4 characters');
  assertEqual(result.characters[0].name, 'Thorn', 'First character is Thorn');
}

{
  const makeChar = (name) => ({
    name,
    race: 'Elf',
    class: 'Ranger',
    level: 3,
    max_hp: 24,
    current_hp: 24,
    armor_class: 14,
    ability_scores: { str: 10, dex: 16, con: 12, int: 13, wis: 14, cha: 8 },
    alignment: 'Chaotic Good'
  });

  const json = JSON.stringify({
    party_name: 'Fenced Party',
    party_concept: 'Testing code fence stripping.',
    characters: [makeChar('A'), makeChar('B'), makeChar('C'), makeChar('D')],
    tensions: []
  });
  const wrapped = '```json\n' + json + '\n```';
  const result = parsePartyResponse(wrapped);
  assertEqual(result.party_name, 'Fenced Party', 'Parses JSON wrapped in code fences');
  assertEqual(result.characters.length, 4, 'Has 4 characters after fence stripping');
}

{
  const tooFew = JSON.stringify({
    party_name: 'Short Party',
    party_concept: 'Only 2 members.',
    characters: [{ name: 'A' }, { name: 'B' }],
    tensions: []
  });
  let threw = false;
  try {
    parsePartyResponse(tooFew);
  } catch (e) {
    threw = true;
    assert(e.message.includes('exactly 4'), 'Error message mentions needing 4 characters');
  }
  assert(threw, 'Throws error for party with fewer than 4 characters');
}

{
  const makeChar = (name) => ({
    name,
    race: 'Dwarf',
    class: 'Paladin',
    level: 5,
    max_hp: 40,
    current_hp: 40,
    armor_class: 18,
    ability_scores: { str: 16, dex: 10, con: 14, int: 8, wis: 13, cha: 15 },
    alignment: 'Lawful Good'
  });

  const json = JSON.stringify({
    party_name: 'Color Test',
    party_concept: 'Testing color assignment.',
    characters: [makeChar('A'), makeChar('B'), makeChar('C'), makeChar('D')],
    tensions: []
  });

  const result = parsePartyResponse(json);
  assertEqual(result.characters[0].color, '#60a5fa', 'First character gets blue');
  assertEqual(result.characters[1].color, '#c084fc', 'Second character gets purple');
  assertEqual(result.characters[2].color, '#10b981', 'Third character gets green');
  assertEqual(result.characters[3].color, '#f59e0b', 'Fourth character gets amber');
}

{
  const makeChar = (name, current_hp) => ({
    name,
    race: 'Halfling',
    class: 'Bard',
    level: 3,
    max_hp: 22,
    current_hp,
    armor_class: 13,
    ability_scores: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 16 },
    alignment: 'Chaotic Neutral'
  });

  const json = JSON.stringify({
    party_name: 'HP Default Test',
    party_concept: 'Testing current_hp default.',
    characters: [
      makeChar('Full', 22),
      makeChar('Missing', 0),
      makeChar('Also Full', 22),
      makeChar('Also Full 2', 22)
    ],
    tensions: []
  });

  const result = parsePartyResponse(json);
  assertEqual(result.characters[1].current_hp, 22, 'Missing current_hp (falsy 0) defaults to max_hp');
}

// ===== Summary =====
console.log(`\n${'='.repeat(40)}`);
console.log(`DM Mode: ${passed} passed, ${failed} failed`);
console.log('='.repeat(40));

if (failed > 0) process.exit(1);
