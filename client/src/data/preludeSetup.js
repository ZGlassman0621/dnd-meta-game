/**
 * Prelude setup option lists.
 *
 * Data for the 10-question prelude setup wizard. Q1 (name) and Q10
 * (anything else) take free text; everything else is curated. Q4-Q6
 * (birth circumstance, home setting, region) accept an optional free-text
 * override per question. Q7 (parents) is a small sub-form. Q8 (siblings)
 * and Q9 (authority figure) are single-select drop-downs with no override.
 *
 * Q9 (authority figure) is new in Phase 2; replaces Q11 (tone preset),
 * Q9 (talents), and Q10 (cares) from the v1.0.73 wizard. Tone is now a
 * locked description in `preludePromptBuilder.js`. Mentor-as-authority is
 * the precondition for mentor-NPC seeding; see DECISION_LOG 2026-04-30
 * "Phase 2 Pre-Engineering Decision A: Setup Wizard Content Revisit."
 *
 * Q10 (anything else?) is a free-text escape valve for players whose
 * specific origin idea isn't captured by the curated lists. The DM is
 * instructed to honor it over conflicting curated answers when present.
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
// Q5: Home setting
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
// Q6: Region
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
// Q7: Parent status (per parent)
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

// ==========================================================================
// Q8: Siblings (Phase 2 — Decision A)
// ==========================================================================
// Replaces the variable-length per-sibling sub-form with a single dropdown.
// AI generates names and dynamics during Ch1 narrative play. Free-text
// override removed — Q10 (anything else?) catches edge cases.

export const SIBLING_OPTIONS = [
  { value: 'only_child', label: 'Only child' },
  { value: 'younger_one', label: 'Younger sibling' },
  { value: 'younger_many', label: 'Younger siblings' },
  { value: 'older_one', label: 'Older sibling' },
  { value: 'older_many', label: 'Older siblings' },
  { value: 'twin', label: 'Twin' },
  { value: 'mixed', label: 'Mix of younger and older' },
  { value: 'lost_one', label: 'Lost sibling (died or vanished)' },
  { value: 'lost_many', label: 'Lost siblings (died or vanished)' }
];

// ==========================================================================
// Q9: Authority figure (Phase 2 — Decision A; new question)
// ==========================================================================
// Single-select, curated, required. No free-text override.
//
// 'mentor' is the precondition for mentor-NPC seeding. The arc plan
// generator emits an [NPC_CANON] for the mentor in early Ch1 or Ch2
// when this value is selected. At handoff, mentor_imprints is seeded
// from the corresponding prelude_canon_npcs row (relationship='mentor').

export const AUTHORITY_FIGURES = [
  { value: 'parent', label: 'A parent', description: "the household's adult presence, for better or worse." },
  { value: 'sibling', label: 'An older sibling', description: 'raised you in everything but name.' },
  { value: 'mentor', label: 'A mentor', description: 'a teacher, master, priest, or elder who taught you something deliberately.' },
  { value: 'guardian', label: 'A guardian', description: 'an adult who took responsibility for you without being family.' },
  { value: 'captor', label: 'A captor', description: 'someone who held power over you against your will.' },
  { value: 'employer', label: 'An employer', description: 'you worked for them young, and they shaped you through that work.' },
  { value: 'rival', label: 'A rival', description: 'another child or adolescent whose presence defined yours.' },
  { value: 'none', label: 'No one', description: 'you raised yourself.' }
];
