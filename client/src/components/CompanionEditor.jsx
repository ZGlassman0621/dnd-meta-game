import { useState } from 'react'
import npcPersonalities from '../data/npcPersonalities.json'
import equipmentData from '../data/equipment.json'
import classesData from '../data/classes.json'

// Subclass selection levels by class
const SUBCLASS_LEVELS = {
  barbarian: 3,
  bard: 3,
  cleric: 1,
  druid: 2,
  fighter: 3,
  monk: 3,
  paladin: 3,
  ranger: 3,
  rogue: 3,
  sorcerer: 1,
  warlock: 1,
  wizard: 2,
  artificer: 3
}

// Helper to get all weapons in a flat list
const getAllWeapons = () => {
  const weapons = []
  Object.values(equipmentData.simpleWeapons).forEach(category => {
    category.forEach(w => weapons.push(w))
  })
  Object.values(equipmentData.martialWeapons).forEach(category => {
    category.forEach(w => weapons.push(w))
  })
  return weapons
}

// Helper to get all armor in a flat list
const getAllArmor = () => {
  const armor = []
  equipmentData.armor.light.forEach(a => armor.push(a))
  equipmentData.armor.medium.forEach(a => armor.push(a))
  equipmentData.armor.heavy.forEach(a => armor.push(a))
  return armor
}

const ALL_WEAPONS = getAllWeapons()
const ALL_ARMOR = getAllArmor()
const ALL_SHIELDS = equipmentData.armor.shields
const QUALITY_RANKS = equipmentData.qualityRanks

const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}

const VOICE_OPTIONS = [
  'Deep and rumbling',
  'High and melodic',
  'Raspy and harsh',
  'Soft and whispery',
  'Loud and booming',
  'Calm and measured',
  'Quick and nervous',
  'Slow and deliberate',
  'Accented',
  'Monotone'
]

function CompanionEditor({ companion, onSave, onCancel }) {
  // Parse inventory from companion_inventory field
  const parseInventory = () => {
    try {
      const inv = companion.companion_inventory || companion.inventory
      if (typeof inv === 'string') return JSON.parse(inv)
      if (Array.isArray(inv)) return inv
      return []
    } catch {
      return []
    }
  }

  // Parse equipment from companion
  const parseEquipment = () => {
    try {
      const eq = companion.equipment
      if (typeof eq === 'string') return JSON.parse(eq)
      if (typeof eq === 'object' && eq !== null) return eq
      return {}
    } catch {
      return {}
    }
  }

  const [formData, setFormData] = useState({
    // Personal
    nickname: companion.nickname || '',
    // Appearance
    height: companion.height || '',
    build: companion.build || '',
    hairColor: companion.hair_color || '',
    hairStyle: companion.hair_style || '',
    eyeColor: companion.eye_color || '',
    skinTone: companion.skin_tone || '',
    distinguishingMarks: companion.distinguishing_marks || '',
    // Personality
    personalityTrait1: companion.personality_trait_1 || '',
    personalityTrait2: companion.personality_trait_2 || '',
    voice: companion.voice || '',
    mannerism: companion.mannerism || '',
    motivation: companion.motivation || '',
    // Background
    backstory: companion.background_notes || '',
    relationshipToParty: companion.relationship_to_party || '',
    // Ability scores (only for class-based)
    abilityScores: companion.companion_ability_scores
      ? JSON.parse(companion.companion_ability_scores)
      : companion.npc_ability_scores
        ? JSON.parse(companion.npc_ability_scores)
        : { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    // Subclass (only for class-based)
    subclass: companion.companion_subclass || '',
    // Inventory and gold
    inventory: parseInventory(),
    goldGp: companion.gold_gp || 0,
    goldSp: companion.gold_sp || 0,
    goldCp: companion.gold_cp || 0,
    // Equipment slots
    equipment: parseEquipment()
  })

  const [newItemName, setNewItemName] = useState('')
  const [newItemQty, setNewItemQty] = useState(1)

  const [activeTab, setActiveTab] = useState('personality')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const isClassBased = companion.progression_type === 'class_based'

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const updateAbilityScore = (ability, value) => {
    const numValue = Math.max(1, Math.min(20, parseInt(value) || 10))
    setFormData(prev => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [ability]: numValue }
    }))
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  const addInventoryItem = () => {
    if (!newItemName.trim()) return
    const newItem = { name: newItemName.trim(), quantity: Math.max(1, newItemQty) }
    setFormData(prev => ({
      ...prev,
      inventory: [...prev.inventory, newItem]
    }))
    setNewItemName('')
    setNewItemQty(1)
  }

  const removeInventoryItem = (index) => {
    setFormData(prev => ({
      ...prev,
      inventory: prev.inventory.filter((_, i) => i !== index)
    }))
  }

  const updateItemQuantity = (index, newQty) => {
    const qty = Math.max(1, parseInt(newQty) || 1)
    setFormData(prev => ({
      ...prev,
      inventory: prev.inventory.map((item, i) =>
        i === index ? { ...item, quantity: qty } : item
      )
    }))
  }

  const updateGold = (type, value) => {
    const numValue = Math.max(0, parseInt(value) || 0)
    setFormData(prev => ({ ...prev, [type]: numValue }))
  }

  // Equipment functions
  const equipItem = (slot, item) => {
    setFormData(prev => ({
      ...prev,
      equipment: { ...prev.equipment, [slot]: item }
    }))
  }

  const unequipItem = (slot) => {
    setFormData(prev => {
      const newEquipment = { ...prev.equipment }
      delete newEquipment[slot]
      return { ...prev, equipment: newEquipment }
    })
  }

  // Calculate AC based on equipped armor
  const calculateAC = () => {
    const dexMod = Math.floor((formData.abilityScores.dex - 10) / 2)
    let ac = 10 + dexMod // Base AC (no armor)

    const equippedArmor = formData.equipment.armor
    if (equippedArmor) {
      const armorData = ALL_ARMOR.find(a => a.name === equippedArmor.name)
      if (armorData) {
        if (armorData.armorType === 'heavy') {
          ac = armorData.baseAC
        } else if (armorData.armorType === 'medium') {
          const cappedDex = Math.min(dexMod, armorData.maxDexBonus || 2)
          ac = armorData.baseAC + cappedDex
        } else {
          // Light armor
          ac = armorData.baseAC + dexMod
        }
      }
      // Add quality bonus
      if (equippedArmor.quality && QUALITY_RANKS[equippedArmor.quality]?.armorBonus) {
        ac += QUALITY_RANKS[equippedArmor.quality].armorBonus
      }
    }

    // Add shield bonus
    const equippedShield = formData.equipment.offHand
    if (equippedShield) {
      const shieldData = ALL_SHIELDS.find(s => s.name === equippedShield.name)
      if (shieldData?.acBonus) {
        ac += shieldData.acBonus
      }
    }

    return ac
  }

  // Get weapon attack bonus
  const getAttackBonus = (weapon) => {
    if (!weapon) return null
    const weaponData = ALL_WEAPONS.find(w => w.name === weapon.name)
    if (!weaponData) return null

    const strMod = Math.floor((formData.abilityScores.str - 10) / 2)
    const dexMod = Math.floor((formData.abilityScores.dex - 10) / 2)

    // Finesse weapons can use STR or DEX
    const isFinesse = weaponData.properties?.includes('finesse')
    const isRanged = weaponData.rangeType === 'ranged'

    let abilityMod
    if (isFinesse) {
      abilityMod = Math.max(strMod, dexMod)
    } else if (isRanged) {
      abilityMod = dexMod
    } else {
      abilityMod = strMod
    }

    // Proficiency bonus (assume proficient for now)
    const profBonus = companion.companion_level
      ? Math.ceil(companion.companion_level / 4) + 1
      : 2

    // Quality bonus
    let qualityBonus = 0
    if (weapon.quality && QUALITY_RANKS[weapon.quality]?.weaponBonus) {
      qualityBonus = QUALITY_RANKS[weapon.quality].weaponBonus
    }

    return abilityMod + profBonus + qualityBonus
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)

    try {
      // Update the NPC record (appearance, personality, background)
      const npcResponse = await fetch(`/api/npc/${companion.npc_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formData.nickname || null,
          height: formData.height || null,
          build: formData.build || null,
          hair_color: formData.hairColor || null,
          hair_style: formData.hairStyle || null,
          eye_color: formData.eyeColor || null,
          skin_tone: formData.skinTone || null,
          distinguishing_marks: formData.distinguishingMarks || null,
          personality_trait_1: formData.personalityTrait1 || null,
          personality_trait_2: formData.personalityTrait2 || null,
          voice: formData.voice || null,
          mannerism: formData.mannerism || null,
          motivation: formData.motivation || null,
          background_notes: formData.backstory || null,
          relationship_to_party: formData.relationshipToParty || null
        })
      })

      if (!npcResponse.ok) {
        const data = await npcResponse.json()
        throw new Error(data.error || 'Failed to update companion details')
      }

      // Update companion record (ability scores, inventory, gold, equipment)
      const companionUpdateData = {
        inventory: JSON.stringify(formData.inventory),
        gold_gp: formData.goldGp,
        gold_sp: formData.goldSp,
        gold_cp: formData.goldCp,
        equipment: JSON.stringify(formData.equipment)
      }

      // Add ability scores and subclass if class-based
      if (isClassBased) {
        companionUpdateData.companion_ability_scores = JSON.stringify(formData.abilityScores)
        if (formData.subclass) {
          companionUpdateData.companion_subclass = formData.subclass
        }
      }

      const companionResponse = await fetch(`/api/companion/${companion.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(companionUpdateData)
      })

      if (!companionResponse.ok) {
        const data = await companionResponse.json()
        throw new Error(data.error || 'Failed to update companion')
      }

      onSave()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const tabs = [
    { id: 'personality', label: 'Personality' },
    { id: 'appearance', label: 'Appearance' },
    { id: 'background', label: 'Background' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'inventory', label: 'Inventory' },
    ...(isClassBased ? [{ id: 'abilities', label: 'Abilities' }] : [])
  ]

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', maxHeight: '85vh', overflowY: 'auto' }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1rem'
        }}>
          <h2 style={{ color: '#9b59b6', margin: 0 }}>
            Edit {companion.nickname || companion.name}
          </h2>
        </div>

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            borderRadius: '8px',
            padding: '0.75rem',
            marginBottom: '1rem',
            color: '#e74c3c'
          }}>
            {error}
          </div>
        )}

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid #444',
          paddingBottom: '0.5rem'
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '0.5rem 1rem',
                background: activeTab === tab.id ? '#9b59b6' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: activeTab === tab.id ? '#fff' : '#888',
                cursor: 'pointer',
                fontSize: '0.9rem',
                transition: 'all 0.2s'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Personality Tab */}
        {activeTab === 'personality' && (
          <div className="editor-tab">
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Nickname
              </label>
              <input
                type="text"
                value={formData.nickname}
                onChange={(e) => updateField('nickname', e.target.value)}
                placeholder="Optional nickname..."
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Personality Trait
              </label>
              <textarea
                value={formData.personalityTrait1}
                onChange={(e) => updateField('personalityTrait1', e.target.value)}
                placeholder="A defining personality trait..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Second Personality Trait
              </label>
              <textarea
                value={formData.personalityTrait2}
                onChange={(e) => updateField('personalityTrait2', e.target.value)}
                placeholder="Another defining trait..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Voice/Speech
                </label>
                <select
                  value={VOICE_OPTIONS.includes(formData.voice) ? formData.voice : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      updateField('voice', '')
                    } else {
                      updateField('voice', e.target.value)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    marginBottom: (!VOICE_OPTIONS.includes(formData.voice) && formData.voice) ? '0.5rem' : 0
                  }}
                >
                  <option value="">Select voice...</option>
                  {VOICE_OPTIONS.map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                  <option value="__custom__">Custom...</option>
                </select>
                {(!VOICE_OPTIONS.includes(formData.voice) || formData.voice === '') && (
                  <input
                    type="text"
                    value={formData.voice}
                    onChange={(e) => updateField('voice', e.target.value)}
                    placeholder="e.g. Gruff, Melodic..."
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      marginTop: '0.5rem'
                    }}
                  />
                )}
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Mannerism
                </label>
                <select
                  value={npcPersonalities.mannerisms.includes(formData.mannerism) ? formData.mannerism : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      updateField('mannerism', '')
                    } else {
                      updateField('mannerism', e.target.value)
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select mannerism...</option>
                  {npcPersonalities.mannerisms.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="__custom__">Custom...</option>
                </select>
                {(!npcPersonalities.mannerisms.includes(formData.mannerism) && formData.mannerism !== '') && (
                  <input
                    type="text"
                    value={formData.mannerism}
                    onChange={(e) => updateField('mannerism', e.target.value)}
                    placeholder="Custom mannerism..."
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff',
                      marginTop: '0.5rem'
                    }}
                  />
                )}
              </div>
            </div>

            <div>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Motivation
              </label>
              <select
                value={npcPersonalities.motivations.find(m => m.motivation === formData.motivation) ? formData.motivation : '__custom__'}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    updateField('motivation', '')
                  } else {
                    updateField('motivation', e.target.value)
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              >
                <option value="">Select motivation...</option>
                {npcPersonalities.motivations.map(m => (
                  <option key={m.motivation} value={m.motivation}>{m.motivation} - {m.description}</option>
                ))}
                <option value="__custom__">Custom...</option>
              </select>
              {(!npcPersonalities.motivations.find(m => m.motivation === formData.motivation) && formData.motivation !== '') && (
                <input
                  type="text"
                  value={formData.motivation}
                  onChange={(e) => updateField('motivation', e.target.value)}
                  placeholder="What drives this character?"
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    marginTop: '0.5rem'
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="editor-tab">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Height
                </label>
                <input
                  type="text"
                  value={formData.height}
                  onChange={(e) => updateField('height', e.target.value)}
                  placeholder="e.g. 5'10, Tall..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Build
                </label>
                <select
                  value={formData.build}
                  onChange={(e) => updateField('build', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Slim">Slim</option>
                  <option value="Athletic">Athletic</option>
                  <option value="Average">Average</option>
                  <option value="Muscular">Muscular</option>
                  <option value="Stocky">Stocky</option>
                  <option value="Heavyset">Heavyset</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Hair Color
                </label>
                <input
                  type="text"
                  value={formData.hairColor}
                  onChange={(e) => updateField('hairColor', e.target.value)}
                  placeholder="e.g. Black, Auburn..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Hair Style
                </label>
                <input
                  type="text"
                  value={formData.hairStyle}
                  onChange={(e) => updateField('hairStyle', e.target.value)}
                  placeholder="e.g. Long braids, Short..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Eye Color
                </label>
                <input
                  type="text"
                  value={formData.eyeColor}
                  onChange={(e) => updateField('eyeColor', e.target.value)}
                  placeholder="e.g. Brown, Blue..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Skin Tone
                </label>
                <input
                  type="text"
                  value={formData.skinTone}
                  onChange={(e) => updateField('skinTone', e.target.value)}
                  placeholder="e.g. Tan, Pale..."
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Distinguishing Marks
              </label>
              <textarea
                value={formData.distinguishingMarks}
                onChange={(e) => updateField('distinguishingMarks', e.target.value)}
                placeholder="Scars, tattoos, birthmarks, or other notable features..."
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* Background Tab */}
        {activeTab === 'background' && (
          <div className="editor-tab">
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Relationship to Party
              </label>
              <textarea
                value={formData.relationshipToParty}
                onChange={(e) => updateField('relationshipToParty', e.target.value)}
                placeholder="How did they join? What's their connection to the party?"
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>

            <div>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Backstory
              </label>
              <textarea
                value={formData.backstory}
                onChange={(e) => updateField('backstory', e.target.value)}
                placeholder="Brief history and background..."
                rows={6}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff',
                  resize: 'vertical'
                }}
              />
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="editor-tab">
            {/* Calculated Stats */}
            <div style={{
              background: 'rgba(46, 204, 113, 0.1)',
              border: '1px solid #2ecc71',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem',
              display: 'flex',
              gap: '2rem',
              justifyContent: 'center'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Armor Class</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2ecc71' }}>{calculateAC()}</div>
              </div>
              {formData.equipment.mainHand && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase' }}>Attack Bonus</div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#3498db' }}>
                    +{getAttackBonus(formData.equipment.mainHand)}
                  </div>
                </div>
              )}
            </div>

            {/* Weapon Slots */}
            <div style={{
              background: 'rgba(231, 76, 60, 0.1)',
              border: '1px solid #e74c3c',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#e74c3c', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                ⚔️ Weapons
              </h4>
              <div style={{ display: 'flex', gap: '1rem' }}>
                {/* Main Hand */}
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Main Hand
                  </label>
                  <select
                    value={formData.equipment.mainHand?.name || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const weapon = ALL_WEAPONS.find(w => w.name === e.target.value)
                        equipItem('mainHand', { ...weapon, quality: 'common' })
                      } else {
                        unequipItem('mainHand')
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff'
                    }}
                  >
                    <option value="">-- Empty --</option>
                    <optgroup label="Simple Melee">
                      {equipmentData.simpleWeapons.melee.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage} {w.damageType})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Simple Ranged">
                      {equipmentData.simpleWeapons.ranged.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage} {w.damageType})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Martial Melee">
                      {equipmentData.martialWeapons.melee.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage} {w.damageType})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Martial Ranged">
                      {equipmentData.martialWeapons.ranged.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage} {w.damageType})</option>
                      ))}
                    </optgroup>
                  </select>
                  {formData.equipment.mainHand && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <select
                        value={formData.equipment.mainHand.quality || 'common'}
                        onChange={(e) => equipItem('mainHand', { ...formData.equipment.mainHand, quality: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          background: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#f1c40f',
                          fontSize: '0.8rem'
                        }}
                      >
                        {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                          <option key={key} value={key}>
                            {rank.name} {rank.weaponBonus !== 0 && `(${rank.weaponBonus > 0 ? '+' : ''}${rank.weaponBonus} attack)`}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#bbb' }}>
                        <span style={{ color: '#e74c3c' }}>{formData.equipment.mainHand.damage}</span>
                        {' '}{formData.equipment.mainHand.damageType}
                        {formData.equipment.mainHand.properties?.length > 0 && (
                          <span style={{ color: '#888' }}> • {formData.equipment.mainHand.properties.join(', ')}</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Off Hand */}
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Off Hand
                  </label>
                  <select
                    value={formData.equipment.offHand?.name || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        // Check if it's a shield or weapon
                        const shield = ALL_SHIELDS.find(s => s.name === e.target.value)
                        const weapon = ALL_WEAPONS.find(w => w.name === e.target.value)
                        equipItem('offHand', shield || weapon)
                      } else {
                        unequipItem('offHand')
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#fff'
                    }}
                  >
                    <option value="">-- Empty --</option>
                    <optgroup label="Shields">
                      {ALL_SHIELDS.map(s => (
                        <option key={s.name} value={s.name}>{s.name} (+{s.acBonus} AC)</option>
                      ))}
                    </optgroup>
                    <optgroup label="Light Weapons">
                      {ALL_WEAPONS.filter(w => w.properties?.includes('light')).map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
                      ))}
                    </optgroup>
                  </select>
                  {formData.equipment.offHand && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#bbb' }}>
                      {formData.equipment.offHand.acBonus
                        ? <span style={{ color: '#2ecc71' }}>+{formData.equipment.offHand.acBonus} AC</span>
                        : <span style={{ color: '#e74c3c' }}>{formData.equipment.offHand.damage} {formData.equipment.offHand.damageType}</span>
                      }
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Armor Slot */}
            <div style={{
              background: 'rgba(52, 152, 219, 0.1)',
              border: '1px solid #3498db',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#3498db', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                🛡️ Armor
              </h4>
              <select
                value={formData.equipment.armor?.name || ''}
                onChange={(e) => {
                  if (e.target.value) {
                    const armor = ALL_ARMOR.find(a => a.name === e.target.value)
                    equipItem('armor', { ...armor, quality: 'common' })
                  } else {
                    unequipItem('armor')
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              >
                <option value="">-- No Armor (AC = 10 + DEX) --</option>
                <optgroup label="Light Armor">
                  {equipmentData.armor.light.map(a => (
                    <option key={a.name} value={a.name}>{a.name} (AC {a.baseAC} + DEX)</option>
                  ))}
                </optgroup>
                <optgroup label="Medium Armor">
                  {equipmentData.armor.medium.map(a => (
                    <option key={a.name} value={a.name}>{a.name} (AC {a.baseAC} + DEX max 2)</option>
                  ))}
                </optgroup>
                <optgroup label="Heavy Armor">
                  {equipmentData.armor.heavy.map(a => (
                    <option key={a.name} value={a.name}>
                      {a.name} (AC {a.baseAC}){a.strReq ? ` [STR ${a.strReq}]` : ''}
                    </option>
                  ))}
                </optgroup>
              </select>
              {formData.equipment.armor && (
                <div style={{ marginTop: '0.5rem' }}>
                  <select
                    value={formData.equipment.armor.quality || 'common'}
                    onChange={(e) => equipItem('armor', { ...formData.equipment.armor, quality: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#f1c40f',
                      fontSize: '0.8rem'
                    }}
                  >
                    {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                      <option key={key} value={key}>
                        {rank.name} {rank.armorBonus !== 0 && `(${rank.armorBonus > 0 ? '+' : ''}${rank.armorBonus} AC)`}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: '#bbb' }}>
                    <span style={{ color: '#3498db' }}>Base AC: {formData.equipment.armor.baseAC}</span>
                    {formData.equipment.armor.stealthDisadvantage && (
                      <span style={{ color: '#e74c3c', marginLeft: '0.5rem' }}>• Stealth Disadvantage</span>
                    )}
                    {formData.equipment.armor.strReq && (
                      <span style={{ color: '#f1c40f', marginLeft: '0.5rem' }}>• Requires STR {formData.equipment.armor.strReq}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <p style={{ color: '#666', fontSize: '0.8rem', fontStyle: 'italic', textAlign: 'center' }}>
              Equipment changes are saved when you click "Save Changes"
            </p>
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="editor-tab">
            {/* Gold Section */}
            <div style={{
              background: 'rgba(241, 196, 15, 0.1)',
              border: '1px solid #f1c40f',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#f1c40f', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                💰 Currency
              </h4>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Gold (gp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.goldGp}
                    onChange={(e) => updateGold('goldGp', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#f1c40f',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Silver (sp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.goldSp}
                    onChange={(e) => updateGold('goldSp', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#bdc3c7',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ color: '#888', fontSize: '0.75rem', display: 'block', marginBottom: '0.25rem' }}>
                    Copper (cp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.goldCp}
                    onChange={(e) => updateGold('goldCp', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      background: '#2a2a2a',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      color: '#cd7f32',
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Inventory Items */}
            <div style={{
              background: 'rgba(52, 152, 219, 0.1)',
              border: '1px solid #3498db',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h4 style={{ color: '#3498db', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                🎒 Items
              </h4>

              {/* Add new item */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  placeholder="Item name..."
                  onKeyDown={(e) => e.key === 'Enter' && addInventoryItem()}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                />
                <input
                  type="number"
                  min="1"
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(parseInt(e.target.value) || 1)}
                  style={{
                    width: '60px',
                    padding: '0.5rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff',
                    textAlign: 'center'
                  }}
                />
                <button
                  onClick={addInventoryItem}
                  disabled={!newItemName.trim()}
                  style={{
                    padding: '0.5rem 1rem',
                    background: newItemName.trim() ? '#3498db' : '#444',
                    border: 'none',
                    borderRadius: '4px',
                    color: '#fff',
                    cursor: newItemName.trim() ? 'pointer' : 'not-allowed'
                  }}
                >
                  Add
                </button>
              </div>

              {/* Item list */}
              {formData.inventory.length === 0 ? (
                <p style={{ color: '#666', fontStyle: 'italic', margin: 0, textAlign: 'center' }}>
                  No items in inventory
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {formData.inventory.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px'
                      }}
                    >
                      <span style={{ flex: 1, color: '#ddd' }}>{item.name}</span>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity || 1}
                        onChange={(e) => updateItemQuantity(index, e.target.value)}
                        style={{
                          width: '50px',
                          padding: '0.25rem',
                          background: '#1a1a1a',
                          border: '1px solid #444',
                          borderRadius: '4px',
                          color: '#fff',
                          textAlign: 'center',
                          fontSize: '0.85rem'
                        }}
                      />
                      <button
                        onClick={() => removeInventoryItem(index)}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#e74c3c',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '0.85rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Abilities Tab (class-based only) */}
        {activeTab === 'abilities' && isClassBased && (
          <div className="editor-tab">
            {/* Subclass Selection */}
            {companion.companion_class && (
              <div style={{
                background: 'rgba(155, 89, 182, 0.1)',
                border: '1px solid #9b59b6',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#9b59b6', margin: '0 0 0.75rem 0' }}>
                  {companion.companion_class === 'Cleric' ? 'Divine Domain' :
                   companion.companion_class === 'Warlock' ? 'Otherworldly Patron' :
                   companion.companion_class === 'Sorcerer' ? 'Sorcerous Origin' :
                   companion.companion_class === 'Wizard' ? 'Arcane Tradition' :
                   companion.companion_class === 'Druid' ? 'Druid Circle' :
                   companion.companion_class === 'Fighter' ? 'Martial Archetype' :
                   companion.companion_class === 'Rogue' ? 'Roguish Archetype' :
                   companion.companion_class === 'Barbarian' ? 'Primal Path' :
                   companion.companion_class === 'Bard' ? 'Bard College' :
                   companion.companion_class === 'Monk' ? 'Monastic Tradition' :
                   companion.companion_class === 'Paladin' ? 'Sacred Oath' :
                   companion.companion_class === 'Ranger' ? 'Ranger Conclave' :
                   'Subclass'}
                </h4>
                {(() => {
                  const classKey = companion.companion_class.toLowerCase()
                  const subclassLevel = SUBCLASS_LEVELS[classKey] || 3
                  const subclassOptions = classesData[classKey]?.subclasses || []

                  if (companion.companion_level < subclassLevel) {
                    return (
                      <p style={{ color: '#888', margin: 0, fontSize: '0.9rem' }}>
                        Subclass available at level {subclassLevel}
                      </p>
                    )
                  }

                  return (
                    <>
                      <select
                        value={formData.subclass}
                        onChange={(e) => updateField('subclass', e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem',
                          background: '#2a2a2a',
                          border: '1px solid #9b59b6',
                          borderRadius: '4px',
                          color: '#fff'
                        }}
                      >
                        <option value="">Select a subclass...</option>
                        {subclassOptions.map(sub => (
                          <option key={sub.name} value={sub.name}>{sub.name}</option>
                        ))}
                      </select>
                      {formData.subclass && (
                        <p style={{ color: '#bbb', margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
                          {subclassOptions.find(s => s.name === formData.subclass)?.description}
                        </p>
                      )}
                    </>
                  )
                })()}
              </div>
            )}

            <div style={{
              background: 'rgba(241, 196, 15, 0.1)',
              border: '1px solid #f1c40f',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h4 style={{ color: '#f1c40f', margin: '0 0 1rem 0' }}>
                Ability Scores
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem'
              }}>
                {Object.entries(ABILITY_NAMES).map(([key, name]) => (
                  <div
                    key={key}
                    style={{
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '8px',
                      padding: '0.75rem',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{
                      color: '#888',
                      textTransform: 'uppercase',
                      fontSize: '0.7rem',
                      marginBottom: '0.25rem'
                    }}>
                      {name}
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={formData.abilityScores[key]}
                      onChange={(e) => updateAbilityScore(key, e.target.value)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: '#1a1a1a',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        color: '#fff',
                        textAlign: 'center',
                        fontSize: '1.2rem',
                        fontWeight: 'bold'
                      }}
                    />
                    <div style={{
                      color: '#f1c40f',
                      fontSize: '0.9rem',
                      marginTop: '0.25rem'
                    }}>
                      {getModifier(formData.abilityScores[key])}
                    </div>
                  </div>
                ))}
              </div>
              <p style={{
                color: '#888',
                fontSize: '0.8rem',
                marginTop: '1rem',
                marginBottom: 0,
                fontStyle: 'italic'
              }}>
                Note: Changing ability scores won't automatically recalculate HP.
                Use Level Up to properly gain HP from Constitution increases.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '0.75rem',
          marginTop: '1.5rem',
          paddingTop: '1rem',
          borderTop: '1px solid #444'
        }}>
          <button
            className="button button-secondary"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            Cancel
          </button>
          <button
            className="button"
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, background: '#2ecc71' }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default CompanionEditor
