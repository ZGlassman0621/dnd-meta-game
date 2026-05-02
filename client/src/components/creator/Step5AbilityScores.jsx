import { useState, useEffect, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import BumpCelebrationCard, { defaultBumpAssignments, ABILITY_KEYS, ABILITY_LABELS } from './BumpCelebrationCard.jsx'
import racesData from '../../data/races.json'
import classesData from '../../data/classes.json'

/**
 * Step 5 — Ability Scores. Per PHASE_2_CREATOR_SPEC.md §5.5.
 *
 * Manual mode subsections:
 *   1. Generation method (Standard Array / Manual)
 *   2. Ability score assignment (six rows)
 *   3. Skills picker (within class allotment + emergence skills)
 *   4. Variant Human bonus general feat — when race=human + subrace=Variant Human
 *
 * Handoff mode adds:
 *   - Bump celebration card at the top (when accepted_stat_bumps exist)
 *   - Per-bump dropdown to assign each +1 to a stat (default alphabetical
 *     first-fit per §5.5.7)
 *   - Emergence skills (from accepted_skill_bumps) pre-checked in the
 *     skills picker
 *
 * Decision E (DECISION_LOG 2026-04-30): L1 cap is 18 — base + racial +
 * bumps clamped at 18 visibly (not silently). Manual-mode base range is
 * 3–20 per §5.5.7 (intentionally wide for roleplay-driven custom builds).
 */
export default function Step5AbilityScores({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
  const generationMethod = state.generation_method || 'standard_array'
  const baseScores = state.base_scores || { str: null, dex: null, con: null, int: null, wis: null, cha: null }

  // --- Racial bonus computation -------------------------------------------
  const raceData = racesData[state.race]
  const subraceData = useMemo(() => {
    if (!raceData) return null
    return (raceData.subraces || []).find(s => s.name === state.subrace) || null
  }, [raceData, state.subrace])

  // Static bonuses (e.g., {wis: 1}) come direct; choice bonuses ({choice: 2})
  // are player-picked. Some races combine both ({cha: 2, choice: 2}).
  const racialStatic = useMemo(() => {
    const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    const sources = [raceData?.abilityScoreIncrease, subraceData?.abilityScoreIncrease]
    for (const src of sources) {
      if (!src) continue
      for (const k of ABILITY_KEYS) {
        if (typeof src[k] === 'number') out[k] += src[k]
      }
    }
    return out
  }, [raceData, subraceData])

  const racialChoiceCount = useMemo(() => {
    let n = 0
    if (raceData?.abilityScoreIncrease?.choice) n += raceData.abilityScoreIncrease.choice
    if (subraceData?.abilityScoreIncrease?.choice) n += subraceData.abilityScoreIncrease.choice
    return n
  }, [raceData, subraceData])

  // Choice picks live in state — array of ability-key strings, length === racialChoiceCount.
  const racialChoicePicks = state.racial_choice_picks || []
  useEffect(() => {
    if (racialChoiceCount === 0 && racialChoicePicks.length > 0) {
      set({ ...state, racial_choice_picks: [] })
    }
  }, [racialChoiceCount])

  const racialChoiceBonuses = useMemo(() => {
    const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    for (const k of racialChoicePicks) {
      if (k && k in out) out[k] += 1
    }
    return out
  }, [racialChoicePicks])

  // --- Bump handling (handoff only) ---------------------------------------
  const bumps = isHandoff ? (payload?.accepted_stat_bumps || []) : []
  const bumpAssignments = state.bump_assignments || (bumps.length > 0 ? defaultBumpAssignments(bumps) : [])

  // Seed default bump assignments on first handoff render with bumps.
  useEffect(() => {
    if (!isHandoff) return
    if (bumps.length === 0) return
    if (state.bump_assignments && state.bump_assignments.length === bumps.length) return
    set({ ...state, bump_assignments: defaultBumpAssignments(bumps) })
  }, [isHandoff, bumps.length])

  const bumpBonuses = useMemo(() => {
    const out = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }
    bumps.forEach((b, i) => {
      const stat = bumpAssignments[i]
      if (stat && stat in out) out[stat] += (b.magnitude || 1)
    })
    return out
  }, [bumps, bumpAssignments])

  // --- Final score with L1 cap clamp at 18 ---------------------------------
  const computeFinal = (k) => {
    const base = baseScores[k] || 0
    const racialTotal = (racialStatic[k] || 0) + (racialChoiceBonuses[k] || 0)
    const bumpTotal = bumpBonuses[k] || 0
    const raw = base + racialTotal + bumpTotal
    const clamped = Math.min(18, raw)
    return { base, racialTotal, bumpTotal, raw, clamped, wouldOverflow: raw > 18 }
  }

  // --- Standard Array claim/release ---------------------------------------
  const usedArrayValues = useMemo(() => {
    const used = new Set()
    for (const k of ABILITY_KEYS) {
      const v = baseScores[k]
      if (v != null) used.add(v)
    }
    return used
  }, [baseScores])

  const [claimingFor, setClaimingFor] = useState(null)
  const claimValue = (val) => {
    if (claimingFor == null) return
    set({ ...state, base_scores: { ...baseScores, [claimingFor]: val } })
    setClaimingFor(null)
  }
  const releaseSlot = (k) => {
    set({ ...state, base_scores: { ...baseScores, [k]: null } })
  }

  // --- Manual numeric input ------------------------------------------------
  const setManual = (k, v) => {
    const n = v === '' ? null : Math.max(3, Math.min(20, parseInt(v, 10) || 3))
    set({ ...state, base_scores: { ...baseScores, [k]: n } })
  }

  // --- Race-derived state (gates Variant Human feat picker etc.) ---------
  const isVariantHuman = state.race === 'human' && state.subrace === 'Variant Human'

  return (
    <>
      <WizardHead
        stepNum={5}
        title="Ability Scores"
        subtitle="Six numbers — and the moments behind them, when there are any to honor."
        mode={mode}
      />

      {isHandoff && bumps.length > 0 && (
        <BumpCelebrationCard
          bumps={bumps}
          assignments={bumpAssignments}
          onAssignmentChange={(i, val) => {
            const next = [...bumpAssignments]
            next[i] = val
            set({ ...state, bump_assignments: next })
          }}
        />
      )}

      <div className="card">
        {/* --- Generation method ------------------------------------ */}
        <Field
          label="Generation method"
          help="Standard Array gives you six fixed values to assign; Manual lets you enter custom scores within allowed ranges."
        >
          <div className="chips">
            {[
              { id: 'standard_array', label: 'Standard Array' },
              { id: 'manual', label: 'Manual' }
            ].map(opt => (
              <button
                key={opt.id}
                type="button"
                className={`chip ${generationMethod === opt.id ? 'on' : ''}`}
                onClick={() => set({
                  ...state,
                  generation_method: opt.id,
                  // Reset assignments when switching methods to avoid carrying
                  // stale array-claim state into manual-entry, or vice versa.
                  base_scores: { str: null, dex: null, con: null, int: null, wis: null, cha: null }
                })}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Field>

        {/* --- Standard Array pool ----------------------------------- */}
        {generationMethod === 'standard_array' && (
          <Field
            label="Available values"
            help={
              claimingFor
                ? `Click a value to assign it to ${ABILITY_LABELS[claimingFor]}.`
                : 'Click "Claim" on an ability row, then click a value below.'
            }
          >
            <div style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              padding: 16,
              background: 'var(--bg-2)',
              border: '1px dashed var(--rule)'
            }}>
              {STANDARD_ARRAY.map(v => {
                const used = usedArrayValues.has(v)
                return (
                  <button
                    key={v}
                    type="button"
                    onClick={() => !used && claimValue(v)}
                    disabled={used || claimingFor == null}
                    style={{
                      width: 56,
                      height: 56,
                      border: '1px solid var(--ink)',
                      background: used ? 'var(--bg-2)' : 'var(--bg-card)',
                      fontFamily: 'var(--mono)',
                      fontSize: 22,
                      fontWeight: 500,
                      color: used ? 'var(--ink-3)' : 'var(--ink)',
                      cursor: used || claimingFor == null ? 'not-allowed' : 'pointer',
                      opacity: used ? 0.3 : 1,
                      transition: 'all .12s'
                    }}
                  >
                    {v}
                  </button>
                )
              })}
            </div>
          </Field>
        )}

        {/* --- Six ability score rows ------------------------------- */}
        <div style={{ marginTop: 18 }}>
          <div className="label" style={{ marginBottom: 12 }}>Ability scores</div>
          <div style={{ display: 'grid', gap: 0 }}>
            {/* Header row */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 70px 70px 70px 80px',
              gap: 16,
              alignItems: 'center',
              padding: '10px 0',
              borderBottom: '1px solid var(--rule)',
              fontFamily: 'var(--sans)',
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--ink-3)',
              fontWeight: 500
            }}>
              <span>Ability</span>
              <span>Base</span>
              <span style={{ textAlign: 'center' }}>Racial</span>
              <span style={{ textAlign: 'center' }}>Bumps</span>
              <span style={{ textAlign: 'center' }}>=</span>
              <span style={{ textAlign: 'center' }}>Total</span>
            </div>

            {ABILITY_KEYS.map(k => {
              const { base, racialTotal, bumpTotal, raw, clamped, wouldOverflow } = computeFinal(k)
              return (
                <div
                  key={k}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '90px 1fr 70px 70px 70px 80px',
                    gap: 16,
                    alignItems: 'center',
                    padding: '14px 0',
                    borderBottom: '1px solid var(--rule-soft)'
                  }}
                >
                  <span className="label" style={{ fontSize: 12 }}>{ABILITY_LABELS[k]}</span>

                  {/* Base value cell — varies by generation method */}
                  {generationMethod === 'standard_array' ? (
                    base != null ? (
                      <button
                        type="button"
                        onClick={() => releaseSlot(k)}
                        style={{
                          height: 44,
                          border: '1px solid var(--ink)',
                          background: 'var(--bg-card)',
                          fontFamily: 'var(--mono)',
                          fontSize: 22,
                          color: 'var(--ink)',
                          cursor: 'pointer',
                          textAlign: 'center'
                        }}
                        title="Click to release"
                      >
                        {base}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setClaimingFor(k)}
                        style={{
                          height: 44,
                          border: claimingFor === k ? '1px solid var(--accent)' : '1px dashed var(--rule)',
                          background: claimingFor === k ? 'var(--bg-2)' : 'var(--bg)',
                          fontFamily: 'var(--sans)',
                          fontSize: 11,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: claimingFor === k ? 'var(--accent)' : 'var(--ink-3)',
                          cursor: 'pointer'
                        }}
                      >
                        {claimingFor === k ? 'Pick a value above' : 'Claim'}
                      </button>
                    )
                  ) : (
                    <input
                      type="number"
                      min={3}
                      max={20}
                      className="input"
                      style={{ fontFamily: 'var(--mono)', textAlign: 'center', height: 44 }}
                      value={base == null ? '' : base}
                      onChange={e => setManual(k, e.target.value)}
                      placeholder="—"
                    />
                  )}

                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--accent-2)', textAlign: 'center' }}>
                    {racialTotal > 0 ? `+${racialTotal}` : '—'}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--accent)', textAlign: 'center' }}>
                    {bumpTotal > 0 ? `+${bumpTotal}` : '—'}
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 14, color: 'var(--ink-3)', textAlign: 'center' }}>=</span>
                  <span
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 22,
                      fontWeight: 500,
                      color: wouldOverflow ? 'var(--accent)' : 'var(--ink)',
                      textAlign: 'center'
                    }}
                    title={wouldOverflow ? `Raw ${raw} clamped to L1 cap 18` : null}
                  >
                    {base == null ? '—' : clamped}
                    {wouldOverflow && (
                      <span style={{ fontSize: 10, color: 'var(--accent)', display: 'block', letterSpacing: '0.1em' }}>
                        (capped from {raw})
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* --- Racial choice picker (Variant Human, Half-Elf, etc.) -- */}
        {racialChoiceCount > 0 && (
          <div style={{ marginTop: 28 }}>
            <Field
              label={`Choose ${racialChoiceCount} ability score${racialChoiceCount === 1 ? '' : 's'} for your racial +1`}
              help={`${raceData?.name || 'Your race'} grants ${racialChoiceCount} additional +1${racialChoiceCount === 1 ? '' : 's'} of your choice. Each ability can receive at most one of these bonuses.`}
            >
              <div className="chips">
                {ABILITY_KEYS.map(k => {
                  const isPicked = racialChoicePicks.includes(k)
                  const picksLeft = racialChoiceCount - racialChoicePicks.filter(Boolean).length
                  const canPick = isPicked || picksLeft > 0
                  return (
                    <button
                      key={k}
                      type="button"
                      className={`chip ${isPicked ? 'on' : ''}`}
                      disabled={!canPick}
                      onClick={() => {
                        if (isPicked) {
                          set({ ...state, racial_choice_picks: racialChoicePicks.filter(p => p !== k) })
                        } else if (picksLeft > 0) {
                          set({ ...state, racial_choice_picks: [...racialChoicePicks, k] })
                        }
                      }}
                    >
                      {ABILITY_LABELS[k]}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>
        )}

        {/* --- Skills picker --------------------------------------- */}
        <SkillsPicker state={state} set={set} mode={mode} payload={payload} />

        {/* --- Variant Human bonus general feat -------------------- */}
        {isVariantHuman && (
          <div style={{ marginTop: 28 }}>
            <Field
              label="Variant Human bonus feat"
              help="Variant Humans choose a general feat at the start of their journey — a self-taught skill or talent that defines you apart from your lineage. Real picker (with prerequisite filtering) lands in batch 3 alongside Step 5's full feat-data wiring."
            >
              <div className="help" style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
                General feat picker (filtered to feats your current scores qualify you for) wires here.
              </div>
            </Field>
          </div>
        )}
      </div>
    </>
  )
}

/**
 * Skills picker. Manual mode: pick `class.skillChoices` skills from
 * `class.skillOptions`. Handoff mode: emergence skills from
 * `payload.accepted_skill_bumps` pre-check; if 2 emergence skills
 * pre-check, the player picks 0 from the class allotment (caps at 2 per
 * v4 §5e).
 *
 * Class/theme/ancestry-granted skills not yet wired — those would
 * pre-check as "granted" (read-only). Listed in spec §5.5.7 as
 * engineering-confirm-against-data work; left for batch 3 follow-up.
 */
function SkillsPicker({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'
  const cls = classesData[state.class_id]
  const allowedSkillIds = (cls?.skillOptions || []).map(s => normalizeSkillId(s))
  const choiceCount = cls?.skillChoices ?? 2

  // Emergence skills from payload (handoff). Pre-check, count toward allotment.
  const emergenceSkills = (isHandoff ? payload?.accepted_skill_bumps || [] : [])
    .map(s => s.skill)
    .filter(Boolean)
  const emergenceIds = emergenceSkills.map(normalizeSkillId)

  const picked = state.selected_skills || []
  const remainingPicks = Math.max(0, choiceCount - emergenceIds.length - picked.length)

  const togglePick = (id) => {
    if (emergenceIds.includes(id)) return
    if (picked.includes(id)) {
      set({ ...state, selected_skills: picked.filter(p => p !== id) })
    } else if (picked.length + emergenceIds.length < choiceCount) {
      set({ ...state, selected_skills: [...picked, id] })
    }
  }

  if (!cls) {
    return (
      <div style={{ marginTop: 28 }}>
        <Field label="Skills">
          <div className="help" style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
            Pick a class on Step 4 to see your skill options.
          </div>
        </Field>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 28 }}>
      <Field
        label={`Skills (pick ${remainingPicks} more${emergenceIds.length > 0 ? `; ${emergenceIds.length} emerged from your Prelude` : ''})`}
        help="Skills you're proficient in. Each ties to one of your six abilities — pick the ones you've practiced or trained."
      >
        <div className="chips">
          {allowedSkillIds.map(id => {
            const isEmergence = emergenceIds.includes(id)
            const isPicked = picked.includes(id)
            const isOn = isEmergence || isPicked
            const disabled = isEmergence || (!isPicked && remainingPicks === 0)
            return (
              <button
                key={id}
                type="button"
                className={`chip ${isOn ? 'on' : ''}`}
                disabled={disabled}
                onClick={() => togglePick(id)}
                title={isEmergence ? 'Emerged during your Prelude' : null}
              >
                {prettifySkillId(id)}
                {isEmergence && (
                  <span style={{ marginLeft: 6, fontSize: 9, color: 'var(--accent)', fontStyle: 'italic' }}>
                    (Prelude)
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </Field>
    </div>
  )
}

function normalizeSkillId(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '_')
}
function prettifySkillId(id) {
  return String(id || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
