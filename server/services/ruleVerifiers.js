/**
 * Code-verifiers for DM cardinal rules.
 *
 * Rationale: the DM system prompt is mostly natural-language — it asks the
 * AI to self-police dozens of rules on every turn. The rules that can be
 * mechanically verified SHOULD be, because (a) verification is deterministic
 * where prompt-discipline is probabilistic, and (b) a failing verifier can
 * surface invisible correction feedback just like the marker schema system
 * does (see `markerSchemas.js::validateDmMarkers`).
 *
 * Current verifiers:
 *   • `verifyHardStops(text)` — CARDINAL RULE 2: "When an NPC asks a direct
 *     question OR you call for a dice roll, that's the LAST sentence." If
 *     the AI continues past a roll request or question, flag it.
 *   • `verifyMetaCommentary(text)` — CARDINAL RULE 4: STAY IN THE WORLD.
 *     Catches "(Note:", "(This establishes", "you succeed on your check",
 *     "you fail the save" — narrative leaks.
 *
 * Pattern: each verifier returns { ok: true } or { ok: false, violations: [...] }.
 * `verifyDmResponse(text)` runs all verifiers and returns a consolidated
 * result that the session route can stash on session_config for next-turn
 * correction feedback.
 *
 * Rule 2 (PLAYER SOVEREIGNTY — "don't speak for the player") has its own
 * dedicated detector in `preludeViolationDetector.js` (and the prelude has
 * its own retry loop). A parallel DM-mode detector is a valid future
 * extension but lives outside this file.
 */

/**
 * Detect "continued past a hard stop" — a ROLL REQUEST or NPC QUESTION
 * that wasn't the final sentence of the response.
 *
 * Patterns that signal a hard stop:
 *   • "Make a/an <Skill> check" / "Make a <Skill> save" / "Make an initiative roll"
 *   • "Roll <dice>" / "Roll your <weapon/skill>"
 *   • Any sentence ending in "?" followed by prose that ISN'T an action tag
 *
 * An action tag ("Corvin glances at the alley" following a question) is
 * allowed per rule 2 — up to one short beat after the question. So we
 * only flag questions where the response runs on beyond ~40 more words,
 * or where another NPC speech/roll call follows the question.
 */
export function verifyHardStops(text) {
  if (!text || typeof text !== 'string') return { ok: true, violations: [] };
  const violations = [];

  // Strip markers before analysis — a trailing marker like [COMBAT_END] is
  // not prose and shouldn't count as content after a hard stop.
  const cleaned = text
    .replace(/\[[A-Z][A-Z_]+(?::[^\]]*)?\]/g, '')
    .trim();

  // Roll request patterns. Case-insensitive. We look for the pattern, and
  // then check if there's substantive prose AFTER it within the response.
  // Skill/tool names can be multi-word and include apostrophes ("Thieves' Tools",
  // "Sleight of Hand", "Animal Handling"). Match up to 3 capitalized words
  // before the trigger noun.
  const rollPatterns = [
    /\b(?:make (?:an?|your)(?:\s+[A-Z][A-Za-z'']+){0,3}\s+(?:check|save|roll|saving throw))/i,
    /\bmake an initiative roll\b/i,
    /\broll (?:your |for )?(?:[a-z]+ )?damage\b/i,
    /\broll (?:[a-z]+ )?(?:initiative|stealth|perception|persuasion|deception|insight|investigation|athletics|acrobatics|arcana|nature|history|religion|medicine|survival|animal handling|intimidation|performance|sleight of hand|thieves['' ]tools)/i,
    /\broll \d*d\d+\b/i,       // "Roll 1d20", "Roll a d20", etc.
    /\broll your attack\b/i,
    /\bmake an attack roll\b/i
  ];

  for (const pattern of rollPatterns) {
    const match = pattern.exec(cleaned);
    if (!match) continue;
    const afterIdx = match.index + match[0].length;
    const trailing = cleaned.slice(afterIdx).trim();
    // Strip trailing period / question mark before measuring — the roll
    // itself punctuates.
    const trailingProse = trailing.replace(/^[.!?—\s]+/, '').trim();
    if (trailingProse.length > 0) {
      // Allow extremely short trailing fragments (e.g. a period or "Good luck.")
      // but flag anything more substantial.
      const wordCount = trailingProse.split(/\s+/).length;
      if (wordCount > 4) {
        violations.push({
          rule: 'hard_stop_after_roll',
          trigger: match[0],
          trailing: trailingProse.slice(0, 120) + (trailingProse.length > 120 ? '…' : ''),
          trailingWords: wordCount
        });
      }
    }
  }

  return violations.length === 0
    ? { ok: true, violations: [] }
    : { ok: false, violations };
}

/**
 * Detect narrative-breaking meta-commentary. CARDINAL RULE 4: STAY IN THE WORLD.
 *
 * Red flags:
 *   • "(Note: …)" / "(This establishes …)" / "(This scene sets up …)"
 *   • "you succeed on your check" / "you fail the save" / "your X check succeeds"
 *   • "roll of <N>" narrated into prose ("a 19 succeeds")
 *   • bracketed DM asides like "[The scene is tense]" that aren't system markers
 */
export function verifyMetaCommentary(text) {
  if (!text || typeof text !== 'string') return { ok: true, violations: [] };
  const violations = [];

  // Strip real system markers first (they use ALL_CAPS tokens + : or nothing)
  // so we don't false-positive on [COMBAT_START], [LOOT_DROP], etc.
  const cleaned = text.replace(/\[[A-Z][A-Z_]+(?::[^\]]*)?\]/g, '');

  const patterns = [
    {
      rule: 'meta_parenthetical',
      pattern: /\((?:Note|This establishes|This (?:scene )?(?:sets up|foreshadows)|Setting up|Preparing for)[^)]{3,}\)/i,
      description: 'parenthetical DM commentary'
    },
    {
      rule: 'narrated_check_result',
      pattern: /\byou (?:succeed on|fail) your (?:[A-Z][a-z]+ )?(?:check|save|saving throw)\b/i,
      description: 'narrating the result of a check'
    },
    {
      rule: 'narrated_roll_outcome',
      pattern: /\bwith (?:a |your )?(?:roll of |result of )?(?:\d+|a [\w-]+)[,.]?\s+you (?:succeed|fail|manage)/i,
      description: 'narrating a player-side roll outcome'
    }
  ];

  for (const { rule, pattern, description } of patterns) {
    const match = pattern.exec(cleaned);
    if (match) {
      violations.push({
        rule,
        description,
        snippet: cleaned.slice(Math.max(0, match.index - 20), match.index + match[0].length + 20).trim()
      });
    }
  }

  return violations.length === 0
    ? { ok: true, violations: [] }
    : { ok: false, violations };
}

/**
 * Run every verifier and return a consolidated result.
 * Usage:
 *   const { ok, violations } = verifyDmResponse(aiText);
 *   if (!ok) stash(violations) for next-turn correction feedback
 */
export function verifyDmResponse(text) {
  const verifiers = [verifyHardStops, verifyMetaCommentary];
  const allViolations = [];
  for (const v of verifiers) {
    const result = v(text);
    if (!result.ok) allViolations.push(...result.violations);
  }
  return {
    ok: allViolations.length === 0,
    violations: allViolations
  };
}

/**
 * Build a correction note for the next turn — parallels
 * `markerSchemas.js::buildCorrectionMessage` but for rule violations.
 * Returns null if no violations to report.
 */
export function buildRuleCorrectionMessage(violations) {
  if (!violations || violations.length === 0) return null;
  const lines = violations.map(v => {
    if (v.rule === 'hard_stop_after_roll') {
      return `[SYSTEM] Your last response called for a roll ("${v.trigger}") but continued with ~${v.trailingWords} more words: "${v.trailing}". Cardinal Rule 2: the roll request is your LAST sentence. Don't narrate after calling for a roll — wait for the player's number.`;
    }
    if (v.rule === 'meta_parenthetical') {
      return `[SYSTEM] Your last response included DM commentary (${v.description}). Cardinal Rule 4: STAY IN THE WORLD — no parenthetical asides or meta-notes. Pure narrative only.`;
    }
    if (v.rule === 'narrated_check_result') {
      return `[SYSTEM] Your last response narrated a check result explicitly (${v.description}). Cardinal Rule 4: never write "you succeed" / "you fail" — narrate what HAPPENS in the fiction based on the player's number.`;
    }
    if (v.rule === 'narrated_roll_outcome') {
      return `[SYSTEM] Your last response narrated a roll outcome: "${v.snippet}". Cardinal Rule 1: you never roll the player's dice. Let the player report their number; then narrate the fictional consequence.`;
    }
    return `[SYSTEM] Rule violation (${v.rule}): ${JSON.stringify(v)}`;
  });
  return lines.join('\n');
}
