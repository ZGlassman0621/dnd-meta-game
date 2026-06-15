import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#10b981';

const CATEGORIES = [
  { type: 'npc', label: 'NPCs', color: '#f97316' },
  { type: 'enemy', label: 'Enemies', color: '#ef4444' },
  { type: 'location', label: 'Locations', color: '#22c55e' },
  { type: 'lore', label: 'Lore', color: '#a855f7' },
  { type: 'treasure', label: 'Treasure', color: '#eab308' },
  { type: 'session_notes', label: 'Sessions', color: '#3b82f6' },
];

const CR_XP = {
  '0': 10, '1/8': 25, '1/4': 50, '1/2': 100,
  '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800,
  '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900,
  '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000,
  '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000,
  '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
};

const ABILITY_NAMES = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

function abilityMod(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

export default function PrepReferencePanel({ partyId, onClose }) {
  const [activeType, setActiveType] = useState('npc');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('type', activeType);
      if (search) params.set('search', search);
      const res = await fetch(`/api/dm-mode/prep/${partyId}?${params}`);
      if (res.ok) setItems(await res.json());
    } catch (err) {
      console.error('Failed to load prep items:', err);
    } finally {
      setLoading(false);
    }
  }, [partyId, activeType, search]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const activeCat = CATEGORIES.find(c => c.type === activeType);

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0,
      width: '420px', maxWidth: '90vw', height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: `1px solid ${ACCENT}44`,
      boxShadow: '-5px 0 20px rgba(0, 0, 0, 0.5)',
      zIndex: 1000, display: 'flex', flexDirection: 'column', overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem', borderBottom: `1px solid ${ACCENT}33`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0
      }}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>Prep Reference</h3>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: '1.2rem' }}
        >&times;</button>
      </div>

      {/* Category Tabs */}
      <div style={{
        display: 'flex', gap: '0.2rem', padding: '0.4rem 0.5rem',
        borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, flexWrap: 'wrap'
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat.type}
            onClick={() => { setActiveType(cat.type); setExpandedId(null); }}
            style={{
              padding: '0.15rem 0.45rem',
              background: activeType === cat.type ? `${cat.color}22` : 'transparent',
              border: `1px solid ${activeType === cat.type ? cat.color : 'rgba(255,255,255,0.15)'}`,
              borderRadius: '3px', color: activeType === cat.type ? cat.color : '#888',
              cursor: 'pointer', fontSize: '0.7rem', fontWeight: activeType === cat.type ? 'bold' : 'normal'
            }}
          >{cat.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input
          type="text"
          placeholder={`Search ${activeCat?.label}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.05)',
            border: `1px solid ${ACCENT}33`, borderRadius: '4px',
            color: '#ddd', fontSize: '0.8rem', outline: 'none', boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Item List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
        {loading ? (
          <div style={{ color: '#888', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ color: '#666', textAlign: 'center', padding: '2rem 0' }}>
            <div style={{ fontSize: '0.85rem' }}>No {activeCat?.label?.toLowerCase()} prepared yet.</div>
            <div style={{ fontSize: '0.75rem', marginTop: '0.3rem', color: '#555' }}>
              Add content in Campaign Prep from the party select screen.
            </div>
          </div>
        ) : (
          items.map(item => {
            const isExpanded = expandedId === item.id;
            return (
              <div key={item.id} style={{
                marginBottom: '0.4rem',
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${isExpanded ? `${activeCat?.color}40` : 'rgba(255,255,255,0.08)'}`,
                borderRadius: '6px', overflow: 'hidden'
              }}>
                {/* Clickable header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    width: '100%', padding: '0.5rem 0.65rem',
                    background: 'transparent', border: 'none',
                    color: activeCat?.color, cursor: 'pointer',
                    fontSize: '0.85rem', fontWeight: 'bold',
                    textAlign: 'left', display: 'flex',
                    justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <span>{item.name}</span>
                  <span style={{ color: '#666', fontSize: '0.7rem' }}>{isExpanded ? '-' : '+'}</span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div style={{ padding: '0 0.65rem 0.5rem' }}>
                    {activeType === 'enemy' ? (
                      <CompactStatBlock content={item.content} color={activeCat?.color} />
                    ) : (
                      <CompactFields content={item.content} type={activeType} />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '0.5rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)',
        color: '#555', fontSize: '0.7rem', textAlign: 'center', flexShrink: 0
      }}>
        {items.length} {activeCat?.label?.toLowerCase()} prepared
      </div>
    </div>
  );
}

// ============================================================
// COMPACT DISPLAY COMPONENTS
// ============================================================

function CompactFields({ content: c, type }) {
  const fields = [];

  if (type === 'npc') {
    if (c.race) fields.push({ label: 'Race', value: c.race });
    if (c.appearance) fields.push({ label: 'Appearance', value: c.appearance });
    if (c.personality) fields.push({ label: 'Personality', value: c.personality });
    if (c.voice) fields.push({ label: 'Voice', value: c.voice });
    if (c.motivations) fields.push({ label: 'Motivations', value: c.motivations });
    if (c.secrets) fields.push({ label: 'Secrets', value: c.secrets, color: '#e74c3c' });
    if (c.connections) fields.push({ label: 'Connections', value: c.connections });
    if (c.location) fields.push({ label: 'Location', value: c.location });
  } else if (type === 'location') {
    if (c.type) fields.push({ label: 'Type', value: c.type });
    if (c.description) fields.push({ label: 'Description', value: c.description });
    if (c.features) fields.push({ label: 'Features', value: c.features });
    if (c.atmosphere) fields.push({ label: 'Atmosphere', value: c.atmosphere });
    if (c.npcs_present) fields.push({ label: 'NPCs', value: c.npcs_present });
    if (c.encounters) fields.push({ label: 'Encounters', value: c.encounters });
    if (c.connections) fields.push({ label: 'Connections', value: c.connections });
    if (c.secrets) fields.push({ label: 'Secrets', value: c.secrets, color: '#e74c3c' });
  } else if (type === 'lore') {
    if (c.category) fields.push({ label: 'Category', value: c.category });
    if (c.content) fields.push({ label: 'Content', value: c.content });
    if (c.related) fields.push({ label: 'Related', value: c.related });
  } else if (type === 'treasure') {
    if (c.context) fields.push({ label: 'Context', value: c.context });
    if (c.gold > 0) fields.push({ label: 'Gold', value: `${c.gold} gp` });
    if ((c.items || []).length > 0) {
      fields.push({
        label: 'Items',
        value: c.items.map(i => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}${i.rarity !== 'Common' ? ` [${i.rarity}]` : ''}`).join(', ')
      });
    }
  } else if (type === 'session_notes') {
    if (c.session_number) fields.push({ label: 'Session', value: c.session_number });
    if (c.objectives) fields.push({ label: 'Objectives', value: c.objectives });
    if (c.npcs_involved) fields.push({ label: 'NPCs', value: c.npcs_involved });
    if (c.key_info) fields.push({ label: 'Key Info', value: c.key_info });
    if ((c.scenes || []).length > 0) {
      fields.push({
        label: 'Scenes',
        value: c.scenes.map(s => s.name || 'Unnamed').join(' > ')
      });
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {fields.map((f, i) => (
        <div key={i}>
          <span style={{ color: f.color || '#888', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{f.label}: </span>
          <span style={{ color: '#bbb', fontSize: '0.78rem' }}>{f.value}</span>
        </div>
      ))}
    </div>
  );
}

function CompactStatBlock({ content: c, color }) {
  const abilities = c.abilities || {};
  const xp = CR_XP[c.cr] || '—';

  return (
    <div style={{ fontSize: '0.78rem' }}>
      {/* Type line */}
      <div style={{ color: '#999', fontStyle: 'italic', marginBottom: '0.3rem', fontSize: '0.72rem' }}>
        {[c.size, c.type, c.alignment].filter(Boolean).join(', ')}
      </div>

      {/* Core line */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.3rem', flexWrap: 'wrap' }}>
        <span><strong style={{ color }}>AC</strong> <span style={{ color: '#ddd' }}>{c.ac || '—'}{c.ac_type ? ` (${c.ac_type})` : ''}</span></span>
        <span><strong style={{ color }}>HP</strong> <span style={{ color: '#ddd' }}>{c.hp || '—'}{c.hp_formula ? ` (${c.hp_formula})` : ''}</span></span>
        <span><strong style={{ color }}>Speed</strong> <span style={{ color: '#ddd' }}>{c.speed || '30 ft.'}</span></span>
        <span><strong style={{ color }}>CR</strong> <span style={{ color: '#ddd' }}>{c.cr || '—'} ({xp} XP)</span></span>
      </div>

      {/* Mini ability grid */}
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
        {ABILITY_NAMES.map(ab => (
          <div key={ab} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ color, fontSize: '0.6rem', fontWeight: 'bold' }}>{ab}</div>
            <div style={{ color: '#ddd', fontSize: '0.72rem' }}>{abilities[ab] || 10} <span style={{ color: '#777' }}>({abilityMod(abilities[ab] || 10)})</span></div>
          </div>
        ))}
      </div>

      {/* Secondary */}
      {c.saves && <MiniLine label="Saves" value={c.saves} />}
      {c.skills && <MiniLine label="Skills" value={c.skills} />}
      {c.resistances && <MiniLine label="Resist" value={c.resistances} />}
      {c.immunities && <MiniLine label="Immune" value={c.immunities} />}
      {c.senses && <MiniLine label="Senses" value={c.senses} />}
      {c.languages && <MiniLine label="Lang" value={c.languages} />}

      {/* Traits/Actions (collapsible) */}
      {(c.traits || []).length > 0 && (
        <ExpandableList title="Traits" items={c.traits} color={color} />
      )}
      {(c.actions || []).length > 0 && (
        <ExpandableList title="Actions" items={c.actions} color={color} />
      )}
      {(c.reactions || []).length > 0 && (
        <ExpandableList title="Reactions" items={c.reactions} color={color} />
      )}
      {(c.legendary_actions?.list || []).length > 0 && (
        <ExpandableList title="Legendary" items={c.legendary_actions.list} color={color} intro={c.legendary_actions.intro} />
      )}
      {c.lair_actions && (
        <div style={{ marginTop: '0.3rem' }}>
          <span style={{ color, fontWeight: 'bold', fontSize: '0.72rem' }}>Lair: </span>
          <span style={{ color: '#bbb', fontSize: '0.72rem' }}>{c.lair_actions}</span>
        </div>
      )}

      {/* Loot */}
      {(c.loot || []).length > 0 && (
        <div style={{ marginTop: '0.3rem' }}>
          <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '0.72rem' }}>Loot: </span>
          <span style={{ color: '#bbb', fontSize: '0.72rem' }}>
            {c.loot.map(l => `${l.name}${l.quantity > 1 ? ` x${l.quantity}` : ''}`).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}

function MiniLine({ label, value }) {
  return (
    <div style={{ marginBottom: '0.1rem' }}>
      <span style={{ color: '#888', fontSize: '0.68rem', fontWeight: 'bold' }}>{label}: </span>
      <span style={{ color: '#bbb', fontSize: '0.72rem' }}>{value}</span>
    </div>
  );
}

function ExpandableList({ title, items, color, intro }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: '0.25rem' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent', border: 'none', color,
          cursor: 'pointer', fontSize: '0.72rem', fontWeight: 'bold',
          padding: 0, fontStyle: 'italic'
        }}
      >
        {open ? `Hide ${title}` : `${title} (${items.length})`}
      </button>
      {open && (
        <div style={{ paddingLeft: '0.5rem', marginTop: '0.15rem' }}>
          {intro && <div style={{ color: '#999', fontSize: '0.7rem', fontStyle: 'italic', marginBottom: '0.2rem' }}>{intro}</div>}
          {items.map((item, i) => (
            <div key={i} style={{ marginBottom: '0.2rem' }}>
              <span style={{ color: '#ddd', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.72rem' }}>{item.name}. </span>
              <span style={{ color: '#aaa', fontSize: '0.72rem' }}>{item.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
