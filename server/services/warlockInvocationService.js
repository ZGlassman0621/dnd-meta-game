// server/services/warlockInvocationService.js — the rules for learning
// and replacing Eldritch Invocations (class-audit-severe-seven item 2,
// 2026-11-25). Pure functions: no database. The routes in
// server/routes/character.js load the row, call these, and write.
//
// Storage: characters.invocations (migration 117) is a JSON array of
// { key, choice } — `choice` names the cantrip (Agonizing Blast,
// Eldritch Spear, Repelling Blast) or the Origin feat key (Lessons of
// the First Ones), and is null otherwise. The Pact boons are invocations
// in 2024, so a held Pact is in this list too; characters.pact (migration
// 113) mirrors it (pactFromInvocations) so its existing readers keep
// working.
//
// The rules (SRD 5.2.1, as supplied — see server/data/warlockInvocations.js):
//   - known count by Warlock level: INVOCATIONS_KNOWN_BY_LEVEL;
//   - a level prerequisite is a WARLOCK level (a multiclass character's
//     warlock class level, not the total level);
//   - you must meet a prerequisite to learn an invocation, and can learn
//     it at the same time you meet it (a batch is judged against the held
//     list plus every pick in the batch);
//   - a repeatable invocation is taken again only for a different choice;
//   - an invocation can't be replaced while it is a prerequisite for
//     another one you have;
//   - on gaining a Warlock level you may replace one invocation with
//     another you qualify for.

import {
  WARLOCK_INVOCATIONS, INVOCATIONS_KNOWN_BY_LEVEL, PACT_INVOCATION_KEYS, WARLOCK_CANTRIP_TRAITS,
} from '../data/warlockInvocations.js';
import { listOriginFeats } from '../data/featRegistry.js';
import { safeParse } from '../utils/safeParse.js';

const BY_KEY = new Map(WARLOCK_INVOCATIONS.map((e) => [e.key, e]));
const PACT_BY_INVOCATION = Object.fromEntries(Object.entries(PACT_INVOCATION_KEYS).map(([pact, key]) => [key, pact]));

export function getInvocation(key) {
  return BY_KEY.get(normKey(key)) || null;
}

export function listInvocations() {
  return WARLOCK_INVOCATIONS;
}

function normKey(value) {
  const s = String(value ?? '').trim().toLowerCase();
  if (!s) return '';
  if (BY_KEY.has(s)) return s;
  // Accept the display name too ("Devil's Sight" -> devils_sight).
  const byName = WARLOCK_INVOCATIONS.find((e) => e.name.toLowerCase() === s);
  if (byName) return byName.key;
  return s.replace(/'/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

/** Invocations known at a Warlock level (0 below level 1). */
export function invocationsKnownAt(level) {
  const n = Number(level);
  if (!Number.isInteger(n) || n < 1) return 0;
  return INVOCATIONS_KNOWN_BY_LEVEL[Math.min(n, 20) - 1];
}

/** A row's Warlock class level: class_levels entry, else a single-class warlock's level, else 0. */
export function warlockLevelOf(row) {
  const levels = typeof row?.class_levels === 'string' ? safeParse(row.class_levels, null) : row?.class_levels;
  const entry = Array.isArray(levels) ? levels.find((e) => String(e?.class ?? '').toLowerCase() === 'warlock') : null;
  if (entry) return Number(entry.level) || 0;
  return String(row?.class || '').trim().toLowerCase() === 'warlock' ? (Number(row?.level) || 1) : 0;
}

/** characters.invocations TEXT (or an array) -> [{ key, choice }]. Unknown keys are dropped. */
export function parseInvocations(raw) {
  const list = typeof raw === 'string' ? safeParse(raw, []) : raw;
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    const key = normKey(typeof item === 'string' ? item : item?.key);
    if (!BY_KEY.has(key)) continue;
    const choice = typeof item === 'object' && item?.choice != null && String(item.choice).trim() ? String(item.choice).trim() : null;
    out.push({ key, choice });
  }
  return out;
}

/** The Pact boon key ('blade' | 'chain' | 'tome') held among the invocations, or null. */
export function pactFromInvocations(list) {
  for (const inv of list || []) {
    if (PACT_BY_INVOCATION[inv.key]) return PACT_BY_INVOCATION[inv.key];
  }
  return null;
}

/** Swap the held Pact (if any) for `pactKey` ('blade' | 'chain' | 'tome' | null). */
export function withPact(list, pactKey) {
  const rest = (list || []).filter((inv) => !PACT_BY_INVOCATION[inv.key]);
  return pactKey && PACT_INVOCATION_KEYS[pactKey] ? [{ key: PACT_INVOCATION_KEYS[pactKey], choice: null }, ...rest] : rest;
}

// --- choices ---------------------------------------------------------

export function originFeatOptions() {
  return listOriginFeats();
}

function cantripMeets(kind, cantripName) {
  const t = WARLOCK_CANTRIP_TRAITS[String(cantripName || '').trim().toLowerCase()];
  if (!t || !t.damage) return false;
  if (kind === 'damage_attack') return t.attack;
  if (kind === 'damage_range10') return t.range10;
  return true;
}

function knownCantripList(knownCantrips) {
  const list = typeof knownCantrips === 'string' ? safeParse(knownCantrips, []) : knownCantrips;
  return Array.isArray(list) ? list.map((c) => String(c?.name ?? c ?? '').trim().toLowerCase()).filter(Boolean) : [];
}

/** The valid choices for an invocation that takes one, given the character. */
export function choicesFor(entry, ctx = {}) {
  if (entry.choiceKind === 'cantrip') {
    return knownCantripList(ctx.knownCantrips).filter((c) => cantripMeets(entry.requires.cantrip, c));
  }
  if (entry.choiceKind === 'origin_feat') return originFeatOptions().map((f) => f.key);
  return null;
}

function normChoice(entry, choice) {
  if (choice == null || !String(choice).trim()) return null;
  const s = String(choice).trim();
  if (entry.choiceKind === 'cantrip') return s.toLowerCase();
  if (entry.choiceKind === 'origin_feat') {
    const lower = s.toLowerCase();
    const feat = originFeatOptions().find((f) => f.key === lower || f.name.toLowerCase() === lower);
    return feat ? feat.key : lower;
  }
  return null;
}

// --- eligibility -----------------------------------------------------

function holds(list, key) {
  return list.some((inv) => inv.key === key);
}

/**
 * Can `pick` ({ key, choice }) be learned? ctx: { warlockLevel, held,
 * batch (other picks learned at the same time), knownCantrips }.
 * Returns { ok, reason, inv } — inv is the normalised { key, choice }.
 */
export function checkInvocation(pick, ctx = {}) {
  const key = normKey(typeof pick === 'string' ? pick : pick?.key);
  const entry = BY_KEY.get(key);
  if (!entry) return { ok: false, reason: `'${pick?.key ?? pick}' is not a 2024 Eldritch Invocation` };
  const level = Number(ctx.warlockLevel) || 0;
  const held = ctx.held || [];
  const together = [...held, ...(ctx.batch || [])];
  if (level < entry.minLevel) return { ok: false, reason: `${entry.name} requires Warlock level ${entry.minLevel} (you are Warlock level ${level})` };
  if (entry.requires.pact && !holds(together, PACT_INVOCATION_KEYS[entry.requires.pact])) {
    return { ok: false, reason: `${entry.name} requires Pact of the ${cap(entry.requires.pact)}` };
  }
  if (entry.requires.invocation && !holds(together, entry.requires.invocation)) {
    return { ok: false, reason: `${entry.name} requires ${BY_KEY.get(entry.requires.invocation).name}` };
  }
  const choice = normChoice(entry, typeof pick === 'object' ? pick?.choice : null);
  if (entry.choiceKind && !choice) {
    return { ok: false, reason: `${entry.name} needs a choice — ${entry.choiceKind === 'cantrip' ? 'name the cantrip' : 'name the Origin feat'}` };
  }
  if (entry.choiceKind === 'cantrip') {
    if (!knownCantripList(ctx.knownCantrips).includes(choice)) {
      return { ok: false, reason: `${entry.name}: you do not know the cantrip '${choice}'` };
    }
    if (!cantripMeets(entry.requires.cantrip, choice)) {
      return { ok: false, reason: `${entry.name}: '${choice}' does not meet "${entry.prereqText.replace(/^Level \d+\+, /, '')}"` };
    }
  }
  if (entry.choiceKind === 'origin_feat' && !originFeatOptions().some((f) => f.key === choice)) {
    return { ok: false, reason: `${entry.name}: '${choice}' is not an Origin feat` };
  }
  // Duplicates are judged against `held` only (the batch caller puts the
  // EARLIER picks there), so the second copy of a pick is the one refused.
  if (entry.repeatable) {
    if (held.some((inv) => inv.key === key && inv.choice === choice)) {
      return { ok: false, reason: `${entry.name} is already held for '${choice}' — a repeat needs a different choice` };
    }
  } else if (holds(held, key)) {
    return { ok: false, reason: `${entry.name} is already held` };
  }
  return { ok: true, reason: null, inv: { key, choice } };
}

/** Held invocations that `inv` is a prerequisite for (so it can't be replaced). */
export function dependentsOf(inv, held) {
  const pact = PACT_BY_INVOCATION[inv.key];
  return held.filter((h) => {
    const e = BY_KEY.get(h.key);
    if (!e) return false;
    if (pact && e.requires.pact === pact) return true;
    return e.requires.invocation === inv.key;
  });
}

/**
 * Validate a level-up / learn batch. picks: [{ key, choice }].
 * ctx: { warlockLevel, held, knownCantrips, due } — due caps the count.
 * Each pick is judged against the held list plus the OTHER picks (the
 * "at the same time" rule), then the batch is checked for duplicates.
 * Returns { ok, errors, picks (normalised), next (held + picks) }.
 */
export function validateNewInvocations(picks, ctx = {}) {
  const errors = [];
  if (!Array.isArray(picks)) return { ok: false, errors: ['must be a list of { key, choice }'], picks: [], next: ctx.held || [] };
  const held = ctx.held || [];
  if (ctx.due != null && picks.length > ctx.due) {
    errors.push(`Warlock level ${ctx.warlockLevel} allows ${ctx.due} new invocation${ctx.due === 1 ? '' : 's'}, got ${picks.length}`);
    return { ok: false, errors, picks: [], next: held };
  }
  const normalised = picks.map((p) => {
    const key = normKey(typeof p === 'string' ? p : p?.key);
    const entry = BY_KEY.get(key);
    return { key, choice: entry ? normChoice(entry, typeof p === 'object' ? p?.choice : null) : null };
  });
  const accepted = [];
  normalised.forEach((p, i) => {
    // Prerequisites see the held list + every other pick; duplicates see
    // the held list + the picks before this one (checkInvocation).
    const r = checkInvocation(p, { ...ctx, held: [...held, ...normalised.slice(0, i)], batch: normalised.slice(i + 1) });
    if (!r.ok) errors.push(r.reason);
    else accepted.push(r.inv);
  });
  return { ok: errors.length === 0, errors, picks: accepted, next: [...held, ...accepted] };
}

/**
 * Validate a level-up replacement: from (held) -> to (new). The new one
 * is judged against the held list WITHOUT `from` (you must qualify
 * without the one you give up), and `from` can't be a prerequisite of
 * another held invocation.
 */
export function validateReplacement(from, to, ctx = {}) {
  const held = ctx.held || [];
  const fromKey = normKey(typeof from === 'string' ? from : from?.key);
  const fromEntry = BY_KEY.get(fromKey);
  if (!fromEntry) return { ok: false, errors: [`'${from?.key ?? from}' is not an Eldritch Invocation`] };
  const fromChoice = normChoice(fromEntry, typeof from === 'object' ? from?.choice : null);
  const idx = held.findIndex((h) => h.key === fromKey && (fromEntry.repeatable ? h.choice === fromChoice : true));
  if (idx === -1) return { ok: false, errors: [`${fromEntry.name}${fromChoice ? ` (${fromChoice})` : ''} is not one of your invocations`] };
  const removed = held[idx];
  const rest = held.filter((_, i) => i !== idx);
  const deps = dependentsOf(removed, rest);
  if (deps.length) {
    return { ok: false, errors: [`${fromEntry.name} can't be replaced while it is a prerequisite for ${deps.map((d) => BY_KEY.get(d.key).name).join(', ')}`] };
  }
  const r = checkInvocation(to, { ...ctx, held: rest, batch: [] });
  if (!r.ok) return { ok: false, errors: [r.reason] };
  if (r.inv.key === removed.key && r.inv.choice === removed.choice) {
    return { ok: false, errors: [`replacing ${fromEntry.name} with itself changes nothing`] };
  }
  return { ok: true, errors: [], removed, added: r.inv, next: [...rest, r.inv] };
}

/**
 * Validate a whole list (the creator's draft save): every entry must be
 * learnable against the rest at this Warlock level, within the known cap.
 */
export function validateInvocationSet(list, ctx = {}) {
  if (!Array.isArray(list)) return { ok: false, errors: ['invocations: must be a list of { key, choice }'] };
  const cap = invocationsKnownAt(ctx.warlockLevel);
  if (list.length > cap) {
    return { ok: false, errors: [`invocations: Warlock level ${Number(ctx.warlockLevel) || 0} knows ${cap} invocation${cap === 1 ? '' : 's'}, got ${list.length}`] };
  }
  const r = validateNewInvocations(list, { ...ctx, held: [], due: null });
  return r.ok ? { ok: true, errors: [], list: r.picks } : { ok: false, errors: r.errors.map((e) => `invocations: ${e}`) };
}

/** Eligibility of every invocation for the picker. */
export function invocationOptions(ctx = {}) {
  const held = ctx.held || [];
  return WARLOCK_INVOCATIONS.map((entry) => {
    const choices = choicesFor(entry, ctx);
    let eligible;
    let reason = null;
    if (entry.choiceKind) {
      const open = (choices || []).filter((c) => checkInvocation({ key: entry.key, choice: c }, { ...ctx, held, batch: [] }).ok);
      const probe = checkInvocation({ key: entry.key, choice: open[0] ?? choices?.[0] ?? '__none__' }, { ...ctx, held, batch: [] });
      eligible = open.length > 0;
      if (!eligible) reason = (choices || []).length === 0 && Number(ctx.warlockLevel) >= entry.minLevel
        ? (entry.choiceKind === 'cantrip' ? `you know no cantrip that meets "${entry.prereqText.replace(/^Level \d+\+, /, '')}"` : 'no Origin feat is left to take')
        : probe.reason;
      const choiceNames = entry.choiceKind === 'origin_feat'
        ? Object.fromEntries(originFeatOptions().map((f) => [f.key, f.name]))
        : Object.fromEntries(open.map((c) => [c, c.replace(/\b\w/g, (ch) => ch.toUpperCase())]));
      return { ...pickFields(entry), choices: open, choiceNames, eligible, reason };
    }
    const r = checkInvocation({ key: entry.key }, { ...ctx, held, batch: [] });
    eligible = r.ok;
    reason = r.reason;
    return { ...pickFields(entry), choices: null, eligible, reason };
  });
}

function pickFields(entry) {
  return {
    key: entry.key, name: entry.name, minLevel: entry.minLevel, prereqText: entry.prereqText,
    effect: entry.effect, repeatable: entry.repeatable, choiceKind: entry.choiceKind, requires: entry.requires,
  };
}

/** Held invocations with their display fields (sheet / DM prompt). */
export function describeInvocations(list) {
  return (list || []).map((inv) => {
    const e = BY_KEY.get(inv.key);
    if (!e) return null;
    let choiceName = inv.choice;
    if (e.choiceKind === 'origin_feat') choiceName = originFeatOptions().find((f) => f.key === inv.choice)?.name || inv.choice;
    if (e.choiceKind === 'cantrip' && inv.choice) choiceName = inv.choice.replace(/\b\w/g, (c) => c.toUpperCase());
    return { key: inv.key, name: e.name, choice: inv.choice, choiceName, effect: e.effect };
  }).filter(Boolean);
}

/** One line for the DM prompt, or null when none are held. */
export function formatInvocationsForPrompt(list) {
  const held = describeInvocations(list);
  if (!held.length) return null;
  return held.map((h) => `${h.name}${h.choiceName ? ` (${h.choiceName})` : ''} — ${h.effect}`).join('; ');
}

/**
 * Lessons of the First Ones grants an Origin feat: keep characters.feats
 * in step with the held Lessons choices. Adds a feats entry for each new
 * choice, removes the entry of a replaced-away choice. Entries this
 * service adds carry source 'Lessons of the First Ones'; no other feat
 * is touched.
 */
export function syncLessonsFeats(featsRaw, beforeList, afterList, level) {
  const feats = typeof featsRaw === 'string' ? safeParse(featsRaw, []) : (Array.isArray(featsRaw) ? [...featsRaw] : []);
  const lessons = (l) => (l || []).filter((i) => i.key === 'lessons_of_the_first_ones' && i.choice).map((i) => i.choice);
  const before = lessons(beforeList);
  const after = lessons(afterList);
  let out = Array.isArray(feats) ? [...feats] : [];
  for (const gone of before.filter((c) => !after.includes(c))) {
    const i = out.findIndex((f) => f?.source === 'Lessons of the First Ones' && f?.key === gone);
    if (i !== -1) out.splice(i, 1);
  }
  for (const added of after.filter((c) => !before.includes(c))) {
    const feat = originFeatOptions().find((f) => f.key === added);
    out.push({ key: added, name: feat?.name || added, abilityChoice: null, choices: null, acquiredAtLevel: level ?? null, source: 'Lessons of the First Ones' });
  }
  const changed = JSON.stringify(out) !== JSON.stringify(feats);
  return { changed, feats: out };
}

function cap(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default {
  getInvocation, listInvocations, invocationsKnownAt, warlockLevelOf, parseInvocations, pactFromInvocations,
  withPact, originFeatOptions, choicesFor, checkInvocation, dependentsOf, validateNewInvocations,
  validateReplacement, validateInvocationSet, invocationOptions, describeInvocations,
  formatInvocationsForPrompt, syncLessonsFeats,
};
