# TEST_RESULTS.md — Test run log

Per the testing discipline in CLAUDE.md (step 4: log results here). Suites run via
`node tests/<file>.test.js` against the real Turso DB with `TEST_`-prefixed,
self-cleaning data; client build via `node node_modules/vite/bin/vite.js build`
from `client/` (the `&` in the folder path breaks the npm shim).

---

## 2026-06-14 — v2.9.0 (memory as variables, Phases 1–3 + critical chronicle bug fix)

Built via a gated multi-agent pipeline (impl → build+test+adversarial gate per
phase); all three gates passed, then an independent backstop run confirmed:

| Suite | Result |
|---|---|
| canon-variables (NEW) | 13 passed, 0 failed |
| set-fact-marker (NEW) | 19 passed, 0 failed |
| session-recovery (NEW) | 20 passed, 0 failed |
| marker-detection | 128 passed, 0 failed |
| marker-schemas | 48 passed, 0 failed |
| marker-pipeline | 44 passed, 0 failed |
| strip-known-markers | 50 passed, 0 failed |
| npc-death-canon | 9 passed, 0 failed |
| npc-lifecycle | 31 passed, 0 failed |
| character-memory | 56 passed, 0 failed |
| dm-turn-lifecycle | 10 passed, 0 failed |
| rolling-summary | 21 passed, 0 failed |
| chronicle-prompt-cap | 6 passed, 0 failed |

- Client build (`node node_modules/vite/bin/vite.js build`): ✓ exit 0.
- Independently verified two agent claims: (1) the marker-regex widening is a true
  strict-superset (all legacy colon-form markers parse/strip identically), and
  (2) `PRAGMA table_info(dm_sessions)` confirms NO `campaign_id`/`game_day` columns —
  the old `generateSessionChronicle` SELECT genuinely threw on its first statement,
  so the recap-extraction writer had been silently failing. Fix verified live.
- Storm-prep commit: CLAUDE.md architecture-snapshot update deferred to next session.

## 2026-06-14 — v2.8.4 (durability: real automatic backups for the cloud save)

Audit item #2: the Turso cloud save had no working backup (`npm run backup` only
copied a local file). Added `server/services/backupService.js` (portable `.sql`
dump for cloud, file copy for local) + an in-process scheduler in `server/index.js`.

| Suite | Result |
|---|---|
| backup-dump (NEW — serializer units + dump→restore round-trip) | 24 passed, 0 failed |
| npc-death-canon (v2.8.3 guard, re-run) | 9 passed, 0 failed |
| npc-lifecycle (re-run) | 31 passed, 0 failed |

- `node --check` on backupService.js, scripts/backup.js, index.js, the new test: OK.
- Client build (`node node_modules/vite/bin/vite.js build`): ✓ built in ~1.4s (exit 0).
  (No client files changed; built anyway per discipline.)
- **Real end-to-end verification against the live Turso DB:** `node server/scripts/backup.js`
  produced `backups/turso-<stamp>.sql` (95 tables, 687 rows, 4.49 MB), and that exact
  dump restored cleanly into a fresh in-memory libsql DB (95 tables recovered). The
  user now has their first real cloud backup.
- Round-trip test proves restorability of the risky cases: apostrophes, NULLs,
  unicode, embedded newlines, negative ints, BLOBs, and index recreation.

## 2026-06-14 — v2.8.3 (durability: dead NPCs stay dead — death canon-category unify)

Single data-integrity fix from the full-codebase audit: `propagateNpcDeath` wrote
death canon facts under `'npc_death'` while the guaranteed "DEATHS (DO NOT
RESURRECT)" prompt block + `getChronicleStats` queried `'death'`. Aligned the
write to the canonical `'death'`, normalized all death reads to
`IN ('death','npc_death')`, excluded deaths from the generic budget blocks, and
added migration 056 to relabel legacy rows.

| Suite | Result |
|---|---|
| npc-death-canon (NEW — regression guard) | 9 passed, 0 failed |
| npc-lifecycle (death-cascade assertion retargeted to `'death'`) | 31 passed, 0 failed |
| character-memory | 56 passed, 0 failed |
| chronicle-prompt-cap | 6 passed, 0 failed |

- `node --check` on the 2 changed services + new migration + new test: OK.
- Client build (`node node_modules/vite/bin/vite.js build`): ✓ built in ~1.5s (exit 0).
- Migration 056 applied cleanly against the live Turso DB during the test run
  (relabeled existing `'npc_death'` rows → `'death'` — the production heal).
- New test proven to be a genuine guard: the canonical-label assertion (Test 1)
  and the legacy-`npc_death`-still-surfaces assertion (Test 2) both fail on the
  pre-fix code path.

## 2026-06-12 — v2.8.2 (history-bounding pass: #2 / #6 / #8 / boundary-call "C")

Second-pass code-review follow-ups (bound the input to non-hot-path LLM calls;
stop a hung socket from wedging a turn). Suites after the four fixes + the
review-driven timeout/UX fix:

| Suite | Result |
|---|---|
| context-chunking (#2 map-reduce summary — no middle deletion) | 5 passed, 0 failed |
| chronicle-prompt-cap (#8 recent-window cap) | 6 passed, 0 failed |
| dm-turn-lifecycle (#1 durable history) | 10 passed, 0 failed |
| claim-idempotency (#3 atomic claim) | 7 passed, 0 failed |
| rolling-summary | 21 passed, 0 failed |
| with-transaction | 9 passed, 0 failed |
| session-transcript | 8 passed, 0 failed |
| marker-pipeline | 44 passed, 0 failed |
| phaseB-spine | 7 passed, 0 failed |

- `node --check` on the 3 changed server files (claude.js, dmSession.js, contextManager.js): OK.
- Client build: ✓ built in ~1.8s (exit 0).
- Adversarial review (6 agents): all four fixes assessed safe to ship; one
  confirmed-medium (exhausted timeout surfaced as an untagged 500 that discarded
  the player's typed input) was fixed before push — `TIMEOUT:` tag → retryable 503
  + client input-restore on any send failure. Remaining findings low/info.

## 2026-06-12 — v2.8.1 (data-integrity: #1 turn persistence + #3 reward claim)

- **dm-turn-lifecycle (#1): 10 passed, 0 failed** — and proven to FAIL on the
  pre-fix code (durable history compacted 33→26, `PRIOR_0` lost, through-index
  frozen at 8), confirming it is a genuine regression guard, not a tautology.
- **claim-idempotency (#3): 7 passed, 0 failed** — two concurrent `/claim`
  requests returned `[200, 400]`; XP/gold/loot applied exactly once.
- Adjacent suites green: rolling-summary 21/0, with-transaction 9/0,
  session-transcript 8/0, marker-pipeline 44/0, phaseB-spine 7/0.
- Client build: exit 0.
- New: mock-Anthropic integration harness (`tests/helpers/mockAnthropic.js` +
  `dmTestApp.js`) — intercepts Anthropic at the `fetch` layer, passes libsql/Turso
  + localhost through, mounts the real dm-session router on an ephemeral port.
