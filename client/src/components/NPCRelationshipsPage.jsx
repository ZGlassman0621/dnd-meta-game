import React, { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '20px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#8B4513',
    margin: 0,
  },
  summaryBar: {
    display: 'flex',
    gap: '20px',
    padding: '10px 15px',
    backgroundColor: '#FFF8DC',
    border: '1px solid #DEB887',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  summaryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  summaryCount: {
    fontWeight: 'bold',
    fontSize: '18px',
  },
  mainContent: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
  },
  panel: {
    backgroundColor: '#FFF8DC',
    border: '2px solid #8B4513',
    borderRadius: '8px',
    padding: '15px',
    minHeight: '500px',
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '15px',
    borderBottom: '1px solid #DEB887',
    paddingBottom: '8px',
  },
  filterTabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
    flexWrap: 'wrap',
  },
  filterTab: {
    padding: '6px 12px',
    border: '1px solid #8B4513',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#FFF8DC',
    color: '#8B4513',
    fontSize: '13px',
  },
  filterTabActive: {
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
  },
  npcList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '450px',
    overflowY: 'auto',
  },
  npcCard: {
    padding: '12px',
    border: '1px solid #DEB887',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#FFFEF0',
    transition: 'all 0.2s',
  },
  npcCardSelected: {
    backgroundColor: '#DEB887',
    borderColor: '#8B4513',
  },
  npcName: {
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  npcMeta: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '6px',
  },
  dispositionBar: {
    height: '6px',
    backgroundColor: '#E0E0E0',
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
    backgroundColor: '#666',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  detailSection: {
    marginBottom: '20px',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '4px',
    fontSize: '14px',
  },
  detailValue: {
    color: '#333',
    marginBottom: '8px',
  },
  listItem: {
    padding: '8px 12px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    marginBottom: '6px',
    backgroundColor: '#FFFEF0',
    fontSize: '13px',
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    marginRight: '6px',
    marginTop: '4px',
  },
  buttonSecondary: {
    backgroundColor: '#DEB887',
    color: '#8B4513',
  },
  buttonDanger: {
    backgroundColor: '#CD5C5C',
    color: 'white',
  },
  buttonSuccess: {
    backgroundColor: '#228B22',
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
    backgroundColor: '#DDD',
    border: '1px solid #AAA',
  },
  trustDotFilled: {
    backgroundColor: '#4169E1',
    borderColor: '#4169E1',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '10px',
  },
  statBox: {
    padding: '8px',
    backgroundColor: '#F5F5DC',
    borderRadius: '4px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '20px',
    fontWeight: 'bold',
    color: '#8B4513',
  },
  statLabel: {
    fontSize: '11px',
    color: '#666',
  },
  tabContent: {
    marginTop: '15px',
  },
  secretItem: {
    backgroundColor: '#2C3E50',
    color: '#FFF',
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px',
  },
  factItem: {
    backgroundColor: '#E8F5E9',
    padding: '8px 12px',
    borderRadius: '4px',
    marginBottom: '6px',
    fontSize: '13px',
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
        <span style={{ fontSize: '12px', color: '#666' }}>Trust:</span>
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
                            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
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
