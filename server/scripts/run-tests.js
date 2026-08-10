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
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const TEST_DIR = join(ROOT, 'tests')
const SCRATCH = join(ROOT, '.test-tmp')
const TEST_DB = join(SCRATCH, 'test.db')

// Per-file wall-clock ceiling. Files that reach out to a dev server or an LLM
// hang rather than fail, and one hang would otherwise stall the whole run.
const TIMEOUT_MS = Number(process.env.TEST_TIMEOUT_MS || 120000)

// Excluded from the default run because they call the live Anthropic API —
// they cost real money per run and take minutes. They are prose-quality
// evaluations, not regression tests, so they do not belong in a pre-push gate.
// Opt in with TEST_INCLUDE_LLM=1 when deliberately evaluating prompt changes.
const LLM_TESTS = new Set(['prose-quality.test.js'])

const filter = process.argv[2] || ''
const includeLlm = process.env.TEST_INCLUDE_LLM === '1'

rmSync(SCRATCH, { recursive: true, force: true })
mkdirSync(SCRATCH, { recursive: true })

const skipped = []
const files = readdirSync(TEST_DIR)
  .filter((f) => f.endsWith('.test.js'))
  .filter((f) => (filter ? f.includes(filter) : true))
  .filter((f) => {
    if (LLM_TESTS.has(f) && !includeLlm) {
      skipped.push(f)
      return false
    }
    return true
  })
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
}

function runOne(file) {
  return new Promise((res) => {
    const started = Date.now()
    const child = spawn(process.execPath, [join(TEST_DIR, file)], {
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
      res({
        file,
        ms: Date.now() - started,
        timedOut,
        code,
        passed: summary ? Number(summary[1]) : null,
        failed: summary ? Number(summary[2]) : null,
        // Keep the tail only — enough to diagnose, short enough to read.
        tail: out.trim().split('\n').slice(-12).join('\n'),
      })
    })
  })
}

const results = []
for (const file of files) {
  const r = await runOne(file)
  results.push(r)
  const mark = r.timedOut ? 'TIMEOUT' : r.code === 0 ? 'pass' : 'FAIL'
  const counts = r.passed !== null ? ` (${r.passed}/${r.passed + r.failed})` : ''
  console.log(`${mark.padEnd(7)} ${file}${counts} ${(r.ms / 1000).toFixed(1)}s`)
}

const failures = results.filter((r) => r.code !== 0 || r.timedOut)

if (failures.length > 0) {
  console.log(`\n${'='.repeat(70)}\nFAILURE DETAIL\n${'='.repeat(70)}`)
  for (const f of failures) {
    console.log(`\n--- ${f.file}${f.timedOut ? ' (TIMED OUT)' : ''} ---`)
    console.log(f.tail)
  }
}

const assertsPassed = results.reduce((n, r) => n + (r.passed || 0), 0)
const assertsFailed = results.reduce((n, r) => n + (r.failed || 0), 0)

console.log(`\n${'='.repeat(70)}`)
console.log(
  `Files: ${results.length - failures.length}/${results.length} green  |  ` +
    `Assertions: ${assertsPassed} passed, ${assertsFailed} failed`
)
if (skipped.length > 0) {
  console.log(`Skipped (live LLM, set TEST_INCLUDE_LLM=1): ${skipped.join(', ')}`)
}
console.log('='.repeat(70))

process.exit(failures.length > 0 ? 1 : 0)
