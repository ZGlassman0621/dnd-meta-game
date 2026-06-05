import { useState, useEffect } from 'react';

const styles = {
  container: {
    padding: '1rem',
    maxWidth: '1400px',
    margin: '0 auto'
  },
  header: {
    marginBottom: '1.5rem'
  },
  title: {
    fontSize: '1.8rem',
    marginBottom: '0.5rem',
    color: '#f5f5f5'
  },
  subtitle: {
    color: '#888',
    fontSize: '0.95rem'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1.5fr',
    gap: '1.5rem'
  },
  panel: {
    background: 'rgba(0, 0, 0, 0.3)',
    borderRadius: '8px',
    padding: '1rem',
    border: '1px solid rgba(255, 255, 255, 0.1)'
  },
  panelTitle: {
    fontSize: '1.1rem',
    marginBottom: '1rem',
    color: '#f5f5f5',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '0.5rem'
  },
  filterTabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    flexWrap: 'wrap'
  },
  filterTab: {
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s'
  },
  questList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '500px',
    overflowY: 'auto'
  },
  questCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  },
  questCardSelected: {
    border: '1px solid #3498db',
    background: 'rgba(52, 152, 219, 0.1)'
  },
  questHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.5rem'
  },
  questTitle: {
    fontSize: '0.95rem',
    color: '#f5f5f5',
    fontWeight: '500'
  },
  questMeta: {
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: '0.25rem'
  },
  badge: {
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
    fontWeight: '500',
    textTransform: 'uppercase'
  },
  typeBadge: {
    main: { background: 'rgba(155, 89, 182, 0.3)', color: '#9b59b6' },
    side: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' },
    companion: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    one_time: { background: 'rgba(241, 196, 15, 0.3)', color: '#f1c40f' }
  },
  statusBadge: {
    active: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    completed: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' },
    failed: { background: 'rgba(231, 76, 60, 0.3)', color: '#e74c3c' },
    abandoned: { background: 'rgba(149, 165, 166, 0.3)', color: '#95a5a6' }
  },
  urgencyBadge: {
    leisure: { background: 'rgba(149, 165, 166, 0.3)', color: '#95a5a6' },
    normal: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' },
    pressing: { background: 'rgba(241, 196, 15, 0.3)', color: '#f1c40f' },
    urgent: { background: 'rgba(230, 126, 34, 0.3)', color: '#e67e22' },
    critical: { background: 'rgba(231, 76, 60, 0.3)', color: '#e74c3c' }
  },
  stageIndicator: {
    fontSize: '0.75rem',
    color: '#888',
    marginTop: '0.25rem'
  },
  progressBar: {
    height: '4px',
    background: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '2px',
    marginTop: '0.5rem',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: '#3498db',
    borderRadius: '2px',
    transition: 'width 0.3s'
  },
  detailSection: {
    marginBottom: '1.5rem'
  },
  sectionTitle: {
    fontSize: '0.9rem',
    color: '#888',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginBottom: '1rem'
  },
  infoItem: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '0.75rem',
    borderRadius: '6px',
    textAlign: 'center'
  },
  infoLabel: {
    fontSize: '0.75rem',
    color: '#888',
    marginBottom: '0.25rem'
  },
  infoValue: {
    fontSize: '1rem',
    color: '#f5f5f5'
  },
  premise: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.5',
    fontStyle: 'italic'
  },
  stagesContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem'
  },
  stageCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.75rem',
    borderLeft: '3px solid',
    transition: 'all 0.2s'
  },
  stageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.25rem'
  },
  stageName: {
    fontSize: '0.9rem',
    fontWeight: '500'
  },
  stageDescription: {
    fontSize: '0.85rem',
    color: '#aaa'
  },
  requirementsList: {
    marginTop: '0.5rem',
    paddingLeft: '1rem'
  },
  requirementItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.25rem 0',
    fontSize: '0.85rem'
  },
  requirementCheck: {
    width: '18px',
    height: '18px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    flexShrink: 0
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  button: {
    padding: '0.5rem 1rem',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s'
  },
  primaryButton: {
    background: '#3498db',
    color: '#fff'
  },
  successButton: {
    background: '#2ecc71',
    color: '#fff'
  },
  dangerButton: {
    background: '#e74c3c',
    color: '#fff'
  },
  warningButton: {
    background: '#f39c12',
    color: '#fff'
  },
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: '#888'
  },
  rewardsGrid: {
    display: 'flex',
    gap: '1rem',
    flexWrap: 'wrap'
  },
  rewardItem: {
    background: 'rgba(241, 196, 15, 0.1)',
    border: '1px solid rgba(241, 196, 15, 0.3)',
    borderRadius: '6px',
    padding: '0.5rem 0.75rem',
    fontSize: '0.85rem',
    color: '#f1c40f'
  },
  antagonist: {
    background: 'rgba(231, 76, 60, 0.1)',
    border: '1px solid rgba(231, 76, 60, 0.3)',
    borderRadius: '6px',
    padding: '0.75rem',
    marginTop: '0.5rem'
  },
  antagonistName: {
    color: '#e74c3c',
    fontWeight: '500',
    marginBottom: '0.25rem'
  },
  antagonistDesc: {
    fontSize: '0.85rem',
    color: '#aaa'
  },
  tabs: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1rem',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
    paddingBottom: '0.5rem'
  },
  tab: {
    padding: '0.5rem 1rem',
    borderRadius: '4px 4px 0 0',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.9rem',
    background: 'transparent',
    color: '#888',
    transition: 'all 0.2s'
  },
  tabActive: {
    background: 'rgba(52, 152, 219, 0.2)',
    color: '#3498db'
  }
};

export default function QuestsPage({ character }) {
  const [quests, setQuests] = useState([]);
  const [selectedQuest, setSelectedQuest] = useState(null);
  const [questRequirements, setQuestRequirements] = useState([]);
  const [filter, setFilter] = useState('active');
  const [detailTab, setDetailTab] = useState('info');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (character?.id) {
      loadQuests();
    }
  }, [character]);

  useEffect(() => {
    if (selectedQuest?.id) {
      loadQuestRequirements(selectedQuest.id);
    }
  }, [selectedQuest?.id]);

  const loadQuests = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/quest/character/${character.id}`);
      const data = await response.json();
      setQuests(data);
    } catch (error) {
      console.error('Error loading quests:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQuestRequirements = async (questId) => {
    try {
      const response = await fetch(`/api/quest/${questId}/requirements`);
      const data = await response.json();
      setQuestRequirements(data);
    } catch (error) {
      console.error('Error loading quest requirements:', error);
    }
  };

  const handleAdvanceStage = async () => {
    if (!selectedQuest) return;
    try {
      const response = await fetch(`/api/quest/${selectedQuest.id}/advance`, { method: 'POST' });
      const updated = await response.json();
      setSelectedQuest(updated);
      loadQuests();
    } catch (error) {
      console.error('Error advancing quest stage:', error);
    }
  };

  const handleCompleteQuest = async () => {
    if (!selectedQuest) return;
    try {
      const response = await fetch(`/api/quest/${selectedQuest.id}/complete`, { method: 'POST' });
      const updated = await response.json();
      setSelectedQuest(updated);
      loadQuests();
    } catch (error) {
      console.error('Error completing quest:', error);
    }
  };

  const handleFailQuest = async () => {
    if (!selectedQuest) return;
    try {
      const response = await fetch(`/api/quest/${selectedQuest.id}/fail`, { method: 'POST' });
      const updated = await response.json();
      setSelectedQuest(updated);
      loadQuests();
    } catch (error) {
      console.error('Error failing quest:', error);
    }
  };

  const handleAbandonQuest = async () => {
    if (!selectedQuest) return;
    try {
      const response = await fetch(`/api/quest/${selectedQuest.id}/abandon`, { method: 'POST' });
      const updated = await response.json();
      setSelectedQuest(updated);
      loadQuests();
    } catch (error) {
      console.error('Error abandoning quest:', error);
    }
  };

  const handleCompleteRequirement = async (reqId) => {
    try {
      await fetch(`/api/quest/requirement/${reqId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed_by: 'manual' })
      });
      loadQuestRequirements(selectedQuest.id);
    } catch (error) {
      console.error('Error completing requirement:', error);
    }
  };

  const filteredQuests = quests.filter(q => {
    if (filter === 'all') return true;
    if (filter === 'active') return q.status === 'active';
    if (filter === 'completed') return q.status === 'completed';
    if (filter === 'failed') return q.status === 'failed' || q.status === 'abandoned';
    return true;
  });

  const getTypeIcon = (type) => {
    const icons = { main: '👑', side: '📜', companion: '👤', one_time: '⚡' };
    return icons[type] || '📜';
  };

  const parseJsonSafe = (str, defaultVal = []) => {
    if (!str) return defaultVal;
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return defaultVal; }
  };

  const getStages = (quest) => parseJsonSafe(quest?.stages, []);
  const getRewards = (quest) => parseJsonSafe(quest?.rewards, {});
  const getAntagonist = (quest) => parseJsonSafe(quest?.antagonist, null);

  const getStageProgress = (quest) => {
    const stages = getStages(quest);
    if (stages.length === 0) return 0;
    return ((quest.current_stage || 0) / stages.length) * 100;
  };

  const getStageColor = (stageIndex, currentStage, questStatus) => {
    if (questStatus === 'completed') return '#2ecc71';
    if (questStatus === 'failed' || questStatus === 'abandoned') return '#e74c3c';
    if (stageIndex < currentStage) return '#2ecc71';
    if (stageIndex === currentStage) return '#3498db';
    return '#555';
  };

  const getRequirementsForStage = (stageIndex) => {
    return questRequirements.filter(r => r.stage_index === stageIndex);
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Loading quests...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Quest Tracker</h2>
        <p style={styles.subtitle}>
          Track your quests, objectives, and progress for {character.name}
        </p>
      </div>

      <div style={styles.grid}>
        {/* Left Panel - Quest List */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Quests</h3>

          <div style={styles.filterTabs}>
            {['active', 'completed', 'failed', 'all'].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={{
                  ...styles.filterTab,
                  background: filter === f ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                  color: filter === f ? '#3498db' : '#888'
                }}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          <div style={styles.questList}>
            {filteredQuests.length === 0 ? (
              <div style={styles.emptyState}>
                No {filter === 'all' ? '' : filter} quests found
              </div>
            ) : (
              filteredQuests.map(quest => (
                <div
                  key={quest.id}
                  style={{
                    ...styles.questCard,
                    ...(selectedQuest?.id === quest.id ? styles.questCardSelected : {})
                  }}
                  onClick={() => setSelectedQuest(quest)}
                >
                  <div style={styles.questHeader}>
                    <span style={styles.questTitle}>
                      {getTypeIcon(quest.quest_type)} {quest.title}
                    </span>
                  </div>
                  <div style={styles.questMeta}>
                    <span style={{
                      ...styles.badge,
                      ...styles.typeBadge[quest.quest_type]
                    }}>
                      {quest.quest_type?.replace('_', ' ')}
                    </span>
                    <span style={{
                      ...styles.badge,
                      ...styles.statusBadge[quest.status]
                    }}>
                      {quest.status}
                    </span>
                    {quest.priority && (
                      <span style={{
                        ...styles.badge,
                        ...styles.urgencyBadge[quest.priority]
                      }}>
                        {quest.priority}
                      </span>
                    )}
                  </div>
                  <div style={styles.stageIndicator}>
                    Stage {(quest.current_stage || 0) + 1} of {getStages(quest).length || '?'}
                  </div>
                  {quest.status === 'active' && (
                    <div style={styles.progressBar}>
                      <div style={{
                        ...styles.progressFill,
                        width: `${getStageProgress(quest)}%`
                      }} />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Panel - Quest Detail */}
        <div style={styles.panel}>
          {selectedQuest ? (
            <>
              <h3 style={styles.panelTitle}>
                {getTypeIcon(selectedQuest.quest_type)} {selectedQuest.title}
              </h3>

              <div style={styles.tabs}>
                {['info', 'stages', 'rewards'].map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    style={{
                      ...styles.tab,
                      ...(detailTab === tab ? styles.tabActive : {})
                    }}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>

              {detailTab === 'info' && (
                <>
                  <div style={styles.detailSection}>
                    <div style={styles.infoGrid}>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Type</div>
                        <div style={styles.infoValue}>
                          {selectedQuest.quest_type?.replace('_', ' ')}
                        </div>
                      </div>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Status</div>
                        <div style={styles.infoValue}>{selectedQuest.status}</div>
                      </div>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Priority</div>
                        <div style={styles.infoValue}>{selectedQuest.priority || 'Normal'}</div>
                      </div>
                    </div>

                    <div style={styles.sectionTitle}>Premise</div>
                    <div style={styles.premise}>
                      {selectedQuest.premise || selectedQuest.description || 'No premise available'}
                    </div>

                    {getAntagonist(selectedQuest) && (
                      <>
                        <div style={{ ...styles.sectionTitle, marginTop: '1rem' }}>Antagonist</div>
                        <div style={styles.antagonist}>
                          <div style={styles.antagonistName}>
                            {getAntagonist(selectedQuest).name}
                          </div>
                          <div style={styles.antagonistDesc}>
                            {getAntagonist(selectedQuest).description || getAntagonist(selectedQuest).type}
                          </div>
                        </div>
                      </>
                    )}

                    {selectedQuest.time_sensitive && selectedQuest.deadline_date && (
                      <div style={{ marginTop: '1rem', color: '#e74c3c', fontSize: '0.9rem' }}>
                        ⚠️ Deadline: {new Date(selectedQuest.deadline_date).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {selectedQuest.status === 'active' && (
                    <div style={styles.actions}>
                      <button
                        style={{ ...styles.button, ...styles.primaryButton }}
                        onClick={handleAdvanceStage}
                      >
                        Advance Stage
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.successButton }}
                        onClick={handleCompleteQuest}
                      >
                        Complete Quest
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.dangerButton }}
                        onClick={handleFailQuest}
                      >
                        Fail Quest
                      </button>
                      <button
                        style={{ ...styles.button, ...styles.warningButton }}
                        onClick={handleAbandonQuest}
                      >
                        Abandon
                      </button>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'stages' && (
                <div style={styles.detailSection}>
                  <div style={styles.stagesContainer}>
                    {getStages(selectedQuest).length === 0 ? (
                      <div style={styles.emptyState}>No stages defined</div>
                    ) : (
                      getStages(selectedQuest).map((stage, idx) => {
                        const stageReqs = getRequirementsForStage(idx);
                        const borderColor = getStageColor(idx, selectedQuest.current_stage, selectedQuest.status);
                        const isCurrent = idx === selectedQuest.current_stage && selectedQuest.status === 'active';

                        return (
                          <div
                            key={idx}
                            style={{
                              ...styles.stageCard,
                              borderLeftColor: borderColor,
                              background: isCurrent ? 'rgba(52, 152, 219, 0.1)' : 'rgba(255, 255, 255, 0.05)'
                            }}
                          >
                            <div style={styles.stageHeader}>
                              <span style={{
                                ...styles.stageName,
                                color: borderColor
                              }}>
                                Stage {idx + 1}: {stage.name || `Stage ${idx + 1}`}
                              </span>
                              {idx < selectedQuest.current_stage && <span>✓</span>}
                              {isCurrent && <span style={{ color: '#3498db' }}>Current</span>}
                            </div>
                            <div style={styles.stageDescription}>
                              {stage.description || 'No description'}
                            </div>

                            {stageReqs.length > 0 && (
                              <div style={styles.requirementsList}>
                                {stageReqs.map(req => (
                                  <div key={req.id} style={styles.requirementItem}>
                                    <div
                                      style={{
                                        ...styles.requirementCheck,
                                        background: req.status === 'completed'
                                          ? 'rgba(46, 204, 113, 0.3)'
                                          : 'rgba(255, 255, 255, 0.1)',
                                        color: req.status === 'completed' ? '#2ecc71' : '#888',
                                        cursor: req.status !== 'completed' && isCurrent ? 'pointer' : 'default'
                                      }}
                                      onClick={() => {
                                        if (req.status !== 'completed' && isCurrent) {
                                          handleCompleteRequirement(req.id);
                                        }
                                      }}
                                    >
                                      {req.status === 'completed' ? '✓' : '○'}
                                    </div>
                                    <span style={{
                                      color: req.status === 'completed' ? '#2ecc71' : '#ccc',
                                      textDecoration: req.status === 'completed' ? 'line-through' : 'none'
                                    }}>
                                      {req.description}
                                      {req.is_optional && <span style={{ color: '#888' }}> (optional)</span>}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {detailTab === 'rewards' && (
                <div style={styles.detailSection}>
                  <div style={styles.sectionTitle}>Rewards</div>
                  {Object.keys(getRewards(selectedQuest)).length === 0 ? (
                    <div style={styles.emptyState}>No rewards specified</div>
                  ) : (
                    <div style={styles.rewardsGrid}>
                      {getRewards(selectedQuest).xp && (
                        <div style={styles.rewardItem}>
                          ✨ {getRewards(selectedQuest).xp} XP
                        </div>
                      )}
                      {getRewards(selectedQuest).gold && (
                        <div style={styles.rewardItem}>
                          💰 {getRewards(selectedQuest).gold} Gold
                        </div>
                      )}
                      {getRewards(selectedQuest).items?.map((item, idx) => (
                        <div key={idx} style={styles.rewardItem}>
                          🎁 {typeof item === 'string' ? item : item.name}
                        </div>
                      ))}
                      {getRewards(selectedQuest).reputation && (
                        <div style={styles.rewardItem}>
                          ⭐ {getRewards(selectedQuest).reputation} Reputation
                        </div>
                      )}
                    </div>
                  )}

                  {selectedQuest.world_impact_on_complete && (
                    <>
                      <div style={{ ...styles.sectionTitle, marginTop: '1.5rem' }}>World Impact</div>
                      <div style={{
                        ...styles.premise,
                        background: 'rgba(155, 89, 182, 0.1)',
                        borderLeft: '3px solid #9b59b6'
                      }}>
                        {selectedQuest.world_impact_on_complete}
                      </div>
                    </>
                  )}

                  {selectedQuest.escalation_if_ignored && (
                    <>
                      <div style={{ ...styles.sectionTitle, marginTop: '1.5rem' }}>If Ignored...</div>
                      <div style={{
                        ...styles.premise,
                        background: 'rgba(231, 76, 60, 0.1)',
                        borderLeft: '3px solid #e74c3c'
                      }}>
                        {selectedQuest.escalation_if_ignored}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyState}>
              Select a quest to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
