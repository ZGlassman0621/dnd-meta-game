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
  searchBox: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    marginBottom: '1rem',
    fontSize: '0.9rem'
  },
  locationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '450px',
    overflowY: 'auto'
  },
  locationCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  },
  locationCardSelected: {
    border: '1px solid #3498db',
    background: 'rgba(52, 152, 219, 0.1)'
  },
  locationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.25rem'
  },
  locationName: {
    fontSize: '0.95rem',
    color: '#f5f5f5',
    fontWeight: '500'
  },
  locationMeta: {
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
    city: { background: 'rgba(155, 89, 182, 0.3)', color: '#9b59b6' },
    town: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' },
    village: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    dungeon: { background: 'rgba(231, 76, 60, 0.3)', color: '#e74c3c' },
    ruins: { background: 'rgba(149, 165, 166, 0.3)', color: '#95a5a6' },
    temple: { background: 'rgba(241, 196, 15, 0.3)', color: '#f1c40f' },
    wilderness: { background: 'rgba(39, 174, 96, 0.3)', color: '#27ae60' },
    fortress: { background: 'rgba(230, 126, 34, 0.3)', color: '#e67e22' },
    cave: { background: 'rgba(52, 73, 94, 0.3)', color: '#7f8c8d' },
    default: { background: 'rgba(127, 140, 141, 0.3)', color: '#95a5a6' }
  },
  discoveryBadge: {
    unknown: { background: 'rgba(52, 73, 94, 0.3)', color: '#7f8c8d' },
    heard_of: { background: 'rgba(241, 196, 15, 0.3)', color: '#f1c40f' },
    visited: { background: 'rgba(52, 152, 219, 0.3)', color: '#3498db' },
    familiar: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    home_base: { background: 'rgba(155, 89, 182, 0.3)', color: '#9b59b6' }
  },
  dangerIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.75rem',
    color: '#888'
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
  description: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.5'
  },
  connectionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  },
  connectionItem: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '0.75rem',
    borderRadius: '6px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  connectionName: {
    color: '#3498db',
    fontWeight: '500'
  },
  connectionDetails: {
    fontSize: '0.8rem',
    color: '#888'
  },
  servicesList: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap'
  },
  serviceTag: {
    background: 'rgba(46, 204, 113, 0.2)',
    color: '#2ecc71',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.8rem'
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '1rem',
    padding: '1rem',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem'
  },
  input: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    fontSize: '0.9rem'
  },
  select: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(30, 30, 30, 0.9)',
    color: '#fff',
    fontSize: '0.9rem'
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#fff',
    fontSize: '0.9rem',
    minHeight: '80px',
    resize: 'vertical'
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
  },
  statusSelect: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '0.5rem'
  },
  statusOption: {
    padding: '0.4rem 0.8rem',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.8rem',
    transition: 'all 0.2s'
  }
};

const LOCATION_TYPES = ['city', 'town', 'village', 'dungeon', 'ruins', 'temple', 'wilderness', 'fortress', 'cave', 'other'];
const DISCOVERY_STATUSES = ['unknown', 'heard_of', 'visited', 'familiar', 'home_base'];

export default function LocationsPage({ character }) {
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [connections, setConnections] = useState([]);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailTab, setDetailTab] = useState('info');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newLocation, setNewLocation] = useState({
    name: '',
    description: '',
    location_type: 'town',
    region: '',
    danger_level: 1,
    discovery_status: 'unknown'
  });

  useEffect(() => {
    if (character?.campaign_id) {
      loadLocations();
    }
  }, [character]);

  useEffect(() => {
    if (selectedLocation?.id) {
      loadConnections(selectedLocation.id);
    }
  }, [selectedLocation?.id]);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/location/campaign/${character.campaign_id}`);
      const data = await response.json();
      setLocations(data);
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConnections = async (locationId) => {
    try {
      const response = await fetch(`/api/location/${locationId}/connections`);
      const data = await response.json();
      setConnections(data);
    } catch (error) {
      console.error('Error loading connections:', error);
      setConnections([]);
    }
  };

  const handleCreateLocation = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newLocation,
          campaign_id: character.campaign_id
        })
      });
      if (response.ok) {
        setShowCreateForm(false);
        setNewLocation({
          name: '',
          description: '',
          location_type: 'town',
          region: '',
          danger_level: 1,
          discovery_status: 'unknown'
        });
        loadLocations();
      }
    } catch (error) {
      console.error('Error creating location:', error);
    }
  };

  const handleDiscover = async () => {
    if (!selectedLocation) return;
    try {
      const response = await fetch(`/api/location/${selectedLocation.id}/discover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (response.ok) {
        const updated = await response.json();
        setSelectedLocation(updated);
        loadLocations();
      }
    } catch (error) {
      console.error('Error discovering location:', error);
    }
  };

  const handleUpdateDiscoveryStatus = async (status) => {
    if (!selectedLocation) return;
    try {
      const response = await fetch(`/api/location/${selectedLocation.id}/discovery-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (response.ok) {
        const updated = await response.json();
        setSelectedLocation(updated);
        loadLocations();
      }
    } catch (error) {
      console.error('Error updating discovery status:', error);
    }
  };

  const filteredLocations = locations.filter(loc => {
    // Apply discovery filter
    if (filter === 'discovered' && loc.discovery_status === 'unknown') return false;
    if (filter === 'visited' && !['visited', 'familiar', 'home_base'].includes(loc.discovery_status)) return false;

    // Apply type filter
    if (typeFilter && loc.location_type !== typeFilter) return false;

    // Apply search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return loc.name.toLowerCase().includes(q) ||
             loc.description?.toLowerCase().includes(q) ||
             loc.region?.toLowerCase().includes(q);
    }

    return true;
  });

  const getTypeIcon = (type) => {
    const icons = {
      city: '🏙️',
      town: '🏘️',
      village: '🏠',
      dungeon: '🏚️',
      ruins: '🏛️',
      temple: '⛪',
      wilderness: '🌲',
      fortress: '🏰',
      cave: '🕳️'
    };
    return icons[type] || '📍';
  };

  const getDangerColor = (level) => {
    if (level <= 2) return '#2ecc71';
    if (level <= 4) return '#f1c40f';
    if (level <= 6) return '#e67e22';
    if (level <= 8) return '#e74c3c';
    return '#9b59b6';
  };

  const parseJsonSafe = (str, defaultVal = []) => {
    if (!str) return defaultVal;
    if (typeof str === 'object') return str;
    try { return JSON.parse(str); } catch { return defaultVal; }
  };

  const getServices = (loc) => parseJsonSafe(loc?.services, []);
  const getTags = (loc) => parseJsonSafe(loc?.tags, []);

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>Loading locations...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Locations</h2>
        <p style={styles.subtitle}>
          Explore and manage locations in your campaign
        </p>
      </div>

      <div style={styles.grid}>
        {/* Left Panel - Location List */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Location List</h3>

          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchBox}
          />

          <div style={styles.filterTabs}>
            {['all', 'discovered', 'visited'].map(f => (
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              style={{
                ...styles.select,
                padding: '0.4rem',
                fontSize: '0.85rem',
                width: 'auto'
              }}
            >
              <option value="">All Types</option>
              {LOCATION_TYPES.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div style={styles.locationList}>
            {filteredLocations.length === 0 ? (
              <div style={styles.emptyState}>
                No locations found
              </div>
            ) : (
              filteredLocations.map(loc => (
                <div
                  key={loc.id}
                  style={{
                    ...styles.locationCard,
                    ...(selectedLocation?.id === loc.id ? styles.locationCardSelected : {})
                  }}
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div style={styles.locationHeader}>
                    <span style={styles.locationName}>
                      {getTypeIcon(loc.location_type)} {loc.name}
                    </span>
                    <div style={styles.dangerIndicator}>
                      <span style={{ color: getDangerColor(loc.danger_level) }}>
                        {'⚠️'.repeat(Math.min(Math.ceil(loc.danger_level / 2), 5))}
                      </span>
                    </div>
                  </div>
                  <div style={styles.locationMeta}>
                    <span style={{
                      ...styles.badge,
                      ...(styles.typeBadge[loc.location_type] || styles.typeBadge.default)
                    }}>
                      {loc.location_type}
                    </span>
                    <span style={{
                      ...styles.badge,
                      ...styles.discoveryBadge[loc.discovery_status]
                    }}>
                      {loc.discovery_status?.replace('_', ' ')}
                    </span>
                    {loc.region && (
                      <span style={{ fontSize: '0.75rem', color: '#888' }}>
                        {loc.region}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            style={{
              ...styles.button,
              ...styles.primaryButton,
              width: '100%',
              marginTop: '1rem'
            }}
          >
            {showCreateForm ? 'Cancel' : '+ New Location'}
          </button>

          {showCreateForm && (
            <form onSubmit={handleCreateLocation} style={styles.form}>
              <input
                type="text"
                placeholder="Location Name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                style={styles.input}
                required
              />
              <div style={styles.formRow}>
                <select
                  value={newLocation.location_type}
                  onChange={(e) => setNewLocation({ ...newLocation, location_type: e.target.value })}
                  style={styles.select}
                >
                  {LOCATION_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Region"
                  value={newLocation.region}
                  onChange={(e) => setNewLocation({ ...newLocation, region: e.target.value })}
                  style={styles.input}
                />
              </div>
              <div style={styles.formRow}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#888' }}>Danger Level: {newLocation.danger_level}</label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={newLocation.danger_level}
                    onChange={(e) => setNewLocation({ ...newLocation, danger_level: parseInt(e.target.value) })}
                    style={{ width: '100%' }}
                  />
                </div>
                <select
                  value={newLocation.discovery_status}
                  onChange={(e) => setNewLocation({ ...newLocation, discovery_status: e.target.value })}
                  style={styles.select}
                >
                  {DISCOVERY_STATUSES.map(s => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              </div>
              <textarea
                placeholder="Description"
                value={newLocation.description}
                onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                style={styles.textarea}
              />
              <button type="submit" style={{ ...styles.button, ...styles.successButton }}>
                Create Location
              </button>
            </form>
          )}
        </div>

        {/* Right Panel - Location Detail */}
        <div style={styles.panel}>
          {selectedLocation ? (
            <>
              <h3 style={styles.panelTitle}>
                {getTypeIcon(selectedLocation.location_type)} {selectedLocation.name}
              </h3>

              <div style={styles.tabs}>
                {['info', 'connections', 'status'].map(tab => (
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
                          {selectedLocation.location_type}
                        </div>
                      </div>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Danger</div>
                        <div style={{
                          ...styles.infoValue,
                          color: getDangerColor(selectedLocation.danger_level)
                        }}>
                          {selectedLocation.danger_level}/10
                        </div>
                      </div>
                      <div style={styles.infoItem}>
                        <div style={styles.infoLabel}>Region</div>
                        <div style={styles.infoValue}>
                          {selectedLocation.region || '-'}
                        </div>
                      </div>
                    </div>

                    {selectedLocation.description && (
                      <>
                        <div style={styles.sectionTitle}>Description</div>
                        <div style={styles.description}>
                          {selectedLocation.description}
                        </div>
                      </>
                    )}

                    {getServices(selectedLocation).length > 0 && (
                      <>
                        <div style={{ ...styles.sectionTitle, marginTop: '1rem' }}>Services</div>
                        <div style={styles.servicesList}>
                          {getServices(selectedLocation).map((service, idx) => (
                            <span key={idx} style={styles.serviceTag}>
                              {typeof service === 'string' ? service : service.name}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {getTags(selectedLocation).length > 0 && (
                      <>
                        <div style={{ ...styles.sectionTitle, marginTop: '1rem' }}>Tags</div>
                        <div style={styles.servicesList}>
                          {getTags(selectedLocation).map((tag, idx) => (
                            <span key={idx} style={{
                              ...styles.serviceTag,
                              background: 'rgba(52, 152, 219, 0.2)',
                              color: '#3498db'
                            }}>
                              {tag}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {selectedLocation.times_visited > 0 && (
                      <div style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#888' }}>
                        Visited {selectedLocation.times_visited} time(s)
                        {selectedLocation.first_visited_date && (
                          <> • First visit: {new Date(selectedLocation.first_visited_date).toLocaleDateString()}</>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}

              {detailTab === 'connections' && (
                <div style={styles.detailSection}>
                  <div style={styles.sectionTitle}>Connected Locations</div>
                  {connections.length === 0 ? (
                    <div style={styles.emptyState}>No connections to other locations</div>
                  ) : (
                    <div style={styles.connectionsList}>
                      {connections.map((conn, idx) => (
                        <div key={idx} style={styles.connectionItem}>
                          <div>
                            <div style={styles.connectionName}>
                              {getTypeIcon(conn.location_type)} {conn.name}
                            </div>
                            <div style={styles.connectionDetails}>
                              {conn.location_type} • {conn.region || 'Unknown region'}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#f5f5f5', fontSize: '0.9rem' }}>
                              {conn.travel_time_hours}h travel
                            </div>
                            <div style={styles.connectionDetails}>
                              via {conn.route_type || 'road'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'status' && (
                <div style={styles.detailSection}>
                  <div style={styles.sectionTitle}>Discovery Status</div>
                  <div style={{
                    ...styles.badge,
                    ...styles.discoveryBadge[selectedLocation.discovery_status],
                    display: 'inline-block',
                    fontSize: '0.9rem',
                    padding: '0.4rem 0.8rem',
                    marginBottom: '1rem'
                  }}>
                    {selectedLocation.discovery_status?.replace('_', ' ')}
                  </div>

                  <div style={styles.sectionTitle}>Update Status</div>
                  <div style={styles.statusSelect}>
                    {DISCOVERY_STATUSES.map(status => (
                      <button
                        key={status}
                        onClick={() => handleUpdateDiscoveryStatus(status)}
                        style={{
                          ...styles.statusOption,
                          background: selectedLocation.discovery_status === status
                            ? styles.discoveryBadge[status]?.background
                            : 'rgba(255, 255, 255, 0.1)',
                          color: selectedLocation.discovery_status === status
                            ? styles.discoveryBadge[status]?.color
                            : '#888',
                          border: selectedLocation.discovery_status === status
                            ? `1px solid ${styles.discoveryBadge[status]?.color}`
                            : '1px solid transparent'
                        }}
                      >
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                  </div>

                  {selectedLocation.current_state && (
                    <>
                      <div style={{ ...styles.sectionTitle, marginTop: '1.5rem' }}>Current State</div>
                      <div style={styles.description}>
                        <strong>{selectedLocation.current_state}</strong>
                        {selectedLocation.state_description && (
                          <p style={{ marginTop: '0.5rem' }}>{selectedLocation.state_description}</p>
                        )}
                      </div>
                    </>
                  )}

                  {selectedLocation.discovery_status === 'unknown' && (
                    <div style={{ marginTop: '1.5rem' }}>
                      <button
                        onClick={handleDiscover}
                        style={{ ...styles.button, ...styles.successButton }}
                      >
                        Mark as Discovered
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={styles.emptyState}>
              Select a location to view details
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
