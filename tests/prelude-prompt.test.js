/**
 * Prelude prompt builder tests (v1.0.63).
 *
 * Covers the three rule-level changes that shipped this version:
 *   • Rule 6 MOMENTUM — every response ends on engagement, menus forbidden
 *   • Rule 13 ROLL DISCIPLINE — chapter-gated surface format (Ch 1-2 offer
 *     rolls inside actions; Ch 3-4 bare rolls)
 *   • Rule 15b EMERGENCE SHAPING — upcoming scenes lean toward emerging
 *     strengths
 *
 * Plus the mechanical wiring:
 *   • The emergenceSnapshotBlock parameter slots into the system prompt
 *   • FINAL REMINDER block surfaces the new rules (recency position)
 *   • Opening prompt no longer mentions "concrete options"
 *
 * These are prompt-content tests — assert the expected rule language
 * appears (or doesn't) in the generated system prompt string.
 */

import {
  createPreludeSystemPrompt,
  createPreludeOpeningPrompt
} from '../server/services/preludeArcPromptBuilder.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

// Minimal fixtures the prompt builder needs. Shape matches what
// preludeSessionService actually passes in.
function makeCharacter(overrides = {}) {
  return {
    id: 1,
    name: 'Zalyere Astaron',
    first_name: 'Zalyere',
    nickname: null,
    race: 'Human',
    subrace: null,
    gender: 'male',
    prelude_age: 7,
    prelude_chapter: 1,
    current_hp: 10,
    max_hp: 10,
    ...overrides
  };
}

function makeSetup(overrides = {}) {
  return {
    gender: 'male',
    birth_circumstance: 'farmer_child',
    home_setting: 'village',
    region: 'sword_coast',
    parents: [{ name: 'Vask', role: 'father', status: 'living' }],
    siblings: [{ name: 'Moss', gender: 'brother', relative_age: 'two years older' }],
    talents: ['Noticing things', 'Patience', 'Memory'],
    cares: ['Family', 'Home', 'Truth'],
    tone_tags: ['tender_hopeful'],  // v1.0.73 — single preset value
    ...overrides
  };
}

function makeArcPlan(overrides = {}) {
  return {
    home_world: { description: 'A Sword Coast farming village.' },
    chapter_1_arc: { theme: 'childhood wonder', beats: [] },
    chapter_2_arc: { theme: 'widening world', beats: [] },
    chapter_3_arc: { theme: 'choosing who to become', beats: [], chapter_promise_prompt: 'Who will you be?' },
    chapter_4_arc: { theme: 'threshold', beats: [], departure_seed: { reason: 'apprenticeship', tone: 'hopeful' } },
    recurring_threads: [],
    ...overrides
  };
}

function makeRuntime(overrides = {}) {
  return {
    chapter: 1, age: 7, maxHp: 10, currentHp: 10, sessionNumber: 1,
    exchangeCount: 0, sessionBudget: 50, wrapAt: 65, forceAt: 80, progressFraction: 0,
    ...overrides
  };
}

// ---------------------------------------------------------------------------

console.log('\n=== Rule 6 MOMENTUM — every response ends on engagement ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    p.includes('KEEP MOMENTUM — EVERY RESPONSE ENDS ON ENGAGEMENT'),
    'Rule 6 heading renamed to "ENDS ON ENGAGEMENT"'
  );
  assert(
    p.includes('A DIRECT QUESTION'),
    'Rule 6 names option (a) — direct question'
  );
  assert(
    p.includes('A ROLL PROMPT'),
    'Rule 6 names option (b) — roll prompt'
  );
  assert(
    p.includes('SOMETHING HAPPENING TO OR AROUND'),
    'Rule 6 names option (c) — thing happening to/around PC'
  );
  assert(
    p.includes('FORBIDDEN') && p.includes('MENUS of actions'),
    'Rule 6 explicitly forbids action menus'
  );
  assert(
    p.includes('being led') && p.includes('still have agency'),
    'Rule 6 calls out "being led" scenes specifically'
  );
  // The old "2-3 concrete options" sub-branch must be gone
  assert(
    !p.includes('offer 2-3 concrete options'),
    'old "offer 2-3 concrete options" guidance removed'
  );
}

console.log('\n=== Rule 6 SECOND CARVE-OUT — NPC exits & unfinished thoughts (v1.0.69) ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    p.includes('SECOND CARVE-OUT') || p.includes('NPC EXITS AND UNFINISHED THOUGHTS'),
    'Rule 6 has the second carve-out heading (NPC exits)'
  );
  assert(
    p.includes('PAUSE BEFORE THE EXIT'),
    '6c option (i) — pause before exit'
  );
  assert(
    p.includes('COMPRESS FORWARD PAST THE EXIT'),
    '6c option (ii) — compress forward'
  );
  assert(
    p.includes('CALL A ROLL ON WHAT JUST HAPPENED'),
    '6c option (iii) — call a roll'
  );
  assert(
    p.includes('THE UNFINISHED SENTENCE IS A BECKON'),
    '6c mentions the unfinished-sentence pattern'
  );
  // BAD ENDINGS now includes the play-test Halgrim example
  assert(
    p.includes('walks toward the far door without looking back'),
    'BAD ENDINGS includes Halgrim exit example'
  );
  // GOOD ENDINGS includes 6c worked examples
  assert(
    p.includes('6c(i)') || p.includes('paused before exit'),
    'GOOD ENDINGS includes 6c(i) example'
  );
  assert(
    p.includes('6c(ii)') || p.includes('compressed forward past exit'),
    'GOOD ENDINGS includes 6c(ii) example'
  );
  assert(
    p.includes('6c(iii)') || p.includes('roll on what just happened'),
    'GOOD ENDINGS includes 6c(iii) example'
  );
  // Fail-condition line updated
  assert(
    p.includes('NPC walking away without a handoff'),
    'fail-condition line calls out NPC-walking-away as a fail'
  );

  // FINAL REMINDER surfaces the carve-out
  const tail = p.slice(p.indexOf('FINAL REMINDER'));
  assert(
    tail.includes('CARVE-OUT 2') && tail.includes('exits'),
    'FINAL REMINDER surfaces NPC-exit carve-out'
  );
}

console.log('\n=== Rule 6 CARVE-OUT — NPC-directed tasks route to roll prompt (v1.0.65) ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    p.includes('CRITICAL CARVE-OUT'),
    'Rule 6 has the CRITICAL CARVE-OUT heading'
  );
  assert(
    p.includes('NPC-DIRECTED TASKS ROUTE TO (b)'),
    'Rule 6 carve-out explicitly routes NPC-directed tasks to option (b)'
  );
  assert(
    p.includes('TRIGGER PHRASES THAT SIGNAL A ROLL PROMPT'),
    'Rule 6 has an explicit trigger-phrase list'
  );
  // The specific phrases that Sonnet missed in play-test
  assert(
    p.includes('Read it to me') || p.includes('"Read it to me."'),
    'trigger list covers "Read it to me"'
  );
  assert(
    p.includes('Can you sneak past'),
    'trigger list covers "Can you sneak past"'
  );
  assert(
    p.includes('Convince her'),
    'trigger list covers "Convince her"'
  );
  // The test framing that lets the AI self-check
  assert(
    p.includes('invent content they don') || p.includes('invent content'),
    'Rule 6 carve-out has the "invent content they don\'t have" self-test'
  );
  // The skipped-roll bad-ending examples
  assert(
    p.includes('SKIPPED ROLL'),
    'Rule 6 BAD ENDINGS list includes SKIPPED ROLL examples'
  );
  assert(
    p.includes("Read me what it says") || p.includes("letter-reading is Intelligence"),
    'Rule 6 cites the letter-reading scenario as a skipped-roll example'
  );
  // Good-ending example showing NPC-directed task + roll prompt
  assert(
    p.includes("Halgrim") && p.includes('Intelligence check'),
    'Rule 6 GOOD ENDINGS includes Halgrim letter-reading with roll prompt'
  );
}

console.log('\n=== Rule 13 ROLL DISCIPLINE — chapter 1 surface format ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime({ chapter: 1 }));

  assert(
    p.includes('ROLLS ARE FREQUENT AND MUST BE WAITED ON'),
    'Rule 13 heading renamed (frequent + waited-on)'
  );
  assert(
    p.includes('THIS IS THE TUTORIAL'),
    'Rule 13 explicitly frames the prelude as a tutorial'
  );
  assert(
    p.includes('THE IRON RULE') && p.includes('MUST WAIT FOR THE RESULT BEFORE NARRATING'),
    'Rule 13 includes iron-rule language about waiting for result'
  );
  assert(
    p.includes('Chapter 1-2') && p.includes('offer-inside-action'),
    'Rule 13 mentions Ch 1-2 offer-inside-action mode'
  );
  assert(
    p.includes('Chapter 3-4') && p.includes('Surface the roll BARE'),
    'Rule 13 mentions Ch 3-4 bare mode'
  );
  // Chapter 1 runtime should surface "offer-inside-action" in the CURRENT CHAPTER footer
  assert(
    p.includes('Surface format: offer-inside-action'),
    'Ch 1 runtime surfaces offer-inside-action as current format'
  );
  // DC hidden reminder
  assert(
    p.includes('DC LIVES IN YOUR HEAD') && p.includes('NEVER ANNOUNCE IT TO THE PLAYER'),
    'Rule 13 keeps DC hidden'
  );
  // Crit framework
  assert(
    p.includes('Natural 1 = CRITICAL FAILURE') && p.includes('Natural 20 = CRITICAL SUCCESS'),
    'Rule 13 defines crit 1 and crit 20 framework'
  );
  assert(
    p.includes('funny or dramatic per tone') || p.includes('per tone'),
    'Rule 13 crits reference tone'
  );
}

console.log('\n=== Rule 13 ROLL DISCIPLINE — chapter 3 surface format ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 3, prelude_age: 14 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 3, age: 14 })
  );

  assert(
    p.includes('Surface format: bare'),
    'Ch 3 runtime surfaces bare as current format'
  );
  // Both teaching modes still described in the body of rule 13 for reference
  assert(
    p.includes('Ch 1-2') || p.includes('Chapter 1-2'),
    'Rule 13 body still describes Ch 1-2 mode (context for the AI)'
  );
}

console.log('\n=== Rule 15b EMERGENCE SHAPING ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    p.includes('15b. EMERGENCE SHAPES THE STORY'),
    'Rule 15b present'
  );
  assert(
    p.includes('EMERGENCE SO FAR block'),
    'Rule 15b references the emergence block by name'
  );
  assert(
    p.includes('lean upcoming scenes toward emerging strengths') ||
    p.includes('lean') && p.includes('emerging strengths'),
    'Rule 15b gives the core directive'
  );
  assert(
    p.includes('gentle lean') || p.includes("DON'T be heavy-handed"),
    'Rule 15b warns against heavy-handedness'
  );
  assert(
    p.includes("Don't announce") || p.includes("DM-side"),
    'Rule 15b clarifies DM-side (don\'t announce to player)'
  );
}

console.log('\n=== Emergence snapshot block injection ===\n');
{
  const block = `EMERGENCE SO FAR (what the character is becoming — lean upcoming scenes toward these strengths, don't force):
  Stats emerged:          STR +1, CON +1
  Skills emerged:         Perception
  Class trajectory:       ranger (leading, 3.5 pts)
  Theme trajectory:       outlander (leading, 2.0 pts)
  Ancestry-feat leaning:  undecided
  Top values so far:      loyalty (+3), curiosity (+2)`;

  const p = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime(),
    '',      // canon block empty
    block    // emergence block populated
  );

  assert(
    p.includes('Stats emerged:          STR +1, CON +1'),
    'emergence block stat line passed through'
  );
  assert(
    p.includes('Class trajectory:       ranger (leading'),
    'emergence block class trajectory passed through'
  );
  assert(
    p.includes('Top values so far:      loyalty'),
    'emergence block values passed through'
  );
}

console.log('\n=== Emergence snapshot block absent → placeholder ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime()
    // canon + emergence both default to ''
  );

  assert(
    p.includes('EMERGENCE SO FAR: none yet'),
    'default placeholder appears when no emergence block provided'
  );
  assert(
    p.includes('See rule 15b'),
    'placeholder cross-references rule 15b'
  );
}

console.log('\n=== FINAL REMINDER surfaces new rules (recency position) ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime({ chapter: 1 }));

  // Find the FINAL REMINDER section
  const idx = p.indexOf('FINAL REMINDER');
  assert(idx > 0, 'FINAL REMINDER block present');
  const tail = p.slice(idx);

  assert(
    tail.includes('END EVERY RESPONSE ON ENGAGEMENT'),
    'FINAL REMINDER surfaces momentum rule'
  );
  assert(
    tail.includes('CARVE-OUT') && tail.includes('skips the roll'),
    'FINAL REMINDER surfaces the NPC-directed-task carve-out'
  );
  assert(
    tail.includes('ROLLS ARE FREQUENT AND WAITED ON'),
    'FINAL REMINDER surfaces roll discipline'
  );
  assert(
    tail.includes('EMERGENCE SHAPING'),
    'FINAL REMINDER surfaces emergence shaping'
  );
  assert(
    tail.includes('Never announce the DC'),
    'FINAL REMINDER reiterates DC-hidden rule'
  );
  // Chapter-1 should select the offer-inside-action mode in the reminder
  assert(
    tail.includes('CH 1-2') && tail.includes('INSIDE the action'),
    'FINAL REMINDER reflects Ch 1-2 tutorial mode for age-7 character'
  );
}

console.log('\n=== FINAL REMINDER chapter-3 reminder flips to bare mode ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter({ prelude_chapter: 3, prelude_age: 14 }),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ chapter: 3, age: 14 })
  );
  const tail = p.slice(p.indexOf('FINAL REMINDER'));

  assert(
    tail.includes('CH 3-4') && tail.includes('BARE'),
    'FINAL REMINDER reflects Ch 3-4 bare mode for age-14 character'
  );
}

console.log('\n=== Opening prompt no longer mentions "concrete options" ===\n');
{
  const opening = createPreludeOpeningPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    !opening.includes('concrete options'),
    '"concrete options" removed from opening prompt'
  );
  assert(
    opening.includes('End on engagement'),
    'opening prompt now ends on "End on engagement" guidance'
  );
  assert(
    opening.includes('NEVER offer menus'),
    'opening prompt forbids action menus'
  );
}

console.log('\n=== v1.0.70 session-position injection ===\n');
{
  // Early in the session
  const early = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ exchangeCount: 3, progressFraction: 0.06 })
  );
  assert(
    early.includes('Session position: exchange 3 of ~50 target budget (6%'),
    'early session shows exchange 3 / 6%'
  );
  assert(
    early.includes('wrap ~65') && early.includes('force-close ~80'),
    'early session surfaces wrap + force thresholds'
  );

  // Mid-session
  const mid = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ exchangeCount: 32, progressFraction: 0.64 })
  );
  assert(
    mid.includes('Session position: exchange 32 of ~50 target budget (64%'),
    'mid-session shows exchange 32 / 64%'
  );
  assert(
    mid.includes('Begin foreshadowing a cliffhanger moment around exchange 40'),
    'prompt instructs AI to foreshadow near 80% of budget'
  );

  // Session opening — exchangeCount 0
  const open = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup(),
    makeArcPlan(),
    makeRuntime({ exchangeCount: 0, progressFraction: 0 })
  );
  assert(
    open.includes('exchange 0 of ~50 target budget (0%'),
    'opening shows exchange 0 / 0%'
  );
}

console.log('\n=== v1.0.70 expanded canon taxonomy (rule 15a) ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());

  assert(
    p.includes('EMIT GENEROUSLY'),
    'rule 15a calls for generous canon emission'
  );
  assert(
    p.includes('3-6 canon facts per session'),
    'rule 15a gives quantitative emission target'
  );
  // Taxonomy sections
  assert(
    p.includes('(a) NPC details'),
    'taxonomy section (a) NPC details present'
  );
  assert(
    p.includes('(b) Conversations and decisions'),
    'taxonomy section (b) conversations present'
  );
  assert(
    p.includes('(c) Character moments'),
    'taxonomy section (c) character moments present'
  );
  assert(
    p.includes('(d) World canon'),
    'taxonomy section (d) world canon present'
  );
  assert(
    p.includes('(e) Named objects'),
    'taxonomy section (e) named objects present'
  );
  // User's original taxonomy list
  assert(
    p.includes('Age, race, role') && p.includes('Personality markers, defining flaw'),
    'NPC section includes user\'s taxonomy (age/race/role/personality/flaw)'
  );
  assert(
    p.includes('Plans made') && p.includes('Plot shifts') && p.includes('Perception changes'),
    'conversation section includes plans/plot/perception'
  );
  assert(
    p.includes('Skills demonstrated') && p.includes('World lore the PC learned'),
    'character moments section includes skill reveals + lore'
  );
  // My additions
  assert(
    p.includes('Promises / vows / oaths / debts'),
    'canon section covers promises/vows/debts'
  );
  assert(
    p.includes('Lies told') && p.includes('Secrets kept'),
    'canon section covers lies and secrets'
  );
  assert(
    p.includes('Body / physical state changes') && p.includes('scars'),
    'canon section covers body / scars'
  );
  assert(
    p.includes('Rumors') || p.includes('Discoveries'),
    'canon section covers rumors / discoveries'
  );
  // 5-exchange nudge callout
  assert(
    p.includes('every 5 exchanges'),
    'rule 15a mentions the 5-exchange check-in nudge'
  );

  // FINAL REMINDER emphasizes generous emission
  const tail = p.slice(p.indexOf('FINAL REMINDER'));
  assert(
    tail.includes('GENEROUSLY') && tail.includes('3-6/session'),
    'FINAL REMINDER surfaces generous emission + quantitative target'
  );
  assert(
    tail.includes('Under-emission is the primary cause of drift'),
    'FINAL REMINDER cites under-emission as drift cause'
  );
}

console.log('\n=== v1.0.72 sibling nickname field ===\n');
{
  // Sibling with a nickname renders "Name (\"Nickname\")"
  const withNickname = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({
      siblings: [
        { name: 'Moira Astaron', nickname: 'Mo', gender: 'sister', relative_age: 'two years older' }
      ]
    }),
    makeArcPlan(),
    makeRuntime()
  );
  assert(
    withNickname.includes('Moira Astaron ("Mo")'),
    'sibling with nickname renders as Name ("Nickname")'
  );

  // Sibling without a nickname renders just the name (back-compat)
  const withoutNickname = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({
      siblings: [
        { name: 'Moss', gender: 'brother', relative_age: 'older' }
      ]
    }),
    makeArcPlan(),
    makeRuntime()
  );
  assert(
    withoutNickname.includes('• Moss (') && !withoutNickname.includes('Moss ("'),
    'sibling without nickname renders just the name'
  );

  // Nickname === empty string also falls back to name only
  const emptyNickname = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({
      siblings: [
        { name: 'Brenn', nickname: '', gender: 'brother', relative_age: 'younger' }
      ]
    }),
    makeArcPlan(),
    makeRuntime()
  );
  assert(
    !emptyNickname.includes('Brenn ("")'),
    'empty-string nickname does not render empty quotes'
  );
  assert(
    emptyNickname.includes('• Brenn ('),
    'empty-string nickname still renders the name'
  );
}

console.log('\n=== v1.0.73 tone presets — single-preset system replaces 16 tags ===\n');
{
  // Each of the 4 presets should inject a distinct TONE block
  const presets = [
    { value: 'brutal_gritty', label: 'BRUTAL & GRITTY', vocab: 'callused', scene: 'body-focused' },
    { value: 'epic_fantasy', label: 'EPIC FANTASY', vocab: 'storm-colored', scene: 'Weight and consequence' },
    { value: 'rustic_spiritual', label: 'RUSTIC & SPIRITUAL', vocab: 'feast day', scene: 'Pilgrimage-coded' },
    { value: 'tender_hopeful', label: 'TENDER & HOPEFUL', vocab: 'tucked', scene: 'Center of gravity' }
  ];

  for (const { value, label, vocab, scene } of presets) {
    const p = createPreludeSystemPrompt(
      makeCharacter(),
      makeSetup({ tone_tags: [value] }),
      makeArcPlan(),
      makeRuntime()
    );
    assert(p.includes(`TONE: ${label}`), `${value}: TONE block heading present`);
    assert(p.includes('REGISTER RULES'), `${value}: REGISTER RULES section present`);
    assert(p.includes('VOCABULARY ANCHORS'), `${value}: VOCABULARY ANCHORS section present`);
    assert(p.includes('SCENE-TYPE GUIDANCE'), `${value}: SCENE-TYPE GUIDANCE section present`);
    assert(p.includes('AGE-SCALING'), `${value}: AGE-SCALING section present`);
    assert(p.includes('EXEMPLAR PROSE'), `${value}: EXEMPLAR PROSE section present`);
    assert(p.includes(vocab), `${value}: preset-specific vocabulary anchor "${vocab}" present`);
    assert(p.includes(scene), `${value}: preset-specific scene guidance "${scene}" present`);
  }

  // Only ONE preset injects — not a catalog of all 4
  const brutalPrompt = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({ tone_tags: ['brutal_gritty'] }),
    makeArcPlan(),
    makeRuntime()
  );
  assert(
    brutalPrompt.includes('TONE: BRUTAL & GRITTY'),
    'brutal_gritty: correct block rendered'
  );
  assert(
    !brutalPrompt.includes('TONE: TENDER & HOPEFUL'),
    'brutal_gritty: unrelated preset NOT in prompt (no catalog pollution)'
  );
  assert(
    !brutalPrompt.includes('TONE: EPIC FANTASY'),
    'brutal_gritty: unrelated preset (epic) NOT in prompt'
  );
  // Old 16-tag Rule 14 catalog explicitly gone
  assert(
    !brutalPrompt.includes('**Quiet / melancholic**'),
    'v1.0.72 "16-tag" catalog no longer in prompt (quiet/melancholic absent)'
  );
  assert(
    !brutalPrompt.includes('**Bawdy**'),
    'v1.0.72 "16-tag" catalog no longer in prompt (bawdy absent)'
  );

  // Character block shows the preset label
  assert(
    brutalPrompt.includes('Tone preset: Brutal & Gritty'),
    'character block shows preset label'
  );
}

console.log('\n=== v1.0.73 age-scaling guidance per preset ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({ tone_tags: ['brutal_gritty'] }),
    makeArcPlan(),
    makeRuntime()
  );
  // All four age tiers present in the block
  assert(p.includes('Chapter 1 (early childhood)'), 'Ch1 tier present');
  assert(p.includes('Chapter 2 (middle childhood)'), 'Ch2 tier present');
  assert(p.includes('Chapter 3 (adolescence)'), 'Ch3 tier present');
  assert(p.includes('Chapter 4 (threshold)'), 'Ch4 tier present');
  // Brutal-specific scaling semantics
  assert(p.includes('PROXIMITY') && p.includes('OWNERSHIP'),
    'brutal age-scaling terms (PROXIMITY → OWNERSHIP) present');
}

console.log('\n=== v1.0.73 invalid preset → placeholder ===\n');
{
  const p = createPreludeSystemPrompt(
    makeCharacter(),
    makeSetup({ tone_tags: ['not_a_preset'] }),
    makeArcPlan(),
    makeRuntime()
  );
  assert(
    p.includes('TONE: (no preset selected'),
    'unknown preset falls back to placeholder'
  );
}

console.log('\n=== v1.0.76 per-chapter engagement mode block ===\n');
{
  // Ch1 — OBSERVE + character-shaping choices
  const p1 = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(),
    makeRuntime({ chapter: 1, age: 7 }));
  assert(p1.includes('MODE: OBSERVE'), 'Ch1 block says MODE: OBSERVE');
  assert(p1.includes('character-shaping choices'), 'Ch1 surfaces character-shaping-choices language');
  assert(p1.includes('Hide and listen, or run'), 'Ch1 includes hide-or-run example');
  assert(p1.includes('Obey the rule, or slip around it'), 'Ch1 includes obey-or-defy example');
  assert(p1.includes('NO COMBAT'), 'Ch1 explicitly forbids combat');
  assert(!p1.includes('MODE: LEARN'), 'Ch1 does NOT include Ch2 mode (no catalog pollution)');
  assert(!p1.includes('MODE: DECIDE'), 'Ch1 does NOT include Ch3 mode');
  assert(!p1.includes('MODE: COMMIT'), 'Ch1 does NOT include Ch4 mode');
  assert(p1.includes('first-crack'), 'Ch1 references first-crack chapter end');

  // Ch2 — LEARN + training combat
  const p2 = createPreludeSystemPrompt(makeCharacter({ prelude_chapter: 2, prelude_age: 10 }),
    makeSetup(), makeArcPlan(), makeRuntime({ chapter: 2, age: 10 }));
  assert(p2.includes('MODE: LEARN'), 'Ch2 block says MODE: LEARN');
  assert(p2.includes('TRAINING COMBAT') || p2.includes('training combat'),
    'Ch2 mentions training combat');
  assert(p2.includes('schoolyard') || p2.includes('wooden-sword'),
    'Ch2 references low-stakes combat examples');
  assert(p2.includes('Bruises, not scars'), 'Ch2 specifies low-stakes combat intensity');
  assert(p2.includes('first-rupture'), 'Ch2 references first-rupture chapter end');
  assert(!p2.includes('MODE: OBSERVE'), 'Ch2 does NOT include Ch1 mode');

  // Ch3 — DECIDE + real combat
  const p3 = createPreludeSystemPrompt(makeCharacter({ prelude_chapter: 3, prelude_age: 14 }),
    makeSetup(), makeArcPlan(), makeRuntime({ chapter: 3, age: 14 }));
  assert(p3.includes('MODE: DECIDE'), 'Ch3 block says MODE: DECIDE');
  assert(p3.includes('REAL COMBAT'), 'Ch3 mentions real combat');
  assert(p3.includes('Bodies matter'), 'Ch3 says bodies matter');
  assert(p3.includes('irreversible act'), 'Ch3 references irreversible-act chapter end');
  assert(p3.includes('TWO sessions'), 'Ch3 specifies 2-session target');

  // Ch4 — COMMIT + varied departure
  const p4 = createPreludeSystemPrompt(makeCharacter({ prelude_chapter: 4, prelude_age: 18 }),
    makeSetup(), makeArcPlan(), makeRuntime({ chapter: 4, age: 18 }));
  assert(p4.includes('MODE: COMMIT'), 'Ch4 block says MODE: COMMIT');
  assert(p4.toLowerCase().includes('varied') && p4.toLowerCase().includes('non-tragic'),
    'Ch4 emphasizes varied non-tragic departure');
  // Check for 4+ of the departure options
  const departureOptions = ['ENLISTMENT', 'APPRENTICESHIP', 'PILGRIMAGE', 'FINDING A CURE',
    'LEAVING TO LEARN', 'LEAVING TO EXPLORE', 'COMING-OF-AGE', 'POLITICAL MATCH',
    'CONSCRIPTION', 'EXILE', 'TRAGEDY'];
  const optionsFound = departureOptions.filter(opt => p4.includes(opt));
  assert(optionsFound.length >= 8, `Ch4 lists at least 8 departure options (found ${optionsFound.length})`);
  assert(p4.includes('NEVER default'), 'Ch4 says tragedy is NEVER the default');
  assert(p4.includes('[DEPARTURE:'), 'Ch4 references [DEPARTURE] marker');
  assert(p4.includes('[PRELUDE_END]'), 'Ch4 references [PRELUDE_END] marker');
}

console.log('\n=== v1.0.76 5-session structure references ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(),
    makeRuntime({ chapter: 1, sessionNumber: 1 }));
  assert(p.includes('5 focused sessions'),
    'prompt opening references 5-session structure');
  assert(p.includes('play-session 1 of 5'),
    'character block uses 5-session denominator');
  assert(p.includes('Chapter 1 (Early Childhood, OBSERVE):     1 session'),
    '11a lists Ch1 as 1 session');
  assert(p.includes('Chapter 3 (Adolescence, DECIDE):          2 sessions'),
    '11a lists Ch3 as 2 sessions');
  assert(!p.includes('7-10'),
    'prompt no longer references the old 7-10 session range');
}

console.log('\n=== v1.0.86 Rule 1a — PRESENT TENSE narration ===\n');
{
  const p = createPreludeSystemPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());
  assert(p.includes('1a. PRESENT TENSE'), 'Rule 1a heading present');
  assert(p.includes('Thesalian stands at the arrow-slit') || p.includes('you stand'),
    'Rule 1a gives a worked present-tense example');
  assert(p.includes('you stood'), 'Rule 1a includes the WRONG past-tense example for contrast');
  assert(
    p.includes('LIVING the scene, not remembering') || p.includes('inhabited experience'),
    'Rule 1a frames the "live vs memoir" distinction'
  );

  // FINAL REMINDER surfaces tense rule
  const tail = p.slice(p.indexOf('FINAL REMINDER'));
  assert(
    tail.includes('PRESENT TENSE') && tail.includes('1a'),
    'FINAL REMINDER surfaces present-tense rule'
  );
}

console.log('\n=== v1.0.86 opening prompt — canon emission directive ===\n');
{
  const opening = createPreludeOpeningPrompt(makeCharacter(), makeSetup(), makeArcPlan(), makeRuntime());
  assert(
    opening.includes('PRESENT TENSE'),
    'opening prompt mentions present tense requirement'
  );
  assert(
    opening.includes('MUST EMIT 8-15 [CANON_FACT]'),
    'opening prompt has the must-emit-8-15 banner'
  );
  assert(
    opening.includes('8-15'),
    'opening prompt specifies quantitative canon target'
  );
  assert(
    opening.includes('[CANON_FACT:'),
    'opening prompt provides worked CANON_FACT examples'
  );
  assert(
    opening.includes('Lore panel'),
    'opening prompt references the Lore panel as downstream consumer'
  );
  // The examples should cover NPCs, places, events, items, traits
  const examples = opening.slice(opening.indexOf('Worked examples'));
  assert(examples.includes('category=npc'), 'example for NPCs');
  assert(examples.includes('category=location'), 'example for locations');
  assert(examples.includes('category=event'), 'example for events');
  assert(examples.includes('category=item'), 'example for items');
  assert(examples.includes('category=trait'), 'example for traits');
}

console.log('\n==================================================');
console.log(`Prelude Prompt Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
