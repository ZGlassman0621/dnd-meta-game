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

// v1.0.75 — PC state/preference attribution verbs. These are Rule 2
// violations even WITHOUT quoted text: "You like the stag." "You
// remember the day." "You decide to stay." "You know he's lying."
// The AI is attributing preferences / decisions / knowledge /
// memory to the PC — the player's domain, not the AI's.
//
// Carefully curated to avoid false positives on legitimate narration:
//   - Sensory ("you see," "you hear," "you feel the cold stone") is OK.
//     Physical sensation is environment per Rule 2 exception.
//   - Movement ("you walk," "you turn") is OK — describing the PC's
//     body in service of the player's stated action, usually. (Edge
//     cases like "you turn and leave" are arguably violations but
//     produce too many false positives to catch cleanly.)
//   - PREFERENCES (like/love/hate/prefer/dislike/enjoy/want) are
//     ALWAYS violations.
//   - COGNITION (think/know/remember/decide/realize/understand/
//     wonder/doubt/believe/suspect/recognize/recall) is almost always
//     violation — the AI is declaring the PC's internal state.
const STATE_ATTRIBUTION_VERBS = [
  // Preferences / opinions / emotions
  'like', 'likes', 'liked',
  'love', 'loves', 'loved',
  'hate', 'hates', 'hated',
  'prefer', 'prefers', 'preferred',
  'dislike', 'dislikes', 'disliked',
  'enjoy', 'enjoys', 'enjoyed',
  'adore', 'adores', 'adored',
  'detest', 'detests', 'detested',
  'want', 'wants', 'wanted',
  'fancy', 'fancied',

  // Cognition / knowledge / memory / decision (without requiring a quote)
  'think', 'thinks', 'thought',
  'know', 'knows', 'knew',
  'remember', 'remembers', 'remembered',
  'decide', 'decides', 'decided',
  'choose', 'chooses', 'chose',
  'realize', 'realizes', 'realized',
  'understand', 'understands', 'understood',
  'wonder', 'wonders', 'wondered',
  'doubt', 'doubts', 'doubted',
  'believe', 'believes', 'believed',
  'suspect', 'suspects', 'suspected',
  'recognize', 'recognizes', 'recognized',
  'recall', 'recalls', 'recalled'
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
 * Returns true if the character at `index` in `text` sits inside an
 * unclosed double-quoted span. Used to reject violation matches that
 * START inside NPC dialogue — where "you [verb]" is the NPC addressing
 * the PC in second person, NOT the AI attributing speech to the PC.
 *
 * Counts straight `"` characters before `index`. Odd count ⇒ inside a
 * quote. This is a simple, stateless pass; it doesn't understand
 * escaped quotes (rare in narrative prose) or markdown/HTML quote
 * substitutes. Good enough for the patterns Sonnet/Opus actually emit.
 *
 * Example of the false-positive this prevents:
 *   `"You will not speak of this. Not to Moira — " he said, "— who ..."`
 *   Pattern B would otherwise match "You will ... speak" (inside Q1)
 *   + gap across narration + opening `"` of Q2 as a fake PC-quote
 *   attribution. Since "You" is inside Q1 (odd count of `"` before it),
 *   we reject.
 */
function isInsideQuote(text, index) {
  let count = 0;
  for (let i = 0; i < index; i++) {
    if (text.charCodeAt(i) === 34 /* " */) count++;
  }
  return (count & 1) === 1;
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
 * Pattern C (v1.0.75) — state attribution WITHOUT quoted text.
 *
 *   "You like the stag."              ← preference attribution
 *   "You remember the day she left."  ← memory attribution
 *   "You decide to stay."             ← choice attribution
 *   "You know he's lying."            ← knowledge attribution
 *   "You think Moss is hiding something." ← internal monologue
 *
 * The pattern matches "you [optional adverb] STATE_VERB" when the verb
 * is followed by something object-like (not a question mark, not a
 * simple sentence-ending period, not a hand-off to the player). The
 * test: is there a content word after the verb? If yes, the AI is
 * asserting something about the PC's internal state.
 *
 * False-positive guards:
 *   - Quoted-interior position is rejected (isInsideQuote).
 *   - A question mark within the next ~50 chars suggests a prompt to
 *     the player ("What do you think?") — don't flag.
 *   - The verb followed immediately by a period/newline ("You decide.")
 *     is a directive/prompt — don't flag.
 */
const STATE_VERB_GROUP = STATE_ATTRIBUTION_VERBS.join('|');
const PATTERN_C = new RegExp(
  `\\byou\\s+(?:\\w+\\s+){0,2}(?:${STATE_VERB_GROUP})\\b\\s+(?![\\?\\n]|$)(?:(?!\\.\\s|\\?)[^\\n]){2,120}`,
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
    // Pattern A matches a quote THEN "you [verb]". The quote itself is
    // consumed in the match, so the match starts at the opening `"`. If
    // that opening `"` has an odd number of `"` chars before it, we're
    // starting inside an outer quote — e.g. nested or split dialogue —
    // and the "you [verb]" that follows is likely an NPC's second-person
    // address continuing inside the same quoted span. Reject.
    if (isInsideQuote(normalized, m.index)) continue;
    matches.push({
      pattern: 'quote-then-verb',
      snippet: m[0].slice(0, 240) + (m[0].length > 240 ? '…' : '')
    });
  }
  PATTERN_B.lastIndex = 0;
  while ((m = PATTERN_B.exec(normalized)) !== null) {
    // Pattern B starts at "you [verb]". If that "you" sits inside a
    // quoted span, it's NPC dialogue addressing the PC in second person,
    // not AI-written PC attribution. Common case: split NPC dialogue
    // like `"You will not speak. — " he said, " — to anyone."` where
    // the regex would otherwise bridge the two quote halves.
    if (isInsideQuote(normalized, m.index)) continue;
    matches.push({
      pattern: 'verb-then-quote',
      snippet: m[0].slice(0, 240) + (m[0].length > 240 ? '…' : '')
    });
  }

  // v1.0.75 — Pattern C: state attribution without quotes.
  PATTERN_C.lastIndex = 0;
  while ((m = PATTERN_C.exec(normalized)) !== null) {
    // Same inside-quote guard as patterns A/B — NPC dialogue that uses
    // "you [state verb]" to address the PC in-character is not a
    // violation ("she says: 'You know what this means.'").
    if (isInsideQuote(normalized, m.index)) continue;

    // Interrogative guard — if the enclosing sentence ends in a '?', this
    // is the AI asking the player something ("Do you remember what Halda
    // said?"), not attributing state. Look forward from the match to the
    // next sentence-terminator; skip if it's a question mark.
    const afterMatch = normalized.slice(m.index);
    const terminatorMatch = afterMatch.match(/[.!?]/);
    if (terminatorMatch && terminatorMatch[0] === '?') continue;

    // Sensory / established-knowledge whitelist (v1.0.92).
    // Patterns like "merchants you know by face" or "the road you know
    // from countless walks" are NOT novel state attribution — they're
    // referencing knowledge the character would obviously have given
    // their setup (merchant family, lifelong resident, etc.). The verb
    // "know" / "remember" / "recognize" / "recall" with a sensory or
    // long-association prepositional phrase is the player's biographical
    // context being made visible, not the AI inventing inner state.
    //
    // Whitelist trigger: the matched span starts with "you (know|knew|
    // knows|remember|...|recognize|...)" followed (within 3 intervening
    // words) by the prepositions "by|from|as". These flag established
    // sensory or biographical knowledge the character would obviously
    // have given their setup — not novel state attribution by the AI.
    //
    // We DELIBERATELY do not whitelist "to" (e.g. "you remember to take
    // the keys" attributes directive intent and IS still a violation).
    const matched = m[0].toLowerCase();
    const whitelistRe = new RegExp(
      `^you\\s+(?:know|knew|knows|remember|remembers|remembered|recognize|recognizes|recognized|recall|recalls|recalled)\\s+(?:[a-z']+\\s+){0,3}(?:by|from|as)\\b`,
      'i'
    );
    if (whitelistRe.test(matched)) continue;

    matches.push({
      pattern: 'state-attribution',
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
