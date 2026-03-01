import { useState, useEffect, useCallback } from 'react';

const ACCENT = '#10b981';

const CATEGORIES = [
  { type: 'npc', label: 'NPCs', color: '#f97316', icon: '\u{1F9D9}' },
  { type: 'enemy', label: 'Enemies', color: '#ef4444', icon: '\u{2694}' },
  { type: 'location', label: 'Locations', color: '#22c55e', icon: '\u{1F3F0}' },
  { type: 'lore', label: 'Lore', color: '#a855f7', icon: '\u{1F4DC}' },
  { type: 'treasure', label: 'Treasure', color: '#eab308', icon: '\u{1F48E}' },
  { type: 'session_notes', label: 'Sessions', color: '#3b82f6', icon: '\u{1F4CB}' },
];

// CR to XP lookup (D&D 5e)
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
const SIZES = ['Tiny', 'Small', 'Medium', 'Large', 'Huge', 'Gargantuan'];
const ENEMY_TYPES = ['Aberration', 'Beast', 'Celestial', 'Construct', 'Dragon', 'Elemental', 'Fey', 'Fiend', 'Giant', 'Humanoid', 'Monstrosity', 'Ooze', 'Plant', 'Undead'];
const LORE_CATEGORIES = ['world', 'deity', 'faction', 'event', 'artifact', 'prophecy', 'custom'];
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact'];

function abilityMod(score) {
  const m = Math.floor((score - 10) / 2);
  return m >= 0 ? `+${m}` : `${m}`;
}

export default function CampaignPrepScreen({ party, onBack }) {
  const [activeType, setActiveType] = useState('npc');
  const [items, setItems] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState(null);

  const partyId = party.id;

  // Load items for active type
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

  // Load counts for badges
  const loadCounts = useCallback(async () => {
    try {
      const res = await fetch(`/api/dm-mode/prep/${partyId}/counts`);
      if (res.ok) setCounts(await res.json());
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  }, [partyId]);

  useEffect(() => { loadItems(); }, [loadItems]);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  // CRUD handlers
  const handleCreate = async () => {
    const name = prompt('Enter name:');
    if (!name?.trim()) return;
    try {
      const res = await fetch(`/api/dm-mode/prep/${partyId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: activeType, name: name.trim(), content: getDefaultContent(activeType) })
      });
      if (res.ok) {
        const item = await res.json();
        setItems(prev => [...prev, item]);
        setCounts(prev => ({ ...prev, [activeType]: (prev[activeType] || 0) + 1 }));
        setSelectedItem(item);
        setEditing(true);
        setEditData({ name: item.name, content: item.content });
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to create');
      }
    } catch (err) {
      console.error('Create error:', err);
    }
  };

  const handleSave = async () => {
    if (!selectedItem || !editData) return;
    try {
      const res = await fetch(`/api/dm-mode/prep-item/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editData.name, content: editData.content })
      });
      if (res.ok) {
        const updated = await res.json();
        setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
        setSelectedItem(updated);
        setEditing(false);
        setEditData(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Failed to save');
      }
    } catch (err) {
      console.error('Save error:', err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this item permanently?')) return;
    try {
      await fetch(`/api/dm-mode/prep-item/${id}`, { method: 'DELETE' });
      setItems(prev => prev.filter(i => i.id !== id));
      setCounts(prev => ({ ...prev, [activeType]: Math.max(0, (prev[activeType] || 0) - 1) }));
      if (selectedItem?.id === id) {
        setSelectedItem(null);
        setEditing(false);
        setEditData(null);
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await fetch(`/api/dm-mode/prep-item/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const item = await res.json();
        setItems(prev => [...prev, item]);
        setCounts(prev => ({ ...prev, [activeType]: (prev[activeType] || 0) + 1 }));
        setSelectedItem(item);
      }
    } catch (err) {
      console.error('Duplicate error:', err);
    }
  };

  const startEdit = (item) => {
    setSelectedItem(item);
    setEditing(true);
    setEditData({ name: item.name, content: { ...item.content } });
  };

  const cancelEdit = () => {
    setEditing(false);
    setEditData(null);
  };

  const selectType = (type) => {
    setActiveType(type);
    setSelectedItem(null);
    setEditing(false);
    setEditData(null);
    setSearch('');
  };

  const activeCat = CATEGORIES.find(c => c.type === activeType);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1rem', borderBottom: `1px solid ${ACCENT}33`,
        background: 'rgba(0,0,0,0.2)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ color: ACCENT, margin: 0, fontSize: '1.1rem' }}>Campaign Prep</h2>
          <span style={{ color: '#888', fontSize: '0.85rem' }}>{party.name}</span>
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '0.4rem 1rem', background: 'transparent',
            border: `1px solid rgba(255,255,255,0.2)`, borderRadius: '6px',
            color: '#aaa', cursor: 'pointer', fontSize: '0.85rem'
          }}
        >Back</button>
      </div>

      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Category Sidebar */}
        <div style={{
          width: '140px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
          padding: '0.5rem 0'
        }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat.type}
              onClick={() => selectType(cat.type)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.6rem 0.75rem', margin: '0.15rem 0.4rem',
                background: activeType === cat.type ? `${cat.color}18` : 'transparent',
                border: activeType === cat.type ? `1px solid ${cat.color}40` : '1px solid transparent',
                borderRadius: '6px', color: activeType === cat.type ? cat.color : '#999',
                cursor: 'pointer', fontSize: '0.82rem', fontWeight: activeType === cat.type ? 'bold' : 'normal',
                textAlign: 'left'
              }}
            >
              <span style={{ fontSize: '1rem' }}>{cat.icon}</span>
              <span style={{ flex: 1 }}>{cat.label}</span>
              {(counts[cat.type] || 0) > 0 && (
                <span style={{
                  background: `${cat.color}25`, color: cat.color,
                  padding: '0.05rem 0.35rem', borderRadius: '8px',
                  fontSize: '0.65rem', fontWeight: 'bold'
                }}>{counts[cat.type]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Item List */}
        <div style={{
          width: '280px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden'
        }}>
          {/* Search + Add */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.4rem' }}>
              <input
                type="text"
                placeholder={`Search ${activeCat?.label}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  flex: 1, padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px',
                  color: '#ddd', fontSize: '0.8rem', outline: 'none'
                }}
              />
            </div>
            <button
              onClick={handleCreate}
              style={{
                width: '100%', padding: '0.35rem',
                background: `${activeCat?.color}15`,
                border: `1px solid ${activeCat?.color}40`,
                borderRadius: '4px', color: activeCat?.color,
                cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold'
              }}
            >+ New {activeCat?.label?.replace(/s$/, '')}</button>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.25rem' }}>
            {loading ? (
              <div style={{ color: '#888', textAlign: 'center', padding: '2rem 0', fontSize: '0.85rem' }}>Loading...</div>
            ) : items.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem 0.5rem', fontSize: '0.82rem' }}>
                No {activeCat?.label?.toLowerCase()} yet. Create one to get started.
              </div>
            ) : (
              items.map(item => (
                <div
                  key={item.id}
                  onClick={() => { setSelectedItem(item); setEditing(false); setEditData(null); }}
                  style={{
                    padding: '0.5rem 0.6rem', margin: '0.15rem 0',
                    background: selectedItem?.id === item.id ? `${activeCat?.color}12` : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${selectedItem?.id === item.id ? `${activeCat?.color}40` : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  <div style={{ color: selectedItem?.id === item.id ? activeCat?.color : '#ddd', fontWeight: 'bold', fontSize: '0.85rem' }}>
                    {item.name}
                  </div>
                  <div style={{ color: '#777', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                    {getItemPreview(item)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail / Edit Panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {!selectedItem ? (
            <div style={{ color: '#666', textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem', opacity: 0.3 }}>{activeCat?.icon}</div>
              <div style={{ fontSize: '0.9rem' }}>Select an item or create a new one</div>
            </div>
          ) : editing && editData ? (
            <EditForm
              type={activeType}
              data={editData}
              onChange={setEditData}
              onSave={handleSave}
              onCancel={cancelEdit}
              categoryColor={activeCat?.color}
            />
          ) : (
            <DetailView
              type={activeType}
              item={selectedItem}
              onEdit={() => startEdit(selectedItem)}
              onDelete={() => handleDelete(selectedItem.id)}
              onDuplicate={() => handleDuplicate(selectedItem.id)}
              categoryColor={activeCat?.color}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// DEFAULT CONTENT TEMPLATES
// ============================================================

function getDefaultContent(type) {
  switch (type) {
    case 'npc': return { race: '', appearance: '', personality: '', voice: '', motivations: '', secrets: '', connections: '', location: '' };
    case 'enemy': return {
      type: 'Humanoid', size: 'Medium', alignment: '', cr: '1', hp: '', hp_formula: '', ac: '', ac_type: '',
      speed: '30 ft.', abilities: { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 },
      saves: '', skills: '', resistances: '', immunities: '', vulnerabilities: '',
      senses: 'passive Perception 10', languages: 'Common',
      traits: [], actions: [], reactions: [], legendary_actions: { intro: '', list: [] },
      lair_actions: '', loot: [], notes: ''
    };
    case 'location': return { type: '', description: '', features: '', npcs_present: '', encounters: '', atmosphere: '', connections: '', secrets: '' };
    case 'lore': return { category: 'world', content: '', related: '' };
    case 'treasure': return { context: '', items: [], gold: 0 };
    case 'session_notes': return { session_number: '', objectives: '', scenes: [], npcs_involved: '', key_info: '' };
    default: return {};
  }
}

function getItemPreview(item) {
  const c = item.content || {};
  switch (item.type) {
    case 'npc': return [c.race, c.location].filter(Boolean).join(' | ') || 'No details';
    case 'enemy': return [c.size, c.type, c.cr ? `CR ${c.cr}` : ''].filter(Boolean).join(' ') || 'No details';
    case 'location': return c.type || c.atmosphere || 'No details';
    case 'lore': return c.category || 'No details';
    case 'treasure': return c.context || `${(c.items || []).length} items`;
    case 'session_notes': return c.session_number ? `Session ${c.session_number}` : 'No session number';
    default: return '';
  }
}

// ============================================================
// DETAIL VIEW (read-only)
// ============================================================

function DetailView({ type, item, onEdit, onDelete, onDuplicate, categoryColor }) {
  const c = item.content || {};

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h3 style={{ color: categoryColor, margin: 0, fontSize: '1.2rem' }}>{item.name}</h3>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={onEdit} style={actionBtnStyle(ACCENT)}>Edit</button>
          <button onClick={onDuplicate} style={actionBtnStyle('#3b82f6')}>Duplicate</button>
          <button onClick={onDelete} style={actionBtnStyle('#e74c3c')}>Delete</button>
        </div>
      </div>

      {type === 'enemy' && <EnemyStatBlock content={c} color={categoryColor} />}
      {type === 'npc' && <NpcDetail content={c} />}
      {type === 'location' && <LocationDetail content={c} />}
      {type === 'lore' && <LoreDetail content={c} />}
      {type === 'treasure' && <TreasureDetail content={c} />}
      {type === 'session_notes' && <SessionNotesDetail content={c} />}
    </div>
  );
}

function NpcDetail({ content: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {c.race && <Field label="Race" value={c.race} />}
      {c.appearance && <Field label="Appearance" value={c.appearance} />}
      {c.personality && <Field label="Personality" value={c.personality} />}
      {c.voice && <Field label="Voice & Mannerisms" value={c.voice} />}
      {c.motivations && <Field label="Motivations" value={c.motivations} />}
      {c.secrets && <Field label="Secrets" value={c.secrets} color="#e74c3c" />}
      {c.connections && <Field label="Connections" value={c.connections} />}
      {c.location && <Field label="Location" value={c.location} />}
    </div>
  );
}

function LocationDetail({ content: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {c.type && <Field label="Type" value={c.type} />}
      {c.description && <Field label="Description" value={c.description} />}
      {c.features && <Field label="Notable Features" value={c.features} />}
      {c.atmosphere && <Field label="Atmosphere" value={c.atmosphere} />}
      {c.npcs_present && <Field label="NPCs Present" value={c.npcs_present} />}
      {c.encounters && <Field label="Encounters" value={c.encounters} />}
      {c.connections && <Field label="Connections" value={c.connections} />}
      {c.secrets && <Field label="Secrets" value={c.secrets} color="#e74c3c" />}
    </div>
  );
}

function LoreDetail({ content: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {c.category && <Field label="Category" value={c.category} />}
      {c.content && <Field label="Content" value={c.content} />}
      {c.related && <Field label="Related Entries" value={c.related} />}
    </div>
  );
}

function TreasureDetail({ content: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {c.context && <Field label="Context" value={c.context} />}
      {c.gold > 0 && <Field label="Gold" value={`${c.gold} gp`} />}
      {(c.items || []).length > 0 && (
        <div>
          <div style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Items</div>
          {c.items.map((item, i) => (
            <div key={i} style={{ padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '0.3rem' }}>
              <span style={{ color: '#eab308', fontWeight: 'bold', fontSize: '0.85rem' }}>{item.name}</span>
              {item.rarity && <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.5rem' }}>({item.rarity})</span>}
              {item.quantity > 1 && <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.3rem' }}>x{item.quantity}</span>}
              {item.description && <div style={{ color: '#bbb', fontSize: '0.8rem', marginTop: '0.2rem' }}>{item.description}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionNotesDetail({ content: c }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {c.session_number && <Field label="Session Number" value={c.session_number} />}
      {c.objectives && <Field label="Objectives" value={c.objectives} />}
      {c.npcs_involved && <Field label="NPCs Involved" value={c.npcs_involved} />}
      {c.key_info && <Field label="Key Info to Reveal" value={c.key_info} />}
      {(c.scenes || []).length > 0 && (
        <div>
          <div style={{ color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.3rem', textTransform: 'uppercase' }}>Scenes</div>
          {c.scenes.map((scene, i) => (
            <div key={i} style={{ padding: '0.5rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '0.4rem', borderLeft: '3px solid #3b82f640' }}>
              <div style={{ color: '#3b82f6', fontWeight: 'bold', fontSize: '0.85rem' }}>{scene.name || `Scene ${i + 1}`}</div>
              {scene.description && <div style={{ color: '#bbb', fontSize: '0.8rem', marginTop: '0.2rem' }}>{scene.description}</div>}
              {scene.encounters && <div style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.15rem' }}>Encounters: {scene.encounters}</div>}
              {scene.location && <div style={{ color: '#22c55e', fontSize: '0.78rem', marginTop: '0.15rem' }}>Location: {scene.location}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// ENEMY STAT BLOCK (read-only)
// ============================================================

function EnemyStatBlock({ content: c, color }) {
  const xp = CR_XP[c.cr] || '—';
  const abilities = c.abilities || {};

  return (
    <div style={{ maxWidth: '600px' }}>
      {/* Type line */}
      <div style={{ color: '#aaa', fontSize: '0.82rem', fontStyle: 'italic', marginBottom: '0.6rem' }}>
        {[c.size, c.type, c.alignment].filter(Boolean).join(', ')}
      </div>

      <StatBlockDivider />

      {/* Core stats */}
      <div style={{ display: 'flex', gap: '2rem', marginBottom: '0.3rem' }}>
        <StatLine label="Armor Class" value={c.ac ? `${c.ac}${c.ac_type ? ` (${c.ac_type})` : ''}` : '—'} />
      </div>
      <StatLine label="Hit Points" value={c.hp ? `${c.hp}${c.hp_formula ? ` (${c.hp_formula})` : ''}` : '—'} />
      <StatLine label="Speed" value={c.speed || '30 ft.'} />

      <StatBlockDivider />

      {/* Ability scores */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        {ABILITY_NAMES.map(ab => (
          <div key={ab} style={{ textAlign: 'center', minWidth: '50px' }}>
            <div style={{ color, fontWeight: 'bold', fontSize: '0.75rem' }}>{ab}</div>
            <div style={{ color: '#ddd', fontSize: '0.85rem' }}>
              {abilities[ab] || 10} <span style={{ color: '#888' }}>({abilityMod(abilities[ab] || 10)})</span>
            </div>
          </div>
        ))}
      </div>

      <StatBlockDivider />

      {/* Secondary stats */}
      {c.saves && <StatLine label="Saving Throws" value={c.saves} />}
      {c.skills && <StatLine label="Skills" value={c.skills} />}
      {c.resistances && <StatLine label="Damage Resistances" value={c.resistances} />}
      {c.immunities && <StatLine label="Damage Immunities" value={c.immunities} />}
      {c.vulnerabilities && <StatLine label="Damage Vulnerabilities" value={c.vulnerabilities} />}
      {c.senses && <StatLine label="Senses" value={c.senses} />}
      {c.languages && <StatLine label="Languages" value={c.languages} />}
      <StatLine label="Challenge" value={`${c.cr || '—'} (${xp} XP)`} />

      <StatBlockDivider />

      {/* Traits */}
      {(c.traits || []).length > 0 && (
        <>
          {c.traits.map((t, i) => (
            <div key={i} style={{ marginBottom: '0.4rem' }}>
              <span style={{ color: '#ddd', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.85rem' }}>{t.name}. </span>
              <span style={{ color: '#bbb', fontSize: '0.85rem' }}>{t.description}</span>
            </div>
          ))}
        </>
      )}

      {/* Actions */}
      {(c.actions || []).length > 0 && (
        <>
          <SectionHeader text="Actions" color={color} />
          {c.actions.map((a, i) => (
            <div key={i} style={{ marginBottom: '0.4rem' }}>
              <span style={{ color: '#ddd', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.85rem' }}>{a.name}. </span>
              <span style={{ color: '#bbb', fontSize: '0.85rem' }}>{a.description}</span>
            </div>
          ))}
        </>
      )}

      {/* Reactions */}
      {(c.reactions || []).length > 0 && (
        <>
          <SectionHeader text="Reactions" color={color} />
          {c.reactions.map((r, i) => (
            <div key={i} style={{ marginBottom: '0.4rem' }}>
              <span style={{ color: '#ddd', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.85rem' }}>{r.name}. </span>
              <span style={{ color: '#bbb', fontSize: '0.85rem' }}>{r.description}</span>
            </div>
          ))}
        </>
      )}

      {/* Legendary Actions */}
      {((c.legendary_actions?.list || []).length > 0 || c.legendary_actions?.intro) && (
        <>
          <SectionHeader text="Legendary Actions" color={color} />
          {c.legendary_actions.intro && (
            <div style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '0.4rem', fontStyle: 'italic' }}>{c.legendary_actions.intro}</div>
          )}
          {(c.legendary_actions.list || []).map((la, i) => (
            <div key={i} style={{ marginBottom: '0.4rem' }}>
              <span style={{ color: '#ddd', fontWeight: 'bold', fontStyle: 'italic', fontSize: '0.85rem' }}>{la.name}. </span>
              <span style={{ color: '#bbb', fontSize: '0.85rem' }}>{la.description}</span>
            </div>
          ))}
        </>
      )}

      {/* Lair Actions */}
      {c.lair_actions && (
        <>
          <SectionHeader text="Lair Actions" color={color} />
          <div style={{ color: '#bbb', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{c.lair_actions}</div>
        </>
      )}

      {/* Loot */}
      {(c.loot || []).length > 0 && (
        <>
          <SectionHeader text="Loot" color="#eab308" />
          {c.loot.map((l, i) => (
            <div key={i} style={{ color: '#bbb', fontSize: '0.85rem', marginBottom: '0.15rem' }}>
              - {l.name}{l.quantity > 1 ? ` (x${l.quantity})` : ''}{l.description ? `: ${l.description}` : ''}
            </div>
          ))}
        </>
      )}

      {/* Notes */}
      {c.notes && (
        <>
          <SectionHeader text="DM Notes" color="#888" />
          <div style={{ color: '#bbb', fontSize: '0.85rem', whiteSpace: 'pre-wrap' }}>{c.notes}</div>
        </>
      )}
    </div>
  );
}

// ============================================================
// EDIT FORM
// ============================================================

function EditForm({ type, data, onChange, onSave, onCancel, categoryColor }) {
  const updateContent = (key, value) => {
    onChange({ ...data, content: { ...data.content, [key]: value } });
  };

  return (
    <div>
      {/* Name field */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Name</label>
        <input
          type="text"
          value={data.name}
          onChange={e => onChange({ ...data, name: e.target.value })}
          style={inputStyle}
        />
      </div>

      {type === 'npc' && <NpcEditFields content={data.content} update={updateContent} />}
      {type === 'enemy' && <EnemyEditFields content={data.content} update={updateContent} onChange={onChange} data={data} />}
      {type === 'location' && <LocationEditFields content={data.content} update={updateContent} />}
      {type === 'lore' && <LoreEditFields content={data.content} update={updateContent} />}
      {type === 'treasure' && <TreasureEditFields content={data.content} update={updateContent} onChange={onChange} data={data} />}
      {type === 'session_notes' && <SessionNotesEditFields content={data.content} update={updateContent} onChange={onChange} data={data} />}

      {/* Save/Cancel */}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <button onClick={onSave} style={{ ...actionBtnStyle(ACCENT), padding: '0.5rem 1.5rem', fontSize: '0.9rem', fontWeight: 'bold' }}>Save</button>
        <button onClick={onCancel} style={{ ...actionBtnStyle('#888'), padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Cancel</button>
      </div>
    </div>
  );
}

// ---- NPC ----
function NpcEditFields({ content: c, update }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FormRow label="Race" value={c.race} onChange={v => update('race', v)} />
      <FormRow label="Location" value={c.location} onChange={v => update('location', v)} />
      <FormTextarea label="Appearance" value={c.appearance} onChange={v => update('appearance', v)} rows={2} />
      <FormTextarea label="Personality" value={c.personality} onChange={v => update('personality', v)} rows={2} />
      <FormTextarea label="Voice & Mannerisms" value={c.voice} onChange={v => update('voice', v)} rows={2} />
      <FormTextarea label="Motivations" value={c.motivations} onChange={v => update('motivations', v)} rows={2} />
      <FormTextarea label="Secrets" value={c.secrets} onChange={v => update('secrets', v)} rows={2} />
      <FormTextarea label="Connections" value={c.connections} onChange={v => update('connections', v)} rows={2} />
    </div>
  );
}

// ---- Location ----
function LocationEditFields({ content: c, update }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FormRow label="Type" value={c.type} onChange={v => update('type', v)} placeholder="e.g., Dungeon, Town, Wilderness" />
      <FormTextarea label="Description" value={c.description} onChange={v => update('description', v)} rows={3} />
      <FormTextarea label="Notable Features" value={c.features} onChange={v => update('features', v)} rows={2} />
      <FormRow label="Atmosphere" value={c.atmosphere} onChange={v => update('atmosphere', v)} />
      <FormTextarea label="NPCs Present" value={c.npcs_present} onChange={v => update('npcs_present', v)} rows={2} />
      <FormTextarea label="Encounters" value={c.encounters} onChange={v => update('encounters', v)} rows={2} />
      <FormTextarea label="Connections" value={c.connections} onChange={v => update('connections', v)} rows={2} />
      <FormTextarea label="Secrets" value={c.secrets} onChange={v => update('secrets', v)} rows={2} />
    </div>
  );
}

// ---- Lore ----
function LoreEditFields({ content: c, update }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <div>
        <label style={labelStyle}>Category</label>
        <select
          value={c.category || 'world'}
          onChange={e => update('category', e.target.value)}
          style={inputStyle}
        >
          {LORE_CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
          ))}
        </select>
      </div>
      <FormTextarea label="Content" value={c.content} onChange={v => update('content', v)} rows={8} />
      <FormTextarea label="Related Entries" value={c.related} onChange={v => update('related', v)} rows={2} />
    </div>
  );
}

// ---- Treasure ----
function TreasureEditFields({ content: c, update, onChange, data }) {
  const items = c.items || [];

  const addItem = () => {
    onChange({ ...data, content: { ...c, items: [...items, { name: '', rarity: 'Common', description: '', quantity: 1 }] } });
  };
  const removeItem = (idx) => {
    onChange({ ...data, content: { ...c, items: items.filter((_, i) => i !== idx) } });
  };
  const updateItem = (idx, key, value) => {
    const updated = items.map((item, i) => i === idx ? { ...item, [key]: value } : item);
    onChange({ ...data, content: { ...c, items: updated } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FormTextarea label="Context" value={c.context} onChange={v => update('context', v)} rows={2} placeholder="When/where is this treasure found?" />
      <FormRow label="Gold (gp)" value={c.gold || ''} onChange={v => update('gold', parseInt(v) || 0)} type="number" />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={labelStyle}>Items</label>
          <button onClick={addItem} style={{ ...actionBtnStyle('#eab308'), fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>+ Add Item</button>
        </div>
        {items.map((item, i) => (
          <div key={i} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '0.4rem', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem' }}>
              <input placeholder="Item name" value={item.name} onChange={e => updateItem(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 2, marginBottom: 0 }} />
              <select value={item.rarity} onChange={e => updateItem(i, 'rarity', e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }}>
                {RARITIES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="number" placeholder="Qty" value={item.quantity} onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} style={{ ...inputStyle, width: '50px', marginBottom: 0 }} />
              <button onClick={() => removeItem(i)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
            </div>
            <input placeholder="Description" value={item.description} onChange={e => updateItem(i, 'description', e.target.value)} style={{ ...inputStyle, marginBottom: 0, fontSize: '0.78rem' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Session Notes ----
function SessionNotesEditFields({ content: c, update, onChange, data }) {
  const scenes = c.scenes || [];

  const addScene = () => {
    onChange({ ...data, content: { ...c, scenes: [...scenes, { name: '', description: '', encounters: '', location: '' }] } });
  };
  const removeScene = (idx) => {
    onChange({ ...data, content: { ...c, scenes: scenes.filter((_, i) => i !== idx) } });
  };
  const updateScene = (idx, key, value) => {
    const updated = scenes.map((scene, i) => i === idx ? { ...scene, [key]: value } : scene);
    onChange({ ...data, content: { ...c, scenes: updated } });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      <FormRow label="Session Number" value={c.session_number} onChange={v => update('session_number', v)} placeholder="e.g., 5" />
      <FormTextarea label="Objectives" value={c.objectives} onChange={v => update('objectives', v)} rows={3} />
      <FormTextarea label="NPCs Involved" value={c.npcs_involved} onChange={v => update('npcs_involved', v)} rows={2} />
      <FormTextarea label="Key Info to Reveal" value={c.key_info} onChange={v => update('key_info', v)} rows={3} />

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={labelStyle}>Scenes</label>
          <button onClick={addScene} style={{ ...actionBtnStyle('#3b82f6'), fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>+ Add Scene</button>
        </div>
        {scenes.map((scene, i) => (
          <div key={i} style={{ padding: '0.5rem', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', marginBottom: '0.5rem', border: '1px solid rgba(255,255,255,0.06)', borderLeft: '3px solid #3b82f640' }}>
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.3rem', alignItems: 'center' }}>
              <input placeholder="Scene name" value={scene.name} onChange={e => updateScene(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
              <button onClick={() => removeScene(i)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
            </div>
            <textarea placeholder="Description" value={scene.description} onChange={e => updateScene(i, 'description', e.target.value)} rows={2} style={{ ...textareaStyle, marginBottom: '0.3rem' }} />
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input placeholder="Encounters" value={scene.encounters} onChange={e => updateScene(i, 'encounters', e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
              <input placeholder="Location" value={scene.location} onChange={e => updateScene(i, 'location', e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Enemy (most complex) ----
function EnemyEditFields({ content: c, update, onChange, data }) {
  const abilities = c.abilities || { STR: 10, DEX: 10, CON: 10, INT: 10, WIS: 10, CHA: 10 };
  const traits = c.traits || [];
  const actions = c.actions || [];
  const reactions = c.reactions || [];
  const legendary = c.legendary_actions || { intro: '', list: [] };
  const loot = c.loot || [];

  const updateAbility = (ab, val) => {
    const newAb = { ...abilities, [ab]: parseInt(val) || 10 };
    onChange({ ...data, content: { ...c, abilities: newAb } });
  };

  const addListItem = (key) => {
    const list = c[key] || [];
    onChange({ ...data, content: { ...c, [key]: [...list, { name: '', description: '' }] } });
  };
  const removeListItem = (key, idx) => {
    const list = (c[key] || []).filter((_, i) => i !== idx);
    onChange({ ...data, content: { ...c, [key]: list } });
  };
  const updateListItem = (key, idx, field, value) => {
    const list = (c[key] || []).map((item, i) => i === idx ? { ...item, [field]: value } : item);
    onChange({ ...data, content: { ...c, [key]: list } });
  };

  const addLegendary = () => {
    onChange({ ...data, content: { ...c, legendary_actions: { ...legendary, list: [...legendary.list, { name: '', description: '' }] } } });
  };
  const removeLegendary = (idx) => {
    onChange({ ...data, content: { ...c, legendary_actions: { ...legendary, list: legendary.list.filter((_, i) => i !== idx) } } });
  };
  const updateLegendary = (idx, field, value) => {
    const list = legendary.list.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    onChange({ ...data, content: { ...c, legendary_actions: { ...legendary, list } } });
  };

  const addLoot = () => {
    onChange({ ...data, content: { ...c, loot: [...loot, { name: '', quantity: 1, description: '' }] } });
  };
  const removeLoot = (idx) => {
    onChange({ ...data, content: { ...c, loot: loot.filter((_, i) => i !== idx) } });
  };
  const updateLoot = (idx, field, value) => {
    const list = loot.map((item, i) => i === idx ? { ...item, [field]: value } : item);
    onChange({ ...data, content: { ...c, loot: list } });
  };

  const [collapsed, setCollapsed] = useState({});
  const toggle = (section) => setCollapsed(prev => ({ ...prev, [section]: !prev[section] }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {/* Header */}
      <CollapsibleSection title="Header" collapsed={collapsed.header} onToggle={() => toggle('header')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={c.type || 'Humanoid'} onChange={e => update('type', e.target.value)} style={inputStyle}>
              {ENEMY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Size</label>
            <select value={c.size || 'Medium'} onChange={e => update('size', e.target.value)} style={inputStyle}>
              {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <FormRow label="Alignment" value={c.alignment} onChange={v => update('alignment', v)} />
          <div>
            <label style={labelStyle}>CR</label>
            <select value={c.cr || '1'} onChange={e => update('cr', e.target.value)} style={inputStyle}>
              {Object.keys(CR_XP).map(cr => <option key={cr} value={cr}>{cr} ({CR_XP[cr]} XP)</option>)}
            </select>
          </div>
        </div>
      </CollapsibleSection>

      {/* Core Stats */}
      <CollapsibleSection title="Core Stats" collapsed={collapsed.core} onToggle={() => toggle('core')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <FormRow label="AC" value={c.ac} onChange={v => update('ac', v)} placeholder="e.g., 15" />
          <FormRow label="AC Type" value={c.ac_type} onChange={v => update('ac_type', v)} placeholder="e.g., natural armor" />
          <FormRow label="HP" value={c.hp} onChange={v => update('hp', v)} placeholder="e.g., 52" />
          <FormRow label="HP Formula" value={c.hp_formula} onChange={v => update('hp_formula', v)} placeholder="e.g., 8d8+16" />
        </div>
        <FormRow label="Speed" value={c.speed} onChange={v => update('speed', v)} placeholder="30 ft., fly 60 ft." />

        {/* Ability Scores */}
        <div style={{ marginTop: '0.5rem' }}>
          <label style={labelStyle}>Ability Scores</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.4rem' }}>
            {ABILITY_NAMES.map(ab => (
              <div key={ab} style={{ textAlign: 'center' }}>
                <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.7rem', marginBottom: '0.15rem' }}>{ab}</div>
                <input
                  type="number"
                  value={abilities[ab]}
                  onChange={e => updateAbility(ab, e.target.value)}
                  style={{ ...inputStyle, textAlign: 'center', width: '100%', marginBottom: '0.1rem' }}
                />
                <div style={{ color: '#888', fontSize: '0.7rem' }}>{abilityMod(abilities[ab])}</div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Defenses */}
      <CollapsibleSection title="Defenses & Senses" collapsed={collapsed.defenses} onToggle={() => toggle('defenses')}>
        <FormRow label="Saving Throws" value={c.saves} onChange={v => update('saves', v)} placeholder="Dex +5, Wis +3" />
        <FormRow label="Skills" value={c.skills} onChange={v => update('skills', v)} placeholder="Perception +5, Stealth +7" />
        <FormRow label="Damage Resistances" value={c.resistances} onChange={v => update('resistances', v)} />
        <FormRow label="Damage Immunities" value={c.immunities} onChange={v => update('immunities', v)} />
        <FormRow label="Damage Vulnerabilities" value={c.vulnerabilities} onChange={v => update('vulnerabilities', v)} />
        <FormRow label="Senses" value={c.senses} onChange={v => update('senses', v)} placeholder="darkvision 60 ft., passive Perception 15" />
        <FormRow label="Languages" value={c.languages} onChange={v => update('languages', v)} />
      </CollapsibleSection>

      {/* Traits */}
      <CollapsibleSection title={`Traits (${traits.length})`} collapsed={collapsed.traits} onToggle={() => toggle('traits')}>
        {traits.map((t, i) => (
          <DynamicEntry key={i} item={t} onUpdate={(f, v) => updateListItem('traits', i, f, v)} onRemove={() => removeListItem('traits', i)} />
        ))}
        <button onClick={() => addListItem('traits')} style={{ ...actionBtnStyle('#ef4444'), fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }}>+ Add Trait</button>
      </CollapsibleSection>

      {/* Actions */}
      <CollapsibleSection title={`Actions (${actions.length})`} collapsed={collapsed.actions} onToggle={() => toggle('actions')}>
        {actions.map((a, i) => (
          <DynamicEntry key={i} item={a} onUpdate={(f, v) => updateListItem('actions', i, f, v)} onRemove={() => removeListItem('actions', i)} />
        ))}
        <button onClick={() => addListItem('actions')} style={{ ...actionBtnStyle('#ef4444'), fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }}>+ Add Action</button>
      </CollapsibleSection>

      {/* Reactions */}
      <CollapsibleSection title={`Reactions (${reactions.length})`} collapsed={collapsed.reactions} onToggle={() => toggle('reactions')}>
        {reactions.map((r, i) => (
          <DynamicEntry key={i} item={r} onUpdate={(f, v) => updateListItem('reactions', i, f, v)} onRemove={() => removeListItem('reactions', i)} />
        ))}
        <button onClick={() => addListItem('reactions')} style={{ ...actionBtnStyle('#ef4444'), fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }}>+ Add Reaction</button>
      </CollapsibleSection>

      {/* Legendary Actions */}
      <CollapsibleSection title={`Legendary Actions (${legendary.list.length})`} collapsed={collapsed.legendary} onToggle={() => toggle('legendary')}>
        <FormTextarea label="Intro Text" value={legendary.intro} onChange={v => onChange({ ...data, content: { ...c, legendary_actions: { ...legendary, intro: v } } })} rows={2} placeholder="The creature can take 3 legendary actions..." />
        {legendary.list.map((la, i) => (
          <DynamicEntry key={i} item={la} onUpdate={(f, v) => updateLegendary(i, f, v)} onRemove={() => removeLegendary(i)} />
        ))}
        <button onClick={addLegendary} style={{ ...actionBtnStyle('#ef4444'), fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }}>+ Add Legendary Action</button>
      </CollapsibleSection>

      {/* Lair Actions */}
      <CollapsibleSection title="Lair Actions" collapsed={collapsed.lair} onToggle={() => toggle('lair')}>
        <FormTextarea label="" value={c.lair_actions} onChange={v => update('lair_actions', v)} rows={4} placeholder="On initiative count 20..." />
      </CollapsibleSection>

      {/* Loot & Notes */}
      <CollapsibleSection title={`Loot & Notes`} collapsed={collapsed.loot} onToggle={() => toggle('loot')}>
        {loot.map((l, i) => (
          <div key={i} style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.3rem', alignItems: 'center' }}>
            <input placeholder="Item" value={l.name} onChange={e => updateLoot(i, 'name', e.target.value)} style={{ ...inputStyle, flex: 2, marginBottom: 0 }} />
            <input type="number" placeholder="Qty" value={l.quantity} onChange={e => updateLoot(i, 'quantity', parseInt(e.target.value) || 1)} style={{ ...inputStyle, width: '50px', marginBottom: 0 }} />
            <input placeholder="Notes" value={l.description} onChange={e => updateLoot(i, 'description', e.target.value)} style={{ ...inputStyle, flex: 2, marginBottom: 0 }} />
            <button onClick={() => removeLoot(i)} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer' }}>&times;</button>
          </div>
        ))}
        <button onClick={addLoot} style={{ ...actionBtnStyle('#eab308'), fontSize: '0.75rem', padding: '0.2rem 0.5rem', marginTop: '0.3rem' }}>+ Add Loot</button>
        <FormTextarea label="DM Notes" value={c.notes} onChange={v => update('notes', v)} rows={3} />
      </CollapsibleSection>
    </div>
  );
}

// ============================================================
// SHARED UI PRIMITIVES
// ============================================================

function CollapsibleSection({ title, collapsed, onToggle, children }) {
  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', overflow: 'hidden' }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)',
          border: 'none', color: '#ddd', cursor: 'pointer', fontSize: '0.85rem',
          fontWeight: 'bold', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        {title}
        <span style={{ color: '#666', fontSize: '0.75rem' }}>{collapsed ? '+' : '-'}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '0.5rem 0.75rem' }}>
          {children}
        </div>
      )}
    </div>
  );
}

function DynamicEntry({ item, onUpdate, onRemove }) {
  return (
    <div style={{ padding: '0.4rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', marginBottom: '0.3rem', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '0.25rem', alignItems: 'center' }}>
        <input placeholder="Name" value={item.name} onChange={e => onUpdate('name', e.target.value)} style={{ ...inputStyle, flex: 1, marginBottom: 0, fontWeight: 'bold' }} />
        <button onClick={onRemove} style={{ background: 'transparent', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '1rem' }}>&times;</button>
      </div>
      <textarea placeholder="Description" value={item.description} onChange={e => onUpdate('description', e.target.value)} rows={2} style={{ ...textareaStyle, marginBottom: 0 }} />
    </div>
  );
}

function FormRow({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </div>
  );
}

function FormTextarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      {label && <label style={labelStyle}>{label}</label>}
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        style={textareaStyle}
      />
    </div>
  );
}

function Field({ label, value, color }) {
  return (
    <div>
      <div style={{ color: color || '#aaa', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '0.15rem', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ color: '#ccc', fontSize: '0.85rem', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>{value}</div>
    </div>
  );
}

function StatLine({ label, value }) {
  return (
    <div style={{ marginBottom: '0.2rem' }}>
      <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.82rem' }}>{label} </span>
      <span style={{ color: '#ccc', fontSize: '0.82rem' }}>{value}</span>
    </div>
  );
}

function StatBlockDivider() {
  return <div style={{ height: '2px', background: 'linear-gradient(to right, #ef444440, transparent)', margin: '0.4rem 0' }} />;
}

function SectionHeader({ text, color }) {
  return (
    <div style={{
      color: color || '#ef4444', fontWeight: 'bold', fontSize: '0.9rem',
      marginTop: '0.8rem', marginBottom: '0.3rem',
      borderBottom: `1px solid ${color || '#ef4444'}30`,
      paddingBottom: '0.2rem'
    }}>{text}</div>
  );
}

// ============================================================
// STYLES
// ============================================================

const labelStyle = { color: '#aaa', fontSize: '0.75rem', fontWeight: 'bold', display: 'block', marginBottom: '0.2rem', textTransform: 'uppercase' };

const inputStyle = {
  width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px',
  color: '#ddd', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box'
};

const textareaStyle = {
  width: '100%', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px',
  color: '#ddd', fontSize: '0.82rem', outline: 'none', resize: 'vertical',
  fontFamily: 'inherit', boxSizing: 'border-box'
};

function actionBtnStyle(color) {
  return {
    padding: '0.3rem 0.6rem', background: `${color}15`,
    border: `1px solid ${color}40`, borderRadius: '4px',
    color, cursor: 'pointer', fontSize: '0.8rem'
  };
}
