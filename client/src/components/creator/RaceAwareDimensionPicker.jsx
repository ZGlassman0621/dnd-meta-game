import { useState, useEffect, useMemo } from 'react'
import { getRaceDemographics } from '../../data/raceDemographics.js'

/**
 * Race-aware picker for Step 7's age / height / weight fields.
 *
 * Per PM review (2026-05-02):
 *   - Default render: dropdown of race-appropriate values (PHB-derived).
 *   - "Custom…" affordance at the end of the dropdown opens a text
 *     input — honors player authoring agency for unusual characters
 *     (200-year-old polymorphed dragon halflings, etc.).
 *   - Dual-unit display in labels (imperial primary, metric in parens):
 *     5'10" (178 cm) / 165 lb (75 kg).
 *
 * Falls back to a plain text input when the player hasn't picked a race
 * yet (manual-mode pre-Step-2). Once race is set, switches to dropdown
 * mode automatically. If the player had a value typed before picking
 * race, that value is preserved as the active selection (or as the
 * Custom value if it doesn't match any dropdown option).
 *
 * Props:
 *   - field: 'age' | 'height' | 'weight'
 *   - raceId: string | null  (race id from races.json keys)
 *   - value: string  (current value, in dropdown's `value` shape — e.g.,
 *                     '25' for age, "5'10\"" for height, '165 lb' for weight)
 *   - onChange: (newValue: string) => void
 */
export default function RaceAwareDimensionPicker({ field, raceId, value, onChange }) {
  const demographics = useMemo(
    () => raceId ? getRaceDemographics(raceId) : null,
    [raceId]
  )
  const options = demographics ? demographics[field] : []

  const isKnownOption = options.some(o => o.value === value)
  const [customMode, setCustomMode] = useState(!isKnownOption && !!value)

  // When race changes, re-evaluate whether the current value is a
  // known option for the new race. If not, drop the custom-mode flag
  // back to false so the picker shows the dropdown again.
  useEffect(() => {
    if (!demographics) return
    const known = options.some(o => o.value === value)
    if (known) setCustomMode(false)
  }, [raceId, value])

  // No race picked yet — fall back to plain text input (Hearth .finput).
  if (!demographics) {
    return (
      <input
        type="text"
        className="finput"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholderFor(field)}
      />
    )
  }

  if (customMode) {
    return (
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          className="finput"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholderFor(field)}
          style={{ flex: 1 }}
          autoFocus
        />
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            setCustomMode(false)
            // If the typed value happens to match a known option, keep it;
            // otherwise reset to first option of the dropdown.
            if (!options.some(o => o.value === value)) {
              onChange(options[0]?.value || '')
            }
          }}
          style={{ flexShrink: 0 }}
          title="Switch back to the recommended values"
        >
          Use recommended
        </button>
      </div>
    )
  }

  return (
    <select
      className="aselect"
      style={{ width: '100%' }}
      value={value || ''}
      onChange={e => {
        const v = e.target.value
        if (v === '__custom__') {
          setCustomMode(true)
          // Keep the current value as the starting custom text — gives
          // the player a starting point to edit rather than a blank.
        } else {
          onChange(v)
        }
      }}
    >
      <option value="">{`Choose ${labelFor(field)}…`}</option>
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  )
}

function labelFor(field) {
  if (field === 'age') return 'an age'
  if (field === 'height') return 'a height'
  if (field === 'weight') return 'a weight'
  return field
}

function placeholderFor(field) {
  if (field === 'age') return 'e.g., 27'
  if (field === 'height') return `e.g., 5'10"`
  if (field === 'weight') return 'e.g., 165 lb'
  return ''
}
