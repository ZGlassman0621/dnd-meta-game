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
  { key: 'observant', name: 'Observant', category: 'general', effect: '+1 Intelligence or Wisdom; Keen Observer: choose Insight, Investigation, or Perception — gain proficiency in it, or Expertise if already proficient; Quick Search: take the Search action as a Bonus Action' },
  { key: 'lucky', name: 'Lucky', category: 'origin', effect: 'After a long rest, Luck Points equal to your proficiency bonus; spend one to gain advantage on a d20 test, or to impose disadvantage on an attack roll against you' },
  { key: 'sentinel', name: 'Sentinel', category: 'general', effect: '+1 Strength or Dexterity; Guardian: immediately after a creature within 5 ft of you takes the Disengage action or hits a target other than you with an attack, you can make an Opportunity Attack against it; Halt: when you hit a creature with an Opportunity Attack, its Speed becomes 0 for the rest of the current turn' },
  { key: 'sharpshooter', name: 'Sharpshooter', category: 'general', effect: '+1 Dexterity; no disadvantage at long range; ignore half and three-quarters cover; no disadvantage on ranged attacks within 5 ft of an enemy' },
  { key: 'great_weapon_master', name: 'Great Weapon Master', category: 'general', effect: '+1 Strength; Heavy Weapon Mastery: when you hit a creature with a Heavy weapon as part of the Attack action on your turn, you can deal extra damage equal to your proficiency bonus; Hew: immediately after you score a Critical Hit with a Melee weapon or reduce a creature to 0 HP with one, you can make one attack with the same weapon as a Bonus Action' },
  { key: 'polearm_master', name: 'Polearm Master', category: 'general', effect: '+1 Dexterity or Strength; Pole Strike: immediately after you take the Attack action and attack with a Quarterstaff, a Spear, or a weapon with the Heavy and Reach properties, you can use a Bonus Action to make a melee attack with the opposite end (Bludgeoning, d4 damage die); Reactive Strike: while holding such a weapon, you can take a Reaction to make one melee attack against a creature that enters the reach you have with that weapon' },
  { key: 'war_caster', name: 'War Caster', category: 'general', effect: '+1 Intelligence, Wisdom, or Charisma; advantage on Constitution saves to maintain Concentration; Reactive Spell: when a creature provokes an Opportunity Attack from you by leaving your reach, you can take a Reaction to cast a spell at it instead (casting time one action, targets only that creature); you can perform Somatic components with weapons or a Shield in one or both hands' },
  // Mobile (2014) removed; its 2024 replacement is Speedy (repo-check-fixes-feats).
  { key: 'speedy', name: 'Speedy', category: 'general', effect: '+1 Dexterity or Constitution; your Speed increases by 10 ft; when you take the Dash action, Difficult Terrain costs no extra movement for the rest of that turn; Opportunity Attacks have disadvantage against you' },
  { key: 'resilient', name: 'Resilient', category: 'general', effect: '+1 to one ability in which you lack saving throw proficiency (max 20); you gain saving throw proficiency with that ability' },
  { key: 'skulker', name: 'Skulker', category: 'general', effect: '+1 Dexterity; Blindsight 10 ft; Fog of War: advantage on Dexterity (Stealth) checks made as part of the Hide action during combat; Sniper: if you attack while hidden and miss, the attack roll does not reveal your location' },
  { key: 'mage_slayer', name: 'Mage Slayer', category: 'general', effect: '+1 Strength or Dexterity; Concentration Breaker: a concentrating creature you damage has disadvantage on the save to maintain Concentration; Guarded Mind: if you fail an Intelligence, Wisdom, or Charisma saving throw, you can succeed instead (once per Short or Long Rest)' },
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
  { key: 'defense', name: 'Defense', category: 'fighting_style', effect: '+1 AC while wearing Light, Medium, or Heavy armor' },
  { key: 'dueling', name: 'Dueling', category: 'fighting_style', effect: '+2 damage with a melee weapon wielded in one hand and no other weapon' },
  { key: 'great_weapon_fighting', name: 'Great Weapon Fighting', category: 'fighting_style', effect: 'When you roll damage for an attack with a Melee weapon you hold with two hands, treat any 1 or 2 on a damage die as a 3; the weapon must have the Two-Handed or Versatile property' },
  { key: 'interception', name: 'Interception', category: 'fighting_style', effect: 'Reaction when a creature you can see hits another creature within 5 ft of you with an attack roll: reduce the damage to the target by 1d10 + proficiency bonus; you must be holding a Shield or a Simple or Martial weapon (prompt-only: needs item 3 reactions)' },
  { key: 'protection', name: 'Protection', category: 'fighting_style', effect: 'Reaction when a creature you can see attacks a target other than you within 5 ft of you, if you are holding a Shield: impose disadvantage on the triggering attack roll and on all other attack rolls against the target until the start of your next turn, if you remain within 5 ft of the target (prompt-only: needs item 3 reactions)' },
  { key: 'thrown_weapon_fighting', name: 'Thrown Weapon Fighting', category: 'fighting_style', effect: '+2 to the damage roll when you hit with a ranged attack roll using a weapon that has the Thrown property' },
  { key: 'two_weapon_fighting', name: 'Two-Weapon Fighting', category: 'fighting_style', effect: 'When you make an extra attack as a result of using a weapon with the Light property, add your ability modifier to that attack\'s damage if you are not already adding it' },
  { key: 'unarmed_fighting', name: 'Unarmed Fighting', category: 'fighting_style', effect: 'When you hit with an Unarmed Strike and deal damage, deal 1d6 + Strength modifier bludgeoning damage instead, or 1d8 if you are not holding any weapons or a Shield when you make the attack roll; at the start of each of your turns, you can deal 1d4 bludgeoning damage to one creature Grappled by you' },
];

// HOMEBREW — feat-addition-14 (Zach 2026-11-21 / 2026-11-22; brief
// docs/pm/feat-addition-14/BRIEF.md). Fourteen feats that are NOT 2024
// book feats: twelve from the four feat PDFs Zach supplied (PM research
// 2026-11-20) and two homebrew adaptations of Xanathar's Guide to
// Everything. Kept in their own list, tagged source 'homebrew' with a
// ruleset id, so the 2024 CORE_FEATS above stay pure book text and these
// can be listed, toggled and audited separately. `effect` is the brief's
// mechanic, verbatim in substance. Structured fields the engine reads:
//   abilityIncrease { ability, max } — the half-feat +1 (five feats only)
//   prerequisite    { ability, min, text } — enforced at level-up
//   choices         — the origin pick's sub-choice (Energy Affinity)
//   engine          — the enforcement route, stated per feat (report §per-feat)
// sourcePdf: which of the four PDFs each feat was taken from (Muse,
// 2026-11-24, from the PM research report §1). Mountaineer is the DNDBlue
// copy and has NO ability increase (the Book of Revised Feats "+5" is a
// typo, not taken).
const PDF_FEATS_RULESET = { rulesetId: 'feat_pdfs_2026_11', rulesetName: 'Feat PDFs (Zach-supplied; PM research 2026-11-20)' };
const XGE_ADAPTATION_RULESET = { rulesetId: 'homebrew_xge_adaptations', rulesetName: "Homebrew adaptations of Xanathar's Guide to Everything" };
const ADDED_FEATS = [
  { key: 'tactician', name: 'Tactician', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    effect: 'When you roll initiative, roll a d4 and add it to your initiative. After rolling initiative but before the first turn, you may swap initiative with a willing creature, once per combat (stacks with Alert)',
    engine: 'initiative' },
  { key: 'sage_advice', name: 'Sage Advice', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'Fantastic Feats of Forgotten Realms',
    effect: 'Spend 10 minutes advising: choose a skill or tool you are proficient with; up to 6 friendly creatures within 30 ft who can hear and understand you each, once within the next hour, may add their proficiency bonus to one ability check with the chosen skill or tool, if they are not already proficient in it. Uses equal to your proficiency bonus; regain on a long rest',
    uses: { max: 'pb', reset: 'long' }, engine: 'feat_use' },
  { key: 'hound', name: 'Hound', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    abilityIncrease: { ability: 'wis', max: 20 },
    effect: '+1 Wisdom (max 20). Advantage on Perception checks based on smell. Smell an object worn or used by a creature within the last 10 days: +5 to Perception/Survival checks to track that creature, until a long rest',
    engine: 'check_rider' },
  { key: 'feather_foot', name: 'Feather Foot', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    abilityIncrease: { ability: 'dex', max: 20 }, prerequisite: { ability: 'dex', min: 13, text: 'Dexterity 13 or higher' },
    effect: '+1 Dexterity (max 20). Use Dexterity instead of Strength for jump distance and height. Your footsteps do not trigger non-magical pressure-based traps',
    engine: 'dm_prompt' },
  { key: 'seismic_touch', name: 'Seismic Touch', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    effect: 'As an action, touch a solid surface and gain 60 ft tremorsense until the start of your next turn',
    engine: 'feat_use' },
  { key: 'trapper', name: 'Trapper', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'Book of Revised Feats',
    abilityIncrease: { ability: 'wis', max: 20 },
    grantedSpells: ["Hunter's Mark"], uses: { max: 2, reset: 'long', spell: "Hunter's Mark", level: 1 },
    effect: "+1 Wisdom (max 20). You learn Hunter's Mark: cast it twice per long rest as a 1st-level spell without expending a slot, and with spell slots beyond that, using Wisdom as your spellcasting ability. Advantage on Survival checks to track or hunt beasts and creatures with Intelligence 8 or lower. Advantage on checks to skin, extract, and preserve precious organs from creatures you have researched or hunted for at least 1 week of downtime",
    engine: 'free_cast+check_rider' },
  { key: 'friend_of_the_forest', name: 'Friend of the Forest', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    effect: 'You understand and can speak with beasts. Beasts can give you information about nearby locations and monsters, including what they perceived within the past day',
    engine: 'dm_prompt' },
  { key: 'elusive', name: 'Elusive', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    abilityIncrease: { ability: 'dex', max: 20 }, prerequisite: { ability: 'dex', min: 13, text: 'Dexterity 13 or higher' },
    effect: '+1 Dexterity (max 20). You and up to 10 companions within 60 ft travel at a normal pace while stealthing (at a slow pace, +5 to Stealth instead); creatures have disadvantage on Perception/Survival checks to track you',
    engine: 'check_rider+dm_prompt' },
  { key: 'sling_expert', name: 'Sling Expert', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'Book of Revised Feats',
    effect: 'Sling attacks deal +1d4 damage when the target is within the sling\'s first range increment, +1d4 more if the target is one size larger than you. After taking the Attack action with a sling, you can make one additional sling attack as a bonus action',
    engine: 'damage_dice' },
  { key: 'mountaineer', name: 'Mountaineer', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'DNDBlue Feat Collection v2.4',
    effect: 'Climbing speed equals your walking speed. Reduce falling damage by your level. Advantage on Athletics checks for climbing',
    engine: 'check_rider+dm_prompt' },
  { key: 'energy_affinity', name: 'Energy Affinity', category: 'origin', ...PDF_FEATS_RULESET, sourcePdf: 'Homebrew Feats 2024',
    choices: { affinity: { mind: { resistance: 'psychic', cantrip: 'Mind Sliver' }, soul: { resistance: 'radiant', cantrip: 'Sacred Flame' }, death: { resistance: 'necrotic', cantrip: 'Toll the Dead' } } },
    effect: 'Choose one: Mind — psychic resistance + the Mind Sliver cantrip; Soul — radiant resistance + the Sacred Flame cantrip; Death — necrotic resistance + the Toll the Dead cantrip. The cantrip is granted, never counted against cantrips known or prepared',
    engine: 'resistance+granted_cantrip' },
  { key: 'quick_draw', name: 'Quick Draw', category: 'general', ...PDF_FEATS_RULESET, sourcePdf: 'Fantastic Feats of Forgotten Realms',
    effect: 'While wielding a ranged or thrown weapon, creatures provoke an opportunity attack from you when they move within 5 feet of you. Ranged weapons used as improvised weapons deal d4 damage and you are proficient with them',
    engine: 'opportunity_attack+dm_prompt' },
  { key: 'silver_tongue', name: 'Silver Tongue', category: 'general', ...XGE_ADAPTATION_RULESET, sourcePdf: "Homebrew adaptation of Xanathar's Guide to Everything (Panache)",
    abilityIncrease: { ability: 'cha', max: 20 }, prerequisite: { ability: 'cha', min: 13, text: 'Charisma 13 or higher' },
    effect: "+1 Charisma (max 20). Winning Words: as an action, make a Charisma (Persuasion) check contested by a creature's Wisdom (Insight) check; the creature must be able to hear you and you must share a language; if you succeed and the creature isn't hostile to you, it has the Charmed condition for 1 minute and regards you as a friendly acquaintance; ends immediately if you or your companions do anything harmful to it. No usage limit",
    engine: 'contest+charm' },
  { key: 'elegant_maneuver', name: 'Elegant Maneuver', category: 'general', ...XGE_ADAPTATION_RULESET, sourcePdf: "Homebrew adaptation of Xanathar's Guide to Everything (Swashbuckler)",
    effect: 'As a bonus action, gain advantage on the next Dexterity (Acrobatics) or Strength (Athletics) check you make this turn',
    engine: 'feat_use' },
];

export function listAddedFeats() {
  return ADDED_FEATS.map(f => ({ ...f, source: 'homebrew' }));
}

export const ADDED_FEAT_KEYS = ADDED_FEATS.map(f => f.key);

/** Every Origin feat the registry knows (core + homebrew), for pickers
 *  that grant one (Warlock Lessons of the First Ones). */
export function listOriginFeats() {
  return [...CORE_FEATS, ...ADDED_FEATS].filter(f => f.category === 'origin').map(f => ({ key: f.key, name: f.name }));
}

/** Does an ability-score set meet a feat's structured prerequisite?
 *  A feat without one (or a free-text-only one) passes — only the
 *  structured `prerequisite { ability, min }` is enforced. */
export function featPrerequisiteMet(entry, abilityScores) {
  const p = entry?.prerequisite;
  if (!p || !p.ability || !Number.isFinite(Number(p.min))) return true;
  const scores = abilityScores || {};
  const v = Number(scores[p.ability] ?? scores[{ str: 'strength', dex: 'dexterity', con: 'constitution', int: 'intelligence', wis: 'wisdom', cha: 'charisma' }[p.ability]] ?? 0);
  return v >= Number(p.min);
}

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
// feat-addition-14: the fourteen added feats (homebrew, tagged per
// ruleset). No name collides with a JSON homebrew, core feat or fighting
// style (verified 2026-11-24), so insertion order changes no resolution.
for (const f of ADDED_FEATS) {
  const norm = normalizeFeatName(f.name);
  if (!lookup.has(norm)) lookup.set(norm, { ...f, source: 'homebrew' });
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
  const split = getFeatEffects(feats);
  // Provenance fence (Muse, 2026-11-24): a feat's source tag is internal
  // metadata — it never reaches anything the player sees, DM narration
  // included, so no ruleset name is rendered here. Every feat sits under
  // the one plain FEAT EFFECTS heading. The fourteen added feats override
  // no book rule and join the plain list; the JSON-ruleset feats (the
  // Manual of Martial Mastery) DO override book rules, so they keep the
  // override instruction, in a sub-block that names no source.
  const isAdded = (f) => f.rulesetId === PDF_FEATS_RULESET.rulesetId || f.rulesetId === XGE_ADAPTATION_RULESET.rulesetId;
  const plain = [...split.core, ...split.homebrew.filter(isAdded)];
  const overriding = split.homebrew.filter((f) => !isAdded(f));
  if (plain.length === 0 && overriding.length === 0) return '';
  const lines = ['FEAT EFFECTS (apply these in relevant situations):'];
  for (const f of plain) lines.push(`  ${f.name}: ${f.effect}`);
  if (overriding.length > 0) {
    lines.push('  These feats OVERRIDE standard D&D 5e rules where they conflict. When a feat below says X and your training says Y, X wins:');
    for (const f of overriding) lines.push(`  ${f.name}: ${f.effect}`);
  }
  return lines.join('\n');
}
