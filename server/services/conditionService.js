/**
 * Condition Service — durable conditions for the PC and companions,
 * with mechanical enforcement (Phase 1, v1.0.190; design:
 * pc-conditions-design.md, Option B — Zach, 2026-10-21).
 *
 * Before this service, the PC's conditions lived in the client and
 * were re-sent every turn; the DM's [CONDITION_ADD]/[CONDITION_REMOVE]
 * markers were detected by regex in the route and handed back in the
 * response payload for the client to apply. Nothing persisted on the
 * server, and enforcement was a note asking the DM to honor
 * disadvantage. Companions had the column (migration 030) and
 * client-driven endpoints, but the marker flow never wrote them.
 *
 * Now: characters.active_conditions (083) mirrors
 * companions.active_conditions (030), this service owns both, the
 * markers have real pipeline handlers, and the effect profiles below
 * are consumed where rolls actually resolve — rollRequestService
 * (checks/saves) and enemyCombatService (attacks against a target).
 *
 * The vocabulary is the CONDITION_ADD schema enum: the 14 standard
 * conditions plus exhaustion_1..6. Exhaustion levels are mutually
 * exclusive (the companion endpoints' rule, applied centrally here).
 *
 * NOT the dying state: characters.is_unconscious is the death-save
 * flag owned by characterHpService. The 'unconscious' CONDITION
 * (sleep, spells) lives here and never touches it (§6 of the design).
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { conditionImmunityMatch } from './bestiaryLookupService.js';

export const CONDITION_KEYS = [
  'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
  'prone', 'restrained', 'stunned', 'unconscious',
  'exhaustion_1', 'exhaustion_2', 'exhaustion_3',
  'exhaustion_4', 'exhaustion_5', 'exhaustion_6'
];

const EXHAUSTION_KEYS = new Set(CONDITION_KEYS.filter(k => k.startsWith('exhaustion_')));

const TABLE_BY_KIND = { player: 'characters', companion: 'companions', enemy: 'combat_enemies' };

function tableFor(kind) {
  const t = TABLE_BY_KIND[kind];
  if (!t) throw new Error(`conditionService: unknown actor kind "${kind}"`);
  return t;
}

// ---------------------------------------------------------------------------
// Condition metadata (combat item 8) — who charmed / grapples whom.
// active_conditions stays a plain string list; this sidecar (migration
// 098, condition_meta) carries per-condition source identity so the
// engine can enforce "can't attack the charmer" and compute grapple
// escape DCs. Meta is written when the condition lands and cleared
// when it is removed. An actor reference is { kind, key, name }: the
// key is the ledger/world key (player:/companion: id fallback or
// world_id) or the combat fallback id for enemies — resolvable to a
// row at escape time (see resolveActorRow).
// ---------------------------------------------------------------------------

/** 2024: these conditions all impose Incapacitated, so all of them
 *  block actions/reactions and break concentration. */
export const INCAPACITATING_CONDITIONS = ['incapacitated', 'paralyzed', 'stunned', 'unconscious', 'petrified'];

export async function getConditionMeta(kind, id, condition) {
  if (!kind || !id || !condition) return null;
  try {
    const row = await dbGet('SELECT meta_json FROM condition_meta WHERE kind = ? AND owner_id = ? AND condition = ?', [kind, id, condition]);
    const parsed = safeParse(row?.meta_json, null);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch { return null; }
}

export async function setConditionMeta(kind, id, condition, meta) {
  if (!kind || !id || !condition) return;
  try {
    await dbRun(
      `INSERT INTO condition_meta (kind, owner_id, condition, meta_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(kind, owner_id, condition) DO UPDATE SET meta_json = excluded.meta_json`,
      [kind, id, condition, JSON.stringify(meta || {})]
    );
  } catch { /* metadata is best-effort; the condition itself stands */ }
}

export async function clearConditionMeta(kind, id, condition) {
  if (!kind || !id || !condition) return;
  try {
    await dbRun('DELETE FROM condition_meta WHERE kind = ? AND owner_id = ? AND condition = ?', [kind, id, condition]);
  } catch { /* best-effort */ }
}

/** True when the actor carries any incapacitating condition. */
export async function hasIncapacitatingCondition(kind, id) {
  const conds = await getConditions(kind, id).catch(() => []);
  const set = new Set((conds || []).map((c) => normalizeConditionKey(c)).filter(Boolean));
  return INCAPACITATING_CONDITIONS.some((k) => set.has(k));
}

/** The charmer recorded for a charmed actor, or null. */
export async function charmerFor(kind, id) {
  const meta = await getConditionMeta(kind, id, 'charmed');
  return meta?.charmer || null;
}

/** The grappler recorded for a grappled actor, or null. */
export async function grapplerFor(kind, id) {
  const meta = await getConditionMeta(kind, id, 'grappled');
  return meta?.grappler || null;
}

/** "Exhaustion 3" / "exhaustion_3" / "Poisoned" → canonical key, or
 *  null when the condition is not in the vocabulary. */
export function normalizeConditionKey(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, '_');
  return CONDITION_KEYS.includes(key) ? key : null;
}

/** Highest exhaustion level in a condition list (0 = none). */
export function exhaustionLevel(conditions) {
  let lvl = 0;
  for (const c of conditions || []) {
    const m = /^exhaustion_(\d)$/.exec(c);
    if (m) lvl = Math.max(lvl, Number(m[1]));
  }
  return lvl;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** 2024 exhaustion penalty: -2 per level to every d20 test (0 = none). */
export function exhaustionPenalty(conditions) {
  return -2 * exhaustionLevel(conditions);
}

/** 2024 exhaustion speed reduction in feet (display only - speed is not tracked). */
export function exhaustionSpeedReduction(conditions) {
  return 5 * exhaustionLevel(conditions);
}

export async function getConditions(kind, id) {
  if (!id) return [];
  const row = await dbGet(`SELECT active_conditions FROM ${tableFor(kind)} WHERE id = ?`, [id]);
  const parsed = safeParse(row?.active_conditions, []);
  return Array.isArray(parsed) ? parsed : [];
}

async function writeConditions(kind, id, conditions) {
  await dbRun(`UPDATE ${tableFor(kind)} SET active_conditions = ? WHERE id = ?`,
    [JSON.stringify(conditions), id]);
}

export async function addCondition(kind, id, rawKey, meta = null) {
  const key = normalizeConditionKey(rawKey);
  if (!key) return { success: false, reason: `unknown condition: ${rawKey}` };
  if (kind === 'enemy') {
    // Step 1 (v1.0.194): condition immunities from the COMBAT_START
    // statblock snapshot. An immune enemy refuses the condition —
    // the marker handler surfaces the refusal to the DM as a fact,
    // so a skeleton can never silently become "poisoned".
    try {
      const row = await dbGet('SELECT name, stats_json FROM combat_enemies WHERE id = ?', [id]);
      const snap = safeParse(row?.stats_json, null);
      if (snap && conditionImmunityMatch(snap.conditionImmunities, key)) {
        return { success: false, immune: true, reason: `${row?.name || 'Enemy'} is immune to ${key}` };
      }
    } catch { /* no snapshot — the condition proceeds as before */ }
  }
  if (kind === 'player' || kind === 'companion') {
    // Family 6: subclass condition immunities (Aura of Devotion,
    // Fungal Body, Mindless Rage while Raging, ...). Same refusal
    // shape as the enemy snapshot branch above — the marker handler
    // surfaces it to the DM as a fact. Best-effort: any lookup
    // failure falls through and the condition proceeds as before.
    // Only the actor's OWN immunity wires here; an ally inside an
    // aura is the same missing aura-presence state as the D9 damage
    // rows (see resistanceService STILL_DM_PROMPT).
    try {
      const imm = await subclassConditionImmunity(kind, id, key);
      if (imm) {
        return { success: false, immune: true, reason: `${imm.name} is immune to ${key} (${imm.source})` };
      }
    } catch { /* the condition proceeds as before */ }
  }
  let conditions = await getConditions(kind, id);
  if (EXHAUSTION_KEYS.has(key)) {
    conditions = conditions.filter(c => !EXHAUSTION_KEYS.has(c));
  }
  if (!conditions.includes(key)) conditions.push(key);
  await writeConditions(kind, id, conditions);
  // Combat item 8: source metadata rides the condition (charmer /
  // grappler). Spell paths pass the caster; marker paths pass the
  // resolved Charmer=/Grappler= actor. Absent meta means unknown
  // source — callers that require it refuse before calling here.
  if (meta && (key === 'charmed' || key === 'grappled')) {
    await setConditionMeta(kind, id, key, meta);
  }
  // 2024 exhaustion: level 6 = death, no death saves (ruled 2026-10-26).
  // The death STATE is recorded here; the marker handler adds the death
  // event for enemies (it holds the session context).
  if (key === 'exhaustion_6') {
    try {
      if (kind === 'player') {
        await dbRun('UPDATE characters SET current_hp = 0, is_unconscious = 1, is_dead = 1 WHERE id = ?', [id]);
      } else if (kind === 'companion') {
        await dbRun('UPDATE companions SET companion_current_hp = 0, status = ? WHERE id = ?', ['dead', id]);
      } else if (kind === 'enemy') {
        await dbRun('UPDATE combat_enemies SET current_hp = 0, status = ? WHERE id = ?', ['dead', id]);
      }
    } catch { /* the condition itself is recorded; death state is best-effort here */ }
    return { success: true, conditions, lethal: true };
  }
  return { success: true, conditions };
}

export async function removeCondition(kind, id, rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return { success: false, reason: 'no condition given' };
  // Removal is lenient (no vocabulary check): clearing a key that was
  // never applied is a no-op success, not an error the DM must retry.
  const key = rawKey.trim().toLowerCase().replace(/\s+/g, '_');
  const conditions = (await getConditions(kind, id)).filter(c => c !== key);
  await writeConditions(kind, id, conditions);
  // Combat item 8: removing the condition clears its source metadata.
  await clearConditionMeta(kind, id, key);
  return { success: true, conditions };
}

/** One level down (long rest). Returns { changed, level }. */
export async function reduceExhaustion(kind, id) {
  const conditions = await getConditions(kind, id);
  const lvl = exhaustionLevel(conditions);
  if (lvl === 0) return { changed: false, level: 0 };
  const next = conditions.filter(c => !EXHAUSTION_KEYS.has(c));
  if (lvl > 1) next.push(`exhaustion_${lvl - 1}`);
  await writeConditions(kind, id, next);
  return { changed: true, level: lvl - 1 };
}

/** Companion lookup by display name within a party (the resolver and
 *  the marker handlers address companions by name). */
export async function findCompanionIdByName(characterId, name) {
  if (!characterId || !name) return null;
  const row = await dbGet(
    `SELECT c.id FROM companions c JOIN npcs n ON c.npc_id = n.id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?)`,
    [characterId, name]
  );
  return row?.id ?? null;
}

/** The /message note's data: the PC's conditions + each active
 *  companion's, keyed by display name (companions with none omitted). */
export async function getPartyConditions(characterId) {
  const player = await getConditions('player', characterId);
  const rows = await dbAll(
    `SELECT c.active_conditions, n.name AS name FROM companions c
     LEFT JOIN npcs n ON n.id = c.npc_id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active'`,
    [characterId]
  );
  const companions = {};
  for (const r of rows) {
    const conds = safeParse(r.active_conditions, []);
    if (Array.isArray(conds) && conds.length > 0 && r.name) companions[r.name] = conds;
  }
  return { player, companions };
}

// ---------------------------------------------------------------------------
// Mechanical effect profiles (pure — the enforcement surface)
// ---------------------------------------------------------------------------

const ABILITY_ALIASES = {
  strength: 'str', str: 'str', dexterity: 'dex', dex: 'dex',
  constitution: 'con', con: 'con', intelligence: 'int', int: 'int',
  wisdom: 'wis', wis: 'wis', charisma: 'cha', cha: 'cha'
};

function abilityKeyOf(name) {
  if (!name) return null;
  return ABILITY_ALIASES[String(name).trim().toLowerCase()] || null;
}

const AUTO_FAIL_CONDITIONS = ['paralyzed', 'stunned', 'unconscious', 'petrified'];
const ATTACKED_WITH_ADVANTAGE = ['prone', 'blinded', 'restrained', ...AUTO_FAIL_CONDITIONS];

/**
 * What a condition list does to the actor's OWN checks and saves.
 * kind: 'skill' | 'ability' | 'save'; name: the skill/ability/save name
 * as the resolver knows it ("Stealth", "Dexterity", "DEX"...).
 *
 * Rules (5e, scoped to what has honest math here):
 *   - paralyzed / stunned / unconscious / petrified: STR and DEX saves
 *     auto-fail.
 *   - poisoned, frightened: disadvantage on ability checks (skills
 *     included). (Their attack-roll disadvantage lives in combat,
 *     whose rolls are not resolved here in v1.0.)
 *   - exhaustion: -2 penalty per level to every d20 test (2024 PHB);
 *     Speed -5 ft per level (display only - speed is not tracked).
 *   - restrained: disadvantage on DEX saves.
 * Charmed, deafened, grappled, blinded (for the actor's own checks),
 * and incapacitated carry no generic check/save math — the prompt
 * note surfaces them; the fiction honors them.
 */
export function conditionRollEffects(conditions, kind, name) {
  const set = new Set(conditions || []);
  const ex = exhaustionLevel(conditions);
  const ability = abilityKeyOf(name);
  const reasons = [];
  let autoFail = false;
  let disadvantage = false;

  if (kind === 'save' && (ability === 'str' || ability === 'dex')) {
    for (const k of AUTO_FAIL_CONDITIONS) {
      if (set.has(k)) { autoFail = true; reasons.push(k); }
    }
  }
  if (kind === 'skill' || kind === 'ability') {
    if (set.has('poisoned')) { disadvantage = true; reasons.push('poisoned'); }
    if (set.has('frightened')) { disadvantage = true; reasons.push('frightened'); }
  }
  if (kind === 'save') {
    if (set.has('restrained') && ability === 'dex') { disadvantage = true; reasons.push('restrained'); }
  }
  // 2024 exhaustion: -2 per level to every d20 test (no disadvantage).
  const penalty = -2 * ex;
  if (ex >= 1) reasons.push(`exhaustion_${ex}`);
  return { autoFail, disadvantage, penalty, reasons: [...new Set(reasons)] };
}

/**
 * What a condition list does to attacks AGAINST the actor.
 * Prone approximation (stated): attackers gain advantage — the
 * ranged-attacker disadvantage for prone is not modeled, because
 * enemy attacks carry no range flag in this system (cover already
 * handles ranged defense through AC).
 */
export function conditionDefenseEffects(conditions) {
  const set = new Set(conditions || []);
  const reasons = [];
  let attackerAdvantage = false;
  let attackerDisadvantage = false;
  for (const k of ATTACKED_WITH_ADVANTAGE) {
    if (set.has(k)) { attackerAdvantage = true; reasons.push(k); }
  }
  if (set.has('invisible')) { attackerDisadvantage = true; reasons.push('invisible'); }
  return { attackerAdvantage, attackerDisadvantage, reasons: [...new Set(reasons)] };
}

/**
 * What a condition list does to the actor's OWN attack rolls
 * (combat-real B2/B3 — the attacker-side profile). 5e: poisoned,
 * frightened, prone, restrained and blinded attackers roll at
 * disadvantage; an invisible attacker rolls with advantage;
 * exhaustion imposes -2 per level on attack rolls (2024 PHB). An actor who is
 * unconscious/paralyzed/petrified cannot attack at all — that is the
 * fiction's call, not modeled here.
 */
const ATTACK_DISADVANTAGE = ['poisoned', 'frightened', 'prone', 'restrained', 'blinded'];

export function conditionAttackEffects(conditions) {
  const set = new Set(conditions || []);
  const ex = exhaustionLevel(conditions);
  const reasons = [];
  let advantage = false;
  let disadvantage = false;
  for (const k of ATTACK_DISADVANTAGE) {
    if (set.has(k)) { disadvantage = true; reasons.push(k); }
  }
  if (set.has('invisible')) { advantage = true; reasons.push('invisible'); }
  // 2024 exhaustion: -2 per level to attack rolls (no disadvantage).
  const penalty = -2 * ex;
  if (ex >= 1) reasons.push(`exhaustion_${ex}`);
  return { advantage, disadvantage, penalty, reasons: [...new Set(reasons)] };
}

/** 5e advantage algebra: imposing a state on an existing one — equal
 *  states reinforce (no stacking), opposite states cancel to null. */
export function mergeAdvantageState(current, imposed) {
  if (!imposed) return current ?? null;
  if (!current) return imposed;
  return current === imposed ? current : null;
}

// ---------------------------------------------------------------------------
// Family 6 (mechanics hooks) — subclass save modifiers.
// Pure: `features` is the featuresForActor output for the saving actor;
// `roll` describes the save being made. Returns an effect object the
// call sites merge beside conditionRollEffects (same algebra: advantage
// merges, a flat bonus adds to the modifier, bonus dice are rolled by
// server-side paths and stated in the pending block for PCs).
//
//   roll = { kind, name, ability, isSpellSave, saveVsCondition,
//            saveProficient, level, timedEffects, preyForced }
//     kind: 'save' (only saves use this; checks/abilities pass through
//       untouched — a save feature never touches a skill check).
//     ability: short ('wis') or full ('Wisdom') save ability.
//     isSpellSave: true when the save is against a spell (Spell
//       Resistance needs it; ROLL_REQUEST saves do not know, so they
//       pass false and the feature correctly does not fire there).
//     saveVsCondition: the condition the save is against / to end
//       ('charmed', 'frightened', 'poisoned', 'exhaustion', 'blinded',
//       'deafened') — null when the save is not against a condition.
//       No current ROLL_REQUEST call site supplies it, so those
//       limbs are dormant until a caller passes it (see NOTES.md).
//     saveProficient: whether the actor is proficient in THIS save
//       (Iron Mind needs it for the Wisdom limb).
//     level: the actor's level in the granting class (proficiency math).
//     timedEffects: Set/array of active timed-effect keys (Eyes Wide Open).
//     preyForced: true when the save is forced by the target of the
//       actor's Slayer's Prey (Supernatural Defense only).
// ---------------------------------------------------------------------------

const SAVE_ABILITY_KEYS = {
  strength: 'str', str: 'str', dexterity: 'dex', dex: 'dex',
  constitution: 'con', con: 'con', intelligence: 'int', int: 'int',
  wisdom: 'wis', wis: 'wis', charisma: 'cha', cha: 'cha',
};

function saveAbilityOf(roll) {
  if (roll?.ability) {
    const k = SAVE_ABILITY_KEYS[String(roll.ability).trim().toLowerCase()];
    if (k) return k;
  }
  if (roll?.name) {
    const k = SAVE_ABILITY_KEYS[String(roll.name).trim().toLowerCase()];
    if (k) return k;
  }
  return null;
}

function timedHas(roll, key) {
  const te = roll?.timedEffects;
  if (!te) return false;
  if (typeof te === 'function') { try { return !!te(key); } catch { return false; } }
  if (te instanceof Set) return te.has(key);
  if (Array.isArray(te)) return te.includes(key);
  if (typeof te === 'object') return !!te[key];
  return false;
}

function proficiencyBonusFor(level) {
  return Math.floor(((Number(level) || 1) - 1) / 4) + 2;
}

export function subclassSaveEffects(features, roll = {}) {
  const out = { advantage: false, disadvantage: false, bonus: 0, bonusDice: null, reasons: [], sources: [] };
  if (!roll || roll.kind !== 'save') return out;
  const list = Array.isArray(features) ? features : [];
  const held = new Set(list.map((f) => String(f?.key || f?.featureKey || '').toLowerCase()).filter(Boolean));
  const ability = saveAbilityOf(roll);
  const vs = String(roll.saveVsCondition || '').toLowerCase();
  const addAdvantage = (source) => { out.advantage = true; out.reasons.push(source); out.sources.push(source); };
  const addBonus = (n, source) => { out.bonus += n; out.reasons.push(source); out.sources.push(source); };

  // Durable Magic (War Magic 10): +2 to AC and all saving throws.
    // Improved Circle Forms (Moon druid, kind E — Family 4/6 merge):
  // +Wisdom modifier to Constitution saves while in a Wild Shape form.
  // DORMANT until a call site passes roll.inForm + roll.wisMod (no call
  // site does yet — see MERGE-NOTES.md). Never fires on a guess.
  if (held.has('improved_circle_forms') && roll.inForm === true && ability === 'con' && Number(roll.wisMod)) {
    addBonus(Number(roll.wisMod), 'Improved Circle Forms (Wisdom to Constitution saves in form)');
  }
  if (held.has('durable_magic')) addBonus(2, 'Durable Magic +2');
  // Spell Resistance (Abjurer 14; Warden Fey Trailblazer / Loreseeker /
  // Witchbane Hunter 13): advantage on saving throws against spells.
  if (held.has('spell_resistance') && roll.isSpellSave) addAdvantage('Spell Resistance (vs spell)');
  // Guarded Mind (Psi Warrior 10) + Psychic Defenses (Aberrant 6):
  // advantage on saves against being Charmed or Frightened.
  if ((held.has('guarded_mind') || held.has('psychic_defenses')) && (vs === 'charmed' || vs === 'frightened')) {
    addAdvantage(held.has('guarded_mind') ? 'Guarded Mind' : 'Psychic Defenses');
  }
  // Beautiful Veil (Adoration 6): advantage on saves against being charmed.
  if (held.has('beautiful_veil') && vs === 'charmed') addAdvantage('Beautiful Veil');
  // Unliving Fortitude (Blackguard Despair 15): advantage on saves
  // against exhaustion and being poisoned.
  if (held.has('unliving_fortitude') && (vs === 'exhaustion' || vs === 'poisoned')) addAdvantage('Unliving Fortitude');
  // Eyes Wide Open (Pugilist 17): advantage on saves against being
  // blinded or deafened, while the 1-minute effect is active.
  if (held.has('eyes_wide_open') && (vs === 'blinded' || vs === 'deafened') && timedHas(roll, 'eyes_wide_open')) {
    addAdvantage('Eyes Wide Open');
  }
  // Iron Mind (Gloom Stalker 7): proficiency in Wisdom saves — a +PB
  // bonus when the actor is not already proficient in Wisdom saves.
  // (Already-proficient limb — gain Int or Cha save proficiency by
  // choice — has no stored choice; see NOTES.md. Not applied.)
  if (held.has('iron_mind') && ability === 'wis' && !roll.saveProficient) {
    addBonus(proficiencyBonusFor(roll.level), 'Iron Mind (Wisdom proficiency)');
  }
  // Supernatural Defense (Monster Slayer 7): add 1d6 — ONLY when the
  // save is forced by the target of the actor's Slayer's Prey (or an
  // escape check against its grapple). No call site passes preyForced
  // yet, so this limb is dormant until Slayer's Prey target state
  // reaches the roll path (see NOTES.md).
  if (held.has('supernatural_defense') && roll.preyForced === true) {
    out.bonusDice = { count: 1, sides: 6, source: 'Supernatural Defense' };
    out.reasons.push('Supernatural Defense +1d6');
    out.sources.push('Supernatural Defense');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Caster-imposed save disadvantage (enemy-side hooks). The MARK lives on
// the TARGET (a timed effect the marking side sets — the attack family
// for Eldritch Strike, the spell-cast family for Magical Ambush, etc.);
// this function only reads the marks. Every mark below is "disadvantage
// on the target's next save against a spell you cast" (or the stated
// variant); all of them require the save to be against a spell.
// ---------------------------------------------------------------------------

export const SAVE_DISADVANTAGE_MARKS = [
  'eldritch_strike', 'magical_ambush', 'corona_of_light',
  'diminish_defiance', 'enfeeble_the_unholy', 'brand_of_the_sapping_scar',
];

const SAVE_MARK_LABELS = {
  eldritch_strike: 'Eldritch Strike',
  magical_ambush: 'Magical Ambush',
  corona_of_light: 'Corona of Light',
  diminish_defiance: 'Diminish Defiance',
  enfeeble_the_unholy: 'Enfeeble the Unholy',
  brand_of_the_sapping_scar: 'Brand of the Sapping Scar',
};

export function saveDisadvantageFromMarks(marks, saveCtx = {}) {
  const out = { disadvantage: false, reasons: [], sources: [] };
  if (!saveCtx.isSpellSave) return out;
  const active = Array.isArray(marks) ? marks : [];
  for (const key of active) {
    const k = String(key || '').toLowerCase();
    if (!SAVE_DISADVANTAGE_MARKS.includes(k)) continue;
    // Corona of Light: only spells dealing Fire or Radiant damage.
    // The damage type must be KNOWN to apply — an unknown type fails
    // closed (the mark does not fire), it never assumes fire/radiant.
    if (k === 'corona_of_light') {
      const t = saveCtx.spellDamageType ? String(saveCtx.spellDamageType).toLowerCase() : null;
      if (t !== 'fire' && t !== 'radiant') continue;
    }
    // Brand of the Sapping Scar: only the warlock's own Warlock spells.
    // The caster class must be KNOWN to be warlock — unknown fails closed.
    if (k === 'brand_of_the_sapping_scar') {
      if (!saveCtx.casterClass || String(saveCtx.casterClass).toLowerCase() !== 'warlock') continue;
    }
    out.disadvantage = true;
    out.reasons.push(SAVE_MARK_LABELS[k]);
    out.sources.push(SAVE_MARK_LABELS[k]);
  }
  return out;
}

/** Which disadvantage marks are active on this target (timed effects)? */
export async function targetSaveMarksActive(actorRef) {
  // MERGE FIX (2026-11-09): the staged version called
  // hasTimedEffect(actorRef, key) — two args against a three-arg pure
  // function (sessionConfig, actorKey, effectKey) — so it always read
  // an empty blob and returned []. This version loads the session
  // config from the DB and reads the enemy bucket. ACTOR-KEY
  // CONVENTION (merge-defined, no setter exists yet): enemy marks
  // live under `enemy:<enemyId>` in session_config.timedEffects — the
  // same `kind:id` shape the Wild Magic family uses for party actors
  // (player:<id>, companion:<id>). Mark setters must write that key.
  const found = [];
  if (!actorRef?.sessionId || !actorRef?.id) return found;
  try {
    const { hasTimedEffect } = await import('./durationTrackerService.js');
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [actorRef.sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    const actorKey = `enemy:${actorRef.id}`;
    for (const key of SAVE_DISADVANTAGE_MARKS) {
      try {
        if (hasTimedEffect(cfg, actorKey, key)) found.push(key);
      } catch { /* one unreadable mark never blocks the others */ }
    }
  } catch { /* no duration tracker yet — no marks can be active */ }
  return found;
}

/**
 * Resolve an actor's subclass save effects from the row (DB-backed).
 * `roll` is the same shape subclassSaveEffects takes. Best-effort:
 * a missing class-resolution import resolves to no subclass effects.
 */
export async function subclassSaveEffectsForActor(kind, id, roll = {}) {
  const table = kind === 'player' ? 'characters' : kind === 'companion' ? 'companions' : null;
  if (!table || !id) return subclassSaveEffects([], roll);
  let row = null;
  try {
    row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  } catch { return subclassSaveEffects([], roll); }
  if (!row) return subclassSaveEffects([], roll);
  let features = [];
  try {
    const { actorDescriptorFromRow, featuresForActorSafe } = await import('./resistanceService.js');
    const desc = actorDescriptorFromRow(row, kind);
    features = desc ? await featuresForActorSafe(desc) : [];
  } catch { features = []; }
  // Timed effects the pure function can read (Eyes Wide Open, 1 minute).
  // A missing duration tracker leaves timed limbs dormant, never faked.
  let rollWithTimed = roll;
  if (roll && typeof roll === 'object' && !roll.timedEffects) {
    try {
      const { timedEffectActive } = await import('./resistanceService.js');
      const active = new Set();
      if (await timedEffectActive({ kind, id }, 'eyes_wide_open')) active.add('eyes_wide_open');
      rollWithTimed = { ...roll, timedEffects: active };
    } catch { /* no tracker — timed limbs stay dormant */ }
  }
  return subclassSaveEffects(features, rollWithTimed);
}

/**
 * Subclass condition immunity for one actor + condition (DB-backed).
 * Returns { condition, source, featureKey, featureName, name } or null.
 * Best-effort: any failure returns null and the condition proceeds.
 */
export async function subclassConditionImmunity(kind, id, conditionKey) {
  const key = String(conditionKey || '').toLowerCase();
  if (!key || (kind !== 'player' && kind !== 'companion')) return null;
  const table = kind === 'player' ? 'characters' : 'companions';
  let row = null;
  try {
    row = await dbGet(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  } catch { return null; }
  if (!row) return null;
  try {
    const { actorDescriptorFromRow, conditionImmunitiesForFeatures, featuresForActorSafe } = await import('./resistanceService.js');
    const desc = actorDescriptorFromRow(row, kind);
    if (!desc) return null;
    const features = await featuresForActorSafe(desc);
    const held = conditionImmunitiesForFeatures(features, desc);
    const hit = held.find((h) => h.condition === key);
    if (!hit) return null;
    let name = row.name || null;
    if (kind === 'companion' && !name) {
      try {
        const npc = await dbGet('SELECT n.name FROM companions c JOIN npcs n ON c.npc_id = n.id WHERE c.id = ?', [id]);
        name = npc?.name || null;
      } catch { /* fall through to the generic label */ }
    }
    return { ...hit, name: name || (kind === 'player' ? 'Player' : 'Companion') };
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Marker handlers
// ---------------------------------------------------------------------------

/** Resolve a PC/companion/enemy name to a full actor reference
 *  (kind + row id + ledger key + display name), or null. Mirrors the
 *  target resolution in applyConditionMarker below. */
async function resolveActorByName(context, rawName) {
  const targetRaw = String(rawName || '').trim();
  if (!targetRaw || !context?.characterId) return null;
  const character = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
  const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
    (character && targetRaw.toLowerCase() === character.name.toLowerCase());
  if (isPc) {
    const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
    const key = await ledgerKeyForPlayer(context.characterId).catch(() => `player:${context.characterId}`);
    return { kind: 'player', id: context.characterId, key, name: character?.name || 'Player' };
  }
  const compId = await findCompanionIdByName(context.characterId, targetRaw);
  if (compId) {
    const { ledgerKeyForCompanion } = await import('./turnLedgerService.js');
    const compRow = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [compId]);
    const key = await ledgerKeyForCompanion({ id: compId, npc_id: compRow?.npc_id }).catch(() => `companion:${compId}`);
    return { kind: 'companion', id: compId, key, name: targetRaw };
  }
  if (context.sessionId) {
    try {
      const { getCurrentEncounterSeq, findActiveEnemy } = await import('./enemyCombatService.js');
      const seq = await getCurrentEncounterSeq(context.sessionId);
      const enemy = seq ? await findActiveEnemy(context.sessionId, seq, targetRaw) : null;
      if (enemy) {
        const { combatFallbackId } = await import('./worldIdService.js');
        return { kind: 'enemy', id: enemy.id, key: combatFallbackId(context.sessionId, seq, enemy.id), name: enemy.name };
      }
    } catch { /* falls through to null */ }
  }
  return null;
}

/** Resolve a ledger/world key back to a row id, or null. Enemy keys
 *  embed the row id; player/companion keys are either an id fallback
 *  (player:N / companion:N) or a world_id. */
export async function resolveActorId(kind, key) {
  if (!kind || !key) return null;
  try {
    if (kind === 'enemy') {
      const m = /^combat:\d+:\d+:(\d+)$/.exec(String(key));
      return m ? Number(m[1]) : null;
    }
    if (kind === 'player') {
      const m = /^player:(\d+)$/.exec(String(key));
      if (m) return Number(m[1]);
      const row = await dbGet('SELECT id FROM characters WHERE world_id = ?', [key]);
      return row?.id ?? null;
    }
    if (kind === 'companion') {
      const m = /^companion:(\d+)$/.exec(String(key));
      if (m) return Number(m[1]);
      const row = await dbGet('SELECT c.id FROM companions c JOIN npcs n ON n.id = c.npc_id WHERE n.world_id = ? LIMIT 1', [key]);
      return row?.id ?? null;
    }
  } catch { return null; }
  return null;
}

/** Release every grapple held by one actor (grappler incapacitated).
 *  Returns the released victims' display names. */
async function releaseGrapplesHeldBy(kind, id) {
  const released = [];
  let rows = [];
  try {
    rows = await dbAll(`SELECT kind, owner_id, meta_json FROM condition_meta WHERE condition = 'grappled'`);
  } catch { return released; }
  for (const row of rows || []) {
    const meta = safeParse(row?.meta_json, null);
    const g = meta?.grappler;
    if (!g || g.kind !== kind || Number(g.id) !== Number(id)) continue;
    await removeCondition(row.kind, row.owner_id, 'grappled').catch(() => null);
    let name = null;
    try {
      if (row.kind === 'player') {
        const r = await dbGet('SELECT name FROM characters WHERE id = ?', [row.owner_id]);
        name = r?.name || 'Player';
      } else if (row.kind === 'companion') {
        const r = await dbGet('SELECT n.name FROM companions c JOIN npcs n ON n.id = c.npc_id WHERE c.id = ?', [row.owner_id]);
        name = r?.name || 'companion';
      } else if (row.kind === 'enemy') {
        const r = await dbGet('SELECT name FROM combat_enemies WHERE id = ?', [row.owner_id]);
        name = r?.name || 'enemy';
      }
    } catch { name = 'a grappled creature'; }
    released.push(name);
  }
  return released;
}

async function applyConditionMarker(parsed, context, action) {
  if (!context?.characterId) return null;
  const rawCondition = parsed?.Condition;
  const key = normalizeConditionKey(rawCondition);
  if (action === 'add' && !key) {
    return { type: 'condition_change', success: false, reason: `unknown condition: ${rawCondition}` };
  }
  const targetRaw = String(parsed?.Target || '').trim();
  if (!targetRaw) {
    return { type: 'condition_change', success: false, reason: 'CONDITION marker needs a Target' };
  }

  const character = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
  const isPc = /^(player|pc|character)$/i.test(targetRaw) ||
    (character && targetRaw.toLowerCase() === character.name.toLowerCase());

  let kind = null;
  let id = null;
  let displayName = targetRaw;
  if (isPc) {
    kind = 'player';
    id = context.characterId;
    displayName = character?.name || 'Player';
  } else {
    const compId = await findCompanionIdByName(context.characterId, targetRaw);
    if (compId) {
      kind = 'companion';
      id = compId;
      displayName = targetRaw;
    } else if (context.sessionId) {
      // B3: enemy targets — a name matching an active enemy in the
      // session's current encounter. Dynamic import: enemyCombatService
      // imports this module (its attack path reads target conditions).
      try {
        const { getCurrentEncounterSeq, findActiveEnemy } = await import('./enemyCombatService.js');
        const seq = await getCurrentEncounterSeq(context.sessionId);
        const enemy = seq ? await findActiveEnemy(context.sessionId, seq, targetRaw) : null;
        if (enemy) { kind = 'enemy'; id = enemy.id; displayName = enemy.name; }
      } catch { /* no encounter context — falls through to unknown target */ }
    }
  }
  if (!kind) {
    return { type: 'condition_change', success: false, reason: `unknown target: ${targetRaw}` };
  }

  // Combat item 8: charmed/grappled require a recorded source — the
  // engine cannot enforce "can't attack the charmer" or compute an
  // escape DC without one. Refused with a remedy, never invented.
  // Spell paths pass the caster as meta instead (applySpellCondition).
  let meta = null;
  if (action === 'add') {
    if (key === 'charmed') {
      const charmerRaw = String(parsed?.Charmer || '').trim();
      if (!charmerRaw) {
        return { type: 'condition_change', success: false, reason: 'charmed needs Charmer=', remedy: 'Re-emit CONDITION_ADD with Charmer="<name of the charmer>" (PC, companion, or enemy).' };
      }
      const charmer = await resolveActorByName(context, charmerRaw);
      if (!charmer) return { type: 'condition_change', success: false, reason: `unknown charmer: ${charmerRaw}` };
      meta = { charmer };
    } else if (key === 'grappled') {
      const grapplerRaw = String(parsed?.Grappler || '').trim();
      if (!grapplerRaw) {
        return { type: 'condition_change', success: false, reason: 'grappled needs Grappler=', remedy: 'Re-emit CONDITION_ADD with Grappler="<name of the grappler>" (PC, companion, or enemy).' };
      }
      const grappler = await resolveActorByName(context, grapplerRaw);
      if (!grappler) return { type: 'condition_change', success: false, reason: `unknown grappler: ${grapplerRaw}` };
      meta = { grappler };
    }
  }
  const r = action === 'add'
    ? await addCondition(kind, id, rawCondition, meta)
    : await removeCondition(kind, id, rawCondition);
  if (!r.success) return { type: 'condition_change', success: false, reason: r.reason };
  // Combat item 8: incapacitation breaks concentration and releases
  // grapples held by the newly incapacitated actor. Best-effort:
  // failures here never fail the condition itself.
  let concentrationBroken = false;
  let released = [];
  if (action === 'add' && INCAPACITATING_CONDITIONS.includes(key)) {
    try {
      const { breakConcentration, breakCompanionConcentration, breakEnemyConcentration } = await import('./concentrationService.js');
      if (kind === 'player') concentrationBroken = !!(await breakConcentration(id, 'incapacitated'));
      else if (kind === 'companion') concentrationBroken = !!(await breakCompanionConcentration(id, 'incapacitated'));
      else if (kind === 'enemy' && context.sessionId) {
        const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
        const seq = await getCurrentEncounterSeq(context.sessionId).catch(() => null);
        if (seq) concentrationBroken = !!(await breakEnemyConcentration(context.sessionId, seq, id));
      }
    } catch { /* best-effort */ }
    try {
      released = await releaseGrapplesHeldBy(kind, id);
    } catch { /* best-effort */ }
  }
  // 2024 exhaustion death: an enemy killed by exhaustion_6 gets the
  // standard death event (morale/casualty state counts it) when the
  // marker ran inside a session. Best-effort: the death state stands
  // without the event.
  let deathEvent = null;
  if (action === 'add' && r.lethal && kind === 'enemy' && context.sessionId) {
    try {
      const { getCurrentEncounterSeq, recordDeathEvent } = await import('./enemyCombatService.js');
      const seq = await getCurrentEncounterSeq(context.sessionId);
      if (seq) deathEvent = await recordDeathEvent(context.sessionId, seq, { id, name: displayName });
    } catch { /* best-effort */ }
  }
  return {
    type: 'condition_change', success: true, action,
    target: displayName, condition: key || String(rawCondition).trim().toLowerCase().replace(/\s+/g, '_'),
    conditions: r.conditions,
    ...(r.lethal ? { lethal: true } : {}),
    ...(deathEvent ? { deathEvent } : {}),
    ...(concentrationBroken ? { concentrationBroken: true } : {}),
    ...(released.length ? { released } : {})
  };
}

registerMarkerHandler('CONDITION_ADD', async (parsed, context) => {
  try {
    return await applyConditionMarker(parsed, context, 'add');
  } catch (e) {
    console.error('[conditionService] CONDITION_ADD handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('CONDITION_REMOVE', async (parsed, context) => {
  try {
    return await applyConditionMarker(parsed, context, 'remove');
  } catch (e) {
    console.error('[conditionService] CONDITION_REMOVE handler failed:', e.message);
    return null;
  }
});

// ---------------------------------------------------------------------------
// Grapple escape (combat item 8)
// ---------------------------------------------------------------------------

function abilityMod(score) {
  if (!Number.isFinite(Number(score))) return 0;
  return Math.floor((Number(score) - 10) / 2);
}

/** 2024 proficiency bonus by character level. */
export function pbForLevel(level) {
  const l = Number(level) || 1;
  return 2 + Math.floor(Math.max(0, l - 1) / 4);
}

/** 2024 proficiency bonus by challenge rating ("1/4", "1/2", "1", "6"). */
export function pbForCr(cr) {
  let v = 0;
  if (typeof cr === 'string' && cr.includes('/')) {
    const [n, d] = cr.split('/').map(Number);
    v = d ? n / d : 0;
  } else {
    v = Number(cr) || 0;
  }
  if (v < 1) return 2;
  return 2 + Math.floor((v - 1) / 4);
}

function abilityScoresOf(row) {
  const raw = safeParse(row?.ability_scores, null);
  if (raw && typeof raw === 'object') return raw;
  return {};
}

function abilityOf(scores, ability) {
  if (!scores || typeof scores !== 'object') return null;
  const lower = {};
  for (const [k, v] of Object.entries(scores)) lower[String(k).toLowerCase()] = v;
  if (ability === 'str') return lower.str ?? lower.strength ?? null;
  if (ability === 'dex') return lower.dex ?? lower.dexterity ?? null;
  return null;
}

/** Escape DC = 8 + grappler's STR mod + proficiency bonus, computed
 *  from the grappler's row at escape time. Returns null when the
 *  grappler cannot be resolved (DM declares Dc= instead). */
export async function computeEscapeDc(grappler) {
  if (!grappler || !grappler.kind || !grappler.id) return null;
  try {
    if (grappler.kind === 'player') {
      const row = await dbGet('SELECT ability_scores, level FROM characters WHERE id = ?', [grappler.id]);
      if (!row) return null;
      return 8 + abilityMod(abilityOf(abilityScoresOf(row), 'str')) + pbForLevel(row.level);
    }
    if (grappler.kind === 'companion') {
      const row = await dbGet('SELECT ability_scores, companion_level FROM companions WHERE id = ?', [grappler.id]);
      if (!row) return null;
      return 8 + abilityMod(abilityOf(abilityScoresOf(row), 'str')) + pbForLevel(row.companion_level || 1);
    }
    if (grappler.kind === 'enemy') {
      const row = await dbGet('SELECT stats_json FROM combat_enemies WHERE id = ?', [grappler.id]);
      const snap = safeParse(row?.stats_json, null);
      if (!snap) return null;
      const str = snap?.abilities?.str ?? snap?.abilities?.strength ?? null;
      return 8 + abilityMod(str) + pbForCr(snap?.cr);
    }
  } catch { return null; }
  return null;
}

/** System escape roll for companions/enemies: d20 + ability modifier
 *  (enemy statblock skill value when present, else STR/DEX mod).
 *  PCs always roll real dice via a pending request. */
export async function rollSystemEscape(kind, id, skill, dc) {
  const ability = skill === 'acrobatics' ? 'dex' : 'str';
  let modifier = 0;
  try {
    if (kind === 'companion') {
      const row = await dbGet('SELECT ability_scores FROM companions WHERE id = ?', [id]);
      modifier = abilityMod(abilityOf(abilityScoresOf(row), ability));
    } else if (kind === 'enemy') {
      const row = await dbGet('SELECT stats_json FROM combat_enemies WHERE id = ?', [id]);
      const snap = safeParse(row?.stats_json, null);
      const skillVal = snap?.skills?.[skill] ?? snap?.skills?.[skill.charAt(0).toUpperCase() + skill.slice(1)] ?? null;
      modifier = Number.isFinite(Number(skillVal))
        ? Number(skillVal)
        : abilityMod(snap?.abilities?.[ability] ?? snap?.abilities?.[ability === 'str' ? 'strength' : 'dexterity']);
    }
  } catch { modifier = 0; }
  const { roll } = await import('../utils/rng.js');
  const die = roll(20, 1, { reason: 'grapple escape' }).total;
  const total = die + modifier;
  const success = die === 20 ? true : die === 1 ? false : total >= dc;
  return { die, total, modifier, success };
}

async function readCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {}) || {};
}

async function writeCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/** Resolve a pending escape on the PC's reported roll. Returns false
 *  for foreign keys (the route falls through to the next branch). */
export async function applyPendingEscape(sessionId, effectKey, rollOutcome) {
  if (!sessionId || !effectKey) return false;
  const cfg = await readCfg(sessionId);
  const effect = cfg.pendingEscape || null;
  if (!effect || effect.key !== effectKey) return false;
  const outcome = rollOutcome?.outcome;
  const takenDie = rollOutcome?.takenDie;
  const success = outcome === 'success' || outcome === 'critical_success' || takenDie === 20;
  const failed = outcome === 'failure' || outcome === 'critical_failure' || takenDie === 1;
  delete cfg.pendingEscape;
  await writeCfg(sessionId, cfg);
  if (!success && !failed) return { success: true, escaped: false, reason: 'unresolved escape roll' };
  if (success) {
    await removeCondition(effect.escapeeKind, effect.escapeeId, 'grappled').catch(() => null);
    return { success: true, escaped: true, escapee: effect.escapeeName, skill: effect.skill, dc: effect.dc, die: takenDie, total: rollOutcome?.total ?? null };
  }
  return { success: true, escaped: false, escapee: effect.escapeeName, skill: effect.skill, dc: effect.dc, die: takenDie, total: rollOutcome?.total ?? null };
}

registerMarkerHandler('ESCAPE', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const targetRaw = String(parsed?.Target || '').trim();
    if (!targetRaw) return { type: 'escape', success: false, reason: 'ESCAPE needs Target=' };
    const skillRaw = String(parsed?.Skill || '').trim().toLowerCase();
    if (skillRaw !== 'athletics' && skillRaw !== 'acrobatics') {
      return { type: 'escape', success: false, reason: 'ESCAPE needs Skill=Athletics or Acrobatics', remedy: 'Re-emit ESCAPE with Skill=Athletics or Skill=Acrobatics (the escapee chooses).' };
    }
    const skill = skillRaw;
    const escapee = await resolveActorByName(context, targetRaw);
    if (!escapee) return { type: 'escape', success: false, reason: `unknown escapee: ${targetRaw}` };
    if (await hasIncapacitatingCondition(escapee.kind, escapee.id)) {
      return { type: 'escape', success: false, reason: `${escapee.name} is incapacitated and cannot take actions` };
    }
    const conds = await getConditions(escapee.kind, escapee.id);
    if (!conds.map((c) => normalizeConditionKey(c)).includes('grappled')) {
      return { type: 'escape', success: false, reason: `${escapee.name} is not grappled` };
    }
    // DC: declared override, else computed from the grappler on record.
    let dc = parsed?.Dc != null ? Number(parsed.Dc) : null;
    if (!Number.isFinite(dc)) {
      const grappler = await grapplerFor(escapee.kind, escapee.id);
      dc = grappler ? await computeEscapeDc(grappler) : null;
      if (!Number.isFinite(dc)) {
        return { type: 'escape', success: false, reason: 'no grappler on record and no Dc= declared', remedy: 'Re-emit ESCAPE with Dc=<escape DC>, or re-add grappled with Grappler= so the DC can be computed.' };
      }
    }
    // One escape attempt per turn (item 8 v1 action-cost shape: the
    // turn ledger tracks no generic action budget, so ESCAPE tracks
    // its own attempt flag per turn slot; a full shared action budget
    // is future work, not this item).
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    const encounterSeq = await getCurrentEncounterSeq(context.sessionId);
    if (encounterSeq) {
      const tls = await import('./turnLedgerService.js');
      // Turn-order identity gate FIRST (party members only; enemies
      // DM-governed, mirroring the DODGE gate) — a refused attempt
      // must not spend the per-turn escape flag below.
      if (escapee.kind !== 'enemy') {
        const id = await tls.checkTurnIdentity(context.sessionId, encounterSeq, escapee.key).catch(() => ({ allowed: true }));
        if (id && !id.allowed) return { type: 'escape', success: false, reason: `${id.reason} ${id.remedy}` };
      }
      const slot = await tls.currentSlotKey(context.sessionId, encounterSeq).catch(() => null);
      if (slot) {
        const ledger = await tls.readLedger(context.sessionId, encounterSeq).catch(() => null);
        const budget = (ledger && tls.budgetIn) ? tls.budgetIn(ledger, slot, escapee.key) || {} : {};
        if (budget.escapeSpent) {
          return { type: 'escape', success: false, reason: `${escapee.name} already attempted an escape this turn` };
        }
        if (tls.updateBudgetForSlot) {
          await tls.updateBudgetForSlot(context.sessionId, encounterSeq, slot, escapee.key, { escapeSpent: true, escapeSpentBy: 'Escape' }).catch(() => null);
        }
      }
    }
    if (escapee.kind === 'player') {
      const { postPendingSave, pushDmNotice } = await import('./enemySpellService.js');
      const skillName = skill === 'athletics' ? 'Athletics' : 'Acrobatics';
      const effect = { escapeeKind: escapee.kind, escapeeId: escapee.id, escapeeName: escapee.name, skill, dc };
      const posted = await postPendingSave(context.sessionId, context.characterId, skillName, dc, 'pendingEscape', effect, 'skill');
      if (!posted) return { type: 'escape', success: false, reason: 'could not post the escape check' };
      await pushDmNotice(context.sessionId, `Ask ${escapee.name} for ${skillName} vs escape DC ${dc} — success ends the grapple.`);
      return { type: 'escape', success: true, pending: true, escapee: escapee.name, skill, dc };
    }
    const rolled = await rollSystemEscape(escapee.kind, escapee.id, skill, dc);
    if (rolled.success) {
      await removeCondition(escapee.kind, escapee.id, 'grappled').catch(() => null);
    }
    return { type: 'escape', success: true, escaped: rolled.success, escapee: escapee.name, skill, dc, die: rolled.die, total: rolled.total };
  } catch (e) {
    console.error('[conditionService] ESCAPE handler failed:', e.message);
    return null;
  }
});

/** Shared attack gate (combat item 8): null when the attack may
 *  proceed, else a refusal reason. Covers incapacitation (no actions
 *  at all) and charmed-vs-charmer. Callers check this BEFORE any
 *  pending attack, budget spend, or reaction spend. */
export async function attackBlockedByConditions(attackerKind, attackerId, targetKind, targetId) {
  if (!attackerKind || !attackerId) return null;
  if (await hasIncapacitatingCondition(attackerKind, attackerId)) {
    return 'attacker is incapacitated and cannot take actions';
  }
  const charmer = await charmerFor(attackerKind, attackerId);
  if (charmer && targetKind && targetId != null &&
      charmer.kind === targetKind && Number(charmer.id) === Number(targetId)) {
    return `attacker is charmed by ${charmer.name || 'the target'} and cannot attack them`;
  }
  return null;
}

export default {
  CONDITION_KEYS, normalizeConditionKey, exhaustionLevel,
  exhaustionPenalty, exhaustionSpeedReduction,
  getConditions, addCondition, removeCondition, reduceExhaustion,
  findCompanionIdByName, getPartyConditions,
  conditionRollEffects, conditionDefenseEffects, conditionAttackEffects, mergeAdvantageState,
  // Family 6 (mechanics hooks): subclass save modifiers + condition immunities.
  subclassSaveEffects, SAVE_DISADVANTAGE_MARKS, saveDisadvantageFromMarks,
  targetSaveMarksActive, subclassSaveEffectsForActor, subclassConditionImmunity,
  // Combat item 8.
  INCAPACITATING_CONDITIONS, getConditionMeta, setConditionMeta, clearConditionMeta,
  hasIncapacitatingCondition, charmerFor, grapplerFor, resolveActorId,
  attackBlockedByConditions, pbForLevel, pbForCr, computeEscapeDc,
  rollSystemEscape, applyPendingEscape
};

