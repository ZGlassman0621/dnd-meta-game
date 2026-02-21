import express from 'express';
import { dbAll, dbGet, dbRun } from '../database.js';
import {
  getActiveThreads,
  getQuestResolvingThreads,
  resolveThread,
  createStoryThread,
  THREAD_TYPES,
  QUEST_RELEVANCE
} from '../services/storyThreads.js';
import { handleServerError } from '../utils/errorHandler.js';

const router = express.Router();

// Get all active story threads for a character
router.get('/active/:character_id', async (req, res) => {
  try {
    const characterId = req.params.character_id;
    const { type, relevance, limit } = req.query;

    const threads = await getActiveThreads(characterId, {
      type: type || null,
      relevance: relevance || null,
      limit: limit ? parseInt(limit) : 20
    });

    res.json({
      threads,
      count: threads.length
    });
  } catch (error) {
    handleServerError(res, error, 'get story threads');
  }
});

// Get threads that can resolve the current quest
router.get('/quest-resolving/:character_id', async (req, res) => {
  try {
    const characterId = req.params.character_id;
    const threads = await getQuestResolvingThreads(characterId);

    res.json({
      threads,
      count: threads.length
    });
  } catch (error) {
    handleServerError(res, error, 'get quest-resolving threads');
  }
});

// Get a single story thread
router.get('/:thread_id', async (req, res) => {
  try {
    const thread = await dbGet('SELECT * FROM story_threads WHERE id = ?', [req.params.thread_id]);

    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    res.json({
      ...thread,
      relatedNpcs: JSON.parse(thread.related_npcs || '[]'),
      relatedLocations: JSON.parse(thread.related_locations || '[]'),
      potentialOutcomes: JSON.parse(thread.potential_outcomes || '[]')
    });
  } catch (error) {
    handleServerError(res, error, 'get story thread');
  }
});

// Create a new story thread manually
router.post('/', async (req, res) => {
  try {
    const {
      character_id,
      thread_type,
      title,
      description,
      quest_relevance,
      related_npcs,
      related_locations,
      potential_outcomes,
      consequence_category,
      can_resolve_quest
    } = req.body;

    if (!character_id || !thread_type || !title || !description) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const thread = await createStoryThread(character_id, {
      sourceType: 'manual',
      sourceId: null,
      threadType: thread_type,
      title,
      description,
      questRelevance: quest_relevance || 'side_quest',
      relatedNpcs: related_npcs || [],
      relatedLocations: related_locations || [],
      potentialOutcomes: potential_outcomes || [],
      consequenceCategory: consequence_category || 'intel',
      canResolveQuest: can_resolve_quest || false
    });

    res.status(201).json(thread);
  } catch (error) {
    handleServerError(res, error, 'create story thread');
  }
});

// Update a story thread
router.put('/:thread_id', async (req, res) => {
  try {
    const threadId = req.params.thread_id;
    const updates = req.body;

    const thread = await dbGet('SELECT * FROM story_threads WHERE id = ?', [threadId]);
    if (!thread) {
      return res.status(404).json({ error: 'Thread not found' });
    }

    // Build update query dynamically
    const allowedFields = [
      'title', 'description', 'status', 'priority', 'quest_relevance',
      'consequence_category', 'can_resolve_quest'
    ];

    const setClauses = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    // Handle JSON fields
    if (updates.related_npcs) {
      setClauses.push('related_npcs = ?');
      values.push(JSON.stringify(updates.related_npcs));
    }
    if (updates.related_locations) {
      setClauses.push('related_locations = ?');
      values.push(JSON.stringify(updates.related_locations));
    }
    if (updates.potential_outcomes) {
      setClauses.push('potential_outcomes = ?');
      values.push(JSON.stringify(updates.potential_outcomes));
    }

    if (setClauses.length > 0) {
      setClauses.push('updated_at = datetime("now")');
      values.push(threadId);

      await dbRun(`
        UPDATE story_threads
        SET ${setClauses.join(', ')}
        WHERE id = ?
      `, values);
    }

    const updatedThread = await dbGet('SELECT * FROM story_threads WHERE id = ?', [threadId]);
    res.json(updatedThread);
  } catch (error) {
    handleServerError(res, error, 'update story thread');
  }
});

// Resolve a story thread
router.post('/:thread_id/resolve', async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution) {
      return res.status(400).json({ error: 'Resolution description is required' });
    }

    const thread = await resolveThread(req.params.thread_id, resolution);
    res.json(thread);
  } catch (error) {
    handleServerError(res, error, 'resolve story thread');
  }
});

// Delete a story thread
router.delete('/:thread_id', async (req, res) => {
  try {
    await dbRun('DELETE FROM story_threads WHERE id = ?', [req.params.thread_id]);
    res.json({ message: 'Thread deleted successfully' });
  } catch (error) {
    handleServerError(res, error, 'delete story thread');
  }
});

// Get thread types and relevance categories (for UI)
router.get('/meta/types', async (req, res) => {
  res.json({
    threadTypes: THREAD_TYPES,
    questRelevance: QUEST_RELEVANCE
  });
});

export default router;
