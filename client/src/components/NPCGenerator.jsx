import { useState, useEffect } from 'react'
import races from '../data/races.json'
import npcOccupations from '../data/npcOccupations.json'
import npcPersonalities from '../data/npcPersonalities.json'
import npcPhysical from '../data/npcPhysical.json'
import npcStatBlocks from '../data/npcStatBlocks.json'
import npcNames from '../data/npcNames.json'

function NPCGenerator({ onBack }) {
  const [npcs, setNpcs] = useState([])
  const [selectedNpc, setSelectedNpc] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    race: '',
    gender: '',
    age: '',
    occupation: '',
    occupation_category: '',
    stat_block: 'commoner',
    cr: '0',
    ac: 10,
    hp: 4,
    speed: '30 ft.',
    ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    skills: [],
    languages: 'Common',
    height: '',
    build: '',
    hair_color: '',
    hair_style: '',
    eye_color: '',
    skin_tone: '',
    facial_features: [],
    distinguishing_marks: '',
    facial_hair: '',
    clothing_style: '',
    accessories: '',
    voice: '',
    personality_trait_1: '',
    personality_trait_2: '',
    mannerism: '',
    motivation: '',
    fear: '',
    secret: '',
    quirk: '',
    current_location: '',
    typical_locations: '',
    background_notes: '',
    relationship_to_party: '',
    campaign_availability: 'available',
    avatar: null,
    avatarPreview: null
  })

  useEffect(() => {
    loadNpcs()
  }, [])

  const loadNpcs = async () => {
    try {
      const response = await fetch('/api/npc')
      const data = await response.json()
      setNpcs(data)
    } catch (error) {
      console.error('Error loading NPCs:', error)
    } finally {
      setLoading(false)
    }
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
        console.error('Upload failed:', result.error)
        alert(`Failed to upload portrait: ${result.error || 'Unknown error'}`)
        setFormData(prev => ({ ...prev, avatarPreview: null }))
      }
    } catch (error) {
      console.error('Error uploading portrait:', error)
      alert(`Failed to upload portrait: ${error.message}`)
      setFormData(prev => ({ ...prev, avatarPreview: null }))
    }
  }

  const removeAvatar = () => {
    setFormData(prev => ({ ...prev, avatar: null, avatarPreview: null }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      const url = selectedNpc ? `/api/npc/${selectedNpc.id}` : '/api/npc'
      const method = selectedNpc ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (response.ok) {
        const npc = await response.json()
        if (selectedNpc) {
          setNpcs(npcs.map(n => n.id === npc.id ? npc : n))
        } else {
          setNpcs([npc, ...npcs])
        }
        setShowForm(false)
        setSelectedNpc(null)
        resetForm()
      }
    } catch (error) {
      console.error('Error saving NPC:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this NPC?')) return

    try {
      const response = await fetch(`/api/npc/${id}`, { method: 'DELETE' })
      if (response.ok) {
        setNpcs(npcs.filter(n => n.id !== id))
        if (selectedNpc?.id === id) {
          setSelectedNpc(null)
        }
      }
    } catch (error) {
      console.error('Error deleting NPC:', error)
    }
  }

  const handleEdit = (npc) => {
    setFormData({
      name: npc.name || '',
      nickname: npc.nickname || '',
      race: npc.race || '',
      gender: npc.gender || '',
      age: npc.age || '',
      occupation: npc.occupation || '',
      occupation_category: npc.occupation_category || '',
      stat_block: npc.stat_block || 'commoner',
      cr: npc.cr || '0',
      ac: npc.ac || 10,
      hp: npc.hp || 4,
      speed: npc.speed || '30 ft.',
      ability_scores: typeof npc.ability_scores === 'string'
        ? JSON.parse(npc.ability_scores)
        : npc.ability_scores || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skills: typeof npc.skills === 'string' ? JSON.parse(npc.skills) : npc.skills || [],
      languages: npc.languages || 'Common',
      height: npc.height || '',
      build: npc.build || '',
      hair_color: npc.hair_color || '',
      hair_style: npc.hair_style || '',
      eye_color: npc.eye_color || '',
      skin_tone: npc.skin_tone || '',
      facial_features: (() => {
        if (!npc.facial_features) return []
        if (Array.isArray(npc.facial_features)) return npc.facial_features
        try { return JSON.parse(npc.facial_features) } catch { return [] }
      })(),
      distinguishing_marks: npc.distinguishing_marks || '',
      facial_hair: npc.facial_hair || '',
      clothing_style: npc.clothing_style || '',
      accessories: npc.accessories || '',
      voice: npc.voice || '',
      personality_trait_1: npc.personality_trait_1 || '',
      personality_trait_2: npc.personality_trait_2 || '',
      mannerism: npc.mannerism || '',
      motivation: npc.motivation || '',
      fear: npc.fear || '',
      secret: npc.secret || '',
      quirk: npc.quirk || '',
      current_location: npc.current_location || '',
      typical_locations: npc.typical_locations || '',
      background_notes: npc.background_notes || '',
      relationship_to_party: npc.relationship_to_party || '',
      campaign_availability: npc.campaign_availability || 'available',
      avatar: npc.avatar || null,
      avatarPreview: npc.avatar || null
    })
    setSelectedNpc(npc)
    setShowForm(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      nickname: '',
      race: '',
      gender: '',
      age: '',
      occupation: '',
      occupation_category: '',
      stat_block: 'commoner',
      cr: '0',
      ac: 10,
      hp: 4,
      speed: '30 ft.',
      ability_scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      skills: [],
      languages: 'Common',
      height: '',
      build: '',
      hair_color: '',
      hair_style: '',
      eye_color: '',
      skin_tone: '',
      facial_features: [],
      distinguishing_marks: '',
      facial_hair: '',
      clothing_style: '',
      accessories: '',
      voice: '',
      personality_trait_1: '',
      personality_trait_2: '',
      mannerism: '',
      motivation: '',
      fear: '',
      secret: '',
      quirk: '',
      current_location: '',
      typical_locations: '',
      background_notes: '',
      relationship_to_party: '',
      campaign_availability: 'available',
      avatar: null,
      avatarPreview: null
    })
  }

  // Random generation helpers
  const randomFromArray = (arr) => arr[Math.floor(Math.random() * arr.length)]

  const generateRandomName = () => {
    const race = formData.race?.toLowerCase() || 'human'
    const gender = formData.gender?.toLowerCase() || randomFromArray(['male', 'female'])

    let raceKey = race
    if (race.includes('half-elf') || race.includes('half elf')) raceKey = 'half_elf'
    if (race.includes('half-orc') || race.includes('half orc')) raceKey = 'half_orc'

    const raceNames = npcNames[raceKey] || npcNames.human

    let firstName = ''
    let lastName = ''

    if (raceNames.names) {
      // Races like tabaxi or warforged with single name lists
      firstName = randomFromArray(raceNames.names)
    } else if (raceNames[gender]) {
      firstName = randomFromArray(raceNames[gender])
    } else if (raceNames.male) {
      firstName = randomFromArray(gender === 'female' ? (raceNames.female || raceNames.male) : raceNames.male)
    }

    if (raceNames.surnames) {
      lastName = randomFromArray(raceNames.surnames)
    } else if (raceNames.clan) {
      lastName = randomFromArray(raceNames.clan)
    }

    return lastName ? `${firstName} ${lastName}` : firstName
  }

  const applyStatBlock = (blockKey) => {
    const block = npcStatBlocks[blockKey]
    if (block) {
      setFormData(prev => ({
        ...prev,
        stat_block: blockKey,
        cr: block.cr,
        ac: block.ac,
        hp: block.hp,
        speed: block.speed,
        ability_scores: { ...block.abilities },
        skills: block.skills || [],
        languages: block.languages
      }))
    }
  }

  const randomizeAll = () => {
    const randomRace = randomFromArray(Object.keys(races))
    const randomGender = randomFromArray(['male', 'female'])
    const randomAge = randomFromArray(npcPhysical.ages)
    const randomCategory = randomFromArray(Object.keys(npcOccupations))
    const randomOccupation = randomFromArray(npcOccupations[randomCategory])
    const randomStatBlock = randomFromArray(Object.keys(npcStatBlocks))
    const block = npcStatBlocks[randomStatBlock]

    const newFormData = {
      race: races[randomRace]?.name || randomRace,
      gender: randomGender,
      age: randomAge.value,
      occupation: randomOccupation.name,
      occupation_category: randomCategory,
      stat_block: randomStatBlock,
      cr: block.cr,
      ac: block.ac,
      hp: block.hp,
      speed: block.speed,
      ability_scores: { ...block.abilities },
      skills: block.skills || [],
      languages: block.languages,
      height: randomFromArray(npcPhysical.heights).value,
      build: randomFromArray(npcPhysical.builds).value,
      hair_color: randomFromArray(npcPhysical.hairColors),
      hair_style: randomFromArray(npcPhysical.hairStyles),
      eye_color: randomFromArray(npcPhysical.eyeColors),
      skin_tone: randomFromArray(npcPhysical.skinTones),
      facial_features: (() => {
        // Select 1-3 random facial features
        const count = Math.floor(Math.random() * 3) + 1
        const shuffled = [...npcPhysical.facialFeatures].sort(() => Math.random() - 0.5)
        return shuffled.slice(0, count)
      })(),
      distinguishing_marks: Math.random() > 0.5 ? randomFromArray(npcPhysical.distinguishingMarks) : '',
      facial_hair: randomGender === 'male' ? randomFromArray(npcPhysical.facialHair) : '',
      clothing_style: randomFromArray(npcPhysical.clothingStyles),
      accessories: randomFromArray(npcPhysical.accessories),
      voice: randomFromArray(npcPhysical.voiceTypes),
      personality_trait_1: randomFromArray(npcPersonalities.traits).trait,
      personality_trait_2: randomFromArray(npcPersonalities.traits).trait,
      mannerism: randomFromArray(npcPersonalities.mannerisms),
      motivation: randomFromArray(npcPersonalities.motivations).motivation,
      fear: randomFromArray(npcPersonalities.fears),
      secret: Math.random() > 0.5 ? randomFromArray(npcPersonalities.secrets) : '',
      quirk: randomFromArray(npcPersonalities.quirks),
      typical_locations: randomOccupation.typicalLocations?.join(', ') || '',
      name: '',
      nickname: '',
      current_location: '',
      background_notes: '',
      relationship_to_party: ''
    }

    setFormData(newFormData)

    // Generate name after setting race and gender
    setTimeout(() => {
      const raceKey = newFormData.race.toLowerCase()
      let nameRaceKey = raceKey
      if (raceKey.includes('half-elf') || raceKey.includes('half elf')) nameRaceKey = 'half_elf'
      if (raceKey.includes('half-orc') || raceKey.includes('half orc')) nameRaceKey = 'half_orc'

      const raceNames = npcNames[nameRaceKey] || npcNames.human
      let firstName = ''
      let lastName = ''

      if (raceNames.names) {
        firstName = randomFromArray(raceNames.names)
      } else if (raceNames[newFormData.gender]) {
        firstName = randomFromArray(raceNames[newFormData.gender])
      } else if (raceNames.male) {
        firstName = randomFromArray(newFormData.gender === 'female' ? (raceNames.female || raceNames.male) : raceNames.male)
      }

      if (raceNames.surnames) {
        lastName = randomFromArray(raceNames.surnames)
      } else if (raceNames.clan) {
        lastName = randomFromArray(raceNames.clan)
      }

      setFormData(prev => ({
        ...prev,
        name: lastName ? `${firstName} ${lastName}` : firstName
      }))
    }, 0)
  }

  const getModifier = (score) => {
    const mod = Math.floor((score - 10) / 2)
    return mod >= 0 ? `+${mod}` : mod.toString()
  }

  // Helper to capitalize first letter of each word
  const capitalize = (str) => {
    if (!str) return str
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading NPCs...</div>
      </div>
    )
  }

  return (
    <div className="npc-generator">
      <div className="npc-header">
        <button className="button button-secondary" onClick={onBack}>
          ← Back
        </button>
        <h2>NPC Generator</h2>
        <button
          className="button"
          onClick={() => {
            setSelectedNpc(null)
            resetForm()
            setShowForm(true)
          }}
        >
          + Create NPC
        </button>
      </div>

      {showForm ? (
        <div className="npc-form-container">
          <form onSubmit={handleSubmit} className="npc-form">
            <div className="form-header">
              <h3>{selectedNpc ? 'Edit NPC' : 'Create New NPC'}</h3>
              <div className="form-actions">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={randomizeAll}
                >
                  🎲 Randomize All
                </button>
              </div>
            </div>

            {/* Basic Information */}
            <section className="form-section">
              <h4>Basic Information</h4>

              {/* Portrait Upload */}
              <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                <label>Portrait</label>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
                  {formData.avatarPreview ? (
                    <div style={{ position: 'relative' }}>
                      <img
                        src={formData.avatarPreview}
                        alt="NPC portrait"
                        style={{
                          width: '120px',
                          height: '120px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '2px solid rgba(255, 255, 255, 0.2)'
                        }}
                      />
                      <button
                        type="button"
                        onClick={removeAvatar}
                        style={{
                          position: 'absolute',
                          top: '-8px',
                          right: '-8px',
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          background: '#e74c3c',
                          border: 'none',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '8px',
                        border: '2px dashed rgba(255, 255, 255, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgba(255, 255, 255, 0.5)',
                        fontSize: '2rem'
                      }}
                    >
                      👤
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png"
                      onChange={handleAvatarUpload}
                      style={{ padding: '0.5rem', width: '100%' }}
                    />
                    <p style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '0.5rem' }}>
                      Upload a portrait image (JPEG or PNG)
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Name *</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={{ flex: 1 }}
                    />
                    <button
                      type="button"
                      className="button button-small"
                      onClick={() => setFormData({ ...formData, name: generateRandomName() })}
                    >
                      🎲
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Nickname/Title</label>
                  <input
                    type="text"
                    value={formData.nickname}
                    onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                    placeholder="e.g., 'The Butcher', 'Old'"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Race *</label>
                  <select
                    value={formData.race}
                    onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                    required
                  >
                    <option value="">Select race...</option>
                    {Object.entries(races).map(([key, race]) => (
                      <option key={key} value={race.name}>{race.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Age</label>
                  <select
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.ages.map(age => (
                      <option key={age.value} value={age.value}>{capitalize(age.value)} ({age.range})</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Occupation & Role */}
            <section className="form-section">
              <h4>Occupation & Role</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.occupation_category}
                    onChange={(e) => {
                      setFormData({ ...formData, occupation_category: e.target.value, occupation: '' })
                    }}
                  >
                    <option value="">Select category...</option>
                    {Object.keys(npcOccupations).map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Occupation</label>
                  <select
                    value={formData.occupation}
                    onChange={(e) => {
                      const occ = npcOccupations[formData.occupation_category]?.find(o => o.name === e.target.value)
                      setFormData({
                        ...formData,
                        occupation: e.target.value,
                        typical_locations: occ?.typicalLocations?.join(', ') || formData.typical_locations
                      })
                    }}
                    disabled={!formData.occupation_category}
                  >
                    <option value="">Select occupation...</option>
                    {formData.occupation_category && npcOccupations[formData.occupation_category]?.map(occ => (
                      <option key={occ.name} value={occ.name}>{occ.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Relationship to Party</label>
                <select
                  value={formData.relationship_to_party}
                  onChange={(e) => setFormData({ ...formData, relationship_to_party: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="ally">Ally</option>
                  <option value="enemy">Enemy</option>
                  <option value="neutral">Neutral</option>
                  <option value="quest_giver">Quest Giver</option>
                  <option value="merchant">Merchant</option>
                  <option value="informant">Informant</option>
                  <option value="rival">Rival</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
              <div className="form-group">
                <label>Campaign Availability</label>
                <select
                  value={formData.campaign_availability}
                  onChange={(e) => setFormData({ ...formData, campaign_availability: e.target.value })}
                >
                  <option value="available">Available - Can appear in campaigns</option>
                  <option value="companion">Companion - Offer as travel companion</option>
                  <option value="mention_only">Mention Only - Referenced but doesn't appear</option>
                  <option value="hidden">Hidden - Don't include in campaigns</option>
                </select>
                <small style={{ color: '#888', marginTop: '0.25rem', display: 'block' }}>
                  Controls how this NPC can appear in AI DM sessions
                </small>
              </div>
            </section>

            {/* Stats */}
            <section className="form-section">
              <h4>Combat Statistics</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Stat Block Template</label>
                  <select
                    value={formData.stat_block}
                    onChange={(e) => applyStatBlock(e.target.value)}
                  >
                    {Object.entries(npcStatBlocks).map(([key, block]) => (
                      <option key={key} value={key}>{block.name} (CR {block.cr})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row stats-row">
                <div className="form-group small">
                  <label>CR</label>
                  <input
                    type="text"
                    value={formData.cr}
                    onChange={(e) => setFormData({ ...formData, cr: e.target.value })}
                  />
                </div>
                <div className="form-group small">
                  <label>AC</label>
                  <input
                    type="number"
                    value={formData.ac}
                    onChange={(e) => setFormData({ ...formData, ac: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group small">
                  <label>HP</label>
                  <input
                    type="number"
                    value={formData.hp}
                    onChange={(e) => setFormData({ ...formData, hp: parseInt(e.target.value) })}
                  />
                </div>
                <div className="form-group small">
                  <label>Speed</label>
                  <input
                    type="text"
                    value={formData.speed}
                    onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                  />
                </div>
              </div>

              <div className="ability-scores-grid">
                {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
                  <div key={ability} className="ability-score">
                    <label>{ability.toUpperCase()}</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={formData.ability_scores[ability]}
                      onChange={(e) => setFormData({
                        ...formData,
                        ability_scores: { ...formData.ability_scores, [ability]: parseInt(e.target.value) }
                      })}
                    />
                    <span className="modifier">({getModifier(formData.ability_scores[ability])})</span>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Languages</label>
                <input
                  type="text"
                  value={formData.languages}
                  onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                  placeholder="Common, Elvish, etc."
                />
              </div>
            </section>

            {/* Physical Description */}
            <section className="form-section">
              <h4>Physical Description</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Height</label>
                  <select
                    value={formData.height}
                    onChange={(e) => setFormData({ ...formData, height: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.heights.map(h => (
                      <option key={h.value} value={h.value}>{capitalize(h.value)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Build</label>
                  <select
                    value={formData.build}
                    onChange={(e) => setFormData({ ...formData, build: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.builds.map(b => (
                      <option key={b.value} value={b.value}>{capitalize(b.value)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Hair Color</label>
                  <select
                    value={formData.hair_color}
                    onChange={(e) => setFormData({ ...formData, hair_color: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.hairColors.map(c => (
                      <option key={c} value={c}>{capitalize(c)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Hair Style</label>
                  <select
                    value={formData.hair_style}
                    onChange={(e) => setFormData({ ...formData, hair_style: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.hairStyles.map(s => (
                      <option key={s} value={s}>{capitalize(s)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Eye Color</label>
                  <select
                    value={formData.eye_color}
                    onChange={(e) => setFormData({ ...formData, eye_color: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.eyeColors.map(c => (
                      <option key={c} value={c}>{capitalize(c)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Skin Tone</label>
                  <select
                    value={formData.skin_tone}
                    onChange={(e) => setFormData({ ...formData, skin_tone: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.skinTones.map(t => (
                      <option key={t} value={t}>{capitalize(t)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Facial Features (select multiple)</label>
                <div className="checkbox-grid">
                  {npcPhysical.facialFeatures.map(f => (
                    <label key={f} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.facial_features.includes(f)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, facial_features: [...formData.facial_features, f] })
                          } else {
                            setFormData({ ...formData, facial_features: formData.facial_features.filter(feat => feat !== f) })
                          }
                        }}
                      />
                      {capitalize(f)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Facial Hair</label>
                  <select
                    value={formData.facial_hair}
                    onChange={(e) => setFormData({ ...formData, facial_hair: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.facialHair.map(f => (
                      <option key={f} value={f}>{capitalize(f)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Distinguishing Mark</label>
                  <select
                    value={formData.distinguishing_marks}
                    onChange={(e) => setFormData({ ...formData, distinguishing_marks: e.target.value })}
                  >
                    <option value="">None</option>
                    {npcPhysical.distinguishingMarks.map(m => (
                      <option key={m} value={m}>{capitalize(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Voice</label>
                  <select
                    value={formData.voice}
                    onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.voiceTypes.map(v => (
                      <option key={v} value={v}>{capitalize(v)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Clothing Style</label>
                  <select
                    value={formData.clothing_style}
                    onChange={(e) => setFormData({ ...formData, clothing_style: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPhysical.clothingStyles.map(s => (
                      <option key={s} value={s}>{capitalize(s)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Accessories</label>
                  <select
                    value={formData.accessories}
                    onChange={(e) => setFormData({ ...formData, accessories: e.target.value })}
                  >
                    <option value="">None</option>
                    {npcPhysical.accessories.map(a => (
                      <option key={a} value={a}>{capitalize(a)}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Personality */}
            <section className="form-section">
              <h4>Personality</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Primary Trait</label>
                  <select
                    value={formData.personality_trait_1}
                    onChange={(e) => setFormData({ ...formData, personality_trait_1: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.traits.map(t => (
                      <option key={t.trait} value={t.trait}>{capitalize(t.trait)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Secondary Trait</label>
                  <select
                    value={formData.personality_trait_2}
                    onChange={(e) => setFormData({ ...formData, personality_trait_2: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.traits.map(t => (
                      <option key={t.trait} value={t.trait}>{capitalize(t.trait)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Mannerism</label>
                  <select
                    value={formData.mannerism}
                    onChange={(e) => setFormData({ ...formData, mannerism: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.mannerisms.map(m => (
                      <option key={m} value={m}>{capitalize(m)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Quirk</label>
                  <select
                    value={formData.quirk}
                    onChange={(e) => setFormData({ ...formData, quirk: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.quirks.map(q => (
                      <option key={q} value={q}>{capitalize(q)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Motivation</label>
                  <select
                    value={formData.motivation}
                    onChange={(e) => setFormData({ ...formData, motivation: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.motivations.map(m => (
                      <option key={m.motivation} value={m.motivation}>{capitalize(m.motivation)}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Fear</label>
                  <select
                    value={formData.fear}
                    onChange={(e) => setFormData({ ...formData, fear: e.target.value })}
                  >
                    <option value="">Select...</option>
                    {npcPersonalities.fears.map(f => (
                      <option key={f} value={f}>{capitalize(f)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Secret</label>
                <select
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                >
                  <option value="">None</option>
                  {npcPersonalities.secrets.map(s => (
                    <option key={s} value={s}>{capitalize(s)}</option>
                  ))}
                </select>
              </div>
            </section>

            {/* Location & Notes */}
            <section className="form-section">
              <h4>Location & Notes</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Current Location</label>
                  <input
                    type="text"
                    value={formData.current_location}
                    onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
                    placeholder="Where can they be found now?"
                  />
                </div>
                <div className="form-group">
                  <label>Typical Locations</label>
                  <input
                    type="text"
                    value={formData.typical_locations}
                    onChange={(e) => setFormData({ ...formData, typical_locations: e.target.value })}
                    placeholder="Where do they usually hang out?"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Background Notes</label>
                <textarea
                  value={formData.background_notes}
                  onChange={(e) => setFormData({ ...formData, background_notes: e.target.value })}
                  placeholder="Any additional information about this NPC..."
                  rows="4"
                />
              </div>
            </section>

            <div className="form-buttons">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => {
                  setShowForm(false)
                  setSelectedNpc(null)
                  resetForm()
                }}
              >
                Cancel
              </button>
              <button type="submit" className="button" disabled={saving}>
                {saving ? 'Saving...' : (selectedNpc ? 'Update NPC' : 'Create NPC')}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="npc-list">
          {npcs.length === 0 ? (
            <div className="empty-state">
              <p>No NPCs created yet. Click "Create NPC" to get started!</p>
            </div>
          ) : (
            npcs.map(npc => (
              <div key={npc.id} className="npc-card" onClick={() => setSelectedNpc(selectedNpc?.id === npc.id ? null : npc)}>
                <div className="npc-card-header">
                  {npc.avatar ? (
                    <img
                      src={npc.avatar}
                      alt={npc.name}
                      className="npc-avatar"
                      style={{
                        width: '60px',
                        height: '60px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        marginRight: '1rem',
                        flexShrink: 0
                      }}
                    />
                  ) : (
                    <div
                      className="npc-avatar-placeholder"
                      style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '8px',
                        marginRight: '1rem',
                        flexShrink: 0,
                        background: 'rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '1.5rem',
                        color: 'rgba(255, 255, 255, 0.4)'
                      }}
                    >
                      👤
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <h3>{npc.nickname ? `${npc.nickname} ` : ''}{npc.name}</h3>
                    <p className="npc-subtitle">
                      {npc.age && `${npc.age} `}
                      {npc.gender && `${npc.gender} `}
                      {npc.race}
                      {npc.occupation && ` • ${npc.occupation}`}
                    </p>
                  </div>
                  <div className="npc-card-actions">
                    <button
                      className="button button-small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEdit(npc)
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="button button-small button-danger"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(npc.id)
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {selectedNpc?.id === npc.id && (
                  <div className="npc-card-details">
                    {/* Stats */}
                    <div className="npc-stats">
                      <div className="stat-item">
                        <span className="stat-label">CR</span>
                        <span className="stat-value">{npc.cr || '0'}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">AC</span>
                        <span className="stat-value">{npc.ac || 10}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">HP</span>
                        <span className="stat-value">{npc.hp || 4}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-label">Speed</span>
                        <span className="stat-value">{npc.speed || '30 ft.'}</span>
                      </div>
                    </div>

                    {/* Ability Scores */}
                    {(() => {
                      try {
                        const abilities = typeof npc.ability_scores === 'string'
                          ? JSON.parse(npc.ability_scores)
                          : npc.ability_scores
                        if (!abilities) return null
                        return (
                          <div className="npc-abilities">
                            {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ab => (
                              <div key={ab} className="ability-item">
                                <span className="ability-label">{ab.toUpperCase()}</span>
                                <span className="ability-value">
                                  {abilities[ab]} ({getModifier(abilities[ab])})
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      } catch { return null }
                    })()}

                    {/* Physical Description */}
                    <div className="npc-description">
                      <h4>Appearance</h4>
                      <p>
                        {[
                          npc.height && `${npc.height}`,
                          npc.build && `${npc.build} build`,
                          npc.skin_tone && `${npc.skin_tone} skin`,
                          npc.hair_color && npc.hair_style && `${npc.hair_color} hair worn ${npc.hair_style}`,
                          npc.eye_color && `${npc.eye_color} eyes`,
                          (() => {
                            if (!npc.facial_features) return null
                            try {
                              const features = typeof npc.facial_features === 'string'
                                ? JSON.parse(npc.facial_features)
                                : npc.facial_features
                              return Array.isArray(features) && features.length > 0 ? features.join(', ') : null
                            } catch { return npc.facial_features }
                          })(),
                          npc.facial_hair && npc.facial_hair !== 'clean-shaven' && npc.facial_hair,
                          npc.distinguishing_marks && `Notable: ${npc.distinguishing_marks}`
                        ].filter(Boolean).join('. ') || 'No description available.'}
                      </p>
                      {npc.clothing_style && <p><strong>Clothing:</strong> {npc.clothing_style}</p>}
                      {npc.accessories && <p><strong>Accessories:</strong> {npc.accessories}</p>}
                      {npc.voice && <p><strong>Voice:</strong> {npc.voice}</p>}
                    </div>

                    {/* Personality */}
                    <div className="npc-personality">
                      <h4>Personality</h4>
                      {(npc.personality_trait_1 || npc.personality_trait_2) && (
                        <p><strong>Traits:</strong> {[npc.personality_trait_1, npc.personality_trait_2].filter(Boolean).join(', ')}</p>
                      )}
                      {npc.mannerism && <p><strong>Mannerism:</strong> {npc.mannerism}</p>}
                      {npc.quirk && <p><strong>Quirk:</strong> {npc.quirk}</p>}
                      {npc.motivation && <p><strong>Motivation:</strong> {npc.motivation}</p>}
                      {npc.fear && <p><strong>Fear:</strong> {npc.fear}</p>}
                      {npc.secret && <p><strong>Secret:</strong> <em>{npc.secret}</em></p>}
                    </div>

                    {/* Location */}
                    {(npc.current_location || npc.typical_locations) && (
                      <div className="npc-location">
                        <h4>Location</h4>
                        {npc.current_location && <p><strong>Current:</strong> {npc.current_location}</p>}
                        {npc.typical_locations && <p><strong>Usually found:</strong> {npc.typical_locations}</p>}
                      </div>
                    )}

                    {/* Relationship & Campaign Status */}
                    <div className="npc-status-badges">
                      {npc.relationship_to_party && (
                        <span className={`relationship-badge ${npc.relationship_to_party}`}>
                          {npc.relationship_to_party.replace('_', ' ')}
                        </span>
                      )}
                      <span className={`campaign-badge ${npc.campaign_availability || 'available'}`}>
                        {npc.campaign_availability === 'companion' && '🤝 Companion'}
                        {npc.campaign_availability === 'mention_only' && '💬 Mention Only'}
                        {npc.campaign_availability === 'hidden' && '🚫 Hidden'}
                        {(!npc.campaign_availability || npc.campaign_availability === 'available') && '✓ Available'}
                      </span>
                    </div>

                    {/* Notes */}
                    {npc.background_notes && (
                      <div className="npc-notes">
                        <h4>Notes</h4>
                        <p>{npc.background_notes}</p>
                      </div>
                    )}

                    {npc.languages && (
                      <p className="npc-languages"><strong>Languages:</strong> {npc.languages}</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default NPCGenerator
