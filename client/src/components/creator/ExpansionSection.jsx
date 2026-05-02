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

  return (
    <div
      style={{
        border: '1px solid var(--rule)',
        background: 'var(--bg-card)',
        marginBottom: 14
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 24px',
          background: 'transparent',
          border: 0,
          borderBottom: open ? '1px solid var(--rule-soft)' : 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontFamily: 'var(--serif)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
          {/* Chevron marker — rotates 90° when open. Visual cue that the
              section is expandable (per PM review feedback). */}
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              fontFamily: 'var(--mono)',
              fontSize: 14,
              color: 'var(--accent)',
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
              width: 12,
              textAlign: 'center'
            }}
          >
            ▸
          </span>
          <span style={{ fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
            {label}
          </span>
          {description && (
            <span style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 15,
              color: 'var(--ink-3)'
            }}>
              {description}
            </span>
          )}
        </div>
        {!open && hasContent && (
          <span style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--accent)'
          }}>
            ✓ filled
          </span>
        )}
      </button>
      {open && (
        <div style={{ padding: 24 }}>
          {children}
        </div>
      )}
    </div>
  )
}
