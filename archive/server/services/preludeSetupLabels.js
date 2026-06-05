/**
 * Server-side mirror of the curated label/description text used on the
 * client setup wizard. The client source of truth is
 * `client/src/data/preludeSetup.js`. We mirror a subset here so the
 * server can enrich Opus prompts with the same flavor text the player saw
 * when picking — without the server needing to import client code.
 *
 * Keep these in sync with the client file. If they drift, Opus will still
 * work on raw `value` strings — but prompts will lose the descriptive
 * context that helps shape the arc.
 */

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

export const REGIONS = [
  { value: 'sword_coast', label: 'Sword Coast', description: 'The western coastline — cosmopolitan cities, pirate ports, old ruins, proximity to the sea. Humans, half-elves, halflings, and dwarves all common.' },
  { value: 'the_north', label: 'The North', description: 'Harsh, wintry, remote — frontier forts, dwarven holds, barbarian clans, the shadow of the Spine of the World. Strong dwarven and human presence.' },
  { value: 'cormyr', label: 'Cormyr', description: 'The Forest Kingdom — ordered, knightly, deeply patriotic, mages and nobles woven together. Predominantly human.' },
  { value: 'sembia', label: 'Sembia', description: 'A merchant republic — coin rules, guilds scheme, trade routes are arteries. Human-dominant, cosmopolitan.' },
  { value: 'calimshan', label: 'Calimshan', description: 'Sun-baked south — pashas, genies, slave markets that refuse to die, spice and sand. Primarily human, with halfling and tiefling communities.' },
  { value: 'amn', label: 'Amn', description: 'A mercantile federation ruled by hidden Cowled Wizards — magic is licensed, coin is law. Human with significant half-orc presence.' },
  { value: 'tethyr', label: 'Tethyr', description: 'A restored kingdom still healing from civil war — old wounds, new loyalties. Primarily human.' },
  { value: 'chult', label: 'Chult', description: 'Tropical jungle peninsula — dinosaurs, yuan-ti, lost cities, pirate coves. Human-majority, with dragonborn and tabaxi communities.' },
  { value: 'icewind_dale', label: 'Icewind Dale', description: 'Ten Towns of the far north — perpetual winter, knucklehead trout, hard people. Human, with nearby dwarven halls.' },
  { value: 'moonshae_isles', label: 'Moonshae Isles', description: 'Druidic, Celtic-inflected islands — old gods, sea raids, standing stones. Human-majority with strong Ffolk traditions.' },
  { value: 'underdark', label: 'Underdark', description: 'Deep caverns beneath the surface — drow, duergar, mind flayers, deep gnomes, a perpetual dark. Surface races extremely rare.' },
  { value: 'mulhorand', label: 'Mulhorand', description: 'An ancient empire in the southeast — god-kings, pyramids, dynasties older than most kingdoms. Primarily human.' },
  { value: 'rashemen', label: 'Rashemen', description: 'Cold, ancient, shamanic — fey-touched land of berserker lodges and hathran witches. Primarily human.' },
  { value: 'thay', label: 'Thay', description: 'A land of Red Wizards and undead legions — magic as weapon, politics as murder. Primarily human with tiefling and gnoll presence.' },
  { value: 'damara', label: 'Damara', description: 'Snowbound mountain kingdom — recovering from demonic invasion, proud of its scars. Human with dwarven allies.' },
  { value: 'cormanthor', label: 'Cormanthor (the old elven realm)', description: 'Ancient elven forest realm east of Cormyr — mostly ruined, still home to elven enclaves among the trees and ruins.' },
  { value: 'evermeet', label: 'Evermeet', description: 'The elven island kingdom beyond the Trackless Sea — effectively elves-only, withdrawn from the world of men.' }
];

// v1.0.73 — replaced 16 combinable tone tags with 4 curated presets. See
// `server/data/tonePresets.js` for the full tone-bible definitions (prose
// register, vocabulary anchors, scene-type guidance, age-scaling,
// exemplars). TONE_TAGS is re-exported here as a backward-compatible alias
// (player-facing slice of each preset — value/label/description) so any
// legacy consumer keeps working without churn.
import { TONE_PRESET_LIST } from '../data/tonePresets.js';

export const TONE_TAGS = TONE_PRESET_LIST.map(p => ({
  value: p.value,
  label: p.label,
  description: p.description
}));

export { TONE_PRESETS, TONE_PRESET_LIST, buildTonePresetBlock, buildTonePresetShortBlock, resolvePresetFromTags } from '../data/tonePresets.js';
