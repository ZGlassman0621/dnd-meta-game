/**
 * MerchantRelationshipsPanel (M4) — slide-in panel that surfaces the merchant-
 * memory data the system has been quietly tracking since migration 011.
 * One card per merchant the character has transacted with: visit count,
 * gold spent, loyalty discount tier, disposition, player-authored notes,
 * and a favorite pin.
 */
import React, { useState, useEffect } from 'react';

const DISPOSITION_COLOR = {
  hostile: '#dc2626',
  unfriendly: '#f97316',
  neutral: '#9ca3af',
  friendly: '#60a5fa',
  allied: '#34d399'
};

function formatCoins(cp) {
  const gp = Math.floor((cp || 0) / 100);
  const sp = Math.floor(((cp || 0) % 100) / 10);
  const cpLeft = (cp || 0) % 10;
  const parts = [];
  if (gp) parts.push(`${gp}gp`);
  if (sp) parts.push(`${sp}sp`);
  if (cpLeft) parts.push(`${cpLeft}cp`);
  return parts.length > 0 ? parts.join(' ') : '0gp';
}

export default function MerchantRelationshipsPanel({ character, currentGameDay, onClose }) {
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [editingNotes, setEditingNotes] = useState({}); // merchant_id → current edit buffer

  const refetch = async () => {
    if (!character?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/merchant/relationships/character/${character.id}`);
      if (!r.ok) return;
      const data = await r.json();
      setRelationships(data.relationships || []);
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

  const toggleFavorite = async (rel) => {
    try {
      const r = await fetch(`/api/merchant/relationships/${rel.merchant_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, favorited: !rel.favorited })
      });
      if (r.ok) refetch();
    } catch (e) { setError(e.message); }
  };

  const saveNotes = async (rel) => {
    const buf = editingNotes[rel.merchant_id];
    if (buf === undefined) return;
    try {
      const r = await fetch(`/api/merchant/relationships/${rel.merchant_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id, notes: buf })
      });
      if (r.ok) {
        setEditingNotes(prev => { const n = { ...prev }; delete n[rel.merchant_id]; return n; });
        refetch();
      }
    } catch (e) { setError(e.message); }
  };

  const renderCard = (rel) => {
    const daysSinceVisit = currentGameDay != null && rel.last_visit_game_day != null
      ? currentGameDay - rel.last_visit_game_day
      : null;
    const isEditing = editingNotes[rel.merchant_id] !== undefined;
    const dispoColor = DISPOSITION_COLOR[rel.disposition] || '#6b7280';

    return (
      <div
        key={rel.merchant_id}
        style={{
          padding: '0.75rem',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${rel.favorited ? '#d4af37' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '6px',
          marginBottom: '0.5rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.35rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: '#ddd', fontWeight: 600, fontSize: '0.95rem' }}>{rel.merchant_name}</div>
            <div style={{ color: '#888', fontSize: '0.75rem' }}>
              {rel.merchant_type}{rel.location ? ` · ${rel.location}` : ''}
            </div>
          </div>
          <button
            onClick={() => toggleFavorite(rel)}
            style={{
              background: 'transparent',
              border: 'none',
              color: rel.favorited ? '#d4af37' : '#555',
              fontSize: '1.2rem',
              cursor: 'pointer',
              padding: '0 0.3rem'
            }}
            title={rel.favorited ? 'Unfavorite' : 'Favorite this merchant'}
          >★</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.72rem', marginBottom: '0.4rem' }}>
          {rel.disposition && (
            <span style={{
              background: dispoColor + '22', border: `1px solid ${dispoColor}`,
              color: dispoColor, padding: '1px 6px', borderRadius: '8px'
            }}>
              {rel.disposition}
            </span>
          )}
          {rel.loyalty_discount_percent > 0 && (
            <span style={{
              background: 'rgba(212,175,55,0.15)', border: '1px solid #d4af37',
              color: '#d4af37', padding: '1px 6px', borderRadius: '8px'
            }}>
              Loyalty: -{rel.loyalty_discount_percent}%
            </span>
          )}
          <span style={{ color: '#aaa' }}>
            {rel.visit_count} visit{rel.visit_count === 1 ? '' : 's'}
          </span>
          {daysSinceVisit != null && (
            <span style={{ color: '#888' }}>
              last visit: {daysSinceVisit === 0 ? 'today' : `${daysSinceVisit} day${daysSinceVisit === 1 ? '' : 's'} ago`}
            </span>
          )}
        </div>

        {(rel.total_spent_cp > 0 || rel.total_earned_cp > 0) && (
          <div style={{ fontSize: '0.72rem', color: '#888', marginBottom: '0.4rem' }}>
            {rel.total_spent_cp > 0 && <>Spent: <strong style={{ color: '#f59e0b' }}>{formatCoins(rel.total_spent_cp)}</strong> · </>}
            {rel.total_earned_cp > 0 && <>Earned: <strong style={{ color: '#34d399' }}>{formatCoins(rel.total_earned_cp)}</strong></>}
          </div>
        )}

        {/* Notes */}
        {isEditing ? (
          <div>
            <textarea
              value={editingNotes[rel.merchant_id]}
              onChange={(e) => setEditingNotes(prev => ({ ...prev, [rel.merchant_id]: e.target.value }))}
              placeholder="Notes (what they carry, quirks, rumors, etc.)"
              style={{
                width: '100%', minHeight: '60px', padding: '0.4rem',
                background: '#1a1a1a', border: '1px solid #444',
                borderRadius: '4px', color: '#fff', fontSize: '0.8rem',
                fontFamily: 'inherit', resize: 'vertical'
              }}
            />
            <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.25rem' }}>
              <button
                onClick={() => saveNotes(rel)}
                style={{
                  padding: '0.25rem 0.7rem', background: '#6495ed', color: '#fff',
                  border: 'none', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer'
                }}
              >Save</button>
              <button
                onClick={() => setEditingNotes(prev => { const n = { ...prev }; delete n[rel.merchant_id]; return n; })}
                style={{
                  padding: '0.25rem 0.7rem', background: 'transparent', color: '#888',
                  border: '1px solid #444', borderRadius: '4px', fontSize: '0.72rem', cursor: 'pointer'
                }}
              >Cancel</button>
            </div>
          </div>
        ) : (
          <div
            onClick={() => setEditingNotes(prev => ({ ...prev, [rel.merchant_id]: rel.notes || '' }))}
            style={{
              padding: '0.35rem 0.5rem',
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed rgba(255,255,255,0.08)',
              borderRadius: '4px',
              fontSize: '0.78rem',
              color: rel.notes ? '#bbb' : '#555',
              fontStyle: rel.notes ? 'normal' : 'italic',
              cursor: 'pointer',
              whiteSpace: 'pre-wrap'
            }}
          >
            {rel.notes || 'Click to add notes…'}
          </div>
        )}
      </div>
    );
  };

  const favorites = relationships.filter(r => r.favorited);
  const others = relationships.filter(r => !r.favorited);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '440px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: '1px solid rgba(212, 175, 55, 0.3)',
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
        <h3 style={{ margin: 0, color: '#d4af37' }}>Merchants</h3>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {loading && relationships.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>Loading…</p>
        ) : relationships.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            No merchant relationships yet. Complete a transaction with any merchant to populate this list.
          </p>
        ) : (
          <>
            {favorites.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  color: '#d4af37', fontSize: '0.72rem', fontWeight: 'bold',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '0.4rem', paddingBottom: '0.25rem',
                  borderBottom: '1px solid rgba(212,175,55,0.2)'
                }}>
                  ★ Favorites ({favorites.length})
                </div>
                {favorites.map(renderCard)}
              </div>
            )}
            {others.length > 0 && (
              <div>
                <div style={{
                  color: '#888', fontSize: '0.72rem', fontWeight: 'bold',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '0.4rem', paddingBottom: '0.25rem',
                  borderBottom: '1px solid rgba(255,255,255,0.08)'
                }}>
                  All Merchants ({others.length})
                </div>
                {others.map(renderCard)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
