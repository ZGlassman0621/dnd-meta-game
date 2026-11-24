import { spellDescriptionText, spellFactsLine } from './spellBlurb.js'

/**
 * One spell row, shared by every spell picker in the creator so they all read
 * the same way: the checkbox beside the name (flex row), then the spell's full
 * description and its facts line under it. Used by Stage 4 (known / spellbook /
 * prepared) and the Magic Initiate cantrip pickers on Stage 1 (Versatile) and
 * Stage 3 (theme) — creator-round-3 item 9. Moved here from Stage 4 unchanged.
 */
export default function SpellPickRow({ spell, held, checked, onToggle, inputStyle, note, atLimit = false }) {
  const desc = spellDescriptionText(spell.description)
  const facts = spellFactsLine(spell)
  return (
    <div style={{ margin: '10px 0', opacity: held ? 0.55 : (atLimit ? 0.45 : 1) }}>
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 8, margin: 0, fontFamily: 'var(--serif)', fontSize: 15, fontWeight: 600, color: 'inherit' }}>
        <input type="checkbox" style={inputStyle} disabled={held || atLimit} checked={checked} onChange={onToggle} />
        <span>
          {held ? `${spell.name} — already granted` : spell.name}
          {note ? <span style={{ fontWeight: 400, opacity: 0.75 }}> {note}</span> : null}
          {spell.school ? <span style={{ fontWeight: 400, opacity: 0.75 }}> ({spell.school})</span> : null}
        </span>
      </label>
      {desc ? <div style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--ink-2)', margin: '2px 0 0 26px' }}>{desc}</div> : null}
      {facts ? <div style={{ fontSize: 13, color: 'var(--ink-3)', margin: '2px 0 0 26px' }}>{facts}</div> : null}
    </div>
  )
}
