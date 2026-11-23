// tests/h1-teach-the-markers.test.js — H1: the DM is taught the markers of
// systems that already work (brief docs/pm/h1-teach-the-markers/BRIEF.md).
//
// What is pinned:
//   (a) every taught world / scene / lair / display marker appears in the
//       assembled DM prompt (createDMSystemPrompt, the real builder);
//   (b) every one of them survives lean mode (applyLeanTransforms);
//   (c) every taught example is VALID syntax: run through the real marker
//       validator (validateDmMarkers) it produces no correction failure —
//       the prompt never teaches a form the engine refuses;
//   (d) class-feature markers appear only where the feature is wired and
//       working, only for an actor who has the feature at their level;
//   (e) the seven not-working feature markers and EVOLVE_PLACE are taught
//       NOWHERE, for any subclass that holds them;
//   (f) the four artificer markers are on the artificer section;
//   (g) the ATTUNE / UNATTUNE teaching text is byte-identical to before
//       this job, and is now actually in the prompt (it had no caller);
//   (h) the schemas the teaching relies on are the fields the survey
//       recorded (teaching only — no schema changed).
//
// Run from the repo root: node tests/h1-teach-the-markers.test.js
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; } else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const fromRepo = (rel) => pathToFileURL(path.join(process.cwd(), rel)).href;
const { createDMSystemPrompt, applyLeanTransforms } = await import(fromRepo('server/services/dmPromptBuilder.js'));
const { validateDmMarkers, MARKER_SCHEMAS } = await import(fromRepo('server/services/markerSchemas.js'));
const { buildSubclassPromptSection } = await import(fromRepo('server/services/subclassService.js'));
const { attunementPromptSection, defaultAttunementState } = await import(fromRepo('server/services/attunementService.js'));
const { artificerPromptSection } = await import(fromRepo('server/services/artificerService.js'));

const ctx = (o = {}) => ({
  companions: [], awayCompanions: [],
  worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
  campaignPlanSummary: { setting: 'Forgotten Realms', tone: 'heroic' },
  previousSessionSummaries: [], characterMemories: '', campaignNotes: '', continueCampaign: false, pendingDowntimeNarratives: [], ...o,
});
const ch = (o = {}) => ({
  name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5, hp: 45, max_hp: 45, ac: 16,
  gender: 'male', game_day: 100, game_hour: 10,
  ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
  inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [], prepared_spells: [], equipment: {}, ...o,
});

const prompt = createDMSystemPrompt(ch(), ctx());
const lean = applyLeanTransforms(prompt);

// The taught world markers and the exact example each line carries.
const WORLD = {
  GENERATE_DUNGEON: '[GENERATE_DUNGEON: Name="Sunken Temple" Purpose="rescue" Region="Sword Coast" SiteEra="sealed"]',
  SET_ROOM: '[SET_ROOM: Name="Tavern common room" Features="Bar:cover_half:half, Fireplace:flammable" Exits="North:street"]',
  COLD_SCENE: '[COLD_SCENE: BaseLevel=2]',
  COLD_WET: '[COLD_WET: Target="Player" Status="wet"]',
  LAIR_CREATE: '[LAIR_CREATE: Lair="dragon-lair" Name="The Dragon\'s Lair" Features="Pillars:cover_half, Lava vent:hazard_zone"]',
  LAIR_DAMAGE: '[LAIR_DAMAGE: Lair="dragon-lair" Amount=40 Source="the fireball strikes the pillars"]',
  LAIR_STABILIZE: '[LAIR_STABILIZE: Lair="dragon-lair" Method="magic"]',
  LAIR_HAZARD_ROLL: '[LAIR_HAZARD_ROLL: Lair="dragon-lair"]',
  ENEMY_DISPLAY: '[ENEMY_DISPLAY: Enemy="Mage" Spell="Fireball" Target="the floor beside Lyra" Beside="Lyra"]',
};

// ===========================================================================
group('(a)+(b) each taught world marker is in the assembled prompt, and survives lean mode');
{
  check(prompt.includes('WORLD, SCENE & LAIR MARKERS'), 'the WORLD, SCENE & LAIR MARKERS section is in the prompt');
  for (const [key, example] of Object.entries(WORLD)) {
    check(prompt.includes(example), `${key}: its instruction is in the assembled prompt`);
    check(lean.includes(example), `${key}: its instruction survives lean mode`);
  }
  // The trigger rules the brief settled, stated in the line itself.
  check(/Never because the player asks for one/.test(prompt) && /never puts the party inside/.test(prompt),
    'GENERATE_DUNGEON: DM-world trigger only, never places the party inside (Zach 2026-11-02)');
  check(/add Justification=/.test(prompt), 'GENERATE_DUNGEON: an unusual place carries a Justification');
  check(/right after COMBAT_START/.test(prompt), 'SET_ROOM: emitted after COMBAT_START (the handler needs an active encounter)');
  check(/cold is real danger, never soften it/.test(prompt), 'COLD_SCENE: cold is a feature, never softened (pm-guide §3)');
  check(prompt.includes('[COLD_SCENE: BaseLevel=-10]'), 'COLD_SCENE: leaving the cold is taught');
  // The world section sits before MECHANICAL MARKERS (outside the strip).
  check(prompt.indexOf('WORLD, SCENE & LAIR MARKERS') < prompt.indexOf('\nMECHANICAL MARKERS\n'),
    'the section sits ahead of MECHANICAL MARKERS, where the lean strip cannot reach');
  check(lean.includes('The WORLD, SCENE & LAIR MARKERS section above, the attunement line and the class-feature marker lines also stay live.'),
    'the lean notice names the sections that stay live');
  check(lean.includes('EXCEPTION: [HP_CHANGE] is still live.'), 'the lean HP_CHANGE exception is unchanged');
  // Already-taught LAIR_ACTION untouched.
  check(prompt.includes('[LAIR_ACTION: Lair="Dragon\'s Lair" Effect="stalactites fall"]'), 'LAIR_ACTION (already taught) is still taught');
}

// ===========================================================================
group('(c) every taught example is valid syntax for the real validator');
{
  for (const [key, example] of Object.entries(WORLD)) {
    const v = validateDmMarkers(`Narration. ${example}`);
    const ok = (v.validByKey?.[key] || []).length === 1 && (v.failures || []).length === 0;
    check(ok, `${key}: the taught example validates with no correction (failures ${JSON.stringify(v.failures || [])})`);
  }
  const extra = ['[COLD_SCENE: BaseLevel=-10]', '[LAIR_STABILIZE: Lair="dragon-lair" Method="mechanical"]',
    '[COLD_WET: Target="Lyra" Status="dry"]', '[ENEMY_DISPLAY: Enemy="Mage" Spell="Fireball" Target="the floor" Intimidate=true Dc=14]',
    '[COLD_SCENE: BaseLevel=2 Campfire=true InsulatedTent=true Blizzard=true Elevation=1]'];
  for (const ex of extra) {
    const v = validateDmMarkers(ex);
    check((v.failures || []).length === 0, `taught variant validates: ${ex}`);
  }
}

// ===========================================================================
group('(d) working class-feature markers: shown only for an actor who has the feature');
{
  const life3 = createDMSystemPrompt(ch({ class: 'Cleric', subclass: 'Life Domain', level: 3 }), ctx());
  check(life3.includes('[PRESERVE_LIFE: Target="TEST Hero" Allocations="Mira=10, Bram=8"]'), 'Life Domain cleric L3: PRESERVE_LIFE is taught under the feature');
  check(applyLeanTransforms(life3).includes('[PRESERVE_LIFE:'), 'PRESERVE_LIFE survives lean mode');
  const life2 = createDMSystemPrompt(ch({ class: 'Cleric', subclass: 'Life Domain', level: 2 }), ctx());
  check(!life2.includes('[PRESERVE_LIFE:'), 'Life Domain cleric L2 (no feature yet): not taught');
  check(!prompt.includes('[PRESERVE_LIFE:'), 'a fighter is never taught PRESERVE_LIFE');
  const comps = buildSubclassPromptSection(ch(), [
    { name: 'Vex', companion_class: 'Sorcerer', companion_subclass: 'Aberrant Sorcery', companion_level: 3, progression_type: 'class_based' },
    { name: 'Orla', companion_class: 'Warlock', companion_subclass: 'Great Old One Patron', companion_level: 3, progression_type: 'class_based' },
  ]);
  check(comps.includes('[TELEPATHIC_SPEECH: Target="Vex" Creature="Name"]'), 'Aberrant Sorcery companion L3: TELEPATHIC_SPEECH taught, with the companion as Target');
  check(comps.includes('[AWAKENED_MIND: Target="Orla" Creature="Name"]'), 'Great Old One companion L3: AWAKENED_MIND taught');
  for (const ex of ['[PRESERVE_LIFE: Target="Mira" Allocations="Mira=10, Bram=8"]', '[TELEPATHIC_SPEECH: Target="Vex" Creature="Goblin"]', '[AWAKENED_MIND: Target="Orla" Creature="Goblin"]']) {
    check((validateDmMarkers(ex).failures || []).length === 0, `taught feature example validates: ${ex}`);
  }
}

// ===========================================================================
group('(e) not-working feature markers and EVOLVE_PLACE are taught nowhere');
{
  const NOT_TAUGHT = ['[HEROIC_REROLL', '[BEND_LUCK', '[TIDES_OF_CHAOS', '[TAMED_SURGE', '[HOUND_OF_ILL_OMEN', '[ACCURSED_SPECTER', '[FAITHFUL_SUMMONS', '[EVOLVE_PLACE'];
  const holders = [
    ch({ class: 'Sorcerer', subclass: 'Wild Magic Sorcery', level: 18 }),
    ch({ class: 'Sorcerer', subclass: 'Shadow Magic', level: 6 }),
    ch({ class: 'Warlock', subclass: 'Hexblade', level: 6 }),
    ch({ class: 'Druid', subclass: 'Circle of the Shepherd', level: 14 }),
    ch(),
  ];
  for (const c of holders) {
    const p = createDMSystemPrompt(c, ctx());
    for (const m of NOT_TAUGHT) check(!p.includes(m), `${c.subclass || c.class}: ${m} is not taught`);
  }
}

// ===========================================================================
group('(f) the four artificer markers are on the artificer section');
{
  const art5 = artificerPromptSection(null, { level: 5, intMod: 3 });
  for (const m of ['[ARTIFICER_REPLACE_PLAN: Old="Bag of Holding" Plan="Wand of Web"]', '[ARTIFICER_ATTUNE: Item="name"]', '[ARTIFICER_RIGHT_TOOL: Tool="Smith\'s Tools"]']) {
    check(art5.includes(m), `artificer L5 section teaches ${m}`);
  }
  const withSpell = artificerPromptSection({ ...null, plansKnown: [], createdItems: [], attunedExternal: [], storedSpell: { spell: 'Cure Wounds', usesLeft: 4 } }, { level: 11, intMod: 3 });
  check(withSpell.includes('[ARTIFICER_RELEASE: Turn="3"]'), 'artificer with a stored spell: ARTIFICER_RELEASE taught on the Spell-Storing line');
  check(!artificerPromptSection(null, { level: 2, intMod: 3 }).includes('[ARTIFICER_RIGHT_TOOL'), 'artificer L2: Right Tool (L3) not taught yet');
  check(!art5.includes('[ARTIFICER_RELEASE'), 'no stored spell: ARTIFICER_RELEASE not taught');
  const artPrompt = createDMSystemPrompt(ch({ class: 'Artificer', level: 5, ability_scores: { str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 8 } }), ctx());
  check(artPrompt.includes('[ARTIFICER_ATTUNE: Item="name"]') && applyLeanTransforms(artPrompt).includes('[ARTIFICER_ATTUNE:'),
    'the artificer lines reach the assembled prompt and survive lean mode');
  check(!artPrompt.includes('[ATTUNE: Target='), 'an artificer is pointed at ARTIFICER_ATTUNE, not the general ATTUNE line');
  for (const ex of ['[ARTIFICER_REPLACE_PLAN: Old="Bag of Holding" Plan="Wand of Web"]', '[ARTIFICER_ATTUNE: Item="Bag of Holding"]', '[ARTIFICER_RIGHT_TOOL: Tool="Smith\'s Tools"]', '[ARTIFICER_RELEASE: Turn="3"]']) {
    check((validateDmMarkers(ex).failures || []).length === 0, `taught artificer example validates: ${ex}`);
  }
}

// ===========================================================================
group('(g) ATTUNE / UNATTUNE: teaching text byte-identical, and now in the prompt');
{
  // The exact text attunementPromptSection produced before this job.
  const BEFORE = 'Attuned 0/3 — nothing attuned. Attune/unattune with [ATTUNE: Target="Name" Item="Item name"] / [UNATTUNE: Target="Name" Item="Item name"]; over-cap attunement is refused.';
  check(attunementPromptSection(defaultAttunementState(), { cap: 3 }) === BEFORE, 'attunementPromptSection output is byte-identical');
  check(prompt.includes(`- Attunement: ${BEFORE}`), 'the line is in the assembled prompt (it had no caller before)');
  check(lean.includes('[ATTUNE: Target="Name" Item="Item name"]'), 'the ATTUNE line survives lean mode');
  const thief = createDMSystemPrompt(ch({ class: 'Rogue', subclass: 'Thief', level: 13 }), ctx());
  check(/- Attunement: Attuned 0\/4/.test(thief), 'the cap comes from the engine (a level 13 Thief shows 4)');
}

// ===========================================================================
group('(h) the schemas the teaching relies on (teaching only — unchanged)');
{
  const fields = (k) => Object.entries(MARKER_SCHEMAS[k].fields).map(([f, v]) => f + (v.required ? '*' : '')).join(' ');
  const PIN = {
    GENERATE_DUNGEON: 'Name* Purpose Region SiteEra Location Justification RoomCount',
    SET_ROOM: 'Scene Room Name Features Exits',
    COLD_SCENE: 'BaseLevel Campfire InsulatedTent Blizzard MagicalBlizzard Elevation ForceGoliath',
    COLD_WET: 'Target* Status*',
    LAIR_CREATE: 'Lair* Name MaxHp Features Exits Scene Room',
    LAIR_DAMAGE: 'Lair* Amount* Source',
    LAIR_STABILIZE: 'Lair* Method* Amount',
    LAIR_HAZARD_ROLL: 'Lair*',
    ENEMY_DISPLAY: 'Enemy* Spell* Level Target* Intimidate Dc Beside Features',
    PRESERVE_LIFE: 'Target* Allocations*',
    TELEPATHIC_SPEECH: 'Target* Creature*',
    AWAKENED_MIND: 'Target* Creature*',
    ARTIFICER_REPLACE_PLAN: 'Target Old* Plan* Detail',
    ARTIFICER_ATTUNE: 'Target Item*',
    ARTIFICER_RIGHT_TOOL: 'Target Tool*',
    ARTIFICER_RELEASE: 'Target Turn*',
  };
  for (const [k, want] of Object.entries(PIN)) check(fields(k) === want, `${k} schema fields as surveyed (got ${fields(k)})`);
}

console.log(`\nh1-teach-the-markers: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
