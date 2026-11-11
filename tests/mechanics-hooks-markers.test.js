/**
 * Mechanics-hooks Family 8 — first-slice C-marker tests.
 *
 * Covers design §3.8 / §6 (markers): schema + handler + identity gate
 * + ledger charge + pool spend + refusal cases (no uses, not your
 * turn), for Bend Luck, Tides of Chaos, Preserve Life, Tamed Surge,
 * Telepathic Speech / Awakened Mind, and the kind-C creature shells
 * (Hound of Ill Omen, Accursed Specter, Faithful Summons).
 *
 * Isolated throwaway DB (perception-pre-roll pattern): temp dir becomes
 * CWD before database.js loads, and the runner's shared TURSO env is
 * deleted so database.js uses the local file. Migrations run via
 * initDatabase, including 112 (combat_allies).
 *
 * Random rolls assert invariants (die ranges) — never exact random
 * values. Refusal cases assert the pool/HP state is UNCHANGED, so a
 * refused action consumes nothing.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mechanics-hooks-markers-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const { processResponseMarkers, _hasHandler } = await import(fromRepo('server/services/markerPipeline.js'));
const { validateDmMarkers } = await import(fromRepo('server/services/markerSchemas.js'));
await import(fromRepo('server/services/subclassMarkerService.js'));
const { createEncounterEnemies, getCurrentEncounterSeq } = await import(fromRepo('server/services/enemyCombatService.js'));
const { initializeTurnOrder } = await import(fromRepo('server/services/combatTurnService.js'));
const { ledgerKeyForPlayer, ledgerKeyForCompanion } = await import(fromRepo('server/services/turnLedgerService.js'));
const entity = await import(fromRepo('server/services/entityService.js'));
const markers = await import(fromRepo('server/services/subclassMarkerService.js'));

// ---------------------------------------------------------------------------
// Fixture helpers (insertRow pattern: PRAGMA-driven NOT NULL fill)
// ---------------------------------------------------------------------------

let widCounter = 0;
function nextWorldId(prefix) { widCounter += 1; return `${prefix}-${widCounter}`; }

async function insertRow(table, overrides = {}) {
  const cols = await db.dbAll(`PRAGMA table_info(${table})`);
  const names = [];
  const values = [];
  for (const col of cols) {
    if (col.pk && col.type.toUpperCase().includes('INT')) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, col.name)) {
      names.push(col.name); values.push(overrides[col.name]);
    } else if (col.notnull) {
      names.push(col.name);
      const t = col.type.toUpperCase();
      values.push(t.includes('INT') || t.includes('REAL') || t.includes('NUM') ? 0 : 'x');
    }
  }
  const placeholders = names.map(() => '?').join(',');
  const r = await db.dbRun(`INSERT INTO ${table} (${names.join(',')}) VALUES (${placeholders})`, values);
  return Number(r.lastInsertRowid);
}

function abilities({ str = 10, dex = 12, con = 14, int = 10, wis = 10, cha = 10 } = {}) {
  return JSON.stringify({ str, dex, con, int, wis, cha });
}

async function makePc({ name, cls, subclass, level, cha = 10, wis = 10, int = 10, hp = 40, resources = '{"used":{}}' } = {}) {
  return insertRow('characters', {
    name, class: cls, subclass, level,
    ability_scores: abilities({ cha, wis, int }),
    class_resources_json: resources,
    current_hp: hp, max_hp: hp,
    world_id: nextWorldId('pc'),
  });
}

async function makeCompanion(pcId, { name, cls, subclass, level, cha = 10, wis = 10, int = 10, hp = 40, resources = '{"used":{}}' } = {}) {
  const npcId = await insertRow('npcs', { name, world_id: nextWorldId('npc') });
  const compId = await insertRow('companions', {
    recruited_by_character_id: pcId, npc_id: npcId, status: 'active',
    companion_class: cls, companion_subclass: subclass, companion_level: level,
    companion_ability_scores: abilities({ cha, wis, int }),
    class_resources_json: resources,
    companion_current_hp: hp, companion_max_hp: hp,
  });
  return { npcId, compId };
}

async function makeSession(pcId) {
  return insertRow('dm_sessions', { character_id: pcId, session_config: '{}' });
}

async function readResources(kind, id) {
  const table = kind === 'player' ? 'characters' : 'companions';
  const row = await db.dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  return JSON.parse(row?.class_resources_json || '{}');
}

async function setResources(kind, id, resources) {
  const table = kind === 'player' ? 'characters' : 'companions';
  await db.dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(resources), id]);
}

async function usedPool(kind, id, key) {
  return Number((await readResources(kind, id)).used?.[key] || 0);
}

async function startCombat(sessionId, first, second) {
  await createEncounterEnemies(sessionId, 1, [
    { name: 'GobA', maxHp: 10, armorClass: 12, attackBonus: 3, damageDice: '1d6', dexMod: 1 },
  ]);
  const firstKey = first.kind === 'player'
    ? await ledgerKeyForPlayer(first.id) : await ledgerKeyForCompanion({ id: first.id, npc_id: first.npcId });
  const secondKey = second.kind === 'player'
    ? await ledgerKeyForPlayer(second.id) : await ledgerKeyForCompanion({ id: second.id, npc_id: second.npcId });
  await initializeTurnOrder(sessionId, 1, [
    { key: firstKey, name: first.name, type: first.kind },
    { key: secondKey, name: second.name, type: second.kind },
  ]);
  return { firstKey, secondKey };
}

function markerResult(text, ctx) {
  return processResponseMarkers(text, ctx).then((r) => ({
    results: r.handlerResults, failures: r.failures,
    first: (r.handlerResults || [])[0]?.result ?? null,
  }));
}

async function allyCount(sessionId) {
  const rows = await db.dbAll('SELECT id FROM combat_allies WHERE session_id = ?', [sessionId]);
  return rows.length;
}

async function enemyCount(sessionId) {
  const rows = await db.dbAll('SELECT id FROM combat_enemies WHERE session_id = ?', [sessionId]);
  return rows.length;
}

// ---------------------------------------------------------------------------
group('1. Schemas validate; ATTUNE/UNATTUNE are schema-only (attunement family owns the handlers)');
{
  const good = validateDmMarkers(
    '[BEND_LUCK: Target="Mira" Roll="save" Direction="bonus"] '
    + '[TIDES_OF_CHAOS: Target="Mira"] '
    + '[PRESERVE_LIFE: Target="Clara" Allocations="Mira=5"] '
    + '[TAMED_SURGE: Target="Mira" Row="05-08"] '
    + '[TELEPATHIC_SPEECH: Target="Mira" Creature="Bram"] '
    + '[AWAKENED_MIND: Target="Mira" Creature="Bram"] '
    + '[HOUND_OF_ILL_OMEN: Target="Mira" Creature="GobA"] '
    + '[ACCURSED_SPECTER: Target="Mira" Slain="GobA"] '
    + '[FAITHFUL_SUMMONS: Target="Mira" Beasts="Wolf, Goat"] '
    + '[ATTUNE: Item="Sword of Testing"] [UNATTUNE: Item="Sword of Testing"]',
  );
  assert(good.failures.length === 0, `all first-slice + attunement markers parse (failures: ${JSON.stringify(good.failures)})`);
  assert(Object.keys(good.validByKey).length === 11, 'all 11 marker keys validate');
  const bad = validateDmMarkers('[BEND_LUCK: Target="Mira" Roll="save"] [PRESERVE_LIFE: Target="Clara"] [TAMED_SURGE: Target="Mira"]');
  assert(bad.failures.length === 3, 'missing required fields fail validation (BEND_LUCK Direction, PRESERVE_LIFE Allocations, TAMED_SURGE Row)');
  assert(_hasHandler('ATTUNE') === false && _hasHandler('UNATTUNE') === false,
    'ATTUNE/UNATTUNE have NO handler in this family — attunementService.js owns them');
  for (const k of ['BEND_LUCK', 'TIDES_OF_CHAOS', 'PRESERVE_LIFE', 'TAMED_SURGE', 'TELEPATHIC_SPEECH', 'AWAKENED_MIND', 'HOUND_OF_ILL_OMEN', 'ACCURSED_SPECTER', 'FAITHFUL_SUMMONS']) {
    assert(_hasHandler(k), `handler registered for ${k}`);
  }
}

// ---------------------------------------------------------------------------
group('2. Bend Luck — reaction, 1 Sorcery Point, 1d4 recorded (never applied to a reported total)');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[BEND_LUCK: Target="Mira" Roll="Wisdom save" Direction="penalty"]', ctx);
  assert(r.first?.success === true, 'Bend Luck succeeds for a Wild Magic sorcerer');
  assert(r.first?.die >= 1 && r.first?.die <= 4, `Bend Luck die is 1d4 (got ${r.first?.die})`);
  assert(r.first?.direction === 'penalty' && r.first?.roll === 'Wisdom save', 'Bend Luck records the roll label + direction');
  assert(await usedPool('player', pcId, 'sorcery') === 1, '1 Sorcery Point spent');
  assert(typeof r.first?.note === 'string' && r.first.note.includes('DM applies it'),
    'Bend Luck returns a stated instruction — the system never rewrites a reported total');

  // No Sorcery Points left → refusal, pool unchanged.
  await setResources('player', pcId, { used: { sorcery: 6 } });
  const r2 = await markerResult('[BEND_LUCK: Target="Mira" Roll="save" Direction="bonus"]', ctx);
  assert(r2.first?.success === false, 'Bend Luck refuses with no Sorcery Points left');
  assert(await usedPool('player', pcId, 'sorcery') === 6, 'refused Bend Luck spends nothing');

  // Not a sorcerer → refusal.
  const clericId = await makePc({ name: 'Clara', cls: 'cleric', subclass: 'life_domain', level: 6, wis: 16 });
  const r3 = await markerResult('[BEND_LUCK: Target="Clara" Roll="save" Direction="bonus"]', { characterId: clericId, sessionId });
  assert(r3.first?.success === false && /not a sorcerer/.test(r3.first?.reason || ''), 'Bend Luck refuses a non-sorcerer');

  // Reaction: fires on another combatant's turn (no identity gate).
  const pc2 = await makePc({ name: 'Sable', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, cha: 16 });
  const s2 = await makeSession(pc2);
  const comp = await makeCompanion(pc2, { name: 'Bram', cls: 'fighter', subclass: '', level: 5 });
  await startCombat(s2, { kind: 'companion', id: comp.compId, npcId: comp.npcId, name: 'Bram' }, { kind: 'player', id: pc2, name: 'Sable' });
  const r4 = await markerResult('[BEND_LUCK: Target="Sable" Roll="attack" Direction="bonus"]', { characterId: pc2, sessionId: s2 });
  assert(r4.first?.success === true, 'Bend Luck (reaction) fires on another combatant\'s turn');
  assert(await usedPool('player', pc2, 'sorcery') === 1, 'reaction Bend Luck still spends the point');
}

// ---------------------------------------------------------------------------
group('3. Tides of Chaos — advantage once, spent until slotted cast / Long Rest');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 3, cha: 16 });
  const sessionId = await makeSession(pcId);
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[TIDES_OF_CHAOS: Target="Mira"]', ctx);
  assert(r.first?.success === true && r.first?.advantage === true, 'Tides of Chaos grants advantage');
  const state = await markers.getTidesOfChaosState('player', pcId);
  assert(state.used === true && state.advantagePending === true, 'Tides state is used + advantage pending');
  const r2 = await markerResult('[TIDES_OF_CHAOS: Target="Mira"]', ctx);
  assert(r2.first?.success === false, 'second Tides of Chaos refuses while spent');
  assert(await markers.consumeTidesAdvantage('player', pcId) === true, 'advantage consumed once by the roll path');
  assert(await markers.consumeTidesAdvantage('player', pcId) === false, 'advantage cannot be consumed twice');
  const restored = await markers.restoreTidesOfChaos('player', pcId, 'long rest');
  assert(restored.success === true, 'Tides restores (Family 5 auto-surge / Family 7 long rest)');
  const r3 = await markerResult('[TIDES_OF_CHAOS: Target="Mira"]', ctx);
  assert(r3.first?.success === true, 'Tides usable again after restore');
}

// ---------------------------------------------------------------------------
group('4. Preserve Life — Channel Divinity spend, bloodied-only, half-max cap, pool 5 x level');
{
  async function lifeParty() {
    const pcId = await makePc({ name: 'Clara', cls: 'cleric', subclass: 'life_domain', level: 6, wis: 16, hp: 40 });
    const sessionId = await makeSession(pcId);
    const mira = await makeCompanion(pcId, { name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, hp: 40 });
    const bram = await makeCompanion(pcId, { name: 'Bram', cls: 'fighter', subclass: '', level: 5, hp: 30 });
    // Bloodied: Mira 15/40 (half 20), Bram 10/30 (half 15).
    await db.dbRun('UPDATE companions SET companion_current_hp = 15 WHERE id = ?', [mira.compId]);
    await db.dbRun('UPDATE companions SET companion_current_hp = 10 WHERE id = ?', [bram.compId]);
    await startCombat(sessionId, { kind: 'player', id: pcId, name: 'Clara' }, { kind: 'companion', id: mira.compId, npcId: mira.npcId, name: 'Mira' });
    return { pcId, sessionId, mira, bram };
  }
  async function compHp(id) {
    const row = await db.dbGet('SELECT companion_current_hp AS hp FROM companions WHERE id = ?', [id]);
    return row.hp;
  }
  {
    const { pcId, sessionId, mira, bram } = await lifeParty();
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=5, Bram=5"]', { characterId: pcId, sessionId });
    assert(r.first?.success === true, 'Preserve Life succeeds with a valid split');
    assert(r.first?.pool === 30, 'Preserve Life pool is 5 x Cleric level 6 = 30');
    assert(r.first?.spent === 10, 'Preserve Life spent total is the allocation sum');
    assert(await compHp(mira.compId) === 20 && await compHp(bram.compId) === 15, 'healing lands exactly at the half-max caps');
    assert(await usedPool('player', pcId, 'channelDivinity') === 1, '1 Channel Divinity use spent');
  }
  {
    const { pcId, sessionId } = await lifeParty();
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=20, Bram=15"]', { characterId: pcId, sessionId });
    assert(r.first?.success === false && /35/.test(r.first?.reason || ''), 'allocations over the 30 pool refuse');
    assert(await usedPool('player', pcId, 'channelDivinity') === 0, 'over-pool refusal spends no Channel Divinity');
  }
  {
    const { pcId, sessionId } = await lifeParty();
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=6"]', { characterId: pcId, sessionId });
    assert(r.first?.success === false && /half maximum/.test(r.first?.reason || ''), 'healing above half maximum refuses');
    assert(await usedPool('player', pcId, 'channelDivinity') === 0, 'cap refusal spends nothing');
  }
  {
    const { pcId, sessionId, mira } = await lifeParty();
    await db.dbRun('UPDATE companions SET companion_current_hp = 25 WHERE id = ?', [mira.compId]);
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=5"]', { characterId: pcId, sessionId });
    assert(r.first?.success === false && /not Bloodied/.test(r.first?.reason || ''), 'a non-Bloodied creature cannot be healed');
    assert(await usedPool('player', pcId, 'channelDivinity') === 0, 'non-bloodied refusal spends nothing');
  }
  {
    const { pcId, sessionId, mira } = await lifeParty();
    // Turn order is Clara first in lifeParty; rebuild with Mira first → not Clara's turn.
    await db.dbRun('DELETE FROM combat_turn_state WHERE session_id = ?', [sessionId]);
    await startCombat(sessionId, { kind: 'companion', id: mira.compId, npcId: mira.npcId, name: 'Mira' }, { kind: 'player', id: pcId, name: 'Clara' });
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=5"]', { characterId: pcId, sessionId });
    assert(r.first?.success === false && /Out of turn/.test(r.first?.reason || ''), 'Preserve Life refuses out of turn');
    assert(await usedPool('player', pcId, 'channelDivinity') === 0, 'out-of-turn refusal spends nothing');
  }
  {
    const { pcId, sessionId } = await lifeParty();
    await setResources('player', pcId, { used: { channelDivinity: 3 } });
    const r = await markerResult('[PRESERVE_LIFE: Target="Clara" Allocations="Mira=5"]', { characterId: pcId, sessionId });
    assert(r.first?.success === false, 'Preserve Life refuses with no Channel Divinity left');
  }
}

// ---------------------------------------------------------------------------
group('5. Tamed Surge — choose any row except the final row, once per Long Rest');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 18, cha: 18 });
  const sessionId = await makeSession(pcId);
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[TAMED_SURGE: Target="Mira" Row="05-08"]', ctx);
  assert(r.first?.success === true, 'Tamed Surge accepts a valid row');
  assert(r.first?.chosenRow === 'Friendly Creature', 'chosen row resolves to its registry name');
  const pending = await markers.pendingTamedSurgeChoice('player', pcId);
  assert(pending?.range === '05-08' && pending?.name === 'Friendly Creature', 'choice is recorded pending for Family 5');
  const consumed = await markers.consumePendingTamedSurge('player', pcId);
  assert(consumed?.name === 'Friendly Creature', 'Family 5 consumes the pending choice');
  assert(await markers.pendingTamedSurgeChoice('player', pcId) === null, 'choice is gone after consumption');
  const r2 = await markerResult('[TAMED_SURGE: Target="Mira" Row="09-12"]', ctx);
  assert(r2.first?.success === false && /Long Rest/.test(r2.first?.reason || ''), 'second Tamed Surge refuses until a Long Rest');
  await markers.restoreTamedSurgeOnLongRest('player', pcId);
  const r3 = await markerResult('[TAMED_SURGE: Target="Mira" Row="97-00"]', ctx);
  assert(r3.first?.success === false && /final row/.test(r3.first?.reason || ''), 'the final row (97–00, Boon) cannot be chosen');
  const r4 = await markerResult('[TAMED_SURGE: Target="Mira" Row="99-99"]', ctx);
  assert(r4.first?.success === false && /no Wild Magic Surge row/.test(r4.first?.reason || ''), 'an unknown range refuses');
  const r5 = await markerResult('[TAMED_SURGE: Target="Mira" Row="05–08"]', ctx);
  assert(r5.first?.success === true, 'en-dash ranges normalize (registry uses –)');
}

// ---------------------------------------------------------------------------
group('6. Telepathic Speech / Awakened Mind — bonus-action link records');
{
  const pcId = await makePc({ name: 'Mira', cls: 'sorcerer', subclass: 'aberrant_sorcery', level: 3, cha: 16 });
  const sessionId = await makeSession(pcId);
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[TELEPATHIC_SPEECH: Target="Mira" Creature="Bram"]', ctx);
  assert(r.first?.success === true && r.first?.rangeMiles === 3, 'Telepathic Speech links at Cha-mod miles (min 1)');
  let links = (await readResources('player', pcId)).telepathicLinks || [];
  assert(links.length === 1 && links[0].kind === 'telepathic_speech', 'link record stored on the actor');
  const r2 = await markerResult('[TELEPATHIC_SPEECH: Target="Mira" Creature="Clara"]', ctx);
  assert(r2.first?.success === true, 'Telepathic Speech can link a second creature');
  links = (await readResources('player', pcId)).telepathicLinks || [];
  assert(links.length === 2, 'Telepathic Speech keeps multiple links (no one-at-a-time rule in its text)');

  // Not your turn → bonus gate refuses, no link recorded.
  const pc2 = await makePc({ name: 'Sable', cls: 'sorcerer', subclass: 'aberrant_sorcery', level: 3, cha: 16 });
  const s2 = await makeSession(pc2);
  const comp = await makeCompanion(pc2, { name: 'Bram', cls: 'fighter', subclass: '', level: 5 });
  await startCombat(s2, { kind: 'companion', id: comp.compId, npcId: comp.npcId, name: 'Bram' }, { kind: 'player', id: pc2, name: 'Sable' });
  const r3 = await markerResult('[TELEPATHIC_SPEECH: Target="Sable" Creature="Bram"]', { characterId: pc2, sessionId: s2 });
  assert(r3.first?.success === false && /Out of turn/.test(r3.first?.reason || ''), 'Telepathic Speech refuses out of turn');
  assert(((await readResources('player', pc2)).telepathicLinks || []).length === 0, 'refused link records nothing');

  const warId = await makePc({ name: 'Vex', cls: 'warlock', subclass: 'great_old_one_patron', level: 5, cha: 18 });
  const s3 = await makeSession(warId);
  const wctx = { characterId: warId, sessionId: s3 };
  const r4 = await markerResult('[AWAKENED_MIND: Target="Vex" Creature="Bram"]', wctx);
  assert(r4.first?.success === true && r4.first?.durationMinutes === 5 && r4.first?.rangeMiles === 4,
    'Awakened Mind lasts Warlock-level minutes at Cha-mod miles');
  const r5 = await markerResult('[AWAKENED_MIND: Target="Vex" Creature="Clara"]', wctx);
  assert(r5.first?.success === true, 'Awakened Mind can connect to a different creature');
  links = (await readResources('player', warId)).telepathicLinks || [];
  const mindLinks = links.filter((l) => l.kind === 'awakened_mind');
  assert(mindLinks.length === 1 && mindLinks[0].target === 'Clara',
    'Awakened Mind keeps ONE connection — the new one ends the old');
  assert(markers.telepathicLinkExpired(mindLinks[0], Date.parse(mindLinks[0].startedAt) + 6 * 60000) === true,
    'Awakened Mind link expires after its duration in minutes');
  assert(markers.telepathicLinkExpired(mindLinks[0], Date.parse(mindLinks[0].startedAt) + 4 * 60000) === false,
    'Awakened Mind link is live inside its duration');
}

// ---------------------------------------------------------------------------
group('7. Kind-C creature shells — the shell spends, entityService creates a FRIENDLY row (never an enemy row)');
{
  const pcId = await makePc({ name: 'Shade', cls: 'sorcerer', subclass: 'shadow_magic', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  await startCombat(sessionId, { kind: 'player', id: pcId, name: 'Shade' }, { kind: 'player', id: pcId, name: 'Shade' });
  const ctx = { characterId: pcId, sessionId };
  const enemiesBefore = await enemyCount(sessionId);
  const r = await markerResult('[HOUND_OF_ILL_OMEN: Target="Shade" Creature="GobA"]', ctx);
  assert(r.first?.success === true, 'Hound of Ill Omen shell succeeds');
  assert(await usedPool('player', pcId, 'sorcery') === 3, 'Hound spends 3 Sorcery Points');
  assert(await allyCount(sessionId) === 1, 'one friendly-actor row created');
  assert(await enemyCount(sessionId) === enemiesBefore, 'NO combat_enemies row created for the Hound');
  const hound = (await entity.listFriendlyActors(sessionId))[0];
  assert(hound.kind === 'hound' && hound.maxHp === 37 && hound.armorClass === 14, 'Hound carries dire wolf numbers (HP 37, AC 14)');
  assert(hound.tempHp === 3, 'Hound temp HP is half Sorcerer level (6/2)');
  assert(hound.flags.saveDisadvantageTarget === 'GobA', 'Hound records its hunted target');
  const found = await entity.findActiveHound(sessionId, 1, 'player', pcId, 'GobA');
  assert(found?.id === hound.id, 'findActiveHound answers the Family 6 save hook');
  assert(await entity.findActiveHound(sessionId, 1, 'player', pcId, 'Someone Else') === null,
    'no Hound disadvantage for a creature the Hound is not hunting');

  // Not enough Sorcery Points → refusal, no row.
  await setResources('player', pcId, { used: { sorcery: 4 } });
  const r2 = await markerResult('[HOUND_OF_ILL_OMEN: Target="Shade" Creature="GobA"]', ctx);
  assert(r2.first?.success === false, 'Hound refuses with fewer than 3 Sorcery Points left');
  assert(await allyCount(sessionId) === 1, 'refused Hound creates no row');
}
{
  const pcId = await makePc({ name: 'Hex', cls: 'warlock', subclass: 'hexblade', level: 6, cha: 16 });
  const sessionId = await makeSession(pcId);
  await startCombat(sessionId, { kind: 'player', id: pcId, name: 'Hex' }, { kind: 'player', id: pcId, name: 'Hex' });
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[ACCURSED_SPECTER: Target="Hex" Slain="GobA"]', ctx);
  assert(r.first?.success === true, 'Accursed Specter shell succeeds');
  const specter = (await entity.listFriendlyActors(sessionId))[0];
  assert(specter.kind === 'specter' && specter.maxHp === 22 && specter.armorClass === 12, 'Specter carries specter numbers (HP 22, AC 12)');
  assert(specter.tempHp === 3, 'Specter temp HP is half Warlock level');
  assert(specter.attackBonus === 7, 'Specter attack bonus is its own (+4) plus Cha mod (+3)');
  assert(specter.name === 'Specter of GobA', 'Specter is named for the slain humanoid');
  const r2 = await markerResult('[ACCURSED_SPECTER: Target="Hex" Slain="GobB"]', ctx);
  assert(r2.first?.success === false && /Long Rest/.test(r2.first?.reason || ''), 'Specter is once per Long Rest');
  assert(await allyCount(sessionId) === 1, 'refused Specter creates no row');
  await markers.restoreOncePerLongRest('player', pcId, 'accursedSpecterUsed');
  const r3 = await markerResult('[ACCURSED_SPECTER: Target="Hex" Slain="GobB"]', ctx);
  assert(r3.first?.success === true, 'Specter usable again after the Long Rest restore');
}
{
  const pcId = await makePc({ name: 'Wren', cls: 'druid', subclass: 'circle_of_the_shepherd', level: 14, wis: 18 });
  const sessionId = await makeSession(pcId);
  await startCombat(sessionId, { kind: 'player', id: pcId, name: 'Wren' }, { kind: 'player', id: pcId, name: 'Wren' });
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[FAITHFUL_SUMMONS: Target="Wren" Beasts="Wolf, Goat"]', ctx);
  assert(r.first?.success === true, 'Faithful Summons shell succeeds');
  assert(r.first?.allies?.length === 2, 'two beasts summoned');
  assert(await allyCount(sessionId) === 2, 'two friendly-actor rows created');
  assert(await enemyCount(sessionId) === 1, 'still only the one enemy row');
  const r2 = await markerResult('[FAITHFUL_SUMMONS: Target="Wren" Beasts="Wolf"]', ctx);
  assert(r2.first?.success === false && /Long Rest/.test(r2.first?.reason || ''), 'Faithful Summons is once per Long Rest');
}
{
  const pcId = await makePc({ name: 'Wren', cls: 'druid', subclass: 'circle_of_the_shepherd', level: 14, wis: 18 });
  const sessionId = await makeSession(pcId);
  await startCombat(sessionId, { kind: 'player', id: pcId, name: 'Wren' }, { kind: 'player', id: pcId, name: 'Wren' });
  const ctx = { characterId: pcId, sessionId };
  const r = await markerResult('[FAITHFUL_SUMMONS: Target="Wren" Beasts="Owlbear"]', ctx);
  assert(r.first?.success === false && /CR 3/.test(r.first?.reason || ''), 'a CR 3 beast refuses (CR 2 or lower only)');
  assert(await allyCount(sessionId) === 0, 'refused summons creates no rows');
  const r2 = await markerResult('[FAITHFUL_SUMMONS: Target="Wren" Beasts="Nopebeast"]', ctx);
  assert(r2.first?.success === false && /no bestiary entry/.test(r2.first?.reason || ''), 'an unknown beast refuses');
}

// ---------------------------------------------------------------------------
console.log(`\n mechanics-hooks-markers: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
