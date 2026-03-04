import { dbAll, dbGet, dbRun } from '../database.js';
import { PROJECT_TYPES } from '../config/partyBaseConfig.js';

/**
 * Long-Term Project Service
 * Blades in the Dark-style clock system for multi-session progress tracking.
 * Projects have segmented clocks (4/6/8/12) that fill via downtime skill checks.
 */

const MAX_ACTIVE_PROJECTS = 3;
const VALID_STATUSES = ['active', 'completed', 'abandoned'];

// ============================================================
// CRUD
// ============================================================

export async function getProjects(characterId, campaignId) {
  return dbAll(`
    SELECT * FROM long_term_projects
    WHERE character_id = ? AND campaign_id = ?
    ORDER BY
      CASE status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 ELSE 2 END,
      created_at DESC
  `, [characterId, campaignId]);
}

export async function getActiveProjects(characterId, campaignId) {
  return dbAll(`
    SELECT * FROM long_term_projects
    WHERE character_id = ? AND campaign_id = ? AND status = 'active'
    ORDER BY created_at ASC
  `, [characterId, campaignId]);
}

export async function getProjectById(projectId) {
  return dbGet('SELECT * FROM long_term_projects WHERE id = ?', [projectId]);
}

export async function createProject(characterId, campaignId, data) {
  const { name, description, project_type, total_segments, skill_used, dc, rewards, started_game_day } = data;

  if (!name || !project_type) {
    throw new Error('Project name and type are required');
  }
  if (!PROJECT_TYPES[project_type]) {
    throw new Error(`Invalid project type: ${project_type}`);
  }

  // Check active project limit
  const active = await getActiveProjects(characterId, campaignId);
  if (active.length >= MAX_ACTIVE_PROJECTS) {
    throw new Error(`Maximum ${MAX_ACTIVE_PROJECTS} active projects allowed`);
  }

  const segments = total_segments || PROJECT_TYPES[project_type].defaultSegments;
  const difficulty = dc || PROJECT_TYPES[project_type].defaultDC;

  const result = await dbRun(`
    INSERT INTO long_term_projects (
      character_id, campaign_id, name, description, project_type,
      total_segments, skill_used, dc, rewards, started_game_day
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    characterId, campaignId, name, description || '', project_type,
    segments, skill_used || null, difficulty,
    JSON.stringify(rewards || {}),
    started_game_day || null
  ]);

  return getProjectById(result.lastInsertRowid);
}

export async function advanceProject(projectId, segmentsGained) {
  const project = await getProjectById(projectId);
  if (!project) throw new Error('Project not found');
  if (project.status !== 'active') throw new Error('Project is not active');

  const newFilled = Math.min(project.total_segments, project.segments_filled + segmentsGained);
  const isComplete = newFilled >= project.total_segments;

  await dbRun(`
    UPDATE long_term_projects
    SET segments_filled = ?, status = ?
    WHERE id = ?
  `, [newFilled, isComplete ? 'completed' : 'active', projectId]);

  return {
    project: await getProjectById(projectId),
    segmentsGained,
    isComplete,
    previousFilled: project.segments_filled,
    newFilled
  };
}

export async function completeProject(projectId, currentGameDay) {
  await dbRun(`
    UPDATE long_term_projects
    SET status = 'completed', completed_game_day = ?, segments_filled = total_segments
    WHERE id = ?
  `, [currentGameDay, projectId]);

  return getProjectById(projectId);
}

export async function abandonProject(projectId) {
  await dbRun(`
    UPDATE long_term_projects SET status = 'abandoned' WHERE id = ?
  `, [projectId]);

  return getProjectById(projectId);
}

// ============================================================
// PROGRESS ROLLS
// ============================================================

/**
 * Roll for progress on a project.
 * d20 + skill modifier vs DC
 * - Fail (below DC): 0 segments
 * - Pass (meet/beat DC): 1 segment
 * - Beat by 5+: 2 segments
 */
export function rollForProgress(skillModifier, dc) {
  const roll = Math.floor(Math.random() * 20) + 1;
  const total = roll + skillModifier;
  const margin = total - dc;

  let segmentsGained = 0;
  let resultLabel = 'failure';

  if (roll === 20) {
    segmentsGained = 2;
    resultLabel = 'critical';
  } else if (roll === 1) {
    segmentsGained = 0;
    resultLabel = 'fumble';
  } else if (margin >= 5) {
    segmentsGained = 2;
    resultLabel = 'great_success';
  } else if (margin >= 0) {
    segmentsGained = 1;
    resultLabel = 'success';
  }

  return {
    roll,
    modifier: skillModifier,
    total,
    dc,
    margin,
    segmentsGained,
    resultLabel
  };
}

/**
 * Perform a full downtime work session on a project.
 * 1 roll per 2 hours spent.
 */
export async function workOnProject(projectId, hoursSpent, skillModifier) {
  const project = await getProjectById(projectId);
  if (!project) throw new Error('Project not found');
  if (project.status !== 'active') throw new Error('Project is not active');

  const numRolls = Math.max(1, Math.floor(hoursSpent / 2));
  const rolls = [];
  let totalSegments = 0;

  for (let i = 0; i < numRolls; i++) {
    const result = rollForProgress(skillModifier, project.dc);
    rolls.push(result);
    totalSegments += result.segmentsGained;
  }

  const advanceResult = await advanceProject(projectId, totalSegments);

  return {
    ...advanceResult,
    rolls,
    totalSegmentsFromRolls: totalSegments,
    hoursSpent,
    numRolls
  };
}

// ============================================================
// PROMPT FORMATTING
// ============================================================

export async function getProjectsForPrompt(characterId, campaignId) {
  const projects = await getActiveProjects(characterId, campaignId);
  if (projects.length === 0) return '';

  const lines = projects.map(p => {
    const filled = '█'.repeat(p.segments_filled);
    const empty = '░'.repeat(p.total_segments - p.segments_filled);
    const typeInfo = PROJECT_TYPES[p.project_type];
    return `- "${p.name}" [${typeInfo?.name || p.project_type}] ${filled}${empty} ${p.segments_filled}/${p.total_segments} segments (${p.skill_used || 'any'} DC ${p.dc})`;
  });

  return `\n=== LONG-TERM PROJECTS ===\n${lines.join('\n')}\n`;
}
