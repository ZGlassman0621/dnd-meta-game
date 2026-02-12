import React, { useState, useEffect, useCallback } from 'react';

const ACCENT = '#14b8a6';

const DC_REFERENCE = [
  { dc: 5, difficulty: 'Trivial', example: 'Climbing a knotted rope', color: '#22c55e' },
  { dc: 10, difficulty: 'Easy', example: 'Picking a simple lock', color: '#84cc16' },
  { dc: 15, difficulty: 'Medium', example: 'Navigating a forest', color: '#eab308' },
  { dc: 20, difficulty: 'Hard', example: 'Swimming in stormy water', color: '#f97316' },
  { dc: 25, difficulty: 'Very Hard', example: 'Picking an amazing lock', color: '#ef4444' },
  { dc: 30, difficulty: 'Nearly Impossible', example: 'Leaping across a 30-ft chasm', color: '#dc2626' }
];

const QUICK_TIPS = [
  'The Rule of Cool: If it sounds awesome, lower the DC',
  'Say "Yes, and..." or "Yes, but..." instead of "No"',
  'When in doubt, ask for a d20 + relevant ability',
  "It's okay to take a 5-minute break to think",
  'If the party is stuck, have an NPC offer a hint',
  'Combat too easy? Add reinforcements. Too hard? Have enemies flee'
];

export default function DMCoachingPanel({ sessionId, onClose }) {
  const [tips, setTips] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTips = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dm-mode/${sessionId}/coaching-tip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error(`Failed to fetch tips (${res.status})`);
      const data = await res.json();
      setTips(data);
    } catch (err) {
      setError(err.message || 'Failed to load coaching tips');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchTips();
  }, [fetchTips]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '380px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: `1px solid rgba(20, 184, 166, 0.3)`,
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
        <h3 style={{ margin: 0, color: ACCENT }}>DM Coach</h3>
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

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem'
      }}>
        {/* AI Tips Section */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.75rem'
          }}>
            <h4 style={{ margin: 0, color: '#ccc', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              AI Tips
            </h4>
            <button
              onClick={fetchTips}
              disabled={loading}
              style={{
                background: loading ? 'rgba(20, 184, 166, 0.1)' : 'rgba(20, 184, 166, 0.2)',
                border: `1px solid ${ACCENT}40`,
                borderRadius: '4px',
                color: ACCENT,
                cursor: loading ? 'wait' : 'pointer',
                padding: '0.25rem 0.6rem',
                fontSize: '0.75rem',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {loading && !tips && (
            <div style={{
              textAlign: 'center',
              padding: '2rem 1rem',
              color: '#888'
            }}>
              <div style={{
                display: 'inline-block',
                width: '24px',
                height: '24px',
                border: `2px solid ${ACCENT}40`,
                borderTop: `2px solid ${ACCENT}`,
                borderRadius: '50%',
                animation: 'dmcoach-spin 0.8s linear infinite'
              }} />
              <style>{`@keyframes dmcoach-spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.85rem' }}>Analyzing scene...</p>
            </div>
          )}

          {error && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '6px',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '0.5rem'
            }}>
              {error}
            </div>
          )}

          {tips && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {/* Scene Analysis Card */}
              <TipCard
                label="Scene Analysis"
                icon="🎭"
                text={tips.sceneTip}
              />

              {/* Encounter Idea Card */}
              <TipCard
                label="Encounter Idea"
                icon="⚔️"
                text={tips.encounterSuggestion}
              />

              {/* Character Hook Card */}
              <TipCard
                label="Character Hook"
                icon="🪝"
                text={tips.characterHook}
              />
            </div>
          )}
        </div>

        {/* DC Quick Reference */}
        <div style={{ marginBottom: '1.25rem' }}>
          <h4 style={{
            margin: '0 0 0.75rem',
            color: '#ccc',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            DC Quick Reference
          </h4>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            overflow: 'hidden'
          }}>
            {DC_REFERENCE.map((entry, idx) => (
              <div
                key={entry.dc}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  borderBottom: idx < DC_REFERENCE.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
              >
                <span style={{
                  fontWeight: 'bold',
                  color: entry.color,
                  fontSize: '0.9rem',
                  minWidth: '32px',
                  textAlign: 'center'
                }}>
                  {entry.dc}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: entry.color,
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                  }}>
                    {entry.difficulty}
                  </div>
                  <div style={{
                    color: '#888',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {entry.example}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Tips */}
        <div style={{ marginBottom: '0.75rem' }}>
          <h4 style={{
            margin: '0 0 0.75rem',
            color: '#ccc',
            fontSize: '0.85rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Quick Tips
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {QUICK_TIPS.map((tip, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.5rem 0.75rem',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '6px',
                  color: '#bbb',
                  fontSize: '0.8rem',
                  lineHeight: 1.4,
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start'
                }}
              >
                <span style={{ color: ACCENT, fontWeight: 'bold', flexShrink: 0 }}>•</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TipCard({ label, icon, text }) {
  return (
    <div style={{
      padding: '0.75rem',
      background: 'rgba(255, 255, 255, 0.03)',
      border: '1px solid rgba(255, 255, 255, 0.08)',
      borderRadius: '6px',
      borderLeft: `3px solid ${ACCENT}`
    }}>
      <div style={{
        fontSize: '0.75rem',
        color: ACCENT,
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.35rem'
      }}>
        {icon} {label}
      </div>
      <div style={{
        color: '#ccc',
        fontSize: '0.85rem',
        lineHeight: 1.5
      }}>
        {text}
      </div>
    </div>
  );
}
