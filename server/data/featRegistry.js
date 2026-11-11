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

// 2024 text (combat item 2, 2026-10-30). The 2014 versions of
// Alert (+5 initiative, surprise immunity), Sharpshooter and Great
// Weapon Master (-5/+10) are GONE in 2024 and must not creep back:
// Alert is +PB to initiative with an initiative swap; the -5/+10
// trade is replaced by +1 ability and, for GWM, +PB damage on a
// Heavy hit. Lucky is PB luck points, not 3 rerolls. Where a 2024
// ASI is confidently sourced it is in the text; where it is not,
// the effect is carried without inventing one (flagged in the
// item-2 handover for Zach's veto).
const CORE_FEATS = [
  { key: 'dungeon_delver', name: 'Dungeon Delver', category: 'general', effect: 'Advantage on Perception/Investigation to detect secret doors; advantage on saves vs traps; resistance to trap damage' },
  { key: 'alert', name: 'Alert', category: 'origin', effect: 'Add your proficiency bonus to Initiative; immediately after rolling Initiative, you may swap your Initiative with a willing ally in the same combat (neither can have the Incapacitated condition)' },
  { key: 'observant', name: 'Observant', category: 'general', effect: '+1 Intelligence or Wisdom; +5 passive Perception and Investigation; can read lips' },
  { key: 'lucky', name: 'Lucky', category: 'origin', effect: 'After a long rest, Luck Points equal to your proficiency bonus; spend one to gain advantage on a d20 test, or to impose disadvantage on an attack roll against you' },
  { key: 'sentinel', name: 'Sentinel', category: 'general', effect: 'Opportunity attacks reduce speed to 0; can attack when an ally within 5 ft is attacked; creatures you hit with opportunity attacks cannot use Disengage to avoid them' },
  { key: 'sharpshooter', name: 'Sharpshooter', category: 'general', effect: '+1 Dexterity; no disadvantage at long range; ignore half and three-quarters cover; no disadvantage on ranged attacks within 5 ft of an enemy' },
  { key: 'great_weapon_master', name: 'Great Weapon Master', category: 'general', effect: '+1 Strength; on a hit with a Heavy weapon, deal extra damage equal to your proficiency bonus (once per turn); bonus-action attack on a crit or kill' },
  { key: 'polearm_master', name: 'Polearm Master', category: 'general', effect: '+1 Strength or Dexterity; bonus-action d4 attack with the opposite end of a glaive, halberd, quarterstaff, or spear; opportunity attack when an enemy enters your reach' },
  { key: 'war_caster', name: 'War Caster', category: 'general', effect: '+1 Intelligence, Wisdom, or Charisma; advantage on concentration saves; can cast spells as opportunity attacks; can perform somatic components with hands full' },
  { key: 'mobile', name: 'Mobile', category: 'general', effect: '+10 speed; difficult terrain does not cost extra movement when you Dash; no opportunity attacks from creatures you attack on your turn' },
  { key: 'resilient', name: 'Resilient', category: 'general', effect: '+1 to the chosen ability score; proficiency in that ability\'s saving throws' },
  { key: 'skulker', name: 'Skulker', category: 'general', effect: '+1 Dexterity; can hide when lightly obscured; missed ranged attacks do not reveal your position; you can see in dim light as if it were bright within 60 ft for the purpose of hiding' },
  { key: 'mage_slayer', name: 'Mage Slayer', category: 'general', effect: 'Reaction attack when an adjacent creature casts a spell; targets have disadvantage on concentration saves caused by your damage' },
  { key: 'savage_attacker', name: 'Savage Attacker', category: 'origin', effect: 'Once per turn, when you hit a target with a weapon, roll the weapon\'s damage dice twice and use either roll against the target' },
  // 2024 origin feats (Stage 3, 2026-11-06 — completes the 10-feat
  // origin list: Alert, Crafter, Healer, Lucky, Magic Initiate,
  // Musician, Savage Attacker, Skilled, Tavern Brawler, Tough).
  // No origin feat grants an ASI in 2024. Effect strings are the
  // draft §1c wordings verbatim.
  { key: 'crafter', name: 'Crafter', category: 'origin', effect: 'Proficiency with three Artisan\'s Tools of your choice from the Fast Crafting table; 20% discount on nonmagical items; at the end of a Long Rest, craft one piece of gear from the Fast Crafting table (requires the associated tools and proficiency with them); the crafted item lasts until you finish another Long Rest, then falls apart' },
  { key: 'healer', name: 'Healer', category: 'origin', effect: 'With a Healer\'s Kit, expend one use as a Utilize action to tend a creature within 5 ft; that creature expends one of its Hit Point Dice and regains HP equal to the roll + your proficiency bonus; when you roll dice to restore HP with a spell or this feat\'s Battle Medic benefit, reroll any 1s (must use the new roll)' },
  { key: 'magic_initiate', name: 'Magic Initiate', category: 'origin', effect: 'Choose one spell list — Cleric, Druid, or Wizard; learn two cantrips and one level 1 spell from it (Intelligence, Wisdom, or Charisma is your spellcasting ability, chosen when you take the feat); the level 1 spell is always prepared, castable once per Long Rest without a slot and with spell slots thereafter; on gaining a level, replace one feat spell with another of the same level from the list; repeatable with a different list' },
  { key: 'musician', name: 'Musician', category: 'origin', effect: 'Proficiency with three musical instruments of your choice; as you finish a Short or Long Rest, play a song on an instrument you are proficient with to give Heroic Inspiration to allies who hear it, up to your proficiency bonus in allies' },
  { key: 'skilled', name: 'Skilled', category: 'origin', effect: 'Proficiency in any combination of three skills or tools of your choice; repeatable' },
  { key: 'tavern_brawler', name: 'Tavern Brawler', category: 'origin', effect: 'When you hit with an Unarmed Strike and deal damage, deal 1d4 + Strength bludgeoning instead of the normal damage; reroll any 1 on an Unarmed Strike damage die (must use the new roll); proficiency with improvised weapons; once per turn, when you hit a creature with an Unarmed Strike as part of the Attack action, push it 5 ft away in addition to dealing damage' },
  { key: 'tough', name: 'Tough', category: 'origin', effect: 'Your Hit Point maximum increases by twice your character level when you gain this feat; thereafter it increases by 2 each time you level up' },
];

// 2024 Fighting Style feats (combat item 2). In 2024 these are
// feats, not class-feature strings: Fighter gains one at L1,
// Paladin and Ranger at L2. The engine-checkable subset (Archery,
// Defense, Dueling, Great Weapon Fighting, Thrown Weapon Fighting,
// Two-Weapon Fighting, Unarmed Fighting) is wired in
// classFeatureService; Blind Fighting, Interception, and Protection
// are prompt-only until items 3/4 give them reactions/positioning.
// Do not confuse these with the Manual of Martial Mastery's
// fighting_style feats (homebrew, different names, different system).
const FIGHTING_STYLE_FEATS = [
  { key: 'archery', name: 'Archery', category: 'fighting_style', effect: '+2 to attack rolls with ranged weapons' },
  { key: 'blind_fighting', name: 'Blind Fighting', category: 'fighting_style', effect: 'Blindsight 10 ft (prompt-only: needs item 4 positioning to enforce)' },
  { key: 'defense', name: 'Defense', category: 'fighting_style', effect: '+1 AC while wearing armor' },
  { key: 'dueling', name: 'Dueling', category: 'fighting_style', effect: '+2 damage with a melee weapon wielded in one hand and no other weapon' },
  { key: 'great_weapon_fighting', name: 'Great Weapon Fighting', category: 'fighting_style', effect: 'When you roll damage for a melee weapon wielded with two hands, a damage die cannot roll below 3' },
  { key: 'interception', name: 'Interception', category: 'fighting_style', effect: 'Reaction: reduce damage to a creature within 5 ft of you by 1d10 + proficiency bonus (prompt-only: needs item 3 reactions)' },
  { key: 'protection', name: 'Protection', category: 'fighting_style', effect: 'Reaction while wielding a shield: impose disadvantage on an attack roll against a creature within 5 ft of you (prompt-only: needs item 3 reactions)' },
  { key: 'thrown_weapon_fighting', name: 'Thrown Weapon Fighting', category: 'fighting_style', effect: '+2 damage with thrown weapons' },
  { key: 'two_weapon_fighting', name: 'Two-Weapon Fighting', category: 'fighting_style', effect: 'Add your ability modifier to the damage of your off-hand attack' },
  { key: 'unarmed_fighting', name: 'Unarmed Fighting', category: 'fighting_style', effect: 'Unarmed strikes deal 1d6 + Strength bludgeoning damage, or 1d8 if you are not wielding weapons or a shield' },
];

export function listFightingStyleFeats() {
  return FIGHTING_STYLE_FEATS.map(f => ({ ...f, source: 'core' }));
}

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

// Lookup order (combat item 2 fix): the prompt rendering has always
// said homebrew OVERRIDES core on conflict, but the old code inserted
// core first and only added a homebrew feat if absent — core won.
// Now homebrew is inserted first, then core and fighting styles fill
// the gaps, so the code matches the stated rule. No collision exists
// today (Manual names are distinct), so this changes no current
// resolution — it only makes the rule true if one ever appears.
const lookup = new Map();
for (const rulesetId of listHomebrewRulesets()) {
  const rs = getHomebrewRuleset(rulesetId);
  if (!rs) continue;
  for (const f of rs.feats) {
    const norm = normalizeFeatName(f.name);
    if (!lookup.has(norm)) lookup.set(norm, f);
  }
}
for (const f of [...CORE_FEATS, ...FIGHTING_STYLE_FEATS]) {
  const norm = normalizeFeatName(f.name);
  if (!lookup.has(norm)) lookup.set(norm, { ...f, source: 'core', rulesetId: null, rulesetName: 'D&D 5e' });
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
