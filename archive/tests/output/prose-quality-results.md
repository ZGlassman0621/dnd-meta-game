# Prose Quality A/B Results

Generated: 2026-04-27T07:03:19.834Z
Model under test: **Sonnet 4.6** (the model that runs continuations in production).
Baseline prompt size: **25107 chars** (~6277 tokens).

## How to read this

Each scenario was run against five prompt variants. Word count and dialogue % are surface signals only — the real test is reading the prose.
Compare V1 (baseline) to each Vn to isolate the contribution of that constraint.
Scenario A is the original test the original Claude crushed (rich tavern intro with named NPCs and quest hook). Scenario B tests dialogue density. Scenario C tests sustained cinematic build — the moment the original gave 250+ words of layered horror.

## Summary metrics

| Scenario | Variant | Words | Sentences | Avg w/s | Dialogue % | Prompt chars | Time |
|----------|---------|-------|-----------|---------|------------|--------------|------|
| A | V1 | 195 | 11 | 18 | 3% | 25107 | 8.7s |
| A | V2 | 217 | 14 | 16 | 0% | 25000 | 8.4s |
| A | V3 | 168 | 9 | 19 | 3% | 24289 | 7.6s |
| A | V4 | 211 | 14 | 15 | 4% | 19797 | 8.2s |
| A | V5 | 225 | 14 | 16 | 2% | 467 | 9.1s |
| B | V1 | 225 | 23 | 10 | 71% | 25107 | 9.8s |
| B | V2 | 229 | 26 | 9 | 67% | 25000 | 11.0s |
| B | V3 | 233 | 25 | 9 | 80% | 24289 | 9.4s |
| B | V4 | 216 | 24 | 9 | 72% | 19797 | 9.6s |
| B | V5 | 217 | 23 | 9 | 69% | 467 | 8.5s |
| C | V1 | 96 | 8 | 12 | 0% | 25107 | 4.4s |
| C | V2 | 186 | 19 | 10 | 11% | 25000 | 7.9s |
| C | V3 | 210 | 20 | 11 | 4% | 24289 | 10.8s |
| C | V4 | 121 | 15 | 8 | 3% | 19797 | 5.7s |
| C | V5 | 236 | 23 | 10 | 6% | 467 | 9.6s |

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

*195 words, 11 sentences, 18 avg w/s, 3% dialogue, 8.7s, 25107 prompt chars*

The common room is low and close, the ceiling cross-beamed with dark timber that holds the smoke near the rafters. Three tallow candles on the bar, one on each of the two occupied tables. The fire in the stone hearth has burned down to orange coals — enough to push the chill back but not enough to make anyone comfortable.

A man behind the bar is wiping the same spot on the wood over and over without noticing. He's broad across the shoulders, gone soft at the middle, with a nose that's been broken at least twice. He glances up when the door swings open.

At the nearer table, two farmers sit with their ale untouched, speaking in the low, careful voices of men who don't want to be overheard. One of them keeps turning his cup in slow circles.

At the far table, an old woman sits alone, a clay pipe dead in her hand, staring at the coals.

The barman sets down his rag.

"Passing through, or staying?" His voice is flat, not unfriendly — the voice of a man who asks the same question every night and stopped caring about the answer.

### V2 — No word-count caps in CONVERSATION HANDLING

*217 words, 14 sentences, 16 avg w/s, 0% dialogue, 8.4s, 25000 prompt chars*

The door groans on its hinges and lets in a blade of late-afternoon light before swinging shut behind you.

The common room is low-ceilinged and close, crossbeams dark with years of hearth smoke. Four tables, only two of them occupied. At the nearest, a pair of farmhands sit shoulder-to-shoulder over their ales, speaking in the particular murmur of men who've stopped expecting to be overheard. One of them glances up at you, then back down. The other doesn't bother.

At the far table, an older woman in a grey wool shawl nurses something hot from a clay cup. Her eyes find you the moment you cross the threshold and don't let go — not hostile, just watchful, the way people in small villages look at faces they don't recognize.

The bar itself is a slab of dark wood running along the left wall. Behind it, a broad-shouldered man with a close-cropped grey beard is stacking cups with the methodical patience of someone who's been doing the same thing for thirty years. A boar's head is mounted above the shelves behind him, slightly crooked, one glass eye catching the firelight.

The hearth on the far wall is burning well despite the season. Someone wants it warm in here.

The barkeep sets down his stack and looks your way.

### V3 — No SELF-CHECK at prompt tail

*168 words, 9 sentences, 19 avg w/s, 3% dialogue, 7.6s, 24289 prompt chars*

The common room is low-ceilinged and smoke-darkened, a fire burning too hot for the season in a stone hearth that takes up half the far wall. Someone has hung dried herbs from the rafters — lavender, maybe, or something trying to be lavender — but they've done nothing against the smell of tallow candles and old ale.

Four or five villagers sit scattered across mismatched tables. None of them look up when the door opens. That in itself is a thing worth noting — strangers don't come through Thornhaven often enough to ignore.

A woman behind the bar is wiping a tankard with a rag that won't make it any cleaner. She's broad-shouldered, somewhere past fifty, with grey-streaked hair pinned back hard and the look of someone who has heard every kind of trouble walk through that door and stopped being surprised by any of it.

She glances at Riv. Her eyes drop briefly to the holy symbol at his chest, then back up.

"Traveling through, or staying?"

### V4 — No MECHANICAL MARKERS section

*211 words, 14 sentences, 15 avg w/s, 4% dialogue, 8.2s, 19797 prompt chars*

The Common Hearth smells of tallow smoke, wet wool, and something roasting low and slow over the kitchen fire. It's a squat, low-beamed room — four tables, a bar of rough-hewn oak, shelves behind it holding mismatched clay mugs and a few dark bottles. A pair of oil lamps hang from the rafters, their light amber and unsteady.

Three people inside, besides yourself.

A woman behind the bar, somewhere past fifty, wiping down the counter with a rag that's doing more harm than good. Her grey hair is pinned back with what appears to be a whittled stick. She glances up when the door opens — sharp eyes, measuring.

At the table nearest the fire, a heavyset man in a farmer's coat sits hunched over a bowl of something, eating without apparent pleasure. Mud on his boots. A long scratch across the back of his left hand, red and recent.

In the far corner, away from the lamplight, a younger man — maybe twenty, maybe less — nurses a cup and stares at the tabletop like it owes him money. He doesn't look up when you enter.

The woman behind the bar is the first to speak.

"Traveler." She sets down the rag. "You eating, or just out of the cold?"

### V5 — Bare prompt — original-style one-sentence brief

*225 words, 14 sentences, 16 avg w/s, 2% dialogue, 9.1s, 467 prompt chars*

# The Thorn & Thistle Tavern

The door groans on iron hinges, releasing a breath of woodsmoke and stale ale into the cold evening air behind you. You step inside.

The common room is **smaller than you expected** — a dozen rough-hewn tables, most empty. A fire crackles in a stone hearth wide enough to roast an ox, but tonight it holds only a modest blaze, as though even the flames are conserving their courage. Tallow candles gutter in iron sconces along the walls.

**Three patrons** occupy the room:

- An **old man** in a shepherd's smock sits alone near the fire, turning an empty cup in his weathered hands, staring at nothing. His eyes are red-rimmed.
- Two **farmers** huddle close at a corner table, speaking in low, urgent voices. They glance up sharply when you enter, then look away just as quickly.

Behind the bar, a **stout dwarven woman** with iron-grey braids and a no-nonsense expression wipes down the counter with a rag that looks dirtier than the wood itself. She eyes your holy symbol — the rose-and-sun of Lathander — with an expression somewhere between relief and wariness.

*"We're open,"* she says flatly. *"Barely."*

The howling from the forest this morning hasn't quite left the walls of this place. You can feel it in the silence between conversations.

**What do you do?**

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

*225 words, 23 sentences, 10 avg w/s, 71% dialogue, 9.8s, 25107 prompt chars*

Wren wraps both hands around the mug and takes a long pull before setting it down.

"Riv." He tests the name once, as if filing it away. "I'm Wren. No 'honored' necessary — I'm just an old man who's been here long enough that people started listening to me."

He leans back, studying the fire for a moment.

"Isolated? No. And yes." He taps a finger on the table. "Thornhaven's sat on the edge of Darkwood for sixty years. We've always had wolves, boars, the occasional worse thing drifting out from the deep wood. That's just the cost of the land here. But this—" He shakes his head. "Two weeks of it now, and it escalates. First small animals near the treeline. Then sheep from the middle pasture — not the edge, mind you, the *middle*. Whatever it is, it's growing bolder."

He glances toward the hunters' table, then back to you, dropping his voice slightly.

"Dagmar and Finn are good trackers. They followed the trail three days ago and lost it at Millbrook — the creek that runs along the forest's edge. Like whatever made those tracks just... stopped existing at the waterline."

He takes another sip.

"The howling started before the livestock went missing. That's what troubles me most. It was never hungry-sounding. It was more like—" He searches for the word. "Deliberate."

### V2 — No word-count caps in CONVERSATION HANDLING

*229 words, 26 sentences, 9 avg w/s, 67% dialogue, 11.0s, 25000 prompt chars*

Wren wraps both hands around the mug and takes a long sip before setting it down. He looks at you steadily.

"Riv." He repeats the name as though weighing it. "Well met. I'm Wren — Aldor Wren, if we're being formal, though nobody bothers."

He leans back in his chair, the firelight deepening the lines on his face.

"Isolated? No. And yes." He pauses, choosing his words. "Thornhaven has stood at this edge of the Darkwood for sixty years. We've had wolves before. We've had worse than wolves before. But this — " he shakes his head slowly — "this is different in character."

He holds up one finger. "It started with the howling. Not the sound of a hunting pack. Something slower. More deliberate, almost." A second finger. "Then the livestock. No blood left behind. No tracks that mean anything to Dagmar, and that man can read forest ground like scripture." A third finger. "And three nights ago, young Petra — she's eleven — says she saw something at the treeline. Tall. Standing upright. She won't say more than that, and the girl isn't prone to invention."

He takes another drink, quieter now.

"There's an old shrine to Mielikki half a mile into the Darkwood. Tended it myself for years. I haven't been able to go since this started." He glances toward the door. "The forest feels closed."

### V3 — No SELF-CHECK at prompt tail

*233 words, 25 sentences, 9 avg w/s, 80% dialogue, 9.4s, 24289 prompt chars*

Wren wraps both hands around the mug and takes a slow sip before answering. He sets it down and looks at you steadily.

"Riv. Good name for a traveler." He pauses, collecting his thoughts.

"Isolated? No, I wouldn't call it that. Thirty years I've been elder here, and Darkwood has always had its teeth. But this is different. The howling started the night of the last new moon — three weeks back now. Not wolves. I know wolves. This is something else. Something that doesn't care about torches or dogs or a man standing his ground."

He turns the mug slowly in his hands.

"The livestock started going the next morning. Clean disappearances — no blood, no drag marks, no tracks worth following. Dagmar and Finn are the best hunters in Thornhaven, and they came back from the wood looking like men who'd seen a grave dug for them personally. Won't say much about what they saw."

His gray eyes settle on yours.

"As for history — " he hesitates. "There's an old shrine deeper in the wood. To what, I couldn't tell you. Older than Thornhaven. Older than most things. The elders before me said to leave it alone, and we have. But two weeks ago, young Tomás swore he saw lights out that direction. Blue-white lights, drifting between the trees."

He leans back.

"Is that the kind of history you mean?"

### V4 — No MECHANICAL MARKERS section

*216 words, 24 sentences, 9 avg w/s, 72% dialogue, 9.6s, 19797 prompt chars*

Wren wraps both hands around the mug and leans back slowly.

"Riv." He tests the name once, then nods. "I'm Wren. Been elder here thirty-one years, and no — in thirty-one years, nothing like this." He takes a long pull of mead before continuing.

"Thornhaven sits on the edge of that forest. Always has. We've had wolves before, the odd bear, a boar that killed a man's dog once. That's the cost of living where we live." His gray eyes drift toward the window, toward the dark tree line just visible through the glass. "This is different. The howling started the night after Jorin's boy came back from the forest with a fever and a bite on his arm he couldn't explain. Three days later — livestock gone. Then more. Every few nights now."

He turns back to you.

"Jorin's boy is Cael. Fourteen years old. The fever broke after a week but the boy's not right since. Jumpy. Pale. Stops speaking mid-sentence sometimes and just... listens. To nothing anyone else can hear."

Wren sets down the mug.

"The forest has always had its dangers but it kept to itself. Something changed. Something moved in, or something woke up." He fixes you with those sharp eyes. "What brings a Dawnbringer to a village like ours, Riv?"

### V5 — Bare prompt — original-style one-sentence brief

*217 words, 23 sentences, 9 avg w/s, 69% dialogue, 8.5s, 467 prompt chars*

Wren wraps both hands around the mug and regards you with the careful assessment of a man who has learned to weigh strangers slowly.

"Riv Freeborn." He repeats your name as though testing its weight. "Well met. And my thanks for the mead."

He takes a long pull and sets the mug down carefully.

"Isolated?" He shakes his head. "That's the troubling part. Twenty years I've lived in Thornhaven. Before that, my father's father helped found it. The Darkwood has always been... uneasy. Strange lights on moonless nights. Travelers who took the forest path sometimes arrived late, or not at all. We learned to leave it alone and it left us alone."

He pauses, staring into his mug.

"That arrangement held until a fortnight ago. Around the same time the howling started, young Petyr — a woodcutter's boy, twelve years old — said he saw lights moving deep in the trees. Then the livestock began disappearing." His jaw tightens. "No blood. No tracks worth following. Just... gone."

He fixes you with those sharp gray eyes.

"Three nights ago, my neighbor's dog wouldn't stop barking toward the treeline. Come morning, the dog was gone too. Whatever is in that forest, Cleric, it is getting closer."

He leans forward slightly.

"What brings a servant of the Morninglord to Thornhaven?"

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

*96 words, 8 sentences, 12 avg w/s, 0% dialogue, 4.4s, 25107 prompt chars*

Dagmar peels right without a word, finding a rise behind a fence post with clear sightlines to the body and the barn door both. Voss gives a short nod and angles wide toward the barn, keeping the wall between himself and whatever might be inside.

Finn stays low in the treeline, arrows ready.

You cross the open ground quickly, crouching as you reach the body. Male, mid-forties, big-boned farmer's build. You roll him carefully onto his back.

Make a Medicine check as you work. The wounds tell a story — you just need to read it.

### V2 — No word-count caps in CONVERSATION HANDLING

*186 words, 19 sentences, 10 avg w/s, 11% dialogue, 7.9s, 25000 prompt chars*

Dagmar moves without a word, angling wide to find elevation — she climbs the fence rail of the goat pen and gets her bow up, scanning the treeline. Voss peels off toward the barn in a low crouch, staying close to the fence line.

Finn stays at your back as you advance toward the body.

The closer you get, the worse it looks. The man — broad-shouldered, maybe fifty, with calloused hands and a leather work apron — is face down in the dirt. His back is torn open. Deep lacerations, the kind no animal you've ever treated makes cleanly. Something with considerable strength did this, and recently. The ground around him is dark and saturated.

You kneel. Make a Medicine check as you examine him — the wounds tell a story if you can read it.

From the barn, Voss calls out, low and tight: "Barn's empty. Livestock gone or dead. There's blood in here too — older than out there. And tracks." A pause. "Big ones."

The farmhouse door is fifteen feet away. Still closed. Still no movement inside. The goats have gone quiet.

### V3 — No SELF-CHECK at prompt tail

*210 words, 20 sentences, 11 avg w/s, 4% dialogue, 10.8s, 24289 prompt chars*

Dagmar peels off wordlessly, finding a low stone wall that gives her sightlines across the whole yard. Her bow comes up — not drawn, but ready. Finn holds position at the tree line, eyes moving between the barn roof and the treeline opposite.

Voss nods once and begins his own arc toward the barn, low and careful, hand resting on his sword hilt.

You move.

The yard is quiet in a way that feels deliberate. The goats track you with wide nervous eyes but don't scatter. Chickens have retreated into their coop and won't come out. Even the wind seems to have stilled.

The body resolves as you close the distance. Male, mid-forties, heavy-set, working clothes. One arm is stretched out toward the farmhouse door as though he was crawling when he stopped. His back is badly torn — three deep lacerations across the shoulders, through the fabric, the kind a large animal makes.

But he's breathing. Barely. A shallow, wet rasp that you hear as you kneel beside him.

From the barn, Voss calls out in a hushed, controlled voice — the tone of a man keeping himself calm. "There's a woman in here. Alive. Hiding in the hay."

Make a Medicine check as you assess the farmer's wounds.

### V4 — No MECHANICAL MARKERS section

*121 words, 15 sentences, 8 avg w/s, 3% dialogue, 5.7s, 19797 prompt chars*

Dagmar drops to one knee behind a fence post, arrow half-drawn, eyes sweeping the treeline. Voss peels left without a word, moving in a low crouch toward the barn's shadowed wall.

Finn stays at the tree line. "I've got the house," he mutters, fixing his gaze on the upper window.

You move out across open ground toward the body. Thirty feet. Twenty. Ten.

The man is face-down in the dirt, one arm stretched out ahead of him as though he was crawling when he fell. His back is shredded — three deep gouges through his shirt, dried brown with old blood. Not fresh. Hours old, at least. The wounds are wide-spaced. Large.

Make a Medicine check as you crouch over him.

### V5 — Bare prompt — original-style one-sentence brief

*236 words, 23 sentences, 10 avg w/s, 6% dialogue, 9.6s, 467 prompt chars*

Dagmar nods once and moves to a low stone wall, setting an arrow to her bowstring and scanning the treeline. "I've got you," she says quietly.

Voss peels off toward the barn at a low crouch, hand on his sword hilt. Finn stays back at the wood's edge, watching the farmhouse windows.

You move in a wide arc, keeping low, approaching the body from the south so Dagmar maintains a clear line of sight over you. The goats scatter at your approach, bleating and stumbling over one another. The smell hits you first — blood, and something animal and musky beneath it. Familiar in the way a hunter learns a predator's scent.

You reach the body and kneel. It's a man in his fifties, powerfully built even in death. Harrow himself, by the description Elder Wren gave you. He's been dead several hours at least — the chill is in him. The wounds on his back and shoulders are deep. Claw marks, four parallel lines, spaced wide. Whatever made them was large.

But something else catches your eye. His right hand is closed in a fist. And clutched in that fist, barely visible between his fingers, is a scrap of cloth — deliberately placed, or desperately grabbed. Dark wool, coarsely woven.

From the barn, Voss calls in a low urgent voice. "Cleric. You need to see this. And bring your holy symbol."

What do you do?
