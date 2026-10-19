/**
 * Migration 070: Bestiary (Combat Pipeline #7).
 * Canonical enemy stats. No more AI-invented HP.
 * COMBAT_START looks up names here first, falls back to AI-provided stats.
 */
export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bestiary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      max_hp INTEGER NOT NULL,
      armor_class INTEGER NOT NULL,
      attack_bonus INTEGER NOT NULL DEFAULT 0,
      damage_dice TEXT NOT NULL DEFAULT '1d6',
      dex_mod INTEGER NOT NULL DEFAULT 0,
      challenge_rating TEXT DEFAULT '0',
      xp_value INTEGER DEFAULT 0,
      source TEXT DEFAULT 'srd' CHECK(source IN ('srd', 'homebrew', 'custom')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await db.execute(`CREATE INDEX IF NOT EXISTS idx_bestiary_name ON bestiary(name)`);
  
  // Seed SRD basics (D&D 2024)
  const seeds = [
    ['goblin', 'Goblin', 7, 15, 4, '1d6+2', 2, '1/4', 50],
    ['orc', 'Orc', 15, 13, 5, '1d12+3', 1, '1/2', 100],
    ['kobold', 'Kobold', 5, 12, 4, '1d4+2', 2, '1/8', 25],
    ['skeleton', 'Skeleton', 13, 13, 4, '1d6+2', 2, '1/4', 50],
    ['zombie', 'Zombie', 22, 8, 3, '1d6+1', -2, '1/4', 50],
    ['wolf', 'Wolf', 11, 13, 4, '2d4+2', 2, '1/4', 50],
    ['giant rat', 'Giant Rat', 7, 12, 4, '1d4+2', 2, '1/8', 25],
    ['bandit', 'Bandit', 11, 12, 3, '1d6+1', 1, '1/8', 25],
    ['cultist', 'Cultist', 9, 12, 3, '1d6+1', 1, '1/8', 25],
    ['ogre', 'Ogre', 59, 11, 6, '2d8+4', -1, '2', 450],
  ];
  for (const [name, display, hp, ac, atk, dmg, dex, cr, xp] of seeds) {
    await db.execute(
      `INSERT OR IGNORE INTO bestiary (name, display_name, max_hp, armor_class, attack_bonus, damage_dice, dex_mod, challenge_rating, xp_value, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'srd')`,
      [name, display, hp, ac, atk, dmg, dex, cr, xp]
    );
  }
}
export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_bestiary_name');
  await db.execute('DROP TABLE IF EXISTS bestiary');
}
