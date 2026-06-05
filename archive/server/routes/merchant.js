/**
 * Merchant routes — currently just the commission/order endpoints (M2).
 * Merchant inventory + transaction endpoints still live in dmSession.js;
 * this file hosts the order-lifecycle endpoints because they operate
 * outside of an active session (you can place / pick up an order at any
 * merchant visit, not just inside a DM-session merchant-shop marker flow).
 */

import express from 'express';
import { dbGet } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { handleServerError } from '../utils/errorHandler.js';
import {
  placeCommission,
  collectOrder,
  cancelOrder,
  listOrdersForCharacter
} from '../services/merchantOrderService.js';
import {
  calculateHaggleDC,
  resolveHaggle,
  themeHaggleBonus,
  VALID_HAGGLE_SKILLS
} from '../services/bargainingService.js';
import { PROFICIENCY_BONUS } from '../config/levelProgression.js';
import { getCharacterProgression } from '../services/progressionService.js';
import { getCompanionProgression } from '../services/progressionCompanionService.js';
import {
  getRelationshipsForCharacter,
  upsertRelationship
} from '../services/merchantRelationshipService.js';

// Persuasion = CHA, Deception = CHA, Intimidation = CHA (5e default mapping)
const SKILL_ABILITY = {
  Persuasion: 'cha',
  Deception: 'cha',
  Intimidation: 'cha'
};

function abilityModifier(score) {
  return Math.floor(((score || 10) - 10) / 2);
}

const router = express.Router();

// Place a commission with a merchant.
// Body: {
//   characterId, itemName, itemSpec?,
//   quotedPriceGp?, quotedPriceSp?, quotedPriceCp?,   (at least one > 0)
//   depositGp?, depositSp?, depositCp?,
//   leadTimeDays, narrativeHook?
// }
// Passing gp/sp/cp separately is just UI ergonomics — the service uses cp
// internally.
router.post('/:merchantId/commission', async (req, res) => {
  try {
    const {
      characterId,
      itemName,
      itemSpec,
      quotedPriceGp = 0,
      quotedPriceSp = 0,
      quotedPriceCp = 0,
      depositGp = 0,
      depositSp = 0,
      depositCp = 0,
      leadTimeDays,
      narrativeHook,
      currentGameDay = 0
    } = req.body || {};

    const totalQuotedCp = (quotedPriceGp || 0) * 100 + (quotedPriceSp || 0) * 10 + (quotedPriceCp || 0);
    const totalDepositCp = (depositGp || 0) * 100 + (depositSp || 0) * 10 + (depositCp || 0);

    const result = await placeCommission({
      merchantId: Number(req.params.merchantId),
      characterId: Number(characterId),
      itemName,
      itemSpec,
      quotedPriceCp: totalQuotedCp,
      depositCp: totalDepositCp,
      leadTimeDays: Number(leadTimeDays),
      currentGameDay: Number(currentGameDay) || 0,
      narrativeHook
    });

    if (!result.ok) return res.status(400).json({ error: result.error });
    res.status(201).json({ order: result.order });
  } catch (error) {
    handleServerError(res, error, 'place merchant commission');
  }
});

// List all orders for a character (any status, most recent first)
router.get('/orders/character/:characterId', async (req, res) => {
  try {
    const orders = await listOrdersForCharacter(Number(req.params.characterId));
    res.json({ orders });
  } catch (error) {
    handleServerError(res, error, 'list character orders');
  }
});

// Fetch a single order
router.get('/orders/:orderId', async (req, res) => {
  try {
    const order = await dbGet(
      `SELECT o.*, m.merchant_name
       FROM merchant_orders o
       LEFT JOIN merchant_inventories m ON o.merchant_id = m.id
       WHERE o.id = ?`,
      [Number(req.params.orderId)]
    );
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  } catch (error) {
    handleServerError(res, error, 'get order');
  }
});

// Collect a ready order — pays the balance, puts item into party inventory
router.post('/orders/:orderId/collect', async (req, res) => {
  try {
    const { characterId } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const result = await collectOrder(Number(req.params.orderId), Number(characterId));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'collect order');
  }
});

// Cancel a pending order (deposit forfeit)
router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const { characterId } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const result = await cancelOrder(Number(req.params.orderId), Number(characterId));
    if (!result.ok) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'cancel order');
  }
});

// ============================================================================
// M4: Merchant Relationships — surfaces the merchant-memory data that's been
// persisted in merchant_inventories.transaction_history (since migration 011)
// plus per-character notes and the favorite flag (migration 034).
// ============================================================================

router.get('/relationships/character/:characterId', async (req, res) => {
  try {
    const relationships = await getRelationshipsForCharacter(Number(req.params.characterId));
    res.json({ relationships });
  } catch (error) {
    handleServerError(res, error, 'fetch merchant relationships');
  }
});

router.put('/relationships/:merchantId', async (req, res) => {
  try {
    const { characterId, notes, favorited } = req.body || {};
    if (!characterId) return res.status(400).json({ error: 'characterId is required' });

    const result = await upsertRelationship(
      Number(characterId),
      Number(req.params.merchantId),
      { notes, favorited }
    );
    res.json(result);
  } catch (error) {
    handleServerError(res, error, 'update merchant relationship');
  }
});

// ============================================================================
// M3: Bargaining — haggle a discount on a merchant's prices
//
// POST /api/merchant/:merchantId/haggle
// Body: {
//   characterId: number           (who's the party leader)
//   rollerType: 'character' | 'companion'
//   companionId?: number          (required when rollerType === 'companion')
//   skill: 'Persuasion' | 'Deception' | 'Intimidation'
//   itemRarity?: string           (common|uncommon|rare|very_rare|legendary) — affects DC
//   attemptNumber?: number        (client tracks; 2+ = repeat-attempt penalty on failure)
//   rollValue?: number            (1-20; if omitted, server rolls)
// }
// Returns: { success, roll, modifier, total, dc, margin, discountPercent,
//            dispositionChange, critical, criticalFail, skill, roller: { name, type } }
//
// The client then passes `discountPercent` to the transaction endpoint to
// apply the cut. Trust model: solo game, client-enforced discount is fine.
// For future multiplayer, issue a short-lived server-side haggle token.
// ============================================================================

router.post('/:merchantId/haggle', async (req, res) => {
  try {
    const {
      characterId,
      rollerType = 'character',
      companionId,
      skill = 'Persuasion',
      itemRarity = 'common',
      attemptNumber = 1,
      rollValue
    } = req.body || {};

    if (!characterId) return res.status(400).json({ error: 'characterId is required' });
    if (!VALID_HAGGLE_SKILLS.has(skill)) {
      return res.status(400).json({
        error: `skill must be one of: ${[...VALID_HAGGLE_SKILLS].join(', ')}`
      });
    }
    if (rollerType !== 'character' && rollerType !== 'companion') {
      return res.status(400).json({ error: "rollerType must be 'character' or 'companion'" });
    }
    if (rollerType === 'companion' && !companionId) {
      return res.status(400).json({ error: 'companionId required when rollerType is companion' });
    }

    const merchant = await dbGet(
      'SELECT id, merchant_name, prosperity FROM merchant_inventories WHERE id = ?',
      [Number(req.params.merchantId)]
    );
    if (!merchant) return res.status(404).json({ error: 'Merchant not found' });

    // Merchant disposition: look up via NPC record if one exists with a
    // matching name; fall back to 'neutral'. Matches the pattern used in
    // the existing dmSession merchant-transaction reputation update.
    let disposition = 'neutral';
    try {
      const npc = await dbGet(
        'SELECT id FROM npcs WHERE LOWER(name) LIKE LOWER(?) LIMIT 1',
        [`%${merchant.merchant_name}%`]
      );
      if (npc) {
        const rel = await dbGet(
          'SELECT disposition_label FROM npc_relationships WHERE character_id = ? AND npc_id = ?',
          [Number(characterId), npc.id]
        );
        if (rel?.disposition_label) disposition = rel.disposition_label;
      }
    } catch (_) { /* fall back to neutral */ }

    // Look up the roller's ability scores + proficiencies + theme
    let abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    let level = 1;
    let isProficient = true; // Generous default — most parties have *someone* trained in these social skills
    let themeId = null;
    let rollerName = 'Party member';

    if (rollerType === 'character') {
      const char = await dbGet(
        'SELECT level, ability_scores, skills, name FROM characters WHERE id = ?',
        [Number(characterId)]
      );
      if (!char) return res.status(404).json({ error: 'Character not found' });
      abilityScores = safeParse(char.ability_scores, abilityScores);
      level = char.level || 1;
      rollerName = char.name || 'You';
      const skillList = safeParse(char.skills, []);
      isProficient = Array.isArray(skillList)
        && skillList.some(s => String(s).toLowerCase() === skill.toLowerCase());
      const prog = await getCharacterProgression(Number(characterId)).catch(() => null);
      themeId = prog?.theme?.theme_id || null;
    } else {
      const comp = await dbGet(
        `SELECT c.id, c.companion_level, c.companion_ability_scores, c.skill_proficiencies, n.name
         FROM companions c JOIN npcs n ON c.npc_id = n.id
         WHERE c.id = ?`,
        [Number(companionId)]
      );
      if (!comp) return res.status(404).json({ error: 'Companion not found' });
      abilityScores = safeParse(comp.companion_ability_scores, abilityScores);
      level = comp.companion_level || 1;
      rollerName = comp.name || 'Companion';
      const skillList = safeParse(comp.skill_proficiencies, []);
      isProficient = Array.isArray(skillList)
        && skillList.some(s => String(s).toLowerCase() === skill.toLowerCase());
      const prog = await getCompanionProgression(Number(companionId)).catch(() => null);
      themeId = prog?.theme?.theme_id || null;
    }

    const abilityKey = SKILL_ABILITY[skill];
    const abilityMod = abilityModifier(abilityScores[abilityKey]);
    const profBonus = PROFICIENCY_BONUS[level] || 2;
    const themeBonus = themeHaggleBonus(themeId, skill);

    const dc = calculateHaggleDC({
      disposition,
      prosperity: merchant.prosperity,
      itemRarity
    });

    const actualRoll = Number.isInteger(rollValue)
      ? rollValue
      : 1 + Math.floor(Math.random() * 20);

    const result = resolveHaggle({
      dc,
      rollValue: actualRoll,
      abilityModifier: abilityMod,
      proficiencyBonus: profBonus,
      isProficient,
      themeBonus,
      attemptNumber,
      skill
    });

    res.json({
      ...result,
      roller: { name: rollerName, type: rollerType, level },
      merchant: { id: merchant.id, name: merchant.merchant_name, disposition },
      themeBonus,
      isProficient
    });
  } catch (error) {
    handleServerError(res, error, 'haggle with merchant');
  }
});

export default router;
