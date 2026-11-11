
/**
 * Home page V2 — single-section "Your characters" grid with three card
 * states (active / creating / ready_for_primary) per spec §3.
 *
 * Per PM ruling 2026-05-02:
 *   - "Create New Character" entry is the FIRST card in the grid
 *     (Diablo-4 pattern). Visually distinct (dashed border, "+"
 *     affordance, no portrait/name/level) but lives in the same
 *     container so the act of creating reads as part of the roster
 *     rather than a separate workflow.
 *   - Three card states: active / creating / ready_for_primary. The
 *     two in-progress states share a visual treatment (desaturated
 *     portrait + position absolute badge); only the badge text
 *     distinguishes "Draft" (manual mid-creator) from "Prelude · Step
 *     forward" (handoff awaiting completion). PM lean: shared
 *     treatment unless a specific reason to differentiate emerges.
 *
 * Click routing (2026-11-05 unhook: the new creator is the only path):
 *   - "Create New Character" → the new creator (Stages 1–2 built)
 *   - Active card → that character's main game screen (out of v2 scope)
 *   - Creating card → resume the draft in the new creator
 *   - Ready_for_primary card → handoff is not built in the new creator
 *     yet; the roster shows an honest message instead of a creator.
 *
 * Per spec §3.4: empty (first-time) state shows just the Create card;
 * populated state intermixes states in card order (most-recently-touched
 * first).
 */
export default function HomeScreenV2({ characters = [], onNew, onOpenCharacter, onEditCharacter }) {
  return (
    <div className="frame wide">
      <div className="home-head">
        <div>
          <h1 className="h-display">Your Characters</h1>
          <p className="lede" style={{ marginTop: 12 }}>Pick a character to get started.</p>
        </div>
        <div className="help" style={{ maxWidth: 360, textAlign: 'right' }}>
          Active characters, in-progress drafts, and Preludes ready to step forward — all here.
        </div>
      </div>

      <div className="charlist">
        {/* "Create New Character" entry — always first (Diablo-4 pattern).
            2026-11-05 unhook: this is THE create card now — the new
            creator is the only path; the old V2 card is gone. */}
        <button
          type="button"
          className="charcard create"
          onClick={onNew}
          aria-label="Create a new character"
        >
          <div className="plus">✦</div>
          <div className="label-big">Create New Character</div>
          <div className="sub">Begin a new life</div>
        </button>

        {characters.map(c => (
          <CharacterCard key={c.id} character={c} onClick={() => onOpenCharacter(c)} onEditCharacter={onEditCharacter} />
        ))}
      </div>
    </div>
  )
}

function CharacterCard({ character, onClick, onEditCharacter }) {
  const { state } = character
  const inProgress = state === 'creating' || state === 'ready_for_primary' || state === 'prelude' || state === 'prelude_setup'
  const glyph = (character.glyph || character.first_name || character.name || '?').charAt(0).toUpperCase()
  // Edit affordance (Stage 6 edit mode): active cards only. It is a
  // SIBLING of the card button, never nested inside it — a button
  // inside a button is invalid HTML and would hijack the whole-card
  // click that opens the dashboard. The wrapper is the grid item; the
  // card button keeps its own click target, and the Edit button stops
  // propagation so an edit click never also opens the dashboard.
  // Active cards carry no badge, so the top-right corner is free.
  return (
    <div style={{ position: 'relative' }}>
    <button
      type="button"
      className={`charcard ${inProgress ? 'in-progress' : ''}`}
      onClick={onClick}
      style={{ width: '100%' }}
    >
      {/* Per-state badge (top-right corner). 'creating' = "Draft" with
         outlined accent; 'prelude_setup' = "Prelude · Continue setup"
         (the new 6-step wizard mid-flight, v1.0.138); 'prelude' =
         "Prelude · Continue" while still playing the arc;
         'ready_for_primary' = "Prelude · Step forward" once the arc has
         finished. Active characters get no badge — the absence of one IS
         the "ready to play" signal. */}
      {state === 'ready_for_primary' && <div className="badge prelude">Prelude · Step forward</div>}
      {state === 'prelude' && <div className="badge prelude">Prelude · Continue</div>}
      {state === 'prelude_setup' && <div className="badge prelude">Prelude · Continue setup</div>}
      {state === 'creating' && <div className="badge draft">Draft</div>}

      <div className="portrait">
        <div className="glyph">{glyph}</div>
      </div>

      <div className="name">{character.name || '(unnamed)'}</div>

      <div className="meta">
        {composeMeta(character)}
      </div>

      <div className="footline">
        <span>{composeFooter(character)}</span>
        <span>{character.last || ''}</span>
      </div>
    </button>
      {state === 'active' && onEditCharacter && (
        <button
          type="button"
          className="btn ghost"
          aria-label={`Edit ${character.name || 'character'} in the creator`}
          title="Edit in creator — definition only; level, XP, inventory, and gold are preserved"
          onClick={(e) => { e.stopPropagation(); onEditCharacter(character) }}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, fontSize: 13, padding: '4px 10px' }}
        >
          Edit
        </button>
      )}
    </div>
  )
}

function composeMeta(c) {
  // race · theme · class line — only what's been filled. Empty pieces
  // drop out so a partial 'creating' character with just race set still
  // reads cleanly.
  const parts = [
    c.race_label || c.race || null,
    c.theme_label || c.theme || null,
    c.class_label
      ? (c.level ? `${c.class_label} · L${c.level}` : c.class_label)
      : (c.class && c.level ? `${c.class} · L${c.level}` : c.class || null)
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function composeFooter(c) {
  if (c.state === 'active') return c.campaign || 'Active'
  if (c.state === 'creating') return 'Manual draft'
  if (c.state === 'prelude_setup') return 'Prelude setup in progress'
  if (c.state === 'prelude') {
    const bits = []
    if (c.prelude_chapter) bits.push(`Ch ${c.prelude_chapter}`)
    if (c.prelude_age) bits.push(`age ${c.prelude_age}`)
    return bits.length ? `Prelude · ${bits.join(' · ')}` : 'Prelude in progress'
  }
  if (c.state === 'ready_for_primary') return 'Awaiting campaign'
  return ''
}
