/**
 * Phase 4 — campaign act progression.
 *
 * `getPlanSummaryForSession` hardcoded `plan.main_quest.acts[0]`, so a campaign
 * generated with a three-act structure described Act 1 in the DM prompt
 * forever. These tests cover the replacement: a pointer stored on the campaign
 * row, clamped against whatever act list the current plan happens to have.
 */

import { initDatabase, dbRun, dbGet } from '../server/database.js'
import {
  resolveCurrentAct,
  getCampaignAct,
  setCampaignAct,
  advanceCampaignAct,
  getPlanSummaryForSession
} from '../server/services/campaignPlanService.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed++
    console.log(`  ✓ ${message}`)
  } else {
    failed++
    console.log(`  ✗ ${message}`)
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (got ${JSON.stringify(actual)})`)
}

const THREE_ACT_PLAN = {
  main_quest: {
    title: 'The Sundered Crown',
    summary: 'A crown broken in three.',
    acts: [
      { title: 'The Rumour', summary: 'Word reaches the party.' },
      { title: 'The Hunt', summary: 'The party pursues the shards.' },
      { title: 'The Reckoning', summary: 'The crown is reforged, or is not.' }
    ]
  }
}

const created = []

async function makeCampaign(plan, name) {
  const r = await dbRun(
    'INSERT INTO campaigns (name, setting, status, campaign_plan) VALUES (?, ?, ?, ?)',
    [name, 'Forgotten Realms', 'active', plan ? JSON.stringify(plan) : null]
  )
  const id = Number(r.lastInsertRowid)
  created.push(id)
  return id
}

async function run() {
  await initDatabase()

  // ============================================================
  console.log('\n=== Test 1: resolveCurrentAct clamps rather than throwing ===\n')
  // ============================================================

  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 0).act.title, 'The Rumour', 'index 0 resolves to the first act')
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 2).act.title, 'The Reckoning', 'index 2 resolves to the third act')
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 2).total, 3, 'total act count is reported')

  // A plan regenerated with fewer acts leaves the stored pointer dangling.
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 99).act.title, 'The Reckoning', 'an over-large index clamps to the last act')
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 99).clamped, true, 'clamping is reported, not silent')
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, -5).act.title, 'The Rumour', 'a negative index clamps to the first act')

  // Garbage in the column must not take down prompt assembly.
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, null).act.title, 'The Rumour', 'a null pointer falls back to act one')
  assertEqual(resolveCurrentAct(THREE_ACT_PLAN, 'banana').act.title, 'The Rumour', 'a non-numeric pointer falls back to act one')

  // Plenty of plans have no act structure at all.
  assertEqual(resolveCurrentAct({ main_quest: { title: 'x' } }, 0).act, null, 'a plan with no acts resolves to null')
  assertEqual(resolveCurrentAct({ main_quest: { title: 'x' } }, 0).total, 0, 'no acts means total 0')
  assertEqual(resolveCurrentAct(null, 0).act, null, 'a missing plan resolves to null')

  // ============================================================
  console.log('\n=== Test 2: the pointer defaults to act one and persists ===\n')
  // ============================================================

  const campaignId = await makeCampaign(THREE_ACT_PLAN, 'TEST_ACT Sundered Crown')

  let state = await getCampaignAct(campaignId)
  assertEqual(state.index, 0, 'a new campaign starts at act index 0')
  assertEqual(state.act.title, 'The Rumour', 'and resolves to the first act')

  const advanced = await advanceCampaignAct(campaignId)
  assertEqual(advanced.index, 1, 'advancing moves the pointer to act 2')
  assertEqual(advanced.act.title, 'The Hunt', 'and resolves to the second act')
  assertEqual(advanced.changed, true, 'the change is reported')
  assertEqual(advanced.atFinalAct, false, 'act 2 of 3 is not the final act')

  const persisted = await dbGet('SELECT current_act_index FROM campaigns WHERE id = ?', [campaignId])
  assertEqual(Number(persisted.current_act_index), 1, 'the pointer was written to the campaign row')

  // ============================================================
  console.log('\n=== Test 3: advancing stops at the final act ===\n')
  // ============================================================

  const third = await advanceCampaignAct(campaignId)
  assertEqual(third.index, 2, 'advancing again reaches act 3')
  assertEqual(third.atFinalAct, true, 'act 3 of 3 reports as final')

  const past = await advanceCampaignAct(campaignId)
  assertEqual(past.index, 2, 'advancing past the end is a no-op, not a wrap to act 1')
  assertEqual(past.changed, false, 'a no-op advance reports changed:false')
  assertEqual(past.act.title, 'The Reckoning', 'the final act stays resolved')

  // ============================================================
  console.log('\n=== Test 4: the prompt summary follows the pointer ===\n')
  // ============================================================

  // This is the actual regression: the summary used to say "The Rumour" here
  // no matter what the pointer said.
  let summary = await getPlanSummaryForSession(campaignId)
  assertEqual(summary.current_act.title, 'The Reckoning', 'getPlanSummaryForSession returns the CURRENT act, not acts[0]')
  assertEqual(summary.current_act_number, 3, 'the act number is 1-based for prompt display')
  assertEqual(summary.total_acts, 3, 'the total is exposed so the prompt can say "of 3"')

  await setCampaignAct(campaignId, 0)
  summary = await getPlanSummaryForSession(campaignId)
  assertEqual(summary.current_act.title, 'The Rumour', 'setting the pointer back moves the summary back')
  assertEqual(summary.current_act_number, 1, 'act number follows')

  // ============================================================
  console.log('\n=== Test 5: setCampaignAct clamps writes too ===\n')
  // ============================================================

  const clampedWrite = await setCampaignAct(campaignId, 42)
  assertEqual(clampedWrite.index, 2, 'a write past the end clamps to the final act')
  const storedAfterClamp = await dbGet('SELECT current_act_index FROM campaigns WHERE id = ?', [campaignId])
  assertEqual(Number(storedAfterClamp.current_act_index), 2, 'the CLAMPED value is what gets stored, not 42')

  // ============================================================
  console.log('\n=== Test 6: a campaign with no plan degrades quietly ===\n')
  // ============================================================

  const planless = await makeCampaign(null, 'TEST_ACT Planless')
  const planlessState = await getCampaignAct(planless)
  assertEqual(planlessState.act, null, 'no plan means no act')
  assertEqual(planlessState.total, 0, 'and no act count')

  const planlessAdvance = await advanceCampaignAct(planless)
  assertEqual(planlessAdvance.changed, false, 'advancing a planless campaign is a no-op, not an error')

  assertEqual(await getPlanSummaryForSession(planless), null, 'a planless campaign has no plan summary at all')

  // A plan whose main quest has no acts array.
  const actless = await makeCampaign({ main_quest: { title: 'Open-ended' } }, 'TEST_ACT Actless')
  const actlessSummary = await getPlanSummaryForSession(actless)
  assert(actlessSummary !== null, 'an act-less plan still produces a summary')
  assertEqual(actlessSummary.current_act, null, 'with a null current act')
  assertEqual(actlessSummary.current_act_number, null, 'and no act number to display')

  // ============================================================
  console.log('\n=== Cleanup ===\n')
  // ============================================================

  for (const id of created) {
    await dbRun('DELETE FROM campaigns WHERE id = ?', [id])
  }
  const leftover = await dbGet("SELECT COUNT(*) AS n FROM campaigns WHERE name LIKE 'TEST_ACT%'")
  assertEqual(Number(leftover.n), 0, 'test campaigns removed')

  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
  if (failed > 0) process.exit(1)
}

await run()
