import { createClient } from '@libsql/client';
const db = createClient({ url: 'file:local.db' });
const result = await db.execute('SELECT id, name, class, level, campaign_id FROM characters ORDER BY id');
for (const row of result.rows) {
  console.log(`  #${row.id}  ${row.name} (Lv${row.level} ${row.class}) - campaign: ${row.campaign_id || 'none'}`);
}
console.log(`\nTotal: ${result.rows.length} characters`);
