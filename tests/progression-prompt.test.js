/**
 * Progression Prompt Integration Tests
 *
 * Exercises formatProgression() and its integration with createDMSystemPrompt().
 * Confirms that theme abilities, ancestry feats, synergies, Knight moral paths,
 * and narration hooks all render correctly in the AI DM system prompt.
 */

import { formatProgression, createDMSystemPrompt } from '../server/services/dmPromptBuilder.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

// ===== formatProgression() unit tests =====

console.log('\n=== Test 1: formatProgression with null or empty ===\n');
{
  assert(formatProgression(null) === '', 'Returns empty string for null');
  assert(formatProgression(undefined) === '', 'Returns empty string for undefined');
  assert(formatProgression({}) === '', 'Returns empty string for empty object');
  assert(formatProgression({ theme: null }) === '', 'Returns empty string when theme is null');
}

console.log('\n=== Test 2: Theme identity + unlocked abilities render ===\n');
{
  const prog = {
    character: { level: 1 },
    theme: {
      theme_id: 'soldier',
      theme_name: 'Soldier',
      identity: 'Military discipline and leadership.',
      signature_skill_1: 'Athletics',
      signature_skill_2: 'Intimidation',
      path_choice: null,
      tags: ['discipline']
    },
    theme_all_tiers: [],
    theme_unlocks: [{
      tier: 1,
      ability_name: 'Military Rank',
      ability_description: 'You have a military rank.',
      mechanics: 'Social influence over fellow soldiers'
    }],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes('CHARACTER PROGRESSION LAYER'), 'Section header renders');
  assert(out.includes('THEME: Soldier'), 'Theme name renders');
  assert(out.includes('Identity: Military discipline'), 'Identity renders');
  assert(out.includes('Signature skills: Athletics, Intimidation'), 'Signature skills render');
  assert(out.includes('UNLOCKED THEME ABILITIES'), 'Unlocked abilities header renders');
  assert(out.includes('L1 Military Rank'), 'Ability name and tier render');
  assert(out.includes('Mechanics: Social influence'), 'Mechanics render');
  assert(out.includes('NARRATION HOOK'), 'Narration hook section renders');
  assert(out.includes('military veteran'), 'Soldier narration hook content renders');
}

console.log('\n=== Test 3: Theme path_choice renders (Outlander biome, Knight order) ===\n');
{
  const prog = {
    character: { level: 5 },
    theme: {
      theme_id: 'outlander',
      theme_name: 'Outlander',
      identity: 'Wilderness-raised',
      signature_skill_1: 'Survival',
      signature_skill_2: 'Athletics',
      path_choice: 'forest',
      tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes('THEME: Outlander (forest)'), 'Path choice renders alongside theme name');
}

console.log('\n=== Test 4: Ancestry feats render with mechanics ===\n');
{
  const prog = {
    character: { level: 1 },
    theme: {
      theme_id: 'sage', theme_name: 'Sage',
      identity: 'scholar', signature_skill_1: 'Arcana',
      signature_skill_2: 'History', path_choice: null, tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [
      {
        tier: 1,
        list_id: 'human',
        feat_name: 'Jack of All Trades',
        description: 'Add half prof to non-proficient checks.',
        mechanics: 'Half prof bonus'
      }
    ],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes('ANCESTRY FEATS:'), 'Ancestry feats section header');
  assert(out.includes('L1 Jack of All Trades'), 'Feat name and tier');
  assert(out.includes('Mechanics: Half prof bonus'), 'Feat mechanics');
}

console.log('\n=== Test 5: Knight moral path renders with guidance ===\n');
{
  const prog = {
    character: { level: 3 },
    theme: {
      theme_id: 'knight_of_the_order',
      theme_name: 'Knight of the Order',
      identity: 'Oath-sworn',
      signature_skill_1: 'Persuasion',
      signature_skill_2: 'History',
      path_choice: 'chivalric',
      tags: ['oath']
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: { current_path: 'true', last_path_change_reason: null },
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes('KNIGHT MORAL PATH: TRUE'), 'Current path renders uppercase');
  assert(out.includes('True Path — their oath is intact'), 'True-path guidance text');
}

console.log('\n=== Test 6: Knight Fallen path surfaces dissonance guidance ===\n');
{
  const prog = {
    character: { level: 8 },
    theme: {
      theme_id: 'knight_of_the_order',
      theme_name: 'Knight of the Order',
      identity: 'Broken oath-sworn',
      signature_skill_1: 'Persuasion',
      signature_skill_2: 'History',
      path_choice: 'chivalric',
      tags: ['oath']
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: { current_path: 'fallen', last_path_change_reason: 'Betrayed the order at siege' },
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes('KNIGHT MORAL PATH: FALLEN'), 'Fallen path renders');
  assert(out.includes('broken their oath'), 'Fallen-path guidance surfaces');
}

console.log('\n=== Test 7: Subclass × Theme synergy renders ===\n');
{
  const prog = {
    character: { level: 3 },
    theme: {
      theme_id: 'soldier', theme_name: 'Soldier',
      identity: 'test', signature_skill_1: 'Athletics',
      signature_skill_2: 'Intimidation', path_choice: null, tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: {
      synergy_name: "Tactician's Eye",
      description: 'Superiority dice can fuel tactical insight.',
      mechanics: 'Expend a die for a recon check'
    },
    mythic_theme_amplification: null
  };
  const out = formatProgression(prog);
  assert(out.includes("RESONANT SUBCLASS×THEME SYNERGY: Tactician's Eye"), 'Synergy header');
  assert(out.includes('Superiority dice'), 'Synergy description');
  assert(out.includes('Mechanics: Expend a die'), 'Synergy mechanics');
}

console.log('\n=== Test 8: Mythic resonant amplification tier-gated by level ===\n');
{
  const makeProg = (level) => ({
    character: { level },
    theme: {
      theme_id: 'acolyte', theme_name: 'Acolyte',
      identity: 'faithful', signature_skill_1: 'Insight',
      signature_skill_2: 'Religion', path_choice: null, tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: {
      combo_name: 'Saintly Vessel',
      is_dissonant: 0,
      shared_identity: 'Faith as foundation.',
      t1_bonus: 'Mythic Power pool +1.',
      t2_bonus: 'Faithkeeper duration doubles.',
      t3_bonus: 'Divine Intercessor heals restore Mythic Power.',
      t4_bonus: 'Deity pays direct attention.'
    }
  });

  const low = formatProgression(makeProg(3));
  assert(!low.includes('T1:'), 'L3 character does not yet qualify for T1 bonus (requires L5)');

  const t1Ready = formatProgression(makeProg(5));
  assert(t1Ready.includes('MYTHIC AMPLIFICATION: Saintly Vessel'), 'Amplification header renders');
  assert(t1Ready.includes('Active tier bonuses'), 'Active tiers header when qualified');
  assert(t1Ready.includes('T1: Mythic Power pool'), 'T1 bonus renders at L5');
  assert(!t1Ready.includes('T2:'), 'T2 bonus does NOT render at L5');

  const t3Ready = formatProgression(makeProg(15));
  assert(t3Ready.includes('T1:') && t3Ready.includes('T2:') && t3Ready.includes('T3:'), 'L15 sees T1/T2/T3 bonuses');
  assert(!t3Ready.includes('T4:'), 'L15 does not see T4');

  const capstone = formatProgression(makeProg(20));
  assert(capstone.includes('T4: Deity pays direct attention'), 'L20 sees T4 capstone');
}

console.log('\n=== Test 9: Mythic dissonant arc renders with threshold ===\n');
{
  const prog = {
    character: { level: 10 },
    theme: {
      theme_id: 'criminal', theme_name: 'Criminal',
      identity: 'underworld', signature_skill_1: 'Stealth',
      signature_skill_2: 'Deception', path_choice: null, tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: {
      combo_name: 'The Redeemed Thief',
      is_dissonant: 1,
      shared_identity: 'Angel chose the former criminal.',
      dissonant_arc_description: 'Perform 9 Redemption Acts.',
      required_threshold_acts: 9,
      t1_bonus: null, t2_bonus: null, t3_bonus: null, t4_bonus: null
    }
  };
  const out = formatProgression(prog);
  assert(out.includes('MYTHIC DISSONANT ARC: The Redeemed Thief'), 'Dissonant arc header');
  assert(out.includes('Perform 9 Redemption Acts'), 'Arc description');
  assert(out.includes('Threshold acts required'), 'Threshold rendering');
  assert(!out.includes('T1:'), 'Dissonant arcs do not show tier bonuses');
}

console.log('\n=== Test 10: Each of the 21 themes has a narration hook ===\n');
{
  // Sanity check — formatProgression should produce a NARRATION HOOK for every theme
  const themeIds = [
    'soldier', 'sage', 'criminal', 'acolyte', 'charlatan', 'entertainer',
    'noble', 'outlander', 'sailor', 'far_traveler', 'haunted_one',
    'guild_artisan', 'clan_crafter', 'hermit', 'investigator',
    'city_watch', 'knight_of_the_order', 'mercenary_veteran',
    'urban_bounty_hunter', 'folk_hero', 'urchin'
  ];
  let allHaveHooks = true;
  let missing = [];
  for (const themeId of themeIds) {
    const prog = {
      character: { level: 1 },
      theme: {
        theme_id: themeId, theme_name: themeId,
        identity: 'test', signature_skill_1: 's1', signature_skill_2: 's2',
        path_choice: null, tags: []
      },
      theme_all_tiers: [],
      theme_unlocks: [],
      ancestry_feats: [],
      knight_moral_path: null,
      subclass_theme_synergy: null,
      mythic_theme_amplification: null
    };
    const out = formatProgression(prog);
    if (!out.includes('NARRATION HOOK:')) {
      allHaveHooks = false;
      missing.push(themeId);
    }
  }
  assert(allHaveHooks, `All 21 themes have narration hooks${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
}

console.log('\n=== Test 11: createDMSystemPrompt includes progression when supplied ===\n');
{
  const minimalChar = {
    id: 1, name: 'Test', first_name: 'Test', gender: 'female',
    race: 'human', subrace: null, class: 'fighter', subclass: 'Battle Master',
    level: 5, current_hp: 44, max_hp: 44, background: 'soldier',
    ability_scores: JSON.stringify({ str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 }),
    inventory: '[]', skills: '[]', known_cantrips: '[]', known_spells: '[]',
    prepared_spells: '[]', feats: '[]', current_location: 'Waterdeep'
  };
  const progression = {
    character: { level: 5 },
    theme: {
      theme_id: 'soldier', theme_name: 'Soldier',
      identity: 'military discipline', signature_skill_1: 'Athletics',
      signature_skill_2: 'Intimidation', path_choice: null, tags: []
    },
    theme_all_tiers: [],
    theme_unlocks: [{
      tier: 1, ability_name: 'Military Rank',
      ability_description: 'Rank recognized.', mechanics: 'Social influence'
    }],
    ancestry_feats: [],
    knight_moral_path: null,
    subclass_theme_synergy: null,
    mythic_theme_amplification: null
  };
  const sessionContext = {
    campaignModule: null,
    startingLocation: { id: 'waterdeep', name: 'Waterdeep', description: 'a city', region: 'Sword Coast', type: 'city' },
    era: { id: 'present', name: 'Present', years: '1492 DR', loreContext: '' },
    arrivalHook: null, customConcepts: null, campaignLength: 'short-campaign',
    customNpcs: [], companions: [], awayCompanions: [],
    continueCampaign: false, previousSessionSummaries: [],
    campaignNotes: '', characterMemories: '', usedNames: [],
    progression
  };
  const prompt = createDMSystemPrompt(minimalChar, sessionContext, null);
  assert(prompt.includes('CHARACTER PROGRESSION LAYER'), 'Progression section appears in full prompt');
  assert(prompt.includes('THEME: Soldier'), 'Theme renders');
  assert(prompt.includes('Military Rank'), 'Unlocked ability renders');
  assert(prompt.includes('NARRATION HOOK'), 'Narration hook renders');
}

console.log('\n=== Test 12: createDMSystemPrompt works without progression ===\n');
{
  const minimalChar = {
    id: 1, name: 'Test', first_name: 'Test', gender: 'male',
    race: 'elf', subrace: 'High Elf', class: 'wizard', subclass: 'Divination',
    level: 3, current_hp: 18, max_hp: 18, background: 'sage',
    ability_scores: JSON.stringify({ str: 8, dex: 14, con: 12, int: 17, wis: 12, cha: 10 }),
    inventory: '[]', skills: '[]', known_cantrips: '[]', known_spells: '[]',
    prepared_spells: '[]', feats: '[]', current_location: 'Waterdeep'
  };
  const sessionContext = {
    campaignModule: null,
    startingLocation: { id: 'waterdeep', name: 'Waterdeep', description: '', region: '', type: 'city' },
    era: { id: 'present', name: 'Present', years: '1492 DR', loreContext: '' },
    arrivalHook: null, customConcepts: null, campaignLength: 'short-campaign',
    customNpcs: [], companions: [], awayCompanions: [],
    continueCampaign: false, previousSessionSummaries: [],
    campaignNotes: '', characterMemories: '', usedNames: [],
    // No progression provided — simulates a character with no theme selected
  };
  const prompt = createDMSystemPrompt(minimalChar, sessionContext, null);
  assert(!prompt.includes('CHARACTER PROGRESSION LAYER'), 'No progression section when progression absent');
  assert(prompt.length > 0, 'Prompt still builds successfully');
}

console.log('\n' + '='.repeat(50));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

process.exit(failed > 0 ? 1 : 0);
