// tests/class-audit-severe-seven.test.js — the class-audit-severe-seven job
// (docs/pm/class-audit-severe-seven/BRIEF.md).
//
// Items covered:
//   1  spell save DC / attack for subclass-cast classes (magus, warden,
//      scholar) — the subclass now reaches spellProfileFor
//   3  a wizard levelling up IN wizard is offered +2 spellbook spells
//   4  the Known Spells sheet reads its cap from GET /api/spells
//   5  artificer infusion plans: catalog endpoint, level-up envelope,
//      level-up validation and storage
//   6  Theologian scholar: prepared-spell cap (validator + PUT)
//   7  the pact-slot split: a short rest returns pact slots only
//   8  the seven class-feature markers work in play
// Items 2 (invocations) and 9 (Keeper genre texts) have no data in the
// repo and are reported, not built — nothing to test.
//
// Test characters are invented. Isolated throwaway DB (the
// levelup-subclass-prompts pattern): temp dir becomes CWD before
// database.js loads, and the runner's shared TURSO env is deleted.
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'class-audit-severe-seven-test-'));
const origCwd = process.cwd();
process.chdir(tmpDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const db = await import(fromRepo('server/database.js'));
await db.initDatabase();
const { spellProfileFor } = await import(fromRepo('server/services/combatStatsService.js'));
const { partySpellProfile } = await import(fromRepo('server/services/enemySpellService.js'));
const spellbook = await import(fromRepo('server/services/spellbookService.js'));
const spellCast = await import(fromRepo('server/services/spellCastService.js'));
const { processResponseMarkers } = await import(fromRepo('server/services/markerPipeline.js'));
const markers = await import(fromRepo('server/services/subclassMarkerService.js'));
// Handler services register at import (the dmSession side-effect list).
await import(fromRepo('server/services/combatMarkerService.js'));
await import(fromRepo('server/services/partyAttackService.js'));
const rolls = await import(fromRepo('server/services/rollRequestService.js'));
const allyCombat = await import(fromRepo('server/services/allyCombatService.js'));
const entity = await import(fromRepo('server/services/entityService.js'));
const { createEncounterEnemies } = await import(fromRepo('server/services/enemyCombatService.js'));
const { initializeTurnOrder, getTurnState } = await import(fromRepo('server/services/combatTurnService.js'));
const { combatantCanAct } = await import(fromRepo('server/services/combatLoopService.js'));
const { ledgerKeyForPlayer } = await import(fromRepo('server/services/turnLedgerService.js'));
const characterRouterMod = await import(fromRepo('server/routes/character.js'));
const { validateTheologianPreparedSpells } = characterRouterMod;
const spellsRouter = (await import(fromRepo('server/routes/spells.js'))).default;

// --- HTTP harness: the real routers on a real express app ---------------
const app = express();
app.use(express.json());
app.use('/api/character', characterRouterMod.default);
app.use('/api/spells', spellsRouter);
const server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
const base = `http://127.0.0.1:${server.address().port}`;
async function req(method, url, body) {
  const res = await fetch(`${base}${url}`, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}
async function makeLeveled({ name, cls, level, xp, subclass = null, extra = {} }) {
  const created = await req('POST', '/api/character', { name, class: cls, race: 'human' });
  if (created.status !== 201) throw new Error(`fixture POST ${name}: ${created.status} ${JSON.stringify(created.json)}`);
  const id = created.json.id;
  const put = await req('PUT', `/api/character/${id}`, {
    level, experience: xp, max_hp: 20, current_hp: 20, subclass,
    class_levels: JSON.stringify([{ class: cls, level, subclass }]), ...extra,
  });
  if (put.status !== 200) throw new Error(`fixture PUT ${name}: ${put.status} ${JSON.stringify(put.json)}`);
  return id;
}

let widCounter = 0;
const nextWorldId = (p) => `${p}-${++widCounter}`;
async function insertRow(table, overrides = {}) {
  const cols = await db.dbAll(`PRAGMA table_info(${table})`);
  const names = []; const values = [];
  for (const col of cols) {
    if (col.pk && col.type.toUpperCase().includes('INT')) continue;
    if (Object.prototype.hasOwnProperty.call(overrides, col.name)) { names.push(col.name); values.push(overrides[col.name]); }
    else if (col.notnull) {
      names.push(col.name);
      const t = col.type.toUpperCase();
      values.push(t.includes('INT') || t.includes('REAL') || t.includes('NUM') ? 0 : 'x');
    }
  }
  const r = await db.dbRun(`INSERT INTO ${table} (${names.join(',')}) VALUES (${names.map(() => '?').join(',')})`, values);
  return Number(r.lastInsertRowid);
}
const scores = (o = {}) => JSON.stringify({ str: 10, dex: 12, con: 14, int: 10, wis: 10, cha: 10, ...o });
async function makePc({ name, cls, subclass = null, level, hp = 40, extra = {}, ab = {} }) {
  return insertRow('characters', {
    name, class: cls, subclass, level, ability_scores: scores(ab),
    class_resources_json: '{"used":{}}', current_hp: hp, max_hp: hp, world_id: nextWorldId('pc'), ...extra,
  });
}
const makeSession = (pcId, cfg = {}) => insertRow('dm_sessions', { character_id: pcId, session_config: JSON.stringify(cfg) });
const first = async (text, ctx) => ((await processResponseMarkers(text, ctx)).handlerResults || [])[0]?.result ?? null;
const readCfg = async (sid) => JSON.parse((await db.dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sid])).session_config || '{}');

// ===========================================================================
group('1. Subclass-cast classes get a spell DC (the subclass reaches spellProfileFor)');
{
  const actor = { ability_scores: { int: 16, wis: 10, cha: 10 }, level: 5 }; // PB +3, Int +3
  check(spellProfileFor(actor, 'magus', null) === null, 'magus without a subclass: no casting ability (the old bug shape)');
  const magus = spellProfileFor(actor, 'magus', 'Arcane Order');
  check(magus?.saveDc === 14 && magus?.attackBonus === 6, `magus (Arcane Order, Int): DC 14 / +6 (got ${magus?.saveDc} / ${magus?.attackBonus})`);
  // Warden is in the MVP: a casting warden (Loreseeker, Int) now has a DC.
  check(spellProfileFor(actor, 'warden', null) === null, 'warden without its subclass: no DC (the old bug shape)');
  const warden = spellProfileFor(actor, 'warden', 'Loreseeker');
  check(warden?.saveDc === 14 && warden?.attackBonus === 6, `casting warden (Loreseeker, Int): DC 14 / +6 (got ${warden?.saveDc})`);
  check(partySpellProfile('player', { class: 'warden', subclass: 'Loreseeker', ability_scores: JSON.stringify({ int: 16 }), level: 5 })?.saveDc === 14,
    'a warden PC row resolves its DC through the party spell profile');
  const scholar = spellProfileFor(actor, 'scholar', 'Theologian');
  check(scholar?.saveDc === 14, 'Theologian scholar: Int DC 14');
  // The call sites now pass the row's subclass: the party spell profile
  // (enemy-spell saves against party casters, PC and companion).
  const pcRow = { class: 'magus', subclass: 'Arcane Order', ability_scores: JSON.stringify({ int: 16 }), level: 5 };
  check(partySpellProfile('player', pcRow)?.saveDc === 14, 'partySpellProfile(player) passes characters.subclass');
  const compRow = { companion_class: 'magus', companion_subclass: 'Arcane Order', companion_ability_scores: JSON.stringify({ int: 16 }), companion_level: 5 };
  check(partySpellProfile('companion', compRow)?.saveDc === 14, 'partySpellProfile(companion) passes companion_subclass');
  // Source pins for the two call sites that need a full cast to reach.
  const src = fs.readFileSync(path.join(origCwd, 'server/services/spellCastService.js'), 'utf8');
  check(/spellProfileFor\(\{ ability_scores: charRow\.ability_scores, level: charRow\.level \}, charRow\.class, charRow\.subclass\)/.test(src), 'notePcSpellEffect passes charRow.subclass');
  check(/compRow\.companion_class, compRow\.companion_subclass\)/.test(src), 'applyCompanionSpellEffect passes companion_subclass');
  const pa = fs.readFileSync(path.join(origCwd, 'server/services/partyAttackService.js'), 'utf8');
  check(/spellProfileFor\(actorShape, className, kind === 'player' \? row\.subclass : row\.companion_subclass\)/.test(pa), 'spell attacks pass the subclass');
}

// ===========================================================================
group('3. Wizard levelling up in wizard: +2 spellbook spells offered');
{
  const id = await makeLeveled({ name: 'Orrin Vale', cls: 'wizard', level: 2, xp: 900 });
  const info = await req('GET', `/api/character/level-up-info/${id}`);
  const opt = info.json?.classOptions?.find((o) => o.type === 'existing');
  check(info.status === 200, 'wizard L2 level-up-info loads');
  check(opt?.choices?.newSpellsKnown === spellbook.SPELLBOOK_SPELLS_PER_LEVEL && spellbook.SPELLBOOK_SPELLS_PER_LEVEL === 2,
    `wizard 2->3 offers newSpellsKnown 2 (got ${opt?.choices?.newSpellsKnown})`);
  const cleric = await makeLeveled({ name: 'Bryn Holt', cls: 'cleric', level: 2, xp: 900 });
  const cinfo = await req('GET', `/api/character/level-up-info/${cleric}`);
  check(cinfo.json?.classOptions?.find((o) => o.type === 'existing')?.choices?.newSpellsKnown === 0, 'a cleric (prepared caster) is still offered 0');
}

// ===========================================================================
group('4. Known Spells cap comes from GET /api/spells (spellsKnown is a number only for known casters)');
{
  const magus = await req('GET', '/api/spells?class=magus&level=3&subclass=Arcane%20Order');
  check(magus.status === 200 && typeof magus.json?.spellsKnown === 'number' && magus.json.spellsKnown > 0,
    `magus 3 has a spellsKnown number (got ${magus.json?.spellsKnown})`);
  check(Array.isArray(magus.json?.spells) && magus.json.spells.length > 0, 'magus 3 has learnable spells listed');
  const wizard = await req('GET', '/api/spells?class=wizard&level=3');
  check(typeof wizard.json?.spellsKnown !== 'number' || wizard.json.spellsKnown === 0, 'wizard has no Known Spells cap (book caster)');
  const theo = await req('GET', '/api/spells?class=scholar&level=3&subclass=Theologian');
  check(theo.json?.spellsPrepared === 3, `Theologian 3 prepares 3 (got ${theo.json?.spellsPrepared})`);
}

// ===========================================================================
group('5. Artificer infusion plans: catalog, envelope, level-up, storage');
{
  const id = await makeLeveled({ name: 'Tamsin Coil', cls: 'artificer', level: 1, xp: 300 });
  const info = await req('GET', `/api/character/level-up-info/${id}`);
  const opt = info.json?.classOptions?.find((o) => o.type === 'existing');
  check(opt?.choices?.newPlans === 4, `artificer 1->2 envelope: newPlans 4 (got ${opt?.choices?.newPlans})`);
  const cat = await req('GET', `/api/character/artificer-plans/${id}?level=2`);
  check(cat.status === 200 && cat.json?.max === 4, `plan catalog at level 2: max 4 (got ${cat.json?.max})`);
  const names = (cat.json?.available || []).map((p) => p.name);
  check(names.includes('Bag of Holding') && names.includes('Returning Weapon'), 'catalog lists the level-2 plans');
  check((cat.json?.available || []).find((p) => p.name === 'Common magic item')?.needsDetail === true, 'a generic plan asks for a detail');
  const simple = (cat.json?.available || []).filter((p) => !p.needsDetail).map((p) => p.name);
  const five = simple.slice(0, 5).map((plan) => ({ plan }));
  const tooMany = await req('POST', `/api/character/level-up/${id}`, { hpRoll: 'average', newPlans: five });
  check(tooMany.status === 400 && /grants 4/.test(tooMany.json?.error || ''), `5 plans at a 4-plan level is refused (got ${tooMany.status})`);
  const bogus = await req('POST', `/api/character/level-up/${id}`, { hpRoll: 'average', newPlans: [{ plan: 'Vorpal Sword' }] });
  check(bogus.status === 400 && /cannot be learned/.test(bogus.json?.error || ''), 'a plan not on the level-2 table is refused');
  const four = simple.slice(0, 4).map((plan) => ({ plan }));
  const ok = await req('POST', `/api/character/level-up/${id}`, { hpRoll: 'average', newPlans: four });
  check(ok.status === 200, `4 valid plans level up (got ${ok.status} ${JSON.stringify(ok.json?.error || '')})`);
  const after = await req('GET', `/api/character/artificer-plans/${id}`);
  const known = (after.json?.known || []).map((k) => (typeof k === 'string' ? k : k.name || k.plan));
  check(after.json?.artificerLevel === 2 && four.every((p) => known.includes(p.plan)), `the 4 plans are stored (known: ${JSON.stringify(known)})`);
}

// ===========================================================================
group('6. Theologian scholar prepared-spell cap');
{
  check(validateTheologianPreparedSpells('Ritualist', 3, ['a', 'b', 'c', 'd']) === null, 'not a Theologian: validator does not apply');
  const ok = validateTheologianPreparedSpells('Theologian', 3, ['Bless', 'Cure Wounds', 'Bless']);
  check(ok?.ok === true && ok.max === 3 && ok.counted === 2, 'duplicates count once; 2 of 3 is fine');
  const over = validateTheologianPreparedSpells('The Theologian', 3, ['A', 'B', 'C', 'D']);
  check(over?.ok === false && /at most 3/.test(over.error), '"The Theologian" normalises; 4 at level 3 is refused');
  check(validateTheologianPreparedSpells('Theologian', 20, Array.from({ length: 13 }, (_, i) => `S${i}`))?.ok === true, '13 at level 20 is fine');
  // Scholar is closed to new player characters (post-MVP), so the row is
  // inserted directly; the PUT cap still guards an existing one.
  const id = await makePc({ name: 'Edda Marsh', cls: 'scholar', subclass: 'Theologian', level: 3,
    extra: { class_levels: JSON.stringify([{ class: 'scholar', level: 3, subclass: 'Theologian' }]) } });
  const put = await req('PUT', `/api/character/${id}`, { prepared_spells: JSON.stringify(['A', 'B', 'C', 'D']) });
  check(put.status === 400 && /at most 3/.test(put.json?.error || JSON.stringify(put.json)), `PUT with 4 prepared spells is refused (got ${put.status})`);
  const put2 = await req('PUT', `/api/character/${id}`, { prepared_spells: JSON.stringify(['A', 'B', 'C']) });
  check(put2.status === 200, 'PUT with 3 prepared spells is accepted');
}

// ===========================================================================
group('7. Pact slots: a short rest returns pact slots only (wizard 5 / warlock 3)');
{
  // Pure helpers.
  const pact = spellbook.pactSlotsForWarlockLevel(3); // two 2nd-level slots
  check(pact?.level === 2 && pact?.slots === 2, 'warlock 3: two 2nd-level pact slots');
  check(spellbook.spendsPactSlot({ pact, slotLevel: 2, nonPactMax: 3, usedAtLevel: 0 }) === false, 'a 2nd-level spend uses the Spellcasting slot first');
  check(spellbook.spendsPactSlot({ pact, slotLevel: 2, nonPactMax: 3, usedAtLevel: 0, wantPact: true }) === true, 'Pact=true picks the pact slot');
  check(spellbook.spendsPactSlot({ pact, slotLevel: 2, nonPactMax: 3, usedAtLevel: 3 }) === true, 'Spellcasting slots spent: the pact slot pays');
  check(spellbook.spendsPactSlot({ pact, slotLevel: 3, nonPactMax: 2 }) === false, 'a different level never uses the pact slot');
  const r = spellbook.resetPactSlotsTracked({ 2: 4 }, 3, { 2: 1 });
  check(r.used['2'] === 3 && Object.keys(r.pactUsed).length === 0, 'tracked reset subtracts only the recorded pact spend');
  check(spellbook.resetPactSlotsTracked({ 2: 4 }, 3, null).used['2'] === 2, 'a pre-116 row (no record) falls back to the old whole-count reset');

  // DB: real spends through recordPactSpend, then the reset.
  const classLevels = JSON.stringify([{ class: 'wizard', level: 5 }, { class: 'warlock', level: 3 }]);
  const id = await makePc({ name: 'Veyra Quill', cls: 'wizard', level: 8, extra: { class_levels: classLevels, spell_slots_used: '{}', pact_slots_used: '{}' } });
  let used = 0;
  const spend = async (wantPact = false) => {
    const isPact = await spellCast.recordPactSpend(true, id, 2, used, wantPact);
    used += 1;
    await db.dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify({ 2: used }), id]);
    return isPact;
  };
  check(await spend() === false, '1st 2nd-level spend: Spellcasting slot');
  check(await spend(true) === true, '2nd spend with Pact=true: pact slot');
  check(await spend() === false, '3rd spend: Spellcasting slot');
  const row = await db.dbGet('SELECT spell_slots_used, pact_slots_used FROM characters WHERE id = ?', [id]);
  check(JSON.parse(row.pact_slots_used)['2'] === 1, `one pact spend recorded (got ${row.pact_slots_used})`);
  const reset = spellbook.resetPactSlotsTracked(JSON.parse(row.spell_slots_used), 3, JSON.parse(row.pact_slots_used));
  check(reset.used['2'] === 2, `after a short rest, the two spent Spellcasting slots stay spent (got ${reset.used['2']}) — the old reset cleared both`);
  // The brief's case: banked Arcane Recovery for one 2nd-level slot now works.
  const ar = spellbook.applyArcaneRecovery({ usedSlots: reset.used, maxSlots: { 1: 4, 2: 3, 3: 2 }, bankedLevels: [2], budget: 3 });
  check(ar.ok === true && Number(ar.usedSlots['2']) === 1, `Arcane Recovery recovers a spent wizard 2nd-level slot after the pact reset (${ar.error || 'ok'})`);
  const old = spellbook.applyArcaneRecovery({ usedSlots: spellbook.resetPactSlots({ 2: 2 }, 3), maxSlots: { 1: 4, 2: 3, 3: 2 }, bankedLevels: [2], budget: 3 });
  check(old.ok === false, 'the old reset (1 wizard + 1 pact spend) left nothing for Arcane Recovery — the reported bug');
  // Restoring a slot (Arcane Recovery) clamps the record down.
  await db.dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify({ 2: 0 }), id]);
  await spellCast.clampPactRecord(true, id, 2);
  const row2 = await db.dbGet('SELECT pact_slots_used FROM characters WHERE id = ?', [id]);
  check(JSON.parse(row2.pact_slots_used)['2'] === undefined, 'restore to 0 used clears the pact record at that level');
}

// ===========================================================================
group('8a. Heroic Reroll: the reroll happens (player pending, player resolved, companion)');
{
  const pc = await makePc({ name: 'Kael Durn', cls: 'fighter', level: 3 });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  const req1 = await rolls.requestPcRoll({ sessionId: sid, characterId: pc, kind: 'skill', name: 'Athletics', dc: 15 });
  check(req1.success === true, 'a pending Athletics check');
  const res1 = await rolls.resolveReportedRoll(sid, [5]);
  check(res1?.heroicInspiration?.available === true, 'resolved roll: Heroic Inspiration held → reroll available');
  check(/may reroll this d20/.test(rolls.formatRollOutcomeBlock(res1)), 'the DM roll block states the reroll is available');
  const hr = await first('[HEROIC_REROLL]', ctx);
  check(hr?.ok === true && /roll that d20 again/.test(hr.systemNote || ''), 'HEROIC_REROLL after the result re-issues the roll');
  const pend = await rolls.getPendingRoll(sid);
  check(pend?.name === 'Athletics' && pend?.reroll && pend?.rerollFrom?.total === res1.total, 'the same check is pending again, marked as a reroll');
  const res2 = await rolls.resolveReportedRoll(sid, [18]);
  check(res2?.takenDie === 18 && res2?.heroicInspiration?.available === false, 'the reroll resolves; no second reroll offered');
  const hr2 = await first('[HEROIC_REROLL]', ctx);
  check(hr2?.ok === false, 'a second reroll is refused (inspiration spent / one per roll)');
}
{
  // Companion: re-runs the companion's last server roll.
  const pc = await makePc({ name: 'Lio Brand', cls: 'fighter', level: 3 });
  const npcId = await insertRow('npcs', { name: 'Sefa', world_id: nextWorldId('npc') });
  await insertRow('companions', {
    recruited_by_character_id: pc, npc_id: npcId, status: 'active', companion_class: 'fighter', companion_level: 3,
    companion_ability_scores: scores({ str: 16 }), class_resources_json: '{"used":{}}', companion_current_hp: 30, companion_max_hp: 30,
  });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  await first('[ROLL_REQUEST: Actor="Sefa" Skill="Athletics" DC=15 Looks="a heave at the stuck gate"]', ctx);
  const cfg = await readCfg(sid);
  check(!!cfg.lastCompanionRolls?.sefa, 'the companion roll is stashed for a reroll');
  const hr = await first('[HEROIC_REROLL: Target="Sefa"]', ctx);
  check(hr?.ok === true && hr.companion === 'Sefa' && Number.isInteger(hr.outcome?.takenDie), `Sefa rerolls (d20 ${hr?.outcome?.takenDie})`);
  const hr2 = await first('[HEROIC_REROLL: Target="Sefa"]', ctx);
  check(hr2?.ok === false, 'Sefa cannot reroll the same roll twice');
}

// ===========================================================================
group('8b. Bend Luck: the d4 lands on the roll');
{
  const pc = await makePc({ name: 'Ysolde Fenn', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 6, ab: { cha: 16 } });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  await rolls.requestPcRoll({ sessionId: sid, characterId: pc, kind: 'skill', name: 'Stealth', dc: 12 });
  const bl = await first('[BEND_LUCK: Target="Ysolde Fenn" Roll="Stealth" Direction="bonus"]', ctx);
  check(bl?.success === true && bl.appliedTo === 'pending', `Bend Luck on a pending roll rides it (got ${bl?.appliedTo})`);
  const res = await rolls.resolveReportedRoll(sid, [10]);
  check(res.total === 10 + res.modifier + bl.amount + 0 || res.subclassBonus >= bl.amount,
    `the d4 joins the total (die 10, mod ${res.modifier}, d4 ${bl.amount}, total ${res.total})`);
  // Applied to a just-resolved roll: re-judged.
  const bl2 = await first('[BEND_LUCK: Target="Ysolde Fenn" Roll="Stealth" Direction="penalty"]', ctx);
  check(bl2?.success === true && bl2.appliedTo === 'resolved' && bl2.appliedTotal === res.total - bl2.amount,
    `Bend Luck after the result changes the resolved total (${res.total} → ${bl2?.appliedTotal})`);
  check(/Bend Luck/.test(bl2.systemNote || ''), 'the DM is told');
}

// ===========================================================================
group('8c. Tides of Chaos: the advantage applies to the next roll, once');
{
  const pc = await makePc({ name: 'Ysra Vell', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 3, ab: { cha: 16 } });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  const t = await first('[TIDES_OF_CHAOS: Target="Ysra Vell"]', ctx);
  check(t?.success === true, 'Tides of Chaos is declared');
  const p1 = await rolls.requestPcRoll({ sessionId: sid, characterId: pc, kind: 'skill', name: 'Arcana', dc: 12 });
  check(p1.pending?.advantage === 'advantage' && /Tides of Chaos/.test(p1.pending?.advantageReason || ''), 'the next roll asks for advantage (two d20s)');
  await rolls.resolveReportedRoll(sid, [3, 17]);
  const p2 = await rolls.requestPcRoll({ sessionId: sid, characterId: pc, kind: 'skill', name: 'Arcana', dc: 12 });
  check(p2.pending?.advantage !== 'advantage', 'the advantage is spent after one roll');
  check(await markers.isTidesOfChaosSpent('player', pc) === true, 'Tides stays spent until a surge or a Long Rest');
}

// ===========================================================================
group('8d. Tamed Surge: the chosen row is used');
{
  const pc = await makePc({ name: 'Mirel Asch', cls: 'sorcerer', subclass: 'wild_magic_sorcery', level: 18, ab: { cha: 18 } });
  const ctx = { characterId: pc, sessionId: await makeSession(pc) };
  const ts = await first('[TAMED_SURGE: Target="Mirel Asch" Row="05-08"]', ctx);
  check(ts?.success === true, `Tamed Surge chooses row 05-08 (${ts?.reason || ts?.chosenRow})`);
  const row = await db.dbGet('SELECT * FROM characters WHERE id = ?', [pc]);
  const out = await spellCast.runWildMagicHook({ sessionId: null, characterId: pc, casterKind: 'player', casterRow: row,
    casterName: 'Mirel Asch', spellName: 'Magic Missile', slotLevel: 1, isPc: true });
  check(out?.triggered === true && String(out?.row?.range).replace(/–/g, '-') === String(ts.chosenRange).replace(/–/g, '-'), `the surge resolves as the chosen row (got ${out?.row?.range})`);
  check(await markers.consumePendingTamedSurge('player', pc) == null, 'the choice is consumed');
}

// ===========================================================================
group('8e. Summons act in combat and can be targeted (Hound, Specter, Faithful Summons)');
{
  const pc = await makePc({ name: 'Wren Ashby', cls: 'druid', subclass: 'circle_of_the_shepherd', level: 14, ab: { wis: 18 } });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  await createEncounterEnemies(sid, 1, [{ name: 'Bandit', maxHp: 40, armorClass: 5, attackBonus: 30, damageDice: '1d4', dexMod: 0 }]);
  const pKey = await ledgerKeyForPlayer(pc);
  await initializeTurnOrder(sid, 1, [
    { name: 'Wren Ashby', type: 'player', key: pKey, initiative: 30 },
    { name: 'Bandit', type: 'enemy', key: 'enemy:Bandit', initiative: -10 },
  ]);
  const fs1 = await first('[FAITHFUL_SUMMONS: Target="Wren Ashby" Beasts="Wolf, Goat"]', ctx);
  check(fs1?.success === true, 'Faithful Summons summons two beasts');
  check(/join the fight|joins the fight|turn order/i.test(fs1?.systemNote || ''), `the DM is told they join the fight (${fs1?.systemNote})`);
  const state = await getTurnState(sid, 1);
  const allyEntries = state.turnOrder.filter((e) => e.type === 'ally');
  check(allyEntries.length === 2, `both beasts are in the turn order (${state.turnOrder.map((e) => e.name).join(', ')})`);
  check(allyEntries[0].initiative === allyEntries[1].initiative, 'the beasts share one initiative roll');
  check(state.turnOrder[0].type === 'player' || state.turnOrder.findIndex((e) => e.type === 'player') < state.turnOrder.findIndex((e) => e.name === 'Bandit'), 'order stays sorted');
  for (const e of allyEntries) check(await combatantCanAct(sid, e) === true, `${e.name} can act`);

  const allies = await entity.listActiveFriendlyActors(sid);
  const wolf = allies.find((a) => /wolf/i.test(a.name));
  // A summon attacks (AC 5 bandit: anything but a natural 1 hits).
  const atk = await first(`[ATTACK: Attacker="${wolf.name}" Target="Bandit"]`, ctx);
  check(atk?.type === 'party_attack' && atk.attackerKind === 'ally', `the wolf's ATTACK resolves as a summon attack (${atk?.reason || ''})`);
  if (atk?.hit) check(atk.damage > 0 || atk.note, 'a hit deals the wolf\'s damage');
  // An enemy targets a summon by name.
  const before = (await entity.getFriendlyActor(wolf.id)).currentHp;
  const ea = await first(`[ENEMY_ATTACK: Enemy="Bandit" Target="${wolf.name}"]`, ctx);
  const afterRow = await entity.getFriendlyActor(wolf.id);
  check(ea && ea.success !== false, `ENEMY_ATTACK on the wolf resolves (${ea?.reason || ''})`);
  check(ea?.hit === false || afterRow.currentHp < before || afterRow.status !== 'active', `the wolf takes the hit (${before} → ${afterRow.currentHp})`);
  // A destroyed summon cannot act.
  await entity.applyDamageToAlly(wolf.id, 999);
  const wolfEntry = (await getTurnState(sid, 1)).turnOrder.find((e) => e.key === `ally:${wolf.id}`);
  check(await combatantCanAct(sid, wolfEntry) === false, 'a destroyed summon is skipped');
}
{
  const pc = await makePc({ name: 'Shade Morrow', cls: 'sorcerer', subclass: 'shadow_magic', level: 6, ab: { cha: 16 } });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  await createEncounterEnemies(sid, 1, [{ name: 'Cultist', maxHp: 20, armorClass: 12, attackBonus: 3, damageDice: '1d6', dexMod: 1 }]);
  await initializeTurnOrder(sid, 1, [{ name: 'Shade Morrow', type: 'player', key: await ledgerKeyForPlayer(pc), initiative: 15 },
    { name: 'Cultist', type: 'enemy', key: 'enemy:Cultist', initiative: 10 }]);
  const h = await first('[HOUND_OF_ILL_OMEN: Target="Shade Morrow" Creature="Cultist"]', ctx);
  check(h?.success === true, 'Hound of Ill Omen summoned');
  check((await getTurnState(sid, 1)).turnOrder.some((e) => e.type === 'ally' && /hound/i.test(e.name)), 'the hound joins the turn order');
  check(await allyCombat.houndSaveDisadvantage(sid, 1, 'player', pc, 'Cultist') === true, 'the hunted creature has disadvantage on saves against the caster');
  check(await allyCombat.houndSaveDisadvantage(sid, 1, 'player', pc, 'Someone') === false, 'no disadvantage for anyone else');
}
{
  const pc = await makePc({ name: 'Hex Calder', cls: 'warlock', subclass: 'hexblade', level: 6, ab: { cha: 16 } });
  const sid = await makeSession(pc);
  const ctx = { characterId: pc, sessionId: sid };
  await createEncounterEnemies(sid, 1, [{ name: 'Thug', maxHp: 20, armorClass: 12, attackBonus: 3, damageDice: '1d6', dexMod: 1 }]);
  await initializeTurnOrder(sid, 1, [{ name: 'Hex Calder', type: 'player', key: await ledgerKeyForPlayer(pc), initiative: 15 },
    { name: 'Thug', type: 'enemy', key: 'enemy:Thug', initiative: 10 }]);
  const s = await first('[ACCURSED_SPECTER: Target="Hex Calder" Slain="Thug"]', ctx);
  check(s?.success === true, 'Accursed Specter raised');
  check((await getTurnState(sid, 1)).turnOrder.some((e) => e.type === 'ally' && /specter/i.test(e.name)), 'the specter joins the turn order');
  // Turn-order entries for a new fight include the summons (COMBAT_START path).
  const entries = allyCombat.allyTurnEntries(await entity.listActiveFriendlyActors(sid));
  check(entries.length === 1 && entries[0].key.startsWith('ally:'), 'allyTurnEntries builds the specter\'s entry for a new fight');
}

// ===========================================================================
group('8f. The DM hears every class-feature marker result');
{
  const src = fs.readFileSync(path.join(origCwd, 'server/routes/dmSession.js'), 'utf8');
  for (const k of ['HEROIC_REROLL', 'BEND_LUCK', 'TIDES_OF_CHAOS', 'TAMED_SURGE', 'HOUND_OF_ILL_OMEN', 'ACCURSED_SPECTER', 'FAITHFUL_SUMMONS']) {
    check(new RegExp(`CLASS_FEATURE_NOTE_KEYS = new Set\\([^)]*'${k}'`).test(src), `${k} results are folded into the DM's messages`);
  }
  check(/You hold Heroic Inspiration: you can reroll that d20/.test(src), 'the player is told a reroll is available');
}

server.close();
console.log(`\n class-audit-severe-seven: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
