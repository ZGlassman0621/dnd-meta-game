/**
 * Atelier campaign → DM prompt wiring (2026-06-07).
 *
 * Verifies the full Begin-Campaign design reaches the DM system prompt:
 * premise, opening scene, region/setting, key locations, scope, the DM-only
 * hidden truth, and — most importantly — the table's content boundaries
 * (lines & veils), with the recency self-check reinforcement. Pure functions,
 * no DB or network.
 *
 * Run: node tests/dmPrompt-linesAndVeils.test.js
 */

import { createDMSystemPrompt, formatCampaignPlan } from '../server/services/dmPromptBuilder.js';

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ FAIL: ' + n); } };

// The shape getPlanSummaryForSession() produces for an atelier-authored plan.
const atelierSummary = {
  main_quest_title: 'The Debt of Snows',
  main_quest_summary: 'A mountain monastery once saved your life and named a price you never paid; now the monks have gone silent through a winter that came too early.',
  from_atelier: true,
  premise: 'A mountain monastery once saved your life and named a price you never paid.',
  opening_scene: 'Snow sifts through the broken shutters of the waystation as the fire gutters low and a stranger’s boots stop outside the door.',
  region: 'The Cinderpeak Reach',
  setting: { name: 'The Cinderpeak Reach', sub: 'high passes · a snowbound monastery road' },
  hidden_truth: 'The monks did not go silent — they were silenced by one of their own, who fears what the debt would reveal.',
  campaign_scope: 'arc',
  locations: ['The Waystation', "Saint Hald's Monastery", 'The Frozen Stair'],
  dm_notes: { tone: 'Mystery, Survival, Quiet dread' },
  lines_and_veils: [
    { topic: 'Harm to children', state: 'line' },
    { topic: 'Torture', state: 'veil' },
    { topic: 'Character death', state: 'open' }
  ]
};

function makeCharacter(overrides = {}) {
  return {
    name: 'TEST Hero', first_name: 'TEST', race: 'Human', class: 'Fighter', level: 5,
    hp: 45, max_hp: 45, ac: 16, gender: 'male', game_day: 100, game_hour: 10,
    ability_scores: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 8 },
    inventory: [], skills: [], feats: [], known_cantrips: [], known_spells: [],
    prepared_spells: [], equipment: {}, ...overrides
  };
}
function makeCtx(planSummary) {
  return {
    companions: [], awayCompanions: [], previousSessionSummaries: [],
    characterMemories: '', campaignNotes: '', continueCampaign: false,
    pendingDowntimeNarratives: [],
    worldState: { npcRelationships: [], npcEventEffects: [], currentGameDay: 100, factionStandings: [], visibleEvents: [], discoveredLocations: [], activeFactions: [] },
    campaignPlanSummary: planSummary
  };
}

// ── 1. formatCampaignPlan surfaces the whole atelier design ──────────────────
console.log('\n=== formatCampaignPlan (atelier plan) ===\n');
const plan = formatCampaignPlan(atelierSummary);

ok('renders a CONTENT BOUNDARIES block', plan.includes('CONTENT BOUNDARIES'));
ok('LINES list names the line topic (Harm to children)', /LINES[^]*Harm to children/.test(plan));
ok('VEILS list names the veil topic (Torture)', /VEILS[^]*Torture/.test(plan));

// "open" topics must NOT appear inside the boundaries block.
const cbBlock = plan.slice(plan.indexOf('CONTENT BOUNDARIES'), plan.indexOf('END CONTENT BOUNDARIES'));
ok('open topics are not listed as a boundary (Character death absent)', !cbBlock.includes('Character death'));
ok('boundaries are framed as overriding/non-negotiable', /NON-NEGOTIABLE/.test(plan) && /OVERRIDE/.test(plan));

ok('renders the SETTING line with descriptor', plan.includes('SETTING: The Cinderpeak Reach') && plan.includes('snowbound monastery road'));
ok('renders KEY LOCATIONS with the drafted names', plan.includes('KEY LOCATIONS') && plan.includes("Saint Hald's Monastery"));
ok('renders the OPENING SCENE prose', plan.includes('OPENING SCENE') && plan.includes('Snow sifts through the broken shutters'));
ok('renders the DM-ONLY hidden truth', plan.includes('THE HIDDEN TRUTH (DM-ONLY') && plan.includes('silenced by one of their own'));
ok('renders the campaign scope (short arc)', plan.includes('CAMPAIGN SCOPE') && plan.includes('SHORT ARC'));
ok('surfaces the premise as the main quest summary', plan.includes('A mountain monastery once saved your life'));
ok('surfaces the tone guidance', plan.includes('Quiet dread'));

// ── 2. Full system prompt includes boundaries + recency self-check ───────────
console.log('\n=== createDMSystemPrompt (atelier plan) ===\n');
const prompt = createDMSystemPrompt(makeCharacter(), makeCtx(atelierSummary));

ok('system prompt carries the CONTENT BOUNDARIES block', prompt.includes('CONTENT BOUNDARIES'));
ok('system prompt names the line topic', prompt.includes('Harm to children'));
ok('recency self-check includes the boundary check (item 6)', prompt.includes('DID I CROSS A CONTENT BOUNDARY'));
ok('system prompt carries the opening scene + hidden truth', prompt.includes('OPENING SCENE') && prompt.includes('THE HIDDEN TRUTH (DM-ONLY'));

// ── 3. Control: no boundaries set → no boundary reinforcement ────────────────
console.log('\n=== createDMSystemPrompt (no boundaries) ===\n');
const allOpen = { ...atelierSummary, lines_and_veils: [{ topic: 'Torture', state: 'open' }, { topic: 'Character death', state: 'open' }] };
const promptOpen = createDMSystemPrompt(makeCharacter(), makeCtx(allOpen));
ok('no CONTENT BOUNDARIES block when every topic is open', !promptOpen.includes('CONTENT BOUNDARIES'));
ok('no boundary self-check when every topic is open', !promptOpen.includes('DID I CROSS A CONTENT BOUNDARY'));

const noLv = { ...atelierSummary, lines_and_veils: null };
const promptNo = createDMSystemPrompt(makeCharacter(), makeCtx(noLv));
ok('no boundary self-check when lines_and_veils is absent', !promptNo.includes('DID I CROSS A CONTENT BOUNDARY'));
ok('atelier design still surfaces without boundaries (opening scene present)', promptNo.includes('OPENING SCENE'));

console.log(`\nAtelier → DM prompt: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
