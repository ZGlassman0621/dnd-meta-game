import React, { useState } from 'react';

const ACCENT = '#a855f7';

const ATTITUDE_COLORS = {
  friendly: '#22c55e',
  trusting: '#22c55e',
  protective: '#3b82f6',
  respectful: '#60a5fa',
  neutral: '#eab308',
  wary: '#f97316',
  hostile: '#ef4444',
  resentful: '#ef4444',
  suspicious: '#f97316',
  admiring: '#3b82f6',
  jealous: '#f97316',
  loyal: '#22c55e',
  competitive: '#eab308'
};

function LoreItem({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div style={{ color: color || '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.15rem' }}>
        {label}
      </div>
      <div style={{ color: '#ccc', fontSize: '0.85rem', lineHeight: '1.5' }}>
        {Array.isArray(value) ? value.join(', ') : value}
      </div>
    </div>
  );
}

function LoreSection({ title, color, children }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{
        color: color || ACCENT,
        fontSize: '0.7rem',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: '0.5rem',
        paddingBottom: '0.25rem',
        borderBottom: `1px solid ${color || ACCENT}33`
      }}>
        {title}
      </div>
      {children}
    </div>
  );
}

export default function PartyLorePanel({ party, onClose }) {
  const [activeTab, setActiveTab] = useState(0);

  if (!party?.characters?.length) return null;

  const characters = party.characters;
  const char = characters[activeTab] || characters[0];
  const charColor = char.color || '#60a5fa';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: `1px solid ${ACCENT}44`,
      boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${ACCENT}15 0%, transparent 100%)`
      }}>
        <div>
          <h3 style={{ margin: 0, color: ACCENT, fontSize: '1rem' }}>
            Lore
          </h3>
          <span style={{ color: '#888', fontSize: '0.75rem' }}>
            {party.name || 'Party'} — Backstories & Bonds
          </span>
        </div>
        <button
          onClick={onClose}
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

      {/* Party Concept */}
      {party.party_concept && (
        <div style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          background: `${ACCENT}08`
        }}>
          <div style={{ color: ACCENT, fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
            How They Came Together
          </div>
          <div style={{ color: '#bbb', fontSize: '0.85rem', lineHeight: '1.5', fontStyle: 'italic' }}>
            {party.party_concept}
          </div>
        </div>
      )}

      {/* Character Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 0.25rem',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {characters.map((c, idx) => {
          const tabColor = c.color || '#60a5fa';
          const isActive = idx === activeTab;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              style={{
                flex: 1,
                padding: '0.5rem 0.4rem',
                background: isActive ? `${tabColor}15` : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
                color: isActive ? tabColor : '#888',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {c.name?.split(' ')[0] || `Char ${idx + 1}`}
            </button>
          );
        })}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* Character Identity */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ color: charColor, fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            {char.name}
          </div>
          <div style={{ color: '#999', fontSize: '0.8rem', marginBottom: '0.15rem' }}>
            {char.gender} {char.race}{char.subrace ? ` (${char.subrace})` : ''} {char.class}{char.subclass ? ` — ${char.subclass}` : ''}, Level {char.level}
          </div>
          {char.background && (
            <div style={{ color: '#777', fontSize: '0.8rem' }}>
              Background: {char.background}
            </div>
          )}
          {char.alignment && (
            <span style={{
              display: 'inline-block',
              marginTop: '0.35rem',
              padding: '0.15rem 0.5rem',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '12px',
              color: '#aaa',
              fontSize: '0.7rem'
            }}>
              {char.alignment}
            </span>
          )}
        </div>

        {/* Personality & Traits */}
        <LoreSection title="Personality & Traits" color={charColor}>
          <LoreItem label="Personality" value={char.personality_traits} color={charColor} />
          <LoreItem label="Ideals" value={char.ideals} color={charColor} />
          <LoreItem label="Bonds" value={char.bonds} color={charColor} />
          <LoreItem label="Flaws" value={char.flaws} color={charColor} />
        </LoreSection>

        {/* Drives */}
        <LoreSection title="Drives" color={charColor}>
          <LoreItem label="Motivation" value={char.motivation} color={charColor} />
          <LoreItem label="Fear" value={char.fear} color={charColor} />
        </LoreSection>

        {/* Secret — DM Eyes Only */}
        {char.secret && (
          <div style={{
            marginBottom: '1rem',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: '6px'
          }}>
            <div style={{
              color: '#ef4444',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.35rem'
            }}>
              DM Secret
            </div>
            <div style={{ color: '#ddd', fontSize: '0.85rem', lineHeight: '1.5' }}>
              {char.secret}
            </div>
          </div>
        )}

        {/* Quirks & Mannerisms */}
        {(char.quirk || char.mannerism) && (
          <LoreSection title="Quirks & Mannerisms" color={charColor}>
            <LoreItem label="Quirk" value={char.quirk} color={charColor} />
            <LoreItem label="Mannerism" value={char.mannerism} color={charColor} />
          </LoreSection>
        )}

        {/* Voice & Style */}
        {(char.voice || char.speaking_style) && (
          <LoreSection title="Voice & Style" color={charColor}>
            <LoreItem label="Voice" value={char.voice} color={charColor} />
            <LoreItem label="Speaking Style" value={char.speaking_style} color={charColor} />
          </LoreSection>
        )}

        {/* Approach */}
        {(char.combat_style || char.social_style || char.moral_tendencies) && (
          <LoreSection title="Approach" color={charColor}>
            <LoreItem label="Combat Style" value={char.combat_style} color={charColor} />
            <LoreItem label="Social Style" value={char.social_style} color={charColor} />
            <LoreItem label="Moral Tendencies" value={char.moral_tendencies} color={charColor} />
          </LoreSection>
        )}

        {/* Relationships */}
        {char.party_relationships && Object.keys(char.party_relationships).length > 0 && (
          <LoreSection title={`${char.name?.split(' ')[0]}'s Relationships`} color={charColor}>
            {Object.entries(char.party_relationships).map(([name, rel]) => {
              const attitude = rel.attitude || 'neutral';
              const warmth = rel.warmth || 0;
              const trust = rel.trust || 0;
              // Use attitude color if available, otherwise derive from warmth
              const attitudeColor = ATTITUDE_COLORS[attitude.toLowerCase()] ||
                (warmth > 0 ? '#22c55e' : warmth < 0 ? '#ef4444' : '#eab308');
              const warmthColor = warmth >= 0 ? '#22c55e' : '#ef4444';
              const trustColor = trust >= 0 ? '#3b82f6' : '#f97316';
              return (
                <div key={name} style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '6px',
                  borderLeft: `3px solid ${attitudeColor}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.85rem' }}>
                      {name.split(' ')[0]}
                    </span>
                    <span style={{
                      padding: '0.1rem 0.4rem',
                      background: `${attitudeColor}20`,
                      border: `1px solid ${attitudeColor}40`,
                      borderRadius: '10px',
                      color: attitudeColor,
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      textTransform: 'capitalize'
                    }}>
                      {attitude}
                    </span>
                    {(warmth !== 0 || trust !== 0) && (
                      <>
                        <span style={{ fontSize: '0.6rem', color: warmthColor, fontWeight: 'bold' }}>
                          W:{warmth >= 0 ? '+' : ''}{warmth}
                        </span>
                        <span style={{ fontSize: '0.6rem', color: trustColor, fontWeight: 'bold' }}>
                          T:{trust >= 0 ? '+' : ''}{trust}
                        </span>
                      </>
                    )}
                  </div>
                  {rel.tension && (
                    <div style={{ color: '#aaa', fontSize: '0.8rem', lineHeight: '1.4' }}>
                      {rel.tension}
                    </div>
                  )}
                  {rel.history && rel.history.length > 0 && (
                    <div style={{ marginTop: '0.35rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.35rem' }}>
                      {rel.history.slice(-3).map((h, i) => (
                        <div key={i} style={{ color: '#777', fontSize: '0.7rem', marginBottom: '0.1rem' }}>
                          S{h.session}: {h.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </LoreSection>
        )}

        {/* Party Tensions */}
        {party.tensions?.length > 0 && (
          <LoreSection title="Party Tensions" color="#e67e22">
            {party.tensions.map((tension, i) => (
              <div key={i} style={{
                marginBottom: '0.5rem',
                padding: '0.5rem 0.75rem',
                background: 'rgba(230, 126, 34, 0.06)',
                border: '1px solid rgba(230, 126, 34, 0.15)',
                borderRadius: '6px',
                color: '#bbb',
                fontSize: '0.8rem',
                lineHeight: '1.4'
              }}>
                {tension}
              </div>
            ))}
          </LoreSection>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.7rem',
        color: '#666',
        flexShrink: 0
      }}>
        <span>{party.setting || 'Forgotten Realms'}</span>
        <span style={{ fontStyle: 'italic' }}>{party.tone || 'heroic fantasy'}</span>
      </div>
    </div>
  );
}
