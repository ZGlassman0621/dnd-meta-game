/**
 * Fact Flag Service (Phase 2 — AI-declared dynamic flags).
 *
 * Owns the SET_FACT marker handler. The DM AI emits
 *   [SET_FACT Subject="..." Field="..." Value="..." Category="..." Importance="..."]
 * to record durable world/character state that must persist across turns —
 * "the player hates boats", "Gareth is in Waterdeep". Each marker writes a
 * canon fact through Phase 1's field-aware supersede in storyChronicleService:
 * (Subject, Category, Field) is a VARIABLE key, so re-emitting the same Field
 * UPDATES the value (newest wins, prior active row retired) instead of piling
 * up near-duplicate facts.
 *
 * Modeled on lootDropService.js: single-purpose marker-handler module that
 * registers its handler at import time, resolves the character context from
 * context.characterId, and returns a small structured summary the route can
 * surface. All errors are contained — the handler never throws (the pipeline
 * also contains errors, but defense-in-depth keeps a malformed fact from ever
 * touching the turn flow).
 */

import { dbGet } from '../database.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { recordCanonFact } from './storyChronicleService.js';

/**
 * SET_FACT handler. Multi-instance marker — the pipeline dispatches once per
 * emitted marker. Resolves campaign_id + game_day from the character (the
 * established pattern other handlers use — they SELECT what they need off
 * context.characterId rather than relying on context to carry it), then writes
 * the fact as a field-keyed variable.
 *
 * Category defaults to 'world_flag' (an OVERWRITABLE category, so the field key
 * actually supersedes); Importance defaults to 'major'.
 */
registerMarkerHandler('SET_FACT', async (parsed, context) => {
  try {
    if (!context?.characterId) return null;

    const character = await dbGet(
      'SELECT id, campaign_id, game_day FROM characters WHERE id = ?',
      [context.characterId]
    );
    if (!character) return null;

    const campaignId = character.campaign_id;
    const gameDay = character.game_day ?? null;
    const category = parsed.Category || 'world_flag';
    const importance = parsed.Importance || 'major';

    const factText = `${parsed.Field}: ${parsed.Value}`;

    const factId = await recordCanonFact(
      campaignId,
      context.characterId,
      category,
      parsed.Subject,
      factText,
      context.sessionId || null,
      gameDay,
      importance,
      parsed.Field
    );

    return {
      type: 'set_fact',
      factId: factId != null ? Number(factId) : null,
      subject: parsed.Subject,
      field: parsed.Field,
      value: parsed.Value,
      category,
      importance
    };
  } catch (err) {
    // Contain all errors — a bad fact write must never break the turn.
    console.error('[factFlagService] SET_FACT handler error (non-fatal):', err?.message || err);
    return null;
  }
});
