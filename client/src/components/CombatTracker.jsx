import React from 'react';

const TYPE_COLORS = {
  player: '#60a5fa',
  companion: '#9b59b6',
  enemy: '#ef4444'
};

const TYPE_BG = {
  player: 'rgba(96, 165, 250, 0.15)',
  companion: 'rgba(155, 89, 182, 0.15)',
  enemy: 'rgba(239, 68, 68, 0.15)'
};

export default function CombatTracker({ combatState, onAdvanceTurn, onEndCombat }) {
  if (!combatState?.turnOrder?.length) return null;

  const { turnOrder, currentTurn, round } = combatState;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(20, 20, 35, 0.95) 0%, rgba(30, 25, 40, 0.95) 100%)',
      borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
      padding: '0.5rem 1rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      overflowX: 'auto',
      flexShrink: 0
    }}>
      {/* Round Counter */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 'fit-content',
        padding: '0.25rem 0.5rem',
        background: 'rgba(239, 68, 68, 0.15)',
        borderRadius: '4px',
        border: '1px solid rgba(239, 68, 68, 0.3)'
      }}>
        <span style={{ fontSize: '0.65rem', color: '#888', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Round
        </span>
        <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#ef4444' }}>
          {round}
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: '1px', height: '2rem', background: 'rgba(255,255,255,0.1)' }} />

      {/* Turn Order Chips */}
      <div style={{
        display: 'flex',
        gap: '0.4rem',
        flex: 1,
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        {turnOrder.map((combatant, idx) => {
          const isActive = idx === currentTurn;
          const color = TYPE_COLORS[combatant.type] || '#ccc';
          const bg = TYPE_BG[combatant.type] || 'rgba(255,255,255,0.05)';

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                padding: '0.3rem 0.6rem',
                background: isActive ? bg : 'rgba(255, 255, 255, 0.03)',
                borderRadius: '4px',
                border: isActive
                  ? `2px solid #fbbf24`
                  : `1px solid rgba(255, 255, 255, 0.08)`,
                minWidth: 'fit-content',
                transition: 'all 0.2s',
                boxShadow: isActive ? '0 0 8px rgba(251, 191, 36, 0.3)' : 'none'
              }}
            >
              {/* Active indicator */}
              {isActive && (
                <span style={{ color: '#fbbf24', fontSize: '0.7rem' }}>&#9654;</span>
              )}
              <span style={{
                color: isActive ? '#fff' : color,
                fontSize: '0.8rem',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap'
              }}>
                {combatant.name}
              </span>
              <span style={{
                color: '#666',
                fontSize: '0.7rem',
                fontWeight: 'normal'
              }}>
                {combatant.initiative}
              </span>
            </div>
          );
        })}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '0.4rem', minWidth: 'fit-content' }}>
        <button
          onClick={onAdvanceTurn}
          style={{
            background: 'rgba(251, 191, 36, 0.2)',
            border: '1px solid rgba(251, 191, 36, 0.4)',
            color: '#fbbf24',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 'bold',
            whiteSpace: 'nowrap'
          }}
          title="Advance to next combatant's turn"
        >
          Next Turn
        </button>
        <button
          onClick={onEndCombat}
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#ef4444',
            padding: '0.3rem 0.6rem',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '0.8rem',
            whiteSpace: 'nowrap'
          }}
          title="End combat (manual fallback)"
        >
          End Combat
        </button>
      </div>
    </div>
  );
}
