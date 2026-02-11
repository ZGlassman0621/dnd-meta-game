import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';
import { CAMPAIGN_MODULES, getCampaignModule } from '../data/campaignModules';

export default function SessionSetup({
  character,
  allCharacters,
  onBack,
  // LLM status
  llmStatus,
  providerPreference,
  onProviderChange,
  onCheckStatus,
  // Campaign context
  campaignContext,
  continueCampaign,
  onContinueCampaignChange,
  // Session history
  sessionHistory,
  onShowHistory,
  // Setup state
  selectedModule,
  onSelectedModuleChange,
  secondCharacterId,
  onSecondCharacterIdChange,
  startingLocation,
  onStartingLocationChange,
  era,
  onEraChange,
  arrivalHook,
  onArrivalHookChange,
  customArrivalHook,
  onCustomArrivalHookChange,
  customConcepts,
  onCustomConceptsChange,
  campaignLength,
  onCampaignLengthChange,
  availableNpcs,
  selectedNpcIds,
  onSelectedNpcIdsChange,
  // Actions
  onStartSession,
  onOpenCampaignNotes,
  // Loading/error
  isLoading,
  error
}) {
  const secondCharacter = secondCharacterId
    ? allCharacters?.find(c => c.id === secondCharacterId)
    : null;

  return (
    <div className="dm-session-container">
      <div className="dm-session-header">
        <button className="back-btn" onClick={onBack}>&larr; Back</button>
        <h2>AI Dungeon Master</h2>
        {sessionHistory.length > 0 && (
          <button className="history-btn" onClick={onShowHistory}>
            Past Adventures ({sessionHistory.length})
          </button>
        )}
      </div>

      <div className="dm-setup">
        <div className="party-preview">
          <div className="character-preview">
            <h3>{character.nickname || character.name}</h3>
            <p>Level {character.level} {character.race?.charAt(0).toUpperCase() + character.race?.slice(1)} {character.class?.charAt(0).toUpperCase() + character.class?.slice(1)}</p>
            <p className="hp-display">HP: {character.current_hp}/{character.max_hp}</p>
          </div>

          {secondCharacter && (
            <div className="character-preview secondary">
              <h3>{secondCharacter.nickname || secondCharacter.name}</h3>
              <p>Level {secondCharacter.level} {secondCharacter.race?.charAt(0).toUpperCase() + secondCharacter.race?.slice(1)} {secondCharacter.class?.charAt(0).toUpperCase() + secondCharacter.class?.slice(1)}</p>
              <p className="hp-display">HP: {secondCharacter.current_hp}/{secondCharacter.max_hp}</p>
            </div>
          )}
        </div>

        {llmStatus === null ? (
          <p>Checking AI status...</p>
        ) : (
          <div className="setup-form">
            <div className="llm-status-indicator" style={{
              padding: '0.5rem 1rem',
              marginBottom: '1rem',
              borderRadius: '4px',
              background: llmStatus.provider === 'claude' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(46, 204, 113, 0.15)',
              border: `1px solid ${llmStatus.provider === 'claude' ? '#8b5cf6' : '#2ecc71'}`,
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '1rem' }}>{llmStatus.provider === 'claude' ? '🟣' : '🟢'}</span>
              <span>
                <strong>AI Provider:</strong> {llmStatus.provider === 'claude' ? 'Claude (Anthropic)' : 'Ollama (Local)'}
                {llmStatus.model && <span style={{ opacity: 0.7 }}> • {llmStatus.model}</span>}
              </span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.3rem' }}>
                <button
                  onClick={() => {
                    const next = providerPreference === 'auto'
                      ? 'ollama'
                      : providerPreference === 'ollama'
                        ? 'claude'
                        : 'auto';
                    onProviderChange(next);
                  }}
                  style={{
                    padding: '0.2rem 0.5rem', borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)',
                    color: '#ccc', fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  {providerPreference === 'auto' ? 'Auto' : providerPreference === 'claude' ? 'Claude' : 'Ollama'}
                </button>
                <button
                  onClick={onCheckStatus}
                  title="Recheck provider availability"
                  style={{
                    padding: '0.2rem 0.4rem', borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)',
                    color: '#ccc', fontSize: '0.75rem', cursor: 'pointer'
                  }}
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Campaign Continuity - Show if there are previous sessions */}
            {campaignContext?.hasPreviousSessions && (
              <div className="campaign-continuity-section" style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>📜</span>
                  <div>
                    <h4 style={{ margin: 0 }}>Continue Your Story?</h4>
                    <p style={{ margin: '0.25rem 0 0', opacity: 0.8, fontSize: '0.9rem' }}>
                      Last session: {campaignContext.lastSession.title}
                    </p>
                  </div>
                </div>

                {campaignContext.lastSession.summary && (
                  <p style={{
                    fontSize: '0.85rem',
                    fontStyle: 'italic',
                    opacity: 0.9,
                    margin: '0.75rem 0',
                    padding: '0.5rem',
                    background: 'rgba(0,0,0,0.2)',
                    borderRadius: '4px'
                  }}>
                    "{campaignContext.lastSession.summary}"
                  </p>
                )}

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => onContinueCampaignChange(true)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: continueCampaign ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
                      background: continueCampaign ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0,0,0,0.2)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontWeight: continueCampaign ? 'bold' : 'normal'
                    }}
                  >
                    Continue Campaign
                    <br />
                    <small style={{ opacity: 0.7 }}>Keep settings, AI knows your story</small>
                  </button>
                  <button
                    type="button"
                    onClick={() => onContinueCampaignChange(false)}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      borderRadius: '6px',
                      border: !continueCampaign ? '2px solid #8b5cf6' : '1px solid rgba(255,255,255,0.2)',
                      background: !continueCampaign ? 'rgba(139, 92, 246, 0.3)' : 'rgba(0,0,0,0.2)',
                      color: 'inherit',
                      cursor: 'pointer',
                      fontWeight: !continueCampaign ? 'bold' : 'normal'
                    }}
                  >
                    New Adventure
                    <br />
                    <small style={{ opacity: 0.7 }}>Fresh start, new settings</small>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={onOpenCampaignNotes}
                  style={{
                    width: '100%',
                    marginTop: '0.75rem',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'rgba(0,0,0,0.2)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  📝 View/Edit Campaign Memory
                </button>
              </div>
            )}

            {/* Campaign Notes button for new characters without previous sessions */}
            {!campaignContext?.hasPreviousSessions && (
              <button
                type="button"
                onClick={onOpenCampaignNotes}
                style={{
                  width: '100%',
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.2)',
                  background: 'rgba(0,0,0,0.2)',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                📝 Add Campaign Notes (Optional)
              </button>
            )}

            {/* Campaign Summary - shown when continuing an existing campaign (without campaign plan) */}
            {continueCampaign && campaignContext?.hasPreviousSessions && !campaignContext?.campaignPlan && (
              <div className="campaign-summary" style={{
                background: 'rgba(139, 92, 246, 0.1)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <h4 style={{ margin: '0 0 1rem 0', color: '#a78bfa' }}>
                  📋 Campaign Settings
                </h4>

                {/* Campaign Type */}
                <div style={{ marginBottom: '0.75rem' }}>
                  <span style={{ color: '#888', fontSize: '0.85rem' }}>Campaign Type:</span>
                  <div style={{ marginTop: '0.25rem' }}>
                    {getCampaignModule(selectedModule)?.icon} {getCampaignModule(selectedModule)?.name}
                  </div>
                </div>

                {/* Custom adventure settings - only for custom campaigns */}
                {selectedModule === 'custom' && (
                  <>
                    {/* Starting Location */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Location:</span>
                      {startingLocation ? (
                        <div style={{ marginTop: '0.25rem' }}>
                          📍 {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.name}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.25rem' }}>
                          <select
                            value={startingLocation}
                            onChange={(e) => onStartingLocationChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'inherit'
                            }}
                          >
                            <option value="">Choose a location...</option>
                            <optgroup label="Major Cities">
                              {STARTING_LOCATIONS.filter(loc => loc.type === 'city').map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.region})</option>
                              ))}
                            </optgroup>
                            <optgroup label="Regions & Wilderness">
                              {STARTING_LOCATIONS.filter(loc => loc.type === 'region').map(loc => (
                                <option key={loc.id} value={loc.id}>{loc.name}</option>
                              ))}
                            </optgroup>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Era/Year */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Era:</span>
                      {era ? (
                        <div style={{ marginTop: '0.25rem' }}>
                          📅 {ERAS.find(e => e.id === era)?.name}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.25rem' }}>
                          <select
                            value={era}
                            onChange={(e) => onEraChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'inherit'
                            }}
                          >
                            <option value="">Choose an era...</option>
                            {ERAS.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Arrival Hook */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>What Brought You Here:</span>
                      {arrivalHook && !(arrivalHook === 'custom' && !customArrivalHook.trim()) ? (
                        <div style={{ marginTop: '0.25rem' }}>
                          🎭 {arrivalHook === 'custom' ? customArrivalHook : ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.name}
                        </div>
                      ) : (
                        <div style={{ marginTop: '0.25rem' }}>
                          <select
                            value={arrivalHook}
                            onChange={(e) => onArrivalHookChange(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(0,0,0,0.3)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              color: 'inherit'
                            }}
                          >
                            <option value="">Choose your backstory hook...</option>
                            {ARRIVAL_HOOKS.map(hook => (
                              <option key={hook.id} value={hook.id}>{hook.name}</option>
                            ))}
                          </select>
                          {arrivalHook === 'custom' && (
                            <textarea
                              value={customArrivalHook}
                              onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                              placeholder="What originally brought your character to this region?"
                              rows={2}
                              style={{
                                width: '100%',
                                marginTop: '0.5rem',
                                padding: '0.5rem',
                                borderRadius: '4px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.2)',
                                color: 'inherit'
                              }}
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Campaign Length */}
                    <div style={{ marginBottom: '0.75rem' }}>
                      <span style={{ color: '#888', fontSize: '0.85rem' }}>Campaign Length:</span>
                      <div style={{ marginTop: '0.25rem' }}>
                        ⏱️ {CAMPAIGN_LENGTHS.find(l => l.id === campaignLength)?.name || 'Ongoing Saga'}
                      </div>
                    </div>

                    {/* Narrative Vision */}
                    {customConcepts && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>Narrative Vision:</span>
                        <div style={{ marginTop: '0.25rem', fontStyle: 'italic', opacity: 0.9 }}>
                          "{customConcepts}"
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Selected NPCs */}
                {selectedNpcIds.length > 0 && (
                  <div style={{ marginBottom: '0.75rem' }}>
                    <span style={{ color: '#888', fontSize: '0.85rem' }}>Custom NPCs:</span>
                    <div style={{ marginTop: '0.25rem' }}>
                      👥 {availableNpcs.filter(npc => selectedNpcIds.includes(npc.id)).map(npc => npc.name).join(', ')}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Campaign Plan Quick Start - when a campaign plan exists, skip full config */}
            {campaignContext?.campaignPlan && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                borderRadius: '8px',
                background: 'rgba(155, 89, 182, 0.1)',
                border: '1px solid rgba(155, 89, 182, 0.3)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🗺️</span>
                  <div>
                    <h4 style={{ margin: 0, color: '#a78bfa' }}>Campaign Plan Loaded</h4>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.9rem', color: '#f5f5f5' }}>
                      {campaignContext.campaignPlan.questTitle || campaignContext.campaignPlan.campaignName}
                    </p>
                  </div>
                </div>
                {campaignContext.campaignPlan.themes?.length > 0 && (
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {campaignContext.campaignPlan.themes.map((theme, i) => (
                      <span key={i} style={{
                        background: 'rgba(155, 89, 182, 0.2)',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: '#a78bfa'
                      }}>
                        {theme}
                      </span>
                    ))}
                  </div>
                )}
                <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', opacity: 0.6 }}>
                  World, NPCs, factions, and quest arc will be loaded from your campaign plan.
                </p>
              </div>
            )}

            {/* Campaign Module Selection - hide when continuing existing campaign or when campaign plan exists */}
            {!(continueCampaign && campaignContext?.hasPreviousSessions) && !campaignContext?.campaignPlan && (
            <>
            <div className="form-group">
              <label>Campaign Type</label>
              <div className="campaign-module-grid">
                {CAMPAIGN_MODULES.map(module => (
                  <div
                    key={module.id}
                    className={`campaign-module-card ${selectedModule === module.id ? 'selected' : ''}`}
                    onClick={() => onSelectedModuleChange(module.id)}
                  >
                    <span className="module-icon">{module.icon}</span>
                    <div className="module-info">
                      <h4>{module.name}</h4>
                      <p className="module-level">Levels {module.suggestedLevel}</p>
                      {module.year && <span className="module-year">{module.year}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {selectedModule && (
                <div className="module-description-box">
                  <p className="module-synopsis">{getCampaignModule(selectedModule)?.synopsis}</p>
                  {getCampaignModule(selectedModule)?.type === 'published' && (
                    <div className="module-details">
                      <p><strong>Setting:</strong> {getCampaignModule(selectedModule)?.setting}</p>
                      <p><strong>Themes:</strong> {getCampaignModule(selectedModule)?.themes.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {allCharacters && allCharacters.length > 1 && (
              <div className="form-group">
                <label>Second Player Character (Optional)</label>
                <select
                  value={secondCharacterId || ''}
                  onChange={(e) => onSecondCharacterIdChange(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Solo Adventure</option>
                  {allCharacters
                    .filter(c => c.id !== character.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nickname || c.name} - Level {c.level} {c.race} {c.class}
                      </option>
                    ))
                  }
                </select>
                <small>Add a companion to your adventure</small>
              </div>
            )}

            {/* Custom adventure options - only show for custom campaigns */}
            {selectedModule === 'custom' && (
              <>
                <div className="form-group">
                  <label>Where Are You Starting?</label>
                  <select
                    value={startingLocation}
                    onChange={(e) => onStartingLocationChange(e.target.value)}
                    required
                  >
                    <option value="">Choose a location...</option>
                    <optgroup label="Major Cities">
                      {STARTING_LOCATIONS.filter(loc => loc.type === 'city').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name} ({loc.region})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Regions & Wilderness">
                      {STARTING_LOCATIONS.filter(loc => loc.type === 'region').map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {startingLocation && (
                    <small className="location-description">
                      {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.description}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>What Year Is It?</label>
                  <select
                    value={era}
                    onChange={(e) => onEraChange(e.target.value)}
                    required
                  >
                    <option value="">Choose an era...</option>
                    {ERAS.map(e => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                  {era && (
                    <small className="era-description">
                      {ERAS.find(e => e.id === era)?.description}
                    </small>
                  )}
                </div>

                <div className="form-group">
                  <label>What Brought You Here?</label>
                  <small style={{ display: 'block', marginBottom: '0.5rem', opacity: 0.7 }}>
                    Your character's backstory reason for being in this region
                  </small>
                  <select
                    value={arrivalHook}
                    onChange={(e) => onArrivalHookChange(e.target.value)}
                    required
                  >
                    <option value="">Choose your backstory hook...</option>
                    {ARRIVAL_HOOKS.map(hook => (
                      <option key={hook.id} value={hook.id}>{hook.name}</option>
                    ))}
                  </select>
                  {arrivalHook && arrivalHook !== 'custom' && (
                    <small className="hook-description">
                      {ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.description}
                    </small>
                  )}
                  {arrivalHook === 'custom' && (
                    <textarea
                      value={customArrivalHook}
                      onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                      placeholder="What originally brought your character to this region? (e.g., fleeing past troubles, following a rumor, returning home after years away...)"
                      rows={3}
                      style={{ marginTop: '0.5rem' }}
                      required
                    />
                  )}
                </div>

                <div className="form-group">
                  <label>Campaign Length</label>
                  <div className="campaign-length-options">
                    {CAMPAIGN_LENGTHS.map(length => (
                      <label key={length.id} className={`campaign-option ${campaignLength === length.id ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="campaignLength"
                          value={length.id}
                          checked={campaignLength === length.id}
                          onChange={(e) => onCampaignLengthChange(e.target.value)}
                        />
                        <span className="option-name">{length.name}</span>
                        <span className="option-description">{length.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Narrative Vision (Optional)</label>
                  <textarea
                    value={customConcepts}
                    onChange={(e) => onCustomConceptsChange(e.target.value)}
                    placeholder="What themes do you want this campaign to explore? (e.g., found family, redemption, romance, betrayal, building a legacy, healing from trauma...)"
                    rows={3}
                  />
                  <small>The AI will create situations and NPCs that embody these themes over time</small>
                </div>
              </>
            )}

            {availableNpcs.length > 0 && !campaignContext?.campaignPlan && (
              <div className="form-group">
                <label>Include Custom NPCs (Optional)</label>
                <small style={{ display: 'block', marginBottom: '0.5rem', color: '#888' }}>
                  Select NPCs from your collection to include in this adventure
                </small>
                <div className="npc-selection-grid">
                  {availableNpcs.map(npc => (
                    <label
                      key={npc.id}
                      className={`npc-select-item ${selectedNpcIds.includes(npc.id) ? 'selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedNpcIds.includes(npc.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onSelectedNpcIdsChange([...selectedNpcIds, npc.id]);
                          } else {
                            onSelectedNpcIdsChange(selectedNpcIds.filter(id => id !== npc.id));
                          }
                        }}
                      />
                      <div className="npc-select-info">
                        <span className="npc-select-name">{npc.name}</span>
                        <span className="npc-select-details">
                          {npc.race} {npc.occupation ? `• ${npc.occupation}` : ''}
                          {npc.campaign_availability === 'companion' && ' • Companion'}
                          {npc.campaign_availability === 'mention_only' && ' • Mention only'}
                        </span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            </>
            )}

            {error && <div className="dm-error">{error}</div>}

            <button
              className="start-adventure-btn"
              onClick={onStartSession}
              disabled={isLoading || (selectedModule === 'custom' && !continueCampaign && !campaignContext?.campaignPlan && (!startingLocation || !era || !arrivalHook || (arrivalHook === 'custom' && !customArrivalHook.trim())))}
            >
              {isLoading ? 'Starting Adventure...' : 'Begin Adventure'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
