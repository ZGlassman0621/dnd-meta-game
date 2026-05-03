import { useState, useEffect, useMemo } from 'react'
import { getRaceColorTraits } from '../../data/raceColorTraits.js'

/**
 * Race-aware picker for Step 7's eye / hair / skin / build fields.
 *
 * Same shape as RaceAwareDimensionPicker but reads from raceColorTraits
 * instead of raceDemographics. Per PM review (2026-05-02): race-aware
 * dropdowns with a "Custom…" affordance honoring player authoring agency.
 *
 * Props:
 *   - field: 'eyes' | 'hair' | 'skin' | 'build'
 *   - raceId: string | null  (race id from races.json keys)
 *   - value: string  (current value)
 *   - onChange: (newValue: string) => void
 */
export default function RaceAwareColorPicker({ field, raceId, value, onChange }) {
  const traits = useMemo(
    () => raceId ? getRaceColorTraits(raceId) : null,
    [raceId]
  )
  const options = traits ? (traits[field] || []) : []

  const isKnownOption = options.some(o => o.value === value)
  const [customMode, setCustomMode] = useState(!isKnownOption && !!value)

  useEffect(() => {
    if (!traits) return
    const known = options.some(o => o.value === value)
    if (known) setCustomMode(false)
  }, [raceId, value])

  // No race picked yet — fall back to plain text input.
  if (!traits) {
    return (
      <input
        type="text"
        className="input"
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
          className="input"
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
      className="select"
      value={value || ''}
      onChange={e => {
        const v = e.target.value
        if (v === '__custom__') {
          setCustomMode(true)
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
  if (field === 'eyes') return 'eye color'
  if (field === 'hair') return 'hair color'
  if (field === 'skin') return 'skin tone'
  if (field === 'build') return 'a build'
  return field
}

function placeholderFor(field) {
  if (field === 'eyes') return 'e.g., Hazel'
  if (field === 'hair') return 'e.g., Black'
  if (field === 'skin') return 'e.g., Olive'
  if (field === 'build') return 'e.g., Lean'
  return ''
}
