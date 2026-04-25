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
 * Detect mechanical roll-number leaks in narration. CARDINAL RULE 13b
 * (added v1.0.95): the player's d20 result is INPUT to your generation,
 * never OUTPUT. Phrases like "You rolled an 11" or "with a 14" or "your
 * roll of 19" leak the mechanic into the prose — the player already
 * knows their roll; they don't need it recited back.
 *
 * This is the v1.0.94 playtest failure mode where the AI wrote:
 *   "You rolled an 11. The spoke seats — mostly..."
 *
 * Caught patterns (case-insensitive):
 *   • "you rolled (a |an )?N"
 *   • "with (a |an |your )?N" when N is 1-30 and followed by "you" / a verb
 *   • "your roll of N"
 *   • "the dice landed" / "the dice land at N"
 *   • "on (a |an |your )?N(,)?" where it precedes outcome language
 *   • "you succeed on your check" / "you fail your check" (mechanical-success leak)
 *   • "your check succeeds" / "your check fails"
 */
export function verifyNoMechanicalRoll(text) {
  if (!text || typeof text !== 'string') return { ok: true, violations: [] };
  const violations = [];

  const cleaned = text.replace(/\[[A-Z][A-Z_]+(?::[^\]]*)?\]/g, '');

  const patterns = [
    {
      // "You rolled an 11" / "you rolled 17" / "you rolled a 20"
      pattern: /\byou\s+rolled\s+(?:an?\s+)?\d{1,2}\b/i,
      label: 'roll-number recited (e.g. "you rolled an 11")'
    },
    {
      // "Your roll of 19" / "your roll of 8"
      pattern: /\byour\s+roll\s+of\s+\d{1,2}\b/i,
      label: 'roll-number narrated (e.g. "your roll of 19")'
    },
    {
      // "With a 14, you" / "with an 11" / "with your 17"
      pattern: /\bwith\s+(?:an?|your)\s+\d{1,2}[,\s]/i,
      label: 'roll-number prefacing outcome (e.g. "with a 14, you...")'
    },
    {
      // "On your 8" / "on a nat 1" — mechanical preface
      pattern: /\bon\s+(?:your|a|an)\s+(?:nat\s+)?\d{1,2}[,\s]/i,
      label: 'roll-number preface (e.g. "on your 8...")'
    },
    {
      // "The dice land" / "the dice landed at N"
      pattern: /\bthe\s+dice\s+(?:land(?:ed|s)?(?:\s+at)?|fall(?:s|en)?)\b/i,
      label: 'dice mechanic narrated'
    },
    {
      // "you succeed on your X check" / "you fail your X save" — mechanical success leak
      pattern: /\byou\s+(?:succeed\s+on|fail)\s+(?:your\s+)?(?:[A-Z][a-z]+\s+)?(?:check|save|saving throw|roll)\b/i,
      label: 'mechanical success/failure narrated'
    },
    {
      // "Your X check succeeds/fails"
      pattern: /\byour\s+(?:[A-Z][a-z]+\s+)?(?:check|roll|save|saving throw)\s+(?:succeeds?|fails?)\b/i,
      label: 'mechanical outcome narrated'
    }
  ];

  for (const { pattern, label } of patterns) {
    const m = pattern.exec(cleaned);
    if (m) {
      violations.push({
        rule: 'mechanical_roll_leak',
        description: label,
        snippet: cleaned.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30).trim()
      });
    }
  }

  return violations.length === 0
    ? { ok: true, violations: [] }
    : { ok: false, violations };
}

/**
 * Detect the "stillness as reaction-beat" tic family — Rule 19a violations
 * including "X goes still / is still / freezes / X's [thing] stops" patterns.
 * From v1.0.95 playtest: "Toren is very still" + "Vess's spoon stops".
 *
 * These are signal-shortcuts where the AI freezes a character's motion to
 * communicate "the moment landed" without earning it through specific
 * physical detail. Banned in any form when used as reaction-beat.
 *
 * NOT flagged: legitimate descriptive stillness in non-reaction contexts
 * ("the lake is still" — weather/scene). The pattern requires a NAMED
 * character or their possessive ("X's", "her", "his") to be the subject.
 */
export function verifyNoStillFreezeTic(text) {
  if (!text || typeof text !== 'string') return { ok: true, violations: [] };
  const violations = [];

  const cleaned = text.replace(/\[[A-Z][A-Z_]+(?::[^\]]*)?\]/g, '');

  const patterns = [
    {
      // "X goes (very) still" / "X goes still" / "X stills"
      pattern: /\b(?:[A-Z][a-z]+|he|she|they|you)\s+goes\s+(?:very\s+|completely\s+|suddenly\s+)?still\b/i,
      label: '"X goes (very) still" reaction-beat tic'
    },
    {
      pattern: /\b(?:[A-Z][a-z]+|he|she|they|you)\s+stills\b/i,
      label: '"X stills" reaction-beat tic'
    },
    {
      // "X is (very/suddenly/completely) still" — v1.0.95 playtest variant
      pattern: /\b(?:[A-Z][a-z]+|he|she|they|you)\s+is\s+(?:very|suddenly|completely)\s+still\b/i,
      label: '"X is very/suddenly/completely still" reaction-beat tic'
    },
    {
      // "X has gone still"
      pattern: /\b(?:[A-Z][a-z]+|he|she|they|you)\s+has\s+gone\s+still\b/i,
      label: '"X has gone still" reaction-beat tic'
    },
    {
      // "X freezes" / "X holds completely still" / "X stops moving"
      pattern: /\b(?:[A-Z][a-z]+|he|she|they|you)\s+(?:freezes|holds\s+completely\s+still|stops\s+moving)\b/i,
      label: '"X freezes / holds still / stops moving" reaction-beat tic'
    },
    {
      // "X's [hand|fingers|spoon|sewing|work|brush|...] stops" — v1.0.95 playtest variant
      // Rejects only the action-freeze family. We require a possessive subject + a stoppable object/activity + "stops".
      pattern: /\b(?:[A-Z][a-z]+'s|her|his|their|your)\s+(?:hand|hands|fingers|fist|spoon|knife|brush|needle|sewing|work|breath|breathing|whittling|stitching|writing|reading|chopping|kneading|hammering|pen|quill|ladle|bowl|cup|book|page)\s+stops\b/i,
      label: '"X\'s [activity-object] stops" reaction-beat tic — same family as "goes still"'
    }
  ];

  for (const { pattern, label } of patterns) {
    const m = pattern.exec(cleaned);
    if (m) {
      violations.push({
        rule: 'still_freeze_tic',
        description: label,
        snippet: cleaned.slice(Math.max(0, m.index - 20), m.index + m[0].length + 30).trim()
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
  const verifiers = [
    verifyHardStops,
    verifyMetaCommentary,
    verifyNoMechanicalRoll,
    verifyNoStillFreezeTic
  ];
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
    if (v.rule === 'mechanical_roll_leak') {
      return `[SYSTEM] Your last response leaked the roll number into the prose: ${v.description}. Snippet: "${v.snippet}". Cardinal Rule 13b: the d20 result is INPUT to your generation, never OUTPUT. Narrate the FICTIONAL outcome (the spoke seats; the door resists; the lie lands clean) — never recite "you rolled an 11" or "with a 14" or "you succeed on your check." Re-emit your last response with the roll number stripped and the outcome carried by the prose.`;
    }
    if (v.rule === 'still_freeze_tic') {
      return `[SYSTEM] Your last response used the "stillness as reaction-beat" tic: ${v.description}. Snippet: "${v.snippet}". Rule 19a: this whole family — "X goes/is still," "X stills," "X freezes," "X's [hand/spoon/sewing] stops" — is banned. Replace with specific physical detail in the character's own body and context (what are their hands actually doing? where are their eyes going? what are they holding?). See Rule 19a for worked examples.`;
    }
    return `[SYSTEM] Rule violation (${v.rule}): ${JSON.stringify(v)}`;
  });
  return lines.join('\n');
}
