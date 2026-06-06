import { useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import classesData from '../../data/classes.json'
import { THEME_GOLD_MODIFIERS, applyGoldModifier } from '../../data/themeGoldModifiers.js'
import { resolveOptionLabel, isProficiencyGated, getFocusDescription, getWeaponChoiceList, ALL_WEAPONS, ALL_ARMOR } from './equipmentResolver.js'
import equipmentData from '../../data/equipment.json'

// Curated tool list from equipment.json + musical instruments. Both
// fall under "Tool" in the heirloom type taxonomy per spec §5.6.5.
// `equipment.json.tools` is grouped (artisansTools / gamingSets /
// otherTools) — flatten across groups; entries can be strings or
// objects with a `name` field.
const ALL_TOOLS = (() => {
  const out = []
  const toolsGroups = equipmentData.tools || {}
  for (const groupKey of Object.keys(toolsGroups)) {
    const group = toolsGroups[groupKey]
    if (!Array.isArray(group)) continue
    for (const t of group) {
      out.push({ name: typeof t === 'string' ? t : (t?.name || String(t)) })
    }
  }
  for (const i of (equipmentData.musicalInstruments || [])) {
    out.push({ name: typeof i === 'string' ? i : (i?.name || String(i)) })
  }
  return out
})()

/**
 * Step 6 — Equipment. Per PHASE_2_CREATOR_SPEC.md §5.6.
 *
 * HEARTH-converted render (mockup pane data-pane="6"): the step header is
 * the WizardHead primitive (.step-eyebrow + h1 + subtitle); content is
 * organized into design `.block` sections (.block-label caption + body):
 *
 *   1. "Granted by your class" — per-class `startingEquipment.choices`
 *      from classes.json, each "choose 1 of N" rendered as an .opt-grid
 *      of selectable .opt cards (the design's pack-chooser pattern). Each
 *      class has its own choice rows (weapons, packs, foci, armor), so
 *      this subsumes the mockup's separate "Choose a pack" block.
 *   2. "Your purse" — starting gold rendered in the design's accent
 *      .trait-card (i-coin). `class baseline × (1 + theme modifier)`,
 *      three display variants per §7.1.4 (positive / zero / negative;
 *      negative uses U+2212 minus glyph).
 *   3. "One thing of weight" — heirloom flow rendered in the design's
 *      .prompt-card. Opt-in authoring (manual mode); handoff-mode
 *      candidate picker when payload.heirloom_candidates non-empty, else
 *      falls back to manual opt-in (graceful degradation per §5.6.3).
 *      Note: producer is deferred per Option A — handoff candidates are
 *      always empty until later work.
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
  const equipmentSubpicks = state.equipment_subpicks || {}

  const setPick = (idx, value) => {
    // Switching to a different option clears the subpick from the previous one.
    const nextSubpicks = { ...equipmentSubpicks }
    if (equipmentPicks[idx] !== value) delete nextSubpicks[idx]
    set({ ...state, equipment_picks: { ...equipmentPicks, [idx]: value }, equipment_subpicks: nextSubpicks })
  }
  const setSubpick = (idx, weaponName) => {
    set({ ...state, equipment_subpicks: { ...equipmentSubpicks, [idx]: weaponName } })
  }

  // --- Gold calculation + 3-variant display ------------------------------
  const baselineGp = cls?.startingGold?.average || 0
  const modifier = THEME_GOLD_MODIFIERS[themeId] ?? 0
  const finalGp = applyGoldModifier(baselineGp, themeId)
  const themeName = useMemo(() => prettifyId(themeId), [themeId])
  const className = cls?.name || prettifyId(state.class_id)

  // The accent purse card splits the headline number from the supporting
  // prose. `goldValue` is the headline ("12 gp"); `goldNote` is the
  // italic explanation underneath (baseline + theme adjustment), with the
  // three §7.1.4 variants (positive / zero / negative U+2212 glyph).
  const goldValue = useMemo(() => (cls && themeId ? `${finalGp} gp` : null), [cls, themeId, finalGp])
  const goldNote = useMemo(() => {
    if (!cls || !themeId) return null
    if (modifier === 0) {
      return `${className} baseline.`
    }
    if (modifier > 0) {
      const pct = Math.round(modifier * 100)
      return `${className} baseline ${baselineGp} gp + ${themeName} theme adjustment +${pct}%.`
    }
    // Negative — uses U+2212 minus glyph per §7.1.4, NOT a hyphen.
    const pct = Math.round(Math.abs(modifier) * 100)
    return `${className} baseline ${baselineGp} gp + ${themeName} theme adjustment −${pct}%.`
  }, [cls, themeId, modifier, baselineGp, themeName, className])

  // --- Heirloom flow ------------------------------------------------------
  const heirloomCandidates = isHandoff ? (payload?.heirloom_candidates || []) : []
  const hasHandoffCandidates = heirloomCandidates.length > 0
  // Manual mode + handoff-mode-with-no-candidates both use the opt-in path.
  const useOptInPath = !hasHandoffCandidates

  return (
    <>
      <WizardHead
        stepNum={6}
        title="The gear of your calling."
        subtitle="What you carry into the road ahead — the gear of your calling, the coin in your purse, and one thing of weight if you have it."
        mode={mode}
      />

      {/* --- Class equipment package ----------------------------------- */}
      <div className="block">
        <div className="block-label">
          <span className="l">Granted by your class</span>
          {cls && <span className="hint">choose the kit that fits how you'll engage the world</span>}
        </div>

        {!cls ? (
          <div className="trait-card">
            <div>
              <div className="td" style={{ fontStyle: 'italic' }}>
                Pick a class on Step 4 to see your equipment package options.
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {equipmentChoices.map((choice, idx) => {
              // Filter "(if proficient)" gates per PM ruling. Once
              // subclass-aware proficiency tracking lands, this filter
              // can flip to include-when-proficient. Hide for now to
              // avoid surfacing a confusing tag.
              const visibleOptions = (choice.from || []).filter(opt => !isProficiencyGated(opt))
              return (
                <div key={idx}>
                  <div className="block-label" style={{ marginBottom: 11 }}>
                    <span className="l">Pick one</span>
                  </div>
                  <div className="opt-grid c2" role="radiogroup" aria-label="Equipment choice">
                    {visibleOptions.map((opt, i) => (
                      <EquipmentOptionCard
                        key={i}
                        label={opt}
                        picked={equipmentPicks[idx] === opt}
                        subpick={equipmentSubpicks[idx]}
                        onPick={() => setPick(idx, opt)}
                        onSubpick={(weaponName) => setSubpick(idx, weaponName)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* --- Starting gold ("Your purse") ------------------------------ */}
      <div className="block">
        <div className="block-label">
          <span className="l">Your purse</span>
          <span className="hint">what you're bringing in coin into the road ahead</span>
        </div>
        {!cls || !themeId ? (
          <div className="trait-card">
            <div>
              <div className="td" style={{ fontStyle: 'italic' }}>
                Pick a class (Step 4) and a theme (Step 3) to see your starting gold.
              </div>
            </div>
          </div>
        ) : (
          <div
            className="trait-card"
            style={{
              borderColor: 'color-mix(in oklab, var(--accent) 28%, var(--rule))',
              background: 'color-mix(in oklab, var(--accent) 7%, var(--bg-2))'
            }}
          >
            <span className="ti" style={{ color: 'var(--accent)' }}>
              <svg className="ic"><use href="#i-coin" /></svg>
            </span>
            <div>
              <div className="tt" style={{ color: 'var(--accent)' }}>
                {goldValue}
                <span className="src" style={{ color: 'var(--ink-3)' }}>starting coin</span>
              </div>
              <div className="td">{goldNote}</div>
            </div>
          </div>
        )}
      </div>

      {/* --- Heirloom flow ("One thing of weight") --------------------- */}
      <HeirloomFlow
        state={state}
        set={set}
        isHandoff={isHandoff}
        candidates={heirloomCandidates}
        useOptInPath={useOptInPath}
      />

      {/* icon sprite for this step's trait-card glyphs (copied from the
          design's <defs>; the shell only injects the chrome arrows). */}
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
        <symbol id="i-coin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" /></symbol>
        <symbol id="i-feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></symbol>
      </defs></svg>
    </>
  )
}

/**
 * Heirloom subsection ("One thing of weight"). Two paths:
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
  const skipped = !!state.heirloom_skipped

  const startAuthoring = () => {
    set({
      ...state,
      heirloom_skipped: false,
      heirloom: { name: '', type: '', specific_item: '', description: '', awakening_hook: '' }
    })
  }
  const cancelAuthoring = () => {
    set({ ...state, heirloom: null })
  }
  const skipHeirloom = () => {
    set({ ...state, heirloom: null, heirloom_skipped: true })
  }
  const reopenPrompt = () => {
    set({ ...state, heirloom_skipped: false })
  }
  const updateHeirloom = (patch) => {
    set({ ...state, heirloom: { ...heirloom, ...patch } })
  }

  // --- Handoff candidate picker (not reached until producer lands) ---
  if (!useOptInPath) {
    return (
      <div className="block" style={{ marginBottom: 0 }}>
        <div className="block-label">
          <span className="l">One thing of weight</span>
          <span className="hint">it does nothing in combat. it means everything.</span>
        </div>
        <HandoffCandidatePicker state={state} set={set} candidates={candidates} />
      </div>
    )
  }

  // --- Opt-in path -------------------------------------------------------
  return (
    <div className="block" style={{ marginBottom: 0 }}>
      <div className="block-label">
        <span className="l">One thing of weight</span>
        <span className="hint">it does nothing in combat. it means everything.</span>
      </div>

      {skipped && (
        <div className="prompt-card" style={{ borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div className="chosen empty" style={{ minHeight: 0 }}>
              No heirloom — you set out unburdened.
            </div>
            <button type="button" className="btn ghost" onClick={reopenPrompt}>Change my mind</button>
          </div>
        </div>
      )}

      {!optedIn && !skipped && (
        <div className="prompt-card">
          <div className="pch">
            <span className="pl">What you carry</span>
            <span className="edge" style={{ background: 'var(--accent)' }} />
          </div>
          {isHandoff ? (
            // Handoff-no-candidates path. Prelude didn't surface any
            // heirloom-eligible objects (graceful degradation per §5.6.3).
            <div className="chosen empty">
              Your Prelude didn't surface a particular object as a marked keepsake —
              but if there's something you carry forward in spirit, you can author it here.
            </div>
          ) : (
            <div className="chosen empty">
              Some travelers carry an heirloom — a sword from their grandfather, a book
              stolen from the library they grew up in, a piece of jewelry their mother
              wore. An heirloom is real gear in your hands now, and may reveal greater
              meaning over time as your story unfolds.
            </div>
          )}
          <div className="prompt-list" style={{ flexDirection: 'row', gap: 14, paddingTop: 13 }}>
            <button type="button" className="btn primary" onClick={startAuthoring}>Add an heirloom</button>
            <button type="button" className="btn ghost" onClick={skipHeirloom}>Skip</button>
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
    </div>
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
    <div className="prompt-card" style={{ marginTop: 12 }}>
      <div className="pch" style={{ marginBottom: 16 }}>
        <span className="pl">Authoring an heirloom</span>
        <button type="button" className="btn ghost danger" onClick={onCancel} style={{ marginLeft: 'auto' }}>
          Cancel heirloom
        </button>
      </div>

      <div className="field">
        <span className="fl">Name</span>
        <input
          type="text"
          className="finput"
          value={heirloom.name || ''}
          onChange={e => onChange({ name: e.target.value })}
          maxLength={64}
          placeholder="What you call it"
        />
        <div className="fhelp">What you call it.</div>
      </div>

      <div className="field">
        <span className="fl">Type</span>
        <select
          className="aselect"
          style={{ width: '100%' }}
          value={heirloom.type || ''}
          onChange={e => onChange({ type: e.target.value, specific_item: '' })}
        >
          <option value="">Choose a type…</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {heirloom.type && (
        <div className="field">
          <span className="fl">Specific item</span>
          <SpecificItemPicker
            type={heirloom.type}
            value={heirloom.specific_item || ''}
            onChange={v => onChange({ specific_item: v })}
          />
          <div className="fhelp">{specificItemHelp[heirloom.type]}</div>
        </div>
      )}

      <div className="field">
        <span className="fl">Description</span>
        <textarea
          className="finput"
          style={{ minHeight: 96, resize: 'vertical', lineHeight: 1.5 }}
          value={heirloom.description || ''}
          onChange={e => onChange({ description: e.target.value })}
          maxLength={1000}
          placeholder="What it is and why it matters to you"
        />
        <div className="fhelp">What it is and why it matters to you. A few sentences.</div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <span className="fl">Awakening hook (optional)</span>
        <textarea
          className="finput"
          style={{ minHeight: 96, resize: 'vertical', lineHeight: 1.5 }}
          value={heirloom.awakening_hook || ''}
          onChange={e => onChange({ awakening_hook: e.target.value })}
          maxLength={1000}
          placeholder="Leave blank to let the object find its own time"
        />
        <div className="fhelp">
          Optional. If you have a sense of what could draw out this object's deeper
          meaning — a place, a person, a moment — describe it here. Leave blank if you'd
          rather let the object find its own time.
        </div>
      </div>
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
    <>
      <p className="fhelp" style={{ marginTop: 0, marginBottom: 14 }}>
        In the years behind you, {candidates.length} {candidates.length === 1 ? 'object' : 'objects'}{' '}
        came into your hands. Carry one of them forward — or leave them all behind, if
        you'd rather travel light.
      </p>
      <div className="opt-grid" role="radiogroup" aria-label="Heirloom candidates">
        {candidates.map(c => (
          <button
            key={c.id}
            type="button"
            className={`opt ${pickedId === c.id ? 'sel' : ''}`}
            role="radio"
            aria-checked={pickedId === c.id}
            onClick={() => set({ ...state, heirloom_candidate_id: c.id })}
          >
            <div className="ot">{c.name}</div>
            {c.type && <div className="ometa">{c.type}</div>}
            {c.description && (
              <div className="od" style={{ fontStyle: 'italic', marginTop: 8 }}>{c.description}</div>
            )}
            {c.awakening_hook && (
              <div
                className="od"
                style={{
                  marginTop: 12,
                  paddingTop: 11,
                  borderTop: '1px dashed var(--rule-soft)',
                  fontStyle: 'italic'
                }}
              >
                <span style={{
                  fontFamily: 'var(--mono)',
                  fontStyle: 'normal',
                  fontSize: 9.5,
                  letterSpacing: '0.08em',
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
      </div>
      <button
        type="button"
        onClick={() => set({ ...state, heirloom_candidate_id: null })}
        className={`btn ghost ${pickedId == null ? 'primary' : ''}`}
        style={{ alignSelf: 'flex-start', marginTop: 12 }}
      >
        Carry none of them forward
      </button>
    </>
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
        <select className="aselect" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
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
            <div className="fhelp" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
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
        <select className="aselect" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
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
            <div className="fhelp" style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>
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
      <select className="aselect" style={{ width: '100%' }} value={value} onChange={e => onChange(e.target.value)}>
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
      className="finput"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder="Name it"
    />
  )
}

/**
 * Equipment option card with inline weapon/armor stats + pack contents.
 * Resolves the option label against equipment.json so the player sees
 * what they're picking — damage/properties for weapons, AC/strength
 * requirement for armor, contents list for packs. Rendered as a Hearth
 * `.opt` card (selected → `.sel`).
 */
function EquipmentOptionCard({ label, picked, subpick, onPick, onSubpick }) {
  const resolved = useMemo(() => resolveOptionLabel(label), [label])
  const focusDescription = useMemo(() => getFocusDescription(label), [label])
  const weaponChoiceList = useMemo(() => getWeaponChoiceList(label), [label])
  const subPickedWeapon = useMemo(
    () => (weaponChoiceList && subpick) ? weaponChoiceList.find(w => w.name === subpick) : null,
    [weaponChoiceList, subpick]
  )
  return (
    <div
      className={`opt ${picked ? 'sel' : ''}`}
      onClick={onPick}
      role="radio"
      aria-checked={picked}
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick() } }}
    >
      <div className="ot">{label}</div>
      {/* Item-level details (weapons + armor stats) */}
      {resolved.items.map((item, i) => (
        <div
          key={i}
          className="od"
          style={{ fontStyle: 'italic', marginTop: i === 0 ? 6 : 3, lineHeight: 1.4 }}
        >
          {item.kind === 'weapon' && (
            <span>
              {item.qty > 1 ? `${item.qty}× ` : ''}<strong style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{item.name}</strong>
              {' — '}{item.stats.damage} {item.stats.damageType}
              {item.stats.properties?.length > 0 && (
                <span style={{ color: 'var(--ink-4)' }}>
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
          {item.kind === 'pack' && item.cost && (
            <span style={{ color: 'var(--ink-4)' }}>{item.cost} value</span>
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
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--rule-soft)', width: '100%' }}>
          <div className="ometa" style={{ marginTop: 0, marginBottom: 6 }}>Contains</div>
          <ul style={{
            margin: 0,
            paddingLeft: 16,
            fontFamily: 'var(--serif)',
            fontSize: 13,
            color: 'var(--ink-3)',
            lineHeight: 1.45,
            columns: resolved.packContents.length > 6 ? 2 : 1,
            columnGap: 18
          }}>
            {resolved.packContents.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}
      {/* Spellcasting / class focus tooltip — Component Pouch, Arcane
          Focus, Holy Symbol, Druidic Focus all surface a short
          description so the player knows what they're choosing. */}
      {focusDescription && (
        <div
          className="od"
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: '1px dashed var(--rule-soft)',
            fontStyle: 'italic',
            lineHeight: 1.45
          }}
        >
          {focusDescription}
        </div>
      )}
      {/* "Any Simple/Martial Weapon" — only render the dropdown after
          the player has picked this option, otherwise it just clutters
          the unselected card. Click on the dropdown is stopped from
          propagating so it doesn't re-toggle the parent pick. */}
      {weaponChoiceList && picked && (
        <div
          style={{ marginTop: 12, width: '100%' }}
          onClick={e => e.stopPropagation()}
        >
          <select
            className="aselect"
            style={{ width: '100%' }}
            value={subpick || ''}
            onChange={e => onSubpick && onSubpick(e.target.value)}
          >
            <option value="">Pick a specific weapon…</option>
            {weaponChoiceList.map(w => (
              <option key={w.name} value={w.name}>
                {w.name} — {w.damage} {w.damageType}
              </option>
            ))}
          </select>
          {subPickedWeapon && (
            <div className="od" style={{ marginTop: 8, fontStyle: 'italic', lineHeight: 1.4 }}>
              <strong style={{ fontStyle: 'normal', color: 'var(--ink-2)' }}>{subPickedWeapon.name}</strong>
              {' — '}{subPickedWeapon.damage} {subPickedWeapon.damageType}
              {subPickedWeapon.properties?.length > 0 && ` · ${subPickedWeapon.properties.join(', ')}`}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
