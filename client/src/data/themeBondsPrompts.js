/**
 * Per-theme bonds prompts — clickable starters for Step 7's "Bonds"
 * field (Model A: click drops into textarea, then editable). Per
 * PHASE_2_CREATOR_SPEC.md §7.4.
 *
 * Bonds describe what the character values most — specific people, places,
 * objects, or unfinished business they'd pay real cost to protect, recover,
 * or honor. Several prompts use [bracketed placeholders] for names or
 * specifics — these are intentional invitations for the player to fill in
 * their own canon. Keep them verbatim.
 *
 * Coverage: full 9-square per Decision 5. Counts per theme range 4-6;
 * total ~126 prompts. Note: §7.4 has no CG or CE entries (per Open PM
 * call §8.6 — those alignments don't land naturally for bonds; flagged for
 * possible later content pass).
 *
 * Storage shape: { themeId: [{ text, alignment }] }
 */

export const THEME_BONDS_PROMPTS = {
  acolyte: [
    { text: "The temple that raised you. You'll return to it whenever you can, and you'll defend it if it ever calls.", alignment: "LG" },
    { text: "A specific text — a passage, a parable, a verse — that you read until it became the spine of your faith.", alignment: "LN" },
    { text: "The person who first taught you to pray. You don't know if they're still alive, and you mean to find out.", alignment: "NG" },
    { text: "A relic of the faith — small, precious, entrusted to you. You'd lay down your life before it was lost or defiled.", alignment: "LG" },
    { text: "A fellow servant of the faith who fell from doctrine. You haven't spoken to them in years, and you don't know whether you mean to reconcile or to make them answer.", alignment: "LN" },
    { text: "A heretic — someone who corrupted what you held sacred. You've been waiting for the chance to bring them to account.", alignment: "LE" }
  ],

  charlatan: [
    { text: "A mark you cheated badly enough that it's stayed with you. One day you'll make it right — or so you tell yourself.", alignment: "N" },
    { text: "The first persona you ever wore convincingly. It's still in your kit, in case you need to be that person again.", alignment: "CN" },
    { text: "A partner who taught you the work, then disappeared. You'd cross continents for word of where they went.", alignment: "CN" },
    { text: "Someone you cheated who didn't deserve it — and who never knew it was you. You'd undo it if you could find a way that didn't reveal you.", alignment: "NG" },
    { text: "A rival con artist who beat you at your own game. You owe them a long-running answer.", alignment: "CN" },
    { text: "A list of marks you've kept all along — names, weaknesses, the right approach. The list is worth a fortune to the right buyer, and you've been considering selling.", alignment: "NE" }
  ],

  city_watch: [
    { text: "The street you walked your first patrol on. You still know which doors stick and which neighbors lie.", alignment: "LN" },
    { text: "A partner who didn't come home from a shift. You carry their name, and you carry it loudly.", alignment: "LG" },
    { text: "A case that never closed. The file is still in your head, and you'll work it until you can't.", alignment: "LN" },
    { text: "A neighborhood — its shopkeepers, its kids, its troublemakers — that you came to think of as yours. You'd return at any hour they called.", alignment: "LG" },
    { text: "A criminal you've crossed paths with for years; the unspoken arrangement between you isn't something you'd put in a report.", alignment: "LN" },
    { text: "A magistrate or captain who used you to do dirty work for them, and the leverage they have on you hasn't gone away.", alignment: "LE" }
  ],

  clan_crafter: [
    { text: "The forge or workshop your kin worked in. The walls remember every hand that shaped them.", alignment: "LN" },
    { text: "An unfinished piece — your grandparent's last work, set aside before they passed. You'll complete it one day.", alignment: "LG" },
    { text: "The teacher who refused to call you ready, and was right to refuse. You're still earning the moment they would have.", alignment: "LN" },
    { text: "A sibling or cousin in the craft who's gone further than you have. You don't always say so, but their success is something you guard for them.", alignment: "NG" },
    { text: "A rival clan or guild whose work threatens what your people made. The accounting is overdue.", alignment: "LN" },
    { text: "A piece you made for someone who turned out to be unworthy of it. You'd take it back, and you'd be willing to spill blood doing it.", alignment: "NE" }
  ],

  criminal: [
    { text: "A friend who took the fall for something you did. You owe them, and you mean to pay.", alignment: "CN" },
    { text: "The first place you called safe — a hideout, a back room, a rooftop. It's where you go when everything else fails.", alignment: "CN" },
    { text: "Someone who crossed you and didn't pay. You haven't forgotten, and you don't intend to.", alignment: "NE" },
    { text: "A child, a sibling, a parent the streets nearly took — the one you stayed straight for, when you tried.", alignment: "NG" },
    { text: "A handler or fence who's been loyal across years of bad luck. You'd burn for them, and you'd expect them to burn for you.", alignment: "CN" },
    { text: "A score you walked away from at the last moment. You still know exactly where it sits, and you've been thinking about going back.", alignment: "CN" }
  ],

  entertainer: [
    { text: "The first audience that loved you. You'd play one more show in that room before you'd play the grandest hall.", alignment: "NG" },
    { text: "A song, a routine, a piece — the one that's yours, that no one else can do the way you do it.", alignment: "N" },
    { text: "A rival whose work made you better. You hate them a little, and you respect them more than you let on.", alignment: "N" },
    { text: "A patron or sponsor who saw something in you when no one else did. Their faith is the standard you measure yourself against.", alignment: "NG" },
    { text: "A performer who stole your work and won acclaim with it. You haven't forgotten, and the reckoning is overdue.", alignment: "N" },
    { text: "A piece of compromising material on a powerful person — a letter, a confession, a witnessed scene. You've kept it for years, and you've considered using it.", alignment: "NE" }
  ],

  far_traveler: [
    { text: "Home. Wherever you're standing, it's somewhere else, and you carry it like a second heartbeat.", alignment: "NG" },
    { text: "A promise you made before you left — to return, or to send word, or to come back changed.", alignment: "LG" },
    { text: "A traveling companion who turned back when you didn't. You wonder, often, if they were the wiser one.", alignment: "N" },
    { text: "A guide who saw you safely across a dangerous stretch and refused payment. You owe them, and you intend to repay it the day you can.", alignment: "NG" },
    { text: "Someone in the place you came from who waits for you — a parent, a betrothed, a sibling, a child — whose patience is finite.", alignment: "LG" },
    { text: "Something from your homeland — a writ, a debt, a feud — that's followed you here. You haven't told anyone what it is.", alignment: "LN" }
  ],

  folk_hero: [
    { text: "The community that knows your name. They were what you stood up for, and you'd stand up again.", alignment: "LG" },
    { text: "The person you saved that day — the one who started the story. You think about them more than the story itself.", alignment: "NG" },
    { text: "The tyrant or the wrong-doer you faced down. They're still out there, and you wonder if you finished what you started.", alignment: "NG" },
    { text: "The friend or family member whose loss is what made you act when you finally did. You carry them in everything that came after.", alignment: "NG" },
    { text: "A village, town, or holding that's named you their own. You can return there at any time and find a roof, a meal, a fire.", alignment: "LG" },
    { text: "An enemy you spared who shouldn't have been spared. You watch the news for word of what they're doing now.", alignment: "NE" }
  ],

  guild_artisan: [
    { text: "The master who took you on as an apprentice. You owe them everything you can make, and you'll keep making it.", alignment: "LG" },
    { text: "Your guild — the network, the code, the hall. You bear its mark in every piece you sign.", alignment: "LN" },
    { text: "A commission you couldn't finish, and a client you couldn't satisfy. The piece sits in your shop, waiting for you to be ready.", alignment: "LN" },
    { text: "A protégé you trained who's gone on to do work that humbles you. Their reputation is part of what you live for now.", alignment: "NG" },
    { text: "A patron who paid for everything they shouldn't have, and then asked you for something you couldn't give. The leverage is still in their hands.", alignment: "LE" },
    { text: "A rival you sabotaged once, when the guild's politics turned ugly. They don't know you did it, and you've considered telling them.", alignment: "N" }
  ],

  haunted_one: [
    { text: "The person who didn't survive what you did. You carry their name in places no one else looks.", alignment: "NG" },
    { text: "The thing that haunted you. You know what it is, and you know it isn't done with you yet.", alignment: "N" },
    { text: "A keepsake — small, easy to overlook — that proves the worst of it actually happened. You won't part with it.", alignment: "N" },
    { text: "A scholar, priest, or sage who believed your account when no one else did. They asked nothing in return, and you owe them everything.", alignment: "NG" },
    { text: "The place where it happened — house, road, ruin, river. You haven't returned, and the leaving is unfinished.", alignment: "N" },
    { text: "Whatever, or whoever, made the haunting possible in the first place. You've sworn to find them, and the oath is binding even if no one heard you take it.", alignment: "NE" }
  ],

  hermit: [
    { text: "The place you withdrew to. The trees, the cell, the cave, the high country — wherever it was, it's yours.", alignment: "N" },
    { text: "A revelation that came to you in solitude. It's why you came back, and you mean to share it when the time is right.", alignment: "NG" },
    { text: "A book, a journal, a letter — the writing you did or read that changed you. It travels with you.", alignment: "LN" },
    { text: "A traveler who found you in the wilderness and changed something about why you stayed. You don't know where they went, and you'd like to know.", alignment: "NG" },
    { text: "A teacher you never met — whose writing or example shaped your retreat — and whose grave or last residence you mean to visit.", alignment: "LN" },
    { text: "A truth you uncovered that someone powerful would prefer stayed buried. You haven't decided whether the time to surface it has come.", alignment: "N" }
  ],

  investigator: [
    { text: "A case that broke wrong — the witness who lied, the lead that went dark, the verdict that came in wrong. You're still working it.", alignment: "LG" },
    { text: "Someone you couldn't save. Their name is the answer to a question you haven't stopped asking.", alignment: "NG" },
    { text: "The person who taught you the work — how to read a room, how to wait, how to know when to stop asking. You measure yourself against them.", alignment: "LN" },
    { text: "A network of informants you've cultivated over years. They trust you, and you've stayed worthy of that trust at real cost.", alignment: "LN" },
    { text: "A target who eluded you in a way that still doesn't make sense. The file is open, and the open-ness has gotten personal.", alignment: "LN" },
    { text: "Files on people in power — kept private, kept current. The leverage they represent isn't something you've used, but you've thought about it.", alignment: "LE" }
  ],

  knight_of_the_order: [
    { text: "Your order. The vows you took within it are not metaphors, and the people who took them with you are family by oath.", alignment: "LG" },
    { text: "The one who knighted you. Their standard, their counsel, their example — you carry all of it forward.", alignment: "LG" },
    { text: "A blade, a sigil, an honor — the object that names you a knight. To lose it would be to lose yourself.", alignment: "LN" },
    { text: "A squire or junior knight whose training you took on. Their honor is partly yours now, and you'd answer for it.", alignment: "LG" },
    { text: "An enemy of the order you fought to a draw. The matter is unfinished, and you've been waiting for the rematch.", alignment: "LN" },
    { text: "A senior of the order who used your loyalty for ends you didn't sanction. They still hold rank, and you still owe obedience, and the contradiction has been wearing on you.", alignment: "LE" }
  ],

  mercenary_veteran: [
    { text: "The crew you fought beside the longest. They're scattered now, but if any of them called, you'd come.", alignment: "LN" },
    { text: "A contract that ended badly — bodies you saw, choices you made, money you took anyway. It sits with you.", alignment: "N" },
    { text: "A weapon you've carried through more campaigns than you can count. It knows your hand, and you trust it.", alignment: "N" },
    { text: "A child or family of the place where a campaign went bad. You send coin to them every year, and you've never told anyone.", alignment: "NG" },
    { text: "A captain who hired you to do work you wish you hadn't done. They're still alive somewhere, and the account is open.", alignment: "NE" },
    { text: "A weapons cache — buried, hidden, kept against a contingency. You haven't gone back for it, but you remember exactly where.", alignment: "N" }
  ],

  noble: [
    { text: "Your house. Its name, its honor, its standing — what was given to you, you intend to give back enlarged.", alignment: "LG" },
    { text: "A sibling, a parent, or a spouse whose esteem matters to you more than the world's. You'd shape your life by their judgment.", alignment: "LN" },
    { text: "The land your family is bound to — the people, the soil, the fortune that flows from both. You're answerable to all of it.", alignment: "LG" },
    { text: "A retainer — old, loyal, undervalued by everyone but you. You'd defend their honor against any peer who slighted them.", alignment: "LG" },
    { text: "A rival house whose injury to yours hasn't been answered. The accounting is overdue, and you intend to be the one to deliver it.", alignment: "LE" },
    { text: "A scandal — a buried letter, a paid-off witness, a bastard child unacknowledged. The truth is in your keeping, and what you do with it is still open.", alignment: "LN" }
  ],

  outlander: [
    { text: "The wild country that raised you. You'll defend its borders against any kingdom that thinks it owns them.", alignment: "N" },
    { text: "A specific place — a rock, a glen, a peak, a river bend — that you'd return to die at, if you got the choice.", alignment: "N" },
    { text: "A teacher from your people who taught you to read the land. You speak their lessons aloud sometimes when no one's listening.", alignment: "NG" },
    { text: "A creature, herd, or pack you came to know in your country. You think of them more often than people understand.", alignment: "NG" },
    { text: "An outsider — a settler, a logger, a noble's hunter — whose presence in your country has not been answered. You haven't decided how it will be.", alignment: "N" },
    { text: "Someone whose harm to your people hasn't been paid for. The land remembers, and you remember on its behalf.", alignment: "NE" }
  ],

  sage: [
    { text: "A library, an archive, a collection — somewhere the knowledge you love is stored. You'll defend it as if it were a person.", alignment: "LG" },
    { text: "A question you've never been able to answer. It's the question, and you'll spend your life on it if you have to.", alignment: "LN" },
    { text: "A mentor whose mind you measured your own against. They saw something in you, and you'd hate to disappoint them.", alignment: "LN" },
    { text: "A student you taught who surpassed you. Their work is part of what you're proud of now, in a way you don't quite say aloud.", alignment: "LG" },
    { text: "A rival scholar whose theories you've spent years dismantling. The dismantling has become its own kind of relationship.", alignment: "LN" },
    { text: "A piece of dangerous knowledge you uncovered, and have not yet shared, and have not yet destroyed. The choice is still in front of you.", alignment: "N" }
  ],

  sailor: [
    { text: "The ship you served on the longest. Whether she's still afloat or rotting on a beach, she's yours.", alignment: "N" },
    { text: "A captain or shipmate who saved your life. The debt is open, and you'll close it when the chance comes.", alignment: "LN" },
    { text: "A port you'll always come back to — the harbor, the tavern, the person who waits there.", alignment: "NG" },
    { text: "A crew member who didn't make it home, whose family doesn't know what happened. You've been meaning to tell them.", alignment: "NG" },
    { text: "A captain who turned cruel — toward the crew, toward prizes, toward you. The reckoning is something you've thought about for years.", alignment: "NE" },
    { text: "A treasure, chart, or cargo that should have been yours, and isn't. You know who has it, and you remember the way back.", alignment: "CN" }
  ],

  soldier: [
    { text: "The unit you served with. They're family in a way no one outside the line will ever understand.", alignment: "LN" },
    { text: "A specific battle that defined you — the one you came out of changed. You'd return to that ground if you ever could.", alignment: "LN" },
    { text: "A commander you would have died for. Maybe you nearly did. You measure every superior against them.", alignment: "LG" },
    { text: "A civilian or refugee whose life intersected with your war and changed because of it. You think of them more than is reasonable, given how brief it was.", alignment: "NG" },
    { text: "An officer who used your unit badly, and was promoted instead of held accountable. You haven't forgotten the name.", alignment: "LE" },
    { text: "A pact with people from the other side — survivors, captives, witnesses — that no commander would have approved of. You'd honor it before any flag.", alignment: "N" }
  ],

  urban_bounty_hunter: [
    { text: "A mark who got away. You haven't forgotten the face, the gait, the laugh. One day they'll surface again.", alignment: "N" },
    { text: "The first contract you ever closed. The mark, the pay, the moment you knew you were good at this.", alignment: "N" },
    { text: "A handler or broker who put work your way when you needed it. You'd take their call before any other.", alignment: "LN" },
    { text: "A mark you brought in alive who deserved a worse fate, and the family who haunted you for not delivering it. You owe them, you think.", alignment: "NG" },
    { text: "A rival hunter who beat you to a contract that should have been yours. You've been waiting for them to slip.", alignment: "N" },
    { text: "A list of names you keep — marks you've decided are worth your time when the right contract comes through. None of them know they're on it.", alignment: "LE" }
  ],

  urchin: [
    { text: "The other street kids who looked out for you. Most of them are gone, scattered or worse. You remember each of them.", alignment: "NG" },
    { text: "A specific corner, alley, or doorway where you slept when nowhere else was safe. You go past it when you can.", alignment: "N" },
    { text: "Someone who showed you kindness when no one else did — a baker, a watchman, a stranger. You'd lay down your life for them, and they have no idea.", alignment: "NG" },
    { text: "A rival from the streets who's done worse than you have, and gotten away with it. You've thought about settling the account.", alignment: "CN" },
    { text: "A child you took under your wing the way someone took you — and lost. Their name is one you carry.", alignment: "NG" },
    { text: "A piece of valuable information you stole off a powerful person — one of your last good thieves' tricks. They're still looking for it.", alignment: "CN" }
  ]
};
