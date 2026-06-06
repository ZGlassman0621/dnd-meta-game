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
        fontSize: 14.5,
        color: 'var(--ink-4)',
        padding: '8px 0'
      }}>
        No theme-flavored prompts available — fill the field freely.
      </div>
    )
  }

  // Hearth idiom: the Step-7 .prompt-list — a stacked list of click-to-fill
  // .po buttons, the matching one carrying .on (gold-wash highlight). The
  // alignment chip rides inline at the head of each prompt (Decision 3).
  return (
    <div className="prompt-list" style={{ margin: '12px 0 18px', borderTop: 'none', paddingTop: 0 }}>
      {prompts.map((p, i) => {
        const picked = (value || '').trim() === p.text.trim()
        return (
          <button
            key={i}
            type="button"
            className={`po${picked ? ' on' : ''}`}
            onClick={() => onPick(p)}
            style={{
              display: 'flex',
              gap: 10,
              alignItems: 'baseline'
            }}
          >
            {p.alignment && (
              <span style={{ flexShrink: 0 }}>
                <AlignmentChip alignment={p.alignment} />
              </span>
            )}
            <span>{p.text}</span>
          </button>
        )
      })}
    </div>
  )
}
