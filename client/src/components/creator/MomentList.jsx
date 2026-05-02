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
        fontSize: 15,
        color: 'var(--ink-3)',
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
          <div className="label" style={{ fontSize: 11, marginBottom: 10 }}>
            Your backstory ({pickedKeys.length} picked)
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
                    background: 'var(--bg-2)',
                    border: '1px solid var(--accent)',
                    fontFamily: 'var(--serif)'
                  }}
                >
                  <div style={{
                    fontSize: 16,
                    lineHeight: 1.45,
                    color: 'var(--ink-2)'
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
                        fontFamily: 'var(--sans)',
                        fontStyle: 'italic',
                        fontSize: 10,
                        letterSpacing: '0.14em',
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
      <div>
        <div className="label" style={{ fontSize: 11, marginBottom: 10 }}>
          Curated moments — click to add
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {moments.map((text, i) => {
            const key = `curated:${i}`
            const picked = isPicked(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => picked ? onUnpick(key) : onPick(key)}
                style={{
                  padding: '12px 16px',
                  background: picked ? 'var(--bg-2)' : 'var(--bg)',
                  border: `1px solid ${picked ? 'var(--accent)' : 'var(--rule-soft)'}`,
                  borderLeftWidth: picked ? 3 : 1,
                  fontFamily: 'var(--serif)',
                  fontSize: 16,
                  lineHeight: 1.45,
                  color: 'var(--ink-2)',
                  cursor: 'pointer',
                  transition: 'all .12s',
                  textAlign: 'left',
                  width: '100%',
                  display: 'flex',
                  gap: 14,
                  alignItems: 'center'
                }}
              >
                <span style={{
                  width: 18,
                  height: 18,
                  border: `1px solid ${picked ? 'var(--accent)' : 'var(--rule)'}`,
                  background: picked ? 'var(--accent)' : 'var(--bg-card)',
                  flexShrink: 0,
                  position: 'relative'
                }}>
                  {picked && (
                    <span style={{
                      position: 'absolute',
                      top: 1,
                      left: 4,
                      color: 'var(--bg-card)',
                      fontSize: 12,
                      fontFamily: 'var(--mono)'
                    }}>✓</span>
                  )}
                </span>
                <span>{text}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* --- Custom (write-your-own) ----------------------------- */}
      <div>
        <div className="label" style={{ fontSize: 11, marginBottom: 10 }}>
          Write your own
        </div>
        <CustomMomentInput onAdd={onAddCustom} />
        {customMoments.length > 0 && (
          <div style={{
            marginTop: 12,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 14,
            color: 'var(--ink-3)'
          }}>
            ({customMoments.length} custom moment{customMoments.length === 1 ? '' : 's'} authored — picked ones appear in your backstory above.)
          </div>
        )}
      </div>
    </div>
  )
}

function iconButtonStyle(disabled) {
  return {
    width: 28,
    height: 28,
    border: '1px solid var(--rule)',
    background: 'transparent',
    fontFamily: 'var(--sans)',
    fontSize: 12,
    color: disabled ? 'var(--ink-3)' : 'var(--ink-2)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
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
        className="input"
        placeholder="A formative moment in your own words…"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit() } }}
        style={{ flex: 1 }}
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
