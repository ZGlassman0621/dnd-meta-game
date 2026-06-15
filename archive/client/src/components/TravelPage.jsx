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
  },
  filterTab: {
    padding: '0.4rem 0.8rem',
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
  journeyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '400px',
    overflowY: 'auto',
  },
  journeyCard: {
    padding: '0.75rem',
    border: '1px solid transparent',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s',
  },
  journeyCardSelected: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    borderColor: '#3498db',
  },
  journeyTitle: {
    fontWeight: '500',
    color: '#f5f5f5',
    marginBottom: '4px',
  },
  journeyMeta: {
    fontSize: '0.8rem',
    color: '#888',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  detailSection: {
    marginBottom: '1.25rem',
  },
  detailLabel: {
    fontWeight: 'bold',
    color: '#aaa',
    marginBottom: '4px',
    fontSize: '0.85rem',
  },
  detailValue: {
    color: '#f5f5f5',
    marginBottom: '8px',
  },
  encounterCard: {
    padding: '0.75rem',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    marginBottom: '0.5rem',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  encounterTitle: {
    fontWeight: '500',
    color: '#f5f5f5',
    marginBottom: '4px',
  },
  encounterMeta: {
    fontSize: '0.8rem',
    color: '#888',
  },
  button: {
    padding: '0.5rem 1rem',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    marginRight: '0.5rem',
    marginTop: '0.5rem',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontWeight: '500',
    color: '#aaa',
    fontSize: '0.85rem',
  },
  input: {
    padding: '0.5rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    fontSize: '0.9rem',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: '#f5f5f5',
  },
  select: {
    padding: '0.5rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '4px',
    fontSize: '0.9rem',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    color: '#f5f5f5',
  },
  calculator: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: '1rem',
    borderRadius: '8px',
    marginTop: '1rem',
  },
  calculatorTitle: {
    fontWeight: '500',
    color: '#f5f5f5',
    marginBottom: '0.75rem',
  },
  calculatorResult: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: '0.75rem',
    borderRadius: '4px',
    marginTop: '0.75rem',
  },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
    color: '#ccc',
  },
  noData: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
    fontStyle: 'italic',
  },
  progressBar: {
    height: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '8px',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2ecc71',
    transition: 'width 0.3s',
  },
  resourceDisplay: {
    display: 'flex',
    gap: '1.25rem',
    marginTop: '0.75rem',
  },
  resourceItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '0.9rem',
    color: '#ccc',
  },
};

const statusColors = {
  in_progress: { backgroundColor: '#4169E1', color: 'white' },
  completed: { backgroundColor: '#228B22', color: 'white' },
  aborted: { backgroundColor: '#CD5C5C', color: 'white' },
  failed: { backgroundColor: '#8B0000', color: 'white' },
};

const encounterTypeIcons = {
  combat: '⚔️',
  social: '💬',
  environmental: '🌲',
  discovery: '🔍',
  rest: '🏕️',
  merchant: '💰',
  weather: '🌧️',
  wildlife: '🐺',
};

const TravelPage = ({ campaignId, characters, locations }) => {
  const [journeys, setJourneys] = useState([]);
  const [selectedJourney, setSelectedJourney] = useState(null);
  const [journeyEncounters, setJourneyEncounters] = useState([]);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showNewJourney, setShowNewJourney] = useState(false);
  const [travelConstants, setTravelConstants] = useState(null);

  // Calculator state
  const [calcDistance, setCalcDistance] = useState('');
  const [calcMethod, setCalcMethod] = useState('walking');
  const [calcRoute, setCalcRoute] = useState('road');
  const [calcPartySize, setCalcPartySize] = useState(1);
  const [calcResult, setCalcResult] = useState(null);

  // New journey form state
  const [newJourney, setNewJourney] = useState({
    character_id: '',
    origin_location_id: '',
    destination_location_id: '',
    travel_method: 'walking',
    route_type: 'road',
    distance_miles: '',
    starting_rations: 10,
    starting_gold: 50,
    danger_level: 3,
  });

  useEffect(() => {
    loadJourneys();
    loadConstants();
  }, [campaignId]);

  useEffect(() => {
    if (selectedJourney) {
      loadEncounters(selectedJourney.id);
    }
  }, [selectedJourney]);

  const loadJourneys = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/travel/campaign/${campaignId}`);
      const data = await response.json();
      setJourneys(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading journeys:', error);
      setJourneys([]);
    }
    setLoading(false);
  };

  const loadConstants = async () => {
    try {
      const response = await fetch('/api/travel/constants');
      const data = await response.json();
      setTravelConstants(data);
    } catch (error) {
      console.error('Error loading travel constants:', error);
    }
  };

  const loadEncounters = async (journeyId) => {
    try {
      const response = await fetch(`/api/travel/${journeyId}/encounters`);
      const data = await response.json();
      setJourneyEncounters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading encounters:', error);
      setJourneyEncounters([]);
    }
  };

  const filteredJourneys = journeys.filter(journey => {
    if (filter === 'active') return journey.status === 'in_progress';
    if (filter === 'completed') return journey.status === 'completed';
    return true;
  });

  const handleStartJourney = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/travel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newJourney,
          distance_miles: parseFloat(newJourney.distance_miles),
          starting_rations: parseInt(newJourney.starting_rations),
          starting_gold: parseInt(newJourney.starting_gold),
          danger_level: parseInt(newJourney.danger_level),
        }),
      });
      if (response.ok) {
        const journey = await response.json();
        setJourneys([journey, ...journeys]);
        setShowNewJourney(false);
        setNewJourney({
          character_id: '',
          origin_location_id: '',
          destination_location_id: '',
          travel_method: 'walking',
          route_type: 'road',
          distance_miles: '',
          starting_rations: 10,
          starting_gold: 50,
          danger_level: 3,
        });
        setSelectedJourney(journey);
      }
    } catch (error) {
      console.error('Error starting journey:', error);
    }
  };

  const handleCompleteJourney = async () => {
    if (!selectedJourney) return;
    try {
      const response = await fetch(`/api/travel/${selectedJourney.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actual_hours: selectedJourney.estimated_hours,
          outcome_description: 'Journey completed successfully',
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setJourneys(journeys.map(j => j.id === updated.id ? updated : j));
        setSelectedJourney(updated);
      }
    } catch (error) {
      console.error('Error completing journey:', error);
    }
  };

  const handleAbortJourney = async () => {
    if (!selectedJourney) return;
    try {
      const response = await fetch(`/api/travel/${selectedJourney.id}/abort`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: 'Journey aborted by player',
        }),
      });
      if (response.ok) {
        const updated = await response.json();
        setJourneys(journeys.map(j => j.id === updated.id ? updated : j));
        setSelectedJourney(updated);
      }
    } catch (error) {
      console.error('Error aborting journey:', error);
    }
  };

  const handleConsumeResources = async (rations, gold) => {
    if (!selectedJourney) return;
    try {
      const response = await fetch(`/api/travel/${selectedJourney.id}/consume-resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rations, gold }),
      });
      if (response.ok) {
        const updated = await response.json();
        setJourneys(journeys.map(j => j.id === updated.id ? updated : j));
        setSelectedJourney(updated);
      }
    } catch (error) {
      console.error('Error consuming resources:', error);
    }
  };

  const handleCalculate = async () => {
    if (!calcDistance) return;
    try {
      const response = await fetch('/api/travel/calculate/time', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          distance_miles: parseFloat(calcDistance),
          travel_method: calcMethod,
          route_type: calcRoute,
          party_size: calcPartySize,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        setCalcResult(result);
      }
    } catch (error) {
      console.error('Error calculating travel:', error);
    }
  };

  const handleResolveEncounter = async (encounterId, approach, outcome) => {
    try {
      const response = await fetch(`/api/travel/encounter/${encounterId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approach, outcome }),
      });
      if (response.ok) {
        loadEncounters(selectedJourney.id);
      }
    } catch (error) {
      console.error('Error resolving encounter:', error);
    }
  };

  const handleAvoidEncounter = async (encounterId, approach) => {
    try {
      const response = await fetch(`/api/travel/encounter/${encounterId}/avoid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approach }),
      });
      if (response.ok) {
        loadEncounters(selectedJourney.id);
      }
    } catch (error) {
      console.error('Error avoiding encounter:', error);
    }
  };

  const getCharacterName = (charId) => {
    const char = characters?.find(c => c.id === charId);
    return char?.name || 'Unknown';
  };

  const getLocationName = (locId) => {
    const loc = locations?.find(l => l.id === locId);
    return loc?.name || 'Unknown';
  };

  const calculateProgress = (journey) => {
    if (!journey.estimated_hours || journey.status !== 'in_progress') return 0;
    const elapsed = journey.hours_elapsed || 0;
    return Math.min(100, (elapsed / journey.estimated_hours) * 100);
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>🗺️ Travel System</h1>
        <button
          style={styles.button}
          onClick={() => setShowNewJourney(!showNewJourney)}
        >
          {showNewJourney ? 'Cancel' : '+ Start New Journey'}
        </button>
      </div>

      <div style={styles.explanation}>
        Track your party's journeys across the world. Create travel routes between locations,
        log encounters and discoveries along the way, and see how long trips take based on
        terrain and travel method. Use this to plan expeditions and record the adventures
        that happen between destinations.
      </div>

      <div style={styles.mainContent}>
        {/* Left Panel - Journey List */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Journeys</h2>

          <div style={styles.filterTabs}>
            {['active', 'completed', 'all'].map(f => (
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

          {showNewJourney && (
            <form style={styles.form} onSubmit={handleStartJourney}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Character</label>
                <select
                  style={styles.select}
                  value={newJourney.character_id}
                  onChange={e => setNewJourney({...newJourney, character_id: e.target.value})}
                  required
                >
                  <option value="">Select Character</option>
                  {characters?.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Origin</label>
                <select
                  style={styles.select}
                  value={newJourney.origin_location_id}
                  onChange={e => setNewJourney({...newJourney, origin_location_id: e.target.value})}
                  required
                >
                  <option value="">Select Origin</option>
                  {locations?.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Destination</label>
                <select
                  style={styles.select}
                  value={newJourney.destination_location_id}
                  onChange={e => setNewJourney({...newJourney, destination_location_id: e.target.value})}
                  required
                >
                  <option value="">Select Destination</option>
                  {locations?.filter(l => l.id !== newJourney.origin_location_id).map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Distance (miles)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newJourney.distance_miles}
                    onChange={e => setNewJourney({...newJourney, distance_miles: e.target.value})}
                    required
                    min="1"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Danger Level (1-10)</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newJourney.danger_level}
                    onChange={e => setNewJourney({...newJourney, danger_level: e.target.value})}
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Travel Method</label>
                  <select
                    style={styles.select}
                    value={newJourney.travel_method}
                    onChange={e => setNewJourney({...newJourney, travel_method: e.target.value})}
                  >
                    <option value="walking">Walking</option>
                    <option value="horse">Horse</option>
                    <option value="cart">Cart</option>
                    <option value="ship">Ship</option>
                    <option value="flying">Flying</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Route Type</label>
                  <select
                    style={styles.select}
                    value={newJourney.route_type}
                    onChange={e => setNewJourney({...newJourney, route_type: e.target.value})}
                  >
                    <option value="road">Road</option>
                    <option value="trail">Trail</option>
                    <option value="wilderness">Wilderness</option>
                    <option value="mountain">Mountain</option>
                    <option value="swamp">Swamp</option>
                    <option value="sea">Sea</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Starting Rations</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newJourney.starting_rations}
                    onChange={e => setNewJourney({...newJourney, starting_rations: e.target.value})}
                    min="0"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Starting Gold</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newJourney.starting_gold}
                    onChange={e => setNewJourney({...newJourney, starting_gold: e.target.value})}
                    min="0"
                  />
                </div>
              </div>

              <button type="submit" style={styles.button}>
                🚀 Begin Journey
              </button>
            </form>
          )}

          {!showNewJourney && (
            <div style={styles.journeyList}>
              {loading ? (
                <div style={styles.noData}>Loading journeys...</div>
              ) : filteredJourneys.length === 0 ? (
                <div style={styles.noData}>
                  No {filter !== 'all' ? filter : ''} journeys found
                </div>
              ) : (
                filteredJourneys.map(journey => (
                  <div
                    key={journey.id}
                    style={{
                      ...styles.journeyCard,
                      ...(selectedJourney?.id === journey.id ? styles.journeyCardSelected : {}),
                    }}
                    onClick={() => setSelectedJourney(journey)}
                  >
                    <div style={styles.journeyTitle}>
                      {getLocationName(journey.origin_location_id)} → {getLocationName(journey.destination_location_id)}
                      <span style={{ ...styles.statusBadge, ...statusColors[journey.status] }}>
                        {journey.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={styles.journeyMeta}>
                      {getCharacterName(journey.character_id)} • {journey.distance_miles || '?'} miles • {journey.travel_method}
                    </div>
                    {journey.status === 'in_progress' && (
                      <div style={styles.progressBar}>
                        <div
                          style={{
                            ...styles.progressFill,
                            width: `${calculateProgress(journey)}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* Travel Calculator */}
          <div style={styles.calculator}>
            <div style={styles.calculatorTitle}>📊 Travel Calculator</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input
                style={styles.input}
                type="number"
                placeholder="Distance (miles)"
                value={calcDistance}
                onChange={e => setCalcDistance(e.target.value)}
              />
              <input
                style={styles.input}
                type="number"
                placeholder="Party Size"
                value={calcPartySize}
                onChange={e => setCalcPartySize(parseInt(e.target.value) || 1)}
                min="1"
              />
              <select
                style={styles.select}
                value={calcMethod}
                onChange={e => setCalcMethod(e.target.value)}
              >
                <option value="walking">Walking</option>
                <option value="horse">Horse</option>
                <option value="cart">Cart</option>
                <option value="ship">Ship</option>
                <option value="flying">Flying</option>
              </select>
              <select
                style={styles.select}
                value={calcRoute}
                onChange={e => setCalcRoute(e.target.value)}
              >
                <option value="road">Road</option>
                <option value="trail">Trail</option>
                <option value="wilderness">Wilderness</option>
                <option value="mountain">Mountain</option>
                <option value="swamp">Swamp</option>
              </select>
            </div>
            <button
              style={{ ...styles.button, marginTop: '8px', width: '100%' }}
              onClick={handleCalculate}
            >
              Calculate
            </button>
            {calcResult && (
              <div style={styles.calculatorResult}>
                <div style={styles.resultRow}>
                  <span>Estimated Time:</span>
                  <strong>{calcResult.estimated_hours}h ({calcResult.estimated_days} days)</strong>
                </div>
                <div style={styles.resultRow}>
                  <span>Rations Needed:</span>
                  <strong>{calcResult.rations_needed}</strong>
                </div>
                <div style={styles.resultRow}>
                  <span>Estimated Cost:</span>
                  <strong>{calcResult.estimated_cost_gp} gp</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Journey Details */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Journey Details</h2>

          {!selectedJourney ? (
            <div style={styles.noData}>Select a journey to view details</div>
          ) : (
            <>
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Route</div>
                <div style={styles.detailValue}>
                  <strong>{getLocationName(selectedJourney.origin_location_id)}</strong>
                  {' → '}
                  <strong>{getLocationName(selectedJourney.destination_location_id)}</strong>
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Traveler</div>
                <div style={styles.detailValue}>{getCharacterName(selectedJourney.character_id)}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Distance</div>
                  <div style={styles.detailValue}>{selectedJourney.distance_miles} miles</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Travel Method</div>
                  <div style={styles.detailValue}>{selectedJourney.travel_method}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Route Type</div>
                  <div style={styles.detailValue}>{selectedJourney.route_type}</div>
                </div>
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Danger Level</div>
                  <div style={styles.detailValue}>⚠️ {selectedJourney.danger_level}/10</div>
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Progress</div>
                <div style={styles.detailValue}>
                  {selectedJourney.hours_elapsed || 0}h / {selectedJourney.estimated_hours || '?'}h estimated
                </div>
                <div style={styles.progressBar}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${calculateProgress(selectedJourney)}%`,
                    }}
                  />
                </div>
              </div>

              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Resources</div>
                <div style={styles.resourceDisplay}>
                  <div style={styles.resourceItem}>
                    🍖 Rations: {selectedJourney.current_rations ?? selectedJourney.starting_rations}
                  </div>
                  <div style={styles.resourceItem}>
                    💰 Gold: {selectedJourney.current_gold ?? selectedJourney.starting_gold} gp
                  </div>
                </div>
                {selectedJourney.status === 'in_progress' && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary, fontSize: '12px' }}
                      onClick={() => handleConsumeResources(1, 0)}
                    >
                      -1 Ration
                    </button>
                    <button
                      style={{ ...styles.button, ...styles.buttonSecondary, fontSize: '12px' }}
                      onClick={() => handleConsumeResources(0, 5)}
                    >
                      -5 Gold
                    </button>
                  </div>
                )}
              </div>

              {selectedJourney.status === 'in_progress' && (
                <div style={styles.detailSection}>
                  <button
                    style={{ ...styles.button, ...styles.buttonSuccess }}
                    onClick={handleCompleteJourney}
                  >
                    ✓ Complete Journey
                  </button>
                  <button
                    style={{ ...styles.button, ...styles.buttonDanger }}
                    onClick={handleAbortJourney}
                  >
                    ✕ Abort Journey
                  </button>
                </div>
              )}

              {selectedJourney.outcome_description && (
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Outcome</div>
                  <div style={styles.detailValue}>{selectedJourney.outcome_description}</div>
                </div>
              )}

              {/* Encounters Section */}
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>
                  Encounters ({journeyEncounters.length})
                </div>
                {journeyEncounters.length === 0 ? (
                  <div style={{ ...styles.noData, padding: '20px' }}>No encounters yet</div>
                ) : (
                  journeyEncounters.map(encounter => (
                    <div key={encounter.id} style={styles.encounterCard}>
                      <div style={styles.encounterTitle}>
                        {encounterTypeIcons[encounter.encounter_type] || '❓'} {encounter.title}
                        <span
                          style={{
                            ...styles.statusBadge,
                            backgroundColor: encounter.status === 'pending' ? '#FFA500' :
                                           encounter.status === 'resolved' ? '#228B22' : '#888',
                            color: 'white',
                          }}
                        >
                          {encounter.status}
                        </span>
                      </div>
                      {encounter.description && (
                        <div style={styles.encounterMeta}>{encounter.description}</div>
                      )}
                      {encounter.status === 'pending' && (
                        <div style={{ marginTop: '8px' }}>
                          <button
                            style={{ ...styles.button, fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => handleResolveEncounter(encounter.id, 'combat', 'victory')}
                          >
                            ⚔️ Fight
                          </button>
                          <button
                            style={{ ...styles.button, ...styles.buttonSecondary, fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => handleResolveEncounter(encounter.id, 'diplomacy', 'success')}
                          >
                            💬 Negotiate
                          </button>
                          <button
                            style={{ ...styles.button, ...styles.buttonSecondary, fontSize: '11px', padding: '4px 8px' }}
                            onClick={() => handleAvoidEncounter(encounter.id, 'stealth')}
                          >
                            🏃 Flee
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TravelPage;
