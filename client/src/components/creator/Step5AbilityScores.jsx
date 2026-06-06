import { useState, useEffect, useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
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
 *
 * Hearth render: the design's pane-5 ability allocator — a `.seg`
 * method toggle, an `.alloc-status` strip, and an `.alloc` of `.arow`
 * rows (.aname + .agov governance line + .actl control + .amod modifier).
 * Standard-array rows use `.aselect`; manual rows reuse the array
 * controls in numeric form. App-specific sections (racial choice, skills,
 * Variant Human) ride below in `.block`/`.field` Hearth primitives.
 */
export default function Step5AbilityScores({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8]
  const generationMethod = state.generation_method || 'standard_array'
  const baseScores = state.base_scores || { str: null, dex: null, con: null, int: null, wis: null, cha: null }

  // --- Class importance hints (primary / dump) ---------------------------
  // Surfaces ★ next to abilities that matter most for the chosen class
  // and ✗ next to its dump stat. Same shape the legacy wizard used,
  // sourced from classes.json `primaryAbility[]` + `dumpStat`.
  const classData = state.class_id ? classesData[state.class_id] : null
  const primaryAbilities = classData?.primaryAbility || []
  const dumpStat = classData?.dumpStat || null

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
    // Preserve null vs 0 distinction — null means "not yet assigned"
    // (Claim button renders), 0 means the player explicitly entered 0
    // (value button renders). Earlier `baseScores[k] || 0` collapsed
    // both into 0, which made the Claim path unreachable: every cell
    // looked assigned, so clicking always called releaseSlot, which
    // set null, which the || coerced back to 0 — invisible no-op loop.
    const base = baseScores[k]
    const racialTotal = (racialStatic[k] || 0) + (racialChoiceBonuses[k] || 0)
    const bumpTotal = bumpBonuses[k] || 0
    const raw = (base ?? 0) + racialTotal + bumpTotal
    const clamped = Math.min(18, raw)
    return { base, racialTotal, bumpTotal, raw, clamped, wouldOverflow: raw > 18 }
  }

  // 5e ability modifier from a final score: floor((score - 10) / 2).
  const modOf = (score) => {
    const m = Math.floor((score - 10) / 2)
    return (m >= 0 ? '+' : '−') + Math.abs(m)
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

  // Standard-array select: choosing a value already held by another
  // ability swaps the two, so each array value stays assigned once —
  // mirrors the design's "picking a taken value swaps it" behaviour.
  const selectArrayValue = (k, raw) => {
    if (raw === '') {
      releaseSlot(k)
      return
    }
    const val = parseInt(raw, 10)
    const next = { ...baseScores }
    const other = ABILITY_KEYS.find(x => x !== k && next[x] === val)
    if (other != null) next[other] = baseScores[k] ?? null
    next[k] = val
    set({ ...state, base_scores: next })
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
        title="Six numbers, and the moments behind them."
        subtitle="A primary you'll lean on, ★, and one you can let lie, ✗. Place each number where it counts."
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

      {/* --- Generation method (segmented control) ------------------- */}
      <div className="seg" data-grp="method">
        {[
          { id: 'standard_array', label: 'Standard array' },
          { id: 'manual', label: 'Manual' }
        ].map(opt => (
          <button
            key={opt.id}
            type="button"
            className={generationMethod === opt.id ? 'on' : ''}
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

      {/* --- Status strip — array values, or manual range note ------- */}
      <div className="alloc-status">
        {generationMethod === 'standard_array' ? (
          <>
            <span className="sl">Standard array</span>
            <span className="vals">{STANDARD_ARRAY.join(' · ')}</span>
            <span className="sh">assign each value once — picking a taken value swaps it</span>
          </>
        ) : (
          <span className="sh">enter your own scores — 3 to 20 each, capped at 18 after racial bonuses</span>
        )}
      </div>

      {/* --- Class importance hint ----------------------------------- */}
      {classData && (primaryAbilities.length > 0 || dumpStat) && (
        <p className="subtitle" style={{ marginTop: 0, marginBottom: 18 }}>
          For {classData.name}
          {primaryAbilities.length > 0 && (
            <>
              , <span className="mk star" style={{ fontStyle: 'normal' }}>★</span>
              {' marks the '}{primaryAbilities.length === 1 ? 'primary ability' : 'primary abilities'}
              {' ('}{primaryAbilities.map(a => ABILITY_LABELS[a]).join(' / ')}{')'}
            </>
          )}
          {dumpStat && (
            <>
              {primaryAbilities.length > 0 ? '; ' : ', '}
              <span className="mk dump" style={{ fontStyle: 'normal' }}>✗</span>
              {' marks the dump stat ('}{ABILITY_LABELS[dumpStat]}{')'}
            </>
          )}
          .
        </p>
      )}

      {/* --- Six ability rows ---------------------------------------- */}
      <div className="alloc">
        {ABILITY_KEYS.map(k => {
          const { base, racialTotal, bumpTotal, clamped, wouldOverflow } = computeFinal(k)
          const isPrimary = primaryAbilities.includes(k)
          const isDump = dumpStat === k
          const bonusTotal = racialTotal + bumpTotal
          const assigned = base != null
          return (
            <div key={k} className={`arow ${bumpTotal > 0 ? 'bumped' : ''}`.trim()}>
              <div className="aname">
                <span className="an">{ABILITY_LABELS[k]}</span>
                {isPrimary && (
                  <span className="mk star" title={`Primary ability for ${classData?.name}`}>★</span>
                )}
                {isDump && (
                  <span className="mk dump" title={`Dump stat for ${classData?.name}`}>✗</span>
                )}
              </div>

              <div className="agov">{ABILITY_GOV[k]}</div>

              <div className="actl">
                {generationMethod === 'standard_array' ? (
                  <select
                    className="aselect"
                    value={base == null ? '' : base}
                    onChange={e => selectArrayValue(k, e.target.value)}
                  >
                    <option value="">—</option>
                    {STANDARD_ARRAY.map(v => {
                      const taken = usedArrayValues.has(v) && base !== v
                      return (
                        <option key={v} value={v}>
                          {v}{taken ? ' (swap)' : ''}
                        </option>
                      )
                    })}
                  </select>
                ) : (
                  <div className="stepper">
                    <button
                      type="button"
                      disabled={base != null && base <= 3}
                      onClick={() => setManual(k, String((base ?? 10) - 1))}
                    >
                      −
                    </button>
                    <span className="sc">{base == null ? '—' : base}</span>
                    <button
                      type="button"
                      disabled={base != null && base >= 20}
                      onClick={() => setManual(k, String((base ?? 9) + 1))}
                    >
                      +
                    </button>
                  </div>
                )}

                <span
                  className="amod"
                  title={wouldOverflow ? `Raw clamped to L1 cap 18` : null}
                >
                  {assigned ? modOf(clamped) : '—'}
                  {assigned && (
                    <span className="bonus" style={{ display: 'block' }}>
                      {clamped}
                      {bonusTotal > 0 && ` (+${bonusTotal})`}
                      {wouldOverflow && ' cap'}
                    </span>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* --- Racial choice picker (Variant Human, Half-Elf, etc.) -- */}
      {racialChoiceCount > 0 && (
        <div className="block" style={{ marginTop: 30 }}>
          <div className="block-label">
            <span className="l">
              Choose {racialChoiceCount} ability score{racialChoiceCount === 1 ? '' : 's'} for your racial +1
            </span>
          </div>
          <div className="pillrow">
            {ABILITY_KEYS.map(k => {
              const isPicked = racialChoicePicks.includes(k)
              const picksLeft = racialChoiceCount - racialChoicePicks.filter(Boolean).length
              const canPick = isPicked || picksLeft > 0
              return (
                <button
                  key={k}
                  type="button"
                  className={`selpill ${isPicked ? 'on' : ''}`.trim()}
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
          <div className="fhelp">
            {raceData?.name || 'Your race'} grants {racialChoiceCount} additional +1{racialChoiceCount === 1 ? '' : 's'} of your choice. Each ability can receive at most one of these bonuses.
          </div>
        </div>
      )}

      {/* --- Skills picker --------------------------------------- */}
      <SkillsPicker state={state} set={set} mode={mode} payload={payload} />

      {/* --- Variant Human bonus general feat -------------------- */}
      {isVariantHuman && (
        <div className="block" style={{ marginTop: 30 }}>
          <div className="block-label">
            <span className="l">Variant Human bonus feat</span>
          </div>
          <div className="fhelp" style={{ marginTop: 0 }}>
            Variant Humans choose a general feat at the start of their journey — a self-taught skill or talent that defines you apart from your lineage. The general feat picker (filtered to feats your current scores qualify you for) wires here.
          </div>
        </div>
      )}
    </>
  )
}

/**
 * Standard 5e governance lines for each ability — what the score does
 * mechanically. These are game rules, not mockup sample data; they label
 * the design's `.agov` description column.
 */
const ABILITY_GOV = {
  str: 'Melee power — lifting, grappling, and shoving.',
  dex: 'Your strikes and your AC, reflexes, and stealth.',
  con: 'Hit points, and the grit to hold concentration.',
  int: 'Lore, investigation, and arcane study.',
  wis: 'Perception, insight, willpower — and your saves.',
  cha: 'Presence — persuasion, deception, intimidation.'
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
      <div className="block" style={{ marginTop: 30 }}>
        <div className="block-label"><span className="l">Skills</span></div>
        <div className="fhelp" style={{ marginTop: 0 }}>
          Pick a class on Step 4 to see your skill options.
        </div>
      </div>
    )
  }

  return (
    <div className="block" style={{ marginTop: 30 }}>
      <div className="block-label">
        <span className="l">Skills</span>
        <span className="hint">
          pick {remainingPicks} more{emergenceIds.length > 0 ? ` · ${emergenceIds.length} emerged from your Prelude` : ''}
        </span>
      </div>
      <div className="pillrow">
        {allowedSkillIds.map(id => {
          const isEmergence = emergenceIds.includes(id)
          const isPicked = picked.includes(id)
          const isOn = isEmergence || isPicked
          const disabled = isEmergence || (!isPicked && remainingPicks === 0)
          return (
            <button
              key={id}
              type="button"
              className={`selpill ${isOn ? 'on' : ''}`.trim()}
              disabled={disabled}
              onClick={() => togglePick(id)}
              title={isEmergence ? 'Emerged during your Prelude' : null}
            >
              {prettifySkillId(id)}
              {isEmergence && (
                <span style={{ marginLeft: 6, fontSize: 9, fontStyle: 'italic' }}>
                  (Prelude)
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div className="fhelp">
        Skills you're proficient in. Each ties to one of your six abilities — pick the ones you've practiced or trained.
      </div>
    </div>
  )
}

function normalizeSkillId(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '_')
}
function prettifySkillId(id) {
  return String(id || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
