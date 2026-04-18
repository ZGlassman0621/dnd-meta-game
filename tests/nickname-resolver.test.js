/**
 * Nickname resolver tests.
 *
 * These are integration-style tests that hit the real DB — they create a
 * throwaway character + NPCs + relationships prefixed TEST_, exercise
 * resolveForNpc against every audience rule (default, friends, allied,
 * devoted, specific_npc, role, bard override), and clean up on exit.
 *
 * Run: node tests/nickname-resolver.test.js
 */

import { initDatabase, dbGet, dbRun, dbAll } from '../server/database.js';
import * as nicknameService from '../server/services/nicknameService.js';
import * as relationshipService from '../server/services/npcRelationshipService.js';
import { formatResolutionForPrompt } from '../server/services/nicknameService.js';

let passed = 0;
let failed = 0;

function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

async function main() {
  await initDatabase();

  // Cleanup any leftover test fixtures from a prior failed run.
  // FK order: relationships → characters → npcs. (nicknames cascade from characters.)
  const stale = await dbAll(
    `SELECT id FROM characters WHERE name LIKE 'TEST_NICK_%'`
  );
  if (stale.length > 0) {
    const ids = stale.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await dbRun(
      `DELETE FROM npc_relationships WHERE character_id IN (${placeholders})`,
      ids
    );
  }
  await dbRun(`DELETE FROM characters WHERE name LIKE 'TEST_NICK_%'`);
  const staleNpcs = await dbAll(
    `SELECT id FROM npcs WHERE name LIKE 'TEST_NICK_%'`
  );
  if (staleNpcs.length > 0) {
    const ids = staleNpcs.map(r => r.id);
    const placeholders = ids.map(() => '?').join(',');
    await dbRun(
      `DELETE FROM npc_relationships WHERE npc_id IN (${placeholders})`,
      ids
    );
  }
  await dbRun(`DELETE FROM npcs WHERE name LIKE 'TEST_NICK_%'`);

  // --- create fixtures ---
  const charResult = await dbRun(
    `INSERT INTO characters
     (name, first_name, last_name, class, race, level, current_hp, max_hp,
      current_location, current_quest, experience_to_next_level,
      gold_cp, gold_sp, gold_gp, ability_scores, skills, equipment, inventory,
      backstory, gender, alignment)
     VALUES ('TEST_NICK_Character','Rivelious','Vance','fighter','human',1,10,10,
             'Test','Test',300,0,0,0,'{}','{}','[]','[]','','Male','Neutral')`
  );
  const charId = charResult.lastInsertRowid;

  async function makeNpc(name, occupation = null) {
    const r = await dbRun(
      `INSERT INTO npcs (name, race, gender, occupation)
       VALUES (?, 'human', 'Male', ?)`,
      [name, occupation]
    );
    return r.lastInsertRowid;
  }

  const npcStranger = await makeNpc('TEST_NICK_Stranger', 'farmer');
  const npcFriend = await makeNpc('TEST_NICK_Friend', 'blacksmith');
  const npcAlly = await makeNpc('TEST_NICK_Ally', 'soldier');
  const npcDevoted = await makeNpc('TEST_NICK_Devoted', 'retainer');
  const npcJarrick = await makeNpc('TEST_NICK_Jarrick', 'mercenary');
  const npcApprentice = await makeNpc('TEST_NICK_Apprentice', 'wizard apprentice');
  const npcBard = await makeNpc('TEST_NICK_Bard', 'traveling bard');

  // Set dispositions
  await relationshipService.getOrCreateRelationship(charId, npcStranger);
  // neutral default (0), leave alone

  await relationshipService.getOrCreateRelationship(charId, npcFriend);
  await relationshipService.adjustDisposition(charId, npcFriend, 30); // -> 30 (friends)

  await relationshipService.getOrCreateRelationship(charId, npcAlly);
  await relationshipService.adjustDisposition(charId, npcAlly, 55); // -> 55 (allied)

  await relationshipService.getOrCreateRelationship(charId, npcDevoted);
  await relationshipService.adjustDisposition(charId, npcDevoted, 80); // -> 80 (devoted)

  await relationshipService.getOrCreateRelationship(charId, npcJarrick);
  await relationshipService.adjustDisposition(charId, npcJarrick, 40); // friends-tier but specific rule should win

  await relationshipService.getOrCreateRelationship(charId, npcApprentice);
  // leave disposition at 0 — role rule should fire regardless

  await relationshipService.getOrCreateRelationship(charId, npcBard);
  // bard override applies regardless

  // --- create nickname rules ---
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'Sir Rivelious',
    audience_type: 'default'
  });
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'Riv',
    audience_type: 'friends'
  });
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'Captain',
    audience_type: 'allied'
  });
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'My Lord',
    audience_type: 'devoted'
  });
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'Rivvy',
    audience_type: 'specific_npc',
    audience_value: String(npcJarrick)
  });
  await nicknameService.createNickname({
    character_id: charId,
    nickname: 'Master',
    audience_type: 'role',
    audience_value: 'apprentice'
  });

  console.log('=== Resolver tests ===\n');

  // 1. Stranger → default
  console.log('Test 1: Stranger gets default name');
  let r = await nicknameService.resolveForNpc(charId, npcStranger);
  assert(r.primary === 'Sir Rivelious', `stranger uses default "Sir Rivelious" (got "${r.primary}")`);
  assert(r.primary_row?.audience_type === 'default', 'primary_row is the default rule');
  assert(!r.bard_override, 'no bard override for stranger');

  // 2. Friend → friends
  console.log('\nTest 2: Friend (disposition 30) gets friends name');
  r = await nicknameService.resolveForNpc(charId, npcFriend);
  assert(r.primary === 'Riv', `friend uses "Riv" (got "${r.primary}")`);
  // Default rule should also be in allowed list but at lower priority
  assert(r.allowed.length >= 2, `allowed includes both friends and default (${r.allowed.length})`);
  assert(r.allowed[0].nickname === 'Riv', 'friends rule is primary (highest priority)');

  // 3. Ally → allied, with friends as secondary
  console.log('\nTest 3: Ally (disposition 55) gets "Captain" (allied) as primary');
  r = await nicknameService.resolveForNpc(charId, npcAlly);
  assert(r.primary === 'Captain', `ally uses "Captain" (got "${r.primary}")`);
  const allyNicks = r.allowed.map(a => a.nickname);
  assert(allyNicks.includes('Riv'), 'allowed list includes "Riv" (friends tier also qualifies)');
  assert(allyNicks.includes('Sir Rivelious'), 'allowed list includes default "Sir Rivelious"');

  // 4. Devoted → devoted (highest tier)
  console.log('\nTest 4: Devoted (disposition 80) gets "My Lord" as primary');
  r = await nicknameService.resolveForNpc(charId, npcDevoted);
  assert(r.primary === 'My Lord', `devoted uses "My Lord" (got "${r.primary}")`);
  assert(r.primary_row?.audience_type === 'devoted', 'primary is devoted tier');

  // 5. Specific NPC → beats friends tier
  console.log('\nTest 5: Jarrick (specific NPC rule) beats his friends tier');
  r = await nicknameService.resolveForNpc(charId, npcJarrick);
  assert(r.primary === 'Rivvy', `Jarrick uses specific "Rivvy" (got "${r.primary}")`);
  assert(r.primary_row?.audience_type === 'specific_npc', 'primary is specific_npc rule');

  // 6. Role match → apprentice occupation triggers "Master"
  console.log('\nTest 6: Apprentice role rule fires despite neutral disposition');
  r = await nicknameService.resolveForNpc(charId, npcApprentice);
  assert(r.primary === 'Master', `apprentice uses "Master" (got "${r.primary}")`);
  assert(r.primary_row?.audience_type === 'role', 'primary is role rule');

  // 7. Bard override → returns ALL names, bard_override flag set
  console.log('\nTest 7: Bard override allows any name');
  r = await nicknameService.resolveForNpc(charId, npcBard);
  assert(r.bard_override === true, 'bard_override flag is true');
  const bardNicks = r.allowed.map(a => a.nickname);
  assert(bardNicks.includes('Riv'), 'bard has "Riv" available');
  assert(bardNicks.includes('My Lord'), 'bard has "My Lord" available');
  assert(bardNicks.includes('Rivvy'), 'bard has "Rivvy" available despite specific-NPC rule being for someone else');

  // 8. formatResolutionForPrompt produces expected strings
  console.log('\nTest 8: Prompt formatting');
  const strangerRes = await nicknameService.resolveForNpc(charId, npcStranger);
  const strangerLine = formatResolutionForPrompt(strangerRes);
  assert(strangerLine.includes('Sir Rivelious'), 'stranger prompt line contains "Sir Rivelious"');
  assert(strangerLine.includes('default'), 'stranger prompt line mentions "default"');

  const jarrickRes = await nicknameService.resolveForNpc(charId, npcJarrick);
  const jarrickLine = formatResolutionForPrompt(jarrickRes);
  assert(jarrickLine.includes('Rivvy'), 'Jarrick prompt line contains "Rivvy"');
  assert(jarrickLine.includes('specific'), 'Jarrick prompt line mentions "specific"');

  const bardRes = await nicknameService.resolveForNpc(charId, npcBard);
  const bardLine = formatResolutionForPrompt(bardRes);
  assert(bardLine.toLowerCase().includes('bard'), 'bard prompt line mentions "bard"');
  assert(bardLine.toLowerCase().includes('rule of cool'), 'bard prompt line includes "rule of cool"');

  // 9. Empty nickname list → fallback to legal name
  console.log('\nTest 9: Character with no nicknames falls back to legal name');
  const naked = await dbRun(
    `INSERT INTO characters
     (name, first_name, last_name, class, race, level, current_hp, max_hp,
      current_location, current_quest, experience_to_next_level,
      gold_cp, gold_sp, gold_gp, ability_scores, skills, equipment, inventory,
      backstory, gender, alignment)
     VALUES ('TEST_NICK_Naked','Anonymous','Person','wizard','elf',1,6,6,
             'Test','Test',300,0,0,0,'{}','{}','[]','[]','','Male','Neutral')`
  );
  const nakedId = naked.lastInsertRowid;
  const nakedRes = await nicknameService.resolveForNpc(nakedId, npcStranger);
  assert(nakedRes.primary === 'Anonymous Person', `fallback to legal name (got "${nakedRes.primary}")`);
  assert(nakedRes.primary_row === null, 'primary_row is null when no rules match');

  // --- cleanup ---
  // FK order matters: relationships (both sides) → nicknames → characters → npcs.
  // character_nicknames has ON DELETE CASCADE so deleting characters handles those.
  const testNpcIds = await dbAll(`SELECT id FROM npcs WHERE name LIKE 'TEST_NICK_%'`);
  const npcIds = testNpcIds.map(r => r.id);
  if (npcIds.length > 0) {
    const placeholders = npcIds.map(() => '?').join(',');
    await dbRun(`DELETE FROM npc_relationships WHERE npc_id IN (${placeholders})`, npcIds);
  }
  await dbRun(`DELETE FROM npc_relationships WHERE character_id IN (?, ?)`, [charId, nakedId]);
  await dbRun(`DELETE FROM characters WHERE id IN (?, ?)`, [charId, nakedId]);
  await dbRun(`DELETE FROM npcs WHERE name LIKE 'TEST_NICK_%'`);

  console.log(`\n==================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`==================================================`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
