import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#3b82f6';

const STATUS_COLORS = {
  ongoing: '#eab308',
  new: '#22c55e',
  resolved: '#6b7280',
  abandoned: '#ef4444'
};

const PRESET_TAGS = ['main quest', 'side quest', 'mystery', 'faction', 'personal', 'political', 'combat', 'exploration'];

export default function PlotThreadPanel({ partyId, onClose }) {
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newThread, setNewThread] = useState({ threadName: '', details: '', status: 'ongoing', tags: [] });
  const [editingTags, setEditingTags] = useState(null); // thread ID being edited
  const [customTag, setCustomTag] = useState('');

  const loadThreads = useCallback(async () => {
    try {
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const res = await fetch(`/api/dm-mode/plot-threads/${partyId}${params}`);
      if (res.ok) setThreads(await res.json());
    } catch (err) {
      console.error('Failed to load threads:', err);
    } finally {
      setLoading(false);
    }
  }, [partyId, filter]);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  const handleStatusChange = async (threadId, status) => {
    try {
      const res = await fetch(`/api/dm-mode/plot-thread/${threadId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        const updated = await res.json();
        setThreads(prev => prev.map(t => t.id === threadId ? updated : t));
      }
    } catch (err) {
      console.error('Status update error:', err);
    }
  };

  const handleTagToggle = async (threadId, tag) => {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;
    const tags = Array.isArray(thread.tags) ? thread.tags : [];
    const newTags = tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag];

    try {
      const res = await fetch(`/api/dm-mode/plot-thread/${threadId}/tags`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags })
      });
      if (res.ok) {
        const updated = await res.json();
        setThreads(prev => prev.map(t => t.id === threadId ? updated : t));
      }
    } catch (err) {
      console.error('Tag update error:', err);
    }
  };

  const handleAddCustomTag = async (threadId) => {
    if (!customTag.trim()) return;
    await handleTagToggle(threadId, customTag.trim().toLowerCase());
    setCustomTag('');
  };

  const handleCreate = async () => {
    if (!newThread.threadName.trim()) return;
    try {
      const res = await fetch(`/api/dm-mode/plot-threads/${partyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newThread)
      });
      if (res.ok) {
        const created = await res.json();
        setThreads(prev => [{ ...created, tags: JSON.parse(created.tags || '[]') }, ...prev]);
        setNewThread({ threadName: '', details: '', status: 'ongoing', tags: [] });
        setShowAddForm(false);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create thread');
      }
    } catch (err) {
      console.error('Create thread error:', err);
    }
  };

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
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>Plot Threads</h3>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: '0.2rem 0.5rem',
              background: showAddForm ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${ACCENT}44`,
              borderRadius: '3px',
              color: ACCENT,
              cursor: 'pointer',
              fontSize: '0.75rem'
            }}
          >{showAddForm ? 'Cancel' : '+ Add'}</button>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
          >&times;</button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
          <input
            type="text"
            placeholder="Thread name..."
            value={newThread.threadName}
            onChange={e => setNewThread(prev => ({ ...prev, threadName: e.target.value }))}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd',
              fontSize: '0.8rem', marginBottom: '0.4rem', outline: 'none', boxSizing: 'border-box'
            }}
          />
          <textarea
            placeholder="Details (optional)..."
            value={newThread.details}
            onChange={e => setNewThread(prev => ({ ...prev, details: e.target.value }))}
            rows={2}
            style={{
              width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd',
              fontSize: '0.8rem', marginBottom: '0.4rem', outline: 'none', resize: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box'
            }}
          />
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            {PRESET_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setNewThread(prev => ({
                  ...prev,
                  tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag]
                }))}
                style={{
                  padding: '0.1rem 0.4rem',
                  background: newThread.tags.includes(tag) ? `${ACCENT}22` : 'transparent',
                  border: `1px solid ${newThread.tags.includes(tag) ? ACCENT : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '3px',
                  color: newThread.tags.includes(tag) ? ACCENT : '#888',
                  cursor: 'pointer',
                  fontSize: '0.65rem'
                }}
              >{tag}</button>
            ))}
          </div>
          <button
            onClick={handleCreate}
            disabled={!newThread.threadName.trim()}
            style={{
              width: '100%', padding: '0.35rem', background: newThread.threadName.trim() ? ACCENT : 'rgba(255,255,255,0.1)',
              border: 'none', borderRadius: '4px', color: '#fff', cursor: newThread.threadName.trim() ? 'pointer' : 'default',
              fontSize: '0.8rem', fontWeight: 'bold'
            }}
          >Create Thread</button>
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.3rem', padding: '0.5rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {['all', 'ongoing', 'new', 'resolved', 'abandoned'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '0.15rem 0.5rem',
              background: filter === f ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${filter === f ? ACCENT : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '3px',
              color: filter === f ? ACCENT : '#888',
              cursor: 'pointer',
              fontSize: '0.7rem',
              textTransform: 'capitalize'
            }}
          >{f}</button>
        ))}
      </div>

      {/* Thread List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 1rem' }}>
        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Loading...</div>
        ) : threads.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>&#128220;</div>
            <div style={{ fontSize: '0.85rem' }}>No plot threads tracked yet.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#555' }}>
              Threads are tracked automatically from sessions, or add one manually.
            </div>
          </div>
        ) : (
          threads.map(thread => {
            const tags = Array.isArray(thread.tags) ? thread.tags : [];
            const statusColor = STATUS_COLORS[thread.status] || '#888';
            const isEditingTags = editingTags === thread.id;

            return (
              <div key={thread.id} style={{
                padding: '0.6rem 0.75rem',
                marginBottom: '0.5rem',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid rgba(255,255,255,0.08)`,
                borderLeft: `3px solid ${statusColor}`,
                borderRadius: '0 6px 6px 0'
              }}>
                {/* Title & Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                  <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.85rem', flex: 1 }}>
                    {thread.thread_name}
                  </span>
                  <select
                    value={thread.status}
                    onChange={e => handleStatusChange(thread.id, e.target.value)}
                    style={{
                      padding: '0.1rem 0.3rem',
                      background: `${statusColor}15`,
                      border: `1px solid ${statusColor}40`,
                      borderRadius: '3px',
                      color: statusColor,
                      fontSize: '0.65rem',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  >
                    <option value="ongoing">ongoing</option>
                    <option value="new">new</option>
                    <option value="resolved">resolved</option>
                    <option value="abandoned">abandoned</option>
                  </select>
                </div>

                {/* Details */}
                {thread.details && (
                  <div style={{ color: '#aaa', fontSize: '0.78rem', marginTop: '0.3rem', lineHeight: '1.4' }}>
                    {thread.details}
                  </div>
                )}

                {/* Tags */}
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.35rem', alignItems: 'center' }}>
                  {tags.map(tag => (
                    <span key={tag} style={{
                      padding: '0.08rem 0.35rem',
                      background: `${ACCENT}15`,
                      border: `1px solid ${ACCENT}30`,
                      borderRadius: '3px',
                      color: ACCENT,
                      fontSize: '0.6rem'
                    }}>{tag}</span>
                  ))}
                  <button
                    onClick={() => setEditingTags(isEditingTags ? null : thread.id)}
                    style={{
                      padding: '0.05rem 0.3rem',
                      background: 'transparent',
                      border: `1px dashed ${isEditingTags ? ACCENT : 'rgba(255,255,255,0.15)'}`,
                      borderRadius: '3px',
                      color: isEditingTags ? ACCENT : '#666',
                      cursor: 'pointer',
                      fontSize: '0.6rem'
                    }}
                  >{isEditingTags ? 'done' : '+ tag'}</button>
                </div>

                {/* Tag Editor */}
                {isEditingTags && (
                  <div style={{ marginTop: '0.4rem', padding: '0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.3rem' }}>
                      {PRESET_TAGS.map(tag => (
                        <button
                          key={tag}
                          onClick={() => handleTagToggle(thread.id, tag)}
                          style={{
                            padding: '0.1rem 0.35rem',
                            background: tags.includes(tag) ? `${ACCENT}22` : 'transparent',
                            border: `1px solid ${tags.includes(tag) ? ACCENT : 'rgba(255,255,255,0.15)'}`,
                            borderRadius: '3px',
                            color: tags.includes(tag) ? ACCENT : '#888',
                            cursor: 'pointer',
                            fontSize: '0.6rem'
                          }}
                        >{tag}</button>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <input
                        type="text"
                        placeholder="Custom tag..."
                        value={customTag}
                        onChange={e => setCustomTag(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddCustomTag(thread.id)}
                        style={{
                          flex: 1, padding: '0.2rem 0.4rem', background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                          color: '#ddd', fontSize: '0.65rem', outline: 'none'
                        }}
                      />
                      <button
                        onClick={() => handleAddCustomTag(thread.id)}
                        style={{
                          padding: '0.2rem 0.4rem', background: ACCENT, border: 'none',
                          borderRadius: '3px', color: '#fff', cursor: 'pointer', fontSize: '0.6rem'
                        }}
                      >Add</button>
                    </div>
                  </div>
                )}

                {/* Meta */}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem', fontSize: '0.6rem', color: '#555' }}>
                  {thread.first_seen_session && <span>First seen: S{thread.first_seen_session}</span>}
                  {thread.resolved_session && <span>Resolved: S{thread.resolved_session}</span>}
                  <span style={{ marginLeft: 'auto', fontStyle: 'italic' }}>{thread.source}</span>
                </div>
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
        {threads.length} thread{threads.length !== 1 ? 's' : ''} tracked
      </div>
    </div>
  );
}
