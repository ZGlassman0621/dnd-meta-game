// Migration 020: Keeper class support
// Adds columns to characters table for Keeper-specific data:
// - keeper_texts: JSON array of learned text names
// - keeper_recitations: JSON array of chosen recitation names
// - keeper_genre_domain: Primary genre domain name
// - keeper_genre_domain_2: Second genre domain (L15) or null if Genre Mastery chosen
// - keeper_genre_mastery: Boolean - true if deepened primary genre at L15
// - keeper_specialization: 'polymath' or null (subclass stored in existing subclass column)

export const id = 20;
export const name = 'keeper_class';

export async function up(db) {
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_texts TEXT DEFAULT '[]'`);
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_recitations TEXT DEFAULT '[]'`);
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_genre_domain TEXT`);
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_genre_domain_2 TEXT`);
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_genre_mastery INTEGER DEFAULT 0`);
  await db.execute(`ALTER TABLE characters ADD COLUMN keeper_specialization TEXT`);
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN before 3.35.0
  // These columns will just be ignored if migration is rolled back
  console.log('Note: SQLite may not support dropping columns. Columns will remain but be unused.');
}
