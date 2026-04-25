/**
 * Prelude violation detection tests (v1.0.67).
 *
 * Rule 2 (PLAYER AGENCY IS SACRED) is the most commonly violated rule
 * when the AI gets carried away in climactic moments. The detector
 * pattern-matches the two common violation shapes:
 *   Pattern A — "quoted," you [verb]
 *   Pattern B — you [verb,] "quoted"
 *
 * Tests cover:
 *   • True positives: the exact transcript the user flagged + canonical
 *     variations (different verbs, different quote positions, tense)
 *   • True positives: internal-monologue variants (thought/realize/wonder)
 *   • True negatives: NPC dialogue (quote + non-"you" subject)
 *   • True negatives: legitimate "you" prose (see/feel/hear/walk)
 *   • Edge cases: curly quotes normalized; empty/null inputs; long text
 */

import {
  detectPlayerDialogueViolation,
  buildViolationCorrectionNote
} from '../server/services/preludeViolationDetection.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

// ---------------------------------------------------------------------------

console.log('\n=== True positives — the user\'s exact transcript + variants ===\n');
{
  // Exact transcript from the 2026-04-22 play-test report
  const userExample = `"Someone removed an instruction," you say. "Something Father told you to do. Or—" and here your voice is smaller because this is the part that feels too large for you — "something about someone here. And whoever carried the letter didn't want you to have it."`;
  const r1 = detectPlayerDialogueViolation(userExample);
  assert(r1.violated, 'flags the user-reported transcript');
  assert(r1.matches.length >= 1, 'has at least one match');

  // Canonical Pattern A variants
  assert(detectPlayerDialogueViolation(`"Hello," you say.`).violated, 'quote-then-"you say"');
  assert(detectPlayerDialogueViolation(`"I don't know," you whisper.`).violated, 'quote-then-"you whisper"');
  assert(detectPlayerDialogueViolation(`"No," you breathe. "Not him."`).violated, 'quote-then-"you breathe"');
  assert(detectPlayerDialogueViolation(`"Yes," you answer.`).violated, 'quote-then-"you answer"');
  assert(detectPlayerDialogueViolation(`"Father…" you begin, and cannot finish.`).violated, 'quote-then-"you begin"');
  assert(detectPlayerDialogueViolation(`"Stay," you tell him.`).violated, 'quote-then-"you tell"');

  // Adverb between "you" and verb
  assert(
    detectPlayerDialogueViolation(`"I did it," you finally say.`).violated,
    'handles adverb between "you" and verb'
  );
  assert(
    detectPlayerDialogueViolation(`"Don't," you softly whisper.`).violated,
    'handles adverb + whisper'
  );

  // Past tense
  assert(detectPlayerDialogueViolation(`"Yes," you said.`).violated, 'past tense "you said"');
  assert(detectPlayerDialogueViolation(`"Fine," you replied.`).violated, 'past tense "you replied"');
}

console.log('\n=== True positives — Pattern B (verb before quote) ===\n');
{
  assert(
    detectPlayerDialogueViolation(`You whisper, "I'm scared."`).violated,
    '"you whisper," quote'
  );
  assert(
    detectPlayerDialogueViolation(`You say, "Hello."`).violated,
    '"you say," quote'
  );
  assert(
    detectPlayerDialogueViolation(`You answer in a voice smaller than you meant: "yes."`).violated,
    '"you answer in X voice:" quote'
  );
  assert(
    detectPlayerDialogueViolation(`You tell him, "Get out."`).violated,
    '"you tell him," quote'
  );
}

console.log('\n=== True positives — internal monologue attributed to PC ===\n');
{
  assert(
    detectPlayerDialogueViolation(`"He's lying," you think.`).violated,
    'quote + "you think" (internal monologue)'
  );
  assert(
    detectPlayerDialogueViolation(`You realize, "this is the trap."`).violated,
    '"you realize," quote'
  );
  assert(
    detectPlayerDialogueViolation(`"I can't do this," you wonder.`).violated,
    'quote + "you wonder"'
  );
  assert(
    detectPlayerDialogueViolation(`You decide, "no, not yet."`).violated,
    '"you decide," quote'
  );
}

console.log('\n=== True negatives — legitimate prose (must NOT flag) ===\n');
{
  // NPC dialogue with someone else speaking
  const npc1 = detectPlayerDialogueViolation(`"Hello," Moss said.`);
  assert(!npc1.violated, 'NPC "said" not flagged (not "you")');

  const npc2 = detectPlayerDialogueViolation(`"Come here," she whispers.`);
  assert(!npc2.violated, 'NPC "whispers" not flagged');

  const npc3 = detectPlayerDialogueViolation(`Moss says, "You coming?"`);
  assert(!npc3.violated, 'NPC "says," quote — quote contains "you" but subject is Moss');

  const npc4 = detectPlayerDialogueViolation(`"What do you think?" Halda asks.`);
  assert(!npc4.violated, 'NPC question with "you" INSIDE the quote');

  const npc5 = detectPlayerDialogueViolation(`"You're late," he says to you.`);
  assert(!npc5.violated, 'NPC says-to-you not flagged (subject is "he")');

  // Legitimate second-person narration without dialogue attribution
  const prose1 = detectPlayerDialogueViolation(`You see the ledger on the table.`);
  assert(!prose1.violated, 'bare "you see" not flagged');

  const prose2 = detectPlayerDialogueViolation(`You feel the cold stone under your feet.`);
  assert(!prose2.violated, 'bare "you feel" not flagged');

  const prose3 = detectPlayerDialogueViolation(`The door opens. You hear footsteps.`);
  assert(!prose3.violated, 'bare "you hear" not flagged');

  const prose4 = detectPlayerDialogueViolation(`You walk to the window. Outside, the yard is quiet.`);
  assert(!prose4.violated, 'bare "you walk" not flagged');

  // "you" in narration with quoted text later but no attribution
  const prose5 = detectPlayerDialogueViolation(`You watch her lips move. "Be careful," she tells the room.`);
  assert(!prose5.violated, 'prose with unrelated quoted NPC dialogue not flagged');

  // Quote of something the PC reads or sees — not their own speech
  const read1 = detectPlayerDialogueViolation(`The letter begins: "Dear Son."`);
  assert(!read1.violated, 'text being read not flagged (no "you" verb attribution)');

  // Tempered-quantifier edge case: another speaker verb intervenes,
  // attribution clearly belongs to a different subject
  const twoSpeakers = detectPlayerDialogueViolation(
    `You say nothing as she whispers "hello" to the door.`
  );
  assert(!twoSpeakers.violated, 'second verb blocks pattern B (attribution goes to "she," not PC)');
}

console.log('\n=== v1.0.68 false-positive guard — "you [verb]" INSIDE NPC dialogue ===\n');
{
  // Exact play-test false positive (Halgrim speaking, mid-sentence break).
  // "You will not speak ... Moira — " he said, " — who has forgotten ..."
  // Pattern B would match "You will not speak ... Moira — " + narration
  // + opening of next quote, but the "You" is inside the NPC's Q1.
  const splitDialogue = detectPlayerDialogueViolation(
    `"You will not speak of this. Not to Moss. Not to Master Coren. Not to Sister Vara. Not to Moira — " he does not look at Moira, but Moira does not look up either, "— who has already forgotten what she heard. Do you understand me?"`
  );
  assert(!splitDialogue.violated, 'NPC split dialogue with second-person address does NOT flag');

  // Simpler split dialogue
  const simpleSplit = detectPlayerDialogueViolation(
    `"You must understand," he said, "what this means for the family."`
  );
  assert(!simpleSplit.violated, 'simple NPC split dialogue does not flag');

  // NPC gives the PC a command ("you shall tell" inside NPC quote)
  const npcCommand = detectPlayerDialogueViolation(
    `"You shall tell no one of this," she said firmly.`
  );
  assert(!npcCommand.violated, 'NPC command containing "you [verb]" does not flag');

  // Sanity: the violation must still fire OUTSIDE the quote
  const violationOutside = detectPlayerDialogueViolation(
    `"I won't tell anyone," she said. You whisper, "I promise."`
  );
  assert(violationOutside.violated, 'real violation after NPC dialogue still flags');
  assert(
    violationOutside.matches[0].snippet.includes('you') || violationOutside.matches[0].snippet.includes('You'),
    'snippet shows the "You whisper" attribution'
  );

  // PC violation inside their OWN internal-monologue quote is still a violation,
  // since the quote itself is attributed to the PC by the "you think" wrapper
  const innerThought = detectPlayerDialogueViolation(
    `You think, "he's lying." That's the conclusion.`
  );
  assert(innerThought.violated, 'internal-monologue violation still flags ("you think" outside quote)');

  // Empty / null inputs
  assert(!detectPlayerDialogueViolation('').violated, 'empty string → not flagged');
  assert(!detectPlayerDialogueViolation(null).violated, 'null → not flagged');
  assert(!detectPlayerDialogueViolation(undefined).violated, 'undefined → not flagged');
}

console.log('\n=== Curly quote normalization ===\n');
{
  const curly = detectPlayerDialogueViolation(`“Hello,” you say.`);
  assert(curly.violated, 'curly double quotes → normalized and detected');
}

console.log('\n=== Snippet truncation ===\n');
{
  const huge = `"${'a'.repeat(500)}," you say.`;
  const r = detectPlayerDialogueViolation(huge);
  assert(r.violated, 'long quoted text still flagged');
  assert(r.matches[0].snippet.length <= 241, 'snippet truncated to 240 chars + ellipsis');
  assert(r.matches[0].snippet.endsWith('…'), 'truncation adds ellipsis');
}

console.log('\n=== buildViolationCorrectionNote ===\n');
{
  const note1 = buildViolationCorrectionNote([
    { pattern: 'quote-then-verb', snippet: `"Yes," you say.` }
  ]);
  assert(note1.includes('[SYSTEM NOTE]'), 'note starts with [SYSTEM NOTE]');
  assert(note1.includes('RULE 2'), 'note cites rule 2');
  assert(note1.includes('"Yes," you say.') || note1.includes('Yes,'), 'note includes the snippet');

  const note0 = buildViolationCorrectionNote([]);
  assert(note0 === null, 'empty matches → null note');

  // Multiple matches — note should include up to 3
  const many = Array.from({ length: 5 }, (_, i) => ({
    pattern: 'quote-then-verb',
    snippet: `"match-${i}," you say.`
  }));
  const noteMany = buildViolationCorrectionNote(many);
  assert(noteMany.includes('match-0'), 'first match in note');
  assert(noteMany.includes('match-2'), 'third match in note');
  assert(!noteMany.includes('match-4'), 'fourth+ match truncated');
}

console.log('\n=== v1.0.75 Pattern C — state attribution without quotes ===\n');
{
  // Exact user-reported transcript from playtest #1 with tone presets
  const stagExample = `You like the stag. The stag is looking back over its shoulder at something the weaver did not put in the picture.`;
  const r = detectPlayerDialogueViolation(stagExample);
  assert(r.violated, 'flags "You like the stag" — preference attribution');
  assert(r.matches.some(m => m.pattern === 'state-attribution'), 'match is tagged state-attribution');

  // Preference verbs
  assert(detectPlayerDialogueViolation('You love your brother more than anyone.').violated, 'you love X');
  assert(detectPlayerDialogueViolation('You hate when Vost speaks that way.').violated, 'you hate X');
  assert(detectPlayerDialogueViolation('You prefer the quiet of the gallery.').violated, 'you prefer X');
  assert(detectPlayerDialogueViolation('You want him to stop.').violated, 'you want X');

  // Cognition verbs
  assert(detectPlayerDialogueViolation('You remember the day she left.').violated, 'you remember X');
  assert(detectPlayerDialogueViolation('You know he is lying.').violated, 'you know X');
  assert(detectPlayerDialogueViolation('You decide to stay.').violated, 'you decide X');
  assert(detectPlayerDialogueViolation('You realize what Halgrim was saying.').violated, 'you realize X');
  assert(detectPlayerDialogueViolation('You believe her now.').violated, 'you believe X');
  assert(detectPlayerDialogueViolation('You recognize the pattern on the cloak.').violated, 'you recognize X');

  // Adverb between "you" and verb
  assert(detectPlayerDialogueViolation('You quietly decide to follow him.').violated, 'handles adverb + verb');
}

console.log('\n=== v1.0.75 Pattern C — legitimate prose NOT flagged ===\n');
{
  // Sensory/physical (allowed per Rule 2 exception)
  assert(!detectPlayerDialogueViolation('You see the tapestries on the north wall.').violated,
    'you see X not flagged (perception)');
  assert(!detectPlayerDialogueViolation('You feel the cold stone under your feet.').violated,
    'you feel X not flagged (physical sensation)');
  assert(!detectPlayerDialogueViolation('You hear footsteps on the stair.').violated,
    'you hear X not flagged');

  // Movement / physical body (describing PC body in service of player action)
  assert(!detectPlayerDialogueViolation('You walk to the window.').violated,
    'you walk X not flagged');
  assert(!detectPlayerDialogueViolation('You turn toward the door.').violated,
    'you turn X not flagged');

  // Question prompt (AI asking the player)
  assert(!detectPlayerDialogueViolation('What do you think?').violated,
    'question "what do you think?" not flagged');
  assert(!detectPlayerDialogueViolation("Do you remember what Halda said?").violated,
    'question "do you remember?" not flagged');

  // Verb followed by period/break (directive to player, not assertion)
  assert(!detectPlayerDialogueViolation('You decide.').violated,
    'bare "you decide." not flagged (directive)');
  assert(!detectPlayerDialogueViolation('You choose.').violated,
    'bare "you choose." not flagged (directive)');

  // NPC dialogue containing "you [verb]" — inside-quote guard
  assert(!detectPlayerDialogueViolation('"You know what this means," she says.').violated,
    'NPC dialogue with "you know" inside quote not flagged');
  assert(!detectPlayerDialogueViolation('"You remember her," Halgrim says quietly.').violated,
    'NPC dialogue with "you remember" inside quote not flagged');
}

console.log('\n=== v1.0.92 sensory / established-knowledge whitelist ===\n');
{
  // Patterns the player legitimately runs into that should NOT flag.
  // Real playtest false-positive (v1.0.91):
  const playtestText = 'Your eyes move down. There are merchants here you know by face and merchants you know only as a sound at the door, and the names run together in the candle-light: Ferin, Aldric, Busse, Tovar.';
  assert(!detectPlayerDialogueViolation(playtestText).violated,
    'playtest case: "merchants you know by face" not flagged');

  // Whitelisted "by | from | as" + sensory/biographical context
  const cleanCases = [
    'merchants you know by face',
    'the road you know from countless walks',
    'names you remember from childhood',
    'the song you know by heart',
    'the smell you know from the kitchen',
    'a face you recognize from years ago',
    'the taste you remember from her bread',
    'someone you know as a friend of the family'
  ];
  for (const text of cleanCases) {
    const wrapped = 'She watches you. ' + text + ' is no help here.';
    assert(!detectPlayerDialogueViolation(wrapped).violated,
      `"${text}" not flagged (sensory whitelist)`);
  }

  // Real violations that must STILL fire — whitelist doesn't cover these
  const stillFlagged = [
    ['You know she is lying about the coin.',         'novel inference (no by/from/as)'],
    ['You decide to go with him.',                    'novel decision'],
    ['You remember the day your mother left.',        'novel memory (no by/from/as)'],
    ['You think Halgrim is hiding something.',        'novel thought'],
    ['You realize the letter was never meant for you.','novel realization'],
    ['You remember to take the keys.',                'directive intent (to NOT whitelisted)']
  ];
  for (const [text, why] of stillFlagged) {
    const wrapped = 'She watches you. ' + text + ' Then she speaks.';
    assert(detectPlayerDialogueViolation(wrapped).violated,
      `"${text}" still flagged (${why})`);
  }
}

console.log('\n==================================================');
console.log(`Prelude Violation Detection Tests: ${passed} passed, ${failed} failed`);
console.log('==================================================\n');

if (failed > 0) process.exit(1);
