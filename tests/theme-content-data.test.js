/**
 * Phase 2 chunk 5.C — content data file smoke test.
 *
 * Verifies the six theme content data files transcribed from spec §7
 * have the expected shape: all 21 theme ids present, expected counts per
 * theme, and field-shape integrity (alignment indicators on §7.2-§7.5,
 * none on §7.6).
 *
 * Does NOT verify exact transcription word-for-word — that's a manual
 * read-through job. Does verify nothing is missing structurally.
 */

import { THEME_GOLD_MODIFIERS, applyGoldModifier } from '../client/src/data/themeGoldModifiers.js';
import { THEME_PERSONALITY_PROMPTS } from '../client/src/data/themePersonalityPrompts.js';
import { THEME_IDEALS_PROMPTS } from '../client/src/data/themeIdealsPrompts.js';
import { THEME_BONDS_PROMPTS } from '../client/src/data/themeBondsPrompts.js';
import { THEME_FLAWS_PROMPTS } from '../client/src/data/themeFlawsPrompts.js';
import { THEME_BACKSTORY_MOMENTS } from '../client/src/data/themeBackstoryMoments.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) { console.log(`  ✓ ${message}`); passed++; }
  else { console.error(`  ✗ ${message}`); failed++; }
}

const ALL_21_THEMES = [
  'acolyte', 'charlatan', 'city_watch', 'clan_crafter', 'criminal',
  'entertainer', 'far_traveler', 'folk_hero', 'guild_artisan', 'haunted_one',
  'hermit', 'investigator', 'knight_of_the_order', 'mercenary_veteran', 'noble',
  'outlander', 'sage', 'sailor', 'soldier', 'urban_bounty_hunter', 'urchin'
];

const VALID_ALIGNMENTS = new Set([
  'LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE'
]);

console.log('\n=== §7.1 themeGoldModifiers ===\n');
{
  const ids = Object.keys(THEME_GOLD_MODIFIERS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_GOLD_MODIFIERS, `entry: ${id}`);
  }
  // Spot-check spec values
  assert(THEME_GOLD_MODIFIERS.noble === 0.50, 'noble +50%');
  assert(THEME_GOLD_MODIFIERS.urchin === -0.50, 'urchin -50%');
  assert(THEME_GOLD_MODIFIERS.folk_hero === 0.00, 'folk_hero baseline');
  assert(THEME_GOLD_MODIFIERS.soldier === 0.00, 'soldier baseline');
  // applyGoldModifier math
  assert(applyGoldModifier(50, 'noble') === 75, 'noble +50% on 50gp = 75gp');
  assert(applyGoldModifier(50, 'urchin') === 25, 'urchin -50% on 50gp = 25gp');
  assert(applyGoldModifier(50, 'soldier') === 50, 'soldier baseline on 50gp = 50gp');
  assert(applyGoldModifier(50, 'unknown_theme') === 50, 'unknown theme defaults to baseline');
  // Half-up rounding
  assert(applyGoldModifier(11, 'sage') === 12, 'sage +10% on 11gp = 12 (12.1 rounds down)');
  assert(applyGoldModifier(15, 'sage') === 17, 'sage +10% on 15gp = 17 (16.5 rounds half-up to 17)');
}

console.log('\n=== §7.2 themePersonalityPrompts (3 per theme = 63 total) ===\n');
{
  const ids = Object.keys(THEME_PERSONALITY_PROMPTS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  let total = 0;
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_PERSONALITY_PROMPTS, `entry: ${id}`);
    const arr = THEME_PERSONALITY_PROMPTS[id];
    assert(Array.isArray(arr) && arr.length === 3, `${id}: 3 prompts (got ${arr?.length})`);
    for (const p of arr) {
      assert(typeof p.text === 'string' && p.text.length > 0, `${id}: prompt text non-empty`);
      assert(VALID_ALIGNMENTS.has(p.alignment), `${id}: alignment "${p.alignment}" valid 9-square`);
      total++;
    }
  }
  assert(total === 63, `total prompts = 63 (got ${total})`);
}

console.log('\n=== §7.3 themeIdealsPrompts (4-7 per theme) ===\n');
{
  const ids = Object.keys(THEME_IDEALS_PROMPTS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  let total = 0;
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_IDEALS_PROMPTS, `entry: ${id}`);
    const arr = THEME_IDEALS_PROMPTS[id];
    assert(Array.isArray(arr) && arr.length >= 4 && arr.length <= 7,
      `${id}: 4-7 prompts (got ${arr?.length})`);
    for (const p of arr) {
      assert(typeof p.text === 'string' && p.text.length > 0, `${id}: prompt text non-empty`);
      assert(VALID_ALIGNMENTS.has(p.alignment), `${id}: alignment "${p.alignment}" valid 9-square`);
      total++;
    }
  }
  assert(total >= 100 && total <= 150, `total prompts in spec range (~110-120, got ${total})`);
}

console.log('\n=== §7.4 themeBondsPrompts (4-6 per theme) ===\n');
{
  const ids = Object.keys(THEME_BONDS_PROMPTS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  let total = 0;
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_BONDS_PROMPTS, `entry: ${id}`);
    const arr = THEME_BONDS_PROMPTS[id];
    assert(Array.isArray(arr) && arr.length >= 4 && arr.length <= 6,
      `${id}: 4-6 prompts (got ${arr?.length})`);
    for (const p of arr) {
      assert(typeof p.text === 'string' && p.text.length > 0, `${id}: prompt text non-empty`);
      assert(VALID_ALIGNMENTS.has(p.alignment), `${id}: alignment "${p.alignment}" valid 9-square`);
      total++;
    }
  }
  assert(total >= 100 && total <= 140, `total prompts in spec range (~126, got ${total})`);
}

console.log('\n=== §7.5 themeFlawsPrompts (4-6 per theme) ===\n');
{
  const ids = Object.keys(THEME_FLAWS_PROMPTS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  let total = 0;
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_FLAWS_PROMPTS, `entry: ${id}`);
    const arr = THEME_FLAWS_PROMPTS[id];
    assert(Array.isArray(arr) && arr.length >= 4 && arr.length <= 6,
      `${id}: 4-6 prompts (got ${arr?.length})`);
    for (const p of arr) {
      assert(typeof p.text === 'string' && p.text.length > 0, `${id}: prompt text non-empty`);
      assert(VALID_ALIGNMENTS.has(p.alignment), `${id}: alignment "${p.alignment}" valid 9-square`);
      total++;
    }
  }
  assert(total >= 95 && total <= 115, `total prompts in spec range (~106, got ${total})`);
}

console.log('\n=== §7.6 themeBackstoryMoments (8 per theme = 168 total) ===\n');
{
  const ids = Object.keys(THEME_BACKSTORY_MOMENTS);
  assert(ids.length === 21, `21 theme entries (got ${ids.length})`);
  let total = 0;
  for (const id of ALL_21_THEMES) {
    assert(id in THEME_BACKSTORY_MOMENTS, `entry: ${id}`);
    const arr = THEME_BACKSTORY_MOMENTS[id];
    assert(Array.isArray(arr) && arr.length === 8, `${id}: 8 moments (got ${arr?.length})`);
    for (const m of arr) {
      // Decision 4: backstory moments are bare strings, NOT objects with
      // alignment fields. The string-ness check is the load-bearing assertion;
      // if it ever became an object accidentally, this fails.
      assert(typeof m === 'string' && m.length > 0,
        `${id}: moment is non-empty string (Decision 4 — no alignment indicators)`);
      total++;
    }
  }
  assert(total === 168, `total moments = 168 (got ${total})`);
}

console.log('\n=== Cross-file: bracketed placeholders preserved ===\n');
{
  // Spot-check that the [bracketed placeholders] from spec are kept verbatim.
  const clanCrafterMoments = THEME_BACKSTORY_MOMENTS.clan_crafter;
  const hasBracketedElder = clanCrafterMoments.some(m => m.includes('[the elder]'));
  assert(hasBracketedElder, 'clan_crafter moment 4: [the elder] placeholder preserved');

  const knightMoments = THEME_BACKSTORY_MOMENTS.knight_of_the_order;
  const hasBracketedSponsor = knightMoments.some(m => m.includes('[a relative, a patron, a saved life]'));
  assert(hasBracketedSponsor, 'knight_of_the_order moment 1: bracketed sponsor placeholder preserved');
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
