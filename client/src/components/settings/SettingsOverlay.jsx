import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * Phase 3.5 — Settings overlay.
 *
 * Per `settings/SETTINGS_DESIGN_BRIEF.md`. A centered editorial sheet on a
 * tinted scrim, reachable from a `Settings` link in the appbar on home and
 * mid-session alike. Two controls today (`Gameplay` section): survival
 * intensity (active, wires to migration 052's `survival_intensity` column
 * via PUT /api/character/:id) and combat difficulty (placeholder dial,
 * disabled, "Coming soon"). Apply-on-click contract — each dial click
 * fires PUT immediately and the right-margin meta updates to "Saved · just
 * now", decaying to relative time on subsequent renders.
 *
 * Per-character scope: `character` prop drives both display and write. The
 * overlay does NOT mount itself; consumers (HomeFlow appbar + App.jsx
 * dashboard header) render it conditionally based on whether the user has
 * clicked the Settings link.
 *
 * Aesthetic: editorial palette (matches `.creator-v2`), self-contained
 * tokens via `.settings-overlay-root` so the overlay also reads cleanly
 * when summoned from the legacy dark dashboard chrome.
 *
 * Mid-session safety: rendered as a fixed overlay (z-index 1000); the
 * underlying session DOM is not unmounted, no route change. Closing
 * returns the player to the same DM turn they paused on.
 *
 * Props:
 *   character    — character row (must include `id`, `survival_intensity`)
 *   context      — 'home' | 'session'  (drives exit-button label)
 *   onClose      — () => void
 *   onSaved      — optional, called after successful PUT with the updated character row
 */

const SURVIVAL_POSITIONS = [
  {
    key: 'off',
    label: 'Off',
    rom: 'I',
    body: 'Survival mechanics are fully disabled. No starvation, no dehydration, weather is atmosphere only. For when the story is the point and rations are not.'
  },
  {
    key: 'lenient',
    label: 'Lenient',
    rom: 'II',
    body: 'Survival exists as flavor. Hunger and thirst rarely punish; weather presses gently. The journey can be hard without being a ledger.'
  },
  {
    key: 'standard',
    label: 'Standard',
    rom: 'III',
    body: 'Realistic survival pressure. Default rules, default thresholds. The world keeps an honest accounting of what you carry.'
  },
  {
    key: 'strict',
    label: 'Strict',
    rom: 'IV',
    body: 'Survival genuinely matters. Tighter thresholds, harsher weather, less forgiveness. Choose your camps, ration your skins.'
  }
]

const COMBAT_POSITIONS = [
  { key: 'off',      label: 'Off',      rom: 'I',   body: 'Encounters resolve narratively, without rolls or hit-point pressure.' },
  { key: 'lenient',  label: 'Lenient',  rom: 'II',  body: 'Combat happens, but the dice lean kind. Foes hit softer; flight is freely available.' },
  { key: 'standard', label: 'Standard', rom: 'III', body: 'Default 5e tuning. CR-appropriate encounters, written-rules damage and saves.' },
  { key: 'strict',   label: 'Strict',   rom: 'IV',  body: 'Lethal pressure. Tighter resource budgets, smarter foes, fewer second chances.' }
]

const VALID_INTENSITIES = ['off', 'lenient', 'standard', 'strict']

function FourPosDial({ positions, value, onChange, disabled }) {
  const active = positions.find(p => p.key === value) || positions[2]
  return (
    <div className={`dial${disabled ? ' dial-disabled' : ''}`}>
      <div className="dial-track" role="radiogroup" aria-disabled={disabled || undefined}>
        {positions.map(p => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={p.key === value}
            className={`dial-pos${p.key === value ? ' on' : ''}`}
            onClick={() => { if (!disabled && onChange) onChange(p.key) }}
            disabled={disabled}
          >
            <span className="tick" />
            <span className="dial-rom">{p.rom}</span>
            <span className="dial-label">{p.label}</span>
          </button>
        ))}
      </div>
      <div className="dial-explain">
        <strong>{active.label}</strong>
        {active.body}
      </div>
    </div>
  )
}

/**
 * Format the "Saved · X" stamp with relative-time decay per the brief
 * (§4 Save behavior). `savedAt` is a Date or null. Returns the suffix
 * text only ("just now", "a moment ago", "5m ago", "1h ago") — caller
 * prepends "Saved · ".
 */
function relativeSavedLabel(savedAt, now) {
  if (!savedAt) return ''
  const ms = now - savedAt.getTime()
  if (ms < 8000)        return 'just now'
  if (ms < 30000)       return 'a moment ago'
  const min = Math.floor(ms / 60000)
  if (min < 1)          return 'less than 1m ago'
  if (min < 60)         return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24)          return `${hr}h ago`
  return 'earlier today'
}

export default function SettingsOverlay({ character, context = 'home', onClose, onSaved }) {
  // Local optimistic state — dial click updates the value immediately, the
  // PUT chases. Initial value falls back to 'standard' to match the
  // server-side default (migration 052).
  const initial = useMemo(() => {
    const v = character?.survival_intensity
    return VALID_INTENSITIES.includes(v) ? v : 'standard'
  }, [character?.survival_intensity, character?.id])

  const [survivalValue, setSurvivalValue] = useState(initial)
  const [savedAt, setSavedAt] = useState(null)
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())

  // Keep local state in sync if the character row changes underneath us
  // (e.g. the parent refetches and passes a different character object).
  useEffect(() => { setSurvivalValue(initial); setSavedAt(null); setError(null) }, [initial])

  // Re-render every 15s so the "Saved · just now" stamp decays. Cheap
  // because the overlay is only mounted while open.
  useEffect(() => {
    if (!savedAt) return undefined
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [savedAt])

  // Esc-to-close — matches the × and "Done"/"Back to game" buttons.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && onClose) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSurvivalChange = useCallback(async (next) => {
    if (!character?.id) {
      setError('No active character — can’t save settings.')
      return
    }
    if (next === survivalValue) return
    setSurvivalValue(next)
    setError(null)
    try {
      const res = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ survival_intensity: next })
      })
      if (!res.ok) {
        const data = await res.json().catch(() => null)
        throw new Error(data?.error || `PUT failed (HTTP ${res.status})`)
      }
      const updated = await res.json().catch(() => null)
      const stamp = new Date()
      setSavedAt(stamp)
      setNow(stamp.getTime())
      if (onSaved && updated) onSaved(updated)
    } catch (err) {
      setError(err.message || 'Could not save change.')
      // Roll back optimistic update on failure
      setSurvivalValue(survivalValue)
    }
  }, [character?.id, survivalValue, onSaved])

  const exitLabel = context === 'session' ? 'Back to game' : 'Done'
  const characterName = composeCharacterName(character)
  const stampSuffix = relativeSavedLabel(savedAt, now)

  // Stop scrim-click from propagating into the underlying app, and let
  // a click on the scrim (but not the sheet) dismiss the overlay.
  const onScrimClick = (e) => { if (e.target === e.currentTarget && onClose) onClose() }

  return (
    <div
      className="settings-overlay-root"
      role="dialog"
      aria-modal="true"
      aria-label="Settings"
      onClick={onScrimClick}
    >
      <div className="settings-sheet">
        <div className="settings-head">
          <div>
            <div className="for-line">
              Settings for <span className="name">{characterName}</span>
            </div>
            <h1>House rules</h1>
            <p className="lede">
              How heavy this world rests on your character. Adjust the dials; changes take at the next breath.
            </p>
          </div>
          <button className="dismiss-x" aria-label={exitLabel} onClick={onClose} type="button">×</button>
        </div>

        <div className="settings-section">
          <div className="sec-head">
            <span className="sec-eyebrow">Gameplay</span>
            <span className="sec-rule" />
            <span className="sec-count">02</span>
          </div>

          <div className="setting">
            <div className="setting-row">
              <div>
                <h3 className="setting-name">Survival intensity</h3>
                <p className="setting-blurb">
                  How firmly hunger, thirst, and weather hold your character to account.
                </p>
              </div>
              <div className="setting-meta">
                {error
                  ? <span style={{ color: '#a14040' }}>Couldn’t save · retry</span>
                  : savedAt
                    ? <span className="saved">Saved · {stampSuffix}</span>
                    : <span style={{ fontStyle: 'italic', fontFamily: 'var(--serif)', textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>Apply on click</span>}
              </div>
            </div>
            <FourPosDial
              positions={SURVIVAL_POSITIONS}
              value={survivalValue}
              onChange={handleSurvivalChange}
            />
          </div>

          <div className="setting">
            <div className="setting-row">
              <div>
                <h3 className="setting-name">Combat difficulty</h3>
                <p className="setting-blurb">
                  How hard the world swings back when steel is drawn. The control is drawn but quiet.
                </p>
              </div>
              <div className="setting-meta">
                <span className="coming-soon">Coming soon</span>
              </div>
            </div>
            {/* Placeholder dial. Pointed at 'standard' so the value is
               meaningful when the feature lights up in Phase 4. */}
            <FourPosDial positions={COMBAT_POSITIONS} value="standard" disabled />
          </div>
        </div>

        <div className="future-list">
          <div className="lbl">Also planned</div>
          <div className="items">
            <span className="item">Encounter pacing</span>
            <span className="sep">·</span>
            <span className="item">Accessibility</span>
            <span className="sep">·</span>
            <span className="item">Audio</span>
            <span className="sep">·</span>
            <span className="item">Developer toggles</span>
          </div>
        </div>

        <div className="settings-foot">
          <span className="foot-note">Changes apply per character. Each life keeps its own house rules.</span>
          <span className="spacer" />
          <button className="btn" type="button" onClick={onClose}>{exitLabel}</button>
        </div>
      </div>
    </div>
  )
}

function composeCharacterName(c) {
  if (!c) return '—'
  const composed = [c.first_name, c.last_name].filter(Boolean).join(' ').trim()
  return composed || c.name || c.nickname || `Character #${c.id}`
}

export { SURVIVAL_POSITIONS, COMBAT_POSITIONS }
