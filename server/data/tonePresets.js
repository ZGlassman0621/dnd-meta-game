/**
 * Tone presets — server-side "tone bibles" for the 4 prelude tone options.
 * v1.0.73 (replaces the old 16-tag combinable system).
 *
 * Structure per preset:
 *   - value/label/description/inspirations — also mirrored to the client for
 *     the setup wizard UI (player-facing).
 *   - bible — server-only content injected into the AI's system prompt when
 *     this preset is selected. Includes:
 *       · register_rules — sentence-level prose guidance
 *       · vocabulary — 10-15 register-marker words/phrases to lean toward
 *       · scene_types — per-scene-kind guidance (combat, dialogue, travel,
 *         home, ritual/politics)
 *       · age_scaling — Ch1 / Ch2 / Ch3 / Ch4 intensity escalation so the
 *         same register scales from child to young-adult without going off
 *         the rails (user explicitly required this in v1.0.73 design)
 *       · exemplars — 2 sample paragraphs (one Ch1 opening, one
 *         mid-chapter) showing the register in prose
 *
 * Only ONE preset is selected per character. Stored on
 * `characters.prelude_setup_data.tone_tags` as a single-element array
 * (['brutal_gritty'] etc.) — same shape as the old multi-tag system, just
 * always length 1 with a preset value.
 *
 * See `buildTonePresetBlock(presetValue)` at the bottom for the prompt
 * formatter that assembles this into a compact block for injection.
 */

export const TONE_PRESETS = {
  brutal_gritty: {
    value: 'brutal_gritty',
    label: 'Brutal & Gritty',
    description: "Medieval realism, no softening. Violence is common, winters bite, food is scarce, politics are zero-sum. Adults extract, endure, betray, and sometimes prevail. Prose is short, unembellished, body-focused — hunger, blood, cold floors, threadbare cloaks. Even a child's life has real weight: a bruise that stays, an adult's lie overheard, a neighbor who stops speaking to your father. Political intrigue, cruel pragmatism, wary trust. Not grim for grim's sake — grim because the world is real.",
    inspirations: 'early ASOIAF, The Witcher, Joe Abercrombie',
    bible: {
      register_rules: [
        'Short sentences. Fragments allowed. One idea per breath.',
        'Concrete nouns over abstract ones. Bodies, objects, weather, work.',
        'No euphemism. "Hunger" not "an empty feeling." "Piss" not "relief." "Blood" not "crimson."',
        'Figurative language budget: one metaphor per 3-4 paragraphs at most. Earn each one.',
        'No poetic-ending lines. No "the morning stretches out ahead, empty and ordinary." End scenes on action, pressure, or stakes — not mood.',
        'Dialogue is compressed, elided. Pronouns instead of repeated nouns. Working-class cadence. Adults lie through omission; children notice.'
      ],
      vocabulary: [
        'callused', 'scabbed', 'weather-split', 'threadbare', 'piss-stained',
        'lean year', 'the cold', 'the wet', 'the fever year',
        'watery stew', 'heel of bread', 'short measure', 'thin soup',
        'owed', 'short rope', 'bad bargain', 'extract (what guards do)',
        'a thing that worked out', 'a thing that didn\'t', 'a thing that might yet kill you'
      ],
      scene_types: {
        combat: "Bodies, blood, uneven odds. A fight between adults in front of a child is terrifying, not exciting. A child's own fights are scraped knuckles and shame. Adults get hurt in ways that don't heal clean. No heroic framing of violence.",
        dialogue: 'Compressed. Elided. Working-class cadence. Pronouns replace names. Adults lie through omission; children notice but often don\'t challenge. Endearments are rare and weight-carrying when they appear.',
        travel: 'Weather matters. Feet get wet. Shelter is earned. Distance is measured in how tired you are. The road is not safe.',
        home: 'Cramped. Privacy is negotiated. Who sleeps where, who eats first, who gets the warm corner. Walls are thin. The roof leaks.',
        ritual_politics: "Power is local and visible. The guard who takes your father's boots. The priest who extracts tithe. The merchant's son who gets away with it. Gods are distant; rent is present. Intrigue is survival, not grand strategy."
      },
      age_scaling: {
        ch1_early_childhood: 'Brutality is PROXIMITY. The child witnesses, hears, absorbs without fully understanding. Adults being cruel, hungry, scared. Bruises on parents. A neighbor who disappears. The child is protected imperfectly but NOT directly brutalized.',
        ch2_middle_childhood: 'Brutality is EXPOSURE. The child gets hit, stolen from, lied to. Small fights at the market. Hunger as an actual sensation. The first time an adult\'s lie lands on them directly.',
        ch3_adolescence: 'Brutality is PARTICIPATION. The character fights back, steals, lies, survives by their own choices. Real blood. Real consequences. Bad decisions with teeth. The first real wound that will scar.',
        ch4_threshold: 'Brutality is OWNERSHIP. The character is now one of the hard adults others are afraid of, or the one who refused to become that. Either way, scarred. The departure at chapter\'s end is shaped by what the world has made them, for better or worse.'
      },
      exemplars: [
        "Opening (Ch1 example): You wake to the cold. Your brother's feet are against your back. There is no fire. The winter has been long and it is not done. Vask is already up — you can hear him at the door, speaking low to Moira. Not angry, just careful. The way he speaks when something is wrong and he doesn't want the children to know yet. You know anyway.",
        "Mid-chapter (Ch3 example): The guard spits brown on the cobbles and looks at you like a thing he will eventually step on. You know this guard. He took a copper from Vask last tenday and called it a favor. Your hand is on the knife under your belt. The knife is not for him — the knife is for what comes next, always. But your hand is on it."
      ]
    }
  },

  epic_fantasy: {
    value: 'epic_fantasy',
    label: 'Epic Fantasy',
    description: "Mythic weight in small moments. The big currents of the world touch your village. A dragon passes overhead. A visiting paladin notices you. A dream-god knows your name before you do. Prose is elevated — \"cold stone\" over \"rocks,\" \"the wind out of the north\" over \"the wind.\" Scenes end with weight — implications stretching beyond the moment. Even a child's beats carry shadow-of-something-larger. Legend-shaped without being sentimental.",
    inspirations: 'Tolkien, Brian Staveley, Robert Jordan',
    bible: {
      register_rules: [
        'Medium-to-long sentences. Rhythms build. Scenes end with weight.',
        'Elevated diction where it earns its place. "Cold stone" not just "rocks." "The wind out of the north" not just "the wind."',
        'Figurative language budget: 1-2 metaphors per paragraph when the scene calls for gravity; restraint in routine beats.',
        'Scenes end in implications — the moment points beyond itself, without over-explaining.',
        'Allow poetic beats — but earn them. Not every line can be one.',
        'Dialogue has slight formality. Name-use carries weight. "My son" at the right moment means something.'
      ],
      vocabulary: [
        'storm-colored', 'old as stone', 'the weight of', 'the name of the',
        'out of the north', 'out of the west', 'from beyond the mountains', 'from the sea',
        'reckoning', 'doom (in the old sense: fate)', 'the hand of', 'the work of',
        'augury', 'portent', 'shadow (as presence, not absence)',
        'the sort of silence that', 'the manner of folk who'
      ],
      scene_types: {
        combat: "Weight and consequence. Even a child's scuffle echoes. A dragon overhead reshapes the day forever. Battles are not just violence — they are moments where the world's currents briefly touch down. A sword has a name. A death has meaning.",
        dialogue: "Slightly formal. Adults speak with a sense of what matters. Name-use carries weight — a father who calls his son 'my son' at the right moment means something. Elders speak in aphorisms that land.",
        travel: 'The land has history. Every crossroads has a name. Every ruin was built by someone with a name. The road itself is storied.',
        home: 'Even a humble home has a sense of place in the larger world. The hearth is inheritance. The roof your grandfather built. Small things are anchored in long lineage.',
        ritual_politics: 'Gods are real and occasionally near. Kings are far but not unreachable. The paladin who visits your village is an event for the next ten years. Faith and power are both weighty, both consequential.'
      },
      age_scaling: {
        ch1_early_childhood: "The epic LEAKS IN. A dragon passes. A bard sings of the battle of Three Rivers and the child memorizes it. An old woman recognizes something in the child's eyes and says nothing. The child senses scale without understanding it.",
        ch2_middle_childhood: 'The epic ARRIVES. A visiting figure from the larger world crosses the child\'s path. A letter arrives. A vision. A debt is called. The child glimpses the scale of things and does not yet know what to do with it.',
        ch3_adolescence: 'The epic PULLS. The character is drawn into something. A choice with consequences beyond the village. A knowledge that cannot be un-known. A person who will not forget them.',
        ch4_threshold: 'The epic COMMITS. Departure is for epic reasons. A calling, a duty, a quest seeded long ago. The character leaves the village because the world has asked for them. The door closes behind them and the wind changes.'
      },
      exemplars: [
        "Opening (Ch1 example): The storm woke you. You lay still and listened to it — the long clean sound of wind off the mountains, carrying sleet and the smell of something older than rain. Somewhere in the village, a shutter banged. You thought of the bard who had come through in the autumn. He had sung of Three Rivers, of the battle that ended the last age. He had pointed north as he sang. He had pointed this way.",
        "Mid-chapter (Ch3 example): The paladin's horse was storm-colored and did not look tired, though she had ridden a long way. She looked at you the way adults looked at dogs they were considering buying — attentive, unhurried, already reaching a decision. \"Your name,\" she said. Not a question. The village elder had gone quiet behind you. You could hear your own breath."
      ]
    }
  },

  rustic_spiritual: {
    value: 'rustic_spiritual',
    label: 'Rustic & Spiritual',
    description: "Land, faith, and season. The earth is close, the gods closer. Time is measured in crops, feast days, and prayers rather than hours. Priests, elders, and dreams are trusted. Gods are not abstract — they're present in the barn at calving, the river at baptism, the old shrine where offerings still accumulate. Monsters are folklore-shaped; the sacred has weight. The thin membrane between this world and the next.",
    inspirations: "Patricia McKillip, Le Guin's Earthsea, Naomi Novik's Uprooted",
    bible: {
      register_rules: [
        'Medium sentences. Land rhythms — observational, patient.',
        'Earthy nouns. Faith terms. Seasonal markers.',
        'Figurative language tied to land and ritual — metaphors from planting, weaving, prayer, weather.',
        'Time markers: feast days, moons, bells, candlemarks, harvests. Never "hours" or "minutes."',
        'Gods named when relevant. Ritual details count. A blessing is specific to its moment.',
        'Dialogue is unhurried. People speak with knowledge of long cycles. Grandmothers tell stories. Priests bless as easily as greet. Children are addressed with seriousness.'
      ],
      vocabulary: [
        'feast day', 'last frost', 'first snow', 'high summer', 'the dark of the year',
        'chalked (for marking doors)', 'blessed', 'salted', 'wrapped in linen',
        'the old shrine', 'the new chapel', 'the priest\'s house', 'the grave-stone',
        'the name of (deity)', 'the saint of (thing)', 'the crossroads offering',
        'tithe', 'litany', 'chant', 'vigil', 'consecration', 'benediction'
      ],
      scene_types: {
        combat: 'Rare, and when it happens it has weight of ritual transgression. A fight breaks something sacred. Blood matters to the land. Violence against the innocent is cosmic wound, not just personal.',
        dialogue: 'Unhurried. People speak with knowledge of long cycles. Grandmothers tell stories. Priests give blessings as easily as hello. Children are addressed with seriousness — their questions are answered, not dismissed.',
        travel: 'Pilgrimage-coded. Crossroads have offerings. The road between towns is known, named, storied. A traveler brings news, news carries meaning, meaning shapes next season\'s rites.',
        home: 'Ritual-filled. Prayers at meals. Charms above doors. The hearth is blessed. The roof has a story. The threshold is treated as a threshold — you pause, you bow your head, you cross.',
        ritual_politics: 'The priest is as powerful as the lord. Sometimes more. Faith shapes politics. Gods are not abstract — they\'re present in the barn at calving, in the river at baptism, in the dreams of the old. Monsters from folklore are real but rare.'
      },
      age_scaling: {
        ch1_early_childhood: 'The sacred is SEEN. The child participates in ritual without understanding, absorbs the rhythms, overhears prayers, sees the old shrine. Wonder is near. The gods are big and kind and not-quite-comprehensible.',
        ch2_middle_childhood: 'The sacred is KNOWN. The child learns prayers, hears stories of saints and monsters, attends rites. The gods begin to have faces. The child asks questions that priests answer carefully.',
        ch3_adolescence: 'The sacred is CHALLENGED. A crisis of faith, a monster that shouldn\'t exist, a priest who fails, a vision that costs something. The sacred becomes personal — and therefore harder.',
        ch4_threshold: 'The sacred is CHOSEN. The character decides their relationship to faith. Devotion, doubt, heresy, or a new understanding. The gods notice. A calling, a refusal, or a quiet continuing — each is a different departure.'
      },
      exemplars: [
        "Opening (Ch1 example): It was the morning of the First Frost and Sister Halene had chalked the doors. You watched her do it — the careful cross-and-loop, the words she whispered against the threshold. Seven doors in the village. Seven protections against what the winter might carry in. She moved in a rhythm you had seen all your short life and still did not understand. The chalk smelled like old stone.",
        "Mid-chapter (Ch3 example): The thing in the shrine had no face. It breathed, though. You could see its breath in the cold — a slow, wrong rhythm. Sister Halene was behind you, not speaking. You had never seen her silent in the shrine before. Her hand was on your shoulder, very light. She was waiting. For what, you did not know. The god whose name was written on the stone had not answered, or had answered in a way you did not yet understand."
      ]
    }
  },

  tender_hopeful: {
    value: 'tender_hopeful',
    label: 'Tender & Hopeful',
    description: "Small-scale, warm, intimate. The stakes are the ones that matter to a child — a sibling fight, a cold supper, a friend's laugh, a parent's praise, a lost kitten. Kindnesses are named explicitly. People try. Life is hard but not cruel; even the rough characters have decent moments. Prose stays close to faces and hands, small touches, the shapes of rooms you love. Your childhood is yours, and it matters, and it's safe enough for you to have one.",
    inspirations: "T. Kingfisher's Saint of Steel, Katherine Addison's Goblin Emperor, Becky Chambers",
    bible: {
      register_rules: [
        'Varied sentences, close to faces and hands. Small observations, specific touches.',
        'Warm diction. Kindnesses named. Small touches cataloged (a hand on a shoulder, a blanket tucked tighter, a cup still warm).',
        'Figurative language: mostly from home — cloth, light, warmth, hands, bread, the shapes of rooms.',
        'Ending beats favor small beauties — but not saccharine. Hardship exists, but people show up.',
        'Dialogue is warm. Endearments are real. Parents speak to children with patience. Even sharp-tongued characters have tender moments.',
        'Don\'t sanitize hardship — acknowledge it. The preset is "tender," not "easy." Tears and struggles are real; they just aren\'t the end of the story.'
      ],
      vocabulary: [
        'tucked (as blanket, as child into bed)', 'wiped (tears, counters, noses)',
        'folded (laundry, hands, bread dough)', 'the shape of her face',
        'the warmth of', 'the weight of his arm around',
        'small kindness', 'decent', 'someone who shows up', 'someone who noticed',
        'a good loaf', 'a mended sleeve', 'a cup that\'s still warm',
        'we', 'ours', 'the way we (family verbs — the way we sleep, the way we argue)'
      ],
      scene_types: {
        combat: 'Rare, and terrifying when it happens. But always resolved — someone comes, someone intervenes, the PC is held afterward. Violence is an interruption of warmth, not the world\'s default.',
        dialogue: 'Warm. Endearments are real. Parents speak to children with patience. Even the sharp-tongued have tender moments. Conversations include being asked questions and being listened to.',
        travel: 'Homeward is a feeling, not just a direction. Travel is for visiting. Returns are celebrated. The road leads back.',
        home: 'Center of gravity. The kitchen matters. The fire matters. Who made the meal, who\'s wearing whose sweater, whose turn it is to wash up. The small geographies of belonging.',
        ritual_politics: 'Small-scale. Village festivals. Neighbor disputes. The baker\'s feud with the butcher. Charming more than cruel. Power is distant; community is immediate.'
      },
      age_scaling: {
        ch1_early_childhood: 'Warmth is CENTRAL. Adults are kind, older siblings are patient, grandparents know things. The world is small and safe-ish. A lost toy is devastating and also fixable.',
        ch2_middle_childhood: 'Warmth is TESTED. A friend betrays, a parent\'s temper shows, grief arrives (a pet, a grandparent). The warmth survives but is no longer unquestioned. First loss, first disappointment that doesn\'t resolve cleanly.',
        ch3_adolescence: 'Warmth is CHOSEN. The character decides who to love, who to trust, who to protect. First romance (if any). Found family begins. The character learns that warmth is something you build, not just receive.',
        ch4_threshold: 'Warmth is CARRIED. The character leaves home but carries the warmth outward. Departures are not tragic; they\'re transitions. People wave from doorways. The PC goes to build warmth somewhere new.'
      },
      exemplars: [
        "Opening (Ch1 example): Moira was at the stove and it smelled like her — like rosemary, like bread, like the wool of the shawl Vask had given her three winters ago. You were six and you were in your favorite corner, which was behind the cutting board, with a heel of bread she had given you because she saw you looking. The day was going to be a good day. You could tell from the way she was humming.",
        "Mid-chapter (Ch3 example): You had run the whole way from the river and now you were crying and you couldn't say why. Moira didn't ask. She wiped your face with the corner of her apron and she sat you on the bench by the fire and she put a cup in your hand and she didn't say anything for a long time. When she did speak, it was only to say: \"I made too much. Eat.\" The soup was warm. The bench was warm. You were still crying but differently now."
      ]
    }
  }
};

/**
 * Ordered list of presets — used by UI (both client mirror and any server
 * endpoint that enumerates choices).
 */
export const TONE_PRESET_LIST = [
  TONE_PRESETS.brutal_gritty,
  TONE_PRESETS.epic_fantasy,
  TONE_PRESETS.rustic_spiritual,
  TONE_PRESETS.tender_hopeful
];

/**
 * Build the tone block injected into the Sonnet/Opus system prompt. Returns
 * a formatted multi-line string for exactly ONE preset. Unknown preset
 * values fall back to a conservative placeholder so the prompt doesn't
 * blow up.
 *
 * The block is considerably longer than the old Rule-14 "16-tag catalog"
 * because it includes the FULL tone bible — but it's only rendered for ONE
 * preset at a time, so the prompt's actual noise floor is lower.
 */
export function buildTonePresetBlock(presetValue) {
  const preset = TONE_PRESETS[presetValue];
  if (!preset) {
    return `TONE: (no preset selected — default to grounded literary realism, concrete nouns, no over-writing)`;
  }

  const sceneTypes = preset.bible.scene_types;
  const ageScaling = preset.bible.age_scaling;

  return `TONE: ${preset.label.toUpperCase()}
${preset.description}
Reference works: ${preset.inspirations}.

REGISTER RULES (apply at the sentence level):
${preset.bible.register_rules.map(r => `  • ${r}`).join('\n')}

VOCABULARY ANCHORS (let these emerge naturally; don't force a bingo card):
  ${preset.bible.vocabulary.join(' · ')}

SCENE-TYPE GUIDANCE:
  Combat:        ${sceneTypes.combat}
  Dialogue:      ${sceneTypes.dialogue}
  Travel:        ${sceneTypes.travel}
  Home:          ${sceneTypes.home}
  Ritual/politics: ${sceneTypes.ritual_politics}

AGE-SCALING (the register persists across the prelude, but intensity grows):
  Chapter 1 (early childhood):   ${ageScaling.ch1_early_childhood}
  Chapter 2 (middle childhood):  ${ageScaling.ch2_middle_childhood}
  Chapter 3 (adolescence):       ${ageScaling.ch3_adolescence}
  Chapter 4 (threshold):         ${ageScaling.ch4_threshold}

EXEMPLAR PROSE (write in this register and rhythm):
${preset.bible.exemplars.map(ex => `  ${ex}`).join('\n\n')}`;
}

/**
 * Compact short-form — just label + description. Used by the arc-plan
 * generator (Opus) so Opus shapes the home world in-register at setup time.
 * We don't feed Opus the full bible because (a) the arc plan is JSON-
 * structured and we don't want register-bibles contaminating the output
 * schema, and (b) Opus only needs broad tone direction for world shaping.
 */
export function buildTonePresetShortBlock(presetValue) {
  const preset = TONE_PRESETS[presetValue];
  if (!preset) return '(no tone preset selected)';
  return `${preset.label}: ${preset.description}\nReference works: ${preset.inspirations}`;
}

/**
 * Given the player's stored tone_tags array (always length 1 in v1.0.73+),
 * return the preset value. Returns null if the array is empty or the
 * single value isn't a recognized preset.
 */
export function resolvePresetFromTags(toneTags) {
  if (!Array.isArray(toneTags) || toneTags.length === 0) return null;
  const first = toneTags[0];
  return TONE_PRESETS[first] ? first : null;
}
