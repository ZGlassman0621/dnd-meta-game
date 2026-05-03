import { useEffect, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import AlignmentChip, { ALIGNMENT_NAMES, ALIGNMENT_DESCRIPTIONS } from './AlignmentChip.jsx'
import ExpansionSection from './ExpansionSection.jsx'
import PromptList from './PromptList.jsx'
import MomentList from './MomentList.jsx'
import deitiesData from '../../data/deities.json'
import RaceAwareDimensionPicker from './RaceAwareDimensionPicker.jsx'
import RaceAwareColorPicker from './RaceAwareColorPicker.jsx'
import { THEME_PERSONALITY_PROMPTS } from '../../data/themePersonalityPrompts.js'
import { THEME_IDEALS_PROMPTS } from '../../data/themeIdealsPrompts.js'
import { THEME_BONDS_PROMPTS } from '../../data/themeBondsPrompts.js'
import { THEME_FLAWS_PROMPTS } from '../../data/themeFlawsPrompts.js'
import { THEME_BACKSTORY_MOMENTS } from '../../data/themeBackstoryMoments.js'

/**
 * Step 7 — Identity Details. Per PHASE_2_CREATOR_SPEC.md §5.7.
 *
 * Two stacked sections:
 *
 *   Section 1 (always visible) — Required identity:
 *     alignment, faith, lifestyle, 8 physical-description fields
 *
 *   Section 2 (collapsible expansions):
 *     - Personality / Ideals / Bonds / Flaws (Model A click-to-fill)
 *     - Backstory (Model B multi-select chips + write-your-own)
 *
 * Mode behavior per spec §5.7.2 / §5.7.3:
 *   Manual: expansions collapsed by default; player opts in
 *   Handoff: expansions expanded by default with biography pre-fill
 *            (where seed text matches an expansion); §7 prompts/moments
 *            remain accessible below the pre-fill
 *
 * Per Decision (cuts confirmed, §5.7.7): Organizations / Allies /
 * Enemies / Other notes are NOT rendered in either mode.
 */

const ALIGNMENT_GRID = [
  ['LG', 'NG', 'CG'],
  ['LN', 'N',  'CN'],
  ['LE', 'NE', 'CE']
]

// Lifestyle costs + meanings — distilled from the 5e PHB Chapter 5 (Equipment)
// "Expenses" section. Daily cost is what the player pays per day to maintain
// the lifestyle between adventures. Meaning is what the lifestyle implies
// for housing, food, and social standing.
const LIFESTYLES = [
  {
    id: 'Wretched',
    cost: '— gp/day',
    meaning: 'No shelter to speak of. Sleeping in alleys, cellars, ruins. Going hungry many nights. Brutally exposed to weather, disease, and predators of every kind.'
  },
  {
    id: 'Squalid',
    cost: '1 sp/day',
    meaning: 'A foul-smelling room in a slum or shanty. Scant food. Living among the desperate. Bottom of every social ladder.'
  },
  {
    id: 'Poor',
    cost: '2 sp/day',
    meaning: 'A small room above a tavern, or a cot in a common dorm. Food is plain and not always enough. Treated by most as another working hand.'
  },
  {
    id: 'Modest',
    cost: '1 gp/day',
    meaning: 'A respectable apartment or comfortable lodging. Regular meals. Skilled tradespeople, watch officers, junior priests. Treated with basic respect.'
  },
  {
    id: 'Comfortable',
    cost: '2 gp/day',
    meaning: 'A small house in a decent neighborhood, or extended stays at quality inns. Good food, sturdy clothes. Successful merchants, established artists.'
  },
  {
    id: 'Wealthy',
    cost: '4 gp/day',
    meaning: 'A fine home with servants. Luxurious meals, fashionable clothing. Mid-tier nobility, master crafters, well-connected guild leaders.'
  },
  {
    id: 'Aristocratic',
    cost: '10 gp/day',
    meaning: 'A grand estate with full retinue. Exotic foods, the finest tailoring, connections to the highest circles. Old money or new fortune; either way, power.'
  }
]

export default function Step7IdentityDetails({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'
  const themeId = state.theme_id || (isHandoff ? payload?.committed_theme : '')
  const raceId = state.race || (isHandoff ? payload?.race : null)

  // Faith options — 53 deities + "None / Unaligned" anchor.
  const faithOptions = useMemo(() => {
    const list = [{ id: '_none', name: 'None / Unaligned' }]
    Object.entries(deitiesData).forEach(([id, d]) => {
      list.push({
        id,
        name: d.name || id,
        description: d.description,
        alignment: d.alignment,
        domain: d.domain,
        pantheon: d.pantheon
      })
    })
    return list
  }, [])

  // Helper: update a single key on state.identity (lazy-init).
  const identity = state.identity || {}
  const setIdentity = (patch) => {
    set({ ...state, identity: { ...identity, ...patch } })
  }

  return (
    <>
      <WizardHead
        stepNum={7}
        title="Identity Details"
        subtitle="The interior life and outward presence of the person you'll be playing — required anchors first, deeper texture if you want it."
        mode={mode}
      />

      {/* ============================================================
       * Section 1 — Required identity (always visible)
       * ============================================================ */}
      <div className="card">
        <RequiredCoreSection
          identity={identity}
          setIdentity={setIdentity}
          faithOptions={faithOptions}
          raceId={raceId}
        />
      </div>

      {/* ============================================================
       * Section 2 — Optional expansions
       * ============================================================ */}
      <div style={{ marginTop: 28 }}>
        <p className="help" style={{ marginBottom: 18 }}>
          {isHandoff
            ? 'The years behind you shaped these. Confirm what fits, edit what doesn\'t.'
            : 'The deeper texture of who you are. Fill in what feels meaningful and skip what doesn\'t.'}
        </p>
        <OptionalExpansions
          state={state}
          set={set}
          mode={mode}
          payload={payload}
          themeId={themeId}
        />
      </div>
    </>
  )
}

/**
 * Required core — alignment grid, faith select, lifestyle chips,
 * 8 physical fields in a compact grid (per §5.7.7 design call).
 */
function RequiredCoreSection({ identity, setIdentity, faithOptions, raceId }) {
  return (
    <>
      <Field
        label="Alignment"
        help="Your moral compass — how you tend to act when no one's watching."
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          maxWidth: 460
        }}>
          {ALIGNMENT_GRID.flat().map(code => {
            const picked = identity.alignment === code
            return (
              <button
                key={code}
                type="button"
                onClick={() => setIdentity({ alignment: code })}
                style={{
                  padding: '12px 14px',
                  background: picked ? 'var(--ink)' : 'var(--bg-card)',
                  color: picked ? 'var(--bg-card)' : 'var(--ink-2)',
                  border: `1px solid ${picked ? 'var(--ink)' : 'var(--rule)'}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--serif)'
                }}
              >
                <div style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 13,
                  fontWeight: 600,
                  letterSpacing: '0.06em',
                  marginBottom: 2
                }}>
                  {code}
                </div>
                <div style={{
                  fontFamily: 'var(--sans)',
                  fontSize: 11,
                  letterSpacing: '0.06em',
                  opacity: picked ? 0.85 : 0.7
                }}>
                  {ALIGNMENT_NAMES[code]}
                </div>
              </button>
            )
          })}
        </div>
        {identity.alignment && ALIGNMENT_DESCRIPTIONS[identity.alignment] && (
          <div style={{
            marginTop: 14,
            padding: '14px 18px',
            background: 'var(--bg-2)',
            border: '1px solid var(--rule-soft)',
            borderLeft: '3px solid var(--accent)',
            maxWidth: 720
          }}>
            <div style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--ink-2)',
              marginBottom: 10
            }}>
              {ALIGNMENT_DESCRIPTIONS[identity.alignment].summary}
            </div>
            <ul style={{
              margin: 0,
              paddingLeft: 18,
              fontFamily: 'var(--serif)',
              fontSize: 14,
              lineHeight: 1.45,
              color: 'var(--ink-3)'
            }}>
              {ALIGNMENT_DESCRIPTIONS[identity.alignment].examples.map((ex, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{ex}</li>
              ))}
            </ul>
          </div>
        )}
      </Field>

      <Field
        label="Faith"
        help="Your connection to the divine, if any. Faith shapes ritual, oath, and the language you use under pressure."
      >
        <select
          className="select"
          value={identity.faith || ''}
          onChange={e => setIdentity({ faith: e.target.value })}
        >
          <option value="">Choose a faith…</option>
          {faithOptions.map(f => (
            <option key={f.id} value={f.id}>
              {f.name}{f.pantheon ? ` (${f.pantheon})` : ''}
            </option>
          ))}
        </select>
        {identity.faith && identity.faith !== '_none' && (() => {
          const f = faithOptions.find(o => o.id === identity.faith)
          if (!f || !f.description) return null
          return (
            <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
              {f.description}
              {f.alignment && (
                <span style={{ marginLeft: 8 }}>
                  <AlignmentChip alignment={f.alignment} />
                </span>
              )}
            </div>
          )
        })()}
      </Field>

      <Field
        label="Lifestyle"
        help="How you live between adventures — the comfort you're accustomed to and the standard you can sustain."
      >
        <div className="chips">
          {LIFESTYLES.map(l => (
            <button
              key={l.id}
              type="button"
              className={`chip ${identity.lifestyle === l.id ? 'on' : ''}`}
              onClick={() => setIdentity({ lifestyle: l.id })}
            >
              {l.id}
              <span style={{
                marginLeft: 8,
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: identity.lifestyle === l.id ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)'
              }}>
                {l.cost}
              </span>
            </button>
          ))}
        </div>
        {identity.lifestyle && (() => {
          const l = LIFESTYLES.find(x => x.id === identity.lifestyle)
          if (!l) return null
          return (
            <div style={{
              marginTop: 14,
              padding: '14px 18px',
              background: 'var(--bg-2)',
              border: '1px solid var(--rule-soft)',
              borderLeft: '3px solid var(--accent)',
              maxWidth: 720,
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--ink-2)'
            }}>
              <span style={{
                fontFamily: 'var(--mono)',
                fontStyle: 'normal',
                fontSize: 12,
                color: 'var(--accent)',
                marginRight: 12
              }}>
                {l.cost}
              </span>
              {l.meaning}
            </div>
          )
        })()}
      </Field>

      <div className="hr soft" />

      <div className="label" style={{ marginBottom: 12 }}>Physical description</div>
      <p className="help" style={{ marginBottom: 18 }}>
        What you look like. This grounds how others first see you.
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 18
      }}>
        <RaceAwarePhysicalField
          label="Age"
          field="age"
          raceId={raceId}
          value={identity.age}
          onChange={v => setIdentity({ age: v })}
        />
        <RaceAwarePhysicalField
          label="Height"
          field="height"
          raceId={raceId}
          value={identity.height}
          onChange={v => setIdentity({ height: v })}
        />
        <RaceAwarePhysicalField
          label="Weight"
          field="weight"
          raceId={raceId}
          value={identity.weight}
          onChange={v => setIdentity({ weight: v })}
        />
        <RaceAwareColorField label="Eyes" field="eyes" raceId={raceId} value={identity.eye_color} onChange={v => setIdentity({ eye_color: v })} />
        <RaceAwareColorField label="Hair" field="hair" raceId={raceId} value={identity.hair_color} onChange={v => setIdentity({ hair_color: v })} />
        <RaceAwareColorField label="Skin" field="skin" raceId={raceId} value={identity.skin_color} onChange={v => setIdentity({ skin_color: v })} />
        <RaceAwareColorField label="Build" field="build" raceId={raceId} value={identity.build} onChange={v => setIdentity({ build: v })} />
      </div>

      <div style={{ marginTop: 18 }}>
        <Field label="Distinguishing features" help="Scars, markings, the way you carry yourself — anything that makes you visibly you.">
          <textarea
            className="textarea"
            value={identity.distinguishing_features || ''}
            onChange={e => setIdentity({ distinguishing_features: e.target.value })}
            maxLength={256}
            placeholder="—"
          />
        </Field>
      </div>
    </>
  )
}

function PhysicalField({ label, value, onChange, max = 64, placeholder = '—' }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="label">{label}</div>
      <input
        type="text"
        className="input"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        maxLength={max}
        placeholder={placeholder}
      />
    </div>
  )
}

/**
 * Race-aware physical field — wraps RaceAwareDimensionPicker in the
 * label-and-spacing shape the rest of the physical-fields grid uses.
 */
function RaceAwarePhysicalField({ label, field, raceId, value, onChange }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="label">{label}</div>
      <RaceAwareDimensionPicker
        field={field}
        raceId={raceId}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  )
}

/**
 * Race-aware color/build field — wraps RaceAwareColorPicker in the
 * label-and-spacing shape the rest of the physical-fields grid uses.
 */
function RaceAwareColorField({ label, field, raceId, value, onChange }) {
  return (
    <div className="field" style={{ marginBottom: 0 }}>
      <div className="label">{label}</div>
      <RaceAwareColorPicker
        field={field}
        raceId={raceId}
        value={value || ''}
        onChange={onChange}
      />
    </div>
  )
}

/**
 * Five collapsible expansions. Mode controls default open/closed state;
 * each expansion manages its own open/closed thereafter.
 */
function OptionalExpansions({ state, set, mode, payload, themeId }) {
  const isHandoff = mode === 'handoff'
  const expansions = state.expansions || {}
  const setExpansion = (key, patch) => {
    set({
      ...state,
      expansions: {
        ...expansions,
        [key]: { ...(expansions[key] || {}), ...patch }
      }
    })
  }

  // Click-to-fill prompt → confirm-replace if textarea has been edited
  // beyond the previous starter.
  const onPickPrompt = (key) => (prompt) => {
    const current = (expansions[key]?.value || '').trim()
    const previousStarter = (expansions[key]?.last_picked_starter || '').trim()
    const hasUnsavedEdits = current && current !== previousStarter
    if (hasUnsavedEdits) {
      const ok = window.confirm("You've edited this. Replace with the new prompt?")
      if (!ok) return
    }
    setExpansion(key, { value: prompt.text, last_picked_starter: prompt.text })
  }

  return (
    <div>
      {/* Per PM review feedback (2026-05-02): expansions start CLOSED in
          both modes, with the chevron in ExpansionSection serving as the
          expandability marker. Spec §5.7.3 originally called for handoff
          mode to default open with biography pre-fill; PM reviewed in-
          context and chose closed-with-marker as the cleaner experience.
          See spec annotation in §5.7.3 for the deviation note. */}
      <PromptDrivenExpansion
        label="Personality traits"
        description="what you do habitually"
        stateKey="personality"
        themeId={themeId}
        promptsBy={THEME_PERSONALITY_PROMPTS}
        expansions={expansions}
        setExpansion={setExpansion}
        onPickPrompt={onPickPrompt}
        defaultOpen={false}
      />
      <PromptDrivenExpansion
        label="Ideals"
        description="what you believe"
        stateKey="ideals"
        themeId={themeId}
        promptsBy={THEME_IDEALS_PROMPTS}
        expansions={expansions}
        setExpansion={setExpansion}
        onPickPrompt={onPickPrompt}
        defaultOpen={false}
      />
      <PromptDrivenExpansion
        label="Bonds"
        description="what you value most"
        stateKey="bonds"
        themeId={themeId}
        promptsBy={THEME_BONDS_PROMPTS}
        expansions={expansions}
        setExpansion={setExpansion}
        onPickPrompt={onPickPrompt}
        defaultOpen={false}
      />
      <PromptDrivenExpansion
        label="Flaws"
        description="your weakness or vice"
        stateKey="flaws"
        themeId={themeId}
        promptsBy={THEME_FLAWS_PROMPTS}
        expansions={expansions}
        setExpansion={setExpansion}
        onPickPrompt={onPickPrompt}
        defaultOpen={false}
      />
      <BackstoryExpansion
        themeId={themeId}
        expansions={expansions}
        setExpansion={setExpansion}
        defaultOpen={false}
        biographySeed={isHandoff ? (payload?.biography_seed || []) : []}
      />
    </div>
  )
}

/**
 * Personality / Ideals / Bonds / Flaws — Model A click-to-fill.
 * Three theme-flavored prompts (or 4-7 for Ideals/Bonds/Flaws) surface
 * inline; click to populate the textarea.
 */
function PromptDrivenExpansion({
  label, description, stateKey, themeId, promptsBy,
  expansions, setExpansion, onPickPrompt, defaultOpen
}) {
  const value = expansions[stateKey]?.value || ''
  const prompts = themeId ? (promptsBy[themeId] || []) : []
  return (
    <ExpansionSection
      label={label}
      description={description}
      defaultOpen={defaultOpen}
      hasContent={!!value.trim()}
    >
      <PromptList
        prompts={prompts}
        value={value}
        onPick={onPickPrompt(stateKey)}
      />
      <Field label="Your version" help="Edit freely from any starter, or write from scratch.">
        <textarea
          className="textarea"
          value={value}
          onChange={e => setExpansion(stateKey, { value: e.target.value })}
          maxLength={500}
          placeholder="—"
        />
      </Field>
    </ExpansionSection>
  )
}

/**
 * Backstory — Model B multi-select moment chips + custom moments +
 * (handoff mode) read-only biography seed at the top.
 */
function BackstoryExpansion({ themeId, expansions, setExpansion, defaultOpen, biographySeed }) {
  const data = expansions.backstory || {}
  const pickedKeys = data.picked_keys || []
  const customMoments = data.custom_moments || []
  const moments = themeId ? (THEME_BACKSTORY_MOMENTS[themeId] || []) : []

  const onPick = (key) => setExpansion('backstory', { picked_keys: [...pickedKeys, key] })
  const onUnpick = (key) => setExpansion('backstory', { picked_keys: pickedKeys.filter(k => k !== key) })
  const onReorder = (next) => setExpansion('backstory', { picked_keys: next })
  const onAddCustom = (text) => {
    const nextCustom = [...customMoments, text]
    const newKey = `custom:${nextCustom.length - 1}`
    setExpansion('backstory', {
      custom_moments: nextCustom,
      picked_keys: [...pickedKeys, newKey]
    })
  }

  const hasContent = pickedKeys.length > 0 || customMoments.length > 0 || biographySeed.length > 0

  return (
    <ExpansionSection
      label="Backstory"
      description="the years before the campaign"
      defaultOpen={defaultOpen}
      hasContent={hasContent}
    >
      {/* Read-only biography seed (handoff only) ----------- */}
      {biographySeed.length > 0 && (
        <div style={{
          marginBottom: 24,
          padding: '20px 24px',
          background: 'var(--bg-2)',
          border: '1px solid var(--rule)',
          borderLeft: '3px solid var(--accent)'
        }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Biography seed (canonical)</div>
          {biographySeed.map((entry, i) => (
            <div key={i} style={{
              marginBottom: 14,
              paddingBottom: 14,
              borderBottom: i < biographySeed.length - 1 ? '1px dashed var(--rule)' : 'none'
            }}>
              <div style={{
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '0.1em',
                color: 'var(--accent)',
                marginBottom: 6,
                textTransform: 'uppercase'
              }}>
                {entry.age != null ? `Age ${entry.age}` : 'Age unspecified'}
                {entry.chapter != null ? ` · Chapter ${entry.chapter}` : ''}
              </div>
              <div style={{
                fontFamily: 'var(--serif)',
                fontSize: 16,
                lineHeight: 1.5,
                color: 'var(--ink-2)'
              }}>
                {entry.text}
              </div>
            </div>
          ))}
          <div className="help" style={{ marginTop: 6 }}>
            What you see here is canonical to your campaign. To revise it later, you can edit your character's biography directly.
          </div>
        </div>
      )}

      <MomentList
        moments={moments}
        pickedKeys={pickedKeys}
        onPick={onPick}
        onUnpick={onUnpick}
        onReorder={onReorder}
        onAddCustom={onAddCustom}
        customMoments={customMoments}
      />
    </ExpansionSection>
  )
}
