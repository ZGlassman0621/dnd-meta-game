import { useState, useEffect } from 'react';
import { STARTING_LOCATIONS } from '../data/forgottenRealms';

// Presentation lives in `../styles/campaigns.css`, scoped under
// `.campaigns-page`. The ~90-line inline `styles` object that used to sit
// here was the dark-shell palette hardcoded per-element; see that file for
// why the classes stay scoped and why `body` is still dark.

const toneOptions = ['heroic fantasy', 'dark fantasy', 'comedic', 'mysterious', 'epic', 'gritty', 'whimsical', 'survival'];

const PIPELINE_STEPS = [
  { key: 'creating', label: 'Creating campaign' },
  { key: 'assigning', label: 'Assigning character' },
  { key: 'parsing', label: 'Analyzing backstory' },
  { key: 'generating', label: 'Generating campaign world' },
  { key: 'done', label: 'Your world is ready!' }
];

const IMPORT_STEPS = [
  { key: 'validating', label: 'Validating JSON' },
  { key: 'importing', label: 'Importing campaign data' },
  { key: 'done', label: 'Campaign imported!' }
];

// `autoOpenCreate` — open the New Campaign form on mount instead of the
// campaign list. Used by the post-creation handoff: a character who has just
// been made has no campaign yet, so the list is empty and "+ New" is the only
// meaningful action on the screen. Skipping that click is the whole point.
const CampaignsPage = ({ character, allCharacters, onCharacterUpdated, onNavigateToPlay, autoOpenCreate = false }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(autoOpenCreate);
  const [selectedCharacterToAssign, setSelectedCharacterToAssign] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [backstoryLocation, setBackstoryLocation] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(null);
  const [pipelineError, setPipelineError] = useState(null);
  const [createdCampaign, setCreatedCampaign] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState(null);

  // Import state
  const [showImport, setShowImport] = useState(false);
  const [importJSON, setImportJSON] = useState('');
  const [importError, setImportError] = useState(null);
  const [importStep, setImportStep] = useState(null);
  const [importResult, setImportResult] = useState(null);

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    description: '',
    setting: 'Forgotten Realms',
    tone: 'heroic fantasy',
    starting_location: '',
    time_ratio: 'normal'
  });

  // Auto-select starting location from parsed backstory
  useEffect(() => {
    if (showNewCampaign && character?.parsed_backstory) {
      try {
        const parsed = typeof character.parsed_backstory === 'string'
          ? JSON.parse(character.parsed_backstory)
          : character.parsed_backstory;
        const locations = parsed?.locations || [];
        const homeLocation = locations.find(l =>
          ['hometown', 'birthplace', 'current'].includes(l.type?.toLowerCase())
        );
        if (homeLocation) {
          const match = STARTING_LOCATIONS.find(sl =>
            sl.name.toLowerCase() === homeLocation.name?.toLowerCase() ||
            homeLocation.name?.toLowerCase().includes(sl.name.toLowerCase()) ||
            sl.name.toLowerCase().includes(homeLocation.name?.toLowerCase())
          );
          if (match) {
            setNewCampaign(prev => ({ ...prev, starting_location: match.id }));
            setBackstoryLocation({ name: homeLocation.name, matched: true });
          } else {
            setNewCampaign(prev => ({ ...prev, starting_location: 'custom' }));
            setCustomLocation(homeLocation.name || '');
            setBackstoryLocation({ name: homeLocation.name, matched: false });
          }
        }
      } catch (e) {
        // ignore parse errors
      }
    } else if (showNewCampaign) {
      setBackstoryLocation(null);
    }
  }, [showNewCampaign, character]);

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

    // Resolve starting location — dropdown stores ID, but DB stores the display name
    // so campaign plan generation can use it directly in prompts
    const locId = newCampaign.starting_location;
    const locMatch = STARTING_LOCATIONS.find(l => l.id === locId);
    const resolvedCampaign = {
      ...newCampaign,
      starting_location: locId === 'custom'
        ? customLocation
        : (locMatch ? locMatch.name : locId)
    };

    setPipelineStep('creating');
    setPipelineError(null);

    try {
      // Step 1: Create campaign
      const createResponse = await fetch('/api/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolvedCampaign)
      });
      if (!createResponse.ok) throw new Error('Failed to create campaign');
      const campaign = await createResponse.json();
      setCreatedCampaign(campaign);
      setCampaigns(prev => [campaign, ...prev]);

      // Step 2: Assign character
      if (character) {
        setPipelineStep('assigning');
        const assignResponse = await fetch(`/api/campaign/${campaign.id}/assign-character`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: character.id })
        });
        if (!assignResponse.ok) throw new Error('Failed to assign character');
        onCharacterUpdated?.();
      }

      // Step 3: Parse backstory (skip if no backstory or already parsed)
      if (character?.backstory && !character?.parsed_backstory) {
        setPipelineStep('parsing');
        try {
          await fetch(`/api/character/${character.id}/parsed-backstory/parse`, {
            method: 'POST'
          });
        } catch (parseError) {
          console.warn('Backstory parsing failed, continuing:', parseError);
        }
      }

      // Step 4: Generate campaign plan
      if (character) {
        setPipelineStep('generating');
        const genResponse = await fetch(`/api/campaign/${campaign.id}/plan/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ character_id: character.id })
        });
        if (!genResponse.ok) throw new Error('Failed to generate campaign plan');
      }

      setPipelineStep('done');
      setSelectedCampaign(campaign);

    } catch (error) {
      console.error('Pipeline error:', error);
      setPipelineError(error.message);
    }
  };

  const resetPipeline = () => {
    setPipelineStep(null);
    setPipelineError(null);
    setCreatedCampaign(null);
    setShowNewCampaign(false);
    setCustomLocation('');
    setBackstoryLocation(null);
    setNewCampaign({
      name: '',
      description: '',
      setting: 'Forgotten Realms',
      tone: 'heroic fantasy',
      starting_location: '',
      time_ratio: 'normal'
    });
  };

  const handleImportCampaign = async () => {
    setImportError(null);
    setImportStep('validating');

    let parsed;
    try {
      parsed = JSON.parse(importJSON);
    } catch (e) {
      setImportError(`Invalid JSON: ${e.message}`);
      setImportStep(null);
      return;
    }

    if (!parsed.campaign) {
      setImportError('JSON must contain a "campaign" section');
      setImportStep(null);
      return;
    }

    setImportStep('importing');

    try {
      const response = await fetch('/api/campaign/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: importJSON
      });

      // Handle non-JSON responses (server errors, HTML error pages, empty bodies)
      let result;
      try {
        const text = await response.text();
        if (!text) throw new Error(`Server returned empty response (HTTP ${response.status})`);
        result = JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Server error (HTTP ${response.status}): ${parseErr.message}`);
      }

      if (!response.ok) {
        const errorMsg = result.details
          ? result.details.join('; ')
          : result.error;
        throw new Error(errorMsg);
      }

      setImportResult(result);
      setImportStep('done');
      setCampaigns(prev => [result.campaign, ...prev]);
      onCharacterUpdated?.();
    } catch (error) {
      setImportError(error.message);
      setImportStep(null);
    }
  };

  const resetImport = () => {
    setShowImport(false);
    setImportJSON('');
    setImportError(null);
    setImportStep(null);
    setImportResult(null);
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

  const handleDeleteCampaign = async () => {
    if (!confirmDelete) return;
    try {
      const response = await fetch(`/api/campaign/${confirmDelete.id}`, { method: 'DELETE' });
      if (response.ok) {
        setCampaigns(campaigns.filter(c => c.id !== confirmDelete.id));
        if (selectedCampaign?.id === confirmDelete.id) {
          setSelectedCampaign(null);
        }
        onCharacterUpdated?.();
      }
    } catch (error) {
      console.error('Error deleting campaign:', error);
    }
    setConfirmDelete(null);
  };

  const unassignedCharacters = allCharacters?.filter(
    c => !c.campaign_id || c.campaign_id !== selectedCampaign?.id
  ) || [];

  return (
    <div className="campaigns-page">
      <div className="page-head">
        <h2>Campaigns</h2>
        <p className="lede">
          Organize your adventures into campaigns with their own world settings and timelines
        </p>
      </div>

      <div className="cols">
        {/* Left Panel - Campaign List */}
        <div className="panel">
          <div className="panel-head">
            <span className="name">Campaigns</span>
            <div className="tools">
              <button
                type="button"
                className="btn primary"
                onClick={() => { setShowImport(false); resetImport(); setShowNewCampaign(!showNewCampaign); }}
              >
                {showNewCampaign ? 'Cancel' : '+ New'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => { setShowNewCampaign(false); resetPipeline(); setShowImport(!showImport); }}
              >
                {showImport ? 'Cancel' : 'Import'}
              </button>
            </div>
          </div>

          <div className="tabs">
            {['active', 'archived', 'all'].map(f => (
              <button
                key={f}
                type="button"
                className={`tab${filter === f ? ' on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {showNewCampaign && !pipelineStep && (
            <form className="form" onSubmit={handleCreateCampaign}>
              <div className="field">
                <label className="label">Campaign Name *</label>
                <input
                  className="input"
                  type="text"
                  value={newCampaign.name}
                  onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
                  required
                  placeholder="The Dragon's Hoard"
                />
              </div>

              <div className="field">
                <label className="label">Description</label>
                <textarea
                  className="textarea"
                  value={newCampaign.description}
                  onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })}
                  placeholder="An epic adventure in a world of magic and mystery..."
                />
              </div>

              <div className="field-row">
                <div className="field">
                  <label className="label">Setting</label>
                  <input
                    className="input"
                    type="text"
                    value={newCampaign.setting}
                    onChange={e => setNewCampaign({ ...newCampaign, setting: e.target.value })}
                    placeholder="Forgotten Realms"
                  />
                </div>

                <div className="field">
                  <label className="label">Tone</label>
                  <select
                    className="select"
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

              <div className="field-row">
                <div className="field">
                  <label className="label">
                    Starting Location
                    {backstoryLocation && (
                      <span className="from-backstory">(from backstory)</span>
                    )}
                  </label>
                  <select
                    className="select"
                    value={newCampaign.starting_location}
                    onChange={e => {
                      setNewCampaign({ ...newCampaign, starting_location: e.target.value });
                      if (e.target.value !== 'custom') setCustomLocation('');
                    }}
                  >
                    <option value="">Select a location...</option>
                    <optgroup label="Major Cities">
                      {STARTING_LOCATIONS.filter(l => l.type === 'city').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} — {loc.region}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Regions">
                      {STARTING_LOCATIONS.filter(l => l.type === 'region').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} — {loc.region}</option>
                      ))}
                    </optgroup>
                    <option value="custom">Custom Location...</option>
                  </select>
                  {newCampaign.starting_location === 'custom' && (
                    <input
                      className="input"
                      type="text"
                      value={customLocation}
                      onChange={e => setCustomLocation(e.target.value)}
                      placeholder="Enter custom location name"
                    />
                  )}
                </div>

                <div className="field">
                  <label className="label">Time Ratio</label>
                  <select
                    className="select"
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

              <button type="submit" className="btn primary">
                Create Campaign
              </button>
            </form>
          )}

          {pipelineStep && (
            <div className="pipeline">
              <div className="head">
                {pipelineStep === 'done' ? 'Campaign Ready!' : 'Setting up your campaign...'}
              </div>

              {PIPELINE_STEPS.map((step, i) => {
                const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === pipelineStep);
                const thisIndex = i;
                const isCompleted = thisIndex < stepIndex || pipelineStep === 'done';
                const isCurrent = step.key === pipelineStep && pipelineStep !== 'done';

                // Skip parsing step display if no backstory
                if (step.key === 'parsing' && (!character?.backstory || character?.parsed_backstory)) {
                  if (!isCurrent) return null;
                }
                // Skip assign/parse/generate if no character
                if (!character && ['assigning', 'parsing', 'generating'].includes(step.key)) return null;

                return (
                  <div
                    key={step.key}
                    className={`step${isCompleted ? ' done' : isCurrent ? ' now' : ''}`}
                  >
                    <span className="glyph">
                      {isCompleted ? '✓' : isCurrent ? '●' : '○'}
                    </span>
                    <span className="txt">{step.label}</span>
                    {isCurrent && step.key === 'generating' && (
                      <div className="track">
                        <div className="bar" />
                      </div>
                    )}
                  </div>
                );
              })}

              {pipelineError && (
                <div className="alert spaced">
                  Error: {pipelineError}
                  <button
                    type="button"
                    className="btn sm primary"
                    onClick={() => {
                      setPipelineError(null);
                      if (createdCampaign) {
                        setPipelineStep('generating');
                        fetch(`/api/campaign/${createdCampaign.id}/plan/generate`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ character_id: character?.id })
                        }).then(res => {
                          if (!res.ok) throw new Error('Retry failed');
                          setPipelineStep('done');
                          setSelectedCampaign(createdCampaign);
                        }).catch(err => setPipelineError(err.message));
                      }
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {pipelineStep === 'done' && (
                <div className="pipeline-foot">
                  <button
                    type="button"
                    className="btn primary lg"
                    onClick={() => {
                      resetPipeline();
                      onNavigateToPlay?.();
                    }}
                  >
                    Play Now
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={resetPipeline}
                  >
                    Back to Campaigns
                  </button>
                </div>
              )}
            </div>
          )}

          {showImport && !importStep && (
            <div className="form">
              <div className="field">
                <label className="label">Import Campaign JSON</label>
                <p className="help">
                  Load a JSON file or paste campaign JSON below. Must contain a "campaign" section; "character" and "campaign_plan" are optional.
                </p>
                <div className="file-row">
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.json';
                      input.onchange = (e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setImportJSON(ev.target.result);
                        reader.readAsText(file);
                      };
                      input.click();
                    }}
                  >
                    Load from File
                  </button>
                  {importJSON && (
                    <span className="loaded-note">
                      {(importJSON.length / 1024).toFixed(1)} KB loaded
                    </span>
                  )}
                </div>
                <textarea
                  className="textarea code"
                  value={importJSON}
                  onChange={e => setImportJSON(e.target.value)}
                  placeholder={'{\n  "campaign": { "name": "..." },\n  "campaign_plan": { ... },\n  "character": { "name": "...", "class": "...", "race": "..." }\n}'}
                />
              </div>

              {importError && (
                <div className="alert">
                  {importError}
                </div>
              )}

              <button
                type="button"
                className="btn primary"
                onClick={handleImportCampaign}
                disabled={!importJSON.trim()}
              >
                Import Campaign
              </button>
            </div>
          )}

          {importStep && (
            <div className="pipeline">
              <div className="head">
                {importStep === 'done' ? 'Campaign Imported!' : 'Importing campaign...'}
              </div>

              {IMPORT_STEPS.map((step, i) => {
                const stepIndex = IMPORT_STEPS.findIndex(s => s.key === importStep);
                const isCompleted = i < stepIndex || importStep === 'done';
                const isCurrent = step.key === importStep && importStep !== 'done';

                return (
                  <div
                    key={step.key}
                    className={`step${isCompleted ? ' done' : isCurrent ? ' now' : ''}`}
                  >
                    <span className="glyph">
                      {isCompleted ? '✓' : isCurrent ? '●' : '○'}
                    </span>
                    <span className="txt">{step.label}</span>
                  </div>
                );
              })}

              {importStep === 'done' && importResult && (
                <>
                  <div className="pipeline-note">
                    {importResult.characterId ? (
                      <>
                        Created {importResult.sessionsCreated} session record{importResult.sessionsCreated !== 1 ? 's' : ''}
                        {importResult.companionsCreated > 0 && `, ${importResult.companionsCreated} companion${importResult.companionsCreated !== 1 ? 's' : ''}`}
                      </>
                    ) : (
                      'Campaign and plan imported. Create a character and assign them from the campaign details panel.'
                    )}
                  </div>
                  <div className="pipeline-foot">
                    {importResult.characterId && (
                      <button
                        type="button"
                        className="btn primary lg"
                        onClick={() => {
                          resetImport();
                          onNavigateToPlay?.();
                        }}
                      >
                        Play Now
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setSelectedCampaign(importResult.campaign);
                        resetImport();
                      }}
                    >
                      View Campaign
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {!showNewCampaign && !showImport && !pipelineStep && !importStep && (
            <div className="list">
              {loading ? (
                <div className="empty">Loading campaigns...</div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="empty">
                  No {filter !== 'all' ? filter : ''} campaigns found
                </div>
              ) : (
                filteredCampaigns.map(campaign => (
                  <div
                    key={campaign.id}
                    className={
                      'entry'
                      + (selectedCampaign?.id === campaign.id ? ' on' : '')
                      + (campaign.status === 'archived' ? ' archived' : '')
                    }
                    onClick={() => setSelectedCampaign(campaign)}
                  >
                    <div className="name">
                      {campaign.name}
                    </div>
                    <div className="meta">
                      <span className={`badge ${campaign.status}`}>
                        {campaign.status}
                      </span>
                      {campaign.setting && (
                        <span className="setting">
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
        <div className="panel">
          <div className="panel-head">
            <h3 className="name">Campaign Details</h3>
          </div>

          {!selectedCampaign ? (
            <div className="empty">Select a campaign to view details</div>
          ) : (
            <>
              <div className="section">
                <div className="detail-head">
                  <h3>{selectedCampaign.name}</h3>
                  <span className={`badge ${selectedCampaign.status}`}>
                    {selectedCampaign.status}
                  </span>
                </div>

                {selectedCampaign.description && (
                  <div className="blurb">
                    {selectedCampaign.description}
                  </div>
                )}
              </div>

              <div className="info-grid">
                <div className="info">
                  <div className="k">Setting</div>
                  <div className="v">{selectedCampaign.setting || 'Forgotten Realms'}</div>
                </div>
                <div className="info">
                  <div className="k">Tone</div>
                  <div className="v">
                    {(selectedCampaign.tone || 'heroic fantasy').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </div>
                </div>
                {selectedCampaign.starting_location && (
                  <div className="info">
                    <div className="k">Starting Location</div>
                    <div className="v">{selectedCampaign.starting_location}</div>
                  </div>
                )}
                <div className="info">
                  <div className="k">Time Ratio</div>
                  <div className="v">
                    {(selectedCampaign.time_ratio || 'normal').charAt(0).toUpperCase() + (selectedCampaign.time_ratio || 'normal').slice(1)}
                  </div>
                </div>
              </div>

              {campaignStats && (
                <div className="stats">
                  <div className="stat">
                    <div className="n">{campaignStats.character_count || 0}</div>
                    <div className="k">Characters</div>
                  </div>
                  <div className="stat">
                    <div className="n">{campaignStats.quest_count || 0}</div>
                    <div className="k">Quests</div>
                  </div>
                  <div className="stat">
                    <div className="n">{campaignStats.location_count || 0}</div>
                    <div className="k">Locations</div>
                  </div>
                </div>
              )}

              {/* Characters Section */}
              <div className="section">
                <div className="section-title">
                  Characters ({campaignCharacters.length})
                </div>

                {campaignCharacters.length === 0 ? (
                  <div className="empty tight">
                    No characters assigned to this campaign
                  </div>
                ) : (
                  <div className="roster">
                    {campaignCharacters.map(char => (
                      <div key={char.id} className="member">
                        <div className="who">
                          <span className="name">{char.name}</span>
                          <span className="meta">
                            Level {char.level} {char.race} {char.class?.charAt(0).toUpperCase() + char.class?.slice(1)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn sm"
                          onClick={() => handleRemoveCharacter(char.id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {selectedCampaign.status === 'active' && unassignedCharacters.length > 0 && (
                  <div className="assign">
                    <div className="section-title">Assign Character</div>
                    <div className="row">
                      <select
                        className="select"
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
                        type="button"
                        className="btn primary"
                        onClick={handleAssignCharacter}
                        disabled={!selectedCharacterToAssign}
                      >
                        Assign
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="actions">
                {selectedCampaign.status === 'active' && (
                  <button
                    type="button"
                    className="btn"
                    onClick={handleArchiveCampaign}
                  >
                    Archive Campaign
                  </button>
                )}
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => setConfirmDelete(selectedCampaign)}
                >
                  Delete Campaign
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div className="scrim" onClick={() => setConfirmDelete(null)}>
          <div className="dialog" onClick={e => e.stopPropagation()}>
            <h3>Delete Campaign?</h3>
            <p>
              This will permanently delete <strong>{confirmDelete.name}</strong> and
              all associated locations, quests, factions, merchants, and world data. Characters will be unassigned
              but not deleted.
            </p>
            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn danger fill"
                onClick={handleDeleteCampaign}
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
