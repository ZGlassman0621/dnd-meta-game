import { useState } from 'react'
import racesData from '../data/races.json'
import {
  BIRTH_CIRCUMSTANCES,
  HOME_SETTINGS,
  REGIONS,
  PARENT_STATUS,
  PARENT_ROLES,
  SIBLING_RELATIVE_AGES,
  SIBLING_GENDERS,
  CHILDHOOD_TALENTS,
  CHILDHOOD_CARES,
  TONE_TAGS
} from '../data/preludeSetup'

/**
 * 12-question prelude setup wizard.
 *
 * Every field is mandatory. Curated lists render as chips/selects with an
 * "Other (write your own)" free-text fallback for fields that allow one.
 * Tone tags (Q12) are closed-vocabulary multi-select (pick 2-4).
 *
 * On submit, POSTs the full payload to /api/prelude/setup and hands the
 * created character back to the parent via `onPreludeCreated(character)`.
 * Parent is responsible for routing to the arc-preview / gameplay screen
 * (Phase 2 adds that); Phase 1 just confirms the character was saved.
 */
export default function PreludeSetupWizard({ onPreludeCreated, onCancel }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    gender: '',
    gender_other: '',
    race: '',
    subrace: '',
    birth_circumstance: '',
    birth_circumstance_other: '',
    home_setting: '',
    home_setting_other: '',
    region: '',
    region_other: '',
    parents: [
      { role: 'mother', name: '', race: '', status: 'present' },
      { role: 'father', name: '', race: '', status: 'present' }
    ],
    siblings: [], // { name, gender, race, relative_age }
    talents: [], // 3 items
    talent_other: '',
    cares: [], // 3 items
    care_other: '',
    tone_tags: [], // 2-4 items
    // Testing flag — when true, the arc preview screen is shown between
    // setup and the first session. Defaults to ON while we're play-testing;
    // uncheck for a production-feeling flow where the player learns their
    // character through play.
    show_arc_preview: true
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const raceKeys = Object.keys(racesData)
  const raceData = form.race ? racesData[form.race] : null
  const subraces = raceData?.subraces || []

  const togglePick = (field, value, limit) => {
    const current = form[field]
    const has = current.includes(value)
    if (has) {
      set(field, current.filter(v => v !== value))
    } else if (current.length < limit) {
      set(field, [...current, value])
    }
  }

  const addSibling = () => {
    // Default sibling race to player's race — matches the typical case, and
    // the player can override per-slot. Same pattern for parents.
    set('siblings', [...form.siblings, { name: '', gender: 'sister', race: form.race || '', relative_age: 'younger' }])
  }
  const updateSibling = (idx, key, value) => {
    const next = [...form.siblings]
    next[idx] = { ...next[idx], [key]: value }
    set('siblings', next)
  }
  const removeSibling = (idx) => {
    set('siblings', form.siblings.filter((_, i) => i !== idx))
  }

  // Build the payload sent to the server. Merges free-text fallbacks into
  // the curated fields (so the server sees one canonical value per question).
  const buildPayload = () => {
    const resolved = (curated, otherKey) => {
      if (form[otherKey] && form[otherKey].trim()) return form[otherKey].trim()
      return curated
    }
    const talents = [
      ...form.talents,
      ...(form.talent_other.trim() ? [form.talent_other.trim()] : [])
    ].slice(0, 3)
    const cares = [
      ...form.cares,
      ...(form.care_other.trim() ? [form.care_other.trim()] : [])
    ].slice(0, 3)
    // Parents: filter out empty rows (the schema allows 1-2 parents).
    // Default parent.race to the player's race when unset.
    const parents = form.parents
      .filter(p => p.status && (p.name.trim() || p.status !== 'present'))
      .map(p => ({
        role: p.role || 'guardian',
        name: p.name.trim() || null,
        race: p.race || form.race,
        status: p.status
      }))
    const parentsFinal = parents.length > 0 ? parents : [{ role: 'guardian', name: null, race: form.race, status: 'unknown' }]

    return {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null,
      gender: form.gender === 'other' ? form.gender_other.trim() : form.gender,
      race: form.race,
      subrace: form.subrace || null,
      // starting_age is server-derived from race (v1.0.43+).
      birth_circumstance: resolved(form.birth_circumstance, 'birth_circumstance_other'),
      home_setting: resolved(form.home_setting, 'home_setting_other'),
      region: resolved(form.region, 'region_other'),
      parents: parentsFinal,
      siblings: form.siblings.map(s => ({
        name: (s.name || '').trim(),
        gender: s.gender || 'sibling',
        race: s.race || form.race,
        relative_age: s.relative_age || 'younger'
      })).filter(s => s.name),
      talents,
      cares,
      tone_tags: form.tone_tags
    }
  }

  // Client-side validation — mirrors server-side rules. Returns '' if OK,
  // otherwise a human-readable error string.
  const validate = () => {
    const p = buildPayload()
    if (!p.first_name && !p.last_name) return 'Character needs at least a first or last name.'
    if (!p.gender) return 'Please choose a gender (or "other" + write your own).'
    if (!p.race) return 'Please choose a race.'
    if (!p.birth_circumstance) return 'Please pick a birth circumstance (or write your own).'
    if (!p.home_setting) return 'Please pick a home setting (or write your own).'
    if (!p.region) return 'Please pick a region (or write your own).'
    if (p.talents.length !== 3) return 'Pick exactly 3 things they\'re good at.'
    if (p.cares.length !== 3) return 'Pick exactly 3 things they care about.'
    if (p.tone_tags.length < 2 || p.tone_tags.length > 4) return 'Pick 2-4 tone tags.'
    return ''
  }

  const handleSubmit = async () => {
    const msg = validate()
    if (msg) { setError(msg); return }
    setError('')
    setSubmitting(true)
    try {
      const payload = buildPayload()
      const resp = await fetch('/api/prelude/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        setError(body.error || `Server error (${resp.status})`)
        setSubmitting(false)
        return
      }
      const character = await resp.json()
      // Pass the dev flag so CharacterManager can route to either arc preview
      // (testing) or straight into session start (production-feeling).
      onPreludeCreated && onPreludeCreated(character, { showArcPreview: form.show_arc_preview })
    } catch (e) {
      setError(`Network error: ${e.message}`)
      setSubmitting(false)
    }
  }

  // ---- Styling helpers ----------------------------------------------------
  const cardStyle = {
    padding: '1rem',
    background: 'rgba(139,92,246,0.08)',
    border: '1px solid rgba(139,92,246,0.3)',
    borderRadius: '8px',
    marginBottom: '1rem'
  }
  const labelStyle = { display: 'block', marginBottom: '0.35rem', color: '#c4b5fd', fontWeight: 600 }
  const descStyle = { fontSize: '0.75rem', color: '#9fa3a8', fontStyle: 'italic', marginTop: '0.2rem', lineHeight: 1.4 }

  const chip = (selected, disabled, onClick, children) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '0.4rem 0.7rem',
        borderRadius: '16px',
        border: selected ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.2)',
        background: selected ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
        color: selected ? '#e9d5ff' : (disabled ? '#555' : '#ccc'),
        cursor: disabled && !selected ? 'not-allowed' : 'pointer',
        fontSize: '0.8rem'
      }}
    >
      {children}
    </button>
  )

  return (
    <div className="container" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#a78bfa' }}>Start with a Prelude</h2>
        <p style={{ color: '#bbb', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
          Your character will begin as a child. You'll play through 7-10 sessions of
          their growing up. Class, theme, stats, and values will emerge from what you
          actually do. These 12 questions set the stage.
        </p>
      </div>

      {/* Q1-3: Name + nickname */}
      <div style={cardStyle}>
        <label style={labelStyle}>1. Name</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
          <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
          <input type="text" value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Nickname (optional)" />
        </div>
      </div>

      {/* Q2: Gender */}
      <div style={cardStyle}>
        <label style={labelStyle}>2. Gender</label>
        <select value={form.gender} onChange={e => set('gender', e.target.value)} style={{ width: '100%' }}>
          <option value="">Select gender</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
          <option value="non-binary">Non-binary</option>
          <option value="other">Other (write your own)</option>
        </select>
        {form.gender === 'other' && (
          <input
            type="text"
            value={form.gender_other}
            onChange={e => set('gender_other', e.target.value)}
            placeholder="Your gender"
            style={{ width: '100%', marginTop: '0.35rem' }}
          />
        )}
      </div>

      {/* Q3: Race + subrace */}
      <div style={cardStyle}>
        <label style={labelStyle}>3. Race</label>
        <select value={form.race} onChange={e => { set('race', e.target.value); set('subrace', '') }} style={{ width: '100%' }}>
          <option value="">Select race</option>
          {raceKeys.map(k => (
            <option key={k} value={k}>{racesData[k].name}</option>
          ))}
        </select>
        {raceData?.description && (
          <p style={descStyle}>{raceData.description}</p>
        )}
        {subraces.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            <label style={labelStyle}>Sub-race</label>
            <select value={form.subrace} onChange={e => set('subrace', e.target.value)} style={{ width: '100%' }}>
              <option value="">Select sub-race</option>
              {subraces.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            {form.subrace && subraces.find(s => s.name === form.subrace)?.description && (
              <p style={descStyle}>{subraces.find(s => s.name === form.subrace).description}</p>
            )}
          </div>
        )}
      </div>

      {/* Q4: Birth circumstance (starting age removed in v1.0.43 —
          derived from race server-side). */}
      <div style={cardStyle}>
        <label style={labelStyle}>4. Birth circumstance</label>
        <select value={form.birth_circumstance} onChange={e => set('birth_circumstance', e.target.value)} style={{ width: '100%' }}>
          <option value="">Select circumstance</option>
          {BIRTH_CIRCUMSTANCES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {form.birth_circumstance && (
          <p style={descStyle}>
            {BIRTH_CIRCUMSTANCES.find(c => c.value === form.birth_circumstance)?.description}
          </p>
        )}
        <input
          type="text"
          value={form.birth_circumstance_other}
          onChange={e => set('birth_circumstance_other', e.target.value)}
          placeholder="Or write your own (overrides dropdown)"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </div>

      {/* Q5: Home setting */}
      <div style={cardStyle}>
        <label style={labelStyle}>5. Home setting</label>
        <select value={form.home_setting} onChange={e => set('home_setting', e.target.value)} style={{ width: '100%' }}>
          <option value="">Select home</option>
          {HOME_SETTINGS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {form.home_setting && (
          <p style={descStyle}>
            {HOME_SETTINGS.find(c => c.value === form.home_setting)?.description}
          </p>
        )}
        <input
          type="text"
          value={form.home_setting_other}
          onChange={e => set('home_setting_other', e.target.value)}
          placeholder="Or write your own (overrides dropdown)"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </div>

      {/* Q6: Region */}
      <div style={cardStyle}>
        <label style={labelStyle}>6. Region</label>
        <select value={form.region} onChange={e => set('region', e.target.value)} style={{ width: '100%' }}>
          <option value="">Select region</option>
          {REGIONS.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        {form.region && (
          <p style={descStyle}>
            {REGIONS.find(c => c.value === form.region)?.description}
          </p>
        )}
        <input
          type="text"
          value={form.region_other}
          onChange={e => set('region_other', e.target.value)}
          placeholder="Or write your own (overrides dropdown)"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </div>

      {/* Q7: Parents */}
      <div style={cardStyle}>
        <label style={labelStyle}>7. Parents / guardians</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          Up to two parents or guardians. Pick who each one is to you (mother, father, grandparent who raised you, etc.), their race, their name, and whether they're present / distant / gone. Race defaults to yours; change it for mixed-race or foundling families.
        </p>
        {form.parents.map((p, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.2fr 1fr', gap: '0.4rem', marginBottom: '0.5rem' }}>
            <select
              value={p.role}
              onChange={e => {
                const next = [...form.parents]
                next[i] = { ...next[i], role: e.target.value }
                set('parents', next)
              }}
            >
              {PARENT_ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select
              value={p.race || ''}
              onChange={e => {
                const next = [...form.parents]
                next[i] = { ...next[i], race: e.target.value }
                set('parents', next)
              }}
              title="Defaults to player's race if left blank"
            >
              <option value="">(same as you)</option>
              {raceKeys.map(k => (
                <option key={k} value={k}>{racesData[k].name}</option>
              ))}
            </select>
            <input
              type="text"
              value={p.name}
              onChange={e => {
                const next = [...form.parents]
                next[i] = { ...next[i], name: e.target.value }
                set('parents', next)
              }}
              placeholder="Name (blank = unknown)"
            />
            <select
              value={p.status}
              onChange={e => {
                const next = [...form.parents]
                next[i] = { ...next[i], status: e.target.value }
                set('parents', next)
              }}
            >
              {PARENT_STATUS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        ))}
        <p style={descStyle}>
          {PARENT_STATUS.find(s => s.value === form.parents[0]?.status)?.description}
        </p>
      </div>

      {/* Q8: Siblings */}
      <div style={cardStyle}>
        <label style={labelStyle}>8. Siblings</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          Only children can leave this empty. For each sibling, pick whether they're younger, older, or a twin.
        </p>
        {form.siblings.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 0.9fr auto', gap: '0.35rem', marginBottom: '0.35rem' }}>
            <input type="text" value={s.name} onChange={e => updateSibling(i, 'name', e.target.value)} placeholder="Sibling name" />
            <select
              value={s.race || ''}
              onChange={e => updateSibling(i, 'race', e.target.value)}
              title="Defaults to player's race if left blank"
            >
              <option value="">(same as you)</option>
              {raceKeys.map(k => (
                <option key={k} value={k}>{racesData[k].name}</option>
              ))}
            </select>
            <select value={s.gender} onChange={e => updateSibling(i, 'gender', e.target.value)}>
              {SIBLING_GENDERS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </select>
            <select value={s.relative_age} onChange={e => updateSibling(i, 'relative_age', e.target.value)}>
              {SIBLING_RELATIVE_AGES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <button type="button" onClick={() => removeSibling(i)} style={{ padding: '0.3rem 0.5rem', background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', borderRadius: '4px', cursor: 'pointer' }}>✕</button>
          </div>
        ))}
        <button
          type="button"
          onClick={addSibling}
          style={{ padding: '0.4rem 0.75rem', background: 'rgba(139,92,246,0.15)', border: '1px dashed rgba(139,92,246,0.4)', color: '#c4b5fd', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}
        >
          + Add sibling
        </button>
      </div>

      {/* Q9: Talents */}
      <div style={cardStyle}>
        <label style={labelStyle}>9. Three things you're good at</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          Pick 3. These nudge the AI toward certain kinds of scenes — they do not lock in class or stats.
          Currently picked: {form.talents.length + (form.talent_other.trim() ? 1 : 0)}/3.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {CHILDHOOD_TALENTS.map(t => {
            const picked = form.talents.includes(t)
            const limit = 3 - (form.talent_other.trim() ? 1 : 0)
            const disabled = !picked && form.talents.length >= limit
            return (
              <span key={t}>
                {chip(picked, disabled, () => togglePick('talents', t, limit), t)}
              </span>
            )
          })}
        </div>
        <input
          type="text"
          value={form.talent_other}
          onChange={e => set('talent_other', e.target.value)}
          placeholder="Or write your own (replaces one chip)"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </div>

      {/* Q10: Cares */}
      <div style={cardStyle}>
        <label style={labelStyle}>10. Three things you care about</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          Pick 3. These seed the values profile that grows through play.
          Currently picked: {form.cares.length + (form.care_other.trim() ? 1 : 0)}/3.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {CHILDHOOD_CARES.map(t => {
            const picked = form.cares.includes(t)
            const limit = 3 - (form.care_other.trim() ? 1 : 0)
            const disabled = !picked && form.cares.length >= limit
            return (
              <span key={t}>
                {chip(picked, disabled, () => togglePick('cares', t, limit), t)}
              </span>
            )
          })}
        </div>
        <input
          type="text"
          value={form.care_other}
          onChange={e => set('care_other', e.target.value)}
          placeholder="Or write your own (replaces one chip)"
          style={{ width: '100%', marginTop: '0.5rem' }}
        />
      </div>

      {/* Q11: Tone tags */}
      <div style={cardStyle}>
        <label style={labelStyle}>11. Tone</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          Pick 2-4 tone tags. These shape both the AI-generated arc plan and how scenes are written.
          Combinations matter: "gritty + dark humor" plays very differently from "epic + tragic + mystical."
          Currently picked: {form.tone_tags.length}/4.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
          {TONE_TAGS.map(t => {
            const picked = form.tone_tags.includes(t.value)
            const disabled = !picked && form.tone_tags.length >= 4
            return (
              <button
                key={t.value}
                type="button"
                disabled={disabled}
                onClick={() => togglePick('tone_tags', t.value, 4)}
                title={t.description}
                style={{
                  padding: '0.4rem 0.7rem',
                  borderRadius: '16px',
                  border: picked ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.2)',
                  background: picked ? 'rgba(139,92,246,0.25)' : 'rgba(255,255,255,0.04)',
                  color: picked ? '#e9d5ff' : (disabled ? '#555' : '#ccc'),
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.8rem'
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
        {form.tone_tags.length > 0 && (
          <div style={{ marginTop: '0.5rem' }}>
            {form.tone_tags.map(tag => {
              const t = TONE_TAGS.find(x => x.value === tag)
              return t ? (
                <p key={tag} style={{ ...descStyle, marginTop: '0.15rem' }}>
                  <strong style={{ color: '#c4b5fd', fontStyle: 'normal' }}>{t.label}:</strong> {t.description}
                </p>
              ) : null
            })}
          </div>
        )}
      </div>

      {/* Dev/testing toggle — show the arc preview screen between setup and
          first session, or dive straight into gameplay. Default ON while
          play-testing the arc output; flip OFF for production-feeling flow. */}
      <div style={{
        ...cardStyle,
        background: 'rgba(139,92,246,0.04)',
        border: '1px dashed rgba(139,92,246,0.3)'
      }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0 }}>
          <input
            type="checkbox"
            checked={form.show_arc_preview}
            onChange={e => set('show_arc_preview', e.target.checked)}
            style={{ width: '1.1rem', height: '1.1rem', accentColor: '#8b5cf6', cursor: 'pointer' }}
          />
          <span style={{ ...labelStyle, margin: 0 }}>Show the arc preview (testing)</span>
        </label>
        <p style={{ ...descStyle, marginTop: '0.35rem' }}>
          When checked: after submitting, you'll see the Opus-generated arc plan before gameplay starts. Useful for testing that the arc respects your setup. Uncheck to dive straight into the first scene — that's how a regular play session works.
        </p>
      </div>

      {error && (
        <p style={{ color: '#fca5a5', marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button type="button" onClick={onCancel} className="button" style={{ flex: 1, background: '#95a5a6' }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="button"
          disabled={submitting}
          style={{ flex: 2, background: submitting ? '#6b7280' : '#8b5cf6', color: '#fff' }}
        >
          {submitting ? 'Creating…' : 'Begin the Prelude'}
        </button>
      </div>
    </div>
  )
}
