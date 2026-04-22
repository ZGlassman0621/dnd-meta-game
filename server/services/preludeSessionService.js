/**
 * Prelude session service.
 *
 * Phase 2b-i. Handles the lifecycle of prelude-arc sessions — creating,
 * resuming, and continuing them. Sessions are stored in the existing
 * `dm_sessions` table with `session_type='prelude_arc'` so the historical
 * origin-story sessions (`session_type='prelude'`) and regular campaign
 * sessions (`session_type='player'`) don't collide.
 *
 * Flow:
 *   startSession(characterId)        → creates a new prelude session,
 *                                      calls Opus for the opening narrative,
 *                                      returns { sessionId, messages }
 *   getActiveSession(characterId)    → fetch the active session if one
 *                                      exists (for resume)
 *   sendMessage(sessionId, action)   → append player action, call Sonnet,
 *                                      parse markers, persist, return response
 *   endSession(sessionId, reason?)   → close the session with status
 *                                      'completed' or 'paused'
 *
 * Marker processing lives in `preludeMarkerDetection.js`. This service
 * owns the DB writes those markers trigger (age/chapter updates,
 * canon NPC/location inserts, cliffhanger persistence).
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { chat, startSession as claudeStartSession, continueSession as claudeContinueSession } from './claude.js';
import { getPreludeCharacter } from './preludeService.js';
import { getArcPlan, generateArcPlan } from './preludeArcService.js';
import {
  createPreludeSystemPrompt,
  createPreludeOpeningPrompt,
  createPreludeResumePrompt
} from './preludeArcPromptBuilder.js';
import { detectPreludeMarkers } from './preludeMarkerDetection.js';
import * as rollingSummary from './rollingSummaryService.js';
import * as emergenceService from './preludeEmergenceService.js';
import * as canonService from './preludeCanonService.js';

// Play-session pacing thresholds. A "play-session" is one pause-to-pause
// cycle; each resume starts a new play-session. Exchange count = messages
// added since the current play-session began (baseline set on start/resume).
//
// Target: ~50 exchanges (~100 messages) per play-session. Numbers raised
// in v1.0.61 after v1.0.59's tighter bounds cut sessions off at 16 exchanges
// — too short to build real weight. Canon facts (v1.0.60) mitigate the
// context-drift risk, so we can safely let sessions run longer.
const PLAY_SESSION_NUDGE_MESSAGES = 100;   // ~50 exchanges — approaching target
const PLAY_SESSION_WRAP_MESSAGES = 130;    // ~65 exchanges — fire cliffhanger soon
const PLAY_SESSION_FORCE_MESSAGES = 160;   // ~80 exchanges — force cliffhanger NOW

// Player-toggleable model preference. Three modes:
//   'sonnet' — always Sonnet (default, fast, cheap)
//   'opus'   — always Opus (richer, slower, ~5x cost)
//   'auto'   — Sonnet by default, escalate to Opus for heavy scenes.
//
// Auto-mode "HARD" triggers (always Opus regardless of consecutive-turn cap):
//   • current chapter == 4 (finale always Opus — user-directed)
//   • play-session past PLAY_SESSION_WRAP_MESSAGES (close a big beat well)
//
// Auto-mode "SOFT" triggers (Opus, but subject to consecutive-turn cap):
//   • previous turn tagged [NEXT_SCENE_WEIGHT: heavy]
//   • previous turn had HP delta ≤ -3 (stakes just spiked)
//   • previous turn fired [CHAPTER_PROMISE]
//
// Auto-mode downgrade (always Sonnet):
//   • previous turn tagged [NEXT_SCENE_WEIGHT: light] — AI explicitly released
//   • consecutive soft-opus turns exceeded the cap (safety valve)
//
// Consecutive-Opus cap (v1.0.66):
//   Soft-triggered Opus can only run AUTO_SOFT_OPUS_MAX turns in a row
//   before auto-dropping back to Sonnet for one cooldown turn. Prevents
//   the Opus-feedback-loop bug where Opus keeps tagging 'heavy' because
//   its own prose reads as emotionally loaded and never releases.
//   Hard triggers (chapter 4, session wrap) bypass the cap — those are
//   user-directed long-Opus states.
const VALID_MODES = new Set(['sonnet', 'opus', 'auto']);
const VALID_CONCRETE_MODELS = new Set(['sonnet', 'opus']);
const AUTO_SOFT_OPUS_MAX = 2;  // cap of consecutive soft-triggered Opus turns

// Derive the concrete model to call given the current mode + session state.
// Returns { mode, model, reason, hard } — `reason` is null for plain
// sonnet/opus modes, or a short string when auto escalates ("chapter-4",
// "heavy-weight", etc.) so the UI can show "Auto → Opus (chapter-4)".
// `hard` indicates whether the trigger bypasses the consecutive-Opus cap.
// Exported for unit tests.
export function pickAutoModel(sessionCfg, runtime, playSessionLength) {
  // HARD triggers — bypass the consecutive-Opus cap
  if (runtime?.chapter >= 4) return { model: 'opus', reason: 'chapter-4', hard: true };
  if (playSessionLength >= PLAY_SESSION_WRAP_MESSAGES) {
    return { model: 'opus', reason: 'session-wrap', hard: true };
  }

  // Explicit AI downgrade
  const lastWeight = sessionCfg?.lastSceneWeight;
  if (lastWeight === 'light') return { model: 'sonnet', reason: 'light-weight', hard: false };

  // SOFT Opus triggers (subject to consecutive-turn cap)
  let softTrigger = null;
  if (lastWeight === 'heavy') softTrigger = 'heavy-weight';
  else if (typeof sessionCfg?.lastHpDelta === 'number' && sessionCfg.lastHpDelta <= -3) {
    softTrigger = 'hp-drop';
  }
  else if (sessionCfg?.lastChapterPromiseTurn === true) softTrigger = 'chapter-promise';

  if (softTrigger) {
    // Cap check: if we've already run Opus on N consecutive soft-triggered
    // turns, force Sonnet this turn for a cooldown. This breaks the
    // feedback loop where Opus keeps tagging 'heavy' on its own output
    // because the prose reads as loaded.
    const consecutive = sessionCfg?.consecutiveSoftOpusTurns || 0;
    if (consecutive >= AUTO_SOFT_OPUS_MAX) {
      return { model: 'sonnet', reason: 'soft-opus-cap', hard: false };
    }
    return { model: 'opus', reason: softTrigger, hard: false };
  }

  return { model: 'sonnet', reason: null, hard: false };
}

function resolveModel(override, sessionCfg, runtime, playSessionLength) {
  const stored = sessionCfg?.model_preference;
  const mode = (override && VALID_MODES.has(override))
    ? override
    : (stored && VALID_MODES.has(stored)) ? stored : 'sonnet';
  if (mode === 'sonnet') return { mode, model: 'sonnet', reason: null };
  if (mode === 'opus') return { mode, model: 'opus', reason: null };
  const { model, reason } = pickAutoModel(sessionCfg, runtime, playSessionLength);
  return { mode, model, reason };
}

// Race-aware starting HP for the current chapter. Mirrors
// preludeService.computeStartingHP but takes the current chapter as input.
function computeMaxHp(chapter = 1, conMod = 0) {
  if (chapter <= 1) return Math.max(1, 4 + conMod);
  if (chapter <= 2) return Math.max(1, 6 + 2 * conMod);
  if (chapter <= 3) return Math.max(1, 8 + 2 * conMod);
  return Math.max(1, 10 + 2 * conMod);
}

/**
 * Build the runtime snapshot passed to the prompt builder on every turn.
 * Keeps the prompt construction side pure by centralising state lookup.
 */
function buildRuntime(character) {
  const chapter = character.prelude_chapter || 1;
  const age = character.prelude_age || 6;
  // Phase 2b-ii: max_hp derived from chapter. HP in-the-moment comes
  // straight from the `current_hp` column, updated by [HP_CHANGE] markers.
  const maxHp = computeMaxHp(chapter, 0);
  const currentHp = character.current_hp != null ? character.current_hp : maxHp;
  return { chapter, age, maxHp, currentHp };
}

/**
 * Return the session ordinal for a character — "which play-session of the
 * prelude are we currently in." Used in the UI top bar so the player can
 * see "Session 3 of ~7-10."
 *
 * The prelude uses a SINGLE `dm_sessions` row per character (paused/resumed
 * as a state machine), so "session number" isn't the DB row count. It's
 * the play-session ordinal, tracked on session_config.session_number and
 * incremented by `resumeSession()` each time the player picks up after
 * a pause/cliffhanger.
 */
async function getSessionOrdinal(sessionId) {
  const row = await dbGet(
    `SELECT session_config FROM dm_sessions WHERE id = ?`,
    [sessionId]
  );
  if (!row) return 1;
  const cfg = safeJsonParse(row.session_config, {});
  return cfg.session_number || 1;
}

/**
 * Start a new prelude session. Rejects if one is already active. Uses Opus
 * for the opening scene (better at establishing) and returns session data
 * ready for UI rendering.
 */
export async function startSession(characterId) {
  const character = await getPreludeCharacter(characterId);
  if (!character) throw new Error('Prelude character not found');
  if (character.creation_phase !== 'prelude') {
    throw new Error('Character is not in prelude phase');
  }

  const active = await dbGet(
    `SELECT id FROM dm_sessions
     WHERE character_id = ? AND session_type = 'prelude_arc' AND status IN ('active', 'paused')`,
    [characterId]
  );
  if (active) {
    throw new Error(`Prelude session ${active.id} is already active for this character`);
  }

  // Auto-generate the arc plan if it doesn't exist. When the player checks
  // "show arc preview" in the setup wizard, the preview screen generates
  // the arc and startSession just reads it. When they skip the preview,
  // the arc hasn't been generated yet — we generate it here silently so
  // the session can start from a fresh setup. Adds ~45-90s to the first
  // turn when skipping the preview, which is the same cost as generating
  // it earlier; just moves when the wait happens.
  let arcPlan = await getArcPlan(characterId);
  if (!arcPlan) {
    console.log(`[prelude] Arc plan missing for character ${characterId}; generating on session start.`);
    arcPlan = await generateArcPlan(characterId, { isRegeneration: false });
  }

  const setup = character.prelude_setup_data;
  const runtime = buildRuntime(character);

  // v1.0.60 — canon facts block. Empty on first session, populated as
  // Sonnet emits [CANON_FACT] markers across turns.
  const canonBlock = await canonService.buildCanonFactsBlock(characterId);

  // v1.0.63 — emergence snapshot. Empty-but-structured on first session
  // (all "none yet" / "undecided" placeholders); populated as the player
  // accepts stat/skill hints and as class/theme/ancestry tallies grow.
  // Wrapped in try/catch: the snapshot is informational (rule 15b uses it
  // to lean scenes, not drive them), so a DB hiccup must never block the
  // session. On failure we log and fall through to the prompt builder's
  // "none yet" placeholder.
  let emergenceBlock = '';
  try {
    emergenceBlock = await emergenceService.buildEmergenceSnapshotBlock(characterId);
  } catch (err) {
    console.error('[prelude] emergence snapshot build failed (startSession):', err.message);
  }

  const systemPrompt = createPreludeSystemPrompt(character, setup, arcPlan, runtime, canonBlock, emergenceBlock);
  const openingPrompt = createPreludeOpeningPrompt(character, setup, arcPlan, runtime);

  // Opus for the opening — like the main DM's first session.
  const result = await claudeStartSession(systemPrompt, openingPrompt, 'opus');

  // Persist the session row. We store messages as JSON like the main DM.
  const title = `Prelude — ${character.nickname || character.first_name || character.name}`;
  const sessionConfig = {
    sessionType: 'prelude_arc',
    initialChapter: runtime.chapter,
    initialAge: runtime.age,
    session_number: 1, // Play-session ordinal; incremented by resumeSession.
    // Message-count at the start of the current play-session. Used to
    // compute exchange count for pacing nudges. Starts at 0 (fresh session).
    currentPlaySessionBaseline: 0
  };

  const info = await dbRun(
    `INSERT INTO dm_sessions (
       character_id, title, setting, tone, model, status,
       messages, start_time, session_config, session_type,
       game_start_day, game_start_year
     ) VALUES (?, ?, ?, ?, ?, 'active', ?, datetime('now'), ?, 'prelude_arc', ?, ?)`,
    [
      characterId,
      title,
      setup?.home_setting || '',
      (setup?.tone_tags || []).join(', '),
      'opus',
      JSON.stringify(result.messages),
      JSON.stringify(sessionConfig),
      1,
      1492
    ]
  );

  const sessionId = Number(info.lastInsertRowid);

  // Process any markers the opening scene emitted (rare but possible for
  // [NPC_CANON] or [LOCATION_CANON] on home establishment).
  await processMarkersForSession(characterId, sessionId, result.response);

  const refreshedCharacter = await getPreludeCharacter(characterId);
  const sessionNumber = await getSessionOrdinal(sessionId);

  return {
    sessionId,
    title,
    opening: result.response,
    messages: result.messages,
    runtime: { ...buildRuntime(refreshedCharacter), sessionNumber },
    // mode = 'sonnet' by default for a fresh session. The opening narrative
    // was already generated with Opus (hardcoded above like the main DM's
    // first session); `model` here is the mode going forward.
    model: 'sonnet',
    resolvedModel: 'sonnet',
    resolveReason: null
  };
}

/**
 * Return the active prelude session for a character, or null.
 * Used by the UI to decide whether to show "Resume" or "Begin".
 */
export async function getActiveSession(characterId) {
  const row = await dbGet(
    `SELECT id, title, status, messages, session_config, created_at, start_time
     FROM dm_sessions
     WHERE character_id = ? AND session_type = 'prelude_arc' AND status IN ('active', 'paused')
     ORDER BY id DESC LIMIT 1`,
    [characterId]
  );
  if (!row) return null;
  return {
    ...row,
    messages: safeJsonParse(row.messages, []),
    session_config: safeJsonParse(row.session_config, {})
  };
}

function safeJsonParse(raw, fallback) {
  if (!raw) return fallback;
  try { return JSON.parse(raw); } catch { return fallback; }
}

/**
 * Resume an existing prelude session. If a cliffhanger is stored on the
 * session config, the Sonnet call prepends a resume prompt so the model
 * re-orients.
 *
 * For Phase 2b-i this is mostly a read — we just hand back the message
 * history. The actual continuation happens via sendMessage.
 */
export async function getResumePayload(sessionId) {
  const session = await dbGet(
    `SELECT s.*, c.id as char_id FROM dm_sessions s
     JOIN characters c ON c.id = s.character_id
     WHERE s.id = ? AND s.session_type = 'prelude_arc'`,
    [sessionId]
  );
  if (!session) throw new Error('Prelude session not found');

  const character = await getPreludeCharacter(session.char_id);
  if (!character) throw new Error('Prelude character not found');

  const sessionNumber = await getSessionOrdinal(session.id);
  const cfg = safeJsonParse(session.session_config, {}) || {};
  return {
    sessionId: session.id,
    title: session.title,
    status: session.status,
    messages: safeJsonParse(session.messages, []),
    character,
    runtime: { ...buildRuntime(character), sessionNumber },
    lastCliffhanger: cfg.lastCliffhanger || null,
    lastSessionRecap: cfg.lastSessionRecap || null,
    model: VALID_MODES.has(cfg.model_preference) ? cfg.model_preference : 'sonnet'
  };
}

/**
 * Send a player action and get the AI's response. Processes markers on the
 * AI response and persists everything. Accepts an optional `modelOverride`
 * ('sonnet' | 'opus') that becomes the new stored preference for this and
 * future turns until the player toggles again.
 */
export async function sendMessage(sessionId, action, modelOverride = null) {
  const session = await dbGet(
    `SELECT * FROM dm_sessions WHERE id = ? AND session_type = 'prelude_arc'`,
    [sessionId]
  );
  if (!session) throw new Error('Prelude session not found');
  if (session.status === 'completed') throw new Error('Session is already completed');

  const character = await getPreludeCharacter(session.character_id);
  if (!character) throw new Error('Prelude character not found');

  const setup = character.prelude_setup_data;
  const arcPlan = await getArcPlan(session.character_id);
  const runtime = buildRuntime(character);

  // v1.0.60 — fetch the current canon-facts block. Injected into the
  // system prompt as ground truth so Sonnet checks against named details
  // (ages, relationships, traits, past events) before generating.
  const canonBlock = await canonService.buildCanonFactsBlock(session.character_id);

  // v1.0.63 — fetch the current emergence snapshot. Tells the AI which
  // stats, skills, class/theme/ancestry trajectories, and values have
  // emerged so it can lean upcoming scenes toward those strengths.
  // Wrapped in try/catch: informational only (rule 15b), so any DB
  // failure degrades to the "none yet" placeholder rather than blocking
  // the whole send path.
  let emergenceBlock = '';
  try {
    emergenceBlock = await emergenceService.buildEmergenceSnapshotBlock(session.character_id);
  } catch (err) {
    console.error('[prelude] emergence snapshot build failed (sendMessage):', err.message);
  }

  const systemPrompt = createPreludeSystemPrompt(character, setup, arcPlan, runtime, canonBlock, emergenceBlock);

  const currentMessages = safeJsonParse(session.messages, []);

  // Apply the rolling summary (if any) — compacts older messages down to a
  // synthetic summary + recent tail, keeping the prompt small. Prelude uses
  // its own summarizer template (character development / relationships)
  // via rollingSummary.buildSummaryPrompt's session_type branch.
  const applied = rollingSummary.applyToMessages(session, currentMessages);
  const nonSystemMessages = applied.messages.filter(m => m.role !== 'system');

  // Phase 3 — inject any pending cap-violation feedback from the previous
  // turn. Stored on session_config.pendingCapFeedback by the marker
  // processor when a hint was rejected. Consumed here, cleared after.
  const sessionCfg = safeJsonParse(session.session_config, {});
  const pendingCapFeedback = sessionCfg.pendingCapFeedback;

  // Play-session pacing — count messages since the current play-session
  // began, inject a [SYSTEM NOTE] when we're past the healthy length.
  // Context drift kicks in hard after ~35 exchanges; nudge at ~15, wrap
  // at ~25, force-close at ~35.
  const baseline = sessionCfg.currentPlaySessionBaseline || 0;
  const playSessionLength = Math.max(0, currentMessages.length - baseline);
  let pacingNote = null;
  if (playSessionLength >= PLAY_SESSION_FORCE_MESSAGES) {
    pacingNote = `[SYSTEM NOTE] This play-session has run ${playSessionLength} messages — well past the target length. Even with the canon ledger, extended sessions risk inconsistency. You MUST fire [SESSION_END_CLIFFHANGER: "..."] in THIS response. Pick the most natural break point you can find in the current scene — even an imperfect cliffhanger is better than continuing further.`;
  } else if (playSessionLength >= PLAY_SESSION_WRAP_MESSAGES) {
    pacingNote = `[SYSTEM NOTE] This play-session has run ${playSessionLength} messages. You should fire [SESSION_END_CLIFFHANGER: "..."] within the next 3-5 responses at the next natural break (a scene close, a stakes spike, a decision pending, a moment of suspense). Start steering toward a close but don't rush it.`;
  } else if (playSessionLength >= PLAY_SESSION_NUDGE_MESSAGES) {
    pacingNote = `[SYSTEM NOTE] This play-session has run ${playSessionLength} messages — approaching the target length (~50 exchanges). Watch for a strong cliffhanger moment over the next several scenes. Don't force an arbitrary ending; wait for the right beat — a real stakes spike, a decision pending, a scene that lands with weight. Fire [SESSION_END_CLIFFHANGER] when that beat arrives naturally.`;
  }

  const injectedMessages = [];
  if (pendingCapFeedback) {
    injectedMessages.push({
      role: 'user',
      content: `[SYSTEM NOTE] Your last response's emergence markers were partially rejected:\n${pendingCapFeedback}\n\nAcknowledge in your next narration — don't fire those capped hints again.`
    });
  }
  if (pacingNote) {
    injectedMessages.push({ role: 'user', content: pacingNote });
  }
  const augmentedMessages = injectedMessages.length > 0
    ? [...nonSystemMessages, ...injectedMessages]
    : nonSystemMessages;

  // Resolve which model to call for THIS turn. If the player passed an
  // override (toggle flip), persist it as the new mode preference. The
  // resolver inspects runtime + last-turn markers when mode == 'auto'.
  if (modelOverride && VALID_MODES.has(modelOverride) && modelOverride !== sessionCfg.model_preference) {
    sessionCfg.model_preference = modelOverride;
    // Write early so the preference survives a failed API call.
    await dbRun(
      `UPDATE dm_sessions SET session_config = ? WHERE id = ?`,
      [JSON.stringify(sessionCfg), sessionId]
    );
  }
  const resolved = resolveModel(modelOverride, sessionCfg, runtime, playSessionLength);
  const modelChoice = resolved.model;

  const result = await claudeContinueSession(
    systemPrompt,
    augmentedMessages,
    action,
    modelChoice,
    { sessionId }
  );

  // Persist the updated message history. dm_sessions doesn't have an
  // updated_at column (unlike `characters`), so we only write the messages
  // blob. Timestamp tracking can be added later if telemetry needs it.
  await dbRun(
    `UPDATE dm_sessions SET messages = ? WHERE id = ?`,
    [JSON.stringify(result.messages), sessionId]
  );

  // Fire-and-forget rolling summary. Uses the prelude-tuned summarizer
  // template (via session_type='prelude_arc' stored on the row).
  if (rollingSummary.shouldRoll(session, result.messages)) {
    rollingSummary.rollSummary(sessionId, session, result.messages).catch(err => {
      console.error(`[prelude] rolling summary failed for session ${sessionId}:`, err.message);
    });
  }

  // Process markers on the AI response
  const markerResults = await processMarkersForSession(session.character_id, sessionId, result.response);

  // If the cap-violation feedback we just injected was consumed, clear it.
  // If new violations happened this turn, queue them for next turn.
  const nextCfg = safeJsonParse((await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]))?.session_config, {});
  if (pendingCapFeedback) delete nextCfg.pendingCapFeedback;
  if (Array.isArray(markerResults.capViolations) && markerResults.capViolations.length > 0) {
    nextCfg.pendingCapFeedback = markerResults.capViolations
      .map(v => `  • ${v.kind} ${v.target}: ${v.reason}`)
      .join('\n');
  }

  // v1.0.62 — stash this turn's signals for the auto-mode resolver on the
  // NEXT turn. lastSceneWeight is null → absent when the AI didn't tag.
  // lastHpDelta is the most negative delta (worst hit) from HP_CHANGE markers.
  // lastChapterPromiseTurn reflects whether this turn fired the promise — the
  // resolution happens over the next 2-3 scenes so we leave a one-turn flag.
  if (markerResults.nextSceneWeight) {
    nextCfg.lastSceneWeight = markerResults.nextSceneWeight;
  } else {
    delete nextCfg.lastSceneWeight;
  }
  if (typeof markerResults.hpDelta === 'number') {
    nextCfg.lastHpDelta = markerResults.hpDelta;
  } else {
    delete nextCfg.lastHpDelta;
  }
  nextCfg.lastChapterPromiseTurn = !!markerResults.chapterPromise;

  // v1.0.66 — track consecutive soft-triggered Opus turns so the cap in
  // pickAutoModel() can force a Sonnet cooldown turn. Resets on any Sonnet
  // turn OR on a hard-triggered Opus turn (chapter-4 / session-wrap — those
  // are user-directed long-Opus states, not candidates for cooldown).
  if (resolved.mode === 'auto' && resolved.model === 'opus' && resolved.reason !== 'chapter-4' && resolved.reason !== 'session-wrap') {
    nextCfg.consecutiveSoftOpusTurns = (nextCfg.consecutiveSoftOpusTurns || 0) + 1;
  } else {
    nextCfg.consecutiveSoftOpusTurns = 0;
  }

  await dbRun(
    `UPDATE dm_sessions SET session_config = ? WHERE id = ?`,
    [JSON.stringify(nextCfg), sessionId]
  );

  // Handle session-ending cliffhangers specially — save the cliffhanger on
  // session_config, generate a narrative recap for the player, and flip
  // status to 'paused'. Recap is a 1-2 paragraph Sonnet-written summary
  // that appears in the paused banner so the player has a memory aid
  // between play-sessions.
  if (markerResults.cliffhanger) {
    const sessionConfig = safeJsonParse(session.session_config, {});
    sessionConfig.lastCliffhanger = markerResults.cliffhanger;

    // Build a recap from the current session's transcript. Uses Sonnet
    // (cheaper/faster than Opus for summarization) with a tuned prompt.
    // Also pass this session's accepted emergences (stats/skills accepted
    // mid-session) so the recap can mention them naturally.
    let recap = null;
    try {
      const acceptedThisSession = await emergenceService.getAcceptedEmergences(
        session.character_id,
        sessionId
      );
      recap = await generateSessionRecap(character, result.messages, {
        sessionNumber: (sessionConfig.session_number || 1),
        chapter: runtime.chapter,
        age: runtime.age,
        acceptedEmergences: acceptedThisSession
      });
      sessionConfig.lastSessionRecap = recap;
    } catch (e) {
      console.error('[prelude] session recap generation failed:', e.message);
    }

    await dbRun(
      `UPDATE dm_sessions SET session_config = ?, status = 'paused' WHERE id = ?`,
      [JSON.stringify(sessionConfig), sessionId]
    );

    // Attach recap to markerResults so the route returns it alongside
    // the cliffhanger for the UI.
    if (recap) markerResults.sessionRecap = recap;
  }

  const updatedCharacter = await getPreludeCharacter(session.character_id);
  const sessionNumber = await getSessionOrdinal(sessionId);

  return {
    response: result.response,
    messages: result.messages,
    markers: markerResults,
    runtime: { ...buildRuntime(updatedCharacter), sessionNumber },
    sessionEnded: !!markerResults.cliffhanger,
    // mode = what the player has selected ('auto' | 'sonnet' | 'opus').
    // resolvedModel = what we actually called ('sonnet' | 'opus').
    // resolveReason = why auto picked what it picked (or null).
    model: resolved.mode,
    resolvedModel: resolved.model,
    resolveReason: resolved.reason
  };
}

/**
 * End a prelude session. `reason` is informational; status flips to
 * 'paused' by default (so the player can come back) or 'completed' if
 * explicitly requested (Phase 5 transition will use this).
 */
export async function endSession(sessionId, { completed = false } = {}) {
  const session = await dbGet(
    `SELECT id, status FROM dm_sessions WHERE id = ? AND session_type = 'prelude_arc'`,
    [sessionId]
  );
  if (!session) throw new Error('Prelude session not found');

  const newStatus = completed ? 'completed' : 'paused';
  await dbRun(
    `UPDATE dm_sessions SET status = ?, end_time = datetime('now') WHERE id = ?`,
    [newStatus, sessionId]
  );
  return { sessionId, status: newStatus };
}

/**
 * Resume a paused session. Flips status back to 'active' so sendMessage is
 * allowed again. A no-op if the session is already active.
 *
 * Paused sessions can result from:
 *   - Player clicking "End session" in the UI
 *   - A [SESSION_END_CLIFFHANGER] marker firing (natural break)
 * Either way, resuming is how the player picks back up.
 */
export async function resumeSession(sessionId) {
  const session = await dbGet(
    `SELECT id, status, session_config, messages FROM dm_sessions WHERE id = ? AND session_type = 'prelude_arc'`,
    [sessionId]
  );
  if (!session) throw new Error('Prelude session not found');
  if (session.status === 'completed') {
    throw new Error('Cannot resume a completed session — start a new one');
  }
  if (session.status === 'active') return { sessionId, status: 'active' };

  // Increment the play-session ordinal. Resuming after a pause means we're
  // starting the NEXT play-session (session 1 → 2 → 3 …).
  const cfg = safeJsonParse(session.session_config, {});
  cfg.session_number = (cfg.session_number || 1) + 1;

  // Reset the play-session message baseline. Pacing nudges only count
  // messages from this point forward so each play-session gets its own
  // natural length budget.
  const currentMessages = safeJsonParse(session.messages, []);
  cfg.currentPlaySessionBaseline = currentMessages.length;

  await dbRun(
    `UPDATE dm_sessions SET status = 'active', session_config = ? WHERE id = ?`,
    [JSON.stringify(cfg), sessionId]
  );
  return { sessionId, status: 'active', sessionNumber: cfg.session_number };
}

// ---------------------------------------------------------------------------
// Marker processing — applies detected markers to the DB.
// ---------------------------------------------------------------------------

/**
 * Detect and apply markers from an AI response. Returns a summary of what
 * was processed so the UI can update (toasts, indicator changes, etc.).
 */
async function processMarkersForSession(characterId, sessionId, aiResponse) {
  const detected = detectPreludeMarkers(aiResponse);
  const results = {
    ageAdvanced: null,
    chapterAdvanced: null,
    chapterEndSummary: null,
    cliffhanger: null,
    npcsCreated: [],
    locationsCreated: [],
    hpDelta: 0,
    hpAfter: null,
    hpReasons: [],
    chapterPromise: null,
    canonFactsAdded: [],
    canonFactsRetired: [],
    // v1.0.62 — AI's forward-looking weight hint for the Auto model-picker
    nextSceneWeight: detected.nextSceneWeight || null
  };

  // AGE_ADVANCE — update character's age and (if threshold crossed) chapter.
  // When chapter advances, max_hp grows per the age-scaled formula and
  // current_hp scales proportionally. A character at full HP stays at
  // full HP (100%) — a character at half stays at roughly half.
  if (detected.ageAdvance && detected.ageAdvance.years > 0) {
    const character = await getPreludeCharacter(characterId);
    if (character) {
      const newAge = (character.prelude_age || 0) + detected.ageAdvance.years;
      const oldChapter = character.prelude_chapter || 1;
      const newChapter = computeChapterForAge(character.race, newAge, oldChapter);

      const updates = [`prelude_age = ?`, `prelude_chapter = ?`];
      const args = [newAge, newChapter];

      if (newChapter !== oldChapter) {
        // Chapter advanced — recompute max_hp and scale current_hp to maintain
        // the fraction of max the character was at.
        const oldMax = computeMaxHp(oldChapter, 0);
        const newMax = computeMaxHp(newChapter, 0);
        const oldCurrent = character.current_hp != null ? character.current_hp : oldMax;
        const fraction = oldMax > 0 ? oldCurrent / oldMax : 1;
        const newCurrent = Math.max(1, Math.round(newMax * fraction));
        updates.push(`max_hp = ?`, `current_hp = ?`);
        args.push(newMax, newCurrent);
      }

      args.push(characterId);
      await dbRun(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`, args);
      results.ageAdvanced = { from: character.prelude_age, to: newAge, years: detected.ageAdvance.years };
      if (newChapter !== oldChapter) {
        results.chapterAdvanced = { from: oldChapter, to: newChapter };
      }
    }
  }

  // CHAPTER_END — persist the summary (UI can show it; Phase 3 may pipe
  // into rolling summaries)
  if (detected.chapterEnd && detected.chapterEnd.summary) {
    results.chapterEndSummary = detected.chapterEnd.summary;
  }

  // SESSION_END_CLIFFHANGER — passed back to caller for status flip
  if (detected.cliffhanger) {
    results.cliffhanger = detected.cliffhanger;
  }

  // NPC_CANON — insert, dedupe on name per character
  for (const npc of (detected.npcCanons || [])) {
    if (!npc.name) continue;
    const existing = await dbGet(
      `SELECT id FROM prelude_canon_npcs WHERE character_id = ? AND name = ?`,
      [characterId, npc.name]
    );
    if (existing) continue;
    await dbRun(
      `INSERT INTO prelude_canon_npcs
         (character_id, name, relationship, status, first_appeared_age, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        characterId,
        npc.name,
        npc.relationship || null,
        npc.status || 'alive',
        (await getPreludeCharacter(characterId))?.prelude_age || null,
        null
      ]
    );
    results.npcsCreated.push(npc);
  }

  // LOCATION_CANON — insert, dedupe on name per character
  for (const loc of (detected.locationCanons || [])) {
    if (!loc.name) continue;
    const existing = await dbGet(
      `SELECT id FROM prelude_canon_locations WHERE character_id = ? AND name = ?`,
      [characterId, loc.name]
    );
    if (existing) continue;
    await dbRun(
      `INSERT INTO prelude_canon_locations
         (character_id, name, type, is_home, description)
       VALUES (?, ?, ?, ?, ?)`,
      [
        characterId,
        loc.name,
        loc.type || null,
        loc.is_home ? 1 : 0,
        null
      ]
    );
    results.locationsCreated.push(loc);
  }

  // HP_CHANGE — apply deltas to the character's current_hp, clamped
  // between 0 and max_hp. Accumulate for the turn so we can report a
  // single net change to the UI.
  if (Array.isArray(detected.hpChanges) && detected.hpChanges.length > 0) {
    const character = await getPreludeCharacter(characterId);
    if (character) {
      const max = character.max_hp || 1;
      let hp = character.current_hp ?? max;
      let totalDelta = 0;
      for (const change of detected.hpChanges) {
        hp = Math.max(0, Math.min(max, hp + change.delta));
        totalDelta += change.delta;
        if (change.reason) results.hpReasons.push(change.reason);
      }
      await dbRun(
        `UPDATE characters SET current_hp = ? WHERE id = ?`,
        [hp, characterId]
      );
      results.hpDelta = totalDelta;
      results.hpAfter = hp;
    }
  }

  // CHAPTER_PROMISE — surface to the UI so it can render as an opening
  // beat in the message feed. Server-side: no persistence needed for
  // Phase 2b-ii; the marker is informational for the UI. Future phases
  // may store chapter promises for retrospective review.
  if (detected.chapterPromise) {
    results.chapterPromise = detected.chapterPromise;
  }

  // v1.0.60 — canon facts. Retire first, then record new ones. Order
  // matters: if Sonnet retires "age 9" in the same response where it
  // records "age 12", we want the retire to run first so the new one
  // lands cleanly (and so a same-turn CANON_FACT that happens to match
  // the retire pattern doesn't get immediately retired).
  const character = await getPreludeCharacter(characterId);
  const establishedAge = character?.prelude_age || null;

  const retiredFacts = [];
  for (const r of (detected.canonFactRetires || [])) {
    const retired = await canonService.retireCanonFacts(characterId, {
      subject: r.subject,
      factContains: r.factContains
    });
    if (retired.length > 0) retiredFacts.push(...retired);
  }

  const newFacts = [];
  for (const f of (detected.canonFacts || [])) {
    try {
      const res = await canonService.recordCanonFact(characterId, {
        subject: f.subject,
        category: f.category,
        fact: f.fact,
        establishedAge,
        sessionId
      });
      if (res.status === 'inserted') newFacts.push(res);
    } catch (err) {
      console.error('[prelude] canon fact insert failed:', err.message);
    }
  }
  results.canonFactsAdded = newFacts;
  results.canonFactsRetired = retiredFacts;

  // Phase 3 — emergence markers
  const chapter = character?.prelude_chapter || 1;
  const emergenceCtx = { chapter, sessionId };

  const offeredEmergences = [];
  const capViolations = [];

  for (const hint of (detected.statHints || [])) {
    const res = await emergenceService.recordStatHint(characterId, { ...hint, ...emergenceCtx });
    if (res.status === 'offered') offeredEmergences.push({ ...res, kind: 'stat' });
    else capViolations.push({ kind: 'stat', target: hint.stat, reason: res.reason });
  }
  for (const hint of (detected.skillHints || [])) {
    const res = await emergenceService.recordSkillHint(characterId, { ...hint, ...emergenceCtx });
    if (res.status === 'offered') offeredEmergences.push({ ...res, kind: 'skill' });
    else capViolations.push({ kind: 'skill', target: hint.skill, reason: res.reason });
  }
  for (const hint of (detected.classHints || [])) {
    await emergenceService.recordClassHint(characterId, { ...hint, ...emergenceCtx });
  }
  for (const hint of (detected.themeHints || [])) {
    await emergenceService.recordThemeHint(characterId, { ...hint, ...emergenceCtx });
  }
  for (const hint of (detected.ancestryHints || [])) {
    await emergenceService.recordAncestryHint(characterId, { ...hint, ...emergenceCtx });
  }
  for (const hint of (detected.valueHints || [])) {
    await emergenceService.recordValueHint(characterId, { ...hint, ...emergenceCtx });
  }

  results.offeredEmergences = offeredEmergences;
  results.capViolations = capViolations;

  return results;
}

/**
 * Generate a 1-2 paragraph narrative recap of the just-ended play-session.
 * Sonnet-powered; uses the session's message history. Called at session
 * pause (cliffhanger fire) so the player has a memory aid when they come
 * back for the next session — "what happened last time."
 *
 * The recap is in SECOND PERSON (matching the session narration) and
 * focuses on the character-shaping moments of the session, not mechanics.
 * No marker emissions, no instructions, no metacommentary — pure recap.
 */
async function generateSessionRecap(character, messages, opts = {}) {
  const { sessionNumber = 1, chapter = 1, age = 0, acceptedEmergences = [] } = opts;
  const playerName = character.nickname || character.first_name || character.name;

  // Strip system messages and compact to user/assistant exchanges
  const transcript = messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'PLAYER' : 'DM'}: ${m.content}`)
    .join('\n\n');

  // Phase 3 — if the player accepted any emergences this session, let
  // Sonnet weave them in naturally. "You found you had a knack for X."
  const emergenceLines = acceptedEmergences
    .filter(e => e.kind === 'stat' || e.kind === 'skill')
    .map(e => {
      if (e.kind === 'stat') return `  • ${e.target.toUpperCase()} +${e.magnitude}${e.reason ? ` — "${e.reason}"` : ''}`;
      if (e.kind === 'skill') return `  • Skill: ${e.target.replace(/_/g, ' ')}${e.reason ? ` — "${e.reason}"` : ''}`;
      return null;
    })
    .filter(Boolean);
  const emergenceBlock = emergenceLines.length > 0
    ? `\n\nThe player accepted these mechanical emergences this session — weave them into the recap naturally (don't list them mechanically):\n${emergenceLines.join('\n')}`
    : '';

  const systemPrompt = `You are writing a concise narrative recap for a just-ended play-session of a D&D prelude arc. The player will read this when they come back to start the next session. Your job: remind them what happened, in a way that helps them pick up where they left off.

RULES:
- 1-2 paragraphs. Tight. 4-8 sentences total.
- SECOND PERSON ("you"). Match the session's narrative voice.
- Focus on character-shaping moments: decisions made, people met, relationships shifted, stakes raised.
- Do NOT recap every beat blow-by-blow. Pick the 2-4 most important moments.
- Do NOT include metacommentary ("this session featured…"). Just narrate what happened.
- Do NOT reveal DM-side information (seeded beats, arc plan contents, DCs).
- Do NOT emit any markers. No brackets. Pure prose.
- Open in media res (no "In this session, you…"). Just tell what happened.
- Name key NPCs by name. Use tone that matches the session's tone.
- If emergences were accepted, weave them into prose naturally — "the running and climbing have made you quicker" — don't list them like a report.

This is Session ${sessionNumber} of ~7-10 · Chapter ${chapter} of 4 · ${playerName} is ${age} years old.`;

  const userPrompt = `Here is the session transcript. Write the recap now.

${transcript}${emergenceBlock}

Output ONLY the recap prose. No preamble, no signoff.`;

  const raw = await chat(systemPrompt, [{ role: 'user', content: userPrompt }], 3, 'sonnet', 800, true);
  return String(raw || '').trim();
}

/**
 * Given a character's race, their new age, and current chapter, decide
 * whether a chapter boundary has been crossed. Returns the new chapter.
 */
function computeChapterForAge(race, age, currentChapter) {
  // Race-aware thresholds — kept flat rather than parsing the RACE_CHAPTER_AGES
  // strings so we can just check numeric bands per race.
  const key = String(race || '').toLowerCase();
  const THRESHOLDS = {
    human:      [9, 13, 17],
    halfling:   [9, 15, 19],
    'half-elf': [11, 17, 23],
    'half-orc': [7, 11, 14],
    tiefling:   [9, 13, 17],
    aasimar:    [9, 13, 17],
    dragonborn: [4, 8, 12],
    dwarf:      [25, 40, 50],
    elf:        [50, 80, 100],
    gnome:      [20, 35, 50],
    warforged:  [2, 4, 6]  // years post-activation
  };
  const t = THRESHOLDS[key] || THRESHOLDS.human;
  let ch = currentChapter || 1;
  if (age >= t[0] && ch < 2) ch = 2;
  if (age >= t[1] && ch < 3) ch = 3;
  if (age >= t[2] && ch < 4) ch = 4;
  return ch;
}
