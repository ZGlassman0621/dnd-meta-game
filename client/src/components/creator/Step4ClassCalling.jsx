import { useState, useEffect, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import classesData from '../../data/classes.json'
import { THEME_NARRATIVE_CONTINUITY } from '../../data/themeNarrativeContinuity.js'

/**
 * Step 4 — Class & Calling. Per PHASE_2_CREATOR_SPEC.md §5.4.
 *
 * Manual mode: class picker (all 17 classes) + class detail card +
 * subclass picker (when class picks subclass at L1) + L1 mechanical
 * choices (cantrips, fighting style, etc.).
 *
 * Handoff mode: class is suggested-but-editable — pre-fills with
 * `payload.class_suggestion` from the [CLASS_HINT] tally. A
 * narrative-continuity card sits ABOVE the class dropdown, anchored
 * to the locked theme. The card is dismissable per spec §5.4.6 —
 * local-session-scoped boolean.
 *
 * Subclass + L1 mechanical picks are fully editable in both modes
 * (no Prelude pre-fill — the Prelude tracks class affinity, not
 * subclass affinity, per spec §5.4.3).
 */
export default function Step4ClassCalling({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  // Pre-fill suggested class on handoff entry, but only on first render —
  // once the player has an explicit choice, don't override.
  useEffect(() => {
    if (!isHandoff) return
    if (state.class_id) return
    if (!payload?.class_suggestion) return
    set({ ...state, class_id: payload.class_suggestion })
  }, [isHandoff, payload?.class_suggestion])

  const classId = state.class_id || ''
  const themeId = state.theme_id || (isHandoff ? payload?.committed_theme : '')

  // Local-session-scoped dismissal of the narrative-continuity card.
  // Reset when the underlying theme changes (defensive — theme is
  // locked in handoff, but covers manual-mode-toggle edge cases).
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { setDismissed(false) }, [themeId])

  const continuity = isHandoff && themeId ? THEME_NARRATIVE_CONTINUITY[themeId] : null

  const classList = useMemo(() => {
    return Object.entries(classesData).map(([id, c]) => ({
      id,
      name: c.name || id,
      hitDie: c.hitDie || c.hit_die || c.hd,
      primaryAbility: c.primaryAbility || c.primary_ability || c.primary,
      savingThrows: c.savingThrows || c.saving_throws || c.saves,
      description: c.description || c.flavor || ''
    }))
  }, [])
  const cls = classId ? classList.find(c => c.id === classId) : null

  return (
    <>
      <WizardHead
        stepNum={4}
        title="Class & Calling"
        subtitle="What you'll do when the situation calls for action."
        mode={mode}
      />

      {continuity && !dismissed && (
        <div className="narrative-card">
          <button
            type="button"
            className="dismiss"
            onClick={() => setDismissed(true)}
            title="This doesn't fit"
            aria-label="Dismiss this card"
          >
            ✕
          </button>
          <div className="marker">A continuity from the years behind you</div>
          <p className="body">{continuity}</p>
        </div>
      )}

      <div className="card">
        <Field
          label="Class"
          help={
            isHandoff
              ? 'Suggested from the years that shaped you. The choice remains yours.'
              : 'Your profession or training — what you do when the situation calls for action.'
          }
        >
          <div className="picker">
            {classList.map(c => (
              <button
                key={c.id}
                type="button"
                className={`pick ${classId === c.id ? 'on' : ''}`}
                onClick={() => set({ ...state, class_id: c.id, subclass_id: '', fighting_style: '' })}
              >
                <div className="name">{c.name}</div>
                <div className="sub">
                  {[
                    c.hitDie ? (typeof c.hitDie === 'number' ? `d${c.hitDie}` : c.hitDie) : null,
                    c.primaryAbility
                  ].filter(Boolean).join(' · ')}
                </div>
              </button>
            ))}
          </div>
        </Field>

        {cls && (
          <div className="detail-card">
            <div className="name">{cls.name}</div>
            {cls.description && (
              <p className="body">{cls.description}</p>
            )}
            <div className="stat-line">
              {cls.hitDie && (
                <span>
                  Hit die <strong>{typeof cls.hitDie === 'number' ? `d${cls.hitDie}` : cls.hitDie}</strong>
                </span>
              )}
              {cls.primaryAbility && (
                <span>Primary <strong>{cls.primaryAbility}</strong></span>
              )}
              {cls.savingThrows && (
                <span>
                  Saves <strong>{Array.isArray(cls.savingThrows) ? cls.savingThrows.join(', ') : cls.savingThrows}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        {/*
          Subclass + L1 mechanical picks are step 4's secondary surface.
          For batch 2 we render a lightweight placeholder; chunk 5 will
          source these from class data files (subclass-pick level per
          class, fighting style options, cantrip allotments, etc.). The
          placeholder communicates "the work continues" without faking
          data the player would interact with.
        */}
        {cls && (
          <>
            <div className="hr soft" />
            <Field
              label="Subclass"
              help="A specialization within your calling. Some classes pick at level 1; others pick later."
            >
              <select
                className="select"
                value={state.subclass_id || ''}
                onChange={e => set({ ...state, subclass_id: e.target.value })}
              >
                <option value="">— picks at later level —</option>
              </select>
            </Field>

            <Field
              label="Other L1 picks"
              help="Cantrips, fighting style, expertise, and other class-specific choices that come at character creation. Wired in a follow-up sub-chunk; the picker below is a placeholder."
            >
              <div className="help" style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
                Class-specific L1 mechanical choices will surface here per the chosen class's schema.
              </div>
            </Field>
          </>
        )}
      </div>
    </>
  )
}
