/**
 * Spell Catalog (Combat Pipeline #12).
 * Canonical spell data: components, cast time, concentration, etc.
 * D&D 2024 SRD. Expand as needed.
 */

export const SPELL_CATALOG = {
  // Cantrips (level 0)
  'fire bolt': { name: 'Fire Bolt', level: 0, school: 'Evocation', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'eldritch blast': { name: 'Eldritch Blast', level: 0, school: 'Evocation', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'mage hand': { name: 'Mage Hand', level: 0, school: 'Conjuration', castTime: 'action', range: '30 ft', components: ['V', 'S'], concentration: false, duration: '1 minute' },
  'prestidigitation': { name: 'Prestidigitation', level: 0, school: 'Transmutation', castTime: 'action', range: '10 ft', components: ['V', 'S'], concentration: false, duration: 'Up to 1 hour' },
  'sacred flame': { name: 'Sacred Flame', level: 0, school: 'Evocation', castTime: 'action', range: '60 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'chill touch': { name: 'Chill Touch', level: 0, school: 'Necromancy', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: '1 round' },
  'shocking grasp': { name: 'Shocking Grasp', level: 0, school: 'Evocation', castTime: 'action', range: 'Touch', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'vicious mockery': { name: 'Vicious Mockery', level: 0, school: 'Enchantment', castTime: 'action', range: '60 ft', components: ['V'], concentration: false, duration: 'Instantaneous' },
  'guidance': { name: 'Guidance', level: 0, school: 'Divination', castTime: 'action', range: 'Touch', components: ['V', 'S'], concentration: true, duration: '1 minute' },
  'light': { name: 'Light', level: 0, school: 'Evocation', castTime: 'action', range: 'Touch', components: ['V', 'M'], material: 'a firefly', concentration: false, duration: '1 hour' },
  'mage armor': { name: 'Mage Armor', level: 1, school: 'Abjuration', castTime: 'action', range: 'Touch', components: ['V', 'S', 'M'], material: 'a piece of cured leather', concentration: false, duration: '8 hours' },
  'burning hands': { name: 'Burning Hands', level: 1, school: 'Evocation', castTime: 'action', range: 'Self (15 ft cone)', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'charm person': { name: 'Charm Person', level: 1, school: 'Enchantment', castTime: 'action', range: '30 ft', components: ['V', 'S'], concentration: false, duration: '1 hour' },
  'thunderwave': { name: 'Thunderwave', level: 1, school: 'Evocation', castTime: 'action', range: 'Self (15 ft cube)', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'sleep': { name: 'Sleep', level: 1, school: 'Enchantment', castTime: 'action', range: '90 ft', components: ['V', 'S', 'M'], material: 'a pinch of fine sand', concentration: true, duration: '1 minute' },
  'guiding bolt': { name: 'Guiding Bolt', level: 1, school: 'Evocation', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: '1 round' },
  'inflict wounds': { name: 'Inflict Wounds', level: 1, school: 'Necromancy', castTime: 'action', range: 'Touch', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'detect magic': { name: 'Detect Magic', level: 1, school: 'Divination', castTime: 'action', range: 'Self (30 ft)', components: ['V', 'S'], concentration: true, duration: '10 minutes' },
  'scorching ray': { name: 'Scorching Ray', level: 2, school: 'Evocation', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'invisibility': { name: 'Invisibility', level: 2, school: 'Illusion', castTime: 'action', range: 'Touch', components: ['V', 'S', 'M'], material: 'an eyelash encased in gum arabic', concentration: true, duration: '1 hour' },
  'mirror image': { name: 'Mirror Image', level: 2, school: 'Illusion', castTime: 'action', range: 'Self', components: ['V', 'S'], concentration: false, duration: '1 minute' },
  'shatter': { name: 'Shatter', level: 2, school: 'Evocation', castTime: 'action', range: '60 ft', components: ['V', 'S', 'M'], material: 'a chip of mica', concentration: false, duration: 'Instantaneous' },
  'spiritual weapon': { name: 'Spiritual Weapon', level: 2, school: 'Evocation', castTime: 'bonus', range: '60 ft', components: ['V', 'S'], concentration: false, duration: '1 minute' },
  'suggestion': { name: 'Suggestion', level: 2, school: 'Enchantment', castTime: 'action', range: '30 ft', components: ['V', 'M'], material: "a snake's tongue", concentration: true, duration: '8 hours' },
  'lightning bolt': { name: 'Lightning Bolt', level: 3, school: 'Evocation', castTime: 'action', range: 'Self (100 ft line)', components: ['V', 'S', 'M'], material: 'a bit of fur and a rod of amber', concentration: false, duration: 'Instantaneous' },
  'haste': { name: 'Haste', level: 3, school: 'Transmutation', castTime: 'action', range: '30 ft', components: ['V', 'S', 'M'], material: 'a shaving of licorice root', concentration: true, duration: '1 minute' },
  'slow': { name: 'Slow', level: 3, school: 'Transmutation', castTime: 'action', range: '120 ft', components: ['V', 'S', 'M'], material: 'a drop of molasses', concentration: true, duration: '1 minute' },
  'dispel magic': { name: 'Dispel Magic', level: 3, school: 'Abjuration', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'revivify': { name: 'Revivify', level: 3, school: 'Necromancy', castTime: 'action', range: 'Touch', components: ['V', 'S', 'M'], material: 'diamonds worth 300 gp', concentration: false, duration: 'Instantaneous' },
  'polymorph': { name: 'Polymorph', level: 4, school: 'Transmutation', castTime: 'action', range: '60 ft', components: ['V', 'S', 'M'], material: 'a caterpillar cocoon', concentration: true, duration: '1 hour' },
  'banishment': { name: 'Banishment', level: 4, school: 'Abjuration', castTime: 'action', range: '60 ft', components: ['V', 'S', 'M'], material: 'an item distasteful to the target', concentration: true, duration: '1 minute' },
  'dimension door': { name: 'Dimension Door', level: 4, school: 'Conjuration', castTime: 'action', range: '500 ft', components: ['V'], concentration: false, duration: 'Instantaneous' },
  'greater invisibility': { name: 'Greater Invisibility', level: 4, school: 'Illusion', castTime: 'action', range: 'Touch', components: ['V', 'S'], concentration: true, duration: '1 minute' },
  'cone of cold': { name: 'Cone of Cold', level: 5, school: 'Evocation', castTime: 'action', range: 'Self (60 ft cone)', components: ['V', 'S', 'M'], material: 'a small crystal or glass cone', concentration: false, duration: 'Instantaneous' },
  'raise dead': { name: 'Raise Dead', level: 5, school: 'Necromancy', castTime: '1 hour', range: 'Touch', components: ['V', 'S', 'M'], material: 'a diamond worth 500 gp', concentration: false, duration: 'Instantaneous' },
  'teleportation circle': { name: 'Teleportation Circle', level: 5, school: 'Conjuration', castTime: '1 minute', range: '10 ft', components: ['V', 'M'], material: 'rare chalks worth 50 gp', concentration: false, duration: '1 round' },
  
  // Level 1
  'magic missile': { name: 'Magic Missile', level: 1, school: 'Evocation', castTime: 'action', range: '120 ft', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'shield': { name: 'Shield', level: 1, school: 'Abjuration', castTime: 'reaction', range: 'Self', components: ['V', 'S'], concentration: false, duration: '1 round' },
  'cure wounds': { name: 'Cure Wounds', level: 1, school: 'Abjuration', castTime: 'action', range: 'Touch', components: ['V', 'S'], concentration: false, duration: 'Instantaneous' },
  'bless': { name: 'Bless', level: 1, school: 'Enchantment', castTime: 'action', range: '30 ft', components: ['V', 'S', 'M'], material: 'a sprinkling of holy water', concentration: true, duration: '1 minute' },
  'hex': { name: 'Hex', level: 1, school: 'Enchantment', castTime: 'bonus', range: '90 ft', components: ['V', 'S', 'M'], material: 'the petrified eye of a newt', concentration: true, duration: '1 hour' },
  'hunter\'s mark': { name: "Hunter's Mark", level: 1, school: 'Divination', castTime: 'bonus', range: '90 ft', components: ['V'], concentration: true, duration: '1 hour' },
  
  // Level 2
  'hold person': { name: 'Hold Person', level: 2, school: 'Enchantment', castTime: 'action', range: '60 ft', components: ['V', 'S', 'M'], material: 'a small, straight piece of iron', concentration: true, duration: '1 minute' },
  'misty step': { name: 'Misty Step', level: 2, school: 'Conjuration', castTime: 'bonus', range: 'Self', components: ['V'], concentration: false, duration: 'Instantaneous' },
  'web': { name: 'Web', level: 2, school: 'Conjuration', castTime: 'action', range: '60 ft', components: ['V', 'S', 'M'], material: 'a bit of spiderweb', concentration: true, duration: '1 hour' },
  
  // Level 3
  'fireball': { name: 'Fireball', level: 3, school: 'Evocation', castTime: 'action', range: '150 ft', components: ['V', 'S', 'M'], material: 'a tiny ball of bat guano and sulfur', concentration: false, duration: 'Instantaneous' },
  'counterspell': { name: 'Counterspell', level: 3, school: 'Abjuration', castTime: 'reaction', range: '60 ft', components: ['S'], concentration: false, duration: 'Instantaneous' },
  'hypnotic pattern': { name: 'Hypnotic Pattern', level: 3, school: 'Illusion', castTime: 'action', range: '120 ft', components: ['S', 'M'], material: 'a glowing stick of incense or a crystal vial filled with phosphorescent material', concentration: true, duration: '1 minute' },
};

export function lookupSpell(name) {
  if (!name) return null;
  return SPELL_CATALOG[name.toLowerCase().trim()] || null;
}

/**
 * Async lookup: checks custom_spells table first, then SRD catalog.
 * Use this when homebrew spells may exist.
 */
export async function lookupSpellFull(name, dbGet) {
  if (!name || !dbGet) return lookupSpell(name);
  try {
    const row = await dbGet('SELECT * FROM custom_spells WHERE name = LOWER(?) LIMIT 1', [name.trim()]);
    if (row) {
      return {
        name: row.display_name,
        level: row.level,
        school: row.school,
        castTime: row.cast_time,
        range: row.range_text,
        components: row.components ? row.components.split(',').map(s => s.trim()) : [],
        material: row.material_desc || undefined,
        concentration: Boolean(row.concentration),
        duration: row.duration_text,
        custom: true,
      };
    }
  } catch (e) { /* table may not exist yet */ }
  return lookupSpell(name);
}

export function isConcentrationSpell(name) {
  const spell = lookupSpell(name);
  return spell?.concentration === true;
}

export default { SPELL_CATALOG, lookupSpell, isConcentrationSpell };
