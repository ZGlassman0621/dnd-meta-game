import { useState, useMemo } from 'react';
import spellsData from '../data/spells/index.js';

const ACCENT = '#6366f1';

const SCHOOL_COLORS = {
  Abjuration: '#3b82f6', Conjuration: '#22c55e', Divination: '#a855f7', Enchantment: '#ec4899',
  Evocation: '#ef4444', Illusion: '#6366f1', Necromancy: '#6b7280', Transmutation: '#eab308'
};

const LEVEL_TABS = ['all', 'cantrip', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];

export default function SpellReferencePanel({ onClose }) {
  const [levelFilter, setLevelFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [concentrationOnly, setConcentrationOnly] = useState(false);
  const [ritualOnly, setRitualOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedSpell, setExpandedSpell] = useState(null);

  // Normalize all spells into a flat deduplicated array
  const { allSpells, allClasses } = useMemo(() => {
    const result = [];
    const classSet = new Set();

    // Dedup cantrips across classes
    const cantripMap = new Map();
    for (const [className, cantrips] of Object.entries(spellsData.cantrips || {})) {
      classSet.add(className);
      for (const spell of cantrips) {
        if (cantripMap.has(spell.name)) {
          cantripMap.get(spell.name).classes.push(className);
        } else {
          cantripMap.set(spell.name, {
            ...spell,
            level: 'cantrip',
            classes: [className],
            concentration: spell.duration?.startsWith('Concentration') || false
          });
        }
      }
    }
    result.push(...cantripMap.values());

    // Levels 1-9
    for (const [level, spells] of Object.entries(spellsData.spells || {})) {
      for (const spell of spells) {
        const classes = spell.classes || [];
        classes.forEach(c => classSet.add(c));
        result.push({
          ...spell,
          level,
          classes,
          concentration: spell.duration?.startsWith('Concentration') || false
        });
      }
    }

    result.sort((a, b) => a.name.localeCompare(b.name));
    const allClasses = [...classSet].sort();
    return { allSpells: result, allClasses };
  }, []);

  // Apply filters
  const filtered = useMemo(() => {
    return allSpells.filter(s => {
      if (levelFilter !== 'all' && s.level !== levelFilter) return false;
      if (classFilter !== 'all' && !s.classes?.includes(classFilter)) return false;
      if (concentrationOnly && !s.concentration) return false;
      if (ritualOnly && !s.ritual) return false;
      if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [allSpells, levelFilter, classFilter, concentrationOnly, ritualOnly, search]);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>Spell Reference</h3>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {/* Level tabs */}
      <div style={{ display: 'flex', gap: '0.15rem', padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, overflowX: 'auto' }}>
        {LEVEL_TABS.map(lvl => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            style={{
              padding: '0.15rem 0.35rem', borderRadius: '3px', fontSize: '0.68rem', whiteSpace: 'nowrap',
              background: levelFilter === lvl ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${levelFilter === lvl ? ACCENT : 'rgba(255,255,255,0.12)'}`,
              color: levelFilter === lvl ? ACCENT : '#888', cursor: 'pointer',
              fontWeight: levelFilter === lvl ? 'bold' : 'normal'
            }}
          >{lvl === 'all' ? 'All' : lvl === 'cantrip' ? 'Cantrip' : lvl}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          type="text" placeholder="Search..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: '100px', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd', fontSize: '0.75rem', outline: 'none' }}
        />
        <select
          value={classFilter} onChange={e => setClassFilter(e.target.value)}
          style={{ padding: '0.3rem', background: 'rgba(255,255,255,0.05)', border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd', fontSize: '0.7rem', outline: 'none' }}
        >
          <option value="all">All Classes</option>
          {allClasses.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <TogglePill label="Conc" active={concentrationOnly} onClick={() => setConcentrationOnly(!concentrationOnly)} />
        <TogglePill label="Ritual" active={ritualOnly} onClick={() => setRitualOnly(!ritualOnly)} />
      </div>

      {/* Count */}
      <div style={{ padding: '0.2rem 0.75rem', color: '#666', fontSize: '0.7rem', flexShrink: 0 }}>
        {filtered.length} spell{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* Spell list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.5rem 0.5rem' }}>
        {filtered.map(spell => {
          const isExpanded = expandedSpell === spell.name + spell.level;
          const schoolColor = SCHOOL_COLORS[spell.school] || '#888';
          return (
            <div key={spell.name + spell.level} style={{ marginBottom: '0.15rem' }}>
              {/* Collapsed row */}
              <button
                onClick={() => setExpandedSpell(isExpanded ? null : spell.name + spell.level)}
                style={{
                  width: '100%', padding: '0.35rem 0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem',
                  background: isExpanded ? `${schoolColor}0a` : 'transparent',
                  border: `1px solid ${isExpanded ? `${schoolColor}30` : 'rgba(255,255,255,0.04)'}`,
                  borderRadius: '4px', cursor: 'pointer', textAlign: 'left'
                }}
              >
                {/* School dot */}
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: schoolColor, flexShrink: 0 }} />
                {/* Name */}
                <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.8rem', flex: 1 }}>{spell.name}</span>
                {/* Badges */}
                {spell.concentration && <span style={concBadge}>C</span>}
                {spell.ritual && <span style={ritualBadge}>R</span>}
                {/* Level */}
                <span style={{ color: '#777', fontSize: '0.68rem', whiteSpace: 'nowrap' }}>
                  {spell.level === 'cantrip' ? 'cantrip' : spell.level}
                </span>
              </button>

              {/* Expanded card */}
              {isExpanded && (
                <div style={{
                  margin: '0.15rem 0 0.3rem', padding: '0.5rem 0.6rem',
                  background: `${schoolColor}08`, border: `1px solid ${schoolColor}20`,
                  borderRadius: '6px', borderLeft: `3px solid ${schoolColor}`
                }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.4rem', fontSize: '0.72rem' }}>
                    <SpellDetail label="School" value={spell.school} color={schoolColor} />
                    <SpellDetail label="Cast" value={spell.castingTime} />
                    <SpellDetail label="Range" value={spell.range} />
                    <SpellDetail label="Duration" value={spell.duration} />
                    {spell.components && <SpellDetail label="Comp." value={spell.components} />}
                  </div>
                  {spell.classes?.length > 0 && (
                    <div style={{ marginBottom: '0.4rem' }}>
                      {spell.classes.map(c => (
                        <span key={c} style={{ display: 'inline-block', padding: '0.05rem 0.3rem', marginRight: '0.25rem', marginBottom: '0.15rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', fontSize: '0.62rem', color: '#aaa' }}>
                          {c}
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ color: '#bbb', fontSize: '0.78rem', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                    {spell.description}
                  </div>
                  {spell.damage && (
                    <div style={{ marginTop: '0.3rem' }}>
                      <span style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', color: '#ef4444' }}>
                        {spell.damage}
                      </span>
                    </div>
                  )}
                  {spell.healing && (
                    <div style={{ marginTop: '0.3rem' }}>
                      <span style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '0.1rem 0.4rem', fontSize: '0.72rem', color: '#22c55e' }}>
                        {spell.healing}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SpellDetail({ label, value, color }) {
  return (
    <span>
      <span style={{ color: color || '#888', fontWeight: 'bold' }}>{label}: </span>
      <span style={{ color: '#ccc' }}>{value}</span>
    </span>
  );
}

function TogglePill({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.15rem 0.4rem', borderRadius: '10px', fontSize: '0.68rem',
      background: active ? `${ACCENT}25` : 'transparent',
      border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.15)'}`,
      color: active ? ACCENT : '#888', cursor: 'pointer', fontWeight: active ? 'bold' : 'normal'
    }}>{label}</button>
  );
}

// ============================================================
// STYLES
// ============================================================

const panelStyle = {
  position: 'fixed', top: 0, right: 0, width: '420px', maxWidth: '90vw', height: '100vh',
  background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
  borderLeft: `1px solid ${ACCENT}44`, boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
  zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden'
};

const headerStyle = {
  padding: '0.75rem 1rem', borderBottom: `1px solid ${ACCENT}33`,
  display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
};

const closeBtnStyle = { background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' };

const concBadge = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '16px', height: '16px', borderRadius: '50%', fontSize: '0.55rem', fontWeight: 'bold',
  background: 'rgba(168,85,247,0.2)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.3)'
};

const ritualBadge = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '16px', height: '16px', borderRadius: '50%', fontSize: '0.55rem', fontWeight: 'bold',
  background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)'
};
