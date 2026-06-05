#!/usr/bin/env node
/**
 * AI Behavior CLI tool (Phase 4a SC-4a.4).
 *
 * Standard Unix-style: parameters, output to stdout, composable with
 * grep/jq/etc. Wraps the same signal functions as the debug page.
 *
 * Usage:
 *   node server/scripts/ai-behavior.js sessions [--character-id=N] [--limit=N]
 *   node server/scripts/ai-behavior.js signal --signal=<name> [filters...]
 *   node server/scripts/ai-behavior.js calls [filters...]
 *   node server/scripts/ai-behavior.js export --session-id=N [--format=json]
 *   node server/scripts/ai-behavior.js shape --builder=<name> [--since=ISO]
 *
 * Filters (for any subcommand that accepts them):
 *   --character-id=N
 *   --session-id=N | --session-id=last
 *   --since=YYYY-MM-DD | --since=ISO_TIMESTAMP
 *   --until=YYYY-MM-DD
 *   --limit=N (default 200; max 5000)
 *   --purpose=<call_purpose>
 *
 * Signals (for `signal` subcommand):
 *   all                              — every signal at once
 *   marker-correction-loop
 *   rule-violations
 *   repetition-ledger
 *   response-length
 *   marker-emission
 *   name-reuse
 *   time-drift
 *   scope-of-application
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { initDatabase, dbAll, dbGet } from '../database.js';
import {
  computeAllSignals,
  markerCorrectionLoopHits,
  ruleViolationRates,
  repetitionLedgerTriggers,
  responseLengthDistribution,
  markerEmissionRates,
  nameReuseSignal,
  timeDriftSignal,
  scopeOfInstructionApplication
} from '../services/aiBehaviorSignals.js';
import {
  lengthDistributionForBuilder,
  sectionContributionForBuilder,
  cumulativeContextForSession
} from '../services/promptShapeAccounting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const SIGNAL_DISPATCH = {
  'all': computeAllSignals,
  'marker-correction-loop': markerCorrectionLoopHits,
  'rule-violations': ruleViolationRates,
  'repetition-ledger': repetitionLedgerTriggers,
  'response-length': responseLengthDistribution,
  'marker-emission': markerEmissionRates,
  'name-reuse': nameReuseSignal,
  'time-drift': timeDriftSignal,
  'scope-of-application': scopeOfInstructionApplication
};

function parseArgs(argv) {
  const args = { _: [] };
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      args[key] = value === undefined ? true : value;
    } else {
      args._.push(arg);
    }
  }
  return args;
}

async function resolveLastSessionId() {
  const row = await dbGet(
    `SELECT session_id FROM ai_call_log
     WHERE session_id IS NOT NULL
     ORDER BY request_started_at DESC LIMIT 1`
  );
  return row?.session_id || null;
}

async function buildFilter(args) {
  const filter = {};
  if (args['character-id']) filter.characterId = parseInt(args['character-id'], 10);
  if (args['session-id']) {
    if (args['session-id'] === 'last') {
      const last = await resolveLastSessionId();
      if (last == null) {
        console.error('No sessions found in ai_call_log.');
        process.exit(1);
      }
      filter.sessionId = last;
    } else {
      filter.sessionId = parseInt(args['session-id'], 10);
    }
  }
  if (args.since) filter.sinceIso = args.since;
  if (args.until) filter.untilIso = args.until;
  if (args.limit) filter.limit = parseInt(args.limit, 10);
  return filter;
}

async function cmdSessions(args) {
  const where = ['session_id IS NOT NULL'];
  const params = [];
  if (args['character-id']) {
    where.push('character_id = ?');
    params.push(parseInt(args['character-id'], 10));
  }
  params.push(parseInt(args.limit || '20', 10));
  const rows = await dbAll(
    `SELECT session_id, MIN(character_id) as character_id, COUNT(*) as call_count,
            MIN(request_started_at) as first_at, MAX(request_started_at) as last_at,
            SUM(input_tokens) as total_input_tokens, SUM(output_tokens) as total_output_tokens
     FROM ai_call_log
     WHERE ${where.join(' AND ')}
     GROUP BY session_id
     ORDER BY last_at DESC
     LIMIT ?`,
    params
  );
  console.log(JSON.stringify(rows, null, 2));
}

async function cmdSignal(args) {
  const signal = args.signal;
  if (!signal || !SIGNAL_DISPATCH[signal]) {
    console.error(`Unknown signal "${signal}". Valid: ${Object.keys(SIGNAL_DISPATCH).join(', ')}`);
    process.exit(1);
  }
  const filter = await buildFilter(args);
  const result = await SIGNAL_DISPATCH[signal](filter);
  console.log(JSON.stringify(result, null, 2));
}

async function cmdCalls(args) {
  const filter = await buildFilter(args);
  const where = ['1=1'];
  const params = [];
  if (filter.characterId != null) { where.push('character_id = ?'); params.push(filter.characterId); }
  if (filter.sessionId != null) { where.push('session_id = ?'); params.push(filter.sessionId); }
  if (filter.sinceIso) { where.push('request_started_at >= ?'); params.push(filter.sinceIso); }
  if (args.purpose) { where.push('call_purpose = ?'); params.push(args.purpose); }
  params.push(filter.limit || 50);
  const rows = await dbAll(
    `SELECT id, character_id, session_id, turn_number, prompt_builder, call_purpose,
            request_started_at, latency_ms, input_tokens, output_tokens,
            response_status, triggered_correction_loop
     FROM ai_call_log
     WHERE ${where.join(' AND ')}
     ORDER BY request_started_at DESC
     LIMIT ?`,
    params
  );
  console.log(JSON.stringify(rows, null, 2));
}

async function cmdExport(args) {
  if (!args['session-id']) {
    console.error('export requires --session-id=N (or --session-id=last)');
    process.exit(1);
  }
  const filter = await buildFilter(args);
  const rows = await dbAll(
    `SELECT * FROM ai_call_log WHERE session_id = ? ORDER BY request_started_at ASC`,
    [filter.sessionId]
  );
  const format = args.format || 'json';
  if (format === 'json') {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    console.error(`Unknown format "${format}". Only json is supported in v1.`);
    process.exit(1);
  }
}

async function cmdShape(args) {
  if (!args.builder) {
    console.error('shape requires --builder=<name>');
    process.exit(1);
  }
  const length = await lengthDistributionForBuilder({ builder: args.builder, sinceIso: args.since });
  const section = await sectionContributionForBuilder({ builder: args.builder, sinceIso: args.since });
  console.log(JSON.stringify({
    builder: args.builder,
    length_distribution: length,
    section_contribution: section
  }, null, 2));
}

async function cmdCumulative(args) {
  if (!args['session-id']) {
    console.error('cumulative requires --session-id=N (or --session-id=last)');
    process.exit(1);
  }
  const filter = await buildFilter(args);
  const result = await cumulativeContextForSession({ sessionId: filter.sessionId });
  console.log(JSON.stringify(result, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    console.log(`AI Behavior CLI (Phase 4a SC-4a.4)

Subcommands:
  sessions     List recent sessions with call counts + token totals.
  signal       Compute a named signal. --signal=<name> required.
  calls        List recent AI calls with metadata. Filters supported.
  export       Dump full session call log as JSON. --session-id required.
  shape        Prompt-shape (length + section) for a builder. --builder required.
  cumulative   Cumulative-context trajectory for a session. --session-id required.

Filters (where applicable):
  --character-id=N
  --session-id=N | last
  --since=ISO   --until=ISO
  --limit=N     --purpose=<call_purpose>

Signals: ${Object.keys(SIGNAL_DISPATCH).join(', ')}
`);
    process.exit(0);
  }
  const args = parseArgs(argv.slice(1));
  args._cmd = argv[0];

  await initDatabase();

  switch (argv[0]) {
    case 'sessions':   return cmdSessions(args);
    case 'signal':     return cmdSignal(args);
    case 'calls':      return cmdCalls(args);
    case 'export':     return cmdExport(args);
    case 'shape':      return cmdShape(args);
    case 'cumulative': return cmdCumulative(args);
    default:
      console.error(`Unknown subcommand "${argv[0]}". Run --help.`);
      process.exit(1);
  }
}

main().then(() => process.exit(0)).catch(err => {
  console.error(err.message);
  console.error(err.stack);
  process.exit(1);
});
