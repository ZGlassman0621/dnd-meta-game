/**
 * CommissionsPanel (M2) — slide-in panel showing all merchant commissions
 * placed by this character. Orders are grouped by status:
 *
 *   Ready for Pickup   (actionable — Collect button)
 *   In Progress        (pending — Cancel button, deposit forfeit)
 *   Delivered          (collected history)
 *   Other              (cancelled / expired)
 *
 * Characters can't place orders from this panel — that happens in-session
 * through the AI (the DM emits [MERCHANT_COMMISSION] when the player tells
 * the merchant what they want). This panel is review + action only.
 */
import React, { useState, useEffect } from 'react';

const STATUS_COLOR = {
  ready: '#34d399',
  pending: '#60a5fa',
  collected: '#9ca3af',
  cancelled: '#6b7280',
  expired: '#dc2626'
};

const STATUS_LABEL = {
  ready: 'Ready for Pickup',
  pending: 'In Progress',
  collected: 'Delivered',
  cancelled: 'Cancelled',
  expired: 'Expired'
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

export default function CommissionsPanel({ character, currentGameDay, onClose, onCharacterUpdated }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actioning, setActioning] = useState(null);
  const [error, setError] = useState(null);

  const refetch = async () => {
    if (!character?.id) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/merchant/orders/character/${character.id}`);
      if (!r.ok) return;
      const data = await r.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
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

  const collect = async (orderId) => {
    setActioning(orderId);
    setError(null);
    try {
      const r = await fetch(`/api/merchant/orders/${orderId}/collect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Collect failed');
      await refetch();
      if (onCharacterUpdated) onCharacterUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  const cancel = async (orderId) => {
    setActioning(orderId);
    setError(null);
    try {
      const r = await fetch(`/api/merchant/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterId: character.id })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Cancel failed');
      await refetch();
      if (onCharacterUpdated) onCharacterUpdated();
    } catch (e) {
      setError(e.message);
    } finally {
      setActioning(null);
    }
  };

  const grouped = { ready: [], pending: [], collected: [], cancelled: [], expired: [] };
  for (const o of orders) {
    (grouped[o.status] || grouped.expired).push(o);
  }

  const renderOrder = (o) => {
    const daysUntilReady = o.status === 'pending' && currentGameDay != null
      ? Math.max(0, (o.deadline_game_day || 0) - currentGameDay)
      : null;
    const daysHeld = o.status === 'ready' && currentGameDay != null && o.ready_game_day != null
      ? currentGameDay - o.ready_game_day
      : null;

    return (
      <div
        key={o.id}
        style={{
          padding: '0.6rem 0.75rem',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${STATUS_COLOR[o.status]}44`,
          borderRadius: '6px',
          marginBottom: '0.4rem'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.25rem' }}>
          <div style={{ color: '#ddd', fontWeight: 600, fontSize: '0.92rem' }}>{o.item_name}</div>
          <div style={{ color: STATUS_COLOR[o.status], fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {o.status}
          </div>
        </div>

        <div style={{ color: '#888', fontSize: '0.78rem', marginBottom: '0.3rem' }}>
          From {o.merchant_name || 'Unknown merchant'}
          {o.narrative_hook && (
            <span style={{ color: '#c084fc', fontStyle: 'italic' }}> · {o.narrative_hook}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem', color: '#aaa', marginBottom: '0.3rem' }}>
          <span>Total: <strong style={{ color: '#d4af37' }}>{formatCoins(o.quoted_price_cp)}</strong></span>
          <span>Deposit: <strong style={{ color: '#d4af37' }}>{formatCoins(o.deposit_paid_cp)}</strong></span>
          {o.balance_cp > 0 && (
            <span>Balance: <strong style={{ color: '#d4af37' }}>{formatCoins(o.balance_cp)}</strong></span>
          )}
        </div>

        {daysUntilReady != null && (
          <div style={{ fontSize: '0.72rem', color: '#888' }}>
            Ready in {daysUntilReady} game day{daysUntilReady === 1 ? '' : 's'}
            {' '}(day {o.deadline_game_day})
          </div>
        )}
        {daysHeld != null && (
          <div style={{ fontSize: '0.72rem', color: daysHeld > 20 ? '#f97316' : '#888' }}>
            Held for {daysHeld} day{daysHeld === 1 ? '' : 's'} — pick up soon or it may expire
          </div>
        )}

        {(o.status === 'ready' || o.status === 'pending') && (
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.4rem' }}>
            {o.status === 'ready' && (
              <button
                onClick={() => collect(o.id)}
                disabled={actioning === o.id}
                style={{
                  flex: 1, padding: '0.3rem 0.7rem',
                  background: '#34d399', color: '#0a0a0a',
                  border: 'none', borderRadius: '4px', fontSize: '0.78rem', fontWeight: 600,
                  cursor: actioning === o.id ? 'not-allowed' : 'pointer'
                }}
              >
                {actioning === o.id ? 'Collecting...' : `Collect (${formatCoins(o.balance_cp)})`}
              </button>
            )}
            {o.status === 'pending' && (
              <button
                onClick={() => cancel(o.id)}
                disabled={actioning === o.id}
                style={{
                  flex: 1, padding: '0.3rem 0.7rem',
                  background: '#7f8c8d', color: '#fff',
                  border: 'none', borderRadius: '4px', fontSize: '0.72rem',
                  cursor: actioning === o.id ? 'not-allowed' : 'pointer'
                }}
                title="Cancel — deposit forfeit"
              >
                Cancel (forfeit {formatCoins(o.deposit_paid_cp)})
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const activeOrders = [...grouped.ready, ...grouped.pending];
  const historyOrders = [...grouped.collected, ...grouped.cancelled, ...grouped.expired];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: '1px solid rgba(52, 211, 153, 0.3)',
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
        <h3 style={{ margin: 0, color: '#34d399' }}>Commissions</h3>
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
        {loading ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>Loading…</p>
        ) : orders.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            No commissions yet. Ask a merchant to craft something custom during a session.
          </p>
        ) : (
          <>
            {activeOrders.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <div style={{
                  color: '#34d399', fontSize: '0.72rem', fontWeight: 'bold',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '0.4rem', paddingBottom: '0.25rem',
                  borderBottom: '1px solid rgba(52,211,153,0.2)'
                }}>
                  Active ({activeOrders.length})
                </div>
                {activeOrders.map(renderOrder)}
              </div>
            )}
            {historyOrders.length > 0 && (
              <div>
                <div style={{
                  color: '#6b7280', fontSize: '0.72rem', fontWeight: 'bold',
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: '0.4rem', paddingBottom: '0.25rem',
                  borderBottom: '1px solid rgba(107,114,128,0.2)'
                }}>
                  History ({historyOrders.length})
                </div>
                {historyOrders.map(renderOrder)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
