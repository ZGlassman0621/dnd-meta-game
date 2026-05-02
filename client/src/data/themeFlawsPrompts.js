/**
 * Per-theme flaws prompts — clickable starters for Step 7's "Flaws"
 * field (Model A: click drops into textarea, then editable). Per
 * PHASE_2_CREATOR_SPEC.md §7.5.
 *
 * Flaws describe the character's failure mode under stress, grief,
 * temptation, or pressure. They should feel like things a *good person*
 * could carry as easily as a bad one. Evil-axis flaws describe vices a
 * person carries with awareness — cruelty noticed and not stopped, greed
 * acknowledged and acted on — rather than declarations of villainy
 * (Decision 5).
 *
 * Coverage: full 9-square. Counts per theme range 4-6; total ~106
 * prompts.
 *
 * Storage shape: { themeId: [{ text, alignment }] }
 */

export const THEME_FLAWS_PROMPTS = {
  acolyte: [
    { text: "You judge faithlessness harshly, and the judgment shows on your face before you've decided what to say.", alignment: "LN" },
    { text: "You retreat into ritual when grief comes, and people close to you have learned not to expect comfort then.", alignment: "LN" },
    { text: "You suspect your own doubts are tests, and you sometimes pray when you should be listening.", alignment: "LG" },
    { text: "You assume your faith's authority extends further than it does, and you've offered counsel where it wasn't welcome.", alignment: "LN" },
    { text: "You take pleasure in the discomfort of those who reject the faith, and you've stopped pretending you don't.", alignment: "LE" }
  ],

  charlatan: [
    { text: "You can't help running a small con on people you've just met — small enough that they don't notice, big enough that you do.", alignment: "CN" },
    { text: "You assume everyone is performing the way you do, and you trust no one's stated reasons.", alignment: "CN" },
    { text: "You leave when things get too real, and you've burned good relationships doing it.", alignment: "CN" },
    { text: "You can't stop yourself from helping a mark you've already cheated, and the inconsistency has cost you crews who counted on it.", alignment: "NG" },
    { text: "You enjoy the moment a mark realizes you've taken them, and you've stopped pretending the satisfaction isn't part of why you do it.", alignment: "NE" }
  ],

  city_watch: [
    { text: "You see crimes where there are only people, and you've made bad calls on bad evidence more than once.", alignment: "LN" },
    { text: "You don't trust outsiders to a community, and you're sometimes the last to admit one belongs.", alignment: "LN" },
    { text: "You hold grudges from the job — names, faces, slights — and you carry them long past their use.", alignment: "LN" },
    { text: "You take orders from above without asking what they're for, and you've executed them and asked later, and the answers haven't always sat well.", alignment: "LE" },
    { text: "You've leaned on people who couldn't push back — informants, suspects, neighbors — and you tell yourself you'll stop, and you haven't.", alignment: "LE" }
  ],

  clan_crafter: [
    { text: "You won't be rushed, even when speed is what the situation calls for.", alignment: "LN" },
    { text: "You take other crafters' shortcuts as a personal insult, and you say so when you shouldn't.", alignment: "LN" },
    { text: "You measure your kin by your own standards, and you've driven people away with the measuring.", alignment: "LN" },
    { text: "You can't refuse a request from kin, even when the request is unreasonable, and you've worked yourself sick honoring family obligations.", alignment: "LG" },
    { text: "You hide flaws in your work from buyers when you can get away with it, and the patterns you teach the next generation include the cover-up.", alignment: "LE" }
  ],

  criminal: [
    { text: "You take small things that aren't yours, even when you don't need them, and you don't feel bad about it.", alignment: "CN" },
    { text: "You assume betrayal before it comes, and you've burned allies who never planned to turn.", alignment: "CN" },
    { text: "You'll lie when the truth would serve you, just to keep the muscle of lying ready.", alignment: "CN" },
    { text: "You can't stop yourself from giving away what you've stolen when you see real need, and the crews who've trusted you have learned to plan around it.", alignment: "CG" },
    { text: "You hurt people who've crossed you more than the situation called for, and the part of you that did it didn't feel like a stranger.", alignment: "CE" }
  ],

  entertainer: [
    { text: "You need an audience to feel real, and you fade quietly in rooms where no one's watching.", alignment: "CN" },
    { text: "You take criticism harder than the work deserves, and you hide it badly.", alignment: "CN" },
    { text: "You can't resist a stage, even when the moment isn't yours, and you've stepped on others to get there.", alignment: "CN" },
    { text: "You give too freely to younger performers — coaching, advances, references — and you've left yourself short doing it.", alignment: "NG" },
    { text: "You manipulate audiences and lovers using the same craft, and you've stopped distinguishing between performance and intimacy.", alignment: "NE" }
  ],

  far_traveler: [
    { text: "You hold your home up as the standard, and you condescend without realizing you're doing it.", alignment: "LN" },
    { text: "You leave before relationships deepen — there's always somewhere else to be — and you've broken hearts you'd swear you didn't mean to.", alignment: "CN" },
    { text: "You distrust local customs you don't understand, and you've insulted hosts by acting on the distrust.", alignment: "N" },
    { text: "You can't pass a stranger in trouble without stopping, and the stops have cost you appointments, contracts, and once nearly your life.", alignment: "NG" },
    { text: "You consider yourself above local laws because you'll be gone before the consequences catch up, and sometimes you're right and sometimes you aren't.", alignment: "CE" }
  ],

  folk_hero: [
    { text: "You believe the story people tell about you, and you choose its lessons over what's actually in front of you.", alignment: "CG" },
    { text: "You can't stand to be doubted, and you've gotten loud with people who only meant to ask.", alignment: "CN" },
    { text: "You feel responsible for everyone in trouble, and you've gotten yourself badly hurt by acting on that.", alignment: "NG" },
    { text: "You won't take a side in a fair disagreement, because both sides are your people, and your refusal has been read as cowardice it isn't.", alignment: "NG" },
    { text: "You've started thinking the wrongs done to you and yours justify acts you wouldn't have done before, and the line keeps moving.", alignment: "NE" }
  ],

  guild_artisan: [
    { text: "You judge people by the quality of what they make or own, and the judgment is hard to hide.", alignment: "LN" },
    { text: "You can't accept work you think is below your standard, even when you need it, and pride costs you coin you can't afford.", alignment: "LN" },
    { text: "You're slow to forgive crafters who undercut the guild, and you carry the grudge into rooms it shouldn't enter.", alignment: "LN" },
    { text: "You give work away to those who can't afford it more often than the guild approves of, and your books reflect it.", alignment: "NG" },
    { text: "You overcharge wealthy clients to compensate, and you take a private satisfaction in the practice that goes beyond the math.", alignment: "LE" }
  ],

  haunted_one: [
    { text: "You go cold when the haunting surfaces, and people close to you have learned to wait it out alone.", alignment: "N" },
    { text: "You assume the worst possible outcome reflexively, and you've sabotaged good things by preparing for their loss.", alignment: "N" },
    { text: "You drink, work, walk, or fight too hard when the memory presses — whatever it is, you do it past the point of use.", alignment: "CN" },
    { text: "You can't refuse to help anyone whose situation echoes what happened to you, and you've followed strangers into trouble for it.", alignment: "NG" },
    { text: "You've started to believe that the ones who hurt you deserve worse than the law would give, and the belief has begun to look like a plan.", alignment: "NE" }
  ],

  hermit: [
    { text: "You retreat into silence when conversations turn loud, and people read it as judgment whether or not you mean it.", alignment: "LN" },
    { text: "You believe your insight is harder-won than other people's, and the belief shows.", alignment: "LN" },
    { text: "You can't stand crowds for long, and you'll find an excuse to leave even when the leaving costs you.", alignment: "N" },
    { text: "You give your last to those in need, and you've left yourself without resources you'd need to survive a hard winter.", alignment: "NG" },
    { text: "You've started to see most of humanity as the noise you went away from, and you've stopped trying to hide the contempt.", alignment: "CE" }
  ],

  investigator: [
    { text: "You can't let a question rest when something doesn't add up, and you've damaged friendships poking at things people wanted left alone.", alignment: "LN" },
    { text: "You assume motive before evidence, and you've been wrong embarrassingly often without changing the habit.", alignment: "LN" },
    { text: "You sleep poorly when a case is open, and the people around you live with what that does to your temper.", alignment: "LN" },
    { text: "You take cases pro bono when the victim has no other recourse, and you've nearly bankrupted yourself doing it.", alignment: "LG" },
    { text: "You've used what you've found out as leverage — small things, mostly, but the pattern is there, and you've stopped feeling bad about it.", alignment: "LE" }
  ],

  knight_of_the_order: [
    { text: "You measure others against your vows, and find them wanting in ways you struggle to keep to yourself.", alignment: "LN" },
    { text: "You can't bend a code you've sworn to, even when bending would serve a greater good than keeping.", alignment: "LN" },
    { text: "You expect deference from people who haven't agreed to give it, and the expectation embarrasses you when you catch it.", alignment: "LN" },
    { text: "You won't refuse a request for protection, and you've taken on causes that couldn't be won, because refusing felt like a betrayal of what you swore.", alignment: "LG" },
    { text: "You believe the order's enemies don't deserve the protections of the law, and you've acted on that belief in ways you wouldn't write home about.", alignment: "LE" }
  ],

  mercenary_veteran: [
    { text: "You count what you're owed before you count what you've been given, and you've burned employers over slights they didn't realize they'd given.", alignment: "N" },
    { text: "You go cold during conflict, and people who care about you have to wait until the work is done to see you again.", alignment: "N" },
    { text: "You don't form attachments to employers, locations, or causes — you've done it before, and the grief wasn't worth it.", alignment: "N" },
    { text: "You can't refuse a contract that would protect noncombatants, even at cost — the work you used to do haunts you that way.", alignment: "NG" },
    { text: "You stopped asking what the contract was for somewhere along the way, and you don't always like what you find out afterward — but you take the next contract anyway.", alignment: "LE" }
  ],

  noble: [
    { text: "You expect to be deferred to, and you treat people who don't as if they're being rude.", alignment: "LN" },
    { text: "You retreat into the dignity of your station when you don't know what to say, and it makes you seem cold when you mean to seem composed.", alignment: "LN" },
    { text: "You judge the unrefined harshly, even when the unrefined are doing the right thing better than you are.", alignment: "LN" },
    { text: "You can't ignore a slight against your house, and the responses you've made have escalated situations that didn't need escalating.", alignment: "LN" },
    { text: "You believe your house's interests outweigh most others, and the belief has shaped decisions you'd rather not have to defend.", alignment: "LE" }
  ],

  outlander: [
    { text: "You distrust city walls, city laws, and city people, and the distrust shows whether you mean it to or not.", alignment: "CN" },
    { text: "You don't ask for help, even when not asking will cost you, because asking was something you learned not to do.", alignment: "N" },
    { text: "You go quiet around crowds, and the quietness has been read as menace more than once.", alignment: "N" },
    { text: "You can't refuse hospitality once it's been formally offered, and the obligation has taken you places you should have refused to go.", alignment: "LG" },
    { text: "You've started solving problems with people the way you'd solve problems with predators, and the line between has gotten thin.", alignment: "CE" }
  ],

  sage: [
    { text: "You correct people when correcting them isn't useful, and you do it without registering that you're doing it.", alignment: "LN" },
    { text: "You assume a problem can be reasoned through, and you've lost arguments — and people — by refusing to see when it can't.", alignment: "LN" },
    { text: "You hoard books, notes, and rare facts the way merchants hoard coin, and you'd rather not lend than risk a loss.", alignment: "LN" },
    { text: "You give your time to students who can't pay you, and you've left more profitable work undone for it.", alignment: "NG" },
    { text: "You've published work that you knew would hurt people, and the publication felt clean to you because the work was true.", alignment: "LE" }
  ],

  sailor: [
    { text: "You drink harder than the situation calls for, and you've made decisions ashore that the deck-version of you wouldn't have.", alignment: "CN" },
    { text: "You hold grudges across years and harbors, and you've started fights with people who didn't remember why you'd want one.", alignment: "CN" },
    { text: "You go restless when you've been on land too long, and you've left jobs and people behind to chase the next ship.", alignment: "CN" },
    { text: "You won't sail past survivors of a wreck without stopping, even when the contract says otherwise, and the captains who hire you have learned to expect it.", alignment: "CG" },
    { text: "You've taken what wasn't yours from prizes the captain didn't know about, and you've gotten harder about it as the years passed.", alignment: "CE" }
  ],

  soldier: [
    { text: "You assume civilian situations have a chain of command, and you bristle when no one is in charge.", alignment: "LN" },
    { text: "You go quiet when grief comes — the way the line goes quiet — and people who haven't served read it as not caring.", alignment: "LN" },
    { text: "You can't tolerate disorder, and you've made enemies of people who weren't trying to fight you.", alignment: "LN" },
    { text: "You can't refuse a fellow veteran's request, even when the request is unreasonable, and the obligation has cost you more than once.", alignment: "LN" },
    { text: "You followed an order once that you should have refused, and you've stopped letting yourself think about it, and the not-thinking is its own kind of cost.", alignment: "LE" }
  ],

  urban_bounty_hunter: [
    { text: "You see marks where there are only people, and you've assessed strangers for capture-difficulty without meaning to.", alignment: "N" },
    { text: "You go cold during a hunt, and friends have learned not to expect anything human from you until the work is done.", alignment: "N" },
    { text: "You don't quit a contract once you've taken it, even when the right thing would be to walk away.", alignment: "LN" },
    { text: "You can't refuse to help when a neighbor or friend is being preyed on by someone the law won't reach, and the work you do then is unpaid and dangerous.", alignment: "NG" },
    { text: "You've taken contracts that you suspected weren't clean, and you've stopped checking whether your suspicions were right.", alignment: "NE" }
  ],

  urchin: [
    { text: "You hide food, even when you have plenty, and you've embarrassed yourself when someone has noticed.", alignment: "N" },
    { text: "You assume kindness has a price, and you've insulted people who only meant to be kind.", alignment: "CN" },
    { text: "You keep small lies running about your past, and the lies have outlived their usefulness without you stopping them.", alignment: "CN" },
    { text: "You can't pass a hungry child without giving them what you have, and you've gone without yourself doing it more than once.", alignment: "NG" },
    { text: "You take what you need without asking when no one is watching, and the streets-rules are still your rules even though the streets are behind you.", alignment: "CN" },
    { text: "You've hurt people who reminded you of who hurt you, and you didn't always check whether they deserved what they got.", alignment: "CE" }
  ]
};
