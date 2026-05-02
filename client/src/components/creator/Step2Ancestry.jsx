import { useState, useEffect, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import CelebrationCard from './CelebrationCard.jsx'
import racesData from '../../data/races.json'

/**
 * Render a feat-id slug as a humanized fallback when the API lookup
 * fails (e.g., production [ANCESTRY_HINT] slug `human_t1_c1` doesn't
 * resolve against DB autoincrement IDs returned by the feats API).
 * Real handoff payloads should include `ancestry_feat_name` from the
 * transition service; this is the last-line fallback for raw IDs.
 */
function prettifyFeatId(id) {
  if (!id) return ''
  return String(id).split(/[_-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Step 2 — Ancestry. Per PHASE_2_CREATOR_SPEC.md §5.2.
 *
 * Manual mode: race + subrace + ancestry feat selectors. All three
 * required to advance.
 *
 * Handoff mode: race + subrace + ancestry feat are all locked-with-
 * celebration. The celebration card sits above the locked fields and
 * names the chapter beats from `[ANCESTRY_HINT].reason` markers (top
 * 2-3 weighted, ordered chronologically). Sub-choices within the feat
 * remain editable per Phase 1 Decision α.
 */
export default function Step2Ancestry({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  // In handoff mode, race / subrace / feat come from the payload and are
  // not user-editable here. We still mirror them into state so Step 8 +
  // submit-time persistence can read them from a single place.
  useEffect(() => {
    if (!isHandoff) return
    const updates = {}
    if (payload?.race && state.race !== payload.race) updates.race = payload.race
    if (payload?.subrace && state.subrace !== payload.subrace) updates.subrace = payload.subrace
    if (payload?.ancestry_feat_id && state.ancestry_feat_id !== payload.ancestry_feat_id) {
      updates.ancestry_feat_id = payload.ancestry_feat_id
    }
    if (Object.keys(updates).length > 0) set({ ...state, ...updates })
  }, [isHandoff, payload?.race, payload?.subrace, payload?.ancestry_feat_id])

  const raceId = state.race || (isHandoff ? payload?.race : '')
  const subrace = state.subrace || (isHandoff ? payload?.subrace : '')
  const featId = state.ancestry_feat_id || (isHandoff ? payload?.ancestry_feat_id : '')

  const raceList = useMemo(
    () => Object.entries(racesData).map(([id, r]) => ({ id, name: r.name, subraces: r.subraces || [] })),
    []
  )
  const currentRace = useMemo(() => racesData[raceId], [raceId])
  const subraces = currentRace?.subraces || []

  // Fetch ancestry feats for the current race when known. Falls back to
  // empty if the API isn't reachable — in that case the picker shows
  // "Loading…" until data arrives, but the rest of the step still
  // renders so handoff mode can show the celebration card.
  const [feats, setFeats] = useState([])
  const [featsLoading, setFeatsLoading] = useState(false)

  useEffect(() => {
    if (!raceId) { setFeats([]); return }
    let cancelled = false
    setFeatsLoading(true)
    // Race ids in races.json use hyphens (half-elf); the ancestry-feats
    // endpoint accepts either form per the seed data.
    const apiRace = raceId.replace(/-/g, '_')
    fetch(`/api/progression/ancestry-feats/${apiRace}?tier=1`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        if (cancelled) return
        setFeats(Array.isArray(data) ? data : [])
        setFeatsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setFeats([])
        setFeatsLoading(false)
      })
    return () => { cancelled = true }
  }, [raceId])

  const featById = useMemo(() => Object.fromEntries(feats.map(f => [f.id, f])), [feats])
  const selectedFeat = featId ? featById[featId] : null

  const ancestryBeats = payload?.ancestry_chapter_beats || []
  // Render the locked outcome: "Variant Human" / "Half-Elf (Drow Descent)" / "Dwarf"
  const outcomeText = useMemo(() => {
    const r = racesData[raceId]
    if (!r) return ''
    if (subrace) return `${subrace.includes(r.name) ? subrace : `${subrace} ${r.name}`}`.trim()
    return r.name
  }, [raceId, subrace])

  return (
    <>
      <WizardHead
        stepNum={2}
        title="Ancestry"
        subtitle="The lineage you carry, and the gift it gave you."
        mode={mode}
      />

      {isHandoff && ancestryBeats.length > 0 && (
        <CelebrationCard
          opening="These moments named your heritage gift:"
          beats={ancestryBeats}
          outcomePrefix="Your heritage gift:"
          outcomeBold={selectedFeat?.feat_name || payload?.ancestry_feat_name || prettifyFeatId(featId)}
          outcomeSuffix={
            (selectedFeat?.description || payload?.ancestry_feat_description)
              ? ` — ${selectedFeat?.description || payload?.ancestry_feat_description}`
              : '.'
          }
        >
          {/* Race line lives BELOW the beats as a quiet confirmation,
              since race was committed at setup-wizard time and the
              beats actually justify the FEAT, not the race. */}
          <div style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: '1px dashed var(--rule)',
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 16,
            color: 'var(--ink-3)'
          }}>
            You are <strong style={{ fontStyle: 'normal', color: 'var(--ink-2)', fontWeight: 600 }}>
              {outcomeText || currentRace?.name || ''}
            </strong> — committed when you set out.
          </div>
        </CelebrationCard>
      )}

      <div className="card">
        <Field
          label="Race"
          help={isHandoff ? null : 'Your species and heritage. This shapes your starting traits, languages, and the heritage gift you carry from your lineage.'}
          locked={isHandoff}
          lockTag="From the setup wizard"
        >
          <select
            className="select"
            value={raceId}
            disabled={isHandoff}
            onChange={e => set({ ...state, race: e.target.value, subrace: '', ancestry_feat_id: null })}
          >
            <option value="">Choose a lineage…</option>
            {raceList.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>

        {subraces.length > 0 && (
          <Field
            label="Subrace"
            help={isHandoff ? null : `A subgroup within ${currentRace.name} — distinct upbringing, distinct gifts.`}
            locked={isHandoff}
          >
            <select
              className="select"
              value={subrace}
              disabled={isHandoff}
              onChange={e => set({ ...state, subrace: e.target.value })}
            >
              <option value="">Choose a subrace…</option>
              {subraces.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
          </Field>
        )}

        <Field
          label="Ancestry feat"
          help={
            isHandoff
              ? 'The Prelude committed this feat. Sub-choices below remain yours.'
              : 'A heritage gift — a small mechanical advantage that comes with your lineage. Choose one.'
          }
          locked={isHandoff}
        >
          {isHandoff ? (
            // Locked render: show the feat as text rather than as a
            // disabled dropdown that goes blank when the feats list
            // hasn't loaded or doesn't contain the locked id.
            <div className="pick locked" style={{ display: 'block', marginTop: 4 }}>
              <div className="name">
                {selectedFeat?.feat_name
                  || payload?.ancestry_feat_name
                  || (featsLoading ? 'Loading…' : prettifyFeatId(featId) || '—')}
              </div>
              {(selectedFeat?.description || payload?.ancestry_feat_description) && (
                <div className="sub" style={{
                  marginTop: 6,
                  textTransform: 'none',
                  letterSpacing: 0,
                  fontFamily: 'var(--serif)',
                  fontStyle: 'italic',
                  fontSize: 16,
                  color: 'var(--ink-2)'
                }}>
                  {selectedFeat?.description || payload?.ancestry_feat_description}
                </div>
              )}
            </div>
          ) : (
            <>
              <select
                className="select"
                value={featId}
                onChange={e => set({ ...state, ancestry_feat_id: e.target.value })}
              >
                <option value="">{featsLoading ? 'Loading…' : 'Choose a heritage gift…'}</option>
                {feats.map(f => (
                  <option key={f.id} value={f.id}>{f.feat_name}</option>
                ))}
              </select>
              {selectedFeat && (
                <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
                  {selectedFeat.description || selectedFeat.desc}
                </div>
              )}
            </>
          )}
        </Field>
      </div>
    </>
  )
}
