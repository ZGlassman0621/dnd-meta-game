import { useState, useEffect } from 'react'
import { Stepper, WizardFoot, PRELUDE_STEPS } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import { savePreludeProgress, submitPrelude as submitPreludeApi } from './preludePersistence.js'
import PreludeStep1Identity from './PreludeStep1Identity.jsx'
import PreludeStep2Ancestry from './PreludeStep2Ancestry.jsx'
import PreludeStep3Origin from './PreludeStep3Origin.jsx'
import PreludeStep4Family from './PreludeStep4Family.jsx'
import PreludeStep5Appearance, { ORIGIN_FREEFORM_MAX } from './PreludeStep5Appearance.jsx'
import PreludeStep6Review from './PreludeStep6Review.jsx'

/**
 * Prelude Creator V2 — structural redesign per PM spec rev 2 (2026-05-03).
 *
 * Restructures PreludeSetupWizard from one-page-11-questions to a 6-step
 * wizard mirroring the primary creator's pattern (CharacterCreatorV2).
 * Lives in parallel with PreludeSetupWizard.jsx during the per-step
 * roll-out; HomeFlow renders this when `?prelude_v2=1` is in the URL,
 * otherwise the existing one-page wizard. After all 6 steps land + are
 * signed off, HomeFlow cuts over and the legacy wizard gets retired.
 *
 * Step structure (6 steps):
 *   1. Identity — first/last/nickname/gender (M/F binary)         ← Step 1 lands here
 *   2. Race / subrace + descriptive copy from races.json           ← placeholder
 *   3. Origin — birth circumstance / home / region                 ← placeholder
 *   4. Family & influence — parents / siblings / authority figure  ← placeholder
 *   5. Appearance (port from primary creator's Step 7) + Anything else? ← placeholder
 *   6. Review                                                      ← placeholder
 *
 * Save/resume: deferred to a later step. PM cadence is "ship Step 1 first,
 * review against primary creator's Step 1, then proceed step-by-step."
 * Server-side persistence (new `creation_phase = 'prelude_setup'` enum
 * value, partial-save endpoints, HomeScreenV2 fourth-state card) lands
 * once the visual + interaction pattern is signed off.
 */
export default function PreludeCreatorV2({
  onCancel,
  onPreludeCreated,
  initialState = null,
  initialCharacterId = null,
  persistProgress = true
}) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState(() => initialState || buildInitialState())
  // v1.0.138: characterId tracks the draft row created on Step 1 advance.
  // Pre-populated when resuming from a "Continue setup" home card click.
  const [characterId, setCharacterId] = useState(initialCharacterId)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  const totalSteps = PRELUDE_STEPS.length
  const back = () => setStep(s => Math.max(0, s - 1))
  const canAdvance = canAdvanceFromStep(step, state)

  // Save-before-advance per v1.0.138 plumbing. Step 1 advance creates a
  // 'prelude_setup' draft row; subsequent advances PUT updates. Same
  // shape as CharacterCreatorV2's primary-creator save-on-advance pattern.
  // The `?prelude_v2=1` preview path passes persistProgress through (true
  // by default); set to false for visual review without DB writes.
  const next = async () => {
    if (saving) return
    if (persistProgress) {
      setSaving(true)
      setSaveError(null)
      try {
        const result = await savePreludeProgress({ state, characterId })
        if (result.character_id && result.character_id !== characterId) {
          setCharacterId(result.character_id)
        }
      } catch (err) {
        setSaveError(err.message || 'Could not save progress.')
        setSaving(false)
        return  // Block advance on save failure
      }
      setSaving(false)
    }
    setStep(s => Math.min(totalSteps - 1, s + 1))
  }

  // Scroll to the top of the page on every step change. Same UX as
  // CharacterCreatorV2 — without it, clicking Continue at the bottom
  // of a step lands the player mid-page on the next step.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [step])

  const stepProps = { state, set: setState }

  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">
          {initialCharacterId ? 'Prelude · resuming setup' : 'Prelude · setup'}
        </div>
        <div className="spacer" />
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>← Back to roster</button>
        )}
      </div>

      <div className="stage">
        <div className="frame">
          <Stepper step={step} setStep={setStep} steps={PRELUDE_STEPS} />
          <div style={{ height: 36 }} />

          {step === 0 && <PreludeStep1Identity {...stepProps} />}
          {step === 1 && <PreludeStep2Ancestry {...stepProps} />}
          {step === 2 && <PreludeStep3Origin {...stepProps} />}
          {step === 3 && <PreludeStep4Family {...stepProps} />}
          {step === 4 && <PreludeStep5Appearance {...stepProps} />}
          {step === 5 && (
            <PreludeStep6Review
              state={state}
              set={setState}
              onJump={(targetStep) => setStep(targetStep)}
              onSubmit={async () => {
                const character = await submitPreludeApi({ state, characterId })
                if (onPreludeCreated) {
                  onPreludeCreated(character, { showArcPreview: state.show_arc_preview ?? true })
                }
              }}
            />
          )}

          {step < totalSteps - 1 && (
            <>
              {saveError && (
                <div style={{
                  marginTop: 16,
                  padding: '12px 16px',
                  background: 'var(--bg-2)',
                  border: '1px solid var(--accent)',
                  borderLeft: '3px solid var(--accent)',
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 15,
                  color: 'var(--ink-2)'
                }}>
                  Couldn't save: {saveError} (Your input is preserved — try Continue again, or Back to roster.)
                </div>
              )}
              <WizardFoot
                onBack={back}
                onNext={next}
                canBack={step > 0 && !saving}
                canNext={canAdvance && !saving}
                onSave={onCancel}
                nextLabel={saving ? 'Saving…' : 'Continue'}
                isLast={false}
              />
            </>
          )}
          {step === totalSteps - 1 && (
            // Step 6 (Review) owns its own primary Submit button. Footer
            // here only carries Back + Save-and-exit. Mirrors primary
            // creator's Step 8 pattern.
            <WizardFoot
              onBack={back}
              onNext={() => {}}
              canBack
              canNext={false}
              onSave={onCancel}
              nextLabel=""
              isLast
            />
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Per-step validation gate. Continue button is disabled when the
 * current step's required fields aren't filled. Required-vs-optional
 * distribution mirrors the legacy 11-question wizard's validate()
 * function (per spec — no functional change to strictness, just
 * relocated to per-step gates).
 */
function canAdvanceFromStep(step, state) {
  if (step === 0) {
    // Step 1: needs (first OR last) name + gender
    const hasName = Boolean((state.first_name || '').trim() || (state.last_name || '').trim())
    const hasGender = Boolean(state.gender)
    return hasName && hasGender
  }
  if (step === 1) {
    // Step 2: needs race; needs subrace if race has subraces
    if (!state.race) return false
    const raceData = racesData[state.race]
    const subraces = raceData?.subraces || []
    if (subraces.length > 0 && !state.subrace) return false
    return true
  }
  if (step === 2) {
    // Step 3: each origin field needs EITHER curated dropdown OR free-text
    // override. Mirrors the legacy wizard's resolved() helper — server
    // accepts the override when populated, otherwise the dropdown value.
    const filled = (curated, other) => Boolean(curated || (other || '').trim())
    return filled(state.birth_circumstance, state.birth_circumstance_other)
      && filled(state.home_setting, state.home_setting_other)
      && filled(state.region, state.region_other)
  }
  if (step === 3) {
    // Step 4: siblings + authority figure required (parents lenient —
    // legacy validate() doesn't check parents; server fills a default
    // 'unknown guardian' if all slots are empty). Sibling/authority
    // contradiction (only_child + sibling-as-authority) blocks advance.
    if (!state.siblings) return false
    if (!state.authority_figure) return false
    if (state.siblings === 'only_child' && state.authority_figure === 'sibling') return false
    return true
  }
  if (step === 4) {
    // Step 5: appearance fields all optional; origin_freeform optional.
    // Only gate is the 2000-char cap — block advance if over the limit
    // so the player sees + addresses it before reaching review.
    const len = (state.origin_freeform || '').length
    if (len > ORIGIN_FREEFORM_MAX) return false
    return true
  }
  return true
}

/**
 * Initial state shape for a fresh prelude wizard.
 *
 * Mirrors the field set the legacy PreludeSetupWizard collected, plus
 * the appearance-fields port slated for Step 5 (per PM spec). All start
 * blank; per-step components fill them as the player progresses.
 *
 * `gender: ''` — collapsed from female/male/non-binary/other to binary
 * Female/Male per spec; client-side enforcement only (server accepts any
 * non-empty string).
 */
function buildInitialState() {
  return {
    // Step 1
    first_name: '',
    last_name: '',
    nickname: '',
    gender: '',
    // Step 2
    race: '',
    subrace: '',
    // Step 3
    birth_circumstance: '',
    birth_circumstance_other: '',
    home_setting: '',
    home_setting_other: '',
    region: '',
    region_other: '',
    // Step 4
    parents: [
      { role: 'mother', name: '', race: '', status: 'present' },
      { role: 'father', name: '', race: '', status: 'present' }
    ],
    siblings: '',
    authority_figure: '',
    // Step 5 — appearance fields. Limited to eyes / hair / skin / build
    // per the v1.0.137 review call (the prelude character is a child;
    // adult-range height/weight would confuse the narrator). Plus the
    // Anything-else? free-text carried from the legacy wizard.
    appearance: {
      eye_color: '',
      hair_color: '',
      skin_color: '',
      build: ''
    },
    origin_freeform: '',
    // Testing flag — preserved from the legacy wizard for parity. Defaults
    // ON for play-testing the arc output; flip OFF for production-feeling
    // flow that dives straight into the first scene.
    show_arc_preview: true
  }
}
