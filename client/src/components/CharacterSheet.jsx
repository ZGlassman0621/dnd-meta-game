import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import racesData from '../data/races.json'
import backgroundsData from '../data/backgrounds.json'
import deitiesData from '../data/deities.json'
import equipmentData from '../data/equipment.json'
import spellsData from '../data/spells/index.js'
import NicknameManagerPanel from './NicknameManagerPanel.jsx'
import Tip from './creator-next/Tooltip.jsx'
import {
  SPELL_MASTERY_LEVEL, SIGNATURE_SPELLS_LEVEL, SPELL_MASTERY_MAX, SIGNATURE_SPELLS_MAX,
  arcaneRecoveryBudget, arcaneRecoveryOptions, wizardLevelFor,
  copyCostForSpellLevel, copyableSpellCandidates, memorizeSwapOptions,
  parseSpellbookState, pendingMemorizeSwap, spellLevelLabel, spellLevelNumber, spellbookSizeForLevel,
  spellScrollRows,
  replaceCostForSpellLevel, replacementPreview, backupRestorePreview, backupCopyCandidates,
  SPELLBOOK_MATERIALS, spellbookMaterialCost, spellbookMaterialLabel, replaceEpisodeProgress
} from './spellbookHelpers.js'

function CharacterSheet({ character: initialCharacter, onBack, onCharacterUpdated, onLevelUp, onEditInCreator }) {
  const [character, setCharacter] = useState(initialCharacter)
  const [activeTab, setActiveTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [canLevelUp, setCanLevelUp] = useState(false)

  // Inventory management state
  const [showAddItem, setShowAddItem] = useState(false)
  const [showNicknames, setShowNicknames] = useState(false)
  const [newItemName, setNewItemName] = useState('')
  const [newItemQuantity, setNewItemQuantity] = useState(1)
  const [selectedEquipmentCategory, setSelectedEquipmentCategory] = useState('')

  // Spell management state
  const [showCantripSelection, setShowCantripSelection] = useState(false)
  const [selectedCantrip, setSelectedCantrip] = useState(null)
  const [spellSlots, setSpellSlots] = useState(null)
  const [showPrepareSpells, setShowPrepareSpells] = useState(false)
  const [pendingPrepared, setPendingPrepared] = useState([])
  const [spellLevelFilter, setSpellLevelFilter] = useState('all')
  const [spellSearch, setSpellSearch] = useState('')
  const [showLearnSpell, setShowLearnSpell] = useState(false)
  const [pendingKnown, setPendingKnown] = useState([])

  // Wizard spellbook state (2026-11-07): copy panel, always-prepared
  // picks, Memorize Spell swap, and the DM status lever. The book
  // itself lives in character.known_spells; spellbook_json (status /
  // mastery / signature) is parsed below from the fetched row.
  const [spellSaveError, setSpellSaveError] = useState(null)
  const [showCopyPanel, setShowCopyPanel] = useState(false)
  const [copySearch, setCopySearch] = useState('')
  const [copySelected, setCopySelected] = useState(null)
  const [copySource, setCopySource] = useState('')
  const [copyError, setCopyError] = useState(null)
  const [copyResult, setCopyResult] = useState(null)
  const [copyBusy, setCopyBusy] = useState(false)
  const [pendingMastery, setPendingMastery] = useState(null)
  const [pendingSignature, setPendingSignature] = useState(null)
  const [alwaysPreparedError, setAlwaysPreparedError] = useState(null)
  const [alwaysPreparedResult, setAlwaysPreparedResult] = useState(null)
  const [memorizeOld, setMemorizeOld] = useState('')
  const [memorizeNew, setMemorizeNew] = useState('')
  const [memorizeError, setMemorizeError] = useState(null)
  const [memorizeResult, setMemorizeResult] = useState(null)
  const [memorizeBusy, setMemorizeBusy] = useState(false)
  // Arcane Recovery (wizard L1, 2026-11-08): the banked slot pick —
  // arcanePicks is the list of spent slot levels to recover (e.g.
  // [2, 1]), arcanePickLevel the select's current choice. Banking
  // touches no HP / slots / prepared list — it only stores the pick.
  const [arcanePicks, setArcanePicks] = useState([])
  const [arcanePickLevel, setArcanePickLevel] = useState('')
  const [arcaneError, setArcaneError] = useState(null)
  const [arcaneResult, setArcaneResult] = useState(null)
  const [arcaneBusy, setArcaneBusy] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [statusError, setStatusError] = useState(null)

  // Spellbook replacement + backup (2026-11-07): the 2024 PHB
  // sidebar — a lost book is re-transcribed from the prepared spells
  // at 1h + 10 gp per spell level, or restored whole from a backup
  // book at no further cost. The server derives the new book and
  // enforces gold + clock; the sheet only shows the cost up front
  // and reports the outcome (or the server's refusal, verbatim).
  const [showReplacePanel, setShowReplacePanel] = useState(false)
  const [replaceSource, setReplaceSource] = useState('memory')
  const [replaceBusy, setReplaceBusy] = useState(false)
  const [replaceError, setReplaceError] = useState(null)
  const [replaceResult, setReplaceResult] = useState(null)
  // V6 (spell by spell, 2026-11-08): the subset picked in the panel
  // right now; the blank book's materials (a key from the fixed
  // SPELLBOOK_MATERIALS table — 'standard' is the default), picked
  // on the first transcription into a new book.
  const [replaceSelected, setReplaceSelected] = useState([])
  const [replaceBookMaterials, setReplaceBookMaterials] = useState('standard')
  const [backupSelected, setBackupSelected] = useState(null)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupError, setBackupError] = useState(null)
  const [backupResult, setBackupResult] = useState(null)
  // V5 (2026-11-08): the blank backup book's materials (a key from
  // the fixed SPELLBOOK_MATERIALS table — 'standard' is the
  // default), picked on the first copy into a new backup book —
  // later copies charge transcription only.
  const [backupBookMaterials, setBackupBookMaterials] = useState('standard')

  // Progression tab state
  const [progression, setProgression] = useState(null)
  const [progressionLoading, setProgressionLoading] = useState(false)
  const [progressionError, setProgressionError] = useState(null)

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

  // Fetch progression data (theme, ancestry feats, synergies) — loads once per character
  useEffect(() => {
    let cancelled = false
    setProgressionLoading(true)
    setProgressionError(null)
    fetch(`/api/character/${character.id}/progression`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then(data => { if (!cancelled) { setProgression(data); setProgressionLoading(false) } })
      .catch(err => {
        if (!cancelled) { setProgressionError(err.message); setProgressionLoading(false) }
      })
    return () => { cancelled = true }
  }, [character.id])

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

  // Fetch spell slots for spellcasting classes
  useEffect(() => {
    const fetchSpellSlots = async () => {
      try {
        const response = await fetch(`/api/character/spell-slots/${character.id}`)
        if (response.ok) {
          const data = await response.json()
          setSpellSlots(data)
        }
      } catch (error) {
        console.error('Error fetching spell slots:', error)
      }
    }
    fetchSpellSlots()
  }, [character.id, character.level, character.class])

  const useSpellSlot = async (level) => {
    try {
      const response = await fetch(`/api/character/spell-slots/${character.id}/use`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })
      if (response.ok) {
        setSpellSlots(prev => ({
          ...prev,
          used: { ...prev.used, [level]: (prev.used[level] || 0) + 1 }
        }))
      }
    } catch (error) {
      console.error('Error using spell slot:', error)
    }
  }

  const restoreSpellSlot = async (level) => {
    try {
      const response = await fetch(`/api/character/spell-slots/${character.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level })
      })
      if (response.ok) {
        setSpellSlots(prev => ({
          ...prev,
          used: { ...prev.used, [level]: Math.max(0, (prev.used[level] || 0) - 1) }
        }))
      }
    } catch (error) {
      console.error('Error restoring spell slot:', error)
    }
  }

  const handleGrantXP = async (amount) => {
    try {
      const response = await fetch(`/api/character/grant-xp/${character.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      })
      if (response.ok) {
        const data = await response.json()
        setCharacter(data.character)
        setCanLevelUp(data.canLevelUp)
        onCharacterUpdated?.(data.character)
      }
    } catch (error) {
      console.error('Error granting XP:', error)
    }
  }

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
  const knownSpells = parseJson(character.known_spells, [])
  const preparedSpells = parseJson(character.prepared_spells, [])
  // Wizard spellbook state (2026-11-07): the book lives in
  // known_spells; spellbook_json carries { status, mastery,
  // signature } plus a banked Memorize Swap (pendingMemorizeSwap,
  // rest consolidation) while one is banked, and (2026-11-08) a
  // banked Arcane Recovery (pendingArcaneRecovery: { slots: [...] })
  // plus the once-per-long-rest flag (arcaneRecoveryUsed: true,
  // present only while used). A missing or corrupt value reads as
  // an intact empty book — the server is the authority, and the
  // client never invents a loss. masteryPicks / signaturePicks are
  // the effective lists: pending edits until saved, then the stored
  // picks.
  const spellbookState = parseSpellbookState(character.spellbook_json)
  // Arcane Recovery (wizard L1, 2026-11-08): wizard level is the
  // CLASS level, not the row total — a fighter 5 / wizard 1 recovers
  // 1 slot level, not 3. wizardLevelFor mirrors the server's
  // wizardLevelFromClassLevels + single-class fallback; 0 means no
  // wizard levels, so the section below never renders for a
  // non-wizard. The budget is ceil(wizard level / 2), the server's
  // rule — the sheet only displays it.
  const wizardLevel = wizardLevelFor({ classLevels: character.class_levels, characterClass: character.class, characterLevel: character.level })
  const arcaneBudget = arcaneRecoveryBudget(wizardLevel)
  const isWizardSheet = character.class?.toLowerCase() === 'wizard'
  const spellbookAlwaysPrepared = [...(spellbookState.mastery || []), ...(spellbookState.signature || [])]
  const masteryPicks = pendingMastery ?? spellbookState.mastery
  const signaturePicks = pendingSignature ?? spellbookState.signature
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

  // Eldritch Knight / Arcane Trickster prepared spells (2024 PHB,
  // 2026-11-07): the shared third-caster Prepared Spells column, 3 at
  // 3rd -> 13 at 20th. Sheet-side constants, same pattern as the
  // paladin table below — the table stays server-side in
  // levelProgression.js (ELDRITCH_KNIGHT_ARCANE_TRICKSTER_SPELLS_
  // PREPARED) and is mirrored here; the test asserts the two agree.
  // Cantrips are per-subclass: EK 2 at 3rd, 3rd at 10th; AT Mage Hand
  // + 2 at 3rd (= 3 total), 4th at 10th — Mage Hand counts toward
  // the total. cantrips.json keeps fighter: [] / rogue: [] (the base
  // classes do not cast); the picker maps EK/AT to the Wizard list.
  const THIRD_CASTER_PREPARED_SPELLS = [0, 0, 3, 4, 4, 4, 5, 6, 6, 7, 8, 8, 9, 10, 10, 11, 11, 11, 12, 13]
  const ELDRITCH_KNIGHT_CANTRIPS = [0, 0, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3]
  const ARCANE_TRICKSTER_CANTRIPS = [0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]

  // Cantrip management functions
  const getAvailableCantrips = () => {
    const classKey = character.class?.toLowerCase()
    // Eldritch Knight / Arcane Trickster cast from the Wizard list —
    // cantrips.json holds no fighter/rogue cantrips (the base classes
    // do not cast), so the picker reads the Wizard list for them.
    if (isThirdCaster) return spellsData.cantrips.wizard || []
    return spellsData.cantrips[classKey] || []
  }

  const getMaxCantrips = () => {
    if (isThirdCaster) {
      const table = isArcaneTrickster ? ARCANE_TRICKSTER_CANTRIPS : ELDRITCH_KNIGHT_CANTRIPS
      return table[character.level - 1] ?? 0
    }
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

  // Paladin spells prepared (2024 PHB, pp. 109-110, verified from
  // the book 2026-11-06): the Prepared Spells column of the Paladin
  // Features table, levels 1-20 — 2 at L1 ("To start, choose two
  // level 1 Paladin spells"), 6 at L5 (the book's own example). The
  // book states NO Cha-mod formula; the 2014 formula (Cha mod + half
  // level, 0 at L1) is retired. Same table as the server
  // (levelProgression PALADIN_SPELLS_PREPARED).
  const PALADIN_PREPARED_SPELLS = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15]

  // Get max prepared spells for prepared casters
  const getMaxPrepared = () => {
    if (isThirdCaster) return THIRD_CASTER_PREPARED_SPELLS[character.level - 1] ?? 0
    // Blood Hunter, Order of the Profane Soul ONLY (2024 Rules,
    // "Profane Soul Spellcasting" table): a fixed Prepared Spells
    // column, 2 at 3rd -> 11 at 20th, no ability mod. Other Orders
    // (Ghostslayer / Lycan / Mutant) do not cast and keep falling
    // through to 0. Checked here — before the spellcasting guard
    // below — because the blood_hunter base class carries
    // spellcasting: null in classes.json (only the Profane Soul
    // subclass casts). Same table as the server
    // (levelProgression PROFANE_SOUL_SPELLS_PREPARED).
    if (isProfaneSoul) {
      const PROFANE_SOUL_PREPARED = [0, 0, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 11]
      return PROFANE_SOUL_PREPARED[character.level - 1] ?? 0
    }
    if (!classData?.spellcasting) return 0
    const className = character.class?.toLowerCase()
    const abilityKey = classData.spellcasting.ability?.toLowerCase().slice(0, 3)
    const mod = Math.floor((abilities[abilityKey] - 10) / 2)
    if (className === 'cleric' || className === 'druid') return Math.max(1, mod + character.level)
    if (className === 'wizard') return Math.max(1, mod + character.level)
    // Bard (2024 PHB): Cha mod + bard level, min 1 — the bardService
    // formula (L1 at Cha +3 = 4). No slot gate: a L1 bard has slots.
    if (className === 'bard') return Math.max(1, mod + character.level)
    // Paladin (2024 PHB, pp. 109-110): table-driven — the Prepared
    // Spells column, 2 at L1. A 2024 L1 paladin HAS two 1st-level
    // slots, so there is no L1 -> 0 special case.
    if (className === 'paladin') {
      return PALADIN_PREPARED_SPELLS[character.level - 1] ?? 0
    }
    if (className === 'artificer') return Math.max(1, mod + Math.floor(character.level / 2))
    // Blackguard (2026-11-06): same half-caster formula as paladin/artificer,
    // but 0 at level 1 — blackguard has no 1st-level spell slots, and a
    // prepared caster with no slots at that level prepares 0 (printed rule:
    // spells prepared "of a level you have slots for"). Without this branch
    // the sheet capped blackguard picks at 0 at EVERY level, so the server
    // PUT wiring could never receive a list.
    if (className === 'blackguard') {
      if (character.level === 1) return 0
      return Math.max(1, mod + Math.floor(character.level / 2))
    }
    // Sorcerer (2024 PHB, Sorcerer Features table): a prepared caster
    // with a FIXED Prepared Spells column — no formula (the column
    // does not equal Cha mod + level at any consistent mod). Must agree
    // with the server's SORCERER_SPELLS_PREPARED /
    // sorcererService.preparedSpellsMax.
    const SORCERER_PREPARED = [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22]
    if (className === 'sorcerer') return SORCERER_PREPARED[character.level - 1] ?? 0
    // Warlock (2024 PHB, Warlock Features table): a prepared caster
    // with a FIXED Prepared Spells column — 2 at L1 -> 15 at L20, no
    // Cha-mod formula. Must agree with the server's
    // WARLOCK_SPELLS_PREPARED / warlockService.preparedSpellsMax.
    const WARLOCK_PREPARED = [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15]
    if (className === 'warlock') return WARLOCK_PREPARED[character.level - 1] ?? 0
    // Ranger (2024 PHB): table-driven prepared count (same column as
    // paladin), NOT the half-caster formula — L1 prepares 2.
    if (className === 'ranger') {
      const RANGER_PREPARED = [2, 3, 4, 5, 6, 6, 7, 7, 9, 10, 10, 11, 11, 12, 12, 14, 14, 14, 15, 15]
      return RANGER_PREPARED[character.level - 1]
    }
    return 0
  }

  // Check if class is a prepared caster
  const isPreparedCaster = () => {
    if (isThirdCaster) return true
    if (isProfaneSoul) return true
    const spellsKnown = classData?.spellcasting?.spellsKnown
    return spellsKnown === 'All prepared' || spellsKnown === 'Spellbook'
  }

  // Check if class is a known caster
  const isKnownCaster = () => {
    return classData?.spellcasting?.spellsKnown === 'Limited known'
  }

  // Get available class spells for a given level
  const getClassSpellsForLevel = (spellLevel) => {
    const className = character.class?.toLowerCase()
    const levelSpells = spellsData.spells[spellLevel] || []
    return levelSpells.filter(s => s.classes?.includes(className))
  }

  // Get all spells the character can prepare from (by level)
  const getPreparableSpells = () => {
    if (!spellSlots) return []
    const className = character.class?.toLowerCase()
    const isWizard = className === 'wizard'
    const results = []
    for (const [level, max] of Object.entries(spellSlots.max || {})) {
      if (max <= 0) continue
      const levelKey = level === '1' ? '1st' : level === '2' ? '2nd' : level === '3' ? '3rd' : `${level}th`
      const spellsForLevel = spellsData.spells[levelKey] || []
      // Eldritch Knight / Arcane Trickster prepare from the Wizard
      // list (EK levelled spells Abjuration/Evocation only; AT any
      // Wizard spell) — the catalog carries no Fighter/Rogue tags.
      const filtered = isWizard
        ? spellsForLevel.filter(s => s.classes?.includes('wizard') && knownSpells.includes(s.name))
        : isThirdCaster
          ? spellsForLevel.filter(s => s.classes?.includes('wizard')
            && (isArcaneTrickster || ['Abjuration', 'Evocation'].includes(s.school)))
          : spellsForLevel.filter(s => s.classes?.includes(className))
      filtered.forEach(s => results.push({ ...s, spellLevel: levelKey }))
    }
    return results
  }

  // Get subclass always-prepared spell names
  const getAlwaysPreparedSpellNames = () => {
    const names = []
    subclassSpells.forEach(([, spells]) => {
      spells.forEach(name => names.push(name))
    })
    // Ranger (2024 PHB, Favored Enemy): Hunter's Mark is always
    // prepared from L1 — a class-level grant, not a subclass one —
    // so it joins the always-prepared names here (picker exclusion
    // + the subclass-spells display) rather than via a new mechanism.
    if (character.class?.toLowerCase() === 'ranger') {
      names.push("Hunter's Mark")
    }
    // Wizard Spell Mastery (L18) / Signature Spells (L20)
    // (2026-11-07): the picks live in spellbook_json and are
    // prepared by the feature — they are excluded from the prepare
    // picker and from the server's cap the same way, so the picker
    // never offers to unprepare a spell the feature keeps prepared.
    if (isWizardSheet) {
      for (const n of spellbookAlwaysPrepared) names.push(n)
    }
    return names
  }

  // Save prepared spells to server. A refusal (e.g. a wizard whose
  // spellbook is lost — prepared spells cannot change without it)
  // leaves the sheet on the stored list and shows the server's
  // reason: previously the { error } body was set as the character,
  // corrupting the sheet until reload.
  const savePreparedSpells = async (spellNames) => {
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prepared_spells: JSON.stringify(spellNames) })
      })
      const updated = await response.json()
      if (!response.ok) {
        setSpellSaveError(updated?.error || `Saving prepared spells failed (HTTP ${response.status})`)
        return
      }
      setSpellSaveError(null)
      setCharacter(updated)
      onCharacterUpdated?.(updated)
    } catch (err) {
      console.error('Error saving prepared spells:', err)
      setSpellSaveError(`Saving prepared spells failed: ${err.message}`)
    }
  }

  // Save known spells to server (same refusal guard as above — a
  // refused PUT must never replace the character with an error body).
  const saveKnownSpells = async (spellNames) => {
    try {
      const response = await fetch(`/api/character/${character.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ known_spells: JSON.stringify(spellNames) })
      })
      const updated = await response.json()
      if (!response.ok) {
        setSpellSaveError(updated?.error || `Saving known spells failed (HTTP ${response.status})`)
        return
      }
      setSpellSaveError(null)
      setCharacter(updated)
      onCharacterUpdated?.(updated)
    } catch (err) {
      console.error('Error saving known spells:', err)
      setSpellSaveError(`Saving known spells failed: ${err.message}`)
    }
  }

  // Wizard spellbook actions (2026-11-07): every book write goes
  // through the validated spellbook routes, never a bare PUT — the
  // free-text "+ Add to Spellbook" prompt that used to write
  // known_spells unvalidated is deleted (see the Spellbook section).
  // Scroll copying (2026-11-08): a scroll pick carries `scrollName`
  // on copySelected — the body sends { spellName, source: 'scroll',
  // scrollName } and NO free-text source; the server re-reads the
  // row and re-derives the spell, never trusting the client's claim.
  // A found-book pick sends { spellName, source } as before.
  const copySpellIntoBook = async () => {
    const isScroll = Boolean(copySelected?.scrollName)
    if (!copySelected || copyBusy) return
    if (isScroll) {
      if (!copySelected.scrollName) return
    } else if (!copySource.trim()) {
      return
    }
    const cost = copyCostForSpellLevel(copySelected.level)
    if (!cost) return
    const gold = Number(character.gold_gp) || 0
    if (gold < cost.gold) {
      setCopyError(`Not enough gold: copying ${copySelected.name} (level ${copySelected.level}) costs ${cost.gold} gp, you have ${gold} gp.`)
      return
    }
    setCopyBusy(true)
    setCopyError(null)
    setCopyResult(null)
    try {
      const body = isScroll
        ? { spellName: copySelected.name, source: 'scroll', scrollName: copySelected.scrollName }
        : { spellName: copySelected.name, source: copySource.trim() }
      const response = await fetch(`/api/character/${character.id}/copy-spell`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok) {
        setCopyError(data?.error || `Copy failed (HTTP ${response.status})`)
        return
      }
      // The server reports the scroll's fate when the copy came from
      // one: `scrollConsumed: true` (the row was consumed) or `false`
      // (a Hedge Mage keeps it — Nothing to Waste). The fields are
      // read defensively — the server half may not have landed yet —
      // so an absent report renders no scroll sentence, never a crash.
      const scrollName = data.copy?.scrollName || copySelected.scrollName
      const scrollNote = data.copy?.scrollConsumed === true
        ? ` The ${scrollName} was consumed.`
        : data.copy?.scrollConsumed === false
          ? ` The ${scrollName} was kept — a Hedge Mage keeps the scroll (Nothing to Waste).`
          : ''
      setCharacter(data.character)
      onCharacterUpdated?.(data.character)
      setCopyResult(`Copied ${data.copy.spell} (level ${data.copy.spellLevel}) into your spellbook — ${data.copy.goldSpent} gp spent (${data.copy.goldRemaining} gp left), ${data.copy.hoursAdvanced} hours passed${data.copy.clockAdvanced ? '' : ' (the clock did not advance)'}${data.copy.clockError ? ` — clock note: ${data.copy.clockError}` : ''}.${scrollNote}${data.copy.replacedCleared ? ' The book no longer counts as a replacement — new spells have been copied into it.' : ''}`)
      setCopySelected(null)
      setCopySource('')
      setShowCopyPanel(false)
    } catch (err) {
      setCopyError(`Copy failed: ${err.message}`)
    } finally {
      setCopyBusy(false)
    }
  }

  const toggleAlwaysPrepared = (list, name) => {
    const cur = list === 'mastery' ? [...masteryPicks] : [...signaturePicks]
    const other = list === 'mastery' ? signaturePicks : masteryPicks
    const at = cur.findIndex(s => String(s).toLowerCase() === String(name).toLowerCase())
    if (at >= 0) {
      cur.splice(at, 1)
    } else {
      if (cur.length >= 2) return
      if (other.some(s => String(s).toLowerCase() === String(name).toLowerCase())) return
      cur.push(name)
    }
    if (list === 'mastery') setPendingMastery(cur)
    else setPendingSignature(cur)
  }

  const saveAlwaysPrepared = async () => {
    setAlwaysPreparedError(null)
    setAlwaysPreparedResult(null)
    try {
      const response = await fetch(`/api/character/${character.id}/spellbook-always-prepared`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastery: masteryPicks, signature: signaturePicks })
      })
      const data = await response.json()
      if (!response.ok) {
        setAlwaysPreparedError(data?.error || `Save failed (HTTP ${response.status})`)
        return
      }
      setCharacter(data.character)
      onCharacterUpdated?.(data.character)
      setPendingMastery(null)
      setPendingSignature(null)
      setAlwaysPreparedResult('Always-prepared picks saved — Spell Mastery and Signature Spells are prepared by the feature and do not count against your prepared limit.')
    } catch (err) {
      setAlwaysPreparedError(`Save failed: ${err.message}`)
    }
  }

  // Memorize Spell (wizard L5): the swap is BANKED here, not rested
  // here. Rest consolidation (2026-11-07): one rest system, the DM's —
  // POST /api/character/:id/rest is deleted, so the sheet no longer
  // takes a rest at all. Picking a swap POSTs it to /memorize-bank;
  // the next DM short rest validates it again (the book may have
  // changed since banking) and applies it, then clears the bank.
  // Banking changes nothing yet — no HP, no slots, no prepared list —
  // and a long rest leaves the bank waiting. A second bank replaces
  // the first. The bank endpoint returns no character row, so the
  // sheet re-fetches the row to read the stored bank back.
  const refreshCharacterRow = async () => {
    const response = await fetch(`/api/character/${character.id}`)
    if (!response.ok) return null
    const updated = await response.json()
    setCharacter(updated)
    onCharacterUpdated?.(updated)
    return updated
  }
  const bankMemorizeSwap = async () => {
    if (!memorizeOld || !memorizeNew || memorizeBusy) return
    setMemorizeBusy(true)
    setMemorizeError(null)
    setMemorizeResult(null)
    try {
      const response = await fetch(`/api/character/${character.id}/memorize-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memorizeSwap: { oldSpell: memorizeOld, newSpell: memorizeNew } })
      })
      const data = await response.json()
      if (!response.ok) {
        setMemorizeError(data?.error || `Banking the swap failed (HTTP ${response.status})`)
        return
      }
      await refreshCharacterRow()
      setMemorizeResult(`Banked: swap ${data.banked?.oldSpell || memorizeOld} for ${data.banked?.newSpell || memorizeNew}. It applies at your next short rest in play.${data.replaced ? ' (This replaced your earlier banked swap.)' : ''}`)
      setMemorizeOld('')
      setMemorizeNew('')
    } catch (err) {
      setMemorizeError(`Banking the swap failed: ${err.message}`)
    } finally {
      setMemorizeBusy(false)
    }
  }
  const clearMemorizeBank = async () => {
    if (memorizeBusy) return
    setMemorizeBusy(true)
    setMemorizeError(null)
    setMemorizeResult(null)
    try {
      const response = await fetch(`/api/character/${character.id}/memorize-bank`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (!response.ok) {
        setMemorizeError(data?.error || `Clearing the bank failed (HTTP ${response.status})`)
        return
      }
      await refreshCharacterRow()
      setMemorizeResult(data.cleared ? 'Banked swap cleared — nothing will change at your next short rest.' : 'No swap was banked.')
    } catch (err) {
      setMemorizeError(`Clearing the bank failed: ${err.message}`)
    } finally {
      setMemorizeBusy(false)
    }
  }

  // Arcane Recovery (wizard L1, 2026-11-08): the recovery is BANKED
  // here, not rested here — same shape as Memorize Swap above. The
  // player picks which spent slot levels to recover; the next DM
  // short rest validates the bank again (slots may have been spent
  // or restored since banking) and applies it, then clears the bank
  // and marks the feature used until the next long rest. Banking
  // changes nothing yet — no HP, no slots, no prepared list — and a
  // long rest leaves the bank waiting while it clears the used-flag.
  // A second bank replaces the first. A lost spellbook does NOT
  // block this: recovery restores spent slots, it does not change
  // the prepared list. The bank endpoint returns no character row,
  // so the sheet re-fetches the row (refreshCharacterRow, above) to
  // read the stored bank back. This never calls the per-level +1
  // restore route — that route has no budget, no 6th+ exclusion,
  // and no once-per-long-rest tracking.
  const addArcanePick = () => {
    const level = Number(arcanePickLevel)
    if (!Number.isInteger(level) || level < 1 || level > 5) return
    const option = arcaneOpts.options.find(o => o.level === level)
    if (!option || option.remaining <= 0) {
      setArcaneError(`No ${spellLevelLabel(level)}-level slot is spent to recover right now.`)
      return
    }
    if (arcaneOpts.pickedTotal + level > arcaneBudget) {
      setArcaneError(`Adding a ${spellLevelLabel(level)}-level slot would recover ${arcaneOpts.pickedTotal + level} slot levels — Arcane Recovery only recovers up to ${arcaneBudget} at wizard level ${wizardLevel}. Remove a pick first.`)
      return
    }
    setArcaneError(null)
    setArcanePicks(prev => [...prev, level])
    setArcanePickLevel('')
  }
  const removeArcanePick = (index) => {
    setArcaneError(null)
    setArcanePicks(prev => prev.filter((_, i) => i !== index))
  }
  const bankArcaneRecovery = async () => {
    if (arcanePicks.length === 0 || arcaneBusy) return
    const total = arcanePicks.reduce((a, l) => a + l, 0)
    if (total > arcaneBudget) {
      setArcaneError(`That would recover ${total} slot levels — Arcane Recovery only recovers up to ${arcaneBudget} at wizard level ${wizardLevel}. Remove a pick first.`)
      return
    }
    setArcaneBusy(true)
    setArcaneError(null)
    setArcaneResult(null)
    try {
      const response = await fetch(`/api/character/${character.id}/arcane-recovery-bank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slots: arcanePicks })
      })
      const data = await response.json()
      if (!response.ok) {
        setArcaneError(data?.error || `Banking the recovery failed (HTTP ${response.status})`)
        return
      }
      await refreshCharacterRow()
      const levels = (data.banked?.slots || arcanePicks).join(', ')
      setArcaneResult(`Banked: recover slots of levels ${levels}. It applies at your next short rest in play.${data.replaced ? ' (This replaced your earlier banked recovery.)' : ''}`)
      setArcanePicks([])
      setArcanePickLevel('')
    } catch (err) {
      setArcaneError(`Banking the recovery failed: ${err.message}`)
    } finally {
      setArcaneBusy(false)
    }
  }
  const clearArcaneRecoveryBank = async () => {
    if (arcaneBusy) return
    setArcaneBusy(true)
    setArcaneError(null)
    setArcaneResult(null)
    try {
      const response = await fetch(`/api/character/${character.id}/arcane-recovery-bank`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (!response.ok) {
        setArcaneError(data?.error || `Clearing the bank failed (HTTP ${response.status})`)
        return
      }
      await refreshCharacterRow()
      setArcaneResult(data.cleared ? 'Banked recovery cleared — nothing will change at your next short rest.' : 'No recovery was banked.')
    } catch (err) {
      setArcaneError(`Clearing the bank failed: ${err.message}`)
    } finally {
      setArcaneBusy(false)
    }
  }

  // DM lever for the book status (stolen / destroyed / recovered).
  // This flips the status ONLY — setting 'intact' is a DM override,
  // not the rules flow. The rules flow is "Replace the spellbook"
  // in the Spellbook section (re-transcribe the prepared spells at
  // 1h + 10 gp per level, or restore from the backup book).
  const setSpellbookStatus = async (status) => {
    setStatusBusy(true)
    setStatusError(null)
    try {
      const response = await fetch(`/api/character/${character.id}/spellbook-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      })
      const data = await response.json()
      if (!response.ok) {
        setStatusError(data?.error || `Status change failed (HTTP ${response.status})`)
        return
      }
      setCharacter(data.character)
      onCharacterUpdated?.(data.character)
    } catch (err) {
      setStatusError(`Status change failed: ${err.message}`)
    } finally {
      setStatusBusy(false)
    }
  }

  // Replace a lost spellbook (2026-11-07, V5/V6 2026-11-08):
  // POST /:id/spellbook-replace with { source, spells?,
  // bookMaterials? }. The server derives the new book and enforces
  // gold + clock; the sheet only shows the cost up front and
  // reports the outcome (or the server's refusal, verbatim).
  // - mode 'selected' (memory path): transcribe just the picked
  //   subset — the server accumulates it into the new book while
  //   status stays `lost`, and only flips to `intact` when the
  //   transcribed set covers the prepared list. The panel STAYS
  //   OPEN after a partial transcription, so the next subset can
  //   follow at once; a completed book unmounts the lost-book panel.
  // - mode 'all' (memory path): the old all-at-once flow — no
  //   `spells` list, the server transcribes the whole prepared list.
  // - source 'backup': restore the whole backup at 0 gp, as before.
  // V5: the blank book itself costs — the price of the materials
  // picked in the panel, from the fixed table (standard 50 gp) —
  // charged exactly once per book, on the first memory-path call;
  // the materials key rides that call and is stored with the book.
  // A backup restore never charges it.
  const replaceSpellbook = async (mode = 'selected') => {
    if (replaceBusy) return
    const episode = replaceEpisodeProgress({ state: spellbookState, book: knownSpells, prepared: preparedSpells, alwaysPrepared: spellbookAlwaysPrepared })
    const chargesBookCost = replaceSource === 'memory' && episode.bookCostDue
    if (replaceSource === 'memory' && mode === 'selected' && replaceSelected.length === 0) return
    setReplaceBusy(true)
    setReplaceError(null)
    setReplaceResult(null)
    try {
      const body = { source: replaceSource }
      if (replaceSource === 'memory' && mode === 'selected') body.spells = replaceSelected
      if (chargesBookCost) body.bookMaterials = replaceBookMaterials
      const response = await fetch(`/api/character/${character.id}/spellbook-replace`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await response.json()
      if (!response.ok) {
        setReplaceError(data?.error || `Replacement failed (HTTP ${response.status})`)
        return
      }
      setCharacter(data.character)
      onCharacterUpdated?.(data.character)
      const r = data.replacement
      const bookCostBit = r.bookCostCharged > 0
        ? ` Blank book: ${r.bookCostCharged} gp${r.bookMaterials ? ` (${spellbookMaterialLabel(r.bookMaterials)})` : ''} — charged once.`
        : ''
      const clockBit = `${r.hoursAdvanced} hours passed${r.hoursAdvanced > 0 && !r.clockAdvanced ? ' (the clock did not advance)' : ''}${r.clockError ? ` — clock note: ${r.clockError}` : ''}`
      setReplaceResult(
        r.complete
          ? `New spellbook complete: ${r.bookSpells.join(', ')} — ${r.goldSpent} gp spent (${r.goldRemaining} gp left), ${clockBit}. The book is intact again.${bookCostBit}${r.droppedPrepared?.length ? ` Dropped from prepared (not in the backup): ${r.droppedPrepared.join(', ')}.` : ''}${r.droppedAlwaysPrepared?.length ? ` Dropped always-prepared picks (not in the backup): ${r.droppedAlwaysPrepared.join(', ')}.` : ''}${r.bankCleared ? ' A banked Memorize swap from the lost book was cleared.' : ''}`
          : `Transcribed ${r.spells.join(', ')} into the new book — ${r.goldSpent} gp spent (${r.goldRemaining} gp left), ${clockBit}. Still to transcribe: ${r.remainingSpells.join(', ')}. The book is still lost — a transcribed spell is in the book now, but you still cannot prepare spells or copy new ones in until every prepared spell is transcribed.${bookCostBit}${r.bankCleared ? ' A banked Memorize swap from the lost book was cleared.' : ''}`
      )
      setReplaceSelected([])
      // V6: no panel-close here — the panel stays open after a
      // partial transcription. A completed book flips status to
      // intact, which unmounts the lost-book panel.
    } catch (err) {
      setReplaceError(`Replacement failed: ${err.message}`)
    } finally {
      setReplaceBusy(false)
    }
  }

  // Copy one spell from your own book into the backup spellbook
  // (2026-11-07): POST /:id/spellbook-backup with { spellName }.
  // Same 1h + 10 gp per level as a replacement transcription, gold +
  // clock enforced by the server. The sheet pre-checks gold the way
  // the copy panel does; a server refusal (lost book, spell already
  // in the backup, short gold) is shown verbatim.
  const copySpellIntoBackup = async () => {
    if (!backupSelected || backupBusy) return
    const cost = replaceCostForSpellLevel(backupSelected.level)
    if (!cost) return
    // V5 (2026-11-08): the first copy creates the backup book, so
    // it charges the blank book's price on top of the transcription
    // — the price of the materials picked in the panel, from the
    // fixed table (standard 50 gp). Later copies charge
    // transcription only. The backup book's cost is its own (the
    // stored bookCost describes the main book).
    const isFirstBackupCopy = (spellbookState.backup || []).length === 0
    const backupBookCostValue = spellbookMaterialCost(backupBookMaterials)
    const totalGold = cost.gold + (isFirstBackupCopy ? backupBookCostValue : 0)
    const gold = Number(character.gold_gp) || 0
    if (gold < totalGold) {
      setBackupError(isFirstBackupCopy
        ? `Not enough gold: copying ${backupSelected.name} into the backup (level ${backupSelected.level}) costs ${totalGold} gp (${cost.gold} gp transcription + ${backupBookCostValue} gp for the blank backup book), you have ${gold} gp.`
        : `Not enough gold: copying ${backupSelected.name} into the backup (level ${backupSelected.level}) costs ${cost.gold} gp, you have ${gold} gp.`)
      return
    }
    setBackupBusy(true)
    setBackupError(null)
    setBackupResult(null)
    try {
      const backupBody = { spellName: backupSelected.name }
      if (isFirstBackupCopy) backupBody.bookMaterials = backupBookMaterials
      const response = await fetch(`/api/character/${character.id}/spellbook-backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupBody)
      })
      const data = await response.json()
      if (!response.ok) {
        setBackupError(data?.error || `Backup copy failed (HTTP ${response.status})`)
        return
      }
      setCharacter(data.character)
      onCharacterUpdated?.(data.character)
      setBackupResult(`Copied ${data.backup.spell} (level ${data.backup.spellLevel}) into the backup spellbook — ${data.backup.goldSpent} gp spent (${data.backup.goldRemaining} gp left), ${data.backup.hoursAdvanced} hours passed${data.backup.clockAdvanced ? '' : ' (the clock did not advance)'}${data.backup.clockError ? ` — clock note: ${data.backup.clockError}` : ''}.${data.backup.bookCostCharged > 0 ? ` Blank backup book: ${data.backup.bookCostCharged} gp${data.backup.bookMaterials ? ` (${spellbookMaterialLabel(data.backup.bookMaterials)})` : ''} — charged once.` : ''}`)
      setBackupSelected(null)
      setBackupBookMaterials('standard')
    } catch (err) {
      setBackupError(`Backup copy failed: ${err.message}`)
    } finally {
      setBackupBusy(false)
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

  // Eldritch Knight / Arcane Trickster (2024 PHB, 2026-11-07):
  // third-caster subclasses — the fighter/rogue base classes carry
  // spellcasting: null in classes.json, but these subclasses cast
  // from 3rd level (Int, Wizard list). effectiveSpellcasting is the
  // spellcasting record the spells tab and the getMax*/isPreparedCaster
  // helpers read: the subclass record for EK/AT, the base-class record
  // for everyone else. Below 3rd level there is no casting yet, so
  // the sheet still shows the non-caster branch.
  const isEldritchKnight = classKey === 'fighter' && character.subclass === 'Eldritch Knight'
  const isArcaneTrickster = classKey === 'rogue' && character.subclass === 'Arcane Trickster'
  const isThirdCaster = (isEldritchKnight || isArcaneTrickster) && character.level >= 3
  // Order of the Profane Soul (Blood Hunter, 2024 Rules): the only
  // blood hunter Order that casts — from 3rd level (Int, warlock-like
  // pact casting). Other Orders never cast. Mirrors the isThirdCaster
  // carve-out: the base class carries spellcasting: null, so the
  // subclass is what makes the sheet treat the character as a caster.
  const isProfaneSoul = classKey === 'blood_hunter' && character.subclass === 'Order of the Profane Soul' && character.level >= 3
  const effectiveSpellcasting = classData?.spellcasting || (isThirdCaster ? subclassData?.spellcasting : null)

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
                        subclassData.feyWandererSpells ? 'feyWandererSpells' :
                        subclassData.gloomStalkerSpells ? 'gloomStalkerSpells' :
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

  // Wizard spellbook derivations (2026-11-07). Copy candidates come
  // from the client catalog, gated on the slots the sheet has loaded:
  // until the spell-slots fetch lands only 1st-level spells are
  // offered (a wizard always has 1st-level slots) and the panel says
  // so, rather than offering a level the wizard cannot cast.
  const copySlotLevels = spellSlots
    ? Object.keys(spellSlots.max || {}).filter(l => spellSlots.max[l] > 0).map(Number)
    : [1]
  const copyCandidates = wizardLevel >= 1
    ? copyableSpellCandidates({ spellsByLevel: spellsData.spells, slotLevels: copySlotLevels, bookNames: knownSpells, search: copySearch })
    : []
  const copySelectedCost = copySelected ? copyCostForSpellLevel(copySelected.level) : null
  // A scroll pick carries `scrollName` on copySelected (set by the
  // scroll picker below); a found-book pick does not. The confirm
  // gate and the copy body branch on this, never on separate state.
  const copyIsScroll = Boolean(copySelected?.scrollName)
  const memorizeOpts = wizardLevel >= 1
    ? memorizeSwapOptions({ prepared: preparedSpells, book: knownSpells, alwaysPrepared: spellbookAlwaysPrepared })
    : { oldOptions: [], newOptions: [] }

  // Arcane Recovery picker (2026-11-08): spent slot levels only,
  // from the loaded slot state — a level with 0 used is never
  // offered, 6th+ never offered, each pick consumes its level from
  // the budget (ceil(wizard level / 2)). Until the spell-slots fetch
  // lands the options are empty and the panel says so, rather than
  // offering a level the wizard cannot recover. The picker is
  // disabled while the feature is used (until the next long rest)
  // or a bank call is in flight — the server is the authority at
  // bank time either way.
  const arcaneOpts = wizardLevel >= 1
    ? arcaneRecoveryOptions({ used: spellSlots?.used || {}, max: spellSlots?.max || {}, picked: arcanePicks, budget: arcaneBudget })
    : { options: [], pickedTotal: 0, budgetLeft: null }
  const arcanePickerDisabled = arcaneBusy || spellbookState.arcaneRecoveryUsed === true

  // Spellbook replacement + backup previews (2026-11-07). Spell
  // levels come from the client catalog via getSpellDetails; a spell
  // the catalog cannot price is listed as unknown, never guessed —
  // the server prices it. The memory preview prices the prepared
  // spells + the stored always-prepared picks (gated to L18/L20 by
  // the server route when it saves them, so a stored pick rides the
  // transcription); the backup preview names what a restore would
  // drop from the prepared list.
  const spellLevelOfName = (name) => {
    const details = getSpellDetails(name)
    return details ? spellLevelNumber(details.level) : null
  }
  // Scroll copying (2026-11-08): the wizard's own inventory rows
  // named `Spell Scroll of <Spell>` — the spell rides the row name
  // (D1), so the picker lists rows, not catalog spells. A row is
  // offered only when its spell has a catalog level the sheet can
  // price (level >= 1 — cantrips cannot be copied), is not already
  // in the book, and is of a level the wizard has slots for — the
  // same three gates the found-book candidates apply. A level-named
  // row (`Spell Scroll (1st Level)`) holds no spell and never
  // reaches this list (`spellScrollRows` leaves it out). The server
  // re-reads the row and re-derives the spell — the sheet never
  // trusts its own parse past the picker.
  const scrollRows = wizardLevel >= 1 ? spellScrollRows(inventory) : []
  const scrollCopyCandidates = scrollRows.flatMap((row) => {
    const level = spellLevelOfName(row.spell)
    if (!level || level < 1) return []
    if (!copySlotLevels.includes(level)) return []
    if (knownSpells.some((s) => String(s).toLowerCase() === row.spell.toLowerCase())) return []
    const cost = copyCostForSpellLevel(level)
    return [{ name: row.spell, scrollName: row.name, level, gold: cost.gold, hours: cost.hours, quantity: row.quantity }]
  })
  // V6 (spell by spell, 2026-11-08): the replacement episode —
  // what is already transcribed into the new book, and whether the
  // blank book still has to be paid for. The preview prices only
  // what is still to transcribe (transcribed spells are left out).
  const replaceEpisode = wizardLevel >= 1 && spellbookState.status === 'lost'
    ? replaceEpisodeProgress({ state: spellbookState, book: knownSpells, prepared: preparedSpells, alwaysPrepared: spellbookAlwaysPrepared })
    : { inProgress: false, transcribed: [], bookCostDue: true }
  const replacePreview = wizardLevel >= 1 && spellbookState.status === 'lost'
    ? replacementPreview({ prepared: preparedSpells, alwaysPrepared: spellbookAlwaysPrepared, levelOf: spellLevelOfName, transcribed: replaceEpisode.transcribed })
    : null
  // V5: the blank book's price from the picked materials key
  // (fixed table — standard 50 gp); charged only on the first
  // memory-path call for a book.
  const replaceBookCostValue = spellbookMaterialCost(replaceBookMaterials)
  const replaceChargesBookCost = replaceSource === 'memory' && replaceEpisode.bookCostDue
  const replaceSelectedEntries = replacePreview
    ? replacePreview.entries.filter((e) => replaceSelected.some((s) => String(s).toLowerCase() === String(e.name).toLowerCase()))
    : []
  const replaceSelectedUnknown = replacePreview
    ? replacePreview.unknownLevels.filter((n) => replaceSelected.some((s) => String(s).toLowerCase() === String(n).toLowerCase()))
    : []
  const replaceSelectedGold = replaceSelectedEntries.reduce((a, e) => a + e.gold, 0)
  const replaceSelectedHours = replaceSelectedEntries.reduce((a, e) => a + e.hours, 0)
  const replaceSelectedTotalGold = replaceSelectedGold + (replaceChargesBookCost ? replaceBookCostValue : 0)
  const replaceAllTotalGold = replacePreview
    ? replacePreview.totalGold + (replaceChargesBookCost ? replaceBookCostValue : 0)
    : 0
  const backupRestore = wizardLevel >= 1 && (spellbookState.backup || []).length > 0
    ? backupRestorePreview({ prepared: preparedSpells, backup: spellbookState.backup, alwaysPrepared: spellbookAlwaysPrepared })
    : null
  const backupCopy = wizardLevel >= 1 && spellbookState.status !== 'lost'
    ? backupCopyCandidates({ book: knownSpells, backup: spellbookState.backup || [], levelOf: spellLevelOfName })
    : { candidates: [], unknownLevels: [] }
  const backupSelectedCost = backupSelected ? replaceCostForSpellLevel(backupSelected.level) : null
  // V5 (backup book): the first copy creates the backup book, so
  // it charges the blank book's price on top of the transcription.
  const backupIsFirstCopy = wizardLevel >= 1 && (spellbookState.backup || []).length === 0
  const backupBookCostValue = spellbookMaterialCost(backupBookMaterials)
  const backupCopyTotalGold = backupSelectedCost
    ? backupSelectedCost.gold + (backupIsFirstCopy ? backupBookCostValue : 0)
    : null

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'abilities', label: 'Abilities & Skills' },
    { id: 'features', label: 'Features & Traits' },
    { id: 'progression', label: 'Progression' },
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
            <button
              onClick={() => setShowNicknames(true)}
              style={{
                marginTop: '0.2rem',
                padding: '0.25rem 0.6rem',
                background: 'rgba(217, 70, 239, 0.12)',
                border: '1px solid rgba(217, 70, 239, 0.4)',
                borderRadius: '4px',
                color: '#d946ef',
                fontSize: '0.72rem',
                cursor: 'pointer',
                letterSpacing: '0.03em'
              }}
              title="Manage what each NPC calls this character"
            >
              ✎ Manage names & nicknames
            </button>
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
          {onEditInCreator && (
            <button
              className="button"
              onClick={() => onEditInCreator(character)}
              style={{ background: '#2e86c1' }}
              title="Edit in creator — definition only; level, XP, inventory, and gold are preserved"
            >
              Edit in creator
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="xp-percent">
                      {Math.floor((character.experience / character.experience_to_next_level) * 100)}% to Level {character.level + 1}
                    </div>
                    {character.level < 20 && (
                      <button
                        onClick={() => handleGrantXP(500)}
                        style={{
                          background: '#27ae60',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '0.25rem 0.6rem',
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          fontWeight: '600'
                        }}
                        title="Grant 500 XP"
                      >
                        +500 XP
                      </button>
                    )}
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

        {/* Progression Tab — Theme + Ancestry Feats + Synergies */}
        {activeTab === 'progression' && (
          <div className="tab-panel">
            {progressionLoading && (
              <div style={{ padding: '1rem', opacity: 0.7 }}>Loading progression...</div>
            )}
            {progressionError && (
              <div style={{
                padding: '1rem', background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px',
                color: '#fca5a5'
              }}>
                Failed to load progression: {progressionError}
              </div>
            )}
            {progression && !progression.theme && (
              <div style={{ padding: '1rem', opacity: 0.7 }}>
                This character has no Theme assigned. Themes replace the legacy Background system;
                existing characters have not yet been migrated.
              </div>
            )}
            {progression && progression.theme && (
              <>
                {/* Theme identity section */}
                <section className="sheet-section">
                  <h3 style={{ color: '#8b5cf6' }}>
                    Theme: {progression.theme.theme_name}
                    {progression.theme.path_choice && (
                      <span style={{
                        marginLeft: '0.75rem', fontSize: '0.85em', color: '#a78bfa'
                      }}>
                        ({progression.theme.path_choice.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')})
                      </span>
                    )}
                  </h3>
                  <p style={{ fontStyle: 'italic', opacity: 0.9, marginBottom: '0.5rem' }}>
                    {progression.theme.identity}
                  </p>
                  <p style={{ fontSize: '0.9em', opacity: 0.8 }}>
                    <strong>Signature Skills:</strong> {progression.theme.signature_skill_1}
                    {progression.theme.signature_skill_2 && `, ${progression.theme.signature_skill_2}`}
                  </p>
                  {progression.knight_moral_path && (
                    <p style={{ fontSize: '0.9em', opacity: 0.8, marginTop: '0.5rem' }}>
                      <strong>Moral Path:</strong>{' '}
                      <span style={{ color: '#a78bfa', textTransform: 'capitalize' }}>
                        {progression.knight_moral_path.current_path}
                      </span>
                      {progression.knight_moral_path.last_path_change_reason && (
                        <span style={{ opacity: 0.7, marginLeft: '0.5rem' }}>
                          — {progression.knight_moral_path.last_path_change_reason}
                        </span>
                      )}
                    </p>
                  )}
                </section>

                {/* Theme tier abilities (unlocked + upcoming) */}
                <section className="sheet-section">
                  <h3 style={{ color: '#8b5cf6' }}>Theme Progression</h3>
                  <div className="features-list">
                    {(progression.theme_all_tiers || [])
                      .filter(t => !t.path_variant) // Hide path-variant duplicates; base ability covers both
                      .map(tier => {
                        const unlocked = (progression.theme_unlocks || []).some(u => u.tier === tier.tier)
                        const expectedLevel = tier.tier === 1 ? 1 : tier.tier // L1/L5/L11/L17
                        const canUnlock = (progression.character.level || 1) >= expectedLevel
                        return (
                          <div
                            key={tier.tier}
                            className="feature-item"
                            style={{
                              borderLeft: `3px solid ${unlocked ? '#8b5cf6' : 'rgba(139,92,246,0.3)'}`,
                              opacity: unlocked ? 1 : 0.55
                            }}
                          >
                            <div className="feature-header">
                              <span className="feature-name" style={{ color: unlocked ? '#ddd' : '#aaa' }}>
                                L{expectedLevel}: {tier.ability_name}
                              </span>
                              <span style={{
                                fontSize: '0.75em',
                                color: unlocked ? '#a78bfa' : canUnlock ? '#f59e0b' : '#888',
                                marginLeft: '0.5rem',
                                padding: '0.1rem 0.4rem',
                                background: unlocked
                                  ? 'rgba(139,92,246,0.15)'
                                  : canUnlock
                                    ? 'rgba(245,158,11,0.15)'
                                    : 'rgba(136,136,136,0.1)',
                                border: `1px solid ${unlocked ? 'rgba(139,92,246,0.4)' : canUnlock ? 'rgba(245,158,11,0.4)' : 'rgba(136,136,136,0.3)'}`,
                                borderRadius: '10px'
                              }}>
                                {unlocked ? '✓ Unlocked' : canUnlock ? 'Ready to unlock' : `Level ${expectedLevel}`}
                              </span>
                            </div>
                            <p className="feature-description" style={{ opacity: unlocked ? 1 : 0.8 }}>
                              {tier.ability_description}
                            </p>
                            {tier.mechanics && (
                              <p style={{
                                fontSize: '0.8em', color: '#888', marginTop: '0.3rem',
                                fontStyle: 'italic'
                              }}>
                                {tier.mechanics}
                              </p>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </section>

                {/* Ancestry feats */}
                <section className="sheet-section">
                  <h3 style={{ color: '#14b8a6' }}>Ancestry Feats</h3>
                  {progression.ancestry_feats && progression.ancestry_feats.length > 0 ? (
                    <div className="features-list">
                      {progression.ancestry_feats.map((feat, idx) => (
                        <div
                          key={idx}
                          className="feature-item"
                          style={{ borderLeft: '3px solid #14b8a6' }}
                        >
                          <div className="feature-header">
                            <span className="feature-name">{feat.feat_name}</span>
                            <span style={{
                              fontSize: '0.75em', color: '#14b8a6',
                              marginLeft: '0.5rem', padding: '0.1rem 0.4rem',
                              background: 'rgba(20,184,166,0.15)',
                              border: '1px solid rgba(20,184,166,0.4)',
                              borderRadius: '10px'
                            }}>
                              L{feat.tier} · {feat.list_id.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="feature-description">{feat.description}</p>
                          {feat.mechanics && (
                            <p style={{
                              fontSize: '0.8em', color: '#888', marginTop: '0.3rem',
                              fontStyle: 'italic'
                            }}>
                              {feat.mechanics}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ opacity: 0.6, fontSize: '0.9em' }}>
                      No Ancestry Feats selected yet. (Tiers unlock at L1, L3, L7, L13, L18.)
                    </p>
                  )}
                </section>

                {/* Subclass × Theme Synergy */}
                {progression.subclass_theme_synergy && (
                  <section className="sheet-section">
                    <h3 style={{ color: '#6366f1' }}>
                      Resonant Synergy: {progression.subclass_theme_synergy.synergy_name}
                    </h3>
                    <div
                      className="feature-item"
                      style={{ borderLeft: '3px solid #6366f1' }}
                    >
                      <div className="feature-header">
                        <span className="feature-name">
                          {progression.subclass_theme_synergy.subclass_name} + {progression.theme.theme_name}
                        </span>
                      </div>
                      <p className="feature-description">
                        {progression.subclass_theme_synergy.description}
                      </p>
                      {progression.subclass_theme_synergy.mechanics && (
                        <p style={{
                          fontSize: '0.8em', color: '#888', marginTop: '0.3rem',
                          fontStyle: 'italic'
                        }}>
                          {progression.subclass_theme_synergy.mechanics}
                        </p>
                      )}
                      {progression.subclass_theme_synergy.shared_tags && (
                        <p style={{
                          fontSize: '0.75em', color: '#a5b4fc', marginTop: '0.4rem'
                        }}>
                          <strong>Shared tags:</strong> {progression.subclass_theme_synergy.shared_tags}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {/* Mythic × Theme Amplification */}
                {progression.mythic_theme_amplification && (
                  <section className="sheet-section">
                    <h3 style={{
                      color: progression.mythic_theme_amplification.is_dissonant ? '#ef4444' : '#f59e0b'
                    }}>
                      Mythic {progression.mythic_theme_amplification.is_dissonant ? 'Arc' : 'Amplification'}: {progression.mythic_theme_amplification.combo_name}
                    </h3>
                    <div
                      className="feature-item"
                      style={{
                        borderLeft: `3px solid ${progression.mythic_theme_amplification.is_dissonant ? '#ef4444' : '#f59e0b'}`
                      }}
                    >
                      <p className="feature-description" style={{ fontStyle: 'italic' }}>
                        {progression.mythic_theme_amplification.shared_identity}
                      </p>
                      {progression.mythic_theme_amplification.is_dissonant ? (
                        <>
                          <p style={{ marginTop: '0.5rem' }}>
                            <strong style={{ color: '#ef4444' }}>Dissonant Arc:</strong>{' '}
                            {progression.mythic_theme_amplification.dissonant_arc_description}
                          </p>
                          {progression.mythic_theme_amplification.required_threshold_acts && (
                            <p style={{
                              fontSize: '0.85em', color: '#f87171', marginTop: '0.4rem'
                            }}>
                              Arc completion requires {progression.mythic_theme_amplification.required_threshold_acts} threshold acts.
                            </p>
                          )}
                        </>
                      ) : (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.88em' }}>
                          {['t1_bonus', 't2_bonus', 't3_bonus', 't4_bonus'].map((key, idx) => {
                            const text = progression.mythic_theme_amplification[key]
                            if (!text) return null
                            return (
                              <div key={key} style={{ marginBottom: '0.4rem' }}>
                                <strong style={{ color: '#f59e0b' }}>T{idx + 1}:</strong> {text}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* Spells Tab */}
        {activeTab === 'spells' && (
          <div className="tab-panel">
            {effectiveSpellcasting ? (
              <>
                <section className="sheet-section">
                  <h3>Spellcasting</h3>
                  <div className="spellcasting-info">
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spellcasting Ability</span>
                      <span className="spell-stat-value">{effectiveSpellcasting.ability?.toUpperCase()}</span>
                    </div>
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spell Save DC</span>
                      <span className="spell-stat-value">
                        {8 + Math.ceil(character.level / 4) + 1 + Math.floor((abilities[effectiveSpellcasting.ability?.toLowerCase().slice(0, 3)] - 10) / 2)}
                      </span>
                    </div>
                    <div className="spell-stat">
                      <span className="spell-stat-label">Spell Attack Bonus</span>
                      <span className="spell-stat-value">
                        +{Math.ceil(character.level / 4) + 1 + Math.floor((abilities[effectiveSpellcasting.ability?.toLowerCase().slice(0, 3)] - 10) / 2)}
                      </span>
                    </div>
                  </div>
                </section>

                {/* Spell Slots */}
                {spellSlots && Object.keys(spellSlots.max || {}).length > 0 && (
                  <section className="sheet-section">
                    <h3>{character.class?.toLowerCase() === 'warlock' ? 'Pact Magic Slots' : 'Spell Slots'}</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {Object.entries(spellSlots.max)
                        .filter(([, max]) => max > 0)
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .map(([level, max]) => {
                          const used = spellSlots.used[level] || 0
                          const remaining = max - used
                          const levelLabel = character.class?.toLowerCase() === 'warlock'
                            ? `Level ${level}`
                            : `${level}${level === '1' ? 'st' : level === '2' ? 'nd' : level === '3' ? 'rd' : 'th'}`
                          return (
                            <div key={level} style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem',
                              padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)',
                              borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)'
                            }}>
                              <span style={{
                                minWidth: '36px', fontWeight: '600', fontSize: '0.85rem',
                                color: '#b0b0b0'
                              }}>{levelLabel}</span>
                              <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
                                {Array.from({ length: max }, (_, i) => (
                                  <div key={i} style={{
                                    width: '18px', height: '18px', borderRadius: '50%',
                                    border: '2px solid ' + (i < remaining ? '#6c63ff' : '#444'),
                                    background: i < remaining ? '#6c63ff' : 'transparent',
                                    transition: 'all 0.2s ease'
                                  }} />
                                ))}
                              </div>
                              <span style={{
                                fontSize: '0.8rem', color: '#888', minWidth: '30px', textAlign: 'center'
                              }}>{remaining}/{max}</span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => useSpellSlot(Number(level))}
                                  disabled={remaining <= 0}
                                  style={{
                                    background: remaining > 0 ? '#c0392b' : '#555',
                                    color: '#fff', border: 'none', borderRadius: '4px',
                                    padding: '2px 8px', fontSize: '0.75rem', cursor: remaining > 0 ? 'pointer' : 'not-allowed',
                                    opacity: remaining > 0 ? 1 : 0.5
                                  }}
                                  title="Use a spell slot"
                                >Use</button>
                                <button
                                  onClick={() => restoreSpellSlot(Number(level))}
                                  disabled={used <= 0}
                                  style={{
                                    background: used > 0 ? '#27ae60' : '#555',
                                    color: '#fff', border: 'none', borderRadius: '4px',
                                    padding: '2px 8px', fontSize: '0.75rem', cursor: used > 0 ? 'pointer' : 'not-allowed',
                                    opacity: used > 0 ? 1 : 0.5
                                  }}
                                  title="Restore a spell slot"
                                >+1</button>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  </section>
                )}

                {/* Subclass Spells */}
                {subclassSpells.length > 0 && (
                  <section className="sheet-section">
                    <h3>{character.subclass} Spells</h3>
                    {classKey === 'warlock' ? (
                      <p className="spell-note">These spells are added to your Warlock spell list. They are not always prepared — prepare them like your other Warlock spells.</p>
                    ) : (
                      <p className="spell-note">These spells are always prepared and don't count against your prepared spell limit.</p>
                    )}
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

                {/* Prepared Spells - for Cleric, Druid, Paladin, Wizard, Artificer, Blackguard, Sorcerer, Ranger, Bard, Warlock, Profane Soul, Eldritch Knight / Arcane Trickster */}
                {isPreparedCaster() && (
                  <section className="sheet-section">
                    <h3>Prepared Spells ({preparedSpells.length}/{getMaxPrepared()})</h3>
                    {effectiveSpellcasting?.spellsKnown === 'Spellbook' && (
                      <p className="spell-note" style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                        Wizard: Prepare spells from your spellbook. Spellbook contains {knownSpells.length} spell{knownSpells.length !== 1 ? 's' : ''}.
                        {spellbookState.status === 'lost' ? ' The spellbook is LOST — your prepared spells still work, but they cannot be changed until it is recovered or replaced.' : ''}
                      </p>
                    )}
                    {spellSaveError && (
                      <p style={{ fontSize: '0.8rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{spellSaveError}</p>
                    )}
                    {classKey === 'ranger' && (
                      <p className="spell-note" style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                        Favored Enemy: Hunter&apos;s Mark is always prepared and doesn&apos;t count against your prepared spell limit. You can cast it without expending a spell slot {[2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6][character.level - 1]} time{[2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6][character.level - 1] !== 1 ? 's' : ''} per long rest.
                      </p>
                    )}

                    {/* Currently Prepared */}
                    {preparedSpells.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {preparedSpells.map(spellName => {
                          const details = getSpellDetails(spellName)
                          return (
                            <div key={spellName} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.4rem 0.6rem', background: 'rgba(108,99,255,0.08)',
                              borderRadius: '6px', border: '1px solid rgba(108,99,255,0.2)'
                            }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{spellName}</span>
                                {details && (
                                  <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                    {details.level} • {details.school}
                                  </span>
                                )}
                              </div>
                              <button
                                disabled={effectiveSpellcasting?.spellsKnown === 'Spellbook' && spellbookState.status === 'lost'}
                                onClick={() => {
                                  const newPrepared = preparedSpells.filter(s => s !== spellName)
                                  savePreparedSpells(newPrepared)
                                }}
                                style={{
                                  background: 'transparent', border: 'none', color: '#e74c3c',
                                  cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px'
                                }}
                                title={effectiveSpellcasting?.spellsKnown === 'Spellbook' && spellbookState.status === 'lost' ? 'Spellbook is lost — prepared spells cannot be changed' : 'Unprepare spell'}
                              >×</button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>No spells prepared.</p>
                    )}

                    {/* Prepare Spells Button */}
                    {!showPrepareSpells && (
                      <button
                        disabled={effectiveSpellcasting?.spellsKnown === 'Spellbook' && spellbookState.status === 'lost'}
                        title={effectiveSpellcasting?.spellsKnown === 'Spellbook' && spellbookState.status === 'lost' ? 'Spellbook is lost — prepared spells cannot be changed until it is recovered or replaced' : undefined}
                        onClick={() => {
                          setPendingPrepared([...preparedSpells])
                          setShowPrepareSpells(true)
                          setSpellLevelFilter('all')
                          setSpellSearch('')
                        }}
                        style={{
                          background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                        }}
                      >Prepare Spells</button>
                    )}

                    {/* Prepare Spells Panel */}
                    {showPrepareSpells && (
                      <div style={{
                        border: '1px solid rgba(108,99,255,0.3)', borderRadius: '8px',
                        padding: '1rem', background: 'rgba(108,99,255,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: '600' }}>
                            Preparing: {pendingPrepared.length}/{getMaxPrepared()}
                          </span>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              onClick={() => {
                                savePreparedSpells(pendingPrepared)
                                setShowPrepareSpells(false)
                              }}
                              style={{
                                background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600'
                              }}
                            >Save</button>
                            <button
                              onClick={() => setShowPrepareSpells(false)}
                              style={{
                                background: '#555', color: '#fff', border: 'none', borderRadius: '4px',
                                padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem'
                              }}
                            >Cancel</button>
                          </div>
                        </div>

                        {/* Level Filter */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <button
                            onClick={() => setSpellLevelFilter('all')}
                            style={{
                              background: spellLevelFilter === 'all' ? '#6c63ff' : '#333',
                              color: '#fff', border: 'none', borderRadius: '4px',
                              padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer'
                            }}
                          >All</button>
                          {spellSlots && Object.keys(spellSlots.max || {}).filter(l => spellSlots.max[l] > 0).sort((a, b) => a - b).map(level => {
                            const key = level === '1' ? '1st' : level === '2' ? '2nd' : level === '3' ? '3rd' : `${level}th`
                            return (
                              <button key={level}
                                onClick={() => setSpellLevelFilter(key)}
                                style={{
                                  background: spellLevelFilter === key ? '#6c63ff' : '#333',
                                  color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer'
                                }}
                              >{key}</button>
                            )
                          })}
                        </div>

                        {/* Search */}
                        <input
                          type="text" placeholder="Search spells..."
                          value={spellSearch}
                          onChange={e => setSpellSearch(e.target.value)}
                          style={{
                            width: '100%', padding: '0.4rem 0.6rem', borderRadius: '4px',
                            border: '1px solid #444', background: '#2a2a2a', color: '#eee',
                            fontSize: '0.85rem', marginBottom: '0.5rem', boxSizing: 'border-box'
                          }}
                        />

                        {/* Spell List */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {(() => {
                            const alwaysPrepared = getAlwaysPreparedSpellNames()
                            let spells = getPreparableSpells()
                            if (spellLevelFilter !== 'all') {
                              spells = spells.filter(s => s.spellLevel === spellLevelFilter)
                            }
                            if (spellSearch) {
                              const q = spellSearch.toLowerCase()
                              spells = spells.filter(s => s.name.toLowerCase().includes(q))
                            }
                            // Remove always-prepared spells
                            spells = spells.filter(s => !alwaysPrepared.includes(s.name))
                            if (spells.length === 0) {
                              return <p style={{ color: '#888', fontSize: '0.8rem' }}>No spells available for this filter.</p>
                            }
                            return spells.map(spell => {
                              const isPrepped = pendingPrepared.includes(spell.name)
                              const atMax = pendingPrepared.length >= getMaxPrepared()
                              return (
                                <div key={spell.name} style={{
                                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                                  padding: '0.35rem 0.5rem', borderRadius: '4px',
                                  background: isPrepped ? 'rgba(108,99,255,0.15)' : 'transparent',
                                  cursor: (isPrepped || !atMax) ? 'pointer' : 'not-allowed',
                                  opacity: (!isPrepped && atMax) ? 0.5 : 1
                                }}
                                  onClick={() => {
                                    if (isPrepped) {
                                      setPendingPrepared(prev => prev.filter(s => s !== spell.name))
                                    } else if (!atMax) {
                                      setPendingPrepared(prev => [...prev, spell.name])
                                    }
                                  }}
                                >
                                  <div style={{
                                    width: '16px', height: '16px', borderRadius: '3px',
                                    border: '2px solid ' + (isPrepped ? '#6c63ff' : '#555'),
                                    background: isPrepped ? '#6c63ff' : 'transparent',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: '#fff', fontSize: '10px', flexShrink: 0
                                  }}>{isPrepped ? '✓' : ''}</div>
                                  <div style={{ flex: 1 }}>
                                    <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{spell.name}</span>
                                    <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                                      {spell.spellLevel} • {spell.school}
                                    </span>
                                  </div>
                                </div>
                              )
                            })
                          })()}
                        </div>
                      </div>
                    )}

                    {/* The free-text "+ Add to Spellbook" prompt lived
                        here until 2026-11-07: it wrote any string into
                        known_spells through a bare PUT — no wizard-list
                        check, no level check, no gold or time cost.
                        Book writes now go through the copy panel in
                        the Spellbook section below (POST
                        /:id/copy-spell), which validates all of it. */}
                  </section>
                )}

                {/* Wizard Spellbook (2026-11-07): the book, its status,
                    copying, Spell Mastery / Signature Spells, and
                    Memorize Spell — plus replacing a lost book (from
                    memory, or whole from the backup book) and keeping
                    a backup book. Any character with wizard levels —
                    the book lives in known_spells, and spellbook_json
                    carries status / mastery / signature / backup /
                    replaced. The gate is wizard level, not the
                    primary class: a fighter-first wizard sees this
                    section too. */}
                {wizardLevel >= 1 && (
                  <section className="sheet-section">
                    <h3>Spellbook ({knownSpells.length}/{spellbookSizeForLevel(wizardLevel)} spells)
                      <Tip text="Your spellbook: the spells you OWN. It starts with 6 first-level spells and grows by 2 every wizard level. You prepare spells FROM this book — the prepare picker above only offers book spells. Copy a new spell into it for 50 gold and 2 hours per spell level, from a spellbook you find in play. If the book is lost, your prepared spells still work, but you cannot change them, copy new spells, or swap one on a short rest until it is recovered or replaced." />
                    </h3>
                    {spellbookState.status === 'lost' ? (
                      <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.75rem' }}>
                        <strong>Spellbook: LOST.</strong> Your prepared spells still work — you can cast them — but you cannot change which spells are prepared, copy new spells into the book, or swap a prepared spell on a short rest until the book is recovered or replaced.
                      </p>
                    ) : (
                      <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>
                        Spellbook: intact. {knownSpells.length < spellbookSizeForLevel(wizardLevel) ? `A level-${wizardLevel} wizard's book holds ${spellbookSizeForLevel(wizardLevel)} spells — copy more in below.` : 'The book holds the expected spells for your level.'}
                      </p>
                    )}

                    {/* Replace the spellbook — lost books only. The
                        list below is the OLD book: those spells are
                        gone until re-transcribed (from memory) or
                        restored (from the backup). The cost is shown
                        up front, per spell and in total, before any
                        gold leaves your purse or the clock moves. */}
                    {replaceResult && (
                      <p style={{ fontSize: '0.85rem', color: '#27ae60', marginBottom: '0.75rem' }}>{replaceResult}</p>
                    )}
                    {spellbookState.status === 'lost' && (
                      <>
                        {!showReplacePanel && (
                          <button
                            onClick={() => { setShowReplacePanel(true); setReplaceSource('memory'); setReplaceError(null); setReplaceResult(null); setReplaceSelected([]); setReplaceBookMaterials('standard') }}
                            style={{
                              background: '#8e44ad', color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.75rem'
                            }}
                          >Replace the spellbook</button>
                        )}
                        {showReplacePanel && replacePreview && (
                          <div style={{
                            border: '1px solid rgba(142,68,173,0.4)', borderRadius: '8px',
                            padding: '1rem', background: 'rgba(142,68,173,0.05)', marginBottom: '0.75rem'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                              Replace the spellbook
                              <Tip text="Your old book is gone. A new book holds only what you transcribe into it: the spells you have PREPARED, at 1 hour and 10 gold per spell level — unprepared spells from the old book are lost. If you kept a backup spellbook, restoring from it costs nothing more (you already paid to copy those spells in) and the new book is the whole backup. You can transcribe a few spells at a time: a spell you transcribe lands in the new book at once, but you still cannot prepare spells or copy new ones in while the book is lost — it becomes usable when every prepared spell is transcribed. The blank book itself costs the price of the materials you pick — standard is 50 gold — charged once on the first transcription. The server takes the gold and moves the clock when you confirm — nothing is charged for looking." />
                            </div>
                            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                              The spells below are from the lost book — they are gone until this replacement brings them back.
                            </p>
                            {(spellbookState.backup || []).length > 0 && (
                              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                                <label style={{ fontSize: '0.85rem', cursor: 'pointer' }} title="Transcribe the spells you have prepared into a new book — 1 hour and 10 gold per spell level, per spell. Unprepared spells from the old book are lost.">
                                  <input type="radio" checked={replaceSource === 'memory'} onChange={() => setReplaceSource('memory')} />
                                  {' '}From memory — transcribe my prepared spells
                                </label>
                                <label style={{ fontSize: '0.85rem', cursor: 'pointer' }} title="Restore the whole backup spellbook as your new book — no gold, no time, the copying was already paid for. Prepared spells that are not in the backup are dropped from your prepared list, and the panel names them before you confirm.">
                                  <input type="radio" checked={replaceSource === 'backup'} onChange={() => setReplaceSource('backup')} />
                                  {' '}From my backup spellbook — restore the whole backup
                                </label>
                              </div>
                            )}
                            {replaceSource === 'memory' ? (
                              <>
                                {replaceEpisode.transcribed.length > 0 && (
                                  <p style={{ fontSize: '0.85rem', color: '#27ae60', marginBottom: '0.5rem' }}>
                                    Transcribed so far: {replaceEpisode.transcribed.map(capitalize).join(', ')} — already in the new book.
                                  </p>
                                )}
                                {replacePreview.entries.length === 0 && replacePreview.unknownLevels.length === 0 ? (
                                  <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>
                                    You have no prepared spells to transcribe — a replacement needs prepared spells to copy from.
                                  </p>
                                ) : (
                                  <>
                                    <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                                      Pick the spells to transcribe now — the rest can follow. A spell you transcribe lands in the new book at once, but the book stays lost until every prepared spell is transcribed.
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                      <button
                                        type="button"
                                        onClick={() => setReplaceSelected([...replacePreview.entries.map((e) => e.name), ...replacePreview.unknownLevels])}
                                        title="Pick every spell still to transcribe, so one confirm transcribes them all."
                                        style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}
                                      >Select all remaining</button>
                                      <button
                                        type="button"
                                        onClick={() => setReplaceSelected([])}
                                        title="Clear the picked spells — nothing is transcribed until you confirm."
                                        style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', borderRadius: '4px', padding: '0.25rem 0.6rem', cursor: 'pointer', fontSize: '0.8rem' }}
                                      >Clear</button>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                      {replacePreview.entries.map(e => {
                                        const checked = replaceSelected.some((s) => String(s).toLowerCase() === String(e.name).toLowerCase())
                                        return (
                                          <label key={e.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', cursor: 'pointer' }} title={`Transcribe ${capitalize(e.name)} into the new book — ${e.gold} gp + ${e.hours} h. It lands in the book at once, but the book stays lost until every prepared spell is transcribed.`}>
                                            <span><input type="checkbox" checked={checked} onChange={() => setReplaceSelected((prev) => checked ? prev.filter((s) => String(s).toLowerCase() !== String(e.name).toLowerCase()) : [...prev, e.name])} /> {capitalize(e.name)} <span style={{ color: '#888' }}>level {e.level}</span></span>
                                            <span>{e.gold} gp + {e.hours} h</span>
                                          </label>
                                        )
                                      })}
                                      {replacePreview.unknownLevels.map(name => {
                                        const checked = replaceSelected.some((s) => String(s).toLowerCase() === String(name).toLowerCase())
                                        return (
                                          <label key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', cursor: 'pointer' }} title={`Transcribe ${capitalize(name)} into the new book — the server prices this one, this sheet cannot. It lands in the book at once, but the book stays lost until every prepared spell is transcribed.`}>
                                            <span><input type="checkbox" checked={checked} onChange={() => setReplaceSelected((prev) => checked ? prev.filter((s) => String(s).toLowerCase() !== String(name).toLowerCase()) : [...prev, name])} /> {capitalize(name)}</span>
                                            <span style={{ color: '#888' }}>priced by the server</span>
                                          </label>
                                        )
                                      })}
                                    </div>
                                    {replaceChargesBookCost ? (
                                      <>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                                          <label style={{ fontSize: '0.85rem' }} title="The blank book itself — pick what it is made of; the price is fixed for the materials. Charged once, on the first transcription into a new book. Standard is 50 gold.">
                                            Blank spellbook:{' '}
                                            <select value={replaceBookMaterials} onChange={(e) => setReplaceBookMaterials(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                              {Object.entries(SPELLBOOK_MATERIALS).map(([key, row]) => (
                                                <option key={key} value={key}>{row.label} — {row.cost} gp</option>
                                              ))}
                                            </select>
                                          </label>
                                        </div>
                                      </>
                                    ) : (
                                      <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                                        Blank book: no charge on this replacement — the blank book is charged once, on the first transcription into a new book.
                                      </p>
                                    )}
                                    <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                      Total: {replacePreview.totalGold} gp + {replacePreview.totalHours} hours to transcribe all remaining. You have {Number(character.gold_gp) || 0} gp.
                                      {(Number(character.gold_gp) || 0) < replaceAllTotalGold ? ' Not enough gold.' : ''}
                                    </p>
                                    {replaceSelected.length > 0 && (
                                      <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                        Selected: {replaceSelectedGold} gp + {replaceSelectedHours} hours{replaceChargesBookCost ? ` + ${replaceBookCostValue} gp for the blank book` : ''}{replaceSelectedUnknown.length > 0 ? ` — plus the server's price for ${replaceSelectedUnknown.length} spell${replaceSelectedUnknown.length > 1 ? 's' : ''} it prices` : ''}.
                                      </p>
                                    )}
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                  Restoring from the backup costs 0 gp and 0 hours — the new book is the whole backup:
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                                  {backupRestore.spells.map(name => {
                                    const details = getSpellDetails(name)
                                    return (
                                      <div key={name} style={{ fontSize: '0.85rem' }}>
                                        {capitalize(name)}{details ? <span style={{ color: '#888' }}> — level {spellLevelNumber(details.level)}</span> : ''}
                                      </div>
                                    )
                                  })}
                                </div>
                                {backupRestore.droppedPrepared.length > 0 && (
                                  <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>
                                    These prepared spells are NOT in the backup and will be dropped from your prepared list: {backupRestore.droppedPrepared.map(capitalize).join(', ')}.
                                  </p>
                                )}
                                {backupRestore.droppedAlwaysPrepared.length > 0 && (
                                  <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>
                                    These always-prepared picks are NOT in the backup and will be dropped: {backupRestore.droppedAlwaysPrepared.map(capitalize).join(', ')}.
                                  </p>
                                )}
                              </>
                            )}
                            {replaceError && (
                              <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{replaceError}</p>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button
                                disabled={replaceBusy || (replaceSource === 'memory' && (replaceSelected.length === 0 || !Number.isFinite(replaceSelectedTotalGold) || (Number(character.gold_gp) || 0) < replaceSelectedTotalGold))}
                                onClick={() => replaceSpellbook('selected')}
                                title={replaceSource === 'backup' ? 'Restore the whole backup spellbook as your new book — no gold, no time.' : 'Transcribe just the spells you picked into the new book. The panel stays open so the next few can follow.'}
                                style={{
                                  background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                  opacity: (replaceBusy || (replaceSource === 'memory' && (replaceSelected.length === 0 || !Number.isFinite(replaceSelectedTotalGold) || (Number(character.gold_gp) || 0) < replaceSelectedTotalGold))) ? 0.5 : 1
                                }}
                              >{replaceBusy ? 'Replacing…' : replaceSource === 'backup' ? 'Restore from backup' : `Transcribe selected — ${replaceSelectedTotalGold} gp + ${replaceSelectedHours} h`}</button>
                              {replaceSource === 'memory' && (replacePreview.entries.length > 0 || replacePreview.unknownLevels.length > 0) && (
                                <button
                                  disabled={replaceBusy || !Number.isFinite(replaceAllTotalGold) || (Number(character.gold_gp) || 0) < replaceAllTotalGold}
                                  onClick={() => replaceSpellbook('all')}
                                  title="Transcribe every prepared spell still to transcribe at once — the old all-at-once replacement, including any spells this sheet cannot price."
                                  style={{
                                    background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                    padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                    opacity: (replaceBusy || !Number.isFinite(replaceAllTotalGold) || (Number(character.gold_gp) || 0) < replaceAllTotalGold) ? 0.5 : 1
                                  }}
                                >{replaceBusy ? 'Replacing…' : `Transcribe all remaining — ${replaceAllTotalGold} gp + ${replacePreview.totalHours} h`}</button>
                              )}
                              <button
                                onClick={() => { setShowReplacePanel(false); setReplaceError(null) }}
                                style={{
                                  background: '#555', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem'
                                }}
                              >Cancel</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Book contents: every spell in the book, marked prepared / always prepared */}
                    {knownSpells.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {knownSpells.map(spellName => {
                          const details = getSpellDetails(spellName)
                          const isPrepped = preparedSpells.includes(spellName)
                          const isMastery = spellbookState.mastery.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                          const isSignature = spellbookState.signature.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                          return (
                            <div key={spellName} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.4rem 0.6rem', background: 'rgba(41,128,185,0.08)',
                              borderRadius: '6px', border: '1px solid rgba(41,128,185,0.2)'
                            }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{details?.name || capitalize(spellName)}</span>
                                {details && (
                                  <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                    {details.level} • {details.school}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {isMastery && (
                                  <span style={{ fontSize: '0.7rem', color: '#f39c12', border: '1px solid #f39c12', borderRadius: '4px', padding: '1px 6px' }}>always prepared — Spell Mastery</span>
                                )}
                                {isSignature && (
                                  <span style={{ fontSize: '0.7rem', color: '#f39c12', border: '1px solid #f39c12', borderRadius: '4px', padding: '1px 6px' }}>always prepared — Signature Spells</span>
                                )}
                                {isPrepped && !isMastery && !isSignature && (
                                  <span style={{ fontSize: '0.7rem', color: '#6c63ff', border: '1px solid #6c63ff', borderRadius: '4px', padding: '1px 6px' }}>★ prepared</span>
                                )}
                                {!isPrepped && !isMastery && !isSignature && (
                                  <span style={{ fontSize: '0.7rem', color: '#888' }}>in book</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>The spellbook is empty.</p>
                    )}

                    {/* Copy a spell into the book */}
                    {spellbookState.status === 'lost' ? (
                      <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>
                        Copying is unavailable while the spellbook is lost.
                      </p>
                    ) : (
                      <>
                        {!showCopyPanel && (
                          <button
                            onClick={() => { setShowCopyPanel(true); setCopySearch(''); setCopySelected(null); setCopySource(''); setCopyError(null); setCopyResult(null) }}
                            style={{
                              background: '#2980b9', color: '#fff', border: 'none', borderRadius: '6px',
                              padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                            }}
                          >Copy a spell into your spellbook</button>
                        )}
                        {copyResult && (
                          <p style={{ fontSize: '0.85rem', color: '#27ae60', marginTop: '0.5rem' }}>{copyResult}</p>
                        )}
                        {showCopyPanel && (
                          <div style={{
                            border: '1px solid rgba(41,128,185,0.3)', borderRadius: '8px',
                            padding: '1rem', background: 'rgba(41,128,185,0.05)', marginTop: '0.75rem'
                          }}>
                            <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                              Copy a spell
                              <Tip text="Copy a spell into your book from a spellbook you find in play or from a spell scroll in your inventory: 50 gold and 2 hours per spell level, taken by the server when you confirm — the gold leaves your purse and the game clock moves. The spell must be on the Wizard list, of a level you can cast, and not already in your book. A scroll copy consumes the scroll — pick a row named Spell Scroll of Fireball below; a scroll named only by its level, like Spell Scroll (1st Level), holds no spell and cannot be copied from. A Hedge Mage keeps the scroll (Nothing to Waste)." />
                            </div>
                            {!spellSlots && (
                              <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                                Spell slots are still loading — only 1st-level spells are offered until they load.
                              </p>
                            )}
                            {scrollRows.length > 0 && (
                              <div style={{ marginBottom: '0.5rem' }}>
                                <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                  From a spell scroll in your inventory
                                  <Tip text="A scroll copy consumes the scroll — the spell goes into your book at the same 50 gold and 2 hours per spell level. Pick the scroll and the spell is fixed by it; a Hedge Mage keeps the scroll instead (Nothing to Waste)." />
                                </div>
                                {scrollCopyCandidates.length === 0 ? (
                                  <p style={{ color: '#888', fontSize: '0.8rem' }}>Your scrolls hold no spell you can copy yet — a scroll named only by its level holds no spell, and a spell already in your book or above a level you can cast is not offered.</p>
                                ) : scrollCopyCandidates.map((c, idx) => {
                                  const selected = copySelected?.scrollName === c.scrollName
                                  return (
                                    <div key={`${c.scrollName}::${idx}`} style={{
                                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                                      padding: '0.35rem 0.5rem', borderRadius: '4px',
                                      background: selected ? 'rgba(41,128,185,0.15)' : 'transparent',
                                      cursor: 'pointer'
                                    }}
                                      onClick={() => { setCopySelected(c); setCopyError(null) }}
                                    >
                                      <div style={{
                                        width: '16px', height: '16px', borderRadius: '3px',
                                        border: '2px solid ' + (selected ? '#2980b9' : '#555'),
                                        background: selected ? '#2980b9' : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        color: '#fff', fontSize: '10px', flexShrink: 0
                                      }}>{selected ? '✓' : ''}</div>
                                      <div style={{ flex: 1 }}>
                                        <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{c.scrollName}{c.quantity > 1 ? ` ×${c.quantity}` : ''}</span>
                                        <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                                          {c.name} • level {c.level} • {c.gold} gp + {c.hours} h — the scroll is consumed
                                        </span>
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                            <div style={{ fontWeight: '600', fontSize: '0.85rem', marginBottom: '0.25rem' }}>From a found spellbook</div>
                            <input
                              type="text" placeholder="Search spells..."
                              value={copySearch}
                              onChange={e => setCopySearch(e.target.value)}
                              style={{
                                width: '100%', padding: '0.4rem 0.6rem', borderRadius: '4px',
                                border: '1px solid #444', background: '#2a2a2a', color: '#eee',
                                fontSize: '0.85rem', marginBottom: '0.5rem', boxSizing: 'border-box'
                              }}
                            />
                            <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '0.5rem' }}>
                              {copyCandidates.length === 0 ? (
                                <p style={{ color: '#888', fontSize: '0.8rem' }}>No spells available to copy for this filter — every spell of a level you can cast is already in your book.</p>
                              ) : copyCandidates.map(c => {
                                const selected = copySelected?.name === c.name
                                return (
                                  <div key={c.name} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                                    padding: '0.35rem 0.5rem', borderRadius: '4px',
                                    background: selected ? 'rgba(41,128,185,0.15)' : 'transparent',
                                    cursor: 'pointer'
                                  }}
                                    onClick={() => { setCopySelected(c); setCopyError(null) }}
                                  >
                                    <div style={{
                                      width: '16px', height: '16px', borderRadius: '3px',
                                      border: '2px solid ' + (selected ? '#2980b9' : '#555'),
                                      background: selected ? '#2980b9' : 'transparent',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      color: '#fff', fontSize: '10px', flexShrink: 0
                                    }}>{selected ? '✓' : ''}</div>
                                    <div style={{ flex: 1 }}>
                                      <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{c.name}</span>
                                      <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                                        level {c.level} • {c.school} • {c.gold} gp + {c.hours} h
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {copyIsScroll ? (
                              <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                Copying from {copySelected.scrollName} — the scroll is consumed.
                              </p>
                            ) : (
                              <input
                                type="text" placeholder="Copied from — name the spellbook (e.g. the dead wizard's spellbook)"
                                value={copySource}
                                onChange={e => setCopySource(e.target.value)}
                                style={{
                                  width: '100%', padding: '0.4rem 0.6rem', borderRadius: '4px',
                                  border: '1px solid #444', background: '#2a2a2a', color: '#eee',
                                  fontSize: '0.85rem', marginBottom: '0.5rem', boxSizing: 'border-box'
                                }}
                              />
                            )}
                            {copySelected && copySelectedCost && (
                              <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                Copying {copySelected.name} (level {copySelected.level}) costs {copySelectedCost.gold} gp and {copySelectedCost.hours} hours. You have {Number(character.gold_gp) || 0} gp.
                                {(Number(character.gold_gp) || 0) < copySelectedCost.gold ? ' Not enough gold.' : ''}
                              </p>
                            )}
                            {copyError && (
                              <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{copyError}</p>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              <button
                                disabled={!copySelected || (!copyIsScroll && !copySource.trim()) || copyBusy || (copySelectedCost && (Number(character.gold_gp) || 0) < copySelectedCost.gold)}
                                onClick={copySpellIntoBook}
                                style={{
                                  background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                  opacity: (!copySelected || (!copyIsScroll && !copySource.trim()) || copyBusy) ? 0.5 : 1
                                }}
                              >{copyBusy ? 'Copying…' : 'Copy it'}</button>
                              <button
                                onClick={() => { setShowCopyPanel(false); setCopySelected(null); setCopySource(''); setCopyError(null) }}
                                style={{
                                  background: '#555', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem'
                                }}
                              >Cancel</button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Backup spellbook — the second book (2026-11-07).
                        Copy spells from your own book into it while the
                        main book is intact; if the main book is ever
                        lost, "Replace the spellbook" above can restore
                        the whole backup at no further cost. */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        Backup spellbook
                        <Tip text="A second book holding copies of spells from your own book — 1 hour and 10 gold per spell level to copy a spell into it, while your main book is intact. The first copy also pays for the blank backup book itself — the price of the materials you pick, standard is 50 gold. Many wizards keep one: if the main book is lost, restoring from the backup costs nothing more and the new book is the whole backup. The backup itself is never consumed by a restore — you keep it." />
                      </div>
                      {(spellbookState.backup || []).length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                          {(spellbookState.backup || []).map(name => {
                            const details = getSpellDetails(name)
                            return (
                              <div key={name} style={{ fontSize: '0.85rem' }}>
                                {capitalize(name)}{details ? <span style={{ color: '#888' }}> — level {spellLevelNumber(details.level)}</span> : ''}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          No backup spellbook yet — copy spells from your book below to start one.
                        </p>
                      )}
                      {spellbookState.status === 'lost' ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          Copying into the backup is unavailable while the spellbook is lost — you cannot copy from a book you do not have.
                        </p>
                      ) : backupCopy.candidates.length === 0 ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          No spells in the book to copy into the backup — every book spell is already backed up.
                        </p>
                      ) : (
                        <>
                          {backupIsFirstCopy && (
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.85rem' }} title="The blank backup book itself — pick what it is made of; the price is fixed for the materials. Charged once, on the first copy into a new backup book. Standard is 50 gold.">
                                Blank backup book:{' '}
                                <select value={backupBookMaterials} onChange={(e) => setBackupBookMaterials(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                  {Object.entries(SPELLBOOK_MATERIALS).map(([key, row]) => (
                                    <option key={key} value={key}>{row.label} — {row.cost} gp</option>
                                  ))}
                                </select>
                              </label>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem' }} title="A spell from your own book to copy into the backup. It must already be in your main book, and not already in the backup. Copying costs 1 hour and 10 gold per spell level.">
                              Copy into backup{' '}
                              <select value={backupSelected?.name || ''} onChange={e => { const found = backupCopy.candidates.find(c => c.name === e.target.value); setBackupSelected(found || null); setBackupError(null) }} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                <option value="">— spell from your book —</option>
                                {backupCopy.candidates.map(c => (
                                  <option key={c.name} value={c.name}>{capitalize(c.name)} — level {c.level} • {c.gold} gp + {c.hours} h</option>
                                ))}
                              </select>
                            </label>
                            <button
                              disabled={!backupSelected || backupBusy || (backupCopyTotalGold != null && (Number(character.gold_gp) || 0) < backupCopyTotalGold)}
                              onClick={copySpellIntoBackup}
                              title="Copy this spell into the backup spellbook. The server takes the gold and moves the clock when you confirm — 1 hour and 10 gold per spell level, plus the blank backup book on the first copy."
                              style={{
                                background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                opacity: (!backupSelected || backupBusy) ? 0.5 : 1
                              }}
                            >{backupBusy ? 'Copying…' : 'Copy into backup'}</button>
                          </div>
                          {backupSelected && backupSelectedCost && backupCopyTotalGold != null && (
                            <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                              Copying {backupSelected.name} (level {backupSelected.level}) into the backup costs {backupCopyTotalGold} gp and {backupSelectedCost.hours} hours{backupIsFirstCopy ? ` — ${backupSelectedCost.gold} gp transcription + ${backupBookCostValue} gp for the blank backup book` : ''}. You have {Number(character.gold_gp) || 0} gp.
                              {(Number(character.gold_gp) || 0) < backupCopyTotalGold ? ' Not enough gold.' : ''}
                            </p>
                          )}
                          {backupCopy.unknownLevels.length > 0 && (
                            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                              The server also prices these book spells, which this sheet cannot price: {backupCopy.unknownLevels.map(capitalize).join(', ')}.
                            </p>
                          )}
                          {backupError && (
                            <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{backupError}</p>
                          )}
                          {backupResult && (
                            <p style={{ fontSize: '0.85rem', color: '#27ae60', marginBottom: '0.5rem' }}>{backupResult}</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Spell Mastery (L18) / Signature Spells (L20) */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        Always prepared — Spell Mastery &amp; Signature Spells
                        <Tip text="Two spells each, always prepared, that never count against your prepared limit. Spell Mastery opens at wizard level 18; Signature Spells at level 20. Picks must already be in your spellbook, and a spell cannot be both. They are prepared by the feature — they are not added to your prepared list above." />
                      </div>
                      {wizardLevel < SPELL_MASTERY_LEVEL ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          Spell Mastery opens at wizard level {SPELL_MASTERY_LEVEL} (you are wizard level {wizardLevel}); Signature Spells at level {SIGNATURE_SPELLS_LEVEL}.
                        </p>
                      ) : (
                        <>
                          <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                            Spell Mastery (level {SPELL_MASTERY_LEVEL}+, pick up to {SPELL_MASTERY_MAX})
                          </div>
                          {knownSpells.length === 0 ? (
                            <p style={{ fontSize: '0.8rem', color: '#888' }}>No spells in the book to pick from.</p>
                          ) : knownSpells.map(spellName => {
                            const details = getSpellDetails(spellName)
                            if (details && spellLevelNumber(details.level) < 1) return null
                            const checked = masteryPicks.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                            const inOther = signaturePicks.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                            const atMax = masteryPicks.length >= SPELL_MASTERY_MAX && !checked
                            return (
                              <label key={`mastery-${spellName}`} style={{ display: 'block', fontSize: '0.85rem', margin: '4px 0', opacity: (inOther || atMax) ? 0.55 : 1 }}>
                                <input type="checkbox" disabled={inOther || atMax} checked={checked} onChange={() => toggleAlwaysPrepared('mastery', spellName)} />
                                {' '}{details?.name || capitalize(spellName)}{inOther ? ' — already a Signature Spell' : ''}
                              </label>
                            )
                          })}
                          {wizardLevel < SIGNATURE_SPELLS_LEVEL ? (
                            <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                              Signature Spells open at wizard level {SIGNATURE_SPELLS_LEVEL} (you are wizard level {wizardLevel}).
                            </p>
                          ) : (
                            <>
                              <div style={{ fontSize: '0.85rem', fontWeight: '600', marginTop: '0.5rem', marginBottom: '0.25rem' }}>
                                Signature Spells (level {SIGNATURE_SPELLS_LEVEL}+, pick up to {SIGNATURE_SPELLS_MAX})
                              </div>
                              {knownSpells.map(spellName => {
                                const details = getSpellDetails(spellName)
                                if (details && spellLevelNumber(details.level) < 1) return null
                                const checked = signaturePicks.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                                const inOther = masteryPicks.some(s => String(s).toLowerCase() === String(spellName).toLowerCase())
                                const atMax = signaturePicks.length >= SIGNATURE_SPELLS_MAX && !checked
                                return (
                                  <label key={`signature-${spellName}`} style={{ display: 'block', fontSize: '0.85rem', margin: '4px 0', opacity: (inOther || atMax) ? 0.55 : 1 }}>
                                    <input type="checkbox" disabled={inOther || atMax} checked={checked} onChange={() => toggleAlwaysPrepared('signature', spellName)} />
                                    {' '}{details?.name || capitalize(spellName)}{inOther ? ' — already a Spell Mastery pick' : ''}
                                  </label>
                                )
                              })}
                            </>
                          )}
                          {alwaysPreparedError && (
                            <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginTop: '0.5rem' }}>{alwaysPreparedError}</p>
                          )}
                          {alwaysPreparedResult && (
                            <p style={{ fontSize: '0.85rem', color: '#27ae60', marginTop: '0.5rem' }}>{alwaysPreparedResult}</p>
                          )}
                          <button
                            onClick={saveAlwaysPrepared}
                            style={{
                              background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                              padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600', marginTop: '0.5rem'
                            }}
                          >Save always-prepared picks</button>
                        </>
                      )}
                    </div>

                    {/* Memorize Spell (L5, banked Short Rest swap) */}
                    <div style={{ marginTop: '1rem' }}>
                      <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                        Memorize Spell — bank a Short Rest swap
                        <Tip text="Bank a swap now; it applies at your NEXT short rest in play, when the DM narrates the rest. Banking changes nothing yet — no HP, no slots, no prepared list — and a long rest leaves the bank waiting. The DM's short rest heals only through hit dice (there is no flat half-HP heal any more), and the swap is checked again at the rest, so if the book changed since banking a refused swap simply clears the bank. Always-prepared spells (Spell Mastery / Signature Spells) can never be swapped out. Banking a second swap replaces the first." />
                      </div>
                      {wizardLevel < 5 ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          Memorize Spell opens at wizard level 5 (you are wizard level {wizardLevel}).
                        </p>
                      ) : spellbookState.status === 'lost' ? (
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          Unavailable while the spellbook is lost — prepared spells cannot be changed.
                        </p>
                      ) : (
                        <>
                          {spellbookState.pendingMemorizeSwap && (
                            <p style={{ fontSize: '0.85rem', color: '#6c63ff', marginBottom: '0.5rem' }}>
                              Banked: swap {capitalize(spellbookState.pendingMemorizeSwap.oldSpell)} for {capitalize(spellbookState.pendingMemorizeSwap.newSpell)} — applies at your next short rest in play.{' '}
                              <button
                                disabled={memorizeBusy}
                                onClick={clearMemorizeBank}
                                title="Clear the banked swap. Nothing changes at your next short rest — your prepared spells stay exactly as they are. You can bank a different swap afterwards."
                                style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', padding: 0 }}
                              >Clear bank</button>
                            </p>
                          )}
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <label style={{ fontSize: '0.85rem' }} title="The prepared spell to swap out. Always-prepared spells (Spell Mastery / Signature Spells) are never offered here — they cannot be swapped out.">
                              Swap out{' '}
                              <select value={memorizeOld} onChange={e => setMemorizeOld(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                <option value="">— prepared spell —</option>
                                {memorizeOpts.oldOptions.map(n => (
                                  <option key={n} value={n}>{capitalize(n)}</option>
                                ))}
                              </select>
                            </label>
                            <label style={{ fontSize: '0.85rem' }} title="The spell from your book to swap in. Only book spells you have not already prepared are offered — a spell already prepared cannot be swapped in, and cantrips cannot be swapped in.">
                              for{' '}
                              <select value={memorizeNew} onChange={e => setMemorizeNew(e.target.value)} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                <option value="">— spell from the book —</option>
                                {memorizeOpts.newOptions.map(n => (
                                  <option key={n} value={n}>{capitalize(n)}</option>
                                ))}
                              </select>
                            </label>
                            <button
                              disabled={!memorizeOld || !memorizeNew || memorizeBusy}
                              onClick={bankMemorizeSwap}
                              title="Bank this swap. Nothing changes yet — the swap applies at your next short rest in play, when the DM narrates the rest. Banking a second swap replaces the first."
                              style={{
                                background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '4px',
                                padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                opacity: (!memorizeOld || !memorizeNew || memorizeBusy) ? 0.5 : 1
                              }}
                            >{memorizeBusy ? 'Banking…' : 'Bank swap for next short rest'}</button>
                          </div>
                          <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                            Banking only stores the pick. The swap applies at your next short rest in play — the DM&apos;s short rest heals through hit dice only, and a long rest leaves the bank waiting.
                          </p>
                          {memorizeError && (
                            <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{memorizeError}</p>
                          )}
                          {memorizeResult && (
                            <p style={{ fontSize: '0.85rem', color: '#27ae60', marginBottom: '0.5rem' }}>{memorizeResult}</p>
                          )}
                        </>
                      )}
                    </div>

                    {/* Arcane Recovery (wizard L1, banked Short Rest recovery) */}
                    {wizardLevel >= 1 && (
                      <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>
                          Arcane Recovery — recover spent slots on a Short Rest
                          <Tip text="Once per long rest, when you finish a short rest, recover spent spell slots adding up to half your wizard level (rounded up) in combined slot levels — never a slot of 6th level or higher. Bank the pick now; it applies at your NEXT short rest in play, when the DM narrates the rest. Banking changes nothing yet — no HP, no slots, no prepared list — and a long rest leaves the bank waiting while it refreshes the feature for use again. Losing your spellbook doesn't stop this — it recovers slots you already spent, it doesn't change your prepared spells. Banking a second recovery replaces the first." />
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                          Recover up to {arcaneBudget} slot level{arcaneBudget === 1 ? '' : 's'} at wizard level {wizardLevel}.
                        </p>
                        {spellbookState.arcaneRecoveryUsed && (
                          <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }} title="You already recovered slots on a short rest since your last long rest. The feature comes back after your next long rest — a banked recovery cannot be placed until then.">
                            Arcane Recovery used — returns after your next long rest.
                          </p>
                        )}
                        {!spellbookState.arcaneRecoveryUsed && spellbookState.pendingArcaneRecovery && (
                          <p style={{ fontSize: '0.85rem', color: '#6c63ff', marginBottom: '0.5rem' }}>
                            Banked: recover slots of levels {spellbookState.pendingArcaneRecovery.slots.join(', ')} — applies at your next short rest in play.{' '}
                            <button
                              disabled={arcaneBusy}
                              onClick={clearArcaneRecoveryBank}
                              title="Clear the banked recovery. Nothing changes at your next short rest — your spent slots stay spent. You can bank a different recovery afterwards."
                              style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', padding: 0 }}
                            >Clear bank</button>
                          </p>
                        )}
                        {!spellSlots ? (
                          <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                            Spell slots are still loading — picks appear once they load.
                          </p>
                        ) : (
                          <>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.5rem' }}>
                              <label style={{ fontSize: '0.85rem' }} title="A spent slot level to recover. Only levels with at least one spent slot are offered — a level with nothing spent has nothing to recover — and 6th-level slots and higher are never offered, because Arcane Recovery cannot recover them. Each pick spends its level from your budget.">
                                Recover{' '}
                                <select value={arcanePickLevel} onChange={e => setArcanePickLevel(e.target.value)} disabled={arcanePickerDisabled} style={{ padding: '4px 6px', fontSize: '0.85rem', background: '#2a2a2a', color: '#eee', border: '1px solid #444', borderRadius: '4px' }}>
                                  <option value="">— spent slot level —</option>
                                  {arcaneOpts.options.filter(o => o.remaining > 0).map(o => (
                                    <option key={o.level} value={o.level}>{o.label}-level slot ({o.spent} spent{o.picked > 0 ? `, ${o.picked} picked` : ''})</option>
                                  ))}
                                </select>
                              </label>
                              <button
                                disabled={!arcanePickLevel || arcanePickerDisabled}
                                onClick={addArcanePick}
                                title="Add this slot level to the recovery. Each pick spends its level from your budget — a 2nd-level slot spends 2 of it — and a pick that would go over budget is refused, not trimmed."
                                style={{
                                  background: '#6c63ff', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                  opacity: (!arcanePickLevel || arcanePickerDisabled) ? 0.5 : 1
                                }}
                              >Add to recovery</button>
                              <button
                                disabled={arcanePicks.length === 0 || arcanePickerDisabled}
                                onClick={bankArcaneRecovery}
                                title="Bank this recovery. Nothing changes yet — the slots come back at your next short rest in play, when the DM narrates the rest. Banking a second recovery replaces the first."
                                style={{
                                  background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '600',
                                  opacity: (arcanePicks.length === 0 || arcanePickerDisabled) ? 0.5 : 1
                                }}
                              >{arcaneBusy ? 'Banking…' : 'Bank recovery for next short rest'}</button>
                            </div>
                            {arcanePicks.length > 0 && (
                              <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                Recovering {arcaneOpts.pickedTotal} of {arcaneBudget} slot levels:{' '}
                                {arcanePicks.map((level, i) => (
                                  <button
                                    key={i}
                                    onClick={() => removeArcanePick(i)}
                                    title={`Remove this ${spellLevelLabel(level)}-level slot from the recovery. Nothing is banked until you press the bank button.`}
                                    style={{ background: 'none', border: '1px solid #888', color: '#eee', borderRadius: '4px', cursor: 'pointer', fontSize: '0.8rem', padding: '0.1rem 0.4rem', marginRight: '0.25rem' }}
                                  >× {spellLevelLabel(level)}</button>
                                ))}
                              </p>
                            )}
                            <p style={{ fontSize: '0.8rem', color: '#888', marginBottom: '0.5rem' }}>
                              Banking only stores the pick. The slots come back at your next short rest in play, and a long rest leaves the bank waiting while it refreshes the feature. Losing your spellbook doesn&apos;t stop this — it recovers slots you already spent, it doesn&apos;t change your prepared spells.
                            </p>
                          </>
                        )}
                        {arcaneError && (
                          <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{arcaneError}</p>
                        )}
                        {arcaneResult && (
                          <p style={{ fontSize: '0.85rem', color: '#27ae60', marginBottom: '0.5rem' }}>{arcaneResult}</p>
                        )}
                      </div>
                    )}

                    {/* DM status lever */}
                    <div style={{ marginTop: '1rem', borderTop: '1px solid #444', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        DM: spellbook status
                        <Tip text="A DM lever for when the book is stolen, destroyed, or recovered outside the discard flow. This flips the status ONLY — setting it back to intact is a DM override, not the rules flow: it does not transcribe a replacement book. The rules flow is 'Replace the spellbook' above, while the book is lost." />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button
                          disabled={statusBusy || spellbookState.status === 'lost'}
                          onClick={() => setSpellbookStatus('lost')}
                          style={{ background: 'transparent', color: '#e74c3c', border: '1px solid #e74c3c', borderRadius: '4px', padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem' }}
                        >Mark book lost</button>
                        <button
                          disabled={statusBusy || spellbookState.status === 'intact'}
                          onClick={() => setSpellbookStatus('intact')}
                          style={{ background: 'transparent', color: '#27ae60', border: '1px solid #27ae60', borderRadius: '4px', padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem' }}
                        >Mark book recovered</button>
                      </div>
                      {statusError && (
                        <p style={{ fontSize: '0.85rem', color: '#e74c3c', marginTop: '0.5rem' }}>{statusError}</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Known Spells - for Bard, Warlock */}
                {isKnownCaster() && (
                  <section className="sheet-section">
                    <h3>Known Spells ({knownSpells.length}
                      {effectiveSpellcasting?.spellsKnownByLevel && (
                        <span>/{effectiveSpellcasting.spellsKnownByLevel[character.level - 1] || '?'}</span>
                      )}
                    )</h3>
                    {spellSaveError && (
                      <p style={{ fontSize: '0.8rem', color: '#e74c3c', marginBottom: '0.5rem' }}>{spellSaveError}</p>
                    )}

                    {/* Known Spells List */}
                    {knownSpells.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        {knownSpells.map(spellName => {
                          const details = getSpellDetails(spellName)
                          return (
                            <div key={spellName} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.4rem 0.6rem', background: 'rgba(46,204,113,0.08)',
                              borderRadius: '6px', border: '1px solid rgba(46,204,113,0.2)'
                            }}>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: '600', fontSize: '0.9rem' }}>{spellName}</span>
                                {details && (
                                  <span style={{ color: '#888', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                                    {details.level} • {details.school}
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => {
                                  if (confirm(`Forget ${spellName}?`)) {
                                    saveKnownSpells(knownSpells.filter(s => s !== spellName))
                                  }
                                }}
                                style={{
                                  background: 'transparent', border: 'none', color: '#e74c3c',
                                  cursor: 'pointer', fontSize: '1.1rem', padding: '0 4px'
                                }}
                                title="Forget spell"
                              >×</button>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>No spells known yet.</p>
                    )}

                    {/* Learn Spell Button */}
                    {!showLearnSpell && effectiveSpellcasting?.spellsKnownByLevel &&
                      knownSpells.length < (effectiveSpellcasting.spellsKnownByLevel[character.level - 1] || 0) && (
                      <button
                        onClick={() => {
                          setShowLearnSpell(true)
                          setSpellLevelFilter('all')
                          setSpellSearch('')
                        }}
                        style={{
                          background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '6px',
                          padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                        }}
                      >+ Learn New Spell ({(effectiveSpellcasting.spellsKnownByLevel[character.level - 1] || 0) - knownSpells.length} remaining)</button>
                    )}

                    {/* Learn Spell Panel */}
                    {showLearnSpell && (
                      <div style={{
                        border: '1px solid rgba(46,204,113,0.3)', borderRadius: '8px',
                        padding: '1rem', background: 'rgba(46,204,113,0.05)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: '600' }}>Learn a Spell</span>
                          <button
                            onClick={() => setShowLearnSpell(false)}
                            style={{
                              background: '#555', color: '#fff', border: 'none', borderRadius: '4px',
                              padding: '0.3rem 0.8rem', cursor: 'pointer', fontSize: '0.8rem'
                            }}
                          >Close</button>
                        </div>

                        {/* Level Filter */}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                          <button
                            onClick={() => setSpellLevelFilter('all')}
                            style={{
                              background: spellLevelFilter === 'all' ? '#2ecc71' : '#333',
                              color: '#fff', border: 'none', borderRadius: '4px',
                              padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer'
                            }}
                          >All</button>
                          {spellSlots && Object.keys(spellSlots.max || {}).filter(l => spellSlots.max[l] > 0).sort((a, b) => a - b).map(level => {
                            const key = level === '1' ? '1st' : level === '2' ? '2nd' : level === '3' ? '3rd' : `${level}th`
                            return (
                              <button key={level}
                                onClick={() => setSpellLevelFilter(key)}
                                style={{
                                  background: spellLevelFilter === key ? '#2ecc71' : '#333',
                                  color: '#fff', border: 'none', borderRadius: '4px',
                                  padding: '2px 8px', fontSize: '0.75rem', cursor: 'pointer'
                                }}
                              >{key}</button>
                            )
                          })}
                        </div>

                        {/* Search */}
                        <input
                          type="text" placeholder="Search spells..."
                          value={spellSearch}
                          onChange={e => setSpellSearch(e.target.value)}
                          style={{
                            width: '100%', padding: '0.4rem 0.6rem', borderRadius: '4px',
                            border: '1px solid #444', background: '#2a2a2a', color: '#eee',
                            fontSize: '0.85rem', marginBottom: '0.5rem', boxSizing: 'border-box'
                          }}
                        />

                        {/* Available Spells */}
                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                          {(() => {
                            const className = character.class?.toLowerCase()
                            let spells = []
                            if (spellSlots) {
                              for (const [level, max] of Object.entries(spellSlots.max || {})) {
                                if (max <= 0) continue
                                const levelKey = level === '1' ? '1st' : level === '2' ? '2nd' : level === '3' ? '3rd' : `${level}th`
                                const levelSpells = (spellsData.spells[levelKey] || []).filter(s => s.classes?.includes(className))
                                levelSpells.forEach(s => spells.push({ ...s, spellLevel: levelKey }))
                              }
                            }
                            // Filter out already known
                            spells = spells.filter(s => !knownSpells.includes(s.name))
                            if (spellLevelFilter !== 'all') {
                              spells = spells.filter(s => s.spellLevel === spellLevelFilter)
                            }
                            if (spellSearch) {
                              const q = spellSearch.toLowerCase()
                              spells = spells.filter(s => s.name.toLowerCase().includes(q))
                            }
                            if (spells.length === 0) {
                              return <p style={{ color: '#888', fontSize: '0.8rem' }}>No spells available.</p>
                            }
                            return spells.map(spell => (
                              <div key={spell.name} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0.35rem 0.5rem', borderRadius: '4px',
                                cursor: 'pointer'
                              }}
                                onClick={() => {
                                  saveKnownSpells([...knownSpells, spell.name])
                                  setShowLearnSpell(false)
                                }}
                              >
                                <div>
                                  <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{spell.name}</span>
                                  <span style={{ color: '#888', fontSize: '0.7rem', marginLeft: '0.4rem' }}>
                                    {spell.spellLevel} • {spell.school}
                                  </span>
                                </div>
                                <span style={{ color: '#2ecc71', fontSize: '0.8rem', fontWeight: '600' }}>Learn</span>
                              </div>
                            ))
                          })()}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Cantrips - if class has them */}
                {(effectiveSpellcasting?.cantripsKnown || isThirdCaster) && (
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
                <p style={{ marginBottom: 0, color: '#666', fontSize: 14 }}>Equipment editing arrives with the new creator's edit mode.</p>
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

      {showNicknames && (
        <NicknameManagerPanel
          character={character}
          onClose={() => setShowNicknames(false)}
        />
      )}
    </div>
  )
}

export default CharacterSheet
