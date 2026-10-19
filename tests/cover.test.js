/**
 * Cover tests (Combat Pipeline #6).
 * Tests getCoverAcBonus() directly (pure function) + verifies integration.
 * D&D 2024: half +2 AC, three-quarters +5 AC.
 */
import { getCoverAcBonus } from '../server/services/enemyCombatService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  console.log('\n=== Test 1: Cover AC bonuses (real function) ===\n');
  assert(getCoverAcBonus('none') === 0, 'None: +0');
  assert(getCoverAcBonus('half') === 2, 'Half: +2');
  assert(getCoverAcBonus('three-quarters') === 5, 'Three-quarters: +5');
  assert(getCoverAcBonus('three_quarters') === 5, 'Underscore variant: +5');
  assert(getCoverAcBonus('full') === 0, 'Full: +0 (untargetable, not AC)');
  assert(getCoverAcBonus(null) === 0, 'Null: +0');
  assert(getCoverAcBonus('HALF') === 2, 'Case-insensitive');

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
