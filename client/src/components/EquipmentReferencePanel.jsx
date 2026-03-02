import { useState, useMemo } from 'react';
import equipment from '../data/equipment.json';

const ACCENT = '#d4af37';

const TABS = [
  { key: 'weapons', label: 'Weapons' },
  { key: 'armor', label: 'Armor' },
  { key: 'gear', label: 'Gear' },
  { key: 'tools', label: 'Tools' },
  { key: 'other', label: 'Other' },
];

export default function EquipmentReferencePanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('weapons');
  const [search, setSearch] = useState('');

  // Flatten equipment.json into tab-based groups
  const data = useMemo(() => {
    const weapons = [
      { header: 'Simple Melee', items: equipment.simpleWeapons?.melee || [] },
      { header: 'Simple Ranged', items: equipment.simpleWeapons?.ranged || [] },
      { header: 'Martial Melee', items: equipment.martialWeapons?.melee || [] },
      { header: 'Martial Ranged', items: equipment.martialWeapons?.ranged || [] },
    ];
    const armor = [
      { header: 'Light Armor', items: equipment.armor?.light || [] },
      { header: 'Medium Armor', items: equipment.armor?.medium || [] },
      { header: 'Heavy Armor', items: equipment.armor?.heavy || [] },
      { header: 'Shields', items: equipment.armor?.shields || [] },
    ];
    const gear = [
      { header: 'Adventuring Gear', items: equipment.adventuringGear || [] },
      { header: 'Ammunition', items: equipment.ammunition || [] },
    ];
    const tools = [
      { header: "Artisan's Tools", items: equipment.tools?.artisansTools || [] },
      { header: 'Gaming Sets', items: equipment.tools?.gamingSets || [] },
      { header: 'Other Tools', items: equipment.tools?.otherTools || [] },
      { header: 'Musical Instruments', items: (equipment.musicalInstruments || []).map(name => typeof name === 'string' ? { name, cost: '—' } : name) },
    ];
    const packs = Object.entries(equipment.packs || {}).map(([name, pack]) => ({
      name, cost: pack.cost, contents: pack.contents
    }));
    const other = [
      { header: 'Equipment Packs', items: packs },
      { header: 'Mounts', items: equipment.mounts || [] },
      { header: 'Tack & Harness', items: equipment.tack || [] },
      { header: 'Vehicles (Land)', items: equipment.vehicles || [] },
      { header: 'Vehicles (Water)', items: equipment.waterVehicles || [] },
    ];
    return { weapons, armor, gear, tools, other };
  }, []);

  // Filter by search
  const filteredGroups = useMemo(() => {
    const groups = data[activeTab] || [];
    if (!search) return groups;
    const q = search.toLowerCase();
    return groups.map(g => ({
      ...g,
      items: g.items.filter(item => item.name?.toLowerCase().includes(q))
    })).filter(g => g.items.length > 0);
  }, [data, activeTab, search]);

  const totalItems = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>Equipment & Prices</h3>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.2rem', padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setSearch(''); }}
            style={{
              padding: '0.2rem 0.5rem', borderRadius: '3px', fontSize: '0.75rem',
              background: activeTab === tab.key ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${activeTab === tab.key ? ACCENT : 'rgba(255,255,255,0.15)'}`,
              color: activeTab === tab.key ? ACCENT : '#888', cursor: 'pointer',
              fontWeight: activeTab === tab.key ? 'bold' : 'normal'
            }}
          >{tab.label}</button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '0.4rem 0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
        <input
          type="text" placeholder="Search..." value={search}
          onChange={e => setSearch(e.target.value)}
          style={searchStyle}
        />
      </div>

      {/* Item list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem 0.5rem' }}>
        {filteredGroups.map(group => (
          <div key={group.header}>
            <div style={subheaderStyle}>{group.header}</div>
            {group.items.map((item, i) => (
              <div key={`${item.name}-${i}`}>
                {activeTab === 'weapons' ? <WeaponRow item={item} /> :
                 activeTab === 'armor' ? <ArmorRow item={item} /> :
                 activeTab === 'other' && item.contents ? <PackRow item={item} /> :
                 activeTab === 'other' && item.speed ? <MountRow item={item} /> :
                 <GearRow item={item} />}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={footerStyle}>{totalItems} items</div>
    </div>
  );
}

// ============================================================
// ROW RENDERERS
// ============================================================

function WeaponRow({ item }) {
  return (
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.8rem' }}>{item.name}</span>
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', marginTop: '0.1rem' }}>
          <span style={{ color: '#ef4444', fontSize: '0.72rem' }}>
            {item.damage} {item.damageType}
            {item.versatileDamage && ` (${item.versatileDamage})`}
          </span>
          {item.range && <span style={{ color: '#6ea8fe', fontSize: '0.68rem' }}>{item.range}</span>}
          {(item.properties || []).map(p => (
            <span key={p} style={propPillStyle}>{p}</span>
          ))}
        </div>
      </div>
      <span style={priceStyle}>{item.cost}</span>
    </div>
  );
}

function ArmorRow({ item }) {
  const acText = item.acBonus
    ? `+${item.acBonus} AC`
    : item.maxDexBonus === 0
      ? `AC ${item.baseAC}`
      : item.maxDexBonus
        ? `AC ${item.baseAC} + Dex (max ${item.maxDexBonus})`
        : `AC ${item.baseAC} + Dex`;

  return (
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.8rem' }}>{item.name}</span>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.1rem' }}>
          <span style={{ color: '#3b82f6', fontSize: '0.72rem' }}>{acText}</span>
          {item.stealthDisadvantage && <span style={{ ...propPillStyle, color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)' }}>stealth disadv.</span>}
          {item.strReq && <span style={{ color: '#888', fontSize: '0.68rem' }}>STR {item.strReq}</span>}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <span style={priceStyle}>{item.cost}</span>
        {item.weight > 0 && <div style={{ color: '#666', fontSize: '0.65rem' }}>{item.weight} lb</div>}
      </div>
    </div>
  );
}

function GearRow({ item }) {
  return (
    <div style={rowStyle}>
      <span style={{ color: '#ddd', fontSize: '0.8rem', flex: 1 }}>{item.name}</span>
      <span style={priceStyle}>{item.cost || '—'}</span>
      {item.weight && <span style={{ color: '#666', fontSize: '0.65rem', width: '45px', textAlign: 'right' }}>{item.weight}</span>}
    </div>
  );
}

function MountRow({ item }) {
  return (
    <div style={rowStyle}>
      <div style={{ flex: 1 }}>
        <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.8rem' }}>{item.name}</span>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.1rem' }}>
          {item.speed && <span style={{ color: '#22c55e', fontSize: '0.68rem' }}>{item.speed}</span>}
          {item.capacity && <span style={{ color: '#888', fontSize: '0.68rem' }}>{item.capacity}</span>}
        </div>
      </div>
      <span style={priceStyle}>{item.cost}</span>
    </div>
  );
}

function PackRow({ item }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button onClick={() => setOpen(!open)} style={{ background: 'none', border: 'none', color: '#ddd', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.8rem', padding: 0, textAlign: 'left' }}>
          {open ? '-' : '+'} {item.name}
        </button>
        <span style={priceStyle}>{item.cost}</span>
      </div>
      {open && (
        <div style={{ paddingLeft: '0.75rem', marginTop: '0.2rem' }}>
          {item.contents.map((c, i) => (
            <div key={i} style={{ color: '#999', fontSize: '0.7rem' }}>- {c}</div>
          ))}
        </div>
      )}
    </div>
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

const searchStyle = {
  width: '100%', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.05)',
  border: `1px solid ${ACCENT}33`, borderRadius: '4px', color: '#ddd', fontSize: '0.8rem',
  outline: 'none', boxSizing: 'border-box'
};

const subheaderStyle = {
  color: ACCENT, fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase',
  padding: '0.4rem 0.25rem 0.15rem', borderBottom: `1px solid ${ACCENT}20`, marginTop: '0.3rem'
};

const rowStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
  padding: '0.3rem 0.25rem', borderBottom: '1px solid rgba(255,255,255,0.03)', fontSize: '0.8rem'
};

const priceStyle = { color: ACCENT, fontSize: '0.75rem', fontWeight: 'bold', whiteSpace: 'nowrap' };

const propPillStyle = {
  background: `${ACCENT}12`, border: `1px solid ${ACCENT}25`, borderRadius: '10px',
  padding: '0rem 0.35rem', fontSize: '0.62rem', color: ACCENT
};

const footerStyle = {
  padding: '0.5rem 1rem', borderTop: '1px solid rgba(255,255,255,0.05)',
  color: '#555', fontSize: '0.7rem', textAlign: 'center', flexShrink: 0
};
