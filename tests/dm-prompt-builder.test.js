/**
 * DM Prompt Builder Tests — NPC differentiation features (Component D + H annotations).
 * Tests generateNpcVoiceHint (indirectly), NPC voicing guide, world event effects,
 * companion absence, [ABSENCE] annotation, [EVENT] annotation, and full prompt generation.
 */

import { createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';

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

function assertEqual(actual, expected, message) {
  if (actual === expected) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message} — expected "${expected}", got "${actual}"`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Shared test data factories
// ---------------------------------------------------------------------------

function makeCharacter(overrides = {}) {
  return {
    name: 'TEST Hero',
    first_name: 'TEST',
    race: 'Human',
    class: 'Fighter',
    level: 5,
    hp: 45,
    max_hp: 45,
    ac: 16,
    gender: 'male',
    game_day: 100,
    game_hour: 10,
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [],
    skills: [],
    feats: [],
    known_cantrips: [],
    known_spells: [],
    prepared_spells: [],
    equipment: {},
    ...overrides
  };
}

function makeSessionContext(overrides = {}) {
  return {
    companions: [],
    awayCompanions: [],
    worldState: {
      npcRelationships: [],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: [],
      activeFactions: [],
      ...((overrides.worldState) || {})
    },
    campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
    previousSessionSummaries: [],
    characterMemories: '',
    campaignNotes: '',
    continueCampaign: false,
    pendingDowntimeNarratives: [],
    ...overrides,
    // Ensure worldState merge is correct (overrides above may have been overwritten)
    worldState: {
      npcRelationships: [],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: [],
      activeFactions: [],
      ...((overrides.worldState) || {})
    }
  };
}

function makeNpcRelationship(overrides = {}) {
  return {
    npc_id: 1,
    npc_name: 'Garrick the Bold',
    npc_occupation: 'merchant',
    npc_location: 'Market Square',
    disposition: 5,
    disposition_label: 'friendly',
    trust_level: 3,
    npc_enrichment_level: 0,
    npc_lifecycle_status: 'alive',
    promises_made: [],
    debts_owed: [],
    discovered_secrets: [],
    ...overrides
  };
}

// ============================================================
// 1. generateNpcVoiceHint — enriched NPC (indirect via prompt)
// ============================================================
console.log('\n=== Test 1: generateNpcVoiceHint — Enriched NPC (indirect) ===\n');

{
  const enrichedNpc = makeNpcRelationship({
    npc_id: 10,
    npc_name: 'Thaldric Ashwhisper',
    npc_enrichment_level: 2,
    npc_voice: 'Gravelly whisper',
    npc_personality: 'Fiercely loyal',
    npc_mannerism: 'Taps fingers when nervous',
    disposition: 3
  });

  const ctx = makeSessionContext({
    worldState: { npcRelationships: [enrichedNpc], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [] }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(prompt.includes('RP:'), 'Enriched NPC entry contains "RP:" prefix');
  assert(prompt.includes('Gravelly whisper'), 'Enriched NPC entry includes voice data');
  assert(prompt.includes('Fiercely loyal'), 'Enriched NPC entry includes personality data');
  assert(prompt.includes('Taps fingers when nervous'), 'Enriched NPC entry includes mannerism data');
}

// ============================================================
// 2. generateNpcVoiceHint — occupation fallback (indirect)
// ============================================================
console.log('\n=== Test 2: generateNpcVoiceHint — Occupation Fallback (indirect) ===\n');

{
  const merchantNpc = makeNpcRelationship({
    npc_id: 20,
    npc_name: 'Bram Copperkettle',
    npc_occupation: 'merchant',
    npc_enrichment_level: 0,
    disposition: 3
  });

  const guardNpc = makeNpcRelationship({
    npc_id: 21,
    npc_name: 'Osric Haldane',
    npc_occupation: 'guard',
    npc_enrichment_level: 0,
    disposition: 2
  });

  const innkeeperNpc = makeNpcRelationship({
    npc_id: 22,
    npc_name: 'Wenna Rootwhistle',
    npc_occupation: 'innkeeper',
    npc_enrichment_level: 0,
    disposition: 4
  });

  // disposition must be non-zero so the NPC passes the relevance filter in formatWorldStateSnapshot
  const unknownNpc = makeNpcRelationship({
    npc_id: 23,
    npc_name: 'Corvin the Drifter',
    npc_occupation: 'wanderer',
    npc_enrichment_level: 0,
    disposition: 1,
    disposition_label: 'neutral'
  });

  const ctx = makeSessionContext({
    worldState: {
      npcRelationships: [merchantNpc, guardNpc, innkeeperNpc, unknownNpc],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  // Merchant -> transactional, names prices
  assert(prompt.includes('transactional') && prompt.includes('prices'), 'Merchant NPC gets transaction/prices voice hint');
  // Guard -> clipped and authoritative
  assert(prompt.includes('authoritative'), 'Guard NPC gets authoritative voice hint');
  // Innkeeper -> warm and chatty
  assert(prompt.includes('warm and chatty'), 'Innkeeper NPC gets warm/chatty voice hint');
  // Unknown occupation -> disposition-based fallback (neutral -> "polite but reserved")
  assert(prompt.includes('polite but reserved'), 'Unknown occupation NPC falls back to disposition-based hint');
}

// ============================================================
// 3. NPC VOICING GUIDE section in prompt
// ============================================================
console.log('\n=== Test 3: NPC VOICING GUIDE Section ===\n');

{
  const npc = makeNpcRelationship({ npc_id: 30, npc_name: 'Fenna Graycloak', disposition: 3 });

  const ctx = makeSessionContext({
    worldState: {
      npcRelationships: [npc],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(prompt.includes('NPC VOICING GUIDE'), 'Prompt contains NPC VOICING GUIDE section');
  assert(prompt.includes('speech patterns'), 'Voicing guide mentions voice/personality differentiation via speech patterns');
  assert(prompt.includes('Disposition CHANGES how they interact') || prompt.includes('disposition') || prompt.includes('Disposition'),
    'Voicing guide mentions disposition changes how they interact');
  assert(prompt.includes('Trust level determines what NPCs reveal') || prompt.includes('Trust') && prompt.includes('reveal'),
    'Voicing guide mentions trust determines what NPCs reveal');
}

// ============================================================
// 4. WORLD EVENT EFFECTS ON NPCs section
// ============================================================
console.log('\n=== Test 4: WORLD EVENT EFFECTS ON NPCs Section ===\n');

{
  const npc = makeNpcRelationship({ npc_id: 40, npc_name: 'Hadley Windrune', disposition: 2 });

  const effects = [{
    npc_id: 40,
    npc_name: 'Hadley Windrune',
    npc_occupation: 'farmer',
    event_title: 'The Blight of Greenhollow',
    effect_type: 'disposition_shift',
    description: 'Crop failures have made Hadley bitter and suspicious of outsiders',
    parameters: JSON.stringify({ shift: -3 })
  }];

  const ctx = makeSessionContext({
    worldState: {
      npcRelationships: [npc],
      npcEventEffects: effects,
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(prompt.includes('WORLD EVENT EFFECTS ON NPCs'), 'Prompt contains WORLD EVENT EFFECTS ON NPCs section');
  assert(prompt.includes('The Blight of Greenhollow'), 'Event effects section includes the event title');
  assert(prompt.includes('Hadley Windrune'), 'Event effects section includes the NPC name');

  // Without effects, section should NOT appear
  const ctxNoEffects = makeSessionContext({
    worldState: {
      npcRelationships: [npc],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const promptNoEffects = createDMSystemPrompt(makeCharacter(), ctxNoEffects);
  assert(!promptNoEffects.includes('WORLD EVENT EFFECTS ON NPCs'), 'Without effects, WORLD EVENT EFFECTS ON NPCs section does NOT appear');
}

// ============================================================
// 5. COMPANIONS CURRENTLY AWAY section
// ============================================================
console.log('\n=== Test 5: COMPANIONS CURRENTLY AWAY Section ===\n');

{
  const awayCompanion = {
    name: 'Elara Moonshadow',
    activity_type: 'training',
    location: 'The Gilded Barracks',
    start_game_day: 90,
    expected_duration_days: 7
  };

  const ctx = makeSessionContext({
    awayCompanions: [awayCompanion]
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(prompt.includes('COMPANIONS CURRENTLY AWAY'), 'Prompt contains COMPANIONS CURRENTLY AWAY section');
  assert(prompt.includes('Elara Moonshadow'), 'Away companions section includes companion name');
  assert(prompt.includes('training'), 'Away companions section includes activity type');

  // Without away companions, section should NOT appear
  const ctxNoAway = makeSessionContext({
    awayCompanions: []
  });

  const promptNoAway = createDMSystemPrompt(makeCharacter(), ctxNoAway);
  assert(!promptNoAway.includes('COMPANIONS CURRENTLY AWAY'), 'Without away companions, section does NOT appear');
}

// ============================================================
// 6. [ABSENCE] annotation
// ============================================================
console.log('\n=== Test 6: [ABSENCE] Annotation ===\n');

{
  // NPC with last interaction 50 days ago -> should get absence annotation (>= 14 days)
  const absentNpc = makeNpcRelationship({
    npc_id: 60,
    npc_name: 'Tovan Ironmark',
    disposition: 4,
    last_interaction_game_day: 50
  });

  // NPC with last interaction 5 days ago -> should NOT get absence annotation (< 14 days)
  const recentNpc = makeNpcRelationship({
    npc_id: 61,
    npc_name: 'Jorun Swiftblade',
    disposition: 3,
    last_interaction_game_day: 95
  });

  // NPC with no last_interaction_game_day -> should NOT get absence annotation
  const noInteractionNpc = makeNpcRelationship({
    npc_id: 62,
    npc_name: 'Maelis Thorngage',
    disposition: 2
  });

  const ctx = makeSessionContext({
    worldState: {
      npcRelationships: [absentNpc, recentNpc, noInteractionNpc],
      npcEventEffects: [],
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(prompt.includes('[ABSENCE: 50 days'), 'NPC absent 50 days gets [ABSENCE: 50 days annotation');
  // Verify the absence annotation is near Tovan's entry
  const tovanIdx = prompt.indexOf('Tovan Ironmark');
  const absenceIdx = prompt.indexOf('[ABSENCE: 50 days');
  assert(tovanIdx > -1 && absenceIdx > tovanIdx, 'Absence annotation appears after Tovan Ironmark entry');

  // Jorun (5 days) should NOT have absence annotation
  const jorunSection = prompt.substring(prompt.indexOf('Jorun Swiftblade'), prompt.indexOf('Maelis Thorngage'));
  assert(!jorunSection.includes('[ABSENCE:'), 'NPC with 5 days absence does NOT get [ABSENCE] annotation');

  // Maelis (no last_interaction_game_day) should NOT have absence annotation
  const maelisSection = prompt.substring(prompt.indexOf('Maelis Thorngage'));
  // Find the end of Maelis's NPC entry (next NPC or end of NPC RELATIONSHIPS block)
  const maelisEndIdx = maelisSection.indexOf('\n\n');
  const maelisBlock = maelisEndIdx > -1 ? maelisSection.substring(0, maelisEndIdx) : maelisSection;
  assert(!maelisBlock.includes('[ABSENCE:'), 'NPC with no last_interaction_game_day does NOT get [ABSENCE] annotation');
}

// ============================================================
// 7. [EVENT] inline annotation
// ============================================================
console.log('\n=== Test 7: [EVENT] Inline Annotation ===\n');

{
  const affectedNpc = makeNpcRelationship({
    npc_id: 70,
    npc_name: 'Kerreth Blackthorn',
    npc_occupation: 'blacksmith',
    disposition: 3
  });

  const unaffectedNpc = makeNpcRelationship({
    npc_id: 71,
    npc_name: 'Olwen Duskwalker',
    npc_occupation: 'scholar',
    disposition: 2
  });

  const eventEffects = [{
    npc_id: 70,
    npc_name: 'Kerreth Blackthorn',
    npc_occupation: 'blacksmith',
    event_title: 'The Iron Embargo',
    effect_type: 'disposition_shift',
    description: 'Lost his iron supply, now desperate for work',
    parameters: JSON.stringify({ shift: -2 })
  }];

  const ctx = makeSessionContext({
    worldState: {
      npcRelationships: [affectedNpc, unaffectedNpc],
      npcEventEffects: eventEffects,
      currentGameDay: 100,
      factionStandings: [],
      visibleEvents: [],
      discoveredLocations: []
    }
  });

  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  // The NPC's entry should contain [EVENT: annotation
  const kerrethIdx = prompt.indexOf('Kerreth Blackthorn');
  const olwenIdx = prompt.indexOf('Olwen Duskwalker');
  assert(kerrethIdx > -1, 'Kerreth Blackthorn appears in prompt');

  // Find the [EVENT: annotation between Kerreth and Olwen
  const kerrethSection = prompt.substring(kerrethIdx, olwenIdx > kerrethIdx ? olwenIdx : kerrethIdx + 500);
  assert(kerrethSection.includes('[EVENT:'), 'Affected NPC entry contains [EVENT: inline annotation');
  assert(kerrethSection.includes('The Iron Embargo'), 'Event annotation includes the event title');
  assert(kerrethSection.includes('attitude shifted') || kerrethSection.includes('shifted'), 'Event annotation includes the effect description (disposition_shift)');
}

// ============================================================
// 8. Full prompt still generates without errors
// ============================================================
console.log('\n=== Test 8: Full Prompt Generation ===\n');

{
  const ctx = makeSessionContext();
  const prompt = createDMSystemPrompt(makeCharacter(), ctx);

  assert(typeof prompt === 'string' && prompt.length > 0, 'Full prompt is a non-empty string');
  assert(prompt.includes('CARDINAL RULES'), 'Full prompt contains CARDINAL RULES section');
}

// ============================================================
// Summary
// ============================================================
console.log(`\n========================================`);
console.log(`DM Prompt Builder Tests: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
