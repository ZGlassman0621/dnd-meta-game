// tests/repo-check-fixes-tools.test.js — the 37 tool entries against the 2024
// PHB Tools section (docs/pm/repo-check-fixes-tools/BRIEF.md; book lines from
// the PM transcription of PHB pp. 220–221). Covers: the 17 rewritten
// descriptions (book Utilize + Craft, no invented clause, the two inversions
// turned the book's way), Ability + every Utilize DC on all 37, and the 20
// untouched descriptions byte-identical to before the job.
import assert from 'node:assert';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { TOOLS, toolDescription, lookupReference } = await import(pathToFileURL(path.join(REPO, 'client/src/data/references.js')).href);
const { resolveChoiceOptions } = await import(pathToFileURL(path.join(REPO, 'client/src/components/creator-next/choiceOptions.js')).href);

let passed = 0, failed = 0;
function group(n) { console.log('== ' + n + ' =='); }
function ok(c, m) { try { assert(c, m); passed++; console.log('  ✓ ' + m); } catch (e) { failed++; console.error('FAIL:', m); } }

// The book's Ability + Utilize DCs (brief tables), keyed to the action.
const BOOK = {
  "Alchemist's Supplies": ['Intelligence', [['Identify a substance', 15], ['Start a fire', 15]]],
  "Brewer's Supplies": ['Intelligence', [['Detect poisoned drink', 15], ['Identify alcohol', 10]]],
  "Calligrapher's Supplies": ['Dexterity', [['Write text with impressive flourishes that guard against forgery', 15]]],
  "Carpenter's Tools": ['Strength', [['Seal or pry open a door or container', 20]]],
  "Cartographer's Tools": ['Wisdom', [['Draft a map of a small area', 15]]],
  "Cobbler's Tools": ['Dexterity', [["Modify footwear to give Advantage on the wearer's next Dexterity (Acrobatics) check", 10]]],
  "Glassblower's Tools": ['Intelligence', [['Discern what a glass object held in the past 24 hours', 15]]],
  "Jeweler's Tools": ['Intelligence', [["Discern a gem's value", 15]]],
  "Leatherworker's Tools": ['Dexterity', [['Add a design to a leather item', 10]]],
  "Mason's Tools": ['Strength', [['Chisel a symbol or hole in stone', 10]]],
  "Painter's Supplies": ['Wisdom', [["Paint a recognizable image of something you've seen", 10]]],
  "Potter's Tools": ['Intelligence', [['Discern what a ceramic object held in the past 24 hours', 15]]],
  "Smith's Tools": ['Strength', [['Pry open a door or container', 20]]],
  "Tinker's Tools": ['Dexterity', [['Assemble a Tiny item composed of scrap, which falls apart in 1 minute', 20]]],
  "Weaver's Tools": ['Dexterity', [['Mend a tear in clothing', 10], ['Sew a Tiny design', 10]]],
  "Woodcarver's Tools": ['Dexterity', [['Carve a pattern in wood', 10]]],
  'Dice Set': ['Wisdom', [['Discern whether someone is cheating', 10], ['Win the game', 20]]],
  // The 20 matching entries (fields only)
  "Cook's Utensils": ['Wisdom', [["Improve food's flavor", 10], ['Detect spoiled or poisoned food', 15]]],
  'Disguise Kit': ['Charisma', [['Apply makeup', 10]]],
  'Forgery Kit': ['Dexterity', [["Mimic 10 or fewer words of someone else's handwriting", 15], ['Duplicate a wax seal', 20]]],
  'Dragonchess Set': ['Wisdom', [['Discern whether someone is cheating', 10], ['Win the game', 20]]],
  'Playing Card Set': ['Wisdom', [['Discern whether someone is cheating', 10], ['Win the game', 20]]],
  'Three-Dragon Ante Set': ['Wisdom', [['Discern whether someone is cheating', 10], ['Win the game', 20]]],
  'Herbalism Kit': ['Intelligence', [['Identify a plant', 10]]],
  "Navigator's Tools": ['Wisdom', [['Plot a course', 10], ['Determine position by stargazing', 15]]],
  "Poisoner's Kit": ['Intelligence', [['Detect a poisoned object', 10]]],
  "Thieves' Tools": ['Dexterity', [['Pick a lock', 15], ['Disarm a trap', 15]]],
};
for (const inst of ['Bagpipes', 'Drum', 'Dulcimer', 'Flute', 'Lute', 'Lyre', 'Horn', 'Pan Flute', 'Shawm', 'Viol']) {
  BOOK[inst] = ['Charisma', [['Play a known tune', 10], ['Improvise a song', 15]]];
}

// The 17 rewritten descriptions: words from the book's Utilize + Craft lines
// that must appear, and the invented clauses the check named that must not.
const REWRITE = {
  "Alchemist's Supplies": { has: [/identify a substance/i, /start a fire/i, /acid/i, /alchemist's fire/i, /component pouch/i, /oil/i, /paper/i, /perfume/i], not: [/potion/i] },
  "Brewer's Supplies": { has: [/poisoned drink/i, /identify alcohol/i, /antitoxin/i], not: [/sanitiz/i, /ales|beers|meads/i] },
  "Calligrapher's Supplies": { has: [/guard against forgery/i, /ink/i, /spell scroll/i], not: [/forging signatures/i, /scribe/i, /useful for forging/i] },
  "Carpenter's Tools": { has: [/seal or pry open a door or container/i, /club/i, /greatclub/i, /quarterstaff/i, /barrel/i, /chest/i, /ladder/i, /pole/i, /portable ram/i, /torch/i], not: [/structures/i, /furniture/i, /traps/i, /weak spots/i] },
  "Cartographer's Tools": { has: [/draft a map of a small area/i, /maps/i], not: [/scale/i, /navigat/i] },
  "Cobbler's Tools": { has: [/modify footwear/i, /advantage/i, /acrobatics/i, /climber's kit/i], not: [/repairing footwear/i, /shoe patterns/i, /crafting and repairing/i] },
  "Glassblower's Tools": { has: [/discern what a glass object held in the past 24 hours/i, /glass bottle/i, /magnifying glass/i, /spyglass/i, /vial/i], not: [/quality/i, /origin/i, /craftsmanship/i] },
  "Jeweler's Tools": { has: [/discern a gem's value/i, /arcane focus/i, /holy symbol/i], not: [/cutting/i, /setting jewelry/i, /fakes/i] },
  "Leatherworker's Tools": { has: [/add a design to a leather item/i, /sling/i, /whip/i, /hide armor/i, /studded leather armor/i, /backpack/i, /crossbow bolt case/i, /map or scroll case/i, /parchment/i, /pouch/i, /quiver/i, /waterskin/i], not: [/saddle/i, /belt/i, /binding/i, /leather origin/i] },
  "Mason's Tools": { has: [/chisel a symbol or hole in stone/i, /block and tackle/i], not: [/walls/i, /techniques/i, /weak points/i] },
  "Painter's Supplies": { has: [/paint a recognizable image of something you've seen/i, /druidic focus/i, /holy symbol/i], not: [/artist's hand/i, /copying/i, /art culture/i] },
  "Potter's Tools": { has: [/discern what a ceramic object held in the past 24 hours/i, /jug/i, /lamp/i], not: [/origins/i, /periods/i, /cultural/i] },
  "Smith's Tools": { has: [/pry open a door or container/i, /melee weapon except a club, greatclub, quarterstaff, or whip/i, /medium armor except hide/i, /heavy armor/i, /ball bearings/i, /bucket/i, /caltrops/i, /chain/i, /crowbar/i, /firearm bullets/i, /grappling hook/i, /iron pot/i, /iron spikes/i, /sling bullets/i], not: [/metallurgy/i, /armor strength/i, /repairing/i] },
  "Tinker's Tools": { has: [/assemble a tiny item composed of scrap/i, /falls apart in 1 minute/i, /musket/i, /pistol/i, /bell/i, /bullseye lantern/i, /flask/i, /hooded lantern/i, /hunting trap/i, /lock/i, /manacles/i, /mirror/i, /shovel/i, /signal whistle/i, /tinderbox/i], not: [/repairing/i, /modifying/i, /clockwork/i, /constructs/i] },
  "Weaver's Tools": { has: [/mend a tear in clothing/i, /sew a tiny design/i, /padded armor/i, /basket/i, /bedroll/i, /blanket/i, /fine clothes/i, /net/i, /robe/i, /rope/i, /sack/i, /string/i, /tent/i, /traveler's clothes/i], not: [/fabric origin/i, /quality/i, /tapestr/i] },
  "Woodcarver's Tools": { has: [/carve a pattern in wood/i, /club/i, /greatclub/i, /quarterstaff/i, /ranged weapon \(except a pistol, musket, or sling\)/i, /arcane focus/i, /arrows/i, /bolts/i, /druidic focus/i, /ink pen/i, /needles/i], not: [/figurine/i, /puzzle box/i, /bow shaft/i] },
  'Dice Set': { has: [/discern whether someone is cheating/i, /win the game/i], not: [/let you cheat/i, /cheat by hand/i] },
};

// Before this job, byte-for-byte (snapshot taken from the live file).
const KEEP = {
  "Cook's Utensils": "Preparing meals — seasoning, preservation, identifying ingredients, and spotting tainted food.",
  "Disguise Kit": "Changing appearance — cosmetics, hair dye, prosthetics, and costume pieces to impersonate another.",
  "Forgery Kit": "Producing false documents — seals, parchment, inks, and scripts to fool an untrained inspector.",
  "Dragonchess Set": "Playing dragonchess — a three-tiered strategy game enjoyed in urbane or scholarly circles.",
  "Playing Card Set": "Playing card games of chance and skill. Useful for wagering in taverns or reading a player's tell.",
  "Three-Dragon Ante Set": "Playing the gambling card game favored across the Realms. A common tavern pastime.",
  "Herbalism Kit": "Identifying plants, brewing antitoxins, and crafting healing potions from natural ingredients.",
  "Navigator's Tools": "Charting courses, reading maps, and fixing position at sea by sextant and stars.",
  "Poisoner's Kit": "Crafting poisons, applying them to weapons, and identifying poisons in food or drink.",
  "Thieves' Tools": "Picking locks, disabling traps, and performing subtle mechanical tampering. Required proficiency for most locks.",
  "Bagpipes": "A drone-and-chanter instrument associated with highland and military traditions.",
  "Drum": "Percussion for tavern songs, martial cadences, and tribal dance.",
  "Dulcimer": "A hammered stringed instrument producing shimmering, layered tones.",
  "Flute": "A transverse woodwind — bright, airy, good for carrying across crowds.",
  "Lute": "The classic bard's plucked string instrument. Portable, expressive, and suited to song.",
  "Lyre": "An ancient plucked string instrument associated with poetry, scholarship, and classical music.",
  "Horn": "Brass signaling instrument — hunt calls, warnings, and ceremonial fanfare.",
  "Pan Flute": "A set of pitched pipes played by blowing across them. Pastoral and woodland in character.",
  "Shawm": "A piercing double-reed woodwind, ancestor of the oboe. Loud, formal, and festival-appropriate.",
  "Viol": "A bowed string instrument with a mellow, melancholy tone."
};

// ---------------------------------------------------------------------------
group('All 37 entries are present and structured');
{
  ok(Object.keys(TOOLS).length === 37 && Object.keys(BOOK).length === 37 && Object.keys(BOOK).every((k) => TOOLS[k]), '37 entries, the same 37 names as the book table (0 missing, 0 extra)');
  ok(Object.values(TOOLS).every((t) => t && typeof t === 'object' && typeof t.description === 'string' && typeof t.ability === 'string' && Array.isArray(t.utilize) && t.utilize.length >= 1), 'every entry is { description, ability, utilize: [...] }');
}

group('Ability + every Utilize DC on all 37, keyed to the action');
{
  for (const [name, [ability, uses]] of Object.entries(BOOK)) {
    const t = TOOLS[name];
    const same = t.ability === ability && t.utilize.length === uses.length
      && uses.every(([action, dc], i) => t.utilize[i].action === action && t.utilize[i].dc === dc);
    ok(same, `${name}: ${ability}; ${uses.map(([a, d]) => `${a} (DC ${d})`).join(', ')}`);
  }
  const twoInBook = Object.values(BOOK).filter(([, u]) => u.length === 2).length;
  ok(twoInBook === 21 && Object.values(TOOLS).filter((t) => t.utilize.length === 2).length === twoInBook, 'every tool the book gives two Utilize options stores both (21: Alchemist\'s, Brewer\'s, Weaver\'s, Cook\'s, Forgery Kit, Navigator\'s, Thieves\', the 4 gaming sets, the 10 instruments)');
}

group('The 17 rewritten descriptions follow the book');
{
  for (const [name, { has, not }] of Object.entries(REWRITE)) {
    const d = TOOLS[name].description;
    const missing = has.filter((re) => !re.test(d));
    const invented = not.filter((re) => re.test(d));
    ok(missing.length === 0 && invented.length === 0, `${name}: book Utilize + Craft present, invented clauses gone${missing.length ? ` (missing ${missing})` : ''}${invented.length ? ` (still has ${invented})` : ''}`);
  }
  const rewritten = Object.keys(REWRITE).map((n) => TOOLS[n].description);
  ok(rewritten.every((d) => !/(also )?useful for (identifying|spotting)/i.test(d) && !/spotting/i.test(d)), 'no "useful for identifying/spotting" clause survives in any of the 17');
  ok(rewritten.every((d) => (d.match(/[.!?](\s|$)/g) || []).length === 1 && d.endsWith('.')), 'each of the 17 is one sentence');
  ok(/guard against forgery/i.test(TOOLS["Calligrapher's Supplies"].description) && !/forging/i.test(TOOLS["Calligrapher's Supplies"].description), 'inversion fixed: Calligrapher\'s flourishes guard AGAINST forgery');
  ok(/discern whether someone is cheating/i.test(TOOLS['Dice Set'].description) && !/you cheat/i.test(TOOLS['Dice Set'].description), 'inversion fixed: the Dice Set catches a cheater');
}

group('The 20 matching descriptions are byte-identical');
{
  ok(Object.keys(KEEP).length === 20, '20 entries snapshotted');
  for (const [name, text] of Object.entries(KEEP)) ok(TOOLS[name].description === text, `${name}: text unchanged`);
}

group('Readers of the description still work');
{
  ok(toolDescription("Mason's Tools") === TOOLS["Mason's Tools"].description && toolDescription('Not A Tool') === null, 'toolDescription returns the sentence, or null');
  ok(lookupReference('tool', "Thieves' Tools") === KEEP["Thieves' Tools"], 'lookupReference("tool") returns the description string');
  const opts = resolveChoiceOptions({ options: 'any_artisan_tool' });
  ok(opts.length === 17 && opts.every((o) => o.description === TOOLS[o.value].description), 'the creator\'s tool pickers show the new descriptions (17 artisan tools)');
}

console.log(`\nrepo-check-fixes-tools: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
