import { useState, useEffect, useRef } from 'react'
import { Stepper, WizardFoot } from '../creator/creatorPrimitives.jsx'
import racesData from '../../data/races.json'
import { adaptLegacySpecies, findSpeciesEntry, resolveOriginSetting } from './speciesAdapter.js'
import Stage1OriginIdentity from './Stage1OriginIdentity.jsx'
import Stage2ClassCalling from './Stage2ClassCalling.jsx'
import Stage3PastPath from './Stage3PastPath.jsx'
import Stage4AbilitiesSkillsSpells from './Stage4AbilitiesSkillsSpells.jsx'
import Stage5GearStory from './Stage5GearStory.jsx'
import Stage6ReviewCommit from './Stage6ReviewCommit.jsx'
import { validateStage1 } from './stage1Validation.js'
import { isMagicInitiateOriginFeat, mergeRehydratedPatch, rehydrateFromServerCharacter, saveStage1Progress, saveStage1LocalDraft, loadStage1LocalDraft, buildStage1ProgressBody, resolveOpeningDraft } from './stage1Persistence.js'
import { fetchMixedAncestryTables, versatileThemeConflict } from './mixedAncestry.js'

/**
 * Creator-next shell — Stages 1–6 built (2026-11-07).
 *
 * Renders the 6-stage wizard frame (Stepper jump menu) with Stages 1–6
 * built, Review & Commit included. 2026-11-05
 * unhook: this is THE character creator — the only creation path.
 * Save-and-exit returns to the roster.
 *
 * Commit (Stage 6): the Review component owns the readout, the
 * validation display, and the commit call (POST /api/character/:id/
 * commit, landed 2026-11-07 — no PUT fallback). The shell's
 * Continue at step 5 IS the commit — next() at step 5 invokes the
 * component's commit via commitRef, and the component's own Commit
 * button calls the same handler. On success the component calls the
 * shell's onCommitted prop with the committed row; HomeFlow reloads
 * the roster and routes home WITHOUT calling App's
 * handleCharacterCreated (coordinator decision 2026-11-07: the plan
 * says submit does NOT start play, and App's handler auto-selects +
 * lands on campaign setup).
 *
 * Edit mode (mode="edit", resumeCharacterId set): the same wizard on
 * the existing row, all stages editable, fields pre-filled via the
 * existing rehydration path. Edit never creates a second row and
 * never resets the character to level 1 — the commit POST targets
 * the existing id, and the Page 1 preservation rule (definition only;
 * earned progression preserved except CON-driven HP recalculation)
 * is shown on Review before commit. The shell fetches the row's
 * level (+ class_levels) on mount even when a local mirror exists,
 * and passes it to Stage 2 / Review as a prop — level never enters
 * creator state or the save/commit body.
 *
 * Species data comes from the server species registry (/api/species,
 * 2026-11-04) when reachable; the INTERIM adapter over races.json
 * (see speciesAdapter.js) is the offline fallback. The shell is the
 * only races.json touchpoint. When the registry cannot be reached the
 * creator says so in a banner (item 4) instead of silently falling
 * back — the fallback is visible, not silent.
 *
 * Resume without a local draft rehydrates from the server row + the
 * progression snapshot (item 6, rehydrateFromServerCharacter): the
 * row's species/variant/origin/class/subclass picks and the side
 * tables' theme/feat picks land in state, merged under the player's
 * live picks (a pick already made always wins). The local draft still
 * wins outright when present — rehydration never runs then. The
 * Stage 2 picks rehydrate too since the 2026-11-07 follow-up: the
 * row's fighting_style, subclass_choices_json, and known_cantrips
 * columns are read back (their columns exist — 058/103/001 — and the
 * save body sends them), so an edit-mode resume keeps the picks;
 * generation_method, base_scores, and ability_choice_picks have no
 * columns and never rehydrate, and neither do the derived Stage 4
 * lists (ability_scores, skills, tool_proficiencies, languages),
 * which Stage 4 recomputes from the rehydrated picks.
 *
 * Stage 1 advance: blocked only by the origin-explanation gate (see
 * stage1Validation.js). A successful advance saves the draft row
 * (POST 'creating' first, PUT after) and mirrors the draft locally
 * so feat picks the row cannot yet hold survive a refresh. Stage 2,
 * Stage 3, Stage 4, and Stage 5 advances autosave the same way (the server row
 * holds Stage 1 fields plus class/subclass, theme fields, Stage 4
 * fields, and Stage 5 story fields; the gear picks ride the body as
 * validation-only picks and the full draft including Stage 2–5 picks
 * mirrors locally).
 */

const STAGE_LABELS = [
  'Origin & Identity',
  'Class & Calling',
  'Past & Path',
  'Abilities, Skills, & Spells',
  'Gear & Story',
  'Review'
]

// Notes for the not-yet-built stages only (keys are the step index).
// Key 4 is Stage 5's scope line, kept for the record now that the
// stage is built — heirloom dropped from it, 2026-11-07: the stage
// ships equipment-or-gold, appearance, and story text only (heirloom
// is deferred, no server home). Stage 6 (key 5) is built — its note
// was removed with the stub block, 2026-11-07.
const STAGE_NOTES = {
  4: 'Equipment or gold, appearance, and story text.'
}

export default function CreatorNextShell({ onExit, resumeCharacterId = null, onCommitted, mode = 'manual' }) {
  // Resolve the opening draft once — see resolveOpeningDraft in
  // stage1Persistence.js. A roster resume trusts the local mirror only
  // when it belongs to THIS character; anything else starts blank ON
  // THE SAME ROW, so the first save PUTs it instead of POSTing an
  // orphan — and a click never opens another character's draft. A
  // fresh create never reads the mirror at all (2026-11-05 bug fix:
  // Create New Character used to open with the prior character's info).
  // A resume with no local mirror rehydrates from the server row
  // instead (item 6, the effect below) — the local mirror still wins
  // outright when present.
  const [opening] = useState(() => resolveOpeningDraft({ resumeCharacterId, draft: loadStage1LocalDraft() }))
  const [step, setStep] = useState(0)
  const [state, setState] = useState(opening.state)
  const [characterId, setCharacterId] = useState(opening.characterId)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [stage1Done, setStage1Done] = useState(false)
  // Edit-mode level plumbing (2026-11-08, L2 fighting-style picker):
  // the row's total level + class_levels. Passed down as props to
  // Stage 2 and Review; NEVER in creator state or the save/commit
  // body — level is progression data the commit never takes from the
  // body. Null until the row fetch below lands; callers treat null
  // as level 1 (create mode, where the level is 1 by construction).
  const [characterLevel, setCharacterLevel] = useState(null)
  const [classLevels, setClassLevels] = useState(null)
  // The server is unreachable when the registry fetch fails (item 4):
  // the creator keeps working on the legacy adapter list, but the
  // banner below says so instead of failing silently.
  const [serverUnreachable, setServerUnreachable] = useState(false)
  // Stage 6 commit: the Review component registers its commit handler
  // here so the shell's Continue at step 5 IS the commit (same handler
  // as the component's own Commit button — one path, two buttons).
  const commitRef = useRef(null)

  // Resume rehydration (item 6): only when there is a resume id and
  // NO local mirror — the draft wins outright when present, and a
  // fresh create never fetches. Merged under the live picks
  // (mergeRehydratedPatch): a pick the player already made in the
  // meantime always wins over the stored one.
  useEffect(() => {
    if (!resumeCharacterId || opening.hadMirror) return
    let live = true
    rehydrateFromServerCharacter(resumeCharacterId)
      .then(result => {
        if (!live) return
        if (result?.patch && Object.keys(result.patch).length) {
          setState(prev => mergeRehydratedPatch(prev, result.patch))
        }
      })
      .catch(() => { /* a row that cannot be read resumes blank, silently */ })
    return () => { live = false }
    // Runs once on mount: the resume id and the opening draft are fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Level fetch for edit/resume mode: the picker gate (Stage 2) and
  // the Review check (Stage 6) both need the row's level, which lives
  // nowhere in creator state. Runs whenever a row is open, mirror or
  // not — the rehydration effect above runs only without a mirror,
  // and the mirror is the common edit path. A failed fetch leaves the
  // level unknown and the creator treats it as 1 (the pre-existing
  // behaviour); the shell's server-unreachable banner already says
  // when the server is down.
  useEffect(() => {
    if (!resumeCharacterId) return
    let live = true
    fetch(`/api/character/${resumeCharacterId}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live || !d) return
        const row = d.character ?? d
        const lvl = Number(row?.level)
        if (Number.isFinite(lvl) && lvl >= 1) setCharacterLevel(lvl)
        const raw = row?.class_levels
        if (raw != null) {
          try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
            if (Array.isArray(parsed)) setClassLevels(parsed)
          } catch { /* corrupt class_levels: fall back to the row total */ }
        }
      })
      .catch(() => { if (live) console.warn('[creator] character row unreachable — level unknown, treating as level 1') })
    return () => { live = false }
    // Runs once on mount: the resume id is fixed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Species come from the server registry (/api/species) when reachable;
  // the interim adapter over races.json is the offline fallback, not the
  // authority. Registry entries already match the adapter shape Stage 1
  // renders, so the swap needs no Stage 1 change.
  const [species, setSpecies] = useState(() => adaptLegacySpecies(racesData))
  useEffect(() => {
    let live = true
    fetch('/api/species')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => { if (live && Array.isArray(d?.species) && d.species.length) setSpecies(d.species) })
      .catch((err) => {
        // Item 4: the ONLY cause of an unreachable /api/species is the
        // server not running (proxy + mount + fetch all verified) — so
        // the fix is a visible notice, not plumbing. The creator keeps
        // working on the legacy adapter list, and the banner says so.
        if (!live) return
        console.warn('[creator] /api/species unreachable — showing legacy species:', err?.message || err)
        setServerUnreachable(true)
      })
    return () => { live = false }
  }, [])
  // Mixed Ancestry trait tables (GET /api/mixed-ancestry): fetched
  // once for the Stage 1 picker + validation. When unreachable this
  // stays null and Stage 1 shows the gap honestly instead of
  // substituting invented traits; the picker fetches lazily then.
  const [mixedTables, setMixedTables] = useState(null)
  useEffect(() => {
    let live = true
    fetchMixedAncestryTables()
      .then(d => { if (live) setMixedTables(d) })
      .catch((err) => { if (live) console.warn('[creator] /api/mixed-ancestry unreachable:', err?.message || err) })
    return () => { live = false }
  }, [])

  // Subclasses come from the server subclass registry (/api/subclasses,
  // mounted in server/index.js); when it cannot be reached this stays
  // null and Stage 2 shows the gap honestly instead of substituting
  // the client classes.json list as registry truth.
  // Shape when it lands: { [classId]: [{ name, source,
  // selectionLevel, choices, class }] } (registry entry shape).
  const [subclassesByClass, setSubclassesByClass] = useState(null)
  useEffect(() => {
    let live = true
    fetch('/api/subclasses')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live || !d) return
        if (Array.isArray(d.subclasses)) {
          const grouped = {}
          for (const s of d.subclasses) {
            const key = s.class || s.classId
            if (!key) continue
            ;(grouped[key] = grouped[key] || []).push(s)
          }
          setSubclassesByClass(grouped)
        } else if (d.subclassesByClass) {
          setSubclassesByClass(d.subclassesByClass)
        }
      })
      .catch((err) => { console.warn('[creator] /api/subclasses unreachable:', err?.message || err) })
    return () => { live = false }
  }, [])
  const speciesEntry = findSpeciesEntry(species, state.race) || null
  // Stage 1 validation needs the mixed tables + the species entry
  // (mixed record, Versatile gate, size gate) — computed here, after
  // both exist, and used by the step-0 advance gate.
  const validation = validateStage1(state, {
    featListAvailable: true,
    mixedTables,
    speciesEntries: species,
    speciesEntry
  })

  // Themes come from the server theme registry (/api/themes) when
  // reachable; when unreachable this stays null and Stage 3 shows the
  // gap honestly instead of substituting backgrounds.json or any
  // client theme list as registry truth. There is NO client themes
  // fallback file.
  const [themes, setThemes] = useState(null)
  useEffect(() => {
    let live = true
    fetch('/api/themes')
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!live || !d) return
        if (Array.isArray(d)) setThemes(d)
        else if (Array.isArray(d.themes)) setThemes(d.themes)
      })
      .catch((err) => { console.warn('[creator] /api/themes unreachable:', err?.message || err) })
    return () => { live = false }
  }, [])

  // Magic Initiate cantrips (item 15): the single source of truth is
  // character_origin_feats.choices_json.cantrips, which Stage 3 picks
  // and the server persists. The shell feeds the stored picks into
  // Stage 2's featCantrips — an empty list when the origin feat is
  // not Magic Initiate, never an error, and never stale cantrips from
  // a previous theme (a theme change clears the choices on Stage 3,
  // and the server validator governs the stored list on the next save).
  // The human Versatile slot's Magic Initiate cantrips ride along too
  // (2026-11-07 follow-up): the server supplies feat cantrips from
  // both slots, so Stage 2 must grant both — otherwise a Versatile-MI
  // caster's final cantrip list could never include them.
  const miCantrips = [
    ...(isMagicInitiateOriginFeat(state.originFeat)
      ? (Array.isArray(state.originFeatChoices?.cantrips)
        ? state.originFeatChoices.cantrips.filter(c => typeof c === 'string' && c.trim())
        : [])
      : []),
    ...(isMagicInitiateOriginFeat(state.versatileFeat)
      ? (Array.isArray(state.versatileFeatChoices?.cantrips)
        ? state.versatileFeatChoices.cantrips.filter(c => typeof c === 'string' && c.trim())
        : [])
      : []),
  ]

  // Scroll to top on every stage move (Continue, Back, Stepper jumps,
  // Review jumps): the next stage renders at the top of the frame, so
  // the player never lands mid-page on a new stage's lower half.
  const advance = () => {
    window.scrollTo(0, 0)
    setStep(s => Math.min(STAGE_LABELS.length - 1, s + 1))
  }
  const jumpTo = (s) => {
    window.scrollTo(0, 0)
    setStep(s)
  }

  const next = async () => {
    if (saving) return
    // Step 5 is Review & Commit: Continue IS the commit. The Review
    // component owns the call (validation display + 400 handling) and
    // registers it on commitRef; the shell just invokes it. A failed
    // commit stays on Review — never an advance, never a bounce.
    if (step === 5) {
      await commitRef.current?.()
      return
    }
    // A resume with a blank Stage 1 has nothing to persist yet, and a
    // PUT with an empty body is a 400 — skip the save and just advance.
    // (Fresh creates still POST: characterId is null there.)
    if (characterId && Object.keys(buildStage1ProgressBody(state, themes)).length === 0) {
      advance()
      return
    }
    if (step === 1 || step === 2 || step === 3 || step === 4) {
      // Stage 2 / Stage 3 / Stage 4 / Stage 5 advance mirrors Stage 1: autosave the draft.
      // The server row holds Stage 1 fields plus class/subclass,
      // theme fields, and Stage 4 fields; the full draft (including
      // Stage 2/3/4 picks) is mirrored locally. A server 400 surfaces
      // in the error box and blocks the advance.
      // Stage 3 gate (Human Versatile): the pick must differ from the
      // theme's fixed origin feat. The server would 400 the save on
      // it — but the player is told HERE first, before any save is
      // attempted, with the fix (change the pick at Stage 1).
      // Both Versatile slots are judged (R2-5): the standalone human
      // pick AND the Mixed Ancestry trait pick.
      if (step === 2) {
        const conflict = versatileThemeConflict(state.versatileFeat, state.originFeat)
          || versatileThemeConflict(state.mixedAncestry?.versatileFeat, state.originFeat)
        if (conflict) {
          setSaveError(conflict)
          return
        }
      }
      setSaving(true)
      try {
        const result = await saveStage1Progress({ state, characterId, themes })
        if (result.character_id && result.character_id !== characterId) setCharacterId(result.character_id)
        saveStage1LocalDraft(state, result.character_id || characterId)
      } catch (err) {
        setSaveError(err.message || 'Could not save progress.')
        setSaving(false)
        return
      }
      setSaving(false)
      advance()
      return
    }
    if (step === 0) {
      if (!validation.canAdvance) {
        setSaveError(validation.blocking.join(' '))
        return
      }
      setSaveError(null)
      setSaving(true)
      try {
        const result = await saveStage1Progress({ state, characterId, themes })
        if (result.character_id && result.character_id !== characterId) setCharacterId(result.character_id)
        saveStage1LocalDraft(state, result.character_id || characterId)
        setStage1Done(true)
      } catch (err) {
        setSaveError(err.message || 'Could not save progress.')
        setSaving(false)
        return
      }
      setSaving(false)
    }
    advance()
  }

  const back = () => {
    window.scrollTo(0, 0)
    setStep(s => Math.max(0, s - 1))
  }

  return (
    <div className="creator-v2">
      <div className="appbar">
        <div className="brand">
          D <span className="amp">&amp;</span> D
          <span style={{ color: 'var(--ink-3)', fontStyle: 'normal', marginLeft: 6 }}>· Character Creator</span>
        </div>
        <div className="crumbs">Stages 1–6 built</div>
        <div className="spacer" />
        {onExit && (
          <button type="button" className="btn ghost" onClick={onExit}>Exit</button>
        )}
      </div>

      <div className="stage">
        <div className="frame">
          {serverUnreachable && (
            <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginBottom: 12 }}>
              Couldn&apos;t reach the server — showing the saved species list for now. Subclasses and themes need the server; check your connection and refresh.
            </div>
          )}
          <Stepper step={step} setStep={jumpTo} mode="manual" steps={STAGE_LABELS} />
          <div style={{ height: 36 }} />

          {step === 0 && (
            <>
              <Stage1OriginIdentity state={state} set={setState} mode={mode} payload={null} species={species} mixedTables={mixedTables} />
            </>
          )}
          {step === 1 && (
            <>
              {stage1Done && (
                <div className="help" style={{ fontStyle: 'normal', color: 'var(--ink-2)', marginBottom: 12 }}>
                  Your Stage 1 draft saved:{' '}
                  {[state.first_name, state.last_name].filter(Boolean).join(' ') || '—'}
                  {state.race ? ` · ${state.race}` : ''}
                  {state.subrace ? ` (${state.subrace})` : ''}
                  {resolveOriginSetting(state.origin_setting, state.origin_setting_custom) ? ` · origin ${resolveOriginSetting(state.origin_setting, state.origin_setting_custom)}` : ''}.
                </div>
              )}
              <Stage2ClassCalling
                state={state} set={setState}
                subclassesByClass={subclassesByClass}
                speciesEntry={speciesEntry}
                featCantrips={miCantrips}
                characterLevel={characterLevel ?? 1}
                classLevels={classLevels}
              />
            </>
          )}
          {step === 2 && (
            <Stage3PastPath state={state} set={setState} themes={themes} speciesEntry={speciesEntry} />
          )}
          {step === 3 && (
            <Stage4AbilitiesSkillsSpells state={state} set={setState} themes={themes} speciesEntry={speciesEntry} />
          )}
          {step === 4 && (
            <Stage5GearStory state={state} set={setState} themes={themes} speciesEntry={speciesEntry} />
          )}
          {step === 5 && (
            <Stage6ReviewCommit
              state={state}
              characterId={characterId}
              onCharacterId={setCharacterId}
              speciesEntry={speciesEntry}
              speciesEntries={species}
              mixedTables={mixedTables}
              themes={themes}
              subclassesByClass={subclassesByClass}
              featCantrips={miCantrips}
              characterLevel={characterLevel ?? 1}
              classLevels={classLevels}
              mode={mode}
              onCommitted={onCommitted}
              onJump={jumpTo}
              commitRef={commitRef}
            />
          )}

          {saveError && (
            <div style={{
              marginTop: 16, padding: '12px 16px',
              background: 'rgba(231, 76, 60, 0.08)', border: '1px solid #e74c3c',
              color: '#c0392b', fontFamily: 'var(--serif)', fontSize: 15
            }}>
              Couldn't save: {saveError} (Your input is preserved — try Continue again, or Save and exit.)
            </div>
          )}
          <WizardFoot
            onBack={back}
            onNext={next}
            canBack={step > 0 && !saving}
            canNext={!saving}
            onSave={onExit}
            nextLabel={saving ? 'Saving…' : step === 5 ? 'Commit character' : 'Continue'}
            isLast={step === 5}
          />
        </div>
      </div>
    </div>
  )
}
