/**
 * Begin Campaign end-to-end flow test (2026-06-06).
 * Exercises the real endpoints: create char → /campaign/draft (Opus) →
 * /campaign/begin → verify the campaign is created, planned, and linked →
 * cleanup. Skips /dm-session/start (heavy opening-gen Opus call).
 * Run with the server up on :3010.
 */
const BASE = 'http://localhost:3010/api';
const J = { 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const ok = (n, c) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n); } };

async function run() {
  let charId, campId;
  try {
    // 1) test character
    const cRes = await fetch(`${BASE}/character`, { method: 'POST', headers: J, body: JSON.stringify({
      first_name: 'TESTHero', class: 'fighter', creation_phase: 'active',
      ability_scores: JSON.stringify({ str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 })
    }) });
    charId = (await cRes.json()).id;
    ok('created test character', !!charId);

    // 2) draft (real Opus)
    const dRes = await fetch(`${BASE}/campaign/draft`, { method: 'POST', headers: J, body: JSON.stringify({
      subject: charId, characterId: charId, prompt: 'a heist in a city of clockwork and debt',
      dials: { scope: 'arc', tones: ['Heist'] }
    }) });
    const draft = (await dRes.json()).draft;
    ok('Opus drafted a campaign (title + locations + npcs + hiddenTruth)',
      !!(draft && draft.title && draft.locations?.length && draft.npcs?.length && draft.hiddenTruth && draft.openingScene && draft.opusMessage));
    console.log('     →', draft?.title, '|', draft?.locations?.length, 'locations,', draft?.npcs?.length, 'npcs');

    // 3) refine via a nudge (real Opus) — should keep continuity, return a new opusMessage
    const nRes = await fetch(`${BASE}/campaign/draft`, { method: 'POST', headers: J, body: JSON.stringify({
      priorDraft: draft, nudge: 'darker', characterId: charId, subject: charId
    }) });
    const refined = (await nRes.json()).draft;
    ok('nudge re-drafted (still valid)', !!(refined && refined.title && refined.opusMessage));

    // 4) begin — commit the draft (with the table's content boundaries)
    const linesAndVeils = [
      { topic: 'Harm to children', state: 'line' },
      { topic: 'Torture', state: 'veil' },
      { topic: 'Character death', state: 'open' },
      { topic: 'bogus', state: 'invalid' } // dropped by the server-side filter
    ];
    const bRes = await fetch(`${BASE}/campaign/begin`, { method: 'POST', headers: J, body: JSON.stringify({ characterId: charId, draft: refined, linesAndVeils }) });
    const begun = await bRes.json();
    campId = begun.campaignId;
    ok('begin created a campaign', !!campId);

    // 5) verify campaign + plan stored
    const campaign = await (await fetch(`${BASE}/campaign/${campId}`)).json();
    const plan = campaign.campaign_plan ? JSON.parse(campaign.campaign_plan) : null;
    ok('campaign name = draft title', campaign.name === refined.title);
    ok('plan stored from the atelier draft', plan?.generated_from === 'begin_campaign_atelier');
    ok('plan carries opening scene + hidden truth + locations',
      !!(plan?.opening_scene && plan?.hidden_truth && (plan?.locations || []).length));
    ok('plan persists the table lines & veils (invalid entries filtered)',
      Array.isArray(plan?.lines_and_veils) && plan.lines_and_veils.length === 3
      && plan.lines_and_veils.some(b => b.topic === 'Harm to children' && b.state === 'line'));

    // 5b) verify the DM-facing plan summary carries the atelier design — this is
    // the exact object that flows into the DM system prompt.
    const summary = await (await fetch(`${BASE}/campaign/${campId}/plan/summary`)).json();
    ok('plan summary flags the atelier origin', summary?.from_atelier === true);
    ok('plan summary carries premise + opening scene + hidden truth (the DM reads these)',
      !!(summary?.premise && summary?.opening_scene && summary?.hidden_truth));
    ok('plan summary carries the table lines & veils (3; invalid filtered)',
      Array.isArray(summary?.lines_and_veils) && summary.lines_and_veils.length === 3);

    // 6) verify character linked
    const character = await (await fetch(`${BASE}/character/${charId}`)).json();
    ok('character.campaign_id linked to the new campaign', Number(character.campaign_id) === Number(campId));
  } finally {
    if (campId) await fetch(`${BASE}/campaign/${campId}`, { method: 'DELETE' }).catch(() => {});
    if (charId) await fetch(`${BASE}/character/${charId}`, { method: 'DELETE' }).catch(() => {});
    console.log('  · cleaned up test character + campaign');
  }
  console.log(`\nBegin Campaign flow: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}
run().catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
