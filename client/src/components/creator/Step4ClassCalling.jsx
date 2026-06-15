import { useState, useEffect, useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import classesData from '../../data/classes.json'
import { THEME_NARRATIVE_CONTINUITY } from '../../data/themeNarrativeContinuity.js'
import Step4LevelOnePicks from './Step4LevelOnePicks.jsx'

/**
 * Render a class's primaryAbility / savingThrows field as a readable
 * string. classes.json stores these as arrays (e.g., ['str', 'dex'])
 * which need joining + uppercasing for display.
 */
function formatAbilityList(value) {
  if (!value) return null
  if (Array.isArray(value)) {
    const upper = value.map(s => String(s).toUpperCase())
    if (upper.length === 1) return upper[0]
    if (upper.length === 2) return `${upper[0]} or ${upper[1]}`
    return upper.join(', ')
  }
  return String(value)
}

/**
 * Inspect a class's subclasses to detect when subclasses pick. Returns
 * the level at which the first subclass becomes available, or null if
 * subclasses aren't gated by level (rare). Subclasses with featuresByLevel
 * starting at level 1 mean the class picks subclass at L1 (Cleric domain,
 * Sorcerer origin, Warlock patron); others (Fighter, Rogue, Wizard, etc.)
 * pick later (L3 typically).
 */
function detectSubclassPickLevel(subclasses) {
  if (!Array.isArray(subclasses) || subclasses.length === 0) return null
  // Check if any subclass has L1 features. If so, subclass is picked at L1.
  const hasL1Features = subclasses.some(s => {
    const fbl = s?.featuresByLevel || {}
    return fbl['1'] || fbl[1]
  })
  if (hasL1Features) return 1
  // Otherwise, find the lowest level any subclass has features at.
  const levels = []
  for (const s of subclasses) {
    const fbl = s?.featuresByLevel || {}
    for (const k of Object.keys(fbl)) {
      const lvl = parseInt(k, 10)
      if (Number.isFinite(lvl)) levels.push(lvl)
    }
  }
  if (levels.length === 0) return 3  // PHB default
  return Math.min(...levels)
}

/**
 * Step 4 — Class & Calling. Per PHASE_2_CREATOR_SPEC.md §5.4.
 *
 * Manual mode: class picker (all 17 classes) + class detail card +
 * subclass picker (when class picks subclass at L1) + L1 mechanical
 * choices (cantrips, fighting style, etc.).
 *
 * Handoff mode: class is suggested-but-editable — pre-fills with
 * `payload.class_suggestion` from the [CLASS_HINT] tally. A
 * narrative-continuity card sits ABOVE the class picker, anchored
 * to the locked theme. The card is dismissable per spec §5.4.6 —
 * local-session-scoped boolean.
 *
 * Subclass + L1 mechanical picks are fully editable in both modes
 * (no Prelude pre-fill — the Prelude tracks class affinity, not
 * subclass affinity, per spec §5.4.3).
 *
 * HEARTH render: step header via WizardHead (.step-eyebrow + h1 +
 * .subtitle); class chooser as .block > .opt-grid.c3 > .opt; selected
 * class detail as a .reveal .trait-card; subclass chooser as a
 * .reveal.subrow > .opt-grid.c3 > .opt; the handoff continuity card as
 * a dismissable .lock-cele. See "Create Character.html" §pane[4].
 */
export default function Step4ClassCalling({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  // Pre-fill suggested class on handoff entry, but only on first render —
  // once the player has an explicit choice, don't override.
  useEffect(() => {
    if (!isHandoff) return
    if (state.class_id) return
    if (!payload?.class_suggestion) return
    set({ ...state, class_id: payload.class_suggestion })
  }, [isHandoff, payload?.class_suggestion])

  const classId = state.class_id || ''
  const themeId = state.theme_id || (isHandoff ? payload?.committed_theme : '')

  // Local-session-scoped dismissal of the narrative-continuity card.
  // Reset when the underlying theme changes (defensive — theme is
  // locked in handoff, but covers manual-mode-toggle edge cases).
  const [dismissed, setDismissed] = useState(false)
  useEffect(() => { setDismissed(false) }, [themeId])

  const continuity = isHandoff && themeId ? THEME_NARRATIVE_CONTINUITY[themeId] : null

  const classList = useMemo(() => {
    return Object.entries(classesData).map(([id, c]) => ({
      id,
      name: c.name || id,
      hitDie: c.hitDie || c.hit_die || c.hd,
      primaryAbility: formatAbilityList(c.primaryAbility || c.primary_ability || c.primary),
      savingThrows: formatAbilityList(c.savingThrows || c.saving_throws || c.saves),
      description: c.description || c.flavor || '',
      subclasses: Array.isArray(c.subclasses) ? c.subclasses : [],
      subclassPickLevel: detectSubclassPickLevel(c.subclasses)
    }))
  }, [])
  const cls = classId ? classList.find(c => c.id === classId) : null

  const hitDieLabel = (hd) => (hd == null ? null : (typeof hd === 'number' ? `d${hd}` : hd))

  return (
    <>
      <WizardHead
        stepNum={4}
        title="What you'll do when it calls for action."
        subtitle="Your class is the shape of your power. The calling within it — your subclass — is how you wield it."
        mode={mode}
      />

      {continuity && !dismissed && (
        <div className="lock-cele" style={{ padding: '17px 19px 17px 21px' }}>
          <div className="lc-top">
            <span className="lc-fleuron" aria-hidden="true">❧</span>
            <span className="lc-marker">A continuity from the years behind you</span>
            <button
              type="button"
              className="rv-edit"
              style={{ marginLeft: 'auto', padding: '3px 9px' }}
              onClick={() => setDismissed(true)}
              title="This doesn't fit"
              aria-label="Dismiss this card"
            >
              Doesn't fit
            </button>
          </div>
          <div className="lc-note">{continuity}</div>
        </div>
      )}

      {/* ── Class ─────────────────────────────────────────── */}
      <div className="block">
        <div className="block-label">
          <span className="l">Class</span>
          <span className="hint">
            {isHandoff
              ? 'suggested from the years that shaped you — the choice remains yours'
              : 'what you do when the situation calls for action'}
          </span>
        </div>
        <div className="opt-grid c3">
          {classList.map(c => {
            const meta = [hitDieLabel(c.hitDie), c.primaryAbility].filter(Boolean).join(' · ')
            return (
              <button
                key={c.id}
                type="button"
                className={`opt ${classId === c.id ? 'sel' : ''}`.trim()}
                onClick={() => set({ ...state, class_id: c.id, subclass_id: '', fighting_style: '', known_cantrips: [], known_spells: [], expertise: [] })}
              >
                <div className="ot">{c.name}</div>
                {c.description && <div className="od">{c.description}</div>}
                {meta && <div className="ometa">{meta}</div>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Selected-class detail reveal ──────────────────── */}
      {cls && (
        <div className="reveal">
          <div className="trait-card">
            <span className="ti">
              <svg className="ic" aria-hidden="true"><use href="#i-sparkles" /></svg>
            </span>
            <div>
              <div className="tt">{cls.name}</div>
              {cls.description && <div className="td">{cls.description}</div>}
              <div className="td" style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                {hitDieLabel(cls.hitDie) && (
                  <span>Hit die <strong style={{ color: 'var(--ink)' }}>{hitDieLabel(cls.hitDie)}</strong></span>
                )}
                {cls.primaryAbility && (
                  <span>Primary <strong style={{ color: 'var(--ink)' }}>{cls.primaryAbility}</strong></span>
                )}
                {cls.savingThrows && (
                  <span>
                    Saves{' '}
                    <strong style={{ color: 'var(--ink)' }}>
                      {Array.isArray(cls.savingThrows) ? cls.savingThrows.join(', ') : cls.savingThrows}
                    </strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Calling (subclass) ────────────────────────────── */}
      {cls && cls.subclassPickLevel === 1 && (
        <div className="reveal subrow">
          <div className="block-label">
            <span className="l">Calling · {cls.name}</span>
            <span className="hint">a specialization, chosen at level 1</span>
          </div>
          <div className="opt-grid c3">
            {cls.subclasses.map(s => (
              <button
                key={s.name}
                type="button"
                className={`opt ${state.subclass_id === s.name ? 'sel' : ''}`.trim()}
                onClick={() => set({ ...state, subclass_id: s.name })}
              >
                <div className="ot">{s.name}</div>
                {s.description && <div className="od"><em>{s.description}</em></div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {cls && cls.subclassPickLevel !== 1 && (
        <div className="reveal subrow">
          <div className="block-label">
            <span className="l">Calling</span>
            <span className="hint">chosen at level {cls.subclassPickLevel}</span>
          </div>
          <div className="fhelp" style={{ marginTop: 0 }}>
            {cls.name} chooses a specialization at level {cls.subclassPickLevel}. You'll pick when
            you reach that level in play.
          </div>
        </div>
      )}

      {/* ── Other level-1 picks (cantrips / spells / fighting style) ── */}
      {cls && <Step4LevelOnePicks state={state} set={set} />}
    </>
  )
}
