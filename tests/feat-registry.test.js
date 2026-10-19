/**
 * Feat Registry tests.
 * Verifies the data-driven feat lookup: core 5e feats, homebrew feats,
 * name normalization, grouping, and prompt rendering with override framing.
 */

import { getFeatEffect, getFeatEffects, renderFeatEffectsForPrompt, normalizeFeatName, listHomebrewRulesets } from '../server/data/featRegistry.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== Test 1: Core feat lookup ===\n');
{
  const alert = getFeatEffect('Alert');
  assert(alert !== null, 'Alert resolves');
  assert(alert.source === 'core', 'Alert source is core');
  const gwm = getFeatEffect('great_weapon_master');
  assert(gwm !== null, 'great_weapon_master resolves');
}

console.log('\n=== Test 2: Normalization ===\n');
{
  assert(normalizeFeatName('Great-Weapon-Master') === 'great weapon master', 'Hyphens normalized');
  assert(normalizeFeatName(null) === '', 'Null safe');
}

console.log('\n=== Test 3: Homebrew lookup ===\n');
{
  const rulesets = listHomebrewRulesets();
  assert(rulesets.includes('manual-of-martial-mastery'), 'Manual ruleset discovered');
  const battleaxe = getFeatEffect('Battleaxe Mastery');
  assert(battleaxe !== null, 'Battleaxe Mastery resolves');
  assert(battleaxe.source === 'homebrew', 'Source is homebrew');
}

console.log('\n=== Test 4: Grouped ===\n');
{
  const grouped = getFeatEffects(['Alert', 'Battleaxe Mastery', 'Fake']);
  assert(grouped.core.length === 1, '1 core');
  assert(grouped.homebrew.length === 1, '1 homebrew');
  assert(grouped.unknown.length === 1, '1 unknown');
}

console.log('\n=== Test 5: Rendering ===\n');
{
  const rendered = renderFeatEffectsForPrompt(['Alert', 'Battleaxe Mastery']);
  assert(rendered.includes('OVERRIDE'), 'Override framing present');
  assert(rendered.includes('HOMEBREW FEAT EFFECTS'), 'Homebrew header present');
}

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
