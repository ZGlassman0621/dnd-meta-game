// tests/helpers/windowsExitSettle.mjs — Windows-only test preload.
//
// Loaded by server/scripts/run-tests.js with `--import` ONLY when the
// runner is on win32; on macOS/Linux nothing loads this file and every
// test exits exactly as before.
//
// Why: on Windows (Node 24), calling process.exit() right after the
// built-in fetch() has talked to a local server aborts the process
// with `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), file
// src\win\async.c` — AFTER the test printed its results. The test
// passed; the runtime crashed while tearing the fetch sockets down, and
// the non-zero exit turned a green file red. Reproduced in isolation
// (three fetches to a local Express app, then process.exit): crashes
// 4/4; closing the server first, closing the fetch dispatcher, or
// sending Connection: close do not help; letting one short timer tick
// pass before exiting does (0/4).
//
// What this does: process.exit(code) records the exit code and exits
// on a 100 ms timer instead of synchronously (50 ms still crashed
// spellbook-service about 1 run in 6). A failing code is never
// downgraded — if a test calls process.exit(1) and then process.exit(0)
// within the window, the process still exits 1.
const realExit = process.exit.bind(process);
let pending = null;

// A natural exit (the event loop drained, no process.exit call) can hit
// the same native teardown race — migration-schema-contract segfaulted
// ~1 run in 4 that way. 'beforeExit' routes it through the same settle.
process.on('beforeExit', () => {
  if (pending === null) process.exit(process.exitCode ?? 0);
});

process.exit = (code) => {
  const next = code === undefined ? (process.exitCode ?? 0) : Number(code) || 0;
  if (pending === null) {
    pending = next;
    setTimeout(() => realExit(pending), 100);
  } else if (next !== 0) {
    pending = pending || next;
  }
};
