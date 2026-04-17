/**
 * Migration 033: Merchant Orders / Commissions (M2)
 *
 * Custom-order system so players can commission items: "Make me a
 * masterwork longsword with gold inlay." The merchant quotes a price and
 * lead time, player pays a deposit, world time advances, the item becomes
 * ready for pickup on the deadline. On pickup, balance is paid and the
 * item lands in the party inventory.
 *
 * Status flow: pending → ready → collected (happy path)
 *                pending → cancelled (player pulls out, deposit forfeit)
 *                pending → expired (deadline long past, player never came)
 *                ready   → expired (merchant holds only so long)
 */

export async function up(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS merchant_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      character_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      item_spec TEXT,           -- JSON: { description, quality, rarity, category, properties? }
      quoted_price_cp INTEGER NOT NULL,
      deposit_paid_cp INTEGER NOT NULL DEFAULT 0,
      balance_cp INTEGER NOT NULL DEFAULT 0,
      commissioned_game_day INTEGER,
      deadline_game_day INTEGER NOT NULL,
      ready_game_day INTEGER,   -- set when status flips to ready
      collected_game_day INTEGER,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','ready','collected','cancelled','expired')),
      narrative_hook TEXT,      -- optional DM flavor note ("etched with crescent moon")
      merchant_notes TEXT,      -- NPC-side notes the DM can reference
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (merchant_id) REFERENCES merchant_inventories(id) ON DELETE CASCADE,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_merchant_orders_character
    ON merchant_orders(character_id, status)
  `);
  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_merchant_orders_deadline
    ON merchant_orders(status, deadline_game_day)
  `);
}

export async function down(db) {
  await db.execute('DROP INDEX IF EXISTS idx_merchant_orders_deadline');
  await db.execute('DROP INDEX IF EXISTS idx_merchant_orders_character');
  await db.execute('DROP TABLE IF EXISTS merchant_orders');
}
