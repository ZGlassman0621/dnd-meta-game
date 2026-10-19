/**
 * Enemy Combat Service tests (Structural #8: P3-A).
 * Verifies server-side enemy HP + enemy turn resolution.
 */
import { parseDamageDice, parseEnemyStats } from '../server/services/enemyCombatService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== Test 1: parseDamageDice ===\n');
{
  const d1 = parseDamageDice('1d6+2');
  assert(d1 && d1.count === 1 && d1.sides === 6 && d1.modifier === 2, '1d6+2 parses');
  const d2 = parseDamageDice('2d8');
  assert(d2 && d2.count === 2 && d2.sides === 8 && d2.modifier === 0, '2d8 parses (no modifier)');
  const d3 = parseDamageDice('1d12-1');
  assert(d3 && d3.modifier === -1, '1d12-1 parses negative modifier');
  assert(parseDamageDice('xyz') === null, 'Invalid returns null');
  assert(parseDamageDice('') === null, 'Empty returns null');
  assert(parseDamageDice(null) === null, 'Null returns null');
}

console.log('\n=== Test 2: parseEnemyStats (full stat blocks) ===\n');
{
  const e = parseEnemyStats('Goblin (HP 7, AC 15, ATK +4, DMG 1d6+2)');
  assert(e.length === 1, '1 enemy parsed');
  assert(e[0].name === 'Goblin', 'Name parsed');
  assert(e[0].maxHp === 7, 'HP parsed');
  assert(e[0].armorClass === 15, 'AC parsed');
  assert(e[0].attackBonus === 4, 'ATK parsed');
  assert(e[0].damageDice === '1d6+2', 'DMG parsed');
}

console.log('\n=== Test 3: parseEnemyStats (bare names use defaults) ===\n');
{
  const e = parseEnemyStats('Goblin, Orc');
  assert(e.length === 2, '2 enemies parsed');
  assert(e[0].maxHp === 10, 'Default HP 10');
  assert(e[0].armorClass === 12, 'Default AC 12');
  assert(e[0].attackBonus === 3, 'Default ATK +3');
  assert(e[0].damageDice === '1d6', 'Default DMG 1d6');
}

console.log('\n=== Test 4: parseEnemyStats (mixed) ===\n');
{
  const e = parseEnemyStats('Goblin (HP 7, AC 15, ATK +4, DMG 1d6+2), Orc');
  assert(e.length === 2, '2 enemies parsed');
  assert(e[0].maxHp === 7, 'First has custom HP');
  assert(e[1].maxHp === 10, 'Second has default HP');
}

console.log('\n=== Test 5: parseEnemyStats (edge cases) ===\n');
{
  assert(parseEnemyStats('').length === 0, 'Empty string -> empty array');
  assert(parseEnemyStats(null).length === 0, 'Null -> empty array');
  const s = parseEnemyStats('Dragon (HP 200, AC 19, ATK +11, DMG 2d10+6)');
  assert(s.length === 1 && s[0].damageDice === '2d10+6', 'Complex dice parses');
}

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`${'='.repeat(50)}\n`);

process.exit(failed > 0 ? 1 : 0);
