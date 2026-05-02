/**
 * Per-theme ideals prompts — clickable starters for Step 7's "Ideals"
 * field (Model A: click drops into textarea, then editable). Per
 * PHASE_2_CREATOR_SPEC.md §7.3.
 *
 * Each prompt follows the 5e convention: one-word label, period, then a
 * single-sentence elaboration in second-person voice with conviction.
 *
 * Coverage: full 9-square per Decision 5 (DECISION_LOG 2026-05-02). Evil-
 * axis ideals are written as character commitments held by people who
 * think they're doing right — internally coherent moral frameworks, not
 * villain manifestos. Counts per theme range 4-7 depending on natural
 * alignment surfaces; total ~134 prompts.
 *
 * Storage shape: { themeId: [{ text, alignment }] }
 */

export const THEME_IDEALS_PROMPTS = {
  acolyte: [
    { text: "Faith. The divine speaks through ritual, study, and quiet — and you hear it most clearly when you serve.", alignment: "LG" },
    { text: "Tradition. The old forms exist for reasons older than your understanding, and reverence is its own reward.", alignment: "LN" },
    { text: "Charity. The first measure of any soul is what it gives without being asked.", alignment: "NG" },
    { text: "Mercy. Even the worst of us deserve grace; the divine asks no less of those who serve.", alignment: "NG" },
    { text: "Doctrine. The faithful must hold the line on what is true, even when the world prefers comfortable lies.", alignment: "LN" },
    { text: "Authority. The hierarchy of the faith reflects the order of creation; questioning it weakens what holds the world together.", alignment: "LE" },
    { text: "Purification. The faith demands hard things of those who serve it, and the unworthy must be held to account.", alignment: "LE" }
  ],

  charlatan: [
    { text: "Freedom. The truth a person earns matters more than the truth they're handed, and a good lie can teach as much as it costs.", alignment: "CN" },
    { text: "Equity. The rules were written by the rich; bending them is justice, not crime.", alignment: "CG" },
    { text: "Self-Reliance. No one is coming to save you, and pretending otherwise is the dangerous lie.", alignment: "CN" },
    { text: "Compassion. You've conned bad people for good reasons more often than the other way, and the work has its own kind of honor.", alignment: "CG" },
    { text: "Pragmatism. Every transaction is a performance; the only sin is being bad at it.", alignment: "N" },
    { text: "Power. The fool and their coin part ways by natural law; you're just an instrument of that law.", alignment: "NE" },
    { text: "Domination. People reveal what they are when you can read them — and what they are is mostly weak, and weakness is for using.", alignment: "CE" }
  ],

  city_watch: [
    { text: "Order. The streets work because someone holds the line — and you know what happens when no one does.", alignment: "LN" },
    { text: "Justice. The law is imperfect, but it's what we have. Enforcing it fairly is the work.", alignment: "LG" },
    { text: "Loyalty. The people you walk patrol with are the people who'd die for you, and you for them.", alignment: "LN" },
    { text: "Service. The watch protects the people who can't protect themselves, and that's the whole point of wearing the badge.", alignment: "LG" },
    { text: "Authority. The badge is the thing; people who don't respect it get the lesson, and the lesson is for everyone's good.", alignment: "LE" },
    { text: "Control. The streets stay calm because someone is willing to be feared, and that's a service too.", alignment: "LE" }
  ],

  clan_crafter: [
    { text: "Heritage. The patterns your kin taught you carry weight no guild contract ever will.", alignment: "LN" },
    { text: "Excellence. Work that doesn't honor the ones who taught you is work you shouldn't sign your name to.", alignment: "LG" },
    { text: "Continuity. What you make outlives you, and that is the point.", alignment: "LN" },
    { text: "Generosity. The craft is meant to be given — to the kin, to those who need what you make, to the future.", alignment: "NG" },
    { text: "Pride. Your work outshines the guilds' for a reason, and the world should know it.", alignment: "LE" },
    { text: "Supremacy. Some hands are made to shape, and others are made to be shaped by what those hands make. The order is older than your bloodline.", alignment: "LE" }
  ],

  criminal: [
    { text: "Loyalty. The crew is the only law you respect, and you'd burn the world before you'd burn one of them.", alignment: "CN" },
    { text: "Self-Interest. Everyone's looking out for themselves; you just admit it.", alignment: "CN" },
    { text: "Redemption. You can leave the life if you choose to, and you'd like to believe that.", alignment: "CG" },
    { text: "Justice. The rich got there by stealing first, and what you do is closer to a redistribution than a crime.", alignment: "CG" },
    { text: "Survival. The only ideal that's ever kept you alive is making sure you stay alive, and you don't apologize for it.", alignment: "N" },
    { text: "Greed. Coin is the cleanest measure of what a person is worth, and you measure honestly.", alignment: "NE" },
    { text: "Cruelty. The world hurt you; you've returned the favor with interest, and you'd do it again.", alignment: "CE" }
  ],

  entertainer: [
    { text: "Beauty. There's something true in every good performance, and you spend your life chasing it.", alignment: "NG" },
    { text: "Freedom. Every audience is different, and rules that worked yesterday won't work tonight — that's the whole job.", alignment: "CN" },
    { text: "Honesty. The stage doesn't lie, even when the words do, and you've come to trust it more than most people.", alignment: "N" },
    { text: "Joy. The world is heavy enough; what you do is meant to lift, and you take that obligation seriously.", alignment: "CG" },
    { text: "Glory. You will be remembered, and that takes work no one else is willing to do.", alignment: "N" },
    { text: "Manipulation. You can move a room any way you want, and the room mostly deserves to be moved.", alignment: "CE" }
  ],

  far_traveler: [
    { text: "Curiosity. There's no end to what you don't know, and that's the most exciting fact in the world.", alignment: "NG" },
    { text: "Hospitality. You were a stranger once. Strangers are owed kindness, especially the ones who don't speak the language.", alignment: "NG" },
    { text: "Independence. Home was something you chose to leave, and choosing to keep moving is its own kind of fidelity.", alignment: "CN" },
    { text: "Understanding. The world's quarrels are mostly born of people not knowing each other, and you can be the one who carries the bridge.", alignment: "NG" },
    { text: "Detachment. You don't belong anywhere, and you've learned that's a clearer place to see from than belonging.", alignment: "N" },
    { text: "Superiority. Where you came from did things better, and the locals would benefit from listening — though they rarely do.", alignment: "LE" }
  ],

  folk_hero: [
    { text: "Justice. The strong shouldn't get to take from the weak, and someone has to say so out loud.", alignment: "NG" },
    { text: "Community. You belong to the people who claimed you, and you owe them more than they'll ever ask for.", alignment: "LG" },
    { text: "Sincerity. The story people tell about you isn't the truth, but the truth is close enough that you try to live up to it.", alignment: "NG" },
    { text: "Defiance. Authority that hasn't earned obedience doesn't deserve it, and you've stopped pretending otherwise.", alignment: "CG" },
    { text: "Humility. You're not the hero of the story; the people you stood for are. You just happened to be the one standing.", alignment: "NG" },
    { text: "Vengeance. The wrongs done to your people don't end with apologies, and forgiveness is a luxury the dead don't get to give.", alignment: "NE" }
  ],

  guild_artisan: [
    { text: "Mastery. The work demands what it demands, and shortcuts insult both the maker and the made.", alignment: "LN" },
    { text: "Community. The guild raised you. You owe it back, and you'll teach when your time comes.", alignment: "LG" },
    { text: "Aspiration. Every piece you make should be better than the last, and the day that stops being true is the day to retire.", alignment: "LN" },
    { text: "Generosity. What you make is meant for hands that need it, and the right buyer matters more than the highest bidder.", alignment: "NG" },
    { text: "Hierarchy. The guild ranks exist for reasons, and respect for rank is what keeps the work honest.", alignment: "LE" },
    { text: "Profit. The work is a commodity in the end, and pretending otherwise is sentiment that costs you coin.", alignment: "LE" }
  ],

  haunted_one: [
    { text: "Endurance. What's been done is done. What's left is to keep going, and not let it own you.", alignment: "N" },
    { text: "Vigilance. You've seen what hides in the dark places. You don't pretend it isn't real, and you don't let others either.", alignment: "LN" },
    { text: "Mercy. You know what suffering does to people, and you'd spare it if you can.", alignment: "NG" },
    { text: "Truth. The thing that haunted you was real, and the world's denial of it is what you push against now.", alignment: "N" },
    { text: "Vengeance. What was done to you didn't end with you. You'll see the source of it answer before you let it rest.", alignment: "NE" },
    { text: "Annihilation. Some things shouldn't exist, and you've come to believe the same is true of what made you.", alignment: "NE" }
  ],

  hermit: [
    { text: "Truth. There are answers that can't be found in cities, and you've come back from where you found them.", alignment: "LN" },
    { text: "Inner Peace. Solitude taught you that the noise outside is not the noise that matters. The noise inside is.", alignment: "N" },
    { text: "Compassion. You went away to learn how to come back, and what you carry is meant to be given.", alignment: "NG" },
    { text: "Free Thought. The wisdom of crowds is the absence of wisdom; only the solitary mind sees clearly.", alignment: "CN" },
    { text: "Greater Good. The revelation you found in the wilderness is what the world needs, and bringing it back is your work.", alignment: "NG" },
    { text: "Misanthropy. People are mostly the noise you went away from, and you came back to share that finding, not to forget it.", alignment: "CE" }
  ],

  investigator: [
    { text: "Truth. Every lie has a cost, and someone has to be willing to pay it to find what's underneath.", alignment: "LN" },
    { text: "Justice. The case isn't closed when the verdict comes in. It's closed when the right thing happens.", alignment: "LG" },
    { text: "Persistence. The questions don't stop because the trail goes cold, and neither do you.", alignment: "LN" },
    { text: "Protection. The work exists because someone has to stand between the predators and the prey, and you've signed up to be that someone.", alignment: "NG" },
    { text: "Knowledge. The hidden things want to stay hidden, and that's reason enough to drag them into the light.", alignment: "N" },
    { text: "Control. Information is the only real currency; what you find out is yours, and you decide who gets it.", alignment: "LE" },
    { text: "Punishment. The verdict isn't enough. The guilty pay in the way the law won't reach for, and you've stopped feeling bad about it.", alignment: "LE" }
  ],

  knight_of_the_order: [
    { text: "Honor. The vows are not theater. You took them in earnest, and you live them the same way.", alignment: "LG" },
    { text: "Service. Your blade is not your own. It belongs to the order, the realm, and what they protect.", alignment: "LG" },
    { text: "Mercy. Power that knows when not to strike is the only power worth holding.", alignment: "LG" },
    { text: "Duty. The order asks what it asks. Your judgment of its asks is a luxury you set down when you took the oath.", alignment: "LN" },
    { text: "Glory. The order's name endures through what its knights do, and you intend to leave it brighter than you found it.", alignment: "LN" },
    { text: "Supremacy. The order's way is the right way; the world will be better when it has been brought into accord.", alignment: "LE" },
    { text: "Crusade. There are enemies of the realm who do not deserve the mercy of the law, and you've made your peace with that.", alignment: "LE" }
  ],

  mercenary_veteran: [
    { text: "Pragmatism. Coin is honest. It tells you what people actually value, and it doesn't pretend to be friendship.", alignment: "N" },
    { text: "Loyalty. The contract is the contract — and the people you signed alongside are the only ones you owe more than that.", alignment: "LN" },
    { text: "Survival. Every job has a way out planned before you walk in. The ones who forget that don't come home.", alignment: "N" },
    { text: "Honor. The ones who sign with you are entitled to your back; the ones you sign against are entitled to a clean fight.", alignment: "LG" },
    { text: "Compassion. You've seen what war does to the ones who can't fight back, and you've started picking your contracts with that in mind.", alignment: "NG" },
    { text: "Domination. The world goes to those who can take it, and pretending otherwise is the lie of people who couldn't.", alignment: "LE" },
    { text: "Cruelty. You've stopped flinching at the work, and there's a part of you that's stopped wanting to.", alignment: "NE" }
  ],

  noble: [
    { text: "Responsibility. Privilege is owed back to the people whose work made it possible.", alignment: "LG" },
    { text: "Order. The structures that govern us are imperfect, but they are how civilization endures.", alignment: "LN" },
    { text: "Mastery. Those born to power are obligated to wield it well — better than they were given it.", alignment: "LN" },
    { text: "Largesse. The honor of a house is measured by what it gives, not what it holds.", alignment: "LG" },
    { text: "Independence. The judgment of the house is yours by birthright, and you answer to it before any council, peer, or king.", alignment: "N" },
    { text: "Authority. Some are born to rule and others to be ruled, and pretending the order is otherwise produces only chaos and suffering.", alignment: "LE" },
    { text: "Aggrandizement. The house's standing is yours to elevate, and any who stand in the way are obstacles to be removed.", alignment: "LE" }
  ],

  outlander: [
    { text: "Nature. The wild has its own laws, older than any kingdom's, and you respect them more than the ones written down.", alignment: "N" },
    { text: "Self-Reliance. You ate what you caught and slept where you found shelter. The lessons of that don't leave you.", alignment: "N" },
    { text: "Honesty. The wilderness doesn't pretend, and you've stopped being able to either.", alignment: "CG" },
    { text: "Stewardship. The wild raised you. What you can do for it now is the obligation you're working off.", alignment: "NG" },
    { text: "Freedom. No fence, no border, no flag should command where a person walks. That's the law of the open country.", alignment: "CN" },
    { text: "Predation. The wild taught you that everything eats, and pretending you're above the law of teeth is how prey thinks.", alignment: "CE" }
  ],

  sage: [
    { text: "Knowledge. There is a truth at the bottom of every question, and approaching it is the work of a life.", alignment: "LN" },
    { text: "Wisdom. Knowing isn't enough. What's known must be weighed, shared, and used.", alignment: "LG" },
    { text: "Skepticism. Most of what people are certain of is wrong. Holding that lightly is the only way to learn.", alignment: "N" },
    { text: "Mentorship. What you've learned was given to you. The chain of teaching is the only thing keeping the world from forgetting itself.", alignment: "LG" },
    { text: "Discovery. The frontier of knowledge is a place; you intend to set foot on it, and it doesn't matter who's already turned back.", alignment: "CN" },
    { text: "Rigor. The careless and the credulous are the real enemies of truth, and they should be corrected without softness.", alignment: "LE" },
    { text: "Mastery. Knowledge is power, and the few who hold it are obligated to use it without false humility.", alignment: "NE" }
  ],

  sailor: [
    { text: "Camaraderie. The ship runs because the crew runs together, and you'd swing a hammer for any of them.", alignment: "LG" },
    { text: "Freedom. The sea has no roads, no fences, no kings. You crossed it, and you can't unlearn that.", alignment: "CN" },
    { text: "Respect. The water doesn't care who you are, and learning that taught you to stop pretending too.", alignment: "N" },
    { text: "Loyalty. The captain you serve is the captain you serve, and the ones who don't understand that haven't sailed enough.", alignment: "LN" },
    { text: "Adventure. There are coasts no one has charted, and you intend to be the chart that's drawn from your travels.", alignment: "CG" },
    { text: "Plunder. The sea gives what it gives, and only the law-abiding never get rich. You've stopped pretending you're sentimental about it.", alignment: "CE" }
  ],

  soldier: [
    { text: "Duty. The order is given. You carry it out. The thinking comes after, if it comes at all.", alignment: "LN" },
    { text: "Brotherhood. The unit is the line that doesn't break, and the people in it are the only ones who understand what you've done.", alignment: "LN" },
    { text: "Honor. The ones who fell beside you deserve a war fought the right way, even when no one's watching.", alignment: "LG" },
    { text: "Sacrifice. The line holds because some are willing to be the line, and you've already accepted what that means.", alignment: "LG" },
    { text: "Survival. The objective doesn't bring anyone home — discipline does, and you've stopped apologizing for prioritizing it.", alignment: "N" },
    { text: "Obedience. Orders are orders, and the questions about them are above your pay and ought to stay there.", alignment: "LE" },
    { text: "Glory. You signed up for something the civilians can't see, and the rest of your life is going to be measured against it.", alignment: "LN" }
  ],

  urban_bounty_hunter: [
    { text: "Justice. The bounty is the contract. The contract is what holds society together when courts can't reach.", alignment: "LN" },
    { text: "Pragmatism. Marks aren't villains, mostly. They're people who made a wrong choice, and your job is the choice's cost.", alignment: "N" },
    { text: "Persistence. Every mark thinks they can outwait you. They're wrong, and finding out is the lesson.", alignment: "N" },
    { text: "Mercy. Every mark has a story; you bring them in alive when you can, and you've taken cuts to your fee for it.", alignment: "NG" },
    { text: "Order. The marks are weeds in the city's garden; pulling them is the maintenance work no one wants to admit is necessary.", alignment: "LE" },
    { text: "Predation. The hunt is its own pleasure, and you've stopped pretending the contract is the whole reason you do it.", alignment: "CE" }
  ],

  urchin: [
    { text: "Survival. You ate when you could and slept where you could, and pretending those rules don't still apply is the trap.", alignment: "N" },
    { text: "Solidarity. The other kids on the street were the only family you had, and you don't forget what that taught you.", alignment: "NG" },
    { text: "Suspicion. People offering help usually want something. The ones who don't are rare, and you remember them by name.", alignment: "CN" },
    { text: "Compassion. Every street kid you see is the kid you were, and you do what someone might have done for you.", alignment: "NG" },
    { text: "Liberty. No one owns you, no one tells you where to be, and you'd burn before you took an arrangement that pretended otherwise.", alignment: "CG" },
    { text: "Greed. The streets taught you what scarcity feels like, and you've made up your mind to never feel it again.", alignment: "NE" },
    { text: "Cruelty. The world taught you the lesson young; you've started teaching it back to the world.", alignment: "CE" }
  ]
};
