import {
  STARTING_LOCATIONS,
  ERAS,
  ARRIVAL_HOOKS,
  CAMPAIGN_LENGTHS
} from '../data/forgottenRealms';

// Presentation lives in `../styles/session-setup.css`, scoped under
// `.session-setup`. The ~40 inline style objects that used to sit in this
// markup were the dark-shell palette hardcoded per element. See that file for
// why the root class changed away from `.dm-session-container` (it is shared
// live with four still-dark screens) and why `body` is still dark.

const titleCase = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

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
    <div className="session-setup">
      <div className="page-head">
        <div className="tools">
          <button className="btn sm" onClick={onBack}>&larr; Back</button>
          {sessionHistory.length > 0 && (
            <button className="btn sm" onClick={onShowHistory}>
              Past Adventures ({sessionHistory.length})
            </button>
          )}
        </div>
        <h2>AI Dungeon Master</h2>
      </div>

      <div className="party">
        <div className="who">
          <div className="name">{character.nickname || character.name}</div>
          <div className="build">
            Level {character.level} {titleCase(character.race)} {titleCase(character.class)}
          </div>
          <div className="hp">
            HP<span className="v">{character.current_hp}/{character.max_hp}</span>
          </div>
        </div>

        {secondCharacter && (
          <div className="who">
            <div className="name">{secondCharacter.nickname || secondCharacter.name}</div>
            <div className="build">
              Level {secondCharacter.level} {titleCase(secondCharacter.race)} {titleCase(secondCharacter.class)}
            </div>
            <div className="hp">
              HP<span className="v">{secondCharacter.current_hp}/{secondCharacter.max_hp}</span>
            </div>
          </div>
        )}
      </div>

      {llmStatus === null ? (
        <p className="waiting">Checking AI status&hellip;</p>
      ) : (
        <div className="setup">
          <div className="provider">
            <span>
              <span className="k">AI Provider</span>
              <span className="v">{llmStatus.provider === 'claude' ? 'Claude (Anthropic)' : 'Ollama (Local)'}</span>
              {llmStatus.model && <span className="model">{llmStatus.model}</span>}
            </span>

            {/* Model selector — Opus is the production default (v1.0.99).
                The toggle now selects Sonnet as an opt-down for cost.
                Provider stays on 'auto' so Ollama is still a fallback if
                Claude is unreachable. Sonnet button = explicit opt-down;
                Opus button = production default. */}
            {llmStatus.provider === 'claude' && (
              <div className="seg-group">
                <button
                  className={`seg${useSonnet ? ' on' : ''}`}
                  onClick={() => onUseSonnetChange?.(true)}
                  title="Sonnet — opt-down for cost. Cheaper, but thinner prose. Production default is Opus."
                >
                  Sonnet
                </button>
                <button
                  className={`seg${!useSonnet ? ' on' : ''}`}
                  onClick={() => onUseSonnetChange?.(false)}
                  title="Opus — production default. Better prose at ~$1.50/hour."
                >
                  Opus
                </button>
                <button
                  className="seg glyph"
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
            <div className="callout">
              <h4>Continue Your Story?</h4>
              <p className="sub">Last session: {campaignContext.lastSession.title}</p>

              {campaignContext.lastSession.summary && (
                <p className="quote">&ldquo;{campaignContext.lastSession.summary}&rdquo;</p>
              )}

              <div className="choice">
                <button
                  type="button"
                  className={`opt${continueCampaign ? ' on' : ''}`}
                  onClick={() => onContinueCampaignChange(true)}
                >
                  <span className="n">Continue Campaign</span>
                  <span className="d">Keep settings, AI knows your story</span>
                </button>
                <button
                  type="button"
                  className={`opt${!continueCampaign ? ' on' : ''}`}
                  onClick={() => onContinueCampaignChange(false)}
                >
                  <span className="n">New Adventure</span>
                  <span className="d">Fresh start, new settings</span>
                </button>
              </div>

              <button type="button" className="btn wide" onClick={onOpenCampaignNotes}>
                View / Edit Campaign Memory
              </button>
            </div>
          )}

          {/* Campaign Notes button for new characters without previous sessions */}
          {!campaignContext?.hasPreviousSessions && (
            <button type="button" className="btn wide" onClick={onOpenCampaignNotes}>
              Add Campaign Notes (Optional)
            </button>
          )}

          {/* Campaign Summary - shown when continuing an existing campaign (without campaign plan) */}
          {continueCampaign && campaignContext?.hasPreviousSessions && !campaignContext?.campaignPlan && (
            <div className="summary">
              <div className="head">Campaign Settings</div>

              {/* Starting Location */}
              <div className="row">
                <span className="k">Location</span>
                {startingLocation ? (
                  <span className="v">{STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.name}</span>
                ) : (
                  <select
                    className="select"
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
              <div className="row">
                <span className="k">Era</span>
                {era ? (
                  <span className="v">{ERAS.find(e => e.id === era)?.name}</span>
                ) : (
                  <select
                    className="select"
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
              <div className="row">
                <span className="k">What Brought You Here</span>
                {arrivalHook && !(arrivalHook === 'custom' && !customArrivalHook.trim()) ? (
                  <span className="v">
                    {arrivalHook === 'custom' ? customArrivalHook : ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.name}
                  </span>
                ) : (
                  <>
                    <select
                      className="select"
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
                        className="textarea spaced"
                        value={customArrivalHook}
                        onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                        placeholder="What originally brought your character to this region?"
                        rows={2}
                      />
                    )}
                  </>
                )}
              </div>

              {/* Campaign Length */}
              <div className="row">
                <span className="k">Campaign Length</span>
                <span className="v">
                  {CAMPAIGN_LENGTHS.find(l => l.id === campaignLength)?.name || 'Ongoing Saga'}
                </span>
              </div>

              {/* Narrative Vision */}
              {customConcepts && (
                <div className="row">
                  <span className="k">Narrative Vision</span>
                  <span className="v quoted">&ldquo;{customConcepts}&rdquo;</span>
                </div>
              )}

              {/* Selected NPCs */}
              {selectedNpcIds.length > 0 && (
                <div className="row">
                  <span className="k">Custom NPCs</span>
                  <span className="v">
                    {availableNpcs.filter(npc => selectedNpcIds.includes(npc.id)).map(npc => npc.name).join(', ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Campaign Plan Quick Start - when a campaign plan exists, skip full config */}
          {campaignContext?.campaignPlan && (
            <div className="callout">
              <h4>Campaign Plan Loaded</h4>
              <p className="sub">
                {campaignContext.campaignPlan.questTitle || campaignContext.campaignPlan.campaignName}
              </p>
              {campaignContext.campaignPlan.themes?.length > 0 && (
                <div className="chips">
                  {campaignContext.campaignPlan.themes.map((theme, i) => (
                    <span key={i} className="chip">{theme}</span>
                  ))}
                </div>
              )}
              <p className="foot">
                World, NPCs, factions, and quest arc will be loaded from your campaign plan.
              </p>
            </div>
          )}

          {/* Old single-session "Play a Prelude?" origin-story card was
              removed in v1.0.44. Preludes are now the prelude-forward
              character creator — start one from Characters → ✦ Start with
              a Prelude, not from inside an existing character's sessions. */}


          {/* Hidden when continuing an existing campaign or when a campaign plan exists. */}
          {!(continueCampaign && campaignContext?.hasPreviousSessions) && !campaignContext?.campaignPlan && (
          <>
          {allCharacters && allCharacters.length > 1 && (
            <div className="field">
              <label className="label">Second Player Character (Optional)</label>
              <select
                className="select"
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
              <p className="help">Add a companion to your adventure</p>
            </div>
          )}

            <div className="field">
              <label className="label">Where Are You Starting?</label>
              <select
                className="select"
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
                <p className="help">
                  {STARTING_LOCATIONS.find(loc => loc.id === startingLocation)?.description}
                </p>
              )}
            </div>

            <div className="field">
              <label className="label">What Year Is It?</label>
              <select
                className="select"
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
                <p className="help">
                  {ERAS.find(e => e.id === era)?.description}
                </p>
              )}
            </div>

            <div className="field">
              <label className="label">What Brought You Here?</label>
              <p className="help lead">
                Your character's backstory reason for being in this region
              </p>
              <select
                className="select"
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
                <p className="help">
                  {ARRIVAL_HOOKS.find(h => h.id === arrivalHook)?.description}
                </p>
              )}
              {arrivalHook === 'custom' && (
                <textarea
                  className="textarea spaced"
                  value={customArrivalHook}
                  onChange={(e) => onCustomArrivalHookChange(e.target.value)}
                  placeholder="What originally brought your character to this region? (e.g., fleeing past troubles, following a rumor, returning home after years away...)"
                  rows={3}
                  required
                />
              )}
            </div>

            <div className="field">
              <label className="label">Campaign Length</label>
              <div className="options">
                {CAMPAIGN_LENGTHS.map(length => (
                  <label key={length.id} className={`option${campaignLength === length.id ? ' on' : ''}`}>
                    <input
                      type="radio"
                      name="campaignLength"
                      value={length.id}
                      checked={campaignLength === length.id}
                      onChange={(e) => onCampaignLengthChange(e.target.value)}
                    />
                    <span className="text">
                      <span className="n">{length.name}</span>
                      <span className="d">{length.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="field">
              <label className="label">Narrative Vision (Optional)</label>
              <textarea
                className="textarea"
                value={customConcepts}
                onChange={(e) => onCustomConceptsChange(e.target.value)}
                placeholder="What themes do you want this campaign to explore? (e.g., found family, redemption, romance, betrayal, building a legacy, healing from trauma...)"
                rows={3}
              />
              <p className="help">The AI will create situations and NPCs that embody these themes over time</p>
            </div>

          {availableNpcs.length > 0 && !campaignContext?.campaignPlan && (
            <div className="field">
              <label className="label">Include Custom NPCs (Optional)</label>
              <p className="help lead">
                Select NPCs from your collection to include in this adventure
              </p>
              <div className="npcs">
                {availableNpcs.map(npc => (
                  <label
                    key={npc.id}
                    className={`option${selectedNpcIds.includes(npc.id) ? ' on' : ''}`}
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
                    <span className="text">
                      <span className="n">{npc.name}</span>
                      <span className="d">
                        {npc.race} {npc.occupation ? `• ${npc.occupation}` : ''}
                        {npc.campaign_availability === 'companion' && ' • Companion'}
                        {npc.campaign_availability === 'mention_only' && ' • Mention only'}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          </>
          )}

          <div className="begin">
            {error && <div className="alert">{error}</div>}

            <button
              className="btn primary lg wide"
              onClick={onStartSession}
              disabled={isLoading || (!continueCampaign && !campaignContext?.campaignPlan && (!startingLocation || !era || !arrivalHook || (arrivalHook === 'custom' && !customArrivalHook.trim())))}
            >
              {isLoading ? 'Starting Adventure...' : 'Begin Adventure'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
