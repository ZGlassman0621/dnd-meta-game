import { useState } from 'react'

/**
 * Collapsible expansion section for Step 7's optional expansions
 * (Personality / Ideals / Bonds / Flaws / Backstory).
 *
 * Per spec §5.7.2 / §5.7.3:
 *   - Manual mode: collapsed by default ("+ Personality traits")
 *   - Handoff mode: expanded by default with biography pre-fill
 *
 * Mode-aware default state is the caller's responsibility (`defaultOpen`
 * prop); this component manages local open/closed state thereafter.
 */
export default function ExpansionSection({
  label,
  description,
  defaultOpen = false,
  hasContent = false,
  children
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Hearth idiom: the design's `details.more` collapsible — a rule-topped
  // summary row (chevron that rotates 90° when open + uppercase label +
  // italic count/hint) over a `.more-body`. We keep it as a controlled
  // button/div pair (rather than native <details>) so the caller's
  // defaultOpen + local toggle behaviour is preserved exactly.
  return (
    <div className="more" style={{ marginTop: 0, marginBottom: 14 }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          listStyle: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '15px 2px 4px',
          background: 'transparent',
          border: 0,
          textAlign: 'left',
          fontFamily: 'var(--sans)',
          fontWeight: 600,
          fontSize: 11,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-3)'
        }}
      >
        {/* Chevron marker — rotates 90° when open. Visual cue that the
            section is expandable (per PM review feedback). */}
        <svg
          className="ic chev"
          aria-hidden="true"
          style={{
            width: 14,
            height: 14,
            color: 'var(--ink-4)',
            transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform .18s'
          }}
        >
          <use href="#i-chevron-right" />
        </svg>
        <span>{label}</span>
        {description && (
          <span className="ct" style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '.04em',
            color: 'var(--ink-4)',
            textTransform: 'none'
          }}>
            {description}
          </span>
        )}
        {!open && hasContent && (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            fontFamily: 'var(--sans)',
            fontSize: 9,
            letterSpacing: '.18em',
            textTransform: 'uppercase',
            color: 'var(--accent)'
          }}>
            <svg className="ic" aria-hidden="true" style={{ width: 11, height: 11 }}>
              <use href="#i-check" />
            </svg>
            Filled
          </span>
        )}
      </button>
      {open && (
        <div className="more-body" style={{ paddingTop: 14 }}>
          {children}
        </div>
      )}
    </div>
  )
}
