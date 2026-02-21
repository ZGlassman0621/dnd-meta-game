import { createClient } from '@libsql/client';
const db = createClient({ url: 'file:local.db' });

// Disable FK constraints for cleanup
await db.execute('PRAGMA foreign_keys = OFF');

// Get test character IDs and their campaign IDs
const chars = await db.execute("SELECT id, campaign_id FROM characters WHERE name LIKE 'TEST_%'");
const charIds = chars.rows.map(r => r.id);
const campaignIds = [...new Set(chars.rows.map(r => r.campaign_id).filter(Boolean))];

// Also find test campaigns directly
const camps = await db.execute("SELECT id FROM campaigns WHERE name LIKE 'TEST_%'");
for (const r of camps.rows) {
  if (!campaignIds.includes(r.id)) campaignIds.push(r.id);
}

console.log(`Found ${charIds.length} test characters and ${campaignIds.length} test campaigns`);

// Delete related data
for (const cid of campaignIds) {
  await db.execute({ sql: 'DELETE FROM factions WHERE campaign_id = ?', args: [cid] });
  await db.execute({ sql: 'DELETE FROM locations WHERE campaign_id = ?', args: [cid] });
  await db.execute({ sql: 'DELETE FROM quests WHERE campaign_id = ?', args: [cid] });
}

for (const chId of charIds) {
  await db.execute({ sql: 'DELETE FROM dm_sessions WHERE character_id = ?', args: [chId] });
  await db.execute({ sql: 'DELETE FROM companions WHERE recruited_by_character_id = ?', args: [chId] });
}

// Delete characters and campaigns
await db.execute("DELETE FROM characters WHERE name LIKE 'TEST_%'");
await db.execute("DELETE FROM campaigns WHERE name LIKE 'TEST_%'");
for (const cid of campaignIds) {
  await db.execute({ sql: 'DELETE FROM campaigns WHERE id = ?', args: [cid] });
}

// Re-enable FK constraints
await db.execute('PRAGMA foreign_keys = ON');

console.log(`Deleted ${charIds.length} characters, ${campaignIds.length} campaigns, and all related data.`);

const remaining = await db.execute('SELECT COUNT(*) as count FROM characters');
const remainingCamps = await db.execute('SELECT COUNT(*) as count FROM campaigns');
console.log(`Remaining: ${remaining.rows[0].count} characters, ${remainingCamps.rows[0].count} campaigns`);
