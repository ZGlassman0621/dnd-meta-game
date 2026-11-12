# Report — windows-test-portability: run the full suite green on the PC

## Understanding
**The project.** DnD Meta Game is a solo D&D 2024 campaign app with a 6-stage creator and an AI DM. The test suite (`npm test`, 247 files) is the gate, and until now only the Mac could run it green.

**This job.** Zach asked directly on 2026-11-12 (there is no PM brief): "go ahead and do the testing fixes so we can try to keep it all on the PC." The goal is to make the full suite run green on the Windows PC without changing what any test checks and without changing how the Mac runs.

## Verdict
**BUILT + GREEN** on the PC: **Files 247/247 green, assertions 19,562 passed, 0 failed.** Zach's Mac run remains the gate; not claimed.

## Files changed
Commit and hashes are under Verification evidence. No application (server or client) code changed; only the test runner, test files, and one Git setting.

| File | New / edited | What |
|---|---|---|
| `.gitattributes` | new | Every checkout uses LF (Unix) line endings, Windows included |
| `tests/helpers/windowsExitSettle.mjs` | new | Windows-only preload: `process.exit()` waits 100 ms |
| `server/scripts/run-tests.js` | edited | Loads the preload on Windows; narrow native-crash handling (below); prints exit codes on failure |
| `tests/migration-atomicity.test.js`, `tests/migration-schema-contract.test.js` | edited | Temp-database delete is best-effort on Windows only |
| `tests/catalog-gaps-otto-mansion-sword.test.js` | edited | Imports by `file://` URL instead of a bare `E:\` path |
| 8 bundling suites¹ | edited | Find the real `esbuild.exe` on Windows (11 identical one-line additions) |
| `tests/mechanics-hooks-spellcast.test.js` | edited | Random-roll flake fixed (both outcomes modelled) |

¹ `creator-next-stage4`, `creator-next-stage5`, `creator-next-stage6`, `creator-test-notes-2-client`, `gray-out-client`, `rest-calls-client`, `rest-consolidation-client`, `spellbook-client-sheet`.

## What was built (in play)
Nothing changes in the game. On the PC, `npm test` now produces a trustworthy result: green means green, and the summary names every file that needed Windows-specific handling.

## The six PC problems and their fixes

1. **Crash on exit after `fetch`.**
   - On Windows, Node 24 aborts a process that exits right after `fetch()` talked to a local test server. The error is `UV_HANDLE_CLOSING`, and it fires after the test has already printed "0 failed".
   - I reproduced it in isolation (three `fetch` calls, then exit: 4/4 crashes). Closing the server, closing the fetch dispatcher, and `Connection: close` did not help. A 100 ms pause did (0/4).
   - Fix: a Windows-only preload delays `process.exit()` and natural exits by 100 ms. A failing exit code is never downgraded.
2. **Locked temp databases (EPERM).** On Windows the database library holds its file until the process ends, even after `close()`, so retrying the delete doesn't help. Fix: the cleanup in those two tests is best-effort on Windows only. It's a throwaway file, and the runner wipes its scratch folder each run. On macOS/Linux a delete failure still throws.
3. **Bare Windows path import.** One test imported `E:\...` directly, which Node's module loader rejects. Fix: `file://` URLs, which work on every platform.
4. **esbuild couldn't start.** On Windows, `node_modules/.bin/esbuild` is a shell script, which `execFileSync` can't run. Fix: on Windows, look for the real `@esbuild/win32-<arch>/esbuild.exe` first. The lookup on other platforms is unchanged.
5. **Line endings.** Git on the PC converted files to Windows (CRLF) line endings, which broke the tests that compare exact source text. Fix: `.gitattributes` (`* text=auto eol=lf`), so every clone checks out LF. The repository already stored LF everywhere (935 text files, 0 CRLF), so nothing in the repository changed.
6. **Random-roll flake.** The "Lyra" heal check assumed a 2d8+6 heal (up to 22) always fits in her 19 missing HP. About 1 cast in 11 it doesn't, and the game correctly caps the heal. Fix: the test expects `min(total, 19)`, which covers both outcomes (12/12 passes). This one affected the Mac too, just rarely.

**A residual problem I could not fix in test code.** The database library's native module (`@libsql/client` 0.17) occasionally crashes on Windows with an access violation (`0xC0000005`). It hits a different random file each run, and the same file passes when re-run.
- *At exit:* the crash comes after all assertions passed, 0–4 files per run. The runner counts such a file green only if all three of these hold: that exact crash code, a results line showing 0 failures, and no ✗ line anywhere. The file prints as `pass*`, and the summary lists it by name.
- *Mid-run:* the crash comes before the results print, about 1 file per run. The runner retries that file once, only for that crash code and only if no ✗ was printed. The summary names it with the retry's result. A real failure fails both attempts.

macOS and Linux never take either branch.

## Test results
- **Final full run:** Files 247/247 green, assertions 19,562 passed, 0 failed.
  - Retried after a mid-run native crash: `blood-hunter-subclasses` (passed on retry).
  - `pass*` (native crash after all assertions passed): `clock-unification`, `magic-item-discovery`, `mechanics-hooks-markers`.
- **Progression across runs this session:** baseline 218/246 (26 failed assertions) → 233/247 → 242/247 → 245/247 → 246/247 → 247/247.
- **Repeat checks of the individual fixes:** exit-crash files 0/4 crashes; `migration-schema-contract` 0/8; `mechanics-hooks-spellcast` 0/12 failures; all 8 bundling suites pass with no workaround in `node_modules`.

## Cost and usage
I can't measure it from inside the session; `/usage` in Claude Code shows standing against the $30/month cap. This job made no billed API calls.

## Not done / still open
- **The native crash itself isn't fixed.** It sits in `@libsql/client` 0.17's Windows build. A newer libsql may fix it, but that's a dependency upgrade, out of scope here. It needs its own job and your OK.
- **Both lockfiles are still stale** (they still list the login libraries removed in v1.0.173). Found during creation-solidification and still open; not touched here.
- **Archiving the ~35 stale files:** Muse hasn't sent me that brief (`docs-cleanup-BRIEF-DRAFT.md`). It will run as its own job once it arrives.

## Decisions made (reversible, for veto)
1. **Counting `pass*` and one retry as green on Windows.** The alternative was leaving 1–5 random files red every run, which would make the PC useless as a check. Both rules are narrow (one exact crash code, zero failures, no ✗ lines), visible (named in every summary), Windows-only, and the code is commented. Reversal: delete two `if` blocks in `run-tests.js`, about 5 minutes.
2. **`.gitattributes` forcing LF checkouts.** This affects every future clone (on the Mac it changes nothing, since files are already LF). Reversal: delete the file.
3. **The 100 ms exit delay applies to every test on Windows.** It adds about 25 seconds to a full PC run. Reversal: drop the `--import` in `run-tests.js`.

## Needs Zach's decision
None. The libsql upgrade would be a separate job if you want the native crash gone at the source.

## How to verify
- **PC:** `git pull`, then `npm test`. Expect `Files: 247/247 green` and `0 failed`. Any `pass*` or "Retried once" line names its files; run one of them alone (`npm test <name>`) to see it pass outright.
- **Mac (gate):** `npm test` behaves exactly as before. The Windows branches don't run there, and `.gitattributes` changes nothing on an LF checkout.
- No :5173 check; nothing changed in the game.
