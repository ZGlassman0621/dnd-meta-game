import racesData from '../../data/races.json'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import {
  PARENT_ROLES,
  PARENT_STATUS,
  SIBLING_OPTIONS,
  AUTHORITY_FIGURES
} from '../../data/preludeSetup.js'

/**
 * Prelude Wizard Step 4 — Family & Influence. Per the structural-redesign
 * spec (PM 2026-05-03): parents sub-form + siblings dropdown + authority
 * figure card-list. All three sections preserved verbatim from the legacy
 * 11-question wizard (Q7 / Q8 / Q9).
 *
 * Authority-figure card-list pattern reuses the v1.0.124 reskin treatment
 * (signed off): button-styled cards with editorial accent on the picked
 * entry (left-border + bg-2). PM called out this design-judgment piece
 * specifically as reading correctly.
 *
 * Sibling/authority contradiction (only_child + sibling-as-authority)
 * surfaces as an inline help-style warning AND blocks Continue. Same
 * incoherence guard the legacy wizard's validate() enforced.
 *
 * Single-mode component (no handoff fork).
 */
export default function PreludeStep4Family({ state, set }) {
  const raceKeys = Object.keys(racesData)
  const contradiction = state.siblings === 'only_child' && state.authority_figure === 'sibling'

  const updateParent = (i, patch) => {
    const next = [...(state.parents || [])]
    next[i] = { ...next[i], ...patch }
    set({ ...state, parents: next })
  }

  return (
    <>
      <WizardHead
        stepNum={4}
        title="Family & Influence"
        subtitle="Who shaped you. The people who raised you, the family you grew up around, and the one adult presence that loomed largest in your earliest years."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

      {/* Parents / guardians */}
      <div className="card">
        <Field
          label="Parents / guardians"
          help="Up to two parents or guardians. Pick who each one is to you, their race, their name, and whether they're present / distant / gone. Race defaults to yours; change it for mixed-race or foundling families."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {(state.parents || []).map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1.4fr 1fr',
                  gap: 12
                }}
              >
                <select
                  className="select"
                  value={p.role || ''}
                  onChange={e => updateParent(i, { role: e.target.value })}
                >
                  {PARENT_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
                <select
                  className="select"
                  value={p.race || ''}
                  onChange={e => updateParent(i, { race: e.target.value })}
                  title="Defaults to player's race if left blank"
                >
                  <option value="">(same as you)</option>
                  {raceKeys.map(k => (
                    <option key={k} value={k}>{racesData[k].name}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="input"
                  value={p.name || ''}
                  onChange={e => updateParent(i, { name: e.target.value })}
                  placeholder="Name (blank = unknown)"
                />
                <select
                  className="select"
                  value={p.status || ''}
                  onChange={e => updateParent(i, { status: e.target.value })}
                >
                  {PARENT_STATUS.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          {PARENT_STATUS.find(s => s.value === state.parents?.[0]?.status)?.description && (
            <p className="help" style={{ marginTop: 12 }}>
              {PARENT_STATUS.find(s => s.value === state.parents[0].status).description}
            </p>
          )}
        </Field>
      </div>

      {/* Siblings */}
      <div className="card" style={{ marginTop: 18 }}>
        <Field
          label="Siblings"
          help="If your character had something more specific — adopted siblings, half-siblings from a different family, etc. — you can describe it on Step 5 (Anything else?)."
        >
          <select
            className="select"
            value={state.siblings || ''}
            onChange={e => set({ ...state, siblings: e.target.value })}
          >
            <option value="">Select sibling configuration…</option>
            {SIBLING_OPTIONS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* Authority figure — card-list pattern, signed off in v1.0.124 reskin */}
      <div className="card" style={{ marginTop: 18 }}>
        <Field
          label="Who looms largest in your early life?"
          help="The dominant adult presence — not necessarily the one who loved you most, but the one whose attention shaped you most. The arc will give this person real weight in the story."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {AUTHORITY_FIGURES.map(opt => {
              const picked = state.authority_figure === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set({ ...state, authority_figure: opt.value })}
                  style={{
                    textAlign: 'left',
                    padding: '14px 18px',
                    background: picked ? 'var(--bg-2)' : 'var(--bg-card)',
                    border: `1px solid ${picked ? 'var(--accent)' : 'var(--rule)'}`,
                    borderLeft: `3px solid ${picked ? 'var(--accent)' : 'var(--rule)'}`,
                    borderRadius: 0,
                    cursor: 'pointer',
                    fontFamily: 'var(--serif)',
                    transition: 'border-color .12s, background .12s'
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--sans)',
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    color: picked ? 'var(--ink)' : 'var(--ink-2)',
                    marginBottom: 4
                  }}>
                    {opt.label}
                  </div>
                  <div style={{
                    fontFamily: 'var(--serif)',
                    fontStyle: 'italic',
                    fontSize: 15,
                    lineHeight: 1.45,
                    color: 'var(--ink-3)'
                  }}>
                    {opt.description}
                  </div>
                </button>
              )
            })}
          </div>
          {contradiction && (
            <p className="help" style={{ marginTop: 12, color: 'var(--accent)' }}>
              You said "Only child" above — pick a different authority here, or change your sibling answer.
            </p>
          )}
        </Field>
      </div>
    </>
  )
}
