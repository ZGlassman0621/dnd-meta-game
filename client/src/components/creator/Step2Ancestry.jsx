import { useState, useEffect, useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'

/**
 * Map (race, subrace) → ancestry-feat list_id used by /api/progression/ancestry-feats.
 * Most races map directly (with hyphens → underscores), but two cases are
 * special: Aasimar splits into protector/scourge/fallen by subrace, and
 * Drow lives at the top level (not nested under elf). Mirrors the helper
 * that already shipped in the legacy CharacterCreationWizard.
 *
 * Returns '' when the player hasn't picked enough to disambiguate yet
 * (e.g., race='aasimar' with no subrace) — caller should skip the fetch.
 */
function computeAncestryListId(race, subrace) {
  if (!race) return ''
  const lowerSub = (subrace || '').toLowerCase()
  if (race === 'elf' && (lowerSub.includes('drow') || lowerSub.includes('dark elf'))) return 'drow'
  if (race === 'aasimar') {
    if (lowerSub.includes('protector')) return 'aasimar_protector'
    if (lowerSub.includes('scourge')) return 'aasimar_scourge'
    if (lowerSub.includes('fallen')) return 'aasimar_fallen'
    return '' // Aasimar requires a subrace to know which list to fetch
  }
  return race.replace(/-/g, '_')
}

/**
 * Trim a long lore description down to a single editorial line for the
 * `.opt .od` slot in the Hearth option grid. The design shows a short
 * one-liner per card; our race/subrace copy can run several sentences,
 * so we keep the first sentence (or a soft length cap).
 */
function shortDesc(text) {
  if (!text) return ''
  const firstSentence = String(text).split(/(?<=[.!?])\s/)[0]
  if (firstSentence.length <= 96) return firstSentence
  return firstSentence.slice(0, 93).trimEnd() + '…'
}

/**
 * Step 2 — Ancestry. Per PHASE_2_CREATOR_SPEC.md §5.2.
 *
 * Race + subrace + ancestry feat selectors. All three required to advance.
 */
export default function Step2Ancestry({ state, set, mode, payload }) {
  const raceId = state.race || ''
  const subrace = state.subrace || ''
  const featId = state.ancestry_feat_id || ''

  const raceList = useMemo(
    () => Object.entries(racesData).map(([id, r]) => ({
      id,
      name: r.name,
      description: r.description,
      subraces: r.subraces || []
    })),
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
    // Aasimar requires a subrace to know which path-specific list to fetch
    // (aasimar_protector / _scourge / _fallen). Skip the fetch until the
    // player picks one — otherwise we'd hit /aasimar (no rows) and the
    // dropdown would render empty with no signal to the player.
    const listId = computeAncestryListId(raceId, subrace)
    if (!listId) { setFeats([]); return }
    let cancelled = false
    setFeatsLoading(true)
    fetch(`/api/progression/ancestry-feats/${listId}?tier=1`)
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
  }, [raceId, subrace])

  const featById = useMemo(() => Object.fromEntries(feats.map(f => [f.id, f])), [feats])
  const selectedFeat = featId ? featById[featId] : null

  const featListReady = !!computeAncestryListId(raceId, subrace)

  return (
    <>
      {/* Local icon sprite (symbols copied from the design's <defs>) — the
          creator shell only mounts arrow symbols, so the trait-card icons
          this step uses are declared here rather than edited into a shared
          sprite. */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
        <symbol id="i-sprout" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M12 20c0-7 0-9 0-12" /><path d="M12 11C9 11 6 9 6 5c4 0 6 2 6 6z" /><path d="M12 9c0-3 2-5 6-5 0 4-3 5-6 5z" /></symbol>
        <symbol id="i-leaf" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z" /><path d="M2 21c0-3 1.85-5.36 5.08-6" /></symbol>
        <symbol id="i-sparkles" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.6 4.8L18 9l-4.4 1.2L12 15l-1.6-4.8L6 9l4.4-1.2z" /></symbol>
      </defs></svg>

      <WizardHead
        stepNum={2}
        title="The lineage you carry."
        subtitle="The people you came from — and the gift their blood gave you."
        mode={mode}
      />

      {/* Live render: race + subrace + ancestry-feat choosers. */}
      <div className="block">
            <div className="block-label">
              <span className="l">Ancestry</span>
              <span className="hint">your species and heritage</span>
            </div>
            <div className="opt-grid c3" role="radiogroup" aria-label="Ancestry">
              {raceList.map(r => {
                const sel = r.id === raceId
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`opt ${sel ? 'sel' : ''}`.trim()}
                    role="radio"
                    aria-checked={sel}
                    onClick={() => set({ ...state, race: r.id, subrace: '', ancestry_feat_id: null })}
                  >
                    <div className="ot">{r.name}</div>
                    {r.description && <div className="od">{shortDesc(r.description)}</div>}
                  </button>
                )
              })}
            </div>
            <div className="fhelp" style={{ marginTop: 10 }}>
              This shapes your starting traits, languages, and the heritage gift you carry from your lineage.
            </div>
          </div>

          {subraces.length > 0 && (
            <div className="reveal subrow block">
              <div className="block-label">
                <span className="l">Lineage · {currentRace.name}</span>
                <span className="hint">the branch of the family</span>
              </div>
              <div className="opt-grid c3" role="radiogroup" aria-label="Lineage">
                {subraces.map(s => {
                  const sel = s.name === subrace
                  return (
                    <button
                      key={s.name}
                      type="button"
                      className={`opt ${sel ? 'sel' : ''}`.trim()}
                      role="radio"
                      aria-checked={sel}
                      onClick={() => set({ ...state, subrace: s.name, ancestry_feat_id: null })}
                    >
                      <div className="ot">{s.name}</div>
                      {s.description && <div className="od">{shortDesc(s.description)}</div>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="block" style={{ marginBottom: 0 }}>
            <div className="block-label">
              <span className="l">Heritage gift</span>
              <span className="hint">a small advantage carried in the blood</span>
            </div>

            {!raceId ? (
              <div className="fhelp" style={{ marginTop: 0 }}>Pick an ancestry first…</div>
            ) : (raceId === 'aasimar' && !subrace) ? (
              <div className="fhelp" style={{ marginTop: 0 }}>Pick a lineage first…</div>
            ) : featsLoading ? (
              <div className="fhelp" style={{ marginTop: 0 }}>Loading heritage gifts…</div>
            ) : feats.length === 0 ? (
              <div className="fhelp" style={{ marginTop: 0 }}>No heritage gifts available for this lineage.</div>
            ) : (
              <>
                <div className="opt-grid c2" role="radiogroup" aria-label="Heritage gift">
                  {feats.map(f => {
                    const sel = String(f.id) === String(featId)
                    return (
                      <button
                        key={f.id}
                        type="button"
                        className={`opt ${sel ? 'sel' : ''}`.trim()}
                        role="radio"
                        aria-checked={sel}
                        disabled={!featListReady}
                        onClick={() => set({ ...state, ancestry_feat_id: f.id })}
                      >
                        <div className="ot">{f.feat_name}</div>
                        {(f.description || f.desc) && (
                          <div className="od">{shortDesc(f.description || f.desc)}</div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {selectedFeat && (selectedFeat.description || selectedFeat.desc) && (
                  <div className="reveal">
                    <div className="trait-card">
                      <span className="ti"><svg className="ic"><use href="#i-sparkles" /></svg></span>
                      <div>
                        <div className="tt">
                          {selectedFeat.feat_name}
                          <span className="src">Heritage gift</span>
                        </div>
                        <div className="td">{selectedFeat.description || selectedFeat.desc}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
    </>
  )
}
