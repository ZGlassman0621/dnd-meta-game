import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import racesData from '../data/races.json'
import backgroundsData from '../data/backgrounds.json'
import deitiesData from '../data/deities.json'
import equipmentData from '../data/equipment.json'
import spellsData from '../data/spells.json'

function CharacterSheet({ character: initialCharacter, onBack, onCharacterUpdated, onEditInWizard, onLevelUp }) {
  const [character, setCharacter] = useState(initialCharacter)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [canLevelUp, setCanLevelUp] = useState(false)

  // Inventory management state
  const [showAddItem, setShowAddItem] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState('')

  // Spell management state
  const [showCantripSelection, setShowCantripSelection] = useState(false)
  const [selectedCantrip, setSelectedCantrip] = useState(null)

  // Fetch fresh character data on mount to ensure we have all fields
  useEffect(() => {
    const fetchCharacter = async () => {
      try {
        const response = await fetch(`/api/character/${initialCharacter.id}`)
        const data = await response.json()
        setCharacter(data)
      } catch (error) {
        console.error('Error fetching character:', error)
      }
    }
    fetchCharacter()
  }, [initialCharacter.id])

  // Check if character can level up
  useEffect(() => {
    const checkLevelUp = async () => {
      try {
        const response = await fetch(`/api/character/can-level-up/${character.id}`)
        if (response.ok) {
          const data = await response.json()
          setCanLevelUp(data.canLevelUp)
        }
      } catch (error) {
        console.error('Error checking level-up status:', error)
      }
    }
    checkLevelUp()
  }, [character.id, character.experience])

  // Start editing with current character data
  const startEditing = () => {
    setEditData({
      nickname: character.nickname || '',
      alignment: character.alignment || '',
      faith: character.faith || '',
      lifestyle: character.lifestyle || '',
      current_location: character.current_location || '',
      current_quest: character.current_quest || '',
      personality_traits: character.personality_traits || '',
      ideals: character.ideals || '',
      bonds: character.bonds || '',
      flaws: character.flaws || '',
      backstory: character.backstory || '',
      organizations: character.organizations || '',
      allies: character.allies || '',
      enemies: character.enemies || '',
      other_notes: character.other_notes || '',
      hair_color: character.hair_color || '',
      eye_color: character.eye_color || '',
      skin_color: character.skin_color || '',
      height: character.height || '',
      weight: character.weight || '',
      age: character.age || ''
    })
    setIsEditing(true)
  }

  // Save edits to the server
  const saveEdits = async () => {
    setIsSaving(true)
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      })
      const updatedCharacter = await response.json()
      setCharacter(updatedCharacter) // Update local state
      onCharacterUpdated && onCharacterUpdated(updatedCharacter)
      setIsEditing(false)
    } catch (error) {
      console.error('Error saving character:', error)
      alert('Failed to save changes')
    } finally {
      setIsSaving(false)
    }
  }

  const handleEditChange = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }))
  }

  const capitalize = (str) => {
    if (!str) return str
    // Replace underscores with spaces, then capitalize each word
    return str.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  // Parse JSON fields safely
  const parseJson = (field, defaultValue = []) => {
    if (!field) return defaultValue
    if (typeof field !== 'string') return field
    try { return JSON.parse(field) } catch { return defaultValue }
  }

  const abilities = parseJson(character.ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  const skills = parseJson(character.skills, [])
  const inventory = parseJson(character.inventory, [])
  const advantages = parseJson(character.advantages, [])
  const knownCantrips = parseJson(character.known_cantrips, [])
  const preparedSpells = parseJson(character.prepared_spells, [])
  const equipment = parseJson(character.equipment, {})

  // Equipment helper functions
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

  // Calculate AC based on equipped armor
  const calculateEquipmentAC = () => {
    const dexMod = Math.floor((abilities.dex - 10) / 2)
    let ac = 10 + dexMod // Base AC (no armor)

    const equippedArmor = equipment.armor
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
      } else if (equippedArmor.isCustom && equippedArmor.baseAC) {
        // Custom armor
        if (equippedArmor.armorType === 'heavy') {
          ac = equippedArmor.baseAC
        } else if (equippedArmor.armorType === 'medium') {
          const cappedDex = Math.min(dexMod, equippedArmor.maxDexBonus || 2)
          ac = equippedArmor.baseAC + cappedDex
        } else {
          ac = equippedArmor.baseAC + dexMod
        }
      }
      // Add quality bonus
      if (equippedArmor.quality && QUALITY_RANKS[equippedArmor.quality]?.armorBonus) {
        ac += QUALITY_RANKS[equippedArmor.quality].armorBonus
      }
    }

    // Add shield bonus
    const equippedShield = equipment.offHand
    if (equippedShield) {
      const shieldData = ALL_SHIELDS.find(s => s.name === equippedShield.name)
      if (shieldData?.acBonus) {
        ac += shieldData.acBonus
      } else if (equippedShield.acBonus) {
        ac += equippedShield.acBonus
      }
    }

    return ac
  }

  // Get weapon attack bonus
  const getWeaponAttackBonus = (weapon) => {
    if (!weapon) return null
    const weaponData = ALL_WEAPONS.find(w => w.name === weapon.name)

    const strMod = Math.floor((abilities.str - 10) / 2)
    const dexMod = Math.floor((abilities.dex - 10) / 2)

    // Determine which ability to use
    let abilityMod
    if (weaponData) {
      const isFinesse = weaponData.properties?.includes('finesse')
      const isRanged = weaponData.rangeType === 'ranged'
      if (isFinesse) {
        abilityMod = Math.max(strMod, dexMod)
      } else if (isRanged) {
        abilityMod = dexMod
      } else {
        abilityMod = strMod
      }
    } else if (weapon.isCustom) {
      // Custom weapon - check properties
      const isFinesse = weapon.properties?.includes('finesse')
      const isRanged = weapon.rangeType === 'ranged'
      if (isFinesse) {
        abilityMod = Math.max(strMod, dexMod)
      } else if (isRanged) {
        abilityMod = dexMod
      } else {
        abilityMod = strMod
      }
    } else {
      abilityMod = strMod
    }

    // Proficiency bonus
    const profBonus = Math.ceil(character.level / 4) + 1

    // Quality bonus
    let qualityBonus = 0
    if (weapon.quality && QUALITY_RANKS[weapon.quality]?.weaponBonus) {
      qualityBonus = QUALITY_RANKS[weapon.quality].weaponBonus
    }

    return abilityMod + profBonus + qualityBonus
  }

  // Get weapon damage string with quality
  const getWeaponDamage = (weapon) => {
    if (!weapon) return null
    const weaponData = ALL_WEAPONS.find(w => w.name === weapon.name)
    const baseDamage = weaponData?.damage || weapon.damage || '1d4'
    const damageType = weaponData?.damageType || weapon.damageType || 'bludgeoning'

    const strMod = Math.floor((abilities.str - 10) / 2)
    const dexMod = Math.floor((abilities.dex - 10) / 2)

    // Determine which ability to use for damage
    let abilityMod
    if (weaponData) {
      const isFinesse = weaponData.properties?.includes('finesse')
      const isRanged = weaponData.rangeType === 'ranged'
      if (isFinesse) {
        abilityMod = Math.max(strMod, dexMod)
      } else if (isRanged) {
        abilityMod = dexMod
      } else {
        abilityMod = strMod
      }
    } else {
      const isFinesse = weapon.properties?.includes('finesse')
      const isRanged = weapon.rangeType === 'ranged'
      if (isFinesse) {
        abilityMod = Math.max(strMod, dexMod)
      } else if (isRanged) {
        abilityMod = dexMod
      } else {
        abilityMod = strMod
      }
    }

    const modString = abilityMod >= 0 ? `+${abilityMod}` : abilityMod.toString()
    return `${baseDamage}${modString} ${damageType}`
  }

  // Equipment management functions
  const equipItem = async (slot, item) => {
    const newEquipment = { ...equipment, [slot]: item }
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment: JSON.stringify(newEquipment) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
    } catch (err) {
      console.error('Error equipping item:', err)
    }
  }

  const unequipItem = async (slot) => {
    const newEquipment = { ...equipment }
    delete newEquipment[slot]
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipment: JSON.stringify(newEquipment) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
    } catch (err) {
      console.error('Error unequipping item:', err)
    }
  }

  // Custom equipment state
  const [showCustomItemForm, setShowCustomItemForm] = useState(false)
  const [customItemType, setCustomItemType] = useState('weapon')
  const [customItem, setCustomItem] = useState({
    name: '',
    quality: 'common',
    damage: '1d6',
    damageType: 'slashing',
    properties: [],
    rangeType: 'melee',
    baseAC: 11,
    armorType: 'light',
    maxDexBonus: null,
    acBonus: 2,
    magicBonus: 0,
    notes: ''
  })

  // Inventory management functions
  const addItemToInventory = async (itemName, quantity = 1) => {
    if (!itemName.trim()) return

    const existingItem = inventory.find(i => (typeof i === 'string' ? i : i.name).toLowerCase() === itemName.toLowerCase())
    let newInventory

    if (existingItem) {
      // Increase quantity of existing item
      newInventory = inventory.map(i => {
        const name = typeof i === 'string' ? i : i.name
        if (name.toLowerCase() === itemName.toLowerCase()) {
          return { name, quantity: (i.quantity || 1) + quantity, equipped: i.equipped || false }
        }
        return i
      })
    } else {
      // Add new item
      newInventory = [...inventory, { name: itemName.trim(), quantity, equipped: false }]
    }

    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: JSON.stringify(newInventory) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
      setNewItemName('')
      setNewItemQuantity(1)
      setShowAddItem(false)
    } catch (err) {
      console.error('Error adding item:', err)
    }
  }

  const removeItemFromInventory = async (itemName) => {
    const newInventory = inventory.filter(i => (typeof i === 'string' ? i : i.name) !== itemName)

    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: JSON.stringify(newInventory) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
    } catch (err) {
      console.error('Error removing item:', err)
    }
  }

  const updateItemQuantity = async (itemName, delta) => {
    const newInventory = inventory.map(i => {
      const name = typeof i === 'string' ? i : i.name
      if (name === itemName) {
        const currentQty = i.quantity || 1
        const newQty = currentQty + delta
        if (newQty <= 0) {
          return null // Mark for removal
        }
        return { ...i, name, quantity: newQty, equipped: i.equipped || false }
      }
      return i
    }).filter(i => i !== null)

    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inventory: JSON.stringify(newInventory) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
    } catch (err) {
      console.error('Error updating item quantity:', err)
    }
  }

  // Cantrip management functions
  const getAvailableCantrips = () => {
    const classKey = character.class?.toLowerCase()
    return spellsData.cantrips[classKey] || []
  }

  const getMaxCantrips = () => {
    if (!classData?.spellcasting?.cantripsKnown) return 0
    const cantripsKnown = classData.spellcasting.cantripsKnown
    if (typeof cantripsKnown === 'object') {
      // Find the highest level entry that's <= character level
      let max = 0
      for (const [level, count] of Object.entries(cantripsKnown)) {
        if (parseInt(level) <= character.level) {
          max = count
        }
      }
      return max
    }
    return cantripsKnown
  }

  const addCantrip = async (cantripName) => {
    const maxCantrips = getMaxCantrips()
    if (knownCantrips.length >= maxCantrips) {
      alert(`You can only know ${maxCantrips} cantrips at level ${character.level}.`)
      return
    }
    if (knownCantrips.includes(cantripName)) {
      alert('You already know this cantrip.')
      return
    }

    const newCantrips = [...knownCantrips, cantripName]
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ known_cantrips: JSON.stringify(newCantrips) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
      setShowCantripSelection(false)
    } catch (err) {
      console.error('Error adding cantrip:', err)
    }
  }

  const removeCantrip = async (cantripName) => {
    const newCantrips = knownCantrips.filter(c => c !== cantripName)
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ known_cantrips: JSON.stringify(newCantrips) })
      })
      const updated = await response.json()
      setCharacter(updated)
      onCharacterUpdated && onCharacterUpdated(updated)
    } catch (err) {
      console.error('Error removing cantrip:', err)
    }
  }

  // Look up spell details from spells data
  const getSpellDetails = (spellName) => {
    // Search through all spell levels
    for (const level of Object.keys(spellsData.spells || {})) {
      const spells = spellsData.spells[level]
      const spell = spells?.find(s => s.name.toLowerCase() === spellName.toLowerCase())
      if (spell) {
        return { ...spell, level }
      }
    }
    return null
  }

  // Build a list of common equipment items for quick-add
  const getEquipmentOptions = () => {
    const options = {
      'Weapons - Simple Melee': equipmentData.simpleWeapons?.melee?.map(w => w.name) || [],
      'Weapons - Simple Ranged': equipmentData.simpleWeapons?.ranged?.map(w => w.name) || [],
      'Weapons - Martial Melee': equipmentData.martialWeapons?.melee?.map(w => w.name) || [],
      'Weapons - Martial Ranged': equipmentData.martialWeapons?.ranged?.map(w => w.name) || [],
      'Armor - Light': equipmentData.armor?.light?.map(a => a.name) || [],
      'Armor - Medium': equipmentData.armor?.medium?.map(a => a.name) || [],
      'Armor - Heavy': equipmentData.armor?.heavy?.map(a => a.name) || [],
      'Armor - Shields': equipmentData.armor?.shields?.map(a => a.name) || [],
      'Adventuring Gear': [
        'Backpack', 'Bedroll', 'Blanket', 'Candle', 'Crowbar', 'Grappling Hook',
        'Hammer', 'Lantern (hooded)', 'Lantern (bullseye)', 'Mirror', 'Oil (flask)',
        'Pitons (10)', 'Pole (10 ft)', 'Rations (1 day)', 'Rope (50 ft, hempen)',
        'Rope (50 ft, silk)', 'Sack', 'Spellbook', 'Spyglass', 'Tent', 'Tinderbox',
        'Torch', 'Waterskin', 'Holy Symbol', 'Component Pouch', 'Arcane Focus'
      ]
    }
    return options
  }

  // Get class and race data
  const classKey = character.class?.toLowerCase()
  const classData = classesData[classKey]
  const raceKey = character.race?.toLowerCase().replace('-', '_').replace(' ', '_')
  const raceData = racesData[raceKey]
  const backgroundData = backgroundsData[character.background?.toLowerCase()]

  // Get subclass data
  const subclassData = classData?.subclasses?.find(sc => sc.name === character.subclass)

  // Get class features by level
  const getClassFeatures = () => {
    if (!classData?.featuresByLevel) return []
    const features = []
    Object.entries(classData.featuresByLevel)
      .filter(([level]) => parseInt(level) <= character.level)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([level, feats]) => {
        feats.forEach(feat => {
          features.push({ ...feat, level: parseInt(level) })
        })
      })
    return features
  }

  // Get subclass features by level
  const getSubclassFeatures = () => {
    if (!subclassData?.featuresByLevel) return []
    const features = []
    Object.entries(subclassData.featuresByLevel)
      .filter(([level]) => parseInt(level) <= character.level)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .forEach(([level, feats]) => {
        feats.forEach(feat => {
          features.push({ ...feat, level: parseInt(level) })
        })
      })
    return features
  }

  // Get subclass spells
  const getSubclassSpells = () => {
    if (!subclassData) return []
    const spellListKey = subclassData.domainSpells ? 'domainSpells' :
                        subclassData.oathSpells ? 'oathSpells' :
                        subclassData.expandedSpells ? 'expandedSpells' :
                        subclassData.circleSpells ? 'circleSpells' :
                        subclassData.subclassSpells ? 'subclassSpells' :
                        subclassData.originSpells ? 'originSpells' : null
    if (!spellListKey || !subclassData[spellListKey]) return []

    return Object.entries(subclassData[spellListKey])
      .filter(([level]) => parseInt(level) <= character.level)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
  }

  // Get race traits
  const getRaceTraits = () => {
    if (!raceData) return []
    const traits = []

    // Check if character has a subrace and get subrace-specific traits
    let subraceData = null
    if (character.subrace && raceData.subraces) {
      subraceData = raceData.subraces.find(sr => sr.name === character.subrace)
    }

    // Use subrace traits if available, otherwise use race traits (but filter out generic "Choose..." prompts)
    if (subraceData?.traits) {
      traits.push(...subraceData.traits)
    } else if (raceData.traits) {
      // Filter out traits that are just instructions to choose a subrace
      const filteredTraits = raceData.traits.filter(trait =>
        !trait.toLowerCase().includes('choose') || !trait.toLowerCase().includes('human')
      )
      traits.push(...filteredTraits)
    }

    if (raceData.speed) traits.push(`Speed: ${raceData.speed} ft`)
    if (raceData.size) traits.push(`Size: ${raceData.size}`)

    // Use character's actual languages if available, otherwise fall back to race data
    if (character.languages) {
      const charLanguages = typeof character.languages === 'string'
        ? JSON.parse(character.languages)
        : character.languages
      if (Array.isArray(charLanguages) && charLanguages.length > 0) {
        traits.push(`Languages: ${charLanguages.join(', ')}`)
      }
    } else if (raceData.languages) {
      traits.push(`Languages: ${raceData.languages.join(', ')}`)
    }

    return traits
  }

  const classFeatures = getClassFeatures()
  const subclassFeatures = getSubclassFeatures()
  const subclassSpells = getSubclassSpells()
  const raceTraits = getRaceTraits()

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'abilities', label: 'Abilities & Skills' },
    { id: 'features', label: 'Features & Traits' },
    { id: 'spells', label: 'Spells' },
    { id: 'equipment', label: 'Equipment' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'background', label: 'Background' }
  ]

  // Alignment options
  const ALIGNMENTS = [
    { value: 'LG', label: 'Lawful Good' },
    { value: 'NG', label: 'Neutral Good' },
    { value: 'CG', label: 'Chaotic Good' },
    { value: 'LN', label: 'Lawful Neutral' },
    { value: 'N', label: 'True Neutral' },
    { value: 'CN', label: 'Chaotic Neutral' },
    { value: 'LE', label: 'Lawful Evil' },
    { value: 'NE', label: 'Neutral Evil' },
    { value: 'CE', label: 'Chaotic Evil' }
  ]

  const LIFESTYLES = [
    { value: 'wretched', label: 'Wretched' },
    { value: 'squalid', label: 'Squalid' },
    { value: 'poor', label: 'Poor' },
    { value: 'modest', label: 'Modest' },
    { value: 'comfortable', label: 'Comfortable' },
    { value: 'wealthy', label: 'Wealthy' },
    { value: 'aristocratic', label: 'Aristocratic' }
  ]

  // Render edit mode
  if (isEditing) {
    return (
      <div className="character-sheet">
        <div className="sheet-header">
          <button className="button button-secondary" onClick={() => setIsEditing(false)}>
            ← Cancel
          </button>
          <div className="sheet-title">
            <div>
              <h1>Edit {character.nickname || character.name}</h1>
              <p className="subtitle">Modify your character details</p>
            </div>
          </div>
          <button
            className="button"
            onClick={saveEdits}
            disabled={isSaving}
            style={{ background: '#2ecc71' }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        <div className="edit-form" style={{ padding: '1rem', maxHeight: 'calc(100vh - 150px)', overflowY: 'auto' }}>
          {/* Basic Info */}
          <section className="edit-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Basic Info</h3>
            <div className="form-group">
              <label>Nickname</label>
              <input
                type="text"
                value={editData.nickname}
                onChange={(e) => handleEditChange('nickname', e.target.value)}
                placeholder="A shorter name or alias"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Alignment</label>
                <select
                  value={editData.alignment}
                  onChange={(e) => handleEditChange('alignment', e.target.value)}
                >
                  <option value="">Select alignment</option>
                  {ALIGNMENTS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Faith</label>
                <select
                  value={editData.faith}
                  onChange={(e) => handleEditChange('faith', e.target.value)}
                >
                  <option value="">Select deity</option>
                  {Object.keys(deitiesData).map(key => (
                    <option key={key} value={key}>{deitiesData[key].name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Lifestyle</label>
              <select
                value={editData.lifestyle}
                onChange={(e) => handleEditChange('lifestyle', e.target.value)}
              >
                <option value="">Select lifestyle</option>
                {LIFESTYLES.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Current Status */}
          <section className="edit-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Current Status</h3>
            <div className="form-group">
              <label>Current Location</label>
              <input
                type="text"
                value={editData.current_location}
                onChange={(e) => handleEditChange('current_location', e.target.value)}
                placeholder="Where is your character?"
              />
            </div>
            <div className="form-group">
              <label>Current Quest</label>
              <textarea
                value={editData.current_quest}
                onChange={(e) => handleEditChange('current_quest', e.target.value)}
                placeholder="What are you working on?"
                rows="2"
              />
            </div>
          </section>

          {/* Physical Appearance */}
          <section className="edit-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Physical Appearance</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Age</label>
                <input
                  type="text"
                  value={editData.age}
                  onChange={(e) => handleEditChange('age', e.target.value)}
                  placeholder="e.g., 25"
                />
              </div>
              <div className="form-group">
                <label>Height</label>
                <input
                  type="text"
                  value={editData.height}
                  onChange={(e) => handleEditChange('height', e.target.value)}
                  placeholder="e.g., 5'10&quot;"
                />
              </div>
              <div className="form-group">
                <label>Weight</label>
                <input
                  type="text"
                  value={editData.weight}
                  onChange={(e) => handleEditChange('weight', e.target.value)}
                  placeholder="e.g., 170 lbs"
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Hair Color</label>
                <input
                  type="text"
                  value={editData.hair_color}
                  onChange={(e) => handleEditChange('hair_color', e.target.value)}
                  placeholder="e.g., Black"
                />
              </div>
              <div className="form-group">
                <label>Eye Color</label>
                <input
                  type="text"
                  value={editData.eye_color}
                  onChange={(e) => handleEditChange('eye_color', e.target.value)}
                  placeholder="e.g., Blue"
                />
              </div>
              <div className="form-group">
                <label>Skin Color</label>
                <input
                  type="text"
                  value={editData.skin_color}
                  onChange={(e) => handleEditChange('skin_color', e.target.value)}
                  placeholder="e.g., Fair"
                />
              </div>
            </div>
          </section>

          {/* Personality */}
          <section className="edit-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Personality</h3>
            <div className="form-group">
              <label>Personality Traits</label>
              <textarea
                value={editData.personality_traits}
                onChange={(e) => handleEditChange('personality_traits', e.target.value)}
                placeholder="Describe your character's personality..."
                rows="3"
              />
            </div>
            <div className="form-group">
              <label>Ideals</label>
              <textarea
                value={editData.ideals}
                onChange={(e) => handleEditChange('ideals', e.target.value)}
                placeholder="What does your character believe in?"
                rows="2"
              />
            </div>
            <div className="form-group">
              <label>Bonds</label>
              <textarea
                value={editData.bonds}
                onChange={(e) => handleEditChange('bonds', e.target.value)}
                placeholder="What connections does your character have?"
                rows="2"
              />
            </div>
            <div className="form-group">
              <label>Flaws</label>
              <textarea
                value={editData.flaws}
                onChange={(e) => handleEditChange('flaws', e.target.value)}
                placeholder="What are your character's weaknesses?"
                rows="2"
              />
            </div>
          </section>

          {/* Background Story */}
          <section className="edit-section" style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Background & Story</h3>
            <div className="form-group">
              <label>Backstory</label>
              <textarea
                value={editData.backstory}
                onChange={(e) => handleEditChange('backstory', e.target.value)}
                placeholder="Tell your character's story..."
                rows="5"
              />
            </div>
            <div className="form-group">
              <label>Organizations</label>
              <textarea
                value={editData.organizations}
                onChange={(e) => handleEditChange('organizations', e.target.value)}
                placeholder="Guilds, factions, or groups..."
                rows="2"
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label>Allies</label>
                <textarea
                  value={editData.allies}
                  onChange={(e) => handleEditChange('allies', e.target.value)}
                  placeholder="Friends and allies..."
                  rows="2"
                />
              </div>
              <div className="form-group">
                <label>Enemies</label>
                <textarea
                  value={editData.enemies}
                  onChange={(e) => handleEditChange('enemies', e.target.value)}
                  placeholder="Rivals and enemies..."
                  rows="2"
                />
              </div>
            </div>
            <div className="form-group">
              <label>Other Notes</label>
              <textarea
                value={editData.other_notes}
                onChange={(e) => handleEditChange('other_notes', e.target.value)}
                placeholder="Any additional notes..."
                rows="3"
              />
            </div>
          </section>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              className="button button-secondary"
              onClick={() => setIsEditing(false)}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              className="button"
              onClick={saveEdits}
              disabled={isSaving}
              style={{ flex: 1, background: '#2ecc71' }}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="character-sheet">
      <div className="sheet-header">
        <button className="button button-secondary" onClick={onBack}>
          ← Back to Characters
        </button>
        <div className="sheet-title">
          {character.avatar && (
            <img
              src={character.avatar}
              alt={character.name}
              className="sheet-avatar"
            />
          )}
          <div>
            <h1>{character.name}</h1>
            {character.nickname && <p className="nickname">"{character.nickname}"</p>}
            <p className="subtitle">
              Level {character.level} {capitalize(character.race)}{' '}
              {character.class_levels ? (
                // Multiclass display
                JSON.parse(character.class_levels).map((c, i) => (
                  <span key={c.class}>
                    {i > 0 && ' / '}
                    {capitalize(c.class)} {c.level}
                    {c.subclass && ` (${c.subclass})`}
                  </span>
                ))
              ) : (
                // Single class display
                <>
                  {capitalize(character.class)}
                  {character.subclass && ` (${character.subclass})`}
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {canLevelUp && onLevelUp && (
            <button
              className="button level-up-button"
              onClick={onLevelUp}
              title="Level up your character!"
            >
              Level Up!
            </button>
          )}
          <button
            className="button"
            onClick={startEditing}
            style={{ background: '#9b59b6' }}
            title="Edit flavor details like personality, backstory, appearance"
          >
            Edit Details
          </button>
          {onEditInWizard && (
            <button
              className="button"
              onClick={() => onEditInWizard(character)}
              style={{ background: '#e67e22' }}
              title="Rebuild character in wizard (preserves XP, level, gold, inventory)"
            >
              Rebuild
            </button>
          )}
        </div>
      </div>

      {/* Level Up Banner */}
      {canLevelUp && onLevelUp && (
        <div className="level-up-banner-sheet">
          <div className="level-up-banner-content">
            <span className="level-up-message">
              {character.nickname || character.name} has enough XP to reach Level {character.level + 1}!
            </span>
            <button
              className="button level-up-button"
              onClick={onLevelUp}
            >
              Level Up Now →
            </button>
          </div>
        </div>
      )}

      <div className="sheet-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="sheet-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-panel">
            <div className="overview-grid">
              {/* Vital Stats */}
              <section className="sheet-section vital-stats">
                <h3>Vital Statistics</h3>
                <div className="vital-grid">
                  <div className="vital-stat hp">
                    <div className="vital-label">Hit Points</div>
                    <div className="vital-value">
                      <span className={character.current_hp <= character.max_hp * 0.3 ? 'danger' : ''}>
                        {character.current_hp}
                      </span>
                      <span className="separator">/</span>
                      <span>{character.max_hp}</span>
                    </div>
                    <div className="vital-bar">
                      <div
                        className="vital-bar-fill hp-bar"
                        style={{ width: `${(character.current_hp / character.max_hp) * 100}%` }}
                      />
                    </div>
                  </div>
                  <div className="vital-stat">
                    <div className="vital-label">Armor Class</div>
                    <div className="vital-value large">{character.armor_class}</div>
                  </div>
                  <div className="vital-stat">
                    <div className="vital-label">Speed</div>
                    <div className="vital-value large">{character.speed} ft</div>
                  </div>
                  <div className="vital-stat">
                    <div className="vital-label">Proficiency</div>
                    <div className="vital-value large">+{Math.ceil(character.level / 4) + 1}</div>
                  </div>
                </div>
              </section>

              {/* Experience */}
              <section className="sheet-section experience">
                <h3>Experience</h3>
                <div className="xp-display">
                  <div className="xp-numbers">
                    <span className="current">{character.experience}</span>
                    <span className="separator">/</span>
                    <span className="target">{character.experience_to_next_level}</span>
                  </div>
                  <div className="xp-bar">
                    <div
                      className="xp-bar-fill"
                      style={{ width: `${(character.experience / character.experience_to_next_level) * 100}%` }}
                    />
                  </div>
                  <div className="xp-percent">
                    {Math.floor((character.experience / character.experience_to_next_level) * 100)}% to Level {character.level + 1}
                  </div>
                </div>
              </section>

              {/* Ability Scores Quick View */}
              <section className="sheet-section abilities-quick">
                <h3>Ability Scores</h3>
                <div className="ability-grid-quick">
                  {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
                    <div key={ability} className="ability-quick">
                      <div className="ability-name">{ability.toUpperCase()}</div>
                      <div className="ability-score">{abilities[ability]}</div>
                      <div className="ability-mod">{getModifier(abilities[ability])}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Wealth */}
              <section className="sheet-section wealth">
                <h3>Wealth</h3>
                <div className="currency-grid">
                  <div className="currency gp">
                    <div className="currency-value">{character.gold_gp || 0}</div>
                    <div className="currency-label">GP</div>
                  </div>
                  <div className="currency sp">
                    <div className="currency-value">{character.gold_sp || 0}</div>
                    <div className="currency-label">SP</div>
                  </div>
                  <div className="currency cp">
                    <div className="currency-value">{character.gold_cp || 0}</div>
                    <div className="currency-label">CP</div>
                  </div>
                </div>
              </section>

              {/* Character Details */}
              <section className="sheet-section details">
                <h3>Character Details</h3>
                <div className="details-grid">
                  {character.background && (
                    <div className="detail-item">
                      <span className="detail-label">Background</span>
                      <span className="detail-value">{capitalize(character.background)}</span>
                    </div>
                  )}
                  {character.alignment && (
                    <div className="detail-item">
                      <span className="detail-label">Alignment</span>
                      <span className="detail-value">
                        {ALIGNMENTS.find(a => a.value === character.alignment)?.label || character.alignment}
                      </span>
                    </div>
                  )}
                  {character.faith && (
                    <div className="detail-item">
                      <span className="detail-label">Faith</span>
                      <span className="detail-value">
                        {deitiesData[character.faith]?.name || capitalize(character.faith)}
                      </span>
                    </div>
                  )}
                  {character.lifestyle && (
                    <div className="detail-item">
                      <span className="detail-label">Lifestyle</span>
                      <span className="detail-value">{capitalize(character.lifestyle)}</span>
                    </div>
                  )}
                  {character.gender && (
                    <div className="detail-item">
                      <span className="detail-label">Gender</span>
                      <span className="detail-value">{capitalize(character.gender)}</span>
                    </div>
                  )}
                  {character.age && (
                    <div className="detail-item">
                      <span className="detail-label">Age</span>
                      <span className="detail-value">{character.age}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Current Status */}
              <section className="sheet-section status">
                <h3>Current Status</h3>
                <div className="status-info">
                  <div className="status-item">
                    <span className="status-label">Location</span>
                    <span className="status-value">{character.current_location || 'Unknown'}</span>
                  </div>
                  {character.current_quest && (
                    <div className="status-item">
                      <span className="status-label">Current Quest</span>
                      <span className="status-value">{character.current_quest}</span>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* Abilities & Skills Tab */}
        {activeTab === 'abilities' && (
          <div className="tab-panel">
            <div className="abilities-panel">
              {/* Full Ability Scores */}
              <section className="sheet-section">
                <h3>Ability Scores</h3>
                <div className="ability-grid-full">
                  {[
                    { key: 'str', name: 'Strength', skills: ['Athletics'] },
                    { key: 'dex', name: 'Dexterity', skills: ['Acrobatics', 'Sleight of Hand', 'Stealth'] },
                    { key: 'con', name: 'Constitution', skills: [] },
                    { key: 'int', name: 'Intelligence', skills: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'] },
                    { key: 'wis', name: 'Wisdom', skills: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'] },
                    { key: 'cha', name: 'Charisma', skills: ['Deception', 'Intimidation', 'Performance', 'Persuasion'] }
                  ].map(ability => (
                    <div key={ability.key} className="ability-full">
                      <div className="ability-header">
                        <div className="ability-name-full">{ability.name}</div>
                        <div className="ability-score-large">{abilities[ability.key]}</div>
                        <div className="ability-mod-large">{getModifier(abilities[ability.key])}</div>
                      </div>
                      {ability.skills.length > 0 && (
                        <div className="ability-skills">
                          {ability.skills.map(skill => {
                            const isProficient = skills.includes(skill)
                            const mod = Math.floor((abilities[ability.key] - 10) / 2)
                            const profBonus = Math.ceil(character.level / 4) + 1
                            const totalMod = isProficient ? mod + profBonus : mod
                            return (
                              <div key={skill} className={`skill-item ${isProficient ? 'proficient' : ''}`}>
                                <span className="skill-prof">{isProficient ? '●' : '○'}</span>
                                <span className="skill-name">{skill}</span>
                                <span className="skill-mod">{totalMod >= 0 ? `+${totalMod}` : totalMod}</span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>

              {/* Saving Throws */}
              <section className="sheet-section">
                <h3>Saving Throws</h3>
                <div className="saving-throws-grid">
                  {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
                    const isProficient = classData?.savingThrows?.includes(ability.toUpperCase())
                    const mod = Math.floor((abilities[ability] - 10) / 2)
                    const profBonus = Math.ceil(character.level / 4) + 1
                    const totalMod = isProficient ? mod + profBonus : mod
                    return (
                      <div key={ability} className={`save-item ${isProficient ? 'proficient' : ''}`}>
                        <span className="save-prof">{isProficient ? '●' : '○'}</span>
                        <span className="save-name">{ability.toUpperCase()}</span>
                        <span className="save-mod">{totalMod >= 0 ? `+${totalMod}` : totalMod}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Proficiencies */}
              {classData && (
                <section className="sheet-section">
                  <h3>Proficiencies</h3>
                  <div className="proficiencies-list">
                    {classData.armorProficiencies?.length > 0 && (
                      <div className="prof-group">
                        <span className="prof-label">Armor:</span>
                        <span className="prof-value">{classData.armorProficiencies.map(p => capitalize(p)).join(', ')}</span>
                      </div>
                    )}
                    {classData.weaponProficiencies?.length > 0 && (
                      <div className="prof-group">
                        <span className="prof-label">Weapons:</span>
                        <span className="prof-value">{classData.weaponProficiencies.map(p => capitalize(p)).join(', ')}</span>
                      </div>
                    )}
                    {classData.toolProficiencies?.length > 0 && (
                      <div className="prof-group">
                        <span className="prof-label">Tools:</span>
                        <span className="prof-value">{classData.toolProficiencies.map(p => capitalize(p)).join(', ')}</span>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Advantages */}
              {advantages.length > 0 && (
                <section className="sheet-section">
                  <h3>Advantages & Resistances</h3>
                  <ul className="advantages-list">
                    {advantages.map((adv, idx) => (
                      <li key={idx}>{adv}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </div>
        )}

        {/* Features & Traits Tab */}
        {activeTab === 'features' && (
          <div className="tab-panel">
            {/* Race Traits */}
            {raceTraits.length > 0 && (
              <section className="sheet-section">
                <h3>{character.subrace ? character.subrace : capitalize(character.race)} Traits</h3>
                <ul className="traits-list">
                  {raceTraits.map((trait, idx) => (
                    <li key={idx}>{trait}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Class Features */}
            {classFeatures.length > 0 && (
              <section className="sheet-section">
                <h3>{capitalize(character.class)} Features</h3>
                <div className="features-list">
                  {classFeatures.map((feature, idx) => (
                    <div key={idx} className="feature-item">
                      <div className="feature-header">
                        <span className="feature-name">{feature.name}</span>
                        <span className="feature-level">Level {feature.level}</span>
                      </div>
                      {feature.description && (
                        <p className="feature-description">{feature.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Subclass Features */}
            {character.subclass && subclassFeatures.length > 0 && (
              <section className="sheet-section subclass-section">
                <h3>{character.subclass} Features</h3>
                {subclassData.bonusProficiencies?.length > 0 && (
                  <div className="bonus-profs">
                    <strong>Bonus Proficiencies:</strong> {subclassData.bonusProficiencies.join(', ')}
                  </div>
                )}
                <div className="features-list">
                  {subclassFeatures.map((feature, idx) => (
                    <div key={idx} className="feature-item">
                      <div className="feature-header">
                        <span className="feature-name">{feature.name}</span>
                        <span className="feature-level">Level {feature.level}</span>
                      </div>
                      {feature.description && (
                        <p className="feature-description">{feature.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Background Feature */}
            {backgroundData?.feature && (
              <section className="sheet-section">
                <h3>Background: {capitalize(character.background)}</h3>
                <div className="feature-item">
                  <div className="feature-header">
                    <span className="feature-name">{backgroundData.feature.name}</span>
                  </div>
                  <p className="feature-description">{backgroundData.feature.description}</p>
                </div>
              </section>
            )}
          </div>
        )}

        {/* Spells Tab */}
        {activeTab === 'spells' && (
          <div className="tab-panel">
            {classData?.spellcasting ? (
              <>
                <section className="sheet-section">
                  <h3>Spellcasting</h3>
                  <div className="spellcasting-info">
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spellcasting Ability</span>
                      <span className="spell-stat-value">{classData.spellcasting.ability?.toUpperCase()}</span>
                    </div>
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spell Save DC</span>
                      <span className="spell-stat-value">
                        {8 + Math.ceil(character.level / 4) + 1 + Math.floor((abilities[classData.spellcasting.ability?.toLowerCase().slice(0, 3)] - 10) / 2)}
                      </span>
                    </div>
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spell Attack Bonus</span>
                      <span className="spell-stat-value">
                        +{Math.ceil(character.level / 4) + 1 + Math.floor((abilities[classData.spellcasting.ability?.toLowerCase().slice(0, 3)] - 10) / 2)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Subclass Spells */}
                {subclassSpells.length > 0 && (
                  <section className="sheet-section">
                    <h3>{character.subclass} Spells</h3>
                    <p className="spell-note">These spells are always prepared and don't count against your prepared spell limit.</p>
                    <div className="spell-list-detailed">
                      {subclassSpells.map(([level, spells]) => (
                        <div key={level} className="spell-level-group-detailed">
                          <div className="spell-level-header-detailed">Gained at Level {level}</div>
                          <div className="spells-at-level">
                            {spells.map((spellName, idx) => {
                              const spellDetails = getSpellDetails(spellName)
                              return (
                                <div key={idx} className="spell-item">
                                  <div className="spell-header">
                                    <span className="spell-name-detailed">{spellName}</span>
                                    {spellDetails && (
                                      <>
                                        <span className="spell-school">{spellDetails.school}</span>
                                        <span className="spell-level-badge">{spellDetails.level}</span>
                                      </>
                                    )}
                                  </div>
                                  {spellDetails ? (
                                    <div className="spell-details">
                                      <div className="spell-meta-row">
                                        <span className="spell-meta-item"><strong>Casting Time:</strong> {spellDetails.castingTime}</span>
                                        <span className="spell-meta-item"><strong>Range:</strong> {spellDetails.range}</span>
                                      </div>
                                      <div className="spell-meta-row">
                                        <span className="spell-meta-item"><strong>Duration:</strong> {spellDetails.duration}</span>
                                        <span className="spell-meta-item"><strong>Components:</strong> {spellDetails.components}</span>
                                      </div>
                                      {spellDetails.damage && (
                                        <div className="spell-damage">
                                          <strong>Damage:</strong> {spellDetails.damage}
                                        </div>
                                      )}
                                      {spellDetails.healing && (
                                        <div className="spell-healing">
                                          <strong>Healing:</strong> {spellDetails.healing}
                                        </div>
                                      )}
                                      <p className="spell-description">{spellDetails.description}</p>
                                    </div>
                                  ) : (
                                    <p className="spell-no-details">Spell details not available in database.</p>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Cantrips - if class has them */}
                {classData.spellcasting.cantripsKnown && (
                  <section className="sheet-section">
                    <h3>Cantrips ({knownCantrips.length}/{getMaxCantrips()})</h3>

                    {/* Known Cantrips */}
                    {knownCantrips.length > 0 ? (
                      <div className="cantrip-list">
                        {knownCantrips.map(cantripName => {
                          const cantrip = getAvailableCantrips().find(c => c.name === cantripName)
                          return (
                            <div key={cantripName} className="cantrip-item">
                              <div className="cantrip-header">
                                <span className="cantrip-name">{cantripName}</span>
                                {cantrip && <span className="cantrip-school">{cantrip.school}</span>}
                                <button
                                  className="remove-cantrip-btn"
                                  onClick={() => {
                                    if (confirm(`Remove ${cantripName}?`)) {
                                      removeCantrip(cantripName)
                                    }
                                  }}
                                  title="Remove cantrip"
                                >
                                  ×
                                </button>
                              </div>
                              {cantrip && (
                                <div className="cantrip-details">
                                  <span className="cantrip-meta">{cantrip.castingTime} • {cantrip.range} • {cantrip.duration}</span>
                                  <p className="cantrip-description">{cantrip.description}</p>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="no-cantrips">No cantrips selected yet.</p>
                    )}

                    {/* Add Cantrip Button */}
                    {knownCantrips.length < getMaxCantrips() && !showCantripSelection && (
                      <button
                        onClick={() => setShowCantripSelection(true)}
                        className="add-cantrip-btn"
                      >
                        + Add Cantrip ({getMaxCantrips() - knownCantrips.length} remaining)
                      </button>
                    )}

                    {/* Cantrip Selection Modal */}
                    {showCantripSelection && (
                      <div className="cantrip-selection">
                        <div className="cantrip-selection-header">
                          <h4>Select a Cantrip</h4>
                          <button
                            onClick={() => {
                              setShowCantripSelection(false)
                              setSelectedCantrip(null)
                            }}
                            className="close-selection-btn"
                          >
                            ×
                          </button>
                        </div>
                        <div className="available-cantrips">
                          {getAvailableCantrips()
                            .filter(c => !knownCantrips.includes(c.name))
                            .map(cantrip => (
                              <div
                                key={cantrip.name}
                                className={`available-cantrip ${selectedCantrip?.name === cantrip.name ? 'selected' : ''}`}
                                onClick={() => setSelectedCantrip(cantrip)}
                              >
                                <div className="available-cantrip-header">
                                  <span className="cantrip-name">{cantrip.name}</span>
                                  <span className="cantrip-school">{cantrip.school}</span>
                                </div>
                                <div className="cantrip-meta">{cantrip.castingTime} • {cantrip.range}</div>
                              </div>
                            ))}
                        </div>

                        {/* Selected Cantrip Preview */}
                        {selectedCantrip && (
                          <div className="selected-cantrip-preview">
                            <h5>{selectedCantrip.name}</h5>
                            <div className="cantrip-meta">
                              {selectedCantrip.school} • {selectedCantrip.castingTime} • {selectedCantrip.range} • {selectedCantrip.duration}
                            </div>
                            <p className="cantrip-description">{selectedCantrip.description}</p>
                            <button
                              onClick={() => addCantrip(selectedCantrip.name)}
                              className="button"
                            >
                              Learn {selectedCantrip.name}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </>
            ) : (
              <section className="sheet-section">
                <h3>Spellcasting</h3>
                <p className="no-spells">{capitalize(character.class)} is not a spellcasting class.</p>
              </section>
            )}
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="tab-panel">
            {/* Calculated Stats Summary */}
            <section className="sheet-section" style={{ marginBottom: '1.5rem' }}>
              <div style={{
                display: 'flex',
                gap: '2rem',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  background: 'rgba(46, 204, 113, 0.15)',
                  border: '2px solid #2ecc71',
                  borderRadius: '12px',
                  padding: '1rem 2rem',
                  textAlign: 'center'
                }}>
                  <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Armor Class</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#2ecc71' }}>{calculateEquipmentAC()}</div>
                  {equipment.armor && (
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>
                      {equipment.armor.quality && equipment.armor.quality !== 'common' && (
                        <span style={{ color: QUALITY_RANKS[equipment.armor.quality]?.armorBonus > 0 ? '#f1c40f' : '#888' }}>
                          {capitalize(equipment.armor.quality)}{' '}
                        </span>
                      )}
                      {equipment.armor.name}
                    </div>
                  )}
                </div>

                {equipment.mainHand && (
                  <div style={{
                    background: 'rgba(231, 76, 60, 0.15)',
                    border: '2px solid #e74c3c',
                    borderRadius: '12px',
                    padding: '1rem 2rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Attack Bonus</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#e74c3c' }}>+{getWeaponAttackBonus(equipment.mainHand)}</div>
                    <div style={{ color: '#aaa', fontSize: '0.8rem' }}>
                      {equipment.mainHand.quality && equipment.mainHand.quality !== 'common' && (
                        <span style={{ color: QUALITY_RANKS[equipment.mainHand.quality]?.weaponBonus > 0 ? '#f1c40f' : '#888' }}>
                          {capitalize(equipment.mainHand.quality)}{' '}
                        </span>
                      )}
                      {equipment.mainHand.name}
                    </div>
                  </div>
                )}

                {equipment.mainHand && (
                  <div style={{
                    background: 'rgba(52, 152, 219, 0.15)',
                    border: '2px solid #3498db',
                    borderRadius: '12px',
                    padding: '1rem 2rem',
                    textAlign: 'center'
                  }}>
                    <div style={{ color: '#888', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Damage</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3498db' }}>{getWeaponDamage(equipment.mainHand)}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Weapon Slots */}
            <section className="sheet-section" style={{
              background: 'rgba(231, 76, 60, 0.1)',
              border: '1px solid #e74c3c',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#e74c3c', margin: '0 0 1rem 0' }}>Weapons</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                {/* Main Hand */}
                <div>
                  <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                    Main Hand
                  </label>
                  <select
                    value={equipment.mainHand?.name || ''}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomItemType('weapon')
                        setShowCustomItemForm(true)
                      } else if (e.target.value) {
                        const weapon = ALL_WEAPONS.find(w => w.name === e.target.value)
                        equipItem('mainHand', { ...weapon, quality: 'common' })
                      } else {
                        unequipItem('mainHand')
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
                    <option value="">-- Empty --</option>
                    <optgroup label="Simple Melee">
                      {equipmentData.simpleWeapons.melee.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Simple Ranged">
                      {equipmentData.simpleWeapons.ranged.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Martial Melee">
                      {equipmentData.martialWeapons.melee.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Martial Ranged">
                      {equipmentData.martialWeapons.ranged.map(w => (
                        <option key={w.name} value={w.name}>{w.name} ({w.damage})</option>
                      ))}
                    </optgroup>
                    <optgroup label="Special">
                      <option value="__custom__">+ Add Custom/Magic Weapon...</option>
                    </optgroup>
                  </select>
                  {equipment.mainHand && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <select
                        value={equipment.mainHand.quality || 'common'}
                        onChange={(e) => equipItem('mainHand', { ...equipment.mainHand, quality: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          background: '#1a1a1a',
                          border: '1px solid #333',
                          borderRadius: '4px',
                          color: '#f1c40f',
                          fontSize: '0.85rem'
                        }}
                      >
                        {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                          <option key={key} value={key}>
                            {rank.name} {rank.weaponBonus !== 0 && `(${rank.weaponBonus > 0 ? '+' : ''}${rank.weaponBonus} attack)`}
                          </option>
                        ))}
                      </select>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#bbb' }}>
                        <span style={{ color: '#e74c3c' }}>{getWeaponDamage(equipment.mainHand)}</span>
                        {(ALL_WEAPONS.find(w => w.name === equipment.mainHand.name)?.properties || equipment.mainHand.properties)?.length > 0 && (
                          <div style={{ color: '#888', marginTop: '0.25rem' }}>
                            {(ALL_WEAPONS.find(w => w.name === equipment.mainHand.name)?.properties || equipment.mainHand.properties).join(', ')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Off Hand */}
                <div>
                  <label style={{ color: '#888', fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                    Off Hand
                  </label>
                  <select
                    value={equipment.offHand?.name || ''}
                    onChange={(e) => {
                      if (e.target.value) {
                        const shield = ALL_SHIELDS.find(s => s.name === e.target.value)
                        const weapon = ALL_WEAPONS.find(w => w.name === e.target.value)
                        equipItem('offHand', shield || { ...weapon, quality: 'common' })
                      } else {
                        unequipItem('offHand')
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
                  {equipment.offHand && (
                    <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#bbb' }}>
                      {equipment.offHand.acBonus
                        ? <span style={{ color: '#2ecc71' }}>+{equipment.offHand.acBonus} AC</span>
                        : <span style={{ color: '#e74c3c' }}>{getWeaponDamage(equipment.offHand)}</span>
                      }
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Armor Slot */}
            <section className="sheet-section" style={{
              background: 'rgba(52, 152, 219, 0.1)',
              border: '1px solid #3498db',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#3498db', margin: '0 0 1rem 0' }}>Armor</h3>
              <select
                value={equipment.armor?.name || ''}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setCustomItemType('armor')
                    setShowCustomItemForm(true)
                  } else if (e.target.value) {
                    const armor = ALL_ARMOR.find(a => a.name === e.target.value)
                    equipItem('armor', { ...armor, quality: 'common' })
                  } else {
                    unequipItem('armor')
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
                <optgroup label="Special">
                  <option value="__custom__">+ Add Custom/Magic Armor...</option>
                </optgroup>
              </select>
              {equipment.armor && (
                <div style={{ marginTop: '0.75rem' }}>
                  <select
                    value={equipment.armor.quality || 'common'}
                    onChange={(e) => equipItem('armor', { ...equipment.armor, quality: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.4rem',
                      background: '#1a1a1a',
                      border: '1px solid #333',
                      borderRadius: '4px',
                      color: '#f1c40f',
                      fontSize: '0.85rem'
                    }}
                  >
                    {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                      <option key={key} value={key}>
                        {rank.name} {rank.armorBonus !== 0 && `(${rank.armorBonus > 0 ? '+' : ''}${rank.armorBonus} AC)`}
                      </option>
                    ))}
                  </select>
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#bbb' }}>
                    <span style={{ color: '#3498db' }}>Base AC: {equipment.armor.baseAC}</span>
                    {equipment.armor.stealthDisadvantage && (
                      <span style={{ color: '#e74c3c', marginLeft: '1rem' }}>Stealth Disadvantage</span>
                    )}
                    {equipment.armor.strReq && (
                      <span style={{ color: '#f1c40f', marginLeft: '1rem' }}>Requires STR {equipment.armor.strReq}</span>
                    )}
                  </div>
                </div>
              )}
            </section>

            {/* Quality Ranks Reference */}
            <section className="sheet-section" style={{
              background: 'rgba(241, 196, 15, 0.05)',
              border: '1px solid #444',
              borderRadius: '8px',
              padding: '1rem'
            }}>
              <h4 style={{ color: '#f1c40f', margin: '0 0 0.75rem 0', fontSize: '0.9rem' }}>Quality Ranks Reference</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.75rem' }}>
                {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                  <div key={key} style={{
                    background: 'rgba(0,0,0,0.2)',
                    padding: '0.5rem',
                    borderRadius: '4px'
                  }}>
                    <div style={{ color: '#f1c40f', fontWeight: 'bold' }}>{rank.name}</div>
                    <div style={{ color: '#888' }}>
                      {rank.weaponBonus !== 0 && <span>Weapon: {rank.weaponBonus > 0 ? '+' : ''}{rank.weaponBonus} </span>}
                      {rank.armorBonus !== 0 && <span>Armor: {rank.armorBonus > 0 ? '+' : ''}{rank.armorBonus}</span>}
                      {rank.weaponBonus === 0 && rank.armorBonus === 0 && <span>Standard</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Custom Item Modal */}
            {showCustomItemForm && (
              <div className="modal-overlay" onClick={() => setShowCustomItemForm(false)}>
                <div
                  className="modal-content"
                  onClick={(e) => e.stopPropagation()}
                  style={{ maxWidth: '500px' }}
                >
                  <h3 style={{ color: '#9b59b6', marginTop: 0 }}>
                    Add Custom {customItemType === 'weapon' ? 'Weapon' : 'Armor'}
                  </h3>

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                      Name *
                    </label>
                    <input
                      type="text"
                      value={customItem.name}
                      onChange={(e) => setCustomItem({ ...customItem, name: e.target.value })}
                      placeholder={customItemType === 'weapon' ? 'e.g., Flame Tongue Longsword' : 'e.g., Mithral Chain Shirt'}
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

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div className="form-group">
                      <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                        Quality
                      </label>
                      <select
                        value={customItem.quality}
                        onChange={(e) => setCustomItem({ ...customItem, quality: e.target.value })}
                        style={{
                          width: '100%',
                          padding: '0.6rem',
                          background: '#2a2a2a',
                          border: '1px solid #444',
                          borderRadius: '4px',
                          color: '#fff'
                        }}
                      >
                        {Object.entries(QUALITY_RANKS).map(([key, rank]) => (
                          <option key={key} value={key}>{rank.name}</option>
                        ))}
                      </select>
                    </div>

                    {customItemType === 'weapon' ? (
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Range Type
                        </label>
                        <select
                          value={customItem.rangeType}
                          onChange={(e) => setCustomItem({ ...customItem, rangeType: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.6rem',
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                          }}
                        >
                          <option value="melee">Melee</option>
                          <option value="ranged">Ranged</option>
                        </select>
                      </div>
                    ) : (
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Armor Type
                        </label>
                        <select
                          value={customItem.armorType}
                          onChange={(e) => setCustomItem({ ...customItem, armorType: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.6rem',
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                          }}
                        >
                          <option value="light">Light</option>
                          <option value="medium">Medium</option>
                          <option value="heavy">Heavy</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {customItemType === 'weapon' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Damage Dice
                        </label>
                        <input
                          type="text"
                          value={customItem.damage}
                          onChange={(e) => setCustomItem({ ...customItem, damage: e.target.value })}
                          placeholder="e.g., 2d6"
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
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Damage Type
                        </label>
                        <select
                          value={customItem.damageType}
                          onChange={(e) => setCustomItem({ ...customItem, damageType: e.target.value })}
                          style={{
                            width: '100%',
                            padding: '0.6rem',
                            background: '#2a2a2a',
                            border: '1px solid #444',
                            borderRadius: '4px',
                            color: '#fff'
                          }}
                        >
                          <option value="slashing">Slashing</option>
                          <option value="piercing">Piercing</option>
                          <option value="bludgeoning">Bludgeoning</option>
                          <option value="fire">Fire</option>
                          <option value="cold">Cold</option>
                          <option value="lightning">Lightning</option>
                          <option value="radiant">Radiant</option>
                          <option value="necrotic">Necrotic</option>
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Base AC
                        </label>
                        <input
                          type="number"
                          value={customItem.baseAC}
                          onChange={(e) => setCustomItem({ ...customItem, baseAC: parseInt(e.target.value) || 10 })}
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
                      <div className="form-group">
                        <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                          Max DEX Bonus
                        </label>
                        <input
                          type="number"
                          value={customItem.maxDexBonus === null ? '' : customItem.maxDexBonus}
                          onChange={(e) => setCustomItem({ ...customItem, maxDexBonus: e.target.value === '' ? null : parseInt(e.target.value) })}
                          placeholder="Leave empty for no cap"
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
                  )}

                  <div className="form-group" style={{ marginBottom: '1rem' }}>
                    <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                      Notes (special properties, magic effects, etc.)
                    </label>
                    <textarea
                      value={customItem.notes}
                      onChange={(e) => setCustomItem({ ...customItem, notes: e.target.value })}
                      placeholder="e.g., +1d6 fire damage, glows in darkness..."
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

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                      className="button button-secondary"
                      onClick={() => setShowCustomItemForm(false)}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                    <button
                      className="button"
                      onClick={() => {
                        if (!customItem.name.trim()) {
                          alert('Please enter a name for the item')
                          return
                        }
                        const slot = customItemType === 'weapon' ? 'mainHand' : 'armor'
                        equipItem(slot, {
                          ...customItem,
                          isCustom: true
                        })
                        setShowCustomItemForm(false)
                        setCustomItem({
                          name: '',
                          quality: 'common',
                          damage: '1d6',
                          damageType: 'slashing',
                          properties: [],
                          rangeType: 'melee',
                          baseAC: 11,
                          armorType: 'light',
                          maxDexBonus: null,
                          acBonus: 2,
                          magicBonus: 0,
                          notes: ''
                        })
                      }}
                      style={{ flex: 1, background: '#2ecc71' }}
                    >
                      Add {customItemType === 'weapon' ? 'Weapon' : 'Armor'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Inventory Tab */}
        {activeTab === 'inventory' && (
          <div className="tab-panel">
            {/* Empty Inventory Notice */}
            {inventory.length === 0 && (
              <section className="sheet-section" style={{ background: 'rgba(231, 76, 60, 0.1)', border: '1px solid rgba(231, 76, 60, 0.3)', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                <h3 style={{ color: '#e74c3c', marginTop: 0 }}>No Starting Equipment</h3>
                <p style={{ marginBottom: '1rem' }}>This character was created before the equipment system was implemented, or the equipment wasn't saved properly.</p>
                <button
                  onClick={() => onEditInWizard && onEditInWizard(character)}
                  style={{
                    background: '#3498db',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Edit in Wizard to Select Equipment
                </button>
              </section>
            )}

            {/* Equipped Items */}
            <section className="sheet-section">
              <h3>Equipped</h3>
              {(() => {
                const equippedItems = inventory.filter(item => item.equipped)
                if (equippedItems.length === 0) {
                  return <p className="empty-inventory">No equipped items. Click an item below to equip it.</p>
                }
                return (
                  <div className="inventory-list equipped-list">
                    {equippedItems.map((item, idx) => {
                      const itemName = typeof item === 'string' ? item : item.name
                      return (
                        <div key={idx} className="inventory-item equipped" onClick={() => {
                          const newInventory = inventory.map(i =>
                            (typeof i === 'string' ? i : i.name) === itemName
                              ? { ...i, equipped: false }
                              : i
                          )
                          fetch(`/api/character/${character.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inventory: JSON.stringify(newInventory) })
                          })
                            .then(res => res.json())
                            .then(updated => {
                              setCharacter(updated)
                              onCharacterUpdated && onCharacterUpdated(updated)
                            })
                            .catch(err => console.error('Error updating inventory:', err))
                        }} style={{ cursor: 'pointer' }}>
                          <span className="equip-indicator">⚔️</span>
                          <span className="item-name">{itemName}</span>
                          <span className="item-quantity-controls" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="qty-btn"
                              onClick={() => updateItemQuantity(itemName, -1)}
                              title="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="item-quantity">{item.quantity || 1}</span>
                            <button
                              className="qty-btn"
                              onClick={() => updateItemQuantity(itemName, 1)}
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </span>
                          <button
                            className="remove-item-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Remove ${itemName} from inventory?`)) {
                                removeItemFromInventory(itemName)
                              }
                            }}
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </section>

            {/* Backpack Items */}
            <section className="sheet-section">
              <h3>Backpack</h3>
              {(() => {
                const backpackItems = inventory.filter(item => !item.equipped)
                if (backpackItems.length === 0) {
                  return <p className="empty-inventory">Backpack is empty.</p>
                }
                return (
                  <div className="inventory-list backpack-list">
                    {backpackItems.map((item, idx) => {
                      const itemName = typeof item === 'string' ? item : item.name
                      return (
                        <div key={idx} className="inventory-item" onClick={() => {
                          const newInventory = inventory.map(i =>
                            (typeof i === 'string' ? i : i.name) === itemName
                              ? { ...(typeof i === 'string' ? { name: i, quantity: 1 } : i), equipped: true }
                              : i
                          )
                          fetch(`/api/character/${character.id}`, {
                            method: 'PUT',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ inventory: JSON.stringify(newInventory) })
                          })
                            .then(res => res.json())
                            .then(updated => {
                              setCharacter(updated)
                              onCharacterUpdated && onCharacterUpdated(updated)
                            })
                            .catch(err => console.error('Error updating inventory:', err))
                        }} style={{ cursor: 'pointer' }}>
                          <span className="equip-indicator">🎒</span>
                          <span className="item-name">{itemName}</span>
                          <span className="item-quantity-controls" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="qty-btn"
                              onClick={() => updateItemQuantity(itemName, -1)}
                              title="Decrease quantity"
                            >
                              −
                            </button>
                            <span className="item-quantity">{item.quantity || 1}</span>
                            <button
                              className="qty-btn"
                              onClick={() => updateItemQuantity(itemName, 1)}
                              title="Increase quantity"
                            >
                              +
                            </button>
                          </span>
                          <button
                            className="remove-item-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm(`Remove ${itemName} from inventory?`)) {
                                removeItemFromInventory(itemName)
                              }
                            }}
                            title="Remove item"
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </section>

            {/* Add Item Section */}
            <section className="sheet-section">
              <h3>Manage Inventory</h3>
              {!showAddItem ? (
                <button
                  onClick={() => setShowAddItem(true)}
                  className="add-item-btn"
                >
                  + Add Item
                </button>
              ) : (
                <div className="add-item-form">
                  <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                      <label>Item Name</label>
                      <input
                        type="text"
                        value={newItemName}
                        onChange={(e) => setNewItemName(e.target.value)}
                        placeholder="Enter item name or select below..."
                        onKeyPress={(e) => e.key === 'Enter' && addItemToInventory(newItemName, newItemQuantity)}
                      />
                    </div>
                    <div className="form-group" style={{ flex: 0, minWidth: '80px' }}>
                      <label>Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={newItemQuantity}
                        onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Quick Add from Category</label>
                    <select
                      value={selectedEquipmentCategory}
                      onChange={(e) => setSelectedEquipmentCategory(e.target.value)}
                    >
                      <option value="">Select a category...</option>
                      {Object.keys(getEquipmentOptions()).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  {selectedEquipmentCategory && (
                    <div className="quick-add-items">
                      {getEquipmentOptions()[selectedEquipmentCategory]?.map(item => (
                        <button
                          key={item}
                          className="quick-add-item"
                          onClick={() => addItemToInventory(item, newItemQuantity)}
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="add-item-actions">
                    <button
                      onClick={() => addItemToInventory(newItemName, newItemQuantity)}
                      disabled={!newItemName.trim()}
                      className="button"
                    >
                      Add Item
                    </button>
                    <button
                      onClick={() => {
                        setShowAddItem(false)
                        setNewItemName('')
                        setNewItemQuantity(1)
                        setSelectedEquipmentCategory('')
                      }}
                      className="button button-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Wealth Section */}
            <section className="sheet-section">
              <h3>Currency</h3>
              <div className="currency-display" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="currency-item gold" style={{
                  background: 'rgba(241, 196, 15, 0.15)',
                  border: '1px solid #f1c40f',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  minWidth: '100px'
                }}>
                  <input
                    type="number"
                    min="0"
                    value={character.gold_gp || 0}
                    onChange={async (e) => {
                      const newValue = Math.max(0, parseInt(e.target.value) || 0)
                      try {
                        const response = await fetch(`/api/character/${character.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ gold_gp: newValue })
                        })
                        const updated = await response.json()
                        setCharacter(updated)
                        onCharacterUpdated && onCharacterUpdated(updated)
                      } catch (err) {
                        console.error('Error updating gold:', err)
                      }
                    }}
                    style={{
                      width: '80px',
                      padding: '0.5rem',
                      background: '#1a1a1a',
                      border: '1px solid #f1c40f',
                      borderRadius: '4px',
                      color: '#f1c40f',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      textAlign: 'center'
                    }}
                  />
                  <div style={{ color: '#f1c40f', fontSize: '0.8rem', marginTop: '0.25rem' }}>Gold (gp)</div>
                </div>
                <div className="currency-item silver" style={{
                  background: 'rgba(189, 195, 199, 0.15)',
                  border: '1px solid #bdc3c7',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  minWidth: '100px'
                }}>
                  <input
                    type="number"
                    min="0"
                    value={character.gold_sp || 0}
                    onChange={async (e) => {
                      const newValue = Math.max(0, parseInt(e.target.value) || 0)
                      try {
                        const response = await fetch(`/api/character/${character.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ gold_sp: newValue })
                        })
                        const updated = await response.json()
                        setCharacter(updated)
                        onCharacterUpdated && onCharacterUpdated(updated)
                      } catch (err) {
                        console.error('Error updating silver:', err)
                      }
                    }}
                    style={{
                      width: '80px',
                      padding: '0.5rem',
                      background: '#1a1a1a',
                      border: '1px solid #bdc3c7',
                      borderRadius: '4px',
                      color: '#bdc3c7',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      textAlign: 'center'
                    }}
                  />
                  <div style={{ color: '#bdc3c7', fontSize: '0.8rem', marginTop: '0.25rem' }}>Silver (sp)</div>
                </div>
                <div className="currency-item copper" style={{
                  background: 'rgba(205, 127, 50, 0.15)',
                  border: '1px solid #cd7f32',
                  borderRadius: '8px',
                  padding: '0.75rem 1rem',
                  textAlign: 'center',
                  minWidth: '100px'
                }}>
                  <input
                    type="number"
                    min="0"
                    value={character.gold_cp || 0}
                    onChange={async (e) => {
                      const newValue = Math.max(0, parseInt(e.target.value) || 0)
                      try {
                        const response = await fetch(`/api/character/${character.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ gold_cp: newValue })
                        })
                        const updated = await response.json()
                        setCharacter(updated)
                        onCharacterUpdated && onCharacterUpdated(updated)
                      } catch (err) {
                        console.error('Error updating copper:', err)
                      }
                    }}
                    style={{
                      width: '80px',
                      padding: '0.5rem',
                      background: '#1a1a1a',
                      border: '1px solid #cd7f32',
                      borderRadius: '4px',
                      color: '#cd7f32',
                      fontWeight: 'bold',
                      fontSize: '1.2rem',
                      textAlign: 'center'
                    }}
                  />
                  <div style={{ color: '#cd7f32', fontSize: '0.8rem', marginTop: '0.25rem' }}>Copper (cp)</div>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* Background Tab */}
        {activeTab === 'background' && (
          <div className="tab-panel">
            {/* Physical Description */}
            {(character.height || character.weight || character.age || character.hair_color || character.eye_color || character.skin_color) && (
              <section className="sheet-section">
                <h3>Physical Description</h3>
                <div className="physical-grid">
                  {character.age && <div className="physical-item"><span>Age:</span> {character.age}</div>}
                  {character.height && <div className="physical-item"><span>Height:</span> {character.height}</div>}
                  {character.weight && <div className="physical-item"><span>Weight:</span> {character.weight}</div>}
                  {character.hair_color && <div className="physical-item"><span>Hair:</span> {character.hair_color}</div>}
                  {character.eye_color && <div className="physical-item"><span>Eyes:</span> {character.eye_color}</div>}
                  {character.skin_color && <div className="physical-item"><span>Skin:</span> {character.skin_color}</div>}
                </div>
              </section>
            )}

            {/* Background Info */}
            {character.background && (
              <section className="sheet-section">
                <h3>Background: {capitalize(character.background)}</h3>
                {backgroundData && (
                  <div className="background-info">
                    {backgroundData.description && <p>{backgroundData.description}</p>}
                    {backgroundData.skillProficiencies?.length > 0 && (
                      <div className="bg-detail">
                        <strong>Skill Proficiencies:</strong> {backgroundData.skillProficiencies.map(s => capitalize(s)).join(', ')}
                      </div>
                    )}
                    {backgroundData.toolProficiencies?.length > 0 && (
                      <div className="bg-detail">
                        <strong>Tool Proficiencies:</strong> {backgroundData.toolProficiencies.join(', ')}
                      </div>
                    )}
                    {backgroundData.languages && (
                      <div className="bg-detail">
                        <strong>Languages:</strong> {
                          typeof backgroundData.languages === 'number'
                            ? `${backgroundData.languages} additional language${backgroundData.languages > 1 ? 's' : ''} of your choice`
                            : backgroundData.languages
                        }
                      </div>
                    )}
                    {backgroundData.feature && (
                      <div className="bg-feature">
                        <strong>{backgroundData.feature.name}:</strong> {backgroundData.feature.description}
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {/* Personality */}
            {(character.personality_traits || character.ideals || character.bonds || character.flaws) && (
              <section className="sheet-section">
                <h3>Personality</h3>
                <div className="personality-section">
                  {character.personality_traits && (
                    <div className="personality-item">
                      <h4>Personality Traits</h4>
                      <p>{character.personality_traits}</p>
                    </div>
                  )}
                  {character.ideals && (
                    <div className="personality-item">
                      <h4>Ideals</h4>
                      <p>{character.ideals}</p>
                    </div>
                  )}
                  {character.bonds && (
                    <div className="personality-item">
                      <h4>Bonds</h4>
                      <p>{character.bonds}</p>
                    </div>
                  )}
                  {character.flaws && (
                    <div className="personality-item">
                      <h4>Flaws</h4>
                      <p>{character.flaws}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Backstory */}
            {character.backstory && (
              <section className="sheet-section">
                <h3>Backstory</h3>
                <div className="backstory-content">
                  <p>{character.backstory}</p>
                </div>
              </section>
            )}

            {/* Connections */}
            {(character.organizations || character.allies || character.enemies) && (
              <section className="sheet-section">
                <h3>Connections</h3>
                <div className="connections-section">
                  {character.organizations && (
                    <div className="connection-item">
                      <h4>Organizations</h4>
                      <p>{character.organizations}</p>
                    </div>
                  )}
                  {character.allies && (
                    <div className="connection-item">
                      <h4>Allies</h4>
                      <p>{character.allies}</p>
                    </div>
                  )}
                  {character.enemies && (
                    <div className="connection-item">
                      <h4>Enemies</h4>
                      <p>{character.enemies}</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Other Notes */}
            {character.other_notes && (
              <section className="sheet-section">
                <h3>Other Notes</h3>
                <div className="notes-content">
                  <p>{character.other_notes}</p>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CharacterSheet
