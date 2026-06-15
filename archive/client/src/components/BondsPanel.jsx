import React, { useState, useEffect, useRef } from 'react';

const ACCENT = '#e11d48';

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

function scoreColor(val) {
  if (val > 0) return '#22c55e';
  if (val < 0) return '#ef4444';
  return '#888';
}

function ScoreControl({ label, value, onAdjust, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
      <span style={{ color: '#777', fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '42px' }}>
        {label}
      </span>
      <button
        onClick={() => onAdjust(-1)}
        disabled={disabled || value <= -5}
        style={{
          width: '18px', height: '18px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '3px',
          color: disabled || value <= -5 ? '#444' : '#aaa',
          cursor: disabled || value <= -5 ? 'not-allowed' : 'pointer',
          fontSize: '0.75rem', lineHeight: 1,
          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >−</button>
      <span style={{
        color: scoreColor(value),
        fontWeight: 'bold',
        fontSize: '0.85rem',
        minWidth: '24px',
        textAlign: 'center'
      }}>
        {value >= 0 ? `+${value}` : value}
      </span>
      <button
        onClick={() => onAdjust(+1)}
        disabled={disabled || value >= 5}
        style={{
          width: '18px', height: '18px',
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '3px',
          color: disabled || value >= 5 ? '#444' : '#aaa',
          cursor: disabled || value >= 5 ? 'not-allowed' : 'pointer',
          fontSize: '0.75rem', lineHeight: 1,
          padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
      >+</button>
    </div>
  );
}

export default function BondsPanel({ party, partyId, lastShifts = [], onRelationshipUpdate, onClose }) {
  const [activeTab, setActiveTab] = useState(0);
  const [sessionLog, setSessionLog] = useState([]);
  const [highlighted, setHighlighted] = useState({}); // key → true for 3s
  const [adjusting, setAdjusting] = useState(false);
  const highlightTimers = useRef({});

  const characters = party?.characters || [];
  const char = characters[activeTab] || characters[0];
  const charColor = char?.color || '#60a5fa';

  // When new bond shifts arrive, add to log and highlight affected cards
  useEffect(() => {
    if (!lastShifts?.length) return;
    setSessionLog(prev => {
      const newEntries = lastShifts.map(s => ({ ...s, id: Date.now() + Math.random(), auto: true }));
      return [...newEntries, ...prev].slice(0, 30);
    });
    for (const shift of lastShifts) {
      const key = `${shift.from}→${shift.to}`;
      setHighlighted(prev => ({ ...prev, [key]: true }));
      // Clear highlight after 3s
      if (highlightTimers.current[key]) clearTimeout(highlightTimers.current[key]);
      highlightTimers.current[key] = setTimeout(() => {
        setHighlighted(prev => { const next = { ...prev }; delete next[key]; return next; });
      }, 3000);
      // Switch to the "from" character's tab
      const fromIdx = characters.findIndex(c => c.name === shift.from);
      if (fromIdx >= 0) setActiveTab(fromIdx);
    }
    return () => {
      for (const t of Object.values(highlightTimers.current)) clearTimeout(t);
    };
  }, [lastShifts]);

  const handleAdjust = async (fromName, toName, warmthDelta, trustDelta) => {
    if (adjusting || !partyId) return;
    setAdjusting(true);
    try {
      await onRelationshipUpdate(fromName, toName, warmthDelta, trustDelta, '');
      const key = `${fromName}→${toName}`;
      setSessionLog(prev => {
        const deltas = [];
        if (warmthDelta) deltas.push(`warmth${warmthDelta > 0 ? '+' : ''}${warmthDelta}`);
        if (trustDelta) deltas.push(`trust${trustDelta > 0 ? '+' : ''}${trustDelta}`);
        return [{ from: fromName, to: toName, warmthDelta, trustDelta, reason: 'Manual', id: Date.now(), auto: false }, ...prev].slice(0, 30);
      });
      setHighlighted(prev => ({ ...prev, [key]: true }));
      if (highlightTimers.current[key]) clearTimeout(highlightTimers.current[key]);
      highlightTimers.current[key] = setTimeout(() => {
        setHighlighted(prev => { const next = { ...prev }; delete next[key]; return next; });
      }, 2000);
    } finally {
      setAdjusting(false);
    }
  };

  if (!characters.length) return null;

  const relationships = Object.entries(char.party_relationships || {});

  return (
    <div style={{
      position: 'fixed',
      top: 0, right: 0,
      width: '400px', maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20,20,30,0.98) 0%, rgba(30,20,30,0.98) 100%)',
      borderLeft: `1px solid ${ACCENT}44`,
      boxShadow: '-5px 0 20px rgba(0,0,0,0.5)',
      zIndex: 1000,
      display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: `linear-gradient(135deg, ${ACCENT}15 0%, transparent 100%)`,
        flexShrink: 0
      }}>
        <div>
          <h3 style={{ margin: 0, color: ACCENT, fontSize: '1rem' }}>Bonds</h3>
          <span style={{ color: '#888', fontSize: '0.75rem' }}>
            {party?.name || 'Party'} — Live relationship tracker
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer', padding: '0.25rem' }}>×</button>
      </div>

      {/* Character Tabs */}
      <div style={{
        display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 0.25rem', overflowX: 'auto', flexShrink: 0
      }}>
        {characters.map((c, idx) => {
          const tabColor = c.color || '#60a5fa';
          const isActive = idx === activeTab;
          return (
            <button key={idx} onClick={() => setActiveTab(idx)} style={{
              flex: 1, padding: '0.5rem 0.4rem',
              background: isActive ? `${tabColor}15` : 'transparent',
              border: 'none',
              borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
              color: isActive ? tabColor : '#888',
              cursor: 'pointer', fontSize: '0.8rem',
              fontWeight: isActive ? 'bold' : 'normal',
              whiteSpace: 'nowrap', transition: 'all 0.15s ease'
            }}>
              {c.name?.split(' ')[0] || `Char ${idx + 1}`}
            </button>
          );
        })}
      </div>

      {/* Scrollable Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {/* Character name */}
        <div style={{ color: charColor, fontSize: '0.85rem', fontWeight: 'bold', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `1px solid ${charColor}22` }}>
          {char.name}'s relationships
        </div>

        {relationships.length === 0 && (
          <div style={{ color: '#555', fontSize: '0.8rem', fontStyle: 'italic' }}>No relationships tracked.</div>
        )}

        {relationships.map(([targetName, rel]) => {
          const attitude = rel.attitude || 'neutral';
          const warmth = rel.warmth || 0;
          const trust = rel.trust || 0;
          const attColor = ATTITUDE_COLORS[attitude.toLowerCase()] ||
            (warmth > 0 ? '#22c55e' : warmth < 0 ? '#ef4444' : '#eab308');
          const key = `${char.name}→${targetName}`;
          const isHighlighted = !!highlighted[key];

          return (
            <div key={targetName} style={{
              marginBottom: '0.6rem',
              padding: '0.6rem 0.75rem',
              background: isHighlighted ? `${ACCENT}18` : 'rgba(255,255,255,0.03)',
              borderRadius: '6px',
              borderLeft: `3px solid ${isHighlighted ? ACCENT : attColor}`,
              transition: 'background 0.4s ease, border-color 0.4s ease'
            }}>
              {/* Target name + attitude */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {targetName.split(' ')[0]}
                </span>
                <span style={{
                  padding: '0.1rem 0.4rem',
                  background: `${attColor}20`, border: `1px solid ${attColor}40`,
                  borderRadius: '10px', color: attColor,
                  fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'capitalize'
                }}>
                  {attitude}
                </span>
                {isHighlighted && (
                  <span style={{ color: ACCENT, fontSize: '0.65rem', fontWeight: 'bold', animation: 'pulse 1s ease infinite' }}>
                    ● changed
                  </span>
                )}
              </div>

              {/* Warmth control */}
              <ScoreControl
                label="Warmth"
                value={warmth}
                disabled={adjusting}
                onAdjust={(delta) => handleAdjust(char.name, targetName, delta, 0)}
              />
              <div style={{ height: '0.3rem' }} />
              {/* Trust control */}
              <ScoreControl
                label="Trust"
                value={trust}
                disabled={adjusting}
                onAdjust={(delta) => handleAdjust(char.name, targetName, 0, delta)}
              />

              {/* Latest history entry */}
              {rel.history?.length > 0 && (
                <div style={{ marginTop: '0.4rem', color: '#666', fontSize: '0.7rem', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {rel.history[rel.history.length - 1].reason}
                  {rel.history[rel.history.length - 1].session !== 'dm' && rel.history[rel.history.length - 1].session !== 'manual'
                    ? ` (S${rel.history[rel.history.length - 1].session})` : ' (DM)'}
                </div>
              )}
            </div>
          );
        })}

        {/* Session Log */}
        {sessionLog.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <div style={{
              color: ACCENT, fontSize: '0.65rem', fontWeight: 'bold',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: '0.4rem', paddingBottom: '0.25rem',
              borderBottom: `1px solid ${ACCENT}33`
            }}>
              This session
            </div>
            {sessionLog.map((entry, i) => {
              const deltas = [];
              if (entry.warmthDelta > 0) deltas.push(`warmth +${entry.warmthDelta}`);
              if (entry.warmthDelta < 0) deltas.push(`warmth ${entry.warmthDelta}`);
              if (entry.trustDelta > 0) deltas.push(`trust +${entry.trustDelta}`);
              if (entry.trustDelta < 0) deltas.push(`trust ${entry.trustDelta}`);
              return (
                <div key={entry.id || i} style={{
                  marginBottom: '0.3rem', padding: '0.3rem 0.5rem',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '4px',
                  borderLeft: `2px solid ${entry.auto ? ACCENT : '#888'}`
                }}>
                  <div style={{ color: '#ccc', fontSize: '0.72rem' }}>
                    <span style={{ color: entry.auto ? ACCENT : '#aaa', fontWeight: 'bold' }}>
                      {entry.from?.split(' ')[0]} → {entry.to?.split(' ')[0]}
                    </span>
                    {deltas.length > 0 && (
                      <span style={{ color: '#888', marginLeft: '0.3rem' }}>({deltas.join(', ')})</span>
                    )}
                  </div>
                  {entry.reason && (
                    <div style={{ color: '#666', fontSize: '0.68rem', fontStyle: 'italic', lineHeight: 1.3 }}>
                      {entry.reason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
