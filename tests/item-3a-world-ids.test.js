// tests/item-3a-world-ids.test.js — combat item 3, Tier 0:
// world-ID registry (migration 092 + worldIdService), real services,
// real databases. Two DBs: the main throwaway DB (initDatabase path,
// service allocation) and a second file DB on which the real 001 +
// 092 migration files run in order, so the backfill is tested with
// the actual migration code, not a re-implementation of it.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item3a-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const wid = await import(svc('server/services/worldIdService.js'));

let passed = 0, failed = 0;
function group(name) { console.log('== ' + name + ' =='); }
function ok(cond, msg) {
  try { assert(cond, msg); passed++; }
  catch (e) { failed++; console.error('FAIL:', msg, '|', e.message); }
}

async function insertRow(table, overrides = {}) {
  const info = await dbAll(`PRAGMA table_info(${table})`);
  const cols = [];
  const vals = [];
  for (const c of info) {
    if (c.name === 'id') continue;
    if (Object.prototype.hasOwnProperty.call(overrides, c.name)) {
      cols.push(c.name); vals.push(overrides[c.name]); continue;
    }
    if (c.notnull && c.dflt_value == null) {
      const t = (c.type || '').toUpperCase();
      cols.push(c.name); vals.push(t.includes('INT') ? 1 : `TEST_${c.name}`);
    }
  }
  const r = await dbRun(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, vals
  );
  return Number(r.lastInsertRowid);
}

group('1. Pure formatting');
{
  ok(wid.formatWorldId(1) === 'ID0000001', '1 formats to ID0000001');
  ok(wid.formatWorldId(42) === 'ID0000042', '42 formats to ID0000042');
  ok(wid.formatWorldId(12345678) === 'ID12345678', 'padding is a minimum width, not a cap');
  ok(wid.parseWorldIdNumber('ID0000042') === 42, 'parse recovers 42');
  ok(wid.parseWorldIdNumber('Goblin') === null, 'non-ID parses to null');
  ok(wid.parseWorldIdNumber(null) === null, 'null parses to null');
  ok(wid.combatFallbackId(7, 2, 9) === 'combat:7:2:9', 'mook fallback key shape');
}

group('2. Service allocation on the main DB (migration 092 already applied by initDatabase)');
{
  const counter = await dbGet('SELECT next_value FROM world_id_counter WHERE id = 1');
  ok(counter && counter.next_value === 1, 'counter starts at 1 on an empty DB');
  const pcId = await insertRow('characters', {
    name: 'Test PC', class: 'Fighter', level: 3, current_hp: 30, max_hp: 30,
    armor_class: 16, ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
  });
  const npcA = await insertRow('npcs', { name: 'Test NPC A' });
  const npcB = await insertRow('npcs', { name: 'Test NPC B' });
  const pcWid = await wid.assignWorldId('characters', pcId);
  ok(pcWid === 'ID0000001', 'first allocation is ID0000001');
  const rowAfter = await dbGet('SELECT world_id FROM characters WHERE id = ?', [pcId]);
  ok(rowAfter.world_id === 'ID0000001', 'PC world ID persisted, read back from the DB');
  const aWid = await wid.assignWorldId('npcs', npcA);
  const bWid = await wid.assignWorldId('npcs', npcB);
  ok(aWid === 'ID0000002' && bWid === 'ID0000003', 'sequence continues across tables (NPCs follow the PC)');
  ok(aWid !== bWid, 'two NPCs never share an ID');
  const again = await wid.assignWorldId('npcs', npcA);
  ok(again === 'ID0000002', 're-assign is idempotent, same ID back');
  const counterAfter = await dbGet('SELECT next_value FROM world_id_counter WHERE id = 1');
  ok(counterAfter.next_value === 4, 'counter advanced exactly once per real assignment (idempotent re-assign consumed nothing)');
  const ghost = await wid.assignWorldId('npcs', 999999);
  ok(ghost === null, 'ghost row assigns nothing');
  const counterGhost = await dbGet('SELECT next_value FROM world_id_counter WHERE id = 1');
  ok(counterGhost.next_value === 4, 'ghost row wasted no number');
  let threw = false;
  try { await wid.assignWorldId('combat_enemies', 1); } catch (e) { threw = true; }
  ok(threw, 'unchecked table name throws instead of interpolating into SQL');
}

group('3. Injected executor (the npcBankService path: no default connection)');
{
  const npcC = await insertRow('npcs', { name: 'Test NPC C' });
  const injected = { dbGet, dbRun, dbAll };
  const cWid = await wid.assignWorldId('npcs', npcC, injected);
  ok(cWid === 'ID0000004', 'injected-db allocation continues the same shared sequence');
  const rowC = await dbGet('SELECT world_id FROM npcs WHERE id = ?', [npcC]);
  ok(rowC.world_id === 'ID0000004', 'injected-db assignment persisted');
}

group('4. Migration 092 backfill, real migration files on a second DB');
{
  const { createClient } = await import('@libsql/client');
  const { runMigrations } = await import(svc('server/migrationRunner.js'));
  const migDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item3a-mig-'));
  const db2Path = path.join(dbDir, 'second.db');
  const client2 = createClient({ url: 'file:' + db2Path });
  try {
    fs.copyFileSync(path.join(REPO, 'server/migrations/001_initial_schema.js'), path.join(migDir, '001_initial_schema.js'));
    await runMigrations(client2, { migrationsDir: migDir });
    // Rows created AFTER 001 but BEFORE 092: exactly the real-DB shape.
    // characters has one more NOT NULL column with no default
    // (experience_to_next_level) that the insertRow helper fills
    // automatically — raw INSERTs must list it explicitly.
    const pcRes = await client2.execute({ sql: `INSERT INTO characters (name, class, level, current_hp, max_hp, current_location, experience_to_next_level) VALUES ('Backfill PC', 'Fighter', 1, 10, 10, 'Town', 1000)`, args: [] });
    const pcId2 = Number(pcRes.lastInsertRowid);
    const n1 = await client2.execute({ sql: `INSERT INTO npcs (name, race) VALUES ('Backfill NPC 1', 'Human')`, args: [] });
    const n2 = await client2.execute({ sql: `INSERT INTO npcs (name, race) VALUES ('Backfill NPC 2', 'Elf')`, args: [] });
    fs.copyFileSync(path.join(REPO, 'server/migrations/092_world_ids.js'), path.join(migDir, '092_world_ids.js'));
    await runMigrations(client2, { migrationsDir: migDir });
    const pcRow = await client2.execute({ sql: 'SELECT world_id FROM characters WHERE id = ?', args: [pcId2] });
    const npcRows = await client2.execute({ sql: 'SELECT world_id FROM npcs ORDER BY id', args: [] });
    const counterRow = await client2.execute({ sql: 'SELECT next_value FROM world_id_counter WHERE id = 1', args: [] });
    ok(pcRow.rows[0].world_id === 'ID0000001', 'backfill: PC takes ID0000001');
    ok(npcRows.rows[0].world_id === 'ID0000002' && npcRows.rows[1].world_id === 'ID0000003', 'backfill: NPCs follow in id order');
    ok(counterRow.rows[0].next_value === 4, 'backfill: counter lands past the last assignment');
    // A post-backfill allocation through the service shape continues at 4.
    const n3 = await client2.execute({ sql: `INSERT INTO npcs (name, race) VALUES ('Backfill NPC 3', 'Dwarf')`, args: [] });
    const n3id = Number(n3.lastInsertRowid);
    const assigned = await wid.assignWorldId('npcs', n3id, {
      dbGet: async (sql, params = []) => (await client2.execute({ sql, args: params })).rows[0] || null,
      dbRun: async (sql, params = []) => {
        const r = await client2.execute({ sql, args: params });
        return { lastInsertRowid: r.lastInsertRowid, changes: r.rowsAffected };
      },
    });
    ok(assigned === 'ID0000004', 'post-backfill allocation continues the sequence');
  } finally {
    client2.close();
  }
}

console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
