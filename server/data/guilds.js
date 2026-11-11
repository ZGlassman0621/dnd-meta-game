// Guilds & Orders data module — staging only.
// Built from the verified sort at cc-guilds-sort.md (Troll Lord Games,
// Guilds & Orders: A Reference Guide, 2017). Data only: no wiring, no
// seeding, no prompt, no session, no route, no migration, no stats, no
// guild mechanics (no membership, reputation, dues, or influence systems),
// and no FR reskin. Names stay as the sort gives them; FR mapping of
// personal and place names is deferred (see GUILDS_META.reskinStatus).
// Titles are kept in book order with level ranges dropped. Where the sort
// says a due, fee, tribute, or payment exists, no figure is given here.
// The Longshanks have no titles in the book; their titles array is
// deliberately empty, not a gap. Shared title ladders are kept as the book
// gives them, not harmonised or deduplicated.

export const GUILDS_META = {
  name: 'Guilds & Orders',
  source: 'Guilds & Orders: A Reference Guide (Troll Lord Games, 2017)',
  reskinStatus: 'pending — FR mapping of personal and place names deferred; guilds are reskin material for unrecorded FR pockets, never FR organisations',
  note: 'System-neutral by design: leaders generally not named and no stats given in the source',
};

export const GUILDS = [
  // ---- Bard guilds (5) ----
  {
    id: 'iron-poets-guild',
    name: 'The Iron Poets Guild',
    section: 'bard',
    purpose: 'A guild of traveling bards, hard-fighting minstrels who enjoy satire and humor. They travel in small bands or with other groups, seeking adventures they can turn into tales and songs. Members must be dedicated to a life of adventure. Their humor makes crowds happy and masks their power; few walk away from an Iron Poet song feeling aggrieved. They are loved by many and often found at a monarch’s right hand or serving a merchant’s caravan.',
    hall: 'Multi-branch: many guild halls, usually in small towns or villages — walled-in courtyards with several tavern-like and inn-like buildings, generally self-sufficient, employing a small staff for food, water, and day-to-day affairs. Almost always a Minstrel in charge of a hall. Members staying in a hall pay room and board and perform tasks and work for the guild during their stay.',
    organisation: 'Very loosely structured; each hall manages its own affairs. The guild offers members’ services to merchants, drinking establishments, lords and ladies, and other customers, with payments going into guild coffers.',
    titles: ['Sagaman', 'Minstrel', 'Bard', 'Master Bard'],
    wealth: 'Wealthy; they hold the corner on many entertainment venues in many cities, and other bards are usually blocked out and forced to ply their skills in run-down sections of town. Commitment to battle and plunder has given the guild tremendous wealth, which has let it buy into all levels of society.',
    origins: 'Sprang from a need to organise and control the payments rendered to bards from noble families. Its founder’s desire to both earn money and cull it from his personal adventures set the guild apart in attitude and musical composition. Founder not named.',
    hooks: ['A bardic monopoly enforced against rival bards; an Iron Poet at court is a political actor, not just an entertainer.'],
  },
  {
    id: 'loremasters-guild',
    name: 'The Loremasters Guild',
    section: 'bard',
    purpose: 'A guild of bards, scholars, seers, and similar people whose bent is to gather the lore of various regions and peoples. Humans and demi-humans in almost equal numbers. Broken into schools, each dedicated to a local region, tasked with mastering its history. Material is written in books and scrolls stored at libraries; some becomes oral history retold far and wide. Well known as teachers and educators.',
    hall: 'Multi-branch: each region has a central library where that region’s information is kept, covering history and the common forms of flora and fauna. Libraries serve as book depositories and houses; members live in the halls, always on the first floor where they can offer a line of defense for the library. Halls are usually defensible; some are massive affairs.',
    organisation: 'Governed by the Librarians. Each guild house is placed under a Librarian’s charge; Librarians have access to all collected scrolls and books and hold the key to the organisation. Not all members are bards or minstrels; some are able scholars taught to recite litanies of information, in song or not. The guild welcomes new members who have the abilities to retain and understand information.',
    titles: ['Bragi', 'Travatore', 'Chronicler', 'Troubadour', 'Librarian'],
    wealth: 'Powerful members of almost every town or city where their halls stand. Access to knowledge, and willingness to sell it, gives them an important role in the political machinations of the powers that be. Access is gained through payments in gold but also in knowledge: visitors must leave some piece of information, however trivial. A due on member income exists (figure dropped).',
    origins: 'A small cabal of bards who devoted their service to the monarch decided, after much abuse, that information might be handled better and turned into a more lucrative part of their trade. Songs and tales became vessels of collected wisdom, and access was choked off except to those willing to pay. Those willing to pay were often willing to protect the source of the information. The idea spread and halls were organised everywhere.',
    hooks: ['A library that sells secrets and demands a secret in return; a lore monopoly that any party seeking hidden knowledge must deal with.'],
  },
  {
    id: 'unforgiving-mass',
    name: 'The Unforgiving Mass',
    section: 'bard',
    purpose: 'A bard’s guild dedicated to the dark gods, consisting of humans, humanoids, and demi-humans sharing a common bent toward evil. Often in league with local thieves’ guilds; both feed off each other, robbing from any and all they can. They use their craft to beguile people, rob or murder them, kidnap them, or set them up for others to do the same. Secretive: very few actually encounter members, or if they do, they do not know it. Many areas offer a bounty for a member; when caught, members are usually hanged, drawn, and quartered.',
    hall: 'No fixed hall: members travel singly or in small bands. New members are inducted after traveling with an older member and being secretly tested; once offered, someone who refuses to join is almost always murdered. New members are taught a secret language similar to cant.',
    organisation: 'No real organisation beyond training new members in the tricks of the trade: how to beguile or charm people, rob them, or con them out of their money. A Patriarch or Matriarch rules the guild from the settlements on the northern coast, but has little power and influence over the organisation as a whole. Individuals are supposed to journey to them and pay tribute; some do and others do not.',
    titles: ['Scop', 'Bragi', 'Rogue', 'Patriarch/Matriarch'],
    wealth: 'Little wealth beyond what each individual member possesses. They so rarely come together to work in concert that they have little or no influence anywhere other than with the gallows men, who regularly hang them.',
    origins: 'Stems from a community of beggars and thieves whose number included a fair songsmith. He struck on the idea of teaching others his craft in order to beguile victims to rob, and set about it with gusto. Members with musical aptitude were taught and sent out to ply their trade. At first they returned to pay tribute, but over time it fell apart and only some now return. The guild leader attempts to take back control from time to time, but these very bloody civil wars never end in anything but the status quo.',
    hooks: ['A secretive evil bardic network that is also a thieves’ guild in all but name; internal civil wars over tribute and control; bounties on members.'],
  },
  {
    id: 'red-skalds',
    name: 'The Red Skalds',
    section: 'bard',
    purpose: 'Hard-drinking, traveling brawling troubadours who spend as much time wooing members of the opposite sex as practicing their trade. Mostly humans, some demi-humans (usually half-elves). Constantly on the road plying their trade, returning to the guild hall when exhaustion or poverty overcomes them. Not often called upon except by indolent lords seeking wild tales of adventure that often cross over into the real world. Not an evil lot, nor using their trade to intentionally hurt others, but a mirth-filled club whose actions often leave others in ruins.',
    hall: 'Single hall: a lodge, the Wolf’s Lair, deep in the forests, where members gather to rest, recoup, and learn of each other’s exploits. Maintained by a small army of servants and usually guarded by well-paid mercenaries. A large dungeon lies beneath the Lair where the Skalds store their treasures and dues. The lodge’s location is secret, though some rangers and druids are aware of it.',
    organisation: 'No leaders, only a senate of members. Senior members meet to pass edicts, punish members, govern the lodge, and set standards. Other members may attend and participate but do not get a vote. One is chosen by common acclaim to govern the Senate, called by the other Skalds “First Bard.” People join only occasionally, for they must have a certain mindset and the necessary skills.',
    titles: ['Troubadour', 'Minstrel', 'Bard', 'First Bard'],
    wealth: 'Hold a great deal of power. Their many liaisons have left a network of victims behind them that have in turn bartered with the Skalds with information as well as gold. Shared with other guild members, this makes the Skalds people who hold secret information on many people. With this power comes risk: they are often found dead or go missing, themselves victims of some enraged mark. The lodge itself is home to a mountain of treasure.',
    origins: 'Born in the midst of a brawl. Two brothers working against one another to seduce a nobleman’s daughter ran afoul of her brother and his crew. The beating forced them to work in concert, and from there the Skalds were born, the original two bards setting the tone for the whole guild that came after.',
    hooks: ['A secret lodge full of treasure and blackmail material; a guild whose members’ love affairs routinely create enemies.'],
  },
  {
    id: 'barbican-guild',
    name: 'The Barbican Guild',
    section: 'bard',
    purpose: 'A guild of noble bards who specialise in voice, from song to tales. They rarely use instruments in recitations or on battlefields, where they strive to drive comrades on to greater deeds. Open to humans and demi-humans with a clear ability to sway crowds with renditions of famous odes and poems. The name derives from the power of the voice, seen by members as the first line of defense for any beleaguered people, as a barbican is for a castle. Well respected and much coveted in anyone’s entourage.',
    hall: 'Single hall: the sprawling Castle Lorn, on a high cliff overlooking the sea, accessed by a narrow spit of land guarded by several gates and barbicans. Defensible, usually manned by a small retinue of soldiery handpicked by the bards of Lorn. Beneath the castle are dungeons holding the guild’s treasure, keeping prisoners, and serving as a storehouse for times of siege. Bards dwell here when not on the road or in another service. Visitors come often seeking the guild’s assistance.',
    organisation: 'Militant, well armed, with a clear channel of command. From the Master Bard to the Scop all members serve a role. To join, one must be inducted by an Odist; once accepted the member becomes a Scop, advancing over time as their skills determine. The Master Bard rules during times of war or conflict; otherwise a council of senior bards rules the order. Members are required to tithe a share of their income to the guild (figure dropped).',
    titles: ['Scop', 'Fili', 'Bragi', 'Odist', 'Skald', 'Sagaman', 'Travatore', 'Chronicler', 'Troubador', 'Minstrel', 'Master Bard'],
    wealth: 'Well established throughout the region and called upon by many, high and low. A kindly guild, often staggering charges by audience: a day’s work at a peasant’s wedding might be bought for a few chickens, but a king’s wedding might cost a great sum. For this reason they are loved by all. Castle Lorn is a powerful, independent fortification, offering a military force not to be overlooked.',
    origins: 'Harcove of Lorn was a Warrior-Bard known for the songs he always sang as he waded into battle. As his prowess grew so did his reputation. He hired himself out many times, and as his wealth grew it struck him a good idea to expand it. He built the first small keep on the cliffs of Lorn and called others to his side. In time the guild grew as did its wealth and the castle.',
    hooks: ['A voice-magic bardic order that is also a fortress and a small army; a kindly guild with a hard military edge. Place name Lorn and the founder’s name need renaming at FR use.'],
  },
  // ---- Ranger orders (5) ----
  {
    id: 'deerstalkers',
    name: 'The Deerstalkers',
    section: 'ranger',
    purpose: 'A group of rangers, mainly humans and elves, loosely organised with no real guild hierarchy but with a network for exchanging information, knowledge, techniques, and anything else of importance. They primarily hunt brigands, outlaws, raiding parties of humanoids, monsters, or scouts for other armies. Known for aggressive tactics in bringing targets to bay, often killing them without malice or mercy. Highly sought after for all these reasons.',
    hall: 'No fixed hall: meets in predesignated areas, usually a druid’s holy ground, an old white oak tree, the mouth of a particular spring, and similar places. They gather on common days such as the solstice or the spring equinox to exchange news, induct new members, and learn from each other. Territorial: each band picks a base of operations, and one ranger, usually a lower-ranking one, stays at the base. If one band needs to contact another, they go to the base.',
    organisation: 'Bands travel together, with one being the band leader. Band leaders pick up and train new members; as members advance they either stay with the band leader or move on to cut out their own territory. Bands are usually very tight knit and work together well. Frequently bands group together to hunt dangerous or numerous opponents. New members are initiated at a holy site where meets take place, entering as Novitiates, then passing rigorous tests of skill and ability to deal with foes before being considered Deerstalkers. Those that fail almost always die.',
    titles: ['Novitiate', 'Novice', 'Able', 'Practiced', 'Seasoned', 'Veteran', 'Lord Ranger'],
    wealth: 'Little influence and almost no wealth to speak of, but their reputations carry them into many circles. Nobles frequently employ them in war or against raids; merchants hire them to guide caravans or hunt brigands; towns hire them to hunt outlaws. Known for a matter-of-fact approach to problems that almost always ends in death.',
    origins: 'Formed after independent hunters, trackers, and rangers began running afoul of each other’s territories or taking jobs that interfered with each other. What began as simple courtesies developed into a loosely structured guild where members look out for each other.',
    hooks: ['A territorial network of lethal hunters; a failed initiation means death; bands that will group against a dangerous target — or against a party that poaches their territory.'],
  },
  {
    id: 'green-watch',
    name: 'The Green Watch',
    section: 'ranger',
    purpose: 'An order of rangers and their retainers who serve as the eyes and ears of the realm. Few in number, but highly skilled and capable. These wardens dwell on the kingdom’s edge, patrolling the borders, always on watch for anything that could be a threat to their lords. Fiercely loyal, battle hardened, and aggressive. Rarely serve as master of the hunt, though more than capable; their skill set is built around more cognizant targets.',
    hall: 'Single hall plus rooms across the realm: the House of the Green Watch, near the overlord’s palace — a large building with a huge courtyard where new and old members learn to fight and shoot. The Watch has rooms in other domiciles around the realm, from a room in a minor lord’s castle to a bed in a peasant’s cottage. More often than not they dwell in the wilds, sleeping under star and moon.',
    organisation: 'Consists of a Ranger Lord and a body of rangers. Rank brings command: lower-ranking rangers cannot command other rangers, but once the Scout rank is achieved they are assigned a Huntsman, and so on up the line. Rangers may claim hospitality anywhere in the realm. (The book’s rank table ties each rank to a headcount, habitations, and pay — all figures dropped here; only the titles and the structure are kept.)',
    titles: ['Deerstalker', 'Huntsman', 'Scout', 'Pathfinder', 'Sheriff', 'Master of the Hunt', 'Master of Game', 'Warden', 'Marshal of the Realm', 'Ranger', 'Ranger Lord'],
    wealth: 'The Lord of the Realm relies heavily on the rangers, using them in almost every conflict and relying on them to keep careful watch. The Ranger Lord and the Rangers are always members of the council and advise or assist as needed. Used by merchants and other nobles as well. Because they are well paid in land and money, the Green Watch possesses a great deal of local power.',
    origins: 'The King called for an order of Huntsmen to form so he could better protect the kingdom from external and internal threats. The order was founded on a series of structured principles, of which loyalty to the crown is the greatest.',
    hooks: ['The crown’s border wardens with council seats and the right to hospitality anywhere — a party crossing a border will meet them, and a party opposing the crown will be watched by them.'],
  },
  {
    id: 'order-of-the-red-arm',
    name: 'The Order of the Red Arm',
    section: 'ranger',
    purpose: 'A band of hunters, humans, halflings, half-elves, and elves, known as a stalwart group of scouts and hunters whose skills are bent more toward the traditional hunt than to war. They spend more time tracking and locating prey than killing it — not a peaceful lot, but when employed they use their skills to find the prey, step back, and let their employer kill it. Distinguished by the red fletching and marks on their arrow shafts and arms, which they decorate themselves as a mark of honor.',
    hall: 'Single hall: a large manor house called the Red Barracks — walled acres surrounding one large house, several smaller ones, barns, and other outbuildings. The wall is marked by firing stands and small towers. Home to the Red Arms and their retainers, mostly servants who attend to the manor and serve as auxiliary forces in times of need. Here the Red Arms gather to feast, decide guild business, and exchange jobs.',
    organisation: 'Bands tattooed on the ranger’s upper right arm mark rank and station. Joining is not difficult: proving proficiency with tracking and animal husbandry can get one in the door, but the ranger must be good or of a good nature. The guild takes great pride in its honor and the manner in which it serves those around it. Crimes of any caliber are grounds for immediate expulsion; crimes that cause harm to the guild are usually punished by beheading. All members are paid per job but are required to pay tribute to the guild (figure dropped).',
    titles: ['Third Arm', 'Second Arm', 'First Arm', 'Sergeant', 'Sergeant at Arms', 'Captain', 'Deerstalker', 'Pathfinder', 'Huntsmen', 'Ranger', 'Lord of the Order'],
    wealth: 'A powerful guild found in a number of towns and cities. Professionalism, sense of honor, and drive to achieve deeds they are paid for makes them highly sought after. The guild itself is rather wealthy. The Red Barracks is fully fortified, maintained, and possessing all the comforts and advantages of a palace.',
    origins: 'Founded by Gervais of Luth with the express purpose of creating a guild able to serve others but also serve his community of trackers and rangers. A stalwart champion of the King’s and of a noble house, honor became a major component of the Red Arm. It has since spread to many areas.',
    hooks: ['Honor-bound trackers who find the prey and let the employer make the kill — a perfect hire for a party that needs a guide, and a dangerous enemy if their honor code is crossed. Name Luth needs renaming at FR use.'],
  },
  {
    id: 'left-bank',
    name: 'The Left Bank',
    section: 'ranger',
    purpose: 'A loosely structured order of hunters, trackers, scouts, and rangers serving several realms and cities, towns, and villages along the left bank of the Great River. Men, dwarves, elves, half-elves, gnomes, and halflings. Some work for lords and mayors, others hire out as independent contractors, and still others serve the region but know no master. A hard-fighting, tough crew, highly skilled, spending much of their time on the hunt in the wilderlands, watching the enemy that lives across the river.',
    hall: 'Multi-branch: they dwell along the whole length of the Great River, from its mouth to the estuaries. Common guild houses, paid for by the order itself: long houses built half into the ground, usually with dirt floors and stout wooden walls and shingled roofs, some monstrous in size. Here they gather to discuss business and feast.',
    organisation: 'Loosely structured with many independent agents. At times they gather in small groups commanded by one of their own, but usually only for particular reasons such as scouting for an army. They generally pay heed to the more experienced members of their order. Every member is required to pay tribute to the guild in both treasure and payments for maintenance of the guild halls. The halls are served by commoners, but there is always a house lord there.',
    titles: ['Deerstalker', 'Huntsman', 'Scout', 'Pathfinder', 'Sheriff', 'Master of the Hunt', 'Master of Game', 'Warden', 'Marshal of the Realm', 'Ranger', 'Ranger Lord'],
    wealth: 'A wealthy order, taking great care in husbanding its resources, including money. Local guild houses collect tribute from members and use it to maintain the houses and equipment necessary for the order. They also take many donatives from local lords who desire the Left Bank in their communities.',
    origins: 'The Great River serves as a boundary between the scattered realms of men and the wilderlands, home to hosts of beasts, bandits, humanoids, and other riff-raff. Scouts and adventurers who dared to cross the river began gathering in small groups to work together; in time these groups banded into larger groups and eventually into the guild itself. They are called Bankmen by some.',
    hooks: ['A river-border order that is both a guild and a border militia; a party crossing the Great River will deal with them, willingly or not. The Great River itself is a generic name needing an FR river at use.'],
  },
  {
    id: 'longshanks',
    name: 'The Longshanks',
    section: 'ranger',
    purpose: 'Known for the ability to cover a great deal of ground in a short amount of time. Largely humans and half-elves, though elves occasionally join. A reputation as stalwart and trustworthy, often used as messengers for nobles and their armies. Noted for light gear and the ability to carve a living out of almost nothing. They befriend druids frequently and the two work together.',
    hall: 'No fixed hall: some dwell in small groups in or near a town or village. Most live in the wilds alone, carving a living out of the wilderness, generally living a day’s travel apart, creating something of relay stations between larger communities. They have no particular guild halls or meeting houses. When there is need, the one in need sends runners to others and brings them to where they are, or asks a druid to assist in gathering the order. They meet in some secluded place in the wild to discuss whatever business is pressing.',
    organisation: 'Very loose structure, caring little for the organisation of houses and guilds. There are no titles or ranks, just various levels of skill. One Longshanks does not command another; they can only request assistance. They do gather together to defend each other: if one is killed, others frequently group to avenge them.',
    titles: [],
    wealth: 'Highly sought after by nobles, commanders, knights, and other personages for their ability to get information safely and quickly to distant holdings. Trustworthy as well, particularly useful when commanders are using large forces on many battlefields. For these reasons they often have information others do not. They rarely share it, even then only under extreme circumstances. Longshanks generally have no personal wealth, having no use for it.',
    origins: 'Formed in response to messengers who formed relays between distant posts. These organised in a loose band to exchange knowledge and craft, and from this the ranger order was born.',
    hooks: ['A messenger relay that knows things it will not share; killing one Longshanks brings the others for vengeance. A party that needs a message carried fast, or that needs to intercept one, must go through this network.'],
  },
  // ---- Thief guilds (5) ----
  {
    id: 'gravel-mongers',
    name: 'The Gravel Mongers',
    section: 'thief',
    purpose: 'A band of human and halfling street toughs, thieves, and fighters that hold allegiance to no one. Extremely violent and brutal in a fight, leaving their hallmark calling card, a fistful of gravel, in any murdered victim’s mouth. Involved in a wide variety of criminal activities, from petty theft to racketeering. They control the town’s supply of rock and gravel for road and construction.',
    hall: 'Single hall: near the city’s gravel pits and construction yards in the run-down part of town. They have dug out a series of rooms and halls underneath the pits, used as their base of operations, where members gather, sleep, rest, sort their booty, and attend all guild functions. There are satellite guilds in the surrounding towns, each run by a Stoneman.',
    organisation: 'Joining is relatively easy for anyone from the neighborhood: they must fight their way in. If they survive a fight with another member, they are given provisional status and the rank of Pebble. This is highly dangerous, as those not welcome are often killed in the introductory fight, sometimes by more than one member. Once granted Pebble status they must tribute a large share of all they take to the guild; their tithe decreases over time as they rise in the hierarchy (figures dropped).',
    titles: ['Pebble', 'Gravel Rat', 'Slate Dog', 'Rock Hound', 'Stoneman', 'The Masons', 'The Monger'],
    wealth: 'Not very powerful or wealthy; influence is minimal. They often claim control of the gravel pits and a town’s stone supply, but this is usually bought off, circumvented, or causes brutal street fights with the extremely wealthy Stone Masons, which the Gravel Mongers usually lose. They have a high turn-over rate due to guild deaths. They are, however, highly sought after for their brute force in a street fight.',
    origins: 'Founded early after the town’s first wall went up. The men employed in the gravel pits, mostly criminals or urchins, were horribly beaten, starved, and abused. One of their number, once an iron monger, banded them together, and in several small street riots established their dominance over the pits. Through a careful balance of bribery, theft, extortion, and violence they survived the early attempts to extinguish them, until they became part of the fabric of the town, albeit an extremely unseemly and violent part. Founder not named.',
    hooks: ['The introduction itself uses the Mongers as its example of a small guild, and their standing war with the Stone Masons (see the Granite Men) is the book’s clearest inter-guild conflict. A gravel fist in a victim’s mouth is a calling card a party can learn to read.'],
  },
  {
    id: 'kate-players',
    name: 'The Kate Players',
    section: 'thief',
    purpose: 'Thieves of any race who use bards to distract a crowd with song or dance while they pickpocket the crowd. A player (bard) begins music in a public place, usually with a hat or bowl out for donations, while a Kate (a pickpocket) roams the crowd. Not a particularly violent band, concentrating on picking pockets and cutting purses.',
    hall: 'Multi-branch: found in most large towns, frequenting every neighborhood, tavern, inn, bar, or marketplace. They always use a decent, nondescript house in a good neighborhood as their base of operations. Members dress to blend into their surroundings, never standing out as street urchins nor as dandies.',
    organisation: 'Very loose structure, usually based in the town they are occupying. Led by a Grand Commander and his Directors. Thieves petition for membership, usually paying a heavy joining payment to become a Stage Hand (figure dropped). Once in, they are apprenticed to another thief, usually an Usher. They advance through skill and stipends, buying their way to the top. The Grand Commander is chosen from the Directors, who in turn are chosen from the Actors. They often communicate with Kate Players in other towns, keeping tabs on bards who skip out on their pay, and similar matters. There are no attempts at any higher guild order.',
    titles: ['Stage Hand', 'Usher', 'Actor', 'Director', 'Grand Commander'],
    wealth: 'A tremendous amount of influence over local bards and their guilds, because they offer to front money to traveling musicians. The loans are done at exorbitant interest rates and finders’ fees. Among their services: finding suitable engagements for bards, housing them, buying or replacing their instruments, and meeting their other financial needs. Those bards who fail to earn money and pay back the debt are left at the mercy of the Kate Players and forced to earn their payment by setting up engagements in public places and distracting crowds, even to the point of keeping a thief from discovery or capture. They are given a share of the take, which is used to pay back the Kate Players. Many bards die in the service of the Kate Players.',
    origins: 'First sprang up in the larger royal towns where there were many down-and-out bards and plenty of audiences. A loose confederation of thieves used the bards to gather crowds and eventually organised themselves. The practice soon spread to other towns and villages.',
    hooks: ['A thieves’ guild that owns bards through debt — a direct pressure point on any bardic guild (Iron Poets, Loremasters, Red Skalds) and on any bard in the party. A crowd scene with music is never just a crowd scene when the Kate Players are about.'],
  },
  {
    id: 'whip-jacks',
    name: 'The Whip Jacks',
    section: 'thief',
    purpose: 'Found in most port communities. Loose associations of impoverished mariners who make their living by strong-armed robbery, burglary, freight theft, and fencing stolen goods. The lion’s share of their money comes from fencing, as they serve as middlemen for many other thief guilds and possible customers. A rough band of fighters and thieves, predominately human, but no mariner is turned away. Generally careful, attempting to keep a low profile, though their very rough tactics often bring them into conflict with local authorities.',
    hall: 'Multi-branch: guild halls always on the waterfront, usually in a warehouse or storage facility where they can hide stolen goods. The warehouse is always a legitimate business, usually marked by its actual lack of business and very old inventory that never seems to move. In this they hide their stolen wares.',
    organisation: 'The Whip Jacks vote on their leadership, the winner earning the title Captain of the High Seat. A Captain, once chosen, serves until killed or voted out of “his seat.” The only way to vote him out is for three separate guild members to call for a vote. If he loses the vote he is kicked out of the seat and a new vote is called. Transitions between one leader and the next are rarely peaceful. New recruits are hazed mercilessly, usually through a series of beatings and whippings. Anyone who cannot handle the punishment is denied entry, and usually killed.',
    titles: ['Scully', 'Midman', 'Rumjacks', 'Uncle', 'Captain of the High Seat'],
    wealth: 'Usually very influential and powerful, owning a great swath of a town’s docks. Harbor masters pay them, ship captains pay them, and anyone doing business on the waterfront does as well — all protection money to keep the Whip Jacks and others away from their goods. They also buy and sell items, buying stolen goods or loaning money out to the wealthy elite.',
    origins: 'Much like the Kate Players, the Whip Jacks sprang up spontaneously in large port towns. Ex-mariners got together to form groups to protect themselves, and from these more organised guilds sprang, eventually spreading to other port towns.',
    hooks: ['A dockside protection racket run by ex-mariners; leadership changes are rarely peaceful, which is itself a hook. Any waterfront business in a campaign will be paying them or fighting them.'],
  },
  {
    id: 'choir',
    name: 'The Choir',
    section: 'thief',
    purpose: 'A large, well-organised guild of pickpockets, cutpurses, burglars, smugglers, and hijackers. Humans, half-elves, gnomes, and even some humanoids. Well organised with a strict hierarchy, known for both finesse and abject cruelty. People who cross the Choir usually end up on the torturer’s rack. Known for a complicated series of calls, signs, and sounds to communicate with each other.',
    hall: 'Multi-branch: found in many towns and cities. The main guild hall is always built in an inconspicuous neighborhood, usually in the tradesmen’s neighborhoods. The hall itself is nondescript, but has access to several larger streets and the city’s sewers. Branches are set up throughout the town, from the very poor to the very rich, serving as safe houses for the thieves who people the Choir.',
    organisation: 'Difficult to join and highly structured from the Nippers to the Master. To join, one must be recommended to an Upright Man, who in turn will test the applicant’s skill at cutting purses. If the applicant fails the test, they are cut loose to suffer whatever punishment the city officials mete out. A second attempt to join is not allowed; anyone who attempts one is usually murdered. Those members found to possess a certain level of cruelty are given the extra title of Cat Gut: mean individuals who enjoy the suffering of others, used as the strong arm of the guild. Anyone with Cat Gut in their title pays a smaller tribute (figure dropped). Upright Men oversee lower orders; a Conductor oversees the upper orders. There is only one Conductor of the guild. Tribute shares by rank exist in the book; figures dropped.',
    titles: ['Nipper', 'Judicial Nipper', 'Glazier', 'Budge', 'Rank Rider', 'Cruiser', 'Upright Man', 'Drag Finder', 'Owler', 'Masters of the Trade', 'The Conductor'],
    wealth: 'Extremely powerful, with guild halls in many towns. Territorial, but careful to allow other guilds to exist in near proximity, often using them as foils against the powers that be. Their network is huge, and many, great and small, come to the Choir seeking aid in retrieving items, robbing individuals, staking out highways, and similar work. The Masters and Conductor are often leaders of their communities. They have close ties to the Urban Parkers.',
    origins: 'Began when a powerful noble drove out and cast off a band of children who had formed a choir for his entertainment. Forced to live on the streets, the children quickly learned to steal for their daily bread, all the while using their songs to communicate with one another. While one was robbing a store, another would watch and sing out if some threat materialised. Bereft of moral guidance, the children developed a mean streak and were not afraid of hurting others to reach their ends. In time they matured and the guild did as well, formalising its ranks and later spreading to other parts of the city. From there the Choir’s influence only grew, carrying over to other towns and villages, until it became one of the most powerful thief guilds in the region.',
    hooks: ['A choir of child thieves grown into a regional power; song as a communication code; close ties to the Urban Parkers and a willingness to kill on their behalf; territorial but pragmatic about neighbouring guilds.'],
  },
  {
    id: 'urban-parkers',
    name: 'The Urban Parkers',
    section: 'thief',
    purpose: 'A guild of female thieves, cheats, counterfeiters, forgers, kidnappers, pickpockets, and swindlers, feared by many in power, for their members often live dual lives. Married women high and low, unmarried women, street urchins, shop keepers, prostitutes — almost any woman or girl of a like mind can be a member. Well known for keeping confidence, often hired to hide people, kidnap children, or swindle goods from someone or some place.',
    hall: 'No fixed hall: no guild houses. The Parkers are divided into Houses that generally govern towns or neighborhoods. Each house is overseen by a Matron. These women meet when called by the Mother, but never at the same location. They report to the Committee of Seven, who also meet in a constantly changing location. If a meeting is called, the Queen Mother appoints a place. If the whole guild needs to meet for whatever purpose, the Queen Mother sends out a summons. The guild treasure is kept not in any one hall but apportioned by the Committee: a share by the Queen Mother and the remainder divided by the other women. In this way the guild is always protected unless the entire Committee were somehow captured or killed.',
    organisation: 'Governed by a Committee of Seven women, usually Mothers who control towns or regions, governed by the Queen Mother, who has absolute say over all guild decisions. The Mothers in turn control their houses and the Matrons theirs. Breaking rank is dangerous and usually gets someone killed. They rarely murder, but call on the Choir, with whom they have close relations, to kill the person in question.',
    titles: ['Scullion Girl', 'Street Pad', 'Limner', 'Parker', 'Mother', 'Queen', 'Queen Mother'],
    wealth: 'Possess as much leverage as wealth, using contacts in high and low circles to gain access to all levels of society. They use this leverage to protect themselves and others they deem useful or close allies. Because they keep themselves removed from murder and more heinous crimes, they are able to peddle this influence with even more acumen. Many turn to them to hide wealth or persons, or to have wealth transported or stolen.',
    origins: 'The first of the Queen Mothers was a prostitute who tired of the constant beatings and abuse. She set up a series of networks of women in similar positions and used them to better her own position. The networks eventually spread throughout the town and the guild was born. To hide it from prying eyes and protect the members (and herself), she established the loose nature of the individual Houses. Founder not named.',
    hooks: ['A guild hidden inside ordinary women’s dual lives, with a moving leadership and a distributed treasury that cannot be seized in one raid; its alliance with the Choir gives it a killing arm it does not wield itself.'],
  },
  // ---- Tradesmen guilds (5) ----
  {
    id: 'granite-men',
    name: 'The Granite Men',
    section: 'tradesmen',
    purpose: 'Stone masons, rock quarry workers, sculptors, and others employed in the granite or stone working business. A powerful association with guild halls in almost every city, town, and village, anywhere a stone mason has learned their profession from another. Well organised and exceedingly violent in protecting member rights and territory. Frequently at war with the Gravel Mongers, a thieves’ guild.',
    hall: 'Multi-branch: in any town of significant size with more than a handful of Granite Men and at least one Mason, they buy or rent a building where they gather to eat, discuss guild business, administer guild justice, house members, and handle other things concerning the guild. Guild houses are located in a more affluent part of town.',
    organisation: 'Each guild house is led by the Mason. A Master Mason commands several guild houses. When large events occur — international wars, or wars with other trade guilds — the Master Masons meet in a central location to discuss the guild’s position. Decisions are reached by votes and are not debatable: if anyone in a guild house refuses to comply, they are beaten to death by other members, or at least driven out. Anyone who works in the trade can apply to join, accepted regardless of station, so long as they are in the trade. Most common workers are flakers and will never advance beyond that. Some study to become stone masons or sculptors; to do that they must become an apprentice to a Master or a Mason and work their way up the ranks.',
    titles: ['Flakers', 'Apprentice', 'Apprentice to a Journeyman', 'Journeymen', 'Apprentice to a Master', 'Master', 'Apprentice to a Mason', 'Mason', 'Master Mason'],
    wealth: 'Powerful, controlling the work and conditions of almost every building project in any town there is. Well known to fight for their jobs: if a local lord hired commoners to build his house, the Granite Men would form a brute squad and attack the workers, killing or maiming them. Constantly at war with other stone mason guilds, independent contractors, and the Gravel Mongers.',
    origins: 'Formed as a response to the abuses of many lords who used the Stone Masons for difficult projects for little compensation and a high-risk factor. Their early members were very industrious, traveling between towns to organise themselves into a guild.',
    hooks: ['The book’s clearest trade-war: Granite Men vs Gravel Mongers over stone and building work, with brute squads as the enforcement arm. Any building project in a campaign town is their territory or a fight with them.'],
  },
  {
    id: 'pig-cleavers',
    name: 'The Pig Cleavers',
    section: 'tradesmen',
    purpose: 'A guild of butchers, mostly humans but attracting halflings, gnomes, and dwarves, men and women in the butcher trade. A tough crew who work hard to protect members from outside forces such as thieves’ guilds seeking protection money, inn keepers who will not pay fair market value, or nobles who undervalue their services. Few cross the Pig Cleavers, for they are a hard group not afraid of blood. Well armed for most street fights and known to relish the contest of arms. Many a street has soaked up the blood spilt by the Pig Cleavers.',
    hall: 'Single hall: the main guild hall, the Slaughterhouse, in the merchant’s district, serving as a meeting hall for all guild business as well as a haven for any member who finds themselves in trouble for any reason. Solidly built with no outside windows and high walls, making it a virtual fortress in town. Individual members carry their own cutlery in battle; the Slaughterhouse is well supplied with arms and foodstuffs.',
    organisation: 'Business is conducted by vote. Every Master Butcher has a vote in guild business. When anything requiring the guild’s attention comes up, a meeting is called and they gather in the Slaughterhouse; speakers explain the problem and a vote is called. Votes are binding to all members. Apprentice butchers are recruited by active butchers.',
    titles: ['Apprentice', 'Journeyman Butcher', 'Master Butcher'],
    wealth: 'A fairly wealthy guild, possessing some power in that they control a great deal of the foodstuffs in town. Extremely reactive street fighters: the slightest affront can send them tumbling into the street, cleavers and pig stickers in hand, hacking at whoever offended them. They collect little in the way of dues, and what they do collect goes toward maintenance of the Slaughterhouse. Little influence with the nobility in town; few members manage to acquire or retain jobs with the nobles.',
    origins: 'Came about during the Spillway War, while the town was under siege. Hungry people began attacking shop keepers and butcher shops most of all. The butchers in town gathered together and formed a brotherhood to protect shops and fellow butchers. They have been a pillar of the community ever since.',
    hooks: ['A food-supply guild that is also a street-fighting force; a siege-born brotherhood that still treats any affront as a fight. Control of foodstuffs is leverage in any town under pressure.'],
  },
  {
    id: 'copper-legion',
    name: 'The Copper Legion',
    section: 'tradesmen',
    purpose: 'A guild of guardsmen: men and women, humans and demi-humans and even, where called for, humanoids. Open to any who is trained or serves in the capacity of a city guard, night watch, caravan guard, and similar roles. Known for the copper coin riveted to their skull, usually on the side above the right ear. Also referred to as Copperheads. A dangerous guild to cross because members are well trained and organised and usually able to fight as a unit.',
    hall: 'Single hall: purchased and remodeled an open-air palace as headquarters, called the Armory. The central courtyard is used as a training field, the side rooms as barracks and storage for weapons and foodstuffs, and the larger halls for eating and dining. The guild leader dwells here, as do several training masters and his lieutenants.',
    organisation: 'Highly militarised, following a simple command structure. The Consul serves for one year and is voted in by the Legates and Tribunes. The guild’s command structure is often different from the city watch with whom they serve, but in general Optios are sergeants in the watch, Centurians are captains, and Tribunes are commanders. Anyone who serves as a guard in any capacity can join; they are immediately branded with the riveted coin to the head and introduced to the guild hall. (Tribute shares by rank exist in the book; figures dropped.)',
    titles: ['Legionnaire', 'Optio', 'Centurian', 'Tribune', 'Legate', 'Consul'],
    wealth: 'A powerful guild, responsible for the city’s protection. Because of this the guild is not particularly liked: its members serve to protect the populace but also work to protect themselves. Often at loggerheads with various factions in town, including nobles and their retainers and guards, city burghers, other guilds, and similar groups. Much of the guild’s wealth is spent on weaponry and training. They always attempt to protect members from being impressed into armies that march into the field, but at times, if the money is good enough, actively sponsor such excursions from their normal duties.',
    origins: 'Formed some time ago when a guardsman named Holveg was wrongfully arrested and put to death. Once he was vindicated, the city burghers did nothing to rectify the wrong, which caused a riot. Guardsmen ran rampant for several days and a host of thieves and cutpurses joined them. In the ensuing mayhem the city attempted to placate them and get them back to their posts. Realising they had strength in numbers, the guardsmen organised, marking themselves with copper coins riveted to their heads.',
    hooks: ['A guards’ union that is also a power bloc against the nobility and burghers — the people who are supposed to keep order are organised, armed, and willing to riot. A party dealing with the city watch is dealing with the Legion.'],
  },
  {
    id: 'sawbones-club',
    name: 'The Sawbones Club',
    section: 'tradesmen',
    purpose: 'A guild of doctors, surgeons, herbalists, and dentists, all manner of people in the medical profession. Highly organised, following a strict set of rules. They do not command the muscle many other guilds do, in numbers or brute strength, but walk the center line, as most everyone will be in need of a Sawbones’ services. For this reason they are treated carefully by people, guilds, nobles, and generally everyone. They fix prices for services as well.',
    hall: 'Single hall: a small fortified palace, the Boneward House, on the edge of the noble’s quarter. High walls guarded by several towers; access by one central gate requiring a password. Within, laid out like a military barracks, allowing members to live there in comfort and safety. The Sawbones use it in time of siege or riots. Always well stocked with provisions, and always protected by mercenary guardsmen housed in the House.',
    organisation: 'Run by a council of three, chosen for two-year terms by guild members. Every member is allowed a vote for the councilmen. Guild business is conducted in a public forum in the Boneward House, and guild members can participate. Serious decisions are put to a common vote. If several guild members call for a vote of no confidence for a councilman, an immediate election is held. Joining requires a joining payment and an elaborate initiation process involving various tests to determine the candidate’s capabilities (payment figure dropped). Rank notes from the book: Candidates and Initiates are usually apprentices in their chosen trade; Members are usually journeymen; Sawbones and Master Sawbones are masters; the Councilmember rank includes anyone who was a council member. (Tribute shares by rank exist in the book; figures dropped.)',
    titles: ['Candidate', 'Initiate', 'Member', 'Sawbones', 'Master Sawbones', 'Councilmember'],
    wealth: 'Very influential, as members are sought after by all classes of people for simple ailments to devastating wounds. Well paid, using their money to maintain the Club’s strength, the Boneward House, and to keep it well armed. Enough money accumulated to hire a small army for some time.',
    origins: 'Organised only late in the town’s history, when others began to take their services for granted. Many began to see doctors in an evil light, living unhealthy or dangerous lives, and these patients turned to the doctors to cure them of their woes. When the doctors failed, they were abused for it and cast as society’s pariah. Those in the profession revolted at this concept and organised. The guild works hard to cleanse bad members, set price controls, and discredit troublesome or complaining patients.',
    hooks: ['A medical guild that fixes prices, blacklists abusive patients, and can afford a small army — healing in this town is a guild service with guild politics attached, and a party that wrongs a Sawbones may find no healer will treat them.'],
  },
  {
    id: 'scrivener-guild',
    name: 'The Scrivener Guild',
    section: 'tradesmen',
    purpose: 'A collection of human, elf, and gnome scribes offering their services in most towns and cities. Some travel with caravans as permanent record keepers. They work for noble houses and merchant houses. Some are hired by adventurers and other travelers to log their exploits in the annals of history. Versed in several writing styles, from the complex to the simple. Not particularly educated, though many possess a greater than normal knowledge of regional history, information gathered over time.',
    hall: 'Single hall per town: sets up shop in town by purchasing or renting a small house in a quiet neighborhood. Usually well kept and clean, bearing a sign of an ink bottle and feathered quill. The opening rooms are for customers seeking a scribe; the back or upper rooms are for the scribes themselves, keeping supplies for guild members to purchase at discounted prices, gathering for meetings, feasts and celebrations, or entertaining guests of the guild. Always one or two scribes living at the guild house.',
    organisation: 'Little structure. Members are not beholden to each other or to the guild itself. They gain its benefits through discounted prices, price controls, protection if necessary, job placement, and similar benefits. The most powerful, if such a word applies, of the scribes are those in the guild house: they manage jobs and payments, negotiate with all parties seeking a scribe, and set pay rates for those in permanent employ. These are usually older scribes whose abilities have failed through arthritis or some other ailment. They are often bribed or attended to by other scribes to help grease the way to new jobs. All guild members take oaths of confidentiality, broken on pain of death by stoning. No scribe who is a member takes a job not recommended by the Scriveners Guild. People looking to employ a scribe are always directed to the guild house, where prices are negotiated so the scribe does not have to partake in the ugly business of negotiation. Very old scribes are always given homes to live in upon retirement, usually small houses or rented spaces. These Venerable Masters no longer work through choice or happenstance, unless there is some special circumstance.',
    titles: ['Apprentice', 'Journeyman', 'Master', 'Guild Hall Master', 'Venerable Master'],
    wealth: 'Very powerful, as members work for all classes of society, from rich to poor, and are party to all manner of information. The guild itself makes certain members are well paid and taken care of; abuses by an employer are not tolerated and allow one to get blackballed quickly — an action that can be devastating to a local organisation or government.',
    origins: 'Scribes have served the great houses for years, but when they realised some were well paid, others not so much, and still others abused and beaten, they began to organise. Slowly at first, various scribes communicated through letters to build a loose association. In time this became a powerful guild, spreading from town to city.',
    hooks: ['A guild that controls who writes what, for whom, at what price — and whose confidentiality oath is enforced by death. Any contract, chronicle, or forged document in a campaign passes through these hands, and a blackballed employer is a serious problem.'],
  },
  // ---- Wizard and illusionist orders (5) ----
  {
    id: 'ambit-guild',
    name: 'The Ambit Guild',
    section: 'wizard',
    purpose: 'A guild of wizards, witches, illusionists, and sorcerers represented in all the kingdoms of men, primarily humans with some demi-humans. Well known as aggressive practitioners of their craft. They serve both the guild’s needs and their own. Common members of adventuring parties, found in every hole, mountain, forest, and river bank in the world. They do not commonly hire themselves out to nobles or others, as their primary task is the acquisition of power as contained in the guild.',
    hall: 'Single hall: located on the physical plane and in a pocket dimension. Designed like a six-spoked wheel, the guild house contains rooms for members to live in, an extensive library, cells devoted to the study of magic, apothecaries, brewing rooms, and similar facilities. Members pay dues and dwell in the guild house or on their own as they choose. The guild house always has open rooms for traveling wizards to find comfort, despite their condition. The guild house is also kept in a pocket dimension, accessed by members via magic; here the real power and wealth of the guild is hidden.',
    organisation: 'Extremely loose structure, where members are governed by their own conscience. Members tribute a share of their income, depending on how much they can afford (figures dropped). A Grand Council of the Magi oversees the guild house, its maintenance and members and their activities, but possesses little in the way of governing authority. Knowledge is their primary goal, and keeping it safe in the pocket-dimension guild house is their goal.',
    titles: ['Travelers', 'Keepers', 'Grand Council Member'],
    wealth: 'Vast stores of wealth, both magical and mundane, are kept at the primary guild hall and with their members. Because of their reluctance to interact with local government, coupled with their accumulation of knowledge and power, they are often at odds with others. Generally distrusted; few turn to them for aid unless for a singular reason. They attempt to steer clear of all local entanglements and problems.',
    origins: 'An ambit refers to a compass, and the guild is named after it, for they seek knowledge at all points of the compass. First formed many years ago, when several wandering wizards met on the road and exchanged news of their discoveries. They struck up a friendship and a loose affiliation after that, and the guild grew out of that exchange.',
    hooks: ['A knowledge-hoarding wizard guild hidden in a pocket dimension — a party seeking a rare piece of magic must find a door that is deliberately hard to find, and deal with a guild that distrusts outsiders.'],
  },
  {
    id: 'cult-of-merithul',
    name: 'The Cult of Merithul',
    section: 'wizard',
    purpose: 'A band of wizards dedicated to the collection and mastery of secret knowledge and sorcery, things hidden from the world by the ancients. From all walks of life, high and low, all races of men and demi-humans. Noted by their tattoos of geometric designs that band their forearms. Subtle practitioners of the sorcerous art, drawing little attention to themselves through their deeds; for this reason few know of their existence and almost never seek them out. Fiercely loyal to one another.',
    hall: 'No central hall: each member has their own domicile where they build a base of power — towers, keeps, castles, palaces, houses, cottages, or whatever the individual desires. They communicate via magical means, whether a spell or item is up to the individual. Many members keep their locations hidden, even from their fellows, to protect both themselves and their compatriots from magical disasters. New members are inducted by another member but must be approved before knowledge of the Cult is handed to the new applicant. They in turn create a base from which they begin building their own pools of knowledge.',
    organisation: 'Structure based on experience and respect. Wizards are generally intelligent individuals, and cult members are no different; they can discern qualities of leadership in their own ranks, even those who may not be entirely self-aware. Those who earn the admiration of their comrades are the cult leaders. The greatest of these assumes the title of Arch Mage. Others are titled appropriately. There are no dues. Members take care of their own needs.',
    titles: ['Prestidigitator', 'Theurgist', 'Thaumaturge', 'Magician', 'Comus', 'Warlock', 'Gramaryian', 'Conjurer', 'High Mage', 'Sub Magus', 'Magus', 'Wizard', 'Arch Mage'],
    wealth: 'No accumulated wealth and very little in the way of influence. Secretive; members do not seek out power or influence. Known by a few and called upon from time to time when in need of secret knowledge.',
    origins: 'Came together when several powerful wizards banded together to seek out the power of the ancients. Failing this, they set themselves to the task of working together, albeit secretly, to bring about the guild’s ultimate goal. This has largely been abandoned in later years as new members seek ever different knowledge.',
    hooks: ['A secret society of knowledge-hunters with tattooed forearms and hidden domiciles — a party may deal with a member for years without knowing the Cult exists. The name Merithul needs renaming at FR use only in the sense that it is book-invented; it is not tied to any Aihrde canon in the text.'],
  },
  {
    id: 'wardens-of-elkhorn',
    name: 'The Wardens of Elkhorn',
    section: 'wizard',
    purpose: 'A conclave of powerful wizards known for deep knowledge in all things arcane, from travel upon the plains to battling the undead. Largely humans, though some few demi-humans make their way into the ranks. Well known and called upon frequently, though they use their power carefully, reserving it for those tasks they set themselves and those select personages with whom they possess a personal connection or find deserving. Their reclusiveness does not come from arrogance of power, but from the knowledge that many who seek it will abuse it, or at least fail to use it properly.',
    hall: 'Single hall: the guild house is on a hill just outside the walls of the old town of Elkhorn. A huge wooden manor serves as meeting hall and laboratory. Rooms are set aside for guild members and visitors. A great hall serves as chamber to feast, entertain, and for ceremonies. A sprawling complex with an extensive underground where are set a host of shops, halls, and rooms devoted to the craft.',
    organisation: 'Highly structured, led by an Arch Mage, a Council, and a Senate. To join, a member must recommend a candidate and the candidate must pass a series of competency tests. Members advance in rank only after extensive testing by three other higher-ranking guild members. All members are given a vote in the Senate, and these choose Council Members. The leader of the Wardens remains the founder, the Arch Mage Jamemsward.',
    titles: ['Entrant', 'Cabalist', 'Adept', 'Theurgist', 'Conjurer', 'Warlock', 'Magician', 'Enchanter', 'Initiate to the Secret Art', 'Sorcerer', 'Wizard', 'Magus', 'The Arch Mage'],
    wealth: 'Long ages have given the Wardens tremendous power. Their physical wealth in worldly treasures is large enough, but their connections to many kings and princes of the world, as well as men of common stature, has given them access to halls great and small. Few are the places a Warden cannot find friends. But their real wealth lies in the unfathomable knowledge of the arcane arts.',
    origins: 'Many years past, a young mage in the small town of Elkhorn made a name for himself with his skill in the magical arts. He cut his teeth in the deep dungeons of ancient beasts, seeking adventure, fame, power, and wealth. In time his abilities set him apart from other magi, and his power was matched by few. As the years passed, a desire to devote himself to the conquest of knowledge overrode his lust for battle and plunder. His hometown of Elkhorn had grown in the many years since his youth, and he returned to his roots. He founded the Wardens of Elkhorn, a guild of like-minded adventurers, carefully selecting young wizards to serve in his order. In time it grew until the wizards were a force from the frozen north to the seas of the distant south.',
    hooks: ['A powerful, selective wizard conclave that helps only those it finds deserving — a party must earn a personal connection to get its aid, and a Warden’s friendship opens doors everywhere. Names Elkhorn and Jamemsward need renaming at FR use.'],
  },
  {
    id: 'scintillant-dawn',
    name: 'The Scintillant Dawn',
    section: 'wizard',
    purpose: 'A guild of wizards who practice magic focusing on fire, heat, and motion. Large, including many peoples of diverse backgrounds, well represented throughout the human and demi-human realms. A reputation for evil, though this is not true; there have of course been evil members, but by and large they are a neutral guild. Their reputation comes from the nature of their magic, which can be highly destructive, though they argue they are exercising control only. Heat is a fundamental part of motion, and all things must be moved to greater deeds or they languish in the shadow of what could have been. Often called the Unclouded, forever at war with the Wintertide Guild.',
    hall: 'Multi-branch: guild halls everywhere, ranging from small to large, but always made of stone house with slate shingle roofs. The guild halls, called Halls of Fire, offer members places to live, study, practice, test, and interact with others. An audience chamber exists in them all, where people can come to hire the guild or one of its members for any number of magical tasks. Halls of Fire are usually built with defense in mind, from both the magical and the mundane.',
    organisation: 'Highly structured, from top to bottom. Applicants must petition for entry at one of the guild houses; once accepted they are assigned years of duty in the Hall of Fire before being given to another as an apprentice (duration figure dropped). Moving up through the ranks is done by experience and rigorous tests which must show the master certain spells. Apprentices are awarded a spell book with several spells. Each rank attained is rewarded with one spell added to their book. At the highest levels the guild has an Arch Mage who presides over a council. These usually meet on metaphysical planes to discuss club business. Every member must give a share of their income to the guild (figure dropped).',
    titles: ['Prestidigitator', 'Theurgist', 'Thaumaturge', 'Magician', 'Comus', 'Warlock', 'Gramaryian', 'Conjurer', 'High Mage', 'Sub Magus', 'Magus', 'Wizard', 'Arch Mage'],
    wealth: 'Powerful, with guild houses everywhere. Members serve kings and princes, merchants and their houses, people, communities, and themselves. But the loyalty of the Unclouded is never in doubt: it lies with the guild. Monies flood the guild’s coffers from tribute made by guild members, payments made by those seeking the guild’s help, and other means both nefarious and above board.',
    origins: 'Many years past, a large guild, the Order of the Celestial Tapestry, was known far and wide. Its members were highly respected magi serving a variety of purposes. But the guild split into factions over dogma and the practice of magic. Eventually the factions broke the guild apart, many leaving entirely to forge their own path. But the two most powerful formed rival guilds: the Scintillant Dawn, or the Unclouded, and the Wintertide, or the Gloaming. Their rivalry eventually came to blows, and the two guilds have been at war as long as can be remembered.',
    hooks: ['One half of the book’s great wizard war — fire and motion against ice and binding. A party hiring a Dawn wizard, or caught between Dawn and Wintertide, is stepping into a war older than memory.'],
  },
  {
    id: 'wintertide-guild',
    name: 'The Wintertide Guild',
    section: 'wizard',
    purpose: 'A guild of wizards practicing magic focusing on ice, cold, and binding magic. Large, though not so large as the Scintillant Dawn. Many wizards from all walks of life and races of humans and demi-humans. Seen by many as evil, and its reputation is somewhat deserved: they believe the world is filled with chaos, represented by how it embraces the destructive powers of fire. The Wintertide Guild believes peace is found in control of others, in dampening the fires of desire and locking them in the cold embrace of winter. Ice is the binding agent, and all things must be held for the greater good, for if not guided by the invisible hand, they cause chaos and pain. Often referred to as the Gloaming, forever at war with the Scintillant Dawn.',
    hall: 'Multi-branch: houses in many towns and cities, less common in small burgs, for few welcome them. In large population centers their towers are easily forgotten. The Wintertide guild house is a tower of stone surrounded by a low wall, always lavishly decorated, with large dungeons underneath. The tower itself is small and serves more as an entry point; beneath, in the dungeons, are hosts of rooms for members to meet, practice their craft, and conduct guild business.',
    organisation: 'Structured much like a feudal kingdom, with the Arch Mage ruling all beneath him and delegating powers and responsibilities. Each tower is given rule of its own members, and the master of each tower is called Lord of the Tower. They are answerable to the Arch Mage. Joining is not easy, as they generally seek out applicants who have magical abilities; these can be from other guilds or wholly unknown. There is no tribute, but donatives are encouraged and the guild thrives upon it, for members can buy status from the Arch Mage.',
    titles: ['Prestidigitator', 'Theurgist', 'Thaumaturge', 'Magician', 'Comus', 'Warlock', 'Gramaryian', 'Conjurer', 'High Mage', 'Sub Magus', 'Magus', 'Wizard', 'Arch Mage'],
    wealth: 'Little influence with common people and not much more with nobles and merchants. Generally closed off from normal society, but members do occasionally join the service of some lord or other. Inward facing, exploring magic on their own terms. A vast fortune, however, as members pay donatives to gain rank and station. Their repository of magic is extraordinary as well.',
    origins: 'Same history as the Scintillant Dawn: the Order of the Celestial Tapestry split over dogma and the practice of magic, and its two most powerful factions became the Dawn and the Wintertide, at war as long as can be remembered.',
    hooks: ['The other half of the wizard war — binding and control against fire and motion. A Wintertide tower in a town is a lavish, forgettable building with dungeons underneath; a party that discovers one has found a faction headquarters, not a dungeon entrance.'],
  },
];

export const GUILD_PEOPLE = [
  { name: 'Harcove of Lorn', role: 'Founder, Warrior-Bard; built the first keep on the cliffs of Lorn', guildId: 'barbican-guild' },
  { name: 'Gervais of Luth', role: 'Founder; stalwart champion of the King and of a noble house', guildId: 'order-of-the-red-arm' },
  { name: 'Holveg', role: 'Guardsman, wrongfully arrested and put to death; his vindication and the burghers’ failure to rectify it sparked the riot that formed the guild', guildId: 'copper-legion' },
  { name: 'Jamemsward', role: 'Founder and current leader, Arch Mage', guildId: 'wardens-of-elkhorn' },
];

// Hall-shape derivation rule for guildsByHallShape(shape):
// 'single' — the sort header says single hall, single hall per town, or
//   single hall plus rooms (Green Watch: one primary hall, rooms elsewhere).
// 'multi' — the sort header says multi-branch, or halls/houses/libraries
//   in many towns, regions, or along a river.
// 'none' — the sort header says no fixed hall, no guild houses, no central
//   hall, traveling, or meets/relay only. No guild was ambiguous under this
//   rule: every sort header states one of these shapes outright.
const HALL_SHAPES = {
  'iron-poets-guild': 'multi',
  'loremasters-guild': 'multi',
  'unforgiving-mass': 'none',
  'red-skalds': 'single',
  'barbican-guild': 'single',
  'deerstalkers': 'none',
  'green-watch': 'single',
  'order-of-the-red-arm': 'single',
  'left-bank': 'multi',
  'longshanks': 'none',
  'gravel-mongers': 'single',
  'kate-players': 'multi',
  'whip-jacks': 'multi',
  'choir': 'multi',
  'urban-parkers': 'none',
  'granite-men': 'multi',
  'pig-cleavers': 'single',
  'copper-legion': 'single',
  'sawbones-club': 'single',
  'scrivener-guild': 'single',
  'ambit-guild': 'single',
  'cult-of-merithul': 'none',
  'wardens-of-elkhorn': 'single',
  'scintillant-dawn': 'multi',
  'wintertide-guild': 'multi',
};

function copyGuild(g) {
  return { ...g, titles: [...g.titles], hooks: [...g.hooks] };
}

export function guilds() {
  return GUILDS.map(copyGuild);
}

export function guildById(id) {
  const found = GUILDS.find((g) => g.id === id);
  return found ? copyGuild(found) : null;
}

export function guildsBySection(section) {
  return GUILDS.filter((g) => g.section === section).map(copyGuild);
}

export function guildsByHallShape(shape) {
  return GUILDS.filter((g) => HALL_SHAPES[g.id] === shape).map(copyGuild);
}

export function people() {
  return GUILD_PEOPLE.map((p) => ({ ...p }));
}

export function peopleForGuild(guildId) {
  return GUILD_PEOPLE.filter((p) => p.guildId === guildId).map((p) => ({ ...p }));
}
