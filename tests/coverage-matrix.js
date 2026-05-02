#!/usr/bin/env node
/**
 * Alignment-coverage matrix generator.
 *
 * Reads the four prompt-data files (Ideals / Bonds / Flaws — skips
 * Personality per PM ruling: distribution intentionally skewed there)
 * and tabulates which 9-square alignment slots are filled vs empty per
 * theme × field.
 *
 * Output: triage/alignment-coverage-matrix.md.
 *
 * Use:
 *   node tests/coverage-matrix.js
 *
 * Re-run after PM authors gap-fills to verify the holes have been
 * patched. The script is idempotent — overwrites the report each run.
 */

import { writeFileSync } from 'fs'
import { THEME_IDEALS_PROMPTS } from '../client/src/data/themeIdealsPrompts.js'
import { THEME_BONDS_PROMPTS } from '../client/src/data/themeBondsPrompts.js'
import { THEME_FLAWS_PROMPTS } from '../client/src/data/themeFlawsPrompts.js'

const ALL_ALIGNMENTS = ['LG', 'NG', 'CG', 'LN', 'N', 'CN', 'LE', 'NE', 'CE']

const FIELDS = [
  { name: 'Ideals',   data: THEME_IDEALS_PROMPTS },
  { name: 'Bonds',    data: THEME_BONDS_PROMPTS },
  { name: 'Flaws',    data: THEME_FLAWS_PROMPTS }
]

const ALL_THEMES = [
  'acolyte', 'charlatan', 'city_watch', 'clan_crafter', 'criminal',
  'entertainer', 'far_traveler', 'folk_hero', 'guild_artisan', 'haunted_one',
  'hermit', 'investigator', 'knight_of_the_order', 'mercenary_veteran', 'noble',
  'outlander', 'sage', 'sailor', 'soldier', 'urban_bounty_hunter', 'urchin'
]

function alignmentsForTheme(themeId, fieldData) {
  const prompts = fieldData[themeId] || []
  return new Set(prompts.map(p => p.alignment))
}

function buildReport() {
  const lines = []
  lines.push('# Alignment Coverage Matrix')
  lines.push('')
  lines.push(`_Generated ${new Date().toISOString().split('T')[0]} — re-run via \`node tests/coverage-matrix.js\` after authoring gap-fills._`)
  lines.push('')
  lines.push('Tracks which 9-square alignment slots are filled per theme × field for **Ideals**, **Bonds**, and **Flaws** (Personality intentionally excluded — distribution skewed by design).')
  lines.push('')
  lines.push('Reading the matrix:')
  lines.push('- ✓ — at least one prompt with that alignment exists for the theme/field')
  lines.push('- ░ — no prompt with that alignment for the theme/field')
  lines.push('')
  lines.push('Not every empty cell needs filling. Per PM ruling 2026-05-02: *"the principle isn\'t \'every theme covers every alignment\' — it\'s \'every theme has roleplay-believable coverage across the spectrum.\' Some empty slots are correctly empty (a Knight of the Order ideal at CE would read as villain manifesto regardless of how it\'s phrased)."*')
  lines.push('')

  // Aggregate stats
  let totalCells = 0
  let filledCells = 0
  for (const field of FIELDS) {
    for (const theme of ALL_THEMES) {
      const present = alignmentsForTheme(theme, field.data)
      totalCells += ALL_ALIGNMENTS.length
      filledCells += present.size
    }
  }
  lines.push(`**Aggregate:** ${filledCells} / ${totalCells} cells filled (${Math.round((filledCells / totalCells) * 100)}%) across ${ALL_THEMES.length} themes × ${FIELDS.length} fields × ${ALL_ALIGNMENTS.length} alignments.`)
  lines.push('')

  // Per-field matrix
  for (const field of FIELDS) {
    lines.push(`## ${field.name}`)
    lines.push('')
    lines.push(`| theme | ${ALL_ALIGNMENTS.join(' | ')} | filled / 9 |`)
    lines.push(`|---|${ALL_ALIGNMENTS.map(() => ':-:').join('|')}|---|`)

    let fieldFilled = 0
    let fieldTotal = 0
    for (const theme of ALL_THEMES) {
      const present = alignmentsForTheme(theme, field.data)
      const cells = ALL_ALIGNMENTS.map(a => (present.has(a) ? '✓' : '░'))
      const score = present.size
      fieldFilled += score
      fieldTotal += ALL_ALIGNMENTS.length
      lines.push(`| \`${theme}\` | ${cells.join(' | ')} | ${score} / 9 |`)
    }
    lines.push('')
    lines.push(`**${field.name} subtotal:** ${fieldFilled} / ${fieldTotal} cells filled (${Math.round((fieldFilled / fieldTotal) * 100)}%).`)
    lines.push('')
  }

  // Per-theme summary — useful for spotting themes with broad gaps
  lines.push('## Per-theme coverage summary')
  lines.push('')
  lines.push('Themes ordered by total cells filled across Ideals/Bonds/Flaws (most → least). Lower-ranked themes are likely candidates for gap-fill priority.')
  lines.push('')
  lines.push('| theme | Ideals | Bonds | Flaws | total / 27 |')
  lines.push('|---|:-:|:-:|:-:|:-:|')

  const themeScores = ALL_THEMES.map(theme => ({
    theme,
    ideals: alignmentsForTheme(theme, THEME_IDEALS_PROMPTS).size,
    bonds: alignmentsForTheme(theme, THEME_BONDS_PROMPTS).size,
    flaws: alignmentsForTheme(theme, THEME_FLAWS_PROMPTS).size
  })).map(s => ({ ...s, total: s.ideals + s.bonds + s.flaws }))
    .sort((a, b) => b.total - a.total || a.theme.localeCompare(b.theme))

  for (const s of themeScores) {
    lines.push(`| \`${s.theme}\` | ${s.ideals} | ${s.bonds} | ${s.flaws} | ${s.total} / 27 |`)
  }
  lines.push('')

  // Gap-density view — alignment-axis view
  lines.push('## Per-alignment coverage summary')
  lines.push('')
  lines.push('How often each alignment appears across all theme × field combinations. Low-count alignments are likely under-represented and may benefit from cross-theme gap-fill.')
  lines.push('')
  lines.push('| alignment | total appearances / 63 (21 themes × 3 fields) |')
  lines.push('|---|:-:|')

  const alignmentCounts = Object.fromEntries(ALL_ALIGNMENTS.map(a => [a, 0]))
  for (const field of FIELDS) {
    for (const theme of ALL_THEMES) {
      const present = alignmentsForTheme(theme, field.data)
      for (const a of present) alignmentCounts[a] = (alignmentCounts[a] || 0) + 1
    }
  }
  const denom = ALL_THEMES.length * FIELDS.length
  for (const a of ALL_ALIGNMENTS) {
    lines.push(`| \`${a}\` | ${alignmentCounts[a]} / ${denom} |`)
  }
  lines.push('')

  return lines.join('\n')
}

const report = buildReport()
const outPath = 'triage/alignment-coverage-matrix.md'
writeFileSync(outPath, report, 'utf8')
console.log(`Wrote ${outPath}`)
console.log(`(${report.split('\n').length} lines)`)
