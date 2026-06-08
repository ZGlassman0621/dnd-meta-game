import { useState, useMemo, useEffect } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import classesData from '../../data/classes.json'
import deitiesData from '../../data/deities.json'
import { THEME_BACKSTORY_MOMENTS } from '../../data/themeBackstoryMoments.js'
import { computeAncestryListId } from './Step2Ancestry.jsx'
import { ALIGNMENT_NAMES } from './AlignmentChip.jsx'
import { ABILITY_KEYS, ABILITY_LABELS } from './BumpCelebrationCard.jsx'

/**
 * Step 8 — Review. Per PHASE_2_CREATOR_SPEC.md §5.8.
 *
 * Rendered in the HEARTH dark-editorial system, matching the
 * "Create Character.html" mockup's Step-8 pane: a `.rv-list` of
 * per-section review rows (`.rvk` key + `.rvv` `.pri`/`.sec` value +
 * `.rv-edit` jump-back button), followed by a `.commit` card carrying the
 * one-line in-fiction summary and the primary "bring them to life" CTA.
 *
 * Each row's "Edit" affordance jumps back to the corresponding step
 * (state preserved across all other steps; player advances forward to
 * return to Submit).
 *
 * Submit branches on creation_phase (§8.2.2 / §8.2.3):
 *   - Manual ('creating' → 'active'): POST /api/character (or PUT to
 *     update the existing 'creating' row); flip to 'active'; new
 *     primary campaign with no Prelude inputs.
 *   - Handoff ('ready_for_primary' → 'active'): PUT /api/character/{id};
 *     flip to 'active'; canon transfer (NPCs / locations / threads);
 *     mentor imprint when applicable; new primary campaign with Prelude
 *     inputs.
 *
 * Handoff mode adds a brief in-fiction callout above the review list
 * per §5.8.5: "The years that shaped you are behind you now. Step
 * forward."
 */
export default function Step8Review({ state, mode, payload, onJump, onSubmit, characterId }) {
  const isHandoff = mode === 'handoff'
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

  // Validate every required field across Steps 1-7 before allowing
  // Submit. Surfaces step-specific errors per §5.8.7.
  const validation = useMemo(() => validateForSubmit(state, isHandoff, payload), [state, isHandoff, payload])

  // Final ability scores (base + racial static + racial choice + bumps),
  // shared by the Abilities review row.
  const sheet = useMemo(() => buildSheet(state, payload), [state, payload])

  // Resolve the chosen ancestry feat's NAME for display. Creator state holds
  // only the numeric feat id (e.g. "151"); Step 2 fetches the named feats per
  // race/subrace, so we re-fetch the same list here to show the name rather
  // than a bare id on the review.
  const [ancestryFeatName, setAncestryFeatName] = useState(null)
  useEffect(() => {
    const featId = state.ancestry_feat_id
    const listId = featId ? computeAncestryListId(state.race, state.subrace) : null
    if (!listId) { setAncestryFeatName(null); return }
    let cancelled = false
    fetch(`/api/progression/ancestry-feats/${listId}?tier=1`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (cancelled) return
        const f = (Array.isArray(data) ? data : []).find(x => String(x.id) === String(featId))
        setAncestryFeatName(f?.name || null)
      })
      .catch(() => { if (!cancelled) setAncestryFeatName(null) })
    return () => { cancelled = true }
  }, [state.ancestry_feat_id, state.race, state.subrace])

  const submit = async () => {
    if (!validation.valid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSubmit()
    } catch (err) {
      setSubmitError(err.message || 'Submit failed.')
      setSubmitting(false)
    }
  }

  const rows = buildReviewRows(state, payload, sheet, ancestryFeatName)

  return (
    <>
      <WizardHead
        stepNum={8}
        title="Everything you've chosen."
        subtitle="Read it back. Change anything that isn't true yet. Commit when it is."
        mode={mode}
      />

      {/* Handoff callout — single in-fiction line, above the review list */}
      {isHandoff && (
        <div className="lock-cele" style={{ textAlign: 'center', marginBottom: 22 }}>
          <p className="lc-note" style={{ fontSize: '17px', margin: 0 }}>
            The years that shaped you are behind you now. Step forward.
          </p>
        </div>
      )}

      {/* Review rows — one per creator section, with per-row Edit jump */}
      <div className="rv-list">
        {rows.map(r => (
          <div className="rv-row" key={r.step}>
            <span className="rvk">{r.label}</span>
            <div className="rvv">
              <div className="pri">{r.primary}</div>
              {r.secondary && <div className="sec">{r.secondary}</div>}
              {r.body}
            </div>
            <button type="button" className="rv-edit" onClick={() => onJump(r.step - 1)}>
              Edit
            </button>
          </div>
        ))}
      </div>

      {/* Validation warnings — what's still owed before stepping forward */}
      {!validation.valid && (
        <div className="lock-cele" style={{ marginTop: 18 }}>
          <div className="lc-top">
            <span className="lc-fleuron">❦</span>
            <span className="lc-marker">Before you can step forward</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {validation.errors.map((e, i) => (
              <li key={i} className="lc-note" style={{ marginBottom: 6 }}>
                {e.message}
                {e.step && (
                  <button
                    type="button"
                    onClick={() => onJump(e.step - 1)}
                    className="rv-edit"
                    style={{ marginLeft: 10, padding: '3px 9px', fontSize: '10px' }}
                  >
                    Edit Step {e.step}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {submitError && (
        <div
          className="trait-card"
          style={{
            marginTop: 16,
            display: 'block',
            borderColor: 'var(--bad)',
            color: 'var(--bad)',
            fontFamily: 'var(--serif)',
            fontSize: '15px'
          }}
        >
          Couldn't submit: {submitError}
        </div>
      )}

      {/* Commit card — in-fiction one-liner + primary CTA. Also mirrored in
          WizardFoot, but this gives Step 8 a clear bottom-of-page surface. */}
      <div className="commit">
        <p className="ce">{commitLine(state, payload)}</p>
        <button
          type="button"
          className="btn primary lg"
          onClick={submit}
          disabled={!validation.valid || submitting}
        >
          <svg className="ic"><use href="#i-feather" /></svg>
          {submitting
            ? 'Stepping forward…'
            : isHandoff
              ? 'Step into the world'
              : 'Bring them to life'}
        </button>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Review-row assembly — wires the design's .rv-row shape to real state.
// ---------------------------------------------------------------------------

/**
 * Compute the final ability scores + load-bearing derived bits the
 * Abilities review row needs (base + racial static + racial choice +
 * accepted stat bumps, capped at 18 — same math as the old preview card).
 */
function buildSheet(state, payload) {
  const raceData = racesData[state.race]
  const subraceData = (raceData?.subraces || []).find(s => s.name === state.subrace)
  const finalScores = {}
  for (const k of ABILITY_KEYS) {
    const base = state.base_scores?.[k] ?? null
    if (base == null) {
      finalScores[k] = null
      continue
    }
    const racialStatic = (raceData?.abilityScoreIncrease?.[k] ?? 0) +
                         (subraceData?.abilityScoreIncrease?.[k] ?? 0)
    const racialChoice = (state.racial_choice_picks || []).filter(p => p === k).length
    const bumpTotal = (state.bump_assignments || []).reduce((sum, stat, i) => {
      if (stat !== k) return sum
      const b = (payload?.accepted_stat_bumps || [])[i]
      return sum + (b?.magnitude || 1)
    }, 0)
    finalScores[k] = Math.min(18, base + racialStatic + racialChoice + bumpTotal)
  }
  return { finalScores }
}

/**
 * Build the seven review rows from the component's real state — Identity,
 * Ancestry, Theme, Class, Abilities, Equipment, Details — each as
 * { step, label, primary, secondary }. Mirrors the design's row order and
 * the old SummaryList's section mapping; surfaces the real equivalent of
 * the mockup's sample secondary lines (never the mockup's hardcoded data).
 */
function buildReviewRows(state, payload, sheet, ancestryFeatName) {
  const cls = classesData[state.class_id]
  const raceData = racesData[state.race]
  const i = state.identity || {}
  const themeId = state.theme_id || payload?.committed_theme

  // Identity
  const fullName = [state.first_name, state.last_name].filter(Boolean).join(' ').trim()
  const identityPri = fullName
    ? <>{fullName}{state.nickname && <span style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}> "{state.nickname}"</span>}</>
    : <Quiet>Not yet named</Quiet>

  // Ancestry — subrace + race, plus the chosen ancestry feat.
  const raceLabel = state.subrace
    ? `${state.subrace}${raceData?.name && !state.subrace.includes(raceData.name) ? ` ${raceData.name}` : ''}`.trim()
    : (raceData?.name || (state.race && prettifyId(state.race)))
  const ancestrySec = state.ancestry_feat_id
    ? (ancestryFeatName ? `Ancestry feat: ${ancestryFeatName}` : 'Ancestry feat selected')
    : null

  // Theme
  const themePri = themeId ? prettifyId(themeId) : null

  // Class & Calling
  const classSegs = [
    cls?.name || (state.class_id && prettifyId(state.class_id)),
    state.subclass_id && prettifyId(state.subclass_id),
    'Level 1'
  ].filter(Boolean)
  const classSec = joinDot([
    state.fighting_style && `Fighting style: ${prettifyId(state.fighting_style)}`
  ])

  // Abilities — final scores with star / dump markers, plus skills.
  const abilityPri = ABILITY_KEYS.every(k => sheet.finalScores[k] == null)
    ? <Quiet>Not yet assigned</Quiet>
    : <Sep parts={ABILITY_KEYS.map(k => `${ABILITY_LABELS[k]} ${sheet.finalScores[k] ?? '—'}`)} />
  const skills = state.selected_skills || []
  const abilitySec = skills.length ? `Skills: ${skills.join(' · ')}` : null

  // Equipment — package choices + heirloom.
  const picks = state.equipment_picks || {}
  const subpicks = state.equipment_subpicks || {}
  const equipItems = Object.entries(picks)
    .filter(([, label]) => label)
    .map(([idx, label]) => subpicks[idx] || label)
  const heirloom = state.heirloom?.name
  const equipPri = (equipItems.length || heirloom)
    ? <Sep parts={[...equipItems, heirloom && `Heirloom: ${heirloom}`].filter(Boolean)} />
    : <Quiet>Not yet picked</Quiet>

  // Details — the full Step-7 record: alignment, faith, lifestyle, every
  // physical field, the four expansion prompts, and each backstory hook
  // (resolved to its text). A review should show every choice so the player
  // can catch anything that isn't true yet.
  const alignName = ALIGNMENT_NAMES[i.alignment] || null
  const faithName = (!i.faith || i.faith === '_none')
    ? (i.faith === '_none' ? 'None / Unaligned' : null)
    : (deitiesData[i.faith]?.name || prettifyId(i.faith))
  const appearance = [
    i.age && `Age ${i.age}`,
    i.height, i.weight,
    i.eye_color && `${i.eye_color} eyes`,
    i.hair_color && `${i.hair_color} hair`,
    i.skin_color && `${i.skin_color} skin`,
    i.build,
    i.distinguishing_features
  ].filter(Boolean).join(' · ')
  const personality = (state.expansions?.personality?.value || '').trim()
  const idealValue = (state.expansions?.ideals?.value || '').trim()
  const bonds = (state.expansions?.bonds?.value || '').trim()
  const flaws = (state.expansions?.flaws?.value || '').trim()
  const momentList = themeId ? (THEME_BACKSTORY_MOMENTS[themeId] || []) : []
  const customMoments = state.expansions?.backstory?.custom_moments || []
  const hooks = (state.expansions?.backstory?.picked_keys || [])
    .map(key => {
      const [kind, idxStr] = String(key).split(':')
      const idx = parseInt(idxStr, 10)
      if (kind === 'curated') return momentList[idx]
      if (kind === 'custom') return customMoments[idx]
      return null
    })
    .filter(Boolean)
  const hasDetail = faithName || i.lifestyle || appearance || personality || idealValue || bonds || flaws || hooks.length
  const detailBody = hasDetail ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 8 }}>
      {faithName && <ReviewField label="Faith" value={faithName} />}
      {i.lifestyle && <ReviewField label="Lifestyle" value={prettifyId(i.lifestyle)} />}
      {appearance && <ReviewField label="Appearance" value={appearance} />}
      {personality && <ReviewField label="Personality" value={personality} />}
      {idealValue && <ReviewField label="Ideals" value={idealValue} />}
      {bonds && <ReviewField label="Bonds" value={bonds} />}
      {flaws && <ReviewField label="Flaws" value={flaws} />}
      {hooks.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', flexShrink: 0, minWidth: 84 }}>Backstory</span>
          <ul style={{ margin: 0, paddingLeft: 18, fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)' }}>
            {hooks.map((h, idx) => <li key={idx}>{h}</li>)}
          </ul>
        </div>
      )}
    </div>
  ) : null

  return [
    {
      step: 1,
      label: 'Identity',
      primary: identityPri,
      secondary: joinDot([state.gender])
    },
    {
      step: 2,
      label: 'Ancestry',
      primary: raceLabel || <Quiet>Not yet chosen</Quiet>,
      secondary: ancestrySec
    },
    {
      step: 3,
      label: 'Theme',
      primary: themePri || <Quiet>Not yet chosen</Quiet>,
      secondary: null
    },
    {
      step: 4,
      label: 'Class',
      primary: classSegs.length ? <Sep parts={classSegs} /> : <Quiet>Not yet chosen</Quiet>,
      secondary: classSec
    },
    {
      step: 5,
      label: 'Abilities',
      primary: abilityPri,
      secondary: abilitySec
    },
    {
      step: 6,
      label: 'Equipment',
      primary: equipPri,
      secondary: null
    },
    {
      step: 7,
      label: 'Details',
      primary: alignName || <Quiet>Not yet filled</Quiet>,
      secondary: null,
      body: detailBody
    }
  ]
}

/** Render an array of parts joined by the design's `.sep` middot. */
function Sep({ parts }) {
  return (
    <>
      {parts.map((p, idx) => (
        <span key={idx}>
          {p}
          {idx < parts.length - 1 && <span className="sep">·</span>}
        </span>
      ))}
    </>
  )
}

/** Join truthy strings with " · " into a plain string (null if empty). */
function joinDot(parts) {
  const out = parts.filter(Boolean).join(' · ')
  return out || null
}

function Quiet({ children }) {
  return <span style={{ color: 'var(--ink-4)', fontStyle: 'italic' }}>{children}</span>
}

/** One labeled field in the expanded Details review (label · value). */
function ReviewField({ label, value }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: 'var(--mono)', fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-4)', flexShrink: 0, minWidth: 84 }}>{label}</span>
      <span style={{ fontFamily: 'var(--serif)', fontSize: 14.5, lineHeight: 1.5, color: 'var(--ink-2)' }}>{value}</span>
    </div>
  )
}

/**
 * One-line in-fiction summary for the commit card — assembled from the
 * real character (name · ancestry · theme · class), with the heirloom
 * folded in when present. Falls back gracefully when fields are missing.
 */
function commitLine(state, payload) {
  const raceData = racesData[state.race]
  const cls = classesData[state.class_id]
  const themeId = state.theme_id || payload?.committed_theme
  const name = [state.first_name, state.last_name].filter(Boolean).join(' ').trim() || 'This one'
  const raceWord = (state.subrace || raceData?.name || (state.race && prettifyId(state.race)) || '')
    .toLowerCase()
  const themeWord = themeId ? prettifyId(themeId) : null
  const classWord = cls?.name || (state.class_id && prettifyId(state.class_id)) || null
  const heirloom = state.heirloom?.name

  const clause = [
    raceWord && classWord ? `a ${raceWord} ${classWord.toLowerCase()}` : (classWord ? `a ${classWord.toLowerCase()}` : raceWord && `a ${raceWord}`),
    themeWord && `shaped by ${themeWord}`,
    heirloom && `who carries ${heirloom.toLowerCase()}`
  ].filter(Boolean).join(', ')

  return clause
    ? `${name} — ${clause}. Ready to step into the world.`
    : `${name} is ready to step into the world.`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function prettifyId(id) {
  return String(id || '').split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Validate every required field across Steps 1–7 per spec §5.8.7.
 * Returns { valid, errors: [{ step, message }] }.
 */
function validateForSubmit(state, isHandoff, payload) {
  const errors = []

  // Step 1
  if (!(state.first_name || '').trim()) errors.push({ step: 1, message: 'First name is required.' })
  if (!state.gender) errors.push({ step: 1, message: 'Gender is required.' })

  // Step 2
  if (!state.race) errors.push({ step: 2, message: 'Race is required.' })
  if (!state.ancestry_feat_id) errors.push({ step: 2, message: 'Ancestry feat is required.' })

  // Step 3
  if (!state.theme_id) errors.push({ step: 3, message: 'Theme is required.' })

  // Step 4
  if (!state.class_id) errors.push({ step: 4, message: 'Class is required.' })

  // Step 5
  const allAssigned = ABILITY_KEYS.every(k => state.base_scores?.[k] != null)
  if (!allAssigned) errors.push({ step: 5, message: 'All six ability scores must be assigned.' })

  // Step 6
  const cls = classesData[state.class_id]
  const choiceCount = cls?.startingEquipment?.choices?.length || 0
  const pickCount = Object.values(state.equipment_picks || {}).filter(Boolean).length
  if (choiceCount > 0 && pickCount < choiceCount) {
    errors.push({ step: 6, message: `Equipment: pick all ${choiceCount} package choices (${pickCount}/${choiceCount} picked).` })
  }

  // Step 7
  const i = state.identity || {}
  if (!i.alignment) errors.push({ step: 7, message: 'Alignment is required.' })
  if (!i.faith) errors.push({ step: 7, message: 'Faith is required (pick "None / Unaligned" if no faith).' })
  if (!i.lifestyle) errors.push({ step: 7, message: 'Lifestyle is required.' })
  // distinguishing_features is intentionally optional — not every character
  // has scars or visible markings, and forcing the field invites filler.
  for (const [field, label] of [
    ['age', 'Age'], ['height', 'Height'], ['weight', 'Weight'],
    ['eye_color', 'Eyes'], ['hair_color', 'Hair'], ['skin_color', 'Skin'],
    ['build', 'Build']
  ]) {
    if (!(i[field] || '').toString().trim()) {
      errors.push({ step: 7, message: `Physical description: ${label} is required.` })
    }
  }

  return { valid: errors.length === 0, errors }
}
