/**
 * DM Session Service - Business Logic for DM Session Lifecycle
 *
 * Extracts session analysis, reward calculation, campaign note extraction,
 * NPC extraction, name tracking, and event emission from the route handler.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import {
  getBaseXPReward,
  calculateGoldReward,
  generateLoot
} from '../config/rewards.js';
import { dayToDate, advanceTime } from '../config/harptos.js';
import {
  onNpcInteraction,
  emitLocationVisited,
  onItemObtained,
  onDMSessionEnded
} from './narrativeIntegration.js';

// ============================================================
// DETECTION HELPERS
// ============================================================

/**
 * Shared key="value" pair parser for AI markers.
 * Handles: spaces around =, single/double quotes, empty values, unquoted bare words.
 */
export function parseMarkerPairs(markerContent) {
  const data = {};
  // Match: Key="value", Key='value', Key=bareword
  const pairRegex = /(\w+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let match;
  while ((match = pairRegex.exec(markerContent)) !== null) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    data[key] = value;
  }
  return data;
}

/**
 * Parse the structured NPC_WANTS_TO_JOIN marker from AI response
 */
export function parseNpcJoinMarker(narrative) {
  const markerMatch = narrative.match(/\[NPC_WANTS_TO_JOIN:\s*([^\]]+)\]/i);
  if (!markerMatch) return null;

  const npcData = parseMarkerPairs(markerMatch[1]);

  if (!npcData.name) {
    console.warn('[Marker] NPC_WANTS_TO_JOIN detected but missing Name field:', markerMatch[0]);
    return null;
  }

  return {
    detected: true,
    trigger: 'structured_marker',
    npcName: npcData.name,
    npcData: {
      name: npcData.name,
      race: npcData.race || 'Human',
      gender: npcData.gender || null,
      occupation: npcData.occupation || null,
      personality: npcData.personality || null,
      reason: npcData.reason || null
    }
  };
}

/**
 * Detect merchant shop marker in AI narrative
 */
export function detectMerchantShop(narrative) {
  if (!narrative) return null;
  const markerMatch = narrative.match(/\[MERCHANT_SHOP:\s*([^\]]+)\]/i);
  if (!markerMatch) return null;

  const data = parseMarkerPairs(markerMatch[1]);
  if (!data.merchant) {
    console.warn('[Marker] MERCHANT_SHOP detected but missing Merchant field:', markerMatch[0]);
    return null;
  }

  return {
    detected: true,
    merchantName: data.merchant,
    merchantType: data.type || 'general',
    location: data.location || 'Unknown shop'
  };
}

/**
 * Detect merchant referral marker in AI narrative.
 * [MERCHANT_REFER: From="Current Merchant" To="Other Merchant" Item="item description"]
 */
export function detectMerchantRefer(narrative) {
  if (!narrative) return null;
  const markerMatch = narrative.match(/\[MERCHANT_REFER:\s*([^\]]+)\]/i);
  if (!markerMatch) return null;

  const data = parseMarkerPairs(markerMatch[1]);
  if (!data.to || !data.item) {
    console.warn('[Marker] MERCHANT_REFER detected but missing To/Item field:', markerMatch[0]);
    return null;
  }

  return {
    fromMerchant: data.from || null,
    toMerchant: data.to,
    item: data.item
  };
}

/**
 * Detect ADD_ITEM markers in AI narrative.
 * [ADD_ITEM: Name="item name" Price_GP=X Quality="standard|fine|superior|masterwork" Category="category"]
 */
export function detectAddItem(narrative) {
  if (!narrative) return [];
  const markers = [];
  const regex = /\[ADD_ITEM:\s*([^\]]+)\]/gi;
  let markerMatch;
  while ((markerMatch = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(markerMatch[1]);

    if (data.name) {
      markers.push({
        name: data.name,
        price_gp: parseFloat(data.price_gp) || 0,
        quality: data.quality || 'standard',
        category: data.category || 'adventuring_gear',
        description: data.description || ''
      });
    } else {
      console.warn('[Marker] ADD_ITEM detected but missing Name field:', markerMatch[0]);
    }
  }
  return markers;
}

/**
 * Detect LOOT_DROP markers in AI narrative.
 * [LOOT_DROP: Item="item name" Source="where it came from"]
 * Can appear multiple times in one response.
 */
export function detectLootDrop(narrative) {
  if (!narrative) return [];
  const drops = [];
  const regex = /\[LOOT_DROP:\s*([^\]]+)\]/gi;
  let markerMatch;
  while ((markerMatch = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(markerMatch[1]);
    if (data.item) {
      drops.push({
        item: data.item,
        source: data.source || 'found'
      });
    } else {
      console.warn('[Marker] LOOT_DROP detected but missing Item field:', markerMatch[0]);
    }
  }
  return drops;
}

/**
 * Detect [COMBAT_START: Enemies="Enemy 1, Enemy 2"] marker in narrative.
 * Returns { detected: true, enemies: ['Enemy 1', 'Enemy 2'] } or { detected: false }
 */
export function detectCombatStart(narrative) {
  if (!narrative) return { detected: false };
  const regex = /\[COMBAT_START:\s*([^\]]+)\]/i;
  const match = regex.exec(narrative);
  if (!match) return { detected: false };

  const data = parseMarkerPairs(match[1]);
  let enemies = [];
  if (data.enemies) {
    enemies = data.enemies.split(',').map(e => e.trim()).filter(Boolean);
  }

  return { detected: true, enemies };
}

/**
 * Detect [COMBAT_END] marker in narrative.
 */
export function detectCombatEnd(narrative) {
  if (!narrative) return false;
  return /\[COMBAT_END\]/i.test(narrative);
}

/**
 * Heuristic DEX modifier estimation for enemy types.
 * Used for initiative rolling when we don't have full stat blocks.
 */
export function estimateEnemyDexMod(enemyName) {
  const name = (enemyName || '').toLowerCase();

  // High DEX creatures
  if (/rogue|assassin|thief|shadow|panther|displacer|phase|sprite|pixie|imp|quickling/.test(name)) return 4;
  if (/wolf|worg|dire wolf|cat|leopard|jaguar|snake|viper|cobra/.test(name)) return 3;
  if (/goblin|kobold|skeleton|ghoul|scout|spy|drow|elf|ranger|monk/.test(name)) return 2;

  // Average DEX creatures
  if (/bandit|guard|thug|cultist|soldier|warrior|knight|zombie|orc|gnoll|hobgoblin|bugbear|lizardfolk/.test(name)) return 1;

  // Low DEX creatures
  if (/ogre|giant|troll|minotaur|golem|elemental|treant|ent/.test(name)) return -1;
  if (/dragon turtle|tarrasque|purple worm/.test(name)) return -2;

  // Default: slightly above average
  return 1;
}

/**
 * Detect if player is initiating a downtime activity
 */
export function detectDowntime(playerAction) {
  if (!playerAction) return null;

  const action = playerAction.toLowerCase();

  const trainingPatterns = [
    /(?:^|\b)(?:we |i )(?:train|practice|drill|exercise|spar|workout)\b/i,
    /\b(?:spend|take)\s+\d+\s*(?:hours?|hrs?)\s+(?:training|practicing|drilling|exercising|sparring)\b/i,
    /\b(?:hone|improve|work on)\s+(?:my|our)\s*(?:skills?|abilities?|combat|martial|fighting)\b/i
  ];

  const restPatterns = [
    /\b(?:take a |take )?(?:short|long)\s+rest\b/i,
    /(?:^|\b)(?:we |i )(?:rest|sleep|recuperate|recover)\b/i,
    /\b(?:spend|take)\s+\d+\s*(?:hours?|hrs?)\s+(?:resting|sleeping|recovering)\b/i,
    /\b(?:get some |catch some )(?:rest|sleep|shut-eye)\b/i,
    /(?:^|\b)(?:we |i )(?:camp|make camp|set up camp)\b/i,
    /\blet'?s\s+(?:camp|rest|sleep|make camp|set up camp)\b/i,
    /\btake\s+(?:first|second|third|last)\s+watch\b/i,
    /\b(?:set up|take|keep|stand)\s+watch\b/i,
    /\b(?:through|for|during)\s+the\s+night\b/i,
    /\bbed down\b|\bturn in\s+for\s+the\s+night\b/i,
    /\bcall it a (?:night|day)\b/i
  ];

  const studyPatterns = [
    /(?:^|\b)(?:we |i )(?:study|research)\b/i,
    /\b(?:spend|take)\s+\d+\s*(?:hours?|hrs?)\s+(?:studying|researching|reading|learning)\b/i,
    /\b(?:pore over|examine|analyze)\s+(?:books?|tomes?|scrolls?|texts?|documents?)\b/i
  ];

  const craftingPatterns = [
    /(?:^|\b)(?:we |i )(?:craft|forge|brew|enchant)\b/i,
    /(?:^|\b)(?:we |i )(?:create|make)\s+(?:a |an |some |the )?(?:potion|sword|armor|shield|weapon|item|tool|scroll|ring|amulet|wand|staff|bow|arrow)/i,
    /\b(?:spend|take)\s+\d+\s*(?:hours?|hrs?)\s+(?:crafting|forging|brewing|creating)\b/i,
    /\b(?:work on|tinker with)\s+(?:equipment|gear|items?|potions?)\b/i
  ];

  const workPatterns = [
    /(?:^|\b)(?:we |i )(?:look for work|find work|earn money|earn gold)\b/i,
    /\b(?:spend|take)\s+\d+\s*(?:hours?|hrs?)\s+(?:working|earning)\b/i,
    /\b(?:do some |find )?(?:odd jobs|manual labor|honest work)\b/i
  ];

  const durationMatch = action.match(/(\d+)\s*(?:hours?|hrs?)/i);
  const duration = durationMatch ? parseInt(durationMatch[1]) : null;

  for (const pattern of trainingPatterns) {
    if (pattern.test(action)) {
      return { type: 'training', duration, trigger: 'player_action' };
    }
  }

  for (const pattern of restPatterns) {
    if (pattern.test(action)) {
      const isLongRest = /\blong\s+rest\b|\bsleep\b|\b8\s*hours?\b|\bovernight\b|\bcamp\b|\bwatch\b|\bthrough the night\b|\bfor the night\b|\bturn in\b|\bbed down\b|\bcall it a night\b/i.test(action);
      const isShortRest = /\bshort\s+rest\b/i.test(action);
      return {
        type: 'rest',
        restType: isShortRest ? 'short' : (isLongRest ? 'long' : null),
        duration: duration || (isLongRest ? 8 : (isShortRest ? 1 : null)),
        trigger: 'player_action'
      };
    }
  }

  for (const pattern of studyPatterns) {
    if (pattern.test(action)) {
      return { type: 'study', duration, trigger: 'player_action' };
    }
  }

  for (const pattern of craftingPatterns) {
    if (pattern.test(action)) {
      return { type: 'crafting', duration, trigger: 'player_action' };
    }
  }

  for (const pattern of workPatterns) {
    if (pattern.test(action)) {
      return { type: 'work', duration, trigger: 'player_action' };
    }
  }

  return null;
}

/**
 * Detect if an NPC has agreed to join the party
 */
export function detectRecruitment(narrative, playerAction) {
  const structuredResult = parseNpcJoinMarker(narrative);
  if (structuredResult) return structuredResult;

  const joinPhrases = [
    /join (?:us|me|my party|our party|the party)/i,
    /travel with (?:us|me)/i,
    /come with (?:us|me)/i,
    /accompany (?:us|me)/i,
    /(?:want|like) you to (?:join|come|travel)/i,
    /be (?:my|our) companion/i,
    /hire you/i,
    /recruit/i,
    /together/i,
    /with you/i,
    /by your side/i,
    /stand with/i
  ];

  const organicJoinPhrases = [
    /[""]together[""],?\s*(?:they|he|she|the|all)/i,
    /places? (?:their|his|her) hand (?:on top|atop|over)/i,
    /hands? (?:stack|together|clasped|joined)/i,
    /pledge(?:s|d)?\s+(?:to|their)/i,
    /swear(?:s|ing)?\s+(?:to|an? oath)/i,
    /bonds? of (?:fellowship|friendship|brotherhood)/i,
    /united\s+(?:in|by|together)/i,
    /shared\s+purpose/i
  ];

  const playerAskedToJoin = joinPhrases.some(phrase => phrase.test(playerAction));
  const organicJoinDetected = organicJoinPhrases.some(phrase => phrase.test(narrative));

  if (!playerAskedToJoin && !organicJoinDetected) return null;

  const agreementPhrases = [
    /i(?:'ll| will| would be (?:honored|glad|happy) to) (?:join|come|travel|accompany)/i,
    /(?:yes|aye|alright|very well)[,.]?\s*i(?:'ll| will) (?:join|come|go)/i,
    /count me in/i,
    /i(?:'m| am) (?:with you|in|coming)/i,
    /(?:lead|show) the way/i,
    /(?:glad|happy|honored|pleased) to (?:join|accompany|travel)/i,
    /you have (?:my|a) (?:sword|bow|axe|staff|blade|service)/i,
    /i'll (?:follow|serve|help) you/i,
    /where (?:do we|shall we|are we) (?:go|head|start)/i,
    /when do we (?:leave|start|begin)/i,
    /[""]together[""],?\s*(?:they|he|she|agrees?)/i,
    /adds? (?:their|his|her) hand/i,
    /completing the circle/i,
    /firm (?:grip|resolve|nod)/i
  ];

  const npcAgreed = agreementPhrases.some(phrase => phrase.test(narrative));
  if (!npcAgreed) return null;

  const namePatterns = [
    /[""]([^""]+?)[""] (?:says?|nods?|smiles?|grins?|agrees?|replies?|responds?|answers?)/i,
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:says?|nods?|smiles?|grins?|agrees?|replies?|responds?|answers?)/,
    /(?:the |)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:looks at you|meets your eyes|extends|clasps|shakes)/
  ];

  let npcName = null;
  for (const pattern of namePatterns) {
    const match = narrative.match(pattern);
    if (match) {
      const candidate = match[1];
      const nonNames = ['you', 'he', 'she', 'they', 'the', 'a', 'an', 'your', 'my', 'his', 'her', 'their'];
      if (!nonNames.includes(candidate.toLowerCase())) {
        npcName = candidate;
        break;
      }
    }
  }

  if (!npcName) {
    const askPatterns = [
      /(?:ask|invite|tell|want)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+to/i,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)[,]?\s+(?:would you|will you|join)/i
    ];
    for (const pattern of askPatterns) {
      const match = playerAction.match(pattern);
      if (match) {
        npcName = match[1];
        break;
      }
    }
  }

  return {
    detected: true,
    npcName: npcName || 'Unknown NPC',
    trigger: 'agreement'
  };
}

// ============================================================
// WEATHER, SURVIVAL & CRAFTING MARKER DETECTION
// ============================================================

/**
 * Detect [WEATHER_CHANGE: Type="thunderstorm" Duration_Hours=6]
 */
export function detectWeatherChange(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[WEATHER_CHANGE:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  if (!data.type) return null;
  return {
    type: data.type,
    duration_hours: parseInt(data.duration_hours) || 24
  };
}

/**
 * Detect [SHELTER_FOUND: Type="cave" Quality="adequate"]
 */
export function detectShelterFound(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[SHELTER_FOUND:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  if (!data.type) return null;
  return {
    type: data.type,
    quality: data.quality || 'adequate'
  };
}

/**
 * Detect [SWIM: Duration="brief"]
 */
export function detectSwim(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[SWIM:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  return { duration: data.duration || 'brief' };
}

/**
 * Detect [EAT: Item="Rations (1 day)"] markers — can appear multiple times
 */
export function detectEat(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[EAT:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.item) results.push({ item: data.item });
  }
  return results;
}

/**
 * Detect [DRINK: Item="Waterskin"] markers — can appear multiple times
 */
export function detectDrink(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[DRINK:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.item) results.push({ item: data.item });
  }
  return results;
}

/**
 * Detect [FORAGE: Terrain="forest" Result="success" Food=1 Water=1]
 */
export function detectForage(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[FORAGE:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  return {
    terrain: data.terrain || 'unknown',
    result: data.result || 'success',
    food: parseInt(data.food) || 0,
    water: parseInt(data.water) || 0
  };
}

/**
 * Detect [RECIPE_FOUND: Name="Potion of Healing" Source="ancient journal"]
 */
export function detectRecipeFound(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[RECIPE_FOUND:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.name) results.push({ name: data.name, source: data.source || 'found' });
  }
  return results;
}

/**
 * Detect [MATERIAL_FOUND: Name="Healing Herbs" Quantity=3 Quality="standard"]
 */
export function detectMaterialFound(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[MATERIAL_FOUND:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.name) {
      results.push({
        name: data.name,
        quantity: parseInt(data.quantity) || 1,
        quality: data.quality || 'standard'
      });
    }
  }
  return results;
}

/**
 * Detect [CRAFT_PROGRESS: Hours=4]
 */
export function detectCraftProgress(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[CRAFT_PROGRESS:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  const hours = parseFloat(data.hours);
  if (!hours || hours <= 0) return null;
  return { hours };
}

/**
 * Detect [RECIPE_GIFT: Name="Gerda's Mutton Stew" Category="food" Description="..." Materials="Raw Meat:1,Herbs:1" Tools="Cook's Utensils" DC=10 Hours=2 Ability="wisdom" OutputName="..." OutputDesc="..." GiftedBy="Gerda the Innkeeper"]
 * Creates a NEW recipe that didn't exist before (vs RECIPE_FOUND which discovers existing ones).
 */
export function detectRecipeGift(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[RECIPE_GIFT:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.name && data.category) {
      // Parse compact materials format "Name:Qty,Name:Qty"
      const materials = (data.materials || '').split(',')
        .map(m => {
          const parts = m.trim().split(':');
          return { name: parts[0]?.trim(), quantity: parseInt(parts[1]) || 1 };
        })
        .filter(m => m.name);

      results.push({
        name: data.name,
        category: data.category,
        description: data.description || '',
        materials,
        tools: !data.tools || data.tools === 'none' ? [] : [data.tools],
        dc: parseInt(data.dc) || 10,
        hours: parseInt(data.hours) || 4,
        ability: data.ability || 'intelligence',
        outputName: data.outputname || data.name,
        outputDesc: data.outputdesc || data.description || '',
        outputCategory: data.outputcategory || data.category,
        outputRarity: data.outputrarity || 'common',
        outputPrice: parseInt(data.outputprice) || 1,
        giftedBy: data.giftedby || 'Unknown'
      });
    }
  }
  return results;
}

/**
 * Detect [MYTHIC_TRIAL: Name="The Bridge of Dawn" Description="Riv held the bridge alone" Outcome="passed"]
 * Returns { name, description, outcome } or null
 */
export function detectMythicTrial(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[MYTHIC_TRIAL:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  if (!data.name) {
    console.warn('[Marker] MYTHIC_TRIAL detected but missing Name field:', match[0]);
    return null;
  }
  const validOutcomes = ['passed', 'failed', 'redirected'];
  return {
    name: data.name,
    description: data.description || '',
    outcome: validOutcomes.includes(data.outcome) ? data.outcome : 'passed'
  };
}

/**
 * Detect all [PIETY_CHANGE: Deity="Lathander" Amount=1 Reason="Protected the innocent"] markers.
 * Returns array of { deity, amount, reason } or empty array.
 */
export function detectPietyChange(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[PIETY_CHANGE:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.deity) {
      results.push({
        deity: data.deity,
        amount: parseInt(data.amount) || 0,
        reason: data.reason || ''
      });
    } else {
      console.warn('[Marker] PIETY_CHANGE detected but missing Deity field:', match[0]);
    }
  }
  return results;
}

/**
 * Detect [ITEM_AWAKEN: Item="Dawn's Light" NewState="awakened" Deed="Struck down the shadow demon"]
 * Returns { item, newState, deed } or null
 */
export function detectItemAwaken(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[ITEM_AWAKEN:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  if (!data.item) {
    console.warn('[Marker] ITEM_AWAKEN detected but missing Item field:', match[0]);
    return null;
  }
  const validStates = ['awakened', 'exalted', 'mythic'];
  return {
    item: data.item,
    newState: validStates.includes(data.newstate) ? data.newstate : 'awakened',
    deed: data.deed || ''
  };
}

/**
 * Detect [MYTHIC_SURGE: Ability="divine_surge" Cost=1]
 * Returns { ability, cost } or null
 */
export function detectMythicSurge(narrative) {
  if (!narrative) return null;
  const match = narrative.match(/\[MYTHIC_SURGE:\s*([^\]]+)\]/i);
  if (!match) return null;
  const data = parseMarkerPairs(match[1]);
  if (!data.ability) {
    console.warn('[Marker] MYTHIC_SURGE detected but missing Ability field:', match[0]);
    return null;
  }
  return {
    ability: data.ability,
    cost: parseInt(data.cost) || 1
  };
}

/**
 * Detect [PROMISE_MADE: NPC="Elara" Promise="Return the amulet" Deadline=10]
 * Deadline is optional (in game days from now).
 * Returns array of { npc, promise, deadline } or empty array.
 */
export function detectPromiseMade(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[PROMISE_MADE:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.npc && data.promise) {
      // Validate weight — must be one of the valid levels, default to 'moderate'
      const validWeights = ['trivial', 'minor', 'moderate', 'major', 'critical'];
      const weight = validWeights.includes(data.weight?.toLowerCase()) ? data.weight.toLowerCase() : 'moderate';
      results.push({
        npc: data.npc,
        promise: data.promise,
        deadline: parseInt(data.deadline) || 0, // 0 = no explicit deadline
        weight
      });
    } else {
      console.warn('[Marker] PROMISE_MADE detected but missing NPC or Promise field:', match[0]);
    }
  }
  return results;
}

/**
 * Detect [PROMISE_FULFILLED: NPC="Elara" Promise="Return the amulet"]
 * Returns array of { npc, promise } or empty array.
 */
export function detectPromiseFulfilled(narrative) {
  if (!narrative) return [];
  const results = [];
  const regex = /\[PROMISE_FULFILLED:\s*([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(narrative)) !== null) {
    const data = parseMarkerPairs(match[1]);
    if (data.npc && data.promise) {
      results.push({
        npc: data.npc,
        promise: data.promise
      });
    } else {
      console.warn('[Marker] PROMISE_FULFILLED detected but missing NPC or Promise field:', match[0]);
    }
  }
  return results;
}

// ============================================================
// SESSION ANALYSIS & REWARDS
// ============================================================

/**
 * Build the analysis prompt for session end scoring
 */
export function buildAnalysisPrompt(inventoryList, characterGold) {
  return `The session is ending. Analyze what the party ACTUALLY accomplished.

1. Write a summary (3-4 sentences) of what happened, including the current situation and any plans made.

2. Score each XP category based on ACTUAL accomplishments (0-10 each):

COMBAT: Fighting and defeating enemies
- 0=no combat, 2=minor skirmish/1-2 foes, 4=real fight, 6=challenging battle, 8=major battle, 10=epic war

EXPLORATION: Traveling and discovering locations
- 0=stayed in one place, 2=traveled to new location, 4=explored area thoroughly, 6=found hidden location, 8=major discovery, 10=legendary find

QUESTS: Completing objectives and missions (THIS IS IMPORTANT)
- Escorting someone safely = 3-5 depending on danger
- Rescuing someone = 4-6 depending on difficulty
- Delivering items/messages = 2-4
- Completing a mission for an NPC = 3-6
- Side objectives accomplished = 2-4 each
- 0=no objectives completed, 3=minor task done, 5=significant mission, 7=major quest milestone, 10=campaign-defining achievement

DISCOVERY: Uncovering secrets, plots, and information
- Learning important information = 2-3
- Uncovering a deception or lie = 3-4
- Discovering an enemy's plan = 4-5
- Finding crucial evidence = 3-5
- Major plot revelation = 6-8
- 0=learned nothing new, 3=useful intel, 5=significant secret, 8=major revelation, 10=world-changing truth

SOCIAL: Building relationships and alliances
- Making a new ally = 2-3
- Deepening an existing relationship = 2-3
- Recruiting a companion = 4-5
- Negotiating successfully = 2-4
- Earning trust of important NPC = 3-5
- 0=no meaningful interactions, 3=friendship formed, 5=strong bond built, 8=life-changing connection, 10=legendary alliance

DANGER: Risk faced during the session (affects XP multiplier)
- 0=completely safe, 3=some risk, 5=real danger, 8=near death, 10=facing certain doom

3. Track INVENTORY CHANGES:
The character's current inventory is: ${inventoryList || 'empty'}
The character's current gold: ${characterGold}

Format EXACTLY like this:
SUMMARY: [What happened and current situation]
COMBAT: [0-10]
EXPLORATION: [0-10]
QUESTS: [0-10]
DISCOVERY: [0-10]
SOCIAL: [0-10]
DANGER: [0-10]
ITEMS_CONSUMED: [item1 x quantity, item2 x quantity] or [none]
GOLD_SPENT: [X gp, Y sp, Z cp] or [none]
ITEMS_GAINED: [item1, item2] or [none]`;
}

/**
 * Parse AI analysis response into structured rewards data
 */
export function parseAnalysisResponse(analysisResponse) {
  const lines = analysisResponse.split('\n');
  const summaryLine = lines.find(l => l.startsWith('SUMMARY:'));
  const summary = summaryLine ? summaryLine.replace('SUMMARY:', '').trim() : 'The adventure concluded.';

  const scores = {
    combat: parseInt(lines.find(l => l.startsWith('COMBAT:'))?.match(/\d+/)?.[0]) || 0,
    exploration: parseInt(lines.find(l => l.startsWith('EXPLORATION:'))?.match(/\d+/)?.[0]) || 0,
    quests: parseInt(lines.find(l => l.startsWith('QUESTS:'))?.match(/\d+/)?.[0]) || 0,
    discovery: parseInt(lines.find(l => l.startsWith('DISCOVERY:'))?.match(/\d+/)?.[0]) || 0,
    social: parseInt(lines.find(l => l.startsWith('SOCIAL:'))?.match(/\d+/)?.[0]) || 0,
    danger: parseInt(lines.find(l => l.startsWith('DANGER:'))?.match(/\d+/)?.[0]) || 0
  };

  // Parse inventory changes
  const itemsConsumedLine = lines.find(l => l.startsWith('ITEMS_CONSUMED:'));
  const goldSpentLine = lines.find(l => l.startsWith('GOLD_SPENT:'));
  const itemsGainedLine = lines.find(l => l.startsWith('ITEMS_GAINED:'));

  const parseItems = (line, prefix) => {
    if (!line) return [];
    const content = line.replace(prefix, '').trim();
    if (content.toLowerCase() === '[none]' || content.toLowerCase() === 'none' || content === '[]') return [];
    const cleaned = content.replace(/^\[|\]$/g, '').trim();
    if (!cleaned) return [];
    return cleaned.split(',').map(item => item.trim()).filter(Boolean);
  };

  const parseGold = (line) => {
    if (!line) return { gp: 0, sp: 0, cp: 0 };
    const content = line.replace('GOLD_SPENT:', '').trim();
    if (content.toLowerCase() === '[none]' || content.toLowerCase() === 'none' || content === '[]') {
      return { gp: 0, sp: 0, cp: 0 };
    }
    const gp = parseInt(content.match(/(\d+)\s*gp/i)?.[1]) || 0;
    const sp = parseInt(content.match(/(\d+)\s*sp/i)?.[1]) || 0;
    const cp = parseInt(content.match(/(\d+)\s*cp/i)?.[1]) || 0;
    return { gp, sp, cp };
  };

  scores.inventoryChanges = {
    consumed: parseItems(itemsConsumedLine, 'ITEMS_CONSUMED:'),
    gained: parseItems(itemsGainedLine, 'ITEMS_GAINED:'),
    goldSpent: parseGold(goldSpentLine)
  };

  return { summary, rewardsAnalysis: scores };
}

/**
 * Calculate session rewards based on AI analysis scores
 */
export function calculateSessionRewards(character, durationHours, analysis) {
  const baseXP = getBaseXPReward(character.level);
  const timeMultiplier = Math.min(2, Math.max(0.5, durationHours)) / 2;

  const weights = {
    combat: 0.25,
    exploration: 0.15,
    quests: 0.30,
    discovery: 0.15,
    social: 0.05
  };

  const combatXP = Math.floor(baseXP * weights.combat * (analysis.combat / 10));
  const explorationXP = Math.floor(baseXP * weights.exploration * (analysis.exploration / 10));
  const questsXP = Math.floor(baseXP * weights.quests * (analysis.quests / 10));
  const discoveryXP = Math.floor(baseXP * weights.discovery * (analysis.discovery / 10));
  const socialXP = Math.floor(baseXP * weights.social * (analysis.social / 10));

  const subtotalXP = combatXP + explorationXP + questsXP + discoveryXP + socialXP;
  const dangerBonus = analysis.danger / 10 * 0.30;
  const dangerXP = Math.floor(subtotalXP * dangerBonus);
  const totalXP = Math.floor((subtotalXP + dangerXP) * timeMultiplier);

  const dangerLevel = analysis.danger >= 7 ? 'high' : analysis.danger >= 4 ? 'medium' : 'low';
  const goldMultiplier = timeMultiplier * (analysis.quests / 10);
  const gold = calculateGoldReward(character.level, dangerLevel, goldMultiplier);

  let loot = null;
  const lootChance = (analysis.combat + analysis.exploration + analysis.danger) / 30;
  if (lootChance > 0.2 && Math.random() < lootChance * 0.4) {
    loot = generateLoot(character.level, dangerLevel) || generateLoot(character.level, 'high');
  }

  return {
    xp: totalXP,
    gold,
    loot,
    breakdown: {
      baseXP,
      categories: {
        combat: { score: analysis.combat, xp: combatXP },
        exploration: { score: analysis.exploration, xp: explorationXP },
        quests: { score: analysis.quests, xp: questsXP },
        discovery: { score: analysis.discovery, xp: discoveryXP },
        social: { score: analysis.social, xp: socialXP }
      },
      dangerBonus: { score: analysis.danger, xp: dangerXP },
      subtotal: subtotalXP,
      timeMultiplier: Math.round(timeMultiplier * 100) / 100
    }
  };
}

/**
 * Calculate HP change based on combat and danger scores
 */
export function calculateHPChange(character, analysis) {
  let hpChange = 0;
  if (analysis.combat > 3) {
    const damageRisk = (analysis.combat + analysis.danger) / 2;
    const maxDamage = Math.floor(character.max_hp * 0.4);
    hpChange = -Math.floor(maxDamage * (damageRisk / 10) * 0.5);
  }
  if (analysis.quests >= 5 && analysis.combat <= 2 && analysis.danger <= 3) {
    const missingHp = character.max_hp - character.current_hp;
    hpChange = Math.floor(missingHp * 0.25);
  }
  return hpChange;
}

/**
 * Calculate in-game time advancement based on activity scores
 */
export function calculateGameTimeAdvance(analysis) {
  const activityLevel = (analysis.combat + analysis.exploration + analysis.quests + analysis.social) / 40;
  return Math.max(1, Math.ceil(activityLevel * 3));
}

// ============================================================
// CAMPAIGN NOTES EXTRACTION
// ============================================================

/**
 * Build the extraction prompt for campaign notes
 */
export function buildNotesExtractionPrompt() {
  return `Extract ONLY the important details from this session that should be remembered for future adventures. Be concise and specific.

Format your response as bullet points under these categories (skip any category with nothing to report):

NPCS MET:
- [Name]: [Brief description, relationship to player, any promises made]

ITEMS GIVEN OR RECEIVED:
- [What was given/received, to/from whom]

PROMISES & OBLIGATIONS:
- [What was promised, to whom, what's expected]

KEY RELATIONSHIPS:
- [Person]: [Nature of relationship - ally, enemy, employer, friend, etc.]

IMPORTANT LOCATIONS:
- [Place]: [Why it matters]

UNRESOLVED THREADS:
- [Plot hooks, mysteries, or tasks left incomplete]

ONLY include things that ACTUALLY happened. Be specific with names and details. Keep each bullet to one line.`;
}

/**
 * Append extracted notes to character's campaign notes with size management
 */
export async function appendCampaignNotes(characterId, existingNotes, newNotes, sessionTitle, gameDay, gameYear) {
  const sessionDate = dayToDate(gameDay, gameYear);
  const newNotesSection = `\n\n--- Session: ${sessionTitle} (${sessionDate.formatted}) ---\n${newNotes}`;

  let updatedNotes = existingNotes + newNotesSection;
  // No cap — unlimited disk storage. Chronicle system handles what the AI sees.

  await dbRun('UPDATE characters SET campaign_notes = ? WHERE id = ?', [updatedNotes, characterId]);
  return updatedNotes;
}

// ============================================================
// CHARACTER MEMORY EXTRACTION
// ============================================================

/**
 * Build the extraction prompt for character personality memories.
 * Includes existing memories so the AI can deduplicate and update evolving states.
 */
export function buildMemoryExtractionPrompt(existingMemories) {
  const existingSection = existingMemories && existingMemories.trim().length > 0
    ? `\nALREADY KNOWN (do NOT repeat these — only extract NEW observations or UPDATES to existing ones):\n${existingMemories}\n`
    : '';

  return `Analyze this session for CHARACTER PERSONALITY observations — things that reveal who this character IS as a person. Not what happened to them, but who they ARE.

Extract ONLY observations about the player character's:
- Personal preferences (food, drink, habits, comfort items, things they enjoy or dislike)
- Emotional tendencies (what makes them angry, sad, happy, nostalgic, uncomfortable)
- Moral compass and values (what they refuse to do, what they champion)
- Fears, phobias, or discomforts
- Relationship patterns (trusting, suspicious, loyal, distant)
- Cultural or religious practices they follow
- Attitudes toward specific topics (magic, authority, wealth, violence, specific races/groups)
- Things from their past they've revealed through conversation or inner monologue
- Current preparedness or state (gear adequacy, health concerns, readiness for environments)
${existingSection}
Rules:
- ONLY include things the PLAYER CHARACTER demonstrated through their own dialogue, inner thoughts, or chosen actions
- Do NOT include things the DM narrated happening TO them
- Each observation should be a concise single line
- Focus on PERSONALITY, PREFERENCES, and CURRENT STATE — not plot events
- If an existing memory has CHANGED this session (e.g., they bought proper gear, resolved a fear, changed an opinion), list it under UPDATED
- If nothing new was revealed about the character's personality, respond with exactly: NO_NEW_MEMORIES
- Maximum 5 new observations per session

Format your response with these two sections (omit a section if empty):

NEW:
- [new observation]
- [new observation]

UPDATED:
- OLD: [copy the existing memory text exactly] → NEW: [the updated version]`;
}

/**
 * Parse extraction response and update character memories.
 * Handles both NEW additions and UPDATED replacements for evolving states.
 * Soft cap at 3KB — never trims existing memories, just stops adding when full.
 */
export async function updateCharacterMemories(characterId, existingMemories, extractionResponse) {
  const existing = (existingMemories || '').trim();
  let updated = existing;

  // Parse UPDATED section — replace existing memories with new versions
  const updatedSection = extractionResponse.match(/UPDATED:\s*\n([\s\S]*?)(?=\n(?:NEW:|$)|\s*$)/i);
  if (updatedSection) {
    const updateLines = updatedSection[1].split('\n').filter(l => l.trim().startsWith('- OLD:'));
    for (const line of updateLines) {
      const match = line.match(/- OLD:\s*(.+?)\s*→\s*NEW:\s*(.+)/i);
      if (match) {
        const oldText = match[1].trim();
        const newText = match[2].trim();
        // Find and replace the old memory line (fuzzy: check if existing contains a line similar to oldText)
        const existingLines = updated.split('\n');
        let replaced = false;
        for (let i = 0; i < existingLines.length; i++) {
          const cleanLine = existingLines[i].replace(/^- /, '').trim();
          if (cleanLine && oldText.includes(cleanLine.substring(0, 20)) || cleanLine.includes(oldText.substring(0, 20))) {
            existingLines[i] = `- ${newText}`;
            replaced = true;
            break;
          }
        }
        if (replaced) {
          updated = existingLines.join('\n');
        }
      }
    }
  }

  // Parse NEW section — append new memories
  const newSection = extractionResponse.match(/NEW:\s*\n([\s\S]*?)(?=\n(?:UPDATED:|$)|\s*$)/i);
  if (newSection) {
    const newLines = newSection[1].split('\n')
      .map(l => l.trim())
      .filter(l => l.startsWith('- ') && l.length > 4);

    if (newLines.length > 0) {
      const additions = newLines.join('\n');
      if (updated.length > 0) {
        updated += '\n' + additions;
      } else {
        updated = additions;
      }
    }
  }

  // No cap — unlimited disk storage. Chronicle system handles what the AI sees.

  await dbRun('UPDATE characters SET character_memories = ? WHERE id = ?', [updated, characterId]);
  return updated;
}

// ============================================================
// NPC EXTRACTION
// ============================================================

/**
 * Build the NPC extraction prompt
 */
export function buildNpcExtractionPrompt() {
  return `List ALL named NPCs (non-player characters) who appeared in this session. For each NPC, provide their details in this EXACT format, one per line:

NPC: Name="Full Name" Race="Race" Gender="Male/Female/Other" Occupation="Their role or job" Location="Where encountered" Relationship="ally/neutral/enemy/unknown" Description="One sentence physical or personality description" Voice="speech pattern, accent, verbal tics" Appearance="notable physical features, clothing, distinguishing marks" Personality="core personality trait observed" Mannerism="distinctive gesture or habit" Motivation="what they seem to want or care about"

Rules:
- Only include NPCs with actual names (not "the guard" or "a merchant")
- Include NPCs who were just mentioned or referenced, not just those who spoke
- Use "unknown" for any field you're not sure about
- Do not include the player characters
- Include ALL named characters, even minor ones
- Voice/Appearance/Personality/Mannerism/Motivation are OPTIONAL — only include them if the NPC demonstrated these traits during the session. Use "unknown" or omit for NPCs who were only mentioned or briefly encountered.

If no named NPCs appeared, respond with: NO_NPCS`;
}

/**
 * Parse NPC extraction response and save to database.
 * Uses fill-not-overwrite strategy: personality fields are only written
 * if the NPC's current value is NULL. Each enrichment increments enrichment_level.
 */
export async function saveExtractedNpcs(npcResponse, sessionTitle) {
  const extractedNpcs = [];

  if (!npcResponse || npcResponse.includes('NO_NPCS')) return extractedNpcs;

  const npcLines = npcResponse.split('\n').filter(line => line.startsWith('NPC:'));

  for (const line of npcLines) {
    const parseField = (fieldName) => {
      const match = line.match(new RegExp(`${fieldName}="([^"]+)"`));
      return match ? match[1] : null;
    };

    const name = parseField('Name');
    if (!name || name.toLowerCase() === 'unknown') continue;

    const race = parseField('Race') || 'Human';
    const gender = parseField('Gender');
    const occupation = parseField('Occupation');
    const location = parseField('Location');
    const relationship = parseField('Relationship') || 'neutral';
    const description = parseField('Description');

    // New personality/appearance fields
    const voice = parseField('Voice');
    const appearance = parseField('Appearance');
    const personality = parseField('Personality');
    const mannerism = parseField('Mannerism');
    const motivation = parseField('Motivation');

    const validVal = (v) => v && v !== 'unknown' && v.trim() !== '';

    const existing = await dbGet(
      'SELECT id, voice, personality_trait_1, mannerism, motivation, distinguishing_features, enrichment_level FROM npcs WHERE name = ?',
      [name]
    );

    if (existing) {
      // Fill-not-overwrite: only update fields that are currently NULL
      const updates = [];
      const values = [];

      // Always update location (NPCs move)
      if (validVal(location)) {
        updates.push('current_location = ?');
        values.push(location);
      }

      // Fill personality fields only if currently NULL
      if (validVal(voice) && !existing.voice) {
        updates.push('voice = ?');
        values.push(voice);
      }
      if (validVal(personality) && !existing.personality_trait_1) {
        updates.push('personality_trait_1 = ?');
        values.push(personality);
      }
      if (validVal(mannerism) && !existing.mannerism) {
        updates.push('mannerism = ?');
        values.push(mannerism);
      }
      if (validVal(motivation) && !existing.motivation) {
        updates.push('motivation = ?');
        values.push(motivation);
      }
      if (validVal(appearance) && !existing.distinguishing_features) {
        updates.push('distinguishing_features = ?');
        values.push(appearance);
      }

      // Increment enrichment_level if we actually filled any personality fields
      const personalityFieldsFilled = updates.filter(u =>
        u.startsWith('voice') || u.startsWith('personality_trait_1') ||
        u.startsWith('mannerism') || u.startsWith('motivation') ||
        u.startsWith('distinguishing_features')
      ).length;

      if (personalityFieldsFilled > 0) {
        updates.push('enrichment_level = ?');
        values.push((existing.enrichment_level || 0) + 1);
      }

      if (updates.length > 0) {
        values.push(existing.id);
        await dbRun(`UPDATE npcs SET ${updates.join(', ')} WHERE id = ?`, values);
      }

      extractedNpcs.push({ id: existing.id, name, race, occupation, existing: true });
      continue;
    }

    const result = await dbRun(`
      INSERT INTO npcs (
        name, race, gender, occupation, current_location,
        relationship_to_party, campaign_availability,
        distinguishing_marks, background_notes,
        voice, personality_trait_1, mannerism, motivation, distinguishing_features,
        enrichment_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      name,
      race !== 'unknown' ? race : 'Human',
      gender !== 'unknown' ? gender : null,
      occupation !== 'unknown' ? occupation : null,
      location !== 'unknown' ? location : null,
      relationship !== 'unknown' ? relationship : 'neutral',
      'available',
      description !== 'unknown' ? description : null,
      `First encountered in session: ${sessionTitle}`,
      validVal(voice) ? voice : null,
      validVal(personality) ? personality : null,
      validVal(mannerism) ? mannerism : null,
      validVal(motivation) ? motivation : null,
      validVal(appearance) ? appearance : null,
      (validVal(voice) || validVal(personality) || validVal(mannerism) || validVal(motivation) || validVal(appearance)) ? 1 : 0
    ]);

    extractedNpcs.push({ id: Number(result.lastInsertRowid), name, race, occupation });
  }

  return extractedNpcs;
}

// ============================================================
// USED NAMES TRACKING
// ============================================================

/**
 * Extract NPC names from session messages and track them in campaign config
 */
export async function extractAndTrackUsedNames(messages, characterId) {
  let campaignConfig = {};
  const character = await dbGet('SELECT campaign_config FROM characters WHERE id = ?', [characterId]);
  try {
    campaignConfig = JSON.parse(character?.campaign_config || '{}');
  } catch (e) {
    campaignConfig = {};
  }

  if (!campaignConfig.usedNames || !Array.isArray(campaignConfig.usedNames)) {
    campaignConfig.usedNames = [];
  }

  const nameMatches = [];
  for (const msg of messages) {
    if (msg.role === 'assistant') {
      const matches = msg.content.match(/\b([A-Z][a-z]{2,12})\b(?:\s+(?:says?|asks?|nods?|smiles?|grins?|replies?|responds?|turns?|looks?|whispers?|shakes?|laughs?|frowns?))/g);
      if (matches) {
        for (const match of matches) {
          const name = match.split(/\s+/)[0];
          const nonNames = ['You', 'The', 'Your', 'She', 'He', 'They', 'It', 'This', 'That', 'What', 'When', 'Where', 'Which', 'There'];
          if (!nonNames.includes(name) && !nameMatches.includes(name)) {
            nameMatches.push(name);
          }
        }
      }
    }
  }

  for (const name of nameMatches) {
    if (!campaignConfig.usedNames.includes(name)) {
      campaignConfig.usedNames.push(name);
    }
  }

  // No cap — store all NPC names ever encountered.

  await dbRun('UPDATE characters SET campaign_config = ? WHERE id = ?', [JSON.stringify(campaignConfig), characterId]);
}

// ============================================================
// EVENT EMISSION
// ============================================================

/**
 * Emit gameplay events from session end analysis for quest/companion systems
 */
export async function emitSessionEvents(characterId, campaignId, analysis, extractedNotes, extractedNpcs) {
  const events = [];

  // NPC interactions — emit for each NPC extracted from the session
  for (const npc of extractedNpcs) {
    try {
      await onNpcInteraction(characterId, { id: npc.id, name: npc.name },
        'Interacted during DM session');
      events.push({ type: 'npc_interaction', npc: npc.name });
    } catch (e) {
      console.error(`Error emitting NPC interaction for ${npc.name}:`, e);
    }
  }

  // Location visits — parse from extracted campaign notes
  if (extractedNotes) {
    const locationMatches = extractedNotes.match(/IMPORTANT LOCATIONS:\n([\s\S]*?)(?:\n\n|$)/);
    if (locationMatches) {
      const locations = locationMatches[1].match(/^- (.+?):/gm);
      if (locations) {
        for (const loc of locations) {
          const name = loc.replace(/^- /, '').replace(/:$/, '');
          try {
            await emitLocationVisited(characterId, name, null);
            events.push({ type: 'location_visited', location: name });
          } catch (e) {
            console.error(`Error emitting location visited for ${name}:`, e);
          }
        }
      }
    }
  }

  // Item events — from inventory analysis
  if (analysis.inventoryChanges?.gained?.length > 0) {
    for (const item of analysis.inventoryChanges.gained) {
      try {
        await onItemObtained(characterId, { name: item });
        events.push({ type: 'item_obtained', item });
      } catch (e) {
        console.error(`Error emitting item obtained for ${item}:`, e);
      }
    }
  }

  return events;
}

/**
 * Emit session ended event (triggers companion trigger checker)
 */
export async function emitSessionEndedEvent(session, character, summary, messages) {
  try {
    await onDMSessionEnded(session, character, summary, messages);
  } catch (e) {
    console.error('Error emitting session ended event:', e);
  }
}
