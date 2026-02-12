import React, { useState, useRef, useEffect, useCallback } from 'react';

const ACCENT = '#8b5cf6';
const ACCENT_DIM = 'rgba(139, 92, 246, 0.3)';
const ACCENT_GLOW = 'rgba(139, 92, 246, 0.5)';

const DICE_TYPES = [
  { sides: 4, label: 'd4' },
  { sides: 6, label: 'd6' },
  { sides: 8, label: 'd8' },
  { sides: 10, label: 'd10' },
  { sides: 12, label: 'd12' },
  { sides: 20, label: 'd20' }
];

const MAX_HISTORY = 15;

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

export default function DiceRoller({ pendingRolls = [], onRollResult, onClose, characterColors = {} }) {
  // Each pending roll gets its own state: rolled value, dc input, resolved status
  const [pendingState, setPendingState] = useState({});
  // Quick roll state
  const [quickModifier, setQuickModifier] = useState(0);
  const [quickLabel, setQuickLabel] = useState('');
  const [quickResult, setQuickResult] = useState(null); // { sides, raw, modifier, total }
  const [quickAnimating, setQuickAnimating] = useState(false);
  // Roll history
  const [history, setHistory] = useState([]);
  // Animation state for pending rolls
  const [animatingPending, setAnimatingPending] = useState(null); // key of the pending roll being animated

  const historyRef = useRef(null);
  const animationRef = useRef(null);

  // Clean up stale pending state entries when pendingRolls changes
  useEffect(() => {
    setPendingState(prev => {
      const keys = new Set(pendingRolls.map((_, i) => pendingRollKey(_, i)));
      const next = {};
      for (const k of Object.keys(prev)) {
        if (keys.has(k)) next[k] = prev[k];
      }
      return next;
    });
  }, [pendingRolls]);

  const pendingRollKey = useCallback((roll, idx) => {
    return `${roll.character}-${roll.type}-${roll.skill || roll.weapon || roll.spell || ''}-${idx}`;
  }, []);

  const addToHistory = useCallback((entry) => {
    setHistory(prev => [entry, ...prev].slice(0, MAX_HISTORY));
  }, []);

  // Animate a roll: cycle random numbers briefly, then land on the real result
  const animateRoll = useCallback((sides, onComplete) => {
    let count = 0;
    const totalFrames = 12;
    const interval = 50;

    const frame = () => {
      count++;
      const fake = rollDie(sides);
      if (count < totalFrames) {
        onComplete(fake, false);
        animationRef.current = setTimeout(frame, interval);
      } else {
        const real = rollDie(sides);
        onComplete(real, true);
      }
    };

    frame();
  }, []);

  // Roll for a pending roll card
  const handlePendingRoll = useCallback((roll, idx) => {
    const key = pendingRollKey(roll, idx);
    setAnimatingPending(key);

    animateRoll(20, (value, isFinal) => {
      if (isFinal) {
        setAnimatingPending(null);
        const modifier = roll.modifier || roll.attackBonus || 0;
        const total = value + modifier;
        setPendingState(prev => ({
          ...prev,
          [key]: { raw: value, modifier, total, dc: '', resolved: false }
        }));
        addToHistory({
          sides: 20,
          raw: value,
          modifier,
          total,
          label: describePendingRoll(roll),
          timestamp: Date.now()
        });
      } else {
        // Show spinning number
        setPendingState(prev => ({
          ...prev,
          [key]: { ...prev[key], animValue: value, animating: true }
        }));
      }
    });
  }, [animateRoll, addToHistory, pendingRollKey]);

  // Resolve a pending roll (skill check with DC)
  const handleResolve = useCallback((roll, idx) => {
    const key = pendingRollKey(roll, idx);
    const state = pendingState[key];
    if (!state) return;

    const dc = parseInt(state.dc, 10);
    const success = !isNaN(dc) ? state.total >= dc : null;

    onRollResult({
      character: roll.character,
      rollType: roll.type,
      skill: roll.skill || roll.weapon || roll.spell || null,
      result: state.total,
      raw: state.raw,
      modifier: state.modifier,
      dc: isNaN(dc) ? null : dc,
      success,
      description: describePendingRoll(roll)
    });

    setPendingState(prev => ({
      ...prev,
      [key]: { ...prev[key], resolved: true }
    }));
  }, [pendingState, onRollResult, pendingRollKey]);

  // Quick roll
  const handleQuickRoll = useCallback((sides) => {
    setQuickAnimating(true);

    animateRoll(sides, (value, isFinal) => {
      if (isFinal) {
        setQuickAnimating(false);
        const mod = quickModifier || 0;
        const total = value + mod;
        setQuickResult({ sides, raw: value, modifier: mod, total });
        addToHistory({
          sides,
          raw: value,
          modifier: mod,
          total,
          label: quickLabel || `DM ${DICE_TYPES.find(d => d.sides === sides)?.label || 'd?'} roll`,
          timestamp: Date.now()
        });
      } else {
        setQuickResult({ sides, raw: value, modifier: quickModifier || 0, total: value + (quickModifier || 0), animating: true });
      }
    });
  }, [quickModifier, quickLabel, animateRoll, addToHistory]);

  // Describe what a pending roll is for
  function describePendingRoll(roll) {
    if (roll.type === 'skill_check') {
      const mod = roll.modifier != null ? ` (${roll.modifier >= 0 ? '+' : ''}${roll.modifier})` : '';
      return `${roll.skill || 'Skill'} check${mod}`;
    }
    if (roll.type === 'attack') {
      const mod = roll.attackBonus != null ? ` (${roll.attackBonus >= 0 ? '+' : ''}${roll.attackBonus})` : '';
      return `Attack with ${roll.weapon || 'weapon'}${mod}`;
    }
    if (roll.type === 'spell') {
      const lvl = roll.spellLevel ? ` (lvl ${roll.spellLevel})` : '';
      return `${roll.spell || 'Spell'}${lvl}`;
    }
    return 'Roll';
  }

  // Clean up animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) clearTimeout(animationRef.current);
    };
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '350px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: `1px solid ${ACCENT_DIM}`,
      boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: ACCENT, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '1.2rem' }}>Dice Roller</span>
        </h3>
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
          &times;
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

        {/* Pending Rolls Section */}
        {pendingRolls.length > 0 && (
          <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{
              fontSize: '0.7rem',
              color: '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.5rem'
            }}>
              Pending Rolls
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {pendingRolls.map((roll, idx) => {
                const key = pendingRollKey(roll, idx);
                const state = pendingState[key];
                const isAnimating = animatingPending === key;
                const charColor = characterColors[roll.character] || '#60a5fa';
                const hasRolled = state && !state.animating && state.raw != null;
                const isResolved = state?.resolved;

                return (
                  <div
                    key={key}
                    style={{
                      padding: '0.6rem 0.75rem',
                      background: isResolved
                        ? 'rgba(255, 255, 255, 0.03)'
                        : 'rgba(139, 92, 246, 0.08)',
                      borderRadius: '6px',
                      border: isResolved
                        ? '1px solid rgba(255, 255, 255, 0.05)'
                        : `1px solid ${ACCENT_DIM}`,
                      opacity: isResolved ? 0.5 : 1,
                      transition: 'opacity 0.3s'
                    }}
                  >
                    {/* Character name + description */}
                    <div style={{ marginBottom: '0.4rem' }}>
                      <span style={{ color: charColor, fontWeight: 'bold', fontSize: '0.85rem' }}>
                        {roll.character}
                      </span>
                      <span style={{ color: '#aaa', fontSize: '0.8rem', marginLeft: '0.4rem' }}>
                        {describePendingRoll(roll)}
                      </span>
                    </div>

                    {/* Roll / Result area */}
                    {!hasRolled && !isAnimating && !isResolved && (
                      <button
                        onClick={() => handlePendingRoll(roll, idx)}
                        style={{
                          background: `linear-gradient(135deg, ${ACCENT} 0%, #7c3aed 100%)`,
                          border: 'none',
                          color: '#fff',
                          padding: '0.4rem 1rem',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '0.8rem',
                          width: '100%',
                          transition: 'box-shadow 0.2s'
                        }}
                        onMouseEnter={(e) => e.target.style.boxShadow = `0 0 12px ${ACCENT_GLOW}`}
                        onMouseLeave={(e) => e.target.style.boxShadow = 'none'}
                      >
                        Roll d20
                      </button>
                    )}

                    {/* Animating state */}
                    {isAnimating && state && (
                      <div style={{
                        textAlign: 'center',
                        fontSize: '1.5rem',
                        fontWeight: 'bold',
                        color: ACCENT,
                        fontFamily: 'monospace',
                        padding: '0.3rem 0'
                      }}>
                        {state.animValue || '...'}
                      </div>
                    )}

                    {/* Rolled result */}
                    {hasRolled && !isResolved && (
                      <div>
                        {/* Result display */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{
                            fontSize: '1.3rem',
                            fontWeight: 'bold',
                            fontFamily: 'monospace',
                            color: state.raw === 20 ? '#fbbf24' : state.raw === 1 ? '#ef4444' : '#fff',
                            textShadow: state.raw === 20 ? '0 0 8px rgba(251, 191, 36, 0.6)' : 'none'
                          }}>
                            {state.total}
                          </span>
                          <span style={{ color: '#888', fontSize: '0.75rem' }}>
                            ({state.raw} {state.modifier >= 0 ? '+' : ''}{state.modifier})
                          </span>
                          {state.raw === 20 && (
                            <span style={{
                              color: '#fbbf24',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              NAT 20!
                            </span>
                          )}
                          {state.raw === 1 && (
                            <span style={{
                              color: '#ef4444',
                              fontSize: '0.7rem',
                              fontWeight: 'bold',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em'
                            }}>
                              NAT 1!
                            </span>
                          )}
                        </div>

                        {/* DC input + Resolve (for skill checks and attacks) */}
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          <label style={{ color: '#888', fontSize: '0.75rem', flexShrink: 0 }}>DC:</label>
                          <input
                            type="number"
                            value={state.dc}
                            onChange={(e) => setPendingState(prev => ({
                              ...prev,
                              [key]: { ...prev[key], dc: e.target.value }
                            }))}
                            placeholder="--"
                            style={{
                              width: '50px',
                              padding: '0.3rem 0.4rem',
                              background: 'rgba(255,255,255,0.08)',
                              border: '1px solid rgba(255,255,255,0.15)',
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '0.85rem',
                              textAlign: 'center',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = ACCENT}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
                          />
                          <button
                            onClick={() => handleResolve(roll, idx)}
                            style={{
                              flex: 1,
                              padding: '0.3rem 0.5rem',
                              background: state.dc && !isNaN(parseInt(state.dc, 10))
                                ? (state.total >= parseInt(state.dc, 10) ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)')
                                : 'rgba(139, 92, 246, 0.2)',
                              border: state.dc && !isNaN(parseInt(state.dc, 10))
                                ? (state.total >= parseInt(state.dc, 10) ? '1px solid rgba(34, 197, 94, 0.5)' : '1px solid rgba(239, 68, 68, 0.5)')
                                : `1px solid ${ACCENT_DIM}`,
                              borderRadius: '3px',
                              color: '#fff',
                              fontSize: '0.8rem',
                              cursor: 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {state.dc && !isNaN(parseInt(state.dc, 10))
                              ? (state.total >= parseInt(state.dc, 10) ? 'Success' : 'Failure')
                              : 'Resolve'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Resolved checkmark */}
                    {isResolved && (
                      <div style={{ color: '#666', fontSize: '0.75rem', fontStyle: 'italic' }}>
                        Resolved — {state.total}{state.dc ? ` vs DC ${state.dc}` : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Roll Section */}
        <div style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{
            fontSize: '0.7rem',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem'
          }}>
            Quick Roll
          </div>

          {/* Dice buttons row */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '0.3rem',
            marginBottom: '0.5rem'
          }}>
            {DICE_TYPES.map(die => (
              <button
                key={die.sides}
                onClick={() => handleQuickRoll(die.sides)}
                disabled={quickAnimating}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'rgba(139, 92, 246, 0.12)',
                  border: `1px solid ${ACCENT_DIM}`,
                  color: ACCENT,
                  fontWeight: 'bold',
                  fontSize: '0.8rem',
                  cursor: quickAnimating ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s',
                  opacity: quickAnimating ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (!quickAnimating) {
                    e.target.style.background = 'rgba(139, 92, 246, 0.25)';
                    e.target.style.boxShadow = `0 0 12px ${ACCENT_GLOW}`;
                    e.target.style.borderColor = ACCENT;
                  }
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(139, 92, 246, 0.12)';
                  e.target.style.boxShadow = 'none';
                  e.target.style.borderColor = ACCENT_DIM;
                }}
              >
                {die.label}
              </button>
            ))}
          </div>

          {/* Modifier + label row */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
              <label style={{ color: '#888', fontSize: '0.75rem' }}>Mod:</label>
              <input
                type="number"
                value={quickModifier}
                onChange={(e) => setQuickModifier(parseInt(e.target.value, 10) || 0)}
                style={{
                  width: '50px',
                  padding: '0.3rem 0.4rem',
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '3px',
                  color: '#fff',
                  fontSize: '0.85rem',
                  textAlign: 'center',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = ACCENT}
                onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
              />
            </div>
            <input
              type="text"
              value={quickLabel}
              onChange={(e) => setQuickLabel(e.target.value)}
              placeholder="Label (optional)"
              style={{
                flex: 1,
                padding: '0.3rem 0.5rem',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '3px',
                color: '#fff',
                fontSize: '0.8rem',
                outline: 'none'
              }}
              onFocus={(e) => e.target.style.borderColor = ACCENT}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.15)'}
            />
          </div>

          {/* Quick roll result */}
          {quickResult && (
            <div style={{
              padding: '0.5rem 0.75rem',
              background: quickResult.animating ? 'rgba(139, 92, 246, 0.15)' : 'rgba(255,255,255,0.05)',
              borderRadius: '4px',
              border: `1px solid ${quickResult.animating ? ACCENT_DIM : 'rgba(255,255,255,0.08)'}`,
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'all 0.2s'
            }}>
              <span style={{
                color: '#888',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {DICE_TYPES.find(d => d.sides === quickResult.sides)?.label}
              </span>
              <span style={{
                fontSize: '1.3rem',
                fontWeight: 'bold',
                fontFamily: 'monospace',
                color: quickResult.animating
                  ? ACCENT
                  : (quickResult.sides === 20 && quickResult.raw === 20)
                    ? '#fbbf24'
                    : (quickResult.sides === 20 && quickResult.raw === 1)
                      ? '#ef4444'
                      : '#fff',
                textShadow: (!quickResult.animating && quickResult.sides === 20 && quickResult.raw === 20)
                  ? '0 0 8px rgba(251, 191, 36, 0.6)'
                  : 'none',
                minWidth: '2rem',
                textAlign: 'center'
              }}>
                {quickResult.animating ? quickResult.raw : quickResult.total}
              </span>
              {!quickResult.animating && quickResult.modifier !== 0 && (
                <span style={{ color: '#888', fontSize: '0.75rem' }}>
                  ({quickResult.raw} {quickResult.modifier >= 0 ? '+' : ''}{quickResult.modifier})
                </span>
              )}
              {!quickResult.animating && quickResult.sides === 20 && quickResult.raw === 20 && (
                <span style={{
                  color: '#fbbf24',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  NAT 20!
                </span>
              )}
              {!quickResult.animating && quickResult.sides === 20 && quickResult.raw === 1 && (
                <span style={{
                  color: '#ef4444',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase'
                }}>
                  NAT 1!
                </span>
              )}
            </div>
          )}
        </div>

        {/* Roll History Section */}
        <div style={{ flex: 1, padding: '0.75rem', minHeight: 0 }}>
          <div style={{
            fontSize: '0.7rem',
            color: '#888',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: '0.5rem'
          }}>
            Roll History
          </div>
          <div
            ref={historyRef}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              overflowY: 'auto',
              maxHeight: 'calc(100vh - 500px)'
            }}
          >
            {history.length === 0 ? (
              <div style={{ color: '#555', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem 0' }}>
                No rolls yet
              </div>
            ) : (
              history.map((entry, idx) => {
                const isNat20 = entry.sides === 20 && entry.raw === 20;
                const isNat1 = entry.sides === 20 && entry.raw === 1;
                const dieName = DICE_TYPES.find(d => d.sides === entry.sides)?.label || `d${entry.sides}`;

                return (
                  <div
                    key={`${entry.timestamp}-${idx}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.3rem 0.5rem',
                      background: isNat20
                        ? 'rgba(251, 191, 36, 0.08)'
                        : isNat1
                          ? 'rgba(239, 68, 68, 0.08)'
                          : 'rgba(255,255,255,0.02)',
                      borderRadius: '3px',
                      border: isNat20
                        ? '1px solid rgba(251, 191, 36, 0.2)'
                        : isNat1
                          ? '1px solid rgba(239, 68, 68, 0.2)'
                          : '1px solid transparent',
                      fontSize: '0.78rem'
                    }}
                  >
                    {/* Die type badge */}
                    <span style={{
                      color: ACCENT,
                      fontWeight: 'bold',
                      fontSize: '0.7rem',
                      minWidth: '2rem',
                      textAlign: 'center'
                    }}>
                      {dieName}
                    </span>
                    {/* Result */}
                    <span style={{
                      fontFamily: 'monospace',
                      fontWeight: 'bold',
                      color: isNat20 ? '#fbbf24' : isNat1 ? '#ef4444' : '#ddd',
                      minWidth: '1.5rem',
                      textAlign: 'right'
                    }}>
                      {entry.total}
                    </span>
                    {/* Breakdown */}
                    {entry.modifier !== 0 && (
                      <span style={{ color: '#666', fontSize: '0.7rem' }}>
                        ({entry.raw}{entry.modifier >= 0 ? '+' : ''}{entry.modifier})
                      </span>
                    )}
                    {/* Nat indicator */}
                    {isNat20 && (
                      <span style={{ color: '#fbbf24', fontSize: '0.6rem', fontWeight: 'bold' }}>NAT 20</span>
                    )}
                    {isNat1 && (
                      <span style={{ color: '#ef4444', fontSize: '0.6rem', fontWeight: 'bold' }}>NAT 1</span>
                    )}
                    {/* Label */}
                    <span style={{
                      color: '#666',
                      fontSize: '0.7rem',
                      flex: 1,
                      textAlign: 'right',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {entry.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: '#555'
      }}>
        <span>{history.length} roll{history.length !== 1 ? 's' : ''}</span>
        {history.length > 0 && (
          <button
            onClick={() => setHistory([])}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#555',
              fontSize: '0.7rem',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
            onMouseEnter={(e) => e.target.style.color = '#888'}
            onMouseLeave={(e) => e.target.style.color = '#555'}
          >
            Clear History
          </button>
        )}
      </div>
    </div>
  );
}
