/**
 * Marker Detection Tests — Comprehensive coverage for all AI marker parsing functions.
 * Tests the shared parseMarkerPairs utility, parseNpcJoinMarker, condition
 * detection, and marker stripping. The six legacy detect-functions it once
 * covered (merchant shop/refer, add item, loot drop, combat start/end) were
 * deleted in l1-l6-cleanup (v1.0.229); markerSchemas + markerPipeline own
 * those markers, with their own suites.
 */

import {
  parseMarkerPairs,
  parseNpcJoinMarker
} from '../server/services/dmSessionService.js';

import { detectConditionChanges } from '../server/data/conditions.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. parseMarkerPairs — shared utility
// ============================================================
console.log('\n=== Test 1: parseMarkerPairs — Core Parsing ===\n');

// Standard double-quoted values
let result = parseMarkerPairs('Merchant="Garrick" Type="blacksmith" Location="Main Street"');
assert(result.merchant === 'Garrick', 'Double-quoted: Merchant=Garrick');
assert(result.type === 'blacksmith', 'Double-quoted: Type=blacksmith');
assert(result.location === 'Main Street', 'Double-quoted: Location=Main Street');

// Single-quoted values
result = parseMarkerPairs("Name='Healing Potion' Price_GP='50'");
assert(result.name === 'Healing Potion', 'Single-quoted: Name=Healing Potion');
assert(result.price_gp === '50', 'Single-quoted: Price_GP=50');

// Unquoted bare words
result = parseMarkerPairs('Name=Sword Price_GP=25');
assert(result.name === 'Sword', 'Unquoted: Name=Sword');
assert(result.price_gp === '25', 'Unquoted: Price_GP=25');

// Spaces around =
result = parseMarkerPairs('Merchant = "Garrick" Type = "general"');
assert(result.merchant === 'Garrick', 'Spaces around =: Merchant=Garrick');
assert(result.type === 'general', 'Spaces around =: Type=general');

// Empty quoted values
result = parseMarkerPairs('Name="" Description=""');
assert(result.name === '', 'Empty double-quoted: Name=""');
assert(result.description === '', 'Empty double-quoted: Description=""');

// Mixed formats
result = parseMarkerPairs('Name="Flame Tongue" Price_GP=5000 Quality=\'masterwork\'');
assert(result.name === 'Flame Tongue', 'Mixed: double-quoted name');
assert(result.price_gp === '5000', 'Mixed: unquoted number');
assert(result.quality === 'masterwork', 'Mixed: single-quoted quality');

// Keys are lowercased
result = parseMarkerPairs('MERCHANT="Test" Type="weapon"');
assert(result.merchant === 'Test', 'Key case: MERCHANT lowercased');
assert(result.type === 'weapon', 'Key case: Type lowercased');

// Empty string input
result = parseMarkerPairs('');
assert(Object.keys(result).length === 0, 'Empty string returns empty object');

// ============================================================
// 8. parseNpcJoinMarker
// ============================================================
console.log('\n=== Test 8: parseNpcJoinMarker ===\n');

let join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name="Elara" Race="Elf" Gender="Female" Occupation="Ranger" Reason="Shared enemy"]');
assert(join !== null, 'Detects join marker');
assert(join.npcName === 'Elara', 'Parses NPC name');
assert(join.npcData.race === 'Elf', 'Parses race');
assert(join.npcData.gender === 'Female', 'Parses gender');
assert(join.npcData.occupation === 'Ranger', 'Parses occupation');
assert(join.npcData.reason === 'Shared enemy', 'Parses reason');
assert(join.trigger === 'structured_marker', 'Trigger is structured_marker');

// Defaults
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name="Test"]');
assert(join.npcData.race === 'Human', 'Default race is Human');
assert(join.npcData.gender === null, 'Default gender is null');

// Missing name
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Race="Dwarf"]');
assert(join === null, 'Returns null when Name missing');

// Spaces around =
join = parseNpcJoinMarker('[NPC_WANTS_TO_JOIN: Name = "Garrick" Race = "Human"]');
assert(join !== null, 'Handles spaces around =');
assert(join.npcName === 'Garrick', 'Name parsed with spaces');

// No marker
assert(parseNpcJoinMarker('No marker here') === null, 'No marker returns null');

// ============================================================
// 9. detectConditionChanges — flexible field order
// ============================================================
console.log('\n=== Test 9: detectConditionChanges — Flexible Parsing ===\n');

// Standard order
let cond = detectConditionChanges('[CONDITION_ADD: Target="Player" Condition="Poisoned"]');
assert(cond.applied.length === 1, 'Detects condition add');
assert(cond.applied[0].target === 'Player', 'Target parsed');
assert(cond.applied[0].condition === 'poisoned', 'Condition lowercased');

// Reversed field order
cond = detectConditionChanges('[CONDITION_ADD: Condition="Frightened" Target="Elara"]');
assert(cond.applied.length === 1, 'Reversed order: detected');
assert(cond.applied[0].target === 'Elara', 'Reversed order: target correct');
assert(cond.applied[0].condition === 'frightened', 'Reversed order: condition correct');

// Spaces around =
cond = detectConditionChanges('[CONDITION_ADD: Target = "Player" Condition = "Stunned"]');
assert(cond.applied.length === 1, 'Spaces around =: detected');
assert(cond.applied[0].condition === 'stunned', 'Spaces around =: condition correct');

// Single quotes
cond = detectConditionChanges("[CONDITION_ADD: Target='Player' Condition='Blinded']");
assert(cond.applied.length === 1, 'Single quotes: detected');
assert(cond.applied[0].condition === 'blinded', 'Single quotes: condition correct');

// Remove
cond = detectConditionChanges('[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]');
assert(cond.removed.length === 1, 'Detects condition remove');
assert(cond.removed[0].condition === 'poisoned', 'Remove: condition correct');

// Multiple conditions
cond = detectConditionChanges(
  '[CONDITION_ADD: Target="Player" Condition="Prone"] ' +
  '[CONDITION_ADD: Target="Elara" Condition="Charmed"] ' +
  '[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]'
);
assert(cond.applied.length === 2, 'Multiple adds detected');
assert(cond.removed.length === 1, 'Mixed add/remove detected');

// Exhaustion space → underscore
cond = detectConditionChanges('[CONDITION_ADD: Target="Player" Condition="Exhaustion 1"]');
assert(cond.applied[0].condition === 'exhaustion_1', 'Exhaustion space converted to underscore');

// Missing fields
cond = detectConditionChanges('[CONDITION_ADD: Target="Player"]');
assert(cond.applied.length === 0, 'Missing Condition: not added');

cond = detectConditionChanges('[CONDITION_ADD: Condition="Poisoned"]');
assert(cond.applied.length === 0, 'Missing Target: not added');

// Null/empty
cond = detectConditionChanges(null);
assert(cond.applied.length === 0 && cond.removed.length === 0, 'Null returns empty arrays');

cond = detectConditionChanges('');
assert(cond.applied.length === 0 && cond.removed.length === 0, 'Empty returns empty arrays');

// ============================================================
// 10. Detection/Stripping consistency
// ============================================================
console.log('\n=== Test 10: Detection/Stripping Consistency ===\n');

// All detectable markers should also be strippable
const stripRegexes = [
  /\[MERCHANT_SHOP:[^\]]+\]\s*/gi,
  /\[MERCHANT_REFER:[^\]]+\]\s*/gi,
  /\[ADD_ITEM:[^\]]+\]\s*/gi,
  /\[LOOT_DROP:[^\]]+\]\s*/gi,
  /\[COMBAT_START:[^\]]+\]\s*/gi,
  /\[COMBAT_END\]\s*/gi,
  /\[CONDITION_ADD:[^\]]+\]\s*/gi,
  /\[CONDITION_REMOVE:[^\]]+\]\s*/gi,
  /\[NPC_WANTS_TO_JOIN:[^\]]+\]\s*/gi
];

const testMarkers = [
  '[MERCHANT_SHOP: Merchant="Test" Type="general"]',
  '[MERCHANT_REFER: From="A" To="B" Item="C"]',
  '[ADD_ITEM: Name="Sword" Price_GP=50]',
  '[LOOT_DROP: Item="Gold" Source="Chest"]',
  '[COMBAT_START: Enemies="Goblin, Wolf"]',
  '[COMBAT_END]',
  '[CONDITION_ADD: Target="Player" Condition="Poisoned"]',
  '[CONDITION_REMOVE: Target="Player" Condition="Poisoned"]',
  '[NPC_WANTS_TO_JOIN: Name="Elara" Race="Elf"]'
];

for (const marker of testMarkers) {
  let stripped = marker;
  for (const regex of stripRegexes) {
    stripped = stripped.replace(regex, '');
  }
  assert(stripped.trim() === '', `Marker stripped cleanly: ${marker.substring(0, 30)}...`);
}

// ============================================================
// Results
// ============================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));
process.exit(failed > 0 ? 1 : 0);
