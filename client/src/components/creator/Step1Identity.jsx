import { useState, useEffect } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'

/**
 * Step 1 — Identity. Per PHASE_2_CREATOR_SPEC.md §5.1.
 *
 * Manual mode: three name fields (First / Last / Nickname) + gender pills.
 * Handoff mode: name fields pre-fill from `payload.name_parts`; gender is
 * locked to `payload.gender`. Use-name affordance fires when
 * `payload.name !== payload.setup_name` — user resolves it before normal
 * fields render.
 *
 * Pronoun for the affordance: "she" / "he" by gender; "they" if gender
 * isn't selected (defensive — handoff has gender locked, but covers
 * manual-mode edge cases or missing data).
 *
 * HEARTH render: step header via WizardHead (.step-eyebrow + h1 +
 * .subtitle); each name as a .field (.fl + .finput + .fhelp); gender as a
 * .pillrow of .selpill (.on = selected). Locked gender + the use-name
 * affordance reuse the .lock-cele celebration card from the design system.
 */
export default function Step1Identity({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  // Use-name affordance is fired when handoff payload has a different
  // effective name than the original setup name. Local-session-scoped:
  // once the player resolves it, it doesn't re-fire on Step 1 returns.
  const setupName = (payload?.setup_name || '').trim()
  const useName = (payload?.name || '').trim()
  const useNameDiffers = isHandoff && setupName && useName && useName !== setupName

  const [usenameResolved, setUsenameResolved] = useState(!useNameDiffers)

  // Reset the affordance gate whenever the payload's name pair changes
  // (resume-from-saved with new payload; rare but defensive).
  useEffect(() => {
    setUsenameResolved(!useNameDiffers)
  }, [setupName, useName, useNameDiffers])

  const splitName = (full) => {
    const parts = (full || '').trim().split(/\s+/)
    if (parts.length === 0 || !parts[0]) return { first: '', last: '' }
    if (parts.length === 1) return { first: parts[0], last: '' }
    return { first: parts[0], last: parts.slice(1).join(' ') }
  }

  const onResolve = (which) => {
    if (which === 'use') {
      const { first, last } = splitName(useName)
      set({ ...state, first_name: first, last_name: last })
    } else if (which === 'setup') {
      const { first, last } = splitName(setupName)
      set({ ...state, first_name: first, last_name: last })
    } else {
      // 'new' — render blank fields
      set({ ...state, first_name: '', last_name: '' })
    }
    setUsenameResolved(true)
  }

  const pronoun = state.gender === 'Female' ? 'she' : state.gender === 'Male' ? 'he' : 'they'

  return (
    <>
      <WizardHead
        stepNum={1}
        title="Who are they?"
        subtitle="A name and a gender — the two anchors the rest of the creator will return to."
        mode={mode}
      />

      {isHandoff && useNameDiffers && !usenameResolved && (
        <div className="lock-cele" style={{ marginBottom: 26 }}>
          <div className="lc-top">
            <span className="lc-fleuron">❦</span>
            <span className="lc-marker">From the years that shaped you</span>
          </div>
          <p className="lc-note" style={{ marginBottom: 16 }}>
            <strong>{setupName}</strong> was the name you began with. Through what you did, you came to be known as{' '}
            <strong>{useName}</strong>. How does {pronoun} carry forward?
          </p>
          <div className="pillrow">
            <button type="button" className="btn primary" onClick={() => onResolve('use')}>
              Keep "{useName}"
            </button>
            <button type="button" className="btn ghost" onClick={() => onResolve('setup')}>
              Revert to "{setupName}"
            </button>
            <button type="button" className="btn ghost" onClick={() => onResolve('new')}>
              Write something new
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 18 }}>
        <div className="field">
          <label className="fl" htmlFor="s1-first">First name</label>
          <input
            id="s1-first"
            type="text"
            className="finput"
            value={state.first_name || ''}
            onChange={e => set({ ...state, first_name: e.target.value })}
            maxLength={64}
            placeholder="What are they called?"
          />
          <div className="fhelp">Required.</div>
        </div>

        <div className="field">
          <label className="fl" htmlFor="s1-last">Last name</label>
          <input
            id="s1-last"
            type="text"
            className="finput"
            value={state.last_name || ''}
            onChange={e => set({ ...state, last_name: e.target.value })}
            maxLength={64}
            placeholder="—"
          />
          <div className="fhelp">Some peoples don't use family surnames. Leave blank if that fits.</div>
        </div>

        <div className="field">
          <label className="fl" htmlFor="s1-nick">Nickname</label>
          <input
            id="s1-nick"
            type="text"
            className="finput"
            value={state.nickname || ''}
            onChange={e => set({ ...state, nickname: e.target.value })}
            maxLength={32}
            placeholder="—"
          />
          <div className="fhelp">If you have one — what people call you informally.</div>
        </div>
      </div>

      {isHandoff ? (
        <div className="field">
          <span className="fl">Gender</span>
          <div className="lock-cele">
            <div className="lc-top">
              <span className="lc-fleuron">❦</span>
              <span className="lc-marker">From the setup wizard</span>
              <span className="lc-lock">
                <svg className="ic" aria-hidden="true"><use href="#i-lock" /></svg>
                Locked
              </span>
            </div>
            <div className="lc-value">{state.gender || '—'}</div>
            <div className="lc-note">Set when you first imagined them — it carries here unchanged.</div>
          </div>
        </div>
      ) : (
        <div className="field">
          <span className="fl">Gender</span>
          <div className="pillrow">
            {['Female', 'Male'].map(g => (
              <button
                key={g}
                type="button"
                className={`selpill ${state.gender === g ? 'on' : ''}`.trim()}
                onClick={() => set({ ...state, gender: g })}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
