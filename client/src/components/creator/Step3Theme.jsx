import { useState, useEffect, useMemo } from 'react'
import { Field, WizardHead } from './creatorPrimitives.jsx'
import CelebrationCard from './CelebrationCard.jsx'
import { THEME_GOLD_MODIFIERS } from '../../data/themeGoldModifiers.js'

/**
 * Step 3 — Theme. Per PHASE_2_CREATOR_SPEC.md §5.3.
 *
 * Manual mode: dropdown of all 21 themes (Knight + Haunted One INCLUDED;
 * they're only excluded from Prelude emergence per Decision D, not from
 * manual-mode selection). Selected theme shows full description below.
 * Knight of the Order gets the path-explanation paragraph.
 *
 * Handoff mode: locked theme from `payload.committed_theme` with a
 * celebration card naming the chapter beats from `[THEME_HINT].reason`
 * markers. Knight + Haunted One can never arrive via handoff.
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
    if (!m || m === 0) return 'Class baseline'
    const pct = Math.round(Math.abs(m) * 100)
    return m > 0 ? `+${pct}%` : `−${pct}%`  // U+2212 minus per spec §7.1.4
  }

  return (
    <>
      <WizardHead
        stepNum={3}
        title="Theme"
        subtitle="The lived experience that shaped who you are before you took on a class."
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

      <div className="card">
        <Field
          label="Theme"
          help={isHandoff ? null : 'Your lived experience — the formative work, training, or trial that shaped who you are before you take on a class.'}
          locked={isHandoff}
          lockTag="Locked from the Prelude"
        >
          {!isHandoff ? (
            <select
              className="select"
              value={themeId}
              onChange={e => set({ ...state, theme_id: e.target.value })}
            >
              <option value="">{loading ? 'Loading…' : 'Choose a theme…'}</option>
              {themes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          ) : (
            <div className="pick locked" style={{ display: 'block', marginTop: 10 }}>
              <div className="name">{theme?.name || themeId}</div>
              {theme?.identity && (
                <div className="sub" style={{ marginTop: 6, textTransform: 'none', letterSpacing: 0, fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--ink-2)' }}>
                  {theme.identity}
                </div>
              )}
            </div>
          )}
        </Field>

        {!isHandoff && theme && (
          <div className="detail-card">
            <div className="name">{theme.name}</div>
            {theme.identity && (
              <p className="body" style={{ fontStyle: 'italic', marginBottom: 12 }}>
                {theme.identity}
              </p>
            )}
            {theme.description && (
              <p className="body">{theme.description}</p>
            )}
            <div className="stat-line">
              {(theme.signature_skill_1 || theme.signature_skill_2) && (
                <span>
                  Signature skills{' '}
                  <strong>
                    {[theme.signature_skill_1, theme.signature_skill_2].filter(Boolean).join(', ')}
                  </strong>
                </span>
              )}
              <span>
                Starting Gold: <strong>{formatModifier(THEME_GOLD_MODIFIERS[theme.id])}</strong>
              </span>
              {theme.id === 'knight_of_the_order' && (
                <span style={{ fontStyle: 'italic', color: 'var(--accent)' }}>
                  Path: True (shifts through play)
                </span>
              )}
            </div>
            {theme.id === 'knight_of_the_order' && (
              <p className="help" style={{ marginTop: 14 }}>
                As a Knight of the Order, your path begins true to your vows. How that path bends — whether you remain true, reform, fall, or redeem — emerges through what you do in the world.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
