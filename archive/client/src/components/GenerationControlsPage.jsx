import { useState, useEffect } from 'react';

export default function GenerationControlsPage({ character }) {
  const [activeSection, setActiveSection] = useState('quests');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [companions, setCompanions] = useState([]);
  const [factions, setFactions] = useState([]);
  const [locations, setLocations] = useState([]);

  // Quest generation options
  const [questOptions, setQuestOptions] = useState({
    type: 'side',
    theme: '',
    companionId: ''
  });

  // Location generation options
  const [locationOptions, setLocationOptions] = useState({
    type: 'single',
    locationType: 'town',
    region: '',
    dangerLevel: 3,
    theme: '',
    regionName: '',
    locationCount: 5,
    dungeonType: 'ruins'
  });

  // World generation options
  const [worldOptions, setWorldOptions] = useState({
    type: 'event',
    factionId: '',
    eventType: 'political'
  });

  useEffect(() => {
    if (character?.id) {
      fetchCompanions();
      if (character.campaign_id) {
        fetchFactions();
        fetchLocations();
      }
    }
  }, [character?.id, character?.campaign_id]);

  const fetchCompanions = async () => {
    try {
      const response = await fetch(`/api/companion/character/${character.id}`);
      const data = await response.json();
      setCompanions(data);
    } catch (err) {
      console.error('Failed to fetch companions:', err);
    }
  };

  const fetchFactions = async () => {
    try {
      const response = await fetch(`/api/faction/campaign/${character.campaign_id}`);
      const data = await response.json();
      setFactions(data);
    } catch (err) {
      console.error('Failed to fetch factions:', err);
    }
  };

  const fetchLocations = async () => {
    try {
      const response = await fetch(`/api/location/campaign/${character.campaign_id}`);
      const data = await response.json();
      setLocations(data);
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    }
  };

  const generateQuest = async () => {
    if (!character.campaign_id) {
      setError('Character must be assigned to a campaign first');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = '/api/quest/generate/';
      let body = {
        character_id: character.id,
        campaign_id: character.campaign_id
      };

      switch (questOptions.type) {
        case 'main':
          endpoint += 'main';
          if (questOptions.theme) body.theme = questOptions.theme;
          break;
        case 'side':
          endpoint += 'side';
          if (questOptions.theme) body.theme = questOptions.theme;
          break;
        case 'one-time':
          endpoint += 'one-time';
          if (questOptions.theme) body.quest_type = questOptions.theme;
          break;
        case 'companion':
          endpoint += 'companion';
          if (questOptions.companionId) body.companion_id = questOptions.companionId;
          break;
        default:
          endpoint += 'side';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        setResult({ type: 'quest', data });
      } else {
        setError(data.error || 'Failed to generate quest');
      }
    } catch (err) {
      setError('Failed to generate quest: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateLocation = async () => {
    if (!character.campaign_id) {
      setError('Character must be assigned to a campaign first');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      let endpoint = '/api/location/generate';
      let body = { campaign_id: character.campaign_id };

      switch (locationOptions.type) {
        case 'single':
          body.location_type = locationOptions.locationType;
          body.region = locationOptions.region || undefined;
          body.danger_level = locationOptions.dangerLevel;
          body.theme = locationOptions.theme || undefined;
          break;
        case 'region':
          endpoint += '/region';
          body.region_name = locationOptions.regionName;
          body.region_type = locationOptions.locationType;
          body.location_count = locationOptions.locationCount;
          body.theme = locationOptions.theme || undefined;
          break;
        case 'dungeon':
          endpoint += '/dungeon';
          body.dungeon_type = locationOptions.dungeonType;
          body.danger_level = locationOptions.dangerLevel;
          body.theme = locationOptions.theme || undefined;
          body.region = locationOptions.region || undefined;
          break;
        default:
          break;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        setResult({ type: 'location', data });
        fetchLocations(); // Refresh locations list
      } else {
        setError(data.error || 'Failed to generate location');
      }
    } catch (err) {
      setError('Failed to generate location: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateWorldContent = async () => {
    if (!character.campaign_id) {
      setError('Character must be assigned to a campaign first');
      return;
    }

    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      let endpoint, body;

      if (worldOptions.type === 'faction-goal') {
        if (!worldOptions.factionId) {
          setError('Please select a faction');
          setGenerating(false);
          return;
        }
        endpoint = `/api/living-world/generate/faction-goal/${worldOptions.factionId}`;
        body = {};
      } else {
        endpoint = `/api/living-world/generate/world-event/${character.campaign_id}`;
        body = { event_type: worldOptions.eventType };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        setResult({ type: worldOptions.type === 'faction-goal' ? 'faction-goal' : 'world-event', data });
      } else {
        setError(data.error || 'Failed to generate content');
      }
    } catch (err) {
      setError('Failed to generate: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateBackstory = async (companionId) => {
    setGenerating(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(`/api/companion/${companionId}/backstory/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: false })
      });

      const data = await response.json();
      if (response.ok) {
        setResult({ type: 'backstory', data });
      } else {
        setError(data.error || 'Failed to generate backstory');
      }
    } catch (err) {
      setError('Failed to generate backstory: ' + err.message);
    } finally {
      setGenerating(false);
    }
  };

  const styles = {
    container: {
      display: 'flex',
      height: 'calc(100vh - 120px)',
      gap: '20px',
      padding: '20px'
    },
    navPanel: {
      width: '200px',
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '15px'
    },
    mainPanel: {
      flex: 1,
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '20px',
      overflowY: 'auto'
    },
    resultPanel: {
      width: '400px',
      backgroundColor: '#2c3e50',
      borderRadius: '8px',
      padding: '20px',
      overflowY: 'auto'
    },
    sectionTitle: {
      color: '#9b59b6',
      fontSize: '18px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    navButton: {
      width: '100%',
      padding: '12px',
      backgroundColor: '#34495e',
      border: 'none',
      borderRadius: '6px',
      color: '#ecf0f1',
      cursor: 'pointer',
      marginBottom: '8px',
      textAlign: 'left',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    navButtonActive: {
      backgroundColor: '#9b59b6'
    },
    formSection: {
      backgroundColor: '#34495e',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px'
    },
    formTitle: {
      color: '#ecf0f1',
      fontSize: '16px',
      marginBottom: '15px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    formRow: {
      marginBottom: '15px'
    },
    label: {
      display: 'block',
      color: '#bdc3c7',
      fontSize: '13px',
      marginBottom: '6px'
    },
    select: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#2c3e50',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px'
    },
    input: {
      width: '100%',
      padding: '10px',
      backgroundColor: '#2c3e50',
      border: '1px solid #7f8c8d',
      borderRadius: '4px',
      color: '#ecf0f1',
      fontSize: '14px',
      boxSizing: 'border-box'
    },
    slider: {
      width: '100%'
    },
    button: {
      padding: '12px 24px',
      backgroundColor: '#9b59b6',
      border: 'none',
      borderRadius: '6px',
      color: 'white',
      cursor: 'pointer',
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    },
    buttonDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed'
    },
    error: {
      backgroundColor: '#c0392b',
      color: 'white',
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '15px'
    },
    resultTitle: {
      color: '#2ecc71',
      fontSize: '16px',
      marginBottom: '15px'
    },
    resultContent: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      color: '#ecf0f1',
      fontSize: '13px',
      lineHeight: '1.6'
    },
    resultItem: {
      marginBottom: '10px',
      paddingBottom: '10px',
      borderBottom: '1px solid #4a6278'
    },
    resultLabel: {
      color: '#9b59b6',
      fontSize: '12px',
      textTransform: 'uppercase',
      marginBottom: '4px'
    },
    emptyState: {
      textAlign: 'center',
      color: '#7f8c8d',
      padding: '40px'
    },
    companionCard: {
      backgroundColor: '#34495e',
      padding: '12px',
      borderRadius: '6px',
      marginBottom: '10px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    companionInfo: {
      color: '#ecf0f1'
    },
    companionName: {
      fontWeight: 'bold',
      marginBottom: '4px'
    },
    companionMeta: {
      fontSize: '12px',
      color: '#bdc3c7'
    },
    smallButton: {
      padding: '6px 12px',
      fontSize: '12px'
    },
    infoBox: {
      backgroundColor: '#34495e',
      padding: '15px',
      borderRadius: '6px',
      marginBottom: '20px',
      borderLeft: '4px solid #3498db'
    },
    infoText: {
      color: '#bdc3c7',
      fontSize: '13px',
      lineHeight: '1.5'
    },
    explanation: {
      backgroundColor: 'rgba(155, 89, 182, 0.1)',
      border: '1px solid rgba(155, 89, 182, 0.3)',
      borderRadius: '8px',
      padding: '12px 16px',
      marginBottom: '15px',
      color: '#bdc3c7',
      fontSize: '13px',
      lineHeight: '1.5',
    }
  };

  if (!character) {
    return <div style={styles.emptyState}>Please select a character first</div>;
  }

  return (
    <div style={styles.container}>
      {/* Navigation Panel */}
      <div style={styles.navPanel}>
        <div style={styles.sectionTitle}>
          ✨ AI Generation
        </div>
        <div style={styles.explanation}>
          Use AI to generate new content for your campaign - quests, locations, world events,
          and companion backstories.
        </div>
        <button
          style={{ ...styles.navButton, ...(activeSection === 'quests' ? styles.navButtonActive : {}) }}
          onClick={() => setActiveSection('quests')}
        >
          📜 Quests
        </button>
        <button
          style={{ ...styles.navButton, ...(activeSection === 'locations' ? styles.navButtonActive : {}) }}
          onClick={() => setActiveSection('locations')}
        >
          📍 Locations
        </button>
        <button
          style={{ ...styles.navButton, ...(activeSection === 'world' ? styles.navButtonActive : {}) }}
          onClick={() => setActiveSection('world')}
        >
          🌍 World Events
        </button>
        <button
          style={{ ...styles.navButton, ...(activeSection === 'backstories' ? styles.navButtonActive : {}) }}
          onClick={() => setActiveSection('backstories')}
        >
          📚 Backstories
        </button>
      </div>

      {/* Main Panel */}
      <div style={styles.mainPanel}>
        {!character.campaign_id && (
          <div style={styles.error}>
            Character must be assigned to a campaign before generating content.
          </div>
        )}

        {error && <div style={styles.error}>{error}</div>}

        {/* Quest Generation */}
        {activeSection === 'quests' && (
          <>
            <div style={styles.sectionTitle}>📜 Quest Generation</div>
            <div style={styles.infoBox}>
              <div style={styles.infoText}>
                Generate AI-powered quests for your campaign. Main quests are epic 5-stage storylines,
                side quests are 2-3 stage focused adventures, and one-time quests are single objectives.
              </div>
            </div>

            <div style={styles.formSection}>
              <div style={styles.formTitle}>Quest Options</div>
              <div style={styles.formRow}>
                <label style={styles.label}>Quest Type</label>
                <select
                  style={styles.select}
                  value={questOptions.type}
                  onChange={(e) => setQuestOptions({ ...questOptions, type: e.target.value })}
                >
                  <option value="main">Main Quest (5 stages, epic storyline)</option>
                  <option value="side">Side Quest (2-3 stages)</option>
                  <option value="one-time">One-Time Quest (single objective)</option>
                  <option value="companion">Companion Quest (personal story)</option>
                </select>
              </div>

              {questOptions.type === 'companion' ? (
                <div style={styles.formRow}>
                  <label style={styles.label}>Companion</label>
                  <select
                    style={styles.select}
                    value={questOptions.companionId}
                    onChange={(e) => setQuestOptions({ ...questOptions, companionId: e.target.value })}
                  >
                    <option value="">Select a companion...</option>
                    {companions.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              ) : questOptions.type === 'one-time' ? (
                <div style={styles.formRow}>
                  <label style={styles.label}>Quest Type</label>
                  <select
                    style={styles.select}
                    value={questOptions.theme}
                    onChange={(e) => setQuestOptions({ ...questOptions, theme: e.target.value })}
                  >
                    <option value="">Random</option>
                    <option value="bounty">Bounty Hunt</option>
                    <option value="rescue">Rescue Mission</option>
                    <option value="delivery">Delivery</option>
                    <option value="investigation">Investigation</option>
                    <option value="escort">Escort</option>
                    <option value="retrieval">Retrieval</option>
                  </select>
                </div>
              ) : (
                <div style={styles.formRow}>
                  <label style={styles.label}>Theme (optional)</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={questOptions.theme}
                    onChange={(e) => setQuestOptions({ ...questOptions, theme: e.target.value })}
                    placeholder="e.g., undead, political intrigue, heist..."
                  />
                </div>
              )}

              <button
                style={{ ...styles.button, ...(generating || !character.campaign_id ? styles.buttonDisabled : {}) }}
                onClick={generateQuest}
                disabled={generating || !character.campaign_id}
              >
                {generating ? '⏳ Generating...' : '✨ Generate Quest'}
              </button>
            </div>
          </>
        )}

        {/* Location Generation */}
        {activeSection === 'locations' && (
          <>
            <div style={styles.sectionTitle}>📍 Location Generation</div>
            <div style={styles.infoBox}>
              <div style={styles.infoText}>
                Generate new locations for your campaign. Create single locations, entire regions
                with multiple connected locations, or detailed dungeons with hazards and treasure.
              </div>
            </div>

            <div style={styles.formSection}>
              <div style={styles.formTitle}>Location Options</div>
              <div style={styles.formRow}>
                <label style={styles.label}>Generation Type</label>
                <select
                  style={styles.select}
                  value={locationOptions.type}
                  onChange={(e) => setLocationOptions({ ...locationOptions, type: e.target.value })}
                >
                  <option value="single">Single Location</option>
                  <option value="region">Region (multiple locations)</option>
                  <option value="dungeon">Dungeon/Adventure Site</option>
                </select>
              </div>

              {locationOptions.type === 'single' && (
                <>
                  <div style={styles.formRow}>
                    <label style={styles.label}>Location Type</label>
                    <select
                      style={styles.select}
                      value={locationOptions.locationType}
                      onChange={(e) => setLocationOptions({ ...locationOptions, locationType: e.target.value })}
                    >
                      <option value="city">City</option>
                      <option value="town">Town</option>
                      <option value="village">Village</option>
                      <option value="fortress">Fortress</option>
                      <option value="temple">Temple</option>
                      <option value="wilderness">Wilderness</option>
                      <option value="ruins">Ruins</option>
                    </select>
                  </div>
                  <div style={styles.formRow}>
                    <label style={styles.label}>Region (optional)</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={locationOptions.region}
                      onChange={(e) => setLocationOptions({ ...locationOptions, region: e.target.value })}
                      placeholder="e.g., Northern Mountains, Coastal Plains..."
                    />
                  </div>
                </>
              )}

              {locationOptions.type === 'region' && (
                <>
                  <div style={styles.formRow}>
                    <label style={styles.label}>Region Name</label>
                    <input
                      style={styles.input}
                      type="text"
                      value={locationOptions.regionName}
                      onChange={(e) => setLocationOptions({ ...locationOptions, regionName: e.target.value })}
                      placeholder="e.g., The Verdant Vale..."
                      required
                    />
                  </div>
                  <div style={styles.formRow}>
                    <label style={styles.label}>Region Type</label>
                    <select
                      style={styles.select}
                      value={locationOptions.locationType}
                      onChange={(e) => setLocationOptions({ ...locationOptions, locationType: e.target.value })}
                    >
                      <option value="forest">Forest</option>
                      <option value="mountain">Mountain</option>
                      <option value="coastal">Coastal</option>
                      <option value="desert">Desert</option>
                      <option value="swamp">Swamp</option>
                      <option value="plains">Plains</option>
                    </select>
                  </div>
                  <div style={styles.formRow}>
                    <label style={styles.label}>Number of Locations: {locationOptions.locationCount}</label>
                    <input
                      style={styles.slider}
                      type="range"
                      min="3"
                      max="10"
                      value={locationOptions.locationCount}
                      onChange={(e) => setLocationOptions({ ...locationOptions, locationCount: parseInt(e.target.value) })}
                    />
                  </div>
                </>
              )}

              {locationOptions.type === 'dungeon' && (
                <div style={styles.formRow}>
                  <label style={styles.label}>Dungeon Type</label>
                  <select
                    style={styles.select}
                    value={locationOptions.dungeonType}
                    onChange={(e) => setLocationOptions({ ...locationOptions, dungeonType: e.target.value })}
                  >
                    <option value="ruins">Ancient Ruins</option>
                    <option value="cave">Cave System</option>
                    <option value="crypt">Crypt/Tomb</option>
                    <option value="fortress">Abandoned Fortress</option>
                    <option value="mine">Mine</option>
                    <option value="temple">Defiled Temple</option>
                    <option value="tower">Wizard Tower</option>
                  </select>
                </div>
              )}

              {(locationOptions.type === 'single' || locationOptions.type === 'dungeon') && (
                <div style={styles.formRow}>
                  <label style={styles.label}>Danger Level: {locationOptions.dangerLevel}</label>
                  <input
                    style={styles.slider}
                    type="range"
                    min="1"
                    max="10"
                    value={locationOptions.dangerLevel}
                    onChange={(e) => setLocationOptions({ ...locationOptions, dangerLevel: parseInt(e.target.value) })}
                  />
                </div>
              )}

              <div style={styles.formRow}>
                <label style={styles.label}>Theme (optional)</label>
                <input
                  style={styles.input}
                  type="text"
                  value={locationOptions.theme}
                  onChange={(e) => setLocationOptions({ ...locationOptions, theme: e.target.value })}
                  placeholder="e.g., haunted, ancient elven, volcanic..."
                />
              </div>

              <button
                style={{ ...styles.button, ...(generating || !character.campaign_id ? styles.buttonDisabled : {}) }}
                onClick={generateLocation}
                disabled={generating || !character.campaign_id}
              >
                {generating ? '⏳ Generating...' : '✨ Generate Location'}
              </button>
            </div>
          </>
        )}

        {/* World Events */}
        {activeSection === 'world' && (
          <>
            <div style={styles.sectionTitle}>🌍 World Content Generation</div>
            <div style={styles.infoBox}>
              <div style={styles.infoText}>
                Generate faction goals that drive political intrigue, or world events that
                affect locations and NPCs throughout your campaign.
              </div>
            </div>

            <div style={styles.formSection}>
              <div style={styles.formTitle}>Generation Options</div>
              <div style={styles.formRow}>
                <label style={styles.label}>Content Type</label>
                <select
                  style={styles.select}
                  value={worldOptions.type}
                  onChange={(e) => setWorldOptions({ ...worldOptions, type: e.target.value })}
                >
                  <option value="event">World Event</option>
                  <option value="faction-goal">Faction Goal</option>
                </select>
              </div>

              {worldOptions.type === 'faction-goal' ? (
                <div style={styles.formRow}>
                  <label style={styles.label}>Faction</label>
                  <select
                    style={styles.select}
                    value={worldOptions.factionId}
                    onChange={(e) => setWorldOptions({ ...worldOptions, factionId: e.target.value })}
                  >
                    <option value="">Select a faction...</option>
                    {factions.map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={styles.formRow}>
                  <label style={styles.label}>Event Type</label>
                  <select
                    style={styles.select}
                    value={worldOptions.eventType}
                    onChange={(e) => setWorldOptions({ ...worldOptions, eventType: e.target.value })}
                  >
                    <option value="political">Political</option>
                    <option value="economic">Economic</option>
                    <option value="military">Military</option>
                    <option value="natural">Natural Disaster</option>
                    <option value="magical">Magical</option>
                    <option value="religious">Religious</option>
                    <option value="social">Social</option>
                    <option value="conspiracy">Conspiracy</option>
                    <option value="threat">Threat</option>
                  </select>
                </div>
              )}

              <button
                style={{ ...styles.button, ...(generating || !character.campaign_id ? styles.buttonDisabled : {}) }}
                onClick={generateWorldContent}
                disabled={generating || !character.campaign_id}
              >
                {generating ? '⏳ Generating...' : '✨ Generate Content'}
              </button>
            </div>
          </>
        )}

        {/* Backstory Generation */}
        {activeSection === 'backstories' && (
          <>
            <div style={styles.sectionTitle}>📚 Companion Backstory Generation</div>
            <div style={styles.infoBox}>
              <div style={styles.infoText}>
                Generate detailed backstories for your companions, including their origin,
                unresolved story threads, and hidden secrets that can be revealed during gameplay.
              </div>
            </div>

            {companions.length === 0 ? (
              <div style={styles.emptyState}>
                No companions yet. Recruit companions to generate backstories for them.
              </div>
            ) : (
              <div style={styles.formSection}>
                <div style={styles.formTitle}>Your Companions</div>
                {companions.map(companion => (
                  <div key={companion.id} style={styles.companionCard}>
                    <div style={styles.companionInfo}>
                      <div style={styles.companionName}>
                        {companion.avatar || '👤'} {companion.name}
                      </div>
                      <div style={styles.companionMeta}>
                        {companion.race} {companion.companion_class || companion.occupation}
                        {companion.companion_level && ` • Level ${companion.companion_level}`}
                      </div>
                    </div>
                    <button
                      style={{ ...styles.button, ...styles.smallButton, ...(generating ? styles.buttonDisabled : {}) }}
                      onClick={() => generateBackstory(companion.id)}
                      disabled={generating}
                    >
                      {generating ? '⏳' : '✨'} Generate
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Result Panel */}
      <div style={styles.resultPanel}>
        <div style={styles.sectionTitle}>📋 Generation Result</div>
        {!result ? (
          <div style={styles.emptyState}>
            <p style={{ fontSize: '48px', marginBottom: '20px' }}>✨</p>
            <p>Generated content will appear here</p>
          </div>
        ) : (
          <>
            <div style={styles.resultTitle}>
              {result.type === 'quest' && '📜 Quest Generated!'}
              {result.type === 'location' && '📍 Location Generated!'}
              {result.type === 'world-event' && '🌍 World Event Generated!'}
              {result.type === 'faction-goal' && '⚔️ Faction Goal Generated!'}
              {result.type === 'backstory' && '📚 Backstory Generated!'}
            </div>
            <div style={styles.resultContent}>
              {result.type === 'quest' && result.data.quest && (
                <>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Title</div>
                    <div>{result.data.quest.title}</div>
                  </div>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Type</div>
                    <div>{result.data.quest.quest_type}</div>
                  </div>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Premise</div>
                    <div>{result.data.quest.premise}</div>
                  </div>
                  {result.data.quest.antagonist && (
                    <div style={styles.resultItem}>
                      <div style={styles.resultLabel}>Antagonist</div>
                      <div>{typeof result.data.quest.antagonist === 'object'
                        ? result.data.quest.antagonist.name
                        : result.data.quest.antagonist}</div>
                    </div>
                  )}
                </>
              )}

              {result.type === 'location' && (
                <>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Name</div>
                    <div>{result.data.name}</div>
                  </div>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Type</div>
                    <div>{result.data.location_type}</div>
                  </div>
                  {result.data.region && (
                    <div style={styles.resultItem}>
                      <div style={styles.resultLabel}>Region</div>
                      <div>{result.data.region}</div>
                    </div>
                  )}
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Description</div>
                    <div>{result.data.description}</div>
                  </div>
                  {result.data.locations && (
                    <div style={styles.resultItem}>
                      <div style={styles.resultLabel}>Locations Created</div>
                      <div>{result.data.locations.length} locations in {result.data.region}</div>
                    </div>
                  )}
                </>
              )}

              {(result.type === 'world-event' || result.type === 'faction-goal') && result.data && (
                <>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Title</div>
                    <div>{result.data.title || result.data.goal?.title}</div>
                  </div>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Description</div>
                    <div>{result.data.description || result.data.goal?.description}</div>
                  </div>
                </>
              )}

              {result.type === 'backstory' && result.data.backstory && (
                <>
                  <div style={styles.resultItem}>
                    <div style={styles.resultLabel}>Summary</div>
                    <div>{result.data.backstory.summary || result.data.backstory.origin_description}</div>
                  </div>
                  {result.data.backstory.unresolved_threads && (
                    <div style={styles.resultItem}>
                      <div style={styles.resultLabel}>Story Threads</div>
                      <div>{result.data.backstory.unresolved_threads.length} unresolved threads</div>
                    </div>
                  )}
                  {result.data.backstory.secrets && (
                    <div style={styles.resultItem}>
                      <div style={styles.resultLabel}>Secrets</div>
                      <div>{result.data.backstory.secrets.length} hidden secrets</div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
