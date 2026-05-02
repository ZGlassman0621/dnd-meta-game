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
  return (
    <div className="celebration">
      <div className="marker">{marker}</div>
      {/* Opening is now opt-in per caller — Step 2 / 3 use focused
         openings ("These moments named your heritage gift:" /
         "These moments brought you to your theme:") rather than the
         repetitive "In the years that shaped you, you:" lead-in that
         duplicated the marker eyebrow. */}
      {opening && <p className="opening">{opening}</p>}
      <ul>
        {beats.map((b, i) => (
          <li key={i}>
            <span className="ch">Ch{b.chapter}</span>
            {b.reason || b.text}
          </li>
        ))}
      </ul>
      <div className="outcome">
        {outcomePrefix} <strong>{outcomeBold}</strong>{outcomeSuffix}
      </div>
      {featDesc && <div className="feat-desc">{featDesc}</div>}
      {children}
    </div>
  )
}
