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
    paddingBottom: '0.5rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
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
    transition: 'all 0.2s',
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#888'
  },
  filterTabActive: {
    background: 'rgba(155, 89, 182, 0.3)',
    color: '#9b59b6'
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    maxHeight: '500px',
    overflowY: 'auto'
  },
  campaignCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: '1px solid transparent'
  },
  campaignCardSelected: {
    border: '1px solid #9b59b6',
    background: 'rgba(155, 89, 182, 0.1)'
  },
  campaignCardArchived: {
    opacity: 0.6
  },
  campaignName: {
    fontSize: '0.95rem',
    color: '#f5f5f5',
    fontWeight: '500',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem'
  },
  campaignMeta: {
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
  statusBadge: {
    active: { background: 'rgba(46, 204, 113, 0.3)', color: '#2ecc71' },
    archived: { background: 'rgba(149, 165, 166, 0.3)', color: '#95a5a6' }
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
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '1rem',
    marginBottom: '1rem'
  },
  infoItem: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '0.75rem',
    borderRadius: '6px'
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1rem',
    marginTop: '1rem'
  },
  statBox: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '1rem',
    borderRadius: '6px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: '600',
    color: '#9b59b6'
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#888',
    marginTop: '0.25rem'
  },
  description: {
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
    color: '#ccc',
    lineHeight: '1.5',
    fontStyle: 'italic'
  },
  characterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    marginTop: '0.75rem'
  },
  characterCard: {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '6px',
    padding: '0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  characterInfo: {
    display: 'flex',
    flexDirection: 'column'
  },
  characterName: {
    fontSize: '0.9rem',
    color: '#f5f5f5',
    fontWeight: '500'
  },
  characterMeta: {
    fontSize: '0.8rem',
    color: '#888'
  },
  assignSection: {
    marginTop: '1rem',
    padding: '1rem',
    background: 'rgba(155, 89, 182, 0.1)',
    borderRadius: '6px',
    border: '1px solid rgba(155, 89, 182, 0.2)'
  },
  actions: {
    display: 'flex',
    gap: '0.5rem',
    flexWrap: 'wrap',
    marginTop: '1rem'
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
    background: '#9b59b6',
    color: '#fff'
  },
  secondaryButton: {
    background: 'rgba(255, 255, 255, 0.1)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.2)'
  },
  successButton: {
    background: '#2ecc71',
    color: '#fff'
  },
  dangerButton: {
    background: '#e74c3c',
    color: '#fff'
  },
  emptyState: {
    textAlign: 'center',
    padding: '2rem',
    color: '#888'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1rem'
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem'
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem'
  },
  label: {
    fontSize: '0.85rem',
    color: '#888'
  },
  input: {
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#f5f5f5',
    fontSize: '0.9rem'
  },
  textarea: {
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#f5f5f5',
    fontSize: '0.9rem',
    minHeight: '80px',
    resize: 'vertical'
  },
  select: {
    padding: '0.5rem 0.75rem',
    borderRadius: '4px',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    background: 'rgba(0, 0, 0, 0.3)',
    color: '#f5f5f5',
    fontSize: '0.9rem'
  }
};

const toneOptions = ['heroic fantasy', 'dark fantasy', 'comedic', 'mysterious', 'epic', 'gritty', 'whimsical'];

const CampaignsPage = ({ character, allCharacters, onCharacterUpdated }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [selectedCharacterToAssign, setSelectedCharacterToAssign] = useState('');

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    setting: 'Forgotten Realms',
    tone: 'heroic fantasy',
    starting_location: '',
    time_ratio: 'normal'
  });

  useEffect(() => {
    loadCampaigns();
  }, []);

  useEffect(() => {
    if (selectedCampaign) {
      loadCampaignCharacters(selectedCampaign.id);
      loadCampaignStats(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/campaign');
      const data = await response.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading campaigns:', error);
      setCampaigns([]);
    }
    setLoading(false);
  };

  const loadCampaignCharacters = async (campaignId) => {
    try {
      const response = await fetch(`/api/campaign/${campaignId}/characters`);
      const data = await response.json();
      setCampaignCharacters(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error loading campaign characters:', error);
      setCampaignCharacters([]);
    }
  };

  const loadCampaignStats = async (campaignId) => {
    try {
      const response = await fetch(`/api/campaign/${campaignId}/stats`);
      const data = await response.json();
      setCampaignStats(data);
    } catch (error) {
      console.error('Error loading campaign stats:', error);
      setCampaignStats(null);
    }
  };

  const filteredCampaigns = campaigns.filter(campaign => {
    if (filter === 'active') return campaign.status === 'active';
    if (filter === 'archived') return campaign.status === 'archived';
    return true;
  });

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCampaign)
      });
      if (response.ok) {
        const campaign = await response.json();
        setCampaigns([campaign, ...campaigns]);
        setShowNewCampaign(false);
        setNewCampaign({
          name: '',
          description: '',
          setting: 'Forgotten Realms',
          tone: 'heroic fantasy',
          starting_location: '',
          time_ratio: 'normal'
        });
        setSelectedCampaign(campaign);
      }
    } catch (error) {
      console.error('Error creating campaign:', error);
    }
  };

  const handleArchiveCampaign = async () => {
    if (!selectedCampaign) return;
    try {
      const response = await fetch(`/api/campaign/${selectedCampaign.id}/archive`, {
        method: 'POST'
      });
      if (response.ok) {
        const updated = await response.json();
        setCampaigns(campaigns.map(c => c.id === updated.id ? updated : c));
        setSelectedCampaign(updated);
      }
    } catch (error) {
      console.error('Error archiving campaign:', error);
    }
  };

  const handleAssignCharacter = async () => {
    if (!selectedCampaign || !selectedCharacterToAssign) return;
    try {
      const response = await fetch(`/api/campaign/${selectedCampaign.id}/assign-character`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character_id: selectedCharacterToAssign })
      });
      if (response.ok) {
        loadCampaignCharacters(selectedCampaign.id);
        loadCampaignStats(selectedCampaign.id);
        setSelectedCharacterToAssign('');
        onCharacterUpdated?.();
      }
    } catch (error) {
      console.error('Error assigning character:', error);
    }
  };

  const handleRemoveCharacter = async (characterId) => {
    try {
      const response = await fetch(`/api/character/${characterId}/campaign`, {
        method: 'DELETE'
      });
      if (response.ok) {
        loadCampaignCharacters(selectedCampaign.id);
        loadCampaignStats(selectedCampaign.id);
        onCharacterUpdated?.();
      }
    } catch (error) {
      console.error('Error removing character:', error);
    }
  };

  const unassignedCharacters = allCharacters?.filter(
    c => !c.campaign_id || c.campaign_id !== selectedCampaign?.id
  ) || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Campaigns</h2>
        <p style={styles.subtitle}>
          Organize your adventures into campaigns with their own world settings and timelines
        </p>
      </div>

      <div style={styles.grid}>
        {/* Left Panel - Campaign List */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>
            <span>Campaigns</span>
            <button
              style={{ ...styles.button, ...styles.primaryButton }}
              onClick={() => setShowNewCampaign(!showNewCampaign)}
            >
              {showNewCampaign ? 'Cancel' : '+ New'}
            </button>
          </div>

          <div style={styles.filterTabs}>
            {['active', 'archived', 'all'].map(f => (
              <button
                key={f}
                style={{
                  ...styles.filterTab,
                  ...(filter === f ? styles.filterTabActive : {})
                }}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {showNewCampaign && (
            <form style={styles.form} onSubmit={handleCreateCampaign}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Campaign Name *</label>
                <input
                  style={styles.input}
                  type="text"
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  required
                  placeholder="The Dragon's Hoard"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={styles.textarea}
                  value={newCampaign.description}
                  onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  placeholder="An epic adventure in a world of magic and mystery..."
                />
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Setting</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={newCampaign.setting}
                    onChange={e => setNewCampaign({ ...newCampaign, setting: e.target.value })}
                    placeholder="Forgotten Realms"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Tone</label>
                  <select
                    style={styles.select}
                    value={newCampaign.tone}
                    onChange={e => setNewCampaign({ ...newCampaign, tone: e.target.value })}
                  >
                    {toneOptions.map(tone => (
                      <option key={tone} value={tone}>
                        {tone.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Starting Location</label>
                  <input
                    style={styles.input}
                    type="text"
                    value={newCampaign.starting_location}
                    onChange={e => setNewCampaign({ ...newCampaign, starting_location: e.target.value })}
                    placeholder="Waterdeep"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Time Ratio</label>
                  <select
                    style={styles.select}
                    value={newCampaign.time_ratio}
                    onChange={e => setNewCampaign({ ...newCampaign, time_ratio: e.target.value })}
                  >
                    <option value="realtime">Realtime (1:1)</option>
                    <option value="leisurely">Leisurely (4:1)</option>
                    <option value="normal">Normal (8:1)</option>
                    <option value="fast">Fast (12:1)</option>
                    <option value="montage">Montage (24:1)</option>
                  </select>
                </div>
              </div>

              <button type="submit" style={{ ...styles.button, ...styles.successButton }}>
                Create Campaign
              </button>
            </form>
          )}

          {!showNewCampaign && (
            <div style={styles.campaignList}>
              {loading ? (
                <div style={styles.emptyState}>Loading campaigns...</div>
              ) : filteredCampaigns.length === 0 ? (
                <div style={styles.emptyState}>
                  No {filter !== 'all' ? filter : ''} campaigns found
                </div>
              ) : (
                filteredCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    style={{
                      ...styles.campaignCard,
                      ...(selectedCampaign?.id === campaign.id ? styles.campaignCardSelected : {}),
                      ...(campaign.status === 'archived' ? styles.campaignCardArchived : {})
                    }}
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <div style={styles.campaignName}>
                      {campaign.name}
                    </div>
                    <div style={styles.campaignMeta}>
                      <span style={{
                        ...styles.badge,
                        ...styles.statusBadge[campaign.status]
                      }}>
                        {campaign.status}
                      </span>
                      {campaign.setting && (
                        <span style={{ fontSize: '0.8rem', color: '#888' }}>
                          {campaign.setting}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Campaign Details */}
        <div style={styles.panel}>
          <h3 style={styles.panelTitle}>Campaign Details</h3>

          {!selectedCampaign ? (
            <div style={styles.emptyState}>Select a campaign to view details</div>
          ) : (
            <>
              <div style={styles.detailSection}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, color: '#f5f5f5', fontSize: '1.25rem' }}>
                    {selectedCampaign.name}
                  </h3>
                  <span style={{
                    ...styles.badge,
                    ...styles.statusBadge[selectedCampaign.status]
                  }}>
                    {selectedCampaign.status}
                  </span>
                </div>

                {selectedCampaign.description && (
                  <div style={styles.description}>
                    {selectedCampaign.description}
                  </div>
                )}
              </div>

              <div style={styles.infoGrid}>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Setting</div>
                  <div style={styles.infoValue}>{selectedCampaign.setting || 'Forgotten Realms'}</div>
                </div>
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Tone</div>
                  <div style={styles.infoValue}>
                    {(selectedCampaign.tone || 'heroic fantasy').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </div>
                </div>
                {selectedCampaign.starting_location && (
                  <div style={styles.infoItem}>
                    <div style={styles.infoLabel}>Starting Location</div>
                    <div style={styles.infoValue}>{selectedCampaign.starting_location}</div>
                  </div>
                )}
                <div style={styles.infoItem}>
                  <div style={styles.infoLabel}>Time Ratio</div>
                  <div style={styles.infoValue}>
                    {(selectedCampaign.time_ratio || 'normal').charAt(0).toUpperCase() + (selectedCampaign.time_ratio || 'normal').slice(1)}
                  </div>
                </div>
              </div>

              {campaignStats && (
                <div style={styles.statsGrid}>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{campaignStats.character_count || 0}</div>
                    <div style={styles.statLabel}>Characters</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{campaignStats.quest_count || 0}</div>
                    <div style={styles.statLabel}>Quests</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statValue}>{campaignStats.location_count || 0}</div>
                    <div style={styles.statLabel}>Locations</div>
                  </div>
                </div>
              )}

              {/* Characters Section */}
              <div style={{ ...styles.detailSection, marginTop: '1.5rem' }}>
                <div style={styles.sectionTitle}>
                  Characters ({campaignCharacters.length})
                </div>

                {campaignCharacters.length === 0 ? (
                  <div style={{ ...styles.emptyState, padding: '1rem' }}>
                    No characters assigned to this campaign
                  </div>
                ) : (
                  <div style={styles.characterList}>
                    {campaignCharacters.map(char => (
                      <div key={char.id} style={styles.characterCard}>
                        <div style={styles.characterInfo}>
                          <span style={styles.characterName}>{char.name}</span>
                          <span style={styles.characterMeta}>
                            Level {char.level} {char.race} {char.class?.charAt(0).toUpperCase() + char.class?.slice(1)}
                          </span>
                        </div>
                        <button
                          style={{ ...styles.button, ...styles.secondaryButton, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                          onClick={() => handleRemoveCharacter(char.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedCampaign.status === 'active' && unassignedCharacters.length > 0 && (
                  <div style={styles.assignSection}>
                    <div style={styles.sectionTitle}>Assign Character</div>
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <select
                        style={{ ...styles.select, flex: 1 }}
                        value={selectedCharacterToAssign}
                        onChange={e => setSelectedCharacterToAssign(e.target.value)}
                      >
                        <option value="">Select a character...</option>
                        {unassignedCharacters.map(char => (
                          <option key={char.id} value={char.id}>
                            {char.name} (Level {char.level} {char.class?.charAt(0).toUpperCase() + char.class?.slice(1)})
                          </option>
                        ))}
                      </select>
                      <button
                        style={{ ...styles.button, ...styles.successButton }}
                        onClick={handleAssignCharacter}
                        disabled={!selectedCharacterToAssign}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {selectedCampaign.status === 'active' && (
                <div style={styles.actions}>
                  <button
                    style={{ ...styles.button, ...styles.dangerButton }}
                    onClick={handleArchiveCampaign}
                  >
                    Archive Campaign
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignsPage;
