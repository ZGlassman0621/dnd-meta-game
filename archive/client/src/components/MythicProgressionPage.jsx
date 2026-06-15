import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// MYTHIC PROGRESSION PAGE
// ============================================================================
// Manages mythic tiers, paths, abilities, trials, piety, epic boons,
// and legendary items for a character. Tabbed interface.
// ============================================================================

const API_BASE = '/api/mythic'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'path', label: 'Path' },
  { key: 'abilities', label: 'Abilities' },
  { key: 'trials', label: 'Trials' },
  { key: 'piety', label: 'Piety' },
  { key: 'boons', label: 'Epic Boons' },
  { key: 'items', label: 'Legendary Items' }
]

const TIER_COLORS = {
  0: '#666',
  1: '#3498db',
  2: '#2ecc71',
  3: '#f39c12',
  4: '#e74c3c',
  5: '#ffd700'
}

const OUTCOME_OPTIONS = [
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'redirected', label: 'Redirected' }
]

const ABILITY_SCORES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']

const ITEM_STATES = ['dormant', 'awakened', 'exalted', 'mythic']

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
  header: {
    marginBottom: '1.5rem'
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: '700',
    color: '#ff6b35',
    marginBottom: '0.25rem'
  },
  subtitle: {
    fontSize: '0.95rem',
    color: '#999'
  },
  tabBar: {
    display: 'flex',
    gap: '0.25rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    borderBottom: '2px solid #333'
  },
  tab: (active) => ({
    padding: '0.6rem 1rem',
    background: active ? '#ff6b35' : 'transparent',
    color: active ? '#fff' : '#aaa',
    border: 'none',
    borderBottom: active ? '2px solid #ff6b35' : '2px solid transparent',
    cursor: 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem',
    fontWeight: active ? '700' : '400',
    transition: 'all 0.2s',
    marginBottom: '-2px'
  }),
  card: {
    background: '#16213e',
    border: '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1.25rem',
    marginBottom: '1rem'
  },
  cardTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#ff6b35',
    marginBottom: '0.75rem'
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem'
  },
  label: {
    color: '#999',
    fontSize: '0.85rem'
  },
  value: {
    color: '#e0e0e0',
    fontSize: '0.95rem',
    fontWeight: '600'
  },
  powerBarOuter: {
    width: '100%',
    height: '24px',
    background: '#1a1a2e',
    borderRadius: '12px',
    border: '1px solid #333',
    overflow: 'hidden',
    marginTop: '0.5rem',
    marginBottom: '0.5rem'
  },
  powerBarInner: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: `linear-gradient(90deg, #ff6b35, #ff8c5a)`,
    borderRadius: '12px',
    transition: 'width 0.4s ease'
  }),
  powerBarLabel: {
    textAlign: 'center',
    fontSize: '0.8rem',
    color: '#ccc',
    marginTop: '0.25rem'
  },
  btn: (color = '#ff6b35', disabled = false) => ({
    padding: '0.5rem 1rem',
    background: disabled ? '#444' : color,
    color: disabled ? '#888' : '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem',
    fontWeight: '600',
    opacity: disabled ? 0.6 : 1,
    transition: 'opacity 0.2s'
  }),
  btnSmall: (color = '#ff6b35', disabled = false) => ({
    padding: '0.35rem 0.75rem',
    background: disabled ? '#444' : color,
    color: disabled ? '#888' : '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.8rem',
    fontWeight: '600',
    opacity: disabled ? 0.6 : 1
  }),
  input: {
    width: '100%',
    padding: '0.5rem',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem',
    minHeight: '80px',
    resize: 'vertical',
    boxSizing: 'border-box'
  },
  select: {
    padding: '0.5rem',
    background: '#1a1a2e',
    border: '1px solid #333',
    borderRadius: '4px',
    color: '#e0e0e0',
    fontFamily: '"Courier New", Courier, monospace',
    fontSize: '0.85rem'
  },
  error: {
    color: '#e74c3c',
    fontSize: '0.85rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '4px',
    marginBottom: '1rem'
  },
  success: {
    color: '#2ecc71',
    fontSize: '0.85rem',
    padding: '0.5rem 0.75rem',
    background: 'rgba(46, 204, 113, 0.1)',
    border: '1px solid rgba(46, 204, 113, 0.3)',
    borderRadius: '4px',
    marginBottom: '1rem'
  },
  loading: {
    color: '#999',
    textAlign: 'center',
    padding: '2rem',
    fontSize: '0.95rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '1rem'
  },
  badge: (color) => ({
    display: 'inline-block',
    padding: '0.2rem 0.5rem',
    background: `${color}33`,
    color: color,
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '600',
    marginRight: '0.4rem'
  }),
  divider: {
    borderTop: '1px solid #333',
    margin: '1rem 0'
  },
  tierBadge: (tier) => ({
    display: 'inline-block',
    padding: '0.25rem 0.6rem',
    background: `${TIER_COLORS[tier] || '#666'}22`,
    color: TIER_COLORS[tier] || '#666',
    border: `1px solid ${TIER_COLORS[tier] || '#666'}66`,
    borderRadius: '4px',
    fontSize: '0.8rem',
    fontWeight: '700'
  }),
  abilityCard: {
    background: '#1a1a2e',
    border: '1px solid #2a3a5c',
    borderRadius: '6px',
    padding: '0.75rem 1rem',
    marginBottom: '0.5rem'
  },
  abilityName: {
    fontSize: '0.95rem',
    fontWeight: '600',
    color: '#ffd700',
    marginBottom: '0.25rem'
  },
  abilityDesc: {
    fontSize: '0.82rem',
    color: '#bbb',
    lineHeight: '1.4'
  },
  pathCard: (selected) => ({
    background: selected ? '#1a2a4e' : '#16213e',
    border: selected ? '2px solid #ff6b35' : '1px solid #2a3a5c',
    borderRadius: '8px',
    padding: '1rem',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }),
  formGroup: {
    marginBottom: '0.75rem'
  },
  formLabel: {
    display: 'block',
    color: '#999',
    fontSize: '0.8rem',
    marginBottom: '0.25rem'
  },
  emptyState: {
    textAlign: 'center',
    color: '#666',
    padding: '2rem',
    fontSize: '0.9rem'
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MythicProgressionPage({ character, onCharacterUpdated }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Core mythic status (from GET /api/mythic/:characterId)
  const [mythicStatus, setMythicStatus] = useState(null)

  // Static data
  const [allPaths, setAllPaths] = useState([])
  const [allBoons, setAllBoons] = useState([])
  const [allDeities, setAllDeities] = useState({})

  // Selected path detail (expanded)
  const [expandedPath, setExpandedPath] = useState(null)
  const [pathDetail, setPathDetail] = useState(null)

  // Forms
  const [trialForm, setTrialForm] = useState({ name: '', description: '', outcome: 'passed' })
  const [powerForm, setPowerForm] = useState({ amount: 1, reason: '' })
  const [pietyDeitySelect, setPietyDeitySelect] = useState('')
  const [pietyAdjustForm, setPietyAdjustForm] = useState({ deityName: '', amount: 1, reason: '' })
  const [pietyHistory, setPietyHistory] = useState({})
  const [boonAbilityScore, setBoonAbilityScore] = useState('STR')
  const [itemForm, setItemForm] = useState({
    itemName: '', itemBaseType: '',
    dormantProperties: '', awakenedProperties: '',
    exaltedProperties: '', mythicProperties: '',
    awakenedDeed: '', exaltedDeed: '', mythicDeed: ''
  })
  const [advanceItemId, setAdvanceItemId] = useState(null)
  const [advanceItemState, setAdvanceItemState] = useState('')
  const [advanceItemDeed, setAdvanceItemDeed] = useState('')
  const [showNewItemForm, setShowNewItemForm] = useState(false)

  // Submitting states
  const [submitting, setSubmitting] = useState(false)

  // -------------------------------------------------------------------
  // FETCH
  // -------------------------------------------------------------------

  const fetchMythicStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/${character.id}`)
      if (!res.ok) throw new Error('Failed to fetch mythic status')
      const data = await res.json()
      setMythicStatus(data)
    } catch (err) {
      setError(err.message)
    }
  }, [character.id])

  const fetchStaticData = useCallback(async () => {
    try {
      const [pathsRes, boonsRes, deitiesRes] = await Promise.all([
        fetch(`${API_BASE}/paths`),
        fetch(`${API_BASE}/epic-boons`),
        fetch(`${API_BASE}/deities`)
      ])
      if (pathsRes.ok) setAllPaths(await pathsRes.json())
      if (boonsRes.ok) setAllBoons(await boonsRes.json())
      if (deitiesRes.ok) setAllDeities(await deitiesRes.json())
    } catch (err) {
      console.error('Failed to fetch static mythic data:', err)
    }
  }, [])

  const fetchPathDetail = useCallback(async (pathKey) => {
    try {
      const res = await fetch(`${API_BASE}/paths/${pathKey}`)
      if (!res.ok) return null
      return await res.json()
    } catch {
      return null
    }
  }, [])

  const fetchPietyHistory = useCallback(async (deityName) => {
    try {
      const res = await fetch(`${API_BASE}/piety/${character.id}/history?deity=${encodeURIComponent(deityName)}&limit=50`)
      if (!res.ok) return []
      return await res.json()
    } catch {
      return []
    }
  }, [character.id])

  // Initial load
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      await Promise.all([fetchMythicStatus(), fetchStaticData()])
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [fetchMythicStatus, fetchStaticData])

  // Clear success message after a few seconds
  useEffect(() => {
    if (successMsg) {
      const t = setTimeout(() => setSuccessMsg(null), 4000)
      return () => clearTimeout(t)
    }
  }, [successMsg])

  // -------------------------------------------------------------------
  // ACTIONS
  // -------------------------------------------------------------------

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setError(null)
  }

  const apiPost = async (url, body = {}) => {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Request failed')
      return data
    } catch (err) {
      setError(err.message)
      return null
    } finally {
      setSubmitting(false)
    }
  }

  const handleInitialize = async () => {
    const result = await apiPost(`${API_BASE}/${character.id}/initialize`)
    if (result) {
      showSuccess('Mythic tracking initialized')
      await fetchMythicStatus()
    }
  }

  const handleSelectPath = async (pathKey) => {
    const result = await apiPost(`${API_BASE}/${character.id}/select-path`, { pathKey })
    if (result) {
      showSuccess(result.message || 'Path selected')
      await fetchMythicStatus()
    }
  }

  const handleAdvanceTier = async () => {
    const result = await apiPost(`${API_BASE}/${character.id}/advance-tier`, {})
    if (result) {
      showSuccess(result.message || 'Tier advanced')
      await fetchMythicStatus()
    }
  }

  const handleRecordTrial = async () => {
    if (!trialForm.name.trim()) {
      setError('Trial name is required')
      return
    }
    const result = await apiPost(`${API_BASE}/${character.id}/record-trial`, {
      name: trialForm.name.trim(),
      description: trialForm.description.trim(),
      outcome: trialForm.outcome
    })
    if (result) {
      showSuccess(result.message || 'Trial recorded')
      setTrialForm({ name: '', description: '', outcome: 'passed' })
      await fetchMythicStatus()
    }
  }

  const handleUsePower = async () => {
    if (powerForm.amount < 1) {
      setError('Amount must be at least 1')
      return
    }
    const result = await apiPost(`${API_BASE}/${character.id}/use-power`, {
      amount: powerForm.amount
    })
    if (result) {
      showSuccess(result.message || 'Mythic power used')
      setPowerForm({ amount: 1, reason: '' })
      await fetchMythicStatus()
    }
  }

  const handleRest = async () => {
    const result = await apiPost(`${API_BASE}/${character.id}/rest`)
    if (result) {
      showSuccess('Mythic power restored on rest')
      await fetchMythicStatus()
    }
  }

  const handleInitializePiety = async () => {
    if (!pietyDeitySelect) {
      setError('Select a deity')
      return
    }
    const result = await apiPost(`${API_BASE}/piety/${character.id}/initialize`, {
      deityName: pietyDeitySelect
    })
    if (result) {
      showSuccess(result.message || 'Piety initialized')
      setPietyDeitySelect('')
      await fetchMythicStatus()
    }
  }

  const handleAdjustPiety = async () => {
    if (!pietyAdjustForm.deityName) {
      setError('Select a deity')
      return
    }
    const result = await apiPost(`${API_BASE}/piety/${character.id}/adjust`, {
      deityName: pietyAdjustForm.deityName,
      amount: parseInt(pietyAdjustForm.amount) || 0,
      reason: pietyAdjustForm.reason.trim()
    })
    if (result) {
      showSuccess(result.message || 'Piety adjusted')
      setPietyAdjustForm({ deityName: '', amount: 1, reason: '' })
      await fetchMythicStatus()
    }
  }

  const handleLoadPietyHistory = async (deityName) => {
    const history = await fetchPietyHistory(deityName)
    setPietyHistory(prev => ({ ...prev, [deityName]: history }))
  }

  const handleSelectBoon = async (boonKey) => {
    const result = await apiPost(`${API_BASE}/${character.id}/epic-boon`, {
      boonKey,
      abilityScoreBonus: boonAbilityScore
    })
    if (result) {
      showSuccess(result.message || 'Epic boon selected')
      await fetchMythicStatus()
    }
  }

  const handleCreateItem = async () => {
    if (!itemForm.itemName.trim()) {
      setError('Item name is required')
      return
    }
    const result = await apiPost(`${API_BASE}/${character.id}/legendary-item`, {
      itemName: itemForm.itemName.trim(),
      itemBaseType: itemForm.itemBaseType.trim(),
      dormantProperties: itemForm.dormantProperties.trim() || null,
      awakenedProperties: itemForm.awakenedProperties.trim() || null,
      exaltedProperties: itemForm.exaltedProperties.trim() || null,
      mythicProperties: itemForm.mythicProperties.trim() || null,
      awakenedDeed: itemForm.awakenedDeed.trim() || null,
      exaltedDeed: itemForm.exaltedDeed.trim() || null,
      mythicDeed: itemForm.mythicDeed.trim() || null
    })
    if (result) {
      showSuccess(result.message || 'Legendary item created')
      setItemForm({
        itemName: '', itemBaseType: '',
        dormantProperties: '', awakenedProperties: '',
        exaltedProperties: '', mythicProperties: '',
        awakenedDeed: '', exaltedDeed: '', mythicDeed: ''
      })
      setShowNewItemForm(false)
      await fetchMythicStatus()
    }
  }

  const handleAdvanceItem = async (itemId) => {
    if (!advanceItemState) {
      setError('Select a new state')
      return
    }
    const result = await apiPost(`${API_BASE}/legendary-item/${itemId}/advance`, {
      newState: advanceItemState,
      deed: advanceItemDeed.trim() || null
    })
    if (result) {
      showSuccess(result.message || 'Item advanced')
      setAdvanceItemId(null)
      setAdvanceItemState('')
      setAdvanceItemDeed('')
      await fetchMythicStatus()
    }
  }

  // -------------------------------------------------------------------
  // DERIVED DATA
  // -------------------------------------------------------------------

  const isInitialized = mythicStatus?.initialized === true
  const tier = mythicStatus?.tier || 0
  const path = mythicStatus?.path || null
  const pathName = mythicStatus?.pathName || null
  const powerMax = mythicStatus?.mythicPowerMax || 0
  const powerUsed = mythicStatus?.mythicPowerUsed || 0
  const powerRemaining = mythicStatus?.mythicPowerRemaining || 0
  const powerPct = powerMax > 0 ? (powerRemaining / powerMax) * 100 : 0
  const surgeDie = mythicStatus?.surgeDie || 'd6'
  const trialsCompleted = mythicStatus?.trialsCompleted || 0
  const trialsRequired = mythicStatus?.trialsRequired || 0
  const canAdvanceTier = trialsCompleted >= trialsRequired && tier < 5
  const abilities = mythicStatus?.abilities || []
  const trials = mythicStatus?.trials || []
  const epicBoons = mythicStatus?.epicBoons || []
  const legendaryItems = mythicStatus?.legendaryItems || []
  const pietyRecords = mythicStatus?.piety || []
  const selectedBoonKeys = epicBoons.map(b => b.boon_key)

  // -------------------------------------------------------------------
  // RENDER HELPERS
  // -------------------------------------------------------------------

  const renderError = () => error ? <div style={styles.error}>{error}</div> : null
  const renderSuccess = () => successMsg ? <div style={styles.success}>{successMsg}</div> : null

  // -------------------------------------------------------------------
  // TAB: OVERVIEW
  // -------------------------------------------------------------------

  const renderOverview = () => {
    if (!isInitialized) {
      return (
        <div style={{ ...styles.card, textAlign: 'center' }}>
          <div style={{ fontSize: '1.2rem', color: '#999', marginBottom: '1rem' }}>
            {character.name} has not yet awakened to mythic power.
          </div>
          <p style={{ color: '#777', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
            Initialize mythic tracking to begin the journey toward legendary power.
            This sets the character at Tier 0 (mortal) and allows recording trials, selecting paths,
            and advancing through mythic tiers.
          </p>
          <button
            style={styles.btn('#ff6b35', submitting)}
            onClick={handleInitialize}
            disabled={submitting}
          >
            {submitting ? 'Initializing...' : 'Awaken Mythic Potential'}
          </button>
        </div>
      )
    }

    const tierName = mythicStatus?.tierName || 'Mortal'

    return (
      <>
        {/* Summary Card */}
        <div style={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', color: TIER_COLORS[tier] || '#666', marginBottom: '0.25rem' }}>
                Tier {tier}: {tierName}
              </div>
              {pathName && (
                <div style={{ fontSize: '0.95rem', color: '#8b5cf6' }}>
                  Path of the {pathName}
                  {mythicStatus?.pathSubtitle && (
                    <span style={{ color: '#777', marginLeft: '0.5rem' }}>
                      -- {mythicStatus.pathSubtitle}
                    </span>
                  )}
                </div>
              )}
              {!path && tier > 0 && (
                <div style={{ fontSize: '0.85rem', color: '#f39c12', marginTop: '0.25rem' }}>
                  No path selected -- choose one in the Path tab
                </div>
              )}
              {tier === 0 && (
                <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                  Complete your first trial and advance to Tier 1 to unlock mythic abilities
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={styles.tierBadge(tier)}>Tier {tier}</span>
              {mythicStatus?.isLegend && (
                <span style={{ ...styles.badge('#ffd700'), marginLeft: '0.4rem' }}>LEGEND</span>
              )}
            </div>
          </div>
        </div>

        {/* Mythic Power */}
        {tier > 0 && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Mythic Power</div>
            <div style={styles.powerBarOuter}>
              <div style={styles.powerBarInner(powerPct)} />
            </div>
            <div style={styles.powerBarLabel}>
              {powerRemaining} / {powerMax} remaining (Surge Die: {surgeDie})
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  type="number"
                  min="1"
                  max={powerRemaining}
                  value={powerForm.amount}
                  onChange={e => setPowerForm(f => ({ ...f, amount: parseInt(e.target.value) || 1 }))}
                  style={{ ...styles.input, width: '60px' }}
                />
                <button
                  style={styles.btnSmall('#e74c3c', submitting || powerRemaining < 1)}
                  onClick={handleUsePower}
                  disabled={submitting || powerRemaining < 1}
                >
                  Spend
                </button>
              </div>
              <button
                style={styles.btnSmall('#2ecc71', submitting || powerRemaining === powerMax)}
                onClick={handleRest}
                disabled={submitting || powerRemaining === powerMax}
              >
                Long Rest (Restore)
              </button>
            </div>
          </div>
        )}

        {/* Trials Progress */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Trials Progress</div>
          <div style={styles.row}>
            <span style={styles.label}>Trials Completed</span>
            <span style={styles.value}>{trialsCompleted} / {trialsRequired}</span>
          </div>
          <div style={{ ...styles.powerBarOuter, height: '14px' }}>
            <div style={{
              ...styles.powerBarInner(trialsRequired > 0 ? (trialsCompleted / trialsRequired) * 100 : 0),
              background: canAdvanceTier ? 'linear-gradient(90deg, #2ecc71, #27ae60)' : 'linear-gradient(90deg, #3498db, #2980b9)'
            }} />
          </div>
          {canAdvanceTier && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ color: '#2ecc71', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                Trials complete -- ready to advance to Tier {tier + 1}!
              </div>
              <button
                style={styles.btn('#2ecc71', submitting)}
                onClick={handleAdvanceTier}
                disabled={submitting}
              >
                {submitting ? 'Advancing...' : `Advance to Tier ${tier + 1}`}
              </button>
            </div>
          )}
          {tier >= 5 && (
            <div style={{ color: '#ffd700', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Maximum tier reached -- Apotheosis
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div style={styles.grid}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Abilities</div>
            <div style={styles.value}>{abilities.length} active</div>
            <div style={{ color: '#777', fontSize: '0.8rem', marginTop: '0.25rem' }}>
              {abilities.filter(a => a.ability_type === 'base').length} base + {abilities.filter(a => a.ability_type === 'path').length} path
            </div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Epic Boons</div>
            <div style={styles.value}>{epicBoons.length} selected</div>
          </div>
          <div style={styles.card}>
            <div style={styles.cardTitle}>Legendary Items</div>
            <div style={styles.value}>{legendaryItems.length} items</div>
          </div>
        </div>
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: PATH
  // -------------------------------------------------------------------

  const renderPath = () => {
    const hasPath = !!path

    return (
      <>
        {/* Current path info */}
        {hasPath && (
          <div style={{ ...styles.card, borderColor: '#8b5cf6' }}>
            <div style={styles.cardTitle}>
              Current Path: {pathName}
            </div>
            {mythicStatus?.pathSubtitle && (
              <div style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                {mythicStatus.pathSubtitle}
              </div>
            )}
            <div style={{ color: '#999', fontSize: '0.8rem' }}>
              Path selected. Abilities granted per tier are shown in the Abilities tab.
            </div>
          </div>
        )}

        {/* Browse all paths */}
        <div style={styles.cardTitle}>
          {hasPath ? 'All Mythic Paths' : 'Select a Mythic Path'}
        </div>
        {!isInitialized && (
          <div style={{ color: '#f39c12', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Initialize mythic tracking in the Overview tab first.
          </div>
        )}
        <div style={styles.grid}>
          {allPaths.map(p => {
            const isCurrent = p.key === path
            const isExpanded = expandedPath === p.key

            return (
              <div
                key={p.key}
                style={styles.pathCard(isCurrent)}
                onClick={async () => {
                  if (expandedPath === p.key) {
                    setExpandedPath(null)
                    setPathDetail(null)
                  } else {
                    setExpandedPath(p.key)
                    const detail = await fetchPathDetail(p.key)
                    setPathDetail(detail)
                  }
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: '600', color: isCurrent ? '#ff6b35' : '#e0e0e0' }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#8b5cf6', marginBottom: '0.5rem' }}>
                      {p.subtitle}
                    </div>
                  </div>
                  {isCurrent && <span style={styles.badge('#ff6b35')}>ACTIVE</span>}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#aaa' }}>Best suited:</strong> {p.bestSuited}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.25rem' }}>
                  <strong style={{ color: '#aaa' }}>Core theme:</strong> {p.coreTheme}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999' }}>
                  <strong style={{ color: '#aaa' }}>Defining feature:</strong> {p.definingFeature}
                </div>
                {p.alignmentPreference && (
                  <div style={{ marginTop: '0.4rem' }}>
                    <span style={styles.badge('#f39c12')}>{p.alignmentPreference}</span>
                  </div>
                )}

                {/* Expanded detail with tier abilities */}
                {isExpanded && pathDetail && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #333', paddingTop: '0.75rem' }}>
                    {[1, 2, 3, 4, 5].map(t => {
                      const tierKey = `tier${t}`
                      const tierAbilities = pathDetail.abilities?.[tierKey]
                      if (!tierAbilities || tierAbilities.length === 0) return null
                      return (
                        <div key={t} style={{ marginBottom: '0.75rem' }}>
                          <div style={{ ...styles.tierBadge(t), marginBottom: '0.5rem' }}>Tier {t}</div>
                          {tierAbilities.map((ab, i) => (
                            <div key={i} style={{ marginLeft: '0.5rem', marginBottom: '0.4rem' }}>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffd700' }}>{ab.name}</div>
                              <div style={{ fontSize: '0.78rem', color: '#bbb' }}>{ab.description}</div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* Select button */}
                    {isInitialized && !hasPath && !isCurrent && (
                      <button
                        style={{ ...styles.btn('#8b5cf6', submitting), marginTop: '0.5rem' }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelectPath(p.key)
                        }}
                        disabled={submitting}
                      >
                        {submitting ? 'Selecting...' : `Choose ${p.name}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: ABILITIES
  // -------------------------------------------------------------------

  const renderAbilities = () => {
    if (!isInitialized || tier === 0) {
      return <div style={styles.emptyState}>No mythic abilities yet. Advance to Tier 1 to unlock your first abilities.</div>
    }

    // Group abilities by tier
    const grouped = {}
    abilities.forEach(a => {
      const t = a.tier_unlocked || 1
      if (!grouped[t]) grouped[t] = []
      grouped[t].push(a)
    })

    return (
      <>
        <div style={{ color: '#999', fontSize: '0.85rem', marginBottom: '1rem' }}>
          {abilities.length} active abilities across {Object.keys(grouped).length} tier(s)
        </div>
        {Object.keys(grouped).sort((a, b) => a - b).map(t => (
          <div key={t} style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={styles.tierBadge(parseInt(t))}>Tier {t}</span>
              <span style={{ color: '#777', fontSize: '0.8rem' }}>
                ({grouped[t].length} abilities)
              </span>
            </div>
            {grouped[t].map((ab, i) => (
              <div key={i} style={styles.abilityCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={styles.abilityName}>{ab.ability_name}</div>
                  <span style={styles.badge(ab.ability_type === 'base' ? '#3498db' : '#8b5cf6')}>
                    {ab.ability_type}
                  </span>
                </div>
                <div style={styles.abilityDesc}>{ab.description}</div>
                {ab.mechanical_effect && (
                  <div style={{ fontSize: '0.78rem', color: '#ff6b35', marginTop: '0.35rem' }}>
                    Mechanical: {ab.mechanical_effect}
                  </div>
                )}
                {ab.mythic_power_cost > 0 && (
                  <div style={{ fontSize: '0.78rem', color: '#f39c12', marginTop: '0.2rem' }}>
                    Cost: {ab.mythic_power_cost} MP
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: TRIALS
  // -------------------------------------------------------------------

  const renderTrials = () => {
    return (
      <>
        {/* Record new trial */}
        {isInitialized && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Record a New Trial</div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Trial Name *</label>
              <input
                style={styles.input}
                value={trialForm.name}
                onChange={e => setTrialForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Trial of the Burning Gate"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Description</label>
              <textarea
                style={styles.textarea}
                value={trialForm.description}
                onChange={e => setTrialForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What happened during the trial..."
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Outcome</label>
              <select
                style={styles.select}
                value={trialForm.outcome}
                onChange={e => setTrialForm(f => ({ ...f, outcome: e.target.value }))}
              >
                {OUTCOME_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <button
              style={styles.btn('#ff6b35', submitting || !trialForm.name.trim())}
              onClick={handleRecordTrial}
              disabled={submitting || !trialForm.name.trim()}
            >
              {submitting ? 'Recording...' : 'Record Trial'}
            </button>
          </div>
        )}

        {/* Trial history */}
        <div style={styles.cardTitle}>Trial History</div>
        {trials.length === 0 ? (
          <div style={styles.emptyState}>No trials recorded yet.</div>
        ) : (
          trials.map((trial, i) => (
            <div key={trial.id || i} style={styles.abilityCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#e0e0e0' }}>
                  {trial.trial_name || trial.name}
                </div>
                <span style={styles.badge(
                  trial.outcome === 'passed' ? '#2ecc71' :
                  trial.outcome === 'failed' ? '#e74c3c' : '#f39c12'
                )}>
                  {trial.outcome || 'unknown'}
                </span>
              </div>
              {(trial.trial_description || trial.description) && (
                <div style={{ fontSize: '0.82rem', color: '#bbb', marginTop: '0.3rem' }}>
                  {trial.trial_description || trial.description}
                </div>
              )}
              {trial.game_day && (
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                  Game Day {trial.game_day}
                </div>
              )}
            </div>
          ))
        )}
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: PIETY
  // -------------------------------------------------------------------

  const renderPiety = () => {
    const deityKeys = Object.keys(allDeities)
    const existingDeityNames = pietyRecords.map(p => p.deity_name.toLowerCase())

    return (
      <>
        {/* Initialize piety */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>Begin Devotion to a Deity</div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Deity</label>
              <select
                style={styles.select}
                value={pietyDeitySelect}
                onChange={e => setPietyDeitySelect(e.target.value)}
              >
                <option value="">-- Select --</option>
                {deityKeys.map(dk => {
                  const d = allDeities[dk]
                  const already = existingDeityNames.includes(d.name?.toLowerCase() || dk)
                  return (
                    <option key={dk} value={d.name || dk} disabled={already}>
                      {d.name || dk} {d.title ? `(${d.title})` : ''} {already ? '(active)' : ''}
                    </option>
                  )
                })}
              </select>
            </div>
            <button
              style={styles.btnSmall('#8b5cf6', submitting || !pietyDeitySelect)}
              onClick={handleInitializePiety}
              disabled={submitting || !pietyDeitySelect}
            >
              Initialize
            </button>
          </div>
        </div>

        {/* Existing piety records */}
        {pietyRecords.length === 0 ? (
          <div style={styles.emptyState}>No deity relationships established.</div>
        ) : (
          pietyRecords.map((pr, i) => {
            const deityData = pr.deityData
            const thresholds = deityData?.thresholds ? Object.values(deityData.thresholds).sort((a, b) => a.threshold - b.threshold) : []
            const currentThreshold = pr.currentThreshold
            const history = pietyHistory[pr.deity_name] || null
            const showingHistory = history !== null

            return (
              <div key={pr.deity_name || i} style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '600', color: '#8b5cf6' }}>
                      {pr.deity_name}
                      {deityData?.title && (
                        <span style={{ color: '#777', fontWeight: '400', marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                          {deityData.title}
                        </span>
                      )}
                    </div>
                    {deityData?.domains && (
                      <div style={{ marginTop: '0.25rem' }}>
                        {deityData.domains.map(d => (
                          <span key={d} style={styles.badge('#3498db')}>{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: '700', color: '#ffd700' }}>
                      {pr.piety_score}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>Piety Score</div>
                  </div>
                </div>

                {/* Current threshold ability */}
                {currentThreshold && (
                  <div style={{ marginTop: '0.75rem', background: '#1a1a2e', padding: '0.6rem', borderRadius: '4px', border: '1px solid #ffd70033' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: '600', color: '#ffd700' }}>
                      Active: {currentThreshold.name} (Threshold {currentThreshold.threshold})
                    </div>
                    <div style={{ fontSize: '0.8rem', color: '#bbb', marginTop: '0.2rem' }}>
                      {currentThreshold.description}
                    </div>
                  </div>
                )}

                {/* All thresholds */}
                {thresholds.length > 0 && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div style={{ fontSize: '0.8rem', color: '#999', marginBottom: '0.35rem' }}>Thresholds:</div>
                    {thresholds.map(th => {
                      const reached = pr.piety_score >= th.threshold
                      return (
                        <div key={th.threshold} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.3rem', alignItems: 'flex-start' }}>
                          <span style={{
                            ...styles.badge(reached ? '#2ecc71' : '#555'),
                            minWidth: '28px',
                            textAlign: 'center'
                          }}>
                            {th.threshold}
                          </span>
                          <div>
                            <span style={{ fontSize: '0.82rem', color: reached ? '#e0e0e0' : '#666' }}>
                              {th.name}
                            </span>
                            {reached && (
                              <div style={{ fontSize: '0.75rem', color: '#999' }}>{th.mechanicalEffect}</div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Adjust piety */}
                <div style={{ ...styles.divider }} />
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number"
                    value={pietyAdjustForm.deityName === pr.deity_name ? pietyAdjustForm.amount : 1}
                    onChange={e => setPietyAdjustForm({ deityName: pr.deity_name, amount: parseInt(e.target.value) || 0, reason: pietyAdjustForm.reason })}
                    onFocus={() => setPietyAdjustForm(f => ({ ...f, deityName: pr.deity_name }))}
                    style={{ ...styles.input, width: '60px' }}
                  />
                  <input
                    value={pietyAdjustForm.deityName === pr.deity_name ? pietyAdjustForm.reason : ''}
                    onChange={e => setPietyAdjustForm({ deityName: pr.deity_name, amount: pietyAdjustForm.amount, reason: e.target.value })}
                    onFocus={() => setPietyAdjustForm(f => ({ ...f, deityName: pr.deity_name }))}
                    placeholder="Reason..."
                    style={{ ...styles.input, flex: 1, minWidth: '120px' }}
                  />
                  <button
                    style={styles.btnSmall('#2ecc71', submitting)}
                    onClick={() => {
                      if (pietyAdjustForm.deityName !== pr.deity_name) {
                        setPietyAdjustForm(f => ({ ...f, deityName: pr.deity_name }))
                      }
                      handleAdjustPiety()
                    }}
                    disabled={submitting}
                  >
                    Adjust
                  </button>
                  <button
                    style={styles.btnSmall('#3498db', false)}
                    onClick={() => {
                      if (showingHistory) {
                        setPietyHistory(prev => {
                          const next = { ...prev }
                          delete next[pr.deity_name]
                          return next
                        })
                      } else {
                        handleLoadPietyHistory(pr.deity_name)
                      }
                    }}
                  >
                    {showingHistory ? 'Hide History' : 'History'}
                  </button>
                </div>

                {/* Piety history */}
                {showingHistory && history.length > 0 && (
                  <div style={{ marginTop: '0.75rem', maxHeight: '200px', overflowY: 'auto' }}>
                    {history.map((h, hi) => (
                      <div key={hi} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #222', padding: '0.3rem 0', fontSize: '0.78rem' }}>
                        <span style={{ color: '#bbb' }}>{h.reason || 'No reason'}</span>
                        <span style={{ color: h.change_amount > 0 ? '#2ecc71' : h.change_amount < 0 ? '#e74c3c' : '#999', fontWeight: '600' }}>
                          {h.change_amount > 0 ? '+' : ''}{h.change_amount} (={h.new_score})
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Increases / Decreases */}
                {deityData && (
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    {deityData.increases && (
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#2ecc71', fontWeight: '600', marginBottom: '0.3rem' }}>Piety Increases</div>
                        {deityData.increases.map((inc, ii) => (
                          <div key={ii} style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.15rem' }}>+ {inc}</div>
                        ))}
                      </div>
                    )}
                    {deityData.decreases && (
                      <div>
                        <div style={{ fontSize: '0.78rem', color: '#e74c3c', fontWeight: '600', marginBottom: '0.3rem' }}>Piety Decreases</div>
                        {deityData.decreases.map((dec, di) => (
                          <div key={di} style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.15rem' }}>- {dec}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })
        )}
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: EPIC BOONS
  // -------------------------------------------------------------------

  const renderBoons = () => {
    return (
      <>
        {/* Character's selected boons */}
        {epicBoons.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={styles.cardTitle}>Your Epic Boons</div>
            {epicBoons.map((b, i) => {
              const boonData = allBoons.find(ab => ab.key === b.boon_key) || {}
              return (
                <div key={i} style={styles.abilityCard}>
                  <div style={styles.abilityName}>{boonData.name || b.boon_key}</div>
                  <div style={styles.abilityDesc}>{boonData.description || ''}</div>
                  {boonData.mechanicalEffect && (
                    <div style={{ fontSize: '0.78rem', color: '#ff6b35', marginTop: '0.3rem' }}>
                      {boonData.mechanicalEffect}
                    </div>
                  )}
                  {b.ability_score_bonus && (
                    <div style={{ fontSize: '0.75rem', color: '#2ecc71', marginTop: '0.2rem' }}>
                      +1 {b.ability_score_bonus}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Available boons */}
        <div style={styles.cardTitle}>Available Epic Boons</div>
        <div style={{ color: '#999', fontSize: '0.82rem', marginBottom: '0.75rem' }}>
          Epic boons are available at Level 19+. Each boon also grants +1 to an ability score (max 30).
        </div>

        {/* Ability score selector */}
        <div style={{ ...styles.formGroup, marginBottom: '1rem' }}>
          <label style={styles.formLabel}>Ability Score Bonus</label>
          <select
            style={styles.select}
            value={boonAbilityScore}
            onChange={e => setBoonAbilityScore(e.target.value)}
          >
            {ABILITY_SCORES.map(as => (
              <option key={as} value={as}>{as}</option>
            ))}
          </select>
        </div>

        <div style={styles.grid}>
          {allBoons.map(boon => {
            const alreadySelected = selectedBoonKeys.includes(boon.key)
            return (
              <div key={boon.key} style={{
                ...styles.abilityCard,
                opacity: alreadySelected ? 0.5 : 1,
                borderColor: alreadySelected ? '#2ecc71' : '#2a3a5c'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={styles.abilityName}>{boon.name}</div>
                  {alreadySelected && <span style={styles.badge('#2ecc71')}>SELECTED</span>}
                </div>
                <div style={styles.abilityDesc}>{boon.description}</div>
                <div style={{ fontSize: '0.78rem', color: '#ff6b35', marginTop: '0.3rem' }}>
                  {boon.mechanicalEffect}
                </div>
                {!alreadySelected && (
                  <button
                    style={{ ...styles.btnSmall('#ffd700', submitting), marginTop: '0.5rem' }}
                    onClick={() => handleSelectBoon(boon.key)}
                    disabled={submitting}
                  >
                    {submitting ? 'Selecting...' : 'Select Boon'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB: LEGENDARY ITEMS
  // -------------------------------------------------------------------

  const renderItems = () => {
    const stateColors = {
      dormant: '#3498db',
      awakened: '#2ecc71',
      exalted: '#f39c12',
      mythic: '#ffd700'
    }

    return (
      <>
        {/* Create new item */}
        <div style={{ marginBottom: '1rem' }}>
          <button
            style={styles.btn('#ffd700', false)}
            onClick={() => setShowNewItemForm(!showNewItemForm)}
          >
            {showNewItemForm ? 'Cancel' : '+ Create Legendary Item'}
          </button>
        </div>

        {showNewItemForm && (
          <div style={styles.card}>
            <div style={styles.cardTitle}>Create Legendary Item</div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Item Name *</label>
              <input
                style={styles.input}
                value={itemForm.itemName}
                onChange={e => setItemForm(f => ({ ...f, itemName: e.target.value }))}
                placeholder="e.g. Dawnbringer"
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Base Type</label>
              <input
                style={styles.input}
                value={itemForm.itemBaseType}
                onChange={e => setItemForm(f => ({ ...f, itemBaseType: e.target.value }))}
                placeholder="e.g. Longsword, Staff, Amulet"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Dormant Properties</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: '60px' }}
                  value={itemForm.dormantProperties}
                  onChange={e => setItemForm(f => ({ ...f, dormantProperties: e.target.value }))}
                  placeholder="Properties when dormant..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Awakened Properties</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: '60px' }}
                  value={itemForm.awakenedProperties}
                  onChange={e => setItemForm(f => ({ ...f, awakenedProperties: e.target.value }))}
                  placeholder="Properties when awakened..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Exalted Properties</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: '60px' }}
                  value={itemForm.exaltedProperties}
                  onChange={e => setItemForm(f => ({ ...f, exaltedProperties: e.target.value }))}
                  placeholder="Properties when exalted..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Mythic Properties</label>
                <textarea
                  style={{ ...styles.textarea, minHeight: '60px' }}
                  value={itemForm.mythicProperties}
                  onChange={e => setItemForm(f => ({ ...f, mythicProperties: e.target.value }))}
                  placeholder="Properties at mythic state..."
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Deed to Awaken</label>
                <input
                  style={styles.input}
                  value={itemForm.awakenedDeed}
                  onChange={e => setItemForm(f => ({ ...f, awakenedDeed: e.target.value }))}
                  placeholder="What awakens it..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Deed to Exalt</label>
                <input
                  style={styles.input}
                  value={itemForm.exaltedDeed}
                  onChange={e => setItemForm(f => ({ ...f, exaltedDeed: e.target.value }))}
                  placeholder="What exalts it..."
                />
              </div>
              <div style={styles.formGroup}>
                <label style={styles.formLabel}>Deed to Mythic</label>
                <input
                  style={styles.input}
                  value={itemForm.mythicDeed}
                  onChange={e => setItemForm(f => ({ ...f, mythicDeed: e.target.value }))}
                  placeholder="What reaches mythic..."
                />
              </div>
            </div>
            <button
              style={styles.btn('#ffd700', submitting || !itemForm.itemName.trim())}
              onClick={handleCreateItem}
              disabled={submitting || !itemForm.itemName.trim()}
            >
              {submitting ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        )}

        {/* Existing items */}
        {legendaryItems.length === 0 && !showNewItemForm ? (
          <div style={styles.emptyState}>No legendary items yet. Create one to begin tracking its growth.</div>
        ) : (
          legendaryItems.map((item, i) => {
            const currentState = item.current_state || 'dormant'
            const currentStateIndex = ITEM_STATES.indexOf(currentState)
            const isAdvancing = advanceItemId === item.id

            return (
              <div key={item.id || i} style={{ ...styles.card, borderColor: stateColors[currentState] || '#2a3a5c' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: '700', color: '#ffd700' }}>
                      {item.item_name}
                    </div>
                    {item.item_base_type && (
                      <div style={{ fontSize: '0.82rem', color: '#999' }}>{item.item_base_type}</div>
                    )}
                  </div>
                  <span style={{
                    ...styles.badge(stateColors[currentState] || '#666'),
                    fontSize: '0.8rem',
                    textTransform: 'uppercase'
                  }}>
                    {currentState}
                  </span>
                </div>

                {/* State progression bar */}
                <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.75rem', marginBottom: '0.5rem' }}>
                  {ITEM_STATES.map((st, si) => (
                    <div key={st} style={{
                      flex: 1,
                      height: '6px',
                      borderRadius: '3px',
                      background: si <= currentStateIndex ? (stateColors[st] || '#555') : '#333'
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#666' }}>
                  {ITEM_STATES.map(st => (
                    <span key={st} style={{ color: st === currentState ? stateColors[st] : '#666' }}>
                      {st}
                    </span>
                  ))}
                </div>

                {/* Properties by state */}
                <div style={{ marginTop: '0.75rem' }}>
                  {ITEM_STATES.map(st => {
                    const propKey = `${st}_properties`
                    const props = item[propKey]
                    if (!props) return null
                    const isActive = ITEM_STATES.indexOf(st) <= currentStateIndex
                    return (
                      <div key={st} style={{ marginBottom: '0.4rem', opacity: isActive ? 1 : 0.4 }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: '600', color: stateColors[st] }}>
                          {st.charAt(0).toUpperCase() + st.slice(1)}:
                        </span>
                        <span style={{ fontSize: '0.78rem', color: '#bbb', marginLeft: '0.4rem' }}>
                          {props}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Advance controls */}
                {currentStateIndex < ITEM_STATES.length - 1 && (
                  <>
                    <div style={styles.divider} />
                    {!isAdvancing ? (
                      <button
                        style={styles.btnSmall(stateColors[ITEM_STATES[currentStateIndex + 1]] || '#ff6b35', false)}
                        onClick={() => {
                          setAdvanceItemId(item.id)
                          setAdvanceItemState(ITEM_STATES[currentStateIndex + 1])
                          setAdvanceItemDeed('')
                        }}
                      >
                        Advance to {ITEM_STATES[currentStateIndex + 1]}
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          style={{ ...styles.input, flex: 1, minWidth: '150px' }}
                          value={advanceItemDeed}
                          onChange={e => setAdvanceItemDeed(e.target.value)}
                          placeholder="What deed triggered this advancement?"
                        />
                        <button
                          style={styles.btnSmall('#2ecc71', submitting)}
                          onClick={() => handleAdvanceItem(item.id)}
                          disabled={submitting}
                        >
                          {submitting ? '...' : 'Confirm'}
                        </button>
                        <button
                          style={styles.btnSmall('#666', false)}
                          onClick={() => {
                            setAdvanceItemId(null)
                            setAdvanceItemState('')
                            setAdvanceItemDeed('')
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Deeds for each state */}
                {(item.awakened_deed || item.exalted_deed || item.mythic_deed) && (
                  <>
                    <div style={styles.divider} />
                    <div style={{ fontSize: '0.78rem', color: '#777' }}>
                      <div style={{ fontWeight: '600', color: '#999', marginBottom: '0.3rem' }}>Required Deeds:</div>
                      {item.awakened_deed && <div>Awaken: {item.awakened_deed}</div>}
                      {item.exalted_deed && <div>Exalt: {item.exalted_deed}</div>}
                      {item.mythic_deed && <div>Mythic: {item.mythic_deed}</div>}
                    </div>
                  </>
                )}
              </div>
            )
          })
        )}
      </>
    )
  }

  // -------------------------------------------------------------------
  // TAB CONTENT ROUTER
  // -------------------------------------------------------------------

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return renderOverview()
      case 'path': return renderPath()
      case 'abilities': return renderAbilities()
      case 'trials': return renderTrials()
      case 'piety': return renderPiety()
      case 'boons': return renderBoons()
      case 'items': return renderItems()
      default: return renderOverview()
    }
  }

  // -------------------------------------------------------------------
  // MAIN RENDER
  // -------------------------------------------------------------------

  if (loading) {
    return <div style={styles.loading}>Loading mythic progression...</div>
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>Mythic Progression</div>
        <div style={styles.subtitle}>
          {character.name}
          {isInitialized && tier > 0 && ` -- Tier ${tier}: ${mythicStatus?.tierName}`}
          {path && ` -- ${pathName}`}
        </div>
      </div>

      {/* Messages */}
      {renderError()}
      {renderSuccess()}

      {/* Tab Bar */}
      <div style={styles.tabBar}>
        {TABS.map(t => (
          <button
            key={t.key}
            style={styles.tab(activeTab === t.key)}
            onClick={() => {
              setActiveTab(t.key)
              setError(null)
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  )
}
