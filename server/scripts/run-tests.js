#!/usr/bin/env node
/**
 * Test runner.
 *
 * The suite has no framework — each test file is a standalone ES module that
 * self-executes, prints "=== Results: N passed, M failed ===" and exits 1 on
 * failure. This runner just sequences them and aggregates.
 *
 * SAFETY: 16 test files import server/database.js, which reads
 * TURSO_DATABASE_URL from .env and would otherwise run against the LIVE
 * campaign database. dotenv does not override variables already present in
 * process.env, so exporting a file: URL here redirects every test to a
 * throwaway SQLite file. Never remove this without a replacement.
 *
 * Files run sequentially, not in parallel: they share one database and use a
 * TEST_-prefix convention for cleanup, so concurrent runs would interleave.
 *
 * Usage:
 *   npm test                  — run every tests/*.test.js
 *   npm test -- <substring>   — run only files whose name contains <substring>
 */

import { spawn } from 'node:child_process'
import { readdirSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEST_DIR = join(ROOT, 'tests')
const SCRATCH = join(ROOT, '.test-tmp')
const TEST_DB = join(SCRATCH, 'test.db')

// Per-file wall-clock ceiling. Files that reach out to a dev server or an LLM
// hang rather than fail, and one hang would otherwise stall the whole run.
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 120000)

// No file in tests/*.test.js calls a live model: every AI call is stubbed
// (tests/helpers/llmHarness.js), and OLLAMA_URL below points at a dead port so
// an unstubbed call fails in milliseconds instead of reaching Ollama. The one
// live-model check, the leak test, runs separately: `npm run test:leak`.

const filter = process.argv[2] || ''

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => (filter ? f.includes(filter) : true))
  .sort()

if (files.length === 0) {
  console.error(`No test files matched${filter ? ` "${filter}"` : ''} in tests/`)
  process.exit(1)
}

const env = {
  ...process.env,
  NODE_ENV: 'test',
  // Redirect libSQL away from Turso. See SAFETY note above.
  TURSO_DATABASE_URL: `file:${TEST_DB}`,
  TURSO_AUTH_TOKEN: '',
  // Session-end fires a fire-and-forget backup. Under test that would snapshot
  // the throwaway database into backups/ on every ended session, and — because
  // retention prunes to the newest N — a run with several session-end tests
  // would evict the user's real backups. Off by default; a test that wants to
  // exercise the backup path sets it back on for itself.
  FF_SESSION_END_BACKUP: 'false',
  // SAFETY, like the database redirect: never let a test reach the real local
  // model. Port 9 on loopback refuses instantly, so a call no stub caught
  // fails fast (llm.js tags it LOCAL_MODEL_UNAVAILABLE) rather than spending
  // a minute in Ollama and depending on the model's mood. Tests that exercise
  // the AI path install the harness stub, which answers this address.
  OLLAMA_URL: 'http://127.0.0.1:9',
}

// Windows only: a preload that lets process.exit() settle one short
// timer before exiting. Node 24 on Windows aborts a process that exits
// immediately after fetch() talked to a local server
// (`UV_HANDLE_CLOSING`, src\win\async.c) — after the test already
// passed. See tests/helpers/windowsExitSettle.mjs. macOS/Linux spawn
// exactly as before.
const NODE_PRELOAD = process.platform === 'win32'
  ? ['--import', pathToFileURL(join(TEST_DIR, 'helpers', 'windowsExitSettle.mjs')).href]
  : []

function runOne(file) {
  return new Promise((res) => {
    const started = Date.now()
    const child = spawn(process.execPath, [...NODE_PRELOAD, join(TEST_DIR, file)], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let out = ''
    let timedOut = false
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))

    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, TIMEOUT_MS)

    child.on('close', (code) => {
      clearTimeout(timer)
      // Persist full output for failures. The 12-line tail is often not enough
      // to diagnose a test that dies early, and intermittent failures are hard
      // to reproduce on demand.
      if (code !== 0 || timedOut) {
        try {
          writeFileSync(join(SCRATCH, `${file}.log`), out)
        } catch {
          // a failure to write the log helps nobody if it also fails the run
        }
      }
      // Two summary styles exist in the suite: 32 files wrap the line in
      // "=== ... ===", 8 print it bare between separator rows. Match both, or
      // the aggregate count silently under-reports.
      const summary = out.match(/Results: (\d+) passed, (\d+) failed/)
      // FAILURE DETAIL used to print only the last 12 lines. That hid
      // failures that happen early in a file — e.g. a schema-contract
      // ✗ on line 5, whose tail showed only passing checks — so the
      // pasted output did not contain the failing assert at all.
      // Now: every failing line, with 2 lines of context each, then
      // the tail. Capped so one noisy file cannot flood the run.
      const lines = out.trim().split('\n')
      const tail = lines.slice(-12)
      const primary = (l) =>
        /✗|FAIL:|AssertionError|Error\b|^\s*code: '/.test(l)
      const keep = new Set()
      lines.forEach((l, i) => {
        if (!primary(l)) return
        for (let j = Math.max(0, i - 2); j <= Math.min(lines.length - 1, i + 2); j++) keep.add(j)
      })
      const failureLines = [...keep].sort((a, b) => a - b).map((i) => lines[i]).slice(0, 60)
      const detail =
        failureLines.length > 0
          ? [...failureLines, '--- tail ---', ...tail].join('\n')
          : tail.join('\n')
      // Windows native exit crash (narrow, visible — never silent):
      // libSQL's native module occasionally segfaults while the process
      // tears down AFTER the test finished, exiting 0xC0000005 instead
      // of 0. Counted as a pass ONLY when all three hold: that exact
      // access-violation code, a results line with zero failures, and
      // no ✗ line anywhere in the output. Such files print as `pass*`
      // and are listed by name in the summary. A real failure exits 1
      // and stays red; macOS/Linux never take this branch.
      const zeroFailSummary = (summary && Number(summary[2]) === 0)
        || /\b\d+ passed, 0 failed\b/.test(out)
        || /all assertions passed/i.test(out)
      const nativeExitCrash = process.platform === 'win32'
        && !timedOut
        && code === 3221225477
        && zeroFailSummary
        && !/✗|FAIL:/.test(out)
      res({
        file,
        ms: Date.now() - started,
        timedOut,
        code: nativeExitCrash ? 0 : code,
        nativeExitCrash,
        passed: summary ? Number(summary[1]) : null,
        failed: summary ? Number(summary[2]) : null,
        detail,
      })
    })
  })
}

const results = []
for (const file of files) {
  let r = await runOne(file)
  // Windows only: libSQL's native module occasionally crashes the
  // process MID-run (0xC0000005, no results line) — a different file
  // each run, and the same file passes when re-run. Retry such a file
  // ONCE, never when it printed a ✗/FAIL line, and name it in the
  // summary. A real failure fails both attempts; macOS/Linux never retry.
  if (process.platform === 'win32' && !r.timedOut && r.code === 3221225477 && r.passed === null && !/✗|FAIL:/.test(r.detail)) {
    const retry = await runOne(file)
    retry.retriedAfterNativeCrash = true
    r = retry
  }
  results.push(r)
  const mark = r.timedOut ? 'TIMEOUT' : r.nativeExitCrash ? 'pass*' : r.code === 0 ? 'pass' : 'FAIL'
  const counts = r.passed !== null ? ` (${r.passed}/${r.passed + r.failed})` : ''
  console.log(`${mark.padEnd(7)} ${file}${counts} ${(r.ms / 1000).toFixed(1)}s`)
}

const failures = results.filter((r) => r.code !== 0 || r.timedOut)

if (failures.length > 0) {
  console.log(`\n${'='.repeat(70)}\nFAILURE DETAIL\n${'='.repeat(70)}`)
  for (const f of failures) {
    console.log(`\n--- ${f.file}${f.timedOut ? ' (TIMED OUT)' : ` (exit ${f.code})`} ---`)
    console.log(f.detail)
  }
}

const assertsPassed = results.reduce((n, r) => n + (r.passed || 0), 0)
const assertsFailed = results.reduce((n, r) => n + (r.failed || 0), 0)

console.log(`\n${'='.repeat(70)}`)
console.log(
  `Files: ${results.length - failures.length}/${results.length} green  |  ` +
    `Assertions: ${assertsPassed} passed, ${assertsFailed} failed`
)
const retried = results.filter((r) => r.retriedAfterNativeCrash)
if (retried.length > 0) {
  console.log(
    `Retried once after a Windows native crash mid-run (result shown is the retry's): ` +
      retried.map((r) => `${r.file} → ${r.code === 0 ? 'pass' : 'FAIL'}`).join(', ')
  )
}
const nativeCrashes = results.filter((r) => r.nativeExitCrash)
if (nativeCrashes.length > 0) {
  console.log(
    `pass* (Windows native exit crash AFTER all assertions passed — counted green, see run-tests.js): ` +
      nativeCrashes.map((r) => r.file).join(', ')
  )
}
console.log('='.repeat(70))

process.exit(failures.length > 0 ? 1 : 0)
