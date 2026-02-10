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
  { name: 'Potion of Heroism', price_gp: 300, price_sp: 0, price_cp: 0, category: 'potion', description: '10 temporary HP and Bless effect (1d4 to attacks/saves) for 1 hour', rarity: 'uncommon' },
  { name: 'Philter of Love', price_gp: 200, price_sp: 0, price_cp: 0, category: 'potion', description: 'Charmed by the next creature you see for 1 hour; regard them as your true love', rarity: 'uncommon' },
  { name: 'Elixir of Health', price_gp: 250, price_sp: 0, price_cp: 0, category: 'potion', description: 'Cures any disease, removes blinded, deafened, paralyzed, and poisoned conditions', rarity: 'uncommon' },
  // Rare potions
  { name: 'Potion of Invisibility', price_gp: 500, price_sp: 0, price_cp: 0, category: 'potion', description: 'Invisible for 1 hour; ends early if you attack or cast a spell', rarity: 'rare' },
  { name: 'Potion of Speed', price_gp: 500, price_sp: 0, price_cp: 0, category: 'potion', description: 'Haste effect for 1 minute — doubled speed, +2 AC, extra action each turn', rarity: 'rare' },
  { name: 'Potion of Flying', price_gp: 500, price_sp: 0, price_cp: 0, category: 'potion', description: 'Gain flying speed equal to walking speed for 1 hour', rarity: 'rare' },
  { name: 'Oil of Etherealness', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Coat yourself to enter the Ethereal Plane for 1 hour; see into the Material Plane', rarity: 'rare' },
  { name: 'Potion of Clairvoyance', price_gp: 500, price_sp: 0, price_cp: 0, category: 'potion', description: 'Cast Clairvoyance — create invisible sensor at a familiar location within 1 mile', rarity: 'rare' },
  { name: 'Potion of Diminution', price_gp: 400, price_sp: 0, price_cp: 0, category: 'potion', description: 'Reduce effect for 1d4 hours — shrink to half size, disadvantage on STR checks', rarity: 'rare' },
  { name: 'Potion of Gaseous Form', price_gp: 300, price_sp: 0, price_cp: 0, category: 'potion', description: 'Become a misty cloud for 1 hour — fly 10ft, pass through tiny cracks, resistance to nonmagical damage', rarity: 'rare' },
  { name: 'Potion of Giant Strength (Hill)', price_gp: 300, price_sp: 0, price_cp: 0, category: 'potion', description: 'Strength becomes 21 for 1 hour', rarity: 'rare' },
  { name: 'Potion of Giant Strength (Frost)', price_gp: 500, price_sp: 0, price_cp: 0, category: 'potion', description: 'Strength becomes 23 for 1 hour', rarity: 'rare' },
  { name: 'Potion of Giant Strength (Fire)', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Strength becomes 25 for 1 hour', rarity: 'rare' },
  { name: 'Potion of Invulnerability', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Resistance to all damage for 1 minute', rarity: 'rare' },
  { name: 'Potion of Supreme Healing', price_gp: 1350, price_sp: 0, price_cp: 0, category: 'potion', description: 'Heals 10d4+20 HP', rarity: 'very_rare' },
  // Very Rare potions
  { name: 'Oil of Sharpness', price_gp: 3000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Coat one weapon or 5 ammo — +3 to attack/damage for 1 hour', rarity: 'very_rare' },
  { name: 'Potion of Longevity', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Your physical age is reduced by 1d6+6 years; 10% cumulative chance of aging 1d6+6 instead', rarity: 'very_rare' },
  { name: 'Potion of Giant Strength (Storm)', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'potion', description: 'Strength becomes 29 for 1 hour', rarity: 'very_rare' },
  // Cursed potion
  { name: 'Potion of Poison', price_gp: 50, price_sp: 0, price_cp: 0, category: 'potion', description: 'Heals 2d4+2 HP', rarity: 'common',
    cursed: true, appears_as: 'Potion of Healing', curse_description: 'Looks, smells, and even tastes like a Potion of Healing. Actually deals 3d6 poison damage and inflicts the poisoned condition. DC 13 CON save for half damage.' },
  // Alchemical items
  { name: 'Acid (vial)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: '2d6 acid damage as improvised weapon', rarity: 'common' },
  { name: "Alchemist's Fire (flask)", price_gp: 50, price_sp: 0, price_cp: 0, category: 'alchemical', description: '1d4 fire damage per turn until extinguished', rarity: 'common' },
  { name: 'Holy Water (flask)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: '2d6 radiant to undead/fiends', rarity: 'common' },
  { name: 'Basic Poison (vial)', price_gp: 100, price_sp: 0, price_cp: 0, category: 'alchemical', description: '1d4 extra poison damage, coat one weapon', rarity: 'common' },
  { name: 'Smokestick', price_gp: 25, price_sp: 0, price_cp: 0, category: 'alchemical', description: 'Creates 10ft cube of smoke for 1 round', rarity: 'common' },
  { name: 'Tanglefoot Bag', price_gp: 50, price_sp: 0, price_cp: 0, category: 'alchemical', description: 'Target restrained, DC 11 STR to escape', rarity: 'common' },
];

const MAGIC_ITEMS = [
  // ========================================
  // SCROLLS
  // ========================================
  // Common
  { name: 'Spell Scroll (Cantrip)', price_gp: 25, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use cantrip', rarity: 'common' },
  { name: 'Spell Scroll (1st Level)', price_gp: 75, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 1st level spell', rarity: 'common' },
  // Uncommon
  { name: 'Spell Scroll (2nd Level)', price_gp: 150, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 2nd level spell', rarity: 'uncommon' },
  { name: 'Spell Scroll (3rd Level)', price_gp: 300, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 3rd level spell', rarity: 'uncommon' },
  // Rare
  { name: 'Spell Scroll (4th Level)', price_gp: 500, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 4th level spell', rarity: 'rare' },
  { name: 'Spell Scroll (5th Level)', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 5th level spell', rarity: 'rare' },
  // Very Rare
  { name: 'Spell Scroll (6th Level)', price_gp: 2500, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 6th level spell', rarity: 'very_rare' },
  { name: 'Spell Scroll (7th Level)', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 7th level spell', rarity: 'very_rare' },
  // Legendary
  { name: 'Spell Scroll (8th Level)', price_gp: 10000, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 8th level spell', rarity: 'legendary' },
  { name: 'Spell Scroll (9th Level)', price_gp: 25000, price_sp: 0, price_cp: 0, category: 'scroll', description: 'Single-use 9th level spell — Wish, Meteor Swarm, True Resurrection...', rarity: 'legendary' },

  // ========================================
  // MAGIC WEAPONS
  // ========================================
  // Common
  { name: 'Moon-Touched Sword', price_gp: 100, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Glows with faint moonlight in darkness; counts as magical for overcoming resistances', rarity: 'common' },
  { name: 'Walloping Ammunition', price_gp: 25, price_sp: 0, price_cp: 0, category: 'weapon', description: 'On hit, target must succeed DC 10 STR save or be knocked prone', rarity: 'common' },
  { name: 'Unbreakable Arrow', price_gp: 15, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Cannot be broken except within an antimagic field', rarity: 'common' },
  // Uncommon
  { name: '+1 Weapon (any)', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack and damage rolls', rarity: 'uncommon' },
  { name: 'Javelin of Lightning', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Speak command word and throw — transforms into a bolt of lightning (4d6 damage, 120ft line, DEX save)', rarity: 'uncommon' },
  { name: 'Weapon of Warning', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Advantage on initiative; you and allies within 30ft can\'t be surprised', rarity: 'uncommon' },
  { name: 'Trident of Fish Command', price_gp: 800, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Cast Dominate Beast on any beast with swimming speed (3 charges, recharges at dawn)', rarity: 'uncommon' },
  // Rare
  { name: '+2 Weapon (any)', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+2 to attack and damage rolls', rarity: 'rare' },
  { name: 'Flame Tongue', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Command word ignites blade — deals extra 2d6 fire damage; sheds bright light 40ft, dim 40ft more', rarity: 'rare' },
  { name: 'Frost Brand', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Deals extra 1d6 cold damage; resistance to fire damage while drawn; sheds bright light in freezing temperatures', rarity: 'rare' },
  { name: 'Sun Blade', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+2 to attack/damage; blade of pure radiance deals extra 1d8 radiant vs undead; sheds sunlight 15ft', rarity: 'rare' },
  { name: 'Dragon Slayer', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack/damage; deals extra 3d6 damage to dragons', rarity: 'rare' },
  { name: 'Giant Slayer', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack/damage; deals extra 2d6 damage to giants and knocks prone on hit', rarity: 'rare' },
  { name: 'Vicious Weapon', price_gp: 2000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'On a natural 20, deals extra 2d6 damage of the weapon\'s type', rarity: 'rare' },
  { name: 'Mace of Disruption', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Extra 2d6 radiant to undead/fiends; if reduced to 25 HP or less, must save or be destroyed', rarity: 'rare' },
  { name: 'Mace of Smiting', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack/damage (+3 vs constructs); critical hits deal extra 2d6 bludgeoning (4d6 vs constructs)', rarity: 'rare' },
  { name: 'Mace of Terror', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: '3 charges — use action to frighten each creature within 30ft (WIS save DC 15)', rarity: 'rare' },
  { name: 'Sword of Life Stealing', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'On a natural 20, deals extra 3d6 necrotic damage and you gain that many temp HP', rarity: 'rare' },
  { name: 'Sword of Wounding', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Wounds cause ongoing 1d4 necrotic at start of target\'s turn; wounds stack; DC 15 CON save to end', rarity: 'rare' },
  { name: 'Dagger of Venom', price_gp: 2500, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 dagger; once per day coat blade in poison — extra 2d10 poison damage, DC 15 CON save or poisoned 1 min', rarity: 'rare' },
  // Very Rare
  { name: '+3 Weapon (any)', price_gp: 16000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+3 to attack and damage rolls', rarity: 'very_rare' },
  { name: 'Dancing Sword', price_gp: 16000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Toss into air with bonus action — fights on its own for 4 rounds, freeing your hands', rarity: 'very_rare' },
  { name: 'Scimitar of Speed', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+2 to attack/damage; grants one extra attack as a bonus action each turn', rarity: 'very_rare' },
  { name: 'Nine Lives Stealer', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+2 sword with 1d8+1 charges; on a natural 20, target under 100 HP must DC 15 CON save or die instantly', rarity: 'very_rare' },
  { name: 'Oathbow', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'weapon', description: 'Swear enemy — +3d6 damage to sworn enemy, advantage on attacks, can\'t use other weapons until enemy dies', rarity: 'very_rare' },
  // Legendary
  { name: 'Vorpal Sword', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+3 to attack/damage; ignore slashing resistance; on a natural 20, severs the head of the target', rarity: 'legendary' },
  { name: 'Holy Avenger', price_gp: 75000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+3 sword; extra 2d10 radiant vs fiends/undead; 10ft aura grants advantage on saves vs spells (paladin only)', rarity: 'legendary' },
  { name: 'Defender', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+3 sword; each turn, transfer any amount of the +3 bonus from attack/damage to AC instead', rarity: 'legendary' },
  { name: 'Luck Blade', price_gp: 60000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 sword; +1 to saves; reroll one attack/check/save per day; 1d3 charges of Wish', rarity: 'legendary' },

  // ========================================
  // MAGIC ARMOR & SHIELDS
  // ========================================
  // Common (XGtE)
  { name: 'Armor of Gleaming', price_gp: 75, price_sp: 0, price_cp: 0, category: 'armor', description: 'This armor never gets dirty; always appears polished and gleaming', rarity: 'common' },
  { name: 'Cast-Off Armor', price_gp: 75, price_sp: 0, price_cp: 0, category: 'armor', description: 'You can doff this armor as an action instead of the normal time', rarity: 'common' },
  { name: 'Smoldering Armor', price_gp: 75, price_sp: 0, price_cp: 0, category: 'armor', description: 'Wisps of harmless, odorless smoke rise from this armor while worn', rarity: 'common' },
  { name: 'Shield of Expression', price_gp: 50, price_sp: 0, price_cp: 0, category: 'shield', description: 'Front of this shield is shaped like a face; as a bonus action, alter the face\'s expression', rarity: 'common' },
  // Uncommon
  { name: '+1 Armor (any)', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'armor', description: '+1 AC on top of armor base', rarity: 'uncommon' },
  { name: '+1 Shield', price_gp: 1500, price_sp: 0, price_cp: 0, category: 'shield', description: '+1 AC on top of shield bonus', rarity: 'uncommon' },
  { name: 'Mithral Armor', price_gp: 800, price_sp: 0, price_cp: 0, category: 'armor', description: 'No Strength requirement, no stealth disadvantage; looks like a fine silvery garment', rarity: 'uncommon' },
  { name: 'Adamantine Armor', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Any critical hit against you becomes a normal hit', rarity: 'uncommon' },
  // Rare
  { name: '+2 Armor (any)', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'armor', description: '+2 AC on top of armor base', rarity: 'rare' },
  { name: '+2 Shield', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'shield', description: '+2 AC on top of shield bonus', rarity: 'rare' },
  { name: 'Armor of Resistance', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Resistance to one type of damage (determined when found)', rarity: 'rare' },
  { name: 'Elven Chain', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Chain shirt +1; can be worn under normal clothes; proficiency not required', rarity: 'rare' },
  { name: 'Glamoured Studded Leather', price_gp: 2000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Studded leather +1; use bonus action to make it look like any clothing or armor', rarity: 'rare' },
  // Very Rare
  { name: '+3 Armor (any)', price_gp: 24000, price_sp: 0, price_cp: 0, category: 'armor', description: '+3 AC on top of armor base', rarity: 'very_rare' },
  { name: '+3 Shield', price_gp: 24000, price_sp: 0, price_cp: 0, category: 'shield', description: '+3 AC on top of shield bonus', rarity: 'very_rare' },
  { name: 'Animated Shield', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'shield', description: 'Bonus action to animate — floats and protects you, freeing both hands for 1 minute', rarity: 'very_rare' },
  { name: 'Spellguard Shield', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'shield', description: 'Advantage on saves vs spells and magical effects; spell attacks have disadvantage against you', rarity: 'very_rare' },
  // Legendary
  { name: 'Armor of Invulnerability', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Resistance to nonmagical damage; once per day, use action to become immune to nonmagical damage for 10 minutes', rarity: 'legendary' },
  { name: 'Plate Armor of Etherealness', price_gp: 60000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Plate armor; once per day cast Etherealness on yourself', rarity: 'legendary' },

  // ========================================
  // WONDROUS ITEMS
  // ========================================
  // Common
  { name: 'Driftglobe', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Casts Light at will; Daylight once per day; hovers and follows you', rarity: 'common' },
  { name: 'Candle of the Deep', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Burns underwater, 5ft bright light', rarity: 'common' },
  { name: 'Charlatan\'s Die', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Whenever you roll this die, you choose the number it shows', rarity: 'common' },
  { name: 'Cloak of Many Fashions', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Use bonus action to change the style, color, and apparent quality of this cloak', rarity: 'common' },
  { name: 'Pot of Awakening', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Plant a shrub seedling; in 30 days it becomes an awakened shrub friendly to you', rarity: 'common' },
  { name: 'Tankard of Sobriety', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Drinking from this tankard renders you immune to being intoxicated', rarity: 'common' },
  { name: 'Ruby of the War Mage', price_gp: 100, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Attach to a weapon — that weapon becomes a spellcasting focus', rarity: 'common' },
  { name: 'Enduring Spellbook', price_gp: 100, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cannot be damaged by fire or submersion; pages never tear', rarity: 'common' },
  { name: 'Staff of Adornment', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Place small object on tip and it hovers 1 inch above, orbiting slowly', rarity: 'common' },
  { name: 'Staff of Flowers', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: '10 charges; use action to cause a flower to sprout from soil or the staff itself', rarity: 'common' },
  // Common — Xanathar's Guide to Everything
  { name: 'Cloak of Billowing', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'As a bonus action, cause this cloak to billow dramatically', rarity: 'common' },
  { name: 'Clockwork Amulet', price_gp: 150, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Once per day, forgo rolling a d20 and instead treat the roll as a 10', rarity: 'common' },
  { name: 'Clothes of Mending', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'This outfit magically mends itself — tears and stains disappear after 1 hour', rarity: 'common' },
  { name: 'Dark Shard Amulet', price_gp: 100, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Warlock spellcasting focus; once per day, attempt to cast a warlock cantrip you don\'t know (DC 10 Arcana)', rarity: 'common' },
  { name: 'Dread Helm', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'This fearsome steel helm makes your eyes glow red while worn', rarity: 'common' },
  { name: 'Ear Horn of Hearing', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While held to your ear, suppresses the effects of the deafened condition', rarity: 'common' },
  { name: 'Ersatz Eye', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Implanted in an empty eye socket, functions like a real eye and can\'t be removed against your will', rarity: 'common' },
  { name: 'Hat of Vermin', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; pull a bat, frog, or rat from this hat — it is a real creature that vanishes after 1 hour', rarity: 'common' },
  { name: 'Hat of Wizardry', price_gp: 100, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Wizard spellcasting focus; once per day, attempt to cast a wizard cantrip you don\'t know (DC 10 Arcana)', rarity: 'common' },
  { name: 'Heward\'s Handy Spice Pouch', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '10 charges; reach in and pull out a pinch of any seasoning — regains 1d6+4 charges at dawn', rarity: 'common' },
  { name: 'Horn of Silent Alarm', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '4 charges; blow the horn — only one creature of your choice within 600ft hears it; regains 1d4 at dawn', rarity: 'common' },
  { name: 'Instrument of Illusions', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While playing this instrument, create harmless illusory visual effects within 5ft of it', rarity: 'common' },
  { name: 'Instrument of Scribing', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While playing, write a magical message of up to 6 words on any surface within 30ft; lasts 24 hours', rarity: 'common' },
  { name: 'Lock of Trickery', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'This lock imposes disadvantage on ability checks made to pick it; a knock spell has no effect on it', rarity: 'common' },
  { name: 'Mystery Key', price_gp: 15, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Has a 5% chance of unlocking any lock into which it is inserted; the key then disappears', rarity: 'common' },
  { name: 'Orb of Direction', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Hold the orb and use an action to determine which direction is north', rarity: 'common' },
  { name: 'Orb of Time', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Hold the orb and use an action to determine whether it is morning, afternoon, evening, or nighttime', rarity: 'common' },
  { name: 'Perfume of Bewitching', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Apply to gain advantage on Charisma checks against humanoids within 5ft for 1 hour (one use)', rarity: 'common' },
  { name: 'Pipe of Smoke Monsters', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Exhale smoke that takes the form of a single creature of your choice — harmless and purely visual', rarity: 'common' },
  { name: 'Pole of Angling', price_gp: 25, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While holding this pole, speak a command word to transform it into a fishing pole with line and hook', rarity: 'common' },
  { name: 'Pole of Collapsing', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'This 10-foot pole can collapse into a 1-foot rod; speak command word to extend or collapse', rarity: 'common' },
  { name: 'Rope of Mending', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'You can cut this 50-foot rope into pieces and reattach them; the pieces knit back together', rarity: 'common' },
  { name: 'Staff of Birdcalls', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '10 charges; use action to create the sound of a bird call; regains 1d6+4 charges at dawn', rarity: 'common' },
  { name: 'Talking Doll', price_gp: 75, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Record up to 6 short phrases; the doll speaks them when specific conditions you choose are met', rarity: 'common' },
  { name: 'Veteran\'s Cane', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Speak a command word to transform this walking cane into a longsword (or back); one transformation per day', rarity: 'common' },
  { name: 'Wand of Conducting', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; wave this wand to create orchestral music heard by all within 60ft; regains at dawn', rarity: 'common' },
  { name: 'Wand of Pyrotechnics', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '7 charges; create a burst of harmless multicolored light at a point within 60ft; regains 1d6+1 at dawn', rarity: 'common' },
  { name: 'Wand of Scowls', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; target a humanoid within 30ft — DC 10 CHA save or they scowl for 1 minute; regains at dawn', rarity: 'common' },
  { name: 'Wand of Smiles', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; target a humanoid within 30ft — DC 10 CHA save or they smile for 1 minute; regains at dawn', rarity: 'common' },
  { name: 'Boots of False Tracks', price_gp: 50, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While wearing, you can choose to leave tracks like those of another humanoid of your size', rarity: 'common' },
  { name: 'Bead of Nourishment', price_gp: 10, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'This spongy, flavorless bead dissolves on your tongue and provides nourishment for one day', rarity: 'common' },
  { name: 'Bead of Refreshment', price_gp: 10, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Drop this bead into up to a pint of liquid to purify it into fresh, clean drinking water', rarity: 'common' },
  // Uncommon
  { name: 'Bag of Holding', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Interior is 64 cubic feet; holds up to 500 lbs but always weighs 15 lbs', rarity: 'uncommon' },
  { name: 'Cloak of Protection', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to AC and all saving throws (requires attunement)', rarity: 'uncommon' },
  { name: 'Goggles of Night', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Darkvision out to 60 feet', rarity: 'uncommon' },
  { name: 'Boots of Elvenkind', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Steps make no sound; advantage on Stealth checks that rely on moving silently', rarity: 'uncommon' },
  { name: 'Gloves of Thievery', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+5 to Sleight of Hand checks and lockpicking; invisible while worn', rarity: 'uncommon' },
  { name: 'Amulet of Proof Against Detection', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Hidden from divination magic; can\'t be targeted by divination or perceived through scrying', rarity: 'uncommon' },
  { name: 'Pearl of Power', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Once per day, recover one expended spell slot of 3rd level or lower', rarity: 'uncommon' },
  { name: 'Bracers of Archery', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Proficiency with longbow and shortbow; +2 to damage rolls with ranged attacks using bows', rarity: 'uncommon' },
  { name: 'Circlet of Blasting', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Once per day, cast Scorching Ray (3 rays, +5 to hit, 2d6 fire each)', rarity: 'uncommon' },
  { name: 'Cloak of the Manta Ray', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While hood is up, breathe underwater and swim speed of 60ft', rarity: 'uncommon' },
  { name: 'Decanter of Endless Water', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Speak command words to produce fresh or salt water — up to 30 gallons/round as a geyser', rarity: 'uncommon' },
  { name: 'Eyes of Charming', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; cast Charm Person (DC 13) on a humanoid within 30ft', rarity: 'uncommon' },
  { name: 'Gauntlets of Ogre Power', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Strength score becomes 19 while wearing these gauntlets', rarity: 'uncommon' },
  { name: 'Gloves of Missile Snaring', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'When hit by a ranged weapon attack, use reaction to reduce damage by 1d10 + DEX; if reduced to 0, catch the missile', rarity: 'uncommon' },
  { name: 'Hat of Disguise', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cast Disguise Self at will; the spell ends if the hat is removed', rarity: 'uncommon' },
  { name: 'Headband of Intellect', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Intelligence score becomes 19 while wearing this headband', rarity: 'uncommon' },
  { name: 'Immovable Rod', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Press button to magically fix the rod in place; holds up to 8,000 lbs; press again to deactivate', rarity: 'uncommon' },
  { name: 'Lantern of Revealing', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Burns for 6 hours; bright light 30ft reveals invisible creatures and objects', rarity: 'uncommon' },
  { name: 'Medallion of Thoughts', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; cast Detect Thoughts (DC 13); recharges 1d3 at dawn', rarity: 'uncommon' },
  { name: 'Necklace of Adaptation', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Breathe normally in any environment; advantage on saves vs harmful gases and vapors', rarity: 'uncommon' },
  { name: 'Pipes of Haunting', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; play to frighten each creature within 30ft that hears (WIS DC 15); recharges 1d3 at dawn', rarity: 'uncommon' },
  { name: 'Rope of Climbing', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: '60ft rope; command word to animate — it knots, unknots, coils, and moves on its own at 10ft/turn', rarity: 'uncommon' },
  { name: 'Sending Stones', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Pair of stones; once per day, cast Sending to the holder of the other stone', rarity: 'uncommon' },
  { name: 'Stone of Good Luck', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to ability checks and saving throws while on your person', rarity: 'uncommon' },
  { name: 'Winged Boots', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Fly speed equal to walking speed for up to 4 hours (recharges 2 hours per 12 hours resting)', rarity: 'uncommon' },
  { name: 'Helm of Comprehending Languages', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While wearing, cast Comprehend Languages at will', rarity: 'uncommon' },
  { name: 'Slippers of Spider Climbing', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Walk on walls and ceilings with hands free, climb speed equal to walking speed', rarity: 'uncommon' },
  { name: 'Dust of Disappearance', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Toss in air — you and all within 10ft become invisible for 2d4 minutes', rarity: 'uncommon' },
  { name: 'Eversmoking Bottle', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Remove stopper to fill 60ft radius with thick smoke (heavily obscured); grows 10ft/round', rarity: 'uncommon' },
  { name: 'Gem of Brightness', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '50 charges; shed bright light 30ft, or fire a beam of light to blind (DEX save DC 15)', rarity: 'uncommon' },
  { name: 'Periapt of Wound Closure', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Stabilize automatically when dying; when you roll Hit Dice to heal, double the HP regained', rarity: 'uncommon' },
  // Uncommon - Wands
  { name: 'Wand of Magic Detection', price_gp: 200, price_sp: 0, price_cp: 0, category: 'wand', description: '3 charges; cast Detect Magic; recharges 1d3 at dawn', rarity: 'uncommon' },
  { name: 'Wand of Magic Missiles', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Magic Missile (1st level or higher); recharges 1d6+1 at dawn', rarity: 'uncommon' },
  { name: 'Wand of Web', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Web (DC 15); recharges 1d6+1 at dawn', rarity: 'uncommon' },
  // Uncommon - Rings
  { name: 'Ring of Jumping', price_gp: 400, price_sp: 0, price_cp: 0, category: 'ring', description: 'Cast Jump on yourself at will (triple jump distance)', rarity: 'uncommon' },
  { name: 'Ring of Mind Shielding', price_gp: 500, price_sp: 0, price_cp: 0, category: 'ring', description: 'Immune to magic that reads thoughts/emotions/truthfulness; can become invisible on your finger', rarity: 'uncommon' },
  { name: 'Ring of Water Walking', price_gp: 400, price_sp: 0, price_cp: 0, category: 'ring', description: 'Stand on and walk across any liquid surface as if it were solid ground', rarity: 'uncommon' },
  { name: 'Ring of Warmth', price_gp: 400, price_sp: 0, price_cp: 0, category: 'ring', description: 'Resistance to cold damage; comfortable in temperatures as low as -50°F', rarity: 'uncommon' },
  // Rare - Wondrous
  { name: 'Ring of Protection', price_gp: 3500, price_sp: 0, price_cp: 0, category: 'ring', description: '+1 to AC and all saving throws', rarity: 'rare' },
  { name: 'Cape of the Mountebank', price_gp: 1200, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Once per day, cast Dimension Door; when you disappear, smoke lightly obscures the space you left', rarity: 'rare' },
  { name: 'Amulet of Health', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Constitution score becomes 19 while wearing this amulet', rarity: 'rare' },
  { name: 'Belt of Dwarvenkind', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+2 CON (max 20); advantage on CHA checks with dwarves; darkvision 60ft; grow a luxuriant beard', rarity: 'rare' },
  { name: 'Belt of Giant Strength (Hill)', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Strength score becomes 21 while wearing this belt', rarity: 'rare' },
  { name: 'Boots of Speed', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Click heels as bonus action — double walking speed, opportunity attacks against you have disadvantage (10 min/day)', rarity: 'rare' },
  { name: 'Cloak of Displacement', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Illusion makes you appear slightly displaced; attack rolls against you have disadvantage (resets if hit or incapacitated)', rarity: 'rare' },
  { name: 'Cloak of the Bat', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Advantage on Stealth in dim/dark; grip edges to fly 40ft; once per day, cast Polymorph into a bat', rarity: 'rare' },
  { name: 'Cloak of Elvenkind', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'While hood is up, Perception checks to see you have disadvantage, and you have advantage on Stealth', rarity: 'uncommon' },
  { name: 'Daern\'s Instant Fortress', price_gp: 8000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Toss cube on ground — expands into a 20ft adamantine tower with arrow slits, 100 HP per panel', rarity: 'rare' },
  { name: 'Figurine of Wondrous Power (Silver Raven)', price_gp: 2000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Transforms into a silver raven for 12 hours; can be used as messenger; obeys your commands', rarity: 'uncommon' },
  { name: 'Figurine of Wondrous Power (Onyx Dog)', price_gp: 3000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Transforms into a mastiff for 6 hours; has darkvision 60ft, +4 Perception; can be used once per week', rarity: 'rare' },
  { name: 'Gem of Seeing', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; gain truesight 120ft for 10 minutes; see through illusions, shapechangers, into the Ethereal Plane', rarity: 'rare' },
  { name: 'Handy Haversack', price_gp: 2000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Like a Bag of Holding but organized — item you want is always on top; weighs 5 lbs regardless of contents', rarity: 'rare' },
  { name: 'Helm of Telepathy', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cast Detect Thoughts at will (DC 13); focus on one creature to cast Suggestion (DC 13) once per day', rarity: 'rare' },
  { name: 'Necklace of Fireballs', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Detach a bead and throw — casts Fireball (5d6 fire, 20ft radius, DEX save DC 15); comes with 1d6+3 beads', rarity: 'rare' },
  { name: 'Periapt of Proof Against Poison', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Immune to poison damage and the poisoned condition', rarity: 'rare' },
  { name: 'Portable Hole', price_gp: 8000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Unfold 6ft circle of black cloth — creates an extradimensional hole 10ft deep; placing inside a Bag of Holding destroys both', rarity: 'rare' },
  { name: 'Rope of Entanglement', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Command word to entangle a creature within 20ft (restrained, DC 20 STR to escape); holds up to 20ft away', rarity: 'rare' },
  { name: 'Wings of Flying', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Speak command word — cloak transforms into wings granting 60ft fly speed for 1 hour; recharges 1d12 hours', rarity: 'rare' },
  { name: 'Ioun Stone of Protection', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Orbits your head; +1 to AC; another creature must use action to catch it (AC 24, 10 HP)', rarity: 'rare' },
  // Rare - Wands & Rods
  { name: 'Wand of Fireballs', price_gp: 8000, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Fireball (5d6+, DEX save DC 15); recharges 1d6+1 at dawn; if last charge, 5% chance wand is destroyed', rarity: 'rare' },
  { name: 'Wand of Lightning Bolts', price_gp: 8000, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Lightning Bolt (8d6, DEX save DC 15); recharges 1d6+1 at dawn', rarity: 'rare' },
  { name: 'Wand of Binding', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Hold Monster (WIS save DC 17) or Hold Person; recharges 1d6+1 at dawn', rarity: 'rare' },
  { name: 'Rod of the Pact Keeper +2', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'rod', description: '+2 to spell attack rolls and spell save DC (warlock only); once per day regain one spell slot', rarity: 'rare' },
  // Rare - Rings
  { name: 'Ring of Evasion', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'ring', description: '3 charges; when you fail a DEX save, use reaction to succeed instead; recharges 1d3 at dawn', rarity: 'rare' },
  { name: 'Ring of Free Action', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Difficult terrain doesn\'t cost extra movement; can\'t be paralyzed or restrained by magic', rarity: 'rare' },
  { name: 'Ring of Spell Storing', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Stores up to 5 levels worth of spells; anyone wearing the ring can cast the stored spells', rarity: 'rare' },
  { name: 'Ring of the Ram', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'ring', description: '3 charges; spectral ram deals 2d10 force per charge spent (60ft range); recharges 1d3 at dawn', rarity: 'rare' },
  { name: 'Ring of X-Ray Vision', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'ring', description: 'See through 1ft stone, 1 inch metal, 3ft wood/dirt as if transparent; 30ft range; exhaustion on extended use', rarity: 'rare' },
  // Very Rare - Wondrous
  { name: 'Amulet of the Planes', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cast Plane Shift (DC 15 INT check; failure sends you to random plane)', rarity: 'very_rare' },
  { name: 'Belt of Giant Strength (Fire)', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Strength score becomes 25 while wearing this belt', rarity: 'very_rare' },
  { name: 'Belt of Giant Strength (Frost)', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Your Strength score becomes 23 while wearing this belt', rarity: 'very_rare' },
  { name: 'Carpet of Flying', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Speak command word to fly at 60ft speed; carries up to 400 lbs (speed halved over 200)', rarity: 'very_rare' },
  { name: 'Cloak of Arachnida', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Resistance to poison; spider climb at will; immune to being caught in webs; can walk on webs freely', rarity: 'very_rare' },
  { name: 'Crystal Ball', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Cast Scrying at will (WIS DC 17); see and hear through the sensor; 10-minute duration', rarity: 'very_rare' },
  { name: 'Ioun Stone of Mastery', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Orbits your head; increases proficiency bonus by 1', rarity: 'very_rare' },
  { name: 'Manual of Bodily Health', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Spend 48 hours reading — your CON score increases by 2 (max 24); book crumbles, reforms in 100 years', rarity: 'very_rare' },
  { name: 'Manual of Gainful Exercise', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Spend 48 hours reading — your STR score increases by 2 (max 24); book crumbles, reforms in 100 years', rarity: 'very_rare' },
  { name: 'Tome of Clear Thought', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Spend 48 hours reading — your INT score increases by 2 (max 24); book crumbles, reforms in 100 years', rarity: 'very_rare' },
  { name: 'Tome of Understanding', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Spend 48 hours reading — your WIS score increases by 2 (max 24); book crumbles, reforms in 100 years', rarity: 'very_rare' },
  { name: 'Tome of Leadership and Influence', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Spend 48 hours reading — your CHA score increases by 2 (max 24); book crumbles, reforms in 100 years', rarity: 'very_rare' },
  { name: 'Robe of Stars', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to saves; 6 charges to cast Magic Missile (5th level); enter the Astral Plane at will', rarity: 'very_rare' },
  // Very Rare - Rings
  { name: 'Ring of Regeneration', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Regain 1d6 HP every 10 minutes if you have at least 1 HP; regrow severed body parts over 1d6+1 days', rarity: 'very_rare' },
  { name: 'Ring of Telekinesis', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Cast Telekinesis at will — move up to 1,000 lbs or exert force on creatures (contested check)', rarity: 'very_rare' },
  // Very Rare - Staves & Wands
  { name: 'Staff of Fire', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'staff', description: '10 charges; cast Burning Hands, Fireball, or Wall of Fire; recharges 1d6+4 at dawn', rarity: 'very_rare' },
  { name: 'Staff of Frost', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'staff', description: '10 charges; cast Cone of Cold, Fog Cloud, Ice Storm, Wall of Ice; recharges 1d6+4 at dawn', rarity: 'very_rare' },
  { name: 'Staff of Power', price_gp: 25000, price_sp: 0, price_cp: 0, category: 'staff', description: '+2 to attack/damage/AC/saves/spell attack; 20 charges for many spells; retributive strike option (VERY dangerous)', rarity: 'very_rare' },
  { name: 'Wand of Polymorph', price_gp: 12000, price_sp: 0, price_cp: 0, category: 'wand', description: '7 charges; cast Polymorph (WIS save DC 15); recharges 1d6+1 at dawn', rarity: 'very_rare' },
  { name: 'Rod of Absorption', price_gp: 15000, price_sp: 0, price_cp: 0, category: 'rod', description: 'Absorb spells targeted at you — store their energy and use it to fuel your own spells (up to 50 levels)', rarity: 'very_rare' },
  // Legendary - Wondrous
  { name: 'Apparatus of Kwalish', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'A barrel-shaped iron vehicle that unfolds into a giant mechanical lobster; swims, walks, and has pincers', rarity: 'legendary' },
  { name: 'Cloak of Invisibility', price_gp: 75000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Pull hood up to become invisible (2 hours total use, recharges at dawn); one of the fabled Deathly Hallows', rarity: 'legendary' },
  { name: 'Deck of Many Things', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Draw cards to receive powerful boons or devastating curses — gain wealth, lose your soul, summon Death itself', rarity: 'legendary' },
  { name: 'Efreeti Bottle', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Open to release an efreeti — 10% serves you, 80% grants 3 wishes, 10% attacks you', rarity: 'legendary' },
  { name: 'Iron Flask', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Trap an extraplanar creature inside (WIS save); already contains a captured creature (GM determines)', rarity: 'legendary' },
  { name: 'Sphere of Annihilation', price_gp: 60000, price_sp: 0, price_cp: 0, category: 'wondrous', description: '2ft black sphere that destroys all matter it touches; control with DC 25 Arcana; compete for control with opposed checks', rarity: 'legendary' },
  { name: 'Talisman of Pure Good', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'wondrous', description: '7 charges; hurl at evil creature — it opens a flaming fissure beneath them (good-aligned attunement only)', rarity: 'legendary' },
  // Legendary - Rings
  { name: 'Ring of Djinni Summoning', price_gp: 60000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Summon a djinni to serve you for 1 hour; obeys your commands; once per day', rarity: 'legendary' },
  { name: 'Ring of Three Wishes', price_gp: 100000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Contains 1d3 charges of the Wish spell — the most powerful magic in existence', rarity: 'legendary' },
  { name: 'Ring of Spell Turning', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Advantage on saves vs spells targeting only you; on a successful save, spell is reflected back at the caster', rarity: 'legendary' },
  // Legendary - Staves & Rods
  { name: 'Robe of the Archmagi', price_gp: 75000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Base AC 15 + DEX; advantage on saves vs spells; +2 to spell attack rolls and save DCs', rarity: 'legendary' },
  { name: 'Rod of Lordly Might', price_gp: 50000, price_sp: 0, price_cp: 0, category: 'rod', description: '+3 mace that transforms into flame tongue, battleaxe, spear, battering ram, climbing pole, or compass', rarity: 'legendary' },
  { name: 'Staff of the Magi', price_gp: 100000, price_sp: 0, price_cp: 0, category: 'staff', description: '+2 to spell attacks; absorb spells; 50 charges for many powerful spells; retributive strike (sorcerer/warlock/wizard)', rarity: 'legendary' },

  // ========================================
  // CURSED ITEMS (appear as normal items)
  // ========================================
  { name: 'Bag of Devouring', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Interior is 64 cubic feet; holds up to 500 lbs but always weighs 15 lbs', rarity: 'uncommon',
    cursed: true, appears_as: 'Bag of Holding', curse_description: 'Not a bag — actually the mouth of an extradimensional creature. Items placed inside are destroyed. 50% chance reaching inside pulls you in to be devoured.' },
  { name: 'Berserker Axe', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack and damage rolls with this greataxe', rarity: 'rare',
    cursed: true, appears_as: '+1 Greataxe', curse_description: 'You can\'t part with the axe and have disadvantage with other weapons. When hostile creatures are nearby, DC 15 WIS save or go berserk, attacking nearest creature (friend or foe).' },
  { name: 'Sword of Vengeance', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'weapon', description: '+1 to attack and damage rolls with this longsword', rarity: 'uncommon',
    cursed: true, appears_as: '+1 Longsword', curse_description: 'Houses a vengeful spirit. You can\'t part with the sword. When you take damage, DC 15 WIS save or you must attack that creature until it drops or you can\'t reach it.' },
  { name: 'Armor of Vulnerability', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'armor', description: 'Resistance to one type of damage (determined when found)', rarity: 'rare',
    cursed: true, appears_as: 'Armor of Resistance', curse_description: 'Actually grants VULNERABILITY to two other damage types. Can\'t remove the armor once attuned; Remove Curse lets you doff it.' },
  { name: 'Shield of Missile Attraction', price_gp: 6000, price_sp: 0, price_cp: 0, category: 'shield', description: '+2 AC on top of shield bonus', rarity: 'rare',
    cursed: true, appears_as: '+2 Shield', curse_description: 'Every ranged weapon attack against targets within 10ft of you is redirected to target you instead. You\'re a magnet for arrows.' },
  { name: 'Cloak of Poisonousness', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: '+1 to AC and all saving throws (requires attunement)', rarity: 'uncommon',
    cursed: true, appears_as: 'Cloak of Protection', curse_description: 'When you don and attune, you are subjected to a DC 13 CON save or be poisoned permanently until Remove Curse is cast. While poisoned, you take 1 poison damage per minute.' },
  { name: 'Necklace of Strangulation', price_gp: 500, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Breathe normally in any environment; advantage on saves vs harmful gases', rarity: 'uncommon',
    cursed: true, appears_as: 'Necklace of Adaptation', curse_description: 'Once donned, the necklace constricts and begins strangling you. You can\'t breathe and start suffocating. DC 21 STR check or Remove Curse to remove it.' },
  { name: 'Dust of Sneezing and Choking', price_gp: 300, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Toss in air to become invisible for 2d4 minutes', rarity: 'uncommon',
    cursed: true, appears_as: 'Dust of Disappearance', curse_description: 'Instead of invisibility, everyone within 30ft begins uncontrollable sneezing (incapacitated, suffocating). DC 15 CON save each round to end effect.' },
  { name: 'Scarab of Death', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'Advantage on saving throws against necromancy spells and effects', rarity: 'rare',
    cursed: true, appears_as: 'Scarab of Protection', curse_description: 'When you pick it up or attune, it transforms into a real scarab beetle that burrows into your flesh. DC 20 CON save or die; on success, take 10d10 necrotic damage.' },
  { name: 'Medallion of Thought Projection', price_gp: 400, price_sp: 0, price_cp: 0, category: 'wondrous', description: '3 charges; cast Detect Thoughts (DC 13)', rarity: 'uncommon',
    cursed: true, appears_as: 'Medallion of Thoughts', curse_description: 'Instead of detecting others\' thoughts, it broadcasts YOUR thoughts to everyone within 30ft. You don\'t realize this is happening.' },
  { name: 'Ring of Clumsiness', price_gp: 4000, price_sp: 0, price_cp: 0, category: 'ring', description: 'Difficult terrain doesn\'t cost extra movement; can\'t be paralyzed or restrained by magic', rarity: 'rare',
    cursed: true, appears_as: 'Ring of Free Action', curse_description: 'Actually makes you clumsy — disadvantage on DEX checks and saves, and your speed is halved. Can\'t remove without Remove Curse.' },
  { name: 'Deck of Illusions', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'wondrous', description: 'A deck of cards with powerful magical effects...', rarity: 'rare',
    cursed: true, appears_as: 'Deck of Many Things', curse_description: 'Cards create only illusions, not real effects. The "castle" is an illusion, the "gold" vanishes, and the wielder looks foolish. Not technically dangerous, but deeply disappointing.' },
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
  // 1000gp gems
  { name: 'Diamond', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Brilliant transparent white stone', rarity: 'rare' },
  { name: 'Black Opal', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent dark green with black flecks and golden highlights', rarity: 'rare' },
  { name: 'Jacinth', price_gp: 1000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Transparent fiery orange', rarity: 'rare' },
  // 5000gp gems
  { name: 'Flawless Diamond', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Perfect clarity, brilliant fire — a stone fit for a crown', rarity: 'very_rare' },
  { name: 'Star Sapphire', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent blue with white star-shaped center — priceless to collectors', rarity: 'very_rare' },
  { name: 'Black Star Sapphire', price_gp: 5000, price_sp: 0, price_cp: 0, category: 'gem', description: 'Translucent black with white star center — said to contain captured starlight', rarity: 'very_rare' },
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

// Derived pool: magic weapons, armor, and shields for blacksmiths (non-cursed only)
const MAGIC_WEAPONS_ARMOR = MAGIC_ITEMS.filter(i =>
  ['weapon', 'armor', 'shield'].includes(i.category) && !i.cursed
);

const POOL_MAP = {
  adventuring_gear: ADVENTURING_GEAR,
  weapons: ALL_WEAPONS,
  armor: ALL_ARMOR,
  ammunition: AMMUNITION,
  tools: TOOLS,
  potions_consumables: POTIONS_CONSUMABLES,
  magic_items: MAGIC_ITEMS,
  magic_weapons_armor: MAGIC_WEAPONS_ARMOR,
  gems_jewelry: GEMS_JEWELRY,
  leather_goods: LEATHER_GOODS,
  clothing: CLOTHING,
};

const MERCHANT_TYPE_POOLS = {
  general:    ['adventuring_gear', 'tools', 'ammunition'],
  blacksmith: ['weapons', 'armor', 'ammunition', 'magic_weapons_armor'],
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
  poor:          { priceMultiplier: 0.80, maxRarity: 'uncommon',   itemRange: [5, 8],   goldPurse: 200,
                   magicCaps: { uncommon: 1, rare: 0, very_rare: 0, legendary: 0 }, cursedChance: 0.15 },
  modest:        { priceMultiplier: 0.90, maxRarity: 'rare',       itemRange: [8, 12],  goldPurse: 350,
                   magicCaps: { uncommon: 3, rare: 1, very_rare: 0, legendary: 0 }, cursedChance: 0.08 },
  comfortable:   { priceMultiplier: 1.00, maxRarity: 'rare',       itemRange: [10, 15], goldPurse: 500,
                   magicCaps: { uncommon: 5, rare: 2, very_rare: 0, legendary: 0 }, cursedChance: 0.05 },
  wealthy:       { priceMultiplier: 1.10, maxRarity: 'very_rare',  itemRange: [12, 18], goldPurse: 1200,
                   magicCaps: { uncommon: 8, rare: 3, very_rare: 1, legendary: 0 }, cursedChance: 0.03 },
  aristocratic:  { priceMultiplier: 1.20, maxRarity: 'legendary',  itemRange: [15, 22], goldPurse: 2500,
                   magicCaps: { uncommon: 10, rare: 4, very_rare: 2, legendary: 1 }, cursedChance: 0.02 },
};

const RARITY_ORDER = { common: 0, uncommon: 1, rare: 2, very_rare: 3, legendary: 4 };

// ============================================================
// INVENTORY GENERATION
// ============================================================

function filterByRarity(items, maxRarity) {
  const maxLevel = RARITY_ORDER[maxRarity] ?? 0;
  return items.filter(item => (RARITY_ORDER[item.rarity] ?? 0) <= maxLevel);
}

function filterByLevel(items, characterLevel) {
  return items.filter(item => {
    if (item.rarity === 'legendary' && characterLevel < 13) return false;
    if (item.rarity === 'very_rare' && characterLevel < 9) return false;
    if (item.rarity === 'rare' && characterLevel < 5) return false;
    if (item.rarity === 'uncommon' && characterLevel < 3) return false;
    return true;
  });
}

function weightedRandomSelect(items, count) {
  if (items.length === 0) return [];
  if (items.length <= count) return [...items];

  const weights = items.map(item => {
    if (item.rarity === 'legendary') return 0.25;
    if (item.rarity === 'very_rare') return 0.5;
    if (item.rarity === 'rare') return 1;
    if (item.rarity === 'uncommon') return 3;
    return 6; // common
  });

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
  if (rarity === 'legendary') return 1;
  if (rarity === 'very_rare') return 1;
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

  // Separate cursed items — they get injected independently
  const cursedPool = allItems.filter(i => i.cursed);
  allItems = allItems.filter(i => !i.cursed);

  // Filter by rarity and character level
  allItems = filterByRarity(allItems, config.maxRarity);
  allItems = filterByLevel(allItems, characterLevel);

  // Determine count within range
  const [minItems, maxItems] = config.itemRange;
  const targetCount = minItems + Math.floor(Math.random() * (maxItems - minItems + 1));

  // Randomly select items (weighted toward common/cheaper)
  let selected = weightedRandomSelect(allItems, targetCount);

  // Enforce rarity caps — limit how many uncommon+ items appear per shop
  // This prevents a poor village shop from being overloaded with valuable items
  if (config.magicCaps) {
    const rarityCounts = {};
    selected = selected.filter(item => {
      if (RARITY_ORDER[item.rarity] < RARITY_ORDER['uncommon']) return true; // common always passes

      const rarity = item.rarity;
      rarityCounts[rarity] = (rarityCounts[rarity] || 0) + 1;
      const cap = config.magicCaps[rarity];
      if (cap !== undefined && rarityCounts[rarity] > cap) return false;
      return true;
    });
  }

  // Cursed item injection: chance to slip a cursed item into the inventory
  // Replaces an existing item of the same rarity to maintain caps (the fake replaces the real deal)
  if (config.cursedChance && cursedPool.length > 0 && Math.random() < config.cursedChance) {
    let eligibleCursed = filterByRarity(cursedPool, config.maxRarity);
    eligibleCursed = filterByLevel(eligibleCursed, characterLevel);
    if (eligibleCursed.length > 0) {
      const cursedItem = eligibleCursed[Math.floor(Math.random() * eligibleCursed.length)];
      // Try to swap out an existing item of the same rarity (the fake replaces a real item)
      const sameRarityIdx = selected.findIndex(i => i.rarity === cursedItem.rarity);
      if (sameRarityIdx >= 0) {
        selected[sameRarityIdx] = cursedItem;
      } else {
        // No same-rarity item to replace — add it anyway (cursed items are always worth including)
        selected.push(cursedItem);
      }
    }
  }

  // Apply prosperity price modifier and randomize quantities
  return selected.map(item => ({
    name: item.cursed ? item.appears_as : item.name,
    price_gp: Math.round(item.price_gp * config.priceMultiplier * 100) / 100,
    price_sp: Math.round(item.price_sp * config.priceMultiplier),
    price_cp: Math.round(item.price_cp * config.priceMultiplier),
    category: item.category,
    description: item.description || '',
    quantity: getQuantityByRarity(item.rarity),
    rarity: item.rarity,
    // Cursed items appear as their disguise but carry the truth underneath
    ...(item.cursed ? {
      cursed: true,
      true_name: item.name,
      curse_description: item.curse_description
    } : {})
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
