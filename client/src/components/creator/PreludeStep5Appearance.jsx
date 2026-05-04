import { Field, WizardHead } from './creatorPrimitives.jsx'
import RaceAwareColorPicker from './RaceAwareColorPicker.jsx'

const ORIGIN_FREEFORM_MAX = 2000

/**
 * Prelude Wizard Step 5 — Appearance + "Anything else?".
 *
 * Per the structural-redesign spec rev 2 (PM 2026-05-03), Step 5 was
 * specified as a wholesale port of the primary creator's Step 7
 * appearance fields (eyes / hair / skin / build / height / weight).
 * Sub-checkpoint #6 review (2026-05-03) caught the real-world issue:
 * the Prelude character is a CHILD across most of the arc, and adult-
 * range height/weight values would confuse the Sonnet narrator
 * ("a small child carefully tries to lift the practice sword" while
 * the character sheet says 6'0" 225lb). Spec amended: drop height +
 * weight; keep eyes / hair / skin / build only — those four are
 * stable across childhood and adulthood and the AI can narrate them
 * truthfully at any age.
 *
 * Age intentionally NOT included either — starting age is race-derived
 * server-side per `preludeService.js::computeStartingAge` (humans 6,
 * elves 30, dwarves 18, warforged 1, etc.). The legacy wizard removed
 * its age field in v1.0.43 for the same reason.
 *
 * All four appearance fields are OPTIONAL. Players who care can fill
 * them; players who don't get a clean fallback (the picker's "no race"
 * branch shows a text input). Origin free-text also optional (matches
 * the legacy wizard's Q10 behavior).
 *
 * Single-mode component (no handoff fork).
 *
 * Visual layout: 2-column grid with the four fields in two rows of two.
 * Each cell uses RaceAwareColorPicker which offers race-appropriate
 * defaults + a Custom… affordance per `raceColorTraits.js`.
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

      {/* Appearance grid — eyes / hair / skin / build. Height + weight
          intentionally excluded (the prelude character is a child across
          most of the arc; adult-range dimensions would confuse the
          narrator at age 5–8). The four kept here read truthfully at
          any age. */}
      <div className="card">
        <Field
          label="Physical description"
          help="All optional. The Prelude DM will weave whatever you set here into how others first see you — at any age you're played at."
        >
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
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
