# Prose Quality A/B Results

Generated: 2026-04-26T15:02:48.403Z
Model under test: **Sonnet 4.6** (the model that runs continuations in production).
Baseline prompt size: **25716 chars** (~6429 tokens).

## How to read this

Each scenario was run against five prompt variants. Word count and dialogue % are surface signals only — the real test is reading the prose.
Compare V1 (baseline) to each Vn to isolate the contribution of that constraint.
Scenario A is the original test the original Claude crushed (rich tavern intro with named NPCs and quest hook). Scenario B tests dialogue density. Scenario C tests sustained cinematic build — the moment the original gave 250+ words of layered horror.

## Summary metrics

| Scenario | Variant | Words | Sentences | Avg w/s | Dialogue % | Prompt chars | Time |
|----------|---------|-------|-----------|---------|------------|--------------|------|
| A | V1 | 119 | 6 | 20 | 1% | 25716 | 5.5s |
| A | V2 | 217 | 15 | 14 | 1% | 25609 | 9.5s |
| A | V3 | 152 | 8 | 19 | 0% | 24898 | 6.7s |
| A | V4 | 221 | 11 | 20 | 0% | 19582 | 8.6s |
| A | V5 | 236 | 15 | 16 | 0% | 467 | 9.0s |
| B | V1 | 211 | 21 | 10 | 74% | 25716 | 8.9s |
| B | V2 | 208 | 20 | 10 | 70% | 25609 | 8.8s |
| B | V3 | 213 | 19 | 11 | 70% | 24898 | 9.0s |
| B | V4 | 203 | 22 | 9 | 72% | 19582 | 9.0s |
| B | V5 | 214 | 22 | 10 | 58% | 467 | 8.3s |
| C | V1 | 190 | 20 | 10 | 0% | 25716 | 9.4s |
| C | V2 | 58 | 5 | 12 | 0% | 25609 | 3.5s |
| C | V3 | 147 | 12 | 12 | 0% | 24898 | 6.4s |
| C | V4 | 143 | 13 | 11 | 0% | 19582 | 6.0s |
| C | V5 | 233 | 31 | 8 | 5% | 467 | 10.1s |

## Variants

- **V1 — Baseline (current production prompt)**: Full canonical prompt as it ships today. Sets the floor.
- **V2 — No word-count caps in CONVERSATION HANDLING**: Strips the SPOTLIGHT 30-120 / COUNCIL 120-250 / CROSSTALK 60-150 / WAIT 1-30 word ranges. Tests whether removing the length tax lets prose breathe.
- **V3 — No SELF-CHECK at prompt tail**: Strips "BEFORE YOU SEND — SELF-CHECK" and its 5 revision questions. Tests whether the revise-pressure produces defensive prose.
- **V4 — No MECHANICAL MARKERS section**: Strips the entire mechanical-markers spec (merchant/combat/loot/promise/conditions/etc) and the "every response carries marker overhead" tax. Cardinal Rule 5 still mentions markers exist.
- **V5 — Bare prompt — original-style one-sentence brief**: Replaces the entire ~10K-token system prompt with: "You are an expert Dungeon Master running a D&D 5e text adventure. The player is Riv Freeborn, male human cleric of Lathander, level 1." This mirrors the original PDF's opening — Claude with no structure. Diagnostic: how much of the prompt is helping vs hurting?

---

## Scenario A — Tavern Entry — atmospheric scene-setting

**What it tests:** Tests opening prose density: sensory layering, NPC introduction, ambient detail. The original gave a 3-paragraph tavern interior with named patrons, smell, sound, and a quest hook on a notice board.

**Player input:**

> I push open the heavy wooden door of the village's only tavern and look around inside.

### V1 — Baseline (current production prompt)

*119 words, 6 sentences, 20 avg w/s, 1% dialogue, 5.5s, 25716 prompt chars*

The common room smells of tallow smoke and dried hops. Low ceiling, four tables scarred by years of use, a hearth that hasn't been fed enough wood for the cold night outside. Two men sit apart from each other — one nursing a tankard near the fire, boots still muddy from fieldwork, the other hunched over a table by the far wall with a ledger open in front of him.

Behind the bar, a broad woman with iron-grey hair scraped back from her face works a rag over an already-dry mug. She glances up the moment the door opens, reads you — dusty cloak, holy symbol, road-worn — and sets the mug down.

"Door," she says, nodding at it.

### V2 — No word-count caps in CONVERSATION HANDLING

*217 words, 15 sentences, 14 avg w/s, 1% dialogue, 9.5s, 25609 prompt chars*

The common room is low-ceilinged and close, smoke-darkened beams overhead and a fire burning in the stone hearth on the far wall. It's late afternoon but the place feels like it hasn't seen full light in years — every window is shuttered, the gaps stuffed with rags. Three tallow candles on the bar do the work the sun should be doing.

Four people are scattered across the room. Two men at a corner table, both leaning over their cups like they're having a private argument with their ale. An old woman near the fire, knitting something grey and shapeless, her needles clicking without pause. And behind the bar, a broad man in his forties wiping down the counter with a cloth that may be making things worse — he looks up when the door swings open, and his eyes track Riv with the tired wariness of someone who's been jumpy for a while.

A mounted rack of antlers above the hearth has something new nailed to it: a scrap of parchment, edges curling in the heat. Even from the doorway, the writing on it is large enough to read.

MISSING — FOUR SHEEP AND A MULE. EAST PASTURE. THIRD NIGHT RUNNING. ANY WITH KNOWLEDGE SEE ALDRIC BROWNWELL.

The barman sets down his cloth.

"Stranger," he says. "Door."

### V3 — No SELF-CHECK at prompt tail

*152 words, 8 sentences, 19 avg w/s, 0% dialogue, 6.7s, 24898 prompt chars*

The common room is low-ceilinged and close, smelling of tallow smoke and old straw. A fire burns in a stone hearth on the far wall, doing its best against the damp chill that seems to live permanently in the bones of this place. Four or five locals sit scattered at rough-hewn tables — a pair of farmhands nursing ale by the window, an older woman working at something in her lap near the fire, a heavyset man eating alone at the far end.

Behind the bar, a broad-shouldered woman in her forties wipes down the counter with a rag that has seen better decades. She glances up when the door opens, reads you in a single sweep — road dust, holy symbol, the particular look of someone who's been walking — and gives a short nod.

The farmhands by the window have gone quiet. One nudges the other.

Make a Perception check.

### V4 — No MECHANICAL MARKERS section

*221 words, 11 sentences, 20 avg w/s, 0% dialogue, 8.6s, 19582 prompt chars*

The door swings into warmth and woodsmoke. The taproom is low-ceilinged, the beams dark with years of grease and smoke, and someone has hung dried bundles of sage along the rafters — whether for flavor or to cover some older smell is hard to say.

A fire burns in a wide stone hearth on the far wall. Three tables, two of them occupied. At the nearest, a pair of farmers sit with their heads together over half-empty tankards, speaking too quietly to catch. At the far table, an old woman in a wool shawl nurses something hot from a clay cup, her eyes already on the door — on Riv — with the flat, measuring look of someone who has lived long enough to find strangers interesting rather than threatening.

Behind the bar, a broad man in his forties is wiping down a section of counter he has clearly already wiped. He has a blacksmith's forearms and a barkeep's careful stillness. He glances up when the door opens, takes in Riv's road-worn cloak, the holy symbol, the mace — a full assessment in about a second — and gives a short nod of acknowledgment before going back to the counter.

The fire pops. Outside, the wind moves through the eaves with a sound that is almost, but not quite, a voice.

### V5 — Bare prompt — original-style one-sentence brief

*236 words, 15 sentences, 16 avg w/s, 0% dialogue, 9.0s, 467 prompt chars*

# The Hanging Lantern Tavern

The door groans on iron hinges, and a wave of warm, smoky air washes over you — woodsmoke, tallow candles, and the sharp tang of cheap ale. After the cold bite of the Sword Coast wind, it settles on your skin like a blessing.

The common room is modest. Six rough-hewn tables, most empty. A stone hearth dominates the far wall, its fire burning **too high** for this hour of the evening, as though someone has been feeding it obsessively. Antlers and old farming tools hang on the walls as decoration, though one set of antlers near the window has been draped with **dried sprigs of wolfsbane.**

Your eyes find the room's occupants:

- A **stout woman in an apron**, perhaps fifty, stands behind the plank bar. She's polishing the same pewter mug she's probably been polishing for an hour. Her eyes find yours immediately — sharp, assessing, not unfriendly but not warm.

- In the corner nearest the fire sit **two old men**, hunched over a shared loaf of bread, speaking in whispers too low to hear. One glances at you, then quickly looks away.

- A **young farmer**, no older than eighteen, sits alone at the table closest to the door. His hands are wrapped around a cup he isn't drinking from. His eyes are red-rimmed.

The room goes **one notch quieter** when you enter.

What do you do?

---

## Scenario B — Elder Reveal — NPC voice under pressure

**What it tests:** Tests dialogue density and character voice. The original had Elder Wren explain the lycanthrope situation in 200+ words across multiple beats — physical description, weighted dialogue, "I fear we're dealing with a werewolf, Riv."

**Player input:**

> I sit, slide one mug across to him, and introduce myself. "Yes, Honored Elder, a cleric of Lathander. I understand your village is under siege. As I've just arrived, I would like to know more — about your current troubles and about your village's history. Is this an isolated incident?"

<details><summary>Conversation history (4 turns)</summary>

**USER:**

I push open the heavy wooden door of the village's only tavern and look around inside.

**ASSISTANT:**

The warmth hits you immediately — a crackling fireplace, the smell of roasted meat and ale, and the low murmur of conversation. A few locals sit at tables, speaking in hushed tones. Behind the bar stands a burly woman with her hair tied back, wiping down mugs.

She looks up as you enter. "Welcome, traveler. Name's Gerda. You look like you could use a meal and a bed."

A weathered notice is pinned to a board near the bar — the reward posting about missing livestock and strange occurrences in Darkwood Forest. Fifty gold pieces for solving the problem.

You also spot a nervous-looking farmer alone with his ale, two hunters sharing a table, and an older man in the corner who looks like he might be the village elder.

What do you do?

**USER:**

I greet Gerda warmly, take the room and a meal, and ask her what she knows about the trouble. Then I bring two mugs of mead over to the elder's table.

**ASSISTANT:**

Gerda nods approvingly and tells you what she knows — the trouble started two weeks ago. First old Brennan's chickens vanished, then Tomás lost three sheep, and last night two more. The howling, she says, is wrong-pitched for wolves, and growing bolder. The elder, Wren, posted the reward; the hunters Dagmar and Finn tried tracking whatever it is and came back empty-handed and spooked.

You pick up your stew, your bread, and two mugs of spiced mead, and make your way across the common room to Elder Wren's table.

As you approach, the old man looks up. He's perhaps seventy, with a weathered face, sharp gray eyes, and hands gnarled from decades of work. He's dressed simply but with a silver chain of office around his neck marking his position.

He studies you for a moment, taking in your travel-worn clothes and the holy symbol of Lathander hanging at your chest.

"A cleric, unless my eyes deceive me," he says, his voice gravelly but strong. "And bearing gifts, no less. Please, sit."

</details>

### V1 — Baseline (current production prompt)

*211 words, 21 sentences, 10 avg w/s, 74% dialogue, 8.9s, 25716 prompt chars*

Wren wraps both hands around the mug and leans back in his chair, studying you with those sharp gray eyes.

"Riv." He tests the name. "Lathander's man. Good. We could use a god's attention right now."

He takes a long pull of mead before speaking again.

"Thornhaven's stood at the edge of Darkwood for sixty years. We've had wolves before, bears, even a pack of worgs once — eight years back, you can ask anyone. This is different." He taps the table with one knobbed finger. "The howling started the night of the new moon, two weeks past. Whatever makes that sound, it isn't a wolf. Wolves don't make the dogs hide under floorboards and refuse to come out."

He pauses, jaw tight.

"The livestock vanishes clean. No blood, no tracks worth following — Dagmar's the best hunter in three villages and she found nothing she could read. And three nights ago, young Petra saw something at the tree line. Wouldn't describe it properly. Just kept saying it was tall. Too tall."

He sets the mug down.

"Isolated?" He shakes his head slowly. "Not entirely. There's a hamlet called Millfield, four miles north along the forest road. We sent a boy to trade there six days ago. He hasn't come back."

### V2 — No word-count caps in CONVERSATION HANDLING

*208 words, 20 sentences, 10 avg w/s, 70% dialogue, 8.8s, 25609 prompt chars*

Wren wraps both hands around the mug and takes a slow pull before he answers. The firelight catches the deep lines around his eyes.

"Riv." He tests the name once, then nods. "I'm Wren. Been elder here for twenty-two years, and in those twenty-two years Thornhaven has had wolves, foxes, even a bear once. This is none of those things."

He lowers his voice, leaning forward slightly.

"It started with the howling — wrong hour, wrong sound. Then the livestock. Whatever it is, it doesn't eat what it takes. Brennan found feathers scattered a hundred yards from his coop. No blood, no tracks worth following. Just — gone." He taps the table once. "Dagmar's the best tracker in three villages. She followed a trail into Darkwood two days ago and came back before dark. Wouldn't tell me what she saw. Just said the reward wasn't enough."

He sits back and regards you steadily.

"As for history — there are old stories about that forest. There always are. But nothing living memory. The last time Thornhaven had real trouble was before my father's time."

He takes another drink, watching you over the rim of the mug.

"What brings a cleric of the Morninglord to the edge of Darkwood, Riv?"

### V3 — No SELF-CHECK at prompt tail

*213 words, 19 sentences, 11 avg w/s, 70% dialogue, 9.0s, 24898 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before setting it down.

"Riv." He turns the name over once, like he's weighing it. "I'm Wren. Just Wren — I've been telling people to drop the 'honored' for thirty years and nobody listens." A faint smile, then it fades.

"Isolated." He looks at the fire. "That's the question, isn't it." His thumb traces the rim of the mug. "The livestock started two weeks back. But the howling — the *wrong* howling, as Gerda likely put it — that started a month ago, maybe five weeks. Well before any animal went missing."

He pauses.

"As for history." His gray eyes come back to you. "Thornhaven has sat on the edge of that forest for a hundred and forty years. We've had wolves. We've had a bad winter or two where something came out of the trees looking for food. This is different." He sets the mug down with a quiet thunk. "Dagmar — the hunter, you may have seen her — she tracked the prints to the treeline. Said they started as wolf prints and then just... changed. She wouldn't say into what."

He leans forward slightly.

"You rode in from the south. Did you pass through Millford before coming here?"

### V4 — No MECHANICAL MARKERS section

*203 words, 22 sentences, 9 avg w/s, 72% dialogue, 9.0s, 19582 prompt chars*

Wren wraps both hands around the mug and regards you steadily.

"Riv Freeborn." He tests the name once, then nods. "Sit well with me, that name does."

He takes a slow drink before setting the mug down.

"Isolated? No. That's what troubles me most." His gray eyes drop to the table. "Thirty years I've kept records of this village. Strange seasons come and go. Wolves push out of Darkwood when prey is lean. That's nature — I understand nature."

He taps a gnarled finger on the wood.

"This is something else. The livestock aren't being eaten where they stand. They're taken *whole* — dragged into the wood without a drop of blood left behind. Brennan's field fence was bent *outward*, not broken through. Something carried those animals out."

He pauses, letting that settle.

"As for history —" his voice drops slightly. "There are old stories about Darkwood. Older than this village. My grandfather spoke of a time, perhaps a century past, when the forest went quiet for a full season. No birdsong. No deer at the tree line. Then it passed and folk forgot."

He looks up at you directly.

"Did you come because of the reward posting, Riv, or for another reason?"

### V5 — Bare prompt — original-style one-sentence brief

*214 words, 22 sentences, 10 avg w/s, 58% dialogue, 8.3s, 467 prompt chars*

Wren wraps both hands around the mug and regards you with those sharp eyes for a long moment. He seems to be weighing you — deciding how much to trust a stranger who walked in off the road.

Whatever he sees appears to satisfy him.

"Riv Freeborn," he repeats, tasting the name. "Well met." He takes a slow drink, then sets the mug down carefully.

"Isolated." He lets out a short, humorless breath. "No. Not entirely." He leans forward, lowering his voice. "Thirty years ago, when I was a younger man, something similar happened. Three weeks of missing animals. One missing child — a girl named Sera. She came back, praise the gods, but she was... changed. Wouldn't speak of where she'd been. She passed on years ago now."

He turns the mug slowly in his hands.

"The old-timers called the Darkwood cursed ground. There's a ruined shrine in there — old, older than this village. Nobody knows which god it honored. Some say it was never a place of worship at all." His jaw tightens. "The hunters won't go back in. I can't blame them."

He fixes you with a direct stare.

"Whatever is in that forest, cleric, it isn't wolves. Wolves don't leave tracks that *stop* in the middle of a clearing."

---

## Scenario C — Body Approach — cinematic build with stakes

**What it tests:** Tests slow-build sensory horror. The original gave ~250 words layering 30→20→10 yard approach, smell of blood and fear-sweat, the carved horse in the dead man's hand, "He never had a chance." Exactly the kind of sustained moment the WAIT/SPOTLIGHT word caps would compress.

**Player input:**

> I'm going to circle around and check the body. Doesn't look promising, but worth checking out. Dag, cover me. Voss, take a closer look at the barn if you can. If there's more to know, I want to know it as soon as possible.

<details><summary>Conversation history (4 turns)</summary>

**USER:**

After speaking with the hunters and Elder Wren, I plan to perform a warding ritual at the village center tonight, then approach the lycanthrope tomorrow morning with Dagmar and Finn covering me.

**ASSISTANT:**

The ritual works. Through the night the wards hold; the howling circles the village but never crosses your blessed perimeter. Mother Nelle prays at the center, you hold the line at the north point, and Dagmar's arrows stay nocked but never fly.

Dawn breaks pale and cold. As Lathander's light spills across Thornhaven's rooftops, a runner arrives from the Harrow farm — half a mile beyond the southernmost fields. He says the door is broken and no one answered his call.

**USER:**

I gather Dagmar, Finn, and a town guard named Voss who has come to help. We move out toward the Harrow farm.

**ASSISTANT:**

The four of you set out in tactical formation — Voss taking the left flank, moving tree to tree with military precision; Dagmar on the right, her hunter's instincts guiding her through cover; Finn behind you with arrows nocked. You advance carefully between them, mace at your belt, holy symbol catching the morning light.

The forest thins as you approach Harrow land. Through the trees, you begin to see the farm — one modest farmhouse, a barn, a chicken coop, a goat pen. Simple, well-maintained.

But something is wrong. The goats are scattered and bleating nervously. The front door of the farmhouse is closed but you can see scratch marks on it. One of the barn doors hangs crooked, partially broken. No smoke from the chimney. No movement.

Most concerning: you smell smoke, but not cooking smoke — burning wood, like something was set ablaze recently and has since burned out.

Voss signals a halt about a hundred yards out. He's spotted something. "There. By the barn. See it?"

You follow his gaze and your blood runs cold. A body. Lying face-down in the dirt between the house and barn. Adult male, wearing farmer's clothes. Not moving.

What do you do?

</details>

### V1 — Baseline (current production prompt)

*190 words, 20 sentences, 10 avg w/s, 0% dialogue, 9.4s, 25716 prompt chars*

Dagmar drops into a low crouch behind a fence post, arrow already at her cheek. Voss peels left toward the barn wall without a word, moving in a practiced half-crouch.

Finn stays back at the tree line, eyes sweeping the farmhouse windows.

You cross the open ground in a wide arc, keeping the body between you and the barn. The scratch marks on the farmhouse door are deeper than they looked from a distance — gouged wood, not clawed, more like something large threw itself against it repeatedly.

You reach the body and kneel.

The man is broad-shouldered, somewhere in his forties. A farmer, callused hands, worn boots. There's no obvious wound on his back. You roll him carefully and find his face — expression not frightened, not anguished. Slack. Almost peaceful.

But there's a bite on his forearm. A single bite, deep and clean, already showing the bruised, discolored ring that you recognize.

Wolfsbite.

From the barn, Voss hisses sharply. He's pressed against the broken door, not going in. He holds up one finger, then points inside.

Someone — or something — is in there.

Make a Perception check.

### V2 — No word-count caps in CONVERSATION HANDLING

*58 words, 5 sentences, 12 avg w/s, 0% dialogue, 3.5s, 25609 prompt chars*

Dagmar's already moving before you finish, threading through the fence posts to find a clean sightline. Voss peels left toward the barn without a word, low and quiet for a man in chainmail.

Finn stays at the treeline, arrow half-drawn, watching the house.

You cross the open ground quickly and crouch beside the body.

Make a Medicine check.

### V3 — No SELF-CHECK at prompt tail

*147 words, 12 sentences, 12 avg w/s, 0% dialogue, 6.4s, 24898 prompt chars*

Dagmar moves into position behind a fence post, arrow half-drawn, eyes sweeping the treeline. Finn drops to one knee in the grass, watching the farmhouse windows.

Voss gives a single nod and peels off toward the barn at a low run, pressing his back against the wall when he reaches it. He edges toward the broken door, peers inside, then holds up a closed fist. Wait.

You circle wide around the body, approaching from the south to keep the house in view. Up close, the damage to the farmhouse door is unmistakable — deep gouges in the wood, some at shoulder height, some lower. Not an axe. Something with fingers.

The man is middle-aged, heavyset, wearing a leather work apron. There's blood on the back of his shirt, dried dark. When you crouch beside him and press two fingers to his throat —

Make a Medicine check.

### V4 — No MECHANICAL MARKERS section

*143 words, 13 sentences, 11 avg w/s, 0% dialogue, 6.0s, 19582 prompt chars*

Dagmar slides left without a word, arrow half-drawn, watching the treeline and the barn door simultaneously.

Voss gives a curt nod and breaks right, moving low along the fence line toward the broken barn door.

Finn stays back at the tree line, arrow trained on the farmhouse windows.

You circle wide and approach the body from the south, mace in hand. Up close it's worse than it looked at distance. The man — mid-forties, calloused hands, a farmer's build — has been dead for hours. The ground beneath him is dark and dry. Three deep lacerations cross his back, tearing through both coat and flesh. Too wide for any wolf you've seen. Too deliberate in their spacing.

His right hand is outstretched, fingers curled around a pitchfork handle. He made it this far from the barn and no further.

Make a Medicine check.

### V5 — Bare prompt — original-style one-sentence brief

*233 words, 31 sentences, 8 avg w/s, 5% dialogue, 10.1s, 467 prompt chars*

Dagmar moves smoothly to an elevated position on a low stone wall to your right, arrow drawn and scanning the tree line. "I've got you," she says quietly.

Voss nods once and begins working around the barn's far side, shield up, moving in a low crouch with practiced discipline.

Finn stays back at the tree line, watching the farmhouse windows and roof line. Smart instinct from the boy.

You approach the body. The ground around it is churned — heavy boot prints, animal tracks overlapping. As you get closer you can see the man's right hand is outstretched toward the farmhouse, fingers clawed into the dirt. Like he was trying to crawl toward it.

You kneel. You check for breath, for pulse.

He's alive. Barely. His breathing is shallow and ragged. When you ease him onto his side you find deep lacerations across his back and left shoulder — three parallel gouges, wide-spaced. Claws. But something catches your eye immediately. The wounds are already closing. Slowly, imperfectly, but closing. No man heals like that naturally.

He's been bitten too. Left forearm. The bite is deep.

His eyes flutter open. He looks at you — confused, frightened, in pain. His lips move.

*"My family,"* he whispers. *"Are they—"*

From the barn, Voss calls out. His voice is carefully controlled but the urgency is unmistakable. *"Cleric. You need to see this."*

What do you do?
