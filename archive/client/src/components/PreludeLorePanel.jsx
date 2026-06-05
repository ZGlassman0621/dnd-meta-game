import { useEffect, useState, useMemo } from 'react'

/**
 * PreludeLorePanel — dedicated slide-in reference for canon/lore.
 *
 * v1.0.75. The canon ledger already existed inside the Setup panel (v1.0.60),
 * but it's buried and compact — the player couldn't easily reference world
 * events the DM introduced (e.g., "The Reaving" mentioned in an adult's
 * dialogue with no explanation). This panel surfaces the same data in a
 * more usable form:
 *
 *   - More prominent top-level access (Lore button in the session top bar)
 *   - Larger typography, more breathing room
 *   - Category-grouped with a jump-to-category row
 *   - Search filter across subject + fact text
 *   - Event category promoted — that's where world-context facts live
 *
 * Future (v2): stratify fact descriptions by PC background — what a noble
 * child vs. common adult knows/was taught about an event like The Reaving.
 * User-confirmed high-value but deferred.
 */

const CATEGORY_ORDER = ['event', 'location', 'npc', 'relationship', 'trait', 'item']
const CATEGORY_META = {
  event: { label: 'Events & Lore', color: '#fbbf24', hint: 'World happenings, named historical events, regional history, threats' },
  location: { label: 'Places', color: '#60a5fa', hint: 'Settlements, landmarks, holds, regions' },
  npc: { label: 'People', color: '#a78bfa', hint: 'Named characters with established facts' },
  relationship: { label: 'Relationships', color: '#f472b6', hint: 'How people relate to each other' },
  trait: { label: 'Traits', color: '#34d399', hint: 'Defining characteristics of people or the PC' },
  item: { label: 'Items', color: '#c084fc', hint: 'Named objects, heirlooms, tokens' }
}

export default function PreludeLorePanel({ characterId, visible, onClose, docked = false }) {
  const [canonFacts, setCanonFacts] = useState([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState('')

  // Fetch canon facts when the panel opens (or character changes).
  useEffect(() => {
    if (!visible || !characterId) return
    let cancelled = false
    ;(async () => {
      try {
        const resp = await fetch(`/api/prelude/${characterId}/canon-facts`)
        if (!resp.ok) throw new Error(`Failed to load lore (${resp.status})`)
        const data = await resp.json()
        if (!cancelled) setCanonFacts(Array.isArray(data.canonFacts) ? data.canonFacts : [])
      } catch (e) {
        if (!cancelled) setError(e.message)
      }
    })()
    return () => { cancelled = true }
  }, [characterId, visible])

  const filtered = useMemo(() => {
    if (!filter.trim()) return canonFacts
    const needle = filter.trim().toLowerCase()
    return canonFacts.filter(f =>
      (f.subject || '').toLowerCase().includes(needle) ||
      (f.fact || '').toLowerCase().includes(needle)
    )
  }, [canonFacts, filter])

  const byCategory = useMemo(() => {
    const m = new Map()
    for (const f of filtered) {
      const cat = f.category || 'event'
      if (!m.has(cat)) m.set(cat, [])
      m.get(cat).push(f)
    }
    return m
  }, [filtered])

  if (!visible) return null

  // v1.0.82 — docked mode uses an inline/sticky container (shares the flex
  // row with the narrative column). Overlay mode (default) uses the old
  // position:fixed slide-in — kept for back-compat if any consumer still
  // uses it. The close button is only rendered in overlay mode; docked
  // mode relies on the host page's toggle button in the top bar.
  const containerStyle = docked
    ? {
        position: 'sticky',
        top: '0.5rem',
        height: 'calc(100vh - 1rem)',
        background: 'rgba(15,15,20,0.85)',
        border: '1px solid rgba(251,191,36,0.3)',
        borderRadius: '8px',
        overflowY: 'auto',
        padding: '1.1rem 1rem 2rem'
      }
    : {
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '460px',
        maxWidth: '90vw',
        background: 'rgba(15,15,20,0.98)',
        borderLeft: '1px solid rgba(251,191,36,0.4)',
        boxShadow: '-4px 0 20px rgba(0,0,0,0.5)',
        overflowY: 'auto',
        zIndex: 100,
        padding: '1.25rem 1.1rem 2rem'
      }

  return (
    <div style={containerStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.75rem' }}>
        <h3 style={{ margin: 0, color: '#fbbf24', fontSize: '1.1rem' }}>Lore & Canon</h3>
        {!docked && (
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(251,191,36,0.3)',
              color: '#fbbf24',
              padding: '0.2rem 0.6rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.8rem'
            }}
          >Close</button>
        )}
      </div>

      <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.9rem' }}>
        What the DM has registered as ground truth in this story. Re-checked every turn to prevent drift.
        Events cover named world history (The Reaving, past wars, etc.) so you have context for what's being referenced.
      </p>

      <input
        type="text"
        placeholder="Search subject or fact…"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        style={{
          width: '100%',
          padding: '0.5rem 0.7rem',
          marginBottom: '1rem',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(251,191,36,0.3)',
          borderRadius: '6px',
          color: '#e4e4e4',
          fontSize: '0.85rem'
        }}
      />

      {error && (
        <div style={{ color: '#fca5a5', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
          {error}
        </div>
      )}

      {canonFacts.length === 0 && !error && (
        <p style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
          No canon facts yet. The DM will establish them as you play — named NPCs, places, events, items.
        </p>
      )}

      {CATEGORY_ORDER.filter(c => byCategory.has(c)).map(cat => {
        const meta = CATEGORY_META[cat]
        const facts = byCategory.get(cat)
        return (
          <div key={cat} style={{ marginBottom: '1.3rem' }}>
            <div style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: '0.4rem',
              paddingBottom: '0.3rem',
              borderBottom: `1px solid ${meta.color}33`
            }}>
              <h4 style={{
                margin: 0,
                color: meta.color,
                fontSize: '0.82rem',
                fontWeight: 700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase'
              }}>{meta.label}</h4>
              <span style={{ color: '#666', fontSize: '0.72rem' }}>{facts.length}</span>
            </div>
            <p style={{ color: '#888', fontSize: '0.72rem', margin: '0 0 0.5rem', fontStyle: 'italic' }}>
              {meta.hint}
            </p>
            {facts.map(f => (
              <div
                key={f.id}
                style={{
                  marginBottom: '0.55rem',
                  padding: '0.55rem 0.7rem',
                  background: 'rgba(255,255,255,0.025)',
                  border: `1px solid ${meta.color}22`,
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  lineHeight: 1.5
                }}
              >
                <div style={{ color: meta.color, fontWeight: 600, marginBottom: '0.15rem' }}>
                  {f.subject}
                </div>
                <div style={{ color: '#ddd' }}>{f.fact}</div>
                {f.established_age != null && (
                  <div style={{ color: '#666', fontSize: '0.7rem', marginTop: '0.25rem' }}>
                    established at age {f.established_age}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
