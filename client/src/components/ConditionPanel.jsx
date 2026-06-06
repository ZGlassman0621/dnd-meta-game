import React, { useState } from 'react';
import { CONDITIONS } from '../data/conditions.js';

// Local inline sprite — paths copied from the cockpit design's <defs>
// (#i-tag, #i-x). Do not edit a shared sprite.
function Sprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="cp-i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <line x1="7" y1="7" x2="7.01" y2="7" />
        </symbol>
        <symbol id="cp-i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </symbol>
      </defs>
    </svg>
  );
}

// Non-exhaustion conditions, in declaration order
const BASE_CONDITIONS = Object.entries(CONDITIONS)
  .filter(([key, cond]) => cond.category !== 'exhaustion' && !key.startsWith('exhaustion_'))
  .map(([key, cond]) => ({ key, ...cond }));

const EXHAUSTION_LEVELS = Object.entries(CONDITIONS)
  .filter(([key]) => key.startsWith('exhaustion_'))
  .map(([key, cond]) => ({ key, level: parseInt(key.split('_')[1], 10), ...cond }));

const EXHAUSTION_SUMMARY =
  'Stacks in levels — each worsens checks, then speed, attacks, HP, and finally death.';

export default function ConditionPanel({ playerConditions, companionConditions, companions, onToggleCondition, onClose }) {
  const [activeTab, setActiveTab] = useState('player');

  const tabs = [
    { key: 'player', label: 'Player' },
    ...(companions || []).map(c => ({ key: c.name, label: c.nickname || c.name }))
  ];

  const currentConditions = activeTab === 'player'
    ? (playerConditions || [])
    : (companionConditions?.[activeTab] || []);

  const handleToggle = (condKey) => {
    if (activeTab === 'player') {
      onToggleCondition(condKey, 'player');
    } else {
      onToggleCondition(condKey, 'companion', activeTab);
    }
  };

  // Exhaustion is leveled: only one level at a time. Toggling the "Available"
  // row adds level 1; the active row's switch clears the current level.
  const activeExhaustion = currentConditions.find(k => k.startsWith('exhaustion_'));
  const handleExhaustionToggle = (condKey) => {
    if (activeExhaustion === condKey) {
      handleToggle(condKey);
    } else {
      if (activeExhaustion) handleToggle(activeExhaustion);
      handleToggle(condKey);
    }
  };

  // Split base conditions into active / available for the current subject.
  const activeBase = BASE_CONDITIONS.filter(c => currentConditions.includes(c.key));
  const availableBase = BASE_CONDITIONS.filter(c => !currentConditions.includes(c.key));

  const activeExhaustionCond = activeExhaustion
    ? EXHAUSTION_LEVELS.find(c => c.key === activeExhaustion)
    : null;

  const subjectLabel = activeTab === 'player'
    ? 'Player'
    : (tabs.find(t => t.key === activeTab)?.label || activeTab);

  const Switch = ({ on, onClick }) => (
    <div
      className={on ? 'sw on' : 'sw'}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } }}
    >
      <span className="kn" />
    </div>
  );

  const hasAnyActive = activeBase.length > 0 || !!activeExhaustionCond;

  return (
    <>
      <Sprite />
      <div className="panel-scrim show" onClick={onClose} />
      <aside className="pnl open" data-panel="conditions">
        <div className="pnl-head">
          <svg className="ph-ic2"><use href="#cp-i-tag" /></svg>
          <h3>Conditions</h3>
          <span className="ph-sub2">active &amp; available</span>
          <button className="pnl-close" onClick={onClose} aria-label="Close">
            <svg className="ic"><use href="#cp-i-x" /></svg>
          </button>
        </div>

        <div className="pnl-body scroll">
          {tabs.length > 1 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
              {tabs.map(tab => {
                const sel = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={sel ? 'sw on' : ''}
                    style={{
                      width: 'auto',
                      height: 'auto',
                      borderRadius: 999,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontSize: 12.5,
                      letterSpacing: '.02em',
                      background: sel ? 'var(--bg-card)' : 'transparent',
                      border: '1px solid var(--rule)',
                      color: sel ? 'var(--ink)' : 'var(--ink-3)'
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          )}

          <div className="pnl-sec">Active now<span className="ln" /></div>
          {hasAnyActive ? (
            <>
              {activeBase.map(cond => (
                <div className="cond on" key={cond.key}>
                  <div>
                    <div className="cn">{cond.name}</div>
                    <div className="cd">{cond.description}</div>
                  </div>
                  <Switch on onClick={() => handleToggle(cond.key)} />
                </div>
              ))}
              {activeExhaustionCond && (
                <div className="cond on">
                  <div>
                    <div className="cn">{activeExhaustionCond.name}</div>
                    <div className="cd">{activeExhaustionCond.description}</div>
                  </div>
                  <Switch on onClick={() => handleExhaustionToggle(activeExhaustionCond.key)} />
                </div>
              )}
            </>
          ) : (
            <div className="cond">
              <div>
                <div className="cd">Nothing affecting {subjectLabel.toLowerCase()} right now.</div>
              </div>
            </div>
          )}

          <div className="pnl-sec">Available<span className="ln" /></div>
          {availableBase.map(cond => (
            <div className="cond" key={cond.key}>
              <div>
                <div className="cn">{cond.name}</div>
                <div className="cd">{cond.description}</div>
              </div>
              <Switch on={false} onClick={() => handleToggle(cond.key)} />
            </div>
          ))}
          {!activeExhaustionCond && (
            <div className="cond">
              <div>
                <div className="cn">Exhaustion</div>
                <div className="cd">{EXHAUSTION_SUMMARY}</div>
              </div>
              <Switch on={false} onClick={() => handleExhaustionToggle('exhaustion_1')} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
