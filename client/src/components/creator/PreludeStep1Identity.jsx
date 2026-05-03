import { Field, WizardHead } from './creatorPrimitives.jsx'

/**
 * Prelude Wizard Step 1 — Identity. Per the structural-redesign spec
 * (PM 2026-05-03): name fields + gender (M/F binary).
 *
 * Mirrors the primary creator's Step1Identity in primitive choice (Field
 * + .input + .chips) and visual rhythm. The prelude has no handoff mode
 * — it's the entry path INTO a character, not a resume from one — so
 * the use-name affordance and `locked` treatment from the primary
 * Step 1 don't apply here. Single-mode component.
 *
 * Gender is the one intentional content change from the legacy 11-question
 * wizard: female / male / non-binary / other(write your own) collapses
 * to Female / Male binary. Existing characters with non-binary/other
 * gender values are not a concern (clean slate confirmed in Phase 3
 * entry sequence). Server-side `preludeService.js::validate` accepts any
 * non-empty string, so the tightening is purely client-side.
 */
export default function PreludeStep1Identity({ state, set }) {
  return (
    <>
      <WizardHead
        stepNum={1}
        title="Identity"
        subtitle="A name and a gender — the two anchors the rest of the prelude references when it speaks about you as a child."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

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
            help="If you have one — what people called you informally as a child."
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

        <Field label="Gender">
          <div className="chips">
            {['Female', 'Male'].map(g => (
              <button
                key={g}
                type="button"
                className={`chip ${state.gender === g ? 'on' : ''}`}
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
