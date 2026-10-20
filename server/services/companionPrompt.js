/**
 * companionPrompt.js — DM-ONLY prompt blocks for the Companion Engine.
 *
 * Three-role separation: companion blocks are distinct from the DM/world block
 * and the NPC blocks. Everything built here is private to the DM. The player
 * NEVER sees these fields — not the goals, not the private knowledge, not the
 * relationship trackers, not the agenda tier.
 *
 * Two builders:
 *  buildCompanionPromptBlock(companion, opts) — the standing per-companion
 *    block: who they are to the DM, what they're doing, what they privately
 *    know, how they feel about the PC, and the behavioral rules (R20/R22/R14/R1).
 *  buildCompanionBeatSection(beats) — the per-exchange beat list: which
 *    companions act now and on what focus, from assessReadiness triage.
 */

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

/**
 * @param {object} companion  DB row (companions), optionally with joined npc fields.
 * @param {object} opts { agendaBlock?: string } pre-built DM-only agenda block
 *   from npcComplexityService.buildAgendaPromptBlock, if available.
 */
export function buildCompanionPromptBlock(companion, opts = {}) {
  const name = companion.name || 'companion';
  const lines = [];
  lines.push(`### COMPANION (DM-ONLY): ${name}`);
  lines.push(`This block is private to the DM. The player never sees it.`);

  const personalityBits = [
    companion.personality,
    companion.class ? `Class: ${companion.class}` : null,
    companion.alignment ? `Alignment: ${companion.alignment} (PRIVATE)` : null,
  ].filter(Boolean);
  if (personalityBits.length) lines.push(`Character: ${personalityBits.join(' | ')}`);

  const goals = parseJson(companion.personal_goals, []) || [];
  if (goals.length) {
    lines.push(
      `Private goals: ${goals.map((g) => `${g.goal} [${g.priority || 'medium'}]`).join('; ')}`
    );
  }

  const task = parseJson(companion.current_task, null);
  if (task && task.status === 'active') {
    lines.push(`Current task (HOLDING): "${task.description}" — keep them on it until the situation changes or the PC redirects. If task-relevant events occur, they react on their own; the player does not need to ask.`);
  }

  const knows = parseJson(companion.what_they_know, []) || [];
  const priv = knows.filter((k) => !k.known_to_pc);
  if (priv.length) {
    lines.push(`Knows that the PC does NOT know (${priv.length}):`);
    for (const k of priv) lines.push(`  - ${k.fact}`);
    lines.push(`Reveal only through behavior, when this character would choose to. They may withhold, mislead, or refuse — from their own motives.`);
  }

  const rel = parseJson(companion.relationship_to_pc, null);
  if (rel) {
    lines.push(
      `Relationship to PC (tracked, NEVER narrated): trust ${rel.trust ?? 50} / respect ${rel.respect ?? 50} / friction ${rel.friction ?? 0}`
    );
  }

  if (opts.agendaBlock) {
    lines.push(opts.agendaBlock);
  }

  lines.push(
    `Behavioral rules: Act on your own turn from your own character — do not wait for orders. ` +
      `The player may set an objective ("flank", "watch the perimeter") but never dictates how you do it or the outcome. ` +
      `If you are the expert in the room, you notice first. ` +
      `Never echo the player's phrasing. Never summarize your own feelings — speak and act; let the player read you.`
  );

  return lines.join('\n');
}

/**
 * @param {Array<{companionId, name, readiness}>} beats from buildCompanionBeats()
 * Per-exchange section. Only companions with a trigger get a beat.
 */
export function buildCompanionBeatSection(beats) {
  const lines = [];
  lines.push(`### COMPANION BEATS — THIS EXCHANGE (DM-ONLY)`);
  lines.push(
    `After world narration, give a beat to each companion listed below as their readiness warrants. ` +
      `High: act now, in their voice, from their judgment. ` +
      `Medium: a beat if it fits the flow. Low: only if natural. ` +
      `Not listed: no beat this exchange.`
  );
  const active = (beats || []).filter((b) => b.readiness && b.readiness.shouldAct);
  if (!active.length) {
    lines.push(`No companion beats this exchange.`);
    return lines.join('\n');
  }
  const order = { high: 0, medium: 1, low: 2 };
  active
    .sort((a, b) => (order[a.readiness.priority] ?? 3) - (order[b.readiness.priority] ?? 3))
    .forEach((b) => {
      lines.push(
        `- ${b.name} — ${String(b.readiness.priority).toUpperCase()} — focus: ${b.readiness.focus} — ${b.readiness.reason}`
      );
    });
  return lines.join('\n');
}
