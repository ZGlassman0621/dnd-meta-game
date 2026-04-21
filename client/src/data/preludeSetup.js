/**
 * Prelude setup option lists.
 *
 * Data for the 12-question prelude setup wizard. Every field is mandatory.
 * Every curated list has a "free-text fallback" — the wizard renders an
 * "Other (write your own)" option beside the curated picker so the player
 * can override when nothing in the list fits.
 *
 * These lists are intentionally flavorful, not exhaustive. They're meant to
 * nudge the player toward specific, textured choices rather than present an
 * overwhelming menu. If a player wants "street prophet's orphan ward raised
 * in a condemned cathedral," they type it in the free-text box.
 *
 * The tone-tag list (Q12) is NOT free-text. The tags are a closed vocabulary
 * so the AI can reason about them consistently.
 */

// ==========================================================================
// Q4: Birth circumstance (was Q5 in the original setup; age picker removed
//     in v1.0.43 because age is race-dependent — elves, dwarves, warforged
//     do not start at 5-8).
// ==========================================================================

export const BIRTH_CIRCUMSTANCES = [
  { value: 'noble_scion', label: 'Noble scion', description: 'Born to a titled family — wealth, obligations, tutors, and the weight of a name you did not choose.' },
  { value: 'merchant_family', label: 'Merchant family', description: 'Born to traders or shopkeepers — bustle, ledgers, stock rooms, and a keen early sense of what things cost.' },
  { value: 'artisan_household', label: 'Artisan household', description: 'Born above the workshop — the smell of leather or forge or flour, tools at hand, a craft being passed down.' },
  { value: 'farm_family', label: 'Farm family', description: "Born to farmers — dawn chores, seasons that matter, livestock that eats before you do. How isolated or village-connected depends on your home setting." },
  { value: 'street_orphan', label: 'Street orphan', description: 'No parents, no roof — the city raised you by turns cruel and kind. You learned to eat, hide, and run.' },
  { value: 'refugee', label: 'Refugee', description: 'Born into displacement — fled with your family from war, famine, or persecution. Home is a place you have only heard of.' },
  { value: 'temple_foundling', label: 'Temple foundling', description: 'Left on the temple steps as an infant — the faithful raised you as their own. You know ritual before you knew your own name.' },
  { value: 'caravan_child', label: 'Caravan child', description: 'Born on the road — your cradle was a wagon, your neighbors were other traders and guards, your horizon always receding.' },
  { value: 'tenement_child', label: 'Tenement child', description: 'Born in a cramped city building shared with many families — a hive of other lives, privacy unknown, friendships and grievances everywhere.' }
];

// ==========================================================================
// Q6: Home setting
// ==========================================================================

export const HOME_SETTINGS = [
  { value: 'village', label: 'Village', description: 'A few dozen families, one well, one shrine, everyone knows everyone.' },
  { value: 'town', label: 'Town', description: 'Gates, a market square, several trades, some division by wealth or kin.' },
  { value: 'city_ward', label: 'City ward', description: 'A neighborhood inside a larger city — your own streets, your own people, the rest of the city a rumor.' },
  { value: 'farmstead', label: 'Farmstead', description: 'Isolated farm, nearest neighbor a mile off, the sky and the seasons your chief company.' },
  { value: 'caravan', label: 'Caravan', description: 'A traveling trade convoy — home is a wagon and the people traveling with it.' },
  { value: 'temple_grounds', label: 'Temple grounds', description: 'Religious complex with its own routines, hierarchies, and sacred geography.' },
  { value: 'noble_manor', label: 'Noble manor', description: 'A country estate or urban townhouse with staff, gardens, and politics.' },
  { value: 'tenement', label: 'Tenement', description: 'Crowded urban building — many families per floor, shared privies, thin walls.' },
  { value: 'monastery', label: 'Monastery', description: 'Cloistered community of monks or scholars — silence, discipline, and devotion.' },
  { value: 'frontier_outpost', label: 'Frontier outpost', description: 'A small fortified settlement on the edge of the known — danger near, reinforcements far.' },
  { value: 'ship', label: 'Ship', description: 'Your home is a hull — you slept to the creak of timbers and the slap of waves.' },
  { value: 'wilderness_camp', label: 'Wilderness camp', description: 'A hunting band, nomadic clan, or forest-dweller family — home moves with the seasons.' }
];

// ==========================================================================
// Q7: Region
// ==========================================================================
// Forgotten Realms leaning, but the free-text fallback lets the player write
// "a valley in a world that isn't the Realms" if they want.

// Regions carry optional `race_affinity` hints so players see at a glance
// which races the region tends to produce natives of. Any race can be from
// any region — these are narrative defaults, not restrictions.
export const REGIONS = [
  { value: 'sword_coast', label: 'Sword Coast', description: 'The western coastline — cosmopolitan cities, pirate ports, old ruins, proximity to the sea. Humans, half-elves, halflings, and dwarves all common.', race_affinity: 'mixed (human-dominant)' },
  { value: 'the_north', label: 'The North', description: 'Harsh, wintry, remote — frontier forts, dwarven holds, barbarian clans, the shadow of the Spine of the World. Strong dwarven and human presence.', race_affinity: 'human, dwarf' },
  { value: 'cormyr', label: 'Cormyr', description: 'The Forest Kingdom — ordered, knightly, deeply patriotic, mages and nobles woven together. Predominantly human.', race_affinity: 'human' },
  { value: 'sembia', label: 'Sembia', description: 'A merchant republic — coin rules, guilds scheme, trade routes are arteries. Human-dominant, cosmopolitan.', race_affinity: 'human' },
  { value: 'calimshan', label: 'Calimshan', description: 'Sun-baked south — pashas, genies, slave markets that refuse to die, spice and sand. Primarily human, with halfling and tiefling communities.', race_affinity: 'human, halfling, tiefling' },
  { value: 'amn', label: 'Amn', description: 'A mercantile federation ruled by hidden Cowled Wizards — magic is licensed, coin is law. Human with significant half-orc presence.', race_affinity: 'human, half-orc' },
  { value: 'tethyr', label: 'Tethyr', description: 'A restored kingdom still healing from civil war — old wounds, new loyalties. Primarily human.', race_affinity: 'human' },
  { value: 'chult', label: 'Chult', description: 'Tropical jungle peninsula — dinosaurs, yuan-ti, lost cities, pirate coves. Human-majority, with dragonborn and tabaxi communities.', race_affinity: 'human, dragonborn' },
  { value: 'icewind_dale', label: 'Icewind Dale', description: 'Ten Towns of the far north — perpetual winter, knucklehead trout, hard people. Human, with nearby dwarven halls.', race_affinity: 'human, dwarf' },
  { value: 'moonshae_isles', label: 'Moonshae Isles', description: 'Druidic, Celtic-inflected islands — old gods, sea raids, standing stones. Human-majority with strong Ffolk traditions.', race_affinity: 'human' },
  { value: 'underdark', label: 'Underdark', description: 'Deep caverns beneath the surface — drow, duergar, mind flayers, deep gnomes, a perpetual dark. Surface races extremely rare.', race_affinity: 'drow, dwarf (duergar), gnome (svirfneblin)' },
  { value: 'mulhorand', label: 'Mulhorand', description: 'An ancient empire in the southeast — god-kings, pyramids, dynasties older than most kingdoms. Primarily human.', race_affinity: 'human' },
  { value: 'rashemen', label: 'Rashemen', description: 'Cold, ancient, shamanic — fey-touched land of berserker lodges and hathran witches. Primarily human.', race_affinity: 'human' },
  { value: 'thay', label: 'Thay', description: 'A land of Red Wizards and undead legions — magic as weapon, politics as murder. Primarily human with tiefling and gnoll presence.', race_affinity: 'human, tiefling' },
  { value: 'damara', label: 'Damara', description: 'Snowbound mountain kingdom — recovering from demonic invasion, proud of its scars. Human with dwarven allies.', race_affinity: 'human, dwarf' },
  { value: 'cormanthor', label: 'Cormanthor (the old elven realm)', description: 'Ancient elven forest realm east of Cormyr — mostly ruined, still home to elven enclaves among the trees and ruins.', race_affinity: 'elf, half-elf' },
  { value: 'evermeet', label: 'Evermeet', description: 'The elven island kingdom beyond the Trackless Sea — effectively elves-only, withdrawn from the world of men.', race_affinity: 'elf' }
];

// ==========================================================================
// Q8: Parent status (per parent)
// ==========================================================================

export const PARENT_STATUS = [
  { value: 'present', label: 'Present', description: 'Actively raising you — the relationship is part of your daily life.' },
  { value: 'living_distant', label: 'Living but distant', description: 'Still alive, but absent — working far away, estranged, imprisoned, exiled, or just disengaged.' },
  { value: 'died_before_memory', label: 'Died before you remember', description: 'Gone before your earliest memories formed — they exist as a name, a story, a half-image.' },
  { value: 'died_in_childhood', label: 'Died during your childhood', description: 'Lost in a way you remember — an event that shapes what came after.' },
  { value: 'unknown', label: 'Unknown', description: 'You never knew them. Maybe nobody did. Maybe you have guesses.' }
];

// Parent roles — who is this person to the player character?
// Two slots, both can be any role (two mothers, two guardians, one father
// + one step-parent, etc.).
export const PARENT_ROLES = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'stepmother', label: 'Stepmother' },
  { value: 'stepfather', label: 'Stepfather' },
  { value: 'adoptive_mother', label: 'Adoptive mother' },
  { value: 'adoptive_father', label: 'Adoptive father' },
  { value: 'grandmother', label: 'Grandmother (raised you)' },
  { value: 'grandfather', label: 'Grandfather (raised you)' },
  { value: 'aunt', label: 'Aunt (raised you)' },
  { value: 'uncle', label: 'Uncle (raised you)' },
  { value: 'elder_sibling', label: 'Elder sibling (raised you)' }
];

// Sibling relative ages — simpler and more natural than a signed number.
export const SIBLING_RELATIVE_AGES = [
  { value: 'younger', label: 'Younger' },
  { value: 'older', label: 'Older' },
  { value: 'twin', label: 'Twin' }
];

// Sibling gender. Separate from the player's gender picker (which has
// free-text fallback) — this one stays closed-vocabulary for schema
// consistency and to avoid a runaway wizard form.
export const SIBLING_GENDERS = [
  { value: 'sister', label: 'Sister' },
  { value: 'brother', label: 'Brother' },
  { value: 'sibling', label: 'Sibling (non-binary)' }
];

// ==========================================================================
// Q10: Things they're good at (curated list — pick 3, free text allowed)
// ==========================================================================
// Ordered loosely by which classes/themes each might nudge toward, but the
// mapping is intentionally fuzzy — play determines what actually emerges.

export const CHILDHOOD_TALENTS = [
  'Running',
  'Climbing',
  'Hiding',
  'Noticing things',
  'Making friends',
  'Making things with their hands',
  'Numbers',
  'Stories',
  'Fixing things',
  'Calming animals',
  'Calming people',
  'Fast hands',
  'Patience',
  'Courage',
  'Singing',
  'Reading',
  'Fighting',
  'Sneaking',
  'Quick thinking',
  'Remembering things exactly',
  'Negotiating',
  'Lying convincingly',
  'Staying still',
  'Knowing when to run',
  'Helping others',
  'Taking a hit',
  'Finding things',
  'Seeing through lies'
];

// ==========================================================================
// Q11: Things they care about (curated list — pick 3, free text allowed)
// ==========================================================================

export const CHILDHOOD_CARES = [
  'Family',
  'Home',
  'Freedom',
  'Justice',
  'Safety',
  'Adventure',
  'Learning',
  'Friends',
  'Animals',
  'Honor',
  'Faith',
  'Power',
  'Wealth',
  'Art',
  'Truth',
  'Belonging',
  'Proving themselves',
  'Protecting the weak',
  'Being left alone',
  'Being known',
  'Fairness',
  'Revenge',
  'Nature',
  'Making something last',
  'Not being like their parents',
  'Being like their parents',
  'Escape'
];

// ==========================================================================
// Q12: Tone tags (pick 2-4 — closed vocabulary, no free-text fallback)
// ==========================================================================
// These shape both Opus arc-plan generation and Sonnet's scene-level prose.
// The AI receives the composite as a tone signal — "gritty + dark humor"
// produces different writing than "epic + mystical + tragic."

export const TONE_TAGS = [
  { value: 'gritty', label: 'Gritty', description: 'Blunt, unvarnished, realistic. Hardships named plainly. No softening the edges.' },
  { value: 'dark_humor', label: 'Dark humor', description: 'Wry relief in bad situations. Characters make jokes at funerals. Gallows wit.' },
  { value: 'hopeful', label: 'Hopeful', description: 'Darkness exists but light does too. People try. Kindness matters.' },
  { value: 'epic', label: 'Epic', description: 'Elevated stakes, weight, legend-shaped moments. Your childhood matters in a big way.' },
  { value: 'quiet_melancholic', label: 'Quiet / melancholic', description: 'Small, sad, tender. Slow attention. Loss carried softly.' },
  { value: 'tragic', label: 'Tragic', description: 'Beautiful things break. Love costs. The shape of a story is loss.' },
  { value: 'whimsical', label: 'Whimsical / fable-like', description: 'Wonder is close to the surface — small omens in the wheat, a forge that sings on feast days, folk tales half-remembered from old grandmothers. Tender and curious, not twee.' },
  { value: 'political', label: 'Political / intrigue', description: 'Power is the weather. Alliances matter. Children learn to read rooms early.' },
  { value: 'rustic', label: 'Rustic', description: 'Earth under fingernails. Long fields. Simple pleasures and long winters.' },
  { value: 'mystical', label: 'Mystical', description: 'The world is porous. Dreams bleed through. Old gods notice children.' },
  { value: 'brutal', label: 'Brutal', description: 'Violence is common and real. Survival is not assumed.' },
  { value: 'tender_intimate', label: 'Tender / intimate', description: 'Close-up on faces and hands. Relationships at center. Warmth even in hardship.' },
  { value: 'romantic', label: 'Romantic', description: 'Loves — young, fierce, confused, lasting. Yearning is a thread through the childhood.' },
  { value: 'eerie_uncanny', label: 'Eerie / uncanny', description: 'Something is wrong with the village, the woods, the dreams. Children notice.' },
  { value: 'bawdy', label: 'Bawdy', description: 'Earthy, irreverent, frank about bodies and appetites. Working-class vigor.' },
  { value: 'spiritual', label: 'Spiritual', description: 'Faith, ritual, and the presence of the divine (or its absence) shape daily life.' }
];
