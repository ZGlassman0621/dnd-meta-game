# Brief — S1: campaign gate for play

## Goal (in play)
A character who isn't attached to a campaign cannot start a session:
Play is closed to them, with a plain-words pointer to create or join
a campaign. No session-less play can ever move another character's
clock, lose a session's memory, or hit a dead shop. A character in a
campaign plays exactly as today — same sessions, same chronicle,
same shop, same clock.

## Background
- Audit finding S1 (full-codebase audit, 2026-11-12, commit
  6084b18, PM-verified against live bytes): a character with no
  campaign plays on, but has no session memory, can't shop, and
  moves every other character's clock. Four failure modes, with
  the audit's file-and-line evidence (line numbers are from
  6084b18 — verify each against live bytes before trusting it):
  (a) after creation the client *suggests* making a campaign
  (`client/src/App.jsx:228-238`), but the nav "Play" entry is
  always available (`client/src/components/NavigationMenu.jsx:43`);
  (b) session start only adds world context `if
  (character.campaign_id)` (`server/routes/dmSession.js:802-876`);
  (c) session end refuses to write the chronicle without a campaign
  (`server/services/storyChronicleService.js:64-70`); merchant shop
  returns 404 "No campaign found for this character"
  (`server/routes/dmSession.js:2675-2677`); (d) with no campaign
  the clock is the shared global row, and every advance is copied
  onto *all* characters in the database
  (`server/services/scheduleService.js:70-73`, called at
  :102/:116/:127/:144).
- `CLAUDE.md` lists "characters.campaign_id is not set at creation"
  as known debt. It is still live, and it is S1.
- The return-loop test suite (session end → clock advance → tick →
  persist → summary on return) needs S1 fixed first. This job
  unblocks it; the suite itself is a separate later job.
- Design decision (PM, vetoable at the gate): GATE, don't invent.
  No campaign is auto-created or auto-attached at commit or
  anywhere else — that would invent world state the player didn't
  ask for and fragment the one-world model. Character creation is
  unchanged; the existing New Campaign / attach flow is the path
  to play. The gate is minimal and reversible.

## What to build
1. **Survey the live repo first, then build.** On the PC, branch
   `phase-4-hybrid-combat`, verify every audit evidence point
   above against live bytes before changing anything, and survey
   every session-start path (including Prelude — see item 5) and
   every `scheduleService` advance caller. Report the full list
   found, with file and line, before listing what was changed.
   Workspace mirrors are staging copies, not the repo.
2. **Gate Play in the client.** For a character with no campaign,
   the Play entry is disabled with the reason shown in plain
   words ("Create or join a campaign to play"), never hidden —
   the same visible-but-disabled pattern as the creator gray-outs.
   The pointer leads to the existing New Campaign / attach flow.
   The post-creation suggestion to make a campaign becomes the
   required path: Play unlocks once the character is attached.
3. **Refuse server-side.** Session start refuses a character with
   no campaign_id, with a clear error naming the missing campaign.
   No session row, no world-context assembly, no clock touch, no
   chronicle attempt. Apply the same refusal to any other
   session-scoped entry point the survey finds. The client gate
   alone is not enough — routes are callable directly.
4. **Prove the clock invariant.** No character's play ever moves
   another character's clock. From the caller survey in item 1,
   prove no campaign-less path can advance the shared clock or
   copy dates onto other characters. Close any gap found: refuse
   the path, or scope it per-character if a legitimate path needs
   it — report the mechanism chosen and why. Campaign characters'
   clock behavior is unchanged.
5. **Prelude: exempt only with proof.** If the survey proves a
   Prelude session legitimately starts without a campaign, exempt
   ONLY that path, bounded: no clock advance, no chronicle write,
   no shop access — and report the exemption with its evidence
   and bounds. If Prelude doesn't need it, no exemption exists.
   Never invent a Prelude need the survey doesn't show.
6. **Correct the CLAUDE.md debt line.** Update it to the new
   invariant (campaign required for play; creation still doesn't
   set campaign_id), or remove it if the fix resolves the debt
   entirely — report which.
7. **Tests that assert the fix.** The audit's repro, as tests: a
   character created with no campaign, skipping New Campaign,
   finds Play closed with guidance; a direct session-start call
   is refused; other characters' clocks don't move. Campaign
   characters: sessions start, chronicles write, the shop answers,
   and the clock advances exactly as before. Prelude exemption
   tests if an exemption exists. Full `npm test` green on the
   builder's run.
8. **Prove it at :5173 (never :3000).** The repro steps from item
   7 by hand, plus a campaign character playing a short session
   normally. Exact steps in the report.

## Out of scope
- Auto-creating or auto-attaching campaigns, at commit or anywhere
  else.
- Campaign design, campaign import, Embervale, campaign-plan
  generation, or the 1350 DR planning-prompt year (campaign-design
  job).
- The return-loop test suite (separate job, after this one).
- Shop or chronicle redesign; clock redesign beyond the item-4
  invariant.
- S2, H2+H3, H1, creator round 3, severe-seven, M1, reactions,
  L1–L6, or any other queued job.
- Any migration or backfill. Existing campaign-less characters
  simply hit the gate; no data changes, nothing purged, nothing
  invented.

## Acceptance criteria
- A campaign-less character: Play closed in the client with
  guidance; direct session start refused server-side with a clear
  error; no session, no chronicle attempt, no shop access, no
  clock movement.
- No character's play moves another character's clock —
  test-proved, with the caller survey in the report.
- Campaign characters: play, chronicle, shop, and clock all
  unchanged.
- Prelude: either gated like everything else, or explicitly
  exempted with bounded consequences, reported with evidence.
- The CLAUDE.md debt line is corrected.
- Full `npm test` green on the builder's run; new/updated suites
  cover each item above.

## Verification
- Run the full `npm test` yourself from the repo root on the PC
  and iterate until green. Zach's full run is the gate — never
  claim it.
- At :5173 (never :3000): the repro (campaign-less character
  gated, with guidance) and a campaign character playing
  normally.
- Note the known runner flag: spellbook-routes takes ~158s against
  the runner's 120s per-file cap — a timeout artifact, not a
  failure, if it trips.

## Decisions already made
- Gate, don't invent (PM decision, vetoable at the gate): no
  auto-created campaigns; creation unchanged; no migration or
  backfill.
- The clock invariant (PM decision, vetoable at the gate): no
  character's play ever moves another character's clock.
- Queue placement (PM decision): S1 is the first audit fix; the
  return-loop suite needs it first.
- Fix-as-you-find-it (Zach, 2026-11-06): same defect in a sibling
  gets fixed in this job and reported.
- Do not guess (Zach, 2026-11-07): if information is needed, ask
  before building. Never invent data — a gap is stated as a gap.
- The 2024 book wins on conflict.

## Report
- §3 format from `claude-code-handoff.md`, plus per-item verdicts
  for the eight items above (built / already-present / still-open
  with evidence), the full survey list (file + line for every
  evidence point verified), the complete `scheduleService` caller
  inventory with the disposition of each, and the Prelude finding.
- Any question for Zach in full plain terms, one per item, with
  what was checked and what is still unclear.
- How to verify: gate command + what to look for at :5173 (never
  :3000).

## Setup — CONFIRMED 2026-11-10 (Zach)
- Claude Code is installed on Zach's PC. Zach couriers this brief
  to Claude Code and carries the report back to Muse.
- Staging is PC-only (Zach, 2026-11-12). Gate = Zach's `npm test` +
  :5173 checks on the PC.
- Place this brief at `docs/pm/s1-campaign-at-creation/BRIEF.md`
  in the repo when handing it over. Reports live in
  `docs/pm/reports/`.
