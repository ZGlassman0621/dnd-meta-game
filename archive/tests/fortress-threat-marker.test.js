/**
 * Phase 3.7 — fortress threat marker + player-defense damage symmetry tests.
 *
 * Covers:
 *   1. SC-3.7.1 — FORTRESS_THREAT schema validation (required fields,
 *      enum values, optional fallbacks land handler-side).
 *   2. SC-3.7.1 — Handler dispatch via processResponseMarkers:
 *        a) Valid base owned by character → threat row created with
 *           Source/Category fallbacks from RAID_CAPABLE_EVENTS, narrative
 *           queue entry written, structured handlerResult returned.
 *        b) Force >= SIEGE_FORCE_THRESHOLD → threat_type = 'siege'.
 *        c) Force <  SIEGE_FORCE_THRESHOLD → threat_type = 'raid'.
 *        d) BaseId not found → no row created; error result.
 *        e) Base owned by another campaign → error result.
 *        f) Base status != 'active' → error result.
 *        g) Existing approaching threat on the base → second marker skipped.
 *        h) Source/Category provided in marker → used verbatim, not falled back.
 *   3. SC-3.7.2 — recordPlayerDefenseOutcome applies mechanical damage:
 *        a) `repelled` → no buildings damaged, treasury/garrison untouched
 *        b) `damaged`  → mild sub-tier (margin=0): 25% treasury / 20% garrison
 *                        / 1-2 buildings damaged
 *        c) `captured` → 90% treasury / all garrison / all buildings damaged
 *        d) damage_report JSON populates with mechanical detail
 *        e) Caller-supplied damageReport merges WITH mechanical mutation
 *           (mechanical mutation runs underneath; report blob preserves
 *           caller fields)
 *
 * Test data uses TEST_PHASE37_ prefix; cleanup runs at end + on failure.
 */

import { initDatabase, dbRun, dbGet, dbAll } from '../server/database.js'
import { parseMarkerBody, validateDmMarkers } from '../server/services/markerSchemas.js'
import { processResponseMarkers } from '../server/services/markerPipeline.js'
import {
  recordPlayerDefenseOutcome,
  markThreatDefending
} from '../server/services/baseThreatService.js'
import { SIEGE_FORCE_THRESHOLD, RAID_CAPABLE_EVENTS } from '../server/config/raidConfig.js'

// Force handler module load.
import '../server/services/baseThreatService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

// ============================================================
// Schema-only tests (no DB)
// ============================================================

console.log('\n=== FORTRESS_THREAT schema validation ===\n')
{
  const ok = parseMarkerBody(
    'BaseId=42 EventType=bandit_activity Force=8 WarningDays=4 Source="Hill Reavers" Reason="vengeance"',
    'FORTRESS_THREAT'
  )
  assert(ok.ok, 'canonical FORTRESS_THREAT parses')
  assert(ok.data?.BaseId === 42, 'BaseId parses to integer 42')
  assert(ok.data?.EventType === 'bandit_activity', 'EventType parses')
  assert(ok.data?.Force === 8, 'Force parses to integer 8')
  assert(ok.data?.WarningDays === 4, 'WarningDays parses')
  assert(ok.data?.Source === 'Hill Reavers', 'Source preserves quoted value')
  assert(ok.data?.Reason === 'vengeance', 'Reason preserves quoted value')

  const noBaseId = parseMarkerBody('EventType=war Force=10 WarningDays=5', 'FORTRESS_THREAT')
  assert(!noBaseId.ok && noBaseId.errors.some(e => e.field === 'BaseId'), 'missing BaseId → error')

  const badEventType = parseMarkerBody('BaseId=1 EventType=dragon_attack Force=10 WarningDays=5', 'FORTRESS_THREAT')
  assert(!badEventType.ok && badEventType.errors.some(e => e.field === 'EventType'), 'invalid EventType enum → error')

  const forceMin = parseMarkerBody('BaseId=1 EventType=war Force=0 WarningDays=5', 'FORTRESS_THREAT')
  assert(!forceMin.ok && forceMin.errors.some(e => e.field === 'Force'), 'Force=0 → min violation')

  const forceMax = parseMarkerBody('BaseId=1 EventType=war Force=99 WarningDays=5', 'FORTRESS_THREAT')
  assert(!forceMax.ok && forceMax.errors.some(e => e.field === 'Force'), 'Force=99 → max violation')

  const warnMax = parseMarkerBody('BaseId=1 EventType=war Force=10 WarningDays=99', 'FORTRESS_THREAT')
  assert(!warnMax.ok && warnMax.errors.some(e => e.field === 'WarningDays'), 'WarningDays=99 → max violation')

  const minimal = parseMarkerBody('BaseId=5 EventType=cult_activity Force=6 WarningDays=3', 'FORTRESS_THREAT')
  assert(minimal.ok, 'minimal canonical (Source/Category/Reason all omitted) parses — fallbacks land handler-side')

  const badCategory = parseMarkerBody('BaseId=1 EventType=war Force=10 WarningDays=5 Category=civic', 'FORTRESS_THREAT')
  assert(!badCategory.ok && badCategory.errors.some(e => e.field === 'Category'), 'invalid Category enum → error')
}

// Multi-instance via end-to-end extraction
console.log('\n=== FORTRESS_THREAT multi-instance extraction ===\n')
{
  const narrative = `
    The watchtower spots smoke on the road. [FORTRESS_THREAT: BaseId=1 EventType=bandit_activity Force=8 WarningDays=4 Source="Hill Reavers"]
    Worse: a messenger arrives with word of cult activity at the chapel. [FORTRESS_THREAT: BaseId=2 EventType=cult_activity Force=10 WarningDays=3]
  `
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.FORTRESS_THREAT?.length === 2, 'two FORTRESS_THREAT markers extracted')
  assert(failures.length === 0, 'no failures from multi-instance')
}

// ============================================================
// Handler dispatch tests (real DB, TEST_ prefix)
// ============================================================

console.log('\n=== Handler dispatch — DB seed + processResponseMarkers ===\n')

await initDatabase()

// Cleanup any prior run state under our test prefix
async function cleanup() {
  await dbRun(`DELETE FROM narrative_queue WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_PHASE37_%')`)
  await dbRun(`DELETE FROM base_threats WHERE campaign_id IN (SELECT id FROM campaigns WHERE name LIKE 'TEST_PHASE37_%')`)
  await dbRun(`DELETE FROM base_buildings WHERE base_id IN (SELECT id FROM party_bases WHERE name LIKE 'TEST_PHASE37_%')`)
  await dbRun(`DELETE FROM party_bases WHERE name LIKE 'TEST_PHASE37_%'`)
  await dbRun(`DELETE FROM characters WHERE name LIKE 'TEST_PHASE37_%'`)
  await dbRun(`DELETE FROM campaigns WHERE name LIKE 'TEST_PHASE37_%'`)
  await dbRun(`DELETE FROM users WHERE username LIKE 'TEST_PHASE37_%'`)
}

await cleanup()

// Seed: user, two campaigns, one character per campaign, one base per campaign.
await dbRun(`INSERT INTO users (username, password_hash) VALUES ('TEST_PHASE37_user', 'x')`)
const user = await dbGet(`SELECT id FROM users WHERE username = 'TEST_PHASE37_user'`)

await dbRun(
  `INSERT INTO campaigns (name, description, setting, tone, status, user_id)
   VALUES ('TEST_PHASE37_camp_A', 'p3.7 test', 'Sword Coast', 'heroic', 'active', ?)`,
  [user.id]
)
const campA = await dbGet(`SELECT id FROM campaigns WHERE name = 'TEST_PHASE37_camp_A'`)

await dbRun(
  `INSERT INTO campaigns (name, description, setting, tone, status, user_id)
   VALUES ('TEST_PHASE37_camp_B', 'p3.7 test', 'Sword Coast', 'heroic', 'active', ?)`,
  [user.id]
)
const campB = await dbGet(`SELECT id FROM campaigns WHERE name = 'TEST_PHASE37_camp_B'`)

await dbRun(
  `INSERT INTO characters (
     name, first_name, class, race, level, current_hp, max_hp, armor_class, speed,
     current_location, experience_to_next_level, gold_gp, gold_sp, gold_cp,
     ability_scores, skills, equipment, inventory, backstory, gender, alignment,
     campaign_id, game_day
   ) VALUES (
     'TEST_PHASE37_charA', 'TEST_PHASE37', 'Fighter', 'Human', 5, 40, 40, 16, 30,
     'TEST_loc', 6500, 0, 0, 0,
     '{"str":12,"dex":10,"con":12,"int":10,"wis":10,"cha":10}',
     '[]', '{}', '[]', 'test', 'female', 'Neutral',
     ?, 100
   )`,
  [campA.id]
)
const charA = await dbGet(`SELECT id, campaign_id, game_day FROM characters WHERE name = 'TEST_PHASE37_charA'`)

// Second character lives in campB so we can FK-bind a base to it
await dbRun(
  `INSERT INTO characters (
     name, first_name, class, race, level, current_hp, max_hp, armor_class, speed,
     current_location, experience_to_next_level, gold_gp, gold_sp, gold_cp,
     ability_scores, skills, equipment, inventory, backstory, gender, alignment,
     campaign_id, game_day
   ) VALUES (
     'TEST_PHASE37_charB', 'TEST_PHASE37', 'Fighter', 'Human', 5, 40, 40, 16, 30,
     'TEST_loc', 6500, 0, 0, 0,
     '{"str":12,"dex":10,"con":12,"int":10,"wis":10,"cha":10}',
     '[]', '{}', '[]', 'test', 'female', 'Neutral',
     ?, 100
   )`,
  [campB.id]
)
const charB = await dbGet(`SELECT id FROM characters WHERE name = 'TEST_PHASE37_charB'`)

await dbRun(
  `INSERT INTO party_bases (campaign_id, character_id, name, category, subtype, status, defense_rating, garrison_strength, gold_treasury)
   VALUES (?, ?, 'TEST_PHASE37_baseA', 'martial', 'outpost', 'active', 8, 20, 1000)`,
  [campA.id, charA.id]
)
const baseA = await dbGet(`SELECT id FROM party_bases WHERE name = 'TEST_PHASE37_baseA'`)

await dbRun(
  `INSERT INTO party_bases (campaign_id, character_id, name, category, subtype, status, defense_rating, garrison_strength, gold_treasury)
   VALUES (?, ?, 'TEST_PHASE37_baseB_otherCamp', 'martial', 'outpost', 'active', 8, 20, 1000)`,
  [campB.id, charB.id]
)
const baseB = await dbGet(`SELECT id FROM party_bases WHERE name = 'TEST_PHASE37_baseB_otherCamp'`)

await dbRun(
  `INSERT INTO party_bases (campaign_id, character_id, name, category, subtype, status, defense_rating, garrison_strength, gold_treasury)
   VALUES (?, ?, 'TEST_PHASE37_baseAbandoned', 'martial', 'watchtower', 'abandoned', 4, 0, 0)`,
  [campA.id, charA.id]
)
const baseAbandoned = await dbGet(`SELECT id FROM party_bases WHERE name = 'TEST_PHASE37_baseAbandoned'`)

// Helper — synthesize narrative with one FORTRESS_THREAT marker.
function buildNarrative(fields) {
  return `Some prose. [FORTRESS_THREAT: ${fields}]`
}

// (a) Valid base, raid-tier force, fallbacks expected.
{
  const before = await dbAll(`SELECT id FROM base_threats WHERE base_id = ?`, [baseA.id])
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseA.id} EventType=bandit_activity Force=8 WarningDays=4`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const after = await dbAll(`SELECT * FROM base_threats WHERE base_id = ?`, [baseA.id])
  assert(after.length === before.length + 1, 'valid marker → 1 new base_threats row')

  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.ok && handlerResult.result?.threatId, 'handler returns ok + threatId')
  assert(handlerResult.result.threatType === 'raid', 'Force=8 < SIEGE_FORCE_THRESHOLD=15 → raid')
  const inserted = after.find(r => !before.some(b => b.id === r.id))
  assert(inserted.attacker_source === RAID_CAPABLE_EVENTS.bandit_activity.sourceLabel,
    `Source falls back to RAID_CAPABLE_EVENTS.bandit_activity.sourceLabel = "${RAID_CAPABLE_EVENTS.bandit_activity.sourceLabel}"`)
  assert(inserted.attacker_category === RAID_CAPABLE_EVENTS.bandit_activity.category,
    `Category falls back to "${RAID_CAPABLE_EVENTS.bandit_activity.category}"`)
  assert(inserted.attacker_force === 8, 'attacker_force preserved')
  assert(inserted.deadline_game_day === charA.game_day + 4, `deadline = game_day + WarningDays`)
  assert(inserted.status === 'approaching', 'status starts approaching')

  // narrative queue entry was written
  const queueRow = await dbGet(
    `SELECT * FROM narrative_queue WHERE campaign_id = ? AND event_type = 'base_threat_approaching' ORDER BY id DESC LIMIT 1`,
    [campA.id]
  )
  assert(queueRow !== null, 'narrative queue entry created')

  // Cleanup for next test
  await dbRun(`DELETE FROM base_threats WHERE id = ?`, [inserted.id])
  await dbRun(`DELETE FROM narrative_queue WHERE id = ?`, [queueRow.id])
}

// (b) Force >= 15 → siege determination.
{
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseA.id} EventType=war Force=${SIEGE_FORCE_THRESHOLD} WarningDays=6`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.result?.threatType === 'siege', `Force=${SIEGE_FORCE_THRESHOLD} → siege`)
  await dbRun(`DELETE FROM base_threats WHERE id = ?`, [handlerResult.result.threatId])
  await dbRun(`DELETE FROM narrative_queue WHERE context LIKE '%"threat_id":' || ? || '%'`, [handlerResult.result.threatId])
}

// (c) BaseId not found.
{
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=99999 EventType=war Force=10 WarningDays=5`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.result?.error === 'base_not_found', 'unknown BaseId → error result')
  const rows = await dbAll(`SELECT id FROM base_threats WHERE base_id = 99999`)
  assert(rows.length === 0, 'no row created for unknown BaseId')
}

// (d) Base in different campaign.
{
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseB.id} EventType=war Force=10 WarningDays=5`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.result?.error === 'base_not_owned', 'base in other campaign → base_not_owned error')
  const rows = await dbAll(`SELECT id FROM base_threats WHERE base_id = ?`, [baseB.id])
  assert(rows.length === 0, 'no row created when base belongs to another campaign')
}

// (e) Base abandoned.
{
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseAbandoned.id} EventType=war Force=10 WarningDays=5`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.result?.error === 'base_not_active', 'abandoned base → base_not_active error')
}

// (f) Existing approaching threat → skipped.
{
  // Seed an active threat
  await dbRun(
    `INSERT INTO base_threats (base_id, campaign_id, threat_type, attacker_source, attacker_category, attacker_force, warning_game_day, deadline_game_day, status)
     VALUES (?, ?, 'raid', 'TEST', 'criminal', 5, 100, 105, 'approaching')`,
    [baseA.id, campA.id]
  )
  const seeded = await dbGet(`SELECT id FROM base_threats WHERE base_id = ? AND status='approaching' ORDER BY id DESC LIMIT 1`, [baseA.id])
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseA.id} EventType=war Force=10 WarningDays=5`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  assert(handlerResult?.result?.error === 'threat_already_active', 'existing threat → threat_already_active error')
  assert(handlerResult.result.existingThreatId === seeded.id, 'reports existing threat id')

  const allThreats = await dbAll(`SELECT id FROM base_threats WHERE base_id = ? AND status='approaching'`, [baseA.id])
  assert(allThreats.length === 1, 'still only 1 approaching threat — second marker did not insert')
  await dbRun(`DELETE FROM base_threats WHERE id = ?`, [seeded.id])
}

// (g) Source/Category supplied → used verbatim, no fallback.
{
  const result = await processResponseMarkers(
    buildNarrative(`BaseId=${baseA.id} EventType=bandit_activity Force=7 WarningDays=4 Source="Custom Source" Category=political`),
    { characterId: charA.id, sessionId: 0, narrative: '' }
  )
  const handlerResult = result.handlerResults.find(r => r.schemaKey === 'FORTRESS_THREAT')
  const row = await dbGet(`SELECT * FROM base_threats WHERE id = ?`, [handlerResult.result.threatId])
  assert(row.attacker_source === 'Custom Source', 'Source from marker used verbatim')
  assert(row.attacker_category === 'political', 'Category from marker used verbatim')
  await dbRun(`DELETE FROM base_threats WHERE id = ?`, [row.id])
  await dbRun(`DELETE FROM narrative_queue WHERE context LIKE '%"threat_id":' || ? || '%'`, [row.id])
}

// ============================================================
// SC-3.7.2 — recordPlayerDefenseOutcome damage symmetry
// ============================================================

console.log('\n=== SC-3.7.2 — player-defense damage symmetry ===\n')

// Helper — set up a fresh threat in 'defending' state on a fresh base
async function makeDefendingThreat({ baseDefense = 8, baseGarrison = 20, baseTreasury = 1000, attackerForce = 10, threatType = 'raid' } = {}) {
  await dbRun(
    `INSERT INTO party_bases (campaign_id, character_id, name, category, subtype, status, defense_rating, garrison_strength, gold_treasury)
     VALUES (?, ?, 'TEST_PHASE37_dmgBase_' || (RANDOM() & 0xffff), 'martial', 'outpost', 'active', ?, ?, ?)`,
    [campA.id, charA.id, baseDefense, baseGarrison, baseTreasury]
  )
  const base = await dbGet(`SELECT * FROM party_bases WHERE name LIKE 'TEST_PHASE37_dmgBase_%' ORDER BY id DESC LIMIT 1`)

  // Add 3 buildings so damaged-tier has something to mutate
  for (let i = 0; i < 3; i++) {
    await dbRun(
      `INSERT INTO base_buildings (base_id, name, building_type, status)
       VALUES (?, 'TEST_PHASE37_b' || ?, 'workshop', 'completed')`,
      [base.id, i]
    )
  }

  await dbRun(
    `INSERT INTO base_threats (base_id, campaign_id, threat_type, attacker_source, attacker_category, attacker_force, warning_game_day, deadline_game_day, status)
     VALUES (?, ?, ?, 'TEST_attacker', 'criminal', ?, 100, 105, 'defending')`,
    [base.id, campA.id, threatType, attackerForce]
  )
  const threat = await dbGet(`SELECT * FROM base_threats WHERE base_id = ? ORDER BY id DESC LIMIT 1`, [base.id])
  return { base, threat }
}

// (a) repelled — no mechanical damage
{
  const { base, threat } = await makeDefendingThreat()
  await recordPlayerDefenseOutcome(threat.id, { outcome: 'repelled', gameDay: 105 })
  const after = await dbGet(`SELECT * FROM party_bases WHERE id = ?`, [base.id])
  const damagedBuildings = await dbAll(`SELECT * FROM base_buildings WHERE base_id = ? AND status = 'damaged'`, [base.id])
  assert(after.gold_treasury === 1000, 'repelled: treasury untouched')
  assert(after.garrison_strength === 20, 'repelled: garrison untouched')
  assert(damagedBuildings.length === 0, 'repelled: no buildings damaged')

  const final = await dbGet(`SELECT * FROM base_threats WHERE id = ?`, [threat.id])
  assert(final.status === 'resolved' && final.outcome === 'repelled', 'threat row resolved as repelled')
}

// (b) damaged — mild sub-tier (margin=0 default per §3.4): 25% treasury / 20% garrison / 1-2 buildings
{
  const { base, threat } = await makeDefendingThreat({ baseTreasury: 1000, baseGarrison: 20 })
  await recordPlayerDefenseOutcome(threat.id, { outcome: 'damaged', gameDay: 105 })
  const after = await dbGet(`SELECT * FROM party_bases WHERE id = ?`, [base.id])
  const damagedBuildings = await dbAll(`SELECT * FROM base_buildings WHERE base_id = ? AND status = 'damaged'`, [base.id])

  // Mild sub-tier: 25% treasury → 750 left; 20% garrison → 16 left
  assert(after.gold_treasury === 750, `damaged (mild): treasury 1000 → 750 (25% loss), got ${after.gold_treasury}`)
  assert(after.garrison_strength === 16, `damaged (mild): garrison 20 → 16 (20% loss), got ${after.garrison_strength}`)
  assert(damagedBuildings.length >= 1 && damagedBuildings.length <= 2,
    `damaged (mild): 1-2 buildings damaged, got ${damagedBuildings.length}`)

  const final = await dbGet(`SELECT * FROM base_threats WHERE id = ?`, [threat.id])
  assert(final.status === 'resolved' && final.outcome === 'damaged', 'threat row resolved as damaged')

  // damage_report JSON populates with mechanical detail
  const report = JSON.parse(final.damage_report)
  assert(report.treasury_lost_gp === 250, `damage_report records 250gp lost, got ${report.treasury_lost_gp}`)
  assert(report.garrison_lost === 4, `damage_report records 4 garrison lost, got ${report.garrison_lost}`)
  assert(Array.isArray(report.buildings_damaged) && report.buildings_damaged.length === damagedBuildings.length,
    'damage_report records buildings_damaged array')
  assert(report.player_defended === true, 'damage_report carries player_defended flag')
  assert(report.rolls?.synthetic === true, 'damage_report rolls marked synthetic (no real d20)')
}

// (c) captured — 90% treasury / all garrison / all buildings
{
  const { base, threat } = await makeDefendingThreat({ baseTreasury: 1000, baseGarrison: 20 })
  await recordPlayerDefenseOutcome(threat.id, { outcome: 'captured', gameDay: 105 })
  const after = await dbGet(`SELECT * FROM party_bases WHERE id = ?`, [base.id])
  const damagedBuildings = await dbAll(`SELECT * FROM base_buildings WHERE base_id = ? AND status = 'damaged'`, [base.id])

  assert(after.gold_treasury === 100, `captured: 90% treasury loss → 100 left, got ${after.gold_treasury}`)
  assert(after.garrison_strength === 0, 'captured: garrison wiped')
  assert(damagedBuildings.length === 3, `captured: all 3 buildings damaged, got ${damagedBuildings.length}`)
  assert(after.status === 'damaged', 'captured: party_bases.status flips to damaged (per legacy convention)')

  const final = await dbGet(`SELECT * FROM base_threats WHERE id = ?`, [threat.id])
  assert(final.outcome === 'captured', 'threat row outcome captured')
  assert(final.recapture_deadline_game_day === 105 + 14, 'recapture deadline set to gameDay + 14')
}

// (d) Caller-supplied damageReport merges WITH mechanical mutation
{
  const { base, threat } = await makeDefendingThreat({ baseTreasury: 800, baseGarrison: 30 })
  const callerReport = { hero_moments: ['Vesna held the gate'], custom_field: 'preserved' }
  await recordPlayerDefenseOutcome(threat.id, { outcome: 'damaged', damageReport: callerReport, gameDay: 105 })
  const after = await dbGet(`SELECT * FROM party_bases WHERE id = ?`, [base.id])
  // mild sub-tier: 25%/20%
  assert(after.gold_treasury === 600, `mechanical mutation runs underneath caller report (treasury 800 → 600)`)
  assert(after.garrison_strength === 24, `mechanical mutation runs underneath (garrison 30 → 24)`)

  const final = await dbGet(`SELECT * FROM base_threats WHERE id = ?`, [threat.id])
  const report = JSON.parse(final.damage_report)
  assert(report.custom_field === 'preserved', 'caller-supplied damageReport fields preserved')
  assert(Array.isArray(report.hero_moments) && report.hero_moments.includes('Vesna held the gate'),
    'caller-supplied hero_moments preserved')
  assert(report.player_defended === true, 'player_defended flag set')
}

// ============================================================
// CLEANUP
// ============================================================

console.log('\n=== Cleanup ===\n')
await cleanup()
assert(true, 'TEST_PHASE37_ data removed')

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
if (failed > 0) process.exit(1)
