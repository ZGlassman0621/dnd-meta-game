/**
 * Model B multi-select moment list — used by Step 7's Backstory
 * expansion. Per spec §5.7.6:
 *
 *   - Player picks 1+ moments from the curated theme list (typically 2-4).
 *   - Each picked moment becomes a chip / token that can be reordered or
 *     removed.
 *   - A "write your own" affordance lets the player author free-text
 *     moments alongside the curated picks.
 *   - Final backstory renders picked moments in order plus any free-text.
 *
 * Decision 4 (DECISION_LOG 2026-05-02): backstory moments have NO
 * alignment indicator — moments are events, not commitments. The action
 * the character takes in response carries alignment, not the moment
 * itself. So no AlignmentChip rendering here (intentional shape
 * difference from PromptList).
 */

export default function MomentList({
  moments,
  pickedKeys,
  onPick,
  onUnpick,
  onReorder,
  onAddCustom,
  customMoments = []
}) {
  if (!moments || moments.length === 0) {
    return (
      <div style={{
        fontFamily: 'var(--serif)',
        fontStyle: 'italic',
        fontSize: 14.5,
        color: 'var(--ink-4)',
        padding: '8px 0'
      }}>
        No theme-flavored moments available — use "Write your own" below.
      </div>
    )
  }

  const isPicked = (key) => pickedKeys.includes(key)
  const movePicked = (idx, delta) => {
    const next = [...pickedKeys]
    const newIdx = idx + delta
    if (newIdx < 0 || newIdx >= next.length) return
    ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
    onReorder(next)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* --- Picked chips (with reorder/remove) ----------------- */}
      {pickedKeys.length > 0 && (
        <div>
          <div className="block-label" style={{ marginBottom: 10 }}>
            <span className="l">Your backstory</span>
            <span className="hint">{pickedKeys.length} picked — they become hooks</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pickedKeys.map((key, idx) => {
              const moment = lookupMoment(key, moments, customMoments)
              if (!moment) return null
              return (
                <div
                  key={key}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: 11,
                    background: 'color-mix(in oklab, var(--accent) 8%, var(--bg-2))',
                    border: '1px solid var(--accent)',
                    fontFamily: 'var(--serif)'
                  }}
                >
                  <div style={{
                    fontSize: 15.5,
                    lineHeight: 1.45,
                    color: 'var(--ink)'
                  }}>
                    <span style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      color: 'var(--accent)',
                      letterSpacing: '0.1em',
                      marginRight: 8
                    }}>
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    {moment.text}
                    {moment.isCustom && (
                      <span style={{
                        fontFamily: 'var(--mono)',
                        fontSize: 9,
                        letterSpacing: '0.08em',
                        color: 'var(--ink-3)',
                        textTransform: 'uppercase',
                        marginLeft: 8
                      }}>
                        — your own
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      type="button"
                      title="Move up"
                      onClick={() => movePicked(idx, -1)}
                      disabled={idx === 0}
                      style={iconButtonStyle(idx === 0)}
                    >↑</button>
                    <button
                      type="button"
                      title="Move down"
                      onClick={() => movePicked(idx, +1)}
                      disabled={idx === pickedKeys.length - 1}
                      style={iconButtonStyle(idx === pickedKeys.length - 1)}
                    >↓</button>
                    <button
                      type="button"
                      title="Remove"
                      onClick={() => onUnpick(key)}
                      style={iconButtonStyle(false)}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* --- Curated moment picker -------------------------------- */}
      {/* Hearth idiom: the Step-7 backstory .chipwrap > .mchip pattern —
          each curated moment is a selectable chip with a .tk check token
          that fills gold when picked. */}
      <div>
        <div className="block-label" style={{ marginBottom: 10 }}>
          <span className="l">Backstory moments</span>
          <span className="hint">click the few that are true</span>
        </div>
        <div className="chipwrap">
          {moments.map((text, i) => {
            const key = `curated:${i}`
            const picked = isPicked(key)
            return (
              <button
                key={key}
                type="button"
                className={`mchip${picked ? ' on' : ''}`}
                onClick={() => picked ? onUnpick(key) : onPick(key)}
              >
                <span className="tk">
                  <svg className="ic" aria-hidden="true"><use href="#i-check" /></svg>
                </span>
                {text}
              </button>
            )
          })}
        </div>
      </div>

      {/* --- Custom (write-your-own) ----------------------------- */}
      <div>
        <div className="block-label" style={{ marginBottom: 10 }}>
          <span className="l">Write your own</span>
        </div>
        <CustomMomentInput onAdd={onAddCustom} />
        {customMoments.length > 0 && (
          <div style={{
            marginTop: 12,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink-4)'
          }}>
            ({customMoments.length} custom moment{customMoments.length === 1 ? '' : 's'} authored — picked ones appear in your backstory above.)
          </div>
        )}
      </div>
    </div>
  )
}

function iconButtonStyle(disabled) {
  // Hearth idiom: small square control echoing the design's .stepper /
  // .rv-edit buttons — rounded, bg-2 surface, ink-3 glyph.
  return {
    width: 28,
    height: 28,
    border: '1px solid var(--rule)',
    borderRadius: 7,
    background: 'var(--bg-2)',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    color: disabled ? 'var(--ink-4)' : 'var(--ink-3)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all .12s'
  }
}

function CustomMomentInput({ onAdd }) {
  let inputEl = null
  const submit = () => {
    if (!inputEl) return
    const v = (inputEl.value || '').trim()
    if (!v) return
    onAdd(v)
    inputEl.value = ''
  }
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <input
        ref={el => { inputEl = el }}
        type="text"
        className="finput"
        placeholder="A formative moment in your own words…"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        style={{ flex: 1, fontSize: 16 }}
      />
      <button type="button" className="btn" onClick={submit}>Add</button>
    </div>
  )
}

/**
 * Resolve a picked-key to its moment object. Curated keys are
 * `curated:<index>`; custom keys are `custom:<index>`. Returns null if
 * the key doesn't resolve (defensive against stale picks after data
 * changes).
 */
function lookupMoment(key, moments, customMoments) {
  const [kind, idxStr] = String(key).split(':')
  const idx = parseInt(idxStr, 10)
  if (kind === 'curated') {
    const text = moments[idx]
    return text ? { text, isCustom: false } : null
  }
  if (kind === 'custom') {
    const text = customMoments[idx]
    return text ? { text, isCustom: true } : null
  }
  return null
}
