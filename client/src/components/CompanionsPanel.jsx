import { useState } from 'react';

function CompanionsPanel({ companions, onClose }) {
  const [selectedCompanionIdx, setSelectedCompanionIdx] = useState(0);

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
                  </>
                );
              })()}
            </div>

            {/* Panel Footer */}
            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0, 0, 0, 0.2)',
              fontSize: '0.8rem',
              color: '#888'
            }}>
              {companions.length} companion{companions.length !== 1 ? 's' : ''} in party
            </div>
          </div>
  );
}

export default CompanionsPanel;
