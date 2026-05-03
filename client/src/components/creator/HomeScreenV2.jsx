
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
 * Click routing:
 *   - "Create New Character" → Screen 2 (path choice)
 *   - Active card → that character's main game screen (out of v2 scope)
 *   - Creating card → resume manual creator at last step
 *   - Ready_for_primary card → resume creator in handoff mode for that
 *     character
 *
 * Per spec §3.4: empty (first-time) state shows just the Create card;
 * populated state intermixes states in card order (most-recently-touched
 * first).
 */
export default function HomeScreenV2({ characters = [], onNew, onOpenCharacter }) {
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
        {/* Diablo-4 "Create New Character" entry — always first. */}
        <button
          type="button"
          className="charcard create"
          onClick={onNew}
          aria-label="Create a new character"
        >
          <div className="plus">+</div>
          <div className="label-big">Create New Character</div>
          <div className="sub">Begin a new life</div>
        </button>

        {characters.map(c => (
          <CharacterCard key={c.id} character={c} onClick={() => onOpenCharacter(c)} />
        ))}
      </div>
    </div>
  )
}

function CharacterCard({ character, onClick }) {
  const { state } = character
  const inProgress = state === 'creating' || state === 'ready_for_primary' || state === 'prelude'
  const glyph = (character.glyph || character.first_name || character.name || '?').charAt(0).toUpperCase()

  return (
    <button
      type="button"
      className={`charcard ${inProgress ? 'in-progress' : ''}`}
      onClick={onClick}
    >
      {/* Per-state badge (top-right corner). 'creating' = "Draft" with
         outlined accent; 'prelude' = "Prelude · Continue" while still
         playing; 'ready_for_primary' = "Prelude · Step forward" once the
         arc has finished. Active characters get no badge — the absence
         of one IS the "ready to play" signal. */}
      {state === 'ready_for_primary' && <div className="badge prelude">Prelude · Step forward</div>}
      {state === 'prelude' && <div className="badge prelude">Prelude · Continue</div>}
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
  if (c.state === 'prelude') {
    const bits = []
    if (c.prelude_chapter) bits.push(`Ch ${c.prelude_chapter}`)
    if (c.prelude_age) bits.push(`age ${c.prelude_age}`)
    return bits.length ? `Prelude · ${bits.join(' · ')}` : 'Prelude in progress'
  }
  if (c.state === 'ready_for_primary') return 'Awaiting campaign'
  return ''
}
