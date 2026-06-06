import { useState } from 'react';

// Local inline sprite — kept local so we never touch the shared HearthSprite.
function CPSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="cp-party" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </symbol>
        <symbol id="cp-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </symbol>
        <symbol id="cp-send" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 2L11 13" />
          <path d="M22 2l-7 20-4-9-9-4 20-7z" />
        </symbol>
      </defs>
    </svg>
  );
}

function CompanionsPanel({ companions, awayCompanions = [], onClose, onSendActivity, onRecallCompanion }) {
  const [selectedCompanionIdx, setSelectedCompanionIdx] = useState(0);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendFormData, setSendFormData] = useState({
    activity_type: 'training',
    description: '',
    location: '',
    duration_days: 3
  });

  const companion = companions[selectedCompanionIdx];
  const isClassBased = companion?.progression_type === 'class_based';

  // Parse ability scores
  let abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
  if (companion) {
    try {
      const rawScores = companion.companion_ability_scores || companion.npc_ability_scores;
      const parsed = typeof rawScores === 'string' ? JSON.parse(rawScores || '{}') : (rawScores || {});
      abilityScores = { ...abilityScores, ...parsed };
    } catch (e) {}
  }

  const sign = (n) => (n >= 0 ? `+${n}` : `${n}`);
  const abilStats = [
    { abbr: 'Str', key: 'str' },
    { abbr: 'Dex', key: 'dex' },
    { abbr: 'Con', key: 'con' },
    { abbr: 'Int', key: 'int' },
    { abbr: 'Wis', key: 'wis' },
    { abbr: 'Cha', key: 'cha' }
  ];

  const hpLow = companion && companion.companion_current_hp < companion.companion_max_hp * 0.5;
  const hpPct = companion
    ? Math.min(100, (companion.companion_current_hp / companion.companion_max_hp) * 100)
    : 0;

  const displayName = companion
    ? (companion.nickname && companion.name
        ? `${companion.name.split(' ')[0]} "${companion.nickname}"`
        : companion.name || companion.nickname)
    : '';

  return (
    <>
      <CPSprite />
      <div className="panel-scrim show" onClick={onClose} />
      <aside className="pnl open" data-panel="companions">
        <div className="pnl-head">
          <svg className="ph-ic2"><use href="#cp-party" /></svg>
          <h3>Party companions</h3>
          <span className="ph-sub2">
            {companions.length} in party{awayCompanions.length > 0 ? ` · ${awayCompanions.length} away` : ''}
          </span>
          <button className="pnl-close" onClick={onClose} aria-label="Close">
            <svg className="ic"><use href="#cp-x" /></svg>
          </button>
        </div>

        <div className="pnl-body scroll">
          {/* Companion selector tabs */}
          {companions.length > 1 && (
            <div className="cp-tabs">
              {companions.map((comp, idx) => (
                <button
                  key={comp.id}
                  className={`chip${selectedCompanionIdx === idx ? ' on' : ''}`}
                  onClick={() => setSelectedCompanionIdx(idx)}
                >
                  {comp.name?.split(' ')[0] || comp.nickname}
                </button>
              ))}
            </div>
          )}

          {companion && (
            <>
              {/* Companion identity */}
              <div className="cp-id">
                {companion.avatar && (
                  <img className="cp-avatar" src={companion.avatar} alt={companion.name} />
                )}
                <div className="cp-id-text">
                  <div className="cp-name">{displayName}</div>
                  <div className="cp-meta">
                    {companion.race}{companion.gender ? ` (${companion.gender})` : ''}
                  </div>
                  {isClassBased ? (
                    <div className="cp-role">
                      Level {companion.companion_level} {companion.companion_class}
                      {companion.companion_subclass ? ` (${companion.companion_subclass})` : ''}
                    </div>
                  ) : (
                    <div className="cp-role">
                      {companion.occupation || 'Companion'}{companion.cr ? ` · CR ${companion.cr}` : ''}
                    </div>
                  )}
                </div>
              </div>

              {/* HP */}
              {isClassBased && (
                <>
                  <div className="pnl-sec">Hit points<span className="ln"></span></div>
                  <div className="cp-hp">
                    <div className="cp-hp-row">
                      <span className="cp-hp-label">Current</span>
                      <span className={`cp-hp-val${hpLow ? ' low' : ''}`}>
                        {companion.companion_current_hp}<span className="mx">/{companion.companion_max_hp}</span>
                      </span>
                    </div>
                    <div className="cp-hp-track">
                      <div className={`cp-hp-fill${hpLow ? ' low' : ''}`} style={{ width: `${hpPct}%` }} />
                    </div>
                  </div>
                </>
              )}

              {/* Ability scores */}
              <div className="pnl-sec">Ability scores<span className="ln"></span></div>
              <div className="qr-stats cp-abil">
                {abilStats.map(stat => {
                  const score = abilityScores[stat.key] || 10;
                  const modifier = Math.floor((score - 10) / 2);
                  return (
                    <div className="qr-stat" key={stat.abbr}>
                      <div className="l">{stat.abbr}</div>
                      <div className="v">{score}</div>
                      <div className="cp-abil-mod">{sign(modifier)}</div>
                    </div>
                  );
                })}
              </div>

              {/* Combat stats for NPC companions */}
              {!isClassBased && (companion.ac || companion.hp) && (
                <>
                  <div className="pnl-sec">Combat<span className="ln"></span></div>
                  <div className="cheat">
                    {companion.ac && (<><span className="ck">AC</span><span className="cv">{companion.ac}</span></>)}
                    {companion.hp && (<><span className="ck">HP</span><span className="cv">{companion.hp}</span></>)}
                    {companion.speed && (<><span className="ck">Speed</span><span className="cv">{companion.speed}</span></>)}
                  </div>
                </>
              )}

              {/* Personality */}
              {(companion.personality_trait_1 || companion.personality_trait_2) && (
                <>
                  <div className="pnl-sec">Personality<span className="ln"></span></div>
                  {companion.personality_trait_1 && (
                    <div className="tech"><div className="tdsc">{companion.personality_trait_1}</div></div>
                  )}
                  {companion.personality_trait_2 && (
                    <div className="tech"><div className="tdsc">{companion.personality_trait_2}</div></div>
                  )}
                </>
              )}

              {/* Motivation */}
              {companion.motivation && (
                <>
                  <div className="pnl-sec">Motivation<span className="ln"></span></div>
                  <div className="tech"><div className="tdsc">{companion.motivation}</div></div>
                </>
              )}

              {/* Roleplay notes */}
              {(companion.voice || companion.mannerism) && (
                <>
                  <div className="pnl-sec">Roleplay notes<span className="ln"></span></div>
                  <div className="cheat">
                    {companion.voice && (<><span className="ck">Voice</span><span className="cv">{companion.voice}</span></>)}
                    {companion.mannerism && (<><span className="ck">Mannerism</span><span className="cv">{companion.mannerism}</span></>)}
                  </div>
                </>
              )}

              {/* Send on mission */}
              {onSendActivity && (
                <>
                  <div className="pnl-sec">Activity<span className="ln"></span></div>
                  {!showSendForm ? (
                    <button className="btn" style={{ width: '100%' }} onClick={() => setShowSendForm(true)}>
                      <svg className="ic"><use href="#cp-send" /></svg>Send on mission
                    </button>
                  ) : (
                    <div className="cp-form">
                      <select
                        value={sendFormData.activity_type}
                        onChange={e => setSendFormData(prev => ({ ...prev, activity_type: e.target.value }))}
                      >
                        <option value="training">Training</option>
                        <option value="scouting">Scouting</option>
                        <option value="personal_quest">Personal Quest</option>
                        <option value="guarding">Guarding</option>
                        <option value="researching">Researching</option>
                        <option value="shopping">Shopping</option>
                        <option value="socializing">Socializing</option>
                        <option value="resting">Resting</option>
                      </select>
                      <input
                        placeholder="Location (optional)"
                        value={sendFormData.location}
                        onChange={e => setSendFormData(prev => ({ ...prev, location: e.target.value }))}
                      />
                      <input
                        placeholder="Description (optional)"
                        value={sendFormData.description}
                        onChange={e => setSendFormData(prev => ({ ...prev, description: e.target.value }))}
                      />
                      <div className="cp-form-days">
                        <label>Days</label>
                        <input
                          type="number" min="1" max="30"
                          value={sendFormData.duration_days}
                          onChange={e => setSendFormData(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 3 }))}
                        />
                      </div>
                      <div className="cp-form-actions">
                        <button
                          className="btn primary"
                          onClick={() => {
                            onSendActivity(companion.id, sendFormData);
                            setShowSendForm(false);
                            setSendFormData({ activity_type: 'training', description: '', location: '', duration_days: 3 });
                          }}
                        >
                          Send
                        </button>
                        <button className="btn ghost" onClick={() => setShowSendForm(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* Away on mission */}
          {awayCompanions.length > 0 && (
            <>
              <div className="pnl-sec">Away on mission ({awayCompanions.length})<span className="ln"></span></div>
              {awayCompanions.map(ac => (
                <div className="cp-away" key={ac.companion_id}>
                  <div className="cp-away-top">
                    <span className="cp-away-name">{ac.name}</span>
                    {onRecallCompanion && ac.activity_id && (
                      <button className="btn sm danger" onClick={() => onRecallCompanion(ac.activity_id)}>
                        Recall
                      </button>
                    )}
                  </div>
                  <div className="cp-away-act">
                    {ac.activity_type?.replace('_', ' ')}{ac.location ? ` at ${ac.location}` : ''}
                  </div>
                  {ac.expected_duration_days && (
                    <div className="cp-away-dur">~{ac.expected_duration_days} day mission</div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>

        <div className="pnl-foot">
          <button className="btn" onClick={onClose}>
            <svg className="ic"><use href="#cp-x" /></svg>Close panel
          </button>
        </div>
      </aside>
    </>
  );
}

export default CompanionsPanel;
