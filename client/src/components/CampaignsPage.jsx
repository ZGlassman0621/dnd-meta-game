import { useState, useEffect } from 'react';
import { STARTING_LOCATIONS } from '../data/forgottenRealms';
import '../styles/hearth.css';
import '../styles/hearth-campaigns.css';

/* ───────────────────────── Hearth · Campaigns ─────────────────────────
   Dark-editorial port of Hearth/Campaigns.html. Pure render + style swap:
   every panel is wired to this component's REAL data and handlers — the
   campaign list, create pipeline, JSON import, character assignment,
   archive and delete flows are all preserved exactly as before.
   The mockup's invented values (last-played day, session count, spoiler
   flag, named-NPC count) are omitted where the app has no such data.
   ──────────────────────────────────────────────────────────────────── */

const cap = (s) => (s == null || s === '') ? s : String(s).replace(/\b\w/g, c => c.toUpperCase());

// Local inline icon sprite (paths copied from the design's icon defs)
const HearthCampaignSprite = () => (
  <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
    <symbol id="i-play" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M6 4.5v15a1 1 0 0 0 1.54.84l11.5-7.5a1 1 0 0 0 0-1.68L7.54 3.66A1 1 0 0 0 6 4.5z" /></symbol>
    <symbol id="i-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" /></symbol>
    <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
    <symbol id="i-upload" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></symbol>
    <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></symbol>
    <symbol id="i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></symbol>
    <symbol id="i-archive" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="21 8 21 21 3 21 3 8" /><rect x="1" y="3" width="22" height="5" /><line x1="10" y1="12" x2="14" y2="12" /></symbol>
  </defs></svg>
);

const Ic = ({ n }) => <svg className="ic"><use href={'#i-' + n} /></svg>;

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

const CampaignsPage = ({ character, allCharacters, onCharacterUpdated, onNavigateToPlay, onBack }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [campaignCharacters, setCampaignCharacters] = useState([]);
  const [campaignStats, setCampaignStats] = useState(null);
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
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
      const contentType = response.headers.get('content-type') || '';
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

  // ── derive presentation data from real campaign records ──
  // Feature = the first active campaign (or first in the active filter).
  const featured = filteredCampaigns[0] || null;
  const others = featured ? filteredCampaigns.filter(c => c.id !== featured.id) : filteredCampaigns;

  // Level chip on the feature comes from a real assigned character, if any.
  const featureLevel = (() => {
    if (!featured) return null;
    if (character?.campaign_id === featured.id) return character.level;
    return null;
  })();

  const statusClass = (status) => status === 'active' ? '' : status === 'archived' ? 'archived' : 'paused';
  const toneLabel = (t) => cap(t || 'heroic fantasy');
  const timeLabel = (t) => cap(t || 'normal');

  const closePanels = () => { resetPipeline(); resetImport(); };

  // map the create-pipeline progress to the design's step list
  const renderPipeline = () => {
    const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === pipelineStep);
    return (
      <div className="pipe">
        <div className="pipe-title serif">{pipelineStep === 'done' ? 'Your world is ready' : 'Setting up your campaign…'}</div>
        {PIPELINE_STEPS.map((step, i) => {
          const isCompleted = i < stepIndex || pipelineStep === 'done';
          const isCurrent = step.key === pipelineStep && pipelineStep !== 'done';
          // Skip parsing display if no backstory to parse
          if (step.key === 'parsing' && (!character?.backstory || character?.parsed_backstory)) {
            if (!isCurrent) return null;
          }
          // Skip character-dependent steps if there's no character
          if (!character && ['assigning', 'parsing', 'generating'].includes(step.key)) return null;
          const cls = isCompleted ? 'done' : isCurrent ? 'current' : '';
          return (
            <div key={step.key} className={`pipe-step ${cls}`}>
              <span className="mark">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
              <span className="txt">{step.label}</span>
              {isCurrent && step.key === 'generating' && (
                <div className="pipe-progress"><div className="bar" /></div>
              )}
            </div>
          );
        })}

        {pipelineError && (
          <div className="pipe-error">
            <span>Error: {pipelineError}</span>
            <button
              className="btn primary sm"
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
          <div className="pipe-foot">
            <button className="btn primary lg" onClick={() => { resetPipeline(); onNavigateToPlay?.(); }}>
              <Ic n="play" />Play now
            </button>
            <button className="btn" onClick={resetPipeline}>Back to campaigns</button>
          </div>
        )}
      </div>
    );
  };

  const renderImportProgress = () => {
    const stepIndex = IMPORT_STEPS.findIndex(s => s.key === importStep);
    return (
      <div className="pipe">
        <div className="pipe-title serif">{importStep === 'done' ? 'Campaign imported' : 'Importing campaign…'}</div>
        {IMPORT_STEPS.map((step, i) => {
          const isCompleted = i < stepIndex || importStep === 'done';
          const isCurrent = step.key === importStep && importStep !== 'done';
          const cls = isCompleted ? 'done' : isCurrent ? 'current' : '';
          return (
            <div key={step.key} className={`pipe-step ${cls}`}>
              <span className="mark">{isCompleted ? '✓' : isCurrent ? '●' : '○'}</span>
              <span className="txt">{step.label}</span>
            </div>
          );
        })}
        {importStep === 'done' && importResult && (
          <>
            <div className="pipe-note">
              {importResult.characterId ? (
                <>
                  Created {importResult.sessionsCreated} session record{importResult.sessionsCreated !== 1 ? 's' : ''}
                  {importResult.companionsCreated > 0 && `, ${importResult.companionsCreated} companion${importResult.companionsCreated !== 1 ? 's' : ''}`}.
                </>
              ) : (
                'Campaign and plan imported. Create a character and assign them from the campaign details.'
              )}
            </div>
            <div className="pipe-foot">
              {importResult.characterId && (
                <button className="btn primary lg" onClick={() => { resetImport(); onNavigateToPlay?.(); }}>
                  <Ic n="play" />Play now
                </button>
              )}
              <button className="btn" onClick={() => { setSelectedCampaign(importResult.campaign); resetImport(); }}>
                View campaign
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderNewCampaignForm = () => (
    <section className="panel form-panel">
      <div className="panel-head">
        <Ic n="plus" />
        <span className="ph-t">Begin a new campaign</span>
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={resetPipeline}>Cancel</button>
      </div>
      <div className="panel-body">
        <form onSubmit={handleCreateCampaign}>
          <div className="field">
            <label className="label">Campaign name *</label>
            <input
              className="hinp"
              type="text"
              value={newCampaign.name}
              onChange={e => setNewCampaign({ ...newCampaign, name: e.target.value })}
              required
              placeholder="The Dragon's Hoard"
            />
          </div>

          <div className="field">
            <label className="label">Premise</label>
            <textarea
              className="htxt"
              value={newCampaign.description}
              onChange={e => setNewCampaign({ ...newCampaign, description: e.target.value })}
              placeholder="An epic adventure in a world of magic and mystery…"
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label">Setting</label>
              <input
                className="hinp"
                type="text"
                value={newCampaign.setting}
                onChange={e => setNewCampaign({ ...newCampaign, setting: e.target.value })}
                placeholder="Forgotten Realms"
              />
            </div>
            <div className="field">
              <label className="label">Tone</label>
              <select
                className="hsel"
                value={newCampaign.tone}
                onChange={e => setNewCampaign({ ...newCampaign, tone: e.target.value })}
              >
                {toneOptions.map(tone => (
                  <option key={tone} value={tone}>{toneLabel(tone)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="field-row">
            <div className="field">
              <label className="label">
                Starting location
                {backstoryLocation && <span className="hint">from backstory</span>}
              </label>
              <select
                className="hsel"
                value={newCampaign.starting_location}
                onChange={e => {
                  setNewCampaign({ ...newCampaign, starting_location: e.target.value });
                  if (e.target.value !== 'custom') setCustomLocation('');
                }}
              >
                <option value="">Select a location…</option>
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
                <option value="custom">Custom Location…</option>
              </select>
              {newCampaign.starting_location === 'custom' && (
                <input
                  className="hinp"
                  style={{ marginTop: 8 }}
                  type="text"
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value)}
                  placeholder="Enter custom location name"
                />
              )}
            </div>
            <div className="field">
              <label className="label">Time ratio</label>
              <select
                className="hsel"
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

          <button type="submit" className="btn primary lg" style={{ marginTop: 8 }}>
            <Ic n="globe" />Create campaign
          </button>
        </form>
      </div>
    </section>
  );

  const renderImportForm = () => (
    <section className="panel form-panel">
      <div className="panel-head">
        <Ic n="upload" />
        <span className="ph-t">Import a campaign</span>
        <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={resetImport}>Cancel</button>
      </div>
      <div className="panel-body">
        <p className="field-help">
          Load a JSON file or paste campaign JSON below. Must contain a "campaign" section; "character" and "campaign_plan" are optional.
        </p>
        <div className="row gap8" style={{ marginBottom: 12 }}>
          <button
            type="button"
            className="btn sm"
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
            <Ic n="upload" />Load from file
          </button>
          {importJSON && <span className="file-loaded">{(importJSON.length / 1024).toFixed(1)} KB loaded</span>}
        </div>
        <div className="field">
          <textarea
            className="htxt mono"
            value={importJSON}
            onChange={e => setImportJSON(e.target.value)}
            placeholder={'{\n  "campaign": { "name": "..." },\n  "campaign_plan": { ... },\n  "character": { "name": "...", "class": "...", "race": "..." }\n}'}
          />
        </div>
        {importError && (
          <div className="pipe-error" style={{ whiteSpace: 'pre-wrap', marginBottom: 12 }}>{importError}</div>
        )}
        <button
          className="btn primary lg"
          onClick={handleImportCampaign}
          disabled={!importJSON.trim()}
        >
          <Ic n="upload" />Import campaign
        </button>
      </div>
    </section>
  );

  const renderDetail = () => {
    const c = selectedCampaign;
    return (
      <section className="panel detail-panel">
        <div className="panel-head">
          <Ic n="globe" />
          <span className="ph-t">Campaign details</span>
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={() => setSelectedCampaign(null)}>
            <Ic n="x" />Close
          </button>
        </div>
        <div className="panel-body">
          <div className="detail-head">
            <h2>{c.name}</h2>
            <span className={`camp-status-pill chip ${c.status === 'archived' ? 'warn' : ''}`}>{cap(c.status)}</span>
          </div>

          {c.description && <p className="detail-desc">{c.description}</p>}

          <div className="info-grid">
            <div className="info-item">
              <div className="info-label">Setting</div>
              <div className="info-value">{c.setting || 'Forgotten Realms'}</div>
            </div>
            <div className="info-item">
              <div className="info-label">Tone</div>
              <div className="info-value">{toneLabel(c.tone)}</div>
            </div>
            {c.starting_location && (
              <div className="info-item">
                <div className="info-label">Starting location</div>
                <div className="info-value">{c.starting_location}</div>
              </div>
            )}
            <div className="info-item">
              <div className="info-label">Time ratio</div>
              <div className="info-value">{timeLabel(c.time_ratio)}</div>
            </div>
          </div>

          {campaignStats && (
            <div className="stat-grid">
              <div className="stat-box"><div className="stat-value">{campaignStats.characters ?? 0}</div><div className="stat-label">Characters</div></div>
              <div className="stat-box"><div className="stat-value">{campaignStats.quests ?? 0}</div><div className="stat-label">Quests</div></div>
              <div className="stat-box"><div className="stat-value">{campaignStats.locations ?? 0}</div><div className="stat-label">Locations</div></div>
              <div className="stat-box"><div className="stat-value">{campaignStats.companions ?? 0}</div><div className="stat-label">Companions</div></div>
            </div>
          )}

          <div className="sec-head"><h2>Characters</h2><span className="glyph">❧</span><span className="fl" /><span className="sub">{campaignCharacters.length}</span></div>
          {campaignCharacters.length === 0 ? (
            <div className="camp-empty">No characters assigned to this campaign.</div>
          ) : (
            campaignCharacters.map(char => (
              <div key={char.id} className="char-row">
                <div>
                  <div className="cn">{char.name}</div>
                  <div className="cm">Level {char.level} · {char.race} {cap(char.class)}</div>
                </div>
                <button className="btn ghost sm" onClick={() => handleRemoveCharacter(char.id)}>Remove</button>
              </div>
            ))
          )}

          {c.status === 'active' && unassignedCharacters.length > 0 && (
            <div className="assign-row">
              <select
                className="hsel"
                style={{ flex: 1 }}
                value={selectedCharacterToAssign}
                onChange={e => setSelectedCharacterToAssign(e.target.value)}
              >
                <option value="">Assign a character…</option>
                {unassignedCharacters.map(char => (
                  <option key={char.id} value={char.id}>
                    {char.name} (Level {char.level} {cap(char.class)})
                  </option>
                ))}
              </select>
              <button className="btn" onClick={handleAssignCharacter} disabled={!selectedCharacterToAssign}>Assign</button>
            </div>
          )}

          <div className="row gap10" style={{ marginTop: 22, flexWrap: 'wrap' }}>
            {c.status === 'active' && (
              <button className="btn" onClick={handleArchiveCampaign}><Ic n="archive" />Archive</button>
            )}
            <button className="btn danger" onClick={() => setConfirmDelete(c)}><Ic n="trash" />Delete campaign</button>
          </div>
        </div>
      </section>
    );
  };

  const busy = showNewCampaign || pipelineStep || showImport || importStep;

  return (
    <div className="hearth campaigns">
      <HearthCampaignSprite />

      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr" />
        {character?.name && <span className="back" onClick={onBack} style={{ cursor: 'pointer' }}>{character.name}'s campaigns</span>}
        <div className="spacer" />
        <span className="opus"><span className="dot" />Opus</span>
      </header>

      <main className="page">
        <div className="page-eyebrow"><span className="eyebrow">Campaigns</span><span className="ln" /></div>

        {/* toolbar: filters + create / import */}
        <div className="camp-toolbar">
          <div className="filter-tabs">
            {['active', 'archived', 'all'].map(f => (
              <button
                key={f}
                className={`filter-tab${filter === f ? ' on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {cap(f)}
              </button>
            ))}
          </div>
          <div className="spacer" />
          {!busy && (
            <>
              <button className="btn" onClick={() => { closePanels(); setShowImport(true); }}><Ic n="upload" />Import</button>
              <button className="btn primary" onClick={() => { closePanels(); setShowNewCampaign(true); }}><Ic n="plus" />New campaign</button>
            </>
          )}
        </div>

        {/* create / import flows take over the canvas when active */}
        {pipelineStep ? renderPipeline()
          : showNewCampaign ? renderNewCampaignForm()
          : importStep ? renderImportProgress()
          : showImport ? renderImportForm()
          : (
            <>
              {loading ? (
                <div className="camp-empty">Loading campaigns…</div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="camp-empty">
                  No {filter !== 'all' ? filter : ''} campaigns yet. Begin one below.
                </div>
              ) : (
                <>
                  {/* FEATURED campaign */}
                  {featured && (
                    <section className="feature">
                      <div className="feat-main">
                        <div className="feat-tag"><span className="pulse" />{cap(featured.status)}</div>
                        <h2>{featured.name}</h2>
                        {featured.description && <div className="premise">{featured.description}</div>}
                        <div className="feat-meta">
                          {featureLevel != null && <span className="chip">Level {featureLevel}</span>}
                          {featured.setting && <span className="chip">{featured.setting}</span>}
                          {featured.starting_location && <span className="chip">{featured.starting_location}</span>}
                          {featured.tone && <span className="chip">{toneLabel(featured.tone)}</span>}
                        </div>
                        <div className="feat-actions">
                          {character?.campaign_id === featured.id && (
                            <button className="btn primary" onClick={() => onNavigateToPlay?.()}><Ic n="play" />Continue</button>
                          )}
                          <button className="btn" onClick={() => setSelectedCampaign(featured)}><Ic n="globe" />Details</button>
                        </div>
                      </div>
                      <div className="feat-side">
                        <h3>The world Opus wrote</h3>
                        {featured.starting_location && (
                          <div className="plan-row"><span className="k">Starts in</span><span className="v">{featured.starting_location}</span></div>
                        )}
                        <div className="plan-row"><span className="k">Setting</span><span className="v">{featured.setting || 'Forgotten Realms'}</span></div>
                        <div className="plan-row"><span className="k">Tone</span><span className="v">{toneLabel(featured.tone)}</span></div>
                        <div className="plan-row"><span className="k">Time ratio</span><span className="v">{timeLabel(featured.time_ratio)}</span></div>
                        {selectedCampaign?.id === featured.id && campaignStats && (
                          <div className="plan-row"><span className="k">Locations</span><span className="v accent">{campaignStats.locations} mapped</span></div>
                        )}
                      </div>
                    </section>
                  )}

                  {/* OTHER campaigns */}
                  {others.length > 0 && (
                    <>
                      <div className="sec-head"><h2>Other campaigns</h2><span className="glyph">❧</span><span className="fl" /><span className="sub">{others.length}</span></div>
                      <div className="camp-list">
                        {others.map(c => (
                          <button
                            key={c.id}
                            className={`camp${selectedCampaign?.id === c.id ? ' selected' : ''}`}
                            onClick={() => setSelectedCampaign(c)}
                          >
                            <div className="ct"><span className={`status ${statusClass(c.status)}`}>{cap(c.status)}</span></div>
                            <h3>{c.name}</h3>
                            {c.description && <p>{c.description}</p>}
                            <div className="meta">
                              {[c.setting, c.starting_location].filter(Boolean).join(' · ') || timeLabel(c.time_ratio)}
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* selected-campaign detail panel */}
              {selectedCampaign && (
                <div style={{ marginTop: 36 }}>{renderDetail()}</div>
              )}

              {/* begin-new entry point */}
              <div style={{ marginTop: 28 }}>
                <button className="btn lg" onClick={() => { closePanels(); setShowNewCampaign(true); }}>
                  <Ic n="plus" />Begin a new campaign
                </button>
              </div>
            </>
          )}
      </main>

      {/* delete confirmation */}
      {confirmDelete && (
        <div className="scrim" onClick={() => setConfirmDelete(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-head"><h3>Delete this campaign?</h3></div>
            <div className="modal-body">
              <p className="lede" style={{ margin: 0 }}>
                This permanently deletes <span className="serif" style={{ color: 'var(--ink)', fontStyle: 'normal' }}>{confirmDelete.name}</span> and
                all of its locations, quests, factions, merchants, and world data. Characters are unassigned but not deleted.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="btn danger" onClick={handleDeleteCampaign}><Ic n="trash" />Delete forever</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CampaignsPage;
