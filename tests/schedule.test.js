/**
 * Schedule Service tests (Travel/Time #13).
 * Real integration: unified timeline + world clock.
 */
import { initDatabase, dbRun } from '../server/database.js';
import { getCurrentDay, advanceDays, scheduleActivity, isAvailable, whereIs, whatCompletesOn, completeDueSchedules } from '../server/services/scheduleService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

async function run() {
  await initDatabase();
  const startDay = await getCurrentDay();

  console.log('\n=== Test 1: Schedule activity ===\n');
  const s = await scheduleActivity({
    entityType: 'companion', entityName: 'Steve', activity: 'scouting',
    location: 'Northern Regions', durationDays: 6,
    details: { dangerLevel: 'moderate', commRange: 'sending stones' }
  });
  assert(s !== null, 'Scheduled');
  assert(s.endDay === startDay + 6, `Ends day ${startDay + 6} (got ${s.endDay})`);

  console.log('\n=== Test 2: Availability check ===\n');
  let avail = await isAvailable('companion', null, 'Steve');
  assert(avail === false, 'Steve unavailable while scouting');
  avail = await isAvailable('companion', null, 'Aldric');
  assert(avail === true, 'Aldric available (no schedule)');

  console.log('\n=== Test 3: Where is ===\n');
  const loc = await whereIs('companion', null, 'Steve');
  assert(loc.activity === 'scouting', `Activity: scouting (got ${loc.activity})`);
  assert(loc.details?.dangerLevel === 'moderate', 'Details preserved');

  console.log('\n=== Test 4: Advance clock, complete ===\n');
  await advanceDays(6);
  const newDay = await getCurrentDay();
  assert(newDay === startDay + 6, `Day advanced (got ${newDay})`);
  const completed = await completeDueSchedules();
  assert(completed.length >= 1, 'Schedule completed');
  avail = await isAvailable('companion', null, 'Steve');
  assert(avail === true, 'Steve available after completion');

  // Cleanup: reset clock, clear schedules
  await dbRun(`DELETE FROM entity_schedule WHERE entity_name = 'Steve'`);

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error('Test failed:', e.message); process.exit(1); });
