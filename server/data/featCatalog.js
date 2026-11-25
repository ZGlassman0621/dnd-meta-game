/**
 * Feat catalog — the server's read of client/src/data/feats.json, the
 * level-up picker's catalog (repo-check-fixes-feats, 2026-11-25).
 *
 * The level-up route used to trust the client for every feat the registry
 * does not carry structured fields for. It now re-checks the 2024 PHB
 * prerequisites the catalog records:
 *   - minLevel              — General feats Level 4+, Epic Boons Level 19+
 *   - prerequisiteScore     — every listed score (e.g. Dexterity 13+)
 *   - prerequisiteScoreAny  — any one listed score ("Strength or Dexterity 13+")
 *   - prerequisiteFeature 'fighting_style' — the character already has a
 *     fighting style (the Fighting Style feature)
 *   - repeatable            — a non-Repeatable feat cannot be taken twice
 *   - abilityIncrease       — the +1 must be one of the book's options, and
 *     Resilient (`lackingSaveProficiency`) only an ability the character
 *     lacks saving throw proficiency in; `max` caps it (20, Epic Boons 30)
 * The armor / shield training and Spellcasting / Pact Magic prerequisites
 * are recorded as `prerequisiteFeature` but not checked (no reliable
 * source for them on the character yet).
 *
 * Read the same way merchantLootTables reads equipment.json.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CATALOG = JSON.parse(readFileSync(join(__dirname, '../../client/src/data/feats.json'), 'utf-8'));
const CLASSES = JSON.parse(readFileSync(join(__dirname, '../../client/src/data/classes.json'), 'utf-8'));

const idOf = (x) => String(typeof x === 'string' ? x : (x?.key || x?.name || ''))
  .toLowerCase().trim().replace(/[\s-]+/g, '_');

/** The catalog entry for a feat key or name, or null. */
export function getCatalogFeat(keyOrName) {
  const id = idOf(keyOrName);
  if (!id) return null;
  if (CATALOG[id]) return { key: id, ...CATALOG[id] };
  for (const [k, v] of Object.entries(CATALOG)) {
    if (idOf(v.name) === id) return { key: k, ...v };
  }
  return null;
}

export function listCatalogFeats() {
  return Object.entries(CATALOG).map(([key, v]) => ({ key, ...v }));
}

/** The starting class's two saving throws, plus any ability an earlier
 *  Resilient took. */
export function saveProficienciesFor(characterClass, heldFeats) {
  const cls = CLASSES[idOf(characterClass)];
  const out = new Set(Array.isArray(cls?.savingThrows) ? cls.savingThrows : []);
  for (const f of heldFeats || []) {
    if (f && typeof f === 'object' && idOf(f) === 'resilient' && f.abilityChoice) out.add(String(f.abilityChoice).toLowerCase());
  }
  return [...out];
}

function abilityOptions(entry, saveProficiencies) {
  const inc = entry?.abilityIncrease;
  if (!inc) return [];
  let opts = Array.isArray(inc.choice) ? inc.choice : (typeof inc.ability === 'string' ? [inc.ability] : []);
  if (inc.lackingSaveProficiency) opts = opts.filter((ab) => !(saveProficiencies || []).includes(ab));
  return opts;
}

/**
 * Judge one level-up feat pick against the catalog.
 * ctx: { level (the character level after this level-up), scores,
 *        heldFeats, hasFightingStyle, saveProficiencies, abilityChoice }
 * Returns { error } or { abilityChoice, abilityMax }.
 */
export function checkCatalogFeatPick(entry, ctx = {}) {
  if (!entry) return { error: 'unknown feat' };
  const name = entry.name;
  if (entry.key === 'ability_score_improvement') {
    return { error: 'Ability Score Improvement is taken as an ASI (type "asi"), not as a feat pick' };
  }
  const level = Number(ctx.level) || 0;
  if (entry.minLevel && level < Number(entry.minLevel)) {
    return { error: `${name} requires level ${entry.minLevel}+` };
  }
  const s = ctx.scores || {};
  const all = entry.prerequisiteScore;
  const any = entry.prerequisiteScoreAny;
  if ((all && !Object.entries(all).every(([ab, min]) => Number(s[ab] ?? 0) >= Number(min)))
    || (any && !Object.entries(any).some(([ab, min]) => Number(s[ab] ?? 0) >= Number(min)))) {
    return { error: `${name} requires ${entry.prerequisites}` };
  }
  if (entry.prerequisiteFeature === 'fighting_style' && !ctx.hasFightingStyle) {
    return { error: `${name} requires the Fighting Style feature` };
  }
  if (!entry.repeatable) {
    const want = [idOf(entry.key), idOf(entry.name)];
    if ((ctx.heldFeats || []).some((h) => want.includes(idOf(h)) || want.includes(idOf(h?.name)))) {
      return { error: `${name} is already taken and is not repeatable` };
    }
  }
  const opts = abilityOptions(entry, ctx.saveProficiencies);
  const sent = ctx.abilityChoice ? String(ctx.abilityChoice).toLowerCase() : null;
  if (!entry.abilityIncrease) {
    if (sent) return { error: `${name} grants no ability score increase` };
    return { abilityChoice: null, abilityMax: 20 };
  }
  if (opts.length === 0) {
    return { error: `${name}: no eligible ability (you already have saving throw proficiency in every ability)` };
  }
  if (sent && !opts.includes(sent)) {
    if (opts.length === 1 && !entry.abilityIncrease.lackingSaveProficiency) {
      return { error: `${name} increases ${opts[0].toUpperCase()} only` };
    }
    const why = entry.abilityIncrease.lackingSaveProficiency ? ' you lack saving throw proficiency in' : '';
    return { error: `${name} increases one of ${opts.map((o) => o.toUpperCase()).join(', ')}${why ? ` (an ability${why})` : ''}` };
  }
  if (!sent && opts.length > 1) {
    return { error: `${name}: choose which ability to increase (${opts.map((o) => o.toUpperCase()).join(', ')})` };
  }
  const max = Number(entry.abilityIncrease.max);
  return { abilityChoice: sent || opts[0], abilityMax: Number.isFinite(max) && max > 0 ? max : 20 };
}
