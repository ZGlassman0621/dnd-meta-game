import React, { useState, useEffect } from 'react';

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

export default function InventoryPanel({ character, itemsGainedThisSession, onDiscard, onClose, onRefreshCharacter }) {
  const [rarityData, setRarityData] = useState({});
  const [discarding, setDiscarding] = useState(null);
  const [filter, setFilter] = useState('all'); // all, weapons, armor, misc

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

  const getItemCategory = (item) => {
    // Check item properties first
    if (item.type === 'weapon' || item.damage || item.category?.includes('weapon')) return 'weapons';
    if (item.type === 'armor' || item.category?.includes('armor') || item.ac) return 'armor';
    // Check rarity data category
    const key = (item.name || '').toLowerCase();
    const rd = rarityData[key];
    if (rd?.category === 'weapon' || rd?.category === 'weapons') return 'weapons';
    if (rd?.category === 'armor') return 'armor';
    return 'misc';
  };

  const filteredInventory = filter === 'all'
    ? inventory
    : inventory.filter(item => getItemCategory(item) === filter);

  const isNewItem = (itemName) => {
    return itemsGainedThisSession.some(n => n.toLowerCase() === (itemName || '').toLowerCase());
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
        <h3 style={{ margin: 0, color: '#10b981' }}>Inventory</h3>
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

      {/* Filter Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        padding: '0 0.5rem'
      }}>
        {[
          { id: 'all', label: 'All' },
          { id: 'weapons', label: 'Weapons' },
          { id: 'armor', label: 'Armor' },
          { id: 'misc', label: 'Misc' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            style={{
              flex: 1,
              padding: '0.5rem',
              background: filter === tab.id ? 'rgba(16, 185, 129, 0.2)' : 'transparent',
              border: 'none',
              borderBottom: filter === tab.id ? '2px solid #10b981' : '2px solid transparent',
              color: filter === tab.id ? '#10b981' : '#888',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: filter === tab.id ? 'bold' : 'normal'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Item List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem'
      }}>
        {filteredInventory.length === 0 ? (
          <p style={{ color: '#888', fontStyle: 'italic', textAlign: 'center', marginTop: '2rem' }}>
            {filter === 'all' ? 'No items in inventory' : `No ${filter} items`}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredInventory.map((item, idx) => {
              const itemName = item.name || item;
              const quantity = item.quantity || 1;
              const rarity = getItemRarity(itemName);
              const isNew = isNewItem(itemName);
              const rarityColor = rarity ? RARITY_COLORS[rarity] : '#ccc';

              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: isNew
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(255, 255, 255, 0.03)',
                    borderRadius: '4px',
                    border: isNew
                      ? '1px solid rgba(16, 185, 129, 0.4)'
                      : '1px solid rgba(255, 255, 255, 0.05)',
                    transition: 'background 0.2s'
                  }}
                >
                  {/* Item Name + Rarity */}
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
                  </div>

                  {/* NEW badge */}
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

                  {/* Quantity */}
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

                  {/* Discard Button */}
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
            })}
          </div>
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
