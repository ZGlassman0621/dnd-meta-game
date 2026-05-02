/**
 * Per-theme narrative-continuity copy for Step 4 (Class & Calling) in
 * handoff mode. Per PHASE_2_CREATOR_SPEC.md §5.4.5.
 *
 * 19 entries — one per emergence-eligible theme. Knight of the Order
 * and Haunted One are intentionally absent per Decision D (they cannot
 * arrive via handoff). Missing entry → no card render.
 *
 * The card sits ABOVE the class dropdown, anchored to the locked theme
 * (NOT the suggested class). Each ends with present-imperative framing
 * that hands off to the dropdown beneath it. Voice is load-bearing —
 * verbatim, no edits, per PM ruling.
 *
 * Card is dismissable per spec §5.4.6 — local-session-scoped boolean,
 * not persisted across save/resume.
 */

export const THEME_NARRATIVE_CONTINUITY = {
  soldier:
    "You've held the line, marched in formation, taken orders and given them. The discipline is in your bones — now choose how you'll bring it to a wider fight:",
  sage:
    "Years in study halls, archives, and dusty libraries have given you a mind that catalogues everything and forgets nothing. The knowledge is yours — now choose how you'll wield it:",
  criminal:
    "You learned the city's underside the hard way — which doors give, which hands take, which alleys swallow people whole. The skills are sharp — now choose what to do with them:",
  acolyte:
    "Years of devotion, ritual, and quiet labor in service of a faith have shaped how you move through the world. The calling is rooted — now choose how you'll answer it:",
  charlatan:
    "You've worn a hundred faces and made each one believable. The art of becoming someone else is yours — now choose who you'll be when the lie has to hold:",
  entertainer:
    "Stages, taverns, market squares — wherever you've performed, you've felt people lean in or turn away. You know what moves them. Now choose what you'll move them toward:",
  noble:
    "Born to privilege, raised among people who command others without raising their voice. The expectation of authority is in the way you walk and speak. Now choose how you'll exercise it:",
  outlander:
    "The wild raised you. You know your forest, your mountain, your steppe — its silences, its cycles, the particular way it kills the unprepared. The wilderness is yours, but only the part you call home. Now choose how you'll carry it into wider lands:",
  sailor:
    "Salt in your skin, the deck under your feet, the company of people who knew that survival was shared. The sea taught you what it taught — now choose what you'll do on land:",
  far_traveler:
    "You came from somewhere far away, and everywhere you go you're an outsider — but an outsider sees what locals miss. You carry a wider world inside you. Now choose how you'll use what you see:",
  guild_artisan:
    "You served apprenticeship under a master, learned a craft to a standard the guild would accept, and earned the right to call yourself a maker. The trade is yours, the network is yours. Now choose how you'll take both into the wider world:",
  clan_crafter:
    "Your craft was taught not by a guild but by your kin — passed from hand to hand, generation to generation, in patterns older than any city's commerce. The work is heritage. Now choose how you'll carry the line:",
  hermit:
    "You withdrew from the world to find what couldn't be found in it. Years of solitude sharpened your inner edge — and gave you something to bring back. Now choose how you'll carry it among people again:",
  investigator:
    "You learned to read what other people overlook — a scuffed boot, a witness's hesitation, the gap between what's said and what's true. The case-shaped mind is yours. Now choose what you'll bring to the cases that matter:",
  city_watch:
    "You walked the same streets every shift, knew which doors opened, which alleys ran into trouble, which neighbors were lying when they said they hadn't seen anything. The city is in your bones. Now choose what you'll do when the city's edges aren't enough:",
  mercenary_veteran:
    "You've fought for coin in more places than most people see in a lifetime. The contracts taught you what loyalty is worth and what it isn't. The skill is real, the scars are real. Now choose what you'll fight for next:",
  urban_bounty_hunter:
    "You hunt people. You've learned to read a stride from across a square, to find the room someone doesn't want you in, to wait three days for the moment that breaks them. The instincts are sharpened. Now choose how you'll use them when the marks are bigger than they were:",
  folk_hero:
    "Something you did got remembered. Maybe you stood up to a tyrant, or saved someone everyone had given up on, or just refused to back down when others did. The story is yours, whether you want it or not. Now choose what you'll do with the weight people have given you:",
  urchin:
    "You learned to be small, quiet, invisible — the kind of someone people's eyes slide past without registering. You ate when you could, slept where you could, and watched everything. The street made you. Now choose what you'll do with the lessons it taught:"
}
