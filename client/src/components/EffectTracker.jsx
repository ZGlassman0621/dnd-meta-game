import { useState } from 'react';

const ACCENT = '#f97316';

function durationColor(rounds) {
  if (rounds === null) return '#3b82f6';
  if (rounds >= 3) return '#22c55e';
  if (rounds === 2) return '#eab308';
  if (rounds === 1) return '#ef4444';
  return '#6b7280';
}

const TYPE_LABELS = { condition: 'Cond', spell: 'Spell', effect: 'Effect' };

export default function EffectTracker({ effects, characters, onAddEffect, onRemoveEffect, onAdvanceRound, roundNumber }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [newEffect, setNewEffect] = useState({
    name: '', target: '', type: 'spell', roundsRemaining: 10,
    indefinite: false, concentration: false, casterName: '', notes: ''
  });

  const handleAdd = () => {
    if (!newEffect.name.trim()) return;
    onAddEffect({
      name: newEffect.name.trim(),
      target: newEffect.target || 'All',
      type: newEffect.type,
      roundsRemaining: newEffect.indefinite ? null : (parseInt(newEffect.roundsRemaining) || 10),
      concentration: newEffect.concentration,
      casterName: newEffect.concentration ? newEffect.casterName : '',
      notes: newEffect.notes
    });
    setNewEffect({ name: '', target: '', type: 'spell', roundsRemaining: 10, indefinite: false, concentration: false, casterName: '', notes: '' });
    setShowAddForm(false);
  };

  // Hide completely when empty and form closed
  if (effects.length === 0 && !showAddForm) {
    return (
      <div style={{
        padding: '0.15rem 1rem', borderBottom: '1px solid rgba(255,255,255,0.04)',
        flexShrink: 0, display: 'flex', alignItems: 'center'
      }}>
        <button
          onClick={() => setShowAddForm(true)}
          title="Track an effect or spell duration"
          style={{
            background: 'transparent', border: `1px dashed rgba(249,115,22,0.25)`,
            borderRadius: '4px', color: 'rgba(249,115,22,0.4)', cursor: 'pointer',
            fontSize: '0.7rem', padding: '0.1rem 0.4rem'
          }}
        >+ Effect</button>
      </div>
    );
  }

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Effect bar */}
      <div style={{
        padding: '0.25rem 1rem', borderBottom: '1px solid rgba(249,115,22,0.15)',
        background: 'rgba(249,115,22,0.04)', display: 'flex', alignItems: 'center',
        gap: '0.4rem', flexWrap: 'wrap'
      }}>
        {/* Round counter */}
        <span style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.72rem', marginRight: '0.2rem' }}>
          Rd {roundNumber}
        </span>

        {/* Add button */}
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            width: '20px', height: '20px', borderRadius: '3px',
            background: showAddForm ? `${ACCENT}25` : 'transparent',
            border: `1px solid ${ACCENT}50`, color: ACCENT, cursor: 'pointer',
            fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0
          }}
        >{showAddForm ? '-' : '+'}</button>

        {/* Effect pills */}
        {effects.map(eff => {
          const color = durationColor(eff.roundsRemaining);
          const isExpanded = expandedId === eff.id;
          return (
            <span
              key={eff.id}
              onClick={() => setExpandedId(isExpanded ? null : eff.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
                padding: '0.1rem 0.4rem', borderRadius: '10px', cursor: 'pointer',
                background: `${color}15`, border: `1px solid ${color}40`,
                fontSize: '0.68rem', transition: 'all 0.15s'
              }}
            >
              {eff.concentration && <span style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '0.6rem' }}>C</span>}
              <span style={{ color: '#ddd', fontWeight: 'bold' }}>{eff.name}</span>
              {eff.target && eff.target !== 'All' && (
                <span style={{ color: '#999' }}>({eff.target.split(' ')[0]})</span>
              )}
              <span style={{ color, fontWeight: 'bold' }}>
                {eff.roundsRemaining === null ? '\u221E' : eff.roundsRemaining}
              </span>
              <button
                onClick={e => { e.stopPropagation(); onRemoveEffect(eff.id); }}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.7rem', padding: '0 0.1rem', lineHeight: 1 }}
              >&times;</button>
            </span>
          );
        })}

        {/* Advance Round */}
        {effects.length > 0 && (
          <button
            onClick={onAdvanceRound}
            style={{
              marginLeft: 'auto', padding: '0.1rem 0.5rem', borderRadius: '4px',
              background: `${ACCENT}15`, border: `1px solid ${ACCENT}40`,
              color: ACCENT, cursor: 'pointer', fontSize: '0.68rem', fontWeight: 'bold', whiteSpace: 'nowrap'
            }}
          >Next Round &raquo;</button>
        )}
      </div>

      {/* Expanded detail */}
      {expandedId && (() => {
        const eff = effects.find(e => e.id === expandedId);
        if (!eff) return null;
        const color = durationColor(eff.roundsRemaining);
        return (
          <div style={{
            padding: '0.3rem 1rem 0.4rem', background: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.05)',
            display: 'flex', gap: '1rem', alignItems: 'center', fontSize: '0.72rem', flexWrap: 'wrap'
          }}>
            <span style={{ color: '#ddd' }}><strong>{eff.name}</strong></span>
            <span style={{ color: '#999' }}>Target: {eff.target}</span>
            <span style={{ color: '#999' }}>Type: {TYPE_LABELS[eff.type] || eff.type}</span>
            <span style={{ color }}>Rounds: {eff.roundsRemaining === null ? 'Indefinite' : eff.roundsRemaining}</span>
            {eff.concentration && <span style={{ color: '#a855f7' }}>Conc: {eff.casterName || '?'}</span>}
            {eff.notes && <span style={{ color: '#888' }}>Note: {eff.notes}</span>}
          </div>
        );
      })()}

      {/* Add form */}
      {showAddForm && (
        <div style={{
          padding: '0.4rem 1rem', background: 'rgba(0,0,0,0.2)',
          borderBottom: `1px solid ${ACCENT}20`,
          display: 'flex', gap: '0.3rem', alignItems: 'flex-end', flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={formLabel}>Name</label>
            <input
              type="text" placeholder="Bless, Hold Person..."
              value={newEffect.name} onChange={e => setNewEffect(prev => ({ ...prev, name: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              style={{ ...formInput, width: '120px' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={formLabel}>Target</label>
            <select
              value={newEffect.target} onChange={e => setNewEffect(prev => ({ ...prev, target: e.target.value }))}
              style={{ ...formInput, width: '90px' }}
            >
              <option value="">All</option>
              {characters.map(c => <option key={c} value={c}>{c.split(' ')[0]}</option>)}
              <option value="Enemy">Enemy</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={formLabel}>Type</label>
            <select
              value={newEffect.type} onChange={e => setNewEffect(prev => ({ ...prev, type: e.target.value }))}
              style={{ ...formInput, width: '65px' }}
            >
              <option value="spell">Spell</option>
              <option value="condition">Cond</option>
              <option value="effect">Effect</option>
            </select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={formLabel}>Rounds</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <input
                type="number" min="1" value={newEffect.indefinite ? '' : newEffect.roundsRemaining}
                disabled={newEffect.indefinite}
                onChange={e => setNewEffect(prev => ({ ...prev, roundsRemaining: e.target.value }))}
                style={{ ...formInput, width: '40px', textAlign: 'center' }}
              />
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.15rem', cursor: 'pointer', fontSize: '0.62rem', color: '#888' }}>
                <input type="checkbox" checked={newEffect.indefinite} onChange={e => setNewEffect(prev => ({ ...prev, indefinite: e.target.checked }))} style={{ width: '12px', height: '12px' }} />
                Indef
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={formLabel}>Conc?</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <input type="checkbox" checked={newEffect.concentration} onChange={e => setNewEffect(prev => ({ ...prev, concentration: e.target.checked }))} style={{ width: '14px', height: '14px' }} />
              {newEffect.concentration && (
                <select
                  value={newEffect.casterName} onChange={e => setNewEffect(prev => ({ ...prev, casterName: e.target.value }))}
                  style={{ ...formInput, width: '75px' }}
                >
                  <option value="">Caster?</option>
                  {characters.map(c => <option key={c} value={c}>{c.split(' ')[0]}</option>)}
                </select>
              )}
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!newEffect.name.trim()}
            style={{
              padding: '0.25rem 0.6rem', borderRadius: '4px',
              background: newEffect.name.trim() ? `${ACCENT}20` : 'rgba(255,255,255,0.05)',
              border: `1px solid ${newEffect.name.trim() ? ACCENT + '50' : 'rgba(255,255,255,0.1)'}`,
              color: newEffect.name.trim() ? ACCENT : '#666',
              cursor: newEffect.name.trim() ? 'pointer' : 'default',
              fontSize: '0.72rem', fontWeight: 'bold', alignSelf: 'flex-end'
            }}
          >Add</button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STYLES
// ============================================================

const formLabel = { color: '#777', fontSize: '0.58rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.1rem' };

const formInput = {
  padding: '0.2rem 0.35rem', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
  color: '#ddd', fontSize: '0.72rem', outline: 'none'
};
