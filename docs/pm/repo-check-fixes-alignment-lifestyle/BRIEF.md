# Brief — repo-check-fixes-alignment-lifestyle: the picker says what the book says

## Goal (in play)
A player picking an alignment or a lifestyle reads the book's own words —
one or two sentences, nothing invented. Neutral Evil stops pretending to be
about getting away with things and says what it is; the lifestyles stop
inventing dwellings and meals the book never mentions.

## Background
- Read-only repo check against the 2024 PHB, run 2026-11-24 at Zach's
  direction ("Check it all"). Report:
  `~/workspace/dnd-app-review/repo-checks-2026-11-24-REPORT.md`, §2.
  Book source: Zach's photos of PHB pp. 39–40 and 230–233, transcribed
  verbatim (`~/workspace/dnd-app-review/phb-pp37-39-40-230-233-transcription-2026-11-24.md`).
  The photo-read is authoritative.
- The check compared `client/src/data/storyChoices.js` (3,531 B, as read
  2026-11-24 on the `phase-4-hybrid-combat` branch — **confirm the live
  line numbers on the PC copy before editing; if they have drifted, stop
  and report the drift, do not guess**) against the book. Findings:
  **8 mismatches: 2 alignment + 6 lifestyle.** Costs already match the
  book (Free / 1 sp / 2 sp / 1 gp / 2 gp / 4 gp / 10 gp).
- The file's own header already discloses the state ("summaries of the
  book's meaning, NOT quotations, and not checked line by line against
  a physical copy") — the check confirmed the flag was accurate.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine. This brief is the alignment/lifestyle section.

## What to build

**0. Confirm the live entries first.** Read the live `storyChoices.js`
on the PC copy. Confirm the 8 entries below still carry the repo text
quoted in this brief. If any entry has already changed, report it and do
not build on a stale quote.

**1. Swap in the book's wording for the 8 mismatches below.** Replace
each repo description with the book text quoted — verbatim, including
the example sentences. Do not paraphrase, shorten, or "improve" the
book's sentences. Only the description text changes; keys, costs, and
ordering stay exactly as they are.

### Alignments

**Chaotic Good** — minor (omission)
- Repo now: *"You act as your conscience directs, with little regard
  for what others expect — the rebel who waylays a cruel baron's tax
  collectors."*
- Book: *"Chaotic Good creatures act as their conscience directs with
  little regard for what others expect. A rebel who waylays a cruel
  baron's tax collectors and uses the stolen money to help the poor is
  probably Chaotic Good."*
- The dropped clause is what makes the rebel Good rather than merely
  anti-authoritarian. Restore it.

**Neutral Evil** — clear mismatch
- Repo now: *"You do whatever you can get away with, without compassion
  or qualms."*
- Book: *"Neutral Evil is the alignment of those who are untroubled by
  the harm they cause as they pursue their desires. A criminal who robs
  and murders as they please is probably Neutral Evil."*
- The repo invents opportunism/evasion and drops the book's definition
  and example entirely. Replace the whole description with the book's
  two sentences.

### Lifestyles

**Wretched**
- Repo now: *"You live on the streets or in the wild, sleeping wherever
  you can and scrounging for food, exposed to disease, hunger, and
  violence."*
- Book: *"You survive via chance and charity. You're often exposed to
  natural dangers as a result of sleeping outside."*

**Squalid**
- Repo now: *"A leaky stable, a mud-floored hut, or a vermin-ridden
  flophouse — a roof against the weather, among desperate company."*
- Book: *"You spend the bare minimum for your necessities. You might be
  exposed to unhealthy conditions and opportunistic criminals."*

**Poor**
- Repo now: *"Plain food, a cheap shared room, and threadbare clothes.
  You get by, but comfort and safety are never certain."*
- Book: *"You spend frugally for your necessities."*

**Modest**
- Repo now: *"A clean, simple room and plain, filling meals — the way
  most working people live."*
- Book: *"You support yourself at an average level."*

**Comfortable**
- Repo now: *"A small house or a private room at a good inn, good food,
  and decent clothes — the life of a successful merchant or skilled
  tradesperson."*
- Book: *"You spend modestly for your necessities and enjoy a few
  luxuries."*

**Aristocratic**
- Repo now: *"Estates, the finest food and clothing, retainers, and a
  place in the highest circles of society — with all the politics that
  come with it. (This is the least it costs.)"*
- Book: *"You pay for the best and might have a staff that supports your
  lifestyle. Others notice your wealth and might encourage you to share
  it, either legally or otherwise."*
- The repo drops the book's distinctive second sentence. Restore it;
  the "(This is the least it costs.)" parenthetical goes — it is not
  in the 2024 book.

**2. Update the file's header comment** to record that the alignment
and lifestyle descriptions are now the book's wording as of this job.
Leave the rest of the header note intact — it also covers entries this
job does not touch.

## Out of scope
- **True Neutral stays. No label change of any kind in this brief**
  (Zach's call, 2026-11-24: "True Neutral is fine as the name"). The
  repo key `'True Neutral'` and its parenthetical stay exactly as they
  are. Do not rename the label, the key, or the stored value, and do
  not remove the parenthetical.
- Costs. All seven lifestyle daily costs already match the book — do
  not touch them.
- The other entries (Lawful Good, Neutral Good, Lawful Neutral,
  Neutral, Chaotic Neutral, Lawful Evil, Chaotic Evil, Wealthy,
  Unaligned). Their wording already tracks the book; no changes.
- Unaligned as a picker option stays. The book's Step 4 offers only
  the nine alignments as player choices; Unaligned is a repo addition,
  not a mismatch the check listed, and removing a picker option is a
  separate call.
- The Faith None / Atheist / Agnostic duplication (Zach's call, still
  open). Out of scope — do not touch the Faith entries.
- The other three repo-check fix jobs (tools, feats, spells) —
  separate briefs, separate gates.

## Acceptance criteria
- All 8 descriptions are the book's wording verbatim, as quoted
  above — including the Chaotic Good "uses the stolen money to help
  the poor" clause and the Aristocratic second sentence.
- No other description, key, cost, or ordering in the file changed.
- The `'True Neutral'` key, label, and parenthetical are byte-identical
  to before this job.
- The Faith entries are byte-identical to before this job.
- Full `npm test` green on the builder's run; new/updated suites cover
  the 8 entries against the book text in this brief.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  (`E:\DnD Meta Game\dnd-meta-game`) and iterate until green. Zach's
  full run is the gate — never claim it.
- Re-check: the report lists the live text of each of the 8 entries
  next to the book text in this brief, so the PM can verify without
  opening the repo.

## Decisions already made
- The 2024 book wins on conflict (Zach's rules hierarchy).
- **True Neutral stays as the name, no change** (Zach, 2026-11-24).
  A display-only name change with no mechanical effect is the PM's
  call in future — this one is already decided: no change.
- The Faith duplication stays open for Zach's call — not this job.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data.
- Zach directed 2026-11-24 that all four checked sections be fixed in
  the engine.

## Report
- §3 format from `claude-code-handoff.md`, plus a per-item verdict
  table for all 8 entries (rebuilt / already-correct / still-open with
  evidence), with the live description quoted next to the book text.
- Confirmation that the True Neutral key/label/parenthetical and the
  Faith entries are unchanged.
- Any question for Zach in full plain terms, one per item, with what
  was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief to
  Claude Code and carries the report back to Muse.
- Repo sync CONFIRMED 2026-11-10: the project lives on GitHub; Zach
  keeps the Mac and PC copies in sync. Claude Code builds on the PC
  copy and pushes to GitHub; Zach pulls to the Mac for the gate test.
- This job is one of four sibling briefs from the 2026-11-24 repo
  check (tools, alignment/lifestyle, feats, spells). They touch
  different files; Zach places them in order, one job at a time, one
  serial gate each.
- Place this brief at
  `docs/pm/repo-check-fixes-alignment-lifestyle/BRIEF.md` in the repo
  when handing it over.
