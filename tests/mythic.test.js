/**
 * Mythic Progression System Tests — Coverage for config data, marker detection,
 * service logic, piety system, epic boons, and legendary items.
 */

import {
  MYTHIC_TIERS,
  MYTHIC_PATHS,
  EPIC_BOONS,
  PIETY_DEITIES,
  SHADOW_PATH_INTERACTION,
  getMythicTierInfo,
  getBaseAbilitiesForTier,
  getPathInfo,
  getPathAbilitiesForTier,
  getAllPathAbilitiesFlat,
  getDeityPiety,
  getPietyThreshold,
  getEpicBoon,
  getMythicPowerMax,
  getSurgeDie,
  canSelectPath,
  isLegendPath,
  getTrialsRequired,
  getPlayerSelectablePaths,
  getShadowCategory,
  BASE_MYTHIC_ABILITIES
} from '../server/config/mythicProgression.js';

import {
  detectMythicTrial,
  detectPietyChange,
  detectItemAwaken,
  detectMythicSurge
} from '../server/services/dmSessionService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  \u2713 ${message}`);
    passed++;
  } else {
    console.log(`  \u2717 FAIL: ${message}`);
    failed++;
  }
}

// ============================================================
// 1. MYTHIC_TIERS — Basic Structure
// ============================================================
console.log('\n=== Test 1: MYTHIC_TIERS Structure ===\n');

assert(Array.isArray(MYTHIC_TIERS), 'MYTHIC_TIERS is an array');
assert(MYTHIC_TIERS.length === 5, `Exactly 5 tiers (found ${MYTHIC_TIERS.length})`);

for (const tier of MYTHIC_TIERS) {
  assert(tier.tier >= 1 && tier.tier <= 5, `Tier ${tier.tier} has valid tier number`);
  assert(typeof tier.name === 'string' && tier.name.length > 0, `Tier ${tier.tier} has a name`);
  assert(typeof tier.trialsRequired === 'number', `Tier ${tier.tier} has trialsRequired`);
  assert(typeof tier.surgeDie === 'string', `Tier ${tier.tier} has surgeDie`);
  assert(typeof tier.mythicPowerBase === 'number', `Tier ${tier.tier} has mythicPowerBase`);
}

// Verify tier names
assert(MYTHIC_TIERS[0].name === 'Touched by Legend', 'Tier 1 is "Touched by Legend"');
assert(MYTHIC_TIERS[4].name === 'Apotheosis', 'Tier 5 is "Apotheosis"');

// Verify surge die progression
assert(MYTHIC_TIERS[0].surgeDie === 'd6', 'Tier 1 surge die is d6');
assert(MYTHIC_TIERS[2].surgeDie === 'd8', 'Tier 3 surge die is d8');
assert(MYTHIC_TIERS[3].surgeDie === 'd10', 'Tier 4 surge die is d10');
assert(MYTHIC_TIERS[4].surgeDie === 'd12', 'Tier 5 surge die is d12');

// Verify mythic power progression: 3 + (2 * tier)
assert(MYTHIC_TIERS[0].mythicPowerBase === 5, 'Tier 1 power = 5 (3+2*1)');
assert(MYTHIC_TIERS[1].mythicPowerBase === 7, 'Tier 2 power = 7 (3+2*2)');
assert(MYTHIC_TIERS[4].mythicPowerBase === 13, 'Tier 5 power = 13 (3+2*5)');

// Verify trials: 1, 2, 3, 4, 1-definitive
assert(MYTHIC_TIERS[0].trialsRequired === 1, 'Tier 1 needs 1 trial');
assert(MYTHIC_TIERS[1].trialsRequired === 2, 'Tier 2 needs 2 trials');
assert(MYTHIC_TIERS[2].trialsRequired === 3, 'Tier 3 needs 3 trials');
assert(MYTHIC_TIERS[3].trialsRequired === 4, 'Tier 4 needs 4 trials');
assert(MYTHIC_TIERS[4].trialsRequired === 1, 'Tier 5 needs 1 definitive trial');

// ============================================================
// 2. BASE_MYTHIC_ABILITIES — Universal Abilities
// ============================================================
console.log('\n=== Test 2: BASE_MYTHIC_ABILITIES ===\n');

assert(BASE_MYTHIC_ABILITIES !== undefined, 'BASE_MYTHIC_ABILITIES exists');

// Tier 1 should have mythic_power, surge, hard_to_kill, mythic_presence
const tier1Base = getBaseAbilitiesForTier(1);
assert(tier1Base.length >= 4, `Tier 1 has at least 4 base abilities (found ${tier1Base.length})`);
const tier1Keys = tier1Base.map(a => a.key);
assert(tier1Keys.includes('mythic_power'), 'Tier 1 includes mythic_power');
assert(tier1Keys.includes('surge'), 'Tier 1 includes surge');
assert(tier1Keys.includes('hard_to_kill'), 'Tier 1 includes hard_to_kill');
assert(tier1Keys.includes('mythic_presence'), 'Tier 1 includes mythic_presence');

// Tier 2 should add amazing_initiative, recuperation
const tier2Base = getBaseAbilitiesForTier(2);
assert(tier2Base.length >= 6, `Tier 2 has at least 6 cumulative base abilities (found ${tier2Base.length})`);
const tier2Keys = tier2Base.map(a => a.key);
assert(tier2Keys.includes('amazing_initiative'), 'Tier 2 includes amazing_initiative');
assert(tier2Keys.includes('recuperation'), 'Tier 2 includes recuperation');

// Tier 5 should have all 13 abilities
const tier5Base = getBaseAbilitiesForTier(5);
assert(tier5Base.length >= 13, `Tier 5 has at least 13 cumulative base abilities (found ${tier5Base.length})`);
const tier5Keys = tier5Base.map(a => a.key);
assert(tier5Keys.includes('immortal'), 'Tier 5 includes immortal');
assert(tier5Keys.includes('legendary_hero'), 'Tier 5 includes legendary_hero');
assert(tier5Keys.includes('unstoppable'), 'Tier 5 includes unstoppable');
assert(tier5Keys.includes('mythic_resistance'), 'Tier 5 includes mythic_resistance');

// Each ability should have required fields
for (const ability of tier5Base) {
  assert(typeof ability.key === 'string', `Ability ${ability.key} has key`);
  assert(typeof ability.name === 'string', `Ability ${ability.key} has name`);
  assert(typeof ability.description === 'string', `Ability ${ability.key} has description`);
  assert(typeof ability.tier === 'number', `Ability ${ability.key} has tier`);
}

// ============================================================
// 3. MYTHIC_PATHS — All 12 Player Paths
// ============================================================
console.log('\n=== Test 3: MYTHIC_PATHS ===\n');

assert(typeof MYTHIC_PATHS === 'object', 'MYTHIC_PATHS is an object');

const EXPECTED_PLAYER_PATHS = [
  'hierophant', 'angel', 'aeon', 'azata', 'gold_dragon',
  'lich', 'demon', 'devil', 'trickster', 'legend', 'redemption', 'corrupted_dawn'
];

const EXPECTED_DM_PATHS = ['beast_dark_hunt', 'swarm'];

for (const pathKey of EXPECTED_PLAYER_PATHS) {
  const path = MYTHIC_PATHS[pathKey];
  assert(path !== undefined, `Path "${pathKey}" exists`);
  if (path) {
    assert(typeof path.name === 'string', `Path ${pathKey} has name`);
    assert(typeof path.key === 'string', `Path ${pathKey} has key`);
    assert(typeof path.coreTheme === 'string', `Path ${pathKey} has coreTheme`);
    assert(path.abilities !== undefined, `Path ${pathKey} has abilities`);
  }
}

// DM-only paths
for (const pathKey of EXPECTED_DM_PATHS) {
  const path = MYTHIC_PATHS[pathKey];
  assert(path !== undefined, `DM path "${pathKey}" exists`);
  if (path) {
    assert(path.isDmOnly === true, `Path ${pathKey} is DM-only`);
    assert(path.isPlayerSelectable === false, `Path ${pathKey} is not player-selectable`);
  }
}

// Player-selectable paths
const selectablePaths = getPlayerSelectablePaths();
assert(selectablePaths.length >= 10, `At least 10 player-selectable paths (found ${selectablePaths.length})`);
const selectableKeys = selectablePaths.map(p => p.key);
assert(!selectableKeys.includes('corrupted_dawn'), 'Corrupted Dawn is NOT player-selectable');
assert(!selectableKeys.includes('beast_dark_hunt'), 'Beast/Dark Hunt is NOT player-selectable');
assert(!selectableKeys.includes('swarm'), 'Swarm is NOT player-selectable');

// ============================================================
// 4. Path Abilities — 3 per tier, 15 total per path
// ============================================================
console.log('\n=== Test 4: Path Abilities Count ===\n');

const NON_LEGEND_PATHS = EXPECTED_PLAYER_PATHS.filter(k => k !== 'legend');

for (const pathKey of NON_LEGEND_PATHS) {
  const allAbilities = getAllPathAbilitiesFlat(pathKey);
  if (allAbilities) {
    assert(allAbilities.length >= 10, `Path ${pathKey} has at least 10 abilities (found ${allAbilities.length})`);
    // Check each ability has required fields
    for (const ability of allAbilities) {
      assert(typeof ability.key === 'string', `${pathKey} ability has key: ${ability.key}`);
      assert(typeof ability.name === 'string', `${pathKey} ability ${ability.key} has name`);
      assert(typeof ability.description === 'string', `${pathKey} ability ${ability.key} has description`);
    }
  }
}

// Legend path is special — no traditional abilities
assert(isLegendPath('legend'), 'legend is identified as Legend path');
assert(!isLegendPath('hierophant'), 'hierophant is NOT Legend path');

// ============================================================
// 5. Hierophant Path — Detailed Check
// ============================================================
console.log('\n=== Test 5: Hierophant Path Detail ===\n');

const hierophant = getPathInfo('hierophant');
assert(hierophant !== null, 'Hierophant path exists');
assert(hierophant.name === 'Hierophant', 'Hierophant name is correct');
assert(hierophant.isPlayerSelectable === true, 'Hierophant is player-selectable');

const hierT1 = getPathAbilitiesForTier('hierophant', 1);
assert(hierT1.length >= 3, `Hierophant Tier 1 has at least 3 abilities (found ${hierT1.length})`);
const hierT1Keys = hierT1.map(a => a.key);
assert(hierT1Keys.includes('divine_surge'), 'Hierophant T1 has divine_surge');
assert(hierT1Keys.includes('radiant_presence'), 'Hierophant T1 has radiant_presence');
assert(hierT1Keys.includes('dawns_blessing'), 'Hierophant T1 has dawns_blessing');

const hierT5 = getPathAbilitiesForTier('hierophant', 5);
assert(hierT5.length >= 15, `Hierophant cumulative Tier 5 has 15+ abilities (found ${hierT5.length})`);
const hierT5Keys = hierT5.map(a => a.key);
assert(hierT5Keys.includes('deitys_herald'), 'Hierophant T5 has deitys_herald');

// ============================================================
// 6. Helper Functions
// ============================================================
console.log('\n=== Test 6: Helper Functions ===\n');

// getMythicTierInfo
assert(getMythicTierInfo(1).name === 'Touched by Legend', 'getMythicTierInfo(1) works');
assert(getMythicTierInfo(5).name === 'Apotheosis', 'getMythicTierInfo(5) works');
assert(getMythicTierInfo(0) === null || getMythicTierInfo(0) === undefined, 'getMythicTierInfo(0) returns null/undefined');
assert(getMythicTierInfo(6) === null || getMythicTierInfo(6) === undefined, 'getMythicTierInfo(6) returns null/undefined');

// getMythicPowerMax
assert(getMythicPowerMax(1) === 5, 'getMythicPowerMax(1) = 5');
assert(getMythicPowerMax(3) === 9, 'getMythicPowerMax(3) = 9');
assert(getMythicPowerMax(5) === 13, 'getMythicPowerMax(5) = 13');

// getSurgeDie
assert(getSurgeDie(1) === 'd6', 'getSurgeDie(1) = d6');
assert(getSurgeDie(3) === 'd8', 'getSurgeDie(3) = d8');
assert(getSurgeDie(5) === 'd12', 'getSurgeDie(5) = d12');

// getTrialsRequired
assert(getTrialsRequired(1) === 1, 'getTrialsRequired(1) = 1');
assert(getTrialsRequired(3) === 3, 'getTrialsRequired(3) = 3');
assert(getTrialsRequired(5) === 1, 'getTrialsRequired(5) = 1');

// getShadowCategory
assert(getShadowCategory('hierophant') === 'light', 'Hierophant is light');
assert(getShadowCategory('angel') === 'light', 'Angel is light');
assert(getShadowCategory('demon') === 'dark', 'Demon is dark');
assert(getShadowCategory('lich') === 'dark', 'Lich is dark');
assert(getShadowCategory('aeon') === 'neutral', 'Aeon is neutral');
assert(getShadowCategory('trickster') === 'neutral', 'Trickster is neutral');
assert(getShadowCategory('legend') === 'neutral', 'Legend is neutral');

// canSelectPath — light paths need shadow <= 2
assert(canSelectPath('hierophant', 0) === true, 'Can select Hierophant at shadow 0');
assert(canSelectPath('hierophant', 2) === true, 'Can select Hierophant at shadow 2');
assert(canSelectPath('hierophant', 6) === false, 'Cannot select Hierophant at shadow 6');
assert(canSelectPath('demon', 10) === true, 'Can select Demon at any shadow');
assert(canSelectPath('legend', 5) === true, 'Can select Legend at any shadow');

// ============================================================
// 7. EPIC_BOONS
// ============================================================
console.log('\n=== Test 7: EPIC_BOONS ===\n');

assert(Array.isArray(EPIC_BOONS), 'EPIC_BOONS is an array');
assert(EPIC_BOONS.length === 12, `Exactly 12 epic boons (found ${EPIC_BOONS.length})`);

const expectedBoonKeys = [
  'combat_prowess', 'dimensional_travel', 'energy_resistance', 'fate',
  'fortitude', 'irresistible_offense', 'recovery', 'skill',
  'speed', 'spell_recall', 'truesight', 'night_spirit'
];

for (const key of expectedBoonKeys) {
  const boon = getEpicBoon(key);
  assert(boon !== null && boon !== undefined, `Epic boon "${key}" exists`);
  if (boon) {
    assert(typeof boon.name === 'string', `Boon ${key} has name`);
    assert(typeof boon.description === 'string', `Boon ${key} has description`);
    assert(typeof boon.mechanicalEffect === 'string', `Boon ${key} has mechanicalEffect`);
  }
}

// ============================================================
// 8. PIETY_DEITIES
// ============================================================
console.log('\n=== Test 8: PIETY_DEITIES ===\n');

assert(typeof PIETY_DEITIES === 'object', 'PIETY_DEITIES is an object');

// Lathander
const lathander = getDeityPiety('lathander');
assert(lathander !== null && lathander !== undefined, 'Lathander deity exists');
if (lathander) {
  assert(lathander.name === 'Lathander', 'Lathander name is correct');
  assert(Array.isArray(lathander.increases), 'Lathander has increases array');
  assert(Array.isArray(lathander.decreases), 'Lathander has decreases array');
  assert(lathander.increases.length >= 3, 'Lathander has at least 3 increases');
  assert(lathander.decreases.length >= 3, 'Lathander has at least 3 decreases');
  assert(lathander.thresholds !== undefined, 'Lathander has thresholds');
  assert(lathander.thresholds[3] !== undefined, 'Lathander has threshold at 3');
  assert(lathander.thresholds[10] !== undefined, 'Lathander has threshold at 10');
  assert(lathander.thresholds[25] !== undefined, 'Lathander has threshold at 25');
  assert(lathander.thresholds[50] !== undefined, 'Lathander has threshold at 50');
}

// Malar
const malar = getDeityPiety('malar');
assert(malar !== null && malar !== undefined, 'Malar deity exists');
if (malar) {
  assert(malar.name === 'Malar', 'Malar name is correct');
  assert(malar.thresholds[3] !== undefined, 'Malar has threshold at 3');
}

// getPietyThreshold
const threshold2 = getPietyThreshold('lathander', 2);
assert(threshold2 === null || threshold2 === undefined || threshold2.threshold === 0, 'Score 2 has no threshold unlocked');

const threshold5 = getPietyThreshold('lathander', 5);
assert(threshold5 !== null && threshold5 !== undefined, 'Score 5 unlocks threshold');
if (threshold5) {
  assert(threshold5.threshold === 3, 'Score 5 highest threshold is 3');
}

const threshold30 = getPietyThreshold('lathander', 30);
assert(threshold30 !== null && threshold30 !== undefined, 'Score 30 unlocks threshold');
if (threshold30) {
  assert(threshold30.threshold === 25, 'Score 30 highest threshold is 25');
}

const threshold55 = getPietyThreshold('lathander', 55);
assert(threshold55 !== null && threshold55 !== undefined, 'Score 55 unlocks threshold');
if (threshold55) {
  assert(threshold55.threshold === 50, 'Score 55 highest threshold is 50');
}

// ============================================================
// 9. SHADOW_PATH_INTERACTION
// ============================================================
console.log('\n=== Test 9: SHADOW_PATH_INTERACTION ===\n');

assert(typeof SHADOW_PATH_INTERACTION === 'object', 'SHADOW_PATH_INTERACTION exists');
assert(SHADOW_PATH_INTERACTION.light !== undefined, 'Light category exists');
assert(SHADOW_PATH_INTERACTION.dark !== undefined, 'Dark category exists');
assert(SHADOW_PATH_INTERACTION.neutral !== undefined, 'Neutral category exists');

assert(SHADOW_PATH_INTERACTION.light.paths.includes('hierophant'), 'Hierophant is light');
assert(SHADOW_PATH_INTERACTION.light.paths.includes('angel'), 'Angel is light');
assert(SHADOW_PATH_INTERACTION.light.paths.includes('redemption'), 'Redemption is light');
assert(SHADOW_PATH_INTERACTION.dark.paths.includes('demon'), 'Demon is dark');
assert(SHADOW_PATH_INTERACTION.dark.paths.includes('lich'), 'Lich is dark');
assert(SHADOW_PATH_INTERACTION.neutral.paths.includes('aeon'), 'Aeon is neutral');
assert(SHADOW_PATH_INTERACTION.neutral.paths.includes('trickster'), 'Trickster is neutral');

assert(SHADOW_PATH_INTERACTION.light.fullPowerMaxShadow === 2, 'Light full power max shadow is 2');
assert(SHADOW_PATH_INTERACTION.light.weakenedMaxShadow === 5, 'Light weakened max shadow is 5');

// ============================================================
// 10. detectMythicTrial — Marker Detection
// ============================================================
console.log('\n=== Test 10: detectMythicTrial ===\n');

const trial1 = detectMythicTrial('The hero stood firm. [MYTHIC_TRIAL: Name="The Bridge of Dawn" Description="Held the bridge alone against the horde" Outcome="passed"] The world changed.');
assert(trial1 !== null, 'Detects MYTHIC_TRIAL marker');
assert(trial1.name === 'The Bridge of Dawn', 'Parses trial name');
assert(trial1.description === 'Held the bridge alone against the horde', 'Parses trial description');
assert(trial1.outcome === 'passed', 'Parses outcome');

const trial2 = detectMythicTrial('[MYTHIC_TRIAL: Name="Failed Test" Description="Could not resist the temptation" Outcome="failed"]');
assert(trial2 !== null, 'Detects failed trial');
assert(trial2.outcome === 'failed', 'Parses failed outcome');

const trial3 = detectMythicTrial('[MYTHIC_TRIAL: Name="Path Shift" Outcome="redirected"]');
assert(trial3 !== null, 'Detects trial with minimal fields');
assert(trial3.outcome === 'redirected', 'Parses redirected outcome');

const trialNone = detectMythicTrial('No mythic trial markers in this narrative.');
assert(trialNone === null, 'Returns null for no marker');

// ============================================================
// 11. detectPietyChange — Marker Detection
// ============================================================
console.log('\n=== Test 11: detectPietyChange ===\n');

const piety1 = detectPietyChange('[PIETY_CHANGE: Deity="Lathander" Amount=1 Reason="Protected the innocent"]');
assert(Array.isArray(piety1), 'Returns array');
assert(piety1.length === 1, 'Finds one piety change');
assert(piety1[0].deity === 'Lathander', 'Parses deity name');
assert(piety1[0].amount === 1, 'Parses amount as integer');
assert(piety1[0].reason === 'Protected the innocent', 'Parses reason');

// Multiple piety changes
const piety2 = detectPietyChange('Something happened. [PIETY_CHANGE: Deity="Lathander" Amount=1 Reason="Good deed"] And later [PIETY_CHANGE: Deity="Malar" Amount=-1 Reason="Defied the hunt"]');
assert(piety2.length === 2, 'Finds two piety changes');
assert(piety2[1].deity === 'Malar', 'Second change has correct deity');
assert(piety2[1].amount === -1, 'Parses negative amount');

const pietyNone = detectPietyChange('No piety changes here.');
assert(pietyNone.length === 0, 'Returns empty array for no markers');

// ============================================================
// 12. detectItemAwaken — Marker Detection
// ============================================================
console.log('\n=== Test 12: detectItemAwaken ===\n');

const item1 = detectItemAwaken('[ITEM_AWAKEN: Item="Dawn\'s Light" NewState="awakened" Deed="Struck down the shadow demon lord"]');
assert(item1 !== null, 'Detects ITEM_AWAKEN marker');
assert(item1.item === "Dawn's Light", 'Parses item name with apostrophe');
assert(item1.newState === 'awakened', 'Parses new state');
assert(item1.deed === 'Struck down the shadow demon lord', 'Parses deed');

const item2 = detectItemAwaken('[ITEM_AWAKEN: Item="Holy Avenger" NewState="exalted" Deed="Banished an archfiend"]');
assert(item2 !== null, 'Detects exalted state');
assert(item2.newState === 'exalted', 'Parses exalted state');

const itemNone = detectItemAwaken('No item awakening here.');
assert(itemNone === null, 'Returns null for no marker');

// ============================================================
// 13. detectMythicSurge — Marker Detection
// ============================================================
console.log('\n=== Test 13: detectMythicSurge ===\n');

const surge1 = detectMythicSurge('[MYTHIC_SURGE: Ability="divine_surge" Cost=1]');
assert(surge1 !== null, 'Detects MYTHIC_SURGE marker');
assert(surge1.ability === 'divine_surge', 'Parses ability name');
assert(surge1.cost === 1, 'Parses cost as integer');

const surge2 = detectMythicSurge('[MYTHIC_SURGE: Ability="surge" Cost=2]');
assert(surge2 !== null, 'Detects surge with cost 2');
assert(surge2.cost === 2, 'Parses cost 2');

const surgeNone = detectMythicSurge('No surge markers.');
assert(surgeNone === null, 'Returns null for no marker');

// ============================================================
// 14. Path-Specific Checks — Key Paths
// ============================================================
console.log('\n=== Test 14: Path-Specific Checks ===\n');

// Angel path
const angel = getPathInfo('angel');
assert(angel !== null, 'Angel path exists');
assert(angel.isPlayerSelectable === true, 'Angel is player-selectable');
const angelT1 = getPathAbilitiesForTier('angel', 1);
assert(angelT1.length >= 3, 'Angel Tier 1 has at least 3 abilities');
const angelKeys = angelT1.map(a => a.key);
assert(angelKeys.includes('angelic_weapon'), 'Angel T1 has angelic_weapon');

// Demon path
const demon = getPathInfo('demon');
assert(demon !== null, 'Demon path exists');
const demonT1 = getPathAbilitiesForTier('demon', 1);
assert(demonT1.length >= 3, 'Demon Tier 1 has at least 3 abilities');
const demonKeys = demonT1.map(a => a.key);
assert(demonKeys.includes('demonic_rage'), 'Demon T1 has demonic_rage');

// Trickster path
const trickster = getPathInfo('trickster');
assert(trickster !== null, 'Trickster path exists');
const tricksterT1 = getPathAbilitiesForTier('trickster', 1);
assert(tricksterT1.length >= 3, 'Trickster Tier 1 has at least 3 abilities');
const tricksterKeys = tricksterT1.map(a => a.key);
assert(tricksterKeys.includes('supernatural_luck'), 'Trickster T1 has supernatural_luck');

// Corrupted Dawn — NOT player-selectable
const corrupted = getPathInfo('corrupted_dawn');
assert(corrupted !== null, 'Corrupted Dawn path exists');
assert(corrupted.isPlayerSelectable === false, 'Corrupted Dawn is NOT player-selectable');

// Legend path — special: extra class levels
const legend = getPathInfo('legend');
assert(legend !== null, 'Legend path exists');
assert(legend.isPlayerSelectable === true, 'Legend is player-selectable');

// ============================================================
// 15. All Paths Have 5 Tiers of Abilities
// ============================================================
console.log('\n=== Test 15: All Paths Have 5 Tiers ===\n');

for (const pathKey of Object.keys(MYTHIC_PATHS)) {
  const path = MYTHIC_PATHS[pathKey];
  if (path.abilities) {
    const tiers = Object.keys(path.abilities);
    assert(tiers.length >= 5, `Path ${pathKey} has abilities for 5 tiers (found ${tiers.length})`);
    for (const tierKey of ['tier1', 'tier2', 'tier3', 'tier4', 'tier5']) {
      const tierAbilities = path.abilities[tierKey];
      if (tierAbilities) {
        assert(Array.isArray(tierAbilities), `Path ${pathKey} ${tierKey} abilities is an array`);
        assert(tierAbilities.length >= 1, `Path ${pathKey} ${tierKey} has at least 1 ability (found ${tierAbilities.length})`);
      }
    }
  }
}

// ============================================================
// SUMMARY
// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`\nMythic Progression Tests: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
