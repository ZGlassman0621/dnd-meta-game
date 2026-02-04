import { useState, useEffect } from 'react';

export default function CompanionBackstoryPage({ characterId }) {
  const [companions, setCompanions] = useState([]);
  const [selectedCompanion, setSelectedCompanion] = useState(null);
  const [backstory, setBackstory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backstoryLoading, setBackstoryLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('story');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (characterId) {
      fetchCompanions();
    }
  }, [characterId]);

  useEffect(() => {
    if (selectedCompanion) {
      fetchBackstory(selectedCompanion.id);
    } else {
      setBackstory(null);
    }
  }, [selectedCompanion]);

  const fetchCompanions = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/companion/character/${characterId}`);
      const data = await response.json();
      setCompanions(data);
      if (data.length > 0 && !selectedCompanion) {
        setSelectedCompanion(data[0]);
      }
    } catch (err) {
      setError('Failed to fetch companions');
    } finally {
      setLoading(false);
    }
  };

  const fetchBackstory = async (companionId) => {
    try {
      setBackstoryLoading(true);
      setError(null);
      const response = await fetch(`/api/companion/${companionId}/backstory`);
      if (response.ok) {
        const data = await response.json();
        setBackstory(data);
      } else if (response.status === 404) {
        setBackstory(null);
      } else {
        throw new Error('Failed to fetch backstory');
      }
    } catch (err) {
      setBackstory(null);
    } finally {
      setBackstoryLoading(false);
    }
  };

  const handleGenerateBackstory = async (regenerate = false) => {
    if (!selectedCompanion) return;
    try {
      setGenerating(true);
      setError(null);
      const response = await fetch(`/api/companion/${selectedCompanion.id}/backstory/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate })
      });
      const data = await response.json();
      if (response.ok) {
        setBackstory(data.backstory);
      } else {
        setError(data.error || 'Failed to generate backstory');
      }
    } catch (err) {
      setError('Failed to generate backstory');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddThread = async () => {
    if (!selectedCompanion || !backstory) return;
    try {
      setGenerating(true);
      const response = await fetch(`/api/companion/${selectedCompanion.id}/backstory/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 1 })
      });
      const data = await response.json();
      if (response.ok) {
        setBackstory(data.backstory);
      } else {
        setError(data.error || 'Failed to add thread');
      }
    } catch (err) {
      setError('Failed to add thread');
    } finally {
      setGenerating(false);
    }
  };

  const handleUpdateThread = async (threadId, status, resolution) => {
    if (!selectedCompanion || !backstory) return;
    try {
      const response = await fetch(`/api/companion/${selectedCompanion.id}/backstory/thread/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, resolution })
      });
      const data = await response.json();
      if (response.ok) {
        setBackstory(data.backstory);
      }
    } catch (err) {
      setError('Failed to update thread');
    }
  };

  const handleGenerateSecret = async () => {
    if (!selectedCompanion || !backstory) return;
    try {
      setGenerating(true);
      const response = await fetch(`/api/companion/${selectedCompanion.id}/backstory/secret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const data = await response.json();
      if (response.ok) {
        setBackstory(data.backstory);
      } else {
        setError(data.error || 'Failed to generate secret');
      }
    } catch (err) {
      setError('Failed to generate secret');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevealSecret = async (secretId) => {
    if (!selectedCompanion || !backstory) return;
    try {
      const response = await fetch(`/api/companion/${selectedCompanion.id}/backstory/secret/${secretId}/reveal`, {
        method: 'POST'
      });
      const data = await response.json();
      if (response.ok) {
        setBackstory(data.backstory);
      }
    } catch (err) {
      setError('Failed to reveal secret');
    }
  };

  const getThreadStatusIcon = (status) => {
    switch (status) {
      case 'active': return '🔥';
      case 'developing': return '📖';
      case 'resolved': return '✅';
      case 'abandoned': return '❌';
      default: return '❓';
    }
  };

  const getThreadStatusColor = (status) => {
    switch (status) {
      case 'active': return '#e74c3c';
      case 'developing': return '#f39c12';
      case 'resolved': return '#27ae60';
      case 'abandoned': return '#7f8c8d';
      default: return '#95a5a6';
    }
  };

  const styles = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: '20px',
      padding: '20px'
    },
    listPanel: {
      width: '300px',
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '15px',
      overflowY: 'auto'
    },
    detailPanel: {
      flex: 1,
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '20px',
      overflowY: 'auto'
    },
    sectionTitle: {
      color: '#e74c3c',
      fontSize: '18px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    companionItem: {
      padding: '12px',
      backgroundColor: '#34495e',
      borderRadius: '6px',
      marginBottom: '8px',
      cursor: 'pointer',
      transition: 'background-color 0.2s'
    },
    companionItemSelected: {
      backgroundColor: '#8e44ad'
    },
    companionName: {
      fontWeight: 'bold',
      color: '#ecf0f1'
    },
    companionInfo: {
      fontSize: '12px',
      color: '#bdc3c7',
      marginTop: '4px'
    },
    tabs: {
      display: 'flex',
      gap: '10px',
      marginBottom: '20px',
      borderBottom: '1px solid #34495e',
      paddingBottom: '10px'
    },
    tab: {
      padding: '8px 16px',
      backgroundColor: '#34495e',
      border: 'none',
      borderRadius: '4px',
      color: '#ecf0f1',
      cursor: 'pointer',
      fontSize: '14px'
    },
    tabActive: {
      backgroundColor: '#8e44ad'
    },
    headerRow: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '15px'
    },
    button: {
      padding: '8px 16px',
      backgroundColor: '#8e44ad',
      border: 'none',
      borderRadius: '4px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    buttonSmall: {
      padding: '4px 10px',
      fontSize: '12px'
    },
    buttonDanger: {
      backgroundColor: '#c0392b'
    },
    buttonSuccess: {
      backgroundColor: '#27ae60'
    },
    storyText: {
      color: '#ecf0f1',
      lineHeight: '1.8',
      whiteSpace: 'pre-wrap',
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px'
    },
    threadCard: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '12px',
      borderLeft: '4px solid'
    },
    threadHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10px'
    },
    threadTitle: {
      fontWeight: 'bold',
      color: '#ecf0f1',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    threadDescription: {
      color: '#bdc3c7',
      fontSize: '14px',
      marginBottom: '10px'
    },
    threadActions: {
      display: 'flex',
      gap: '8px',
      marginTop: '10px'
    },
    secretCard: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '12px',
      borderLeft: '4px solid #9b59b6'
    },
    secretHidden: {
      filter: 'blur(4px)',
      userSelect: 'none'
    },
    secretRevealed: {
      borderLeftColor: '#27ae60'
    },
    secretCategory: {
      fontSize: '12px',
      color: '#9b59b6',
      textTransform: 'uppercase',
      marginBottom: '8px'
    },
    secretContent: {
      color: '#ecf0f1',
      lineHeight: '1.6'
    },
    emptyState: {
      textAlign: 'center',
      color: '#7f8c8d',
      padding: '40px',
      fontSize: '16px'
    },
    loadingState: {
      textAlign: 'center',
      color: '#9b59b6',
      padding: '40px'
    },
    error: {
      backgroundColor: '#c0392b',
      color: 'white',
      padding: '10px',
      borderRadius: '4px',
      marginBottom: '15px'
    },
    select: {
      padding: '4px 8px',
      backgroundColor: '#2c3e50',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '12px'
    },
    noBackstoryContainer: {
      textAlign: 'center',
      padding: '60px 20px'
    },
    noBackstoryText: {
      color: '#7f8c8d',
      marginBottom: '20px',
      fontSize: '16px'
    }
  };

  if (loading) {
    return <div style={styles.loadingState}>Loading companions...</div>;
  }

  if (!characterId) {
    return <div style={styles.emptyState}>Please select a character first</div>;
  }

  return (
    <div style={styles.container}>
      {/* Companions List */}
      <div style={styles.listPanel}>
        <div style={styles.sectionTitle}>
          📚 Companion Backstories
        </div>
        {companions.length === 0 ? (
          <div style={styles.emptyState}>No companions yet</div>
        ) : (
          companions.map(companion => (
            <div
              key={companion.id}
              style={{
                ...styles.companionItem,
                ...(selectedCompanion?.id === companion.id ? styles.companionItemSelected : {})
              }}
              onClick={() => setSelectedCompanion(companion)}
            >
              <div style={styles.companionName}>
                {companion.avatar || '👤'} {companion.name}
              </div>
              <div style={styles.companionInfo}>
                {companion.race} {companion.companion_class || companion.occupation || ''}
                {companion.companion_level && ` • Level ${companion.companion_level}`}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Backstory Detail */}
      <div style={styles.detailPanel}>
        {!selectedCompanion ? (
          <div style={styles.emptyState}>Select a companion to view their backstory</div>
        ) : backstoryLoading ? (
          <div style={styles.loadingState}>Loading backstory...</div>
        ) : (
          <>
            <div style={styles.headerRow}>
              <h2 style={{ color: '#ecf0f1', margin: 0 }}>
                {selectedCompanion.name}'s Backstory
              </h2>
              {backstory ? (
                <button
                  style={{
                    ...styles.button,
                    ...(generating ? styles.buttonDisabled : {})
                  }}
                  onClick={() => handleGenerateBackstory(true)}
                  disabled={generating}
                >
                  {generating ? '⏳ Regenerating...' : '🔄 Regenerate'}
                </button>
              ) : null}
            </div>

            {error && <div style={styles.error}>{error}</div>}

            {!backstory ? (
              <div style={styles.noBackstoryContainer}>
                <div style={styles.noBackstoryText}>
                  No backstory has been generated for {selectedCompanion.name} yet.
                </div>
                <button
                  style={{
                    ...styles.button,
                    ...(generating ? styles.buttonDisabled : {}),
                    padding: '12px 24px',
                    fontSize: '16px'
                  }}
                  onClick={() => handleGenerateBackstory(false)}
                  disabled={generating}
                >
                  {generating ? '⏳ Generating...' : '✨ Generate Backstory'}
                </button>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div style={styles.tabs}>
                  <button
                    style={{
                      ...styles.tab,
                      ...(activeTab === 'story' ? styles.tabActive : {})
                    }}
                    onClick={() => setActiveTab('story')}
                  >
                    📖 Story
                  </button>
                  <button
                    style={{
                      ...styles.tab,
                      ...(activeTab === 'threads' ? styles.tabActive : {})
                    }}
                    onClick={() => setActiveTab('threads')}
                  >
                    🧵 Threads ({(backstory.unresolved_threads || []).length})
                  </button>
                  <button
                    style={{
                      ...styles.tab,
                      ...(activeTab === 'secrets' ? styles.tabActive : {})
                    }}
                    onClick={() => setActiveTab('secrets')}
                  >
                    🔒 Secrets ({(backstory.secrets || []).length})
                  </button>
                </div>

                {/* Story Tab */}
                {activeTab === 'story' && (
                  <div>
                    <h3 style={{ color: '#9b59b6', marginBottom: '15px' }}>Personal History</h3>
                    <div style={styles.storyText}>
                      {backstory.summary || backstory.history || 'No story content available.'}
                    </div>

                    {backstory.origin && (
                      <>
                        <h3 style={{ color: '#9b59b6', marginTop: '20px', marginBottom: '15px' }}>Origin</h3>
                        <div style={styles.storyText}>{backstory.origin}</div>
                      </>
                    )}

                    {backstory.motivation && (
                      <>
                        <h3 style={{ color: '#9b59b6', marginTop: '20px', marginBottom: '15px' }}>Motivation</h3>
                        <div style={styles.storyText}>{backstory.motivation}</div>
                      </>
                    )}

                    {backstory.relationships && backstory.relationships.length > 0 && (
                      <>
                        <h3 style={{ color: '#9b59b6', marginTop: '20px', marginBottom: '15px' }}>Key Relationships</h3>
                        {backstory.relationships.map((rel, idx) => (
                          <div key={idx} style={{ ...styles.storyText, marginBottom: '10px' }}>
                            <strong>{rel.name}</strong> ({rel.relationship}): {rel.description}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* Threads Tab */}
                {activeTab === 'threads' && (
                  <div>
                    <div style={styles.headerRow}>
                      <h3 style={{ color: '#9b59b6', margin: 0 }}>Unresolved Threads</h3>
                      <button
                        style={{
                          ...styles.button,
                          ...styles.buttonSmall,
                          ...(generating ? styles.buttonDisabled : {})
                        }}
                        onClick={handleAddThread}
                        disabled={generating}
                      >
                        {generating ? '⏳' : '➕'} Add Thread
                      </button>
                    </div>
                    <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '20px' }}>
                      Story threads that can be developed during gameplay
                    </p>

                    {(!backstory.unresolved_threads || backstory.unresolved_threads.length === 0) ? (
                      <div style={styles.emptyState}>No threads yet. Add one to create story hooks!</div>
                    ) : (
                      backstory.unresolved_threads.map((thread, idx) => (
                        <div
                          key={thread.id || idx}
                          style={{
                            ...styles.threadCard,
                            borderLeftColor: getThreadStatusColor(thread.status)
                          }}
                        >
                          <div style={styles.threadHeader}>
                            <div style={styles.threadTitle}>
                              {getThreadStatusIcon(thread.status)} {thread.title || thread.name || `Thread ${idx + 1}`}
                            </div>
                            <select
                              style={styles.select}
                              value={thread.status || 'active'}
                              onChange={(e) => handleUpdateThread(thread.id, e.target.value)}
                            >
                              <option value="active">Active</option>
                              <option value="developing">Developing</option>
                              <option value="resolved">Resolved</option>
                              <option value="abandoned">Abandoned</option>
                            </select>
                          </div>
                          <div style={styles.threadDescription}>
                            {thread.description || thread.content}
                          </div>
                          {thread.hooks && (
                            <div style={{ fontSize: '12px', color: '#9b59b6' }}>
                              <strong>Story Hooks:</strong> {thread.hooks}
                            </div>
                          )}
                          {thread.resolution && (
                            <div style={{ fontSize: '12px', color: '#27ae60', marginTop: '8px' }}>
                              <strong>Resolution:</strong> {thread.resolution}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* Secrets Tab */}
                {activeTab === 'secrets' && (
                  <div>
                    <div style={styles.headerRow}>
                      <h3 style={{ color: '#9b59b6', margin: 0 }}>Hidden Secrets</h3>
                      <button
                        style={{
                          ...styles.button,
                          ...styles.buttonSmall,
                          ...(generating ? styles.buttonDisabled : {})
                        }}
                        onClick={handleGenerateSecret}
                        disabled={generating}
                      >
                        {generating ? '⏳' : '➕'} Add Secret
                      </button>
                    </div>
                    <p style={{ color: '#7f8c8d', fontSize: '14px', marginBottom: '20px' }}>
                      Hidden information that may be revealed during gameplay
                    </p>

                    {(!backstory.secrets || backstory.secrets.length === 0) ? (
                      <div style={styles.emptyState}>No secrets yet. Add one for dramatic reveals!</div>
                    ) : (
                      backstory.secrets.map((secret, idx) => (
                        <div
                          key={secret.id || idx}
                          style={{
                            ...styles.secretCard,
                            ...(secret.revealed ? styles.secretRevealed : {})
                          }}
                        >
                          <div style={styles.secretCategory}>
                            {secret.revealed ? '🔓' : '🔒'} {secret.category || 'Secret'}
                          </div>
                          <div
                            style={{
                              ...styles.secretContent,
                              ...(secret.revealed ? {} : styles.secretHidden)
                            }}
                          >
                            {secret.content || secret.description}
                          </div>
                          {secret.impact && (
                            <div style={{
                              fontSize: '12px',
                              color: '#f39c12',
                              marginTop: '8px',
                              ...(secret.revealed ? {} : styles.secretHidden)
                            }}>
                              <strong>Potential Impact:</strong> {secret.impact}
                            </div>
                          )}
                          {!secret.revealed && (
                            <button
                              style={{
                                ...styles.button,
                                ...styles.buttonSmall,
                                ...styles.buttonSuccess,
                                marginTop: '10px'
                              }}
                              onClick={() => handleRevealSecret(secret.id)}
                            >
                              👁️ Reveal Secret
                            </button>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
