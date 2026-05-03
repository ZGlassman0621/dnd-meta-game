/**
 * Per-theme personality prompts — clickable starters for Step 7's
 * "Personality traits" field (Model A: click drops into textarea, then
 * editable). Per PHASE_2_CREATOR_SPEC.md §7.2.
 *
 * Phase 2 close-out (2026-05-03): full alignment coverage. 21 themes ×
 * 9 alignments = 189 prompts. Replaces the v1.0.114 ship which had
 * 3 prompts per theme with heavy alignment skew (every theme missing
 * at least one alignment, several missing all but one). Per PM rule:
 * every theme requires at least one prompt for each of the 9 alignments
 * so players are never funneled into an alignment they didn't intend.
 *
 * Authoring notes (PM 2026-05-03): 21 prompts carried forward from the
 * existing file unchanged; 168 are new. Voice rules from Phase 2
 * Decision 5 + the 2026-05-03 institution-shifts-with-alignment
 * refinement apply throughout — a Charlatan can be Lawful-Good (a
 * reformed con artist who now uses persuasion for charity) but it
 * still feels like a charlatan, not a paladin.
 *
 * Alignment indicators are 5e 9-square abbreviations: LG, NG, CG, LN,
 * N, CN, LE, NE, CE. Always-visible inline alongside prompt text per
 * Decision 3 (DECISION_LOG 2026-05-02).
 *
 * Storage shape: { themeId: [{ text, alignment }] }
 *
 * Export naming note: keeps UPPER_SNAKE binding (THEME_PERSONALITY_PROMPTS)
 * for existing consumers (Step7IdentityDetails, theme-content-data.test);
 * adds camelCase alias (themePersonalityPrompts) + default export per
 * PM's transcription convention.
 */

export const THEME_PERSONALITY_PROMPTS = {
  acolyte: [
    { text: "You serve a tradition older than any throne, and the work is the same wherever you go: feed the hungry, mend the sick, bury the unclaimed dead. The world is held together by these small kept rituals.", alignment: "LG" },
    { text: "Faith is what you do when no one is watching, and you have done it daily for years. The temple gave you a frame; the years made the frame yours.", alignment: "NG" },
    { text: "Your god is mercy without rules — the hand to the drowning regardless of who they were before they fell. You walk where the mercy is needed, and you do not ask the bishopric's leave.", alignment: "CG" },
    { text: "The order has rites for every hour and rules for every rite. You keep them, all of them, because the keeping is what makes the order real.", alignment: "LN" },
    { text: "You have served at the altar long enough to know the gods do not answer most prayers, and you have made peace with the silence. The work is still worth doing.", alignment: "N" },
    { text: "The temple chains the divine in incense and ritual. You left the order to find what they were too frightened to face — gods do not live in stone, and you are done pretending otherwise.", alignment: "CN" },
    { text: "Cosmic order is the value, and the morality of any single act subordinates to maintaining it. The condemned heretic, the burned book, the brutal reform — these are not cruelty. These are the price of a world that does not collapse.", alignment: "LE" },
    { text: "You wear the vestments and you say the words and you have not believed in years. The temple has assets, the assets have caretakers, and the caretakers have private accounts. You learned the system; the system rewards the patient.", alignment: "NE" },
    { text: "Your god demands suffering, and the world does not lack for raw material. You have learned to recognize the offering when it presents itself, and to make one when it does not.", alignment: "CE" }
  ],

  charlatan: [
    { text: "A good lie can do what an honest word cannot. You have led mourning widows to peace they could not have found at the truth's altar.", alignment: "LG" },
    { text: "You read people the way scholars read texts — every gesture a clue, every silence a chapter. What you do with that reading is up to you, and you choose, mostly, to be kind.", alignment: "NG" },
    { text: "You believe everyone deserves to feel chosen, even if only for the length of an evening. That you profit from the feeling does not make it less real.", alignment: "CG" },
    { text: "Your reputation is your livelihood, and your reputation is built on never breaking a contract — even the unspoken ones. The mark must walk away believing they got their money's worth.", alignment: "LN" },
    { text: "You are not a liar — you are a tailor of truths. The story you tell each person is the story they wanted to hear before they ever met you.", alignment: "N" },
    { text: "Every mark is a small puzzle, and every puzzle solved is a small joy. The money is incidental; the satisfaction of the perfect line is what keeps you alive.", alignment: "CN" },
    { text: "Power runs on appearances, and you are the architect of appearances. You sell legitimacy to those who cannot inherit it, and you charge what the market will bear.", alignment: "LE" },
    { text: "You have ruined people who deserved ruining and people who didn't. You no longer keep track; the work pays the same either way.", alignment: "NE" },
    { text: "You enjoy the moment a face changes — the dawn of understanding that the floor was never solid. That moment is the only honest thing about your life.", alignment: "CE" }
  ],

  city_watch: [
    { text: "You took the oath because the city needed someone willing to take it, and you have kept it through commanders who didn't deserve your loyalty. The badge means what you make it mean, and you have made it mean something.", alignment: "LG" },
    { text: "You know your district, every corner of it, and you know which quarrels need a baton and which need a quiet word at the bakery the next morning. The watch isn't enforcement — the watch is presence.", alignment: "NG" },
    { text: "You believe in policing without the apparatus — the captain who walks his beat, the constable who knows every name on the street, the unofficial mediations that never reach a magistrate. The book has its place; the people are the point.", alignment: "CG" },
    { text: "The chain of command exists for a reason, and the reason is that one person's judgment is not enough. You take orders, you give them to those below you, and you trust the structure to be wiser than any of its parts.", alignment: "LN" },
    { text: "You have seen enough crime and enough punishment to have stopped sorting them. You do the work; the courts do their work; the gods, if they exist, do theirs. None of it is your problem past your shift.", alignment: "N" },
    { text: "The watch protects its district through whoever's willing to do the protecting — the merchant who tips you off, the urchin who runs your messages, the fence who knows what's stolen and whose. The official structure pretends none of this exists. You both know better.", alignment: "CN" },
    { text: "Fear keeps the peace. The watch is the visible reminder of what the city does to those who forget their place, and you are not ashamed to be that reminder. Order has costs; the alternative has more.", alignment: "LE" },
    { text: "You take the bribe, you look the other way, you write up the report that pleases whoever's looking at it that month. The watch pays a wage; the city pays the rest, and the city is generous to those who understand the arrangement.", alignment: "NE" },
    { text: "You have the badge, the baton, and the latitude that comes with both. Some nights the latitude is the whole point — finding someone who won't be missed, taking the night somewhere the report won't follow.", alignment: "CE" }
  ],

  clan_crafter: [
    { text: "Your craft is your clan's hands, your clan's hands are your ancestors', and your ancestors made the world more solid than they found it. You owe them the same.", alignment: "LG" },
    { text: "What the clan makes, the clan makes for keeping. Generations from now, someone will hold what you made and know it was made well. That is enough.", alignment: "NG" },
    { text: "The clan taught you the craft, but the craft is yours now — and you have given it to people who needed it more than the clan needed the secret. They forgive you. They don't always know.", alignment: "CG" },
    { text: "The clan is older than any nation that has tried to absorb it, and the clan endures because the rules endure. You honor the master's mark, the apprentice's silence, the generation's debt to the next. Order is how a small people survive.", alignment: "LN" },
    { text: "The work is constant, the techniques are old, and the world outside the workshop is rumor. You make things. The making is the life.", alignment: "N" },
    { text: "You broke from the clan over something they thought was small and you thought was everything. You took the craft with you. They write; you don't answer.", alignment: "CN" },
    { text: "The clan's secrets are the clan's wealth, and the clan's wealth flows upward. You have spent decades climbing — apprentice, journeyman, master, elder — and you have not been kind to those whose climb threatened yours. The summit will be quiet at the top.", alignment: "LE" },
    { text: "You make what the buyer wants and you do not ask what the buyer wants it for. The clan stopped asking generations ago; that is part of what made the clan rich.", alignment: "NE" },
    { text: "The forge knows what you make in it, and the forge has not been honest in years. There are things in your inventory that should not exist, made for clients you do not name, and the satisfaction of having made them well is its own clean thing.", alignment: "CE" }
  ],

  criminal: [
    { text: "Every score you've taken has gone toward something larger than yourself — a debt unpaid for someone who couldn't pay it themselves, a family without a breadwinner, a roof that wouldn't have stood without you.", alignment: "LG" },
    { text: "You broke the law because the law broke first, and you have never once been ashamed of the choice. The people you steal from can afford the loss.", alignment: "NG" },
    { text: "Locks are puzzles and laws are suggestions. You have never robbed someone who couldn't take it, and you have given more than you've kept.", alignment: "CG" },
    { text: "The crew is the thing. You don't break a contract, you don't squeal on a partner, and you pay your tithe to whoever's running the territory. There are rules to this.", alignment: "LN" },
    { text: "You take work as it comes. The job is the job; the moralizing belongs to people who can afford it.", alignment: "N" },
    { text: "You walk light, sleep where the night finds you, and answer to no one. The day someone tries to put you under a roof you didn't pick is the day they learn what you are.", alignment: "CN" },
    { text: "There is an order to the underworld, and you serve it. The work is ugly but the structure is clean: you do what's asked, you collect, and the city above never knows the city below kept it standing.", alignment: "LE" },
    { text: "You hurt people for money and you have stopped pretending otherwise. The pretending was always the worst part.", alignment: "NE" },
    { text: "The fear in their eyes is the wage. The coin is just what they call it on the ledger.", alignment: "CE" }
  ],

  entertainer: [
    { text: "You believe a song shared in a tavern can do more for a soul than a sermon. You sing for the broken-down, the road-weary, the just-bereaved — and you have never once asked them to pay.", alignment: "LG" },
    { text: "The stage is where the real you lives, and the real you is generous. You give every audience your best, even the ones who don't know what they're hearing.", alignment: "NG" },
    { text: "You play for whoever needs the playing. A wedding, a wake, a midnight on the road — the song knows when to come.", alignment: "CG" },
    { text: "Performance is a craft, and craft has rules. You hit your marks, you don't upstage your fellows, and you give the audience exactly what they came for. Discipline is what separates artists from buskers.", alignment: "LN" },
    { text: "The road is your stage and the stage is your home. You move through the world like a song moves through a room — there, then gone, leaving the air a little different.", alignment: "N" },
    { text: "You play what moves you and you live where the playing takes you. Schedules, troupes, contracts — those are for performers who never learned what their voice is for.", alignment: "CN" },
    { text: "You sing for the courts of the powerful because the powerful are the only audience that matters. Every patron is a string you've learned to pluck, and the song is whatever they need to hear.", alignment: "LE" },
    { text: "You have ruined reputations from the stage with a single well-aimed verse. The audience laughs; the target never recovers. You sleep well.", alignment: "NE" },
    { text: "You like the moment a crowd turns — when laughter curdles, when a song goes somewhere they weren't ready for. You did that. They followed you there.", alignment: "CE" }
  ],

  far_traveler: [
    { text: "Your home was not kind to those who could not defend themselves, and you carry that lesson forward. Every village you pass through, you leave a little safer than you found it.", alignment: "LG" },
    { text: "You came from somewhere most of these people have never heard of, and you find them strange in ways you keep mostly to yourself. They have been kind to you. You return the kindness, and a little extra.", alignment: "NG" },
    { text: "Home was a structure you outgrew. Out here you are who you choose to be, and you choose to be open-handed. The road taught you that the kindness you give comes back in shapes you didn't expect.", alignment: "CG" },
    { text: "You carry your homeland's customs the way some people carry holy texts — observed daily, defended when challenged, never compromised for convenience. The world bends to a person who does not bend to it.", alignment: "LN" },
    { text: "You came from somewhere far. The somewhere is not for telling, and the leaving is not for explaining. You are here now, and here is enough.", alignment: "N" },
    { text: "Distance taught you that nothing is fixed — not custom, not language, not the names of the gods. You move through these lands the way a river moves through stones, shaped by them and shaping them in return.", alignment: "CN" },
    { text: "Your homeland's traditions hold a hierarchy that the locals would find appalling, and you have stopped explaining. You command what your station entitles you to command. The locals adapt; they always do.", alignment: "LE" },
    { text: "You were exiled, and the exile was the kind that costs blood to overturn. You earn what you can in these lands, but the homeland is the goal, and the homeland will not be returned to gently.", alignment: "NE" },
    { text: "Where you come from, certain practices were not crimes. They are crimes here. You have adjusted your habits where the local guards are watching, and not where they are not.", alignment: "CE" }
  ],

  folk_hero: [
    { text: "You stood up because no one else would, and you were lucky — luckier than you knew at the time. Now you are what you are: the one who stood, and the one whom others come to when standing is needed again.", alignment: "LG" },
    { text: "Your village still tells the story, and the telling is bigger than what actually happened. You don't correct them. The story is doing work.", alignment: "NG" },
    { text: "What you did, you did because someone had to. The fame is awkward; the work is what matters; the next person who needs you is already on their way.", alignment: "CG" },
    { text: "The people gave you their trust, and you understand what trust requires. You hold court when you must, you mediate when asked, and you keep the customs because the customs are how the people remember themselves.", alignment: "LN" },
    { text: "What you did, you did. The town made a story of it; you made a life around the story. Both are true and neither is the whole.", alignment: "N" },
    { text: "You took up the cause and you walked away from the cause when it became something you didn't recognize. The town still loves you for what you started; you have learned not to ask what it became.", alignment: "CN" },
    { text: "The hero of the people enforces a harsh order because the people, left to themselves, choose poorly. You took the role because someone with the standing had to take it, and the standing came from your own past kindnesses. The structure now is not kindness; the structure now is necessary.", alignment: "LE" },
    { text: "The village made a hero of you, and you learned what a hero can extract — small tributes, small favors, the kind of credit that compounds. They keep telling the old story; you keep collecting on it.", alignment: "NE" },
    { text: "What you did, you did for reasons the songs leave out. You let it be sung the cleaner way. The town would not love you if they knew, and you have learned that being loved is more useful than being known.", alignment: "CE" }
  ],

  guild_artisan: [
    { text: "Your craft serves more than your purse. The widow's mended cloak, the orphan's first pair of real shoes, the chair that will outlast its maker — these are your tithe to a world that needs more good things made.", alignment: "LG" },
    { text: "What you make, you make well, and what you make well lasts. That is your contribution to the world; the rest is sentiment.", alignment: "NG" },
    { text: "You took up the craft because someone you loved did, and you carry their hands forward in your own. Every piece is a small kept promise.", alignment: "CG" },
    { text: "The guild is the bedrock of every honest city, and you are the bedrock of your guild. Standards, apprenticeships, the right way to do things — you keep faith with the craft as your master kept faith with theirs.", alignment: "LN" },
    { text: "You make things. People buy them. The work is the point and everything else is conversation.", alignment: "N" },
    { text: "You don't take orders from a guildmaster's chart — you make what the work asks for. Some pieces have been waiting in your hands for years, and you'll finish them when they're ready, not when the ledger demands.", alignment: "CN" },
    { text: "The guild is a ladder, and you have been climbing for years. Every apprentice you take on, every contract you broker, every rival you outmaneuver — these are rungs. The view from the top is what you are owed.", alignment: "LE" },
    { text: "You undercut, you pad invoices, you steal designs from journeymen who didn't think to file. The craft is a market and you are not sentimental about markets.", alignment: "NE" },
    { text: "Your work has killed people — a bridge that was never quite trustworthy, a lock that opened to the wrong key, a blade that bent at the moment its owner needed it most. You took payment for each. The flaws were never accidents.", alignment: "CE" }
  ],

  haunted_one: [
    { text: "Whatever sees you sees you still, and you have decided it will not have anyone else. Every life you save is a small refusal — proof that the dark does not get to choose what you do with what you know.", alignment: "LG" },
    { text: "You learned long ago that warmth must be chosen, every day, against the thing that whispers otherwise. You choose it. You will keep choosing it.", alignment: "NG" },
    { text: "Some nights the only thing that keeps you walking is the laugh of a stranger you helped on the road yesterday. You collect those laughs. They are your real currency.", alignment: "CG" },
    { text: "You keep the rituals — the salt at the threshold, the words before sleep, the small precise habits that hold the line. Without them you are not a person; you are the thing's address.", alignment: "LN" },
    { text: "What follows you is not for telling. You move through the world like someone with a back wound — careful, sideways, never quite at rest.", alignment: "N" },
    { text: "You drink and you wander and you do not sleep where you said you would. The one rule you keep is the rule of motion. What's behind you cannot catch what does not stop.", alignment: "CN" },
    { text: "You learned to negotiate with what haunts you, and you learned what it wants. The cost is paid in coin you did not earn, by people you do not know, and the silence you receive in exchange is worth it.", alignment: "LE" },
    { text: "Whatever broke in you broke a long time ago, and the part of you that minded broke with it. You do what the work asks. The work asks for terrible things sometimes.", alignment: "NE" },
    { text: "You let it out, sometimes, on purpose. The world has been cruel to you and you have taken to being cruel back. The thing inside you approves.", alignment: "CE" }
  ],

  hermit: [
    { text: "You went to the wilderness expecting silence, and found instead that the world wanted to talk to you. You came back when you had something to say in return.", alignment: "LG" },
    { text: "The years alone gave you what crowds could not: the time to know your own mind. You return to the world a better friend, a better listener, a better witness.", alignment: "NG" },
    { text: "The forest taught you what no village could — that there are no rules, only patterns, and the patterns reward attention. You bring this lesson back, and you give it to whoever can hear it.", alignment: "CG" },
    { text: "Your retreat was disciplined, structured by a rule of life you wrote yourself and kept for years. The discipline outlasted the retreat. You carry it with you now: the rising hour, the silent meal, the daily review.", alignment: "LN" },
    { text: "Solitude was the lesson, and the lesson is over. You walk back into the world a little less of a person and a little more of a witness, and you have made peace with the trade.", alignment: "N" },
    { text: "You went to the wilderness because you could not bear another voice, and you came back when the voices in your own head had gone quiet enough to hear. They are quiet now. The world's voices, again, are not.", alignment: "CN" },
    { text: "The retreat showed you patterns the social world conceals — who deserves what, who has earned what, who is owed what. You came back with answers. The community will be reorganized along truer lines.", alignment: "LE" },
    { text: "What you found in the wilderness was not enlightenment. It was the absence of witnesses. You have learned to use that absence, and the wilderness is not the only place it occurs.", alignment: "NE" },
    { text: "You spent years in a place no one watched. Some of what you did there should not be told, and the rest you would tell only to someone you intended not to release.", alignment: "CE" }
  ],

  investigator: [
    { text: "You take the cases the watch won't take and the magistrates won't touch — disappeared servants, beaten apprentices, debts owed by the powerful to the powerless. Someone has to keep the books on what the law forgets.", alignment: "LG" },
    { text: "Truth is the work, and the work is what you owe the people who hired you. You have turned down more lucrative cases than you've taken; the right ones pay in different coin.", alignment: "NG" },
    { text: "You don't believe in justice as a system; you believe in the moment when the wronged person learns what really happened. You exist for those moments.", alignment: "CG" },
    { text: "Cases close one of three ways: solved, paid out, or dropped. You do not let one bleed into another. The process is the thing that separates you from the chaos you wade through.", alignment: "LN" },
    { text: "Questions are the only thing you trust. Answers are usually disappointing, but you keep asking — there's always another question underneath.", alignment: "N" },
    { text: "You don't keep regular hours and you don't keep regular clients. The case finds you, or you find the case, and the rest sorts itself out.", alignment: "CN" },
    { text: "The truth is leverage, and leverage is the most valuable thing in any city. You sell what you find to the people who can pay for it, and the law is whatever your patrons need it to be that week.", alignment: "LE" },
    { text: "You have sold out clients, framed innocents, and let guilty men walk because the alternative was less profitable. The work has taught you that everyone is for sale; you just charge more than most.", alignment: "NE" },
    { text: "You like watching people lie to themselves. The moment they realize you can see through it — that you've been seeing through it the whole time — is the moment you live for.", alignment: "CE" }
  ],

  knight_of_the_order: [
    { text: "Your oath is to a code older than any king, and the code is plain: defend those who cannot defend themselves, and answer for it before the gods at the end of your days. You will answer well.", alignment: "LG" },
    { text: "You serve the order because the order serves the people. The hierarchy is a means, not the point. You honor the structure as long as the structure honors the oath.", alignment: "NG" },
    { text: "The order you swore to is not the order it has become, and your loyalty has shifted to the original spirit rather than its current keepers. You ride alone now, often, and the order's elders write letters you do not answer.", alignment: "CG" },
    { text: "The order is older than you and will outlast you, and your service to it is what gives your life shape. You take the orders, you teach the squires, you keep the watches. The shape is the point.", alignment: "LN" },
    { text: "You took the oath young, and you have kept it long enough that the keeping is no longer about belief. The order is what you do; what you do is the order.", alignment: "N" },
    { text: "Your order is built on chaos — on personal honor over written code, on intuitive justice over the magistrate's verdict, on righteous rebellion against authority that has lost its claim. You answer to your own conscience and to the brothers and sisters who answer to theirs. No grand master commands you.", alignment: "CN" },
    { text: "The order endures because we have the stomach for what others won't. Every brand we burn into the world is a wound that keeps it from rotting further. The peasants in their fields call us cruel; their fields are still standing.", alignment: "LE" },
    { text: "The order rewards those who serve it, and you have served it. Lands, retainers, contracts, the ear of the lords — these were promised at your investiture and they have come, in time, to those patient enough to wait. The oath was the down payment.", alignment: "NE" },
    { text: "The armor is heavy and the sword is sharp and there are villages that have learned this. The order tells itself stories about why; you stopped listening to the stories years ago.", alignment: "CE" }
  ],

  mercenary_veteran: [
    { text: "You took contracts most of your life and you took them honestly — the work clean, the price fair, the cause defensible. The years gave you a reputation, and the reputation is the only thing you've never been willing to sell.", alignment: "LG" },
    { text: "The company was your family for a decade, and you gave the company your best. When the work turned to things your best wouldn't do, you walked. You don't regret either decision.", alignment: "NG" },
    { text: "You fought because the fighting was honest in a way most lives aren't, and you took the side that needed taking. The pay was the cover; the cause was the work.", alignment: "CG" },
    { text: "The contract is sacred. You read it before you sign it, you keep what's in it, and you walk when it expires — no extensions, no favors, no exceptions. The company's reputation is built on contracts honored.", alignment: "LN" },
    { text: "The work is the work. You went where the contracts went, you did what the contracts asked, and you came home with what you came home with. Most of it was tolerable. Some of it wasn't.", alignment: "N" },
    { text: "You took the jobs you wanted and walked from the ones you didn't, and the captains who took offense learned not to push. You answer to the work in front of you, not to a chain of command.", alignment: "CN" },
    { text: "The company has structure, and you have risen in the structure because you understood it earlier than most. You take the contracts that pay; you do not ask whose blood the coin came from. The captain who asks does not stay captain long.", alignment: "LE" },
    { text: "There are villages on the maps you used to carry that no longer have names. The contracts that erased them were profitable. You have stopped sorting which contracts those were.", alignment: "NE" },
    { text: "Some contracts you took for the coin and some you took because the work itself was the wage. You learned which captains pretended not to know the difference, and you sought them out.", alignment: "CE" }
  ],

  noble: [
    { text: "The title is a debt. Every tenant on your lands is owed your protection, every retainer in your house is owed your faith, and every petition in your hall is owed your attention. You will not die owing.", alignment: "LG" },
    { text: "You inherited what you did not earn, and you have spent your life trying to deserve it. The estate is well-run; the people on it know your name; the books balance because someone has been paying attention. That someone is you.", alignment: "NG" },
    { text: "The court is suffocating, and you have spent most of your life finding excuses to leave it. Your tenants prefer you absent and active to present and decorative; you have learned to give them what they prefer.", alignment: "CG" },
    { text: "Your house has stood for generations because each generation honored the obligations the last one accepted. You honor them as well — the contracts, the alliances, the marriages, the feasts. The structure outlasts any of its keepers.", alignment: "LN" },
    { text: "The title gives you doors and the doors lead to rooms and the rooms have people in them. You have learned to walk through, sit down, and listen. Most of the work of nobility is listening.", alignment: "N" },
    { text: "You wear the title the way you'd wear a borrowed cloak — gratefully, and only as long as the weather requires it. The court intrigues bore you, the inheritance tax is an outrage, and the family seat will pass to a cousin who actually wants it.", alignment: "CN" },
    { text: "The lower orders mistake your courtesy for kindness. You allow the mistake; the mistake is useful. Your house has survived seven hundred years by understanding precisely what each tier of the social structure is owed and what it is for.", alignment: "LE" },
    { text: "The estate has debts, the debts have creditors, and the creditors have weaknesses. You have spent the last decade systematically converting the second into the third. Your house will be solvent again, and the cost will be paid by people who never knew they were paying.", alignment: "NE" },
    { text: "The title gives you reach the law cannot follow. You have made use of the reach. The discreet servants, the buried inquiries, the matters that go no further than the manor's walls — these are the privileges of an old name, and you take them.", alignment: "CE" }
  ],

  outlander: [
    { text: "The wild taught you the cost of every decision, and you carry the lesson into the towns: act with care, take only what you need, and leave the place better than you found it. The cities don't always understand you. The lesson holds anyway.", alignment: "LG" },
    { text: "You came from country most of these people fear, and you have found that the fear is misplaced. The wild is honest. You bring its honesty with you into rooms that lack it.", alignment: "NG" },
    { text: "Out here you answer to the weather, the game, the rivers, and your own footing — none of which lie. You came in from the country only when the country sent you. Your loyalty is to it, and to whoever the country sends you to help.", alignment: "CG" },
    { text: "Your people kept the old ways because the old ways kept them alive: the hunt before the feast, the song before the sleep, the rites at the changing of the year. You keep them too, and you keep them precisely. The country has rules even when the country is empty.", alignment: "LN" },
    { text: "You read weather like other people read books, and you have not been wrong about a coming storm in twenty years. The cities baffle you; the country still makes sense; and the country is where you'll die when the time comes.", alignment: "N" },
    { text: "You came down out of the country because the country sent you, and you'll go back when the work that sent you is done. The towns are full of small rules. You break the small ones. You haven't yet broken a large one.", alignment: "CN" },
    { text: "The wild has hierarchies, and the hierarchies are not gentle. You learned which creatures rule and which are ruled, and the lesson translates to civilized lands more cleanly than its inhabitants realize. You have applied it.", alignment: "LE" },
    { text: "You spent your years in country where there were no witnesses, and you came down with habits the cities would call crimes. The cities don't know what you did out there; the cities only see what you do here, and you have been careful here.", alignment: "NE" },
    { text: "You learned to track in country where the things you tracked could track you back, and the lesson was that hunting is not a metaphor. Some of what you have hunted has been people. Some of it was contracted. Some of it was not.", alignment: "CE" }
  ],

  sage: [
    { text: "Knowledge ungiven is knowledge wasted. You teach what you know to anyone who asks, and to many who don't, because the alternative is a world that grows darker by the year.", alignment: "LG" },
    { text: "You believe an educated mind is the foundation of a good life, and you have spent yours making sure others can build that foundation. The library, the apprentice, the patient explanation — these are your real legacy.", alignment: "NG" },
    { text: "You read because reading is its own pleasure. You teach because the joy of someone else's understanding is yours, doubled.", alignment: "CG" },
    { text: "The library is older than any kingdom, and the library will be here when this kingdom is dust. You serve the longer institution. The catalog, the citation, the careful preservation of what came before — these are your charge.", alignment: "LN" },
    { text: "You have spent a lifetime learning, and you are no closer to the bottom than when you started. The work is the point. There is no bottom.", alignment: "N" },
    { text: "You read what you want, you teach who you choose, and you owe no faculty its tithe of decorum. The university bored you out of its halls; the world is your library now.", alignment: "CN" },
    { text: "Knowledge is currency, and you have spent decades collecting. Some debts are owed to you that the debtors do not yet know about, and you will collect them at the moment of your choosing.", alignment: "LE" },
    { text: "You have published other people's findings under your name, withheld translations that would have saved lives, and let the wrong patrons pay for the right answers. The academy taught you the rules; the world taught you what they were really for.", alignment: "NE" },
    { text: "There are texts you've read that you wish you hadn't, and texts you've read that you wish on others. Knowledge is power, and you have learned that some knowledge is power best transmitted by force.", alignment: "CE" }
  ],

  sailor: [
    { text: "The crew is family and the captain is law, and you have served good captains and bad with the same discipline. The ones who deserved it got your loyalty; the ones who didn't got your service. You have not yet sailed under one who got both.", alignment: "LG" },
    { text: "You went to sea because the land had nothing for you, and the sea gave back more than you expected — friendships, lessons, a sense of your own size in a world that does not care about you. You came ashore better than you went out.", alignment: "NG" },
    { text: "The sea is the freest place you have ever known, and you have made the most of it. You take the cargoes that suit you, the routes that suit you, and the captains who don't make you regret the choice.", alignment: "CG" },
    { text: "The ship has rules that older sailors than you have died to enforce — the watch, the line, the cargo manifest, the captain's word — and you have spent your career honoring them. The order is what keeps the ship afloat. You are part of the order.", alignment: "LN" },
    { text: "You have been to ports most landsfolk haven't heard of. You don't talk about most of them. The work is the work; the sea is the sea; the rest sorts itself.", alignment: "N" },
    { text: "Land never made sense to you the way the sea did. You take the contracts that take you back to it, and the captains who can't keep up with your wanderlust learn quickly enough to either let you go or hold tighter than they should.", alignment: "CN" },
    { text: "There is a hierarchy at sea that the landed romantics never see — captain, mate, bosun, hand — and you have climbed it patiently. The discipline you wield now was wielded against you once. You learned what it was for.", alignment: "LE" },
    { text: "You have run cargo no honest manifest would name, into ports no honest captain would call at, for clients no honest sailor would meet. The pay was good. The pay is still good. You have stopped asking the captain whose coin it was.", alignment: "NE" },
    { text: "Some ships you served on did not return everyone they sailed with, and some of those losses were not the sea's doing. You know which were and which weren't. The ones that weren't, you helped with.", alignment: "CE" }
  ],

  soldier: [
    { text: "You took the oath because someone had to defend the people who could not defend themselves, and you have kept it through campaigns the historians will sanitize. You will not sanitize it for yourself. You did what you did, and you did it for the right reasons.", alignment: "LG" },
    { text: "You served because the country needed serving, and the country was, on balance, worth it. You came home better at watching strangers and worse at sleeping through storms. You are still here. The country is still here. That counts for something.", alignment: "NG" },
    { text: "You served, you fought, and you came home — and you have not been a soldier since. The discipline left you the day you took off the colors; what stayed was the willingness to act when others freeze. That you keep.", alignment: "CG" },
    { text: "Discipline is the difference between a soldier and a thug, and you have spent your life on the right side of the line. The chain of command, the standing orders, the daily inspection — these are the architecture of a force that does not become its enemy.", alignment: "LN" },
    { text: "You did your years. The army taught you what the army teaches; civilian life taught you the rest; you don't talk about either much. The work was work. You are done with it.", alignment: "N" },
    { text: "You served, and you served well, until you understood what you were serving and broke ranks. The court-martial papers exist somewhere; you do not. You move now under a name that is mostly yours.", alignment: "CN" },
    { text: "The army was the structure you needed and the structure rewarded you. You command the way your commanders commanded — by the book, without sentiment, with the understanding that an army's purpose is to win, and winning has costs the squeamish should not be asked to bear.", alignment: "LE" },
    { text: "There were villages on your campaign maps that the orders said were targets, and you carried out the orders. There were villages that weren't on the maps, and you carried out work there too. The colors came off years ago. The habits did not.", alignment: "NE" },
    { text: "Some of what the army permitted, you kept doing after the army stopped permitting it. The skills transfer. The contracts pay. The witnesses, when there are witnesses, do not last.", alignment: "CE" }
  ],

  urban_bounty_hunter: [
    { text: "You take the warrants the watch can't fulfill — the ones whose targets have money, connections, the right last name. You bring them in alive and you let the courts do the rest. The system is broken; you do what you can to keep it standing anyway.", alignment: "LG" },
    { text: "The work is the work. You bring in the ones you bring in, you turn down the ones you can't stomach, and you sleep most nights. That's more than most in the trade can say.", alignment: "NG" },
    { text: "You hunt the ones the watch won't, and you hunt them on terms the watch wouldn't. The targets you bring in are the targets the system has failed to catch — and you bring them in living, because dead targets cost the families their grief.", alignment: "CG" },
    { text: "There is a code in this trade older than any guild — you don't take a contract on a colleague, you don't break a sanctuary, you don't bring in a target the courts can't try. You keep the code. The trade keeps you.", alignment: "LN" },
    { text: "You take warrants the way other people take fares. The contract is the work; the work is the wage; you do not get attached to either side of it.", alignment: "N" },
    { text: "You answer to the warrant in your hand and to no one else. The watch's politics, the magistrate's preferences, the trade's unwritten rules — none of these cost you sleep. You bring in who you bring in. The rest of the city sorts itself.", alignment: "CN" },
    { text: "The trade has tiers, and you have climbed them. The high-bounty contracts go to those with reputation, the reputation comes from results, and the results come from being willing to do what the lower tiers won't. You do.", alignment: "LE" },
    { text: "You bring them in alive when alive is worth more, and you don't when it isn't. The receipts say the same either way. The targets' families have learned not to bother asking.", alignment: "NE" },
    { text: "You picked up the trade because chasing people through a city is the closest thing to hunting that civilization permits. The warrants give the work a frame; the frame is incidental. The hunt is the point.", alignment: "CE" }
  ],

  urchin: [
    { text: "You came up on the streets and you remember every kindness shown to you, and you have spent your life paying them forward. The kid sleeping under the bridge tonight is the you of fifteen years ago, and you do not let yourself forget what that night was like.", alignment: "LG" },
    { text: "The streets taught you to read people fast and to act fast, and you have carried both forward into work that helps more than it hurts. The instincts are the inheritance; what you do with them is yours.", alignment: "NG" },
    { text: "You learned every shortcut, every fence, every safe roof in three cities, and the children who sleep under them know your name. You came up that way. You will not let them come up alone.", alignment: "CG" },
    { text: "There are codes among the street kids that the city above never sees — who watches what corner, who owes what, who can be trusted to deliver a message. You learned the codes early. You keep them now, even when the city above offers you reasons to break them.", alignment: "LN" },
    { text: "You learned what the streets taught and you carry it with you — the watching, the waiting, the moving without sound. The city is your country and the rooftops are your maps.", alignment: "N" },
    { text: "You answer to no roof, no curfew, no patron. The streets gave you what no household could — the certainty that you belong only to yourself, and that any deal you make is a deal you can walk from.", alignment: "CN" },
    { text: "The streets have a ladder, and the ladder ends at someone who runs the district. You have spent your life climbing toward the someone, and you have learned what the climb costs the kids on the lower rungs. The cost is what you charge them. They pay.", alignment: "LE" },
    { text: "The city raised you and the city owes you, and you have been collecting the debt for years — small thefts, small betrayals, small uses of the trust the streets give freely. You do not feel guilty. The city does not deserve guilt.", alignment: "NE" },
    { text: "You learned which kids could be made to disappear and which ones the city would notice. The knowledge has been useful to people who pay well for that kind of knowledge. You have been paid.", alignment: "CE" }
  ]
};

// Forward-compat alias (PM's transcription used camelCase). Both bindings
// reference the same data; new code can use either.
export const themePersonalityPrompts = THEME_PERSONALITY_PROMPTS;

export default THEME_PERSONALITY_PROMPTS;
