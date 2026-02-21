import { useState } from 'react'
import classesData from '../data/classes.json'
import racesData from '../data/races.json'
import deitiesData from '../data/deities.json'
import spellsData from '../data/spells/index.js'

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
  { value: 'wretched', label: 'Wretched', cost: '—' },
  { value: 'squalid', label: 'Squalid', cost: '1 sp/day' },
  { value: 'poor', label: 'Poor', cost: '2 sp/day' },
  { value: 'modest', label: 'Modest', cost: '1 gp/day' },
  { value: 'comfortable', label: 'Comfortable', cost: '2 gp/day' },
  { value: 'wealthy', label: 'Wealthy', cost: '4 gp/day' },
  { value: 'aristocratic', label: 'Aristocratic', cost: '10+ gp/day' }
]

const ALL_CLASSES = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter',
  'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer',
  'Warlock', 'Wizard', 'Artificer'
]

const BACKGROUNDS = [
  'Acolyte', 'Charlatan', 'City Watch', 'Criminal', 'Entertainer',
  'Farmer', 'Folk Hero', 'Guild Artisan', 'Guild Merchant', 'Hermit',
  'Knight', 'Merchant', 'Noble', 'Outlander', 'Pirate', 'Sage',
  'Sailor', 'Soldier', 'Urchin'
]

// Background details with skill proficiencies and features
const BACKGROUND_INFO = {
  'Acolyte': {
    skills: ['Insight', 'Religion'],
    feature: 'Shelter of the Faithful'
  },
  'Charlatan': {
    skills: ['Deception', 'Sleight of Hand'],
    feature: 'False Identity'
  },
  'City Watch': {
    skills: ['Athletics', 'Insight'],
    feature: 'Watcher\'s Eye - You can find the local watch station or guard post, and fellow members will provide you with information about local criminal activity.'
  },
  'Criminal': {
    skills: ['Deception', 'Stealth'],
    feature: 'Criminal Contact'
  },
  'Entertainer': {
    skills: ['Acrobatics', 'Performance'],
    feature: 'By Popular Demand'
  },
  'Farmer': {
    skills: ['Animal Handling', 'Nature'],
    feature: 'Harvest Knowledge - You know the land and its rhythms. You can find food and shelter in rural areas, and common folk will often provide lodging in exchange for honest labor.'
  },
  'Folk Hero': {
    skills: ['Animal Handling', 'Survival'],
    feature: 'Rustic Hospitality'
  },
  'Guild Artisan': {
    skills: ['Insight', 'Persuasion'],
    feature: 'Guild Membership'
  },
  'Guild Merchant': {
    skills: ['Insight', 'Persuasion'],
    feature: 'Guild Membership - As a merchant guild member, you have access to guild halls, trade contacts, and can call on guild resources when conducting business.'
  },
  'Hermit': {
    skills: ['Medicine', 'Religion'],
    feature: 'Discovery'
  },
  'Knight': {
    skills: ['History', 'Persuasion'],
    feature: 'Retainers - You have the service of three retainers loyal to your family who perform mundane tasks, though they will not fight or follow into danger.'
  },
  'Merchant': {
    skills: ['Insight', 'Persuasion'],
    feature: 'Trade Connections - You have contacts in merchant networks across the region. You can find buyers for unusual goods and negotiate fair prices even in unfamiliar markets.'
  },
  'Noble': {
    skills: ['History', 'Persuasion'],
    feature: 'Position of Privilege'
  },
  'Outlander': {
    skills: ['Athletics', 'Survival'],
    feature: 'Wanderer'
  },
  'Pirate': {
    skills: ['Athletics', 'Perception'],
    feature: 'Bad Reputation - No matter where you go, people are afraid of you due to your reputation. You can get away with minor criminal offenses in civilized areas.'
  },
  'Sage': {
    skills: ['Arcana', 'History'],
    feature: 'Researcher'
  },
  'Sailor': {
    skills: ['Athletics', 'Perception'],
    feature: 'Ship\'s Passage'
  },
  'Soldier': {
    skills: ['Athletics', 'Intimidation'],
    feature: 'Military Rank'
  },
  'Urchin': {
    skills: ['Sleight of Hand', 'Stealth'],
    feature: 'City Secrets'
  }
}

const ABILITY_NAMES = {
  str: 'Strength',
  dex: 'Dexterity',
  con: 'Constitution',
  int: 'Intelligence',
  wis: 'Wisdom',
  cha: 'Charisma'
}

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]

const SUBCLASS_LEVELS = {
  barbarian: 3, bard: 3, cleric: 1, druid: 2, fighter: 3,
  monk: 3, paladin: 3, ranger: 3, rogue: 3, sorcerer: 1,
  warlock: 1, wizard: 2, artificer: 3
}

// Spellcasting configuration by class
// Cantrips known and spells known at each level (for "spells known" casters)
// Prepared casters (cleric, druid, paladin) prepare from full list, so spellsKnown = 'prepared'
const SPELLCASTING_CONFIG = {
  bard: {
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    spellsKnown: { 1: 4, 2: 5, 3: 6, 4: 7, 5: 8, 6: 9, 7: 10, 8: 11, 9: 12, 10: 14 },
    spellcastingAbility: 'cha'
  },
  cleric: {
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
    spellsKnown: 'prepared', // WIS mod + level
    spellcastingAbility: 'wis'
  },
  druid: {
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    spellsKnown: 'prepared', // WIS mod + level
    spellcastingAbility: 'wis'
  },
  paladin: {
    cantripsKnown: {},
    spellsKnown: 'prepared', // CHA mod + half level
    spellcastingAbility: 'cha',
    spellsStartLevel: 2
  },
  ranger: {
    cantripsKnown: {},
    spellsKnown: { 2: 2, 3: 3, 5: 4, 7: 5, 9: 6, 11: 7, 13: 8, 15: 9, 17: 10, 19: 11 },
    spellcastingAbility: 'wis',
    spellsStartLevel: 2
  },
  sorcerer: {
    cantripsKnown: { 1: 4, 4: 5, 10: 6 },
    spellsKnown: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 10: 11 },
    spellcastingAbility: 'cha'
  },
  warlock: {
    cantripsKnown: { 1: 2, 4: 3, 10: 4 },
    spellsKnown: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10, 11: 11 },
    spellcastingAbility: 'cha'
  },
  wizard: {
    cantripsKnown: { 1: 3, 4: 4, 10: 5 },
    spellsKnown: 'spellbook', // 6 at level 1, +2 per level
    spellcastingAbility: 'int'
  }
}

// Get cantrips known at a given level
const getCantripsKnown = (className, level) => {
  const config = SPELLCASTING_CONFIG[className?.toLowerCase()]
  if (!config || !config.cantripsKnown) return 0
  const levels = Object.keys(config.cantripsKnown).map(Number).sort((a, b) => b - a)
  for (const lvl of levels) {
    if (level >= lvl) return config.cantripsKnown[lvl]
  }
  return 0
}

// Get spells known at a given level (for "spells known" casters)
const getSpellsKnown = (className, level, abilityMod = 0) => {
  const config = SPELLCASTING_CONFIG[className?.toLowerCase()]
  if (!config) return 0
  if (config.spellsStartLevel && level < config.spellsStartLevel) return 0

  if (config.spellsKnown === 'prepared') {
    // Prepared casters: ability mod + level (min 1)
    if (className.toLowerCase() === 'paladin') {
      return Math.max(1, abilityMod + Math.floor(level / 2))
    }
    return Math.max(1, abilityMod + level)
  }
  if (config.spellsKnown === 'spellbook') {
    // Wizards start with 6 spells, +2 per level
    return 6 + (level - 1) * 2
  }
  if (typeof config.spellsKnown === 'object') {
    const levels = Object.keys(config.spellsKnown).map(Number).sort((a, b) => b - a)
    for (const lvl of levels) {
      if (level >= lvl) return config.spellsKnown[lvl]
    }
  }
  return 0
}

// Get max spell level available at a given character level
const getMaxSpellLevel = (className, level) => {
  const config = SPELLCASTING_CONFIG[className?.toLowerCase()]
  if (!config) return 0
  if (config.spellsStartLevel && level < config.spellsStartLevel) return 0

  // Half-casters (paladin, ranger)
  if (['paladin', 'ranger'].includes(className?.toLowerCase())) {
    if (level < 2) return 0
    if (level < 5) return 1
    if (level < 9) return 2
    if (level < 13) return 3
    if (level < 17) return 4
    return 5
  }
  // Full casters
  if (level < 3) return 1
  if (level < 5) return 2
  if (level < 7) return 3
  if (level < 9) return 4
  return 5 // Cap at 5th for this implementation
}

// Skills by ability
const ALL_SKILLS = {
  str: ['Athletics'],
  dex: ['Acrobatics', 'Sleight of Hand', 'Stealth'],
  int: ['Arcana', 'History', 'Investigation', 'Nature', 'Religion'],
  wis: ['Animal Handling', 'Insight', 'Medicine', 'Perception', 'Survival'],
  cha: ['Deception', 'Intimidation', 'Performance', 'Persuasion']
}

// Flatten skills for easy lookup
const SKILL_LIST = Object.values(ALL_SKILLS).flat()

// Roll 4d6 drop lowest
const roll4d6DropLowest = () => {
  const rolls = Array(4).fill(0).map(() => Math.floor(Math.random() * 6) + 1)
  rolls.sort((a, b) => b - a)
  return { total: rolls[0] + rolls[1] + rolls[2], rolls }
}

// Map NPC occupation to closest D&D background
function mapOccupationToBackground(occupation) {
  if (!occupation) return ''
  const occ = occupation.toLowerCase()

  // Mapping common occupations to backgrounds
  if (occ.includes('soldier') || occ.includes('guard') || occ.includes('warrior') || occ.includes('mercenary')) return 'Soldier'
  if (occ.includes('priest') || occ.includes('cleric') || occ.includes('acolyte') || occ.includes('monk')) return 'Acolyte'
  if (occ.includes('noble') || occ.includes('lord') || occ.includes('lady') || occ.includes('aristocrat')) return 'Noble'
  if (occ.includes('thief') || occ.includes('criminal') || occ.includes('smuggler') || occ.includes('assassin')) return 'Criminal'
  if (occ.includes('entertainer') || occ.includes('bard') || occ.includes('performer') || occ.includes('musician')) return 'Entertainer'
  if (occ.includes('scholar') || occ.includes('wizard') || occ.includes('sage') || occ.includes('researcher')) return 'Sage'
  if (occ.includes('sailor') || occ.includes('pirate') || occ.includes('fisherman')) return 'Sailor'
  if (occ.includes('smith') || occ.includes('artisan') || occ.includes('craftsman') || occ.includes('merchant')) return 'Guild Artisan'
  if (occ.includes('hermit') || occ.includes('recluse')) return 'Hermit'
  if (occ.includes('farmer') || occ.includes('hero') || occ.includes('commoner')) return 'Folk Hero'
  if (occ.includes('hunter') || occ.includes('ranger') || occ.includes('woodsman') || occ.includes('tracker')) return 'Outlander'
  if (occ.includes('urchin') || occ.includes('orphan') || occ.includes('street')) return 'Urchin'
  if (occ.includes('charlatan') || occ.includes('con') || occ.includes('swindler')) return 'Charlatan'

  return '' // No match, let user choose
}

function PartyBuilder({ characterId, characterLevel, onComplete, onCancel, prefillFromNpc = null }) {
  // Determine if we're recruiting from an NPC (locked fields mode)
  const isNpcRecruitment = !!prefillFromNpc

  const [step, setStep] = useState(1)
  const [companionData, setCompanionData] = useState(() => {
    // If pre-filling from NPC, use their data
    if (prefillFromNpc) {
      // Normalize race to lowercase to match races.json keys
      const normalizedRace = prefillFromNpc.race?.toLowerCase() || ''
      // Normalize gender to match dropdown values (capitalize first letter)
      const normalizedGender = prefillFromNpc.gender
        ? prefillFromNpc.gender.charAt(0).toUpperCase() + prefillFromNpc.gender.slice(1).toLowerCase()
        : ''
      return {
        name: prefillFromNpc.name || '',
        nickname: prefillFromNpc.nickname || '',
        race: normalizedRace,
        subrace: '', // Can be set by user
        gender: normalizedGender,
        age: prefillFromNpc.age || '',
        companionClass: '',
        subclass: '',
        level: characterLevel || 1,
        background: mapOccupationToBackground(prefillFromNpc.occupation),
        // Character details (editable)
        alignment: '',
        faith: '',
        lifestyle: 'modest',
        // Appearance (from NPC - locked)
        height: prefillFromNpc.height || '',
        build: prefillFromNpc.build || '',
        hairColor: prefillFromNpc.hair_color || '',
        hairStyle: prefillFromNpc.hair_style || '',
        eyeColor: prefillFromNpc.eye_color || '',
        skinTone: prefillFromNpc.skin_tone || '',
        distinguishingMarks: prefillFromNpc.distinguishing_marks || '',
        // Personality (from NPC - locked)
        personalityTrait1: prefillFromNpc.personality_trait_1 || '',
        personalityTrait2: prefillFromNpc.personality_trait_2 || '',
        voice: prefillFromNpc.voice || '',
        mannerism: prefillFromNpc.mannerism || '',
        motivation: prefillFromNpc.motivation || '',
        ideals: '',
        bonds: '',
        flaws: '',
        // Ability scores (editable)
        abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        // Skills (editable)
        skillProficiencies: [],
        // Spells
        cantrips: [],
        spellsKnown: [],
        // Origin (from NPC)
        backstory: prefillFromNpc.background_notes || '',
        relationshipToParty: prefillFromNpc.relationship_to_party || '',
        // Starting gold (editable)
        startingGoldGp: 0,
        startingGoldSp: 0,
        startingGoldCp: 0,
        // Store NPC ID for linking
        npcId: prefillFromNpc.id || null
      }
    }

    // Default empty state for creating from scratch
    return {
      name: '',
      nickname: '',
      race: '',
      subrace: '',
      gender: '',
      age: '',
      companionClass: '',
      subclass: '',
      level: characterLevel || 1,
      background: '',
      // Character details (like PC creation)
      alignment: '',
      faith: '',
      lifestyle: 'modest',
      // Appearance
      height: '',
      build: '',
      hairColor: '',
      hairStyle: '',
      eyeColor: '',
      skinTone: '',
      distinguishingMarks: '',
      // Personality
      personalityTrait1: '',
      personalityTrait2: '',
      voice: '',
      mannerism: '',
      motivation: '',
      ideals: '',
      bonds: '',
      flaws: '',
      // Ability scores
      abilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      // Skills
      skillProficiencies: [],
      // Spells (for casters)
      cantrips: [],
      spellsKnown: [],
      // Origin
      backstory: '',
      relationshipToParty: '',
      // Starting gold
      startingGoldGp: 0,
      startingGoldSp: 0,
      startingGoldCp: 0,
      npcId: null
    }
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  // Ability score generation state
  const [abilityMethod, setAbilityMethod] = useState('standard_array') // standard_array, point_buy, roll, manual
  const [standardArrayAssignments, setStandardArrayAssignments] = useState({
    str: null, dex: null, con: null, int: null, wis: null, cha: null
  })
  const [pointBuyPoints, setPointBuyPoints] = useState(27)
  const [rolledScores, setRolledScores] = useState([])
  const [rolledAssignments, setRolledAssignments] = useState({
    str: null, dex: null, con: null, int: null, wis: null, cha: null
  })

  // Racial ability score choice state (for Variant Human, Half-Elf, etc.)
  const [racialAbilityChoices, setRacialAbilityChoices] = useState([])

  // Get races from data file
  const races = Object.keys(racesData || {})
  const selectedRaceData = racesData?.[companionData.race.toLowerCase()]
  const subraces = selectedRaceData?.subraces?.map(s => s.name) || []
  const selectedSubraceData = companionData.subrace
    ? selectedRaceData?.subraces?.find(s => s.name === companionData.subrace)
    : null

  // Determine racial ability score bonuses and choices
  const getRacialAbilityInfo = () => {
    // Get the ability score increases from subrace if selected, otherwise from race
    const abilityData = selectedSubraceData?.abilityScoreIncrease || selectedRaceData?.abilityScoreIncrease || {}

    const fixedBonuses = {} // e.g., { cha: 2, str: 1 }
    let numChoices = 0 // How many abilities to choose for +1

    Object.entries(abilityData).forEach(([key, value]) => {
      if (key === 'choice') {
        numChoices = value
      } else {
        fixedBonuses[key] = value
      }
    })

    return { fixedBonuses, numChoices }
  }

  const { fixedBonuses: racialFixedBonuses, numChoices: racialNumChoices } = getRacialAbilityInfo()

  // Handle racial ability choice selection
  const toggleRacialAbilityChoice = (ability) => {
    setRacialAbilityChoices(prev => {
      if (prev.includes(ability)) {
        return prev.filter(a => a !== ability)
      } else if (prev.length < racialNumChoices) {
        // Can't choose an ability that already has a fixed racial bonus
        if (racialFixedBonuses[ability]) return prev
        return [...prev, ability]
      }
      return prev
    })
  }

  // Calculate total racial bonuses (fixed + chosen)
  const getTotalRacialBonuses = () => {
    const bonuses = { ...racialFixedBonuses }
    racialAbilityChoices.forEach(ability => {
      bonuses[ability] = (bonuses[ability] || 0) + 1
    })
    return bonuses
  }

  const totalRacialBonuses = getTotalRacialBonuses()

  // Calculate final ability scores (base + racial bonuses)
  const getFinalAbilityScores = () => {
    const finalScores = {}
    Object.keys(companionData.abilityScores).forEach(ability => {
      const base = companionData.abilityScores[ability]
      const bonus = totalRacialBonuses[ability] || 0
      finalScores[ability] = Math.min(20, base + bonus) // Cap at 20
    })
    return finalScores
  }

  const finalAbilityScores = getFinalAbilityScores()

  // Get class data
  const selectedClassData = companionData.companionClass
    ? classesData[companionData.companionClass.toLowerCase()]
    : null
  const subclassOptions = selectedClassData?.subclasses || []
  const needsSubclass = companionData.companionClass &&
    companionData.level >= (SUBCLASS_LEVELS[companionData.companionClass.toLowerCase()] || 3)

  // Get skill options from class
  const classSkillOptions = selectedClassData?.skillOptions?.map(s =>
    s.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
  ) || SKILL_LIST
  const numSkillChoices = selectedClassData?.skillChoices || 2

  // Get spell info for casters
  const isCaster = selectedClassData && (
    selectedClassData.spellcasting ||
    ['bard', 'cleric', 'druid', 'sorcerer', 'warlock', 'wizard', 'paladin', 'ranger'].includes(
      companionData.companionClass.toLowerCase()
    )
  )

  const updateField = (field, value) => {
    setCompanionData(prev => ({ ...prev, [field]: value }))
  }

  const updateAbilityScore = (ability, value) => {
    const numValue = Math.max(1, Math.min(20, parseInt(value) || 10))
    setCompanionData(prev => ({
      ...prev,
      abilityScores: { ...prev.abilityScores, [ability]: numValue }
    }))
  }

  // Point buy cost table (8 = 0 points, each increase costs more)
  const getPointBuyCost = (score) => {
    if (score <= 8) return 0
    if (score <= 13) return score - 8
    if (score === 14) return 7
    if (score === 15) return 9
    return 999 // Can't go above 15 in point buy
  }

  const getTotalPointBuyCost = (scores) => {
    return Object.values(scores).reduce((sum, score) => sum + getPointBuyCost(score), 0)
  }

  // Assign standard array value to an ability
  const assignStandardArray = (ability, value) => {
    // Remove this value from any other ability
    const newAssignments = { ...standardArrayAssignments }
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[key] === value) newAssignments[key] = null
    })
    newAssignments[ability] = value
    setStandardArrayAssignments(newAssignments)

    // Update ability scores
    const newScores = { ...companionData.abilityScores }
    Object.entries(newAssignments).forEach(([key, val]) => {
      newScores[key] = val || 10
    })
    setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
  }

  // Roll all 6 ability scores
  const rollAllScores = () => {
    const scores = Array(6).fill(0).map(() => roll4d6DropLowest())
    setRolledScores(scores)
    setRolledAssignments({ str: null, dex: null, con: null, int: null, wis: null, cha: null })
  }

  // Assign rolled score to an ability
  const assignRolledScore = (ability, scoreIndex) => {
    const newAssignments = { ...rolledAssignments }
    // Remove this score from any other ability
    Object.keys(newAssignments).forEach(key => {
      if (newAssignments[key] === scoreIndex) newAssignments[key] = null
    })
    newAssignments[ability] = scoreIndex
    setRolledAssignments(newAssignments)

    // Update ability scores
    const newScores = { ...companionData.abilityScores }
    Object.entries(newAssignments).forEach(([key, idx]) => {
      newScores[key] = idx !== null ? rolledScores[idx].total : 10
    })
    setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
  }

  // Point buy adjustment
  const adjustPointBuy = (ability, delta) => {
    const currentScore = companionData.abilityScores[ability]
    const newScore = currentScore + delta

    if (newScore < 8 || newScore > 15) return

    const newScores = { ...companionData.abilityScores, [ability]: newScore }
    const newCost = getTotalPointBuyCost(newScores)

    if (newCost <= 27) {
      setCompanionData(prev => ({ ...prev, abilityScores: newScores }))
      setPointBuyPoints(27 - newCost)
    }
  }

  // Toggle skill proficiency
  const toggleSkill = (skill) => {
    const current = companionData.skillProficiencies
    if (current.includes(skill)) {
      setCompanionData(prev => ({
        ...prev,
        skillProficiencies: current.filter(s => s !== skill)
      }))
    } else if (current.length < numSkillChoices) {
      setCompanionData(prev => ({
        ...prev,
        skillProficiencies: [...current, skill]
      }))
    }
  }

  // Toggle cantrip/spell selection
  const toggleSpell = (spell, isCantrip) => {
    const field = isCantrip ? 'cantrips' : 'spellsKnown'
    const current = companionData[field]
    if (current.includes(spell)) {
      setCompanionData(prev => ({
        ...prev,
        [field]: current.filter(s => s !== spell)
      }))
    } else {
      setCompanionData(prev => ({
        ...prev,
        [field]: [...current, spell]
      }))
    }
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/companion/create-party-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruited_by_character_id: characterId,
          npc_id: companionData.npcId || null, // Link to NPC if recruiting from NPC
          name: companionData.name,
          nickname: companionData.nickname || null,
          race: companionData.race,
          subrace: companionData.subrace || null,
          gender: companionData.gender || null,
          age: companionData.age || null,
          companion_class: companionData.companionClass,
          companion_subclass: companionData.subclass || null,
          level: companionData.level,
          background: companionData.background || null,
          // Appearance
          height: companionData.height || null,
          build: companionData.build || null,
          hair_color: companionData.hairColor || null,
          hair_style: companionData.hairStyle || null,
          eye_color: companionData.eyeColor || null,
          skin_tone: companionData.skinTone || null,
          distinguishing_marks: companionData.distinguishingMarks || null,
          // Personality
          personality_trait_1: companionData.personalityTrait1 || null,
          personality_trait_2: companionData.personalityTrait2 || null,
          voice: companionData.voice || null,
          mannerism: companionData.mannerism || null,
          motivation: companionData.motivation || null,
          // Character details
          alignment: companionData.alignment || null,
          faith: companionData.faith || null,
          lifestyle: companionData.lifestyle || null,
          ideals: companionData.ideals || null,
          bonds: companionData.bonds || null,
          flaws: companionData.flaws || null,
          // Starting gold
          gold_gp: companionData.startingGoldGp || 0,
          gold_sp: companionData.startingGoldSp || 0,
          gold_cp: companionData.startingGoldCp || 0,
          // Ability scores (with racial bonuses applied)
          ability_scores: finalAbilityScores,
          // Skills
          skill_proficiencies: companionData.skillProficiencies,
          // Spells
          cantrips: companionData.cantrips,
          spells_known: companionData.spellsKnown,
          // Origin
          backstory: companionData.backstory || null,
          relationship_to_party: companionData.relationshipToParty || null
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create party member')
      }

      const data = await response.json()
      onComplete(data.companion)
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Check if ability scores are fully assigned based on method
  const abilityScoresComplete = () => {
    if (abilityMethod === 'manual') return true
    if (abilityMethod === 'point_buy') return pointBuyPoints >= 0
    if (abilityMethod === 'standard_array') {
      return Object.values(standardArrayAssignments).every(v => v !== null)
    }
    if (abilityMethod === 'roll') {
      return rolledScores.length === 6 && Object.values(rolledAssignments).every(v => v !== null)
    }
    return false
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return companionData.name && companionData.race && companionData.companionClass
      case 2:
        // Ability scores must be complete, subclass if needed, skills selected, racial choices made
        const subclassOk = !needsSubclass || companionData.subclass
        const skillsOk = companionData.skillProficiencies.length >= numSkillChoices
        const racialChoicesOk = racialNumChoices === 0 || racialAbilityChoices.length === racialNumChoices
        return abilityScoresComplete() && subclassOk && skillsOk && racialChoicesOk
      case 3:
        return true // Details (alignment, faith, lifestyle) are optional
      case 4:
        return true // Personality is optional
      case 5:
        return true // Appearance is optional
      case 6:
        return true // Always can submit from review
      default:
        return false
    }
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content party-builder"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <h2 style={{ color: '#9b59b6', marginBottom: '0.5rem' }}>
          Create Party Member
        </h2>
        <p style={{ color: '#888', marginBottom: '1.5rem' }}>
          Build a new companion for your adventuring party
        </p>

        {/* Progress Steps */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.25rem',
          marginBottom: '2rem',
          flexWrap: 'wrap'
        }}>
          {['Basics', 'Class & Abilities', 'Details', 'Personality', 'Appearance', 'Review'].map((label, idx) => (
            <div
              key={label}
              onClick={() => idx + 1 <= step && setStep(idx + 1)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: idx + 1 <= step ? 'pointer' : 'default',
                opacity: idx + 1 <= step ? 1 : 0.5
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: step === idx + 1 ? '#9b59b6' : step > idx + 1 ? '#2ecc71' : '#444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
                fontSize: '0.75rem'
              }}>
                {step > idx + 1 ? '✓' : idx + 1}
              </div>
              <span style={{
                color: step === idx + 1 ? '#fff' : '#888',
                fontSize: '0.75rem'
              }}>
                {label}
              </span>
              {idx < 5 && (
                <div style={{
                  width: '20px',
                  height: '2px',
                  background: step > idx + 1 ? '#2ecc71' : '#444'
                }} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: 'rgba(231, 76, 60, 0.2)',
            border: '1px solid #e74c3c',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            color: '#e74c3c'
          }}>
            {error}
          </div>
        )}

        {/* Step 1: Basics */}
        {step === 1 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Basic Information</h3>

            {isNpcRecruitment && (
              <div style={{
                background: 'rgba(230, 126, 34, 0.15)',
                border: '1px solid #e67e22',
                borderRadius: '8px',
                padding: '0.75rem',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                color: '#e67e22'
              }}>
                Recruiting <strong>{prefillFromNpc.name}</strong> from your NPC contacts.
                Fields with a lock icon are from their NPC profile and cannot be changed.
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Name * {isNpcRecruitment && <span title="Locked from NPC profile">🔒</span>}
                </label>
                <input
                  type="text"
                  value={companionData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Enter name..."
                  disabled={isNpcRecruitment}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: isNpcRecruitment ? '#1a1a1a' : '#2a2a2a',
                    border: `1px solid ${isNpcRecruitment ? '#555' : '#444'}`,
                    borderRadius: '4px',
                    color: isNpcRecruitment ? '#888' : '#fff',
                    cursor: isNpcRecruitment ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Nickname {isNpcRecruitment && prefillFromNpc.nickname && <span title="Locked from NPC profile">🔒</span>}
                </label>
                <input
                  type="text"
                  value={companionData.nickname}
                  onChange={(e) => updateField('nickname', e.target.value)}
                  placeholder="Optional nickname..."
                  disabled={isNpcRecruitment && prefillFromNpc.nickname}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: (isNpcRecruitment && prefillFromNpc.nickname) ? '#1a1a1a' : '#2a2a2a',
                    border: `1px solid ${(isNpcRecruitment && prefillFromNpc.nickname) ? '#555' : '#444'}`,
                    borderRadius: '4px',
                    color: (isNpcRecruitment && prefillFromNpc.nickname) ? '#888' : '#fff',
                    cursor: (isNpcRecruitment && prefillFromNpc.nickname) ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Race * {isNpcRecruitment && <span title="Locked from NPC profile">🔒</span>}
                </label>
                <select
                  value={companionData.race}
                  onChange={(e) => {
                    updateField('race', e.target.value)
                    updateField('subrace', '') // Reset subrace when race changes
                    setRacialAbilityChoices([]) // Reset ability choices for new race
                  }}
                  disabled={isNpcRecruitment}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: isNpcRecruitment ? '#1a1a1a' : '#2a2a2a',
                    border: `1px solid ${isNpcRecruitment ? '#555' : '#444'}`,
                    borderRadius: '4px',
                    color: isNpcRecruitment ? '#888' : '#fff',
                    cursor: isNpcRecruitment ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">Select race...</option>
                  {races.map(race => (
                    <option key={race} value={race}>
                      {race.charAt(0).toUpperCase() + race.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              {subraces.length > 0 && (
                <div>
                  <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                    Subrace
                  </label>
                  <select
                    value={companionData.subrace}
                    onChange={(e) => {
                      updateField('subrace', e.target.value)
                      setRacialAbilityChoices([]) // Reset ability choices for new subrace
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
                    <option value="">Select subrace...</option>
                    {subraces.map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Gender {isNpcRecruitment && prefillFromNpc.gender && <span title="Locked from NPC profile">🔒</span>}
                </label>
                <select
                  value={companionData.gender}
                  onChange={(e) => updateField('gender', e.target.value)}
                  disabled={isNpcRecruitment && prefillFromNpc.gender}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: (isNpcRecruitment && prefillFromNpc.gender) ? '#1a1a1a' : '#2a2a2a',
                    border: `1px solid ${(isNpcRecruitment && prefillFromNpc.gender) ? '#555' : '#444'}`,
                    borderRadius: '4px',
                    color: (isNpcRecruitment && prefillFromNpc.gender) ? '#888' : '#fff',
                    cursor: (isNpcRecruitment && prefillFromNpc.gender) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Age {isNpcRecruitment && prefillFromNpc.age && <span title="Locked from NPC profile">🔒</span>}
                </label>
                <input
                  type="text"
                  value={companionData.age}
                  onChange={(e) => updateField('age', e.target.value)}
                  placeholder="e.g. 25, Young Adult..."
                  disabled={isNpcRecruitment && prefillFromNpc.age}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: (isNpcRecruitment && prefillFromNpc.age) ? '#1a1a1a' : '#2a2a2a',
                    border: `1px solid ${(isNpcRecruitment && prefillFromNpc.age) ? '#555' : '#444'}`,
                    borderRadius: '4px',
                    color: (isNpcRecruitment && prefillFromNpc.age) ? '#888' : '#fff',
                    cursor: (isNpcRecruitment && prefillFromNpc.age) ? 'not-allowed' : 'text'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Class *
                </label>
                <select
                  value={companionData.companionClass}
                  onChange={(e) => updateField('companionClass', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select class...</option>
                  {ALL_CLASSES.map(cls => (
                    <option key={cls} value={cls}>{cls}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Level
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={companionData.level}
                  onChange={(e) => updateField('level', parseInt(e.target.value) || 1)}
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

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Background
              </label>
              <select
                value={companionData.background}
                onChange={(e) => updateField('background', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              >
                <option value="">Select background...</option>
                {BACKGROUNDS.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>

              {/* Background Info Display */}
              {companionData.background && BACKGROUND_INFO[companionData.background] && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: 'rgba(155, 89, 182, 0.1)',
                  border: '1px solid #9b59b6',
                  borderRadius: '6px',
                  fontSize: '0.85rem'
                }}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>Skills: </span>
                    <span style={{ color: '#ddd' }}>
                      {BACKGROUND_INFO[companionData.background].skills.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: '#9b59b6', fontWeight: 'bold' }}>Feature: </span>
                    <span style={{ color: '#888' }}>
                      {BACKGROUND_INFO[companionData.background].feature}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Class Choices */}
        {step === 2 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Class Choices</h3>

            {/* Racial Ability Score Bonuses */}
            {(Object.keys(racialFixedBonuses).length > 0 || racialNumChoices > 0) && (
              <div style={{
                marginBottom: '1.5rem',
                padding: '1rem',
                background: 'rgba(46, 204, 113, 0.1)',
                border: '1px solid #2ecc71',
                borderRadius: '8px'
              }}>
                <h4 style={{ color: '#2ecc71', marginBottom: '0.75rem' }}>
                  Racial Ability Bonuses
                  <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                    ({companionData.subrace || companionData.race})
                  </span>
                </h4>

                {/* Fixed bonuses display */}
                {Object.keys(racialFixedBonuses).length > 0 && (
                  <div style={{ marginBottom: racialNumChoices > 0 ? '1rem' : 0 }}>
                    <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>Fixed Bonuses:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {Object.entries(racialFixedBonuses).map(([ability, bonus]) => (
                        <span
                          key={ability}
                          style={{
                            padding: '0.3rem 0.6rem',
                            background: 'rgba(46, 204, 113, 0.2)',
                            border: '1px solid #2ecc71',
                            borderRadius: '4px',
                            color: '#2ecc71',
                            fontSize: '0.85rem'
                          }}
                        >
                          {ABILITY_NAMES[ability]}: +{bonus}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ability score choices for Variant Human, Half-Elf, etc. */}
                {racialNumChoices > 0 && (
                  <div>
                    <div style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                      Choose {racialNumChoices} ability {racialNumChoices === 1 ? 'score' : 'scores'} for +1 each:
                      <span style={{ marginLeft: '0.5rem', color: racialAbilityChoices.length === racialNumChoices ? '#2ecc71' : '#f1c40f' }}>
                        ({racialAbilityChoices.length}/{racialNumChoices} selected)
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {Object.entries(ABILITY_NAMES).map(([key, name]) => {
                        const isSelected = racialAbilityChoices.includes(key)
                        const hasFixedBonus = !!racialFixedBonuses[key]
                        const canSelect = isSelected || (!hasFixedBonus && racialAbilityChoices.length < racialNumChoices)

                        return (
                          <button
                            key={key}
                            onClick={() => toggleRacialAbilityChoice(key)}
                            disabled={hasFixedBonus}
                            title={hasFixedBonus ? 'Already has a racial bonus' : ''}
                            style={{
                              padding: '0.4rem 0.75rem',
                              borderRadius: '20px',
                              border: `1px solid ${isSelected ? '#2ecc71' : hasFixedBonus ? '#666' : '#444'}`,
                              background: isSelected ? 'rgba(46, 204, 113, 0.2)' : 'transparent',
                              color: isSelected ? '#2ecc71' : hasFixedBonus ? '#666' : canSelect ? '#ddd' : '#888',
                              cursor: hasFixedBonus ? 'not-allowed' : canSelect ? 'pointer' : 'default',
                              fontSize: '0.85rem',
                              transition: 'all 0.2s',
                              opacity: hasFixedBonus ? 0.5 : 1
                            }}
                          >
                            {name} {isSelected && '+1'}
                          </button>
                        )
                      })}
                    </div>
                    {companionData.race.toLowerCase() === 'human' && companionData.subrace === 'Variant Human' && (
                      <p style={{ color: '#888', fontSize: '0.8rem', marginTop: '0.75rem', fontStyle: 'italic' }}>
                        Note: Variant Human also grants one skill proficiency and one feat (feat selection coming soon).
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Ability Score Generation Method */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#f1c40f', marginBottom: '0.75rem' }}>Ability Scores</h4>

              {/* Method Selection */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                {[
                  { value: 'standard_array', label: 'Standard Array' },
                  { value: 'point_buy', label: 'Point Buy' },
                  { value: 'roll', label: 'Roll 4d6' },
                  { value: 'manual', label: 'Manual' }
                ].map(method => (
                  <button
                    key={method.value}
                    className={`button ${abilityMethod === method.value ? '' : 'button-secondary'}`}
                    onClick={() => setAbilityMethod(method.value)}
                    style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                  >
                    {method.label}
                  </button>
                ))}
              </div>

              {/* Standard Array UI */}
              {abilityMethod === 'standard_array' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Assign each value from the standard array (15, 14, 13, 12, 10, 8) to an ability score.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => {
                      const racialBonus = totalRacialBonuses[key] || 0
                      const baseScore = standardArrayAssignments[key]
                      const finalScore = baseScore ? Math.min(20, baseScore + racialBonus) : null
                      return (
                        <div
                          key={key}
                          style={{
                            background: 'rgba(241, 196, 15, 0.1)',
                            border: `1px solid ${racialBonus > 0 ? '#2ecc71' : '#f1c40f'}`,
                            borderRadius: '8px',
                            padding: '0.5rem'
                          }}
                        >
                          <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>{name}</span>
                            {racialBonus > 0 && (
                              <span style={{ color: '#2ecc71', fontSize: '0.75rem' }}>+{racialBonus}</span>
                            )}
                          </div>
                          <select
                            value={standardArrayAssignments[key] || ''}
                            onChange={(e) => assignStandardArray(key, e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              background: '#2a2a2a',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              color: '#fff'
                            }}
                          >
                            <option value="">--</option>
                            {STANDARD_ARRAY.map(val => {
                              const usedElsewhere = Object.entries(standardArrayAssignments)
                                .some(([k, v]) => k !== key && v === val)
                              return (
                                <option key={val} value={val} disabled={usedElsewhere}>
                                  {val} {usedElsewhere ? '(used)' : ''}
                                </option>
                              )
                            })}
                          </select>
                          <div style={{ color: '#f1c40f', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.25rem' }}>
                            {finalScore ? (
                              <>
                                {finalScore} ({getModifier(finalScore)})
                              </>
                            ) : '--'}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Point Buy UI */}
              {abilityMethod === 'point_buy' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    Spend points to increase abilities. All scores start at 8. Range: 8-15.
                  </p>
                  <div style={{
                    background: 'rgba(52, 152, 219, 0.2)',
                    borderRadius: '4px',
                    padding: '0.5rem',
                    marginBottom: '0.75rem',
                    textAlign: 'center'
                  }}>
                    <span style={{ color: '#3498db', fontWeight: 'bold' }}>
                      Points Remaining: {pointBuyPoints}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => {
                      const racialBonus = totalRacialBonuses[key] || 0
                      const baseScore = companionData.abilityScores[key]
                      const finalScore = Math.min(20, baseScore + racialBonus)
                      return (
                        <div
                          key={key}
                          style={{
                            background: 'rgba(241, 196, 15, 0.1)',
                            border: `1px solid ${racialBonus > 0 ? '#2ecc71' : '#f1c40f'}`,
                            borderRadius: '8px',
                            padding: '0.5rem',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                            <span>{name}</span>
                            {racialBonus > 0 && (
                              <span style={{ color: '#2ecc71', fontSize: '0.75rem' }}>+{racialBonus}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <button
                              onClick={() => adjustPointBuy(key, -1)}
                              disabled={baseScore <= 8}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                background: baseScore <= 8 ? '#333' : '#e74c3c',
                                border: 'none',
                                color: '#fff',
                                cursor: baseScore <= 8 ? 'not-allowed' : 'pointer'
                              }}
                            >-</button>
                            <span style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem', width: '30px' }}>
                              {finalScore}
                            </span>
                            <button
                              onClick={() => adjustPointBuy(key, 1)}
                              disabled={baseScore >= 15 || pointBuyPoints <= 0}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '4px',
                                background: (baseScore >= 15 || pointBuyPoints <= 0) ? '#333' : '#2ecc71',
                                border: 'none',
                                color: '#fff',
                                cursor: (baseScore >= 15 || pointBuyPoints <= 0) ? 'not-allowed' : 'pointer'
                              }}
                            >+</button>
                          </div>
                          <div style={{ color: '#f1c40f', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {getModifier(finalScore)}
                          </div>
                          <div style={{ color: '#888', fontSize: '0.7rem' }}>
                            Cost: {getPointBuyCost(baseScore)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Roll 4d6 Drop Lowest UI */}
              {abilityMethod === 'roll' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Roll 4d6 and drop the lowest die for each score, then assign them to abilities.
                  </p>
                  <button
                    className="button"
                    onClick={rollAllScores}
                    style={{ marginBottom: '1rem' }}
                  >
                    {rolledScores.length > 0 ? 'Re-Roll All Scores' : 'Roll Ability Scores'}
                  </button>

                  {rolledScores.length > 0 && (
                    <>
                      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {rolledScores.map((score, idx) => {
                          const isAssigned = Object.values(rolledAssignments).includes(idx)
                          return (
                            <div
                              key={idx}
                              style={{
                                background: isAssigned ? 'rgba(46, 204, 113, 0.2)' : 'rgba(52, 152, 219, 0.2)',
                                border: `1px solid ${isAssigned ? '#2ecc71' : '#3498db'}`,
                                borderRadius: '8px',
                                padding: '0.5rem',
                                textAlign: 'center',
                                minWidth: '60px'
                              }}
                            >
                              <div style={{ fontWeight: 'bold', fontSize: '1.2rem', color: '#fff' }}>
                                {score.total}
                              </div>
                              <div style={{ fontSize: '0.7rem', color: '#888' }}>
                                [{score.rolls.join(', ')}]
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                        {Object.entries(ABILITY_NAMES).map(([key, name]) => {
                          const racialBonus = totalRacialBonuses[key] || 0
                          const baseScore = rolledAssignments[key] !== null ? rolledScores[rolledAssignments[key]].total : null
                          const finalScore = baseScore ? Math.min(20, baseScore + racialBonus) : null
                          return (
                            <div
                              key={key}
                              style={{
                                background: 'rgba(241, 196, 15, 0.1)',
                                border: `1px solid ${racialBonus > 0 ? '#2ecc71' : '#f1c40f'}`,
                                borderRadius: '8px',
                                padding: '0.5rem'
                              }}
                            >
                              <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>{name}</span>
                                {racialBonus > 0 && (
                                  <span style={{ color: '#2ecc71', fontSize: '0.75rem' }}>+{racialBonus}</span>
                                )}
                              </div>
                              <select
                                value={rolledAssignments[key] !== null ? rolledAssignments[key] : ''}
                                onChange={(e) => assignRolledScore(key, e.target.value !== '' ? parseInt(e.target.value) : null)}
                                style={{
                                  width: '100%',
                                  padding: '0.4rem',
                                  background: '#2a2a2a',
                                  border: '1px solid #444',
                                  borderRadius: '4px',
                                  color: '#fff'
                                }}
                              >
                                <option value="">--</option>
                                {rolledScores.map((score, idx) => {
                                  const usedElsewhere = Object.entries(rolledAssignments)
                                    .some(([k, v]) => k !== key && v === idx)
                                  return (
                                    <option key={idx} value={idx} disabled={usedElsewhere}>
                                      {score.total} {usedElsewhere ? '(used)' : ''}
                                    </option>
                                  )
                                })}
                              </select>
                              <div style={{ color: '#f1c40f', fontSize: '0.8rem', textAlign: 'center', marginTop: '0.25rem' }}>
                                {finalScore ? (
                                  <>
                                    {finalScore} ({getModifier(finalScore)})
                                  </>
                                ) : '--'}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Manual Entry UI */}
              {abilityMethod === 'manual' && (
                <div>
                  <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                    Enter ability scores manually (1-20). Racial bonuses will be added automatically.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                    {Object.entries(ABILITY_NAMES).map(([key, name]) => {
                      const racialBonus = totalRacialBonuses[key] || 0
                      const baseScore = companionData.abilityScores[key]
                      const finalScore = Math.min(20, baseScore + racialBonus)
                      return (
                        <div
                          key={key}
                          style={{
                            background: 'rgba(241, 196, 15, 0.1)',
                            border: `1px solid ${racialBonus > 0 ? '#2ecc71' : '#f1c40f'}`,
                            borderRadius: '8px',
                            padding: '0.5rem',
                            textAlign: 'center'
                          }}
                        >
                          <div style={{ color: '#f1c40f', fontWeight: 'bold', fontSize: '0.85rem', marginBottom: '0.3rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.25rem' }}>
                            <span>{name}</span>
                            {racialBonus > 0 && (
                              <span style={{ color: '#2ecc71', fontSize: '0.75rem' }}>+{racialBonus}</span>
                            )}
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={baseScore}
                            onChange={(e) => updateAbilityScore(key, e.target.value)}
                            style={{
                              width: '100%',
                              padding: '0.4rem',
                              background: '#2a2a2a',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              color: '#fff',
                              textAlign: 'center',
                              fontWeight: 'bold'
                            }}
                          />
                          <div style={{ color: '#f1c40f', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                            {finalScore} ({getModifier(finalScore)})
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Subclass Selection */}
            {needsSubclass && subclassOptions.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ color: '#9b59b6', marginBottom: '0.75rem' }}>
                  {companionData.companionClass === 'Cleric' ? 'Divine Domain' :
                   companionData.companionClass === 'Warlock' ? 'Otherworldly Patron' :
                   companionData.companionClass === 'Sorcerer' ? 'Sorcerous Origin' :
                   companionData.companionClass === 'Wizard' ? 'Arcane Tradition' :
                   companionData.companionClass === 'Druid' ? 'Druid Circle' :
                   'Subclass'}
                </h4>
                <select
                  value={companionData.subclass}
                  onChange={(e) => updateField('subclass', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #9b59b6',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select {companionData.companionClass === 'Cleric' ? 'domain' : 'subclass'}...</option>
                  {subclassOptions.map(sub => (
                    <option key={sub.name} value={sub.name}>{sub.name}</option>
                  ))}
                </select>
                {companionData.subclass && (
                  <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                    {subclassOptions.find(s => s.name === companionData.subclass)?.description}
                  </p>
                )}
              </div>
            )}

            {/* Skill Proficiencies */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h4 style={{ color: '#2ecc71', marginBottom: '0.5rem' }}>
                Skill Proficiencies
                <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                  (Choose {numSkillChoices} from your class)
                </span>
              </h4>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Selected: {companionData.skillProficiencies.length} / {numSkillChoices}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {classSkillOptions.map(skill => {
                  const isSelected = companionData.skillProficiencies.includes(skill)
                  const canSelect = isSelected || companionData.skillProficiencies.length < numSkillChoices
                  return (
                    <button
                      key={skill}
                      onClick={() => toggleSkill(skill)}
                      disabled={!canSelect}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '20px',
                        border: `1px solid ${isSelected ? '#2ecc71' : '#444'}`,
                        background: isSelected ? 'rgba(46, 204, 113, 0.2)' : 'transparent',
                        color: isSelected ? '#2ecc71' : canSelect ? '#ddd' : '#666',
                        cursor: canSelect ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s'
                      }}
                    >
                      {skill}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Spell Selection for Casters */}
            {isCaster && (() => {
              const className = companionData.companionClass.toLowerCase()
              const level = companionData.level || 1
              const config = SPELLCASTING_CONFIG[className]
              if (!config) return null

              const spellcastingAbility = config.spellcastingAbility
              const abilityMod = Math.floor((companionData.abilityScores[spellcastingAbility] - 10) / 2)
              const numCantrips = getCantripsKnown(className, level)
              const numSpells = getSpellsKnown(className, level, abilityMod)
              const maxSpellLevel = getMaxSpellLevel(className, level)
              const isPreparedCaster = config.spellsKnown === 'prepared' || config.spellsKnown === 'spellbook'

              // Get available cantrips for this class
              const availableCantrips = spellsData.cantrips[className] || []

              // Get available spells for this class (up to max spell level)
              const availableSpells = []
              for (let lvl = 1; lvl <= maxSpellLevel; lvl++) {
                const levelKey = lvl === 1 ? '1st' : lvl === 2 ? '2nd' : lvl === 3 ? '3rd' : `${lvl}th`
                const spellsAtLevel = spellsData.spells[levelKey] || []
                spellsAtLevel
                  .filter(spell => spell.classes?.includes(className))
                  .forEach(spell => availableSpells.push({ ...spell, level: lvl }))
              }

              return (
                <div>
                  {/* Cantrips */}
                  {numCantrips > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h4 style={{ color: '#9b59b6', marginBottom: '0.5rem' }}>
                        Cantrips
                        <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                          (Choose {numCantrips})
                        </span>
                      </h4>
                      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        Selected: {companionData.cantrips.length} / {numCantrips}
                      </p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                        {availableCantrips.map(cantrip => {
                          const isSelected = companionData.cantrips.includes(cantrip.name)
                          const canSelect = isSelected || companionData.cantrips.length < numCantrips
                          return (
                            <button
                              key={cantrip.name}
                              onClick={() => toggleSpell(cantrip.name, true)}
                              disabled={!canSelect}
                              title={`${cantrip.school} | ${cantrip.castingTime} | ${cantrip.range}\n${cantrip.description}`}
                              style={{
                                padding: '0.4rem 0.75rem',
                                borderRadius: '20px',
                                border: `1px solid ${isSelected ? '#9b59b6' : '#444'}`,
                                background: isSelected ? 'rgba(155, 89, 182, 0.2)' : 'transparent',
                                color: isSelected ? '#9b59b6' : canSelect ? '#ddd' : '#666',
                                cursor: canSelect ? 'pointer' : 'not-allowed',
                                fontSize: '0.85rem',
                                transition: 'all 0.2s'
                              }}
                            >
                              {cantrip.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Spells */}
                  {maxSpellLevel >= 1 && numSpells > 0 && (
                    <div>
                      <h4 style={{ color: '#3498db', marginBottom: '0.5rem' }}>
                        {isPreparedCaster ? 'Prepared Spells' : 'Spells Known'}
                        <span style={{ color: '#888', fontWeight: 'normal', fontSize: '0.85rem', marginLeft: '0.5rem' }}>
                          ({isPreparedCaster ? 'Prepare' : 'Choose'} up to {numSpells})
                        </span>
                      </h4>
                      <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                        Selected: {companionData.spellsKnown.length} / {numSpells}
                        {isPreparedCaster && (
                          <span style={{ marginLeft: '0.5rem' }}>
                            (Based on {spellcastingAbility.toUpperCase()} modifier + level)
                          </span>
                        )}
                      </p>

                      {/* Group spells by level */}
                      {Array.from({ length: maxSpellLevel }, (_, i) => i + 1).map(spellLevel => {
                        const spellsAtThisLevel = availableSpells.filter(s => s.level === spellLevel)
                        if (spellsAtThisLevel.length === 0) return null

                        return (
                          <div key={spellLevel} style={{ marginBottom: '1rem' }}>
                            <h5 style={{
                              color: '#f1c40f',
                              fontSize: '0.85rem',
                              marginBottom: '0.5rem',
                              fontWeight: 'normal'
                            }}>
                              {spellLevel === 1 ? '1st' : spellLevel === 2 ? '2nd' : spellLevel === 3 ? '3rd' : `${spellLevel}th`} Level
                            </h5>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                              {spellsAtThisLevel.map(spell => {
                                const isSelected = companionData.spellsKnown.includes(spell.name)
                                const canSelect = isSelected || companionData.spellsKnown.length < numSpells
                                return (
                                  <button
                                    key={spell.name}
                                    onClick={() => toggleSpell(spell.name, false)}
                                    disabled={!canSelect}
                                    title={`${spell.school} | ${spell.castingTime} | ${spell.range}${spell.ritual ? ' | Ritual' : ''}\n${spell.description}`}
                                    style={{
                                      padding: '0.4rem 0.75rem',
                                      borderRadius: '20px',
                                      border: `1px solid ${isSelected ? '#3498db' : '#444'}`,
                                      background: isSelected ? 'rgba(52, 152, 219, 0.2)' : 'transparent',
                                      color: isSelected ? '#3498db' : canSelect ? '#ddd' : '#666',
                                      cursor: canSelect ? 'pointer' : 'not-allowed',
                                      fontSize: '0.85rem',
                                      transition: 'all 0.2s'
                                    }}
                                  >
                                    {spell.name}
                                    {spell.ritual && <span style={{ marginLeft: '0.25rem', fontSize: '0.7em', color: '#9b59b6' }}>(R)</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* No spells available message */}
                  {maxSpellLevel === 0 && numCantrips === 0 && (
                    <p style={{ color: '#888', fontSize: '0.85rem', fontStyle: 'italic' }}>
                      {companionData.companionClass} doesn't gain spellcasting until a higher level.
                    </p>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* Step 3: Character Details */}
        {step === 3 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Character Details</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Alignment
                </label>
                <select
                  value={companionData.alignment}
                  onChange={(e) => updateField('alignment', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  <option value="">Select alignment...</option>
                  {ALIGNMENTS.map(a => (
                    <option key={a.value} value={a.value}>{a.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Lifestyle
                </label>
                <select
                  value={companionData.lifestyle}
                  onChange={(e) => updateField('lifestyle', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.6rem',
                    background: '#2a2a2a',
                    border: '1px solid #444',
                    borderRadius: '4px',
                    color: '#fff'
                  }}
                >
                  {LIFESTYLES.map(l => (
                    <option key={l.value} value={l.value}>{l.label} ({l.cost})</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Faith / Deity
              </label>
              <select
                value={companionData.faith}
                onChange={(e) => updateField('faith', e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
              >
                <option value="">None / Not Religious</option>
                {deitiesData && (() => {
                  // Group deities by pantheon
                  const grouped = {}
                  Object.values(deitiesData).forEach(deity => {
                    const pantheon = deity.pantheon || 'Other'
                    if (!grouped[pantheon]) grouped[pantheon] = []
                    grouped[pantheon].push(deity)
                  })
                  return Object.entries(grouped).map(([pantheon, deities]) => (
                    <optgroup key={pantheon} label={pantheon}>
                      {deities.map(deity => (
                        <option key={deity.name} value={deity.name}>
                          {deity.name}{deity.domain ? ` (${deity.domain})` : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))
                })()}
              </select>
              {companionData.faith && deitiesData && (
                <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '0.5rem', fontStyle: 'italic' }}>
                  {Object.values(deitiesData).find(d => d.name === companionData.faith)?.description}
                </p>
              )}
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ color: '#f1c40f', marginBottom: '0.75rem' }}>Starting Gold</h4>
              <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                Set initial wealth for this companion.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                <div>
                  <label style={{ color: '#f1c40f', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                    Gold (GP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={companionData.startingGoldGp}
                    onChange={(e) => updateField('startingGoldGp', parseInt(e.target.value) || 0)}
                    style={{
                      width: '100%',
                      padding: '0.6rem',
                      background: '#2a2a2a',
                      border: '1px solid #f1c40f',
                      borderRadius: '4px',
                      color: '#fff'
                    }}
                  />
                </div>
                <div>
                  <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                    Silver (SP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={companionData.startingGoldSp}
                    onChange={(e) => updateField('startingGoldSp', parseInt(e.target.value) || 0)}
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
                  <label style={{ color: '#b87333', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                    Copper (CP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={companionData.startingGoldCp}
                    onChange={(e) => updateField('startingGoldCp', parseInt(e.target.value) || 0)}
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
            </div>
          </div>
        )}

        {/* Step 5: Appearance */}
        {step === 5 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Appearance</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Height
                </label>
                <input
                  type="text"
                  value={companionData.height}
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
                  value={companionData.build}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Hair Color
                </label>
                <input
                  type="text"
                  value={companionData.hairColor}
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
                  value={companionData.hairStyle}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Eye Color
                </label>
                <input
                  type="text"
                  value={companionData.eyeColor}
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
                  value={companionData.skinTone}
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

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Distinguishing Marks
              </label>
              <textarea
                value={companionData.distinguishingMarks}
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

        {/* Step 4: Personality */}
        {step === 4 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Personality & Background</h3>

            <div>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Personality Trait
              </label>
              <textarea
                value={companionData.personalityTrait1}
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

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Second Personality Trait
              </label>
              <textarea
                value={companionData.personalityTrait2}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Voice/Speech
                </label>
                <input
                  type="text"
                  value={companionData.voice}
                  onChange={(e) => updateField('voice', e.target.value)}
                  placeholder="e.g. Gruff, Melodic..."
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
                  Mannerism
                </label>
                <input
                  type="text"
                  value={companionData.mannerism}
                  onChange={(e) => updateField('mannerism', e.target.value)}
                  placeholder="e.g. Fidgets constantly..."
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

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Motivation
              </label>
              <input
                type="text"
                value={companionData.motivation}
                onChange={(e) => updateField('motivation', e.target.value)}
                placeholder="What drives this character?"
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

            {/* Ideals, Bonds, Flaws */}
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(155, 89, 182, 0.1)',
              border: '1px solid #9b59b6',
              borderRadius: '8px'
            }}>
              <h4 style={{ color: '#9b59b6', margin: '0 0 1rem 0' }}>Character Values</h4>

              <div>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Ideals
                </label>
                <textarea
                  value={companionData.ideals}
                  onChange={(e) => updateField('ideals', e.target.value)}
                  placeholder="What principles guide this character? (e.g., Freedom, Honor, Knowledge)"
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

              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Bonds
                </label>
                <textarea
                  value={companionData.bonds}
                  onChange={(e) => updateField('bonds', e.target.value)}
                  placeholder="What connections tie this character to the world? (e.g., family, mentor, homeland)"
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

              <div style={{ marginTop: '0.75rem' }}>
                <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                  Flaws
                </label>
                <textarea
                  value={companionData.flaws}
                  onChange={(e) => updateField('flaws', e.target.value)}
                  placeholder="What weaknesses or vices does this character have? (e.g., pride, addiction, phobia)"
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
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Relationship to Party
              </label>
              <textarea
                value={companionData.relationshipToParty}
                onChange={(e) => updateField('relationshipToParty', e.target.value)}
                placeholder="How did they join? What's their connection to the party?"
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

            <div style={{ marginTop: '1rem' }}>
              <label style={{ color: '#bbb', fontSize: '0.85rem', display: 'block', marginBottom: '0.3rem' }}>
                Backstory
              </label>
              <textarea
                value={companionData.backstory}
                onChange={(e) => updateField('backstory', e.target.value)}
                placeholder="Brief history and background..."
                rows={4}
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

        {/* Step 6: Review */}
        {step === 6 && (
          <div className="builder-step">
            <h3 style={{ color: '#3498db', marginBottom: '1rem' }}>Review Your Party Member</h3>

            {/* Basic Info Card */}
            <div style={{
              background: 'rgba(155, 89, 182, 0.1)',
              border: '1px solid #9b59b6',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#9b59b6', margin: '0 0 0.75rem 0' }}>
                {companionData.nickname || companionData.name}
              </h4>
              {companionData.nickname && (
                <p style={{ color: '#888', margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>
                  {companionData.name}
                </p>
              )}
              <p style={{ color: '#ddd', margin: 0 }}>
                Level {companionData.level} {companionData.companionClass}
                {companionData.subclass && ` (${companionData.subclass})`}
                {companionData.race && ` • ${companionData.subrace || ''} ${companionData.race}`.trim()}
                {companionData.gender && ` • ${companionData.gender}`}
                {companionData.age && ` • ${companionData.age}`}
              </p>
              {companionData.background && (
                <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                  Background: {companionData.background}
                </p>
              )}
              {(companionData.alignment || companionData.faith || companionData.lifestyle) && (
                <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
                  {[
                    companionData.alignment && ALIGNMENTS.find(a => a.value === companionData.alignment)?.label,
                    companionData.faith && `Worships ${companionData.faith}`,
                    companionData.lifestyle && `${companionData.lifestyle.charAt(0).toUpperCase() + companionData.lifestyle.slice(1)} lifestyle`
                  ].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>

            {/* Starting Gold */}
            {(companionData.startingGoldGp > 0 || companionData.startingGoldSp > 0 || companionData.startingGoldCp > 0) && (
              <div style={{
                background: 'rgba(241, 196, 15, 0.1)',
                border: '1px solid #f1c40f',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#f1c40f', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  Starting Wealth
                </h4>
                <div style={{ display: 'flex', gap: '1rem', color: '#ddd' }}>
                  {companionData.startingGoldGp > 0 && (
                    <span><strong style={{ color: '#f1c40f' }}>{companionData.startingGoldGp}</strong> GP</span>
                  )}
                  {companionData.startingGoldSp > 0 && (
                    <span><strong style={{ color: '#bbb' }}>{companionData.startingGoldSp}</strong> SP</span>
                  )}
                  {companionData.startingGoldCp > 0 && (
                    <span><strong style={{ color: '#b87333' }}>{companionData.startingGoldCp}</strong> CP</span>
                  )}
                </div>
              </div>
            )}

            {/* Skill Proficiencies */}
            {companionData.skillProficiencies.length > 0 && (
              <div style={{
                background: 'rgba(46, 204, 113, 0.1)',
                border: '1px solid #2ecc71',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#2ecc71', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  Skill Proficiencies
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {companionData.skillProficiencies.map(skill => (
                    <span
                      key={skill}
                      style={{
                        padding: '0.25rem 0.6rem',
                        background: 'rgba(46, 204, 113, 0.2)',
                        border: '1px solid #2ecc71',
                        borderRadius: '12px',
                        fontSize: '0.85rem',
                        color: '#2ecc71'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Spells */}
            {(companionData.cantrips.length > 0 || companionData.spellsKnown.length > 0) && (
              <div style={{
                background: 'rgba(52, 152, 219, 0.1)',
                border: '1px solid #3498db',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#3498db', margin: '0 0 0.5rem 0', fontSize: '0.95rem' }}>
                  Spells
                </h4>
                {companionData.cantrips.length > 0 && (
                  <div style={{ marginBottom: companionData.spellsKnown.length > 0 ? '0.75rem' : 0 }}>
                    <div style={{ color: '#9b59b6', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Cantrips</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {companionData.cantrips.map(spell => (
                        <span
                          key={spell}
                          style={{
                            padding: '0.25rem 0.6rem',
                            background: 'rgba(155, 89, 182, 0.2)',
                            border: '1px solid #9b59b6',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            color: '#9b59b6'
                          }}
                        >
                          {spell}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {companionData.spellsKnown.length > 0 && (
                  <div>
                    <div style={{ color: '#3498db', fontSize: '0.8rem', marginBottom: '0.3rem' }}>Spells Known</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {companionData.spellsKnown.map(spell => (
                        <span
                          key={spell}
                          style={{
                            padding: '0.25rem 0.6rem',
                            background: 'rgba(52, 152, 219, 0.2)',
                            border: '1px solid #3498db',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            color: '#3498db'
                          }}
                        >
                          {spell}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Ability Scores */}
            <div style={{
              background: 'rgba(241, 196, 15, 0.1)',
              border: '1px solid #f1c40f',
              borderRadius: '8px',
              padding: '1rem',
              marginBottom: '1rem'
            }}>
              <h4 style={{ color: '#f1c40f', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                Ability Scores
              </h4>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(6, 1fr)',
                gap: '0.5rem'
              }}>
                {Object.entries(ABILITY_NAMES).map(([key]) => {
                  const racialBonus = totalRacialBonuses[key] || 0
                  const finalScore = finalAbilityScores[key]
                  return (
                    <div
                      key={key}
                      style={{
                        background: 'rgba(0, 0, 0, 0.2)',
                        borderRadius: '4px',
                        padding: '0.4rem',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ color: '#888', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                        {key}
                      </div>
                      <div style={{ fontWeight: 'bold', color: '#fff' }}>
                        {finalScore}
                        {racialBonus > 0 && (
                          <span style={{ color: '#2ecc71', fontSize: '0.7rem', marginLeft: '2px' }}>
                            (+{racialBonus})
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#f1c40f', fontSize: '0.8rem' }}>
                        {getModifier(finalScore)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Appearance */}
            {(companionData.height || companionData.build || companionData.hairColor ||
              companionData.eyeColor || companionData.skinTone || companionData.distinguishingMarks) && (
              <div style={{
                background: 'rgba(52, 152, 219, 0.1)',
                border: '1px solid #3498db',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#3498db', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Appearance
                </h4>
                <div style={{ color: '#ddd', fontSize: '0.9rem' }}>
                  {[
                    companionData.height && `Height: ${companionData.height}`,
                    companionData.build && `Build: ${companionData.build}`,
                    companionData.hairColor && `Hair: ${companionData.hairColor}${companionData.hairStyle ? `, ${companionData.hairStyle}` : ''}`,
                    companionData.eyeColor && `Eyes: ${companionData.eyeColor}`,
                    companionData.skinTone && `Skin: ${companionData.skinTone}`
                  ].filter(Boolean).join(' • ')}
                </div>
                {companionData.distinguishingMarks && (
                  <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontStyle: 'italic', fontSize: '0.85rem' }}>
                    {companionData.distinguishingMarks}
                  </p>
                )}
              </div>
            )}

            {/* Personality */}
            {(companionData.personalityTrait1 || companionData.personalityTrait2 ||
              companionData.voice || companionData.motivation ||
              companionData.ideals || companionData.bonds || companionData.flaws) && (
              <div style={{
                background: 'rgba(46, 204, 113, 0.1)',
                border: '1px solid #2ecc71',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1rem'
              }}>
                <h4 style={{ color: '#2ecc71', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Personality
                </h4>
                {companionData.personalityTrait1 && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    {companionData.personalityTrait1}
                  </p>
                )}
                {companionData.personalityTrait2 && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    {companionData.personalityTrait2}
                  </p>
                )}
                {companionData.voice && (
                  <p style={{ color: '#888', margin: '0.5rem 0 0 0', fontSize: '0.85rem' }}>
                    Voice: {companionData.voice}
                  </p>
                )}
                {companionData.motivation && (
                  <p style={{ color: '#888', margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>
                    Motivation: {companionData.motivation}
                  </p>
                )}
                {(companionData.ideals || companionData.bonds || companionData.flaws) && (
                  <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid rgba(46, 204, 113, 0.3)' }}>
                    {companionData.ideals && (
                      <p style={{ color: '#888', margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>
                        <strong style={{ color: '#2ecc71' }}>Ideals:</strong> {companionData.ideals}
                      </p>
                    )}
                    {companionData.bonds && (
                      <p style={{ color: '#888', margin: '0 0 0.25rem 0', fontSize: '0.85rem' }}>
                        <strong style={{ color: '#2ecc71' }}>Bonds:</strong> {companionData.bonds}
                      </p>
                    )}
                    {companionData.flaws && (
                      <p style={{ color: '#888', margin: '0', fontSize: '0.85rem' }}>
                        <strong style={{ color: '#2ecc71' }}>Flaws:</strong> {companionData.flaws}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Backstory */}
            {(companionData.backstory || companionData.relationshipToParty) && (
              <div style={{
                background: 'rgba(231, 76, 60, 0.1)',
                border: '1px solid #e74c3c',
                borderRadius: '8px',
                padding: '1rem'
              }}>
                <h4 style={{ color: '#e74c3c', margin: '0 0 0.75rem 0', fontSize: '0.95rem' }}>
                  Background
                </h4>
                {companionData.relationshipToParty && (
                  <p style={{ color: '#ddd', margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}>
                    <strong style={{ color: '#e74c3c' }}>Party Connection:</strong> {companionData.relationshipToParty}
                  </p>
                )}
                {companionData.backstory && (
                  <p style={{ color: '#ddd', margin: 0, fontSize: '0.9rem' }}>
                    {companionData.backstory}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '2rem',
          paddingTop: '1rem',
          borderTop: '1px solid #444'
        }}>
          <button
            className="button button-secondary"
            onClick={() => step === 1 ? onCancel() : setStep(step - 1)}
          >
            {step === 1 ? 'Cancel' : '← Back'}
          </button>

          {step < 6 ? (
            <button
              className="button"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Continue →
            </button>
          ) : (
            <button
              className="button"
              onClick={handleSubmit}
              disabled={submitting || !canProceed()}
              style={{ background: '#2ecc71' }}
            >
              {submitting ? 'Creating...' : 'Create Party Member'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default PartyBuilder
