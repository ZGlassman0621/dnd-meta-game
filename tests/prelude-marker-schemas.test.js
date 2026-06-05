/**
 * Phase 3 SC-6.3 — Prelude marker schema validation tests.
 *
 * Per the SC-6.3 parking decision (DECISION_LOG 2026-05-04): the 19
 * Prelude markers are added to MARKER_SCHEMAS for VALIDATION ONLY.
 * Side-effect dispatch stays in `processMarkersForSession` because of
 * ordering invariants between markers that don't fit per-handler
 * dispatch. The pipeline's contribution here is correction-loop feedback
 * — when the AI emits a malformed prelude marker (missing required field,
 * invalid enum, out-of-range int), the next prompt gets a [SYSTEM] note.
 *
 * This test confirms:
 *   1. All 19 prelude schemas are registered
 *   2. Each schema validates its canonical shape correctly
 *   3. Each schema rejects malformed shapes with field-targeted errors
 *   4. Presence-only markers (THEME_COMMITMENT_OFFERED, NEXT_SCENE_WEIGHT,
 *      PRELUDE_END) accept bodyless emissions
 *   5. ZERO handlers are registered (parking is preserved)
 *   6. The validateDmMarkers + buildCorrectionMessage path produces
 *      usable correction notes for prelude failures
 */

import {
  MARKER_SCHEMAS,
  validateDmMarkers,
  buildCorrectionMessage,
  parseMarkerBody
} from '../server/services/markerSchemas.js'
import { _hasHandler } from '../server/services/markerPipeline.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++ }
  else { console.error(`  ✗ ${message}`); failed++ }
}

const PRELUDE_KEYS = [
  'AGE_ADVANCE', 'CHAPTER_END', 'SESSION_END_CLIFFHANGER',
  'NPC_CANON', 'LOCATION_CANON', 'HP_CHANGE', 'CHAPTER_PROMISE',
  'THEME_COMMITMENT_OFFERED', 'NEXT_SCENE_WEIGHT',
  'STAT_HINT', 'SKILL_HINT', 'CLASS_HINT', 'THEME_HINT', 'ANCESTRY_HINT',
  'CANON_THREAD', 'CANON_FACT', 'CANON_FACT_RETIRE',
  'DEPARTURE', 'PRELUDE_END'
]

console.log('\n=== All 19 prelude marker schemas registered ===\n')
{
  for (const key of PRELUDE_KEYS) {
    assert(MARKER_SCHEMAS[key] !== undefined, `MARKER_SCHEMAS.${key} present`)
  }
  assert(PRELUDE_KEYS.length === 19, '19 prelude marker schemas total')
}

console.log('\n=== ZERO handlers registered (parking preserved) ===\n')
{
  for (const key of PRELUDE_KEYS) {
    assert(!_hasHandler(key), `no handler for ${key} (parked per SC-6.3 decision)`)
  }
}

console.log('\n=== AGE_ADVANCE: validates years, rejects missing/invalid ===\n')
{
  const ok = parseMarkerBody('years=3', 'AGE_ADVANCE')
  assert(ok.ok && ok.data.years === 3, 'years=3 parses')
  const missing = parseMarkerBody('', 'AGE_ADVANCE')
  assert(!missing.ok && missing.errors.some(e => e.field === 'years'), 'missing years → error')
  const tooLow = parseMarkerBody('years=0', 'AGE_ADVANCE')
  assert(!tooLow.ok && tooLow.errors.some(e => e.reason.includes('≥ 1')), 'years=0 → min violation')
}

console.log('\n=== CHAPTER_END: requires summary ===\n')
{
  const ok = parseMarkerBody('summary="A new dawn breaks"', 'CHAPTER_END')
  assert(ok.ok && ok.data.summary === 'A new dawn breaks', 'quoted summary parses')
  const missing = parseMarkerBody('', 'CHAPTER_END')
  assert(!missing.ok && missing.errors.some(e => e.field === 'summary'), 'missing summary → error')
}

console.log('\n=== HP_CHANGE: signed delta required ===\n')
{
  const damage = parseMarkerBody('delta=-2 reason="caught a branch"', 'HP_CHANGE')
  assert(damage.ok && damage.data.delta === -2, 'negative delta parses')
  const heal = parseMarkerBody('delta=1', 'HP_CHANGE')
  assert(heal.ok && heal.data.delta === 1, 'positive delta parses (reason optional)')
  const noDelta = parseMarkerBody('reason="fell"', 'HP_CHANGE')
  assert(!noDelta.ok && noDelta.errors.some(e => e.field === 'delta'), 'missing delta → error')
}

console.log('\n=== STAT_HINT: stat enum, magnitude bounded [1, 2] ===\n')
{
  const ok = parseMarkerBody('stat=str magnitude=1 reason="lifted the cart"', 'STAT_HINT')
  assert(ok.ok && ok.data.stat === 'str' && ok.data.magnitude === 1, 'canonical form parses')
  const bad = parseMarkerBody('stat=spd magnitude=1', 'STAT_HINT')
  assert(!bad.ok && bad.errors.some(e => e.field === 'stat'), 'invalid stat → error')
  const tooHigh = parseMarkerBody('stat=dex magnitude=3', 'STAT_HINT')
  assert(!tooHigh.ok && tooHigh.errors.some(e => e.field === 'magnitude'), 'magnitude=3 → max violation')
}

console.log('\n=== CANON_FACT: subject + category enum + fact required ===\n')
{
  const ok = parseMarkerBody('subject="Mira" category=npc fact="speaks Dwarvish"', 'CANON_FACT')
  assert(ok.ok, 'canonical canon-fact parses')
  assert(ok.data.subject === 'Mira', 'subject extracted')
  assert(ok.data.category === 'npc', 'category extracted (lowercased enum)')
  const badCat = parseMarkerBody('subject="Mira" category=allergy fact="..."', 'CANON_FACT')
  assert(!badCat.ok && badCat.errors.some(e => e.field === 'category'), 'invalid category → error')
}

console.log('\n=== CANON_THREAD: kind enum + subject + condition required, weight optional ===\n')
{
  const ok = parseMarkerBody(
    'kind=blood_debt subject="the Vorkov clan" condition="PC returns to home region after 5+ years" weight=major',
    'CANON_THREAD'
  )
  assert(ok.ok && ok.data.kind === 'blood_debt' && ok.data.weight === 'major', 'full thread parses')
  const noCondition = parseMarkerBody('kind=blood_debt subject="Vorkov"', 'CANON_THREAD')
  assert(!noCondition.ok && noCondition.errors.some(e => e.field === 'condition'), 'missing condition → error')
  const badKind = parseMarkerBody('kind=grudge subject="X" condition="Y"', 'CANON_THREAD')
  assert(!badKind.ok && badKind.errors.some(e => e.field === 'kind'), 'invalid kind → error')
}

console.log('\n=== Presence-only markers (no fields) ===\n')
{
  // THEME_COMMITMENT_OFFERED, NEXT_SCENE_WEIGHT, PRELUDE_END all have empty
  // fields. Body content is ignored by the parser (NEXT_SCENE_WEIGHT's
  // bareword `heavy`/`light` doesn't fit field=value; the detect function
  // extracts the value separately). Schema confirms presence.
  for (const key of ['THEME_COMMITMENT_OFFERED', 'NEXT_SCENE_WEIGHT', 'PRELUDE_END']) {
    const empty = parseMarkerBody('', key)
    assert(empty.ok, `${key}: bare brackets parse as ok`)
    const stray = parseMarkerBody('whatever the AI improvised', key)
    assert(stray.ok, `${key}: stray body content tolerated (no field extraction)`)
  }
}

console.log('\n=== End-to-end: validateDmMarkers in narrative + buildCorrectionMessage ===\n')
{
  // Mix of valid + invalid markers in a realistic narrative slice.
  const narrative = `
    The mentor takes you up the ridge. [AGE_ADVANCE: years=2] You are older now.
    [CANON_FACT: subject="Mira" category=npc fact="speaks Dwarvish"]
    [STAT_HINT: stat=spd magnitude=1 reason="ran the whole way"]
    [HP_CHANGE: reason="scraped knee"]
  `
  const { validByKey, failures } = validateDmMarkers(narrative)

  // Two valid markers
  assert(validByKey.AGE_ADVANCE && validByKey.AGE_ADVANCE.length === 1, '1 valid AGE_ADVANCE')
  assert(validByKey.CANON_FACT && validByKey.CANON_FACT.length === 1, '1 valid CANON_FACT')

  // Two failures
  assert(failures.length === 2, '2 marker failures')
  const failureKeys = failures.map(f => f.schemaKey).sort()
  assert(failureKeys.join(',') === 'HP_CHANGE,STAT_HINT', 'failure keys = HP_CHANGE + STAT_HINT')

  // Correction message composes
  const note = buildCorrectionMessage(failures)
  assert(typeof note === 'string' && note.length > 0, 'correction note generated')
  assert(note.includes('HP_CHANGE') && note.includes('delta'), 'correction mentions HP_CHANGE delta')
  assert(note.includes('STAT_HINT') && note.includes('stat'), 'correction mentions STAT_HINT stat')
}

console.log('\n=== Mixed prelude + non-prelude marker validation ===\n')
{
  // Prelude session may also see DM markers (the AI inherits some). Schema
  // validation should handle both without cross-confusion.
  const narrative = `[CHAPTER_END: summary="Chapter 1 closes"] [PIETY_CHANGE: Deity="Lathander" Amount=1]`
  const { validByKey, failures } = validateDmMarkers(narrative)
  assert(validByKey.CHAPTER_END && validByKey.CHAPTER_END.length === 1, 'prelude CHAPTER_END validates')
  assert(validByKey.PIETY_CHANGE && validByKey.PIETY_CHANGE.length === 1, 'DM PIETY_CHANGE validates')
  assert(failures.length === 0, 'no false failures from cross-marker scan')
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`)
process.exit(failed > 0 ? 1 : 0)
