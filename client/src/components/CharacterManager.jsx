import { useState, useEffect } from 'react'
import CharacterCreationWizard from './CharacterCreationWizard'
import LevelUpModal from './LevelUpModal'
import classesData from '../data/classes.json'

function CharacterManager({ characters, selectedCharacter, onSelectCharacter, onCharacterCreated, onCharacterUpdated, onCreationFormChange, editCharacterInWizard, onClearEditCharacter }) {
  const [showForm, setShowForm] = useState(false)
  const [resting, setResting] = useState(false)
  const [showLevelUpModal, setShowLevelUpModal] = useState(false)
  const [levelUpCharacter, setLevelUpCharacter] = useState(null)
  const [canLevelUpStatus, setCanLevelUpStatus] = useState({})

  // Open wizard when edit character is passed in
  useEffect(() => {
    if (editCharacterInWizard) {
      handleShowForm(true)
    }
  }, [editCharacterInWizard])

  // Helper to capitalize words properly
  const capitalize = (str) => {
    if (!str) return str
    return str.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
  }

  // Notify parent when form visibility changes
  const handleShowForm = (show) => {
    setShowForm(show)
    if (onCreationFormChange) {
      onCreationFormChange(show)
    }
  }

  // Check level-up status for all characters
  useEffect(() => {
    const checkLevelUpStatus = async () => {
      const statusMap = {}
      for (const char of characters) {
        try {
          const response = await fetch(`/api/character/can-level-up/${char.id}`)
          if (response.ok) {
            const data = await response.json()
            statusMap[char.id] = data.canLevelUp
          }
        } catch (error) {
          console.error('Error checking level-up status:', error)
        }
      }
      setCanLevelUpStatus(statusMap)
    }

    if (characters.length > 0) {
      checkLevelUpStatus()
    }
  }, [characters])

  const handleLevelUp = (char) => {
    setLevelUpCharacter(char)
    setShowLevelUpModal(true)
  }

  const handleLevelUpComplete = (updatedCharacter, summary) => {
    setShowLevelUpModal(false)
    setLevelUpCharacter(null)
    onCharacterUpdated(updatedCharacter)
    // Update the level-up status
    setCanLevelUpStatus(prev => ({
      ...prev,
      [updatedCharacter.id]: false
    }))
    // Show celebration message
    alert(`${updatedCharacter.name} is now level ${summary.newLevel}!\n\nHP gained: +${summary.hpGained}\nNew Max HP: ${summary.newMaxHp}${summary.newFeatures.length > 0 ? `\n\nNew Features:\n- ${summary.newFeatures.join('\n- ')}` : ''}`)
  }
  const [formData, setFormData] = useState({
    name: '',
    class: '',
    race: '',
    level: 1,
    current_hp: 10,
    max_hp: 10,
    current_location: '',
    current_quest: '',
    experience: 0,
    experience_to_next_level: 300,
    gold_cp: 0,
    gold_sp: 0,
    gold_gp: 0,
    armor_class: 10,
    speed: 30,
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    skills: '',
    advantages: '',
    inventory: ''
  })

  const handleRest = async (charId) => {
    setResting(true)
    try {
      const response = await fetch(`/api/character/rest/${charId}`, {
        method: 'POST'
      })

      if (response.ok) {
        const data = await response.json()
        onCharacterUpdated(data.character)
        alert(`Rested and restored ${data.hp_restored} HP!`)
      }
    } catch (error) {
      console.error('Error resting:', error)
      alert('Failed to rest')
    } finally {
      setResting(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Convert ability scores to JSON
    const ability_scores = JSON.stringify({
      str: formData.str,
      dex: formData.dex,
      con: formData.con,
      int: formData.int,
      wis: formData.wis,
      cha: formData.cha
    })

    // Convert comma-separated lists to JSON arrays
    const skills = JSON.stringify(formData.skills.split(',').map(s => s.trim()).filter(s => s))
    const advantages = JSON.stringify(formData.advantages.split(',').map(a => a.trim()).filter(a => a))
    const inventory = JSON.stringify(formData.inventory.split(',').map(i => i.trim()).filter(i => i))

    const dataToSubmit = {
      ...formData,
      ability_scores,
      skills,
      advantages,
      inventory
    }

    // Remove individual ability score fields
    delete dataToSubmit.str
    delete dataToSubmit.dex
    delete dataToSubmit.con
    delete dataToSubmit.int
    delete dataToSubmit.wis
    delete dataToSubmit.cha

    try {
      const response = await fetch('/api/character', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSubmit)
      })

      const character = await response.json()
      onCharacterCreated(character)
      setShowForm(false)
      resetForm()
    } catch (error) {
      console.error('Error creating character:', error)
    }
  }

  const resetForm = () => {
    setFormData({
      name: '',
      class: '',
      race: '',
      level: 1,
      current_hp: 10,
      max_hp: 10,
      current_location: '',
      current_quest: '',
      experience: 0,
      experience_to_next_level: 300,
      gold_cp: 0,
      gold_sp: 0,
      gold_gp: 0,
      armor_class: 10,
      speed: 30,
      str: 10,
      dex: 10,
      con: 10,
      int: 10,
      wis: 10,
      cha: 10,
      skills: '',
      advantages: '',
      inventory: ''
    })
  }


  return (
    <div className="container">
      {/* Level Up Modal */}
      {showLevelUpModal && levelUpCharacter && (
        <LevelUpModal
          character={levelUpCharacter}
          onLevelUp={handleLevelUpComplete}
          onClose={() => {
            setShowLevelUpModal(false)
            setLevelUpCharacter(null)
          }}
        />
      )}

      {showForm ? (
        <CharacterCreationWizard
          editCharacter={editCharacterInWizard}
          onCharacterCreated={(char) => {
            if (editCharacterInWizard) {
              onCharacterUpdated(char)
              onClearEditCharacter && onClearEditCharacter()
            } else {
              onCharacterCreated(char)
            }
            handleShowForm(false)
          }}
          onCancel={() => {
            handleShowForm(false)
            onClearEditCharacter && onClearEditCharacter()
          }}
        />
      ) : (
        <>
          <h2>Characters</h2>

          {characters.length === 0 ? (
            <p style={{ color: '#bbb', marginBottom: '1rem' }}>No characters yet. Create one to get started!</p>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              {characters.map(char => (
            <div
              key={char.id}
              className={`character-card ${selectedCharacter?.id === char.id ? 'selected' : ''}`}
              onClick={() => onSelectCharacter(char)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                {char.avatar && (
                  <img
                    src={char.avatar}
                    alt={`${char.name} avatar`}
                    style={{
                      width: '60px',
                      height: '60px',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      border: '2px solid #3498db'
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0 }}>
                    {char.nickname || char.name}
                  </h3>
                  {char.nickname && (
                    <p style={{ margin: '0.1rem 0 0 0', fontSize: '0.85rem', color: '#888' }}>
                      {char.name}
                    </p>
                  )}
                  <p style={{ margin: '0.25rem 0 0 0' }}>Level {char.level} {capitalize(char.race)} {capitalize(char.class)}</p>
                </div>
              </div>

              {/* Primary Stats */}
              <div className="stat-grid" style={{ marginBottom: '0.75rem' }}>
                <div className="stat">
                  <div className="stat-label">HP</div>
                  <div className="stat-value" style={{ color: char.current_hp <= char.max_hp * 0.3 ? '#e74c3c' : '#2ecc71' }}>
                    {char.current_hp}/{char.max_hp}
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">AC</div>
                  <div className="stat-value">{char.armor_class}</div>
                </div>
                <div className="stat">
                  <div className="stat-label">Speed</div>
                  <div className="stat-value">{char.speed} ft</div>
                </div>
              </div>

              {/* Secondary Stats */}
              <div className="stat-grid" style={{ marginBottom: '0.75rem' }}>
                <div className="stat">
                  <div className="stat-label">XP</div>
                  <div className="stat-value">
                    {char.experience}/{char.experience_to_next_level}
                    <div style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                      ({Math.floor((char.experience / char.experience_to_next_level) * 100)}%)
                    </div>
                  </div>
                </div>
                <div className="stat">
                  <div className="stat-label">Gold</div>
                  <div className="stat-value">
                    {char.gold_gp > 0 && `${char.gold_gp}g `}
                    {char.gold_sp > 0 && `${char.gold_sp}s `}
                    {char.gold_cp > 0 && `${char.gold_cp}c`}
                    {char.gold_gp === 0 && char.gold_sp === 0 && char.gold_cp === 0 && '0c'}
                  </div>
                </div>
              </div>

              {/* Ability Scores */}
              {(() => {
                try {
                  const abilities = JSON.parse(char.ability_scores || '{}')
                  const getModifier = (score) => {
                    const mod = Math.floor((score - 10) / 2)
                    return mod >= 0 ? `+${mod}` : mod.toString()
                  }
                  return (
                    <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '4px' }}>
                      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: '0.25rem' }}>Ability Scores</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.25rem', fontSize: '0.75rem' }}>
                        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map(ability => (
                          <div key={ability} style={{ textAlign: 'center' }}>
                            <div style={{ color: '#888', textTransform: 'uppercase' }}>{ability}</div>
                            <div style={{ fontWeight: 'bold' }}>{abilities[ability]} <span style={{ color: '#3498db' }}>({getModifier(abilities[ability])})</span></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                } catch {
                  return null
                }
              })()}

              {/* Skills */}
              {(() => {
                try {
                  const skills = JSON.parse(char.skills || '[]')
                  if (skills.length > 0) {
                    return (
                      <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: '#bbb' }}>
                        <span style={{ color: '#888' }}>Skills:</span> {skills.join(', ')}
                      </div>
                    )
                  }
                } catch {}
                return null
              })()}

              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: '#bbb' }}>
                <div><span style={{ color: '#888' }}>Location:</span> {char.current_location || 'Unknown'}</div>
                {char.current_quest && <div><span style={{ color: '#888' }}>Quest:</span> {char.current_quest}</div>}
                {char.background && <div><span style={{ color: '#888' }}>Background:</span> {capitalize(char.background)}</div>}
                {char.alignment && <div><span style={{ color: '#888' }}>Alignment:</span> {char.alignment}</div>}
                {char.faith && <div><span style={{ color: '#888' }}>Faith:</span> {char.faith}</div>}
                {char.lifestyle && <div><span style={{ color: '#888' }}>Lifestyle:</span> {capitalize(char.lifestyle)}</div>}
                {char.gender && <div><span style={{ color: '#888' }}>Gender:</span> {capitalize(char.gender)}</div>}
              </div>

              {/* Subclass Features */}
              {char.subclass && char.class && (() => {
                const classKey = char.class.toLowerCase()
                const classData = classesData[classKey]
                if (!classData || !classData.subclasses) return null

                const subclassData = classData.subclasses.find(sc => sc.name === char.subclass)
                if (!subclassData || !subclassData.featuresByLevel) return null

                // Get features up to current level
                const activeFeatures = []
                Object.entries(subclassData.featuresByLevel)
                  .filter(([level]) => parseInt(level) <= char.level)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .forEach(([level, features]) => {
                    features.forEach(feature => {
                      activeFeatures.push({ ...feature, level: parseInt(level) })
                    })
                  })

                if (activeFeatures.length === 0) return null

                // Get spell list
                const spellListKey = subclassData.domainSpells ? 'domainSpells' :
                                    subclassData.oathSpells ? 'oathSpells' :
                                    subclassData.expandedSpells ? 'expandedSpells' :
                                    subclassData.circleSpells ? 'circleSpells' :
                                    subclassData.subclassSpells ? 'subclassSpells' :
                                    subclassData.originSpells ? 'originSpells' : null
                const spellList = spellListKey ? subclassData[spellListKey] : null
                const activeSpells = spellList ? Object.entries(spellList)
                  .filter(([level]) => parseInt(level) <= char.level)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b)) : []

                return (
                  <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    background: 'rgba(155, 89, 182, 0.1)',
                    borderRadius: '6px',
                    border: '1px solid rgba(155, 89, 182, 0.2)'
                  }}>
                    <div style={{ fontSize: '0.8rem', color: '#9b59b6', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                      {char.subclass} Features
                    </div>

                    {/* Bonus Proficiencies */}
                    {subclassData.bonusProficiencies && subclassData.bonusProficiencies.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#bbb', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#888' }}>Proficiencies:</span> {subclassData.bonusProficiencies.join(', ')}
                      </div>
                    )}

                    {/* Active Spells */}
                    {activeSpells.length > 0 && (
                      <div style={{ fontSize: '0.75rem', color: '#bbb', marginBottom: '0.5rem' }}>
                        <span style={{ color: '#888' }}>Subclass Spells:</span>
                        <div style={{ marginLeft: '0.5rem', marginTop: '0.25rem' }}>
                          {activeSpells.map(([level, spells]) => (
                            <div key={level}>
                              <span style={{ color: '#9b59b6' }}>Lv{level}:</span> {spells.join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Active Features */}
                    <div style={{ fontSize: '0.75rem' }}>
                      <span style={{ color: '#888' }}>Active Features:</span>
                      <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'disc' }}>
                        {activeFeatures.map((feature, idx) => (
                          <li key={idx} style={{ color: '#bbb', marginBottom: '0.25rem' }}>
                            <span style={{ color: '#ccc', fontWeight: 'bold' }}>{feature.name}</span>
                            <span style={{ color: '#666' }}> (Lv{feature.level})</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )
              })()}

              {/* Inventory */}
              {(() => {
                try {
                  const inventory = JSON.parse(char.inventory || '[]')
                  const equipment = JSON.parse(char.equipment || '[]')
                  const items = inventory.length > 0 ? inventory : equipment.map(e => typeof e === 'string' ? { name: e, quantity: 1 } : e)

                  return (
                    <details style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      background: 'rgba(241, 196, 15, 0.1)',
                      borderRadius: '6px',
                      border: '1px solid rgba(241, 196, 15, 0.2)'
                    }}>
                      <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: '#f1c40f', fontWeight: 'bold' }}>
                        Inventory ({items.length} items)
                      </summary>
                      <div style={{ marginTop: '0.5rem' }}>
                        {items.length === 0 ? (
                          <p style={{ fontSize: '0.75rem', color: '#888', margin: 0 }}>No items in inventory</p>
                        ) : (
                          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '0.75rem' }}>
                            {items.map((item, idx) => (
                              <li key={idx} style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                color: '#bbb',
                                padding: '0.25rem 0',
                                borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none'
                              }}>
                                <span>
                                  • {typeof item === 'string' ? item : item.name}
                                  {item.quantity && item.quantity > 1 && ` (×${item.quantity})`}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const newItems = items.filter((_, i) => i !== idx)
                                    fetch(`/api/character/${char.id}`, {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ inventory: JSON.stringify(newItems) })
                                    })
                                      .then(res => res.json())
                                      .then(updated => onCharacterUpdated(updated))
                                      .catch(err => console.error('Error removing item:', err))
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#e74c3c',
                                    cursor: 'pointer',
                                    fontSize: '0.7rem',
                                    padding: '0.1rem 0.25rem'
                                  }}
                                  title="Remove item"
                                >
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.25rem' }}>
                          <input
                            type="text"
                            placeholder="Add item..."
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                const newItems = [...items, { name: e.target.value.trim(), quantity: 1 }]
                                fetch(`/api/character/${char.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ inventory: JSON.stringify(newItems) })
                                })
                                  .then(res => res.json())
                                  .then(updated => onCharacterUpdated(updated))
                                  .catch(err => console.error('Error adding item:', err))
                                e.target.value = ''
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              background: 'rgba(255,255,255,0.1)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '4px',
                              color: '#fff'
                            }}
                          />
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const input = e.target.previousElementSibling
                              if (input.value.trim()) {
                                const newItems = [...items, { name: input.value.trim(), quantity: 1 }]
                                fetch(`/api/character/${char.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ inventory: JSON.stringify(newItems) })
                                })
                                  .then(res => res.json())
                                  .then(updated => onCharacterUpdated(updated))
                                  .catch(err => console.error('Error adding item:', err))
                                input.value = ''
                              }
                            }}
                            style={{
                              background: '#2ecc71',
                              border: 'none',
                              color: 'white',
                              borderRadius: '4px',
                              padding: '0.25rem 0.5rem',
                              cursor: 'pointer',
                              fontSize: '0.7rem'
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </details>
                  )
                } catch (e) {
                  console.error('Error parsing inventory:', e)
                  return null
                }
              })()}

              {/* Level Up Banner */}
              {canLevelUpStatus[char.id] && (
                <div className="level-up-banner">
                  <p style={{ color: '#f1c40f', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Ready to Level Up!
                  </p>
                  <button
                    className="button level-up-button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleLevelUp(char)
                    }}
                    style={{
                      width: '100%',
                      fontSize: '1rem',
                      padding: '0.75rem'
                    }}
                  >
                    Level Up to {char.level + 1}!
                  </button>
                </div>
              )}

              {char.current_hp < char.max_hp && (
                <button
                  className="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRest(char.id)
                  }}
                  disabled={resting}
                  style={{
                    marginTop: '0.5rem',
                    width: '100%',
                    background: char.current_hp <= char.max_hp * 0.3 ? '#e74c3c' : '#2ecc71',
                    fontSize: '0.85rem',
                    padding: '0.5rem'
                  }}
                >
                  {resting ? 'Resting...' : `🛌 Rest (+${Math.floor((char.max_hp - char.current_hp) * 0.5)} HP)`}
                </button>
              )}
            </div>
              ))}
            </div>
          )}

          <button className="button" onClick={() => {
            onSelectCharacter(null)
            handleShowForm(true)
          }}>
            Create New Character
          </button>

          {false && (
        <form onSubmit={handleSubmit} style={{ maxHeight: '600px', overflowY: 'auto', paddingRight: '1rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Basic Information</h3>

          <div className="grid-2">
            <div className="form-group">
              <label>Character Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="form-group">
              <label>Race *</label>
              <input
                type="text"
                value={formData.race}
                onChange={(e) => setFormData({ ...formData, race: e.target.value })}
                placeholder="e.g., Human, Elf, Dwarf"
                required
              />
            </div>
          </div>

          <div className="grid-2">
            <div className="form-group">
              <label>Class *</label>
              <input
                type="text"
                value={formData.class}
                onChange={(e) => setFormData({ ...formData, class: e.target.value })}
                placeholder="e.g., Fighter, Wizard, Rogue"
                required
              />
            </div>

            <div className="form-group">
              <label>Level *</label>
              <input
                type="number"
                min="1"
                max="20"
                value={formData.level}
                onChange={(e) => setFormData({ ...formData, level: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Hit Points & Defense</h3>

          <div className="grid-2">
            <div className="form-group">
              <label>Max HP *</label>
              <input
                type="number"
                min="1"
                value={formData.max_hp}
                onChange={(e) => {
                  const hp = parseInt(e.target.value)
                  setFormData({ ...formData, max_hp: hp, current_hp: hp })
                }}
                required
              />
            </div>

            <div className="form-group">
              <label>Armor Class *</label>
              <input
                type="number"
                min="1"
                value={formData.armor_class}
                onChange={(e) => setFormData({ ...formData, armor_class: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Speed (ft) *</label>
            <input
              type="number"
              min="0"
              value={formData.speed}
              onChange={(e) => setFormData({ ...formData, speed: parseInt(e.target.value) })}
              required
            />
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Ability Scores</h3>

          <div className="stat-grid">
            <div className="form-group">
              <label>STR</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.str}
                onChange={(e) => setFormData({ ...formData, str: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>DEX</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.dex}
                onChange={(e) => setFormData({ ...formData, dex: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>CON</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.con}
                onChange={(e) => setFormData({ ...formData, con: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>INT</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.int}
                onChange={(e) => setFormData({ ...formData, int: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>WIS</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.wis}
                onChange={(e) => setFormData({ ...formData, wis: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>CHA</label>
              <input
                type="number"
                min="1"
                max="30"
                value={formData.cha}
                onChange={(e) => setFormData({ ...formData, cha: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Experience & Wealth</h3>

          <div className="grid-2">
            <div className="form-group">
              <label>Current XP</label>
              <input
                type="number"
                min="0"
                value={formData.experience}
                onChange={(e) => setFormData({ ...formData, experience: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>XP to Next Level *</label>
              <input
                type="number"
                min="1"
                value={formData.experience_to_next_level}
                onChange={(e) => setFormData({ ...formData, experience_to_next_level: parseInt(e.target.value) })}
                required
              />
            </div>
          </div>

          <div className="stat-grid">
            <div className="form-group">
              <label>Gold (gp)</label>
              <input
                type="number"
                min="0"
                value={formData.gold_gp}
                onChange={(e) => setFormData({ ...formData, gold_gp: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>Silver (sp)</label>
              <input
                type="number"
                min="0"
                value={formData.gold_sp}
                onChange={(e) => setFormData({ ...formData, gold_sp: parseInt(e.target.value) })}
              />
            </div>

            <div className="form-group">
              <label>Copper (cp)</label>
              <input
                type="number"
                min="0"
                value={formData.gold_cp}
                onChange={(e) => setFormData({ ...formData, gold_cp: parseInt(e.target.value) })}
              />
            </div>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Inventory</h3>

          <div className="form-group">
            <label>Equipment & Items</label>
            <div style={{ background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '1rem' }}>
              {(() => {
                try {
                  const items = JSON.parse(formData.inventory || '[]')
                  return (
                    <>
                      {items.length === 0 ? (
                        <p style={{ color: '#888', fontSize: '0.85rem', margin: 0 }}>No items in inventory</p>
                      ) : (
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                          {items.map((item, idx) => (
                            <li key={idx} style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '0.5rem',
                              borderBottom: idx < items.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none'
                            }}>
                              <span style={{ color: '#bbb' }}>
                                {typeof item === 'string' ? item : item.name}
                                {item.quantity && item.quantity > 1 && <span style={{ color: '#888' }}> (×{item.quantity})</span>}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const newItems = items.filter((_, i) => i !== idx)
                                  setFormData({ ...formData, inventory: JSON.stringify(newItems) })
                                }}
                                style={{
                                  background: 'rgba(231, 76, 60, 0.2)',
                                  border: '1px solid #e74c3c',
                                  color: '#e74c3c',
                                  borderRadius: '4px',
                                  padding: '0.25rem 0.5rem',
                                  cursor: 'pointer',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Remove
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <input
                          type="text"
                          placeholder="Add new item..."
                          id="new-item-input"
                          style={{ flex: 1 }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && e.target.value.trim()) {
                              const newItems = [...items, { name: e.target.value.trim(), quantity: 1 }]
                              setFormData({ ...formData, inventory: JSON.stringify(newItems) })
                              e.target.value = ''
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('new-item-input')
                            if (input.value.trim()) {
                              const newItems = [...items, { name: input.value.trim(), quantity: 1 }]
                              setFormData({ ...formData, inventory: JSON.stringify(newItems) })
                              input.value = ''
                            }
                          }}
                          style={{
                            background: '#2ecc71',
                            border: 'none',
                            color: 'white',
                            borderRadius: '4px',
                            padding: '0.5rem 1rem',
                            cursor: 'pointer'
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </>
                  )
                } catch {
                  return <p style={{ color: '#888' }}>Error loading inventory</p>
                }
              })()}
            </div>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Skills & Abilities</h3>

          <div className="form-group">
            <label>Proficient Skills (comma-separated)</label>
            <input
              type="text"
              value={formData.skills}
              onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
              placeholder="e.g., Stealth, Perception, Acrobatics"
            />
            <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
              Enter skill names separated by commas
            </small>
          </div>

          <div className="form-group">
            <label>Special Advantages & Features (comma-separated)</label>
            <textarea
              value={formData.advantages}
              onChange={(e) => setFormData({ ...formData, advantages: e.target.value })}
              placeholder="e.g., Darkvision, Lucky, Action Surge"
              rows="3"
            />
            <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
              Special abilities that make your character unique
            </small>
          </div>

          <div className="form-group">
            <label>Inventory (comma-separated)</label>
            <textarea
              value={formData.inventory}
              onChange={(e) => setFormData({ ...formData, inventory: e.target.value })}
              placeholder="e.g., Longsword, Shield, Rope (50ft), Health Potion x3"
              rows="3"
            />
            <small style={{ color: '#bbb', marginTop: '0.25rem', display: 'block' }}>
              Items your character carries
            </small>
          </div>

          <h3 style={{ marginTop: '1.5rem', marginBottom: '1rem' }}>Current Status</h3>

          <div className="form-group">
            <label>Current Location *</label>
            <input
              type="text"
              value={formData.current_location}
              onChange={(e) => setFormData({ ...formData, current_location: e.target.value })}
              placeholder="e.g., Waterdeep, The Underdark, On a ship"
              required
            />
          </div>

          <div className="form-group">
            <label>Current Quest (optional)</label>
            <textarea
              value={formData.current_quest}
              onChange={(e) => setFormData({ ...formData, current_quest: e.target.value })}
              placeholder="Describe what you're currently working on..."
              rows="3"
            />
          </div>

          <div className="button-group" style={{ marginTop: '2rem' }}>
            <button type="submit" className="button">Create Character</button>
            <button type="button" className="button button-secondary" onClick={() => { setShowForm(false); resetForm(); }}>
              Cancel
            </button>
          </div>
        </form>
          )}

        </>
      )}
    </div>
  )
}

export default CharacterManager
