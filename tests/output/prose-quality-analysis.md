# Prose Quality Diagnostic — Findings

**Date:** 2026-04-25
**Baseline:** Original "Order of Dawn's Light" campaign (Opus 4.5, Dec 6 2025)
**Test target:** Current production prompt running on Sonnet 4.6
**Method:** 3 fixed scenarios × 5 prompt variants, 15 API calls. Raw outputs in `prose-quality-results.md`.

## Summary of all 6 original hypotheses

| # | Hypothesis | Verdict | Evidence |
|---|-----------|---------|----------|
| 1 | Sonnet vs Opus is the biggest factor | **UNTESTED — needs user playtest** | Opus toggle restored; user can A/B in real session |
| 2 | Word-count caps in CONVERSATION HANDLING are squeezing prose | **DOWNGRADED — caps barely bind** | V2 produced near-identical output to V1 (Δ ≤6% in all 3 scenarios). Sonnet sat naturally at 170–225 words, well inside COUNCIL's 120–250 range. The caps aren't the constraint we thought they were. |
| 3 | Self-Check at the prompt tail produces defensive prose | **PARTIAL — helps Scenario A only** | V3 lifted tavern entry from 172→218 words and added bartender dialogue. Negligible/mixed effect on B and C. The self-check probably hurts atmospheric scene-opens but not dialogue or action scenes. |
| 4 | Marker overhead taxes every response | **UPGRADED — strongest single-lever finding** | V4 (no MECHANICAL MARKERS section, ~6.1K chars / 25% of prompt removed) produced visibly more cinematic prose in 2 of 3 scenarios. Body discovery prose under V4 was the closest match to the original PDF's tone. |
| 5 | Memory plumbing flattens NPCs into facts | **MIXED — depends on scenario** | V5 (bare one-sentence prompt) was great when conversation history carried the context (A, C) and worse when worldbuilding mattered (B — Wren's voice was thinner without campaign scaffolding). Stripping memory wholesale isn't a win; targeted unbundling might be. |
| 6 | Tone presets constrain main sessions | **FALSE** | Confirmed by code audit. Tone presets (`buildTonePresetBlock`, `TONE_PRESET_LIST`) are only wired into prelude prompts. Main DM sessions get only one line ("Tone: gritty") and an optional `dm_notes.tone` paragraph — neither is doing real work. The user's hypothesis was reasonable but turned out not to apply here. |

## New findings the data surfaced

### H7 — "PLAYER OBSERVATION = ALWAYS A CHECK" + Cardinal Rule 2 (HARD STOPS) are killing atmospheric scene opens

The most striking pattern across Scenario A: **V1 and V2 both ended with "Make a Perception check."** after the player just opened a tavern door and looked around. The CONVERSATION HANDLING modes are working fine — what's truncating the moment is the `OBSERVATION = ALWAYS A CHECK` rule in the MECHANICAL MARKERS section, fired by Cardinal Rule 2 ("when you call for a roll, that's your last sentence").

The original PDF's tavern entry didn't gate observation behind a check at all. It just *narrated* — Gerda's introduction, the notice board, the named patrons — and only later asked for rolls when the player committed to a specific investigation.

**This is the strongest single-lever finding.** V4 (which strips the OBSERVATION = ALWAYS A CHECK rule along with the rest of the markers) skipped the Perception demand on tavern entry and gave a richer scene. Same for the body approach in Scenario C.

### H8 — Cardinal Rule 2 (HARD STOPS after roll request) is compressing cinematic build

Original PDF, body approach: ~250 words of layered horror — 30→20→10 yard distances, smell of blood, fear-sweat, the carved horse in the dead man's hand, "He never had a chance." THEN a question.

Production V1, same scenario: 170 words, ends "Make a Perception check." The HARD STOP rule forced the AI to truncate the cinematic build at the first observation moment.

V4 (markers stripped, but Cardinal Rule 2 still in place) only partially fixed this — it gave 199 words but still ended with "Make a Medicine check." V5 (bare prompt, no rules at all) gave 215 words AND ended with Voss's whisper ("You need to see this. But quietly."), keeping the moment open.

The HARD STOPS rule is correct in spirit (don't narrate the result before the player rolls) but is being applied too aggressively — to *any* mention of a check, even when the check is for resolving a future action and the cinematic moment isn't actually concluded.

## Reading the actual prose (the metrics don't capture this)

### Scenario A — Tavern entry (the original was lush; we're thin)

| | What it produced | How it ended |
|---|---|---|
| V1 baseline | The Tipped Flagon, three named patrons, atmospheric prose | "Make a Perception check." — abrupt |
| V2 no caps | Near-identical to V1 | "Make a Perception check." — abrupt |
| V3 no self-check | Bartender SPEAKS ("We've got stew and we've got ale") | Living scene |
| V4 no markers | Names tavern, sensory detail, no check demand | Carved sign reveal "*The Barleycorn*" |
| V5 bare prompt | Most descriptive, but bolded names feel AI-fanfic-ish | "Door," she says flatly |

V3 and V4 are the closest to original PDF feel here.

### Scenario B — Elder dialogue (we're already close to good)

All variants produced similar quality (177–226 words, 64–79% dialogue). Wren's voice came through in all of them. The COUNCIL/SPOTLIGHT modes are *correctly tuned* for dialogue. This is where the current prompt is doing its job.

V5 (bare) suffered slightly because it lost campaign-scaffolding hooks (named places like Millford, the boundary stones backstory). Memory plumbing is helping here, not hurting.

### Scenario C — Body approach (the original's masterpiece moment; we cut it short)

| | Words | Most evocative line |
|---|---|---|
| Original PDF | ~250 | "He never had a chance." (after layered approach) |
| V1 baseline | 170 | "His fingers are dug into the dirt. He made it this far at least." |
| V2 no caps | 176 | "He's been dead for hours, likely before your warding ritual even began." |
| V3 no self-check | 115 | (rushes to "Make a Medicine check") |
| V4 no markers | 199 | "He crawled here. Not far, but he crawled." |
| V5 bare prompt | 215 | "Faint. Barely there. But present. He's alive." |

V4 and V5 give cinematic build closest to the original. V3's drop to 115 words is interesting — possibly single-sample variance, but worth noting as anti-evidence for the self-check hypothesis in this scenario.

## Recommended next experiments

These are *not* implemented yet — let me know which you want to run.

1. **Single-shot Opus playtest** (user-driven, hypothesis 1)
   The Force-Opus toggle is now live. Pick a moment from your current campaign that felt thin under Sonnet, restart from there with Opus forced, and play 5–10 turns. Compare the prose head-to-head.

2. **Targeted V4 deployment** (production trial)
   Move the OBSERVATION = ALWAYS A CHECK rule out of the per-turn prompt and into a JIT context — only inject when the player explicitly commits to a stealth/investigation/perception action ("I sneak", "I search the body"), not on benign look-around. Keep the marker schemas, just stop demanding checks for ambient observation.

3. **Soften Cardinal Rule 2** (atmospheric variant)
   Add a clause: "If the player has not committed to a specific action and a check is for *resolving* a future action, you may continue narrating the cinematic moment AFTER the roll request as long as you don't reveal the check's outcome." This loosens the HARD STOP for cinematic build without permitting result-spoilers.

4. **Per-scenario A/B with a higher-scaffolding prompt** (control for V5)
   V5 lost worldbuilding hooks. A V6 with bare-prompt + a one-paragraph "World facts the AI should know" injection could test whether memory needs the full structured plumbing or just a context snippet.

5. **Variance check on V3** (single-shot reliability)
   The V3 result on Scenario C (115 words) was anomalously short. Re-running Scenario C × V3 three more times would tell us whether self-check is genuinely neutral on cinematic moments or whether one of the other variants got lucky.

## What the data says about your original intuition

You were right that the system is constraining storytelling. But the **specific levers** were different from what we'd both guessed:

- ✗ Tone choices aren't doing it (not even wired into main sessions in any meaningful way).
- ~ Word-count caps aren't doing it (they don't bind in practice).
- ✓ Marker overhead **is** doing it (V4 was the strongest improvement).
- ✓ Cardinal Rules 2 + the OBSERVATION rule are forcing premature scene-cuts.
- ? Self-check is mixed — helps openers, neutral or marginally hurts elsewhere.
- ? Sonnet vs Opus is still the prime suspect for everything else; needs the playtest.

The architectural insight: **the current prompt is well-tuned for dialogue and mechanical play but over-tuned for atmospheric/cinematic moments.** The original Opus 4.5 prompt was just "be a DM" — no observation rules, no HARD STOPS, no marker overhead. That gave it room to write the lush opening and the body approach we're trying to recapture.

## Files produced this session

- `tests/prose-quality.test.js` — A/B harness (re-runnable with `node tests/prose-quality.test.js`)
- `tests/prose-quality-dryrun.js` — verifies regex transforms before burning API calls
- `tests/output/prose-quality-results.md` — raw outputs (15 scenarios × variants)
- `tests/output/prose-quality-analysis.md` — this file
- `client/src/components/DMSession.jsx` — added Force Opus toggle (in-session pill + setup checkbox)
- `client/src/components/SessionSetup.jsx` — Force Opus checkbox in setup screen
- `server/routes/dmSession.js` — `modelOverride` body param threaded through `/start` and `/message`
