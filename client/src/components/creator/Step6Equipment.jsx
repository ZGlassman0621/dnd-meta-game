import { useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import classesData from '../../data/classes.json'
import { THEME_GOLD_MODIFIERS, applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { resolveOptionLabel, isProficiencyGated, ALL_WEAPONS, ALL_ARMOR } from './equipmentResolver.js'
import equipmentData from '../../data/equipment.json'

// Curated tool list from equipment.json + musical instruments. Both
// fall under "Tool" in the heirloom type taxonomy per spec §5.6.5.
const ALL_TOOLS = [
  ...((equipmentData.tools || []).map(t => ({ name: typeof t === 'string' ? t : t.name }))),
  ...((equipmentData.musicalInstruments || []).map(i => ({ name: typeof i === 'string' ? i : i.name })))
]

/**
 * Step 6 — Equipment. Per PHASE_2_CREATOR_SPEC.md §5.6.
 *
 * Three subsections in order:
 *   1. Class equipment package — per-class `startingEquipment.choices`
 *      from classes.json. Each choice is "choose 1 of N options".
 *   2. Starting gold — read-only display. `class baseline × (1 + theme
 *      modifier)`, three display variants per §7.1.4 (positive / zero /
 *      negative; negative uses U+2212 minus glyph).
 *   3. Heirloom flow — opt-in authoring (manual mode); handoff-mode
 *      candidate picker when payload.heirloom_candidates non-empty,
 *      else falls back to manual opt-in (graceful degradation per
 *      §5.6.3). Note: producer is deferred per Option A — handoff
 *      candidates are always empty until later work.
 */
export default function Step6Equipment({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'
  const cls = classesData[state.class_id]
  const themeId = state.theme_id || (isHandoff ? payload?.committed_theme : '')

  // --- Equipment-package picker -------------------------------------------
  // Each class has `startingEquipment.choices: [{ choose: 1, from: [...] }]`.
  // We render one row per choice; player picks one of the N options.
  const equipmentChoices = cls?.startingEquipment?.choices || []
  const equipmentPicks = state.equipment_picks || {}

  const setPick = (idx, value) => {
    set({ ...state, equipment_picks: { ...equipmentPicks, [idx]: value } })
  }

  // --- Gold calculation + 3-variant display ------------------------------
  const baselineGp = cls?.startingGold?.average || 0
  const modifier = THEME_GOLD_MODIFIERS[themeId] ?? 0
  const finalGp = applyGoldModifier(baselineGp, themeId)
  const themeName = useMemo(() => prettifyId(themeId), [themeId])
  const className = cls?.name || prettifyId(state.class_id)

  const goldLine = useMemo(() => {
    if (!cls) return null
    if (modifier === 0) {
      return `Starting gold: ${finalGp} gp (${className} baseline)`
    }
    if (modifier > 0) {
      const pct = Math.round(modifier * 100)
      return `Starting gold: ${finalGp} gp (${className} baseline ${baselineGp} gp + ${themeName} theme adjustment +${pct}%)`
    }
    // Negative — uses U+2212 minus glyph per §7.1.4, NOT a hyphen.
    const pct = Math.round(Math.abs(modifier) * 100)
    return `Starting gold: ${finalGp} gp (${className} baseline ${baselineGp} gp + ${themeName} theme adjustment −${pct}%)`
  }, [cls, modifier, finalGp, baselineGp, themeName, className])

  // --- Heirloom flow ------------------------------------------------------
  const heirloomCandidates = isHandoff ? (payload?.heirloom_candidates || []) : []
  const hasHandoffCandidates = heirloomCandidates.length > 0
  // Manual mode + handoff-mode-with-no-candidates both use the opt-in path.
  const useOptInPath = !hasHandoffCandidates

  return (
    <>
      <WizardHead
        stepNum={6}
        title="Equipment"
        subtitle="What you carry into the road ahead — the gear of your calling, the coin in your purse, and one thing of weight if you have it."
        mode={mode}
      />

      <div className="card">
        {/* --- Class equipment package -------------------------- */}
        {!cls ? (
          <Field label="Class equipment">
            <div className="help" style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
              Pick a class on Step 4 to see your equipment package options.
            </div>
          </Field>
        ) : (
          <Field
            label={`${className} starting equipment`}
            help="Choose your starting equipment. Most callings offer two equipment packages — pick the one that fits how you'll engage the world."
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {equipmentChoices.map((choice, idx) => {
                // Filter "(if proficient)" gates per PM ruling. Once
                // subclass-aware proficiency tracking lands, this filter
                // can flip to include-when-proficient. Hide for now to
                // avoid surfacing a confusing tag.
                const visibleOptions = (choice.from || []).filter(opt => !isProficiencyGated(opt))
                return (
                  <div key={idx}>
                    <div style={{
                      fontFamily: 'var(--sans)',
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--ink-3)',
                      marginBottom: 8
                    }}>
                      Pick one
                    </div>
                    <div className="picker two">
                      {visibleOptions.map((opt, i) => (
                        <EquipmentOptionCard
                          key={i}
                          label={opt}
                          picked={equipmentPicks[idx] === opt}
                          onPick={() => setPick(idx, opt)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </Field>
        )}

        <div className="hr soft" />

        {/* --- Starting gold display ------------------------------ */}
        <Field
          label="Starting gold"
          help="What you're bringing in coin from your previous life into the road ahead."
        >
          {!cls || !themeId ? (
            <div className="help" style={{ fontStyle: 'italic', color: 'var(--ink-3)' }}>
              Pick a class (Step 4) and a theme (Step 3) to see your starting gold.
            </div>
          ) : (
            <div style={{
              fontFamily: 'var(--serif)',
              fontSize: 19,
              color: 'var(--ink)',
              padding: '12px 0'
            }}>
              {goldLine}
            </div>
          )}
        </Field>

        <div className="hr soft" />

        {/* --- Heirloom flow ------------------------------------- */}
        <HeirloomFlow
          state={state}
          set={set}
          isHandoff={isHandoff}
          candidates={heirloomCandidates}
          useOptInPath={useOptInPath}
        />
      </div>
    </>
  )
}

/**
 * Heirloom subsection. Two paths:
 *
 * Handoff with candidates: render the candidate picker (pick one or
 * none). NOT REACHED today since the producer is deferred per Option A.
 *
 * Opt-in path (manual + handoff-with-zero-candidates): show the opt-in
 * prompt; if accepted, render the manual authoring form (name, type,
 * specific item per type, description, awakening hook).
 */
function HeirloomFlow({ state, set, isHandoff, candidates, useOptInPath }) {
  const heirloom = state.heirloom || null
  const optedIn = !!heirloom

  const startAuthoring = () => {
    set({
      ...state,
      heirloom: { name: '', type: '', specific_item: '', description: '', awakening_hook: '' }
    })
  }
  const cancelAuthoring = () => {
    set({ ...state, heirloom: null })
  }
  const updateHeirloom = (patch) => {
    set({ ...state, heirloom: { ...heirloom, ...patch } })
  }

  // --- Handoff candidate picker (not reached until producer lands) ---
  if (!useOptInPath) {
    return <HandoffCandidatePicker state={state} set={set} candidates={candidates} />
  }

  // --- Opt-in path -------------------------------------------------------
  return (
    <Field label="Heirloom (optional)">
      {!optedIn && (
        <div style={{
          padding: 32,
          background: 'var(--bg-2)',
          border: '1px dashed var(--rule)',
          textAlign: 'center'
        }}>
          {isHandoff ? (
            // Handoff-no-candidates path. Prelude didn't surface any
            // heirloom-eligible objects (graceful degradation per §5.6.3).
            <p style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              maxWidth: 580,
              margin: '0 auto 22px'
            }}>
              Your Prelude didn't surface a particular object as a marked
              keepsake — but if there's something you carry forward in
              spirit, you can author it here.
            </p>
          ) : (
            <p style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 18,
              lineHeight: 1.55,
              color: 'var(--ink-2)',
              maxWidth: 580,
              margin: '0 auto 22px'
            }}>
              Some travelers carry an heirloom — a sword from their grandfather, a book stolen from the library they grew up in, a piece of jewelry their mother wore. An heirloom is real gear in your hands now, and may reveal greater meaning over time as your story unfolds. Add an heirloom?
            </p>
          )}
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center' }}>
            <button type="button" className="btn primary" onClick={startAuthoring}>Add an heirloom</button>
            <button type="button" className="btn ghost" onClick={() => set({ ...state, heirloom: null })}>Skip</button>
          </div>
        </div>
      )}

      {optedIn && (
        <HeirloomAuthoringForm
          heirloom={heirloom}
          onChange={updateHeirloom}
          onCancel={cancelAuthoring}
        />
      )}
    </Field>
  )
}

/**
 * Manual-mode heirloom authoring form. Fields per spec §5.6.5:
 *   - name (text, required, max 64)
 *   - type (select, required) — 7 curated types
 *   - specific_item (conditional on type — see below)
 *   - description (textarea, required, soft 500 char limit)
 *   - awakening_hook (textarea, optional, soft 500 char limit)
 *
 * Specific-item conditional logic per §5.6.5 table:
 *   Weapon → select from equipment.json weapons (sets baseline combat stats)
 *   Armor → select from equipment.json armor (sets baseline AC)
 *   Tool → select from equipment.json tools
 *   Book/Tome → free text + optional spellcasting focus flag
 *   Jewelry / Trinket / Other → free text (no mechanical baseline)
 *
 * Real equipment.json filtering is engineering work that can land in a
 * batch 3 follow-up; current shape is a free-text fallback for the
 * specific item with type-aware help. This is honest about the gap
 * rather than faking a select with no data.
 */
function HeirloomAuthoringForm({ heirloom, onChange, onCancel }) {
  const types = ['Weapon', 'Armor', 'Book or Tome', 'Jewelry', 'Tool', 'Trinket', 'Other']
  const specificItemHelp = {
    Weapon: 'The underlying weapon (e.g., longsword, shortbow). Sets baseline combat stats.',
    Armor: 'The underlying armor (e.g., chain shirt, leather). Sets baseline AC.',
    Tool: 'The underlying tool (artisan tools, instrument, etc.). Tool benefits per chosen tool.',
    'Book or Tome': 'Free text. If your class accepts a spellcasting focus, this can serve as one.',
    Jewelry: 'Free text. No mechanical baseline.',
    Trinket: 'Free text. No mechanical baseline.',
    Other: 'Free text. No mechanical baseline.'
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 18
      }}>
        <span className="label" style={{ fontSize: 11 }}>Authoring an heirloom</span>
        <button type="button" className="btn ghost danger" onClick={onCancel}>Cancel heirloom</button>
      </div>

      <Field label="Name" help="What you call it.">
        <input
          type="text"
          className="input"
          value={heirloom.name || ''}
          onChange={e => onChange({ name: e.target.value })}
          maxLength={64}
          placeholder="—"
        />
      </Field>

      <Field label="Type">
        <select
          className="select"
          value={heirloom.type || ''}
          onChange={e => onChange({ type: e.target.value, specific_item: '' })}
        >
          <option value="">Choose a type…</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </Field>

      {heirloom.type && (
        <Field label="Specific item" help={specificItemHelp[heirloom.type]}>
          <SpecificItemPicker
            type={heirloom.type}
            value={heirloom.specific_item || ''}
            onChange={v => onChange({ specific_item: v })}
          />
        </Field>
      )}

      <Field label="Description" help="What it is and why it matters to you. A few sentences.">
        <textarea
          className="textarea"
          value={heirloom.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          maxLength={1000}
          placeholder="—"
        />
      </Field>

      <Field
        label="Awakening hook (optional)"
        help="Optional. If you have a sense of what could draw out this object's deeper meaning — a place, a person, a moment — describe it here. Leave blank if you'd rather let the object find its own time."
      >
        <textarea
          className="textarea"
          value={heirloom.awakening_hook || ''}
          onChange={e => onChange({ awakening_hook: e.target.value })}
          maxLength={1000}
          placeholder="—"
        />
      </Field>
    </div>
  )
}

/**
 * Handoff candidate picker. Surfaces 1–3 heirloom candidates from the
 * Prelude payload; player picks one to carry forward, or none. Not
 * reached today since the producer is deferred per Option A — kept
 * wired so it lights up automatically when producer-side work lands.
 */
function HandoffCandidatePicker({ state, set, candidates }) {
  const pickedId = state.heirloom_candidate_id || null

  return (
    <Field
      label={`In the years behind you, ${candidates.length} ${candidates.length === 1 ? 'object' : 'objects'} came into your hands`}
      help="Carry one of them forward — or leave them all behind, if you'd rather travel light."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {candidates.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => set({ ...state, heirloom_candidate_id: c.id })}
            style={{
              border: pickedId === c.id ? '1px solid var(--accent)' : '1px solid var(--rule)',
              borderLeft: pickedId === c.id ? '3px solid var(--accent)' : '1px solid var(--rule)',
              background: pickedId === c.id ? 'var(--bg-2)' : 'var(--bg-card)',
              padding: '22px 26px',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all .12s'
            }}
          >
            <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--ink)', letterSpacing: '-0.005em' }}>
              {c.name}
            </div>
            {c.type && (
              <div style={{
                fontFamily: 'var(--sans)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--ink-3)',
                marginTop: 2
              }}>
                {c.type}
              </div>
            )}
            {c.description && (
              <div style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 16,
                lineHeight: 1.5,
                color: 'var(--ink-2)',
                marginTop: 12
              }}>
                {c.description}
              </div>
            )}
            {c.awakening_hook && (
              <div style={{
                marginTop: 14,
                paddingTop: 12,
                borderTop: '1px dashed var(--rule)',
                fontFamily: 'var(--serif)',
                fontSize: 15,
                fontStyle: 'italic',
                color: 'var(--ink-3)'
              }}>
                <span style={{
                  fontFamily: 'var(--sans)',
                  fontStyle: 'normal',
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: 'var(--accent)'
                }}>
                  Awakening hook —{' '}
                </span>
                {c.awakening_hook}
              </div>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={() => set({ ...state, heirloom_candidate_id: null })}
          className={`btn ghost ${pickedId == null ? 'primary' : ''}`}
          style={{ alignSelf: 'flex-start', marginTop: 8 }}
        >
          Carry none of them forward
        </button>
      </div>
    </Field>
  )
}

function prettifyId(id) {
  return String(id || '').split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Specific-item picker for the heirloom authoring form. Spec §5.6.5:
 *   Weapon → select from equipment.json weapons
 *   Armor → select from equipment.json armor
 *   Tool → select from equipment.json tools (artisan + instruments)
 *   Book or Tome / Jewelry / Trinket / Other → free text
 *
 * For weapons/armor: shows the underlying combat stats inline below
 * the select once an item is picked, so the player sees what mechanical
 * baseline they're committing to.
 */
function SpecificItemPicker({ type, value, onChange }) {
  if (type === 'Weapon') {
    return (
      <>
        <select className="select" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Choose a weapon…</option>
          <optgroup label="Simple — melee">
            {(equipmentData.simpleWeapons?.melee || []).map(w => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </optgroup>
          <optgroup label="Simple — ranged">
            {(equipmentData.simpleWeapons?.ranged || []).map(w => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </optgroup>
          <optgroup label="Martial — melee">
            {(equipmentData.martialWeapons?.melee || []).map(w => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </optgroup>
          <optgroup label="Martial — ranged">
            {(equipmentData.martialWeapons?.ranged || []).map(w => (
              <option key={w.name} value={w.name}>{w.name}</option>
            ))}
          </optgroup>
        </select>
        {value && (() => {
          const w = ALL_WEAPONS.find(it => it.name === value)
          if (!w) return null
          return (
            <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
              {w.damage} {w.damageType}
              {w.properties?.length > 0 && ` · ${w.properties.join(', ')}`}
              {w.weaponType && ` · ${w.weaponType}`}
              {w.range && ` · range ${w.range}`}
            </div>
          )
        })()}
      </>
    )
  }
  if (type === 'Armor') {
    return (
      <>
        <select className="select" value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Choose armor…</option>
          {['light', 'medium', 'heavy', 'shields'].map(group => (
            <optgroup key={group} label={group.charAt(0).toUpperCase() + group.slice(1)}>
              {(equipmentData.armor?.[group] || []).map(a => (
                <option key={a.name} value={a.name}>{a.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {value && (() => {
          const a = ALL_ARMOR.find(it => it.name === value)
          if (!a) return null
          return (
            <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
              AC {a.baseAC}
              {a.maxDexBonus > 0 && ` + DEX (max ${a.maxDexBonus})`}
              {a.armorType && ` · ${a.armorType}`}
              {a.strReq && ` · STR ${a.strReq} required`}
              {a.stealthDisadvantage && ' · stealth disadvantage'}
            </div>
          )
        })()}
      </>
    )
  }
  if (type === 'Tool') {
    return (
      <select className="select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">Choose a tool…</option>
        {ALL_TOOLS.map(t => (
          <option key={t.name} value={t.name}>{t.name}</option>
        ))}
      </select>
    )
  }
  // Book or Tome / Jewelry / Trinket / Other → free text per spec §5.6.5
  return (
    <input
      type="text"
      className="input"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="—"
    />
  )
}

/**
 * Equipment option card with inline weapon/armor stats + pack contents.
 * Resolves the option label against equipment.json so the player sees
 * what they're picking — damage/properties for weapons, AC/strength
 * requirement for armor, contents list for packs.
 */
function EquipmentOptionCard({ label, picked, onPick }) {
  const resolved = useMemo(() => resolveOptionLabel(label), [label])
  return (
    <button
      type="button"
      className={`pick ${picked ? 'on' : ''}`}
      onClick={onPick}
      style={{ alignItems: 'flex-start' }}
    >
      <div className="name" style={{ fontSize: 17 }}>{label}</div>
      {/* Item-level details (weapons + armor stats) */}
      {resolved.items.map((item, i) => (
        <div
          key={i}
          style={{
            marginTop: i === 0 ? 8 : 4,
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.4
          }}
        >
          {item.kind === 'weapon' && (
            <span>
              {item.qty > 1 ? `${item.qty}× ` : ''}<strong style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{item.name}</strong>
              {' — '}{item.stats.damage} {item.stats.damageType}
              {item.stats.properties?.length > 0 && (
                <span style={{ color: 'var(--ink-3)' }}>
                  {' · '}{item.stats.properties.join(', ')}
                </span>
              )}
            </span>
          )}
          {item.kind === 'armor' && (
            <span>
              <strong style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{item.name}</strong>
              {' — AC '}{item.stats.baseAC}
              {item.stats.maxDexBonus > 0 && ` + DEX (max ${item.stats.maxDexBonus})`}
              {item.stats.maxDexBonus === 0 && item.stats.armorType === 'heavy' && ' (no DEX)'}
              {item.stats.strReq && ` · STR ${item.stats.strReq} required`}
              {item.stats.stealthDisadvantage && ' · stealth disadvantage'}
            </span>
          )}
          {item.kind === 'pack' && (
            <span>
              {item.cost && <span style={{ color: 'var(--ink-3)' }}>{item.cost} value</span>}
            </span>
          )}
          {item.kind === 'other' && item.qty > 1 && (
            <span>
              {item.qty}× <strong style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{item.name}</strong>
            </span>
          )}
        </div>
      ))}
      {/* Pack contents — bulleted list inside the card */}
      {resolved.packContents && resolved.packContents.length > 0 && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--rule-soft)',
            width: '100%'
          }}
        >
          <div style={{
            fontFamily: 'var(--sans)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--ink-3)',
            marginBottom: 6
          }}>
            Contains
          </div>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            fontFamily: 'var(--serif)',
            fontSize: 13,
            color: 'var(--ink-2)',
            lineHeight: 1.45,
            columns: resolved.packContents.length > 6 ? 2 : 1,
            columnGap: 18
          }}>
            {resolved.packContents.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
    </button>
  )
}
