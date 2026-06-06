import '../styles/hearth.css';
import '../styles/hearth-sessionsetup.css';
import { HearthSprite, Ic } from './hearthUI.jsx';
import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';
import { CAMPAIGN_MODULES, getCampaignModule } from '../data/campaignModules';

const cap = (s) => (s == null || s === '') ? s : String(s).charAt(0).toUpperCase() + String(s).slice(1);
const monogram = (name) => (name || '?').trim().charAt(0).toUpperCase();

export default function SessionSetup({
  character,
  allCharacters,
  onBack,
  // LLM status
  llmStatus,
  providerPreference,
  onProviderChange,
  onCheckStatus,
  useSonnet,
  onUseSonnetChange,
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

  const isClaude = llmStatus?.provider === 'claude';
  const beginLabel = continueCampaign && campaignContext?.hasPreviousSessions ? 'Continue Adventure' : 'Begin Adventure';

  return (
    <div className="hearth ss-shell app-bg">
      <HearthSprite />

      {/* ───────── HEADER ───────── */}
      <header className="dash-hdr">
        <button className="back" onClick={onBack}>
          <Ic n="arrow-left" />Back
        </button>
        <div className="vr"></div>
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <span className="eyebrow" style={{ color: 'var(--ink-3)' }}>Dungeon Master</span>
        <div className="spacer"></div>
        {sessionHistory.length > 0 && (
          <button className="hdr-link" onClick={onShowHistory}>
            <Ic n="scroll" />Past Adventures ({sessionHistory.length})
          </button>
        )}
      </header>

      <div className="ss-canvas">
        {/* ───────── PARTY PREVIEW ───────── */}
        <div className="ss-sec">
          <span className="ss-sec-t">Your Party</span>
          <span className="ss-fl"></span>
        </div>
        <div className="ss-party">
          <div className="ss-pc lead">
            <div className="ss-crest">{monogram(character.nickname || character.name)}</div>
            <div>
              <h3 className="ss-pc-name">{character.nickname || character.name}</h3>
              <div className="ss-pc-sub">
                Level {character.level}
                <span className="ss-sep">·</span>
                {cap(character.race)} {cap(character.class)}
              </div>
              <div className="ss-pc-hp">HP {character.current_hp}/{character.max_hp}</div>
            </div>
          </div>

          {secondCharacter && (
            <div className="ss-pc companion">
              <div className="ss-crest">{monogram(secondCharacter.nickname || secondCharacter.name)}</div>
              <div>
                <h3 className="ss-pc-name">{secondCharacter.nickname || secondCharacter.name}</h3>
                <div className="ss-pc-sub">
                  Level {secondCharacter.level}
                  <span className="ss-sep">·</span>
                  {cap(secondCharacter.race)} {cap(secondCharacter.class)}
                </div>
                <div className="ss-pc-hp">HP {secondCharacter.current_hp}/{secondCharacter.max_hp}</div>
              </div>
            </div>
          )}
        </div>

        {llmStatus === null ? (
          <p className="ss-checking">Checking AI status…</p>
        ) : (
          <div className="ss-form">
            {/* ───────── AI PROVIDER / MODEL ───────── */}
            <div className="ss-sec">
              <span className="ss-sec-t">Dungeon Master</span>
              <span className="ss-fl"></span>
            </div>
            <div className={`ss-provider${isClaude ? ' claude' : ''}`}>
              <span className="ss-prov-dot"></span>
              <span className="ss-prov-text">
                <strong>{isClaude ? 'Claude (Anthropic)' : 'Ollama (Local)'}</strong>
                {llmStatus.model && <span className="ss-prov-model"> · {llmStatus.model}</span>}
              </span>

              {/* Model selector — Opus is the production default (v1.0.99).
                  The toggle now selects Sonnet as an opt-down for cost.
                  Provider stays on 'auto' so Ollama is still a fallback if
                  Claude is unreachable. Sonnet button = explicit opt-down;
                  Opus button = production default. */}
              {isClaude && (
                <div className="ss-model-grp">
                  <button
                    type="button"
                    className={`ss-seg${useSonnet ? ' on' : ''}`}
                    onClick={() => onUseSonnetChange?.(true)}
                    title="Sonnet — opt-down for cost. Cheaper, but thinner prose. Production default is Opus."
                  >
                    Sonnet
                  </button>
                  <button
                    type="button"
                    className={`ss-seg${!useSonnet ? ' on' : ''}`}
                    onClick={() => onUseSonnetChange?.(false)}
                    title="Opus — production default. Better prose at ~$1.50/hour."
                  >
                    Opus
                  </button>
                  <button
                    type="button"
                    className="ss-prov-recheck"
                    onClick={onCheckStatus}
                    title="Recheck provider availability"
                  >
                    ↻
                  </button>
                </div>
              )}
            </div>

            {/* Campaign Continuity - Show if there are previous sessions */}
            {campaignContext?.hasPreviousSessions && (
              <>
                <div className="ss-sec">
                  <span className="ss-sec-t">Continue Your Story</span>
                  <span className="ss-fl"></span>
                </div>
                <div className="ss-card accent">
                  <div className="ss-card-head">
                    <span className="ss-card-glyph">📜</span>
                    <div>
                      <h4>Continue Your Story?</h4>
                      <p className="ss-card-sub">Last session: {campaignContext.lastSession.title}</p>
                    </div>
                  </div>

                  {campaignContext.lastSession.summary && (
                    <p className="ss-quote">“{campaignContext.lastSession.summary}”</p>
                  )}

                  <div className="ss-choice-row">
                    <button
                      type="button"
                      className={`ss-choice${continueCampaign ? ' on' : ''}`}
                      onClick={() => onContinueCampaignChange(true)}
                    >
                      <span className="ss-choice-t">Continue Campaign</span>
                      <span className="ss-choice-d">Keep settings, AI knows your story</span>
                    </button>
                    <button
                      type="button"
                      className={`ss-choice${!continueCampaign ? ' on' : ''}`}
                      onClick={() => onContinueCampaignChange(false)}
                    >
                      <span className="ss-choice-t">New Adventure</span>
                      <span className="ss-choice-d">Fresh start, new settings</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn"
                    style={{ width: '100%', marginTop: 12 }}
                    onClick={onOpenCampaignNotes}
                  >
                    <Ic n="pen" />View / Edit Campaign Memory
                  </button>
                </div>
              </>
            )}

            {/* Campaign Notes button for new characters without previous sessions */}
            {!campaignContext?.hasPreviousSessions && (
              <button
                type="button"
                className="btn"
                style={{ width: '100%', marginTop: 16 }}
                onClick={onOpenCampaignNotes}
              >
                <Ic n="pen" />Add Campaign Notes (Optional)
              </button>
            )}

            {/* Campaign Summary - shown when continuing an existing campaign (without campaign plan) */}
            {continueCampaign && campaignContext?.hasPreviousSessions && !campaignContext?.campaignPlan && (
              <>
                <div className="ss-sec">
                  <span className="ss-sec-t">Campaign Settings</span>
                  <span className="ss-fl"></span>
                </div>
                <div className="ss-card accent">
                  {/* Campaign Type */}
                  <div className="ss-kv">
                    <div className="ss-k">Campaign Type</div>
                    <div className="ss-v">
                      {getCampaignModule(selectedModule)?.icon} {getCampaignModule(selectedModule)?.name}
                    </div>
                  </div>

                  {/* Custom adventure settings - only for custom campaigns */}
                  {selectedModule === 'custom' && (
                    <>
                      {/* Starting Location */}
                      <div className="ss-kv">
                        <div className="ss-k">Location</div>
                        {startingLocation ? (
                          <div className="ss-v">
                            📍 {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.name}
                          </div>
                        ) : (
                          <select
                            className="ss-select"
                            style={{ marginTop: 5 }}
                            value={startingLocation}
                            onChange={(e) => onStartingLocationChange(e.target.value)}
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
                        )}
                      </div>

                      {/* Era/Year */}
                      <div className="ss-kv">
                        <div className="ss-k">Era</div>
                        {era ? (
                          <div className="ss-v">
                            📅 {ERAS.find(e => e.id === era)?.name}
                          </div>
                        ) : (
                          <select
                            className="ss-select"
                            style={{ marginTop: 5 }}
                            value={era}
                            onChange={(e) => onEraChange(e.target.value)}
                          >
                            <option value="">Choose an era...</option>
                            {ERAS.map(e => (
                              <option key={e.id} value={e.id}>{e.name}</option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Arrival Hook */}
                      <div className="ss-kv">
                        <div className="ss-k">What Brought You Here</div>
                        {arrivalHook && !(arrivalHook === 'custom' && !customArrivalHook.trim()) ? (
                          <div className="ss-v">
                            🎭 {arrivalHook === 'custom' ? customArrivalHook : ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.name}
                          </div>
                        ) : (
                          <>
                            <select
                              className="ss-select"
                              style={{ marginTop: 5 }}
                              value={arrivalHook}
                              onChange={(e) => onArrivalHookChange(e.target.value)}
                            >
                              <option value="">Choose your backstory hook...</option>
                              {ARRIVAL_HOOKS.map(hook => (
                                <option key={hook.id} value={hook.id}>{hook.name}</option>
                              ))}
                            </select>
                            {arrivalHook === 'custom' && (
                              <textarea
                                className="ss-textarea"
                                value={customArrivalHook}
                                onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                                placeholder="What originally brought your character to this region?"
                                rows={2}
                                style={{ marginTop: 8 }}
                              />
                            )}
                          </>
                        )}
                      </div>

                      {/* Campaign Length */}
                      <div className="ss-kv">
                        <div className="ss-k">Campaign Length</div>
                        <div className="ss-v">
                          ⏱️ {CAMPAIGN_LENGTHS.find(l => l.id === campaignLength)?.name || 'Ongoing Saga'}
                        </div>
                      </div>

                      {/* Narrative Vision */}
                      {customConcepts && (
                        <div className="ss-kv">
                          <div className="ss-k">Narrative Vision</div>
                          <div className="ss-v">“{customConcepts}”</div>
                        </div>
                      )}
                    </>
                  )}

                  {/* Selected NPCs */}
                  {selectedNpcIds.length > 0 && (
                    <div className="ss-kv">
                      <div className="ss-k">Custom NPCs</div>
                      <div className="ss-v">
                        👥 {availableNpcs.filter(npc => selectedNpcIds.includes(npc.id)).map(npc => npc.name).join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Campaign Plan Quick Start - when a campaign plan exists, skip full config */}
            {campaignContext?.campaignPlan && (
              <>
                <div className="ss-sec">
                  <span className="ss-sec-t">Campaign Plan</span>
                  <span className="ss-fl"></span>
                </div>
                <div className="ss-card accent">
                  <div className="ss-card-head">
                    <span className="ss-card-glyph">🗺️</span>
                    <div>
                      <h4>Campaign Plan Loaded</h4>
                      <p className="ss-card-sub">
                        {campaignContext.campaignPlan.questTitle || campaignContext.campaignPlan.campaignName}
                      </p>
                    </div>
                  </div>
                  {campaignContext.campaignPlan.themes?.length > 0 && (
                    <div className="ss-tags">
                      {campaignContext.campaignPlan.themes.map((theme, i) => (
                        <span key={i} className="chip">{theme}</span>
                      ))}
                    </div>
                  )}
                  <p className="ss-hint">
                    World, NPCs, factions, and quest arc will be loaded from your campaign plan.
                  </p>
                </div>
              </>
            )}

            {/* Old single-session "Play a Prelude?" origin-story card was
                removed in v1.0.44. Preludes are now the prelude-forward
                character creator — start one from Characters → ✦ Start with
                a Prelude, not from inside an existing character's sessions. */}


            {/* Campaign Module Selection - hide when continuing existing campaign or when campaign plan exists */}
            {!(continueCampaign && campaignContext?.hasPreviousSessions) && !campaignContext?.campaignPlan && (
            <>
            <div className="ss-group">
              <div className="ss-sec">
                <span className="ss-sec-t">Campaign Type</span>
                <span className="ss-fl"></span>
              </div>
              <div className="ss-modules">
                {CAMPAIGN_MODULES.map(module => (
                  <div
                    key={module.id}
                    className={`ss-module ${selectedModule === module.id ? 'on' : ''}`}
                    onClick={() => onSelectedModuleChange(module.id)}
                  >
                    <span className="ss-mod-icon">{module.icon}</span>
                    <div>
                      <div className="ss-mod-name">{module.name}</div>
                      <div className="ss-mod-lvl">Levels {module.suggestedLevel}</div>
                      {module.year && <span className="ss-mod-year">{module.year}</span>}
                    </div>
                  </div>
                ))}
              </div>
              {selectedModule && (
                <div className="ss-mod-desc">
                  <p className="ss-synopsis">{getCampaignModule(selectedModule)?.synopsis}</p>
                  {getCampaignModule(selectedModule)?.type === 'published' && (
                    <div className="ss-mod-details">
                      <p><strong>Setting:</strong> {getCampaignModule(selectedModule)?.setting}</p>
                      <p><strong>Themes:</strong> {getCampaignModule(selectedModule)?.themes.join(', ')}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {allCharacters && allCharacters.length > 1 && (
              <div className="ss-group">
                <label className="ss-label">Second Player Character (Optional)</label>
                <select
                  className="ss-select"
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
                <small className="ss-hint">Add a companion to your adventure</small>
              </div>
            )}

            {/* Custom adventure options - only show for custom campaigns */}
            {selectedModule === 'custom' && (
              <>
                <div className="ss-group">
                  <label className="ss-label">Where Are You Starting?</label>
                  <select
                    className="ss-select"
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
                    <small className="ss-hint">
                      {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.description}
                    </small>
                  )}
                </div>

                <div className="ss-group">
                  <label className="ss-label">What Year Is It?</label>
                  <select
                    className="ss-select"
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
                    <small className="ss-hint">
                      {ERAS.find(e => e.id === era)?.description}
                    </small>
                  )}
                </div>

                <div className="ss-group">
                  <label className="ss-label">What Brought You Here?</label>
                  <small className="ss-hint top">
                    Your character's backstory reason for being in this region
                  </small>
                  <select
                    className="ss-select"
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
                    <small className="ss-hint">
                      {ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.description}
                    </small>
                  )}
                  {arrivalHook === 'custom' && (
                    <textarea
                      className="ss-textarea"
                      value={customArrivalHook}
                      onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                      placeholder="What originally brought your character to this region? (e.g., fleeing past troubles, following a rumor, returning home after years away...)"
                      rows={3}
                      style={{ marginTop: 8 }}
                      required
                    />
                  )}
                </div>

                <div className="ss-group">
                  <label className="ss-label">Campaign Length</label>
                  <div className="ss-length">
                    {CAMPAIGN_LENGTHS.map(length => (
                      <label key={length.id} className={`ss-length-opt ${campaignLength === length.id ? 'on' : ''}`}>
                        <input
                          type="radio"
                          name="campaignLength"
                          value={length.id}
                          checked={campaignLength === length.id}
                          onChange={(e) => onCampaignLengthChange(e.target.value)}
                        />
                        <span className="ss-opt-name">{length.name}</span>
                        <span className="ss-opt-desc">{length.description}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="ss-group">
                  <label className="ss-label">Narrative Vision (Optional)</label>
                  <textarea
                    className="ss-textarea"
                    value={customConcepts}
                    onChange={(e) => onCustomConceptsChange(e.target.value)}
                    placeholder="What themes do you want this campaign to explore? (e.g., found family, redemption, romance, betrayal, building a legacy, healing from trauma...)"
                    rows={3}
                  />
                  <small className="ss-hint">The AI will create situations and NPCs that embody these themes over time</small>
                </div>
              </>
            )}

            {availableNpcs.length > 0 && !campaignContext?.campaignPlan && (
              <div className="ss-group">
                <label className="ss-label">Include Custom NPCs (Optional)</label>
                <small className="ss-hint top">
                  Select NPCs from your collection to include in this adventure
                </small>
                <div className="ss-npcs">
                  {availableNpcs.map(npc => (
                    <label
                      key={npc.id}
                      className={`ss-npc ${selectedNpcIds.includes(npc.id) ? 'on' : ''}`}
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
                      <span className="ss-npc-name">{npc.name}</span>
                      <span className="ss-npc-det">
                        {npc.race} {npc.occupation ? `• ${npc.occupation}` : ''}
                        {npc.campaign_availability === 'companion' && ' • Companion'}
                        {npc.campaign_availability === 'mention_only' && ' • Mention only'}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            </>
            )}

            {error && <div className="ss-error">{error}</div>}

            <button
              className="btn primary lg ss-begin"
              onClick={onStartSession}
              disabled={isLoading || (selectedModule === 'custom' && !continueCampaign && !campaignContext?.campaignPlan && (!startingLocation || !era || !arrivalHook || (arrivalHook === 'custom' && !customArrivalHook.trim())))}
            >
              {isLoading ? 'Starting Adventure…' : beginLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
