import { Field, WizardHead } from './creatorPrimitives.jsx'
import RaceAwareDimensionPicker from './RaceAwareDimensionPicker.jsx'
import RaceAwareColorPicker from './RaceAwareColorPicker.jsx'

const ORIGIN_FREEFORM_MAX = 2000

/**
 * Prelude Wizard Step 5 — Appearance + "Anything else?". Per the
 * structural-redesign spec rev 2 (PM 2026-05-03):
 *
 *   - Port the appearance fields from the primary creator's Step 7
 *     wholesale (eyes / hair / skin / build / height / weight). Same
 *     primitives, same race-derived dropdowns, same Custom… affordance.
 *   - Append the "Anything else?" free-text question from the legacy
 *     11-question wizard (Q10) as the second half of the step. 2000-char
 *     cap; optional.
 *
 * One of three intentional content changes from the legacy 11-question
 * wizard. The legacy wizard had no appearance section at all; this is
 * net-new content for the prelude entry path. PM accepted that the
 * appearance choices feed the arc generator's new APPEARANCE prompt
 * section (see preludeArcService.js — to be wired alongside the
 * structural redesign cutover, per memory entry).
 *
 * Age intentionally NOT included — starting age is race-derived
 * server-side per `preludeService.js::computeStartingAge` (humans 6,
 * elves 30, dwarves 18, warforged 1, etc.). The legacy wizard removed
 * its age field in v1.0.43 for the same reason; the prelude character
 * begins as a child whose age is set by their race, not picked.
 *
 * All appearance fields are OPTIONAL — the prelude character is a
 * child whose appearance changes across the arc. Players who care can
 * fill it; players who don't get a clean fallback (the picker's "no
 * race" branch shows a text input). Origin free-text also optional
 * (matches the legacy wizard's Q10 behavior).
 *
 * Single-mode component (no handoff fork).
 *
 * Visual layout: 3-column grid with the six fields in two rows of three,
 * mirroring the primary creator's Step 7 physical-description grid. The
 * race-derived ranges in `raceDemographics.js` / `raceColorTraits.js`
 * are calibrated for ADULT characters; the player can always use Custom…
 * for child-appropriate values when the prelude calls for it. Future
 * design iteration could split into "as a child" vs "as an adult" pickers
 * — parking-lot consideration, not in scope here.
 */
export default function PreludeStep5Appearance({ state, set }) {
  const appearance = state.appearance || {}
  const raceId = state.race || ''
  const originLength = (state.origin_freeform || '').length

  const updateAppearance = (patch) => {
    set({ ...state, appearance: { ...appearance, ...patch } })
  }

  return (
    <>
      <WizardHead
        stepNum={5}
        title="Appearance"
        subtitle="What you look like as a child, and anything else about your origin you want the Prelude DM to honor. Both halves are optional — your character can emerge through play."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

      {/* Appearance grid */}
      <div className="card">
        <Field
          label="Physical description"
          help="All optional. Race-derived ranges default to adult values; use Custom… for child-appropriate values where it matters."
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 18
          }}>
            <PhysicalCell label="Eyes">
              <RaceAwareColorPicker
                field="eyes"
                raceId={raceId}
                value={appearance.eye_color || ''}
                onChange={v => updateAppearance({ eye_color: v })}
              />
            </PhysicalCell>
            <PhysicalCell label="Hair">
              <RaceAwareColorPicker
                field="hair"
                raceId={raceId}
                value={appearance.hair_color || ''}
                onChange={v => updateAppearance({ hair_color: v })}
              />
            </PhysicalCell>
            <PhysicalCell label="Skin">
              <RaceAwareColorPicker
                field="skin"
                raceId={raceId}
                value={appearance.skin_color || ''}
                onChange={v => updateAppearance({ skin_color: v })}
              />
            </PhysicalCell>
            <PhysicalCell label="Build">
              <RaceAwareColorPicker
                field="build"
                raceId={raceId}
                value={appearance.build || ''}
                onChange={v => updateAppearance({ build: v })}
              />
            </PhysicalCell>
            <PhysicalCell label="Height">
              <RaceAwareDimensionPicker
                field="height"
                raceId={raceId}
                value={appearance.height || ''}
                onChange={v => updateAppearance({ height: v })}
              />
            </PhysicalCell>
            <PhysicalCell label="Weight">
              <RaceAwareDimensionPicker
                field="weight"
                raceId={raceId}
                value={appearance.weight || ''}
                onChange={v => updateAppearance({ weight: v })}
              />
            </PhysicalCell>
          </div>
        </Field>
      </div>

      {/* Anything else? — Q10 from the legacy wizard */}
      <div className="card" style={{ marginTop: 18 }}>
        <Field
          label="Anything else? (optional)"
          help="If you have a specific origin in mind, write it here. The DM will honor it. Leave blank if you don't — your character will emerge through play."
        >
          <textarea
            className="textarea"
            value={state.origin_freeform || ''}
            onChange={e => set({ ...state, origin_freeform: e.target.value })}
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
    </>
  )
}

/**
 * Cell wrapper for the physical-description grid. Mirrors the primary
 * creator's RaceAwarePhysicalField / RaceAwareColorField wrapper
 * pattern: small label-on-top + the picker child, no field-level help
 * text (cell labels are unambiguous on their own).
 */
function PhysicalCell({ label, children }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="label">{label}</div>
      {children}
    </div>
  )
}

export { ORIGIN_FREEFORM_MAX }
