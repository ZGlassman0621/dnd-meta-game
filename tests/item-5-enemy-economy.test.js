// tests/item-5-enemy-economy.test.js — combat item 5, enemy action economy.
// Real services, real DB. Assertions never depend on a roll: enemy
// attacks target AC 5 or AC 16 as noted, and only budget fields,
// reasons, and bestiary stats are asserted — never hit or damage.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-item5-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const svc = (rel) => pathToFileURL(path.join(REPO, rel)).href;
const { initDatabase, dbAll, dbGet, dbRun } = await import(svc('server/database.js'));
await initDatabase();
const tl = await import(svc('server/services/turnLedgerService.js'));
const ct = await import(svc('server/services/combatTurnService.js'));
const es = await import(svc('server/services/enemyCombatService.js'));
const pipeline = await import(svc('server/services/markerPipeline.js'));
await import(svc('server/services/combatMarkerService.js')); // registers the item-5 markers + the rest

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

async function addPc(over = {}) {
  const id = await insertRow('characters', {
    name: 'Tester', class: 'Fighter', level: 5,
    current_hp: 40, max_hp: 40, armor_class: 16,
    ability_scores: JSON.stringify({ str: 16, dex: 16, con: 14, int: 10, wis: 12, cha: 8 }),
    skills: JSON.stringify([]),
    ...over
  });
  return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
}

async function addSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, status: 'active' });
}

async function markerResult(text, characterId, sessionId, key) {
  const res = await pipeline.processResponseMarkers(text, { characterId, sessionId });
  const h = res.handlerResults.filter((hr) => hr.schemaKey === key);
  return h.length ? h[0].result : null;
}

const gob = (name) => ({ name, maxHp: 60, armorClass: 5, attackBonus: 3, damageDice: '1d6', dexMod: 1 });

// Fresh fight: pc + session + one enemy, order [enemy, player] unless flipped.
async function setup(enemyName, enemyFirst = true) {
  const pc = await addPc();
  const sessionId = await addSession(pc.id);
  const [row] = await es.createEncounterEnemies(sessionId, 1, [gob(enemyName)]);
  const pk = await tl.ledgerKeyForPlayer(pc.id);
  const ek = `combat:${sessionId}:1:${row.id}`;
  const order = enemyFirst
    ? [{ name: enemyName, type: 'enemy', key: ek }, { name: 'Tester', type: 'player', key: pk }]
    : [{ name: 'Tester', type: 'player', key: pk }, { name: enemyName, type: 'enemy', key: ek }];
  await ct.initializeTurnOrder(sessionId, 1, order);
  const atk = (extra = '') => markerResult(`[ENEMY_ATTACK: Enemy="${enemyName}" Target="Player"${extra}]`, pc.id, sessionId, 'ENEMY_ATTACK');
  return { pc, sessionId, row, atk };
}

group('1. Multiattack pattern: declare, swing, count, complete');
{
  const { pc, sessionId, atk } = await setup('GobA');
  const pre = await atk(' Multiattack="true"');
  ok(pre && pre.success === false && /declare it with MULTIATTACK first/.test(pre.reason), 'pattern swing before declaration is refused with the remedy');
  const decl = await markerResult('[MULTIATTACK: Enemy="GobA" Attacks="Slam,Slam"]', pc.id, sessionId, 'MULTIATTACK');
  ok(decl && decl.success === true && decl.actions.join(',') === 'Slam,Slam', 'MULTIATTACK declares the pattern');
  const s1 = await atk(' Multiattack="true"');
  ok(s1 && s1.success !== false && s1.actionName === 'Slam' && s1.multiattackRemaining === 1, 'first pattern swing names the action, 1 remaining');
  const s2 = await atk(' Multiattack="true"');
  ok(s2 && s2.success !== false && s2.multiattackRemaining === 0, 'second pattern swing completes the pattern');
  const s3 = await atk(' Multiattack="true"');
  ok(s3 && s3.success === false && /completed its multiattack pattern/.test(s3.reason), 'third pattern swing refused, pattern complete');
  const plain = await atk();
  ok(plain && plain.success === false && /completed its multiattack pattern/.test(plain.reason), 'plain attack after a completed pattern refused too');
}

group('2. Bestiary pattern swings resolve with the statblock action');
{
  const { pc, sessionId, atk } = await setup('Air Elemental');
  const decl = await markerResult('[MULTIATTACK: Enemy="Air Elemental" Attacks="Slam,Slam"]', pc.id, sessionId, 'MULTIATTACK');
  ok(decl && decl.success === true, 'Air Elemental pattern declared');
  const s1 = await atk(' Multiattack="true"');
  ok(s1 && s1.success !== false && s1.actionName === 'Slam' && s1.attackBonus === 8 && s1.damageDice === '2d8+5', 'pattern swing uses Slam 8 / 2d8+5, not the row 3 / 1d6');
}

group('3. Attack cap: one swing a turn, fresh again next turn');
{
  const { sessionId, atk } = await setup('GobA');
  const a1 = await atk();
  ok(a1 && a1.success !== false, 'first attack on the turn resolves');
  const a2 = await atk();
  ok(a2 && a2.success === false && /already used its action/.test(a2.reason), 'second plain attack same turn refused');
  await ct.advanceTurn(sessionId, 1); // Tester
  await ct.advanceTurn(sessionId, 1); // GobA again, round 2
  const a3 = await atk();
  ok(a3 && a3.success !== false, 'attack resolves again on the next turn');
}

group('4. Off-turn attacks resolve unenforced and spend nothing');
{
  const { pc, sessionId, atk } = await setup('GobA', false); // Tester first: GobA is off-turn
  const o1 = await atk();
  ok(o1 && o1.success !== false, 'first off-turn attack resolves');
  const o2 = await atk();
  ok(o2 && o2.success !== false, 'second off-turn attack also resolves (no slot cap off-turn)');
  await ct.advanceTurn(sessionId, 1); // now GobA's turn
  const o3 = await atk();
  ok(o3 && o3.success !== false, 'off-turn attacks spent nothing — the on-turn attack still resolves');
  const o4 = await atk();
  ok(o4 && o4.success === false && /already used its action/.test(o4.reason), 'second on-turn attack refused');
}

group('5. Legendary budget: cost, cap, reset, on-turn refusal, incapacitated, Total');
{
  const { pc, sessionId, atk } = await setup('GobA', false); // Tester first: legendary happens off-turn
  const l1 = await atk(' Legendary="true" Cost="1"');
  ok(l1 && l1.success !== false && l1.legendaryRemaining === 2, 'cost-1 legendary leaves 2 of 3');
  const l2 = await atk(' Legendary="true" Cost="2"');
  ok(l2 && l2.success !== false && l2.legendaryRemaining === 0, 'cost-2 legendary empties the budget');
  const l3 = await atk(' Legendary="true"');
  ok(l3 && l3.success === false && /legendary action\(s\) left/.test(l3.reason), 'over-budget legendary refused');
  const sp = await markerResult('[LEGENDARY_SPEND: Enemy="GobA" Cost="1" Effect="tail swipe"]', pc.id, sessionId, 'LEGENDARY_SPEND');
  ok(sp && sp.success === false && /legendary action\(s\) left/.test(sp.reason), 'non-attack spend shares the same empty budget');
  await ct.advanceTurn(sessionId, 1); // GobA's turn: budget resets
  const onTurn = await atk(' Legendary="true"');
  ok(onTurn && onTurn.success === false && /own turn/.test(onTurn.reason), 'legendary refused on the enemy\'s own turn');
  await ct.advanceTurn(sessionId, 1); // Tester again, round 2
  const l4 = await atk(' Legendary="true" Cost="1"');
  ok(l4 && l4.success !== false && l4.legendaryRemaining === 2, 'budget refreshed at the enemy\'s turn start');

  // Incapacitated, fresh fight.
  const inc = await setup('GobB', false);
  await dbRun('UPDATE combat_enemies SET active_conditions = ? WHERE id = ?', [JSON.stringify(['incapacitated']), inc.row.id]);
  const li = await inc.atk(' Legendary="true"');
  ok(li && li.success === false && /incapacitated/.test(li.reason), 'incapacitated legendary refused');

  // LegendaryTotal overwrites the default 3.
  const tot = await setup('GobC', false);
  const t1 = await tot.atk(' Legendary="true" LegendaryTotal="4" Cost="1"');
  ok(t1 && t1.success !== false && t1.legendaryRemaining === 3, 'LegendaryTotal 4 sets the budget');
  const t2 = await tot.atk(' Legendary="true" Cost="3"');
  ok(t2 && t2.success !== false && t2.legendaryRemaining === 0, 'cost-3 spend empties the boosted budget');
}

group('6. Lair: once a round, never the same effect twice in a row');
{
  const { pc, sessionId } = await setup('GobA', false);
  const lair = (effect) => markerResult(`[LAIR_ACTION: Lair="Cave" Effect="${effect}"]`, pc.id, sessionId, 'LAIR_ACTION');
  const r1 = await lair('stalactites fall');
  ok(r1 && r1.success === true && Number.isInteger(r1.round), 'lair acts in round 1');
  const r2 = await lair('stalactites fall');
  ok(r2 && r2.success === false && /already acted/.test(r2.reason), 'second lair action same round refused');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1); // round 2
  const r3 = await lair('stalactites fall');
  ok(r3 && r3.success === false && /twice in a row/.test(r3.reason), 'same effect twice in a row refused');
  const r4 = await lair('flood');
  ok(r4 && r4.success === true && r4.round === r1.round + 1, 'different effect in round 2 succeeds');
}

group('7. Enemy bonus: charged on attacks and Dashes, second spend refused');
{
  const { pc, sessionId, atk } = await setup('GobA');
  await markerResult('[ZONES: Zones="arena" Places="GobA:arena"]', pc.id, sessionId, 'ZONES');
  const d1 = await markerResult('[DASH: Target="GobA" Bonus="true"]', pc.id, sessionId, 'DASH');
  ok(d1 && d1.success === true && d1.bonusSpent === true, 'enemy Dash with Bonus spends the bonus');
  const b1 = await atk(' Bonus="true"');
  ok(b1 && b1.success === false && /bonus action/.test(b1.reason), 'bonus attack after a bonus Dash refused');

  const fresh = await setup('GobD');
  const b2 = await fresh.atk(' Bonus="true"');
  ok(b2 && b2.success !== false && b2.bonusSpent === true, 'bonus attack spends the bonus');
  const b3 = await fresh.atk(' Bonus="true"');
  ok(b3 && b3.success === false && /bonus action/.test(b3.reason), 'second bonus attack refused');
  const d2 = await markerResult('[DASH: Target="GobD" Bonus="true"]', fresh.pc.id, fresh.sessionId, 'DASH');
  ok(d2 && d2.success === false && /bonus action/.test(d2.reason), 'bonus Dash after a spent bonus refused');
}

group('8. Spell slots: ENEMY_SLOTS, casts spend, cantrips free, bestiary seed');
{
  const { pc, sessionId } = await setup('GobA');
  const set = await markerResult('[ENEMY_SLOTS: Enemy="GobA" Slots="1:2"]', pc.id, sessionId, 'ENEMY_SLOTS');
  ok(set && set.success === true && set.slots['1'] === 2, 'ENEMY_SLOTS sets level-1 slots to 2');
  // Item 6 gates attack spells on an attack bonus; GobA is custom, so
  // the test declares one (the point here is cantrips spend no slot).
  const cantrip = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Fire Bolt" AtkBonus="3"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(cantrip && cantrip.success === true && cantrip.slotsRemaining === null, 'cantrip casts with no slot spent');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1); // GobA's turn again
  const c1 = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Magic Missile" Level="1"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(c1 && c1.success === true && c1.slotsRemaining === 1, 'first level-1 cast leaves 1 slot');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  const c2 = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Magic Missile" Level="1"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(c2 && c2.success === true && c2.slotsRemaining === 0, 'second level-1 cast empties the slots');
  await ct.advanceTurn(sessionId, 1);
  await ct.advanceTurn(sessionId, 1);
  const c3 = await markerResult('[ENEMY_CAST: Enemy="GobA" Spell="Magic Missile" Level="1"]', pc.id, sessionId, 'ENEMY_CAST');
  ok(c3 && c3.success === false && /no level-1 spell slot left/.test(c3.reason), 'cast with no slot left refused');

  // Bestiary caster seeds lazily from its statblock.
  const arch = await setup('Archmage');
  const a1 = await markerResult('[ENEMY_CAST: Enemy="Archmage" Spell="Fireball" Level="1"]', arch.pc.id, arch.sessionId, 'ENEMY_CAST');
  ok(a1 && a1.success === true && a1.slotsRemaining === 3, 'Archmage seeds 4 level-1 slots, 3 left after one cast');
  ok(a1 && a1.dc === 17, 'Archmage cast carries the statblock DC 17');
}

group('9. Opportunity attacks bypass the spent action');
{
  const { pc, sessionId, atk } = await setup('GobA');
  const a1 = await atk();
  ok(a1 && a1.success !== false, 'enemy uses its action on its turn');
  const oa = await markerResult('[OPPORTUNITY_ATTACK: Attacker="GobA" Target="Player"]', pc.id, sessionId, 'OPPORTUNITY_ATTACK');
  ok(oa && oa.success === true && oa.reactionConsumed === true && oa.attack && oa.attack.success !== false, 'opportunity attack still resolves after the action is spent');
}

console.log(`Results: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
