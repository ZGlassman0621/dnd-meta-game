import { useState } from 'react';
import { CONDITIONS, CONDITION_CATEGORIES } from '../data/conditions.js';

const ACCENT = '#f59e0b';

const SECTIONS = [
  { key: 'conditions', label: 'Conditions' },
  { key: 'combat', label: 'Combat' },
  { key: 'rest', label: 'Resting' },
  { key: 'vision', label: 'Vision' },
  { key: 'cover', label: 'Cover' },
  { key: 'travel', label: 'Travel' },
  { key: 'environment', label: 'Environ.' },
];

// ============================================================
// RULES DATA
// ============================================================

const COMBAT_ACTIONS = [
  { name: 'Attack', description: 'Make one melee or ranged attack. With Extra Attack, you can make additional attacks as part of this action.' },
  { name: 'Cast a Spell', description: 'Cast a spell with a casting time of 1 action. Spells with longer casting times require consecutive actions each turn.' },
  { name: 'Dash', description: 'Gain extra movement equal to your speed (after modifiers) for the current turn. Stacks with movement.' },
  { name: 'Disengage', description: 'Your movement does not provoke opportunity attacks for the rest of the turn.' },
  { name: 'Dodge', description: 'Until your next turn, any attack against you has disadvantage if you can see the attacker, and you make DEX saves with advantage. Lost if incapacitated or speed drops to 0.' },
  { name: 'Help', description: 'Give an ally advantage on their next ability check for a task, OR advantage on their next attack roll against a target within 5 feet of you.' },
  { name: 'Hide', description: 'Make a DEX (Stealth) check. If you succeed, you are hidden: unseen and unheard. Attacks against you have disadvantage, your attacks have advantage.' },
  { name: 'Ready', description: 'Prepare an action with a specific trigger. Uses your reaction when triggered. Readied spells require concentration and use the slot even if not triggered.' },
  { name: 'Search', description: 'Make a WIS (Perception) or INT (Investigation) check to notice or find something.' },
  { name: 'Use an Object', description: 'Interact with a second object or use an object requiring an action (e.g., potion, caltrops). First object interaction each turn is free.' },
];

const OTHER_COMBAT = [
  { name: 'Bonus Action', description: 'One per turn. Only available if a feature or spell grants one (e.g., two-weapon fighting, Cunning Action, bonus action spells). Cannot split between main and bonus action spells in the same turn.' },
  { name: 'Reaction', description: 'One per round (resets at start of your turn). Triggered by a specified event. Common: Opportunity Attack, Shield spell, Counterspell, Readied action.' },
  { name: 'Opportunity Attack', description: 'When a hostile creature you can see leaves your reach, you can use your reaction to make one melee attack. Disengage prevents this.' },
  { name: 'Two-Weapon Fighting', description: 'When you attack with a light melee weapon, you can use a bonus action to attack with a different light melee weapon in your other hand. No ability modifier to damage unless negative.' },
  { name: 'Grapple', description: 'Replace one attack with a grapple: STR (Athletics) vs target\'s STR (Athletics) or DEX (Acrobatics). Target must be no more than one size larger. Success: target is grappled (speed 0).' },
  { name: 'Shove', description: 'Replace one attack with a shove: STR (Athletics) vs target\'s STR (Athletics) or DEX (Acrobatics). Success: push 5 feet away OR knock prone.' },
];

const REST_RULES = {
  short: {
    name: 'Short Rest (1 hour)',
    rules: [
      'Spend Hit Dice to regain HP: roll hit die + CON modifier per die spent',
      'Warlock spell slots recharge (Pact Magic)',
      'Some class features recharge (Fighter: Second Wind, Action Surge; Monk: Ki points; Bard: Bardic Inspiration)',
      'Must have at least 1 HP to benefit'
    ]
  },
  long: {
    name: 'Long Rest (8 hours)',
    rules: [
      'Regain ALL lost hit points',
      'Regain spent Hit Dice up to half your total (minimum 1)',
      'Regain all expended spell slots',
      'Exhaustion level reduced by 1 (if you have food and drink)',
      'Cannot benefit from more than one long rest in a 24-hour period',
      'Must have at least 1 HP to start a long rest',
      'At least 6 hours sleeping + 2 hours light activity (reading, keeping watch)',
      'If interrupted by 1+ hour of combat, walking, or spellcasting, must restart'
    ]
  },
  death: {
    name: 'Death Saves',
    rules: [
      'At 0 HP, make a death saving throw at the start of each turn (d20, no modifiers)',
      '10 or higher: success. 9 or lower: failure',
      '3 successes: stabilized (unconscious but not dying)',
      '3 failures: death',
      'Natural 20: regain 1 HP and become conscious',
      'Natural 1: counts as 2 failures',
      'Taking damage at 0 HP: 1 auto-failure (critical hit = 2 failures)',
      'Receiving healing at 0 HP: regain consciousness with healed HP'
    ]
  }
};

const VISION_RULES = [
  { name: 'Bright Light', description: 'Normal vision. Torches, daylight, lanterns, and fires provide bright light within their radius.' },
  { name: 'Dim Light', description: 'Lightly obscured. Shadows, twilight, moderately bright moon. Disadvantage on WIS (Perception) checks relying on sight.' },
  { name: 'Darkness', description: 'Heavily obscured. Effectively the Blinded condition for creatures without darkvision or other special senses.' },
  { name: 'Darkvision', description: 'See in dim light as if bright light, and darkness as if dim light (within range). Cannot discern color in darkness - only shades of gray. Common range: 60 ft.' },
  { name: 'Lightly Obscured', description: 'Dim light, patchy fog, moderate foliage. Creatures have disadvantage on Perception checks relying on sight.' },
  { name: 'Heavily Obscured', description: 'Darkness, opaque fog, dense foliage. A creature in a heavily obscured area effectively suffers the Blinded condition.' },
  { name: 'Blindsight', description: 'Perceive surroundings without sight (echolocation, keen senses). Can see invisible creatures within range.' },
  { name: 'Truesight', description: 'See in normal and magical darkness, see invisible creatures, automatically detect visual illusions, perceive shapechangers\' true forms, see into the Ethereal Plane. Range typically 120 ft.' },
];

const COVER_RULES = [
  { name: 'Half Cover', bonus: '+2 AC, +2 DEX saves', description: 'At least half the target is covered. Low wall, furniture, another creature, tree trunk.' },
  { name: 'Three-Quarters Cover', bonus: '+5 AC, +5 DEX saves', description: 'About three-quarters of the target is covered. Arrow slit, thick tree, portcullis.' },
  { name: 'Full Cover', bonus: 'Cannot be targeted', description: 'Completely concealed by an obstacle. Can still be affected by AoE that reaches around cover. Solid wall, closed door, pillar.' },
];

const TRAVEL_PACE = [
  { pace: 'Fast', perHour: '4 miles', perDay: '30 miles', effect: '-5 passive Perception, cannot use Stealth' },
  { pace: 'Normal', perHour: '3 miles', perDay: '24 miles', effect: 'No penalty' },
  { pace: 'Slow', perHour: '2 miles', perDay: '18 miles', effect: 'Can use Stealth' },
];

const TRAVEL_EXTRA = [
  { name: 'Forced March', description: 'Each hour past 8: DC 10 + hours past 8 CON save or gain 1 exhaustion level.' },
  { name: 'High Jump', description: '3 + STR modifier feet (with 10 ft running start). Half that from standing. Each foot costs 1 foot of movement.' },
  { name: 'Long Jump', description: 'STR score in feet (with 10 ft running start). Half that from standing. Each foot costs 1 foot of movement.' },
  { name: 'Climbing / Swimming', description: 'Each foot costs 1 extra foot of movement (2 extra in difficult terrain) unless you have a climb/swim speed.' },
  { name: 'Navigation', description: 'WIS (Survival) check. Forest/Jungle DC 15, Swamp DC 15, Mountains DC 12, Plains/Grassland DC 10, Desert DC 10, Coast DC 5.' },
];

const ENVIRONMENT_RULES = [
  { name: 'Falling', description: '1d6 bludgeoning damage per 10 feet fallen, max 20d6 (200 ft). Land prone if you take any damage.' },
  { name: 'Suffocation', description: 'Hold breath for 1 + CON modifier minutes (min 30 sec). When out of breath, survive CON modifier rounds (min 1). Then drop to 0 HP and are dying.' },
  { name: 'Difficult Terrain', description: 'Every foot of movement costs 1 extra foot. Multiple sources of difficult terrain do not stack.' },
  { name: 'Squeezing', description: 'A creature can squeeze through a space one size smaller. Costs 1 extra foot per foot moved. Disadvantage on attacks and DEX saves. Attacks against it have advantage.' },
  { name: 'Object AC', description: 'Cloth/Paper 11, Rope 11, Crystal/Glass 13, Wood/Bone 15, Stone 17, Iron/Steel 19, Mithral 21, Adamantine 23.' },
  { name: 'Object HP', description: 'Tiny (bottle): 2 (1d4), Small (chest): 10 (3d6), Medium (barrel): 18 (4d8), Large (cart): 27 (5d10). Resilient objects (stone, iron) may have damage thresholds.' },
];

// ============================================================
// COMPONENT
// ============================================================

export default function RulesReferencePanel({ onClose }) {
  const [activeSection, setActiveSection] = useState('conditions');
  const [expandedItem, setExpandedItem] = useState(null);

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h3 style={{ color: ACCENT, margin: 0, fontSize: '1rem' }}>Rules Reference</h3>
        <button onClick={onClose} style={closeBtnStyle}>&times;</button>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: '0.15rem', padding: '0.4rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0, overflowX: 'auto' }}>
        {SECTIONS.map(sec => (
          <button
            key={sec.key}
            onClick={() => { setActiveSection(sec.key); setExpandedItem(null); }}
            style={{
              padding: '0.15rem 0.4rem', borderRadius: '3px', fontSize: '0.7rem', whiteSpace: 'nowrap',
              background: activeSection === sec.key ? `${ACCENT}22` : 'transparent',
              border: `1px solid ${activeSection === sec.key ? ACCENT : 'rgba(255,255,255,0.12)'}`,
              color: activeSection === sec.key ? ACCENT : '#888', cursor: 'pointer',
              fontWeight: activeSection === sec.key ? 'bold' : 'normal'
            }}
          >{sec.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0.75rem' }}>
        {activeSection === 'conditions' && <ConditionsSection expandedItem={expandedItem} setExpandedItem={setExpandedItem} />}
        {activeSection === 'combat' && <CombatSection expandedItem={expandedItem} setExpandedItem={setExpandedItem} />}
        {activeSection === 'rest' && <RestSection />}
        {activeSection === 'vision' && <VisionSection />}
        {activeSection === 'cover' && <CoverSection />}
        {activeSection === 'travel' && <TravelSection />}
        {activeSection === 'environment' && <EnvironmentSection />}
      </div>
    </div>
  );
}

// ============================================================
// SECTION RENDERERS
// ============================================================

function ConditionsSection({ expandedItem, setExpandedItem }) {
  const grouped = {};
  for (const [key, cond] of Object.entries(CONDITIONS)) {
    const cat = cond.category || 'other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({ key, ...cond });
  }

  return (
    <>
      {Object.entries(CONDITION_CATEGORIES).map(([catKey, cat]) => {
        const items = grouped[catKey] || [];
        if (items.length === 0) return null;
        return (
          <div key={catKey} style={{ marginBottom: '0.6rem' }}>
            <div style={{ color: cat.color, fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.25rem', borderBottom: `1px solid ${cat.color}30`, paddingBottom: '0.15rem' }}>
              {cat.label}
            </div>
            {items.map(cond => (
              <div key={cond.key} style={{
                padding: '0.35rem 0.5rem', marginBottom: '0.2rem',
                borderLeft: `3px solid ${cond.color}`, borderRadius: '0 4px 4px 0',
                background: expandedItem === cond.key ? 'rgba(255,255,255,0.04)' : 'transparent',
                cursor: 'pointer'
              }} onClick={() => setExpandedItem(expandedItem === cond.key ? null : cond.key)}>
                <div style={{ color: cond.color, fontWeight: 'bold', fontSize: '0.82rem' }}>{cond.name}</div>
                {(expandedItem === cond.key || catKey === 'exhaustion') && (
                  <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.15rem', lineHeight: '1.4' }}>{cond.description}</div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}

function CombatSection({ expandedItem, setExpandedItem }) {
  return (
    <>
      <SectionTitle text="Actions (one per turn)" />
      {COMBAT_ACTIONS.map(a => (
        <RuleCard key={a.name} item={a} expanded={expandedItem === a.name} onToggle={() => setExpandedItem(expandedItem === a.name ? null : a.name)} />
      ))}
      <SectionTitle text="Other Combat Rules" />
      {OTHER_COMBAT.map(a => (
        <RuleCard key={a.name} item={a} expanded={expandedItem === `other_${a.name}`} onToggle={() => setExpandedItem(expandedItem === `other_${a.name}` ? null : `other_${a.name}`)} />
      ))}
    </>
  );
}

function RestSection() {
  return (
    <>
      {Object.values(REST_RULES).map(rest => (
        <div key={rest.name} style={{ marginBottom: '0.8rem' }}>
          <div style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem' }}>{rest.name}</div>
          {rest.rules.map((rule, i) => (
            <div key={i} style={{ color: '#bbb', fontSize: '0.78rem', marginBottom: '0.2rem', paddingLeft: '0.5rem', borderLeft: '2px solid rgba(245,158,11,0.2)' }}>
              {rule}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function VisionSection() {
  return (
    <>
      {VISION_RULES.map(v => (
        <div key={v.name} style={{ marginBottom: '0.5rem', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
          <div style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.82rem' }}>{v.name}</div>
          <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.1rem', lineHeight: '1.4' }}>{v.description}</div>
        </div>
      ))}
    </>
  );
}

function CoverSection() {
  return (
    <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Table header */}
      <div style={{ display: 'flex', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ flex: 1, color: ACCENT, fontWeight: 'bold', fontSize: '0.72rem' }}>Type</span>
        <span style={{ flex: 1, color: ACCENT, fontWeight: 'bold', fontSize: '0.72rem' }}>Bonus</span>
      </div>
      {COVER_RULES.map(c => (
        <div key={c.name} style={{ padding: '0.5rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ display: 'flex', marginBottom: '0.15rem' }}>
            <span style={{ flex: 1, color: '#ddd', fontWeight: 'bold', fontSize: '0.82rem' }}>{c.name}</span>
            <span style={{ flex: 1, color: '#22c55e', fontSize: '0.78rem', fontWeight: 'bold' }}>{c.bonus}</span>
          </div>
          <div style={{ color: '#999', fontSize: '0.72rem' }}>{c.description}</div>
        </div>
      ))}
    </div>
  );
}

function TravelSection() {
  return (
    <>
      {/* Pace table */}
      <SectionTitle text="Travel Pace" />
      <div style={{ borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', marginBottom: '0.8rem' }}>
        <div style={{ display: 'flex', padding: '0.3rem 0.5rem', background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '0.68rem', color: ACCENT, fontWeight: 'bold' }}>
          <span style={{ width: '55px' }}>Pace</span>
          <span style={{ width: '55px' }}>/Hour</span>
          <span style={{ width: '55px' }}>/Day</span>
          <span style={{ flex: 1 }}>Effect</span>
        </div>
        {TRAVEL_PACE.map(t => (
          <div key={t.pace} style={{ display: 'flex', padding: '0.3rem 0.5rem', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.78rem' }}>
            <span style={{ width: '55px', color: '#ddd', fontWeight: 'bold' }}>{t.pace}</span>
            <span style={{ width: '55px', color: '#aaa' }}>{t.perHour}</span>
            <span style={{ width: '55px', color: '#aaa' }}>{t.perDay}</span>
            <span style={{ flex: 1, color: '#999' }}>{t.effect}</span>
          </div>
        ))}
      </div>

      {/* Extra rules */}
      <SectionTitle text="Movement Rules" />
      {TRAVEL_EXTRA.map(t => (
        <div key={t.name} style={{ marginBottom: '0.4rem', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
          <div style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.82rem' }}>{t.name}</div>
          <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.1rem' }}>{t.description}</div>
        </div>
      ))}
    </>
  );
}

function EnvironmentSection() {
  return (
    <>
      {ENVIRONMENT_RULES.map(e => (
        <div key={e.name} style={{ marginBottom: '0.5rem', padding: '0.35rem 0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px' }}>
          <div style={{ color: ACCENT, fontWeight: 'bold', fontSize: '0.82rem' }}>{e.name}</div>
          <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.1rem', lineHeight: '1.4' }}>{e.description}</div>
        </div>
      ))}
    </>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function SectionTitle({ text }) {
  return (
    <div style={{ color: ACCENT, fontSize: '0.72rem', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '0.3rem', marginTop: '0.2rem', borderBottom: `1px solid ${ACCENT}25`, paddingBottom: '0.15rem' }}>
      {text}
    </div>
  );
}

function RuleCard({ item, expanded, onToggle }) {
  return (
    <div
      onClick={onToggle}
      style={{
        padding: '0.35rem 0.5rem', marginBottom: '0.2rem', cursor: 'pointer',
        background: expanded ? 'rgba(245,158,11,0.05)' : 'rgba(255,255,255,0.02)',
        borderRadius: '4px', border: `1px solid ${expanded ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)'}`
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#ddd', fontWeight: 'bold', fontSize: '0.82rem' }}>{item.name}</span>
        <span style={{ color: '#666', fontSize: '0.7rem' }}>{expanded ? '-' : '+'}</span>
      </div>
      {expanded && (
        <div style={{ color: '#bbb', fontSize: '0.78rem', marginTop: '0.2rem', lineHeight: '1.4' }}>{item.description}</div>
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
