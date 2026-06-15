import { useState, useEffect, useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import { ABILITY_KEYS, ABILITY_LABELS } from './BumpCelebrationCard.jsx'
import racesData from '../../data/races.json'
import classesData from '../../data/classes.json'
import featsData from '../../data/feats.json'

const VH_FEAT_SOURCE = 'variant_human'
const ABILITY_NAME_TO_KEY = {
  strength: 'str', dexterity: 'dex', constitution: 'con',
  intelligence: 'int', wisdom: 'wis', charisma: 'cha'
}

/**
 * Evaluate a free-text feat prerequisite against the character's current scores.
 * Only ability-score prereqs ("Dexterity 13 or higher", "Intelligence or Wisdom
 * 13 or higher") are auto-checked; proficiency / spellcasting prereqs can't be
 * reliably verified at creation, so they surface as a caption but don't block.
 */
function evalFeatPrereq(prereq, scoreFor) {
  if (!prereq) return { met: true, kind: 'none' }
  const text = String(prereq)
  const m = text.match(/(\d+)\s*or higher/i)
  if (m) {
    const threshold = parseInt(m[1], 10)
    const names = (text.match(/strength|dexterity|constitution|intelligence|wisdom|charisma/gi) || [])
      .map(s => s.toLowerCase())
    if (names.length) {
      const met = names.some(n => (scoreFor(ABILITY_NAME_TO_KEY[n]) ?? 0) >= threshold)
      return { met, kind: 'ability' }
    }
  }
  return { met: true, kind: 'other' }
}

/**
 * Step 5 — Ability Scores. Per PHASE_2_CREATOR_SPEC.md §5.5.
 *
 * Subsections:
 *   1. Generation method (Standard Array / Manual)
 *   2. Ability score assignment (six rows)
 *   3. Skills picker (within class allotment)
 *   4. Variant Human bonus general feat — when race=human + subrace=Variant Human
 *
 * Decision E (DECISION_LOG 2026-04-30): L1 cap is 18 — base + racial
 * clamped at 18 visibly (not silently). Base range is 3–20 per §5.5.7
 * (intentionally wide for roleplay-driven custom builds).
 *
 * Hearth render: the design's pane-5 ability allocator — a `.seg`
 * method toggle, an `.alloc-status` strip, and an `.alloc` of `.arow`
 * rows (.aname + .agov governance line + .actl control + .amod modifier).
 * Standard-array rows use `.aselect`; manual rows reuse the array
 * controls in numeric form. App-specific sections (racial choice, skills,
 * Variant Human) ride below in `.block`/`.field` Hearth primitives.
 */
export default function Step5AbilityScores({ state, set, mode, payload }) {
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
    const raw = (base ?? 0) + racialTotal
    const clamped = Math.min(18, raw)
    return { base, racialTotal, bumpTotal: 0, raw, clamped, wouldOverflow: raw > 18 }
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

  // --- Variant Human bonus general feat -----------------------------------
  const featList = useMemo(
    () => Object.entries(featsData)
      .map(([key, f]) => ({ key, ...f }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    []
  )
  const selectedVhFeat = (state.feats || []).find(f => f.source === VH_FEAT_SOURCE) || null
  // Effective score for prereq checks: base + racial (the same clamped value the
  // allocator shows). computeFinal is defined above.
  const scoreFor = (k) => computeFinal(k).clamped
  const setVhFeat = (next) => {
    const others = (state.feats || []).filter(f => f.source !== VH_FEAT_SOURCE)
    set({ ...state, feats: next ? [...others, next] : others })
  }
  const pickVhFeat = (key) => {
    const f = featsData[key]
    if (!f) return
    let abilityChoice = null
    if (f.abilityIncrease) {
      if (f.abilityIncrease.ability) abilityChoice = f.abilityIncrease.ability
      else if (Array.isArray(f.abilityIncrease.choice)) abilityChoice = f.abilityIncrease.choice[0]
    }
    setVhFeat({ key, name: f.name, abilityChoice, choices: null, acquiredAtLevel: 1, source: VH_FEAT_SOURCE })
  }
  // Drop a stale Variant-Human feat if the character is no longer a Variant Human
  // (e.g. they changed race/subrace after picking one).
  useEffect(() => {
    if (!isVariantHuman && (state.feats || []).some(f => f.source === VH_FEAT_SOURCE)) {
      set({ ...state, feats: (state.feats || []).filter(f => f.source !== VH_FEAT_SOURCE) })
    }
  }, [isVariantHuman]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <WizardHead
        stepNum={5}
        title="Six numbers, and the moments behind them."
        subtitle="A primary you'll lean on, ★, and one you can let lie, ✗. Place each number where it counts."
        mode={mode}
      />

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

      {/* --- Rogue Expertise (picks from the skills chosen above) --- */}
      <ExpertisePicker state={state} set={set} />

      {/* --- Variant Human bonus general feat -------------------- */}
      {isVariantHuman && (
        <div className="block" style={{ marginTop: 30 }}>
          <div className="block-label">
            <span className="l">Variant Human bonus feat</span>
            <span className="hint">a self-taught talent that sets you apart</span>
          </div>
          <div className="fhelp" style={{ marginTop: 0, marginBottom: 10 }}>
            Variant Humans begin with one general feat. Feats your current scores don't qualify for are dimmed.
          </div>
          <div className="opt-grid c2" role="radiogroup" aria-label="Bonus feat">
            {featList.map(f => {
              const pr = evalFeatPrereq(f.prerequisites, scoreFor)
              const sel = selectedVhFeat?.key === f.key
              const disabled = !sel && !pr.met
              return (
                <button
                  key={f.key}
                  type="button"
                  className={`opt ${sel ? 'sel' : ''}`.trim()}
                  role="radio"
                  aria-checked={sel}
                  disabled={disabled}
                  onClick={() => (sel ? setVhFeat(null) : pickVhFeat(f.key))}
                >
                  <div className="ot">{f.name}</div>
                  {f.prerequisites ? (
                    <div className="od" style={{ color: pr.met ? undefined : '#b4543a' }}>
                      Requires: {f.prerequisites}
                    </div>
                  ) : (
                    Array.isArray(f.benefits) && f.benefits[0] && <div className="od">{f.benefits[0]}</div>
                  )}
                </button>
              )
            })}
          </div>

          {selectedVhFeat && (() => {
            const f = featsData[selectedVhFeat.key]
            const choiceAbilities = (f?.abilityIncrease && Array.isArray(f.abilityIncrease.choice))
              ? f.abilityIncrease.choice
              : null
            return (
              <div className="reveal" style={{ marginTop: 12 }}>
                <div className="trait-card">
                  <div>
                    <div className="tt">{f?.name}<span className="src">Bonus feat</span></div>
                    {Array.isArray(f?.benefits) && (
                      <ul className="td" style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {f.benefits.map((b, i) => <li key={i}>{b}</li>)}
                      </ul>
                    )}
                    {choiceAbilities && (
                      <div style={{ marginTop: 10 }}>
                        <div className="fhelp" style={{ marginTop: 0 }}>This feat grants +1 to one ability — choose:</div>
                        <div className="pillrow">
                          {choiceAbilities.map(ab => (
                            <button
                              key={ab}
                              type="button"
                              className={`selpill ${selectedVhFeat.abilityChoice === ab ? 'on' : ''}`.trim()}
                              onClick={() => setVhFeat({ ...selectedVhFeat, abilityChoice: ab })}
                            >
                              {ABILITY_LABELS[ab] || ab.toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })()}
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
 * Skills picker. Pick `class.skillChoices` skills from `class.skillOptions`.
 *
 * Class/theme/ancestry-granted skills not yet wired — those would
 * pre-check as "granted" (read-only). Listed in spec §5.5.7 as
 * engineering-confirm-against-data work; left for batch 3 follow-up.
 */
function SkillsPicker({ state, set, mode, payload }) {
  const cls = classesData[state.class_id]
  const allowedSkillIds = (cls?.skillOptions || []).map(s => normalizeSkillId(s))
  const choiceCount = cls?.skillChoices ?? 2

  const picked = state.selected_skills || []
  const remainingPicks = Math.max(0, choiceCount - picked.length)

  const togglePick = (id) => {
    if (picked.includes(id)) {
      set({ ...state, selected_skills: picked.filter(p => p !== id) })
    } else if (picked.length < choiceCount) {
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
        <span className="hint">pick {remainingPicks} more</span>
      </div>
      <div className="pillrow">
        {allowedSkillIds.map(id => {
          const isPicked = picked.includes(id)
          const disabled = !isPicked && remainingPicks === 0
          return (
            <button
              key={id}
              type="button"
              className={`selpill ${isPicked ? 'on' : ''}`.trim()}
              disabled={disabled}
              onClick={() => togglePick(id)}
            >
              {prettifySkillId(id)}
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

/**
 * Rogue Expertise — pick 2 of the skills chosen in the skills picker above to
 * double the proficiency bonus on. Rogue is the only L1 Expertise class (Bard's
 * is at L3). Picks persist as normalized skill ids in state.expertise.
 */
function ExpertisePicker({ state, set }) {
  const isRogue = state.class_id === 'rogue'
  const EXPERTISE_COUNT = 2
  const proficientSkills = state.selected_skills || []
  const expertise = state.expertise || []

  // Prune expertise picks that are no longer among the chosen skills.
  useEffect(() => {
    if (!isRogue) return
    const valid = (state.expertise || []).filter(s => (state.selected_skills || []).includes(s))
    if (valid.length !== (state.expertise || []).length) set({ ...state, expertise: valid })
  }, [state.selected_skills, isRogue]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!isRogue) return null

  const remaining = Math.max(0, EXPERTISE_COUNT - expertise.length)
  const toggle = (id) => {
    if (expertise.includes(id)) set({ ...state, expertise: expertise.filter(e => e !== id) })
    else if (expertise.length < EXPERTISE_COUNT) set({ ...state, expertise: [...expertise, id] })
  }

  return (
    <div className="block" style={{ marginTop: 30 }}>
      <div className="block-label">
        <span className="l">Expertise</span>
        <span className="hint">
          {proficientSkills.length === 0 ? 'pick your skills first' : (remaining > 0 ? `choose ${remaining} more` : '2 chosen')}
        </span>
      </div>
      {proficientSkills.length === 0 ? (
        <div className="fhelp" style={{ marginTop: 0 }}>
          Rogues double their proficiency on two skills. Pick your skills above first, then choose two for Expertise.
        </div>
      ) : (
        <>
          <div className="pillrow">
            {proficientSkills.map(id => {
              const on = expertise.includes(id)
              const disabled = !on && remaining === 0
              return (
                <button
                  key={id}
                  type="button"
                  className={`selpill ${on ? 'on' : ''}`.trim()}
                  disabled={disabled}
                  onClick={() => toggle(id)}
                >
                  {prettifySkillId(id)}
                </button>
              )
            })}
          </div>
          <div className="fhelp">Your proficiency bonus is doubled for ability checks with these two skills.</div>
        </>
      )}
    </div>
  )
}

function normalizeSkillId(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '_')
}
function prettifySkillId(id) {
  return String(id || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
