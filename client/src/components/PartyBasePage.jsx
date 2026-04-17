import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// PARTY BASE PAGE
// ============================================================================
// Manages stronghold, upgrades, staff, long-term projects, events, and
// notoriety/heat for a character. Tabbed interface.
// ============================================================================

const ACCENT = '#b45309'
const ACCENT_LIGHT = '#d97706'
const ACCENT_DIM = '#92400e'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'buildings', label: 'Buildings' },
  { key: 'staff', label: 'Staff' },
  { key: 'projects', label: 'Projects' },
  { key: 'events', label: 'Events' },
  { key: 'notoriety', label: 'Notoriety' }
]

// F1: category + subtype picker options (authoritative list)
const BASE_CATEGORY_OPTIONS = {
  martial: {
    name: 'Martial', icon: '🏰',
    description: 'Fortifications and strongholds. Built for defense and garrison.',
    subtypes: [
      { key: 'watchtower', name: 'Watchtower', icon: '🗼', slots: 3 },
      { key: 'outpost', name: 'Outpost', icon: '⛺', slots: 5 },
      { key: 'keep', name: 'Keep', icon: '🏯', slots: 8 },
      { key: 'fortress', name: 'Fortress', icon: '🏰', slots: 14 },
      { key: 'castle', name: 'Castle', icon: '🏰', slots: 20 }
    ]
  },
  civilian: {
    name: 'Civilian', icon: '🏛️',
    description: 'Halls, manors, and trade houses.',
    subtypes: [
      { key: 'tavern', name: 'Tavern', icon: '🍺', slots: 3 },
      { key: 'hall', name: 'Hall', icon: '🏛️', slots: 6 },
      { key: 'manor', name: 'Manor', icon: '🏡', slots: 10 }
    ]
  },
  arcane: {
    name: 'Arcane', icon: '🔮',
    description: 'Towers and academies of magical study.',
    subtypes: [
      { key: 'wizard_tower', name: 'Wizard Tower', icon: '🗼', slots: 5 },
      { key: 'academy', name: 'Academy', icon: '📚', slots: 10 }
    ]
  },
  sanctified: {
    name: 'Sanctified', icon: '⛪',
    description: 'Temples, chapels, and monasteries.',
    subtypes: [
      { key: 'chapel', name: 'Chapel', icon: '⛪', slots: 4 },
      { key: 'temple', name: 'Temple', icon: '⛪', slots: 8 },
      { key: 'sanctuary', name: 'Sanctuary', icon: '🛕', slots: 12 }
    ]
  }
}

const BASE_TYPE_INFO = {
  tavern: { icon: '🍺', label: 'Tavern' },
  guild_hall: { icon: '⚔️', label: 'Guild Hall' },
  wizard_tower: { icon: '🗼', label: 'Wizard Tower' },
  temple: { icon: '⛪', label: 'Temple' },
  thieves_den: { icon: '🗝️', label: "Thieves' Den" },
  manor: { icon: '🏰', label: 'Manor Estate' }
}

const STATUS_COLORS = {
  establishing: '#f59e0b',
  active: '#22c55e',
  damaged: '#ef4444',
  abandoned: '#666'
}

const SEVERITY_COLORS = {
  trivial: '#6b7280',
  minor: '#f59e0b',
  moderate: '#f97316',
  major: '#ef4444',
  critical: '#dc2626'
}

const CATEGORY_COLORS = {
  criminal: '#ef4444',
  political: '#8b5cf6',
  arcane: '#6366f1',
  religious: '#f59e0b',
  military: '#64748b'
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  page: {
    padding: '1.5rem',
    maxWidth: '1100px',
    margin: '0 auto',
    fontFamily: '"Courier New", Courier, monospace',
    color: '#e0e0e0'
  },
  header: { marginBottom: '1.5rem' },
  title: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: ACCENT_LIGHT,
    marginBottom: '0.25rem'
  },
  subtitle: { fontSize: '0.95rem', color: '#999' },
  tabBar: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    borderBottom: `2px solid #333`
  },
  tab: (active) => ({
    padding: '0.6rem 1rem',
    background: active ? ACCENT : 'transparent',
    color: active ? '#fff' : '#aaa',
    border: 'none',
    borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.9rem',
    fontWeight: active ? '700' : '400',
    transition: 'all 0.15s'
  }),
  card: {
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1rem'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '700',
    color: ACCENT_LIGHT,
    marginBottom: '0.5rem'
  },
  row: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '0.5rem',
    alignItems: 'center'
  },
  label: { color: '#999', minWidth: '100px' },
  value: { color: '#e0e0e0' },
  btn: (variant = 'primary') => ({
    padding: '0.4rem 0.8rem',
    background: variant === 'primary' ? ACCENT : variant === 'danger' ? '#dc2626' : '#333',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem'
  }),
  input: {
    padding: '0.4rem 0.6rem',
    background: '#111',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.9rem'
  },
  select: {
    padding: '0.4rem 0.6rem',
    background: '#111',
    border: '1px solid #444',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.9rem'
  },
  progressBar: (pct, color = ACCENT) => ({
    height: '8px',
    background: '#333',
    borderRadius: '4px',
    overflow: 'hidden',
    flex: 1,
    position: 'relative'
  }),
  progressFill: (pct, color = ACCENT) => ({
    height: '100%',
    width: `${Math.min(100, pct)}%`,
    background: color,
    borderRadius: '4px',
    transition: 'width 0.3s'
  }),
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: '1rem'
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.15rem 0.5rem',
    background: color + '22',
    color: color,
    borderRadius: '12px',
    fontSize: '0.75rem',
    fontWeight: '600',
    border: `1px solid ${color}44`
  }),
  empty: {
    textAlign: 'center',
    padding: '2rem',
    color: '#666',
    fontStyle: 'italic'
  }
}

// ============================================================================
// CLOCK VISUALIZATION
// ============================================================================

function ClockSegments({ filled, total, size = 60, color = ACCENT }) {
  const segments = []
  const radius = size / 2 - 2
  const cx = size / 2
  const cy = size / 2

  for (let i = 0; i < total; i++) {
    const startAngle = (i / total) * 360 - 90
    const endAngle = ((i + 1) / total) * 360 - 90
    const startRad = (startAngle * Math.PI) / 180
    const endRad = (endAngle * Math.PI) / 180
    const x1 = cx + radius * Math.cos(startRad)
    const y1 = cy + radius * Math.sin(startRad)
    const x2 = cx + radius * Math.cos(endRad)
    const y2 = cy + radius * Math.sin(endRad)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0

    segments.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={i < filled ? color : '#333'}
        stroke="#222"
        strokeWidth="1"
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={cx} cy={cy} r={radius + 1} fill="none" stroke="#444" strokeWidth="1" />
      {segments}
      <text x={cx} y={cy + 4} textAnchor="middle" fill="#e0e0e0" fontSize="12" fontFamily="Courier New">
        {filled}/{total}
      </text>
    </svg>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PartyBasePage({ characterId, campaignId }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [base, setBase] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Establish form (F1: category + subtype)
  const [showEstablish, setShowEstablish] = useState(false)
  const [newBaseName, setNewBaseName] = useState('')
  const [newBaseCategory, setNewBaseCategory] = useState('martial')
  const [newBaseSubtype, setNewBaseSubtype] = useState('watchtower')
  const [newBaseDesc, setNewBaseDesc] = useState('')
  const [catalogs, setCatalogs] = useState({ categories: {}, subtypes: {} })

  // Buildings (F1: replaces the old base-level upgrades catalog)
  const [availableBuildings, setAvailableBuildings] = useState({ buildings: [], slotsUsed: 0, slotsTotal: 0 })

  // Staff hire form
  const [showHireForm, setShowHireForm] = useState(false)
  const [hireData, setHireData] = useState({ name: '', role: '', salary_gp: 5 })

  // Projects
  const [projects, setProjects] = useState([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '', description: '', project_type: 'research',
    total_segments: 6, skill_used: '', dc: 12
  })

  // Events
  const [events, setEvents] = useState([])
  const [showResolved, setShowResolved] = useState(false)

  // Notoriety
  const [notoriety, setNotoriety] = useState([])

  // Treasury
  const [treasuryAmount, setTreasuryAmount] = useState('')

  // ─── DATA LOADING ──────────────────────────────────────

  const loadBase = useCallback(async () => {
    try {
      const res = await fetch(`/api/base/${characterId}/${campaignId}`)
      const data = await res.json()
      setBase(data)
      if (!data) setShowEstablish(true)
    } catch (e) {
      setError(e.message)
    }
  }, [characterId, campaignId])

  const loadProjects = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${characterId}/${campaignId}`)
      const data = await res.json()
      setProjects(data)
    } catch (e) {
      console.error('Error loading projects:', e)
    }
  }, [characterId, campaignId])

  const loadNotoriety = useCallback(async () => {
    try {
      const res = await fetch(`/api/notoriety/${characterId}/${campaignId}`)
      const data = await res.json()
      setNotoriety(data)
    } catch (e) {
      console.error('Error loading notoriety:', e)
    }
  }, [characterId, campaignId])

  const loadEvents = useCallback(async () => {
    if (!base) return
    try {
      const res = await fetch(`/api/base/${base.id}/events?resolved=${showResolved}`)
      const data = await res.json()
      setEvents(data)
    } catch (e) {
      console.error('Error loading events:', e)
    }
  }, [base, showResolved])

  const loadAvailableBuildings = useCallback(async () => {
    if (!base) return
    try {
      const res = await fetch(`/api/base/${base.id}/buildings/available`)
      const data = await res.json()
      setAvailableBuildings(data || { buildings: [], slotsUsed: 0, slotsTotal: 0 })
    } catch (e) {
      console.error('Error loading available buildings:', e)
    }
  }, [base])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadBase(), loadProjects(), loadNotoriety()])
      .finally(() => setLoading(false))
  }, [loadBase, loadProjects, loadNotoriety])

  useEffect(() => { loadEvents() }, [loadEvents])
  useEffect(() => { loadAvailableBuildings() }, [loadAvailableBuildings])

  // ─── ACTIONS ───────────────────────────────────────────

  const createBase = async () => {
    if (!newBaseName.trim()) return
    try {
      const res = await fetch('/api/base', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characterId, campaignId,
          name: newBaseName,
          category: newBaseCategory,
          subtype: newBaseSubtype,
          description: newBaseDesc
        })
      })
      if (res.ok) {
        setShowEstablish(false)
        setNewBaseName('')
        setNewBaseDesc('')
        await loadBase()
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to create base')
        setTimeout(() => setError(null), 4000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const installBuilding = async (building_type) => {
    try {
      const res = await fetch(`/api/base/${base.id}/buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_type })
      })
      if (res.ok) {
        await loadBase()
        await loadAvailableBuildings()
      } else {
        const err = await res.json()
        setError(err.error || 'Failed to install building')
        setTimeout(() => setError(null), 4000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const advanceBuildingConstruction = async (buildingId, hours) => {
    try {
      const res = await fetch(`/api/base/${base.id}/buildings/${buildingId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hours })
      })
      if (res.ok) {
        await loadBase()
        await loadAvailableBuildings()
      } else {
        const err = await res.json()
        setError(err.error)
        setTimeout(() => setError(null), 3000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const hireStaff = async () => {
    if (!hireData.name || !hireData.role) return
    try {
      const res = await fetch(`/api/base/${base.id}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hireData)
      })
      if (res.ok) {
        setShowHireForm(false)
        setHireData({ name: '', role: '', salary_gp: 5 })
        await loadBase()
      } else {
        const err = await res.json()
        setError(err.error)
        setTimeout(() => setError(null), 3000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const fireStaff = async (index) => {
    try {
      await fetch(`/api/base/${base.id}/staff/${index}`, { method: 'DELETE' })
      await loadBase()
    } catch (e) {
      setError(e.message)
    }
  }

  const modifyTreasury = async (amount) => {
    try {
      const res = await fetch(`/api/base/${base.id}/treasury`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: amount > 0 ? 'Deposit' : 'Withdrawal' })
      })
      if (res.ok) {
        setTreasuryAmount('')
        await loadBase()
      } else {
        const err = await res.json()
        setError(err.error)
        setTimeout(() => setError(null), 3000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const resolveEvent = async (eventId, resolution) => {
    try {
      await fetch(`/api/base/${base.id}/events/${eventId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution })
      })
      await loadEvents()
    } catch (e) {
      setError(e.message)
    }
  }

  const createProject = async () => {
    if (!newProject.name) return
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId, campaignId, ...newProject })
      })
      if (res.ok) {
        setShowNewProject(false)
        setNewProject({ name: '', description: '', project_type: 'research', total_segments: 6, skill_used: '', dc: 12 })
        await loadProjects()
      } else {
        const err = await res.json()
        setError(err.error)
        setTimeout(() => setError(null), 3000)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const abandonProject = async (projectId) => {
    try {
      await fetch(`/api/projects/${projectId}`, { method: 'DELETE' })
      await loadProjects()
    } catch (e) {
      setError(e.message)
    }
  }

  // ─── RENDER HELPERS ────────────────────────────────────

  const staff = base ? (typeof base.staff === 'string' ? JSON.parse(base.staff || '[]') : base.staff || []) : []
  const perks = base ? (typeof base.active_perks === 'string' ? JSON.parse(base.active_perks || '[]') : base.active_perks || []) : []
  const buildings = base?.buildings || []
  const typeInfo = base ? {
    icon: base.subtypeInfo?.icon || '🏠',
    label: base.subtypeInfo?.name || base.subtype || 'Base'
  } : null

  const renownPct = base ? (() => {
    const thresholds = [0, 25, 60, 120, 200, 999]
    const current = base.renown || 0
    const nextThreshold = thresholds[base.level] || 999
    const prevThreshold = thresholds[(base.level || 1) - 1] || 0
    return Math.min(100, ((current - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
  })() : 0

  // ─── LOADING / ERROR ──────────────────────────────────

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>Loading stronghold data...</div>
      </div>
    )
  }

  // ─── ESTABLISH BASE FORM ──────────────────────────────

  if (!base || showEstablish) {
    const selectedCategory = BASE_CATEGORY_OPTIONS[newBaseCategory]
    const selectedSubtype = selectedCategory?.subtypes.find(s => s.key === newBaseSubtype)
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <div style={styles.title}>Establish Your Stronghold</div>
          <div style={styles.subtitle}>Choose a category → subtype. Buildings get installed inside after establishment.</div>
        </div>

        {error && <div style={{ ...styles.card, borderColor: '#ef4444', color: '#ef4444', marginBottom: '1rem' }}>{error}</div>}

        {/* Step 1: Category */}
        <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Category</div>
        <div style={{ ...styles.grid, marginBottom: '1rem' }}>
          {Object.entries(BASE_CATEGORY_OPTIONS).map(([key, cat]) => (
            <div
              key={key}
              onClick={() => {
                setNewBaseCategory(key)
                setNewBaseSubtype(cat.subtypes[0].key)
              }}
              style={{
                ...styles.card,
                borderColor: newBaseCategory === key ? ACCENT : '#333',
                cursor: 'pointer', transition: 'border-color 0.2s'
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{cat.icon}</div>
              <div style={{ fontWeight: '700', color: newBaseCategory === key ? ACCENT_LIGHT : '#e0e0e0', marginBottom: '0.25rem' }}>
                {cat.name}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#888' }}>{cat.description}</div>
            </div>
          ))}
        </div>

        {/* Step 2: Subtype */}
        <div style={{ fontSize: '0.85rem', color: '#999', marginBottom: '0.5rem' }}>Subtype — determines building slot capacity and upkeep</div>
        <div style={{ ...styles.grid, marginBottom: '1rem' }}>
          {selectedCategory?.subtypes.map(sub => (
            <div
              key={sub.key}
              onClick={() => setNewBaseSubtype(sub.key)}
              style={{
                ...styles.card,
                borderColor: newBaseSubtype === sub.key ? ACCENT : '#333',
                cursor: 'pointer', transition: 'border-color 0.2s',
                padding: '0.75rem'
              }}
            >
              <div style={{ fontSize: '1.5rem', marginBottom: '0.35rem' }}>{sub.icon}</div>
              <div style={{ fontWeight: '600', color: newBaseSubtype === sub.key ? ACCENT_LIGHT : '#e0e0e0' }}>
                {sub.name}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#888', marginTop: '0.2rem' }}>
                {sub.slots} building slot{sub.slots === 1 ? '' : 's'}
              </div>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <div style={styles.row}>
            <span style={styles.label}>Name:</span>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={newBaseName}
              onChange={e => setNewBaseName(e.target.value)}
              placeholder={`e.g. Greywatch ${selectedSubtype?.name || 'Hold'}`}
            />
          </div>
          <div style={{ ...styles.row, marginTop: '0.5rem' }}>
            <span style={styles.label}>Description:</span>
            <input
              style={{ ...styles.input, flex: 1 }}
              value={newBaseDesc}
              onChange={e => setNewBaseDesc(e.target.value)}
              placeholder="Optional description..."
            />
          </div>
          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
            <button style={styles.btn('primary')} onClick={createBase} disabled={!newBaseName.trim()}>
              Establish {selectedSubtype?.name || 'Base'}
            </button>
            {base && <button style={styles.btn('secondary')} onClick={() => setShowEstablish(false)}>Cancel</button>}
          </div>
        </div>
      </div>
    )
  }

  // ─── MAIN VIEW ─────────────────────────────────────────

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>{typeInfo.icon} {base.name}</div>
        <div style={styles.subtitle}>
          {typeInfo.label} — Level {base.level} —{' '}
          <span style={{ color: STATUS_COLORS[base.status] || '#999' }}>{base.status}</span>
        </div>
      </div>

      {error && (
        <div style={{ ...styles.card, borderColor: '#ef4444', color: '#ef4444', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.key} style={styles.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'buildings' && renderBuildings()}
      {activeTab === 'staff' && renderStaff()}
      {activeTab === 'projects' && renderProjects()}
      {activeTab === 'events' && renderEvents()}
      {activeTab === 'notoriety' && renderNotoriety()}
    </div>
  )

  // ─── TAB: OVERVIEW ─────────────────────────────────────

  function renderOverview() {
    return (
      <div>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
          <div style={styles.card}>
            <div style={{ color: '#999', fontSize: '0.8rem' }}>Treasury</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#fbbf24' }}>{base.gold_treasury || 0} gp</div>
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.5rem', alignItems: 'center' }}>
              <input
                style={{ ...styles.input, width: '80px' }}
                type="number"
                value={treasuryAmount}
                onChange={e => setTreasuryAmount(e.target.value)}
                placeholder="gp"
              />
              <button style={styles.btn('primary')} onClick={() => modifyTreasury(parseInt(treasuryAmount) || 0)}>+</button>
              <button style={styles.btn('danger')} onClick={() => modifyTreasury(-(parseInt(treasuryAmount) || 0))}>-</button>
            </div>
          </div>

          <div style={styles.card}>
            <div style={{ color: '#999', fontSize: '0.8rem' }}>Monthly Upkeep</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>{base.monthly_upkeep_gp || 10} gp</div>
          </div>

          <div style={styles.card}>
            <div style={{ color: '#999', fontSize: '0.8rem' }}>Staff</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{staff.length}</div>
          </div>

          <div style={styles.card}>
            <div style={{ color: '#999', fontSize: '0.8rem' }}>Buildings</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
              {buildings.filter(b => b.status === 'completed').length} / {buildings.length}
            </div>
          </div>
        </div>

        {/* Renown Bar */}
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: 'space-between' }}>
            <span style={styles.cardTitle}>Renown</span>
            <span style={{ color: '#999', fontSize: '0.85rem' }}>{base.renown || 0} pts (Level {base.level})</span>
          </div>
          <div style={styles.progressBar(renownPct)}>
            <div style={styles.progressFill(renownPct, ACCENT)} />
          </div>
        </div>

        {/* Active Perks */}
        {perks.length > 0 && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Active Perks</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {perks.map((p, i) => (
                <span key={i} style={styles.badge(ACCENT)}>
                  {p.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Description / Notes */}
        {base.description && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Description</div>
            <div style={{ color: '#ccc', whiteSpace: 'pre-wrap' }}>{base.description}</div>
          </div>
        )}
      </div>
    )
  }

  // ─── TAB: UPGRADES ─────────────────────────────────────

  function renderBuildings() {
    const inProgress = buildings.filter(b => b.status === 'in_progress')
    const completed = buildings.filter(b => b.status === 'completed')
    const damaged = buildings.filter(b => b.status === 'damaged')

    return (
      <div>
        {/* Slot usage header */}
        <div style={{ ...styles.card, marginBottom: '1rem' }}>
          <div style={styles.row}>
            <span style={styles.label}>Building Slots:</span>
            <strong style={{ color: ACCENT_LIGHT }}>
              {availableBuildings.slotsUsed}/{availableBuildings.slotsTotal}
            </strong>
            <span style={{ flex: 1 }} />
            <span style={{ color: '#888', fontSize: '0.8rem' }}>
              {base.category} · {base.subtypeInfo?.name || base.subtype}
            </span>
          </div>
        </div>

        {/* In Progress */}
        {inProgress.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ ...styles.cardTitle, marginBottom: '0.5rem' }}>Under Construction</div>
            {inProgress.map(b => {
              const pct = Math.max(0, Math.min(100, Math.floor((b.hours_invested / (b.hours_required || 1)) * 100)))
              return (
                <div key={b.id} style={styles.card}>
                  <div style={{ ...styles.row, justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: '700' }}>{b.typeInfo?.icon || '🏗'} {b.name || b.building_type}</span>
                    <span style={{ color: '#999', fontSize: '0.85rem' }}>{pct}%</span>
                  </div>
                  <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                    {b.hours_invested} / {b.hours_required} hours invested
                  </div>
                  <div style={styles.progressBar(pct)}>
                    <div style={styles.progressFill(pct, '#22c55e')} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {[8, 16, 32].map(h => (
                      <button
                        key={h}
                        style={{ ...styles.btn('secondary'), padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                        onClick={() => advanceBuildingConstruction(b.id, h)}
                      >
                        +{h} hours
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ ...styles.cardTitle, marginBottom: '0.5rem' }}>Built</div>
            <div style={styles.grid}>
              {completed.map(b => (
                <div key={b.id} style={{ ...styles.card, borderColor: '#22c55e44' }}>
                  <div style={{ fontWeight: '700', marginBottom: '0.2rem' }}>
                    {b.typeInfo?.icon || '🏛'} {b.name || b.building_type}
                  </div>
                  {b.typeInfo?.description && (
                    <div style={{ color: '#888', fontSize: '0.78rem', marginBottom: '0.35rem' }}>
                      {b.typeInfo.description}
                    </div>
                  )}
                  {(b.perks_granted || []).length > 0 && (
                    <div style={{ color: ACCENT, fontSize: '0.75rem' }}>
                      Perks: {(b.perks_granted || []).map(p => p.replace(/_/g, ' ')).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {damaged.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ ...styles.cardTitle, marginBottom: '0.5rem' }}>Damaged</div>
            {damaged.map(b => (
              <div key={b.id} style={{ ...styles.card, borderColor: '#ef444444' }}>
                <div style={{ fontWeight: '700' }}>
                  {b.typeInfo?.icon} {b.name || b.building_type}
                </div>
                <div style={{ color: '#ef4444', fontSize: '0.78rem' }}>Damaged — needs repair</div>
              </div>
            ))}
          </div>
        )}

        {/* Install new building */}
        <div style={{ ...styles.cardTitle, marginBottom: '0.5rem' }}>Install New Building</div>
        {availableBuildings.slotsUsed >= availableBuildings.slotsTotal ? (
          <div style={styles.empty}>All building slots are used. Expand to a larger subtype or demolish an existing building.</div>
        ) : availableBuildings.buildings.length === 0 ? (
          <div style={styles.empty}>No buildings available for this category.</div>
        ) : (
          <div style={styles.grid}>
            {availableBuildings.buildings.filter(b => !b.installed).map(b => (
              <div key={b.key} style={styles.card}>
                <div style={{ fontWeight: '700', marginBottom: '0.2rem' }}>
                  {b.icon} {b.name}
                </div>
                <div style={{ color: '#888', fontSize: '0.78rem', marginBottom: '0.4rem' }}>
                  {b.description}
                </div>
                <div style={{ color: '#fbbf24', fontSize: '0.82rem' }}>
                  {b.baseGoldCost} gp · {b.baseHoursRequired} hours · {b.slots} slot{b.slots === 1 ? '' : 's'}
                </div>
                {(b.perks || []).length > 0 && (
                  <div style={{ color: ACCENT, fontSize: '0.76rem', marginTop: '0.25rem' }}>
                    Grants: {b.perks.map(p => p.replace(/_/g, ' ')).join(', ')}
                  </div>
                )}
                <button
                  style={{ ...styles.btn('primary'), marginTop: '0.5rem', width: '100%' }}
                  onClick={() => installBuilding(b.key)}
                  disabled={base.gold_treasury < b.baseGoldCost}
                >
                  {base.gold_treasury < b.baseGoldCost ? `Need ${b.baseGoldCost}gp` : 'Install'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── TAB: STAFF ────────────────────────────────────────

  function renderStaff() {
    return (
      <div>
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={styles.cardTitle}>Staff ({staff.length})</div>
          <button style={styles.btn('primary')} onClick={() => setShowHireForm(true)}>+ Hire</button>
        </div>

        {showHireForm && (
          <div style={{ ...styles.card, borderColor: ACCENT }}>
            <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>Hire New Staff</div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                style={{ ...styles.input, flex: 1 }}
                value={hireData.name}
                onChange={e => setHireData({ ...hireData, name: e.target.value })}
                placeholder="Name"
              />
              <input
                style={{ ...styles.input, flex: 1 }}
                value={hireData.role}
                onChange={e => setHireData({ ...hireData, role: e.target.value })}
                placeholder="Role (cook, guard, etc.)"
              />
              <input
                style={{ ...styles.input, width: '80px' }}
                type="number"
                value={hireData.salary_gp}
                onChange={e => setHireData({ ...hireData, salary_gp: parseInt(e.target.value) || 0 })}
                placeholder="Salary"
              />
              <button style={styles.btn('primary')} onClick={hireStaff}>Hire</button>
              <button style={styles.btn('secondary')} onClick={() => setShowHireForm(false)}>Cancel</button>
            </div>
          </div>
        )}

        {staff.length === 0 ? (
          <div style={styles.empty}>No staff hired yet</div>
        ) : (
          staff.map((s, i) => (
            <div key={i} style={{ ...styles.card, ...styles.row, justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontWeight: '700' }}>{s.name}</span>
                <span style={{ color: '#888', marginLeft: '0.5rem' }}>{s.role}</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ color: '#fbbf24', fontSize: '0.85rem' }}>{s.salary_gp} gp/mo</span>
                <button style={styles.btn('danger')} onClick={() => fireStaff(i)}>Fire</button>
              </div>
            </div>
          ))
        )}
      </div>
    )
  }

  // ─── TAB: PROJECTS ─────────────────────────────────────

  function renderProjects() {
    const activeProjects = projects.filter(p => p.status === 'active')
    const completedProjects = projects.filter(p => p.status === 'completed')
    const abandonedProjects = projects.filter(p => p.status === 'abandoned')

    return (
      <div>
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={styles.cardTitle}>Long-Term Projects</div>
          <button
            style={styles.btn('primary')}
            onClick={() => setShowNewProject(true)}
            disabled={activeProjects.length >= 3}
          >
            + New Project {activeProjects.length >= 3 ? '(max 3)' : ''}
          </button>
        </div>

        {showNewProject && (
          <div style={{ ...styles.card, borderColor: ACCENT }}>
            <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>New Project</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <input
                style={styles.input}
                value={newProject.name}
                onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                placeholder="Project name"
              />
              <input
                style={styles.input}
                value={newProject.description}
                onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                placeholder="Description (optional)"
              />
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  style={{ ...styles.select, flex: 1 }}
                  value={newProject.project_type}
                  onChange={e => setNewProject({ ...newProject, project_type: e.target.value })}
                >
                  <option value="research">Research</option>
                  <option value="construction">Construction</option>
                  <option value="networking">Networking</option>
                  <option value="training">Training</option>
                  <option value="investigation">Investigation</option>
                </select>
                <select
                  style={{ ...styles.select, width: '100px' }}
                  value={newProject.total_segments}
                  onChange={e => setNewProject({ ...newProject, total_segments: parseInt(e.target.value) })}
                >
                  <option value={4}>4 segments</option>
                  <option value={6}>6 segments</option>
                  <option value={8}>8 segments</option>
                  <option value={12}>12 segments</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  value={newProject.skill_used}
                  onChange={e => setNewProject({ ...newProject, skill_used: e.target.value })}
                  placeholder="Skill (arcana, persuasion, etc.)"
                />
                <input
                  style={{ ...styles.input, width: '80px' }}
                  type="number"
                  value={newProject.dc}
                  onChange={e => setNewProject({ ...newProject, dc: parseInt(e.target.value) || 12 })}
                  placeholder="DC"
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button style={styles.btn('primary')} onClick={createProject}>Create</button>
                <button style={styles.btn('secondary')} onClick={() => setShowNewProject(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Active Projects with Clock Visualization */}
        {activeProjects.length === 0 && !showNewProject ? (
          <div style={styles.empty}>No active projects. Start one to track long-term goals.</div>
        ) : (
          <div style={styles.grid}>
            {activeProjects.map(p => (
              <div key={p.id} style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <ClockSegments
                    filled={p.segments_filled}
                    total={p.total_segments}
                    color={ACCENT}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '700', marginBottom: '0.25rem' }}>{p.name}</div>
                    <div style={{ color: '#888', fontSize: '0.8rem' }}>
                      {p.project_type} — {p.skill_used || 'any'} DC {p.dc}
                    </div>
                    {p.description && (
                      <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.25rem' }}>{p.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                  <button style={{ ...styles.btn('danger'), fontSize: '0.75rem' }} onClick={() => abandonProject(p.id)}>
                    Abandon
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Completed Projects */}
        {completedProjects.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ ...styles.cardTitle, marginBottom: '0.5rem' }}>Completed</div>
            {completedProjects.map(p => (
              <div key={p.id} style={{ ...styles.card, borderColor: '#22c55e44' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <ClockSegments filled={p.total_segments} total={p.total_segments} color="#22c55e" size={40} />
                  <div>
                    <span style={{ fontWeight: '700' }}>{p.name}</span>
                    <span style={{ ...styles.badge('#22c55e'), marginLeft: '0.5rem' }}>Complete</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Abandoned Projects */}
        {abandonedProjects.length > 0 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div style={{ ...styles.cardTitle, marginBottom: '0.5rem', color: '#666' }}>Abandoned</div>
            {abandonedProjects.map(p => (
              <div key={p.id} style={{ ...styles.card, opacity: 0.5 }}>
                <span>{p.name}</span>
                <span style={{ color: '#666', marginLeft: '0.5rem' }}>
                  ({p.segments_filled}/{p.total_segments})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── TAB: EVENTS ───────────────────────────────────────

  function renderEvents() {
    return (
      <div>
        <div style={{ ...styles.row, justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div style={styles.cardTitle}>Base Events</div>
          <label style={{ color: '#999', fontSize: '0.85rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showResolved}
              onChange={e => setShowResolved(e.target.checked)}
              style={{ marginRight: '0.5rem' }}
            />
            Show Resolved
          </label>
        </div>

        {events.length === 0 ? (
          <div style={styles.empty}>No events yet. Events occur as your base grows in renown.</div>
        ) : (
          events.map(ev => (
            <div key={ev.id} style={{ ...styles.card, borderLeft: `3px solid ${SEVERITY_COLORS[ev.severity] || '#666'}` }}>
              <div style={{ ...styles.row, justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontWeight: '700' }}>{ev.title}</span>
                  <span style={{ ...styles.badge(SEVERITY_COLORS[ev.severity] || '#666'), marginLeft: '0.5rem' }}>
                    {ev.severity}
                  </span>
                </div>
                <span style={{ color: '#666', fontSize: '0.8rem' }}>Day {ev.game_day}</span>
              </div>
              {ev.description && (
                <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '0.25rem' }}>{ev.description}</div>
              )}
              {ev.gold_impact !== 0 && (
                <div style={{ color: ev.gold_impact > 0 ? '#22c55e' : '#ef4444', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {ev.gold_impact > 0 ? '+' : ''}{ev.gold_impact} gp
                </div>
              )}
              {!ev.resolved && (
                <button
                  style={{ ...styles.btn('primary'), marginTop: '0.5rem' }}
                  onClick={() => resolveEvent(ev.id, 'Resolved by player')}
                >
                  Resolve
                </button>
              )}
              {ev.resolved === 1 && ev.resolution && (
                <div style={{ color: '#22c55e', fontSize: '0.8rem', marginTop: '0.25rem', fontStyle: 'italic' }}>
                  Resolved: {ev.resolution}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    )
  }

  // ─── TAB: NOTORIETY ────────────────────────────────────

  function renderNotoriety() {
    const totalHeat = notoriety.reduce((sum, n) => sum + n.score, 0)

    return (
      <div>
        <div style={styles.card}>
          <div style={{ ...styles.row, justifyContent: 'space-between' }}>
            <div style={styles.cardTitle}>Total Heat</div>
            <span style={{ fontSize: '1.5rem', fontWeight: '700', color: totalHeat > 60 ? '#ef4444' : totalHeat > 30 ? '#f59e0b' : '#22c55e' }}>
              {totalHeat}
            </span>
          </div>
          <div style={{ color: '#888', fontSize: '0.85rem' }}>
            {totalHeat === 0 && 'Clean — no one is watching you'}
            {totalHeat > 0 && totalHeat <= 20 && 'Low profile — being careful pays off'}
            {totalHeat > 20 && totalHeat <= 40 && 'Rumors are circulating — watch your step'}
            {totalHeat > 40 && totalHeat <= 60 && 'Moderate heat — you are being questioned'}
            {totalHeat > 60 && totalHeat <= 80 && 'High heat — bounty hunters and investigators'}
            {totalHeat > 80 && 'Critical — raids, arrest warrants, ambushes likely'}
          </div>
        </div>

        {notoriety.length === 0 ? (
          <div style={styles.empty}>No notoriety tracked. Heat accrues from criminal, political, or other provocative acts.</div>
        ) : (
          notoriety.map(n => {
            const catColor = CATEGORY_COLORS[n.category] || '#666'
            return (
              <div key={n.id} style={styles.card}>
                <div style={{ ...styles.row, justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontWeight: '700' }}>{n.source}</span>
                    <span style={{ ...styles.badge(catColor), marginLeft: '0.5rem' }}>{n.category}</span>
                  </div>
                  <span style={{ fontWeight: '700', color: n.score > 60 ? '#ef4444' : n.score > 30 ? '#f59e0b' : '#22c55e' }}>
                    {n.score}/100
                  </span>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={styles.progressBar(n.score, catColor)}>
                    <div style={styles.progressFill(n.score, catColor)} />
                  </div>
                </div>
                <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  {n.score <= 20 && 'Safe — no risk'}
                  {n.score > 20 && n.score <= 40 && 'Low risk (10%/day entanglement)'}
                  {n.score > 40 && n.score <= 60 && 'Medium risk (20%/day)'}
                  {n.score > 60 && n.score <= 80 && 'High risk (35%/day)'}
                  {n.score > 80 && 'Critical risk (50%/day)'}
                </div>
              </div>
            )
          })
        )}
      </div>
    )
  }
}
