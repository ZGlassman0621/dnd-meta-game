/**
 * Entity Service — kind-H friendly-side actors + form-state records.
 *
 * Mechanics-hooks Family 8 (Amendment 2 §3): one system, two shapes.
 *
 *   (a) Separate-actor rows — Ox, Eldritch Cannon, Steel Defender,
 *       Servant of the Desert spirit, Stilled Summons spirit, Echo(es),
 *       Primal Companion, Extraneous Ego clone. ONE friendly-side row
 *       shape in the `combat_allies` table (migration 112), NEVER a plain
 *       `combat_enemies` row: that table is enemy-side only in every
 *       consumer (findActiveEnemy, applyDamageToEnemy, enemy economy,
 *       legendary/lair hooks, turn-order sideOf, COMBAT_START
 *       encounter-seq counting). A side flag on combat_enemies would
 *       need every consumer taught to exclude friendly rows, and one
 *       missed consumer turns an ally into a valid enemy target.
 *       The dedicated table keeps "combat_enemies = hostile" intact.
 *       This row is also the answer for the kind-C creatures (Hound of
 *       Ill Omen, Accursed Specter, Faithful Summons beasts — Amendment 2
 *       §4 #14) and the Wild Magic Friendly Creature row (Amendment 1
 *       §2, 05–08): the spell-cast family calls `createFriendlyActor`
 *       / `createSurgeCreature` for that row.
 *
 *   (b) Form-state records on the actor row — Circle Forms (the
 *       reference implementation), Dust Devil, Frozen Haunt, Crown of
 *       Spellfire, Potted Plant (first consumer, Amendment 2 §1.2).
 *       The actor IS the form: one `transformedForm` record in
 *       `class_resources_json` (own-parse, Artificer precedent —
 *       parseClassResources strips unknown top-level keys), carrying
 *       the form's numbers, with the actor's OWN hit points as the
 *       pool. No second actor row, no second HP pool.
 *
 * Stats are NEVER invented here. Entity numbers come from the bestiary
 * via bestiaryLookupService.lookupBestiaryFull (356 entries), from the
 * registry's own numbers via subclassService pure helpers, or from a
 * caller-supplied transcribed statblock (Ox — the registry says the
 * full stat block is in the source document, and createOx refuses
 * without one).
 *
 * Staged from cached mirror copies, not verified live (see NOTES.md).
 * The push step re-verifies live bytes first.
 */

import { dbAll, dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { lookupBestiaryFull, primaryActionFor } from './bestiaryLookupService.js';
import {
  moonWildShapeMaxCr, moonWildShapeAc, moonWildShapeTempHp,
  primalCompanionAc, primalCompanionHp,
  eldritchCannonHp, eldritchCannonAc,
  steelDefenderHp, steelDefenderAc,
  crownLifeForceMaxDice,
} from './subclassService.js';

// ---------------------------------------------------------------------------
// Row shape (migration 112, combat_allies)
// ---------------------------------------------------------------------------

export const FRIENDLY_ACTOR_KINDS = [
  'hound', 'specter', 'faithful_beast', 'surge_creature',
  'echo', 'steel_defender', 'eldritch_cannon', 'primal_companion',
  'ox', 'desert_spirit', 'stilled_spirit', 'ego_clone',
];

export const ALLY_EXPIRY_KINDS = [
  'never', 'turns', 'minutes', 'hour', 'long_rest', 'owner_death', 'dismissed',
];

const TABLE = { player: 'characters', companion: 'companions' };
const NAME_COL = { player: 'name', companion: null }; // companions name via npcs join
const LEVEL_COL = { player: 'level', companion: 'companion_level' };
const CLASS_COL = { player: 'class', companion: 'companion_class' };
const SUBCLASS_COL = { player: 'subclass', companion: 'companion_subclass' };
const ABILITY_COL = { player: 'ability_scores', companion: 'companion_ability_scores' };
const HP_COL = { player: 'current_hp', companion: 'companion_current_hp' };
const MAX_HP_COL = { player: 'max_hp', companion: 'companion_max_hp' };

export function abilityModOf(abilities, key) {
  const scores = typeof abilities === 'string' ? safeParse(abilities, {}) : (abilities || {});
  const score = Number(scores[key] ?? 10);
  return Math.floor((score - 10) / 2);
}

async function readOwnerRow(kind, id) {
  if (kind !== 'player' && kind !== 'companion') return null;
  if (kind === 'player') return dbGet('SELECT * FROM characters WHERE id = ?', [id]);
  const row = await dbGet(
    `SELECT c.*, n.name AS npc_name FROM companions c LEFT JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?`,
    [id],
  );
  return row || null;
}

function ownerDisplayName(kind, row) {
  if (!row) return null;
  if (kind === 'player') return row.name || null;
  return row.npc_name || row.name || null;
}

/** Owner zone from movementService positions (best-effort; null when unknown). */
export async function resolveOwnerZone(sessionId, encounterSeq, ownerKind, ownerId) {
  if (!sessionId || !encounterSeq) return null;
  try {
    const { readZones, positionOf } = await import('./movementService.js');
    const { ledgerKeyForTarget } = await import('./turnLedgerService.js');
    const zones = await readZones(sessionId, encounterSeq);
    if (!zones) return null;
    return positionOf(zones, await ledgerKeyForTarget(ownerKind, ownerId));
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// (a) Separate-actor rows — create / read / damage / heal / dismiss
// ---------------------------------------------------------------------------

function parseFlags(raw) {
  const parsed = typeof raw === 'string' ? safeParse(raw, {}) : (raw || {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function shapeAllyRow(row) {
  if (!row) return null;
  return {
    id: row.id, sessionId: row.session_id, encounterSeq: row.encounter_seq,
    name: row.name, kind: row.kind,
    ownerKind: row.owner_kind, ownerId: row.owner_id, ownerName: row.owner_name,
    maxHp: row.max_hp, currentHp: row.current_hp, tempHp: row.temp_hp,
    armorClass: row.armor_class, attackBonus: row.attack_bonus,
    damageDice: row.damage_dice, dexMod: row.dex_mod,
    zone: row.zone, status: row.status,
    statsJson: row.stats_json, flags: parseFlags(row.flags_json),
    expiresKind: row.expires_kind, expiresValue: row.expires_value,
  };
}

export async function getFriendlyActor(id) {
  const row = await dbGet('SELECT * FROM combat_allies WHERE id = ?', [id]);
  return shapeAllyRow(row);
}

export async function listFriendlyActors(sessionId, encounterSeq = null) {
  const rows = encounterSeq == null
    ? await dbAll('SELECT * FROM combat_allies WHERE session_id = ? ORDER BY id', [sessionId])
    : await dbAll(
      'SELECT * FROM combat_allies WHERE session_id = ? AND encounter_seq = ? ORDER BY id',
      [sessionId, encounterSeq],
    );
  return (rows || []).map(shapeAllyRow);
}

export async function listActiveFriendlyActors(sessionId, encounterSeq = null) {
  return (await listFriendlyActors(sessionId, encounterSeq)).filter((a) => a.status === 'active');
}

/**
 * The ONE friendly-side creation path. The spell-cast family calls this
 * for the Wild Magic Friendly Creature row; the C shells in
 * subclassMarkerService call the per-kind constructors below, which all
 * funnel through here. Refuses unknown kinds and unknown owners —
 * fail-closed, no invented rows.
 */
export async function createFriendlyActor(sessionId, encounterSeq, spec = {}) {
  const kind = String(spec.kind || '').trim();
  if (!FRIENDLY_ACTOR_KINDS.includes(kind)) {
    return { success: false, reason: `unknown friendly-actor kind: ${kind || '(none)'}` };
  }
  if (!sessionId || !encounterSeq) {
    return { success: false, reason: 'createFriendlyActor needs sessionId and encounterSeq' };
  }
  const ownerKind = spec.ownerKind === 'companion' ? 'companion' : 'player';
  const ownerRow = await readOwnerRow(ownerKind, spec.ownerId);
  if (!ownerRow) return { success: false, reason: `unknown owner: ${ownerKind} ${spec.ownerId}` };
  const name = String(spec.name || '').trim();
  if (!name) return { success: false, reason: 'createFriendlyActor needs a name' };
  const maxHp = Math.trunc(Number(spec.maxHp));
  if (!Number.isFinite(maxHp) || maxHp < 1) {
    return { success: false, reason: `invalid maxHp for ${name}: ${spec.maxHp}` };
  }
  const ac = Math.trunc(Number(spec.ac));
  if (!Number.isFinite(ac)) return { success: false, reason: `invalid AC for ${name}: ${spec.ac}` };
  const expiresKind = ALLY_EXPIRY_KINDS.includes(spec.expiresKind) ? spec.expiresKind : 'never';
  const zone = spec.zone ?? await resolveOwnerZone(sessionId, encounterSeq, ownerKind, spec.ownerId);
  const flags = spec.flags && typeof spec.flags === 'object' ? spec.flags : {};
  const currentHp = spec.currentHp != null ? Math.max(0, Math.min(maxHp, Math.trunc(Number(spec.currentHp)))) : maxHp;
  const r = await dbRun(
    `INSERT INTO combat_allies
       (session_id, encounter_seq, name, kind, owner_kind, owner_id, owner_name,
        max_hp, current_hp, temp_hp, armor_class, attack_bonus, damage_dice, dex_mod,
        zone, status, stats_json, flags_json, expires_kind, expires_value)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?)`,
    [
      sessionId, encounterSeq, name, kind, ownerKind, spec.ownerId,
      spec.ownerName || ownerDisplayName(ownerKind, ownerRow) || 'Unknown',
      maxHp, currentHp, Math.max(0, Math.trunc(Number(spec.tempHp) || 0)), ac,
      Math.trunc(Number(spec.attackBonus) || 0),
      spec.damageDice || null,
      Math.trunc(Number(spec.dexMod) || 0),
      zone || null, spec.statsJson ? JSON.stringify(spec.statsJson) : null,
      JSON.stringify(flags), expiresKind,
      spec.expiresValue != null ? Math.trunc(Number(spec.expiresValue)) : null,
    ],
  );
  const created = await getFriendlyActor(Number(r.lastInsertRowid));
  return { success: true, ally: created };
}

/**
 * Damage to a friendly actor. Temp HP absorbs first (2024). Untargetable
 * actors (Servant of the Desert) refuse without touching HP. A stilled
 * spirit heals from necrotic damage instead (registry: necrotic damage
 * heals it for half). 0 HP → status 'dead'. Shape mirrors
 * enemyCombatService.applyDamageToEnemy.
 */
export async function applyDamageToAlly(id, amount, { damageType = null } = {}) {
  const ally = await getFriendlyActor(id);
  if (!ally) return null;
  if (ally.status !== 'active') {
    return { type: 'ally_damage', allyId: ally.id, name: ally.name, damageDealt: 0, currentHp: ally.currentHp, maxHp: ally.maxHp, status: ally.status, killed: false, reason: `ally is ${ally.status}` };
  }
  if (ally.flags.untargetable || ally.flags.immuneAllDamage) {
    return { type: 'ally_damage', allyId: ally.id, name: ally.name, damageDealt: 0, currentHp: ally.currentHp, maxHp: ally.maxHp, status: ally.status, killed: false, reason: `${ally.name} cannot be damaged (${ally.flags.untargetable ? 'attacks miss it automatically' : 'immune to all damage'})` };
  }
  const rawDamage = Math.max(0, Math.trunc(amount) || 0);
  if (rawDamage === 0) {
    return { type: 'ally_damage', allyId: ally.id, name: ally.name, damageDealt: 0, currentHp: ally.currentHp, maxHp: ally.maxHp, status: ally.status, killed: false };
  }
  if (ally.flags.necroticHeals && String(damageType || '').toLowerCase() === 'necrotic') {
    const healed = Math.floor(rawDamage / 2);
    const newHp = Math.min(ally.maxHp, ally.currentHp + healed);
    await dbRun('UPDATE combat_allies SET current_hp = ? WHERE id = ?', [newHp, id]);
    return { type: 'ally_damage', allyId: ally.id, name: ally.name, damageDealt: -healed, healed, currentHp: newHp, maxHp: ally.maxHp, status: ally.status, killed: false, note: 'necrotic damage heals the spirit for half' };
  }
  const tempAbsorbed = Math.min(ally.tempHp, rawDamage);
  const toHp = rawDamage - tempAbsorbed;
  const newTemp = ally.tempHp - tempAbsorbed;
  const newHp = Math.max(0, ally.currentHp - toHp);
  const killed = newHp === 0;
  await dbRun('UPDATE combat_allies SET current_hp = ?, temp_hp = ?, status = ? WHERE id = ?',
    [newHp, newTemp, killed ? 'dead' : 'active', id]);
  return { type: 'ally_damage', allyId: ally.id, name: ally.name, damageDealt: rawDamage, tempAbsorbed, currentHp: newHp, maxHp: ally.maxHp, status: killed ? 'dead' : 'active', killed };
}

export async function healFriendlyActor(id, amount) {
  const ally = await getFriendlyActor(id);
  if (!ally) return null;
  const healed = Math.max(0, Math.trunc(amount) || 0);
  if (healed === 0 || ally.status !== 'active') {
    return { type: 'ally_heal', allyId: ally.id, name: ally.name, healed: 0, currentHp: ally.currentHp, maxHp: ally.maxHp, status: ally.status };
  }
  const newHp = Math.min(ally.maxHp, ally.currentHp + healed);
  await dbRun('UPDATE combat_allies SET current_hp = ? WHERE id = ?', [newHp, id]);
  return { type: 'ally_heal', allyId: ally.id, name: ally.name, healed: newHp - ally.currentHp, currentHp: newHp, maxHp: ally.maxHp, status: ally.status };
}

export async function dismissFriendlyActor(id, reason = 'dismissed') {
  const ally = await getFriendlyActor(id);
  if (!ally) return null;
  if (ally.status !== 'active') return { success: false, reason: `ally is ${ally.status}`, ally };
  await dbRun("UPDATE combat_allies SET status = 'dismissed' WHERE id = ?", [id]);
  return { success: true, ally: { ...ally, status: 'dismissed' }, reason };
}

/** Dismiss every active ally of one owner (owner death: Steel Defender vanishes). */
export async function dismissOwnerAllies(sessionId, ownerKind, ownerId, reason = 'owner gone') {
  const actives = (await listActiveFriendlyActors(sessionId))
    .filter((a) => a.ownerKind === ownerKind && Number(a.ownerId) === Number(ownerId));
  const out = [];
  for (const a of actives) out.push(await dismissFriendlyActor(a.id, reason));
  return out;
}

/**
 * Turn-count expiry sweep. The duration tracker (Family 5) calls this at
 * the owner's turn boundary for 'turns'-expiry rows; minute/hour/long-rest
 * expiries are wall-clock/rest events and are dismissed via
 * dismissByExpiryKind by their owning family.
 */
export async function decrementTurnExpiry(sessionId, encounterSeq) {
  const actives = await listActiveFriendlyActors(sessionId, encounterSeq);
  const expired = [];
  for (const a of actives) {
    if (a.expiresKind !== 'turns' || a.expiresValue == null) continue;
    const remaining = a.expiresValue - 1;
    if (remaining <= 0) {
      await dbRun("UPDATE combat_allies SET status = 'expired', expires_value = 0 WHERE id = ?", [a.id]);
      expired.push({ ...a, status: 'expired' });
    } else {
      await dbRun('UPDATE combat_allies SET expires_value = ? WHERE id = ?', [remaining, a.id]);
    }
  }
  return expired;
}

export async function dismissByExpiryKind(sessionId, expiryKind) {
  const actives = (await listActiveFriendlyActors(sessionId))
    .filter((a) => a.expiresKind === expiryKind);
  const out = [];
  for (const a of actives) {
    await dbRun("UPDATE combat_allies SET status = 'expired' WHERE id = ?", [a.id]);
    out.push({ ...a, status: 'expired' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bestiary extraction (no invented numbers — the entry IS the statblock)
// ---------------------------------------------------------------------------

function bestiaryNumbers(entry) {
  if (!entry) return null;
  const actions = Array.isArray(entry.actions) ? entry.actions : [];
  const primary = primaryActionFor(entry) || actions[0] || null;
  const damageDice = primary?.damage?.[0]?.dice || actions.flatMap((a) => (a.damage || []).map((d) => d.dice))[0] || null;
  const attackBonus = primary?.attackBonus ?? actions.find((a) => a.attackBonus != null)?.attackBonus ?? 0;
  const dex = Number(entry.abilities?.dex ?? 10);
  return {
    ac: Number(entry.ac ?? 12),
    hp: Number(entry.hp ?? 10),
    attackBonus: Number(attackBonus) || 0,
    damageDice,
    dexMod: Math.floor((dex - 10) / 2),
    cr: entry.cr != null ? parseFloat(entry.cr) : null,
    statsJson: entry,
  };
}

// ---------------------------------------------------------------------------
// Per-kind constructors — registry numbers only
// ---------------------------------------------------------------------------

/** Wild Magic Surge row 05–08 (Amendment 1 §2): 1d4 → Modron names mapped to bare bestiary keys. */
export const SURGE_CREATURE_TABLE = ['duodrone', 'flumph', 'monodrone', 'unicorn'];

export function surgeCreatureKeyForRoll(d4Roll) {
  const r = Math.trunc(Number(d4Roll));
  if (r < 1 || r > 4) return null;
  return SURGE_CREATURE_TABLE[r - 1];
}

export async function createSurgeCreature(sessionId, encounterSeq, owner, { d4Roll, zone } = {}) {
  const key = surgeCreatureKeyForRoll(d4Roll);
  if (!key) return { success: false, reason: `surge creature roll must be 1–4, got ${d4Roll}` };
  const entry = await lookupBestiaryFull(key);
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: `no bestiary entry for surge creature ${key}` };
  const displayName = { duodrone: 'Modron Duodrone', monodrone: 'Modron Monodrone' }[key] || entry.name;
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'surge_creature', name: displayName, ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: nums.hp, ac: nums.ac, attackBonus: nums.attackBonus,
    damageDice: nums.damageDice, dexMod: nums.dexMod, zone,
    statsJson: nums.statsJson,
    flags: { dmControlled: true, surgeRow: '05–08', bestiaryKey: key },
    expiresKind: 'minutes', expiresValue: 1,
  });
}

/** Hound of Ill Omen (Shadow Sorcerer 6): dire wolf stats, Medium, monstrosity, temp HP = half sorcerer level. */
export async function createHoundOfIllOmen(sessionId, encounterSeq, owner, { targetName, sorcererLevel, zone } = {}) {
  if (!targetName) return { success: false, reason: 'Hound of Ill Omen needs a target creature' };
  const entry = await lookupBestiaryFull('Dire Wolf');
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: 'no bestiary entry for Dire Wolf' };
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'hound', name: 'Hound of Ill Omen', ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: nums.hp, tempHp: Math.floor((Number(sorcererLevel) || 0) / 2),
    ac: nums.ac, attackBonus: nums.attackBonus, damageDice: nums.damageDice, dexMod: nums.dexMod,
    zone, statsJson: nums.statsJson,
    flags: {
      sizeOverride: 'Medium', typeOverride: 'monstrosity',
      saveDisadvantageTarget: targetName, movesThroughTerrain: true, endInsideForceDamage: 5,
      knowsTargetLocation: true, attacksOnlyTarget: true, targetName,
    },
    expiresKind: 'minutes', expiresValue: 5,
  });
}

/**
 * Hound save-disadvantage hook (Amendment 2 §4 #5): the row exists, so
 * Family 6's save path can ask whether an active Hound owned by this
 * caster is hunting this target. Proximity (within 5 ft) is judged by
 * the save path from movement zones — this only answers "a Hound is
 * hunting this target for this caster".
 */
export async function findActiveHound(sessionId, encounterSeq, ownerKind, ownerId, targetName) {
  const actives = await listActiveFriendlyActors(sessionId, encounterSeq);
  return actives.find((a) => a.kind === 'hound'
    && a.ownerKind === ownerKind && Number(a.ownerId) === Number(ownerId)
    && String(a.flags.saveDisadvantageTarget || '').toLowerCase() === String(targetName || '').toLowerCase()) || null;
}

/** Accursed Specter (Hexblade 6): specter stats, temp HP = half warlock level, attack bonus + Cha mod (min +0). */
export async function createAccursedSpecter(sessionId, encounterSeq, owner, { warlockLevel, chaMod, slainName, zone } = {}) {
  const entry = await lookupBestiaryFull('Specter');
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: 'no bestiary entry for Specter' };
  const chaBonus = Math.max(0, Number(chaMod) || 0);
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'specter', name: slainName ? `Specter of ${slainName}` : 'Accursed Specter',
    ownerKind: owner.kind, ownerId: owner.id, ownerName: owner.name,
    maxHp: nums.hp, tempHp: Math.floor((Number(warlockLevel) || 0) / 2),
    ac: nums.ac, attackBonus: nums.attackBonus + chaBonus, damageDice: nums.damageDice,
    dexMod: nums.dexMod, zone, statsJson: nums.statsJson,
    flags: { incorporealMovement: true, attackBonusFromCha: chaBonus, slainName: slainName || null },
    expiresKind: 'long_rest', expiresValue: null,
  });
}

/** Validate one Faithful Summons beast (bestiary exists, CR 2 or lower) without creating a row. */
export async function validateFaithfulBeast(beastName) {
  if (!beastName) return { success: false, reason: 'Faithful Summons needs a beast name' };
  const entry = await lookupBestiaryFull(beastName);
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: `no bestiary entry for ${beastName}` };
  if (nums.cr != null && nums.cr > 2) {
    return { success: false, reason: `${entry.name} is CR ${nums.cr} — Faithful Summons summons beasts of CR 2 or lower` };
  }
  return { success: true, entry, cr: nums.cr };
}

/** One Faithful Summons beast (Shepherd 14): bestiary lookup, CR 2 or lower, 1 hour, no concentration. */
export async function createFaithfulBeast(sessionId, encounterSeq, owner, { beastName, zone } = {}) {
  const valid = await validateFaithfulBeast(beastName);
  if (!valid.success) return valid;
  const entry = valid.entry;
  const nums = bestiaryNumbers(entry);
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'faithful_beast', name: `${entry.name} (Faithful Summons)`,
    ownerKind: owner.kind, ownerId: owner.id, ownerName: owner.name,
    maxHp: nums.hp, ac: nums.ac, attackBonus: nums.attackBonus, damageDice: nums.damageDice,
    dexMod: nums.dexMod, zone, statsJson: nums.statsJson,
    flags: { bestiaryKey: beastName, conjureAnimalsAs9th: true },
    expiresKind: 'hour', expiresValue: 1,
  });
}

/**
 * Manifest Echo (Echo Knight 3) / Legion of One (18). AC 14 + PB, HP 1,
 * immune to all conditions, speed 30 ft on your turn, destroyed if more
 * than 30 ft away at end of turn. Legion rule: creating a third echo
 * destroys the previous two — so manifesting while 2 are active
 * dismisses both first, then creates the new one(s).
 */
export async function createEcho(sessionId, encounterSeq, owner, { count = 1, zone } = {}) {
  const ownerRow = await readOwnerRow(owner.kind, owner.id);
  if (!ownerRow) return { success: false, reason: `unknown owner: ${owner.kind} ${owner.id}` };
  const level = Number(ownerRow[LEVEL_COL[owner.kind]] || 1);
  const pb = Math.ceil(level / 4) + 1;
  const existing = (await listActiveFriendlyActors(sessionId, encounterSeq))
    .filter((a) => a.kind === 'echo' && a.ownerKind === owner.kind && Number(a.ownerId) === Number(owner.id));
  if (existing.length + count > 2) {
    for (const e of existing) await dismissFriendlyActor(e.id, 'a third echo destroys the previous two (Legion of One)');
  }
  const created = [];
  for (let i = 0; i < count; i++) {
    const res = await createFriendlyActor(sessionId, encounterSeq, {
      kind: 'echo', name: `Echo of ${owner.name || 'Unknown'}`, ownerKind: owner.kind, ownerId: owner.id,
      ownerName: owner.name, maxHp: 1, ac: 14 + pb, attackBonus: 0, damageDice: null,
      dexMod: 0, zone, statsJson: null,
      flags: {
        conditionImmune: true, speedFt: 30, destroyBeyondFt: 30,
        teleportSwapCostFt: 15, attackOrigin: 'self-or-echo', slot: i + 1,
      },
      expiresKind: 'never', expiresValue: null,
    });
    if (!res.success) return { success: false, reason: res.reason, created };
    created.push(res.ally);
  }
  return { success: true, allies: created };
}

/** Steel Defender (Battle Smith 3). One active at a time; replace is a Long Rest flow (Family 7). */
export async function createSteelDefender(sessionId, encounterSeq, owner, { artificerLevel, intMod, spellAttackBonus, zone } = {}) {
  const existing = (await listActiveFriendlyActors(sessionId, encounterSeq))
    .filter((a) => a.kind === 'steel_defender' && a.ownerKind === owner.kind && Number(a.ownerId) === Number(owner.id));
  if (existing.length > 0) {
    return { success: false, reason: 'a Steel Defender is already active — replace it at the end of a Long Rest with Smith\'s Tools in hand' };
  }
  const level = Number(artificerLevel) || 0;
  const im = Number(intMod) || 0;
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'steel_defender', name: 'Steel Defender', ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: steelDefenderHp(level), ac: steelDefenderAc(im),
    attackBonus: Number(spellAttackBonus) || 0, damageDice: `1d8+2+${im}`, dexMod: 1, zone,
    statsJson: {
      size: 'Medium', type: 'Construct', speedFt: 40,
      abilities: { str: 14, dex: 12, con: 14, int: 4, wis: 10, cha: 6 },
      immunities: ['Poison', 'Charmed', 'Exhaustion', 'Poisoned'],
      senses: 'Darkvision 60 ft, Passive Perception 10',
    },
    flags: {
      rendDamage: `1d8+2+${im} Force`, repairUsesMax: 3, repairUsesLeft: 3,
      repairHealing: `2d8+${im}`, deflectAttack: true, steelBond: true,
      vanishesWhenOwnerDies: true,
    },
    expiresKind: 'owner_death', expiresValue: null,
  });
}

/**
 * Eldritch Cannon (Artillerist 3). Max 1 active — 2 with Fortified
 * Position (15). The count is read from the owner's own features, not
 * assumed.
 */
export async function createEldritchCannon(sessionId, encounterSeq, owner, { artificerLevel, option, zone } = {}) {
  const { featuresAtLevel } = await import('./subclassService.js');
  const ownerRow = await readOwnerRow(owner.kind, owner.id);
  if (!ownerRow) return { success: false, reason: `unknown owner: ${owner.kind} ${owner.id}` };
  const feats = featuresAtLevel(
    ownerRow[CLASS_COL[owner.kind]], ownerRow[SUBCLASS_COL[owner.kind]], ownerRow[LEVEL_COL[owner.kind]],
  );
  const maxActive = feats.some((f) => f.key === 'fortified_position') ? 2 : 1;
  const existing = (await listActiveFriendlyActors(sessionId, encounterSeq))
    .filter((a) => a.kind === 'eldritch_cannon' && a.ownerKind === owner.kind && Number(a.ownerId) === Number(owner.id));
  if (existing.length >= maxActive) {
    return { success: false, reason: `already ${existing.length} Eldritch Cannon(s) active (max ${maxActive}) — recreate on a Long Rest or by expending a spell slot` };
  }
  const validOptions = ['flamethrower', 'force_ballista', 'protector'];
  const opt = validOptions.includes(String(option || '').toLowerCase().replace(/[\s-]+/g, '_'))
    ? String(option).toLowerCase().replace(/[\s-]+/g, '_') : null;
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'eldritch_cannon', name: 'Eldritch Cannon', ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: eldritchCannonHp(Number(artificerLevel) || 0),
    ac: eldritchCannonAc(), attackBonus: 0, damageDice: null, dexMod: 0, zone,
    statsJson: { size: 'Small or Tiny', immunities: ['Poison', 'Psychic'], mendingHeal: '2d6' },
    flags: {
      option: opt, immunities: ['Poison', 'Psychic'],
      activationRangeFt: 60, moveFt: 15, maxActive,
      options: {
        flamethrower: { area: '15-foot cone', save: 'Dexterity', damage: '2d8 Fire' },
        force_ballista: { rangeFt: 120, damage: '2d8 Force', pushFt: 5 },
        protector: { rangeFt: 10, tempHp: '1d8+Int' },
      },
    },
    expiresKind: 'hour', expiresValue: 1,
  });
}

/** Primal Companion (Beast Master 3). One active beast; the stored choice picks the statblock. */
export async function createPrimalCompanion(sessionId, encounterSeq, owner, { statblock, rangerLevel, wisMod, pb, zone } = {}) {
  const key = String(statblock || '').toLowerCase();
  if (!['land', 'sea', 'sky'].includes(key)) {
    return { success: false, reason: `Primal Companion statblock must be Land, Sea, or Sky — got ${statblock}` };
  }
  const existing = (await listActiveFriendlyActors(sessionId, encounterSeq))
    .filter((a) => a.kind === 'primal_companion' && a.ownerKind === owner.kind && Number(a.ownerId) === Number(owner.id));
  if (existing.length > 0) {
    return { success: false, reason: 'a Primal Companion is already active — dismiss it before summoning another' };
  }
  const level = Number(rangerLevel) || 0;
  const wm = Number(wisMod) || 0;
  const hp = primalCompanionHp(key, level);
  const strike = key === 'land' ? { damageDice: `1d8+2+${wm}`, riders: { chargeExtra: '1d6', proneIfLargeOrSmaller: true, chargeFt: 20 } }
    : key === 'sea' ? { damageDice: `1d6+2+${wm}`, riders: { grappled: true, escapeDc: 'spell save DC' } }
    : { damageDice: `1d4+3+${wm}`, riders: {} };
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'primal_companion', name: `Beast of the ${key[0].toUpperCase() + key.slice(1)}`,
    ownerKind: owner.kind, ownerId: owner.id, ownerName: owner.name,
    maxHp: hp, ac: primalCompanionAc(wm), attackBonus: 0, damageDice: strike.damageDice,
    dexMod: 0, zone,
    statsJson: { statblock: key, hitDice: key === 'sky' ? `d6s equal to Ranger level` : `d8s equal to Ranger level` },
    flags: { statblock: key, primalBondPb: Number(pb) || 0, strikeRiders: strike.riders, command: 'bonus action or sacrificed attack' },
    expiresKind: 'never', expiresValue: null,
  });
}

/**
 * Servant of the Desert spirit (Sand Druid 3). No HP or AC to track:
 * attacks miss automatically, it succeeds on all saving throws, immune
 * to all damage and conditions. Represented as a 1-HP row with the
 * untargetable/immune flags — applyDamageToAlly refuses before HP is
 * ever touched, so the 1 is never a real pool.
 */
export async function createServantOfTheDesert(sessionId, encounterSeq, owner, { spiritForm, zone } = {}) {
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'desert_spirit', name: 'Servant of the Desert', ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: 1, ac: 10, attackBonus: 0, damageDice: null, dexMod: 0, zone,
    statsJson: { form: 'insubstantial cloud of sand, five-foot cube', shape: spiritForm || null },
    flags: {
      untargetable: true, immuneAllDamage: true, immuneAllConditions: true, autoSave: true,
      interposeReaction: true, swarmBlinded: true, staysWithinFt: 5,
    },
    expiresKind: 'never', expiresValue: null,
  });
}

/** Stilled Summons spirit (Unborn Druid 3): a Beast statblock per Wild Shape limits, type Undead. */
export async function createStilledSpirit(sessionId, encounterSeq, owner, { beastKey, druidLevel, zone } = {}) {
  if (!beastKey) return { success: false, reason: 'Stilled Summons needs a beast statblock' };
  const entry = await lookupBestiaryFull(beastKey);
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: `no bestiary entry for ${beastKey}` };
  const maxCr = moonWildShapeMaxCr(Number(druidLevel) || 0);
  if (nums.cr != null && nums.cr > maxCr) {
    return { success: false, reason: `${entry.name} is CR ${nums.cr} — Wild Shape limits allow CR ${maxCr} at Druid level ${druidLevel}` };
  }
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'stilled_spirit', name: `Stillborn Spirit (${entry.name})`,
    ownerKind: owner.kind, ownerId: owner.id, ownerName: owner.name,
    maxHp: nums.hp, ac: nums.ac, attackBonus: nums.attackBonus, damageDice: nums.damageDice,
    dexMod: nums.dexMod, zone, statsJson: nums.statsJson,
    flags: { typeOverride: 'Undead', necroticHeals: true, necroticDamage: true, onDestroyedCurse: true, bestiaryKey: beastKey },
    expiresKind: 'hour', expiresValue: 1,
  });
}

/**
 * Extraneous Ego clone (Beholder Warlock 14). HP = half the owner's
 * maximum, full PC stat copy, takes the owner's initiative place, none
 * of the gear. The death-save suspension is a flag the death-save path
 * reads; the HP transfer on vanish is a function the duration tracker
 * calls. THE PERMANENCE RULE (clone becomes the new body permanently
 * if the owner would die while it is present) is NOT built here — it
 * is a character-row swap, scoped separately inside the entity job
 * (Amendment 2 §3 #13 / §5.2 #9). The row carries
 * flags.permanencePending so the follow-up finds it; no character row
 * is touched by this constructor.
 */
export async function createExtraneousEgoClone(sessionId, encounterSeq, owner, { zone } = {}) {
  const ownerRow = await readOwnerRow(owner.kind, owner.id);
  if (!ownerRow) return { success: false, reason: `unknown owner: ${owner.kind} ${owner.id}` };
  const maxHp = Number(ownerRow[MAX_HP_COL[owner.kind]] || 0);
  if (!maxHp) return { success: false, reason: 'Extraneous Ego needs the owner\'s maximum HP' };
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'ego_clone', name: `${ownerDisplayName(owner.kind, ownerRow) || 'Unknown'} (Dream Self)`,
    ownerKind: owner.kind, ownerId: owner.id, ownerName: owner.name,
    maxHp: Math.floor(maxHp / 2), ac: 10, attackBonus: 0, damageDice: null, dexMod: 0, zone,
    statsJson: {
      ownerSnapshot: {
        class: ownerRow[CLASS_COL[owner.kind]], subclass: ownerRow[SUBCLASS_COL[owner.kind]],
        level: ownerRow[LEVEL_COL[owner.kind]], abilityScores: ownerRow[ABILITY_COL[owner.kind]],
        maxHp,
      },
    },
    flags: {
      noGear: true, deathSaveSuspended: true, hpTransferOnVanish: true,
      initiativeTakesOwnerPlace: true, permanencePending: true,
      permanenceNote: 'FOLLOW-UP: if the owner would die while the clone is present, the clone becomes the new body permanently (character-row swap — not built here)',
    },
    expiresKind: 'minutes', expiresValue: 1,
  });
}

/**
 * Ox Contraption (Lumberjack 3). The registry carries NO statblock —
 * "full stat block is in the source document". Nothing is invented:
 * the caller passes the transcribed stats, and the constructor refuses
 * without them.
 */
export async function createOx(sessionId, encounterSeq, owner, { stats, zone } = {}) {
  if (!stats || !Number.isFinite(Number(stats.maxHp)) || !Number.isFinite(Number(stats.ac))) {
    return { success: false, reason: 'Ox statblock not transcribed — the source document holds it; pass transcribed { maxHp, ac, attackBonus, damageDice }' };
  }
  return createFriendlyActor(sessionId, encounterSeq, {
    kind: 'ox', name: 'Ox Contraption', ownerKind: owner.kind, ownerId: owner.id,
    ownerName: owner.name, maxHp: Math.trunc(Number(stats.maxHp)), ac: Math.trunc(Number(stats.ac)),
    attackBonus: Math.trunc(Number(stats.attackBonus) || 0),
    damageDice: stats.damageDice || null,
    dexMod: Math.trunc(Number(stats.dexMod) || 0), zone,
    statsJson: stats.statsJson || { size: 'Large', type: 'construct companion', source: 'source-document transcription' },
    flags: { size: 'Large', type: 'construct', usesPb: true, statsSource: 'source-document', goreBonus: stats.goreBonus || null },
    expiresKind: 'never', expiresValue: null,
  });
}

// ---------------------------------------------------------------------------
// (b) Form-state records on the actor row (class_resources_json,
//     own-parse — parseClassResources strips unknown top-level keys)
// ---------------------------------------------------------------------------

export const FORM_KINDS = ['circle_form', 'dust_devil', 'frozen_haunt', 'crown_of_spellfire', 'potted_plant'];

async function readResourcesRaw(kind, id) {
  const row = await dbGet(`SELECT class_resources_json FROM ${TABLE[kind]} WHERE id = ?`, [id]);
  if (!row) return null;
  const parsed = typeof row.class_resources_json === 'string'
    ? safeParse(row.class_resources_json, {}) : (row.class_resources_json || {});
  return { row, raw: parsed && typeof parsed === 'object' ? parsed : {} };
}

async function writeResourcesRaw(kind, id, raw) {
  await dbRun(`UPDATE ${TABLE[kind]} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(raw), id]);
}

export async function getFormState(kind, id) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return null;
  return got.raw.transformedForm || null;
}

/**
 * Apply a form-state record. One form at a time — applying while
 * transformed refuses unless replace:true (no rule in the registry
 * covers stacking forms, so none is invented).
 */
export async function applyFormState(kind, id, form, { replace = false } = {}) {
  if (!FORM_KINDS.includes(form?.kind)) {
    return { success: false, reason: `unknown form kind: ${form?.kind}` };
  }
  if (!form.until) return { success: false, reason: 'a form-state record needs an until rule' };
  const got = await readResourcesRaw(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  if (got.raw.transformedForm && !replace) {
    return { success: false, reason: `${got.raw.transformedForm.kind} is already active — dismiss it before applying ${form.kind}` };
  }
  got.raw.transformedForm = { ...form, appliedAt: new Date().toISOString(), hpPool: 'own' };
  await writeResourcesRaw(kind, id, got.raw);
  return { success: true, form: got.raw.transformedForm };
}

export async function clearFormState(kind, id, { removeConditions = [] } = {}) {
  const got = await readResourcesRaw(kind, id);
  if (!got) return { success: false, reason: 'unknown actor' };
  const had = got.raw.transformedForm || null;
  if (!had) return { success: true, cleared: false, form: null };
  delete got.raw.transformedForm;
  await writeResourcesRaw(kind, id, got.raw);
  for (const cond of removeConditions) {
    try {
      const { removeCondition } = await import('./conditionService.js');
      await removeCondition(kind, id, cond);
    } catch { /* form is cleared; condition cleanup is best-effort */ }
  }
  return { success: true, cleared: true, form: had };
}

/** Circle Forms (Moon 3) — the reference implementation. Spend of the Wild Shape use is Family 2's. */
export async function applyCircleForm(kind, id, { beast, wisMod, druidLevel } = {}) {
  if (!beast) return { success: false, reason: 'Circle Forms needs a beast' };
  const entry = await lookupBestiaryFull(beast);
  const nums = bestiaryNumbers(entry);
  if (!nums) return { success: false, reason: `no bestiary entry for ${beast}` };
  const maxCr = moonWildShapeMaxCr(Number(druidLevel) || 0);
  if (nums.cr != null && nums.cr > maxCr) {
    return { success: false, reason: `${entry.name} is CR ${nums.cr} — Circle Forms allow CR ${maxCr} at Druid level ${druidLevel}` };
  }
  return applyFormState(kind, id, {
    kind: 'circle_form', beast: entry.name, beastKey: beast,
    ac: moonWildShapeAc(Number(wisMod) || 0, nums.ac),
    tempHp: moonWildShapeTempHp(Number(druidLevel) || 0),
    maxCr, until: 'dismissed or 0 temporary HP', source: 'circle_forms',
    statsJson: nums.statsJson,
  });
}

/**
 * Potted Plant (Wild Magic 37–40) — first consumer of the form-state
 * system (Amendment 2 §1.2). The plant's HP ARE the sorcerer's own —
 * no second pool. Incapacitated via conditionService; vulnerability
 * to all damage rides the form record as `vulnerableAll` until the
 * D9 table (Family 6) reads it. Revert: 0 HP (revertFormIfZeroHp,
 * called from the damage path) or start of next turn (duration
 * tracker, Family 5).
 */
export async function applyPottedPlant(kind, id) {
  const res = await applyFormState(kind, id, {
    kind: 'potted_plant', until: 'start of next turn', source: 'wild_magic_surge_37_40',
    vulnerableAll: true, incapacitated: true,
  });
  if (!res.success) return res;
  try {
    const { addCondition } = await import('./conditionService.js');
    await addCondition(kind, id, 'incapacitated');
  } catch { /* form is recorded; the condition is best-effort here */ }
  return res;
}

/** Dust Devil (Sand 14): 1 Wild Shape use (Family 2 spends it), 1 minute. */
export async function applyDustDevil(kind, id, { druidLevel, walkSpeed } = {}) {
  return applyFormState(kind, id, {
    kind: 'dust_devil', until: '1 minute', source: 'dust_devil',
    size: 'Large', tempHpPerTurn: Number(druidLevel) || 0,
    resistances: ['cold', 'fire'], flySpeed: Number(walkSpeed) || null,
    aura: { radiusFt: 10, effect: 'heavily obscured for creatures other than you' },
    spiritLockout: true,
  });
}

/** Frozen Haunt (Winter Walker 15): rides Hunter's Mark concentration; cold immunity; 15-ft 2d4 cold emanation. */
export async function applyFrozenHaunt(kind, id) {
  return applyFormState(kind, id, {
    kind: 'frozen_haunt', until: 'while Hunter\'s Mark lasts', source: 'frozen_haunt',
    immunities: ['cold'], conditionImmunities: ['grappled', 'prone', 'restrained'],
    emanation: { radiusFt: 15, damage: '2d4 Cold', timing: 'on adoption and at the start of each subsequent turn' },
    incorporealMovement: true, endInsideForceDamage: '1d10',
    reuse: 'once per Long Rest unless a level 4+ spell slot is expended',
  });
}

/** Crown of Spellfire (Spellfire 18): altered Innate Sorcery state, not a separate entity. */
export async function applyCrownOfSpellfire(kind, id, { chaMod } = {}) {
  return applyFormState(kind, id, {
    kind: 'crown_of_spellfire', until: 'while this use of Innate Sorcery is active', source: 'crown_of_spellfire',
    flySpeed: 60, hover: true,
    burningLifeForceMaxDice: crownLifeForceMaxDice(Number(chaMod) || 0),
    spellAvoidance: true, reuse: 'once per Long Rest unless 5 Sorcery Points restore it',
  });
}

/** Revert a form when the actor hits 0 HP (Potted Plant's pot-break rule; Circle Forms' 0-temp-HP rule calls this too). */
export async function revertFormIfZeroHp(kind, id) {
  const row = await dbGet(`SELECT ${HP_COL[kind]} AS hp FROM ${TABLE[kind]} WHERE id = ?`, [id]);
  if (!row || Number(row.hp) > 0) return { reverted: false };
  const form = await getFormState(kind, id);
  if (!form) return { reverted: false };
  const cleared = await clearFormState(kind, id, {
    removeConditions: form.kind === 'potted_plant' ? ['incapacitated'] : [],
  });
  return { reverted: cleared.cleared, form: cleared.form };
}

export default {
  FRIENDLY_ACTOR_KINDS, FORM_KINDS, SURGE_CREATURE_TABLE,
  abilityModOf, resolveOwnerZone,
  getFriendlyActor, listFriendlyActors, listActiveFriendlyActors,
  createFriendlyActor, applyDamageToAlly, healFriendlyActor,
  dismissFriendlyActor, dismissOwnerAllies,
  decrementTurnExpiry, dismissByExpiryKind,
  surgeCreatureKeyForRoll, createSurgeCreature,
  createHoundOfIllOmen, findActiveHound, createAccursedSpecter,
  validateFaithfulBeast, createFaithfulBeast, createEcho, createSteelDefender,
  createEldritchCannon, createPrimalCompanion, createServantOfTheDesert,
  createStilledSpirit, createExtraneousEgoClone, createOx,
  getFormState, applyFormState, clearFormState,
  applyCircleForm, applyPottedPlant, applyDustDevil, applyFrozenHaunt,
  applyCrownOfSpellfire, revertFormIfZeroHp,
};
