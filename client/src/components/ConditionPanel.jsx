import React, { useState } from 'react';
import { CONDITIONS, CONDITION_CATEGORIES } from '../data/conditions.js';

const ACCENT = '#f97316'; // Orange

export default function ConditionPanel({ playerConditions, companionConditions, companions, onToggleCondition, onClose }) {
  const [activeTab, setActiveTab] = useState('player');
  const [hoveredCondition, setHoveredCondition] = useState(null);

  const tabs = [
    { key: 'player', label: 'Player' },
    ...(companions || []).map(c => ({ key: c.name, label: c.nickname || c.name }))
  ];

  const currentConditions = activeTab === 'player'
    ? (playerConditions || [])
    : (companionConditions?.[activeTab] || []);

  const isActive = (condKey) => currentConditions.includes(condKey);

  const handleToggle = (condKey) => {
    if (activeTab === 'player') {
      onToggleCondition(condKey, 'player');
    } else {
      onToggleCondition(condKey, 'companion', activeTab);
    }
  };

  // For exhaustion, only allow one level at a time
  const handleExhaustionToggle = (condKey) => {
    const currentExhaustion = currentConditions.find(k => k.startsWith('exhaustion_'));
    if (currentExhaustion === condKey) {
      // Remove it
      handleToggle(condKey);
    } else {
      // Remove old exhaustion, add new
      if (currentExhaustion) {
        handleToggle(currentExhaustion);
      }
      handleToggle(condKey);
    }
  };

  // Group conditions by category (exclude exhaustion, handle separately)
  const conditionsByCategory = {};
  for (const [key, cond] of Object.entries(CONDITIONS)) {
    if (cond.category === 'exhaustion') continue;
    if (!conditionsByCategory[cond.category]) {
      conditionsByCategory[cond.category] = [];
    }
    conditionsByCategory[cond.category].push({ key, ...cond });
  }

  const exhaustionLevels = Object.entries(CONDITIONS)
    .filter(([k]) => k.startsWith('exhaustion_'))
    .map(([key, cond]) => ({ key, ...cond }));

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '380px',
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
        padding: '1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, color: ACCENT }}>Conditions</h3>
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
          ×
        </button>
      </div>

      {/* Tabs (Player + Companions) */}
      {tabs.length > 1 && (
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          padding: '0 0.5rem',
          gap: '0.25rem',
          overflowX: 'auto'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: '0.5rem 0.75rem',
                background: activeTab === tab.key ? `${ACCENT}22` : 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.key ? `2px solid ${ACCENT}` : '2px solid transparent',
                color: activeTab === tab.key ? ACCENT : '#aaa',
                cursor: 'pointer',
                fontSize: '0.85rem',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Condition Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem' }}>
        {Object.entries(conditionsByCategory).map(([catKey, conditions]) => (
          <div key={catKey} style={{ marginBottom: '1rem' }}>
            <div style={{
              fontSize: '0.75rem',
              color: CONDITION_CATEGORIES[catKey]?.color || '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.4rem',
              fontWeight: 'bold'
            }}>
              {CONDITION_CATEGORIES[catKey]?.label || catKey}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
              {conditions.map(cond => {
                const active = isActive(cond.key);
                return (
                  <button
                    key={cond.key}
                    onClick={() => handleToggle(cond.key)}
                    onMouseEnter={() => setHoveredCondition(cond.key)}
                    onMouseLeave={() => setHoveredCondition(null)}
                    title={cond.description}
                    style={{
                      padding: '0.35rem 0.6rem',
                      borderRadius: '4px',
                      border: `1px solid ${active ? cond.color : 'rgba(255,255,255,0.15)'}`,
                      background: active ? `${cond.color}33` : 'rgba(255,255,255,0.05)',
                      color: active ? cond.color : '#aaa',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                      fontWeight: active ? 'bold' : 'normal',
                      transition: 'all 0.15s'
                    }}
                  >
                    {cond.name}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* Exhaustion Section */}
        <div style={{ marginBottom: '1rem' }}>
          <div style={{
            fontSize: '0.75rem',
            color: '#f59e0b',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '0.4rem',
            fontWeight: 'bold'
          }}>
            Exhaustion
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {exhaustionLevels.map(cond => {
              const active = isActive(cond.key);
              const level = cond.key.split('_')[1];
              return (
                <button
                  key={cond.key}
                  onClick={() => handleExhaustionToggle(cond.key)}
                  onMouseEnter={() => setHoveredCondition(cond.key)}
                  onMouseLeave={() => setHoveredCondition(null)}
                  title={cond.description}
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    border: `2px solid ${active ? cond.color : 'rgba(255,255,255,0.15)'}`,
                    background: active ? `${cond.color}33` : 'rgba(255,255,255,0.05)',
                    color: active ? cond.color : '#aaa',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s'
                  }}
                >
                  {level}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tooltip / Description for hovered condition */}
        {hoveredCondition && CONDITIONS[hoveredCondition] && (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '6px',
            border: `1px solid ${CONDITIONS[hoveredCondition].color}44`
          }}>
            <div style={{
              color: CONDITIONS[hoveredCondition].color,
              fontWeight: 'bold',
              marginBottom: '0.3rem',
              fontSize: '0.9rem'
            }}>
              {CONDITIONS[hoveredCondition].name}
            </div>
            <div style={{ color: '#ccc', fontSize: '0.8rem', lineHeight: '1.4' }}>
              {CONDITIONS[hoveredCondition].description}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
