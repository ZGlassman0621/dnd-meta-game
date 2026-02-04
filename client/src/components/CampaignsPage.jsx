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
  },
  filterTab: {
    padding: '8px 16px',
    border: '1px solid #8B4513',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: '#FFF8DC',
    color: '#8B4513',
    fontSize: '14px',
  },
  filterTabActive: {
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxHeight: '350px',
    overflowY: 'auto',
  },
  campaignCard: {
    padding: '12px',
    border: '1px solid #DEB887',
    borderRadius: '6px',
    cursor: 'pointer',
    backgroundColor: '#FFFEF0',
    transition: 'all 0.2s',
  },
  campaignCardSelected: {
    backgroundColor: '#DEB887',
    borderColor: '#8B4513',
  },
  campaignCardArchived: {
    opacity: 0.7,
  },
  campaignName: {
    fontWeight: 'bold',
    color: '#8B4513',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  campaignMeta: {
    fontSize: '12px',
    color: '#666',
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
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
    marginTop: '10px',
  },
  statBox: {
    padding: '12px',
    backgroundColor: '#F5F5DC',
    borderRadius: '4px',
    textAlign: 'center',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#8B4513',
  },
  statLabel: {
    fontSize: '11px',
    color: '#666',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#8B4513',
    color: '#FFF8DC',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    marginRight: '8px',
    marginTop: '8px',
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
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontWeight: 'bold',
    color: '#8B4513',
    fontSize: '14px',
  },
  input: {
    padding: '8px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    fontSize: '14px',
  },
  textarea: {
    padding: '8px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    fontSize: '14px',
    minHeight: '80px',
    resize: 'vertical',
  },
  select: {
    padding: '8px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    fontSize: '14px',
    backgroundColor: 'white',
  },
  noData: {
    textAlign: 'center',
    color: '#888',
    padding: '40px',
    fontStyle: 'italic',
  },
  characterList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginTop: '10px',
  },
  characterCard: {
    padding: '10px',
    border: '1px solid #DEB887',
    borderRadius: '4px',
    backgroundColor: '#FFFEF0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  characterInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  characterName: {
    fontWeight: 'bold',
    color: '#654321',
  },
  characterMeta: {
    fontSize: '12px',
    color: '#888',
  },
  assignSection: {
    marginTop: '15px',
    padding: '10px',
    backgroundColor: '#F5F5DC',
    borderRadius: '6px',
  },
};

const toneOptions = ['heroic', 'dark', 'comedic', 'mysterious', 'epic', 'gritty', 'whimsical'];

const CampaignsPage = ({ characters, onCharacterUpdated }) => {
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
    setting: '',
    tone: 'heroic',
    starting_location: '',
    time_ratio: 1,
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
        body: JSON.stringify(newCampaign),
      });
      if (response.ok) {
        const campaign = await response.json();
        setCampaigns([campaign, ...campaigns]);
        setShowNewCampaign(false);
        setNewCampaign({
          name: '',
          description: '',
          setting: '',
          tone: 'heroic',
          starting_location: '',
          time_ratio: 1,
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
        method: 'POST',
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
        body: JSON.stringify({ character_id: selectedCharacterToAssign }),
      });
      if (response.ok) {
        loadCampaignCharacters(selectedCampaign.id);
        loadCampaignStats(selectedCampaign.id);
        setSelectedCharacterToAssign('');
        if (onCharacterUpdated) onCharacterUpdated();
      }
    } catch (error) {
      console.error('Error assigning character:', error);
    }
  };

  const handleRemoveCharacter = async (characterId) => {
    try {
      const response = await fetch(`/api/character/${characterId}/campaign`, {
        method: 'DELETE',
      });
      if (response.ok) {
        loadCampaignCharacters(selectedCampaign.id);
        loadCampaignStats(selectedCampaign.id);
        if (onCharacterUpdated) onCharacterUpdated();
      }
    } catch (error) {
      console.error('Error removing character:', error);
    }
  };

  const unassignedCharacters = characters?.filter(
    c => !c.campaign_id || c.campaign_id !== selectedCampaign?.id
  ) || [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Campaign Management</h1>
        <button
          style={styles.button}
          onClick={() => setShowNewCampaign(!showNewCampaign)}
        >
          {showNewCampaign ? 'Cancel' : '+ New Campaign'}
        </button>
      </div>

      <div style={styles.mainContent}>
        {/* Left Panel - Campaign List */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Campaigns</h2>

          <div style={styles.filterTabs}>
            {['active', 'archived', 'all'].map(f => (
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

          {showNewCampaign && (
            <form style={styles.form} onSubmit={handleCreateCampaign}>
              <div style={styles.formGroup}>
                <label style={styles.label}>Campaign Name *</label>
                <input
                  style={styles.input}
                  type="text"
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({...newCampaign, name: e.target.value})}
                  required
                  placeholder="The Dragon's Hoard"
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Description</label>
                <textarea
                  style={styles.textarea}
                  value={newCampaign.description}
                  onChange={e => setNewCampaign({...newCampaign, description: e.target.value})}
                  placeholder="An epic adventure in a world of magic and mystery..."
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Setting</label>
                <input
                  style={styles.input}
                  type="text"
                  value={newCampaign.setting}
                  onChange={e => setNewCampaign({...newCampaign, setting: e.target.value})}
                  placeholder="Forgotten Realms, Eberron, etc."
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Tone</label>
                  <select
                    style={styles.select}
                    value={newCampaign.tone}
                    onChange={e => setNewCampaign({...newCampaign, tone: e.target.value})}
                  >
                    {toneOptions.map(tone => (
                      <option key={tone} value={tone}>
                        {tone.charAt(0).toUpperCase() + tone.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Time Ratio</label>
                  <input
                    style={styles.input}
                    type="number"
                    value={newCampaign.time_ratio}
                    onChange={e => setNewCampaign({...newCampaign, time_ratio: parseInt(e.target.value) || 1})}
                    min="1"
                    max="10"
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Starting Location</label>
                <input
                  style={styles.input}
                  type="text"
                  value={newCampaign.starting_location}
                  onChange={e => setNewCampaign({...newCampaign, starting_location: e.target.value})}
                  placeholder="Neverwinter, Waterdeep, etc."
                />
              </div>

              <button type="submit" style={styles.button}>
                Create Campaign
              </button>
            </form>
          )}

          {!showNewCampaign && (
            <div style={styles.campaignList}>
              {loading ? (
                <div style={styles.noData}>Loading campaigns...</div>
              ) : filteredCampaigns.length === 0 ? (
                <div style={styles.noData}>
                  No {filter !== 'all' ? filter : ''} campaigns found
                </div>
              ) : (
                filteredCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    style={{
                      ...styles.campaignCard,
                      ...(selectedCampaign?.id === campaign.id ? styles.campaignCardSelected : {}),
                      ...(campaign.status === 'archived' ? styles.campaignCardArchived : {}),
                    }}
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <div style={styles.campaignName}>
                      {campaign.name}
                      <span
                        style={{
                          ...styles.badge,
                          backgroundColor: campaign.status === 'active' ? '#228B22' : '#808080',
                          color: 'white',
                        }}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div style={styles.campaignMeta}>
                      {campaign.setting && `${campaign.setting} • `}
                      {campaign.tone && campaign.tone.charAt(0).toUpperCase() + campaign.tone.slice(1)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Campaign Details */}
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Campaign Details</h2>

          {!selectedCampaign ? (
            <div style={styles.noData}>Select a campaign to view details</div>
          ) : (
            <>
              <div style={styles.detailSection}>
                <div style={styles.detailLabel}>Name</div>
                <div style={styles.detailValue}>
                  <strong>{selectedCampaign.name}</strong>
                  {selectedCampaign.status === 'archived' && (
                    <span style={{ ...styles.badge, backgroundColor: '#808080', color: 'white', marginLeft: '8px' }}>
                      Archived
                    </span>
                  )}
                </div>
              </div>

              {selectedCampaign.description && (
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Description</div>
                  <div style={styles.detailValue}>{selectedCampaign.description}</div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {selectedCampaign.setting && (
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Setting</div>
                    <div style={styles.detailValue}>{selectedCampaign.setting}</div>
                  </div>
                )}
                {selectedCampaign.tone && (
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Tone</div>
                    <div style={styles.detailValue}>
                      {selectedCampaign.tone.charAt(0).toUpperCase() + selectedCampaign.tone.slice(1)}
                    </div>
                  </div>
                )}
                {selectedCampaign.starting_location && (
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Starting Location</div>
                    <div style={styles.detailValue}>{selectedCampaign.starting_location}</div>
                  </div>
                )}
                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Time Ratio</div>
                  <div style={styles.detailValue}>{selectedCampaign.time_ratio || 1}x</div>
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

              {selectedCampaign.status === 'active' && (
                <button
                  style={{ ...styles.button, ...styles.buttonDanger, marginTop: '15px' }}
                  onClick={handleArchiveCampaign}
                >
                  Archive Campaign
                </button>
              )}

              {/* Characters Section */}
              <div style={{ marginTop: '20px' }}>
                <div style={styles.detailLabel}>
                  Characters ({campaignCharacters.length})
                </div>

                {campaignCharacters.length === 0 ? (
                  <div style={{ ...styles.noData, padding: '20px' }}>
                    No characters assigned to this campaign
                  </div>
                ) : (
                  <div style={styles.characterList}>
                    {campaignCharacters.map(char => (
                      <div key={char.id} style={styles.characterCard}>
                        <div style={styles.characterInfo}>
                          <span style={styles.characterName}>{char.name}</span>
                          <span style={styles.characterMeta}>
                            Level {char.level} {char.race} {char.class}
                          </span>
                        </div>
                        <button
                          style={{ ...styles.button, ...styles.buttonSecondary, margin: 0, padding: '4px 8px', fontSize: '12px' }}
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
                    <div style={styles.detailLabel}>Assign Character</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <select
                        style={{ ...styles.select, flex: 1 }}
                        value={selectedCharacterToAssign}
                        onChange={e => setSelectedCharacterToAssign(e.target.value)}
                      >
                        <option value="">Select a character...</option>
                        {unassignedCharacters.map(char => (
                          <option key={char.id} value={char.id}>
                            {char.name} (Level {char.level} {char.class})
                          </option>
                        ))}
                      </select>
                      <button
                        style={{ ...styles.button, ...styles.buttonSuccess, margin: 0 }}
                        onClick={handleAssignCharacter}
                        disabled={!selectedCharacterToAssign}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CampaignsPage;
