import { useState } from 'react'
import racesData from '../data/races.json'
import {
  BIRTH_CIRCUMSTANCES,
  HOME_SETTINGS,
  REGIONS,
  PARENT_STATUS,
  PARENT_ROLES,
  SIBLING_OPTIONS,
  AUTHORITY_FIGURES
} from '../data/preludeSetup'

const ORIGIN_FREEFORM_MAX = 2000

/**
 * 10-question prelude setup wizard.
 *
 * Phase 2 rewrite of the v1.0.73 wizard. Q9 (talents), Q10 (cares), and
 * Q11 (tone preset) cut; Q9 (authority figure) and Q10 (anything else?)
 * added. Q8 (siblings) replaced variable-length sub-form with a single
 * dropdown. See DECISION_LOG 2026-04-30 "Phase 2 Pre-Engineering Decision A:
 * Setup Wizard Content Revisit" for the full content rationale.
 *
 * Q1, Q4-Q6 accept free text; Q4-Q6 also have curated options. Q7 keeps the
 * two-slot parents sub-form. Q8, Q9 are pure dropdowns. Q10 is optional
 * free text capped at 2000 characters.
 *
 * On submit, POSTs the full payload to /api/prelude/setup and hands the
 * created character back to the parent via `onPreludeCreated(character)`.
 * Parent is responsible for routing to the arc-preview / gameplay screen.
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
    siblings: '',          // single dropdown value (Decision A — one of SIBLING_OPTIONS)
    authority_figure: '',  // Q9 — single-select (Decision A)
    origin_freeform: '',   // Q10 — optional free text, 2000 char cap
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

  // Build the payload sent to the server. Merges free-text fallbacks into
  // the curated fields (so the server sees one canonical value per question).
  const buildPayload = () => {
    const resolved = (curated, otherKey) => {
      if (form[otherKey] && form[otherKey].trim()) return form[otherKey].trim()
      return curated
    }
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
      siblings: form.siblings,                                // Phase 2: single enum value
      authority_figure: form.authority_figure,                // Phase 2: required
      origin_freeform: form.origin_freeform.trim() || null    // Phase 2: optional
    }
  }

  // Q8/Q9 contradiction check — only-child + older-sibling-as-authority is
  // incoherent and would produce garbage arc plans. Blocking validation per
  // DECISION_LOG 2026-04-30 Decision A.
  const siblingAuthorityContradiction = () => {
    return form.siblings === 'only_child' && form.authority_figure === 'sibling'
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
    if (!p.siblings) return 'Please pick a sibling configuration.'
    if (!p.authority_figure) return 'Please pick who looms largest in your early life.'
    if (siblingAuthorityContradiction()) {
      return 'Q8 says only child but Q9 names an older sibling — one of those needs to change.'
    }
    if (p.origin_freeform && p.origin_freeform.length > ORIGIN_FREEFORM_MAX) {
      return `Q10 is over the ${ORIGIN_FREEFORM_MAX}-character limit.`
    }
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
  const helpStyle = { fontSize: '0.78rem', color: '#bbb', margin: '0.4rem 0 0 0', lineHeight: 1.45 }

  const contradiction = siblingAuthorityContradiction()
  const originLength = form.origin_freeform.length

  return (
    <div className="container" style={{ maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#a78bfa' }}>Start with a Prelude</h2>
        <p style={{ color: '#bbb', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: 0 }}>
          Your character begins as a child. You'll play through four focused sessions of their formative years —
          childhood, adolescence, and the threshold of adulthood. Class, theme, ancestry feat, and ability bumps
          emerge from what you actually do. These ten questions set the stage; everything else gets discovered in play.
        </p>
      </div>

      {/* Q1: Name */}
      <div style={cardStyle}>
        <label style={labelStyle}>1. Name</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
          <input type="text" value={form.first_name} onChange={e => set('first_name', e.target.value)} placeholder="First name" />
          <input type="text" value={form.last_name} onChange={e => set('last_name', e.target.value)} placeholder="Last name" />
          <input type="text" value={form.nickname} onChange={e => set('nickname', e.target.value)} placeholder="Nickname (optional)" />
        </div>
        <p style={helpStyle}>
          Some cultures don't use family surnames the way others do — leave Last name blank if that fits your character.
          The DM will use just your first name (or invent a use-name with you in early scenes if it matters).
        </p>
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
        <p style={helpStyle}>
          Some races have their own naming conventions. If you leave Last name blank, the DM may introduce you
          through play with a use-name (e.g. "Aelar of the Silver Glade") shaped by your race and where you grew up.
        </p>
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

      {/* Q8: Siblings (single dropdown — Phase 2) */}
      <div style={cardStyle}>
        <label style={labelStyle}>8. Siblings</label>
        <select value={form.siblings} onChange={e => set('siblings', e.target.value)} style={{ width: '100%' }}>
          <option value="">Select sibling configuration</option>
          {SIBLING_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        <p style={helpStyle}>
          If your character had something more specific — adopted siblings, half-siblings from a different family,
          etc. — you can describe it in question 10.
        </p>
      </div>

      {/* Q9: Authority figure (NEW — Phase 2) */}
      <div style={cardStyle}>
        <label style={labelStyle}>9. Who looms largest in your early life?</label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.7rem 0' }}>
          The dominant adult presence — not necessarily the one who loved you most, but the one whose attention
          shaped you most. The arc will give this person real weight in the story.
        </p>
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {AUTHORITY_FIGURES.map(opt => {
            const picked = form.authority_figure === opt.value
            return (
              <label
                key={opt.value}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.6rem',
                  padding: '0.6rem 0.8rem',
                  borderRadius: '8px',
                  border: picked ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.15)',
                  background: picked ? 'rgba(139,92,246,0.18)' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer',
                  transition: 'border-color 120ms, background 120ms'
                }}
              >
                <input
                  type="radio"
                  name="authority_figure"
                  value={opt.value}
                  checked={picked}
                  onChange={() => set('authority_figure', opt.value)}
                  style={{ marginTop: '0.2rem', accentColor: '#8b5cf6', cursor: 'pointer' }}
                />
                <span>
                  <span style={{ fontWeight: 700, color: picked ? '#e9d5ff' : '#e4e4e4' }}>{opt.label}</span>
                  <span style={{ color: picked ? '#d4d4d8' : '#aaa' }}> — {opt.description}</span>
                </span>
              </label>
            )
          })}
        </div>
        {contradiction && (
          <p style={{ ...helpStyle, color: '#fca5a5', marginTop: '0.6rem' }}>
            You picked "Only child" in Q8 — pick a different authority figure here, or change Q8.
          </p>
        )}
      </div>

      {/* Q10: Anything else? (NEW — Phase 2; optional free text) */}
      <div style={cardStyle}>
        <label style={labelStyle}>10. Anything else? <span style={{ fontWeight: 400, color: '#9fa3a8' }}>(optional)</span></label>
        <p style={{ fontSize: '0.82rem', color: '#bbb', margin: '0 0 0.5rem 0' }}>
          If you have a specific origin in mind, write it here. The DM will honor it. Leave blank if you don't —
          your character will emerge through play.
        </p>
        <textarea
          value={form.origin_freeform}
          onChange={e => set('origin_freeform', e.target.value)}
          placeholder="Optional. Any specifics about your character's origin the curated answers couldn't capture."
          style={{
            width: '100%',
            minHeight: '5rem',
            padding: '0.5rem',
            fontFamily: 'inherit',
            fontSize: '0.9rem',
            background: 'rgba(0,0,0,0.2)',
            color: '#e4e4e4',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '6px',
            resize: 'vertical'
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem' }}>
          <span style={{
            fontSize: '0.72rem',
            color: originLength > ORIGIN_FREEFORM_MAX ? '#fca5a5' : '#888'
          }}>
            {originLength} / {ORIGIN_FREEFORM_MAX}
          </span>
        </div>
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
          disabled={submitting || contradiction}
          style={{ flex: 2, background: (submitting || contradiction) ? '#6b7280' : '#8b5cf6', color: '#fff' }}
        >
          {submitting ? 'Creating…' : 'Begin the Prelude'}
        </button>
      </div>
    </div>
  )
}
