import '../../styles/hearth.css'
import '../../styles/hearth-roster.css'

/**
 * Home page — the "Your Characters" roster, in the Hearth dark-editorial
 * system (ported from Claude Design's Roster.html + Roster - Empty.html).
 *
 * Same contract as before — props { characters, onNew, onOpenCharacter }; each
 * character carries a derived `state` (active / creating / ready_for_primary /
 * prelude / prelude_setup) plus glyph/name/race/class/level/campaign/last/
 * prelude_chapter/prelude_age. This is a render + style swap; the routing
 * (onNew → path choice, onOpenCharacter → resume/play) is unchanged.
 */

const Ic = ({ n }) => <svg className="ic"><use href={`#i-${n}`} /></svg>

function RosterSprite() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true"><defs>
      <symbol id="i-plus" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></symbol>
      <symbol id="i-feather" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></symbol>
      <symbol id="i-sprout" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 20h10" /><path d="M12 20c0-7 0-9 0-12" /><path d="M12 11C9 11 6 9 6 5c4 0 6 2 6 6z" /><path d="M12 9c0-3 2-5 6-5 0 4-3 5-6 5z" /></symbol>
      <symbol id="i-edit" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" /></symbol>
      <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></symbol>
      <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></symbol>
      <symbol id="i-settings" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></symbol>
      <symbol id="i-activity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></symbol>
    </defs></svg>
  )
}

const hdrLinkStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 0, cursor: 'pointer',
  fontFamily: 'var(--sans)', fontSize: 12.5, color: 'var(--ink-3)',
  padding: '4px 6px'
}

function cardClass(c) {
  if (c.state === 'active') return 'active'
  if (c.state === 'ready_for_primary') return 'awaiting'
  return 'draft' // creating / prelude / prelude_setup
}

function badgeFor(c) {
  if (c.state === 'ready_for_primary') return { cls: ' ready', icon: 'check', label: 'Ready' }
  if (c.state === 'creating') return { cls: '', icon: 'edit', label: 'Draft' }
  if (c.state === 'prelude' || c.state === 'prelude_setup') return { cls: '', icon: 'sprout', label: 'Prelude' }
  return null // active → no badge; the absence is the "ready to play" signal
}

function footerText(c) {
  if (c.state === 'active') return c.campaign || 'Active'
  if (c.state === 'creating') return 'Manual draft'
  if (c.state === 'prelude_setup') return 'Prelude setup in progress'
  if (c.state === 'prelude') {
    const bits = []
    if (c.prelude_chapter) bits.push(`Ch ${c.prelude_chapter}`)
    if (c.prelude_age) bits.push(`age ${c.prelude_age}`)
    return bits.length ? `Prelude · ${bits.join(' · ')}` : 'Prelude in progress'
  }
  if (c.state === 'ready_for_primary') return 'Awaiting a campaign'
  return ''
}

export default function HomeScreenV2({ characters = [], onNew, onOpenCharacter, onSettings, onAIBehavior }) {
  const activeCount = characters.filter(c => c.state === 'active').length
  const count = `${characters.length} ${characters.length === 1 ? 'life' : 'lives'}${activeCount ? ` · ${activeCount} active` : ''}`

  return (
    <div className="hearth roster app-bg">
      <RosterSprite />

      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <span className="back" style={{ cursor: 'default' }}><Ic n="feather" />Your characters</span>
        <div className="spacer"></div>
        {onAIBehavior && (
          <button type="button" style={hdrLinkStyle} onClick={onAIBehavior} title="AI Behavior diagnostics" onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}>
            <Ic n="activity" />AI Behavior
          </button>
        )}
        {onSettings && (
          <button type="button" style={hdrLinkStyle} onClick={onSettings} title="Settings" onMouseEnter={e => e.currentTarget.style.color = 'var(--ink)'} onMouseLeave={e => e.currentTarget.style.color = 'var(--ink-3)'}>
            <Ic n="settings" />Settings
          </button>
        )}
        <span className="opus"><span className="dot"></span>Opus</span>
      </header>

      <main className="page">
        <div className="page-eyebrow"><span className="eyebrow">Character home</span><span className="ln"></span></div>

        <header className="roster-head">
          <h1>Your Characters</h1>
          <p className="lede">Pick a character to get started.</p>
          {characters.length > 0 && <div className="count">{count}</div>}
        </header>

        {characters.length === 0 ? (
          <section className="invite">
            <button type="button" className="invite-create" onClick={onNew}>
              <span className="seal"><Ic n="plus" /></span>
              <h2>Create New Character</h2>
              <p className="sub">Begin a new life.</p>
              <div className="cta"><span className="btn primary lg">Start <Ic n="arrow-right" /></span></div>
            </button>
            <div className="invite-words">
              <span className="eyebrow">A library of lives</span>
              <p>This is where your characters will live — each one a person you can return to, between sessions and across campaigns.</p>
              <p><em>Make your first.</em> Take it slowly, one decision at a time, and let someone become real.</p>
            </div>
          </section>
        ) : (
          <div className="lib">
            <button type="button" className="create-card" onClick={onNew} aria-label="Create a new character">
              <span className="seal"><Ic n="plus" /></span>
              <h2>Create New Character</h2>
              <p className="sub">Begin a new life.</p>
              <span className="spark"><Ic n="sprout" />From a blank page</span>
            </button>
            {characters.map(c => <CharacterCard key={c.id} character={c} onClick={() => onOpenCharacter(c)} />)}
          </div>
        )}
      </main>
    </div>
  )
}

function CharacterCard({ character: c, onClick }) {
  const glyph = (c.glyph || c.first_name || c.name || '?').charAt(0).toUpperCase()
  const badge = badgeFor(c)
  const race = c.race_label || c.race
  const klass = c.class_label || c.class

  return (
    <button type="button" className={`char-card ${cardClass(c)}`} onClick={onClick}>
      <div className="cc-head">
        <div className="crest"><span className="mono">{glyph}</span>{c.level ? <span className="lvl">{c.level}</span> : null}</div>
        {badge && <span className={`badge${badge.cls}`}><Ic n={badge.icon} />{badge.label}</span>}
      </div>

      <div className="cc-body">
        <h3 className={`cc-name${c.name ? '' : ' unnamed'}`}>{c.name || '(unnamed)'}</h3>
        <p className="cc-sub">
          {race ? <>{race}<span className="sep">·</span></> : null}
          {klass
            ? <>{klass}{c.level ? <><span className="sep">·</span><span className="lv">L{c.level}</span></> : null}</>
            : <span className="na">class not set</span>}
        </p>
      </div>

      <div className="cc-foot">
        <span className="cc-status"><span className="dot"></span><span className={c.state === 'active' ? 'camp nm' : 'nm'}>{footerText(c)}</span></span>
        <span className="cc-time">{c.last || ''}</span>
      </div>
    </button>
  )
}
