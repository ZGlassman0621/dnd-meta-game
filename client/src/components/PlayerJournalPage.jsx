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
  faction: { label: 'Faction', color: '139, 92, 246' },
  one_time: { label: 'One-Time', color: '156, 163, 175' }
};

const ACHIEVEMENT_CATEGORY_COLORS = {
  combat: '#ef4444',
  exploration: '#10b981',
  social: '#60a5fa',
  wealth: '#f59e0b',
  story: '#a78bfa',
  companion: '#ec4899',
  session: '#8b5cf6'
};

const PRIORITY_ICONS = {
  critical: '!!',
  high: '!',
  normal: '',
  low: ''
};

const CHRONICLE_CATEGORY_COLORS = {
  npc: '#f59e0b',
  location: '#10b981',
  quest: '#60a5fa',
  death: '#ef4444',
  promise: '#a78bfa',
  item: '#f97316',
  event: '#8b5cf6',
  lore: '#6366f1',
  player_choice: '#ec4899',
  secret: '#7c3aed'
};

export default function PlayerJournalPage({ character, onBack }) {
  const [tab, setTab] = useState('npcs');
  const [journal, setJournal] = useState(null);
  const [achievements, setAchievements] = useState([]);
  const [achievementFilter, setAchievementFilter] = useState('all');
  const [chronicles, setChronicles] = useState([]);
  const [timelineFacts, setTimelineFacts] = useState([]);
  const [chronicleSearch, setChronicleSearch] = useState('');
  const [chronicleCategoryFilter, setChronicleCategoryFilter] = useState('all');
  const [expandedChronicle, setExpandedChronicle] = useState(null);
  const [editingFact, setEditingFact] = useState(null);
  const [mailItems, setMailItems] = useState([]);
  const [craftingRecipes, setCraftingRecipes] = useState([]);
  const [craftingMaterials, setCraftingMaterials] = useState([]);
  const [craftingProjects, setCraftingProjects] = useState([]);
  const [craftingSubTab, setCraftingSubTab] = useState('recipes');
  const [craftingCategoryFilter, setCraftingCategoryFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchJournal();
    fetchAchievements();
    if (character.campaign_id) fetchChronicleData();
    fetchMail();
    fetchCrafting();
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

  const fetchAchievements = async () => {
    try {
      const response = await fetch(`/api/achievement/character/${character.id}/progress`);
      if (response.ok) {
        const data = await response.json();
        setAchievements(data);
      }
    } catch {
      // Achievements are non-critical, fail silently
    }
  };

  const fetchChronicleData = async () => {
    try {
      const [chroniclesRes, timelineRes] = await Promise.all([
        fetch(`/api/chronicle/campaign/${character.campaign_id}`),
        fetch(`/api/chronicle/timeline/${character.id}?campaignId=${character.campaign_id}`)
      ]);
      if (chroniclesRes.ok) setChronicles(await chroniclesRes.json());
      if (timelineRes.ok) setTimelineFacts(await timelineRes.json());
    } catch {
      // Chronicle data is non-critical
    }
  };

  const fetchMail = async () => {
    try {
      const res = await fetch(`/api/narrative-queue/character/${character.id}/mail`);
      if (res.ok) setMailItems(await res.json());
    } catch {
      // Mail is non-critical
    }
  };

  const fetchCrafting = async () => {
    try {
      const [recipesRes, materialsRes, projectsRes] = await Promise.all([
        fetch(`/api/crafting/${character.id}/recipes`),
        fetch(`/api/crafting/${character.id}/materials`),
        fetch(`/api/crafting/${character.id}/projects`)
      ]);
      if (recipesRes.ok) setCraftingRecipes(await recipesRes.json());
      if (materialsRes.ok) setCraftingMaterials(await materialsRes.json());
      if (projectsRes.ok) setCraftingProjects(await projectsRes.json());
    } catch {
      // Crafting data is non-critical
    }
  };

  const handleStartProject = async (recipeId) => {
    try {
      const res = await fetch(`/api/crafting/${character.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipeId, campaign_id: character.campaign_id, game_day: character.game_day })
      });
      if (res.ok) fetchCrafting();
      else {
        const data = await res.json();
        alert(data.error || 'Failed to start project');
      }
    } catch { /* ignore */ }
  };

  const handleCompleteProject = async (projectId) => {
    try {
      const res = await fetch(`/api/crafting/projects/${projectId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game_day: character.game_day })
      });
      if (res.ok) fetchCrafting();
      else {
        const data = await res.json();
        alert(data.error || 'Failed to complete project');
      }
    } catch { /* ignore */ }
  };

  const handleAbandonProject = async (projectId) => {
    try {
      const res = await fetch(`/api/crafting/projects/${projectId}/abandon`, { method: 'POST' });
      if (res.ok) fetchCrafting();
    } catch { /* ignore */ }
  };

  const handleSearchFacts = async (query) => {
    if (!query.trim()) {
      fetchChronicleData();
      return;
    }
    try {
      const res = await fetch(`/api/chronicle/search/${character.campaign_id}?q=${encodeURIComponent(query)}`);
      if (res.ok) setTimelineFacts(await res.json());
    } catch { /* ignore */ }
  };

  const handleEditFact = async (fact, newText) => {
    try {
      const res = await fetch(`/api/chronicle/${character.id}/fact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: character.campaign_id,
          category: fact.category,
          subject: fact.subject,
          fact: newText,
          gameDay: fact.game_day,
          importance: fact.importance,
          supersedeFactId: fact.id
        })
      });
      if (res.ok) {
        setEditingFact(null);
        fetchChronicleData();
      }
    } catch { /* ignore */ }
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
  const deceasedNpcCount = journal?.npcs?.met?.filter(n => n.lifecycleStatus === 'deceased').length || 0;
  const locationCount = (journal?.locations?.visited?.length || 0) + (journal?.locations?.rumored?.length || 0);
  const factionCount = journal?.factions?.length || 0;
  const questCount = (journal?.quests?.active?.length || 0) + (journal?.quests?.completed?.length || 0);
  const eventCount = journal?.events?.length || 0;
  const earnedCount = achievements.filter(a => a.earned_at).length;

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
          NPCs {npcCount > 0 && <span style={{ opacity: 0.6 }}>({npcCount}{deceasedNpcCount > 0 ? ` · ${deceasedNpcCount} fallen` : ''})</span>}
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
        <button onClick={() => setTab('achievements')} style={TAB_STYLE(tab === 'achievements')}>
          Achievements {earnedCount > 0 && <span style={{ opacity: 0.6 }}>({earnedCount})</span>}
        </button>
        {character.campaign_id && (
          <button onClick={() => setTab('chronicle')} style={TAB_STYLE(tab === 'chronicle')}>
            Chronicle {timelineFacts.length > 0 && <span style={{ opacity: 0.6 }}>({timelineFacts.length})</span>}
          </button>
        )}
        {mailItems.length > 0 && (
          <button onClick={() => setTab('mail')} style={TAB_STYLE(tab === 'mail')}>
            Mail <span style={{ opacity: 0.6 }}>({mailItems.length})</span>
          </button>
        )}
        <button onClick={() => setTab('crafting')} style={TAB_STYLE(tab === 'crafting')}>
          Crafting {craftingRecipes.length > 0 && <span style={{ opacity: 0.6 }}>({craftingRecipes.length})</span>}
        </button>
      </div>

      <div style={{ padding: '0 1rem 1rem 1rem', maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>

        {/* NPCs Tab */}
        {tab === 'npcs' && (
          <>
            {npcCount === 0 ? (
              <EmptyState message="You haven't met any NPCs yet. Start a DM session to explore the world." />
            ) : (
              <>
                {journal.npcs.met.map((npc, idx) => {
                  const isDeceased = npc.lifecycleStatus === 'deceased';
                  const borderColor = isDeceased ? '#dc2626' : (DISPOSITION_COLORS[npc.disposition] || '#888');
                  return (
                  <div key={idx} style={{
                    ...CARD_STYLE,
                    ...(isDeceased ? { opacity: 0.65, borderColor: 'rgba(220, 38, 38, 0.4)' } : {})
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      {npc.avatar ? (
                        <img src={npc.avatar} alt={npc.name} style={{
                          width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover',
                          border: `2px solid ${borderColor}`,
                          ...(isDeceased ? { filter: 'grayscale(100%)' } : {})
                        }} />
                      ) : (
                        <div style={{
                          width: '40px', height: '40px', borderRadius: '50%',
                          background: isDeceased
                            ? 'linear-gradient(135deg, #dc262640, #dc262620)'
                            : `linear-gradient(135deg, ${DISPOSITION_COLORS[npc.disposition] || '#888'}40, ${DISPOSITION_COLORS[npc.disposition] || '#888'}20)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '1.1rem', border: `2px solid ${borderColor}`
                        }}>
                          {npc.name[0]}
                        </div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: isDeceased ? '#888' : '#f5f5f5' }}>{npc.name}</div>
                        <div style={{ fontSize: '0.85rem', color: '#aaa' }}>
                          {[npc.race, npc.occupation, npc.location].filter(Boolean).join(' - ')}
                        </div>
                      </div>
                      <div style={{
                        padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem',
                        background: isDeceased ? '#1f293780' : `${DISPOSITION_COLORS[npc.disposition] || '#888'}25`,
                        color: isDeceased ? '#ef4444' : (DISPOSITION_COLORS[npc.disposition] || '#888'),
                        border: `1px solid ${isDeceased ? '#dc2626' : (DISPOSITION_COLORS[npc.disposition] || '#888') + '50'}`,
                        textTransform: 'capitalize'
                      }}>
                        {isDeceased ? 'Deceased' : npc.disposition}
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
                  );
                })}
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

        {/* Achievements Tab */}
        {/* Chronicle Tab */}
        {tab === 'chronicle' && (
          <>
            {timelineFacts.length === 0 && chronicles.length === 0 ? (
              <EmptyState message="No story chronicle yet. Complete a DM session to begin tracking canon facts." />
            ) : (
              <>
                {/* Search & Filter Bar */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Search facts..."
                    value={chronicleSearch}
                    onChange={(e) => {
                      setChronicleSearch(e.target.value);
                      if (e.target.value.length > 2) handleSearchFacts(e.target.value);
                      else if (e.target.value.length === 0) fetchChronicleData();
                    }}
                    style={{
                      flex: 1, minWidth: '150px', padding: '0.5rem 0.75rem',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: '6px', color: '#fff', fontSize: '0.85rem'
                    }}
                  />
                  <select
                    value={chronicleCategoryFilter}
                    onChange={(e) => setChronicleCategoryFilter(e.target.value)}
                    style={{
                      padding: '0.5rem', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px',
                      color: '#fff', fontSize: '0.85rem'
                    }}
                  >
                    <option value="all">All Categories</option>
                    {Object.keys(CHRONICLE_CATEGORY_COLORS).map(cat => (
                      <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>

                {/* Session Recaps */}
                {chronicles.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: ACCENT, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Session Recaps
                    </div>
                    {chronicles.map((c) => (
                      <div key={c.id} style={CARD_STYLE}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontWeight: 'bold', color: '#fff' }}>
                            Session {c.session_number} {c.mood && <span style={{ opacity: 0.6, fontWeight: 'normal', fontSize: '0.8rem' }}>({c.mood})</span>}
                          </div>
                          <button
                            onClick={() => setExpandedChronicle(expandedChronicle === c.id ? null : c.id)}
                            style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer', fontSize: '0.8rem' }}
                          >
                            {expandedChronicle === c.id ? 'Collapse' : 'Expand'}
                          </button>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#ccc', lineHeight: 1.5 }}>
                          {expandedChronicle === c.id ? c.summary : (c.summary?.substring(0, 200) + (c.summary?.length > 200 ? '...' : ''))}
                        </div>
                        {expandedChronicle === c.id && (
                          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem' }}>
                            {c.key_decisions?.length > 0 && (
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ color: '#f59e0b', fontWeight: 'bold', marginBottom: '0.25rem' }}>Key Decisions:</div>
                                {c.key_decisions.map((d, i) => (
                                  <div key={i} style={{ color: '#aaa', marginLeft: '0.5rem', marginBottom: '0.25rem' }}>
                                    - {d.decision} {d.consequence && <span style={{ color: '#888' }}>({d.consequence})</span>}
                                  </div>
                                ))}
                              </div>
                            )}
                            {c.combat_encounters?.length > 0 && (
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ color: '#ef4444', fontWeight: 'bold', marginBottom: '0.25rem' }}>Combat:</div>
                                {c.combat_encounters.map((e, i) => (
                                  <div key={i} style={{ color: '#aaa', marginLeft: '0.5rem' }}>
                                    - vs {e.enemies}: {e.outcome}
                                  </div>
                                ))}
                              </div>
                            )}
                            {c.cliffhanger && (
                              <div style={{ color: '#a78bfa', fontStyle: 'italic', marginTop: '0.5rem' }}>
                                Unresolved: {c.cliffhanger}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: ACCENT, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Canon Facts ({timelineFacts.filter(f => chronicleCategoryFilter === 'all' || f.category === chronicleCategoryFilter).length})
                  </div>
                  {timelineFacts
                    .filter(f => chronicleCategoryFilter === 'all' || f.category === chronicleCategoryFilter)
                    .map((fact) => {
                      const catColor = CHRONICLE_CATEGORY_COLORS[fact.category] || '#888';
                      return (
                        <div key={fact.id} style={{
                          ...CARD_STYLE,
                          borderLeft: `3px solid ${catColor}`,
                          opacity: fact.is_active ? 1 : 0.5
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                                <span style={{ ...BADGE(`${parseInt(catColor.slice(1, 3), 16)}, ${parseInt(catColor.slice(3, 5), 16)}, ${parseInt(catColor.slice(5, 7), 16)}`), fontSize: '0.7rem' }}>
                                  {fact.category.replace('_', ' ')}
                                </span>
                                {fact.importance === 'critical' && (
                                  <span style={{ ...BADGE('239, 68, 68'), color: '#ef4444', fontSize: '0.7rem' }}>CRITICAL</span>
                                )}
                                {fact.importance === 'major' && (
                                  <span style={{ ...BADGE('245, 158, 11'), color: '#f59e0b', fontSize: '0.7rem' }}>Major</span>
                                )}
                              </div>
                              {editingFact === fact.id ? (
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <input
                                    id={`edit-fact-${fact.id}`}
                                    defaultValue={fact.fact}
                                    style={{
                                      flex: 1, padding: '0.3rem 0.5rem',
                                      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.3)',
                                      borderRadius: '4px', color: '#fff', fontSize: '0.85rem'
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleEditFact(fact, e.target.value);
                                      if (e.key === 'Escape') setEditingFact(null);
                                    }}
                                  />
                                  <button
                                    onClick={() => {
                                      const input = document.getElementById(`edit-fact-${fact.id}`);
                                      handleEditFact(fact, input.value);
                                    }}
                                    style={{ background: ACCENT, border: 'none', color: '#fff', padding: '0.3rem 0.5rem', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem' }}
                                  >Save</button>
                                </div>
                              ) : (
                                <div style={{ fontSize: '0.85rem', color: '#ddd' }}>
                                  <span style={{ color: '#fff', fontWeight: 'bold' }}>{fact.subject}: </span>
                                  {fact.fact}
                                </div>
                              )}
                              <div style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.3rem' }}>
                                {fact.session_number ? `Session ${fact.session_number}` : 'Manual'}{fact.game_day ? ` | Day ${fact.game_day}` : ''}
                                {!fact.is_active && ' | Superseded'}
                              </div>
                            </div>
                            <button
                              onClick={() => setEditingFact(editingFact === fact.id ? null : fact.id)}
                              style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                              title="Edit this fact"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </>
        )}

        {tab === 'mail' && (
          <>
            {mailItems.length === 0 ? (
              <EmptyState message="No mail received yet. NPCs will send letters as your relationships develop." />
            ) : (
              <>
                {mailItems.map((item, idx) => {
                  const toneColors = { warm: '#f59e0b', formal: '#60a5fa', urgent: '#ef4444', nervous: '#a78bfa', cryptic: '#8b5cf6' };
                  const tone = item.context?.tone || 'warm';
                  const isDelivered = item.status === 'delivered';
                  return (
                    <div key={item.id || idx} style={{
                      ...CARD_STYLE,
                      borderLeft: `3px solid ${toneColors[tone] || '#888'}`,
                      opacity: isDelivered ? 0.85 : 1
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#f5f5f5', fontSize: '0.95rem' }}>
                            {item.title}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: '#888' }}>
                            From: {item.context?.npc_name || 'Unknown'} — <span style={{ color: toneColors[tone], textTransform: 'capitalize' }}>{tone}</span>
                          </div>
                        </div>
                        <span style={{
                          ...BADGE(isDelivered ? '156, 163, 175' : '16, 185, 129'),
                          fontSize: '0.7rem'
                        }}>
                          {isDelivered ? 'Read' : 'New'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#ccc', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                        {item.description}
                      </div>
                      {item.context?.gift_item && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#f59e0b' }}>
                          Gift enclosed: {item.context.gift_item}
                        </div>
                      )}
                      {item.created_at && (
                        <div style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#666' }}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </>
        )}

        {tab === 'achievements' && (
          <>
            {achievements.length === 0 ? (
              <EmptyState message="No achievements tracked yet. Play through sessions to unlock achievements!" />
            ) : (
              <>
                {/* Category filter */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  <button
                    onClick={() => setAchievementFilter('all')}
                    style={{
                      padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                      fontSize: '0.8rem',
                      background: achievementFilter === 'all' ? `${ACCENT}30` : 'rgba(255,255,255,0.06)',
                      color: achievementFilter === 'all' ? ACCENT : '#888'
                    }}
                  >All ({achievements.length})</button>
                  {['combat', 'exploration', 'social', 'wealth', 'story', 'companion', 'session'].map(cat => {
                    const count = achievements.filter(a => a.category === cat).length;
                    if (count === 0) return null;
                    const catColor = ACHIEVEMENT_CATEGORY_COLORS[cat];
                    return (
                      <button
                        key={cat}
                        onClick={() => setAchievementFilter(cat)}
                        style={{
                          padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                          fontSize: '0.8rem', textTransform: 'capitalize',
                          background: achievementFilter === cat ? `${catColor}30` : 'rgba(255,255,255,0.06)',
                          color: achievementFilter === cat ? catColor : '#888'
                        }}
                      >{cat} ({count})</button>
                    );
                  })}
                </div>

                {/* Earned achievements */}
                {(() => {
                  const filtered = achievements.filter(a => achievementFilter === 'all' || a.category === achievementFilter);
                  const earned = filtered.filter(a => a.earned_at);
                  const unearned = filtered.filter(a => !a.earned_at);

                  return (
                    <>
                      {earned.length > 0 && (
                        <>
                          <h3 style={{ color: ACCENT, fontSize: '0.95rem', marginBottom: '0.75rem' }}>
                            Earned ({earned.length})
                          </h3>
                          {earned.map((ach, idx) => (
                            <div key={idx} style={CARD_STYLE}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>{ach.icon || '\uD83C\uDFC6'}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{ach.title}</div>
                                  <div style={{ fontSize: '0.85rem', color: '#aaa' }}>{ach.description}</div>
                                </div>
                                <span style={{
                                  ...BADGE('16, 185, 129'),
                                  marginRight: 0,
                                  textTransform: 'capitalize'
                                }}>{ach.category}</span>
                              </div>
                              {ach.rewards && Object.keys(ach.rewards).length > 0 && (
                                <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#888', display: 'flex', gap: '0.75rem' }}>
                                  {ach.rewards.xp > 0 && <span>+{ach.rewards.xp} XP</span>}
                                  {ach.rewards.gold > 0 && <span>+{ach.rewards.gold} gp</span>}
                                  {ach.rewards.items?.length > 0 && <span>{ach.rewards.items.join(', ')}</span>}
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}

                      {unearned.length > 0 && (
                        <>
                          <h3 style={{ color: '#888', fontSize: '0.95rem', marginTop: earned.length > 0 ? '1.5rem' : 0, marginBottom: '0.75rem' }}>
                            Locked ({unearned.length})
                          </h3>
                          {unearned.map((ach, idx) => (
                            <div key={idx} style={{
                              ...CARD_STYLE,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              opacity: 0.6
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <span style={{ fontSize: '1.5rem', filter: 'grayscale(1)' }}>{ach.icon || '\uD83C\uDFC6'}</span>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', color: '#888' }}>{ach.title}</div>
                                  <div style={{ fontSize: '0.85rem', color: '#666' }}>{ach.description}</div>
                                </div>
                                <span style={{
                                  ...BADGE('156, 163, 175'),
                                  marginRight: 0,
                                  textTransform: 'capitalize'
                                }}>{ach.category}</span>
                              </div>
                              {ach.criteria?.type === 'counter' && ach.criteria?.threshold > 1 && (
                                <div style={{ marginTop: '0.5rem' }}>
                                  <div style={{
                                    height: '4px', borderRadius: '2px',
                                    background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
                                  }}>
                                    <div style={{
                                      width: `${Math.min(100, ((ach.progress || 0) / ach.criteria.threshold) * 100)}%`,
                                      height: '100%', borderRadius: '2px', background: ACCENT
                                    }} />
                                  </div>
                                  <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                                    {ach.progress || 0} / {ach.criteria.threshold}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </>
        )}

        {/* Crafting Tab */}
        {tab === 'crafting' && (
          <>
            {/* Sub-tab navigation */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              {['recipes', 'materials', 'projects'].map(st => (
                <button
                  key={st}
                  onClick={() => setCraftingSubTab(st)}
                  style={{
                    padding: '0.4rem 0.75rem', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontSize: '0.85rem', textTransform: 'capitalize',
                    background: craftingSubTab === st ? `${ACCENT}30` : 'rgba(255,255,255,0.06)',
                    color: craftingSubTab === st ? ACCENT : '#888'
                  }}
                >
                  {st}{st === 'materials' && craftingMaterials.length > 0 ? ` (${craftingMaterials.length})` : ''}
                  {st === 'projects' && craftingProjects.filter(p => p.status === 'in_progress').length > 0
                    ? ` (${craftingProjects.filter(p => p.status === 'in_progress').length} active)` : ''}
                </button>
              ))}
            </div>

            {/* Recipes Sub-tab */}
            {craftingSubTab === 'recipes' && (
              <>
                {craftingRecipes.length === 0 ? (
                  <EmptyState message="No recipes known yet. Default recipes will appear once the crafting system initializes." />
                ) : (
                  <>
                    {/* Category filter */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                      <button
                        onClick={() => setCraftingCategoryFilter('all')}
                        style={{
                          padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                          fontSize: '0.8rem',
                          background: craftingCategoryFilter === 'all' ? `${ACCENT}30` : 'rgba(255,255,255,0.06)',
                          color: craftingCategoryFilter === 'all' ? ACCENT : '#888'
                        }}
                      >All ({craftingRecipes.length})</button>
                      {[...new Set(craftingRecipes.map(r => r.category))].sort().map(cat => {
                        const count = craftingRecipes.filter(r => r.category === cat).length;
                        return (
                          <button
                            key={cat}
                            onClick={() => setCraftingCategoryFilter(cat)}
                            style={{
                              padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                              fontSize: '0.8rem', textTransform: 'capitalize',
                              background: craftingCategoryFilter === cat ? `${ACCENT}30` : 'rgba(255,255,255,0.06)',
                              color: craftingCategoryFilter === cat ? ACCENT : '#888'
                            }}
                          >{cat.replace('_', ' ')} ({count})</button>
                        );
                      })}
                    </div>

                    {/* Recipe cards */}
                    {craftingRecipes
                      .filter(r => craftingCategoryFilter === 'all' || r.category === craftingCategoryFilter)
                      .map(recipe => {
                        const CATEGORY_ICONS = {
                          potion: '🧪', poison: '☠️', weapon: '⚔️', armor: '🛡️', food: '🍖',
                          adventuring_gear: '🎒', scroll: '📜', ammunition: '🏹', alchemical: '⚗️', tool: '🔧', shelter: '⛺'
                        };
                        const activeProject = craftingProjects.find(p => p.recipe_id === recipe.id && p.status === 'in_progress');
                        return (
                          <div key={recipe.id} style={{
                            ...CARD_STYLE,
                            borderLeft: `3px solid ${recipe.canCraft ? ACCENT : '#666'}`
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                              <span style={{ fontSize: '1.2rem' }}>{CATEGORY_ICONS[recipe.category] || '🔨'}</span>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{recipe.name}</div>
                                <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                  {recipe.craft_time_hours}h craft time | DC {recipe.difficulty_dc} {recipe.ability_check}
                                  {recipe.gold_cost > 0 && ` | ${recipe.gold_cost} gp`}
                                </div>
                              </div>
                              {recipe.canCraft && !activeProject && (
                                <button
                                  onClick={() => handleStartProject(recipe.id)}
                                  style={{
                                    padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none', cursor: 'pointer',
                                    fontSize: '0.8rem', background: ACCENT, color: '#fff', fontWeight: 'bold'
                                  }}
                                >Craft</button>
                              )}
                              {activeProject && (
                                <span style={{ fontSize: '0.8rem', color: '#f59e0b' }}>In Progress</span>
                              )}
                            </div>

                            {recipe.description && (
                              <div style={{ fontSize: '0.85rem', color: '#aaa', marginBottom: '0.5rem' }}>{recipe.description}</div>
                            )}

                            {/* Materials list */}
                            {recipe.required_materials?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem', marginBottom: '0.3rem' }}>
                                {recipe.required_materials.map((mat, i) => {
                                  const missing = recipe.missingMaterials?.find(m => m.name === mat.name);
                                  return (
                                    <span key={i} style={{
                                      ...BADGE(missing ? '239, 68, 68' : '16, 185, 129'),
                                      color: missing ? '#ef4444' : ACCENT
                                    }}>
                                      {mat.name} x{mat.quantity}{missing ? ` (have ${missing.have})` : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            )}

                            {/* Tool requirements */}
                            {recipe.required_tools?.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                                {recipe.required_tools.map((tool, i) => {
                                  const missing = recipe.missingTools?.includes(tool);
                                  return (
                                    <span key={i} style={{
                                      ...BADGE(missing ? '245, 158, 11' : '96, 165, 250'),
                                      color: missing ? '#f59e0b' : '#60a5fa'
                                    }}>
                                      {tool}{missing ? ' (missing)' : ''}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </>
                )}
              </>
            )}

            {/* Materials Sub-tab */}
            {craftingSubTab === 'materials' && (
              <>
                {craftingMaterials.length === 0 ? (
                  <EmptyState message="No crafting materials collected yet. Find materials by foraging, looting, or buying from merchants." />
                ) : (
                  craftingMaterials.map((mat, idx) => (
                    <div key={idx} style={{
                      ...CARD_STYLE,
                      display: 'flex', alignItems: 'center', gap: '0.75rem'
                    }}>
                      <div style={{
                        width: '36px', height: '36px', borderRadius: '6px',
                        background: mat.quality === 'superior' ? 'rgba(168, 85, 247, 0.2)' :
                          mat.quality === 'fine' ? 'rgba(96, 165, 250, 0.2)' : 'rgba(255,255,255,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '1rem', flexShrink: 0,
                        border: `1px solid ${mat.quality === 'superior' ? '#a855f740' :
                          mat.quality === 'fine' ? '#60a5fa40' : 'rgba(255,255,255,0.15)'}`
                      }}>
                        {mat.quantity}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{mat.material_name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#888' }}>
                          {mat.quality !== 'standard' && <span style={{
                            color: mat.quality === 'superior' ? '#a78bfa' : '#60a5fa',
                            textTransform: 'capitalize'
                          }}>{mat.quality} </span>}
                          {mat.source && `Found: ${mat.source}`}
                          {mat.value_gp > 0 && ` | ${mat.value_gp} gp each`}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </>
            )}

            {/* Projects Sub-tab */}
            {craftingSubTab === 'projects' && (
              <>
                {craftingProjects.length === 0 ? (
                  <EmptyState message="No crafting projects started yet. Choose a recipe and start crafting!" />
                ) : (
                  <>
                    {/* Active projects */}
                    {craftingProjects.filter(p => p.status === 'in_progress').length > 0 && (
                      <>
                        <h3 style={{ color: ACCENT, fontSize: '0.95rem', marginBottom: '0.75rem' }}>Active Projects</h3>
                        {craftingProjects.filter(p => p.status === 'in_progress').map(project => {
                          const progress = Math.min(100, Math.round((project.hours_invested / project.hours_required) * 100));
                          const ready = project.hours_invested >= project.hours_required;
                          return (
                            <div key={project.id} style={CARD_STYLE}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 'bold', color: '#f5f5f5' }}>{project.recipe_name || `Project #${project.id}`}</div>
                                  <div style={{ fontSize: '0.8rem', color: '#888' }}>
                                    {project.hours_invested}/{project.hours_required} hours
                                    {project.started_game_day && ` | Started day ${project.started_game_day}`}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                  {ready && (
                                    <button
                                      onClick={() => handleCompleteProject(project.id)}
                                      style={{
                                        padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none',
                                        cursor: 'pointer', fontSize: '0.8rem', background: ACCENT,
                                        color: '#fff', fontWeight: 'bold'
                                      }}
                                    >Complete</button>
                                  )}
                                  <button
                                    onClick={() => handleAbandonProject(project.id)}
                                    style={{
                                      padding: '0.3rem 0.65rem', borderRadius: '4px', border: 'none',
                                      cursor: 'pointer', fontSize: '0.8rem',
                                      background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444'
                                    }}
                                  >Abandon</button>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div style={{
                                height: '6px', borderRadius: '3px',
                                background: 'rgba(255,255,255,0.1)', overflow: 'hidden'
                              }}>
                                <div style={{
                                  width: `${progress}%`, height: '100%', borderRadius: '3px',
                                  background: ready ? ACCENT : '#f59e0b',
                                  transition: 'width 0.3s ease'
                                }} />
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem', textAlign: 'right' }}>
                                {progress}%{ready ? ' — Ready to complete!' : ''}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Completed projects */}
                    {craftingProjects.filter(p => p.status === 'completed').length > 0 && (
                      <>
                        <h3 style={{ color: '#888', fontSize: '0.95rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                          Completed ({craftingProjects.filter(p => p.status === 'completed').length})
                        </h3>
                        {craftingProjects.filter(p => p.status === 'completed').map(project => {
                          const QUALITY_COLORS = { standard: '#9ca3af', fine: '#60a5fa', superior: '#a78bfa', masterwork: '#f59e0b' };
                          return (
                            <div key={project.id} style={{
                              ...CARD_STYLE,
                              background: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.1)',
                              opacity: 0.75
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: ACCENT }}>✓</span>
                                <span style={{ fontWeight: 'bold', color: '#ccc' }}>{project.recipe_name || `Project #${project.id}`}</span>
                                {project.quality_result && (
                                  <span style={{
                                    ...BADGE('96, 165, 250'),
                                    color: QUALITY_COLORS[project.quality_result] || '#888',
                                    textTransform: 'capitalize'
                                  }}>{project.quality_result}</span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>
                                Completed day {project.completed_game_day || '?'}
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}

                    {/* Failed/Abandoned projects */}
                    {craftingProjects.filter(p => p.status === 'failed' || p.status === 'abandoned').length > 0 && (
                      <>
                        <h3 style={{ color: '#666', fontSize: '0.95rem', marginTop: '1.5rem', marginBottom: '0.75rem' }}>
                          Failed/Abandoned
                        </h3>
                        {craftingProjects.filter(p => p.status === 'failed' || p.status === 'abandoned').map(project => (
                          <div key={project.id} style={{
                            ...CARD_STYLE,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            opacity: 0.5
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ color: '#ef4444' }}>{project.status === 'failed' ? '✗' : '—'}</span>
                              <span style={{ color: '#888' }}>{project.recipe_name || `Project #${project.id}`}</span>
                              <span style={{ ...BADGE('156, 163, 175'), textTransform: 'capitalize' }}>{project.status}</span>
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </>
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
