/**
 * NicknameManagerPanel — slide-in manager for a character's multi-nickname list.
 *
 * Each entry is one nickname + an audience rule describing who is allowed to
 * use it. Audience rules:
 *   default        — fallback when no other rule matches (what strangers use)
 *   friends        — NPCs whose disposition is ≥ 25 (friendly tier or higher)
 *   allied         — NPCs whose disposition is ≥ 50 (allied or closer)
 *   devoted        — NPCs whose disposition is ≥ 75 (devoted only)
 *   specific_npc   — one named NPC (pick from the character's known NPCs)
 *   role           — NPC whose occupation contains a substring (e.g. "apprentice")
 *
 * Bards override all rules — any NPC whose occupation contains "bard" can use
 * any of the character's nicknames freely. Shown in the UI as an info note.
 *
 * The panel fetches /api/character/:id/nicknames on open and calls the REST
 * CRUD endpoints for add/edit/delete. No optimistic updates — every action
 * waits for the server round-trip and refetches on success.
 */
import React, { useState, useEffect } from 'react';

const ACCENT = '#d946ef'; // fuchsia — distinct from other panel accents

const AUDIENCE_LABEL = {
  default: 'Default / strangers',
  friends: 'Friends (disposition ≥ 25)',
  allied: 'Allied or closer (≥ 50)',
  devoted: 'Devoted only (≥ 75)',
  specific_npc: 'Specific NPC',
  role: 'NPCs with a role'
};

const AUDIENCE_COLOR = {
  default: '#9ca3af',
  friends: '#60a5fa',
  allied: '#3b82f6',
  devoted: '#a855f7',
  specific_npc: '#f59e0b',
  role: '#10b981'
};

function emptyDraft() {
  return {
    nickname: '',
    audience_type: 'friends',
    audience_value: '',
    notes: ''
  };
}

export default function NicknameManagerPanel({ character, onClose }) {
  const [rows, setRows] = useState([]);
  const [knownNpcs, setKnownNpcs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState(emptyDraft());
  const [editingId, setEditingId] = useState(null);

  const refetch = async () => {
    if (!character?.id) return;
    setLoading(true);
    setError(null);
    try {
      const [nickRes, npcRes] = await Promise.all([
        fetch(`/api/character/${character.id}/nicknames`),
        fetch(`/api/npc/character/${character.id}`)
          .catch(() => null) // optional — non-fatal if endpoint absent
      ]);
      if (!nickRes.ok) throw new Error('Failed to load nicknames');
      const data = await nickRes.json();
      setRows(Array.isArray(data) ? data : []);
      if (npcRes && npcRes.ok) {
        const n = await npcRes.json();
        setKnownNpcs(Array.isArray(n) ? n : (n?.npcs || []));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character?.id]);

  const save = async () => {
    if (!draft.nickname.trim()) {
      setError('Nickname cannot be empty.');
      return;
    }
    if (draft.audience_type === 'specific_npc' && !draft.audience_value) {
      setError('Pick an NPC for this rule.');
      return;
    }
    if (draft.audience_type === 'role' && !draft.audience_value.trim()) {
      setError('Enter a role (e.g. "apprentice") for this rule.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        nickname: draft.nickname.trim(),
        audience_type: draft.audience_type,
        audience_value: draft.audience_value || null,
        notes: draft.notes || null
      };
      const url = editingId
        ? `/api/character/${character.id}/nicknames/${editingId}`
        : `/api/character/${character.id}/nicknames`;
      const method = editingId ? 'PUT' : 'POST';
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Save failed');
      setDraft(emptyDraft());
      setEditingId(null);
      await refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row) => {
    setEditingId(row.id);
    setDraft({
      nickname: row.nickname || '',
      audience_type: row.audience_type || 'friends',
      audience_value: row.audience_value || '',
      notes: row.notes || ''
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setError(null);
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this nickname rule?')) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/character/${character.id}/nicknames/${id}`, { method: 'DELETE' });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || 'Delete failed');
      }
      await refetch();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const legalName = [character?.first_name, character?.last_name].filter(Boolean).join(' ').trim()
    || character?.name || '';

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '460px',
      maxWidth: '92vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 25, 40, 0.98) 100%)',
      borderLeft: `1px solid ${ACCENT}44`,
      boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: 0, color: ACCENT }}>Names & Nicknames</h3>
          <div style={{ color: '#888', fontSize: '0.75rem', marginTop: '0.15rem' }}>
            What each NPC calls {legalName || 'this character'}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem' }}
        >×</button>
      </div>

      {error && (
        <div style={{ padding: '0.5rem 1rem', background: 'rgba(220, 38, 38, 0.15)', color: '#fca5a5', fontSize: '0.85rem' }}>
          {error}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.85rem' }}>
        {/* Bard rule-of-cool informational note */}
        <div style={{
          marginBottom: '0.9rem',
          padding: '0.55rem 0.7rem',
          background: 'rgba(217, 70, 239, 0.08)',
          border: `1px dashed ${ACCENT}55`,
          borderRadius: '6px',
          fontSize: '0.78rem',
          color: '#d8b4fe'
        }}>
          <strong>Bards ignore all rules.</strong> Any NPC whose occupation
          contains "bard" may call the character by any nickname on this list —
          rule of cool.
        </div>

        {/* Existing rows */}
        {loading ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '1rem' }}>
            No nicknames set. Add one below — for example, a short form friends use, a title strangers should default to, or a specific name one NPC calls your character.
          </p>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            {rows.map(row => {
              const audienceValueLabel = (() => {
                if (row.audience_type === 'specific_npc') {
                  const match = knownNpcs.find(n => String(n.id) === String(row.audience_value));
                  return match ? match.name : `NPC #${row.audience_value}`;
                }
                if (row.audience_type === 'role') {
                  return `"${row.audience_value}"`;
                }
                return null;
              })();
              return (
                <div
                  key={row.id}
                  style={{
                    padding: '0.6rem 0.75rem',
                    background: 'rgba(255,255,255,0.03)',
                    border: `1px solid ${AUDIENCE_COLOR[row.audience_type] || '#555'}44`,
                    borderRadius: '6px',
                    marginBottom: '0.4rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.2rem' }}>
                    <div style={{ color: '#ddd', fontWeight: 600, fontSize: '0.95rem' }}>"{row.nickname}"</div>
                    <div style={{
                      color: AUDIENCE_COLOR[row.audience_type] || '#999',
                      fontSize: '0.7rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {AUDIENCE_LABEL[row.audience_type] || row.audience_type}
                      {audienceValueLabel && ` · ${audienceValueLabel}`}
                    </div>
                  </div>
                  {row.notes && (
                    <div style={{ color: '#aaa', fontSize: '0.78rem', fontStyle: 'italic', marginBottom: '0.35rem' }}>
                      {row.notes}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      onClick={() => startEdit(row)}
                      disabled={saving}
                      style={btnSecondary(saving)}
                    >Edit</button>
                    <button
                      onClick={() => remove(row.id)}
                      disabled={saving}
                      style={btnDanger(saving)}
                    >Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add / edit form */}
        <div style={{
          padding: '0.75rem',
          background: 'rgba(255,255,255,0.02)',
          border: `1px solid ${ACCENT}33`,
          borderRadius: '6px'
        }}>
          <div style={{ color: ACCENT, fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {editingId ? 'Edit nickname' : 'Add a nickname'}
          </div>

          <label style={labelStyle}>Nickname or name form</label>
          <input
            type="text"
            value={draft.nickname}
            onChange={(e) => setDraft({ ...draft, nickname: e.target.value })}
            placeholder={'The name or form of address this rule applies to'}
            style={inputStyle}
          />

          <label style={labelStyle}>Who uses this name?</label>
          <select
            value={draft.audience_type}
            onChange={(e) => setDraft({ ...draft, audience_type: e.target.value, audience_value: '' })}
            style={inputStyle}
          >
            <option value="default">Default — strangers and everyone without a rule</option>
            <option value="friends">Friends — disposition 25+ (friendly tier)</option>
            <option value="allied">Allied or closer — disposition 50+</option>
            <option value="devoted">Devoted only — disposition 75+</option>
            <option value="specific_npc">One specific NPC</option>
            <option value="role">NPCs with a role (e.g. "apprentice")</option>
          </select>

          {draft.audience_type === 'specific_npc' && (
            <>
              <label style={labelStyle}>Which NPC?</label>
              {knownNpcs.length > 0 ? (
                <select
                  value={draft.audience_value}
                  onChange={(e) => setDraft({ ...draft, audience_value: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">Select an NPC…</option>
                  {knownNpcs.map(n => (
                    <option key={n.id} value={n.id}>{n.name}{n.occupation ? ` (${n.occupation})` : ''}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={draft.audience_value}
                  onChange={(e) => setDraft({ ...draft, audience_value: e.target.value })}
                  placeholder="Enter NPC id (or add the NPC first, then come back)"
                  style={inputStyle}
                />
              )}
            </>
          )}

          {draft.audience_type === 'role' && (
            <>
              <label style={labelStyle}>Role / occupation contains</label>
              <input
                type="text"
                value={draft.audience_value}
                onChange={(e) => setDraft({ ...draft, audience_value: e.target.value })}
                placeholder={'e.g. "apprentice", "retainer", "sergeant"'}
                style={inputStyle}
              />
              <div style={{ color: '#888', fontSize: '0.72rem', marginTop: '-0.35rem', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                Case-insensitive substring match against the NPC's occupation.
              </div>
            </>
          )}

          <label style={labelStyle}>Notes (optional)</label>
          <textarea
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
            placeholder={'Private memo — why this rule exists, when it started, etc.'}
            rows={2}
            style={{ ...inputStyle, resize: 'vertical' }}
          />

          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.6rem' }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                flex: 1,
                padding: '0.45rem 0.8rem',
                background: ACCENT,
                color: '#0a0a0a',
                border: 'none',
                borderRadius: '4px',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer'
              }}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add nickname'}
            </button>
            {editingId && (
              <button
                onClick={cancelEdit}
                disabled={saving}
                style={btnSecondary(saving)}
              >Cancel</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block',
  color: '#aaa',
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.2rem',
  marginTop: '0.55rem'
};

const inputStyle = {
  width: '100%',
  padding: '0.4rem 0.5rem',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  color: '#eee',
  fontSize: '0.85rem',
  marginBottom: '0.35rem',
  boxSizing: 'border-box'
};

function btnSecondary(disabled) {
  return {
    padding: '0.3rem 0.7rem',
    background: 'rgba(255,255,255,0.06)',
    color: '#ddd',
    border: '1px solid rgba(255,255,255,0.15)',
    borderRadius: '4px',
    fontSize: '0.78rem',
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
}

function btnDanger(disabled) {
  return {
    padding: '0.3rem 0.7rem',
    background: 'rgba(220, 38, 38, 0.12)',
    color: '#fca5a5',
    border: '1px solid rgba(220, 38, 38, 0.3)',
    borderRadius: '4px',
    fontSize: '0.78rem',
    cursor: disabled ? 'not-allowed' : 'pointer'
  };
}
