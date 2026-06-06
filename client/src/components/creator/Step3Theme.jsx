import { useState, useEffect, useMemo } from 'react'
import { WizardHead } from './creatorPrimitives.jsx'
import CelebrationCard from './CelebrationCard.jsx'
import { THEME_GOLD_MODIFIERS } from '../../data/themeGoldModifiers.js'

/**
 * Step 3 — Theme. Per PHASE_2_CREATOR_SPEC.md §5.3.
 *
 * Manual mode: a Hearth .opt-grid of all 21 themes (Knight + Haunted One
 * INCLUDED; they're only excluded from Prelude emergence per Decision D,
 * not from manual-mode selection). Each .opt shows the theme name, its
 * identity blurb, and an .ometa line built from the theme's real signature
 * skills + starting-gold modifier. The chosen .opt gets .sel; its full
 * description (and the Knight path-explanation paragraph) renders below in
 * a .trait-card.
 *
 * Handoff mode: locked theme from `payload.committed_theme` with a
 * celebration card naming the chapter beats from `[THEME_HINT].reason`
 * markers, then the theme rendered as a read-only locked .trait-card.
 * Knight + Haunted One can never arrive via handoff.
 *
 * HEARTH render: WizardHead (.step-eyebrow + h1 + subtitle) then the
 * .opt-grid.c2 / .opt (.ot/.od/.ometa) chooser and a .block + .trait-card
 * detail panel — design "Create Character.html" pane 3.
 */
export default function Step3Theme({ state, set, mode, payload }) {
  const isHandoff = mode === 'handoff'

  useEffect(() => {
    if (!isHandoff || !payload?.committed_theme) return
    if (state.theme_id !== payload.committed_theme) {
      set({ ...state, theme_id: payload.committed_theme })
    }
  }, [isHandoff, payload?.committed_theme])

  const themeId = state.theme_id || (isHandoff ? payload?.committed_theme : '')

  const [themes, setThemes] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/progression/themes')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) { setThemes(Array.isArray(data) ? data : []); setLoading(false) } })
      .catch(() => { if (!cancelled) { setThemes([]); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const themeById = useMemo(() => Object.fromEntries(themes.map(t => [t.id, t])), [themes])
  const theme = themeId ? themeById[themeId] : null
  const themeBeats = payload?.theme_chapter_beats || []

  const formatModifier = (m) => {
    if (!m || m === 0) return '+0%'
    const pct = Math.round(Math.abs(m) * 100)
    return m > 0 ? `+${pct}%` : `−${pct}%`  // U+2212 minus per spec §7.1.4
  }

  // .ometa line, built from the theme's real data (the design's third
  // token is a tool/kit the app's theme model doesn't carry, so we render
  // the real signature skills + starting-gold modifier instead).
  const metaFor = (t) => {
    const skills = [t.signature_skill_1, t.signature_skill_2].filter(Boolean).join(' · ')
    const gold = `Gold ${formatModifier(THEME_GOLD_MODIFIERS[t.id])}`
    return skills ? `${skills} · ${gold}` : gold
  }

  return (
    <>
      <WizardHead
        stepNum={3}
        title="What shaped you, before a class."
        subtitle="A theme is the lived experience that made you — the formative work, training, or trial you carried before you took on a class. It comes with signature skills and a defining feature."
        mode={mode}
      />

      {isHandoff && themeBeats.length > 0 && (
        <CelebrationCard
          opening="These moments brought you to your theme:"
          beats={themeBeats}
          outcomePrefix="You take up your calling:"
          outcomeBold={theme?.name || themeId}
          outcomeSuffix="."
        />
      )}

      {!isHandoff ? (
        <>
          <div className="opt-grid c2" data-grp="theme">
            {loading && themes.length === 0 && (
              <div className="fhelp" style={{ gridColumn: '1 / -1' }}>Loading themes…</div>
            )}
            {themes.map(t => (
              <button
                key={t.id}
                type="button"
                className={`opt ${t.id === themeId ? 'sel' : ''}`.trim()}
                aria-pressed={t.id === themeId}
                onClick={() => set({ ...state, theme_id: t.id })}
              >
                <div className="ot">{t.name}</div>
                {t.identity && <div className="od">{t.identity}</div>}
                <div className="ometa">{metaFor(t)}</div>
              </button>
            ))}
          </div>

          {theme && (
            <div className="block" style={{ marginTop: 26 }}>
              <div className="block-label">
                <span className="l">{theme.name}</span>
                {theme.id === 'knight_of_the_order' && (
                  <span className="hint">Path: True — shifts through play</span>
                )}
              </div>
              <div className="trait-card">
                <span className="ti"><svg className="ic"><use href="#i-sprout" /></svg></span>
                <div>
                  <div className="tt">{theme.name}</div>
                  {theme.description && <div className="td">{theme.description}</div>}
                  <div className="td" style={{ marginTop: 9 }}>
                    {(theme.signature_skill_1 || theme.signature_skill_2) && (
                      <>
                        Signature skills{' '}
                        <strong style={{ color: 'var(--ink)' }}>
                          {[theme.signature_skill_1, theme.signature_skill_2].filter(Boolean).join(', ')}
                        </strong>
                        {' · '}
                      </>
                    )}
                    Starting Gold{' '}
                    <strong style={{ color: 'var(--accent)' }}>{formatModifier(THEME_GOLD_MODIFIERS[theme.id])}</strong>
                  </div>
                  {theme.id === 'knight_of_the_order' && (
                    <div className="td" style={{ marginTop: 9, fontStyle: 'italic' }}>
                      As a Knight of the Order, your path begins true to your vows. How that path bends — whether you remain true, reform, fall, or redeem — emerges through what you do in the world.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="block">
          <div className="block-label">
            <span className="l">Your theme</span>
            <span className="hint">Locked from the Prelude</span>
          </div>
          <div className="trait-card">
            <span className="ti"><svg className="ic"><use href="#i-lock" /></svg></span>
            <div>
              <div className="tt">{theme?.name || themeId}</div>
              {theme?.identity && (
                <div className="td" style={{ fontStyle: 'italic' }}>{theme.identity}</div>
              )}
              {theme?.description && (
                <div className="td" style={{ marginTop: 9 }}>{theme.description}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
