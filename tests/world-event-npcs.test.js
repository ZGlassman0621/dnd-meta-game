/**
 * Tests for world event NPC effects (Component G).
 * Verifies generateNpcEffectsForEvent, getActiveNpcEffects, resolveNpcEffectsForEvent.
 *
 * Run: node tests/world-event-npcs.test.js
 *
 * Uses the local.db database; all test data prefixed with TEST_ and cleaned up.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js';
import {
  generateNpcEffectsForEvent,
  getActiveNpcEffects,
  resolveNpcEffectsForEvent
} from '../server/services/worldEventNpcService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message}`);
    failed++;
  }
}

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.error(`  \u2717 ${message} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failed++;
  }
}

// ===== Helpers =====

async function createTestCampaign(name = 'TEST_WorldEventNpc Campaign') {
  const result = await dbRun(
    `INSERT INTO campaigns (name, setting, status) VALUES (?, 'Forgotten Realms', 'active')`,
    [name]
  );
  return Number(result.lastInsertRowid);
}

async function createTestCharacter(campaignId, name = 'TEST_WEN Hero') {
  const result = await dbRun(`
    INSERT INTO characters (name, class, race, level, current_hp, max_hp, current_location, experience_to_next_level, campaign_id)
    VALUES (?, 'Fighter', 'Human', 5, 40, 40, 'TEST_Waterdeep Market', 6500, ?)
  `, [name, campaignId]);
  return Number(result.lastInsertRowid);
}

async function createTestNpc(name, location, opts = {}) {
  const result = await dbRun(`
    INSERT INTO npcs (name, race, occupation, current_location, lifecycle_status)
    VALUES (?, 'Human', ?, ?, 'alive')
  `, [name, opts.occupation || 'Guard', location]);
  return Number(result.lastInsertRowid);
}

async function createTestRelationship(characterId, npcId, disposition = 0) {
  const result = await dbRun(`
    INSERT INTO npc_relationships (character_id, npc_id, disposition, disposition_label, trust_level, times_met)
    VALUES (?, ?, ?, 'neutral', 0, 1)
  `, [characterId, npcId, disposition]);
  return Number(result.lastInsertRowid);
}

async function createTestWorldEvent(campaignId, opts = {}) {
  const result = await dbRun(`
    INSERT INTO world_events (campaign_id, title, description, event_type, affected_locations, affected_npcs, status, current_stage)
    VALUES (?, ?, 'Test event description', ?, ?, '[]', 'active', 0)
  `, [
    campaignId,
    opts.title || 'TEST_Political Upheaval',
    opts.event_type || 'political',
    opts.affected_locations || '["TEST_Waterdeep Market"]'
  ]);
  return Number(result.lastInsertRowid);
}

async function getEvent(eventId) {
  return dbGet('SELECT * FROM world_events WHERE id = ?', [eventId]);
}

async function getNpc(npcId) {
  return dbGet('SELECT * FROM npcs WHERE id = ?', [npcId]);
}

// ===== Main =====

async function runTests() {
  await initDatabase();

  // Shared state across test groups
  let campaignId, characterId;
  let npcId1, npcId2, npcId3;
  let eventId1, eventId2, eventId3, eventId4;

  // ============================================================
  // 1. generateNpcEffectsForEvent — political event stage 0
  // ============================================================
  console.log('\n=== 1. generateNpcEffectsForEvent — political event stage 0 ===\n');

  {
    campaignId = await createTestCampaign();
    characterId = await createTestCharacter(campaignId);
    npcId1 = await createTestNpc('TEST_Aldric the Scribe', 'TEST_Waterdeep Market');
    await createTestRelationship(characterId, npcId1, 10);

    eventId1 = await createTestWorldEvent(campaignId, {
      title: 'TEST_Council Coup',
      event_type: 'political',
      affected_locations: '["TEST_Waterdeep Market"]'
    });

    const event = await getEvent(eventId1);
    const effects = await generateNpcEffectsForEvent(event, 0);

    assert(effects.length > 0, 'Political stage 0 creates at least one effect');
    assertEqual(effects[0].effect_type, 'disposition_shift', 'Political stage 0 effect is disposition_shift');
    assert(effects[0].npc_name === 'TEST_Aldric the Scribe', 'Effect targets the correct NPC');

    // Verify event_effects row exists in DB
    const dbEffect = await dbGet(
      'SELECT * FROM event_effects WHERE event_id = ? AND target_id = ?',
      [eventId1, npcId1]
    );
    assert(dbEffect !== null, 'event_effects row was persisted in DB');

    // Verify NPC disposition actually changed via npc_relationships
    const rel = await dbGet(
      'SELECT disposition FROM npc_relationships WHERE character_id = ? AND npc_id = ?',
      [characterId, npcId1]
    );
    assert(rel.disposition !== 10, 'NPC disposition changed from original value (10)');
  }

  // ============================================================
  // 2. generateNpcEffectsForEvent — military event stage 2
  // ============================================================
  console.log('\n=== 2. generateNpcEffectsForEvent — military event stage 2 ===\n');

  {
    npcId2 = await createTestNpc('TEST_Brynn the Soldier', 'TEST_Waterdeep Market', { occupation: 'Soldier' });
    // Low disposition so status_change can apply (pickEffectForNpc skips status_change if disposition >= 50)
    await createTestRelationship(characterId, npcId2, -10);

    eventId2 = await createTestWorldEvent(campaignId, {
      title: 'TEST_Siege of the Market',
      event_type: 'military',
      affected_locations: '["TEST_Waterdeep Market"]'
    });

    const event = await getEvent(eventId2);
    const effects = await generateNpcEffectsForEvent(event, 2);

    assert(effects.length > 0, 'Military stage 2 creates at least one effect');
    const effectType = effects[0].effect_type;
    assert(
      effectType === 'status_change' || effectType === 'location_change',
      `Military stage 2 effect is status_change or location_change (got ${effectType})`
    );

    // Verify the NPC was actually affected
    const npc = await getNpc(effects[0].npc_id);
    if (effectType === 'status_change') {
      assert(npc.lifecycle_status !== 'alive', 'NPC lifecycle_status changed from alive');
    } else {
      assert(npc.current_location.includes('Outskirts'), 'NPC location changed to outskirts');
    }

    // Verify effect row in DB
    const dbEffect = await dbGet('SELECT * FROM event_effects WHERE event_id = ?', [eventId2]);
    assert(dbEffect !== null, 'Military effect persisted in event_effects table');
  }

  // ============================================================
  // 3. generateNpcEffectsForEvent — no NPCs at location
  // ============================================================
  console.log('\n=== 3. generateNpcEffectsForEvent — no NPCs at location ===\n');

  {
    eventId3 = await createTestWorldEvent(campaignId, {
      title: 'TEST_Remote Village Fire',
      event_type: 'natural_disaster',
      affected_locations: '["TEST_NowhereVillage"]'
    });

    const event = await getEvent(eventId3);
    const effects = await generateNpcEffectsForEvent(event, 1);

    assertEqual(effects.length, 0, 'No effects when no NPCs at the affected location');

    const dbEffects = await dbAll(
      'SELECT * FROM event_effects WHERE event_id = ?',
      [eventId3]
    );
    assertEqual(dbEffects.length, 0, 'No event_effects rows created for empty location');
  }

  // ============================================================
  // 4. generateNpcEffectsForEvent — economic event occupation change
  // ============================================================
  console.log('\n=== 4. generateNpcEffectsForEvent — economic occupation change ===\n');

  {
    npcId3 = await createTestNpc('TEST_Marta the Merchant', 'TEST_Dockside Bazaar', { occupation: 'Merchant' });
    await createTestRelationship(characterId, npcId3, 5);

    eventId4 = await createTestWorldEvent(campaignId, {
      title: 'TEST_Trade Collapse',
      event_type: 'economic',
      affected_locations: '["TEST_Dockside Bazaar"]'
    });

    const event = await getEvent(eventId4);
    // Economic stage 1 → occupation_change
    const effects = await generateNpcEffectsForEvent(event, 1);

    assert(effects.length > 0, 'Economic stage 1 creates effect');
    assertEqual(effects[0].effect_type, 'occupation_change', 'Economic stage 1 produces occupation_change');

    // Verify NPC occupation actually changed
    const npc = await getNpc(npcId3);
    assertEqual(npc.occupation, 'displaced merchant', 'Merchant occupation changed to displaced merchant');
  }

  // ============================================================
  // 5. getActiveNpcEffects
  // ============================================================
  console.log('\n=== 5. getActiveNpcEffects ===\n');

  {
    const activeEffects = await getActiveNpcEffects(campaignId);

    assert(Array.isArray(activeEffects), 'getActiveNpcEffects returns an array');
    assert(activeEffects.length > 0, 'At least one active effect exists for the campaign');

    const first = activeEffects[0];
    assert(first.npc_name !== undefined && first.npc_name !== null, 'Effect entry has npc_name (joined from npcs)');
    assert(first.event_title !== undefined && first.event_title !== null, 'Effect entry has event_title (joined from world_events)');
    assert(first.effect_type !== undefined && first.effect_type !== null, 'Effect entry has effect_type');
  }

  // ============================================================
  // 6. resolveNpcEffectsForEvent
  // ============================================================
  console.log('\n=== 6. resolveNpcEffectsForEvent ===\n');

  {
    // Count active effects for eventId4 before resolving
    const beforeCount = (await dbAll(
      "SELECT * FROM event_effects WHERE event_id = ? AND status = 'active'",
      [eventId4]
    )).length;
    assert(beforeCount > 0, 'Event has active effects before resolving');

    const resolvedCount = await resolveNpcEffectsForEvent(eventId4);

    assert(resolvedCount > 0, 'resolveNpcEffectsForEvent returns positive count');
    assertEqual(resolvedCount, beforeCount, 'Resolved count matches original active count');

    // Verify effects are now resolved in DB
    const afterActive = await dbAll(
      "SELECT * FROM event_effects WHERE event_id = ? AND status = 'active'",
      [eventId4]
    );
    assertEqual(afterActive.length, 0, 'No active effects remain after resolving');

    const resolved = await dbAll(
      "SELECT * FROM event_effects WHERE event_id = ? AND status = 'resolved'",
      [eventId4]
    );
    assert(resolved.length > 0, 'Effects have status resolved in DB');
  }

  // ============================================================
  // 7. Cap at 3 NPCs per stage
  // ============================================================
  console.log('\n=== 7. Cap at 3 NPCs per stage ===\n');

  {
    const capCampaignId = await createTestCampaign('TEST_Cap Campaign');
    const capCharId = await createTestCharacter(capCampaignId, 'TEST_Cap Hero');

    // Create 5 NPCs all at the same location
    const capNpcIds = [];
    for (let i = 1; i <= 5; i++) {
      const nId = await createTestNpc(`TEST_CapNpc_${i}`, 'TEST_Cap Location', { occupation: 'Guard' });
      await createTestRelationship(capCharId, nId, 0);
      capNpcIds.push(nId);
    }

    const capEventId = await createTestWorldEvent(capCampaignId, {
      title: 'TEST_Mass Political Event',
      event_type: 'political',
      affected_locations: '["TEST_Cap Location"]'
    });

    const event = await getEvent(capEventId);
    const effects = await generateNpcEffectsForEvent(event, 0);

    assert(effects.length <= 3, `Effects capped at 3 (got ${effects.length})`);
    assert(effects.length > 0, 'At least one effect was created');

    // Verify in DB as well
    const dbEffects = await dbAll(
      'SELECT * FROM event_effects WHERE event_id = ?',
      [capEventId]
    );
    assert(dbEffects.length <= 3, `DB event_effects rows capped at 3 (got ${dbEffects.length})`);
  }

  // ============================================================
  // CLEANUP
  // ============================================================
  console.log('\n--- Cleanup ---');

  await dbRun("DELETE FROM event_effects WHERE event_id IN (SELECT id FROM world_events WHERE title LIKE 'TEST_%')");
  await dbRun("DELETE FROM npc_lifecycle_history WHERE npc_id IN (SELECT id FROM npcs WHERE name LIKE 'TEST_%')");
  await dbRun("DELETE FROM world_events WHERE title LIKE 'TEST_%'");
  await dbRun("DELETE FROM npc_relationships WHERE character_id IN (SELECT id FROM characters WHERE name LIKE 'TEST_%')");
  await dbRun("DELETE FROM npcs WHERE name LIKE 'TEST_%'");
  await dbRun("DELETE FROM characters WHERE name LIKE 'TEST_%'");
  await dbRun("DELETE FROM campaigns WHERE name LIKE 'TEST_%'");
  console.log('  Cleaned up TEST_ rows');

  // ===== Summary =====
  console.log(`\n${'='.repeat(50)}`);
  console.log(`World Event NPC Effects: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(50));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
