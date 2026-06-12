# TEST_RESULTS.md — Test run log

Per the testing discipline in CLAUDE.md (step 4: log results here). Suites run via
`node tests/<file>.test.js` against the real Turso DB with `TEST_`-prefixed,
self-cleaning data; client build via `node node_modules/vite/bin/vite.js build`
from `client/` (the `&` in the folder path breaks the npm shim).

---

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
