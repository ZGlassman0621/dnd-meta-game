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

  // Hearth idiom: the gold "locked/earned" celebration treatment
  // (.lock-cele) — same warm accent card as CelebrationCard, but each
  // earned beat carries a +N magnitude chip, and the outcome region holds
  // a per-bump ability allocator (Hearth .aselect dropdowns).
  return (
    <div className="lock-cele" style={{ padding: '18px 22px 18px 24px' }}>
      <div className="lc-top">
        <span className="lc-fleuron" aria-hidden="true">❧</span>
        <span className="lc-marker">From your Prelude</span>
        <span className="lc-lock">
          <svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>
          Earned
        </span>
      </div>

      <p style={{
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 15,
        color: 'var(--ink-2)',
        margin: '0 0 12px',
        lineHeight: 1.45
      }}>
        {heading}
      </p>

      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bumps.map((b, i) => (
          <li key={i} style={{
            display: 'flex',
            gap: 10,
            alignItems: 'baseline',
            fontFamily: 'var(--serif)',
            fontSize: 15,
            lineHeight: 1.45,
            color: 'var(--ink-2)'
          }}>
            <span className="chip" style={{
              flexShrink: 0,
              fontFamily: 'var(--mono)',
              fontSize: 9.5,
              letterSpacing: '.06em',
              padding: '2px 7px',
              color: 'var(--accent)',
              borderColor: 'color-mix(in oklab, var(--accent) 38%, var(--rule))'
            }}>
              Ch{b.chapter ?? '—'}
            </span>
            <span style={{ flex: 1 }}>{b.chapter_beat || b.reason || '(no chapter beat recorded)'}</span>
            <span className="chip on" style={{
              flexShrink: 0,
              fontFamily: 'var(--mono)',
              fontSize: 10,
              padding: '2px 8px'
            }}>
              +{b.magnitude || 1}
            </span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid color-mix(in oklab, var(--accent) 22%, var(--rule))' }}>
        <div className="lc-note" style={{ marginBottom: 14 }}>
          Though your past shaped you, you may shape your future. Where would you like each to land?
        </div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {bumps.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontFamily: 'var(--sans)',
                fontWeight: 600,
                fontSize: 9.5,
                letterSpacing: '.16em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)'
              }}>
                Bump {i + 1}
              </span>
              <select
                className="aselect"
                style={{ width: 'auto', fontSize: 15 }}
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
