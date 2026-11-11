/*
 * tests/guilds.test.js — Guilds & Orders data module.
 *
 * MAC-READY, STAGING ONLY: this file is written to be copied unchanged
 * to tests/guilds.test.js on the Mac. Its import is the Mac path
 * (../server/data/guilds.js), so in staging it is syntax-checked
 * only (node --check) and is NOT runnable here — the Mac path does not
 * exist on the VM. The Mac gate (npm test -- guilds) is the
 * real run. This module is pure data, so no database is needed.
 *
 * Pins (same assert/group style as tests/towers.test.js):
 *   - 25 guilds in book order, 5 per section for each of the 5 sections;
 *     first the Iron Poets, last the Wintertide Guild
 *   - every guild object has exactly the required keys, no stat/price
 *     keys (short fragments 'hp'/'ac'/'dc'/'gp'/'xp'/'hd' are exact-matched
 *     only, since legitimate text can contain them; long fragments
 *     'damage'/'reward'/'price'/'level'/'save'/'stat' are substring-matched
 *     against KEY NAMES only, never values — and 'stat' is exact-matched,
 *     not substring-matched, because a legitimate key elsewhere in this
 *     project ('status') contains it)
 *   - every guild has non-empty name, section, purpose, organisation,
 *     and a titles array (empty ONLY for the Longshanks)
 *   - Longshanks titles is exactly []
 *   - guildById('iron-poets-guild') returns the first guild;
 *     guildById('nope') returns null
 *   - GUILD_PEOPLE has exactly 4 entries, each with non-empty name and
 *     role; peopleForGuild returns the right person for a guild that has
 *     one, and [] for a guild with none
 *   - GUILDS_META.reskinStatus contains 'pending'
 *   - guilds() returns a copy, not the live array
 */

import {
  GUILDS,
  GUILDS_META,
  GUILD_PEOPLE,
  guilds,
  guildById,
  guildsBySection,
  guildsByHallShape,
  people,
  peopleForGuild,
} from '../server/data/guilds.js';

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL: ${name}`);
  }
}

function group(name) {
  console.log(`\n== ${name}`);
}

const GUILD_KEYS = ['hall', 'hooks', 'id', 'name', 'organisation', 'origins', 'purpose', 'section', 'titles', 'wealth'];
const PERSON_KEYS = ['guildId', 'name', 'role'];
const SHORT_FORBIDDEN = ['hp', 'ac', 'dc', 'gp', 'xp', 'hd'];
const LONG_FORBIDDEN = ['damage', 'reward', 'price', 'level', 'save'];
const EXACT_FORBIDDEN = ['stat'];

function keysClean(keys) {
  for (const k of keys) {
    if (SHORT_FORBIDDEN.includes(k)) return false;
    if (EXACT_FORBIDDEN.includes(k)) return false;
    for (const frag of LONG_FORBIDDEN) {
      if (k.includes(frag)) return false;
    }
  }
  return true;
}

function sameKeys(obj, expected) {
  const a = Object.keys(obj).sort();
  const b = [...expected].sort();
  return a.length === b.length && a.every((k, i) => k === b[i]);
}

group('Count, order, and sections');

check('25 guilds', GUILDS.length === 25);
check('first guild is the Iron Poets', GUILDS[0].name === 'The Iron Poets Guild' && GUILDS[0].id === 'iron-poets-guild');
check('last guild is the Wintertide Guild', GUILDS[24].name === 'The Wintertide Guild' && GUILDS[24].id === 'wintertide-guild');
for (const section of ['bard', 'ranger', 'thief', 'tradesmen', 'wizard']) {
  check(`5 guilds in section ${section}`, guildsBySection(section).length === 5);
}
check('sections in book order', GUILDS.map((g) => g.section).join(',') === [
  'bard', 'bard', 'bard', 'bard', 'bard',
  'ranger', 'ranger', 'ranger', 'ranger', 'ranger',
  'thief', 'thief', 'thief', 'thief', 'thief',
  'tradesmen', 'tradesmen', 'tradesmen', 'tradesmen', 'tradesmen',
  'wizard', 'wizard', 'wizard', 'wizard', 'wizard',
].join(','));

group('Exact key shape, no stat/price keys');

for (const g of GUILDS) {
  check(`guild ${g.id} has exactly the required keys`, sameKeys(g, GUILD_KEYS));
  check(`guild ${g.id} has no stat/price key`, keysClean(Object.keys(g)));
  check(`guild ${g.id} titles is an array`, Array.isArray(g.titles));
  check(`guild ${g.id} hooks is an array`, Array.isArray(g.hooks));
}
for (const p of GUILD_PEOPLE) {
  check(`person ${p.name} has exactly the required keys`, sameKeys(p, PERSON_KEYS));
  check(`person ${p.name} has no stat/price key`, keysClean(Object.keys(p)));
}

group('Non-empty core fields');

for (const g of GUILDS) {
  check(`guild ${g.id} has non-empty name`, typeof g.name === 'string' && g.name.length > 0);
  check(`guild ${g.id} has non-empty section`, typeof g.section === 'string' && g.section.length > 0);
  check(`guild ${g.id} has non-empty purpose`, typeof g.purpose === 'string' && g.purpose.length > 0);
  check(`guild ${g.id} has non-empty organisation`, typeof g.organisation === 'string' && g.organisation.length > 0);
  check(`guild ${g.id} has non-empty hall or null hall`, g.hall === null || (typeof g.hall === 'string' && g.hall.length > 0));
  check(`guild ${g.id} has non-empty wealth or null wealth`, g.wealth === null || (typeof g.wealth === 'string' && g.wealth.length > 0));
  check(`guild ${g.id} has non-empty origins or null origins`, g.origins === null || (typeof g.origins === 'string' && g.origins.length > 0));
  if (g.id !== 'longshanks') {
    check(`guild ${g.id} has at least one title`, g.titles.length > 0);
  }
}

group('Longshanks has no titles, by design');

{
  const longshanks = guildById('longshanks');
  check('Longshanks found', longshanks !== null);
  check('Longshanks titles is exactly []', Array.isArray(longshanks.titles) && longshanks.titles.length === 0);
  check('Longshanks is the only guild with no titles', GUILDS.filter((g) => g.titles.length === 0).map((g) => g.id).join(',') === 'longshanks');
}

group('Lookups');

check('guildById iron-poets-guild returns the first guild', guildById('iron-poets-guild') !== null && guildById('iron-poets-guild').name === 'The Iron Poets Guild');
check('guildById nope returns null', guildById('nope') === null);
check('guildsByHallShape single returns 11', guildsByHallShape('single').length === 11);
check('guildsByHallShape multi returns 9', guildsByHallShape('multi').length === 9);
check('guildsByHallShape none returns 5', guildsByHallShape('none').length === 5);
check('hall shapes cover all 25 guilds', guildsByHallShape('single').length + guildsByHallShape('multi').length + guildsByHallShape('none').length === 25);
check('guildsByHallShape unknown returns []', guildsByHallShape('bogus').length === 0);

group('Named people');

check('exactly 4 named people', GUILD_PEOPLE.length === 4);
for (const p of GUILD_PEOPLE) {
  check(`person ${p.name} has non-empty name`, typeof p.name === 'string' && p.name.length > 0);
  check(`person ${p.name} has non-empty role`, typeof p.role === 'string' && p.role.length > 0);
  check(`person ${p.name} guild link is real or null`, p.guildId === null || guildById(p.guildId) !== null);
}
{
  const barbican = peopleForGuild('barbican-guild');
  check('peopleForGuild barbican-guild returns Harcove of Lorn', barbican.length === 1 && barbican[0].name === 'Harcove of Lorn');
  const wardens = peopleForGuild('wardens-of-elkhorn');
  check('peopleForGuild wardens-of-elkhorn returns Jamemsward', wardens.length === 1 && wardens[0].name === 'Jamemsward');
  check('peopleForGuild iron-poets-guild returns []', peopleForGuild('iron-poets-guild').length === 0);
  check('people() returns all 4', people().length === 4);
}

group('Meta reskin status is pending, not done or dropped');

check('reskinStatus contains pending', typeof GUILDS_META.reskinStatus === 'string' && GUILDS_META.reskinStatus.includes('pending'));

group('guilds() returns a copy, not the live array');

{
  const first = guilds();
  first.push({ id: 'fake' });
  first[0].titles.push('Fake Title');
  const second = guilds();
  check('pushing to guilds() result does not change a second call', second.length === 25);
  check('mutating a returned guild titles does not change a second call', !second[0].titles.includes('Fake Title'));
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`Failures: ${failures.join('; ')}`);
  process.exit(1);
}
