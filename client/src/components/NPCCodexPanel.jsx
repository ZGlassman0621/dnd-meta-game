import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#e74c3c';

export default function NPCCodexPanel({ partyId, onClose }) {
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [expandedVoice, setExpandedVoice] = useState(null);

  const loadNpcs = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (sort) params.set('sort', sort);
      const res = await fetch(`/api/dm-mode/npcs/${partyId}?${params}`);
      if (res.ok) setNpcs(await res.json());
    } catch (err) {
      console.error('Failed to load NPCs:', err);
    } finally {
      setLoading(false);
    }
  }, [partyId, search, sort]);

  useEffect(() => { loadNpcs(); }, [loadNpcs]);

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
        borderBottom: `1px solid ${ACCENT}33`,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0
      }}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>NPC Codex</h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
        >&times;</button>
      </div>

      {/* Search & Sort */}
      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search NPCs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '0.4rem 0.6rem',
            background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${ACCENT}33`,
            borderRadius: '4px',
            color: '#ddd',
            fontSize: '0.8rem',
            marginBottom: '0.4rem',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {['name', 'frequency', 'recency'].map(s => (
            <button
              key={s}
              onClick={() => setSort(s)}
              style={{
                padding: '0.15rem 0.5rem',
                background: sort === s ? `${ACCENT}22` : 'transparent',
                border: `1px solid ${sort === s ? ACCENT : 'rgba(255,255,255,0.15)'}`,
                borderRadius: '3px',
                color: sort === s ? ACCENT : '#888',
                cursor: 'pointer',
                fontSize: '0.7rem',
                textTransform: 'capitalize'
              }}
            >{s}</button>
          ))}
        </div>
      </div>

      {/* NPC List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Loading...</div>
        ) : npcs.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>&#128214;</div>
            <div style={{ fontSize: '0.85rem' }}>No NPCs encountered yet.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#555' }}>
              NPCs will be tracked automatically when you end a session.
            </div>
          </div>
        ) : (
          npcs.map(npc => {
            const sessions = Array.isArray(npc.sessions_appeared) ? npc.sessions_appeared : [];
            const isVoiceExpanded = expandedVoice === npc.id;

            return (
              <div key={npc.id} style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '6px'
              }}>
                {/* Name & Role */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.9rem' }}>{npc.name}</span>
                    {npc.role && (
                      <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.1rem' }}>{npc.role}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0 }}>
                    {sessions.map(s => (
                      <span key={s} style={{
                        padding: '0.1rem 0.3rem',
                        background: `${ACCENT}15`,
                        border: `1px solid ${ACCENT}30`,
                        borderRadius: '3px',
                        color: ACCENT,
                        fontSize: '0.6rem'
                      }}>S{s}</span>
                    ))}
                  </div>
                </div>

                {/* Description */}
                {npc.description && (
                  <div style={{ color: '#bbb', fontSize: '0.8rem', marginTop: '0.35rem', lineHeight: '1.4' }}>
                    {npc.description}
                  </div>
                )}

                {/* Voice Notes */}
                {npc.voice_notes && (
                  <div style={{ marginTop: '0.35rem' }}>
                    <button
                      onClick={() => setExpandedVoice(isVoiceExpanded ? null : npc.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#d4af37',
                        cursor: 'pointer',
                        fontSize: '0.7rem',
                        padding: 0,
                        fontStyle: 'italic'
                      }}
                    >
                      {isVoiceExpanded ? 'Hide voice notes' : 'Show voice notes'}
                    </button>
                    {isVoiceExpanded && (
                      <div style={{
                        color: '#d4af37',
                        fontSize: '0.75rem',
                        marginTop: '0.25rem',
                        padding: '0.35rem 0.5rem',
                        background: 'rgba(212,175,55,0.08)',
                        borderRadius: '4px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {npc.voice_notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#555',
        fontSize: '0.7rem',
        textAlign: 'center',
        flexShrink: 0
      }}>
        {npcs.length} NPC{npcs.length !== 1 ? 's' : ''} tracked
      </div>
    </div>
  );
}
