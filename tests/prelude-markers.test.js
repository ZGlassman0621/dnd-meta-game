/**
 * Prelude Phase 2b-i — marker detection tests.
 *
 * Covers the 5 lifecycle markers in scope for Phase 2b-i:
 *   [AGE_ADVANCE: years=N]
 *   [CHAPTER_END: summary="..."]
 *   [SESSION_END_CLIFFHANGER: "..."]
 *   [NPC_CANON: ...]
 *   [LOCATION_CANON: ...]
 *
 * Plus stripPreludeMarkers (removes all markers from rendered narrative)
 * and detectPreludeMarkers (roll-up detection).
 */

import {
  detectAgeAdvance,
  detectChapterEnd,
  detectCliffhanger,
  detectNpcCanons,
  detectLocationCanons,
  detectHpChanges,
  detectChapterPromise,
  detectStatHints,
  detectSkillHints,
  detectClassHints,
  detectThemeHints,
  detectAncestryHints,
  detectValueHints,
  detectCanonFacts,
  detectCanonFactRetires,
  detectNextSceneWeight,
  detectPreludeMarkers,
  stripPreludeMarkers
} from '../server/services/preludeMarkerDetection.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

console.log('\n=== AGE_ADVANCE ===\n');
{
  assert(detectAgeAdvance('') === null, 'empty → null');
  assert(detectAgeAdvance('no marker here') === null, 'no marker → null');
  assert(detectAgeAdvance('[AGE_ADVANCE: years=3]')?.years === 3, 'basic years=3');
  assert(detectAgeAdvance('Three years pass. [AGE_ADVANCE: years=3]')?.years === 3, 'marker with surrounding text');
  assert(detectAgeAdvance('[age_advance: years=5]')?.years === 5, 'lowercase variant');
  assert(detectAgeAdvance('[AGE_ADVANCE:years=10]')?.years === 10, 'no spaces variant');
  assert(detectAgeAdvance('[AGE_ADVANCE: years=0]') === null, 'zero years rejected');
  assert(detectAgeAdvance('[AGE_ADVANCE: years=-3]') === null, 'negative years rejected');
}

console.log('\n=== CHAPTER_END ===\n');
{
  const m = detectChapterEnd('[CHAPTER_END: summary="She closed the door on childhood."]');
  assert(m?.summary === 'She closed the door on childhood.', 'basic quoted summary');
  assert(detectChapterEnd('[CHAPTER_END: summary=\'single quotes\']')?.summary === 'single quotes', 'single-quoted summary');
  assert(detectChapterEnd('') === null, 'empty → null');
  assert(detectChapterEnd('[CHAPTER_END]') === null, 'no summary field → null');
}

console.log('\n=== SESSION_END_CLIFFHANGER ===\n');
{
  assert(detectCliffhanger('[SESSION_END_CLIFFHANGER: "He stands at the door."]') === 'He stands at the door.', 'double-quoted');
  assert(detectCliffhanger("[SESSION_END_CLIFFHANGER: 'single quoted']") === 'single quoted', 'single-quoted');
  assert(detectCliffhanger('[SESSION_END_CLIFFHANGER: text="with text field"]') === 'with text field', 'text= field form');
  assert(detectCliffhanger('[SESSION_END_CLIFFHANGER: bare text no quotes]') === 'bare text no quotes', 'bare text form');
  assert(detectCliffhanger('') === null, 'empty → null');
}

console.log('\n=== NPC_CANON ===\n');
{
  const npcs = detectNpcCanons('[NPC_CANON: name="Moira Salfire" relationship="mother" status="alive"]');
  assert(npcs.length === 1, 'one marker → one entry');
  assert(npcs[0].name === 'Moira Salfire', 'extracts name');
  assert(npcs[0].relationship === 'mother', 'extracts relationship');
  assert(npcs[0].status === 'alive', 'extracts status');

  const multi = detectNpcCanons(
    'Moira appears. [NPC_CANON: name="Moira" relationship="mother" status="alive"] ' +
    'Then Davyr. [NPC_CANON: name="Davyr" relationship="parent" status="alive"]'
  );
  assert(multi.length === 2, 'two markers → two entries');
  assert(multi[1].name === 'Davyr', 'second entry captured');

  const defaulted = detectNpcCanons('[NPC_CANON: name="Old Pell"]');
  assert(defaulted[0].status === 'alive', 'status defaults to alive');

  assert(detectNpcCanons('[NPC_CANON: relationship="mother"]').length === 0, 'missing name → skipped');
}

console.log('\n=== LOCATION_CANON ===\n');
{
  const locs = detectLocationCanons('[LOCATION_CANON: name="Ashlane" type="tenement" is_home=true]');
  assert(locs.length === 1, 'one marker → one entry');
  assert(locs[0].name === 'Ashlane', 'extracts name');
  assert(locs[0].type === 'tenement', 'extracts type');
  assert(locs[0].is_home === true, 'is_home=true parsed');

  const notHome = detectLocationCanons('[LOCATION_CANON: name="Kiln Ward" type="district" is_home=false]');
  assert(notHome[0].is_home === false, 'is_home=false parsed');

  const omitHome = detectLocationCanons('[LOCATION_CANON: name="Darromar" type="city"]');
  assert(omitHome[0].is_home === false, 'omitted is_home defaults false');
}

console.log('\n=== detectPreludeMarkers (roll-up) ===\n');
{
  const text = `The scene closes.

  [AGE_ADVANCE: years=4]
  [CHAPTER_END: summary="Middle childhood ends."]
  [NPC_CANON: name="Halene" relationship="mentor" status="alive"]
  [LOCATION_CANON: name="Ashlane" type="tenement" is_home=true]
  [SESSION_END_CLIFFHANGER: "The letter waits on the table."]`;

  const all = detectPreludeMarkers(text);
  assert(all.ageAdvance?.years === 4, 'age advance detected');
  assert(all.chapterEnd?.summary === 'Middle childhood ends.', 'chapter end detected');
  assert(all.cliffhanger === 'The letter waits on the table.', 'cliffhanger detected');
  assert(all.npcCanons.length === 1, 'npc canons detected');
  assert(all.locationCanons.length === 1, 'location canons detected');

  const empty = detectPreludeMarkers('no markers at all in this text');
  assert(empty.ageAdvance === null, 'empty text → null age advance');
  assert(empty.npcCanons.length === 0, 'empty text → empty npcs');
}

console.log('\n=== HP_CHANGE ===\n');
{
  const one = detectHpChanges('He shoves you against the wall. [HP_CHANGE: delta=-2 reason="shoved"]');
  assert(one.length === 1, 'one marker → one entry');
  assert(one[0].delta === -2, 'delta parsed as -2');
  assert(one[0].reason === 'shoved', 'reason captured');

  const heal = detectHpChanges('A night of rest. [HP_CHANGE: delta=1 reason="long rest"]');
  assert(heal[0].delta === 1, 'positive delta (healing) parsed');

  const multi = detectHpChanges('You trip. [HP_CHANGE: delta=-1] Then kick your shin on a rock. [HP_CHANGE: delta=-1 reason="rock"]');
  assert(multi.length === 2, 'two markers → two entries');
  assert(multi[1].reason === 'rock', 'second reason captured');

  assert(detectHpChanges('no marker here').length === 0, 'no marker → empty array');
  assert(detectHpChanges('[HP_CHANGE: delta=0]').length === 0, 'zero delta rejected');
  assert(detectHpChanges('[HP_CHANGE: reason="nothing"]').length === 0, 'missing delta rejected');
}

console.log('\n=== CHAPTER_PROMISE ===\n');
{
  const m = detectChapterPromise('[CHAPTER_PROMISE: theme="choosing who you become" question="Is that right?"]');
  assert(m?.theme === 'choosing who you become', 'theme captured');
  assert(m?.question === 'Is that right?', 'question captured');

  assert(detectChapterPromise('') === null, 'empty → null');
  assert(detectChapterPromise('no marker') === null, 'missing → null');

  const partial = detectChapterPromise('[CHAPTER_PROMISE: theme="just the theme"]');
  assert(partial?.theme === 'just the theme', 'theme-only captured');
}

console.log('\n=== STAT_HINT ===\n');
{
  const hints = detectStatHints('[STAT_HINT: stat=str magnitude=1 reason="all the climbing"]');
  assert(hints.length === 1, 'one marker → one entry');
  assert(hints[0].stat === 'str', 'stat lowercased');
  assert(hints[0].magnitude === 1, 'magnitude parsed');
  assert(hints[0].reason === 'all the climbing', 'reason captured');

  assert(detectStatHints('[STAT_HINT: stat=STR magnitude=2]')[0].stat === 'str', 'uppercase stat normalized');
  assert(detectStatHints('[STAT_HINT: stat=foo]').length === 0, 'invalid stat rejected');
  assert(detectStatHints('[STAT_HINT: stat=str magnitude=3]').length === 0, 'magnitude >2 rejected');
  assert(detectStatHints('[STAT_HINT: stat=str magnitude=0]').length === 0, 'magnitude 0 rejected');
  assert(detectStatHints('[STAT_HINT: stat=str]')[0].magnitude === 1, 'default magnitude = 1');
}

console.log('\n=== SKILL_HINT ===\n');
{
  const hints = detectSkillHints('[SKILL_HINT: skill="Athletics" reason="climbing"]');
  assert(hints.length === 1, 'one marker → one entry');
  assert(hints[0].skill === 'Athletics', 'skill captured');
  assert(detectSkillHints('[SKILL_HINT: reason="no skill"]').length === 0, 'missing skill rejected');
}

console.log('\n=== CLASS_HINT / THEME_HINT / ANCESTRY_HINT ===\n');
{
  const c = detectClassHints('[CLASS_HINT: class="ranger" reason="tracking"]');
  assert(c[0].class === 'ranger', 'class lowercased');

  const t = detectThemeHints('[THEME_HINT: theme="outlander"]');
  assert(t[0].theme === 'outlander', 'theme captured');

  const a = detectAncestryHints('[ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense" reason="stonework"]');
  assert(a[0].feat_id === 'dwarf_l1_stone_sense', 'feat_id captured');
}

console.log('\n=== VALUE_HINT ===\n');
{
  const vs = detectValueHints('[VALUE_HINT: value="loyalty" delta=+1 reason="stayed for Rook"]');
  assert(vs.length === 1, 'one marker → one entry');
  assert(vs[0].value === 'loyalty', 'value lowercased');
  assert(vs[0].delta === 1, 'positive delta parsed');

  const neg = detectValueHints('[VALUE_HINT: value="self_preservation" delta=-2 reason="..."]');
  assert(neg[0].delta === -2, 'negative delta parsed');

  assert(detectValueHints('[VALUE_HINT: delta=+1]').length === 0, 'missing value rejected');
  assert(detectValueHints('[VALUE_HINT: value="x" delta=0]').length === 0, 'zero delta rejected');
}

console.log('\n=== CANON_FACT ===\n');
{
  const facts = detectCanonFacts('[CANON_FACT: subject="Moss" category=npc fact="age 9, older brother, no weapons training"]');
  assert(facts.length === 1, 'one marker → one entry');
  assert(facts[0].subject === 'Moss', 'subject captured');
  assert(facts[0].category === 'npc', 'category captured');
  assert(facts[0].fact === 'age 9, older brother, no weapons training', 'fact captured');

  const multi = detectCanonFacts(
    '[CANON_FACT: subject="Moss" category=npc fact="age 9"] ' +
    '[CANON_FACT: subject="Halda" category=npc fact="mentor, ex-Crown"]'
  );
  assert(multi.length === 2, 'two markers → two entries');

  const defaultCat = detectCanonFacts('[CANON_FACT: subject="Zalyere" fact="left-handed"]');
  assert(defaultCat[0].category === 'trait', 'default category = trait');

  const bad = detectCanonFacts('[CANON_FACT: subject="Moss" category=invalid fact="x"]');
  assert(bad.length === 0, 'invalid category rejected');

  const missing = detectCanonFacts('[CANON_FACT: category=npc fact="x"]');
  assert(missing.length === 0, 'missing subject rejected');
}

console.log('\n=== CANON_FACT_RETIRE ===\n');
{
  const retires = detectCanonFactRetires('[CANON_FACT_RETIRE: subject="Moss" fact_contains="age 9"]');
  assert(retires.length === 1, 'one retire → one entry');
  assert(retires[0].subject === 'Moss', 'subject captured');
  assert(retires[0].factContains === 'age 9', 'fact_contains captured');

  const alt = detectCanonFactRetires('[CANON_FACT_RETIRE: subject="Davyr" contains="present"]');
  assert(alt[0].factContains === 'present', '"contains" alias accepted');

  const bad = detectCanonFactRetires('[CANON_FACT_RETIRE: subject="x"]');
  assert(bad.length === 0, 'missing fact_contains rejected');
}

console.log('\n=== detectPreludeMarkers roll-up (with HP + CHAPTER_PROMISE) ===\n');
{
  const text = '[HP_CHANGE: delta=-2 reason="fall"] [CHAPTER_PROMISE: theme="x" question="y?"] The scene ends.';
  const all = detectPreludeMarkers(text);
  assert(all.hpChanges.length === 1, 'roll-up includes hpChanges');
  assert(all.chapterPromise?.theme === 'x', 'roll-up includes chapterPromise');
}

console.log('\n=== NEXT_SCENE_WEIGHT (v1.0.62 auto model picker) ===\n');
{
  assert(detectNextSceneWeight('') === null, 'empty → null');
  assert(detectNextSceneWeight('no marker') === null, 'no marker → null');
  assert(detectNextSceneWeight('[NEXT_SCENE_WEIGHT: heavy]') === 'heavy', 'heavy parsed');
  assert(detectNextSceneWeight('[NEXT_SCENE_WEIGHT: light]') === 'light', 'light parsed');
  assert(detectNextSceneWeight('[NEXT_SCENE_WEIGHT: standard]') === 'standard', 'standard parsed');
  assert(detectNextSceneWeight('[next_scene_weight: HEAVY]') === 'heavy', 'case-insensitive');
  assert(detectNextSceneWeight('[NEXT_SCENE_WEIGHT:heavy]') === 'heavy', 'no space variant');
  assert(detectNextSceneWeight('[NEXT_SCENE_WEIGHT: sparkly]') === null, 'invalid weight rejected');

  // "Last one wins" — if the AI fires multiple, the latest read of the
  // situation is the one we trust.
  const multi = detectNextSceneWeight(
    '[NEXT_SCENE_WEIGHT: light] ...then things escalate... [NEXT_SCENE_WEIGHT: heavy]'
  );
  assert(multi === 'heavy', 'last fire wins on multiple');

  // Roll-up integration
  const rolled = detectPreludeMarkers('The scene closes. [NEXT_SCENE_WEIGHT: heavy]');
  assert(rolled.nextSceneWeight === 'heavy', 'roll-up includes nextSceneWeight');

  // Absence in roll-up
  const absent = detectPreludeMarkers('A quiet room. She sets the kettle.');
  assert(absent.nextSceneWeight === null, 'absent marker → null in roll-up');
}

console.log('\n=== stripPreludeMarkers ===\n');
{
  const raw = 'She leaves. [AGE_ADVANCE: years=3] Three years pass. [CHAPTER_END: summary="x"] [NPC_CANON: name="Moira"] [LOCATION_CANON: name="Ashlane"] [SESSION_END_CLIFFHANGER: "y"] Fin.';
  const stripped = stripPreludeMarkers(raw);
  assert(!stripped.includes('[AGE_ADVANCE'), 'AGE_ADVANCE removed');
  assert(!stripped.includes('[CHAPTER_END'), 'CHAPTER_END removed');
  assert(!stripped.includes('[NPC_CANON'), 'NPC_CANON removed');
  assert(!stripped.includes('[LOCATION_CANON'), 'LOCATION_CANON removed');
  assert(!stripped.includes('[SESSION_END_CLIFFHANGER'), 'SESSION_END_CLIFFHANGER removed');
  assert(stripped.includes('She leaves.'), 'surrounding prose preserved');
  assert(stripped.includes('Three years pass.'), 'prose between markers preserved');
  assert(stripped.includes('Fin.'), 'trailing prose preserved');
}

console.log('\n=== stripPreludeMarkers: inherited + catch-all markers ===\n');
{
  // Inherited DM markers should also strip
  const combat = stripPreludeMarkers('Steel rings out. [COMBAT_START: Enemies="bandit, bandit"] They swing.');
  assert(!combat.includes('[COMBAT_START'), 'COMBAT_START stripped');
  assert(combat.includes('Steel rings out.'), 'prose around COMBAT_START preserved');
  assert(combat.includes('They swing.'), 'trailing prose preserved');

  const combatEnd = stripPreludeMarkers('The last one falls. [COMBAT_END] Silence.');
  assert(!combatEnd.includes('[COMBAT_END'), 'COMBAT_END stripped');
  assert(combatEnd.includes('Silence.'), 'trailing preserved');

  const loot = stripPreludeMarkers('[LOOT_DROP: Items="copper coin"]You find a coin.');
  assert(!loot.includes('[LOOT_DROP'), 'LOOT_DROP stripped');

  const hp = stripPreludeMarkers('A blow lands. [HP_CHANGE: delta=-2 reason="fist"] You stagger.');
  assert(!hp.includes('[HP_CHANGE'), 'HP_CHANGE stripped');
  assert(hp.includes('A blow lands.') && hp.includes('You stagger.'), 'HP_CHANGE surrounding prose kept');

  const cp = stripPreludeMarkers('[CHAPTER_PROMISE: theme="x" question="y?"] Let\'s open.');
  assert(!cp.includes('[CHAPTER_PROMISE'), 'CHAPTER_PROMISE stripped');

  // Phase 3 emergence markers all stripped from display
  const stats = stripPreludeMarkers('You climb. [STAT_HINT: stat=str magnitude=1] Muscles work.');
  assert(!stats.includes('[STAT_HINT'), 'STAT_HINT stripped');

  const skills = stripPreludeMarkers('Scan the room. [SKILL_HINT: skill="Perception"]');
  assert(!skills.includes('[SKILL_HINT'), 'SKILL_HINT stripped');

  const cls = stripPreludeMarkers('[CLASS_HINT: class="ranger"] Hunting reveals much.');
  assert(!cls.includes('[CLASS_HINT'), 'CLASS_HINT stripped');

  const theme = stripPreludeMarkers('[THEME_HINT: theme="outlander"]');
  assert(!theme.includes('[THEME_HINT'), 'THEME_HINT stripped');

  const anc = stripPreludeMarkers('[ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense"]');
  assert(!anc.includes('[ANCESTRY_HINT'), 'ANCESTRY_HINT stripped');

  const vals = stripPreludeMarkers('[VALUE_HINT: value="loyalty" delta=+1]');
  assert(!vals.includes('[VALUE_HINT'), 'VALUE_HINT stripped');

  const cf = stripPreludeMarkers('[CANON_FACT: subject="Moss" category=npc fact="age 9"] Moss waits.');
  assert(!cf.includes('[CANON_FACT'), 'CANON_FACT stripped');
  assert(cf.includes('Moss waits.'), 'CANON_FACT surrounding prose kept');

  const cfr = stripPreludeMarkers('[CANON_FACT_RETIRE: subject="Moss" fact_contains="age 9"] Three years on.');
  assert(!cfr.includes('[CANON_FACT_RETIRE'), 'CANON_FACT_RETIRE stripped');

  const nsw = stripPreludeMarkers('The door swings. [NEXT_SCENE_WEIGHT: heavy]');
  assert(!nsw.includes('[NEXT_SCENE_WEIGHT'), 'NEXT_SCENE_WEIGHT stripped');
  assert(nsw.includes('The door swings.'), 'NEXT_SCENE_WEIGHT surrounding prose kept');

  // Catch-all for future markers
  const future = stripPreludeMarkers('Beat fires. [FUTURE_MARKER: payload="x"] and continues.');
  assert(!future.includes('[FUTURE_MARKER'), 'Unknown ALL_CAPS marker stripped by catch-all');

  // Must NOT strip legitimate bracketed text (proper nouns, single words, mixed case)
  const keep = stripPreludeMarkers('You walk through [Karrow\'s Rest] — home. Then [Eleint] passed.');
  assert(keep.includes("[Karrow's Rest]"), "Mixed-case bracketed proper noun preserved");
  assert(keep.includes('[Eleint]'), 'Short bracketed month name preserved (not all-caps 3+ chars)');
}

console.log('\n==================================================');
console.log(`Prelude Marker Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
