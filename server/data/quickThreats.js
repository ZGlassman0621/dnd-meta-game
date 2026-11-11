/**
 * quickThreats.js — Quick Threats & Side Treks (Troll Lord, 2019), staged
 * for the 2024 system. DATA ONLY. No stats, no wiring, no seeding, no
 * prompt, no session, no route, no migration.
 *
 * Source: ~/workspace/dnd-app-review/cc-quickthreats-sort.md, built FROM
 * THE SORT, not re-extracted from the PDF. Plots, hooks, NPCs, places,
 * twists, and outcomes are the sort's, condensed in substance, never
 * extended with new plot beats. No C&C statblock, level, HP, AC, damage
 * die, DC, save, gp, XP, or reward figure appears anywhere in this file.
 * Where the source gives a reward, the sort records that a reward exists
 * and needs 2024 conversion; this module omits rewards entirely.
 *
 * Monster statuses come from the sort's §5 index, exactly:
 *   '2024'   — direct 2024 Monster Manual entry under that name.
 *   'reskin' — only where the sort explicitly names a reskin source
 *              (tail-goblin → goblin). No other monster is upgraded.
 *   'blocked' — no 2024 equivalent, including hieracosphinx (pending
 *              verification against the 2024 sphinx entries).
 * A trek is "playable" only if every monster in it is '2024' or
 * 'reskin'. Blocked is a status on the monster, not a reason to drop
 * the trek: all 18 treks are included.
 *
 * STAGING PATH: this file lives at
 * ~/workspace/dnd-app-review/cc-quickthreats/quickThreats.js and belongs
 * on the Mac at server/data/quickThreats.js. The test file's import is
 * already the Mac path (../server/data/quickThreats.js) and needs no
 * change on copy.
 *
 * Reskin notes (from the sort, not FR canon): Buvine (Trek 6) is a
 * trek-invented local deity name, rename for FR; "Salubrious Removal
 * Inc." (Trek 16) is anachronistic company styling, rename for FR. All
 * town/person names below are reskin material for an unrecorded FR
 * pocket, never FR canon. No Aihrde names appear in this book.
 */

export const QUICK_THREATS = [
  {
    id: 'a-delightful-evening',
    title: 'A Delightful Evening',
    premise:
      'The Bottomless Mug is a famous roadside tavern by a fast creek — good food, good drink, clean rooms, famous evening entertainment. In the off-season it is nearly empty. Its gnome proprietor, Weldon Shacklesbeard, is a gracious, uncannily funny host who greets arrivals with warm mead, heaps of food, and discounts. He is not evil, but years of daily threats from a boggart that lives off the tavern’s proceeds, taking food and gold and threatening to kill him, have driven him to nefarious ends. The boggart also holds a korred prisoner in the tavern basement, in magical shackles, chained to a wall. The korred plays a flute of charming, mingled almost imperceptibly with the entertainers’ music, so patrons tip generously. That is the whole of the charm’s purpose: more tips. Nothing more is ever done.',
    hook:
      'The party arrives at the Bottomless Mug in late winter or another low-travel season, is welcomed lavishly, and notices (or not) an extra tune in the music whose origin is not apparent. Performers circulate asking for donations; the music is described as extraordinary, relaxing, and mood-lifting. Characters are never forced or required to tip.',
    npcs: [
      { name: 'Weldon Shacklesbeard', role: 'gnome proprietor of the Bottomless Mug, unusually small, gracious, funny, frightened', motive: 'to be freed from the boggart without causing himself or his establishment much damage' },
      { name: 'The boggart', role: 'extortionist living off the tavern’s proceeds', motive: 'to keep Weldon in fear and keep taking food and gold' },
      { name: 'The korred', role: 'prisoner musician chained in the basement', motive: 'to be freed, and to help capture the boggart' },
      { name: 'The entertainers', role: 'singers and readers of comedy at the Bottomless Mug', motive: null },
    ],
    places: [
      'The Bottomless Mug (common room, Weldon’s personal chamber, basement beneath the common room where the korred is chained; the basement door is in Weldon’s chamber)',
    ],
    twist:
      'The beloved tavern’s generosity is funded by a protection racket enforced by charm magic. Freeing the korred ends the charm but exposes Weldon to the boggart’s revenge; Weldon himself asks the party to free him from the boggart without causing himself or his establishment much damage.',
    outcomes: [
      'Party frees the korred and helps it exact revenge on / capture the boggart',
      'Party exposes or ignores the charm',
      'Party sides with Weldon, with the boggart, or walks away from a tavern that was never quite what it seemed',
    ],
    monsters: [
      { name: 'Boggart', status: 'blocked' },
      { name: 'Korred', status: 'blocked' },
    ],
  },
  {
    id: 'a-devil-of-a-time',
    title: 'A Devil of a Time',
    premise:
      'For nearly a month, a screaming fiend has terrorized the walled town of Harrisburg (about 900 inside the walls, another ~1,000 in three nearby burgs). Every few days it flies the streets shrieking — its screech halts all communication while it lasts — biting people and stabbing them with its tail. It has injured many but killed no one yet. The cause: a wizard, secretly renting a small house near the creek outside town, tried to summon a familiar before he could control it; the fiend killed him and, once summoned, had no choice but to stay. It never rests, needs no lair, moves nightly, and recuperates its voice in high places (attics, chimneys, eaves, tower tops), always near a window or other escape route. It avoids combat and flees before fighting. Once it senses a worthy foe hunting it, it escalates: more attacks, deadlier attacks, and possibly kidnapping small children.',
    hook:
      'The party arrives in Harrisburg, hears the town leaders’ offer, and soon hears that a body has been found near the Rendering — the dead wizard, with the remains of his summoning ritual. The local farmer who rented him the house thought he was simply away on one of his months-long trips.',
    npcs: [
      { name: 'Laird Niven', role: 'baron of Harrisburg', motive: 'to have the fiend caught, having called out the city guard and militia, who have failed' },
      { name: 'The dead wizard', role: 'unnamed, secretive tenant near the creek', motive: null },
      { name: 'The farmer landlord', role: 'rented the wizard his house', motive: null },
    ],
    places: [
      'Harrisburg (small walled town)',
      'The burgs Burlston, Applecart, and Rendering on Valleybreak creek (Rendering furthest, about half a mile out)',
      'The wizard’s small house near the creek outside town',
    ],
    twist:
      'The monster is not invading — it is stranded, and hunting it makes it worse. The town’s own failure to find the body hid the cause for a month. The fiend’s escalation is a direct response to being hunted.',
    outcomes: [
      'Party captures or kills the fiend (an onerous task: finding a constantly moving, never-sleeping, escape-obsessed creature)',
      'Party banishes or returns it',
      'Party fails and the fiend begins killing and kidnapping',
      'Party discovers the wizard’s house and ritual first and changes the town’s understanding of the problem',
    ],
    monsters: [
      { name: 'Screaming fiend', status: 'blocked' },
    ],
  },
  {
    id: 'a-terrible-swift-death',
    title: 'A Terrible Swift Death',
    premise:
      'A remote region is emptying: peasants, farmers, merchants, and craftsmen fleeing, villages and small keeps abandoned or barricaded, the land strewn with the dead. Rumour says a dragon or worse. The truth is a behemoth that has moved in and laid a clutch of eggs in 11 locations across roughly 100 square miles, each nest at least half a dozen miles from the next, eggs hidden under mounds of dirt. It patrols nest to nest in a fairly regular pattern, ranging further out with each passage, killing predators and, above all, humans and demi-humans, whom it instinctively treats as the direst threat to its young. In its first sweep it killed dozens of villagers and destroyed one keep. It lingers a day or two at each nest, rests only a few hours by day, and is easy to track: huge, ripping up trees, scratch marks, a marking stench smelled for a hundred yards. If attacked it fights ferociously, but at about half hurt it retreats to heal, leading pursuers away from any nest, hiding in overhangs and holes; once healed it tracks its attackers by scent and hunts them. If not killed, it works the region for about a month, then leaves for new territory, leaving the eggs behind.',
    hook:
      'A call for salvation from a remote region; refugees streaming out; rangers or druids notice the absence of game and the behemoth’s sign. Villages are small (a few dozen people); keeps are square stone or wood towers holding a handful or a family — fortified manor houses more than castles.',
    npcs: [],
    places: [
      'The 11 nests (half a dozen miles apart)',
      'The villages and small keeps of the region',
      'Forest overhangs and holes where a wounded behemoth hides',
    ],
    twist:
      'Killing the behemoth is only half the job: every unfound nest is a future behemoth. Most eggs are not viable, and a survivor takes years to matter — so the trek’s consequences can return long after the party leaves, when the community calls for help again. Egg-buyers may want their money back when an egg proves inert.',
    outcomes: [
      'Party kills the behemoth and destroys all nests',
      'Party kills it but misses nests (a young behemoth hatches years later)',
      'Party drives it off',
      'Party is hunted in turn after wounding it',
      'Party harvests eggs for sale and deals with disappointed buyers',
    ],
    monsters: [
      { name: 'Behemoth', status: 'blocked' },
    ],
  },
  {
    id: 'cupids-arrow',
    title: "Cupid's Arrow",
    premise:
      'Prince Albert Innacan offers a job: ten years ago his wife, Princess Fatazz Oonfafeful, was taken from a hunting encampment by satyrs while the prince chased boar. Years of searching found nothing; the prince gave up. Now his rangers report the princess and a satyr located in the Dreadful Forest, a place most fear to tread, and the prince asks the party to bring his wife back to the palace. Much of his tale is true — but he omits the essentials. The princess is of low birth, married for her great beauty over the disapproval of the prince’s mother and then of the prince himself. The prince took up with another princess of noble lineage whom he planned to marry, leaving Fatazz to be cast aside in penury. She contacted her youthful friend and companion, the satyr Xenephon, who devised her escape during the hunt. They have lived in the forest for a decade and fallen madly in love. The prince’s decade of hunting them is revenge and wounded honor: unable to defend his bride, no princess would marry him. The party will also be followed by one of the prince’s rangers, sent to make sure they do what they are paid to do; if they do not, the prince is angered further and seeks mercenaries to kill the party, the satyr, and the princess.',
    hook:
      'The prince’s commission, delivered as a rescue job. The party can find the pair easily near the site of the last battle — the satyrs are accompanied by three more of their kind, one keeping watch.',
    npcs: [
      { name: 'Prince Albert Innacan', role: 'prince commissioning the rescue', motive: 'revenge and wounded honor; he plans a replacement marriage and wants his bride back' },
      { name: 'Princess Fatazz Oonfafeful', role: 'low-born princess living in the forest with Xenephon', motive: 'to remain free rather than live as a slave to a cruel master; she asks the party to help her stay free' },
      { name: 'Xenephon', role: 'satyr, the princess’s youthful friend and lover, struck by a deadly poison from a ranger’s arrow, with days to live unless cured', motive: 'to live free with the princess' },
      { name: 'Three companion satyrs', role: 'satyr companions of Xenephon', motive: 'to talk, confuse, or fight to hinder the party' },
      { name: 'The prince’s ranger-tracker', role: 'unseen follower, enforcer of the commission', motive: 'to make sure the party does what it is paid to do' },
    ],
    places: [
      'The prince’s palace (offstage)',
      'The hunting encampment (ten years ago)',
      'The Dreadful Forest and the site of the last battle, where the rangers were killed except one',
    ],
    twist:
      'There was no kidnapping. The "rescue" is an abduction in reverse, and the clock is a dying satyr: cure him and the party gains a lifetime friend and a satyr eternally indebted; fail and the princess loses everything twice. Talking to the satyrs before fighting can reveal the truth before the party reaches the princess; if a fight breaks out and a satyr may die, the princess herself appears and begs the party to leave them in peace.',
    outcomes: [
      'Party returns the princess (for pay, against her will)',
      'Party helps her stay free and cures Xenephon (gaining allies)',
      'Party refuses the job and is hunted by the prince’s mercenaries',
      'Party kills satyrs and discovers the truth too late',
    ],
    monsters: [
      { name: 'Satyr', status: '2024' },
    ],
  },
  {
    id: 'dance-party',
    title: 'Dance Party',
    premise:
      'A family of sixteen grigs is travelling through the woods to a new home, in a very good mood, well supplied with drink and food, having met no ill encounters. They meet the party and, being a bit tipsy, decide on a little fun. First they size the party up by observation — actions, clothes, symbols carried. Then, invisible, they play practical jokes for a day or two: tied shoelaces, emptied food pouches, bugs in food, rocks in backpacks, holes cut in shoes. They intend no harm, though the party may see it differently. Then they spike the party’s drink at night or whenever gear is left unattended: a tasteless, strong brew that makes the drinker sing and laugh, puts them in a good mood, and loosens coordination. While the party is inebriated and not aggressive, several grigs disguise themselves as poor gnomish beggars, tell a humorous tale of woe (funny-tasting water, things disappearing, beetles in food, silver bugs eating wool blankets), ask to camp "for safety sake," and, if allowed, cook a staggeringly good meal from rare area herbs they collected. The meal temporarily boosts constitution and is meant to build stamina for the dance party. Later that evening the rest of the grigs gather in the nearby trees; two fiddlers play, and the music compels dancing. A second, very good fiddler joins, making resistance harder. If the party is friendly, the grigs dance with them, stay all night, share drink and food, explain they are headed to a new home, invite the party to travel with them, and offer the meal’s ingredients if asked.',
    hook:
      'The party is travelling through woods and is followed, joked upon, and gradually befriended by creatures it cannot at first see. The encounter escalates from pranks to spiked drink to beggars to feast to dance, and only resolves into friendship if the party does not turn aggressive.',
    npcs: [
      { name: 'The sixteen grigs', role: 'family travelling to a new home', motive: 'fun, then friendship; they intend no harm' },
      { name: 'The two fiddlers', role: 'grig musicians', motive: null },
      { name: 'The disguised "gnomish beggars"', role: 'grigs in disguise, storytellers', motive: 'to camp with the party for safety sake and share the feast' },
    ],
    places: [
      'Woodland camp and nearby trees',
      'The grigs’ route to their new home (destination not specified)',
    ],
    twist:
      'The "beggars" are the pranksters; the feast is preparation for a compulsion the party has not consented to; the meal’s key ingredient is four exceedingly rare herbs, each collected in a different season, so a full year of gathering goes into it. The meal can only be eaten weekly without harm — overeating it poisons the eater.',
    outcomes: [
      'A night of dancing, food, drink, and a travelling invitation',
      'A hostile party drives the grigs off or fights invisible pranksters',
      'The party learns the herb lore and the meal recipe (a year-long gathering project, one herb per season, searched square mile by square mile)',
    ],
    monsters: [
      { name: 'Grig', status: '2024' },
    ],
  },
  {
    id: 'duty-calls',
    title: 'Duty Calls',
    premise:
      'A goodall has watched over the village of Silent Green for a decade or more, chasing off goblins, orcs, a giant, and other malevolent creatures, proud of its work, mostly incognito, its acts unrewarded, known to only a few villagers. Recently a nafuel moved into the region. The goodall kept it confused and distant for weeks, but in one encounter the nafuel wounded the goodall so badly it had to lie low a week to heal. In that week the nafuel closed on the village, killed a few cows, then a villager. The few villagers who knew of the goodall left to find it and were killed before they did. The goodall has just learned of their deaths and plans to return and protect the village as best it can — but it disappears during daylight, so it seeks others to aid it by day.',
    hook:
      'The party, travelling the road to Silent Green and camped at night, is approached by the goodall appearing as a crow. With limited telepathy it can contact a good-aligned character, giving only impressions and general warnings: evil is afoot, great danger threatens the characters and all nearby. The intent is to send the party to the village.',
    npcs: [
      { name: 'The goodall', role: 'guardian of Silent Green, proud, wounded, daylight-limited, telepathic, impressionistic rather than articulate', motive: 'to return and protect the village, aided by day by others' },
      { name: 'The nafuel', role: 'stalking predator, hunts just outside the hedge just after sunrise and before sunset, retreats to the forest by day', motive: null },
      { name: 'The dead villagers who knew the goodall', role: 'villagers killed while seeking the goodall', motive: null },
      { name: 'The villagers of Silent Green', role: 'terrified villagers, divided over blame', motive: null },
    ],
    places: [
      'Silent Green (about 400 people, hedge wall around most houses and barns, those outside the walls moved inside for safety, a large crudely made wooden horse statue in the center, well tended, with offerings at its feet)',
      'The forest where the goodall fought the nafuel (a place of so many tracks it looks like a whole pack gathered)',
    ],
    twist:
      'The villagers believe their local deity, Buvine (a trek-invented local deity name — reskin for FR, do not import the name as canon), has abandoned them for some offence, and the village is fracturing over blame. The real explanation is worse: where the goodall fought the nafuel, the nafuel’s blood cloned six more nafuels. The "pack" is one creature multiplied. The goodall returns in the evening to aid the party and speak again to its earlier contact.',
    outcomes: [
      'Party defends the village by day while the goodall aids by night',
      'Party follows the tracks and finds the cloning site',
      'Party mistakes the crisis for divine abandonment and gets drawn into the village’s blame-hunt',
      'The nafuel pack overruns Silent Green',
    ],
    monsters: [
      { name: 'Goodall', status: 'blocked' },
      { name: 'Nafuel', status: 'blocked' },
    ],
  },
  {
    id: 'horde',
    title: 'Horde',
    premise:
      'Big Rock is a farming community of about 300, thirty houses along a road by a sluggish deep creek, in a region at peace for a century or more — no walls, no barriers, the nearest fortification over twenty miles away. Its sister village, Little Rock, ten miles up the same road and creek, was destroyed seven months ago by a virulent infection that swept through in days, killing most inhabitants. The only person of power in the area, the cleric Millicent, left to find the infection’s source and has not been seen since — because she is dead. Survivors moved to Big Rock or to the town of Boulder; a few who returned to bury the dead caught the infection themselves and died; the rest were left to rot where they fell. The contagion was not natural: the necromancer Baleful One Eye caused it. Baleful is from Big Rock. Born with a disability, he was ridiculed as a child, abused after his parents died, "rescued" by a cruel sorcerer who made him a servant and, by accident, an understudy. Years of study and travel did not dim his anger. He has returned to kill everyone in both villages, and in the months since the infection he has raised a horde of zombies in Little Rock — 246 of them, travelling in small packs toward Big Rock along the road and through fields and woods to either side, not yet across the creek, taking roughly four hours to cover the mile to Big Rock. Baleful himself has already left the region, area, and even plane, leaving behind one memento: a note on a door in Little Rock reading, "To my friends and family of old, Die! Your beloved gimp."',
    hook:
      'The party walks into an apparently forgettable village. The first sign of trouble comes a little over a mile outside Big Rock after they leave it: one shambling humanoid on the road, easy to dispatch — then a few more in the fields, then more to the left, then more, until the party realizes the zombies have moved around them and are walking toward Big Rock. None of the backstory is to be revealed until well into the adventure, if ever.',
    npcs: [
      { name: 'Baleful One Eye', role: 'necromancer, absent by the time of the adventure', motive: 'revenge for childhood ridicule and abuse, not conquest' },
      { name: 'Millicent', role: 'cleric, dead offstage, her disappearance the first mystery', motive: null },
      { name: 'The villagers of Big Rock', role: 'unwalled, unprepared, unaware villagers', motive: null },
    ],
    places: [
      'Big Rock (unwalled farming village, 30 houses, creek road)',
      'Little Rock (abandoned, unburied dead in fields and houses, the note on a door)',
      'Boulder (refuge town, offstage)',
    ],
    twist:
      'The villain is gone. The horde is a delayed revenge weapon, not an army under command — the party cannot kill the necromancer to stop it, only the horde itself, and the horde’s numbers grow as the party notices more of them. The infection story is a cover for a murder that happened months ago.',
    outcomes: [
      'Party warns and defends Big Rock (which has no walls and no fortification within twenty miles)',
      'Party is encircled on the road',
      'Party traces the horde to Little Rock, finds the note, and learns the truth',
      'Party fails and Big Rock falls',
    ],
    monsters: [
      { name: 'Zombie', status: '2024' },
    ],
  },
  {
    id: 'in-the-valley-of-evil',
    title: 'In the Valley of Evil',
    premise:
      'Years ago an evil lord summoned a pack of shadow mastiffs and loosed them only to hunt those he could not find or reach. The lord has died; his rule is thrown off; the mastiffs remained. For years they have roamed a region of forest, hills, and savannah, killing and maiming travellers. Locals take what precautions they can and offer a standing reward per mastiff head; three have been killed over the years and their skulls displayed on a town wall. None know how many remain; estimates run four to ten. In fact seven remain of an original twelve, roaming a range of about 100 square miles, splitting up, hiding by day in deep holes or anywhere without sunlight, leaving no tracks, invisible unless they move into light or make noise — and destroyed instantly by sunlight or magic mimicking sunlight. They are drawn to good-aligned people, especially lawful good. When one finds a potential victim it follows for a time, then calls the pack: howling and baying that rise in tempo and pitch as the pack gathers over a day or two or more, then near-silence as they wait patiently for an opportune attack. They feel no urgency, only appetite.',
    hook:
      'The party travels through the mastiffs’ range. If a good-aligned character is present, one mastiff crosses their path and chooses them. The party should become aware they are followed — preferably by working it out from the howling, the lack of tracks, and a late-night glimpse of glowing red or yellow eyes and teeth. A mastiff will even linger outside a town or sneak in at night rather than lose its prey.',
    npcs: [],
    places: [
      'The 100-square-mile range (forest, hills, savannah)',
      'The town wall displaying three mastiff skulls',
      'The mastiffs’ daylight holes',
    ],
    twist:
      'The adventure is built on tension and impending doom, not a single fight: days of being followed, escalating howls, then silence. The prey is chosen by alignment, not by anything the party did. The mastiffs’ patience is the weapon.',
    outcomes: [
      'Party realizes it is hunted and prepares, flees the range, or is ambushed by the gathered pack',
      'Party hunts the mastiffs one by one (sunlight is a weapon)',
      'Party loses the chosen member',
    ],
    monsters: [
      { name: 'Shadow mastiff', status: '2024' },
    ],
  },
  {
    id: 'one-puddle-too-far',
    title: 'One Puddle Too Far',
    premise:
      'Belfort is a fortified town of roughly 600 on a rise above a river, overlooking broad farmland: fields, fences, hedges, cows, sheep, pigs, barns, granaries, storehouses, work sheds, a few houses, then dark oak and beech forest. A thirty-foot wooden wall wraps the town, one gatehouse, about thirty houses and buildings plus the manor house (the only stone structure). Six people have been killed in a few weeks — four in the fields, one on the road, one inside Belfort days before the party arrives. Victims were smothered, suffocated, beaten, or "broken"; no cut marks, no robbery, no connection between them, all upstanding. They were always found in mud puddles or muddy ground — a fact nobody volunteers, because in the rainy season there is always mud everywhere. The town is panicking and fears something supernatural. Its young, inexperienced knight-ruler, Estry Holdinhous, given the hold as a favor to his father, believes there is a murderer in his midst; his chief aide Valry Purse is just as ill-equipped, and the few men-at-arms add little. Extra guards and open carry have not stopped the killings; the best huntsman is at a complete loss. The cause, unknown to all: a travelling cleric spent a night outside Belfort under a tree and accidentally dropped a clay charm of elemental summoning; immersed in water, it dissolved and activated, summoning a mud elemental. The elemental does what mud elementals do — kill things, about once a week or after enough rain, arising from mud puddles. It moved from the fields into Belfort because people stopped going to the fields after the first murders. It is too stupid to do anything but kill; when the ground is dry it must remain in the earth, and it can only re-form where it went to ground if that ground becomes muddy or puddled again. It currently lies in the ground beside a house in Belfort, waiting for heavy rain (days away).',
    hook:
      'The party arrives in a panicked town with a ruler who suspects murder, a huntsman with no trail, and a pattern only visible in retrospect: after a rainstorm, alone, beaten or suffocated, in mud.',
    npcs: [
      { name: 'Estry Holdinhous', role: 'young knight, owner of Belfort, inexperienced, out of his depth, favour-appointed', motive: 'to find the murderer he believes is in his midst' },
      { name: 'Valry Purse', role: 'chief aide', motive: null },
      { name: 'The travelling cleric', role: 'unnamed, offstage cause, long gone', motive: null },
      { name: 'The huntsman', role: 'best tracker in town, baffled', motive: null },
    ],
    places: [
      'Belfort (hill town, wooden wall, gatehouse, manor house, thirty buildings)',
      'The fields and the road between fields and town',
      'The patch of ground beside a house where the elemental waits',
    ],
    twist:
      'There is no murderer, no motive, no connection between victims — the killer is weather-activated and mindless, and its weakness is also its schedule: it cannot act until it rains, and it cannot leave the ground it went to ground in unless that ground gets wet again. The town’s own precautions (staying out of the fields) drew it into town.',
    outcomes: [
      'Party deduces the pattern before the next rain and digs out or traps the waiting elemental',
      'Party is present when the rain comes and faces it in a puddle',
      'Party hunts a human murderer who does not exist while the killings continue',
    ],
    monsters: [
      { name: 'Mud elemental', status: 'blocked' },
    ],
  },
  {
    id: 'rocky-foundations',
    title: 'Rocky Foundations',
    premise:
      'Durbin’s Keep sits atop a steep-sided hill over a valley of scattered farmsteads, occupied for hundreds of years by a dozen generations of the loyal Durbin family, who always sent their best to serve the crown. The region is unproductive and poor, so the keep is badly maintained: mortar giving way, roof needing repair, wooden ramparts old and rotted — but still defensible, until about a month ago a wall cracked, the cracks spread, and within a week part of the wall collapsed. Under the wall, retainers found a tunnel, not of natural make. The lord, Mac Hanon, sends workers down; they do not return by nightfall, and at sunset something else emerges from the tunnel and kills a few people. Panic follows: the keep’s retainers and Mac Hanon abandon the fort for the village below. The fort is ancient: centuries ago a Durbin was buried beneath the keep with all his mortal goods, including a large blue vase, magically enhanced, containing a dozen tavis worm babies. The vase’s magic wore down, the worms escaped, and they have spent years burrowing through the hill’s rock, drawn to something in the rock they find delightful and nourishing. They are scattered through dozens of tunnels deep in and around the hill, do not normally congregate, but can hear one another within a hundred yards and call for aid in a fight.',
    hook:
      'The party arrives in the valley within days of the collapse. The village of Durbinshine (about thirty buildings plus barns and sheds, no tavern, a general store with stalls to sleep in, a merchant who serves whatever brew someone in town most recently made) talks of nothing but the collapsed wall — at the store, or overheard from a Durbin retainer. Mac Hanon, seeking people to lead into the keep and clear it, quickly agrees if the party volunteers or looks capable.',
    npcs: [
      { name: 'Mac Hanon', role: 'lord of Durbin’s Keep, pragmatic, willing to abandon his fort and hire strangers', motive: 'to have the keep cleared and reoccupied' },
      { name: 'The Durbin retainers and workers', role: 'discoverers, first victims', motive: null },
      { name: 'The general-store merchant of Durbinshine', role: 'gossip hub, informal innkeeper-brewer', motive: null },
    ],
    places: [
      'Durbin’s Keep (hill fort, collapsed wall, tunnel beneath)',
      'Durbinshine (village at the hill’s foot, general store)',
      'The tunnel network under the hill',
      'The ancient burial trove beneath the keep (blue vase, long empty)',
    ],
    twist:
      'The collapse is not siege, age, or a dragon — it is an escaped burial good, still breeding in the rock. The locals guess dragon, great lizards, or "pets of those who dwell under the world." Clearing the keep means clearing a tunnel network, not a single monster, and noise brings more worms.',
    outcomes: [
      'Party clears the tunnels and the keep is reoccupied',
      'Party finds the burial trove and the vase’s story',
      'Party is driven out by worms answering one another’s calls',
      'The keep stays abandoned and the worms spread',
    ],
    monsters: [
      { name: 'Tavis wyrm', status: 'blocked' },
    ],
  },
  {
    id: 'scrambled-eggs',
    title: 'Scrambled Eggs',
    premise:
      'In an unexplored or abandoned region, the party finds a dead silver dragon, splayed out, covered in large puncture wounds, blood still seeping — killed only shortly before. Then a horn sounds in the distance: almost shrill, warbling slightly, one long note then two shorter notes without warbling, enough to send shivers through everyone. The sound’s direction is easy to follow; tracks lead from the corpse — large posthole-sized indentations with pointed tips, claws, easy to follow, made by something huge making no effort at concealment. After a day or so’s travel, the party reaches a tall, broad white tower, about 100 feet in diameter and nearly 200 feet tall, beautifully built, wide windows above. On top is a massive spider-like creature with eight legs, grasping the tower, pounding the walls with four legs; the tower top is destroyed, scattered or collapsed inward; screeching comes from within. The truth: a demon who loathed the dead silver dragon sent a reever to kill both the dragon and its offspring. The tower was the dragon’s home, where it gave birth to its only offspring, guarded by a retinue of five elven knights who have all been killed, taken by surprise. A very young silver dragon inside plans to fight the reever as best it can. The reever, focused on the young dragon, ignores the party until attacked — then turns solely on them, knowing the young dragon is the least of its worries, targeting those who can do it the most harm (clerics, then wizards first), and fighting to the death. The young dragon emerges to help at an advantageous moment, unwounded at the battle’s start.',
    hook:
      'A fresh dragon corpse, a warbling horn, and a trail of posthole tracks — the party is drawn to the tower before it understands the conflict. The elves’ bodies lie scattered around and within the tower; they belong to an order that protects the region’s few dragons.',
    npcs: [
      { name: 'The young silver dragon', role: 'orphan in the tower', motive: 'to survive and, if helped, to offer treasure and, more valuably, future aid and friendship' },
      { name: 'The dead silver dragon', role: 'parent, offstage victim', motive: null },
      { name: 'The five dead elven knights', role: 'order of dragon protectors, killed by surprise', motive: null },
      { name: 'The reever', role: 'demon-sent assassin, cunning, focused, fights to the death', motive: 'to kill the dragon and its offspring for its demon patron' },
      { name: 'The unnamed demon', role: 'offstage patron, at war with the dragon’s mother', motive: 'to destroy the dragon and its offspring' },
    ],
    places: [
      'The dragon corpse site',
      'The wilderness trail',
      'The white tower (200 feet tall, top destroyed, young dragon within)',
    ],
    twist:
      'The party is not the reever’s target — until it attacks, at which point it becomes the only target. The greater treasure is not the tower’s valuables but the dragon’s trust: leave the treasure and gain future aid; escort the young dragon to the nearest elven community, and better still bring the elven dead and treasure with it, and the party gains the undying friendship of the dragon and the elven community.',
    outcomes: [
      'Party kills the reever and escorts the young dragon to safety, with or without the treasure',
      'Party loots the tower and loses the dragon’s trust',
      'Party is targeted and destroyed by a reever that was never hunting them',
    ],
    monsters: [
      { name: 'Reever', status: 'blocked' },
      { name: 'Young silver dragon', status: '2024' },
    ],
  },
  {
    id: 'stripes-and-arrows',
    title: 'Stripes and Arrows',
    premise:
      'In a rainforest or jungle of old-growth trees of great height, a tribe of tail-goblins has recently moved in and is aggressively clearing its vicinity of threats and marking territory. Their village, about five miles from the first encounter, sits in the uppermost canopy among several dozen trees: a dozen huts connected by rope and wooden bridges, ropes, and vines, with hammocks and small landings scattered through the limbs. A patrol of ten adult males ranges the territory, killing animals it considers threats and placing marks and warning signs. Other creatures dispute the area, though the tail-goblins do not know whom — so the patrol is agitated and on guard. A patrol member spots the party (on a road or travelling through jungle); the tail-goblins follow from the treetops for a full day, trying to determine intent. They are impossible to move quietly in numbers, so the party should quickly know it is followed; the creatures look like large striped monkeys and sound like howler monkeys, but close observation shows long sticks and small bows. Before attacking, the patrol leader judges the party’s direction: moving out of tail-goblin territory, they are followed but not attacked, then left; moving deeper in, the shaman marks the party’s likeliest path with symbols scratched into trees and small stick figures, and as a final warning drops a shrunken head inside a spherical ball of sticks into the party’s camp at night or at their feet while moving. If the warning does not turn the party back, the tail-goblins commit to hit-and-run attacks from the canopy — spears and arrows from above, resupply and weapon-making in rotation, surrounding and corralling the party — until the party leaves, dies, destroys the village, or kills half the tribe. The whole community eventually joins, males and females; only the canopy-shy and the young do not, and the fighters leave the canopy only if they must or if the party is nearly defeated.',
    hook:
      'The party is followed for a day by something that looks and sounds like monkeys, then warned in escalating, unmistakable stages: signs, stick figures, a shrunken head in a ball of sticks. Every stage is a chance to turn back.',
    npcs: [
      { name: 'The patrol leader', role: 'judges intent and direction', motive: 'to defend tail-goblin territory' },
      { name: 'The shaman', role: 'marks paths, issues the final warning, carries a wand and good-fruit berries', motive: 'to warn intruders off before fighting' },
      { name: 'The tail-goblin chief', role: 'village leader', motive: null },
      { name: 'The tribe', role: '21 adult males, 11 females, 9 young', motive: null },
    ],
    places: [
      'The canopy village (dozen huts, bridges, vines, hammocks, five miles from first contact)',
      'The party\u2019s route through tail-goblin territory',
    ],
    twist:
      'This is a territorial dispute, not a monster hunt: the tail-goblins warn three times before fighting, and the fight ends only on leaving, death, village destruction, or halving the tribe. The party\u2019s direction of travel is the trigger — the same party, walking the other way, is never attacked.',
    outcomes: [
      'Party heeds the warnings and leaves',
      'Party pushes on and endures days of canopy hit-and-run',
      'Party destroys the village or halves the tribe',
      'Party negotiates with a people it first mistook for monkeys',
    ],
    monsters: [
      { name: 'Tail-goblin', status: 'reskin' },
    ],
  },
  {
    id: 'the-desolate-mesa',
    title: 'The Desolate Mesa',
    premise:
      'Four hieracosphinxes live and hunt a scrubland region of roughly 200 square miles, around a range of cliffs averaging 300 feet high, dividing an upper and lower steppe, the lower dominated by large mesas and buttes stretching a dozen or more miles from the cliffs, with sparse short grass and thorny bushes at mesa bases and along creeks. The hieracosphinxes came a hundred or more years ago, when a temple complex drew priests and pilgrims with offerings. Ploddingly dim but voracious and keen predators, they found pilgrims easy targets, stymied the pilgrim flow over a few years, and killed all the priests. No one has been to the temple in ages; the area is abandoned because of them, and tales say the temple holds great treasures from the pilgrim years. The temple complex is seven temples carved into the cliff face, each a door with at least one chamber behind it (typically no more than 40 feet deep and 100 feet wide), the cliff faces outside carved into elaborate statues of gods and mythological events, some 40 to 50 feet tall. The middle temple is the most important: six chambers, an entry chamber roughly 200 feet long and 50 feet deep, five spoke corridors each leading to a chamber, corridors connecting all five. All rooms show evidence of past animal habitation — broken furniture, bedrolls, storage crates. One chamber holds a very large nest of bramble and grasses. The central temple is where the hieracosphinxes collected their treasures, to what end no one knows. The hieracosphinxes live separately but near one another, roosting on mesa or butte tops, occasionally in the temples, changing nests sometimes. They hunt only about once a week or less, depending on their last meal; the rest of the time they sit in sun or shade, doing nothing.',
    hook:
      'The party enters a region where, each day, the chance the hieracosphinxes notice them grows. Once one finds them, it tests their strength with a few attacks: if they seem strong, it fetches its kin; if not, it spends hours slowly attacking until they are exhausted or spent, and only then moves in for the kill.',
    npcs: [],
    places: [
      'The seven cliff temples (middle temple: six chambers)',
      'The mesas and buttes (roosts)',
      'The treasure chamber in the central temple',
    ],
    twist:
      'The treasure is real and in a known place — but it is a lure in effect, guarded by predators that hunt weekly and test prey before committing. The source adds an expansion hook: something brought the hieracosphinxes here; nothing happens by chance; an evil cabal is headquartered in another temple complex nearby (unwritten — a seed, not a developed plot).',
    outcomes: [
      'Party loots the central temple and escapes between weekly hunts',
      'Party is tested, judged weak, and worn down over hours',
      'Party is judged strong and faces all four',
      'Party follows the expansion seed to the cabal\u2019s temple complex',
    ],
    monsters: [
      { name: 'Hieracosphinx', status: 'blocked' },
    ],
  },
  {
    id: 'the-endless-chatter-of-the-marsh',
    title: 'The Endless Chatter of the Marsh',
    premise:
      'Swamps spread hundreds of miles beyond uplands and hills. Along the marsh border sit several villages of a few dozen to a couple hundred people, independent of one another and of outside rulers, but closely connected by trade and marriage, living meagerly off the swamp\u2019s bounty. The marsh is rife with dangers: alligators in murky water, huge snakes among cypress roots, lizards and carnivorous monkeys in the canopy, poisonous plants, disease-bearing insects. Recently villagers have disappeared. At first this looked like a bad year with aggressive carnivores — until a young man on watch was abducted from within a village, leaving tracks unlike anything locals had seen: a large beast walking alternately on four legs or two, with claws like a local lizard only longer and larger, crawling out of a sluggish creek and leaving the same way. Two more such abductions followed in separate villages over the following weeks. One expedition into the swamp found nothing, not even remains. Some villagers fear the lizard men from the far side of the swamp have returned for food — all know they enjoy human flesh above all. Some have left; others have put out word for help. The truth: three babblers have moved into the area. Centuries ago, when the swamp\u2019s edge was first settled, the babblers of the area were eradicated in a gruesome slaughter that neither babblers nor lizardfolk have forgotten. At a lizardman shaman\u2019s behest, the babblers have returned to enact revenge on the villagers — and to test the villagers\u2019 fighting prowess: if they fail to resist, the shaman will call for war against his people and attack the villages to drive off or kill all inhabitants.',
    hook:
      'Word for help from marsh villages; a watchman abducted from inside a village; strange alternating two-/four-legged tracks to and from a creek; a failed expedition. The villages are now travelling in larger groups, and attacks are random in location.',
    npcs: [
      { name: 'The lizardman shaman', role: 'offstage patron, testing the villages as a prelude to war', motive: 'revenge for the old slaughter, and to test the villages\u2019 fighting prowess' },
      { name: 'The village shaman', role: 'makes alligator totems, learned from his father, and his father before him', motive: 'to protect against babblers' },
      { name: 'The missing villagers', role: 'abducted villagers', motive: null },
      { name: 'The three babblers', role: 'working independently, one attack about every two weeks, more often in villages now as swamp expeditions grow rarer', motive: 'revenge on the villagers, at the lizardman shaman\u2019s behest' },
    ],
    places: [
      'The marsh-border villages (trade- and marriage-linked)',
      'The swamp itself (cypress pillars, stagnant pools, creeks)',
      'The far side of the swamp (lizardfolk territory, offstage)',
    ],
    twist:
      'The abductions are not random predation but a revenge probe and a war test — the villages\u2019 response decides whether war comes. Babblers travel underwater for days, surfacing only snouts for air, making tracking exceedingly difficult; the telltale sign of babblers in an area is the complete lack of alligators, or alligator corpses, the two being mortal enemies. A wounded babbler that escapes leaves marks and calls its kin; gathering takes days, then they attack together.',
    outcomes: [
      'Party finds and kills the three babblers before the shaman judges the villages weak',
      'Party fails the test and war comes to the villages',
      'Party discovers the old slaughter\u2019s history and negotiates with the lizardfolk side',
      'Party uses alligator totems and the alligator-enmity clue to track the babblers',
    ],
    monsters: [
      { name: 'Babbler', status: 'blocked' },
      { name: 'Lizardfolk', status: '2024' },
    ],
  },
  {
    id: 'the-rot-is-more-than-skin-deep',
    title: 'The Rot Is More Than Skin Deep',
    premise:
      'In a district where crystals are found in creek beds, embankments, on the ground, and in shallow excavations and small mines, the party arrives in the village of Cryston on Thanberry (about 200 people, mostly farmers and a few professional crystal hunters, a wizard in residence, a druid who appears occasionally, a small wooden tower used by the absent sheriff, currently occupied by the town\u2019s appointed leader, Braxton Farmandson). The village is unsettled: crystal miners returned from the hills and died of horrible wounds that rotted their skin to a viscous soup. Two survivors, of a party of five, could barely speak, their faces partly rotted; the other three are presumed dead. Searching their packs, the sheriff found two small silver bowls and parchments: a map to Cryston on Thanberry, and a brief description of a warlord, Renard the Slayer, buried nearby. The miners were grave robbers in disguise: they came for Renard\u2019s burial, dug under cover of crystal mining, and succeeded — until they dug into the actual burial chamber. Four guardian trikills were placed in a druid\u2019s burial chamber, and the miners dug into the wrong mound. The trikills killed three miners and injured the two who escaped. The tomb: a mound forty feet tall and two hundred feet in diameter, a four-foot tunnel dug into one side entering near the middle, a single corridor with two deep alcoves on either side, an 8×12 room at one end where the druid lies on a rock pedestal, bones mostly rotted, stone and timber walls and roof, stone floor. A large stone that blocked the burial chamber has been removed; three corpses lie in the corridor; the trikills wander the corridor and remain in the tomb only a few weeks before feeling a need to feed again, then leave and wander the world. The alcoves hold mementos of the druid\u2019s past. The area holds hundreds of burial mounds from the final battle of a great war — Renard\u2019s actual burial among them, some mounds large multi-chambered vaults, some holding only a body.',
    hook:
      'A village in shock, two dying miners who can barely speak, a sheriff\u2019s find of silver bowls and parchments, and a tomb whose guardians are still inside — and will not stay inside.',
    npcs: [
      { name: 'Braxton Farmandson', role: 'appointed leader, occupying the sheriff\u2019s tower', motive: null },
      { name: 'The absent sheriff', role: 'sheriff, offstage', motive: null },
      { name: 'The resident wizard', role: 'wizard in residence at Cryston on Thanberry', motive: null },
      { name: 'The occasional druid', role: 'druid who appears occasionally', motive: null },
      { name: 'The five miners', role: 'three dead, two dying, grave robbers posing as crystal hunters', motive: 'to rob Renard the Slayer\u2019s burial' },
      { name: 'Renard the Slayer', role: 'warlord, buried somewhere among hundreds of mounds, never found in this trek', motive: null },
      { name: 'The buried druid', role: 'dead, mementos in the alcoves', motive: null },
    ],
    places: [
      'Cryston on Thanberry (200 people, wooden sheriff\u2019s tower)',
      'The crystal district (creek beds, embankments, shallow mines)',
      'The wrong mound (40 feet tall, 200 feet in diameter, corridor, two alcoves, burial room)',
      'The hundreds of other burial mounds',
    ],
    twist:
      'The miners found a tomb — the wrong tomb. The treasure they sought (Renard) is still out there, and the guardians they unleashed will leave the tomb within weeks to feed, becoming a wandering threat. The druid\u2019s burial goods remain on the body.',
    outcomes: [
      'Party clears the tomb and claims or respects the druid\u2019s burial',
      'Party misses the window and the trikills leave to wander',
      'Party keeps digging among hundreds of mounds for Renard and opens more tombs',
      'Party treats the dying miners as victims or as robbers who earned their fate',
    ],
    monsters: [
      { name: 'Trikill', status: 'blocked' },
    ],
  },
  {
    id: 'the-terror-on-bentbill-hill',
    title: 'The Terror on Bentbill Hill',
    premise:
      'The town of Benson and Hedges (about 500 people inside tall walls, on a hill over a lush valley with a wide slow creek) was once known for a menagerie kept by the wizard Mercuriala the Hook; people came from far and wide to see bizarre and rare animals. Interest waned, tourists trickled to nothing, and Mercuriala died unexpectedly one afternoon. Neither the mayor, Ballstum Angstian, his staff, nor anyone in town had the knowledge, capacity, or desire to care for the menagerie creatures. The mayor hired experts from the capital — "Salubrious Removal Inc." — financed by selling the wizard\u2019s belongings. Removal went smoothly until the very end: the last beasts, five cockatrices, escaped. Most of the removal staff were petrified by mishandling, and several townspeople suffered the same fate. Two cockatrices flew away at once (the source says five escaped, then describes two flying away and five taking up residence around town — treated in the sort as an author slip; five is the clearance number). The town was abandoned and the cockatrices took up residence in its buildings and towers. Salubrious Removal Inc. refuses to finish the job for lack of staffing. The mayor and townspeople are now homeless and seek help to reclaim the town. Pay is paltry; the town is poor, its wealth tied up in wheat, barley, and green beans, the wizard\u2019s goods already sold. The mayor might reluctantly give the wizard\u2019s tower away as compensation, but would rather have no more "famous" people in his town. The cockatrices have settled: one near the animal pens, dragging kills there to eat; one atop the tallest tower of the keep, the loudest, cawing at anything moving near the village; one further afield in a barn outside the village, hunting; the other two in various places around the village and outlying areas. In the wizard\u2019s tower basement, behind a secret door hidden by magical enchantments, is a small room holding Mercuriala\u2019s most treasured possessions: unsent love letters to his childhood sweetheart, Perilius Ventoor — now a despotic ruler of a faraway land — and a ring of wondrous power lying in a corner.',
    hook:
      'A homeless town of 500, a mayor offering a tower he would rather keep, and a walled town on a hill that must be cleared building by building. The town: a 30-foot wall with one (currently open) entry, roughly sixty multi-story buildings and a small keep on one main street looping the interior, the keep round, five floors, two 80-foot towers, animal pens near the entry, the wizard\u2019s tower 100 feet tall, six floors, with a large attached warehouse where the menagerie was kept.',
    npcs: [
      { name: 'Ballstum Angstian', role: 'mayor, out of his depth, reluctant to part with the tower', motive: 'to reclaim the town for its homeless people' },
      { name: 'Mercuriala the Hook', role: 'dead wizard, collector, unsent-letter romantic', motive: null },
      { name: 'Perilius Ventoor', role: 'childhood sweetheart, now a despotic ruler far away — a sequel hook, not a present NPC', motive: null },
      { name: 'Salubrious Removal Inc.', role: 'capital experts, petrified or refusing to return', motive: null },
    ],
    places: [
      'Benson and Hedges (walled hill town, keep, wizard\u2019s tower and warehouse, animal pens, barn outside the village)',
      'The wizard\u2019s tower basement secret room (love letters, ring)',
    ],
    twist:
      'The monsters are not invaders but abandoned property, and the town\u2019s poverty is the real obstacle: there is almost nothing to pay with except the wizard\u2019s tower, and the mayor hates parting with it. The secret room reframes the dead wizard from collector to unrequited lover — and hands the party a ring and a connection to a distant despot.',
    outcomes: [
      'Party clears the town building by building and earns (or is refused) the tower',
      'Party finds the secret room and the letters and ring',
      'Party negotiates a different price with a town that has only crops to offer',
      'Party leaves a petrified town to its birds',
    ],
    monsters: [
      { name: 'Cockatrice', status: '2024' },
    ],
  },
  {
    id: 'two-heads-are-better-than-one',
    title: 'Two Heads Are Better Than One',
    premise:
      'A small band of centaurs lives in a remote ancient forest, guarding its range for centuries, semi-nomadic, moving small villages from area to area, with one central gathering place: a temple hidden deep in the forest. A single ancient road passes through, from one city to another; those who leave the road in the old growth rarely return. The region is marked with wooden images of a forest deity said to live and guard there, and travellers leave offerings of food, fetishes, totems, coin, even weapons to appease it. No deity lives in the forest. The centaurs collect most offerings, sporadically, and ensure that those who enter the forest do not return alive, or return with terrifying stories of terrible beasts — a protection racket built on reputation. On the road the party finds what looks from a distance like a large animal offering: a horse lying on the ground. It is not a horse; it is Gorax, a gravely wounded centaur, passed out, bleeding from punctures and massive bruises, at death\u2019s door, needing revival before he can speak. If cared for or healed, he is grateful but guarded — few interactions with other humanoids in his life — and speaks his own language and a small amount of a local elven tongue. If he feels safe, or if there is an elf in the party, he tells the truth and asks for help saving the last of his band: giants have started raiding the forest; the first were easily dispatched, but he and a war party were ambushed by three giants and all but he were killed, a few dozen miles away. The giants are huge and two-headed: ettins. Four other centaurs survive, at the temple, awaiting the war band\u2019s return. Gorax must reach them soon and warn them before the ettins find them. Unknown to Gorax, the ettins are not hunting the other centaurs at all: they have moved into a cave in the forest — more a massive overhang on a cliff face — and are roasting the remains of the war band. They are easily tracked, not bothering to hide their tracks, and they quarrel with one another a lot.',
    hook:
      'A "horse" on the road that is a dying centaur. Healing or caring for him, or having an elf in the party, unlocks the story; without that, the party has a body and a mystery.',
    npcs: [
      { name: 'Gorax', role: 'wounded centaur survivor, grateful, guarded, speaks centaur and a little local elven', motive: 'to reach the temple centaurs soon and warn them before the ettins find them' },
      { name: 'The four surviving centaurs', role: 'at the temple, awaiting a war band that will never return', motive: null },
      { name: 'The three ettins', role: 'cave-dwelling, quarrelsome, roasting their kill', motive: null },
    ],
    places: [
      'The ancient road through the old growth (offering markers, wooden deity images)',
      'The hidden forest temple (centaur gathering place)',
      'The ettins\u2019 cliff overhang (tracks lead straight to it)',
    ],
    twist:
      'The forest deity is a fiction maintained by the centaurs themselves; the rescue mission is already too late for the war band, and the ettins are not even hunting the survivors — urgency and horror are both misaimed. The ettins\u2019 quarrelling is an exploitable weakness.',
    outcomes: [
      'Party warns the temple centaurs and confronts the ettins at their overhang',
      'Party arrives too late or not at all',
      'Party exploits the ettins\u2019 quarrels',
      'Party exposes or preserves the "deity" fiction',
    ],
    monsters: [
      { name: 'Centaur', status: '2024' },
      { name: 'Ettin', status: '2024' },
    ],
  },
  {
    id: 'without-crime-and-with-punishment',
    title: 'Without Crime and With Punishment',
    premise:
      'Adventurers travel into the wilderness, pillage ancient strongholds, and bring back gold, jewels, gems, rare magic — and other things: strange animals for zoos or menageries, mounts, pets, food; and demi-humans and humanoids captured for interrogation, imprisonment, punishment, or curiosity. Salamon Bait and his ten companions have been away nearly six months, raiding and pillaging at will in wilderness and disputed territories, and have returned with treasure and a train of prisoners and creatures: four large carts, each hauled by four oxen, each holding several creatures, helpers riding or walking alongside, none riding on the carts. The exact make-up of the prisoners is left to the Castle Keeper, but they should mostly be of decidedly evil bent — orcs, goblins, hobgoblins, similar humanoids — plus animals. One cart holds a mixture of orcs and goblins and one mongrelman. The party witnesses the caravan on the road, in a village, town, or city. If they examine the cages, they notice the mongrelman: unusual because he is crying, tears barely perceptible, evidently held back, but evident. The mongrelman is not evil, nor were his people. He and his band lived peaceably in the wilderness, moving from place to place for safety and to avoid contact with all others. They happened to occupy ruins Salamon\u2019s men wanted to loot; assuming the worst, Salamon attacked, the mongrelmen defended themselves and lost, and he was the last alive, taken prisoner. Not much of a fighter, he accepted his fate. He mourns his family and friends and his impending life of drudgery or worse — execution for crimes he never committed. Salamon and his followers are not entirely bad people: they wholeheartedly believe they are doing the world a favor by slaying evil monsters and retrieving lost treasures, and as a general rule they do not consider the repercussions of their actions, almost always assuming they are doing the right thing. They bring prisoners back to be punished for believed crimes or sold to zoos or collectors. The mongrelman, if freed, is very grateful but has no idea what to do with himself; he will linger with the party if allowed.',
    hook:
      'Witnessing the caravan and noticing one crying prisoner among the cages. Approaching the cage gets the party brushed away by guards; offering to pay frees him.',
    npcs: [
      { name: 'Salamon Bait', role: 'caravan leader, self-righteous, unreflective, believes his raiding is a public service', motive: 'to slay evil monsters, retrieve lost treasures, and punish or sell prisoners for believed crimes' },
      { name: 'His ten companions', role: 'helpers, cart guards', motive: null },
      { name: 'The mongrelman', role: 'grieving, non-violent, last of his band, grateful, directionless if freed', motive: 'to survive; if freed, he lingers with the party, directionless' },
      { name: 'The caged orcs, goblins, and animals', role: 'prisoners, make-up left to the DM per the source', motive: null },
    ],
    places: [
      'Wherever the caravan is met: road, village, town, or city. No fixed location — the trek is designed to drop into any setting.',
    ],
    twist:
      'The moral question is the trek: the "heroes" returning with loot are also slavers who killed a peaceful band on a mistaken assumption, and the one prisoner worth saving is the one who looks least like a victim and least like a threat. Buying him is cheap; deciding what he does next is the hard part.',
    outcomes: [
      'Party buys and frees the mongrelman (he lingers with them, directionless)',
      'Party ignores the caravan',
      'Party attacks Salamon\u2019s train',
      'Party investigates Salamon\u2019s other prisoners and finds more wrongful captures — or finds prisoners who genuinely are dangerous',
    ],
    monsters: [
      { name: 'Orc', status: '2024' },
      { name: 'Goblin', status: '2024' },
      { name: 'Hobgoblin', status: '2024' },
      { name: 'Mongrelman', status: 'blocked' },
    ],
  },
];

export function treks() {
  return QUICK_THREATS.map((t) => ({
    ...t,
    npcs: t.npcs.map((n) => ({ ...n })),
    places: [...t.places],
    outcomes: [...t.outcomes],
    monsters: t.monsters.map((m) => ({ ...m })),
  }));
}

export function trekById(id) {
  return QUICK_THREATS.find((t) => t.id === id) || null;
}

export function playableTreks() {
  return QUICK_THREATS.filter((t) =>
    t.monsters.every((m) => m.status === '2024' || m.status === 'reskin')
  );
}

export function blockedTreks() {
  return QUICK_THREATS.filter((t) =>
    t.monsters.some((m) => m.status === 'blocked')
  );
}