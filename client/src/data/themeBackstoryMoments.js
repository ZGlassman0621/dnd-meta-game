/**
 * Per-theme backstory moments — a curated multi-select list for Step 7's
 * "Backstory" expansion (Model B). Per PHASE_2_CREATOR_SPEC.md §7.6.
 *
 * Eight moments per theme × 21 themes = 168 moments total. Each moment is
 * one sentence, past tense, second-person, 8–18 words. Bracketed
 * placeholders ([the master who taught you], [the village that raised
 * you]) are intentional — keep them; the player edits in their own canon.
 *
 * NO ALIGNMENT INDICATORS per Decision 4 (DECISION_LOG 2026-05-02).
 * Moments are events — what happened — not character commitments. The
 * action a character takes in response, and the meaning the player
 * assigns it, is what carries alignment. Same moment can shape an LG
 * knight, a CN wanderer, or a NE revenant. Different storage shape from
 * §7.2-§7.5 by design.
 *
 * Storage shape: { themeId: [string, ...] }
 */

export const THEME_BACKSTORY_MOMENTS = {
  acolyte: [
    "You were brought to the temple young — by family who couldn't keep you, or by family who wanted to honor a vow.",
    "A teacher there saw something in you that you couldn't see in yourself, and they wouldn't stop saying so.",
    "You memorized a long passage on a dare, recited it perfectly, and discovered you loved the words more than the dare.",
    "You watched a senior priest do something you knew was wrong, and the silence you kept afterward still bothers you.",
    "You attended a death — held the hand, said the words — and you understood what the calling actually asks.",
    "A revelation came to you in the quiet of a long night, and you've never quite been able to put it into words.",
    "You were sent away from the temple — by the order or your own choice — and the leaving wasn't simple.",
    "You carry a piece of the temple's authority with you, and you haven't decided whether you'll use it."
  ],

  charlatan: [
    "You ran your first con as a child, on someone who should have known better, and they laughed when they figured it out — eventually.",
    "A mentor — older, smoother, harder to read — taught you the work and disappeared before you could ask why.",
    "You stole an identity to escape a worse life, and the borrowed name fit better than the one you'd been born with.",
    "A mark you cheated took it harder than they should have, and you found out about it later from someone else.",
    "You walked away from a long con at the moment you could have closed it, and you've never decided whether you regret it.",
    "You met someone who saw through you on first sight, and you couldn't stop thinking about them after.",
    "You took a job that was supposed to be simple, and what came next is the reason you no longer trust simple jobs.",
    "You carry a piece of evidence — a letter, a mark, a name — that could undo someone powerful, and you haven't decided when."
  ],

  city_watch: [
    "You took the watch oath because it was the only paid work that didn't ask you to leave the city you grew up in.",
    "Your first sergeant was harder on you than on anyone else, and you didn't understand why until much later.",
    "You walked the same beat for years, and you can still draw the map of every door, alley, and shopkeeper from memory.",
    "A partner of yours died on the job, and the report didn't quite match what you remember happening.",
    "You let someone go once who should have been brought in, and you've watched for them ever since.",
    "A captain you respected made a call you couldn't follow, and you've carried the disagreement quietly.",
    "You saved a child — or a stranger, or someone who wouldn't have known your name — and that's the moment people in your district remember.",
    "You left the watch — discharged, retired, or simply walked off — and you still feel the routes in your feet."
  ],

  clan_crafter: [
    "You were born into the work — your first toys were tools, your first lessons were patterns, your first words were the names of materials.",
    "Your grandparent shaped your hands the right way the first time you held the work, and you can still feel their grip.",
    "You ruined a piece of work that mattered, and the way the family handled the failure taught you more than the success would have.",
    "You finished your first piece deemed worthy of the kin's name, and the moment is one of the few times you've seen [the elder] cry.",
    "A traveler from outside the clan saw your work and tried to buy it for a price that astonished you — and the clan told you to refuse.",
    "You disagreed with a kin elder over how the work should be carried forward, and the disagreement hasn't fully closed.",
    "You watched the clan workshop burn — or flood, or fail — and what you saved from it is what travels with you now.",
    "You carry a tool, a pattern, or a piece of unfinished work that belongs to the clan, and you'll bring it home when the time comes."
  ],

  criminal: [
    "You stole because you were hungry, and the second time you did it you weren't, and you've thought about the difference ever since.",
    "You were taken in by a crew when you had nowhere else to go, and they taught you faster than the streets would have.",
    "You crossed someone you shouldn't have crossed, and the way it ended is why you don't talk about it.",
    "A friend took the fall for something you did, and you haven't been able to make it right yet.",
    "You walked away from a job at the last moment because of something you saw, and the crew has never quite trusted you the same way since.",
    "You killed someone — by accident or otherwise — and the city remembers them better than it remembers you.",
    "You did time, or did the running that was supposed to keep you out of doing time, and you came out of it changed.",
    "You carry money, an item, or a name that someone is still looking for, and you haven't decided what to do with it."
  ],

  entertainer: [
    "You performed for the first time in front of strangers when you were too young to understand fear, and the room loved you.",
    "A teacher — a tutor, a master, a traveling performer — taught you the trade and left a piece of themselves in your work.",
    "You bombed in front of an audience that mattered, and the silence is what you measure yourself against still.",
    "You met a rival whose talent eclipsed yours, and you stopped competing and started studying them.",
    "You loved someone in the troupe, the company, or the audience, and the leaving wasn't your idea.",
    "You were paid by a powerful person to perform something you knew was wrong, and you said yes, and you've thought about it ever since.",
    "You wrote, composed, or choreographed a piece that was yours alone, and people still ask you to repeat it.",
    "You walked off a stage you swore you'd never return to, and the door is still open behind you."
  ],

  far_traveler: [
    "You left home for a reason you don't always tell strangers — exile, mission, curiosity, grief — and the leaving was final.",
    "The first language you tried to learn on the road broke you down, and the people who taught it to you were patient in ways you remember.",
    "You met a traveler from somewhere even farther, and what they told you about the world keeps surfacing.",
    "You were robbed early in the journey of something irreplaceable, and you've kept walking anyway.",
    "You crossed a border you weren't supposed to cross, and the people who let you through took a risk for you.",
    "Someone tried to claim you — to keep you, to marry you, to recruit you — and you said no, and the leaving was hard.",
    "You found a place along the way that almost made you stop, and you've thought about going back.",
    "You carry a token from home — a coin, a piece of cloth, a phrase — that you haven't shown anyone here, and you haven't decided when."
  ],

  folk_hero: [
    "You were ordinary until the day you weren't, and the change happened faster than you could think it through.",
    "The community that raised you taught you what mattered before you knew the word for it, and you carry that.",
    "You stood up to someone the village had been afraid of, and the standing-up cost you in ways you didn't expect.",
    "You saved someone who shouldn't have needed saving, and they're still alive because of it.",
    "The story people tell about what you did is bigger than what actually happened, and you haven't corrected them.",
    "Authority — a lord, a guard, a tax collector — came looking for you afterward, and you didn't run, but you didn't stay either.",
    "Someone who saw it all happen has been writing letters about you ever since, and you haven't read them.",
    "You carry a piece of evidence — a token, a relic, a wound — that ties you to what you did, and you can't quite let it go."
  ],

  guild_artisan: [
    "You were apprenticed young by a family hoping the trade would give you a better life than they could.",
    "Your master was demanding, exacting, and rare with praise, and the praise you did get is the standard you measure yourself against.",
    "You completed your first commissioned piece at an age that surprised the guild, and the piece is still in the buyer's family.",
    "A rival guild — or a rival within your own guild — undermined you in a way that's still not fully resolved.",
    "You took an apprentice yourself, and they taught you something you didn't expect to learn.",
    "A patron commissioned work you weren't ready to make, and you made it anyway, and the result is somewhere you can't easily revisit.",
    "You broke from the guild — formally, informally, or just in spirit — and the break is part of why you're on the road.",
    "You carry a piece of unfinished work, or a tool no one else can use, that won't let you forget what you came from."
  ],

  haunted_one: [
    "Something happened to you when you were too young to understand it, and you've been understanding it ever since.",
    "You survived an encounter that should have killed you, and the part of you that came back isn't entirely the same.",
    "Someone close to you didn't survive what you did, and you haven't yet found a way to live with that.",
    "You saw something — heard it, felt it, knew it — that no one around you saw, and the others stopped believing you a long time ago.",
    "You've encountered the haunting again since the first time, and it knew you, and you knew it.",
    "You found a person who believed you when no one else did, and what they said to you is what you've held onto.",
    "You went looking for the source of the haunting once, and what you found out you haven't told anyone.",
    "You carry a thing — a token, a wound, a name — that proves the worst of it actually happened, and you won't part with it."
  ],

  hermit: [
    "You withdrew from the world at a moment you can name precisely, for a reason you can name only partly.",
    "The place you went to felt like it had been waiting for you, and you stopped resisting that thought after a while.",
    "You spent your first year there surviving the practical things — food, shelter, weather — before any of the inner work started.",
    "A revelation came to you in the silence, and what it told you is part of why you came back.",
    "Someone visited you in the wilderness — a traveler, a pilgrim, a fugitive — and what passed between you matters more than the visit's length suggests.",
    "You nearly didn't make it through one winter or one fever, and the closeness changed what you came back to say.",
    "You decided to leave the solitude on a specific day, for a specific reason, and the decision still feels right.",
    "You carry something out of the place that taught you — a book, a stone, a phrase — and you don't show it to many."
  ],

  investigator: [
    "Your first case was a small one, and the way it cracked open under questioning is what taught you that you could do this work.",
    "A mentor — a senior investigator, a magistrate, a private patron — saw your mind early and made the work available to you.",
    "You closed a case that had been open for years, and the relief on the family's face is something you measure success against.",
    "You were wrong about a verdict once, and the wrongness cost someone who didn't deserve to pay, and you've never let yourself forget it.",
    "A case turned dangerous — someone wanted it not to close — and the threats you took were real.",
    "You met a witness who lied to you, and you let them, and what came of the letting still sits with you.",
    "You walked away from a case that was about to close, because closing it would have hurt the wrong person, and the file is still open.",
    "You carry notes from a case that never closed — names, dates, gaps in the record — and you mean to come back to it when you can."
  ],

  knight_of_the_order: [
    "You were sponsored into the order by [a relative, a patron, a saved life] and you've spent your time there proving you belonged.",
    "Your knight-master was harder on you than on the others, and you understand now what they were building.",
    "You took your vows on a specific day, in a specific place, and you can recall the exact words spoken back to you.",
    "You faced an enemy of the order in your first real campaign, and what you saw there — and what you did — shaped what came after.",
    "A fellow knight died in a way you don't speak of, and you carry their pendant, signet, or last words with you.",
    "You questioned the order's leadership over a single decision, and the question hasn't fully resolved.",
    "You were sent on the errand, the pilgrimage, the campaign that brought you here, and your standing in the order travels with you.",
    "You carry a relic, a banner, or an authority that ties you to the order across any distance, and you mean to honor it."
  ],

  mercenary_veteran: [
    "You took your first contract because there was no other paid work that didn't ask you to be someone you weren't.",
    "A captain or sergeant taught you the work — how to read a battlefield, how to read an employer, how to read a contract — and the lessons hold up.",
    "You fought in a campaign whose name you don't speak, and what you did there is part of why you no longer drink in certain company.",
    "A crew you fought with — the closest thing to family you had — broke up over money or a betrayal, and the scattering still hurts.",
    "You were left for dead by an employer who counted you as expendable, and the employer is still alive somewhere.",
    "You took a contract you knew was bad and went through with it anyway, and the bad outcome sits with you.",
    "You walked away from the work — discharged, broke, done — and you walked back into it within the year.",
    "You carry a weapon, a coin, or a name from a campaign that ended badly, and what to do with it is still open."
  ],

  noble: [
    "You were raised in a household that taught you who you were before you could tell anyone else.",
    "A tutor or governess shaped your mind in ways the family didn't fully approve of, and you remember them more clearly than the family wishes you would.",
    "You attended court — a coronation, a wedding, a tribunal — at an age when you were old enough to understand and young enough to be marked by it.",
    "A scandal touched the family — yours, a sibling's, a parent's — and the household handled it in ways that shaped how you see honor.",
    "You were promised to someone, or for something, and the promise is unresolved.",
    "You broke with a family decision, quietly or loudly, and the break is part of why you're on the road.",
    "You inherited or lost something — a title, an estate, a name — that has not yet finished playing out.",
    "You carry a signet, a letter, or a writ that ties you to the house, and you haven't decided how openly you'll wear it."
  ],

  outlander: [
    "You were born to a people for whom the wild was home, and the lessons came before the words for the lessons.",
    "A teacher among your people — an aunt, an elder, a hunter — taught you to read the land, and you can hear their voice when you slow down.",
    "You survived an encounter with the wild — a beast, a storm, a season — that should have ended you, and what came after is who you became.",
    "You watched something happen to your home — encroachment, change, harm — that taught you what the outside world was capable of.",
    "You took on a responsibility for your people younger than was customary, and you carried it without complaint.",
    "You met an outsider — a traveler, a trader, a refugee — and what they told you about the wider world was the first crack.",
    "You left your land for a reason that mattered, and you'd return if the reason resolved.",
    "You carry a token of your home — a stone, a feather, a piece of bone — and the place is in it whenever you hold it."
  ],

  sage: [
    "You were drawn to learning before anyone taught you to be, and the first book or scroll you encountered changed something permanent.",
    "A master, library, or institution took you in and gave you access to materials that shaped the rest of your work.",
    "You posed a question that the people around you couldn't answer, and the impossibility of the question is what set the rest of your career in motion.",
    "You discovered something — an error in a record, a forgotten reference, a contradiction — that not everyone wanted brought to light.",
    "A rival, a peer, or a doubter pushed you to refine your work, and you've never quite stopped competing with them in your head.",
    "You traveled to a place — an archive, a ruin, a meeting of scholars — that proved as important as anyone said it was.",
    "You broke with an institution over a question of truth or method, and the break is unresolved.",
    "You carry notes, a manuscript, or a translation that no one else has fully seen, and the timing of when to share it is still in your hands."
  ],

  sailor: [
    "You went to sea because home wasn't a place you could stay, or because the sea was the only thing your family knew, or because someone you respected made it look possible.",
    "Your first ship's captain or first mate taught you the trade with patience some sailors never get, and you measure yourself by what they expected.",
    "You survived a storm that took shipmates with it, and you can still hear the sounds it made.",
    "You held the watch through a quiet ocean night and felt something the daytime sea doesn't show, and you can't explain it cleanly.",
    "Mutiny, desertion, or scandal touched a ship you served on, and what you did during it is part of why you no longer serve in certain harbors.",
    "You found a port that almost stopped you — a person, a place, a possibility — and you've thought about going back.",
    "You walked off a ship for the last time after years of service, and the leaving was either your call or someone else's.",
    "You carry a piece of a ship, a knot, a phrase, or a token from a captain who mattered, and the sea is in it."
  ],

  soldier: [
    "You enlisted young — younger than they should have taken — because home wasn't a place you could stay.",
    "A drill instructor or first sergeant shaped you into something you wouldn't have become on your own, and you carry that shaping consciously.",
    "You held a line that should have broken, and you don't entirely know why it didn't.",
    "You watched the unit beside you take losses you somehow avoided, and the survivor's debt is still open.",
    "You were given an order that you executed, and you've thought about it since — sometimes you'd give it again, sometimes you wouldn't.",
    "You came home or were discharged in a way you weren't ready for, and the return wasn't the relief everyone said it would be.",
    "You stayed in touch with the people you served with for as long as you could, and the names you've lost contact with weigh on you.",
    "You carry insignia, a trophy, or a letter that ties you to the unit, and the unit is what the object means."
  ],

  urban_bounty_hunter: [
    "You took your first contract for a reason you can name — debt, hunger, revenge, opportunity — and the work suited you in a way that surprised you.",
    "A handler or older hunter taught you how to read marks and how to read brokers, and they're still alive somewhere if you ever needed them.",
    "You closed a contract that no one else had been able to close, and the reputation that came with it changed what work was offered.",
    "A mark you brought in turned out not to be the person the contract claimed, and finding that out came too late.",
    "You hunted someone you knew personally — by accident or otherwise — and the moment of recognition is one you don't talk about.",
    "A rival hunter beat you to a contract that should have been yours, and the rivalry hasn't fully closed.",
    "You walked away from a contract once you understood what it actually was, and the broker who hired you noticed.",
    "You carry a name — on a list, in your head, in a folded paper — that's still open, and you'll close it when the chance comes."
  ],

  urchin: [
    "You don't fully remember when you became a street kid — only that the door closed, the family ended, the place stopped being yours.",
    "Another child took you in when no one else did, taught you the rules of the streets, and was the first person you'd have died for.",
    "You stole something you needed and got away clean, and the success is the moment you understood what you were going to be.",
    "Adult kindness reached you once — a baker, a watch officer, a stranger — and you remember the face better than the food or the coin.",
    "You watched another street kid disappear, taken, killed, or worse, and the disappearance is something you still see in unguarded moments.",
    "You hid in a place — a rooftop, a cellar, an alley — for a number of nights you'd rather not count, and you remember the smell of it.",
    "Something changed — luck, an opportunity, a stranger's offer — that gave you a way out, and you took it without quite knowing why you trusted it.",
    "You carry something from the streets — a coin, a token, a small habit — that proves you came from there, and you have not yet decided if you'll let it go."
  ]
};
