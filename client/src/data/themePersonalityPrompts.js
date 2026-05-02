/**
 * Per-theme personality prompts — clickable starters for Step 7's
 * "Personality traits" field (Model A: click drops into textarea, then
 * editable). Per PHASE_2_CREATOR_SPEC.md §7.2.
 *
 * Three prompts per theme × 21 themes = 63 prompts total.
 *
 * Alignment indicators are 5e 9-square abbreviations: LG, NG, CG, LN, N,
 * CN, LE, NE, CE. Always-visible inline alongside prompt text per
 * Decision 3 (DECISION_LOG 2026-05-02). Distribution skews toward N / LN /
 * CN / NG / NE because most habits push one alignment axis without
 * committing the other.
 *
 * Storage shape: { themeId: [{ text, alignment }] }
 */

export const THEME_PERSONALITY_PROMPTS = {
  acolyte: [
    { text: "You speak a brief blessing under your breath before meals, even alone.", alignment: "LG" },
    { text: "You sit still for long stretches without growing restless, the way prayer taught you.", alignment: "LN" },
    { text: "You ask after people's troubles before their names, and you remember the answers.", alignment: "NG" }
  ],

  charlatan: [
    { text: "You watch a person's hands first, their face second, their words last.", alignment: "CN" },
    { text: "You change small details about yourself depending on the room — accent, posture, the weight of your laugh.", alignment: "CN" },
    { text: "You tell stories about yourself you know aren't true and let people decide which ones to believe.", alignment: "CN" }
  ],

  city_watch: [
    { text: "You scan a crowd for the people who don't fit before you scan for the people you came to find.", alignment: "LN" },
    { text: "You notice when a door is locked that should be open, and you remember it.", alignment: "LN" },
    { text: "You greet shopkeepers and beggars by name on the streets you know, and you know a lot of streets.", alignment: "LG" }
  ],

  clan_crafter: [
    { text: "You run your thumb along the seam of any worked thing you handle, judging the maker.", alignment: "N" },
    { text: "You name your tools, and you keep them clean even when you're exhausted.", alignment: "LN" },
    { text: "You stand at a particular angle when you work — the angle your kin stood at — without thinking about it.", alignment: "LN" }
  ],

  criminal: [
    { text: "You sit with your back to walls and your eye on the door.", alignment: "CN" },
    { text: "You count the people in any room before you settle into it.", alignment: "CN" },
    { text: "You answer questions with questions when you're being measured.", alignment: "CN" }
  ],

  entertainer: [
    { text: "You read the room before you open your mouth — who's bored, who's drunk, who's sad.", alignment: "CN" },
    { text: "You hum or whistle without realizing it, and you notice when you stop.", alignment: "CN" },
    { text: "You make eye contact a half-beat longer than other people are comfortable with, and you've learned to use it.", alignment: "CN" }
  ],

  far_traveler: [
    { text: "You compare everything to home, sometimes aloud, often in your head.", alignment: "N" },
    { text: "You eat foods you don't recognize before you ask what they are, because asking is sometimes rude.", alignment: "NG" },
    { text: "You watch how locals greet each other and adjust your own greeting accordingly.", alignment: "N" }
  ],

  folk_hero: [
    { text: "You greet everyone the same — the magistrate and the stable hand — and it surprises both of them.", alignment: "NG" },
    { text: "You stand up when other people are sitting and the room has gone wrong.", alignment: "CG" },
    { text: "You can't stop yourself from offering help even when no one asked, and sometimes it costs you.", alignment: "NG" }
  ],

  guild_artisan: [
    { text: "You evaluate the quality of any made thing in your hands within a few seconds, and your face shows it.", alignment: "LN" },
    { text: "You introduce yourself with your craft as if it were your second name.", alignment: "LN" },
    { text: "You keep a notebook of techniques and ideas, and you'd lose sleep before losing it.", alignment: "LN" }
  ],

  haunted_one: [
    { text: "You scan rooms for the dark corners first.", alignment: "N" },
    { text: "You speak softly without meaning to, the way people do around the sleeping or the dead.", alignment: "N" },
    { text: "You go quiet at certain words — some predictable, some not — and people learn to step around them.", alignment: "N" }
  ],

  hermit: [
    { text: "You speak less than the situation calls for, and the silence often does the work.", alignment: "LN" },
    { text: "You forget how loud taverns are, and you remember why you left when you walk into one.", alignment: "N" },
    { text: "You watch people the way you used to watch the seasons — patient, unhurried, slow to judge.", alignment: "NG" }
  ],

  investigator: [
    { text: "You notice the lie before you notice that you've noticed it.", alignment: "LN" },
    { text: "You memorize people's faces against their words, and you compare them later.", alignment: "LN" },
    { text: "You ask questions in an order designed to let people contradict themselves, and you don't always tell them.", alignment: "LN" }
  ],

  knight_of_the_order: [
    { text: "You stand to attention without thinking when authority enters a room, even when the authority isn't yours to obey.", alignment: "LN" },
    { text: "You speak the language of vows and oaths in casual conversation, and you mean it every time.", alignment: "LG" },
    { text: "You bow your head a fraction when you greet equals, and a touch deeper for those above your station.", alignment: "LG" }
  ],

  mercenary_veteran: [
    { text: "You price a job within seconds of hearing it, in your head, and your face doesn't quite hide it.", alignment: "CN" },
    { text: "You sleep with a weapon within reach, and you don't apologize for it.", alignment: "N" },
    { text: "You count contracts, not friendships, and you're honest about the difference.", alignment: "N" }
  ],

  noble: [
    { text: "You expect to be heard when you speak, and it confuses you when you aren't.", alignment: "LN" },
    { text: "You dress for the room, even when no one is looking.", alignment: "LN" },
    { text: "You phrase requests as if refusal isn't an available answer.", alignment: "LN" }
  ],

  outlander: [
    { text: "You read weather without looking up, by the way the air is moving.", alignment: "N" },
    { text: "You go quiet inside walls, the way other people go quiet outside them.", alignment: "N" },
    { text: "You walk for hours before you notice you've been walking, and you don't tire the way town-folk do.", alignment: "N" }
  ],

  sage: [
    { text: "You quote sources in casual conversation and assume people are following.", alignment: "LN" },
    { text: "You correct factual errors before you've decided whether to, and sometimes you regret it.", alignment: "LN" },
    { text: "You read while you eat, and you eat slower than people who don't.", alignment: "LN" }
  ],

  sailor: [
    { text: "You refer to directions by the wind even on dry land — windward, leeward — and people look at you funny.", alignment: "N" },
    { text: "You walk with the rolling gait of a deck even when the floor isn't moving.", alignment: "N" },
    { text: "You never refuse a drink among shipmates, and you remember every face that's bought you one.", alignment: "CN" }
  ],

  soldier: [
    { text: "You count entrances and exits the moment you enter a room.", alignment: "N" },
    { text: "You speak in clipped sentences when stressed, the way command speaks under fire.", alignment: "LN" },
    { text: "You're up before dawn whether anyone's calling muster or not.", alignment: "LN" }
  ],

  urban_bounty_hunter: [
    { text: "You read a stride from across a square — who's hurrying, who's hiding, who's pretending they aren't.", alignment: "N" },
    { text: "You wait, and the waiting doesn't feel like waiting to you the way it does to other people.", alignment: "CN" },
    { text: "You answer questions about your work in as few words as possible, and you don't volunteer.", alignment: "N" }
  ],

  urchin: [
    { text: "You eat fast, like the food might be taken back.", alignment: "N" },
    { text: "You notice every coin purse in a room without meaning to.", alignment: "CN" },
    { text: "You sleep light, with one ear open for the wrong kind of footstep.", alignment: "N" }
  ]
};
