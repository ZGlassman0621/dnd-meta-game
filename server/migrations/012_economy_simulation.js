/**
 * Migration 011: Economy Simulation
 *
 * Adds transaction_history column to merchant_inventories for merchant memory system.
 */

export async function up(db) {
  // Add transaction history tracking to merchants
  try {
    await db.execute("ALTER TABLE merchant_inventories ADD COLUMN transaction_history TEXT DEFAULT '[]'");
  } catch (e) {
    if (!e.message?.includes('duplicate column')) throw e;
  }
}

export async function down(db) {
  // SQLite doesn't support DROP COLUMN in older versions — leave column in place
}
