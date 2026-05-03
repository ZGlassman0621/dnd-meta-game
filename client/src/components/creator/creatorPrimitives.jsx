/**
 * Character Creator V2 — shared primitives.
 *
 * Small set of UI building blocks every step component composes:
 * Eyebrow, Field, Stepper, WizardHead, WizardFoot. Per CLAUDE.md, layout
 * uses inline styles per project convention; the structural classes
 * (.field, .steprail .seg, .btn, etc.) come from creator-theme.css and
 * scope all editorial-aesthetic styling under `.creator-v2`.
 */

const STEPS = [
  'Identity',
  'Ancestry',
  'Theme',
  'Class',
  'Abilities',
  'Equipment',
  'Details',
  'Review'
]

// Prelude setup — 6 steps per the structural-redesign spec (PM 2026-05-03).
// Exported so PreludeCreatorV2 can pass it to <Stepper> while keeping the
// 8-step primary default in place for CharacterCreatorV2.
export const PRELUDE_STEPS = [
  'Identity',
  'Ancestry',
  'Origin',
  'Family',
  'Appearance',
  'Review'
]

export function Eyebrow({ children }) {
  return <div className="eyebrow">{children}</div>
}

/**
 * Form field wrapper. Optional `locked` styling renders the dashed
 * accent-2 border + a chip-style "Locked from the Prelude" tag aligned
 * to the label's baseline.
 */
export function Field({ label, help, children, className = '', locked = false, lockTag = 'Locked from the Prelude' }) {
  return (
    <div className={`field ${locked ? 'locked' : ''} ${className}`}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <div className="label">{label}</div>
        {locked && <div className="locked-tag">{lockTag}</div>}
      </div>
      {help && <div className="help">{help}</div>}
      {children}
    </div>
  )
}

/**
 * Step rail. Each segment is clickable (jump-to-step) once the caller
 * decides clicks are allowed. The Step 8 "Edit" affordance reuses this
 * pattern by calling setStep(targetIndex).
 *
 * `steps` defaults to the 8-step primary-creator labels (back-compat for
 * CharacterCreatorV2). PreludeCreatorV2 passes `PRELUDE_STEPS` for the
 * 6-step prelude wizard.
 */
export function Stepper({ step, setStep, mode, steps = STEPS }) {
  return (
    <div className="steprail" role="navigation" aria-label="Creator step navigation">
      {steps.map((label, i) => (
        <button
          key={i}
          type="button"
          className={`seg ${i === step ? 'current' : ''} ${i < step ? 'done' : ''}`}
          onClick={() => setStep(i)}
        >
          <span className="num">{String(i + 1).padStart(2, '0')}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Step header — eyebrow + display title + optional subtitle. Subtitle
 * uses italic serif lede style.
 *
 * `totalSteps` defaults to 8 (primary creator). `eyebrowLabel` overrides
 * the default mode-derived label so the prelude wizard can render
 * "Prelude Setup" in place of "Campaign Character".
 */
export function WizardHead({ stepNum, title, subtitle, mode, totalSteps = 8, eyebrowLabel }) {
  const label = eyebrowLabel || (mode === 'handoff' ? 'Prelude Character' : 'Campaign Character')
  return (
    <div className="wizard-head">
      <div className="step-title">
        <div className="eyebrow step-label">
          {label}
          <span className="dot" />
          Step {String(stepNum).padStart(2, '0')} of {String(totalSteps).padStart(2, '0')}
        </div>
        <h1 className="h-step">{title}</h1>
        {subtitle && <p className="lede" style={{ marginTop: 12, maxWidth: 640 }}>{subtitle}</p>}
      </div>
    </div>
  )
}

/**
 * Footer nav. Back / Save-and-exit / Discard / Continue (or "Step into
 * the world" / "Create character" on Step 8). Caller controls labels +
 * which buttons render via the optional handlers.
 */
export function WizardFoot({ onBack, onNext, nextLabel = 'Continue', canBack = true, canNext = true, onSave, onCancel, isLast = false }) {
  return (
    <div className="wizard-foot">
      {canBack && (
        <button type="button" className="btn ghost" onClick={onBack}>← Back</button>
      )}
      {onSave && (
        <button type="button" className="btn ghost" onClick={onSave}>Save and exit</button>
      )}
      <div className="spacer" />
      {onCancel && (
        <button type="button" className="btn ghost danger" onClick={onCancel}>Discard</button>
      )}
      <button type="button" className="btn primary lg" onClick={onNext} disabled={!canNext}>
        {nextLabel}
        {!isLast && <span style={{ marginLeft: 6 }}>→</span>}
      </button>
    </div>
  )
}
