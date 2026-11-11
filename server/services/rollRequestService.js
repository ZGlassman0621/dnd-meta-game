/**
 * Roll Request Service — non-combat check mechanics for EVERY actor.
 *
 * Design: roll-request-design.md (decided with Zach, 2026-10-20).
 *
 * The problem this solves: skill modifiers and passive scores were computed
 * for the DM prompt and then never used — non-combat outcomes were pure
 * narration. Now the DM emits [ROLL_REQUEST], and:
 *
 *   - the PC rolls REAL dice and reports the number(s); the system applies
 *     the true sheet modifier, judges against the hidden DC, and records
 *     the outcome (pending state lives on dm_sessions.session_config);
 *   - companions, NPCs, and enemies roll SERVER-SIDE (they are DM-run);
 *   - nat 1 NEVER succeeds (complete failure + a consequence the DM must
 *     attach); nat 20 always succeeds (often miraculously — a bonus beyond
 *     the ask the DM must narrate). Crits judge the TAKEN die under
 *     advantage/disadvantage;
 *   - every resolution lands in roll_log (migration 080), permanently.
 *
 * Modifier math here is CANONICAL for checks. dmPromptBuilder.js carries
 * display copies of the same formulas (SKILL_ABILITY_MAP,
 * computeSkillModifiers) — the formulas are identical by construction
 * (verified 2026-10-20); if you change one, change both.
 */
import { dbGet, dbRun, dbAll } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { rollD20, roll } from '../utils/rng.js';
import { lookupBestiary } from './bestiaryService.js';
import { ensureCompanionSheet, isFlatSheet } from './companionSheetService.js';
import { findProfessionByKey, professionCompetence } from '../data/professions.js';
import { getConditions, findCompanionIdByName, conditionRollEffects, mergeAdvantageState, normalizeConditionKey, subclassSaveEffectsForActor } from './conditionService.js';
import { getEntry, setField, clearField } from './actionStateService.js'; // Help for ability checks (audit item 2)
import { ledgerKeyForPlayer, ledgerKeyForCompanion } from './turnLedgerService.js';
import { erodeScores } from './coldExposureService.js'; // Frost Exhaustion erodes scores at this one math site

// ---------------------------------------------------------------------------
// Sheet math
// ---------------------------------------------------------------------------

export const SKILL_ABILITY_MAP = {
  'Acrobatics': 'dex', 'Animal Handling': 'wis', 'Arcana': 'int',
  'Athletics': 'str', 'Deception': 'cha', 'History': 'int',
  'Insight': 'wis', 'Intimidation': 'cha', 'Investigation': 'int',
  'Medicine': 'wis', 'Nature': 'int', 'Perception': 'wis',
  'Performance': 'cha', 'Persuasion': 'cha', 'Religion': 'int',
  'Sleight of Hand': 'dex', 'Stealth': 'dex', 'Survival': 'wis'
};

const ABILITY_KEYS = {
  strength: 'str', str: 'str', dexterity: 'dex', dex: 'dex',
  constitution: 'con', con: 'con', intelligence: 'int', int: 'int',
  wisdom: 'wis', wis: 'wis', charisma: 'cha', cha: 'cha'
};

// Canonical 5e class saving-throw proficiencies. Characters store no save
// proficiencies anywhere (verified 2026-10-20), so class defaults rule.
const CLASS_SAVE_PROFICIENCIES = {
  artificer: ['con', 'int'], barbarian: ['str', 'con'], bard: ['dex', 'cha'],
  cleric: ['wis', 'cha'], druid: ['int', 'wis'], fighter: ['str', 'con'],
  monk: ['str', 'dex'], paladin: ['wis', 'cha'], ranger: ['str', 'dex'],
  rogue: ['dex', 'int'], sorcerer: ['con', 'cha'], warlock: ['wis', 'cha'],
  wizard: ['int', 'wis']
};

export function proficiencyBonus(level) {
  return Math.floor(((level || 1) - 1) / 4) + 2;
}

/** Save proficiencies for a class (exported for concentrationService's
 *  companion concentration checks, combat-real B4). */
export function classSaveProficiencies(className) {
  return CLASS_SAVE_PROFICIENCIES[String(className || '').toLowerCase().trim()] || [];
}

export function abilityModifier(score) {
  return Math.floor((((score ?? 10)) - 10) / 2);
}

function abilityKeyFromName(name) {
  if (!name) return null;
  return ABILITY_KEYS[String(name).trim().toLowerCase()] || null;
}

function canonicalSkill(name) {
  if (!name) return null;
  const lower = String(name).trim().toLowerCase();
  return Object.keys(SKILL_ABILITY_MAP).find(s => s.toLowerCase() === lower) || null;
}

/**
 * The PC's modifier for a check, from the real sheet.
 * kind: 'skill' | 'ability' | 'save'. Returns null for an unknown check.
 */
export function computePcModifier(character, kind, name) {
  // Frost Exhaustion (coldExposureService): erode scores before any
  // modifier math, so checks/saves erode exactly like combat does.
  const abilities = erodeScores(safeParse(character.ability_scores, {}), character.frost_exhaustion ?? character.frostExhaustion ?? 0);
  const level = character.level || 1;
  const pb = proficiencyBonus(level);

  if (kind === 'skill') {
    const skill = canonicalSkill(name);
    if (!skill) return null;
    const ability = SKILL_ABILITY_MAP[skill];
    const skills = safeParse(character.skills, []);
    const proficient = Array.isArray(skills) &&
      skills.some(s => String(s).toLowerCase() === skill.toLowerCase());
    return { modifier: abilityModifier(abilities[ability]) + (proficient ? pb : 0), ability, proficient };
  }

  const key = abilityKeyFromName(name);
  if (!key) return null;
  if (kind === 'save') {
    const saves = CLASS_SAVE_PROFICIENCIES[(character.class || '').toLowerCase()] || [];
    const proficient = saves.includes(key);
    return { modifier: abilityModifier(abilities[key]) + (proficient ? pb : 0), ability: key, proficient };
  }
  return { modifier: abilityModifier(abilities[key]), ability: key, proficient: false };
}

export async function getPcCheckModifier(characterId, kind, name) {
  const character = await dbGet(
    'SELECT ability_scores, skills, level, class, frost_exhaustion FROM characters WHERE id = ?', [characterId]
  );
  if (!character) return null;
  return computePcModifier(character, kind, name);
}

/** Passive score for a check (10 + modifier) — the silent floor. */
export async function getPcPassive(characterId, skillName) {
  const mod = await getPcCheckModifier(characterId, 'skill', skillName);
  if (!mod) return null;
  return 10 + mod.modifier;
}

// ---------------------------------------------------------------------------
// Non-PC actor modifiers
// ---------------------------------------------------------------------------

/** Generic-competence default scaled by challenge rating. */
export function crScaledModifier(cr) {
  const v = typeof cr === 'string' && cr.includes('/')
    ? (parseFloat(cr.split('/')[0]) / parseFloat(cr.split('/')[1]))
    : parseFloat(cr);
  if (!Number.isFinite(v) || v <= 1) return 2;
  if (v <= 4) return 3;
  if (v <= 8) return 4;
  if (v <= 12) return 5;
  return 6;
}

/**
 * Modifier for a companion / NPC / enemy. Class-based companions use
 * their real sheet (the same math as the PC); npc_stats companions use
 * their stat block's CR; bestiary actors use their real DEX modifier for
 * DEX-governed checks; everything else falls back to a CR-scaled generic
 * competence. Returns { modifier, actorType }.
 */
export async function getNpcCheckModifier(actorName, kind, name, characterId = null) {
  let actorType = 'npc';
  let entry = null;
  try { entry = await lookupBestiary(actorName); } catch { entry = null; }
  if (entry) actorType = 'enemy';

  // Is this actor one of the PC's active companions? Class-based companions
  // roll from their REAL sheet — the same math as the PC (computePcModifier).
  if (characterId) {
    try {
      const comp = await dbGet(
        `SELECT c.id, c.progression_type, c.companion_ability_scores, c.skill_proficiencies,
                c.companion_level, c.companion_class, c.original_stats_snapshot, c.frost_exhaustion, n.cr AS npc_cr
         FROM companions c JOIN npcs n ON c.npc_id = n.id
         WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?)`,
        [characterId, actorName]
      );
      if (comp) {
        if (comp.progression_type === 'class_based') {
          // Lazy backfill: a flat/absent sheet generates on first roll —
          // the same next-appearance pattern as NPC complexity tiers.
          let scoresJson = comp.companion_ability_scores;
          let skillsJson = comp.skill_proficiencies;
          const scoresObj = safeParse(scoresJson, null);
          const skillsArr = safeParse(skillsJson, []) || [];
          if (!scoresObj || (isFlatSheet(scoresObj) && skillsArr.length === 0)) {
            const ensured = await ensureCompanionSheet(comp.id);
            if (ensured) {
              scoresJson = JSON.stringify(ensured.abilityScores);
              skillsJson = JSON.stringify(ensured.skills);
            }
          }
          const mod = computePcModifier(
            { ability_scores: scoresJson, skills: skillsJson, level: comp.companion_level || 1, class: comp.companion_class, frost_exhaustion: comp.frost_exhaustion }, 
            kind, name
          );
          if (mod) return { modifier: mod.modifier, actorType: 'companion' };
        }
        // npc_stats companions keep their stat block: CR-scaled competence.
        const snap = safeParse(comp.original_stats_snapshot, null);
        return { modifier: crScaledModifier(snap?.cr ?? comp.npc_cr), actorType: 'companion' };
      }
    } catch { /* companion detection is best-effort */ }
  }

  let ability = null;
  if (kind === 'skill') {
    const skill = canonicalSkill(name);
    ability = skill ? SKILL_ABILITY_MAP[skill] : null;
  } else {
    ability = abilityKeyFromName(name);
  }

  // Profession competence (DM System, 2026-10-21): a named NPC with a
  // trade rolls trade-covered checks from their profession + mastery —
  // the master blacksmith's Athletics is expertise, not a CR default.
  // Trades never cover saving throws. Falls through when the trade
  // doesn't cover the check. Name-matched like the bestiary lookup;
  // when several NPCs share a name, the earliest-created wins.
  try {
    const npcRow = await dbGet(
      'SELECT profession_key, mastery_tier FROM npcs WHERE LOWER(name) = LOWER(?) ORDER BY id LIMIT 1',
      [actorName]
    );
    if (npcRow?.profession_key) {
      const entry = findProfessionByKey(npcRow.profession_key);
      const checkName = kind === 'skill' ? canonicalSkill(name) : ability;
      const profMod = professionCompetence(entry, npcRow.mastery_tier, kind, checkName, SKILL_ABILITY_MAP);
      if (profMod != null) return { modifier: profMod, actorType: 'npc' };
    }
  } catch { /* profession lookup is best-effort */ }

  if (entry && ability === 'dex' && Number.isFinite(entry.dex_mod)) {
    return { modifier: entry.dex_mod, actorType };
  }
  return { modifier: crScaledModifier(entry?.challenge_rating), actorType };
}

// ---------------------------------------------------------------------------
// Resolution — pure, so the rules are testable without a database
// ---------------------------------------------------------------------------

/**
 * Judge a set of d20s. Crits judge the TAKEN die: nat 1 never succeeds,
 * nat 20 always succeeds, regardless of modifier or DC (Zach, 2026-10-20).
 */
export function resolveDice({ dice, modifier, dc, advantage = null }) {
  const taken = advantage === 'advantage'
    ? Math.max(...dice)
    : advantage === 'disadvantage'
      ? Math.min(...dice)
      : dice[0];
  const total = taken + modifier;
  let outcome;
  if (taken === 1) outcome = 'critical_failure';
  else if (taken === 20) outcome = 'critical_success';
  else outcome = total >= dc ? 'success' : 'failure';
  return { takenDie: taken, total, outcome };
}

// ---------------------------------------------------------------------------
// Family 6 / D4 — Heroic Inspiration (2024 PHB). One instance at a time
// (max 1): gained on finishing a Long Rest (Human Resourceful; the
// pools family owns the rest grant — this file owns the SPEND), spent
// to reroll a d20 Test, once per roll, and the new roll stands even
// if it is lower ("must use the new roll").
//
// Storage: class_resources_json.used.heroicInspiration (0 = held,
// 1 = spent), the same used-count shape as Rage / Bardic. The read /
// write here is RAW-preserving on purpose: classFeatureService.
// parseClassResources strips every top-level key except used / raging
// / bardicHeld, so routing this spend through spendResource would
// wipe .artificer state (see resetResourcesForRest's own raw parse
// for the same reason). When the pools family registers the
// heroicInspiration maxima it must preserve top-level keys the same
// way; until then this direct write is the spend path.
// ---------------------------------------------------------------------------

export const HEROIC_INSPIRATION_MAX = 1;
export const HEROIC_INSPIRATION_KEY = 'heroicInspiration';

async function readHeroicUsed(kind, id) {
  const table = kind === 'player' ? 'characters' : kind === 'companion' ? 'companions' : null;
  if (!table || !id) return null;
  const row = await dbGet(`SELECT class_resources_json FROM ${table} WHERE id = ?`, [id]);
  if (!row) return null;
  const raw = safeParse(row.class_resources_json, {}) || {};
  const used = (raw.used && typeof raw.used === 'object') ? raw.used : {};
  return { raw, used: Number(used[HEROIC_INSPIRATION_KEY] || 0) };
}

async function writeHeroicUsed(kind, id, raw, usedCount) {
  const table = kind === 'player' ? 'characters' : 'companions';
  const next = { ...raw, used: { ...(raw.used || {}), [HEROIC_INSPIRATION_KEY]: usedCount } };
  await dbRun(`UPDATE ${table} SET class_resources_json = ? WHERE id = ?`, [JSON.stringify(next), id]);
  return next;
}

/** Does this actor currently hold Heroic Inspiration? */
export async function hasHeroicInspiration(kind, id) {
  try {
    const got = await readHeroicUsed(kind, id);
    if (!got) return { held: false, reason: 'unknown actor' };
    return { held: got.used < HEROIC_INSPIRATION_MAX, used: got.used, max: HEROIC_INSPIRATION_MAX };
  } catch { return { held: false, reason: 'lookup failed' }; }
}

/** Spend the held Heroic Inspiration (fail-closed when none is held). */
export async function spendHeroicInspiration(kind, id) {
  try {
    const got = await readHeroicUsed(kind, id);
    if (!got) return { success: false, reason: 'unknown actor' };
    if (got.used >= HEROIC_INSPIRATION_MAX) {
      return { success: false, reason: 'no Heroic Inspiration held', used: got.used, max: HEROIC_INSPIRATION_MAX };
    }
    await writeHeroicUsed(kind, id, got.raw, got.used + 1);
    return { success: true, used: got.used + 1, max: HEROIC_INSPIRATION_MAX };
  } catch (e) {
    return { success: false, reason: `spend failed: ${e.message}` };
  }
}

/**
 * Grant Heroic Inspiration (Heroic Warrior turn-start grant, Musician
 * feat, DM grant). Max 1: granting while one is already held is a
 * no-op success — the second instance is never stored.
 */
export async function grantHeroicInspiration(kind, id) {
  try {
    const got = await readHeroicUsed(kind, id);
    if (!got) return { success: false, reason: 'unknown actor' };
    if (got.used < HEROIC_INSPIRATION_MAX) return { success: true, alreadyHeld: true, used: got.used, max: HEROIC_INSPIRATION_MAX };
    await writeHeroicUsed(kind, id, got.raw, 0);
    return { success: true, used: 0, max: HEROIC_INSPIRATION_MAX };
  } catch (e) {
    return { success: false, reason: `grant failed: ${e.message}` };
  }
}

/**
 * Reroll the session's pending PC roll with Heroic Inspiration: spends
 * the pool, then re-issues the SAME pending roll (same check, DC,
 * modifier, advantage state) marked as a reroll. The player rolls
 * again; resolveReportedRoll resolves it and the new roll stands even
 * if lower. One reroll per roll: a pending already marked as a reroll
 * is refused. The previous outcome (if the caller has it) rides on
 * pending.rerollFrom for the record.
 */
export async function requestHeroicReroll(sessionId, previousOutcome = null) {
  const pending = await getPendingRoll(sessionId);
  if (!pending) return { success: false, reason: 'no roll pending' };
  if (pending.reroll) return { success: false, reason: 'this roll was already rerolled — one Heroic Inspiration reroll per roll' };
  const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  const spent = await spendHeroicInspiration('player', session?.character_id);
  if (!spent.success) return { success: false, reason: spent.reason };
  const cfg = await readSessionConfig(sessionId);
  cfg.pendingRoll = {
    ...pending,
    reroll: HEROIC_INSPIRATION_KEY,
    rerollFrom: previousOutcome || null,
    advantageReason: [pending.advantageReason, 'Heroic Inspiration reroll — roll again; the new roll stands even if lower'].filter(Boolean).join('; '),
  };
  await writeSessionConfig(sessionId, cfg);
  return { success: true, pending: cfg.pendingRoll };
}

export async function logRoll(row) {
  const r = await dbRun(
    `INSERT INTO roll_log
       (session_id, campaign_id, character_id, actor_type, actor_name,
        check_kind, check_name, dc, modifier, dice_json, taken_die, total,
        outcome, source, context)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [row.sessionId ?? null, row.campaignId ?? null, row.characterId ?? null,
     row.actorType, row.actorName ?? null, row.checkKind, row.checkName,
     row.dc ?? null, row.modifier, row.dice ? JSON.stringify(row.dice) : null,
     row.takenDie ?? null, row.total ?? null, row.outcome, row.source,
     row.context ?? null]
  );
  return Number(r.lastInsertRowid);
}

// ---------------------------------------------------------------------------
// Pending PC rolls (session_config)
// ---------------------------------------------------------------------------

async function readSessionConfig(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return safeParse(s?.session_config, {});
}

async function writeSessionConfig(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?',
    [JSON.stringify(cfg), sessionId]);
}

export async function getPendingRoll(sessionId) {
  const cfg = await readSessionConfig(sessionId);
  return cfg.pendingRoll || null;
}

/** Create the pending roll for a PC [ROLL_REQUEST]. One at a time — a new
 *  request replaces an unresolved one (the DM re-asked; the fiction moved). */
export async function requestPcRoll({ sessionId, characterId, kind, name, dc, looks, advantage = null, advantageReason = null }) {
  const mod = await getPcCheckModifier(characterId, kind, name);
  if (!mod) return { success: false, reason: `unknown ${kind}: ${name}` };
  // Conditions: poisoned / frightened impose disadvantage (merged with
  // any marker-declared state under 5e algebra); 2024 exhaustion
  // imposes a -2/level penalty, stored on the pending and folded into
  // the total at resolution.
  let effAdvantage = advantage;
  let effReason = advantageReason;
  let penalty = 0;
  try {
    const fx = conditionRollEffects(await getConditions('player', characterId), kind, name);
    if (fx.disadvantage) {
      effAdvantage = mergeAdvantageState(advantage, 'disadvantage');
    }
    if (fx.disadvantage || fx.penalty) {
      effReason = [advantageReason, `condition: ${fx.reasons.join(', ')}`].filter(Boolean).join('; ');
    }
    penalty = fx.penalty || 0;
  } catch { /* conditions are best-effort; the roll itself must not fail */ }
  // Family 6: subclass save modifiers join as an additional input beside
  // conditions (same call sites, same algebra). Advantage merges with
  // the condition/marker state; a flat bonus is stored on the pending
  // and folded into the total at resolution like the exhaustion
  // penalty; bonus dice (Supernatural Defense 1d6) cannot be rolled by
  // the system for a PC — the player reports d20s only — so the
  // pending states the die for the DM to apply at judgment (see
  // NOTES.md). isSpellSave is false here: a ROLL_REQUEST save does not
  // say what caused it, so Spell Resistance correctly does not fire.
  let subclassBonus = 0;
  let subclassBonusDice = null;
  if (kind === 'save') {
    try {
      const charRow = await dbGet('SELECT level FROM characters WHERE id = ?', [characterId]);
      const sub = await subclassSaveEffectsForActor('player', characterId, {
        kind, name, isSpellSave: false, saveVsCondition: null,
        saveProficient: mod.proficient, level: Number(charRow?.level || 1),
      });
      if (sub.advantage) {
        effAdvantage = mergeAdvantageState(effAdvantage, 'advantage');
      }
      subclassBonus = sub.bonus || 0;
      if (sub.advantage || subclassBonus) {
        effReason = [effReason, `subclass: ${sub.reasons.join(', ')}`].filter(Boolean).join('; ');
      }
      if (sub.bonusDice) {
        subclassBonusDice = sub.bonusDice;
        effReason = [effReason, `${sub.bonusDice.source}: roll 1d6 and add it to the save total (DM applies it — the player reports d20s only)`].filter(Boolean).join('; ');
      }
    } catch { /* subclass effects are best-effort; the roll itself must not fail */ }
  }
  const pending = {
    kind, name, dc, looks: looks || null,
    advantage: effAdvantage, advantageReason: effReason,
    modifier: mod.modifier, proficient: mod.proficient,
    penalty, subclassBonus, subclassBonusDice,
    requestedAt: new Date().toISOString()
  };
  const cfg = await readSessionConfig(sessionId);
  cfg.pendingRoll = pending;
  // Item 6: a new roll request supersedes any pending spell effect
  // waiting on an older roll (one pending save at a time). The
  // superseded effect's slot is cleared here; postPendingSave writes
  // its own slot after this returns, so ordering is safe.
  delete cfg.pendingEnemySpellEffect;
  delete cfg.pendingRetaliation;
  delete cfg.pendingCounteredCast;
  delete cfg.pendingBacklashReduction;
  // Combat item 7: a pending trap save is a fifth single-slot effect.
  delete cfg.pendingTrapSave;
  // Combat item 8 / display casting: pending escapes and display
  // placements are further single-slot effects, cleared the same way.
  delete cfg.pendingEscape;
  delete cfg.pendingDisplay;
  await writeSessionConfig(sessionId, cfg);
  return { success: true, pending };
}

/** Resolve a PC roll from the player's reported dice. Returns null when
 *  no roll is pending. */
export async function resolveReportedRoll(sessionId, dice) {
  const pending = await getPendingRoll(sessionId);
  if (!pending) return null;
  const session = await dbGet('SELECT character_id FROM dm_sessions WHERE id = ?', [sessionId]);
  const character = session?.character_id
    ? await dbGet('SELECT name, campaign_id FROM characters WHERE id = ?', [session.character_id])
    : null;

  // 2024 exhaustion: the stored penalty folds into the total; the log
  // records the effective modifier so total = takenDie + modifier holds.
  // Family 6: the stored subclass bonus folds in the same way.
  const penalty = pending.penalty || 0;
  const subclassBonus = pending.subclassBonus || 0;
  const res = resolveDice({ dice, modifier: pending.modifier + penalty + subclassBonus, dc: pending.dc, advantage: pending.advantage });
  const rollId = await logRoll({
    sessionId, campaignId: character?.campaign_id ?? null,
    characterId: session?.character_id ?? null,
    actorType: 'pc', actorName: character?.name ?? 'Player',
    checkKind: pending.kind, checkName: pending.name, dc: pending.dc,
    modifier: pending.modifier + penalty + subclassBonus, dice, takenDie: res.takenDie,
    total: res.total, outcome: res.outcome, source: 'reported',
    context: pending.advantageReason || pending.looks || null
  });

  const cfg = await readSessionConfig(sessionId);
  delete cfg.pendingRoll;
  await writeSessionConfig(sessionId, cfg);

  // D4: tell the caller whether a Heroic Inspiration reroll is
  // available for this roll (spending it is requestHeroicReroll's job).
  let heroicInspiration = { available: false };
  try {
    const held = await hasHeroicInspiration('player', session?.character_id);
    heroicInspiration = { available: !!held.held };
  } catch { /* best-effort — the resolved roll stands either way */ }

  return { rollId, check: pending.name, kind: pending.kind, dc: pending.dc,
           modifier: pending.modifier, penalty, subclassBonus, dice, ...res,
           ...(pending.reroll ? { rerolledFrom: pending.rerollFrom || null, reroll: pending.reroll } : {}),
           heroicInspiration };
}

// ---------------------------------------------------------------------------
// Server-side rolls (companions / NPCs / enemies)
// ---------------------------------------------------------------------------

export async function rollForNpc({ sessionId = null, characterId = null, actorName, kind, name, dc, advantage = null, context = null, hearing = false, rerollWithHeroic = false }) {
  const modInfo = await getNpcCheckModifier(actorName, kind, name, characterId);
  // Conditions (v1.0.190): companions carry durable conditions like the
  // PC. Auto-fail saves short-circuit — no roll is possible — and
  // condition disadvantage merges with any marker-declared state.
  let effAdvantage = advantage;
  let penalty = 0;
  // Family 6: subclass save bonus / bonus dice for class-based
  // companions (server-rolled, so the dice are real math here).
  let subBonus = 0;
  let subBonusDiceTotal = 0;
  let subReasons = [];
  const rollSubBonusDice = (bonusDice) => {
    if (!bonusDice) return 0;
    try { return roll(bonusDice.sides, bonusDice.count, { reason: bonusDice.source }).total; } catch { return 0; }
  };
  let subBonusDice = null;
  if (modInfo.actorType === 'companion' && characterId) {
    try {
      const compId = await findCompanionIdByName(characterId, actorName);
      if (compId) {
        const compConds = await getConditions('companion', compId);
        // Combat item 8: a deafened companion auto-fails hearing
        // checks, like the PC branch of the ROLL_REQUEST handler.
        if (hearing && compConds.map((c) => normalizeConditionKey(c)).includes('deafened')) {
          const charRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
          const rollId = await logRoll({
            sessionId, campaignId: charRow?.campaign_id ?? null, characterId,
            actorType: modInfo.actorType, actorName,
            checkKind: kind, checkName: name, dc, modifier: modInfo.modifier,
            dice: null, takenDie: null, total: null, outcome: 'failure',
            source: 'auto', context: 'auto-fail: deafened (hearing check)'
          });
          return { rollId, actor: actorName, actorType: modInfo.actorType, check: name,
                   kind, dc, modifier: modInfo.modifier, dice: null, takenDie: null,
                   total: null, outcome: 'failure', autoFail: true, conditions: ['deafened'] };
        }
        const fx = conditionRollEffects(compConds, kind, name);
        if (fx.autoFail) {
          const charRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]);
          const rollId = await logRoll({
            sessionId, campaignId: charRow?.campaign_id ?? null, characterId,
            actorType: modInfo.actorType, actorName,
            checkKind: kind, checkName: name, dc, modifier: modInfo.modifier,
            dice: null, takenDie: null, total: null, outcome: 'failure',
            source: 'auto', context: `auto-fail: ${fx.reasons.join(', ')}`
          });
          return { rollId, actor: actorName, actorType: modInfo.actorType, check: name,
                   kind, dc, modifier: modInfo.modifier, dice: null, takenDie: null,
                   total: null, outcome: 'failure', autoFail: true, conditions: fx.reasons };
        }
        if (fx.disadvantage) effAdvantage = mergeAdvantageState(advantage, 'disadvantage');
        penalty = fx.penalty || 0;
        // Family 6: subclass save modifiers for the companion, beside
        // the condition effects above (same algebra). Auto-fail already
        // returned above, so these can never resurrect an impossible roll.
        if (kind === 'save') {
          try {
            const compRow = await dbGet('SELECT companion_class, companion_level FROM companions WHERE id = ?', [compId]);
            const abilityKey = abilityKeyFromName(name);
            const saves = CLASS_SAVE_PROFICIENCIES[(compRow?.companion_class || '').toLowerCase()] || [];
            const sub = await subclassSaveEffectsForActor('companion', compId, {
              kind, name, isSpellSave: false, saveVsCondition: null,
              saveProficient: abilityKey ? saves.includes(abilityKey) : false,
              level: Number(compRow?.companion_level || 1),
            });
            if (sub.advantage) effAdvantage = mergeAdvantageState(effAdvantage, 'advantage');
            subBonus = sub.bonus || 0;
            subBonusDice = sub.bonusDice || null;
            subReasons = sub.reasons || [];
            if (subBonusDice) subBonusDiceTotal = rollSubBonusDice(subBonusDice);
          } catch { /* subclass effects are best-effort */ }
        }
      }
    } catch { /* conditions are best-effort */ }
  }
  // Combat item 8: a deafened enemy auto-fails hearing checks too.
  // Resolve from the LIVE encounter, not from the bestiary-derived
  // actorType: combat mooks carry DM-given names (GobA, ...) that
  // never match a bestiary key, so gating on actorType === 'enemy'
  // silently skipped every such enemy (item-8 gate run 2).
  // Best-effort: an unresolvable enemy falls through to a normal roll.
  if (hearing && sessionId) {
    try {
      const { getCurrentEncounterSeq, findActiveEnemy } = await import('./enemyCombatService.js');
      const seq = await getCurrentEncounterSeq(sessionId);
      const enemy = seq ? await findActiveEnemy(sessionId, seq, actorName) : null;
      if (enemy) {
        const enemyConds = await getConditions('enemy', enemy.id);
        if (enemyConds.map((c) => normalizeConditionKey(c)).includes('deafened')) {
          const charRow = characterId ? await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId]) : null;
          const rollId = await logRoll({
            sessionId, campaignId: charRow?.campaign_id ?? null, characterId,
            actorType: modInfo.actorType, actorName,
            checkKind: kind, checkName: name, dc, modifier: modInfo.modifier,
            dice: null, takenDie: null, total: null, outcome: 'failure',
            source: 'auto', context: 'auto-fail: deafened (hearing check)'
          });
          return { rollId, actor: actorName, actorType: modInfo.actorType, check: name,
                   kind, dc, modifier: modInfo.modifier, dice: null, takenDie: null,
                   total: null, outcome: 'failure', autoFail: true, conditions: ['deafened'] };
        }
      }
    } catch { /* best-effort; fall through to the normal roll */ }
  }
  let dice = effAdvantage ? [rollD20(`roll-request:${actorName}`), rollD20(`roll-request:${actorName}`)]
                          : [rollD20(`roll-request:${actorName}`)];
  let res = resolveDice({ dice, modifier: modInfo.modifier + penalty + subBonus + subBonusDiceTotal, dc, advantage: effAdvantage });
  const character = characterId
    ? await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [characterId])
    : null;
  let rollId = await logRoll({
    sessionId, campaignId: character?.campaign_id ?? null, characterId,
    actorType: modInfo.actorType, actorName,
    checkKind: kind, checkName: name, dc, modifier: modInfo.modifier + penalty + subBonus + subBonusDiceTotal,
    dice, takenDie: res.takenDie, total: res.total, outcome: res.outcome,
    source: 'server', context
  });
  // D4: Heroic Inspiration reroll for a server-rolled companion. The
  // pool spends first (fail-closed: no pool, no reroll); the new roll
  // stands even if lower, and the first roll stays in roll_log as
  // history. One reroll per roll — the spend enforces it (max 1).
  let firstRoll = null;
  if (rerollWithHeroic && modInfo.actorType === 'companion' && characterId) {
    try {
      const compId = await findCompanionIdByName(characterId, actorName);
      if (compId) {
        const spent = await spendHeroicInspiration('companion', compId);
        if (spent.success) {
          const dice2 = effAdvantage ? [rollD20(`roll-request:${actorName}`), rollD20(`roll-request:${actorName}`)]
                                     : [rollD20(`roll-request:${actorName}`)];
          const bonusDice2 = rollSubBonusDice(subBonusDice);
          const res2 = resolveDice({ dice: dice2, modifier: modInfo.modifier + penalty + subBonus + bonusDice2, dc, advantage: effAdvantage });
          const rollId2 = await logRoll({
            sessionId, campaignId: character?.campaign_id ?? null, characterId,
            actorType: modInfo.actorType, actorName,
            checkKind: kind, checkName: name, dc, modifier: modInfo.modifier + penalty + subBonus + bonusDice2,
            dice: dice2, takenDie: res2.takenDie, total: res2.total, outcome: res2.outcome,
            source: 'server', context: [context, 'Heroic Inspiration reroll — the new roll stands'].filter(Boolean).join('; ')
          });
          firstRoll = { rollId, dice, takenDie: res.takenDie, total: res.total, outcome: res.outcome };
          dice = dice2; res = res2; rollId = rollId2; subBonusDiceTotal = bonusDice2;
        }
      }
    } catch { /* a failed reroll leaves the first roll standing */ }
  }
  return { rollId, actor: actorName, actorType: modInfo.actorType, check: name,
           kind, dc, modifier: modInfo.modifier, penalty, subclassBonus: subBonus,
           subclassBonusDice: subBonusDiceTotal || null, subclassReasons: subReasons,
           dice, ...res, ...(firstRoll ? { rerolled: true, firstRoll } : {}) };
}

/** Silent passive check for the PC (sleeping, unaware): no dice, no crits —
 *  the passive score meets the DC or it doesn't. Logged either way. */
export async function checkPassive({ sessionId = null, characterId, skillName, dc, context = null }) {
  const mod = await getPcCheckModifier(characterId, 'skill', skillName);
  if (!mod) return null;
  const passive = 10 + mod.modifier;
  const outcome = passive >= dc ? 'passive_success' : 'passive_failure';
  const character = await dbGet('SELECT name, campaign_id FROM characters WHERE id = ?', [characterId]);
  const rollId = await logRoll({
    sessionId, campaignId: character?.campaign_id ?? null, characterId,
    actorType: 'pc', actorName: character?.name ?? 'Player',
    checkKind: 'passive', checkName: skillName, dc, modifier: mod.modifier,
    dice: null, takenDie: null, total: passive, outcome, source: 'passive', context
  });
  return { rollId, passive, dc, outcome, check: skillName };
}

// ---------------------------------------------------------------------------
// Outcome text for the DM (injected as a system fact next turn)
// ---------------------------------------------------------------------------

export function formatRollOutcomeBlock(o) {
  if (!o) return '';
  if (o.autoFail) {
    return `\n\n══════════════ ROLL RESULT (system — this outcome is fact) ══════════════\n` +
      `${o.actor ? `${o.actor} — ` : ''}${o.check} ${o.kind}: AUTO-FAIL — ${(o.conditions || []).join(', ')} makes success impossible; no roll was made. FAILURE — narrate it not working; the fiction moves on with that fact.\n` +
      `═══════════════════════════════════════════════════════════════════════\n`;
  }
  const modStr = o.modifier >= 0 ? `+${o.modifier}` : `${o.modifier}`;
  const penStr = o.penalty ? ` ${o.penalty}` : '';
  const diceStr = Array.isArray(o.dice) ? o.dice.join(', ') : o.dice;
  let verdict;
  switch (o.outcome) {
    case 'critical_success':
      verdict = 'CRITICAL SUCCESS (natural 20) — it works, and something beyond the ask goes right: narrate a miraculous bonus.';
      break;
    case 'critical_failure':
      verdict = 'CRITICAL FAILURE (natural 1) — it fails completely: attach a real consequence (often comical) and narrate it.';
      break;
    case 'success':
      verdict = 'SUCCESS — narrate it working.';
      break;
    default:
      verdict = 'FAILURE — narrate it not working; the fiction moves on with that fact.';
  }
  return `\n\n══════════════ ROLL RESULT (system — this outcome is fact) ══════════════\n` +
    `${o.actor ? `${o.actor} — ` : ''}${o.check} check: rolled [${diceStr}] → ${o.takenDie} ${modStr}${penStr} = ${o.total} vs DC ${o.dc}.\n${verdict}\n` +
    `═══════════════════════════════════════════════════════════════════════\n`;
}

// ---------------------------------------------------------------------------
// Marker handler
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Help for ability checks (Tier 3 follow-up, audit item 2): the
// working-together rule, mechanized. HELP_CHECK stores one pending
// help per ally (latest wins) under the ally's ledger key, in the
// same action-state home as combat Help (actionStateService — its
// session_config fallback covers checks outside combat, where no
// turn-state row exists). A stored help grants advantage on the
// ally's next MATCHING ability check and is spent on that roll,
// whether the final mode cancels to straight or not. It never
// applies to saving throws (the book's Help is for ability checks
// only), never matches a different check (an unrelated check
// neither uses nor spends it), and is never spent on an auto-fail
// (no roll happened). Helper and ally must both be party members
// (PC/companions); NPC allies are a later extension. HELP_CHECK is
// NOT turn-gated: working together is not the combat Help action.
// ---------------------------------------------------------------------------
async function currentCheckEncounter(sessionId) {
  try {
    const { getCurrentEncounterSeq } = await import('./enemyCombatService.js');
    return (await getCurrentEncounterSeq(sessionId)) || 0;
  } catch { return 0; }
}

export async function resolveCheckParty(context, rawName) {
  const wanted = String(rawName || '').trim();
  if (!wanted) return null;
  const character = context.characterId
    ? await dbGet('SELECT id, name FROM characters WHERE id = ?', [context.characterId])
    : null;
  if (character && (/^(player|pc|character)$/i.test(wanted) || wanted.toLowerCase() === character.name.toLowerCase())) {
    return { kind: 'player', id: character.id, key: await ledgerKeyForPlayer(character.id), name: character.name };
  }
  const comp = await dbGet(
    `SELECT c.id, c.npc_id, n.name FROM companions c JOIN npcs n ON c.npc_id = n.id
     WHERE c.recruited_by_character_id = ? AND c.status = 'active' AND LOWER(n.name) = LOWER(?) LIMIT 1`,
    [context.characterId, wanted]);
  if (comp) return { kind: 'companion', id: comp.id, key: await ledgerKeyForCompanion(comp), name: comp.name };
  return null;
}

async function consumeCheckHelp(context, actor, isPc, kind, name) {
  if (kind === 'save') return null;
  try {
    let allyKey = null;
    if (isPc) {
      allyKey = await ledgerKeyForPlayer(context.characterId);
    } else {
      const compId = await findCompanionIdByName(context.characterId, actor);
      if (!compId) return null;
      const row = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [compId]);
      if (!row) return null;
      allyKey = await ledgerKeyForCompanion({ id: compId, npc_id: row.npc_id });
    }
    const enc = await currentCheckEncounter(context.sessionId);
    const entry = await getEntry(context.sessionId, enc, allyKey);
    const stored = entry.checkHelp;
    if (!stored) return null;
    if (stored.scope && (stored.scope.kind !== kind || stored.scope.name !== String(name).trim().toLowerCase())) return null;
    await clearField(context.sessionId, enc, allyKey, 'checkHelp');
    return { reason: `Help from ${stored.helperName || 'an ally'}` };
  } catch { return null; }
}

// Dodge + Dexterity saves (audit item 5): a dodging creature rolls
// DEX saves with advantage. Read-only — Dodge lasts until the
// dodger's next turn no matter how many saves they make, unlike
// Help/Hidden which are consumed. Combat-only: no live encounter,
// no dodge. Saves only: a Dexterity check is not a save.
async function dodgeAdvantage(context, actor, isPc, kind, name) {
  if (kind !== 'save') return null;
  if (!['dexterity', 'dex'].includes(String(name).trim().toLowerCase())) return null;
  try {
    const enc = await currentCheckEncounter(context.sessionId);
    if (!enc) return null;
    let key = null;
    if (isPc) {
      key = await ledgerKeyForPlayer(context.characterId);
    } else {
      const party = await resolveCheckParty(context, actor);
      if (party) key = party.key;
      else {
        const { findActiveEnemy } = await import('./enemyCombatService.js');
        const { combatFallbackId } = await import('./worldIdService.js');
        const enemy = await findActiveEnemy(context.sessionId, enc, actor);
        if (!enemy) return null;
        key = combatFallbackId(context.sessionId, enc, enemy.id);
      }
    }
    const entry = await getEntry(context.sessionId, enc, key);
    return entry.dodge ? { reason: 'Dodging' } : null;
  } catch { return null; }
}

registerMarkerHandler('ROLL_REQUEST', async (parsed, context) => {
  if (!context?.sessionId) return null;
  try {
    const kind = parsed?.Skill ? 'skill' : parsed?.Save ? 'save' : parsed?.Ability ? 'ability' : null;
    const name = parsed?.Skill || parsed?.Save || parsed?.Ability || null;
    const dc = Number(parsed?.DC);
    if (!kind || !name || !Number.isFinite(dc)) {
      return { type: 'roll_request', success: false, reason: 'ROLL_REQUEST needs exactly one of Skill/Ability/Save and a numeric DC' };
    }
    const advantage = parsed?.Advantage ? 'advantage' : parsed?.Disadvantage ? 'disadvantage' : null;
    const advantageReason = parsed?.Advantage || parsed?.Disadvantage || null;
    const actor = (parsed?.Actor || 'Player').trim();

    // PC actors: the session character, addressed as Player/PC or by name.
    const character = context.characterId
      ? await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId])
      : null;
    const isPc = /^(player|pc|character)$/i.test(actor) ||
      (character && actor.toLowerCase() === character.name.toLowerCase());

    if (isPc) {
      // Conditions (v1.0.190): paralyzed / stunned / unconscious /
      // petrified auto-fail STR and DEX saves. No pending roll — there
      // are no dice for the player to report. The outcome is logged and
      // stashed like a server roll so the DM gets it as fact next turn.
      try {
        const pcFx = conditionRollEffects(await getConditions('player', context.characterId), kind, name);
        if (pcFx.autoFail) {
          const mod = await getPcCheckModifier(context.characterId, kind, name);
          if (!mod) return { type: 'roll_request', success: false, reason: `unknown ${kind}: ${name}` };
          const charRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [context.characterId]);
          const rollId = await logRoll({
            sessionId: context.sessionId, campaignId: charRow?.campaign_id ?? null,
            characterId: context.characterId,
            actorType: 'pc', actorName: character?.name ?? 'Player',
            checkKind: kind, checkName: name, dc,
            modifier: mod.modifier, dice: null, takenDie: null, total: null,
            outcome: 'failure', source: 'auto',
            context: `auto-fail: ${pcFx.reasons.join(', ')}`
          });
          const outcomeObj = { rollId, autoFail: true, actor: character?.name ?? 'Player',
            check: name, kind, dc, modifier: mod.modifier, conditions: pcFx.reasons, outcome: 'failure' };
          try {
            const cfg = await readSessionConfig(context.sessionId);
            const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
            cfg.recentRolls = [...prior, outcomeObj].slice(-5);
            await writeSessionConfig(context.sessionId, cfg);
          } catch { /* best-effort — the roll is still in roll_log */ }
          return { type: 'roll_request', success: true, pending: false, ...outcomeObj };
        }
      } catch { /* condition lookup is best-effort; fall through to the normal pending roll */ }
      // Combat item 8: a deafened PC auto-fails hearing-tagged
      // checks — no pending roll, no dice to report. Placed after
      // the save auto-fail above (same never-spends-help rule).
      if (parsed?.Hearing === true || ['true', 'yes', '1'].includes(String(parsed?.Hearing || '').toLowerCase().trim())) {
        try {
          const pcConds = await getConditions('player', context.characterId);
          if (pcConds.map((c) => normalizeConditionKey(c)).includes('deafened')) {
            const mod = await getPcCheckModifier(context.characterId, kind, name);
            if (!mod) return { type: 'roll_request', success: false, reason: `unknown ${kind}: ${name}` };
            const charRow = await dbGet('SELECT campaign_id FROM characters WHERE id = ?', [context.characterId]);
            const rollId = await logRoll({
              sessionId: context.sessionId, campaignId: charRow?.campaign_id ?? null,
              characterId: context.characterId,
              actorType: 'pc', actorName: character?.name ?? 'Player',
              checkKind: kind, checkName: name, dc,
              modifier: mod.modifier, dice: null, takenDie: null, total: null,
              outcome: 'failure', source: 'auto',
              context: 'auto-fail: deafened (hearing check)'
            });
            const outcomeObj = { rollId, autoFail: true, actor: character?.name ?? 'Player',
              check: name, kind, dc, modifier: mod.modifier, conditions: ['deafened'], outcome: 'failure' };
            try {
              const cfg = await readSessionConfig(context.sessionId);
              const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
              cfg.recentRolls = [...prior, outcomeObj].slice(-5);
              await writeSessionConfig(context.sessionId, cfg);
            } catch { /* best-effort — the roll is still in roll_log */ }
            return { type: 'roll_request', success: true, pending: false, ...outcomeObj };
          }
        } catch { /* condition lookup is best-effort; fall through */ }
      }
      // Help for ability checks: a stored HELP_CHECK grants
      // advantage here and is spent on this roll — placed AFTER
      // the auto-fail branch above, so a roll that never happens
      // never spends the help.
      let pcAdvantage = advantage;
      let pcAdvantageReason = advantageReason;
      if (kind !== 'save') {
        const help = await consumeCheckHelp(context, actor, true, kind, name);
        if (help) {
          pcAdvantage = mergeAdvantageState(advantage, 'advantage');
          pcAdvantageReason = [advantageReason, help.reason].filter(Boolean).join('; ');
        }
      }
      // Dodge + Dexterity saves: a dodging creature rolls DEX saves
      // with advantage — placed after auto-fail like Help, so a roll
      // that never happens never mentions dodging. Read-only: the
      // dodge flag is never consumed by a save.
      if (kind === 'save') {
        const dodge = await dodgeAdvantage(context, actor, true, kind, name);
        if (dodge) {
          pcAdvantage = mergeAdvantageState(pcAdvantage, 'advantage');
          pcAdvantageReason = [pcAdvantageReason, dodge.reason].filter(Boolean).join('; ');
        }
      }
      const r = await requestPcRoll({
        sessionId: context.sessionId, characterId: context.characterId,
        kind, name, dc, looks: parsed?.Looks || null, advantage: pcAdvantage, advantageReason: pcAdvantageReason
      });
      if (!r.success) return { type: 'roll_request', success: false, reason: r.reason };
      return { type: 'roll_request', success: true, pending: true, actor: 'Player',
               check: name, kind, modifier: r.pending.modifier, advantage: r.pending.advantage };
    }

    // Everyone else rolls server-side, immediately. The outcome is stashed
    // on session_config (recentRolls) so the route can surface it to the
    // DM as a system fact at the start of the next turn — the DM narrates
    // the attempt now and the result when the note arrives.
    // Help for ability checks, companion actors: the same
    // consume-on-the-roll rule (saves never match, so the auto-fail
    // path inside rollForNpc cannot spend a help).
    let npcAdvantage = advantage;
    let npcContext = advantageReason;
    if (kind !== 'save') {
      const help = await consumeCheckHelp(context, actor, false, kind, name);
      if (help) {
        npcAdvantage = mergeAdvantageState(advantage, 'advantage');
        npcContext = [advantageReason, help.reason].filter(Boolean).join('; ');
      }
    }
    // Dodge + Dexterity saves, companion/enemy actors: the same
    // rule through the server roll (rollForNpc merges condition
    // disadvantage with this advantage internally).
    if (kind === 'save') {
      const dodge = await dodgeAdvantage(context, actor, false, kind, name);
      if (dodge) {
        npcAdvantage = mergeAdvantageState(npcAdvantage, 'advantage');
        npcContext = [npcContext, dodge.reason].filter(Boolean).join('; ');
      }
    }
    const r = await rollForNpc({
      sessionId: context.sessionId, characterId: context.characterId,
      actorName: actor, kind, name, dc, advantage: npcAdvantage, context: npcContext,
      hearing: parsed?.Hearing === true || ['true', 'yes', '1'].includes(String(parsed?.Hearing || '').toLowerCase().trim())
    });
    try {
      const cfg = await readSessionConfig(context.sessionId);
      const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
      cfg.recentRolls = [...prior, r].slice(-5);
      await writeSessionConfig(context.sessionId, cfg);
    } catch { /* best-effort — the roll is still in roll_log */ }
    return { type: 'roll_request', success: true, pending: false, ...r };
  } catch (e) {
    console.error('[rollRequestService] ROLL_REQUEST handler failed:', e.message);
    return null;
  }
});

registerMarkerHandler('HELP_CHECK', async (parsed, context) => {
  if (!context?.sessionId || !context?.characterId) return null;
  try {
    const helperRaw = String(parsed?.Helper || '').trim();
    const allyRaw = String(parsed?.Ally || '').trim();
    if (!helperRaw || !allyRaw) return { type: 'help_check', success: false, reason: 'HELP_CHECK needs Helper= and Ally=' };
    const scopeKeys = ['Skill', 'Ability', 'Save'].filter((k) => parsed?.[k]);
    if (scopeKeys.length > 1) return { type: 'help_check', success: false, reason: 'HELP_CHECK takes at most one of Skill=/Ability=/Save=' };
    if (parsed?.Save) return { type: 'help_check', success: false, reason: 'Help applies to ability checks, not saving throws' };
    const helper = await resolveCheckParty(context, helperRaw);
    if (!helper) return { type: 'help_check', success: false, reason: 'HELP_CHECK helper must be a party member' };
    const ally = await resolveCheckParty(context, allyRaw);
    if (!ally) return { type: 'help_check', success: false, reason: 'HELP_CHECK ally must be a party member' };
    const scope = scopeKeys.length
      ? { kind: scopeKeys[0].toLowerCase(), name: String(parsed[scopeKeys[0]]).trim().toLowerCase() }
      : null;
    const enc = await currentCheckEncounter(context.sessionId);
    await setField(context.sessionId, enc, ally.key, 'checkHelp', { helperKey: helper.key, helperName: helper.name, scope });
    return { type: 'help_check', success: true, helper: helper.name, ally: ally.name, scope };
  } catch (e) {
    console.error('[rollRequestService] HELP_CHECK handler failed:', e.message);
    return null;
  }
});


