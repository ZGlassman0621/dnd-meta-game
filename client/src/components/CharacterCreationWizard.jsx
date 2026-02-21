import { useState, useEffect } from 'react'
import racesData from '../data/races.json'
import backgroundsData from '../data/backgrounds.json'
import classesData from '../data/classes.json'
import deitiesData from '../data/deities.json'
import equipmentData from '../data/equipment.json'
import spellsData from '../data/spells/index.js'
import featsData from '../data/feats.json'

function CharacterCreationWizard({ onCharacterCreated, onCancel, editCharacter = null }) {
  // Check if we're in edit mode
  const isEditMode = !!editCharacter

  // Helper to parse ability scores from character
  const parseAbilityScores = (character) => {
    if (!character) return { str: null, dex: null, con: null, int: null, wis: null, cha: null }
    const scores = typeof character.ability_scores === 'string'
      ? JSON.parse(character.ability_scores)
      : character.ability_scores
    return scores || { str: null, dex: null, con: null, int: null, wis: null, cha: null }
  }

  // Helper to parse skills from character
  const parseSkills = (character) => {
    if (!character) return []
    const skills = typeof character.skills === 'string'
      ? JSON.parse(character.skills || '[]')
      : (character.skills || [])
    return skills
  }

  // Helper to parse inventory/equipment from character
  const parseEquipment = (character) => {
    if (!character) return []
    const equipment = typeof character.equipment === 'string'
      ? JSON.parse(character.equipment || '[]')
      : (character.equipment || [])
    return equipment
  }

  // Build initial form data - either from existing character or defaults
  const buildInitialFormData = () => {
    if (!editCharacter) {
      return {
        first_name: '',
        last_name: '',
        nickname: '',
        gender: '',
        race: '',
        subrace: '',
        background: '',
        class: '',
        subclass: '',
        level: 1,
        current_location: 'Starting Town',
        current_quest: '',
        str: null,
        dex: null,
        con: null,
        int: null,
        wis: null,
        cha: null,
        avatar: null,
        avatarPreview: null,
        alignment: '',
        faith: '',
        lifestyle: '',
        hair_color: '',
        skin_color: '',
        eye_color: '',
        height: '',
        weight: '',
        age: '',
        personality_traits: '',
        ideals: '',
        bonds: '',
        flaws: '',
        organizations: '',
        allies: '',
        enemies: '',
        backstory: '',
        other_notes: '',
        equipment_choice: 'equipment',
        starting_equipment: [],
        equipment_selections: {},
        equipment_sub_selections: {},
        starting_gold: 0,
        manual_gold: '',
        selected_skills: [],
        selected_cantrips: [],
        selected_spells: [],
        selected_feat: '',
        feat_ability_choice: null,
        feat_choices: {}, // For feats with choices (e.g., Magic Initiate class selection)
        ability_score_method: 'standard_array',
        selected_languages: [],
        selected_tool_proficiencies: []
      }
    }

    // Parse existing character data for edit mode
    const abilityScores = parseAbilityScores(editCharacter)
    const skills = parseSkills(editCharacter)
    const equipment = parseEquipment(editCharacter)

    // Extract first/last name from full name if not stored separately
    const nameParts = editCharacter.name?.split(' ') || ['']
    const firstName = editCharacter.first_name || nameParts[0] || ''
    const lastName = editCharacter.last_name || nameParts.slice(1).join(' ') || ''

    // Helper to find the correct key for a stored value
    // The database might store "Human" but we need "human" to match JSON keys
    const findRaceKey = (storedRace) => {
      if (!storedRace) return ''
      const lowerRace = storedRace.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
      // Check if it's already a valid key
      if (racesData[lowerRace]) return lowerRace
      if (racesData[storedRace]) return storedRace
      // Try to find by matching the name
      for (const key of Object.keys(racesData)) {
        if (racesData[key].name?.toLowerCase() === storedRace.toLowerCase()) return key
      }
      return storedRace
    }

    const findClassKey = (storedClass) => {
      if (!storedClass) return ''
      const lowerClass = storedClass.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
      if (classesData[lowerClass]) return lowerClass
      if (classesData[storedClass]) return storedClass
      for (const key of Object.keys(classesData)) {
        if (classesData[key].name?.toLowerCase() === storedClass.toLowerCase()) return key
      }
      return storedClass
    }

    const findBackgroundKey = (storedBg) => {
      if (!storedBg) return ''
      const lowerBg = storedBg.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
      if (backgroundsData[lowerBg]) return lowerBg
      if (backgroundsData[storedBg]) return storedBg
      for (const key of Object.keys(backgroundsData)) {
        if (backgroundsData[key].name?.toLowerCase() === storedBg.toLowerCase()) return key
      }
      return storedBg
    }

    const findDeityKey = (storedFaith) => {
      if (!storedFaith) return ''
      const lowerFaith = storedFaith.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
      if (deitiesData[lowerFaith]) return lowerFaith
      if (deitiesData[storedFaith]) return storedFaith
      for (const key of Object.keys(deitiesData)) {
        if (deitiesData[key].name?.toLowerCase() === storedFaith.toLowerCase()) return key
      }
      return storedFaith
    }

    // Get normalized keys
    const raceKey = findRaceKey(editCharacter.race)
    const classKey = findClassKey(editCharacter.class)
    const backgroundKey = findBackgroundKey(editCharacter.background)
    const faithKey = findDeityKey(editCharacter.faith)

    // Find subrace and subclass - these are stored by display name, not key
    // Subrace is stored as the name like "Hill Dwarf", needs to match subrace options
    const subraceValue = editCharacter.subrace || ''
    // Subclass is stored as the name like "Champion", needs to match subclass options
    const subclassValue = editCharacter.subclass || ''

    return {
      first_name: firstName,
      last_name: lastName,
      nickname: editCharacter.nickname || '',
      gender: editCharacter.gender || '',
      race: raceKey,
      subrace: subraceValue,
      background: backgroundKey,
      class: classKey,
      subclass: subclassValue,
      level: editCharacter.level || 1,
      current_location: editCharacter.current_location || 'Starting Town',
      current_quest: editCharacter.current_quest || '',
      // The stored ability scores include racial bonuses, so we need to subtract them
      // to get the base scores for the standard array selection
      ...(() => {
        const raceData = racesData[raceKey]
        const subraceData = raceData?.subraces?.find(sr => sr.name === subraceValue)

        // Collect all racial bonuses
        const bonuses = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
        if (raceData?.abilityScoreIncrease) {
          Object.entries(raceData.abilityScoreIncrease).forEach(([ability, bonus]) => {
            bonuses[ability] = (bonuses[ability] || 0) + bonus
          })
        }
        if (subraceData?.abilityScoreIncrease) {
          Object.entries(subraceData.abilityScoreIncrease).forEach(([ability, bonus]) => {
            bonuses[ability] = (bonuses[ability] || 0) + bonus
          })
        }

        // Subtract bonuses to get base scores
        return {
          str: abilityScores.str ? abilityScores.str - bonuses.str : null,
          dex: abilityScores.dex ? abilityScores.dex - bonuses.dex : null,
          con: abilityScores.con ? abilityScores.con - bonuses.con : null,
          int: abilityScores.int ? abilityScores.int - bonuses.int : null,
          wis: abilityScores.wis ? abilityScores.wis - bonuses.wis : null,
          cha: abilityScores.cha ? abilityScores.cha - bonuses.cha : null
        }
      })(),
      avatar: editCharacter.avatar || null,
      avatarPreview: editCharacter.avatar || null,
      alignment: editCharacter.alignment || '',
      faith: faithKey,
      lifestyle: editCharacter.lifestyle || '',
      hair_color: editCharacter.hair_color || '',
      skin_color: editCharacter.skin_color || '',
      eye_color: editCharacter.eye_color || '',
      height: editCharacter.height || '',
      weight: editCharacter.weight || '',
      age: editCharacter.age || '',
      personality_traits: editCharacter.personality_traits || '',
      ideals: editCharacter.ideals || '',
      bonds: editCharacter.bonds || '',
      flaws: editCharacter.flaws || '',
      organizations: editCharacter.organizations || '',
      allies: editCharacter.allies || '',
      enemies: editCharacter.enemies || '',
      backstory: editCharacter.backstory || '',
      other_notes: editCharacter.other_notes || '',
      equipment_choice: 'equipment',
      starting_equipment: equipment,
      equipment_selections: {},
      equipment_sub_selections: {},
      starting_gold: 0,
      manual_gold: '',
      // Filter out background skills from selected_skills since those are added automatically
      selected_skills: (() => {
        const bgData = backgroundsData[backgroundKey]
        const bgSkills = bgData?.skillProficiencies || []
        // Normalize skill names for comparison
        const normalizedBgSkills = bgSkills.map(s => s.toLowerCase().replace(/_/g, ' '))
        return skills.filter(skill => {
          const normalizedSkill = skill.toLowerCase().replace(/_/g, ' ')
          return !normalizedBgSkills.includes(normalizedSkill)
        })
      })(),
      selected_cantrips: [],
      selected_spells: [],
      selected_feat: '',
      feat_ability_choice: null,
      feat_choices: {},
      // Use manual mode for edit since we're preserving existing scores
      ability_score_method: 'manual'
    }
  }

  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState(buildInitialFormData)

  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
  const backgrounds = Object.keys(backgroundsData)
  const classes = Object.keys(classesData)
  const deities = Object.keys(deitiesData)

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
    { value: 'wretched', label: 'Wretched (0 gp/day)', cost: 0 },
    { value: 'squalid', label: 'Squalid (1 sp/day)', cost: 0.1 },
    { value: 'poor', label: 'Poor (2 sp/day)', cost: 0.2 },
    { value: 'modest', label: 'Modest (1 gp/day)', cost: 1 },
    { value: 'comfortable', label: 'Comfortable (2 gp/day)', cost: 2 },
    { value: 'wealthy', label: 'Wealthy (4 gp/day)', cost: 4 },
    { value: 'aristocratic', label: 'Aristocratic (10 gp/day minimum)', cost: 10 }
  ]

  const races = Object.keys(racesData)
  const selectedRaceData = formData.race ? racesData[formData.race] : null
  const selectedBackgroundData = formData.background ? backgroundsData[formData.background] : null
  const selectedClassData = formData.class ? classesData[formData.class] : null
  const hasSubraces = selectedRaceData && selectedRaceData.subraces && selectedRaceData.subraces.length > 0
  const hasSubclasses = selectedClassData && selectedClassData.subclasses && selectedClassData.subclasses.length > 0

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    // Create preview URL
    const previewUrl = URL.createObjectURL(file)
    setFormData(prev => ({ ...prev, avatarPreview: previewUrl }))

    // Upload to server
    const formDataToSend = new FormData()
    formDataToSend.append('avatar', file)

    try {
      const response = await fetch('/api/upload/avatar', {
        method: 'POST',
        body: formDataToSend
      })

      const result = await response.json()
      if (result.success) {
        setFormData(prev => ({ ...prev, avatar: result.avatarPath }))
      } else {
        alert('Failed to upload avatar')
        setFormData(prev => ({ ...prev, avatarPreview: null }))
      }
    } catch (error) {
      console.error('Error uploading avatar:', error)
      alert('Failed to upload avatar')
      setFormData(prev => ({ ...prev, avatarPreview: null }))
    }
  }

  // Get available scores for standard array dropdown
  const getAvailableScores = (currentAbility) => {
    const usedScores = Object.entries(formData)
      .filter(([key, value]) => ['str', 'dex', 'con', 'int', 'wis', 'cha'].includes(key) && key !== currentAbility && value !== null)
      .map(([_, value]) => value)
    return STANDARD_ARRAY.filter(score => !usedScores.includes(score))
  }

  // Check if all ability scores are assigned
  const allAbilitiesAssigned = () => {
    if (formData.ability_score_method === 'manual') {
      // For manual entry, check that all scores are valid numbers between 3 and 18
      return ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(ability => {
        const score = formData[ability]
        return score !== null && Number.isInteger(score) && score >= 3 && score <= 18
      })
    }
    // For standard array, just check that all are assigned
    return ['str', 'dex', 'con', 'int', 'wis', 'cha'].every(ability => formData[ability] !== null)
  }

  const calculateFinalAbilityScores = () => {
    // Get base scores, defaulting to 10 if null
    const baseScores = {
      str: formData.str ?? 10,
      dex: formData.dex ?? 10,
      con: formData.con ?? 10,
      int: formData.int ?? 10,
      wis: formData.wis ?? 10,
      cha: formData.cha ?? 10
    }

    if (!selectedRaceData) return baseScores

    const bonuses = { ...selectedRaceData.abilityScoreIncrease }

    // Add subrace bonuses if applicable
    if (formData.subrace && hasSubraces) {
      const subraceData = selectedRaceData.subraces.find(sr => sr.name === formData.subrace)
      if (subraceData && subraceData.abilityScoreIncrease) {
        Object.keys(subraceData.abilityScoreIncrease).forEach(ability => {
          bonuses[ability] = (bonuses[ability] || 0) + subraceData.abilityScoreIncrease[ability]
        })
      }
    }

    // Add feat ability bonuses (for Variant Human)
    if (formData.selected_feat && featsData[formData.selected_feat]?.abilityIncrease) {
      const featIncrease = featsData[formData.selected_feat].abilityIncrease
      if (featIncrease.ability) {
        // Fixed ability increase
        bonuses[featIncrease.ability] = (bonuses[featIncrease.ability] || 0) + featIncrease.amount
      } else if (featIncrease.choice && formData.feat_ability_choice) {
        // Chosen ability increase
        bonuses[formData.feat_ability_choice] = (bonuses[formData.feat_ability_choice] || 0) + featIncrease.amount
      }
    }

    return {
      str: baseScores.str + (bonuses.str || 0),
      dex: baseScores.dex + (bonuses.dex || 0),
      con: baseScores.con + (bonuses.con || 0),
      int: baseScores.int + (bonuses.int || 0),
      wis: baseScores.wis + (bonuses.wis || 0),
      cha: baseScores.cha + (bonuses.cha || 0)
    }
  }

  // Helper function to unpack equipment packs into their contents
  const unpackEquipment = (items) => {
    const unpacked = []
    const packs = equipmentData.packs || {}

    items.forEach(item => {
      // Check if this item is a pack that should be unpacked
      if (packs[item]) {
        // Add the pack's contents instead of the pack itself
        unpacked.push(...packs[item].contents)
      } else {
        unpacked.push(item)
      }
    })

    return unpacked
  }

  // Check feat prerequisites with detailed status
  // Returns: { available: boolean, status: 'available'|'unavailable'|'restricted', prereqs: [] }
  const checkFeatPrerequisitesDetailed = (featKey) => {
    const feat = featsData[featKey]
    if (!feat || !feat.prerequisites) {
      return { available: true, status: 'available', prereqs: [] }
    }

    const prereq = feat.prerequisites.toLowerCase()
    const originalPrereq = feat.prerequisites
    const finalScores = calculateFinalAbilityScores()
    const prereqResults = []

    // Check ability score requirements (e.g., "Charisma 13 or higher")
    const abilityCheck = prereq.match(/(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+(\d+)/i)
    if (abilityCheck) {
      const abilityMap = {
        'strength': 'str', 'dexterity': 'dex', 'constitution': 'con',
        'intelligence': 'int', 'wisdom': 'wis', 'charisma': 'cha'
      }
      const abilityNames = {
        'str': 'Strength', 'dex': 'Dexterity', 'con': 'Constitution',
        'int': 'Intelligence', 'wis': 'Wisdom', 'cha': 'Charisma'
      }
      const ability = abilityMap[abilityCheck[1].toLowerCase()]
      const required = parseInt(abilityCheck[2])

      // Check for "or" conditions (e.g., "Intelligence or Wisdom 13 or higher")
      if (prereq.includes(' or ') && prereq.match(/intelligence or wisdom/i)) {
        const met = finalScores.int >= required || finalScores.wis >= required
        prereqResults.push({
          type: 'ability',
          requirement: `Intelligence or Wisdom ${required}+`,
          met,
          changeable: true, // Can adjust ability scores
          current: `INT ${finalScores.int}, WIS ${finalScores.wis}`
        })
      } else if (ability) {
        const met = finalScores[ability] >= required
        prereqResults.push({
          type: 'ability',
          requirement: `${abilityNames[ability]} ${required}+`,
          met,
          changeable: true,
          current: `${ability.toUpperCase()} ${finalScores[ability]}`
        })
      }
    }

    // Check armor proficiency requirements
    const lightArmorClasses = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'paladin', 'ranger', 'rogue', 'warlock']
    const mediumArmorClasses = ['barbarian', 'cleric', 'druid', 'fighter', 'paladin', 'ranger']
    const heavyArmorClasses = ['fighter', 'paladin']

    if (prereq.includes('proficiency with light armor')) {
      const met = lightArmorClasses.includes(formData.class?.toLowerCase())
      prereqResults.push({
        type: 'armor',
        requirement: 'Light armor proficiency',
        met,
        changeable: false // Class-locked
      })
    }
    if (prereq.includes('proficiency with medium armor')) {
      const met = mediumArmorClasses.includes(formData.class?.toLowerCase())
      prereqResults.push({
        type: 'armor',
        requirement: 'Medium armor proficiency',
        met,
        changeable: false
      })
    }
    if (prereq.includes('proficiency with heavy armor')) {
      const met = heavyArmorClasses.includes(formData.class?.toLowerCase())
      prereqResults.push({
        type: 'armor',
        requirement: 'Heavy armor proficiency',
        met,
        changeable: false
      })
    }

    // Check spellcasting requirements
    if (prereq.includes('ability to cast at least one spell')) {
      const spellcastingClasses = ['bard', 'cleric', 'druid', 'paladin', 'ranger', 'sorcerer', 'warlock', 'wizard']
      const met = spellcastingClasses.includes(formData.class?.toLowerCase())
      prereqResults.push({
        type: 'spellcasting',
        requirement: 'Spellcasting ability',
        met,
        changeable: false
      })
    }

    // Determine overall status
    const allMet = prereqResults.every(p => p.met)
    const hasUnmetFixed = prereqResults.some(p => !p.met && !p.changeable)

    let status = 'available'
    if (!allMet) {
      status = hasUnmetFixed ? 'restricted' : 'unavailable'
    }

    return { available: allMet, status, prereqs: prereqResults, originalPrereq }
  }

  // Simple boolean check for backward compatibility
  const checkFeatPrerequisites = (featKey) => {
    return checkFeatPrerequisitesDetailed(featKey).available
  }

  // Get categorized feats with detailed prerequisite info
  const getCategorizedFeats = () => {
    const available = []
    const unavailable = []
    const restricted = []

    Object.keys(featsData).forEach(featKey => {
      const result = checkFeatPrerequisitesDetailed(featKey)
      const item = { key: featKey, ...result }

      if (result.status === 'available') available.push(item)
      else if (result.status === 'unavailable') unavailable.push(item)
      else restricted.push(item)
    })

    return {
      available: available.sort((a, b) => featsData[a.key].name.localeCompare(featsData[b.key].name)),
      unavailable: unavailable.sort((a, b) => featsData[a.key].name.localeCompare(featsData[b.key].name)),
      restricted: restricted.sort((a, b) => featsData[a.key].name.localeCompare(featsData[b.key].name))
    }
  }

  // Get available feats (filtered by prerequisites) - for backward compatibility
  const getAvailableFeats = () => {
    return Object.keys(featsData)
      .filter(featKey => checkFeatPrerequisites(featKey))
      .sort((a, b) => featsData[a].name.localeCompare(featsData[b].name))
  }

  const handleSubmit = async () => {
    const finalScores = calculateFinalAbilityScores()

    // Ensure all ability scores are valid numbers (fallback to 10 if somehow NaN)
    const validatedScores = {
      str: Number.isFinite(finalScores.str) ? finalScores.str : 10,
      dex: Number.isFinite(finalScores.dex) ? finalScores.dex : 10,
      con: Number.isFinite(finalScores.con) ? finalScores.con : 10,
      int: Number.isFinite(finalScores.int) ? finalScores.int : 10,
      wis: Number.isFinite(finalScores.wis) ? finalScores.wis : 10,
      cha: Number.isFinite(finalScores.cha) ? finalScores.cha : 10
    }

    // Calculate HP based on class and CON modifier
    const conModifier = Math.floor((validatedScores.con - 10) / 2)
    const hitDie = selectedClassData?.hitDie || 10
    const maxHp = Math.max(1, hitDie + conModifier) // Ensure at least 1 HP

    const ability_scores = JSON.stringify(validatedScores)

    // Concatenate first and last name
    const fullName = `${formData.first_name} ${formData.last_name}`.trim()

    // Compile starting equipment (raw, before unpacking packs)
    const rawEquipment = []

    // Get class data - fallback to formData.class lookup if selectedClassData is somehow undefined
    const classData = selectedClassData || (formData.class ? classesData[formData.class] : null)

    // Add class equipment (if equipment choice)
    if (formData.equipment_choice === 'equipment' && classData?.startingEquipment) {
      // Add given items - these are always included for the class
      if (classData.startingEquipment.given) {
        rawEquipment.push(...classData.startingEquipment.given)
      }
      // Add chosen items - use sub-selections where available
      Object.entries(formData.equipment_selections).forEach(([idx, choice]) => {
        if (choice) {
          // Check if there's a sub-selection for this choice
          const subSelection = formData.equipment_sub_selections[idx]
          if (subSelection) {
            // For compound selections like "Martial Weapon and Shield"
            if (choice.toLowerCase().includes('and shield')) {
              rawEquipment.push(subSelection)
              rawEquipment.push('Shield')
            } else if (choice.toLowerCase().includes('two martial') || choice.toLowerCase().includes('two simple')) {
              // For "Two X Weapons" choices, add the weapon twice
              rawEquipment.push(subSelection)
              rawEquipment.push(subSelection)
            } else {
              rawEquipment.push(subSelection)
            }
          } else {
            rawEquipment.push(choice)
          }
        }
      })

      // If user made equipment_choice but has no selections and no given items,
      // add a minimal default set so they're not left with nothing
      if (rawEquipment.length === 0 && classData.startingEquipment.choices?.length > 0) {
        // At minimum add the first option from each choice
        classData.startingEquipment.choices.forEach((choice) => {
          if (choice.from && choice.from.length > 0) {
            rawEquipment.push(choice.from[0])
          }
        })
      }
    }

    // Add background equipment (excluding gold pouches - we handle gold separately)
    if (selectedBackgroundData?.equipment) {
      selectedBackgroundData.equipment.forEach(item => {
        if (!item.toLowerCase().includes('pouch containing')) {
          rawEquipment.push(item)
        }
      })
    }

    // Unpack any equipment packs (Explorer's Pack, Dungeoneer's Pack, etc.) into their contents
    const startingEquipment = unpackEquipment(rawEquipment)

    // Calculate starting gold (only for new characters)
    let startingGold = 0
    if (!isEditMode) {
      if (formData.equipment_choice === 'gold') {
        startingGold = formData.starting_gold
      }
      // Add gold from background
      const bgEquip = selectedBackgroundData?.equipment || []
      const goldItem = bgEquip.find(item => item.toLowerCase().includes('gp'))
      if (goldItem) {
        const match = goldItem.match(/(\d+)\s*gp/)
        if (match) startingGold += parseInt(match[1])
      }
    }

    // Build the data to submit
    const dataToSubmit = {
      name: fullName || 'Unnamed Hero',
      first_name: formData.first_name || '',
      last_name: formData.last_name || '',
      nickname: formData.nickname || null,
      gender: formData.gender || null,
      race: formData.race || 'human',
      subrace: formData.subrace || null,
      background: formData.background || null,
      class: formData.class || 'fighter',
      subclass: formData.subclass || null,
      armor_class: 10 + Math.floor((validatedScores.dex - 10) / 2),
      speed: selectedRaceData?.speed || 30,
      ability_scores,
      skills: JSON.stringify([...formData.selected_skills, ...(selectedBackgroundData?.skillProficiencies || [])]),
      avatar: formData.avatar || null,
      alignment: formData.alignment,
      faith: formData.faith || null,
      lifestyle: formData.lifestyle,
      hair_color: formData.hair_color || null,
      skin_color: formData.skin_color || null,
      eye_color: formData.eye_color || null,
      height: formData.height || null,
      weight: formData.weight || null,
      age: formData.age || null,
      personality_traits: formData.personality_traits || null,
      ideals: formData.ideals || null,
      bonds: formData.bonds || null,
      flaws: formData.flaws || null,
      organizations: formData.organizations || null,
      allies: formData.allies || null,
      enemies: formData.enemies || null,
      backstory: formData.backstory || null,
      other_notes: formData.other_notes || null,
      current_location: formData.current_location,
      current_quest: formData.current_quest,
      known_cantrips: JSON.stringify(formData.selected_cantrips || []),
      known_spells: JSON.stringify(formData.selected_spells || []),
      feats: formData.selected_feat ? JSON.stringify([{
        key: formData.selected_feat,
        name: featsData[formData.selected_feat]?.name || formData.selected_feat,
        abilityChoice: formData.feat_ability_choice || null,
        choices: Object.keys(formData.feat_choices || {}).length > 0 ? formData.feat_choices : null
      }]) : '[]',
      // Combine race languages, background language choices, and fixed background tool proficiencies
      languages: JSON.stringify([
        ...(selectedRaceData?.languages || []),
        ...(formData.selected_languages || []).filter(l => l) // Filter out empty selections
      ]),
      tool_proficiencies: JSON.stringify([
        // Fixed tool proficiencies from background
        ...(selectedBackgroundData?.toolProficiencies || []).filter(t =>
          !t.toLowerCase().includes('one type of') &&
          !t.toLowerCase().includes('one from') &&
          !t.toLowerCase().includes('two from') &&
          !t.toLowerCase().includes(' or ')
        ),
        // User-selected tool proficiencies
        ...(formData.selected_tool_proficiencies || []).filter(t => t)
      ])
    }

    if (isEditMode) {
      // EDIT MODE: Preserve progression fields from existing character
      // Only update character definition, not earned progression
      dataToSubmit.level = editCharacter.level
      dataToSubmit.experience = editCharacter.experience
      dataToSubmit.experience_to_next_level = editCharacter.experience_to_next_level
      dataToSubmit.gold_cp = editCharacter.gold_cp
      dataToSubmit.gold_sp = editCharacter.gold_sp
      dataToSubmit.gold_gp = editCharacter.gold_gp
      dataToSubmit.advantages = editCharacter.advantages || '[]'

      // Check if existing inventory is empty - if so, use the newly selected starting equipment
      const existingInv = typeof editCharacter.inventory === 'string'
        ? JSON.parse(editCharacter.inventory || '[]')
        : (editCharacter.inventory || [])

      if (existingInv.length === 0 && startingEquipment.length > 0) {
        // Character has no inventory - use the starting equipment from the wizard
        dataToSubmit.inventory = JSON.stringify(startingEquipment.map(item => ({ name: item, quantity: 1 })))
        dataToSubmit.equipment = JSON.stringify(startingEquipment)
      } else {
        // Preserve existing inventory
        dataToSubmit.inventory = editCharacter.inventory
        dataToSubmit.equipment = editCharacter.equipment
      }

      // Recalculate HP if CON or class changed
      // If CON increased, add the difference to current/max HP
      // If class changed, recalculate hit die based on level
      const oldScores = typeof editCharacter.ability_scores === 'string'
        ? JSON.parse(editCharacter.ability_scores)
        : editCharacter.ability_scores
      const oldConMod = Math.floor(((oldScores?.con || 10) - 10) / 2)
      const newConMod = conModifier
      const conDiff = newConMod - oldConMod

      // Apply CON modifier difference to HP (per level)
      const hpAdjustment = conDiff * editCharacter.level
      dataToSubmit.max_hp = Math.max(1, editCharacter.max_hp + hpAdjustment)
      dataToSubmit.current_hp = Math.max(1, Math.min(editCharacter.current_hp + hpAdjustment, dataToSubmit.max_hp))
    } else {
      // NEW CHARACTER: Set initial values
      dataToSubmit.level = formData.level || 1
      dataToSubmit.current_hp = maxHp
      dataToSubmit.max_hp = maxHp
      dataToSubmit.experience = 0
      dataToSubmit.experience_to_next_level = 300
      dataToSubmit.gold_cp = 0
      dataToSubmit.gold_sp = 0
      dataToSubmit.gold_gp = startingGold
      dataToSubmit.advantages = '[]'
      dataToSubmit.inventory = JSON.stringify(startingEquipment.map(item => ({ name: item, quantity: 1 })))
      dataToSubmit.equipment = JSON.stringify(startingEquipment)
    }

    try {
      const url = isEditMode ? `/api/character/${editCharacter.id}` : '/api/character'
      const method = isEditMode ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      })

      const character = await response.json()
      if (!response.ok) {
        throw new Error(character.error || `Server returned ${response.status}`)
      }
      onCharacterCreated(character)
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} character:`, error)
      alert(`Failed to ${isEditMode ? 'update' : 'create'} character: ${error.message}`)
    }
  }

  const renderStep1 = () => (
    <div>
      <h3>Basic Information</h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>First Name</label>
          <input
            type="text"
            value={formData.first_name}
            onChange={(e) => handleChange('first_name', e.target.value)}
            placeholder="Enter first name"
            required
          />
        </div>

        <div className="form-group">
          <label>Last Name</label>
          <input
            type="text"
            value={formData.last_name}
            onChange={(e) => handleChange('last_name', e.target.value)}
            placeholder="Enter last name"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Nickname (Optional)</label>
        <input
          type="text"
          value={formData.nickname}
          onChange={(e) => handleChange('nickname', e.target.value)}
          placeholder="e.g., 'Riv', 'The Brave', 'Shadowstep'"
        />
        <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
          A shorter name or alias your character goes by
        </small>
      </div>

      <div className="form-group">
        <label>Character Avatar (Optional)</label>
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleAvatarUpload}
          style={{ padding: '0.5rem' }}
        />
        {formData.avatarPreview && (
          <div style={{ marginTop: '0.5rem' }}>
            <img
              src={formData.avatarPreview}
              alt="Avatar preview"
              style={{
                width: '100px',
                height: '100px',
                objectFit: 'cover',
                borderRadius: '50%',
                border: '2px solid #3498db'
              }}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Gender</label>
        <select value={formData.gender} onChange={(e) => handleChange('gender', e.target.value)}>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Non-binary">Non-binary</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <div className="form-group">
        <label>Race</label>
        <select
          value={formData.race}
          onChange={(e) => {
            handleChange('race', e.target.value)
            handleChange('subrace', '') // Reset subrace when race changes
            handleChange('selected_feat', '') // Reset feat when race changes (in case was Variant Human)
          }}
          required
        >
          <option value="">Select race</option>
          {races.map(raceKey => (
            <option key={raceKey} value={raceKey}>
              {racesData[raceKey].name}
            </option>
          ))}
        </select>
      </div>

      {hasSubraces && (
        <div className="form-group">
          <label>Subrace</label>
          <select
            value={formData.subrace}
            onChange={(e) => handleChange('subrace', e.target.value)}
          >
            <option value="">Select subrace</option>
            {selectedRaceData.subraces.map(subrace => (
              <option key={subrace.name} value={subrace.name}>
                {subrace.name}
              </option>
            ))}
          </select>
          {formData.subrace && (() => {
            const subraceData = selectedRaceData.subraces.find(sr => sr.name === formData.subrace)
            return subraceData?.description ? (
              <p style={{
                fontSize: '0.85rem',
                color: '#bbb',
                marginTop: '0.5rem',
                fontStyle: 'italic',
                lineHeight: '1.4'
              }}>
                {subraceData.description}
              </p>
            ) : null
          })()}
        </div>
      )}

      <div className="form-group">
        <label>Background</label>
        <select
          value={formData.background}
          onChange={(e) => handleChange('background', e.target.value)}
          required
        >
          <option value="">Select background</option>
          {backgrounds.map(bgKey => (
            <option key={bgKey} value={bgKey}>
              {backgroundsData[bgKey].name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Class</label>
        <select
          value={formData.class}
          onChange={(e) => {
            handleChange('class', e.target.value)
            handleChange('subclass', '') // Reset subclass when class changes
            handleChange('selected_skills', []) // Reset skills when class changes
            handleChange('selected_cantrips', []) // Reset cantrips when class changes
            handleChange('selected_spells', []) // Reset spells when class changes
          }}
          required
        >
          <option value="">Select class</option>
          {classes.map(classKey => (
            <option key={classKey} value={classKey}>
              {classesData[classKey].name}
            </option>
          ))}
        </select>
      </div>

      {hasSubclasses && (
        <div className="form-group">
          <label>Subclass</label>
          <select
            value={formData.subclass}
            onChange={(e) => handleChange('subclass', e.target.value)}
          >
            <option value="">Select subclass (optional)</option>
            {selectedClassData.subclasses.map(subclass => (
              <option key={subclass.name} value={subclass.name}>
                {subclass.name}
              </option>
            ))}
          </select>
          {formData.subclass && selectedClassData.subclasses.find(sc => sc.name === formData.subclass) && (
            <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
              {selectedClassData.subclasses.find(sc => sc.name === formData.subclass).description}
            </small>
          )}
        </div>
      )}

      {formData.subclass && selectedClassData && (() => {
        const subclassData = selectedClassData.subclasses.find(sc => sc.name === formData.subclass)
        if (!subclassData) return null

        // Get the spell list based on class type
        const spellListKey = subclassData.domainSpells ? 'domainSpells' :
                            subclassData.oathSpells ? 'oathSpells' :
                            subclassData.expandedSpells ? 'expandedSpells' :
                            subclassData.circleSpells ? 'circleSpells' :
                            subclassData.subclassSpells ? 'subclassSpells' :
                            subclassData.originSpells ? 'originSpells' : null
        const spellList = spellListKey ? subclassData[spellListKey] : null

        return (
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(155, 89, 182, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(155, 89, 182, 0.3)'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#9b59b6' }}>
              {formData.subclass} Features
            </h4>

            {/* Bonus Proficiencies */}
            {subclassData.bonusProficiencies && subclassData.bonusProficiencies.length > 0 && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#bbb' }}>
                  <strong>Bonus Proficiencies:</strong> {subclassData.bonusProficiencies.join(', ')}
                </p>
              </div>
            )}

            {/* Subclass Spells */}
            {spellList && (
              <div style={{ marginBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
                  <strong>Subclass Spells:</strong>
                </p>
                <div style={{ fontSize: '0.8rem', color: '#bbb', marginLeft: '1rem' }}>
                  {Object.entries(spellList).map(([level, spells]) => (
                    <p key={level} style={{ margin: '0.25rem 0' }}>
                      <span style={{ color: '#9b59b6' }}>Level {level}:</span> {spells.join(', ')}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Features by Level */}
            {subclassData.featuresByLevel && (
              <div>
                <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
                  <strong>Features by Level:</strong>
                </p>
                {Object.entries(subclassData.featuresByLevel)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([level, features]) => (
                    <div key={level} style={{ marginBottom: '0.75rem', marginLeft: '0.5rem' }}>
                      <p style={{ fontSize: '0.8rem', color: '#9b59b6', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                        Level {level}
                      </p>
                      {features.map((feature, idx) => (
                        <div key={idx} style={{ marginLeft: '0.5rem', marginBottom: '0.5rem' }}>
                          <p style={{ fontSize: '0.8rem', color: '#ccc', fontWeight: 'bold', margin: 0 }}>
                            {feature.name}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: '#999', margin: '0.1rem 0 0 0' }}>
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            )}
          </div>
        )
      })()}

      {selectedClassData && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(231, 76, 60, 0.1)',
          borderRadius: '6px'
        }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Class Features</h4>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            {selectedClassData.description}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            <strong>Hit Die:</strong> d{selectedClassData.hitDie} | <strong>Primary Ability:</strong> {selectedClassData.primaryAbility.map(a => a.toUpperCase()).join(' or ')}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            <strong>Skills:</strong> Choose {selectedClassData.skillChoices} from {selectedClassData.skillOptions.map(skill => skill.charAt(0).toUpperCase() + skill.slice(1).replace(/_/g, ' ')).join(', ')}
          </p>
          <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1.25rem', marginTop: '0.5rem' }}>
            {selectedClassData.features.map((feature, idx) => (
              <li key={idx}>{feature}</li>
            ))}
          </ul>
        </div>
      )}

      {selectedBackgroundData && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(46, 204, 113, 0.1)',
          borderRadius: '6px'
        }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Background Feature: {selectedBackgroundData.feature.name}</h4>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            {selectedBackgroundData.description}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            <strong>Skill Proficiencies:</strong> {selectedBackgroundData.skillProficiencies.map(skill => skill.charAt(0).toUpperCase() + skill.slice(1).replace(/_/g, ' ')).join(', ')}
          </p>
          <p style={{ fontSize: '0.85rem', color: '#bbb' }}>
            <strong>Feature:</strong> {selectedBackgroundData.feature.description}
          </p>

          {/* Language Selection */}
          {typeof selectedBackgroundData.languages === 'number' && selectedBackgroundData.languages > 0 && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(46, 204, 113, 0.3)' }}>
              <p style={{ color: '#2ecc71', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Choose {selectedBackgroundData.languages} Language{selectedBackgroundData.languages > 1 ? 's' : ''}
              </p>
              {[...Array(selectedBackgroundData.languages)].map((_, idx) => (
                <div key={idx} className="form-group" style={{ marginBottom: '0.5rem' }}>
                  <select
                    value={formData.selected_languages[idx] || ''}
                    onChange={(e) => {
                      const newLangs = [...formData.selected_languages]
                      newLangs[idx] = e.target.value
                      handleChange('selected_languages', newLangs)
                    }}
                    style={{ width: '100%' }}
                  >
                    <option value="">Select Language {idx + 1}...</option>
                    <optgroup label="Standard Languages">
                      {(equipmentData.languages?.standard || [])
                        .filter(lang => !selectedRaceData?.languages?.includes(lang))
                        .filter(lang => !formData.selected_languages.includes(lang) || formData.selected_languages[idx] === lang)
                        .map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </optgroup>
                    <optgroup label="Exotic Languages">
                      {(equipmentData.languages?.exotic || [])
                        .filter(lang => !selectedRaceData?.languages?.includes(lang))
                        .filter(lang => !formData.selected_languages.includes(lang) || formData.selected_languages[idx] === lang)
                        .map(lang => (
                          <option key={lang} value={lang}>{lang}</option>
                        ))}
                    </optgroup>
                  </select>
                </div>
              ))}
            </div>
          )}

          {/* Tool Proficiency Selection */}
          {selectedBackgroundData.toolProficiencies && selectedBackgroundData.toolProficiencies.some(t =>
            t.toLowerCase().includes('one type of') ||
            t.toLowerCase().includes('one from') ||
            t.toLowerCase().includes('two from') ||
            t.toLowerCase().includes(' or ')
          ) && (
            <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(46, 204, 113, 0.3)' }}>
              <p style={{ color: '#2ecc71', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Choose Tool Proficiencies
              </p>
              {selectedBackgroundData.toolProficiencies.map((tool, idx) => {
                // Check if this is a choice
                const isArtisanChoice = tool.toLowerCase().includes('artisan')
                const isGamingChoice = tool.toLowerCase().includes('gaming')
                const isMusicalChoice = tool.toLowerCase().includes('musical')
                const isComboChoice = tool.toLowerCase().includes(' or ')
                const isTwoChoice = tool.toLowerCase().includes('two from')

                if (!isArtisanChoice && !isGamingChoice && !isMusicalChoice && !isComboChoice && !isTwoChoice) {
                  return (
                    <p key={idx} style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.25rem' }}>
                      • {tool}
                    </p>
                  )
                }

                // Build options based on type
                let options = []
                if (isArtisanChoice) {
                  options = (equipmentData.tools?.artisansTools || []).map(t => t.name)
                } else if (isGamingChoice) {
                  options = (equipmentData.tools?.gamingSets || []).map(t => t.name)
                } else if (isMusicalChoice) {
                  options = equipmentData.musicalInstruments || []
                } else if (isComboChoice || isTwoChoice) {
                  // Combo like "gaming set or musical instrument"
                  if (tool.toLowerCase().includes('gaming')) {
                    options.push(...(equipmentData.tools?.gamingSets || []).map(t => t.name))
                  }
                  if (tool.toLowerCase().includes('musical')) {
                    options.push(...(equipmentData.musicalInstruments || []))
                  }
                  if (tool.toLowerCase().includes('thieves')) {
                    options.push("Thieves' Tools")
                  }
                }

                const numChoices = isTwoChoice ? 2 : 1

                return (
                  <div key={idx}>
                    <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>{tool}</p>
                    {[...Array(numChoices)].map((_, choiceIdx) => (
                      <div key={choiceIdx} className="form-group" style={{ marginBottom: '0.5rem' }}>
                        <select
                          value={formData.selected_tool_proficiencies[idx * numChoices + choiceIdx] || ''}
                          onChange={(e) => {
                            const newTools = [...formData.selected_tool_proficiencies]
                            newTools[idx * numChoices + choiceIdx] = e.target.value
                            handleChange('selected_tool_proficiencies', newTools)
                          }}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select tool...</option>
                          {options
                            .filter(opt => !formData.selected_tool_proficiencies.includes(opt) ||
                              formData.selected_tool_proficiencies[idx * numChoices + choiceIdx] === opt)
                            .map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {selectedRaceData && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: 'rgba(52, 152, 219, 0.1)',
          borderRadius: '6px'
        }}>
          <h4 style={{ marginBottom: '0.5rem' }}>Racial Traits</h4>
          <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '0.5rem' }}>
            <strong>Size:</strong> {selectedRaceData.size} | <strong>Speed:</strong> {selectedRaceData.speed} ft
          </p>
          <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1.25rem' }}>
            {(() => {
              // If subrace is selected and exists, show subrace traits
              if (formData.subrace && hasSubraces) {
                const subraceData = selectedRaceData.subraces.find(sr => sr.name === formData.subrace)
                if (subraceData && subraceData.traits) {
                  return subraceData.traits.map((trait, idx) => (
                    <li key={idx}>{trait}</li>
                  ))
                }
              }
              // Otherwise show base race traits
              return selectedRaceData.traits.map((trait, idx) => (
                <li key={idx}>{trait}</li>
              ))
            })()}
          </ul>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button onClick={onCancel} className="button" style={{ flex: 1, background: '#95a5a6' }}>
          Cancel
        </button>
        <button
          onClick={() => setStep(2)}
          className="button"
          style={{ flex: 1 }}
          disabled={!formData.first_name || !formData.race || !formData.background || !formData.class}
        >
          Next: Ability Scores
        </button>
      </div>
    </div>
  )

  const renderStep2 = () => {
    const finalScores = calculateFinalAbilityScores()

    // Check if ability is a primary ability for the selected class
    const isPrimaryAbility = (ability) => {
      if (!selectedClassData) return false
      return selectedClassData.primaryAbility.includes(ability)
    }

    // Check if ability is the dump stat for the selected class
    const isDumpStat = (ability) => {
      if (!selectedClassData) return false
      return selectedClassData.dumpStat === ability
    }

    return (
      <div>
        <h3>Ability Scores</h3>

        {/* Method Toggle */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '1rem',
          padding: '0.5rem',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '6px'
        }}>
          <button
            type="button"
            onClick={() => {
              handleChange('ability_score_method', 'standard_array')
              // Reset scores when switching methods
              handleChange('str', null)
              handleChange('dex', null)
              handleChange('con', null)
              handleChange('int', null)
              handleChange('wis', null)
              handleChange('cha', null)
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: formData.ability_score_method === 'standard_array' ? 'rgba(52, 152, 219, 0.3)' : 'transparent',
              border: formData.ability_score_method === 'standard_array' ? '2px solid #3498db' : '2px solid transparent',
              borderRadius: '4px',
              color: formData.ability_score_method === 'standard_array' ? '#3498db' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: formData.ability_score_method === 'standard_array' ? 'bold' : 'normal'
            }}
          >
            Standard Array
          </button>
          <button
            type="button"
            onClick={() => {
              handleChange('ability_score_method', 'manual')
              // Reset scores when switching methods
              handleChange('str', null)
              handleChange('dex', null)
              handleChange('con', null)
              handleChange('int', null)
              handleChange('wis', null)
              handleChange('cha', null)
            }}
            style={{
              flex: 1,
              padding: '0.75rem',
              background: formData.ability_score_method === 'manual' ? 'rgba(155, 89, 182, 0.3)' : 'transparent',
              border: formData.ability_score_method === 'manual' ? '2px solid #9b59b6' : '2px solid transparent',
              borderRadius: '4px',
              color: formData.ability_score_method === 'manual' ? '#9b59b6' : '#888',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: formData.ability_score_method === 'manual' ? 'bold' : 'normal'
            }}
          >
            Manual / Rolled
          </button>
        </div>

        <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
          {formData.ability_score_method === 'standard_array'
            ? 'Assign standard array values to each ability: 15, 14, 13, 12, 10, 8'
            : 'Enter your rolled or custom ability scores (3-18)'}
          {selectedClassData && (
            <>
              <span style={{ display: 'block', marginTop: '0.5rem', color: '#2ecc71' }}>
                ⭐ = Primary ability for {selectedClassData.name}
              </span>
              {selectedClassData.dumpStat && (
                <span style={{ display: 'block', marginTop: '0.25rem', color: '#e74c3c' }}>
                  ✗ = Least important ability (dump stat)
                </span>
              )}
            </>
          )}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => {
            const baseScore = formData[ability]
            const finalScore = finalScores[ability]
            const bonus = baseScore !== null ? finalScore - baseScore : 0
            const availableScores = baseScore !== null ? [baseScore, ...getAvailableScores(ability)] : getAvailableScores(ability)
            const isPrimary = isPrimaryAbility(ability)
            const isDump = isDumpStat(ability)

            return (
              <div key={ability} className="form-group">
                <label style={{
                  textTransform: 'uppercase',
                  color: isPrimary ? '#2ecc71' : isDump ? '#e74c3c' : 'inherit',
                  fontWeight: (isPrimary || isDump) ? 'bold' : 'normal'
                }}>
                  {isPrimary && '⭐ '}{isDump && '✗ '}{ability}
                </label>
                {formData.ability_score_method === 'standard_array' ? (
                  <select
                    value={baseScore || ''}
                    onChange={(e) => handleChange(ability, e.target.value ? parseInt(e.target.value) : null)}
                  >
                    <option value="">Select score</option>
                    {availableScores.sort((a, b) => b - a).map(score => (
                      <option key={score} value={score}>{score}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="number"
                    min="3"
                    max="18"
                    value={baseScore ?? ''}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '') {
                        handleChange(ability, null)
                      } else {
                        const num = parseInt(val)
                        if (!isNaN(num)) {
                          // Allow any value while typing, clamp on blur
                          handleChange(ability, num)
                        }
                      }
                    }}
                    onBlur={(e) => {
                      // Clamp value to 3-18 when user leaves the field
                      const val = e.target.value
                      if (val !== '') {
                        const num = parseInt(val)
                        if (!isNaN(num)) {
                          handleChange(ability, Math.min(18, Math.max(3, num)))
                        }
                      }
                    }}
                    placeholder="3-18"
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      background: 'rgba(255, 255, 255, 0.1)',
                      color: '#fff',
                      fontSize: '1rem',
                      textAlign: 'center'
                    }}
                  />
                )}
                {bonus > 0 && baseScore !== null && (
                  <small style={{ color: '#2ecc71' }}>
                    +{bonus} racial = {finalScore} ({Math.floor((finalScore - 10) / 2) >= 0 ? '+' : ''}{Math.floor((finalScore - 10) / 2)})
                  </small>
                )}
              </div>
            )
          })}
        </div>

        {/* Skill Proficiency Selection */}
        {selectedClassData && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(52, 152, 219, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(52, 152, 219, 0.3)'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#3498db' }}>
              Skill Proficiencies
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '1rem' }}>
              Choose {selectedClassData.skillChoices} skills from the {selectedClassData.name} skill list.
              {selectedBackgroundData && selectedBackgroundData.skillProficiencies && (
                <span style={{ display: 'block', marginTop: '0.5rem', color: '#2ecc71' }}>
                  Your {selectedBackgroundData.name} background grants: {selectedBackgroundData.skillProficiencies.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')).join(', ')}
                </span>
              )}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {selectedClassData.skillOptions.map(skill => {
                const skillName = skill.charAt(0).toUpperCase() + skill.slice(1).replace(/_/g, ' ')
                const isSelected = formData.selected_skills.includes(skillName)
                const isFromBackground = selectedBackgroundData?.skillProficiencies?.some(
                  s => s.toLowerCase() === skill.toLowerCase() || s.toLowerCase().replace('_', ' ') === skill.toLowerCase()
                )
                const isDisabled = isFromBackground || (!isSelected && formData.selected_skills.length >= selectedClassData.skillChoices)

                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => {
                      if (isFromBackground) return
                      if (isSelected) {
                        handleChange('selected_skills', formData.selected_skills.filter(s => s !== skillName))
                      } else if (formData.selected_skills.length < selectedClassData.skillChoices) {
                        handleChange('selected_skills', [...formData.selected_skills, skillName])
                      }
                    }}
                    style={{
                      padding: '0.5rem',
                      background: isFromBackground
                        ? 'rgba(46, 204, 113, 0.2)'
                        : isSelected
                        ? 'rgba(52, 152, 219, 0.3)'
                        : 'rgba(255, 255, 255, 0.05)',
                      border: isFromBackground
                        ? '2px solid #2ecc71'
                        : isSelected
                        ? '2px solid #3498db'
                        : '2px solid transparent',
                      borderRadius: '4px',
                      color: isFromBackground ? '#2ecc71' : isSelected ? '#3498db' : (isDisabled ? '#666' : '#ccc'),
                      cursor: isFromBackground ? 'default' : (isDisabled && !isSelected) ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      textAlign: 'left'
                    }}
                    disabled={isFromBackground}
                    title={isFromBackground ? `Granted by ${selectedBackgroundData.name} background` : ''}
                  >
                    {isFromBackground ? '✓ ' : isSelected ? '● ' : '○ '}
                    {skillName}
                    {isFromBackground && <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem' }}>(Background)</span>}
                  </button>
                )
              })}
            </div>

            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem' }}>
              Selected: {formData.selected_skills.length}/{selectedClassData.skillChoices}
              {formData.selected_skills.length > 0 && (
                <span style={{ color: '#3498db' }}> ({formData.selected_skills.join(', ')})</span>
              )}
            </p>
          </div>
        )}

        {/* Variant Human Feat Selection */}
        {formData.subrace === 'Variant Human' && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(241, 196, 15, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(241, 196, 15, 0.3)'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#f1c40f' }}>
              Variant Human Feat
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '1rem' }}>
              As a Variant Human, you gain one feat of your choice at 1st level.
            </p>
            {(() => {
              const categorized = getCategorizedFeats()
              return (
                <select
                  value={formData.selected_feat || ''}
                  onChange={(e) => {
                    handleChange('selected_feat', e.target.value)
                    handleChange('feat_ability_choice', null) // Reset ability choice when feat changes
                    handleChange('feat_choices', {}) // Reset feat choices when feat changes
                  }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '4px',
                    color: '#e4e4e4',
                    fontSize: '0.9rem',
                    marginBottom: '0.5rem'
                  }}
                >
                  <option value="">Select a feat...</option>
                  {categorized.available.length > 0 && (
                    <optgroup label="Available" style={{ color: '#2ecc71' }}>
                      {categorized.available.map(feat => (
                        <option key={feat.key} value={feat.key}>{featsData[feat.key].name}</option>
                      ))}
                    </optgroup>
                  )}
                  {categorized.unavailable.length > 0 && (
                    <optgroup label="Unavailable (Ability Scores)" style={{ color: '#f39c12' }}>
                      {categorized.unavailable.map(feat => (
                        <option key={feat.key} value={feat.key} disabled style={{ color: '#888' }}>
                          {featsData[feat.key].name} - {feat.prereqs.filter(p => !p.met).map(p => p.requirement).join(', ')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {categorized.restricted.length > 0 && (
                    <optgroup label="Restricted (Class-Locked)" style={{ color: '#e74c3c' }}>
                      {categorized.restricted.map(feat => (
                        <option key={feat.key} value={feat.key} disabled style={{ color: '#666' }}>
                          {featsData[feat.key].name} - {feat.prereqs.filter(p => !p.met).map(p => p.requirement).join(', ')}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )
            })()}
            <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.5rem' }}>
              <span style={{ color: '#2ecc71', marginRight: '1rem' }}>Available: {getCategorizedFeats().available.length}</span>
              <span style={{ color: '#f39c12', marginRight: '1rem' }}>Unavailable: {getCategorizedFeats().unavailable.length}</span>
              <span style={{ color: '#e74c3c' }}>Restricted: {getCategorizedFeats().restricted.length}</span>
            </div>
            {formData.selected_feat && featsData[formData.selected_feat] && (
              <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px' }}>
                <p style={{ fontSize: '0.85rem', color: '#f1c40f', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {featsData[formData.selected_feat].name}
                </p>
                <p style={{ fontSize: '0.8rem', color: '#bbb', marginBottom: '0.5rem' }}>
                  {featsData[formData.selected_feat].description}
                </p>
                {featsData[formData.selected_feat].prerequisites && (
                  <div style={{ fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                    <strong style={{ color: '#bbb' }}>Prerequisites:</strong>
                    {(() => {
                      const detailed = checkFeatPrerequisitesDetailed(formData.selected_feat)
                      return (
                        <div style={{ marginTop: '0.25rem' }}>
                          {detailed.prereqs.map((prereq, idx) => (
                            <span
                              key={idx}
                              style={{
                                display: 'inline-block',
                                marginRight: '0.5rem',
                                marginBottom: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '3px',
                                background: prereq.met ? 'rgba(46, 204, 113, 0.2)' : 'rgba(231, 76, 60, 0.2)',
                                border: `1px solid ${prereq.met ? '#2ecc71' : '#e74c3c'}`,
                                color: prereq.met ? '#2ecc71' : '#e74c3c'
                              }}
                            >
                              {prereq.met ? '✓' : '✗'} {prereq.requirement}
                              {!prereq.met && prereq.current && (
                                <span style={{ color: '#888', marginLeft: '0.25rem' }}>
                                  (Current: {prereq.current})
                                </span>
                              )}
                            </span>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                )}
                <ul style={{ fontSize: '0.8rem', color: '#ccc', marginLeft: '1rem', marginTop: '0.5rem' }}>
                  {featsData[formData.selected_feat].benefits.map((benefit, idx) => (
                    <li key={idx}>{benefit}</li>
                  ))}
                </ul>

                {/* Feat Ability Score Increase */}
                {featsData[formData.selected_feat].abilityIncrease && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(46, 204, 113, 0.1)', borderRadius: '4px', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                    {featsData[formData.selected_feat].abilityIncrease.ability ? (
                      // Fixed ability increase
                      <p style={{ fontSize: '0.8rem', color: '#2ecc71' }}>
                        <strong>Ability Increase:</strong> +{featsData[formData.selected_feat].abilityIncrease.amount} {featsData[formData.selected_feat].abilityIncrease.ability.toUpperCase()}
                      </p>
                    ) : featsData[formData.selected_feat].abilityIncrease.choice ? (
                      // Choice of ability increase
                      <div>
                        <label style={{ fontSize: '0.8rem', color: '#2ecc71', display: 'block', marginBottom: '0.25rem' }}>
                          <strong>Choose Ability Increase (+{featsData[formData.selected_feat].abilityIncrease.amount}):</strong>
                        </label>
                        <select
                          value={formData.feat_ability_choice || ''}
                          onChange={(e) => handleChange('feat_ability_choice', e.target.value || null)}
                          style={{
                            width: '100%',
                            padding: '0.5rem',
                            background: 'rgba(255, 255, 255, 0.1)',
                            border: '1px solid rgba(46, 204, 113, 0.5)',
                            borderRadius: '4px',
                            color: '#e4e4e4',
                            fontSize: '0.85rem'
                          }}
                        >
                          <option value="">Select ability...</option>
                          {featsData[formData.selected_feat].abilityIncrease.choice.map(ability => (
                            <option key={ability} value={ability}>{ability.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Feat Choices (e.g., Magic Initiate class, Elemental Adept damage type) */}
                {featsData[formData.selected_feat].choices && (
                  <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(155, 89, 182, 0.1)', borderRadius: '4px', border: '1px solid rgba(155, 89, 182, 0.3)' }}>
                    {Object.entries(featsData[formData.selected_feat].choices).map(([choiceKey, options]) => {
                      const labels = {
                        class: 'Spellcasting Class',
                        damageType: 'Damage Type'
                      }
                      const descriptions = {
                        class: 'Choose a class to learn spells from',
                        damageType: 'Choose a damage type for this feat'
                      }
                      return (
                        <div key={choiceKey}>
                          <label style={{ fontSize: '0.8rem', color: '#9b59b6', display: 'block', marginBottom: '0.25rem' }}>
                            <strong>{labels[choiceKey] || choiceKey}:</strong>
                            <span style={{ fontWeight: 'normal', marginLeft: '0.5rem', color: '#888' }}>
                              {descriptions[choiceKey] || ''}
                            </span>
                          </label>
                          <select
                            value={formData.feat_choices[choiceKey] || ''}
                            onChange={(e) => handleChange('feat_choices', { ...formData.feat_choices, [choiceKey]: e.target.value || null })}
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              background: 'rgba(255, 255, 255, 0.1)',
                              border: '1px solid rgba(155, 89, 182, 0.5)',
                              borderRadius: '4px',
                              color: '#e4e4e4',
                              fontSize: '0.85rem'
                            }}
                          >
                            <option value="">Select {labels[choiceKey]?.toLowerCase() || choiceKey}...</option>
                            {options.map(option => (
                              <option key={option} value={option}>
                                {option.charAt(0).toUpperCase() + option.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cantrip Selection for Spellcasting Classes */}
        {selectedClassData?.spellcasting && selectedClassData.spellcasting.cantripsKnown[0] > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(155, 89, 182, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(155, 89, 182, 0.3)'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#9b59b6' }}>
              Cantrips Known
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '1rem' }}>
              Choose {selectedClassData.spellcasting.cantripsKnown[0]} cantrips from the {selectedClassData.name} spell list.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
              {(spellsData.cantrips[formData.class] || []).map(cantrip => {
                const isSelected = formData.selected_cantrips.includes(cantrip.name)
                const isDisabled = !isSelected && formData.selected_cantrips.length >= selectedClassData.spellcasting.cantripsKnown[0]

                return (
                  <button
                    key={cantrip.name}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        handleChange('selected_cantrips', formData.selected_cantrips.filter(c => c !== cantrip.name))
                      } else if (formData.selected_cantrips.length < selectedClassData.spellcasting.cantripsKnown[0]) {
                        handleChange('selected_cantrips', [...formData.selected_cantrips, cantrip.name])
                      }
                    }}
                    style={{
                      padding: '0.5rem',
                      background: isSelected ? 'rgba(155, 89, 182, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                      border: isSelected ? '2px solid #9b59b6' : '2px solid transparent',
                      borderRadius: '4px',
                      color: isSelected ? '#9b59b6' : (isDisabled ? '#666' : '#ccc'),
                      cursor: isDisabled && !isSelected ? 'not-allowed' : 'pointer',
                      fontSize: '0.85rem',
                      textAlign: 'left'
                    }}
                    title={cantrip.description}
                  >
                    {isSelected ? '● ' : '○ '}
                    {cantrip.name}
                    <span style={{ fontSize: '0.7rem', color: '#888', display: 'block' }}>{cantrip.school}</span>
                  </button>
                )
              })}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem' }}>
              Selected: {formData.selected_cantrips.length}/{selectedClassData.spellcasting.cantripsKnown[0]}
            </p>
          </div>
        )}

        {/* Spell Selection for "Limited Known" Spellcasters */}
        {selectedClassData?.spellcasting?.spellsKnown === 'Limited known' &&
         selectedClassData.spellcasting.spellsKnownByLevel &&
         selectedClassData.spellcasting.spellsKnownByLevel[0] > 0 && (
          <div style={{
            marginTop: '1.5rem',
            padding: '1rem',
            background: 'rgba(231, 76, 60, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(231, 76, 60, 0.3)'
          }}>
            <h4 style={{ marginBottom: '0.5rem', color: '#e74c3c' }}>
              Spells Known
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#bbb', marginBottom: '1rem' }}>
              Choose {selectedClassData.spellcasting.spellsKnownByLevel[0]} 1st-level spells from the {selectedClassData.name} spell list.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
              {(spellsData.spells['1st'] || [])
                .filter(spell => spell.classes.includes(formData.class))
                .map(spell => {
                  const isSelected = formData.selected_spells.includes(spell.name)
                  const isDisabled = !isSelected && formData.selected_spells.length >= selectedClassData.spellcasting.spellsKnownByLevel[0]

                  return (
                    <button
                      key={spell.name}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          handleChange('selected_spells', formData.selected_spells.filter(s => s !== spell.name))
                        } else if (formData.selected_spells.length < selectedClassData.spellcasting.spellsKnownByLevel[0]) {
                          handleChange('selected_spells', [...formData.selected_spells, spell.name])
                        }
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        background: isSelected ? 'rgba(231, 76, 60, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                        border: isSelected ? '2px solid #e74c3c' : '2px solid transparent',
                        borderRadius: '4px',
                        color: isSelected ? '#e74c3c' : (isDisabled ? '#666' : '#ccc'),
                        cursor: isDisabled && !isSelected ? 'not-allowed' : 'pointer',
                        fontSize: '0.85rem',
                        textAlign: 'left'
                      }}
                      title={spell.description}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{isSelected ? '● ' : '○ '}{spell.name}</span>
                        <span style={{ fontSize: '0.7rem', color: '#888' }}>{spell.school}</span>
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#888', display: 'block', marginTop: '0.25rem' }}>
                        {spell.castingTime} | {spell.range} | {spell.duration}
                      </span>
                    </button>
                  )
                })}
            </div>
            <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.75rem' }}>
              Selected: {formData.selected_spells.length}/{selectedClassData.spellcasting.spellsKnownByLevel[0]}
            </p>
          </div>
        )}

        {/* Info box for prepared casters */}
        {selectedClassData?.spellcasting?.spellsKnown === 'All prepared' &&
         selectedClassData.spellcasting.cantripsKnown[0] > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(52, 152, 219, 0.1)',
            borderRadius: '6px',
            border: '1px solid rgba(52, 152, 219, 0.2)',
            fontSize: '0.85rem',
            color: '#888'
          }}>
            <strong style={{ color: '#3498db' }}>Note:</strong> As a {selectedClassData.name}, you prepare spells each day from the full {selectedClassData.name.toLowerCase()} spell list.
            You don't need to choose specific spells at character creation (except cantrips, which are permanent).
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => setStep(1)} className="button" style={{ flex: 1, background: '#95a5a6' }}>
            Back
          </button>
          <button
            onClick={() => setStep(3)}
            className="button"
            style={{ flex: 1 }}
            disabled={
              !allAbilitiesAssigned() ||
              (selectedClassData && formData.selected_skills.length < selectedClassData.skillChoices) ||
              (formData.subrace === 'Variant Human' && !formData.selected_feat) ||
              (formData.selected_feat && featsData[formData.selected_feat]?.abilityIncrease?.choice && !formData.feat_ability_choice) ||
              (formData.selected_feat && featsData[formData.selected_feat]?.choices && Object.keys(featsData[formData.selected_feat].choices).some(key => !formData.feat_choices?.[key])) ||
              (selectedClassData?.spellcasting?.cantripsKnown[0] > 0 && formData.selected_cantrips.length < selectedClassData.spellcasting.cantripsKnown[0]) ||
              (selectedClassData?.spellcasting?.spellsKnown === 'Limited known' && selectedClassData?.spellcasting?.spellsKnownByLevel?.[0] > 0 && formData.selected_spells.length < selectedClassData.spellcasting.spellsKnownByLevel[0])
            }
          >
            Next: Character Details
          </button>
        </div>
      </div>
    )
  }

  const renderStep3 = () => (
    <div>
      <h3>Character Details</h3>

      <div className="form-group">
        <label>Alignment</label>
        <select
          value={formData.alignment}
          onChange={(e) => handleChange('alignment', e.target.value)}
          required
        >
          <option value="">Select alignment</option>
          {ALIGNMENTS.map(alignment => (
            <option key={alignment.value} value={alignment.value}>
              {alignment.label}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label>Faith / Deity</label>
        <select
          value={formData.faith}
          onChange={(e) => handleChange('faith', e.target.value)}
        >
          <option value="">Select deity or belief</option>
          {deities.map(deityKey => (
            <option key={deityKey} value={deityKey}>
              {deitiesData[deityKey].name}
            </option>
          ))}
        </select>
        {formData.faith && deitiesData[formData.faith] && deitiesData[formData.faith].description && (
          <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
            {deitiesData[formData.faith].description}
          </small>
        )}
      </div>

      <div className="form-group">
        <label>Lifestyle</label>
        <select
          value={formData.lifestyle}
          onChange={(e) => handleChange('lifestyle', e.target.value)}
          required
        >
          <option value="">Select lifestyle</option>
          {LIFESTYLES.map(lifestyle => (
            <option key={lifestyle.value} value={lifestyle.value}>
              {lifestyle.label}
            </option>
          ))}
        </select>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', color: '#3498db' }}>Physical Appearance</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Hair Color (Optional)</label>
          <input
            type="text"
            value={formData.hair_color}
            onChange={(e) => handleChange('hair_color', e.target.value)}
            placeholder="e.g., Black, Blonde, Red"
          />
        </div>

        <div className="form-group">
          <label>Eye Color (Optional)</label>
          <input
            type="text"
            value={formData.eye_color}
            onChange={(e) => handleChange('eye_color', e.target.value)}
            placeholder="e.g., Blue, Green, Brown"
          />
        </div>
      </div>

      <div className="form-group">
        <label>Skin Color (Optional)</label>
        <input
          type="text"
          value={formData.skin_color}
          onChange={(e) => handleChange('skin_color', e.target.value)}
          placeholder="e.g., Fair, Tan, Dark, Bronze"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
        <div className="form-group">
          <label>Height (Optional)</label>
          <input
            type="text"
            value={formData.height}
            onChange={(e) => handleChange('height', e.target.value)}
            placeholder="e.g., 5'8&quot;, 173cm"
          />
        </div>

        <div className="form-group">
          <label>Weight (Optional)</label>
          <input
            type="text"
            value={formData.weight}
            onChange={(e) => handleChange('weight', e.target.value)}
            placeholder="e.g., 150 lbs, 68 kg"
          />
        </div>

        <div className="form-group">
          <label>Age (Optional)</label>
          <input
            type="text"
            value={formData.age}
            onChange={(e) => handleChange('age', e.target.value)}
            placeholder="e.g., 25, 140 years"
          />
        </div>
      </div>

      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem', color: '#3498db' }}>Personality & Background</h4>

      {selectedBackgroundData && selectedBackgroundData.personalityTraits && (
        <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '1rem' }}>
          Click the dice button to roll for suggestions from the {selectedBackgroundData.name} background, or write your own!
        </p>
      )}

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <label style={{ margin: 0 }}>Personality Traits (Optional)</label>
          {selectedBackgroundData && selectedBackgroundData.personalityTraits && (
            <button
              type="button"
              onClick={() => {
                const traits = selectedBackgroundData.personalityTraits
                const randomTrait = traits[Math.floor(Math.random() * traits.length)]
                const currentTraits = formData.personality_traits
                handleChange('personality_traits', currentTraits ? `${currentTraits}\n${randomTrait}` : randomTrait)
              }}
              style={{
                background: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'white'
              }}
              title="Roll for a random personality trait"
            >
              🎲 Roll
            </button>
          )}
        </div>
        <textarea
          value={formData.personality_traits}
          onChange={(e) => handleChange('personality_traits', e.target.value)}
          placeholder="Describe your character's personality traits..."
          rows="3"
        />
        {selectedBackgroundData && selectedBackgroundData.personalityTraits && (
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#bbb' }}>
              View all {selectedBackgroundData.name} personality traits ({selectedBackgroundData.personalityTraits.length})
            </summary>
            <ul style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem', marginLeft: '1rem' }}>
              {selectedBackgroundData.personalityTraits.map((trait, idx) => (
                <li
                  key={idx}
                  style={{ marginBottom: '0.25rem', cursor: 'pointer' }}
                  onClick={() => {
                    const currentTraits = formData.personality_traits
                    handleChange('personality_traits', currentTraits ? `${currentTraits}\n${trait}` : trait)
                  }}
                  title="Click to add this trait"
                >
                  {idx + 1}. {trait}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <label style={{ margin: 0 }}>Ideals (Optional)</label>
          {selectedBackgroundData && selectedBackgroundData.ideals && (
            <button
              type="button"
              onClick={() => {
                const ideals = selectedBackgroundData.ideals
                const randomIdeal = ideals[Math.floor(Math.random() * ideals.length)]
                const idealText = `${randomIdeal.ideal}: ${randomIdeal.description} (${randomIdeal.alignment})`
                handleChange('ideals', idealText)
              }}
              style={{
                background: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'white'
              }}
              title="Roll for a random ideal"
            >
              🎲 Roll
            </button>
          )}
        </div>
        <textarea
          value={formData.ideals}
          onChange={(e) => handleChange('ideals', e.target.value)}
          placeholder="What are your character's core beliefs and values?"
          rows="2"
        />
        {selectedBackgroundData && selectedBackgroundData.ideals && (
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#bbb' }}>
              View all {selectedBackgroundData.name} ideals ({selectedBackgroundData.ideals.length})
            </summary>
            <ul style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem', marginLeft: '1rem' }}>
              {selectedBackgroundData.ideals.map((ideal, idx) => (
                <li
                  key={idx}
                  style={{ marginBottom: '0.25rem', cursor: 'pointer' }}
                  onClick={() => handleChange('ideals', `${ideal.ideal}: ${ideal.description} (${ideal.alignment})`)}
                  title="Click to select this ideal"
                >
                  {idx + 1}. <strong>{ideal.ideal}</strong> ({ideal.alignment}): {ideal.description}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <label style={{ margin: 0 }}>Bonds (Optional)</label>
          {selectedBackgroundData && selectedBackgroundData.bonds && (
            <button
              type="button"
              onClick={() => {
                const bonds = selectedBackgroundData.bonds
                const randomBond = bonds[Math.floor(Math.random() * bonds.length)]
                handleChange('bonds', randomBond)
              }}
              style={{
                background: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'white'
              }}
              title="Roll for a random bond"
            >
              🎲 Roll
            </button>
          )}
        </div>
        <textarea
          value={formData.bonds}
          onChange={(e) => handleChange('bonds', e.target.value)}
          placeholder="What connections does your character have to people, places, or things?"
          rows="2"
        />
        {selectedBackgroundData && selectedBackgroundData.bonds && (
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#bbb' }}>
              View all {selectedBackgroundData.name} bonds ({selectedBackgroundData.bonds.length})
            </summary>
            <ul style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem', marginLeft: '1rem' }}>
              {selectedBackgroundData.bonds.map((bond, idx) => (
                <li
                  key={idx}
                  style={{ marginBottom: '0.25rem', cursor: 'pointer' }}
                  onClick={() => handleChange('bonds', bond)}
                  title="Click to select this bond"
                >
                  {idx + 1}. {bond}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <label style={{ margin: 0 }}>Flaws (Optional)</label>
          {selectedBackgroundData && selectedBackgroundData.flaws && (
            <button
              type="button"
              onClick={() => {
                const flaws = selectedBackgroundData.flaws
                const randomFlaw = flaws[Math.floor(Math.random() * flaws.length)]
                handleChange('flaws', randomFlaw)
              }}
              style={{
                background: '#9b59b6',
                border: 'none',
                borderRadius: '4px',
                padding: '0.25rem 0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                color: 'white'
              }}
              title="Roll for a random flaw"
            >
              🎲 Roll
            </button>
          )}
        </div>
        <textarea
          value={formData.flaws}
          onChange={(e) => handleChange('flaws', e.target.value)}
          placeholder="What are your character's weaknesses or vices?"
          rows="2"
        />
        {selectedBackgroundData && selectedBackgroundData.flaws && (
          <details style={{ marginTop: '0.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#bbb' }}>
              View all {selectedBackgroundData.name} flaws ({selectedBackgroundData.flaws.length})
            </summary>
            <ul style={{ fontSize: '0.75rem', color: '#aaa', marginTop: '0.5rem', marginLeft: '1rem' }}>
              {selectedBackgroundData.flaws.map((flaw, idx) => (
                <li
                  key={idx}
                  style={{ marginBottom: '0.25rem', cursor: 'pointer' }}
                  onClick={() => handleChange('flaws', flaw)}
                  title="Click to select this flaw"
                >
                  {idx + 1}. {flaw}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="form-group">
        <label>Organizations (Optional)</label>
        <textarea
          value={formData.organizations}
          onChange={(e) => handleChange('organizations', e.target.value)}
          placeholder="List any guilds, factions, or organizations your character belongs to..."
          rows="2"
        />
      </div>

      <div className="form-group">
        <label>Allies (Optional)</label>
        <textarea
          value={formData.allies}
          onChange={(e) => handleChange('allies', e.target.value)}
          placeholder="Describe your character's allies and friends..."
          rows="2"
        />
      </div>

      <div className="form-group">
        <label>Enemies (Optional)</label>
        <textarea
          value={formData.enemies}
          onChange={(e) => handleChange('enemies', e.target.value)}
          placeholder="Describe your character's enemies and rivals..."
          rows="2"
        />
      </div>

      <div className="form-group">
        <label>Backstory (Optional)</label>
        <textarea
          value={formData.backstory}
          onChange={(e) => handleChange('backstory', e.target.value)}
          placeholder="Tell your character's story..."
          rows="5"
        />
      </div>

      <div className="form-group">
        <label>Other Notes (Optional)</label>
        <textarea
          value={formData.other_notes}
          onChange={(e) => handleChange('other_notes', e.target.value)}
          placeholder="Any additional notes or details about your character..."
          rows="3"
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
        <button onClick={() => setStep(2)} className="button" style={{ flex: 1, background: '#95a5a6' }}>
          Back
        </button>
        <button
          onClick={() => setStep(4)}
          className="button"
          style={{ flex: 1 }}
          disabled={!formData.alignment || !formData.lifestyle}
        >
          Next: Equipment
        </button>
      </div>
    </div>
  )

  const renderStep4 = () => {
    // Roll starting gold based on class dice
    const rollStartingGold = () => {
      if (!selectedClassData?.startingGold) return
      const { dice, multiplier } = selectedClassData.startingGold
      const match = dice.match(/(\d+)d(\d+)/)
      if (!match) return

      const numDice = parseInt(match[1])
      const dieSize = parseInt(match[2])
      let total = 0
      for (let i = 0; i < numDice; i++) {
        total += Math.floor(Math.random() * dieSize) + 1
      }
      handleChange('starting_gold', total * multiplier)
      handleChange('manual_gold', '')
    }

    const handleEquipmentSelect = (choiceIndex, value) => {
      setFormData(prev => ({
        ...prev,
        equipment_selections: {
          ...prev.equipment_selections,
          [choiceIndex]: value
        },
        // Clear sub-selection when main selection changes
        equipment_sub_selections: {
          ...prev.equipment_sub_selections,
          [choiceIndex]: ''
        }
      }))
    }

    const handleSubSelect = (choiceIndex, value) => {
      setFormData(prev => ({
        ...prev,
        equipment_sub_selections: {
          ...prev.equipment_sub_selections,
          [choiceIndex]: value
        }
      }))
    }

    // Determine what type of equipment this choice is for (weapon, armor, pack, etc.)
    const getChoiceLabel = (choice, idx) => {
      const options = choice.from
      const optionsLower = options.map(o => o.toLowerCase())

      // Check for weapon choices
      const hasWeapon = optionsLower.some(o =>
        o.includes('weapon') || o.includes('sword') || o.includes('axe') ||
        o.includes('mace') || o.includes('crossbow') || o.includes('bow') ||
        o.includes('dagger') || o.includes('hammer') || o.includes('javelin') ||
        o.includes('spear') || o.includes('staff') || o.includes('rapier') ||
        o.includes('scimitar') || o.includes('shortsword') || o.includes('longsword')
      )

      // Check for armor choices
      const hasArmor = optionsLower.some(o =>
        o.includes('armor') || o.includes('mail') || o.includes('leather') ||
        o.includes('scale') || o.includes('shield')
      )

      // Check for pack choices
      const hasPack = optionsLower.some(o => o.includes('pack'))

      // Check for focus/component choices
      const hasFocus = optionsLower.some(o =>
        o.includes('focus') || o.includes('component') || o.includes('pouch') ||
        o.includes('symbol')
      )

      // Check for instrument choices
      const hasInstrument = optionsLower.some(o =>
        o.includes('instrument') || o.includes('lute') || o.includes('flute') ||
        o.includes('drum') || o.includes('lyre') || o.includes('horn')
      )

      if (hasPack) return 'Adventure Pack'
      if (hasArmor && !hasWeapon) return 'Armor'
      if (hasFocus) return 'Spellcasting Focus'
      if (hasInstrument) return 'Musical Instrument'
      if (hasWeapon) {
        // Try to be more specific about weapon type
        if (optionsLower.some(o => o.includes('martial'))) return 'Primary Weapon'
        if (optionsLower.some(o => o.includes('ranged') || o.includes('crossbow') || o.includes('bow'))) return 'Ranged Weapon'
        if (idx === 0) return 'Primary Weapon'
        return 'Secondary Weapon'
      }

      return `Option ${idx + 1}`
    }

    // Check if an option needs a sub-dropdown (generic weapon/armor choices)
    const needsSubDropdown = (option) => {
      const lower = option.toLowerCase()
      return lower.includes('any simple weapon') ||
             lower.includes('any simple melee weapon') ||
             lower.includes('any martial weapon') ||
             lower.includes('any martial melee weapon') ||
             lower.includes('any other musical instrument') ||
             lower.includes('martial weapon and shield') ||
             lower.includes('two martial weapons') ||
             lower.includes('two simple melee weapons')
    }

    // Get sub-options for a generic choice
    const getSubOptions = (option) => {
      const lower = option.toLowerCase()

      if (lower.includes('any simple melee weapon') || lower === 'any simple weapon') {
        return equipmentData.simpleWeapons.melee.map(w => w.name)
      }
      if (lower.includes('any simple weapon')) {
        return [
          ...equipmentData.simpleWeapons.melee.map(w => w.name),
          ...equipmentData.simpleWeapons.ranged.map(w => w.name)
        ]
      }
      if (lower.includes('any martial melee weapon')) {
        return equipmentData.martialWeapons.melee.map(w => w.name)
      }
      if (lower.includes('any martial weapon') || lower.includes('martial weapon and shield') || lower.includes('two martial weapons')) {
        return [
          ...equipmentData.martialWeapons.melee.map(w => w.name),
          ...equipmentData.martialWeapons.ranged.map(w => w.name)
        ]
      }
      if (lower.includes('two simple melee weapons')) {
        return equipmentData.simpleWeapons.melee.map(w => w.name)
      }
      if (lower.includes('any other musical instrument')) {
        return equipmentData.musicalInstruments
      }

      return []
    }

    // Check if option is a pack
    const isPack = (option) => {
      return option.toLowerCase().includes('pack')
    }

    // Get pack contents
    const getPackContents = (packName) => {
      // Extract pack name from option (e.g., "Priest's Pack" from option)
      const packKeys = Object.keys(equipmentData.packs)
      const matchedPack = packKeys.find(key => packName.toLowerCase().includes(key.toLowerCase()))
      if (matchedPack) {
        return equipmentData.packs[matchedPack]
      }
      return null
    }

    // Calculate background gold
    const getBackgroundGold = () => {
      const bgEquip = selectedBackgroundData?.equipment || []
      const goldItem = bgEquip.find(item => item.toLowerCase().includes('gp'))
      if (goldItem) {
        const match = goldItem.match(/(\d+)\s*gp/)
        if (match) return parseInt(match[1])
      }
      return 0
    }

    const backgroundGold = getBackgroundGold()

    // In edit mode, show preserved equipment/gold info instead of selection
    if (isEditMode) {
      const existingInventory = typeof editCharacter.inventory === 'string'
        ? JSON.parse(editCharacter.inventory || '[]')
        : (editCharacter.inventory || [])

      return (
        <div>
          <h3>Equipment & Gold (Preserved)</h3>
          <div style={{
            padding: '1rem',
            background: 'rgba(241, 196, 15, 0.1)',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid rgba(241, 196, 15, 0.3)'
          }}>
            <p style={{ color: '#f1c40f', marginBottom: '1rem' }}>
              Your earned gold and inventory will be preserved when you save changes.
            </p>

            <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>Current Gold</h4>
            <p style={{ color: '#bbb', marginBottom: '1rem' }}>
              {editCharacter.gold_gp || 0} gp, {editCharacter.gold_sp || 0} sp, {editCharacter.gold_cp || 0} cp
            </p>

            <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>Current Inventory ({existingInventory.length} items)</h4>
            {existingInventory.length > 0 ? (
              <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1.25rem', maxHeight: '200px', overflowY: 'auto' }}>
                {existingInventory.map((item, idx) => (
                  <li key={idx}>
                    {typeof item === 'string' ? item : item.name}
                    {item.quantity && item.quantity > 1 ? ` (x${item.quantity})` : ''}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ color: '#888', fontSize: '0.85rem' }}>No items in inventory</p>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <button onClick={() => setStep(3)} className="button" style={{ flex: 1, background: '#95a5a6' }}>
              Back
            </button>
            <button onClick={() => setStep(5)} className="button" style={{ flex: 1 }}>
              Next: Review
            </button>
          </div>
        </div>
      )
    }

    return (
      <div>
        <h3>Starting Equipment & Gold</h3>
        <p style={{ fontSize: '0.9rem', color: '#bbb', marginBottom: '1rem' }}>
          Choose whether to start with class equipment or roll for gold to buy your own gear.
        </p>

        {/* Equipment vs Gold Choice */}
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
          <button
            type="button"
            onClick={() => handleChange('equipment_choice', 'equipment')}
            style={{
              flex: 1,
              padding: '1rem',
              background: formData.equipment_choice === 'equipment' ? 'rgba(46, 204, 113, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: formData.equipment_choice === 'equipment' ? '2px solid #2ecc71' : '2px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Class Equipment</div>
            <div style={{ fontSize: '0.8rem', color: '#bbb' }}>
              Start with standard equipment for your class
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleChange('equipment_choice', 'gold')}
            style={{
              flex: 1,
              padding: '1rem',
              background: formData.equipment_choice === 'gold' ? 'rgba(241, 196, 15, 0.2)' : 'rgba(255, 255, 255, 0.05)',
              border: formData.equipment_choice === 'gold' ? '2px solid #f1c40f' : '2px solid transparent',
              borderRadius: '8px',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>Starting Gold</div>
            <div style={{ fontSize: '0.8rem', color: '#bbb' }}>
              Roll {selectedClassData?.startingGold?.dice} × {selectedClassData?.startingGold?.multiplier} gp
              (avg: {selectedClassData?.startingGold?.average} gp)
            </div>
          </button>
        </div>

        {/* Class Equipment Selection */}
        {formData.equipment_choice === 'equipment' && selectedClassData?.startingEquipment && (
          <div style={{
            padding: '1rem',
            background: 'rgba(46, 204, 113, 0.1)',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ color: '#2ecc71', marginBottom: '1rem' }}>
              {selectedClassData.name} Starting Equipment
            </h4>

            {/* Equipment Choices */}
            {selectedClassData.startingEquipment.choices?.map((choice, idx) => {
              const selectedOption = formData.equipment_selections[idx] || ''
              const showSubDropdown = selectedOption && needsSubDropdown(selectedOption)
              const subOptions = showSubDropdown ? getSubOptions(selectedOption) : []

              return (
                <div key={idx} className="form-group" style={{ marginBottom: '1rem' }}>
                  <label style={{ color: '#2ecc71', fontSize: '0.9rem', fontWeight: 'bold' }}>
                    Choose {choice.choose} {getChoiceLabel(choice, idx)}:
                  </label>
                  <select
                    value={selectedOption}
                    onChange={(e) => handleEquipmentSelect(idx, e.target.value)}
                    style={{ marginTop: '0.25rem' }}
                  >
                    <option value="">Select an option</option>
                    {choice.from.map((option, optIdx) => {
                      const packInfo = isPack(option) ? getPackContents(option) : null
                      return (
                        <option key={optIdx} value={option}>
                          {option}{packInfo ? ` (${packInfo.cost})` : ''}
                        </option>
                      )
                    })}
                  </select>

                  {/* Pack contents tooltip */}
                  {selectedOption && isPack(selectedOption) && (() => {
                    const packInfo = getPackContents(selectedOption)
                    if (!packInfo) return null
                    return (
                      <div style={{
                        marginTop: '0.5rem',
                        padding: '0.5rem',
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        fontSize: '0.8rem'
                      }}>
                        <strong style={{ color: '#2ecc71' }}>Pack Contents:</strong>
                        <ul style={{ margin: '0.25rem 0 0 1rem', color: '#bbb' }}>
                          {packInfo.contents.map((item, i) => (
                            <li key={i}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )
                  })()}

                  {/* Sub-dropdown for generic choices */}
                  {showSubDropdown && subOptions.length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <label style={{ color: '#bbb', fontSize: '0.85rem' }}>
                        Select specific {selectedOption.toLowerCase().includes('instrument') ? 'instrument' : 'weapon'}:
                      </label>
                      <select
                        value={formData.equipment_sub_selections[idx] || ''}
                        onChange={(e) => handleSubSelect(idx, e.target.value)}
                        style={{ marginTop: '0.25rem' }}
                      >
                        <option value="">Choose one</option>
                        {subOptions.map((subOpt, subIdx) => (
                          <option key={subIdx} value={subOpt}>{subOpt}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )
            })}

            {/* Given Equipment */}
            {selectedClassData.startingEquipment.given && (
              <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(46, 204, 113, 0.3)' }}>
                <p style={{ color: '#2ecc71', fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  You also receive:
                </p>
                <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1.25rem' }}>
                  {selectedClassData.startingEquipment.given.map((item, idx) => {
                    const packInfo = isPack(item) ? getPackContents(item) : null
                    return (
                      <li key={idx}>
                        {item}
                        {packInfo && (
                          <details style={{ marginTop: '0.25rem', marginLeft: '0.5rem' }}>
                            <summary style={{ cursor: 'pointer', fontSize: '0.75rem', color: '#888' }}>
                              View pack contents
                            </summary>
                            <ul style={{ fontSize: '0.75rem', color: '#888', marginTop: '0.25rem' }}>
                              {packInfo.contents.map((content, i) => (
                                <li key={i}>{content}</li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Starting Gold */}
        {formData.equipment_choice === 'gold' && (
          <div style={{
            padding: '1rem',
            background: 'rgba(241, 196, 15, 0.1)',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>
              Class Starting Gold
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.75rem' }}>
              As a {selectedClassData?.name}, you can roll {selectedClassData?.startingGold?.dice} × {selectedClassData?.startingGold?.multiplier} gp to buy your own equipment instead of taking the class equipment above.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={rollStartingGold}
                style={{
                  background: '#f1c40f',
                  color: '#1a1a2e',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🎲 Roll for Gold
              </button>
              <button
                type="button"
                onClick={() => {
                  handleChange('starting_gold', selectedClassData?.startingGold?.average || 0)
                  handleChange('manual_gold', '')
                }}
                style={{
                  background: 'rgba(241, 196, 15, 0.2)',
                  color: '#f1c40f',
                  border: '1px solid #f1c40f',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Use Average ({selectedClassData?.startingGold?.average} gp)
              </button>
            </div>

            {/* Manual Entry */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
                Or enter manually:
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                  type="number"
                  min="0"
                  value={formData.manual_gold}
                  onChange={(e) => {
                    const val = e.target.value
                    handleChange('manual_gold', val)
                    if (val !== '') {
                      handleChange('starting_gold', parseInt(val) || 0)
                    }
                  }}
                  placeholder="Enter gold amount"
                  style={{ width: '150px' }}
                />
                <span style={{ color: '#f1c40f', fontWeight: 'bold' }}>gp</span>
              </div>
            </div>

            <div style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#f1c40f',
              padding: '0.5rem',
              background: 'rgba(241, 196, 15, 0.1)',
              borderRadius: '4px',
              textAlign: 'center'
            }}>
              Class Gold: {formData.starting_gold > 0 ? `${formData.starting_gold} gp` : '-- gp'}
            </div>
          </div>
        )}

        {/* Background Equipment */}
        {selectedBackgroundData?.equipment && (
          <div style={{
            padding: '1rem',
            background: 'rgba(52, 152, 219, 0.1)',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>
              {selectedBackgroundData.name} Background Equipment
            </h4>
            <p style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
              In addition to your class equipment/gold, you receive the following from your background:
            </p>
            <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1.25rem' }}>
              {selectedBackgroundData.equipment.map((item, idx) => (
                <li key={idx} style={{
                  color: item.toLowerCase().includes('gp') ? '#f1c40f' : '#bbb',
                  fontWeight: item.toLowerCase().includes('gp') ? 'bold' : 'normal'
                }}>
                  {item}
                  {item.toLowerCase().includes('gp') && ' (Background Gold)'}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Total Gold Summary */}
        {(formData.equipment_choice === 'gold' || backgroundGold > 0) && (
          <div style={{
            padding: '1rem',
            background: 'rgba(241, 196, 15, 0.15)',
            borderRadius: '8px',
            marginBottom: '1rem',
            border: '1px solid rgba(241, 196, 15, 0.3)'
          }}>
            <h4 style={{ color: '#f1c40f', marginBottom: '0.5rem' }}>Total Starting Gold</h4>
            <div style={{ fontSize: '0.9rem', color: '#bbb' }}>
              {formData.equipment_choice === 'gold' && (
                <p>Class ({selectedClassData?.name}): <strong style={{ color: '#f1c40f' }}>{formData.starting_gold} gp</strong></p>
              )}
              {backgroundGold > 0 && (
                <p>Background ({selectedBackgroundData?.name}): <strong style={{ color: '#f1c40f' }}>{backgroundGold} gp</strong></p>
              )}
              <p style={{
                marginTop: '0.5rem',
                paddingTop: '0.5rem',
                borderTop: '1px solid rgba(241, 196, 15, 0.3)',
                fontSize: '1.1rem'
              }}>
                Total: <strong style={{ color: '#f1c40f', fontSize: '1.25rem' }}>
                  {(formData.equipment_choice === 'gold' ? formData.starting_gold : 0) + backgroundGold} gp
                </strong>
              </p>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => setStep(3)} className="button" style={{ flex: 1, background: '#95a5a6' }}>
            Back
          </button>
          <button onClick={() => setStep(5)} className="button" style={{ flex: 1 }}>
            Next: Review
          </button>
        </div>
      </div>
    )
  }

  const renderStep5 = () => {
    const finalScores = calculateFinalAbilityScores()

    // Compile final equipment list (with packs unpacked)
    const getFinalEquipment = () => {
      const rawEquipment = []

      // Add class equipment (if equipment choice)
      if (formData.equipment_choice === 'equipment' && selectedClassData?.startingEquipment) {
        // Add given items
        if (selectedClassData.startingEquipment.given) {
          rawEquipment.push(...selectedClassData.startingEquipment.given)
        }
        // Add chosen items - use sub-selections where available
        Object.entries(formData.equipment_selections).forEach(([idx, choice]) => {
          if (choice) {
            const subSelection = formData.equipment_sub_selections[idx]
            if (subSelection) {
              if (choice.toLowerCase().includes('and shield')) {
                rawEquipment.push(subSelection)
                rawEquipment.push('Shield')
              } else if (choice.toLowerCase().includes('two martial') || choice.toLowerCase().includes('two simple')) {
                rawEquipment.push(`${subSelection} (x2)`)
              } else {
                rawEquipment.push(subSelection)
              }
            } else {
              rawEquipment.push(choice)
            }
          }
        })
      }

      // Add background equipment (excluding gold pouches - we handle gold separately)
      if (selectedBackgroundData?.equipment) {
        selectedBackgroundData.equipment.forEach(item => {
          if (!item.toLowerCase().includes('pouch containing')) {
            rawEquipment.push(item)
          }
        })
      }

      // Unpack any equipment packs into their contents for display
      return unpackEquipment(rawEquipment)
    }

    const getFinalGold = () => {
      let total = 0
      if (formData.equipment_choice === 'gold') {
        total += formData.starting_gold
      }
      // Extract gold from background equipment
      const bgEquip = selectedBackgroundData?.equipment || []
      const goldItem = bgEquip.find(item => item.toLowerCase().includes('gp'))
      if (goldItem) {
        const match = goldItem.match(/(\d+)\s*gp/)
        if (match) total += parseInt(match[1])
      }
      return total
    }

    return (
      <div>
        <h3>Review Character</h3>

        <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px' }}>
          {formData.avatarPreview && (
            <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
              <img
                src={formData.avatarPreview}
                alt="Character avatar"
                style={{
                  width: '120px',
                  height: '120px',
                  objectFit: 'cover',
                  borderRadius: '50%',
                  border: '3px solid #3498db'
                }}
              />
            </div>
          )}
          <h4>{formData.first_name} {formData.last_name}</h4>
          {formData.nickname && (
            <p style={{ color: '#3498db', fontStyle: 'italic', marginTop: '0.25rem' }}>
              Known as "{formData.nickname}"
            </p>
          )}
          <p style={{ color: '#bbb' }}>
            {formData.gender && `${formData.gender} `}
            {formData.subrace || racesData[formData.race].name} {formData.class}
          </p>
          <p style={{ color: '#bbb', fontSize: '0.9rem', marginTop: '0.5rem' }}>
            <strong>Background:</strong> {backgroundsData[formData.background].name}
          </p>
          {formData.subclass && (
            <p style={{ color: '#bbb', fontSize: '0.9rem' }}>
              <strong>Subclass:</strong> {formData.subclass}
            </p>
          )}
          <p style={{ color: '#bbb', fontSize: '0.9rem' }}>
            <strong>Alignment:</strong> {ALIGNMENTS.find(a => a.value === formData.alignment)?.label}
          </p>
          {formData.faith && (
            <p style={{ color: '#bbb', fontSize: '0.9rem' }}>
              <strong>Faith:</strong> {deitiesData[formData.faith].name}
            </p>
          )}
          <p style={{ color: '#bbb', fontSize: '0.9rem' }}>
            <strong>Lifestyle:</strong> {LIFESTYLES.find(l => l.value === formData.lifestyle)?.label}
          </p>

          {/* Skill Proficiencies */}
          {(formData.selected_skills.length > 0 || selectedBackgroundData?.skillProficiencies) && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Skill Proficiencies</p>
              <p style={{ color: '#bbb', fontSize: '0.85rem' }}>
                {[...formData.selected_skills, ...(selectedBackgroundData?.skillProficiencies?.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')) || [])].join(', ')}
              </p>
            </div>
          )}

          {/* Feat (Variant Human) */}
          {formData.selected_feat && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Feat</p>
              <p style={{ color: '#9b59b6', fontSize: '0.9rem', fontWeight: 'bold' }}>
                {featsData[formData.selected_feat]?.name || formData.selected_feat}
              </p>
              {featsData[formData.selected_feat]?.abilityIncrease && (
                <p style={{ color: '#2ecc71', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                  +{featsData[formData.selected_feat].abilityIncrease.amount} {
                    featsData[formData.selected_feat].abilityIncrease.ability
                      ? featsData[formData.selected_feat].abilityIncrease.ability.toUpperCase()
                      : formData.feat_ability_choice?.toUpperCase() || '(choose ability)'
                  }
                </p>
              )}
            </div>
          )}

          {/* Cantrips */}
          {formData.selected_cantrips?.length > 0 && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Cantrips</p>
              <p style={{ color: '#3498db', fontSize: '0.85rem' }}>
                {formData.selected_cantrips.map(c => c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ')).join(', ')}
              </p>
            </div>
          )}

          {/* Known Spells (for limited-known casters) */}
          {formData.selected_spells?.length > 0 && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Known Spells</p>
              <p style={{ color: '#e67e22', fontSize: '0.85rem' }}>
                {formData.selected_spells.map(s => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')).join(', ')}
              </p>
            </div>
          )}

          {/* Equipment & Gold - show different info for edit vs create mode */}
          <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {isEditMode ? (
              <>
                <p style={{ color: '#f1c40f', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                  Preserved Progression (Level {editCharacter.level})
                </p>
                <p style={{ color: '#bbb', fontSize: '0.85rem' }}>
                  <strong>Experience:</strong> {editCharacter.experience} / {editCharacter.experience_to_next_level} XP
                </p>
                <p style={{ color: '#f1c40f', fontSize: '0.9rem' }}>
                  <strong>Gold:</strong> {editCharacter.gold_gp || 0} gp, {editCharacter.gold_sp || 0} sp, {editCharacter.gold_cp || 0} cp
                </p>
                <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Inventory and equipment will be preserved.
                </p>
              </>
            ) : (
              <>
                <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Starting Equipment</p>
                <ul style={{ fontSize: '0.85rem', color: '#bbb', marginLeft: '1rem', marginBottom: '0.5rem' }}>
                  {getFinalEquipment().map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
                <p style={{ color: '#f1c40f', fontSize: '0.9rem' }}>
                  <strong>Starting Gold:</strong> {getFinalGold()} gp
                </p>
              </>
            )}
          </div>

          {/* Physical Appearance */}
          {(formData.age || formData.height || formData.weight || formData.hair_color || formData.eye_color || formData.skin_color) && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Physical Appearance</p>
              {formData.age && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Age:</strong> {formData.age}</p>}
              {formData.height && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Height:</strong> {formData.height}</p>}
              {formData.weight && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Weight:</strong> {formData.weight}</p>}
              {formData.hair_color && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Hair:</strong> {formData.hair_color}</p>}
              {formData.eye_color && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Eyes:</strong> {formData.eye_color}</p>}
              {formData.skin_color && <p style={{ color: '#bbb', fontSize: '0.85rem', margin: '0.25rem 0' }}><strong>Skin:</strong> {formData.skin_color}</p>}
            </div>
          )}

          {/* Personality */}
          {formData.personality_traits && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.25rem' }}>Personality Traits</p>
              <p style={{ color: '#bbb', fontSize: '0.85rem' }}>{formData.personality_traits}</p>
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {Object.entries(finalScores).map(([ability, score]) => (
              <div key={ability} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.75rem', color: '#888', textTransform: 'uppercase' }}>{ability}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                  {score} ({Math.floor((score - 10) / 2) >= 0 ? '+' : ''}{Math.floor((score - 10) / 2)})
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          <button onClick={() => setStep(4)} className="button" style={{ flex: 1, background: '#95a5a6' }}>
            Back
          </button>
          <button onClick={handleSubmit} className="button" style={{ flex: 1, background: '#2ecc71' }}>
            {isEditMode ? 'Save Changes' : 'Create Character'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <h2>{isEditMode ? 'Edit Character' : 'Create New Character'}</h2>
      {isEditMode && (
        <p style={{ color: '#f1c40f', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Editing {editCharacter.name} - Your experience, level, gold, and inventory will be preserved.
        </p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {[1, 2, 3, 4, 5].map(stepNum => (
          <div
            key={stepNum}
            style={{
              flex: 1,
              height: '4px',
              background: step >= stepNum ? '#3498db' : 'rgba(255, 255, 255, 0.1)',
              borderRadius: '2px'
            }}
          />
        ))}
      </div>

      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
      {step === 4 && renderStep4()}
      {step === 5 && renderStep5()}
    </div>
  )
}

export default CharacterCreationWizard
