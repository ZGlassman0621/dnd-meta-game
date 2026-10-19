/**
 * Bestiary tests (Combat Pipeline #7).
 * Verifies canonical stat lookup.
 */
import { lookupBestiary } from '../server/services/bestiaryService.js';
import { initDatabase } from '../server/database.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  
  console.log('\n=== Test 1: Bestiary lookup ===\n');
  const goblin = await lookupBestiary('goblin');
  assert(goblin !== null, 'Goblin found');
  assert(goblin?.max_hp === 7, 'Goblin HP 7');
  assert(goblin?.armor_class === 15, 'Goblin AC 15');
  assert(goblin?.xp_value === 50, 'Goblin XP 50');
  
  const missing = await lookupBestiary('nonexistent_xyz');
  assert(missing === null || missing === undefined, 'Missing returns null');
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
