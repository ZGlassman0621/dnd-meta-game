/**
 * Read rows through a brand-new database connection in a separate process.
 *
 * Used by the return-loop suite to prove state was PERSISTED: a value the test
 * process holds in memory (or that sits uncommitted on its own connection) is
 * invisible here. Only what reached the database file comes back.
 *
 * Usage (spawned by the test, never run by the runner — not a *.test.js):
 *   node tests/helpers/freshDbRead.mjs '<json array of [sql, args]>'
 * Prints one JSON line: an array of row arrays, one per query.
 */
import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
if (!url || !url.startsWith('file:')) {
  console.error('freshDbRead: TURSO_DATABASE_URL must be a local file: URL (test database only)')
  process.exit(2)
}

const queries = JSON.parse(process.argv[2] || '[]')
const client = createClient({ url })
const out = []
for (const [sql, args] of queries) {
  const rs = await client.execute({ sql, args: args || [] })
  out.push(rs.rows.map((r) => {
    const o = {}
    for (const c of rs.columns) o[c] = typeof r[c] === 'bigint' ? Number(r[c]) : r[c]
    return o
  }))
}
client.close()
process.stdout.write(JSON.stringify(out) + '\n')
