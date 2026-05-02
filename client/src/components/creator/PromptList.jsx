import AlignmentChip from './AlignmentChip.jsx'

/**
 * Model A click-to-fill prompt list — used by Step 7's Personality /
 * Ideals / Bonds / Flaws expansions. Per spec §5.7.6:
 *
 *   - Click a prompt → its text populates the textarea as starter text.
 *   - The starter is soft — clicking a different prompt replaces it,
 *     with a confirm prompt if the player has typed beyond the starter.
 *   - Alignment chip renders inline alongside each prompt (Decision 3).
 *
 * The picked-state highlight tracks which prompt currently matches the
 * textarea exactly (so if the player edits, the picked highlight clears).
 */

export default function PromptList({ prompts, value, onPick }) {
  if (!prompts || prompts.length === 0) {
    return (
      <div style={{
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 15,
        color: 'var(--ink-3)',
        padding: '8px 0'
      }}>
        No theme-flavored prompts available — fill the field freely.
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      margin: '12px 0 18px'
    }}>
      {prompts.map((p, i) => {
        const picked = (value || '').trim() === p.text.trim()
        return (
          <button
            key={i}
            type="button"
            onClick={() => onPick(p)}
            style={{
              display: 'grid',
              gridTemplateColumns: '52px 1fr',
              gap: 14,
              alignItems: 'center',
              padding: '10px 14px',
              background: picked ? 'var(--bg-2)' : 'var(--bg)',
              border: `1px solid ${picked ? 'var(--accent)' : 'var(--rule-soft)'}`,
              cursor: 'pointer',
              transition: 'all .12s',
              textAlign: 'left',
              fontFamily: 'var(--serif)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <AlignmentChip alignment={p.alignment} />
            </div>
            <div style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 15.5,
              lineHeight: 1.45,
              color: 'var(--ink-2)'
            }}>
              {p.text}
            </div>
          </button>
        )
      })}
    </div>
  )
}
