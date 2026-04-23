import { useState } from 'react'

/**
 * PreludeThemeCommitCard (v1.0.77).
 *
 * The "Choose Your Path" card rendered inline at Ch3 wrap-up. Receives an
 * offer shape from the server — `{ leading, alternatives[], wildcard,
 * reason, trajectoryScores[] }` — and lets the player commit to a theme,
 * pick "Other" for the full list, or defer ("See where it goes").
 *
 * On commit, POSTs to /api/prelude/:id/commit-theme and fires onCommit()
 * so the parent can mark the card resolved and keep the session moving.
 *
 * Theme labels are pulled from the server's ALL_THEME_IDS list via a
 * minimal hardcoded map here — keeping the client from having to import
 * server-side progression data. If the list grows, update both.
 */

// Short human labels for theme ids — mirror of server/data/themes.js id→name.
const THEME_LABELS = {
  soldier: 'Soldier',
  sage: 'Sage',
  criminal: 'Criminal',
  acolyte: 'Acolyte',
  charlatan: 'Charlatan',
  entertainer: 'Entertainer',
  noble: 'Noble',
  outlander: 'Outlander',
  sailor: 'Sailor',
  far_traveler: 'Far Traveler',
  haunted_one: 'Haunted One',
  guild_artisan: 'Guild Artisan',
  clan_crafter: 'Clan Crafter',
  hermit: 'Hermit',
  investigator: 'Investigator',
  city_watch: 'City Watch',
  knight_of_the_order: 'Knight of the Order',
  mercenary_veteran: 'Mercenary Veteran',
  urban_bounty_hunter: 'Urban Bounty Hunter',
  folk_hero: 'Folk Hero',
  urchin: 'Urchin'
}

const ALL_THEME_IDS = Object.keys(THEME_LABELS)

function themeLabel(id) {
  return THEME_LABELS[id] || id.replace(/_/g, ' ')
}

export default function PreludeThemeCommitCard({ characterId, offer, onCommit }) {
  const [picked, setPicked] = useState(null)
  const [otherValue, setOtherValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [resolvedTo, setResolvedTo] = useState(null)

  if (!offer) return null

  const commit = async (themeId, source) => {
    setSubmitting(true)
    setError('')
    try {
      const resp = await fetch(`/api/prelude/${characterId}/commit-theme`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme: themeId, source })
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        throw new Error(body.error || `Commit failed (${resp.status})`)
      }
      setResolvedTo(themeId === null ? 'deferred' : themeLabel(themeId))
      if (onCommit) onCommit({ theme: themeId, source })
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Post-commit display.
  if (resolvedTo) {
    return (
      <div style={{
        margin: '0 0 1rem',
        padding: '0.85rem 1rem',
        background: 'rgba(139, 92, 246, 0.1)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '8px',
        fontSize: '0.85rem',
        color: '#c4b5fd'
      }}>
        ✦ Path chosen: <strong style={{ color: '#e9d5ff' }}>{resolvedTo}</strong>. The story ahead shapes to this.
      </div>
    )
  }

  const { leading, alternatives = [], wildcard, reason } = offer

  // Build the primary button list — leading + alternatives + wildcard
  // (de-duplicated, omitting any nulls).
  const primaryOptions = [leading, ...alternatives, wildcard]
    .filter((t, i, arr) => t && arr.indexOf(t) === i)

  return (
    <div style={{
      margin: '0 0 1rem',
      padding: '1rem 1.15rem',
      background: 'rgba(139, 92, 246, 0.1)',
      border: '2px solid rgba(139, 92, 246, 0.5)',
      borderRadius: '10px'
    }}>
      <div style={{ fontSize: '0.75rem', color: '#c4b5fd', fontWeight: 700, letterSpacing: '0.08em', marginBottom: '0.35rem', textTransform: 'uppercase' }}>
        ⚑ Choose Your Path
      </div>
      <p style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', color: '#e4e4e4', lineHeight: 1.5 }}>
        Your choices so far have shaped who you are becoming. Commit to a theme — it shapes the departure at Chapter 4's end and carries forward as your theme when the primary campaign begins.
      </p>
      {reason && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.78rem', color: '#a5a5a5', fontStyle: 'italic' }}>
          {reason}
        </p>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {primaryOptions.map(themeId => {
          const isLeading = themeId === leading
          const isWildcard = themeId === wildcard
          const isPicked = picked === themeId
          return (
            <button
              key={themeId}
              onClick={() => setPicked(themeId)}
              disabled={submitting}
              style={{
                padding: '0.5rem 0.85rem',
                background: isPicked ? 'rgba(139, 92, 246, 0.35)' : 'rgba(255, 255, 255, 0.04)',
                border: isPicked
                  ? '2px solid #a78bfa'
                  : isLeading ? '1px solid rgba(196, 181, 253, 0.5)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                color: isPicked ? '#e9d5ff' : '#d4d4d4',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '0.88rem',
                fontWeight: isLeading ? 600 : 400
              }}
            >
              {themeLabel(themeId)}
              {isLeading && <span style={{ fontSize: '0.65rem', marginLeft: '0.35rem', color: '#c4b5fd' }}>(leading)</span>}
              {isWildcard && <span style={{ fontSize: '0.65rem', marginLeft: '0.35rem', color: '#fbbf24' }}>(wildcard)</span>}
            </button>
          )
        })}
      </div>

      <div style={{ marginBottom: '0.75rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.8rem', color: '#a5a5a5' }}>Other:</label>
        <select
          value={otherValue}
          onChange={e => {
            setOtherValue(e.target.value)
            if (e.target.value) setPicked(e.target.value)
          }}
          disabled={submitting}
          style={{
            flex: 1,
            padding: '0.35rem 0.5rem',
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            color: '#d4d4d4',
            borderRadius: '4px',
            fontSize: '0.85rem'
          }}
        >
          <option value="">(full list of 21 themes)</option>
          {ALL_THEME_IDS.map(id => (
            <option key={id} value={id}>{themeLabel(id)}</option>
          ))}
        </select>
      </div>

      {error && (
        <p style={{ color: '#fca5a5', fontSize: '0.82rem', margin: '0 0 0.5rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => picked && commit(picked, picked === leading ? 'leading' : picked === wildcard ? 'wildcard' : otherValue ? 'other' : 'alternative')}
          disabled={!picked || submitting}
          style={{
            padding: '0.55rem 1rem',
            background: picked ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)',
            border: '1px solid #8b5cf6',
            color: 'white',
            borderRadius: '6px',
            cursor: picked && !submitting ? 'pointer' : 'not-allowed',
            fontSize: '0.88rem',
            fontWeight: 600
          }}
        >
          {submitting ? 'Committing…' : picked ? `Commit to ${themeLabel(picked)}` : 'Commit'}
        </button>
        <button
          onClick={() => commit(null, 'defer')}
          disabled={submitting}
          style={{
            padding: '0.55rem 1rem',
            background: 'rgba(107, 114, 128, 0.15)',
            border: '1px solid rgba(107, 114, 128, 0.4)',
            color: '#d1d5db',
            borderRadius: '6px',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '0.85rem'
          }}
        >
          See where it goes
        </button>
      </div>
    </div>
  )
}
