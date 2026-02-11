import { useState, useEffect } from 'react';

const ACCENT = '#10b981'; // Teal/green - differentiates from Campaign Plan (red) and DM Session (blue)

const TAB_STYLE = (active) => ({
  flex: 1,
  padding: '0.75rem',
  background: active ? `rgba(16, 185, 129, 0.2)` : 'transparent',
  border: 'none',
  borderBottom: active ? `2px solid ${ACCENT}` : '2px solid transparent',
  color: active ? ACCENT : '#888',
  cursor: 'pointer',
  fontSize: '0.9rem',
  fontWeight: active ? 'bold' : 'normal'
});

const CARD_STYLE = {
  padding: '1rem',
  background: 'rgba(16, 185, 129, 0.08)',
  border: '1px solid rgba(16, 185, 129, 0.25)',
  borderRadius: '8px',
  marginBottom: '0.75rem'
};

const BADGE = (color) => ({
  display: 'inline-block',
  padding: '0.15rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.75rem',
  background: `rgba(${color}, 0.15)`,
  border: `1px solid rgba(${color}, 0.3)`,
  marginRight: '0.4rem',
  marginBottom: '0.3rem'
});

const DISPOSITION_COLORS = {
  devoted: '#a78bfa',
  allied: '#60a5fa',
  friendly: '#10b981',
  neutral: '#9ca3af',
  unfriendly: '#f59e0b',
  hostile: '#ef4444',
  nemesis: '#dc2626'
};

const STANDING_COLORS = {
  exalted: '#a78bfa',
  revered: '#818cf8',
  honored: '#60a5fa',
  friendly: '#10b981',
  neutral: '#9ca3af',
  unfriendly: '#f59e0b',
  hostile: '#ef4444',
  hated: '#dc2626',
  enemy: '#991b1b'
};

const QUEST_TYPE_LABELS = {
  main: { label: 'Main Quest', color: '245, 158, 11' },
  side: { label: 'Side Quest', color: '96, 165, 250' },
  companion: { label: 'Companion', color: '168, 85, 247' },
  one_time: { label: 'One-Time', color: '156, 163, 175' }
};

const PRIORITY_ICONS = {
  critical: '!!',
  high: '!',
  normal: '',
  low: ''
};

export default function PlayerJournalPage({ character, onBack }) {
  const [tab, setTab] = useState('npcs');
  const [journal, setJournal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJournal();
  }, [character.id]);

  const fetchJournal = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/character/${character.id}/journal`);
      if (!response.ok) throw new Error('Failed to load journal');
      const data = await response.json();
      setJournal(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>Player Journal</h2>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', opacity: 0.7 }}>Loading journal...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dm-session-container">
        <div className="dm-session-header">
          <button className="back-btn" onClick={onBack}>&larr; Back</button>
          <h2>Player Journal</h2>
        </div>
        <div style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>{error}</div>
      </div>
    );
  }

  const npcCount = journal?.npcs?.met?.length || 0;
  const locationCount = (journal?.locations?.visited?.length || 0) + (journal?.locations?.rumored?.length || 0);
  const factionCount = journal?.factions?.length || 0;
  const questCount = (journal?.quests?.active?.length || 0) + (journal?.quests?.completed?.length || 0);
  const eventCount = journal?.events?.length || 0;

  return (
    <div className="dm-session-container">
      <div className="dm-session-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2 style={{ color: ACCENT }}>Player Journal</h2>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        marginBottom: '1rem'
      }}>
        <button onClick={() => setTab('npcs')} style={TAB_STYLE(tab === 'npcs')}>
          NPCs {npcCount > 0 && <span style={{ opacity: 0.6 }}>({npcCount})</span>}
        </button>
        <button onClick={() => setTab('locations')} style={TAB_STYLE(tab === 'locations')}>
          Places {locationCount > 0 && <span style={{ opacity: 0.6 }}>({locationCount})</span>}
        </button>
        <button onClick={() => setTab('factions')} style={TAB_STYLE(tab === 'factions')}>
          Factions {factionCount > 0 && <span style={{ opacity: 0.6 }}>({factionCount})</span>}
        </button>
        <button onClick={() => setTab('quests')} style={TAB_STYLE(tab === 'quests')}>
          Quests {questCount > 0 && <span style={{ opacity: 0.6 }}>({questCount})</span>}
        </button>
        {eventCount > 0 && (
          <button onClick={() => setTab('events')} style={TAB_STYLE(tab === 'events')}>
            Events ({eventCount})
          </button>
        )}
      </div>

      <div style={{ padding: '0 1rem 1rem 1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

        {/* NPCs Tab */}
        {tab === 'npcs' && (
          <>
            {npcCount === 0 ? (
              <EmptyState message="You haven't met any NPCs yet. Start a DM session to explore the world." />
            ) : (
              <>
                {journal.npcs.met.map((npc, idx) => (
                  <div key={idx} style={CARD_STYLE}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      {npc.avatar ? (
                        <img src={npc.avatar} alt={npc.name} style={{
                          width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover',
                          border: `2px solid ${DISPOSITION_COLORS[npc.disposition] || '#888'}`
                        }} />
                      ) : (
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: `linear-gradient(135deg, ${DISPOSITION_COLORS[npc.disposition] || '#888'}40, ${DISPOSITION_COLORS[npc.disposition] || '#888'}20)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem', border: `2px solid ${DISPOSITION_COLORS[npc.disposition] || '#888'}`
                        }}>
                          {npc.name[0]}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{npc.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                          {[npc.race, npc.occupation, npc.location].filter(Boolean).join(' - ')}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem',
                        background: `${DISPOSITION_COLORS[npc.disposition] || '#888'}25`,
                        color: DISPOSITION_COLORS[npc.disposition] || '#888',
                        border: `1px solid ${DISPOSITION_COLORS[npc.disposition] || '#888'}50`,
                        textTransform: 'capitalize'
                      }}>
                        {npc.disposition}
                      </div>
                    </div>

                    {npc.timesMet > 1 && (
                      <div style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                        Met {npc.timesMet} times
                      </div>
                    )}

                    {npc.knownFacts.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: ACCENT, marginBottom: '0.25rem' }}>Known Facts:</div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#ccc' }}>
                          {npc.knownFacts.map((fact, i) => <li key={i}>{fact}</li>)}
                        </ul>
                      </div>
                    )}

                    {npc.discoveredSecrets.length > 0 && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Discovered Secrets:</div>
                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#fbbf24' }}>
                          {npc.discoveredSecrets.map((secret, i) => <li key={i}>{secret}</li>)}
                        </ul>
                      </div>
                    )}

                    {(npc.promises.length > 0 || npc.debts.length > 0) && (
                      <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                        {npc.promises.map((p, i) => (
                          <span key={`p${i}`} style={BADGE('168, 85, 247')}>Promise: {p}</span>
                        ))}
                        {npc.debts.map((d, i) => (
                          <span key={`d${i}`} style={BADGE('239, 68, 68')}>Debt: {d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {journal.npcs.unknownCount > 0 && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    {journal.npcs.unknownCount} more NPC{journal.npcs.unknownCount !== 1 ? 's' : ''} in the world you haven't met yet
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Locations Tab */}
        {tab === 'locations' && (
          <>
            {locationCount === 0 ? (
              <EmptyState message="No locations discovered yet. Explore the world in your DM sessions." />
            ) : (
              <>
                {/* Visited locations */}
                {journal.locations.visited.length > 0 && (
                  <>
                    <h3 style={{ color: ACCENT, fontSize: '0.95rem', marginBottom: '0.75rem' }}>Visited Locations</h3>
                    {journal.locations.visited.map((loc, idx) => (
                      <div key={idx} style={CARD_STYLE}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <span style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{loc.name}</span>
                          {loc.status === 'home_base' && (
                            <span style={{ ...BADGE('16, 185, 129'), marginRight: 0 }}>Home Base</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>
                          {[loc.type, loc.region].filter(Boolean).join(' - ')}
                          {loc.timesVisited > 1 && ` (visited ${loc.timesVisited} times)`}
                        </div>
                        {loc.description && (
                          <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4' }}>
                            {loc.description}
                          </div>
                        )}
                        {loc.services.length > 0 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {loc.services.map((s, i) => (
                              <span key={i} style={BADGE('96, 165, 250')}>{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </>
                )}

                {/* Rumored locations */}
                {journal.locations.rumored.length > 0 && (
                  <>
                    <h3 style={{ color: '#f59e0b', fontSize: '0.95rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Rumored Locations</h3>
                    {journal.locations.rumored.map((loc, idx) => (
                      <div key={idx} style={{
                        ...CARD_STYLE,
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.2)',
                        opacity: 0.85
                      }}>
                        <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{loc.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                          {[loc.type, loc.region].filter(Boolean).join(' - ')}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {journal.locations.unknownCount > 0 && (
                  <div style={{ textAlign: 'center', padding: '0.75rem', color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    {journal.locations.unknownCount} undiscovered location{journal.locations.unknownCount !== 1 ? 's' : ''} in the world
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Factions Tab */}
        {tab === 'factions' && (
          <>
            {factionCount === 0 ? (
              <EmptyState message="No faction relationships yet. Your actions in sessions will shape faction standings." />
            ) : (
              journal.factions.map((faction, idx) => (
                <div key={idx} style={CARD_STYLE}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    {faction.symbol && <span style={{ fontSize: '1.3rem' }}>{faction.symbol}</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{faction.name}</div>
                      {faction.isMember && faction.rank && (
                        <div style={{ fontSize: '0.8rem', color: ACCENT }}>Rank: {faction.rank}</div>
                      )}
                    </div>
                    <div style={{
                      padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem',
                      background: `${STANDING_COLORS[faction.standingLabel] || '#888'}25`,
                      color: STANDING_COLORS[faction.standingLabel] || '#888',
                      border: `1px solid ${STANDING_COLORS[faction.standingLabel] || '#888'}50`,
                      textTransform: 'capitalize'
                    }}>
                      {faction.standingLabel} ({faction.standing > 0 ? '+' : ''}{faction.standing})
                    </div>
                  </div>

                  {/* Standing bar */}
                  <div style={{
                    height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)',
                    marginBottom: '0.75rem', overflow: 'hidden', position: 'relative'
                  }}>
                    <div style={{
                      position: 'absolute',
                      left: '50%',
                      width: `${Math.abs(faction.standing) / 2}%`,
                      height: '100%',
                      borderRadius: '2px',
                      background: faction.standing >= 0 ? ACCENT : '#ef4444',
                      transform: faction.standing >= 0 ? 'none' : 'translateX(-100%)'
                    }} />
                  </div>

                  {faction.knownMembers.length > 0 && (
                    <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.25rem' }}>
                      Known members: {faction.knownMembers.join(', ')}
                    </div>
                  )}

                  {faction.goals.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#a78bfa', marginBottom: '0.25rem' }}>Known Goals:</div>
                      {faction.goals.map((goal, i) => (
                        <div key={i} style={{
                          padding: '0.5rem',
                          background: 'rgba(0,0,0,0.2)',
                          borderRadius: '4px',
                          marginBottom: '0.25rem',
                          fontSize: '0.85rem'
                        }}>
                          <div style={{ color: '#e0e0e0' }}>{goal.title}</div>
                          {goal.progressMax > 0 && (
                            <div style={{
                              height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)',
                              marginTop: '0.4rem', overflow: 'hidden'
                            }}>
                              <div style={{
                                width: `${(goal.progress / goal.progressMax) * 100}%`,
                                height: '100%', borderRadius: '2px', background: '#a78bfa'
                              }} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {faction.knownSecrets.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.8rem', color: '#f59e0b', marginBottom: '0.25rem' }}>Discovered Secrets:</div>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: '#fbbf24' }}>
                        {faction.knownSecrets.map((s, i) => <li key={i}>{s}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* Quests Tab */}
        {tab === 'quests' && (
          <>
            {questCount === 0 ? (
              <EmptyState message="No quests yet. Quests are assigned during DM sessions as you explore the world." />
            ) : (
              <>
                {/* Active quests */}
                {journal.quests.active.length > 0 && (
                  <>
                    <h3 style={{ color: ACCENT, fontSize: '0.95rem', marginBottom: '0.75rem' }}>Active Quests</h3>
                    {journal.quests.active.map((quest, idx) => {
                      const typeInfo = QUEST_TYPE_LABELS[quest.type] || QUEST_TYPE_LABELS.side;
                      return (
                        <div key={idx} style={CARD_STYLE}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontWeight: 'bold', color: '#f5f5f5' }}>
                              {PRIORITY_ICONS[quest.priority]}{quest.title}
                            </span>
                            <span style={BADGE(typeInfo.color)}>{typeInfo.label}</span>
                            {quest.timeSensitive && <span style={BADGE('239, 68, 68')}>Time-Sensitive</span>}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4', marginBottom: '0.5rem' }}>
                            {quest.premise}
                          </div>

                          {/* Quest stages */}
                          {quest.stages && quest.stages.length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                              {quest.stages.map((stage, i) => (
                                <div key={i} style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  padding: '0.3rem 0', fontSize: '0.85rem',
                                  opacity: i < quest.currentStage ? 0.5 : i === quest.currentStage ? 1 : 0.4
                                }}>
                                  <span style={{
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.7rem', flexShrink: 0,
                                    background: i < quest.currentStage ? ACCENT : i === quest.currentStage ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.1)',
                                    color: i < quest.currentStage ? '#000' : i === quest.currentStage ? ACCENT : '#666',
                                    border: i === quest.currentStage ? `1px solid ${ACCENT}` : 'none'
                                  }}>
                                    {i < quest.currentStage ? '✓' : i + 1}
                                  </span>
                                  <span style={{ color: i === quest.currentStage ? '#f5f5f5' : '#888' }}>
                                    {typeof stage === 'string' ? stage : stage.title || stage.description || `Stage ${i + 1}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}

                {/* Completed quests */}
                {journal.quests.completed.length > 0 && (
                  <>
                    <h3 style={{ color: '#888', fontSize: '0.95rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>Completed Quests</h3>
                    {journal.quests.completed.map((quest, idx) => (
                      <div key={idx} style={{
                        ...CARD_STYLE,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        opacity: 0.7
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ color: ACCENT }}>✓</span>
                          <span style={{ fontWeight: 'bold', color: '#ccc' }}>{quest.title}</span>
                          <span style={BADGE((QUEST_TYPE_LABELS[quest.type] || QUEST_TYPE_LABELS.side).color)}>
                            {(QUEST_TYPE_LABELS[quest.type] || QUEST_TYPE_LABELS.side).label}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#999', marginTop: '0.25rem' }}>
                          {quest.premise}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* Events Tab */}
        {tab === 'events' && (
          <>
            {eventCount === 0 ? (
              <EmptyState message="No world events discovered yet." />
            ) : (
              journal.events.map((event, idx) => (
                <div key={idx} style={CARD_STYLE}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{event.title}</span>
                    <span style={BADGE('168, 85, 247')}>{event.type}</span>
                    <span style={BADGE('96, 165, 250')}>{event.scope}</span>
                    {event.status === 'resolved' && <span style={BADGE('156, 163, 175')}>Resolved</span>}
                  </div>
                  {event.description && (
                    <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: '1.4' }}>
                      {event.description}
                    </div>
                  )}
                </div>
              ))
            )}
          </>
        )}

      </div>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: '3rem 1rem',
      color: '#888',
      fontSize: '0.9rem'
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '0.75rem', opacity: 0.5 }}>📜</div>
      <p>{message}</p>
    </div>
  );
}
