import { useState } from 'react'

/**
 * New-creator Tip — the tooltip rule, carried from the old wizard.
 *
 * Zach's rule (2026-11-04): EVERY choice in the new creator carries a
 * tooltip with the information needed to make the best choice — what it
 * does in play, what it locks, and what can change later. The old wizard
 * implemented this with native `title=` attributes, which fail keyboard
 * and touch users, so this primitive renders a real affordance instead:
 * a "?" button that shows its text on hover, on focus, and on tap
 * (toggle), and hides on leave/blur. It never blocks the choice itself.
 *
 * Usage: <Tip text="..." /> beside a Field label or a picker option.
 * No text → renders nothing, so a missing tooltip is visible in code
 * review as an absent <Tip>, never as a silent gap.
 */
export default function Tip({ text, label = 'About this choice' }) {
  const [open, setOpen] = useState(false)
  if (!text) return null
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 8, verticalAlign: 'middle' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '1px solid var(--rule, #888)',
          background: 'transparent', color: 'var(--ink-3, #888)',
          fontSize: 13, lineHeight: 1, cursor: 'pointer', padding: 0
        }}
      >
        ?
      </button>
      {open && (
        <span
          role="tooltip"
          style={{
            position: 'absolute', zIndex: 50, left: 0, top: 26,
            width: 300, maxWidth: '70vw', padding: '10px 12px',
            background: 'var(--ink-2, #222)', color: '#f5f5f5',
            fontFamily: 'var(--serif)', fontStyle: 'normal',
            fontSize: 14, lineHeight: 1.45, textTransform: 'none',
            letterSpacing: 0, borderRadius: 6,
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)'
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}
