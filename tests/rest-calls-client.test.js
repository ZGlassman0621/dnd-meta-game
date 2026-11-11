// tests/rest-calls-client.test.js — Job B (rest calls) CLIENT side
// (2026-11-08): the companion rest route POST /api/companion/:id/rest is
// deleted and its effects ported into the DM rest path; downtime slot
// restore moves server-side behind POST /api/downtime/complete/:id.
//
// What this pins:
//   - CompanionSheet.jsx: the Long/Short Rest buttons and `handleRest`
//     are GONE (same pattern as the sheet rest button removal in the
//     rest-consolidation job). Their titles ("Restore full HP and all
//     spell slots", "Restore 50% missing HP (+pact slots for warlocks)")
//     were false under the DM path (short rests heal via hit dice only)
//     and go with the buttons, not onto a surviving button.
//   - The single-slot `restoreSpellSlot` (+1 restore, staying
//     /:id/spell-slots/restore route) and the "Convert to Class-Based"
//     button are untouched.
//   - The post-rest refresh is RE-POINTED, not just deleted: the sheet's
//     existing refresh paths re-read companion state whenever the
//     companion prop changes — the Phase 7 conditions/death-saves effect
//     is already keyed on companion_current_hp, and the spell-slots
//     effect now is too, so a DM rest that heals/restores slots and
//     reaches the sheet as a new prop refreshes all three. (There is no
//     DM-turn hook in this sheet: it never mounts during a DM session —
//     it is rendered by CompanionsPage / CompanionManager, while the DM
//     rest happens in DMSession — so reopening the sheet after a DM
//     rest remounts it and the mount fetch reads fresh state. Residual
//     gap, recorded not hidden: a companion at FULL HP with a condition
//     takes a DM long rest, the condition clears server-side, HP does
//     not change, and an already-open sheet shows the stale condition
//     until remount / next HP change.)
//   - Downtime.jsx: NO change — it still calls /complete/:id exactly
//     as today, makes no direct slot write, and never calls the
//     companion rest route.
//   - DMSession.jsx: NO change to the local-only long-rest clearing
//     (display question, still fires even if the DM declines the rest
//     in fiction) and no call to the companion rest route anywhere in
//     its 3,212 lines. takeRest stays re-pointed at the DM turn.
//   - No client file under client/src still fetches the deleted
//     companion rest route (recursive static scan).
//   - A real esbuild bundle of CompanionSheet.jsx (react stubbed) — a
//     broken named import fails the bundle, not a runtime render the
//     tests never see.
//
// Honest integration tests: the live files are read, never
// re-implemented. No DB, no HTTP: the companion rest port itself is
// exercised in tests/rest-time.test.js and tests/integration.test.js
// (server worker). Footer is the runner-matching `Results:` form so
// the count aggregates.
//
// Run from the repo root: node tests/rest-calls-client.test.js
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = process.cwd();
const readRepo = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-calls-client-test-'));

const sheetSrc = readRepo('client/src/components/CompanionSheet.jsx');
const dmSrc = readRepo('client/src/components/DMSession.jsx');
const downtimeSrc = readRepo('client/src/components/Downtime.jsx');

// The spell-slots effect, bounded by the function that follows it, so
// the dep pins judge that effect and not the Phase 7 effect below it.
const slotsEffectStart = sheetSrc.indexOf('fetch(`/api/companion/${companion.id}/spell-slots`)');
const slotsEffectEnd = sheetSrc.indexOf('const refetchSpellSlots', slotsEffectStart);
const slotsEffect = slotsEffectStart >= 0 && slotsEffectEnd > slotsEffectStart
  ? sheetSrc.slice(slotsEffectStart, slotsEffectEnd)
  : '';

// takeRest's body, bounded by the function that follows it — so the
// pins judge the rest flow itself, not stray matches elsewhere in the
// file (the downtime flow, the combat-end handler, comments).
const takeRestStart = dmSrc.indexOf('const takeRest = async (restType)');
const takeRestEnd = dmSrc.indexOf('const toggleCondition', takeRestStart);
const takeRest = takeRestStart >= 0 && takeRestEnd > takeRestStart
  ? dmSrc.slice(takeRestStart, takeRestEnd)
  : '';

// (a) CompanionSheet: the rest buttons and handleRest are gone.
group('(a) CompanionSheet: rest buttons + handleRest deleted, nothing reworded onto a survivor');
{
  check(!sheetSrc.includes('const handleRest'), 'handleRest is gone from CompanionSheet');
  check(!sheetSrc.includes('handleRest('), 'no call to handleRest remains');
  check(!sheetSrc.includes('const [resting, setResting]'), 'the resting state is gone');
  check(!sheetSrc.includes('setResting'), 'no setResting call remains');
  check(!sheetSrc.includes('Resting...'), 'no "Resting..." label remains');
  check(!sheetSrc.includes('`/api/companion/${companion.id}/rest`'),
    'the sheet never fetches the deleted companion rest route');
  check(!sheetSrc.includes("title=\"Restore full HP and all spell slots\""),
    'the false long-rest title is gone with the button, not reworded');
  check(!sheetSrc.includes("title=\"Restore 50% missing HP (+pact slots for warlocks)\""),
    'the false short-rest title is gone with the button, not reworded');
  check(!sheetSrc.includes("'Long Rest'") && !sheetSrc.includes('"Long Rest"') && !sheetSrc.includes('Long Rest'),
    'no "Long Rest" button text remains on the sheet');
  check(!sheetSrc.includes("'Short Rest'") && !sheetSrc.includes('"Short Rest"') && !sheetSrc.includes('Short Rest'),
    'no "Short Rest" button text remains on the sheet');
  check(sheetSrc.includes('No rest buttons here: rests are the DM\'s now'),
    'a comment records why the buttons are gone (so nobody re-adds them)');
}

// (b) What stays: single-slot restore, Convert, Level Up.
group('(b) CompanionSheet: the staying surfaces are untouched');
{
  check(sheetSrc.includes('const restoreSpellSlot = async (level)'),
    'restoreSpellSlot (+1 single-slot restore) is untouched');
  check(sheetSrc.includes('`/api/companion/${companion.id}/spell-slots/restore`'),
    'restoreSpellSlot still calls the STAYING /:id/spell-slots/restore route');
  check(sheetSrc.includes('onClick={() => restoreSpellSlot(Number(level))}'),
    'the per-slot restore button still calls restoreSpellSlot');
  check(sheetSrc.includes('Convert to Class-Based'),
    'the "Convert to Class-Based" button stays');
  check(sheetSrc.includes('onClick={() => setShowConvert(true)}'),
    'the Convert button still opens the convert flow');
  check(sheetSrc.includes('onClick={fetchLevelUpInfo}'),
    'the Level Up button stays');
}

// (c) The post-rest refresh is re-pointed into the existing refresh paths.
group('(c) Refresh re-point: conditions / death saves / slots re-read when the companion prop changes');
{
  // Phase 7 effect: fetches conditions + death saves on mount and
  // whenever HP changes — this is the refresh that used to live
  // inside handleRest, and it already keys on HP.
  const phase7Start = sheetSrc.indexOf('// Phase 7: load conditions + death saves on mount');
  const phase7End = sheetSrc.indexOf('const addCondition', phase7Start);
  const phase7 = phase7Start >= 0 && phase7End > phase7Start
    ? sheetSrc.slice(phase7Start, phase7End)
    : '';
  check(phase7.length > 200, 'the Phase 7 conditions/death-saves effect is found');
  check(phase7.includes('fetch(`/api/companion/${companion.id}/conditions`)'),
    'the Phase 7 effect still re-reads conditions');
  check(phase7.includes('fetch(`/api/companion/${companion.id}/death-saves`)'),
    'the Phase 7 effect still re-reads death saves');
  check(phase7.includes('setActiveConditions(cData.conditions)'),
    'the Phase 7 effect still applies the conditions it reads');
  check(phase7.includes('setDeathSaves(dData)'),
    'the Phase 7 effect still applies the death saves it reads');
  check(phase7.includes('[companion.id, companion.companion_current_hp]'),
    'the Phase 7 effect re-fires when the companion HP prop changes (a DM rest that heals)');
  // Spell-slots effect: the post-rest slot refetch that used to be
  // handleRest's refetchSpellSlots() call now rides the same HP key.
  check(slotsEffect.length > 100, 'the spell-slots effect is found and bounded');
  check(slotsEffect.includes('companion.companion_current_hp'),
    'the spell-slots effect re-fires when the companion HP prop changes — the re-pointed post-rest slot refresh');
  check(slotsEffect.includes('isClassBased') && slotsEffect.includes('companion.companion_level'),
    'the spell-slots effect keeps its old deps (id / class-based / level)');
  check(!sheetSrc.includes('Phase 7: rest may have cleared conditions'),
    'the handleRest-only comment goes with handleRest (the effect carries the refresh now)');
}

// (d) Downtime: no change — /complete/:id exactly as today.
group('(d) Downtime.jsx: no change — /complete/:id, no slot write, no companion rest call');
{
  check((downtimeSrc.match(/\/api\/downtime\/complete\//g) || []).length === 1,
    'Downtime calls /api/downtime/complete/:id exactly once');
  check(downtimeSrc.includes('fetch(`/api/downtime/complete/${activeDowntime.activity.id}`'),
    'Downtime still completes with the same call shape as today');
  check(!downtimeSrc.includes('spell_slots_used'),
    'Downtime makes no direct spell-slot write (the restore moved server-side)');
  check(!downtimeSrc.includes('spell-slots'),
    'Downtime touches no spell-slots route at all');
  check(!downtimeSrc.includes('/api/companion/'),
    'Downtime never calls any companion route');
  check(downtimeSrc.includes("fetch('/api/downtime/start'"),
    'Downtime start call untouched (sanity: this file was read, not assumed)');
}

// (e) DMSession: local-only long-rest clearing untouched, no companion rest call.
group('(e) DMSession.jsx: local clearing untouched, takeRest still re-pointed, no companion rest call');
{
  check(takeRest.length > 500, 'takeRest is found and bounded (toggleCondition follows it)');
  check(takeRest.includes('sendAction(null, action)'),
    'takeRest still sends the rest as an ordinary DM turn through sendAction');
  check(takeRest.includes('getConditionsToClear('),
    'takeRest keeps the local-only long-rest condition clearing');
  check(takeRest.includes('reduceExhaustion'),
    'takeRest keeps the local-only exhaustion reduction');
  check(!takeRest.includes('/api/companion/'),
    'takeRest never calls a companion route');
  // DMSession DOES fetch other companion routes (roster, away list,
  // send-activity, recall, recruit) — none of them is the rest route.
  // Pin them by name so a future rest call cannot hide among them.
  check(dmSrc.includes('`/api/companion/character/${character.id}`'),
    'DMSession still fetches the companion roster for the character');
  check(dmSrc.includes('`/api/companion/character/${character.id}/away`'),
    'DMSession still fetches the away-companion list');
  check(dmSrc.includes('`/api/companion/${companionId}/send-activity`'),
    'DMSession still sends companion activities');
  check(dmSrc.includes('`/api/companion/activity/${activityId}/recall`'),
    'DMSession still recalls companion activities');
  check(dmSrc.includes("fetch('/api/companion/recruit'"),
    'DMSession still recruits companions');
  const dmRestCall = /\/api\/companion\/[^'"`\s]*?\/rest(?![A-Za-z0-9_-])/.test(dmSrc);
  check(!dmRestCall,
    'no companion-rest route string exists anywhere in DMSession (same shape as the deletion guard)');
  check(dmSrc.includes("onClick={() => takeRest('short')}") && dmSrc.includes("onClick={() => takeRest('long')}"),
    'the DM-session rest buttons still call takeRest');
}

// (f) Deletion guard — no client file still fetches the deleted route.
group('(f) Deletion guard: no client file calls POST /api/companion/:id/rest');
{
  const clientFiles = [];
  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(jsx?|tsx?)$/.test(entry.name)) clientFiles.push(full);
    }
  })(path.join(repoRoot, 'client/src'));
  check(clientFiles.length > 10, `scanned ${clientFiles.length} client source files`);
  // A fetch of the deleted route: /api/companion/<id>/rest with no
  // further path segment. /spell-slots/restore is a different route
  // (its /rest is followed by "ore") and must not match.
  const callers = clientFiles.filter((f) => {
    const src = fs.readFileSync(f, 'utf8');
    // Fresh (non-global) regex per file: a shared /g regex keeps
    // lastIndex between test() calls and would mis-scan the next file.
    return /\/api\/companion\/[^'"`\s]*?\/rest(?![A-Za-z0-9_-])/.test(src);
  });
  check(callers.length === 0,
    `no client file fetches the deleted companion rest route (callers: ${callers.map((f) => path.relative(repoRoot, f)).join(', ') || 'none'})`);
  // The staying route still matches the loose shape on purpose — the
  // guard above must NOT flag it, so pin that the guard's regex
  // deliberately passes it. (Non-global literals: no lastIndex state.)
  check(!/\/api\/companion\/[^'"`\s]*?\/rest(?![A-Za-z0-9_-])/.test('`/api/companion/${companion.id}/spell-slots/restore`'),
    'guard sanity: the staying /spell-slots/restore route does not trip the deletion guard');
  check(/\/api\/companion\/[^'"`\s]*?\/rest(?![A-Za-z0-9_-])/.test('`/api/companion/${companion.id}/rest`'),
    'guard sanity: the deleted route shape DOES trip the guard (the guard is sensitive)');
}

// (g) Real esbuild bundle of CompanionSheet.jsx (react stubbed).
group('(g) CompanionSheet real bundle (named imports resolve)');
{
  const stubPath = path.join(tmpDir, 'react-stub.mjs');
  fs.writeFileSync(stubPath, [
    'export const useState = (v) => [v, () => {}];',
    'export const useEffect = () => {};',
    'export const useMemo = (f) => f();',
    'export const useRef = (v) => ({ current: v });',
    'export const useCallback = (f) => f;',
    'export const useContext = () => null;',
    'export function createElement() { return null; }',
    'export default { createElement: () => null };',
    '',
  ].join('\n'));
  function findEsbuild() {
    const cands = [
      path.join(repoRoot, 'client', 'node_modules', '.bin', 'esbuild'),
      path.join(repoRoot, 'node_modules', '.bin', 'esbuild'),
    ];
    for (const c of cands) if (fs.existsSync(c)) return { bin: c, prefix: [] };
    return { bin: 'npx', prefix: ['--yes', 'esbuild'] };
  }
  function bundleAbs(entryAbs, outName) {
    const { bin, prefix } = findEsbuild();
    const out = path.join(tmpDir, outName);
    execFileSync(bin, [...prefix, entryAbs, '--bundle', '--format=esm', `--outfile=${out}`, `--alias:react=${stubPath}`, '--log-level=warning'], { stdio: 'pipe' });
    return out;
  }
  let sheetBundle = null;
  try {
    sheetBundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/CompanionSheet.jsx'), 'sheet.bundle.mjs'), 'utf-8');
    check(sheetBundle.length > 1000, 'CompanionSheet bundles against its real imports (CompanionEditor, classes.json, conditions.js)');
  } catch (e) {
    check(false, `CompanionSheet esbuild bundle failed: ${e.message}`);
  }
  if (sheetBundle) {
    check(sheetBundle.includes('Convert to Class-Based'),
      'bundled sheet contains the Convert button');
    check(sheetBundle.includes('/api/companion/') && sheetBundle.includes('/spell-slots/restore'),
      'bundled sheet contains the staying single-slot restore route');
    check(sheetBundle.includes('/conditions') && sheetBundle.includes('/death-saves'),
      'bundled sheet contains the conditions + death-saves refresh reads');
    check(!sheetBundle.includes('Restore full HP and all spell slots'),
      'bundled sheet contains no false long-rest title');
    check(!sheetBundle.includes('Restore 50% missing HP'),
      'bundled sheet contains no false short-rest title');
    check(!sheetBundle.includes('handleRest'),
      'bundled sheet contains no handleRest');
    // Mutation check: change the Convert label in a temp copy — the
    // pin must fail on the mutated bundle. The temp copy lives beside
    // the real file (same directory, so its relative imports resolve)
    // and is unlinked in the finally below.
    const mutatedPath = path.join(repoRoot, 'client/src/components/CompanionSheet.mutated.jsx');
    fs.writeFileSync(mutatedPath, sheetSrc.replaceAll('Convert to Class-Based', 'Convert to Class Based'));
    let mutatedBundle = null;
    try {
      mutatedBundle = fs.readFileSync(bundleAbs(mutatedPath, 'sheet-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated CompanionSheet bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedBundle) {
      check(!mutatedBundle.includes('Convert to Class-Based'),
        'mutation check: the Convert pin fails when the label is changed');
      check(mutatedBundle.includes('Edit Details'),
        'mutation check: the mutated bundle still builds (only the label went)');
    }
  }
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
