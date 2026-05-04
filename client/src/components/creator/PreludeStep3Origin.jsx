import { Field, WizardHead } from './creatorPrimitives.jsx'
import { BIRTH_CIRCUMSTANCES, HOME_SETTINGS, REGIONS } from '../../data/preludeSetup.js'

/**
 * Prelude Wizard Step 3 — Origin. Per the structural-redesign spec
 * (PM 2026-05-03): birth circumstance, home setting, region — all three
 * preserved verbatim from the legacy 11-question wizard.
 *
 * Each field follows the same pattern Step 2 established (signed off in
 * v1.0.130 sub-checkpoint #2): curated dropdown → description in italic
 * `.help` text below the dropdown after a value is picked → free-text
 * override input below the description for "or write your own".
 *
 * Server-side `preludeService.js::buildPayload` resolves each field via
 * `resolved(curated, otherKey)` — the override wins when populated;
 * otherwise the dropdown value. Step-advance validation (in
 * PreludeCreatorV2) mirrors that: the field counts as filled when
 * EITHER the dropdown OR the override has a value.
 *
 * Single-mode component (no handoff fork — prelude is the entry path
 * INTO a character, not a resume from one).
 */
export default function PreludeStep3Origin({ state, set }) {
  return (
    <>
      <WizardHead
        stepNum={3}
        title="Origin"
        subtitle="The world you came from. Where in it you started, what shaped your earliest years, and the wider region those years played out in."
        totalSteps={6}
        eyebrowLabel="Prelude Setup"
      />

      <div className="card">
        <CuratedFieldWithOverride
          label="Birth circumstance"
          options={BIRTH_CIRCUMSTANCES}
          curatedValue={state.birth_circumstance}
          overrideValue={state.birth_circumstance_other}
          onCurated={v => set({ ...state, birth_circumstance: v })}
          onOverride={v => set({ ...state, birth_circumstance_other: v })}
          curatedPlaceholder="Choose a circumstance…"
        />

        <CuratedFieldWithOverride
          label="Home setting"
          options={HOME_SETTINGS}
          curatedValue={state.home_setting}
          overrideValue={state.home_setting_other}
          onCurated={v => set({ ...state, home_setting: v })}
          onOverride={v => set({ ...state, home_setting_other: v })}
          curatedPlaceholder="Choose a setting…"
        />

        <CuratedFieldWithOverride
          label="Region"
          options={REGIONS}
          curatedValue={state.region}
          overrideValue={state.region_other}
          onCurated={v => set({ ...state, region: v })}
          onOverride={v => set({ ...state, region_other: v })}
          curatedPlaceholder="Choose a region…"
        />
      </div>
    </>
  )
}

/**
 * Step 3's repeated field pattern: dropdown + description-below-on-pick
 * + free-text override. Three of these stack inside Step 3's card; the
 * shape is identical except for label / data source.
 *
 * The override input shows immediately ("Or write your own…") rather
 * than gated behind a toggle — matches the legacy wizard's affordance.
 * If both fields have content, the server's resolved() helper picks the
 * override.
 */
function CuratedFieldWithOverride({
  label,
  options,
  curatedValue,
  overrideValue,
  onCurated,
  onOverride,
  curatedPlaceholder
}) {
  const picked = curatedValue ? options.find(o => o.value === curatedValue) : null

  return (
    <Field label={label}>
      <select
        className="select"
        value={curatedValue || ''}
        onChange={e => onCurated(e.target.value)}
      >
        <option value="">{curatedPlaceholder}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {picked?.description && (
        <p className="help" style={{ marginTop: 14 }}>
          {picked.description}
        </p>
      )}
      <input
        type="text"
        className="input"
        value={overrideValue || ''}
        onChange={e => onOverride(e.target.value)}
        placeholder="Or write your own (overrides dropdown)"
        style={{ marginTop: 14 }}
      />
    </Field>
  )
}
