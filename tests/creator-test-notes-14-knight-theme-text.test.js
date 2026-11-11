// tests/creator-test-notes-14-knight-theme-text.test.js — creator
// test-notes item 14 (Zach, 2026-11-09): the Knight of the Order
// theme's identity + description were data-facing prose that listed
// the six moral paths as metadata ("Supports six branching moral
// paths: True / Reformer / Martyr / Complicit / Fallen / Redemption").
// The rewrite is player-facing — what the theme IS, DOES, and PLAYS
// like — with exactly ONE line noting the moral path is tracked,
// starting at True, and able to shift through play. No path picker
// is built in this job (follow-up); the six paths stay DB-backed
// (knight_moral_paths) and the tier-5 ability text still names them.
//
// Honest integration tests: this imports the REAL themes registry
// and reads the live entry. If the registry were deleted, the import
// fails and the suite fails with it.
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let passed = 0;
let failed = 0;
function check(condition, message) {
  if (condition) { passed++; }
  else { failed++; console.error('  ✗', message); }
}
function group(name) { console.log('\n==', name); }

const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'creator-test-notes-14-test-'));
const tmpDir = repoRoot;
const origCwd = process.cwd();
process.chdir(tmpDir);
const fromRepo = (rel) => pathToFileURL(path.join(origCwd, rel)).href;

const { THEMES } = await import(fromRepo('server/data/themes.js'));
const knight = THEMES.find((t) => t?.id === 'knight_of_the_order');
check(knight != null, 'knight_of_the_order exists in the themes registry');

group('player-facing text');
{
  check(typeof knight?.identity === 'string' && knight.identity.trim().length > 0,
    'identity is present and non-empty');
  check(typeof knight?.description === 'string' && knight.description.trim().length > 0,
    'description is present and non-empty');
  // What it IS / DOES / PLAYS like — grounded in the tier abilities:
  // shelter + standing from the order (T1 Knightly Regard), the name
  // opening doors (T5/T11 Order's Voice), the banner rallying allies
  // (T11 Banner of the Order), breaking the code costing standing
  // (T5 code-violation consequences).
  check(/shelter/i.test(knight.description), 'description says what the order does for you (shelter)');
  check(/banner/i.test(knight.description), 'description says what the order does in battle (banner)');
  check(/breaking the code|break.*code/i.test(knight.description),
    'description says what breaking the code costs (standing)');
}

group('exactly one moral-path line');
{
  const text = `${knight.identity} ${knight.description}`;
  // The tracked-path line: tracked, starting at True, able to shift.
  const pathLines = text.match(/moral path is tracked from True/gi) || [];
  check(pathLines.length === 1,
    `exactly one tracked-path line (found ${pathLines.length})`);
  check(/can shift/i.test(knight.description),
    'the path line says the path can shift through play');
  // The old metadata list is gone from the player-facing text.
  check(!/Supports six branching moral paths/.test(text),
    'the old six-path metadata list is gone from identity + description');
  for (const name of ['Reformer', 'Martyr', 'Complicit', 'Fallen', 'Redemption']) {
    check(!new RegExp(`\\b${name}\\b`).test(text),
      `path name '${name}' is not listed in the player-facing text`);
  }
}

group('entry otherwise intact');
{
  check(knight?.name === 'Knight of the Order', `name unchanged (got ${knight?.name})`);
  check(knight?.origin_feat === 'tough', `origin feat unchanged (got ${knight?.origin_feat})`);
  check(Array.isArray(knight?.abilities) && knight.abilities.length === 4,
    `four tier abilities still present (got ${knight?.abilities?.length})`);
  check(Array.isArray(knight?.creation_choice_options) && knight.creation_choice_options.length === 4,
    `four order-type choices still present (got ${knight?.creation_choice_options?.length})`);
}

console.log(`=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed ? 1 : 0);
