import React, { useState, useEffect, useMemo } from 'react';

const RARITY_COLORS = {
  common: '#9ca3af',
  uncommon: '#a78bfa',
  rare: '#60a5fa',
  very_rare: '#c084fc',
  legendary: '#ff8c00'
};

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
  legendary: 'Legendary'
};

// Ultima-style sectioned layout: all items visible at once, grouped.
// Order matters — this is the display order in the panel.
const CATEGORY_ORDER = ['weapons', 'armor', 'consumables', 'quest', 'misc'];

const CATEGORY_LABELS = {
  weapons: 'Weapons',
  armor: 'Armor',
  consumables: 'Consumables',
  quest: 'Quest Items',
  misc: 'Misc'
};

const CATEGORY_COLORS = {
  weapons: '#ef4444',
  armor: '#60a5fa',
  consumables: '#34d399',
  quest: '#f59e0b',
  misc: '#9ca3af'
};

// Non-weapon religious / focus items that accidentally match weapon heuristics
const NON_WEAPON_ITEMS = [
  'signet', 'insignia', 'holy symbol', 'druidic focus', 'arcane focus',
  'component pouch', 'emblem', 'amulet', 'reliquary', 'totem',
  'ring', 'badge', 'seal', 'medallion', 'vestments', 'banner', 'symbol'
];

// Consumable name heuristics
const CONSUMABLE_KEYWORDS = [
  'potion', 'elixir', 'philter', 'scroll', 'ration', 'trail ration',
  'water', 'wine', 'ale', 'food', 'bread', 'cheese', 'meat',
  'antitoxin', 'oil', 'poison', 'acid', 'alchemist', 'holy water'
];

// Quest item heuristics — kept narrow so we don't mis-label mundane items.
// An item is "quest" only if explicitly flagged or the name contains one of
// these words. Most items shouldn't land here.
const QUEST_KEYWORDS = [
  'quest', 'relic', 'artifact', 'heirloom', 'sacred', 'ancient',
  'prophecy', 'token of', 'letter from', 'sealed letter',
  'key to', 'map to'
];

function getItemCategory(item, rarityData) {
  const name = (item.name || item || '').toString();
  const lower = name.toLowerCase();

  // Explicit flags win
  if (item.quest === true || item.category === 'quest' || item.category === 'quest_item') return 'quest';

  // Quest heuristic — name-based. Narrow, so only obvious ones get tagged.
  if (QUEST_KEYWORDS.some(kw => lower.includes(kw))) return 'quest';

  const rd = rarityData[lower];

  // Consumables — by explicit category first, then name heuristics
  if (item.category === 'consumable' || rd?.category === 'consumable' || rd?.category === 'potion') return 'consumables';
  if (CONSUMABLE_KEYWORDS.some(kw => lower.includes(kw))) return 'consumables';

  const isNonWeapon = NON_WEAPON_ITEMS.some(nw => lower.includes(nw));

  // Weapons
  if (!isNonWeapon && (item.type === 'weapon' || item.damage || item.category?.includes('weapon'))) return 'weapons';
  if (!isNonWeapon && (rd?.category === 'weapon' || rd?.category === 'weapons')) return 'weapons';

  // Armor
  if (item.type === 'armor' || item.category?.includes('armor') || item.ac) return 'armor';
  if (rd?.category === 'armor' || rd?.category === 'shield') return 'armor';

  return 'misc';
}

// Collect equipment from character + all active companions into a map of
// { itemName_lower → [{ holder, slot, color }] } for fast lookup during render.
function buildEquippedByMap(character, companions) {
  const map = new Map();
  const add = (itemName, holder, slot, color) => {
    if (!itemName) return;
    const key = itemName.toLowerCase();
    const list = map.get(key) || [];
    list.push({ holder, slot, color });
    map.set(key, list);
  };

  const parseEq = (raw) => {
    if (!raw) return {};
    if (typeof raw === 'string') {
      try { return JSON.parse(raw) || {}; } catch { return {}; }
    }
    return raw;
  };

  const charEq = parseEq(character?.equipment);
  ['mainHand', 'offHand', 'armor'].forEach(slot => {
    const item = charEq[slot];
    if (item?.name) add(item.name, character.name || 'You', slot, '#10b981');
  });

  (companions || []).forEach(c => {
    const compEq = parseEq(c.equipment);
    ['mainHand', 'offHand', 'armor'].forEach(slot => {
      const item = compEq[slot];
      if (item?.name) add(item.name, c.name || c.nickname || 'Companion', slot, '#a78bfa');
    });
  });

  return map;
}

const SLOT_LABEL = {
  mainHand: 'main',
  offHand: 'off',
  armor: 'armor'
};

export default function InventoryPanel({ character, companions, itemsGainedThisSession, onDiscard, onClose, onRefreshCharacter }) {
  const [rarityData, setRarityData] = useState({});
  const [discarding, setDiscarding] = useState(null);

  const inventory = typeof character.inventory === 'string'
    ? JSON.parse(character.inventory || '[]')
    : (character.inventory || []);

  // Fetch rarity data for all items on mount or when inventory changes
  useEffect(() => {
    if (inventory.length === 0) return;
    const itemNames = inventory.map(i => i.name || i);
    fetch('/api/dm-session/item-rarity-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: itemNames })
    })
      .then(res => res.json())
      .then(data => setRarityData(data.items || {}))
      .catch(() => {}); // silently fail — rarity colors are optional
  }, [character.inventory]);

  const handleDiscard = async (itemName) => {
    setDiscarding(itemName);
    try {
      await onDiscard(itemName);
    } finally {
      setDiscarding(null);
    }
  };

  const getItemRarity = (itemName) => {
    const key = (itemName || '').toLowerCase();
    return rarityData[key]?.rarity || null;
  };

  const isNewItem = (itemName) => {
    return itemsGainedThisSession.some(n => n.toLowerCase() === (itemName || '').toLowerCase());
  };

  // Precompute equipped-by map (recomputes only when companions / character.equipment change)
  const equippedByMap = useMemo(
    () => buildEquippedByMap(character, companions),
    [character?.equipment, character?.name, companions]
  );

  // Group items into the five sections
  const grouped = useMemo(() => {
    const out = { weapons: [], armor: [], consumables: [], quest: [], misc: [] };
    for (const item of inventory) {
      const cat = getItemCategory(item, rarityData);
      out[cat].push(item);
    }
    return out;
  }, [inventory, rarityData]);

  const renderItem = (item, idx) => {
    const itemName = item.name || item;
    const quantity = item.quantity || 1;
    const rarity = getItemRarity(itemName);
    const isNew = isNewItem(itemName);
    const rarityColor = rarity ? RARITY_COLORS[rarity] : '#ccc';
    const equippedBy = equippedByMap.get((itemName || '').toLowerCase()) || [];

    return (
      <div
        key={idx}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: isNew ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.03)',
          borderRadius: '4px',
          border: isNew ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(255, 255, 255, 0.05)',
          transition: 'background 0.2s'
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            color: rarityColor,
            fontWeight: rarity && rarity !== 'common' ? 'bold' : 'normal',
            fontSize: '0.9rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {itemName}
          </div>
          {rarity && rarity !== 'common' && (
            <div style={{ fontSize: '0.7rem', color: rarityColor, opacity: 0.8 }}>
              {RARITY_LABELS[rarity]}
            </div>
          )}
          {/* Equipped-by badges. Multiple if the same-named item is equipped by
              multiple party members. Clicking would be nice-to-have later. */}
          {equippedBy.length > 0 && (
            <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.2rem', flexWrap: 'wrap' }}>
              {equippedBy.map((eq, i) => (
                <span
                  key={i}
                  title={`Equipped by ${eq.holder} (${eq.slot})`}
                  style={{
                    background: `${eq.color}22`,
                    border: `1px solid ${eq.color}`,
                    color: eq.color,
                    padding: '1px 6px',
                    borderRadius: '8px',
                    fontSize: '0.65rem',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {eq.holder} · {SLOT_LABEL[eq.slot] || eq.slot}
                </span>
              ))}
            </div>
          )}
        </div>

        {isNew && (
          <span style={{
            padding: '0.1rem 0.4rem',
            background: 'rgba(16, 185, 129, 0.3)',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            borderRadius: '3px',
            color: '#10b981',
            fontSize: '0.65rem',
            fontWeight: 'bold',
            letterSpacing: '0.05em'
          }}>
            NEW
          </span>
        )}

        {quantity > 1 && (
          <span style={{
            padding: '0.1rem 0.4rem',
            background: 'rgba(255, 255, 255, 0.1)',
            borderRadius: '3px',
            color: '#ccc',
            fontSize: '0.75rem',
            fontWeight: 'bold'
          }}>
            ×{quantity}
          </span>
        )}

        <button
          onClick={() => handleDiscard(itemName)}
          disabled={discarding === itemName}
          title="Discard item"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#666',
            cursor: discarding === itemName ? 'wait' : 'pointer',
            padding: '0.2rem',
            fontSize: '1rem',
            lineHeight: 1,
            opacity: discarding === itemName ? 0.5 : 1
          }}
          onMouseEnter={(e) => e.target.style.color = '#ef4444'}
          onMouseLeave={(e) => e.target.style.color = '#666'}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '400px',
      maxWidth: '90vw',
      height: '100vh',
      background: 'linear-gradient(135deg, rgba(20, 20, 30, 0.98) 0%, rgba(30, 30, 45, 0.98) 100%)',
      borderLeft: '1px solid rgba(16, 185, 129, 0.3)',
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
        <h3 style={{ margin: 0, color: '#10b981' }}>Party Inventory</h3>
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

      {/* Gold Bar */}
      <div style={{
        padding: '0.75rem 1rem',
        background: 'rgba(234, 179, 8, 0.1)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        gap: '1rem',
        alignItems: 'center'
      }}>
        <div>
          <span style={{ color: '#d4af37', fontWeight: 'bold', fontSize: '1.1rem' }}>
            {character.gold_gp || 0}
          </span>
          <span style={{ color: '#888', marginLeft: '0.25rem' }}>gp</span>
        </div>
        {character.gold_sp > 0 && (
          <div>
            <span style={{ color: '#c0c0c0', fontWeight: 'bold' }}>{character.gold_sp}</span>
            <span style={{ color: '#888', marginLeft: '0.25rem' }}>sp</span>
          </div>
        )}
        {character.gold_cp > 0 && (
          <div>
            <span style={{ color: '#cd7f32', fontWeight: 'bold' }}>{character.gold_cp}</span>
            <span style={{ color: '#888', marginLeft: '0.25rem' }}>cp</span>
          </div>
        )}
      </div>

      {/* Item List — Ultima-style sectioned layout, all categories visible */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem'
      }}>
        {inventory.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            No items in inventory
          </p>
        ) : (
          CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (items.length === 0) return null;
            return (
              <div key={cat} style={{ marginBottom: '1rem' }}>
                <div style={{
                  color: CATEGORY_COLORS[cat],
                  fontSize: '0.72rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  marginBottom: '0.35rem',
                  paddingBottom: '0.25rem',
                  borderBottom: `1px solid ${CATEGORY_COLORS[cat]}33`
                }}>
                  {CATEGORY_LABELS[cat]} <span style={{ opacity: 0.6, fontWeight: 'normal' }}>({items.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {items.map((item, idx) => renderItem(item, `${cat}-${idx}`))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer: item count */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.8rem',
        color: '#666'
      }}>
        <span>{inventory.length} item{inventory.length !== 1 ? 's' : ''}</span>
        {itemsGainedThisSession.length > 0 && (
          <span style={{ color: '#10b981' }}>
            +{itemsGainedThisSession.length} this session
          </span>
        )}
      </div>
    </div>
  );
}
