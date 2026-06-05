import { HearthSprite, Ic } from './hearthUI.jsx'
import QuickReferencePanel from './QuickReferencePanel.jsx'
import CompanionsPanel from './CompanionsPanel.jsx'
import InventoryPanel from './InventoryPanel.jsx'
import ConditionPanel from './ConditionPanel.jsx'
import '../styles/hearth.css'

/* ───────────────────────── Hearth DM Session Cockpit ─────────────────────────
   Dark-editorial three-column reading cockpit (left party · center reading
   stage + composer · right combat/dice rail). Pure presentation — all session
   logic lives in DMSession.jsx, which renders this with state + handlers as
   props. Styles in styles/hearth.css (.cockpit, .transcript, .composer, …).
   ──────────────────────────────────────────────────────────────────────── */

const cap = (s) => (s == null || s === '') ? s : String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const hpKind = (cur, max) => { const r = max ? cur / max : 1; return r > 0.5 ? '' : r > 0.25 ? 'warn' : 'bad' }
const mono = (name) => (name || '?').trim().charAt(0).toUpperCase()

function PartyMem({ name, sub, cur, max, conditions = [], you, active }) {
  const pct = max ? Math.max(0, Math.min(100, (cur / max) * 100)) : 100
  return (
    <div className={`party-mem${you ? ' you' : ''}${active ? ' active' : ''}`}>
      <div className="av">{mono(name)}{active ? <span className="turn" /> : null}</div>
      <div style={{ minWidth: 0 }}>
        <div className="pm-name">{name}</div>
        {sub ? <div className="pm-sub">{sub}</div> : null}
        {max ? (
          <div className="pm-hp">
            <div className={`hpbar ${hpKind(cur, max)}`}><div className="fill" style={{ width: `${pct}%` }} /></div>
            <span className="hpnum">{cur}/{max}</span>
          </div>
        ) : null}
        {conditions.length > 0 && (
          <div className="party-tags">
            {conditions.map((c, i) => <span key={i} className={`ptag${/poison|bleed|frighten|stun|prone|paral|exhaust/i.test(c) ? ' bad' : ''}`}>{cap(c)}</span>)}
          </div>
        )}
      </div>
    </div>
  )
}

export default function SessionCockpit(props) {
  const {
    character, companions = [], awayCompanions = [], secondCharacter, activeSession,
    messages = [], isLoading, error, sessionRecap, onClearRecap,
    inputAction, onInputChange, onSend, messagesEndRef,
    combatState, onAdvanceTurn, onEndCombat,
    playerConditions = [], companionConditions = {}, onToggleCondition,
    spellSlots, gameDate, onRest,
    useSonnet, onToggleModel,
    showQuickRef, setShowQuickRef, showInventory, setShowInventory,
    showConditionPanel, setShowConditionPanel, showCompanionsRef, setShowCompanionsRef,
    onOpenNotes,
    showEndOptions, onShowEnd, onCancelEnd, onPause, onComplete, onAbort,
    pendingRecruitment, recruitmentLoading, onConfirmRecruit, onDismissRecruit,
    itemsGainedThisSession, onDiscard, onCharacterUpdated, onSendActivity, onRecallCompanion
  } = props

  const closeAll = () => { setShowQuickRef(false); setShowCompanionsRef(false); setShowInventory(false); setShowConditionPanel(false) }
  const openOnly = (setter, cur) => { closeAll(); setter(!cur) }
  const charName = character?.nickname || character?.name || 'You'
  const actionLabel = secondCharacter
    ? `${charName} & ${secondCharacter.nickname || secondCharacter.name}`
    : charName

  const slotLevels = spellSlots?.max ? Object.keys(spellSlots.max).map(Number).filter(l => spellSlots.max[l] > 0).sort((a, b) => a - b) : []

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (inputAction.trim() && !isLoading) onSend(e)
    }
  }
  const quickInsert = (text) => onInputChange((inputAction ? inputAction.trimEnd() + ' ' : '') + text)

  const renderMessage = (msg, idx) => {
    if (msg.type === 'action') {
      return (
        <div key={idx} className="you-block">
          <div className="who">{actionLabel}</div>
          <div className="body">{msg.content}</div>
        </div>
      )
    }
    if (msg.type === 'summary') {
      return (
        <div key={idx} className="narr-card top" style={{ margin: '4px 0' }}>
          <div className="marker">Adventure Summary</div>
          <div className="ncbody">{msg.content}</div>
        </div>
      )
    }
    // narrative — split on blank lines into paragraphs for breathing room
    const paras = String(msg.content || '').split(/\n\s*\n/).filter(p => p.trim())
    return (
      <div key={idx} className="dm-block">
        <div className="who">Dungeon Master</div>
        <div className="prose">
          {paras.length ? paras.map((p, i) => <p key={i} style={{ margin: i ? '0.7em 0 0' : 0 }}>{p}</p>) : <p style={{ margin: 0 }}>{msg.content}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="hearth">
      <HearthSprite />

      <header className="dash-hdr">
        <div className="wordmark">D<span className="amp">&amp;</span>D</div>
        <div className="vr"></div>
        <button className="back" onClick={onShowEnd}><Ic n="pause" />Pause / end</button>
        <div className="spacer"></div>
        <button className="hdr-link" onClick={() => openOnly(setShowQuickRef, showQuickRef)}><Ic n="scroll" />Character</button>
        {companions.length > 0 && (
          <button className="hdr-link" onClick={() => openOnly(setShowCompanionsRef, showCompanionsRef)}><Ic n="users" />Party</button>
        )}
        <button className="hdr-link" onClick={onOpenNotes}><Ic n="feather" />Notes</button>
        <button className="hdr-link" onClick={() => openOnly(setShowInventory, showInventory)}><Ic n="pack" />Inventory</button>
        <button className="hdr-link" onClick={() => openOnly(setShowConditionPanel, showConditionPanel)}>
          <Ic n="flame" />Conditions{playerConditions.length > 0 ? ` · ${playerConditions.length}` : ''}
        </button>
        <div className="vr"></div>
        <button className="opus" onClick={onToggleModel} title="Switch the DM model for the next turn" style={{ background: 'none', border: 0, cursor: 'pointer' }}>
          <span className="dot" style={useSonnet ? { background: 'var(--accent-2)', boxShadow: '0 0 7px var(--accent-2)' } : undefined}></span>{useSonnet ? 'Sonnet' : 'Opus'}
        </button>
      </header>

      <div className="cockpit">
        {/* LEFT RAIL — party */}
        <aside className="ck-rail left scroll">
          <div className="ck-panel">
            <div className="label">Party<span className="ln" /></div>
            <PartyMem you name={charName} sub={`${cap(character?.class) || ''} · Lv ${character?.level || 1}`}
              cur={character?.current_hp} max={character?.max_hp} conditions={playerConditions}
              active={combatState && combatState.turnOrder?.[combatState.currentTurn]?.type === 'player'} />
            {companions.map((c, i) => (
              <PartyMem key={i} name={c.nickname || c.name} sub={cap(c.class)}
                cur={c.current_hp} max={c.max_hp} conditions={companionConditions[c.name] || []}
                active={combatState && combatState.turnOrder?.[combatState.currentTurn]?.name === (c.name)} />
            ))}
            {awayCompanions.map((c, i) => (
              <div key={`a${i}`} className="party-mem" style={{ opacity: 0.5 }}>
                <div className="av">{mono(c.name)}</div>
                <div><div className="pm-name">{c.name}</div><div className="pm-sub">away</div></div>
              </div>
            ))}
          </div>
        </aside>

        {/* CENTER STAGE */}
        <section className="ck-stage">
          <div className="stage-strip">
            {combatState && <span className="strip-pill combat"><span className="pulse" />combat · round {combatState.round || 1}</span>}
            <span className="strip-pill scene"><Ic n="pin" />{activeSession?.startingLocation?.name || activeSession?.title || 'In the world'}</span>
            {gameDate?.displayDate && <span className="strip-pill"><Ic n="clock" />{gameDate.displayDate}</span>}
          </div>

          <div className="transcript scroll">
            <div className="read-col">
              {sessionRecap && (
                <div className="narr-card" style={{ marginBottom: 4 }}>
                  <div className="marker">Previously…</div>
                  <div className="ncbody">{sessionRecap}</div>
                  <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={onClearRecap}>Continue</button>
                </div>
              )}
              {messages.map(renderMessage)}
              {isLoading && (
                <div className="dm-block"><div className="who">Dungeon Master</div>
                  <div className="prose" style={{ color: 'var(--ink-3)', fontStyle: 'normal' }}>The Dungeon Master is writing…</div></div>
              )}
              {error && <div className="sys-event" style={{ color: 'var(--bad)' }}>{error}</div>}
              <div ref={messagesEndRef} />
            </div>
          </div>

          <div className="composer-wrap">
            <form className="composer" onSubmit={onSend}>
              <textarea
                value={inputAction}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={handleKey}
                placeholder={secondCharacter ? 'What do you both do?  (Shift+Enter for a new line)' : 'What do you do?  (Shift+Enter for a new line)'}
                disabled={isLoading}
                autoFocus
                rows={2}
              />
              <button type="button" className="btn" title="Quick die roll" onClick={() => quickInsert('I roll a d20.')}><Ic n="die" /></button>
              <button type="submit" className="btn primary lg" disabled={isLoading || !inputAction.trim()}>Act</button>
            </form>
            <div className="quick-row">
              <span className="ql">quick</span>
              <span className="qchip" onClick={() => quickInsert('I look around and take in the scene.')}>look around</span>
              <span className="qchip" onClick={() => quickInsert('I make a Perception check.')}>perception</span>
              <span className="qchip" onClick={() => quickInsert('I make an Insight check.')}>insight</span>
              {combatState && <span className="qchip" onClick={() => quickInsert('I end my turn.')}>end turn</span>}
            </div>
          </div>
        </section>

        {/* RIGHT RAIL — vitals + combat + dice */}
        <aside className="ck-rail right scroll">
          <div className="hp-block">
            <div className="hp-row"><span className="cur">{character?.current_hp ?? 0}</span><span className="slash">/</span><span className="max">{character?.max_hp ?? 0}</span><span className="lbl">{charName}</span></div>
            <div className={`hptrack ${hpKind(character?.current_hp ?? 0, character?.max_hp ?? 1)}`}><div className="fill" style={{ width: `${character?.max_hp ? Math.max(0, Math.min(100, (character.current_hp / character.max_hp) * 100)) : 100}%` }} /></div>
            <div className="res-row"><span className="rl">AC</span><span className="num" style={{ fontSize: 15 }}>{character?.armor_class ?? 10}</span><span className="rl" style={{ marginLeft: 'auto' }}>Gold</span><span className="num" style={{ fontSize: 15, color: 'var(--accent)' }}>{character?.gold_gp ?? 0}</span></div>
          </div>

          {slotLevels.length > 0 && (
            <div className="ck-panel">
              <div className="label">Spell slots<span className="ln" /></div>
              {slotLevels.map(l => {
                const m = spellSlots.max[l], u = spellSlots.used?.[l] || 0
                return (
                  <div key={l} className="res-row" style={{ marginTop: 4 }}>
                    <span className="rl">Lv {l}</span>
                    <div className="pips">{Array.from({ length: m }).map((_, i) => <span key={i} className={`pip${i >= u ? ' full' : ' spent'}`} />)}</div>
                  </div>
                )
              })}
            </div>
          )}

          {playerConditions.length > 0 && (
            <div className="ck-panel">
              <div className="label">Conditions<span className="ln" /></div>
              <div className="party-tags" style={{ marginTop: 0 }}>
                {playerConditions.map((c, i) => (
                  <span key={i} className="ptag bad" style={{ cursor: 'pointer' }} title="Click to clear" onClick={() => onToggleCondition(c, 'player')}>{cap(c)} ✕</span>
                ))}
              </div>
            </div>
          )}

          {combatState?.turnOrder?.length > 0 && (
            <div className="ck-panel">
              <div className="label">Initiative · round {combatState.round || 1}<span className="ln" /></div>
              {combatState.turnOrder.map((t, i) => (
                <div key={i} className={`init-row${i === combatState.currentTurn ? ' active' : i < combatState.currentTurn ? ' acted' : ''}${t.type === 'enemy' ? ' enemy' : ''}`}>
                  <span className="ord">{i + 1}</span><span className="inm">{t.name}</span><span className="ihp">{t.type}</span>
                </div>
              ))}
              <div className="dice-grid" style={{ marginTop: 8 }}>
                <button className="btn sm" onClick={onAdvanceTurn}>Next turn</button>
                <button className="btn ghost sm" onClick={onEndCombat}>End combat</button>
              </div>
            </div>
          )}

          <div className="ck-panel">
            <div className="label">Rest<span className="ln" /></div>
            <div className="dice-grid">
              <button className="btn sm" disabled={isLoading} onClick={() => onRest('short')}><Ic n="coffee" />Short</button>
              <button className="btn sm" disabled={isLoading} onClick={() => onRest('long')}><Ic n="moon" />Long</button>
            </div>
          </div>
        </aside>
      </div>

      {/* slide-in reference panels (existing components) */}
      {showQuickRef && <QuickReferencePanel character={character} onClose={() => setShowQuickRef(false)} spellSlots={spellSlots} />}
      {showCompanionsRef && (companions.length > 0 || awayCompanions.length > 0) && (
        <CompanionsPanel companions={companions} awayCompanions={awayCompanions} onClose={() => setShowCompanionsRef(false)} onSendActivity={onSendActivity} onRecallCompanion={onRecallCompanion} />
      )}
      {showInventory && <InventoryPanel character={character} companions={companions} itemsGainedThisSession={itemsGainedThisSession} onDiscard={onDiscard} onClose={() => setShowInventory(false)} onRefreshCharacter={onCharacterUpdated} />}
      {showConditionPanel && <ConditionPanel playerConditions={playerConditions} companionConditions={companionConditions} companions={companions} onToggleCondition={onToggleCondition} onClose={() => setShowConditionPanel(false)} />}

      {/* end-session modal */}
      {showEndOptions && (
        <div className="scrim" onClick={onCancelEnd}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>Pause or end?</h3></div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="btn" disabled={isLoading} onClick={onPause} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}><Ic n="pause" />Pause — save and return later</button>
              <button className="btn primary" disabled={isLoading} onClick={onComplete} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}><Ic n="check" />Complete — wrap up and claim rewards</button>
              <button className="btn danger" disabled={isLoading} onClick={onAbort} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}><Ic n="x" />Abort — discard, no rewards</button>
            </div>
            <div className="modal-foot"><button className="btn ghost" disabled={isLoading} onClick={onCancelEnd}>Keep playing</button></div>
          </div>
        </div>
      )}

      {/* recruitment modal */}
      {pendingRecruitment && (
        <div className="scrim" onClick={onDismissRecruit}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h3>A new companion?</h3></div>
            <div className="modal-body">
              <p className="lede" style={{ fontStyle: 'normal', fontSize: 18, color: 'var(--ink)', margin: '0 0 6px' }}>
                {pendingRecruitment.npc?.name || pendingRecruitment.npcName}
              </p>
              <p className="help" style={{ fontStyle: 'normal', margin: '0 0 14px' }}>
                {[pendingRecruitment.npc?.race, pendingRecruitment.npc?.occupation].filter(Boolean).join(' · ')}
              </p>
              <p style={{ fontFamily: 'var(--serif)', fontSize: 16, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0 }}>
                {pendingRecruitment.npcNotFound
                  ? `${pendingRecruitment.npcName} agreed to join you, but isn't in your NPC records yet — you can add them as a companion later.`
                  : `${pendingRecruitment.npc?.name} has agreed to join your party. Add them as a permanent companion?`}
              </p>
            </div>
            <div className="modal-foot">
              {!pendingRecruitment.npcNotFound && (
                <button className="btn primary" disabled={recruitmentLoading} onClick={() => onConfirmRecruit('npc_stats')}>{recruitmentLoading ? 'Adding…' : 'Add companion'}</button>
              )}
              <button className="btn ghost" disabled={recruitmentLoading} onClick={onDismissRecruit}>{pendingRecruitment.npcNotFound ? 'Got it' : 'Not now'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
