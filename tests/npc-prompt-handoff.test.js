/*
 * tests/npc-prompt-handoff.test.js — NPC-bank prompt handoff step.
 *
 * Pins (all against the real service + real temp DB + the real
 * prompt builder):
 *   - dealSessionNpcs [{profession:'apothecary'}], existing [] ->
 *     merged npcs contains exactly one row, Gwinear Pearce, with
 *     appearance/personality/hook from the bank
 *   - createDMSystemPrompt with that merged list -> prompt contains
 *     'Gwinear Pearce', 'Small, beady eyed, hairy',
 *     'Friendly, hesitant, artificial', 'Friend with fey', and the
 *     'CUSTOM NPCS' section header (appearance reaches the prompt via
 *     the Appearance line in formatCustomNpcs)
 *   - an existing customNpc passed in is preserved in the merged
 *     list and in the prompt
 *   - an unknown profession in bankDeals is listed in skipped and
 *     adds nothing to the prompt (no invented name)
 *   - dealing the same profession twice in one bankDeals list yields
 *     two different bank NPCs, both in the prompt
 */
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

const dbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dnd-npc-prompt-handoff-'));
process.chdir(dbDir);
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const dbModule = await import(pathToFileURL(path.join(REPO, 'server', 'database.js')).href);
await dbModule.initDatabase();

const svc = (p) => pathToFileURL(path.join(REPO, p)).href;
const { dealSessionNpcs } = await import(svc('server/services/npcBankService.js'));
const bank = await import(svc('server/data/npcBanks.js'));
const { createDMSystemPrompt } = await import(svc('server/services/dmPromptBuilder.js'));

const db = { dbGet: dbModule.dbGet, dbRun: dbModule.dbRun, dbAll: dbModule.dbAll };

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}
function group(name) {
  console.log(`\n== ${name}`);
}
const eq = (a, b) => a === b;
const contains = (hay, needle) => typeof hay === 'string' && hay.includes(needle);

const stubCharacter = {
  name: 'Test Hero',
  first_name: 'Test',
  gender: 'Male',
  race: 'Human',
  class: 'Fighter',
  level: 1,
  ability_scores: '{"str":10,"dex":10,"con":10,"int":10,"wis":10,"cha":10}',
  inventory: '[]',
  equipment: [],
  skills: '[]',
  feats: '[]',
  known_cantrips: '[]',
  known_spells: '[]',
  prepared_spells: '[]',
  languages: '[]',
  tool_proficiencies: '[]',
  current_hp: 10,
  max_hp: 10,
  current_location: 'Test Town',
  current_quest: null,
};

function promptFor(customNpcs) {
  return createDMSystemPrompt(stubCharacter, {
    startingLocation: { name: 'Test Town', description: 'A test town' },
    era: null,
    arrivalHook: null,
    customConcepts: '',
    campaignLength: 'ongoing',
    customNpcs,
    companions: [],
    awayCompanions: [],
  });
}

group('dealSessionNpcs: one apothecary, merged row from the bank');
const first = await dealSessionNpcs({ bankDeals: [{ profession: 'apothecary' }], existingNpcs: [], db });
assert(first.npcs.length === 1, `merged npcs has exactly one row, got ${first.npcs.length}`);
assert(first.dealt.length === 1, `dealt has exactly one entry, got ${first.dealt.length}`);
assert(first.skipped.length === 0, `skipped is empty, got ${JSON.stringify(first.skipped)}`);
const gwinear = first.npcs[0];
const bankApothecary = bank.npcsFor('apothecary');
assert(eq(gwinear.name, 'Gwinear Pearce'), `merged row is Gwinear Pearce, got ${gwinear && gwinear.name}`);
assert(eq(gwinear.distinguishing_features, 'Small, beady eyed, hairy'), 'merged row appearance = bank appearance');
assert(eq(gwinear.personality_trait_1, 'Friendly, hesitant, artificial'), 'merged row personality = bank personality');
assert(eq(gwinear.motivation, 'Friend with fey'), 'merged row motivation = bank hook');
assert(eq(gwinear.distinguishing_features, bankApothecary[0].appearance), 'merged row appearance byte-identical to bank entry');
assert(eq(gwinear.personality_trait_1, bankApothecary[0].personality), 'merged row personality byte-identical to bank entry');
assert(eq(gwinear.motivation, bankApothecary[0].hook), 'merged row hook byte-identical to bank entry');
assert(eq(gwinear.occupation, 'Apothecary'), 'merged row occupation is the profession key');

group('Prompt: dealt NPC appears in the DM system prompt');
const prompt1 = promptFor(first.npcs);
assert(typeof prompt1 === 'string' && prompt1.length > 0, 'createDMSystemPrompt returns a non-empty string');
assert(contains(prompt1, 'Gwinear Pearce'), 'prompt contains Gwinear Pearce');
assert(contains(prompt1, 'Small, beady eyed, hairy'), 'prompt contains the appearance');
assert(contains(prompt1, 'Friendly, hesitant, artificial'), 'prompt contains the personality');
assert(contains(prompt1, 'Friend with fey'), 'prompt contains the hook');
assert(contains(prompt1, 'CUSTOM NPCS'), 'prompt contains the CUSTOM NPCS section header');

group('Existing customNpc is preserved in the merged list and prompt');
const existing = {
  id: 999001,
  name: 'Existing Person',
  race: 'Human',
  gender: 'Female',
  occupation: 'Innkeeper',
  current_location: 'Test Town',
  relationship_to_party: 'neutral',
  campaign_availability: 'available',
  motivation: 'Wants a quiet life',
  personality_trait_1: 'Warm, chatty',
  distinguishing_features: 'Tall, grey hair',
  background_notes: 'Pre-existing test NPC',
};
const withExisting = await dealSessionNpcs({
  bankDeals: [{ profession: 'apothecary' }],
  existingNpcs: [existing],
  db,
});
assert(withExisting.npcs.length === 2, `merged list has existing + dealt, got ${withExisting.npcs.length}`);
assert(withExisting.npcs[0] === existing, 'existing customNpc is passed through untouched (same object, first)');
assert(withExisting.npcs.some((n) => n.name === 'Existing Person'), 'merged list still contains the existing NPC');
assert(withExisting.npcs.some((n) => n.name === 'John Atkinson'), 'second apothecary deal is John Atkinson, not a repeat of Gwinear');
const prompt2 = promptFor(withExisting.npcs);
assert(contains(prompt2, 'Existing Person'), 'prompt contains the existing NPC');
assert(contains(prompt2, 'John Atkinson'), 'prompt contains the dealt NPC alongside the existing one');

group('Unknown profession: skipped, adds nothing, invents nothing');
const unknown = await dealSessionNpcs({
  bankDeals: [{ profession: 'not-a-profession' }],
  existingNpcs: [],
  db,
});
assert(unknown.npcs.length === 0, `unknown deal adds no NPC, got ${unknown.npcs.length}`);
assert(unknown.dealt.length === 0, 'unknown deal reports no dealt NPC');
assert(unknown.skipped.length === 1, `unknown deal is listed in skipped, got ${JSON.stringify(unknown.skipped)}`);
assert(eq(unknown.skipped[0].profession, 'not-a-profession'), 'skipped records the requested profession');
assert(eq(unknown.skipped[0].reason, 'unknown'), `skipped reason is 'unknown', got ${unknown.skipped[0].reason}`);
const prompt3 = promptFor(unknown.npcs);
assert(!contains(prompt3, 'CUSTOM NPCS'), 'prompt for an empty NPC list has no CUSTOM NPCS section (nothing invented)');

group('Same profession twice: two different bank NPCs, both in prompt');
const twice = await dealSessionNpcs({
  bankDeals: [{ profession: 'apothecary' }, { profession: 'apothecary' }],
  existingNpcs: [],
  db,
});
assert(twice.npcs.length === 2, `two deals yield two rows, got ${twice.npcs.length}`);
assert(twice.dealt.length === 2, `two deals report two dealt NPCs, got ${twice.dealt.length}`);
assert(twice.skipped.length === 0, `no skips for two apothecary deals, got ${JSON.stringify(twice.skipped)}`);
assert(eq(twice.dealt[0].name, 'Cynthia Olipaphant'), `first of the pair is bank entry #3, got ${twice.dealt[0] && twice.dealt[0].name}`);
assert(eq(twice.dealt[1].name, 'Isabelle'), `second of the pair is bank entry #4, got ${twice.dealt[1] && twice.dealt[1].name}`);
assert(twice.dealt[0].name !== twice.dealt[1].name, 'the two deals are different people (no repeat)');
assert(twice.npcs[0].name !== twice.npcs[1].name, 'the two merged rows are different people');
const prompt4 = promptFor(twice.npcs);
assert(contains(prompt4, 'Cynthia Olipaphant'), 'prompt contains the first of the pair');
assert(contains(prompt4, 'Isabelle'), 'prompt contains the second of the pair');

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
