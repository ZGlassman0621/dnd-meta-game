import { useState } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import {
  BIRTH_CIRCUMSTANCES,
  HOME_SETTINGS,
  REGIONS,
  PARENT_ROLES,
  PARENT_STATUS,
  SIBLING_OPTIONS,
  AUTHORITY_FIGURES
} from '../../data/preludeSetup.js'

const ORIGIN_FREEFORM_MAX = 2000

/**
 * Prelude Wizard Step 6 — Review. Final step before submit.
 *
 * Shows a preview of the character + an editable section list with
 * "Edit" jump-back buttons (one per Step 1-5). Defensive end-to-end
 * validation surfaces any missing required fields (catches the case
 * where a player jumped backward via the Stepper, cleared a required
 * field, and jumped directly to Step 6 — bypassing per-step gates).
 *
 * Submit POSTs the payload to `/api/prelude/setup`, the existing
 * endpoint (unchanged contract). On success, calls `onPreludeCreated`
 * with the created character + `showArcPreview` flag — HomeFlow routes
 * the player to either PreludeArcPreview (testing) or PreludeSession
 * (production-feeling, dive straight in).
 *
 * Known temporary state: appearance fields (eye_color / hair_color /
 * skin_color / build / height / weight) are included in the submit
 * payload but the server's preludeService.js doesn't yet persist them
 * to the character row. The server reads what it knows and silently
 * drops the rest — no errors. Persistence + arc-prompt update for
 * appearance are part of the cutover work that lands once all 6 steps
 * are signed off (see structural-redesign memory entry).
 *
 * Single-mode component (no handoff fork — prelude is the entry path
 * INTO a character).
 */
export default function PreludeStep6Review({ state, set, onJump, onSubmit }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const errors = validateForSubmit(state)
  const canSubmit = errors.length === 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    setError('')
    try {
      await onSubmit()
      // onSubmit owns navigation; if it returns without throwing we're done
    } catch (e) {
      setError(e.message || 'Could not create character.')
      setSubmitting(false)
    }
  }

  const composedName = [state.first_name, state.last_name].filter(Boolean).join(' ').trim()
  const raceData = state.race ? racesData[state.race] : null

  return (
    <>
      <WizardHead
        stepNum={6}
        title="Review"
        subtitle="Look back at what you set down. Edit anything that doesn't sit right; submit when it does."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

      {/* End-to-end validation errors (defensive — per-step gates already
          catch most of these; this surfaces stragglers from stepper-jumps). */}
      {errors.length > 0 && (
        <div
          role="alert"
          style={{
            marginBottom: 24,
            padding: '14px 18px',
            background: 'var(--bg-2)',
            border: '1px solid var(--accent)',
            borderLeft: '3px solid var(--accent)',
            fontFamily: 'var(--serif)',
            color: 'var(--ink-2)'
          }}
        >
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--accent)',
            marginBottom: 10
          }}>
            Before you submit
          </div>
          <ul style={{ margin: 0, paddingLeft: 22, fontSize: 16, lineHeight: 1.55, fontStyle: 'italic' }}>
            {errors.map((err, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {err.message}{' '}
                <button
                  type="button"
                  onClick={() => onJump(err.step)}
                  style={{
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    color: 'var(--accent)',
                    fontFamily: 'var(--sans)',
                    fontSize: 12,
                    fontStyle: 'normal',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    marginLeft: 6
                  }}
                >
                  Edit Step {err.step + 1} →
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Character preview */}
      <div className="card">
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 16,
          paddingBottom: 16,
          borderBottom: '1px solid var(--rule)',
          marginBottom: 18
        }}>
          <div>
            <h2 className="h-section" style={{ marginBottom: 2 }}>
              {composedName || '(unnamed)'}
            </h2>
            {state.nickname && (
              <p style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink-3)',
                margin: 0
              }}>
                "{state.nickname}"
              </p>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 11,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)'
          }}>
            {[state.gender, raceData?.name, state.subrace].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>

        <PreviewSection label="Origin">
          <PreviewLine
            keyLabel="Born"
            value={resolveLabel(BIRTH_CIRCUMSTANCES, state.birth_circumstance, state.birth_circumstance_other)}
          />
          <PreviewLine
            keyLabel="Home"
            value={resolveLabel(HOME_SETTINGS, state.home_setting, state.home_setting_other)}
          />
          <PreviewLine
            keyLabel="Region"
            value={resolveLabel(REGIONS, state.region, state.region_other)}
          />
        </PreviewSection>

        <PreviewSection label="Family & Influence">
          <PreviewLine keyLabel="Parents" value={describeParents(state.parents)} />
          <PreviewLine
            keyLabel="Siblings"
            value={SIBLING_OPTIONS.find(s => s.value === state.siblings)?.label || '—'}
          />
          <PreviewLine
            keyLabel="Authority"
            value={AUTHORITY_FIGURES.find(a => a.value === state.authority_figure)?.label || '—'}
          />
        </PreviewSection>

        {hasAnyAppearance(state.appearance) && (
          <PreviewSection label="Appearance">
            {state.appearance?.eye_color && <PreviewLine keyLabel="Eyes" value={state.appearance.eye_color} />}
            {state.appearance?.hair_color && <PreviewLine keyLabel="Hair" value={state.appearance.hair_color} />}
            {state.appearance?.skin_color && <PreviewLine keyLabel="Skin" value={state.appearance.skin_color} />}
            {state.appearance?.build && <PreviewLine keyLabel="Build" value={state.appearance.build} />}
          </PreviewSection>
        )}

        {state.origin_freeform && state.origin_freeform.trim() && (
          <PreviewSection label="Anything else">
            <p style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              margin: 0,
              whiteSpace: 'pre-wrap'
            }}>
              {state.origin_freeform}
            </p>
          </PreviewSection>
        )}
      </div>

      {/* Section jump-list — quick edit access without scrolling/stepper */}
      <div className="card" style={{ marginTop: 18 }}>
        <div className="label" style={{ marginBottom: 14 }}>Edit any step</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <SectionJumpRow stepIdx={0} label="Identity" detail="Name, nickname, gender" onJump={onJump} />
          <SectionJumpRow stepIdx={1} label="Ancestry" detail="Race, subrace" onJump={onJump} />
          <SectionJumpRow stepIdx={2} label="Origin" detail="Birth circumstance, home, region" onJump={onJump} />
          <SectionJumpRow stepIdx={3} label="Family & Influence" detail="Parents, siblings, authority figure" onJump={onJump} />
          <SectionJumpRow stepIdx={4} label="Appearance" detail="Physical description, anything else" onJump={onJump} isLast />
        </div>
      </div>

      {/* Testing toggle — preserved from the legacy wizard. Default ON for
          play-testing the arc output; flip OFF for the production-feeling
          flow that dives straight into the first scene. */}
      <div
        className="card"
        style={{
          marginTop: 18,
          background: 'var(--bg-2)',
          borderStyle: 'dashed'
        }}
      >
        <Field
          label="Show the arc preview (testing)"
          help="When checked: after submitting, you'll see the Opus-generated arc plan before gameplay starts. Useful for testing that the arc respects your setup. Uncheck to dive straight into the first scene — that's how a regular play session works."
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              fontFamily: 'var(--serif)',
              fontSize: 17,
              color: 'var(--ink-2)'
            }}
          >
            <input
              type="checkbox"
              checked={state.show_arc_preview ?? true}
              onChange={e => set({ ...state, show_arc_preview: e.target.checked })}
              style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
            />
            <span>
              {(state.show_arc_preview ?? true)
                ? 'Arc preview will show before gameplay'
                : 'Skip preview — go straight into the first scene'}
            </span>
          </label>
        </Field>
      </div>

      {/* Submit error surface */}
      {error && (
        <div
          role="alert"
          style={{
            marginTop: 18,
            padding: '14px 18px',
            background: 'var(--bg-2)',
            border: '1px solid var(--accent)',
            borderLeft: '3px solid var(--accent)',
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--ink-2)'
          }}
        >
          {error}
        </div>
      )}

      {/* Submit button — primary CTA, lives inside Step 6 (matches primary
          creator's pattern where Step 8 owns its own Submit). The wizard
          shell's WizardFoot for Step 6 only carries Back + Save-and-exit. */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 32
      }}>
        <button
          type="button"
          className="btn primary lg"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? 'Creating…' : 'Begin the Prelude →'}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Section header inside the preview card.
 */
function PreviewSection({ label, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontFamily: 'var(--sans)',
        fontSize: 11,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--ink-3)',
        marginBottom: 8,
        fontWeight: 500
      }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}

/**
 * Single labeled key/value line inside a preview section.
 */
function PreviewLine({ keyLabel, value }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '120px 1fr',
      gap: 12,
      marginBottom: 4,
      fontFamily: 'var(--serif)',
      fontSize: 16,
      lineHeight: 1.5,
      color: 'var(--ink-2)'
    }}>
      <div style={{ color: 'var(--ink-3)' }}>{keyLabel}</div>
      <div>{value || '—'}</div>
    </div>
  )
}

/**
 * One row in the "Edit any step" section list.
 */
function SectionJumpRow({ stepIdx, label, detail, onJump, isLast }) {
  return (
    <button
      type="button"
      onClick={() => onJump(stepIdx)}
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'baseline',
        padding: '12px 0',
        background: 'transparent',
        border: 0,
        borderBottom: isLast ? 'none' : '1px solid var(--rule-soft)',
        textAlign: 'left',
        cursor: 'pointer',
        fontFamily: 'var(--serif)',
        color: 'var(--ink-2)'
      }}
    >
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: 12,
        color: 'var(--ink-3)',
        letterSpacing: '0.06em'
      }}>
        {String(stepIdx + 1).padStart(2, '0')}
      </span>
      <span>
        <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{label}</span>
        <span style={{
          color: 'var(--ink-3)',
          fontStyle: 'italic',
          marginLeft: 10,
          fontSize: 15
        }}>
          {detail}
        </span>
      </span>
      <span style={{
        fontFamily: 'var(--sans)',
        fontSize: 11,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: 'var(--accent)',
        fontWeight: 600
      }}>
        Edit →
      </span>
    </button>
  )
}

/**
 * End-to-end validation. Defensive — surfaces issues that bypassed the
 * per-step canAdvance gates (e.g., player jumped via Stepper to an
 * earlier step, cleared a required field, then jumped to Step 6).
 *
 * Returns array of `{ step, message }` for any missing required fields;
 * empty array means submit-ready.
 */
function validateForSubmit(state) {
  const errors = []
  const hasName = Boolean((state.first_name || '').trim() || (state.last_name || '').trim())
  if (!hasName) errors.push({ step: 0, message: 'Character needs at least a first or last name.' })
  if (!state.gender) errors.push({ step: 0, message: 'Gender is required.' })
  if (!state.race) errors.push({ step: 1, message: 'Race is required.' })
  if (state.race) {
    const raceData = racesData[state.race]
    if (raceData?.subraces?.length > 0 && !state.subrace) {
      errors.push({ step: 1, message: 'Subrace is required for this race.' })
    }
  }
  const filled = (curated, other) => Boolean(curated || (other || '').trim())
  if (!filled(state.birth_circumstance, state.birth_circumstance_other)) {
    errors.push({ step: 2, message: 'Birth circumstance is required.' })
  }
  if (!filled(state.home_setting, state.home_setting_other)) {
    errors.push({ step: 2, message: 'Home setting is required.' })
  }
  if (!filled(state.region, state.region_other)) {
    errors.push({ step: 2, message: 'Region is required.' })
  }
  if (!state.siblings) errors.push({ step: 3, message: 'Sibling configuration is required.' })
  if (!state.authority_figure) errors.push({ step: 3, message: 'Authority figure is required.' })
  if (state.siblings === 'only_child' && state.authority_figure === 'sibling') {
    errors.push({ step: 3, message: 'You said "Only child" — pick a different authority figure, or change your sibling answer.' })
  }
  const len = (state.origin_freeform || '').length
  if (len > ORIGIN_FREEFORM_MAX) {
    errors.push({ step: 4, message: `"Anything else?" exceeds the ${ORIGIN_FREEFORM_MAX}-character limit.` })
  }
  return errors
}

/**
 * Resolve the display label for a curated/override field pair. The
 * server's resolved() helper picks override over curated when both are
 * present; mirror that here for review-screen accuracy.
 */
function resolveLabel(options, curatedValue, overrideValue) {
  const override = (overrideValue || '').trim()
  if (override) return override
  return options.find(o => o.value === curatedValue)?.label || '—'
}

/**
 * Compose a human-readable parents summary for the preview card.
 * Filters out empty slots; matches the server-side parents resolver
 * shape so what you see here is what gets persisted.
 */
function describeParents(parents) {
  if (!Array.isArray(parents)) return '—'
  const filled = parents.filter(p => p?.status && (p?.name?.trim() || p?.status !== 'present'))
  if (filled.length === 0) return 'Unknown / a guardian'
  return filled.map(p => {
    const role = PARENT_ROLES.find(r => r.value === p.role)?.label || p.role || 'parent'
    const name = (p.name || '').trim() || '(unnamed)'
    const status = PARENT_STATUS.find(s => s.value === p.status)?.label || p.status || 'present'
    return `${role}: ${name} (${status.toLowerCase()})`
  }).join('; ')
}

function hasAnyAppearance(appearance) {
  if (!appearance) return false
  return Boolean(
    appearance.eye_color ||
    appearance.hair_color ||
    appearance.skin_color ||
    appearance.build
  )
}
