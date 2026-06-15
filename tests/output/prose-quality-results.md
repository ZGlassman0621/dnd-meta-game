# Prose Quality A/B Results

Generated: 2026-06-15T03:02:26.087Z
Model under test: **Sonnet 4.6** (the model that runs continuations in production).
Baseline prompt size: **21798 chars** (~5450 tokens).

## How to read this

Each scenario was run against five prompt variants. Word count and dialogue % are surface signals only — the real test is reading the prose.
Compare V1 (baseline) to each Vn to isolate the contribution of that constraint.
Scenario A is the original test the original Claude crushed (rich tavern intro with named NPCs and quest hook). Scenario B tests dialogue density. Scenario C tests sustained cinematic build — the moment the original gave 250+ words of layered horror.

## Summary metrics

| Scenario | Variant | Words | Sentences | Avg w/s | Dialogue % | Prompt chars | Time |
|----------|---------|-------|-----------|---------|------------|--------------|------|
| A | V1 | 221 | 16 | 14 | 0% | 21798 | 8.7s |
| A | V2 | 168 | 10 | 17 | 1% | 21691 | 7.3s |
| A | V3 | 200 | 15 | 13 | 2% | 21798 | 8.7s |
| A | V4 | 209 | 11 | 19 | 1% | 15478 | 8.2s |
| A | V5 | 230 | 17 | 14 | 0% | 467 | 9.2s |
| B | V1 | 228 | 22 | 10 | 67% | 21798 | 10.1s |
| B | V2 | 204 | 19 | 11 | 78% | 21691 | 9.0s |
| B | V3 | 203 | 17 | 12 | 72% | 21798 | 8.9s |
| B | V4 | 222 | 20 | 11 | 75% | 15478 | 9.3s |
| B | V5 | 223 | 22 | 10 | 65% | 467 | 9.3s |
| C | V1 | 123 | 12 | 10 | 3% | 21798 | 5.9s |
| C | V2 | 208 | 18 | 12 | 7% | 21691 | 10.7s |
| C | V3 | 230 | 22 | 10 | 3% | 21798 | 10.9s |
| C | V4 | 90 | 9 | 10 | 3% | 15478 | 4.5s |
| C | V5 | 218 | 26 | 8 | 4% | 467 | 9.1s |

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

*221 words, 16 sentences, 14 avg w/s, 0% dialogue, 8.7s, 21798 prompt chars*

The common room is low-ceilinged and warm, lit by a fire that's been burning long enough to leave a black tongue of soot up the chimney stone. Four round tables, mismatched chairs, a bar of rough-hewn planks laid across two barrels. The smell is tallow candles, wet wool, and something roasting on the spit — mutton, maybe, or close enough.

Three people are in the room.

A broad woman behind the bar is wiping down the plank surface with a rag that looks like it's losing the battle. Her sleeves are rolled to the elbow, forearms thick from years of work. She glances up at the sound of the door, reads you top to bottom in a single sweep, and goes back to the rag.

At the table nearest the fire, an old man sits alone with a cup cradled in both hands. He's staring into it like he owes it money. He doesn't look up.

The third person — a wiry young man in a leather apron, maybe seventeen — stops sweeping when he sees you. He holds the broom with both hands and watches you the way a dog watches a stranger cross the yard. Not hostile. Uncertain.

The fire pops. Outside, faintly, the wind moves through the tree line.

[SCENE: place=Thornhaven tavern; light=firelit, dim; weather=wind outside; mood=quiet, guarded]

### V2 — No word-count caps in CONVERSATION HANDLING

*168 words, 10 sentences, 17 avg w/s, 1% dialogue, 7.3s, 21691 prompt chars*

The common room is low-ceilinged and smoke-stained, lit by a fire that's doing more work than it should have to on a summer evening. Four round tables, mismatched chairs, a bar hewn from a single split log. The smell is tallow candles, boiled mutton, and something underneath both — a sourness that doesn't belong to the ale.

Three men sit at separate tables, none of them talking to each other. A farmer with his hat still on, staring into his cup. Two younger men near the window, shoulders tight, speaking in low voices that stop when the door opens. Behind the bar, a stout woman with iron-grey hair and a rag over her shoulder looks up from the cup she's wiping — looks at the road dust on Riv's cloak, the holy symbol at his chest, and then back at his face.

"Traveling?" she asks. Not unfriendly, but not warm either. The kind of question that's also a transaction.

[SCENE: place=Thornhaven tavern; light=firelit, dim; weather=summer dusk; mood=uneasy, quiet]

### V3 — No SELF-CHECK at prompt tail

*200 words, 15 sentences, 13 avg w/s, 2% dialogue, 8.7s, 21798 prompt chars*

The Stumped Ox is low-ceilinged and warm, smelling of tallow candles, wet wool, and something roasting over the fire — mutton, maybe, or goat. A handful of tables fill the common room, most of them empty at this hour. A boy sweeps near the hearth without much conviction.

Behind the bar, a broad woman in her forties wipes down the counter with a rag that has seen better years. She glances up at you — takes in the road dust, the holy symbol at your chest, the mace at your hip — and gives a short nod. Not unwelcoming. Just practical.

Two men sit at a corner table nursing their cups. One is old, white-haired, hunched over his drink like he's guarding it. The other is younger, maybe thirty, with a woodsman's calloused hands and a jaw set tight enough to crack walnuts. He's not drinking. He's just staring at the table.

The fire snaps. Outside, the wind picks up and something — probably just a shutter — bangs against the wall of the building.

The woman behind the bar speaks without looking up again.

"Bed, meal, or both?"

[SCENE: place=The Stumped Ox tavern; light=firelit, dim; weather=wind outside; mood=quiet, uneasy]

### V4 — No MECHANICAL MARKERS section

*209 words, 11 sentences, 19 avg w/s, 1% dialogue, 8.2s, 15478 prompt chars*

The Tangle Root is low-ceilinged and smoke-stained, the kind of place that's been absorbing years of tallow and spilled ale for so long the walls have taken on a permanent amber hue. Three trestle tables run the length of the room. A fire burns in the hearth despite the mild evening — someone clearly wanted the comfort of it more than the heat.

The room holds maybe a dozen people. A pair of farmers nursing mugs at the near table go quiet when the door opens, eyes tracking to Riv and then back to their drinks. Two older men in the corner are playing at dice but not really playing — the cup sits untouched between them. A young woman in an apron moves between tables with the mechanical efficiency of someone who stopped finding the work interesting years ago.

Behind the bar, a broad man with a shaved head and forearms like saddlebags is wiping down the counter with a cloth that isn't doing much good. He looks up when Riv enters, and his expression does the small calculation all innkeepers do — traveler, coin, no obvious trouble — before settling into a professional neutrality.

"Door," he says, nodding at it.

He means for it to be closed.

### V5 — Bare prompt — original-style one-sentence brief

*230 words, 17 sentences, 14 avg w/s, 0% dialogue, 9.2s, 467 prompt chars*

# The Withered Vine

---

The door groans on leather hinges, releasing a puff of wood-smoke and tallow-candle smell into the cold evening air behind you. You step inside.

The common room is **smaller than you'd expect** — eight or nine rough-hewn tables, maybe half of them occupied. A fire burns in a stone hearth large enough to roast an ox, but nobody sits near the windows. The shutters are latched tight despite the early hour, and you notice the **lack of laughter**. Conversation runs low and close, elbows on tables, eyes toward doors.

A mounted **boar's head** watches you from above the bar with glass eyes. Beneath it, a stout woman with iron-grey hair and a stained apron works a rag over a pewter mug without looking up.

Three **farmers** at the nearest table have stopped talking the moment you walked in. They take in your holy symbol — Lathander's rising sun — and exchange a glance you can't quite read. One is missing two fingers on his left hand. Another has dark circles deep enough to look like bruises.

In the **far corner**, half-hidden by shadow and pipe-smoke, sits a lone figure in a hooded travelling cloak. A short sword hangs at their hip. They haven't looked up.

A **boy of perhaps twelve** sweeps near the hearth, watching you openly with wide, frightened eyes.

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

*228 words, 22 sentences, 10 avg w/s, 67% dialogue, 10.1s, 21798 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before answering.

"Riv." He tests the name once, then nods. "I'm Wren. Just Wren — 'Honored Elder' makes me feel like a corpse at his own funeral."

He sets the mug down and his expression settles into something heavier.

"Isolated? No. Twenty years ago there were strange nights in Darkwood — lights, missing animals, one shepherd who wandered in and came out three days later unable to speak of what he'd seen. Lasted a month, then stopped. Before that, my grandmother spoke of worse. The forest has always had a dark pulse to it."

He glances toward the window, where the treeline is just visible in the last gray light of evening.

"But this feels different. The animals aren't just missing — what's left of them sometimes turns up torn in ways that don't make sense. Not feeding. Something else." He pauses. "And four nights ago, young Petra — she's nine — wandered to the tree line chasing her cat. She came back. But she hasn't spoken since. Sits and stares."

His jaw tightens.

"The hunters found tracks. Not wolf. Not bear. Something that walks on two legs but doesn't move like a man."

He looks at you directly. "What brings a servant of the Morninglord to Thornhaven?"

[SCENE: place=Thornhaven tavern; light=firelit; weather=still night; mood=tense, close]

### V2 — No word-count caps in CONVERSATION HANDLING

*204 words, 19 sentences, 11 avg w/s, 78% dialogue, 9.0s, 21691 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before answering.

"Riv." He tastes the name like he's deciding whether to trust it. "I'm Wren Aldas. And no — not entirely isolated, though none the less strange for it."

He sets the mug down.

"Darkwood has always been dangerous. Wolves, boar, the occasional lost traveler who wanders in too deep. That's the nature of the forest — we've lived beside it forty years and made our peace with it. What's happening now is different." His jaw tightens. "The livestock vanishes without a trace. No blood, no tracks worth following, no carcass left behind. Dagmar — she's my best hunter — found one trail that simply stopped in the middle of a clearing. Ground was soft. Nothing. As if whatever took the animals walked clean out of the world."

He leans forward slightly.

"Three weeks ago, a shepherd boy named Petr claimed he saw a light deep in the trees. Blue-white, he said, moving between the trunks. The boy's not given to fancy." Wren pauses. "And the howling started that same night."

He glances toward the fire.

"Villages east of here, Millhook and Crestfen, have had quiet years. This is ours alone."

### V3 — No SELF-CHECK at prompt tail

*203 words, 17 sentences, 12 avg w/s, 72% dialogue, 8.9s, 21798 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before answering.

"Thornhaven has stood at the edge of Darkwood for sixty years," he says. "We've had wolves before. Lost sheep before. But not like this." He sets the mug down. "No tracks worth following. No carcasses left behind. Animals simply — gone. And the sounds at night..." He shakes his head. "Dagmar's hunted these woods for twenty years. She came back from the forest two days ago and hasn't spoken much since."

He leans forward slightly.

"As for history — the forest itself has an older reputation. There are ruins deep in the wood, a stone structure, old enough that my grandfather's grandfather didn't know who built it. The old folk used to say something slept there. Most of us considered it superstition." A pause. "We're reconsidering."

He looks at you directly now, the sharp gray eyes weighing something.

"You've come alone, and you're young for a man bearing Lathander's symbol. What brings a cleric of the Morninglord to the edge of Darkwood — and more importantly, Riv — are you here to help, or are you here for the fifty gold?"

[SCENE: place=Thornhaven tavern; light=firelit; weather=still night; mood=uneasy, close]

### V4 — No MECHANICAL MARKERS section

*222 words, 20 sentences, 11 avg w/s, 75% dialogue, 9.3s, 15478 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before answering. He seems to weigh you the same way a man weighs a tool — not unkindly, but practically.

"Riv." He tests the name once. "I've been elder of Thornhaven for twenty-two years. In that time we've had wolves, we've had a bad harvest, we've had a fever that took four children one winter." He pauses. "This is different."

He sets the mug down.

"The livestock disappearances started a fortnight ago — no tracks worth following, no blood, no signs of struggle. Just gone. Then the howling began. Three nights running now, always from deep in Darkwood. My hunters Dagmar and Finn went in yesterday morning. They came back before midday. Finn won't say what he saw. Dagmar says it was nothing — but she looked like a woman who'd seen something she hadn't found words for yet."

He leans forward slightly.

"As for history — Darkwood has always had a dark reputation. There are old stories, older than my grandfather's grandfather. Something was bound there once, the stories say. Bound or buried or driven deep." He shakes his head. "I've never put much stock in old stories. Until now."

His gray eyes settle on yours. "What brings a servant of the Morninglord to a village like Thornhaven, Riv?"

### V5 — Bare prompt — original-style one-sentence brief

*223 words, 22 sentences, 10 avg w/s, 65% dialogue, 9.3s, 467 prompt chars*

Wren wraps both hands around the mug and regards you with the careful look of a man who has learned not to trust too quickly but is running out of options.

"Riv Freeborn," he repeats, tasting the name. "Well met." He takes a long pull of the mead before setting it down and leaning forward.

"Isolated?" He exhales slowly. "Yes and no. Thornhaven has stood thirty years without serious trouble. We're a farming village, nothing more. No great wealth, no ancient curses — or so I believed."

He pauses, turning the mug in his hands.

"What troubles me most is *where* it started. The missing animals are all from farms bordering the Darkwood's eastern edge. Whatever is doing this isn't wandering randomly. It's moving along that tree line with purpose."

He lowers his voice further.

"And three nights ago, young Marta — the miller's daughter, twelve years old — claims she saw something at the forest edge at dusk. Tall. Walking upright. She won't describe it further. Won't speak of it at all now."

He fixes you with those sharp gray eyes.

"I've lived near that forest my whole life. Animals go strange near it sometimes. But this is different. This feels..." He searches for the word. "...deliberate."

He studies your holy symbol. "What brings a servant of the Morninglord to Thornhaven, specifically?"

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

*123 words, 12 sentences, 10 avg w/s, 3% dialogue, 5.9s, 21798 prompt chars*

Dagmar steps wide, arrow drawn, eyes quartering the tree line. Voss peels left toward the barn without a word, moving low along the fence line.

Finn stays put at the field's edge. "I'll watch the house," he says quietly.

You cross the open ground toward the body. The scratch marks on the farmhouse door are deep — not fingernails. Claws. Four parallel gouges through solid oak like it was softwood.

The man is face-down, arms splayed, one boot missing. You reach him and crouch.

Make a Medicine check as you examine him. The morning light is good and the ground around him tells its own story — but you'll need to read it carefully.

[SCENE: place=Harrow Farm; light=pale dawn; weather=cold, still; mood=grim, tense]

### V2 — No word-count caps in CONVERSATION HANDLING

*208 words, 18 sentences, 12 avg w/s, 7% dialogue, 10.7s, 21691 prompt chars*

Dagmar drops to one knee behind a fence post, arrow half-drawn, eyes sweeping the treeline. Voss peels off toward the barn at a low crouch, pressing his back along the outer wall as he sidles toward the broken door.

Finn stays put at the tree line. "I've got the house," he says quietly, watching the windows.

You move in a wide arc, keeping low, crossing the open ground between the fence and the body. The goats scatter away from you, bleating. Nothing else moves.

You reach him. A man, broad-shouldered, maybe fifty years old. Grey-streaked hair, rough hands — a farmer's hands. There's blood soaked into the dirt around him, mostly from deep lacerations across his back and shoulders. Claw marks. Three parallel lines, each deep enough to be serious.

You press two fingers to his throat.

Make a Medicine check as you do — the morning light catches something odd about the wound edges, a detail that might matter. [ROLL_REQUEST: Kind=check Ability=wis DC=12 Label="Medicine — assess the wounds"]

Across the yard, Voss reaches the barn door and angles his head to peer inside. His body language changes immediately — shoulders rigid, hand dropping to his sword hilt.

"Cleric," he calls, voice deliberately flat. "You should see this."

### V3 — No SELF-CHECK at prompt tail

*230 words, 22 sentences, 10 avg w/s, 3% dialogue, 10.9s, 21798 prompt chars*

Dagmar nods once and drops to a knee, arrow drawn and tracking across the yard. Finn takes position at the tree line, watching the farmhouse windows. Voss peels right, moving in a low crouch toward the barn's broken door.

You cross the open ground quickly, mace drawn.

The man is Harrow himself — you recognize the face from the village. Mid-forties, broad-shouldered. Three deep lacerations across his back, through the shirt. The wounds are clotted and dark. He's been dead several hours, since well before dawn.

Your hand finds his neck anyway. Nothing.

From the barn, Voss calls out in a low, controlled voice. "Cleric. You need to see this."

The barn's interior is dim, one shaft of morning light cutting through the broken door. A lantern lies on its side in the dirt — the source of the scorch smell, a small fire now cold. A milk cow stands trembling in her stall, eyes wide and rolling. There are claw marks up the interior wall, deep enough to gouge the timber.

And in the far corner, huddled in the hay behind a feed barrel: two children. A girl, perhaps ten, and a boy a few years younger. Both alive. Both staring at you with hollow, exhausted eyes.

The girl speaks first, her voice barely above a whisper. "Is it gone?"

[SCENE: place=Harrow Farm; light=early morning; weather=cold, still; mood=grim, fragile]

### V4 — No MECHANICAL MARKERS section

*90 words, 9 sentences, 10 avg w/s, 3% dialogue, 4.5s, 15478 prompt chars*

Dagmar steps into a wide stance behind you, arrow half-drawn. "Aye. Moving."

Voss peels away toward the barn, quiet for his size.

You cross the open ground with your hand on your mace. The grass is wet and torn — heavy prints cutting through it, too large for any natural animal. Closer now, you can see blood matting the back of the man's shirt. His hand is stretched out in front of him as though he was crawling when he stopped.

You reach him and kneel.

Make a Medicine check.

### V5 — Bare prompt — original-style one-sentence brief

*218 words, 26 sentences, 8 avg w/s, 4% dialogue, 9.1s, 467 prompt chars*

Dagmar moves without a word, finding a low stone wall and dropping behind it — a perfect archer's position covering your approach. Her eyes are already scanning the treeline. Voss nods and peels off toward the barn, moving low, hand on his sword hilt.

Finn stays back at the tree line. "I'll watch the house," he murmurs.

You approach the body carefully, eyes moving — ground, treeline, rooftops, back to ground. The morning quiet feels wrong. The goats have stopped bleating. That silence feels worse than the noise did.

You reach the man and crouch beside him. Middle-aged. Heavyset. Work-callused hands. This is almost certainly Old Harrow himself based on Elder Wren's description. You check for breathing, press two fingers to his neck.

A pulse. Faint and thready, but there.

He has deep lacerations across his back — three parallel gouges running from his left shoulder blade toward his hip. Claw marks. The wounds are hours old, partially dried. He has lost significant blood. His breathing is shallow but present.

Then from the barn — a sharp crash, the sound of something heavy falling, and Voss's voice cutting across the yard in a tight, controlled shout.

"Contact! Something's in the barn!"

Dagmar is already on her feet, arrow drawn, repositioning toward the barn door.

What do you do?
