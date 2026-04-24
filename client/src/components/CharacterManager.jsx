import { useState, useEffect } from 'react'
import CharacterCreationWizard from './CharacterCreationWizard'
import PreludeSetupWizard from './PreludeSetupWizard'
import PreludeArcPreview from './PreludeArcPreview'
import PreludeSession from './PreludeSession'
import classesData from '../data/classes.json'

function CharacterManager({ characters, selectedCharacter, onSelectCharacter, onCharacterCreated, onCharacterUpdated, onCreationFormChange, editCharacterInWizard, onClearEditCharacter, onShowLevelUp }) {
  const [showForm, setShowForm] = useState(false)
  const [showPrelude, setShowPrelude] = useState(false)
  const [preludeArcCharacter, setPreludeArcCharacter] = useState(null)
  const [preludeSessionCharacter, setPreludeSessionCharacter] = useState(null)
  const [resting, setResting] = useState(false)
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

  // Check level-up status for all characters.
  // Skip prelude-phase characters — they don't have a class/level yet, so
  // the level-up check would false-positive on their placeholder class='prelude'
  // and level=0. Leveling emerges from the primary character creator after
  // the prelude ends, not during it.
  useEffect(() => {
    const checkLevelUpStatus = async () => {
      const statusMap = {}
      for (const char of characters) {
        if (char.creation_phase === 'prelude') {
          statusMap[char.id] = false
          continue
        }
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
    // Delegate to the parent — App.jsx routes to the full-page LevelUpPage flow,
    // which handles the wizard, persistence, and celebration on completion.
    if (onShowLevelUp) {
      onShowLevelUp(char)
    }
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


  // v1.0.85 — PreludeSession renders its own panel chrome (per-panel now
  // that Lore pops out to the right). Wrapping it in <div className="container">
  // double-wraps and draws the parent chrome around the play+Lore flex row,
  // which looks like a big empty outlined box when Lore is closed. Skip the
  // container wrapper when PreludeSession is active; the session owns its
  // own layout.
  if (preludeSessionCharacter) {
    return (
      <PreludeSession
        character={preludeSessionCharacter}
        onBack={() => {
          setPreludeSessionCharacter(null)
          if (onCreationFormChange) onCreationFormChange(false)
        }}
      />
    )
  }

  return (
    <div className="container">
      {preludeArcCharacter ? (
        <PreludeArcPreview
          character={preludeArcCharacter}
          onBegin={() => {
            // Route into the session loop. The PreludeSession component will
            // resume an active session or start a new one.
            setPreludeArcCharacter(null)
            setPreludeSessionCharacter(preludeArcCharacter)
          }}
          onReturn={() => {
            setPreludeArcCharacter(null)
            if (onCreationFormChange) onCreationFormChange(false)
          }}
        />
      ) : showPrelude ? (
        <PreludeSetupWizard
          onPreludeCreated={(char, opts = {}) => {
            // Setup done. Two routing paths depending on the arc-preview
            // checkbox: testing → preview screen; production → straight
            // into session start. Keep form-change flag true either way
            // so NavigationMenu / etc. know we're still in a creation flow.
            setShowPrelude(false)
            onCharacterCreated(char)
            if (opts.showArcPreview === false) {
              setPreludeSessionCharacter(char)
            } else {
              setPreludeArcCharacter(char)
            }
          }}
          onCancel={() => {
            setShowPrelude(false)
            if (onCreationFormChange) onCreationFormChange(false)
          }}
        />
      ) : showForm ? (
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0 }}>Characters</h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  onSelectCharacter(null)
                  setShowPrelude(true)
                  if (onCreationFormChange) onCreationFormChange(true)
                }}
                style={{
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.85rem',
                  background: 'rgba(139,92,246,0.2)',
                  border: '1px solid #8b5cf6',
                  color: '#c4b5fd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
                title="Play your character's childhood and adolescence; class, stats, and values emerge from play"
              >
                ✦ Start with a Prelude
              </button>
              <button
                className="button button-secondary"
                onClick={() => {
                  onSelectCharacter(null)
                  handleShowForm(true)
                }}
                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
              >
                + New Character
              </button>
            </div>
          </div>

          {characters.length === 0 ? (
            <p style={{ color: '#bbb', marginBottom: '1rem' }}>No characters yet. Create one to get started!</p>
          ) : (
            <div style={{ marginBottom: '0.5rem' }}>
              {characters.map(char => (
            <div
              key={char.id}
              className={`character-card ${selectedCharacter?.id === char.id ? 'selected' : ''}`}
              onClick={async () => {
                // Prelude-phase characters route into the session loop if one
                // is active, else into the arc preview (which has the Begin
                // the Prelude button that jumps to session start).
                if (char.creation_phase === 'prelude') {
                  onSelectCharacter(char)
                  if (onCreationFormChange) onCreationFormChange(true)
                  try {
                    const resp = await fetch(`/api/prelude/${char.id}/sessions/active`)
                    if (resp.ok) {
                      setPreludeSessionCharacter(char)
                      return
                    }
                  } catch (_) { /* fall through to arc preview */ }
                  setPreludeArcCharacter(char)
                } else {
                  onSelectCharacter(char)
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {char.avatar && (
                  <img
                    src={char.avatar}
                    alt={`${char.name} avatar`}
                    style={{
                      width: '48px',
                      height: '48px',
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
                  {char.creation_phase === 'prelude' ? (
                    <p style={{ margin: '0.25rem 0 0 0', color: '#bbb' }}>
                      {capitalize(char.race)}{char.subrace ? ` (${char.subrace})` : ''} · Age {char.prelude_age || '?'}
                    </p>
                  ) : (
                    <p style={{ margin: '0.25rem 0 0 0', color: '#bbb' }}>Level {char.level} {capitalize(char.race)} {capitalize(char.class)}</p>
                  )}
                </div>
                {char.creation_phase === 'prelude' && (
                  <span
                    style={{
                      background: 'rgba(139,92,246,0.15)',
                      border: '1px solid #8b5cf6',
                      color: '#c4b5fd',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: 'bold'
                    }}
                    title="Prelude in progress — gameplay arrives in Phase 2"
                  >
                    ✦ In Prelude
                  </span>
                )}
                {canLevelUpStatus[char.id] && (
                  <span style={{
                    background: 'rgba(241, 196, 15, 0.2)',
                    border: '1px solid #f1c40f',
                    color: '#f1c40f',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                  }}>
                    Level Up!
                  </span>
                )}
              </div>
            </div>
              ))}
            </div>
          )}

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
