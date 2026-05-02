import { useState, useEffect } from 'react'
import { Stepper, WizardFoot } from './creatorPrimitives.jsx'
import Step1Identity from './Step1Identity.jsx'
import Step2Ancestry from './Step2Ancestry.jsx'
import Step3Theme from './Step3Theme.jsx'
import Step4ClassCalling from './Step4ClassCalling.jsx'
import Step5AbilityScores from './Step5AbilityScores.jsx'
import Step6Equipment from './Step6Equipment.jsx'

/**
 * Character Creator V2 — chunk 5 rebuilt main creator.
 *
 * Per PHASE_2_CREATOR_SPEC.md §5: 8-step component tree replacing the
 * existing 4392-line CharacterCreationWizard.jsx. Manual / handoff
 * modes are payload-and-treatment differences in one component, not
 * two forks (§2.4 mode coherence guarantee).
 *
 * Batch 2 ships Steps 1–4 + the celebration card primitive + the
 * dismissable narrative-continuity card (Step 4). Steps 5–8 ship in
 * batch 3.
 *
 * Mode determination:
 *   - `mode='handoff'` when a Prelude payload is provided (handoff
 *     transition has run; character.creation_phase === 'ready_for_primary')
 *   - `mode='manual'` otherwise
 *
 * Until 5.K wires this into the home page, this component is reachable
 * via the `?creator=v2` query-param preview in App.jsx — a temporary
 * affordance for visual/UX review before the rebuilt creator replaces
 * the existing one.
 */
export default function CharacterCreatorV2({ preludePayload = null, onExit }) {
  const mode = preludePayload ? 'handoff' : 'manual'

  // The wizard's own step + state. State shape mirrors what the old
  // CharacterCreationWizard's buildInitialFormData produces, with new
  // fields (theme_id, ancestry_feat_id) named per spec.
  const [step, setStep] = useState(0)
  const [state, setState] = useState(() => buildInitialState(preludePayload))

  // When entering with a different payload (e.g. switching characters
  // in handoff), re-seed the form. Cheap; only fires on payload swap.
  useEffect(() => {
    setState(buildInitialState(preludePayload))
    setStep(0)
  }, [preludePayload?.character_id])

  const totalSteps = 8
  const back = () => setStep(s => Math.max(0, s - 1))
  const next = () => setStep(s => Math.min(totalSteps - 1, s + 1))

  const stepProps = { state, set: setState, mode, payload: preludePayload }

  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">
          {mode === 'handoff' ? 'Prelude character · resuming' : 'Campaign character · in progress'}
        </div>
        <div className="spacer" />
        {onExit && (
          <button type="button" className="btn ghost" onClick={onExit}>Exit preview</button>
        )}
      </div>

      <div className="stage">
        <div className="frame">
          <Stepper step={step} setStep={setStep} mode={mode} />
          <div style={{ height: 36 }} />

          {step === 0 && <Step1Identity {...stepProps} />}
          {step === 1 && <Step2Ancestry {...stepProps} />}
          {step === 2 && <Step3Theme {...stepProps} />}
          {step === 3 && <Step4ClassCalling {...stepProps} />}
          {step === 4 && <Step5AbilityScores {...stepProps} />}
          {step === 5 && <Step6Equipment {...stepProps} />}
          {step >= 6 && (
            // Steps 7–8 land in checkpoint 2 (Step 7 + Step 8 + Submit
            // + persistence). Until then this is a placeholder so the
            // stepper navigation doesn't crash if the user clicks ahead.
            <PlaceholderStep stepNum={step + 1} />
          )}

          <WizardFoot
            onBack={back}
            onNext={step === totalSteps - 1 ? () => alert('Submit handled by Step 8 (batch 3).') : next}
            canBack={step > 0}
            onSave={onExit}
            nextLabel={step === totalSteps - 1
              ? (mode === 'handoff' ? 'Step into the world' : 'Create character')
              : 'Continue'}
            isLast={step === totalSteps - 1}
          />
        </div>
      </div>
    </div>
  )
}

function PlaceholderStep({ stepNum }) {
  const labels = { 5: 'Ability Scores', 6: 'Equipment', 7: 'Identity Details', 8: 'Review' }
  return (
    <div>
      <div className="wizard-head">
        <div className="step-title">
          <div className="eyebrow">Step {String(stepNum).padStart(2, '0')} of 08</div>
          <h1 className="h-step">{labels[stepNum] || `Step ${stepNum}`}</h1>
          <p className="lede" style={{ marginTop: 12 }}>
            This step lands in checkpoint 2 of batch 3. Use Back to return.
          </p>
        </div>
      </div>
    </div>
  )
}

function buildInitialState(payload) {
  const blankBaseScores = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  if (!payload) {
    return {
      // Step 1
      first_name: '', last_name: '', nickname: '', gender: '',
      // Step 2
      race: '', subrace: '', ancestry_feat_id: null, ancestry_feat_choices: {},
      // Step 3
      theme_id: '',
      // Step 4
      class_id: '', subclass_id: '', fighting_style: '',
      // Step 5
      generation_method: 'standard_array',
      base_scores: blankBaseScores,
      racial_choice_picks: [],
      bump_assignments: [],
      selected_skills: [],
      // Step 6
      equipment_picks: {},
      heirloom: null,
      heirloom_candidate_id: null
      // (Steps 7–8 fields land in checkpoint 2)
    }
  }
  // Handoff seed from §8.2.1 payload shape (schema_version=2). Only
  // the fields the batch-2/3 steps consume are mirrored; additional
  // fields land as their owning steps ship.
  const np = payload.name_parts || {}
  return {
    first_name: np.first_name || '',
    last_name: np.last_name || '',
    nickname: np.nickname || '',
    gender: payload.gender || '',
    race: payload.race || '',
    subrace: payload.subrace || '',
    ancestry_feat_id: payload.ancestry_feat_id || null,
    ancestry_feat_choices: {},
    theme_id: payload.committed_theme || '',
    class_id: payload.class_suggestion || '',
    subclass_id: '',
    fighting_style: '',
    generation_method: 'standard_array',
    base_scores: blankBaseScores,
    racial_choice_picks: [],
    bump_assignments: [],
    selected_skills: [],
    equipment_picks: {},
    heirloom: null,
    heirloom_candidate_id: null
  }
}
