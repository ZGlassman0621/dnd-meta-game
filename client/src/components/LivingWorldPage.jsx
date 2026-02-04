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
  summaryCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
    marginBottom: '20px',
  },
  summaryCard: {
    backgroundColor: '#FFF8DC',
    border: '2px solid #8B4513',
    borderRadius: '8px',
    padding: '15px',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#8B4513',
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#666',
    marginTop: '4px',
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
    minHeight: '400px',
  },
  panelTitle: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '15px',
    borderBottom: '1px solid #DEB887',
    paddingBottom: '8px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlSection: {
    backgroundColor: '#F5F5DC',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '15px',
  },
  controlTitle: {
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '10px',
    fontSize: '14px',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '10px',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  buttonSecondary: {
    backgroundColor: '#DEB887',
    color: '#8B4513',
  },
  buttonSuccess: {
    backgroundColor: '#228B22',
    color: 'white',
  },
  buttonWarning: {
    backgroundColor: '#FFA500',
    color: 'white',
  },
  buttonDanger: {
    backgroundColor: '#CD5C5C',
    color: 'white',
  },
  input: {
    padding: '8px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    fontSize: '14px',
    width: '80px',
  },
  select: {
    padding: '8px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  listItem: {
    padding: '10px 12px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    marginBottom: '8px',
    backgroundColor: '#FFFEF0',
  },
  listItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px',
  },
  listItemTitle: {
    fontWeight: 'bold',
    color: '#8B4513',
  },
  listItemMeta: {
    fontSize: '12px',
    color: '#666',
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '11px',
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  progressBar: {
    height: '6px',
    backgroundColor: '#E0E0E0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '6px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4169E1',
    transition: 'width 0.3s',
  },
  noData: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
    fontStyle: 'italic',
  },
  resultBox: {
    backgroundColor: '#E8F5E9',
    padding: '12px',
    borderRadius: '6px',
    marginTop: '10px',
    fontSize: '13px',
  },
  resultBoxWarning: {
    backgroundColor: '#FFF3E0',
  },
  logEntry: {
    padding: '8px',
    borderLeft: '3px solid #4169E1',
    marginBottom: '6px',
    backgroundColor: '#FFFEF0',
    fontSize: '12px',
  },
  logEntrySuccess: {
    borderLeftColor: '#228B22',
  },
  logEntryWarning: {
    borderLeftColor: '#FFA500',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px',
  },
  tab: {
    padding: '8px 16px',
    border: '1px solid #8B4513',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#FFF8DC',
    color: '#8B4513',
    fontSize: '13px',
  },
  tabActive: {
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
  },
  effectCard: {
    padding: '8px 12px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    marginBottom: '6px',
    backgroundColor: '#F0F8FF',
    fontSize: '13px',
  },
};

const eventTypeColors = {
  political: '#9b59b6',
  economic: '#e67e22',
  military: '#e74c3c',
  natural: '#27ae60',
  magical: '#3498db',
  religious: '#8e44ad',
  social: '#1abc9c',
  conspiracy: '#2c3e50',
  threat: '#c0392b',
};

const LivingWorldPage = ({ character }) => {
  const [worldState, setWorldState] = useState(null);
  const [characterView, setCharacterView] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tickDays, setTickDays] = useState(1);
  const [simulateDays, setSimulateDays] = useState(7);
  const [tickResult, setTickResult] = useState(null);
  const [simulateResult, setSimulateResult] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generationResult, setGenerationResult] = useState(null);
  const [selectedFaction, setSelectedFaction] = useState('');
  const [eventType, setEventType] = useState('');
  const [viewTab, setViewTab] = useState('overview');

  useEffect(() => {
    if (character?.campaign_id) {
      loadWorldState();
      loadCharacterView();
    }
  }, [character?.campaign_id]);

  const loadWorldState = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/living-world/state/${character.campaign_id}`);
      const data = await response.json();
      setWorldState(data);
    } catch (error) {
      console.error('Error loading world state:', error);
    }
    setLoading(false);
  };

  const loadCharacterView = async () => {
    try {
      const response = await fetch(`/api/living-world/character-view/${character.id}`);
      const data = await response.json();
      setCharacterView(data);
    } catch (error) {
      console.error('Error loading character view:', error);
    }
  };

  const handleTick = async () => {
    try {
      const response = await fetch(`/api/living-world/tick/${character.campaign_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: tickDays }),
      });
      const data = await response.json();
      setTickResult(data);
      loadWorldState();
      loadCharacterView();
    } catch (error) {
      console.error('Error processing tick:', error);
    }
  };

  const handleSimulate = async () => {
    try {
      const response = await fetch(`/api/living-world/simulate/${character.campaign_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: simulateDays }),
      });
      const data = await response.json();
      setSimulateResult(data);
      loadWorldState();
      loadCharacterView();
    } catch (error) {
      console.error('Error simulating:', error);
    }
  };

  const handleGenerateFactionGoal = async () => {
    if (!selectedFaction) return;
    setGenerating(true);
    try {
      const response = await fetch(`/api/living-world/generate/faction-goal/${selectedFaction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoCreate: true }),
      });
      const data = await response.json();
      setGenerationResult({ type: 'faction-goal', data });
      loadWorldState();
    } catch (error) {
      console.error('Error generating faction goal:', error);
    }
    setGenerating(false);
  };

  const handleGenerateWorldEvent = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/living-world/generate/world-event/${character.campaign_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: eventType || undefined, autoCreate: true }),
      });
      const data = await response.json();
      setGenerationResult({ type: 'world-event', data });
      loadWorldState();
    } catch (error) {
      console.error('Error generating world event:', error);
    }
    setGenerating(false);
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

  const factions = worldState?.factions || [];
  const events = worldState?.events || [];
  const activeEffects = worldState?.activeEffects || [];
  const activeGoals = factions.flatMap(f => (f.goals || []).filter(g => g.status === 'active'));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Living World Dashboard</h1>
      </div>

      {/* Summary Cards */}
      <div style={styles.summaryCards}>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{factions.length}</div>
          <div style={styles.summaryLabel}>Active Factions</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{activeGoals.length}</div>
          <div style={styles.summaryLabel}>Active Goals</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{events.filter(e => e.status === 'active').length}</div>
          <div style={styles.summaryLabel}>Active Events</div>
        </div>
        <div style={styles.summaryCard}>
          <div style={styles.summaryValue}>{activeEffects.length}</div>
          <div style={styles.summaryLabel}>Active Effects</div>
        </div>
      </div>

      <div style={styles.mainContent}>
        {/* Left Panel - Controls */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>World Controls</h2>

          {/* Tick Processing */}
          <div style={styles.controlSection}>
            <div style={styles.controlTitle}>Advance Time</div>
            <div style={styles.controlRow}>
              <input
                type="number"
                style={styles.input}
                value={tickDays}
                onChange={(e) => setTickDays(parseInt(e.target.value) || 1)}
                min="1"
                max="7"
              />
              <span>day(s)</span>
              <button style={styles.button} onClick={handleTick}>
                Process Tick
              </button>
            </div>
            {tickResult && (
              <div style={styles.resultBox}>
                <strong>{tickResult.message}</strong>
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  Goals processed: {tickResult.faction_results?.length || 0}<br />
                  Events spawned: {tickResult.spawned_events?.length || 0}<br />
                  Effects expired: {tickResult.effects_expired || 0}
                </div>
              </div>
            )}
          </div>

          {/* Simulation */}
          <div style={styles.controlSection}>
            <div style={styles.controlTitle}>Simulate Time Skip</div>
            <div style={styles.controlRow}>
              <input
                type="number"
                style={styles.input}
                value={simulateDays}
                onChange={(e) => setSimulateDays(parseInt(e.target.value) || 7)}
                min="1"
                max="30"
              />
              <span>days</span>
              <button style={{ ...styles.button, ...styles.buttonWarning }} onClick={handleSimulate}>
                Simulate
              </button>
            </div>
            {simulateResult && (
              <div style={{ ...styles.resultBox, ...styles.resultBoxWarning }}>
                <strong>{simulateResult.message}</strong>
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  Goals advanced: {simulateResult.summary?.goals_advanced || 0}<br />
                  Goals completed: {simulateResult.summary?.goals_completed || 0}<br />
                  Events spawned: {simulateResult.summary?.events_spawned || 0}<br />
                  Effects expired: {simulateResult.summary?.effects_expired || 0}
                </div>
              </div>
            )}
          </div>

          {/* AI Generation */}
          <div style={styles.controlSection}>
            <div style={styles.controlTitle}>AI Content Generation</div>

            <div style={styles.controlRow}>
              <select
                style={styles.select}
                value={selectedFaction}
                onChange={(e) => setSelectedFaction(e.target.value)}
              >
                <option value="">Select Faction</option>
                {factions.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <button
                style={{ ...styles.button, ...styles.buttonSuccess }}
                onClick={handleGenerateFactionGoal}
                disabled={!selectedFaction || generating}
              >
                {generating ? 'Generating...' : 'Generate Goal'}
              </button>
            </div>

            <div style={styles.controlRow}>
              <select
                style={styles.select}
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
              >
                <option value="">Any Event Type</option>
                <option value="political">Political</option>
                <option value="economic">Economic</option>
                <option value="military">Military</option>
                <option value="natural">Natural</option>
                <option value="magical">Magical</option>
                <option value="religious">Religious</option>
                <option value="social">Social</option>
                <option value="conspiracy">Conspiracy</option>
                <option value="threat">Threat</option>
              </select>
              <button
                style={{ ...styles.button, ...styles.buttonSuccess }}
                onClick={handleGenerateWorldEvent}
                disabled={generating}
              >
                {generating ? 'Generating...' : 'Generate Event'}
              </button>
            </div>

            {generationResult && (
              <div style={styles.resultBox}>
                <strong>Generated {generationResult.type}:</strong>
                <div style={{ marginTop: '8px', fontSize: '12px' }}>
                  {generationResult.type === 'faction-goal' ? (
                    <>Title: {generationResult.data.goal?.title || generationResult.data.generated?.title}</>
                  ) : (
                    <>Title: {generationResult.data.event?.title || generationResult.data.generated?.title}</>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - World View */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>
            <span>World State</span>
            <button
              style={{ ...styles.button, ...styles.buttonSecondary, padding: '4px 8px', fontSize: '12px' }}
              onClick={() => { loadWorldState(); loadCharacterView(); }}
            >
              Refresh
            </button>
          </div>

          <div style={styles.tabs}>
            {['overview', 'factions', 'events', 'effects'].map(tab => (
              <button
                key={tab}
                style={{
                  ...styles.tab,
                  ...(viewTab === tab ? styles.tabActive : {}),
                }}
                onClick={() => setViewTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={styles.noData}>Loading world state...</div>
          ) : viewTab === 'overview' ? (
            <>
              <div style={{ marginBottom: '15px' }}>
                <div style={styles.controlTitle}>Character's View</div>
                {characterView ? (
                  <div style={{ fontSize: '13px', color: '#666' }}>
                    Visible factions: {characterView.factions?.length || 0}<br />
                    Known goals: {characterView.knownGoals?.length || 0}<br />
                    Visible events: {characterView.events?.length || 0}
                  </div>
                ) : (
                  <div style={styles.noData}>No character view available</div>
                )}
              </div>

              <div style={styles.controlTitle}>Recent Activity</div>
              {activeGoals.slice(0, 3).map(goal => (
                <div key={goal.id} style={styles.logEntry}>
                  <strong>{goal.title}</strong> - {goal.progress}/{goal.progress_max} progress
                </div>
              ))}
              {events.filter(e => e.status === 'active').slice(0, 3).map(event => (
                <div key={event.id} style={{ ...styles.logEntry, ...styles.logEntryWarning }}>
                  <strong>{event.title}</strong> - Stage {event.current_stage + 1}
                </div>
              ))}
            </>
          ) : viewTab === 'factions' ? (
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {factions.length === 0 ? (
                <div style={styles.noData}>No factions found</div>
              ) : (
                factions.map(faction => (
                  <div key={faction.id} style={styles.listItem}>
                    <div style={styles.listItemHeader}>
                      <span style={styles.listItemTitle}>{faction.name}</span>
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: '#4169E1',
                          color: 'white',
                        }}
                      >
                        Power: {faction.power_level}
                      </span>
                    </div>
                    <div style={styles.listItemMeta}>
                      {faction.scope} • {(faction.goals || []).filter(g => g.status === 'active').length} active goals
                    </div>
                    {(faction.goals || []).filter(g => g.status === 'active').slice(0, 2).map(goal => (
                      <div key={goal.id} style={{ marginTop: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#666' }}>{goal.title}</span>
                        <div style={styles.progressBar}>
                          <div
                            style={{
                              ...styles.progressFill,
                              width: `${(goal.progress / goal.progress_max) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          ) : viewTab === 'events' ? (
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {events.length === 0 ? (
                <div style={styles.noData}>No events found</div>
              ) : (
                events.map(event => {
                  const stages = parseJsonField(event.stages);
                  return (
                    <div key={event.id} style={styles.listItem}>
                      <div style={styles.listItemHeader}>
                        <span style={styles.listItemTitle}>{event.title}</span>
                        <span
                          style={{
                            ...styles.badge,
                            backgroundColor: eventTypeColors[event.event_type] || '#808080',
                            color: 'white',
                          }}
                        >
                          {event.event_type}
                        </span>
                      </div>
                      <div style={styles.listItemMeta}>
                        {event.scope} • Stage {event.current_stage + 1}/{stages.length || 1} •
                        <span
                          style={{
                            marginLeft: '4px',
                            color: event.status === 'active' ? '#228B22' : '#666',
                          }}
                        >
                          {event.status}
                        </span>
                      </div>
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            backgroundColor: eventTypeColors[event.event_type] || '#4169E1',
                            width: `${((event.current_stage + 1) / (stages.length || 1)) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : viewTab === 'effects' ? (
            <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
              {activeEffects.length === 0 ? (
                <div style={styles.noData}>No active effects</div>
              ) : (
                activeEffects.map(effect => (
                  <div key={effect.id} style={styles.effectCard}>
                    <div style={styles.listItemHeader}>
                      <span style={{ fontWeight: 'bold', color: '#2C3E50' }}>
                        {effect.effect_type}
                      </span>
                      <span style={{ fontSize: '11px', color: '#666' }}>
                        {effect.target_type}: {effect.target_id}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                      {effect.description}
                    </div>
                    {effect.expires_at && (
                      <div style={{ fontSize: '11px', color: '#FFA500', marginTop: '4px' }}>
                        Expires: {new Date(effect.expires_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default LivingWorldPage;
