/**
 * Druid class service — prepared-spell validation ONLY (mechanics
 * hooks Family 3, 2026-11-09, staged — NOT pushed, NOT gated).
 *
 * 2024 PHB rule: a druid prepares a number of druid spells equal
 * to their Wisdom modifier + their druid level, minimum 1.
 * Verified at build against the live build, not carried from the
 * 2014 table: `server/config/levelProgression.js`
 * getSpellsPrepared has no druid arm and falls through to
 * `Math.max(1, mod + lvl)` for druids (same fall-through as
 * cleric and wizard), and the wizard PUT block in
 * server/routes/character.js states the same formula for the
 * wizard's Int-mod twin. Zach's physical-book check at the gate
 * remains the final word (the druid circle lists are gateCheck
 * in the registry).
 *
 * Circle spells are ALWAYS PREPARED and never count against the
 * cap. The always-prepared list is NOT computed here: the caller
 * (routes/character.js PUT + level-up blocks) reads it from
 * `subclassService.druidCircleSpellsAtLevel`, exactly as the
 * paladin block reads `paladinOathSpellsAtLevel`. For Circle of
 * the Land the caller reads the stored land type from
 * `subclass_choices_json` (migration 103, key `land_type`) and
 * passes it through — a Land druid with no stored land type gets
 * NO exclusion (the helper returns [] and the validator counts
 * everything), never a default land. See the route blocks.
 *
 * Signature follows the paladin/bard/blackguard validators —
 * (mod, level, preparedList, alwaysPreparedList), mod FIRST —
 * NOT the artificer order (level first, mod last). Callers must
 * not mix the two orders.
 */
export function preparedSpellsMax(wisMod, druidLevel) {
  const level = Math.min(20, Math.max(1, Math.trunc(druidLevel) || 1));
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
