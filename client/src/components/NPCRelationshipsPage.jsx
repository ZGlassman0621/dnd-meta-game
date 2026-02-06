import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '1rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    color: '#f5f5f5',
    margin: 0,
  },
  explanation: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '12px 16px',
    marginBottom: '1.5rem',
    color: '#ccc',
    fontSize: '0.9rem',
    lineHeight: '1.5',
  },
  summaryBar: {
    display: 'flex',
    gap: '1.25rem',
    padding: '0.75rem 1rem',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    marginBottom: '1.5rem',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.9rem',
    color: '#ccc',
  },
  summaryCount: {
    fontWeight: 'bold',
    fontSize: '1.1rem',
    color: '#f5f5f5',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1.5rem',
  },
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    padding: '1rem',
    minHeight: '500px',
  },
  panelTitle: {
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#f5f5f5',
    marginBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '0.5rem',
  },
  filterTabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '0.4rem 0.75rem',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ccc',
    fontSize: '0.85rem',
    transition: 'all 0.2s',
  },
  filterTabActive: {
    backgroundColor: '#3498db',
    color: 'white',
  },
  npcList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '450px',
    overflowY: 'auto',
  },
  npcCard: {
    padding: '0.75rem',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s',
  },
  npcCardSelected: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498db',
  },
  npcName: {
    fontWeight: '500',
    color: '#f5f5f5',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  npcMeta: {
    fontSize: '0.8rem',
    color: '#888',
    marginBottom: '6px',
  },
  dispositionBar: {
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    overflow: 'hidden',
    position: 'relative',
  },
  dispositionFill: {
    height: '100%',
    transition: 'width 0.3s',
    position: 'absolute',
  },
  dispositionCenter: {
    position: 'absolute',
    left: '50%',
    top: '0',
    bottom: '0',
    width: '2px',
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
  },
  detailSection: {
    marginBottom: '1.25rem',
  },
  detailLabel: {
    fontWeight: '500',
    color: '#aaa',
    marginBottom: '4px',
    fontSize: '0.85rem',
  },
  detailValue: {
    color: '#f5f5f5',
    marginBottom: '8px',
  },
  listItem: {
    padding: '0.5rem 0.75rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    marginBottom: '0.4rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    fontSize: '0.85rem',
    color: '#ccc',
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  button: {
    padding: '0.4rem 0.75rem',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    marginRight: '0.4rem',
    marginTop: '4px',
    transition: 'all 0.2s',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: '#ccc',
  },
  buttonDanger: {
    backgroundColor: '#e74c3c',
    color: 'white',
  },
  buttonSuccess: {
    backgroundColor: '#2ecc71',
    color: 'white',
  },
  noData: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
    fontStyle: 'italic',
  },
  trustMeter: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '8px',
  },
  trustLevel: {
    display: 'flex',
    gap: '2px',
  },
  trustDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  trustDotFilled: {
    backgroundColor: '#3498db',
    borderColor: '#3498db',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginTop: '0.75rem',
  },
  statBox: {
    padding: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#f5f5f5',
  },
  statLabel: {
    fontSize: '0.7rem',
    color: '#888',
  },
  tabContent: {
    marginTop: '1rem',
  },
  secretItem: {
    backgroundColor: 'rgba(155, 89, 182, 0.2)',
    color: '#ccc',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    marginBottom: '0.4rem',
    fontSize: '0.85rem',
    border: '1px solid rgba(155, 89, 182, 0.3)',
  },
  factItem: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    marginBottom: '0.4rem',
    fontSize: '0.85rem',
    color: '#ccc',
    border: '1px solid rgba(46, 204, 113, 0.3)',
  },
};

const dispositionColors = {
  hated: { bg: '#8B0000', text: 'white' },
  hostile: { bg: '#CD5C5C', text: 'white' },
  unfriendly: { bg: '#FF6347', text: 'white' },
  indifferent: { bg: '#808080', text: 'white' },
  neutral: { bg: '#A9A9A9', text: 'white' },
  friendly: { bg: '#90EE90', text: '#333' },
  helpful: { bg: '#32CD32', text: 'white' },
  loyal: { bg: '#228B22', text: 'white' },
  devoted: { bg: '#006400', text: 'white' },
};

const NPCRelationshipsPage = ({ character }) => {
  const [relationships, setRelationships] = useState([]);
  const [selectedRelationship, setSelectedRelationship] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pendingPromises, setPendingPromises] = useState([]);
  const [outstandingDebts, setOutstandingDebts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [detailTab, setDetailTab] = useState('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (character?.id) {
      loadRelationships();
      loadSummary();
      loadPromises();
      loadDebts();
    }
  }, [character?.id]);

  const loadRelationships = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/npc-relationship/character/${character.id}`);
      const data = await response.json();
      setRelationships(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading relationships:', error);
      setRelationships([]);
    }
    setLoading(false);
  };

  const loadSummary = async () => {
    try {
      const response = await fetch(`/api/npc-relationship/character/${character.id}/summary`);
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error loading summary:', error);
    }
  };

  const loadPromises = async () => {
    try {
      const response = await fetch(`/api/npc-relationship/character/${character.id}/promises`);
      const data = await response.json();
      setPendingPromises(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading promises:', error);
    }
  };

  const loadDebts = async () => {
    try {
      const response = await fetch(`/api/npc-relationship/character/${character.id}/debts`);
      const data = await response.json();
      setOutstandingDebts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading debts:', error);
    }
  };

  const filteredRelationships = relationships.filter(rel => {
    if (filter === 'all') return true;
    if (filter === 'allies') return rel.disposition >= 50;
    if (filter === 'hostile') return rel.disposition <= -30;
    if (filter === 'neutral') return rel.disposition > -30 && rel.disposition < 50;
    return true;
  });

  const handleAdjustDisposition = async (change, reason) => {
    if (!selectedRelationship) return;
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${selectedRelationship.npc_id}/disposition`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change, reason }),
        }
      );
      if (response.ok) {
        const updated = await response.json();
        setRelationships(relationships.map(r => r.id === updated.id ? updated : r));
        setSelectedRelationship(updated);
        loadSummary();
      }
    } catch (error) {
      console.error('Error adjusting disposition:', error);
    }
  };

  const handleAdjustTrust = async (change) => {
    if (!selectedRelationship) return;
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${selectedRelationship.npc_id}/trust`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ change }),
        }
      );
      if (response.ok) {
        const updated = await response.json();
        setRelationships(relationships.map(r => r.id === updated.id ? updated : r));
        setSelectedRelationship(updated);
      }
    } catch (error) {
      console.error('Error adjusting trust:', error);
    }
  };

  const handleFulfillPromise = async (npcId, promiseIndex) => {
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${npcId}/promise/${promiseIndex}/fulfill`,
        { method: 'POST' }
      );
      if (response.ok) {
        loadPromises();
        loadRelationships();
        loadSummary();
      }
    } catch (error) {
      console.error('Error fulfilling promise:', error);
    }
  };

  const handleBreakPromise = async (npcId, promiseIndex) => {
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${npcId}/promise/${promiseIndex}/break`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'Promise broken' }),
        }
      );
      if (response.ok) {
        loadPromises();
        loadRelationships();
        loadSummary();
      }
    } catch (error) {
      console.error('Error breaking promise:', error);
    }
  };

  const handleSettleDebt = async (npcId, debtIndex) => {
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${npcId}/debt/${debtIndex}/settle`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ how_settled: 'Debt settled' }),
        }
      );
      if (response.ok) {
        loadDebts();
        loadRelationships();
        loadSummary();
      }
    } catch (error) {
      console.error('Error settling debt:', error);
    }
  };

  const handleDisproveRumor = async (rumorIndex) => {
    if (!selectedRelationship) return;
    try {
      const response = await fetch(
        `/api/npc-relationship/${character.id}/${selectedRelationship.npc_id}/rumor/${rumorIndex}/disprove`,
        { method: 'POST' }
      );
      if (response.ok) {
        const updated = await response.json();
        setRelationships(relationships.map(r => r.id === updated.id ? updated : r));
        setSelectedRelationship(updated);
      }
    } catch (error) {
      console.error('Error disproving rumor:', error);
    }
  };

  const getDispositionLabel = (disposition) => {
    if (disposition <= -80) return 'hated';
    if (disposition <= -50) return 'hostile';
    if (disposition <= -20) return 'unfriendly';
    if (disposition <= 20) return 'neutral';
    if (disposition <= 50) return 'friendly';
    if (disposition <= 80) return 'helpful';
    return 'devoted';
  };

  const renderDispositionBar = (disposition) => {
    const normalized = (disposition + 100) / 200; // Convert -100..100 to 0..1
    const color = disposition >= 0 ? '#228B22' : '#CD5C5C';
    const width = Math.abs(disposition);
    const left = disposition >= 0 ? '50%' : `${50 - width / 2}%`;

    return (
      <div style={styles.dispositionBar}>
        <div style={styles.dispositionCenter} />
        <div
          style={{
            ...styles.dispositionFill,
            backgroundColor: color,
            width: `${width / 2}%`,
            left: disposition >= 0 ? '50%' : `${50 - width / 2}%`,
          }}
        />
      </div>
    );
  };

  const renderTrustMeter = (trust) => {
    const maxTrust = 10;
    const dots = [];
    for (let i = 1; i <= maxTrust; i++) {
      dots.push(
        <div
          key={i}
          style={{
            ...styles.trustDot,
            ...(i <= trust ? styles.trustDotFilled : {}),
          }}
        />
      );
    }
    return (
      <div style={styles.trustMeter}>
        <span style={{ fontSize: '12px', color: '#5D4037' }}>Trust:</span>
        <div style={styles.trustLevel}>{dots}</div>
        <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{trust}/10</span>
      </div>
    );
  };

  const parseJsonField = (field) => {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    try {
      return JSON.parse(field);
    } catch {
      return [];
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>NPC Relationships</h1>
      </div>

      <div style={styles.explanation}>
        Track your character's relationships with NPCs you've encountered. See who considers you
        a friend or foe, build trust over time through your interactions, and understand how your
        reputation affects the world around you. Relationships can unlock new opportunities or
        close certain doors.
      </div>

      {summary && (
        <div style={styles.summaryBar}>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryCount, color: '#228B22' }}>{summary.allies || 0}</span>
            <span>Allies</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryCount, color: '#808080' }}>{summary.neutral || 0}</span>
            <span>Neutral</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryCount, color: '#CD5C5C' }}>{summary.hostile || 0}</span>
            <span>Hostile</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryCount, color: '#4169E1' }}>{pendingPromises.length}</span>
            <span>Promises</span>
          </div>
          <div style={styles.summaryItem}>
            <span style={{ ...styles.summaryCount, color: '#FFA500' }}>{outstandingDebts.length}</span>
            <span>Debts</span>
          </div>
        </div>
      )}

      <div style={styles.mainContent}>
        {/* Left Panel - NPC List */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>NPCs Known</h2>

          <div style={styles.filterTabs}>
            {['all', 'allies', 'neutral', 'hostile'].map(f => (
              <button
                key={f}
                style={{
                  ...styles.filterTab,
                  ...(filter === f ? styles.filterTabActive : {}),
                }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={styles.npcList}>
            {loading ? (
              <div style={styles.noData}>Loading relationships...</div>
            ) : filteredRelationships.length === 0 ? (
              <div style={styles.noData}>
                No {filter !== 'all' ? filter : ''} NPCs found
              </div>
            ) : (
              filteredRelationships.map(rel => {
                const label = rel.disposition_label || getDispositionLabel(rel.disposition);
                const colorScheme = dispositionColors[label] || dispositionColors.neutral;

                return (
                  <div
                    key={rel.id}
                    style={{
                      ...styles.npcCard,
                      ...(selectedRelationship?.id === rel.id ? styles.npcCardSelected : {}),
                    }}
                    onClick={() => setSelectedRelationship(rel)}
                  >
                    <div style={styles.npcName}>
                      NPC #{rel.npc_id}
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: colorScheme.bg,
                          color: colorScheme.text,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                    <div style={styles.npcMeta}>
                      Met {rel.times_met || 1} time{(rel.times_met || 1) !== 1 ? 's' : ''}
                      {rel.first_met_date && ` • First met: ${rel.first_met_date}`}
                    </div>
                    {renderDispositionBar(rel.disposition)}
                    {renderTrustMeter(rel.trust_level || 0)}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel - Details */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Relationship Details</h2>

          {!selectedRelationship ? (
            <div style={styles.noData}>Select an NPC to view details</div>
          ) : (
            <>
              <div style={styles.filterTabs}>
                {['info', 'promises', 'debts', 'knowledge'].map(tab => (
                  <button
                    key={tab}
                    style={{
                      ...styles.filterTab,
                      ...(detailTab === tab ? styles.filterTabActive : {}),
                    }}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              <div style={styles.tabContent}>
                {detailTab === 'info' && (
                  <>
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Disposition</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#8B4513' }}>
                          {selectedRelationship.disposition}
                        </span>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: dispositionColors[selectedRelationship.disposition_label]?.bg || '#808080',
                            color: dispositionColors[selectedRelationship.disposition_label]?.text || 'white',
                          }}
                        >
                          {selectedRelationship.disposition_label || getDispositionLabel(selectedRelationship.disposition)}
                        </span>
                      </div>
                      {renderDispositionBar(selectedRelationship.disposition)}
                      <div style={{ marginTop: '8px' }}>
                        <button
                          style={{ ...styles.button, ...styles.buttonSuccess }}
                          onClick={() => handleAdjustDisposition(10, 'Helped NPC')}
                        >
                          +10
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.buttonSecondary }}
                          onClick={() => handleAdjustDisposition(5, 'Friendly act')}
                        >
                          +5
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.buttonSecondary }}
                          onClick={() => handleAdjustDisposition(-5, 'Minor offense')}
                        >
                          -5
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.buttonDanger }}
                          onClick={() => handleAdjustDisposition(-10, 'Offended NPC')}
                        >
                          -10
                        </button>
                      </div>
                    </div>

                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Trust Level</div>
                      {renderTrustMeter(selectedRelationship.trust_level || 0)}
                      <div style={{ marginTop: '8px' }}>
                        <button
                          style={{ ...styles.button, ...styles.buttonSuccess }}
                          onClick={() => handleAdjustTrust(1)}
                        >
                          +1 Trust
                        </button>
                        <button
                          style={{ ...styles.button, ...styles.buttonDanger }}
                          onClick={() => handleAdjustTrust(-1)}
                        >
                          -1 Trust
                        </button>
                      </div>
                    </div>

                    <div style={styles.statsGrid}>
                      <div style={styles.statBox}>
                        <div style={styles.statValue}>{selectedRelationship.times_met || 1}</div>
                        <div style={styles.statLabel}>Times Met</div>
                      </div>
                      <div style={styles.statBox}>
                        <div style={styles.statValue}>
                          {parseJsonField(selectedRelationship.witnessed_deeds).length}
                        </div>
                        <div style={styles.statLabel}>Witnessed Deeds</div>
                      </div>
                      <div style={styles.statBox}>
                        <div style={styles.statValue}>
                          {parseJsonField(selectedRelationship.discovered_secrets).length}
                        </div>
                        <div style={styles.statLabel}>Secrets Known</div>
                      </div>
                      <div style={styles.statBox}>
                        <div style={styles.statValue}>
                          {parseJsonField(selectedRelationship.promises_made).filter(p => p.status === 'pending').length}
                        </div>
                        <div style={styles.statLabel}>Pending Promises</div>
                      </div>
                    </div>
                  </>
                )}

                {detailTab === 'promises' && (
                  <>
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Promises Made</div>
                      {parseJsonField(selectedRelationship.promises_made).length === 0 ? (
                        <div style={styles.noData}>No promises recorded</div>
                      ) : (
                        parseJsonField(selectedRelationship.promises_made).map((promise, idx) => (
                          <div key={idx} style={styles.listItem}>
                            <div style={styles.listItemHeader}>
                              <span>{promise.description || promise}</span>
                              <span
                                style={{
                                  ...styles.badge,
                                  backgroundColor: promise.status === 'fulfilled' ? '#228B22' :
                                                  promise.status === 'broken' ? '#CD5C5C' : '#FFA500',
                                  color: 'white',
                                }}
                              >
                                {promise.status || 'pending'}
                              </span>
                            </div>
                            {promise.status === 'pending' && (
                              <div>
                                <button
                                  style={{ ...styles.button, ...styles.buttonSuccess }}
                                  onClick={() => handleFulfillPromise(selectedRelationship.npc_id, idx)}
                                >
                                  Fulfill
                                </button>
                                <button
                                  style={{ ...styles.button, ...styles.buttonDanger }}
                                  onClick={() => handleBreakPromise(selectedRelationship.npc_id, idx)}
                                >
                                  Break
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {detailTab === 'debts' && (
                  <>
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Debts</div>
                      {parseJsonField(selectedRelationship.debts_owed).length === 0 ? (
                        <div style={styles.noData}>No debts recorded</div>
                      ) : (
                        parseJsonField(selectedRelationship.debts_owed).map((debt, idx) => (
                          <div key={idx} style={styles.listItem}>
                            <div style={styles.listItemHeader}>
                              <span>
                                {debt.direction === 'to_npc' ? '📤 Owed to NPC' : '📥 Owed by NPC'}
                              </span>
                              <span
                                style={{
                                  ...styles.badge,
                                  backgroundColor: debt.status === 'settled' ? '#228B22' :
                                                  debt.status === 'forgiven' ? '#4169E1' : '#FFA500',
                                  color: 'white',
                                }}
                              >
                                {debt.status || 'outstanding'}
                              </span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#5D4037', marginTop: '4px' }}>
                              {debt.type && <span style={{ textTransform: 'capitalize' }}>{debt.type}: </span>}
                              {debt.description}
                            </div>
                            {debt.status === 'outstanding' && (
                              <button
                                style={{ ...styles.button, ...styles.buttonSuccess }}
                                onClick={() => handleSettleDebt(selectedRelationship.npc_id, idx)}
                              >
                                Settle Debt
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}

                {detailTab === 'knowledge' && (
                  <>
                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Secrets Discovered</div>
                      {parseJsonField(selectedRelationship.discovered_secrets).length === 0 ? (
                        <div style={{ ...styles.noData, padding: '15px' }}>No secrets discovered</div>
                      ) : (
                        parseJsonField(selectedRelationship.discovered_secrets).map((secret, idx) => (
                          <div key={idx} style={styles.secretItem}>
                            🔒 {secret}
                          </div>
                        ))
                      )}
                    </div>

                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Known Facts</div>
                      {parseJsonField(selectedRelationship.known_facts).length === 0 ? (
                        <div style={{ ...styles.noData, padding: '15px' }}>No facts recorded</div>
                      ) : (
                        parseJsonField(selectedRelationship.known_facts).map((fact, idx) => (
                          <div key={idx} style={styles.factItem}>
                            📝 {fact}
                          </div>
                        ))
                      )}
                    </div>

                    <div style={styles.detailSection}>
                      <div style={styles.detailLabel}>Rumors Heard</div>
                      {parseJsonField(selectedRelationship.rumors_heard).length === 0 ? (
                        <div style={{ ...styles.noData, padding: '15px' }}>No rumors heard</div>
                      ) : (
                        parseJsonField(selectedRelationship.rumors_heard).map((rumor, idx) => (
                          <div key={idx} style={styles.listItem}>
                            <div style={styles.listItemHeader}>
                              <span>💬 {rumor.content || rumor}</span>
                              {rumor.disproven && (
                                <span style={{ ...styles.badge, backgroundColor: '#CD5C5C', color: 'white' }}>
                                  Disproven
                                </span>
                              )}
                            </div>
                            {!rumor.disproven && (
                              <button
                                style={{ ...styles.button, ...styles.buttonSecondary }}
                                onClick={() => handleDisproveRumor(idx)}
                              >
                                Disprove
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default NPCRelationshipsPage;
