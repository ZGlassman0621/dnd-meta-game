/**
 * companionInitiativeService.js — Companion Engine (DM System Part 2)
 *
 * Companions are characters, not tools. This service gives the DM the
 * structured state it needs to run each companion as an autonomous agent:
 * what they're doing (task-holding), what they know (opacity), how they feel
 * about the PC (relationship), and whether this moment calls for them to act
 * (readiness assessment).
 *
 * The AI narrates; this service triages. No LLM calls here except where
 * explicitly dependency-injected (recruitment enrichment).
 *
 * Playbook rules implemented:
 *  R1  passive expertise — the expert notices first, unprompted
 *  R14 task-holding — a companion keeps their job until it changes
 *  R20 characters not tools — readiness is assessed from the companion's
 *      character, never from player orders
 *  R22 opacity — private knowledge stays private until the character reveals it
 *
 * Reuses the NPC complexity system for hidden-agenda rolls — nothing duplicated.
 */

import { dbGet, dbRun, dbAll } from '../database.js';
import { rollCompanionAgenda } from './npcComplexityService.js';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

const toJson = (v) => (v == null ? null : JSON.stringify(v));
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, Number(n) || 0));

function textMatches(haystack, keywords) {
  const h = (haystack || '').toLowerCase();
  return (keywords || []).some((k) => k && h.includes(String(k).toLowerCase()));
}

// ---------------------------------------------------------------------------
// Task holding (R14)
//
// A companion keeps their job until the situation changes or the PC redirects.
// current_task JSON:
//   { description, assigned_by, assigned_day, status: 'active'|'done'|'dropped'|'interrupted' }
// ---------------------------------------------------------------------------

/**
 * Assign a task to a companion. Overwrites any previous task.
 * @param {number} companionId
 * @param {object} task { description, assignedBy?, assignedDay? }
 */
export async function setCompanionTask(companionId, task) {
  const record = {
    description: task.description,
    assigned_by: task.assignedBy || task.assigned_by || 'pc',
    assigned_day: task.assignedDay ?? task.assigned_day ?? null,
    status: 'active',
  };
  await dbRun(`UPDATE companions SET current_task = ? WHERE id = ?`, [
    toJson(record),
    companionId,
  ]);
  return record;
}

/** @returns {object|null} the companion's current task, parsed, or null. */
export async function getCompanionTask(companionId) {
  const row = await dbGet(`SELECT current_task FROM companions WHERE id = ?`, [companionId]);
  if (!row) return null;
  return parseJson(row.current_task, null);
}

/**
 * Close out a companion's task. The record is kept (status != active) so the
 * DM can reference what they were doing.
 */
export async function clearCompanionTask(companionId, outcome = 'done') {
  const task = await getCompanionTask(companionId);
  if (!task) return null;
  task.status = outcome; // 'done' | 'dropped' | 'interrupted'
  await dbRun(`UPDATE companions SET current_task = ? WHERE id = ?`, [
    toJson(task),
    companionId,
  ]);
  return task;
}

/** @returns {Array} companions currently holding an active task. */
export async function getCompanionsWithTasks() {
  // Companions have no name column — names live on npcs (via npc_id).
  const rows = await dbAll(
    `SELECT c.id, c.current_task, n.name AS name
       FROM companions c
       LEFT JOIN npcs n ON n.id = c.npc_id
      WHERE c.current_task IS NOT NULL`
  );
  return rows
    .map((r) => ({ id: r.id, name: r.name, task: parseJson(r.current_task, null) }))
    .filter((r) => r.task && r.task.status === 'active');
}

// ---------------------------------------------------------------------------
// Readiness / initiative
//
// Deterministic triage: SHOULD this companion act this exchange, and on what
// focus? The AI decides HOW; this decides WHETHER. Priority order:
//   1. addressed directly      -> high  (they respond as themselves, R20)
//   2. task-relevant stimulus   -> high  (they react on their own, R14)
//   3. passive expertise        -> medium (the expert notices first, R1)
//   4. personal goal intersects -> medium
//   5. holds relevant private knowledge -> low (reveal or withhold per character, R22)
//
// scene = {
//   description:   string  what is happening right now
//   addressedTo:   id|null companion the PC/NPC just spoke to
//   newStimulus:   string|null  something changed ("movement on the treeline")
//   stimulusDomain:string|null  task-domain keyword ("perimeter")
//   sceneDc:       { skill, value }|null
//   pcPassive:     number|null   the PC's passive for that skill, if known
// }
// ---------------------------------------------------------------------------

function companionPassive(companion, skill) {
  if (!skill) return null;
  const direct = companion[`passive_${skill}`];
  if (typeof direct === 'number') return direct;
  const bonus = companion[`${skill}_bonus`];
  if (typeof bonus === 'number') return 10 + bonus;
  return null;
}

export function assessReadiness(companion, scene = {}) {
  const name = companion.name || 'companion';
  const task = parseJson(companion.current_task, null);
  const goals = parseJson(companion.personal_goals, []) || [];
  const knows = parseJson(companion.what_they_know, []) || [];

  // 1. Directly addressed — always gets a beat.
  if (scene.addressedTo != null && String(scene.addressedTo) === String(companion.id)) {
    return {
      shouldAct: true,
      priority: 'high',
      focus: 'respond',
      reason: `${name} was addressed directly`,
    };
  }

  // 2. Task-relevant stimulus — the companion reacts without being asked.
  if (task && task.status === 'active' && scene.newStimulus) {
    const domain = scene.stimulusDomain || '';
    if (domain && textMatches(task.description, [domain])) {
      return {
        shouldAct: true,
        priority: 'high',
        focus: 'task',
        reason: `${name}'s task ("${task.description}") triggered by: ${scene.newStimulus}`,
      };
    }
  }

  // 3. Passive expertise — the expert notices first.
  const dc = scene.sceneDc;
  if (dc && typeof dc.value === 'number') {
    const passive = companionPassive(companion, dc.skill);
    if (passive != null && passive >= dc.value) {
      const pcPassive = scene.pcPassive;
      if (pcPassive == null || pcPassive < dc.value) {
        return {
          shouldAct: true,
          priority: 'medium',
          focus: 'notice',
          reason:
            `${name} notices first ` +
            `(passive ${passive} vs DC ${dc.value}; PC passive ${pcPassive ?? 'n/a'})`,
        };
      }
    }
  }

  // 4. Personal goal intersects the scene.
  for (const g of goals) {
    const kws = g.keywords || (g.goal ? [g.goal] : []);
    if (textMatches(scene.description, kws)) {
      return {
        shouldAct: true,
        priority: 'medium',
        focus: 'goal',
        reason: `${name}'s personal goal is relevant: "${g.goal}"`,
      };
    }
  }

  // 5. Holds private knowledge relevant here. Flag relevance only — the AI
  //    decides whether this character reveals or withholds (R22).
  for (const k of knows) {
    if (k.known_to_pc) continue;
    if (textMatches(scene.description, k.keywords || [])) {
      return {
        shouldAct: true,
        priority: 'low',
        focus: 'withhold-or-reveal',
        reason: `${name} holds private knowledge relevant here (reveal or withhold per character)`,
      };
    }
  }

  return { shouldAct: false, priority: 'none', focus: null, reason: 'no trigger this exchange' };
}

/**
 * Assess every companion in the scene at once.
 * @returns {Array<{companionId, name, readiness}>}
 */
export function buildCompanionBeats(companions, scene = {}) {
  return (companions || []).map((c) => ({
    companionId: c.id,
    name: c.name,
    readiness: assessReadiness(c, scene),
  }));
}

// ---------------------------------------------------------------------------
// Knowledge & opacity (R22, playbook R3)
//
// what_they_know JSON: [{ id, fact, known_to_pc, keywords }]
// The companion knows things the PC doesn't. The DM sees all of it; the
// player learns it only through play.
// ---------------------------------------------------------------------------

let factSeq = 0;
function newFactId() {
  factSeq += 1;
  return `ck_${Date.now().toString(36)}_${factSeq}`;
}

export async function addCompanionKnowledge(companionId, fact, opts = {}) {
  const row = await dbGet(`SELECT what_they_know FROM companions WHERE id = ?`, [companionId]);
  const knows = parseJson(row?.what_they_know, []) || [];
  const entry = {
    id: opts.id || newFactId(),
    fact,
    known_to_pc: !!opts.knownToPc,
    keywords: opts.keywords || [],
  };
  knows.push(entry);
  await dbRun(`UPDATE companions SET what_they_know = ? WHERE id = ?`, [
    toJson(knows),
    companionId,
  ]);
  return entry;
}

export async function getCompanionKnowledge(companionId, { privateOnly = false } = {}) {
  const row = await dbGet(`SELECT what_they_know FROM companions WHERE id = ?`, [companionId]);
  const knows = parseJson(row?.what_they_know, []) || [];
  return privateOnly ? knows.filter((k) => !k.known_to_pc) : knows;
}

/** Mark a private fact as now known to the PC (revealed through play). */
export async function revealKnowledgeToPc(companionId, factId) {
  const row = await dbGet(`SELECT what_they_know FROM companions WHERE id = ?`, [companionId]);
  const knows = parseJson(row?.what_they_know, []) || [];
  const entry = knows.find((k) => k.id === factId);
  if (!entry) return null;
  entry.known_to_pc = true;
  await dbRun(`UPDATE companions SET what_they_know = ? WHERE id = ?`, [
    toJson(knows),
    companionId,
  ]);
  return entry;
}

// ---------------------------------------------------------------------------
// Personal goals — what the companion wants beyond the party's mission.
// ---------------------------------------------------------------------------

export async function setPersonalGoals(companionId, goals) {
  const norm = (goals || []).map((g) =>
    typeof g === 'string' ? { goal: g, priority: 'medium', keywords: [] } : g
  );
  await dbRun(`UPDATE companions SET personal_goals = ? WHERE id = ?`, [
    toJson(norm),
    companionId,
  ]);
  return norm;
}

export async function getPersonalGoals(companionId) {
  const row = await dbGet(`SELECT personal_goals FROM companions WHERE id = ?`, [companionId]);
  return parseJson(row?.personal_goals, []) || [];
}

// ---------------------------------------------------------------------------
// Relationship to PC — trust / respect / friction, 0..100.
// Tracked, never narrated (playbook SS2: show, don't tell).
// ---------------------------------------------------------------------------

const DEFAULT_RELATIONSHIP = { trust: 50, respect: 50, friction: 0 };

export async function getRelationship(companionId) {
  const row = await dbGet(`SELECT relationship_to_pc FROM companions WHERE id = ?`, [
    companionId,
  ]);
  return { ...DEFAULT_RELATIONSHIP, ...(parseJson(row?.relationship_to_pc, {}) || {}) };
}

export async function updateRelationship(companionId, deltas = {}) {
  const rel = await getRelationship(companionId);
  for (const k of ['trust', 'respect', 'friction']) {
    if (deltas[k] != null) rel[k] = clamp(rel[k] + deltas[k], 0, 100);
  }
  await dbRun(`UPDATE companions SET relationship_to_pc = ? WHERE id = ?`, [
    toJson(rel),
    companionId,
  ]);
  return rel;
}

// ---------------------------------------------------------------------------
// Recruitment enrichment
//
// A new companion enters with:
//  1. a rolled hidden agenda (mechanical, via npcComplexityService — the
//     20/60/20 tier the SYSTEM rolled, content invented by the LLM only when
//     the tier needs it; surface tier needs no LLM at all),
//  2. a seeded relationship,
//  3. personal goals,
//  4. at least one thing they know that the PC doesn't (R22).
//
// If no llmCall is available and the rolled tier needs agenda content, the
// agenda is marked deferred — the session-load backfill (ensureComplexityTier
// / ensureAgendaContent on the companion's npcs row) completes it on next
// appearance. Recruitment never hard-fails for lack of an LLM.
// ---------------------------------------------------------------------------

const DEFAULT_SEED_FACT = 'Unspoken history — has not shared their past yet.';

async function llmSeedFact(llmCall, background) {
  try {
    const raw = await llmCall(
      `One secret or piece of personal history for a D&D companion ` +
        `(background: ${background || 'unknown'}) that they have NOT told the player ` +
        `character. One sentence. Return JSON only: {"fact":"...","keywords":["..."]}`
    );
    const parsed = JSON.parse(raw);
    return parsed.fact || DEFAULT_SEED_FACT;
  } catch {
    return DEFAULT_SEED_FACT;
  }
}

export async function enrichNewCompanion(companionId, opts = {}) {
  const { llmCall = null, background = '', seedFact = null } = opts;

  // 1. Hidden agenda roll — mechanical.
  let agenda;
  try {
    agenda = await rollCompanionAgenda(companionId, llmCall);
  } catch (e) {
    // Non-surface tier rolled (and persisted by rollCompanionAgenda) but no
    // LLM to invent the content: defer the content. The tier is already set;
    // ensureAgendaContent on next appearance completes it.
    agenda = { deferred: true, error: String((e && e.message) || e) };
  }

  // 2. Seed relationship at neutral-with-history.
  const relationship = await updateRelationship(companionId, {});

  // 3. Personal goals.
  let goals;
  if (llmCall) {
    try {
      const raw = await llmCall(
        `Generate 2-3 personal goals for a new D&D companion with this background: ` +
          `${background || 'unknown'}. Return JSON only: ` +
          `{"goals":[{"goal":"...","priority":"high|medium|low","keywords":["..."]}]}`
      );
      goals = JSON.parse(raw).goals || [];
    } catch {
      goals = [];
    }
    if (!goals.length) {
      goals = [{ goal: 'Prove themselves to the party', priority: 'medium', keywords: [] }];
    }
  } else {
    goals = [{ goal: 'Prove themselves to the party', priority: 'medium', keywords: [] }];
  }
  await setPersonalGoals(companionId, goals);

  // 4. At least one private fact the PC doesn't know.
  const fact =
    seedFact || (llmCall ? await llmSeedFact(llmCall, background) : DEFAULT_SEED_FACT);
  const seedKnowledge = await addCompanionKnowledge(companionId, fact, { knownToPc: false });

  return { companionId, agenda, relationship, goals, seedKnowledge };
}
