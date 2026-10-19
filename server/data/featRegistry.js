/**
 * Feat Registry — data-driven lookup for feat mechanical effects.
 *
 * Replaces the hardcoded if-chain that used to live in dmPromptBuilder.js.
 * Core D&D 5e feats are defined below as data; homebrew rulesets (e.g.,
 * Nardo's Manual of Martial Mastery) are loaded from JSON in
 * server/data/homebrew/.
 *
 * This module is the single source of truth for "what does this feat do?"
 * in the DM prompt. The feat catalog endpoint (future) and character
 * creation/level-up selection UIs should read from here, not from
 * hardcoded lists.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOMEBREW_DIR = __dirname;
const HOMEBREW_PREFIX = 'homebrew-';

const CORE_FEATS = [
  { key: 'dungeon_delver', name: 'Dungeon Delver', effect: 'Advantage on Perception/Investigation to detect secret doors; advantage on saves vs traps; resistance to trap damage' },
  { key: 'alert', name: 'Alert', effect: '+5 initiative; cannot be surprised; hidden creatures do not gain advantage' },
  { key: 'observant', name: 'Observant', effect: '+5 passive Perception and Investigation; can read lips' },
  { key: 'lucky', name: 'Lucky', effect: '3 luck points to reroll d20s per long rest' },
  { key: 'sentinel', name: 'Sentinel', effect: 'Opportunity attacks reduce speed to 0; can attack when ally is attacked' },
  { key: 'sharpshooter', name: 'Sharpshooter', effect: 'No disadvantage at long range; ignore cover; can take -5 to hit for +10 damage' },
  { key: 'great_weapon_master', name: 'Great Weapon Master', effect: 'Bonus action attack on crit/kill; can take -5 to hit for +10 damage' },
  { key: 'polearm_master', name: 'Polearm Master', effect: 'Bonus action d4 attack; opportunity attacks when enemies enter reach' },
  { key: 'war_caster', name: 'War Caster', effect: 'Advantage on concentration saves; can cast spells as opportunity attacks' },
  { key: 'mobile', name: 'Mobile', effect: '+10 speed; no opportunity attacks from creatures you attack' },
  { key: 'resilient', name: 'Resilient', effect: 'Proficiency in one saving throw' },
  { key: 'skulker', name: 'Skulker', effect: 'Can hide when lightly obscured; missed ranged attacks do not reveal position' },
  { key: 'mage_slayer', name: 'Mage Slayer', effect: 'Reaction attack when adjacent creature casts spell; targets have disadvantage on concentration' },
  { key: 'savage_attacker', name: 'Savage Attacker', effect: 'Reroll melee weapon damage once per turn' },
];

export function normalizeFeatName(name) {
  if (!name || typeof name !== 'string') return '';
  return name.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function loadHomebrewRuleset(rulesetId) {
  const path = join(HOMEBREW_DIR, `${HOMEBREW_PREFIX}${rulesetId}.json`);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    const feats = [];
    const pushFeat = (f, category) => {
      if (!f || !f.name) return;
      const parts = [];
      if (f.prerequisite) parts.push(`Prerequisite: ${f.prerequisite}.`);
      if (f.asi) parts.push(f.asi);
      if (Array.isArray(f.features)) parts.push(...f.features);
      feats.push({
        key: normalizeFeatName(f.name).replace(/\s+/g, '_'),
        name: f.name,
        source: 'homebrew',
        rulesetId,
        rulesetName: raw.ruleset || rulesetId,
        category: category || f.category || 'general',
        effect: parts.join(' '),
      });
    };
    if (Array.isArray(raw.weapon_feats)) raw.weapon_feats.forEach(f => pushFeat(f, 'weapon_mastery'));
    if (Array.isArray(raw.fighting_style_feats)) raw.fighting_style_feats.forEach(f => pushFeat(f, 'fighting_style'));
    if (Array.isArray(raw.feats)) raw.feats.forEach(f => pushFeat(f, 'general'));
    return { meta: { ruleset: raw.ruleset, version: raw.version, type: raw.type }, feats };
  } catch {
    return null;
  }
}

const homebrewCache = new Map();

function getHomebrewRuleset(rulesetId) {
  if (!homebrewCache.has(rulesetId)) {
    homebrewCache.set(rulesetId, loadHomebrewRuleset(rulesetId));
  }
  return homebrewCache.get(rulesetId);
}

export function listHomebrewRulesets() {
  try {
    return readdirSync(HOMEBREW_DIR)
      .filter(f => f.startsWith(HOMEBREW_PREFIX) && f.endsWith('.json'))
      .map(f => f.slice(HOMEBREW_PREFIX.length, -5));
  } catch {
    return [];
  }
}

const lookup = new Map();
for (const f of CORE_FEATS) {
  lookup.set(normalizeFeatName(f.name), { ...f, source: 'core', rulesetId: null, rulesetName: 'D&D 5e' });
}
for (const rulesetId of listHomebrewRulesets()) {
  const rs = getHomebrewRuleset(rulesetId);
  if (!rs) continue;
  for (const f of rs.feats) {
    const norm = normalizeFeatName(f.name);
    if (!lookup.has(norm)) lookup.set(norm, f);
  }
}

export function getFeatEffect(feat) {
  const rawName = typeof feat === 'string' ? feat : (feat?.name || feat?.key || '');
  const norm = normalizeFeatName(rawName);
  if (!norm) return null;
  return lookup.get(norm) || null;
}

export function getFeatEffects(feats) {
  const core = [];
  const homebrew = [];
  const unknown = [];
  for (const feat of (feats || [])) {
    const entry = getFeatEffect(feat);
    if (!entry) {
      const rawName = typeof feat === 'string' ? feat : (feat?.name || feat?.key || '');
      if (rawName) unknown.push(rawName);
      continue;
    }
    if (entry.source === 'homebrew') homebrew.push(entry);
    else core.push(entry);
  }
  return { core, homebrew, unknown };
}

export function renderFeatEffectsForPrompt(feats) {
  const { core, homebrew } = getFeatEffects(feats);
  const sections = [];
  if (core.length > 0) {
    sections.push(
      `FEAT EFFECTS (apply these in relevant situations):\n  ${core.map(f => `${f.name}: ${f.effect}`).join('\n  ')}`
    );
  }
  if (homebrew.length > 0) {
    const byRuleset = new Map();
    for (const f of homebrew) {
      if (!byRuleset.has(f.rulesetId)) byRuleset.set(f.rulesetId, { name: f.rulesetName, feats: [] });
      byRuleset.get(f.rulesetId).feats.push(f);
    }
    for (const [, rs] of byRuleset) {
      sections.push(
        `HOMEBREW FEAT EFFECTS (${rs.name}) — these OVERRIDE standard D&D 5e rules where they conflict. ` +
        `When a feat below says X and your training says Y, X wins. Apply these in relevant situations:\n  ` +
        rs.feats.map(f => `${f.name}: ${f.effect}`).join('\n  ')
      );
    }
  }
  return sections.join('\n');
}
