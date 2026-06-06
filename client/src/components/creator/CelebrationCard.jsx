/**
 * Celebration card primitive — used in handoff mode at Steps 2 (Ancestry),
 * 3 (Theme), and 5 (Ability Scores) to honor what the years did.
 *
 * Per spec §5.2.5 / §5.3.5 template:
 *
 *   In the years that shaped you, you:
 *   • [chapter beat 1, one sentence with chapter reference]
 *   • [chapter beat 2, one sentence with chapter reference]
 *   • [optional chapter beat 3]
 *
 *   You are/take up your calling: **[Outcome]**.
 *
 *   [Optional sub-line: feat description, etc.]
 *
 * Card UI variant only — manuscript variant from the design mockup is
 * NOT carried forward (PM ruling: pick one, ship one).
 */

export default function CelebrationCard({
  marker = 'From your Prelude',
  opening,
  beats,
  outcomePrefix,
  outcomeBold,
  outcomeSuffix = '.',
  featDesc,
  children
}) {
  // Hearth idiom: the gold "locked/earned" celebration treatment
  // (.lock-cele) — a warm accent-washed card with a fleuron + uppercase
  // marker + a "locked" badge in the top row, the chapter beats that
  // justify it, and the earned outcome rendered as the .lc-value.
  return (
    <div className="lock-cele" style={{ padding: '18px 22px 18px 24px' }}>
      <div className="lc-top">
        <span className="lc-fleuron" aria-hidden="true">❧</span>
        <span className="lc-marker">{marker}</span>
        <span className="lc-lock">
          <svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>
          Earned
        </span>
      </div>

      {/* Opening is opt-in per caller — Step 2 / 3 use focused openings
         ("These moments named your heritage gift:" / "These moments
         brought you to your theme:") rather than the repetitive "In the
         years that shaped you, you:" lead-in that duplicated the marker. */}
      {opening && (
        <p style={{
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 15,
          color: 'var(--ink-2)',
          margin: '0 0 12px',
          lineHeight: 1.45
        }}>
          {opening}
        </p>
      )}

      <ul style={{ listStyle: 'none', margin: '0 0 14px', padding: 0, display: 'flex', flexDirection: 'column', gap: 9 }}>
        {beats.map((b, i) => (
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
              Ch{b.chapter}
            </span>
            <span>{b.reason || b.text}</span>
          </li>
        ))}
      </ul>

      <div className="lc-value">
        {outcomePrefix} <strong style={{ color: 'var(--accent)', fontWeight: 600 }}>{outcomeBold}</strong>{outcomeSuffix}
      </div>
      {featDesc && <div className="lc-note" style={{ marginTop: 5 }}>{featDesc}</div>}
      {children}
    </div>
  )
}
