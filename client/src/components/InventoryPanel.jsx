import React, { useState, useEffect, useMemo } from 'react';

// Local inline SVG sprite — symbol paths copied from the cockpit design's <defs>.
// Kept private to this component so we never depend on / edit a shared sprite.
function InventorySprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <symbol id="inv-i-pack" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8M8 18v-8a4 4 0 0 1 8 0v8"/></symbol>
        <symbol id="inv-i-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></symbol>
        <symbol id="inv-i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
        <symbol id="inv-i-vial" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v15a3 3 0 0 0 6 0V2"/><path d="M8 2h8"/><path d="M9 11h6"/></symbol>
        <symbol id="inv-i-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/></symbol>
        <symbol id="inv-i-tag" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></symbol>
        <symbol id="inv-i-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/></symbol>
        <symbol id="inv-i-trash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></symbol>
        <symbol id="inv-i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
      </defs>
    </svg>
  );
}

const RARITY_LABELS = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  very_rare: 'Very Rare',
  legendary: 'Legendary'
};

const CATEGORY_LABELS = {
  weapons: 'Weapon',
  armor: 'Armor',
  consumables: 'Consumable',
  quest: 'Quest item',
  misc: 'Item'
};

// Map an item category to one of the local sprite icons.
const CATEGORY_ICON = {
  weapons: 'inv-i-bolt',
  armor: 'inv-i-shield',
  consumables: 'inv-i-vial',
  quest: 'inv-i-scroll',
  misc: 'inv-i-pack'
};

// Slot → which sprite icon to show for an equipped piece.
const SLOT_ICON = {
  mainHand: 'inv-i-bolt',
  offHand: 'inv-i-shield',
  armor: 'inv-i-shield'
};

const SLOT_LABEL = {
  mainHand: 'Main hand',
  offHand: 'Off hand',
  armor: 'Armor'
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

// Parse a possibly-stringified equipment blob into an object.
function parseEquipment(raw) {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) || {}; } catch { return {}; }
  }
  return raw;
}

// Build the "Equipped" list from the character + every active companion.
// Each entry: { name, sub, icon, key }.
function buildEquippedList(character, companions) {
  const rows = [];
  const seen = new Set();

  const pushSlot = (eq, slot, holderLabel, isYou) => {
    const item = eq?.[slot];
    const name = item?.name || (typeof item === 'string' ? item : null);
    if (!name) return;
    const key = `${holderLabel}-${slot}-${name}`;
    if (seen.has(key)) return;
    seen.add(key);

    // Sub line: slot label + holder (companions only) + a damage/AC hint if stored.
    const parts = [];
    parts.push(isYou ? SLOT_LABEL[slot] : `${SLOT_LABEL[slot]} · ${holderLabel}`);
    if (item?.damage) parts.push(`${item.damage}${item.damageType ? ' ' + item.damageType : ''}`);
    else if (item?.acBonus) parts.push(`+${item.acBonus} AC`);
    if (item?.magical) parts.push(typeof item.magical === 'string' ? item.magical : 'magical');

    rows.push({
      key,
      name,
      sub: parts.join(' · '),
      icon: SLOT_ICON[slot] || 'inv-i-pack'
    });
  };

  const charEq = parseEquipment(character?.equipment);
  ['mainHand', 'offHand', 'armor'].forEach(slot => pushSlot(charEq, slot, character?.name || 'You', true));

  (companions || []).forEach(c => {
    const compEq = parseEquipment(c.equipment);
    const holder = c.nickname || c.name || 'Companion';
    ['mainHand', 'offHand', 'armor'].forEach(slot => pushSlot(compEq, slot, holder, false));
  });

  return rows;
}

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
      // Pull fresh character state after a successful discard, if provided.
      onRefreshCharacter?.();
    } finally {
      setDiscarding(null);
    }
  };

  const getItemRarity = (itemName) => {
    const key = (itemName || '').toLowerCase();
    return rarityData[key]?.rarity || null;
  };

  const isNewItem = (itemName) => {
    return (itemsGainedThisSession || []).some(n => n.toLowerCase() === (itemName || '').toLowerCase());
  };

  // Equipped list (character + companions). Recompute only when relevant inputs change.
  const equippedList = useMemo(
    () => buildEquippedList(character, companions),
    [character?.equipment, character?.name, companions]
  );

  // Carried items, lightly categorized so we can pick a sensible icon + sub line.
  const carried = useMemo(() => {
    return inventory.map((item) => {
      const name = item.name || item;
      const cat = getItemCategory(item, rarityData);
      const rarity = getItemRarity(name);
      // Sub line: rarity (if notable) else the category label.
      const sub = rarity && rarity !== 'common'
        ? RARITY_LABELS[rarity]
        : CATEGORY_LABELS[cat];
      return {
        name,
        quantity: item.quantity || 1,
        icon: CATEGORY_ICON[cat] || 'inv-i-pack',
        sub,
        isNew: isNewItem(name)
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inventory, rarityData, itemsGainedThisSession]);

  const goldGp = character.gold_gp || 0;

  return (
    <>
      <InventorySprite />
      <div className="panel-scrim show" onClick={onClose} />
      <aside className="pnl open" data-panel="inventory">
        <div className="pnl-head">
          <svg className="ph-ic2"><use href="#inv-i-pack" /></svg>
          <h3>Inventory</h3>
          <span className="ph-sub2">carried · equipped</span>
          <button className="pnl-close" onClick={onClose} aria-label="Close inventory">
            <svg className="ic"><use href="#inv-i-x" /></svg>
          </button>
        </div>

        <div className="pnl-body scroll">
          {/* Equipped — from character + active companions */}
          {equippedList.length > 0 && (
            <>
              <div className="pnl-sec">Equipped<span className="ln" /></div>
              <div className="inv">
                {equippedList.map((row) => (
                  <div className="inv-row" key={row.key}>
                    <span className="ii"><svg className="ic"><use href={`#${row.icon}`} /></svg></span>
                    <div>
                      <div className="inm">{row.name}</div>
                      {row.sub && <div className="idesc">{row.sub}</div>}
                    </div>
                    <span className="iqty" />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Carried — real inventory items */}
          <div className="pnl-sec">Carried<span className="ln" /></div>
          {carried.length === 0 ? (
            <p style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-3)' }}>
              Nothing carried.
            </p>
          ) : (
            <div className="inv">
              {carried.map((row, idx) => (
                <div
                  className="inv-row"
                  key={`${row.name}-${idx}`}
                  style={row.isNew ? { background: 'color-mix(in oklab, var(--good) 9%, transparent)' } : undefined}
                >
                  <span className="ii"><svg className="ic"><use href={`#${row.icon}`} /></svg></span>
                  <div>
                    <div className="inm">
                      {row.name}
                      {row.isNew && (
                        <span style={{
                          marginLeft: 8,
                          fontFamily: 'var(--sans)',
                          fontWeight: 600,
                          fontSize: 8.5,
                          letterSpacing: '.14em',
                          textTransform: 'uppercase',
                          color: 'var(--good)'
                        }}>
                          New
                        </span>
                      )}
                    </div>
                    {row.sub && <div className="idesc">{row.sub}</div>}
                  </div>
                  <span className="iqty" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    {row.quantity > 1 ? `×${row.quantity}` : ''}
                    <button
                      onClick={() => handleDiscard(row.name)}
                      disabled={discarding === row.name}
                      title="Discard item"
                      aria-label={`Discard ${row.name}`}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: 2,
                        cursor: discarding === row.name ? 'wait' : 'pointer',
                        color: 'var(--ink-4)',
                        opacity: discarding === row.name ? 0.4 : 1,
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <svg className="ic" style={{ width: 14, height: 14 }}><use href="#inv-i-trash" /></svg>
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Gold */}
          <div className="gold-row">
            <svg className="ic" style={{ width: 16, height: 16, color: 'var(--accent)' }}><use href="#inv-i-coin" /></svg>
            <span className="gl">Gold</span>
            <span className="gv">{goldGp}<span className="un"> gp</span></span>
          </div>
        </div>
      </aside>
    </>
  );
}
