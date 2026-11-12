// tests/rest-consolidation-client.test.js — rest consolidation CLIENT side
// (2026-11-07): ONE rest system — the DM's.
//
// What this pins:
//   - DMSession.jsx `takeRest` is RE-POINTED, not removed: the Short /
//     Long Rest buttons send a rest action as an ordinary DM turn
//     (POST /api/dm-session/:id/message via sendAction), the DM
//     narrates it and emits [REST], and the marker pipeline applies
//     the rest. The deleted POST /api/character/rest/:id call, the
//     server date bump, and the separate rest-narrative POST are all
//     gone from takeRest — while the rest-narrative ROUTE still exists
//     server-side (only the call went) and the adjust-date call
//     survives in exactly one place, the downtime flow.
//   - No client file under client/src still fetches the deleted route
//     (recursive static scan).
//   - The server strips [REST] / [TIME_ADVANCE] markers from the
//     displayed narrative (sibling fix: they were the only markers
//     missing from the strip list, and every rest-button press now
//     routes through a turn carrying [REST]).
//   - A real esbuild bundle of DMSession.jsx (react stubbed) — a
//     broken named import fails the bundle, not a runtime render the
//     tests never see.
//
// Honest integration tests: the live files are read, never
// re-implemented. No DB, no HTTP: the DM rest itself is exercised
// over real HTTP in tests/spellbook-routes.test.js (bank → DM short
// rest → applied) and tests/rest-time.test.js. Footer is the
// runner-matching `Results:` form so the count aggregates.
//
// Run from the repo root: node tests/rest-consolidation-client.test.js
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
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rest-consolidation-client-test-'));

const dmSrc = readRepo('client/src/components/DMSession.jsx');
const sheetSrc = readRepo('client/src/components/CharacterSheet.jsx');
const dmRouteSrc = readRepo('server/routes/dmSession.js');

// takeRest's body, bounded by the function that follows it — so the
// pins below judge the rest flow itself, not stray matches elsewhere
// in the file (the downtime flow, the combat-end handler, comments).
const takeRestStart = dmSrc.indexOf('const takeRest = async (restType)');
const takeRestEnd = dmSrc.indexOf('const toggleCondition', takeRestStart);
const takeRest = takeRestStart >= 0 && takeRestEnd > takeRestStart
  ? dmSrc.slice(takeRestStart, takeRestEnd)
  : '';

// (a) takeRest re-pointed to the DM turn.
group('(a) takeRest re-pointed: the buttons trigger the DM narration, not a route');
{
  check(takeRest.length > 500, 'takeRest is found and bounded (toggleCondition follows it)');
  check(takeRest.includes('sendAction(null, action)'),
    'takeRest sends the rest as an ordinary DM turn through sendAction');
  check(takeRest.includes('long rest (8 hours)') && takeRest.includes('short rest (1 hour)'),
    'takeRest sends a rest action naming the duration (8 hours / 1 hour)');
  check(!takeRest.includes('/api/character/rest/'),
    'takeRest never calls the deleted POST /api/character/rest/:id route');
  check(!takeRest.includes('adjustGameDate'),
    'takeRest does no date bump — the DM path advances the clock');
  check(!takeRest.includes('/rest-narrative'),
    'takeRest makes no separate rest-narrative POST — the DM reply IS the rest narrative');
  check(takeRest.includes('getConditionsToClear('),
    'takeRest keeps the long-rest condition clearing (local state only)');
  check(takeRest.includes("fetch(`/api/character/${character.id}`)"),
    'takeRest refreshes the character from the server after the DM turn');
  check(takeRest.includes('fetchSpellSlots()'),
    'takeRest refreshes spell slots after the DM turn');
  check(takeRest.includes("fetch(`/api/dm-session/active/${character.id}`)"),
    'takeRest re-reads the game date from the session instead of bumping it');
  check(dmSrc.includes('const sendAction = async (e, actionOverride)'),
    'sendAction accepts a canned-action override for the rest buttons');
  check(dmSrc.includes('actionOverride ? null'),
    'a canned rest action sends no dice with it');
  check(dmSrc.includes('if (!actionOverride)'),
    'a canned rest action neither clears nor restores the typed input');
  check(dmSrc.includes('return true;') && dmSrc.includes('return false;'),
    'sendAction reports whether the turn completed, so takeRest knows');
  check(!dmSrc.includes('const adjustGameDate'),
    'the adjustGameDate helper is gone — its only caller was takeRest');
  check((dmSrc.match(/\/adjust-date/g) || []).length === 1,
    'adjust-date is called exactly once in DMSession (the downtime flow, untouched)');
  check(dmSrc.includes('Failed to advance game time'),
    'that one remaining adjust-date call is the downtime flow');
  check(dmRouteSrc.includes("router.post('/:sessionId/rest-narrative'"),
    'the rest-narrative ROUTE still exists server-side — only the takeRest call went');
  check(dmSrc.includes('Short Rest') && dmSrc.includes('Long Rest'),
    'the Short Rest and Long Rest buttons are still in the UI');
  check(dmSrc.includes("onClick={() => takeRest('short')}") && dmSrc.includes("onClick={() => takeRest('long')}"),
    'the buttons still call takeRest');
  check(dmSrc.includes('Ask the DM for a short rest') && dmSrc.includes('Ask the DM for a long rest'),
    'the button titles say the DM narrates and applies the rest');
}

// (b) Deletion guard — no client file still fetches the deleted route.
group('(b) Deletion guard: no client file calls POST /api/character/rest/:id');
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
  const callers = clientFiles.filter((f) => {
    const src = fs.readFileSync(f, 'utf8');
    // A fetch of the deleted route (backtick template or quoted
    // string). Plain mentions in comments — "the route is deleted"
    // — do not count: they name the deletion, they do not call it.
    return src.includes('`/api/character/rest/') || src.includes("'/api/character/rest/") || src.includes('"/api/character/rest/');
  });
  check(callers.length === 0,
    `no client file fetches the deleted route (callers: ${callers.map((f) => path.relative(repoRoot, f)).join(', ') || 'none'})`);
  check(!sheetSrc.includes('`/api/character/${character.id}/rest`'),
    'the sheet never calls the deleted route (its Memorize surface banks now)');
  check(!sheetSrc.includes('takeShortRestAndSwap') && !dmSrc.includes('takeShortRestAndSwap'),
    'the old rest-and-swap handler name is gone from both files');
}

// (c) [REST] / [TIME_ADVANCE] markers are stripped from displayed narrative.
group('(c) Marker strip: [REST] / [TIME_ADVANCE] never reach the player as text');
{
  const hasRestStrip = (src) => src.includes('replace(/\\[REST(?::');
  const hasTimeStrip = (src) => src.includes('replace(/\\[TIME_ADVANCE(?::');
  check(hasRestStrip(dmRouteSrc), 'dmSession.js strips [REST: ...] from the displayed narrative');
  check(hasTimeStrip(dmRouteSrc), 'dmSession.js strips [TIME_ADVANCE: ...] from the displayed narrative');
  // The patterns themselves do the job on sample narrative — the
  // same shapes as the route's strip lines, applied to text the DM
  // could actually emit.
  const restRe = /\[REST(?::[^\]]+)?\]\s*/gi;
  const timeRe = /\[TIME_ADVANCE(?::[^\]]+)?\]\s*/gi;
  const strip = (s) => s.replace(restRe, '').replace(timeRe, '').trim();
  check(strip('[REST: Type=short] You catch your breath.') === 'You catch your breath.',
    'a short-rest marker is stripped, leaving the narration');
  check(strip('You make camp. [REST: Type=long] Dawn breaks.') === 'You make camp. Dawn breaks.',
    'a long-rest marker is stripped mid-narrative');
  check(strip('[TIME_ADVANCE: Hours=6 Reason="the road north"] You walk on.') === 'You walk on.',
    'a time-advance marker is stripped');
  check(strip('[REST] Nothing happened.') === 'Nothing happened.',
    'a bare [REST] marker (invalid, never dispatched) is stripped too');
  // Mutation check: delete the REST strip line from a temp copy —
  // the pin must fail on the mutated route, proving it is sensitive
  // to the strip itself and not to nearby text.
  const mutatedRoute = path.join(tmpDir, 'dmSession-mutated.js');
  fs.writeFileSync(mutatedRoute, dmRouteSrc.replace(
    "cleanNarrative = cleanNarrative.replace(/\\[REST(?::[^\\]]+)?\\]\\s*/gi, '').trim();\n", ''));
  const mutatedSrc = fs.readFileSync(mutatedRoute, 'utf8');
  check(!hasRestStrip(mutatedSrc),
    'mutation check: the REST-strip pin fails when the strip line is deleted');
  check(hasTimeStrip(mutatedSrc),
    'mutation check: the TIME_ADVANCE strip survives the REST mutation (the deletion is localized)');
}

// (d) Real esbuild bundle of DMSession.jsx (react stubbed).
group('(d) DMSession real bundle (named imports resolve)');
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
      // Windows: .bin/esbuild is a shell shim execFileSync cannot run — use the real binary.
      ...(process.platform === 'win32' ? [path.join(repoRoot, 'client', 'node_modules', '@esbuild', `win32-${process.arch}`, 'esbuild.exe')] : []),
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
  let dmBundle = null;
  try {
    dmBundle = fs.readFileSync(bundleAbs(path.join(repoRoot, 'client/src/components/DMSession.jsx'), 'dm.bundle.mjs'), 'utf-8');
    check(dmBundle.length > 1000, 'DMSession bundles against its real panels/data/hooks imports');
  } catch (e) {
    check(false, `DMSession esbuild bundle failed: ${e.message}`);
  }
  if (dmBundle) {
    check(dmBundle.includes('/api/dm-session/') && dmBundle.includes('/message'),
      'bundled DMSession contains the DM message route the rest flow rides');
    check(dmBundle.includes('Short Rest') && dmBundle.includes('Long Rest'),
      'bundled DMSession contains the rest buttons');
    check(dmBundle.includes('Ask the DM for a short rest'),
      'bundled DMSession contains the re-pointed short-rest title');
    check(dmBundle.includes('We settle in for a long rest (8 hours)'),
      'bundled DMSession contains the long-rest action text');
    check(dmBundle.includes('I take a short rest (1 hour) to catch my breath'),
      'bundled DMSession contains the short-rest action text');
    check(!dmBundle.includes('`/api/character/rest/') && !dmBundle.includes('/api/character/rest/'),
      'bundled DMSession contains no call to the deleted rest route');
    // Mutation check: delete the long-rest action text from a temp
    // copy — the pin must fail on the mutated bundle. The temp copy
    // lives beside the real file (same directory, so its relative
    // imports resolve) and is unlinked in the finally below.
    const mutatedPath = path.join(repoRoot, 'client/src/components/DMSession.mutated.jsx');
    fs.writeFileSync(mutatedPath, dmSrc.replace('We settle in for a long rest (8 hours)', 'We settle in for a long rest (8 HOURS XX)'));
    let mutatedBundle = null;
    try {
      mutatedBundle = fs.readFileSync(bundleAbs(mutatedPath, 'dm-mutated.bundle.mjs'), 'utf-8');
    } catch (e) {
      check(false, `mutated DMSession bundle failed: ${e.message}`);
    } finally {
      try { fs.unlinkSync(mutatedPath); } catch {}
    }
    if (mutatedBundle) {
      check(!mutatedBundle.includes('We settle in for a long rest (8 hours)'),
        'mutation check: the rest-action pin fails when the action text is deleted');
      check(mutatedBundle.includes('Short Rest'),
        'mutation check: the mutated bundle still builds (only the action text went)');
    }
  }
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
