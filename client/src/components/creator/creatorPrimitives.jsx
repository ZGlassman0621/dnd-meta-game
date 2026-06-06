/**
 * Character Creator V2 — shared primitives (HEARTH dark-editorial theme).
 *
 * Small set of UI building blocks every step component composes:
 * Eyebrow, Field, Stepper, WizardHead, WizardFoot. Styling comes from the
 * ported design system: client/src/styles/hearth-creator.css (the wizard
 * chrome / ribbon / field / footer classes, scoped under `.hearth`) plus
 * the shared client/src/styles/hearth.css (.btn, .eyebrow, .chip, etc.).
 *
 * NOTE on scoping: the design styles step titles via `.pane h1` and
 * `.pane .subtitle`. WizardHead emits the `<h1>` / `<p class="subtitle">`
 * markup the design specifies; for those rules to apply, the rendered step
 * must sit inside a `.pane` ancestor (owned by the shell / step components,
 * not this file).
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
 * Form field wrapper. The `.fl` label carries the design's uppercase
 * caption styling; `help` renders below the children as the `.fhelp`
 * italic-serif help line. When `locked`, a chip-style tag is rendered
 * inline with the label (the design system has no dedicated locked-tag
 * class — see summary).
 */
export function Field({ label, help, children, className = '', locked = false, lockTag = 'Locked from the Prelude' }) {
  return (
    <div className={`field ${locked ? 'locked' : ''} ${className}`.trim()}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 16 }}>
        <span className="fl">{label}</span>
        {locked && <span className="chip locked-tag">{lockTag}</span>}
      </div>
      {children}
      {help && <div className="fhelp">{help}</div>}
    </div>
  )
}

/**
 * Step ribbon. Each node is clickable (jump-to-step) once the caller
 * decides clicks are allowed. The Step 8 "Edit" affordance reuses this
 * pattern by calling setStep(targetIndex).
 *
 * The shell now renders its own `.wiz-chrome`, but Stepper is still
 * imported by CharacterCreatorV2, so it renders the design's `.ribbon`
 * (.rnode → .rdot + .rlbl) plus the `.stepline` "Step N of total · Label"
 * caption so it stays consistent with the mockup.
 *
 * `steps` defaults to the 8-step primary-creator labels (back-compat for
 * CharacterCreatorV2). PreludeCreatorV2 passes `PRELUDE_STEPS` for the
 * 6-step prelude wizard.
 */
export function Stepper({ step, setStep, mode, steps = STEPS }) {
  const total = steps.length
  const current = steps[step]
  return (
    <nav className="wiz-chrome" aria-label="Creator step navigation">
      <div className="ribbon">
        {steps.map((label, i) => (
          <button
            key={i}
            type="button"
            className={`rnode ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`.trim()}
            aria-current={i === step ? 'step' : undefined}
            onClick={() => setStep(i)}
          >
            <span className="rdot">{i + 1}</span>
            <span className="rlbl">{label}</span>
          </button>
        ))}
      </div>
      <div className="stepline">
        <span className="sn">Step {step + 1} of {total}</span>
        <span className="gl">·</span>
        <span className="snm">{current}</span>
      </div>
    </nav>
  )
}

/**
 * Step header — eyebrow rule + display title + optional subtitle. Built
 * from the design's `.step-eyebrow` (eyebrow caption + `.ln` rule), an
 * `<h1>` question, and a `<p class="subtitle">` italic-serif lede.
 *
 * `totalSteps` defaults to 8 (primary creator). `eyebrowLabel` overrides
 * the default mode-derived label so the prelude wizard can render
 * "Prelude Setup" in place of "Campaign Character".
 */
export function WizardHead({ stepNum, title, subtitle, mode, totalSteps = 8, eyebrowLabel }) {
  const label = eyebrowLabel || (mode === 'handoff' ? 'Prelude Character' : 'Campaign Character')
  return (
    <>
      <div className="step-eyebrow">
        <span className="eyebrow">{label} · Step {stepNum} of {totalSteps}</span>
        <span className="ln" />
      </div>
      <h1>{title}</h1>
      {subtitle && <p className="subtitle">{subtitle}</p>}
    </>
  )
}

/**
 * Sticky footer nav. Back / Save-and-exit / Discard / Continue (or the
 * caller's terminal label on Step 8). Rendered as the design's
 * `<footer class="wiz-foot"><div class="inner">` with `.fprog` progress
 * text, an italic `.save` "Saved" affordance, a `.spacer`, and
 * `.btn ghost` / `.btn primary lg` controls. Caller controls labels +
 * which buttons render via the optional handlers.
 */
export function WizardFoot({ onBack, onNext, nextLabel = 'Continue', canBack = true, canNext = true, onSave, onCancel, isLast = false, progress }) {
  return (
    <footer className="wiz-foot">
      <div className="inner">
        {canBack && (
          <button type="button" className="btn ghost" onClick={onBack}>← Back</button>
        )}
        {onSave && (
          <button type="button" className="btn ghost" onClick={onSave}>Save and exit</button>
        )}
        {progress && <span className="fprog">{progress}</span>}
        <span className="spacer" />
        <span className="save">Saved · draft</span>
        {onCancel && (
          <button type="button" className="btn ghost danger" onClick={onCancel}>Discard</button>
        )}
        <button type="button" className="btn primary lg" onClick={onNext} disabled={!canNext}>
          {nextLabel}
          {!isLast && <span style={{ marginLeft: 6 }}>→</span>}
        </button>
      </div>
    </footer>
  )
}
