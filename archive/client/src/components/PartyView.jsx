import React, { useState } from 'react';

const ACCENT = '#f97316';

const ABILITY_NAMES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const ABILITY_LABELS = { str: 'STR', dex: 'DEX', con: 'CON', int: 'INT', wis: 'WIS', cha: 'CHA' };

function abilityModifier(score) {
  const mod = Math.floor((score - 10) / 2);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

function hpColor(current, max) {
  if (max <= 0) return '#888';
  const pct = current / max;
  if (pct > 0.5) return '#22c55e';
  if (pct > 0.25) return '#eab308';
  return '#ef4444';
}

function CollapsibleSection({ label, color, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent',
          border: 'none',
          color: color || '#ccc',
          cursor: 'pointer',
          padding: '0.25rem 0',
          fontSize: '0.7rem',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          width: '100%'
        }}
      >
        <span style={{ fontSize: '0.6rem', transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          &#9654;
        </span>
        {label}
      </button>
      {open && (
        <div style={{ paddingLeft: '0.5rem', paddingTop: '0.25rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function PersonalityItem({ label, value, color }) {
  if (!value) return null;
  return (
    <div style={{ marginBottom: '0.35rem' }}>
      <span style={{ color: color || '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}:
      </span>
      <span style={{ color: '#ccc', fontSize: '0.8rem', marginLeft: '0.35rem' }}>
        {Array.isArray(value) ? value.join(', ') : value}
      </span>
    </div>
  );
}

const XP_THRESHOLDS = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

const HIT_DICE = {
  'Barbarian': 12, 'Fighter': 10, 'Paladin': 10, 'Ranger': 10,
  'Bard': 8, 'Cleric': 8, 'Druid': 8, 'Monk': 8, 'Rogue': 8, 'Warlock': 8,
  'Sorcerer': 6, 'Wizard': 6
};

export default function PartyView({ party, onClose, onUpdateHp, onAwardXp, onAwardLoot, onLevelUp, onUpdateSpellSlot, onLongRest, sessionId }) {
  const [activeTab, setActiveTab] = useState(0);
  const [xpAmount, setXpAmount] = useState('');
  const [xpMode, setXpMode] = useState('party'); // 'party' or 'individual'
  const [lootItem, setLootItem] = useState('');
  const [goldAmount, setGoldAmount] = useState('');
  const [levelUpHp, setLevelUpHp] = useState(null); // { charName, rolled: false, amount: 0 }

  if (!party?.characters?.length) return null;

  const characters = party.characters;
  const char = characters[activeTab] || characters[0];
  const charColor = char.color || '#60a5fa';

  const scores = char.ability_scores || {};
  const maxHp = char.max_hp || 0;
  const currentHp = char.current_hp ?? maxHp;
  const hpPct = maxHp > 0 ? Math.max(0, Math.min(1, currentHp / maxHp)) : 0;
  const hpBarColor = hpColor(currentHp, maxHp);

  const hasSpells = (char.known_cantrips?.length > 0) || (char.known_spells?.length > 0);
  const spellSlots = char.spell_slots || {};
  const spellSlotsUsed = char.spell_slots_used || {};

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '420px',
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
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: `linear-gradient(135deg, ${ACCENT}15 0%, transparent 100%)`
      }}>
        <div>
          <h3 style={{ margin: 0, color: ACCENT, fontSize: '1rem' }}>
            {party.name || 'Party'}
          </h3>
          <span style={{ color: '#888', fontSize: '0.75rem' }}>
            {characters.length} member{characters.length !== 1 ? 's' : ''}
          </span>
        </div>
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

      {/* Character Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 0.25rem',
        overflowX: 'auto',
        flexShrink: 0
      }}>
        {characters.map((c, idx) => {
          const tabColor = c.color || '#60a5fa';
          const isActive = idx === activeTab;
          return (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              style={{
                flex: 1,
                padding: '0.5rem 0.4rem',
                background: isActive ? `${tabColor}15` : 'transparent',
                border: 'none',
                borderBottom: isActive ? `2px solid ${tabColor}` : '2px solid transparent',
                color: isActive ? tabColor : '#888',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isActive ? 'bold' : 'normal',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
                transition: 'all 0.2s'
              }}
            >
              {c.name?.split(' ')[0] || c.name}
            </button>
          );
        })}
      </div>

      {/* Character Card — Scrollable */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem 1rem'
      }}>
        {/* 1. Header: Name, Race/Class/Level, Alignment */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '1.15rem', fontWeight: 'bold', color: charColor }}>
              {char.name}
            </span>
            {char.alignment && (
              <span style={{
                padding: '0.15rem 0.45rem',
                background: `${charColor}20`,
                border: `1px solid ${charColor}40`,
                borderRadius: '3px',
                color: charColor,
                fontSize: '0.65rem',
                fontWeight: 'bold',
                letterSpacing: '0.05em',
                textTransform: 'uppercase'
              }}>
                {char.alignment}
              </span>
            )}
          </div>
          <div style={{ color: '#aaa', fontSize: '0.8rem', marginTop: '0.2rem' }}>
            {char.gender && `${char.gender} `}
            {char.subrace || char.race}
            {char.class && ` ${char.class}`}
            {char.subclass && ` (${char.subclass})`}
            {char.level && ` - Level ${char.level}`}
          </div>
          {char.background && (
            <div style={{ color: '#777', fontSize: '0.75rem', marginTop: '0.15rem' }}>
              {char.background} background
            </div>
          )}
        </div>

        {/* 2. HP Bar */}
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.5rem 0.6rem',
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '6px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
            <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Hit Points
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <button
                onClick={() => onUpdateHp && onUpdateHp(char.name, Math.max(0, currentHp - 1))}
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#ef4444',
                  width: '22px',
                  height: '22px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                -
              </button>
              <span style={{ color: hpBarColor, fontWeight: 'bold', fontSize: '0.95rem', minWidth: '3.5rem', textAlign: 'center' }}>
                {currentHp} / {maxHp}
              </span>
              <button
                onClick={() => onUpdateHp && onUpdateHp(char.name, Math.min(maxHp, currentHp + 1))}
                style={{
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#22c55e',
                  width: '22px',
                  height: '22px',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 'bold',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  lineHeight: 1
                }}
              >
                +
              </button>
            </div>
          </div>
          <div style={{
            height: '8px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${hpPct * 100}%`,
              background: hpBarColor,
              borderRadius: '4px',
              transition: 'width 0.3s, background 0.3s'
            }} />
          </div>
          {/* AC, Speed row */}
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.4rem' }}>
            {char.armor_class != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '0.85rem' }}>{char.armor_class}</span>
                <span style={{ color: '#666', fontSize: '0.7rem' }}>AC</span>
              </div>
            )}
            {char.speed != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#ccc', fontWeight: 'bold', fontSize: '0.85rem' }}>{char.speed}</span>
                <span style={{ color: '#666', fontSize: '0.7rem' }}>ft</span>
              </div>
            )}
            {char.gold_gp != null && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '0.85rem' }}>{char.gold_gp}</span>
                <span style={{ color: '#666', fontSize: '0.7rem' }}>gp</span>
              </div>
            )}
          </div>
        </div>

        {/* 2b. XP & Level Up */}
        {sessionId && (() => {
          const charXp = char.xp || 0;
          const level = char.level || 1;
          const nextLevelXp = XP_THRESHOLDS[level + 1] || null;
          const prevLevelXp = XP_THRESHOLDS[level] || 0;
          const xpProgress = nextLevelXp ? (charXp - prevLevelXp) / (nextLevelXp - prevLevelXp) : 1;
          const canLevelUp = nextLevelXp && charXp >= nextLevelXp;
          const hitDie = HIT_DICE[char.class] || 8;
          const conMod = Math.floor(((char.ability_scores?.con || 10) - 10) / 2);
          const avgHp = Math.floor(hitDie / 2) + 1 + conMod;

          return (
            <div style={{
              marginBottom: '0.75rem',
              padding: '0.5rem 0.6rem',
              background: canLevelUp ? 'rgba(234, 179, 8, 0.08)' : 'rgba(255,255,255,0.03)',
              borderRadius: '6px',
              border: canLevelUp ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(255,255,255,0.05)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <span style={{ color: '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Experience
                </span>
                <span style={{ color: canLevelUp ? '#eab308' : '#aaa', fontWeight: 'bold', fontSize: '0.85rem' }}>
                  {charXp.toLocaleString()} {nextLevelXp ? `/ ${nextLevelXp.toLocaleString()}` : '(MAX)'}
                </span>
              </div>
              {/* XP Progress Bar */}
              <div style={{
                height: '6px',
                background: 'rgba(255,255,255,0.08)',
                borderRadius: '3px',
                overflow: 'hidden',
                marginBottom: '0.4rem'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(1, Math.max(0, xpProgress)) * 100}%`,
                  background: canLevelUp ? '#eab308' : charColor,
                  borderRadius: '3px',
                  transition: 'width 0.3s'
                }} />
              </div>

              {/* Award XP */}
              <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', marginBottom: canLevelUp ? '0.5rem' : 0 }}>
                <input
                  type="number"
                  value={xpAmount}
                  onChange={e => setXpAmount(e.target.value)}
                  placeholder="XP"
                  min="1"
                  style={{
                    width: '70px', padding: '0.25rem 0.4rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                    color: '#fff', fontSize: '0.75rem'
                  }}
                />
                <button
                  onClick={() => {
                    const amt = parseInt(xpAmount);
                    if (amt > 0 && onAwardXp) {
                      onAwardXp(amt, xpMode === 'individual' ? char.name : null);
                      setXpAmount('');
                    }
                  }}
                  style={{
                    padding: '0.25rem 0.5rem', background: `${charColor}30`,
                    border: `1px solid ${charColor}50`, borderRadius: '3px',
                    color: charColor, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'
                  }}
                >
                  {xpMode === 'individual' ? 'Award' : 'Split Party'}
                </button>
                <button
                  onClick={() => setXpMode(xpMode === 'party' ? 'individual' : 'party')}
                  style={{
                    padding: '0.25rem 0.4rem', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                    color: '#888', fontSize: '0.65rem', cursor: 'pointer'
                  }}
                  title={xpMode === 'party' ? 'Switch to individual award' : 'Switch to party split'}
                >
                  {xpMode === 'party' ? 'Party' : 'Solo'}
                </button>
              </div>

              {/* Level Up */}
              {canLevelUp && (
                <div style={{
                  padding: '0.4rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.25)',
                  borderRadius: '4px'
                }}>
                  <div style={{ color: '#eab308', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.3rem' }}>
                    Ready to level up to {level + 1}!
                  </div>
                  <div style={{ color: '#999', fontSize: '0.7rem', marginBottom: '0.3rem' }}>
                    Hit Die: d{hitDie} + {conMod >= 0 ? '+' : ''}{conMod} CON (avg {avgHp})
                  </div>
                  <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    <button
                      onClick={() => {
                        const roll = Math.floor(Math.random() * hitDie) + 1;
                        const total = Math.max(1, roll + conMod);
                        setLevelUpHp({ charName: char.name, amount: total, rolled: true, roll, conMod });
                      }}
                      style={{
                        padding: '0.25rem 0.5rem', background: 'rgba(234, 179, 8, 0.2)',
                        border: '1px solid rgba(234, 179, 8, 0.4)', borderRadius: '3px',
                        color: '#eab308', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'
                      }}
                    >
                      Roll d{hitDie}
                    </button>
                    <button
                      onClick={() => {
                        setLevelUpHp({ charName: char.name, amount: avgHp, rolled: false });
                      }}
                      style={{
                        padding: '0.25rem 0.5rem', background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                        color: '#aaa', fontSize: '0.7rem', cursor: 'pointer'
                      }}
                    >
                      Take Average ({avgHp})
                    </button>
                  </div>
                  {levelUpHp && levelUpHp.charName === char.name && (
                    <div style={{ marginTop: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span style={{ color: '#eab308', fontSize: '0.8rem', fontWeight: 'bold' }}>
                        +{levelUpHp.amount} HP
                        {levelUpHp.rolled && <span style={{ color: '#999', fontSize: '0.7rem' }}> (rolled {levelUpHp.roll} + {levelUpHp.conMod} CON)</span>}
                      </span>
                      <button
                        onClick={() => {
                          if (onLevelUp) onLevelUp(char.name, levelUpHp.amount);
                          setLevelUpHp(null);
                        }}
                        style={{
                          padding: '0.2rem 0.6rem', background: '#eab308',
                          border: 'none', borderRadius: '3px',
                          color: '#000', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'
                        }}
                      >
                        Confirm Level Up
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* 3. Ability Scores */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '0.35rem',
          marginBottom: '0.75rem'
        }}>
          {ABILITY_NAMES.map(ab => {
            const score = scores[ab] ?? 10;
            const mod = abilityModifier(score);
            return (
              <div key={ab} style={{
                textAlign: 'center',
                padding: '0.35rem 0.15rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <div style={{ color: '#888', fontSize: '0.6rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {ABILITY_LABELS[ab]}
                </div>
                <div style={{ color: '#eee', fontWeight: 'bold', fontSize: '1rem', lineHeight: 1.2 }}>
                  {score}
                </div>
                <div style={{ color: charColor, fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {mod}
                </div>
              </div>
            );
          })}
        </div>

        {/* 4. Equipment */}
        <div style={{ marginBottom: '0.75rem' }}>
          <div style={{ color: charColor, fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
            Equipment
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {char.equipment?.mainHand && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <span style={{ color: '#888', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', minWidth: '3rem' }}>Main</span>
                <span style={{ color: '#ccc', fontSize: '0.8rem', flex: 1 }}>{char.equipment.mainHand.name}</span>
                {char.equipment.mainHand.damage && (
                  <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>
                    {char.equipment.mainHand.damage} {char.equipment.mainHand.damageType || ''}
                  </span>
                )}
              </div>
            )}
            {char.equipment?.offHand && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <span style={{ color: '#888', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', minWidth: '3rem' }}>Off</span>
                <span style={{ color: '#ccc', fontSize: '0.8rem', flex: 1 }}>
                  {typeof char.equipment.offHand === 'string' ? char.equipment.offHand : char.equipment.offHand.name}
                </span>
              </div>
            )}
            {char.equipment?.armor && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.3rem 0.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                border: '1px solid rgba(255,255,255,0.05)'
              }}>
                <span style={{ color: '#888', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase', minWidth: '3rem' }}>Armor</span>
                <span style={{ color: '#ccc', fontSize: '0.8rem', flex: 1 }}>
                  {typeof char.equipment.armor === 'string' ? char.equipment.armor : char.equipment.armor.name}
                </span>
              </div>
            )}
            {(!char.equipment?.mainHand && !char.equipment?.offHand && !char.equipment?.armor) && (
              <span style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic' }}>No equipment</span>
            )}
          </div>
        </div>

        {/* 5. Spells (if any) */}
        {hasSpells && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ color: charColor, fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
              Spells
            </div>
            {/* Spell Slots */}
            {Object.keys(spellSlots).length > 0 && (
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                flexWrap: 'wrap',
                marginBottom: '0.4rem',
                padding: '0.35rem 0.5rem',
                background: 'rgba(255,255,255,0.03)',
                borderRadius: '4px',
                alignItems: 'center'
              }}>
                {Object.entries(spellSlots).map(([level, total]) => {
                  const used = spellSlotsUsed[level] || 0;
                  const remaining = total - used;
                  return (
                    <div key={level} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <span style={{ color: '#888', fontSize: '0.7rem' }}>Lv{level}:</span>
                      <div style={{ display: 'flex', gap: '3px' }}>
                        {Array.from({ length: total }).map((_, i) => {
                          const isFilled = i < remaining;
                          return (
                            <div
                              key={i}
                              onClick={() => {
                                if (!onUpdateSpellSlot || !sessionId) return;
                                onUpdateSpellSlot(char.name, level, isFilled ? used + 1 : Math.max(0, used - 1));
                              }}
                              title={isFilled ? `Use Lv${level} slot` : `Restore Lv${level} slot`}
                              style={{
                                width: '10px',
                                height: '10px',
                                borderRadius: '50%',
                                background: isFilled ? charColor : 'rgba(255,255,255,0.1)',
                                border: `1px solid ${isFilled ? charColor : 'rgba(255,255,255,0.2)'}`,
                                cursor: sessionId ? 'pointer' : 'default',
                                transition: 'all 0.15s'
                              }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {sessionId && onLongRest && (
                  <button
                    onClick={onLongRest}
                    title="Long Rest: restore all HP and spell slots"
                    style={{
                      marginLeft: 'auto',
                      padding: '0.15rem 0.5rem',
                      background: 'transparent',
                      border: '1px solid rgba(46,204,113,0.4)',
                      borderRadius: '3px',
                      color: '#2ecc71',
                      cursor: 'pointer',
                      fontSize: '0.65rem',
                      fontWeight: 'bold'
                    }}
                  >
                    Long Rest
                  </button>
                )}
              </div>
            )}
            {/* Cantrips */}
            {char.known_cantrips?.length > 0 && (
              <div style={{ marginBottom: '0.3rem' }}>
                <span style={{ color: '#888', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Cantrips: </span>
                <span style={{ color: '#ccc', fontSize: '0.78rem' }}>
                  {char.known_cantrips.join(', ')}
                </span>
              </div>
            )}
            {/* Known Spells */}
            {char.known_spells?.length > 0 && (
              <div>
                <span style={{ color: '#888', fontSize: '0.65rem', fontWeight: 'bold', textTransform: 'uppercase' }}>Spells: </span>
                <span style={{ color: '#ccc', fontSize: '0.78rem' }}>
                  {char.known_spells.join(', ')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 6. Skills */}
        {char.skill_proficiencies?.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ color: charColor, fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
              Skill Proficiencies
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
              {char.skill_proficiencies.map((skill, i) => (
                <span key={i} style={{
                  padding: '0.15rem 0.4rem',
                  background: `${charColor}15`,
                  border: `1px solid ${charColor}30`,
                  borderRadius: '3px',
                  color: charColor,
                  fontSize: '0.72rem'
                }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 7. Inventory */}
        <CollapsibleSection label={`Inventory${char.inventory?.length ? ` (${char.inventory.length})` : ''}`} color={charColor}>
          {char.inventory?.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.4rem' }}>
              {char.inventory.map((item, i) => {
                const itemName = typeof item === 'string' ? item : item.name;
                const qty = typeof item === 'object' ? (item.quantity || 1) : 1;
                return (
                  <span key={i} style={{
                    padding: '0.12rem 0.35rem',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '3px',
                    color: '#aaa',
                    fontSize: '0.72rem'
                  }}>
                    {itemName}{qty > 1 ? ` x${qty}` : ''}
                  </span>
                );
              })}
            </div>
          ) : (
            <div style={{ color: '#666', fontSize: '0.75rem', fontStyle: 'italic', marginBottom: '0.4rem' }}>No items</div>
          )}
          {/* Award Loot */}
          {sessionId && (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={lootItem}
                onChange={e => setLootItem(e.target.value)}
                placeholder="Item name"
                style={{
                  flex: 1, minWidth: '100px', padding: '0.25rem 0.4rem', background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '3px',
                  color: '#fff', fontSize: '0.75rem'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && lootItem.trim() && onAwardLoot) {
                    onAwardLoot(char.name, [lootItem.trim()], 0);
                    setLootItem('');
                  }
                }}
              />
              <button
                onClick={() => {
                  if (lootItem.trim() && onAwardLoot) {
                    onAwardLoot(char.name, [lootItem.trim()], 0);
                    setLootItem('');
                  }
                }}
                style={{
                  padding: '0.25rem 0.4rem', background: `${charColor}30`,
                  border: `1px solid ${charColor}50`, borderRadius: '3px',
                  color: charColor, fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                +Item
              </button>
              <input
                type="number"
                value={goldAmount}
                onChange={e => setGoldAmount(e.target.value)}
                placeholder="GP"
                min="1"
                style={{
                  width: '55px', padding: '0.25rem 0.4rem', background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '3px',
                  color: '#d4af37', fontSize: '0.75rem'
                }}
              />
              <button
                onClick={() => {
                  const gp = parseInt(goldAmount);
                  if (gp > 0 && onAwardLoot) {
                    onAwardLoot(char.name, [], gp);
                    setGoldAmount('');
                  }
                }}
                style={{
                  padding: '0.25rem 0.4rem', background: 'rgba(212, 175, 55, 0.15)',
                  border: '1px solid rgba(212, 175, 55, 0.3)', borderRadius: '3px',
                  color: '#d4af37', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                +Gold
              </button>
            </div>
          )}
        </CollapsibleSection>

        {/* 8. Personality */}
        <CollapsibleSection label="Personality" color={charColor}>
          <PersonalityItem label="Traits" value={char.personality_traits} color={charColor} />
          <PersonalityItem label="Ideals" value={char.ideals} color={charColor} />
          <PersonalityItem label="Bonds" value={char.bonds} color={charColor} />
          <PersonalityItem label="Flaws" value={char.flaws} color={charColor} />
          <PersonalityItem label="Speaking Style" value={char.speaking_style} color={charColor} />
          <PersonalityItem label="Motivation" value={char.motivation} color={charColor} />
          <PersonalityItem label="Fear" value={char.fear} color={charColor} />
          <PersonalityItem label="Secret" value={char.secret} color={charColor} />
          <PersonalityItem label="Quirk" value={char.quirk} color={charColor} />
          <PersonalityItem label="Combat Style" value={char.combat_style} color={charColor} />
          <PersonalityItem label="Social Style" value={char.social_style} color={charColor} />
          <PersonalityItem label="Moral Tendencies" value={char.moral_tendencies} color={charColor} />
        </CollapsibleSection>

        {/* 9. Relationships */}
        {char.party_relationships && Object.keys(char.party_relationships).length > 0 && (
          <CollapsibleSection label="Party Relationships" color={charColor} defaultOpen={true}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              {Object.entries(char.party_relationships).map(([name, rel]) => {
                const attitudeColors = {
                  friendly: '#22c55e',
                  neutral: '#eab308',
                  wary: '#f97316',
                  hostile: '#ef4444',
                  trusting: '#60a5fa',
                  respectful: '#a78bfa',
                  protective: '#10b981'
                };
                const attColor = attitudeColors[(rel.attitude || '').toLowerCase()] || '#888';
                return (
                  <div key={name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.3rem 0.5rem',
                    background: 'rgba(255,255,255,0.03)',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}>
                    <span style={{ color: '#ccc', fontSize: '0.8rem', flex: 1 }}>{name}</span>
                    <span style={{
                      padding: '0.1rem 0.35rem',
                      background: `${attColor}20`,
                      border: `1px solid ${attColor}40`,
                      borderRadius: '3px',
                      color: attColor,
                      fontSize: '0.65rem',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {rel.attitude || 'unknown'}
                    </span>
                    {rel.tension && (
                      <span style={{
                        padding: '0.1rem 0.35rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '3px',
                        color: '#ef4444',
                        fontSize: '0.6rem'
                      }}>
                        {rel.tension}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Party Tensions (global) */}
        {party.tensions?.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <div style={{ color: ACCENT, fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.35rem' }}>
              Party Tensions
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {party.tensions.map((tension, i) => (
                <div key={i} style={{
                  padding: '0.35rem 0.5rem',
                  background: 'rgba(249, 115, 22, 0.08)',
                  border: '1px solid rgba(249, 115, 22, 0.2)',
                  borderRadius: '4px',
                  color: '#ccc',
                  fontSize: '0.78rem'
                }}>
                  {typeof tension === 'string' ? tension : tension.description || JSON.stringify(tension)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.75rem',
        color: '#666',
        flexShrink: 0
      }}>
        <span>{party.name || 'Party'}</span>
        <span style={{ color: charColor }}>
          {char.name} - Lv{char.level || '?'}
        </span>
      </div>
    </div>
  );
}
