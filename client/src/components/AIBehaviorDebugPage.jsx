import { useState, useEffect, useCallback, useMemo } from 'react'

/**
 * AI Behavior Debug Page (Phase 4a SC-4a.4)
 *
 * Power-user analysis surface — see `settings/SETTINGS_DESIGN_BRIEF.md` is
 * NOT applicable here per spec §5.3 ("editorial register relaxes further").
 * Functional clarity is the only goal: plain typography, dense layout,
 * no decorative ornaments. The page is for the user (and PM during
 * collaboration) when investigating AI behavior; it is not part of any
 * gameplay flow.
 *
 * Per spec §5.3 the page is biased toward "show me what happened in the
 * last session". Filters default to most-recent session for the active
 * character; can be widened via the controls.
 */

const SIGNAL_NAMES = [
  'marker-correction-loop',
  'rule-violations',
  'repetition-ledger',
  'response-length',
  'marker-emission',
  'name-reuse',
  'time-drift',
  'scope-of-application'
]

export default function AIBehaviorDebugPage({ onBack, defaultCharacterId = null }) {
  const [dimensions, setDimensions] = useState(null)
  const [filter, setFilter] = useState({
    character_id: defaultCharacterId || '',
    session_id: '',
    purpose: ''
  })
  const [calls, setCalls] = useState([])
  const [signals, setSignals] = useState(null)
  const [selectedCall, setSelectedCall] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Load filter dimensions on mount.
  useEffect(() => {
    let cancelled = false
    fetch('/api/ai-behavior/dimensions')
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(d => { if (!cancelled) setDimensions(d) })
      .catch(e => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [])

  // When filter changes, refetch calls + signals.
  const queryString = useMemo(() => {
    const qs = new URLSearchParams()
    if (filter.character_id) qs.set('character_id', filter.character_id)
    if (filter.session_id) qs.set('session_id', filter.session_id)
    if (filter.purpose) qs.set('purpose', filter.purpose)
    qs.set('limit', '200')
    return qs.toString()
  }, [filter])

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [callsRes, signalsRes] = await Promise.all([
        fetch(`/api/ai-behavior/calls?${queryString}`).then(r => r.json()),
        fetch(`/api/ai-behavior/signals/all?${queryString}`).then(r => r.json())
      ])
      setCalls(callsRes.calls || [])
      setSignals(signalsRes.signals || null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [queryString])

  useEffect(() => { refetch() }, [refetch])

  const onCallClick = async (callId) => {
    setSelectedCall({ id: callId, loading: true })
    try {
      const res = await fetch(`/api/ai-behavior/calls/${callId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const detail = await res.json()
      setSelectedCall(detail)
    } catch (e) {
      setSelectedCall({ id: callId, error: e.message })
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <button onClick={onBack} style={styles.backBtn}>← Back</button>
        <h2 style={styles.title}>AI Behavior — diagnostic surface</h2>
        <span style={styles.phaseTag}>Phase 4a / SC-4a.4</span>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {/* Filter controls */}
      <div style={styles.filterBar}>
        <label style={styles.filterLabel}>
          Character
          <select
            value={filter.character_id}
            onChange={e => setFilter(f => ({ ...f, character_id: e.target.value, session_id: '' }))}
            style={styles.select}
          >
            <option value="">Any</option>
            {dimensions?.characters?.map(c => (
              <option key={c.character_id} value={c.character_id}>
                #{c.character_id} ({c.call_count} calls)
              </option>
            ))}
          </select>
        </label>
        <label style={styles.filterLabel}>
          Session
          <select
            value={filter.session_id}
            onChange={e => setFilter(f => ({ ...f, session_id: e.target.value }))}
            style={styles.select}
          >
            <option value="">Any</option>
            {dimensions?.sessions?.filter(s =>
              !filter.character_id || s.character_id == filter.character_id
            ).map(s => (
              <option key={s.session_id} value={s.session_id}>
                #{s.session_id} ({s.call_count} calls — {s.last_at?.slice(0, 10)})
              </option>
            ))}
          </select>
        </label>
        <label style={styles.filterLabel}>
          Call purpose
          <select
            value={filter.purpose}
            onChange={e => setFilter(f => ({ ...f, purpose: e.target.value }))}
            style={styles.select}
          >
            <option value="">Any</option>
            {dimensions?.purposes?.map(p => (
              <option key={p.call_purpose} value={p.call_purpose}>
                {p.call_purpose} ({p.call_count})
              </option>
            ))}
          </select>
        </label>
        <button onClick={refetch} disabled={loading} style={styles.refreshBtn}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {/* Two-pane layout: signal summary + call list on left, detail on right */}
      <div style={styles.body}>
        <div style={styles.leftPane}>
          {signals && <SignalSummary signals={signals} />}
          <CallList
            calls={calls}
            selectedId={selectedCall?.id}
            onSelect={onCallClick}
          />
        </div>
        <div style={styles.rightPane}>
          {selectedCall ? <CallDetail call={selectedCall} /> : <div style={styles.placeholder}>Select a call to view detail</div>}
        </div>
      </div>
    </div>
  )
}

function SignalSummary({ signals }) {
  return (
    <div style={styles.signalPanel}>
      <h3 style={styles.signalTitle}>Signals</h3>
      <table style={styles.signalTable}>
        <tbody>
          <SignalRow label="Marker correction-loop hits" value={`${signals.marker_correction_loop_hits.count} / ${signals.marker_correction_loop_hits.total_calls} (${(signals.marker_correction_loop_hits.rate_per_call * 100).toFixed(1)}%)`} />
          <SignalRow label="Rule violation rate" value={`${signals.rule_violation_rates.flagged_call_count} / ${signals.rule_violation_rates.total_calls} (${(signals.rule_violation_rates.rate_per_call * 100).toFixed(1)}%)`} />
          <SignalRow label="Repetition-ledger triggers" value={String(signals.repetition_ledger_triggers.count)} />
          <SignalRow label="Marker emissions (total)" value={String(signals.marker_emission_rates.total_marker_emissions)} sublabel={Object.entries(signals.marker_emission_rates.by_type).slice(0, 3).map(([k, v]) => `${k}:${v}`).join(' · ')} />
          <SignalRow label="Name reuse (cross-character)" value={`${signals.name_reuse.cross_character_reused} reused / ${signals.name_reuse.distinct_names} distinct`} sublabel={signals.name_reuse.reused_examples.slice(0, 5).map(e => e.name).join(', ')} />
          <SignalRow label="Time-drift events" value={String(signals.time_drift.drift_count)} />
          <SignalRow label="Scope-of-instruction-application" value={`${signals.scope_of_instruction_application.flagged_call_count} / ${signals.scope_of_instruction_application.call_count} (${(signals.scope_of_instruction_application.rate_per_call * 100).toFixed(1)}%)`} sublabel={Object.entries(signals.scope_of_instruction_application.by_kind).map(([k, v]) => `${k}:${v}`).join(' · ')} />
          <SignalRow label="Response length (gameplay_turn)" value={signals.response_length_distribution.by_purpose.gameplay_turn ? `mean ${signals.response_length_distribution.by_purpose.gameplay_turn.mean} / p90 ${signals.response_length_distribution.by_purpose.gameplay_turn.p90}` : 'no data'} />
        </tbody>
      </table>
    </div>
  )
}

function SignalRow({ label, value, sublabel }) {
  return (
    <tr>
      <td style={styles.signalLabelCell}>{label}</td>
      <td style={styles.signalValueCell}>
        <div>{value}</div>
        {sublabel && <div style={styles.sublabel}>{sublabel}</div>}
      </td>
    </tr>
  )
}

function CallList({ calls, selectedId, onSelect }) {
  return (
    <div style={styles.callListPanel}>
      <h3 style={styles.signalTitle}>Calls ({calls.length})</h3>
      <div style={styles.callListScroll}>
        <table style={styles.callTable}>
          <thead>
            <tr>
              <th style={styles.th}>id</th>
              <th style={styles.th}>started</th>
              <th style={styles.th}>purpose</th>
              <th style={styles.th}>builder</th>
              <th style={styles.thNum}>turn</th>
              <th style={styles.thNum}>tokens (in/out)</th>
              <th style={styles.thNum}>ms</th>
              <th style={styles.th}>status</th>
            </tr>
          </thead>
          <tbody>
            {calls.map(c => (
              <tr
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{ ...styles.callRow, ...(c.id === selectedId ? styles.callRowSelected : {}) }}
              >
                <td style={styles.td}>{c.id}</td>
                <td style={styles.td}>{c.request_started_at?.slice(5, 19)}</td>
                <td style={styles.td}>{c.call_purpose}</td>
                <td style={styles.td}>{c.prompt_builder || '—'}</td>
                <td style={styles.tdNum}>{c.turn_number ?? '—'}</td>
                <td style={styles.tdNum}>{c.input_tokens ?? '—'} / {c.output_tokens ?? '—'}</td>
                <td style={styles.tdNum}>{c.latency_ms ?? '—'}</td>
                <td style={styles.td}>{c.response_status}{c.triggered_correction_loop ? ' ⚠' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function CallDetail({ call }) {
  if (call.loading) return <div style={styles.placeholder}>Loading call #{call.id}…</div>
  if (call.error) return <div style={styles.error}>Error loading call #{call.id}: {call.error}</div>

  return (
    <div style={styles.detailPane}>
      <h3 style={styles.detailTitle}>Call #{call.id}</h3>
      <DetailMeta label="Purpose" value={call.call_purpose} />
      <DetailMeta label="Builder" value={call.prompt_builder} />
      <DetailMeta label="Character" value={call.character_id} />
      <DetailMeta label="Session" value={call.session_id} />
      <DetailMeta label="Turn" value={call.turn_number} />
      <DetailMeta label="Started" value={call.request_started_at} />
      <DetailMeta label="Latency" value={call.latency_ms != null ? `${call.latency_ms} ms` : null} />
      <DetailMeta label="Model" value={call.model_id} />
      <DetailMeta label="Tokens" value={call.input_tokens != null ? `${call.input_tokens} in / ${call.output_tokens} out` : null} />
      <DetailMeta label="Cache" value={call.cache_read_input_tokens != null ? `${call.cache_read_input_tokens} read / ${call.cache_creation_input_tokens || 0} created` : null} />

      {call.markers_detected && Object.keys(call.markers_detected).length > 0 && (
        <DetailSection title="Markers detected">
          <pre style={styles.codeBlock}>{JSON.stringify(call.markers_detected, null, 2)}</pre>
        </DetailSection>
      )}

      {call.marker_failures && call.marker_failures.length > 0 && (
        <DetailSection title="Marker failures">
          <pre style={styles.codeBlock}>{JSON.stringify(call.marker_failures, null, 2)}</pre>
        </DetailSection>
      )}

      {call.prompt_sections && call.prompt_sections.length > 0 && (
        <DetailSection title={`Prompt sections (${call.prompt_sections.length})`}>
          <table style={styles.callTable}>
            <thead>
              <tr><th style={styles.th}>section</th><th style={styles.thNum}>chars</th><th style={styles.thNum}>tokens (est)</th></tr>
            </thead>
            <tbody>
              {call.prompt_sections.map((s, i) => (
                <tr key={i}>
                  <td style={styles.td}>{s.name}</td>
                  <td style={styles.tdNum}>{s.chars}</td>
                  <td style={styles.tdNum}>{s.tokens}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      )}

      <DetailSection title="System prompt">
        <pre style={styles.promptBlock}>{call.system_prompt || '(empty)'}</pre>
      </DetailSection>

      <DetailSection title="User message">
        <pre style={styles.promptBlock}>{call.user_message || '(empty)'}</pre>
      </DetailSection>

      <DetailSection title={`Response (${call.response_status})`}>
        <pre style={styles.promptBlock}>{call.response_text || '(empty)'}</pre>
        {call.response_error && <div style={styles.error}>Error: {call.response_error}</div>}
      </DetailSection>

      {call.metadata && Object.keys(call.metadata).length > 0 && (
        <DetailSection title="Metadata">
          <pre style={styles.codeBlock}>{JSON.stringify(call.metadata, null, 2)}</pre>
        </DetailSection>
      )}
    </div>
  )
}

function DetailMeta({ label, value }) {
  if (value == null) return null
  return (
    <div style={styles.detailMeta}>
      <span style={styles.detailMetaLabel}>{label}</span>
      <span style={styles.detailMetaValue}>{String(value)}</span>
    </div>
  )
}

function DetailSection({ title, children }) {
  return (
    <div style={styles.detailSection}>
      <h4 style={styles.detailSectionTitle}>{title}</h4>
      {children}
    </div>
  )
}

// ============================================================
// Styles — plain functional treatment per spec §5.3
// ============================================================
const COLORS = {
  bg: '#0e0e10',
  bg2: '#1a1a1d',
  fg: '#e0e0e0',
  muted: '#8e8e93',
  rule: '#33333a',
  accent: '#7aafff',
  warn: '#ff9551',
  err: '#ff5e5e'
}

const styles = {
  page: { background: COLORS.bg, color: COLORS.fg, minHeight: '100vh', padding: 16, fontFamily: 'ui-monospace, "JetBrains Mono", "SF Mono", Menlo, monospace', fontSize: 13 },
  header: { display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 12, borderBottom: `1px solid ${COLORS.rule}`, marginBottom: 12 },
  backBtn: { background: 'transparent', border: `1px solid ${COLORS.rule}`, color: COLORS.fg, padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  title: { margin: 0, fontSize: 16, fontWeight: 500 },
  phaseTag: { color: COLORS.muted, fontSize: 11, marginLeft: 'auto' },
  error: { padding: 8, background: 'rgba(255,94,94,0.12)', border: `1px solid ${COLORS.err}`, color: COLORS.err, borderRadius: 4, marginBottom: 12 },
  filterBar: { display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12, flexWrap: 'wrap' },
  filterLabel: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: COLORS.muted },
  select: { background: COLORS.bg2, color: COLORS.fg, border: `1px solid ${COLORS.rule}`, padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'inherit', minWidth: 200 },
  refreshBtn: { background: COLORS.accent, color: COLORS.bg, border: 'none', padding: '6px 16px', borderRadius: 4, cursor: 'pointer', fontWeight: 500 },
  body: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 12, height: 'calc(100vh - 180px)' },
  leftPane: { display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 },
  rightPane: { background: COLORS.bg2, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: 12, overflowY: 'auto', minHeight: 0 },
  placeholder: { color: COLORS.muted, fontStyle: 'italic', textAlign: 'center', padding: 32 },
  signalPanel: { background: COLORS.bg2, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: 12 },
  signalTitle: { margin: '0 0 8px 0', fontSize: 12, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 },
  signalTable: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  signalLabelCell: { padding: '4px 8px 4px 0', color: COLORS.muted, verticalAlign: 'top', whiteSpace: 'nowrap' },
  signalValueCell: { padding: '4px 0', textAlign: 'right' },
  sublabel: { color: COLORS.muted, fontSize: 10, marginTop: 2 },
  callListPanel: { background: COLORS.bg2, border: `1px solid ${COLORS.rule}`, borderRadius: 4, padding: 12, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  callListScroll: { overflowY: 'auto', flex: 1 },
  callTable: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
  th: { textAlign: 'left', padding: '4px 6px', borderBottom: `1px solid ${COLORS.rule}`, color: COLORS.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  thNum: { textAlign: 'right', padding: '4px 6px', borderBottom: `1px solid ${COLORS.rule}`, color: COLORS.muted, fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' },
  td: { padding: '3px 6px', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 11 },
  tdNum: { padding: '3px 6px', borderBottom: `1px solid rgba(255,255,255,0.04)`, fontSize: 11, textAlign: 'right', color: COLORS.muted },
  callRow: { cursor: 'pointer' },
  callRowSelected: { background: 'rgba(122,175,255,0.12)' },
  detailPane: {},
  detailTitle: { margin: '0 0 12px 0', fontSize: 14 },
  detailMeta: { display: 'flex', gap: 8, padding: '2px 0', fontSize: 11 },
  detailMetaLabel: { color: COLORS.muted, minWidth: 70 },
  detailMetaValue: { color: COLORS.fg },
  detailSection: { marginTop: 16 },
  detailSectionTitle: { margin: '0 0 6px 0', fontSize: 11, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 600 },
  promptBlock: { background: COLORS.bg, border: `1px solid ${COLORS.rule}`, padding: 10, borderRadius: 4, fontSize: 11, lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 400, overflowY: 'auto', margin: 0 },
  codeBlock: { background: COLORS.bg, border: `1px solid ${COLORS.rule}`, padding: 10, borderRadius: 4, fontSize: 10, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }
}
