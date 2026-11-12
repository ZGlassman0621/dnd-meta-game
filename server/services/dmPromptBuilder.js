/**
 * DM Prompt Builder - System Prompt Construction for AI Dungeon Master
 *
 * Handles all formatting of character data, content preferences, NPCs,
 * companions, campaign plans, and the massive DM system prompt.
 * Extracted from ollama.js for maintainability.
 */

import { parseSpellbookState, wizardLevelFromClassLevels, SPELLBOOK_MATERIALS } from './spellbookService.js';
import { formatLoyaltyForPrompt } from './companionBackstoryService.js';
import { formatFactionStandingFragment } from './factionService.js';
import { safeParse } from '../utils/safeParse.js';
import { FEATURE_FLAGS } from '../config/featureFlags.js';
import { renderFeatEffectsForPrompt } from '../data/featRegistry.js';
import { buildSubclassPromptSection } from './subclassService.js';
import { buildAgendaPromptBlock } from './npcComplexityService.js';
import { buildProfessionPromptLine } from './npcProfessionService.js';
import { buildCompanionPromptBlock } from './companionPrompt.js';
import { calculateCombatStats } from './combatStatsService.js';
import { artificerPromptSection } from './artificerService.js';
import { spellshotPromptSection } from './spellshotService.js';
import { wardenPromptSection } from './wardenService.js';
import { magusPromptSection, societyKeyForName, spellcastingAbilityForSociety } from './magusService.js';
import { pugilistPromptSection } from './pugilistService.js';
import { scholarPromptSection } from './scholarService.js';
import { duelistPromptSection } from './duelistService.js';
import { blackguardPromptSection } from './blackguardService.js';
import { bloodHunterPromptSection } from './bloodHunterService.js';
import { warlordPromptSection } from './warlordService.js';
import { formatSpeciesLine, formatOriginLine } from './speciesService.js';
// Loot wiring (R-02): the prompt never names an unidentified magic item.
import { discoveryPromptSection, discoveryStateOf, DISCOVERY_IDENTIFIED } from './magicItemDiscoveryService.js';
import { lookupItemByName } from '../data/merchantLootTables.js';
import { formatMixedAncestryLine } from './mixedAncestryService.js';

// QUALITY_BONUSES, ARMOR_DATA and calculateCombatStats moved to
// combatStatsService.js (v1.0.191, combat-real B1) — one combat-stats
// truth shared by this prompt (display) and combat (authority).

// Companion mood RP guidance for the DM
const MOOD_RP_GUIDANCE = {
  content: null, // No special guidance needed
  anxious: 'nervous, second-guessing, seeking reassurance',
  angry: 'short-tempered, confrontational, holding a grudge',
  sad: 'quiet, withdrawn, mentioning what they lost',
  fearful: 'reluctant, cautious, urging retreat',
  excited: 'eager, talkative, overconfident',
  conflicted: 'hesitant, voicing doubts, asking moral questions',
  grateful: 'warm, supportive, going extra mile for the party',
  resentful: 'cold, passive-aggressive, bringing up grievances',
  exhausted: 'slow, unfocused, asking for rest, making mistakes'
};

// calculateCombatStats now lives in combatStatsService.js (imported above).

/**
 * Format a character's info for the system prompt
 */
function formatCharacterInfo(character, label = 'PLAYER CHARACTER') {
  const abilities = typeof character.ability_scores === 'string'
    ? JSON.parse(character.ability_scores)
    : character.ability_scores;

  const inventory = typeof character.inventory === 'string'
    ? JSON.parse(character.inventory || '[]')
    : (character.inventory || []);

  const skills = typeof character.skills === 'string'
    ? JSON.parse(character.skills || '[]')
    : (character.skills || []);

  // Parse feats - can be array of strings or array of objects with name/key
  const featsRaw = typeof character.feats === 'string'
    ? JSON.parse(character.feats || '[]')
    : (character.feats || []);
  const feats = featsRaw.map(f => typeof f === 'string' ? f : (f.name || f.key)).filter(Boolean);

  // Parse known cantrips and spells
  const knownCantrips = typeof character.known_cantrips === 'string'
    ? JSON.parse(character.known_cantrips || '[]')
    : (character.known_cantrips || []);

  const knownSpells = typeof character.known_spells === 'string'
    ? JSON.parse(character.known_spells || '[]')
    : (character.known_spells || []);

  // Parse prepared spells (for prepared casters like Clerics, Paladins, Wizards)
  const preparedSpells = typeof character.prepared_spells === 'string'
    ? JSON.parse(character.prepared_spells || '[]')
    : (character.prepared_spells || []);

  const fullName = character.name;
  const firstName = character.first_name || character.name.split(' ')[0];
  const nickname = character.nickname || null;

  // Determine pronouns from gender
  const gender = character.gender?.toLowerCase() || '';
  let pronouns = 'they/them';
  if (gender === 'male' || gender === 'm') pronouns = 'he/him';
  else if (gender === 'female' || gender === 'f') pronouns = 'she/her';

  // Calculate combat stats from equipment
  const combatStats = calculateCombatStats(character);
  const ac = combatStats.ac;

  // Build weapon info string
  let weaponStr = 'Unarmed';
  if (combatStats.weapon) {
    const w = combatStats.weapon;
    const qualityPrefix = w.quality !== 'common' ? `${w.quality} ` : '';
    weaponStr = `${qualityPrefix}${w.name} (+${w.attackBonus} to hit, ${w.damage} ${w.damageType})`;
  }

  // Build feats section with mechanical effects for DM awareness.
  // Feat effects come from the data-driven registry (server/data/featRegistry.js),
  // which covers core 5e feats and homebrew rulesets (e.g., Manual of Martial Mastery).
  let featsSection = '';
  if (feats.length > 0) {
    featsSection = `\n- Feats: ${feats.join(', ')}`;
    const rendered = renderFeatEffectsForPrompt(feats);
    if (rendered) {
      featsSection += `\n  ${rendered}`;
    }
  }

  // Build spellcasting section
  let spellSection = '';
  const hasSpells = knownCantrips.length > 0 || knownSpells.length > 0 || preparedSpells.length > 0;
  if (hasSpells) {
    // Wizard levels (2026-11-08 follow-ups, D1): the spellbook
    // lines gate on wizard LEVELS, not on the primary class — a
    // fighter-primary wizard has a book the DM must see. The
    // derivation is the server's single-class-fallback shape
    // (wizardLevelFromClassLevels + primary-wizard fallback); null
    // means no wizard levels at all.
    const wizLevel = wizardLevelFromClassLevels(character.class_levels)
      ?? (String(character.class || '').toLowerCase() === 'wizard' ? Number(character.level) || 1 : null);
    const spellParts = [];
    if (knownCantrips.length > 0) {
      spellParts.push(`Cantrips: ${knownCantrips.join(', ')}`);
    }
    if (knownSpells.length > 0) {
      // Wizard spellbook (2026-11-07): the book lives in
      // known_spells — label it as the book, not "known spells".
      if (wizLevel != null) {
        spellParts.push(`Spellbook (${knownSpells.length}): ${knownSpells.join(', ')}`);
      } else {
        spellParts.push(`Known Spells: ${knownSpells.join(', ')}`);
      }
    }
    if (preparedSpells.length > 0) {
      spellParts.push(`Prepared Spells: ${preparedSpells.join(', ')}`);
    }
    if (wizLevel != null) {
      // Always-prepared picks + lost-book state, from
      // spellbook_json (migration 111).
      const wizState = parseSpellbookState(character.spellbook_json);
      // (Always-prepared picks print from the gated
      // mastery/signature lists below, not a merged list.)
      if (wizState.mastery.length > 0 && wizLevel >= 18) {
        spellParts.push(`Spell Mastery (always prepared): ${wizState.mastery.join(', ')}`);
      }
      if (wizState.signature.length > 0 && wizLevel >= 20) {
        spellParts.push(`Signature Spells (always prepared): ${wizState.signature.join(', ')}`);
      }
      if ((wizState.mastery.length > 0 && wizLevel < 18) || (wizState.signature.length > 0 && wizLevel < 20)) {
        // Picks stored below their level gate are inert — say so
        // rather than printing them as prepared.
        spellParts.push('Spell Mastery / Signature Spells: picks stored, below their level gate');
      }
      if (wizState.status === 'lost') {
        spellParts.push('Spellbook: LOST — prepared spells cannot be changed until the spellbook is recovered or replaced');
      }
      // Backup book + replacement marker (2026-11-07): the DM needs
      // to know a second book exists, and whether the book in hand
      // is a replacement rather than the original.
      if (wizState.backup && wizState.backup.length > 0) {
        spellParts.push(`Backup spellbook (${wizState.backup.length}): ${wizState.backup.join(', ')}`);
      }
      if (wizState.replaced === 'prepared') {
        spellParts.push('Spellbook: REPLACED — re-transcribed from prepared spells');
      } else if (wizState.replaced === 'backup') {
        spellParts.push('Spellbook: REPLACED — restored from the backup spellbook');
      }
      // Blank book (V5, 2026-11-08; table labels, 2026-11-08
      // follow-ups, D6): what the book in hand is made of and what
      // its blank pages cost, as recorded by the replace route when
      // the book was made. A stored table KEY prints its label;
      // anything else prints verbatim (legacy free-text rows already
      // in the wild). Prints whenever the values are stored —
      // including while a subset replacement is still in progress
      // (the book exists; it is just incomplete) — so the DM sees
      // the book's price and materials without a REPLACED line yet.
      if (wizState.bookCost != null || wizState.bookMaterials) {
        const bookBits = [];
        if (wizState.bookMaterials) {
          const materialEntry = SPELLBOOK_MATERIALS[wizState.bookMaterials];
          bookBits.push(materialEntry ? materialEntry.label : wizState.bookMaterials);
        }
        if (wizState.bookCost != null) bookBits.push(`${wizState.bookCost} gp`);
        spellParts.push(`Spellbook materials: ${bookBits.join(', ')}`);
      }
    }
    spellSection = `\n- Spellcasting: ${spellParts.join('; ')}`;
  }

  // Build Keeper abilities section
  let keeperSection = '';
  if (character.class?.toLowerCase() === 'keeper') {
    const keeperParts = [];
    const keeperTexts = typeof character.keeper_texts === 'string' ? JSON.parse(character.keeper_texts || '[]') : (character.keeper_texts || []);
    const keeperRecitations = typeof character.keeper_recitations === 'string' ? JSON.parse(character.keeper_recitations || '[]') : (character.keeper_recitations || []);

    if (keeperRecitations.length > 0) {
      keeperParts.push(`Recitations (at-will): ${keeperRecitations.join(', ')}`);
    }
    if (keeperTexts.length > 0) {
      keeperParts.push(`Library Texts (weapon + Passage each): ${keeperTexts.join(', ')}`);
    }
    if (character.keeper_genre_domain) {
      keeperParts.push(`Genre Domain: ${character.keeper_genre_domain}`);
    }
    if (character.keeper_specialization) {
      keeperParts.push(`Specialization: ${character.keeper_specialization}`);
    }
    if (keeperParts.length > 0) {
      keeperSection = `\n- Keeper Abilities: ${keeperParts.join('; ')}`;
      keeperSection += `\n  KEEPER RULES: Uses CHA for manifested weapon attacks. Manifest Weapon = bonus action to summon weapon from a text. Each text has a Passage (once per short rest special effect). Recitations are cantrip equivalents (at will). Keeper save DC = 8 + proficiency + CHA mod.${character.level >= 2 ? ' Keeper\'s Study = bonus action to mark a creature as Studied (PB/long rest) — Recitations and weapon attacks deal extra damage to Studied creatures, and Keeper learns one fact about them.' : ''}`;
    }
  }

  // Split character info into two blocks for prompt-cache stratification:
  //
  //   staticText  — identity that does NOT change during a session: name,
  //                 race, class, level, abilities, skills, feats, spells,
  //                 alignment/faith/personality/ideals/bonds/flaws,
  //                 backstory, demographics. Lands in tier 2 (per-character
  //                 cache, stable across all turns of a session).
  //
  //   dynamicText — state that DOES change during play: HP, AC, weapon
  //                 (depends on equipped item), key equipment, current
  //                 location, current quest. Lands in tier 3 (uncached).
  //
  // Before this split (v1.0.95), char info was a single block in tier 2.
  // Tier 2 size oscillated around the 1024-token cache minimum and tier 2
  // contents drifted as state changed turn-to-turn — both broke the cache.
  // After the split: tier 2 is byte-stable across turns AND padded above
  // the 1024-token threshold by including the full identity bundle the
  // character schema supports (ideals/bonds/flaws/personality/faith/etc).
  //
  // Parsing language tags + tool proficiencies the same way as other JSON
  // fields so they can be folded into staticText safely.
  const languages = typeof character.languages === 'string'
    ? JSON.parse(character.languages || '[]')
    : (character.languages || []);
  const toolProfs = typeof character.tool_proficiencies === 'string'
    ? JSON.parse(character.tool_proficiencies || '[]')
    : (character.tool_proficiencies || []);

  const identityLines = [
    `${label}:`,
    `- Full Name: ${fullName}`,
    `- First Name: ${firstName}${nickname ? `\n- Nickname: ${nickname} (only close friends or those the character has shared this with would use it)` : ''}`,
    `- Gender: ${character.gender || 'unspecified'} - USE ${pronouns.toUpperCase()} PRONOUNS FOR THIS CHARACTER`,
    `- Race: ${character.race}${character.subrace ? ` (${character.subrace})` : ''}`,
    formatSpeciesLine(character.race, character.subrace, character.size)
      ? `- ${formatSpeciesLine(character.race, character.subrace, character.size)}`
      : null,
    formatMixedAncestryLine(character.mixed_ancestry_json)
      ? `- ${formatMixedAncestryLine(character.mixed_ancestry_json)}`
      : null,
    formatOriginLine(character.origin_setting, character.origin_region, character.origin_explanation, character.race)
      ? `- ${formatOriginLine(character.origin_setting, character.origin_region, character.origin_explanation, character.race)}`
      : null,
    `- Class: ${character.class}${character.subclass ? ` (${character.subclass})` : ''}${character.keeper_specialization ? ` [${character.keeper_specialization}]` : ''}`,
    // Creation-solidification item 5 (migration 114): how an
    // outside-FR subclass's tradition reached the character — the
    // player's own words, canon for the DM.
    character.subclass && character.subclass_origin_explanation && String(character.subclass_origin_explanation).trim()
      ? `- Subclass origin (the player's explanation of how the ${character.subclass} tradition reached them in the Forgotten Realms — canon): ${String(character.subclass_origin_explanation).trim()}`
      : null,
    `- Level: ${character.level}`,
    `- Background: ${character.background || 'Unknown'}`,
    `- Abilities: STR ${abilities?.str || 10}, DEX ${abilities?.dex || 10}, CON ${abilities?.con || 10}, INT ${abilities?.int || 10}, WIS ${abilities?.wis || 10}, CHA ${abilities?.cha || 10}`,
    `- Skills: ${skills.length > 0 ? skills.join(', ') : 'None specified'}${featsSection}${spellSection}${keeperSection}`,
    character.alignment ? `- Alignment: ${character.alignment}` : null,
    character.faith ? `- Faith: ${character.faith}` : null,
    character.lifestyle ? `- Lifestyle: ${character.lifestyle}` : null,
    character.age ? `- Age: ${character.age}` : null,
    [character.height, character.weight].filter(Boolean).length > 0
      ? `- Build: ${[character.height, character.weight].filter(Boolean).join(', ')}` : null,
    [
      character.hair_color ? `hair ${character.hair_color}` : null,
      character.eye_color ? `eyes ${character.eye_color}` : null,
      character.skin_color ? `skin ${character.skin_color}` : null
    ].filter(Boolean).length > 0
      ? `- Appearance: ${[
          character.hair_color ? `hair ${character.hair_color}` : null,
          character.eye_color ? `eyes ${character.eye_color}` : null,
          character.skin_color ? `skin ${character.skin_color}` : null
        ].filter(Boolean).join(', ')}` : null,
    languages.length > 0 ? `- Languages: ${languages.join(', ')}` : null,
    toolProfs.length > 0 ? `- Tool Proficiencies: ${toolProfs.join(', ')}` : null,
    character.personality_traits ? `- Personality: ${character.personality_traits}` : null,
    character.ideals ? `- Ideals: ${character.ideals}` : null,
    character.bonds ? `- Bonds: ${character.bonds}` : null,
    character.flaws ? `- Flaws: ${character.flaws}` : null,
    character.backstory ? `- Backstory: ${character.backstory}` : null
  ].filter(Boolean);

  // Artificer base class: dynamic state (uses, created items, attunement)
  // belongs in dynamicText, not the cached static block — it changes in play.
  let artificerSection = '';
  if (String(character.class || '').toLowerCase() === 'artificer') {
    try {
      const resources = typeof character.class_resources_json === 'string' ? JSON.parse(character.class_resources_json || '{}') : (character.class_resources_json || {});
      const intMod = Math.floor(((abilities?.int ?? 10) - 10) / 2);
      artificerSection = artificerPromptSection(resources.artificer || null, { level: character.level || 1, intMod });
    } catch { /* a malformed resources blob never breaks the prompt */ }
  }

  // Overnight 7-class merge: same pattern as the artificer section above —
  // dynamic state belongs in dynamicText, not the cached static block.
  let newClassSection = '';
  {
    const cls = String(character.class || '').toLowerCase();
    if (['spellshot', 'warden', 'magus', 'pugilist', 'scholar', 'duelist', 'blackguard', 'blood_hunter', 'warlord'].includes(cls)) {
      try {
        const resources = typeof character.class_resources_json === 'string' ? JSON.parse(character.class_resources_json || '{}') : (character.class_resources_json || {});
        const sub = resources[cls] || null;
        const modOf = (a) => Math.floor(((abilities?.[a] ?? 10) - 10) / 2);
        const lvl = character.level || 1;
        const name = character.name || null;
        if (cls === 'spellshot') newClassSection = spellshotPromptSection(sub, { level: lvl, intMod: modOf('int'), name });
        else if (cls === 'warden') newClassSection = wardenPromptSection(sub, { level: lvl, subclass: character.subclass || null, alternateSet: sub?.alternateSet ?? null, name });
        else if (cls === 'magus') {
          const key = societyKeyForName(character.subclass) || societyKeyForName(sub?.society);
          const ability = key ? spellcastingAbilityForSociety(key) : null;
          newClassSection = magusPromptSection(sub, { level: lvl, spellMod: ability ? modOf(ability) : undefined, society: key || undefined, name });
        }
        else if (cls === 'pugilist') newClassSection = pugilistPromptSection(sub, { level: lvl, club: sub?.club || null, chaMod: modOf('cha') });
        else if (cls === 'scholar') newClassSection = scholarPromptSection(sub, { level: lvl, intMod: modOf('int'), name });
        else if (cls === 'duelist') newClassSection = duelistPromptSection(sub, { level: lvl });
        else if (cls === 'blackguard') newClassSection = blackguardPromptSection(sub, { level: lvl, chaMod: modOf('cha') });
        else if (cls === 'blood_hunter') newClassSection = bloodHunterPromptSection(sub, { level: lvl, intMod: modOf('int'), name, subclass: character.subclass || null });
        else if (cls === 'warlord') newClassSection = warlordPromptSection(sub, { level: lvl, chaMod: modOf('cha'), name, subclass: character.subclass || null });
      } catch { /* a malformed resources blob never breaks the prompt */ }
    }
  }

  // Loot wiring (R-02): unidentified magic items are described, never
  // named. Same try/catch shape as the class sections above.
  let discoverySection = '';
  try {
    discoverySection = discoveryPromptSection(inventory, (name) => {
      try { return lookupItemByName(name) || null; } catch { return null; }
    });
  } catch { /* a malformed inventory never breaks the prompt */ }

  const stateLines = [
    `${label} — CURRENT STATE (live values, may change during play):`,
    `- HP: ${character.current_hp}/${character.max_hp}`,
    `- Armor Class: ${ac}`,
    `- Weapon: ${weaponStr}`,
    `- Key Equipment: ${inventory.slice(0, 5).map(i => discoveryStateOf(i) === DISCOVERY_IDENTIFIED ? (i.name || i) : 'an unidentified item').join(', ') || 'Basic adventuring gear'}`,
    `- Current Location: ${character.current_location || 'Unknown'}`,
    `- Current Quest: ${character.current_quest || 'None'}`,
    ...(artificerSection ? [artificerSection] : []),
    ...(newClassSection ? [newClassSection] : []),
    // Loot wiring (R-02): unidentified magic items are listed WITHOUT
    // their names (describe, never name). Malformed inventory never
    // breaks the prompt — same try/catch shape as the class sections.
    ...(discoverySection ? [discoverySection] : []),
  ];

  return {
    staticText: identityLines.join('\n'),
    dynamicText: stateLines.join('\n'),
    // Backwards-compat: anything reading `text` still works (full block,
    // static + dynamic concatenated). Internal callers should switch to
    // staticText/dynamicText to opt into the cache-friendly split.
    text: identityLines.join('\n') + '\n' + stateLines.join('\n'),
    firstName,
    nickname
  };
}

/**
 * Format a one-line naming protocol directive for a single NPC's block,
 * derived from a nickname resolution. Returns null when no resolution is
 * available so the caller can filter it out cleanly.
 */
function formatNamingProtocolLine(resolution) {
  if (!resolution) return null;
  if (resolution.bard_override) {
    const names = (resolution.allowed || []).map(a => a.nickname).filter(Boolean);
    return names.length > 0
      ? `  Calls the PC: any familiar form (bard — rule of cool). Known forms: ${names.join(', ')}.`
      : `  Calls the PC: any familiar form (bard — rule of cool).`;
  }
  const row = resolution.primary_row;
  if (!row) {
    return `  Calls the PC: ${resolution.fallback_legal_name} (no relationship-specific name applies).`;
  }
  const label = audiencePromptLabel(row);
  return `  Calls the PC: "${row.nickname}" (${label}).`;
}

function audiencePromptLabel(row) {
  switch (row.audience_type) {
    case 'default': return 'default / stranger-facing';
    case 'friends': return 'friends only';
    case 'allied': return 'allied or closer';
    case 'devoted': return 'devoted only';
    case 'specific_npc': return 'this NPC specifically';
    case 'role': return `role: ${row.audience_value}`;
    default: return row.audience_type;
  }
}

/**
 * Format an NPC's voice palette (stored as JSON on npcs.voice_palette) as a
 * multi-line prompt block. Returns null if no palette is set or the JSON is
 * malformed. Inlined here rather than imported from npcVoiceService to keep
 * the prompt builder free of AI-client dependencies.
 *
 * Palette shape:
 *   { age_descriptor, register, speech_patterns[], mannerisms[], vocabulary, forbid[] }
 */
function formatVoicePalette(paletteJson) {
  if (!paletteJson) return null;
  let palette;
  if (typeof paletteJson === 'string') {
    try { palette = JSON.parse(paletteJson); } catch { return null; }
  } else {
    palette = paletteJson;
  }
  if (!palette || !palette.register) return null;

  const lines = [];
  const voicePieces = [palette.age_descriptor, palette.register].filter(Boolean);
  if (voicePieces.length > 0) lines.push(`  Voice: ${voicePieces.join(', ')}.`);
  if (Array.isArray(palette.speech_patterns) && palette.speech_patterns.length > 0) {
    lines.push(`  Speech: ${palette.speech_patterns.join(', ')}.`);
  }
  if (Array.isArray(palette.mannerisms) && palette.mannerisms.length > 0) {
    lines.push(`  Mannerisms: ${palette.mannerisms.join(', ')}.`);
  }
  if (palette.vocabulary) lines.push(`  Vocabulary: ${palette.vocabulary}.`);
  if (Array.isArray(palette.forbid) && palette.forbid.length > 0) {
    lines.push(`  Never says: ${palette.forbid.join(', ')}.`);
  }
  return lines.length > 0 ? lines.join('\n') : null;
}

/**
 * Format custom NPC data for the system prompt.
 *
 * `nicknameResolutions` is an optional map keyed by npc id → resolution object
 * (shape from `nicknameService.resolveForNpc`). When present, each NPC block
 * gets a "Calls the PC:" line specifying which form of the player's name this
 * NPC should use, based on the audience rules the player set up.
 */
function formatCustomNpcs(npcs, nicknameResolutions = null) {
  if (!npcs || npcs.length === 0) return '';

  const npcDescriptions = npcs.map(npc => {
    const availability = npc.campaign_availability || 'available';
    let roleNote = '';
    if (availability === 'companion') {
      roleNote = ' [POTENTIAL COMPANION - can offer to join the party if appropriate]';
    } else if (availability === 'mention_only') {
      roleNote = ' [MENTION ONLY - reference this character but they should not appear directly in scenes]';
    }

    const relationship = npc.relationship_to_party?.replace(/_/g, ' ') || 'neutral';
    let roleDescription = '';
    if (relationship === 'merchant' || npc.occupation_category === 'merchant') {
      roleDescription = ' ** THIS IS A MERCHANT - they buy and sell goods, NOT a quest giver or guardian **';
    } else if (relationship === 'ally') {
      roleDescription = ' ** This NPC is friendly and may help the player **';
    } else if (relationship === 'enemy') {
      roleDescription = ' ** This NPC is hostile to the player **';
    }

    const resolution = nicknameResolutions ? nicknameResolutions[npc.id] : null;
    const namingLine = formatNamingProtocolLine(resolution);

    // Voice-rendering policy (unified v1.0.90):
    //
    // An NPC can have three overlapping sources of voice data:
    //   • voice_palette (structured, Opus-generated) — authoritative when present
    //   • personality_trait_1/2 (free-text) — can duplicate or contradict palette
    //   • background_notes (free-text) — often mixes story context with voice tells
    //
    // Old rendering put all three into the prompt side-by-side with equal
    // weight, so the DM saw contradictory cues ("limited vocabulary" from
    // palette + "studied rhetoric" from background). Now:
    //
    //   IF palette exists: palette is the SOLE VOICE source. Personality
    //     traits and background notes render as CHARACTER CONTEXT (who
    //     they are, what they care about) — not as voice instructions.
    //   IF no palette: personality traits + occupation form a minimal
    //     voice block as the fallback, clearly labelled.
    const palette = formatVoicePalette(npc.voice_palette);
    const hasPalette = !!palette;

    // Split identity / context / voice into three labelled blocks so the
    // DM can tell which data is authoritative for which concern.
    const identityLines = [
      `- ${npc.name}${roleNote}${roleDescription}`,
      `  Race: ${npc.race}${npc.age ? ` (${npc.age})` : ''}, Gender: ${npc.gender || 'unspecified'}`,
      formatSpeciesLine(npc.race, null)
        ? `  ${formatSpeciesLine(npc.race, null)}`
        : null,
      formatOriginLine(npc.origin_setting, npc.origin_region, npc.origin_explanation, npc.race)
        ? `  ${formatOriginLine(npc.origin_setting, npc.origin_region, npc.origin_explanation, npc.race)}`
        : null,
      npc.nickname ? `  Private Nickname: "${npc.nickname}" (ONLY use if the NPC explicitly shares it with the player - introduce them by their full name first)` : null,
      namingLine,
      npc.occupation ? `  OCCUPATION: ${npc.occupation} - THIS DEFINES WHAT THEY DO. A book dealer sells books. A blacksmith forges weapons. DO NOT make them into something else.` : null,
      npc.occupation_category ? `  Occupation Type: ${npc.occupation_category}` : null,
      npc.distinguishing_features ? `  Appearance: ${npc.distinguishing_features}` : null,
      npc.profession_key ? buildProfessionPromptLine(npc) : null,
      npc.current_location ? `  Location: ${npc.current_location}` : null,
      `  Relationship to Player: ${relationship}`
    ].filter(Boolean);

    const contextLines = [];
    if (npc.motivation) contextLines.push(`  Motivation: ${npc.motivation}`);
    if (npc.secret) contextLines.push(`  Secret (reveal gradually if appropriate): ${npc.secret}`);
    // DM-system Part 1: rolled complexity tier. The AI sees the hidden agenda
    // but must NEVER reveal it directly — behavior only. Surface-tier NPCs
    // and NPCs without agenda content render nothing here.
    const agendaBlock = buildAgendaPromptBlock(npc);
    if (agendaBlock) contextLines.push(agendaBlock);
    if (hasPalette && (npc.personality_trait_1 || npc.background_notes)) {
      // With a palette, personality + notes are about who the character is,
      // not how they sound. Fold them into a single Character Context block
      // so they don't look like voice directives.
      const contextBits = [];
      if (npc.personality_trait_1) {
        contextBits.push(`${npc.personality_trait_1}${npc.personality_trait_2 ? ', ' + npc.personality_trait_2 : ''}`);
      }
      if (npc.background_notes) contextBits.push(npc.background_notes);
      if (contextBits.length > 0) {
        contextLines.push(`  Character Context (background — the VOICE block below is how they sound): ${contextBits.join(' — ')}`);
      }
    }

    let voiceSection;
    if (hasPalette) {
      voiceSection = `  VOICE (use these cues — if anything else about this NPC conflicts, these win):\n${palette}`;
    } else if (npc.personality_trait_1 || npc.background_notes) {
      // No palette — fall back on personality/background as voice cues,
      // clearly labelled as the only voice source available.
      const fallbackBits = [];
      if (npc.personality_trait_1) {
        fallbackBits.push(`${npc.personality_trait_1}${npc.personality_trait_2 ? ', ' + npc.personality_trait_2 : ''}`);
      }
      if (npc.background_notes) fallbackBits.push(npc.background_notes);
      voiceSection = `  Voice (no palette — interpret from personality + occupation): ${fallbackBits.join(' — ')}`;
    } else {
      voiceSection = null;
    }

    const parts = [...identityLines, ...contextLines, voiceSection].filter(Boolean);
    return parts.join('\n');
  });

  return `\n\nCUSTOM NPCS - CRITICAL INSTRUCTIONS:
These are pre-defined characters the user created. You MUST respect their established roles:
- A MERCHANT sells goods - they are NOT mysterious guardians, quest givers, or plot devices
- An NPC's OCCUPATION defines what they do - a "Book Dealer" deals books, not guards ancient sites
- Each NPC has ONE VOICE block showing how they sound (register, speech patterns, mannerisms, vocabulary, forbids). Use those cues literally — a nervous NPC stays nervous, a taciturn NPC stays taciturn. Don't flatten voices toward a generic confident register.
- If Character Context seems to contradict the VOICE block for how the NPC SPEAKS, the VOICE block wins. Context is for WHO they are; VOICE is for HOW they sound.
- If you need a guardian, mystic, or quest-giver, create a NEW NPC - don't repurpose these

${npcDescriptions.join('\n\n')}`;
}

// Map each D&D 5e skill to its governing ability score
const SKILL_ABILITY_MAP = {
  'Acrobatics': 'dex', 'Animal Handling': 'wis', 'Arcana': 'int',
  'Athletics': 'str', 'Deception': 'cha', 'History': 'int',
  'Insight': 'wis', 'Intimidation': 'cha', 'Investigation': 'int',
  'Medicine': 'wis', 'Nature': 'int', 'Perception': 'wis',
  'Performance': 'cha', 'Persuasion': 'cha', 'Religion': 'int',
  'Sleight of Hand': 'dex', 'Stealth': 'dex', 'Survival': 'wis'
};

function computeSkillModifiers(abilityScores, skillNames, level) {
  const profBonus = Math.floor(((level || 1) - 1) / 4) + 2;
  const modifiers = [];
  for (const skill of skillNames) {
    const ability = SKILL_ABILITY_MAP[skill];
    if (!ability) continue;
    const score = abilityScores[ability] || 10;
    const abilityMod = Math.floor((score - 10) / 2);
    const total = abilityMod + profBonus;
    modifiers.push(`${skill} ${total >= 0 ? '+' : ''}${total}`);
  }
  return modifiers;
}

function computePassivePerception(abilityScores, skillNames, level) {
  const profBonus = Math.floor(((level || 1) - 1) / 4) + 2;
  const wisMod = Math.floor(((abilityScores.wis || 10) - 10) / 2);
  const hasProficiency = skillNames.some(s => s.toLowerCase() === 'perception');
  return 10 + wisMod + (hasProficiency ? profBonus : 0);
}

/**
 * Format a companion's current mood for the system prompt
 */
function formatCompanionMood(companion) {
  const mood = companion.companion_mood || 'content';
  if (mood === 'content' || !mood) return null;

  const intensity = companion.companion_mood_intensity || 1;
  const cause = companion.companion_mood_cause;
  const guidance = MOOD_RP_GUIDANCE[mood];

  let line = `  CURRENT MOOD: ${mood.charAt(0).toUpperCase() + mood.slice(1)} (${intensity}/5)`;
  if (cause) line += ` — ${cause}`;
  if (guidance) line += `\n  → Roleplay as ${guidance}`;

  return line;
}

/**
 * Format active companions for the system prompt
 */
/**
 * Render a single companion's progression layer (theme + unlocked abilities +
 * ancestry feats) as indented lines for inclusion inside their formatCompanions
 * block. Returns '' when there's nothing to show, so the `.filter(Boolean)`
 * upstream drops it cleanly. Parity with formatProgression() for player
 * characters but slimmer — no Knight path, synergies, or mythic (which apply
 * to player characters only today).
 */
/**
 * Render a spellcasting companion's slot state as an indented line for the
 * DM prompt: "Spell slots: L1 2/4, L2 0/3" (used/max). Returns '' when the
 * companion has no slots (non-casters, npc-stats companions, or pre-rest).
 */
/**
 * Render a companion's persistent active conditions as an indented line:
 *   "Active conditions: Poisoned, Prone, Exhaustion 2"
 * Pulls from the `active_conditions` JSON column (Phase 7). Returns '' when
 * there's nothing to show. Distinct from the session-transient ConditionPanel
 * state, which the DM session also injects via formatConditionsForAI().
 */
export function formatCompanionActiveConditionsLine(activeConditions) {
  if (!activeConditions) return '';
  let arr = activeConditions;
  if (typeof arr === 'string') {
    try { arr = JSON.parse(arr); } catch { return ''; }
  }
  if (!Array.isArray(arr) || arr.length === 0) return '';
  const display = arr.map(k =>
    String(k).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  );
  const exKey = arr.find(k => /^exhaustion_[1-6]$/.test(String(k)));
  const speedNote = exKey ? ` — Speed reduced by ${5 * Number(String(exKey).split('_')[1])} ft` : '';
  return `  Active conditions: ${display.join(', ')}${speedNote}`;
}

/**
 * Render a dying companion's death save tally as an indented line:
 *   "Death saves: 2 successes, 1 failure (at 0 HP — one more failure = dead)"
 * Only rendered when the companion is at 0 HP. Returns '' otherwise.
 */
export function formatCompanionDeathSavesLine(companion) {
  const hp = companion?.companion_current_hp;
  if (hp === undefined || hp === null || hp > 0) return '';
  const s = companion.death_save_successes || 0;
  const f = companion.death_save_failures || 0;
  const sLabel = s === 1 ? 'success' : 'successes';
  const fLabel = f === 1 ? 'failure' : 'failures';
  const edge = f >= 2
    ? ' — one more failure = dead'
    : s >= 2
      ? ' — one more success stabilizes'
      : '';
  return `  Death saves: ${s} ${sLabel}, ${f} ${fLabel} (at 0 HP${edge})`;
}

export function formatCompanionSpellSlotsLine(max, used) {
  if (!max || typeof max !== 'object') return '';
  const levels = Object.keys(max)
    .map(k => parseInt(k, 10))
    .filter(n => Number.isInteger(n) && n >= 1 && n <= 9)
    .sort((a, b) => a - b);
  if (levels.length === 0) return '';

  const parts = levels
    .map(lv => {
      const m = max[lv] || max[String(lv)] || 0;
      if (!m) return null;
      const u = (used && (used[lv] ?? used[String(lv)])) || 0;
      return `L${lv} ${u}/${m}`;
    })
    .filter(Boolean);
  if (parts.length === 0) return '';

  // Warlock-style shape: { slots: N, level: M } — handled separately by
  // callers; this helper only renders the standard `{ "1": N, "2": N }` map.
  return `  Spell slots: ${parts.join(', ')}`;
}

export function formatCompanionProgressionLines(progression) {
  if (!progression || !progression.theme) return '';

  const parts = [];
  parts.push(`  Theme: ${progression.theme.theme_name}${progression.theme.path_choice ? ` (${progression.theme.path_choice})` : ''}`);

  if (progression.theme_unlocks && progression.theme_unlocks.length > 0) {
    parts.push('  Unlocked theme abilities:');
    for (const u of progression.theme_unlocks) {
      if (!u.ability_name) continue;
      parts.push(`    - L${u.tier} ${u.ability_name}: ${u.ability_description}`);
      if (u.mechanics) parts.push(`      Mechanics: ${u.mechanics}`);
    }
  }

  if (progression.ancestry_feats && progression.ancestry_feats.length > 0) {
    parts.push('  Ancestry feats:');
    for (const f of progression.ancestry_feats) {
      parts.push(`    - L${f.tier} ${f.feat_name}: ${f.description}`);
      if (f.mechanics) parts.push(`      Mechanics: ${f.mechanics}`);
    }
  }

  // Origin feat (Stage 3) — the theme's fixed feat, granted at creation.
  if (progression.origin_feat) {
    const o = progression.origin_feat;
    parts.push(`  Origin feat: ${o.feat_name}${o.selected_at_level ? ` (L${o.selected_at_level})` : ''}: ${o.effect || ''}`);
    if (o.choices_data) parts.push(`    Choices: ${JSON.stringify(o.choices_data)}`);
  }

  // Versatile feat (item 19, human) — the standalone 2024 pick; it
  // stacks with the theme feat and is always a different feat.
  if (progression.versatile_feat) {
    const v = progression.versatile_feat;
    parts.push(`  Versatile feat (Human): ${v.feat_name}${v.selected_at_level ? ` (L${v.selected_at_level})` : ''}: ${v.effect || ''}`);
    if (v.choices_data) parts.push(`    Choices: ${JSON.stringify(v.choices_data)}`);
  }

  return parts.join('\n');
}

function formatCompanions(companions, awayCompanions = []) {
  if ((!companions || companions.length === 0) && awayCompanions.length === 0) return '';

  const companionDescriptions = companions.map(companion => {
    const isClassBased = companion.progression_type === 'class_based';
    let statsLine = '';

    if (isClassBased) {
      const abilityScores = companion.companion_ability_scores
        ? JSON.parse(companion.companion_ability_scores)
        : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

      // Phase 10: render multiclass breakdown when class_levels has >1 entry
      let classLine;
      let classLevels = companion.companion_class_levels;
      if (typeof classLevels === 'string') {
        try { classLevels = JSON.parse(classLevels); } catch { classLevels = null; }
      }
      if (Array.isArray(classLevels) && classLevels.length > 1) {
        const parts = classLevels.map(cl =>
          `${cl.class} ${cl.level}${cl.subclass ? ` (${cl.subclass})` : ''}`
        );
        classLine = `  Classes: ${parts.join(' / ')} — total ${companion.companion_level}`;
      } else {
        classLine = `  Class: ${companion.companion_class} Level ${companion.companion_level}${companion.companion_subclass ? ` (${companion.companion_subclass})` : ''}`;
      }

      statsLine = `${classLine}
  HP: ${companion.companion_current_hp}/${companion.companion_max_hp}
  Abilities: STR ${abilityScores.str}, DEX ${abilityScores.dex}, CON ${abilityScores.con}, INT ${abilityScores.int}, WIS ${abilityScores.wis}, CHA ${abilityScores.cha}`;

      // Skill modifiers from the real sheet (same math as the player's) —
      // the DM sees what this companion is actually good at, and
      // ROLL_REQUEST resolves their checks with these exact numbers.
      const skillNames = typeof companion.skill_proficiencies === 'string'
        ? (() => { try { return JSON.parse(companion.skill_proficiencies || '[]'); } catch { return []; } })()
        : (companion.skill_proficiencies || []);
      if (Array.isArray(skillNames) && skillNames.length > 0) {
        const mods = computeSkillModifiers(abilityScores, skillNames, companion.companion_level || 1);
        if (mods.length > 0) {
          statsLine += `\n  Skills: ${mods.join(', ')} (Passive Perception ${computePassivePerception(abilityScores, skillNames, companion.companion_level || 1)})`;
        }
      }
    } else {
      const originalStats = companion.original_stats_snapshot
        ? JSON.parse(companion.original_stats_snapshot)
        : null;
      if (originalStats) {
        statsLine = `  Using NPC Stats: CR ${originalStats.cr || 'unknown'}, AC ${originalStats.ac || 10}, HP ${originalStats.hp || '?'}`;
      }
    }

    // Parse equipment for companion
    let equipmentLine = '';
    try {
      const equipment = typeof companion.equipment === 'string'
        ? JSON.parse(companion.equipment || '{}')
        : (companion.equipment || {});
      const equippedItems = [];
      if (equipment.mainHand?.name) {
        equippedItems.push(`${equipment.mainHand.name} (weapon)`);
      }
      if (equipment.offHand?.name) {
        equippedItems.push(`${equipment.offHand.name}`);
      }
      if (equipment.armor?.name) {
        equippedItems.push(`${equipment.armor.name} (armor)`);
      }
      if (equippedItems.length > 0) {
        equipmentLine = `  Equipment: ${equippedItems.join(', ')}`;
      }
    } catch (e) {
      // Ignore equipment parsing errors
    }

    // Parse skills and compute modifiers
    let skillsLine = '';
    let passivePerceptionLine = '';
    try {
      const npcSkills = companion.npc_skills
        ? (typeof companion.npc_skills === 'string' ? JSON.parse(companion.npc_skills) : companion.npc_skills)
        : [];
      const companionSkills = companion.skill_proficiencies
        ? (typeof companion.skill_proficiencies === 'string' ? JSON.parse(companion.skill_proficiencies) : companion.skill_proficiencies)
        : [];
      const allSkills = [...new Set([...npcSkills, ...companionSkills])];

      if (allSkills.length > 0 && isClassBased) {
        const abilityScores = companion.companion_ability_scores
          ? (typeof companion.companion_ability_scores === 'string' ? JSON.parse(companion.companion_ability_scores) : companion.companion_ability_scores)
          : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const modifiers = computeSkillModifiers(abilityScores, allSkills, companion.companion_level);
        if (modifiers.length > 0) {
          skillsLine = `  Skills: ${modifiers.join(', ')}`;
        }
        const passivePerception = computePassivePerception(abilityScores, allSkills, companion.companion_level);
        passivePerceptionLine = `  Passive Perception: ${passivePerception}`;
      } else if (allSkills.length > 0) {
        skillsLine = `  Skills: ${allSkills.join(', ')}`;
      }
    } catch (e) {
      // Ignore
    }

    // Determine pronouns for this companion
    const gender = companion.gender?.toLowerCase() || '';
    let pronouns = 'they/them';
    if (gender === 'male' || gender === 'm') pronouns = 'he/him';
    else if (gender === 'female' || gender === 'f') pronouns = 'she/her';

    // Determine languages
    const occupation = (companion.occupation || '').toLowerCase();
    const isEducated = occupation.includes('scholar') || occupation.includes('wizard') ||
                       occupation.includes('sage') || occupation.includes('noble') ||
                       occupation.includes('priest') || occupation.includes('cleric');
    const languagesNote = isEducated
      ? '  Languages: Common (may know additional scholarly languages)'
      : '  Languages: Common ONLY (cannot read or identify other scripts)';

    // Determine limitations based on background
    let limitationsLine = '';
    const limitationsList = [];
    if (!isEducated && !occupation.includes('healer') && !occupation.includes('medic') && !occupation.includes('doctor')) {
      limitationsList.push('no medical/healer training');
    }
    if (!isEducated) {
      limitationsList.push('cannot identify magical runes or ancient scripts');
    }
    if (occupation.includes('farm') || occupation.includes('peasant') || occupation.includes('laborer')) {
      limitationsList.push('limited worldly knowledge');
    }
    if (limitationsList.length > 0) {
      limitationsLine = `  LIMITATIONS (respect these): ${limitationsList.join(', ')}`;
    }

    const backgroundName = companion.companion_background || companion.background || companion.occupation;

    const parts = [
      `- ${companion.name}${companion.nickname ? ` "${companion.nickname}"` : ''} (Companion)`,
      `  Gender: ${companion.gender || 'unspecified'} - USE ${pronouns.toUpperCase()} PRONOUNS`,
      `  Race: ${companion.companion_subrace ? `${companion.companion_subrace} ` : ''}${companion.race}${companion.age ? `, Age: ${companion.age}` : ''}`,
      formatSpeciesLine(companion.race, companion.companion_subrace)
        ? `  ${formatSpeciesLine(companion.race, companion.companion_subrace)}`
        : null,
      backgroundName ? `  Background: ${backgroundName}` : null,
      companion.alignment ? `  Alignment: ${companion.alignment}` : null,
      companion.faith ? `  Faith/Deity: ${companion.faith}` : null,
      statsLine,
      companion.armor_class ? `  AC: ${companion.armor_class}, Speed: ${companion.companion_speed || companion.speed || 30} ft.` : null,
      equipmentLine || null,
      skillsLine || null,
      passivePerceptionLine || null,
      languagesNote,
      limitationsLine || null,
      companion.personality_trait_1 ? `  Personality: ${companion.personality_trait_1}${companion.personality_trait_2 ? '. ' + companion.personality_trait_2 : ''}` : null,
      companion.ideals ? `  Ideals: ${companion.ideals}` : null,
      companion.bonds ? `  Bonds: ${companion.bonds}` : null,
      companion.flaws ? `  Flaws: ${companion.flaws}` : null,
      companion.voice ? `  Voice/Speech: ${companion.voice}` : null,
      companion.mannerism ? `  Mannerism: ${companion.mannerism}` : null,
      companion.motivation ? `  Motivation: ${companion.motivation}` : null,
      companion.relationship_to_party ? `  Relationship to Party: ${companion.relationship_to_party}` : null,
      companion.background_notes ? `  Backstory: ${companion.background_notes}` : null,
      companion.notes ? `  Player Notes: ${companion.notes}` : null,
      formatCompanionMood(companion),
      // Phase 3 SC-2 — companion loyalty injection (the spec §2.4 gap fix).
      // Sourced from cb.loyalty + cb.loyalty_events on the SELECT join in
      // routes/dmSession.js. Returns empty string when no backstory row
      // exists, which the .filter(Boolean) below drops cleanly.
      (() => {
        const fragment = formatLoyaltyForPrompt(
          companion.companion_loyalty,
          companion.companion_loyalty_events
        );
        return fragment ? `  ${fragment}` : null;
      })(),
      formatCompanionProgressionLines(companion.progression),
      formatCompanionSpellSlotsLine(companion.spell_slots_max, companion.spell_slots_used),
      formatCompanionActiveConditionsLine(companion.active_conditions),
      formatCompanionDeathSavesLine(companion),
      // DM System Part 2 — Companion Engine standing block (DM-ONLY):
      // private goals, held task, private knowledge, relationship trackers,
      // and the act-on-your-own-turn behavioral rules. Renders header +
      // rules even before the engine columns are populated.
      (() => {
        const block = buildCompanionPromptBlock({
          ...companion,
          class: companion.companion_class || companion.class,
          personality: companion.personality_trait_1 || companion.personality,
        });
        return block || null;
      })()
    ].filter(Boolean);

    return parts.join('\n');
  });

  return `\n\nACTIVE COMPANIONS IN THE PARTY:
These NPCs have joined the player's adventuring party. They travel and fight alongside the player.

COMPANION CONTROL:
- YOU (the DM) roleplay companion dialogue, personality, and reactions
- The PLAYER controls companion combat actions and level-up choices
- Companions should have distinct voices and opinions based on their personalities
- Companions should feel like real party members, not silent followers
- CRITICAL: Respect each companion's LIMITATIONS - a farm boy cannot identify runes, a commoner doesn't know healing arts
- Companions ONLY wield the weapons listed in their Equipment - do not invent or change their gear

COMPANION PERSONALITY AND MORAL INDEPENDENCE - CRITICAL:
- Companions are NOT yes-men. They have their OWN moral compass, opinions, and emotional responses.
- CHECK EACH COMPANION'S ALIGNMENT, IDEALS, AND FLAWS. These should ACTIVELY shape how they react.
- A lawful good companion should object when the player steals, lies, or harms innocents.
- A chaotic neutral companion might act impulsively, take things without asking, or refuse to follow rules.
- A lawful neutral companion cares about order and contracts — not the player's feelings.
- Companions can and SHOULD disagree with the player's decisions when those decisions conflict with their values.
- Disagreement doesn't mean disloyalty — it means the companion is a real person with convictions.
- Companions should exhibit REAL EMOTIONS beyond cheerful helpfulness:
  * FEAR: A companion can be scared before entering a dungeon, reluctant to face overwhelming odds, or panicked after a near-death experience
  * DOUBT: A companion can question the plan, wonder if they're on the right side, or lose faith in the mission
  * AMBITION: A companion can want glory, credit, a bigger share of treasure, or to lead instead of follow
  * RESENTMENT: A companion can be bitter about being sidelined, ignored, or overruled
  * FRUSTRATION: A companion can snap at the player for reckless decisions or poor planning
  * MORAL CONFLICT: A companion can refuse an order that violates their principles — "I won't do that."
- Not every companion reaction should be supportive. Mix in reluctance, grumbling, side-eye, muttered objections.
- Companions with evil or neutral alignments may suggest morally questionable solutions: bribery, intimidation, theft, abandoning those in need, cutting losses.
- Companions with good alignments may insist on helping when the player wants to move on, or refuse to leave innocents behind.
- Let companion personalities CLASH with each other too — different companions may disagree about what to do next.

PARTY LOCATION TRACKING - CRITICAL:
- Track WHERE each companion is at all times during the session
- If a companion was sent somewhere, they are AT THAT LOCATION until they return
- If a companion was just with the player 15 minutes ago, they should NOT act surprised to see them
- When the party splits up, remember WHO went WHERE and for what purpose
- Companions who stayed together know what each other experienced
- A companion returning from an errand knows only what happened at THEIR location, not what the player did while apart
- When reuniting, companions should react appropriately to the TIME elapsed and WHAT they know

COMPANION SKILL CHECKS:
When you call for a skill check from the player, consider if present companions should also attempt it:
- Check each companion's skill modifiers listed below
- If a companion is proficient in the relevant skill AND is present, they attempt it too
- You decide the companion's result narratively (no need to state numbers)
- If the player FAILS but a companion SUCCEEDS, narrate the companion stepping in with personality-appropriate flavor
- If BOTH fail, narrate the shared failure
- If the player SUCCEEDS, the companion's attempt is usually unnecessary — skip it
- NOT every check involves companions — only when relevant and the companion is present
- Social checks (Persuasion, Deception, Intimidation) usually only involve the speaker
- Companions with high passive Perception may notice things the player misses

${companionDescriptions.join('\n\n')}${formatAwayCompanions(awayCompanions)}`;
}

/**
 * Format away companions section for the DM prompt.
 */
function formatAwayCompanions(awayCompanions) {
  if (!awayCompanions || awayCompanions.length === 0) return '';

  const lines = awayCompanions.map(c => {
    const elapsed = c.start_game_day ? `away ${c.expected_duration_days ? `~${c.expected_duration_days} days` : 'unknown duration'}` : '';
    const location = c.location ? ` at ${c.location}` : '';
    return `- ${c.name}: ${c.activity_type}${location} (${elapsed})`;
  });

  return `

COMPANIONS CURRENTLY AWAY:
These companions are NOT present. Do NOT include them in scenes or combat.
If the player asks about them, reference their activity.
${lines.join('\n')}`;
}

/**
 * Format custom concepts/themes for the system prompt
 */
function formatCustomConcepts(concepts) {
  if (!concepts || concepts.trim().length === 0) return '';

  return `\n\nPLAYER'S NARRATIVE VISION:
The player has shared what they want this campaign to explore:

"${concepts.trim()}"

HOW TO USE THIS:
- These are THEMES to embody, not items to check off a list
- Create situations that naturally evoke these themes - don't force or explicitly mention them
- Build NPCs who can become vehicles for these themes (potential allies, rivals, love interests, betrayers)
- Let relationships develop organically through shared experiences
- Plant seeds early that pay off later - a friendly NPC now might become family over sessions
- Create moments of vulnerability, trust, and choice where these themes can emerge
- The player will drive the connections - your job is to create opportunities
- Heartbreak and betrayal should feel EARNED, not arbitrary - build trust before testing it
- Found family forms through surviving challenges together, not through declaration`;
}

/**
 * Format pending downtime narratives for the system prompt
 */
function formatPendingNarratives(narratives) {
  if (!narratives || narratives.length === 0) return '';

  const narrativeDescriptions = narratives.map(event => {
    let description = `- ${event.activityName} (${event.duration}): ${event.result}`;

    if (event.details?.events && event.details.events.length > 0) {
      description += `\n  Notable: ${event.details.events.join(', ')}`;
    }

    return description;
  });

  return `\n\nRECENT DOWNTIME ACTIVITIES:
The character completed these activities since the last adventure. Acknowledge this naturally in your opening narrative - weave it into the scene without making it feel like a checklist. For example, if they trained, they might feel sharper; if they worked, they might have coins in their purse; if they rested well, they feel refreshed.

${narrativeDescriptions.join('\n')}

IMPORTANT: Reference this downtime ONCE at the start, then move on. Don't keep bringing it up.`;
}

/**
 * Render the compressed "campaign so far" block.
 *
 * Labelled explicitly as compressed and as the earlier part of the same
 * campaign. Without that framing the DM reads two overlapping accounts of the
 * same events and treats the older one as a separate, earlier campaign.
 */
function formatCampaignRollup(rollup) {
  if (!rollup || !rollup.summary) return '';
  const through = rollup.through_session_number;
  const span = through ? `sessions 1-${through}` : 'the early sessions';
  return `THE CAMPAIGN SO FAR (${span}, compressed):
These sessions are summarised rather than shown in full because the campaign has run long. They are no less canon for it — treat every name, debt, grudge and unresolved thread here as live.

${rollup.summary}`;
}

/**
 * Format previous session summaries for campaign continuity.
 * Prefers richer chronicle summaries (300-500 words with mood/cliffhanger) when available.
 *
 * Phase 4 adds a two-tier history. `campaignRollup` is the compressed
 * "campaign so far" covering everything that has aged out of the verbatim
 * window (see storyChronicleService.rollUpOldChronicles); `chronicleSummaries`
 * remains the newest sessions, verbatim. Before this, a campaign past session
 * 10 simply stopped showing the DM its own beginning.
 */
function formatPreviousSessionSummaries(summaries, isContinuing, chronicleSummaries = [], campaignRollup = null) {
  // Use chronicle summaries if available (richer data), otherwise fall back to dm_sessions summaries
  const hasChronicles = chronicleSummaries && chronicleSummaries.length > 0;
  const hasSummaries = summaries && summaries.length > 0;
  const hasRollup = !!(campaignRollup && campaignRollup.summary);

  if (!hasChronicles && !hasSummaries && !hasRollup) return '';

  // The rollup alone is still worth rendering — a campaign with a rollup but
  // no verbatim chronicles would otherwise show the DM nothing at all.
  if (!hasChronicles && !hasSummaries) {
    return `\n\nPREVIOUS ADVENTURES — FULL CAMPAIGN HISTORY:
${formatCampaignRollup(campaignRollup)}`;
  }

  let summaryDescriptions;

  if (hasChronicles) {
    summaryDescriptions = chronicleSummaries.map(c => {
      const dayRange = c.game_day_start && c.game_day_end
        ? ` (Days ${c.game_day_start}-${c.game_day_end})`
        : c.game_day_start ? ` (Day ${c.game_day_start})` : '';
      const mood = c.mood ? `, Mood: ${c.mood}` : '';
      let text = `Session ${c.session_number}${dayRange}${mood}: ${c.summary || 'No summary available.'}`;
      if (c.cliffhanger) {
        text += `\n  Cliffhanger: ${c.cliffhanger}`;
      }
      // Include key decisions if available. safeParse rather than a bare
      // JSON.parse: this runs during system-prompt assembly, so one malformed
      // key_decisions row would otherwise take down session start entirely.
      const decisions = typeof c.key_decisions === 'string'
        ? (safeParse(c.key_decisions, []) ?? [])
        : (c.key_decisions || []);
      if (Array.isArray(decisions) && decisions.length > 0) {
        const decisionLines = decisions.slice(0, 3).map(d => {
          const decision = d.decision || d;
          const consequence = d.consequence ? ` → ${d.consequence}` : '';
          return `  - ${decision}${consequence}`;
        });
        text += '\n  Key decisions:\n' + decisionLines.join('\n');
      }
      return text;
    });
  } else {
    summaryDescriptions = summaries.map((session, index) => {
      return `Session ${index + 1}: ${session.summary || 'No summary available.'}`;
    });
  }

  const rollupBlock = hasRollup ? `${formatCampaignRollup(campaignRollup)}\n\n` : '';
  const recentHeader = hasRollup ? 'RECENT SESSIONS (in full):\n\n' : '';

  return `\n\nPREVIOUS ADVENTURES — FULL CAMPAIGN HISTORY:
This character has a rich history of previous adventures. ALL of these events are CANON — they happened and shape the ongoing story.
NPCs remember the character. Consequences of past actions persist. The story is deeply connected across sessions.

${rollupBlock}${recentHeader}${summaryDescriptions.join('\n\n')}

USING THIS HISTORY:
- Reference past events naturally when they become relevant — NPCs may mention them, consequences may surface
- The player lived through these events — subtle callbacks are better than exposition dumps
- Don't recap everything at once, but DO remember it all. When an NPC from Session 2 appears in Session 8, they remember what happened
- Promises, deals, and unfinished business from ANY session remain active until resolved`;
}

/**
 * Format campaign notes for persistent memory across sessions
 */
function formatCampaignNotes(notes) {
  if (!notes || notes.trim().length === 0) return '';

  return `\n\n=== CAMPAIGN MEMORY (CRITICAL - READ CAREFULLY) ===
These are persistent details from the character's previous adventures. You MUST remember and reference these when relevant:

${notes}

=== END CAMPAIGN MEMORY ===

USING THIS MEMORY:
- Reference NPCs by name when they appear or are relevant
- Remember promises made and obligations owed
- Know who the character's allies and enemies are
- Recall items given to NPCs or received from them
- Build on established relationships
- Follow up on unresolved threads when appropriate
- These details are CANON - they actually happened`;
}

/**
 * Format character personality memories observed during gameplay
 */
function formatCharacterMemories(memories) {
  if (!memories || memories.trim().length === 0) return '';

  return `\n\n=== CHARACTER PERSONALITY (OBSERVED IN PLAY) ===
These personality details emerged from actual gameplay — things the character revealed through their own words and choices. They are CANON — this is who the character IS:

${memories}

USING THESE MEMORIES:
- Reference these personality traits when relevant situations arise naturally
- Have NPCs react to the character's known preferences and habits (e.g., offer tea instead of ale if they prefer tea)
- If the character expressed discomfort with something, that discomfort persists unless noted otherwise
- Some memories reflect current state (gear, preparedness, health) — reference them accurately
- Weave these details into the narrative naturally — don't lecture or remind the player of their own traits
- These evolve over time — trust what is written here as the character's CURRENT state
=== END CHARACTER PERSONALITY ===`;
}

/**
 * Format a single NPC entry with optional voice guide
 */
function formatNPCEntry(npc, includeVoice) {
  let entry = `- ${npc.name} (${npc.role}): ${npc.motivation || npc.description || ''} - typically found at ${npc.location || 'various locations'}`;
  if (includeVoice && npc.voice_guide) {
    const vg = npc.voice_guide;
    if (vg.speech) entry += `\n  Voice: ${vg.speech}`;
    if (vg.surface) entry += `\n  Surface: ${vg.surface}`;
  }
  if (npc.secrets && npc.secrets.length > 0) {
    entry += `\n  DM-ONLY secrets: ${npc.secrets.slice(0, 3).join('; ')}`;
  }
  return entry;
}

/**
 * Format campaign plan for DM context
 */
/**
 * Per-theme narration hooks that the AI DM should weave into gameplay when the
 * character has the corresponding theme. Keyed by theme_id. Each entry is a
 * short directive — not content to render literally, but guidance for how the
 * theme should shape narration.
 */
const NARRATION_HOOKS_BY_THEME = {
  soldier: 'The character is a military veteran. NPCs who were soldiers recognize their bearing. Use tactical language when describing combat. Military authority figures respond to them as a peer.',
  sage: 'The character is a scholar. When lore-appropriate, acknowledge their expertise with subtle detail — they would recognize references others would miss. Knowledge-based NPCs treat them as a colleague.',
  criminal: 'The character has underworld connections. Criminal-aligned NPCs sense their status. When in dangerous districts, the character moves with familiarity that strangers do not. Subtle underworld signals (gestures, code words) are visible to them.',
  acolyte: 'The character is temple-trained. NPCs who share their faith treat them with reverence. Temples are safe ground. Invoke their faith when narrating moments of prayer, grief, or moral clarity.',
  charlatan: 'The character is a con artist by trade. They notice marks instinctively. NPCs trying to deceive them face a skeptical eye. Surface opportunities for them to slip into false identities when the situation calls for it.',
  entertainer: 'The character is a performer. Crowds notice them. When they speak in public, eyes turn. Taverns warm to them. Lean into spectacle — describe the effect their presence has on a room.',
  noble: 'The character is nobility. Commoners defer automatically. Other nobles treat them as a peer. Court etiquette matters. They have political awareness commoners lack — surface subtle political signals in social scenes.',
  outlander: 'The character is wilderness-raised. In their chosen biome they move with confidence others lack. They read wind, tracks, and sky instinctively. Natural environments feel like home; cities feel foreign.',
  sailor: 'The character has lived at sea. Salty language, knowledge of tides and ships, and an ease with sailors come naturally. Ports feel like home. Land-locked cities feel confining.',
  far_traveler: 'The character is foreign. Their accent and mannerisms mark them. Locals are curious. They notice what insiders miss — surface details about local culture that a Far Traveler would spot and comment on.',
  haunted_one: 'The character has faced true horror. Common folk sense it and are simultaneously drawn to them and uneasy. Supernatural creatures recognize the mark. When dark things happen, the Haunted One sees them clearly — describe the chill in the air that others dismiss.',
  guild_artisan: 'The character is a guild-trained craftsperson. They appraise goods by instinct. Merchants treat them with professional respect. Use maker\'s marks, material quality, and craft gossip when they interact with traders.',
  clan_crafter: 'The character is ancestrally trained in craft. Materials and old techniques speak to them. Dwarven kin especially offer hospitality. Describe artisanal details through their trained eye.',
  hermit: 'The character spent years in isolation and carries a discovery. Surface moments of inner stillness. They are composed when others panic. The revelation from their hermitage should occasionally echo in their thoughts during relevant scenes.',
  investigator: 'The character reads scenes the way others read books. Describe crime scenes and mysteries with the detail they would notice. Let them ask DC-appropriate questions of witnesses. Others defer to their analysis.',
  city_watch: 'The character walked the beat. In their home city (or cities of the same banner), they know every alley and face. Local guards recognize them. Describe urban environments with their familiar eye.',
  knight_of_the_order: 'The character is sworn to an order. Their oath shapes their choices. Order members recognize them on sight. Their moral path (True/Reformer/Martyr/Complicit/Fallen/Redemption — tracked in knight_moral_paths) shapes their interactions — reinforce the tension or honor accordingly. Code violations should have consequences.',
  mercenary_veteran: 'The character is a battle-hardened sellsword. Loyalty is earned, not given. They appraise fights by profit and survival. Fellow mercenaries recognize the look. Be pragmatic in their internal frame.',
  urban_bounty_hunter: 'The character hunts people for a living. They notice marks in crowds. Criminal-aligned NPCs hesitate around them. In cities, they know how to ask without asking. Surface pursuit instinct when relevant.',
  folk_hero: 'The character is a legend among common folk. In their home region, commoners greet them warmly. Their deeds precede them. Tyrants notice them too — lean into the double edge of popular recognition.',
  urchin: 'The character survived the streets. They notice escape routes instinctively. Street children recognize one of their own (and may defer to them if the character has treated their kind well). Describe urban environments with the gaps others miss.'
};

/**
 * Format progression data (theme, abilities, ancestry feats, synergies, moral
 * path, mythic amplification) into a prompt section. Returns an empty string
 * when progression is null or the character has no theme selected.
 *
 * This is the DM-facing view of progression: concise, mechanical, with
 * narration hooks. Unlike the Character Sheet which shows the full 4-tier
 * preview, this prompt only highlights UNLOCKED abilities (the AI DM
 * shouldn't narrate abilities the character can't yet use).
 */
export function formatProgression(progression) {
  if (!progression || !progression.theme) return '';

  const parts = [];
  parts.push('\n\nCHARACTER PROGRESSION LAYER:');
  // Creation-solidification item 1: the player's stored theme
  // choices print labelled ("Military Rank: Sergeant; Active Duty:
  // Still in active duty") from progression.theme.choices. A snapshot
  // without the choices array (older callers) keeps the bare
  // path_choice suffix it always had.
  const themeChoices = Array.isArray(progression.theme.choices) ? progression.theme.choices : null;
  if (themeChoices) {
    parts.push(`THEME: ${progression.theme.theme_name}`);
    if (themeChoices.length > 0) {
      parts.push(`Theme choices (the player's answers at creation — treat as canon): ${themeChoices.map(c => `${c.label}: ${c.value}`).join('; ')}`);
    }
  } else {
    parts.push(`THEME: ${progression.theme.theme_name}${progression.theme.path_choice ? ` (${progression.theme.path_choice})` : ''}`);
  }
  if (progression.theme.identity) {
    parts.push(`Identity: ${progression.theme.identity}`);
  }
  if (progression.theme.signature_skill_1) {
    const sigSkills = [progression.theme.signature_skill_1, progression.theme.signature_skill_2]
      .filter(Boolean)
      .join(', ');
    parts.push(`Signature skills: ${sigSkills}`);
  }

  // Unlocked theme abilities
  if (progression.theme_unlocks && progression.theme_unlocks.length > 0) {
    parts.push('\nUNLOCKED THEME ABILITIES (available for use in narration):');
    for (const u of progression.theme_unlocks) {
      parts.push(`- L${u.tier} ${u.ability_name}: ${u.ability_description}`);
      if (u.mechanics) {
        parts.push(`  Mechanics: ${u.mechanics}`);
      }
    }
  }

  // Ancestry feats
  if (progression.ancestry_feats && progression.ancestry_feats.length > 0) {
    parts.push('\nANCESTRY FEATS:');
    for (const f of progression.ancestry_feats) {
      parts.push(`- L${f.tier} ${f.feat_name}: ${f.description}`);
      if (f.mechanics) {
        parts.push(`  Mechanics: ${f.mechanics}`);
      }
    }
  }

  // Origin feat (Stage 3) — the theme's fixed feat, granted at creation.
  if (progression.origin_feat) {
    const o = progression.origin_feat;
    parts.push(`\nOrigin feat: ${o.feat_name}${o.selected_at_level ? ` (L${o.selected_at_level})` : ''}: ${o.effect || ''}`);
    if (o.choices_data) {
      parts.push(`  Choices: ${JSON.stringify(o.choices_data)}`);
    }
  }

  // Versatile feat (item 19, human) — the standalone 2024 pick; it
  // stacks with the theme feat and is always a different feat.
  if (progression.versatile_feat) {
    const v = progression.versatile_feat;
    parts.push(`\nVersatile feat (Human): ${v.feat_name}${v.selected_at_level ? ` (L${v.selected_at_level})` : ''}: ${v.effect || ''}`);
    if (v.choices_data) {
      parts.push(`  Choices: ${JSON.stringify(v.choices_data)}`);
    }
  }

  // Knight moral path (narrative-critical for Knight-themed characters)
  if (progression.knight_moral_path) {
    parts.push(`\nKNIGHT MORAL PATH: ${progression.knight_moral_path.current_path.toUpperCase()}`);
    const pathGuidance = {
      true: 'Character is currently walking the True Path — their oath is intact. Reinforce institutional trust and camaraderie with their order.',
      reformer: 'Character has seen their order falter and is trying to reform it from within. Surface moral tension between personal conviction and institutional authority. Some order members support them; others see them as a threat.',
      martyr: 'Character refused a corrupt order and paid a price. They are disowned but morally clear. Other knights may quietly admire or publicly denounce them.',
      complicit: 'Character obeyed an unjust order out of fear or duty. They carry the weight. Surface dreams, flinches, quiet hollowness — the dissonance between who they thought they were and what they did.',
      fallen: 'Character has broken their oath. Former order members treat them as a traitor. They have lost some abilities and may be hunted. Lean into shame, bravado, or denial as fits their current framing.',
      redemption: 'Character is actively atoning for past failures. Track their progress toward restoration — small acts of contrition matter. Former allies slowly warm; former enemies watch for backsliding.'
    };
    const guidance = pathGuidance[progression.knight_moral_path.current_path];
    if (guidance) parts.push(guidance);
  }

  // Subclass × Theme resonant synergy
  if (progression.subclass_theme_synergy) {
    parts.push(`\nRESONANT SUBCLASS×THEME SYNERGY: ${progression.subclass_theme_synergy.synergy_name}`);
    parts.push(progression.subclass_theme_synergy.description);
    if (progression.subclass_theme_synergy.mechanics) {
      parts.push(`Mechanics: ${progression.subclass_theme_synergy.mechanics}`);
    }
  }

  // Mythic × Theme amplification or dissonant arc
  if (progression.mythic_theme_amplification) {
    const m = progression.mythic_theme_amplification;
    parts.push(`\nMYTHIC ${m.is_dissonant ? 'DISSONANT ARC' : 'AMPLIFICATION'}: ${m.combo_name}`);
    if (m.shared_identity) parts.push(m.shared_identity);
    if (m.is_dissonant) {
      parts.push(`Arc: ${m.dissonant_arc_description || '(no description)'}`);
      if (m.required_threshold_acts) {
        parts.push(`Threshold acts required for resolution: ${m.required_threshold_acts}`);
      }
    } else {
      // Emit the tier bonuses the character currently qualifies for based on their level.
      // Mythic tiers: T1=L5, T2=L10, T3=L15, T4=L20 per CLAUDE.md
      const level = progression.character?.level || 1;
      const tiers = [
        { t: 1, min: 5, text: m.t1_bonus },
        { t: 2, min: 10, text: m.t2_bonus },
        { t: 3, min: 15, text: m.t3_bonus },
        { t: 4, min: 20, text: m.t4_bonus }
      ].filter(x => x.text);
      const qualified = tiers.filter(x => level >= x.min);
      if (qualified.length > 0) {
        parts.push('Active tier bonuses:');
        qualified.forEach(x => parts.push(`- T${x.t}: ${x.text}`));
      }
    }
  }

  // Narration hooks tied to the theme
  const hook = NARRATION_HOOKS_BY_THEME[progression.theme.theme_id];
  if (hook) {
    parts.push(`\nNARRATION HOOK: ${hook}`);
  }

  parts.push('\nIntegrate the progression layer naturally — let the character FEEL their theme through NPC responses, environmental description, and scene framing. Do NOT narrate the character using abilities they have not unlocked. Do NOT force theme references in every scene — weave them where they fit.');

  return parts.join('\n');
}

export function formatSubclassPromptSection(character, companions = []) {
  return buildSubclassPromptSection(character, companions);
}

function formatCampaignPlan(planSummary) {
  if (!planSummary) return '';

  const isImported = !!planSummary.campaign_metadata || !!planSummary.dm_directives;
  const hasDetailedNpcs = planSummary.detailed_npcs && planSummary.detailed_npcs.length > 0;
  let sections = [];

  // === PRIMACY: Campaign context and DM directives first ===

  // Campaign metadata (imported campaigns — year, season, status)
  if (planSummary.campaign_metadata) {
    const meta = planSummary.campaign_metadata;
    let metaLines = [];
    if (meta.year) metaLines.push(`Campaign Year: ${meta.year}`);
    if (meta.season) metaLines.push(`Season: ${meta.season}`);
    if (meta.setting) metaLines.push(`Setting: ${meta.setting}`);
    if (meta.tone) metaLines.push(`Tone: ${meta.tone}`);
    if (meta.status) metaLines.push(`Current Status: ${meta.status}`);
    if (meta.expedition_party) metaLines.push(`Active Party: ${Array.isArray(meta.expedition_party) ? meta.expedition_party.join(', ') : meta.expedition_party}`);
    // Pass through any other metadata fields
    const knownKeys = ['_schema_extension', 'campaign_name', 'system', 'year', 'season', 'setting', 'tone', 'status', 'expedition_party'];
    for (const [key, value] of Object.entries(meta)) {
      if (!knownKeys.includes(key) && value) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        metaLines.push(`${label}: ${typeof value === 'string' ? value : JSON.stringify(value)}`);
      }
    }
    if (metaLines.length > 0) {
      sections.push(`CAMPAIGN CONTEXT:\n${metaLines.join('\n')}`);
    }

    // Timeline enforcement from campaign metadata year
    if (meta.year) {
      const yearStr = String(meta.year);
      const yearMatch = yearStr.match(/(\d{3,4})/);
      if (yearMatch) {
        const campaignYear = parseInt(yearMatch[1]);
        sections.push(`=== TIMELINE ENFORCEMENT ===
The campaign year is ${campaignYear} DR. This is NOT negotiable.
FORBIDDEN: Events after ${campaignYear} DR, documents dated after ${campaignYear} DR, anachronistic references.
When inventing historical references, use dates 50-200 years BEFORE ${campaignYear} DR.
=== END TIMELINE ENFORCEMENT ===`);
      }
    }
  }

  // DM directives (imported campaigns — critical behavioral rules)
  if (planSummary.dm_directives) {
    const dir = planSummary.dm_directives;
    let dirLines = [];
    if (dir.never_reveal && dir.never_reveal.length > 0) {
      dirLines.push(`NEVER REVEAL TO THE PLAYER:\n${dir.never_reveal.map(r => `- ${r}`).join('\n')}`);
    }
    if (dir.always_follow && dir.always_follow.length > 0) {
      dirLines.push(`ALWAYS FOLLOW:\n${dir.always_follow.map(r => `- ${r}`).join('\n')}`);
    }
    if (dir.narrative_principles && dir.narrative_principles.length > 0) {
      dirLines.push(`NARRATIVE PRINCIPLES:\n${dir.narrative_principles.map(r => `- ${r}`).join('\n')}`);
    }
    // Pass through any other directive arrays
    const knownKeys = ['_schema_extension', 'never_reveal', 'always_follow', 'narrative_principles'];
    for (const [key, value] of Object.entries(dir)) {
      if (!knownKeys.includes(key) && Array.isArray(value) && value.length > 0) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        dirLines.push(`${label.toUpperCase()}:\n${value.map(r => `- ${r}`).join('\n')}`);
      }
    }
    if (dirLines.length > 0) {
      sections.push(`=== DM DIRECTIVES (FOLLOW STRICTLY) ===\n${dirLines.join('\n\n')}\n=== END DM DIRECTIVES ===`);
    }
  }

  // === CORE PLAN: Main quest, acts, world state ===

  if (planSummary.main_quest_title) {
    let questSection = `MAIN QUEST: ${planSummary.main_quest_title}\n${planSummary.main_quest_summary || ''}`;
    if (planSummary.main_quest_hook) {
      questSection += `\nHOW IT BEGINS: ${planSummary.main_quest_hook}`;
    }
    if (planSummary.main_quest_stakes) {
      questSection += `\nSTAKES: ${planSummary.main_quest_stakes}`;
    }
    sections.push(questSection);
  }

  if (planSummary.current_act) {
    const act = planSummary.current_act;
    // Phase 4 — the act number comes from the campaign's stored pointer
    // (`campaigns.current_act_index`), not from the act object, because plans
    // do not reliably carry `act_number` and the pointer is what actually
    // moved. `act.act_number` remains a fallback for imported plans that do
    // number their acts.
    const actNumber = planSummary.current_act_number || act.act_number || 1;
    const ofTotal = planSummary.total_acts > 1 ? ` of ${planSummary.total_acts}` : '';
    // The "start at the starting location" instruction belongs to act one
    // only. Carrying it into act three would pin an advanced campaign back to
    // the town it opened in.
    const openingConstraint =
      !isImported && actNumber === 1
        ? ' IMPORTANT: The opening scene must take place at the character\'s STARTING LOCATION (see WORLD SETTING above) — build toward this act\'s events from there, do not skip ahead.'
        : '';
    sections.push(`CURRENT ACT (Act ${actNumber}${ofTotal}): ${act.title || 'The Beginning'}
${act.summary || act.description || ''}
Use this act to guide the current story arc.${openingConstraint}`);
  }

  if (planSummary.world_state) {
    const ws = planSummary.world_state;
    sections.push(`WORLD STATE:
${ws.political_situation || ''}
Major Threats: ${(ws.major_threats || []).join(', ')}`);
  }

  // === NPCs: Use detailed NPCs with voice guides when available ===

  if (hasDetailedNpcs) {
    const backstoryNpcs = planSummary.detailed_npcs.filter(n => n.from_backstory);
    const otherNpcs = planSummary.detailed_npcs.filter(n => !n.from_backstory);

    if (backstoryNpcs.length > 0) {
      sections.push(`KEY NPCs FROM BACKSTORY (USE THESE - DO NOT INVENT REPLACEMENTS):
${backstoryNpcs.map(npc => formatNPCEntry(npc, true)).join('\n')}`);
    }
    if (otherNpcs.length > 0) {
      sections.push(`OTHER KEY NPCs IN THIS WORLD:
${otherNpcs.map(npc => formatNPCEntry(npc, true)).join('\n')}`);
    }
  } else {
    // Fallback to simple NPC lists (non-imported plans)
    if (planSummary.active_npcs && planSummary.active_npcs.length > 0) {
      sections.push(`KEY NPCs FROM BACKSTORY (USE THESE - DO NOT INVENT REPLACEMENTS):
${planSummary.active_npcs.map(npc => `- ${npc.name} (${npc.role}): ${npc.motivation} - typically found at ${npc.location || 'various locations'}`).join('\n')}`);
    }
    if (planSummary.all_npcs && planSummary.all_npcs.length > 0) {
      sections.push(`OTHER KEY NPCs IN THIS WORLD:
${planSummary.all_npcs.map(npc => `- ${npc.name} (${npc.role}) - ${npc.location || 'various locations'}`).join('\n')}`);
    }
  }

  // === NPC relationship system (imported campaigns) ===

  if (planSummary.npc_relationship_system) {
    const rs = planSummary.npc_relationship_system;
    let rsLines = [];
    // Render levels if defined
    if (rs.levels && Array.isArray(rs.levels)) {
      rsLines.push('RELATIONSHIP LEVELS:');
      for (const level of rs.levels) {
        rsLines.push(`- Level ${level.level || level.name}: ${level.label || ''} — ${level.description || ''}`);
      }
    }
    // Render any other string/array fields
    const knownKeys = ['_schema_extension', 'levels'];
    for (const [key, value] of Object.entries(rs)) {
      if (!knownKeys.includes(key)) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof value === 'string') {
          rsLines.push(`${label}: ${value}`);
        } else if (Array.isArray(value)) {
          rsLines.push(`${label}:\n${value.map(v => `- ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}`);
        }
      }
    }
    if (rsLines.length > 0) {
      sections.push(`NPC RELATIONSHIP SYSTEM:\n${rsLines.join('\n')}`);
    }
  }

  // === Standard sections ===

  if (planSummary.upcoming_events && planSummary.upcoming_events.length > 0) {
    sections.push(`UPCOMING WORLD EVENTS (these will happen regardless of player action):
${planSummary.upcoming_events.map(e => `- ${e.title} (${e.timing}) - ${e.visibility === 'secret' ? 'SECRET' : e.visibility === 'rumored' ? 'RUMORED' : 'PUBLIC KNOWLEDGE'}`).join('\n')}`);
  }

  if (planSummary.merchants && planSummary.merchants.length > 0) {
    sections.push(`MERCHANTS IN THIS WORLD (player can shop at these - use their EXACT names):
${planSummary.merchants.map(m => `- ${m.name} (${m.type}) at ${m.location}${m.personality ? ' - ' + m.personality : ''}`).join('\n')}`);
  }

  if (planSummary.side_quests && planSummary.side_quests.length > 0) {
    sections.push(`AVAILABLE SIDE QUESTS (introduce naturally when appropriate):
${planSummary.side_quests.map(q => `- ${q.title}: ${q.description}`).join('\n')}`);
  }

  if (planSummary.themes && planSummary.themes.length > 0) {
    sections.push(`CAMPAIGN THEMES TO EXPLORE: ${planSummary.themes.join(', ')}`);
  }

  if (planSummary.dm_notes?.tone) {
    sections.push(`TONE GUIDANCE: ${planSummary.dm_notes.tone}`);
  }

  if (planSummary.dm_notes?.twists && planSummary.dm_notes.twists.length > 0) {
    sections.push(`POTENTIAL TWISTS TO CONSIDER: ${planSummary.dm_notes.twists.join('; ')}`);
  }

  if (planSummary.dm_notes?.backup_hooks && planSummary.dm_notes.backup_hooks.length > 0) {
    sections.push(`BACKUP HOOKS (if player goes off-track): ${planSummary.dm_notes.backup_hooks.join('; ')}`);
  }

  // === RECENCY: Session continuity last (immediate context for the DM) ===

  if (planSummary.session_continuity) {
    const sc = planSummary.session_continuity;
    let scLines = [];
    // Render known fields
    if (sc.current_state) scLines.push(`Current State: ${typeof sc.current_state === 'string' ? sc.current_state : JSON.stringify(sc.current_state)}`);
    if (sc.recent_events && Array.isArray(sc.recent_events)) {
      scLines.push(`Recent Events:\n${sc.recent_events.map(e => `- ${typeof e === 'string' ? e : e.description || JSON.stringify(e)}`).join('\n')}`);
    }
    if (sc.immediate_context) scLines.push(`Immediate Context: ${typeof sc.immediate_context === 'string' ? sc.immediate_context : JSON.stringify(sc.immediate_context)}`);
    if (sc.unresolved_threads && Array.isArray(sc.unresolved_threads)) {
      scLines.push(`Unresolved Threads:\n${sc.unresolved_threads.map(t => `- ${typeof t === 'string' ? t : t.description || JSON.stringify(t)}`).join('\n')}`);
    }
    // Pass through any other fields
    const knownKeys = ['_schema_extension', 'current_state', 'recent_events', 'immediate_context', 'unresolved_threads'];
    for (const [key, value] of Object.entries(sc)) {
      if (!knownKeys.includes(key) && value) {
        const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        if (typeof value === 'string') {
          scLines.push(`${label}: ${value}`);
        } else if (Array.isArray(value)) {
          scLines.push(`${label}:\n${value.map(v => `- ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')}`);
        }
      }
    }
    if (scLines.length > 0) {
      sections.push(`CURRENT CAMPAIGN STATE (pick up from here):\n${scLines.join('\n')}`);
    }
  }

  if (sections.length === 0) return '';

  const header = isImported
    ? `=== IMPORTED CAMPAIGN PLAN ===
This campaign was imported with a detailed plan. You MUST use this as your guide for the story.
DO NOT invent your own BBEG, story arc, or quest - the plan below defines all of these.
Pay special attention to DM DIRECTIVES — they are binding rules for this campaign.`
    : `=== CAMPAIGN PLAN (Generated by Claude Opus) ===
This campaign has a pre-generated plan. You MUST use this as your guide for the story.
DO NOT invent your own BBEG, story arc, or quest - the plan below defines all of these.`;

  return `\n\n${header}

${sections.join('\n\n')}

CRITICAL RULES FOR USING THIS PLAN:
1. The MAIN QUEST above IS the campaign's story - do NOT create a different one
2. The NPCs listed above are established characters - USE THEM, do not invent generic replacements
3. The CURRENT ACT describes where the story is right now - ground your scenes in it
4. World events will unfold according to the timeline - the world is ALIVE
5. Weave the main quest naturally into the narrative - don't force it, but don't ignore it either
6. This plan is your guide, not a script - adapt to player choices while maintaining the plan's narrative${isImported ? '\n7. NPC voice guides define HOW each character speaks - use them for authentic dialogue\n8. DM-ONLY secrets must NEVER be revealed to the player unless they earn the knowledge through gameplay\n9. Respect the NPC relationship system - depth of information shared depends on relationship level' : ''}
=== END CAMPAIGN PLAN ===`;
}

/**
 * Map faction standing label to NPC behavior hint
 */
function getStandingBehavior(label) {
  const behaviors = {
    exalted: 'Go out of their way to help, offer resources freely',
    revered: 'Very helpful, share sensitive information',
    honored: 'Cooperative, willing to assist',
    friendly: 'Helpful but with limits',
    neutral: 'Indifferent',
    unfriendly: 'Wary, may overcharge or withhold info',
    hostile: 'Actively obstructive, may report you to leadership',
    hated: 'Will work against you, may set traps or ambushes',
    enemy: 'Hostile on sight, will attack or attempt capture'
  };
  return behaviors[label] || 'Indifferent';
}

/**
 * Map numeric trust level to readable label
 */
function getTrustLabel(trust) {
  if (trust >= 76) return 'Absolute';
  if (trust >= 51) return 'High';
  if (trust >= 26) return 'Moderate';
  if (trust >= 1) return 'Low';
  return 'None';
}

/**
 * Generate a 1-line RP voice hint for an NPC.
 * Enriched NPCs get personality-derived hints; others get occupation-based defaults.
 */
function generateNpcVoiceHint(r) {
  // Enriched NPCs — distill voice + personality into an actionable RP instruction
  if (r.npc_enrichment_level >= 1) {
    const parts = [];
    if (r.npc_voice) parts.push(r.npc_voice);
    if (r.npc_personality) parts.push(r.npc_personality);
    if (r.npc_mannerism) parts.push(r.npc_mannerism);
    if (parts.length > 0) {
      return `  -> RP: ${parts.join('; ').substring(0, 120)}`;
    }
  }

  // Non-enriched NPCs — derive from occupation
  const occupationVoiceMap = {
    merchant: 'transactional, names prices, values repeat customers',
    shopkeeper: 'transactional, names prices, values repeat customers',
    trader: 'transactional, names prices, values repeat customers',
    guard: 'clipped and authoritative, suspicious of strangers',
    soldier: 'clipped and authoritative, follows chain of command',
    noble: 'formal diction, expects deference, speaks in measured tones',
    innkeeper: 'warm and chatty, knows local gossip, hospitable',
    bartender: 'warm and chatty, knows local gossip, hospitable',
    priest: 'serene and measured, speaks in blessings, offers counsel',
    cleric: 'serene and measured, speaks in blessings, offers counsel',
    blacksmith: 'gruff, few words, respects action over talk',
    farmer: 'plain-spoken, weather-focused, community-minded',
    thief: 'evasive, speaks in implications, never commits to facts',
    rogue: 'evasive, speaks in implications, never commits to facts',
    scholar: 'precise vocabulary, corrects others, loves tangents',
    wizard: 'precise vocabulary, speaks cryptically, tests intelligence',
    sage: 'precise vocabulary, speaks cryptically, tests intelligence',
    beggar: 'desperate, obsequious, shrewd underneath',
    bard: 'theatrical, embellishes everything, quotes poems',
    ranger: 'terse, observant, speaks of nature and trails',
    hunter: 'terse, observant, speaks of nature and trails'
  };

  const occ = (r.npc_occupation || '').toLowerCase();
  for (const [key, hint] of Object.entries(occupationVoiceMap)) {
    if (occ.includes(key)) {
      return `  -> Voice hint: ${hint}`;
    }
  }

  // Final fallback — derive from disposition
  const dispLabel = (r.disposition_label || 'neutral').toLowerCase();
  const dispositionVoiceMap = {
    hostile: 'aggressive, may refuse to engage',
    unfriendly: 'curt, gives minimal answers',
    neutral: 'polite but reserved',
    friendly: 'open, willing to chat',
    allied: 'warm, volunteers information',
    devoted: 'eager to help, deeply loyal'
  };
  const dispHint = dispositionVoiceMap[dispLabel];
  if (dispHint) return `  -> Voice hint: ${dispHint}`;

  return '';
}

/**
 * Format compressed world state snapshot for DM context
 * Includes: faction standings, active world events, NPC relationships,
 * known faction goals, and discovered locations.
 */
function formatWorldStateSnapshot(worldState) {
  if (!worldState) return '';

  const sections = [];

  // 1. Faction Standings (skip neutrals unless member). Phase 3 SC-3:
  // the "LABEL (+N)" fragment now comes from FACTION_STANDING_CONFIG via
  // formatFactionStandingFragment — single source of truth for label
  // bands. Output is byte-identical to the legacy hand-rolled string;
  // tests/faction-standing-prompt-snapshot.test.js guards this.
  const meaningfulStandings = (worldState.factionStandings || [])
    .filter(s => s.standing !== 0 || s.is_member);
  if (meaningfulStandings.length > 0) {
    const lines = meaningfulStandings.slice(0, 6).map(s => {
      const fragment = formatFactionStandingFragment(s.standing);
      const memberNote = s.is_member ? ', Member' : '';
      const behavior = getStandingBehavior(s.standing_label || 'neutral');
      return `- ${s.faction_name}: ${fragment}${memberNote} - ${behavior}`;
    });
    sections.push('FACTION STANDINGS:\n' + lines.join('\n'));
  }

  // 2. Active World Events (with stage info)
  const events = worldState.visibleEvents || [];
  if (events.length > 0) {
    const lines = events.slice(0, 5).map(e => {
      const totalStages = e.stages?.length || 0;
      const stageNum = (e.current_stage || 0) + 1;
      const stageInfo = totalStages > 0 ? ` - Stage ${stageNum}/${totalStages}` : '';
      const stageDesc = e.stage_descriptions?.[e.current_stage];
      const descSuffix = stageDesc ? ': ' + stageDesc.substring(0, 80) : '';
      return `- "${e.title}" (${e.event_type}, ${e.scope})${stageInfo}${descSuffix}`;
    });
    sections.push('WORLD EVENTS IN PROGRESS:\n' + lines.join('\n'));
  }

  // 3. NPC Voicing Guide + Relationships
  sections.push(`NPC VOICING GUIDE:
When roleplaying NPCs, differentiate them through speech patterns:
- USE their RP/Voice hint to shape dialogue (accent, vocabulary, tempo)
- Disposition CHANGES how they interact: hostile NPCs withhold info, allied NPCs volunteer it
- Trust level determines what NPCs reveal: Low = surface conversation; High = secrets and favors
- Each NPC's occupation defines their expertise and what they talk about naturally
- NPCs with conversation history remember what was discussed — reference past topics`);

  const allNpcs = (worldState.npcRelationships || []).filter(r => {
    const hasPendingPromises = r.promises_made?.some(p => p.status === 'pending');
    const hasOutstandingDebts = r.debts_owed?.some(d => d.status === 'outstanding');
    const hasSecrets = r.discovered_secrets?.length > 0;
    const hasConversations = worldState.npcConversations?.[r.npc_id]?.length > 0;
    const hasInteracted = r.times_met > 0;
    return r.disposition !== 0 || hasPendingPromises || hasOutstandingDebts || hasSecrets || hasConversations || hasInteracted;
  });

  // Separate alive vs deceased NPCs
  const aliveNpcs = allNpcs.filter(r => (r.npc_lifecycle_status || 'alive') !== 'deceased');
  const deceasedNpcs = allNpcs.filter(r => r.npc_lifecycle_status === 'deceased');

  // Build NPC event effects lookup for inline annotations
  const npcEffectsMap = {};
  for (const effect of (worldState.npcEventEffects || [])) {
    if (!npcEffectsMap[effect.npc_id]) npcEffectsMap[effect.npc_id] = [];
    npcEffectsMap[effect.npc_id].push(effect);
  }

  if (aliveNpcs.length > 0) {
    const lines = aliveNpcs.slice(0, 25).map(r => {
      const occupation = r.npc_occupation ? ` (${r.npc_occupation})` : '';
      const location = r.npc_location ? ` at ${r.npc_location}` : '';
      const parts = [`- ${r.npc_name}${occupation}${location}: ${(r.disposition_label || 'neutral').toUpperCase()}, Trust: ${getTrustLabel(r.trust_level || 0)}`];

      // Voice/RP hint (enriched NPCs get personality-derived, others get occupation-based)
      const voiceHint = generateNpcVoiceHint(r);
      if (voiceHint) parts.push(voiceHint);

      // Motivation (kept separate — drives NPC goals, not voice)
      if (r.npc_enrichment_level >= 1 && r.npc_motivation) {
        parts.push(`  Motivation: ${r.npc_motivation}`);
      }

      // Pending promises with urgency annotations
      const pendingPromises = (r.promises_made || []).filter(p => p.status === 'pending');
      pendingPromises.slice(0, 5).forEach(p => {
        const text = typeof p === 'string' ? p : (p.promise || p.text || '');
        if (text) {
          let urgency = '';
          if (worldState.currentGameDay && p.game_day_made) {
            const daysSince = worldState.currentGameDay - p.game_day_made;
            if (p.deadline_game_day && worldState.currentGameDay > p.deadline_game_day) {
              urgency = ' [OVERDUE — DEADLINE PASSED]';
            } else if (p.deadline_game_day) {
              const daysLeft = p.deadline_game_day - worldState.currentGameDay;
              if (daysLeft <= 7) urgency = ` [URGENT — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left]`;
            } else if (daysSince >= 21) {
              urgency = ` [OVERDUE — ${daysSince} days]`;
            }
          }
          const weightLabel = p.weight ? ` [${p.weight.toUpperCase()}]` : '';
          parts.push(`  Promise${weightLabel}: ${text.substring(0, 100)}${urgency}`);
        }
      });

      // Outstanding debts only
      const outstandingDebts = (r.debts_owed || []).filter(d => d.status === 'outstanding');
      outstandingDebts.slice(0, 5).forEach(d => {
        const direction = d.direction === 'player_owes_npc' ? 'You owe them' : 'They owe you';
        const desc = typeof d === 'string' ? d : (d.description || d.type || '');
        if (desc) parts.push(`  Debt: ${direction} - ${desc.substring(0, 80)}`);
      });

      // Discovered secrets (max 1)
      (r.discovered_secrets || []).slice(0, 1).forEach(s => {
        const text = typeof s === 'string' ? s : (s.secret || s.text || '');
        if (text) parts.push(`  Secret known: ${text.substring(0, 100)}`);
      });

      // Conversation history (up to 4 conversations with this NPC)
      const npcConvs = worldState.npcConversations?.[r.npc_id];
      if (npcConvs && npcConvs.length > 0) {
        npcConvs.slice(0, 4).forEach((conv, i) => {
          const label = conv.session_number ? `Session ${conv.session_number}` : (i === 0 ? 'recent' : 'earlier');
          const toneNote = conv.tone ? ` Tone: ${conv.tone}.` : '';
          const topicsNote = conv.topics?.length > 0 ? ` Topics: ${conv.topics.join(', ')}.` : '';
          const maxLen = i === 0 ? 400 : 250;
          parts.push(`  Conversation (${label}): ${conv.summary.substring(0, maxLen)}${toneNote}${topicsNote}`);
        });
      }

      // Inline world event effect annotations
      const npcEffects = npcEffectsMap[r.npc_id];
      if (npcEffects && npcEffects.length > 0) {
        for (const eff of npcEffects.slice(0, 2)) {
          const params = typeof eff.parameters === 'string' ? JSON.parse(eff.parameters) : eff.parameters;
          const shortDesc = eff.effect_type === 'disposition_shift' ? `attitude shifted ${params.shift > 0 ? '+' : ''}${params.shift}`
            : eff.effect_type === 'location_change' ? `relocated to ${params.new_location}`
            : eff.effect_type === 'status_change' ? `now ${params.new_status}`
            : eff.effect_type === 'occupation_change' ? `now ${params.new_occupation}`
            : eff.description;
          parts.push(`  [EVENT: "${eff.event_title}" → ${shortDesc}]`);
        }
      }

      // Absence annotation — helps AI roleplay appropriate warmth/unfamiliarity.
      // P4-E: the "may have cooled" / "may not remember well" qualifiers imply
      // mechanical decay that only happens when NPC_AGING is on
      // (processAbsenceEffects). With the flag off, stored dispositions never
      // change, so those qualifiers would tell the AI things the DB
      // contradicts. Gate them; the neutral day-count and last-seen stay.
      if (worldState.currentGameDay && r.last_interaction_game_day) {
        const daysAbsent = worldState.currentGameDay - r.last_interaction_game_day;
        if (daysAbsent >= 7) {
          let note = `  [ABSENCE: ${daysAbsent} days]`;
          if (FEATURE_FLAGS.NPC_AGING) {
            if (daysAbsent >= 30) {
              note = `  [ABSENCE: ${daysAbsent} days — may not remember player well]`;
            } else if (daysAbsent >= 14) {
              note = `  [ABSENCE: ${daysAbsent} days — disposition may have cooled]`;
            }
          }
          parts.push(note);
        }
        parts.push(`  Last seen: Day ${r.last_interaction_game_day}`);
      } else if (!r.last_interaction_game_day && r.times_met > 0) {
        parts.push(`  [Last interaction day unknown]`);
      }

      return parts.join('\n');
    });
    sections.push('NPC RELATIONSHIPS:\n' + lines.join('\n'));
  }

  // Aggregate ALL promises and debts across ALL NPCs (standalone summary)
  const allPromises = [];
  const allDebts = [];
  for (const r of (worldState.npcRelationships || [])) {
    const pendingPromises = (r.promises_made || []).filter(p => p.status === 'pending');
    pendingPromises.forEach(p => {
      const text = typeof p === 'string' ? p : (p.promise || p.text || '');
      if (text) allPromises.push({ npc: r.npc_name, text, ...p });
    });
    const outstandingDebts = (r.debts_owed || []).filter(d => d.status === 'outstanding');
    outstandingDebts.forEach(d => {
      const desc = typeof d === 'string' ? d : (d.description || d.type || '');
      if (desc) allDebts.push({ npc: r.npc_name, direction: d.direction, text: desc });
    });
  }
  if (allPromises.length > 0 || allDebts.length > 0) {
    const promiseLines = [];
    if (allPromises.length > 0) {
      promiseLines.push('PROMISES MADE (the player committed to these — NPCs WILL ask about them):');
      allPromises.forEach(p => {
        let urgency = '';
        if (worldState.currentGameDay && p.game_day_made) {
          const daysSince = worldState.currentGameDay - p.game_day_made;
          if (p.deadline_game_day && worldState.currentGameDay > p.deadline_game_day) {
            urgency = ' [OVERDUE — DEADLINE PASSED]';
          } else if (p.deadline_game_day) {
            const daysLeft = p.deadline_game_day - worldState.currentGameDay;
            if (daysLeft <= 7) urgency = ` [URGENT — ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left]`;
          } else if (daysSince >= 21) {
            urgency = ` [OVERDUE — ${daysSince} days]`;
          }
        }
        promiseLines.push(`- To ${p.npc}: ${p.text}${urgency}`);
      });
    }
    if (allDebts.length > 0) {
      promiseLines.push('OUTSTANDING DEBTS:');
      allDebts.forEach(d => {
        const dir = d.direction === 'player_owes_npc' ? `You owe ${d.npc}` : `${d.npc} owes you`;
        promiseLines.push(`- ${dir}: ${d.text}`);
      });
    }
    sections.push(promiseLines.join('\n'));
  }

  // Deceased NPCs section — prevent the DM from resurrecting dead NPCs
  if (deceasedNpcs.length > 0) {
    const lines = deceasedNpcs.slice(0, 5).map(r => {
      return `- ${r.npc_name}${r.npc_occupation ? ` (${r.npc_occupation})` : ''} — DECEASED`;
    });
    sections.push('DECEASED NPCs (do NOT have them appear alive):\n' + lines.join('\n'));
  }

  // 3.5. World Event Effects on NPCs (summary section)
  const npcEventEffects = worldState.npcEventEffects || [];
  if (npcEventEffects.length > 0) {
    const lines = npcEventEffects.slice(0, 6).map(eff => {
      return `- ${eff.npc_name}${eff.npc_occupation ? ` (${eff.npc_occupation})` : ''} — affected by "${eff.event_title}": ${eff.description}`;
    });
    sections.push('WORLD EVENT EFFECTS ON NPCs:\nThese NPCs have been affected by ongoing events. Reflect these changes in roleplay.\n' + lines.join('\n'));
  }

  // 4. Known Faction Goals
  const goals = worldState.knownFactionGoals || [];
  if (goals.length > 0) {
    const lines = goals.slice(0, 4).map(g => {
      const urgency = g.urgency && g.urgency !== 'normal' ? `, ${g.urgency}` : '';
      return `- ${g.faction_name}: "${g.title}" (${g.progress_percent}% complete${urgency})`;
    });
    sections.push('KNOWN FACTION ACTIVITIES:\n' + lines.join('\n'));
  }

  // 4.5. Active Quests
  const activeQuests = worldState.activeQuests || [];
  if (activeQuests.length > 0) {
    const lines = activeQuests.slice(0, 6).map(q => {
      const stages = q.stages || [];
      const currentStage = stages[q.current_stage];
      const stageInfo = stages.length > 0 ? ` (Stage ${q.current_stage + 1}/${stages.length}: ${currentStage?.name || 'Unknown'})` : '';
      const objectives = currentStage?.objectives?.map(o => `    - ${o}`).join('\n') || '';
      const typeLabel = q.quest_type === 'main' ? '[MAIN]' :
                        q.quest_type === 'faction' ? `[FACTION: ${q.faction_name || 'Unknown'}]` :
                        q.quest_type === 'faction_conflict' ? `[CONFLICT: ${q.faction_name || 'Unknown'}]` :
                        q.quest_type === 'companion' ? '[COMPANION]' :
                        q.quest_type === 'side' ? '[SIDE]' : '';
      const priority = q.priority === 'high' ? ' {HIGH PRIORITY}' : '';
      const parts = [`- ${typeLabel} "${q.title}"${stageInfo}${priority}`];
      if (q.premise) parts.push(`  Hook: ${q.premise}`);
      if (currentStage?.description) parts.push(`  Current: ${currentStage.description.substring(0, 150)}`);
      if (objectives) parts.push(`  Objectives:\n${objectives}`);
      if (q.quest_type === 'faction_conflict') {
        const rewards = q.rewards || {};
        if (rewards.aggressor_faction_name && rewards.defender_faction_name) {
          parts.push(`  Factions at odds: ${rewards.aggressor_faction_name || 'Unknown'} vs ${rewards.defender_faction_name || 'Unknown'}`);
        }
      }
      return parts.join('\n');
    });
    sections.push(`ACTIVE QUESTS:
Reference these quests naturally in the narrative. Do NOT info-dump quest objectives — weave them into NPC dialogue, discovered clues, and environmental storytelling. When the player's actions align with quest objectives, acknowledge progress narratively.
${lines.join('\n')}`);
  }

  // 5. Discovered Locations
  const locations = worldState.discoveredLocations || [];
  if (locations.length > 0) {
    const lines = locations.slice(0, 8).map(l => {
      const homeBase = l.discovery_status === 'home_base' ? ' [HOME BASE]' : '';
      const state = l.current_state ? `: ${l.current_state}` : '';
      return `- ${l.name} (${l.location_type})${state}${homeBase}`;
    });
    sections.push('KNOWN LOCATIONS:\n' + lines.join('\n'));
  }

  if (sections.length === 0) return '';

  return `\n\n=== CURRENT WORLD STATE ===
Use this to inform NPC behavior and reference ongoing events naturally.
Do NOT info-dump this to the player. Weave it organically into narrative and dialogue.

${sections.join('\n\n')}

=== END WORLD STATE ===`;
}

// ---------------------------------------------------------------------------
// MEMORY HIERARCHY — explicit precedence when memory sources disagree
// ---------------------------------------------------------------------------

function formatMemoryHierarchy() {
  return `═══════════════════════════════════════════════════════════════
MEMORY HIERARCHY
═══════════════════════════════════════════════════════════════
Multiple memory sources below may describe the same NPC, place, or event. When they disagree, the higher tier wins:

1. CANON FACTS / STORY CHRONICLE — ground truth. Deaths, items gained/lost, promises made/kept, and decisions recorded here are final. Never contradict.
2. NPC CONVERSATIONS — per-NPC dialogue memory. What was said and agreed stays said and agreed.
3. PROMISES & CONSEQUENCES — open obligations. NPCs remember and bring them up.
4. ROLLING SUMMARY (recent tail) — overrides older summaries but never chronicle.
5. CAMPAIGN PLAN / CAMPAIGN NOTES — scaffolding. Player choices already in chronicle override plan.
6. WORLD STATE — background conditions (weather, factions, world events). Applied unless chronicle contradicts.

When the player's action would violate a higher tier (e.g. player greets an NPC marked dead in chronicle), treat the higher tier as reality and redirect narratively.

`;
}

// ---------------------------------------------------------------------------
// MECHANICAL MARKERS — conditional; only include sections for active systems
// ---------------------------------------------------------------------------

/**
 * Build the MECHANICAL MARKERS section. Marker specs are conditional on
 * whether the relevant subsystem is active for this session — survival
 * markers only appear when survivalContext is present, etc. This keeps
 * the always-on markers front-and-center and stops Sonnet from carrying
 * specs for features that won't fire.
 */
/**
 * HP rules — ALWAYS ON, deliberately outside formatMechanicalMarkers.
 *
 * applyLeanTransforms strips the entire MECHANICAL MARKERS section. If the
 * HP_CHANGE instruction lived there, every lean-prompt turn would silently
 * stop applying damage with no error anywhere — the character would simply
 * become invulnerable. HP is the one marker that must survive lean mode, so it
 * is emitted here, ahead of that section, where the strip regex cannot reach.
 *
 * Phase 3.1 — HP is authoritative in the database now, not in narration.
 */
function formatPlayerHpRules() {
  return `
═══════════════════════════════════════════════════════════════
HIT POINTS — REAL AND TRACKED
═══════════════════════════════════════════════════════════════
The player's HP is stored in the database and shown on their character sheet.
It only changes when you say so, using this marker:

[HP_CHANGE: delta=-7 reason="ogre's club"] — INLINE, immediately after the blow lands.

• delta is REQUIRED and is a whole number. Negative for damage, positive for healing.
• Emit one on EVERY hit the player takes, every trap, every failed save with
  damage, every potion drunk, every spell of healing received.
• Do NOT emit it for damage the player deals to enemies — only for changes to
  the PLAYER's own hit points.
• Never state the player's exact remaining HP in prose. Narrate the blow; the
  sheet carries the number. "Bloodied" (about half) and "barely standing"
  (near death) remain the right register.

AT 0 HIT POINTS: the player falls unconscious and begins making death saving
throws. The system rolls these — narrate the fall and the tension, then STOP.
Do not roll, do not announce the result, and do not decide whether they live.
`;
}

function formatMechanicalMarkers(sessionContext, character) {
  const blocks = [];

  // --- Always-on markers (merchant, combat, loot, conditions, promises,
  //     companion recruitment, observation-as-check, scene integrity) ---
  blocks.push(`──────────── MERCHANT SHOPPING ────────────
When the player asks to BUY, SELL, BROWSE, TRADE, or see what a merchant HAS — emit FIRST:
[MERCHANT_SHOP: Merchant="Exact Name" Type="general|blacksmith|alchemist|magic|jeweler|tanner|tailor" Location="shop description"]

Without this marker, the shop UI cannot open.

After emit, the system injects the merchant's actual inventory as a [SYSTEM] message. Reference only items from that injected list — never invent.

If the player wants something not on the shelf, pick one:
• Suggest a similar item from current inventory (in-character)
• [MERCHANT_REFER: From="Current" To="Other Merchant" Item="what they want"] — system guarantees the item exists at the referred shop
• [ADD_ITEM: Name="x" Price_GP=N Quality="standard|fine|superior|masterwork" Category="cat"] — adds custom item to this merchant (must fit their specialty; never magic items at non-magic merchants)
  Quality multipliers: standard 1×, fine 1.5×, superior 2×, masterwork 3×.

Custom commissions (crafted to order):
[MERCHANT_COMMISSION: Merchant="Name" Item="desc" Price_GP=N Deposit_GP=M Lead_Time_Days=D Quality="q" Hook="detail"]
Deposit 30-50% of total. Lead 3d (fine leather) / 7d (masterwork weapon) / 14d+ (plate or enchanted).`);

  blocks.push(`──────────── COMBAT ────────────
Combat starts: [COMBAT_START: Enemies="Goblin (HP 7, AC 15, ATK +4, DMG 1d6+2), Orc (HP 15, AC 13, ATK +5, DMG 1d12+3)"] — LAST sentence. System rolls initiative and tracks enemy HP.
Combat ends: [COMBAT_END] — LAST sentence.

Per-turn flow:
• Player's turn → describe battlefield, ask "What do you do?" → STOP.
• ANY party attack → emit [ATTACK: Attacker="Player" Target="Goblin"] INLINE — Attacker= a companion's name for their attacks; add Spell="Fire Bolt" for a spell attack (the system knows the spell's damage dice; add Damage= only for a homebrew spell it doesn't know). The engine judges the swing: for the PLAYER it waits for their real dice (ask for the attack roll, then STOP — the judged outcome returns as an ATTACK RESULT fact at the start of your next turn; narrate exactly that). Companion attacks resolve immediately and likewise return as facts. NEVER decide whether an attack hits, never invent its damage, and never use ENEMY_DAMAGE for an attack roll. One ATTACK marker per swing.
• Weapon rules the engine enforces (combat item 1): a weapon's mastery property works ONLY if that weapon is on the attacker's mastered list — set it with [MASTERY_SET: Target="Lyra" Weapons="Longsword, Warhammer"] (the list changes on a long rest, by the book). Ammunition is spent from inventory and an attack at zero ammo is REFUSED — narrate the refusal, never pretend it fired; spent ammo is recovered by scavenging in the looting scene, never automatically. Thrown attacks: add Thrown="true" (the weapon must have the thrown property; distance is checked against its range — beyond short range is disadvantaged, beyond long range is refused). Off-hand attacks: add Hand="off" (Light weapons in both hands, no ability modifier to that damage, once per turn). After a Cleave hit, the follow-up is [ATTACK: Attacker="Name" Target="Second Goblin" Cleave="true"] — it must target a second creature within 5 feet of the first and within reach — the engine checks both distances and refuses a follow-up that fails either; it is not a free pick.
• Class features the engine enforces (combat item 2): Sneak Attack (rogue, finesse or ranged weapon, advantage or an ally within 5 ft of the target, once per turn — add Ally="true" when an ally is within 5 ft; the engine adds the dice for companions and tells the player what to roll for the PC). Rage (barbarian — enter with [RAGE: Target="Name"], end with [RAGE: Target="Name" End="true"]; uses are tracked, damage bonus applies while raging (damage resistance is not wired yet)). Divine Smite (paladin — add Smite="2" for the slot level to a melee ATTACK, plus SmiteFiend="true" vs fiends and undead; the slot is spent only on a hit; at L11 Improved Divine Smite adds 1d8 radiant automatically). Fighting styles from the feat list apply automatically (Archery +2 ranged, Defense +1 AC in armor, Dueling +2 one-handed, Thrown +2, Two-Weapon Fighting restores the off-hand modifier, Great Weapon Fighting floors damage dice at 3). Bardic Inspiration: grant with [INSPIRATION: Target="Name" Bard="Name"] (uses tracked, die by bard level); the holder spends it with [INSPIRATION: Target="Name" Spend="true"]. Second Wind (fighter): [SECOND_WIND: Target="Name"] heals 1d10 + fighter level (2 uses, +1 on a short rest). Action Surge (fighter, combat item 3): [ACTION_SURGE: Target="Name"] spends one use and grants one more action this turn (1 use, 2 at L17, restored on a short rest). Bonus action (combat item 3, Tier 2): one per turn — an off-hand attack, Rage entry, a Bardic Inspiration grant, Second Wind, a Divine Smite cast, and a Bonus="true" attack (GWM crit/kill, Polearm Master) each spend it; a second bonus spend in the same turn is refused. A mastered Nick off-hand weapon makes the off-hand attack part of the Attack action instead, spending no bonus action. Combat actions (combat item 3, Tier 3): [DODGE: Target="Name"] makes attacks against the dodger roll at disadvantage until their next turn (dodging creatures roll Dexterity saves with advantage — the engine adds it to save requests); [DISENGAGE: Target="Name"] means opportunity attacks against them are refused until their next turn; [HELP: Helper="Name" Target="Goblin" Ally="Name"] gives the named ally advantage on their next attack against that target (the helper must be within 5 ft of the target — farther Help is refused); [HIDE: Target="Name"] hides them — a DC 15 Stealth check (pass the player's rolled total as Stealth="17", plus StealthDie="1" or "20" when the die was a natural 1 or 20; otherwise the system rolls); the total is the DC to find them, and an enemy whose passive Perception meets it spots them at once. A hidden creature's next attack is advantaged, attacks against them are disadvantaged, and hidden ends when they attack, cast a verbal spell, are found, or you clear it with [HIDE: Target="Name" End="true"]. Find a hidden creature with [SEARCH: Searcher="Name" Target="Goblin"] — a Perception check against their Stealth total (Perception="19" for a player-rolled total); success finds them; [READY: Target="Name" Action="shoot the goblin" Trigger="when it comes through the door"] stores the action, and it fires when you emit the attack with Ready="true" (spending their reaction, even off-turn). Enemies use the same moves: an enemy's readied attack fires with [ENEMY_ATTACK: Enemy="Goblin" Target="Player" Ready="true"], and a hidden enemy's next attack is advantaged, and monsters can help each other the same way ([HELP: Helper="Goblin" Target="Player" Ally="Orc"] — helper and ally must be on the same side, target on the opposite side). Readied spells: [READY: Target="Lyra" Action="Cast Fireball" Spell="Fireball" Level=3 Trigger="goblins bunch up"] spends the slot now and holds the spell with concentration (ending any concentration already held); release with [SPELL_CAST: Spell="Fireball" Target="Goblins" Ready="true"] on a reaction — the release must name the held spell at its held level, and a broken concentration fizzles it. Readied Dodge, Disengage, Help, and Hide fire the same way, with Ready="true" on their marker and no extra cost. Party members can take Dodge, Disengage, and Hide as a bonus action with Bonus="true" instead (Cunning Action, Patient Defense); enemies charge their bonus action the same way on attacks and Dashes (Bonus="true"), and a second bonus spend in the same turn is refused. Enemy Dodge, Disengage, Hide, Help, and Ready stay free in v1 (no bonus charge). Movement (combat item 4): the fight is areas, not squares — declare them at fight start with [ZONES: Zones="bridge,treeline" Edges="bridge-treeline:30" Places="Tester:bridge,Goblin:treeline"] (edges are foot distances; add :difficult for difficult terrain, which costs double to walk; zone names cannot contain ',', ':' or '-'). Move with [MOVE: Target="Name" To="treeline"] — the cost comes off that turn's movement budget (speed, doubled by Dash), and moving farther than the budget allows is refused; moving to an undeclared area creates it when you add Distance="40". Dash with [DASH: Target="Name"] (Bonus="true" spends the bonus action, the Cunning Action bridge). Melee attacks are refused beyond reach (reach weapons reach 10 ft); ranged and thrown attacks are disadvantaged beyond short range and refused beyond long range; a ranged attack with a hostile creature in your area is disadvantaged. When a move leaves an enemy's reach, the MOVE result names who is provoked — resolve each with [OPPORTUNITY_ATTACK: Attacker="Name" Target="Name"] (Disengage avoids all of them). Enemy action economy (combat item 5): enemies get one action, one bonus action, and one reaction per turn, like the party. A second attack on the same turn is refused unless it is part of a declared multiattack: declare the pattern at the start of the enemy's turn with [MULTIATTACK: Enemy="Ogre" Attacks="Slam,Slam"] and fire each swing with [ENEMY_ATTACK: Enemy="Ogre" Target="Player" Multiattack="true"] (each swing resolves with that action's own stats when the creature is in the bestiary, otherwise its listed attack). Legendary creatures get 3 legendary actions per round (or the total you set with LegendaryTotal="4"), spent at the end of another creature's turn: [ENEMY_ATTACK: Enemy="Dragon" Target="Player" Legendary="true" Cost="2"] or [LEGENDARY_SPEND: Enemy="Dragon" Cost="1" Effect="wing buffet"] for non-attacks; the budget refreshes at the start of the dragon's own turn, and legendary actions are refused on its own turn and while incapacitated. A lair acts once per round, never the same effect twice in a row: [LAIR_ACTION: Lair="Dragon's Lair" Effect="stalactites fall"]. Spellcasting (combat item 6): enemy casts resolve — name the targets with [ENEMY_CAST: Enemy="Archmage" Spell="Fireball" Level=3 Targets="Lyra,Goblin"] (one name per target; repeat a name for extra Magic Missile darts), and the engine rolls saves and damage from the spell catalog (companions and enemies roll here; the player rolls their save when asked and the damage follows). A save spell needs a DC: bestiary casters use their statblock DC, otherwise add Dc="17" — without one the cast is refused, never invented. Attack-roll spells use the bestiary attack bonus or AtkBonus="9"; cantrips scale by the creature's CR unless you add CasterLevel="11". Spells outside the catalog stay tracked-only (slot spent, effect yours to narrate). Set slots with [ENEMY_SLOTS: Enemy="Archmage" Slots="1:4,2:3"] (bestiary casters seed from their statblock on first cast). Party casts charge the turn's budgets: a bonus-action spell spends the bonus action, an action spell spends the action, and a bonus-action spell and a leveled action spell never share a turn (Action Surge is the only way to cast two leveled action spells); name extra targets with Targets="GobA,GobB" (Hold Person gains one target per slot above 2nd). Reaction spells declare with Reaction="true": Counterspell goes in the SAME message as the enemy cast it answers (it resolves first; the countered caster saves Constitution against your DC or the cast fizzles with its slot spent), Shield adds +5 AC until the start of your next turn, and Absorb Elements, Hellish Rebuke, and Backlash answer the latest hit in the NEXT message after the damage (only the latest hit can be answered). One pending player save at a time — resolve it before casting another save spell at the player. When a repeat-save notice arrives, ask for the roll with a save request at the end of that creature's turn. A cast spends the enemy's action (or its bonus with Bonus="true", or legendary with Legendary="true"); an attack uses at most one of Multiattack, Legendary, or Bonus. Only the current combatant acts on their turn; emit [TURN_ADVANCE] when their turn ends. Lay on Hands (paladin): [LAY_ON_HANDS: Target="Name" Amount="5"] from a pool of paladin level × 5, replenished on a long rest. Conditions (combat item 8): Incapacitated means no actions or reactions — attacks, spells, bonus actions, Dodge, Disengage, Help, Hide, Ready, opportunity attacks, and readied firing are all refused, and concentration breaks the moment it lands; movement is still allowed. Grappled sets speed to 0 and is escaped with [ESCAPE: Target="Name" Skill="Athletics"] (or Acrobatics; the escapee chooses) against 8 + the grappler's Strength modifier + proficiency bonus, or a Dc="14" you declare when the grappler is not on record; one escape attempt per turn. Apply grappled with [CONDITION_ADD: Target="Name" Condition="grappled" Grappler="Ogre"], and charmed with Charmer="Name" — without the source the marker is refused, because the engine cannot enforce "cannot attack the charmer" or compute an escape DC without it. A charmed creature cannot attack the charmer or target them with harmful spells (healing and buffs are fine). Deafened creatures automatically fail hearing checks — tag the request [ROLL_REQUEST: Skill="Perception" DC=15 Looks="listening for the patrol" Hearing="true"]. Display casting: aim a spell at a spot instead of a creature to deliberately miss as a show of power — [DISPLAY: Spell="Fireball" Target="floor beside GobA" Beside="GobA"] costs the slot and the action like a real cast and can be counterspelled. Beside= names the creature the spot sits beside (the mishap splash target; without it there is no splash). The player rolls placement: a bare d20 for a plain display, or with Intimidate="true" and Dc="14" the roll IS the Intimidation check (one roll, not two). A natural 1 mishandles behind the scenes and a natural 20 surges the same way — the engine rolls among what the room actually holds (a splash onto the Beside creature, a strike on a room feature with an effect following the spell type, or a harmless fizzle; a surge may click open a secret the room actually holds), never a fixed result and never anything the room does not hold. Where no room is linked to the fight, declare the candidates with Features="haybale:flammable, trough:water". Artificer (base class): prepared Int casting with tools as focus; plans known and created items come from the Artificer section in the character block. At a Long Rest, learn plans with [ARTIFICER_LEARN_PLAN: Plan="Bag of Holding"] (generic plans need Detail="item name"), then create with [ARTIFICER_CREATE: Plans="Bag of Holding, Weapon, +1" Tools="true"] — Tools="true" means Tinker's Tools in hand; add Attune="true" to attune instantly to created items. Attunement is a hard cap (3, then 4 at 10, 5 at 14, 6 at 18) counting created and other items together; an attunement at cap is refused, never silently dropped — unattune first with [ARTIFICER_UNATTUNE: Item="name"]. Tinker's Magic creates a mundane item from the printed list with [ARTIFICER_TINKER: Item="Rope" Tools="true"]. Flash of Genius is a Reaction AFTER a failure is known: [ARTIFICER_FLASH: Target="Name" Total="13" DC="15"] spends a use only when the Int bonus flips the failure. Tool Expertise (level 6+) doubles the proficiency bonus on tool checks — apply it to the reported total, never silently. Magic Item Tinker (level 6+): [ARTIFICER_CHARGE: Item="name" Slot="2"] restores charges, [ARTIFICER_DRAIN: Item="name"] once per Long Rest trades a created item for a slot (Common 1, Uncommon/Rare 2; unattested rarity is refused), [ARTIFICER_TRANSMUTE: Item="name" Plan="Wand of Web"] once per Long Rest. Spell-Storing Item (level 11+): [ARTIFICER_STORE: Spell="Cure Wounds" Level="1" CastTime="1 action" MaterialConsumed="false"] — the material question must be answered explicitly, never guessed. Homunculus Servant obeys with NO action required and acts right after you; summon with [ARTIFICER_HOMUNCULUS: Slot="2" AttackBonus="5"]. Soul of Artifice (level 20): when an artificer would drop to 0 HP but was not killed outright, [ARTIFICER_CHEAT_DEATH] sacrifices Uncommon/Rare created items for 20 HP each. Every artificer comes from Eberron (Khorvaire) and needs an explanation for how they reached the Forgotten Realms — if the character block says the explanation is not yet recorded, ask for it in play and record it with [ARTIFICER_ORIGIN: Explanation="..."]
• Spells with saves → emit [SPELL_CAST: Spell="Fireball" Level=3 Target="Goblin"] INLINE — one marker per target. The SYSTEM rolls the target's save against the caster's real DC. Never roll a save yourself, and never declare the spell's damage with ENEMY_DAMAGE — damage is handled under the next bullet.
• Anyone casts a spell → emit [SPELL_CAST: Spell="Exact Name" Level=N] INLINE, where N is the slot level used (0 for cantrips). Add Caster="Lyra" when a companion casts — her slots and concentration are tracked exactly like the player's. The system validates and decrements the slot, and starts concentration when the spell requires it. If the system reports no slots available, the spell fizzles — narrate that; never pretend it worked.
• Spell DAMAGE and HEALING belong to the system — it knows every spell's true dice. When the PLAYER casts a damage or healing spell, the cast leaves a pending total: end your turn by telling the player exactly what to roll (e.g. "Roll 8d6 for the Fireball", "Roll 2d8+3 for Cure Wounds") and STOP. They report one number; the system applies it — full on a failed save, half (or none, per the spell) on a made one — and the outcome returns as a SPELL EFFECT fact. Companions' spell damage and healing resolve on their own and also return as facts. NEVER invent a damage or healing number, and never apply a spell's damage with ENEMY_DAMAGE or its healing with HP_CHANGE — those markers are for non-spell effects now (traps, falls, potions).
• Damage tables (combat item 7): falls, traps, and hazards roll in the engine, never declared amounts. A fall: [ENEMY_DAMAGE: Enemy="Goblin" Fall=30] or [HP_CHANGE: Fall=30] for the player (feet fallen; the engine rolls 1d6 per 10 feet, max 20d6, bludgeoning, no save). A sprung trap: [ENEMY_DAMAGE: Enemy="Goblin" Trap="dangerous"] or [HP_CHANGE: Trap="dangerous"] (tiers setback 1d10, dangerous 3d10, deadly 6d10, save DCs 11/13/16; the engine rolls a Dexterity save, fail takes full, success takes half; add Save="avoid" for success takes none, Save="none" for no save; add Type="fire" when the trap damage is not bludgeoning). A hazard: [ENEMY_DAMAGE: Enemy="Goblin" Hazard="fire" Severity="moderate"] (severities minor 1d6, moderate 3d6, major 6d6; fire, acid, poison, lightning). A trap with no tier, or a fall with no distance, is refused, never invented. A hazard with no table entry keeps a declared Amount= but the result is flagged as declared, never silent. Cold damage uses the cold system, not these tables. For a companion, add Target="Lyra" to HP_CHANGE. When a trap asks the player for a Dexterity save, ask for the roll and STOP — the damage follows the reported save.
• Enemy turns: emit [ENEMY_ATTACK: Enemy="Name" Target="Player"] INLINE. The SYSTEM rolls the attack and damage — you narrate the result it returns. Never roll for enemies yourself.
• A combatant leaves another's reach → emit [OPPORTUNITY_ATTACK: Attacker="Name" Target="Name"] INLINE. It consumes the attacker's reaction (one per round); the system tracks this, rejects a second one, and resolves the attack for real — narrate the outcome it returns.
• Any combatant takes cover → emit [SET_COVER: Target="Name" Cover="half"] INLINE — enemies AND party members alike. Cover values: half (+2 AC), three-quarters (+5 AC), full (cannot be targeted directly). Emit Cover="none" when they leave cover. The system applies the bonus to real attack rolls — factor it into your narration of near-misses. In a scene room (a dungeon room with a stored feature list), cover MUST come from a feature actually in that room: add Feature="<exact feature name>" with the tier that feature gives, e.g. [SET_COVER: Target="Goblin" Cover="half" Feature="Toppled pillar"]. If no feature in the room gives cover, do NOT invent one — say so plainly, so the player knows to move. A named feature that is not in the room, or a tier the feature does not give, is NOT granted, and the system will tell you so next turn.
• Conditions work on enemies too: [CONDITION_ADD: Target="Goblin" Condition="Blinded"] — a blinded enemy really swings at disadvantage; a prone one really is easier to hit. The engine applies it; never apply it twice in narration.
• HP milestones: "bloodied" (half), "barely standing" (near death).
• Player at 0 HP → "You fall unconscious. At the start of your turn, make a death saving throw."

Never roll for the player. Never roll for enemies — use [ENEMY_ATTACK]. Never judge a party attack — use [ATTACK].`);

  blocks.push(`──────────── CHECKS & SAVES (ROLL_REQUEST) ────────────
Outside combat, when an action's outcome is genuinely uncertain AND the stakes matter, do not decide the result — request a roll:
[ROLL_REQUEST: Skill="Sleight of Hand" DC=15 Looks="a masterfully crafted lock, its pins gleaming with oil"] — INLINE, then STOP. End your turn there.

• Exactly one of Skill= / Ability= / Save=. The DC is a hidden number: NEVER state it, hint at it numerically, or confirm it afterward.
• Looks= is REQUIRED — a short descriptive gauge of the difficulty woven into your narration, so the character's intuition can read the challenge. The bands below are a CALIBRATION GUIDE, not a script: vary the phrasing, flavor it to the obstacle in front of you, never repeat the same description twice.
  DC 5 — barely an obstacle ("a latch a child could lift", "a slope more muddy than steep")
  DC 10 — straightforward ("a plain iron lock, honestly made", "a calm, readable face")
  DC 15 — difficult ("a well-made lock, tight and oiled", "a guarded expression, practiced")
  DC 20 — very difficult ("a masterfully crafted lock, pins like needlework", "a cliff of wet, sheer stone")
  DC 25 — nearly impossible ("a lock that belongs in a vault in Waterdeep", "a lie told to a god")
  DC 30 — beyond mortal craft. Reserve for the legendary.
• The PLAYER rolls real dice and reports the number; the system applies their true modifier and returns the outcome as a system note at the start of the next turn. Narrate ONLY what that note says happened. Never invent a result while a roll is pending.
• Actor="Lyra" — or any companion, NPC, or enemy name — the system rolls for them immediately. Describe the attempt, emit the marker, and do NOT narrate whether it worked: the outcome returns as a system note at the start of your next turn, and you narrate it then. Enemies attempting skills (disarming a trap, sneaking past a sleeper) roll like anyone else and CAN fail.
• Advantage="reason" / Disadvantage="reason" when circumstances clearly help or hinder (a companion's steadying hand, rain-slick stone). The player reports both dice; the system takes the right one.
• Helping with a check: [HELP_CHECK: Helper="Lyra" Ally="Player" Skill="Perception"] — the ally gets advantage on their next matching ability check, and the system spends it. Leave the skill off for the next check of any kind. Use this instead of Advantage="..." for help, so it is tracked and spent rather than narrated; never grant help twice. HELP_CHECK never applies to saving throws.
• Natural 1 ALWAYS fails — completely, often comically, usually with a consequence you must attach. Natural 20 ALWAYS succeeds — often miraculously, with something beyond the ask going right. The system note tells you when a critical happened; honor it fully — never soften a critical failure or inflate an ordinary success into one.
• Do NOT request a roll for what a character would simply know or trivially do (earned knowledge is passive), nor for the truly impossible — refuse in fiction instead. One request at a time: ask, stop, wait.`);

  blocks.push(`──────────── PERCEPTION PRE-ROLL (BANKED) ────────────
When the party ENTERS a dungeon, bank one Perception roll per character FIRST — before anything hidden happens:
[PERCEPTION_PREROLL: Dungeon="Sunless Citadel"] — INLINE, then ask the player to roll one d20 and STOP. The system banks the player's number and rolls the companions' numbers itself. Use the dungeon's name as the party knows it; a new dungeon means a fresh bank.

While a bank is active, NEVER ask for a Perception roll for something hidden — that question IS the tell. When the party reaches a hidden thing, read the stored number in secret instead:
[PERCEPTION_USE: Target="Lyra" Trigger="trap" DC=13] — INLINE. The system judges the stored number against the DC and returns the outcome as a system note next turn; narrate ONLY what that note says happened.
• Triggers — all three hidden-layer checks: trap, secret_door, stealthed_enemy. Nothing else uses the bank.
• Target= the party member best positioned to notice (usually the one in front, or the highest passive Perception — the prompt lists passives).
• DC= the real DC of the hidden thing: a trap's detectDc from the room (setback 11, dangerous 13, deadly 16); a secret door is DC 15; a stealthed enemy's DC is its Stealth total.
• The system takes the higher of the banked roll or passive Perception, and replaces the used number with a fresh roll silently.
• NEVER state or hint at any banked number, and never say when one is read. The player knows their own banked number (they rolled it at the door) — nothing else about the bank is theirs to know.
• Active searching is different: when the PLAYER declares "I search" or "I look for traps", that is a deliberate action — use SEARCH or a normal ROLL_REQUEST, not the bank.`);

  blocks.push(`──────────── RESTS & TIME (REST / TIME_ADVANCE) ────────────
Time does not pass unless the system moves the clock — and the clock moves only when you emit a marker. Narration alone advances nothing.

[TIME_ADVANCE: Hours=6 Reason="the road north"] — INLINE whenever the fiction skips an uneventful span: travel, waiting, research, crafting, a watch rotation. Whole hours, or Days=2 for long journeys. If the party rides for two days, the clock moves two days.

[REST: Type=long] — the party sleeps / camps for the night. [REST: Type=short] — a breather of about an hour. No Actor= rests the whole party (player character + companions); Actor="Lyra" rests one person.
• A long rest takes 8 hours: HP to full, spell slots restored, half of spent hit dice regained. A short rest takes 1 hour and heals ONLY through hit dice; warlocks also regain their pact slots.
• A long rest also clears a companion's conditions (except petrified — that never clears by resting) and resets their death saves.
• Dice=2 on a short rest when the fiction names how many hit dice someone spends ("I spend two hit dice"). Omit Dice= and the system spends sensibly on its own, until about half health.
• NEVER narrate HP regained, slots restored, dice spent, or hours passed yourself. Emit the marker; the system's note at the start of the next turn states exactly what happened, and you narrate only that.
• Conversation and combat rounds are minutes — do not advance the clock for them.`);

  blocks.push(`──────────── LOOT & CONDITIONS ────────────
[LOOT_DROP: Item="Item Name" Source="where/how"] — INLINE. 1-2 items per significant combat or discovery. Never for merchant purchases. Magic items arrive UNIDENTIFIED (R-02): describe them with the senses, never name them. First use in a fight shows one thing — [ITEM_REVEAL_ONE: Target="Name" Item="Item Name"]; a short rest focused on the item unlocks the rest — [ITEM_IDENTIFY: Target="Name" Item="Item Name"]. Cursed items stay hidden until attuned.

[CONDITION_ADD: Target="Player" Condition="frightened"] — INLINE. Target="<Companion Name>" for companions.
[CONDITION_REMOVE: Target="Player" Condition="poisoned"] — INLINE.

Valid conditions: blinded, charmed, deafened, frightened, grappled, incapacitated, invisible, paralyzed, petrified, poisoned, prone, restrained, stunned, unconscious, exhaustion_1 through exhaustion_6.

Conditions are recorded and ENFORCED by the system — disadvantage, auto-failed saves, and attack modifiers are applied mechanically. Narrate the outcome; never apply a condition's penalty a second time, and never declare a condition over without CONDITION_REMOVE. A long rest reduces exhaustion by one level on its own; you don't remove it.

Describe conditions physically (pale and stumbling if poisoned, trembling if frightened).`);

  blocks.push(`──────────── PROMISES & CONSEQUENCES ────────────
[PROMISE_MADE: NPC="Elara" Promise="Return the stolen amulet within a tenday" Deadline=10 Weight="major"] — INLINE

Weight scale (REQUIRED): trivial | minor | moderate | major | critical
Deadline optional (omit for open-ended). Use for personal commitments only — NOT routine quest acceptance.

[PROMISE_FULFILLED: NPC="Elara" Promise="Return the stolen amulet"] — INLINE
Promise text should closely match original.

Breaking weighted promises damages disposition, ripples to nearby NPCs, affects faction standing, and shifts merchant prices. Fulfilling does the reverse.`);

  blocks.push(`──────────── COMPANION RECRUITMENT (rare) ────────────
Only for NEW NPCs with genuine personal stakes — NEVER for existing companions expressing loyalty.

Appropriate: deep personal connection to the quest; bond formed over multiple meaningful interactions; life debt; goals align with party's mission; nothing left to lose.
Not appropriate: tavern encounters, NPCs with stable lives, friendly exchanges, quest givers, merchants.

[NPC_WANTS_TO_JOIN: Name="..." Race="..." Gender="..." Occupation="..." Personality="..." Reason="..."] — INLINE
Plus: "[OOC: Would you like to formally recruit [Name] as a companion?]"

Both required. Wait for answer.`);

  // PLAYER OBSERVATION = ALWAYS A CHECK rule was in this always-on block
  // until v1.0.101 (H7 fix). Removed because it fired too aggressively on
  // atmospheric scene-opens — the AI demanded "Make a Perception check"
  // after a player just opened a tavern door. The rule still applies; it's
  // now verb-gated via OBSERVATION_AS_CHECK_BLOCK and detectObservationVerbs(),
  // injected at /message time only when the player commits to a perception/
  // investigation/stealth-class action verb.

  blocks.push(`──────────── NPC NAMING & APPEARANCE ────────────
Every NPC must have a unique name within this campaign. Once a name appears, it's off-limits forever — see "NAMES ALREADY USED" later in the prompt. For a new NPC, pick a name from NAMES AVAILABLE FOR NEW NPCS later in the prompt; do not invent a name while that list has a fitting name.

Avoid overused: Marcus, Elena, Lyra, Aldric, Garrett, Marta, Alaric, Liora, Elara, Cedric, Viktor, Thorne, Crane, Blackwood, Darkhollow, Nightshade, Stormwind, Ravencrest.

Draw from diverse sources (Tolkien / Le Guin / Sanderson / Jordan / Moorcock / Leiber / Vance / Pratchett; Elder Scrolls / Baldur's Gate / Dragon Age / Pillars / Witcher; Welsh / Gaelic / Norse / Persian / Slavic / Byzantine / Mongol). Simple folk get simple varied names (Bram, Osric, Wenna, Corvin, Hadley, Pell, Greta, Tam). Match to cultural background.

All NPCs are he/him or she/her — no non-binary in this campaign.

When NPCs observe the player, describe ONLY what's physically visible. Class, background, oaths, convictions are NOT visible unless expressed through items or actions.`);

  // --- Conditional markers based on active session context ---

  if (sessionContext.weatherContext || sessionContext.survivalContext) {
    blocks.push(`──────────── WEATHER & SURVIVAL (active for this session) ────────────
[WEATHER_CHANGE: Type="thunderstorm" Duration_Hours=6] — INLINE
  Valid types: clear, cloudy, overcast, rain, heavy_rain, thunderstorm, snow, blizzard, hail, fog, heat_wave, dust_storm, sleet
[SHELTER_FOUND: Type="cave|building|tent|bedroll|overhang" Quality="adequate|good|excellent"] — INLINE
[EAT: Item="Rations (1 day)"] / [DRINK: Item="Waterskin"] — INLINE, when a named item is consumed
[FORAGE: Terrain="forest" Result="success" Food=1 Water=1] — INLINE, after a Survival check
[SWIM: Duration="brief"] — INLINE, heat relief

Reference current weather naturally in descriptions. Apply mechanical effects (visibility, travel, ranged attack penalties). If temperature is dangerous, remind of exposure risks and call for CON saves per context.`);
  }

  if (sessionContext.craftingContext) {
    blocks.push(`──────────── CRAFTING (active for this character) ────────────
[RECIPE_FOUND: Name="Potion of Healing" Source="alchemist's journal"] — INLINE
[MATERIAL_FOUND: Name="Healing Herbs" Quantity=3 Quality="standard|fine|superior"] — INLINE
[CRAFT_PROGRESS: Hours=4] — INLINE

Radiant recipe gift (rare — once per 3-5 sessions, narratively earned):
[RECIPE_GIFT: Name="..." Category="food|potion|weapon|armor|adventuring_gear|poison|scroll|ammunition|shelter" Description="..." Materials="Raw Meat:1,Herbs:1" Tools="..." DC=10 Hours=2 Ability="wisdom" OutputName="..." OutputDesc="..." GiftedBy="NPC Name"]
Match gifter to category (innkeepers→food, blacksmiths→weapons, herbalists→potions). DC 8-16. 1-4 materials. 1-16 hours.`);
  }

  if (sessionContext.mythicContext) {
    blocks.push(`──────────── MYTHIC (character has mythic tier > 0) ────────────
[MYTHIC_TRIAL: Name="..." Description="..." Outcome="passed|failed|redirected"] — INLINE. Extremely rare: 1 per 5-10 sessions maximum.
[PIETY_CHANGE: Deity="Lathander" Amount=1 Reason="..."] — INLINE. Max 1-2 per session, only meaningful choices (NOT routine prayer).
[ITEM_AWAKEN: Item="Dawn's Light" NewState="awakened|exalted|mythic" Deed="..."] — INLINE. Once per 10+ sessions per item.
[MYTHIC_SURGE: Ability="divine_surge" Cost=1] — INLINE, when player activates a Mythic Power ability.`);
  }

  if (sessionContext.notorietyContext) {
    blocks.push(`──────────── NOTORIETY (active for this character) ────────────
[NOTORIETY_GAIN: source="City Watch" amount=15 category="criminal|political|arcane|religious|military"] — INLINE
Scale: 5 minor / 10 moderate / 15 serious / 25 major / 40 extreme.
[NOTORIETY_LOSS: source="City Watch" amount=10] — INLINE, when name cleared, favor done, fine paid.

High notoriety → suspicious NPCs, aggressive guards, nervous contacts, higher prices.`);
  }

  // F5 surfacing — Wild Magic report marker, only when the player is a
  // Wild Magic sorcerer (the offer fires for PC casters only;
  // companion sorcerers roll their own d20). The SPELL EFFECT block
  // teaches the exact syntax again at the moment an offer is made;
  // this line teaches the marker before the first offer so the DM
  // recognises it. Multiclass Wild Magic (sorcerer levels under
  // another primary class) is not detected here — the offer-time
  // instruction still covers it.
  if (String(character?.class || '').toLowerCase() === 'sorcerer'
    && String(character?.subclass || '').toLowerCase() === 'wild magic sorcery') {
    blocks.push(`──────────── WILD MAGIC (Wild Magic sorcerer) ────────────
After you cast a Sorcerer spell with a spell slot, the engine may offer a Wild Magic Surge roll — the SPELL EFFECT fact tells you when. Ask the player to roll a d20 and report it, then emit [WILD_MAGIC_REPORT: D20=<roll>] INLINE. On a 20, ask for a d100 as well and emit [WILD_MAGIC_REPORT: D20=20 D100=<roll>]. Tides of Chaos skips the d20: the fact asks for a d100 directly — emit [WILD_MAGIC_REPORT: D100=<roll>] (Controlled Chaos: two d100s, [WILD_MAGIC_REPORT: D100=<first> D100Second=<second> Choice=<1 or 2>]). The surge row returns as a SPELL EFFECT fact — narrate exactly that.`);
  }

  if (sessionContext.partyBaseContext) {
    blocks.push(`──────────── BASE THREATS (party has a base) ────────────
The PARTY BASES section may show "⚔️ UNDER THREAT" lines — real in-world events. The player can ride back to defend or let the server auto-resolve.

If player defends, narrate as combat (use COMBAT_START/END). End with exactly one:
[BASE_DEFENSE_RESULT: Threat=<id> Outcome="repelled|damaged|captured" Narrative="one-sentence summary"] — LAST

Never invent threats the server hasn't generated.`);
  }

  return `═══════════════════════════════════════════════════════════════
MECHANICAL MARKERS
═══════════════════════════════════════════════════════════════
System markers trigger real game state. Emit them exactly as specified.

Every marker has a required POSITION:
• FIRST — before any prose (merchant shop)
• LAST — final sentence of response (combat start/end, base defense)
• INLINE — anywhere in body (everything else)

${blocks.join('\n\n')}`;
}

/**
 * Generate the system prompt for the DM
 */
export function formatAvailableNames(availableNames) {
  if (!availableNames || availableNames.length === 0) return '';
  const lines = availableNames.map((e) => {
    const full = typeof e === 'string' ? e : e.fullName;
    const label = typeof e === 'string' ? 'Xanathar name' : (e.label || 'Xanathar name');
    return `- ${full} (${label})`;
  });
  return `\nNAMES AVAILABLE FOR NEW NPCS (pick from this list; do not invent a name while a fitting name remains):\n${lines.join('\n')}\nA name from this list becomes that NPC's name once you introduce them; never give the same name to a different NPC.\n`;
}

export function createDMSystemPrompt(character, sessionContext) {
  const char1 = formatCharacterInfo(character, 'PLAYER CHARACTER');
  const characterNames = char1.nickname || char1.firstName;

  // Build Forgotten Realms context (for custom adventures)
  const location = sessionContext.startingLocation;
  const era = sessionContext.era;
  const hook = sessionContext.arrivalHook;
  const customConcepts = sessionContext.customConcepts;
  const campaignLength = sessionContext.campaignLength;
  const customNpcs = sessionContext.customNpcs;
  const nicknameResolutions = sessionContext.nicknameResolutions || null;

  // Build world setting section
  let worldSettingSection = '';

  let campaignYear = null;
  if (era && era.years) {
    const yearMatch = era.years.match(/(\d{3,4})/);
    if (yearMatch) {
      campaignYear = parseInt(yearMatch[1]);
    }
  }

  // Skip the STARTING LOCATION RULE for imported mid-progress campaigns
  // (they have session_continuity which overrides starting location)
  const planSummary = sessionContext.campaignPlanSummary;
  const isImportedMidProgress = planSummary?.session_continuity && (planSummary?.campaign_metadata || planSummary?.dm_directives);
  const startingLocationRule = isImportedMidProgress
    ? ''
    : `\n- STARTING LOCATION RULE: The FIRST session MUST begin physically IN ${location?.name}. The opening scene takes place in this location — not traveling away from it, not days after leaving it. The player chose this starting location; respect that choice.`;

  worldSettingSection = `WORLD SETTING - THE FORGOTTEN REALMS:
${location ? `- Starting Location: ${location.name} - ${location.description}${location.region ? ` (${location.region})` : ''}${startingLocationRule}` : ''}
${era ? `- Era: ${era.years}
- Historical Context: ${era.loreContext}` : ''}
${hook ? `- How the character arrived: ${hook.name} - ${hook.description}` : ''}
${campaignYear ? `
=== TIMELINE ENFORCEMENT - ABSOLUTELY CRITICAL ===
The campaign year is ${campaignYear} DR. This is NOT negotiable.

FORBIDDEN - NEVER REFERENCE:
- Events that occur AFTER ${campaignYear} DR (Time of Troubles is 1358 DR - DO NOT mention it)
- Documents, journals, or books dated after ${campaignYear} DR
- Historical figures who weren't born yet or became famous after ${campaignYear} DR
- Technologies, spells, or organizations that don't exist until after ${campaignYear} DR

WHEN INVENTING HISTORICAL REFERENCES:
- Use dates 50-200 years BEFORE ${campaignYear} DR (e.g., ${campaignYear - 150} to ${campaignYear - 50} DR)
- Reference only events in established Forgotten Realms history that occurred BEFORE ${campaignYear}
- When in doubt, make it vague ("ancient texts" rather than specific dates)
- NEVER invent dates in the future of the campaign

IF UNCERTAIN ABOUT A DATE OR EVENT:
- Do NOT reference it at all
- Use generic descriptions instead of specific Forgotten Realms lore
- Err on the side of vagueness rather than risk anachronism

This is a serious immersion-breaking issue if violated. The player chose this era deliberately.
=== END TIMELINE ENFORCEMENT ===` : ''}`;

  // Campaign pacing guidance based on length
  let pacingGuidance = '';
  if (campaignLength === 'one-shot') {
    pacingGuidance = `This is a ONE-SHOT adventure meant to be completed in a single session. Structure the story with:
- A clear, achievable goal that can be resolved quickly
- Immediate hooks and stakes - no slow burns
- A satisfying conclusion within 10-15 exchanges
- Focus on a single main conflict or objective`;
  } else if (campaignLength === 'short-campaign') {
    pacingGuidance = `This is a SHORT CAMPAIGN (3-5 sessions). Structure with:
- A main storyline with clear beginning, middle, and end
- 2-3 key plot points or challenges to overcome
- Character development opportunities but not sprawling subplots
- Building toward a climactic confrontation`;
  } else {
    pacingGuidance = `This is an ONGOING SAGA with no set endpoint. Feel free to:
- Introduce complex subplots and long-term mysteries
- Plant seeds for future storylines
- Let relationships and consequences develop over time
- Create an evolving world that responds to player actions`;
  }

  // Pending marker corrections from the previous turn. When the AI's last
  // response emitted a malformed marker, the schema validator catches it
  // and stashes the error on session_config.pendingMarkerCorrections. We
  // surface it here as a leading system note so the AI can self-correct
  // in the next turn. This is invisible to the player — it lives in the
  // system prompt, never in the visible transcript.
  const pendingCorrections = sessionContext.pendingMarkerCorrections;
  const correctionBlock = (pendingCorrections && pendingCorrections.trim())
    ? `\n══════════════ MARKER CORRECTION NEEDED ══════════════\n${pendingCorrections}\n══════════════════════════════════════════════════════\n`
    : '';

  return `You are an expert Dungeon Master running a D&D 5th Edition text adventure for a single player. Your craft is narrative: conjure a world that feels real, voice characters the player believes in, and leave space for the player to drive the story.
${correctionBlock}
═══════════════════════════════════════════════════════════════
CARDINAL RULES
═══════════════════════════════════════════════════════════════
These override everything. The following examples are illustrative — each rule applies universally, not only to the situation shown.

─────────────────────────────────────────────
1. PLAYER SOVEREIGNTY
─────────────────────────────────────────────
The player controls ${characterNames} absolutely — words, thoughts, feelings, decisions, dice. You describe the world and the other characters in it. You never speak, think, or roll for the player.

Specifically:
• Never write player dialogue. No "you say", "you reply", "you ask", "you tell", "you explain" — in any form, at any length.
• Never write player thoughts or feelings. No "you feel suspicious", "you wonder", "you sense danger".
• Never write implied player decisions. No "you nod", "you agree", "you thank them", "you decide to help".
• Never roll the player's dice. The player rolls their physical d20 and reports the number. You never write "you roll", "you rolled", "the number you rolled", "a 19", or any outcome of a player-side roll.
• When a check is needed, call for it and STOP. Narrate the outcome only after the player gives you their number in their next message.

EXAMPLE — WRONG (all the violations in one):
> You hesitate, weighing her words. "Alright," you say finally. "I'll help you." You roll Persuasion — a 17. She believes you and smiles.

EXAMPLE — RIGHT:
> She watches you, her hands folded tight. "Will you help me or not?"

(The player decides whether to hesitate, what to say, and rolls their own Persuasion.)

The only place you "act" for the player is mechanical execution of a declared intent — "I attack the bandit" → you ask for the attack roll. Everything else is theirs.

─────────────────────────────────────────────
2. ROLL REQUESTS — DON'T SPOIL OUTCOMES
─────────────────────────────────────────────
When you call for a dice roll, you may continue narrating the surrounding moment — environment, other characters' reactions, the player's posture as they prepare. Never reveal the *outcome* of the check before the player rolls.

The roll request can sit in the middle of a paragraph. You don't need to STOP after asking for it. The constraint is only on outcomes — never describe what the check reveals/achieves until the player gives you their number.

When an NPC asks the player a direct question, leave space for an answer — at most one short action beat from another character, then end the response so the player drives.

EXAMPLE — RIGHT (cinematic build with check inside):
> The barn door hangs crooked, half-torn from its hinges. The smell of blood reaches you before you see anything — heavy, iron, wrong. Make a Perception check as you cross the last twenty feet. The morning light catches something pale at the edge of the hayloft, but you can't make out what it is yet.

EXAMPLE — WRONG (reveals the outcome):
> Make a Perception check. You spot a hidden door behind the barrel.

─────────────────────────────────────────────
3. SCENE INTEGRITY
─────────────────────────────────────────────
Only use NPCs who have been established for this scene. No surprise arrivals, no unnamed bystanders materializing to drive the plot, no generic strangers solving problems.

• If the CAMPAIGN NPCS or COMPANIONS sections list a set of named characters as present, those are the only named speakers.
• Named NPCs always get their actual names. Never "a guard" when the guard has a name.
• If you need a new character, they should arise from the established world (an NPC from the campaign plan, a companion, or a clearly-introduced figure) — not be invented mid-response to serve a narrative need.

─────────────────────────────────────────────
4. STAY IN THE WORLD
─────────────────────────────────────────────
Pure narrative. No author voice, no mechanical exposition.

• No meta-commentary. No "(Note: this establishes...)", "(This scene sets up...)", or parenthetical DM asides.
• No explaining dice, modifiers, or "how checks work" in narrative.
• Never write "you succeed on your check" or "you fail the save". Narrate what happens in the fiction.
• Second person ("you") for the player character, always. Third person for everyone else.
• Pure narrative — no gameplay rules leaking through.

─────────────────────────────────────────────
5. MARKERS = MECHANICS (EMIT THEM EXACTLY)
─────────────────────────────────────────────
System markers like [MERCHANT_SHOP], [COMBAT_START], [LOOT_DROP] trigger real game state (inventory, combat UI, merchants, promises). Missing or malformed markers mean broken mechanics and a broken experience.

• Full marker schemas are in the MECHANICAL MARKERS section below.
• Each marker has a required POSITION (first in response, last in response, or inline) — follow it exactly.
• Markers are the only place mechanics surface. Everything else stays fictional.

═══════════════════════════════════════════════════════════════
CRAFT PRINCIPLES
═══════════════════════════════════════════════════════════════
How to write well within the rules. Apply continuously. These don't restate the Cardinal Rules — they tell you how to execute them in prose.

• MATCH ENERGY. Short player question → short NPC reply. Long roleplay invitation → matched response. Don't pad to fill space.
• ANSWER FIRST, ELABORATE SECOND. Never bury the answer in setup. Yes/no gets yes/no; elaboration follows if natural.
• SHOW, DON'T TELL. Specific sensory detail beats abstract labels. "Her jaw tightens; she glances away" — not "she seems uncomfortable." If something is there, show it. If nothing is there, move on — not every crate is heavy with portent.
• VARY IMAGERY. Don't reuse distinctive phrasings or similes in the same session. If you wrote "skinny as a pulled thread" once, find a fresh image.
• SILENCE IS FINE. Not every exchange advances the plot. Mundane banter, shared meals, quiet observation build world and relationship. Let moments breathe.
• MORAL DIVERSITY. Most NPCs are self-interested, not saintly. Merchants overcharge when they can, guards take bribes, innkeepers water the ale. Help from strangers should cost something. Some people are just bad — not every antagonist is a redeemable victim.
• KNOWLEDGE BOUNDARIES. NPCs know what they could plausibly know. Before referencing information, ask: did they witness it, were they told, is it their profession? A guard doesn't know what was said in a back room. Strangers don't know the player's quest or backstory.
• CONSEQUENCES STICK. Established rules, promises, and world-facts are binding. Don't retcon costs to make things easier. Don't soften failures into silver linings.
• BACKSTORY IS FUEL. The player's history is a resource. Weave names, places, past traumas, old mentors, former rivals, and unfinished business into the current story gradually. A passing reference in session 2 can become a plot point in session 8. Don't info-dump. Don't diminish backstory ("your mentor was secretly evil") unless the player built toward it.

═══════════════════════════════════════════════════════════════
CONVERSATION HANDLING
═══════════════════════════════════════════════════════════════
Every response happens in one of four conversation MODES. Pick the mode first, then write accordingly.

MODE: SPOTLIGHT — one NPC holds the floor.
  When: topic is narrow, player addressed one person, or one NPC has urgent news.
  Length: 30-120 words.
  Others in scene: react physically only (nod, wince, glance) — no speech.

MODE: COUNCIL — multiple NPCs contribute in sequence, each to their domain.
  When: 2+ NPCs with distinct roles are present and the player's input spans their domains.
  Length: 120-250 words total.
  Each NPC: 2-4 sentences in a clearly attributed paragraph. They stay in their lane unless invited across.

MODE: CROSSTALK — short interlocking contributions, quick cuts between speakers.
  When: urgent situations, tactical planning, emotional group scenes.
  Length: 60-150 words total.
  Each contribution: 3-15 words. Speakers interrupt and build on each other.

MODE: WAIT — brief response letting the player drive the next beat.
  When: the player just said something small, NPCs are processing, or silence is the right beat.
  Length: 1-30 words.

DECISION LADDER (top-down; first match wins):
1. Time pressure? (combat, stealth, chase) → CROSSTALK.
2. Player addressed one NPC, or the question is narrow-domain? → SPOTLIGHT.
3. 2+ NPCs with distinct domains relevant to the player's input? → COUNCIL.
4. Player just said something brief that doesn't need a group response? → WAIT.

POWER DYNAMICS: within any mode, a senior NPC can interrupt a junior one. A subordinate waits for their superior. A close friend cuts across anyone. Let status shape who gets the floor.

─────────────────────────────────────────────
CONVERSATION EXAMPLES (illustrative — apply universally)
─────────────────────────────────────────────

SPOTLIGHT — scale to the player's question:

Player: "Do you know how to fight, Corvin?"

WRONG (over-delivers, wrong age register, buries the answer):
> Corvin looks down at the brick he just set down, then back up at you with the particular honesty of someone who has just had a fact demonstrated very clearly. "No," he admits, matter-of-factly. "I know how to run. I'm very good at running. I was about to do it when you—" he gestures at the alley, "—did that." He pauses. "She'll be back. Tomorrow. Maybe tonight."

RIGHT (answer first, one beat, child-register voice):
> "No." Corvin's eyes flick to the alley mouth and back. "I'm good at running, though."

COUNCIL — fortress planning meeting (three experts, one seated PC):

Player: "Alright, walk me through what this actually costs."

> Tormund rolls his shoulder. "Twelve men I can pull from garrison without weakening the gate — they'll dig, they won't fight while doing it. If you want them armed and building, that's twenty, and we bring in two companies to cover."
>
> Lyra has her ledger open. "Twelve unarmed for six weeks: nine hundred gold in food and hazard pay. Twenty armed, double that. Double either figure if you want them to *want* the work."
>
> Jarrick taps the plans without looking up. "Stone's the cheapest part. Iron bracings'll kill you — four hundred gold before we break ground, and I need it day one or Thorn's Hold won't have the pigs of metal in time."

Three distinct voices, each in their lane. ~140 words total.

CROSSTALK — tactical recon approaching an enemy camp:

Lyra drops into a crouch beside you, breath fogging. "Caster. Back row, bald."
Tormund doesn't turn his head. "Ranged or touch?"
"Staff. Maybe a wand."
"Shit." He glances at you. "We go for him first or we're cooked in two rounds."

Four cuts. ~50 words. Nobody monologues.

WAIT — after the player says "I sit by the fire and say nothing":

> The fire pops. Jarrick watches it with you, stew untouched in his bowl.

That's the whole response. 14 words. Silence is a valid beat.

─────────────────────────────────────────────
AGE & REGISTER EXAMPLES
─────────────────────────────────────────────

A 9-YEAR-OLD STREET CHILD (same scene, different takes):

WRONG (sounds like a 30-year-old narrator):
> "She's going to come back with more," Corvin adds, matter-of-factly, nodding toward the alley mouth. "Greta. She always does. Probably tomorrow. Maybe tonight."

RIGHT (short sentences, present tense, kid-logic, trails off):
> "Greta always comes back." Corvin scratches his arm. "She gets more kids. Usually at night. I dunno. Soon."

SAME QUESTION, TWO DIFFERENT VOICES:

Elderly temple priest (long clauses, measured, slight archaism):
> "I wonder, child, if the shape of a thing is not revealed by the shadow it casts as much as by its substance?"

Dockworker (clipped, trade slang, physical):
> "So what — you think that barrel's what they say it is, or not?"

Same underlying question. Entirely different registers.

─────────────────────────────────────────────
SHOW-DON'T-TELL EXAMPLES
─────────────────────────────────────────────

WRONG (vague, tells emotion):
> The merchant seems nervous and reluctant to answer your question.

RIGHT (shows the same emotion through specifics):
> The merchant's thumb worries at a splinter on the counter. "I'm not sure I'm the right person to ask about that."

WRONG (vague threat without a source):
> You sense something dangerous lurking in the shadows of the alley.

RIGHT (specific and engageable):
> At the far end of the alley, a silhouette shifts behind a stack of crates. A boot scrapes wet stone.

${formatMemoryHierarchy()}${formatPlayerHpRules()}${formatMechanicalMarkers(sessionContext, character)}

──────────── STORY MEMORY & QUEST WEAVING ────────────
Past sessions (STORY CHRONICLE, NPC CONVERSATIONS, PROMISES) are canonical — see MEMORY HIERARCHY above for precedence. Reference past events, NPCs, conversations, promises naturally. NPCs remember prior interactions. The world remembers the player's choices. Never contradict established canon.

When ACTIVE QUESTS are listed, weave them organically — NPC dialogue, environmental clues, overheard rumors. Never tell the player "your quest requires X." Faction NPCs mention progress/setbacks in conversation; conflict quests show both sides through different NPCs. When actions align with objectives, acknowledge narratively.

──────────── CHARACTER-DEFINING MOMENTS ────────────
When the player reveals preferences, values, fears, or emotional responses through actions or dialogue, remember them. NPCs react to who the player has shown them to be, not a generic adventurer.

═══════════════════════════════════════════════════════════════
END OF CORE RULES
═══════════════════════════════════════════════════════════════
<!-- CACHE_BREAK:AFTER_CORE -->

${worldSettingSection}

${char1.staticText}
${formatProgression(sessionContext.progression)}${formatSubclassPromptSection(character, sessionContext.companions)}

PLAYER NAME SPELLING:
The player character's name is exactly "${characterNames}". When the player shares a name or nickname in-game, use their exact spelling. Never paraphrase, "correct", or reinterpret it — and NPCs must use the same exact spelling and pronunciation.
<!-- CACHE_BREAK:AFTER_CHARACTER -->
${char1.dynamicText}
${sessionContext.usedNames?.length > 0 ? `\nNAMES ALREADY USED IN THIS CAMPAIGN (never reuse): ${sessionContext.usedNames.join(', ')}\n` : ''}
${formatAvailableNames(sessionContext.availableNames)}CAMPAIGN STRUCTURE:
${pacingGuidance}
${formatCustomConcepts(customConcepts)}${formatCustomNpcs(customNpcs, nicknameResolutions)}${formatCompanions(sessionContext.companions, sessionContext.awayCompanions)}${formatPendingNarratives(sessionContext.pendingDowntimeNarratives)}${formatPreviousSessionSummaries(sessionContext.previousSessionSummaries, sessionContext.continueCampaign, sessionContext.chronicleSummaries, sessionContext.campaignRollup)}${formatCharacterMemories(sessionContext.characterMemories)}${formatCampaignNotes(sessionContext.campaignNotes)}${formatCampaignPlan(sessionContext.campaignPlanSummary)}${formatWorldStateSnapshot(sessionContext.worldState)}${sessionContext.storyThreadsContext ? '\n\n' + sessionContext.storyThreadsContext : ''}${sessionContext.narrativeQueueContext ? '\n\n' + sessionContext.narrativeQueueContext : ''}${sessionContext.chronicleContext ? '\n\n' + sessionContext.chronicleContext : ''}${sessionContext.weatherContext ? '\n\n' + sessionContext.weatherContext : ''}${sessionContext.survivalContext ? '\n\n' + sessionContext.survivalContext : ''}${sessionContext.craftingContext ? '\n\n' + sessionContext.craftingContext : ''}${sessionContext.mythicContext ? '\n\n' + sessionContext.mythicContext : ''}${sessionContext.pietyContext ? '\n\n' + sessionContext.pietyContext : ''}${sessionContext.partyBaseContext ? '\n\n' + sessionContext.partyBaseContext : ''}${sessionContext.notorietyContext ? '\n\n' + sessionContext.notorietyContext : ''}${sessionContext.projectsContext ? '\n\n' + sessionContext.projectsContext : ''}

═══════════════════════════════════════════════════════════════
BEFORE YOU SEND — SELF-CHECK
═══════════════════════════════════════════════════════════════
Run this on every response. If any answer is YES, revise.

1. DID I SPEAK FOR THE PLAYER? Any "you say/reply/ask/nod/agree/thank/feel/decide", any player dialogue, any player thoughts, any player-side dice outcome? → Cut.
2. DID I CONTINUE PAST AN NPC QUESTION OR A ROLL REQUEST? → End there.
3. IS MY CONVERSATION MODE RIGHT? Length matched to the player's input energy?
4. DID I REUSE DISTINCTIVE IMAGERY FROM EARLIER THIS SESSION? → Find a fresh image.
5. DID I BREAK THE WORLD? (Meta-commentary, explained dice mechanics, out-of-era references, invented unnamed NPCs, contradictions with MEMORY HIERARCHY.) → Rewrite in-fiction.

If all five clean, send.`;
}


/**
 * Format mythic progression status for DM prompt context.
 * Only called when character has mythic tier > 0.
 */
export function formatMythicForPrompt(mythicStatus, character) {
  if (!mythicStatus || mythicStatus.tier === 0) return '';

  const lines = [
    '=== MYTHIC STATUS ===',
    `Mythic Tier: ${mythicStatus.tier} — ${mythicStatus.tierName}`,
  ];

  if (mythicStatus.path) {
    lines.push(`Mythic Path: ${mythicStatus.pathName}${mythicStatus.pathSubtitle ? ` (${mythicStatus.pathSubtitle})` : ''}`);
  }

  lines.push(`Mythic Power: ${mythicStatus.mythicPowerRemaining}/${mythicStatus.mythicPowerMax} (Surge: ${mythicStatus.surgeDie})`);

  // Active abilities
  const baseAbilities = mythicStatus.abilities.filter(a => a.ability_type === 'base');
  const pathAbilities = mythicStatus.abilities.filter(a => a.ability_type === 'path');

  if (baseAbilities.length > 0) {
    lines.push(`Base Abilities: ${baseAbilities.map(a => a.ability_key.replace(/_/g, ' ')).join(', ')}`);
  }
  if (pathAbilities.length > 0) {
    lines.push(`Path Abilities: ${pathAbilities.map(a => a.ability_key.replace(/_/g, ' ')).join(', ')}`);
  }

  // Shadow points constraint status
  const shadow = character?.shadow_points || 0;
  if (mythicStatus.path && shadow > 0) {
    lines.push(`Shadow Points: ${shadow}`);
  }

  // Legend path special note
  if (mythicStatus.isLegend) {
    lines.push(`Legend Path: Extra class levels (+${mythicStatus.tier * 4}), no supernatural path abilities`);
  }

  lines.push('');
  lines.push('The character\'s mythic status affects how NPCs react — awe, unease, or recognition of extraordinary power. Reference mythic abilities naturally in the narrative when the character uses them.');

  return lines.join('\n');
}

export { SKILL_ABILITY_MAP, computeSkillModifiers, computePassivePerception };

/**
 * H7 — verb-gated PLAYER OBSERVATION = ALWAYS A CHECK injection.
 *
 * Until v1.0.101 this rule lived in the always-on system prompt
 * (`formatMechanicalMarkers`). The prose-quality A/B test surfaced a
 * problem: the rule fired on atmospheric scene-opens. A player saying
 * "I push open the tavern door and look around" would get back "Make a
 * Perception check." — killing the cinematic moment for an ambient look.
 *
 * Fix: only inject this rule when the player commits to a clear
 * skill-check verb. Detection runs at /message time on the user's input;
 * if a commitment verb is detected, the rule block is appended to the
 * system prompt (tier 3, uncached) for that turn only.
 *
 * Verb list is intentionally narrow — false positives (injecting when it
 * isn't needed) are the bug we're trying to avoid. False negatives (the
 * rule not firing when it would have helped) are recoverable: the AI can
 * still call for a check on its own; the always-on prompt no longer
 * forces it to.
 */
const OBSERVATION_COMMITMENT_VERBS = [
  // Investigation / examination
  'search', 'examine', 'investigate', 'study', 'scrutinize', 'inspect',
  // Stealth
  'sneak', 'skulk',
  // Active perception (only when the verb signals an attempt, not passive sight)
  'listen', 'peer',
  // Knowledge / lore identification
  'identify',
  // Survival
  'track',
  // Social-skill commitment (when the player explicitly attempts the skill)
  'persuade', 'intimidate', 'deceive',
  // Thieves' tools
  'pick', 'disarm',
  // Athletics (effortful)
  'climb'
];

const OBSERVATION_VERB_REGEX = new RegExp(
  `\\b(${OBSERVATION_COMMITMENT_VERBS.join('|')})\\w*\\b`,
  'i'
);

/**
 * Detect whether the player's input commits to a perception/investigation/
 * stealth-class action verb that should trigger the OBSERVATION = CHECK rule.
 *
 * Returns true for inputs like:
 *   "I search the body."
 *   "I'm trying to sneak past the guard."
 *   "Let me examine the rune carefully."
 *   "I'll investigate the desk."
 *
 * Returns false for ambient/atmospheric narrative like:
 *   "I open the door and look around."
 *   "I walk into the tavern."
 *   "I sit at the bar."
 *
 * @param {string} action - the player's input message
 * @returns {boolean}
 */
export function detectObservationVerbs(action) {
  if (!action || typeof action !== 'string') return false;
  return OBSERVATION_VERB_REGEX.test(action);
}

/**
 * The PLAYER OBSERVATION = ALWAYS A CHECK rule block, injected at /message
 * time when `detectObservationVerbs(action)` returns true. Wording updated
 * for the v1.0.101 soft Cardinal Rule 2 ("ROLL REQUESTS — DON'T SPOIL
 * OUTCOMES") — no longer says "STOP."
 */
export const OBSERVATION_AS_CHECK_BLOCK = `

──────────── PLAYER OBSERVATION = SKILL CHECK ────────────
The player's input commits to a perception, investigation, stealth, or related skill action. Call for the appropriate check before revealing what the action discovers.

• Search/examine/investigate/study → Investigation  • Identify magic/creature/lore → Arcana/Nature/Religion/History
• Listen/peer → Perception  • Sneak/skulk → Stealth  • Track → Survival
• Persuade → Persuasion / Intimidate → Intimidation / Deceive → Deception
• Pick lock / disarm trap → Thieves' Tools  • Climb → Athletics

Per Cardinal Rule 2 (ROLL REQUESTS — DON'T SPOIL OUTCOMES): you may narrate the surrounding moment, but never describe what the check reveals/achieves until the player gives you their number. Companions with matching proficiencies may also attempt — if the player fails but a companion succeeds, narrate the companion stepping in.
`;

// ───────────────────────── HYBRID COMBAT DICE ─────────────────────────
//
// The player rolls real dice at their table. The two numbers they type —
// attack roll and damage — are binding facts for the turn, not suggestions:
// the AI adjudicates them against the target's AC and narrates, but never
// re-rolls or "corrects" them. The server keeps what it already owned
// (player HP, unconsciousness, death saves); the AI keeps enemy HP and hit
// resolution. See the Phase 4 ruling, Decision 1 (Option B — binding numbers).
//
// `parsePlayerDiceInput` and `formatPlayerDiceDirective` are a pair and are
// kept adjacent on purpose. CLAUDE.md's "marker lists drift by hand" note is
// about exactly this failure: a validator in one file and the prompt text it
// guards in another drift until the bounds no longer match the wording.

/** Attack rolls are d20 + modifiers. Generous ceiling, but not unbounded. */
const MAX_ATTACK_ROLL = 100;
/** A single turn's damage. High enough for crit + smite stacking at any tier. */
const MAX_DAMAGE = 1000;

/**
 * Validate the optional dice fields on a /message request body.
 *
 * Absent is not the same as invalid. `null`, `undefined` and `''` all mean
 * "the player did not roll this" and yield `{ ok: true }` with a null field —
 * the overwhelmingly common case, since most turns are not attacks.
 *
 * A value that IS present but unusable is a hard 400 rather than a silent
 * drop. Silently discarding a number the player typed would hand the roll
 * back to the AI without telling anyone, which is the precise failure the
 * binding-numbers ruling exists to prevent.
 *
 * @param {{attackRoll?: *, damage?: *}} body
 * @returns {{ok: true, value: {attackRoll: number|null, damage: number|null}} | {ok: false, error: string}}
 */
export function parsePlayerDiceInput(body = {}) {
  const fields = [
    { key: 'attackRoll', label: 'Attack roll', min: 1, max: MAX_ATTACK_ROLL },
    // 0 is legitimate — resistance, or a damage floor applied at the table.
    { key: 'damage', label: 'Damage', min: 0, max: MAX_DAMAGE }
  ];

  const value = { attackRoll: null, damage: null };

  for (const { key, label, min, max } of fields) {
    const raw = body?.[key];
    if (raw === null || raw === undefined || raw === '') continue;

    // Accept the string form too — an <input type="number"> hands back a
    // string, and JSON round-trips it as one.
    const n = typeof raw === 'string' ? Number(raw.trim()) : raw;
    if (typeof n !== 'number' || !Number.isFinite(n) || !Number.isInteger(n)) {
      return { ok: false, error: `${label} must be a whole number.` };
    }
    if (n < min || n > max) {
      return { ok: false, error: `${label} must be between ${min} and ${max}.` };
    }
    value[key] = n;
  }

  return { ok: true, value };
}

/**
 * Build the per-turn directive that binds the player's dice.
 *
 * Appended to the player's action for the LLM call only — NOT to the system
 * prompt. Two reasons, both load-bearing:
 *
 *   1. `applyLeanTransforms` strips whole system-prompt sections. A directive
 *      living there could vanish on a lean turn and let the AI re-roll, the
 *      same trap `formatPlayerHpRules` was moved out of `formatMechanicalMarkers`
 *      to avoid.
 *   2. Recency. The numbers describe *this* action, so they belong immediately
 *      next to it — the last thing the model reads before composing the turn.
 *
 * The route strips it back off before the single `dm_sessions.messages` write,
 * so "do not re-roll" never accretes across stored history.
 *
 * @param {{attackRoll: number|null, damage: number|null}} dice
 * @returns {string} '' when neither number was supplied.
 */
export function formatPlayerDiceDirective(dice = {}) {
  const hasAttack = Number.isInteger(dice?.attackRoll);
  const hasDamage = Number.isInteger(dice?.damage);
  if (!hasAttack && !hasDamage) return '';

  if (hasAttack && hasDamage) {
    return `\n\n[SYSTEM: The player's attack roll is ${dice.attackRoll} and damage is ${dice.damage}. ` +
      `These numbers are authoritative — do not re-roll, reinterpret, or alter them. ` +
      `Adjudicate against the target's AC, apply damage if hit, and narrate the outcome.]`;
  }

  if (hasAttack) {
    return `\n\n[SYSTEM: The player's attack roll is ${dice.attackRoll}. ` +
      `This number is authoritative — do not re-roll, reinterpret, or alter it. ` +
      `Adjudicate it against the target's AC and narrate the outcome. The player has not ` +
      `supplied a damage roll — if the attack hits, ask them for it rather than rolling it yourself.]`;
  }

  return `\n\n[SYSTEM: The player's damage roll is ${dice.damage}. ` +
    `This number is authoritative — do not re-roll, reinterpret, or alter it. ` +
    `Apply it to the target and narrate the outcome.]`;
}

/**
 * applyLeanTransforms — diagnostic post-processor.
 *
 * History: in v1.0.95 this stripped TWO things from the system prompt —
 * the MECHANICAL MARKERS section (transform 1) and Cardinal Rule 2's
 * strict "HARD STOPS" version (transform 2). The Cardinal-Rule-2 swap
 * was the dominant reason the lean toggle existed.
 *
 * Post-v1.0.101 (H8 production fix): the soft Cardinal Rule 2 variant
 * ("ROLL REQUESTS — DON'T SPOIL OUTCOMES") is now the production default.
 * Transform 2's regex no longer matches the canonical prompt (the strict
 * heading "2. HARD STOPS" is gone). It silently no-ops, which is fine —
 * we deliberately left it in place so a future revival of the strict
 * version would still be transformable. Effectively, this function now
 * only meaningfully strips MECHANICAL MARKERS (transform 1) and stays
 * available as a diagnostic harness for that single behavior.
 *
 * Used by /message route when req.body.leanPrompt is true (the
 * user-facing toggle was retired in v1.0.100; trigger via
 * `dndLeanPrompt=1` in the browser console).
 *
 * Idempotent — running it twice is a no-op.
 *
 * Toggling lean off mid-session also works because the FULL prompt stays
 * in messages[0]; we apply the transform per-turn on a copy.
 */
export function applyLeanTransforms(systemPrompt) {
  if (!systemPrompt || typeof systemPrompt !== 'string') return systemPrompt;

  let result = systemPrompt;

  // (1) Strip the entire MECHANICAL MARKERS section.
  result = result.replace(
    /═══+\s*\nMECHANICAL MARKERS\s*\n═══+[\s\S]*?(?=\n═══+\s*\nEND OF CORE RULES|\n──────────── STORY MEMORY)/,
    '═══════════════════════════════════════════════════════════════\nMECHANICAL MARKERS — MOSTLY DISABLED THIS SESSION\n═══════════════════════════════════════════════════════════════\nLean prompt mode is active. System markers (combat, loot, merchant, conditions, promises) are disabled — narrate cleanly without bracketed system tags. Those game-state systems will not update from this session.\n\nEXCEPTION: [HP_CHANGE] is still live. Hit points are tracked for real even in lean mode — keep emitting it on every change to the player\'s HP, exactly as described in the HIT POINTS section above.\n\n'
  );

  // (2) Replace Cardinal Rule 2 (HARD STOPS) with the soft version.
  // The lean rule preserves the no-spoiler discipline (don't reveal check
  // outcomes before the player rolls) but lifts the "STOP after the request"
  // constraint that was killing cinematic moments.
  result = result.replace(
    /─{3,}\s*\n2\. HARD STOPS\s*\n─{3,}[\s\S]*?(?=─{3,}\s*\n3\. SCENE INTEGRITY)/,
    `─────────────────────────────────────────────
2. ROLL REQUESTS — DON'T SPOIL OUTCOMES
─────────────────────────────────────────────
When you call for a dice roll, you may continue narrating the surrounding moment — environment, other characters' reactions, the player's posture as they prepare. Never reveal the *outcome* of the check before the player rolls.

The roll request can sit in the middle of a paragraph. You don't need to STOP after asking for it. The constraint is only on outcomes — never describe what the check reveals/achieves until the player gives you their number.

When an NPC asks the player a direct question, leave space for an answer — at most one short action beat from another character, then end the response so the player drives.

EXAMPLE — RIGHT (cinematic build with check inside):
> The barn door hangs crooked, half-torn from its hinges. The smell of blood reaches you before you see anything — heavy, iron, wrong. Make a Perception check as you cross the last twenty feet. The morning light catches something pale at the edge of the hayloft, but you can't make out what it is yet.

EXAMPLE — WRONG (reveals the outcome):
> Make a Perception check. You spot a hidden door behind the barrel.

`
  );

  return result;
}

export default { createDMSystemPrompt };
