/**
 * Playtest logging — surfaces context-drift signals during sessions.
 *
 * Most of the recent prompt/marker/rule architecture is invisible to the
 * player by design. The player sees the AI's narrative output. The
 * architecture (marker validation, rule verifiers, correction-feedback
 * loops, canon ledger, rolling summary) lives one layer below. Without
 * instrumentation, you can't tell whether the system is working.
 *
 * This module emits structured `[playtest]` log lines so you can:
 *   • Watch in real time during a session (each turn = one line)
 *   • Analyze a session at the end (summary block with trajectory data)
 *
 * All lines are tagged `[playtest]` so they can be grepped or filtered out
 * of production logs as needed.
 *
 * Two functions:
 *   logTurn({ sessionId, turnNumber, sessionType, ... })
 *     → one-line summary of the just-processed turn
 *   logSessionEnd({ sessionId, sessionType, turns, totals, ... })
 *     → multi-line summary of the whole session
 *
 * Both are pure side-effect (console.log). Callers compose the data shape
 * from whatever they have on hand.
 */

const TAG = '[playtest]';

// ---------------------------------------------------------------------------
// Per-turn line
// ---------------------------------------------------------------------------

/**
 * Format and emit a one-line per-turn summary. Pass any of the optional
 * fields you have — missing ones are simply omitted from the line.
 *
 * @param {object} d
 * @param {number} d.sessionId                DB row id (for cross-referencing with server logs)
 * @param {number} d.turnNumber               1-indexed turn count
 * @param {string} d.sessionType              'dm' | 'prelude_arc' | 'dm_mode'
 * @param {string} [d.characterName]          PC name for human-readable framing
 * @param {number} [d.sessionOrdinal]         prelude — which play-session of N this is (1..N)
 * @param {number} [d.sessionTotal]           prelude — N (5 for the standard prelude)
 * @param {number} [d.chapter]                prelude — current chapter (1-4)
 * @param {number} [d.promptChars]            system prompt size in chars
 * @param {number} [d.outputTokens]           tokens generated this turn
 * @param {number} [d.markersValid]           markers that parsed cleanly
 * @param {number} [d.markersMalformed]       markers caught by schema validator
 * @param {number} [d.ruleViolations]         hard-stop / meta-commentary etc.
 * @param {boolean} [d.correctionConsumed]    a previous-turn correction was served this turn
 * @param {boolean} [d.correctionQueued]      a new correction was queued for next turn
 * @param {number} [d.canonAdded]             prelude — new canon facts this turn
 * @param {number} [d.canonRetired]           prelude — facts retired (drift signal)
 * @param {number} [d.emergencesOffered]      prelude — emergence cards fired
 * @param {number} [d.capViolations]          prelude — emergence rejected by cap
 * @param {boolean} [d.rollingSummaryFired]   the rolling summary applied this turn
 * @param {boolean} [d.chapterAdvanced]       prelude — chapter rolled forward
 * @param {string}  [d.tag]                   short freeform note (e.g. "Ch3->Ch4")
 */
export function logTurn(d) {
  // Lead with human-readable framing when we have it. The DB session id
  // (s=NNN) is auto-incremented across ALL sessions ever — useful for
  // grepping server logs, but misleading as a "which session is this" tell.
  // Preferred: "Alexiel · prelude 1/5 · ch1 t3" with (sid=124) at the tail
  // for cross-reference.
  const head = [];
  if (d.characterName) head.push(d.characterName);
  if (d.sessionType === 'prelude_arc' && d.sessionOrdinal && d.sessionTotal) {
    head.push(`prelude ${d.sessionOrdinal}/${d.sessionTotal}`);
  } else if (d.sessionType) {
    head.push(d.sessionType);
  }
  if (Number.isFinite(d.chapter)) head.push(`ch${d.chapter}`);
  head.push(`t${d.turnNumber}`);

  const parts = [`${TAG} ${head.join(' · ')}`];

  if (Number.isFinite(d.promptChars)) {
    const kb = (d.promptChars / 1000).toFixed(1);
    parts.push(`prompt=${kb}k`);
  }
  if (Number.isFinite(d.outputTokens)) parts.push(`out=${d.outputTokens}t`);

  // markers=N(/M bad) only printed when there are markers
  if (Number.isFinite(d.markersValid) || Number.isFinite(d.markersMalformed)) {
    const v = d.markersValid || 0;
    const m = d.markersMalformed || 0;
    if (v + m > 0) parts.push(`markers=${v}/${m}bad`);
  }
  if (d.ruleViolations) parts.push(`viol=${d.ruleViolations}`);

  if (d.correctionConsumed) parts.push(`fixed-prev`);
  if (d.correctionQueued) parts.push(`will-correct`);

  if (d.canonAdded) parts.push(`canon+${d.canonAdded}`);
  if (d.canonRetired) parts.push(`canon-${d.canonRetired}!`);  // ! = drift signal
  if (d.emergencesOffered) parts.push(`emerg=${d.emergencesOffered}`);
  if (d.capViolations) parts.push(`capX=${d.capViolations}`);
  if (d.rollingSummaryFired) parts.push(`rolling`);
  if (d.chapterAdvanced) parts.push(`CHAPTER+`);

  if (d.tag) parts.push(`(${d.tag})`);
  if (Number.isFinite(d.sessionId)) parts.push(`(sid=${d.sessionId})`);

  console.log(parts.join(' '));
}

// ---------------------------------------------------------------------------
// Session-end multi-line summary
// ---------------------------------------------------------------------------

/**
 * Format and emit a session-end summary block.
 *
 * @param {object} d
 * @param {number} d.sessionId                DB row id (cross-reference)
 * @param {string} d.sessionType              'dm' | 'prelude_arc' | 'dm_mode'
 * @param {number} d.totalTurns
 * @param {string} [d.characterName]          human-readable framing
 * @param {number} [d.sessionOrdinal]         prelude — which play-session of N
 * @param {number} [d.sessionTotal]           prelude — N (5 standard)
 * @param {number} [d.startTimestamp]         epoch ms or ISO string
 * @param {number} [d.endTimestamp]           epoch ms or ISO string (default: now)
 * @param {object} [d.totals]                 aggregate counters
 *   markers_emitted, markers_malformed, malformed_rate
 *   rule_violations
 *   corrections_queued, corrections_consumed
 *   canon_added, canon_retired
 *   emergences_offered, emergences_accepted, emergences_declined, cap_violations
 *   rolling_summary_fires
 *   chapter_advances
 * @param {number} [d.firstPromptChars]       prompt size on turn 1
 * @param {number} [d.lastPromptChars]        prompt size on final turn
 * @param {string[]} [d.npcReentries]         e.g. ['Moss(t4→t14)', 'Vask(t1→t9→t22)']
 * @param {string[]} [d.notes]                free-form items to surface
 */
export function logSessionEnd(d) {
  const lines = [];
  // Banner leads with character + session ordinal when available, falls back
  // to type only. DB session id goes in the tail for cross-referencing.
  const head = [TAG, 'SESSION SUMMARY'];
  if (d.characterName) head.push(d.characterName);
  if (d.sessionType === 'prelude_arc' && d.sessionOrdinal && d.sessionTotal) {
    head.push(`prelude ${d.sessionOrdinal}/${d.sessionTotal}`);
  } else {
    head.push(d.sessionType);
  }
  head.push(`${d.totalTurns} turns`);
  if (Number.isFinite(d.sessionId)) head.push(`(sid=${d.sessionId})`);
  const banner = `═══ ${head.join(' · ')} ═══`;
  lines.push('');
  lines.push(banner);

  // Duration
  if (d.startTimestamp) {
    const start = typeof d.startTimestamp === 'string'
      ? new Date(d.startTimestamp).getTime()
      : d.startTimestamp;
    const end = d.endTimestamp
      ? (typeof d.endTimestamp === 'string' ? new Date(d.endTimestamp).getTime() : d.endTimestamp)
      : Date.now();
    const mins = Math.round((end - start) / 60000);
    lines.push(`Duration: ${mins} minutes wall-clock`);
  }

  // Marker / rule trajectory
  const t = d.totals || {};
  if (t.markers_emitted != null) {
    const malformed = t.markers_malformed || 0;
    const rate = t.markers_emitted > 0
      ? ` (${((malformed / t.markers_emitted) * 100).toFixed(1)}%)`
      : '';
    lines.push(`Markers: ${t.markers_emitted} emitted, ${malformed} malformed${rate}`);
  }
  if (t.rule_violations != null) {
    lines.push(`Rule violations: ${t.rule_violations} caught (hard-stop / meta-commentary)`);
  }
  if (t.corrections_queued != null || t.corrections_consumed != null) {
    const q = t.corrections_queued || 0;
    const c = t.corrections_consumed || 0;
    const fixRate = q > 0 ? ` (${((c / q) * 100).toFixed(0)}% self-corrected next turn)` : '';
    lines.push(`Corrections: ${q} queued, ${c} acted on${fixRate}`);
  }

  // Prelude-specific
  if (t.canon_added != null || t.canon_retired != null) {
    const driftFlag = (t.canon_retired || 0) > 0 ? ' ⚠ retire = potential drift' : '';
    lines.push(`Canon: +${t.canon_added || 0} added, -${t.canon_retired || 0} retired${driftFlag}`);
  }
  if (t.emergences_offered != null) {
    const acc = t.emergences_accepted || 0;
    const dec = t.emergences_declined || 0;
    const cap = t.cap_violations || 0;
    lines.push(`Emergences: ${t.emergences_offered} offered (${acc} accepted, ${dec} declined, ${cap} cap-blocked)`);
  }
  if (t.chapter_advances) {
    lines.push(`Chapters: ${t.chapter_advances} advance(s) within session`);
  }
  if (t.rolling_summary_fires) {
    lines.push(`Rolling summary: fired ${t.rolling_summary_fires} time(s)`);
  }

  // Context-drift indicator: prompt-size growth
  if (Number.isFinite(d.firstPromptChars) && Number.isFinite(d.lastPromptChars)) {
    const f = (d.firstPromptChars / 1000).toFixed(1);
    const l = (d.lastPromptChars / 1000).toFixed(1);
    const deltaAbs = Math.abs(d.lastPromptChars - d.firstPromptChars) / 1000;
    const arrow = d.lastPromptChars > d.firstPromptChars ? '↑' : (d.lastPromptChars < d.firstPromptChars ? '↓' : '·');
    lines.push(`Prompt size: ${f}k → ${l}k (${arrow}${deltaAbs.toFixed(1)}k drift)`);
  }

  if (Array.isArray(d.npcReentries) && d.npcReentries.length > 0) {
    lines.push(`NPC re-entries: ${d.npcReentries.join(', ')}`);
  }

  if (Array.isArray(d.notes) && d.notes.length > 0) {
    for (const note of d.notes) lines.push(`Note: ${note}`);
  }

  lines.push('═'.repeat(banner.length));
  lines.push('');

  console.log(lines.join('\n'));
}

// ---------------------------------------------------------------------------
// Aggregator — convenience for accumulating per-turn data into session totals
// ---------------------------------------------------------------------------

/**
 * Build an empty totals object that callers can incrementally accumulate
 * over a session, then pass to logSessionEnd as `totals`.
 */
export function newSessionTotals() {
  return {
    markers_emitted: 0,
    markers_malformed: 0,
    rule_violations: 0,
    corrections_queued: 0,
    corrections_consumed: 0,
    canon_added: 0,
    canon_retired: 0,
    emergences_offered: 0,
    emergences_accepted: 0,
    emergences_declined: 0,
    cap_violations: 0,
    rolling_summary_fires: 0,
    chapter_advances: 0
  };
}

/**
 * Accumulate one turn's data into a totals object. Convenience helper so
 * the route doesn't have to do the bookkeeping inline.
 */
export function accumulateTurn(totals, turnData) {
  if (!totals) return;
  totals.markers_emitted += (turnData.markersValid || 0) + (turnData.markersMalformed || 0);
  totals.markers_malformed += turnData.markersMalformed || 0;
  totals.rule_violations += turnData.ruleViolations || 0;
  if (turnData.correctionQueued) totals.corrections_queued += 1;
  if (turnData.correctionConsumed) totals.corrections_consumed += 1;
  totals.canon_added += turnData.canonAdded || 0;
  totals.canon_retired += turnData.canonRetired || 0;
  totals.emergences_offered += turnData.emergencesOffered || 0;
  totals.cap_violations += turnData.capViolations || 0;
  if (turnData.rollingSummaryFired) totals.rolling_summary_fires += 1;
  if (turnData.chapterAdvanced) totals.chapter_advances += 1;
}
