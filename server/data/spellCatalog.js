/**
 * Spell Catalog (Combat Pipeline #12).
 * Canonical spell data: components, cast time, concentration, etc.
 * D&D 2024 PHB + official expansions (v1.0.193: data split into
 * spellCatalogData.js; this file is the lookup/effect logic).
 */

import { SPELL_DATA_ENTRIES, SPELL_DATA_EFFECTS } from './spellCatalogData.js';

// The catalog itself lives in spellCatalogData.js (v1.0.193): the full
// 2024 PHB list plus official expansions — 542 spells, each with
// classes, source, a fresh-worded description, save and condition
// fields. This module is the LOGIC: lookups, saves, effect specs.
export const SPELL_CATALOG = SPELL_DATA_ENTRIES;

export function lookupSpell(name) {
  if (!name) return null;
  return SPELL_CATALOG[name.toLowerCase().trim()] || null;
}

/**
 * Async lookup: checks custom_spells table first, then SRD catalog.
 * Use this when homebrew spells may exist.
 */
export async function lookupSpellFull(name, dbGet) {
  if (!name || !dbGet) return lookupSpell(name);
  try {
    const row = await dbGet('SELECT * FROM custom_spells WHERE name = LOWER(?) LIMIT 1', [name.trim()]);
    if (row) {
      return {
        name: row.display_name,
        level: row.level,
        school: row.school,
        castTime: row.cast_time,
        range: row.range_text,
        components: row.components ? row.components.split(',').map(s => s.trim()) : [],
        material: row.material_desc || undefined,
        concentration: Boolean(row.concentration),
        duration: row.duration_text,
        custom: true,
      };
    }
  } catch (e) { /* table may not exist yet */ }
  return lookupSpell(name);
}

export function isConcentrationSpell(name) {
  const spell = lookupSpell(name);
  return spell?.concentration === true;
}

/**
 * Saving-throw ability for the catalog's save-based spells
 * (combat-real B5). Attack-roll spells (Fire Bolt, Guiding Bolt,
 * Scorching Ray…) are deliberately absent — they resolve through the
 * ATTACK marker instead.
 */
// Derived: every catalog entry that forces a saving throw carries its
// `save` field, so the map is built from the entries (single source of
// truth — the hand-maintained map retired in v1.0.193).
export const SPELL_SAVES = Object.fromEntries(
  Object.entries(SPELL_CATALOG)
    .filter(([, spell]) => spell && spell.save)
    .map(([name, spell]) => [name, spell.save])
);

/** 'dex' | 'con' | 'wis' | 'cha' | … or null when the spell has no save. */
export function spellSaveAbility(name) {
  if (!name) return null;
  const spell = lookupSpell(name);
  if (spell?.save) return spell.save;
  return SPELL_SAVES[String(name).toLowerCase().trim()] || null;
}

/**
 * Damage / healing data (spell-damage build, 2026-10-21). Until now the
 * catalog knew a spell's level, school, and save — but not its numbers,
 * so every damage and healing amount in the game was DM-invented. Values
 * are the 2024 SRD's. Stated approximations: Eldritch Blast's beams are
 * modeled as scaled dice; Scorching Ray's damage is PER RAY (one ATTACK
 * marker per ray, as with Extra Attack). Hex and Hunter's Mark carry
 * only their per-hit rider damage; the raise spells carry no entry —
 * their mechanics are returns-to-1-HP, handled (or deferred) elsewhere.
 */
export const SPELL_EFFECTS = SPELL_DATA_EFFECTS;

function parseEffectDice(spec) {
  const m = String(spec || '').trim().match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!m) return null;
  return { count: parseInt(m[1], 10), sides: parseInt(m[2], 10), modifier: m[3] ? parseInt(m[3], 10) : 0 };
}

/** Multi-term dice pools (Chaos Bolt 2d8+1d6, Ice Storm 2d8+4d6).
 *  Returns { terms: [{count, sides}], modifier } or null. */
function parseDiceTerms(spec) {
  const s = String(spec || '').trim().toLowerCase().replace(/\s+/g, '');
  if (!s || !s.includes('d')) return null;
  const terms = [];
  let modifier = 0;
  for (const tok of s.split('+')) {
    const dm = /^(\d+)d(\d+)([+-]\d+)?$/.exec(tok);
    if (dm) { terms.push({ count: parseInt(dm[1], 10), sides: parseInt(dm[2], 10) }); if (dm[3]) modifier += parseInt(dm[3], 10); continue; }
    if (/^-?\d+$/.test(tok)) { modifier += parseInt(tok, 10); continue; }
    return null;
  }
  return terms.length > 1 ? { terms, modifier } : null;
}

function termsSpecString(terms, modifier) {
  const dice = terms.map(t => `${t.count}d${t.sides}`).join('+');
  return `${dice}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ''}`;
}

/**
 * The concrete dice for a spell as cast: base spec, scaled by slot level
 * (upcast) or by caster level (damage cantrips, tiers at 5/11/17).
 * Returns { kind, count, sides, modifier, addCastingMod, damageType,
 * damageOnSave, spec } or null when the spell has no damage/healing data.
 * `modifier` here is only the FLAT part (e.g. Magic Missile's +3); the
 * casting-ability modifier is separate (addCastingMod) because only the
 * caller knows the caster.
 */
export function spellEffectSpec(name, { slotLevel = null, casterLevel = 1, includeConditional = false } = {}) {
  if (!name) return null;
  const key = String(name).toLowerCase().trim();
  const fx = SPELL_EFFECTS[key];
  if (!fx) return null;
  // repo-check-fixes-spells: an entry with a `condition` (Power Word
  // Kill above 100 HP, Earthquake's collapse, Wish stress, Meld into
  // Stone, Alter Self's natural weapons) deals its damage only in that
  // circumstance — never automatically on cast. Cast paths get null;
  // callers that only classify (spellIsHarmful) opt in.
  if (fx.condition && !includeConditional) return null;
  const spell = lookupSpell(name);
  const baseLevel = spell?.level ?? 0;
  const kind = fx.healing ? 'healing' : 'damage';
  const extras = {
    ...(fx.followUps ? { followUps: fx.followUps } : {}),
    ...(fx.condition ? { condition: fx.condition } : {}),
  };
  if (Array.isArray(fx.damageParts) && fx.damageParts.length && !fx.flat) {
    // Per-type split of one simultaneous pool (Meteor Swarm 20d6 fire +
    // 20d6 bludgeoning): each term carries its own damageType, so a
    // resistance/immunity can apply per type. An upcast die is shared
    // evenly across the parts with that die size when it divides
    // (Jallarzi's +2d10 = +1d10 each, Flame Strike +2d6 = +1d6 each);
    // otherwise it grows the first matching part (Ice Storm's 2d10).
    const terms = [];
    for (const p of fx.damageParts) {
      const d = parseEffectDice(p.damage);
      if (!d) return null;
      terms.push({ count: d.count, sides: d.sides, damageType: p.damageType || null });
    }
    let modifier = 0;
    if (slotLevel != null && slotLevel > baseLevel) {
      const up = parseEffectDice(fx.upcastDamage);
      if (up) {
        const steps = slotLevel - baseLevel;
        const matching = terms.filter(t => t.sides === up.sides);
        if (matching.length > 1 && up.count % matching.length === 0) {
          for (const t of matching) t.count += (up.count / matching.length) * steps;
        } else if (matching.length) {
          matching[0].count += up.count * steps;
        }
        modifier += up.modifier * steps;
      }
    }
    return {
      kind: 'damage', count: terms[0].count, sides: terms[0].sides, modifier, terms,
      parts: terms.map(t => ({ dice: `${t.count}d${t.sides}`, damageType: t.damageType })),
      addCastingMod: !!fx.addCastingMod,
      damageType: fx.damageType || null,
      damageOnSave: fx.damageOnSave || null,
      spec: termsSpecString(terms, modifier),
      ...extras
    };
  }
  if (fx.flat) {
    // Flat-amount spells (Heal 70, Mass Heal 700, Guardian of Faith 20,
    // Power Word Heal 'full'): nothing to roll — the caller applies the
    // amount (plus any flat per-slot upcast) immediately.
    const raw = fx.healing || fx.damage;
    let flatAmount = raw === 'full' ? 'full' : parseInt(raw, 10);
    const upFlatRaw = kind === 'healing' ? fx.upcastHealing : fx.upcastDamage;
    const upFlat = upFlatRaw && !String(upFlatRaw).includes('d') ? parseInt(upFlatRaw, 10) : 0;
    if (flatAmount !== 'full' && slotLevel != null && slotLevel > baseLevel && upFlat) {
      flatAmount += upFlat * (slotLevel - baseLevel);
    }
    return {
      kind, count: 0, sides: 0, modifier: 0, flat: true, flatAmount,
      addCastingMod: !!fx.addCastingMod,
      damageType: fx.damageType || null,
      damageOnSave: fx.damageOnSave || null,
      spec: flatAmount === 'full' ? 'full' : String(flatAmount),
      ...extras
    };
  }
  const base = parseEffectDice(fx.healing || fx.damage);
  if (!base) {
    // Multi-term pool: scale the term whose die matches the upcast die
    // (Ice Storm's bludgeoning 2d8 grows; its cold 4d6 does not).
    const multi = parseDiceTerms(fx.healing || fx.damage);
    if (!multi) return null;
    const terms = multi.terms.map(t => ({ ...t }));
    if (fx.cantripScale) {
      const tier = casterLevel >= 17 ? 4 : casterLevel >= 11 ? 3 : casterLevel >= 5 ? 2 : 1;
      for (const t of terms) t.count *= tier;
    } else if (slotLevel != null && slotLevel > baseLevel) {
      const up = parseEffectDice(kind === 'healing' ? fx.upcastHealing : fx.upcastDamage);
      if (up) {
        const target = terms.find(t => t.sides === up.sides);
        if (target) target.count += up.count * (slotLevel - baseLevel);
        multi.modifier += up.modifier * (slotLevel - baseLevel);
      }
    }
    return {
      kind, count: terms[0].count, sides: terms[0].sides, modifier: multi.modifier, terms,
      addCastingMod: !!fx.addCastingMod,
      damageType: fx.damageType || null,
      damageOnSave: fx.damageOnSave || null,
      spec: termsSpecString(terms, multi.modifier),
      ...extras
    };
  }
  let { count, sides, modifier } = base;
  if (fx.cantripScale) {
    const tier = casterLevel >= 17 ? 4 : casterLevel >= 11 ? 3 : casterLevel >= 5 ? 2 : 1;
    count *= tier;
  } else if (slotLevel != null && slotLevel > baseLevel) {
    const up = parseEffectDice(kind === 'healing' ? fx.upcastHealing : fx.upcastDamage);
    if (up && up.sides === sides) {
      const steps = slotLevel - baseLevel;
      count += up.count * steps;
      modifier += up.modifier * steps;
    }
  }
  return {
    kind, count, sides, modifier,
    addCastingMod: !!fx.addCastingMod,
    damageType: fx.damageType || null,
    damageOnSave: fx.damageOnSave || null,
    spec: `${count}d${sides}${modifier > 0 ? `+${modifier}` : modifier < 0 ? `${modifier}` : ''}`,
    ...extras
  };
}

/**
 * Every saving throw the book imposes for a spell (repo-check-fixes-
 * spells). `save` on the entry stays the single ability the engine
 * rolls on cast; `saves` lists all of them with their trigger, and a
 * `conditional: true` save (Forcecage, Magic Circle) happens only if
 * the creature acts — never on cast. Falls back to [{ ability: save }].
 */
export function spellSaveList(name) {
  const spell = lookupSpell(name);
  if (!spell) return [];
  if (Array.isArray(spell.saves) && spell.saves.length) return spell.saves.map(s => ({ ...s }));
  return spell.save ? [{ ability: spell.save }] : [];
}

/**
 * The material-component specifics for a spell, or null (repo-check-
 * fixes-spells item 9): { text, costGp, consumed, match }. `consumed:
 * null` means the source does not yet say. Only these are enforced at
 * cast time: a component with a cost, or one the spell consumes — a
 * component pouch or focus stands in for everything else.
 */
export function spellMaterial(name) {
  const spell = lookupSpell(name);
  return spell?.material ? { ...spell.material } : null;
}

export function materialIsEnforced(material) {
  return !!material && ((Number(material.costGp) || 0) > 0 || material.consumed === true);
}

/**
 * Combat item 6: spells whose saves repeat at the end of the afflicted
 * creature's turn (each wording verified against its catalog
 * description). Damage-triggered repeats (Dominate, which repeats
 * when the target takes damage) and two-stage spells (Sleep, which
 * incapacitates first and only falls unconscious on a second failure)
 * are NOT here — their triggers need their own hooks, deferred.
 */
export const REPEAT_SAVE_SPELLS = new Set([
  'blindness/deafness',
  'cause fear',
  'hold monster',
  'hold person',
  'power word stun',
  "tasha's hideous laughter",
]);

/**
 * Flesh to Stone alone counts: three successes end it, three failures
 * petrify. It repeats at end of turn like the set above, but its
 * resolution counts instead of clearing on the first success.
 */
export const COUNTING_SAVE_SPELLS = new Set(['flesh to stone']);

export default { SPELL_CATALOG, lookupSpell, isConcentrationSpell, SPELL_SAVES, spellSaveAbility, SPELL_EFFECTS, spellEffectSpec, REPEAT_SAVE_SPELLS, COUNTING_SAVE_SPELLS, spellSaveList, spellMaterial, materialIsEnforced };
