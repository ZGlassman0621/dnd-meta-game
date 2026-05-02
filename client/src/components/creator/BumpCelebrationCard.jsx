/**
 * Bump celebration card — Step 5's variant of the celebration primitive.
 * Per PHASE_2_CREATOR_SPEC.md §5.5.5.
 *
 * Shape differs from CelebrationCard in two ways:
 *
 * 1. Heading is count-aware:
 *    - 1 bump → "One moment shaped you:"
 *    - 2 bumps → "Two moments shaped you:"
 *    - N bumps (rare; up to 4 if all four +1 hints accept) → "[N] moments shaped you:"
 *    "Shaped" is intentionally neutral about how — see §5.5.5 verb-choice note.
 *
 * 2. Each beat is paired with a per-bump ability dropdown so the player
 *    can assign each +1 to a stat. Default per spec §5.5.7: alphabetical
 *    first-fit so two bumps don't accidentally stack on one stat.
 */

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_LABELS = {
  str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA'
}

const NUMBER_WORDS = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four' }

function countWord(n) {
  return NUMBER_WORDS[n] || String(n)
}

export default function BumpCelebrationCard({ bumps, assignments, onAssignmentChange }) {
  const n = bumps.length
  if (n === 0) return null

  const headingNoun = n === 1 ? 'moment' : 'moments'
  const headingVerb = n === 1 ? 'shaped' : 'shaped'  // verb stays "shaped" per §5.5.5
  const heading = `${countWord(n)} ${headingNoun} ${headingVerb} you:`

  return (
    <div className="celebration">
      <div className="marker">From your Prelude</div>
      <p className="opening">{heading}</p>
      <ul>
        {bumps.map((b, i) => (
          <li key={i}>
            <span className="ch">Ch{b.chapter ?? '—'}</span>
            {b.chapter_beat || b.reason || '(no chapter beat recorded)'}
            <span style={{
              color: 'var(--accent)',
              fontFamily: 'var(--mono)',
              fontSize: 11,
              marginLeft: 10,
              padding: '1px 6px',
              border: '1px solid var(--accent-2)',
              borderRadius: 2
            }}>
              +{b.magnitude || 1}
            </span>
          </li>
        ))}
      </ul>
      <div className="outcome" style={{ paddingTop: 18 }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 17, color: 'var(--ink-2)', marginBottom: 14 }}>
          Though your past shaped you, you may shape your future. Where would you like each to land?
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {bumps.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span className="label" style={{ fontSize: 11 }}>Bump {i + 1}</span>
              <select
                className="select"
                style={{ width: 'auto', fontSize: 16, padding: '6px 24px 6px 6px' }}
                value={assignments[i] || ''}
                onChange={e => onAssignmentChange(i, e.target.value)}
              >
                {ABILITY_KEYS.map(k => (
                  <option key={k} value={k}>{ABILITY_LABELS[k]}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Default bump-to-ability assignment: alphabetical first-fit. Per spec
 * §5.5.7, this prevents two bumps from accidentally stacking on one
 * stat. Player override is one click away (the dropdown).
 *
 * Returns an array of ability-key strings in bump order, e.g.
 * ['cha', 'con'] for two bumps (alphabetical: cha < con < dex < int < str < wis).
 */
export function defaultBumpAssignments(bumps) {
  if (!bumps || bumps.length === 0) return []
  // Sorted alphabetical: cha, con, dex, int, str, wis
  const sorted = [...ABILITY_KEYS].sort()
  return bumps.map((_, i) => sorted[i % sorted.length])
}

export { ABILITY_KEYS, ABILITY_LABELS }
