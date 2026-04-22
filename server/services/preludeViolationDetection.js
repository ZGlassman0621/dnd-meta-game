/**
 * Prelude violation detection — post-generation scan for Rule 2 breaches.
 *
 * Rule 2 (PLAYER AGENCY IS SACRED) is the most commonly violated rule
 * when the AI gets carried away in climactic moments. The LLM writes
 * dialogue or internal monologue for the player character — "'I don't
 * know,' you whisper." — and the player is left watching their PC act
 * without their input.
 *
 * This module pattern-matches the most common violation shape: quoted
 * text adjacent to "you [verb-of-speech-or-cognition]". It's a
 * conservative detector — it errs toward false negatives over false
 * positives so legitimate prose (NPC dialogue with "you" inside the
 * quote, cognitive expressions without quotes) isn't flagged.
 *
 * When a violation is detected:
 *   • The session service sets a `violation` field on the response the
 *     UI renders a warning badge.
 *   • A `[SYSTEM NOTE]` is injected into the next turn's prompt
 *     telling the AI specifically what it did wrong.
 *   • The violation is logged.
 *
 * NOT currently implemented: automatic retry. If rule-strengthening +
 * next-turn correction aren't enough, retry can be layered in.
 */

// Verbs of SPEECH — these, next to quoted text, signal dialogue attributed
// to the PC.
const SPEECH_VERBS = [
  'said', 'say', 'says', 'saying',
  'whispered', 'whisper', 'whispers', 'whispering',
  'answered', 'answer', 'answers', 'answering',
  'replied', 'reply', 'replies', 'replying',
  'murmured', 'murmur', 'murmurs', 'murmuring',
  'asked', 'ask', 'asks', 'asking',
  'told', 'tell', 'tells', 'telling',
  'responded', 'respond', 'responds', 'responding',
  'added', 'add', 'adds', 'adding',
  'breathed', 'breathe', 'breathes', 'breathing',
  'offered', 'offer', 'offers', 'offering',
  'began', 'begin', 'begins', 'beginning',
  'continued', 'continue', 'continues', 'continuing',
  'called', 'call', 'calls', 'calling',
  'spoke', 'speak', 'speaks', 'speaking',
  'muttered', 'mutter', 'mutters', 'muttering',
  'stammered', 'stammer', 'stammers', 'stammering',
  'blurted', 'blurt', 'blurts', 'blurting',
  'confessed', 'confess', 'confesses', 'confessing',
  'explained', 'explain', 'explains', 'explaining',
  'agreed', 'agree', 'agrees', 'agreeing',
  'insisted', 'insist', 'insists', 'insisting',
  'declared', 'declare', 'declares', 'declaring',
  'hissed', 'hiss', 'hisses', 'hissing',
  'sighed', 'sigh', 'sighs', 'sighing'
];

// Verbs of COGNITION — these, next to quoted text, signal the PC's
// internal monologue attributed to them.
const THOUGHT_VERBS = [
  'thought', 'think', 'thinks', 'thinking',
  'realized', 'realize', 'realizes', 'realizing',
  'wondered', 'wonder', 'wonders', 'wondering',
  'decided', 'decide', 'decides', 'deciding'
];

const ALL_VERBS = [...SPEECH_VERBS, ...THOUGHT_VERBS];
const VERB_GROUP = ALL_VERBS.join('|');

// Normalize curly quotes to straight quotes before matching — the AI
// sometimes emits them.
function normalizeQuotes(text) {
  return text
    .replace(/[“”]/g, '"')  // " "
    .replace(/[‘’]/g, "'"); //  ' '
}

/**
 * Pattern A — "quoted text," + optional adverb + "you [verb]".
 *
 *   "'Hello,' you whisper."
 *   "'I don't know,' you say, small."
 *   "'Someone removed an instruction,' you say. 'Something else.'"
 *
 * Uses [^"\n] to cap the quoted match so we don't straddle paragraph
 * boundaries. Cap of 800 chars prevents runaway matches on truly
 * pathological inputs.
 */
const PATTERN_A = new RegExp(
  `"[^"\\n]{2,800}"\\s*[,.\\-—]?\\s*\\byou\\s+(?:\\w+\\s+)?(?:${VERB_GROUP})\\b`,
  'gi'
);

/**
 * Pattern B — "you [verb]" + optional attribution phrase + "quoted text".
 *
 *   "You whisper, 'I'm scared.'"
 *   "You tell him, 'Get out.'"
 *   "You answer in a voice smaller than you meant: 'yes.'"
 *   "You think, 'he's lying.'"
 *
 * The gap between the verb and the quote is up to 120 chars so phrases
 * like "in a voice smaller than you meant:" can intercede, BUT the gap
 * is tempered — if it contains ANOTHER speaker verb, the match is
 * rejected. That way "you say nothing as she whispers 'hello' to the
 * door" (where 'hello' is attributed to "she," not to the PC) does not
 * false-positive.
 */
const PATTERN_B = new RegExp(
  `\\byou\\s+(?:\\w+\\s+){0,3}(?:${VERB_GROUP})\\b(?:(?!\\b(?:${VERB_GROUP})\\b)[^"\\n]){0,120}"[^"\\n]{2,800}"`,
  'gi'
);

/**
 * Run detection on a rendered response. Returns an object describing
 * any violations found — empty array if clean.
 *
 * @param {string} response — the AI's rendered response (already stripped
 *                             of markers, though the detector works on
 *                             raw text too since markers don't use quotes).
 * @returns {{ violated: boolean, matches: Array<{ pattern: string, snippet: string }> }}
 */
export function detectPlayerDialogueViolation(response) {
  if (!response || typeof response !== 'string') {
    return { violated: false, matches: [] };
  }
  const normalized = normalizeQuotes(response);
  const matches = [];

  let m;
  PATTERN_A.lastIndex = 0;
  while ((m = PATTERN_A.exec(normalized)) !== null) {
    matches.push({
      pattern: 'quote-then-verb',
      snippet: m[0].slice(0, 240) + (m[0].length > 240 ? '…' : '')
    });
  }
  PATTERN_B.lastIndex = 0;
  while ((m = PATTERN_B.exec(normalized)) !== null) {
    matches.push({
      pattern: 'verb-then-quote',
      snippet: m[0].slice(0, 240) + (m[0].length > 240 ? '…' : '')
    });
  }

  return {
    violated: matches.length > 0,
    matches
  };
}

/**
 * Build the [SYSTEM NOTE] injected into the NEXT turn's prompt after a
 * violation. Names the specific pattern the AI fired so it knows what
 * not to repeat. The snippet is truncated to stay compact.
 */
export function buildViolationCorrectionNote(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return null;
  const bullets = matches.slice(0, 3).map(m => `  • "${m.snippet}"`).join('\n');
  return `[SYSTEM NOTE] Your previous response violated RULE 2 (player agency). You wrote dialogue or internal monologue attributed to the player character. Specifically:\n${bullets}\n\nAcknowledge briefly ("Apologies — I put words in your mouth there; please disregard that passage.") and from this turn forward, STRICTLY end scenes at the point where the player would speak. Run the mandatory self-check at the end of every response. This is an absolute rule.`;
}
