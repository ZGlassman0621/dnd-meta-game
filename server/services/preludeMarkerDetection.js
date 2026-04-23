/**
 * Prelude arc marker detection.
 *
 * Phase 2b-i scope:
 *   [AGE_ADVANCE: years=N]
 *   [CHAPTER_END: summary="..."]
 *   [SESSION_END_CLIFFHANGER: "..."]
 *   [NPC_CANON: name="..." relationship="..." status="..."]
 *   [LOCATION_CANON: name="..." type="..." is_home=true]
 *
 * Emergence markers ([STAT_HINT] / [SKILL_HINT] / [CLASS_HINT] etc.) and
 * transition markers ([DEPARTURE] / [PRELUDE_END]) land in later phases.
 *
 * Design notes:
 *   - Parsers are regex-based and forgiving — Sonnet sometimes drops a
 *     closing bracket or swaps single/double quotes.
 *   - `extractAll(regex, text)` collects every match from a response (one
 *     response can emit multiple [NPC_CANON] markers).
 *   - `detectPreludeMarkers(text)` returns a single structured object
 *     summarising everything detected. Caller decides what to persist.
 */

// Helper — match a quoted value in a marker field. Accepts " or ' or
// unquoted single-token, and is tolerant of trailing whitespace.
function q(field) {
  // e.g. name="Moira" or name='Moira' or name=Moira
  return `${field}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s\\]]+))`;
}

// Pull the first non-undefined capture group out of a regex match. This is
// how we handle the "any of 3 quoting styles" alternation above.
function pick(match, startIdx) {
  for (let i = startIdx; i < match.length; i++) {
    if (match[i] !== undefined) return match[i];
  }
  return null;
}

/**
 * Detect [AGE_ADVANCE: years=N].
 * Returns { years: number } or null.
 */
export function detectAgeAdvance(text) {
  if (!text) return null;
  const re = /\[AGE_ADVANCE:\s*years\s*=\s*(\d+)\s*\]/i;
  const m = re.exec(text);
  if (!m) return null;
  const years = parseInt(m[1], 10);
  if (!Number.isFinite(years) || years <= 0) return null;
  return { years };
}

/**
 * Detect [CHAPTER_END: summary="..."].
 * Returns { summary: string } or null.
 */
export function detectChapterEnd(text) {
  if (!text) return null;
  const re = new RegExp(`\\[CHAPTER_END:\\s*${q('summary')}\\s*\\]`, 'i');
  const m = re.exec(text);
  if (!m) return null;
  const summary = pick(m, 1);
  return summary ? { summary } : null;
}

/**
 * Detect [SESSION_END_CLIFFHANGER: "..."].
 * The payload can be a plain quoted string (no field=), a `text="..."`
 * assignment, or bare text inside the brackets. Handles all three.
 * Returns the cliffhanger string or null.
 */
export function detectCliffhanger(text) {
  if (!text) return null;
  // Form A: [SESSION_END_CLIFFHANGER: "..."] or 'x'
  const reA = /\[SESSION_END_CLIFFHANGER:\s*(?:"([^"]*)"|'([^']*)')\s*\]/i;
  const mA = reA.exec(text);
  if (mA) return pick(mA, 1);
  // Form B: [SESSION_END_CLIFFHANGER: text="..."]
  const reB = new RegExp(`\\[SESSION_END_CLIFFHANGER:\\s*${q('text')}\\s*\\]`, 'i');
  const mB = reB.exec(text);
  if (mB) return pick(mB, 1);
  // Form C: [SESSION_END_CLIFFHANGER: bare text up to closing bracket]
  const reC = /\[SESSION_END_CLIFFHANGER:\s*([^\]]+)\]/i;
  const mC = reC.exec(text);
  if (mC) return mC[1].trim().replace(/^["']|["']$/g, '');
  return null;
}

/**
 * Detect all [NPC_CANON: name="..." relationship="..." status="..."]
 * markers in a response. Returns an array of { name, relationship, status }.
 */
export function detectNpcCanons(text) {
  if (!text) return [];
  const results = [];
  const re = /\[NPC_CANON:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const name = extractField(fields, 'name');
    if (!name) continue;
    results.push({
      name,
      relationship: extractField(fields, 'relationship'),
      status: extractField(fields, 'status') || 'alive'
    });
  }
  return results;
}

/**
 * Detect [HP_CHANGE: delta=-N reason="..."] markers. Multiple allowed
 * per response (e.g., "they hit you for 2, you catch your breath and
 * regain 1"). Returns an array of { delta: number, reason: string|null }.
 * Negative delta = damage, positive = healing.
 */
export function detectHpChanges(text) {
  if (!text) return [];
  const results = [];
  const re = /\[HP_CHANGE:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const deltaRaw = extractField(fields, 'delta');
    if (deltaRaw === null) continue;
    const delta = parseInt(deltaRaw, 10);
    if (!Number.isFinite(delta) || delta === 0) continue;
    results.push({
      delta,
      reason: extractField(fields, 'reason')
    });
  }
  return results;
}

/**
 * Detect [CHAPTER_PROMISE: theme="..." question="..."] marker. Only
 * expected at the opening of chapter 3 and chapter 4 — Sonnet surfaces
 * the chapter's thematic throughline and invites confirmation/redirect.
 * Returns { theme, question } or null.
 */
export function detectChapterPromise(text) {
  if (!text) return null;
  const re = /\[CHAPTER_PROMISE:\s*([^\]]+)\]/i;
  const m = re.exec(text);
  if (!m) return null;
  const fields = m[1];
  const theme = extractField(fields, 'theme');
  const question = extractField(fields, 'question');
  if (!theme && !question) return null;
  return { theme, question };
}

/**
 * Detect [THEME_COMMITMENT_OFFERED: ...] marker (v1.0.77). Fires at the
 * Chapter 3 wrap-up after the irreversible-act beat, offering the player
 * a set of themes to commit to (shapes Ch4 departure + carries to primary
 * campaign). Server-side: the actual OFFER is recomputed authoritatively
 * by preludeThemeService.buildThemeOffer() rather than trusted from the
 * marker, because the AI doesn't reliably have the full trajectory. The
 * marker just SIGNALS the moment — the UI then fetches the authoritative
 * offer.
 *
 * Returns { signaled: true } or null. No field parsing; presence is all
 * that matters.
 */
export function detectThemeCommitmentOffered(text) {
  if (!text) return null;
  const re = /\[THEME_COMMITMENT_OFFERED(?::[^\]]*)?\]/i;
  return re.test(text) ? { signaled: true } : null;
}

/**
 * Detect [NEXT_SCENE_WEIGHT: heavy|standard|light] — the AI's forward-looking
 * hint about what the next scene is likely to carry. Consumed by the "Auto"
 * model-picker on the following turn. Returns 'heavy' | 'standard' | 'light'
 * or null. If multiple fire in one response, the last one wins (the DM's
 * most recent read of the situation).
 */
export function detectNextSceneWeight(text) {
  if (!text) return null;
  const re = /\[NEXT_SCENE_WEIGHT:\s*(heavy|standard|light)\s*\]/gi;
  let last = null;
  let m;
  while ((m = re.exec(text)) !== null) {
    last = m[1].toLowerCase();
  }
  return last;
}

/**
 * Detect all [LOCATION_CANON: name="..." type="..." is_home=true]
 * markers. Returns an array of { name, type, is_home }.
 */
export function detectLocationCanons(text) {
  if (!text) return [];
  const results = [];
  const re = /\[LOCATION_CANON:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const name = extractField(fields, 'name');
    if (!name) continue;
    const isHomeRaw = extractField(fields, 'is_home');
    const is_home = /^true$/i.test(isHomeRaw || '');
    results.push({
      name,
      type: extractField(fields, 'type'),
      is_home
    });
  }
  return results;
}

/**
 * Helper to extract a `field="value"` (or 'value', or bareword) out of
 * a marker's inner content string. Returns null if not found.
 */
function extractField(fields, field) {
  const re = new RegExp(`${field}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s,\\]]+))`, 'i');
  const m = re.exec(fields);
  if (!m) return null;
  return pick(m, 1);
}

// ---------------------------------------------------------------------------
// Phase 3 — emergence marker detection
// ---------------------------------------------------------------------------
//
// Six emergence-hint markers. Sonnet fires them when the player's played
// behavior has demonstrated something mechanically meaningful — a stat
// pressure, a skill affinity, a class/theme/ancestry alignment, or a value
// shift. The server records the hint, applies caps, and the UI shows an
// inline accept/decline card in the message feed.
//
// Caps and weighting are enforced in preludeEmergenceService.js. Detection
// here is pure: it just extracts structured data from the response text.

/**
 * [STAT_HINT: stat=str magnitude=+1 reason="..."]
 * Returns array of { stat, magnitude, reason }. stat is lowercase 3-letter.
 */
export function detectStatHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[STAT_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const statRaw = extractField(fields, 'stat');
    if (!statRaw) continue;
    const stat = String(statRaw).toLowerCase();
    if (!['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(stat)) continue;
    const magRaw = extractField(fields, 'magnitude');
    const magnitude = parseInt(magRaw || '1', 10);
    if (!Number.isFinite(magnitude) || magnitude < 1 || magnitude > 2) continue;
    results.push({ stat, magnitude, reason: extractField(fields, 'reason') });
  }
  return results;
}

/**
 * [SKILL_HINT: skill="Athletics" reason="..."]
 * Returns array of { skill, reason }.
 */
export function detectSkillHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[SKILL_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const skill = extractField(fields, 'skill');
    if (!skill) continue;
    results.push({ skill, reason: extractField(fields, 'reason') });
  }
  return results;
}

/**
 * [CLASS_HINT: class="ranger" reason="..."]  (also accepts class_id=)
 * Returns array of { class: string, reason }.
 */
export function detectClassHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[CLASS_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const cls = extractField(fields, 'class') || extractField(fields, 'class_id');
    if (!cls) continue;
    results.push({ class: String(cls).toLowerCase(), reason: extractField(fields, 'reason') });
  }
  return results;
}

/**
 * [THEME_HINT: theme="outlander" reason="..."]  (also accepts theme_id=)
 * Returns array of { theme: string, reason }.
 */
export function detectThemeHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[THEME_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const theme = extractField(fields, 'theme') || extractField(fields, 'theme_id');
    if (!theme) continue;
    results.push({ theme: String(theme).toLowerCase(), reason: extractField(fields, 'reason') });
  }
  return results;
}

/**
 * [ANCESTRY_HINT: feat_id="dwarf_l1_stone_sense" reason="..."]
 * Returns array of { feat_id, reason }.
 */
export function detectAncestryHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[ANCESTRY_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const featId = extractField(fields, 'feat_id') || extractField(fields, 'feat');
    if (!featId) continue;
    results.push({ feat_id: featId, reason: extractField(fields, 'reason') });
  }
  return results;
}

/**
 * [VALUE_HINT: value="loyalty" delta=+1 reason="..."]
 * Returns array of { value, delta, reason }. Delta is +1 or -1; other
 * integer values accepted but clamped to [-3, +3] at service layer.
 */
export function detectValueHints(text) {
  if (!text) return [];
  const results = [];
  const re = /\[VALUE_HINT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const value = extractField(fields, 'value');
    if (!value) continue;
    const deltaRaw = extractField(fields, 'delta');
    const delta = parseInt(deltaRaw || '1', 10);
    if (!Number.isFinite(delta) || delta === 0) continue;
    results.push({
      value: String(value).toLowerCase(),
      delta,
      reason: extractField(fields, 'reason')
    });
  }
  return results;
}

// ---------------------------------------------------------------------------
// v1.0.60 — canon facts (running ledger of AI-established truths)
// ---------------------------------------------------------------------------

/**
 * [CANON_FACT: subject="..." category="npc|location|event|relationship|trait|item" fact="..."]
 * Returns array of { subject, category, fact }.
 */
export function detectCanonFacts(text) {
  if (!text) return [];
  const results = [];
  const re = /\[CANON_FACT:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const subject = extractField(fields, 'subject');
    const fact = extractField(fields, 'fact');
    if (!subject || !fact) continue;
    const category = (extractField(fields, 'category') || 'trait').toLowerCase();
    if (!['npc', 'location', 'event', 'relationship', 'trait', 'item'].includes(category)) continue;
    results.push({ subject, category, fact });
  }
  return results;
}

/**
 * [CANON_FACT_RETIRE: subject="..." fact_contains="..."]
 * Returns array of { subject, factContains }.
 */
export function detectCanonFactRetires(text) {
  if (!text) return [];
  const results = [];
  const re = /\[CANON_FACT_RETIRE:\s*([^\]]+)\]/gi;
  let m;
  while ((m = re.exec(text)) !== null) {
    const fields = m[1];
    const subject = extractField(fields, 'subject');
    const factContains = extractField(fields, 'fact_contains') || extractField(fields, 'contains');
    if (!subject || !factContains) continue;
    results.push({ subject, factContains });
  }
  return results;
}

/**
 * One-call roll-up: returns an object summarising every marker detected in
 * the response. Fields are null / empty-array when nothing was detected.
 */
export function detectPreludeMarkers(text) {
  return {
    ageAdvance: detectAgeAdvance(text),
    chapterEnd: detectChapterEnd(text),
    cliffhanger: detectCliffhanger(text),
    npcCanons: detectNpcCanons(text),
    locationCanons: detectLocationCanons(text),
    hpChanges: detectHpChanges(text),
    chapterPromise: detectChapterPromise(text),
    // Phase 3 emergence markers
    statHints: detectStatHints(text),
    skillHints: detectSkillHints(text),
    classHints: detectClassHints(text),
    themeHints: detectThemeHints(text),
    ancestryHints: detectAncestryHints(text),
    valueHints: detectValueHints(text),
    // v1.0.60 canon facts
    canonFacts: detectCanonFacts(text),
    canonFactRetires: detectCanonFactRetires(text),
    // v1.0.62 model auto-picker
    nextSceneWeight: detectNextSceneWeight(text),
    // v1.0.77 theme commitment (signal only; server recomputes the offer)
    themeCommitmentOffered: detectThemeCommitmentOffered(text)
  };
}

/**
 * Strip all prelude markers from a response so they don't appear in the
 * rendered narrative. Called by the UI layer before display.
 *
 * Covers:
 *   - Prelude-specific markers (this file's detectors)
 *   - Inherited DM markers the AI may also emit inside prelude sessions
 *     ([COMBAT_START], [COMBAT_END], [LOOT_DROP], etc.) — the prelude
 *     doesn't wire these into the combat tracker yet (Phase 2b-ii), but
 *     Sonnet will emit them when the system prompt says to, and they
 *     shouldn't leak into the displayed narrative.
 *
 * As a safety net, any remaining [ALL_CAPS_TOKEN: …] or [ALL_CAPS_TOKEN]
 * bracketed marker is also stripped. This keeps future marker additions
 * from leaking visually before they get their own detector.
 */
export function stripPreludeMarkers(text) {
  if (!text) return text;
  return text
    // Prelude-specific markers (handled server-side)
    .replace(/\[AGE_ADVANCE:[^\]]*\]/gi, '')
    .replace(/\[CHAPTER_END:[^\]]*\]/gi, '')
    .replace(/\[SESSION_END_CLIFFHANGER:[^\]]*\]/gi, '')
    .replace(/\[NPC_CANON:[^\]]*\]/gi, '')
    .replace(/\[LOCATION_CANON:[^\]]*\]/gi, '')
    .replace(/\[HP_CHANGE:[^\]]*\]/gi, '')
    .replace(/\[CHAPTER_PROMISE:[^\]]*\]/gi, '')
    // Phase 3 emergence markers — stripped from display; the UI renders
    // them separately as accept/decline cards after the narrative paragraph.
    .replace(/\[STAT_HINT:[^\]]*\]/gi, '')
    .replace(/\[SKILL_HINT:[^\]]*\]/gi, '')
    .replace(/\[CLASS_HINT:[^\]]*\]/gi, '')
    .replace(/\[THEME_HINT:[^\]]*\]/gi, '')
    .replace(/\[ANCESTRY_HINT:[^\]]*\]/gi, '')
    .replace(/\[VALUE_HINT:[^\]]*\]/gi, '')
    // v1.0.60 canon-facts markers
    .replace(/\[CANON_FACT:[^\]]*\]/gi, '')
    .replace(/\[CANON_FACT_RETIRE:[^\]]*\]/gi, '')
    // v1.0.62 model auto-picker — AI's forward weight hint
    .replace(/\[NEXT_SCENE_WEIGHT:[^\]]*\]/gi, '')
    // v1.0.77 theme commitment — stripped from display; the UI renders a
    // Choose Your Path card instead after the narrative paragraph.
    .replace(/\[THEME_COMMITMENT_OFFERED(?::[^\]]*)?\]/gi, '')
    // Combat + loot markers inherited from the main DM prompt convention
    .replace(/\[COMBAT_START(?::[^\]]*)?\]/gi, '')
    .replace(/\[COMBAT_END(?::[^\]]*)?\]/gi, '')
    .replace(/\[LOOT_DROP(?::[^\]]*)?\]/gi, '')
    .replace(/\[ADD_ITEM(?::[^\]]*)?\]/gi, '')
    // Catch-all for any other ALL_CAPS_TOKEN bracketed marker that may
    // surface without a dedicated stripper. Requires at least 3 chars of
    // A-Z/underscore to avoid stripping legitimate bracketed text like
    // "[Karrow's Rest]" or "[Eleint]".
    .replace(/\[[A-Z][A-Z_]{2,}(?::[^\]]*)?\]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
