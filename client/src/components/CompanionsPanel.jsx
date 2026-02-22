import { useState } from 'react';

function CompanionsPanel({ companions, awayCompanions = [], onClose, onSendActivity, onRecallCompanion }) {
  const [selectedCompanionIdx, setSelectedCompanionIdx] = useState(0);
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendFormData, setSendFormData] = useState({
    activity_type: 'training',
    description: '',
    location: '',
    duration_days: 3
  });

  return (
          <div className="companions-ref-overlay" style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '400px',
            maxWidth: '90vw',
            height: '100vh',
            background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
            borderLeft: '1px solid rgba(155, 89, 182, 0.3)',
            boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Panel Header */}
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, color: '#9b59b6' }}>
                Party Companions
              </h3>
              <button
                onClick={() => onClose()}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#888',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  padding: '0.25rem'
                }}
              >
                ×
              </button>
            </div>

            {/* Companion Selector Tabs */}
            <div style={{
              display: 'flex',
              overflowX: 'auto',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              padding: '0.5rem',
              gap: '0.5rem'
            }}>
              {companions.map((comp, idx) => (
                <button
                  key={comp.id}
                  onClick={() => setSelectedCompanionIdx(idx)}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: selectedCompanionIdx === idx ? 'rgba(155, 89, 182, 0.3)' : 'transparent',
                    border: selectedCompanionIdx === idx ? '1px solid #9b59b6' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '4px',
                    color: selectedCompanionIdx === idx ? '#9b59b6' : '#888',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {comp.name?.split(' ')[0] || comp.nickname}
                </button>
              ))}
            </div>

            {/* Selected Companion Content */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '1rem'
            }}>
              {(() => {
                const companion = companions[selectedCompanionIdx];
                if (!companion) return null;

                const isClassBased = companion.progression_type === 'class_based';

                // Parse ability scores
                let abilityScores = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
                try {
                  const rawScores = companion.companion_ability_scores || companion.npc_ability_scores;
                  const parsed = typeof rawScores === 'string' ? JSON.parse(rawScores || '{}') : (rawScores || {});
                  abilityScores = { ...abilityScores, ...parsed };
                } catch (e) {}

                return (
                  <>
                    {/* Companion Header */}
                    <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                      {companion.avatar && (
                        <img
                          src={companion.avatar}
                          alt={companion.name}
                          style={{
                            width: '60px',
                            height: '60px',
                            borderRadius: '50%',
                            objectFit: 'cover',
                            border: '2px solid #9b59b6'
                          }}
                        />
                      )}
                      <div>
                        <h4 style={{ margin: 0, color: '#9b59b6' }}>
                          {companion.nickname && companion.name
                            ? `${companion.name.split(' ')[0]} "${companion.nickname}"`
                            : companion.name || companion.nickname}
                        </h4>
                        <div style={{ color: '#888', fontSize: '0.85rem' }}>
                          {companion.race} {companion.gender && `(${companion.gender})`}
                        </div>
                        {isClassBased ? (
                          <div style={{ color: '#3498db', fontWeight: 'bold', fontSize: '0.9rem' }}>
                            Level {companion.companion_level} {companion.companion_class}
                            {companion.companion_subclass && ` (${companion.companion_subclass})`}
                          </div>
                        ) : (
                          <div style={{ color: '#e67e22', fontSize: '0.85rem' }}>
                            {companion.occupation || 'Companion'} {companion.cr && `(CR ${companion.cr})`}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* HP Bar */}
                    {isClassBased && (
                      <div style={{
                        marginBottom: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(231, 76, 60, 0.1)',
                        border: '1px solid rgba(231, 76, 60, 0.3)',
                        borderRadius: '6px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                          <span style={{ color: '#888', fontSize: '0.8rem' }}>Hit Points</span>
                          <span style={{
                            fontWeight: 'bold',
                            color: companion.companion_current_hp < companion.companion_max_hp * 0.5 ? '#e74c3c' : '#2ecc71'
                          }}>
                            {companion.companion_current_hp}/{companion.companion_max_hp}
                          </span>
                        </div>
                        <div style={{ height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(100, (companion.companion_current_hp / companion.companion_max_hp) * 100)}%`,
                            background: companion.companion_current_hp < companion.companion_max_hp * 0.5
                              ? 'linear-gradient(90deg, #e74c3c, #c0392b)'
                              : 'linear-gradient(90deg, #2ecc71, #27ae60)',
                            borderRadius: '3px',
                            transition: 'width 0.3s'
                          }} />
                        </div>
                      </div>
                    )}

                    {/* Ability Scores */}
                    <div style={{ marginBottom: '1rem' }}>
                      <h5 style={{ color: '#f59e0b', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                        Ability Scores
                      </h5>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.25rem' }}>
                        {[
                          { abbr: 'STR', key: 'str' },
                          { abbr: 'DEX', key: 'dex' },
                          { abbr: 'CON', key: 'con' },
                          { abbr: 'INT', key: 'int' },
                          { abbr: 'WIS', key: 'wis' },
                          { abbr: 'CHA', key: 'cha' }
                        ].map(stat => {
                          const score = abilityScores[stat.key] || 10;
                          const modifier = Math.floor((score - 10) / 2);
                          return (
                            <div key={stat.abbr} style={{
                              padding: '0.35rem',
                              background: 'rgba(245, 158, 11, 0.1)',
                              borderRadius: '4px',
                              textAlign: 'center'
                            }}>
                              <div style={{ fontWeight: 'bold', fontSize: '0.7rem', color: '#fbbf24' }}>{stat.abbr}</div>
                              <div style={{ fontSize: '0.9rem' }}>{score}</div>
                              <div style={{ fontSize: '0.7rem', color: modifier >= 0 ? '#10b981' : '#ef4444' }}>
                                {modifier >= 0 ? '+' : ''}{modifier}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Personality */}
                    {(companion.personality_trait_1 || companion.personality_trait_2) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h5 style={{ color: '#ec4899', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                          Personality
                        </h5>
                        <div style={{ fontSize: '0.85rem', color: '#ccc' }}>
                          {companion.personality_trait_1 && <p style={{ margin: '0 0 0.5rem 0' }}>{companion.personality_trait_1}</p>}
                          {companion.personality_trait_2 && <p style={{ margin: 0 }}>{companion.personality_trait_2}</p>}
                        </div>
                      </div>
                    )}

                    {/* Motivation */}
                    {companion.motivation && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h5 style={{ color: '#22c55e', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                          Motivation
                        </h5>
                        <div style={{ fontSize: '0.85rem', color: '#ccc' }}>
                          {companion.motivation}
                        </div>
                      </div>
                    )}

                    {/* Combat Stats for NPC companions */}
                    {!isClassBased && (companion.ac || companion.hp) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h5 style={{ color: '#ef4444', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                          Combat
                        </h5>
                        <div style={{ display: 'flex', gap: '1rem', fontSize: '0.9rem' }}>
                          {companion.ac && (
                            <div>
                              <span style={{ color: '#888' }}>AC: </span>
                              <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>{companion.ac}</span>
                            </div>
                          )}
                          {companion.hp && (
                            <div>
                              <span style={{ color: '#888' }}>HP: </span>
                              <span style={{ fontWeight: 'bold', color: '#2ecc71' }}>{companion.hp}</span>
                            </div>
                          )}
                          {companion.speed && (
                            <div>
                              <span style={{ color: '#888' }}>Speed: </span>
                              <span>{companion.speed}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Voice/Mannerism */}
                    {(companion.voice || companion.mannerism) && (
                      <div style={{ marginBottom: '1rem' }}>
                        <h5 style={{ color: '#a78bfa', marginBottom: '0.5rem', fontSize: '0.9rem' }}>
                          Roleplay Notes
                        </h5>
                        <div style={{ fontSize: '0.85rem', color: '#ccc' }}>
                          {companion.voice && <p style={{ margin: '0 0 0.25rem 0' }}><strong>Voice:</strong> {companion.voice}</p>}
                          {companion.mannerism && <p style={{ margin: 0 }}><strong>Mannerism:</strong> {companion.mannerism}</p>}
                        </div>
                      </div>
                    )}

                    {/* Send on Mission */}
                    {onSendActivity && (
                      <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
                        {!showSendForm ? (
                          <button
                            onClick={() => setShowSendForm(true)}
                            style={{
                              width: '100%',
                              padding: '0.6rem',
                              background: 'rgba(59, 130, 246, 0.2)',
                              border: '1px solid rgba(59, 130, 246, 0.4)',
                              borderRadius: '6px',
                              color: '#60a5fa',
                              cursor: 'pointer',
                              fontSize: '0.85rem'
                            }}
                          >
                            Send on Mission
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <select
                              value={sendFormData.activity_type}
                              onChange={e => setSendFormData(prev => ({ ...prev, activity_type: e.target.value }))}
                              style={{
                                padding: '0.4rem', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                                color: '#ddd', fontSize: '0.85rem'
                              }}
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
                              style={{
                                padding: '0.4rem', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                                color: '#ddd', fontSize: '0.85rem'
                              }}
                            />
                            <input
                              placeholder="Description (optional)"
                              value={sendFormData.description}
                              onChange={e => setSendFormData(prev => ({ ...prev, description: e.target.value }))}
                              style={{
                                padding: '0.4rem', background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                                color: '#ddd', fontSize: '0.85rem'
                              }}
                            />
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <label style={{ color: '#888', fontSize: '0.8rem' }}>Days:</label>
                              <input
                                type="number" min="1" max="30"
                                value={sendFormData.duration_days}
                                onChange={e => setSendFormData(prev => ({ ...prev, duration_days: parseInt(e.target.value) || 3 }))}
                                style={{
                                  width: '60px', padding: '0.4rem', background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                                  color: '#ddd', fontSize: '0.85rem'
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                onClick={() => {
                                  onSendActivity(companion.id, sendFormData);
                                  setShowSendForm(false);
                                  setSendFormData({ activity_type: 'training', description: '', location: '', duration_days: 3 });
                                }}
                                style={{
                                  flex: 1, padding: '0.5rem', background: 'rgba(34, 197, 94, 0.2)',
                                  border: '1px solid rgba(34, 197, 94, 0.4)', borderRadius: '4px',
                                  color: '#22c55e', cursor: 'pointer', fontSize: '0.85rem'
                                }}
                              >
                                Send
                              </button>
                              <button
                                onClick={() => setShowSendForm(false)}
                                style={{
                                  flex: 1, padding: '0.5rem', background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                                  color: '#888', cursor: 'pointer', fontSize: '0.85rem'
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Away on Mission Section */}
            {awayCompanions.length > 0 && (
              <div style={{
                borderTop: '1px solid rgba(255, 159, 67, 0.3)',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 159, 67, 0.05)'
              }}>
                <h5 style={{ margin: '0 0 0.5rem 0', color: '#ff9f43', fontSize: '0.85rem' }}>
                  Away on Mission ({awayCompanions.length})
                </h5>
                {awayCompanions.map(ac => (
                  <div key={ac.companion_id} style={{
                    padding: '0.5rem',
                    marginBottom: '0.5rem',
                    background: 'rgba(255, 159, 67, 0.1)',
                    border: '1px solid rgba(255, 159, 67, 0.2)',
                    borderRadius: '6px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <strong style={{ color: '#ff9f43' }}>{ac.name}</strong>
                      {onRecallCompanion && ac.activity_id && (
                        <button
                          onClick={() => onRecallCompanion(ac.activity_id)}
                          style={{
                            padding: '0.2rem 0.5rem', background: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.4)', borderRadius: '4px',
                            color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem'
                          }}
                        >
                          Recall
                        </button>
                      )}
                    </div>
                    <div style={{ color: '#ccc', marginTop: '0.25rem' }}>
                      {ac.activity_type?.replace('_', ' ')}{ac.location ? ` at ${ac.location}` : ''}
                    </div>
                    {ac.expected_duration_days && (
                      <div style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.15rem' }}>
                        ~{ac.expected_duration_days} day mission
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Panel Footer */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0, 0, 0, 0.2)',
              fontSize: '0.8rem',
              color: '#888'
            }}>
              {companions.length} companion{companions.length !== 1 ? 's' : ''} in party
              {awayCompanions.length > 0 && ` · ${awayCompanions.length} away`}
            </div>
          </div>
  );
}

export default CompanionsPanel;
