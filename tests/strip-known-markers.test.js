/**
 * Equivalence test for markerSchemas.stripKnownMarkers().
 *
 * stripKnownMarkers() replaces the per-turn route's 31-call inline .replace()
 * chain that scrubbed DM markers from player-facing narrative. This test
 * reconstructs that EXACT old chain as an oracle and asserts byte-identical
 * output across a battery of inputs — the proof that the consolidation is
 * behavior-preserving. If they ever diverge, this fails loudly.
 */

import assert from 'node:assert/strict';
import { stripKnownMarkers, STRIP_MARKER_KEYS } from '../server/services/markerSchemas.js';

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.log(`  ✗ FAIL: ${name}`); console.log(`    ${err.message}`); failed++; }
}

// The ORIGINAL strip chain, copied verbatim from routes/dmSession.js (pre-refactor),
// in the exact order it ran. This is the oracle stripKnownMarkers must match.
function oldChain(input) {
  let cleanNarrative = input;
  cleanNarrative = cleanNarrative.replace(/\[SCENE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[MERCHANT_SHOP:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[MERCHANT_REFER:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[ADD_ITEM:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[LOOT_DROP:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[COMBAT_START:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[COMBAT_END\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[HP_CHANGE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[EFFECT_START:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[EFFECT_END:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[TURN:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[ROLL_REQUEST:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[SKILL_CHECK:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[CONDITION_ADD:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[CONDITION_REMOVE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[WEATHER_CHANGE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[SHELTER_FOUND:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[SWIM:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[EAT:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[DRINK:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[FORAGE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[RECIPE_FOUND:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[MATERIAL_FOUND:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[CRAFT_PROGRESS:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[RECIPE_GIFT:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[MYTHIC_TRIAL:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[PIETY_CHANGE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[ITEM_AWAKEN:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[MYTHIC_SURGE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[PROMISE_MADE:[^\]]+\]\s*/gi, '').trim();
  cleanNarrative = cleanNarrative.replace(/\[PROMISE_FULFILLED:[^\]]+\]\s*/gi, '').trim();
  return cleanNarrative;
}

console.log('\n=== stripKnownMarkers ≡ legacy 31-call chain ===\n');

const cases = [
  // basic / empty
  'No markers at all in this prose.',
  '',
  '   ',
  '\n\n',
  // each bodied marker individually
  'Pre [SCENE: place="cave"] post',
  'Pre [MERCHANT_SHOP: name="Bob"] post',
  'Pre [MERCHANT_REFER: to="Sue"] post',
  'Pre [ADD_ITEM: Item="Torch"] post',
  'Pre [LOOT_DROP: Item="Gold" Source="chest"] post',
  'Pre [COMBAT_START: Enemies="Goblin, Orc"] post',
  'Pre [HP_CHANGE: Target="Player" Delta=-8 Reason="club"] post',
  'Pre [EFFECT_START: Name="Bless" Concentration=true] post',
  'Pre [EFFECT_END: Name="Bless"] post',
  'Pre [TURN: Combatant="Goblin" Round=2] post',
  'Pre [ROLL_REQUEST: Kind="check" Ability="Perception" DC=15] post',
  'Pre [SKILL_CHECK: skill="Stealth" dc=12] post',
  'Pre [CONDITION_ADD: Target="Player" Condition="poisoned"] post',
  'Pre [CONDITION_REMOVE: Target="Player" Condition="poisoned"] post',
  'Pre [WEATHER_CHANGE: to="storm"] post',
  'Pre [SHELTER_FOUND: type="cave"] post',
  'Pre [SWIM: distance="30ft"] post',
  'Pre [EAT: food="ration"] post',
  'Pre [DRINK: water="canteen"] post',
  'Pre [FORAGE: terrain="forest"] post',
  'Pre [RECIPE_FOUND: name="Healing Salve"] post',
  'Pre [MATERIAL_FOUND: name="Iron Ore"] post',
  'Pre [CRAFT_PROGRESS: project="Sword" pct=50] post',
  'Pre [RECIPE_GIFT: name="Elixir" from="Mara"] post',
  'Pre [MYTHIC_TRIAL: name="Trial of Fire"] post',
  'Pre [PIETY_CHANGE: deity="Helm" delta=3] post',
  'Pre [ITEM_AWAKEN: item="Blade"] post',
  'Pre [MYTHIC_SURGE: die="d8"] post',
  'Pre [PROMISE_MADE: NPC="Elara" Promise="x" Weight="major"] post',
  'Pre [PROMISE_FULFILLED: NPC="Elara"] post',
  // bodyless COMBAT_END
  'Victory at last. [COMBAT_END] The dust settles.',
  'Victory. [COMBAT_END]',
  '[COMBAT_END] Aftermath.',
  // bodyless forms of BODIED markers must be LEFT ALONE (no colon body)
  'A bracketed [TURN] without body stays.',
  'A bracketed [LOOT_DROP] without body stays.',
  // multiple markers, mixed
  'You strike. [COMBAT_START: Enemies="Goblin"] It snarls. [HP_CHANGE: Delta=-5] You stagger. [COMBAT_END] Done.',
  '[SCENE: place="hall"] [MERCHANT_SHOP: name="Bob"] Welcome traveler!',
  // adjacent markers, no spaces
  'Start[LOOT_DROP: Item="A"][COMBAT_START: Enemies="B"]end',
  // marker at very start and end
  '[CONDITION_ADD: Target="Player" Condition="prone"]You fall.',
  'You recover.[CONDITION_REMOVE: Target="Player" Condition="prone"]',
  // repeated same marker
  '[LOOT_DROP: Item="A"] mid [LOOT_DROP: Item="B"] end',
  // multiline
  'Line one.\n[COMBAT_START: Enemies="Wolf"]\nLine two.\n[COMBAT_END]\nLine three.',
  // body containing punctuation / numbers
  'Pre [HP_CHANGE: Delta=-12 Reason="2d6 fire, save failed"] post',
  // trailing whitespace around markers
  'Word   [LOOT_DROP: Item="X"]   Word',
];

for (const input of cases) {
  test(`matches legacy chain: ${JSON.stringify(input).slice(0, 56)}`, () => {
    assert.equal(stripKnownMarkers(input), oldChain(input));
  });
}

console.log('\n=== guards ===\n');

test('non-string input returned unchanged (null/undefined)', () => {
  assert.equal(stripKnownMarkers(null), null);
  assert.equal(stripKnownMarkers(undefined), undefined);
});

test('STRIP_MARKER_KEYS covers all 31 legacy markers + SET_FACT (Phase 2)', () => {
  // 31 legacy bodied+bodyless markers, plus SET_FACT added in Phase 2.
  assert.equal(STRIP_MARKER_KEYS.length, 32);
  for (const k of ['SCENE', 'COMBAT_END', 'LOOT_DROP', 'HP_CHANGE', 'PROMISE_FULFILLED', 'SET_FACT']) {
    assert.ok(STRIP_MARKER_KEYS.includes(k), `${k} present`);
  }
});

console.log(`\n==================================================`);
console.log(`stripKnownMarkers equivalence: ${passed} passed, ${failed} failed`);
console.log(`==================================================\n`);
process.exit(failed === 0 ? 0 : 1);
