import { useState, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import classesData from '../../data/classes.json'
import { THEME_GOLD_MODIFIERS, applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { ALIGNMENT_NAMES } from './AlignmentChip.jsx'
import { ABILITY_KEYS, ABILITY_LABELS } from './BumpCelebrationCard.jsx'

/**
 * Step 8 — Review. Per PHASE_2_CREATOR_SPEC.md §5.8.
 *
 * Two stacked components:
 *   1. Preview card — read-only character-sheet shape; shows the
 *      assembled character at a glance.
 *   2. Editable summary list — section-grouped with per-section "Edit"
 *      affordances that jump back to the corresponding step (state
 *      preserved across all other steps; player advances forward to
 *      return to Submit).
 *
 * Submit branches on creation_phase (§8.2.2 / §8.2.3):
 *   - Manual ('creating' → 'active'): POST /api/character (or PUT to
 *     update the existing 'creating' row); flip to 'active'; new
 *     primary campaign with no Prelude inputs.
 *   - Handoff ('ready_for_primary' → 'active'): PUT /api/character/{id};
 *     flip to 'active'; canon transfer (NPCs / locations / threads);
 *     mentor imprint when applicable; new primary campaign with Prelude
 *     inputs.
 *
 * Handoff mode adds a brief in-fiction callout above the preview card
 * per §5.8.5: "The years that shaped you are behind you now. Step
 * forward."
 */
export default function Step8Review({ state, mode, payload, onJump, onSubmit, characterId }) {
  const isHandoff = mode === 'handoff'
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Validate every required field across Steps 1-7 before allowing
  // Submit. Surfaces step-specific errors per §5.8.7.
  const validation = useMemo(() => validateForSubmit(state, isHandoff, payload), [state, isHandoff, payload])

  const submit = async () => {
    if (!validation.valid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit()
    } catch (err) {
      setSubmitError(err.message || 'Submit failed.')
      setSubmitting(false)
    }
  }

  return (
    <>
      <WizardHead
        stepNum={8}
        title="Review"
        subtitle="Everything that's been chosen sits here. Edit any section if needed; commit when you're ready."
        mode={mode}
      />

      {/* Handoff callout — single line, above the preview card */}
      {isHandoff && (
        <div style={{
          marginBottom: 32,
          padding: '26px 32px',
          background: 'var(--bg)',
          borderTop: '1px solid var(--accent)',
          borderBottom: '1px solid var(--accent)',
          textAlign: 'center'
        }}>
          <p style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 22,
            lineHeight: 1.4,
            color: 'var(--ink)',
            margin: 0
          }}>
            The years that shaped you are behind you now. Step forward.
          </p>
        </div>
      )}

      {/* Preview card */}
      <PreviewCard state={state} payload={payload} />

      {/* Editable summary list */}
      <div style={{ marginTop: 36 }}>
        <SummaryList state={state} payload={payload} onJump={onJump} />
      </div>

      {/* Validation warnings */}
      {!validation.valid && (
        <div style={{
          marginTop: 24,
          padding: '16px 20px',
          background: 'var(--bg-2)',
          border: '1px solid var(--accent)',
          borderLeft: '3px solid var(--accent)'
        }}>
          <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--accent)' }}>
            Before you can step forward
          </div>
          <ul style={{ margin: 0, paddingLeft: 20, fontFamily: 'var(--serif)', fontSize: 16, color: 'var(--ink-2)' }}>
            {validation.errors.map((e, i) => (
              <li key={i} style={{ marginBottom: 6 }}>
                {e.message}
                {e.step && (
                  <button
                    type="button"
                    onClick={() => onJump(e.step - 1)}
                    style={{
                      marginLeft: 8,
                      background: 'transparent',
                      border: 0,
                      padding: 0,
                      color: 'var(--accent)',
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      cursor: 'pointer'
                    }}
                  >
                    Edit Step {e.step}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div style={{
          marginTop: 16,
          padding: '12px 16px',
          background: 'rgba(231, 76, 60, 0.08)',
          border: '1px solid #e74c3c',
          color: '#c0392b',
          fontFamily: 'var(--serif)',
          fontSize: 15
        }}>
          Couldn't submit: {submitError}
        </div>
      )}

      {/* Submit affordance — also rendered in WizardFoot, but a primary
          surface here gives Step 8 a clear bottom-of-page CTA.            */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <button
          type="button"
          className="btn primary lg"
          onClick={submit}
          disabled={!validation.valid || submitting}
          style={{ minWidth: 280 }}
        >
          {submitting
            ? 'Stepping forward…'
            : isHandoff
              ? 'Step into the world'
              : 'Create character'}
        </button>
      </div>
    </>
  )
}

/**
 * Read-only preview card — character-sheet-shaped summary of the
 * assembled character. Shows the load-bearing fields; deeper expansions
 * surface as collapsed-by-default text below.
 */
function PreviewCard({ state, payload }) {
  const cls = classesData[state.class_id]
  const raceData = racesData[state.race]
  const subraceData = (raceData?.subraces || []).find(s => s.name === state.subrace)
  const themeId = state.theme_id || payload?.committed_theme

  const finalScores = useMemo(() => {
    const out = {}
    for (const k of ABILITY_KEYS) {
      const base = state.base_scores?.[k] ?? 0
      const racialStatic = (raceData?.abilityScoreIncrease?.[k] ?? 0) +
                           (subraceData?.abilityScoreIncrease?.[k] ?? 0)
      const racialChoice = (state.racial_choice_picks || []).filter(p => p === k).length
      const bumpTotal = (state.bump_assignments || []).reduce((sum, stat, i) => {
        if (stat !== k) return sum
        const b = (payload?.accepted_stat_bumps || [])[i]
        return sum + (b?.magnitude || 1)
      }, 0)
      out[k] = Math.min(18, base + racialStatic + racialChoice + bumpTotal)
    }
    return out
  }, [state, raceData, subraceData, payload])

  const fullName = [state.first_name, state.last_name].filter(Boolean).join(' ') || '—'
  const subraceLabel = state.subrace || ''
  const raceLabel = subraceLabel
    ? (subraceLabel.includes(raceData?.name) ? subraceLabel : `${subraceLabel} ${raceData?.name || ''}`).trim()
    : (raceData?.name || '—')

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--rule)',
      boxShadow: 'var(--shadow-card)'
    }}>
      {/* --- Head: name + race / theme / class line ----------- */}
      <div style={{
        padding: '36px 40px 28px',
        borderBottom: '1px solid var(--rule)'
      }}>
        <h2 style={{
          fontFamily: 'var(--serif)',
          fontSize: 42,
          lineHeight: 1.05,
          letterSpacing: '-0.01em',
          margin: 0,
          color: 'var(--ink)'
        }}>
          {fullName}
          {state.nickname && (
            <span style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 22,
              color: 'var(--ink-3)',
              marginLeft: 14
            }}>
              "{state.nickname}"
            </span>
          )}
        </h2>
        <div style={{
          fontFamily: 'var(--serif)',
          fontStyle: 'italic',
          fontSize: 18,
          color: 'var(--ink-2)',
          marginTop: 10
        }}>
          {/* Per PM review feedback: order is Race - Subrace - Gender -
              Theme - Class - Level. Race + Subrace render as separate
              segments when subrace exists; otherwise just Race. Class
              line includes subclass parenthetical when picked at L1. */}
          {[
            raceData?.name || (state.race && prettifyId(state.race)),
            state.subrace || null,
            state.gender,
            themeId ? prettifyId(themeId) : null,
            cls ? `${cls.name}${state.subclass_id ? ` (${prettifyId(state.subclass_id)})` : ''}` : null,
            'Level 1'
          ].filter(Boolean).join(' · ')}
        </div>
      </div>

      {/* --- Ability scores grid ----------------------------- */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        borderBottom: '1px solid var(--rule)'
      }}>
        {ABILITY_KEYS.map(k => (
          <div key={k} style={{
            textAlign: 'center',
            padding: '18px 0',
            borderRight: k !== 'cha' ? '1px solid var(--rule-soft)' : 'none'
          }}>
            <div className="label" style={{ fontSize: 10 }}>{ABILITY_LABELS[k]}</div>
            <div style={{
              fontFamily: 'var(--mono)',
              fontSize: 28,
              fontWeight: 500,
              color: 'var(--ink)',
              marginTop: 4
            }}>
              {finalScores[k] || '—'}
            </div>
            {finalScores[k] > 0 && (
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--ink-3)',
                marginTop: 2
              }}>
                {modString(finalScores[k])}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- Sections (alignment / faith / lifestyle / etc.) -- */}
      <SheetSection heading="Alignment & faith" content={
        <>
          <div>{ALIGNMENT_NAMES[state.identity?.alignment] || <Quiet>Not yet chosen</Quiet>}</div>
          <div>{prettyFaith(state.identity?.faith) || <Quiet>Not yet chosen</Quiet>}</div>
          <div>{state.identity?.lifestyle || <Quiet>Lifestyle not yet chosen</Quiet>}</div>
        </>
      } />

      <SheetSection heading="Appearance" content={
        <>
          <div>
            {[state.identity?.age && `Age ${state.identity.age}`,
              state.identity?.height,
              state.identity?.weight].filter(Boolean).join(' · ') || <Quiet>Not yet described</Quiet>}
          </div>
          <div>
            {[state.identity?.eye_color && `${state.identity.eye_color} eyes`,
              state.identity?.hair_color && `${state.identity.hair_color} hair`,
              state.identity?.skin_color && `${state.identity.skin_color} skin`,
              state.identity?.build && state.identity.build].filter(Boolean).join(', ') || null}
          </div>
          {state.identity?.distinguishing_features && (
            <div style={{ marginTop: 6, fontStyle: 'italic', color: 'var(--ink-2)' }}>
              {state.identity.distinguishing_features}
            </div>
          )}
        </>
      } />

      {hasAnyExpansion(state.expansions) && (
        <SheetSection heading="Inner life" content={
          <>
            {expansionLine('Personality', state.expansions?.personality?.value)}
            {expansionLine('Ideals', state.expansions?.ideals?.value)}
            {expansionLine('Bonds', state.expansions?.bonds?.value)}
            {expansionLine('Flaws', state.expansions?.flaws?.value)}
          </>
        } />
      )}
    </div>
  )
}

function SheetSection({ heading, content }) {
  return (
    <div style={{
      padding: '24px 40px',
      borderBottom: '1px solid var(--rule-soft)',
      display: 'grid',
      gridTemplateColumns: '160px 1fr',
      gap: 24,
      alignItems: 'start'
    }}>
      <div className="label" style={{ paddingTop: 4 }}>{heading}</div>
      <div style={{
        fontFamily: 'var(--serif)',
        fontSize: 17,
        lineHeight: 1.55,
        color: 'var(--ink)'
      }}>
        {content}
      </div>
    </div>
  )
}

function Quiet({ children }) {
  return <span style={{ color: 'var(--ink-3)', fontStyle: 'italic' }}>{children}</span>
}

function expansionLine(label, value) {
  if (!value || !value.trim()) return null
  return (
    <div style={{ marginBottom: 6 }}>
      <strong style={{ fontWeight: 600 }}>{label}.</strong> {value}
    </div>
  )
}

/**
 * Editable summary list — section-grouped with per-section "Edit"
 * affordances that jump back to the corresponding step (1-indexed in
 * copy; 0-indexed in onJump callback).
 */
function SummaryList({ state, payload, onJump }) {
  const sections = [
    {
      step: 1,
      label: 'Identity',
      content: [
        state.first_name ? `${state.first_name} ${state.last_name || ''}`.trim() : null,
        state.nickname ? `"${state.nickname}"` : null,
        state.gender
      ].filter(Boolean).join(' · ') || 'Not yet filled'
    },
    {
      step: 2,
      label: 'Ancestry',
      content: [
        state.race && prettifyId(state.race),
        state.subrace,
        state.ancestry_feat_id && `feat: ${state.ancestry_feat_id}`
      ].filter(Boolean).join(' · ') || 'Not yet filled'
    },
    {
      step: 3,
      label: 'Theme',
      content: state.theme_id ? prettifyId(state.theme_id) : 'Not yet chosen'
    },
    {
      step: 4,
      label: 'Class & Calling',
      content: [
        state.class_id && prettifyId(state.class_id),
        state.subclass_id && `subclass: ${prettifyId(state.subclass_id)}`,
        state.fighting_style && `fighting style: ${state.fighting_style}`
      ].filter(Boolean).join(' · ') || 'Not yet chosen'
    },
    {
      step: 5,
      label: 'Ability Scores & Skills',
      content: (() => {
        const baseSet = ABILITY_KEYS.filter(k => state.base_scores?.[k] != null)
        if (baseSet.length === 0) return 'Not yet assigned'
        return `${baseSet.length}/6 assigned · ${(state.selected_skills || []).length} additional skill picks`
      })()
    },
    {
      step: 6,
      label: 'Equipment',
      content: (() => {
        const picks = state.equipment_picks || {}
        const pickCount = Object.values(picks).filter(Boolean).length
        const heirloom = state.heirloom?.name
        return [
          pickCount > 0 ? `${pickCount} package choices` : 'Not yet picked',
          heirloom && `Heirloom: ${heirloom}`
        ].filter(Boolean).join(' · ')
      })()
    },
    {
      step: 7,
      label: 'Identity Details',
      content: (() => {
        const i = state.identity || {}
        const filled = ['alignment', 'faith', 'lifestyle', 'age', 'height', 'eye_color', 'hair_color']
          .filter(k => i[k]).length
        return filled === 0 ? 'Not yet filled' : `${filled} core fields · ${countExpansions(state.expansions)} expansions`
      })()
    }
  ]

  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 14 }}>Edit a section</div>
      {sections.map(s => (
        <div
          key={s.step}
          style={{
            display: 'grid',
            gridTemplateColumns: '60px 1fr 90px',
            gap: 16,
            alignItems: 'baseline',
            padding: '14px 0',
            borderBottom: '1px solid var(--rule-soft)'
          }}
        >
          <div className="label" style={{ fontSize: 11 }}>0{s.step}</div>
          <div style={{ fontFamily: 'var(--serif)', fontSize: 17, color: 'var(--ink)' }}>
            <div style={{ fontWeight: 500 }}>{s.label}</div>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 15, color: 'var(--ink-3)', marginTop: 2 }}>
              {s.content}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onJump(s.step - 1)}
            style={{
              background: 'transparent',
              border: 0,
              padding: 0,
              fontFamily: 'var(--sans)',
              fontSize: 11,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              cursor: 'pointer',
              textAlign: 'right'
            }}
          >
            Edit →
          </button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prettifyId(id) {
  return String(id || '').split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function modString(score) {
  const m = Math.floor((score - 10) / 2)
  return m >= 0 ? `+${m}` : `${m}`
}

function prettyFaith(faithId) {
  if (!faithId || faithId === '_none') return faithId === '_none' ? 'None / Unaligned' : null
  // We'd lookup against deitiesData here, but the Sheet section can also just
  // surface the raw id for this preview pass — Step 7 keeps the full name in
  // its own select. Pretty-format the id so it's readable.
  return prettifyId(faithId)
}

function hasAnyExpansion(expansions) {
  if (!expansions) return false
  for (const k of ['personality', 'ideals', 'bonds', 'flaws']) {
    if ((expansions[k]?.value || '').trim()) return true
  }
  return false
}

function countExpansions(expansions) {
  if (!expansions) return 0
  let n = 0
  for (const k of ['personality', 'ideals', 'bonds', 'flaws']) {
    if ((expansions[k]?.value || '').trim()) n++
  }
  if ((expansions.backstory?.picked_keys || []).length > 0) n++
  return n
}

/**
 * Validate every required field across Steps 1–7 per spec §5.8.7.
 * Returns { valid, errors: [{ step, message }] }.
 */
function validateForSubmit(state, isHandoff, payload) {
  const errors = []

  // Step 1
  if (!(state.first_name || '').trim()) errors.push({ step: 1, message: 'First name is required.' })
  if (!state.gender) errors.push({ step: 1, message: 'Gender is required.' })

  // Step 2
  if (!state.race) errors.push({ step: 2, message: 'Race is required.' })
  if (!state.ancestry_feat_id) errors.push({ step: 2, message: 'Ancestry feat is required.' })

  // Step 3
  if (!state.theme_id) errors.push({ step: 3, message: 'Theme is required.' })

  // Step 4
  if (!state.class_id) errors.push({ step: 4, message: 'Class is required.' })

  // Step 5
  const allAssigned = ABILITY_KEYS.every(k => state.base_scores?.[k] != null)
  if (!allAssigned) errors.push({ step: 5, message: 'All six ability scores must be assigned.' })

  // Step 6
  const cls = classesData[state.class_id]
  const choiceCount = cls?.startingEquipment?.choices?.length || 0
  const pickCount = Object.values(state.equipment_picks || {}).filter(Boolean).length
  if (choiceCount > 0 && pickCount < choiceCount) {
    errors.push({ step: 6, message: `Equipment: pick all ${choiceCount} package choices (${pickCount}/${choiceCount} picked).` })
  }

  // Step 7
  const i = state.identity || {}
  if (!i.alignment) errors.push({ step: 7, message: 'Alignment is required.' })
  if (!i.faith) errors.push({ step: 7, message: 'Faith is required (pick "None / Unaligned" if no faith).' })
  if (!i.lifestyle) errors.push({ step: 7, message: 'Lifestyle is required.' })
  // distinguishing_features is intentionally optional — not every character
  // has scars or visible markings, and forcing the field invites filler.
  for (const [field, label] of [
    ['age', 'Age'], ['height', 'Height'], ['weight', 'Weight'],
    ['eye_color', 'Eyes'], ['hair_color', 'Hair'], ['skin_color', 'Skin'],
    ['build', 'Build']
  ]) {
    if (!(i[field] || '').toString().trim()) {
      errors.push({ step: 7, message: `Physical description: ${label} is required.` })
    }
  }

  return { valid: errors.length === 0, errors }
}
