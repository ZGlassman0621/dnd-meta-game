/**
 * Merchant Loot Tables — D&D 5e PHB-based item pools for procedural merchant inventory generation.
 * Items are sourced from client/src/data/equipment.json where possible, with additional
 * potions, magic items, gems, and specialty goods defined here.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load equipment data from client
const equipmentData = JSON.parse(
  readFileSync(join(__dirname, '../../client/src/data/equipment.json'), 'utf-8')
);

// ============================================================
// COST PARSING UTILITY
// ============================================================

function parseCostString(costStr) {
  if (!costStr) return { gp: 0, sp: 0, cp: 0 };
  const str = costStr.toLowerCase().trim();
  let gp = 0, sp = 0, cp = 0;
  const gpMatch = str.match(/([\d,.]+)\s*gp/);
  const spMatch = str.match(/([\d,.]+)\s*sp/);
  const cpMatch = str.match(/([\d,.]+)\s*cp/);
  if (gpMatch) gp = parseFloat(gpMatch[1].replace(',', ''));
  if (spMatch) sp = parseFloat(spMatch[1].replace(',', ''));
  if (cpMatch) cp = parseFloat(cpMatch[1].replace(',', ''));
  return { gp, sp, cp };
}

// ============================================================
// ITEM POOLS FROM EQUIPMENT.JSON
// ============================================================

const ALL_WEAPONS = [
  ...equipmentData.simpleWeapons.melee,
  ...equipmentData.simpleWeapons.ranged,
  ...equipmentData.martialWeapons.melee,
  ...equipmentData.martialWeapons.ranged
].map(w => ({
  name: w.name,
  price_gp: w.costGp || 0,
  price_sp: 0,
  price_cp: 0,
  category: 'weapon',
  description: `${w.damage} ${w.damageType}${w.properties?.length ? ' (' + w.properties.join(', ') + ')' : ''}`,
  rarity: w.costGp >= 50 ? 'uncommon' : 'common',
  weight: w.weight || 0
}));

const ALL_ARMOR = [
  ...equipmentData.armor.light,
  ...equipmentData.armor.medium,
  ...equipmentData.armor.heavy,
  ...equipmentData.armor.shields
].map(a => ({
  name: a.name,
  price_gp: a.costGp || 0,
  price_sp: 0,
  price_cp: 0,
  category: 'armor',
  description: a.acBonus ? `+${a.acBonus} AC` : `AC ${a.baseAC} (${a.armorType})`,
  rarity: a.costGp >= 200 ? 'uncommon' : 'common',
  weight: a.weight || 0
}));

const ADVENTURING_GEAR = equipmentData.adventuringGear.map(g => {
  const cost = parseCostString(g.cost);
  return {
    name: g.name,
    price_gp: cost.gp,
    price_sp: cost.sp,
    price_cp: cost.cp,
    category: 'adventuring_gear',
    description: '',
    rarity: 'common',
    weight: parseFloat(g.weight) || 0
  };
});

const AMMUNITION = equipmentData.ammunition.map(a => {
  const cost = parseCostString(a.cost);
  return {
    name: a.name,
    price_gp: cost.gp,
    price_sp: cost.sp,
    price_cp: cost.cp,
    category: 'ammunition',
    description: '',
    rarity: 'common',
    weight: parseFloat(a.weight) || 0
  };
});

const TOOLS = [
  ...(equipmentData.tools.artisansTools || []),
  ...(equipmentData.tools.otherTools || []),
  ...(equipmentData.tools.gamingSets || [])
].map(t => {
  const cost = parseCostString(t.cost);
  return {
    name: t.name,
    price_gp: cost.gp,
    price_sp: cost.sp,
    price_cp: cost.cp,
    category: 'tools',
    description: '',
    rarity: 'common',
    weight: parseFloat(t.weight) || 0
  };
});

// ============================================================
// CUSTOM ITEM POOLS (not in equipment.json)
// ============================================================

const POTIONS_CONSUMABLES = [
  { name: 'Potion of Healing', price_gp: 50, price_sp: 0, price_cp: 0, category: 'potion', description: 'Heals 2d4+2 HP', rarity: 'common' },
  { name: 'Potion of Greater Healing', price_gp: 150, price_sp: 0, price_cp: 0, category: 'potion', description: 'Heals 4d4+4 HP', rarity: 'uncommon' },
  { name: 'Potion of Superior Healing', price_gp: 450, price_sp: 0, price_cp: 0, category: 'potion', description: 'Heals 8d4+8 HP', rarity: 'rare' },
  { name: 'Antitoxin', price_gp: 50, price_sp: 0, price_cp: 0, category: 'potion', description: 'Advantage on saves vs poison for 1 hour', rarity: 'common' },
  { name: 'Potion of Climbing', price_gp: 75, price_sp: 0, price_cp: 0, category: 'potion', description: 'Climbing speed equal to walking for 1 hour', rarity: 'common' },
  { name: 'Potion of Fire Breath', price_gp: 150, price_sp: 0, price_cp: 0, category: 'potion', description: 'Exhale fire, 4d6 damage (DEX save)', rarity: 'uncommon' },
  { name: 'Potion of Resistance', price_gp: 300, price_sp: 0, price_cp: 0, category: 'potion', description: 'Resistance to one damage type for 1 hour', rarity: 'uncommon' },
  { name: 'Potion of Water Breathing', price_gp: 100, price_sp: 0, price_cp: 0, category: 'potion', description: 'Breathe underwater for 1 hour', rarity: 'uncommon' },
  { name: 'Oil of Slipperiness', price_gp: 200, price_sp: 0, price_cp: 0, category: 'potion', description: 'Freedom of Movement for 8 hours', rarity: 'uncommon' },
  { name: 'Potion of Animal Friendship', price_gp: 100, price_sp: 0, price_cp: 0, category: 'potion', description: 'Cast Animal Friendship (save DC 13) for 1 hour', rarity: 'uncommon' },
  { name: 'Potion of Growth', price_gp: 250, price_sp: 0, price_cp: 0, category: 'potion', description: 'Enlarge effect for 1d4 hours', rarity: 'uncommon' },
  // Alchemical items
  { name: 'Acid (vial)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: '2d6 acid damage as improvised weapon', rarity: 'common' },
  { name: "Alchemist's Fire (flask)", price_gp: 50, price_sp: 0, price_cp: 0, category: 'alchemical', description: '1d4 fire damage per turn until extinguished', rarity: 'common' },
  { name: 'Holy Water (flask)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: '2d6 radiant to undead/fiends', rarity: 'common' },
  { name: 'Basic Poison (vial)', price_gp: 100, price_sp: 0, price_cp: 0, category: 'alchemical', description: '1d4 extra poison damage, coat one weapon', rarity: 'common' },
  { name: 'Smokestick', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: 'Creates 10ft cube of smoke for 1 round', rarity: 'common' },
  { name: 'Tanglefoot Bag', price_gp: 50, price_sp: 0, price_cp: 0, category: 'alchemical', description: 'Target restrained, DC 11 STR to escape', rarity: 'common' },
];

const MAGIC_ITEMS = [
  // Common
  { name: 'Spell Scroll (Cantrip)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use cantrip', rarity: 'common' },
  { name: 'Spell Scroll (1st Level)', price_gp: 75, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 1st level spell', rarity: 'common' },
  { name: 'Driftglobe', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Casts Light or Daylight', rarity: 'common' },
  { name: 'Candle of the Deep', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Burns underwater, 5ft bright light', rarity: 'common' },
  { name: 'Charlatan\'s Die', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Choose the result of your roll', rarity: 'common' },
  // Uncommon
  { name: 'Spell Scroll (2nd Level)', price_gp: 150, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 2nd level spell', rarity: 'uncommon' },
  { name: 'Spell Scroll (3rd Level)', price_gp: 300, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 3rd level spell', rarity: 'uncommon' },
  { name: 'Wand of Magic Detection', price_gp: 200, price_sp: 0, price_cp: 0, category: 'wand', description: 'Cast Detect Magic (3 charges, recharges at dawn)', rarity: 'uncommon' },
  { name: 'Bag of Holding', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Holds 500 lbs in extradimensional space', rarity: 'uncommon' },
  { name: 'Cloak of Protection', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to AC and saving throws', rarity: 'uncommon' },
  { name: 'Goggles of Night', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Darkvision 60ft', rarity: 'uncommon' },
  { name: 'Boots of Elvenkind', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Advantage on Stealth checks', rarity: 'uncommon' },
  { name: 'Gloves of Thievery', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+5 to Sleight of Hand and lockpicking', rarity: 'uncommon' },
  { name: 'Amulet of Proof Against Detection', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Hidden from divination magic', rarity: 'uncommon' },
  { name: 'Pearl of Power', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Recover one expended spell slot (3rd or lower)', rarity: 'uncommon' },
  // Rare
  { name: 'Spell Scroll (4th Level)', price_gp: 500, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 4th level spell', rarity: 'rare' },
  { name: 'Spell Scroll (5th Level)', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 5th level spell', rarity: 'rare' },
  { name: '+1 Weapon (any)', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack and damage rolls', rarity: 'rare' },
  { name: '+1 Shield', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'armor', description: '+1 AC on top of shield bonus', rarity: 'rare' },
  { name: '+1 Armor (any)', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'armor', description: '+1 AC on top of armor base', rarity: 'rare' },
  { name: 'Ring of Protection', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to AC and saving throws', rarity: 'rare' },
  { name: 'Cape of the Mountebank', price_gp: 1200, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cast Dimension Door once per day', rarity: 'rare' },
];

const GEMS_JEWELRY = [
  // 10gp gems
  { name: 'Agate', price_gp: 10, price_sp: 0, price_cp: 0, category: 'gem', description: 'Banded, eye, or moss variety', rarity: 'common' },
  { name: 'Quartz', price_gp: 10, price_sp: 0, price_cp: 0, category: 'gem', description: 'Blue, smoky, or rose crystal', rarity: 'common' },
  { name: 'Turquoise', price_gp: 10, price_sp: 0, price_cp: 0, category: 'gem', description: 'Opaque blue-green stone', rarity: 'common' },
  { name: 'Lapis Lazuli', price_gp: 10, price_sp: 0, price_cp: 0, category: 'gem', description: 'Opaque dark blue with gold flecks', rarity: 'common' },
  // 50gp gems
  { name: 'Moonstone', price_gp: 50, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent white with pale blue shimmer', rarity: 'common' },
  { name: 'Jade', price_gp: 50, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent deep green', rarity: 'common' },
  { name: 'Onyx', price_gp: 50, price_sp: 0, price_cp: 0, category: 'gem', description: 'Opaque black bands', rarity: 'common' },
  { name: 'Citrine', price_gp: 50, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent pale yellow-brown', rarity: 'common' },
  // 100gp gems
  { name: 'Pearl', price_gp: 100, price_sp: 0, price_cp: 0, category: 'gem', description: 'Lustrous white, pink, or silver orb', rarity: 'uncommon' },
  { name: 'Garnet', price_gp: 100, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent red, brown-green, or violet', rarity: 'uncommon' },
  { name: 'Amber', price_gp: 100, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent golden, often with inclusions', rarity: 'uncommon' },
  // 500gp gems
  { name: 'Topaz', price_gp: 500, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent golden yellow', rarity: 'rare' },
  { name: 'Star Ruby', price_gp: 500, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent red with star-shaped highlight', rarity: 'rare' },
  { name: 'Sapphire', price_gp: 500, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent deep blue', rarity: 'rare' },
  // Jewelry
  { name: 'Silver Ring', price_gp: 25, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Simple silver band', rarity: 'common' },
  { name: 'Gold Ring', price_gp: 75, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Polished gold band', rarity: 'common' },
  { name: 'Gold Necklace', price_gp: 150, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Fine gold chain', rarity: 'uncommon' },
  { name: 'Silver Brooch', price_gp: 50, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Ornate silver pin with filigree', rarity: 'common' },
  { name: 'Gem-Studded Bracelet', price_gp: 250, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Gold bracelet set with small gems', rarity: 'uncommon' },
  { name: 'Platinum Signet Ring', price_gp: 500, price_sp: 0, price_cp: 0, category: 'jewelry', description: 'Engraved platinum ring of office', rarity: 'rare' },
];

const LEATHER_GOODS = [
  // Leather armor from equipment.json
  ...ALL_ARMOR.filter(a => ['Leather Armor', 'Studded Leather', 'Hide', 'Padded'].includes(a.name)),
  // Additional leather items
  { name: 'Leather Satchel', price_gp: 1, price_sp: 0, price_cp: 0, category: 'leather', description: 'Durable leather messenger bag', rarity: 'common' },
  { name: 'Belt Pouch', price_gp: 0, price_sp: 5, price_cp: 0, category: 'leather', description: 'Small leather pouch for coins', rarity: 'common' },
  { name: 'Quiver', price_gp: 1, price_sp: 0, price_cp: 0, category: 'leather', description: 'Holds 20 arrows or bolts', rarity: 'common' },
  { name: 'Leather Gloves', price_gp: 0, price_sp: 5, price_cp: 0, category: 'leather', description: 'Sturdy work gloves', rarity: 'common' },
  { name: 'Leather Boots', price_gp: 1, price_sp: 0, price_cp: 0, category: 'leather', description: 'Travel-worn leather boots', rarity: 'common' },
  { name: 'Leather Belt', price_gp: 0, price_sp: 5, price_cp: 0, category: 'leather', description: 'Standard leather belt', rarity: 'common' },
  { name: 'Saddlebags', price_gp: 4, price_sp: 0, price_cp: 0, category: 'leather', description: 'Leather bags that drape over a mount', rarity: 'common' },
  { name: 'Scroll Case (leather)', price_gp: 1, price_sp: 0, price_cp: 0, category: 'leather', description: 'Waterproof tube for maps and scrolls', rarity: 'common' },
  { name: 'Waterskin', price_gp: 0, price_sp: 2, price_cp: 0, category: 'leather', description: 'Holds 4 pints of liquid', rarity: 'common' },
];

const CLOTHING = [
  { name: "Traveler's Clothes", price_gp: 2, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Practical road-worn attire', rarity: 'common' },
  { name: "Common Clothes", price_gp: 0, price_sp: 5, price_cp: 0, category: 'clothing', description: 'Simple everyday garments', rarity: 'common' },
  { name: "Fine Clothes", price_gp: 15, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Elegant attire for social occasions', rarity: 'common' },
  { name: "Costume Clothes", price_gp: 5, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Theatrical costume with accessories', rarity: 'common' },
  { name: "Cloak", price_gp: 1, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Standard hooded traveling cloak', rarity: 'common' },
  { name: "Fur Cloak", price_gp: 10, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Heavy fur-lined cloak for cold weather', rarity: 'common' },
  { name: "Silk Robes", price_gp: 30, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Flowing robes of fine silk', rarity: 'uncommon' },
  { name: "Vestments", price_gp: 5, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Religious ceremonial garments', rarity: 'common' },
  { name: "Scholar's Robes", price_gp: 8, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Academic robes with deep pockets', rarity: 'common' },
  { name: "Noble's Outfit", price_gp: 75, price_sp: 0, price_cp: 0, category: 'clothing', description: 'Expensive ensemble fit for court', rarity: 'uncommon' },
  { name: "Winter Blanket", price_gp: 0, price_sp: 5, price_cp: 0, category: 'clothing', description: 'Heavy wool blanket', rarity: 'common' },
  { name: "Hat, Wide-Brimmed", price_gp: 0, price_sp: 5, price_cp: 0, category: 'clothing', description: 'Keeps sun and rain off your face', rarity: 'common' },
  { name: "Scarf, Wool", price_gp: 0, price_sp: 2, price_cp: 0, category: 'clothing', description: 'Warm knitted scarf', rarity: 'common' },
];

// ============================================================
// MERCHANT TYPE → ITEM POOL MAPPINGS
// ============================================================

const POOL_MAP = {
  adventuring_gear: ADVENTURING_GEAR,
  weapons: ALL_WEAPONS,
  armor: ALL_ARMOR,
  ammunition: AMMUNITION,
  tools: TOOLS,
  potions_consumables: POTIONS_CONSUMABLES,
  magic_items: MAGIC_ITEMS,
  gems_jewelry: GEMS_JEWELRY,
  leather_goods: LEATHER_GOODS,
  clothing: CLOTHING,
};

const MERCHANT_TYPE_POOLS = {
  general:    ['adventuring_gear', 'tools', 'ammunition'],
  blacksmith: ['weapons', 'armor', 'ammunition'],
  alchemist:  ['potions_consumables'],
  magic:      ['magic_items', 'potions_consumables'],
  jeweler:    ['gems_jewelry'],
  tanner:     ['leather_goods'],
  tailor:     ['clothing'],
};

// ============================================================
// PROSPERITY CONFIGURATION
// ============================================================

export const PROSPERITY_CONFIG = {
  poor:          { priceMultiplier: 0.80, maxRarity: 'common',   itemRange: [5, 8],   goldPurse: 200  },
  modest:        { priceMultiplier: 0.90, maxRarity: 'uncommon', itemRange: [8, 12],  goldPurse: 350  },
  comfortable:   { priceMultiplier: 1.00, maxRarity: 'uncommon', itemRange: [10, 15], goldPurse: 500  },
  wealthy:       { priceMultiplier: 1.10, maxRarity: 'rare',     itemRange: [12, 18], goldPurse: 800  },
  aristocratic:  { priceMultiplier: 1.20, maxRarity: 'rare',     itemRange: [15, 20], goldPurse: 1200 },
};

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2 };

// ============================================================
// INVENTORY GENERATION
// ============================================================

function filterByRarity(items, maxRarity) {
  const maxLevel = RARITY_ORDER[maxRarity] ?? 0;
  return items.filter(item => (RARITY_ORDER[item.rarity] ?? 0) <= maxLevel);
}

function filterByLevel(items, characterLevel) {
  // Rare items only available at level 5+, uncommon at level 3+
  return items.filter(item => {
    if (item.rarity === 'rare' && characterLevel < 5) return false;
    if (item.rarity === 'uncommon' && characterLevel < 3) return false;
    return true;
  });
}

function weightedRandomSelect(items, count) {
  if (items.length === 0) return [];
  if (items.length <= count) return [...items];

  // Weight: common items 3x more likely than uncommon, 6x more than rare
  const weights = items.map(item => {
    if (item.rarity === 'rare') return 1;
    if (item.rarity === 'uncommon') return 3;
    return 6; // common
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const selected = [];
  const available = items.map((item, i) => ({ item, weight: weights[i] }));

  while (selected.length < count && available.length > 0) {
    let rand = Math.random() * available.reduce((sum, a) => sum + a.weight, 0);
    let idx = 0;
    for (let i = 0; i < available.length; i++) {
      rand -= available[i].weight;
      if (rand <= 0) { idx = i; break; }
    }
    selected.push(available[idx].item);
    available.splice(idx, 1);
  }

  return selected;
}

function getQuantityByRarity(rarity) {
  if (rarity === 'rare') return 1;
  if (rarity === 'uncommon') return 1 + Math.floor(Math.random() * 2); // 1-2
  return 1 + Math.floor(Math.random() * 5); // 1-5
}

/**
 * Generate a randomized merchant inventory.
 * @param {string} merchantType - general|blacksmith|alchemist|magic|jeweler|tanner|tailor
 * @param {string} prosperity - poor|modest|comfortable|wealthy|aristocratic
 * @param {number} characterLevel - Player level for scaling item availability
 * @returns {Array} Items with { name, price_gp, price_sp, price_cp, category, description, quantity, rarity }
 */
export function generateInventory(merchantType, prosperity, characterLevel = 1) {
  const config = PROSPERITY_CONFIG[prosperity] || PROSPERITY_CONFIG.comfortable;
  const poolKeys = MERCHANT_TYPE_POOLS[merchantType] || MERCHANT_TYPE_POOLS.general;

  // Gather all eligible items from the relevant pools
  let allItems = [];
  for (const key of poolKeys) {
    const pool = POOL_MAP[key];
    if (pool) allItems.push(...pool);
  }

  // Filter by rarity and character level
  allItems = filterByRarity(allItems, config.maxRarity);
  allItems = filterByLevel(allItems, characterLevel);

  // Determine count within range
  const [minItems, maxItems] = config.itemRange;
  const targetCount = minItems + Math.floor(Math.random() * (maxItems - minItems + 1));

  // Randomly select items (weighted toward common/cheaper)
  const selected = weightedRandomSelect(allItems, targetCount);

  // Apply prosperity price modifier and randomize quantities
  return selected.map(item => ({
    name: item.name,
    price_gp: Math.round(item.price_gp * config.priceMultiplier * 100) / 100,
    price_sp: Math.round(item.price_sp * config.priceMultiplier),
    price_cp: Math.round(item.price_cp * config.priceMultiplier),
    category: item.category,
    description: item.description || '',
    quantity: getQuantityByRarity(item.rarity),
    rarity: item.rarity
  }));
}

// ============================================================
// BUYBACK PRICE CALCULATION
// ============================================================

// Build a lookup map of all known items for buyback pricing
const ALL_KNOWN_ITEMS = [
  ...ALL_WEAPONS, ...ALL_ARMOR, ...ADVENTURING_GEAR, ...AMMUNITION,
  ...TOOLS, ...POTIONS_CONSUMABLES, ...MAGIC_ITEMS, ...GEMS_JEWELRY,
  ...LEATHER_GOODS, ...CLOTHING
];

const ITEM_PRICE_LOOKUP = {};
for (const item of ALL_KNOWN_ITEMS) {
  ITEM_PRICE_LOOKUP[item.name.toLowerCase()] = item;
}

/**
 * Calculate buyback price (50% of base price) for an item.
 */
export function calculateBuybackPrice(itemName) {
  const known = ITEM_PRICE_LOOKUP[itemName.toLowerCase()];
  if (known) {
    const totalCp = (known.price_gp || 0) * 100 + (known.price_sp || 0) * 10 + (known.price_cp || 0);
    const halfCp = Math.floor(totalCp / 2);
    return {
      sell_price_gp: Math.floor(halfCp / 100),
      sell_price_sp: Math.floor((halfCp % 100) / 10),
      sell_price_cp: halfCp % 10
    };
  }
  // Unknown item — flat 1gp buyback
  return { sell_price_gp: 1, sell_price_sp: 0, sell_price_cp: 0 };
}

/**
 * Generate buyback prices for a list of player items.
 */
export function generateBuybackPrices(playerItems) {
  return (playerItems || []).map(item => ({
    name: item.name,
    ...calculateBuybackPrice(item.name)
  }));
}

// ============================================================
// ITEM LOOKUP & SIMILARITY
// ============================================================

/**
 * Quality tiers for custom/narrative items. Multiplied against base price.
 */
export const QUALITY_TIERS = {
  standard:   { multiplier: 1.0, label: 'Standard' },
  fine:       { multiplier: 1.5, label: 'Fine' },
  superior:   { multiplier: 2.0, label: 'Superior' },
  masterwork: { multiplier: 3.0, label: 'Masterwork' },
};

/**
 * Look up an item by exact or partial name match.
 * Returns the item from our pools with full pricing, or null.
 */
export function lookupItemByName(itemName) {
  if (!itemName) return null;
  const lower = itemName.toLowerCase();

  // Exact match
  if (ITEM_PRICE_LOOKUP[lower]) return { ...ITEM_PRICE_LOOKUP[lower] };

  // Partial match — item name contains search term or vice versa
  for (const [key, item] of Object.entries(ITEM_PRICE_LOOKUP)) {
    if (key.includes(lower) || lower.includes(key)) return { ...item };
  }

  return null;
}

/**
 * Find items similar to a description within a merchant's type pools.
 * Returns up to `limit` items sorted by relevance.
 */
export function findSimilarItems(searchTerm, merchantType, prosperity, limit = 3) {
  const poolKeys = MERCHANT_TYPE_POOLS[merchantType] || MERCHANT_TYPE_POOLS.general;
  const config = PROSPERITY_CONFIG[prosperity] || PROSPERITY_CONFIG.comfortable;

  let allItems = [];
  for (const key of poolKeys) {
    const pool = POOL_MAP[key];
    if (pool) allItems.push(...pool);
  }
  allItems = filterByRarity(allItems, config.maxRarity);

  const lower = searchTerm.toLowerCase();
  const words = lower.split(/\s+/).filter(w => w.length > 2);

  // Score each item by how many search words match its name, category, or description
  const scored = allItems.map(item => {
    const itemText = `${item.name} ${item.category} ${item.description}`.toLowerCase();
    let score = 0;
    for (const word of words) {
      if (itemText.includes(word)) score += 1;
    }
    // Bonus for name match
    if (item.name.toLowerCase().includes(lower)) score += 3;
    return { item, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => ({
      ...s.item,
      price_gp: Math.round(s.item.price_gp * config.priceMultiplier * 100) / 100,
      price_sp: Math.round(s.item.price_sp * config.priceMultiplier),
      price_cp: Math.round(s.item.price_cp * config.priceMultiplier),
    }));
}

/**
 * Build a priced item entry for a custom/narrative item.
 * If the item exists in our pools, use real pricing with quality modifier.
 * Otherwise, use the AI-suggested price.
 */
export function buildCustomItem({ name, price_gp = 0, quality = 'standard', category = 'adventuring_gear', description = '' }) {
  const tier = QUALITY_TIERS[quality] || QUALITY_TIERS.standard;

  // Try to find a base price from our pools
  const known = lookupItemByName(name);
  const baseGp = known ? known.price_gp : price_gp;
  const baseSp = known ? (known.price_sp || 0) : 0;
  const baseCp = known ? (known.price_cp || 0) : 0;

  return {
    name,
    price_gp: Math.round(baseGp * tier.multiplier * 100) / 100,
    price_sp: Math.round(baseSp * tier.multiplier),
    price_cp: Math.round(baseCp * tier.multiplier),
    category: known ? known.category : category,
    description: description || (known ? known.description : ''),
    quantity: 1,
    rarity: known ? known.rarity : (tier.multiplier >= 2 ? 'uncommon' : 'common'),
    quality: quality !== 'standard' ? tier.label : undefined,
  };
}

/**
 * Get merchant type suggestions for what kind of merchant would carry an item category.
 */
export function getMerchantTypesForCategory(category) {
  const types = [];
  for (const [merchantType, poolKeys] of Object.entries(MERCHANT_TYPE_POOLS)) {
    for (const poolKey of poolKeys) {
      const pool = POOL_MAP[poolKey] || [];
      if (pool.some(item => item.category === category)) {
        types.push(merchantType);
        break;
      }
    }
  }
  return types;
}
