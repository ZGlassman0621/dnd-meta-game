import { useState, useEffect } from 'react'
import { Stepper, WizardFoot, WizardHead, PRELUDE_STEPS } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import PreludeStep1Identity from './PreludeStep1Identity.jsx'
import PreludeStep2Ancestry from './PreludeStep2Ancestry.jsx'

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
export default function PreludeCreatorV2({ onCancel, onPreludeCreated }) {
  const [step, setStep] = useState(0)
  const [state, setState] = useState(buildInitialState)

  const totalSteps = PRELUDE_STEPS.length
  const back = () => setStep(s => Math.max(0, s - 1))
  const next = () => setStep(s => Math.min(totalSteps - 1, s + 1))
  const canAdvance = canAdvanceFromStep(step, state)

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
        <div className="crumbs">Prelude · setup (v2 preview)</div>
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
          {step === 2 && <PlaceholderStep stepNum={3} title="Origin" />}
          {step === 3 && <PlaceholderStep stepNum={4} title="Family & Influence" />}
          {step === 4 && <PlaceholderStep stepNum={5} title="Appearance" />}
          {step === 5 && <PlaceholderStep stepNum={6} title="Review" />}

          <WizardFoot
            onBack={back}
            onNext={next}
            canBack={step > 0}
            canNext={canAdvance && step < totalSteps - 1}
            onSave={onCancel}
            nextLabel="Continue"
            isLast={step === totalSteps - 1}
          />
        </div>
      </div>
    </div>
  )
}

/**
 * Placeholder step component — mirrors CharacterCreatorV2's
 * PlaceholderStep pattern. Used while later steps are being built so the
 * stepper rail is functional during sub-checkpoint review.
 */
function PlaceholderStep({ stepNum, title }) {
  return (
    <WizardHead
      stepNum={stepNum}
      title={title}
      subtitle="This step lands in a later sub-checkpoint. Use Back to return to Step 1."
      totalSteps={6}
      eyebrowLabel="Prelude Setup"
    />
  )
}

/**
 * Per-step validation gate. Continue button is disabled when the
 * current step's required fields aren't filled. Required-vs-optional
 * distribution mirrors the legacy 11-question wizard's validate()
 * function (per spec — no functional change to strictness, just
 * relocated to per-step gates).
 *
 * Steps 3–5 return true while the step is a placeholder so the player
 * can still walk forward and back during sub-checkpoint review. Each
 * step's gate fills in when the step component lands.
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
  // Steps 3–5: placeholders. Allow advance until each step's real
  // validation lands with the step component.
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
    // Step 5 — appearance fields ported from primary creator's Step 7,
    // plus the Anything-else? free-text from the legacy wizard
    appearance: {
      eye_color: '',
      hair_color: '',
      skin_color: '',
      build: '',
      height: '',
      weight: ''
    },
    origin_freeform: '',
    // Testing flag — preserved from the legacy wizard for parity. Defaults
    // ON for play-testing the arc output; flip OFF for production-feeling
    // flow that dives straight into the first scene.
    show_arc_preview: true
  }
}
