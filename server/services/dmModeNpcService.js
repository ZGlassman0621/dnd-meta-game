/**
 * DM Mode NPC & Plot Thread Service
 *
 * Manages persistent NPC codex and plot thread tracking for DM Mode.
 * NPCs and threads are auto-synced from session chronicles, with
 * manual overrides for thread status/tags. NPC voice notes are
 * extracted from DM narration at session end.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { chat, isClaudeAvailable } from './claude.js';

// ============================================================
// NPC CODEX
// ============================================================

/**
 * Sync NPCs from a chronicle's npcs_involved into dm_mode_npcs.
 * Upserts: new NPCs are inserted, existing ones get merged data.
 */
export async function syncNpcsFromChronicle(partyId, chronicleData, sessionNumber) {
  const npcs = chronicleData.npcs_involved || [];
  if (npcs.length === 0) return;

  for (const npc of npcs) {
    if (!npc.name) continue;

    const existing = await dbGet(
      'SELECT * FROM dm_mode_npcs WHERE dm_mode_party_id = ? AND name = ? COLLATE NOCASE',
      [partyId, npc.name]
    );

    if (existing) {
      // Merge: keep longer role, fill-not-overwrite for most fields, append session
      const sessions = JSON.parse(existing.sessions_appeared || '[]');
      if (!sessions.includes(sessionNumber)) sessions.push(sessionNumber);

      const role = (npc.role && npc.role.length > (existing.role || '').length) ? npc.role : existing.role;
      const description = existing.description || npc.description || null;
      // Fill-not-overwrite for enrichment fields
      const location = npc.location || existing.location || null;
      const race = existing.race || npc.race || null;
      const classProfession = (npc.class_profession && npc.class_profession.length > (existing.class_profession || '').length) ? npc.class_profession : existing.class_profession;
      const ageDescription = existing.age_description || npc.age_description || null;
      const personality = existing.personality || npc.personality || null;
      // Status and disposition always update to latest
      const status = npc.status || existing.status || 'alive';
      const disposition = npc.disposition || existing.disposition || 'neutral';
      const connections = npc.connections || existing.connections || null;

      await dbRun(
        `UPDATE dm_mode_npcs SET role = ?, description = ?, sessions_appeared = ?, last_seen_session = ?,
         location = ?, race = ?, class_profession = ?, age_description = ?, personality = ?,
         status = ?, disposition = ?, connections = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [role, description, JSON.stringify(sessions), sessionNumber,
         location, race, classProfession, ageDescription, personality,
         status, disposition, connections, existing.id]
      );
    } else {
      // Insert new NPC
      await dbRun(
        `INSERT INTO dm_mode_npcs (dm_mode_party_id, name, role, description, sessions_appeared, first_seen_session, last_seen_session,
         location, race, class_profession, age_description, personality, status, disposition, connections)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [partyId, npc.name, npc.role || null, npc.description || null, JSON.stringify([sessionNumber]), sessionNumber, sessionNumber,
         npc.location || null, npc.race || null, npc.class_profession || null, npc.age_description || null, npc.personality || null,
         npc.status || 'alive', npc.disposition || 'neutral', npc.connections || null]
      );
    }
  }

  console.log(`[NPC Codex] Synced ${npcs.length} NPCs for party ${partyId} from session ${sessionNumber}`);
}

/**
 * Get all NPCs for a party with optional search and sort.
 */
export async function getNpcsForParty(partyId, { search = '', sort = 'name' } = {}) {
  let npcs = await dbAll(
    'SELECT * FROM dm_mode_npcs WHERE dm_mode_party_id = ? ORDER BY name ASC',
    [partyId]
  );

  // Text search across name, role, description
  if (search) {
    const q = search.toLowerCase();
    npcs = npcs.filter(n =>
      (n.name || '').toLowerCase().includes(q) ||
      (n.role || '').toLowerCase().includes(q) ||
      (n.description || '').toLowerCase().includes(q)
    );
  }

  // Parse sessions_appeared for sorting
  npcs = npcs.map(n => ({
    ...n,
    sessions_appeared: JSON.parse(n.sessions_appeared || '[]')
  }));

  // Sort
  if (sort === 'frequency') {
    npcs.sort((a, b) => b.sessions_appeared.length - a.sessions_appeared.length);
  } else if (sort === 'recency') {
    npcs.sort((a, b) => (b.last_seen_session || 0) - (a.last_seen_session || 0));
  }
  // 'name' is default from SQL ORDER BY

  return npcs;
}

/**
 * Update an existing NPC's fields (for manual editing in prep/codex).
 */
export async function updateNpc(npcId, fields) {
  const allowedFields = ['name', 'role', 'description', 'location', 'race', 'class_profession',
    'age_description', 'personality', 'status', 'disposition', 'connections', 'voice_notes'];
  const updates = [];
  const params = [];
  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = ?`);
      params.push(value);
    }
  }
  if (updates.length === 0) return null;
  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(npcId);
  await dbRun(`UPDATE dm_mode_npcs SET ${updates.join(', ')} WHERE id = ?`, params);
  return dbGet('SELECT * FROM dm_mode_npcs WHERE id = ?', [npcId]);
}

/**
 * Manually create an NPC (from prep system, not from chronicle sync).
 */
export async function createNpc(partyId, fields) {
  const result = await dbRun(
    `INSERT INTO dm_mode_npcs (dm_mode_party_id, name, role, description, sessions_appeared, first_seen_session,
     location, race, class_profession, age_description, personality, status, disposition, connections)
     VALUES (?, ?, ?, ?, '[]', NULL, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [partyId, fields.name, fields.role || null, fields.description || null,
     fields.location || null, fields.race || null, fields.class_profession || null,
     fields.age_description || null, fields.personality || null,
     fields.status || 'alive', fields.disposition || 'neutral', fields.connections || null]
  );
  return dbGet('SELECT * FROM dm_mode_npcs WHERE id = ?', [Number(result.lastInsertRowid)]);
}

/**
 * Delete an NPC from the codex.
 */
export async function deleteNpc(npcId) {
  await dbRun('DELETE FROM dm_mode_npcs WHERE id = ?', [npcId]);
}

// ============================================================
// PLOT THREADS
// ============================================================

/**
 * Sync plot threads from a chronicle into dm_mode_plot_threads.
 * Respects manual overrides: if source='manual', status is never auto-updated.
 */
export async function syncPlotThreadsFromChronicle(partyId, chronicleData, sessionNumber) {
  const threads = chronicleData.plot_threads || [];
  if (threads.length === 0) return;

  for (const thread of threads) {
    if (!thread.thread) continue;

    const existing = await dbGet(
      'SELECT * FROM dm_mode_plot_threads WHERE dm_mode_party_id = ? AND thread_name = ? COLLATE NOCASE',
      [partyId, thread.thread]
    );

    if (existing) {
      // Update details always; status only if source is 'auto'
      const updates = ['details = ?', 'updated_at = CURRENT_TIMESTAMP'];
      const params = [thread.details || existing.details];

      if (existing.source !== 'manual') {
        updates.push('status = ?');
        params.push(thread.status || existing.status);
        if (thread.status === 'resolved' && !existing.resolved_session) {
          updates.push('resolved_session = ?');
          params.push(sessionNumber);
        }
      }

      params.push(existing.id);
      await dbRun(`UPDATE dm_mode_plot_threads SET ${updates.join(', ')} WHERE id = ?`, params);
    } else {
      // Insert new thread
      await dbRun(
        `INSERT INTO dm_mode_plot_threads (dm_mode_party_id, thread_name, status, details, first_seen_session, resolved_session, source)
         VALUES (?, ?, ?, ?, ?, ?, 'auto')`,
        [
          partyId, thread.thread, thread.status || 'new',
          thread.details || null, sessionNumber,
          thread.status === 'resolved' ? sessionNumber : null
        ]
      );
    }
  }

  console.log(`[Plot Threads] Synced ${threads.length} threads for party ${partyId} from session ${sessionNumber}`);
}

/**
 * Get all plot threads for a party with optional status filter.
 */
export async function getPlotThreadsForParty(partyId, { status = '' } = {}) {
  let query = 'SELECT * FROM dm_mode_plot_threads WHERE dm_mode_party_id = ?';
  const params = [partyId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  query += ' ORDER BY CASE status WHEN \'ongoing\' THEN 1 WHEN \'new\' THEN 2 WHEN \'resolved\' THEN 3 WHEN \'abandoned\' THEN 4 END, first_seen_session DESC';

  const threads = await dbAll(query, params);
  return threads.map(t => ({
    ...t,
    tags: JSON.parse(t.tags || '[]')
  }));
}

/**
 * Update a plot thread's status. Sets source to 'manual' to prevent auto-override.
 */
export async function updatePlotThreadStatus(threadId, status) {
  await dbRun(
    "UPDATE dm_mode_plot_threads SET status = ?, source = 'manual', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [status, threadId]
  );
  return dbGet('SELECT * FROM dm_mode_plot_threads WHERE id = ?', [threadId]);
}

/**
 * Update a plot thread's tags.
 */
export async function updatePlotThreadTags(threadId, tags) {
  await dbRun(
    'UPDATE dm_mode_plot_threads SET tags = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [JSON.stringify(tags), threadId]
  );
  return dbGet('SELECT * FROM dm_mode_plot_threads WHERE id = ?', [threadId]);
}

/**
 * Create a manually-defined plot thread.
 */
export async function createManualPlotThread(partyId, { threadName, status = 'ongoing', details = '', tags = [] }) {
  const result = await dbRun(
    `INSERT INTO dm_mode_plot_threads (dm_mode_party_id, thread_name, status, details, tags, source)
     VALUES (?, ?, ?, ?, ?, 'manual')`,
    [partyId, threadName, status, details, JSON.stringify(tags)]
  );
  return dbGet('SELECT * FROM dm_mode_plot_threads WHERE id = ?', [Number(result.lastInsertRowid)]);
}

// ============================================================
// NPC VOICE EXTRACTION
// ============================================================

const VOICE_PROMPT = `You are analyzing a D&D session transcript. The DM (user messages) voices all NPCs during gameplay.
Identify how the DM portrays each named NPC — speech patterns, accent hints, verbal tics, mannerisms, tone, emotional register, vocabulary level.

RULES:
- Only include NPCs where you can identify SPECIFIC voice characteristics from the DM's narration.
- Do NOT include the player characters (the AI-played party members).
- Focus on DIALOGUE style, not just physical descriptions.
- Be concise — 1-2 sentences per NPC.

Respond with ONLY valid JSON:
{
  "npc_voices": [
    { "name": "NPC name", "voice_notes": "How this NPC speaks — patterns, tics, tone, vocabulary" }
  ]
}

If no NPCs had distinctive voice characteristics this session, return: { "npc_voices": [] }`;

/**
 * Extract NPC voice patterns from session transcript and merge into dm_mode_npcs.
 * Called non-blocking at session end.
 */
export async function extractNpcVoiceNotes(sessionId, partyId) {
  if (!isClaudeAvailable()) return null;

  const session = await dbGet('SELECT messages FROM dm_sessions WHERE id = ?', [sessionId]);
  if (!session) return null;

  let messages;
  try {
    messages = JSON.parse(session.messages || '[]');
  } catch (e) {
    return null;
  }

  // Only DM messages (user role) contain NPC voicing
  const dmMessages = messages.filter(m => m.role === 'user' && !m.content.startsWith('[SYSTEM'));
  if (dmMessages.length < 2) return null;

  const transcript = dmMessages.map(m => m.content).join('\n\n');
  let input = transcript;
  if (input.length > 30000) {
    input = input.substring(0, 15000) + '\n\n[...condensed...]\n\n' + input.substring(input.length - 15000);
  }

  try {
    const response = await chat(
      VOICE_PROMPT,
      [{ role: 'user', content: input }],
      2,
      'sonnet',
      1500,
      true
    );

    const cleaned = response.replace(/```json?\s*/g, '').replace(/```\s*/g, '').trim();
    const result = JSON.parse(cleaned);
    const voices = result.npc_voices || [];

    if (voices.length === 0) return null;

    // Get session number for labeling
    const chronicle = await dbGet(
      'SELECT session_number FROM dm_mode_chronicles WHERE session_id = ?',
      [sessionId]
    );
    const sessionLabel = chronicle ? `Session ${chronicle.session_number}` : `Session ?`;

    for (const v of voices) {
      if (!v.name || !v.voice_notes) continue;

      const npc = await dbGet(
        'SELECT * FROM dm_mode_npcs WHERE dm_mode_party_id = ? AND name = ? COLLATE NOCASE',
        [partyId, v.name]
      );

      if (npc) {
        // Append voice notes with session label
        const existing = npc.voice_notes || '';
        const newNotes = existing
          ? `${existing}\n[${sessionLabel}] ${v.voice_notes}`
          : `[${sessionLabel}] ${v.voice_notes}`;

        await dbRun(
          'UPDATE dm_mode_npcs SET voice_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [newNotes, npc.id]
        );
      }
      // If NPC not in codex yet, skip — syncNpcsFromChronicle should run first
    }

    console.log(`[NPC Voice] Extracted voice notes for ${voices.length} NPCs from session ${sessionId}`);
    return voices;
  } catch (error) {
    console.error('[NPC Voice] Extraction failed:', error.message);
    return null;
  }
}
