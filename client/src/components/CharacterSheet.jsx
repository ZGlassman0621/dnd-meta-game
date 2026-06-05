import { useState, useEffect } from 'react'
import classesData from '../data/classes.json'
import racesData from '../data/races.json'
import backgroundsData from '../data/backgrounds.json'
import deitiesData from '../data/deities.json'
import equipmentData from '../data/equipment.json'
import '../styles/hearth.css'

/* ───────────────────────── Hearth Character Sheet ─────────────────────────
   Implements the Claude Design "Hearth · Character Sheet" handoff
   (Claude UX Design/Hearth/design_handoff_character_sheet/). Dark-editorial,
   full-screen read view with its own header. Wires the design's actions
   (back · level up · short/long rest) to live character data; deep editing
   stays in the legacy wizard (onEditInWizard). Styles in styles/hearth.css.
   ──────────────────────────────────────────────────────────────────────── */

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const ABILITY_NAME = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
const ABILITY_SHORT = { str: 'Str', dex: 'Dex', con: 'Con', int: 'Int', wis: 'Wis', cha: 'Cha' }
const ABILITY_GOVERNS = {
  str: 'Athletics · carrying · grapples & shoves',
  dex: 'AC · attacks · Acrobatics, Stealth · initiative',
  con: 'Hit points · concentration saves',
  int: 'Arcana · History · Investigation · Nature · Religion',
  wis: 'Insight, Perception, Medicine, Survival · many save DCs',
  cha: 'Persuasion · Deception · Intimidation · Performance'
}
const SKILL_LIST = [
  { key: 'acrobatics', name: 'Acrobatics', ab: 'dex' },
  { key: 'animal_handling', name: 'Animal Handling', ab: 'wis' },
  { key: 'arcana', name: 'Arcana', ab: 'int' },
  { key: 'athletics', name: 'Athletics', ab: 'str' },
  { key: 'deception', name: 'Deception', ab: 'cha' },
  { key: 'history', name: 'History', ab: 'int' },
  { key: 'insight', name: 'Insight', ab: 'wis' },
  { key: 'intimidation', name: 'Intimidation', ab: 'cha' },
  { key: 'investigation', name: 'Investigation', ab: 'int' },
  { key: 'medicine', name: 'Medicine', ab: 'wis' },
  { key: 'nature', name: 'Nature', ab: 'int' },
  { key: 'perception', name: 'Perception', ab: 'wis' },
  { key: 'performance', name: 'Performance', ab: 'cha' },
  { key: 'persuasion', name: 'Persuasion', ab: 'cha' },
  { key: 'religion', name: 'Religion', ab: 'int' },
  { key: 'sleight_of_hand', name: 'Sleight of Hand', ab: 'dex' },
  { key: 'stealth', name: 'Stealth', ab: 'dex' },
  { key: 'survival', name: 'Survival', ab: 'wis' }
]
const THEME_TIER_LEVELS = { 1: 1, 2: 5, 3: 11, 4: 17 }
const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' }

const Ic = ({ n, style }) => <svg className="ic" style={style}><use href={`#i-${n}`} /></svg>
const norm = (s) => (s || '').toLowerCase().replace(/[^a-z]/g, '')
const modStr = (n) => (n >= 0 ? `+${n}` : `−${Math.abs(n)}`)
const parseJson = (field, dflt) => {
  if (field == null) return dflt
  if (typeof field !== 'string') return field
  try { return JSON.parse(field) } catch { return dflt }
}

function HearthSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></symbol>
      <symbol id="i-chevrons-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></symbol>
      <symbol id="i-chevrons-up2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 11 12 6 7 11" /><polyline points="17 18 12 13 7 18" /></symbol>
      <symbol id="i-coffee" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><line x1="6" y1="2" x2="6" y2="4" /><line x1="10" y1="2" x2="10" y2="4" /></symbol>
      <symbol id="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></symbol>
      <symbol id="i-moon2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></symbol>
      <symbol id="i-brain" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" /><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" /></symbol>
      <symbol id="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></symbol>
      <symbol id="i-sword" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 17.5L3 6V3h3l11.5 11.5" /><path d="M13 19l6-6" /><path d="M16 16l4 4" /><path d="M19 21l2-2" /></symbol>
      <symbol id="i-scroll" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4" /><path d="M19 17V5a2 2 0 0 0-2-2H4" /></symbol>
      <symbol id="i-pack" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /><path d="M8 10h8M8 18v-8a4 4 0 0 1 8 0v8" /></symbol>
      <symbol id="i-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></symbol>
      <symbol id="i-wind" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2" /></symbol>
      <symbol id="i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></symbol>
      <symbol id="i-target" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></symbol>
      <symbol id="i-shield" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></symbol>
      <symbol id="i-vial" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 2v15a3 3 0 0 0 6 0V2" /><path d="M8 2h8" /><path d="M9 11h6" /></symbol>
      <symbol id="i-bow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M5 19A12 12 0 0 0 19 5" /><path d="M5 19l3-3M5 19H9M5 19V15" /><path d="M3 21l5-5" /></symbol>
      <symbol id="i-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></symbol>
      <symbol id="i-flame" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.5 0 2.8-.6 3.5-2 .3-.5.5-1 .5-1.5 0-.7-.3-1.4-.5-2-.2-.4-.6-1-.5-1.5.1-.9.6-1.4 1.3-2C17 6.6 18 4.6 18 3c0 0-3 .5-6 3-2.4 2-4 4-4 7 0 .8 0 1 .5 1.5z" /></symbol>
      <symbol id="i-feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></symbol>
      <symbol id="i-token" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /></symbol>
    </defs></svg>
  )
}

const SecHead = ({ title, sub }) => (
  <div className="sec-head"><h2>{title}</h2><span className="glyph">❧</span><span className="fl"></span>{sub ? <span className="sub">{sub}</span> : null}</div>
)

function CharacterSheet({ character: initialCharacter, onBack, onCharacterUpdated, onEditInWizard, onLevelUp }) {
  const [character, setCharacter] = useState(initialCharacter)
  const [activeTab, setActiveTab] = useState('overview')
  const [canLevelUp, setCanLevelUp] = useState(false)
  const [spellSlots, setSpellSlots] = useState(null)
  const [progression, setProgression] = useState(null)
  const [resting, setResting] = useState(false)
  const [restMsg, setRestMsg] = useState(null)

  useEffect(() => {
    fetch(`/api/character/${initialCharacter.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCharacter(d) })
      .catch(() => {})
  }, [initialCharacter.id])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/character/${character.id}/progression`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d) setProgression(d) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [character.id])

  useEffect(() => {
    fetch(`/api/character/can-level-up/${character.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCanLevelUp(!!d.canLevelUp) })
      .catch(() => {})
  }, [character.id, character.experience])

  useEffect(() => {
    fetch(`/api/character/spell-slots/${character.id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setSpellSlots(d) })
      .catch(() => {})
  }, [character.id, character.level, character.class])

  const handleGrantXP = async (amount) => {
    try {
      const r = await fetch(`/api/character/grant-xp/${character.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount })
      })
      if (r.ok) { const d = await r.json(); setCharacter(d.character); setCanLevelUp(!!d.canLevelUp); onCharacterUpdated?.(d.character) }
    } catch (e) { console.error('grant xp', e) }
  }

  const handleRest = async (restType) => {
    if (resting) return
    setResting(true); setRestMsg(null)
    try {
      const r = await fetch(`/api/character/rest/${character.id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ restType })
      })
      if (r.ok) {
        const d = await r.json()
        if (d.character) { setCharacter(d.character); onCharacterUpdated?.(d.character) }
        else { setCharacter(prev => ({ ...prev, current_hp: d.newHp ?? prev.current_hp })) }
        setRestMsg(d.message || `${restType === 'long' ? 'Long' : 'Short'} rest taken.`)
        try { const s = await fetch(`/api/character/spell-slots/${character.id}`); if (s.ok) setSpellSlots(await s.json()) } catch { /* noop */ }
      }
    } catch (e) { console.error('rest', e) } finally { setResting(false); setTimeout(() => setRestMsg(null), 4000) }
  }

  // ── derived data ──────────────────────────────────────────────
  const abilities = parseJson(character.ability_scores, { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
  const charSkills = parseJson(character.skills, [])
  const inventory = parseJson(character.inventory, [])
  const equipment = parseJson(character.equipment, {})
  const knownCantrips = parseJson(character.known_cantrips, [])
  const knownSpells = parseJson(character.known_spells, [])
  const preparedSpells = parseJson(character.prepared_spells, [])
  const charLanguages = parseJson(character.languages, [])

  const level = character.level || 1
  const profBonus = Math.ceil(level / 4) + 1
  const abilityMod = (key) => Math.floor(((abilities[key] ?? 10) - 10) / 2)
  const isSkillProf = (name) => charSkills.some(s => norm(s) === norm(name))

  const classKey = character.class?.toLowerCase()
  const classData = classesData[classKey]
  const raceKey = character.race?.toLowerCase().replace(/[-\s]/g, '_')
  const raceData = racesData[raceKey]
  const backgroundData = backgroundsData[character.background?.toLowerCase()]
  const subclassData = classData?.subclasses?.find(sc => sc.name === character.subclass)

  const saveProf = (key) => {
    const list = (classData?.savingThrows || []).map(s => String(s).toLowerCase())
    return list.includes(key) || list.includes(ABILITY_NAME[key].toLowerCase())
  }
  const skillMod = (sk) => abilityMod(sk.ab) + (isSkillProf(sk.name) ? profBonus : 0)
  const passive = (skillName, ab) => 10 + abilityMod(ab) + (isSkillProf(skillName) ? profBonus : 0)
  const primeAbilities = (classData?.primaryAbility || []).map(a => String(a).toLowerCase())

  // ── equipment data + compute (harvested from legacy sheet) ──
  const ALL_WEAPONS = (() => {
    const w = []
    Object.values(equipmentData.simpleWeapons || {}).forEach(c => c.forEach(x => w.push(x)))
    Object.values(equipmentData.martialWeapons || {}).forEach(c => c.forEach(x => w.push(x)))
    return w
  })()
  const ALL_ARMOR = [...(equipmentData.armor?.light || []), ...(equipmentData.armor?.medium || []), ...(equipmentData.armor?.heavy || [])]
  const ALL_SHIELDS = equipmentData.armor?.shields || []
  const QUALITY_RANKS = equipmentData.qualityRanks || {}

  const calcEquipmentAC = () => {
    const dexMod = abilityMod('dex')
    let ac = 10 + dexMod
    const armor = equipment.armor
    if (armor) {
      const ad = ALL_ARMOR.find(a => a.name === armor.name) || (armor.isCustom ? armor : null)
      if (ad?.baseAC != null) {
        if (ad.armorType === 'heavy') ac = ad.baseAC
        else if (ad.armorType === 'medium') ac = ad.baseAC + Math.min(dexMod, ad.maxDexBonus ?? 2)
        else ac = ad.baseAC + dexMod
      }
      if (armor.quality && QUALITY_RANKS[armor.quality]?.armorBonus) ac += QUALITY_RANKS[armor.quality].armorBonus
    }
    const shield = equipment.offHand
    if (shield) {
      const sd = ALL_SHIELDS.find(s => s.name === shield.name)
      if (sd?.acBonus) ac += sd.acBonus; else if (shield.acBonus) ac += shield.acBonus
    }
    return ac
  }
  const ac = character.armor_class ?? calcEquipmentAC()

  const weaponAbilityMod = (weapon, wd) => {
    const strMod = abilityMod('str'), dexMod = abilityMod('dex')
    const src = wd || weapon
    const finesse = src?.properties?.includes?.('finesse')
    const ranged = src?.rangeType === 'ranged'
    if (finesse) return Math.max(strMod, dexMod)
    if (ranged) return dexMod
    return strMod
  }
  const attackFor = (weapon) => {
    if (!weapon) return null
    const wd = ALL_WEAPONS.find(w => w.name === weapon.name)
    const aMod = weaponAbilityMod(weapon, wd)
    const qBonus = (weapon.quality && QUALITY_RANKS[weapon.quality]?.weaponBonus) || 0
    const base = wd?.damage || weapon.damage || '1d4'
    const dType = (wd?.damageType || weapon.damageType || 'bludgeoning').slice(0, 5)
    return { name: weapon.name, hit: aMod + profBonus + qBonus, dmg: `${base}${modStr(aMod)} ${dType}`, meta: wd?.rangeType === 'ranged' ? 'ranged' : 'melee' }
  }
  const buildAttacks = () => {
    const list = []
    if (equipment.mainHand) { const a = attackFor(equipment.mainHand); if (a) list.push(a) }
    if (equipment.offHand && (equipment.offHand.damage || ALL_WEAPONS.find(w => w.name === equipment.offHand.name))) {
      const a = attackFor(equipment.offHand); if (a) list.push(a)
    }
    // Unarmed / martial-arts fallback
    const isMonk = classKey === 'monk'
    const uMod = isMonk ? Math.max(abilityMod('str'), abilityMod('dex')) : abilityMod('str')
    list.push({ name: isMonk ? 'Unarmed strike' : 'Unarmed strike', hit: uMod + profBonus, dmg: `${isMonk ? '1d6' : '1'}${modStr(uMod)} bludg`, meta: isMonk ? 'flurry' : 'melee' })
    return list
  }
  const attacks = buildAttacks()

  // ── features / traits (harvested accessors) ──
  const classFeatures = (() => {
    const out = []
    const fbl = classData?.featuresByLevel
    if (fbl) Object.entries(fbl).filter(([l]) => parseInt(l) <= level).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([l, fs]) => (fs || []).forEach(f => out.push({ ...f, level: parseInt(l) })))
    return out
  })()
  const subclassFeatures = (() => {
    const out = []
    const fbl = subclassData?.featuresByLevel
    if (fbl) Object.entries(fbl).filter(([l]) => parseInt(l) <= level).sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .forEach(([l, fs]) => (fs || []).forEach(f => out.push({ ...f, level: parseInt(l) })))
    return out
  })()
  const raceTraits = (() => {
    if (!raceData) return []
    const sub = character.subrace && raceData.subraces ? raceData.subraces.find(s => s.name === character.subrace) : null
    const raw = (sub?.traits || raceData.traits || [])
    return raw.map(t => {
      const m = String(t).split(/\s+[—-]\s+/)
      return m.length > 1 ? { name: m[0], desc: m.slice(1).join(' — ') } : { name: String(t), desc: '' }
    })
  })()
  const themeUnlocks = progression?.theme_unlocks || []
  const themeTiers = progression?.theme_all_tiers || []
  const theme = progression?.theme
  const ancestryFeats = progression?.ancestry_feats || []
  const knightPath = progression?.knight_moral_path

  const isCaster = !!classData?.spellcasting || (spellSlots && Object.values(spellSlots.max || {}).some(v => v > 0)) ||
    knownCantrips.length > 0 || knownSpells.length > 0 || preparedSpells.length > 0

  // identity
  const monogram = (character.name || '?').trim().charAt(0).toUpperCase()
  const deityName = character.faith ? (deitiesData[character.faith]?.name || deitiesData[character.faith]?.title || character.faith.replace(/_/g, ' ')) : null
  const themeName = theme?.theme_name
  const subtitleParts = [
    character.subrace || character.race,
    [character.class, character.subclass].filter(Boolean).join(' · '),
    themeName || (character.background ? character.background : null)
  ].filter(Boolean)

  const hpRatio = character.max_hp ? (character.current_hp / character.max_hp) : 1
  const hpClass = hpRatio > 0.5 ? 'hp' : hpRatio > 0.25 ? 'warn' : 'bad'
  const speed = character.speed || raceData?.speed || 30
  const hitDie = classData?.hitDie || 8

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'brain' },
    { id: 'abilities', label: 'Abilities & Skills', icon: 'target' },
    { id: 'features', label: 'Features & Traits', icon: 'sparkles' },
    { id: 'progression', label: 'Progression', icon: 'chevrons-up2' },
    ...(isCaster ? [{ id: 'spells', label: 'Spells', icon: 'sparkles' }] : []),
    { id: 'equipment', label: 'Equipment', icon: 'sword' },
    { id: 'inventory', label: 'Inventory', icon: 'pack', count: inventory.length },
    { id: 'background', label: 'Background', icon: 'scroll' }
  ]

  const setTab = (id) => { setActiveTab(id); const el = document.querySelector('.hearth'); if (el) el.scrollTo({ top: 0 }) }

  // ───────────────────────── tab renderers ─────────────────────────
  const renderOverview = () => (
    <div>
      <div className="grid3">
        <section className="card panel-pad">
          <SecHead title="Abilities" sub={primeAbilities.length ? `${primeAbilities.map(a => ABILITY_SHORT[a]).join(' · ')} prime` : null} />
          <div className="abilities">
            {ABILITY_ORDER.map(k => (
              <div key={k} className={`ability${primeAbilities.includes(k) ? ' prime' : ''}`}>
                <div className="nm">{ABILITY_SHORT[k]}</div>
                <div className="sc">{abilities[k] ?? 10}</div>
                <div className="md">{modStr(abilityMod(k))}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="card panel-pad">
          <SecHead title="Saves" sub={ABILITY_ORDER.filter(saveProf).map(k => ABILITY_SHORT[k]).join(' · ') || null} />
          <div className="rows">
            {ABILITY_ORDER.map(k => (
              <div key={k} className={`rrow${saveProf(k) ? ' prof' : ''}`}>
                <span className="dot"></span><span className="nm">{ABILITY_NAME[k]}</span>
                <span className="md">{modStr(abilityMod(k) + (saveProf(k) ? profBonus : 0))}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card panel-pad">
          <SecHead title="Senses" />
          <div className="senses">
            <div className="srow"><span className="l"><Ic n="eye" />Perception</span><span className="v">{passive('Perception', 'wis')}</span></div>
            <div className="srow"><span className="l"><Ic n="brain" />Insight</span><span className="v">{passive('Insight', 'wis')}</span></div>
            <div className="srow"><span className="l"><Ic n="search" />Investigation</span><span className="v">{passive('Investigation', 'int')}</span></div>
            {raceTraits.length > 0 && (
              <div className="senses-note">{raceTraits.slice(0, 3).map(t => t.name).join(' · ')}</div>
            )}
          </div>
        </section>
      </div>

      <div className="grid2">
        <section className="card panel-pad">
          <SecHead title="Skills" sub="● proficient" />
          <div className="skills">
            {SKILL_LIST.map(sk => (
              <div key={sk.key} className={`skill${isSkillProf(sk.name) ? ' prof' : ''}`}>
                <span className="dot"></span><span className="nm">{sk.name}</span>
                <span className="ab">{ABILITY_SHORT[sk.ab]}</span><span className="md">{modStr(skillMod(sk))}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card panel-pad">
          <SecHead title="Proficiencies" />
          {charLanguages.length > 0 && (
            <div className="kv"><div className="kl">Languages</div><div className="tags">{charLanguages.map((l, i) => <span key={i} className="chip">{l}</span>)}</div></div>
          )}
          <div className="kv"><div className="kl">Weapons & armor</div><div className="prose">{(classData?.weaponProficiencies || []).join(', ') || 'Simple weapons'}{classData?.armorProficiencies?.length ? ` · ${classData.armorProficiencies.join(', ')} armor` : ' · no armor'}</div></div>
          {classData?.toolProficiencies?.length > 0 && (
            <div className="kv"><div className="kl">Tools</div><div className="tags">{classData.toolProficiencies.map((t, i) => <span key={i} className="chip">{t}</span>)}</div></div>
          )}
        </section>
      </div>

      <div className="grid2">
        <section className="card panel-pad">
          <SecHead title="Attacks" />
          {attacks.map((a, i) => (
            <div key={i} className="atk"><span className="an">{a.name} <span className="meta">{a.meta}</span></span><span className="hit">{modStr(a.hit)}</span><span className="dmg">{a.dmg}</span></div>
          ))}
        </section>
        <section className="card panel-pad">
          <SecHead title="Key features" />
          {[...subclassFeatures, ...classFeatures].slice(0, 3).map((f, i) => (
            <div key={i} className="feat"><div className="ft">{f.name}<span className="src">{character.class} {f.level}</span></div><div className="fd">{f.description}</div></div>
          ))}
          {classFeatures.length === 0 && subclassFeatures.length === 0 && raceTraits.slice(0, 3).map((t, i) => (
            <div key={i} className="feat"><div className="ft">{t.name}<span className="src">{character.race}</span></div><div className="fd">{t.desc}</div></div>
          ))}
        </section>
      </div>
      <div className="footnote">{character.name} · level {level} {character.class}{character.subclass ? ` · ${character.subclass}` : ''}</div>
    </div>
  )

  const renderAbilities = () => (
    <div>
      <SecHead title="Ability scores" sub={`proficiency bonus ${modStr(profBonus)}`} />
      <div className="ab-detail">
        {ABILITY_ORDER.map(k => (
          <div key={k} className="ab-card">
            <div className="top"><span className="nm">{ABILITY_NAME[k]}</span><span className="md">{modStr(abilityMod(k))}</span></div>
            <div className="sc">{abilities[k] ?? 10}</div>
            <div className="gov">{ABILITY_GOVERNS[k]}</div>
          </div>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 18 }}>
        <section className="card panel-pad">
          <SecHead title="Saving throws" sub={ABILITY_ORDER.filter(saveProf).map(k => ABILITY_SHORT[k]).join(' · ') || null} />
          <div className="rows">
            {ABILITY_ORDER.map(k => (
              <div key={k} className={`rrow${saveProf(k) ? ' prof' : ''}`}>
                <span className="dot"></span><span className="nm">{ABILITY_NAME[k]}</span>
                <span className="md">{modStr(abilityMod(k) + (saveProf(k) ? profBonus : 0))}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="card panel-pad">
          <SecHead title="At a glance" />
          <div className="senses">
            <div className="srow"><span className="l"><Ic n="eye" />Passive Perception</span><span className="v">{passive('Perception', 'wis')}</span></div>
            <div className="srow"><span className="l"><Ic n="brain" />Passive Insight</span><span className="v">{passive('Insight', 'wis')}</span></div>
            <div className="srow"><span className="l"><Ic n="target" />Proficiency bonus</span><span className="v">{modStr(profBonus)}</span></div>
            <div className="srow"><span className="l"><Ic n="wind" />Initiative</span><span className="v">{modStr(abilityMod('dex'))}</span></div>
          </div>
        </section>
      </div>
      <section className="card panel-pad" style={{ marginTop: 18 }}>
        <SecHead title="Skills" sub="proficiency · ability · modifier" />
        {SKILL_LIST.map(sk => (
          <div key={sk.key} className={`skillrow${isSkillProf(sk.name) ? ' prof' : ''}`}>
            <span className="dot"></span><span className="snm">{sk.name}</span><span className="sab">{ABILITY_SHORT[sk.ab]}</span>
            <span className="ssrc">{isSkillProf(sk.name) ? 'proficient' : ''}</span><span className="smd">{modStr(skillMod(sk))}</span>
          </div>
        ))}
      </section>
    </div>
  )

  const FeatGroup = ({ title, sub, items }) => items.length === 0 ? null : (
    <div style={{ marginBottom: 26 }}>
      <SecHead title={title} sub={sub} />
      <div className="anc">
        {items.map((f, i) => (
          <div key={i} className="anc-feat"><span className="ai"><Ic n={f.icon || 'sparkles'} /></span>
            <div><div className="at">{f.name}</div>{f.desc ? <div className="ad">{f.desc}</div> : null}</div></div>
        ))}
      </div>
    </div>
  )
  const renderFeatures = () => (
    <div>
      <FeatGroup title={character.class || 'Class'} sub={character.subclass ? `${character.subclass} · level ${level}` : `level ${level}`}
        items={[...classFeatures, ...subclassFeatures].map(f => ({ name: f.name, desc: f.description, icon: 'bolt' }))} />
      <FeatGroup title={character.subrace || character.race || 'Ancestry'} sub="ancestry"
        items={raceTraits.map(t => ({ name: t.name, desc: t.desc, icon: 'leaf' }))} />
      <FeatGroup title={themeName || 'Theme'} sub="theme"
        items={themeUnlocks.map(u => ({ name: u.ability_name, desc: u.ability_description, icon: 'scroll' }))} />
      {backgroundData?.feature && (
        <FeatGroup title={character.background ? character.background : 'Background'} sub="background feature"
          items={[{ name: backgroundData.feature.name, desc: backgroundData.feature.description, icon: 'feather' }]} />
      )}
      {classFeatures.length === 0 && subclassFeatures.length === 0 && raceTraits.length === 0 && themeUnlocks.length === 0 && (
        <div className="placeholder"><div className="ph-glyph">❧</div><h3>No features recorded yet</h3><p>Features appear as you choose a class, ancestry, and theme.</p></div>
      )}
    </div>
  )

  const renderProgression = () => {
    if (!theme) {
      return <div className="placeholder"><div className="ph-glyph">❧</div><h3>No theme chosen</h3><p>Themes replace 5e backgrounds and advance in four tiers as you grow. This character has no theme recorded.</p></div>
    }
    const tiers = [1, 2, 3, 4].map(n => {
      const t = themeTiers.find(x => x.tier === n) || {}
      const unlockLv = THEME_TIER_LEVELS[n]
      const done = level >= unlockLv
      return { n, unlockLv, done, name: t.ability_name, ability: t.ability_description }
    })
    const firstNotDone = tiers.find(t => !t.done)?.n
    return (
      <div>
        <section className="theme-hero">
          <div className="th-eyebrow">Theme · replaces background</div>
          <h2>{themeName}</h2>
          {theme.identity ? <div className="th-desc">{theme.identity}</div> : null}
        </section>

        <SecHead title="Theme tiers" sub={`Tier ${ROMAN[Math.max(1, ...tiers.filter(t => t.done).map(t => t.n), 1)]} reached`} />
        <div className="tiers" style={{ marginBottom: 26 }}>
          {tiers.map(t => (
            <div key={t.n} className={`tier ${t.done ? 'done' : t.n === firstNotDone ? 'next' : 'locked'}`}>
              {t.done ? <svg className="check"><use href="#i-check" /></svg> : null}
              <div className="tnum">Tier {ROMAN[t.n]}<span className="lv">Lv {t.unlockLv}</span></div>
              <div className="tname">{t.name || `Tier ${ROMAN[t.n]}`}</div>
              <div className="tab-ab">{t.ability || 'An ability revealed as the theme deepens.'}</div>
            </div>
          ))}
        </div>

        {ancestryFeats.length > 0 && (
          <>
            <SecHead title="Ancestry feats" sub={character.subrace || character.race} />
            <div className="anc" style={{ marginBottom: 26 }}>
              {ancestryFeats.map((f, i) => (
                <div key={i} className="anc-feat"><span className="ai"><Ic n="leaf" /></span>
                  <div><div className="at">{f.feat_name}</div><div className="ad">{f.description}</div></div></div>
              ))}
            </div>
          </>
        )}

        {knightPath && (
          <>
            <SecHead title="Moral path" sub="a conviction, shaped by play" />
            <section className="path-card">
              <div className="path-note" style={{ borderTop: 0, paddingTop: 0 }}>
                Current path: <em style={{ color: 'var(--accent)', fontStyle: 'normal' }}>{(knightPath.current_path || 'true').replace(/_/g, ' ')}</em>.
                {knightPath.last_path_change_reason ? ` ${knightPath.last_path_change_reason}` : ' The path is not a score to win — it bends the choices the Dungeon Master offers you.'}
              </div>
            </section>
          </>
        )}
      </div>
    )
  }

  const renderSpells = () => {
    const max = spellSlots?.max || {}
    const used = spellSlots?.used || {}
    const levels = Object.keys(max).map(Number).filter(l => max[l] > 0).sort((a, b) => a - b)
    return (
      <div>
        {levels.length > 0 && (
          <section className="card panel-pad" style={{ marginBottom: 18 }}>
            <SecHead title="Spell slots" sub="restored on a long rest" />
            <div className="slot-grid">
              {levels.map(l => {
                const m = max[l], u = used[l] || 0
                return (
                  <div key={l} className="slot-cell">
                    <div className="sl-lv">Level {l}</div>
                    <div className="sl-pips">{Array.from({ length: m }).map((_, i) => <span key={i} className={`pip${i >= u ? ' full' : ' spent'}`}></span>)}</div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
        <div className="grid2">
          <section className="card panel-pad">
            <SecHead title={preparedSpells.length ? 'Prepared spells' : 'Known spells'} sub={`${(preparedSpells.length ? preparedSpells : knownSpells).length} total`} />
            <div className="spell-list">
              {(preparedSpells.length ? preparedSpells : knownSpells).map((s, i) => (
                <div key={i} className="spellrow"><span className="spn">{typeof s === 'string' ? s : s.name}</span></div>
              ))}
              {(preparedSpells.length ? preparedSpells : knownSpells).length === 0 && <div className="grp-note">No spells recorded.</div>}
            </div>
          </section>
          <section className="card panel-pad">
            <SecHead title="Cantrips" sub={`${knownCantrips.length} known`} />
            <div className="spell-list">
              {knownCantrips.map((s, i) => (
                <div key={i} className="spellrow"><span className="spn">{typeof s === 'string' ? s : s.name}</span><span className="spm">at will</span></div>
              ))}
              {knownCantrips.length === 0 && <div className="grp-note">No cantrips.</div>}
            </div>
          </section>
        </div>
      </div>
    )
  }

  const renderEquipment = () => {
    const wornArmor = equipment.armor
    const isUnarmored = !wornArmor && (classKey === 'monk' || classKey === 'barbarian')
    return (
      <div>
        <section className="card panel-pad">
          <SecHead title="Wielded" />
          {attacks.map((a, i) => (
            <div key={i} className="atk"><span className="an">{a.name} <span className="meta">{a.meta}</span></span><span className="hit">{modStr(a.hit)}</span><span className="dmg">{a.dmg}</span></div>
          ))}
        </section>
        <div className="grid2" style={{ marginTop: 18 }}>
          <section className="card panel-pad">
            <SecHead title="Armor Class" />
            <div className="ac-break">
              <span className="acbig">{ac}</span>
              <span className="acform">{isUnarmored
                ? <><em>Unarmored Defense</em> — your AC rises with your own discipline rather than armor.</>
                : wornArmor ? <><em>{wornArmor.name}</em> with your Dexterity.</> : <>10 + your Dexterity, unarmored.</>}</span>
            </div>
          </section>
          <section className="card panel-pad">
            <SecHead title="Worn" />
            <div className="kv"><div className="kl">Body</div><div className="prose">{wornArmor?.name || 'Explorer’s clothes — no armor by choice.'}</div></div>
            {equipment.offHand?.name && <div className="kv"><div className="kl">Off hand</div><div className="prose">{equipment.offHand.name}</div></div>}
          </section>
        </div>
        <div style={{ marginTop: 18 }}>
          <SecHead title="Attunement" sub="0 of 3 used" />
          <div className="attune">
            <div className="attune-slot">An open slot</div>
            <div className="attune-slot">An open slot</div>
            <div className="attune-slot">An open slot</div>
          </div>
        </div>
      </div>
    )
  }

  const renderInventory = () => {
    const gp = character.gold_gp || 0, sp = character.gold_sp || 0, cp = character.gold_cp || 0
    return (
      <div className="grid2">
        <section className="card panel-pad">
          <SecHead title="Carried" sub={`${inventory.length} item${inventory.length === 1 ? '' : 's'}`} />
          {inventory.length === 0 && <div className="grp-note">Nothing carried yet.</div>}
          {inventory.map((it, i) => (
            <div key={i} className="invrow">
              <span className="ii"><Ic n={it.equipped ? 'sword' : 'pack'} /></span>
              <div><div className="inm">{it.name}</div>{it.equipped ? <div className="isub">equipped</div> : null}</div>
              <span className="iq">{it.quantity > 1 ? `×${it.quantity}` : ''}</span>
              <span className="iw"></span>
            </div>
          ))}
        </section>
        <div>
          <div className="goldcard"><Ic n="coin" style={{ width: 17, height: 17, color: 'var(--accent)' }} /><span className="gl">Gold</span><span className="gv">{gp} gp</span></div>
          {(sp > 0 || cp > 0) && (
            <section className="card panel-pad" style={{ marginBottom: 14 }}>
              <SecHead title="Coin" />
              <div className="kv"><div className="prose">{gp} gold · {sp} silver · {cp} copper</div></div>
            </section>
          )}
          <section className="card panel-pad">
            <SecHead title="Carrying" />
            <div className="grp-note" style={{ margin: 0 }}>Items the Dungeon Master grants you in play appear here automatically. Strength {abilities.str} · carry up to {abilities.str * 15} lb.</div>
          </section>
        </div>
      </div>
    )
  }

  const renderBackground = () => {
    const paras = (character.backstory || '').split(/\n\s*\n/).filter(Boolean)
    const vows = [
      { cls: '', label: 'Ideal', text: character.ideals },
      { cls: 'bond', label: 'Bond', text: character.bonds },
      { cls: 'flaw', label: 'Flaw', text: character.flaws },
      { cls: 'trait', label: 'Personality', text: character.personality_traits }
    ].filter(v => v.text)
    return (
      <div>
        <SecHead title="The life that shaped them" />
        {paras.length > 0
          ? <div className="bg-prose">{paras.map((p, i) => <p key={i}>{p}</p>)}</div>
          : <div className="placeholder"><div className="ph-glyph">❧</div><h3>No backstory yet</h3><p>Write {character.name}’s story in the wizard, or let it grow through play.</p></div>}
        {vows.length > 0 && (
          <>
            <SecHead title="What drives them" />
            <div className="vows">
              {vows.map((v, i) => (
                <div key={i} className={`vow ${v.cls}`}><div className="vl">{v.label}</div><div className="vt">{v.text}</div></div>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  const PANES = {
    overview: renderOverview, abilities: renderAbilities, features: renderFeatures,
    progression: renderProgression, spells: renderSpells, equipment: renderEquipment,
    inventory: renderInventory, background: renderBackground
  }

  return (
    <div className="hearth scroll">
      <HearthSprite />
      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <button className="back" onClick={onBack}><Ic n="arrow-left" />{character.name ? `${character.name.split(' ')[0]}’s home` : 'Back'}</button>
        <div className="spacer"></div>
        {onEditInWizard && <button className="hdr-link" onClick={() => onEditInWizard(character)}><Ic n="feather" />Edit in wizard</button>}
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      <main className="sheet-canvas">
        <section className="id-hero">
          <div className="crest"><span className="mono">{monogram}</span><span className="lvl">{level}</span></div>
          <div className="id-main">
            <h1>{character.name}</h1>
            <div className="sub">
              {subtitleParts.map((p, i) => (
                <span key={i}>{i > 0 ? <span className="sep">·</span> : null}{p}</span>
              ))}
              {character.nickname ? <><span className="sep">·</span><span style={{ color: 'var(--ink-3)' }}>{character.nickname}</span></> : null}
            </div>
            <div className="id-pills">
              <span className={`ipill ${hpClass}`}><span className="l">HP</span><span className="v">{character.current_hp ?? 0}<span className="mx"> / {character.max_hp ?? 0}</span></span></span>
              <span className="ipill"><span className="l">AC</span><span className="v">{ac}</span></span>
              <span className="ipill"><span className="l">Init</span><span className="v">{modStr(abilityMod('dex'))}</span></span>
              <span className="ipill"><span className="l">Speed</span><span className="v">{speed} ft</span></span>
              <span className="ipill accent"><span className="l">Prof</span><span className="v">{modStr(profBonus)}</span></span>
              {classKey === 'monk' && <span className="ipill"><span className="l">Ki</span><span className="v">{level} / {level}</span></span>}
              <span className="ipill"><span className="l">Hit Dice</span><span className="v">{level}d{hitDie}</span></span>
              {deityName && <span className="ipill"><span className="l">Faith</span><span className="v" style={{ fontSize: 12, textTransform: 'capitalize' }}>{deityName}</span></span>}
            </div>
          </div>
          <div className="id-actions">
            <button className={`btn ${canLevelUp ? 'primary' : ''}`} onClick={() => onLevelUp?.(character)} disabled={!onLevelUp}>
              <Ic n="chevrons-up" />{canLevelUp ? 'Level up' : 'Level up'}
            </button>
            <button className="btn ghost" onClick={() => handleRest('short')} disabled={resting}><Ic n="coffee" />Short rest</button>
            <button className="btn ghost" onClick={() => handleRest('long')} disabled={resting}><Ic n="moon" />Long rest</button>
            <button className="btn ghost sm" onClick={() => handleGrantXP(500)} title="Grant 500 XP (testing)"><Ic n="sparkles" />+500 XP</button>
            {restMsg && <div className="grp-note" style={{ margin: '4px 0 0', textAlign: 'center' }}>{restMsg}</div>}
          </div>
        </section>

        <nav className="tabs">
          {tabs.map(t => (
            <button key={t.id} className={`tab${activeTab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
              <Ic n={t.icon} />{t.label}{t.count != null ? <span className="ct">{t.count}</span> : null}
            </button>
          ))}
        </nav>

        <div className="tabpane show">
          {(PANES[activeTab] || renderOverview)()}
        </div>
      </main>
    </div>
  )
}

export default CharacterSheet
