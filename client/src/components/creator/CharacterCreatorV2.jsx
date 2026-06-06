import { useState, useEffect } from 'react'
import '../../styles/hearth.css'
import '../../styles/hearth-creator.css'
import Step1Identity from './Step1Identity.jsx'
import Step2Ancestry from './Step2Ancestry.jsx'
import Step3Theme from './Step3Theme.jsx'
import Step4ClassCalling from './Step4ClassCalling.jsx'
import Step5AbilityScores from './Step5AbilityScores.jsx'
import Step6Equipment from './Step6Equipment.jsx'
import Step7IdentityDetails from './Step7IdentityDetails.jsx'
import Step8Review from './Step8Review.jsx'
import { submitCreator, saveProgress } from './creatorPersistence.js'

/**
 * Character Creator V2 — chunk 5 rebuilt main creator.
 *
 * Per PHASE_2_CREATOR_SPEC.md §5: 8-step component tree replacing the
 * existing 4392-line CharacterCreationWizard.jsx.
 *
 * The Prelude system was removed in the MVP, so the creator only ever
 * runs in manual / campaign mode — HomeFlow always enters with no
 * prelude payload. Steps still accept a `mode` prop for back-compat,
 * but it is always `'manual'` here.
 *
 * Until 5.K wires this into the home page, this component is reachable
 * via the `?creator=v2` query-param preview in App.jsx — a temporary
 * affordance for visual/UX review before the rebuilt creator replaces
 * the existing one.
 */
export default function CharacterCreatorV2({
  preludePayload = null,
  initialState = null,
  initialCharacterId = null,
  initialStep = 0,
  persistProgress = true,
  onExit,
  onSubmitSuccess = null
}) {
  // Prelude/handoff was removed in the MVP — the creator is campaign-only.
  const mode = 'manual'

  // The wizard's own step + state. State shape mirrors what the old
  // CharacterCreationWizard's buildInitialFormData produces, with new
  // fields (theme_id, ancestry_feat_id) named per spec.
  const [step, setStep] = useState(initialStep)
  const [state, setState] = useState(() => initialState || buildInitialState(preludePayload))

  // Phase 2 chunk 5 batch 3 sub-checkpoint 2 (5.L.3) — partial-save
  // state. characterId is null in manual mode until Step 1 advance
  // creates the row; pre-set in handoff mode (from preludePayload).
  // Initial characterId can also be provided by the caller for resume
  // flows (home page click on an in-progress card).
  const [characterId, setCharacterId] = useState(
    initialCharacterId ?? preludePayload?.character_id ?? null
  )
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)

  // When entering with a different payload (e.g. switching characters
  // in handoff), re-seed the form. Cheap; only fires on payload swap.
  useEffect(() => {
    setState(buildInitialState(preludePayload))
    setStep(0)
  }, [preludePayload?.character_id])

  // Scroll to the top of the page on every step change. Without this,
  // clicking Continue at the bottom of a long step lands the player
  // somewhere mid-page on the next step. `instant` not 'smooth' — the
  // smooth option lags noticeably for tall pages.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    }
  }, [step])

  const totalSteps = 8
  const back = () => setStep(s => Math.max(0, s - 1))

  // Save-before-advance per spec §6.2 + PM ruling 2026-05-02 (Option 1:
  // single source of truth — character row). Manual mode: Step 1
  // advance creates a 'creating' row; subsequent advances PUT to update.
  // Handoff mode: every advance PUTs the existing 'ready_for_primary'
  // row. The preview path (`?creator=v2`) passes `persistProgress=false`
  // so visual review doesn't create real characters.
  const next = async () => {
    if (saving) return
    if (persistProgress) {
      setSaving(true)
      setSaveError(null)
      try {
        const result = await saveProgress({ state, mode, preludePayload, characterId })
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

  const stepProps = { state, set: setState, mode, payload: preludePayload }

  // The design's persistent chrome. STEP_LABELS feeds the ribbon nodes;
  // STEP_NAMES is the longer label the stepline ("Step N of 8 · Name")
  // shows under the ribbon. Indices are 0-based to match `step`.
  const STEP_LABELS = ['Identity', 'Ancestry', 'Theme', 'Class', 'Abilities', 'Equipment', 'Details', 'Review']
  const STEP_NAMES = ['Identity', 'Ancestry', 'Theme', 'Class & Calling', 'Ability Scores', 'Equipment', 'Identity Details', 'Review']
  const isLast = step === totalSteps - 1

  return (
    <div className="hearth creator-shell">
      {/* persistent header — gives the sticky .wiz-chrome (top:58px) its 58px gutter */}
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr" />
        {onExit ? (
          <button type="button" className="back" onClick={onExit}>
            <svg className="ic"><use href="#i-arrow-left" /></svg>
            Your characters
          </button>
        ) : (
          <span className="back" style={{ cursor: 'default' }}>Character Creator</span>
        )}
        <div className="spacer" />
        <span className="opus"><span className="dot" />Opus</span>
      </header>

      {/* step ribbon */}
      <div className="wiz-chrome">
        <div className="ribbon">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              type="button"
              className={`rnode ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}
              onClick={() => setStep(i)}
            >
              <span className="rdot">{i + 1}</span>
              <span className="rlbl">{label}</span>
            </button>
          ))}
        </div>
        <div className="stepline">
          <span className="sn">Step {step + 1} of {totalSteps}</span>
          <span className="gl">·</span>
          <span className="snm">{STEP_NAMES[step]}</span>
        </div>
      </div>

      <main className="reading">
        <section className="pane show">
          {step === 0 && <Step1Identity {...stepProps} />}
          {step === 1 && <Step2Ancestry {...stepProps} />}
          {step === 2 && <Step3Theme {...stepProps} />}
          {step === 3 && <Step4ClassCalling {...stepProps} />}
          {step === 4 && <Step5AbilityScores {...stepProps} />}
          {step === 5 && <Step6Equipment {...stepProps} />}
          {step === 6 && <Step7IdentityDetails {...stepProps} />}
          {step === 7 && (
            <Step8Review
              state={state}
              mode={mode}
              payload={preludePayload}
              onJump={(targetStep) => setStep(targetStep)}
              onSubmit={async () => {
                const result = await submitCreator({ state, mode, preludePayload, characterId })
                if (onSubmitSuccess) onSubmitSuccess(result)
                else alert(`Character ${result.character_id || ''} created.`)
              }}
            />
          )}

          {saveError && (
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: 'color-mix(in oklab, var(--bad) 12%, var(--bg-card))',
              border: '1px solid color-mix(in oklab, var(--bad) 40%, var(--rule))',
              borderRadius: 11,
              color: 'var(--bad)',
              fontFamily: 'var(--serif)',
              fontSize: 15
            }}>
              Couldn't save: {saveError} (Your input is preserved — try Continue again, or Save and exit.)
            </div>
          )}
        </section>
      </main>

      {/* sticky footer */}
      <footer className="wiz-foot">
        <div className="inner">
          <button
            type="button"
            className="btn ghost"
            onClick={back}
            disabled={saving}
            style={{ visibility: step > 0 ? 'visible' : 'hidden' }}
          >
            <svg className="ic"><use href="#i-arrow-left" /></svg>
            Back
          </button>
          <span className="fprog">Step {step + 1} of {totalSteps}</span>
          <span className="spacer" />
          {onExit && (
            <button type="button" className="save btn ghost" onClick={onExit}>Save and exit</button>
          )}
          {/* Step 8 carries its own "Bring them to life" primary at the bottom
              of the review pane; the footer there is Back + Save only. */}
          {!isLast && (
            <button type="button" className="btn primary" onClick={next} disabled={saving}>
              {saving ? 'Saving…' : 'Continue'}
              <svg className="ic"><use href="#i-arrow-right" /></svg>
            </button>
          )}
        </div>
      </footer>

      {/* icon sprite for the chrome/footer arrows (copied from the design's <defs>) */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
        <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
        <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      </defs></svg>
    </div>
  )
}

function buildInitialState(payload) {
  const blankBaseScores = { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  const blankIdentity = {
    alignment: '', faith: '', lifestyle: '',
    age: '', height: '', weight: '',
    eye_color: '', hair_color: '', skin_color: '', build: '',
    distinguishing_features: ''
  }
  const blankExpansions = {
    personality: { value: '' },
    ideals: { value: '' },
    bonds: { value: '' },
    flaws: { value: '' },
    backstory: { picked_keys: [], custom_moments: [] }
  }

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
      heirloom_candidate_id: null,
      // Step 7
      identity: blankIdentity,
      expansions: blankExpansions
    }
  }
  // Handoff seed from §8.2.1 payload shape (schema_version=2).
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
    heirloom_candidate_id: null,
    // Step 7 — alignment / faith / lifestyle / physical NEVER pre-fill
    // from Prelude per spec §5.7.3. Player picks fresh in handoff too.
    identity: blankIdentity,
    // Backstory expansion in handoff mode displays the biography_seed
    // read-only at the top (consumed inside the component); other
    // expansions remain blank (biography-seed pre-fill into specific
    // expansions is a future authoring problem per spec §5.7.7).
    expansions: blankExpansions
  }
}
