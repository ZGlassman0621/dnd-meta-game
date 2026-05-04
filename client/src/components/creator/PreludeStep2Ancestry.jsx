import { useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import racesData from '../../data/races.json'

/**
 * Prelude Wizard Step 2 — Ancestry. Per the structural-redesign spec
 * (PM 2026-05-03): race + subrace, with descriptive copy pulled inline
 * from races.json.
 *
 * One of three intentional content changes from the legacy 11-question
 * wizard: Step 2 now surfaces races.<id>.description and
 * races.<id>.subraces[].description below the dropdown when a value is
 * picked. The legacy wizard also showed these descriptions; visually,
 * they read in the editorial `.help` italic style. The primary creator's
 * Step 2 (Step2Ancestry.jsx) does NOT show these descriptions — race
 * there is just a dropdown name — so this is a prelude-specific
 * surfacing, intentional per spec.
 *
 * Single-mode component (no handoff fork — prelude is the entry path
 * INTO a character, not a resume from one). Subrace field renders only
 * when the selected race has subraces.
 *
 * Race id keys are hyphenated in races.json ('half-elf', 'half-orc');
 * passed through as-is.
 */
export default function PreludeStep2Ancestry({ state, set }) {
  const raceData = state.race ? racesData[state.race] : null
  const subraces = raceData?.subraces || []
  const subraceData = useMemo(
    () => state.subrace ? subraces.find(s => s.name === state.subrace) : null,
    [subraces, state.subrace]
  )

  const raceList = useMemo(
    () => Object.entries(racesData).map(([id, r]) => ({ id, name: r.name })),
    []
  )

  return (
    <>
      <WizardHead
        stepNum={2}
        title="Ancestry"
        subtitle="The lineage you carry into childhood. Your race shapes who raised you, what your earliest world looked like, and what gifts the Prelude DM may weave naturally into your story."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

      <div className="card">
        <Field label="Race">
          <select
            className="select"
            value={state.race || ''}
            onChange={e => set({ ...state, race: e.target.value, subrace: '' })}
          >
            <option value="">Choose a lineage…</option>
            {raceList.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {raceData?.description && (
            <p className="help" style={{ marginTop: 14 }}>
              {raceData.description}
            </p>
          )}
        </Field>

        {subraces.length > 0 && (
          <Field
            label="Subrace"
            help={`A subgroup within ${raceData.name} — distinct upbringing, distinct gifts.`}
          >
            <select
              className="select"
              value={state.subrace || ''}
              onChange={e => set({ ...state, subrace: e.target.value })}
            >
              <option value="">Choose a subrace…</option>
              {subraces.map(s => (
                <option key={s.name} value={s.name}>{s.name}</option>
              ))}
            </select>
            {subraceData?.description && (
              <p className="help" style={{ marginTop: 14 }}>
                {subraceData.description}
              </p>
            )}
          </Field>
        )}
      </div>
    </>
  )
}
