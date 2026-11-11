/**
 * Spell Cast Service (Combat Pipeline #3 + combat-real B4/B5).
 * Server-side spell slot tracking. AI emits SPELL_CAST; server validates
 * and decrements.
 *
 * B4 (v1.0.191): Caster="Lyra" routes the cast through the companion's
 * own slots (companion_spell_slots_used, max from levelProgression —
 * the same math the companion endpoints use) and companion
 * concentration. Class_based companions only.
 *
 * B5: Target="Goblin" on a save-based spell (spellCatalog SPELL_SAVES)
 * rolls the ENEMY's saving throw server-side against the caster's real
 * spell save DC (8 + proficiency + casting modifier, from the sheet).
 * The outcome is stashed with the roll outcomes so the DM narrates it
 * as fact next turn; enemy conditions apply (paralyzed auto-fails a
 * DEX save; restrained rolls it at disadvantage).
 *
 * Mechanics hooks, Family 5 (2026-11-09, STAGED from cached mirror
 * copies — not verified live, not pushed): one post-cast hook in
 * castSpell (PC) and one in castCompanionSpell (companion), after slot
 * spend and cast confirmation. Life healing (Disciple of Life,
 * Blessed Healer, Supreme Healing; Preserve Life pool surfaced for
 * the markers family) and Wild Magic Surge (d20 trigger, d100 table,
 * Tides of Chaos / Controlled Chaos / Tamed Surge) dispatch by
 * feature key via featuresAtLevel. See NOTES.md / HANDOFF.md in the
 * f5 staging folder. The PC rule holds for healing too (D3): a PC's
 * reported total is the player's — Disciple/Supreme arrive as pending
 * instructions, never silently added; Blessed Healer's fixed self-heal
 * is system-applied (it is not a reported total) and stated.
 */
import { dbGet, dbRun } from '../database.js';
import { safeParse } from '../utils/safeParse.js';
import { roll, rollD20 } from '../utils/rng.js';
import { registerHandler as registerMarkerHandler } from './markerPipeline.js';
import { lookupSpell, isConcentrationSpell, spellSaveAbility, spellEffectSpec } from '../data/spellCatalog.js';
import { getSpellSlots } from '../config/levelProgression.js';
import { spellProfileFor } from './combatStatsService.js';
import { findCompanionIdByName, conditionRollEffects, hasIncapacitatingCondition, charmerFor } from './conditionService.js';
import { findActiveEnemy, getCurrentEncounterSeq, applyPartyDamageToEnemy } from './enemyCombatService.js';
import { lookupBestiary } from './bestiaryService.js';
import { crScaledModifier } from './rollRequestService.js';
// Family 5: Life pure math + Wild Magic trigger/table live in
// subclassService / wildMagicService. NOTE (cached-mirror gap): the
// task names featuresForActor / hasSubclassFeature / featureByKey /
// subclassPoolMaxima from subclassService.js, but NONE of those four
// exists in the cached mirror (see BASELINE-MANIFEST.json) — this
// family dispatches by feature key through featuresAtLevel + the Life
// pure-math helpers, via the locals below. When the pools/saves
// families land those helpers, the coordinator should re-point the
// locals at them; call sites and return shapes stay the same.
import {
  featuresAtLevel,
  lifeDiscipleBonus,
  lifeBlessedHealerBonus,
  lifeHealingDiceMaxed,
  lifePreserveLifePool,
  featuresForActor, hasSubclassFeature, featureByKey } from './subclassService.js';
import { rollWildMagicSurge, applySurgeRow } from './wildMagicService.js';

const ABILITY_FULL = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };

/**
 * The enemy's save modifier. Step 1 (v1.0.194): the COMBAT_START
 * snapshot (combat_enemies.stats_json) carries the full 2024 block —
 * its printed save modifier when the creature has one, else the raw
 * ability modifier from its scores. Only block-less legacy enemies
 * fall back to the old estimate: DEX from the bestiary's dex_mod when
 * known, everything else the creature's challenge proficiency minus
 * 2, floored at 0.
 */
export async function enemySaveModifier(enemy, ability) {
  const snap = safeParse(enemy?.stats_json, null);
  if (snap?.abilities) {
    if (snap.saves && snap.saves[ability] != null) return snap.saves[ability];
    const score = snap.abilities[ability];
    if (score != null) return Math.floor((score - 10) / 2);
  }
  const entry = await lookupBestiary(enemy.name).catch(() => null);
  if (ability === 'dex' && entry?.dex_mod != null) return entry.dex_mod;
  const cr = Number(entry?.challenge_rating) || 1;
  return Math.max(0, crScaledModifier(cr) - 2);
}

/** Roll an active enemy's save against a caster's spell. Returns the
 *  outcome object, or null when the spell has no save / no such enemy. */
export async function resolveSpellSave({ sessionId, casterCharacterId, casterKind, casterRow, spellName, targetName }) {
  const saveAbility = spellSaveAbility(spellName);
  if (!saveAbility || !sessionId || !targetName || !casterRow) return null;
  const seq = await getCurrentEncounterSeq(sessionId);
  if (!seq) return null;
  const enemy = await findActiveEnemy(sessionId, seq, targetName);
  if (!enemy) return null;
  const className = casterKind === 'player' ? casterRow.class : casterRow.companion_class;
  const actorShape = casterKind === 'player'
    ? { ability_scores: casterRow.ability_scores, level: casterRow.level }
    : { ability_scores: casterRow.companion_ability_scores, level: casterRow.companion_level };
  const profile = spellProfileFor(actorShape, className);
  if (!profile) return null;
  const dc = profile.saveDc;
  const modifier = await enemySaveModifier(enemy, saveAbility);
  const conds = safeParse(enemy.active_conditions, []);
  const fx = conditionRollEffects(Array.isArray(conds) ? conds : [], 'save', ABILITY_FULL[saveAbility]);

    // Family 6 (D9 / save marks): caster-imposed save disadvantage
    // (Eldritch Strike, Magical Ambush, Corona of Light, Diminish
    // Defiance, Enfeeble the Unholy, Brand of the Sapping Scar). Only
    // when the caster is the party — all six marks are "against a spell
    // YOU cast". Marks never break a save (best-effort try/catch).
    let subclassDisadvantage = false;
    let subclassMarks = [];
    try {
      const { targetSaveMarksActive, saveDisadvantageFromMarks } = await import('./conditionService.js');
      const marks = await targetSaveMarksActive({ kind: 'enemy', id: enemy.id, sessionId, encounterSeq: seq });
      const spec = spellEffectSpec(spellName, { slotLevel: 0, casterLevel: 1 });
      const res = saveDisadvantageFromMarks(marks, {
        isSpellSave: true,
        spellDamageType: spec?.damageType || null,
        casterClass: className,
      });
      subclassDisadvantage = res.disadvantage;
      subclassMarks = res.sources || [];
    } catch { /* marks never break a save */ }

  // Combat item 3, Tier 3: a dodging enemy rolls DEX saves with
  // advantage (advantage + disadvantage cancel to a straight roll,
  // like every other source in the algebra).
  let saveAdvantage = false;
  if (saveAbility === 'dex') {
    try {
      const { getEntry } = await import('./actionStateService.js');
      const { combatFallbackId } = await import('./worldIdService.js');
      const saveEntry = await getEntry(sessionId, seq, combatFallbackId(sessionId, seq, enemy.id));
      saveAdvantage = !!saveEntry.dodge;
    } catch { /* best-effort */ }
  }
  let dice = [];
  let takenDie = null;
  let autoFail = false;
  if (fx.autoFail) {
    autoFail = true;
  } else if ((fx.disadvantage || subclassDisadvantage) && !saveAdvantage) {
    dice = [rollD20(`spell save: ${enemy.name}`), rollD20(`spell save: ${enemy.name}`)];
    takenDie = Math.min(...dice);
  } else if (saveAdvantage && !(fx.disadvantage || subclassDisadvantage)) {
    dice = [rollD20(`spell save: ${enemy.name}`), rollD20(`spell save: ${enemy.name}`)];
    takenDie = Math.max(...dice);
  } else {
    dice = [rollD20(`spell save: ${enemy.name}`)];
    takenDie = dice[0];
  }
  // 2024 exhaustion: the target's penalty folds into the save total.
  const penalty = fx.penalty || 0;
  const total = autoFail ? null : takenDie + modifier + penalty;
  const success = !autoFail && total >= dc;

  const outcome = {
    actorKind: 'enemy', actor: enemy.name, kind: 'save',
    label: `${spellName} save`, check: `${spellName} save`, name: ABILITY_FULL[saveAbility],
    dc, dice, takenDie, modifier, penalty, total,
    outcome: success ? 'success' : 'failure', autoFail, spellSave: true, source: 'system'
  };
  // Stash with the roll outcomes (same session_config channel the
  // resolver uses) so the DM gets it as a fact at the next turn.
  try {
    const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
    const cfg = safeParse(s?.session_config, {}) || {};
    const prior = Array.isArray(cfg.recentRolls) ? cfg.recentRolls : [];
    cfg.recentRolls = [...prior, outcome].slice(-5);
    await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
  } catch { /* best-effort */ }
  try {
    await dbRun(
      `INSERT INTO roll_log (character_id, session_id, actor_kind, actor_name, kind, label, dc,
                             dice, taken_die, modifier, total, outcome, source)
       VALUES (?, ?, 'enemy', ?, 'save', ?, ?, ?, ?, ?, ?, ?, 'system')`,
      [casterCharacterId ?? null, sessionId, enemy.name, `${spellName} save`, dc,
       JSON.stringify(dice), takenDie, modifier + penalty, total, success ? 'success' : 'failure']
    );
  } catch { /* audit trail only */ }
  return { enemy: enemy.name, ability: saveAbility, dc, dice, takenDie, modifier, penalty, total, success, autoFail };
}

async function maybeSpellSave(opts, casterKind, casterRow, spellName) {
  if (!opts.target) return null;
  return await resolveSpellSave({
    sessionId: opts.sessionId, casterCharacterId: opts.characterId,
    casterKind, casterRow, spellName, targetName: opts.target
  }).catch(() => null);
}

/** ------------------------------------------------------------------
 *  Spell damage & healing (spell-damage build, 2026-10-21).
 *  The catalog now owns each spell's dice (spellEffectSpec). The PC's
 *  damage/healing waits as a PENDING effect — Zach's rule: the DM
 *  states what to roll, the player rolls real dice and reports one
 *  final total, the system applies it (full / half / none per the
 *  saves it already rolled). Companions resolve immediately with
 *  system-rolled dice, like every other companion roll.
 *  ------------------------------------------------------------------ */

async function readSessionCfg(sessionId) {
  const s = await dbGet('SELECT session_config FROM dm_sessions WHERE id = ?', [sessionId]);
  return { row: s, cfg: safeParse(s?.session_config, {}) || {} };
}
async function writeSessionCfg(sessionId, cfg) {
  await dbRun('UPDATE dm_sessions SET session_config = ? WHERE id = ?', [JSON.stringify(cfg), sessionId]);
}

/**
 * F5 surfacing — the Wild Magic offer record. A PC offer is a question
 * the DM must ask and the player must answer on a LATER turn, so the
 * offer has to outlive the cast: { casterKind, casterId, casterName,
 * spellName, slotLevel, forced, postedAt }. The WILD_MAGIC_REPORT
 * handler reads it (and only it — no offer, no report accepted) and
 * clears it when the player reports. Best-effort: a lost offer can be
 * re-offered by the next slotted cast.
 */
async function recordWildMagicOffer(sessionId, offer) {
  if (!sessionId || !offer) return;
  try {
    const { cfg } = await readSessionCfg(sessionId);
    cfg.pendingWildMagicOffer = offer;
    await writeSessionCfg(sessionId, cfg);
  } catch { /* best-effort */ }
}

export async function getPendingSpellEffect(sessionId) {
  if (!sessionId) return null;
  try {
    const { cfg } = await readSessionCfg(sessionId);
    return cfg.pendingSpellEffect || null;
  } catch { return null; }
}

export async function stashSpellEffectOutcome(sessionId, outcome) {
  if (!sessionId || !outcome) return;
  try {
    const { cfg } = await readSessionCfg(sessionId);
    const prior = Array.isArray(cfg.recentSpellEffects) ? cfg.recentSpellEffects : [];
    cfg.recentSpellEffects = [...prior, outcome].slice(-5);
    await writeSessionCfg(sessionId, cfg);
  } catch { /* best-effort */ }
}

export function formatSpellEffectBlock(outcomes) {
  if (!Array.isArray(outcomes) || outcomes.length === 0) return '';
  const lines = outcomes.map(o => {
    if (o.pending) {
      return `${o.spell} — ${o.kind} PENDING: the player rolls ${o.spec}${o.damageType ? ` (${o.damageType})` : ''} and reports one total. The system applies it — do not invent or apply the number yourself.${o.life?.instruction ? ` ${o.life.instruction}` : ''}`;
    }
    // F5 surfacing: a Wild Magic offer or triggered row, stashed by
    // stashPostCastHookOutcomes. The offer instruction is verbatim
    // from the hook — it names the WILD_MAGIC_REPORT marker the DM
    // emits when the player reports the roll.
    if (o.kind === 'wild_magic') {
      if (o.offered) return `${o.spell} — ${o.instruction || 'Wild Magic Surge: you can roll a d20 — on a 20, roll on the Wild Magic Surge table.'}`;
      if (o.row) {
        const detail = (o.applied || []).join('; ') || o.row.effect || '';
        const pending = (o.pendingSteps || []).length ? ` Pending: ${(o.pendingSteps || []).join('; ')}.` : '';
        const random = o.randomSpell ? ` Random Spell cast: ${o.randomSpell}.` : '';
        const notes = (o.notes || []).length ? ` ${(o.notes || []).join(' ')}` : '';
        return `${o.spell} — Wild Magic Surge TRIGGERED (d20 ${o.d20}, d100 ${o.d100}): ${o.row.name} (${o.row.range})${detail ? ` — ${detail}` : ''}.${pending}${random}${notes}`;
      }
      return `${o.spell} — Wild Magic Surge: no surge.`;
    }
    // F5 surfacing: the Preserve Life pool — the one Life fact no
    // pending/effect line states (Disciple / Blessed Healer /
    // Supreme Healing ride those lines already).
    if (o.kind === 'life') {
      return `${o.spell} — Life Domain: Preserve Life pool ${o.preserveLifePool} HP (5 × cleric level; spent by the Preserve Life marker, one Channel Divinity use).`;
    }
    if (o.kind === 'healing') {
      const lifeNote = o.life?.discipleBonus
        ? ` (includes Disciple of Life +${o.life.discipleBonus}${o.life.diceMaxed ? '; Supreme Healing: dice maxed' : ''})`
        : (o.life?.diceMaxed ? ' (Supreme Healing: dice maxed)' : '');
      const blessedNote = o.blessedHealer ? ' (Blessed Healer self-heal)' : '';
      return `${o.spell} — ${o.target} healed ${o.applied} HP${o.total !== o.applied ? ` (rolled ${o.total}; capped at max)` : ''}.${lifeNote}${blessedNote}`;
    }
    if (o.kind === 'condition') {
      if (o.cleared) return `${o.spell} — ${o.target} is no longer ${o.condition} (save made).`;
      return `${o.spell} — ${o.target} is ${o.condition}${o.saveSuccess === false ? ' (save failed)' : ''}${o.repeatSave ? ' — repeats the save at end of turn' : ''}.`;
    }
    const saveNote = o.saveSuccess === true ? ' (save made)' : o.saveSuccess === false ? ' (save failed)' : '';
    return `${o.spell} — ${o.target} takes ${o.applied} damage${saveNote}${o.killed ? ' — KILLED' : ''}. (Reported roll: ${o.total}.)`;
  });
  return `\n\n[SPELL EFFECT — system facts from the spell engine. Narrate exactly these outcomes; do not re-judge saves, damage, or healing.]\n${lines.join('\n')}`;
}

/** Who a healing spell lands on: nobody named = the caster themself. */
async function resolveHealTarget(characterId, targetName, selfTarget) {
  if (!targetName) return selfTarget;
  const wanted = String(targetName).trim().toLowerCase();
  if (wanted === 'player' || wanted === 'pc' || wanted === 'self') {
    const c = await dbGet('SELECT name FROM characters WHERE id = ?', [characterId]);
    return { kind: 'player', id: characterId, name: c?.name || 'Player' };
  }
  const c = await dbGet('SELECT name FROM characters WHERE id = ?', [characterId]);
  if (c && wanted === String(c.name).toLowerCase()) return { kind: 'player', id: characterId, name: c.name };
  const compId = await findCompanionIdByName(characterId, targetName);
  if (compId) return { kind: 'companion', id: compId, name: targetName };
  // MERGE FIX (2026-11-09): a named ally stored as a characters row
  // (another PC's row, an NPC ally) is a valid heal target too. The
  // pre-existing resolver only matched the caster and the caster's
  // companions, so a Life cleric healing a named ally by name got no
  // pending effect at all (spellcast group 2 exposed it). Precedence
  // is unchanged — caster first, then companions, then any characters
  // row by exact (case-insensitive) name.
  const other = await dbGet('SELECT id, name FROM characters WHERE LOWER(name) = LOWER(?)', [targetName]);
  if (other) return { kind: 'player', id: other.id, name: other.name };
  return null;
}

async function applyHealing(target, amount, spellName) {
  if (!target || amount <= 0) return 0;
  if (target.kind === 'player') {
    const { applyHpChange } = await import('./characterHpService.js');
    const res = await applyHpChange(target.id, amount, `healing: ${spellName}`);
    if (res && typeof res.currentHp === 'number' && typeof res.previousHp === 'number') {
      return Math.max(0, res.currentHp - res.previousHp);
    }
    return amount;
  }
  const row = await dbGet('SELECT companion_current_hp, companion_max_hp FROM companions WHERE id = ?', [target.id]);
  if (!row) return 0;
  const next = Math.min(row.companion_max_hp, row.companion_current_hp + amount);
  await dbRun('UPDATE companions SET companion_current_hp = ? WHERE id = ?', [next, target.id]);
  return Math.max(0, next - row.companion_current_hp);
}

// ---------------------------------------------------------------------------
// Mechanics hooks, Family 5 — Life healing + Wild Magic.
// ---------------------------------------------------------------------------

/** { className, subclassName, level } for a PC row or a companion row. */
function actorSubclass(row, isCompanion) {
  if (!row) return { className: '', subclassName: '', level: 0 };
  if (isCompanion) {
    return {
      className: row.companion_class || '',
      subclassName: row.companion_subclass || '',
      level: Number(row.companion_level) || 0,
    };
  }
  return {
    className: row.class || '',
    subclassName: row.subclass || '',
    level: Number(row.level) || 0,
  };
}

/** Feature-key check via the subclassService contract (D6). */
function hasSubclassFeatureKey(actor, key) {
  // MERGE (2026-11-09): delegates to the subclassService contract, which
  // reads class_levels (D6) — the staged local checked the primary class
  // only. Call sites pass { className, subclassName, level } and gain
  // multiclass reads for free.
  return hasSubclassFeature(actor, key);
}

function isOtherTarget(targetName, casterName) {
  if (!targetName) return false; // no target named = the caster themself
  const t = String(targetName).trim().toLowerCase();
  if (t === 'player' || t === 'pc' || t === 'self') return false;
  if (casterName && t === String(casterName).trim().toLowerCase()) return false;
  return true;
}

/**
 * Pure Life Domain healing adjustments for one slotted healing cast.
 * `targetName` (single) or `targetNames` (array) names the heal target(s);
 * Blessed Healer fires only when at least one target is someone other
 * than the caster. Returns { isLife, discipleBonus, blessedHealerBonus,
 * diceMaxed, instruction } — `instruction` is the pending-block text
 * for a PC (D3: the rule holds for healing too).
 */
export function lifeHealingForCast({ className, subclassName, level, slotLevel, targetName, targetNames, casterName } = {}) {
  const slot = Math.trunc(Number(slotLevel) || 0);
  const feats = featuresAtLevel(className, subclassName, level);
  const keys = new Set((feats || []).map((f) => f.key));
  const isLife = String(className || '').toLowerCase() === 'cleric' && keys.has('disciple_of_life');
  if (!isLife || slot < 1) {
    return { isLife: false, discipleBonus: 0, blessedHealerBonus: 0, diceMaxed: false, instruction: null };
  }
  const discipleBonus = lifeDiscipleBonus(slot);
  const diceMaxed = lifeHealingDiceMaxed({ className, subclassName, level });
  const names = Array.isArray(targetNames) && targetNames.length ? targetNames : (targetName ? [targetName] : []);
  const healsOther = names.some((t) => isOtherTarget(t, casterName));
  const blessedHealerBonus = keys.has('blessed_healer') && healsOther ? lifeBlessedHealerBonus(slot) : 0;
  const parts = [`Disciple of Life: add ${discipleBonus} to the healing total (2 + slot level ${slot}).`];
  if (diceMaxed) parts.push('Supreme Healing: the healing dice are maxed — report the maxed total, do not roll.');
  if (blessedHealerBonus > 0) parts.push(`Blessed Healer: you regain ${blessedHealerBonus} HP yourself (applied by the system).`);
  return { isLife, discipleBonus, blessedHealerBonus, diceMaxed, instruction: parts.join(' ') };
}

/** Preserve Life pool maximum (5 × cleric level), or 0 when the
 *  feature is absent. The pool is SPENT by a C marker (markers
 *  family — see HANDOFF.md); this family only surfaces the maximum. */
export function preserveLifePoolFor({ className, subclassName, level } = {}) {
  if (!hasSubclassFeatureKey({ className, subclassName, level }, 'preserve_life')) return 0;
  return lifePreserveLifePool(level);
}

/** Maxed-dice total for a healing spec (Supreme Healing): every die
 *  at its highest face, plus the flat modifier. */
export function maxedHealingTotal(spec, flat) {
  let diceMax = 0;
  if (Array.isArray(spec?.terms)) {
    for (const t of spec.terms) diceMax += (Number(t.sides) || 0) * (Number(t.count) || 0);
  } else {
    diceMax = (Number(spec?.sides) || 0) * (Number(spec?.count) || 0);
  }
  return Math.max(0, diceMax + (Number(flat) || 0));
}

/**
 * Blessed Healer self-heal + Preserve Life pool surfacing, once per
 * cast (not per target). Runs inside runPostCastHooks, after the
 * spell's own effects. The self-heal is a fixed amount, not a
 * reported total, so the system applies it and states it.
 */
async function runLifeHook({ sessionId, characterId, casterKind, casterRow, casterName, spellName, slotLevel, isPc, opts }) {
  const actor = actorSubclass(casterRow, !isPc);
  const names = opts.targets?.length ? opts.targets : (opts.target ? [opts.target] : []);
  const spec = spellEffectSpec(spellName, { slotLevel });
  if (!spec || spec.kind !== 'healing') {
    // Preserve Life pool is still surfaced for Life clerics even on a
    // non-healing cast — the marker reads it, the cast does not spend it.
    const pool = preserveLifePoolFor(actor);
    return pool > 0 ? { isLife: true, discipleBonus: 0, blessedHealerBonus: 0, blessedHealerApplied: 0, preserveLifePool: pool, diceMaxed: false } : null;
  }
  const life = lifeHealingForCast({ ...actor, slotLevel, targetNames: names, casterName: casterName || casterRow?.name });
  const pool = preserveLifePoolFor(actor);
  if (!life.isLife && pool <= 0) return null;
  const out = {
    isLife: life.isLife,
    discipleBonus: life.discipleBonus,
    blessedHealerBonus: life.blessedHealerBonus,
    blessedHealerApplied: 0,
    preserveLifePool: pool,
    diceMaxed: life.diceMaxed,
  };
  if (life.isLife && life.blessedHealerBonus > 0) {
    const self = isPc
      ? { kind: 'player', id: characterId, name: casterRow?.name || 'Player' }
      : { kind: 'companion', id: casterRow?.id, name: casterName };
    try {
      const applied = await applyHealing(self, life.blessedHealerBonus, `${spellName} (Blessed Healer)`);
      out.blessedHealerApplied = applied;
      if (sessionId) {
        await stashSpellEffectOutcome(sessionId, {
          spell: spellName, kind: 'healing', caster: casterName || casterRow?.name || 'Player',
          target: self.name, total: life.blessedHealerBonus, applied, blessedHealer: true,
        });
      }
    } catch { /* self-heal is best-effort; the cast already succeeded */ }
  }
  return out;
}

/** Once-per-turn Wild Magic gate: a turn-ledger budget entry
 *  (`wildMagicRolled`) on the current slot. No turn order = no slot =
 *  no gate (documented best-effort, not a silent refusal). Marks the
 *  gate when the hook fires — the offer itself is the once-per-turn
 *  opportunity, so a second slotted cast on the same turn does not
 *  re-offer. Returns { gated, alreadyUsed }. */
async function wildMagicGate(sessionId, encounterSeq, actorKey) {
  try {
    const tl = await import('./turnLedgerService.js');
    const slot = await tl.currentSlotKey(sessionId, encounterSeq);
    if (!slot) return { gated: false, alreadyUsed: false };
    const ledger = await tl.readLedger(sessionId, encounterSeq);
    const budget = tl.budgetIn(ledger, slot, actorKey);
    if (budget.wildMagicRolled) return { gated: true, alreadyUsed: true };
    await tl.updateBudgetForSlot(sessionId, encounterSeq, slot, actorKey, { wildMagicRolled: true });
    return { gated: true, alreadyUsed: false };
  } catch {
    return { gated: false, alreadyUsed: false };
  }
}

/**
 * Wild Magic post-cast trigger. `opts` may carry:
 * - d20Roll (PC-reported d20; unset for a PC = OFFER, nothing rolls),
 * - d100Roll / tableChoiceIndex / tamedSurgeRow (table-roll options),
 * - tidesOfChaos: true (forced table roll — the Tides contrast case),
 * - skipWildMagic: true (Random Spell inner cast — never re-triggers),
 * - targetZone / canSee / position / returnPosition (row inputs).
 * Returns null when the caster is not a Wild Magic sorcerer, the
 * spell used no slot, or the hook is skipped; otherwise the
 * rollWildMagicSurge result plus `surge` (the applied row) and
 * `castResult` (Random Spell inner cast, if any). Never throws.
 */
export async function runWildMagicHook({ sessionId, characterId, casterKind, casterRow, casterName, spellName, slotLevel, isPc, opts = {} }) {
  try {
    if (opts.skipWildMagic) return null;
    const lvl = Math.trunc(Number(slotLevel) || 0);
    if (lvl < 1) return null; // trigger needs a Sorcerer spell cast WITH a slot
    const actor = {
      ...actorSubclass(casterRow, !isPc),
      kind: casterKind || (isPc ? 'player' : 'companion'),
      id: isPc ? characterId : casterRow?.id,
      name: casterName || casterRow?.name,
      isPc: !!isPc,
    };
    if (String(actor.className || '').toLowerCase() !== 'sorcerer') return null;
    if (!hasSubclassFeatureKey(actor, 'wild_magic_surge')) return null;
    const encounterSeq = opts.encounterSeq ?? (sessionId ? await getCurrentEncounterSeq(sessionId).catch(() => null) : null);
    // Actor key for the ledger gate: world id when available, else the
    // player:/companion: fallback (same keys movement positions use).
    let actorKey = null;
    try {
      const tl = await import('./turnLedgerService.js');
      actorKey = isPc
        ? await tl.ledgerKeyForPlayer(characterId)
        : await tl.ledgerKeyForCompanion(casterRow);
    } catch { actorKey = actor.kind === 'companion' ? `companion:${casterRow?.id}` : `player:${characterId}`; }
    // A reported roll answers an offer already made: the offer itself
    // marked the once-per-turn gate, so the report must not re-hit it
    // (it would read alreadyUsed and refuse its own answer).
    const gate = opts.reportingOffer
      ? { gated: true, alreadyUsed: false }
      : (encounterSeq && sessionId ? await wildMagicGate(sessionId, encounterSeq, actorKey) : { gated: false, alreadyUsed: false });
    if (gate.alreadyUsed) return { triggered: false, offered: false, forced: false, d20: null, d100: null, row: null, reason: 'once_per_turn' };

    // Tides of Chaos: forced. The spent flag may come from opts or
    // from session_config (set by the markers family when Tides is
    // spent); a forced roll restores Tides, so the flag clears.
    let cfg = null;
    let tidesSpent = !!opts.tidesOfChaos;
    if (sessionId && !tidesSpent) {
      try {
        ({ cfg } = await readSessionCfg(sessionId));
        tidesSpent = !!cfg.tidesOfChaosSpent;
      } catch { /* no session config — not forced */ }
    }
    if (tidesSpent && isPc && opts.d100Roll == null && opts.d100Rolls == null && !opts.tamedSurgeRow) {
      const chaosNote = hasSubclassFeatureKey(actor, 'controlled_chaos')
        ? ' (Controlled Chaos: roll two d100s and choose either).'
        : '';
      const instruction = hasSubclassFeatureKey(actor, 'controlled_chaos')
        ? `Tides of Chaos: you automatically roll on the Wild Magic Surge table — ask the player to roll two d100s and report both, then emit [WILD_MAGIC_REPORT: D100=<first> D100Second=<second> Choice=<1 or 2>]${chaosNote}`
        : `Tides of Chaos: you automatically roll on the Wild Magic Surge table — ask the player to roll a d100 and report it, then emit [WILD_MAGIC_REPORT: D100=<roll>]${chaosNote}`;
      await recordWildMagicOffer(sessionId, {
        casterKind, casterId: characterId, casterName: casterName || casterRow?.name,
        spellName, slotLevel: lvl, forced: true, postedAt: Date.now(),
      });
      return {
        triggered: false, offered: true, forced: true, d20: null, d100: null, row: null,
        instruction,
      };
    }
    const roll = rollWildMagicSurge(actor, {
      d20Roll: opts.d20Roll ?? null,
      d100Roll: opts.d100Roll ?? null,
      d100Rolls: opts.d100Rolls ?? null,
      tableChoiceIndex: opts.tableChoiceIndex,
      tamedSurgeRow: opts.tamedSurgeRow,
      forced: tidesSpent,
      alreadyRolledThisTurn: false,
    });
    if (roll.offered) {
      await recordWildMagicOffer(sessionId, {
        casterKind, casterId: characterId, casterName: casterName || casterRow?.name,
        spellName, slotLevel: lvl, forced: false, postedAt: Date.now(),
      });
      return {
        ...roll,
        instruction: 'Wild Magic Surge: you can roll a d20 — on a 20, roll on the Wild Magic Surge table. Ask the player to roll a d20 and report it, then emit [WILD_MAGIC_REPORT: D20=<roll>] (once per turn). If it is a 20, ask for a d100 as well and emit [WILD_MAGIC_REPORT: D20=20 D100=<roll>].',
      };
    }
    if (!roll.triggered || !roll.row) return roll;
    if (!cfg && sessionId) {
      try { ({ cfg } = await readSessionCfg(sessionId)); } catch { cfg = {}; }
    }
    if (tidesSpent && cfg) cfg.tidesOfChaosSpent = false; // the auto-roll restores Tides of Chaos
    const surge = await applySurgeRow(actor, roll.row, {
      sessionConfig: cfg || {},
      sessionId: sessionId || null,
      encounterSeq,
      characterId,
      targets: opts.targets?.length ? opts.targets : (opts.target ? [opts.target] : []),
      targetZone: opts.targetZone || null,
      canSee: opts.canSee,
      position: opts.position || null,
      returnPosition: opts.returnPosition || null,
      rng: opts.rng,
    });
    if (cfg && sessionId) {
      try { await writeSessionCfg(sessionId, cfg); } catch { /* surge state write is best-effort */ }
    }
    const out = { ...roll, surge };
    // Random Spell (57–60): the surge spell is cast by the system
    // through this same cast path — no slot spent (skipSlotSpend),
    // no concentration if normally required, and never re-triggering.
    if (surge.cast && !opts.skipWildMagic) {
      const innerOpts = {
        ...opts,
        sessionId: sessionId || null,
        target: surge.cast.target || undefined,
        targets: undefined,
        skipWildMagic: true,
        skipSlotSpend: true,
        concentrationBypass: true,
      };
      try {
        out.castResult = isPc
          ? await castSpell(characterId, surge.cast.spell, surge.cast.level, innerOpts)
          : await castCompanionSpell(characterId, casterName, surge.cast.spell, surge.cast.level, innerOpts);
      } catch (e) {
        out.castResult = { success: false, reason: `random_spell_cast_failed: ${e.message}` };
      }
    }
    return out;
  } catch (e) {
    return { triggered: false, offered: false, forced: false, d20: null, d100: null, row: null, reason: `wild_magic_hook_failed: ${e.message}` };
  }
}

/**
 * The Family 5 post-cast hook (one call site per cast path).
 * Runs the Life hook (Blessed Healer self-heal + Preserve Life pool)
 * and the Wild Magic hook. Returns { life, wildMagic } (each null
 * when it does not apply). Never throws.
 */
export async function runPostCastHooks(args) {
  const out = { life: null, wildMagic: null };
  try { out.life = await runLifeHook(args); } catch { /* best-effort */ }
  try { out.wildMagic = await runWildMagicHook(args); } catch { /* best-effort */ }
  return out;
}

/**
 * F5 surfacing — stash the post-cast hook results where the DM's next
 * turn reads them: session_config.recentSpellEffects, rendered once by
 * the SPELL EFFECT injection (dmSession) through formatSpellEffectBlock.
 * Only facts nothing else states are stashed here: the Wild Magic
 * offer / triggered row (no other line renders them) and the Preserve
 * Life pool (the cast return's life is otherwise unread). Disciple of
 * Life, Blessed Healer, and Supreme Healing already ride the pending /
 * effect outcome lines — they are NOT repeated here. Never throws;
 * surfacing never breaks a cast.
 */
async function stashPostCastHookOutcomes(sessionId, spellName, casterName, postCast) {
  if (!sessionId || !postCast) return;
  try {
    const wm = postCast.wildMagic;
    if (wm && (wm.offered || wm.triggered)) {
      await stashSpellEffectOutcome(sessionId, {
        spell: spellName, kind: 'wild_magic', caster: casterName || 'Player',
        offered: !!wm.offered, forced: !!wm.forced,
        instruction: wm.instruction || null,
        d20: wm.d20 ?? null, d100: wm.d100 ?? null,
        row: wm.row ? { range: wm.row.range, name: wm.row.name, effect: wm.row.effect } : null,
        applied: wm.surge?.applied || [],
        pendingSteps: (wm.surge?.pending || []).map((p) => p.step || p.reason || String(p)),
        notes: wm.surge?.notes || [],
        randomSpell: wm.castResult?.spell || wm.surge?.cast?.spell || null,
      });
    }
    const life = postCast.life;
    if (life && (life.preserveLifePool || 0) > 0) {
      await stashSpellEffectOutcome(sessionId, {
        spell: spellName, kind: 'life', caster: casterName || 'Player',
        preserveLifePool: life.preserveLifePool,
      });
    }
  } catch { /* best-effort */ }
}

function effectNumbers(spec, casterProfile) {
  if (spec?.flat) {
    const mod = spec.addCastingMod ? (casterProfile?.modifier || 0) : 0;
    const flat = spec.flatAmount === 'full' ? 'full' : spec.flatAmount + mod;
    return { flat, specStr: flat === 'full' ? 'full' : String(flat) };
  }
  const flat = spec.modifier + (spec.addCastingMod ? (casterProfile?.modifier || 0) : 0);
  const specStr = `${spec.count}d${spec.sides}${flat > 0 ? `+${flat}` : flat < 0 ? `${flat}` : ''}`;
  return { flat, specStr };
}

/**
 * Flat-amount PC spells (Heal, Mass Heal, Guardian of Faith, Power Word
 * Heal): nothing for the player to roll, so the amount applies at cast
 * time — the same treatment companions get. 'full' healing passes a
 * saturating amount to applyHealing and reports the actual delta.
 */
async function applyFlatPcSpellEffect(sessionId, characterId, charRow, spellName, spec, specStr, flat, spellSave, targetName, lvl = 0) {
  if (spec.kind === 'healing') {
    const target = await resolveHealTarget(characterId, targetName, { kind: 'player', id: characterId, name: charRow.name || 'Player' });
    if (!target) return null;
    // Family 5: flat healing has no player roll, so Disciple of Life
    // (a fixed 2 + slot level) is system-applied here with the flat
    // amount itself — there is no reported total to state it in.
    // Blessed Healer rides the post-cast hook (once per cast), not this
    // per-target function; Supreme Healing has no dice to max on a
    // flat spell.
    const life = lifeHealingForCast({ ...actorSubclass(charRow, false), slotLevel: lvl, targetName, casterName: charRow.name });
    const bonus = life.isLife ? life.discipleBonus : 0;
    const applied = await applyHealing(target, flat === 'full' ? 99999 : flat + bonus, spellName);
    const outcome = { spell: spellName, kind: 'healing', caster: charRow.name || 'Player', target: target.name, total: flat === 'full' ? applied : flat + bonus, applied };
    if (life.isLife) outcome.life = { discipleBonus: bonus, diceMaxed: life.diceMaxed };
    await stashSpellEffectOutcome(sessionId, outcome);
    return outcome;
  }
  const isMissile = String(spellName).toLowerCase() === 'magic missile';
  if (!spellSaveAbility(spellName) && !isMissile) return null;
  if (!targetName) return null;
  const seq = await getCurrentEncounterSeq(sessionId);
  const enemy = seq ? await findActiveEnemy(sessionId, seq, targetName) : null;
  if (!enemy) return null;
  const saveSuccess = spellSave ? !!spellSave.success : null;
  let applied = flat === 'full' ? 0 : flat;
  if (saveSuccess) applied = spec.damageOnSave === 'none' ? 0 : Math.floor(applied / 2);
  let killed = false;
  let damageAdjustment = null;
  if (applied > 0) {
    const res = await applyPartyDamageToEnemy(sessionId, seq, enemy.name, applied, characterId,
      { damageType: spec.damageType, magical: true });
    killed = !!res?.killed;
    if (res?.damageAdjustment) { damageAdjustment = res.damageAdjustment; applied = res.damageDealt; }
  }
  const outcome = { spell: spellName, kind: 'damage', caster: charRow.name || 'Player', target: enemy.name, total: flat, applied, saveSuccess, killed, damageAdjustment };
  await stashSpellEffectOutcome(sessionId, outcome);
  return outcome;
}

/** PC cast: record the pending effect the player's next message resolves. */
async function notePcSpellEffect(sessionId, characterId, charRow, spellName, lvl, spellSave, targetName) {
  if (!sessionId || !charRow) return null;
  const spec = spellEffectSpec(spellName, { slotLevel: lvl, casterLevel: charRow.level || 1 });
  if (!spec) return null;
  const profile = spellProfileFor({ ability_scores: charRow.ability_scores, level: charRow.level }, charRow.class);
  const { flat, specStr } = effectNumbers(spec, profile);
  if (spec.flat) {
    return applyFlatPcSpellEffect(sessionId, characterId, charRow, spellName, spec, specStr, flat, spellSave, targetName, lvl);
  }
  let target = null;
  if (spec.kind === 'healing') {
    target = await resolveHealTarget(characterId, targetName, { kind: 'player', id: characterId, name: charRow.name || 'Player' });
    if (!target) return null;
  } else {
    // Damage pends only for save spells and Magic Missile — attack-roll
    // spells resolve through the ATTACK marker, never SPELL_CAST.
    const isMissile = String(spellName).toLowerCase() === 'magic missile';
    if (!spellSaveAbility(spellName) && !isMissile) return null;
    if (targetName) {
      const seq = await getCurrentEncounterSeq(sessionId);
      const enemy = seq ? await findActiveEnemy(sessionId, seq, targetName) : null;
      if (!enemy) return null;
      target = { kind: 'enemy', name: enemy.name, saveSuccess: spellSave ? !!spellSave.success : null };
    }
  }
  const { cfg } = await readSessionCfg(sessionId);
  let pending = cfg.pendingSpellEffect;
  if (!pending || pending.spell !== spellName) {
    // Family 5 (D3 — the PC rule holds for healing too): Disciple of
    // Life and Supreme Healing arrive as a pending instruction the
    // player applies when reporting the total — never silently added.
    const life = spec.kind === 'healing'
      ? lifeHealingForCast({ ...actorSubclass(charRow, false), slotLevel: lvl, targetName, casterName: charRow.name })
      : null;
    pending = {
      spell: spellName, kind: spec.kind, spec: specStr, damageType: spec.damageType,
      damageOnSave: spec.damageOnSave, targets: [],
      encounterSeq: await getCurrentEncounterSeq(sessionId),
      postedAt: Date.now(),
      ...(life?.isLife ? { life: { discipleBonus: life.discipleBonus, diceMaxed: life.diceMaxed, instruction: life.instruction } } : {}),
    };
  }
  if (target) pending.targets.push(target);
  cfg.pendingSpellEffect = pending;
  await writeSessionCfg(sessionId, cfg);
  await stashSpellEffectOutcome(sessionId, { pending: true, spell: spellName, kind: spec.kind, spec: specStr, damageType: spec.damageType, ...(pending.life ? { life: pending.life } : {}) });
  return pending;
}

/** Companion cast: roll and apply immediately. */
async function applyCompanionSpellEffect(sessionId, characterId, compRow, casterName, spellName, lvl, spellSave, targetName) {
  if (!sessionId) return null;
  const spec = spellEffectSpec(spellName, { slotLevel: lvl, casterLevel: compRow.companion_level || 1 });
  if (!spec) return null;
  const profile = spellProfileFor({ ability_scores: compRow.companion_ability_scores, level: compRow.companion_level }, compRow.companion_class);
  const { flat, specStr } = effectNumbers(spec, profile);
  let total;
  if (spec.flat) {
    total = flat === 'full' ? 99999 : Math.max(0, flat);
  } else if (spec.terms) {
    let sum = 0;
    for (const t of spec.terms) sum += roll(t.sides, t.count, { reason: `spell effect: ${spellName}` }).total;
    total = Math.max(0, sum + flat);
  } else {
    const r = roll(spec.sides, spec.count, { reason: `spell effect: ${spellName}` });
    total = Math.max(0, r.total + flat);
  }
  if (spec.kind === 'healing') {
    // Family 5: companion healing is real math. Disciple of Life adds
    // 2 + slot level to the amount; Supreme Healing maxes the dice
    // before the roll is reported (server roll here, so max the dice
    // in the total). Blessed Healer rides the post-cast hook (once
    // per cast), not this per-target function.
    const life = lifeHealingForCast({ ...actorSubclass(compRow, true), slotLevel: lvl, targetName, casterName });
    if (life.isLife) {
      if (life.diceMaxed && !spec.flat) total = maxedHealingTotal(spec, flat);
      total += life.discipleBonus;
    }
    const self = { kind: 'companion', id: compRow.id, name: casterName };
    const target = await resolveHealTarget(characterId, targetName, self);
    if (!target) return null;
    const applied = await applyHealing(target, total, spellName);
    const outcome = { spell: spellName, kind: 'healing', caster: casterName, target: target.name, total: spec.flat && spec.flatAmount === 'full' ? applied : total, applied };
    if (life.isLife) outcome.life = { discipleBonus: life.discipleBonus, diceMaxed: life.diceMaxed };
    await stashSpellEffectOutcome(sessionId, outcome);
    return outcome;
  }
  const isMissile = String(spellName).toLowerCase() === 'magic missile';
  if (!spellSaveAbility(spellName) && !isMissile) return null; // attack spells: ATTACK marker
  if (!targetName) return null;
  const seq = await getCurrentEncounterSeq(sessionId);
  const enemy = seq ? await findActiveEnemy(sessionId, seq, targetName) : null;
  if (!enemy) return null;
  const saveSuccess = spellSave ? !!spellSave.success : null;
  let applied = total;
  if (saveSuccess) applied = spec.damageOnSave === 'none' ? 0 : Math.floor(total / 2);
  let killed = false;
  let damageAdjustment = null;
  if (applied > 0) {
    const res = await applyPartyDamageToEnemy(sessionId, seq, enemy.name, applied, characterId,
      { damageType: spec.damageType, magical: true });
    killed = !!res?.killed;
    if (res?.damageAdjustment) { damageAdjustment = res.damageAdjustment; applied = res.damageDealt; }
  }
  const outcome = { spell: spellName, kind: 'damage', caster: casterName, target: enemy.name, total, applied, saveSuccess, killed, damageAdjustment };
  await stashSpellEffectOutcome(sessionId, outcome);
  return outcome;
}

/** The player reported their damage/healing total — apply the pending. */
export async function resolveReportedSpellEffect(sessionId, characterId, reportedTotal) {
  const pending = await getPendingSpellEffect(sessionId);
  if (!pending) return null;
  const total = Math.max(0, Math.trunc(reportedTotal) || 0);
  const { cfg } = await readSessionCfg(sessionId);
  delete cfg.pendingSpellEffect;
  await writeSessionCfg(sessionId, cfg);
  const outcomes = [];
  for (const t of pending.targets || []) {
    if (t.kind === 'enemy') {
      let applied = total;
      if (t.saveSuccess) applied = pending.damageOnSave === 'none' ? 0 : Math.floor(total / 2);
      let killed = false;
      let damageAdjustment = null;
      if (applied > 0 && pending.encounterSeq) {
        const res = await applyPartyDamageToEnemy(sessionId, pending.encounterSeq, t.name, applied, characterId,
          { damageType: pending.damageType, magical: true });
        killed = !!res?.killed;
        if (res?.damageAdjustment) { damageAdjustment = res.damageAdjustment; applied = res.damageDealt; }
      }
      outcomes.push({ spell: pending.spell, kind: 'damage', target: t.name, total, applied, saveSuccess: t.saveSuccess, killed, damageAdjustment });
    } else {
      const applied = await applyHealing(t, total, pending.spell);
      outcomes.push({ spell: pending.spell, kind: 'healing', target: t.name, total, applied });
    }
  }
  if (outcomes.length === 0) {
    outcomes.push({ spell: pending.spell, kind: pending.kind, target: 'no declared target', total, applied: 0, saveSuccess: null, killed: false });
  }
  for (const o of outcomes) await stashSpellEffectOutcome(sessionId, o);
  return { spell: pending.spell, total, outcomes };
}

function dedupeNames(names) {
  const seen = new Map();
  for (const n of names || []) {
    const k = String(n).trim().toLowerCase();
    if (k && !seen.has(k)) seen.set(k, String(n).trim());
  }
  return [...seen.values()];
}

/**
 * Tier C (party side): after a failed save, the catalog condition
 * lands mechanically + its spell_effects row (repeat saves, duration,
 * concentration link) via enemySpellService. Sleep is excluded — its
 * two-stage text contradicts its catalog condition, so the DM applies
 * it by hand. Returns the condition record or null.
 */
async function maybeApplyPartyCondition(sessionId, characterId, casterKind, casterKey, casterName, spellName, targetName, save, choice) {
  const info = lookupSpell(spellName);
  const cond = info?.appliesCondition || null;
  if (!cond || !save || save.success) return null;
  if (String(spellName).toLowerCase() === 'sleep') return null;
  if (!sessionId) return null;
  const seq = await getCurrentEncounterSeq(sessionId);
  if (!seq) return null;
  const enemy = await findActiveEnemy(sessionId, seq, targetName);
  let target = null;
  if (enemy) target = { kind: 'enemy', id: enemy.id, name: enemy.name };
  else {
    const compId = await findCompanionIdByName(characterId, targetName).catch(() => null);
    if (!compId) return null;
    target = { kind: 'companion', id: compId, name: targetName };
  }
  const { applySpellCondition } = await import('./enemySpellService.js');
  const applied = await applySpellCondition(sessionId, seq, target, spellName, { kind: casterKind, key: casterKey, name: casterName },
    { condition: cond, saveAbility: save.ability, saveDc: save.dc, choice: choice || null });
  if (applied) {
    await stashSpellEffectOutcome(sessionId, { spell: spellName, kind: 'condition', caster: casterName, target: target.name, condition: applied.condition, saveSuccess: false });
  }
  return applied;
}

async function slotMath(isPc, characterId, compId, casterRaw, lvl) {
  if (isPc) {
    const char = await dbGet('SELECT spell_slots, spell_slots_used FROM characters WHERE id = ?', [characterId]);
    if (!char) return { ok: false, reason: 'unknown caster' };
    const maxSlots = safeParse(char.spell_slots, {});
    const usedSlots = safeParse(char.spell_slots_used, {});
    const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
    const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
    return { ok: true, max, used, maxSlots, usedSlots };
  }
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [compId]);
  if (!row) return { ok: false, reason: `unknown caster: ${casterRaw}` };
  const maxSlots = getSpellSlots(row.companion_class, row.companion_level) || {};
  const usedSlots = safeParse(row.companion_spell_slots_used, {});
  const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
  const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
  return { ok: true, max, used, maxSlots, usedSlots, row };
}

/** Spend one slot (reaction + countered casts, which bypass castSpell).
 *  Cantrips are free. Returns { ok, consumed, slotsMax, slotsUsed, slotsRemaining }. */
export async function spendSpellSlot(characterId, casterRaw, isPc, compId, level) {
  const lvl = Math.trunc(Number(level) || 0);
  if (lvl <= 0) return { ok: true, consumed: false, slotsMax: null, slotsUsed: null, slotsRemaining: null };
  const m = await slotMath(isPc, characterId, compId, casterRaw, lvl);
  if (!m.ok) return m;
  if (m.used >= m.max) return { ok: false, reason: 'no_slots_available', slotsMax: m.max, slotsUsed: m.used, slotsRemaining: m.max - m.used };
  m.usedSlots[String(lvl)] = m.used + 1;
  if (isPc) {
    await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify(m.usedSlots), characterId]);
  } else {
    await dbRun('UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?', [JSON.stringify(m.usedSlots), compId]);
  }
  return { ok: true, consumed: true, slotsMax: m.max, slotsUsed: m.used + 1, slotsRemaining: m.max - (m.used + 1) };
}

/** Restore one expended slot of the given level (Wild Magic Boon rows
 *  97–00 sub-rows 3/4: "regain your lowest-level expended spell slot").
 *  Mirror of spendSpellSlot: decrements used, floored at 0, never
 *  above max. Returns { ok, consumed: false, restored, slotsMax,
 *  slotsUsed, slotsRemaining }. Cantrips (level 0) are a no-op success. */
export async function restoreSpellSlot(characterId, casterRaw, isPc, compId, level) {
  const lvl = Math.trunc(Number(level) || 0);
  if (lvl <= 0) return { ok: true, consumed: false, restored: false, slotsMax: null, slotsUsed: null, slotsRemaining: null };
  const m = await slotMath(isPc, characterId, compId, casterRaw, lvl);
  if (!m.ok) return m;
  if (m.used <= 0) return { ok: false, reason: 'no_expended_slot', slotsMax: m.max, slotsUsed: m.used, slotsRemaining: m.max - m.used };
  m.usedSlots[String(lvl)] = m.used - 1;
  if (isPc) {
    await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify(m.usedSlots), characterId]);
  } else {
    await dbRun('UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?', [JSON.stringify(m.usedSlots), compId]);
  }
  return { ok: true, consumed: false, restored: true, slotsMax: m.max, slotsUsed: m.used - 1, slotsRemaining: m.max - (m.used - 1) };
}

/** Availability peek (no write): the counter path checks this BEFORE
 *  consuming an armed counter, so a slot refusal never eats a counter. */
export async function peekSpellSlot(characterId, casterRaw, isPc, compId, level) {
  const lvl = Math.trunc(Number(level) || 0);
  if (lvl <= 0) return { ok: true };
  const m = await slotMath(isPc, characterId, compId, casterRaw, lvl);
  if (!m.ok) return m;
  if (m.used >= m.max) return { ok: false, reason: 'no_slots_available', slotsMax: m.max, slotsUsed: m.used, slotsRemaining: m.max - m.used };
  return { ok: true, slotsMax: m.max, slotsUsed: m.used, slotsRemaining: m.max - m.used };
}

/** Companion cast path (B4). Slots + concentration on the companion's
 *  own columns; npc_stats companions are not casters. */
export async function castCompanionSpell(characterId, casterName, spellName, lvl, opts) {
  const compId = await findCompanionIdByName(characterId, casterName);
  if (!compId) return { type: 'spell_cast', success: false, reason: `unknown caster: ${casterName}` };
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [compId]);
  if (!row || row.progression_type !== 'class_based' || !row.companion_class) {
    return { type: 'spell_cast', success: false, reason: 'not_a_caster', caster: casterName, spell: spellName };
  }
  let casterKey = null;
  try {
    const { ledgerKeyForCompanion } = await import('./turnLedgerService.js');
    casterKey = await ledgerKeyForCompanion({ id: compId, npc_id: row.npc_id });
  } catch { /* condition rows fall back to a null caster key */ }
  // Combat item 8: an incapacitated companion caster cannot cast.
  if (await hasIncapacitatingCondition('companion', compId)) {
    return { type: 'spell_cast', success: false, reason: `${casterName} is incapacitated and cannot take actions` };
  }
  let concentrationStarted = false;
  // Family 5: Wild Magic Random Spell casts with no concentration even
  // when the spell normally requires it (opts.concentrationBypass).
  if (isConcentrationSpell(spellName) && !opts.concentrationBypass) {
    try {
      const { startCompanionConcentration } = await import('./concentrationService.js');
      await startCompanionConcentration(compId, spellName);
      concentrationStarted = true;
    } catch (e) { console.error('[spellCastService] Companion concentration failed:', e.message); }
  }
  const spellInfo = lookupSpell(spellName);
  if (lvl === 0) {
    const targetNames = opts.targets?.length ? dedupeNames(opts.targets) : (opts.target ? [opts.target] : []);
    // No target named: run once with a null target, as the pre-item-6 code did — healing resolves to the caster, damage resolves untargeted.
    if (targetNames.length === 0) targetNames.push(null);
    const saves = [];
    const effects = [];
    const conditions = [];
    for (const t of targetNames) {
      const sv = await maybeSpellSave({ ...opts, characterId, target: t }, 'companion', row, spellName);
      saves.push(sv);
      const ef = await applyCompanionSpellEffect(opts.sessionId || null, characterId, row, casterName, spellName, 0, sv, t).catch(() => null);
      effects.push(ef);
      const cond = await maybeApplyPartyCondition(opts.sessionId || null, characterId, 'companion', casterKey, casterName, spellName, t, sv, opts.choice).catch(() => null);
      if (cond) conditions.push(cond);
    }
    return { type: 'spell_cast', caster: casterName, spell: spellName, level: 0, slotConsumed: false, success: true, concentration: concentrationStarted, ...(saves.length === 1 && saves[0] ? { spellSave: saves[0] } : {}), ...(saves.length > 1 ? { spellSaves: saves } : {}), ...(effects.length === 1 && effects[0] ? { effect: effects[0] } : {}), ...(effects.length > 1 ? { effects } : {}), ...(conditions.length ? { conditions } : {}) };
  }
  const maxSlots = getSpellSlots(row.companion_class, row.companion_level) || {};
  const usedSlots = safeParse(row.companion_spell_slots_used, {});
  const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
  const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
  // A readied release (skipSlotSpend) already paid at ready time:
  // no availability check, no increment. The release handler
  // corrects the display fields below.
  if (!opts.skipSlotSpend) {
    if (used >= max) {
      return { type: 'spell_cast', caster: casterName, spell: spellName, level: lvl, slotConsumed: false, success: false, reason: 'no_slots_available', slotsMax: max, slotsUsed: used };
    }
    usedSlots[String(lvl)] = used + 1;
    await dbRun('UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?', [JSON.stringify(usedSlots), compId]);
  }
  const targetNames = opts.targets?.length ? dedupeNames(opts.targets) : (opts.target ? [opts.target] : []);
  // No target named: run once with a null target, as the pre-item-6 code did — healing resolves to the caster, damage resolves untargeted.
  if (targetNames.length === 0) targetNames.push(null);
  const saves = [];
  const effects = [];
  const conditions = [];
  for (const t of targetNames) {
    const sv = await maybeSpellSave({ ...opts, characterId, target: t }, 'companion', row, spellName);
    saves.push(sv);
    const ef = await applyCompanionSpellEffect(opts.sessionId || null, characterId, row, casterName, spellName, lvl, sv, t).catch(() => null);
    effects.push(ef);
    const cond = await maybeApplyPartyCondition(opts.sessionId || null, characterId, 'companion', casterKey, casterName, spellName, t, sv, opts.choice).catch(() => null);
    if (cond) conditions.push(cond);
  }
  // Family 5 post-cast hook (companion face: system rolls the d20).
  // A readied release (skipSlotSpend) still fires it — the slot was
  // paid at ready time, and the release IS the cast with a slot.
  const postCast = await runPostCastHooks({
    sessionId: opts.sessionId || null, characterId, casterKind: 'companion',
    casterRow: row, casterName, spellName, slotLevel: lvl, isPc: false, opts,
  }).catch(() => ({ life: null, wildMagic: null }));
  // F5 surfacing: the hook results reach the DM's next turn via the
  // SPELL EFFECT block (and the route's spellCasts payload). The
  // return object below already carries life / wildMagic verbatim.
  await stashPostCastHookOutcomes(opts.sessionId || null, spellName, casterName, postCast);
  return {
    type: 'spell_cast', caster: casterName, spell: spellName, level: lvl,
    slotConsumed: true, success: true, slotsMax: max, slotsUsed: used + 1,
    slotsRemaining: max - (used + 1), concentration: concentrationStarted,
    castTime: spellInfo?.castTime || 'action', components: spellInfo?.components || [],
    ...(saves.length === 1 && saves[0] ? { spellSave: saves[0] } : {}), ...(saves.length > 1 ? { spellSaves: saves } : {}),
    ...(effects.length === 1 && effects[0] ? { effect: effects[0] } : {}), ...(effects.length > 1 ? { effects } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(postCast?.life ? { life: postCast.life } : {}),
    ...(postCast?.wildMagic ? { wildMagic: postCast.wildMagic } : {})
  };
}

/**
 * Spend-only spell hold for a readied spell (audit item 3): the slot
 * is spent when the spell is readied, not when it is released, and
 * holding the spell takes the caster's concentration — even for
 * spells that don't normally need it (unlike castSpell, which only
 * auto-starts concentration for concentration spells). No save or
 * effect is resolved here; the release resolves those. Slot math
 * mirrors castSpell/castCompanionSpell — keep in sync.
 */
export async function holdSpellSlot({ characterId, casterName, spellName, level = null }) {
  const info = lookupSpell(spellName);
  if (!info) return { type: 'spell_hold', success: false, reason: `unknown spell: ${spellName}` };
  const lvl = level != null && Number.isFinite(Number(level)) ? Math.trunc(Number(level)) : (info.level ?? 0);
  const isPc = !casterName || /^(player|pc|character)$/i.test(casterName);
  if (isPc) {
    let slotConsumed = false;
    if (lvl > 0) {
      const char = await dbGet('SELECT spell_slots, spell_slots_used FROM characters WHERE id = ?', [characterId]);
      if (!char) return { type: 'spell_hold', success: false, reason: 'unknown caster' };
      const maxSlots = safeParse(char.spell_slots, {});
      const usedSlots = safeParse(char.spell_slots_used, {});
      const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
      const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
      if (used >= max) return { type: 'spell_hold', success: false, reason: 'no_slots_available', spell: spellName, level: lvl };
      usedSlots[String(lvl)] = used + 1;
      await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify(usedSlots), characterId]);
      slotConsumed = true;
    }
    let replacedConcentration = null;
    try {
      const { getConcentration, startConcentration } = await import('./concentrationService.js');
      const current = await getConcentration(characterId);
      if (current && current.toLowerCase() !== String(spellName).toLowerCase()) replacedConcentration = current;
      await startConcentration(characterId, spellName);
    } catch (e) { console.error('[spellCastService] Hold concentration failed:', e.message); }
    return { type: 'spell_hold', success: true, spell: spellName, level: lvl, slotConsumed, replacedConcentration };
  }
  const compId = await findCompanionIdByName(characterId, casterName);
  if (!compId) return { type: 'spell_hold', success: false, reason: `unknown caster: ${casterName}` };
  const row = await dbGet('SELECT * FROM companions WHERE id = ?', [compId]);
  if (!row || row.progression_type !== 'class_based' || !row.companion_class) {
    return { type: 'spell_hold', success: false, reason: 'not_a_caster', caster: casterName, spell: spellName };
  }
  let slotConsumed = false;
  if (lvl > 0) {
    const maxSlots = getSpellSlots(row.companion_class, row.companion_level) || {};
    const usedSlots = safeParse(row.companion_spell_slots_used, {});
    const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
    const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
    if (used >= max) return { type: 'spell_hold', success: false, reason: 'no_slots_available', spell: spellName, level: lvl };
    usedSlots[String(lvl)] = used + 1;
    await dbRun('UPDATE companions SET companion_spell_slots_used = ? WHERE id = ?', [JSON.stringify(usedSlots), compId]);
    slotConsumed = true;
  }
  let replacedConcentration = null;
  try {
    const { getCompanionConcentration, startCompanionConcentration } = await import('./concentrationService.js');
    const current = await getCompanionConcentration(compId);
    if (current && current.toLowerCase() !== String(spellName).toLowerCase()) replacedConcentration = current;
    await startCompanionConcentration(compId, spellName);
  } catch (e) { console.error('[spellCastService] Hold concentration failed:', e.message); }
  return { type: 'spell_hold', success: true, spell: spellName, level: lvl, slotConsumed, replacedConcentration };
}

/** Combat item 8: is this spell harmful for charmed-caster gating?
 *  Damage (spellEffectSpec damage, including damage-plus-healing),
 *  a saving throw, or an applied condition all count. Healing-only
 *  and pure buffs do not. Non-catalog spells return null (unknown —
 *  the gate stays DM-side for them). */
export function spellIsHarmful(spellName) {
  if (!spellName) return null;
  const info = lookupSpell(spellName);
  if (!info) return null;
  const fx = spellEffectSpec(spellName);
  // spellEffectSpec returns kind 'damage' | 'healing' — there is no
  // damage field on the spec, so kind is the damage test.
  if (fx) return fx.kind === 'damage';
  if (info.save || info.appliesCondition) return true;
  return false;
}

export async function castSpell(characterId, spellName, level, opts = {}) {
  if (!characterId) return null;
  const lvl = Math.trunc(level) || 0;
  const casterName = opts.caster ? String(opts.caster).trim() : null;
  // Combat item 8: an incapacitated PC caster cannot cast (covers
  // marker casts via castPartySpell and direct releases). Companion
  // casters are gated in castCompanionSpell below.
  if (!casterName || /^(player|pc|character)$/i.test(casterName)) {
    if (await hasIncapacitatingCondition('player', characterId)) {
      return { type: 'spell_cast', success: false, reason: 'caster is incapacitated and cannot take actions' };
    }
  }
  if (casterName && !/^(player|pc|character)$/i.test(casterName)) {
    return castCompanionSpell(characterId, casterName, spellName, lvl, { ...opts, sessionId: opts.sessionId || null, target: opts.target || null });
  }
  if (lvl === 0) {
    const charRow = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    let casterKey = null;
    try {
      const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
      casterKey = await ledgerKeyForPlayer(characterId);
    } catch { /* condition rows fall back to a null caster key */ }
    const targetNames = opts.targets?.length ? dedupeNames(opts.targets) : (opts.target ? [opts.target] : []);
    // No target named: run once with a null target, as the pre-item-6 code did — healing resolves to the caster, damage pends untargeted.
    if (targetNames.length === 0) targetNames.push(null);
    const saves = [];
    const pendings = [];
    const conditions = [];
    for (const t of targetNames) {
      const sv = await maybeSpellSave({ ...opts, characterId, target: t }, 'player', charRow, spellName);
      saves.push(sv);
      const pe = await notePcSpellEffect(opts.sessionId || null, characterId, charRow, spellName, 0, sv, t).catch(() => null);
      pendings.push(pe);
      const cond = await maybeApplyPartyCondition(opts.sessionId || null, characterId, 'player', casterKey, charRow?.name || 'Player', spellName, t, sv, opts.choice).catch(() => null);
      if (cond) conditions.push(cond);
    }
    const pendingEffect = pendings.find(Boolean) || null;
    return { type: 'spell_cast', spell: spellName, level: 0, slotConsumed: false, success: true, ...(saves.length === 1 && saves[0] ? { spellSave: saves[0] } : {}), ...(saves.length > 1 ? { spellSaves: saves } : {}), ...(pendingEffect ? { pendingEffect } : {}), ...(conditions.length ? { conditions } : {}) };
  }
  const char = await dbGet('SELECT spell_slots, spell_slots_used FROM characters WHERE id = ?', [characterId]);
  if (!char) return null;
  const maxSlots = safeParse(char.spell_slots, {});
  const usedSlots = safeParse(char.spell_slots_used, {});
  const max = maxSlots[String(lvl)] || maxSlots[lvl] || 0;
  const used = usedSlots[String(lvl)] || usedSlots[lvl] || 0;
  // A readied release (skipSlotSpend) already paid at ready time.
  if (!opts.skipSlotSpend) {
    if (used >= max) {
      return { type: 'spell_cast', spell: spellName, level: lvl, slotConsumed: false, success: false, reason: 'no_slots_available', slotsMax: max, slotsUsed: used };
    }
    usedSlots[String(lvl)] = used + 1;
    await dbRun('UPDATE characters SET spell_slots_used = ? WHERE id = ?', [JSON.stringify(usedSlots), characterId]);
  }

  // Combat Pipeline #12: Auto-start concentration for concentration spells
  // (Structural integration with #4: concentrationService)
  let concentrationStarted = false;
  // Family 5: opts.concentrationBypass (Wild Magic Random Spell) skips
  // the auto-start — the surge spell "does not" require concentration.
  if (isConcentrationSpell(spellName) && !opts.concentrationBypass) {
    try {
      const { startConcentration } = await import('./concentrationService.js');
      await startConcentration(characterId, spellName);
      concentrationStarted = true;
    } catch (e) { console.error('[spellCastService] Auto-concentration failed:', e.message); }
  }

  const spellInfo = lookupSpell(spellName);
  let pendingEffect = null;
  let saves = [];
  let conditions = [];
  {
    const charRow = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
    let casterKey = null;
    try {
      const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
      casterKey = await ledgerKeyForPlayer(characterId);
    } catch { /* condition rows fall back to a null caster key */ }
    const targetNames = opts.targets?.length ? dedupeNames(opts.targets) : (opts.target ? [opts.target] : []);
    // No target named: run once with a null target, as the pre-item-6 code did — healing resolves to the caster, damage pends untargeted.
    if (targetNames.length === 0) targetNames.push(null);
    const pendings = [];
    for (const t of targetNames) {
      const sv = await maybeSpellSave({ ...opts, characterId, target: t }, 'player', charRow, spellName);
      saves.push(sv);
      const pe = await notePcSpellEffect(opts.sessionId || null, characterId, charRow, spellName, lvl, sv, t).catch(() => null);
      pendings.push(pe);
      const cond = await maybeApplyPartyCondition(opts.sessionId || null, characterId, 'player', casterKey, charRow?.name || 'Player', spellName, t, sv, opts.choice).catch(() => null);
      if (cond) conditions.push(cond);
    }
    pendingEffect = pendings.find(Boolean) || null;
  }
  // Family 5 post-cast hook (PC face: the d20 roll is OFFERED, never
  // forced — except Tides of Chaos, which forces the table roll).
  // A readied release (skipSlotSpend) still fires it: the slot was
  // paid at ready time, and the release IS the cast with a slot.
  const charRowForHook = await dbGet('SELECT * FROM characters WHERE id = ?', [characterId]);
  const postCast = await runPostCastHooks({
    sessionId: opts.sessionId || null, characterId, casterKind: 'player',
    casterRow: charRowForHook, casterName: charRowForHook?.name || 'Player',
    spellName, slotLevel: lvl, isPc: true, opts,
  }).catch(() => ({ life: null, wildMagic: null }));
  // F5 surfacing: see the companion path above — same channel.
  await stashPostCastHookOutcomes(opts.sessionId || null, spellName, charRowForHook?.name || 'Player', postCast);
  return {
    type: 'spell_cast',
    spell: spellName,
    level: lvl,
    slotConsumed: true,
    success: true,
    slotsMax: max,
    slotsUsed: used + 1,
    slotsRemaining: max - (used + 1),
    concentration: concentrationStarted,
    castTime: spellInfo?.castTime || 'action',
    components: spellInfo?.components || [],
    ...(saves.length === 1 && saves[0] ? { spellSave: saves[0] } : {}),
    ...(saves.length > 1 ? { spellSaves: saves } : {}),
    ...(pendingEffect ? { pendingEffect } : {}),
    ...(conditions.length ? { conditions } : {}),
    ...(postCast?.life ? { life: postCast.life } : {}),
    ...(postCast?.wildMagic ? { wildMagic: postCast.wildMagic } : {})
  };
}

/**
 * Release a readied spell (audit item 3): the stored ready must name
 * this spell (slots are at stake — a different spell would pay twice
 * and lose the held one), the level must match the held level when
 * given, and concentration must still name the held spell — if it
 * broke after readying, the held spell fizzled and the ready clears
 * with nothing cast. Firing spends the reaction (when a turn order
 * exists) and clears the ready, then casts WITHOUT spending a slot
 * again. Releasing ends the hold for non-concentration spells.
 */
async function releaseReadiedSpell(context, parsed, spell, level) {
  const sessionId = context.sessionId;
  const encounterSeq = await getCurrentEncounterSeq(sessionId);
  const casterRaw = parsed?.Caster || null;
  const isPc = !casterRaw || /^(player|pc|character)$/i.test(casterRaw);
  let casterKey = null;
  let casterName = null;
  let compId = null;
  if (isPc) {
    const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
    casterKey = await ledgerKeyForPlayer(context.characterId);
    const row = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]);
    casterName = row?.name || 'Player';
  } else {
    compId = await findCompanionIdByName(context.characterId, casterRaw);
    if (!compId) return { type: 'spell_cast', success: false, reason: `unknown caster: ${casterRaw}` };
    const row = await dbGet('SELECT c.npc_id, n.name FROM companions c JOIN npcs n ON c.npc_id = n.id WHERE c.id = ?', [compId]);
    if (!row) return { type: 'spell_cast', success: false, reason: `unknown caster: ${casterRaw}` };
    const { ledgerKeyForCompanion } = await import('./turnLedgerService.js');
    casterKey = await ledgerKeyForCompanion({ id: compId, npc_id: row.npc_id });
    casterName = row.name;
  }
  const { getEntry, clearField } = await import('./actionStateService.js');
  const entry = await getEntry(sessionId, encounterSeq, casterKey);
  const held = entry.ready?.heldSpell;
  if (!held) return { type: 'spell_cast', success: false, reason: 'no readied spell stored' };
  if (String(held.spell).toLowerCase() !== String(spell).toLowerCase()) {
    return { type: 'spell_cast', success: false, reason: `readied spell is "${held.spell}", not "${spell}"` };
  }
  if (level && level !== held.level) {
    return { type: 'spell_cast', success: false, reason: `readied spell is held at level ${held.level}` };
  }
  const { getConcentration, getCompanionConcentration } = await import('./concentrationService.js');
  const conc = isPc ? await getConcentration(context.characterId) : await getCompanionConcentration(compId);
  if (!conc || conc.toLowerCase() !== String(held.spell).toLowerCase()) {
    await clearField(sessionId, encounterSeq, casterKey, 'ready');
    return { type: 'spell_cast', success: false, reason: 'the held spell fizzled when concentration broke' };
  }
  const { getTurnState } = await import('./combatTurnService.js');
  const st = await getTurnState(sessionId, encounterSeq);
  if (st) {
    const { hasReactionAvailable, useReaction } = await import('./reactionService.js');
    if (!(await hasReactionAvailable(sessionId, encounterSeq, casterName))) {
      return { type: 'spell_cast', success: false, reason: 'reaction already used' };
    }
    await useReaction(sessionId, encounterSeq, casterName);
  }
  await clearField(sessionId, encounterSeq, casterKey, 'ready');
  const res = await castSpell(context.characterId, held.spell, held.level, {
    caster: parsed?.Caster || null,
    target: parsed?.Target || null,
    sessionId: sessionId || null,
    skipSlotSpend: true
  });
  if (!res) return { type: 'spell_cast', success: false, reason: 'spell release failed' };
  if (res.slotsUsed != null) { res.slotsUsed -= 1; res.slotsRemaining += 1; }
  res.slotConsumed = false;
  res.readyFired = true;
  if (!isConcentrationSpell(held.spell)) {
    try {
      const { breakConcentration, breakCompanionConcentration } = await import('./concentrationService.js');
      if (isPc) await breakConcentration(context.characterId, 'readied spell released');
      else await breakCompanionConcentration(compId, 'readied spell released');
    } catch { /* best-effort */ }
  }
  return res;
}

/**
 * Item 6 party-cast handler: validity → reaction validation →
 * reaction branches → handler-level refusals → identity gating →
 * economy → armed-counter check → cast (slot spent inside castSpell,
 * economy committed after success). Readied releases bypass this
 * entirely (releaseReadiedSpell, audit item 3). A refused cast
 * consumes nothing: no slot, no action/bonus, no reaction, and an
 * armed counter is only consumed by a cast that actually happens
 * (or is countered).
 */
async function castPartySpell(context, parsed, spell, level) {
  const sessionId = context.sessionId || null;
  const casterRaw = parsed?.Caster || null;
  const isPc = !casterRaw || /^(player|pc|character)$/i.test(String(casterRaw));
  const encounterSeq = sessionId ? await getCurrentEncounterSeq(sessionId) : null;
  const slotFail = (spent) => ({ type: 'spell_cast', spell, level, slotConsumed: false, success: false, reason: spent.reason, ...(spent.slotsMax != null ? { slotsMax: spent.slotsMax, slotsUsed: spent.slotsUsed, slotsRemaining: spent.slotsRemaining } : {}) });
  const slotOk = (spent) => (spent.consumed ? { slotsMax: spent.slotsMax, slotsUsed: spent.slotsUsed, slotsRemaining: spent.slotsRemaining } : {});
  // (1) Caster validity BEFORE gating (mirrors castCompanionSpell).
  let casterKind = 'player';
  let casterKey = null;
  let casterName = 'Player';
  let compId = null;
  let charRow = null;
  let compRow = null;
  if (isPc) {
    const { ledgerKeyForPlayer } = await import('./turnLedgerService.js');
    casterKey = await ledgerKeyForPlayer(context.characterId);
    charRow = await dbGet('SELECT * FROM characters WHERE id = ?', [context.characterId]);
    casterName = charRow?.name || 'Player';
  } else {
    compId = await findCompanionIdByName(context.characterId, casterRaw);
    if (!compId) return { type: 'spell_cast', success: false, reason: `unknown caster: ${casterRaw}` };
    compRow = await dbGet('SELECT * FROM companions WHERE id = ?', [compId]);
    if (!compRow || compRow.progression_type !== 'class_based' || !compRow.companion_class) {
      return { type: 'spell_cast', success: false, reason: 'not_a_caster', caster: casterRaw, spell };
    }
    const { ledgerKeyForCompanion } = await import('./turnLedgerService.js');
    casterKey = await ledgerKeyForCompanion({ id: compId, npc_id: compRow.npc_id });
    casterKind = 'companion';
    casterName = casterRaw;
  }
  // Combat item 8: an incapacitated caster cannot cast (actions and
  // reactions both blocked). Checked before the reaction branches,
  // so a refused reaction cast spends no slot and no reaction.
  if (await hasIncapacitatingCondition(isPc ? 'player' : 'companion', isPc ? context.characterId : compId)) {
    return { type: 'spell_cast', success: false, reason: `${casterName} is incapacitated and cannot take actions` };
  }
  const ess = await import('./enemySpellService.js');
  const info = lookupSpell(spell);
  const reaction = parsed?.Reaction === true || parsed?.Reaction === 'true';
  // (2) Reaction validity (catalog spells only; non-catalog tracks).
  const v = ess.validateReactionUsage(spell, reaction);
  if (!v.allowed) return { type: 'spell_cast', success: false, reason: v.reason, remedy: v.remedy };
  const reactionName = await ess.reactionNameFor(sessionId, encounterSeq, casterKey, casterName);
  if (reaction) {
    // (3) Reaction branches: budget checked before any spend.
    const rc = await ess.checkReaction(sessionId, encounterSeq, reactionName);
    if (!rc.allowed) return { type: 'spell_cast', success: false, reason: rc.reason, remedy: rc.remedy };
    const key = String(spell).toLowerCase();
    if (key === 'counterspell') {
      const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
      if (!spent.ok) return slotFail(spent);
      const prof = ess.partySpellProfile(casterKind, isPc ? charRow : compRow);
      ess.armPartyCounter(context, { counterspeller: casterName, dc: prof?.saveDc ?? null, targetName: parsed?.Target || null });
      await ess.spendReaction(sessionId, encounterSeq, reactionName);
      return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, success: true, counterArmed: true, dc: prof?.saveDc ?? null, ...slotOk(spent) };
    }
    if (key === 'shield') {
      const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
      if (!spent.ok) return slotFail(spent);
      await ess.setShield(sessionId, encounterSeq, casterKey);
      await ess.spendReaction(sessionId, encounterSeq, reactionName);
      return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, success: true, shieldSet: true, ...slotOk(spent) };
    }
    if (['absorb elements', 'hellish rebuke', 'backlash'].includes(key)) {
      // Availability peek first: a slot refusal must not eat the
      // last-damage record the trio would answer.
      const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
      if (!peek.ok) return slotFail(peek);
      const reactor = { kind: casterKind, id: isPc ? context.characterId : compId, key: casterKey, name: casterName };
      const trio = await ess.resolveTrioReaction(sessionId, encounterSeq, reactor, spell, level, { dc: parsed?.Dc != null ? Number(parsed.Dc) : null, sessionCharacterId: context.characterId });
      if (trio.success === false) return { type: 'spell_cast', success: false, reason: trio.reason, remedy: trio.remedy };
      const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
      if (!spent.ok) return slotFail(spent);
      await ess.spendReaction(sessionId, encounterSeq, reactionName);
      const { type: _trioType, ...trioRest } = trio;
      return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, ...trioRest, success: true, ...slotOk(spent) };
    }
    // Generic reaction spells: slot + reaction, effects DM-narrated.
    const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
    if (!spent.ok) return slotFail(spent);
    await ess.spendReaction(sessionId, encounterSeq, reactionName);
    return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, success: true, tracking: true, note: 'reaction spell effects are DM-narrated (not wired)', ...slotOk(spent) };
  }
  // (4) Non-reaction: target parsing + handler-level refusals BEFORE economy.
  const targets = [];
  if (parsed?.Target) targets.push(String(parsed.Target));
  if (parsed?.Targets) {
    for (const t of String(parsed.Targets).split(',')) {
      const n = t.trim();
      if (n) targets.push(n);
    }
  }
  const deduped = dedupeNames(targets);
  // Combat item 8: a charmed caster cannot target the charmer with a
  // harmful spell. Resolved targets only (unresolved names fall
  // through to the resolver's own unknown-target handling); skipped
  // outside an encounter, where targets are not engine-resolved.
  if (sessionId && encounterSeq && deduped.length) {
    const charmer = await charmerFor(isPc ? 'player' : 'companion', isPc ? context.characterId : compId);
    if (charmer && spellIsHarmful(spell)) {
      const pcNameRow = await dbGet('SELECT name FROM characters WHERE id = ?', [context.characterId]).catch(() => null);
      for (const t of deduped) {
        let tKind = null;
        let tId = null;
        if (/^(player|pc|character)$/i.test(t) || (pcNameRow && t.toLowerCase() === String(pcNameRow.name).toLowerCase())) {
          tKind = 'player'; tId = context.characterId;
        } else {
          const tCompId = await findCompanionIdByName(context.characterId, t).catch(() => null);
          if (tCompId) { tKind = 'companion'; tId = tCompId; }
          else {
            const tEnemy = await findActiveEnemy(sessionId, encounterSeq, t).catch(() => null);
            if (tEnemy) { tKind = 'enemy'; tId = tEnemy.id; }
          }
        }
        if (tKind && charmer.kind === tKind && Number(charmer.id) === Number(tId)) {
          return { type: 'spell_cast', success: false, reason: `${casterName} is charmed by ${charmer.name || 'the target'} and cannot target them with harmful spells` };
        }
      }
    }
  }
  const spellKey = String(spell).toLowerCase();
  if (spellKey === 'magic missile' && deduped.length > 1) {
    return { type: 'spell_cast', success: false, reason: 'party Magic Missile cannot split across distinct targets through the single reported total', remedy: 'Cast separately at each target, or name one target (repeat it for extra darts).' };
  }
  if (spellKey === 'hold person' && deduped.length > 1) {
    const allowed = 1 + Math.max(0, level - 2);
    if (deduped.length > allowed) {
      return { type: 'spell_cast', success: false, reason: `Hold Person at level ${level} targets at most ${allowed} target${allowed === 1 ? '' : 's'}, not ${deduped.length} targets`, remedy: `Upcast to level ${level + (deduped.length - allowed)} or drop targets.` };
    }
  }
  const tls = await import('./turnLedgerService.js');
  // (5) Identity gating (member-only; non-members pass ungated).
  const gate = await tls.checkSpellIdentity(sessionId, encounterSeq, casterKey);
  if (!gate.allowed) return { type: 'spell_cast', success: false, reason: gate.reason, remedy: gate.remedy };
  // (6) Economy (catalog castTime is the authority).
  const castTime = info?.castTime || 'action';
  const econ = await tls.checkSpellEconomy(sessionId, encounterSeq, casterKey, { castTime, level });
  if (!econ.allowed) return { type: 'spell_cast', success: false, reason: econ.reason, remedy: econ.remedy };
  // (7) Armed enemy counter — after gating, so a counter never
  // launders an illegal off-turn cast. Slot peek first so a slot
  // refusal never eats an armed counter.
  if (sessionId && encounterSeq) {
    const counter = await ess.takeEnemyCounter(sessionId, encounterSeq, casterName);
    if (counter) {
      const rearm = async () => ess.armEnemyCounter(sessionId, encounterSeq, { enemyName: counter.enemyName, dc: counter.dc, targetName: counter.targetName });
      if (counter.dc == null) {
        await rearm();
      } else if (isPc) {
        const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
        if (!peek.ok) {
          await rearm();
          return slotFail(peek);
        }
        const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
        await tls.spendSpellEconomy(sessionId, encounterSeq, casterKey, { castTime, level, spellName: spell });
        const effect = { spell, level, casterKind: 'player', casterId: context.characterId, casterName, targets: deduped.length ? deduped : (parsed?.Target ? [parsed.Target] : []), castTime, choice: parsed?.Choice || null };
        await ess.postPendingSave(sessionId, context.characterId, 'Constitution', counter.dc, 'pendingCounteredCast', effect);
        await ess.pushDmNotice(sessionId, `Ask ${casterName} for a Constitution save vs counterspell DC ${counter.dc} — ${spell} completes on a success, fizzles on a failure.`);
        return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, success: true, countered: 'pending', counterspeller: counter.enemyName, ...slotOk(spent) };
      } else {
        const save = await ess.rollCompanionSave(sessionId, context.characterId, casterName, 'con', counter.dc, spell);
        if (!save.success) {
          const peek = await peekSpellSlot(context.characterId, casterRaw, isPc, compId, level);
          if (!peek.ok) {
            await rearm();
            return slotFail(peek);
          }
          const spent = await spendSpellSlot(context.characterId, casterRaw, isPc, compId, level);
          await tls.spendSpellEconomy(sessionId, encounterSeq, casterKey, { castTime, level, spellName: spell });
          return { type: 'spell_cast', spell, level, slotConsumed: spent.consumed, success: true, countered: true, counterspeller: counter.enemyName, ...slotOk(spent) };
        }
        // Save made: counter consumed, cast proceeds below.
      }
    }
  }
  // (8) Cast (slot spent inside; targets looped, conditions applied).
  const res = await castSpell(context.characterId, spell, level, {
    caster: casterRaw, target: parsed?.Target || null,
    targets: deduped.length ? deduped : null,
    choice: parsed?.Choice || null, sessionId: sessionId || null,
  });
  if (res && res.success) {
    await tls.spendSpellEconomy(sessionId, encounterSeq, casterKey, { castTime, level, spellName: spell });
  }
  return res;
}

registerMarkerHandler('SPELL_CAST', async (parsed, context) => {
  if (!context?.characterId) return null;
  try {
    const spell = parsed?.Spell;
    const level = Number(parsed?.Level) || 0;
    if (!spell) return null;
    let res;
    if (parsed?.Ready === true || parsed?.Ready === 'true') {
      res = await releaseReadiedSpell(context, parsed, spell, level);
    } else {
      res = await castPartySpell(context, parsed, spell, level);
    }
    // Hide v2 (audit item 4): casting a spell with a Verbal
    // component ends hidden — the book's invisibility-end rule.
    // Best-effort: a cast result is never broken by this clear.
    if (res?.success) {
      try {
        const info = lookupSpell(spell);
        if (info?.components?.includes('V') && context.sessionId) {
          const enc = await getCurrentEncounterSeq(context.sessionId);
          if (enc) {
            const { getEntry, clearField } = await import('./actionStateService.js');
            const { ledgerKeyForPlayer, ledgerKeyForCompanion } = await import('./turnLedgerService.js');
            const casterRaw = parsed?.Caster;
            let casterKey = null;
            if (!casterRaw || /^(player|pc|character)$/i.test(String(casterRaw))) {
              casterKey = await ledgerKeyForPlayer(context.characterId);
            } else {
              const { findCompanionIdByName } = await import('./conditionService.js');
              const compId = await findCompanionIdByName(context.characterId, String(casterRaw));
              if (compId) {
                const compRow = await dbGet('SELECT npc_id FROM companions WHERE id = ?', [compId]);
                if (compRow) casterKey = await ledgerKeyForCompanion({ id: compId, npc_id: compRow.npc_id });
              }
            }
            if (casterKey && (await getEntry(context.sessionId, enc, casterKey)).hidden) {
              await clearField(context.sessionId, enc, casterKey, 'hidden');
            }
          }
        }
      } catch { /* verbal-clear never breaks a cast */ }
    }
    return res;
  } catch (e) {
    console.error('[spellCastService] SPELL_CAST handler failed:', e.message);
    return null;
  }
});

// F5 surfacing — the Wild Magic report marker. A PC offer (see
// runWildMagicHook) is a question the player answers on a later turn:
// the DM asks for the roll, the player reports it, and the DM emits
// [WILD_MAGIC_REPORT: D20=<roll>] (or D100=<roll> for a Tides of Chaos
// forced roll). This handler spends NO slot and casts NOTHING — it
// only feeds the reported die into the hook the offer already opened,
// then stashes the outcome on the same SPELL EFFECT channel as a cast.
// Refuses fail-closed: no pending offer, no roll reported, or an
// out-of-range die leaves the offer standing for a correct report.
registerMarkerHandler('WILD_MAGIC_REPORT', async (parsed, context) => {
  if (!context?.characterId || !context?.sessionId) return null;
  try {
    const sessionId = parseInt(context.sessionId);
    const { cfg } = await readSessionCfg(sessionId);
    const offer = cfg.pendingWildMagicOffer || null;
    if (!offer) return { type: 'wild_magic_report', success: false, reason: 'no_pending_wild_magic_offer' };
    const d20Raw = parsed?.D20 != null ? Number(parsed.D20) : null;
    const d100Raw = parsed?.D100 != null ? Number(parsed.D100) : null;
    const d100SecondRaw = parsed?.D100Second != null ? Number(parsed.D100Second) : null;
    if (d20Raw == null && d100Raw == null) {
      return { type: 'wild_magic_report', success: false, reason: 'no_roll_reported' };
    }
    if (d20Raw != null && (!Number.isFinite(d20Raw) || d20Raw < 1 || d20Raw > 20)) {
      return { type: 'wild_magic_report', success: false, reason: 'invalid_d20' };
    }
    if (d100Raw != null && (!Number.isFinite(d100Raw) || d100Raw < 1 || d100Raw > 100)) {
      return { type: 'wild_magic_report', success: false, reason: 'invalid_d100' };
    }
    if (d100SecondRaw != null && (!Number.isFinite(d100SecondRaw) || d100SecondRaw < 1 || d100SecondRaw > 100)) {
      return { type: 'wild_magic_report', success: false, reason: 'invalid_d100' };
    }
    const isPc = offer.casterKind !== 'companion';
    const casterRow = isPc
      ? await dbGet('SELECT * FROM characters WHERE id = ?', [offer.casterId])
      : await dbGet('SELECT * FROM companions WHERE id = ?', [offer.casterId]);
    if (!casterRow) return { type: 'wild_magic_report', success: false, reason: 'unknown caster' };
    const choiceIndex = parsed?.Choice != null ? (Number(parsed.Choice) === 2 ? 1 : 0) : undefined;
    const hookOpts = {
      d20Roll: d20Raw, d100Roll: d100Raw,
      d100Rolls: (d100Raw != null && d100SecondRaw != null) ? [d100Raw, d100SecondRaw] : null,
      tableChoiceIndex: choiceIndex,
      tidesOfChaos: !!offer.forced,
      reportingOffer: true,
    };
    const wildMagic = await runWildMagicHook({
      sessionId, characterId: context.characterId, casterKind: offer.casterKind,
      casterRow, casterName: offer.casterName, spellName: offer.spellName,
      slotLevel: offer.slotLevel, isPc, opts: hookOpts,
    });
    // The report answers the offer — consume it either way (a 19 is
    // an answer too). The triggered row, when there is one, stashes
    // on the same channel as a cast's own surge.
    try {
      const { cfg: freshCfg } = await readSessionCfg(sessionId);
      delete freshCfg.pendingWildMagicOffer;
      // Drop the now-stale offer line from the pending spell-effects
      // block, so the DM is not asked for the same roll twice.
      if (Array.isArray(freshCfg.recentSpellEffects)) {
        freshCfg.recentSpellEffects = freshCfg.recentSpellEffects.filter(
          (o) => !(o && o.kind === 'wild_magic' && o.offered && o.spell === offer.spellName)
        );
      }
      await writeSessionCfg(sessionId, freshCfg);
    } catch { /* best-effort */ }
    await stashPostCastHookOutcomes(sessionId, offer.spellName, offer.casterName, { life: null, wildMagic });
    return { type: 'wild_magic_report', success: true, caster: offer.casterName, spell: offer.spellName, wildMagic };
  } catch (e) {
    console.error('[spellCastService] WILD_MAGIC_REPORT handler failed:', e.message);
    return { type: 'wild_magic_report', success: false, reason: `wild_magic_report_failed: ${e.message}` };
  }
});

export default { castSpell, castCompanionSpell, resolveSpellSave, getPendingSpellEffect, resolveReportedSpellEffect, formatSpellEffectBlock, enemySaveModifier, stashSpellEffectOutcome, spellIsHarmful, runPostCastHooks, runWildMagicHook, restoreSpellSlot, lifeHealingForCast, preserveLifePoolFor, maxedHealingTotal };

