import { useState, useEffect } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'

/**
 * Step 1 — Identity. Per PHASE_2_CREATOR_SPEC.md §5.1.
 *
 * Manual mode: three name fields (First / Last / Nickname) + gender chips.
 * Handoff mode: name fields pre-fill from `payload.name_parts`; gender is
 * locked to `payload.gender`. Use-name affordance fires when
 * `payload.name !== payload.setup_name` — user resolves it before normal
 * fields render.
 *
 * Pronoun for the affordance: "she" / "he" by gender; "they" if gender
 * isn't selected (defensive — handoff has gender locked, but covers
 * manual-mode edge cases or missing data).
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
        title="Identity"
        subtitle="A name and a gender — the two anchors the rest of the creator references when it speaks about you."
        mode={mode}
      />

      {isHandoff && useNameDiffers && !usenameResolved && (
        <div className="usename">
          <div className="eyebrow" style={{ marginBottom: 14 }}>From the years that shaped you</div>
          <p>
            <strong>{setupName}</strong> was the name you began with. Through what you did, you came to be known as{' '}
            <strong>{useName}</strong>. How does {pronoun} carry forward?
          </p>
          <div className="actions">
            <button type="button" className="btn primary" onClick={() => onResolve('use')}>
              Keep "{useName}"
            </button>
            <button type="button" className="btn" onClick={() => onResolve('setup')}>
              Revert to "{setupName}"
            </button>
            <button type="button" className="btn" onClick={() => onResolve('new')}>
              Write something new
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="field-row three">
          <Field label="First name" help="Required.">
            <input
              type="text"
              className="input"
              value={state.first_name || ''}
              onChange={e => set({ ...state, first_name: e.target.value })}
              maxLength={64}
              placeholder="—"
            />
          </Field>
          <Field
            label="Last name"
            help="Some peoples don't use family surnames. Leave blank if that fits."
          >
            <input
              type="text"
              className="input"
              value={state.last_name || ''}
              onChange={e => set({ ...state, last_name: e.target.value })}
              maxLength={64}
              placeholder="—"
            />
          </Field>
          <Field
            label="Nickname"
            help="If you have one — what people call you informally."
          >
            <input
              type="text"
              className="input"
              value={state.nickname || ''}
              onChange={e => set({ ...state, nickname: e.target.value })}
              maxLength={32}
              placeholder="—"
            />
          </Field>
        </div>

        <Field
          label="Gender"
          locked={isHandoff}
          lockTag="From the setup wizard"
        >
          <div className="chips">
            {['Female', 'Male'].map(g => (
              <button
                key={g}
                type="button"
                className={`chip ${state.gender === g ? 'on' : ''}`}
                disabled={isHandoff}
                onClick={() => set({ ...state, gender: g })}
              >
                {g}
              </button>
            ))}
          </div>
        </Field>
      </div>
    </>
  )
}
