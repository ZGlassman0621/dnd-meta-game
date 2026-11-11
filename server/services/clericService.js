/**
 * Cleric class service — prepared-spell validation ONLY (mechanics
 * hooks Family 3, 2026-11-09, staged — NOT pushed, NOT gated).
 *
 * 2024 PHB rule: a cleric prepares a number of cleric spells equal
 * to their Wisdom modifier + their cleric level, minimum 1.
 * Verified at build against the live build, not carried from the
 * 2014 table: `server/config/levelProgression.js`
 * getSpellsPrepared has no cleric arm and falls through to
 * `Math.max(1, mod + lvl)` for clerics (same fall-through as
 * druid and wizard), and the wizard PUT block in
 * server/routes/character.js states the same formula for the
 * wizard's Int-mod twin. Zach's physical-book check at the gate
 * remains the final word (the cleric domain lists are gateCheck
 * in the registry).
 *
 * Domain spells are ALWAYS PREPARED and never count against the
 * cap. The always-prepared list is NOT computed here: the caller
 * (routes/character.js PUT + level-up blocks) reads it from
 * `subclassService.clericDomainSpellsAtLevel`, exactly as the
 * paladin block reads `paladinOathSpellsAtLevel`. This service
 * only enforces the cap against a caller-supplied list.
 *
 * Signature follows the paladin/bard/blackguard validators —
 * (mod, level, preparedList, alwaysPreparedList), mod FIRST —
 * NOT the artificer order (level first, mod last). Callers must
 * not mix the two orders.
 */
export function preparedSpellsMax(wisMod, clericLevel) {
  const level = Math.min(20, Math.max(1, Math.trunc(clericLevel) || 1));
  const mod = Number.isFinite(Number(wisMod)) ? Math.trunc(Number(wisMod)) : 0;
  return Math.max(1, mod + level);
}

export function validatePreparedSpells(wisMod, level, preparedList, alwaysPreparedList) {
  const max = preparedSpellsMax(wisMod, level);
  // Case-insensitive match (2026-11-06, item 13): same insurance as
  // the blackguard/paladin/artificer validators — an always-prepared
  // name typed in a different case than the data must still be
  // excluded.
  const norm = (s) => String(s || '').trim().toLowerCase();
  const always = new Set((alwaysPreparedList || []).map(norm));
  const counted = (preparedList || []).filter((sp) => !always.has(norm(sp)));
  return { max, counted: counted.length, ok: counted.length <= max, over: Math.max(0, counted.length - max) };
}

export default {
  preparedSpellsMax,
  validatePreparedSpells,
};
