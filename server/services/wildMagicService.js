/**
 * Wild Magic Service — mechanics hooks, Family 5.
 *
 * Wild Magic Surge (Sorcerer, Wild Magic Sorcery, 3rd, kind T) plus the
 * Life-adjacent table options that ride the same hook: Tides of Chaos
 * (forced table roll), Controlled Chaos (roll twice, use either),
 * Tamed Surge (choose, once per Long Rest, EXCEPT the final row
 * 97–00 Boon).
 *
 * Book text (2024 PHB pp. 149–150, photo-verified 2026-11-06):
 * "once per turn, roll 1d20 immediately after you cast a Sorcerer
 * spell with a spell slot; on a 20, roll on the Wild Magic Surge
 * table." The d20 roll is OPTIONAL ("you can roll a d20") — for a PC
 * the hook OFFERS the roll via a pending block, never forces it; for
 * a companion the system decides (rolls). Tides of Chaos is the
 * contrast case: it says you AUTOMATICALLY roll — that one IS forced,
 * a separate trigger into the same hook.
 *
 * Architecture (no cycles): this service reads the registry
 * (subclassService) and the duration tracker. It NEVER imports
 * spellCastService — the Random Spell row (57–60) returns a cast
 * plan that spellCastService executes through its own cast path
 * (with a recursion guard). DB-touching steps (conditions, damage,
 * healing, teleports, slot restore) are dynamic imports inside
 * try/catch: when they cannot run (no session, no DB in a smoke
 * run), the row still records its state and the step lands in
 * `pending` with a reason instead of throwing. applySurgeRow never
 * throws.
 *
 * The once-per-turn gate is a turn-ledger budget entry owned by
 * spellCastService's hook (it holds the session/encounter); this
 * service accepts opts.alreadyRolledThisTurn and refuses on it.
 *
 * D9 resistance table: the saves family owns
 * resistanceService.resistanceFor — it was NOT in the cached mirror,
 * so rows 33–36 / 93–96 (and Potted Plant's vulnerability) call the
 * clearly-marked local `resistanceFor` / `vulnerabilityFor` defined
 * here, reading the same timed-effects records. MERGE POINT (see
 * HANDOFF.md): when the saves family lands resistanceService, replace
 * these two local functions with calls into it; the tracker record
 * shape stays the same.
 *
 * Friendly Creature (05–08): the friendly-side row shape is owned by
 * the entity family (Amendment 2 §3 shape (a)). This service maps the
 * 1d4 pick to its bestiary key and returns the exact creation call in
 * the row result (`creationCall`); see HANDOFF.md. It does NOT invent
 * a combat_enemies row for a friendly creature.
 */

import {
  featuresAtLevel,
  getSubclass,
  wildMagicSurgeOnRoll,
} from './subclassService.js';
import {
  applyTimedEffect,
  hasTimedEffect,
  MINUTE_TURNS,
} from './durationTrackerService.js';

// ---------------------------------------------------------------------------
// Dice helpers (rng is () => [0, 1); defaults to Math.random)
// ---------------------------------------------------------------------------

export function rollDie(sides, rng = Math.random) {
  const r = typeof rng === 'function' ? rng() : Math.random();
  return 1 + Math.floor(r * sides);
}

export function rollDice(count, sides, rng = Math.random) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(rollDie(sides, rng));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

// ---------------------------------------------------------------------------
// Registry table
// ---------------------------------------------------------------------------

export function getSurgeTable() {
  try {
    const entry = getSubclass('sorcerer', 'Wild Magic Sorcery');
    const feature = (entry?.features || []).find((f) => f.key === 'wild_magic_surge');
    const entries = feature?.mechanics?.surgeTable?.entries;
    return Array.isArray(entries) ? entries : [];
  } catch {
    return [];
  }
}

function normalizeRange(range) {
  return String(range || '').replace(/[–—]/g, '-').trim();
}

function rangeBounds(range) {
  const [a, b] = normalizeRange(range).split('-').map((s) => s.trim());
  const start = Number(a);
  const end = b == null ? start : (b === '00' ? 100 : Number(b));
  return { start: start === 0 ? 100 : start, end: end === 0 ? 100 : end };
}

/** The registry row whose d100 range contains `d100` (1–100; 00 = 100), or null. */
export function findSurgeRow(d100) {
  const n = Number(d100);
  if (!Number.isFinite(n) || n < 1 || n > 100) return null;
  for (const entry of getSurgeTable()) {
    const { start, end } = rangeBounds(entry.range);
    if (n >= start && n <= end) return entry;
  }
  return null;
}

export function surgeRowForRange(range) {
  const want = normalizeRange(range);
  return getSurgeTable().find((e) => normalizeRange(e.range) === want) || null;
}

// ---------------------------------------------------------------------------
// SURGE_ROW_EFFECTS — per-row engine map (Amendment 1 §2, Amendment 2 §1).
// Keyed by registry range. `status`: landed | partial | blocked-entity.
// `family`: the engine family that applies the row.
// ---------------------------------------------------------------------------

export const SURGE_ROW_EFFECTS = {
  '01–04': { name: 'Roll Again', family: 'duration tracker + turn-boundary re-roll', status: 'landed', engine: 'timedEffects wild_magic_roll_again (10 turns); advanceTurn re-rolls the table at each turn start (HANDOFF).' },
  '05–08': { name: 'Friendly Creature', family: 'entity via bestiary', status: 'partial', engine: '1d4 pick mapped to a bestiary key; creation is the entity family createFriendlyActor call (HANDOFF) — no friendly row exists yet.' },
  '09–12': { name: 'Regeneration', family: 'turn-start heal + duration tracker', status: 'landed', engine: 'timedEffects wild_magic_regeneration (10 turns, 5 HP/turn); advanceTurn heals at turn start (HANDOFF).' },
  '13–16': { name: 'Weakened Saves', family: 'save (disadvantage on saves vs next spell, 1 min)', status: 'landed', engine: 'timedEffects wild_magic_weakened_saves (10 turns); resolveSpellSave reads it (HANDOFF).' },
  '17–20': { name: 'Strange Effect', family: 'recorded surge state (cosmetic) / E hook (eye)', status: 'landed', engine: '1d8 sub-table; each sub-effect recorded as surge state via the duration tracker and shown in the DM prompt (Amendment 2 §1.5).' },
  '21–24': { name: 'Bonus-Action Spells', family: 'casting-time modifier, 1 min', status: 'landed', engine: 'timedEffects wild_magic_bonus_action_spells (10 turns); spellCastDecision reads it (HANDOFF).' },
  '25–28': { name: 'Astral Jaunt', family: 'removed-from-combat state + return positioning', status: 'landed', engine: 'session_config.removedFromCombat + timedEffects (2 turns); advanceTurn skips the actor and returns them (HANDOFF).' },
  '29–32': { name: 'Maximum Damage', family: 'max damage dice, next damaging spell within 1 min', status: 'landed', engine: 'timedEffects wild_magic_maximum_damage (10 turns); spell damage path consumes it (HANDOFF).' },
  '33–36': { name: 'Damage Resistance', family: 'resistance table (D9)', status: 'landed', engine: 'timedEffects wild_magic_damage_resistance (10 turns, resistance all); local surgeResistanceFor() until resistanceService lands (MERGE POINT).' },
  '37–40': { name: 'Potted Plant', family: 'form-state record + Incapacitated + vulnerability', status: 'landed', engine: 'session_config.transformedForms potted_plant + Incapacitated via conditionService + vulnerability via local surgeVulnerabilityFor() (MERGE POINT).' },
  '41–44': { name: 'Short Teleports', family: 'teleport action + duration tracker', status: 'landed', engine: 'timedEffects wild_magic_short_teleports (10 turns, 20 ft); teleport via movementService.teleportActor, bonus-action charge via turn ledger (HANDOFF).' },
  '45–48': { name: 'Invisibility', family: 'condition + duration tracker + end-on-action', status: 'landed', engine: 'Invisible via conditionService + timedEffects (10 turns); end-on-attack/damage/spell hook in those paths (HANDOFF).' },
  '49–52': { name: 'Spectral Shield', family: '+2 AC + Magic Missile immunity, 1 min', status: 'partial', engine: 'timedEffects wild_magic_spectral_shield (10 turns, acBonus 2, magicMissileImmune); AC-computation read site not verified in the cached mirror — attack family to wire the read (HANDOFF).' },
  '53–56': { name: 'Extra Action', family: 'extra action this turn (turn ledger)', status: 'partial', engine: 'timedEffects wild_magic_extra_action (1 turn); turn ledger grants actionsAvailable +1 the way recordSurge does for Action Surge (HANDOFF — advanceTurn/ledger side).' },
  '57–60': { name: 'Random Spell', family: 'cast a random spell, no concentration if normally required', status: 'landed', engine: '1d10 pick; returns a cast plan executed by spellCastService with concentration bypass + recursion guard.' },
  '61–64': { name: 'Flammable Touch', family: 'burning-object record (room-feature model)', status: 'landed', engine: 'timedEffects wild_magic_flammable_touch (10 turns); igniteFlammableObject() validates against the room flammable features and writes the persisted burning record.' },
  '65–68': { name: 'Death Ward', family: '1-hour death-watch flag', status: 'partial', engine: 'timedEffects wild_magic_death_ward (world-clock, 1 hour); revive-as-Reincarnate needs the death path to read the flag — revive path not verified in the cached mirror (HANDOFF).' },
  '69–72': { name: 'Frightened', family: 'condition, until end of next turn', status: 'landed', engine: 'Frightened via conditionService + timedEffects (2 turns, Slow per-effect pattern).' },
  '73–76': { name: 'Long Teleport', family: 'teleport action', status: 'landed', engine: 'immediate teleportActor (60 ft, unoccupied space you can see).' },
  '77–80': { name: 'Poisoned Creature', family: 'condition, 1d4 hours, random creature within 60 ft', status: 'landed', engine: 'Poisoned via conditionService on a random target in range; duration is world-clock (1d4 hours).' },
  '81–84': { name: 'Blinding Light', family: 'turn-boundary proximity blind + light radius', status: 'landed', engine: 'timedEffects wild_magic_blinding_light (10 turns, 30-ft radius); advanceTurn blinds creatures ending their turn within 5 ft (HANDOFF). Light radius itself is digest-only (no light engine).' },
  '85–88': { name: 'Life Drain', family: 'multi-target damage + healing', status: 'landed', engine: 'up to 3 creatures within 30 ft take 1d10 necrotic; caster regains the sum dealt.' },
  '89–92': { name: 'Lightning Strike', family: 'multi-target damage', status: 'landed', engine: 'up to 3 creatures within 30 ft take 4d10 lightning.' },
  '93–96': { name: 'Piercing Vulnerability', family: 'resistance table, inverse + aura radius', status: 'landed', engine: 'timedEffects wild_magic_piercing_vulnerability (10 turns, 30-ft aura); local surgeVulnerabilityFor() until resistanceService lands (MERGE POINT).' },
  '97–00': { name: 'Boon', family: '1d6 sub-table', status: 'partial', engine: '1d6 sub-table; healing + slot restore executed, Sorcery-Point restore is a pending step for the pools family (HANDOFF), sub-row 6 reuses the Strange Effect table.' },
};

// ---------------------------------------------------------------------------
// Sub-tables (pure)
// ---------------------------------------------------------------------------

/** Friendly Creature 1d4 pick. Book names map to bare bestiary keys. */
export const FRIENDLY_CREATURE_MAP = {
  1: { displayName: 'Modron Duodrone', bestiaryKey: 'duodrone' },
  2: { displayName: 'Flumph', bestiaryKey: 'flumph' },
  3: { displayName: 'Modron Monodrone', bestiaryKey: 'monodrone' },
  4: { displayName: 'Unicorn', bestiaryKey: 'unicorn' },
};

export function friendlyCreatureFor(d4Roll) {
  const n = Number(d4Roll);
  return FRIENDLY_CREATURE_MAP[n] || null;
}

export const STRANGE_EFFECTS = {
  1: { label: 'ethereal music', kind: 'cosmetic', text: 'faint ethereal music only you and creatures within 5 feet of you can hear' },
  2: { label: 'size +1 category', kind: 'recorded-state', text: 'your size increases by one size category', data: { sizeCategoryDelta: 1 } },
  3: { label: 'feather beard', kind: 'cosmetic', text: 'you grow a long beard of feathers until you sneeze, when the feathers explode from your face and vanish' },
  4: { label: 'must shout', kind: 'cosmetic', text: 'you must shout when you speak' },
  5: { label: 'illusory butterflies', kind: 'cosmetic', text: 'illusory butterflies flutter in the air within 10 feet of you' },
  6: { label: 'eye on forehead', kind: 'mechanical', text: 'an eye appears on your forehead, granting you advantage on Wisdom (Perception) checks', data: { perceptionAdvantage: true } },
  7: { label: 'pink bubbles', kind: 'cosmetic', text: 'pink bubbles float out of your mouth whenever you speak' },
  8: { label: 'blue skin', kind: 'cosmetic-clock', text: 'your skin turns a vibrant shade of blue for 24 hours or until ended by a Remove Curse spell', data: { hours: 24, clearBy: 'remove_curse' } },
};

export function strangeEffectFor(d8Roll) {
  const n = Number(d8Roll);
  return STRANGE_EFFECTS[n] || null;
}

/** Random Spell 1d10 pick. Polymorph's Goat form bestiary key is `goat`. */
export const RANDOM_SPELLS = {
  1: { spell: 'Confusion', level: 4 },
  2: { spell: 'Fireball', level: 3 },
  3: { spell: 'Fog Cloud', level: 1 },
  4: { spell: 'Fly', level: 3, target: 'random creature within 60 feet' },
  5: { spell: 'Grease', level: 1 },
  6: { spell: 'Levitate', level: 2, target: 'self' },
  7: { spell: 'Magic Missile', level: 5 },
  8: { spell: 'Mirror Image', level: 2 },
  9: { spell: 'Polymorph', level: 4, target: 'self', note: 'if you fail the saving throw, you turn into a Goat (bestiary key: goat)' },
  10: { spell: 'See Invisibility', level: 2 },
};

export function randomSpellFor(d10Roll) {
  const n = Number(d10Roll);
  return RANDOM_SPELLS[n] || null;
}

export const BOON_EFFECTS = {
  1: { label: 'regain 2d10 hit points (self)' },
  2: { label: 'one ally within 300 feet regains 2d10 hit points' },
  3: { label: 'regain your lowest-level expended spell slot' },
  4: { label: 'one ally within 300 feet regains their lowest-level expended spell slot' },
  5: { label: 'regain all your expended Sorcery Points' },
  6: { label: 'all the effects of row 17–20 affect you simultaneously' },
};

export function boonFor(d6Roll) {
  const n = Number(d6Roll);
  return BOON_EFFECTS[n] || null;
}

/**
 * Lowest-level expended slot, pure. `used`/`max` are slot maps keyed by
 * level ('1'..'9'). Returns the level number, or null when nothing is
 * expended. Ties: lowest level wins (there is only one lowest).
 */
export function lowestExpendedSlot(usedSlots, maxSlots) {
  const used = usedSlots || {};
  const max = maxSlots || {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    const u = Number(used[String(lvl)] ?? used[lvl] ?? 0);
    const m = Number(max[String(lvl)] ?? max[lvl] ?? 0);
    if (u > 0 && m > 0) return lvl;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Actor helpers
// ---------------------------------------------------------------------------

export function actorKeyFor(actor) {
  if (!actor) return null;
  if (actor.actorKey) return String(actor.actorKey);
  if (actor.kind === 'companion') return `companion:${actor.id}`;
  if (actor.kind === 'player') return `player:${actor.id}`;
  if (actor.id != null) return String(actor.id);
  return null;
}

export function wildMagicFeatures(actor) {
  if (!actor) return [];
  return featuresAtLevel(actor.className, actor.subclassName, actor.level);
}

function hasFeature(actor, key) {
  return wildMagicFeatures(actor).some((f) => f.key === key);
}

// ---------------------------------------------------------------------------
// Table roll: Controlled Chaos + Tamed Surge options
// ---------------------------------------------------------------------------

/**
 * Roll on the Wild Magic Surge table.
 * - Tamed Surge (opts.tamedSurgeRow: a registry range or row object):
 *   choose instead of rolling — REFUSED for the final row 97–00 Boon.
 * - Controlled Chaos (feature at 14th): roll twice, use either.
 *   opts.tableChoiceIndex picks which of the two rolls is used
 *   (0 = first, 1 = second; default 0 — the PC chooses via pending
 *   block, the companion takes the first unless the DM directs).
 *   A PC reports the pair as opts.d100Rolls: [first, second].
 * Returns { row, d100, rolls, via } where rolls is the list of d100
 * rolls made (one, or two for Controlled Chaos).
 */
export function rollSurgeTable(actor, opts = {}) {
  const rng = opts.rng || Math.random;
  if (opts.tamedSurgeRow) {
    const chosen = typeof opts.tamedSurgeRow === 'string'
      ? surgeRowForRange(opts.tamedSurgeRow)
      : opts.tamedSurgeRow;
    const validation = validateTamedSurgeChoice(chosen);
    if (!validation.ok) return { row: null, d100: null, rolls: [], via: 'tamed_surge', error: validation.reason };
    return { row: chosen, d100: null, rolls: [], via: 'tamed_surge' };
  }
  const controlled = hasFeature(actor, 'controlled_chaos');
  if (controlled && Array.isArray(opts.d100Rolls) && opts.d100Rolls.length === 2) {
    const [r1, r2] = opts.d100Rolls.map(Number);
    const rows = [findSurgeRow(r1), findSurgeRow(r2)];
    const idx = opts.tableChoiceIndex === 1 ? 1 : 0;
    return { row: rows[idx], d100: idx === 1 ? r2 : r1, rolls: [r1, r2], rows, via: 'controlled_chaos' };
  }
  if (controlled && opts.d100Roll == null) {
    const r1 = rollDie(100, rng);
    const r2 = rollDie(100, rng);
    const rows = [findSurgeRow(r1), findSurgeRow(r2)];
    const idx = opts.tableChoiceIndex === 1 ? 1 : 0;
    return { row: rows[idx], d100: idx === 1 ? r2 : r1, rolls: [r1, r2], rows, via: 'controlled_chaos' };
  }
  const d100 = opts.d100Roll != null ? Number(opts.d100Roll) : rollDie(100, rng);
  return { row: findSurgeRow(d100), d100, rolls: [d100], via: controlled ? 'controlled_chaos_single' : 'table' };
}

/** Tamed Surge choice validation: any row EXCEPT the final row 97–00 Boon. */
export function validateTamedSurgeChoice(row) {
  if (!row) return { ok: false, reason: 'no row chosen' };
  if (normalizeRange(row.range) === '97-00') {
    return { ok: false, reason: 'tamed_surge_final_row_excluded: Tamed Surge cannot choose the final row (97–00, Boon)' };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The trigger: rollWildMagicSurge
// ---------------------------------------------------------------------------

/**
 * The post-cast trigger. `actor` is { kind, id, name, className,
 * subclassName, level, isPc }.
 *
 * opts:
 * - d20Roll: the reported/rolled d20 (PC reports it; companion path
 *   leaves it unset and the system rolls). When unset AND the actor
 *   is a PC AND the roll is not forced, the result is
 *   { triggered: false, offered: true } — the hook OFFERS the roll via
 *   a pending block and rolls nothing.
 * - forced / tidesOfChaos: Tides of Chaos — skip the d20 entirely and
 *   roll on the table automatically.
 * - d100Roll / tableChoiceIndex / tamedSurgeRow: passed to rollSurgeTable.
 * - alreadyRolledThisTurn: the once-per-turn gate (turn-ledger entry,
 *   enforced by spellCastService) — refuses here too.
 * - rng: () => [0,1).
 *
 * Returns { triggered, offered, forced, d20, d100, row, rolls, via,
 * reason? }. Never throws.
 */
export function rollWildMagicSurge(actor, opts = {}) {
  const rng = opts.rng || Math.random;
  if (!actor || String(actor.className || '').toLowerCase() !== 'sorcerer') {
    return { triggered: false, offered: false, forced: false, d20: null, d100: null, row: null, reason: 'not_a_sorcerer' };
  }
  if (!hasFeature(actor, 'wild_magic_surge')) {
    return { triggered: false, offered: false, forced: false, d20: null, d100: null, row: null, reason: 'not_wild_magic' };
  }
  if (opts.alreadyRolledThisTurn) {
    return { triggered: false, offered: false, forced: false, d20: null, d100: null, row: null, reason: 'once_per_turn' };
  }
  const forced = !!(opts.forced || opts.tidesOfChaos);
  if (forced) {
    const table = rollSurgeTable(actor, opts);
    return { triggered: !!table.row, offered: false, forced: true, d20: null, d100: table.d100, row: table.row, rolls: table.rolls, via: table.via, error: table.error || null };
  }
  if (opts.d20Roll == null) {
    if (actor.isPc) {
      return { triggered: false, offered: true, forced: false, d20: null, d100: null, row: null, reason: 'offered_to_pc' };
    }
    const d20 = rollDie(20, rng);
    if (!wildMagicSurgeOnRoll(d20)) {
      return { triggered: false, offered: false, forced: false, d20, d100: null, row: null, reason: 'no_surge' };
    }
    const table = rollSurgeTable(actor, opts);
    return { triggered: !!table.row, offered: false, forced: false, d20, d100: table.d100, row: table.row, rolls: table.rolls, via: table.via, error: table.error || null };
  }
  const d20 = Number(opts.d20Roll);
  if (!wildMagicSurgeOnRoll(d20)) {
    return { triggered: false, offered: false, forced: false, d20, d100: null, row: null, reason: 'no_surge' };
  }
  const table = rollSurgeTable(actor, opts);
  return { triggered: !!table.row, offered: false, forced: false, d20, d100: table.d100, row: table.row, rolls: table.rolls, via: table.via, error: table.error || null };
}

// ---------------------------------------------------------------------------
// D9 resistance-table stand-in (MERGE POINT — see header)
// ---------------------------------------------------------------------------

/**
 * Local resistance read until the saves family lands
 * resistanceService.resistanceFor. Reads the same timed-effects
 * records the saves family will read: Damage Resistance (33–36) gives
 * resistance to all damage; Piercing Vulnerability (93–96) gives
 * vulnerability to piercing; Potted Plant (37–40) gives vulnerability
 * to all damage. Returns { resistance: [], vulnerability: [], sources: [] }.
 */
// MERGE (2026-11-09): renamed from resistanceFor — this is the SURGE-
// specific timed-effect read (session_config.timedEffects), NOT the D9
// feature table. The canonical feature-based read is
// resistanceService.resistanceFor(actor, damageType, context) (F6).
// Unification is a follow-up; both read the same timedEffects keys.
export function surgeResistanceFor(sessionConfig, actorKey) {
  const out = { resistance: [], vulnerability: [], sources: [] };
  if (!sessionConfig || !actorKey) return out;
  const dr = hasTimedEffect(sessionConfig, actorKey, 'wild_magic_damage_resistance');
  if (dr) { out.resistance.push('all'); out.sources.push('wild_magic_damage_resistance'); }
  const pv = hasTimedEffect(sessionConfig, actorKey, 'wild_magic_piercing_vulnerability');
  if (pv) { out.vulnerability.push('piercing'); out.sources.push('wild_magic_piercing_vulnerability'); }
  const pp = hasTimedEffect(sessionConfig, actorKey, 'wild_magic_potted_plant');
  if (pp) { out.vulnerability.push('all'); out.sources.push('wild_magic_potted_plant'); }
  return out;
}

export function surgeVulnerabilityFor(sessionConfig, actorKey) {
  return surgeResistanceFor(sessionConfig, actorKey).vulnerability;
}

// ---------------------------------------------------------------------------
// Removed-from-combat state (Astral Jaunt) + form state (Potted Plant)
// ---------------------------------------------------------------------------

export function markRemovedFromCombat(sessionConfig, actorKey, record) {
  if (!sessionConfig || typeof sessionConfig !== 'object' || !actorKey) return null;
  if (!sessionConfig.removedFromCombat || typeof sessionConfig.removedFromCombat !== 'object') {
    sessionConfig.removedFromCombat = {};
  }
  const entry = {
    reason: record?.reason || 'astral_jaunt',
    returnAt: record?.returnAt || 'end_of_next_turn',
    returnPosition: record?.returnPosition || null,
  };
  sessionConfig.removedFromCombat[String(actorKey)] = entry;
  return entry;
}

export function isRemovedFromCombat(sessionConfig, actorKey) {
  const blob = sessionConfig?.removedFromCombat;
  return (blob && typeof blob === 'object' ? blob[String(actorKey)] || null : null);
}

export function clearRemovedFromCombat(sessionConfig, actorKey) {
  const blob = sessionConfig?.removedFromCombat;
  if (!blob || typeof blob !== 'object') return false;
  if (!(String(actorKey) in blob)) return false;
  delete blob[String(actorKey)];
  return true;
}

export function markTransformedForm(sessionConfig, actorKey, record) {
  if (!sessionConfig || typeof sessionConfig !== 'object' || !actorKey) return null;
  if (!sessionConfig.transformedForms || typeof sessionConfig.transformedForms !== 'object') {
    sessionConfig.transformedForms = {};
  }
  const entry = { kind: record?.kind || 'potted_plant', until: record?.until || 'start_of_next_turn', ...(record || {}) };
  sessionConfig.transformedForms[String(actorKey)] = entry;
  return entry;
}

export function transformedFormFor(sessionConfig, actorKey) {
  const blob = sessionConfig?.transformedForms;
  return (blob && typeof blob === 'object' ? blob[String(actorKey)] || null : null);
}

export function clearTransformedForm(sessionConfig, actorKey) {
  const blob = sessionConfig?.transformedForms;
  if (!blob || typeof blob !== 'object') return false;
  if (!(String(actorKey) in blob)) return false;
  delete blob[String(actorKey)];
  return true;
}

/** Everything the DM prompt needs to show about an actor's active surge state. */
export function surgeStateFor(sessionConfig, actorKey) {
  if (!sessionConfig || !actorKey) return { timedEffects: {}, removedFromCombat: null, transformedForm: null };
  const blob = sessionConfig.timedEffects;
  const timed = (blob && typeof blob === 'object' ? blob[String(actorKey)] || {} : {});
  return {
    timedEffects: timed,
    removedFromCombat: isRemovedFromCombat(sessionConfig, actorKey),
    transformedForm: transformedFormFor(sessionConfig, actorKey),
  };
}

// ---------------------------------------------------------------------------
// Flammable Touch ignition (Amendment 2 §1.3)
// ---------------------------------------------------------------------------

/**
 * Ignite a flammable object while Flammable Touch is active. `roomState`
 * is the scene-room row's mutable state object (the caller owns the
 * row); the burning record is written to `roomState.burningObjects`
 * and the object is marked consumed in `roomState.consumedFeatures`.
 * Validation mirrors SET_COVER: a named feature must actually exist
 * in the room's flammable features when a feature list is supplied.
 * "Not worn or carried by another creature" is a DM attestation at
 * declaration time (opts.dmAttested), not a computed check.
 * Returns { success, reason?, record?, damage? }.
 */
export function igniteFlammableObject(sessionConfig, actorKey, roomState, objectName, opts = {}) {
  const rng = opts.rng || Math.random;
  if (!hasTimedEffect(sessionConfig, actorKey, 'wild_magic_flammable_touch')) {
    return { success: false, reason: 'flammable_touch_not_active' };
  }
  const name = String(objectName || '').trim();
  if (!name) return { success: false, reason: 'no_object_named' };
  const features = Array.isArray(opts.roomFeatures) ? opts.roomFeatures : null;
  if (features) {
    const match = features.find((f) => String(f.name || '').trim().toLowerCase() === name.toLowerCase());
    if (!match) return { success: false, reason: 'feature_not_in_room', object: name };
    if (String(match.kind || '').toLowerCase() !== 'flammable') {
      return { success: false, reason: 'feature_not_flammable', object: name };
    }
  }
  if (opts.dmAttested === false) {
    return { success: false, reason: 'worn_or_carried_attestation_refused', object: name };
  }
  const { total } = rollDice(1, 4, rng);
  const record = { name, kind: 'flammable', ignitedAt: Date.now(), damageTaken: '1d4', damage: total, burning: true };
  if (roomState && typeof roomState === 'object') {
    if (!Array.isArray(roomState.burningObjects)) roomState.burningObjects = [];
    roomState.burningObjects.push(record);
    if (!Array.isArray(roomState.consumedFeatures)) roomState.consumedFeatures = [];
    if (!roomState.consumedFeatures.includes(name)) roomState.consumedFeatures.push(name);
  }
  return { success: true, record, damage: total };
}

// ---------------------------------------------------------------------------
// Row application
// ---------------------------------------------------------------------------

function resultBase(actor, row) {
  return {
    row: row ? { range: row.range, name: row.name, effect: row.effect } : null,
    actor: actor?.name || actorKeyFor(actor),
    applied: [],
    pending: [],
    notes: [],
  };
}

async function tryAddCondition(actor, condition, meta) {
  try {
    const { addCondition } = await import('./conditionService.js');
    const kind = actor.kind === 'companion' ? 'companion' : 'player';
    return await addCondition(kind, actor.id, condition, meta || null);
  } catch (e) {
    return { success: false, reason: `condition_add_unavailable: ${e.message}` };
  }
}

async function tryHeal(actor, amount, spellName) {
  try {
    if (actor.kind === 'companion') {
      const { dbGet, dbRun } = await import('../database.js');
      const row = await dbGet('SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?', [actor.id]);
      if (!row) return { success: false, reason: 'unknown_companion' };
      const next = Math.min(row.companion_max_hp, row.companion_current_hp + amount);
      await dbRun('UPDATE companions SET companion_current_hp = ? WHERE id = ?', [next, actor.id]);
      return { success: true, applied: Math.max(0, next - row.companion_current_hp) };
    }
    const { applyHpChange } = await import('./characterHpService.js');
    const res = await applyHpChange(actor.id, amount, `healing: ${spellName}`);
    if (res && typeof res.currentHp === 'number' && typeof res.previousHp === 'number') {
      return { success: true, applied: Math.max(0, res.currentHp - res.previousHp) };
    }
    return { success: true, applied: amount };
  } catch (e) {
    return { success: false, reason: `heal_unavailable: ${e.message}` };
  }
}

async function tryDamageEnemy(sessionId, encounterSeq, characterId, enemyName, amount, damageType) {
  try {
    const { applyPartyDamageToEnemy } = await import('./enemyCombatService.js');
    const res = await applyPartyDamageToEnemy(sessionId, encounterSeq, enemyName, amount, characterId, { damageType, magical: true });
    return { success: true, applied: res?.damageDealt ?? amount, killed: !!res?.killed, damageAdjustment: res?.damageAdjustment || null };
  } catch (e) {
    return { success: false, reason: `damage_unavailable: ${e.message}` };
  }
}

function pickRandom(list, rng) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor((typeof rng === 'function' ? rng() : Math.random()) * list.length)];
}

/**
 * Apply one surge row. `ctx`:
 * - sessionConfig (mutated: timed effects, removed/form state),
 * - sessionId / encounterSeq / characterId (DB steps; omit them and
 *   DB steps land in `pending` instead of throwing),
 * - rng, targets (array of enemy/actor names or {kind,id,name} for
 *   multi-target rows), allyTarget, slots {used,max} (Boon slot rows),
 * - targetZone / canSee (Long Teleport), position / returnPosition
 *   (Astral Jaunt), roomFeatures / roomState (Flammable Touch).
 * Returns { row, actor, applied, pending, notes, cast? }.
 * `cast` (Random Spell only) is a plan for spellCastService to execute.
 */
export async function applySurgeRow(actor, row, ctx = {}) {
  const res = resultBase(actor, row);
  if (!row) { res.notes.push('no row to apply'); return res; }
  const rng = ctx.rng || Math.random;
  const sessionConfig = ctx.sessionConfig || null;
  const actorKey = actorKeyFor(actor);
  const range = normalizeRange(row.range);
  const track = (key, data, turns) => {
    if (!sessionConfig || !actorKey) { res.pending.push({ step: key, reason: 'no_session_config' }); return null; }
    return applyTimedEffect(sessionConfig, actorKey, key, data, turns);
  };

  switch (range) {
    case '01-04': { // Roll Again
      track('wild_magic_roll_again', { ignoreRow: '01–04' }, MINUTE_TURNS);
      res.applied.push('wild_magic_roll_again: re-roll on the table at the start of each of your turns for the next minute');
      res.notes.push('advanceTurn re-rolls the table at the caster turn start (see HANDOFF).');
      break;
    }
    case '05-08': { // Friendly Creature
      const pick = friendlyCreatureFor(rollDie(4, rng));
      track('wild_magic_friendly_creature', { bestiaryKey: pick.bestiaryKey, displayName: pick.displayName }, MINUTE_TURNS);
      res.applied.push(`wild_magic_friendly_creature: ${pick.displayName} (${pick.bestiaryKey}) recorded for 1 minute`);
      // The entity family owns the row; this is the exact creation call.
      res.creationCall = {
        service: 'entity family (Amendment 2 §3 shape (a))',
        function: 'createFriendlyActor',
        args: { sessionId: ctx.sessionId || null, bestiaryKey: pick.bestiaryKey, displayName: pick.displayName, side: 'friendly', dmControlled: true, durationTurns: MINUTE_TURNS, ownerKey: actorKey, position: 'random unoccupied space within 60 feet of the caster' },
      };
      res.pending.push({ step: 'createFriendlyActor', reason: 'friendly-side row shape is owned by the entity family (see HANDOFF)', creationCall: res.creationCall });
      res.notes.push('A plain combat_enemies row must NOT be used — it is enemy-side only.');
      break;
    }
    case '09-12': { // Regeneration
      track('wild_magic_regeneration', { healPerTurn: 5 }, MINUTE_TURNS);
      res.applied.push('wild_magic_regeneration: regain 5 HP at the start of each of your turns for the next minute');
      res.notes.push('advanceTurn heals at the caster turn start (see HANDOFF).');
      break;
    }
    case '13-16': { // Weakened Saves
      track('wild_magic_weakened_saves', { nextSpellOnly: true }, MINUTE_TURNS);
      res.applied.push('wild_magic_weakened_saves: creatures have disadvantage on saves against the next spell you cast in the next minute');
      res.notes.push('resolveSpellSave reads this tracker (see HANDOFF).');
      break;
    }
    case '17-20': { // Strange Effect
      const d8 = ctx.strangeRoll != null ? Number(ctx.strangeRoll) : rollDie(8, rng);
      const sub = strangeEffectFor(d8);
      if (ctx.boonAll) {
        // Boon sub-row 6: all eight sub-effects at once.
        for (let i = 1; i <= 8; i++) {
          const s = strangeEffectFor(i);
          const isClock = s.kind === 'cosmetic-clock';
          track(`wild_magic_strange_${i}`, { label: s.label, ...(s.data || {}) }, isClock ? null : MINUTE_TURNS);
          res.applied.push(`strange_effect_${i}: ${s.label}`);
        }
        break;
      }
      const isClock = sub.kind === 'cosmetic-clock';
      track('wild_magic_strange_effect', { subRoll: d8, label: sub.label, ...(sub.data || {}) }, isClock ? null : MINUTE_TURNS);
      res.applied.push(`strange_effect (${d8}): ${sub.label} — ${sub.text}`);
      if (sub.kind === 'mechanical') res.notes.push('Eye on forehead: advantage on Wisdom (Perception) checks — read via conditionRollEffects (see HANDOFF).');
      if (isClock) res.notes.push('Blue skin: 24 hours or until Remove Curse — world-clock expiry, not a turn tick.');
      break;
    }
    case '21-24': { // Bonus-Action Spells
      track('wild_magic_bonus_action_spells', { castingTimeOverride: 'bonus' }, MINUTE_TURNS);
      res.applied.push('wild_magic_bonus_action_spells: spells with a casting time of an action have a casting time of a bonus action for the next minute');
      res.notes.push('spellCastDecision reads this tracker (see HANDOFF).');
      break;
    }
    case '25-28': { // Astral Jaunt
      const returnPosition = ctx.returnPosition || ctx.position || null;
      if (sessionConfig && actorKey) {
        markRemovedFromCombat(sessionConfig, actorKey, { reason: 'astral_jaunt', returnAt: 'end_of_next_turn', returnPosition });
        track('wild_magic_astral_jaunt', { returnPosition }, 2);
      } else {
        res.pending.push({ step: 'wild_magic_astral_jaunt', reason: 'no_session_config' });
      }
      res.applied.push('astral_jaunt: transported to the Astral Plane until the end of your next turn');
      res.notes.push('While removed the actor takes no turn, cannot be targeted, and takes no damage; advanceTurn returns them to the stored space or the nearest unoccupied space (see HANDOFF).');
      break;
    }
    case '29-32': { // Maximum Damage
      track('wild_magic_maximum_damage', { maxDamageNextSpell: true }, MINUTE_TURNS);
      res.applied.push('wild_magic_maximum_damage: the next damaging spell you cast within the next minute uses the highest number possible for each damage die');
      res.notes.push('Spell damage path consumes this tracker (see HANDOFF).');
      break;
    }
    case '33-36': { // Damage Resistance
      track('wild_magic_damage_resistance', { resistance: ['all'] }, MINUTE_TURNS);
      res.applied.push('wild_magic_damage_resistance: resistance to all damage for the next minute');
      break;
    }
    case '37-40': { // Potted Plant
      if (sessionConfig && actorKey) {
        markTransformedForm(sessionConfig, actorKey, { kind: 'potted_plant', until: 'start_of_next_turn' });
        track('wild_magic_potted_plant', { vulnerability: ['all'] }, 1);
      } else {
        res.pending.push({ step: 'wild_magic_potted_plant', reason: 'no_session_config' });
      }
      const cond = await tryAddCondition(actor, 'incapacitated');
      if (cond.success) res.applied.push('potted_plant: Incapacitated via conditionService');
      else res.pending.push({ step: 'add_condition_incapacitated', reason: cond.reason });
      res.applied.push('potted_plant: form-state record (sorcerer HP is the pool — no second HP row); vulnerability to all damage via surgeVulnerabilityFor()');
      res.notes.push('Reverts at 0 HP (damage path checks the form record) or at the start of your next turn (duration tracker).');
      break;
    }
    case '41-44': { // Short Teleports
      track('wild_magic_short_teleports', { feet: 20, bonusAction: true }, MINUTE_TURNS);
      res.applied.push('wild_magic_short_teleports: teleport up to 20 feet as a bonus action on each of your turns for the next minute');
      res.notes.push('Each teleport uses movementService.teleportActor and charges the bonus-action budget (see HANDOFF).');
      break;
    }
    case '45-48': { // Invisibility
      const chosen = Array.isArray(ctx.targets) ? ctx.targets.slice(0, 3) : [];
      const cond = await tryAddCondition(actor, 'invisible');
      if (cond.success) res.applied.push('invisibility: Invisible via conditionService');
      else res.pending.push({ step: 'add_condition_invisible', reason: cond.reason });
      track('wild_magic_invisibility', { endsOn: 'attack/damage/spell', extraTargets: chosen }, MINUTE_TURNS);
      if (chosen.length) res.notes.push(`Up to three chosen creatures within 30 ft also gain Invisible: ${chosen.map((t) => t.name || t).join(', ')} — apply via conditionService when their rows resolve (see HANDOFF).`);
      res.notes.push('The condition ends on a creature immediately after it makes an attack roll, deals damage, or casts a spell (see HANDOFF).');
      break;
    }
    case '49-52': { // Spectral Shield
      track('wild_magic_spectral_shield', { acBonus: 2, magicMissileImmune: true }, MINUTE_TURNS);
      res.applied.push('wild_magic_spectral_shield: +2 AC and immunity to Magic Missile for the next minute');
      res.notes.push('AC-computation read site not verified in the cached mirror — attack family wires the read (see HANDOFF).');
      break;
    }
    case '53-56': { // Extra Action
      track('wild_magic_extra_action', { extraAction: true }, 1);
      res.applied.push('wild_magic_extra_action: one extra action on this turn');
      res.notes.push('Turn ledger grants actionsAvailable +1 (recordSurge analogue) — ledger side in HANDOFF.');
      break;
    }
    case '57-60': { // Random Spell
      const d10 = ctx.randomSpellRoll != null ? Number(ctx.randomSpellRoll) : rollDie(10, rng);
      const pick = randomSpellFor(d10);
      const target = pick.target === 'random creature within 60 feet'
        ? pickRandom(Array.isArray(ctx.targets) ? ctx.targets : [], rng)
        : (pick.target === 'self' ? (actor.name || actorKeyFor(actor)) : (ctx.target || null));
      res.cast = {
        spell: pick.spell, level: pick.level, noConcentration: true,
        target: target && typeof target === 'object' ? (target.name || target) : target,
        note: pick.note || null,
      };
      res.applied.push(`random_spell (${d10}): cast ${pick.spell} (level ${pick.level}) with no concentration${res.cast.target ? ` on ${res.cast.target}` : ''}`);
      res.notes.push('Executed by spellCastService with the recursion guard (a surge spell never triggers another surge). Polymorph on a failed save turns the caster into a Goat — the form rides the Potted Plant form-state record if the save fails (see HANDOFF).');
      break;
    }
    case '61-64': { // Flammable Touch
      track('wild_magic_flammable_touch', { flammableTouch: true }, MINUTE_TURNS);
      res.applied.push('wild_magic_flammable_touch: for the next minute, any flammable nonmagical object you touch bursts into flame (1d4 fire, burning)');
      res.notes.push('Touch is declared by the DM/player and validated by igniteFlammableObject() against the room flammable features (see HANDOFF).');
      break;
    }
    case '65-68': { // Death Ward
      track('wild_magic_death_ward', { deathWard: true, hours: 1, reviveAs: 'reincarnate' }, null);
      res.applied.push('wild_magic_death_ward: if you die within the next hour, you immediately revive as if by the Reincarnate spell');
      res.notes.push('Death path must read this flag — revive path not verified in the cached mirror (see HANDOFF).');
      break;
    }
    case '69-72': { // Frightened
      const cond = await tryAddCondition(actor, 'frightened');
      if (cond.success) res.applied.push('frightened: Frightened via conditionService');
      else res.pending.push({ step: 'add_condition_frightened', reason: cond.reason });
      track('wild_magic_frightened', { until: 'end_of_next_turn' }, 2);
      res.notes.push('DM determines the source of the fear.');
      break;
    }
    case '73-76': { // Long Teleport
      if (ctx.targetZone && ctx.sessionId) {
        try {
          const { teleportActor } = await import('./movementService.js');
          const tp = await teleportActor(ctx.sessionId, actorKey, ctx.targetZone, {
            encounterSeq: ctx.encounterSeq, maxFeet: 60, requireVisible: true, canSee: ctx.canSee,
          });
          if (tp.success) res.applied.push(`long_teleport: teleported to ${tp.zone} (${tp.feet ?? '?'} ft)`);
          else res.pending.push({ step: 'teleport', reason: tp.reason, targetZone: ctx.targetZone });
        } catch (e) {
          res.pending.push({ step: 'teleport', reason: `teleport_unavailable: ${e.message}`, targetZone: ctx.targetZone });
        }
      } else {
        res.pending.push({ step: 'teleport', reason: ctx.targetZone ? 'no_session' : 'no_target_zone_named', targetZone: ctx.targetZone || null, feet: 60 });
        res.notes.push('Teleport up to 60 feet to an unoccupied space you can see — DM names the destination zone.');
      }
      break;
    }
    case '77-80': { // Poisoned Creature
      const hours = rollDie(4, rng);
      const target = pickRandom(Array.isArray(ctx.targets) ? ctx.targets : [], rng);
      if (target && typeof target === 'object' && target.kind && target.id != null) {
        const cond = await tryAddCondition(target, 'poisoned');
        if (cond.success) res.applied.push(`poisoned_creature: ${target.name || target.id} Poisoned for ${hours} hour(s)`);
        else res.pending.push({ step: 'add_condition_poisoned', reason: cond.reason, target: target.name || target.id });
      } else if (target) {
        res.pending.push({ step: 'add_condition_poisoned', reason: 'target_not_resolved_to_a_row', target: String(target), hours });
      } else {
        res.pending.push({ step: 'poisoned_creature', reason: 'no_creature_within_60_ft_named', hours });
      }
      track('wild_magic_poisoned_creature', { hours }, null);
      break;
    }
    case '81-84': { // Blinding Light
      track('wild_magic_blinding_light', { radiusFeet: 30, blindWithinFeet: 5 }, MINUTE_TURNS);
      res.applied.push('wild_magic_blinding_light: bright light in a 30-foot radius for the next minute; creatures ending their turn within 5 ft are Blinded until the end of their next turn');
      res.notes.push('advanceTurn applies Blinded on the proximity check (see HANDOFF). Light radius is digest-only.');
      break;
    }
    case '85-88': // Life Drain
    case '89-92': { // Lightning Strike
      const isDrain = range === '85-88';
      const dice = isDrain ? { count: 1, sides: 10, type: 'necrotic' } : { count: 4, sides: 10, type: 'lightning' };
      const targets = Array.isArray(ctx.targets) ? ctx.targets.slice(0, 3) : [];
      if (targets.length === 0) {
        const { total } = rollDice(dice.count, dice.sides, rng);
        res.pending.push({ step: isDrain ? 'life_drain' : 'lightning_strike', reason: 'no_creatures_within_30_ft_named', dice: `${dice.count}d${dice.sides} ${dice.type}`, rolledTotal: total });
        break;
      }
      let dealtSum = 0;
      for (const t of targets) {
        const { total } = rollDice(dice.count, dice.sides, rng);
        const name = typeof t === 'string' ? t : (t.name || String(t));
        if (ctx.sessionId && ctx.encounterSeq) {
          const dmg = await tryDamageEnemy(ctx.sessionId, ctx.encounterSeq, ctx.characterId, name, total, dice.type);
          if (dmg.success) {
            dealtSum += dmg.applied;
            res.applied.push(`${isDrain ? 'life_drain' : 'lightning_strike'}: ${name} takes ${dmg.applied} ${dice.type} damage${dmg.killed ? ' — KILLED' : ''}`);
          } else {
            res.pending.push({ step: 'damage', reason: dmg.reason, target: name, rolledTotal: total });
          }
        } else {
          res.pending.push({ step: 'damage', reason: 'no_session', target: name, rolledTotal: total, damageType: dice.type });
        }
      }
      if (isDrain && dealtSum > 0) {
        const heal = await tryHeal(actor, dealtSum, 'Wild Magic Surge (Life Drain)');
        if (heal.success) res.applied.push(`life_drain: caster regains ${heal.applied} HP (sum dealt)`);
        else res.pending.push({ step: 'life_drain_heal', reason: heal.reason, amount: dealtSum });
      }
      break;
    }
    case '93-96': { // Piercing Vulnerability
      track('wild_magic_piercing_vulnerability', { vulnerability: ['piercing'], auraFeet: 30 }, MINUTE_TURNS);
      res.applied.push('wild_magic_piercing_vulnerability: you and all creatures within 30 feet have vulnerability to piercing damage for the next minute');
      break;
    }
    case '97-00': { // Boon
      const d6 = ctx.boonRoll != null ? Number(ctx.boonRoll) : rollDie(6, rng);
      const boon = boonFor(d6);
      res.boonRoll = d6;
      if (d6 === 1) {
        const { total } = rollDice(2, 10, rng);
        const heal = await tryHeal(actor, total, 'Wild Magic Surge (Boon)');
        if (heal.success) res.applied.push(`boon (1): caster regains ${heal.applied} HP (rolled ${total})`);
        else res.pending.push({ step: 'boon_heal_self', reason: heal.reason, rolledTotal: total });
      } else if (d6 === 2) {
        const { total } = rollDice(2, 10, rng);
        if (ctx.allyTarget && typeof ctx.allyTarget === 'object' && ctx.allyTarget.id != null) {
          const heal = await tryHeal(ctx.allyTarget, total, 'Wild Magic Surge (Boon)');
          if (heal.success) res.applied.push(`boon (2): ally regains ${heal.applied} HP (rolled ${total})`);
          else res.pending.push({ step: 'boon_heal_ally', reason: heal.reason, rolledTotal: total });
        } else {
          res.pending.push({ step: 'boon_heal_ally', reason: 'no_ally_within_300_ft_named', rolledTotal: total });
        }
      } else if (d6 === 3 || d6 === 4) {
        const isSelf = d6 === 3;
        const slots = isSelf ? ctx.slots : ctx.allySlots;
        const target = isSelf ? actor : ctx.allyTarget;
        if (slots && target) {
          const lvl = lowestExpendedSlot(slots.used, slots.max);
          if (lvl == null) {
            res.notes.push(`boon (${d6}): no expended slot to regain.`);
          } else if (ctx.sessionId) {
            try {
              const { restoreSpellSlot } = await import('./spellCastService.js');
              const restored = await restoreSpellSlot(ctx.characterId, target.kind === 'companion' ? (target.name || null) : null, target.kind !== 'companion', target.kind === 'companion' ? target.id : null, lvl);
              if (restored.ok) res.applied.push(`boon (${d6}): ${isSelf ? 'caster' : 'ally'} regains a level-${lvl} spell slot`);
              else res.pending.push({ step: 'boon_restore_slot', reason: restored.reason || 'restore_failed', level: lvl });
            } catch (e) {
              res.pending.push({ step: 'boon_restore_slot', reason: `restore_unavailable: ${e.message}`, level: lvl });
            }
          } else {
            res.pending.push({ step: 'boon_restore_slot', reason: 'no_session', level: lvl });
          }
        } else {
          res.pending.push({ step: 'boon_restore_slot', reason: isSelf ? 'no_slot_state_supplied' : 'no_ally_or_slot_state_supplied' });
        }
      } else if (d6 === 5) {
        res.pending.push({ step: 'boon_restore_sorcery_points', reason: 'sorcery_point_restore_needs_pools_family_writer (see HANDOFF)', action: 'restore all expended Sorcery Points' });
        res.notes.push('Boon (5): regain all expended Sorcery Points — recorded as pending; the pools family owns the write.');
      } else if (d6 === 6) {
        const sub = await applySurgeRow(actor, surgeRowForRange('17–20'), { ...ctx, boonAll: true });
        res.applied.push(...sub.applied.map((a) => `boon (6): ${a}`));
        res.pending.push(...sub.pending);
        res.notes.push(...sub.notes);
      }
      break;
    }
    default: {
      res.notes.push(`no engine mapping for range ${row.range} — recorded only`);
      break;
    }
  }
  return res;
}

export default {
  rollWildMagicSurge,
  rollSurgeTable,
  findSurgeRow,
  applySurgeRow,
  SURGE_ROW_EFFECTS,
};
