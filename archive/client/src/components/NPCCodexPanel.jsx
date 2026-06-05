import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#e74c3c';

const STATUS_COLORS = {
  alive: '#10b981',
  dead: '#ef4444',
  missing: '#f59e0b',
  unknown: '#6b7280'
};

const DISPOSITION_COLORS = {
  friendly: '#10b981',
  neutral: '#6b7280',
  wary: '#f59e0b',
  hostile: '#ef4444'
};

const EMPTY_NPC = {
  name: '', role: '', description: '', location: '', race: '',
  class_profession: '', age_description: '', personality: '',
  status: 'alive', disposition: 'neutral', connections: '', voice_notes: ''
};

function NpcEditForm({ data, onChange, accent }) {
  const field = (label, key, opts = {}) => (
    <div style={{ marginBottom: '0.4rem' }}>
      <label style={{ color: '#888', fontSize: '0.65rem', display: 'block', marginBottom: '0.15rem' }}>{label}</label>
      {opts.type === 'select' ? (
        <select
          value={data[key] || ''}
          onChange={e => onChange({ ...data, [key]: e.target.value })}
          style={{
            width: '100%', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${accent}33`, borderRadius: '4px', color: '#ddd',
            fontSize: '0.8rem', outline: 'none'
          }}
        >
          {opts.options.map(o => <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>)}
        </select>
      ) : opts.type === 'textarea' ? (
        <textarea
          value={data[key] || ''}
          onChange={e => onChange({ ...data, [key]: e.target.value })}
          rows={2}
          style={{
            width: '100%', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${accent}33`, borderRadius: '4px', color: '#ddd',
            fontSize: '0.8rem', outline: 'none', resize: 'vertical', boxSizing: 'border-box'
          }}
        />
      ) : (
        <input
          type="text"
          value={data[key] || ''}
          onChange={e => onChange({ ...data, [key]: e.target.value })}
          placeholder={opts.placeholder || ''}
          style={{
            width: '100%', padding: '0.3rem 0.4rem', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${accent}33`, borderRadius: '4px', color: '#ddd',
            fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box'
          }}
        />
      )}
    </div>
  );

  return (
    <div>
      {field('Name *', 'name', { placeholder: 'NPC name' })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field('Race', 'race', { placeholder: 'Human, Elf, Dwarf...' })}
        {field('Age', 'age_description', { placeholder: 'Young, Middle-aged...' })}
      </div>
      {field('Class / Profession', 'class_profession', { placeholder: 'Blacksmith, Guard Captain...' })}
      {field('Role in Story', 'role', { placeholder: 'Quest giver, merchant...' })}
      {field('Location', 'location', { placeholder: 'Where they reside or were met' })}
      {field('Personality', 'personality', { placeholder: 'Gruff but kind, suspicious...' })}
      {field('Description', 'description', { type: 'textarea' })}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem' }}>
        {field('Status', 'status', { type: 'select', options: ['alive', 'dead', 'missing', 'unknown'] })}
        {field('Disposition', 'disposition', { type: 'select', options: ['friendly', 'neutral', 'wary', 'hostile'] })}
      </div>
      {field('Connections', 'connections', { placeholder: 'Brother of Tormund, works for the guild...' })}
      {field('Voice Notes', 'voice_notes', { type: 'textarea' })}
      {field('Session Encountered', 'first_seen_session', { placeholder: 'Session number when first met' })}
    </div>
  );
}

export default function NPCCodexPanel({ partyId, onClose }) {
  const [npcs, setNpcs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('name');
  const [expandedId, setExpandedId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newNpc, setNewNpc] = useState({ ...EMPTY_NPC });

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

  const handleSave = async () => {
    if (!editData || !editingId) return;
    try {
      const payload = { ...editData };
      if (payload.first_seen_session) payload.first_seen_session = parseInt(payload.first_seen_session, 10) || null;
      else payload.first_seen_session = null;
      const res = await fetch(`/api/dm-mode/npcs/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        updated.sessions_appeared = typeof updated.sessions_appeared === 'string'
          ? JSON.parse(updated.sessions_appeared) : updated.sessions_appeared || [];
        setNpcs(prev => prev.map(n => n.id === updated.id ? updated : n));
        setEditingId(null);
        setEditData(null);
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleCreate = async () => {
    if (!newNpc.name?.trim()) return;
    try {
      const res = await fetch(`/api/dm-mode/npcs/${partyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newNpc)
      });
      if (res.ok) {
        const created = await res.json();
        created.sessions_appeared = [];
        setNpcs(prev => [...prev, created]);
        setCreating(false);
        setNewNpc({ ...EMPTY_NPC });
        setExpandedId(created.id);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create NPC');
      }
    } catch (err) {
      console.error('Create error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this NPC from the codex?')) return;
    try {
      await fetch(`/api/dm-mode/npcs/${id}`, { method: 'DELETE' });
      setNpcs(prev => prev.filter(n => n.id !== id));
      if (expandedId === id) setExpandedId(null);
      if (editingId === id) { setEditingId(null); setEditData(null); }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const startEdit = (npc) => {
    setEditingId(npc.id);
    setEditData({
      name: npc.name, role: npc.role || '', description: npc.description || '',
      location: npc.location || '', race: npc.race || '',
      class_profession: npc.class_profession || '', age_description: npc.age_description || '',
      personality: npc.personality || '', status: npc.status || 'alive',
      disposition: npc.disposition || 'neutral', connections: npc.connections || '',
      voice_notes: npc.voice_notes || '', first_seen_session: npc.first_seen_session || ''
    });
    setExpandedId(npc.id);
  };

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: '420px', maxWidth: '90vw', height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: `1px solid ${ACCENT}44`, boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem', borderBottom: `1px solid ${ACCENT}33`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>NPC Codex</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => { setCreating(!creating); setEditingId(null); setEditData(null); }}
            style={{
              padding: '0.25rem 0.6rem', background: creating ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${ACCENT}66`, borderRadius: '4px', color: ACCENT,
              cursor: 'pointer', fontSize: '0.75rem'
            }}
          >{creating ? 'Cancel' : '+ New NPC'}</button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
          >&times;</button>
        </div>
      </div>

      {/* Create Form */}
      {creating && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: `1px solid ${ACCENT}33`, background: 'rgba(231,76,60,0.05)' }}>
          <div style={{ color: ACCENT, fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.4rem' }}>New NPC</div>
          <NpcEditForm data={newNpc} onChange={setNewNpc} accent={ACCENT} />
          <button
            onClick={handleCreate}
            disabled={!newNpc.name?.trim()}
            style={{
              marginTop: '0.4rem', padding: '0.35rem 1rem', background: ACCENT,
              border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer',
              fontSize: '0.8rem', opacity: newNpc.name?.trim() ? 1 : 0.5
            }}
          >Create NPC</button>
        </div>
      )}

      {/* Search & Sort */}
      <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder="Search NPCs..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd',
            fontSize: '0.8rem', marginBottom: '0.4rem', outline: 'none', boxSizing: 'border-box'
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
                borderRadius: '3px', color: sort === s ? ACCENT : '#888',
                cursor: 'pointer', fontSize: '0.7rem', textTransform: 'capitalize'
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
            <div style={{ fontSize: '0.85rem' }}>No NPCs yet.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#555' }}>
              NPCs are tracked automatically from sessions, or create one manually above.
            </div>
          </div>
        ) : (
          npcs.map(npc => {
            const sessions = Array.isArray(npc.sessions_appeared) ? npc.sessions_appeared : [];
            const isExpanded = expandedId === npc.id;
            const isEditing = editingId === npc.id;

            return (
              <div key={npc.id} style={{
                padding: '0.6rem 0.75rem', marginBottom: '0.5rem',
                background: isExpanded ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${isExpanded ? `${ACCENT}33` : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px'
              }}>
                {/* Header row — always visible */}
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer' }}
                  onClick={() => { if (!isEditing) setExpandedId(isExpanded ? null : npc.id); }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <span style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.9rem' }}>{npc.name}</span>
                      {npc.status && npc.status !== 'alive' && (
                        <span style={{
                          padding: '0.05rem 0.35rem', background: `${STATUS_COLORS[npc.status]}22`,
                          border: `1px solid ${STATUS_COLORS[npc.status]}44`, borderRadius: '3px',
                          color: STATUS_COLORS[npc.status], fontSize: '0.6rem', textTransform: 'uppercase'
                        }}>{npc.status}</span>
                      )}
                      {npc.disposition && npc.disposition !== 'neutral' && (
                        <span style={{
                          padding: '0.05rem 0.35rem', background: `${DISPOSITION_COLORS[npc.disposition]}22`,
                          border: `1px solid ${DISPOSITION_COLORS[npc.disposition]}44`, borderRadius: '3px',
                          color: DISPOSITION_COLORS[npc.disposition], fontSize: '0.6rem'
                        }}>{npc.disposition}</span>
                      )}
                    </div>
                    {/* Quick info line */}
                    <div style={{ color: '#999', fontSize: '0.75rem', marginTop: '0.1rem' }}>
                      {[npc.race, npc.age_description, npc.class_profession || npc.role].filter(Boolean).join(' · ') || npc.role || ''}
                    </div>
                    {npc.location && (
                      <div style={{ color: '#7ab', fontSize: '0.7rem', marginTop: '0.1rem' }}>
                        {npc.location}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.2rem', flexShrink: 0, marginLeft: '0.5rem' }}>
                    {sessions.map(s => (
                      <span key={s} style={{
                        padding: '0.1rem 0.3rem', background: `${ACCENT}15`,
                        border: `1px solid ${ACCENT}30`, borderRadius: '3px',
                        color: ACCENT, fontSize: '0.6rem'
                      }}>S{s}</span>
                    ))}
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && !isEditing && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    {npc.personality && (
                      <div style={{ color: '#ccc', fontSize: '0.8rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#888', fontSize: '0.7rem' }}>Personality: </span>{npc.personality}
                      </div>
                    )}
                    {npc.description && (
                      <div style={{ color: '#bbb', fontSize: '0.8rem', marginBottom: '0.3rem', lineHeight: '1.4' }}>
                        {npc.description}
                      </div>
                    )}
                    {npc.connections && (
                      <div style={{ color: '#a8b', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#888', fontSize: '0.7rem' }}>Connections: </span>{npc.connections}
                      </div>
                    )}
                    {npc.first_seen_session != null && (
                      <div style={{ color: '#7ab', fontSize: '0.75rem', marginBottom: '0.3rem' }}>
                        <span style={{ color: '#888', fontSize: '0.7rem' }}>First Encountered: </span>Session {npc.first_seen_session}
                      </div>
                    )}
                    {npc.voice_notes && (
                      <div style={{
                        color: '#d4af37', fontSize: '0.75rem', marginTop: '0.3rem',
                        padding: '0.35rem 0.5rem', background: 'rgba(212,175,55,0.08)',
                        borderRadius: '4px', lineHeight: '1.5', whiteSpace: 'pre-wrap'
                      }}>
                        {npc.voice_notes}
                      </div>
                    )}
                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(npc); }}
                        style={{
                          padding: '0.2rem 0.6rem', background: 'transparent',
                          border: `1px solid ${ACCENT}44`, borderRadius: '3px',
                          color: ACCENT, cursor: 'pointer', fontSize: '0.7rem'
                        }}
                      >Edit</button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(npc.id); }}
                        style={{
                          padding: '0.2rem 0.6rem', background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                          color: '#888', cursor: 'pointer', fontSize: '0.7rem'
                        }}
                      >Delete</button>
                    </div>
                  </div>
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <div style={{ marginTop: '0.5rem', paddingTop: '0.4rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <NpcEditForm data={editData} onChange={setEditData} accent={ACCENT} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
                      <button
                        onClick={handleSave}
                        style={{
                          padding: '0.3rem 0.8rem', background: ACCENT,
                          border: 'none', borderRadius: '4px', color: '#fff',
                          cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >Save</button>
                      <button
                        onClick={() => { setEditingId(null); setEditData(null); }}
                        style={{
                          padding: '0.3rem 0.8rem', background: 'transparent',
                          border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px',
                          color: '#888', cursor: 'pointer', fontSize: '0.75rem'
                        }}
                      >Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#555', fontSize: '0.7rem', textAlign: 'center', flexShrink: 0
      }}>
        {npcs.length} NPC{npcs.length !== 1 ? 's' : ''} tracked
      </div>
    </div>
  );
}
