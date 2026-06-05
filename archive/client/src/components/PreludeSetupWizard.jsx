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
import { Field, Eyebrow } from './creator/creatorPrimitives.jsx'

const ORIGIN_FREEFORM_MAX = 2000

// DEPRECATED 2026-05-04 — replaced by client/src/components/creator/PreludeCreatorV2.jsx
//
// v1.0.143 cutover: HomeFlow now renders the 6-step PreludeCreatorV2
// structural redesign as the live prelude-entry path (with save/resume,
// the new appearance step, and per-step validation gates). This legacy
// one-page wizard is retained but unwired per CLAUDE.md "deprecate by
// hiding nav, not deleting code." Same reasoning as the post-chunk-5
// retention of CharacterCreationWizard.jsx + CharacterManager.jsx.
//
// Safe to delete once 2-3 playtest cycles confirm no need to revert.
// Anything still importing from this file is a regression.

/**
 * 10-question prelude setup wizard. (DEPRECATED — see header.)
 *
 * Phase 2 close-out (2026-05-03): editorial reskin per PM ruling. Token
 * swap only — form fields, logic, copy, structure all preserved. Now
 * scoped under `.creator-v2` so the parchment palette + EB Garamond +
 * Inter typography match HomeScreenV2 / PathChoiceScreen / CharacterCreatorV2.
 * Closes the visible seam between the editorial home and the prelude
 * intake.
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

  const contradiction = siblingAuthorityContradiction()
  const originLength = form.origin_freeform.length

  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">Prelude · setup</div>
        <div className="spacer" />
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel}>← Back to roster</button>
        )}
      </div>

      <div className="stage">
        <div className="frame">
          {/* Header — eyebrow + display title + lede, mirroring WizardHead's
              structure but tuned for an out-of-step setup screen rather
              than one of the eight numbered steps. */}
          <div className="wizard-head">
            <div className="step-title">
              <Eyebrow>Prelude character · setup</Eyebrow>
              <h1 className="h-step" style={{ marginTop: 8 }}>Start with a Prelude</h1>
              <p className="lede" style={{ marginTop: 12, maxWidth: 720 }}>
                Your character begins as a child. You'll play through four focused sessions of their formative years —
                childhood, adolescence, and the threshold of adulthood. Class, theme, ancestry feat, and ability bumps
                emerge from what you actually do. These ten questions set the stage; everything else gets discovered in play.
              </p>
            </div>
          </div>

          {/* Q1: Name */}
          <div className="card">
            <Field label="1. Name" help="Some cultures don't use family surnames the way others do — leave Last name blank if that fits your character. The DM will use just your first name (or invent a use-name with you in early scenes if it matters).">
              <div className="field-row three">
                <input
                  type="text"
                  className="input"
                  value={form.first_name}
                  onChange={e => set('first_name', e.target.value)}
                  placeholder="First name"
                />
                <input
                  type="text"
                  className="input"
                  value={form.last_name}
                  onChange={e => set('last_name', e.target.value)}
                  placeholder="Last name"
                />
                <input
                  type="text"
                  className="input"
                  value={form.nickname}
                  onChange={e => set('nickname', e.target.value)}
                  placeholder="Nickname (optional)"
                />
              </div>
            </Field>
          </div>

          {/* Q2: Gender */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field label="2. Gender">
              <select
                className="select"
                value={form.gender}
                onChange={e => set('gender', e.target.value)}
              >
                <option value="">Select gender…</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other (write your own)</option>
              </select>
              {form.gender === 'other' && (
                <input
                  type="text"
                  className="input"
                  value={form.gender_other}
                  onChange={e => set('gender_other', e.target.value)}
                  placeholder="Your gender"
                  style={{ marginTop: 12 }}
                />
              )}
            </Field>
          </div>

          {/* Q3: Race + subrace */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field
              label="3. Race"
              help="Some races have their own naming conventions. If you leave Last name blank, the DM may introduce you through play with a use-name (e.g. 'Aelar of the Silver Glade') shaped by your race and where you grew up."
            >
              <select
                className="select"
                value={form.race}
                onChange={e => { set('race', e.target.value); set('subrace', '') }}
              >
                <option value="">Select race…</option>
                {raceKeys.map(k => (
                  <option key={k} value={k}>{racesData[k].name}</option>
                ))}
              </select>
              {raceData?.description && (
                <p className="help" style={{ marginTop: 10 }}>{raceData.description}</p>
              )}
            </Field>
            {subraces.length > 0 && (
              <Field label="Sub-race" className="" >
                <select
                  className="select"
                  value={form.subrace}
                  onChange={e => set('subrace', e.target.value)}
                >
                  <option value="">Select sub-race…</option>
                  {subraces.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
                {form.subrace && subraces.find(s => s.name === form.subrace)?.description && (
                  <p className="help" style={{ marginTop: 10 }}>
                    {subraces.find(s => s.name === form.subrace).description}
                  </p>
                )}
              </Field>
            )}
          </div>

          {/* Q4: Birth circumstance (starting age removed in v1.0.43 —
              derived from race server-side). */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field label="4. Birth circumstance">
              <select
                className="select"
                value={form.birth_circumstance}
                onChange={e => set('birth_circumstance', e.target.value)}
              >
                <option value="">Select circumstance…</option>
                {BIRTH_CIRCUMSTANCES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {form.birth_circumstance && (
                <p className="help" style={{ marginTop: 10 }}>
                  {BIRTH_CIRCUMSTANCES.find(c => c.value === form.birth_circumstance)?.description}
                </p>
              )}
              <input
                type="text"
                className="input"
                value={form.birth_circumstance_other}
                onChange={e => set('birth_circumstance_other', e.target.value)}
                placeholder="Or write your own (overrides dropdown)"
                style={{ marginTop: 12 }}
              />
            </Field>
          </div>

          {/* Q5: Home setting */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field label="5. Home setting">
              <select
                className="select"
                value={form.home_setting}
                onChange={e => set('home_setting', e.target.value)}
              >
                <option value="">Select home…</option>
                {HOME_SETTINGS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {form.home_setting && (
                <p className="help" style={{ marginTop: 10 }}>
                  {HOME_SETTINGS.find(c => c.value === form.home_setting)?.description}
                </p>
              )}
              <input
                type="text"
                className="input"
                value={form.home_setting_other}
                onChange={e => set('home_setting_other', e.target.value)}
                placeholder="Or write your own (overrides dropdown)"
                style={{ marginTop: 12 }}
              />
            </Field>
          </div>

          {/* Q6: Region */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field label="6. Region">
              <select
                className="select"
                value={form.region}
                onChange={e => set('region', e.target.value)}
              >
                <option value="">Select region…</option>
                {REGIONS.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {form.region && (
                <p className="help" style={{ marginTop: 10 }}>
                  {REGIONS.find(c => c.value === form.region)?.description}
                </p>
              )}
              <input
                type="text"
                className="input"
                value={form.region_other}
                onChange={e => set('region_other', e.target.value)}
                placeholder="Or write your own (overrides dropdown)"
                style={{ marginTop: 12 }}
              />
            </Field>
          </div>

          {/* Q7: Parents */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field
              label="7. Parents / guardians"
              help="Up to two parents or guardians. Pick who each one is to you (mother, father, grandparent who raised you, etc.), their race, their name, and whether they're present / distant / gone. Race defaults to yours; change it for mixed-race or foundling families."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {form.parents.map((p, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 1.4fr 1fr',
                      gap: 12
                    }}
                  >
                    <select
                      className="select"
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
                      className="select"
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
                      className="input"
                      value={p.name}
                      onChange={e => {
                        const next = [...form.parents]
                        next[i] = { ...next[i], name: e.target.value }
                        set('parents', next)
                      }}
                      placeholder="Name (blank = unknown)"
                    />
                    <select
                      className="select"
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
              </div>
              {PARENT_STATUS.find(s => s.value === form.parents[0]?.status)?.description && (
                <p className="help" style={{ marginTop: 10 }}>
                  {PARENT_STATUS.find(s => s.value === form.parents[0]?.status)?.description}
                </p>
              )}
            </Field>
          </div>

          {/* Q8: Siblings (single dropdown — Phase 2) */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field
              label="8. Siblings"
              help="If your character had something more specific — adopted siblings, half-siblings from a different family, etc. — you can describe it in question 10."
            >
              <select
                className="select"
                value={form.siblings}
                onChange={e => set('siblings', e.target.value)}
              >
                <option value="">Select sibling configuration…</option>
                {SIBLING_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </Field>
          </div>

          {/* Q9: Authority figure (NEW — Phase 2). Card-list of options
              with editorial accent on the picked entry. Preserves the
              "label + description" structure of the original radios. */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field
              label="9. Who looms largest in your early life?"
              help="The dominant adult presence — not necessarily the one who loved you most, but the one whose attention shaped you most. The arc will give this person real weight in the story."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {AUTHORITY_FIGURES.map(opt => {
                  const picked = form.authority_figure === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('authority_figure', opt.value)}
                      style={{
                        textAlign: 'left',
                        padding: '14px 18px',
                        background: picked ? 'var(--bg-2)' : 'var(--bg-card)',
                        border: `1px solid ${picked ? 'var(--accent)' : 'var(--rule)'}`,
                        borderLeft: `3px solid ${picked ? 'var(--accent)' : 'var(--rule)'}`,
                        borderRadius: 0,
                        cursor: 'pointer',
                        fontFamily: 'var(--serif)',
                        transition: 'border-color .12s, background .12s'
                      }}
                    >
                      <div style={{
                        fontFamily: 'var(--sans)',
                        fontSize: 13,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        color: picked ? 'var(--ink)' : 'var(--ink-2)',
                        marginBottom: 4
                      }}>
                        {opt.label}
                      </div>
                      <div style={{
                        fontFamily: 'var(--serif)',
                        fontStyle: 'italic',
                        fontSize: 15,
                        lineHeight: 1.45,
                        color: 'var(--ink-3)'
                      }}>
                        {opt.description}
                      </div>
                    </button>
                  )
                })}
              </div>
              {contradiction && (
                <p className="help" style={{ marginTop: 12, color: 'var(--accent)' }}>
                  You picked "Only child" in Q8 — pick a different authority figure here, or change Q8.
                </p>
              )}
            </Field>
          </div>

          {/* Q10: Anything else? (NEW — Phase 2; optional free text) */}
          <div className="card" style={{ marginTop: 18 }}>
            <Field
              label="10. Anything else? (optional)"
              help="If you have a specific origin in mind, write it here. The DM will honor it. Leave blank if you don't — your character will emerge through play."
            >
              <textarea
                className="textarea"
                value={form.origin_freeform}
                onChange={e => set('origin_freeform', e.target.value)}
                placeholder="Optional. Any specifics about your character's origin the curated answers couldn't capture."
                style={{ minHeight: 120 }}
              />
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 6,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                color: originLength > ORIGIN_FREEFORM_MAX ? 'var(--accent)' : 'var(--ink-3)'
              }}>
                {originLength} / {ORIGIN_FREEFORM_MAX}
              </div>
            </Field>
          </div>

          {/* Dev/testing toggle — show the arc preview screen between setup and
              first session, or dive straight into gameplay. Default ON while
              play-testing the arc output; flip OFF for production-feeling flow. */}
          <div
            className="card"
            style={{
              marginTop: 18,
              background: 'var(--bg-2)',
              borderStyle: 'dashed'
            }}
          >
            <Field
              label="Show the arc preview (testing)"
              help="When checked: after submitting, you'll see the Opus-generated arc plan before gameplay starts. Useful for testing that the arc respects your setup. Uncheck to dive straight into the first scene — that's how a regular play session works."
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                  fontFamily: 'var(--serif)',
                  fontSize: 17,
                  color: 'var(--ink-2)'
                }}
              >
                <input
                  type="checkbox"
                  checked={form.show_arc_preview}
                  onChange={e => set('show_arc_preview', e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span>{form.show_arc_preview ? 'Arc preview will show before gameplay' : 'Skip preview — go straight into the first scene'}</span>
              </label>
            </Field>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                marginTop: 18,
                padding: '14px 18px',
                background: 'var(--bg-2)',
                border: '1px solid var(--accent)',
                borderLeft: '3px solid var(--accent)',
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 16,
                color: 'var(--ink-2)'
              }}
            >
              {error}
            </div>
          )}

          <div className="wizard-foot">
            <button type="button" className="btn ghost" onClick={onCancel}>← Cancel</button>
            <div className="spacer" />
            <button
              type="button"
              className="btn primary lg"
              onClick={handleSubmit}
              disabled={submitting || contradiction}
            >
              {submitting ? 'Creating…' : 'Begin the Prelude →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
