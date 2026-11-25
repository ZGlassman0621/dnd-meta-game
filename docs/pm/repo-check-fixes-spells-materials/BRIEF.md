# Brief — repo-check-fixes-spells-materials: every spell's material, from the book

## Understanding

This is a solo D&D 2024 game: one player character, an AI Dungeon Master, and an engine that owns the rules (dice math, spell slots, the turn order) while the DM narrates what the engine decides.

The spell corrections job (`repo-check-fixes-spells`) built the home for material-component specifics in the spell catalog — the material text, its cost, and whether it is consumed — and filled the examples the brief stated. Its report is PARTIAL: the rest of the values were not in the brief, and the builder does not invent book text. The full 2024 Player's Handbook Chapter 7 transcription is now in the repo at `docs/pm/repo-check-fixes-spells/phb-2024-spells-pp235-343-transcription-2026-11-24.md` (7,107 lines; commit `0d43591`). This job fills the field from that file and settles the few book values the corrections brief didn't state.

## Step 0 — confirm live first

Before building, confirm against the PC copy:

1. Read the corrections job's report (`docs/pm/reports/repo-check-fixes-spells-REPORT.md`) and take its open list as this job's starting scope: the spells missing material specifics (the builder's count was 209) and the book values the corrections brief didn't state.
2. Confirm the material-specifics field shape the corrections job built (field names, storage, the cast-path refusal for a costly or consumed material). Build on it; do not reshape it. If the shape cannot hold a value the book states (for example, two materials with different costs), stop and report rather than force it.
3. Confirm the transcription file is in place and complete (7,107 lines). It is the only source for book values in this job. Nothing is written from memory, from the web, or from a model.

## Item 1 — material specifics for every spell that needs them

For every spell in the catalog whose components include M and whose material specifics are missing or incomplete, fill them from the transcription's Components line for that spell:

- the material text (the book's wording);
- the cost, where the book states one (for example "worth 1,000+ GP");
- whether the spell consumes it (the book says so in the Components line, for example "all of which the spell consumes"; no such phrase means not consumed).

Rules:

- The transcription is authoritative. If a spell's Components line in the transcription is missing, illegible, or ambiguous, list the spell in the report and leave its field as it is. Do not guess.
- Spells outside the Player's Handbook (other books, homebrew) are not in the transcription. Leave their material specifics as they are and report the count of M-component spells left unfilled for that reason.
- A spell whose material is already stored from the corrections job's examples stays as stored, unless the transcription disagrees — in which case correct it and list it in the report.

## Item 2 — the book values the corrections brief didn't state

The corrections report names a few book values its brief didn't state. For each one:

- settle it from the transcription where the transcription speaks (the Components line and the spell's text);
- where the transcription doesn't speak, list it in the report as still open. Do not invent a value.

One is already settled and needs no work: Astral Projection's components are consumed ("one jacinth worth 1,000+ GP and one silver bar worth 100+ GP, all of which the spell consumes").

## Acceptance criteria

- Every Player's Handbook spell in the catalog with an M component carries material specifics (text, cost where stated, consumed flag) taken from the transcription, except any the report lists as unsettled with the reason.
- No material value in the catalog disagrees with the transcription.
- The cast path's behavior for a costly or consumed material (built by the corrections job) works on the filled data: a spell whose material is costly or consumed cannot be cast without it, and a consumed material is spent.
- The non-PHB M-component spells are counted in the report and unchanged.
- The corrections report's open values are each either settled (with the transcription line as evidence) or listed as still open.

## Tests

Extend the spells suite (or add one, matching the corrections job's pattern):

- every PHB M-component spell has material specifics, and a spot-check of named spells matches the transcription word for word (include Astral Projection: jacinth + silver bar, both consumed);
- consumed flags match the transcription for the named spells;
- a costly-material spell is refused without the component and a consumed material is spent, on the filled data;
- mutation check: dropping one spell's specifics fails a check.

Full `npm test` green, with the suite counts in the report.

## Out of scope

- Spells missing from the catalog entirely: report any found (the corrections job found only Tsunami, already added); do not add new spells in this job.
- Material specifics for non-PHB spells (count and report only).
- Any change to the material-specifics field shape, the cast path, or spell mechanics beyond the values above.
- The engine's spell consequences generally (range, willing, targeting) — a separate post-MVP item.

## Report

Write the report to `docs/pm/reports/repo-check-fixes-spells-materials-REPORT.md`, opening with an Understanding section. Include: the step-0 confirmations (the corrections report's open list, the field shape, the transcription check); per-item verdicts; the list of any spells or values left unsettled with reasons; the non-PHB count; files changed with hashes; test results; and anything needing a decision. Place this brief at `docs/pm/repo-check-fixes-spells-materials/BRIEF.md`.
